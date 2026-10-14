# Fashionistas.ai — UX research synthesis (2026-10-14)

Sources are public pages only. Quotes are verbatim excerpts from those pages, and nothing is invented. Where a source gives no number, this doc doesn't give one either.

## Top 10 findings → what we do
| # | Finding | Evidence | Implication for us |
|---|---|---|---|
| 1 | Delisting after a sale is the #1 failure of crosslisters, because double-sells mean canceled orders and account defects | r/reselling "the biggest issue is the delisting… risk double-selling" https://www.reddit.com/r/reselling/comments/1rkszog/ ; r/reselling delist-only tool thread https://www.reddit.com/r/reselling/comments/1uryf4v/ ; Trustpilot "Their one single job is to detect sales and delist items. The software FAILS" https://www.trustpilot.com/review/vendoo.co | Sale detection + delist everywhere is a MUST. It needs a visible per-marketplace delist log with timestamps. |
| 2 | Sellers want no passwords, API keys or tokens. The extension works through their own logged-in sessions, and they review before publishing | List Perfectly: "will never ask for… API keys, Access tokens" https://listperfectly.com/selling/why-list-perfectly-is-the-safest-tool-for-sellers/ ; https://listperfectly.com/selling/what-is-a-google-chrome-extension/ | Kill the key-paste connect UI. Connect = install the extension, then detect logged-in sessions, with a "Log in" button per site. |
| 3 | Sessions drop, so tools need a connection status monitor and a one-click reconnect | LP Auto Delist: "Check Connection Wizard… red dot… Reconnection Wizard" https://listperfectly.com/selling/list-perfectlys-auto-delist/ | Connection health chips (green/red) plus a Reconnect action on the dashboard. |
| 4 | Marketplaces have different required fields. Imports leave gaps, and sellers hate fixing each one by hand | r/reselling Crosslist thread https://www.reddit.com/r/reselling/comments/1wdvqzx/ | A per-marketplace "missing fields" checklist before posting. AI fills the gaps but marks them for review. |
| 5 | AI autofill that silently overwrites or invents details destroys trust | r/Depop "I can put the item as XL… it changes it to size small" https://www.reddit.com/r/Depop/comments/1utk0oc/ | AI never overwrites seller-entered fields. Every AI field is labeled and needs one tap to accept. |
| 6 | Show confidence only when it's meaningful. A single high % breeds overtrust, so pair low confidence with a prompt to verify | NN/g AI hallucinations https://www.nngroup.com/articles/ai-hallucinations/ ; Google PAIR https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/ | Drop "80% sure, filled in for you". Show top-3 category choices and leave low-confidence fields empty with a "Pick one" prompt. |
| 7 | AI or edited images can get listings removed or accounts restricted (Vinted) | r/vinted https://www.reddit.com/r/vinted/comments/1tu1f3t/ ; r/Flipping Vendoo/Vinted https://www.reddit.com/r/Flipping/comments/1rsoi5g/ | Background clean is opt-in and non-destructive, keeps the original, shows a before/after preview, and is off by default for Vinted. |
| 8 | Phone-first sellers abandon tools that need a desktop or are slow on mobile; web/app sync breaks | r/reselling Vendoo starter thread https://www.reddit.com/r/reselling/comments/1rvh1y4/ ; Vendoo App Store reviews https://apps.apple.com/us/app/vendoo-a-sellers-best-friend/id1612168777?see-all=reviews | Create and edit the full listing on the phone, and push to the desktop extension to post. Same state everywhere. |
| 9 | Paywalled basics (bulk delist/relist, more marketplaces) generate anger | r/poshmark https://www.reddit.com/r/poshmark/comments/1sf3vgh/ ; r/reselling https://www.reddit.com/r/reselling/comments/1rvh1y4/ | Our edge: all free (ads and affiliates fund it). Say so loudly in onboarding. |
| 10 | Empty states must explain what will appear and how to fill it. Never fake data | NN/g empty states https://www.nngroup.com/articles/empty-state-interface-design/ | $0 dashboard: no rising line. Show "No sales yet → list your first item" plus a CTA. |

## Buyer side (Baymard)
- Mobile filters belong in a drawer with an explicit "Show X results" apply button; applied filters show as removable chips. https://baymard.com/blog/ecommerce-filter-ui , https://baymard.com/research-articles/how-to-design-applied-filters
- Allow multiple values per filter. 15% of sites don't, and that leads to abandonment. https://baymard.com/research-articles/allow-applying-of-multiple-filter-values
- Essential filters are price, color, size and brand (ratings are N/A for resale). "80% of users applied Price filters" on mobile. https://baymard.com/research-articles/5-essential-filters
- Provide a filter for every attribute shown on list cards (38% of sites don't). https://baymard.com/research-articles/have-filters-for-list-item-info

## Gaps / not yet researched
- App Store reviews for Depop, Vinted, Poshmark and Mercari haven't been read individually yet, and the Mercari review page was only indexed (https://apps.apple.com/us/app/mercari-buying-selling-app/id896130944?see-all=reviews). Next research pass: payouts and offers complaints.
- No user interviews yet. Recommendation: have 5 real resellers do the Sprint 1 preview (r/Flipping recruit).
