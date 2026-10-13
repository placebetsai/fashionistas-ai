#!/usr/bin/env python3
"""Backfill responsive WebP thumbnails for every photo in the public market.

For each listing photo  /api/images/<key>  this writes
  R2 fashionistas-images:  thumbs/w240/<key>.webp, thumbs/w480/<key>.webp, thumbs/w800/<key>.webp
which /img/<w>/<key> (functions/img/[[path]].js) serves with a year-long immutable cache.
Missing thumbs just redirect to the original, so running this late is safe.
Usage (from the repo, with .env.deploy):  python3 scripts/backfill-thumbs.py [--force]
No KV is touched. Re-run after new uploads (or wire the same step into the upload path).
"""
import io, json, os, subprocess, sys, tempfile
from PIL import Image, ImageOps
WIDTHS = (240, 480, 800)
API = "https://fashionistas.ai/w/api/market"
BUCKET = "fashionistas-images"
force = "--force" in sys.argv
env = dict(os.environ)
for line in open(os.environ.get("DEPLOY_ENV_FILE") or os.path.join(os.path.dirname(__file__), "..", ".env.deploy")):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.strip().split("=", 1); env[k] = v.strip().strip('"').strip("'")
env.pop("CF_ACCOUNT_ID", None)
def curl(u): return subprocess.run(["curl", "-sf", "-A", "Mozilla/5.0", u], capture_output=True).stdout
def exists(w, key): return bool(curl(f"https://fashionistas.ai/img/{w}/{key}?probe=1")[:4] == b"RIFF")
market = json.loads(curl(API)).get("market", [])
done = 0
for m in market:
    u = m.get("photo_url") or ""
    if "/api/images/" not in u: continue
    key = u.split("/api/images/", 1)[1]
    raw = curl(u)
    if not raw: print("skip (fetch)", key); continue
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    for w in WIDTHS:
        t = im.copy(); t.thumbnail((w, w * 2))
        with tempfile.NamedTemporaryFile(suffix=".webp", delete=False) as f:
            t.save(f, "WEBP", quality=72, method=6); path = f.name
        r = subprocess.run(["npx", "-y", "wrangler@4", "r2", "object", "put", f"{BUCKET}/thumbs/w{w}/{key}.webp",
                            "--file", path, "--content-type", "image/webp", "--remote"], env=env, capture_output=True, text=True)
        os.unlink(path)
        print(("ok  " if r.returncode == 0 else "FAIL"), f"w{w}", key)
        done += r.returncode == 0
print("uploaded", done)
