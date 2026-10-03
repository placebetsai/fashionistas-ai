/**
 * Shared HTTP + image helpers for the /api/tryon routes (lane-3).
 *
 * This module exports no onRequest* handlers, so Pages does not route it
 * (a handler-less function file falls through to the static asset service).
 */

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

/** Error that already knows the HTTP status + stable machine code. */
export class TryonError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "TryonError";
    this.status = status;
    this.code = code;
  }
}

function statusOf(err) {
  const s = err && Number.isInteger(err.status) ? err.status : 0;
  return s >= 400 && s <= 599 ? s : 500;
}

function codeOf(err) {
  if (err && typeof err.code === "string" && err.code) return err.code;
  return "internal_error";
}

function messageOf(err) {
  if (err && typeof err.message === "string" && err.message) {
    return err.message.slice(0, 500);
  }
  try {
    return String(err).slice(0, 500);
  } catch {
    return "unknown error";
  }
}

/** Non-2xx JSON with a top-level "error" key. Never a fake image. */
export function errorResponse(err) {
  return json({ error: messageOf(err), code: codeOf(err) }, statusOf(err));
}

export function toTryonError(err) {
  if (err instanceof TryonError) return err;
  return new TryonError(statusOf(err), codeOf(err), messageOf(err));
}

/** 32 lowercase hex chars — used for R2 object keys and /api/tryon/image ids. */
export function randomHex() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  }
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  let out = "";
  for (const b of buf) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Random 31-bit seed for a preview when the caller did not send one. */
export function randomSeed() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % 2147483647;
}

function ascii(bytes, start, length) {
  let s = "";
  for (let i = start; i < start + length && i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

/**
 * Identify an image from its magic bytes. Returns a real MIME type or null.
 * Deliberately strict: no guessing from the filename, no defaults.
 */
export function sniffImageType(bytes) {
  if (!bytes || bytes.length < 12) return null;
  // PNG
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // GIF
  if (ascii(bytes, 0, 4) === "GIF8") return "image/gif";
  // WEBP / RIFF....WEBP
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  // HEIC / HEIF family (iPhone default) — detected so we can reject clearly.
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "heif"].includes(brand)) {
      return "image/heic";
    }
  }
  return null;
}

export function extForType(type) {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export function typeForExt(ext) {
  switch (String(ext || "").toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}
