#!/usr/bin/env python3
"""
legal/build.py — render legal/*.md to legal/*.html. Stdlib only, no npm deps.

The legal pages are hand-written Markdown so a lawyer can read and redline the
source. Cloudflare Pages serves static files, not a Markdown renderer, so the
rendered HTML is committed next to the source and served as-is at
/legal/terms.html, /legal/privacy.html, /legal/risk.html.

DESIGN REUSE, NOT DESIGN INVENTION. Everything visual below is copied out of
the site's own index.html so these pages cannot drift into looking like a
different website:
  * the <link> to Google Fonts (Inter + Instrument Serif)  — index.html:35
  * the whole :root design-token block                     — index.html:37-79
  * .wrap / .card / .pill / .mut / .btn / .legal-line      — index.html:164-305
Legal pages add three things of their own, scoped to the <main class="legal">
container so nothing here can leak into another page's classes:
  .draft-banner  the "DRAFT, pending counsel review" strip
  .legal-body    the prose measure (readability only)
  .legal-toc     the in-page contents list
None of these three names exist in index.html, which is the point: a class that
already exists on the site is reused verbatim; a class that does not exist is
added deliberately rather than invented by accident.

Usage:  python3 legal/build.py
Exit 0 only if all three pages rendered with no unconverted markdown left.
"""

from __future__ import annotations

import html
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# --------------------------------------------------------------------------
# Design system — verbatim from index.html so the legal pages match the site.
# --------------------------------------------------------------------------

FONT_LINK = (
    '<link rel="stylesheet" '
    'href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900'
    '&family=Instrument+Serif:ital@0;1&display=swap">'
)

# Copied from index.html's <style> :root block (index.html:37-79).
TOKENS = """
:root{
 --bg:#faf7f2; --bg-tint:#f4efe7;
 --card:#ffffff; --card-2:#fffdfa;
 --card-glass:rgba(255,255,255,.78);
 --bar-glass:rgba(255,255,255,.86);
 --sel-bg:rgba(255,255,255,.94);
 --line:#e9e2d8; --line-2:#ddd3c5;
 --ink:#12121a; --mut:#74747e;
 --soft:#eee9e0; --soft-2:#e6dfd3;
 --input-bg:#ffffff; --code-bg:#f1ece4; --track:#eee9e0;
 --solid:#12121a; --solid-fg:#ffffff;
 --accent:#ff4e3a; --accent2:#7c5cff;
 --good:#1f7a4d; --good-fg:#ffffff; --good-soft:#e2efe7;
 --bad:#c0392b; --bad-fg:#ffffff; --bad-soft:#fbe4e1;
 --gold:#c8860a;
 --grad:linear-gradient(100deg,#ff8a3d,#ff4e3a 45%,#c05cff);
 --sheen:rgba(255,255,255,.55);
 --tint:rgba(0,0,0,.045);
 --mesh:radial-gradient(40% 34% at 8% 4%,rgba(255,138,61,.22),transparent 62%),
        radial-gradient(36% 32% at 92% 0%,rgba(124,92,255,.17),transparent 64%),
        radial-gradient(50% 42% at 60% 100%,rgba(255,78,58,.13),transparent 66%);
 --sh-1:0 1px 2px rgba(24,16,10,.05);
 --shadow:0 10px 34px rgba(24,16,10,.09);
 --sh-2:0 2px 6px rgba(24,16,10,.05),0 16px 38px rgba(24,16,10,.10);
 --sh-3:0 6px 16px rgba(24,16,10,.07),0 30px 70px rgba(24,16,10,.16);
 --ring:0 0 0 3px rgba(255,78,58,.18);
 --r-1:8px; --r-2:12px; --r-3:16px; --r-4:20px; --r-5:26px; --r-full:999px;
 --radius:18px;
 --t-xs:11px; --t-sm:12.5px; --t-base:15px; --t-md:17px; --t-lg:22px; --t-xl:26px;
 --display:"Instrument Serif",Georgia,"Times New Roman",serif;
 color-scheme:light;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);
 font-family:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
 font-size:var(--t-base);line-height:1.62;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
/* .wrap / .card / .pill / .mut / .legal-line — the site's own classes,
   copied from index.html (164-305) rather than restyled here. */
.wrap{max-width:640px;margin:0 auto;padding:calc(14px + env(safe-area-inset-top)) 16px calc(96px + env(safe-area-inset-bottom))}
.card{position:relative;background:linear-gradient(165deg,var(--card-2) 0%,var(--card) 52%);
 border:1px solid var(--line);border-radius:var(--radius);padding:18px;margin:12px 0;box-shadow:var(--sh-2)}
.pill{display:inline-block;padding:4px 11px;border-radius:var(--r-full);font-size:11.5px;
 font-weight:700;background:var(--soft);color:var(--ink);margin:2px 3px 2px 0}
.mut{color:var(--mut);font-size:13px}
.legal-line{font-size:11px;color:var(--mut);text-align:center;margin:16px 2px 4px;line-height:1.5}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;
 border-radius:14px;padding:12px 16px;font-size:14px;font-weight:700;cursor:pointer;
 text-decoration:none;background:var(--soft);color:var(--ink)}
.btn-accent{background:var(--accent);color:#fff}
.btn-ghost{background:transparent;color:var(--accent);border:1.5px solid var(--accent)}
.brand{font-family:var(--display);font-style:italic;font-weight:600;font-size:23px;
 letter-spacing:-.02em;color:var(--ink)}
.brand span{color:var(--accent)}
.topnav{display:flex;align-items:center;justify-content:space-between;gap:16px;
 padding:18px 0;border-bottom:1px solid var(--line);margin-bottom:24px;flex-wrap:wrap}
.topnav nav{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;font-weight:600}
.topnav nav a{color:var(--mut)}
.topnav nav a:hover,.topnav nav a[aria-current="page"]{color:var(--accent)}
h1{font-size:clamp(1.6rem,4vw,2.1rem);line-height:1.2;margin:0 0 8px;letter-spacing:-.03em}
.sub-lede{color:var(--mut);font-size:1.02rem;margin:0 0 20px}
/* --- the three legal-page-only classes, scoped to main.legal --- */
.legal .draft-banner{display:flex;gap:12px;align-items:flex-start;background:var(--bad-soft);
 border:1px solid rgba(192,57,43,.28);border-left:4px solid var(--bad);border-radius:var(--r-3);
 padding:14px 15px;margin:0 0 8px;color:#5c1a12}
.legal .draft-banner b{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;
 margin-bottom:3px;color:var(--bad)}
.legal .draft-banner p{margin:0;font-size:13px;line-height:1.5}
.legal .draft-meta{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 6px}
.legal .legal-body h2{font-size:var(--t-lg);letter-spacing:-.02em;line-height:1.25;
 margin:30px 0 8px;padding-top:20px;border-top:1px solid var(--line)}
.legal .legal-body h3{font-size:var(--t-md);letter-spacing:-.015em;margin:22px 0 6px}
.legal .legal-body p{margin:0 0 12px}
.legal .legal-body ul,.legal .legal-body ol{margin:0 0 14px;padding-left:22px}
.legal .legal-body li{margin:0 0 6px}
.legal .legal-body li>ul,.legal .legal-body li>ol{margin:6px 0 2px}
.legal .legal-body hr{border:0;border-top:1px solid var(--line);margin:26px 0}
.legal .legal-body blockquote{margin:0 0 14px;padding:12px 15px;background:var(--code-bg);
 border:1px solid var(--line);border-radius:var(--r-2);color:#4a4038;font-size:14px}
.legal .legal-body blockquote p:last-child{margin-bottom:0}
.legal .legal-body code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
 font-size:.9em;background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:1px 5px}
.legal .legal-body strong{font-weight:800}
.legal .legal-body .tablewrap{overflow-x:auto;margin:0 0 16px;-webkit-overflow-scrolling:touch}
.legal table{width:100%;border-collapse:collapse;font-size:14px;min-width:380px}
.legal th,.legal td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.legal th{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
.legal .toc{background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-3);
 padding:16px 18px;margin:0 0 24px;box-shadow:var(--sh-1)}
.legal .toc b{display:block;font-size:12px;font-weight:800;letter-spacing:.07em;
 text-transform:uppercase;color:var(--mut);margin-bottom:8px}
.legal .toc ol{margin:0;padding-left:20px;columns:2;column-gap:22px;font-size:13.5px}
.legal .toc li{margin:0 0 4px;break-inside:avoid}
.legal .toc a{color:var(--mut)}
.legal .toc a:hover{color:var(--accent)}
.legal .notes{background:var(--card-2);border:1px dashed var(--line-2);border-radius:var(--r-3);
 padding:16px 18px;margin:26px 0 0}
.legal .notes>b{display:block;font-size:12px;font-weight:800;letter-spacing:.07em;
 text-transform:uppercase;color:var(--accent);margin-bottom:10px}
.legal .site-footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--line);
 color:var(--mut);font-size:13px}
.legal .site-footer nav{display:flex;flex-wrap:wrap;gap:12px 16px;margin-bottom:10px;font-weight:600}
.legal .site-footer a{color:var(--mut)}
.legal .site-footer a:hover{color:var(--accent)}
@media (max-width:640px){.legal .toc ol{columns:1}}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important}}
"""

# --------------------------------------------------------------------------
# Markdown -> HTML. A deliberately small, honest subset: if a construct is not
# handled it is left as literal text and build() fails loudly rather than
# silently shipping a half-rendered page.
# --------------------------------------------------------------------------

PAGES = [
    {
        "src": "terms.md",
        "out": "terms.html",
        "title": "Terms of Service (DRAFT)",
        "desc": "Draft Terms of Service for fashionistas.ai, pending counsel review. "
                "Not a marketplace: we buy and sell nothing.",
        "lede": "fashionistas.ai is a listing assistant. We are not a marketplace, we do not "
                "buy or sell anything, and your marketplace accounts stay yours.",
        "toc_from": 2,
    },
    {
        "src": "privacy.md",
        "out": "privacy.html",
        "title": "Privacy Policy (DRAFT)",
        "desc": "Draft Privacy Policy for fashionistas.ai, pending counsel review. What we "
                "store in Cloudflare D1 and R2, and the marketplace passwords we never ask for.",
        "lede": "What we store, what we never store, and the two narrow places a marketplace "
                "token does reach our servers.",
        "toc_from": 2,
    },
    {
        "src": "risk.md",
        "out": "risk.html",
        "title": "Marketplace Risk Disclosure (DRAFT)",
        "desc": "Draft risk disclosure for fashionistas.ai: Poshmark, Mercari, Depop, Grailed, "
                "eBay and Etsy fees, suspension risk, double-sale risk and chargeback risk.",
        "lede": "Account-suspension risk, fees, payout timing, double sales, counterfeits and "
                "chargebacks — one section per marketplace. Read Section 0 first.",
        "toc_from": 2,
    },
]

OTHER = {"terms.html": "privacy.html", "privacy.html": "risk.html", "risk.html": "terms.html"}
TITLES = {"terms.html": "Terms", "privacy.html": "Privacy", "risk.html": "Risk"}


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "section"


ITEM_RE = re.compile(r"^(\s*)([-*]|\d+\.)\s+(.*)$")


def item_text(lines: list[str], i: int) -> tuple[str, int]:
    """Join an item's own text, consuming lazy continuation lines.

    A wrapped list item looks like:

        - first line of the item
          and the rest of the same item

    The continuation lines match no item marker, so they must be pulled in here
    or the renderer would close the <li> mid-sentence and emit the tail as a
    stray paragraph. Returns (text, index_after_this_item).
    """
    m = ITEM_RE.match(lines[i])
    parts = [m.group(3).strip() if m else lines[i].strip()]
    i += 1
    while i < len(lines) and lines[i].strip() and not ITEM_RE.match(lines[i]):
        parts.append(lines[i].strip())
        i += 1
    return " ".join(parts), i


def list_items(lines: list[str], i: int, indent: int) -> tuple[list[str], int]:
    """Render one list level, recursing into nested lists.

    Returns (html_fragments, index_after_the_list). Index-based rather than
    closing over the caller's loop variable, so a nested list can never leave
    the outer cursor unbound.
    """
    res: list[str] = []
    while i < len(lines):
        m = ITEM_RE.match(lines[i])
        if not m:
            break
        cur = len(m.group(1)) // 2
        if cur < indent:
            break
        if cur > indent:
            nested, i = list_items(lines, i, cur)
            if nested and res:
                res[-1] = res[-1][: -len("</li>")] + "".join(nested) + "</li>"
            else:
                res.append(f"<li>{''.join(nested)}</li>")
            continue

        body, i = item_text(lines, i)

        # A blank line then a deeper item = a nested list inside this <li>.
        j = i
        while j < len(lines) and not lines[j].strip():
            j += 1
        m2 = ITEM_RE.match(lines[j]) if j < len(lines) else None
        if m2 and len(m2.group(1)) // 2 > cur:
            nested, i = list_items(lines, j, len(m2.group(1)) // 2)
            res.append(f"<li>{inline(body)}{''.join(nested)}</li>")
            continue

        res.append(f"<li>{inline(body)}</li>")
    return res, i


def emit_list(lines: list[str], i: int, indent: int, tag: str) -> tuple[list[str], int]:
    """`tag` is carried for call-site readability; the marker picks the markup."""
    return list_items(lines, i, indent)


def inline(text: str) -> str:
    """Inline markdown -> HTML. Code spans first so their contents stay literal."""
    codes: list[str] = []

    def stash(m: re.Match) -> str:
        codes.append(html.escape(m.group(1), quote=False))
        return f"\x00{len(codes) - 1}\x00"

    text = re.sub(r"`([^`]+)`", stash, text)

    text = html.escape(text, quote=False)

    # [label](/href) — only same-site absolute paths, no scheme, so a source
    # typo can never turn a legal page into an outbound link.
    def link(m: re.Match) -> str:
        label, href = m.group(1), m.group(2)
        if not href.startswith("/") or href.startswith("//"):
            return m.group(0)
        return f'<a href="{html.escape(href, quote=True)}">{label}</a>'

    text = re.sub(r"\[([^\]]+)\]\((/[^)\s]*)\)", link, text)
    text = re.sub(r"\[([^\]]+)\]\(mailto:([^\s)]+)\)",
                  r'<a href="mailto:\2">\1</a>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![\w*])\*([^*\n]+?)\*(?![\w*])", r"<em>\1</em>", text)
    text = re.sub(r"(?<![\w_])_(?! )([^_\n]+?)_(?![\w_])", r"<em>\1</em>", text)

    for i, c in enumerate(codes):
        text = text.replace(f"\x00{i}\x00", f"<code>{c}</code>")
    return text


def slug_list(headers: list[tuple[int, str, str]]) -> str:
    if not headers:
        return ""
    out = ['<nav class="toc" aria-label="Contents"><b>Contents</b><ol>']
    for _, text, sid in headers:
        out.append(f'<li><a href="#{sid}">{html.escape(text)}</a></li>')
    out.append("</ol></nav>")
    return "\n".join(out)


def render(md: str, toc_from: int) -> tuple[str, list[tuple[int, str, str]]]:
    lines = md.split("\n")
    i = 0
    out: list[str] = []
    headers: list[tuple[int, str, str]] = []
    seen: dict[str, int] = {}

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        if stripped == "---":
            out.append("<hr>")
            i += 1
            continue

        m = re.match(r"^(#{2,4})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip().rstrip("*").strip()
            base = slug(text)
            seen[base] = seen.get(base, 0) + 1
            sid = base if seen[base] == 1 else f"{base}-{seen[base]}"
            if level >= toc_from:
                headers.append((level, text, sid))
            out.append(f"<h{level} id=\"{sid}\">{inline(text)}</h{level}>")
            i += 1
            continue

        # Table: a header row followed by |---|---| .
        if stripped.startswith("|") and i + 1 < len(lines) and re.match(
            r"^\|[\s:|-]+\|$", lines[i + 1].strip()
        ):
            def cells(row: str) -> list[str]:
                return [c.strip() for c in row.strip().strip("|").split("|")]

            head = cells(stripped)
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(cells(lines[i].strip()))
                i += 1
            t = ['<div class="tablewrap"><table><thead><tr>']
            t += [f"<th>{inline(c)}</th>" for c in head]
            t.append("</tr></thead><tbody>")
            for r in rows:
                r = r + [""] * (len(head) - len(r))
                t.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r[: len(head)]) + "</tr>")
            t.append("</tbody></table></div>")
            out.append("\n".join(t))
            continue

        if stripped.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                buf.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            out.append(f"<blockquote>{inline(' '.join(buf))}</blockquote>")
            continue

        m = ITEM_RE.match(line)
        if m:
            base = len(m.group(1)) // 2
            ordered = m.group(2) not in ("-", "*")
            tag = "ol" if ordered else "ul"
            res, i = emit_list(lines, i, base, tag)
            out.append(f"<{tag}>" + "".join(res) + f"</{tag}>")
            continue

        buf = [stripped]
        i += 1
        while i < len(lines) and lines[i].strip():
            nxt = lines[i].strip()
            if re.match(r"^(#{2,4}\s|[-*]\s|\d+\.\s|>|\||---$)", nxt):
                break
            buf.append(nxt)
            i += 1
        out.append(f"<p>{inline(' '.join(buf))}</p>")

    return "\n".join(out), headers


def page_html(page: dict, body: str, headers: list[tuple[int, str, str]]) -> str:
    out = page["out"]
    other = OTHER[out]
    first, rest = body.split("<h2", 1)
    rest = "<h2" + rest
    notes = ""
    m = re.search(r'<h2 id="drafting-notes.*?(?=\Z)', rest, re.S)
    if m:
        notes = m.group(0)
        rest = rest[: m.start()]
    toc = slug_list(headers)

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(page['title'])} — fashionistas.ai</title>
<meta name="description" content="{html.escape(page['desc'], quote=True)}">
<meta name="robots" content="noindex,follow">
<meta property="og:title" content="{html.escape(page['title'])} — fashionistas.ai">
<meta property="og:description" content="{html.escape(page['desc'], quote=True)}">
<meta property="og:type" content="website">
<link rel="canonical" href="https://fashionistas.ai/legal/{out}">
{FONT_LINK}
<style>{TOKENS}
</style>
</head>
<body class="legal">
<div class="wrap">

<header class="topnav">
  <a class="brand" href="/">fashionistas<span>.ai</span></a>
  <nav aria-label="Legal">
    <a href="/legal/terms.html" aria-current="page">{TITLES['terms.html']}</a>
    <a href="/legal/privacy.html">{TITLES['privacy.html']}</a>
    <a href="/legal/risk.html">{TITLES['risk.html']}</a>
    <a href="/">Home</a>
  </nav>
</header>

<main class="legal-body">
<h1>{html.escape(page['title'])}</h1>
<p class="sub-lede">{html.escape(page['lede'])}</p>

<div class="draft-banner" role="note">
  <div>
    <b>Draft &mdash; not legal advice</b>
    <p>These pages were drafted for review by a licensed lawyer and have <strong>not</strong>
    been reviewed by counsel. Bracketed items are placeholders that only counsel can fill in.
    Do not rely on them, and do not publish them as binding terms, until counsel has signed off.</p>
  </div>
</div>
<p class="mut" style="margin:0 0 4px">
  <strong>Draft date:</strong> 2026-10-05 &middot;
  <strong>Effective date:</strong> to be set by counsel &middot;
  <strong>Operator:</strong> fashionistas.ai
</p>
<div class="draft-meta">
  <span class="pill">Draft</span>
  <span class="pill">Not legal advice</span>
  <span class="pill">Pending counsel review</span>
  <span class="pill">2026-10-05</span>
</div>

{toc}

{first}{rest}

<div class="notes">
<b>Also on this page set</b>
<ul>
<li><a href="/legal/terms.html">Terms of Service</a> &mdash; ownership, acceptable use, the no-automation rule, billing.</li>
<li><a href="/legal/privacy.html">Privacy Policy</a> &mdash; what we store in Cloudflare D1 and R2, and what we never store.</li>
<li><a href="/legal/risk.html">Marketplace Risk Disclosure</a> &mdash; suspension, fees, double sales, counterfeits and chargebacks, per marketplace.</li>
</ul>
<p class="mut" style="margin:0">Draft source: <code>legal/{page['src']}</code> &middot;
Next in this set: <a href="/legal/{other}">{TITLES[other]}</a></p>
</div>

{notes}
</main>

<footer class="site-footer">
<nav aria-label="Footer">
<a href="/">Home</a>
<a href="/pricing/">Pricing</a>
<a href="/contact/">Contact</a>
<a href="/privacy/">Privacy</a>
<a href="/legal/terms.html">Terms</a>
<a href="/legal/privacy.html">Privacy Policy</a>
<a href="/legal/risk.html">Risk Disclosure</a>
</nav>
<p>fashionistas.ai &mdash; photograph your closet, list it everywhere.
Email: <a href="mailto:fashionistas1979@gmail.com">fashionistas1979@gmail.com</a></p>
<p class="legal-line">These legal pages are a draft for counsel review and are not legal advice.
Marketplace names are used descriptively; fashionistas.ai is not affiliated with, endorsed by
or sponsored by Poshmark, Mercari, Depop, Grailed, eBay or Etsy.</p>
</footer>
</div>
</body>
</html>
"""


def main() -> int:
    failures = 0
    for page in PAGES:
        src = HERE / page["src"]
        if not src.exists():
            print(f"MISSING {src}")
            failures += 1
            continue
        body, headers = render(src.read_text(encoding="utf-8"), page["toc_from"])
        doc = page_html(page, body, headers)

        left = re.findall(r"(?m)^#{1,6}\s|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(", body)
        if left:
            print(f"FAIL {page['out']}: unconverted markdown: {left[:5]}")
            failures += 1
        if "DRAFT" not in doc or "2026-10-05" not in doc:
            print(f"FAIL {page['out']}: missing draft banner or date")
            failures += 1
        if doc.count("<h1") != 1:
            print(f"FAIL {page['out']}: expected exactly one h1")
            failures += 1

        (HERE / page["out"]).write_text(doc, encoding="utf-8")
        print(
            f"OK   {page['out']}  {len(doc):>6} bytes  "
            f"{len(headers):>2} sections  1 h1  banner+date present"
        )

    if failures:
        print(f"\n{failures} failure(s)")
        return 1
    print("\nAll legal pages rendered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())