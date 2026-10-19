// Chef de car, parcours de tous les postes, rejoués dans le navigateur par le panneau du chef :
// pour chaque action, « Emmène-moi / Montre-moi » doit amener au bon endroit et mettre en
// évidence un élément réel de la page, puis « Fais-le pour moi » doit faire valider l'étape
// sur l'état réel du simulateur (image rendue, mélangeur, serveur, console, visionneuse,
// atelier…). Les questions sont répondues par le bon choix.
// node tests/e2e/chef-postes.mjs [dossier] [id,id…]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('chef-postes');
const T = reporter();
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);
const IDS = ['prise-en-main', 'melangeur-commuter', 'melangeur-incrustations', 'realisateur-ordres', 'scripte-notes', 'production-suivi',
  'vision-exposition', 'vision-balance', 'ccu-depannage', 'cadreur-cadrer', 'evs-ralenti', 'evs-clips', 'ipdirector-clips', 'son-tranche', 'son-departs',
  'hf-liaisons', 'synchro-reference', 'grille-routage', 'brassage-cordons', 'transmission-secours', 'intercom-parler',
  'chef-lineup', 'chef-depannage', 'chef-cablage', 'materiel-camera', 'materiel-synchro', 'materiel-evs', 'materiel-grille', 'materiel-pied-de-car', 'atelier-montage']
  .filter((id) => !ONLY.length || ONLY.includes(id));
const SHOTS = { 'melangeur-commuter/mix': 1, 'vision-exposition/expo': 1, 'evs-ralenti/air': 1, 'son-departs/n1': 1, 'materiel-camera/ref': 1, 'chef-lineup/list': 1, 'hf-liaisons/jam': 1, 'grille-routage/tx': 1 };

const browser = await launch();
const page = await openPage(browser, { viewport: { width: 1440, height: 900 }, errors: T.errors });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); T.log('shot', n); };
const cur = () => ev(() => { const X = window.__dbg.TUTOR; const s = X.lesson && X.lesson.steps[X.i]; return s ? { id: s.id, done: X.done, quiz: s.quiz ? s.quiz.answer : null, act: !!s.done, show: !!s.show, go: !!s.go } : null; });

await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', false); });
T.check('partie lancée (car SDI)', await until(page, () => window.__dbg.S.mode === 'fps', null, 60000));
await page.waitForTimeout(3000);
await ev(() => window.__dbg.toggleChef(true));
// l'accueil : les familles de parcours, repliées, avec leur progression
T.check('accueil du chef : familles de parcours', await until(page, () => document.querySelectorAll('#chef details.chef-more').length >= 8, null, 8000), await ev(() => [...document.querySelectorAll('#chef details.chef-more summary')].map((s) => s.textContent).join(' | ')));
await shot('00-accueil');

const misses = [];
for (const id of IDS) {
  const t0 = Date.now();
  await ev((i) => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson(i); }, id);
  const done = [];
  let stuck = null;
  for (let k = 0; k < 30; k++) {
    const s = await cur(); if (!s) break;
    if (s.quiz != null && !s.done) {
      await page.locator('#chef .chef-choice').nth(s.quiz).click();
      await page.waitForTimeout(200);
    } else if (s.act && !s.done) {
      // « Emmène-moi » ou « Montre-moi » : on doit arriver au bon endroit, un élément réel est mis en évidence
      const b = page.locator('#chef button', { hasText: /Emmène-moi|Montre-moi/ }).first();
      if (s.show && await b.count()) {
        await b.click(); await page.waitForTimeout(400);
        if (await b.count()) { await b.click().catch(() => {}); }
        const seen = await until(page, () => { const sp = document.getElementById('chef-spot'); return (sp && !sp.hidden) || window.__dbg.TUTOR.done; }, null, 6000);
        if (!seen) misses.push(`${id}/${s.id}`);
      }
      if (SHOTS[`${id}/${s.id}`]) await shot(`${id}-${s.id}`);
      if (!(await ev(() => window.__dbg.TUTOR.done))) await ev(() => window.__dbg.chefDoForMe());
      // les ralentis, transitions, mesures d'image et l'atelier prennent quelques images de rendu logiciel
      if (!(await until(page, () => { const X = window.__dbg.TUTOR; return !!X.done; }, null, id === 'atelier-montage' ? 120000 : 45000))) { stuck = s.id; break; }
    }
    done.push(s.id);
    await ev(() => window.__dbg.chefNext()); await page.waitForTimeout(150);
  }
  const fin = await ev((i) => !!(window.__dbg.PROG.tutor[i] && window.__dbg.PROG.tutor[i].done) && !window.__dbg.TUTOR.lesson, id);
  T.check(`parcours ${id}`, !stuck && fin, `${Math.round((Date.now() - t0) / 1000)} s · ${stuck ? 'bloqué à « ' + stuck + ' » après ' : ''}${done.join(' → ')}`);
  if (stuck) { await shot(`bloque-${id}-${stuck}`); await ev(() => { if (window.__dbg.TUTOR.lesson) window.__dbg.stopChefLesson && window.__dbg.stopChefLesson(); }); }
  // retour à un état neutre entre deux parcours : pas de fenêtre ouverte, pas de poste
  await ev(() => { const m = document.querySelector('#modal'); if (m && !m.hidden) { const x = m.querySelector('.x'); if (x) x.click(); } if (window.__dbg.S.mode === 'station') window.__dbg.closeStation(); if (window.__dbg.S.mode === 'camop') window.__dbg.releaseCamera(); });
  await page.waitForTimeout(300);
}
T.check('« Emmène-moi / Montre-moi » trouve l\'élément à chaque action', misses.length === 0, misses.join(', '));
await ev(() => window.__dbg.toggleChef(true));
await page.waitForTimeout(500);
await shot('99-accueil-progression');
await T.finish();
