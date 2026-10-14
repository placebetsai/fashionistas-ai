# Fashionistas.ai — product backlog (supersedes docs/USER-STORIES.md)

Priority uses MoSCoW: M = must, S = should, C = could, W = won't-now. Severity runs from S1 (broken or lying to the user) to S4 (polish).
Every story maps to a phone test at 412×915 in `e2e/` (test IDs are in SPRINTS.md). A story is done when its test passes on a preview, screenshots are attached, and Iz has said "ship it". Research references (R#) point to UX-RESEARCH.md.

## Known bugs from Iz's screenshots (2026-10-14), all M
| ID | Bug | Sev | Acceptance |
|---|---|---|---|
| BUG-1 | Store connect asks the seller to paste API keys | S1 | The main flow shows no key or token inputs. Keys exist only under Settings › Advanced (R2). |
| BUG-2 | Marketplace rows say "not built" | S1 | No "not built" text anywhere. Unsupported sites are hidden or show "Coming soon" under a collapsed "More". |
| BUG-3 | Clean background destroyed the photo | S1 | The original is always kept. Clean shows a before/after with Keep/Undo. If the subject mask covers less than 60% of the item, auto-reject and keep the original (R7). |
| BUG-4 | AI labeled a coffee cup lid as Women › Bags with "80% sure, filled in for you" | S1 | Non-fashion items are flagged "Doesn't look like clothing — check photo". No % shown. Low-confidence category is left blank with top-3 picks (R5, R6). |
| BUG-5 | "Hey Fashionistas.ai" greeting | S2 | The greeting uses the seller's display name, or no name. It never uses the brand name. |
| BUG-6 | Money chart draws a rising line at $0 | S1 | With 0 sales, no chart; empty state "No sales yet" + "List an item" CTA (R10). The chart only plots real sale rows. |
| BUG-7 | Stat tiles have noisy background text/art | S3 | Tiles are a plain surface with number + label, contrast ≥ 4.5:1. |

## Seller stories
| ID | Story | MoSCoW | Sev | Acceptance criteria |
|---|---|---|---|---|
| S-ON1 | As a new seller I want to sign up with Google/email in under 30 s so that I can list right away | M | S2 | One screen; no plan picker; lands on "List your first item". |
| S-ON2 | As a new seller I want to be told it's free forever so that I don't fear a paywall | M | S3 | Onboarding states "Free — no fees, no plans" (R9); no Stripe screens. |
| S-PH1 | As a seller on my phone I want to shoot or pick up to 12 photos and reorder them so that my best photo is the cover | M | S2 | Camera + gallery; drag reorder; first = cover; works on Android Chrome 412px. |
| S-PH2 | As a seller I want optional, non-destructive background clean so that photos look pro without being ruined | M | S1 | Covered by BUG-3; per-photo toggle; off by default for Vinted export (R7). |
| S-AI1 | As a seller I want AI to draft title, brand, category, size, color and condition from photos so that I type less | M | S1 | Draft in ≤ 8 s; each AI field badged "AI — check"; one tap accepts all. |
| S-AI2 | As a seller I want AI never to overwrite what I typed so that my listing stays correct | M | S1 | Fields I edited are locked from AI re-runs (R5). |
| S-AI3 | As a seller I want honest uncertainty so that I catch wrong guesses | M | S1 | No numeric %; low confidence leaves the field empty with top-3 options; non-fashion detection (BUG-4) (R6). |
| S-PR1 | As a seller I want a price suggestion with real sold comps so that I price to sell | S | S2 | Shows range + count of comps + links; if no comps: "No comparable sales found", no invented number. |
| S-CL1 | As a seller I want to install the extension once and see which marketplaces I'm logged into so that connecting needs no keys | M | S1 | Board shows per-site chip: Connected / Log in (opens site tab) / Not installed; no credential stored (R2). |
| S-CL2 | As a seller I want "Post everywhere" to fill each marketplace form so that I only review and publish | M | S1 | Title, price, description and photos fill on eBay, Poshmark, Depop, Mercari (Sprint 1), then others; per-site result Posted / Needs fields / Failed (reason). |
| S-CL3 | As a seller I want a per-marketplace missing-fields checklist so that posts don't fail | M | S2 | Before posting, lists required fields per site; AI can fill, marked for review (R4). |
| S-CL4 | As a seller I want to see when a session dropped and reconnect in one tap so that sync doesn't silently stop | M | S2 | Red chip + "Reconnect" on dashboard within one extension heartbeat (R3). |
| S-CL5 | As a phone-only seller I want to list on my phone and finish posting from my laptop later so that I don't redo work | S | S2 | Draft created on phone appears in extension queue on desktop (R8). |
| S-INV1 | As a seller I want a sale on any site to delist the item everywhere so that I never double-sell | M | S1 | Sale detected → delist on all others; log with timestamp per site; failures shown in red with retry (R1). |
| S-INV2 | As a seller I want bulk delist/relist/refresh free so that stale stock moves | S | S3 | Multi-select actions; no paywall (R9). |
| S-MSG1 | As a seller I want buyer messages and offers on fashionistas.ai in one inbox so that I reply fast | M | S2 | Inbox with unread badge; accept/counter/decline offer; email notify. |
| S-MSG2 | As a seller I want links to my other marketplaces' inboxes so that I'm not hunting | C | S4 | Per-site deep link. |
| S-AN1 | As a seller I want analytics with honest empty states so that I trust the numbers | M | S1 | Views, saves, messages, sales from real rows only; zero states per BUG-6 (R10). |
| S-AN2 | As a seller I want per-marketplace performance so that I know where to list | S | S3 | Sales by site from detected sales; "not enough data" under 3 sales. |
| S-PAY1 | As a seller I want to know exactly how I get paid so that I'm not surprised | M | S2 | fashionistas.ai sales: clear "buyer pays you directly / via marketplace" copy; no invented payout schedule. Other sites: "paid by <site>". |
| S-DASH1 | As a seller I want a dashboard greeting and tiles that are clean and personal | M | S2 | BUG-5, BUG-7. |

## Buyer stories
| ID | Story | MoSCoW | Sev | Acceptance |
|---|---|---|---|---|
| B-BR1 | As a buyer I want to browse without an account | M | S2 | /shop real listings, no login wall. |
| B-SR1 | As a buyer I want search with typo tolerance | M | S2 | "jaket" finds jackets; no-results state suggests related. |
| B-FL1 | As a mobile buyer I want a filter drawer (price, size, color, brand, category, condition) with multi-select and "Show X results" | M | S2 | Per Baymard; chips for applied filters, removable. |
| B-SO1 | As a buyer I want sort: newest, price ↑↓, A–Z, Z–A | M | S3 | Persisted in URL. |
| B-IT1 | As a buyer I want an item page with all photos, size, condition, seller, and clear actions | M | S2 | Message, Buy, Try on, Buy on <site> ↗; no dead buttons. |
| B-TO1 | As a buyer I want to try clothing on with my photo | S | S3 | Quick look instant; HD render free within daily cap; non-clothing items hide Try on. |
| B-BY1 | As a buyer I want Buy to never dead-end | M | S1 | Reserve/Message sheet or outbound marketplace link. |
| B-OUT1 | As a buyer I want outbound "Buy on eBay/Poshmark…" links that work | M | S2 | Link to the live listing; affiliate tag where configured; hidden if listing delisted. |
| B-SV1 | As a buyer I want to save items and get price-drop alerts | C | S4 | Email alert. |

## Trust / SEO / AdSense
| ID | Story | MoSCoW | Sev | Acceptance |
|---|---|---|---|---|
| T-1 | As anyone I want no fake data anywhere | M | S1 | Audit: no placeholder charts, counts, reviews. |
| T-2 | As a buyer I want sold items marked/removed quickly | M | S2 | Sold → off /shop within 1 min. |
| T-3 | As Google I want indexable item/category pages with Product schema, canonical, sitemap | M | S2 | Rich-results test passes; sitemap includes active items only. |
| T-4 | As the business we want AdSense slots that don't break layout or CLS | S | S3 | CLS < 0.1; no ads in seller flow. |
| T-5 | Privacy/terms state the extension stores no marketplace passwords | M | S2 | Pages live; Chrome Web Store listing matches. |
| T-6 | Affiliate disclosure on outbound links | M | S3 | Visible disclosure. |

## Won't (now)
- Paid tiers, Stripe checkout, and native apps before the web flow passes.
