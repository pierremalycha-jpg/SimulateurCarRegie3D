import * as esbuild from 'esbuild';
import fs from 'fs';
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const minify = !process.argv.includes('--dev');
const r = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, format: 'esm', write: false, external: ['three'],
  minify, target: ['es2022'], legalComments: 'none', charset: 'utf8',
});
let js = r.outputFiles[0].text;
js = js.replace(/from\s*["']three["']/g, `from"${CDN}"`);
if (js.includes('</script')) js = js.replace(/<\/script/g, '<\\/script');
// le caractère de remplacement U+FFFD n'apparaît que dans des chaînes JS : on l'écrit en échappement
js = js.replace(/\uFFFD/g, '\\uFFFD');
const tpl = fs.readFileSync('src/index.template.html', 'utf8');
const out = tpl.replace('<!--APP-->', () => `<script type="module">\n${js}\n</script>`);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', out);
console.log('dist/index.html', (out.length / 1024).toFixed(0) + ' KB');
