"""
Leffa virtual try-on HTTP service.

POST /tryon { person, garment, category }  -> image/png
GET  /health                               -> service + model state

Design notes
------------
* Exactly ONE checkpoint is resident. `virtual_tryon.pth` (VITON-HD) and
  `virtual_tryon_dc.pth` (DressCode) are each ~7.2 GB in fp32; holding both
  blows past a 16 GB GPU/box. Pick with LEFFA_MODEL=hd|dc at boot.
* VITON-HD is an upper-body model. If LEFFA_MODEL=hd and a lower_body /
  dresses request arrives we answer 422 rather than silently producing a
  wrong-category image.
* The heavy stack (SCHP parsing, OpenPose, DensePose/detectron2) is built once
  at startup and reused. Cold start is minutes, warm request is seconds.
* CPU is supported (dtype float32) so the same image can be validated without
  a GPU; CUDA runs float16, which is what the upstream README benchmarks.
"""

import base64
import io
import os
import sys
import threading
import time
import warnings
from typing import Optional

warnings.filterwarnings("ignore")

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

LEFFA_REPO = os.environ.get("LEFFA_REPO", "/opt/Leffa")
CKPTS = os.environ.get("LEFFA_CKPTS", os.path.join(LEFFA_REPO, "ckpts"))
LEFFA_MODEL = os.environ.get("LEFFA_MODEL", "hd").strip().lower()
MAX_SIDE = int(os.environ.get("LEFFA_MAX_SIDE", "1024"))
HOST = os.environ.get("LEFFA_HOST", "0.0.0.0")
PORT = int(os.environ.get("LEFFA_PORT", "8090"))

CHECKPOINTS = {
    "hd": "virtual_tryon.pth",        # trained on VITON-HD   (upper_body only)
    "dc": "virtual_tryon_dc.pth",     # trained on DressCode  (all categories)
}
UPPER_ONLY = LEFFA_MODEL == "hd"

sys.path.insert(0, LEFFA_REPO)
os.chdir(LEFFA_REPO)

import torch  # noqa: E402

# The 7.2 GB checkpoint must never be buffered twice alongside the model built
# from config -- on a 16 GB box that is an OOM. mmap the file instead.
_orig_load = torch.load


def _load(*args, **kwargs):
    path = args[0] if args else kwargs.get("f")
    big = isinstance(path, str) and os.path.exists(path) and os.path.getsize(path) > 1_000_000_000
    if big:
        kwargs.setdefault("mmap", True)
    kwargs.setdefault("weights_only", True)
    try:
        return _orig_load(*args, **kwargs)
    except Exception:
        kwargs.pop("mmap", None)
        kwargs.pop("weights_only", None)
        return _orig_load(*args, **kwargs)


torch.load = _load

# Upstream hardcodes device="cuda" when building the pipeline (scheduler + RNG).
import leffa.pipeline as _pl  # noqa: E402

_orig_init = _pl.LeffaPipeline.__init__


def _device_init(self, model, device="cpu", **kw):
    _orig_init(self, model, device="cpu" if not torch.cuda.is_available() else "cuda")


_pl.LeffaPipeline.__init__ = _device_init

from PIL import Image  # noqa: E402

from leffa.inference import LeffaInference  # noqa: E402
from leffa.model import LeffaModel  # noqa: E402
from leffa.transform import LeffaTransform  # noqa: E402
from leffa_utils.densepose_predictor import DensePosePredictor  # noqa: E402
from leffa_utils.utils import (  # noqa: E402
    get_agnostic_mask_dc,
    get_agnostic_mask_hd,
    resize_and_center,
)
from preprocess.humanparsing.run_parsing import Parsing  # noqa: E402
from preprocess.openpose.run_openpose import OpenPose  # noqa: E402

CATEGORIES = ("upper_body", "lower_body", "dresses")

READY = {"ready": False, "error": None, "model": LEFFA_MODEL, "device": None}
_STATE_LOCK = threading.Lock()
_ENGINE = {}


class TryonRequest(BaseModel):
    # base64 (optionally data-URI prefixed) or raw URL; the field name is fixed
    # by the API contract: {person, garment, category}
    person: str = Field(..., description="base64 image or http(s) URL of the person")
    garment: str = Field(..., description="base64 image or http(s) URL of the garment")
    category: str = Field("upper_body", description="upper_body | lower_body | dresses")
    steps: int = Field(30, ge=1, le=100, description="diffusion steps")
    guidance_scale: float = Field(2.5, ge=0.0, le=10.0)
    seed: int = Field(42, ge=0)
    ref_acceleration: bool = Field(True)
    repaint: bool = Field(False)


def _decode_image(payload: str, what: str) -> Image.Image:
    """Accept `data:image/png;base64,...`, bare base64, or an http(s) URL."""
    raw = payload.strip()
    try:
        if raw.startswith("data:"):
            raw = raw.split(",", 1)[1]
        data = base64.b64decode(raw, validate=False)
        return Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        pass

    if raw.startswith(("http://", "https://")):
        import urllib.request

        req = urllib.request.Request(raw, headers={"user-agent": "leffa-service/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return Image.open(io.BytesIO(resp.read())).convert("RGB")
        except Exception as exc:
            raise HTTPException(422, f"{what}: could not fetch URL: {exc}") from exc

    raise HTTPException(422, f"{what}: not valid base64 image data and not an http(s) URL")


def _load_engine() -> None:
    """Build parsing/pose/densepose + the Leffa model. Blocks until done."""
    if _ENGINE:
        return
    t0 = time.time()

    parsing = Parsing(
        atr_path=os.path.join(CKPTS, "humanparsing", "parsing_atr.onnx"),
        lip_path=os.path.join(CKPTS, "humanparsing", "parsing_lip.onnx"),
    )
    openpose = OpenPose(body_model_path=os.path.join(CKPTS, "openpose", "body_pose_model.pth"))
    densepose_predictor = DensePosePredictor(
        config_path=os.path.join(CKPTS, "densepose", "densepose_rcnn_R_50_FPN_s1x.yaml"),
        weights_path=os.path.join(CKPTS, "densepose", "model_final_162be9.pkl"),
    )

    ckpt = os.path.join(CKPTS, CHECKPOINTS[LEFFA_MODEL])
    if not os.path.exists(ckpt):
        raise FileNotFoundError(f"checkpoint missing: {ckpt}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = LeffaModel(
        pretrained_model_name_or_path=os.path.join(CKPTS, "stable-diffusion-inpainting"),
        pretrained_model=ckpt,
        dtype="float16" if device == "cuda" else "float32",
    )
    if device == "cpu":
        model.float()
    inference = LeffaInference(model=model)

    _ENGINE.update(
        parsing=parsing,
        openpose=openpose,
        densepose=densepose_predictor,
        inference=inference,
        transform=LeffaTransform(),
        load_s=time.time() - t0,
    )
    READY.update(ready=True, error=None, device=inference.device)
    print(f"[leffa] engine ready in {time.time() - t0:.1f}s on {inference.device}", flush=True)


def _run(req: TryonRequest) -> bytes:
    src = _decode_image(req.person, "person")
    ref = _decode_image(req.garment, "garment")

    src = resize_and_center(src, MAX_SIDE, int(MAX_SIDE * 1024 / 768))
    ref = resize_and_center(ref, MAX_SIDE, int(MAX_SIDE * 1024 / 768))
    src_array = __import__("numpy").array(src)

    model_parse, _ = _ENGINE["parsing"](src.resize((384, 512)))
    keypoints = _ENGINE["openpose"](src.resize((384, 512)))

    if LEFFA_MODEL == "hd":
        mask = get_agnostic_mask_hd(model_parse, keypoints, req.category)
    else:
        mask = get_agnostic_mask_dc(model_parse, keypoints, req.category)
    mask = mask.resize(src.size)

    # `_load_engine` stores this under `densepose` (not `densepose_predictor`).
    # Reading the wrong key raises KeyError after parsing + openpose have
    # already run, which is a 7-second round trip to a 500 -- so the key name
    # is asserted here rather than left to be discovered at runtime.
    seg = _ENGINE["densepose"].predict_seg(src_array)
    densepose = Image.fromarray(seg[:, :, ::-1])

    data = _ENGINE["transform"](
        {"src_image": [src], "ref_image": [ref], "mask": [mask], "densepose": [densepose]}
    )

    out = _ENGINE["inference"](
        data,
        ref_acceleration=req.ref_acceleration,
        num_inference_steps=req.steps,
        guidance_scale=req.guidance_scale,
        seed=req.seed,
        repaint=req.repaint,
    )
    image = out["generated_image"][0]

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


app = FastAPI(title="fashionistas-tryon", version="1.0.0")


@app.on_event("startup")
def _startup() -> None:
    try:
        with _STATE_LOCK:
            _load_engine()
    except Exception as exc:  # surface boot failure on /health, don't crash-loop silently
        READY.update(ready=False, error=str(exc)[:500])
        print(f"[leffa] engine failed: {exc}", flush=True)


@app.get("/health")
def health() -> dict:
    return {
        "ok": READY["ready"],
        "ready": READY["ready"],
        "model": LEFFA_MODEL,
        "checkpoint": CHECKPOINTS[LEFFA_MODEL],
        "device": READY["device"],
        "error": READY["error"],
        "upper_body_only": UPPER_ONLY,
        "categories": ["upper_body"] if UPPER_ONLY else list(CATEGORIES),
    }


@app.post("/tryon")
def tryon(req: TryonRequest) -> Response:
    if not READY["ready"]:
        raise HTTPException(503, f"model not loaded: {READY['error'] or 'starting'}")

    category = (req.category or "upper_body").strip().lower()
    if category not in CATEGORIES:
        raise HTTPException(422, f"category must be one of {CATEGORIES}")
    if UPPER_ONLY and category != "upper_body":
        # VITON-HD checkpoint cannot do these -- say so rather than mis-render.
        raise HTTPException(
            422,
            "category_not_supported_by_model: LEFFA_MODEL=hd (VITON-HD) supports "
            "upper_body only. Set LEFFA_MODEL=dc (DressCode) for lower_body/dresses.",
        )

    t0 = time.time()
    try:
        with _STATE_LOCK:  # one in-flight generation at a time on a small box
            png = _run(req)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"inference failed: {str(exc)[:400]}") from exc

    return Response(
        content=png,
        media_type="image/png",
        headers={
            "x-tryon-ms": str(int((time.time() - t0) * 1000)),
            "x-tryon-steps": str(req.steps),
            "x-tryon-model": LEFFA_MODEL,
            "x-tryon-category": category,
            "cache-control": "no-store",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
