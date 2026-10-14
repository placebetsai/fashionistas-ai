/**
 * Affiliate tagging for outbound "Buy on <shop>" links. OFF until the site owner sets the IDs:
 *   EPN_CAMPID   – eBay Partner Network campaign id (10 digits)  → eBay item links get EPN params
 *   AMAZON_TAG   – Amazon Associates tracking id (e.g. name-20)   → amazon.com links get ?tag=
 * Never changes the destination item; only adds tracking params. Returns {url, affiliate}.
 */
const EBAY = /^https:\/\/(www\.)?ebay\.com\//i, AMZ = /^https:\/\/(www\.)?amazon\.com\//i;
export function affiliateUrl(raw, env = {}) {
  let u; try { u = new URL(raw); } catch { return { url: raw, affiliate: false }; }
  const camp = String(env.EPN_CAMPID || "").trim(), tag = String(env.AMAZON_TAG || "").trim();
  if (EBAY.test(u.href) && /^\d{10}$/.test(camp)) {
    u.searchParams.set("mkcid", "1"); u.searchParams.set("mkrid", "711-53200-19255-0"); u.searchParams.set("siteid", "0");
    u.searchParams.set("campid", camp); u.searchParams.set("customid", "fa"); u.searchParams.set("toolid", "10001"); u.searchParams.set("mkevt", "1");
    return { url: u.href, affiliate: true };
  }
  if (AMZ.test(u.href) && /^[A-Za-z0-9-]{3,40}-2\d$/.test(tag)) { u.searchParams.set("tag", tag); return { url: u.href, affiliate: true }; }
  return { url: u.href, affiliate: false };
}
