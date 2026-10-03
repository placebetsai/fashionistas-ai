/**
 * Pixel analysis for closet photos (lane 5).
 *
 * Cloudflare Workers has NO canvas / createImageBitmap / image decoder, so this
 * file ships its own decoders:
 *   - PNG: 8/16-bit gray, RGB, palette, gray+alpha, RGBA (non-interlaced)
 *   - JPEG: baseline sequential Huffman (progressive JPEG is rejected honestly)
 *
 * Everything else degrades to `{ ok:false, note:"..." }` instead of guessing.
 */

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/* ------------------------------------------------------------------ decode */

export async function decodeImage(bytes, mime) {
  const u8 = toU8(bytes);
  try {
    if (isPng(u8, mime)) return await decodePng(u8);
    if (isJpeg(u8, mime)) return decodeJpeg(u8);
    return { ok: false, note: "unsupported image format (only PNG and JPEG are decoded here)" };
  } catch (err) {
    return { ok: false, note: `pixel decode failed: ${String((err && err.message) || err)}` };
  }
}

function toU8(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new Error("not bytes");
}

function isPng(u8, mime) {
  if (u8.length < 8) return false;
  for (let i = 0; i < 8; i++) if (u8[i] !== PNG_SIG[i]) return false;
  return true;
}

function isJpeg(u8, mime) {
  return u8.length > 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff;
}

/* -------------------------------------------------------------------- PNG */

async function inflate(bytes) {
  const ds = new DecompressionStream("deflate");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function decodePng(u8) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let interlace = 0;
  const idat = [];
  let palette = null;
  let transparency = null;

  while (pos + 8 <= u8.length) {
    const len = readU32(u8, pos);
    const type = String.fromCharCode(u8[pos + 4], u8[pos + 5], u8[pos + 6], u8[pos + 7]);
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > u8.length) break;
    if (type === "IHDR") {
      width = readU32(u8, dataStart);
      height = readU32(u8, dataStart + 4);
      bitDepth = u8[dataStart + 8];
      colorType = u8[dataStart + 9];
      interlace = u8[dataStart + 12];
    } else if (type === "PLTE") {
      palette = u8.subarray(dataStart, dataEnd);
    } else if (type === "tRNS") {
      transparency = u8.subarray(dataStart, dataEnd);
    } else if (type === "IDAT") {
      idat.push(u8.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    pos = dataEnd + 4;
  }

  if (!width || !height) throw new Error("PNG missing IHDR");
  if (interlace !== 0) throw new Error("interlaced PNG unsupported");
  if (![1, 2, 4, 8, 16].includes(bitDepth)) throw new Error("PNG bit depth unsupported");
  if (![0, 2, 3, 4, 6].includes(colorType)) throw new Error("PNG color type unsupported");
  if (!idat.length) throw new Error("PNG has no IDAT");

  const raw = await inflate(concat(idat));
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
  const bpp = Math.max(1, Math.ceil((channels * bitDepth) / 8));
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  if (raw.length < (rowBytes + 1) * height) throw new Error("PNG data truncated");

  const rows = unfilter(raw, height, rowBytes, bpp);
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      if (colorType === 0) {
        const v = readSample(row, x, bitDepth, 1, 0);
        const g = scaleTo8(v, bitDepth);
        data[out] = g;
        data[out + 1] = g;
        data[out + 2] = g;
        data[out + 3] = transparency && bitDepth === 16 ? transparency[1] : 255;
        if (transparency && bitDepth === 8) {
          const t = transparency[0];
          if (v === t) data[out + 3] = 0;
        }
      } else if (colorType === 2) {
        const r = scaleTo8(readSample(row, x * 3, bitDepth, 3, 0), bitDepth);
        const g = scaleTo8(readSample(row, x * 3, bitDepth, 3, 1), bitDepth);
        const b = scaleTo8(readSample(row, x * 3, bitDepth, 3, 2), bitDepth);
        data[out] = r;
        data[out + 1] = g;
        data[out + 2] = b;
        data[out + 3] = 255;
      } else if (colorType === 3) {
        if (!palette) throw new Error("palette PNG missing PLTE");
        const idx = readSample(row, x, bitDepth, 1, 0);
        const p = idx * 3;
        data[out] = palette[p] || 0;
        data[out + 1] = palette[p + 1] || 0;
        data[out + 2] = palette[p + 2] || 0;
        data[out + 3] = transparency && idx < transparency.length ? transparency[idx] : 255;
      } else if (colorType === 4) {
        const g = scaleTo8(readSample(row, x * 2, bitDepth, 2, 0), bitDepth);
        const a = scaleTo8(readSample(row, x * 2, bitDepth, 2, 1), bitDepth);
        data[out] = g;
        data[out + 1] = g;
        data[out + 2] = g;
        data[out + 3] = a;
      } else {
        data[out] = scaleTo8(readSample(row, x * 4, bitDepth, 4, 0), bitDepth);
        data[out + 1] = scaleTo8(readSample(row, x * 4, bitDepth, 4, 1), bitDepth);
        data[out + 2] = scaleTo8(readSample(row, x * 4, bitDepth, 4, 2), bitDepth);
        data[out + 3] = scaleTo8(readSample(row, x * 4, bitDepth, 4, 3), bitDepth);
      }
    }
  }

  return { ok: true, width, height, data };
}

function readSample(row, pixelIndex, bitDepth, channels, channel) {
  if (bitDepth === 8) return row[pixelIndex * channels + channel];
  if (bitDepth === 16) return row[(pixelIndex * channels + channel) * 2];
  const perRow = row.length * (8 / bitDepth);
  const idx = pixelIndex * channels + channel;
  if (idx >= perRow) return 0;
  const byte = row[idx >> 3];
  const bits = bitDepth;
  const shift = 8 - bits - ((idx * bits) & 7);
  const mask = (1 << bits) - 1;
  return (byte >> shift) & mask;
}

function scaleTo8(v, bitDepth) {
  if (bitDepth === 8) return v;
  if (bitDepth === 16) return v; // already the high byte via readSample's 2-byte read? handled below
  const max = (1 << bitDepth) - 1;
  return Math.round((v / max) * 255);
}

function unfilter(raw, height, rowBytes, bpp) {
  const rows = [];
  let prev = new Uint8Array(rowBytes);
  let off = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[off++];
    const cur = new Uint8Array(rowBytes);
    for (let i = 0; i < rowBytes; i++) {
      const x = raw[off + i];
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: v = x + paeth(a, b, c); break;
        default: throw new Error(`PNG filter ${filter}`);
      }
      cur[i] = v & 0xff;
    }
    off += rowBytes;
    rows.push(cur);
    prev = cur;
  }
  return rows;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/* ------------------------------------------------------------------- JPEG */

const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20,
  13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52,
  45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];

const COS_TABLE = (() => {
  const t = [];
  for (let u = 0; u < 8; u++) {
    const row = new Float64Array(8);
    for (let x = 0; x < 8; x++) row[x] = Math.cos(((2 * x + 1) * u * Math.PI) / 16);
    t.push(row);
  }
  return t;
})();
const C_FACTOR = [Math.SQRT1_2, 1, 1, 1, 1, 1, 1, 1];

function decodeJpeg(u8) {
  const quant = {};
  const huffDC = {};
  const huffAC = {};
  let frame = null;
  let restartInterval = 0;
  let pos = 2;

  while (pos + 1 < u8.length) {
    if (u8[pos] !== 0xff) {
      pos++;
      continue;
    }
    let marker = u8[pos + 1];
    pos += 2;
    while (marker === 0xff && pos < u8.length) {
      marker = u8[pos++];
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) break;
    if (pos + 2 > u8.length) break;
    const segLen = (u8[pos] << 8) | u8[pos + 1];
    const segEnd = pos + segLen;
    if (segEnd > u8.length) break;

    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc3) {
      const precision = u8[pos + 2];
      if (precision !== 8) throw new Error("only 8-bit JPEG supported");
      const height = (u8[pos + 3] << 8) | u8[pos + 4];
      const width = (u8[pos + 5] << 8) | u8[pos + 6];
      const nComp = u8[pos + 7];
      const components = [];
      let p = pos + 8;
      for (let i = 0; i < nComp; i++) {
        components.push({
          id: u8[p],
          h: u8[p + 1] >> 4,
          v: u8[p + 1] & 15,
          quant: u8[p + 2],
          blocks: null,
          pred: 0,
          plane: null,
        });
        p += 3;
      }
      frame = { width, height, components };
    } else if (marker === 0xc2) {
      throw new Error("progressive JPEG unsupported");
    } else if (marker >= 0xc4 && marker <= 0xc4) {
      let p = pos + 2;
      while (p < segEnd) {
        const tc = u8[p] >> 4;
        const th = u8[p] & 15;
        p++;
        const counts = [];
        let total = 0;
        for (let i = 0; i < 16; i++) {
          counts.push(u8[p + i]);
          total += u8[p + i];
        }
        p += 16;
        const symbols = [];
        for (let i = 0; i < total; i++) symbols.push(u8[p + i]);
        p += total;
        (tc === 0 ? huffDC : huffAC)[th] = { counts, symbols };
      }
    } else if (marker === 0xdb) {
      let p = pos + 2;
      while (p < segEnd) {
        const pq = u8[p] >> 4;
        const tq = u8[p] & 15;
        p++;
        const table = new Float64Array(64);
        for (let i = 0; i < 64; i++) {
          table[ZIGZAG[i]] = pq ? (u8[p] << 8) | u8[p + 1] : u8[p];
          p += pq ? 2 : 1;
        }
        quant[tq] = table;
      }
    } else if (marker === 0xdd) {
      restartInterval = (u8[pos + 2] << 8) | u8[pos + 3];
    } else if (marker === 0xda) {
      if (!frame) throw new Error("JPEG scan before frame header");
      const nScan = u8[pos + 2];
      const scanComponents = [];
      let p = pos + 3;
      for (let i = 0; i < nScan; i++) {
        const id = u8[p];
        const comp = frame.components.find((c) => c.id === id);
        if (!comp) throw new Error("unknown scan component");
        const t = u8[p + 1];
        scanComponents.push({ comp, dc: t >> 4, ac: t & 15 });
        p += 2;
      }
      if (scanComponents.length !== frame.components.length) {
        throw new Error("multi-scan baseline JPEG unsupported");
      }
      // entropy-coded data runs from segEnd until the next marker
      const ent = extractEntropy(u8, segEnd);
      decodeScan(ent.bytes, frame, scanComponents, quant, huffDC, huffAC, restartInterval);
      pos = ent.next;
      continue;
    }
    pos = segEnd;
  }

  if (!frame) throw new Error("no JPEG frame header");
  return renderJpeg(frame);
}

function extractEntropy(u8, start) {
  const out = new Uint8Array(u8.length - start);
  let n = 0;
  let p = start;
  while (p < u8.length) {
    const b = u8[p++];
    if (b !== 0xff) {
      out[n++] = b;
      continue;
    }
    if (p >= u8.length) break;
    const m = u8[p++];
    if (m === 0x00) {
      out[n++] = 0xff;
    } else if (m >= 0xd0 && m <= 0xd7) {
      // restart marker: DC predictors are reset by the decoder at the interval
    } else {
      return { bytes: out.subarray(0, n), next: p - 2 };
    }
  }
  return { bytes: out.subarray(0, n), next: p };
}

function decodeScan(data, frame, scanComponents, quant, huffDC, huffAC, restartInterval) {
  const br = makeBitReader(data);
  const comps = frame.components;
  const maxH = Math.max(...comps.map((c) => c.h));
  const maxV = Math.max(...comps.map((c) => c.v));
  const mcusPerLine = Math.ceil(frame.width / (maxH * 8));
  const mcusPerColumn = Math.ceil(frame.height / (maxV * 8));

  for (const c of comps) {
    c.rows = mcusPerColumn * c.v;
    c.cols = mcusPerLine * c.h;
    c.blocks = new Int16Array(c.rows * c.cols * 64);
    c.pred = 0;
  }

  const interleaved = scanComponents.length > 1;
  let unit = 0;

  const decodeBlock = (comp, blockRow, blockCol, dcTable, acTable) => {
    const offset = (blockRow * comp.cols + blockCol) * 64;
    const qtable = quant[comp.quant] || new Float64Array(64).fill(1);
    // DC
    const t = decodeHuff(huffDC[dcTable], br);
    const diff = t === 0 ? 0 : receive(br, t);
    comp.pred += diff;
    const block = comp.blocks;
    block[offset] = comp.pred * qtable[0];
    // AC
    let k = 1;
    while (k < 64) {
      const rs = decodeHuff(huffAC[acTable], br);
      const s = rs & 0x0f;
      const r = rs >> 4;
      if (s === 0) {
        if (r === 15) {
          k += 16;
          continue;
        }
        break;
      }
      k += r;
      if (k > 63) break;
      block[offset + k] = receive(br, s) * qtable[k];
      k++;
    }
    if (restartInterval && ++unit === restartInterval) {
      unit = 0;
      comp.pred = 0;
      br.skipToByteBoundaryAndMarker();
    }
  };

  if (!interleaved) {
    const { comp, dc, ac } = scanComponents[0];
    for (let row = 0; row < comp.rows; row++) {
      for (let col = 0; col < comp.cols; col++) decodeBlock(comp, row, col, dc, ac);
    }
    return;
  }

  for (let mcuY = 0; mcuY < mcusPerColumn; mcuY++) {
    for (let mcuX = 0; mcuX < mcusPerLine; mcuX++) {
      for (const { comp, dc, ac } of scanComponents) {
        for (let vy = 0; vy < comp.v; vy++) {
          for (let hx = 0; hx < comp.h; hx++) {
            decodeBlock(comp, mcuY * comp.v + vy, mcuX * comp.h + hx, dc, ac);
          }
        }
      }
    }
  }
}

function makeBitReader(bytes) {
  let p = 0;
  let bitBuf = 0;
  let bitCnt = 0;
  return {
    bit() {
      if (bitCnt === 0) {
        if (p >= bytes.length) return 0;
        bitBuf = bytes[p++];
        bitCnt = 8;
      }
      bitCnt--;
      return (bitBuf >> bitCnt) & 1;
    },
    skipToByteBoundaryAndMarker() {
      bitCnt = 0;
      // consume padding FF.. fill bytes before the next restart marker
      while (p + 1 < bytes.length && bytes[p] === 0xff && (bytes[p + 1] & 0xf0) === 0xd0) p += 2;
    },
  };
}

function decodeHuff(table, br) {
  if (!table) throw new Error("missing Huffman table");
  const { counts, symbols } = table;
  let code = 0;
  let first = 0;
  let index = 0;
  for (let i = 0; i < 16; i++) {
    code = (code << 1) | br.bit();
    const count = counts[i];
    if (code - first < count) return symbols[index + (code - first)];
    index += count;
    first = (first + count) << 1;
  }
  throw new Error("bad Huffman code");
}

function receive(br, n) {
  let v = 0;
  for (let i = 0; i < n; i++) v = (v << 1) | br.bit();
  if (v < 1 << (n - 1)) v -= (1 << n) - 1;
  return v;
}

function renderJpeg(frame) {
  const { width, height, components } = frame;
  if (width * height > 40_000_000) throw new Error("image too large to decode");
  const maxH = Math.max(...components.map((c) => c.h));
  const maxV = Math.max(...components.map((c) => c.v));

  // IDCT every block into an 8-bit sample plane per component
  for (const comp of components) {
    const plane = new Uint8Array(comp.cols * 8 * (comp.rows * 8));
    const coef = new Float64Array(64);
    for (let br2 = 0; br2 < comp.rows; br2++) {
      for (let bc = 0; bc < comp.cols; bc++) {
        const offset = (br2 * comp.cols + bc) * 64;
        for (let i = 0; i < 64; i++) coef[i] = comp.blocks[offset + i];
        idct8x8(coef, plane, (br2 * 8 * (comp.cols * 8)) + bc * 8, comp.cols * 8);
      }
    }
    comp.plane = plane;
  }

  const data = new Uint8ClampedArray(width * height * 4);
  const yComp = components[0];
  const cbComp = components[1] || null;
  const crComp = components[2] || null;

  const sample = (comp, x, y) => {
    const sx = Math.min(comp.cols * 8 - 1, Math.floor((x * comp.h) / maxH));
    const sy = Math.min(comp.rows * 8 - 1, Math.floor((y * comp.v) / maxV));
    return comp.plane[sy * comp.cols * 8 + sx];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      if (!cbComp) {
        const g = sample(yComp, x, y);
        data[out] = g;
        data[out + 1] = g;
        data[out + 2] = g;
      } else {
        const yy = sample(yComp, x, y);
        const cb = sample(cbComp, x, y) - 128;
        const cr = sample(crComp, x, y) - 128;
        data[out] = yy + 1.402 * cr;
        data[out + 1] = yy - 0.344136 * cb - 0.714136 * cr;
        data[out + 2] = yy + 1.772 * cb;
      }
      data[out + 3] = 255;
    }
  }
  return { ok: true, width, height, data };
}

function idct8x8(coef, out, outOffset, stride) {
  const tmp = new Float64Array(64);
  for (let v = 0; v < 8; v++) {
    for (let x = 0; x < 8; x++) {
      let s = 0;
      for (let u = 0; u < 8; u++) s += C_FACTOR[u] * coef[v * 8 + u] * COS_TABLE[u][x];
      tmp[v * 8 + x] = s;
    }
  }
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      let s = 0;
      for (let v = 0; v < 8; v++) s += C_FACTOR[v] * tmp[v * 8 + x] * COS_TABLE[v][y];
      const val = s * 0.25 + 128;
      out[outOffset + y * stride + x] = val < 0 ? 0 : val > 255 ? 255 : val;
    }
  }
}

/* ----------------------------------------------------------------- colour */

const NAMED = [
  { name: "white", test: (h, s, l) => l > 0.9 && s < 0.26 },
  { name: "cream", test: (h, s, l) => h >= 20 && h < 70 && s < 0.4 && l > 0.8 },
  { name: "black", test: (h, s, l) => l < 0.14 },
  { name: "light_gray", test: (h, s, l) => s < 0.2 && l > 0.84 },
  { name: "gray", test: (h, s, l) => s < 0.16 && l >= 0.14 && l <= 0.84 },
  { name: "beige", test: (h, s, l) => h >= 28 && h < 50 && s < 0.45 && l >= 0.6 },
  { name: "brown", test: (h, s, l) => h >= 18 && h < 50 && l < 0.55 },
  { name: "tan", test: (h, s, l) => h >= 24 && h < 50 },
  { name: "yellow", test: (h, s, l) => h >= 50 && h < 70 },
  { name: "olive", test: (h, s, l) => h >= 60 && h < 90 && l < 0.55 },
  { name: "green", test: (h, s, l) => h >= 90 && h < 160 },
  { name: "teal", test: (h, s, l) => h >= 160 && h < 190 },
  { name: "light_blue", test: (h, s, l) => h >= 190 && h < 215 && l > 0.62 },
  { name: "blue", test: (h, s, l) => h >= 190 && h < 250 },
  { name: "navy", test: (h, s, l) => h >= 195 && h < 250 && l < 0.34 },
  { name: "purple", test: (h, s, l) => h >= 250 && h < 290 },
  { name: "pink", test: (h, s, l) => h >= 290 && h < 345 && l > 0.55 },
  { name: "magenta", test: (h, s, l) => h >= 290 && h < 345 },
  { name: "red", test: (h, s, l) => h >= 345 || h < 18 },
  { name: "orange", test: (h, s, l) => h >= 18 && h < 28 },
];

export function nameColor(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0.0001) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  for (const entry of NAMED) {
    if (entry.test(h, s, l)) return entry.name;
  }
  return l > 0.5 ? "light_color" : "dark_color";
}

export function hexOf(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Off-white studio/wall background: bright and nearly neutral. */
function isBackgroundPixel(data, i) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 226 && max - min <= 24;
}

/**
 * Dominant colour straight from the decoded pixels.
 * Near-white background is ignored when it clearly is the background.
 */
export function dominantColors(pixels, maxColors = 3) {
  const { data, width, height } = pixels;
  const total = width * height;
  if (!total) return { colors: [], backgroundRemoved: false };

  let whiteish = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (isBackgroundPixel(data, i)) whiteish++;
  }
  const ignoreWhite = whiteish / total > 0.45;

  const buckets = new Map();
  const stride = Math.max(1, Math.floor(Math.sqrt(total / 20000)) || 1);
  let counted = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      if (ignoreWhite && isBackgroundPixel(data, i)) continue;
      const r = data[i] & 0xf8;
      const g = data[i + 1] & 0xf8;
      const b = data[i + 2] & 0xf8;
      const key = (r << 16) | (g << 8) | b;
      buckets.set(key, (buckets.get(key) || 0) + 1);
      counted++;
    }
  }
  if (!counted) return { colors: [], backgroundRemoved: ignoreWhite };

  // merge into named colours so "navy" and "royalty blue" do not split the vote
  const byName = new Map();
  for (const [key, count] of buckets) {
    const r = (key >> 16) & 0xff;
    const g = (key >> 8) & 0xff;
    const b = key & 0xff;
    const name = nameColor(r, g, b);
    const cur = byName.get(name) || { name, r: 0, g: 0, b: 0, count: 0, weight: 0 };
    const w = count;
    cur.r += r * w;
    cur.g += g * w;
    cur.b += b * w;
    cur.count += count;
    cur.weight += w;
    byName.set(name, cur);
  }

  const sorted = [...byName.values()].sort((a, b) => b.count - a.count).slice(0, maxColors);
  const colors = sorted.map((c) => ({
    name: c.name,
    hex: hexOf(Math.round(c.r / c.weight), Math.round(c.g / c.weight), Math.round(c.b / c.weight)),
    pct: Math.round((c.count / counted) * 100),
  }));
  return { colors, backgroundRemoved: ignoreWhite };
}

/* ----------------------------------------------------------------- cutout */

/**
 * Uniform-background removal: flood fill from the border, alpha = 0, PNG out.
 * Returns null when the background is not uniform enough to claim it worked.
 */
export async function makeCutout(pixels, maxSide = 720) {
  const { width, height } = pixels;
  if (!width || !height) return null;
  const data = new Uint8ClampedArray(pixels.data); // never mutate the caller's pixels

  const border = [];
  const push = (x, y) => {
    const i = (y * width + x) * 4;
    border.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  const bg = medianColor(border);
  let inside = 0;
  for (const [r, g, b] of border) if (dist(r, g, b, bg) > 45) inside++;
  if (inside / border.length > 0.12) return null; // border is not one background

  const tol = 55;
  const seen = new Uint8Array(width * height);
  const stack = [];
  const seed = (x, y) => {
    const p = y * width + x;
    if (seen[p]) return;
    const i = p * 4;
    if (dist(data[i], data[i + 1], data[i + 2], bg) > tol) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }
  let removed = 0;
  while (stack.length) {
    const p = stack.pop();
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    data[i + 3] = 0;
    removed++;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) seed(x - 1, y);
    if (x + 1 < width) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y + 1 < height) seed(x, y + 1);
  }
  const ratio = removed / (width * height);
  if (ratio < 0.04 || ratio > 0.9) return null; // nothing removed, or it ate the garment

  const scaled = scalePixels({ data, width, height }, maxSide);
  const png = await encodePng(scaled.data, scaled.width, scaled.height);
  return { bytes: png, removedPct: Math.round(ratio * 100) };
}

function medianColor(list) {
  const rs = list.map((c) => c[0]).sort((a, b) => a - b);
  const gs = list.map((c) => c[1]).sort((a, b) => a - b);
  const bs = list.map((c) => c[2]).sort((a, b) => a - b);
  const mid = (arr) => arr[Math.floor(arr.length / 2)];
  return [mid(rs), mid(gs), mid(bs)];
}

function dist(r1, g1, b1, c) {
  const dr = r1 - c[0];
  const dg = g1 - c[1];
  const db = b1 - c[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function scalePixels(pixels, maxSide) {
  const { data, width, height } = pixels;
  const largest = Math.max(width, height);
  if (largest <= maxSide) return { data, width, height };
  const scale = maxSide / largest;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.floor((y * height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor((x * width) / w));
      const si = (sy * width + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { data: out, width: w, height: h };
}

/* -------------------------------------------------------------- PNG write */

export async function encodePng(rgba, width, height) {
  const rowBytes = width * 4;
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  const cs = new CompressionStream("deflate");
  const stream = new Blob([raw]).stream().pipeThrough(cs);
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());

  const chunks = [];
  chunks.push(new Uint8Array(PNG_SIG));
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  chunks.push(chunk("IHDR", ihdr));
  chunks.push(chunk("IDAT", compressed));
  chunks.push(chunk("IEND", new Uint8Array(0)));
  return concat(chunks);
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcView = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < 4 + data.length; i++) crc = crcView[(crc ^ out[i]) & 0xff] ^ (crc >>> 8);
  writeU32(out, 8 + data.length, (crc ^ 0xffffffff) >>> 0);
  return out;
}

let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}

/* --------------------------------------------------------------- helpers */

function readU32(u8, pos) {
  return ((u8[pos] << 24) | (u8[pos + 1] << 16) | (u8[pos + 2] << 8) | u8[pos + 3]) >>> 0;
}

function writeU32(u8, pos, v) {
  u8[pos] = (v >>> 24) & 0xff;
  u8[pos + 1] = (v >>> 16) & 0xff;
  u8[pos + 2] = (v >>> 8) & 0xff;
  u8[pos + 3] = v & 0xff;
}

export function concat(list) {
  let total = 0;
  for (const p of list) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of list) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function toBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Down-sampled PNG for an LLM vision request (keeps payloads small). */
export async function previewPng(pixels, maxSide = 448) {
  const scaled = scalePixels(pixels, maxSide);
  return encodePng(scaled.data, scaled.width, scaled.height);
}

/** One-call pipeline: decode -> colour summary (+ pixels for callers that need them). */
export async function analyzeImage(bytes, mime) {
  const decoded = await decodeImage(bytes, mime);
  if (!decoded.ok) {
    return { ok: false, width: null, height: null, color: null, hex: null, colors: [], pixels: null, note: decoded.note };
  }
  const { colors, backgroundRemoved } = dominantColors(decoded);
  const top = colors[0] || null;
  return {
    ok: true,
    width: decoded.width,
    height: decoded.height,
    color: top ? top.name : null,
    hex: top ? top.hex : null,
    colors,
    backgroundRemoved,
    pixels: { data: decoded.data, width: decoded.width, height: decoded.height },
    note: null,
  };
}
