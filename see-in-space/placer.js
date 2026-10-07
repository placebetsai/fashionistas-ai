/**
 * Free Instant room placer — client-side only.
 * Wall: 4-corner perspective warp of listing image into a room photo.
 * Floor: drag / scale / rotate affine overlay.
 * Never marketed as photoreal.
 */

const ROOM_KEY = "fashionistas.seeInSpace.room";

/** Solve 8 unknowns for projective map unit square -> quad. */
export function computeHomography(dst) {
  // src: (0,0),(1,0),(1,1),(0,1)  dst: [{x,y} x4] TL TR BR BL
  const [p0, p1, p2, p3] = dst;
  const A = [];
  const b = [];
  const pairs = [
    [0, 0, p0],
    [1, 0, p1],
    [1, 1, p2],
    [0, 1, p3],
  ];
  for (const [u, v, p] of pairs) {
    A.push([u, v, 1, 0, 0, 0, -u * p.x, -v * p.x]);
    b.push(p.x);
    A.push([0, 0, 0, u, v, 1, -u * p.y, -v * p.y]);
    b.push(p.y);
  }
  const h = solve8(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function solve8(A, b) {
  // Gaussian elimination with partial pivot on 8x8
  const n = 8;
  const M = A.map((row, i) => row.concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) throw new Error("degenerate quad");
    [M[col], M[piv]] = [M[piv], M[col]];
    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

export function applyH(H, u, v) {
  const w = H[6] * u + H[7] * v + H[8];
  return {
    x: (H[0] * u + H[1] * v + H[2]) / w,
    y: (H[3] * u + H[4] * v + H[5]) / w,
  };
}

/** Inverse map: screen -> unit square (for sampling). */
export function invertH(H) {
  // adjugate / det for 3x3
  const a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7], i = H[8];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const Hh = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error("non-invertible");
  return [A / det, D / det, G / det, B / det, E / det, Hh / det, C / det, F / det, I / det];
}

/**
 * Draw listing image warped into quad on top of room canvas.
 * corners: TL, TR, BR, BL in canvas pixel coords.
 */
export function drawPerspectiveOverlay(ctx, roomImg, itemImg, corners, { opacity = 1, shadow = 0.35 } = {}) {
  const W = roomImg.naturalWidth || roomImg.width;
  const H = roomImg.naturalHeight || roomImg.height;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(roomImg, 0, 0, W, H);

  const Hm = computeHomography(corners);
  const Hi = invertH(Hm);

  // Bounding box of quad
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of corners) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(W - 1, Math.ceil(maxX));
  maxY = Math.min(H - 1, Math.ceil(maxY));

  const iw = itemImg.naturalWidth || itemImg.width;
  const ih = itemImg.naturalHeight || itemImg.height;
  const tmp = document.createElement("canvas");
  tmp.width = iw;
  tmp.height = ih;
  const tctx = tmp.getContext("2d");
  tctx.drawImage(itemImg, 0, 0);
  const src = tctx.getImageData(0, 0, iw, ih).data;

  const out = ctx.getImageData(0, 0, W, H);
  const dst = out.data;
  const op = Math.max(0, Math.min(1, opacity));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const uv = applyH(Hi, x, y);
      if (uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) continue;
      const sx = Math.min(iw - 1, Math.max(0, uv.x * (iw - 1)));
      const sy = Math.min(ih - 1, Math.max(0, uv.y * (ih - 1)));
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(iw - 1, x0 + 1), y1 = Math.min(ih - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * iw + x0) * 4;
      const i10 = (y0 * iw + x1) * 4;
      const i01 = (y1 * iw + x0) * 4;
      const i11 = (y1 * iw + x1) * 4;
      const r = src[i00] * (1 - fx) * (1 - fy) + src[i10] * fx * (1 - fy) + src[i01] * (1 - fx) * fy + src[i11] * fx * fy;
      const g = src[i00 + 1] * (1 - fx) * (1 - fy) + src[i10 + 1] * fx * (1 - fy) + src[i01 + 1] * (1 - fx) * fy + src[i11 + 1] * fx * fy;
      const b = src[i00 + 2] * (1 - fx) * (1 - fy) + src[i10 + 2] * fx * (1 - fy) + src[i01 + 2] * (1 - fx) * fy + src[i11 + 2] * fx * fy;
      const a = (src[i00 + 3] * (1 - fx) * (1 - fy) + src[i10 + 3] * fx * (1 - fy) + src[i01 + 3] * (1 - fx) * fy + src[i11 + 3] * fx * fy) / 255;
      if (a < 0.02) continue;
      const di = (y * W + x) * 4;
      const blend = a * op;
      // soft drop toward bottom of quad (preview shadow, not photoreal)
      const shade = 1 - shadow * 0.25 * uv.y;
      dst[di] = dst[di] * (1 - blend) + r * shade * blend;
      dst[di + 1] = dst[di + 1] * (1 - blend) + g * shade * blend;
      dst[di + 2] = dst[di + 2] * (1 - blend) + b * shade * blend;
    }
  }
  ctx.putImageData(out, 0, 0);
}

/**
 * Floor mode: draw item with translate/scale/rotate about center.
 */
export function drawAffineOverlay(ctx, roomImg, itemImg, { x, y, scale, rotation, opacity = 1, shadow = 0.35 } = {}) {
  const W = roomImg.naturalWidth || roomImg.width;
  const H = roomImg.naturalHeight || roomImg.height;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(roomImg, 0, 0, W, H);
  const iw = itemImg.naturalWidth || itemImg.width;
  const ih = itemImg.naturalHeight || itemImg.height;
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  if (shadow > 0.01) {
    ctx.shadowColor = `rgba(0,0,0,${shadow})`;
    ctx.shadowBlur = 18 * scale;
    ctx.shadowOffsetY = 10 * scale;
  }
  ctx.translate(x, y);
  ctx.rotate(rotation || 0);
  ctx.drawImage(itemImg, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

export function defaultWallCorners(W, H) {
  const m = Math.min(W, H) * 0.18;
  return [
    { x: W * 0.25, y: H * 0.22 },
    { x: W * 0.75, y: H * 0.2 },
    { x: W * 0.78, y: H * 0.62 },
    { x: W * 0.22, y: H * 0.65 },
  ].map((p) => ({ x: Math.max(m * 0.2, Math.min(W - m * 0.2, p.x)), y: Math.max(m * 0.2, Math.min(H - m * 0.2, p.y)) }));
}

export function defaultFloorPose(W, H, itemImg) {
  const iw = itemImg.naturalWidth || itemImg.width || 100;
  const ih = itemImg.naturalHeight || itemImg.height || 100;
  const scale = Math.min((W * 0.35) / iw, (H * 0.35) / ih);
  return { x: W * 0.5, y: H * 0.62, scale, rotation: 0 };
}

export function saveRoomDataUrl(dataUrl) {
  try {
    localStorage.setItem(ROOM_KEY, dataUrl);
  } catch (_) { /* quota */ }
}

export function loadRoomDataUrl() {
  try {
    return localStorage.getItem(ROOM_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load item image"));
    img.src = url;
  });
}

export function imageToDataUrl(img, maxEdge = 1600) {
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * scale);
  c.height = Math.round(h0 * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
