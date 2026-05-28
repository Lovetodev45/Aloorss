// Génère les icônes ÆON en PNG pur (sans dépendance). Thème : starburst cosmique.
const zlib = require("zlib");
const fs = require("fs");

// ---- CRC32 ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // raw scanlines with filter byte 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;
    const row = y * width * 4;
    rgba.copy(raw, p, row, row + width * 4);
    p += width * 4;
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- dessin ----
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const maxr = size * 0.72;
  const coreR = size * 0.17;
  const center = [26, 24, 58], edge = [9, 9, 22];
  const gold = [245, 197, 66], white = [255, 247, 214], violet = [169, 155, 255];

  // étoiles fixes (seed déterministe)
  let seed = 1337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const stars = [];
  const nStars = Math.floor(size / 5);
  for (let i = 0; i < nStars; i++) stars.push([rnd()*size, rnd()*size, rnd()*1.6*(size/512)+0.4, rnd()*0.7+0.3]);

  const rays = 12;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const t = clamp(dist / maxr, 0, 1);
      let col = lerp(center, edge, t);

      // rayons starburst
      const ang = Math.atan2(dy, dx);
      let best = 1e9, even = false;
      for (let i = 0; i < rays; i++) {
        const ra = (Math.PI * 2 / rays) * i;
        let da = Math.abs(((ang - ra + Math.PI) % (Math.PI*2)) - Math.PI);
        if (da < best) { best = da; even = (i % 2 === 0); }
      }
      const rayLen = size * (even ? 0.46 : 0.30);
      if (dist < rayLen) {
        const widthFactor = (even ? 0.10 : 0.06) * (1 - dist / rayLen);
        if (best < widthFactor) {
          const rc = even ? gold : violet;
          const k = clamp(1 - best / widthFactor, 0, 1) * (1 - dist / rayLen);
          col = lerp(col, rc, k * 0.9);
        }
      }

      // étoiles
      for (let s = 0; s < stars.length; s++) {
        const sx = stars[s][0], sy = stars[s][1], sr = stars[s][2], sa = stars[s][3];
        const sd = Math.abs(x - sx) + Math.abs(y - sy);
        if (sd < sr * 1.5) col = lerp(col, [190, 190, 255], sa * clamp(1 - sd / (sr*1.5), 0, 1));
      }

      // cœur lumineux
      if (dist < coreR) {
        const k = 1 - dist / coreR;
        col = lerp(col, lerp(gold, white, k), clamp(k * 1.2, 0, 1));
      }

      const o = (y * size + x) * 4;
      rgba[o] = clamp(col[0], 0, 255);
      rgba[o+1] = clamp(col[1], 0, 255);
      rgba[o+2] = clamp(col[2], 0, 255);
      rgba[o+3] = 255;
    }
  }
  return encodePNG(size, size, rgba);
}

const outs = [
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
  ["favicon.png", 64],
];
for (const [name, sz] of outs) {
  fs.writeFileSync(name, render(sz));
  console.log("wrote", name, sz);
}
console.log("done");
