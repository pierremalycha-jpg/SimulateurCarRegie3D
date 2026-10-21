// Maquette du module « La caméra » en une page autonome, pour la montrer avant de l'intégrer :
// node tools/camlab-preview.mjs [sortie.html] [--local] [--fragment]
// (--local : three.js intégré à la page, pour l'ouvrir sans Internet ; sinon depuis jsDelivr.
// --fragment : sans doctype, html, head ni body, pour un hébergeur qui ajoute lui-même le squelette)
import * as esbuild from 'esbuild';
import fs from 'fs';
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const local = process.argv.includes('--local'), fragment = process.argv.includes('--fragment');
const out = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'dist/camlab-preview.html';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const FONTS = [['Archivo', 'archivo', [400, 500, 600, 700]], ['Archivo Narrow', 'archivo-narrow', [500, 600, 700]], ['B612 Mono', 'b612-mono', [400, 700]]];
const fontCss = FONTS.flatMap(([family, name, weights]) => weights.map((w) => {
  const b64 = fs.readFileSync(`node_modules/@fontsource/${name}/files/${name}-latin-${w}-normal.woff2`).toString('base64');
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
})).join('');
const raw = fs.readFileSync('src/index.template.html', 'utf8');
const styles = fs.readdirSync('src/styles').filter((f) => f.endsWith('.css')).sort().map((f) => fs.readFileSync('src/styles/' + f, 'utf8')).join('\n');
const css = raw.slice(raw.indexOf('<style>') + 7, raw.indexOf('</style>')).replace('/*STYLES*/', () => styles);
const r = await esbuild.build({
  entryPoints: ['tools/camlab-preview-entry.js'], bundle: true, format: 'esm', write: false, external: local ? [] : ['three'],
  minify: true, target: ['chrome100', 'edge100', 'firefox100', 'safari15'], define: { __APP_VERSION__: JSON.stringify(pkg.version) }, legalComments: 'none', charset: 'utf8',
});
let js = r.outputFiles[0].text;
if (!local) js = js.replace(/from\s*["']three["']/g, `from"${CDN}"`);
js = js.replace(/<\/script/g, '<\\/script');
const html = fragment
  ? `<title>Connaître la caméra</title><style>:root{color-scheme:dark}${fontCss}</style><style>${css}</style><script type="module">\n${js}\n</script>`
  : `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>La caméra</title><style>${fontCss}</style><style>${css}</style></head><body><script type="module">\n${js}\n</script></body></html>`;
fs.mkdirSync(out.replace(/[^/]*$/, '') || '.', { recursive: true });
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + ' KB');
