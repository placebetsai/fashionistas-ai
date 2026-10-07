# Fashionistas.ai — Free / Seamless / Any-Object Placement Brief

**Date:** 2026-10-06 (America/New_York)  
**Audience:** Fashionistas.ai owner  
**Goals:** (1) as FREE as possible for end users, (2) seamless/easy UX, (3) not just clothing try-on — also painting on wall, furniture, any object for sale.  
**Method:** WebSearch + WebFetch of vendor docs, pricing pages, OSS repos. **No invented prices.** Uncertainty flagged.  
**Related:** `COMPETITOR-RESEARCH.md` (same audit folder) for $14.99 seller-sub context.

---

## Executive answer (one screen)

| Priority | Ship | Cost to Fashionistas | Cost to end user | Quality bar |
| --- | --- | --- | --- | --- |
| **P0** | Browser Instant clothing overlay (MediaPipe/pose + warp) + **photo wall/object overlay** (4-corner perspective) | ~$0 infra (static JS + CDN models) | **$0 forever** | “Good enough preview” — not photoreal |
| **P0b** | Optional `<model-viewer>` wall/floor AR for listings that have a flat GLB / textured plane | $0 (Apache-2.0) | **$0** | True AR when phone supports it; fallback to photo overlay |
| **P1** | Photoreal clothing via **metered** free quota (HF Space / Workers AI partner / Replicate) with honest limits | Real $ per gen — see §3 | Free N/day; then Pro or seller-paid | Photoreal; latency 5–50s |
| **P2** | Generative “place object in room photo” only when a free/cheap path exists | Usually paid GPU | Not free forever | Highest wow; highest burn |

**Do not promise as free forever:** unlimited photoreal diffusion try-on, unlimited generative room staging, Banuba-class face AR at scale, 8th Wall hosted WebAR (platform sunset).

**Positioning:** Name is fashion, product is **“see it in your life before you list/buy”** — closets *and* home objects (paintings, lamps, chairs). Same freemium UX: Instant free → Photoreal limited → Seller $14.99 absorbs buyer tries.

---

## 1. Clothing VTON — free / cheap options

### 1.1 Comparison table

| Option | Who pays | Published cost | Commercial OK? | Latency | Seamless UX? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Browser Instant** (MediaPipe / MoveNet + TPS warp) | Nobody (on-device) | **$0** | Yes (your code) | Instant (~realtime) | Best | Quality = overlay, not diffusion |
| **FASHN HF Space** `fashn-ai/fashn-vton-1.5` | HF Zero GPU queue | **$0** (queue waits) | Demo only; production needs API | Variable (queue) | Poor at scale | `limit=1`, `max_size=30` on Space; “Running on Zero” |
| **FASHN API** Try-On v1.6 | Fashionistas | **$0.075 / successful image** (1 credit @ on-demand) | Yes | Product claims ~seconds | Good if proxied | Tier I $19/mo includes 282 credits |
| **Cloudflare `pruna/p-image-try-on`** | Fashionistas | **$0.015 / output image + $0.008 / input image** | Partner model on CF | Fast path (`turbo`) | Good (Workers binding) | **Not** covered by Neuron free alloc — USD partner pricing |
| **Workers AI FLUX.2 klein / schnell** | Fashionistas | Neuron pricing; **10,000 Neurons/day free** | Partner / CF terms | Fast for klein | Weak as *true* VTON | Multi-ref edit ≠ dedicated garment try-on |
| **Replicate IDM-VTON** | Fashionistas | **~$0.023 / run** (varies) | **No** — CC BY-NC-SA 4.0 | ~17s (A100) | API only | Research / non-commercial |
| **Replicate CatVTON-FLUX** | Fashionistas | **~$0.070 / run** (varies) | CatVTON family typically **NC** | ~51s | API only | Confirm license before product use |
| **BFL FLUX Virtual Try-On** | Fashionistas | **from $0.0475 / image** | Yes (BFL API) | Optimized for interactive | Good | `vto-v2` recommended (up to 4MP) |
| **Groq / Workers AI text LLMs** | — | Free/cheap text | N/A | Fast | **Irrelevant to pixels** | Do not use for try-on |

Sources:

- FASHN Space: https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5  
- FASHN model / Apache-2.0 weights: https://huggingface.co/fashn-ai/fashn-vton-1.5  
- FASHN API pricing: https://help.fashn.ai/plans-and-pricing/api-pricing  
- CF P-Image Try-On: https://developers.cloudflare.com/ai/models/pruna/p-image-try-on/  
- CF Workers AI pricing (Neurons): https://developers.cloudflare.com/workers-ai/platform/pricing/  
- Replicate IDM-VTON: https://replicate.com/cuuupid/idm-vton  
- Replicate CatVTON-FLUX: https://replicate.com/mmezhov/catvton-flux  
- BFL FLUX Tools (VTO from $0.0475/image): https://help.bfl.ai/articles/5950329591-what-are-the-flux-tools  
- Browser Instant OSS: https://github.com/pravoobi/try-on · https://www.npmjs.com/package/@practics/tryon-core  
- Open-source VTON license roundup (FASHN Apache-2.0; IDM/CatVTON NC): https://fashn.ai/blog/comparing-the-top-4-open-source-virtual-try-on-viton-models  

### 1.2 FASHN free HF Space (already known — sharpened)

| Fact | Detail | Uncertainty |
| --- | --- | --- |
| Hosting | “Running on Zero” (HF free GPU queue) | Queue wait times vary by day/load — **not SLAable** |
| Concurrency | Space code: `@spaces.GPU` with Gradio queue **limit=1**, **max_size≈30** | Exact UX when full: user waits or fails |
| Quality | VTON v1.5 maskless; output ~576×864 | Lower res than paid 1K–4K Max |
| Production use | Scraping/proxying Space = fragile + against HF norms | Use **API** or **self-host Apache-2.0 weights** for product |
| Self-host path | Weights ~2GB + DWPose; Apache-2.0 | GPU cost becomes *your* bill |

### 1.3 Cloudflare Workers AI — what actually helps

| Model | Role for Fashionistas | Free tier reality |
| --- | --- | --- |
| `pruna/p-image-try-on` | **Real dedicated VTON** on CF stack | Priced in **USD** ($0.015 out + $0.008/in). Promo “70% off until 21 Jun” may be expired — **re-check live page**. |
| `@cf/black-forest-labs/flux-2-klein-9b` | Text + up to 4 ref images; style/edit | Neuron/MP pricing; **not** garment-warping VTON. Can hack “put this shirt on this person” prompts — results unreliable vs dedicated VTON. |
| `@cf/black-forest-labs/flux-1-schnell` | Cheap T2I | ~4.8 Neurons/tile + 9.6/step — useful for marketing art, **not** try-on |
| Free allocation | **10,000 Neurons/day** shared | Applies to Neuron-priced models. Partner USD models (Pruna) **bill separately**. |

Rough Neuron math for schnell (community-derived, **flag as estimate**): 1024×1024 @ 4 steps ≈ ~173 Neurons → on the order of **~50–60 free images/day** before Paid. Source basis: https://developers.cloudflare.com/workers-ai/platform/pricing/ and community thread https://community.cloudflare.com/t/flux-1-schnell-cost-and-limits/801029  

**Demo Worker already exists:** https://github.com/jillesme/worker-virtual-try-on (Next + R2 + `pruna/p-image-try-on`).

### 1.4 Replicate free credits / cheap IDM / CatVTON / FLUX VTO

| Item | Published | Caveat |
| --- | --- | --- |
| Free runs | “Try for Free” collection = **limited** runs after signup, then billing required | https://replicate.com/collections/try-for-free · https://replicate.com/docs/topics/billing |
| IDM-VTON | ~**$0.023**/run | **Non-commercial license** — cannot ship in Fashionistas product without separate rights |
| CatVTON-FLUX | ~**$0.070**/run | License family often NC — verify before commercial |
| FLUX VTON on Replicate | Community ports ~**$0.07**/run range | Prefer **BFL official** at from **$0.0475**/image if going paid photoreal |

### 1.5 Browser-only Instant (MediaPipe) — free forever for user

| Stack | What it does | Quality bar | Ship recommendation |
| --- | --- | --- | --- |
| **pravoobi/try-on** + `@practics/tryon-core` | Selfie Segmenter + MoveNet + TPS garment warp; WebGPU + Wasm fallback; webcam or photo | Instant preview; fabric physics weak; works for tops/pants | **P0 clothing path** |
| MediaPipe Pose + Canvas overlay (student demos) | Shoulder/hip anchors → PNG overlay | Lower than TPS | Prototype only |
| softWear / zoopbyte (3D GLB + MediaPipe) | True 3D garment mesh | Needs **GLB garments** — sellers won’t have these day-1 | Later / premium listings |

**Honest quality bar for Instant:** shoppers understand “preview overlay.” Do **not** market as photoreal. Photoreal is the upgrade button.

### 1.6 What competitors charge users vs absorb

| Player | End-user cost | Who absorbs GPU | Source |
| --- | --- | --- | --- |
| **Google Shopping VTON** | Free | Google / retailer partners | StyTrix 2026 comparison |
| **Zeekit @ Walmart** | Free | Walmart | Same |
| **StyTrix** | Claims unlimited free no signup | StyTrix (marketing claim — **verify sustainability**) | https://www.stytrix.com/blog/best-free-ai-virtual-try-on-tools-2026-comparison |
| **FASHN consumer app** | Free tier limited / lower res | FASHN | StyTrix + FASHN pricing docs |
| **Prehook** (Shopify) | Shoppers free | **Seller** $14.99/mo = 100 try-ons, then **$0.17** each | https://prehook.com/apps/ai-virtual-try-on/help/plans-and-try-on-credits/ |
| **Vensa** (Shopify) | Shoppers free | **Seller** $14.99/mo = 100 try-ons, then **$0.15** each (plans “early Aug 2026”) | https://vensa.app/virtual-try-on/pricing |
| **Banuba TINT** (makeup, not clothes) | Shoppers free | Brand **$49 / $99 / $349**/mo by try-on volume | https://www.banuba.com/tint-makeup-virtual-try-on |
| **Vue.ai / Veesual** | Shoppers free (on brand site) | Enterprise (often $1k+/mo class — StyTrix estimate) | StyTrix comparison — **enterprise quotes uncertain** |

**Pattern Fashionistas should copy:** **Buyers try free. Seller sub ($14.99) or ads pay the meter.** Instant overlay stays uncapped so free never feels broken.

---

## 2. Non-clothing: painting on wall / object in room

### 2.1 Product / tech map

| Product | Category | Tech class | Free for Fashionistas to use? | Fit |
| --- | --- | --- | --- | --- |
| **Society6 “View in Your Room”** | Wall art WebAR | (A) WebAR via **8th Wall** historically | No — their product | Inspiration UX: marker → place art → optional paint suggest |
| **IKEA Place** | Furniture | (A) Native ARKit app | No | Gold standard scale accuracy (~claims 98% historically) |
| **Amazon AR View / View in Your Room** | Furniture, décor, wall | (A) Native app AR | No | Floor + wall placement; true-to-scale 3D |
| **Paint visualizers** (Sherwin-Williams et al.) | Wall color | (A)/(B) app / WebAR | No | Companion, not core |
| **Banuba** | Face/makeup/jewelry WebAR | (A) SDK / TINT widget | Paid SDK/widget | **Wrong domain** for paintings/furniture (face-centric) |
| **8th Wall** | WebAR platform | (A) | Hosted **ending** — new paid signups paused; export/self-host transition through **2026–2027** | **Do not build new dependency** on hosted 8th Wall |
| **Google `<model-viewer>`** | Web + WebXR / Scene Viewer / Quick Look | (A) | **Yes** Apache-2.0 | `ar-placement="wall"` for paintings; floor for furniture |
| **SAM + inpainting / virtual staging OSS** | Generative place-in-scene | (B) | Code free; **GPU not free** | P2 |
| **Perspective overlay** (`perspective.js`, SpatialCanvas-style) | Photo + 4 corners | (C) | **Yes** | **P0 for paintings / flat objects** |

Sources:

- Society6 + 8th Wall case: https://info.nianticspatial.com/blog/society6-and-sherwin-williams-launch-view-in-your-room-webar-experience-letting-customers-preview-millions-of-wall-art-designs-and-paint-in-their-own-space  
- 8th Wall sunset FAQ: https://8thwall.org/docs/migration/faq  
- model-viewer AR + wall: https://modelviewer.dev/examples/augmentedreality/index.html  
- Amazon AR: https://www.amazon.com/visual-search/help/augmented_reality · https://sell.amazon.com/tools/3d-ar  
- IKEA Place (historical launch writeup): https://www.furninfo.com/Furniture-Industry-News/8243  
- perspective.js: https://github.com/wanadev/perspective.js/  
- SpatialCanvas warp API pattern: https://github.com/richardbigegapersonal/spatialcanvas  
- Virtual staging OSS examples: https://github.com/mithunparab/virtual-staging · https://github.com/atultw/Inpaint-Anything  

### 2.2 Tech split (decide per listing type)

| Class | How it works | Seamless? | Free forever? | Best for |
| --- | --- | --- | --- | --- |
| **(A) True AR** phone camera WebXR / ARCore / Scene Viewer / Quick Look | Live camera; plane detect; place 3D | High on supported phones; **zero on desktop** | Yes if model-viewer + your GLB | Furniture, framed art with size metadata |
| **(B) Photo upload + generative place-object** | Diffusion / SAM mask / ControlNet fill | Medium (wait 5–30s) | **No** at scale | Photoreal “staged” rooms |
| **(C) Perspective overlay** drag/scale/4-corner warp | Upload room photo → tap 4 wall corners → warp listing image | **Highest** (desktop+mobile, instant) | **Yes** | Paintings, posters, rugs (top-down), flat SKUs |

**Ruthless recommendation:** Ship **(C) first** for paintings/objects. Add **(A)** when you can auto-build a thin textured plane GLB from the listing photo + width/height. Defer **(B)** until you have seller $ or ads covering ~$0.02–$0.08+/gen.

### 2.3 Open-source / free APIs for object-in-room

| Approach | Cost | Mobile browser | Latency | Honesty |
| --- | --- | --- | --- | --- |
| **Canvas 2D + perspective.js** (4 points) | $0 | Excellent | Instant | Shadows optional CSS/gradient — “preview” |
| **SpatialCanvas-style warp** (four clockwise wall points + shadow_strength) | Self-host $0 | Good | Instant | Same class as (C) |
| **`<model-viewer ar ar-placement="wall">`** | $0 | Good on Android WebXR/Scene Viewer; iOS Quick Look | Near-instant after model load | Needs GLB/USDZ; auto-USDZ on iOS possible |
| **SAM + SD inpaint / Inpaint-Anything** | GPU $ | Heavy / often server | Seconds–tens | Photoreal; **not free at volume** |
| **CatVTON-like for objects / OmniTry** | Research / often NC base | Server | Slow | Accessories research — license traps |

### 2.4 Latency & mobile browser constraints

| Constraint | Impact | Mitigation |
| --- | --- | --- |
| iOS Safari WebXR limited vs Android | True wall AR uneven | Use model-viewer multi-mode: `webxr scene-viewer quick-look` |
| Camera permission friction | Drop-off | **Default to photo upload overlay (C)**; camera AR secondary |
| Large GLBs on cellular | Slow | Textured plane &lt;1–2 MB; DRACO; CDN |
| Diffusion on phone | Unusable | Never run P1/P2 on-device |
| WebGPU availability | Instant VTON fast path | Wasm fallback (pravoobi already does) |
| HTTPS required for camera / WebXR | Dev/prod | Already required for Fashionistas |

---

## 3. Product model for Fashionistas “free for users”

### 3.1 Recommended freemium shape

```
┌─────────────────────────────────────────────────────────┐
│  EVERYONE (buyers + lurkers)                            │
│  • Instant clothing overlay — UNLIMITED                 │
│  • Wall/object photo overlay (C) — UNLIMITED            │
│  • Optional model-viewer AR — UNLIMITED                 │
├─────────────────────────────────────────────────────────┤
│  FREE ACCOUNT                                           │
│  • Photoreal clothing: N gens/day (honest meter)        │
│  • Soft CTA: “Seller Pro unlocks more for your buyers”  │
├─────────────────────────────────────────────────────────┤
│  SELLER $14.99/mo (target — matches Vendoo / Prehook)   │
│  • Listing engine + crosslist (core SaaS)               │
│  • Buyer photoreal tries on *their* listings: pooled    │
│    quota (e.g. 100/mo like Prehook — calibrate later)   │
│  • Ads optional under free Instant if needed            │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Cost per generation at free-tier volumes

| Backend | Unit cost (published) | 100 free photoreal/day sitewide | 1,000/day | 10,000/day |
| --- | --- | --- | --- | --- |
| CF Pruna try-on (1 person + 1 garment) | $0.015 + 2×$0.008 = **$0.031**/gen | **~$3.10/day** | **~$31/day** | **~$310/day** |
| FASHN VTON v1.6 | **$0.075**/image | $7.50/day | $75/day | $750/day |
| BFL FLUX VTO | **from $0.0475**/image | ~$4.75/day | ~$47.50/day | ~$475/day |
| Replicate IDM-VTON | ~$0.023 | ~$2.30/day | ~$23/day | ~$230/day — **NC license** |
| Instant / overlay (C) | **$0** | $0 | $0 | $0 |

**Uncertainty:** Pruna input billing counts person + each garment; multi-garment outfits cost more. FASHN Try-On Max at Quality/2K–4K is **2–5 credits** ($0.15–$0.375 at on-demand) — do not use Max for free tier.

**Ads check:** They have AdSense pub. Instant pages with high dwell (webcam try-on, wall placer) are ad-suitable. Photoreal should stay **ad-light** (frustration if ads gate a 20s wait). Prefer seller sub to subsidize photoreal.

### 3.3 Seller pays $14.99, buyers try free — unit economics sketch

Using Prehook as market anchor (shoppers free; seller **$14.99** for **100** try-ons ≈ **$0.15** included cost to seller):

| If Fashionistas COGS | Break-even try-ons covered by $14.99 |
| --- | --- |
| @ $0.031 (Pruna) | ~480 gens/mo before loss (gross; ignores Stripe/support) |
| @ $0.0475 (BFL) | ~315 gens/mo |
| @ $0.075 (FASHN) | ~200 gens/mo |

**Ship 100 included photoreal/mo to seller’s buyers** (match Prehook messaging) and keep Instant unlimited — margin stays healthy even on FASHN.

### 3.4 What to ship first for paintings/objects **WITHOUT paid APIs**

1. Listing detail → **“See on my wall”**  
2. Upload room photo (or use last photo)  
3. Drag 4 corners on the wall rectangle  
4. Warp listing image with perspective.js (or equivalent)  
5. Optional: drag scale, opacity, simple drop shadow  
6. Download / share PNG for social  

Optional same sprint: generate a **flat plane GLB** from listing image + user-entered width/height → `<model-viewer ar-placement="wall">`.

**No** SAM, **no** diffusion, **no** Banuba, **no** 8th Wall hosted.

---

## 4. Ranked build plan (ruthless)

### P0 — Free seamless Instant + free wall/object overlay

| # | Deliverable | Done when |
| --- | --- | --- |
| P0.1 | Instant clothing: MediaPipe/MoveNet + garment PNG warp on photo **and** webcam | Works on Chrome Android + desktop; iOS Safari Wasm OK |
| P0.2 | Honest UI copy: “Instant preview” vs “Photoreal (limited)” | No user thinks Instant is AI photoreal |
| P0.3 | Wall/object **(C)** placer on listing photos | 4-corner warp + share |
| P0.4 | Category flag: `clothing` \| `wall_art` \| `floor_object` \| `other` → right placer | Paintings don’t open body try-on |
| P0.5 | Mobile-first: photo upload primary; camera secondary | &lt;3 taps from listing |

### P1 — Photoreal clothing via free quota + honest limits

| # | Deliverable | Done when |
| --- | --- | --- |
| P1.1 | Pick **one** paid backend for photoreal: prefer **CF Pruna** (already on CF stack) or **FASHN API** | Documented COGS in dashboard |
| P1.2 | Free user: **N/day** (start N=3; raise only with ads/seller $) | Hard cap + clear reset time (UTC or local) |
| P1.3 | Seller $14.99: pooled **100 buyer photoreal/mo** on their SKUs | Meter per seller like Prehook |
| P1.4 | HF Space = **demo/dev only**, not production path | No Space dependency in prod |
| P1.5 | License gate: block IDM-VTON/CatVTON in prod until commercial rights | Apache-2.0 FASHN self-host OR paid API |

### P2 — Generative room placement when free path exists

| # | Deliverable | Gate |
| --- | --- | --- |
| P2.1 | Server SAM-lite / depth + warp refine (still mostly geometric) | Only if Instant (C) retention proves demand |
| P2.2 | Full diffusion staging | **Only** on seller Pro or paid per-gen; never unlimited free |
| P2.3 | Revisit 8th Wall **open-source engine binary** | Only if model-viewer insufficient **and** license OK for commercial |

### What NOT to promise as free forever

| Promise | Why it dies |
| --- | --- |
| Unlimited photoreal VTON | $0.03–$0.08 × viral traffic = bankruptcy |
| Unlimited generative “place sofa in room” | Same |
| “Same quality as IKEA Place / Amazon AR” without 3D assets | Sellers have 2D photos |
| Banuba-quality face AR free | Their TINT starts $49/mo @ 1k sessions |
| Hosted 8th Wall forever | Platform access ends **2026-02-28**; hosting to **2027-02-28** |
| StyTrix-style unlimited free photoreal | Unverified economics — do not compete on their claim |

---

## 5. One-page recommendation for Fashionistas

### Positioning

> **Fashionistas: see it in your life before you list or buy.**  
> Closet pieces on *your* body. Wall art on *your* wall. Furniture in *your* room.  
> Instant preview is free. Photoreal is fair-use free, then seller-powered.

Name stays fashion-forward; **category taxonomy** expands the product without a rename. Homepage hero can say “Try on & try in” / “Wear it · Hang it · Place it.”

### Why this wins vs pure VTON apps

| Competitor type | Gap Fashionistas fills |
| --- | --- |
| Shopify VTON widgets | No multi-marketplace listing OS |
| Crosslisters (Vendoo $14.99) | No try-on / try-in at all |
| StyTrix / FASHN demos | No resale listing → post everywhere |
| IKEA/Amazon AR | Closed catalogs |

### North-star UX loop

1. Photo → ID/price → list ($14.99 seller).  
2. Listing auto-gets **Instant try** (body or wall/floor by category).  
3. Buyer opens listing → Instant free → optional Photoreal if quota left.  
4. Ads on Instant; COGS on Photoreal covered by seller pool.

### Decision locks (owner)

| Lock | Recommendation |
| --- | --- |
| Free forever surface | Instant + (C) overlay + model-viewer |
| Photoreal provider v1 | Cloudflare `pruna/p-image-try-on` **or** FASHN API (pick one; measure quality on *your* thrift photos) |
| Free photoreal N | Start **3/day/IP+account**; seller pool **100/mo** |
| Paintings day-1 | (C) only — no paid API |
| 8th Wall | Skip hosted; watch OSS engine later |
| Banuba | Skip for v1 (makeup, not inventory) |

---

## Appendix A — Citation index

| Topic | URL |
| --- | --- |
| FASHN Space | https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5 |
| FASHN weights Apache-2.0 | https://huggingface.co/fashn-ai/fashn-vton-1.5 |
| FASHN API pricing | https://help.fashn.ai/plans-and-pricing/api-pricing |
| CF Pruna P-Image Try-On | https://developers.cloudflare.com/ai/models/pruna/p-image-try-on/ |
| CF Workers AI pricing | https://developers.cloudflare.com/workers-ai/platform/pricing/ |
| CF FLUX.2 klein 9B | https://developers.cloudflare.com/workers-ai/models/flux-2-klein-9b/ |
| CF FLUX.2 klein changelog | https://developers.cloudflare.com/changelog/post/2026-01-28-flux-2-klein-9b-workers-ai/ |
| Replicate IDM-VTON | https://replicate.com/cuuupid/idm-vton |
| Replicate CatVTON-FLUX | https://replicate.com/mmezhov/catvton-flux |
| Replicate try-for-free / billing | https://replicate.com/collections/try-for-free · https://replicate.com/docs/topics/billing |
| BFL FLUX Tools / VTO price | https://help.bfl.ai/articles/5950329591-what-are-the-flux-tools |
| BFL general costs | https://help.bfl.ai/articles/7986977817-what-are-the-costs-associated-with-using-your-models |
| Browser Instant | https://github.com/pravoobi/try-on · https://www.npmjs.com/package/@practics/tryon-core |
| OSS VTON licenses | https://fashn.ai/blog/comparing-the-top-4-open-source-virtual-try-on-viton-models |
| Prehook pricing | https://prehook.com/apps/ai-virtual-try-on/help/plans-and-try-on-credits/ |
| Vensa pricing | https://vensa.app/virtual-try-on/pricing |
| Banuba TINT | https://www.banuba.com/tint-makeup-virtual-try-on |
| StyTrix 2026 free VTON roundup | https://www.stytrix.com/blog/best-free-ai-virtual-try-on-tools-2026-comparison |
| model-viewer AR | https://modelviewer.dev/examples/augmentedreality/index.html |
| 8th Wall FAQ / sunset | https://8thwall.org/docs/migration/faq |
| Society6 WebAR | https://info.nianticspatial.com/blog/society6-and-sherwin-williams-launch-view-in-your-room-webar-experience-letting-customers-preview-millions-of-wall-art-designs-and-paint-in-their-own-space |
| perspective.js | https://github.com/wanadev/perspective.js/ |
| Amazon AR help | https://www.amazon.com/visual-search/help/augmented_reality |

---

## Appendix B — Copy-paste OpenCode sprint list

```text
# Fashionistas — FREE / SEAMLESS / ANY-OBJECT — OpenCode sprints
# Priority: P0 free forever surfaces first. No paid APIs required for P0.
# Date: 2026-10-06

## Sprint P0-A — Instant clothing (browser-only)
- [ ] Vendor or extract on-device pipeline (prefer @practics/tryon-core or pravoobi/try-on patterns)
- [ ] Garment PNG: auto bg-remove once at listing create (can use existing / free rembg); store transparent asset
- [ ] Try-on page: photo upload + webcam; WebGPU with Wasm fallback
- [ ] Wire from Shop item detail when category=clothing
- [ ] Copy: badge "Instant preview · free" (never say photoreal)
- [ ] Privacy: never upload webcam frames to server for Instant path
- [ ] QA: Chrome Android, desktop Chrome, iOS Safari

## Sprint P0-B — Wall / object photo overlay (no paid API)
- [ ] New listing field: placement_mode = clothing | wall | floor | none
- [ ] "See on my wall" / "See in my room" CTA on item detail
- [ ] Room photo upload → canvas → user sets 4 corners (or drag/scale/rotate for floor)
- [ ] Implement perspective warp (perspective.js or equivalent) of listing image into quad
- [ ] Simple drop shadow + opacity slider
- [ ] Export/share PNG; persist last room photo in localStorage
- [ ] Default paintings/posters/prints → wall; furniture → floor overlay (affine) until GLB exists
- [ ] QA mobile thumb targets for corner handles

## Sprint P0-C — model-viewer AR (optional same week if capacity)
- [ ] Build flat textured plane GLB from listing image + width_cm/height_cm (server or WASM)
- [ ] Embed <model-viewer ar ar-placement="wall|floor" ar-modes="webxr scene-viewer quick-look">
- [ ] Graceful hide AR button when unsupported; keep photo overlay
- [ ] Keep GLB < 2MB; CDN cache

## Sprint P1 — Photoreal clothing (metered)
- [ ] Spike A/B: CF pruna/p-image-try-on vs FASHN tryon v1.6 on 20 thrift photos; pick winner on quality+COGS
- [ ] Worker proxy: auth, rate limit, strip EXIF, store result to R2
- [ ] Free quota: 3 photoreal/day/account (or fingerprint+IP); show remaining
- [ ] Seller pool: 100 photoreal/mo attributed to listing owner when buyer generates
- [ ] UI: Instant default tab; Photoreal tab with meter + upgrade CTA
- [ ] Explicitly do NOT call HF Space from production
- [ ] License check: no IDM-VTON/CatVTON in prod without commercial grant
- [ ] Dashboard: COGS/day by provider

## Sprint P1-B — Monetization hooks
- [ ] AdSense slots on Instant try-on + wall placer (not mid-photoreal wait)
- [ ] Seller plan copy aligned to $14.99: "Buyers try your items free · Instant unlimited · Photoreal included"
- [ ] Soft paywall only on photoreal exhaustion — Instant never paywalls

## Sprint P2 — Generative room (later; gated)
- [ ] Only after P0 retention metrics (wall placer open rate, share rate)
- [ ] Prototype geometric improve (depth/shadow) before full diffusion
- [ ] If diffusion: seller-only or paid per-gen; never unlimited free
- [ ] Do not adopt hosted 8th Wall; re-eval model-viewer vs OSS engine binary only if needed

## Explicit NON-goals this quarter
- [ ] Banuba / face makeup SDK
- [ ] Unlimited free photoreal
- [ ] Promising IKEA-Place accuracy without true scale 3D
- [ ] Building own SLAM / WebAR engine
- [ ] Marketplace GMV before listing+try loop works
```

---

## Uncertainty log (do not treat as fact)

| Item | Status |
| --- | --- |
| StyTrix “unlimited free” sustainability | Marketing claim; COGS unknown |
| Vue.ai / enterprise VTON $ floors | Third-party “$1k+/mo” — confirm with sales |
| Pruna 70% promo end date | Page showed “until 21 June” — may be stale; check live |
| Exact HF Space per-user daily caps | Not published in Space UI; queue is the practical limit |
| FASHN free *consumer app* daily limits | StyTrix says limited; exact N not verified here |
| Vensa Shopify plan go-live | Page says “early August 2026” — confirm if already live |
| 8th Wall OSS SLAM availability | FAQ: proprietary SLAM **not** open-sourced; engine binary limited-use |
| Neuron count for one Pruna try-on | N/A — Pruna billed in USD, not Neurons |

---

*End of brief. Write paths: box audit folder + laptop `fashionistas-ai/docs/`.*
