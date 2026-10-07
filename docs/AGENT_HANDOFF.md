# Agent handoff — fashionistas.ai

## CURRENT STATE — 2026-10-07 late night ET (read this first — product source of truth)

**Laptop repo (preferred):** `/home/billionaremaker/fashionistas-ai`  
**GitHub:** [placebetsai/fashionistas-ai](https://github.com/placebetsai/fashionistas-ai)  
**Live tip:** `version.txt` = **`94e095c`** after wrangler deploy — must match `https://fashionistas.ai/version.txt`

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
| prior | Chatbot expand / multilist / try-on pipeline | see git log |
| `a5da396` | **Seller coach layer** — What's next + empty-state path + help chips/tips + stylist questions (`libs/seller-coach.js`) | Sign in → **What's next**; Photo **First sale path**; form `?` chips; tests **6/6** |
| `496b09a` | **Free See in my space** — room photo placer (4-corner wall + floor drag/scale/rotate) + optional `<model-viewer>` wall/floor AR from client GLB; CTAs on Shop/Closet detail; `placement_mode` inferred (`clothing`\|`wall`\|`floor`\|`none`); honest Instant/not-photoreal labels | `/see-in-space/` · tests `placement-mode` + `placer-homography` **12/12** · brief `docs/FREE-SEAMLESS-ANYOBJECT.md` |


### Seller coach — how to see it

1. Sign in (or **Log in as demo seller**).
2. Lower-left floating **What's next** checklist (Photo → Identify → Fill listing → Multilist → Connect extension → Sell everywhere).
3. Open **Photo** with no listings for the **First sale path** empty-state banner.
4. After AI fill, listing form **? Price help / Size help / Brand help** chips open the stylist with a suggested question (reuses chat topics; no new paid APIs).
5. Tip targets also cover **Sell everywhere**, **Connect extension**, **Try it on**, **See in my space**.
6. Progress stored locally as `fash_seller_coach_v1`. Source: `/libs/seller-coach.js` (24054 B). Feature SHA: `a5da396` / `a5da396843efc9c263b343f60be262d7aa372c33`. Handoff stamp commit: `94e095c` / `94e095cc0f66d9a498d207ab399dd28e51965f48`.

### See in my space — how to demo on phone

1. Open `https://fashionistas.ai/see-in-space/` (or Shop item → **See on my wall** / **See in my room**).
2. Upload room photo → upload listing image → Wall: drag 4 corner handles; Floor: drag + scale/rotate.
3. Optional AR: rebuild plane → use model-viewer AR (Android Scene Viewer / iOS Quick Look when supported). If AR unsupported, photo placer remains — never a dead end.
4. Labels: **Instant preview · free forever** / **Not photoreal**. No Stripe / no paid VTON on this path.

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
