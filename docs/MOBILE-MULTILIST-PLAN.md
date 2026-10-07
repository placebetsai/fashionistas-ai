# Mobile multilist plan — iOS/Android, zero downloads

Status: PLAN ONLY (2026-10-07). No code shipped for this yet. Related: [MULTILIST-ONE-CLICK.md](MULTILIST-ONE-CLICK.md), [EBAY_OAUTH.md](EBAY_OAUTH.md), [AGENT_HANDOFF.md](AGENT_HANDOFF.md).

## Goal
A phone seller snaps a photo → AI fills the listing → taps **Sell everywhere** once. They never install an extension or download anything. They **Connect once per shop**, then forget about it.

## Tier 1 — official APIs (server-side posting)
| Shop | API | Auth | Notes |
|---|---|---|---|
| eBay | Sell APIs (Inventory API → offer → publish) | OAuth 2.0 user consent, refresh tokens stored server-side | Needs eBay production keyset + business policies (payment/return/fulfillment) per seller. See EBAY_OAUTH.md. |
| Etsy | Open API v3 (`createDraftListing`, image upload, publish) | OAuth 2.0 + PKCE | Needs approved Etsy app key; Etsy charges listing fees to the seller. |

Flow: user taps **Connect eBay/Etsy** → system browser (ASWebAuthenticationSession / Custom Tabs) → shop's own login → callback → server stores tokens (encrypted) → posts from our server.

**Current blockers:** eBay/Etsy production keys not configured; server posting is gated behind Stripe/billing (Stripe keys not set). Until then Tier 1 shows "Not available yet", never a fake post.

## Tier 2 — no public listing API (in-app session)
Verified status (web research 2026-10-07):
- **Poshmark** — no public third-party listing API ([SellDeck integrations](https://selldeck.io/integrations)).
- **Depop** — Selling API exists but is **private / partner-only** ("currently private and is not available to the general public") ([partnerapi.depop.com](https://partnerapi.depop.com/api-docs/)). Apply for access; if granted, Depop moves to Tier 1.
- **Mercari (US)** — no public listing/delist API ([SellDeck](https://selldeck.io/integrations)). Mercari Shops (Japan) has a GraphQL API ([api.mercari-shops.com](https://api.mercari-shops.com/docs/index.html)) but that is not the US consumer marketplace.
- **Vinted** — Vinted Pro Integrations API exists only for **allowlisted Vinted Pro businesses** ([pro-docs.svc.vinted.com](https://pro-docs.svc.vinted.com/)). Not available to normal sellers.
- **Grailed** — no public listing API found ([SellDeck](https://selldeck.io/integrations)).

Approach (what most crosslisters do):
1. **Login once** in an in-app WebView pointed at the shop's real login page. We never see or store the password; we keep the resulting session cookies.
2. **Session storage:** cookies kept on-device in Keychain (iOS) / EncryptedSharedPreferences/Keystore (Android). Default: posting runs **on-device** in a hidden WebView so traffic comes from the user's own phone/IP. Optional later: server-side runner (higher breakage + account risk).
3. **Auto-fill/post:** per-shop adapter scripts (reuse the Chrome extension's content scripts) inject the listing into the shop's web form and submit. Report real result (listing URL) or failure.
4. **Re-auth:** detect logged-out/expired session → status "Reconnect needed" + push notification → user re-logs in WebView.
5. **Captcha / 2FA / checkpoint handoff:** when detected, pause and bring the WebView to foreground: "Poshmark needs you to confirm it's you — tap to finish." Never auto-solve captchas.
6. **Rate limits:** serialize per shop, human-like pacing (e.g. jittered delays, daily caps per shop), back off on errors/429s.
7. **Background limits:** iOS kills background work quickly — run posting while app is foreground with a progress sheet, or via short BGProcessing tasks; Android can use a foreground service/WorkManager.
8. **Breakage monitoring:** adapter version per shop, remote-config selectors (hot-fix without app release), synthetic canary account per shop running daily test post+delete, error telemetry by shop/step, kill-switch per shop (auto-falls to Tier 3).
9. **ToS / gray-area risk:** automating posts likely violates some shops' terms; accounts could be flagged/limited. Disclose clearly to users in Connect screen, keep it user-initiated, on their device, at human pace. Pursue official partner APIs (Depop, Vinted Pro) in parallel. Legal review before public launch.

## Tier 3 — fallback paste kit
If a shop is killed-switched, blocked, or the user declines Tier 2: one tap copies title/description/price, saves photos to camera roll, and deep-links/opens the shop app's sell screen. Status = "Ready to paste" until the user confirms → "Marked posted (manual)".

## Desktop Chrome extension
Stays as the **power-user desktop path only**. Not required on mobile. Shares adapter scripts with Tier 2.

## UX rules
- Connect once per shop (Connections screen with per-shop status: Connected / Reconnect needed / Not available / Paste kit).
- **Sell everywhere** = one tap; per-shop live status: Queued → Posting → Posted (with View link) / Needs you / Failed.
- **Never show "Posted" without a real listing URL/ID** from the shop.
- Seller coach everywhere: What's next checklist, tooltips on every field, plain-words explanations of failures and what to tap next.
- Delist-on-sale (later): when one shop sells, offer to delist elsewhere.

## Suggested tech
- **Recommended: Capacitor** wrapping the existing web app (fastest path, reuses UI + seller coach + AI fill) + native plugins: camera, secure storage, hidden WebView runner (custom plugin; WKWebView / Android WebView), push, background tasks.
- Alternative: React Native shell + react-native-webview — more native feel, but rewrites UI.
- Fully native (Swift/Kotlin) — best control, slowest; not justified yet.
- Ship PWA as interim (camera + AI fill work; Tier 1 + Tier 3 only).

## Phased roadmap
0. **Now:** get eBay/Etsy keys + Stripe; apply for Depop partner + Vinted Pro access.
1. **Tier 1 live on web** (eBay, Etsy server posting) + Tier 3 paste kit for others.
2. **Capacitor app beta** (TestFlight / Play internal): camera → AI fill → Tier 1 + Tier 3.
3. **Tier 2 adapters** one shop at a time (start with highest-demand, e.g. Poshmark), with canaries + kill-switches.
4. **Hardening:** re-auth/captcha flows, telemetry, delist-on-sale, store review.
5. **Public launch** after legal/ToS review.

## Risks
- Shop UI changes break adapters (mitigate: remote config, canaries, kill-switch → Tier 3).
- Account flags/bans for users from automation (disclosure, pacing, on-device).
- App Store review rejecting automation of third-party sites (keep user-initiated, visible progress; fallback to Tier 3).
- iOS background execution limits.
- Session/cookie security (on-device encrypted only).

## Open questions
- On-device only, or also a server runner for Tier 2?
- Which Tier 2 shop first?
- Pricing: is multilist paid (Stripe) or free tier with caps?
- Will we pursue official partner status with Depop/Vinted now?
- Legal review owner and timing.
