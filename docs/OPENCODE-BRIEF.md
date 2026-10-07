# OpenCode agent brief — Fashionistas.ai (functionality first)

**Date:** 2026-10-06  
**Owner intent:** Make every core piece *work*. Beat competitors on product. Do NOT prioritize honesty/copy polish as the main goal. Do NOT turn on Stripe until the loop works.  
**Live tip:** fashionistas.ai ≈ GitHub main (check `version.txt`). Laptop: `~/fashionistas-ai`.  
**Repo:** placebetsai/fashionistas-ai  
**Product promise:** Photograph closet → AI ID + price → one click lists to many marketplaces + photoreal try-on. Name is gold.

## What is broken / unfinished today (functionality)

1. **AI identify:** sample jacket mislabeled as dress shirt; brand/size often empty or literal "not visible".
2. **Sell everywhere:** no proven real multi-post; extension IDs empty; eBay/Etsy need keys+connect; toast can claim success without ids.
3. **Try-on:** live `/try-on/` was dead because `/core/tryon_pipeline.js` 404'd via `_redirects` (fix path: serve pipeline from `/try-on/`); Photoreal path unproven end-to-end on production.
4. **Buyer marketplace:** SPA shop is demo-only; no real cart; not the priority vs listing engine.
5. **Missing env:** eBay / Etsy / Stripe / Google keys (Stripe last).

## Competitor bar you must clear

| Competitor | $ | What they do well |
|---|---|---|
| Vendoo | $14.99 | Crosslist + auto-delist at same price as Fashionistas |
| Closo | $0 crosslist | Free distribution |
| Flyp | $9 | Cheap extension crosslist |
| FlipAI / Underpriced / ThriftBrain | ~$5–$10 | Photo → ID + sold comps |
| Depop native AI | Free in Depop | One photo → listing fields inside Depop |

**Win condition:** Fashionistas = FlipAI-class create + Vendoo-class distribute, fashion-native, mobile-first. Crosslist alone loses at $14.99.

## Build order for OpenCode (functionality)

### Sprint A — Make the create loop work
- Photo (guided: front, tag, care, flaw) → brand, category, size, condition, title, description in <15s
- Sold comps + fee-aware ask/you-keep for Depop, Poshmark, Mercari, eBay, Vinted, Grailed
- Never ship empty/"not visible" as size; prompt for tag photo
- Fixture tests: jacket, jeans, sneaker, handbag, dress — brand+category correct

### Sprint B — Make distribution work (top 4–5 only)
- Real post path #1: eBay OAuth + inventory create (sandbox then prod) returning listing URL/id
- Real post path #2–4: Chrome extension publish for Poshmark, Mercari, Depop (user's session) with stored result URL
- Auto-delist / sold sync on paid plan (Vendoo table stakes)
- Delay Amazon/Shopify/Woo/TRR vanity lists until top channels post for real

### Sprint C — Try-on that returns an image
- Photoreal via FASHN (or FLUX) ≤~5–8s when authenticated
- Prove: upload person + garment → visible photoreal output
- Meter credits; buy API, do not train custom diffusion

### Sprint D — Differentiation after A–C
- Per-channel title/description variants
- Inventory intelligence (days-to-sell, markdown, which channel)
- Optional shareable Fashionistas shop link (thin) — NOT a multi-vendor marketplace yet

## Explicitly do not build yet
- Own consumer cart / Fashionistas checkout / Shopify marketplace
- Poshmark share/offer bots as core
- Kidizen (dead)
- 12–21 marketplace coverage before quality on 4–5
- Stripe live charging until A+B proven in a recorded demo

## Definition of "prime time" (functionality)
Recorded demo on production:
1. Phone photo → correct draft with fee take-home
2. One button → real listing live on ≥2 external shops with URLs saved
3. Optional: photoreal try-on image in seconds
4. Sold on one shop → delisted on others

## Name / idea positioning
Fashionistas.ai = fashion listing OS ("powered by Fashionistas"), not a cold-start Depop clone. Own marketplace only after supply is captive.
