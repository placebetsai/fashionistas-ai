# services/fashn-modal — FASHN VTON v1.5 on Modal

A serverless HTTP wrapper around **FASHN VTON v1.5**, the maskless pixel-space
try-on MMDiT from FASHN AI, deployed on [Modal](https://modal.com). It exposes
exactly two routes — `POST /tryon` and `GET /healthz` — so the Cloudflare
Pages/Functions JavaScript side can call one URL and get WebP bytes back.

* **Model:** FASHN VTON v1.5 (`fashn-vton-1.5`, 972M params, ~1.94 GB bf16
  checkpoint) — <https://huggingface.co/fashn-ai/fashn-vton-1.5>
* **Runtime:** `fashn-vton` from <https://github.com/fashn-AI/fashn-vton-1.5>
  (not on PyPI), installed straight from the official repo.
* **Compute:** one Modal container, `gpu="L4"`, scale-to-zero.
* **License of the model and its runtime:** **Apache-2.0** (see
  [License](#license)).

Files in this directory:

| File | Lines | What it is |
| --- | ---: | --- |
| `app.py` | 610 | The Modal app: image build, validation, inference, HTTP routes. |
| `download_weights.py` | 132 | Runs *inside the image build* and bakes the 4 weight files in. |
| `requirements.txt` | 34 | Single source of truth for container deps; read at deploy time. |
| `test_app.py` | 356 | Offline contract suite — 97 checks, runs with no Modal account. |
| `.gitignore` | 45 | Keeps weights, caches and generated images out of git. |
| `README.md` | this file | Signup, deploy, test, cost, caller wiring. |

---

## NOT TESTED — no Modal account exists yet

**This service has never been deployed. There is no Modal account, therefore no
`modal deploy` has ever run, no image has ever been built by Modal, and no
request has ever hit a `.modal.run` URL.** Everything below the "Deploy" header
is written from Modal's documented behaviour and from the locally installed
`modal` SDK (v1.6.1), not from a successful run. Treat every output block in
this file as **illustrative**, not as a transcript.

Specifically **not proven**:

1. `modal deploy services/fashn-modal/app.py` succeeds at all — the image build
   (`apt` + `pip install` of torch/onnxruntime + the ~2.5 GB weight bake) has
   never executed on Modal's builders.
2. That `fashn-vton @ git+https://github.com/fashn-AI/fashn-vton-1.5.git`
   installs cleanly in Modal's `debian_slim` Python 3.11 image. The git URL
   resolves (`HEAD 7c0f10a`) and the package metadata is `fashn-vton 1.5.0`,
   but no container has installed it.
3. **GPU execution.** This machine has no CUDA. Nothing here has ever run on an
   L4, so bf16 autodetection, CUDA memory headroom and GPU latency are all
   guesses.
4. **That 20 steps finish inside `INFER_TIMEOUT_S = 120`.** On CPU, one step
   took ~130 s (see below); an L4 with bf16 should be far faster, but that has
   not been measured. If the first real deploy returns
   `{"error":"generation timed out"}`, raise `INFER_TIMEOUT_S` in `app.py` —
   and keep it **under 150 s**, which is Modal's hard HTTP limit for Web
   Functions.
5. Cold-start duration: `startup_timeout=600` is set, but how long the ~2.5 GB
   weights layer takes to pull onto a fresh GPU container is unmeasured.
6. CORS behaviour of `@modal.asgi_app()` (see [How the app calls
   it](#how-the-app-calls-it-modal_url)).
7. Modal billing, `min_containers`/`scaledown_window` behaviour on the Starter
   plan, and `max_containers=2` under real concurrency.
8. **Nothing has been wired to it.** No Cloudflare route reads `MODAL_URL` yet
   (`functions/` was deliberately left untouched — see the note under [How the
   app calls it](#the-existing-caller-in-this-repo-is-not-a-drop-in)).

**What *has* been tested** (on this machine, no Modal account needed):

* `python test_app.py` → **97 checks, 0 failures**: exact `/healthz` body,
  200 + `image/webp` + all three `x-fashn-*` headers, kwargs passthrough and
  defaults, 20 distinct 400 validation cases, 413 oversize, 405/404 shape, 503
  on load failure and while busy, 500 on inference failure, 504 on soft timeout
  and recovery afterwards.
* `download_weights.py` → run end-to-end locally; all four files fetched and
  size-checked: model 1,943,668,048 B, YOLOX 216,746,733 B, DWPose
  134,399,116 B, and the human-parser HF cache reported as 512,296,052 B by
  the script (it sums every file under the repo dir, so blobs counted twice by
  HF's cache layout are counted twice too; unique content on disk is ~257 MB —
  either way the script's 200,000,000-byte floor passed). Total baked content
  ≈ **2.55 GB**.
* A real end-to-end request through `app.py`'s handler against the real
  pipeline, CPU-only, `steps=1`: **status 200, `image/webp`,
  `x-fashn-ms: 146380`, `x-fashn-seed: 12345`, `x-fashn-category: tops`,
  valid WEBP 576×729 (43,530 B)**, and a second request also 200 with the
  pipeline cached (load 10.82 s). That run proves the handler, validation,
  WebP encoding, headers and the exact `pipeline(...)` call signature — not
  GPU speed, not Modal.

---

## HTTP contract (as implemented)

### `GET /healthz`

```
200 application/json
{"ok":true,"model":"fashn-vton-1.5","steps_default":20}
```

Byte-for-byte, no trailing newline (asserted by `test_app.py`).

### `POST /tryon`

Request — `Content-Type: application/json`:

```json
{
  "person": "<base64 image bytes>",
  "garment": "<base64 image bytes>",
  "category": "tops",
  "photo_type": "model",
  "steps": 20,
  "guidance": 1.5,
  "seed": 12345,
  "segmentation_free": true
}
```

| Field | Required | Type / allowed | Default when omitted |
| --- | --- | --- | --- |
| `person` | yes | base64 string, optional `data:...;base64,` prefix | — (400 if missing/empty) |
| `garment` | yes | base64 string, optional `data:...;base64,` prefix | — (400 if missing/empty) |
| `category` | yes | `tops` \| `bottoms` \| `one-pieces` | — (400 if missing/invalid) |
| `photo_type` | no | `model` \| `flat-lay` | `model` |
| `steps` | no | integer 10–50 | `20` |
| `guidance` | no | finite number 0–20 | `1.5` |
| `seed` | no | integer 0–4294967295 | `42` |
| `segmentation_free` | no | boolean | `true` |

Success:

```
200 image/webp
<raw WebP bytes, quality 90>
x-fashn-ms: <server-side elapsed ms>
x-fashn-seed: <seed actually used>
x-fashn-category: <category>
cache-control: no-store
```

Errors — always `application/json` with the same three keys:

```json
{"ok": false, "error": "<short reason>", "detail": "< specifics>"}
```

| Status | When |
| ---: | --- |
| 400 | missing/empty `person` or `garment`; invalid `category`/`photo_type`; `steps` outside 10–50; non-integer/boolean `steps`; non-finite or out-of-range `guidance`; out-of-range `seed`; non-boolean `segmentation_free`; undecodable base64; unreadable image; body not valid JSON / not an object. |
| 413 | body over 32 MB (checked against `content-length` *and* actual bytes); one image over 12 MB decoded; over 40,000,000 pixels (decompression-bomb guard). |
| 404 / 405 | unknown path / wrong method — returned as the same `{ok,error,detail}` JSON by the exception handlers. |
| 500 | inference blew up, no image came back, WebP encode failed, or the executor refused the work. |
| 503 | pipeline failed to load (read `detail`), or a generation is already running (one at a time per container). |
| 504 | generation exceeded `INFER_TIMEOUT_S` (120 s). |

Base64 input is tolerant: line wrapping and a `data:` URI header are both
accepted; whitespace inside the payload is stripped before decoding.

---

## Sign up for Modal (cold browser)

Exact steps, start to finish:

1. Open a fresh browser window and go to **<https://modal.com>**.
2. Click **Sign up** (it navigates to `https://modal.com/signup`; the link
   carries `?next=%2Fapps`, so you land on the apps page afterwards).
3. The page reads **"Sign up for Modal"** with the subhead **"Get started with
   $30 free monthly compute!"** and offers exactly three buttons:
   **Continue with GitHub**, **Continue with Google**, **Continue with SSO**.
   There is **no email/password field**, so Modal itself sends you no
   verification email.
4. Click **Continue with GitHub** (least friction) and approve the OAuth
   consent screen on github.com. If your GitHub account is new, GitHub — not
   Modal — may ask you to confirm an email address first.
5. You land on **<https://modal.com/apps>**. The page footer reads "By
   proceeding, you agree to our terms of service."
6. On your machine: `python3 -m pip install modal`
7. Run **`modal setup`** — it opens the browser, asks you to authorize this
   machine, and writes the token to `~/.modal.toml`. (Use `modal token new` for
   an *additional* token, or `modal token set --token-id … --token-secret …` if
   you already have one issued from the dashboard.)
8. Confirm with `modal token list`, which should print your token and
   workspace. Tokens also show up in workspace settings on the Modal dashboard.

You now have `$30/month` of free compute on the Starter plan.

---

## Deploy

From the **repository root** (`fashionistas-ai/`), run exactly this one
command:

```bash
modal deploy services/fashn-modal/app.py
```

**Expected output shape — illustrative, never run.** The first deploy builds
the image (apt packages, `pip install` of torch + onnxruntime + fashn-vton,
then the ~2.5 GB weight bake), so expect it to take several minutes. Watch for
the completion line and a URL:

```
Building image fashn-vton …
Created objects.
├── 📡 created deploy of ASGI app
└── https://<workspace>--fashn-vton-api.modal.run

App deployment complete! 🎉
```

The exact glyphs and ordering may differ — the two things that matter are the
line **`App deployment complete`** and the endpoint URL shaped
**`https://<your-workspace>--fashn-vton-api.modal.run`**. Export it for the
next section:

```bash
URL="https://<workspace>--fashn-vton-api.modal.run"
```

If the build fails, the usual suspects are (a) the git requirement line in
`requirements.txt`, (b) the weight bake — read the `download_weights.py` step
in the build log; it prints a size line per file and aborts on a short
download.

---

## Smoke test

### 1. Health

```bash
curl -sS -w '\n%{http_code} %{content_type}\n' "$URL/healthz"
```

Expected:

```
{"ok":true,"model":"fashn-vton-1.5","steps_default":20}
200 application/json
```

### 2. Try-on

Pick **two local test images**: any photo of a person as `person.jpg`, and the
repo's garment shot `sample-jacket.jpg` (repo root, 31,736 bytes).

Build the payload (Python stdlib only, no jq needed):

```bash
python3 - <<'PY'
import base64, json, pathlib

b64 = lambda p: base64.b64encode(pathlib.Path(p).read_bytes()).decode()

payload = {
    "person": b64("person.jpg"),              # any photo of a person
    "garment": b64("sample-jacket.jpg"),      # repo root
    "category": "tops",
    "photo_type": "model",
    "steps": 20,
    "guidance": 1.5,
    "seed": 12345,
    "segmentation_free": True,
}
pathlib.Path("/tmp/tryon.json").write_text(json.dumps(payload))
print("payload:", pathlib.Path("/tmp/tryon.json").stat().st_size, "bytes")
PY
```

Call the endpoint and verify it in one go:

```bash
curl -sS -L --max-time 180 \
  -H 'content-type: application/json' \
  --data @/tmp/tryon.json \
  -o /tmp/tryon.webp -D /tmp/tryon.hdr \
  -w '%{http_code} %{content_type} %{size_download}\n' \
  "$URL/tryon"

file /tmp/tryon.webp
grep -i '^x-fashn' /tmp/tryon.hdr
```

Expected shape:

```
200 image/webp <size in bytes>
/tmp/tryon.webp: RIFF (little-endian) data, Web/P image, VP8, ... 576 x 729
x-fashn-ms: <number>
x-fashn-seed: 12345
x-fashn-category: tops
```

Notes:

* The **first** request pays the cold start (container boot + model load) and
  can take a while; subsequent requests on a warm container are much faster.
* `-L` is there because Modal caps Web Function HTTP requests at **150 s** and
  answers anything longer with a `303` redirect to a result URL rather than a
  body. `--max-time 180` stops a hung call from hanging your terminal.
* If you get `503`, read the `detail` field — that is where a pipeline load
  failure explains itself.
* Output dimensions follow the input; 576×729 is just what the local test
  produced.

---

## Cost and scaling

| Situation | Cost |
| --- | --- |
| Idle (no traffic for `scaledown_window=60`s) | **$0** — `min_containers=0`, so nothing exists to bill. |
| While a container is up | ≈ **$1.08/hour** |
| Starter plan | $0/month base + **$30/month** free compute credits |

The per-hour figure is `gpu="L4"` + `cpu=4` + `memory=12288` MiB at the rates
published on [modal.com/pricing](https://modal.com/pricing) (read 2026-10-05):
L4 $0.000222/s + 4 × $0.0000131/s + 12 GiB × $0.00000222/s ≈ $0.00030104/s ⇒
**$1.08/hr**. A container that serves traffic for 10 minutes costs about
**$0.18**. The GPU is billed for the whole time the container exists — from
boot until ~60 s after the last request — not per inference.

`max_containers=2` caps concurrency (and therefore spend) at two GPUs, which
is plenty for a single-product try-on service. Scale-to-zero means every
request *after* an idle period pays a cold start; if that becomes a problem,
raise `min_containers` to `1` and accept a constant ~$1.08/hr.

---

## How the app calls it (MODAL_URL)

The JavaScript side needs one environment variable: the deployed URL, with no
path suffix.

**Cloudflare Pages → Settings → Environment variables** (or `wrangler secret
put MODAL_URL` for a Worker):

```
MODAL_URL=https://<workspace>--fashn-vton-api.modal.run
```

The URL is the only credential this service has — there is no auth in the
contract — so **treat it like a secret**: never commit it, never print it, and
rotate by redeploying under a different workspace if it leaks.

```js
const MODAL_URL = process.env.MODAL_URL; // no trailing slash

export async function tryOn({ personB64, garmentB64, category, photoType = "model" }) {
  const res = await fetch(`${MODAL_URL}/tryon`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      person: personB64,          // base64 string
      garment: garmentB64,        // base64 string
      category,                   // "tops" | "bottoms" | "one-pieces"
      photo_type: photoType,      // "model" | "flat-lay"
      steps: 20,
      guidance: 1.5,
      seed: 12345,
      segmentation_free: true,
    }),
  });

  if (!res.ok) {
    // Always { ok:false, error, detail } — surface `detail`, it is specific.
    const err = await res.json().catch(() => ({}));
    throw new Error(`try-on ${res.status}: ${err.error ?? "unknown"} — ${err.detail ?? ""}`);
  }

  const bytes = await res.arrayBuffer();          // image/webp bytes
  const ms = res.headers.get("x-fashn-ms");       // server-side elapsed ms
  const seed = res.headers.get("x-fashn-seed");
  const categoryHeader = res.headers.get("x-fashn-category");
  return { bytes, ms, seed, category: categoryHeader };
}
```

Health check for a startup probe or dashboard:

```js
const r = await fetch(`${process.env.MODAL_URL}/healthz`);
const body = await r.json(); // { ok:true, model:"fashn-vton-1.5", steps_default:20 }
```

**CORS caveat — unverified.** Modal documents automatic CORS handling for
`@modal.fastapi_endpoint`, but this app is served with `@modal.asgi_app()`, and
whether Modal injects the same CORS headers for that decorator is **not
confirmed** (adding our own middleware risks duplicate headers). If a direct
browser `fetch` is blocked with a CORS error, the fix needs no change here:
route the call through a Cloudflare Pages Function that forwards
server-to-server — a server-side fetch never sees CORS, and it also lets you
hide `MODAL_URL` from the client.

### The existing caller in this repo is **not** a drop-in

`functions/api/tryon/hd.js` (route `POST /api/tryon/hd`) is the current
try-on backend, and it speaks a **different protocol**:

* It reads `env.FASHN_SPACE_URL`, defaulting to
  `https://fashn-ai-fashn-vton-1-5.hf.space`, plus optional `FASHN_STEPS`,
  `FASHN_TIMEOUT_MS`, `FASHN_GUIDANCE`.
* It drives a **Gradio** app: `POST {space}/gradio_api/upload` →
  `POST {space}/gradio_api/call/try_on` → SSE on `{event_id}` → fetch the
  returned image URL.

This service instead takes **one JSON `POST /tryon`** and returns WebP bytes,
so `hd.js` cannot point at it unchanged — `FASHN_SPACE_URL` will not work as
`MODAL_URL`. Wiring it up means either a new route (e.g.
`functions/api/tryon/modal.js`) containing the `tryOn()` fetch above, or
replacing the Gradio block inside `hd.js`. Two things line up already: the
error envelope `{ ok:false, error, detail }` matches what `hd.js` itself
returns, and because that route already runs server-side in a Worker, doing
the Modal call the same way sidesteps the CORS question entirely.

---

## Configuration knobs (all in `app.py`)

| Symbol | Default | Meaning |
| --- | --- | --- |
| `STEPS_DEFAULT` / `STEPS_MIN` / `STEPS_MAX` | 20 / 10 / 50 | Contract: default 20, anything outside 10–50 is a 400. |
| `GUIDANCE_DEFAULT` | 1.5 | Upstream default. |
| `SEED_DEFAULT` | 42 | Upstream default. |
| `MAX_BODY_BYTES` | 32 MB | JSON payload cap → 413. |
| `MAX_IMAGE_BYTES` | 12 MB | Decoded image cap, each → 413. |
| `MAX_IMAGE_PIXELS` | 40,000,000 | Decompression-bomb guard → 413. |
| `INFER_TIMEOUT_S` | 120 | Soft timeout → our JSON 504. **Must stay below Modal's 150 s HTTP cap.** |
| `WEBP_QUALITY` | 90 | Output quality. |
| `timeout` | 300 | Modal hard per-input kill. |
| `startup_timeout` | 600 | Modal container boot allowance (weights layer pull). |
| `min_containers` / `scaledown_window` | 0 / 60 | Scale-to-zero. |
| `max_containers` | 2 | Concurrency / spend cap. |
| `gpu` | `"L4"` | See below. |

---

## Design notes

**Why the L4.** The checkpoint is ~1.94 GB in bf16 and the pipeline uses
bfloat16 on Ampere or newer; L4 is 24 GB of Ada VRAM, which leaves ample room
for classifier-free-guidance batches at 864×576, and it is the cheapest Modal
GPU with bf16 (A10G has the same 24 GB but costs noticeably more per second;
T4 has no bf16 and would fall back to fp32). `cpu=4` because DWPose and the
human parser run on CPU, `memory=12288` MiB for peak RSS during checkpoint load.

**Why the weights are baked into the image.** `download_weights.py` runs as an
image `run_commands` step, so the four files (~2.5 GB total) are a read-only
layer: no runtime download, no Volume to mount, no first-request penalty
beyond the layer pull. `HF_HOME=/fashn/hf` is set with `.env()` *before* that
step so the human-parser's Hugging Face cache is baked too, and the runtime
reads the same paths.

**Why DWPose is forced to CPU.** Upstream asks onnxruntime for
`CUDAExecutionProvider` whenever the pipeline device is CUDA. Whether that
provider loads depends on onnxruntime + CUDA/cuDNN inside the container, and a
provider that fails aborts session creation — which would fail *every*
request. `CPUExecutionProvider` always exists in the CPU-only `onnxruntime`
wheel, and pose detection is a small slice of total request time, so
`_force_cpu_pose_detection()` subclasses upstream's `DWposeDetector` and pins
`device="cpu"`. The constructor signature is untouched.

**Why one generation at a time.** `_INFLIGHT` is set by the request handler
and cleared only by the worker thread's `finally`. A request that hits the
soft timeout therefore cannot be followed by a second generation stacking on
the same GPU — later requests get a clean `503 model is busy` until the
abandoned run finishes. Model-load failures are *recorded*, not raised, so a
bad boot still serves `/healthz` and answers `/tryon` with the real `detail`.

**Why fastapi is imported late.** `modal deploy` imports `app.py` on the
*deploying* machine, where fastapi may not exist. Top-level imports are stdlib
+ `modal` only; FastAPI, Pillow and the pipeline are imported inside the
container (or inside the ASGI factory). There is deliberately **no**
`from __future__ import annotations`: stringified annotations would make
FastAPI treat `request: Request` as a query parameter.

**No retries, no CORS middleware, no auth.** Modal rejects `retries=` on Web
Functions (`InvalidError: Web Functions do not support retries`), so failures
surface to the caller as JSON instead of being retried server-side. Auth is
absent because the contract fixes the request shape.

---

## License

* **This service's code** ships with the repository (Apache-2.0 terms as
  applied repo-wide; there is no separate LICENSE file in this directory).
* **FASHN VTON v1.5** — model weights *and* runtime: **Apache-2.0**, per
  upstream's `LICENSE`, `pyproject.toml` (`license = {text = "Apache-2.0"}`)
  and installed package metadata (`fashn-vton 1.5.0`, Apache Software License
  classifier).
* **Third-party components** (per upstream's README): DWPose — Apache-2.0;
  YOLOX — Apache-2.0; **fashn-human-parser** — its wrapper carries its own
  license, and its installed `LICENSE` states the underlying model
  (`fashn-ai/fashn-human-parser`, a fine-tuned SegFormer) **inherits the NVIDIA
  Source Code License for SegFormer**. Read that license before shipping
  commercially.
* **Modal, Cloudflare, PyPI/GitHub** are third-party services with their own
  terms.
