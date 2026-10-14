# fashionistas.ai — user stories (tested end to end)

Every story has a Playwright check in `e2e/stories.spec.js`, which runs against a preview at 412×915. Run it with:
`BASE=https://free-v2.fashionistas-ai.pages.dev node e2e/stories.spec.js`. It needs `.env.test-seller` (gitignored) and `playwright`.
Each run deletes the listing it creates. No invented listings are left in the public shop.

## Seller
| ID | Story | Acceptance |
|---|---|---|
| S1 | As a seller I sign in. | Login returns a session; the app opens signed in. |
| S2 | I snap or pick a photo, and AI fills in the listing. | Title, price, category and description are pre-filled from the photo and editable. |
| S3 | I tap **List on fashionistas** and it's live instantly, free. | The listing exists within a few seconds. No fee, no plan. Works even while the keyboard is open. |
| S4a | I see every marketplace for my item on one board. | `/seller/board/` lists fashionistas.ai plus 16 others: eBay, Etsy, Shopify, Poshmark, Mercari, Depop, Vinted, Grailed, FB Marketplace, Vestiaire (ex-Tradesy), Kidizen, Curtsy, Whatnot, Amazon, Walmart, ThredUp, The RealReal. |
| S4b | **Copy & open** copies my listing and opens that shop's new-listing page. | The clipboard has title/price/details/description; the shop opens in a new tab; the status becomes "copied". (eBay/Etsy/Shopify post via API once keys are set.) |
| S4c | I mark a shop **Listed** and paste its link. | The status becomes "listed"; buyers see **Buy on <shop> ↗** on my item page. |
| S5 | I mark it **Sold** on whichever shop sold it. | The item is sold everywhere on the board, removed from our shop, and the sale counts in stats. |

## Buyer
| ID | Story | Acceptance |
|---|---|---|
| B1 | I browse the shop without an account. | `/shop` shows real listings. |
| B2 | I search and sort. | Typing "jacket" filters results. |
| B3 | On an item I can Message the seller, Buy, Try it on, or Buy on another shop. | All the buttons are present; nothing is a dead end. |
| B4 | **Buy now** never dead-ends without card payments. | A sheet offers a free Reserve (no charge) + Message seller. |
| B5 | I try clothing on with my photo. | An instant free Quick look overlay appears; the HD render is optional (6/day free, identical renders served from cache at $0). |
