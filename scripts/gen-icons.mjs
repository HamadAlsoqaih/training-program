// Generates app icons (PNG) with zero dependencies — dark bg + amber bolt.
// Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [11, 15, 22];        // #0b0f16
const BOLT = [251, 191, 36];    // #fbbf24

// bolt polygon in a 24×24 box
const POLY = [[13.5, 1.5], [4, 14], [10.8, 14], [9.5, 22.5], [20, 9.5], [13, 9.5]];

function inPoly(x, y) {
  let inside = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i], [xj, yj] = POLY[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const pad = size * 0.18;                 // content box
  const scale = (size - 2 * pad) / 24;
  const SS = 3;                            // supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const gx = (x + (sx + 0.5) / SS - pad) / scale;
        const gy = (y + (sy + 0.5) / SS - pad) / scale;
        if (gx >= 0 && gy >= 0 && gx <= 24 && gy <= 24 && inPoly(gx, gy)) hits++;
      }
      const a = hits / (SS * SS);
      const o = (y * size + x) * 4;
      px[o] = Math.round(BG[0] + (BOLT[0] - BG[0]) * a);
      px[o + 1] = Math.round(BG[1] + (BOLT[1] - BG[1]) * a);
      px[o + 2] = Math.round(BG[2] + (BOLT[2] - BG[2]) * a);
      px[o + 3] = 255;
    }
  }
  return encodePng(size, size, px);
}

// --- minimal PNG encoder ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, hgt, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(hgt, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(hgt * (1 + w * 4));
  for (let y = 0; y < hgt; y++) {
    raw[y * (1 + w * 4)] = 0; // filter none
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('icons', { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(`icons/icon-${size}.png`, makeIcon(size));
  console.log(`icons/icon-${size}.png`);
}
