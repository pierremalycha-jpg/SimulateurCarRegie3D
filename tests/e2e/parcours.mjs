// Le parcours du Cours (v19.18), au profil Étudiant : « Mon parcours » (la suite conseillée, une tuile par
// catégorie), les niveaux fermés au départ (sommaire, chemin du chapitre, aperçu d'une leçon fermée), une leçon
// faite jusqu'au bout (quiz, puis l'exercice en autonomie question par question, avec une aide, une erreur et
// une solution), le niveau Débutant du signal validé qui ouvre l'Intermédiaire, un test de niveau raté puis
// réussi, et le profil Formateur qui ouvre tout. Captures à 1400 px et à 390 px.
// node tests/e2e/parcours.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('parcours');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { title: true, fresh: true, errors: T.errors, viewport: { width: 1400, height: 1000 } });
await until(A, () => !!document.querySelector('#title.ready'), null, 180000);
const ev = (f, a) => A.evaluate(f, a);
// une capture de l'élément entier : la fenêtre est agrandie le temps de la prise (le Cours défile dans son calque)
const shot = async (name, sel = '#layer .co-page') => {
  const vp = A.viewportSize(); const h = await ev((s) => { const e = document.querySelector(s); return e ? Math.ceil(e.getBoundingClientRect().height) + 160 : 0; }, sel);
  if (h > vp.height) { await A.setViewportSize({ width: vp.width, height: Math.min(h, 7000) }); await A.waitForTimeout(150); }
  const p = await A.$(sel); if (p) await p.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
  if (h > vp.height) await A.setViewportSize(vp);
};
// les clics passent par la page : les manipulations animées des leçons ralentissent tant le rendu logiciel que
// l'attente de stabilité de Playwright dépasse son délai (et un clic tardif partirait deux fois)
const clic = async (sel) => {
  const ok = await ev((s) => { const b = /** @type {HTMLElement | null} */ (document.querySelector(s)); if (b) b.click(); return !!b; }, sel);
  if (!ok) throw new Error('introuvable : ' + sel);
};

// ---------------- Mon parcours ----------------
await A.click('#ti-cours'); await A.waitForTimeout(600);
const acc = await ev(() => ({ h: document.querySelector('#layer .co-page h2')?.textContent, cats: document.querySelectorAll('#layer .pa-cat').length, hero: document.querySelector('#layer .pa-hero b')?.textContent || '', kpis: document.querySelectorAll('#layer .pa-kpis .co-kpi').length, nul: /\bnull\b/.test(document.querySelector('#layer .co-page')?.textContent || '') }));
T.check('Mon parcours : la suite conseillée, une tuile par catégorie, quatre compteurs', acc.h === 'Mon parcours' && acc.cats === 10 && acc.kpis === 4 && !acc.nul, JSON.stringify(acc));
const premiere = await ev(() => window.__dbg.COURS.PARCOURS.PARCOURS.signal.debutant[0]);
T.check('la suite conseillée : la première leçon Débutant du premier chapitre', acc.hero === await ev((id) => window.__dbg.COURS.lessonById(id).lesson.title, premiere), acc.hero);
await shot('01-mon-parcours');
const fermes = await ev(() => ({ niv: document.querySelectorAll('#layer .co-niv.ferme').length, les: document.querySelectorAll('#layer .co-les.lock').length }));
T.check('sommaire : les niveaux au-delà de Débutant ont un cadenas', fermes.niv >= 15 && fermes.les >= 30, JSON.stringify(fermes));

// ---------------- le chemin d'un chapitre ----------------
await A.click('#layer .pa-cat[data-chapitre="reseau"]'); await A.waitForTimeout(400);
const ch = await ev(() => [...document.querySelectorAll('#layer .pa-niv')].map((s) => ({ n: /** @type {HTMLElement} */ (s).dataset.niveau, ouvert: s.classList.contains('ouvert'), ferme: s.classList.contains('ferme'), nodes: s.querySelectorAll('.pa-node').length, lock: s.querySelectorAll('.st-lock').length })));
T.check('le réseau : quatre niveaux, seul Débutant ouvert, les autres fermés avec leur test', ch.length === 4 && ch[0].ouvert && ch.slice(1).every((x) => x.ferme && x.lock === x.nodes) && await ev(() => document.querySelectorAll('#layer .pa-test-btn').length === 3), JSON.stringify(ch));
T.check('la leçon à faire est marquée, les conditions du palier sont affichées', await ev(() => !!document.querySelector('#layer .pa-step.st-cur') && document.querySelectorAll('#layer .pa-palier li').length === 2));
await shot('02-chemin-reseau');
await A.click('#layer .pa-node[data-lesson="reseau-nmos"]'); await A.waitForTimeout(400);
T.check('une leçon d\'un niveau fermé : l\'aperçu et le chemin pour l\'ouvrir, ni quiz ni exercice', await ev(() => !!document.querySelector('#layer .pa-lock') && !document.querySelector('#layer .co-quiz') && !document.querySelector('#layer .co-exoauto') && !document.querySelector('#layer .co-text')));
await shot('03-lecon-fermee');

// ---------------- une leçon jusqu'au bout : quiz, puis exercice ----------------
const quizJuste = async (id) => {
  const qs = await ev(() => [...document.querySelectorAll('#layer .co-q')].map((q) => Number(/** @type {HTMLElement} */ (q).dataset.q)));
  const bank = await ev((lid) => window.__dbg.COURS.lessonById(lid).lesson.quiz.map((q) => q.answer), id);
  for (const i of qs) await clic(`#layer .co-quiz .co-q[data-q="${i}"] .co-choice-btn[data-c="${bank[i]}"]`).catch(() => {});
  await clic('#layer .co-quiz .co-valider').catch(() => {}); await A.waitForTimeout(150);
};
/** répond à la question en cours de l'exercice ; mode : 'juste', 'aide' (une aide puis juste), 'faux' (une erreur puis juste), 'solution' */
const repondre = async (mode = 'juste') => {
  const it = await ev(() => { const R = window.__dbg.COURS.essai(); const x = R.items[R.k]; return { type: x.type, answer: x.answer, accept: x.accept, n: (x.items || []).length, choices: (x.choices || []).length }; });
  if (mode === 'aide') { await clic('#layer .pa-aide-btn'); await A.waitForTimeout(80); }
  if (mode === 'solution') { await clic('#layer .pa-sol-btn'); await A.waitForTimeout(80); return it; }
  if (mode === 'faux') {
    if (it.type === 'choix') await clic(`#layer .pa-q-choices [data-c="${(it.answer + 1) % it.choices}"]`);
    else if (it.type === 'nombre') await A.fill('#layer .pa-q-input', String(Number(it.answer) * 3 + 7));
    else if (it.type === 'texte') await A.fill('#layer .pa-q-input', 'réponse fausse');
    await clic('#layer .pa-verif'); await A.waitForTimeout(80);
  }
  if (it.type === 'nombre') await A.fill('#layer .pa-q-input', String(it.answer).replace('.', ','));
  else if (it.type === 'texte') await A.fill('#layer .pa-q-input', [].concat(it.accept)[0]);
  else if (it.type === 'choix') await clic(`#layer .pa-q-choices [data-c="${it.answer}"]`);
  else if (it.type === 'ordre') {
    // chaque étape remonte à sa place, une touche « Monter » à la fois
    for (let k = 0; k < it.n; k++) {
      for (let guard = 0; guard < it.n; guard++) {
        const pos = await ev((kk) => window.__dbg.COURS.essai().ordre.indexOf(kk), k);
        if (pos <= k) break;
        await clic(`#layer .pa-ordre li:nth-child(${pos + 1}) button[data-d="-1"]`); await A.waitForTimeout(30);
      }
    }
  }
  await clic('#layer .pa-verif'); await A.waitForTimeout(80);
  return it;
};
const suivante = async () => { await clic('#layer .pa-next'); await A.waitForTimeout(100); };
const faireExo = async (modes = []) => {
  await clic('#layer .pa-exo-go'); await A.waitForTimeout(150);
  const n = await ev(() => window.__dbg.COURS.essai().items.length);
  for (let k = 0; k < n; k++) { await repondre(modes[k] || 'juste'); await suivante(); }
  return ev(() => ({ score: window.__dbg.COURS.essai().score, fini: window.__dbg.COURS.essai().fini }));
};

await ev((id) => window.__dbg.openCours(id), premiere); await A.waitForTimeout(500);
T.check('une leçon ouverte : les trois étapes Apprendre, Quiz, Exercice ; le quiz puis l\'exercice à la fin', await ev(() => document.querySelectorAll('#layer .pa-steps li').length === 3 && !!document.querySelector('#layer .co-quiz + .co-exoauto')));
await quizJuste(premiere);
T.check('quiz réussi : l\'étape Quiz est cochée, il reste l\'exercice', await ev(() => document.querySelector('#layer .pa-steps li:nth-child(2)')?.classList.contains('ok') && !document.querySelector('#layer .pa-steps li:nth-child(3)')?.classList.contains('ok') && /Reste l'exercice/.test(document.querySelector('#layer .co-quiz .co-score')?.textContent || '')));
// l'exercice : la première question avec une aide, la deuxième avec une erreur, la troisième par la solution
await clic('#layer .pa-exo-go'); await A.waitForTimeout(150);
T.check('exercice : une question à la fois, avancement, aides et solution proposées', await ev(() => document.querySelectorAll('#layer .pa-q-card').length === 1 && !!document.querySelector('#layer .pa-q-bar') && !!document.querySelector('#layer .pa-aide-btn') && !!document.querySelector('#layer .pa-sol-btn')));
await shot('04-exercice', '#layer .co-exoauto');
await repondre('aide');
T.check('une aide ouverte (indice), la question réussie à 75 %', await ev(() => !!document.querySelector('#layer .pa-aide') && /75 %/.test(document.querySelector('#layer .pa-retour.juste')?.textContent || '')));
await suivante();
const it2 = await ev(() => { const R = window.__dbg.COURS.essai(); return R.items[R.k].type; });
if (it2 === 'ordre') await repondre('juste');
else {
  await repondre('faux');
  T.check('une réponse fausse puis juste : l\'erreur est comptée une fois', await ev(() => { const R = window.__dbg.COURS.essai(); return R.etats[R.k].erreurs === 1 && R.etats[R.k].ok; }));
}
await suivante();
await repondre('solution');
T.check('la solution demandée : la réponse et l\'explication, la question ne rapporte rien', await ev(() => !!document.querySelector('#layer .pa-retour.sol') && window.__dbg.COURS.essai().etats[window.__dbg.COURS.essai().k].solution));
await shot('05-solution', '#layer .co-exoauto');
await suivante();
for (let g = 0; g < 4 && !(await ev(() => window.__dbg.COURS.essai().fini)); g++) { await repondre('juste'); await suivante(); }
const b1 = await ev(() => ({ fini: window.__dbg.COURS.essai().fini, score: window.__dbg.COURS.essai().score, bilan: !!document.querySelector('#layer .pa-bilan'), detail: document.querySelectorAll('#layer .pa-detail li').length }));
T.check('le bilan : score sur 100 (moins que 100 avec aide, erreur, solution), détail par question', b1.fini && b1.bilan && b1.score < 100 && b1.score > 0 && b1.detail >= 3, JSON.stringify(b1));
await shot('06-bilan', '#layer .co-exoauto');
// refaire sans aide : 100 sur 100, la leçon est terminée avec trois étoiles
await clic('#layer .pa-bilan .btn'); await A.waitForTimeout(150);
const n1 = await ev(() => window.__dbg.COURS.essai().items.length);
for (let k = 0; k < n1; k++) { await repondre('juste'); await suivante(); }
const e1 = await ev((id) => ({ etat: window.__dbg.COURS.PARCOURS.etatLecon(id, window.__dbg.PROG), steps: document.querySelectorAll('#layer .pa-steps li.ok').length, nav: !!document.querySelector(`#layer .co-les.done[data-lesson="${id}"]`) }), premiere);
T.check('refait sans aide : 100 / 100, leçon terminée, trois étoiles, cochée au sommaire', e1.etat.exo === 100 && e1.etat.terminee && e1.etat.etoiles === 3 && e1.steps === 3 && e1.nav, JSON.stringify(e1));
T.check('XP : exercice réussi et trois étoiles', await ev((id) => !!window.__dbg.PROG.game.keys['exo:' + id] && !!window.__dbg.PROG.game.keys['exo3:' + id], premiere));
await shot('07-lecon-terminee');

// ---------------- le niveau Débutant du signal validé : l'Intermédiaire s'ouvre ----------------
const deb = await ev(() => window.__dbg.COURS.PARCOURS.PARCOURS.signal.debutant);
for (const id of deb.slice(1)) {
  await ev((x) => window.__dbg.openCours(x), id); await A.waitForTimeout(400);
  await quizJuste(id);
  await faireExo();
}
await ev(() => window.__dbg.emit('cours', { chapter: 'signal' })); await A.waitForTimeout(400);
const sig = await ev(() => [...document.querySelectorAll('#layer .pa-niv')].map((s) => ({ n: /** @type {HTMLElement} */ (s).dataset.niveau, c: s.className })));
T.check('Débutant validé : le niveau Intermédiaire du signal est ouvert, l\'Avancé encore fermé', /valide/.test(sig[0].c) && /ouvert/.test(sig[1].c) && /ferme/.test(sig[2].c), JSON.stringify(sig));
T.check('XP du niveau validé ; le badge « Premier niveau »', await ev(() => !!window.__dbg.PROG.game.keys['niveau:signal:debutant'] && !!window.__dbg.PROG.game.badges['premier-niveau']));
await shot('08-signal-debutant-valide');
await ev(() => window.__dbg.emit('cours', { home: true })); await A.waitForTimeout(400);
const s2 = await ev(() => ({ hero: document.querySelector('#layer .pa-hero small')?.textContent || '' }));
T.check('les fondamentaux d\'abord : la suite conseillée est le Débutant du SDI, pas l\'Intermédiaire du signal', /Débutant/.test(s2.hero) && /SDI/.test(s2.hero), JSON.stringify(s2));

// ---------------- le test de niveau : raté, puis réussi ----------------
const passerTest = async (juste) => {
  const draw = await ev(() => [...document.querySelectorAll('#layer .pa-testpage .co-q')].length);
  for (let qi = 0; qi < draw; qi++) {
    const c = await ev(([q, j]) => { const btns = [...document.querySelectorAll(`#layer .pa-testpage .co-q[data-q="${q}"] .co-choice-btn`)]; const src = document.querySelector(`#layer .pa-testpage .co-q[data-q="${q}"] .pa-src`)?.textContent || ''; const L = window.__dbg.COURS.allLessons().find((x) => x.lesson.title === src).lesson; const txt = document.querySelector(`#layer .pa-testpage .co-q[data-q="${q}"] p`)?.textContent.replace(/^\d+\. /, '') || ''; const Q = L.quiz.find((x) => x.q === txt); const want = j ? Q.answer : (Q.answer + 1) % 3; return btns.findIndex((b) => Number(/** @type {HTMLElement} */ (b).dataset.c) === want); }, [qi, juste]);
    await ev(([q, k]) => /** @type {HTMLElement} */ (document.querySelectorAll(`#layer .pa-testpage .co-q[data-q="${q}"] .co-choice-btn`)[k]).click(), [qi, c]);
  }
  await clic('#layer .pa-testpage .co-valider'); await A.waitForTimeout(200);
  return draw;
};
await ev(() => window.__dbg.emit('cours', { chapter: 'sdi' })); await A.waitForTimeout(400);
await clic('#layer .pa-test-btn[data-niveau="intermediaire"]'); await A.waitForTimeout(300);
const nq = await ev(() => document.querySelectorAll('#layer .pa-testpage .co-q').length);
T.check('test de niveau du SDI (Intermédiaire) : six à douze questions des leçons sautées', nq >= 4 && nq <= 12, String(nq));
await shot('09-test');
await passerTest(false);
T.check('test raté : le niveau reste fermé', await ev(() => !window.__dbg.COURS.PARCOURS.etatNiveaux('sdi', window.__dbg.PROG)[1].ouvert && /il en fallait/.test(document.querySelector('#layer .pa-test-res')?.textContent || '')));
await ev(() => /** @type {HTMLElement} */ ([...document.querySelectorAll('#layer .pa-test-res .btn')].find((b) => /Refaire le test/.test(b.textContent || ''))).click()); await A.waitForTimeout(300);
await passerTest(true);
T.check('test réussi : le niveau Intermédiaire du SDI s\'ouvre, le Débutant compte comme validé par le test', await ev(() => { const N = window.__dbg.COURS.PARCOURS.etatNiveaux('sdi', window.__dbg.PROG); return N[0].parTest && N[1].ouvert && !N[2].ouvert && !!window.__dbg.PROG.game.keys['test:sdi:intermediaire']; }));
await clic('#layer .pa-test-res .btn.primary'); await A.waitForTimeout(300);
T.check('« Voir le parcours » : le chemin du SDI, Intermédiaire ouvert', await ev(() => document.querySelector('#layer .pa-niv[data-niveau="intermediaire"]')?.classList.contains('ouvert')));
await shot('10-sdi-apres-test');

// ---------------- la progression enregistrée, puis le profil Formateur ----------------
T.check('progression : l\'exercice et le test enregistrés (PROG v4)', await ev((id) => window.__dbg.PROG.v >= 4 && window.__dbg.PROG.cours[id].exo.best === 100 && window.__dbg.PROG.niveaux.sdi.intermediaire.score > 0, premiere));
await ev(() => window.__dbg.setRole('formateur')); await A.waitForTimeout(300);
await ev(() => window.__dbg.emit('cours', { chapter: 'reseau' })); await A.waitForTimeout(400);
T.check('profil Formateur : tous les niveaux ouverts, sans cadenas', await ev(() => [...document.querySelectorAll('#layer .pa-niv')].every((s) => !s.classList.contains('ferme')) && !document.querySelector('#layer .co-les.lock') && !!document.querySelector('#layer .pa-libre')));
await ev(() => window.__dbg.openCours('reseau-nmos')); await A.waitForTimeout(400);
T.check('au profil Formateur, une leçon Expert s\'ouvre en entier', await ev(() => !!document.querySelector('#layer .co-quiz') && !!document.querySelector('#layer .co-exoauto')));
await ev(() => window.__dbg.setRole('etudiant')); await A.waitForTimeout(300);
T.check('retour au profil Étudiant : la leçon Expert se referme', await ev(() => !!document.querySelector('#layer .pa-lock')));

// ---------------- à 390 px ----------------
await A.setViewportSize({ width: 390, height: 844 }); await A.waitForTimeout(300);
await ev(() => window.__dbg.emit('cours', { home: true })); await A.waitForTimeout(400);
T.check('à 390 px : pas de défilement horizontal', await ev(() => { const s = document.querySelector('#layer .ly-scroll') || document.documentElement; return s.scrollWidth <= s.clientWidth + 1; }));
await A.screenshot({ path: `${OUT}/11-mobile-parcours.png` });
await ev(() => window.__dbg.openCours(window.__dbg.COURS.PARCOURS.PARCOURS.sdi.debutant[0])); await A.waitForTimeout(400);
await clic('#layer .pa-exo-go'); await A.waitForTimeout(200);
const ex = await A.$('#layer .co-exoauto'); if (ex) { await ex.scrollIntoViewIfNeeded(); await A.screenshot({ path: `${OUT}/12-mobile-exercice.png` }); }
await T.finish();
