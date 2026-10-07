# Agent handoff — fashionistas.ai

## LATEST — 2026-10-07 4:45 PM ET (read this first)

**Production:** Pages deployment `0d44887b-acd7-46e4-ac74-77c7896251d8` = commit `2eb3f16` (phone nav: sticky header + bottom tab bar, "What's next" bar Home-only, compact chat button, blinking fix). **Rollback:** `f408459d-5d27-4523-acbd-0d7711c8f6d3` (`1c174ff`), older `45b2aecb-3cf5-4659-9a88-b3090771bbec`. Verified live on Pixel 7 + Galaxy 360, light/dark, no JS errors.

**Rules (user, non-negotiable):**
- Deploy only from this laptop tree with wrangler (`scripts/deploy-local.sh`). No GitHub pushes.
- ALL UI/mobile changes go to a preview first (`DEPLOY_BRANCH=<name> scripts/deploy-local.sh`), with self-reviewed Android screenshots (top + scrolled, light + dark). Production only after the user says "ship it". Record the current prod deployment ID as rollback before every prod deploy.
- Clear `node_modules/.cache/wrangler` and any stray `CF_ACCOUNT_ID` before deploying (wrong-account pitfall). Revert regenerated chrome-store zips after deploy.
- Zero-install for end users. Try-on is for BUYERS (wearables on their own photo); "See in my space" is for art/furniture/decor.
- Launch target: Wed 2026-10-14 9:45 AM ET.

**User verdict 2026-10-07 4 PM:** mobile UX as a whole is not acceptable. Specifically: the download-zip extension route is "terrible", the listing fields are bad and the form is far too long on a phone.

**In progress (preview branch `listing-wizard`, NOT prod):**
1. Stepped listing wizard, one screen per step with progress bar: 1 Photos (AI identifies + prefills) → 2 What is it (title, department/type chips from `functions/_lib/categories.js`, brand, size, condition, color; extras collapsed) → 3 Price (AI price, comps, take-home per shop) → 4 Where to list (shop toggles, preview, one "List it" button). Drafts autosave.
2. Zero-install posting replacing the zip as the main route: list on fashionistas.ai immediately; direct API post for eBay/Etsy only when keys/OAuth exist; guided "Post to X" (copy fields + Web Share with photos / open the shop's sell page, per-shop done checklist) for Depop, Poshmark, Mercari, Vinted, Grailed. Extension kept only as an optional desktop link in settings. Never show fake "posted" statuses.
3. Whole-app mobile UX pass vs Depop/Vinted/Poshmark/Whatnot: buyer path (Shop, product, Try it on, See in my space, buy) and seller path. Remove instruction walls and jargon (e.g. Home "First sale path" 6-step card with "Load unpacked").
QA shots: box `/workspace/fash-wizard-qa/`.

**Still open:** real test post on each shop to verify category paths; Etsy who-made/when-made defaults wrong for resale; Modal cold-start timeout risk (move to submit-then-poll); pants try-on quality; rotate Cloudflare + Modal keys; 44 old deployments awaiting OK to delete; Browser Cache TTL in dashboard; Stripe later; remove `TRYON_TEST_EMAILS` when done; eBay/Etsy API keys missing.

## TRY-ON / SEE-IN-SPACE — 2026-10-07 ~12:45 PM ET (photoreal live since `791febf`; latest try-on fix live `5b84c2d`)

**Photoreal `/api/tryon/hd` now renders.** Provider order (cheapest first), all in `functions/api/tryon/hd.js` + `functions/api/_tryon/vton-paid.js`:
1. **Modal self-hosted FASHN VTON 1.5** (Apache-2.0) — app `fashn-vton`, URL `https://fashionistas1979--fashn-vton-api.modal.run` (override `FASHN_MODAL_URL`), L4, `min_containers=0`, `scaledown_window=60`. Auth = Modal proxy headers from Pages secrets **`MODAL_PROXY_KEY` / `MODAL_PROXY_SECRET`** (copied from `.env.modal`; rotate both in Modal + `wrangler pages secret put` when the leaked keys are rotated). Cost ≈ $0.000301/s → ~$0.006 warm render (~20 s), ~$0.05 isolated cold (~110 s boot+render + 60 s idle). Covered by Modal Starter $30/mo; `MODAL_MONTHLY_CAP_USD` (default 30, ledger estimate $0.01/render) stops Modal use past that.
2. **HF FASHN Space** (free, anonymous ZeroGPU) — fallback; usually quota-exhausted for server-side calls.
3. **Replicate `prunaai/p-image-try-on` ($0.015/img) / FASHN API (`FASHN_API_KEY`)** — last resort, only if the secret exists. `REPLICATE_API_TOKEN` exists in laptop `.env` but the Replicate account has **no credit (402)**, so it is NOT set in Pages. Async: POST may return 202 `{job}`; client polls `GET /api/tryon/hd?job=`; `tryon_jobs` table prevents double charge.
- **Cold-start risk:** a cold Modal render took 109 s server-side vs Modal's 150 s web limit. If cold starts creep up, raise `min_containers` to 1 at busy hours (~$1.08/h) or move to a spawn+poll Modal function.
- **QA hook:** Pages secret `TRYON_TEST_EMAILS` = `tryon-proof-20261007@fashionistas.ai` (user 83) is entitled without Stripe. Remove it (`wrangler pages secret delete TRYON_TEST_EMAILS`) before/after launch if not wanted.
- **Deploy token cannot touch D1** (code 7403) — grant credits some other way.

**Instant (free) try-on:** shoulder-angle fix (no more upside-down), backdrop cutout, Top/Bottom/Dress/Outerwear picker (overrides auto), "Photo too cropped" warning, bottoms refused on half-body photos (joints must be inside the frame). **In-browser AI background removal** (`see-in-space/cutout.js` → Transformers.js 4.3.1 + `xrds/isnet-general-onnx-int8`, MIT, 44 MB, lazy) when the photo isn't a plain backdrop — used by try-on garments and see-in-space items (~15–20 s first run on CPU). See-in-space: GLB UVs flipped (AR was upside down), plane keeps item aspect, alpha MASK.

Proof set: box `/workspace/tryon-proof/` (`contact.png`, `index.html`, `out/after2_*`).

## CURRENT STATE — 2026-10-07 late night ET (read this first — product source of truth)

**Laptop repo (preferred):** `/home/billionaremaker/fashionistas-ai`  
**GitHub:** [placebetsai/fashionistas-ai](https://github.com/placebetsai/fashionistas-ai)  
**Live tip:** `version.txt` = **`4a0c395`** (`4a0c395256ae46b53e92b0856f2ba8981379fc91`) — must match `https://fashionistas.ai/version.txt`

### Deploy (mandatory — do not get this wrong)

| Wrong | Right |
|---|---|
| GitHub Actions / push to `main` ships the site | **No.** Fashionistas has **no** Actions deploy path for production. |
| Trust `git ls-remote` as "what's live" | Trust **`https://fashionistas.ai/version.txt`** |
| — | **Production =** `bash scripts/deploy-local.sh` → `npx wrangler pages deploy . --project-name=fashionistas-ai --branch=main` |

**A git push does not ship the site. Only wrangler does.**

### Tonight's ships (live SHAs)

| SHA | What | Proof |
|---|---|---|
| `73f81b3` | **Photo→AI identify→listing fill quality** — Pages `/api/ai/analyze` (stronger vision prompt + material/sizeHint rules), shared `libs/identify-fill.js` normalize (Outerwear vs Tops, strip Unknown/not visible, material + price anchors), client prefers same-origin analyze then workers.dev fallback; form fills title/desc/brand/size/category/condition/color/material/price | tests `identify-fill` + `ai/__tests__/vision` |
| prior (`593418e`…) | Chatbot expand / multilist / try-on pipeline | see git log |
| `a5da396` | Seller coach layer (Photo → Sell everywhere checklist / help chips) | `libs/seller-coach.js` + tests |
| `496b09a` | **Free See in my space** — room photo placer (4-corner wall + floor drag/scale/rotate) + optional `<model-viewer>` wall/floor AR from client GLB; CTAs on Shop/Closet detail; `placement_mode` inferred (`clothing`\|`wall`\|`floor`\|`none`); honest Instant/not-photoreal labels | `/see-in-space/` · tests `placement-mode` + `placer-homography` **12/12** · brief `docs/FREE-SEAMLESS-ANYOBJECT.md` |
| `f66079e` | **Multilist one-click polish** — readiness strip (Load unpacked → Verify → Sell everywhere); equal shop treatment (Depop/Poshmark/Mercari/Vinted/Grailed/eBay); honest no-op toasts (never false Posted); Connect + seller-coach Load unpacked hooks | Multilist Connect · `xlOneClickGate` · tests multilist/connect/coach **25/25** · `docs/MULTILIST-ONE-CLICK.md` |

### See in my space — how to demo on phone

1. Open `https://fashionistas.ai/see-in-space/` (or Shop item → **See on my wall** / **See in my room**).
2. Upload room photo → upload listing image → Wall: drag 4 corner handles; Floor: drag + scale/rotate.
3. Optional AR: rebuild plane → use model-viewer AR (Android Scene Viewer / iOS Quick Look when supported). If AR unsupported, photo placer remains — never a dead end.
4. Labels: **Instant preview · free forever** / **Not photoreal**. No Stripe / no paid VTON on this path.

### Seller coach — how to see it

1. Sign in (or **Log in as demo seller**).
2. Lower-left floating **What's next** checklist (Photo → Identify → Fill listing → Multilist → Connect extension → Sell everywhere).
3. Open **Photo** with no listings for the **First sale path** empty-state banner.
4. After AI fill, listing form help chips open the stylist with a suggested question.
5. Progress stored locally as `fash_seller_coach_v1`. Source: `libs/seller-coach.js` → public `/seller-coach.js` (HTTP `/libs/*` is blocked).

**Fill quality (this ship):** after identify, `toListingForm()` fills material + sanitized fields and marks coach `listing`. Sample jacket path sends hint `denim jacket product photo` to Pages analyze only.
6. When **Connect the extension** is next, **Do this →** opens Multilist and the Load unpacked install sheet (`extConnectPrompt`) if the extension is not live.

### Multilist one-click — UX path

1. **Multilist → Connect + post** — readiness strip: (1) Load unpacked Crosslister (2) Verify session per shop (3) Sell everywhere.
2. **Set up extension** → download `/chrome-store/fashionistas-extension-v1.0.1.zip` → `chrome://extensions` → Developer mode → **Load unpacked** → Re-check.
3. Log into Depop / Poshmark / Mercari / Vinted / Grailed / eBay (equal) in the same Chrome → **Verify session**.
4. Pick item → tick shops → **Get ready to post** → **Sell everywhere** queues via extension (no Stripe / no marketplace API keys). Chips: queued → posting → posted (+ View) or failed.
5. Without extension: paste kits + optional eBay/Etsy server API (402/503 when Stripe/secrets empty). **Never** toasts Posted on a no-op.

### Mobile multilist plan (docs only, 2026-10-07)
Native iOS/Android with zero downloads/extensions: see [MOBILE-MULTILIST-PLAN.md](MOBILE-MULTILIST-PLAN.md) (Tier 1 APIs, Tier 2 in-app session, Tier 3 paste kit). Tech: React Native (likely Expo) is the leading possible route, pending research — not final.

### Still blocked

| Blocker | Notes |
|---|---|
| Stripe **test** key | billing / server list path |
| 8 env vars (eBay / Etsy / …) | OAuth + server post |
| Real Chrome marketplace post | never executed (Load unpacked + shop logins) |
| Own marketplace | deferred |
| Photoreal clothing (P1) | metered — not this ship |


### Federation cross-links (secondary)

`nexus-ai-suite` on the same laptop mirrors product nights in federation logs. **This file is the product handoff source of truth.**

> Header lines below claiming older tips / try-on dead backend may be **stale historical copy** —
> ignore them. Use **CURRENT STATE** + live `version.txt` instead.

---

## MISSION — what this app is for (read before touching anything)

**One sentence:** let a single person photograph a garment and sell it in **eleven
marketplaces** without doing eleven jobs.

That is the whole product. Everything else is in service of it.

### The promise the site makes

> **"Photograph Your Closet, Sell It Everywhere."**

| Half | What it does |
|---|---|
| **Listing engine** ← the business | Photo → AI draft (title, identifier, price, **fee take-home**) → **one "Sell everywhere" button** → auto-post to **11 shops** with live per-shop status `queued → posting → posted` / `failed` (retry) / `needs_connection` |
| **Try-on** ← the thing people can *see* | Photo of you + a garment → see it on you → that drives the sale |

**Price: `$14.99/mo`.** That number is claimed site-wide and must stay consistent.

### What this app is NOT — these were removed deliberately

Do not reintroduce any of them. Each was shipped once and explicitly rejected:

| Rejected | Why |
|---|---|
| **"Copy and paste the kit yourself"** / paste-kit framing | Was the old pitch. The About page sold it and was rewritten. It is the *antithesis* of the promise above. |
| **"Free forever" / "$0" / "no subscription"** | Banned copy — was 94 hits on the homepage, now 0. |
| **Bonanza** | Has **zero code anywhere**. Never claim it. |
| **Sticker / overlay "try-on"** (superimpose the garment on the photo) | User: *"this is the most pathetic app in history… it simply superimposed the jeans onto my picture."* Rejected outright. |
| **Developer-speak on consumer pages** | User: *"why the fuck are you telling people what happens when you press try it on."* No implementation copy where a user reads. |
| **Chrome extension as a v1 deliverable, AR** | Out of scope for v1. |

### Definition of "the app works"

Not: *the code runs.* Not: *the tests pass.* Those were both claimed wrongly before
and the user caught it. It means:

1. A person opens `fashionistas.ai/try-on/`
2. Picks a photo and a garment
3. **Gets a real photoreal try-on back in seconds**
4. Presses **Sell everywhere** and it actually posts

Right now step 3 is a dead backend and step 4 has **never once succeeded for any
user.** Everything below the ✅ column is real; everything else is not done.

### Proof standard (user-mandated)

- **No mocks. No fake proofs. No unverified claims.** Every assertion carries
  terminal / curl output.
- **Never say "IT WORKS" when you only proved code ran.** Say explicitly which
  part is *proven* and which is *unproven.* The user rewards that framing and
  punishes the alternative.
- **Three failures on one item → one line in `NEEDS_ISRAEL.txt`, then move on.**
- **Do not ask for budget or new accounts.** Fix it on this box for free, or
  change the product shape.

---

## TRY-ON ENGINE — 2026-10-04 (CURRENT PRIORITY — supersedes every prior try-on note)

### DECISION: Leffa is DEAD. Do not revive it.

Four independent reasons, all measured:

| # | Reason | Proof |
|---|---|---|
| 1 | **Legally unsellable.** Leffa *code* is MIT, but both training datasets are non-commercial — VITON-HD = `CC BY-NC 4.0`, DressCode = YNAP "non-commercial academic research only" | `/tmp/opencode/leffa/{vh_license.txt,dc_lic.txt}` |
| 2 | **Ungodly slow.** 10 steps = **1049.6 s (17.5 min)** → and that output was **visually smeared garbage** | `/tmp/opencode/leffa/svc/bench3.log` |
| 3 | **No fast setting exists.** Linear fit from two measured points: **95.4 s/step + 95.8 s overhead**. Leffa's own default is 50 steps (`inference.py:37`) → **81 min** | 2 steps = 286.6 s, 10 steps = 1049.6 s |
| 4 | **Six models stacked** — UNet + ReferenceUNet + VAE + DensePose + OpenPose + parsing | `leffa/model.py` |

**Lever tests on Leffa — every one measured, none save it:**

| change | measured | verdict |
|---|---|---|
| threads 4 → 8 | 251.0 → 244.9 s/step | 2.4% — useless |
| bf16 autocast | 100.3 vs 58.7 s | **1.7× SLOWER** on this CPU |
| CFG off (`guidance_scale=0`) | 118.1 → 119.6 s/step | no change |
| res 768×1024 → 512×768 | 209 → 118 s/step | ~1.8× — real |
| `power-saver` → `performance` | pinned **1200 MHz** → 2400–4000 MHz | biggest win; the box had been in power-saver the whole time |

The `power-saver` finding matters for **any** future benchmark on this machine: run
`powerprofilesctl set performance` first or your numbers are self-inflicted garbage.

### REPLACEMENT: FASHN VTON v1.5

| | FASHN VTON v1.5 | Leffa |
|---|---|---|
| License | **Apache-2.0, commercial allowed** | MIT code, **non-commercial data** |
| Models | **1** (972M MMDiT, pixel-space) | 6 |
| Masks / DensePose / OpenPose | **none** | all required |
| Output | 576×864 | 768×1024 |
| Weights | **1.94 GB**, public | 8.2 GB |
| Steps | 30 default (20 = fast) | 50 |

Repo cloned to `/tmp/opencode/fashn`, installed editable into `/tmp/opencode/.venv`
(`import fashn_vton` OK). Weights at `/tmp/opencode/fashn/weights/model.safetensors`.

### THREE ROUTES — status

**A. Free HF Space — ✅ WORKS, but quota-limited.**

Endpoint is `fashn-ai/fashn-vton-1-5.hf.space` on **ZeroGPU A10G**. Working client at
`/tmp/opencode/fashn/free_tryon.py`. Protocol is Gradio 6.3.0 and it is *not* obvious:

```
POST /gradio_api/upload          -> ["/tmp/gradio/<hash>/<name>"]
POST /gradio_api/call/try_on     -> {"event_id": ...}
GET  /gradio_api/call/try_on/<id>-> SSE: "event: complete" + "data: [...]"
```

Three gotchas that cost time — do not rediscover them:
1. Images must be full `FileData`: `{"path","url","orig_name","meta":{"_type":"gradio.FileData"}}`.
   A bare `{"path": ...}` is silently rejected.
2. The completion event is **`event: complete`**, *not* `process_completed`, and `data:`
   is a **JSON array**, not an object. Code that does `isinstance(msg, dict)` will
   reject every successful result.
3. `event: error` arrives **immediately, before any GPU work** — that is a quota signal,
   not a payload bug.

### The code that ships, tested for real (2026-10-04)

`functions/api/tryon/hd.js` exports its transport helpers **specifically so the shipped
code can be tested rather than a copy of it.** Test harness:
`/tmp/opencode/fashn/test_shipped_hd.mjs` imports the real file and runs it.

```
inputs: person=180388B garment=289011B
RESULT bytes=30004 type=image/webp ms=25308
PROVEN: shipped runFashn() -> real image over HTTP, free
```

Failure path forced with a bad space URL — this is the behaviour the user demanded
(no silent degradation):

```
code=upload_failed  -> Worker 502   msg=upload HTTP 405
```

### Generation results

| run | result | time |
|---|---|---|
| user photo + sample jacket | **OK** (user: *"its good"*) | 25.9 s |
| **shipped `runFashn()`** | **OK 30,004 B webp** | **25.3 s** |
| one-pieces / model | OK 19,182 B | 10.1–27.2 s |
| tops / model | OK 33,966 B | 10.2–12.7 s |
| tops / flat-lay | OK 44,438 B (1st batch) | 12.0 s |
| **7 of 9** (both runs) | `ERROR` | quota |

**Only 2 of 9 passed on the 2026-10-04 rerun** (A0, A1), then quota died again.
One case failed differently: `A4 URLError: SSL handshake operation timed out` —
a transient network blip, *not* quota. Do not conflate the two when triaging.

Outputs in `/tmp/opencode/fashn/results/`. Test matrix (all 3 categories × both photo
types) in `/tmp/opencode/fashn/testset/index.json`.

> ⚠️ **`/tmp/opencode/fashn/` holds 2.2 GB — code, the 1.94 GB weights and every
> generated image — and it is NOT in git.** systemd purges `/tmp` after 10 days and a
> reinstall wipes it. **Back it up or it disappears.**

**Quota diagnosis — proven, not guessed:** non-GPU endpoints (`load_example`,
`load_example_1`) still return **OK** while `try_on` errors instantly. So the Space is
alive and the payload is valid; only the GPU quota is exhausted (anonymous). It also
*resets* — the same calls that failed at 16:22 succeeded at 18:32 — so treat a failure
as **temporary capacity, never a bug**, and retest before debugging.
An authenticated `HF_TOKEN` would raise it — **but creating/verifying an HF account
needs Israel, and is blocked on him.**

**B. Local CPU — ❌ DEAD, same trap as Leffa.**

```
[load] 5.7s          <- fast, fine
Sampling: 110.0s/it  -> 30 steps ≈ 55 minutes
```
Every Euler step does **2 forwards** (CFG cond + uncond, `forward_for_cfg`), so CPU cost
is doubled before anything else. FASHN is not a "runs on CPU" model despite being far
lighter than Leffa.

**C. Iris Xe iGPU via OpenVINO — 🔶 hardware proven, model export NOT proven.**

This is the only unlimited-free path. Hardware and driver are fully working:

| check | result |
|---|---|
| GPU present | `Intel Iris Xe (TigerLake-LP GT2)` |
| `/dev/dri/renderD128` | `user:billionaremaker:rw-` (ACL, no root needed) |
| kernel driver | `i915` owns `card1` + `renderD128`, device enabled, TGL GuC/HuC/DMC firmware present |
| OpenVINO devices | **`['CPU', 'GPU']`** → `GPU = Intel(R) Iris(R) Xe Graphics (iGPU)` |

**The env recipe — BOTH are required. Missing either gives silent CPU-only with no error:**

```bash
source /tmp/opencode/gpu-env.sh
# LD_LIBRARY_PATH  -> resolves libze_loader / libze_intel_gpu / libigc
# OCL_ICD_VENDORS  -> OpenVINO uses OpenCL for *device discovery*
```

Verified matrix: `LD only → ['CPU']`, `LD + OCL_ICD_VENDORS → ['CPU','GPU']`,
`+ fresh HOME → ['CPU','GPU']` (so it is not a cache effect).

The GPU stack was assembled **without root**: Ubuntu 24.04 debs fetched with a per-user
`apt` lists dir and extracted via `dpkg -x` into `/tmp/opencode/gpu-libs`. Level Zero
additionally needs symlinks in `~/.local/share/uv/python/cpython-3.11.17-*/lib/`
because the loader searches `<python>/bin/../lib` first and that path is user-writable.

**Export status — DO NOT CLAIM THIS WORKS.** First `ov.convert_model` attempt failed:

```
No conversion rule found for operations: aten::chunk, aten::einsum, aten::unbind
Inputs to Einsum operation must have the same type (f32 vs f64)
```

Root cause found in `rope()` (`tryon_mmdit.py:35`): `torch.arange(..., dtype=torch.float64)`
made `omega` float64, which poisons an einsum against float32 positions — and that
aborted OpenVINO's normalize pass, cascading everything else into unconvertible
`PtFrameworkNode`s. Patched to `float32` (the fn already casts to `.float()` at line 40,
so numerics are unchanged).

**The rerun was killed by a server restart and never completed. There is no GPU timing
number.** Next agent: rerun `/tmp/opencode/fashn/gpu_gate.py` with `gpu-env.sh` sourced.

### Files (all `/tmp/opencode/fashn/`)

| file | what |
|---|---|
| `free_tryon.py` | working free-Space client (see protocol above) |
| `batch_test.py` | 9-case matrix runner |
| `gpu_gate.py` | OpenVINO export + CPU-vs-GPU timing gate |
| `run_local.py` | local CPU timing |
| `testset/` | 6 person/garment pairs with category + photo_type |
| `results/`, `free_out.png` | generated images |
| `local.log`, `dl.log`, `batch` logs | raw timings |

### BLOCKED ON ISRAEL — try-on

Everything below is **his**, and nothing else is waiting on him:

1. **Review the generated images.** 5 exist, **1 approved** (*"its good"*).
   Unreviewed: `/tmp/opencode/fashn/results/{A0_onepieces_model,A1_tops_model,
   A2_tops_flatlay}.png` and `shipped_hd_test.webp`.
   **This is the gate** — if the output is bad, the whole FASHN path dies and the
   next agent must be told so, not quietly proceed.
2. **An HF account/token** would lift the Space quota. Needs his email verification.
3. **`TEST.md` §1–6** (~10 min, no keys needed) → first *real* marketplace post.
   There has never been one.
4. **8 env vars** — `EBAY_SANDBOX_*`, `EBAY_*_POLICY`, `ETSY_*`, `GOOGLE_*`, `STRIPE_*`.
   Checked in 5 places, all missing.

### SHIP STATUS — `main` = `5ffba1e`, pushed and verified

```
git ls-remote origin main  ->  5ffba1ebe1c2c8dbc289e8adffafa6736bf52e6c
git rev-parse HEAD         ->  5ffba1ebe1c2c8dbc289e8adffafa6736bf52e6c   (identical)
git status --porcelain     ->  0 remaining                                 (tree clean)
```

Commit `5ffba1e` = 33 files, 717 KB: the FASHN `hd.js` rewrite, the fees/guide work
(`/fees/` removed, 5 new guide pages), `services/leffa/` kept as history under
`RETIRED.md`, and this file. Secret-scanned before push (`.env`, `node_modules/`,
`__pycache__/` all excluded — `__pycache__`/`*.pyc` added to `.gitignore`).

**Pushed ≠ deployed.** The commit is on GitHub; **Cloudflare Pages has not been
re-deployed**, so `fashionistas.ai` still serves the pre-`5ffba1e` output.

### NOT DONE — do not mark any of this complete

- **No GPU speed number.** The export is still running/converting. `rope()` float32
  patch is in; there is **no Iris Xe timing** yet. Do not invent one.
- **Not deployed.** `5ffba1e` is on GitHub, not on Pages.
- **Try-on is not reachable by a user.** `hd.js` exists and its transport is proven,
  but nothing on `/try-on/` calls it. The page still runs the rejected overlay.
- **Free tier still has no replacement.** The on-device warp+composite is the
  rejected "sticker overlay". Nothing else has shipped.
- **7 of 9 item/category tests still unproven** — blocked on quota.
- **Zero marketplace posts, ever.** Blocked on Israel running `TEST.md` §1–6.
- **8 env vars missing** (eBay / Etsy / Google / Stripe).
- **placebets Phase 2 sidecar failed** (rate-limited); its output was never verified.

---

## 0. CURRENT STATE — 2026-10-03 (read this first)

> ## ⚠️ READ THIS BEFORE YOU WRITE ANYTHING INTO THIS FILE
>
> **This document is served publicly at `https://fashionistas.ai/docs/AGENT_HANDOFF.md` → HTTP 200.**
> `_redirects` does **not** block files that exist as deployed static assets — see
> "SECURITY FINDING" below. **Never put a secret in `docs/`.** Secrets go in `.env`
> (gitignored, untracked, returns 404 live, zero traces in git history).

### SECURITY FINDING — `_redirects` blocking NEVER WORKED (2026-10-03)

The file `_redirects` contains rules claiming to 404 internal files. **They are inert
for anything that ships as a static asset.** Proven live:

| Path | `_redirects` rule | Actual live response |
|---|---|---|
| `/docs/AGENT_HANDOFF.md` | line 14 → 404 | **200** (26,885 bytes served) |
| `/wrangler.toml` | line 4 → 404 | **200** |
| `/NEEDS_ISRAEL.txt` | line 6 → 404 | **200** |
| `/package.json` | line 7 → 404 | **200** |
| `/.env` | line 9 → 404 | 404 ✅ |
| `/functions/api/_lib/auth.js` | line 22 → 404 | 404 ✅ |

**Why the two "working" ones pass:** they are *not deployed as assets* — `.env` is
gitignored, and Cloudflare Pages excludes `functions/` from static output. So the
redirect is never reached. **Every real file is served first; the redirect never runs.**

**Consequence:** any file committed to the repo root or a subdirectory is public.
`git grep` found no secrets in committed files as of `d0592fc`, but this must be
re-checked whenever a file is added.

**Fix not yet implemented.** Viable options: (a) `_routes.json` with an `include`
list forcing those paths into the Functions runtime (then return 404), or (b) move
internal files out of the deploy root. (b) is simpler but breaks in-repo history
for other agents. **Do not assume the leak is fixed until a live curl proves 404.**

### Shipped 2026-10-03 (commits `afe61d0`, `d0592fc`)

| Item | Proof |
|---|---|
| `apps/extension/adapters/engine.js` (22,277 B) | 26 jsdom tests, all pass |
| `core/ai_inference.js`, `core/tryon_pipeline.js` | parse clean, honest failure paths |
| `TEST.md` manual script | claims `# tests 57` → reality `57 / pass 57 / fail 0` |
| **`/pricing/`** (was 404 — a v1 spec item) | live **HTTP 200**, renders `$14.99` |
| `sitemap.xml` repaired | 6 → **12** URLs, dead `/app/` removed, **0 dead entries** |

**Full suite: `# tests 57  # pass 57  # fail 0`.** Head at time of writing: `d0592fc`, CI `success`.

**`engine.js` is deliberately `chrome.*`-free** (only hit is its own header comment) —
so the same module serves the extension *and* a mobile WebView. Its dry-run lock:
`submit()` under `dryRun` throws `DRY_RUN_BLOCKED` **without even querying
the publish selector**. Verified by sabotaging the guard → 2 tests go red → restore →
26 pass. That is what proves the tests are not rubber stamps.

### `/pricing/` Subscribe button — exact server contract

Do not guess these; they were read out of `functions/api/billing/checkout.js`:

| HTTP | Body | Meaning |
|---|---|---|
| `401` | `{error:"Not signed in."}` | not authenticated |
| `503` | `{error:"STRIPE_SECRET_KEY not configured", detail:"Set the ... Pages environment variable…"}` | key missing — page **names it verbatim** |
| `502` | `{error:"stripe_unreachable"\|"stripe_error"\|"stripe_no_checkout_url"}` | Stripe call failed |
| `200` | `{url, id, uid}` | redirect to hosted checkout |

**`checkout` never returns 402.** It has no subscription check. The page keeps a 402
branch as defensive future-proofing and says so in a comment.
**`/api/auth/me` returns `{id, email, authenticated}` only — no subscription field.**
An earlier version of the page read `d.subscribed` and would have claimed "Pro is
active" with no way to know. Removed; the page now shows only the sign-in address.

### ENV VAR NAME CORRECTIONS (my earlier list was wrong)

Re-verified by grepping `env.X` across `functions/`:

| I said | Reality |
|---|---|
| `STRIPE_PRICE_ID` | **never read** — checkout builds the price inline via `price_data`. Do not chase it. |
| `ETSY_SHARED_SECRET` | real name **`ETSY_API_SECRET`** |
| `GOOGLE_OAUTH_CLIENT_ID/_SECRET` | real names **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** |

**What the code actually reads** (bindings excluded): `EBAY_CLIENT_ID`,
`EBAY_CLIENT_SECRET`, `EBAY_ENV`, `EBAY_REDIRECT_URI`, `EBAY_RU_NAME`,
`EBAY_SANDBOX_CLIENT_ID`, `EBAY_SANDBOX_CLIENT_SECRET`, `EBAY_SANDBOX_REDIRECT_URI`,
`EBAY_FULFILLMENT_POLICY`, `EBAY_PAYMENT_POLICY`, `EBAY_RETURN_POLICY`,
`ETSY_API_KEY`, `ETSY_API_SECRET`, `ETSY_REDIRECT_URI`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `REPLICATE_API_TOKEN`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

**Two distinct eBay key sets are needed:** `EBAY_SANDBOX_*` is read only by
`/api/list/*` (v1 path); `EBAY_CLIENT_ID` + `EBAY_REDIRECT_URI` + `EBAY_RU_NAME` +
`EBAY_ENV` are read by the OAuth flow (`/api/ebay/oauth/*`). Filling both with the
same sandbox values is the starting point.

A template with links lives at **`.env`** in the repo root (gitignored, safe).

### AI: use the free model for text — image still costs (2026-10-03)

Decision (supersedes any suggestion to bill for an LLM):

- `opencode/mimo-v2.6-flash-free` → **input $0.00 / output $0.00**. Use it for
  titles, descriptions, category and price copy.
- The model catalog returns **0 image-generation models** — mimo is text-only.
  **Virtual try-on still needs a diffusion model**, i.e. Replicate (token now stored
  in `.env`) or an equivalent. `core/tryon_pipeline.js` refuses honestly with
  `generative_endpoint_unconfigured` rather than returning a fake try-on.
- **No callable free-AI HTTP endpoint exists in this environment** — only OpenCode
  session vars, no API key. So server-side mimo cannot be wired from a Worker
  without an endpoint being provided first. Do not claim otherwise.

`core/ai_inference.js` returns `engine_unavailable` (not invented text) because
`@huggingface/transformers` is not bundled. Its `source` field is `"vlm"` only when
a model genuinely ran, otherwise `"pixel_heuristics"`.

### STILL TRUE / STILL OPEN (do not mark these done)

- **Zero marketplace posts have ever occurred.** The extension has never been loaded
  into a real Chrome profile. `TEST.md` §1–6 requires a human in Chrome.
- Adapter list (9): poshmark, mercari, depop, grailed, vinted, facebook, kidizen,
  vestiaire, whatnot. **`craigslist.js` does not exist** — zero code, do not claim it.
- `/api/marketplaces` → 404 (L07). Other audit gaps remain: OG cards on `/ar-tryon/`,
  twitter:card on `/about/`+`/privacy/`, 262-byte `icon.svg`, 3 `<h1>`, contrast
  3.07:1 on `--accent`.
- Replicate token is stored but **never used** — try-on still unrun.
- **The `docs/` leak above is unfixed.**

### Product truth (supersedes §1)

| Item | Truth |
|------|--------|
| **Shops** | **11** — Poshmark, Mercari, Depop, Vinted, Grailed, eBay, Etsy, Facebook, Kidizen, Vestiaire, Whatnot |
| **Auto-post** | **Yes.** One **Sell everywhere** button; live per-shop status `queued → posting → posted` / `failed` (retry) / `needs_connection` |
| **Pricing** | **$14.99/mo** — every claim site-wide. "Free forever" / "$0" / "no subscription" copy is **banned** (was 94 hits on the homepage, now 0) |
| **Rejected UX** | **Paste-kit / "copy and post yourself" framing is REMOVED.** Do not reintroduce it — the About page previously sold it and was rewritten |
| **Bonanza** | Has **zero code anywhere** — never claim it (9 adapters + eBay/Etsy server-side) |

### Security: auth gate (shipped 2026-10-03)

Shared guard: `functions/api/_lib/auth.js` (`_`-prefixed dirs are not routes).

- `requireAuth(request, env)` → **401** unless a valid session token resolves in D1
- `requireActiveSubscriber(...)` → **402** when the user has no active `$14.99/mo` plan
- Credential order: **`Authorization: Bearer <token>`** first, then the `fash_session` cookie (the web app). Both hit the same `sessions` row — a browser session and a Bearer token are one credential carried two ways. **Nothing anonymous gets through.**
- `missingEnv(env, names)` → names the exact absent var; never stubs around it

Applied to **all 8** mutating paths: `/api/list/ebay`, `/api/list/etsy`, `/api/list/all`, `/api/closet/clear`, `/api/delist`, `/api/wear`, `/api/tryon`, `/api/color`.
CORS `OPTIONS` is the only method allowed without a credential (preflight carries none and returns no data).

Also fixed: `resolveIdentity()` in `closet/clear.js` and `GET /api/auth/me` were **cookie-only**, so a Bearer caller authenticated at the gate and then 401'd downstream. Both now read the `Authorization` header.

**Proof (raw, live):**

```
$ curl -s -o /dev/null -w "%{http_code}\n" -X POST https://fashionistas.ai/api/list/ebay
401

# no credentials, all 8
  POST /api/list/ebay       -> 401      POST /api/closet/clear    -> 401
  POST /api/list/etsy       -> 401      POST /api/delist          -> 401
  POST /api/list/all        -> 401      POST /api/wear            -> 401
  POST /api/tryon           -> 401      POST /api/color           -> 401

# authed, not subscribed
$ curl ... -X POST .../api/list/ebay -H "Authorization: Bearer $TOKEN"
402 {"ok":false,"error":"subscription_required","status":"inactive",
     "detail":"An active $14.99/mo subscription is required to list. POST /api/billing/checkout to subscribe."}

# Bearer identity resolves
{"id":76,"email":"gateproof…@fashionistas.ai","authenticated":true}  -> 200

# checkout does NOT fake a URL without Stripe keys
503 {"error":"STRIPE_SECRET_KEY not configured","detail":"Set the STRIPE_SECRET_KEY Pages environment variable …"}
```

### v1 BLOCKED — 8 env vars missing (checked in 5 places)

Verified **unset** in: process env, repo `.env*`, GitHub secrets, **Cloudflare Pages secrets (project has zero)**, shell profiles.

```
EBAY_SANDBOX_CLIENT_ID     EBAY_SANDBOX_CLIENT_SECRET   EBAY_SANDBOX_REDIRECT_URI
ETSY_API_KEY               ETSY_SHARED_SECRET
STRIPE_SECRET_KEY          STRIPE_WEBHOOK_SECRET        STRIPE_PRICE_ID
```

> **Naming:** `.env.example` uses `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET`. The v1 task specifies **`EBAY_SANDBOX_*`**. The code reads the **`EBAY_SANDBOX_*`** names. Reconcile before setting secrets.

Set with:
```bash
npx wrangler pages secret put EBAY_SANDBOX_CLIENT_ID --project-name=fashionistas-ai   # …and the rest
```

**Pending, cannot be faked past:** sandbox eBay developer app + sandbox seller account; Etsy Open API app review; Stripe **test-mode** key + `$14.99` Price + webhook endpoint. Until they exist there are **no `viewUrl`s to report** — `POST /api/list/*` returns `503 env_missing` naming the var.

### Scaling without API keys — the extension is the answer (2026-10-03)

**The per-shop-API model does not scale** and should not be presented as if it does:
11 shops × developer app × review × OAuth × rate limit = 2 of 11 actually achievable.

The repo already contains the scalable mechanism at `apps/extension/` — **~1,700 lines,
9 adapters, a real job queue** — and it needs **zero keys**:

| | Server API (eBay/Etsy) | Extension (9 others) |
|---|---|---|
| Keys per shop | 3–4 secrets + app review | **none** |
| Rate limit | negotiable, per shop | **none** — `waitForGap()` paces like a person |
| Requires shop agreement | yes | no — runs in the **user's own session** |
| Scales to a new shop | weeks | one adapter file + selectors |

Adapters keep **zero selectors** (`config/selectors.js`), so a shop layout change is a
one-file fix. `runPublish()` does a **full submit** (no draft), then polls for the real
`/listing/` URL. Hard rules already encoded: never solve/bypass a CAPTCHA, never upload a
password or shop cookie (heartbeat sends booleans only).

**Gap found and closed today:** the site→extension half worked
(`onMessageExternal` accepts `publish|delist|signup|status` from fashionistas.ai), but
results were only POSTed to the `fashionistas-api` worker — so a locally queued job showed
`queued` forever on our side.

- `queue.js` now persists every outcome as `result:{job_id}` and exports `getResults()`
- `background.js` exposes `{type:"results"}` on `onMessageExternal`
- `index.html` bridge: `extAvailable / extPublish / extResults / extPollStart`
  → status `queued` → **`posted` + real listing URL** (or `failed` + reason), polled every 3s

`Sell everywhere` is now **extension-first**: every shop queues through it when present
(no keys, no manual taps); otherwise eBay/Etsy post server-side and the rest fall back to
the one-tap clipboard handoff. Extension ID is set once via the sheet's
**Connect extension** button (`extSetId`, stored in `fash_ext_id`) — Chrome shows the ID at
`chrome://extensions` → Details.

**Removed:** `https://*/*` from `host_permissions` (audit BLOCKER). 25 explicit hosts remain.

> **Still unverified end-to-end:** a real auto-post needs the extension loaded in a real
> Chrome profile with a logged-in shop account. This environment cannot install one, so
> no "posted" claim has been made from the extension. Verified here: the site renders,
> all 8 bridge functions exist, extension files parse as ESM, manifest is valid JSON.

### One-tap handoff for the shops with no API (built 2026-10-03)

The nine non-API shops **cannot** be auto-posted from a web page — verified, not assumed:

| Host probed from `Origin: https://fashionistas.ai` | HTTP | `Access-Control-Allow-Origin` |
|---|---|---|
| poshmark.com · www.mercari.com · depop.com · www.vinted.com · www.grailed.com · www.facebook.com · web.whatnot.com · us.vestiairecollective.com · kidizen.com | 200/403/301/400/000 | **none on any of them** |

Two independent walls: no CORS headers (browser refuses the request) and their session cookies are `SameSite`/domain-scoped (we cannot attach them). A Chrome extension works precisely because it runs inside the user's own session — that is the only mechanism that clears both.

**What ships instead** (`handoffOpen` / `handoffConfirm` / `handoffSellAll` in `index.html`):
- **one tap** = copy that shop's formatted payload **and** open their create-listing form (no separate Copy step — the old `xlSheet` had `Copy X` + `Open X`, which was the rejected paste-kit shape)
- status per shop per listing in `localStorage` `fash_handoff_v1`: `awaiting_publish` → `posted`
- **`posted` is only ever set by `handoffConfirm()`** (you tapped Published) **or** by a real API id from `/api/list/*`. Opening a page never marks it posted.
- `Sell everywhere` = real API post for eBay/Etsy, mark the rest `awaiting_publish`, open the first one; the rest open one tap at a time (stacked popups get blocked)
- `/api/list/*` statuses mapped to plain words: **401** sign in · **402** subscribe · **503 env_missing** names the key

> **Copy constraint:** do not describe this as "the form opens already filled" — cross-origin makes that impossible. It opens with the payload on your clipboard, and you press Publish.

**Deploy gotcha fixed here:** `String.rfind("</style>")` put the new chip CSS inside a `<noscript><style>` block, which browsers **ignore when JS is enabled**. Symptom was `borderRadius: 0px` despite the rule being in `innerHTML`. Always confirm styling with `getComputedStyle`, not a string search.

### Listing endpoints (built, gated, credential-blocked)

`functions/api/list/{ebay,etsy,all}.js`

Layer order: **401 auth → 402 subscription → 503 `env_missing` (names vars) → real sandbox call.**
`/api/list/all` returns **per-marketplace** results so one failure never hides the other:
`{ ok, ebay:{…}, etsy:{…} }` — `ok` is true only when both publish.

eBay path: `PUT inventory_item/{sku}` (idempotent by SKU) → `POST offer` → `publish_offer`; returns `listingId` + sandbox `viewUrl`, or **eBay's own error text**.
Etsy path: `POST application/listings` (draft) → image upload; handles **429 rate limits** (surfaces `retry-after`) and missing-attribute errors verbatim.

> **Still TODO before these can succeed:** business-policy IDs (`EBAY_FULFILLMENT_POLICY` / `EBAY_PAYMENT_POLICY` / `EBAY_RETURN_POLICY`) are read but unset; the sandbox token + publish path has **never run against a real sandbox account**.

### Deploy

**GitHub push DOES auto-deploy** (workflow `deploy`, CI `CLOUDFLARE_API_TOKEN` — broader than the local token). This contradicts §7; §7's "Git Provider: No" is **stale**. Verify with `gh run list -R placebetsai/fashionistas-ai --workflow=deploy`.

SSH push only (HTTPS token lacks `workflow` scope):
```bash
GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes" \
  git push ssh://git@github.com/placebetsai/fashionistas-ai.git main
```

### Gotchas learned the hard way

1. **`node --check file.js` is a NO-OP for ESM** — returns `exit 0` on broken files. Use:
   `node --input-type=module --check < file.js`
2. A raw-string regex replacement (`re.subn(r'…', r'…\"…')`) writes a **literal backslash-quote** → unterminates a JS string → **entire page renders blank**. Always verify a rendered page in a real browser (`document.documentElement.scrollHeight`), not just `curl`.
3. Security: Pages serves the repo root, so checked-in files are public URLs. `_redirects` + `404.html` block `/functions/*`, `/docs/*`, `/wrangler.toml`, `/NEEDS_ISRAEL.txt`, `/.env*`.

---

## 1. Product (what it is)

| Item | Truth |
|------|--------|
| **Product** | Multilist **AI listing drafts** — photo → ID / price / fee take-home → **paste-ready per-shop kits** |
| **Shops (6)** | Depop, eBay, Poshmark, Mercari, Vinted, Grailed |
| **Auto-post** | **Mostly no.** Paste kits for **all six**. **eBay only:** optional API create when OAuth Connected + sell scopes + business policies |
| **API host** | `https://fashionistas-api.fashionistas1979.workers.dev` (health ≈ `{"ok":true,"version":"3.1.0"}`) |
| **Pages project** | `fashionistas-ai` |
| **Domain** | `https://fashionistas.ai` |
| **Deploy** | **`npx wrangler pages deploy . --project-name=fashionistas-ai` only** — **not** GitHub Actions. Cloudflare Pages **Git Provider: No**. Push to `main` ≠ deploy. |

```bash
# From repo root (static site + functions/)
npx wrangler pages deploy . --project-name=fashionistas-ai
npx wrangler pages deployment list --project-name=fashionistas-ai
```

Package script: `"deploy": "npx wrangler pages deploy . --project-name=fashionistas-ai"`.

---

## 2. UX Research P0 + PASS; app audit Mixed

### Marketing / trust / AdSense plumbing — **PASS 29/29**

**Audit (box):** `/workspace/tnr/audits/FASHIONISTAS-UX-AUDIT-2026-09-26.md`  
**Re-verify:** ~19:31 ET 2026-09-26 — **PASS 29/29** against main `a3c6832` / Pages `fashionistas-ai`

| P0 | Live result | PR |
|----|-------------|-----|
| **Contact** | Static `/contact/` — FormSubmit → `fashionistas1979@gmail.com`, honeypot `_honey`, unique title (not SPA) | #1 |
| **About / Privacy** | Static `/about/`, `/privacy/` + footer links | #1 |
| **ads.txt** | Plain-text **comment-only** placeholder — **no invented** AdSense pub-id; `_headers` forces text/plain | #1 |
| **Fees calculator** | Shipped in #1 as an indexable static fee page (`fees/index.html`); **deliberately removed later** — take-home now comes from `POST /api/fees/estimate` and `POST /api/fees/compare` inside the app, and no standalone fee page is served | #1 |
| **Sitemap** | In: `/`, `/contact/`, `/about/`, `/privacy/`, `/app/`. Out: thin `/blog`, `/ar-tryon`, and the removed fee page | #1 |

**Follow (not fail):** FormSubmit activation on first real submit; real AdSense `google.com, pub-…` lines **only after** a real pub-id exists. **Do not** invent a pub-id or ship `adsbygoogle` without it.

### App product UX audit — **Mixed** (then many P0s fixed night-of)

**Audit (box):** `/workspace/tnr/audits/FASHIONISTAS-APP-UX-AUDIT-2026-09-26.md`  
**Verdict at audit time:** **Mixed** — fee take-home + paste-honest multilist strong; honesty/manifest/Shop junk/generic kits/sample JPG/Multilist-not-a-tab weak.

| App-audit P0 | Status after night ET ship |
|--------------|----------------------------|
| Honesty drift (“Publish everywhere”) | **Fixed** PR #5 — paste / 6 shops / you post yourself |
| Manifest “24 marketplaces” / “AI sells” | **Fixed** PR #5 |
| Shop QA junk / platform bloat | **Client filter** PR #5 — **API-side Shop cleanup still TODO** |
| Generic `xlKit` | **Fixed** PR #6 — `xlKit(l, shopId)` / `XL_KIT_RULES` per shop |
| `sample-jacket.jpg` → SPA HTML | **Fixed** PR #5 — real image asset |
| Multilist not in tabbar | **Fixed** PR #5 — Multilist primary; Map under More |
| Deep routes `/guide/` `/pricing/` `/marketplaces/` | **Still SPA shell** (no pathname router) |
| Demo credentials in client JS | **Still present** (abuse risk) |
| Equal Multilist UX (not eBay-centric) | **User demand night ET — in flight** (see §6) |

---

## 3. Contact / ads.txt / about / privacy

All live on fashionistas.ai (wrangler → `fashionistas-ai`):

| URL | Notes |
|-----|--------|
| https://fashionistas.ai/contact/ | FormSubmit → `fashionistas1979@gmail.com` |
| https://fashionistas.ai/ads.txt | Comment-only; no pub-id |
| https://fashionistas.ai/about/ | Honest product (not auto-poster) |
| https://fashionistas.ai/privacy/ | Privacy |

> **Removed on purpose:** the 6-shop take-home calculator page that used to sit in the `fees/` directory no longer exists. Fee take-home is now `POST /api/fees/estimate` and `POST /api/fees/compare`, computed from the same catalogue `GET /api/marketplaces` serves.

---

## 4. Connect all 6 shops; eBay BYO + OAuth + token + listing API; guide-only others

| Shop | Mode | Status |
|------|------|--------|
| **Depop** | Guide + paste kit | Needs account / Ready to guide / Connected (local) |
| **eBay** | **BYO Client ID/Secret + OAuth + token exchange + optional listing API** | Full path shipped |
| **Poshmark** | Guide + paste kit | Guide-only (no public seller OAuth in app) |
| **Mercari** | Guide + paste kit | Guide-only |
| **Vinted** | Guide + paste kit | Guide-only |
| **Grailed** | Guide + paste kit | Guide-only |

### eBay path (honest)

1. Paste **your** Client ID + Secret (BYO) → `localStorage` `fash_ebay_keys_v1` (base64 stub — not strong encryption), **or** CF Pages secrets  
2. **Connect OAuth** → `GET|POST /api/ebay/oauth/start` → eBay authorize  
3. Callback → **real token exchange** when keys present → HttpOnly `ebay_oauth_tok` (+ Connected in `fash_connect_v1`)  
4. Multilist → **Create on eBay** → `POST /api/ebay/listing` → Sell Inventory `createOrReplaceInventoryItem` → business policies → `createOffer` → optional `publishOffer`  
5. Scopes: `sell.inventory` + `sell.account` (+ readonly). Earlier connects **must re-consent**.  
6. Refresh: cookie Max-Age ~90d best-effort; optional Pages KV if `EBAY_TOKENS` / `FASHIONISTAS_KV` / `TOKENS` bound. **Durable store on fashionistas-api KV/D1 still needed.**

**Redirect / RuName:** `https://fashionistas.ai/api/ebay/oauth/callback`

### Routes

| Route | File |
|-------|------|
| `GET\|POST /api/ebay/oauth/start` | `functions/api/ebay/oauth/start.js` |
| `GET /api/ebay/oauth/callback` | `functions/api/ebay/oauth/callback.js` |
| `POST /api/ebay/listing` | `functions/api/ebay/listing.js` |
| `GET /api/ebay/status` | `functions/api/ebay/status.js` |

Docs: [`EBAY_OAUTH.md`](./EBAY_OAUTH.md) · [`MULTILIST_CONNECT.md`](./MULTILIST_CONNECT.md)

**Never:** fake auto-signup, password collection, invented shop API keys, invented AdSense pub-id.

---

## 5. PR timeline (night ET)

| PR | Title | State | Merge / tip | What |
|----|-------|-------|-------------|------|
| [#1](https://github.com/placebetsai/fashionistas-ai/pull/1) | UX P0 contact/ads/fees | **MERGED** | `a3c6832` ← `89d1bd7` | Static trust + SEO pages |
| [#2](https://github.com/placebetsai/fashionistas-ai/pull/2) | Multilist Connect UI + eBay OAuth stubs | **MERGED** | `9ff0a63` ← `c8f84da` | Connect card; Pages Function stubs |
| [#3](https://github.com/placebetsai/fashionistas-ai/pull/3) | eBay guidance + BYO OAuth keys | **MERGED** | `01a11be` ← `9db613d` | Guidance panel; BYO; start accepts body/headers |
| [#4](https://github.com/placebetsai/fashionistas-ai/pull/4) | Connect guidance all six shops | **MERGED** | `ddbec4a` ← `a79d7f0` | Depop/Poshmark/Mercari/Vinted/Grailed panels |
| [#5](https://github.com/placebetsai/fashionistas-ai/pull/5) | P0 honesty / Shop filter / Multilist nav / fees / eBay token | **MERGED** | `0c4dd7b` ← `d783384` | Trust prime-time |
| [#6](https://github.com/placebetsai/fashionistas-ai/pull/6) | eBay listing create + per-shop Multilist kits | **MERGED** | `54a6d28` ← `37bb5b3` | Inventory/Offer API + `xlKit` per shop |
| [#7](https://github.com/placebetsai/fashionistas-ai/pull/7) | Multilist eBay UX walkthrough | **OPEN** (clean) | tip `1eb12ea` / feat `125816d` | Connect stepper, Create CTA, first-run Snap→kit→Create — **eBay-centric polish** |

GitHub `main` after this handoff refresh is the commit that updated this file (see raw URL / SHA returned to parent).

---

## 6. User demand: equal UX all marketplaces (not eBay-centric) — STATUS

**Demand (2026-09-26 night ET):** Multilist / Connect / kit CTAs must feel **equal across all six shops**. eBay API create is an **optional extra**, not the product spine. Paste kits + guide-open are first-class for Depop, Poshmark, Mercari, Vinted, Grailed **and** eBay.

| Artifact | Status |
|----------|--------|
| **PR #7** `feat/ebay-multilist-ux-walkthrough` | **OPEN, not merged** — eBay walkthrough (stepper, Create on eBay CTA, first-path card). Tip `1eb12ea`. |
| **Live CF Production** | **Already deployed** PR #7 code: deployment `075ef679-…`, Source **`125816d`**, preview https://075ef679.fashionistas-ai.pages.dev — **ahead of GitHub `main`** |
| **Branch `feat/multilist-all-shops-first-class`** | **Local only** (not on `origin`). Tip currently same as PR #7 tip. |
| **Equal-UX WIP** | **In flight, uncommitted** — agent stash `equal-ux WIP index.html` de-centers eBay (neutral Create chrome, “paste kit · optional API”, coach copy aligned to all shops). **No remote branch / no PR yet.** |
| **Merged equal-UX PR** | **None** |

**Agent action:** Prefer finishing equal Multilist UX (neutral first-path, per-shop kit CTAs Copy/Open for all six, eBay Create secondary) → PR → merge → wrangler deploy. Do **not** deepen eBay-only coach copy without matching non-eBay paths. If merging #7 first, immediately follow with equal-UX so live doesn’t stay eBay-centric.

---

## 7. Deploy truth + laptop CF SHAs vs git (critical)

### Model

- **Source of truth for live HTML:** Cloudflare Pages **deployment list**, not GitHub alone.  
- Pages **Git Provider: No** — `git push` does **not** auto-deploy.  
- Prefer merge + explicit `wrangler pages deploy` of a **known Git SHA**.  
- Laptop (and agents) sometimes deploy Sources **missing from GitHub**.

### Latest CF Production (night ET, wrangler list)

| Deployment | Source | In GitHub? | Notes |
|------------|--------|------------|--------|
| **`075ef679-…`** (latest) | `125816d` | Yes on **feat branch** (PR #7); **not on `main`** | eBay Multilist UX walkthrough **live** |
| `5c4311cb-…` | `36f2979` | Yes (`main` lineage) | Handoff stamp deploy |
| `421a5d5a-…` | `d2d606d` | Yes | Prior handoff stamp |
| `3d00b6ca-…` | `54a6d28` | Yes | PR #6 merge |
| `16dc126f-…` | `0c4dd7b` | Yes | PR #5 merge |
| `e70a332e-…` | `ddbec4a` | Yes | PR #4 merge |
| `6e701489-…` | **`60f5501`** | **MISSING** | Laptop-only historical |
| older | **`0584633`**, `0b186a6`, `f2c02fa`, … | **MISSING** | Laptop-only historical |

```bash
npx wrangler pages deployment list --project-name=fashionistas-ai
git cat-file -t <source_sha>   # fatal = not in this clone / laptop-only
```

**Warning:** Live site can be **newer than `main`** (as with `125816d` / PR #7). Before redeploying from `main`, compare live Source SHA. Do not clobber unknown laptop-only builds blindly.

---

## 8. What works / what doesn’t

| Capability | Status |
|------------|--------|
| Paste multilist drafts (6 shops) | **YES** — **per-shop kits** |
| Fee estimate / compare (`POST /api/fees/estimate`, `POST /api/fees/compare`) | **YES** — the old standalone fee page was removed on purpose |
| Photo → AI analyze → listing form | **YES** (API live) |
| Contact / about / privacy / ads.txt placeholder | **YES** |
| Honesty copy + Multilist tab + sample jacket | **YES** (PR #5) |
| Shop client hide QA/no-photo | **YES** (client); API feed still dirty |
| Auto-post Depop / Poshmark / Mercari / Vinted / Grailed | **NO** (guide + paste only) |
| eBay OAuth authorize + token exchange | **YES** (BYO or CF env keys) |
| eBay Create / `POST /api/ebay/listing` | **YES path** — needs token + sell scopes + **business policies** |
| Durable refresh on fashionistas-api KV | **NOT yet** (cookie best-effort) |
| Equal Multilist UX (all shops first-class) | **IN FLIGHT** — see §6 |
| Browser extension guided paste | **NOT yet** |
| Real AdSense | **NO** until real pub-id |
| Fake accounts / invented pub-ids / invented shop keys | **Must never** |

### Typical eBay listing blockers (expected, not bugs)

1. No token cookie → `ebay_not_connected`  
2. Old token without sell scopes → `insufficient_scope_or_auth` — Reconnect OAuth  
3. No business policies → `missing_business_policies` — Seller Hub  
4. Expired access + no Client Secret for refresh → paste BYO keys again  
5. Production scopes not granted → Sandbox or enable in developer portal  

---

## 9. Secrets

| Secret / var | Where | Notes |
|--------------|--------|--------|
| `EBAY_CLIENT_ID` | CF Pages secret **or** BYO UI | Prefer BYO v1 |
| `EBAY_CLIENT_SECRET` | CF secret **or** BYO | Needed for exchange + refresh; never commit |
| `EBAY_RU_NAME` / `EBAY_REDIRECT_URI` | CF | Must match RuName / callback |
| `EBAY_ENV` | CF var | `sandbox` \| `production` |
| Optional KV binding | Pages | `EBAY_TOKENS` / `FASHIONISTAS_KV` / `TOKENS` |
| Contact | FormSubmit → `fashionistas1979@gmail.com` | Activate on first real submit |

Checklist only: [`.env.example`](../.env.example).

```bash
npx wrangler pages secret put EBAY_CLIENT_ID --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_CLIENT_SECRET --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_RU_NAME --project-name=fashionistas-ai
```

---

## 10. Next recommended (priority)

1. **Equal Multilist UX** — finish/push `feat/multilist-all-shops-first-class` (or successor): first-path + kit CTAs equal for all six; eBay Create secondary; merge + wrangler deploy. Resolve PR #7 (merge then equalize, or fold equal UX into one PR).  
2. **Browser extension** (or equivalent) for guided paste on non-eBay shops — no password harvesting / fake auto-accounts.  
3. **API Shop cleanup** — hide QA/bulk/no-photo server-side; normalize platforms to the six (client filter is only a bandage).  
4. **Durable tokens on fashionistas-api** (KV/D1) keyed by user — replace cookie-only refresh.  
5. **AdSense only with real pub-id** — then update `ads.txt`; never invent.  
6. Hive LLM coach (today: static checklist); eBay category taxonomy + default policies helper.  

---

## 11. Rules for agents

1. **No fake auto-signup accounts.** Guide + real vendor URLs only.  
2. **No invented AdSense pub-ids** or shop API keys / passwords.  
3. **Deploy with wrangler** to project **`fashionistas-ai`**. Git push ≠ deploy.  
4. Before overwriting production: compare `deployment list` Source SHAs to `git cat-file`. Live may be ahead of `main`.  
5. **Paste multilist must keep working** while Connect/API is partial.  
6. **Honest copy:** never claim auto-post beyond eBay Connected+API path; prefer **equal UX** language for all six shops.  
7. Prefer PRs for non-trivial Connect/API/UX work.  
8. User demand night ET: **do not leave the product eBay-centric.**  

---

## 12. Quick start

```bash
git clone https://github.com/placebetsai/fashionistas-ai.git
cd fashionistas-ai
git pull origin main
# Read this file + docs/EBAY_OAUTH.md + docs/MULTILIST_CONNECT.md
npx wrangler pages deployment list --project-name=fashionistas-ai
# Equal-UX WIP may exist as local stash/branch on shared box — check before starting fresh
# Deploy only when intentional:
# npx wrangler pages deploy . --project-name=fashionistas-ai
```

### Key live URLs

| URL | Purpose |
|-----|---------|
| https://fashionistas.ai/ | Marketing + SPA |
| https://fashionistas.ai/contact/ | FormSubmit contact |
| https://fashionistas.ai/about/ | Ownership / honesty |
| https://fashionistas.ai/privacy/ | Privacy |
| https://fashionistas.ai/ads.txt | Placeholder ads.txt |
| https://fashionistas-api.fashionistas1979.workers.dev/api/health | API health |
| https://075ef679.fashionistas-ai.pages.dev | Latest known CF prod (PR #7 source `125816d`) |

> **Not a live URL any more:** the fee take-home page that used to sit in the `fees/` directory was deleted on purpose (removed from `sitemap.xml` and from every nav/footer). Fee take-home now lives in the app via `POST /api/fees/estimate` and `POST /api/fees/compare`.

**End of handoff — 2026-09-26 night ET (complete through Connect #1–#4, P0 #5, kits+listing #6, eBay walkthrough #7 open+live, equal-UX in flight).**

## 2026-10-07 09:45 ET — landing redesign shipped
- Live tip: 54b4e84 (merge of redesign-preview + nav alignment), deployment b0d247b3 via scripts/deploy-local.sh, version.txt verified.
- Rollback: previous production deployment e26c7045-e4f5-4cbe-a18d-f7f77af28e96 (c047b8a).
- New files: redesign.css, redesign.js, assets/rd/*.webp (Unsplash, see assets/rd/CREDITS.txt). Landing hamburger <=1100px, compact links 1101-1320px.

## 2026-10-07 09:50 ET — launch countdown bar live
- Live tip: 4e34b0b (deploy-local verified). countdown.js counts to 2026-10-14T09:45:00-04:00, then shows "We're live".
- Home: appended inside sticky #land-nav (under nav row). /see-in-space/, /try-on/: inserted after header.topnav in normal flow.
- Remove: delete the countdown.js <script> tags in index.html, see-in-space/index.html, try-on/index.html.
- Rollback for this change: previous prod = b0d247b3 (54b4e84).

## 2026-10-07 09:53 ET — ROLLED BACK: production = e26c7045 (c047b8a, pre-redesign)
- User reported mobile broken after redesign+countdown. Rolled back via Pages API rollback (wrangler 4.148 has no rollback cmd).
- WARNING: local main still contains 54b4e84 (redesign) + 4e34b0b (countdown). Running scripts/deploy-local.sh from main WILL re-ship them. Do not deploy main until the user approves redesign v2.
- v2 fix lives in worktree ../fashionistas-ai-redesign, branch redesign-fix (c645933), preview https://redesign-preview.fashionistas-ai.pages.dev

## 2026-10-07 ~10:35 ET — redesign v2 SHIPPED to prod
- Merged `redesign-fix` (c645933) into main → ba08a59; deployed via scripts/deploy-local.sh → Pages deployment a3447cbb (version.txt verified).
- Main IS now deployable again (supersedes 8fbdd42 warning). Rollback target: previous prod e26c7045 (Pages API rollback).
- Playwright QA on live (desktop 1440, iPad, iPhone SE/13 WebKit, Pixel 7): rotator pill visible, nav one row desktop / hamburger small, countdown under nav to 2026-10-14T09:45-04:00, 0px overflow, /, /try-on/, /see-in-space/, /about/ 200. Only errors: AdSense 400s + 404 /assets/fashionistas-app-icon-512.svg (pre-existing).
- No GitHub push. chrome-store zips reverted after deploy.

## 2026-10-07 10:55 ET — mobile anti-flicker + layout pass 2/3 LIVE
- Production: c48bc4b8 (e17ee64; countdown seconds fix on top of 99b5b7d9/7f9e906 + countdown-seconds color fix). Rollback target: 6d7a162f (cc7bf2e, flicker fix only); older: 809fc97a (bd2978a).
- Flicker: countdown updates text nodes only; rotator pill fixed width; ? fab debounced; no infinite/backdrop anims on phones; reduced-motion honored.
- Layout: unfilled AdSense mounts collapse (were ~390px blank gaps); sticky bottom "Start selling free" CTA on phones; shop pills = snap carousel; fluid 16px+ type; 44px sections; countdown height reserved + Inter display=optional → CLS 0.207→0; hero image preloaded.
- Lighthouse mobile perf 35→49; remaining bottleneck = 447KB index.html + AdSense.
- Verified live on iPhone SE/13/15PM, Pixel 7, iPad, 1440: no overflow, no JS errors, 8 nav links.

## 2026-10-07 ~11:40 ET — perf + pill + contrast LIVE
- Production: ed5a83c2 (181d819). Rollback: c48bc4b8 (e17ee64).
- 308KB inline app script → /assets/app.<hash>.js (defer, immutable cache; tests read it via tests/helpers/index-source.mjs). Rename hash when editing app code (re-run the split or edit the file + update the <script src>).
- Early inline boot in #view-auth unhides landing for signed-out visitors (otherwise blank first paint until bundle runs).
- Font CSS non-blocking; mobile static bg layers (meshDrift/aurora/gridPan/rdScan off ≤767px); 3 below-fold imgs lazy.
- Rotating pill never blank (instant swap + soft settle, min opacity .55); AA contrast fixes (kickers, muted text, shop pills, footer).
- AdSense loader left as raw <script async> in head (repo test + comment forbid deferring it). Ads verified loading (adsbygoogle.loaded, slots done/unfilled).
- Lighthouse mobile: perf 51→72–76, a11y 97→100, FCP 5.1→1.1s, LCP 6.5→2.0s, CLS 0. TBT still ~1.1–1.7s (app bundle boot ~1.3s long task).

## 2026-10-07 12:30 ET — categories launch (prod)
- Shared table functions/_lib/categories.js: 5 depts (Women/Men/Kids/Home/Art), 69 types, per-shop paths (Depop/Poshmark/Mercari/Vinted/Grailed), eBay leaf ids (verified flag; unverified -> eBay Taxonomy suggestion first), Etsy path -> live taxonomy id (functions/_lib/etsy-taxonomy.js). Regenerate copies: node scripts/gen-categories.mjs
- Form: dept -> grouped type chips -> per-type size picker. Old flat/old-tree categories resolve via LEGACY.
- AI vision returns categoryPath from the table. eBay/Etsy/list routes + extension read the table; extension never auto-submits an unconfirmed category (needs_review, tab left open).
- Try it on / See it in my room: buyer-only (search cards + product page); try-on preloads ?item=.
- deploy-local.sh: DEPLOY_BRANCH=<name> for previews.
- Rollback: Pages deployment 39595d7c-c23d-4a9f-a5fe-742d7c97dffe (5b84c2d).
- Open: verify shop paths with real posts; Etsy who_made/when_made defaults wrong for resale (vintage-only rule).

## 2026-10-07 — Android "blinking" fix (prod, 1c174ff)
- Causes: countUp re-ran on its own writes, seller-coach banner/panel rewrote identical DOM, #screen observer reacted to coach/count-up mutations, edge cache served stale app.js. ~9k–35k mutations/3s -> ~480.
- Fixes: idempotent writes (el.__counted, __scSig), filtered observers, bundle renamed to assets/app.<hash>.js + ?v= on css/js. Keep seller-coach.js == libs/seller-coach.js (test enforces).
- Rollback: 45b2aecb-3cf5-4659-9a88-b3090771bbec (58af13b); older 58175efe-fdbf-475e-a307-c677b5c40dbe (5693f4e).

## 2026-10-07 — Phone header + bottom tab bar (PREVIEW ONLY: https://mobile-nav-preview.fashionistas-ai.pages.dev)
- NOT on production. Commits 7f667d9, 98b7600, ee1ddb5, 1bc6af3 are local main only; prod is still 1c174ff. Ship only with Iz's explicit OK.
- Why sticky failed on Android: #topbar was static; #land-nav sticky sat under a clipping/transformed ancestor. Now position:fixed + measured spacer (mobile-nav.js sets --mh header height, --tb tab bar height via ResizeObserver).
- mobile-nav.js builds #mtabbar (app: Home/Shop/Sell camera/Try on/Account; landing: Home/Try on/Sell/Room/Sign in). Old nav.tabbar stays in DOM (navBuild clones it into drawer/#topnav) but is hidden <900px.
- redesign.css v16–v19 (<900px): fixed header, no backdrop blur, safe-area insets, 44px targets, one brand lockup (F tile + Instrument Serif wordmark, red italic .ai) in app/landing/drawer, drawer z 99 above header, no help chips in menus, theme toggle moves into the drawer at <375px, light-mode .hero-sub contrast fix.
- QA (box): /workspace/qa5.py TAG URL devices -> /workspace/fash-mobile-qa5/<TAG>/. Pixel 7 / 360 / 320 / iPhone 13, light+dark, y0/1000/2000/menu: header at top, tab bar at bottom, nothing overlapping it, no JS errors.
- Known: Playwright WebKit (iPhone) crashes intermittently while scrolling the Shop list — same on prod, pre-existing, not caused by this work; check on a real iPhone.
- v20/v21 (preview, 717f279 + 0310eee): "What's next" coach bar shows on Home only on phones (mobile-nav.js sets html[data-mtv]=current view); menu has a "What's next · Checklist" row (mtShowNext → Home + expands it). Chat button 44px, tab bar +16px (Home: +70px above the coach bar), hidden while the checklist is expanded; .wrap bottom padding tb+76px so content scrolls clear; snackbar sits left of the chat button above the tab bar. QA: /tmp/qa6.py-style scan found 0 chat-button/"Try it on" overlaps over the whole Shop page (Pixel 7, 360px).

## 2026-10-07 15:00 ET — SHIPPED: phone header + bottom tab bar + coach bar Home-only (Iz said "Goooo")
- Production: 0d44887b-acd7-46e4-ac74-77c7896251d8 (2eb3f16 = 0310eee mobile-nav polish + handoff-only commit). Same code as https://mobile-nav-preview.fashionistas-ai.pages.dev (0e293477, 0310eee).
- Rollback: f408459d-5d27-4523-acbd-0d7711c8f6d3 (1c174ff, flicker fix only). Older: 45b2aecb-3cf5-4659-9a88-b3090771bbec (58af13b).
- Deployed via scripts/deploy-local.sh (no DEPLOY_BRANCH) after rm -rf node_modules/.cache/wrangler and unsetting CF_ACCOUNT_ID; version.txt verified == 2eb3f16; /.env* /.git/config 404.
- Live QA (Pixel 7 + Galaxy 360, light+dark, landing + demo app): header pinned (top 0) and tab bar visible at y=0 and y=2000; 0 JS errors; Shop "Try it on" vs chat button overlap 0/26 and 0/27 positions; "What's next" menu row opens the checklist; DOM mutations 13 per 3s (hero word rotators), identical to the rollback deploy; layout shift 0.
