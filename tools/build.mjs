import * as esbuild from 'esbuild';
import fs from 'fs';
import { makeZip } from './zip.mjs';
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const minify = !process.argv.includes('--dev');
const tpl = fs.readFileSync('src/index.template.html', 'utf8');
const bundle = async (external) => {
  const r = await esbuild.build({
    entryPoints: ['src/main.js'], bundle: true, format: 'esm', write: false, external: external ? ['three'] : [],
    minify, target: ['es2022'], legalComments: 'none', charset: 'utf8',
    loader: { '.txt': 'text', '.bat': 'text', '.command': 'text', '.sh': 'text' }, // mode d'emploi et lanceurs du serveur réseau local
  });
  let js = r.outputFiles[0].text;
  if (external) js = js.replace(/from\s*["']three["']/g, `from"${CDN}"`);
  if (js.includes('</script')) js = js.replace(/<\/script/g, '<\\/script');
  // le caractère de remplacement U+FFFD n'apparaît que dans des chaînes JS : on l'écrit en échappement
  js = js.replace(/\uFFFD/g, '\\uFFFD');
  return tpl.replace('<!--APP-->', () => `<script type="module">\n${js}\n</script>`);
};
fs.mkdirSync('dist', { recursive: true });
// page publiée (three.js depuis jsDelivr)
const out = await bundle(true);
fs.writeFileSync('dist/index.html', out);
console.log('dist/index.html', (out.length / 1024).toFixed(0) + ' KB');
// réseau local : document complet, three.js intégré (fonctionne sans Internet), servi par lan/serveur.mjs
const lan = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><!--LAN-->' + (await bundle(false)) + '</body></html>';
fs.writeFileSync('dist/index-lan.html', lan);
console.log('dist/index-lan.html', (lan.length / 1024).toFixed(0) + ' KB');
// serveur autonome : un seul fichier à copier sur l'ordinateur qui héberge (node car-regie-serveur-lan.mjs)
const srv = fs.readFileSync('lan/serveur.mjs', 'utf8');
if (!srv.includes('let PAGE = null;')) throw new Error('lan/serveur.mjs : marqueur PAGE introuvable');
const solo = srv.replace('let PAGE = null;', () => `let PAGE = ${JSON.stringify(lan)};`);
fs.writeFileSync('dist/car-regie-serveur-lan.mjs', solo);
console.log('dist/car-regie-serveur-lan.mjs', (solo.length / 1024).toFixed(0) + ' KB');
// archive « réseau local » à donner à la personne qui héberge (proposée au téléchargement dans la page publiée)
const zip = makeZip([
  { name: 'car-regie-reseau-local/car-regie-serveur-lan.mjs', data: solo },
  { name: 'car-regie-reseau-local/Lancer le serveur (Windows).bat', data: fs.readFileSync('lan/Lancer le serveur (Windows).bat') },
  { name: 'car-regie-reseau-local/lancer-serveur.command', data: fs.readFileSync('lan/lancer-serveur.command'), exec: true },
  { name: 'car-regie-reseau-local/lancer-serveur.sh', data: fs.readFileSync('lan/lancer-serveur.sh'), exec: true },
  { name: 'car-regie-reseau-local/LISEZMOI.txt', data: fs.readFileSync('lan/LISEZMOI.txt') },
]);
fs.writeFileSync('dist/car-regie-reseau-local.zip', zip);
console.log('dist/car-regie-reseau-local.zip', (zip.length / 1024).toFixed(0) + ' KB');
