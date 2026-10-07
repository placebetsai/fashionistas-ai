/**
 * Product-photo background knockout (client-side, free, no upload).
 *
 * Most listing / product photos sit on a plain studio backdrop (white, grey,
 * a soft gradient). Pasting that rectangle onto a person or a room is what
 * made the instant try-on and the room placer look like a sticker. This
 * flood-fills the backdrop from the image border, feathers the edge, and
 * crops to the item. If the border is not a plain backdrop (a real-world
 * photo), it returns null and callers keep the original image unchanged.
 */
export function cutoutBackground(img, { maxEdge = 1024, tol = 42 } = {}) {
  const w0 = img.naturalWidth || img.width || 0;
  const h0 = img.naturalHeight || img.height || 0;
  if (!w0 || !h0) return null;
  const s = Math.min(1, maxEdge / Math.max(w0, h0));
  const W = Math.max(1, Math.round(w0 * s));
  const H = Math.max(1, Math.round(h0 * s));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  let id;
  try { id = ctx.getImageData(0, 0, W, H); } catch (_) { return null; } // tainted
  const d = id.data;

  // Border sample -> is it a plain backdrop?
  const border = [];
  const step = Math.max(1, Math.floor((W + H) / 400));
  for (let x = 0; x < W; x += step) { border.push(x, (H - 1) * W + x); border.push(W + x); }
  for (let y = 0; y < H; y += step) { border.push(y * W, y * W + W - 1); }
  let lum = [];
  for (const p of border) { const i = p * 4; lum.push(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11); }
  lum.sort((a, b) => a - b);
  const med = lum[lum.length >> 1];
  const near = lum.filter((v) => Math.abs(v - med) < 28).length / lum.length;
  if (near < 0.7) return null; // real scene, leave it alone

  // Flood fill from every border pixel. A pixel joins the backdrop when it is
  // close to its already-filled neighbour (follows gradients) AND not too far
  // from the backdrop median (stops at the item).
  const mask = new Uint8Array(W * H); // 1 = background
  const stack = new Int32Array(W * H);
  let sp = 0;
  const l = (p) => { const i = p * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  for (const p of border) {
    const i = p * 4;
    const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    if (!mask[p] && Math.abs(v - med) < 40) { mask[p] = 1; stack[sp++] = p; }
  }
  const medTol = tol * 2.6;
  while (sp) {
    const p = stack[--sp];
    const cp = l(p);
    const x = p % W, y = (p / W) | 0;
    const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
    for (const q of nb) {
      if (q < 0 || mask[q]) continue;
      const cq = l(q);
      const vq = cq[0] * 0.3 + cq[1] * 0.59 + cq[2] * 0.11;
      if (dist(cp, cq) < tol * 0.5 && Math.abs(vq - med) < medTol / 3) { mask[q] = 1; stack[sp++] = q; }
    }
  }
  let bg = 0;
  for (let p = 0; p < mask.length; p++) bg += mask[p];
  const frac = bg / mask.length;
  if (frac < 0.08 || frac > 0.97) return null; // nothing removed, or item swallowed

  // Alpha + 1px feather, and bbox of what is left.
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (mask[p]) { d[p * 4 + 3] = 0; continue; }
    const edge = (x > 0 && mask[p - 1]) || (x < W - 1 && mask[p + 1]) || (y > 0 && mask[p - W]) || (y < H - 1 && mask[p + W]);
    if (edge) d[p * 4 + 3] = 150;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;
  ctx.putImageData(id, 0, 0);
  const pad = 2;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1; out.height = maxY - minY + 1;
  out.getContext("2d").drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  out.bgMask = { mask, W, H, minX, minY }; // used for garment shape hints
  return out;
}

/** Loads a canvas back as an <img> so existing code that reads naturalWidth keeps working. */
export function canvasToImage(canvas) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("cutout decode failed"));
    i.src = canvas.toDataURL("image/png");
  });
}

/**
 * Rough garment class from its cut-out silhouette:
 *  "bottoms"    tall, with backdrop showing between two legs near the hem
 *  "one-pieces" tall and solid (dress, jumpsuit, long coat on a form)
 *  "tops"       everything else
 */
export function garmentKind(cut) {
  if (!cut || !cut.bgMask) return "tops";
  const { mask, W, minX, minY } = cut.bgMask;
  const w = cut.width, h = cut.height;
  const ar = h / w;
  if (ar < 1.45) return "tops";
  // Scan the bottom 25% for a background gap in the middle third.
  let gapRows = 0, rows = 0;
  for (let y = Math.floor(h * 0.72); y < h * 0.97; y += 2) {
    rows++;
    let run = 0, best = 0;
    for (let x = Math.floor(w * 0.3); x < w * 0.7; x++) {
      const p = (minY + y) * W + (minX + x);
      if (mask[p]) { run++; if (run > best) best = run; } else run = 0;
    }
    if (best > w * 0.04) gapRows++;
  }
  return rows && gapRows / rows > 0.5 ? "bottoms" : "one-pieces";
}
