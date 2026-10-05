# Terms of Service

**DRAFT — not legal advice, pending counsel review.**
**Draft date: 2026-10-05. Effective date: to be set by counsel.**

> This document was drafted by an engineer for review by a licensed lawyer. It has
> not been reviewed by counsel. Bracketed items `[LIKE THIS]` are placeholders that
> only counsel can fill in. Do not publish this page as binding terms until counsel
> signs off.

---

## 1. Who we are

fashionistas.ai ("fashionistas", "we", "us") is a software tool operated by
`[LEGAL ENTITY NAME]`, a `[ENTITY TYPE]` organised under the laws of
`[JURISDICTION]`, with a registered address at `[ADDRESS]`.

You can reach us at [fashionistas1979@gmail.com](mailto:fashionistas1979@gmail.com).

These Terms are a binding agreement between you and `fashionistas`. If you do not
agree with them, do not use the service. If you use the service on behalf of a
business, you promise us that you have authority to bind that business, and
"you" then means that business.

## 2. What we are not: we are not a marketplace

**We are not a marketplace, an auction house, a broker, a payments processor, or
a party to any sale of goods.** We do not buy anything. We do not sell anything.
We do not take title to, custody, or possession of any item. We do not act as
your agent, broker, or consignee.

Every sale you make happens between you and the buyer, on a marketplace that is
operated by a third party. The contract for that sale is between you and that
marketplace and that buyer. We are not a party to it and we receive no
commission on your sales.

Your relationship with each marketplace is governed by that marketplace's own
terms, which you accept directly with them. Where this document and a
marketplace's terms conflict, the marketplace's terms govern your relationship
with that marketplace.

## 3. Your content is yours

**You own everything you make and everything you bring.** "Your Content" means
the photos you upload, the item names, descriptions, prices, tags, hashtags,
condition notes, size and brand fields you enter or generate, the AI renders we
produce from your photos, and your account information.

You keep all right, title and interest in Your Content. We claim **no
ownership** of it and we do not claim any licence to sell it or to train a model
on it. We ask only for the narrow, revocable permission needed to run the
service: to store your Content, to process it (including sending it to our
infrastructure and AI sub-processor to generate a render or listing draft), and
to display it back to you. That permission ends when you delete the Content or
close your account.

You are responsible for having the right to upload what you upload. If a photo
of a garment was taken by someone else, or shows a person who has not consented,
uploading it may infringe someone else's rights or break a marketplace's rules.
Uploading is your decision and your responsibility.

## 4. Your marketplace accounts are yours

You keep sole ownership and control of your accounts with Poshmark, Mercari,
Depop, Grailed, eBay, Etsy and every other shop. You are solely responsible for:

- registering, securing and closing those accounts;
- obeying each marketplace's terms, community rules, and acceptable-use policy;
- the accuracy and legality of everything you list (title, photos, description,
  condition, price, shipping, and any authenticity claim you make);
- your own tax reporting, income records, and any sales tax or VAT you owe;
- responding to buyers, handling shipping, refunds, and disputes;
- **not double-selling an item** and not selling the same physical item twice.

**fashionistas is not responsible for what happens on your marketplace account.**
We do not control it, cannot see into it, cannot reverse its decisions, and
cannot restore a suspended account. If a marketplace suspends you, restricts your
listings, holds your funds, or bans you, that is a dispute between you and that
marketplace. See [risk.html](/legal/risk.html) for what we can and cannot do
about it.

We may ask you for a refund of any amount we collected while you were
circumventing a marketplace's rules.

## 5. Acceptable use

You agree not to use fashionistas to do any of the following.

1. **Sell anything unlawful or prohibited.** Counterfeit or replica goods,
   stolen property, recalled items, items you do not own, items restricted by
   sanctions or export control, items misrepresented as authentic, and anything
   else a marketplace or the law forbids.
2. **Misrepresent an item.** Any condition, brand, or authenticity statement in
   a listing must be true and yours. Never let generated text stand in for your
   own knowledge.
3. **Infringe anyone's rights,** including copyright in photographs, trademark in
   brand names, and the rights of anyone whose face or body appears in a
   try-on render.
4. **Upload unlawful or abusive content,** including sexual content involving
   minors, content that harasses a person or group, or content that promotes
   violence or self-harm.
5. **Impersonate anyone** or misrepresent the origin of an item.
6. **Attack the service:** probe, scan, overload, or attempt to gain unauthorised
   access to it, or circumvent rate, quota, or plan limits.
7. **Reverse engineer, resell, or redistribute the service** as a competing
   product, or scrape it to build a competing dataset.
8. **Use the service to build a competing posting tool** or to power a product
   that lists to marketplaces on another person's behalf.
9. **Spam or harass** a buyer, a seller, or a marketplace.
10. **Circumvent a marketplace's access limits** — for example, evading a
    marketplace's block on third-party posting tools.

You are responsible for how you use the output. We are not obliged to monitor
your listings, and we do not screen them for you.

## 6. No automation: you press Post, every time

**This is the most important rule on this page.**

For most shops, fashionistas does not publish anything by itself. The service
**prepares** a listing for you — a title, a description, a suggested price, a
fee estimate, and images — and hands it to a browser extension that runs **in
your own browser, inside your own already-logged-in marketplace session**.

- fashionistas **never** asks for, and you must **never** give it, your
  marketplace password. Our servers never receive your marketplace credentials.
- The listing is only ever published **in your session, when you tap Post** (or
  the equivalent button in the extension).
- You review the final text, price and images before it is submitted. Nothing
  goes live without your action.

**You must not** use fashionistas, or any part of it, to automate any of the
following against any marketplace:

- sharing, re-sharing, or reposting a listing;
- relisting, or renewing a listing on a timer;
- following, unfollowing, or any follower action;
- sending, accepting, declining, or countering offers;
- mass messaging, mass following, or any drip campaign;
- scraping a marketplace, or calling a marketplace's API in a way its terms
  prohibit.

Doing any of the above can get a seller suspended and is a breach of this
Agreement. We may suspend or terminate your account and refund nothing.

Two shops are handled differently, and even then the service does less than you
might think:

- **eBay** — the server-side path talks to eBay's developer API in a
  development/sandbox mode.
- **Etsy** — the server-side path creates a **draft**, not a live listing.

Read `/api/marketplaces` for the per-shop capability flag. Treat every
`autoPost: true` in that catalogue as **"code for this path exists"**, never as
**"a listing was published."**

## 7. Plans, billing and cancellation

### 7.1 Free plan

The free plan includes, per calendar month (UTC):

| Limit | Free plan per month |
| --- | --- |
| Listings created | 10 |
| AI photos | 3 |
| Stylist messages | 10 |

Counters reset on the **first day of each calendar month, UTC** — not on the day
you signed up. When you hit a limit the service tells you what you used, what
the cap is, and the exact instant it resets.

### 7.2 Pro plan

**Pro costs $14.99 per month**, billed monthly in advance through Stripe. Pro
raises or removes the free-tier caps (unlimited listings, and a higher AI-photo
and message allowance). The plan does not include any marketplace fees — those
are charged to you by each marketplace, separately.

### 7.3 Cancellation

You may cancel at any time from your account, and we link to Stripe's customer
portal for exactly that reason. There is no cancellation fee.

If you cancel, your Pro access continues to the end of the period you have
already paid for, and then stops. We do not pro-rate partial months back to you.
After your Pro access ends you drop to the free plan and its caps.

We may change the price of Pro. We will tell you before a price change takes
effect on a renewal. We will never raise the price mid-period you have already
paid for.

### 7.4 Payment and renewal

Stripe processes the payment; we never see or store your card number. The
subscription renews monthly until you cancel. If a renewal payment fails we may
suspend paid features until it succeeds.

### 7.5 Taxes

Fees are exclusive of any sales tax, VAT, GST or similar charge, which you are
responsible for. If we are required to collect any such charge we will add it
at checkout and we may ask for the information needed to comply with tax law.

### 7.6 Refunds

Because you can cancel any time and keep access to the end of the paid period,
monthly subscriptions that have been used are generally **not refundable**.
Where the law requires a refund, we will give it. If we materially break this
Agreement, we will refund the affected period.

If you delete your account before the end of a paid period, unused prepaid
months are not refunded.

## 8. AI output is not a fact

Item identification, descriptions, condition notes, and suggested prices are
produced by a machine. They can be **wrong**. A render does not prove an item is
authentic, does not prove its condition, and does not guarantee the colour or
fit matches the real garment.

**You must read and correct every AI-generated field before you publish it.**
You are the person asserting the condition and authenticity of the item, and you
alone are responsible for that assertion. Never rely on our output as your only
basis for an authenticity claim.

## 9. Fees, estimates and take-home figures

fashionistas shows a take-home estimate for each shop. **Those numbers are an
approximate model we publish, not a live quote from any platform.** They change
when a marketplace changes its own pricing, and we may not notice the same day.

Your actual fee is whatever the marketplace charges, calculated on the terms in
force at the time of the sale. **The marketplace's own earnings screen is the
authoritative figure.** See [risk.html](/legal/risk.html) for the per-shop detail
we can and cannot stand behind.

## 10. Your warranty of the work

You promise that each listing you publish: accurately describes the item;
matches the photographs; is not counterfeit or stolen; carries no condition
defect you have concealed; and complies with every applicable law and every
marketplace rule. You promise this to the buyer and to the marketplace. We are
not a party to that promise and do not make it for you.

## 11. Disclaimers

To the maximum extent the law allows, and except as expressly stated here:

- **the service is provided "as is" and "as available"**, with no warranty of
  merchantability, fitness for a particular purpose, non-infringement,
  accuracy, or uninterrupted availability;
- **we give no warranty that the service will be error-free, or that any listing
  will sell, or that the fee estimates will match the marketplace's actual
  charge**;
- **we give no warranty about marketplace eligibility**, including that a
  marketplace will accept the item, will not suspend your account, or will not
  restrict your listings;
- **we give no guarantee about the marketplace accounts or payments** described
  in Section 4;
- we may change, suspend, or discontinue any feature, and may impose limits on
  volume or rate to protect the service and other users.

Nothing in this Agreement excludes a warranty or right that cannot lawfully be
excluded, and nothing excludes our liability for death or personal injury
caused by negligence, or for fraud or fraudulent misrepresentation.

## 12. Limitation of liability

**To the fullest extent permitted by law, we are not liable for your use of a
marketplace, and in particular we are not liable for:**

- any suspension, restriction, ban, or termination of your marketplace account;
- any fee, charge, penalty, or commission a marketplace assesses;
- any delay or failure of a marketplace to pay you out;
- any chargeback, buyer reclaim, refund demand, or payment you are forced to
  reverse;
- a buyer claiming the item was not as described, or not authentic;
- lost profit, lost sales, lost opportunity, or loss of goodwill;
- the market value of your item, or any difference between your asking price and
  the price it actually sells for;
- content of any kind that you publish, or any marketplace's reaction to it.

**In no event is our total liability to you, for all claims in any twelve-month
period, greater than the amount you actually paid us in the twelve months before
the event giving rise to the claim** — and **in no event shall we be liable for
indirect or consequential loss, or for loss of profit, revenue or anticipated
savings, even if we were told it was possible.**

These limits apply even if a warranty failed, even if we were negligent, and
even if the claim is framed some other way.

## 13. Term, suspension and termination

These Terms apply while you use the service. You may stop at any time and close
your account; closing your account ends your subscription going forward.

We may suspend or close an account, and may refuse service, if you breach this
Agreement — in particular if you break the no-automation rule in Section 6, sell
counterfeit or stolen goods, or infringe anyone's rights. Where the law allows,
we will tell you why. We may also act where a marketplace, a payment provider,
or a law enforcement body requires it.

On termination your right to use the service stops. Your Content remains yours.
`[COUNSEL: state how long we retain Content after account closure and what
happens to backups.]`

## 14. Changes to these Terms

We may update these Terms. The version on this page is the one that applies.
Where a change is material, we will give you notice `[COUNSEL: choose the
mechanism — in-app banner and/or email]`. Continuing to use the service after
that notice means you accept the change; if you do not accept it, you can cancel
and receive `[COUNSEL: state whether a pro-rata refund applies to the change]`.

## 15. Third-party services

The service links to, and depends on, third parties including Cloudflare (hosting
and databases), Stripe (payments), RunPod (virtual try-on rendering) and the
marketplaces themselves. Their own terms govern your use of them, and their
availability is outside our control.

## 16. Indemnity

You agree to indemnify and hold us harmless from any claim, demand, loss or
expense (including reasonable legal fees) arising out of your Content, your use of
the service in breach of this Agreement, your breach of a marketplace's terms,
your sale of any item, or your infringement of anyone's rights. `[COUNSEL: this
clause needs review for enforceability and for any applicable cap.]`

## 17. Independent contractors and no agency

Nothing in this Agreement makes either party an agent, employee, partner,
franchisee or joint venturer of the other. You are not our agent, and we are not
your agent.

## 18. Governing law and disputes

**`[COUNSEL: GOVERNING LAW PLACEHOLDER]`** governs this Agreement, without regard
to its conflict-of-laws rules. `[COUNSEL: FORUM / VENUE PLACEHOLDER]`.

`[COUNSEL: decide whether to require arbitration, and if so which rules, whether
it is opt-in or mandatory, and the carve-outs (small claims, injunctive relief,
unlawful conduct). Class-action and liability-limiting clauses in consumer
agreements are unenforceable in some jurisdictions, including under the Magnuson-
Moss Warranty Act (US) and the Consumer Rights Act 2015 (UK). This must be
checked, not assumed.]`

Nothing in this Agreement removes any right to bring proceedings in the court of
a place you have a right to use.

## 19. Notices

Notices to us: [fashionistas1979@gmail.com](mailto:fashionistas1979@gmail.com).
Notices to you: the email address on your account. `[COUNSEL: confirm the notice
addresses and whether a separate formal notice address is required.]`

## 20. General

- **Assignment.** We may assign this Agreement on notice. You may not assign it
  without our written consent.
- **Entire agreement.** These Terms and the Privacy Policy are the whole
  agreement and replace anything earlier.
- **No waiver.** A failure to enforce is not a waiver.
- **Severability.** If a provision is unenforceable it will be limited to the
  minimum extent necessary and the rest survives.
- **Headings** are for convenience only.
- **Survival.** Sections 2, 3, 4, 10, 11, 12, 15, 16 and 18 survive termination.

---

### Drafting notes for counsel — not part of the Terms

1. **Section 7.2 states $14.99/month.** This is the price the codebase enforces
   (`functions/api/billing/checkout.js`, `PRO_UNIT_AMOUNT = 1499` cents) and the
   price shown site-wide. If the business intends a different price, that number
   must be changed in the code and the marketing copy together, not here alone.
2. **Section 6 and Section 4 are the load-bearing clauses.** The whole product
   premise is that the seller presses Post in their own session. If that changes,
   Sections 4, 6, 12 and the risk page must all be rewritten.
3. **Section 12's liability cap is an aggregate over twelve months.** Check it
   against the mandatory consumer guarantees in every jurisdiction you sell into.
4. **Section 16's indemnity is unidirectional** (you indemnify us only). Counsel
   may want a mutual form.
5. The seller's own risk disclosure lives at [risk.html](/legal/risk.html), and
   the Privacy Policy at [privacy.html](/legal/privacy.html).