/**
 * GA4 injection for Cloudflare Pages Functions — a pure no-op until the Pages
 * environment variable GA_MEASUREMENT_ID is set (Settings → Variables and
 * Secrets, separately for Production and Preview).
 *
 * When set to a valid web-stream ID (G-XXXXXXXXXX), HTML responses get one
 * small inline loader appended to <head>. The loader skips visitors with
 * Global Privacy Control / Do Not Track, defaults analytics_storage to denied
 * in the EEA/UK/CH (a CMP can grant it), disables Google signals + ad
 * personalisation, never touches AdSense consent, and only fetches gtag.js
 * after window load + idle, so there is no LCP/INP cost.
 */
const GA_LOADER = "(function(i){var w=window,n=navigator;if(!/^G-[A-Z0-9]{4,}$/.test(i)||n.globalPrivacyControl||n.doNotTrack==='1'||w.doNotTrack==='1')return;w.dataLayer=w.dataLayer||[];function g(){w.dataLayer.push(arguments)}w.gtag=w.gtag||g;g('consent','default',{analytics_storage:'denied',region:['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','GB','CH'],wait_for_update:500});g('js',new Date());g('config',i,{allow_google_signals:false,allow_ad_personalization_signals:false});var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+i;document.head.appendChild(s)})";

export function gaId(env) {
  const id = String((env && env.GA_MEASUREMENT_ID) || "").trim();
  return /^G-[A-Z0-9]{4,}$/.test(id) ? id : "";
}

export function gaSnippet(id) {
  return `<script id="ga4-loader">(function(){function r(){${GA_LOADER}(${JSON.stringify(id)})}` +
    `function q(){(window.requestIdleCallback||setTimeout)(r)}` +
    `document.readyState==="complete"?q():addEventListener("load",q)})()</script>`;
}

/** Wrap an HTML response; anything else (or no ID) passes through untouched. */
export function withGA(response, env) {
  const id = gaId(env);
  if (!id || typeof HTMLRewriter === "undefined") return response;
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return response;
  const snippet = gaSnippet(id);
  return new HTMLRewriter()
    .on("head", { element(el) { el.append(snippet, { html: true }); } })
    .transform(response);
}
