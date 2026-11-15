// A small PNG reader (8-bit RGB or RGBA, no interlace: what Chrome's screenshots are), for comparing two looks at the
// screen with some tolerance: a rare card's foil shimmers forever, so "finished" can't mean "no pixel changed".
import zlib from "node:zlib";

export function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ch = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ch = { 2: 3, 6: 4 }[data[9]]; if (data[8] !== 8 || !ch || data[12]) throw new Error("unsupported PNG"); }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[row + x - ch] : 0, b = y ? out[row - stride + x] : 0, c = y && x >= ch ? out[row - stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[row + x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

/** How different two looks are: the share of small cells (8x8 of the downscaled picture) that changed visibly. */
export function changed(a, b) {
  if (!a || !b || a.w !== b.w || a.h !== b.h) return 1;
  const cell = 8, cw = Math.ceil(a.w / cell), chh = Math.ceil(a.h / cell);
  let moved = 0;
  for (let cy = 0; cy < chh; cy++) for (let cx = 0; cx < cw; cx++) {
    let d = 0, n = 0;
    for (let y = cy * cell; y < Math.min(a.h, (cy + 1) * cell); y++) for (let x = cx * cell; x < Math.min(a.w, (cx + 1) * cell); x++) {
      const i = (y * a.w + x) * a.ch;
      d += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); n += 3;
    }
    if (d / n > 6) moved++;
  }
  return moved / (cw * chh);
}
