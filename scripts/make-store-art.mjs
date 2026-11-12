// Draws Tallowmere's banner, "the lantern market at dusk", as original pixel art
// and writes it twice into public/store/:
//
//   banner-heavy.png  1600 x 600 with photographic grain. Large and slow on
//                     purpose: the planted snag Pell, the slow-connection
//                     shopper, is meant to find.
//   banner.png        1000 x 375, the size it is shown at, without grain.
//                     The fixed version.
//
// Run with: node scripts/make-store-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 200;
const H = 75;

/** A small repeatable random number generator (mulberry32). */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));

/** The scene at 200 x 75, one colour per pixel. */
function scene() {
  const next = random(7);
  const pixels = Array.from({ length: H }, () => Array.from({ length: W }, () => [0, 0, 0]));
  const sky = [hex("#12152a"), hex("#2a2748"), hex("#6b3f5c"), hex("#e8743b")];

  for (let y = 0; y < H; y++) {
    const t = y / 52;
    const stop = Math.min(2, Math.floor(t * 3));
    const local = Math.min(1, t * 3 - stop);
    const colour = mix(sky[stop], sky[stop + 1], local);
    for (let x = 0; x < W; x++) pixels[y][x] = colour;
  }
  // Stars in the upper sky.
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(next() * W);
    const y = Math.floor(next() * 26);
    pixels[y][x] = next() > 0.7 ? hex("#fff6d6") : hex("#8fa3bf");
  }
  // Two ranges of hills.
  for (let x = 0; x < W; x++) {
    const far = 44 + Math.round(4 * Math.sin(x / 13) + 2 * Math.sin(x / 5.3));
    const near = 54 + Math.round(5 * Math.sin(x / 21 + 1.7) + 1.5 * Math.sin(x / 7));
    for (let y = far; y < H; y++) pixels[y][x] = hex("#2e3a5c");
    for (let y = near; y < H; y++) pixels[y][x] = hex("#1b1f3b");
  }
  // The road, winding from the left towards the stall.
  for (let y = 56; y < H; y++) {
    const centre = 40 + (y - 56) * 3.2 + Math.sin(y / 3) * 3;
    const half = 2 + (y - 56) * 0.9;
    for (let x = Math.round(centre - half); x <= Math.round(centre + half); x++) {
      if (x >= 0 && x < W) pixels[y][x] = hex("#5c4a3a");
    }
  }
  // The stall: a roof, a counter, and a glow.
  const glow = hex("#ffb347");
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 160) / 1.4, y - 50);
      if (d < 34) pixels[y][x] = mix(pixels[y][x], glow, Math.max(0, (34 - d) / 34) * 0.45);
    }
  }
  for (let y = 40; y < 44; y++) for (let x = 140 - (44 - y); x < 180 + (44 - y); x++) pixels[y][x] = hex("#8a3b12");
  for (let y = 44; y < 60; y++) {
    pixels[y][142] = hex("#3a2a20");
    pixels[y][177] = hex("#3a2a20");
  }
  for (let y = 54; y < 60; y++) for (let x = 140; x < 180; x++) pixels[y][x] = hex("#6b4a2f");
  // Candles on the counter.
  for (let i = 0; i < 6; i++) {
    const x = 146 + i * 5;
    pixels[52][x] = hex("#fff6d6");
    pixels[53][x] = hex("#ffb347");
    for (let y = 54; y < 56; y++) pixels[y][x] = [hex("#e8743b"), hex("#6fae75"), hex("#ffb347")][i % 3];
  }
  // A string of lanterns across the sky.
  for (let x = 0; x < W; x += 9) {
    const y = 18 + Math.round(6 * Math.sin((x / W) * Math.PI));
    pixels[y][x] = hex("#ffe08a");
    if (x + 1 < W) pixels[y][x + 1] = hex("#ffb347");
    if (y + 1 < H) pixels[y + 1][x] = hex("#ffb347");
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Scales the scene by a whole number and encodes it as a PNG, with optional grain. */
function png(pixels, scale, grain, level) {
  const width = W * scale;
  const height = H * scale;
  const next = random(99);
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    const row = pixels[Math.floor(y / scale)];
    for (let x = 0; x < width; x++) {
      const [r, g, b] = row[Math.floor(x / scale)];
      const noise = grain ? Math.round((next() - 0.5) * 2 * grain) : 0;
      raw[offset++] = Math.max(0, Math.min(255, r + noise));
      raw[offset++] = Math.max(0, Math.min(255, g + noise));
      raw[offset++] = Math.max(0, Math.min(255, b + noise));
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const pixels = scene();
mkdirSync("public/store", { recursive: true });
const heavy = png(pixels, 8, 14, 1);
const light = png(pixels, 5, 0, 9);
writeFileSync("public/store/banner-heavy.png", heavy);
writeFileSync("public/store/banner.png", light);
console.log(`banner-heavy.png ${Math.round(heavy.length / 1024)} KB, banner.png ${Math.round(light.length / 1024)} KB`);
