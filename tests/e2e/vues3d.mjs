// Les vues 3D du Cours (v19.16) : l'entrée « … en 3D » du sommaire d'un chapitre ouvre la première vue avec
// la liste ; le bouton « Voir en 3D » d'une leçon ouvre sa vue à l'étape tirée de cette leçon ; chaque vue
// (14) se construit, chacune de ses étapes s'affiche sans erreur, avec ses commandes et ses lectures ;
// l'onglet « La leçon » garde l'écrit ; Pause et Étiquettes ; le simulateur est en pause pendant ce temps ;
// Échap ramène dans le Cours, sur la leçon ou le chapitre d'où l'on venait. Puis à 390 px : le panneau
// passe sous la scène, sans défilement horizontal.
// node tests/e2e/vues3d.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('vues3d');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { title: true, fresh: true, errors: T.errors });
await until(A, () => !!document.querySelector('#title.ready'), null, 180000);
const ev = (f, a) => A.evaluate(f, a);
const ouverte = () => until(A, () => !!window.__dbg.vues3d() && !document.getElementById('vues3d').hidden && !!window.__dbg.vues3d().vue, null, 120000);
const etat = () => ev(() => { const R = window.__dbg.vues3d(); return { vue: R.vue && R.vue.id, etape: R.etape, n: R.vue ? R.vue.etapes.length : 0, st: R.side.querySelector('.v3-st')?.textContent || '', sn: R.side.querySelector('.v3-sn')?.textContent || '' }; });

// ---------------- depuis le titre : Cours, chapitre SDI, « Le SDI en 3D » ----------------
await A.click('#ti-cours'); await A.waitForTimeout(500);
await ev(() => window.__dbg.emit('cours', { chapter: 'sdi' })); await A.waitForTimeout(300);
const mod = await ev(() => [...document.querySelectorAll('#layer details.co-chap[open] .co-module')].map((b) => ({ ev: /** @type {HTMLElement} */ (b).dataset.event, t: b.textContent })));
T.check('chapitre SDI : l\'entrée « Le SDI en 3D » dans le sommaire', mod.some((m) => m.ev === 'vue3d' && /Le SDI en 3D/.test(m.t)), JSON.stringify(mod));
await A.click('#layer details.co-chap[open] .co-module[data-event="vue3d"]');
T.check('la vue s\'ouvre plein écran', await ouverte());
await A.waitForTimeout(1500);
let e = await etat();
T.check('la première vue du chapitre, à l\'étape 1', e.vue === 'sdi-trame' && e.etape === 0 && /Étape 1 \/ 9/.test(e.sn), JSON.stringify(e));
T.check('l\'espace Cours s\'est refermé, le titre est caché, la liste des vues est ouverte', await ev(() => !document.getElementById('layer') && document.getElementById('title').hidden && document.body.classList.contains('vues3d-on') && !document.querySelector('#vues3d .v3-list').hidden));
const nListe = await ev(() => document.querySelectorAll('#vues3d .v3-list .v3-li').length);
const nVues = await ev(() => window.__dbg.vues3d().list.querySelectorAll('.v3-ch').length);
T.check('la liste : toutes les vues, rangées par chapitre', nListe >= 14 && nVues === 6, `${nListe} vues, ${nVues} chapitres`);
await A.screenshot({ path: `${OUT}/01-sdi-liste.png` });
T.check('les touches du simulateur sont ignorées pendant la vue', await ev(() => { const before = window.__dbg.S.mode; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })); return !document.getElementById('layer') && window.__dbg.S.mode === before; }));
await A.click('#vues3d .v3-lh .linkbtn'); await A.waitForTimeout(200);
T.check('« Fermer » range la liste', await ev(() => document.querySelector('#vues3d .v3-list').hidden));

// ---------------- Pause, Étiquettes, onglet « La leçon » ----------------
await A.click('#vues3d .v3-tools button:nth-child(3)'); await A.waitForTimeout(150);
T.check('Pause : l\'animation s\'arrête', await ev(() => window.__dbg.vues3d().paused === true));
await A.click('#vues3d .v3-tools button:nth-child(3)');
await A.click('#vues3d .v3-tools button:nth-child(2)'); await A.waitForTimeout(150);
T.check('Étiquettes : masquées puis remises', await ev(() => window.__dbg.vues3d().tagsOn === false && document.querySelector('#vues3d .v3-tags').hidden !== undefined));
await A.click('#vues3d .v3-tools button:nth-child(2)');
await A.click('#vues3d .v3-tab[data-tab="lecon"]'); await A.waitForTimeout(300);
const lec = await ev(() => { const s = document.querySelector('#vues3d .v3-side'); return { ess: s.querySelectorAll('.co-ess li').length, txt: (s.querySelector('.co-text')?.textContent || '').length, btn: [...s.querySelectorAll('button')].some((b) => /Ouvrir la leçon dans le Cours/.test(b.textContent)) }; });
T.check('onglet « La leçon » : l\'essentiel, l\'explication, le lien vers la leçon', lec.ess >= 1 && lec.txt > 300 && lec.btn, JSON.stringify(lec));
await A.screenshot({ path: `${OUT}/02-onglet-lecon.png` });
await A.click('#vues3d .v3-tab[data-tab="vue"]'); await A.waitForTimeout(200);

// ---------------- chaque vue, chaque étape ----------------
// (la vue PTP est rangée dans deux chapitres : on la visite une fois)
const VUES = await ev(() => [...new Set([...document.querySelectorAll('#vues3d .v3-list .v3-li')].map((b) => /** @type {HTMLElement} */ (b).dataset.vue))]);
T.log('vues', VUES.length, VUES.join(' '));
const pb = [];
for (const id of VUES) {
  const err0 = T.errors.length;
  await ev((v) => window.__dbg.emit('vue3d', { vue: v, from: 'cours' }), id);
  await until(A, (v) => window.__dbg.vues3d().vue?.id === v, id, 30000);
  await A.waitForTimeout(400);
  const n = (await etat()).n;
  const forme = await ev(() => { const s = document.querySelector('#vues3d .v3-side'); return { cmd: !!s.querySelector('.v3-cmd .v3-ctl, .v3-cmd'), reads: s.querySelectorAll('.v3-read dd').length, dots: s.querySelectorAll('.v3-dot').length }; });
  if (!forme.cmd || forme.dots !== n) pb.push(`${id} : panneau ${JSON.stringify(forme)}`);
  for (let k = 0; k < n; k++) {
    await ev((i) => /** @type {HTMLElement} */ (document.querySelectorAll('#vues3d .v3-dot')[i]).click(), k);
    await A.waitForTimeout(350);
    const s = await etat();
    const t = await ev((i) => window.__dbg.vues3d().vue.etapes[i].t, k);
    if (s.etape !== k || s.st !== t || !s.sn.includes(`Étape ${k + 1} / ${n}`)) pb.push(`${id} étape ${k + 1} : ${JSON.stringify(s)}`);
  }
  // les lectures se remplissent (sauf « — » d'une lecture qui attend un geste)
  const lus = await ev(() => [...document.querySelectorAll('#vues3d .v3-read dd')].filter((d) => d.textContent && d.textContent !== '—').length);
  if (forme.reads && !lus) pb.push(`${id} : aucune lecture`);
  if (T.errors.length > err0) pb.push(`${id} : ${T.errors.slice(err0).join(' ; ').slice(0, 200)}`);
  await A.waitForTimeout(800);
  await A.screenshot({ path: `${OUT}/10-${id}.png` });
}
T.check(`chaque vue (${VUES.length}) et chacune de ses étapes s'affichent, avec commandes et lectures`, VUES.length >= 14 && !pb.length, pb.join(' | ').slice(0, 800));
T.check('une vue chassée libère sa scène (un seul groupe vivant)', await ev(() => window.__dbg.vues3d().scene.children.filter((c) => c.name.startsWith('vue ')).length === 1));

// ---------------- Échap : retour au chapitre ----------------
await A.keyboard.press('Escape'); await A.waitForTimeout(600);
T.check('Échap : retour dans le Cours, chapitre SDI ouvert, écran titre visible', await ev(() => !document.body.classList.contains('vues3d-on') && document.getElementById('vues3d').hidden && !!document.querySelector('#layer.ly-cours details.co-chap[open]') && !document.getElementById('title').hidden));

// ---------------- depuis une leçon : « Voir en 3D » ----------------
// reseau-vlan est au niveau Intermédiaire, fermé au profil Étudiant (parcours v19.18) : au profil Formateur, tout est ouvert
await ev(() => window.__dbg.setRole('formateur'));
await ev(() => window.__dbg.openCours('reseau-vlan')); await A.waitForTimeout(500);
const v3 = await ev(() => [...document.querySelectorAll('#layer .co-3d [data-vue]')].map((b) => /** @type {HTMLElement} */ (b).dataset.vue));
T.check('leçon reseau-vlan : la section « Voir en 3D » propose sa vue', v3.includes('reseau-vlan'), JSON.stringify(v3));
await A.screenshot({ path: `${OUT}/20-lecon-voir-en-3d.png` });
await A.click('#layer .co-3d [data-vue="reseau-vlan"]');
await ouverte(); await A.waitForTimeout(800);
e = await etat();
T.check('la vue de la leçon s\'ouvre', e.vue === 'reseau-vlan', JSON.stringify(e));
await A.click('#vues3d .v3-nav .primary'); await A.waitForTimeout(400);
T.check('« Suivante » passe à l\'étape 2', (await etat()).etape === 1);
await A.focus('#vues3d .v3-gl'); await A.keyboard.press('ArrowRight'); await A.waitForTimeout(300);
T.check('flèche droite (scène active) : étape 3', (await etat()).etape === 2);
await A.keyboard.press('Escape'); await A.waitForTimeout(600);
T.check('Échap : retour sur la leçon reseau-vlan', await ev(() => /** @type {HTMLElement | null} */ (document.querySelector('#layer.ly-cours .co-les[aria-current="true"]'))?.dataset.lesson === 'reseau-vlan'));
// une leçon du chapitre synchro voit aussi la vue PTP du réseau (rangée dans les deux)
await ev(() => window.__dbg.emit('cours', { chapter: 'synchro' })); await A.waitForTimeout(300);
const sy = await ev(() => document.querySelector('#layer details.co-chap[open] .co-module[data-event="vue3d"]')?.textContent || '');
T.check('chapitre Synchro : « La synchro en 3D » liste le genlock et le PTP', /La synchro en 3D/.test(sy) && /PTP/.test(sy), sy.slice(0, 200));

// ---------------- au téléphone (390 px) ----------------
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
await A.setViewportSize({ width: 390, height: 844 });
await ev(() => window.__dbg.emit('vue3d', { vue: 'st2110-paquet', from: 'cours' }));
await ouverte(); await A.waitForTimeout(1500);
const m = await ev(() => { const s = document.querySelector('#vues3d .v3-side').getBoundingClientRect(), g = document.querySelector('#vues3d .v3-gl').getBoundingClientRect(); return { dessous: s.top >= g.top + g.height * 0.4, large: Math.round(s.width), page: document.documentElement.scrollWidth > innerWidth + 1, side: document.querySelector('#vues3d .v3-side').scrollWidth > document.querySelector('#vues3d .v3-side').clientWidth + 1 }; });
T.check('390 px : le panneau passe sous la scène, sans défilement horizontal', m.dessous && !m.page && !m.side, JSON.stringify(m));
await A.screenshot({ path: `${OUT}/30-telephone.png` });
await A.keyboard.press('Escape'); await A.waitForTimeout(300);

await browser.close();
await T.finish();
