"""FASHN VTON v1.5 serverless HTTP service on Modal.

Model: FASHN VTON v1.5 (https://huggingface.co/fashn-ai/fashn-vton-1.5),
Apache-2.0, 972M-param maskless pixel-space try-on MMDiT.

HTTP contract (consumed by the Cloudflare Pages/Functions JS side):

    POST /tryon
    Content-Type: application/json
    {
      "person": "<base64 image bytes>",
      "garment": "<base64 image bytes>",
      "category": "tops" | "bottoms" | "one-pieces",
      "photo_type": "model",
      "steps": 20,
      "guidance": 1.5,
      "seed": 12345,
      "segmentation_free": true
    }
    -> 200 image/webp  (raw bytes) with x-fashn-ms, x-fashn-seed, x-fashn-category
    -> 4xx/5xx application/json {"ok": false, "error": "...", "detail": "..."}

    GET /healthz
    -> 200 {"ok": true, "model": "fashn-vton-1.5", "steps_default": 20}

Design notes
------------
* Top-level imports are stdlib + `modal` only, because `modal deploy` imports
  this file on the *deploying* machine. fastapi/PIL/torch/fashn_vton are
  imported inside the container (or inside the ASGI factory) where they exist.
* Weights are baked into the image by `download_weights.py` at image build
  time, so no container ever downloads them again.
* DWPose is pinned to CPU execution - see `_force_cpu_pose_detection`.
* Scale-to-zero: `min_containers=0`, `scaledown_window=60`. Nothing runs while
  idle; the GPU is only billed while a container is up.
* Modal enforces a 150s HTTP limit on Web Functions; `INFER_TIMEOUT_S` is set
  well below it so this service returns its own JSON 504 instead of a gateway
  error whenever it can.
"""

import base64
import binascii
import io
import json
import logging
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import modal

# NOTE: no `from __future__ import annotations`. FastAPI resolves route
# annotations through the module globals, and `Request` / `StarletteHTTPException`
# are imported inside `_make_web_app()` so that `modal deploy` does not need
# fastapi installed locally. Stringified annotations would not resolve and
# FastAPI would silently treat `request: Request` as a query parameter.

# ---------------------------------------------------------------------------
# Contract constants - do not change without changing the JS caller too.
# ---------------------------------------------------------------------------

APP_NAME = "fashn-vton"
MODEL_ID = "fashn-vton-1.5"

STEPS_DEFAULT = 20  # the product default
STEPS_MIN, STEPS_MAX = 10, 50  # the model's supported range
GUIDANCE_DEFAULT = 1.5  # upstream default (examples/basic_inference.py)
GUIDANCE_MIN, GUIDANCE_MAX = 0.0, 20.0
SEED_DEFAULT = 42  # upstream default
SEED_MIN, SEED_MAX = 0, 2**32 - 1  # np.random.seed() bound

CATEGORIES = ("tops", "bottoms", "one-pieces")
PHOTO_TYPES = ("model", "flat-lay")

MAX_BODY_BYTES = 32 * 1024 * 1024  # 32 MB JSON payload cap
MAX_IMAGE_BYTES = 12 * 1024 * 1024  # 12 MB decoded image cap, each
MAX_IMAGE_PIXELS = 40_000_000  # decompression-bomb guard

# Modal hard-cuts Web Function HTTP requests at 150s. Stay well under it so
# the caller gets our JSON body rather than a proxy-level error/redirect.
INFER_TIMEOUT_S = 120
WEBP_QUALITY = 90

# Deploy-time GPU selection. Modal refuses to reserve a GPU without a payment
# method on file, so `FASHN_GPU=none modal deploy ...` publishes the same
# HTTP contract on CPU (for endpoint/contract verification) while the default
# stays L4 for real inference. Read at deploy time - it is a property of how
# the app is deployed, not of the container.
GPU = os.environ.get("FASHN_GPU", "L4").strip().lower()
GPU = None if GPU in ("", "none", "cpu", "off") else GPU
GPU_LABEL = GPU or "cpu"

# Baked into the image by download_weights.py.
WEIGHTS_DIR = "/fashn/weights"
HF_HOME = "/fashn/hf"
DOWNLOAD_SCRIPT_REMOTE = "/root/download_weights.py"

HERE = Path(__file__).resolve().parent
log = logging.getLogger("fashn-vton")


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------


def _load_requirements() -> list[str]:
    """requirements.txt is the single source of truth for the container image.

    Read at deploy time (on the machine running `modal deploy`), not inside the
    container, so paths are resolved relative to this file rather than to $PWD.
    """
    path = HERE / "requirements.txt"
    if not path.is_file():
        raise FileNotFoundError(
            f"{path} not found. requirements.txt must sit next to app.py - the "
            "Modal image is built from it."
        )
    specs: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            specs.append(line)
    if not specs:
        raise ValueError(f"{path} contains no package specs")
    return specs


image = (
    modal.Image.debian_slim(python_version="3.11")
    # git: installs fashn-vton from GitHub (it is not published on PyPI).
    # libgl1/libglib2.0-0: import cv2 (opencv-python) needs libGL + libglib.
    # libgomp1: libgomp.so.1 for PyTorch's OpenMP.
    .apt_install("git", "libgl1", "libglib2.0-0", "libgomp1")
    .pip_install(*_load_requirements())
    .env(
        {
            # Both the bake step and runtime use the same paths, so the
            # human-parser cache baked at build time is the one read at runtime.
            "HF_HOME": HF_HOME,
            "FASHN_WEIGHTS_DIR": WEIGHTS_DIR,
            "MPLBACKEND": "Agg",  # dwpose imports matplotlib
            "PYTHONUNBUFFERED": "1",
            "TOKENIZERS_PARALLELISM": "false",
        }
    )
    .add_local_file(str(HERE / "download_weights.py"), DOWNLOAD_SCRIPT_REMOTE, copy=True)
    # `app.py` is re-imported *inside the container* at /root/app.py, and
    # _load_requirements() reads HERE/requirements.txt at module import time.
    # Without this line the image builds fine locally and then crash-loops on
    # every call with FileNotFoundError. Ship the file the code reads.
    .add_local_file(str(HERE / "requirements.txt"), "/root/requirements.txt", copy=True)
    # .env() above is an image ENV directive, so it is visible to this RUN too.
    .run_commands(f"python {DOWNLOAD_SCRIPT_REMOTE} --weights-dir {WEIGHTS_DIR}")
)

app = modal.App(APP_NAME, image=image)


# ---------------------------------------------------------------------------
# Pipeline: loaded once per container, on demand.
# ---------------------------------------------------------------------------

_STATE_LOCK = threading.Lock()
_PIPELINE: Any = None
_LOAD_ERROR: str | None = None
_LOAD_SECONDS: float | None = None

# One in-flight generation per container at a time. Set by the request handler,
# cleared by the worker thread's `finally`, so a request that times out cannot
# be followed by a second generation running on the same GPU.
_INFLIGHT = threading.Event()
_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="fashn-infer")


def _force_cpu_pose_detection() -> None:
    """Make DWPose use ONNX Runtime's CPUExecutionProvider, always.

    Upstream (`fashn_vton.dwpose.wholebody.Wholebody.__init__`) asks for
    `CUDAExecutionProvider` whenever the pipeline device is CUDA. Whether that
    provider can actually load depends on onnxruntime + CUDA/cuDNN being
    present in the container, and that cannot be proven before the first
    deploy; a provider that fails to load aborts session creation, which would
    fail every request. `CPUExecutionProvider` always exists in the CPU-only
    `onnxruntime` wheel this service installs, and pose detection is a small
    slice of total request time, so the device argument is pinned to "cpu".

    The constructor signature is unchanged; only the device is overridden.
    """
    import fashn_vton.pipeline as fashn_pipeline

    base = getattr(fashn_pipeline, "DWposeDetector", None)
    if base is None or not callable(base):
        raise RuntimeError(
            "fashn_vton.pipeline.DWposeDetector is missing. Upstream fashn-vton "
            "changed its layout - re-check services/fashn-modal/app.py against "
            "the version of fashn-vton being installed."
        )
    if getattr(base, "_fashn_cpu_pinned", False):
        return

    class _CpuDWposeDetector(base):  # type: ignore[valid-type,misc]
        _fashn_cpu_pinned = True

        def __init__(self, checkpoints_dir: str, device: str = "cuda:0") -> None:
            super().__init__(checkpoints_dir=checkpoints_dir, device="cpu")

    _CpuDWposeDetector.__doc__ = "DWposeDetector pinned to CPUExecutionProvider."
    fashn_pipeline.DWposeDetector = _CpuDWposeDetector  # type: ignore[assignment]


def _build_pipeline() -> Any:
    _force_cpu_pose_detection()
    from fashn_vton import TryOnPipeline

    # device=None -> upstream auto-detects CUDA and uses bfloat16 on it.
    return TryOnPipeline(weights_dir=WEIGHTS_DIR, device=None)


def _get_pipeline() -> tuple[Any, str | None]:
    """Return (pipeline, None) or (None, error). Never raises."""
    global _PIPELINE, _LOAD_ERROR, _LOAD_SECONDS

    with _STATE_LOCK:
        if _PIPELINE is not None:
            return _PIPELINE, None
        started = time.perf_counter()
        try:
            pipeline = _build_pipeline()
        except Exception as exc:  # noqa: BLE001 - reported to the caller as 503
            _LOAD_ERROR = f"{type(exc).__name__}: {str(exc)[:500]}"
            log.error("pipeline load failed: %s", _LOAD_ERROR)
            return None, _LOAD_ERROR
        _PIPELINE = pipeline
        _LOAD_ERROR = None
        _LOAD_SECONDS = round(time.perf_counter() - started, 2)
        log.info("pipeline ready in %ss (weights=%s)", _LOAD_SECONDS, WEIGHTS_DIR)
        return pipeline, None


# ---------------------------------------------------------------------------
# Request parsing / validation
# ---------------------------------------------------------------------------


class _HttpError(Exception):
    """A validation failure that maps directly onto an HTTP status."""

    def __init__(self, status: int, error: str, detail: str = "") -> None:
        super().__init__(error)
        self.status = status
        self.error = error
        self.detail = detail


@dataclass(frozen=True)
class _TryonRequest:
    person: Any  # PIL.Image.Image (RGB)
    garment: Any  # PIL.Image.Image (RGB)
    category: str
    photo_type: str
    steps: int
    guidance: float
    seed: int
    segmentation_free: bool


def _b64_len_for(byte_count: int) -> int:
    return ((byte_count + 2) // 3) * 4


def _require_choice(value: Any, field: str, allowed: tuple[str, ...]) -> str:
    if not isinstance(value, str):
        raise _HttpError(400, f"{field} must be a string", f"got {type(value).__name__}")
    if value not in allowed:
        raise _HttpError(400, f"{field} must be one of: {', '.join(allowed)}", f"got {value!r}")
    return value


def _require_int(value: Any, field: str, lo: int, hi: int) -> int:
    if isinstance(value, bool):
        raise _HttpError(400, f"{field} must be an integer", f"got boolean {value!r}")
    if isinstance(value, int):
        parsed = value
    elif isinstance(value, float) and value.is_integer():
        parsed = int(value)  # JSON clients sometimes send 20.0
    else:
        raise _HttpError(400, f"{field} must be an integer", f"got {type(value).__name__}")
    if not lo <= parsed <= hi:
        raise _HttpError(400, f"{field} must be between {lo} and {hi}", f"got {parsed}")
    return parsed


def _require_float(value: Any, field: str, lo: float, hi: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise _HttpError(400, f"{field} must be a number", f"got {type(value).__name__}")
    parsed = float(value)
    if not math.isfinite(parsed):
        raise _HttpError(400, f"{field} must be a finite number", f"got {parsed!r}")
    if not lo <= parsed <= hi:
        raise _HttpError(400, f"{field} must be between {lo} and {hi}", f"got {parsed}")
    return parsed


def _require_image(value: Any, field: str) -> Any:
    """base64 (optionally `data:...;base64,` prefixed) -> PIL RGB image."""
    from PIL import Image

    if value is None:
        raise _HttpError(400, f"{field} is required", f"missing field '{field}'")
    if not isinstance(value, str):
        raise _HttpError(400, f"{field} must be a base64 string", f"got {type(value).__name__}")

    raw = value.strip()
    if not raw:
        raise _HttpError(400, f"{field} is empty", f"field '{field}' was an empty string")

    if raw.startswith("data:"):
        header, sep, payload = raw.partition(",")
        if not sep or ";base64" not in header.lower():
            raise _HttpError(400, f"{field} data URI must be base64", header[:80])
        raw = payload

    raw = "".join(raw.split())  # tolerate line-wrapped base64
    if len(raw) > _b64_len_for(MAX_IMAGE_BYTES):
        raise _HttpError(
            413,
            f"{field} is too large",
            f"base64 length {len(raw)} exceeds {MAX_IMAGE_BYTES} decoded bytes",
        )
    if not raw:
        raise _HttpError(400, f"{field} is empty", f"field '{field}' decoded to nothing")

    try:
        data = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise _HttpError(400, f"{field} is not valid base64", str(exc)[:200]) from None

    if not data:
        raise _HttpError(400, f"{field} is empty", f"field '{field}' decoded to 0 bytes")
    if len(data) > MAX_IMAGE_BYTES:
        raise _HttpError(
            413, f"{field} is too large", f"{len(data)} bytes exceeds {MAX_IMAGE_BYTES}"
        )

    try:
        image_obj = Image.open(io.BytesIO(data))
    except Image.DecompressionBombError as exc:
        raise _HttpError(413, f"{field} has too many pixels", str(exc)[:200]) from None
    except Exception as exc:  # UnidentifiedImageError, OSError, ...
        raise _HttpError(
            400, f"{field} is not a readable image", f"{type(exc).__name__}: {str(exc)[:200]}"
        ) from None

    # Check dimensions before decoding pixels.
    if image_obj.width * image_obj.height > MAX_IMAGE_PIXELS:
        raise _HttpError(
            413,
            f"{field} has too many pixels",
            f"{image_obj.width}x{image_obj.height} exceeds {MAX_IMAGE_PIXELS}",
        )
    try:
        image_obj.load()
    except Image.DecompressionBombError as exc:
        raise _HttpError(413, f"{field} has too many pixels", str(exc)[:200]) from None
    except Exception as exc:
        raise _HttpError(
            400, f"{field} is not a readable image", f"{type(exc).__name__}: {str(exc)[:200]}"
        ) from None

    return image_obj.convert("RGB")


def _parse_body(body: bytes) -> _TryonRequest:
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError) as exc:
        raise _HttpError(
            400, "request body is not valid JSON", f"{type(exc).__name__}: {str(exc)[:200]}"
        ) from None
    if not isinstance(payload, dict):
        raise _HttpError(400, "request body must be a JSON object", f"got {type(payload).__name__}")

    category = _require_choice(payload.get("category"), "category", CATEGORIES)
    photo_type = _require_choice(payload.get("photo_type", "model"), "photo_type", PHOTO_TYPES)

    steps_value = payload.get("steps")
    steps = STEPS_DEFAULT if steps_value is None else _require_int(
        steps_value, "steps", STEPS_MIN, STEPS_MAX
    )
    guidance_value = payload.get("guidance")
    guidance = GUIDANCE_DEFAULT if guidance_value is None else _require_float(
        guidance_value, "guidance", GUIDANCE_MIN, GUIDANCE_MAX
    )
    seed_value = payload.get("seed")
    seed = SEED_DEFAULT if seed_value is None else _require_int(
        seed_value, "seed", SEED_MIN, SEED_MAX
    )

    segmentation_free = payload.get("segmentation_free", True)
    if segmentation_free is None:
        segmentation_free = True
    if not isinstance(segmentation_free, bool):
        raise _HttpError(
            400, "segmentation_free must be a boolean", f"got {type(segmentation_free).__name__}"
        )

    return _TryonRequest(
        person=_require_image(payload.get("person"), "person"),
        garment=_require_image(payload.get("garment"), "garment"),
        category=category,
        photo_type=photo_type,
        steps=steps,
        guidance=guidance,
        seed=seed,
        segmentation_free=segmentation_free,
    )


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------


def _run_inference(pipeline: Any, request: _TryonRequest) -> Any:
    """Run one try-on. Executes on `_EXECUTOR`'s single worker thread."""
    try:
        result = pipeline(
            person_image=request.person,
            garment_image=request.garment,
            category=request.category,
            garment_photo_type=request.photo_type,
            num_samples=1,
            num_timesteps=request.steps,
            guidance_scale=request.guidance,
            seed=request.seed,
            segmentation_free=request.segmentation_free,
        )
        images = getattr(result, "images", None)
        if not images:
            raise RuntimeError("pipeline returned no images")
        return images[0]
    finally:
        _INFLIGHT.clear()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:  # noqa: BLE001 - cleanup must never mask the real error
            pass


# ---------------------------------------------------------------------------
# HTTP surface
# ---------------------------------------------------------------------------


def _err(status: int, error: str, detail: str = "") -> Any:
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=status,
        content={"ok": False, "error": error, "detail": detail},
    )


def _make_web_app() -> Any:
    from fastapi import FastAPI, Request
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException

    web = FastAPI(
        title="fashn-vton",
        version="1.5",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @web.exception_handler(StarletteHTTPException)
    async def _on_http_exception(request: Request, exc: StarletteHTTPException) -> Any:
        return _err(exc.status_code, str(exc.detail), request.url.path)

    @web.exception_handler(RequestValidationError)
    async def _on_validation_error(request: Request, exc: RequestValidationError) -> Any:
        return _err(400, "request could not be validated", str(exc.errors())[:300])

    @web.exception_handler(Exception)
    async def _on_unhandled(request: Request, exc: Exception) -> Any:
        log.exception("unhandled error on %s", request.url.path)
        return _err(500, "internal error", f"{type(exc).__name__}: {str(exc)[:400]}")

    @web.get("/healthz", include_in_schema=False)
    def healthz() -> dict:
        return {"ok": True, "model": MODEL_ID, "steps_default": STEPS_DEFAULT}

    @web.post("/tryon", include_in_schema=False)
    async def tryon(request: Request) -> Any:
        from fastapi.responses import Response

        started = time.perf_counter()

        declared = request.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > MAX_BODY_BYTES:
            return _err(
                413,
                "request body is too large",
                f"content-length {declared} exceeds {MAX_BODY_BYTES}",
            )

        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            return _err(
                413,
                "request body is too large",
                f"{len(body)} bytes exceeds {MAX_BODY_BYTES}",
            )

        try:
            parsed = _parse_body(body)
        except _HttpError as exc:
            return _err(exc.status, exc.error, exc.detail)

        if _INFLIGHT.is_set():
            return _err(503, "model is busy with another request", "one generation at a time")

        pipeline, load_error = _get_pipeline()
        if pipeline is None:
            return _err(503, "model failed to load", load_error or "unknown error")

        _INFLIGHT.set()
        try:
            future = _EXECUTOR.submit(_run_inference, pipeline, parsed)
        except Exception as exc:  # noqa: BLE001 - executor rejected the work
            _INFLIGHT.clear()
            return _err(500, "could not start generation", f"{type(exc).__name__}: {str(exc)[:300]}")

        try:
            image_obj = future.result(timeout=INFER_TIMEOUT_S)
        except FutureTimeoutError:
            # Deliberately do NOT clear _INFLIGHT: the worker clears it when the
            # abandoned run finally finishes, so we never stack two generations
            # on one GPU. Later requests get a 503 until then.
            future.cancel()
            return _err(
                504,
                "generation timed out",
                f"no result after {INFER_TIMEOUT_S}s; the run may still finish "
                "in the background and the container will be recycled after "
                "the function timeout",
            )
        except Exception as exc:  # noqa: BLE001 - surfaced as 500
            return _err(500, "inference failed", f"{type(exc).__name__}: {str(exc)[:400]}")

        buffer = io.BytesIO()
        try:
            image_obj.save(buffer, format="WEBP", quality=WEBP_QUALITY)
        except Exception as exc:  # noqa: BLE001
            return _err(500, "could not encode output image", f"{type(exc).__name__}: {str(exc)[:300]}")

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return Response(
            content=buffer.getvalue(),
            media_type="image/webp",
            headers={
                "x-fashn-ms": str(elapsed_ms),
                "x-fashn-seed": str(parsed.seed),
                "x-fashn-category": parsed.category,
                "cache-control": "no-store",
            },
        )

    return web


# ---------------------------------------------------------------------------
# Modal wiring
# ---------------------------------------------------------------------------

@app.function(
    image=image,
    # L4: 24 GB VRAM - the 972M-param checkpoint is ~1.94 GB in bf16 and the
    # pipeline runs bfloat16 on Ampere+ (L4 is Ada), so 24 GB leaves ample room
    # for CFG batches at 864x576. It is the cheapest Modal GPU that supports
    # bf16 (A10G has the same 24 GB but costs ~40% more; T4 has no bf16 and
    # would fall back to fp32).
    gpu=GPU,  # "L4" by default; FASHN_GPU=none at deploy time -> CPU only
    cpu=4,  # DWPose + human parsing run on CPU
    memory=12288,  # MiB - peak RSS during checkpoint load
    timeout=300,  # hard per-input kill; the soft JSON 504 fires at 120s
    startup_timeout=600,  # first boot pulls the ~2.5 GB weights layer
    # SCALE TO ZERO: no container stays up. `min_containers=0` is the floor,
    # `scaledown_window=60` is how long an idle container may linger before it
    # is torn down (Modal's default, and the minimum sensible value) - so GPU
    # billing stops ~60s after the last request.
    min_containers=0,
    scaledown_window=60,
    # Cap GPU spend and keep cold-start burst bounded (Starter allows 10 GPU
    # concurrency; two is plenty for a single-product try-on service).
    max_containers=2,
)
@modal.asgi_app()
def api() -> Any:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    web = _make_web_app()

    # Warm the model while the container starts so the first request does not
    # pay model-load latency. Failures are recorded rather than raised: raising
    # here would make the container fail to boot and hide the real error behind
    # a generic startup failure. /tryon answers 503 with the recorded error.
    pipeline, load_error = _get_pipeline()
    if pipeline is None:
        log.error("container started WITHOUT a usable pipeline: %s", load_error)
    else:
        log.info("container warm; pipeline loaded in %ss", _LOAD_SECONDS)

    return web
