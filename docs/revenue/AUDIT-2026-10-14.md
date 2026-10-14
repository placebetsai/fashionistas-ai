# Revenue audit — 2026-10-14 (all four sites; money = ads + affiliates only; sites stay free)

Method: live curl of each homepage/ads.txt/robots/sitemap; Playwright (Pixel UA, box datacenter IP) scrolled each page 10s and read `ins.adsbygoogle[data-ad-status]`; Bing `site:` estimate (Google site: not reachable from the box). AdSense approval and Search Console can only be confirmed in Iz's dashboards.

| | fashionistas.ai | placebets.ai | marketpicks.ai | ihatecollege.com |
|---|---|---|---|---|
| AdSense loader | yes, ca-pub-7215975042937417 | yes, same pub | yes (injected by JS) | yes, same pub |
| ads.txt | 200, pub-7215975042937417 DIRECT | 200 | 200 | 200 |
| Slots on page | 4 (home), 2 (blog) | 5 (4 never rendered, 1 unfilled) | 2 | 4 (3 unfilled, 1 not rendered) |
| Slots filled | 0 — all `unfilled` | 0 | 0 | 0 |
| Sitemap URLs | 40 | 99 | 143 + 2,149 (/congress) | 6,460 (44 static, 205 blog, 6,211 colleges) |
| Bing site: estimate | 0 results | ~11,100 | 91 | 50 |
| Privacy/About/Contact | yes | yes | yes | yes |
| Affiliate links live | none | none | none | none (has /affiliate-disclosure page) |
| Grade | **C** | **C+** | **C** | **B-** |

"Unfilled" everywhere with one shared pub id usually means the domain is not yet "Ready" in AdSense → Sites, or (less likely) low fill to a datacenter IP. Iz must check AdSense → Sites for each domain.

## Top AdSense rejection risks
- fashionistas.ai: thin content — only 4 real active listings (1 seller); 22 blog posts + 9 guides are the real content. Low/zero index (Bing 0) → "site not indexed / low value".
- placebets.ai: gambling. AdSense allows gambling *content* but restricts gambling *promotion*; pages that push bets/sportsbooks must show 21+ / responsible-gambling notices (present: "1-800-GAMBLER") and must not target users where it's illegal. Adding sportsbook affiliate links increases ad-policy scrutiny; keep them geo-gated to licensed states.
- marketpicks.ai: YMYL finance — AI "picks" need prominent not-financial-advice disclaimers, author/methodology pages, and no fabricated data (open item: /api/health fabricates last_success).
- ihatecollege.com: 6,211 programmatic college pages = "scaled content abuse" risk if pages are templated with little unique data; YMYL (loans/education). Index only pages with real data; noindex thin ones.

## Affiliate programs (real signup pages, checked 2026-10-14)
- Fashion (fashionistas.ai): eBay Partner Network https://partnernetwork.ebay.com/ · Amazon Associates https://affiliate-program.amazon.com/ · ShopMy https://shopmy.us/ · LTK https://company.shopltk.com/ · Rakuten Advertising (publishers) https://rakutenadvertising.com/publishers/ · Awin https://www.awin.com/us/publishers
- Sportsbooks (placebets.ai): FanDuel https://affiliates.fanduel.com/registration.asp · BetMGM https://www.betmgmpartners.com/ · Caesars https://www.caesarsaffiliates.com/ · DraftKings (application via its affiliate team / Income Access). **Licensing:** operators only accept traffic from states where they're licensed; many states require affiliate vendor registration (e.g. NJ DGE vendor registration — CPA needs operator sponsorship; revenue share needs an Ancillary CSIE license; Colorado vendor-major license $1,200 + $10,000 background deposit). Geo-gate links by state; start CPA-only in states with simple registration.
- Brokers (marketpicks.ai): Robinhood https://affiliates.robinhood.com/ (Impact) · Webull https://act.webullapp.com/mktb/partners/individual (needs a Webull account) · Public.com (Everflow; apply via Public's partner team — no verified public URL found). FINRA/SEC: label as paid relationships; no performance promises.
- Students (ihatecollege.com): Credible https://www.credible.com/partners · SoFi (Impact marketplace, program 11190) https://impact.com/ · Coursera https://www.coursera.org/about/affiliates · edX https://www.edx.org/affiliate-program · scholarships: Fastweb/Scholarships.com (sponsorship/partner contact).

## fashionistas.ai — built today (preview `revenue` branch)
- `functions/_lib/affiliate.js`: eBay links get EPN params when `EPN_CAMPID` (10 digits) is set; amazon.com links get `tag=` when `AMAZON_TAG` is set. Off until Iz sets them (`wrangler pages secret put EPN_CAMPID` / `AMAZON_TAG`). Only "Buy on <shop>" links the seller confirmed; destination unchanged; `rel="sponsored"`; disclosure "(fashionistas.ai may earn a commission — it's free for you)" appears only when a link is tagged.

## fashionistas.ai — programmatic SEO plan (from real data only)
Reality: 4 active listings from 1 seller (brands: Versace, Keurig, 2 unbranded; categories Men/T-Shirts, Men/Coats & Jackets, Women/Bags & Handbags). Listing-driven pages would be thin today, so:
1. Gate: auto-create `/shop/brand/<brand>/` and `/shop/c/<category>/` pages only when ≥5 active real listings match; else 404/noindex. Generated from D1 at request time; in sitemap only when over threshold.
2. Now: grow evergreen hubs from the 22 posts + 9 marketplace guides: "How to sell <brand> secondhand" for the brands already covered in /blog/best-brands-to-resell (internal links to guides and to the shop filter), fee calculators per marketplace (real published fee tables, cited), size-conversion pages (already exist) → interlink.
3. Every outbound marketplace mention links through the affiliate wrapper when that program exists (eBay/Amazon now; ShopMy/LTK for brand pages after approval).
4. Measure in Search Console: submit sitemap, watch impressions per hub; prune pages with 0 impressions after 90 days.
