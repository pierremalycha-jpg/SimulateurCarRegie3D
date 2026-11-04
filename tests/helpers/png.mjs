// Un encodeur PNG minimal (RGBA 8 bits, sans dépendance) : pour fabriquer une image de mire côté Node dans
// les tests (la fausse caméra du matching sert son « instantané » ainsi).
import zlib from 'node:zlib';

const TABLE = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** @param {number} w @param {number} h @param {Uint8Array} rgba w × h × 4 octets */
export function encoderPng(w, h, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/** une image de mire : fond gris, cadre noir, les pastilles d'une mesure en grille lignes × colonnes dans un rectangle donné */
export function imageMire(w, h, mesure, { lignes, colonnes }, rect) {
  const px = new Uint8Array(w * h * 4);
  const fill = (x0, y0, x1, y1, r, g, b) => { for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) { const o = (y * w + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255; } };
  fill(0, 0, w, h, 44, 46, 52);
  fill(rect.x - 24, rect.y - 24, rect.x + rect.w + 24, rect.y + rect.h + 24, 12, 12, 12);
  const cw = rect.w / colonnes, ch = rect.h / lignes;
  mesure.pastilles.forEach((p, i) => {
    const li = Math.floor(i / colonnes), co = i % colonnes;
    fill(Math.round(rect.x + co * cw + cw * 0.06), Math.round(rect.y + li * ch + ch * 0.06), Math.round(rect.x + (co + 1) * cw - cw * 0.06), Math.round(rect.y + (li + 1) * ch - ch * 0.06), Math.round(p.r * 255), Math.round(p.g * 255), Math.round(p.b * 255));
  });
  return encoderPng(w, h, px);
}
