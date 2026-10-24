// Le son selon l'endroit (v19.4.1) : la foule reste dans le stade (lointaine devant le car, où l'on
// commence), l'écoute de la console au poste son, presque rien ailleurs dans le car, silence à l'accueil ;
// aucune voix de synthèse pour les commentaires (fil écrit au poste son) ;
// le volume du son dans les Réglages. Les niveaux sont mesurés à la sortie (analyseur AU.anOut).
// node tests/e2e/ecoute.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('ecoute');
const T = reporter();
const browser = await launch();
// la synthèse vocale est espionnée : les commentaires ne doivent plus rien lui demander
const A = await openPage(browser, { errors: T.errors, before: (p) => p.addInitScript(() => { window.__spoken = 0; try { const ss = window.speechSynthesis; if (ss) ss.speak = () => { window.__spoken++; }; } catch (e) { /* indisponible */ } }) });
const ev = (f, a) => A.evaluate(f, a);

// RMS (dBFS) de ce que le joueur entend, sur une seconde
const rms = () => ev(async () => {
  const an = window.__dbg.AU.anOut; const buf = new Float32Array(an.fftSize); let s = 0, k = 0;
  for (let j = 0; j < 20; j++) { an.getFloatTimeDomainData(buf); for (const v of buf) s += v * v; k += buf.length; await new Promise((r) => setTimeout(r, 50)); }
  return Math.round(10 * Math.log10(s / k + 1e-12) * 10) / 10;
});
// attend quelques images (rendu logiciel lent) puis la fin du fondu (≈ 1 s)
const settle = async () => { const f0 = await ev(() => window.__dbg.S.frame); await A.waitForFunction((f) => window.__dbg.S.frame > f + 3, f0, { timeout: 120000 }); await A.waitForTimeout(1500); };
const at = (x, y, z) => ev(([a, b, c]) => { const D = window.__dbg; D.S.inTruck = false; D.PL.pos.set(a, b, c); }, [x, y, z]);
const post = (id) => ev((i) => { const D = window.__dbg; D.goToStation(D.T.stations.find((s) => s.station === i), true); }, id);

await ev(() => window.__dbg.start('standard', 'jour', 'basse', true));
await settle();
const L = {};
L.depart = await rms();
await at(0, 0, 0); await settle(); L.pelouse = await rms();
await at(0, 12, -60); await settle(); L.gradins = await rms();
await at(-80, 0, -200); await settle(); L.parking = await rms();
await post('son'); await settle(); L.posteSon = await rms();
await ev(() => window.__dbg.closeStation()); await settle(); L.cabine = await rms();
await post('vision'); await settle(); L.vision = await rms();
await ev(() => window.__dbg.closeStation());
T.log('niveaux entendus (dBFS RMS)', JSON.stringify(L));
T.check('sur la pelouse et dans les gradins : la foule, à un niveau de fond (−45 à −30 dBFS)', L.pelouse > -45 && L.pelouse < -30 && L.gradins > -45 && L.gradins < -30, `${L.pelouse} ${L.gradins}`);
T.check('au départ, devant le car : une rumeur lointaine, au moins 10 dB sous la pelouse', L.depart < L.pelouse - 10, `${L.depart}`);
T.check('loin du stade : encore moins', L.parking < L.depart - 5, `${L.parking}`);
T.check('au poste son : l\'écoute de la console (−45 à −30 dBFS)', L.posteSon > -45 && L.posteSon < -30, `${L.posteSon}`);
T.check('cabine son, debout : plus bas qu\'au poste', L.cabine < L.posteSon - 6, `${L.cabine}`);
T.check('à un autre poste du car (vision) : presque rien', L.vision < -60, `${L.vision}`);
const pgm = await ev(() => Math.round(window.__dbg.AU.lufs.s));
T.check('la console ne change pas : le PGM reste mesuré vers −23 LUFS', pgm > -32 && pgm < -15, String(pgm));

// commentaires : le fil s'écrit, rien n'est dit
await A.waitForFunction(() => window.__dbg.CMT.log.length > 0, null, { timeout: 120000 }).catch(() => {});
const cm = await ev(() => ({ n: window.__dbg.CMT.log.length, spoken: window.__spoken }));
T.check('commentaires : le fil s\'écrit, aucune voix de synthèse', cm.n > 0 && cm.spoken === 0, JSON.stringify(cm));
await post('son');
await A.locator('.vx-tab', { hasText: 'Commentaires' }).click();
T.check('poste son, onglet Commentaires : le fil écrit et la mention « sans voix »', await until(A, () => document.querySelectorAll('.vx-feed .vx-line').length > 0 && /sans voix/.test(document.querySelector('#station')?.textContent || '')));
await A.screenshot({ path: `${OUT}/01-poste-son-commentaires.png` });
await ev(() => window.__dbg.closeStation());

// écran d'accueil (le retour à l'accueil recharge la page : on se place directement dans son mode)
await ev(() => { window.__dbg.S.mode = 'start'; }); await settle();
const acc = await rms();
await ev(() => { window.__dbg.S.mode = 'fps'; });
T.check('écran d\'accueil : silence', acc < -90, String(acc));

// Réglages : le volume du son
await ev(() => window.__dbg.emit('settings')); await A.waitForTimeout(400);
const vol = A.locator('input[aria-label="Volume du son"]');
T.check('Réglages : le curseur « Volume du son », l\'option « Activé »', await vol.count() === 1 && await ev(() => [...document.querySelectorAll('.seg button')].some((b) => b.textContent === 'Activé')));
await vol.fill('0.3');
T.check('le volume est retenu (carregie.volume)', await ev(() => localStorage.getItem('carregie.volume')) === '0.3');
await A.screenshot({ path: `${OUT}/02-reglages-volume.png` });
await T.finish();
