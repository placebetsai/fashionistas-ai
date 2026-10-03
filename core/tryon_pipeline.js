// core/tryon_pipeline.js — client-side virtual try-on architecture.
//
// WHAT RUNS WHERE (be precise about this; marketing copy has been wrong before)
//
//   layer 1 — canvas composition ......... ALWAYS local, always free, no AI
//             Cut the garment out, scale/rotate it, place it on the body.
//             Deterministic pixel work in the user's own tab.
//
//   layer 2 — MediaPipe Pose ............. local model in the tab, free,
//             downloaded once and cached. Gives shoulder/hip/wrist anchors so
//             the garment lands on a body instead of floating over it.
//
//   layer 3 — generative IDM-VTON swap ... NOT local. This is a diffusion model
//             and it does not fit in a browser tab. It runs on a remote
//             endpoint WE must provide, and it may cost money.
//             We never claim layer 3 is "$0 and keyless": it is opt-in, it
//             requires an endpoint, and if none is configured the pipeline
//             returns {ok:false, error:"generative_endpoint_unconfigured"}
//             instead of returning a plausible-looking fake.
//
//   caching — R2 ......................... only reachable through a Worker that
//             mints short-lived signed URLs. Unsigned public buckets are never
//             used; no user image is ever left world-readable.

const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";
const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const TASK_VISION_SPEC = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

/* ------------------------------------------------------------------ types */
/*  Keypoint indices follow MediaPipe's 33-point BLAZEPOSE layout. */
export const POSE = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function makeCanvas(w, h) {
  if (typeof document !== "undefined" && document.createElement) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") return reject(new Error("no_document"));
    const s = document.createElement("script");
    s.type = "module";
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error(`script_load_failed:${src}`));
    document.head.appendChild(s);
  });
}

/* ══════════════════════════════════════════════ 1) pose (local, free) ══════ */

let POSE_LANDMARKER = null;

/**
 * Load MediaPipe Pose once and reuse it. Purely local after the first fetch.
 *
 * @returns {Promise<{ok:boolean, error?:string, reason?:string}>}
 */
export async function loadPoseLandmarker({ force = false } = {}) {
  if (POSE_LANDMARKER && !force) return { ok: true };
  if (typeof document === "undefined") return { ok: false, error: "no_document" };

  try {
    const vision = await import(/* @vite-ignore */ TASK_VISION_SPEC);
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
    POSE_LANDMARKER = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
      runningMode: "IMAGE",
      numPoses: 1
    });
    return { ok: true };
  } catch (e) {
    POSE_LANDMARKER = null;
    // Distinguish "no network / CDN blocked" from "this device has no WebGL".
    return {
      ok: false,
      error: `pose_unavailable: ${(e && e.message) || e}`,
      reason: typeof navigator !== "undefined" && navigator.onLine === false
        ? "offline"
        : "load_failed"
    };
  }
}

/**
 * Locate the body in an image.
 * @returns {Promise<{ok:boolean, landmarks?:Array<{x:number,y:number,z:number,
 *            score:number}>, error?:string}>}
 */
export async function estimatePose(image) {
  if (!POSE_LANDMARKER) {
    const load = await loadPoseLandmarker();
    if (!load.ok) return { ok: false, error: load.error };
  }
  try {
    const res = POSE_LANDMARKER.detect(image);
    const list = res && res.landmarks && res.landmarks[0];
    if (!list || !list.length) return { ok: false, error: "no_body_detected" };
    return {
      ok: true,
      landmarks: list.map((p, i) => ({
        x: p.x, y: p.y, z: p.z || 0,
        score: p.visibility != null ? p.visibility : 1,
        index: i
      }))
    };
  } catch (e) {
    return { ok: false, error: `pose_failed: ${(e && e.message) || e}` };
  }
}

/**
 * Derive garment placement anchors from landmarks. All in normalised 0..1
 * coordinates so they survive any canvas resolution.
 */
export function bodyAnchors(landmarks) {
  if (!landmarks || landmarks.length < 29) return null;
  const pt = (i) => ({ x: landmarks[i].x, y: landmarks[i].y });
  const ls = pt(POSE.LEFT_SHOULDER), rs = pt(POSE.RIGHT_SHOULDER);
  const lh = pt(POSE.LEFT_HIP), rh = pt(POSE.RIGHT_HIP);

  const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  const torsoLength = Math.hypot((ls.x + rs.x) / 2 - (lh.x + rh.x) / 2,
                                 (ls.y + rs.y) / 2 - (lh.y + rh.y) / 2);
  const shoulderAngleDeg = Math.atan2(rs.y - ls.y, rs.x - ls.x) * 180 / Math.PI;

  return {
    shoulderCenter: { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 },
    hipCenter: { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 },
    shoulderWidth,
    torsoLength,
    shoulderAngleDeg,
    scale: shoulderWidth,           // 1 unit ~= shoulder width
    leftShoulder: ls, rightShoulder: rs,
    leftHip: lh, rightHip: rh,
    neckline: { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 - torsoLength * 0.12 },
    sleeveEnds: [pt(POSE.LEFT_WRIST), pt(POSE.RIGHT_WRIST)]
  };
}

/* ═══════════════════════════════════════ 2) canvas composition (free) ═════ */

/**
 * Draw pose landmarks onto a canvas — the debugging/verification view that
 * lets a user SEE where the garment will be anchored.
 */
export function drawPoseOverlay(canvas, landmarks, { color = "#7ee787", radius = 4 } = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const W = canvas.width, H = canvas.height;
  const pairs = [
    [POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER],
    [POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW], [POSE.LEFT_ELBOW, POSE.LEFT_WRIST],
    [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW], [POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST],
    [POSE.LEFT_SHOULDER, POSE.LEFT_HIP], [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP],
    [POSE.LEFT_HIP, POSE.RIGHT_HIP],
    [POSE.LEFT_HIP, POSE.LEFT_KNEE], [POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
    [POSE.RIGHT_HIP, POSE.RIGHT_KNEE], [POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE]
  ];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, Math.round(W / 260));
  ctx.globalAlpha = 0.9;
  for (const [a, b] of pairs) {
    if (!landmarks[a] || !landmarks[b]) continue;
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * W, landmarks[a].y * H);
    ctx.lineTo(landmarks[b].x * W, landmarks[b].y * H);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc(lm.x * W, lm.y * H, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return true;
}

/**
 * Composite a garment over a person image using pose anchors.
 * This is plain canvas math — no model, no network, deterministic.
 *
 * @param {object}  opts
 * @param {number}  opts.width/height   output size
 * @param {Array}   opts.personLandmarks pose points (0..1)
 * @param {object}  opts.anchors        from bodyAnchors()
 * @param {number}  [opts.cover]        0..1 how much of the torso to cover
 * @returns {{ok:boolean, canvas?:HTMLCanvasElement, placement?:object,
 *            error?:string}}
 */
export function composeTryOn({ personImage, garmentImage, width, height,
                              personLandmarks, anchors, cover = 0.62,
                              rotationDeg = null, opacity = 1 }) {
  if (!personImage || !garmentImage) return { ok: false, error: "missing_layer" };
  if (!anchors) return { ok: false, error: "no_anchors" };

  try {
    const W = width || personImage.naturalWidth || personImage.width || 720;
    const H = height || personImage.naturalHeight || personImage.height || 960;
    const out = makeCanvas(W, H);
    const ctx = out.getContext("2d");
    if (!ctx) return { ok: false, error: "no_2d_context" };

    ctx.drawImage(personImage, 0, 0, W, H);

    const gwRaw = garmentImage.naturalWidth || garmentImage.width || 1;
    const ghRaw = garmentImage.naturalHeight || garmentImage.height || 1;

    // Anchor to the shoulder line: width follows shoulder span, so the garment
    // scales with the person rather than with the source photo.
    const targetW = anchors.shoulderWidth * W * 1.9;
    const ratio = targetW / gwRaw;
    const targetH = ghRaw * ratio;

    const cx = anchors.shoulderCenter.x * W;
    const cy = anchors.shoulderCenter.y * H + (anchors.torsoLength * H) * (cover - 0.5);
    const angle = rotationDeg == null ? (anchors.shoulderAngleDeg * Math.PI) / 180 : (rotationDeg * Math.PI) / 180;

    ctx.save();
    ctx.globalAlpha = clamp(opacity, 0, 1);
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.drawImage(garmentImage, -targetW / 2, -targetH * 0.22, targetW, targetH);
    ctx.restore();

    return {
      ok: true,
      canvas: out,
      placement: {
        anchor: "shoulder_center",
        x: round3(cx / W), y: round3(cy / H),
        width: round3(targetW / W), height: round3(targetH / H),
        rotationDeg: round3((angle * 180) / Math.PI),
        coverage: cover
      }
    };
  } catch (e) {
    return { ok: false, error: `compose_failed: ${(e && e.message) || e}` };
  }
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/* ═══════════════════════════════ 3) generative swap (remote, opt-in) ══════ */

/**
 * Request a real IDM-VTON generation from a remote endpoint WE control.
 *
 * Refuses to run with no endpoint — this is the single most important guard in
 * the file: without it, a "try-on result" could be any image, including one we
 * invented. There is no offline fallback and there must never be one.
 *
 * @param {object}   opts
 * @param {string}   opts.endpoint      Worker route, e.g. https://.../api/tryon
 * @param {Blob}     opts.person
 * @param {Blob}     opts.garment
 * @param {string}   [opts.token]       short-lived signed token from our Worker
 * @param {string}   [opts.model]       e.g. "yisol/IDM-VTON"
 * @returns {Promise<{ok:boolean, source:string, url?:string, error?:string}>}
 */
export async function requestGenerativeTryOn({
  endpoint, person, garment, token, model = "yisol/IDM-VTON", timeoutMs = 120000
} = {}) {
  if (!endpoint) {
    return {
      ok: false,
      source: "none",
      error: "generative_endpoint_unconfigured: no remote inference endpoint set; composeTryOn() still works locally"
    };
  }
  if (typeof fetch !== "function") return { ok: false, source: "none", error: "no_fetch" };
  if (!person || !garment) return { ok: false, source: "none", error: "missing_input_image" };

  try {
    const form = new FormData();
    form.append("person", person, "person.jpg");
    form.append("garment", garment, "garment.jpg");
    form.append("model", model);

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

    const res = await fetch(endpoint, {
      method: "POST",
      body: form,
      headers,
      signal: ctrl ? ctrl.signal : undefined
    });
    if (timer) clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        source: "generative",
        error: `generative_http_${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`
      };
    }

    const data = await res.json().catch(() => null);
    const url = data && (data.url || data.output || data.image);
    if (!url) return { ok: false, source: "generative", error: "generative_no_url_in_response" };

    return { ok: true, source: "generative", url, model };
  } catch (e) {
    return {
      ok: false,
      source: "generative",
      error: `generative_failed: ${(e && e.name === "AbortError") ? `timeout_${timeoutMs}ms` : (e && e.message) || e}`
    };
  }
}

/* ═══════════════════════════════════════════ 4) signed R2 caching ═════════ */

/**
 * Ask OUR Worker for a short-lived signed URL. Images are never uploaded to a
 * public bucket and never left world-readable.
 *
 * @returns {Promise<{ok:boolean, uploadUrl?:string, key?:string, error?:string}>}
 */
export async function requestSignedUpload({ apiBase, key, contentType = "image/jpeg", ttlSeconds = 300 } = {}) {
  if (!apiBase) return { ok: false, error: "api_base_unconfigured" };
  if (!key) return { ok: false, error: "missing_object_key" };
  try {
    const res = await fetch(`${apiBase}/api/tryon/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, contentType, ttlSeconds })
    });
    if (!res.ok) return { ok: false, error: `sign_http_${res.status}` };
    const data = await res.json();
    if (!data || !data.uploadUrl) return { ok: false, error: "sign_no_url" };
    return { ok: true, uploadUrl: data.uploadUrl, key: data.key || key, expiresAt: data.expiresAt || null };
  } catch (e) {
    return { ok: false, error: `sign_failed: ${(e && e.message) || e}` };
  }
}

/** Put bytes to the signed URL. Returns the public/CDN URL on success. */
export async function uploadWithSignedUrl(uploadUrl, blob) {
  if (!uploadUrl || !blob) return { ok: false, error: "missing_upload_part" };
  try {
    const res = await fetch(uploadUrl, { method: "PUT", body: blob,
      headers: blob.type ? { "content-type": blob.type } : undefined });
    if (!res.ok) return { ok: false, error: `upload_http_${res.status}` };
    // The signature lives in the query string; the durable key is the bare URL.
    return { ok: true, url: uploadUrl.split("?")[0] };
  } catch (e) {
    return { ok: false, error: `upload_failed: ${(e && e.message) || e}` };
  }
}

/* ═══════════════════════════════════════════════════ 5) orchestrator ══════ */

/**
 * Full flow with an explicit per-stage report, so the UI can show exactly
 * which stage produced the result the user is looking at.
 *
 *   stages: pose -> compose -> (optional) generative -> (optional) cache
 */
export class TryOnPipeline {
  constructor({ apiBase = null, generativeEndpoint = null, token = null,
                useGenerative = false, debugOverlay = false } = {}) {
    this.apiBase = apiBase;
    this.generativeEndpoint = generativeEndpoint;
    this.token = token;
    this.useGenerative = useGenerative === true;
    this.debugOverlay = debugOverlay === true;
  }

  /**
   * @returns {Promise<{ok:boolean, canvas?:object, url?:string,
   *   source:"compose"|"generative", stages:object, error?:string}>}
   */
  async run({ personImage, garmentImage, width, height } = {}) {
    const stages = { pose: null, compose: null, generative: null, cache: null };

    // ── stage 1: pose (best-effort; compose can still proceed without it)
    let landmarks = null, anchors = null;
    const poseRes = await estimatePose(personImage);
    stages.pose = poseRes.ok ? "ok" : `skipped:${poseRes.error}`;
    if (poseRes.ok) {
      landmarks = poseRes.landmarks;
      anchors = bodyAnchors(landmarks);
    }

    if (!anchors) {
      // Honest fallback: a fixed, documented layout rather than a fake body.
      anchors = {
        shoulderCenter: { x: 0.5, y: 0.32 },
        hipCenter: { x: 0.5, y: 0.55 },
        shoulderWidth: 0.22,
        torsoLength: 0.23,
        shoulderAngleDeg: 0,
        scale: 0.22
      };
      stages.pose += "|using_default_anchor_layout";
    }

    // ── stage 2: local composition
    const composed = composeTryOn({
      personImage, garmentImage, width, height,
      personLandmarks: landmarks, anchors
    });
    stages.compose = composed.ok ? "ok" : `failed:${composed.error}`;
    if (!composed.ok) return { ok: false, stages, source: "compose", error: composed.error };

    let finalCanvas = composed.canvas;

    // ── stage 3: generative (only if explicitly enabled AND configured)
    if (this.useGenerative) {
      const personBlob = await this.#imageToBlob(personImage).catch(() => null);
      const garmentBlob = await this.#imageToBlob(garmentImage).catch(() => null);
      const gen = await requestGenerativeTryOn({
        endpoint: this.generativeEndpoint,
        person: personBlob,
        garment: garmentBlob,
        token: this.token
      });
      stages.generative = gen.ok ? "ok" : `skipped:${gen.error}`;
      if (gen.ok) {
        return { ok: true, url: gen.url, source: "generative", stages, placement: composed.placement };
      }
      // fall through: local composition still stands, and we say why
    } else {
      stages.generative = "disabled";
    }

    // ── stage 4: optional signed cache
    if (this.apiBase && composed.ok) {
      try {
        const blob = await this.#canvasToBlob(finalCanvas);
        const key = `tryon/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
        const signed = await requestSignedUpload({ apiBase: this.apiBase, key });
        if (signed.ok) {
          const up = await uploadWithSignedUrl(signed.uploadUrl, blob);
          stages.cache = up.ok ? "ok" : `failed:${up.error}`;
        } else {
          stages.cache = `failed:${signed.error}`;
        }
      } catch (e) {
        stages.cache = `failed:${e.message}`;
      }
    } else {
      stages.cache = "disabled";
    }

    return { ok: true, canvas: finalCanvas, source: "compose", stages, placement: composed.placement };
  }

  /** Any image source (element/VideoFrame/canvas) -> JPEG Blob. */
  #imageToBlob(image) {
    if (!image) return Promise.reject(new Error("missing_image"));
    if (image instanceof Blob) return Promise.resolve(image);
    const w = image.naturalWidth || image.videoWidth || image.width;
    const h = image.naturalHeight || image.videoHeight || image.height;
    if (!w || !h) return Promise.reject(new Error("image_has_no_dimensions"));
    const c = makeCanvas(w, h);
    c.getContext("2d").drawImage(image, 0, 0, w, h);
    return this.#canvasToBlob(c);
  }

  #canvasToBlob(canvas) {
    if (canvas && typeof canvas.convertToBlob === "function") {
      return canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    }
    return new Promise((resolve, reject) => {
      if (!canvas || !canvas.toBlob) return reject(new Error("no_to_blob"));
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("to_blob_failed"))), "image/jpeg", 0.9);
    });
  }
}

export default {
  POSE,
  loadPoseLandmarker,
  estimatePose,
  bodyAnchors,
  drawPoseOverlay,
  composeTryOn,
  requestGenerativeTryOn,
  requestSignedUpload,
  uploadWithSignedUrl,
  TryOnPipeline
};
