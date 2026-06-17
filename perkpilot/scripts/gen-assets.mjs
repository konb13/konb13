// Generates PerkPilot brand assets as PNGs with no image-library dependency.
// A white "send / paper-plane" mark on the brand-blue gradient. Run:
//   node scripts/gen-assets.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// --- tiny PNG encoder (truecolor + alpha, 8-bit) ----------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};
function makePNG(width, height, px) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = px(x, y);
      const o = rowStart + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// --- drawing helpers ---------------------------------------------------------
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

// Classic "send" paper-plane outline in a unit box, pointing right, with a
// concave notch. Filled via even-odd ray casting.
const PLANE = [
  [0.04, 0.16],
  [0.97, 0.50],
  [0.04, 0.84],
  [0.34, 0.50],
];
function inPlane(u, v) {
  let inside = false;
  for (let i = 0, j = PLANE.length - 1; i < PLANE.length; j = i++) {
    const [xi, yi] = PLANE[i];
    const [xj, yj] = PLANE[j];
    const intersect = yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Background gradient stops (brand blue, top-left → bottom-right).
const TOP = [56, 132, 255];
const BOT = [0, 74, 200];

function brandPixel(size, transparentBg) {
  // Centered plane occupying ~58% of the canvas, nudged for optical balance.
  const boxScale = 0.58;
  const box = size * boxScale;
  const ox = (size - box) / 2;
  const oy = (size - box) / 2 + size * 0.02;
  return (x, y) => {
    const u = (x - ox) / box;
    const v = (y - oy) / box;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && inPlane(u, v)) return [255, 255, 255, 255];
    if (transparentBg) return [0, 0, 0, 0];
    const t = (x + y) / (2 * size);
    return [lerp(TOP[0], BOT[0], t), lerp(TOP[1], BOT[1], t), lerp(TOP[2], BOT[2], t), 255];
  };
}

// --- emit --------------------------------------------------------------------
const dir = new URL('../assets/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

writeFileSync(dir + 'icon.png', makePNG(1024, 1024, brandPixel(1024, false)));
writeFileSync(dir + 'adaptive-icon.png', makePNG(1024, 1024, brandPixel(1024, true)));
writeFileSync(dir + 'splash.png', makePNG(1024, 1024, brandPixel(1024, true)));
writeFileSync(dir + 'favicon.png', makePNG(64, 64, brandPixel(64, false)));
console.log('Wrote icon.png, adaptive-icon.png, splash.png, favicon.png to assets/');
