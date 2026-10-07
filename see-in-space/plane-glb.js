/**
 * Build a lightweight textured plane GLB from a listing image (client-side).
 * Used by <model-viewer ar ar-placement="wall|floor">. Free forever — no API.
 *
 * Dimensions are metres (model-viewer / Scene Viewer / Quick Look convention).
 * Keep under ~2MB by resizing the texture before encode.
 */

const encoder = new TextEncoder();

function pad4(n) {
  return (n + 3) & ~3;
}

function concatBuffers(parts) {
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), o);
    o += p.byteLength;
  }
  return out;
}

/**
 * Resize image to max edge, return PNG ArrayBuffer.
 * @param {CanvasImageSource} img
 * @param {number} maxEdge
 */
export async function imageToPngBytes(img, maxEdge = 1024) {
  const w0 = img.naturalWidth || img.width || 1;
  const h0 = img.naturalHeight || img.height || 1;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("PNG encode failed"))), "image/png", 0.92)
  );
  return blob.arrayBuffer();
}

/**
 * @param {ArrayBuffer} pngBytes
 * @param {{ widthM?: number, heightM?: number, name?: string }} opts
 * @returns {Blob} application/octet-stream GLB
 */
export function buildTexturedPlaneGlb(pngBytes, opts = {}) {
  const widthM = Math.max(0.05, Number(opts.widthM) || 0.5);
  const heightM = Math.max(0.05, Number(opts.heightM) || 0.7);
  const hw = widthM / 2;
  const hh = heightM / 2;
  // Plane in XY, facing +Z (wall hangs on Z-forward; floor uses Y-up rotate in viewer)
  // positions: TL, TR, BL, BR
  const positions = new Float32Array([
    -hw,  hh, 0,
     hw,  hh, 0,
    -hw, -hh, 0,
     hw, -hh, 0,
  ]);
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]);
  const uvs = new Float32Array([
    0, 1, 1, 1, 0, 0, 1, 0,
  ]);
  const indices = new Uint16Array([0, 2, 1, 1, 2, 3]);

  const posBuf = new Uint8Array(positions.buffer);
  const nrmBuf = new Uint8Array(normals.buffer);
  const uvBuf = new Uint8Array(uvs.buffer);
  const idxBuf = new Uint8Array(indices.buffer);
  const imgBuf = new Uint8Array(pngBytes);

  // Pack BIN: pos | nrm | uv | idx | img  (each padded to 4)
  const chunks = [];
  const offsets = {};
  let cursor = 0;
  function add(name, bytes, align = 4) {
    const pad = (align - (cursor % align)) % align;
    if (pad) {
      chunks.push(new Uint8Array(pad));
      cursor += pad;
    }
    offsets[name] = cursor;
    chunks.push(bytes);
    cursor += bytes.byteLength;
  }
  add("pos", posBuf, 4);
  add("nrm", nrmBuf, 4);
  add("uv", uvBuf, 4);
  add("idx", idxBuf, 4);
  add("img", imgBuf, 4);
  const binPad = (4 - (cursor % 4)) % 4;
  if (binPad) {
    chunks.push(new Uint8Array(binPad));
    cursor += binPad;
  }
  const bin = concatBuffers(chunks);
  const binLen = bin.byteLength;

  const gltf = {
    asset: { version: "2.0", generator: "fashionistas.ai see-in-space" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0, name: opts.name || "listing-plane" }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0,
      }],
    }],
    materials: [{
      name: "listing",
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      doubleSided: true,
      alphaMode: "OPAQUE",
    }],
    textures: [{ source: 0 }],
    images: [{ mimeType: "image/png", bufferView: 4 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: "VEC3",
        max: [hw, hh, 0], min: [-hw, -hh, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 4, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: 6, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: offsets.pos, byteLength: posBuf.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets.nrm, byteLength: nrmBuf.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets.uv, byteLength: uvBuf.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets.idx, byteLength: idxBuf.byteLength, target: 34963 },
      { buffer: 0, byteOffset: offsets.img, byteLength: imgBuf.byteLength },
    ],
    buffers: [{ byteLength: binLen }],
  };

  const json = encoder.encode(JSON.stringify(gltf));
  const jsonPad = (4 - (json.byteLength % 4)) % 4;
  const jsonChunk = new Uint8Array(json.byteLength + jsonPad);
  jsonChunk.set(json);
  for (let i = 0; i < jsonPad; i++) jsonChunk[json.byteLength + i] = 0x20; // spaces

  const totalLen = 12 + 8 + jsonChunk.byteLength + 8 + binLen;
  const out = new ArrayBuffer(totalLen);
  const view = new DataView(out);
  const u8 = new Uint8Array(out);
  // header
  view.setUint32(0, 0x46546c67, true); // glTF
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLen, true);
  // JSON chunk
  view.setUint32(12, jsonChunk.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true); // JSON
  u8.set(jsonChunk, 20);
  // BIN chunk
  const binStart = 20 + jsonChunk.byteLength;
  view.setUint32(binStart, binLen, true);
  view.setUint32(binStart + 4, 0x004e4942, true); // BIN\0
  u8.set(bin, binStart + 8);

  return new Blob([out], { type: "model/gltf-binary" });
}

/**
 * Convenience: image element + cm sizes → object URL for model-viewer.
 */
export async function listingImageToGlbUrl(img, { widthCm = 50, heightCm = 70, maxEdge = 1024 } = {}) {
  const png = await imageToPngBytes(img, maxEdge);
  const blob = buildTexturedPlaneGlb(png, {
    widthM: Number(widthCm) / 100,
    heightM: Number(heightCm) / 100,
  });
  return URL.createObjectURL(blob);
}
