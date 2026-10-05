# Marketplace Risk Disclosure

**DRAFT — not legal advice, pending counsel review.**
**Draft date: 2026-10-05. Effective date: to be set by counsel.**

> Drafted by an engineer for review by a licensed lawyer. Bracketed items
> `[LIKE THIS]` are placeholders for counsel.
>
> **Read Section 0 before you read anything else.** It explains which numbers on
> this page we can stand behind and which we cannot.

---

## 0. How to read the numbers on this page

**Every fee figure in Sections 3–8 is an approximate model, not a quote.** They
come from the same static catalogue that powers our fee calculator, so the
calculator and this page cannot drift apart — but neither is connected to any
marketplace's live pricing. When a marketplace changes its fees, we may not know
until someone notices.

**The marketplace's own earnings screen is the only authoritative figure.** Check
it before you price anything.

**Where this page cannot back a number, it says so instead of guessing.** In
particular:

- **We publish no payout timing figures.** We do not know each marketplace's
  payout schedule and will not invent one. Check the payout schedule on the
  marketplace's own seller page — it varies by payment method, by country, and by
  whether an item has shipped, and platforms change it without notice.
- **We publish no claim about how likely a suspension is.** We cannot quantify
  another company's enforcement.
- **We publish nothing about any marketplace's internal detection systems**,
  because we do not know them and speculating would be dishonest.

We are not affiliated with, endorsed by, or sponsored by any marketplace named
here. Names are used descriptively, to identify which shop we mean.

**What fashionistas actually is:** a listing assistant. It prepares text and
images, and for most shops it fills in a form **in your own logged-in browser
session, where you press Post**. For most shops we hold no marketplace
credential at all — see [privacy.html Section 3.1](/legal/privacy.html).

---

## 1. The double-sale problem

This is the risk that costs sellers the most money, and it is **your** risk.

If you list the same physical item on several marketplaces, it is possible for a
buyer to purchase it on one of them while the listing is still live on the
others. That second buyer expects an item you no longer have.

**What fashionistas does about it:**

- A browser extension can watch your listings **in your own signed-in session**
  and report a sale to us. We record the sale in our database with the shop,
  listing reference, URL, title, price and date.
- On a recorded sale, our `/api/delist` route attempts to remove the item from
  the other shops. **The mechanism differs per shop and is not equally
  reliable** — each shop's section below says how its delisting works.

**What fashionistas does not do, and cannot do:**

- **We cannot know instantly that something sold.** Detection depends on the
  extension being installed, enabled, and running in a browser that is signed
  in to that shop. A closed laptop is a blind spot.
- **We cannot guarantee a delist succeeded.** We attempt it and record the
  attempt. A shop can refuse, fail, rate-limit, or silently ignore a request.
- **We cannot reach a buyer**, cancel an order, issue a refund, or reverse a
  payment. We are not a party to the sale.
- **We are not liable for a double sale.** You are the seller. You own the
  mistake, the refund, the negative feedback, and the cost of a buyer who gets
  the shock of a cancelled order.

**What we recommend:** delist the moment you accept an offer rather than waiting
for the order, and keep only one live listing per physical item where you can.

## 2. Account suspension: the general risk

**Most suspensions on these platforms are not caused by a bug in your
listings — they are caused by the *shape* of your activity.** Every marketplace
below prohibits posting or selling through unauthorised third-party tools, and
several expressly restrict automation. Account review typically looks at
behaviour, not content:

- many listings created or revised in a short window;
- the same photo, title, or price pattern repeated across many listings;
- a new or low-history account behaving like a high-volume shop;
- a sudden jump in listing volume relative to the account's history;
- activity from a network or device the account has never used;
- listings pointing buyers to another marketplace or off-platform payment.

**fashionistas is designed to stay on the right side of this line, and you are
responsible for keeping it there:**

- **We never ask for your marketplace password.** Our servers do not hold
  Poshmark, Mercari, Depop, Grailed, Facebook Marketplace or Whatnot
  credentials at all.
- **You press Post.** Nothing is published without your action, in your session.
- **Terms Section 6 forbids you** from using this product — or anything else — to
  automate sharing, relisting, following, unfollowing, offers, or any drip or
  mass-messaging campaign. Doing so is a breach of our Terms and a likely
  violation of the marketplace's.
- **We do not and cannot guarantee your account survives.** Each shop below says
  what our integration actually does, so you know where the automation boundary
  is.

**If you are suspended:** you will need to appeal with the marketplace directly.
We cannot lift a suspension, restore access, or recover funds held by a
marketplace.

---

## 3. Poshmark

**How our integration works.** Session-only, in your browser. No Poshmark
credential reaches our servers. The extension fills Poshmark's listing form and
**you tap Post.**

**Fees (approximate model).** A flat **$2.95** on sales under **$15**; **20%**
at **$15 and above**. Our model treats these as the two mutually exclusive tiers.
**This is an approximation — the actual charge is whatever Poshmark's own
earnings preview shows you at the time of the sale.**

**Payout timing.** We publish no figure. Poshmark's own seller payout schedule,
including any hold period, is the only source.

**Suspension risk.** Listing through a browser tool in your own session, with a
human press of Post, is the lowest-activity pattern we offer. Poshmark's risk to
you comes from **volume and repetition** — a burst of near-identical listings,
or a new account suddenly posting far more than its history. Anything that
automates reposting, sharing, or offers is outside what our Terms permit and is a
likely ToS breach.

**Delisting on sale.** **Session-only, and it depends on the extension running.**
We record the sale and queue a delist task in our database for your other shops;
a Poshmark listing is taken down by the extension acting in your signed-in
session. If the extension is not running, the listing stays up.

**Counterfeit and authenticity.** Poshmark prohibits counterfeit and replica
goods and removes listings and bans sellers who list them. A brand name in a
Poshmark title is a claim to the buyer. Generated description text is not
evidence — you must be able to stand behind every word.

**Buyer reclaim and chargeback.** A buyer who does not receive the item, or who
disputes payment through their bank rather than through Poshmark, loses their
money from Poshmark's perspective and the loss can land on you. Disputes raised
inside Poshmark's own system follow Poshmark's process. We have no involvement
and no ability to reverse anything.

**Changing without notice.** Poshmark can change its fee structure, its
prohibited-items list, its Community Guidelines, and its payout schedule at any
time. Read the current version before you rely on any figure here.

---

## 4. Mercari

**How our integration works.** Session-only, in your browser. No Mercari
credential reaches our servers. The extension fills Mercari's listing form and
**you tap Post.**

**Fees (approximate model).** A **10%** selling fee. **Approximate — confirm on
Mercari's own earnings screen.** Our model does not attempt to represent
Mercari's separate payment-processing charge, promotional-fee rules, or
category-specific pricing; treat the 10% as a planning figure, not a quote.

**Payout timing.** We publish no figure. See Mercari's own payout schedule;
terms of sale, identity checks and shipping status can all affect when money
reaches you.

**Suspension risk.** As with Poshmark, the risk is in volume and repetition
rather than in a single session-assisted listing. Mercari's own rules restrict
automated posting and scraping. Bulk-identical listings and rapid relisting are
the patterns most likely to draw review.

**Delisting on sale.** **Session-only, and it depends on the extension running.**
A Mercari listing is taken down by the extension in your signed-in session; we
record the sale and queue the attempt. If the extension is not running, the
listing stays up.

**Counterfeit and authenticity.** Mercari prohibits counterfeit goods and
unauthorised branded replicas, and penalises sellers who mislabel condition or
brand. Being accurate about condition is not optional — it is the single most
common source of buyer disputes on this platform.

**Buyer reclaim and chargeback.** Mercari's own payment-protection process
governs in-platform disputes, and a buyer who disputes through their bank
instead removes money from the platform's control and puts the loss on you. We
cannot see, contest, or appeal any of it.

**Changing without notice.** Mercari can change fees, payout timing and seller
rules at any time, including changing them with limited notice to sellers.

---

## 5. Depop

**How our integration works.** Session-only, in your browser. No Depop credential
reaches our servers. The extension fills Depop's product form and **you tap
Post.**

**Fees (approximate model).** **0% commission** — our model records that
Depop removed its commission in 2024 — plus **3.3%** payment processing and
**$0.45** per order. **Approximate — the authoritative figure is on Depop's own
seller screen.** This is a comparatively low-fee platform, so the shipping you
charge matters to your margin more than the fee does.

**Payout timing.** We publish no figure. Depop's payout timing is set by Depop and
depends on your payout method and on whether the order has been dispatched and
delivered.

**Suspension risk.** Depop enforces its Community Policy strictly and its
enforcement is not always first-warning-first. Activity that reads as automated —
high-volume listing churn, identical items, or listings edited repeatedly by a
tool — is the risk. Single-session, hand-pressed posting is the conservative
pattern.

**Delisting on sale.** **Session-only, and it depends on the extension running.**
A Depop listing is taken down by the extension in your signed-in session. If it
is not running, the listing stays live and a second buyer can buy the same
garment.

**Counterfeit and authenticity.** Depop prohibits counterfeit and replica items
and requires listing details to be accurate. Depop's standard is a
non-counterfeit item: a used garment you own, honestly described.

**Buyer reclaim and chargeback.** A buyer who disputes through their bank
instead of Depop's own process strips the dispute from Depop's control. We cannot
see the transaction, cannot represent you, and cannot reverse the payment. A
second sale of the same garment is exactly the fact pattern that produces these
disputes.

**Changing without notice.** Depop can change its fee structure, its Community
Policy and its payout terms at any time.

---

## 6. Grailed

**How our integration works.** Session-only, in your browser. No Grailed
credential reaches our servers. The extension fills Grailed's sell form and
**you tap Post.**

**Fees (approximate model).** **9% commission**, which our model records as
**6% under $120**, plus **3.49%** payment processing and **$0.49** per order.
**Approximate — confirm on Grailed's own earnings screen.** Note that our model
carries a single percentage and a single fixed amount; it does **not** itself
compute the reduced-commission tier. Verify the under-$120 rate directly.

**Payout timing.** We publish no figure. Grailed's payout schedule is Grailed's to
set and can depend on the item's authentication status.

**Counterfeit and authenticity — read this section twice.** **Grailed is the
most consequential of the six platforms on this page for counterfeiting**, and
it differs from the others in kind, not just in degree:

- Grailed's **entire premise is authenticated designer and luxury product**.
  Authentication is not a side condition of listing there — it is what the buyer
  is paying for. Claims of authenticity are the product.
- Grailed's seller standards for branded items are **specific and strict**, and
  the platform reserves the right to authenticate, seize, and remove items that
  fail. Failing authentication is not a small penalty; it can mean losing the
  item and the sale.
- A **counterfeit or replica listed as authentic is not a listing mistake — it
  is a serious breach of Grailed's terms and potentially unlawful.** It is also
  the highest-likelihood route to account suspension on any of these six shops.
- **Never let generated text carry an authenticity claim.** Our model produces a
  brand and a condition field; neither is evidence. You must be able to produce
  receipts, serial numbers, or provenance for a luxury item you list on Grailed.
- If you are unsure whether an item passes Grailed's authentication, **do not
  list it there.** List it somewhere authenticity is not the product.

**Delisting on sale.** **Session-only, and it depends on the extension running.**
A Grailed listing is taken down by the extension in your signed-in session. On a
luxury item the delist window matters most, because a fake sold to a second
buyer while your genuine item is gone is a claim against you with no defence.

**Suspension risk.** As elsewhere, the risk is in volume and repetition. On
Grailed specifically, **authenticity failure is the dominant suspension
trigger.**

**Buyer reclaim and chargeback.** Grailed may withhold or delay payout on an item
pending authentication. A buyer who disputes through their bank bypasses that
process entirely. We can do nothing about either.

**Changing without notice.** Grailed can change its fee structure, its
authentication standards, its prohibited-brands list and its payout terms at any
time. Authentication standards are tightened more often than fees are.

---

## 7. eBay

**How our integration works.** **Different from the other shops, and weaker than
you may expect.** For eBay there is a server-side path that calls eBay's own
developer API. To call an official API we must hold credentials you approved —
either an OAuth grant you gave on eBay's own consent screen (stored as a
refresh token) or, if you choose the bring-your-own-keys option, your own eBay
API `clientId`/`clientSecret` (see [privacy.html Section 3.1](/legal/privacy.html)).

**Two things to be clear about:**

1. **That path is wired to eBay's sandbox hosts only.** The integration
   references `https://api.sandbox.ebay.com` and `https://auth.sandbox.ebay.com`;
   eBay's production hosts are not used by this path. Treat it as a development
   integration and do not assume anything you see there will publish to your live
   storefront.
2. **The shipped posting route does not publish live, but the underlying code
   can be asked to.** The route creates an inventory item and an offer; the
   offer is published to eBay only when an explicit `publish` flag is passed, and
   if publication fails the code tells you to publish manually in Seller Hub
   instead. The capability flag at `/api/marketplaces` means *code for this path
   exists* — read every such flag as **"the code exists," never "a listing
   shipped."**

**Fees (approximate model).** A **13.6%** final value fee plus **$0.40** per
order. **Approximate.** eBay's actual fee varies by **category and by the region
of the sale**, and eBay publishes a store- and category-specific table. Our flat
13.6% is a planning figure for a US seller in a typical category — **not** your
category's rate.

**Payout timing.** We publish no figure. eBay holds funds until its own release
conditions are met and then pays out on a schedule set by eBay and your payout
method.

**Suspension risk.** eBay's position on third-party listing tools is stricter
than most, and using a tool to post without the account owner's own action is
the kind of thing that produces "final notice" suspensions. Our Terms require
that **you** act, in **your** session. Any eBay API credential must be one you
granted for your own account and must not be shared or reused across accounts.

**Delisting on sale.** **The most reliable of the six.** A recorded sale triggers
a `Sell Inventory` withdraw for offers, or a quantity of zero for an inventory
item, called server-side. No browser extension needs to be running. It is still
an *attempt*: eBay can reject it, and you should confirm the item is down.

**Counterfeit and authenticity.** eBay's authenticity programme and its
prohibited-items policy are enforced strictly, including on items it
authenticates for you — and authentication can be declined. Selling counterfeit
goods on eBay carries liability well beyond account suspension.

**Buyer reclaim and chargeback.** eBay has its own dispute flows for
unpaid-item, item-not-received and returns cases, and those normally run through
eBay. **A chargeback raised at the buyer's bank instead skips that process
entirely.** We are not eBay, we are not your payment processor, and we cannot
contest, represent you in, or reverse any of it. Undisputed funds held by eBay
that are released to you and then clawed back are a loss you carry.

**Changing without notice.** eBay changes final value fees and store/category
tables — including in the middle of a calendar quarter for some sellers — and
changes its seller policies at any time.

---

## 8. Etsy

**How our integration works.** Like eBay, there is a server-side path using
Etsy's official API, and it therefore requires an OAuth token you granted on
Etsy's own authorization screen. We store it so we can act on your listings
(see [privacy.html Section 3.1](/legal/privacy.html)).

**The shipped posting route creates a draft, not a live listing.** A draft still
has to be reviewed and published by you in Etsy. To be precise, because the
distinction matters: the route always creates the listing as a draft and never
passes an activation flag, but the underlying Etsy module does contain the
ability to set a listing `ACTIVE` when a caller explicitly asks for it. So
"fashionistas cannot publish on Etsy" is **not** a safe claim — the accurate
claim is that **the route as shipped drafts only, and the final act of
publishing is yours.** Read the capability flag at `/api/marketplaces` as
**"the code exists," never "a listing shipped."**

**Fees (approximate model).** **6.5%** transaction fee plus **roughly 3%**
payment processing plus **$0.25** per order. **Approximate, and approximate in
two directions:** our model represents Etsy's processing fee as a rounded
percentage rather than the exact charged figure, and Etsy's real fee structure
depends on your shop's location, your currency, and any ads or offsite-ads you
run. The authoritative figure is on Etsy's own seller dashboard.

**Payout timing.** We publish no figure. Etsy pays out on its own schedule and
reserves the right to hold funds while a transaction is open or disputed.

**Suspension risk.** Etsy's rules restrict automation, and Etsy can act against
an account for behaviour it judges to be automated or for other conduct. As
everywhere else, volume and repetition are the shape of activity that draws
review. Because the Etsy path creates a draft, the final act of publishing stays
with you.

**Delisting on sale.** **Server-side and reasonably reliable.** A recorded sale
sets the Etsy's listing state to `INACTIVE` through its API, with a delete as a
fallback. It does not need a running browser extension. As with eBay, it is an
attempt, not a guarantee — confirm the listing is down.

**Counterfeit and authenticity.** Etsy prohibits counterfeit and replica goods
and prohibits reselling items you did not make or did not source lawfully. Etsy
may also restrict categories and require additional information for some branded
items. If you did not make the item and cannot document how you sourced it, do
not list it on Etsy.

**Buyer reclaim and chargeback.** Etsy has its own case system for non-delivery,
not-as-described and refunds. A buyer who disputes through their bank instead
bypasses it. Etsy can also reverse a payout to a seller, and a bank chargeback
can arrive after Etsy has already paid you. We are not a party to either and can
do nothing about either.

**Changing without notice.** Etsy changes transaction fees, processing fees and
its fee schedule on a published annual cycle — and reserves the right to change
them at other times — as well as its shop policies and category restrictions at
any time.

---

## 9. What we are not liable for

Summarising the Terms [Section 12](/legal/terms.html), and stated here plainly
because it is where the money is: **we are not liable for** your marketplace
account being suspended, restricted or banned; fees or penalties a marketplace
assesses; a marketplace delaying or failing to pay you; a chargeback, buyer
reclaim or refund you are forced to reverse; a buyer claiming an item was not as
described or not authentic; a double sale; lost profit or lost sales; or the
difference between your asking price and the price an item actually fetches.

Our aggregate liability is capped at what you actually paid us in the twelve
months before the event giving rise to the claim, and we are not liable for
indirect or consequential loss at all.

## 10. The one-paragraph version

**You own the item, the listing, the accuracy of the description, the account,
the tax, the shipping, and the consequences of a double sale. We help you write
the listing and press the button; you take the risk of everything that happens
after the button.** Check each marketplace's own fee and payout screens — the
numbers on this page are planning figures, and the platforms' are the truth.

---

### Drafting notes for counsel — not part of the Disclosure

1. **The biggest exposure on this page is Grailed Section 6** — authenticity of
   luxury goods is a materially different legal and reputational risk from
   ordinary resale, and counsel should consider whether Grailed needs its own
   separate consent step or an in-product warning before a user lists there.
2. **Sections 3–5 and 6 (Depop, Grailed) have no server-side delist.** Any
   warranty-like assurance about "never double-sell" elsewhere in the marketing
   is not supportable for those shops. Counsel should check that the marketing
   copy in `index.html` and `pricing/index.html` does not promise more than
   Section 1 here.
3. **eBay's path targets a sandbox host and Etsy's creates a draft.** Neither
   section may describe a live automated listing, and both say so — that wording
   is deliberate and should survive review.
4. **Payout timing is deliberately absent** from every section. If the business
   wants to add payout timings, each one needs a source and a review date; an
   unsourced payout estimate in a legal document is worse than silence.
5. **Counterfeit liability is a genuine criminal/civil exposure** in several
   jurisdictions and is not well covered by the Terms' liability cap. Counsel
   should consider a specific and prominent counterfeit warning, and whether
   Section 6 of the Terms (acceptable use) is prominent enough where the user
   actually sees it — the app, not the Terms.