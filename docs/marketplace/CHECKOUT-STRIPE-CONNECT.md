# On-site checkout — zero-monthly-fee option (NOT built; needs Iz's go-ahead)

**Recommendation: Stripe Connect, "Stripe handles pricing" (Standard-style connected accounts, direct charges).**
Source: stripe.com/connect/pricing (checked 2026-10-14).
- Platform cost: **$0/month.** No account, payout, per-payout or 1099 fees for the platform.
- Sellers pay Stripe's normal processing fee on each sale: **from 2.9% + 30¢** per US card charge (Stripe bills the seller directly). Stripe covers loss liability on direct charges.
- fashionistas.ai can keep checkout free (application_fee = 0) or later add a small application fee.
- The alternative ("you handle pricing", Express/Custom) costs **$2 per monthly active account + 0.25% + 25¢ per payout** — not free; avoid for now.

## What's required
1. Iz: Stripe account for the platform (business details, bank, EIN or SSN as sole prop), enable Connect, set branding, accept Connect platform agreement.
2. Keys to add as Pages secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID` (if OAuth) — test mode first.
3. Build (after approval): seller onboarding (Account Links), "Buy" → Checkout Session as a direct charge on the seller's account, webhook marks listing sold + writes `orders` (feeds the seller stats), shipping label (Shippo/EasyPost, separate), buyer/seller emails, refund/dispute policy page, Terms update (marketplace facilitator, prohibited items).
4. Sales tax: in many US states the marketplace (not the seller) must collect sales tax once over thresholds — get an accountant's view before launch; Stripe Tax is 0.5%/txn if used.
5. Seller KYC is handled by Stripe onboarding.
