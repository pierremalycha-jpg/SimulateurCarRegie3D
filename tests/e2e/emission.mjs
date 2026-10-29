// L'émission en direct (src/emission/, v19.19) : Jouer → Car régie → Car pré-installé → « Émission en direct ».
// Le match attend à l'échauffement (horloge arrêtée) ; le compte à rebours et « Antenne maintenant » ; à
// l'IPDirector, le panneau des médias : le générique chargé par l'équipe virtuelle, lancé par le stagiaire (le top),
// pris à l'antenne par le truquiste virtuel ; la présentation, la 1re période (score à l'antenne), la mi-temps et
// la page de pub (chargée et lancée par le stagiaire), la 2e période, le générique de fin, le compte rendu noté
// (les trois médias lancés soi-même : il compte dans le livret). Puis l'émission rejouée, assis au mélangeur :
// le réalisateur virtuel donne ses ordres par l'intercom et l'IPDirector virtuel lance le générique.
// Les séquences sont raccourcies (sauter) : le rendu logiciel avance de quelques images par seconde.
// node tests/e2e/emission.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('emission');
const T = reporter();
const browser = await launch();
const A = await openPage(browser, { errors: T.errors });
const ev = (f, a) => A.evaluate(f, a);
const shot = async (n) => { await A.waitForTimeout(500); await A.screenshot({ path: `${OUT}/${n}.png` }); };
const E = () => ev(() => { const d = window.__dbg.emission(); return { seg: d.seg, lance: d.EMI.C.lance, fini: d.EMI.C.fini, periode: window.__dbg.M.periode, state: window.__dbg.M.state, clock: window.__dbg.M.clock, media: window.__dbg.EVS.ch[1].media, pgm: window.__dbg.ROUTER.map['ME' + window.__dbg.MIX.pgm] }; });
const segIs = (id, ms = 90000) => until(A, (x) => window.__dbg.emission().seg === x, id, ms);
const sauter = () => ev(() => window.__dbg.emission().sauter());

// ---------------- Jouer : l'émission en direct, choix par défaut du car pré-installé ----------------
await A.click('.jo-mode[data-mode="installe"]'); await A.waitForTimeout(300);
T.check('car pré-installé : « Émission en direct » choisie par défaut, « Match en continu » à côté', await ev(() => {
  const b = document.querySelector('.jo-emission'); return !!b && !b.hidden && b.querySelector('[data-emission="oui"]').getAttribute('aria-pressed') === 'true' && !!b.querySelector('[data-emission="non"]');
}));
await shot('01-jouer');
await ev(() => window.__dbg.emission().setDurees({ compte: 40, presentation: 6, mitemps: 6, reprise: 6, finmatch: 6, periode: 30 }));
await A.click('#st-antenne');
T.check('l\'émission démarre avec le car', await until(A, () => window.__dbg.S.mode !== 'start' && window.__dbg.emission().EMI.on, null, 120000));
await A.waitForTimeout(1500);
let s = await E();
T.check('avant l\'antenne : le match à l\'échauffement, horloge arrêtée', s.seg === 'attente' && s.periode === 'avant' && s.state === 'pregame' && s.clock === 0, JSON.stringify(s));
T.check('le générique est déjà chargé (cue) sur PGM2 par l\'IPDirector virtuel', !!s.media && s.media.id === 'gen-debut' && !s.media.playing && s.media.by === 'ia');
T.check('l\'horloge du direct : le compte à rebours, « Antenne maintenant », « Suspendre »', await ev(() => { const d = document.getElementById('direct'); return !!d && !d.hidden && /Avant l'antenne/i.test(d.textContent) && !!d.querySelector('[data-k="direct:antenne"]') && !!d.querySelector('[data-k="direct:pause"]'); }));
T.check('le suivi sur le côté : le conducteur de l\'émission', await until(A, () => { const q = document.getElementById('quest'); return !!q && !q.hidden && /Émission en direct/.test(q.textContent) && /Avant l'antenne/.test(q.textContent) && q.querySelectorAll('.q-task').length >= 8 && !!q.querySelector('.q-task.now'); }, null, 10000));
await shot('02-avant-antenne');
// le décompte se suspend
await A.click('#direct [data-k="direct:pause"]'); await A.waitForTimeout(300);
const c0 = await ev(() => window.__dbg.emission().EMI.C.compte); await A.waitForTimeout(2500);
T.check('décompte suspendu : il ne bouge plus', await ev((c) => window.__dbg.emission().EMI.C.suspendu && window.__dbg.emission().EMI.C.compte === c, c0));
await A.click('#direct [data-k="direct:pause"]');

// ---------------- l'IPDirector : les médias de l'émission ----------------
await ev(() => window.__dbg.goToStation(window.__dbg.T.stations.find((x) => x.station === 'ipdirector')));
await A.waitForSelector('.em-play');
T.check('IPDirector : le panneau des médias (trois médias, le générique au conducteur) et le conducteur', await ev(() => document.querySelectorAll('.em-media').length === 3 && !document.querySelector('.em-media[data-media="gen-debut"] .em-next').hidden && !!document.querySelector('.em-conducteur li.en-cours[data-seg="attente"]')));
T.check('assis au poste : l\'horloge du direct dans l\'en-tête', await until(A, () => !!document.querySelector('#station .st-head #direct.in-head'), null, 20000));
await shot('03-ipdirector');
// le top donné depuis l'IPDirector : LANCER pendant le décompte prend l'antenne sur le générique
await A.click('.em-lancer');
T.check('LANCER pendant le décompte : c\'est le top, la séquence du générique', await segIs('generique', 60000));
T.check('le générique part, lancé par toi, à l\'heure', await until(A, () => { const d = window.__dbg.emission().EMI; return d.C.lance.generique != null && Math.abs(d.C.lance.generique) < 1 && window.__dbg.EVS.ch[1].media.playing && window.__dbg.EVS.ch[1].media.by === 'vous'; }, null, 30000));
T.check('le truquiste virtuel prend l\'EVS B à l\'antenne', await until(A, () => window.__dbg.ROUTER.map['ME' + window.__dbg.MIX.pgm] === 'EVSB', null, 30000));
// une image du générique : l'affiche du match
await ev(() => { window.__dbg.EVS.ch[1].media.pos = 15; });
await A.waitForTimeout(1500);
await shot('04-generique-ipd');
await ev(() => window.__dbg.closeStation());
await A.waitForTimeout(400);
await ev(() => window.__dbg.openStation('realisateur'));
await A.waitForTimeout(1500);
await shot('05-generique-multiview');
await ev(() => window.__dbg.closeStation());
await sauter();
T.check('fin du générique : enchaîné sur le stade, la présentation', await segIs('presentation', 90000) && await until(A, () => /^CAM/.test(window.__dbg.ROUTER.map['ME' + window.__dbg.MIX.pgm]), null, 30000));

// ---------------- la 1re période, la mi-temps ----------------
await sauter();
T.check('1re période : coup d\'envoi, l\'horloge court', await segIs('mt1') && await until(A, () => window.__dbg.M.periode === 1 && window.__dbg.M.clock > 0.5, null, 60000));
T.check('le score à l\'antenne pendant le jeu (DSK 1)', await until(A, () => window.__dbg.MIX.dsk1.on, null, 30000));
await shot('06-periode');
await sauter();
T.check('mi-temps au bout de la période : sifflet, les joueurs quittent le jeu', await segIs('mitemps') && await ev(() => window.__dbg.M.periode === 'mi-temps' && window.__dbg.M.state === 'break'));

// ---------------- la page de pub, chargée et lancée par le stagiaire ----------------
await ev(() => window.__dbg.goToStation(window.__dbg.T.stations.find((x) => x.station === 'ipdirector')));
await A.waitForSelector('.em-play');
await A.click('.em-media[data-media="pub"] [data-media="pub"]');
T.check('la pub chargée sur PGM2 (cue)', await until(A, () => { const m = window.__dbg.EVS.ch[1].media; return m && m.id === 'pub' && !m.playing; }, null, 15000));
await sauter();
T.check('top pub', await segIs('pub'));
await A.click('.em-lancer');
T.check('la pub part, et passe à l\'antenne (score retiré)', await until(A, () => window.__dbg.EVS.ch[1].media.playing && window.__dbg.emission().EMI.C.lance.pub != null && window.__dbg.ROUTER.map['ME' + window.__dbg.MIX.pgm] === 'EVSB' && !window.__dbg.MIX.dsk1.on, null, 30000));
await ev(() => { window.__dbg.EVS.ch[1].media.pos = 1.4; });
await A.waitForTimeout(1200);
await shot('07-pub-jingle');
await ev(() => { window.__dbg.EVS.ch[1].media.pos = 16; });
await A.waitForTimeout(1200);
await shot('08-pub-spot');
await ev(() => window.__dbg.closeStation());
await sauter();
T.check('fin de la pub : retour au stade, puis la 2e période (les équipes ont changé de côté)', await segIs('reprise', 90000) && await (async () => { await sauter(); return segIs('mt2'); })() && await until(A, () => window.__dbg.M.periode === 2, null, 30000));
await sauter();
T.check('coup de sifflet final', await segIs('finmatch') && await ev(() => window.__dbg.M.periode === 'fin'));

// ---------------- le générique de fin ----------------
await ev(() => window.__dbg.goToStation(window.__dbg.T.stations.find((x) => x.station === 'ipdirector')));
await A.waitForSelector('.em-play');
await A.click('.em-media[data-media="gen-fin"] [data-media="gen-fin"]');
await sauter();
T.check('top générique de fin', await segIs('generiqueFin'));
await A.click('.em-lancer');
T.check('le générique de fin part', await until(A, () => window.__dbg.EVS.ch[1].media && window.__dbg.EVS.ch[1].media.id === 'gen-fin' && window.__dbg.EVS.ch[1].media.playing && window.__dbg.emission().EMI.C.lance.generiqueFin != null, null, 30000));
await ev(() => { window.__dbg.EVS.ch[1].media.pos = 14; });
await A.waitForTimeout(1200);
await shot('09-generique-fin');
await sauter();
T.check('fin d\'antenne : fondu au noir, compte rendu', await until(A, () => window.__dbg.emission().EMI.C.fini && window.__dbg.MIX.ftb.on, null, 90000) && await until(A, () => /Compte rendu · émission en direct/.test(document.getElementById('modal').textContent), null, 60000));
const R = await ev(() => window.__dbg.emission().EMI.rapport);
T.check('le compte rendu : les trois médias lancés par toi, au top ; un score sur 100', R && R.parVous === 3 && [0, 2, 4].every((k) => R.lignes[k].pts === 15) && R.score >= 0 && R.score <= 100 && R.lignes.length === 9, R && `${R.score}/100 · ${R.lignes.map((l) => l.pts + '/' + l.max).join(' ')}`);
T.check('l\'émission est enregistrée dans la progression (seule) et compte dans le livret', await ev(() => { const e = (window.__dbg.PROG.emissions || []).slice(-1)[0]; return !!e && e.seul === true && e.parVous === 3; }));
T.check('le compte rendu : l\'IPDirector tenu par toi', await ev(() => /IPDirector, médias\s*:\s*Toi/.test(document.querySelector('.em-qui').textContent)));
await shot('10-compte-rendu');

// ---------------- rejouer, assis au mélangeur : l'équipe virtuelle tient l'IPDirector ----------------
await A.click('#modal [data-k="emission:rejouer"]');
T.check('rejouer : un nouveau conducteur, le match de nouveau à l\'échauffement', await until(A, () => window.__dbg.emission().seg === 'attente' && window.__dbg.M.periode === 'avant', null, 15000));
await ev(() => window.__dbg.goToStation(window.__dbg.T.stations.find((x) => x.station === 'melangeur')));
await A.waitForTimeout(1500);
await A.click('#direct [data-k="direct:antenne"]');
T.check('au mélangeur : l\'IPDirector virtuel lance le générique au top', await segIs('generique') && await until(A, () => { const m = window.__dbg.EVS.ch[1].media; return m && m.playing && m.by === 'ia'; }, null, 30000));
T.check('le réalisateur virtuel donne le top dans l\'intercom', await until(A, () => /Top générique/.test(document.getElementById('intercom').textContent), null, 20000));
await shot('11-melangeur-ordres');
await ev(() => window.__dbg.closeStation());
await ev(() => window.__dbg.emission().quitter());
T.check('quitter l\'émission : le match repart en continu', await until(A, () => !window.__dbg.emission().EMI.on && window.__dbg.M.periode === 'libre', null, 10000) && await ev(() => document.getElementById('direct').hidden));

await T.finish();
