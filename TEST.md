# TEST.md — manual end-to-end verification

**What this proves:** that a real human, in a real Chrome profile, logged into
Poshmark and Mercari, can fill a listing through the extension and tap Post
themselves — and that the dry-run shield refuses to publish.

**What this does NOT prove:** anything about eBay/Etsy APIs or Stripe. Those are
blocked on `EBAY_SANDBOX_*` / `ETSY_*` / `STRIPE_*` env vars and are not
covered here. Nothing in this file has been executed by an automated agent; an
agent cannot log into your marketplace accounts, so every step below is
performed by you and recorded in §7.

> **Rule for this document:** if a step does not behave as written, record it
> as `FAIL`. Do not adjust the expected result to match what happened.

---

## 0. Prerequisites

| Need | Why |
|---|---|
| Chrome (desktop, stable) | MV3 + `chrome.scripting` |
| A Chrome profile **logged into Poshmark and Mercari** | adapters fill *your* session; we never store passwords |
| The repo at `~/fashionistas-ai` | source of truth |
| Node ≥ 20 | runs the automated suite |

Confirm the automated suite is green first — if this fails, stop:

```bash
cd ~/fashionistas-ai
node --test apps/extension/__tests__/*.test.mjs
# expected: # tests 57  # pass 57  # fail 0
```

---

## 1. Load the extension

```bash
cd ~/fashionistas-ai
node --input-type=module --check < apps/extension/queue.js && echo "queue.js OK"
python3 -c "import json;json.load(open('apps/extension/manifest.json'));print('manifest OK')"
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select `~/fashionistas-ai/apps/extension`
4. **Copy the 32-character ID** from the card, or from **Details**

**Expected:** no errors on the card. If Chrome reports
`Permission 'declarativeNetRequest' is unknown` or an invalid-manifest error,
record `FAIL` and the exact message.

> The site discovers this ID automatically via `content/announce.js` — you
> should never be asked to paste it. Verify that in §6.

---

## 2. Dry-run safety (do this BEFORE any real listing)

This is the single most important section. **Do not skip to §3.**

1. Open the extension's service-worker console: `chrome://extensions` →
   **Inspect views / service worker**.
2. Paste:

```js
const SELECTORS = {
  fields: { title: { selector: "#title" }, price: { selector: "#price" } },
  submit: "#publish",
  captcha: ".g-recaptcha"
};
const m = await import(chrome.runtime.getURL("adapters/engine.js"));
const e = new m.Engine({ marketplace: "poshmark", selectors: SELECTORS });
JSON.stringify({ dryRun: e.dryRun, canSubmit: await e.canSubmit() }, null, 2);
```

**Expected exactly:**
```json
{
  "dryRun": true,
  "canSubmit": { "ok": false, "reason": "dry_run" }
}
```

3. Now try to force it to publish:

```js
try { await e.submit({}); } catch (err) { console.log(err.code, err.message); }
e.submitAttempts;
```

**Expected:** `DRY_RUN_BLOCKED DRY_RUN_BLOCKED: submit selector was reachable but refused`
and `submitAttempts === 1`.

4. **Fail the test deliberately** — a safety control that has never been seen
   fail is unproven. Flip the flag and confirm it re-arms:

```js
e.dryRun = false;
e.dryRun = true;                    // changed their mind afterwards
try { await e.submit({}); console.log("FAIL: it published"); }
catch (err) { console.log("PASS:", err.code); }
```

**Expected:** `PASS: DRY_RUN_BLOCKED`

| Step | Expected | Result |
|---|---|---|
| 2 | `dryRun:true`, `reason:"dry_run"` | ☐ |
| 3 | `DRY_RUN_BLOCKED`, attempts `1` | ☐ |
| 4 | `PASS: DRY_RUN_BLOCKED` | ☐ |

---

## 3. Poshmark — fill only, human taps Post

1. Go to `https://poshmark.com/create-listing`
2. Open the page console (F12 → Console)
3. Confirm the content script injected:

```js
typeof globalThis.__fashForm            // expect "object"
```

4. Dispatch a fill through the extension service worker console:

```js
const payload = {
  title: "TEST — vintage silk scarf",
  description: "Automated fill test. Do not buy.",
  price: "25",
  category: "Women > Accessories",
  condition: "NWT",
  photos: []                 // see §4 for photos
};
chrome.runtime.sendMessage({ type: "fash:enqueue", job: {
  id: "test-" + Date.now(), shop: "poshmark", type: "publish",
  payload, dryRun: true      // keep the shield on
}});
"queued";
```

**Expected:**
- A background tab opens on Poshmark's create page
- **Title, Description, Price** are populated
- Category/Condition dropdowns select
- **No listing is created** — `Poshmark` still shows no new draft in your feed
- The service-worker console prints a telemetry trace:

```json
{
  "marketplace": "poshmark",
  "dryRun": true,
  "hydratedFields": { "title": "SUCCESS", "description": "SUCCESS", "price": "SUCCESS" },
  "error": null,
  "readyForUserTap": true
}
```

5. Check the fields really stuck (React state, not just the DOM):

```js
document.querySelector("#title").value   // expect "TEST — vintage silk scarf"
```

Refresh the page. **Expected: the field is empty again** — a page that
persists our value means we wrote to framework state correctly (it should have
*not* persisted, since Poshmark saves drafts server-side only after you act).

| Step | Expected | Result |
|---|---|---|
| 3 | `"object"` | ☐ |
| 4 | fields `SUCCESS`, `dryRun:true`, no listing created | ☐ |
| 5 | value matches payload | ☐ |

---

## 4. Programmatic photo drop

Photos must reach the **hidden** `<input type="file">` through `DataTransfer`.

```js
// in the create-listing tab's console
const input = document.querySelector('input[type="file"]');
input ? input.files.length : "NO_FILE_INPUT";        // expect 0 or a number

// synthetic drop of a 1x1 PNG
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const bytes = Uint8Array.from(atob(png.split(",")[1]), c => c.charCodeAt(0));
const file = new File([bytes], "fashionistas-test-1.png", { type: "image/png" });
const dt = new DataTransfer();
dt.items.add(file);
const el = document.querySelector('input[type="file"]');
el.files = dt.files;
el.dispatchEvent(new Event("change", { bubbles: true }));
el.files.length;                                   // expect 1
```

**Expected:** the thumbnail appears in Poshmark's image well.

> ⚠️ This exact path is **stubbed in the automated suite** (jsdom has no
> `DataTransfer`), so this manual step is the *only* place it is proven.
> Record `FAIL` if the UI does not show the image.

| Step | Expected | Result |
|---|---|---|
| thumbnail visible after synthetic drop | image appears | ☐ |

---

## 5. Mercari — same shape, different selectors

1. Open `https://www.mercari.com/sell/`
2. Repeat §3 step 4 with `shop: "mercari"`.
3. Mercari requires **Shipping**; verify it is hydrated:

```js
JSON.stringify({
  title: document.querySelector("[data-testid='listing-title']")?.value ?? "NOT_FOUND",
  price: document.querySelector("[data-testid='listing-price']")?.value ?? "NOT_FOUND"
});
```

**Expected:** both non-empty. If either selector returns `NOT_FOUND`, the
remote selector config needs updating — see §6.

| Step | Expected | Result |
|---|---|---|
| 3 | title + price non-empty | ☐ |

---

## 6. Remote selector config

The site auto-announces the extension ID; the extension pulls selectors from
`https://fashionistas.ai/selectors.json`.

```bash
curl -s https://fashionistas.ai/selectors.json | python3 -c \
 "import json,sys;d=json.load(sys.stdin);print(d['schema'],d['version'],len(d['shops']))"
```

**Expected:** `1 1 9`

Force a revalidate from the service-worker console:

```js
const m = await import(chrome.runtime.getURL("config/selectors.js"));
await m.initSelectors({ forceRefresh: true });
m.selectorStatus();
// expect: { source: "remote", version: 1, error: null, ... }
```

Then break it on purpose and confirm the bundled floor holds:

```js
const m2 = await import(chrome.runtime.getURL("config/selector-source.js"));
const r = await m2.loadSelectors({
  bundled: { version: 1, shops: (await (await import(chrome.runtime.getURL("config/selectors.js"))).SHOPS) },
  url: "https://127.0.0.1:1/selectors.json"      // guaranteed dead
});
r.source, r.error;
// expect: "bundled"  and error starting with "fetch:"
```

| Step | Expected | Result |
|---|---|---|
| endpoint | `1 1 9` | ☐ |
| `initSelectors` | `source:"remote"` | ☐ |
| dead URL | `source:"bundled"` | ☐ |

---

## 7. Results

| # | Section | Pass | Fail | Notes |
|---|---|---|---|---|
| 1 | Load unpacked | ☐ | ☐ | |
| 2 | Dry-run safety lock | ☐ | ☐ | |
| 3 | Poshmark fill | ☐ | ☐ | |
| 4 | Photo drop | ☐ | ☐ | |
| 5 | Mercari fill | ☐ | ☐ | |
| 6 | Remote selectors + fallback | ☐ | ☐ | |

**Tester:** __________________  **Date:** __________  **Chrome:** __________

---

## 8. Known-unverified (do not mark these passed)

These are *not* part of this script because they cannot be done from a browser
alone. They are listed so nobody mistakes silence for success.

- [ ] eBay sandbox listing creation — blocked on `EBAY_SANDBOX_CLIENT_ID/_SECRET/_REDIRECT_URI`
- [ ] Etsy listing creation — blocked on `ETSY_API_KEY`, `ETSY_SHARED_SECRET`
- [ ] Stripe $14.99 checkout + webhook — blocked on `STRIPE_*`
- [ ] Mobile WebView fill path — component not built yet
- [ ] iOS Safari Web Extension — scaffold not built yet
- [ ] `core/ai_inference.js` with a real model — `@huggingface/transformers`
      is not bundled; today it returns `engine_unavailable` (by design)
- [ ] `core/tryon_pipeline.js` generative stage — returns
      `generative_endpoint_unconfigured` until an endpoint is set

---

## 9. If something fails

1. Capture: the exact step number, the console output verbatim, a screenshot.
2. **Do not change the expected result.**
3. File it as one line in `NEEDS_ISRAEL.txt` (if it needs an asset/account
   from you) or fix the adapter and re-run the automated suite:

```bash
node --test apps/extension/__tests__/*.test.mjs
```
