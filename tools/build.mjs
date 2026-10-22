import * as esbuild from 'esbuild';
import fs from 'fs';
import { makeZip } from './zip.mjs';
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const minify = !process.argv.includes('--dev');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
// navigateurs visés : esbuild adapte la syntaxe à ces versions, ou refuse de construire si c'est
// impossible (Safari 15 : premier Safari qui accepte l'« await » au niveau du module)
const TARGET = ['chrome100', 'edge100', 'firefox100', 'safari15'];
const define = { __APP_VERSION__: JSON.stringify(pkg.version) };
// filet de sécurité du chargement (src/boot.js) : script classique placé avant le programme
const boot = esbuild.transformSync(fs.readFileSync('src/boot.js', 'utf8'), { minify, target: 'es2015', define, legalComments: 'none', charset: 'utf8' }).code;
// polices de l'interface intégrées à la page (paquets Fontsource, licence OFL) : même rendu en ligne, en
// fichier hors ligne et dans tous les navigateurs ; alphabet latin (accents français compris)
const FONTS = [['Archivo', 'archivo', [400, 500, 600, 700]], ['Archivo Narrow', 'archivo-narrow', [500, 600, 700]], ['B612 Mono', 'b612-mono', [400, 700]]];
const fontCss = FONTS.flatMap(([family, pkg, weights]) => weights.map((w) => {
  const b64 = fs.readFileSync(`node_modules/@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff2`).toString('base64');
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
})).join('');
const raw = fs.readFileSync('src/index.template.html', 'utf8');
for (const m of ['<!--BOOT-->', '<!--FONTS-->', '/*STYLES*/']) if (!raw.includes(m)) throw new Error(`src/index.template.html : marqueur ${m} introuvable`);
// styles propres à une fonction (menu, PRISM, Videohub, réseau du car…) : src/styles/*.css, par ordre alphabétique
// du nom sans « .css », pour qu'une feuille de base passe avant ses compléments (camlab.css, puis camlab-ch1.css…)
const stem = (f) => f.slice(0, -4);
const styles = fs.readdirSync('src/styles').filter((f) => f.endsWith('.css')).sort((a, b) => (stem(a) < stem(b) ? -1 : stem(a) > stem(b) ? 1 : 0)).map((f) => `/* ${f} */\n` + fs.readFileSync('src/styles/' + f, 'utf8')).join('\n');
const tpl = raw.replace('<!--BOOT-->', () => `<script>${boot}</script>`).replace('<!--FONTS-->', () => `<style>${fontCss}</style>`).replace('/*STYLES*/', () => styles);
const bundle = async (external) => {
  const r = await esbuild.build({
    entryPoints: ['src/main.js'], bundle: true, format: 'esm', write: false, external: external ? ['three'] : [],
    minify, target: TARGET, define, legalComments: 'none', charset: 'utf8',
    loader: { '.txt': 'text', '.bat': 'text', '.command': 'text', '.sh': 'text', '.svg': 'text' }, // mode d'emploi et lanceurs du serveur réseau local, icônes
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
// version à partager : le même document, à ouvrir d'un double-clic (file://), sans Internet ni serveur
const solo = lan.replace('<!--LAN-->', '');
fs.writeFileSync('dist/TIEE-Simulator.html', solo);
console.log('dist/TIEE-Simulator.html', (solo.length / 1024).toFixed(0) + ' KB');
// serveur autonome : un seul fichier à copier sur l'ordinateur qui héberge (node car-regie-serveur-lan.mjs)
const srv = fs.readFileSync('lan/serveur.mjs', 'utf8');
if (!srv.includes('let PAGE = null;')) throw new Error('lan/serveur.mjs : marqueur PAGE introuvable');
const server = srv.replace('let PAGE = null;', () => `let PAGE = ${JSON.stringify(lan)};`);
fs.writeFileSync('dist/car-regie-serveur-lan.mjs', server);
console.log('dist/car-regie-serveur-lan.mjs', (server.length / 1024).toFixed(0) + ' KB');
// archive « réseau local » à donner à la personne qui héberge (proposée au téléchargement dans la page publiée)
const zip = makeZip([
  { name: 'car-regie-reseau-local/car-regie-serveur-lan.mjs', data: server },
  { name: 'car-regie-reseau-local/Lancer le serveur (Windows).bat', data: fs.readFileSync('lan/Lancer le serveur (Windows).bat') },
  { name: 'car-regie-reseau-local/lancer-serveur.command', data: fs.readFileSync('lan/lancer-serveur.command'), exec: true },
  { name: 'car-regie-reseau-local/lancer-serveur.sh', data: fs.readFileSync('lan/lancer-serveur.sh'), exec: true },
  { name: 'car-regie-reseau-local/LISEZMOI.txt', data: fs.readFileSync('lan/LISEZMOI.txt') },
]);
fs.writeFileSync('dist/car-regie-reseau-local.zip', zip);
console.log('dist/car-regie-reseau-local.zip', (zip.length / 1024).toFixed(0) + ' KB');
