/**
 * multipart/form-data parsing for POST /api/tryon (lane-3) and
 * POST /api/tryon/hd.
 *
 * Required file parts: person, garment.
 * Optional file parts: garment2, garment3 (top + bottom + outerwear chains —
 * the /api/tryon/hd route ignores the chain and renders garment only).
 * Optional fields: previews, steps, photo_type, seed, crop,
 *                  category[2|3], description[2|3].
 *
 * No onRequest* exports here — this file is imported, not routed.
 */

import { TryonError, sniffImageType } from "./http.js";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const CATEGORIES = ["upper_body", "lower_body", "dresses"];
const PHOTO_TYPES = ["model", "flat-lay"];
/** FASHN VTON's supported sampler range; 20 is the product default. */
const STEPS_DEFAULT = 20;
const STEPS_MIN = 10;
const STEPS_MAX = 50;

function readField(form, name) {
  try {
    return form.get(name);
  } catch {
    return null;
  }
}

function intField(form, name, def, min, max) {
  const raw = readField(form, name);
  if (raw === null || raw === undefined || raw === "") return def;
  if (typeof raw !== "string") return def;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function categoryField(form, name, def) {
  const raw = readField(form, name);
  if (typeof raw !== "string" || !raw) return def;
  const v = raw.trim().toLowerCase();
  if (!CATEGORIES.includes(v)) {
    throw new TryonError(
      400,
      "invalid_" + name,
      `Field "${name}" must be one of ${CATEGORIES.join(", ")} (got "${v.slice(0, 40)}").`
    );
  }
  return v;
}

function descriptionField(form, name) {
  const raw = readField(form, name);
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 500);
}

function boolField(form, name, def) {
  const raw = readField(form, name);
  if (raw === null || raw === undefined || raw === "") return def;
  if (typeof raw !== "string") return def;
  const v = raw.trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no" || v === "off");
}

/**
 * Which photo the person image is:
 *   "model"    the person photo IS the model shot (the product's normal case)
 *   "flat-lay" the person image is a flat garment laid flat, not a person
 * Passed through to the provider as `photo_type` and mixed into the cache key,
 * because "same person photo + same garment" means a different render per mode.
 * Unvalidated here on purpose: the route owns the 422 so the error shape stays
 * with the other route-level field errors.
 */
function photoTypeField(form) {
  const raw = readField(form, "photo_type");
  if (raw === null || raw === undefined || raw === "") return "model";
  return String(raw).trim().toLowerCase();
}

async function readImagePart(form, name, required) {
  const part = readField(form, name);

  if (part === null || part === undefined || part === "") {
    if (required) {
      throw new TryonError(
        400,
        "missing_" + name,
        `Missing required multipart file field "${name}". Send multipart/form-data with fields "person" and "garment".`
      );
    }
    return null;
  }

  if (typeof part === "string") {
    throw new TryonError(
      400,
      "invalid_" + name,
      `Field "${name}" must be a file upload, not text.`
    );
  }

  const declared = typeof part.type === "string" ? part.type.toLowerCase().split(";")[0].trim() : "";
  if (typeof part.size === "number" && part.size > MAX_FILE_BYTES) {
    throw new TryonError(413, name + "_too_large", `File "${name}" is larger than the 15MB limit.`);
  }
  if (typeof part.size === "number" && part.size === 0) {
    throw new TryonError(400, name + "_empty", `File "${name}" is empty.`);
  }
  if (typeof part.arrayBuffer !== "function") {
    throw new TryonError(400, "invalid_" + name, `Field "${name}" is not a file upload.`);
  }

  const bytes = new Uint8Array(await part.arrayBuffer());
  if (bytes.length === 0) {
    throw new TryonError(400, name + "_empty", `File "${name}" is empty.`);
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw new TryonError(413, name + "_too_large", `File "${name}" is larger than the 15MB limit.`);
  }

  const sniffed = sniffImageType(bytes);
  const type = sniffed || (declared.startsWith("image/") ? declared : null);

  if (!type) {
    throw new TryonError(
      415,
      name + "_not_image",
      `Field "${name}" is not a supported image (send JPEG, PNG or WebP). Declared type: ${declared || "none"}.`
    );
  }
  if (type === "image/heic" || type === "image/heif") {
    throw new TryonError(
      415,
      name + "_heic_unsupported",
      `Field "${name}" is HEIC/HEIF, which the try-on model cannot read. Convert it to JPEG first.`
    );
  }

  return { field: name, bytes, type, size: bytes.length };
}

/**
 * @returns {Promise<{
 *   person: {field:string,bytes:Uint8Array,type:string,size:number},
 *   garments: Array<{field:string,file:object,category:string,description:string}>,
 *   previews: number,
 *   steps: number,
 *   photoType: string,
 *   seed: number|null,
 *   crop: boolean,
 *   requestedPreviews: number
 * }>}
 */
export async function parseTryonForm(request) {
  let form;
  try {
    form = await request.formData();
  } catch (err) {
    throw new TryonError(
      400,
      "invalid_multipart",
      "Expected multipart/form-data with file fields \"person\" and \"garment\". (" +
        ((err && err.message) || "parse failed").slice(0, 160) +
        ")"
    );
  }
  if (!form || typeof form.get !== "function") {
    throw new TryonError(400, "invalid_multipart", "Expected multipart/form-data request body.");
  }

  const person = await readImagePart(form, "person", true);
  const garment1 = await readImagePart(form, "garment", true);
  const garment2 = await readImagePart(form, "garment2", false);
  const garment3 = await readImagePart(form, "garment3", false);

  const garments = [
    {
      field: "garment",
      file: garment1,
      category: categoryField(form, "category", "upper_body"),
      description: descriptionField(form, "description"),
    },
  ];
  if (garment2) {
    garments.push({
      field: "garment2",
      file: garment2,
      category: categoryField(form, "category2", "lower_body"),
      description: descriptionField(form, "description2"),
    });
  }
  if (garment3) {
    garments.push({
      field: "garment3",
      file: garment3,
      category: categoryField(form, "category3", "upper_body"),
      description: descriptionField(form, "description3"),
    });
  }

  const requestedPreviews = intField(form, "previews", 3, 1, 6);
  const steps = intField(form, "steps", STEPS_DEFAULT, STEPS_MIN, STEPS_MAX);
  const photoType = photoTypeField(form);
  const seedRaw = readField(form, "seed");
  const seed =
    typeof seedRaw === "string" && seedRaw.trim() !== "" && Number.isFinite(Number.parseInt(seedRaw, 10))
      ? Math.max(0, Math.min(2147483646, Number.parseInt(seedRaw, 10)))
      : null;

  return {
    person,
    garments,
    previews: requestedPreviews,
    requestedPreviews,
    steps,
    photoType,
    seed,
    crop: boolField(form, "crop", true),
  };
}

export { PHOTO_TYPES, STEPS_DEFAULT, STEPS_MIN, STEPS_MAX };
