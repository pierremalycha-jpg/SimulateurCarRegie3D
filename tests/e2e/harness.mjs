// ----------------------------------------------------------------------------------
// Harnais commun des tests de bout en bout : Chromium (Playwright) en rendu logiciel
// SwiftShader, page servie comme sur claude.ai (fragment HTML dans un squelette), three.js
// fourni localement à la place du CDN, polices bloquées, erreurs de la page collectées.
// Les attentes se font sur une condition (waitForFunction) plutôt que sur un délai fixe :
// le rendu logiciel est lent et irrégulier (0,1 à quelques images par seconde).
// ----------------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'];

// Playwright : dépendance du projet si elle est installée, sinon installation globale de npm
let pw = null;
export async function playwright() {
  if (pw) return pw;
  try { pw = await import('playwright'); } catch (e) {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    pw = createRequire(path.join(root, 'noop.js'))('playwright');
  }
  return pw;
}
const browsers = new Set();
export async function launch(extra = []) {
  const { chromium } = await playwright();
  const b = await chromium.launch({ args: [...GL_ARGS, ...extra] });
  browsers.add(b);
  return b;
}
export async function closeAll() { for (const b of browsers) { try { await b.close(); } catch (e) { /* déjà fermé */ } } browsers.clear(); }

// la page telle que claude.ai la sert : le fichier publié est un fragment placé dans <body>
const PAGES = {};
export function simHtml(file = 'dist/index.html') {
  return PAGES[file] ||= '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.resolve(ROOT, file), 'utf8') + '</body></html>';
}
let THREE_JS = null;
const NOISE = /fonts\.g|ERR_FAILED|net::/; // polices bloquées, serveur réseau local relancé pendant un test

/**
 * Ouvre le simulateur dans un nouvel onglet et attend qu'il soit prêt (window.__dbg).
 * @param {any} browser
 * @param {{ viewport?: { width: number, height: number }, query?: string, id?: string, errors?: string[], mobile?: boolean, url?: string, file?: string, before?: (page: any) => any, ready?: string }} [o]
 */
export async function openPage(browser, o = {}) {
  const { viewport = { width: 1280, height: 800 }, query = 'lite', id = '', errors = [], mobile = false } = o;
  const page = await browser.newPage({ viewport, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : {}) });
  // rendu logiciel lent et machine partagée : les actions et captures attendent jusqu'à 3 min
  page.setDefaultTimeout(180000);
  const tag = id ? id + ': ' : '';
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(tag + m.text()); });
  page.on('pageerror', (e) => errors.push(tag + 'PAGEERROR: ' + e.message + '\n' + e.stack));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
  if (!o.url) {
    THREE_JS ||= fs.readFileSync(path.join(ROOT, 'node_modules/three/build/three.module.min.js'));
    await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: THREE_JS, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
    await page.route('http://local.test/**', (r) => r.fulfill({ body: simHtml(o.file), contentType: 'text/html' }));
  }
  if (o.before) await o.before(page);
  await page.goto(o.url || 'http://local.test/?' + query, { timeout: 180000 });
  await page.waitForFunction(o.ready || '!!window.__dbg', null, { timeout: 180000, polling: 200 });
  return page;
}
// attend une condition dans la page ; false si le délai est dépassé (au lieu de lever)
export const until = (page, fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 250 }).then(() => true).catch(() => false);

// dossier des captures : argument 1 du script, sinon test-results/<nom>
export function outDir(name) {
  const d = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : path.join(ROOT, 'test-results', name);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// vérifications et bilan : le code de sortie reflète le résultat (utilisé par tools/e2e.mjs)
export function reporter() {
  const R = { errors: /** @type {string[]} */ ([]), fails: /** @type {string[]} */ ([]), checks: 0 };
  R.log = (...a) => console.log(...a);
  R.check = (name, ok, extra = '') => { R.checks++; if (!ok) R.fails.push(name); console.log(ok ? 'OK  ' : 'FAIL', name, extra); return !!ok; };
  R.finish = async () => {
    console.log('ERRORS', R.errors.length, R.errors.slice(0, 8).join('\n'));
    console.log(R.fails.length ? `ÉCHECS ${R.fails.length}/${R.checks} : ${R.fails.join(' | ')}` : `TOUT VA BIEN (${R.checks} vérifications)`);
    await closeAll();
    process.exitCode = R.fails.length || R.errors.length ? 1 : 0;
  };
  return R;
}
