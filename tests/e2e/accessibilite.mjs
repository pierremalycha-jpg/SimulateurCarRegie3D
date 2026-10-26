// Accessibilité : le moteur axe-core (Deque) passe sur les écrans principaux — feuille de service,
// chef de car, barre d'outils, téléphone, postes, guide, diagnostic, module caméra — selon WCAG 2.2 A et AA.
// Le canvas 3D est exclu (il n'a pas de texte). Le bilan liste chaque règle en défaut avec ses
// éléments ; le test échoue sur les défauts graves (impact « critical » ou « serious »).
// node tests/e2e/accessibilite.mjs [dossier]   (AXE_JSON=1 : écrit aussi le détail en JSON)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('accessibilite');
const T = reporter();
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const browser = await launch();
const page = await openPage(browser, { errors: T.errors, fresh: true, title: true, before: (pg) => pg.emulateMedia({ reducedMotion: 'reduce' }) });
const ev = (f, a) => page.evaluate(f, a);
const all = {};
async function scan(name, include, off = []) {
  if (!(await ev(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const r = await ev(async ({ tags, include, off }) => {
    const ctx = { include: include ? [[include]] : [['body']], exclude: [['canvas'], ['#minimon canvas']] };
    const rules = Object.fromEntries(off.map((id) => [id, { enabled: false }]));
    const res = await window.axe.run(ctx, { runOnly: { type: 'tag', values: tags }, rules, resultTypes: ['violations'] });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, nodes: v.nodes.slice(0, 6).map((n) => ({ t: n.target.join(' '), s: (n.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 220), h: n.html.slice(0, 140) })) }));
  }, { tags: TAGS, include, off });
  all[name] = r;
  const grave = r.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  T.check(`${name} : aucun défaut grave`, !grave.length, grave.map((v) => `${v.id} ×${v.n}`).join(', '));
  for (const v of r) {
    T.log(`   ${v.impact.padEnd(8)} ${v.id} ×${v.n} — ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) T.log(`        ${n.t}  ${n.s}`);
  }
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// écran titre, une fois le chargement terminé
await until(page, () => document.getElementById('title')?.classList.contains('ready'), null, 30000);
await scan('titre');
await ev(() => window.__dbg.title.enter('start'));
// écran Jouer, puis le chef de car ouvert dessus (touche J), les Réglages
await scan('accueil');
// fiche « Ce qui se prépare » d'un lieu en préparation
await page.locator('.lx[data-lieu="concert"]').click();
await until(page, () => !!document.querySelector('#modal .lx-teaser'), null, 8000);
await scan('lieu-concert', '#modal');
await ev(() => document.querySelector('#modal .x')?.click());
await page.keyboard.press('KeyJ');
await until(page, () => { const c = document.querySelector('#chef'); return !!c && !c.hidden; }, null, 15000);
await scan('accueil-chef');
await ev(() => window.__dbg.toggleChef(false));
await page.locator('#st-reglages').click();
await until(page, () => !!document.querySelector('#modal .rg'), null, 8000);
await scan('reglages', '#modal');
await ev(() => document.querySelector('#modal .x')?.click());
// en jeu (car installé) : barre d'outils, bande UMD
await page.locator('.jo-mode[data-mode="installe"]').click();
await page.locator('#st-antenne').click();
await until(page, () => window.__dbg.S.mode === 'fps', null, 90000);
await ev(() => window.__dbg.toggleChef(false));
await scan('jeu');
// téléphone : l'accueil, puis Aller à
await page.keyboard.press('Tab');
await until(page, () => { const s = window.__dbg.tel.state(); return s.open && s.t >= 1; }, null, 8000);
await scan('telephone', '#telephone');
await page.locator('#telephone .tel-app[data-app="aller"]').click();
await scan('telephone-aller', '#telephone');
await ev(() => window.__dbg.tel.close());
await until(page, () => document.getElementById('telephone').hidden, null, 8000);
// postes
for (const st of ['melangeur', 'realisateur', 'vision', 'evs', 'son', 'reseau', 'grille', 'mesure']) {
  await ev((s) => window.__dbg.openStation(s), st);
  await until(page, (s) => window.__dbg.S.mode === 'station' && window.__dbg.S.station === s, st, 30000);
  await page.waitForTimeout(800);
  await scan('poste-' + st);
  await ev(() => window.__dbg.closeStation());
}
// chef de car en jeu, à un poste (ses exercices)
await ev(() => window.__dbg.openStation('melangeur'));
await until(page, () => window.__dbg.S.mode === 'station', null, 30000);
await ev(() => window.__dbg.toggleChef(true));
await page.waitForTimeout(500);
await scan('chef', '#chef');
await ev(() => { window.__dbg.toggleChef(false); window.__dbg.closeStation(); });
// le Cours (touche G) : le suivi, une leçon et ses exercices pratiques ; le menu du car (Échap)
await page.keyboard.press('KeyG');
await until(page, () => !!document.querySelector('#layer .co-page'), null, 8000);
await page.waitForTimeout(500);
await scan('cours', '#layer');
await ev(() => window.__dbg.emit('cours', { lesson: 'reseau-multicast' }));
await until(page, () => !!document.querySelector('#layer .co-exos'), null, 8000);
await scan('cours-lecon', '#layer');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await until(page, () => !!document.querySelector('#modal .mn'), null, 8000);
await scan('menu', '#modal');
await ev(() => document.querySelector('#modal .x')?.click());
// fenêtres des outils : plan caméras, synoptiques, matériel, équipe, diagnostic
for (const [name, key] of [['plan-cameras', 'KeyP'], ['synoptiques', 'KeyY'], ['materiel', 'KeyK']]) {
  await page.keyboard.press(key);
  await until(page, () => !!document.querySelector('#modal:not([hidden]), #plan:not([hidden]), #syn:not([hidden])'), null, 8000);
  await page.waitForTimeout(800);
  await scan(name);
  await page.keyboard.press('Escape');
  await ev(() => { document.querySelector('#modal .x')?.click(); window.__dbg.closePlan(); });
  await page.waitForTimeout(300);
}
await ev(() => window.__dbg.openSessionPanel());
await page.waitForTimeout(500);
await scan('equipe', '#modal');
await ev(() => document.querySelector('#modal .x')?.click());
await ev(() => window.__dbg.diag.openDiag());
await scan('diagnostic', '#modal');
await ev(() => document.querySelector('#modal .x')?.click());

// la caméra en 3D : la liste, une fiche par groupe de chapitres, un quiz, la mise en service. Les
// pastilles suivent la caméra : deux peuvent se chevaucher selon l'angle de vue, d'où target-size écarté.
await ev(() => window.__dbg.emit('camera', {}));
await until(page, () => document.body.classList.contains('camlab-on') && !document.querySelector('.camlab .cl-loading'), null, 120000);
await scan('camera', '.camlab', ['target-size']);
for (const id of ['frontale', 'gain', 'knee', 'tally', 'fibre', 'vecto']) {
  await ev((id) => /** @type {HTMLElement} */ (document.querySelector(`.cl-ni[data-n="${id}"]`)).click(), id);
  await page.waitForTimeout(300);
  await scan('camera-' + id, '.camlab', ['target-size']);
}
await ev(() => /** @type {HTMLElement} */ (document.querySelector('.cs-qbtn[data-quiz="4"]')).click());
await scan('camera-quiz', '.camlab', ['target-size']);
await ev(() => /** @type {HTMLElement} */ (document.querySelector('.camlab .cl-bar .cs-mesbtn')).click());
await page.waitForTimeout(600);
await scan('camera-mise-en-service', '.camlab', ['target-size']);

if (process.env.AXE_JSON) fs.writeFileSync(path.join(OUT, 'axe.json'), JSON.stringify(all, null, 1));
await T.finish();
