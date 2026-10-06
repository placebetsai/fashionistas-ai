#!/usr/bin/env python3
"""Offline tests for the FASHN VTON Modal service HTTP contract.

These run against `app._make_web_app()` with the diffusion pipeline stubbed
out, so they need no GPU, no Modal account and no model weights. They verify
the *contract* (status codes, error shape, response headers, kwargs passed to
the pipeline) - NOT that the model produces a good image.

Run:
    python services/fashn-modal/test_app.py

Everything here has been executed and passes (see README "What was tested").
"""

from __future__ import annotations

import base64
import io
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app as svc  # noqa: E402

# Captured at import, before main() stubs svc._count_persons out for the
# contract tests. The real-detector test needs the real function.
TRUE_COUNT_PERSONS = svc._count_persons

FAILURES: list[str] = []
CHECKS = 0


def check(condition: bool, label: str) -> None:
    global CHECKS
    CHECKS += 1
    if condition:
        print(f"  ok   {label}")
    else:
        print(f"  FAIL {label}")
        FAILURES.append(label)


def tiny_png_b64(width: int = 32, height: int = 48) -> str:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), (20, 120, 200)).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


class _StubResult:
    def __init__(self, images):
        self.images = images


class _StubPipeline:
    """Stands in for fashn_vton.TryOnPipeline."""

    def __init__(self, delay: float = 0.0, error: Exception | None = None):
        self.calls: list[dict] = []
        self.delay = delay
        self.error = error

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        if self.delay:
            time.sleep(self.delay)
        if self.error is not None:
            raise self.error
        return _StubResult([Image.new("RGB", (64, 96), (12, 200, 90))])


def use_pipeline(stub) -> None:
    svc._PIPELINE = stub
    svc._LOAD_ERROR = None
    svc._INFLIGHT.clear()


def valid_body(**overrides) -> dict:
    payload = {
        "person": tiny_png_b64(),
        "garment": tiny_png_b64(40, 40),
        "category": "tops",
        "photo_type": "model",
        "steps": 20,
        "guidance": 1.5,
        "seed": 12345,
        "segmentation_free": True,
    }
    payload.update(overrides)
    return payload


def post(client: TestClient, payload: dict | None = None, raw: bytes | None = None):
    if raw is not None:
        return client.post("/tryon", content=raw, headers={"Content-Type": "application/json"})
    return client.post("/tryon", json=payload)


def expect_error(response, status: int, label: str) -> None:
    body = _json(response)
    check(response.status_code == status, f"{label} -> {status} (got {response.status_code})")
    check(
        isinstance(body, dict)
        and body.get("ok") is False
        and isinstance(body.get("error"), str)
        and isinstance(body.get("detail"), str),
        f"{label} -> {{ok:false,error,detail}} shape (got {body!r})",
    )


def _json(response):
    try:
        return response.json()
    except Exception:
        return None


# ---------------------------------------------------------------------------


def test_healthz(client: TestClient) -> None:
    print("\nGET /healthz")
    response = client.get("/healthz")
    check(response.status_code == 200, "status 200")
    check(
        response.headers.get("content-type", "").startswith("application/json"),
        "content-type application/json",
    )
    check(
        response.json() == {"ok": True, "model": "fashn-vton-1.5", "steps_default": 20},
        f"exact body {response.json()!r}",
    )


def test_contract_fields(client: TestClient) -> None:
    print("\nPOST /tryon - full contract")
    stub = _StubPipeline()
    use_pipeline(stub)
    response = post(client, valid_body())
    check(response.status_code == 200, f"status 200 (got {response.status_code}: {response.text[:200]})")
    check(
        response.headers.get("content-type", "").startswith("image/webp"),
        f"content-type image/webp (got {response.headers.get('content-type')})",
    )
    body = response.content
    check(body[:4] == b"RIFF" and body[8:12] == b"WEBP", "body is a RIFF/WEBP file")
    check(len(body) > 0, f"body has bytes ({len(body)})")
    check(response.headers.get("x-fashn-ms") is not None, "x-fashn-ms present")
    check(
        response.headers.get("x-fashn-seed") == "12345",
        f"x-fashn-seed echoes seed (got {response.headers.get('x-fashn-seed')})",
    )
    check(
        response.headers.get("x-fashn-category") == "tops",
        f"x-fashn-category echoes category (got {response.headers.get('x-fashn-category')})",
    )
    check(response.headers.get("cache-control") == "no-store", "cache-control: no-store")

    check(len(stub.calls) == 1, "pipeline called once")
    call = stub.calls[0] if stub.calls else {}
    expected = {
        "category": "tops",
        "garment_photo_type": "model",
        "num_samples": 1,
        "num_timesteps": 20,
        "guidance_scale": 1.5,
        "seed": 12345,
        "segmentation_free": True,
    }
    for key, value in expected.items():
        check(call.get(key) == value, f"pipeline kwarg {key}={value!r} (got {call.get(key)!r})")
    check("person_image" in call and "garment_image" in call, "person_image/garment_image passed")


def test_defaults_and_passthrough(client: TestClient) -> None:
    print("\nPOST /tryon - defaults and overrides")
    stub = _StubPipeline()
    use_pipeline(stub)
    minimal = {
        "person": tiny_png_b64(),
        "garment": tiny_png_b64(),
        "category": "one-pieces",
    }
    response = post(client, minimal)
    check(response.status_code == 200, f"omitted optional fields accepted (got {response.status_code})")
    call = stub.calls[0] if stub.calls else {}
    check(call.get("num_timesteps") == 20, f"steps defaults to 20 (got {call.get('num_timesteps')})")
    check(call.get("guidance_scale") == 1.5, f"guidance defaults to 1.5 (got {call.get('guidance_scale')})")
    check(call.get("seed") == 42, f"seed defaults to 42 (got {call.get('seed')})")
    check(call.get("segmentation_free") is True, "segmentation_free defaults to true")
    check(call.get("garment_photo_type") == "model", "photo_type defaults to model")

    stub2 = _StubPipeline()
    use_pipeline(stub2)
    response = post(
        client,
        valid_body(
            category="bottoms",
            photo_type="flat-lay",
            steps=50,
            guidance=2.5,
            seed=0,
            segmentation_free=False,
        ),
    )
    check(response.status_code == 200, f"overrides accepted (got {response.status_code})")
    call = stub2.calls[0] if stub2.calls else {}
    check(call.get("num_timesteps") == 50, f"steps=50 passed (got {call.get('num_timesteps')})")
    check(call.get("guidance_scale") == 2.5, f"guidance=2.5 passed (got {call.get('guidance_scale')})")
    check(call.get("seed") == 0, f"seed=0 passed (got {call.get('seed')})")
    check(call.get("segmentation_free") is False, "segmentation_free=false passed")
    check(call.get("garment_photo_type") == "flat-lay", "photo_type=flat-lay passed")
    check(
        response.headers.get("x-fashn-category") == "bottoms",
        "x-fashn-category follows request",
    )

    use_pipeline(_StubPipeline())
    data_uri = "data:image/png;base64," + tiny_png_b64()
    response = post(client, valid_body(person=data_uri))
    check(response.status_code == 200, f"data: URI prefix accepted (got {response.status_code})")


def test_validation_errors(client: TestClient) -> None:
    print("\nPOST /tryon - validation")
    use_pipeline(_StubPipeline())

    expect_error(post(client, {"garment": tiny_png_b64(), "category": "tops"}), 400, "missing person")
    expect_error(post(client, {"person": tiny_png_b64(), "category": "tops"}), 400, "missing garment")
    expect_error(post(client, valid_body(person="")), 400, "empty person")
    expect_error(post(client, valid_body(category="dresses")), 400, "bad category")
    expect_error(post(client, valid_body(category="TOPS")), 400, "wrong case category")
    expect_error(post(client, valid_body(photo_type="flatlay")), 400, "bad photo_type")
    expect_error(post(client, valid_body(steps=9)), 400, "steps below range")
    expect_error(post(client, valid_body(steps=51)), 400, "steps above range")
    expect_error(post(client, valid_body(steps="20")), 400, "steps not an integer")
    expect_error(post(client, valid_body(steps=True)), 400, "steps as boolean")
    expect_error(post(client, valid_body(guidance="high")), 400, "guidance not a number")
    # httpx refuses to serialize Infinity, so send the literal JSON ourselves
    # (Python's json.loads accepts it - and so do the strict-enough checks here).
    inf_body = json.dumps(valid_body(guidance=1.5)).replace('"guidance": 1.5', '"guidance": Infinity')
    expect_error(post(client, raw=inf_body.encode()), 400, "guidance not finite")
    expect_error(post(client, valid_body(seed=-1)), 400, "seed below range")
    expect_error(post(client, valid_body(segmentation_free="yes")), 400, "segmentation_free not bool")
    expect_error(post(client, valid_body(person="!!!not base64!!!")), 400, "person not base64")
    expect_error(
        post(client, valid_body(person=base64.b64encode(b"definitely not an image").decode())),
        400,
        "person not an image",
    )
    expect_error(post(client, raw=b"{not json"), 400, "malformed JSON")
    expect_error(post(client, raw=b"[1, 2, 3]"), 400, "JSON array body")
    expect_error(post(client, raw=b""), 400, "empty body")
    check(
        post(client, valid_body(steps=10)).status_code == 200,
        "steps=10 (range lower bound) accepted",
    )
    check(
        post(client, valid_body(steps=50)).status_code == 200,
        "steps=50 (range upper bound) accepted",
    )


def test_oversized(client: TestClient) -> None:
    print("\nPOST /tryon - oversized input")
    use_pipeline(_StubPipeline())
    blob = base64.b64encode(b"x" * (svc.MAX_IMAGE_BYTES + 1024)).decode("ascii")
    expect_error(post(client, valid_body(person=blob)), 413, "person over image limit")

    original = svc.MAX_BODY_BYTES
    try:
        svc.MAX_BODY_BYTES = 100
        payload = json.dumps(valid_body())
        expect_error(post(client, raw=payload.encode()), 413, "body over MAX_BODY_BYTES")
    finally:
        svc.MAX_BODY_BYTES = original


def test_wrong_method_and_paths(client: TestClient) -> None:
    print("\nrouting errors")
    expect_error(client.get("/tryon"), 405, "GET /tryon")
    expect_error(client.get("/nope"), 404, "GET /nope")
    expect_error(client.post("/healthz", json={}), 405, "POST /healthz")


def test_pipeline_failures(client: TestClient) -> None:
    print("\nupstream failures")
    original_build = svc._build_pipeline
    original_pipeline = svc._PIPELINE
    try:
        svc._PIPELINE = None
        svc._LOAD_ERROR = None

        def _boom():
            raise RuntimeError("weights missing at /fashn/weights")

        svc._build_pipeline = _boom
        expect_error(post(client, valid_body()), 503, "pipeline fails to load")
        body = _json(post(client, valid_body()))
        check("weights missing" in (body or {}).get("detail", ""), "503 detail carries load error")

        svc._PIPELINE = _StubPipeline(error=RuntimeError("cuda out of memory"))
        expect_error(post(client, valid_body()), 500, "inference raises")
        body = _json(post(client, valid_body()))
        check("cuda out of memory" in (body or {}).get("detail", ""), "500 detail carries error")
    finally:
        svc._build_pipeline = original_build
        svc._PIPELINE = original_pipeline
        svc._LOAD_ERROR = None
        svc._INFLIGHT.clear()


def test_timeout_and_busy(client: TestClient) -> None:
    print("\nsoft timeout + busy guard")
    original_timeout = svc.INFER_TIMEOUT_S
    stub = _StubPipeline(delay=1.5)
    use_pipeline(stub)
    try:
        svc.INFER_TIMEOUT_S = 0.3
        response = post(client, valid_body())
        expect_error(response, 504, "inference exceeds soft timeout")
        check(svc._INFLIGHT.is_set(), "abandoned run keeps the container marked busy")
        expect_error(post(client, valid_body()), 503, "second request while busy")
        deadline = time.time() + 5
        while svc._INFLIGHT.is_set() and time.time() < deadline:
            time.sleep(0.1)
        check(not svc._INFLIGHT.is_set(), "busy flag clears when the abandoned run ends")
    finally:
        svc.INFER_TIMEOUT_S = original_timeout
        use_pipeline(_StubPipeline())

    check(post(client, valid_body()).status_code == 200, "container recovers after timeout")


def _find_yolox():
    """Path to yolox_l.onnx if real weights exist on this machine, else None.

    The contract tests never need it (the guard is stubbed). This is only for
    the real-detector test, which is skipped with a message when the weights
    are not present - a skip is honest, a fake pass is not.
    """
    cands = []
    if os.environ.get("FASHN_YOLOX"):
        cands.append(Path(os.environ["FASHN_YOLOX"]))
    if os.environ.get("FASHN_WEIGHTS_DIR"):
        cands += [
            Path(os.environ["FASHN_WEIGHTS_DIR"]) / "dwpose" / "yolox_l.onnx",
            Path(os.environ["FASHN_WEIGHTS_DIR"]) / "yolox_l.onnx",
        ]
    cands += [
        Path(svc.WEIGHTS_DIR) / "dwpose" / "yolox_l.onnx",
        # local e2e cache used by e2e_local.py (see README)
        Path("/tmp/opencode/fashn-modal-test/weights/dwpose/yolox_l.onnx"),
        Path(__file__).resolve().parent / "weights" / "dwpose" / "yolox_l.onnx",
    ]
    for c in cands:
        if c.is_file():
            return c
    return None


DOG_JPG = Path(__file__).resolve().parent / "testdata" / "dog.jpg"
PERSON_JPG = Path("/home/billionaremaker/Documents/Default Project/Placebetsai-src/public/israel-joffe/03-firefighter.jpg")


def test_no_person_guard(client) -> None:
    """A photo with no human in it must be refused with no GPU work at all."""
    use_pipeline(_StubPipeline())
    previous = svc._count_persons
    svc._count_persons = lambda _img: 0
    try:
        res = post(client, valid_body())
        expect_error(res, 400, "no person detected")
        body = _json(res)
        check(body.get("error") == "no person detected", "guard names the problem")
        check(body.get("detail") == svc.NO_PERSON_MSG,
              f"guard gives the friendly message (got {body.get('detail')!r})")
        check(svc._PIPELINE.calls == [],
              "no GPU call is made when no person is detected")
        check(svc._INFLIGHT.is_set() is False, "busy flag not set by a rejected photo")
    finally:
        svc._count_persons = previous


def test_person_check_unavailable(client) -> None:
    """If the detector cannot run we fail closed rather than spend GPU."""
    use_pipeline(_StubPipeline())
    previous = svc._count_persons

    def _boom(_img):
        raise RuntimeError("weights missing")

    svc._count_persons = _boom
    try:
        expect_error(post(client, valid_body()), 503, "person check unavailable")
        check(svc._PIPELINE.calls == [], "no GPU call when the check itself fails")
    finally:
        svc._count_persons = previous


def test_real_detector_rejects_dog(client) -> None:
    """Run the real YOLOX weights on the dog photo end to end.

    This is the case that started the whole guard: a dog picture is a valid
    image, passes every shape check, and used to be handed to the GPU, which
    returned the input resized with no garment applied - a paid, useless render.
    """
    yolox = _find_yolox()
    if yolox is None:
        print("  skip real detector: yolox_l.onnx not on this machine "
              "(set FASHN_YOLOX=/path/to/yolox_l.onnx to run it)")
        return
    if not DOG_JPG.is_file():
        print(f"  FAIL missing fixture {DOG_JPG}")
        FAILURES.append("dog fixture missing")
        return

    real = svc._count_persons
    svc._count_persons = TRUE_COUNT_PERSONS
    saved_path, saved_session = svc.YOLOX_PATH, svc._DET_SESSION
    svc.YOLOX_PATH, svc._DET_SESSION = yolox, None
    try:
        from PIL import Image as _Image

        dog = _Image.open(DOG_JPG).convert("RGB")
        n = svc._count_persons(dog)
        check(n == 0, f"real YOLOX finds {n} people in the dog photo (want 0, weights {yolox})")

        use_pipeline(_StubPipeline())
        payload = valid_body(person=base64.b64encode(DOG_JPG.read_bytes()).decode("ascii"))
        res = post(client, payload)
        expect_error(res, 400, "dog photo")
        check(_json(res).get("detail") == svc.NO_PERSON_MSG, "dog photo gets the friendly message")
        check(svc._PIPELINE.calls == [], "dog photo never reaches the GPU")

        if PERSON_JPG.is_file():
            real_persons = svc._count_persons(_Image.open(PERSON_JPG).convert("RGB"))
            check(real_persons >= 1,
                  f"real YOLOX still finds {real_persons} person in a human photo (control)")
        else:
            print(f"  note: control photo not present at {PERSON_JPG} - accept path stubbed only")
    finally:
        svc.YOLOX_PATH, svc._DET_SESSION = saved_path, saved_session
        svc._count_persons = real
        use_pipeline(_StubPipeline())


def test_image_ships_import_time_files() -> None:
    """`app.py` is re-imported *inside the container* at /root/app.py.

    Module-level code runs there too, so every file it reads must already be in
    the image. Without this the image builds fine locally (the file exists on
    the deploying machine) and then crash-loops forever with FileNotFoundError
    - every call sits Pending with a dead container. That is exactly what
    happened before the guard below was added.
    """
    source = (Path(__file__).resolve().parent / "app.py").read_text(encoding="utf-8")

    check(
        '.add_local_file(str(HERE / "requirements.txt"), "/root/requirements.txt"' in source,
        "image ships requirements.txt to /root/requirements.txt (else import crash-loop)",
    )
    check(
        ".add_local_file(str(HERE / \"download_weights.py\"), DOWNLOAD_SCRIPT_REMOTE" in source,
        "image ships download_weights.py",
    )
    check("GPU = os.environ.get(\"FASHN_GPU\"" in source,
          "GPU selectable at deploy time via FASHN_GPU")
    check("gpu=GPU," in source, "function uses the deploy-time GPU, not a hardcoded literal")
    check(
        "asgi_app(requires_proxy_auth=True)" in source,
        "web function requires proxy auth (else anyone with the URL burns GPU)",
    )


def main() -> int:
    svc._PIPELINE = _StubPipeline()
    client = TestClient(svc._make_web_app())

    # Contract tests upload solid-colour rectangles as the "person", which the
    # real detector would (correctly) reject. Default the guard to "person
    # present" so the rest of the suite tests the rest of the contract; the
    # guard itself is tested separately below, including against real weights.
    svc._count_persons = lambda _img: 1

    test_healthz(client)
    test_contract_fields(client)
    test_defaults_and_passthrough(client)
    test_validation_errors(client)
    test_oversized(client)
    test_wrong_method_and_paths(client)
    test_pipeline_failures(client)
    test_timeout_and_busy(client)
    test_no_person_guard(client)
    test_person_check_unavailable(client)
    test_real_detector_rejects_dog(client)
    test_image_ships_import_time_files()

    print(f"\n{CHECKS} checks, {len(FAILURES)} failures")
    for name in FAILURES:
        print(f"  FAILED: {name}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
