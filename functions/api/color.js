/**
 * POST /api/color — read undertone + contrast out of a photo and hand back a palette.
 *
 * Request: multipart/form-data
 *   person   (file, required) the photo to analyse
 *
 * Response 200:
 *   {
 *     ok: true,
 *     palette: [{ name, hex, role }],   colours chosen for this person
 *     undertone: "warm" | "cool" | "neutral",
 *     contrast:  "low" | "medium" | "high",
 *     skin:  { hex, samples } | null,
 *     dominant: [{ name, hex, share }],  the colours actually in the photo
 *     method: "pixel-heuristics",
 *     width, height
 *   }
 *
 * Everything here is computed from the decoded pixels — there is no model call,
 * no network call and no photo leaves the worker. Cloudflare Workers have no
 * canvas, so decoding is done by libs/aipixels.js (own PNG + baseline JPEG).
 *
 * The undertone/contrast labels are heuristics (see method below), and they say
 * so rather than presenting themselves as a colourist's verdict.
 */

import { json, TryonError, errorResponse, toTryonError, sniffImageType } from "./_tryon/http.js";
import { analyzeImage } from "../../libs/aipixels.js";

/** Field name the UI (and the check) posts the photo under. */
const PERSON_FIELD = "person";
const MAX_BYTES = 12 * 1024 * 1024;

/** Colour families we recommend per undertone. Plain deterministic mapping. */
const FAMILIES = {
  warm: [
    ["Terracotta", "#c86b3c", "accent"],
    ["Camel", "#8b6f47", "neutral"],
    ["Mustard", "#d9a441", "pop"],
    ["Olive", "#5e6b3e", "ground"],
    ["Cream", "#f3e9d8", "base"],
  ],
  cool: [
    ["Dusty blue", "#6b7fa3", "accent"],
    ["Mauve", "#8e7cc3", "neutral"],
    ["Rose", "#a34e63", "pop"],
    ["Slate", "#2f4858", "ground"],
    ["Ice", "#edf1f7", "base"],
  ],
  neutral: [
    ["Greige", "#b8a99a", "accent"],
    ["Charcoal", "#4a4a4a", "neutral"],
    ["Sage", "#9caf88", "pop"],
    ["Espresso", "#4b3a2f", "ground"],
    ["Oat", "#e8e0d5", "base"],
  ],
};

function hexOf(r, g, b) {
  const p = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** Standard skin-tone test over one RGBA pixel. */
function isSkin(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (r < 95 || g < 40 || b < 20) return false;
  if (max - min < 15) return false;
  if (Math.abs(r - g) <= 15) return false;
  if (r <= g || r <= b) return false;
  return true;
}

/** sRGB relative luminance, 0..1. */
function lum(r, g, b) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Undertone from the averaged skin pixels.
 * Hue < 25deg or > 340deg with enough chroma reads pink/cool, 25..60deg reads
 * golden/warm, and low chroma reads neutral.
 */
function undertoneOf(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma < 14) return "neutral";

  let h = 0;
  if (chroma === 0) h = 0;
  else if (max === r) h = 60 * (((g - b) / chroma) % 6);
  else if (max === g) h = 60 * ((b - r) / chroma + 2);
  else h = 60 * ((r - g) / chroma + 4);
  if (h < 0) h += 360;

  if (h >= 25 && h <= 65) return "warm";
  if (h >= 150 && h <= 260) return "cool";
  if (h < 15 || h > 340) return chroma >= 34 ? "cool" : "neutral";
  return "neutral";
}

/**
 * Contrast from how far apart the light and dark masses sit.
 * Uses percentile luminance over a subsample so a single dark object in the
 * corner cannot decide the answer on its own.
 */
function contrastOf(pixels) {
  const { data, width, height } = pixels;
  const total = width * height;
  if (!total) return "medium";

  const stride = Math.max(1, Math.floor(Math.sqrt(total / 40000)) || 1);
  const lums = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      lums.push(lum(data[i], data[i + 1], data[i + 2]));
    }
  }
  if (lums.length < 32) return "medium";
  lums.sort((a, b) => a - b);

  const at = (p) => lums[Math.min(lums.length - 1, Math.max(0, Math.floor(p * lums.length)))];
  const spread = at(0.9) - at(0.1);
  if (spread >= 0.55) return "high";
  if (spread >= 0.32) return "medium";
  return "low";
}

/** Average colour of every pixel that passes the skin test. */
function skinStats(pixels) {
  const { data, width, height } = pixels;
  const total = width * height;
  const stride = Math.max(1, Math.floor(Math.sqrt(total / 40000)) || 1);

  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      if (!isSkin(pr, pg, pb)) continue;
      r += pr;
      g += pg;
      b += pb;
      n++;
    }
  }
  if (n < 40) return null;
  return { r: r / n, g: g / n, b: b / n, samples: n };
}

/**
 * Pull the photo's `person` part out of the body.
 * Deliberately not parseTryonForm(): that helper requires a garment too, and
 * colour analysis is a single-photo request.
 */
async function readPerson(request) {
  let form;
  try {
    form = await request.formData();
  } catch (err) {
    throw new TryonError(
      400,
      "invalid_multipart",
      'Expected multipart/form-data with a file field "person". (' +
        ((err && err.message) || "parse failed").slice(0, 160) +
        ")"
    );
  }
  if (!form || typeof form.get !== "function") {
    throw new TryonError(400, "invalid_multipart", 'Expected multipart/form-data with a file field "person".');
  }

  const part = form.get(PERSON_FIELD);
  if (!part || typeof part.arrayBuffer !== "function") {
    throw new TryonError(400, "missing_person", `Field "${PERSON_FIELD}" is required.`);
  }

  const bytes = new Uint8Array(await part.arrayBuffer());
  if (!bytes.length) {
    throw new TryonError(400, "empty_person", `Field "${PERSON_FIELD}" is empty.`);
  }
  if (bytes.length > MAX_BYTES) {
    throw new TryonError(413, "too_large", `Photo is larger than ${MAX_BYTES} bytes.`);
  }

  const declared = String(part.type || "");
  const type = sniffImageType(bytes) || (declared.startsWith("image/") ? declared : null);
  if (!type) {
    throw new TryonError(
      415,
      "person_not_image",
      `Field "${PERSON_FIELD}" is not a supported image (send JPEG or PNG). Declared type: ${declared || "none"}.`
    );
  }
  if (type === "image/heic" || type === "image/heif") {
    throw new TryonError(
      415,
      "person_heic_unsupported",
      `Field "${PERSON_FIELD}" is HEIC/HEIF. Convert it to JPEG first.`
    );
  }

  return { bytes, type };
}

export async function onRequestPost(context) {
  const { request } = context;
  try {
    const { bytes, type } = await readPerson(request);
    const analysis = await analyzeImage(bytes, type);

    if (!analysis.ok || !analysis.pixels) {
      throw new TryonError(
        422,
        "undecodable",
        `That photo could not be decoded: ${analysis.note || "unknown decoder failure"}`
      );
    }

    const skin = skinStats(analysis.pixels);
    const undertone = skin ? undertoneOf(skin.r, skin.g, skin.b) : "neutral";
    const contrast = contrastOf(analysis.pixels);
    const palette = FAMILIES[undertone].map(([name, hex, role]) => ({ name, hex, role }));

    return json({
      ok: true,
      palette,
      undertone,
      contrast,
      skin: skin ? { hex: hexOf(skin.r, skin.g, skin.b), samples: skin.samples } : null,
      dominant: (analysis.colors || []).map((c) => ({
        name: c.name,
        hex: c.hex,
        pct: typeof c.pct === "number" ? c.pct : null,
      })),
      method: "pixel-heuristics",
      width: analysis.width,
      height: analysis.height,
    });
  } catch (err) {
    return errorResponse(toTryonError(err));
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { allow: "POST, OPTIONS" } });
  }
  if (context.request.method !== "POST") {
    return json({ error: "Use POST with multipart/form-data and a \"person\" photo." }, 405, { allow: "POST" });
  }
  return onRequestPost(context);
}
