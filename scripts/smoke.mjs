#!/usr/bin/env node
// Deterministic pre-deploy / post-deploy smoke gate. Zero dependencies (Node >= 18),
// zero AI/LLM grading: every assertion below is a plain string/number/JSON check.
//
//   node scripts/smoke.mjs [baseUrl] [--json out.json] [--skip-bots] [--quiet]
//   npm run smoke -- https://<preview>.pages.dev
//
// Exit 0 = all hard checks passed. Exit 1 = at least one hard check failed.
// "warn" checks are printed but never fail the gate.
// Used by scripts/deploy-safe.sh: preview must pass before production is touched,
// and production is re-checked right after the deploy.
const ARGS = process.argv.slice(2);
const flag = (n) => ARGS.includes(n);
const opt = (n) => { const i = ARGS.indexOf(n); return i >= 0 ? ARGS[i + 1] : undefined; };
const POSITIONAL = ARGS.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--json'].includes(ARGS[i - 1])));
const UA = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36 deploy-safe-smoke/1.0', accept: '*/*' };
const SKIP_BOTS = flag('--skip-bots') || process.env.SMOKE_SKIP_BOTS === '1';
const QUIET = flag('--quiet');
const results = [];

// Visible-text strings that mean a page rendered broken data or an error screen.
const BAD_TEXT = [
  /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bnull\s*(?:%|\$)/,
  /Application error: a (?:client|server)-side exception/i, /Internal Server Error/i,
  /Worker threw exception/i, /Error 1101/i, /Error 1102/i, /This page could not be found/i,
  /Unhandled Runtime Error/i, /Traceback \(most recent call last\)/,
];

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ');
}

async function fetchT(url, init = {}, timeoutMs = 20000) {
  const t0 = Date.now();
  const res = await fetch(url, { redirect: 'follow', ...init, headers: { ...UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.text();
  return { res, body, ms: Date.now() - t0 };
}

// One retry on network error / 5xx / timeout: a single blip should not block a deploy,
// but a real outage fails twice in a row.
async function fetchRetry(url, init, timeoutMs) {
  try {
    const r = await fetchT(url, init, timeoutMs);
    if (r.res.status < 500) return r;
    await new Promise((s) => setTimeout(s, 2500));
    return await fetchT(url, init, timeoutMs);
  } catch (e) {
    await new Promise((s) => setTimeout(s, 2500));
    return await fetchT(url, init, timeoutMs);
  }
}

async function check(name, fn, { warn = false } = {}) {
  const t0 = Date.now();
  let pass = false, detail = '';
  try {
    const out = await fn();
    if (out === true || out === undefined) pass = true;
    else if (typeof out === 'string') { pass = true; detail = out; }
    else if (out && typeof out === 'object') { pass = !!out.pass; detail = out.detail || ''; }
  } catch (e) {
    pass = false; detail = (e && e.message ? e.message : String(e)).slice(0, 300);
  }
  const r = { name, pass, warn, ms: Date.now() - t0, detail };
  results.push(r);
  if (!QUIET || !pass) console.log(`${pass ? 'PASS' : warn ? 'WARN' : 'FAIL'}  ${name}  (${r.ms} ms)${detail ? '  — ' + detail : ''}`);
  return r;
}
const fail = (msg) => { throw new Error(msg); };

// GET a page: status, time budget, required markers, and no broken-data text.
async function page(base, path, { status = 200, markers = [], budgetMs = 5000, bad = BAD_TEXT, allowBad = [] } = {}) {
  const { res, body, ms } = await fetchRetry(base + path, {}, Math.max(budgetMs * 3, 15000));
  if (res.status !== status) fail(`${path} → HTTP ${res.status} (want ${status})`);
  if (ms > budgetMs) fail(`${path} took ${ms} ms (budget ${budgetMs} ms)`);
  if (status === 200) {
    for (const m of markers) {
      const ok = m instanceof RegExp ? m.test(body) : body.includes(m);
      if (!ok) fail(`${path} missing marker ${m}`);
    }
    const text = visibleText(body);
    for (const re of bad) {
      if (allowBad.some((a) => String(a) === String(re))) continue;
      const mm = text.match(re);
      if (mm) {
        const i = mm.index; fail(`${path} shows "${mm[0]}": …${text.slice(Math.max(0, i - 60), i + 60).trim()}…`);
      }
    }
  }
  return { body, ms, res };
}

async function getJson(base, path, { budgetMs = 5000, status = 200, init = {} } = {}) {
  const { res, body, ms } = await fetchRetry(base + path, init, Math.max(budgetMs * 3, 15000));
  if (res.status !== status) fail(`${path} → HTTP ${res.status} (want ${status}) ${clip(body, 100)}`);
  let data;
  try { data = JSON.parse(body); } catch { fail(`${path} is not valid JSON: ${body.slice(0, 120)}`); }
  if (ms > budgetMs) fail(`${path} took ${ms} ms (budget ${budgetMs} ms)`);
  return { data, ms, res };
}

// POST to a bot endpoint. No retries on 4xx; one retry on 5xx/timeout.
async function postJson(base, path, payload, { budgetMs = 15000 } = {}) {
  const { res, body, ms } = await fetchRetry(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }, Math.max(budgetMs * 2, 30000));
  if (res.status !== 200) fail(`${path} → HTTP ${res.status} ${body.slice(0, 160)}`);
  let data; try { data = JSON.parse(body); } catch { fail(`${path} returned non-JSON: ${body.slice(0, 120)}`); }
  if (ms > budgetMs) fail(`${path} answered in ${ms} ms (budget ${budgetMs} ms)`);
  return { data, ms };
}

const hoursAgo = (iso) => (Date.now() - new Date(iso).getTime()) / 3.6e6;
// Calendar date and clock in America/New_York for "today"/"tonight" logic.
const etParts = (d = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
const etDate = (d) => { const p = etParts(new Date(d)); return `${p.year}-${p.month}-${p.day}`; };
const isUsMarketHours = (d = new Date()) => { const p = etParts(d); const m = (+p.hour % 24) * 60 + +p.minute; return !['Sat', 'Sun'].includes(p.weekday) && m >= 9 * 60 + 30 && m <= 16 * 60; };
const clip = (s, n = 160) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

function finish() {
  const hard = results.filter((r) => !r.pass && !r.warn);
  const warns = results.filter((r) => !r.pass && r.warn);
  const out = opt('--json');
  if (out) { import('node:fs').then((fs) => fs.writeFileSync(out, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 1))); }
  console.log(`\nSMOKE ${hard.length ? 'FAILED' : 'PASSED'} — ${results.length - hard.length - warns.length}/${results.length} passed, ${hard.length} failed, ${warns.length} warnings — ${BASE}`);
  if (hard.length) { console.log('Failed checks:'); for (const r of hard) console.log(`  ✗ ${r.name}: ${r.detail}`); }
  setTimeout(() => process.exit(hard.length ? 1 : 0), 50);
}

// ───────────────────────── fashionistas.ai checks ─────────────────────────
import { existsSync, readFileSync } from 'node:fs';
const DEFAULT_BASE = 'https://fashionistas.ai';
const BASE = (POSITIONAL[0] || process.env.SMOKE_BASE || DEFAULT_BASE).replace(/\/+$/, '');
const JUNK = /\b(cup lid|plastic cup|coffee maker|keurig|e2e test|delete me|test listing|lorem)\b/i;
let market = [];

await check('page / (home)', () => page(BASE, '/', { markers: ['fashionistas.ai'], budgetMs: 5000 }).then(() => true));
await check('page /shop (buyer feed)', () => page(BASE, '/shop', { markers: ['Shop'], budgetMs: 5000 }).then(() => true));
await check('version.txt is a commit sha', async () => {
  const { res, body } = await fetchRetry(`${BASE}/version.txt`, {}, 15000);
  const v = body.trim();
  if (res.status !== 200 || !/^[0-9a-f]{40}$/.test(v)) fail(`HTTP ${res.status} "${clip(v, 60)}"`);
  if (process.env.EXPECT_SHA && v !== process.env.EXPECT_SHA) fail(`live ${v} != expected ${process.env.EXPECT_SHA}`);
  return v.slice(0, 8);
});
await check('api /w/api/health', async () => { const { data } = await getJson(BASE, '/w/api/health', { budgetMs: 4000 }); if (!data.ok) fail(clip(JSON.stringify(data))); return data.version; });
await check('api /w/api/market: listings valid', async () => {
  const { data } = await getJson(BASE, '/w/api/market', { budgetMs: 5000 });
  market = data.market || [];
  if (!market.length) fail('0 listings in the public market');
  const bad = market.filter((m) => !m.id || !m.title || !(Number(m.price) > 0) || !/^https:\/\//.test(m.photo_url || ''));
  if (bad.length) fail(`${bad.length} broken listings, e.g. ${clip(JSON.stringify(bad[0]), 140)}`);
  return `${market.length} active listings`;
});
await check('market has no junk/test listings', () => {
  const junk = market.filter((m) => JUNK.test(m.title || ''));
  if (junk.length) fail(junk.map((m) => `#${m.id} ${m.title}`).join(', '));
}, { warn: true });
await check('page /shop/<first listing> renders the item', async () => {
  if (!market.length) fail('no listing to open');
  const m = market.find((x) => !JUNK.test(x.title)) || market[0];
  const { body } = await page(BASE, `/shop/${m.id}`, { budgetMs: 5000 });
  if (!body.includes(m.title.slice(0, 20).replace(/&/g, '&amp;')) && !body.includes(m.title.slice(0, 20))) fail(`/shop/${m.id} does not show "${m.title}"`);
  return `#${m.id}`;
});
await check('seller board /api/crosslist/board: auth gate (401 JSON without token)', async () => {
  const { data } = await getJson(BASE, '/api/crosslist/board', { status: 401, budgetMs: 4000 });
  if (data.ok !== false) fail(clip(JSON.stringify(data)));
});
// Optional signed-in seller check. Creds from env or e2e/.env.test-seller (never printed).
let user = process.env.FASH_SMOKE_USER, pass = process.env.FASH_SMOKE_PASS;
if ((!user || !pass) && existsSync('e2e/.env.test-seller')) {
  const env = Object.fromEntries(readFileSync('e2e/.env.test-seller', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
  user = env.TEST_SELLER_USERNAME; pass = env.TEST_SELLER_PASSWORD;
}
if (user && pass) {
  await check('seller board (signed in): returns listings', async () => {
    const { data: l } = await postJson(BASE, '/w/api/auth/login', { username: user, password: pass }, { budgetMs: 6000 });
    if (!l.token) fail('login returned no token');
    const { data } = await getJson(BASE, '/api/crosslist/board', { budgetMs: 6000, init: { headers: { authorization: `Bearer ${l.token}` } } });
    if (!Array.isArray(data.listings)) fail(`no listings array: ${clip(JSON.stringify(data), 120)}`);
    return `${data.listings.length} listings on the board`;
  });
} else {
  await check('seller board (signed in)', () => fail('skipped — set FASH_SMOKE_USER/FASH_SMOKE_PASS or e2e/.env.test-seller'), { warn: true });
}
for (const p of ['/sell', '/you']) await check(`app route ${p} (rebuild app)`, () => page(BASE, p, { budgetMs: 5000 }).then(() => true), { warn: true });
await check('secrets are not served', async () => {
  for (const p of ['/.env.deploy', '/.env', '/.git/config', '/.dev.vars']) {
    const { res } = await fetchT(BASE + p, {}, 15000);
    if (res.status === 200) fail(`${p} → 200`);
  }
});
finish();
