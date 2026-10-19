// ----------------------------------------------------------------------------------
// Icône de l'exécutable Windows (lan/car-regie-3d.ico) : une caméra de plateau or sur fond
// sombre, bande rouge et tally allumé (sang et or, sans écusson). Dessinée en SVG, rendue par
// Chromium aux tailles d'une icône Windows, puis assemblée en .ico (images PNG).
// Le fichier produit est versionné : ne relancer que pour changer le dessin.
//   node tools/icon.mjs
// ----------------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { playwright } from '../tests/e2e/harness.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs><clipPath id="c"><rect x="8" y="8" width="240" height="240" rx="48"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect x="0" y="0" width="256" height="256" fill="#17191e"/>
    <rect x="0" y="190" width="256" height="66" fill="#c8102e"/>
    <rect x="0" y="182" width="256" height="8" fill="#f2c200"/>
  </g>
  <rect x="70" y="58" width="56" height="26" rx="5" fill="#f2c200"/>
  <rect x="40" y="88" width="122" height="78" rx="12" fill="#f2c200"/>
  <path d="M162 106 L216 82 L216 172 L162 148 Z" fill="#f2c200"/>
  <circle cx="146" cy="72" r="12" fill="#ff2b2b" stroke="#17191e" stroke-width="5"/>
  <rect x="56" y="104" width="44" height="12" rx="4" fill="#17191e" opacity=".55"/>
</svg>`;
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];

const { chromium } = await playwright();
const browser = await chromium.launch();
const page = await browser.newPage();
const pngs = [];
for (const s of SIZES) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><body style="margin:0;background:transparent">${SVG.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
  pngs.push(await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } }));
}
await browser.close();

// format ICO : en-tête, une entrée de 16 octets par image, puis les images PNG
const head = Buffer.alloc(6 + 16 * SIZES.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(SIZES.length, 4);
let off = head.length;
SIZES.forEach((s, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1); // 0 = 256
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(off, e + 12);
  off += pngs[i].length;
});
const ico = Buffer.concat([head, ...pngs]);
fs.writeFileSync(path.join(ROOT, 'lan/car-regie-3d.ico'), ico);
fs.writeFileSync(path.join(ROOT, 'test-results/icone-256.png'), pngs[pngs.length - 1]);
console.log('lan/car-regie-3d.ico', (ico.length / 1024).toFixed(0) + ' KB', SIZES.join(', '));
