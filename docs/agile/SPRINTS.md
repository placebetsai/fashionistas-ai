# Sprints (2–3 days each). Each one ends with a preview, 412×915 screenshots, and Iz's "ship it"

Coordination: the branch `seller-ux` is being built by another worker. Sprint 1 stories land on that branch, owned by that worker. This plan doesn't edit its code; it only defines the scope and tests.

## Sprint 1 — Seller: listing + connect + dashboard (Oct 14–16)
| Story | Test |
|---|---|
| BUG-1 / S-CL1 extension-session connect, no keys | e2e/agile/s1-connect.spec.js: no `input[name*=key]` in main flow; chips render |
| BUG-2 no "not built" | s1-connect: body text !~ /not built/i |
| BUG-3 / S-PH2 non-destructive clean | s1-photo.spec.js: original retained, Undo restores byte-identical |
| BUG-4 / S-AI3 honest AI | s1-ai.spec.js: coffee-lid fixture → non-fashion warning, no "% sure", category empty |
| S-AI1, S-AI2 AI draft + no overwrite | s1-ai.spec.js |
| BUG-5 greeting | s1-dash.spec.js: !/Hey Fashionistas/ |
| BUG-6 / S-AN1 honest empty dashboard | s1-dash: test seller with 0 sales → no chart svg path, "No sales yet" |
| BUG-7 clean tiles | s1-dash screenshot + axe contrast |
| S-CL2 Post everywhere (eBay, Poshmark, Depop, Mercari) | manual extension checklist + s1-post.spec.js per-site status |
| S-PH1 photos | s1-photo.spec.js |

## Sprint 2 — Inventory sync + honesty (Oct 19–21)
S-INV1 delist-everywhere + log, S-CL3 missing-fields, S-CL4 reconnect, T-1 fake-data audit, T-2 sold removal. Tests: s2-delist.spec.js (simulated sale → all-site delist log), s2-fields.spec.js.

## Sprint 3 — Buyer find + item page (Oct 22–24)
B-FL1, B-SO1, B-SR1, B-IT1, B-BY1, B-OUT1. Tests: s3-filter.spec.js (multi-select, chips, "Show X"), s3-item.spec.js (no dead buttons).

## Sprint 4 — Messages/offers + payouts copy (Oct 27–29)
S-MSG1, S-PAY1, S-ON1, S-ON2. Tests: s4-inbox.spec.js.

## Sprint 5 — SEO/AdSense/trust + extension store (Oct 30–Nov 3)
T-3..T-6, S-PR1, S-CL5, S-AN2. Tests: s5-seo.spec.js (schema, sitemap), Lighthouse CLS.

## Later
S-INV2, B-TO1 polish, B-SV1, S-MSG2, Capacitor/TWA apps.

## Definition of done
1. The test passes on preview.
2. Phone screenshots are posted.
3. Iz says "ship it".
4. Wrangler deploy via scripts/deploy-local.sh.
5. AGENT_HANDOFF.md is updated.
