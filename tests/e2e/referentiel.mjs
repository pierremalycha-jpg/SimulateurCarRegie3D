// Le référentiel du BTS cité dans le Cours (v19.23) : la page « Le référentiel du BTS » (épreuves de l'option,
// l'épreuve E4 TMO et ses quatorze compétences, les 39 compétences par unité avec leurs activités, les savoirs),
// le bloc Référentiel en fin de leçon (compétences C…, épreuve, savoir-faire et savoirs), le rappel en tête de
// chapitre, les numéros officiels dans le livret, et une leçon de la TMO jouée (quiz et exercice présents).
// node tests/e2e/referentiel.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('referentiel');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { title: true, errors: T.errors, viewport: { width: 1400, height: 1000 } });
await until(A, () => !!document.querySelector('#title.ready'), null, 180000);
const ev = (f, a) => A.evaluate(f, a);
const shot = async (name, sel = '#layer .co-page') => {
  const vp = A.viewportSize(); const h = await ev((s) => { const e = document.querySelector(s); return e ? Math.ceil(e.getBoundingClientRect().height) + 160 : 0; }, sel);
  if (h > vp.height) { await A.setViewportSize({ width: vp.width, height: Math.min(h, 7000) }); await A.waitForTimeout(150); }
  const p = await A.$(sel); if (p) await p.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
  if (h > vp.height) await A.setViewportSize(vp);
};
const clic = async (sel) => { const ok = await ev((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel); if (!ok) throw new Error('introuvable : ' + sel); };

// ---------------- la page du référentiel ----------------
await A.click('#ti-cours'); await A.waitForTimeout(600);
await clic('#layer .co-refnav'); await A.waitForTimeout(500);
const page = await ev(() => ({
  h: document.querySelector('#layer .co-page h2')?.textContent || '', epreuves: document.querySelectorAll('#layer .co-ref-table tbody tr').length,
  tmo: document.querySelectorAll('#layer .co-ref-tmo .co-ref-chip.tmo').length, cartes: document.querySelectorAll('#layer .co-ref-card').length,
  unites: [...document.querySelectorAll('#layer .co-ref-sec[data-unite]')].map((s) => s.dataset.unite), fams: document.querySelectorAll('#layer .co-ref-fam').length,
  nav: document.querySelector('#layer .co-refnav')?.classList.contains('on'), nul: /\bnull\b|undefined|NaN/.test(document.querySelector('#layer .co-page')?.textContent || ''),
}));
T.check('la page : titre, 7 épreuves, 14 compétences de la TMO, 39 cartes en 5 unités, 12 familles de savoirs', page.h.startsWith('Le référentiel du BTS') && page.epreuves === 7 && page.tmo === 14 && page.cartes === 39 && JSON.stringify(page.unites) === JSON.stringify(['U3', 'U4', 'U51', 'U52', 'U6']) && page.fams === 12 && page.nav && !page.nul, JSON.stringify(page));
await clic('#layer .co-ref-tmo .co-ref-chip[data-code="C25"]'); await A.waitForTimeout(400);
const c25 = await ev(() => { const d = document.querySelector('#layer #ref-C25'); return { open: !!d?.open, sf: d?.querySelectorAll('.co-ref-sf li').length, lecons: d?.querySelectorAll('.co-ref-lecon').length, attendu: /Résultat attendu/.test(d?.textContent || ''), ancien: /2\.10/.test(d?.textContent || '') }; });
T.check('une compétence de la TMO (C25) : carte ouverte, savoir-faire SF67 et SF68, leçons du Cours, résultat attendu, ancien numéro 2.10', c25.open && c25.sf === 2 && c25.lecons >= 5 && c25.attendu && c25.ancien, JSON.stringify(c25));
await shot('01-referentiel');
// une compétence hors simulateur dit quel module la comblera
const c37 = await ev(() => { const d = document.querySelector('#layer #ref-C37'); d.open = true; return /Pas encore dans le simulateur/.test(d.textContent) && /Recette et maintenance/.test(d.textContent); });
T.check('C37, hors simulateur : « Pas encore dans le simulateur », module prévu', c37);

// ---------------- une leçon : le bloc Référentiel ----------------
await clic('#layer #ref-C25 .co-ref-lecon[data-lesson="expl-nodal"]'); await A.waitForTimeout(600);
const lecon = await ev(() => ({
  h: document.querySelector('#layer .co-page h2')?.textContent || '', comps: [...document.querySelectorAll('#layer .co-ref .co-ref-comp b')].map((b) => b.textContent),
  lede: document.querySelector('#layer .co-ref .co-ref-lede')?.textContent || '', sav: document.querySelectorAll('#layer .co-ref .co-ref-sav').length, sf: document.querySelectorAll('#layer .co-ref .co-ref-sf li').length,
  quiz: !!document.querySelector('#layer .co-quiz'), exo: !!document.querySelector('#layer .co-exoauto'), demo: !!document.querySelector('#layer .co-demo .co-read'), fig: !!document.querySelector('#layer .co-figbox svg'),
}));
T.check('leçon « Le nodal » : compétences C28, C15, C26, C25, épreuve E4 (TMO) annoncée, savoirs et savoir-faire, schéma, manipulation, quiz et exercice', lecon.h.startsWith('Le nodal') && JSON.stringify(lecon.comps) === JSON.stringify(['C28', 'C15', 'C26', 'C25']) && /E4, Techniques et mise en œuvre/.test(lecon.lede) && lecon.sav === 6 && lecon.sf >= 8 && lecon.quiz && lecon.exo && lecon.demo && lecon.fig, JSON.stringify(lecon));
await ev(() => { const d = document.querySelector('#layer .co-ref-det'); if (d) d.open = true; });
await shot('02-lecon-nodal-referentiel', '#layer .co-ref');
// la manipulation calcule : cocher le clean fait monter le compte des renvois
const avant = await ev(() => document.querySelector('#layer .co-demo .co-read dd')?.textContent);
await clic('#layer .co-demo label:nth-of-type(3) input'); await A.waitForTimeout(200);
const apres = await ev(() => document.querySelector('#layer .co-demo .co-read dd')?.textContent);
T.check('la manipulation du nodal recompte les renvois quand on ajoute le clean', avant === '2 sur 4' && apres === '3 sur 4', `${avant} → ${apres}`);
// le bouton du bloc ramène au référentiel, sur la première compétence de la leçon
await clic('#layer .co-ref .co-ref-btn'); await A.waitForTimeout(500);
T.check('« Le référentiel du BTS » depuis la leçon : la page, la carte C28 ouverte', await ev(() => document.querySelector('#layer .co-page h2')?.textContent.startsWith('Le référentiel') && !!document.querySelector('#layer #ref-C28')?.open));

// ---------------- un chapitre : le rappel en tête ----------------
await ev(() => window.__dbg.openCours({ chapter: 'exploitation' })); await A.waitForTimeout(500);
const chap = await ev(() => ({ chips: document.querySelectorAll('#layer .co-ref-chap .co-ref-chip').length, tmo: document.querySelectorAll('#layer .co-ref-chap .co-ref-chip.tmo').length, fams: /Savoirs :/.test(document.querySelector('#layer .co-ref-chap')?.textContent || ''), lecons: document.querySelectorAll('#layer .pa-node').length, apres: document.querySelector('#layer .lede')?.nextElementSibling?.classList.contains('co-ref-chap') }));
T.check('chapitre L\'exploitation : rappel du référentiel sous l\'introduction, compétences dont celles de la TMO, familles de savoirs, 11 leçons', chap.chips >= 14 && chap.tmo >= 8 && chap.fams && chap.lecons === 11 && chap.apres, JSON.stringify(chap));
await shot('03-chapitre-exploitation');
// une compétence du rappel ouvre la page du référentiel sur sa carte
await clic('#layer .co-ref-chap .co-ref-chip[data-code="C8"]'); await A.waitForTimeout(500);
T.check('un code du rappel ouvre la page du référentiel sur C8', await ev(() => !!document.querySelector('#layer #ref-C8')?.open));

// ---------------- les leçons de la TMO : quiz et exercice ----------------
for (const id of ['expl-synoptique', 'expl-energie', 'expl-pad', 'expl-recette']) {
  await ev((l) => window.__dbg.openCours(l), id); await A.waitForTimeout(500);
  const ok = await ev(() => !!document.querySelector('#layer .co-quiz') && !!document.querySelector('#layer .co-exoauto') && !!document.querySelector('#layer .co-ref') && document.querySelectorAll('#layer .co-demo .co-read dd').length >= 4 && !/undefined|NaN/.test(document.querySelector('#layer .co-page')?.textContent || ''));
  T.check(`leçon ${id} : manipulation qui lit, quiz, exercice, référentiel, sans valeur manquante`, ok);
}
await ev(() => window.__dbg.openCours('expl-energie')); await A.waitForTimeout(500);
await shot('04-lecon-energie');

// ---------------- le livret : numéros officiels, unité et savoir-faire ----------------
await ev(() => window.__dbg.emit('cours', { home: true })); await A.waitForTimeout(400);
await A.click('#layer .btn:has-text("Ouvrir le livret complet")'); await A.waitForTimeout(500);
const lv = await ev(() => ({ n: document.querySelectorAll('#modal .lv-comp').length, codes: [...document.querySelectorAll('#modal .lv-code')].slice(0, 4).map((e) => e.textContent), u4: /U4, E4 TMO/.test(document.querySelector('#modal')?.textContent || ''), sf: document.querySelectorAll('#modal .lv-sf').length, intro: /C1 à C39/.test(document.querySelector('#modal .lv-intro')?.textContent || ''), absent: document.querySelectorAll('#modal .lv-comp.lv-absent').length }));
T.check('livret : 39 compétences numérotées C…, bloc 1 = C6, C21, C27, C32, unité et épreuve, savoir-faire repliés, 3 hors simulateur', lv.n === 39 && JSON.stringify(lv.codes) === JSON.stringify(['C6', 'C21', 'C27', 'C32']) && lv.u4 && lv.sf === 39 && lv.intro && lv.absent === 3, JSON.stringify(lv));
await A.screenshot({ path: `${OUT}/05-livret.png` });
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
await A.close();
await T.finish();
