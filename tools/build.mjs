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
// polices intégrées à la page (paquets Fontsource, licence OFL) : même rendu en ligne, en fichier hors ligne
// et dans tous les navigateurs ; alphabet latin (accents français compris). Archivo et B612 Mono pour
// l'interface ; Barlow et JetBrains Mono pour les textures du monde 3D (étiquettes, panneaux, moniteurs),
// qui venaient de Google Fonts avant la v19.4 : plus aucune requête vers un service de polices
const FONTS = [['Archivo', 'archivo', [400, 500, 600, 700]], ['Archivo Narrow', 'archivo-narrow', [500, 600, 700]], ['B612 Mono', 'b612-mono', [400, 700]],
  ['Barlow', 'barlow', [500]], ['Barlow Condensed', 'barlow-condensed', [500, 600, 700]], ['Barlow Semi Condensed', 'barlow-semi-condensed', [600]], ['JetBrains Mono', 'jetbrains-mono', [400, 600]]];
const fontFaces = (fonts) => fonts.flatMap(([family, pkg, weights]) => weights.map((w) => {
  const b64 = fs.readFileSync(`node_modules/@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff2`).toString('base64');
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
})).join('');
const fontCss = fontFaces(FONTS);
const raw = fs.readFileSync('src/index.template.html', 'utf8');
for (const m of ['<!--BOOT-->', '<!--FONTS-->', '/*STYLES*/']) if (!raw.includes(m)) throw new Error(`src/index.template.html : marqueur ${m} introuvable`);
// styles propres à une fonction (menu, PRISM, Videohub, réseau du car…) : src/styles/*.css, par ordre alphabétique
// du nom sans « .css », pour qu'une feuille de base passe avant ses compléments (camlab.css, puis camlab-ch1.css…)
const stem = (f) => f.slice(0, -4);
const styles = fs.readdirSync('src/styles').filter((f) => f.endsWith('.css')).sort((a, b) => (stem(a) < stem(b) ? -1 : stem(a) > stem(b) ? 1 : 0)).map((f) => `/* ${f} */\n` + fs.readFileSync('src/styles/' + f, 'utf8')).join('\n');
const tpl = raw.replace('<!--BOOT-->', () => `<script>${boot}</script>`).replace('<!--FONTS-->', () => `<style>${fontCss}</style>`).replace('/*STYLES*/', () => styles);
// three.js seul reste dehors (CDN) : ses modules complémentaires (three/addons/…, le téléphone) sont intégrés,
// et leur « import from 'three' » part vers le même CDN (une option external: ['three'] les laisserait dehors)
const threeOnly = { name: 'three-cdn', setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: 'three', external: true })); } };
const bundle = async (external) => {
  const r = await esbuild.build({
    entryPoints: ['src/main.js'], bundle: true, format: 'esm', write: false, plugins: external ? [threeOnly] : [],
    minify, target: TARGET, define, legalComments: 'none', charset: 'utf8',
    loader: { '.txt': 'text', '.bat': 'text', '.command': 'text', '.sh': 'text', '.svg': 'text', '.html': 'text' }, // mode d'emploi et lanceurs du serveur réseau local, icônes, console dot2 du Labo
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
// serveur autonome : un seul fichier à copier sur l'ordinateur qui héberge (node car-regie-serveur-lan.mjs) :
// lan/serveur.mjs et lan/internet.mjs regroupés, la page intégrée
const srv = fs.readFileSync('lan/serveur.mjs', 'utf8');
if (!srv.includes('let PAGE = null;')) throw new Error('lan/serveur.mjs : marqueur PAGE introuvable');
const server = (await esbuild.build({
  stdin: { contents: srv.replace('let PAGE = null;', () => `let PAGE = ${JSON.stringify(lan)};`), resolveDir: 'lan', sourcefile: 'serveur.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node18', write: false, legalComments: 'none', charset: 'utf8', logLevel: 'warning',
})).outputFiles[0].text;
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

// le matching à la mire (v19.30) : une page à part (src/matching/), document complet, servie par tools/matching.mjs
// (qui relaie aussi les commandes vers les caméras Panasonic) ; Archivo et B612 Mono seulement
{
  const tplM = fs.readFileSync('src/matching/index.template.html', 'utf8');
  for (const m of ['<!--FONTS-->', '/*STYLES*/', '<!--APP-->']) if (!tplM.includes(m)) throw new Error(`src/matching/index.template.html : marqueur ${m} introuvable`);
  const js = (await esbuild.build({ entryPoints: ['src/matching/app.js'], bundle: true, format: 'esm', write: false, minify, target: TARGET, define, legalComments: 'none', charset: 'utf8' })).outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  const fontsM = fontFaces(FONTS.filter(([f]) => f === 'Archivo' || f === 'B612 Mono'));
  const page = tplM.replace('<!--FONTS-->', () => `<style>${fontsM}</style>`).replace('/*STYLES*/', () => fs.readFileSync('src/matching/matching.css', 'utf8')).replace('<!--APP-->', () => `<script type="module">\n${js}\n</script>`);
  fs.writeFileSync('dist/matching.html', page);
  console.log('dist/matching.html', (page.length / 1024).toFixed(0) + ' KB');
}
