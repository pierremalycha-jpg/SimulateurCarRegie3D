// La page de lecture du Cours (v19.26) : une leçon se lit comme une page de présentation qui se dévoile au
// défilement (en-tête avec l'essentiel, barre d'étapes collante, sections révélées l'une après l'autre : schéma
// légendé, manipulation, explication, car, mots de la leçon, référentiel compact, quiz, exercice), les leçons
// ajoutées au chapitre Le son (décibel, micros, couples stéréo, liaisons, dynamique, loudness, audio numérique)
// et la compression vidéo : chacune avec sa manipulation qui lit, son quiz et son exercice ; les fiches « ? » du
// son dans le lexique ; le sommaire en parties ; à 390 px, pas de défilement horizontal. Captures à relire.
// node tests/e2e/lecture.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('cours-lecture');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { title: true, errors: T.errors, viewport: { width: 1400, height: 900 } });
await until(A, () => !!document.querySelector('#title.ready'), null, 180000);
const ev = (f, a) => A.evaluate(f, a);
const shot = async (name, sel = '#layer .co-page') => {
  const vp = A.viewportSize(); const h = await ev((s) => { const e = document.querySelector(s); return e ? Math.ceil(e.getBoundingClientRect().height) + 160 : 0; }, sel);
  if (h > vp.height) { await A.setViewportSize({ width: vp.width, height: Math.min(h, 7000) }); await A.waitForTimeout(250); }
  const p = await A.$(sel); if (p) await p.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
  if (h > vp.height) await A.setViewportSize(vp);
};
const scrollTo = async (y) => { await ev((v) => { const s = document.querySelector('#layer .ly-scroll'); if (s) s.scrollTop = v; }, y); await A.waitForTimeout(700); };

// ---------------- la page qui se dévoile ----------------
await A.click('#ti-cours'); await A.waitForTimeout(600);
await ev(() => window.__dbg.openCours('son-tranche')); await A.waitForTimeout(800);
const haut = await ev(() => {
  const page = document.querySelector('#layer .co-page');
  const sc = document.querySelector('#layer .ly-scroll');
  const bar = document.querySelector('#layer .co-steps-bar');
  const order = [...page.children].map((c) => c.className.split(' ')[0]);
  return {
    lecon: page.classList.contains('co-lecon'), hero: !!page.querySelector('.co-hero h2') && page.querySelectorAll('.co-hero .co-ess li').length === 3,
    reveal: page.querySelectorAll('.co-reveal').length, inn: page.querySelectorAll('.co-reveal.in').length,
    sticky: bar ? getComputedStyle(bar).position : '', barTop: bar ? Math.round(bar.getBoundingClientRect().top - sc.getBoundingClientRect().top) : -1,
    cap: (page.querySelector('.co-figbox .co-figcap')?.textContent || '').length, order,
    direct: document.documentElement.classList.contains('reveal-direct'),
  };
});
T.check('leçon : en-tête avec le titre et l\'essentiel en trois phrases, sections marquées à révéler, celles de l\'écran déjà visibles', haut.lecon && haut.hero && haut.reveal >= 8 && haut.inn >= 2 && haut.inn < haut.reveal, JSON.stringify(haut));
T.check('la barre des étapes est collante, sous l\'en-tête ; le schéma a sa légende', haut.sticky === 'sticky' && haut.cap > 40, JSON.stringify({ sticky: haut.sticky, cap: haut.cap }));
T.check('l\'ordre de lecture : en-tête, étapes, schéma, manipulation, explication, car, mots, référentiel, quiz, exercice, pratiques', JSON.stringify(haut.order) === JSON.stringify(['co-hero', 'co-steps-bar', 'co-figbox', 'co-demo', 'co-text', 'co-car', 'co-terms', 'co-ref', 'co-quiz', 'co-exoauto', 'co-exos', 'co-nextprev']), JSON.stringify(haut.order));
await A.screenshot({ path: `${OUT}/01-lecon-haut.png` });
// on descend : les sections arrivent une à une, la barre reste en haut
await scrollTo(1200);
const milieu = await ev(() => { const sc = document.querySelector('#layer .ly-scroll'); const bar = document.querySelector('#layer .co-steps-bar'); return { inn: document.querySelectorAll('#layer .co-reveal.in').length, barTop: Math.round(bar.getBoundingClientRect().top - sc.getBoundingClientRect().top), scrolled: sc.scrollTop > 1000 }; });
T.check('en descendant : d\'autres sections se dévoilent, la barre des étapes reste collée en haut', milieu.scrolled && milieu.inn > haut.inn && milieu.barTop <= 2, JSON.stringify(milieu));
await A.screenshot({ path: `${OUT}/02-lecon-milieu.png` });
await scrollTo(1e6);
const bas = await ev(() => ({ inn: document.querySelectorAll('#layer .co-reveal.in').length, tot: document.querySelectorAll('#layer .co-reveal').length, opaque: [...document.querySelectorAll('#layer .co-reveal')].every((e) => getComputedStyle(e).opacity === '1'), quizExo: !!document.querySelector('#layer .co-quiz + .co-exoauto') }));
T.check('tout en bas : toutes les sections sont révélées (celles qu\'on a sautées aussi) et pleinement opaques ; le quiz précède l\'exercice', bas.inn === bas.tot && bas.opaque && bas.quizExo, JSON.stringify(bas));
// le lien d'étape « Quiz » descend à la section, qui se révèle
await scrollTo(0);
await ev(() => /** @type {HTMLElement} */ (document.querySelector('#layer .pa-steps li:nth-child(2) a')).click());
T.check('le lien « Quiz » de la barre descend au quiz, révélé, et tout ce qui le précède avec lui', await until(A, () => { const q = document.querySelector('#layer .co-quiz'); const r = q.getBoundingClientRect(); const avant = [...document.querySelectorAll('#layer .co-reveal')]; return q.classList.contains('in') && r.top < innerHeight && r.bottom > 0 && avant.slice(0, avant.indexOf(q)).every((e) => e.classList.contains('in')); }, null, 8000));
// le référentiel est compact : les compétences en pastilles sur une ligne, les détails repliés
T.check('référentiel compact : compétences en pastilles, savoir-faire et savoirs repliés', await ev(() => { const r = document.querySelector('#layer .co-ref'); const comps = [...r.querySelectorAll('.co-ref-comp')]; const det = r.querySelector('.co-ref-det'); return comps.length >= 2 && Math.abs(comps[0].getBoundingClientRect().top - comps[1].getBoundingClientRect().top) < 4 && det && !det.open; }));
// le quiz redessiné reste visible (la classe de révélation suit)
await ev(() => { const q = document.querySelector('#layer .co-quiz .co-choice-btn'); if (q) /** @type {HTMLElement} */ (q).click(); }); await A.waitForTimeout(200);
T.check('après un clic dans le quiz (section redessinée), elle reste révélée', await ev(() => { const q = document.querySelector('#layer .co-quiz'); return q.classList.contains('co-reveal') && q.classList.contains('in') && getComputedStyle(q).opacity === '1'; }));
await shot('03-lecon-entiere');

// ---------------- le sommaire en parties, Mon parcours et le chapitre révélés ----------------
const som = await ev(() => { const det = [...document.querySelectorAll('#layer .co-chap')].find((d) => [...d.querySelectorAll('summary span')].some((sp) => sp.textContent === 'Le son')); return { parts: [...det.querySelectorAll('.co-part')].map((p) => p.textContent), lecons: det.querySelectorAll('.co-les[data-lesson]').length, niveaux: det.querySelectorAll('.co-niv').length }; });
T.check('sommaire du son : trois parties (Les bases, La console, Les départs), neuf leçons, trois niveaux', som.lecons === 9 && som.niveaux === 3 && som.parts.includes('Les bases') && som.parts.includes('La console') && som.parts.includes('Les départs'), JSON.stringify(som));
await ev(() => window.__dbg.emit('cours', { chapter: 'son' })); await A.waitForTimeout(700);
T.check('le chemin du chapitre : en-tête, rappel du référentiel sous l\'introduction, niveaux à révéler', await ev(() => !!document.querySelector('#layer .co-page.co-chemin-page .co-hero') && document.querySelector('#layer .lede')?.nextElementSibling?.classList.contains('co-ref-chap') && document.querySelectorAll('#layer .pa-niv.co-reveal').length === 3));
await shot('04-chapitre-son');
await ev(() => window.__dbg.emit('cours', { home: true })); await A.waitForTimeout(600);
T.check('Mon parcours : en-tête, sections révélées, dix catégories', await ev(() => !!document.querySelector('#layer .co-page.co-accueil .co-hero') && document.querySelectorAll('#layer .co-accueil .co-reveal').length >= 5 && document.querySelectorAll('#layer .pa-cat').length === 10));

// ---------------- les leçons ajoutées : manipulation qui lit, quiz, exercice, référentiel ----------------
await ev(() => window.__dbg.setRole('formateur')); await A.waitForTimeout(200);
const NOUVELLES = ['son-decibel', 'son-micros', 'son-stereo', 'son-liaisons', 'son-dynamique', 'son-loudness', 'son-numerique', 'signal-compression'];
for (const id of NOUVELLES) {
  await ev((l) => window.__dbg.openCours(l), id); await A.waitForTimeout(600);
  await scrollTo(1e6); await A.waitForTimeout(200);
  const st = await ev(() => ({
    h: document.querySelector('#layer .co-page h2')?.textContent || '', fig: !!document.querySelector('#layer .co-figbox svg'), dd: [...document.querySelectorAll('#layer .co-demo .co-read dd')].map((d) => d.textContent),
    verdict: !!document.querySelector('#layer .co-demo .co-verdict')?.textContent, q: document.querySelectorAll('#layer .co-q').length, exo: !!document.querySelector('#layer .co-exoauto .pa-exo-go'), ref: document.querySelectorAll('#layer .co-ref .co-ref-comp').length,
    chips: document.querySelectorAll('#layer .co-terms .co-chip .q').length, nul: /undefined|NaN|\bnull\b/.test(document.querySelector('#layer .co-page')?.textContent || ''),
  }));
  const ok = st.fig && st.dd.length >= 4 && st.dd.every((d) => d && d !== '—') && st.verdict && st.q === 3 && st.exo && st.ref >= 2 && st.chips >= 2 && !st.nul;
  T.check(`leçon ${id} : schéma, manipulation qui lit (${st.dd.length} valeurs), verdict, quiz, exercice, référentiel, fiches « ? », sans valeur manquante`, ok, JSON.stringify({ ...st, dd: st.dd.length }));
}
// la manipulation des couples stéréo calcule : en passant d'ORTF à AB 60 cm, l'angle d'enregistrement se resserre
await ev(() => window.__dbg.openCours('son-stereo')); await A.waitForTimeout(600);
const lire = () => ev(() => [...document.querySelectorAll('#layer .co-demo .co-read dd')].map((d) => d.textContent));
const ortf = await lire();
await ev(() => /** @type {HTMLElement} */ (document.querySelector('#layer .co-demo .co-seg button[data-v="ab60"]')).click()); await A.waitForTimeout(200);
const ab = await lire();
const angle = (s) => parseInt((s.match(/(\d+)°/) || [])[1] || '0', 10);
T.check('couples stéréo : l\'ORTF a des écarts de niveau et de temps, l\'AB 60 cm un écart de temps seul et un angle d\'enregistrement plus étroit', /dB/.test(ortf[0]) && /ms/.test(ortf[1]) && /deux omnis|aucun/.test(ab[0]) && angle(ab[3]) > 0 && angle(ab[3]) < angle(ortf[3]), JSON.stringify({ ortf: ortf.slice(0, 4), ab: ab.slice(0, 4) }));
await shot('05-lecon-stereo');
await ev(() => window.__dbg.openCours('son-loudness')); await A.waitForTimeout(600);
await shot('06-lecon-loudness', '#layer .co-demo');
// les fiches « ? » du son : la catégorie Son dans le lexique, une fiche ouverte depuis la leçon
await ev(() => window.__dbg.openCours('son-decibel')); await A.waitForTimeout(500);
await ev(() => /** @type {HTMLElement} */ (document.querySelector('#layer .co-terms .co-chip .q[data-term="decibel"]')).click()); await A.waitForTimeout(500);
T.check('la fiche « Décibel » s\'ouvre depuis la leçon', await until(A, () => { const p = document.getElementById('termpop'); return !!p && !p.hidden && /Décibel/.test(p.textContent || ''); }, null, 5000));
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
T.check('le registre des fiches : les familles Son et Signal vidéo, 16 fiches de plus', await ev(() => { const T = window.__dbg.COURS.allLessons().filter(({ lesson }) => lesson.id.startsWith('son-')).length; return T === 9; }));

// ---------------- à 390 px ----------------
await A.setViewportSize({ width: 390, height: 844 }); await A.waitForTimeout(300);
await ev(() => window.__dbg.openCours('son-stereo')); await A.waitForTimeout(600);
T.check('à 390 px : pas de défilement horizontal, la barre des étapes reste collante', await ev(() => { const s = document.querySelector('#layer .ly-scroll'); return s.scrollWidth <= s.clientWidth + 1 && getComputedStyle(document.querySelector('#layer .co-steps-bar')).position === 'sticky'; }));
await A.screenshot({ path: `${OUT}/07-mobile-haut.png` });
await scrollTo(1400);
await A.screenshot({ path: `${OUT}/08-mobile-milieu.png` });
await A.close();
await T.finish();
