// Maquette de la section Cours, seule dans une page (sans le stade ni le car) :
//   node tools/cours-preview.mjs [fichier.html]     (par défaut dist/cours-maquette.html)
// Même feuille de style que le simulateur ; les polices viennent de Google Fonts. Les boutons
// « Emmène-moi » et « Parcours du chef » disent seulement ce qu'ils feront dans le simulateur.
import * as esbuild from 'esbuild';
import fs from 'fs';

const out = process.argv[2] || 'dist/cours-maquette.html';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const raw = fs.readFileSync('src/index.template.html', 'utf8');
const styles = fs.readdirSync('src/styles').filter((f) => f.endsWith('.css')).sort().map((f) => fs.readFileSync('src/styles/' + f, 'utf8')).join('\n');
const css = raw.slice(raw.indexOf('<style>') + 7, raw.indexOf('</style>')).replace('/*STYLES*/', () => styles);
const entry = `
import { coursView } from './src/ui/cours/cours.js';
const toast = document.getElementById('co-toast');
let timer = 0;
const go = (g) => {
  toast.textContent = g.station ? 'Dans le simulateur, ce bouton vous emmène au poste et l\\'ouvre.' : 'Dans le simulateur, ce bouton lance ce parcours avec le chef de car.';
  toast.hidden = false; clearTimeout(timer); timer = setTimeout(() => { toast.hidden = true; }, 4000);
};
document.getElementById('cours-app').append(coursView({ go, hash: true }).node);
`;
const r = await esbuild.build({
  stdin: { contents: entry, resolveDir: '.', loader: 'js' }, bundle: true, format: 'esm', write: false, minify: true,
  target: ['chrome100', 'edge100', 'firefox100', 'safari15'], define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  legalComments: 'none', charset: 'utf8', loader: { '.svg': 'text' },
});
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const page = `<title>Cours du car régie</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Archivo+Narrow:wght@500;600;700&family=B612+Mono:wght@400;700&display=swap">
<style>${css}
html, body { height: auto; }
body { overflow: auto; overscroll-behavior: auto; background: var(--bg); color: var(--fg); }
.cp-page { box-sizing: border-box; max-width: 1240px; margin: 0 auto; padding-block: 20px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 16px; }
.cp-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.cp-top .tape { font-size: 18px; }
.cp-top p { margin: 0; flex: 1 1 320px; }
#co-toast { position: fixed; z-index: 50; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); max-width: calc(100vw - 32px); padding: 9px 16px; background: var(--brush), rgba(44,52,60,.97); border: 1px solid #161b1f; border-radius: 4px; box-shadow: inset 4px 0 0 var(--cyan), 0 8px 24px rgba(0,0,0,.45); font-size: 14px; }
</style>
<div class="cp-page">
  <header class="cp-top"><span class="tape">Cours</span><p class="note">Maquette de la section Cours, à valider : une fiche avec manipulation (SDI), trois fiches reprises du lexique réseau, huit en préparation. Version ${pkg.version}.</p></header>
  <div id="cours-app"></div>
</div>
<div id="co-toast" role="status" hidden></div>
<script type="module">${js}</script>
`;
fs.writeFileSync(out, page);
console.log(out, (page.length / 1024).toFixed(0) + ' KB');
