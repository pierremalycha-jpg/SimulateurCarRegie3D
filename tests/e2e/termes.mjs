// Poste Réseau IP, boutons « ? » des termes techniques : fiche de la gigue depuis l'analyseur de flux
// (schéma compris), renvois « Voir aussi » et retour, Échap qui ferme la fiche sans quitter le poste,
// boutons dans les onglets Technique et Exploitation, lexique et recherche, « Ouvrir dans le Cours »,
// fiche en bas d'écran au téléphone.
// node tests/e2e/termes.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('termes');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { viewport: { width: 1440, height: 900 }, errors: T.errors });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); T.log('shot', n); };
const click = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(300); };
const pop = () => ev(() => { const p = document.querySelector('#termpop'); return p && !p.hidden ? { t: p.querySelector('h3').textContent, fig: !!p.querySelector('.tp-fig svg'), back: !!p.querySelector('.tp-back'), sheet: p.classList.contains('tp-sheet') } : null; });
const nq = (scope) => ev((s) => document.querySelectorAll(s + ' .q[data-term]').length, scope);

await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', true); });
T.check('partie lancée en car IP', await until(page, () => window.__dbg.S.mode === 'fps' && window.__dbg.S.ipMode && !!window.__dbg.FAB.res));
await ev(() => window.__dbg.openStation('reseau'));
T.check('poste Réseau IP ouvert', await until(page, () => document.querySelectorAll('#station .net-mode').length === 2, null, 20000));
T.check('bandeau d\'état et topologie : boutons « ? »', (await nq('#station .net-sum')) >= 4 && (await nq('#station .net-terms')) >= 8);

// ---- la gigue, dans l'analyseur de flux ----
await click('#station .tabs .tab[data-k="meas"]');
T.check('analyseur : un « ? » à côté de la gigue', await until(page, () => !!document.querySelector('#station th .q[data-term="gigue"]'), null, 10000));
// les mesures se rafraîchissent à chaque image (rendu logiciel lent) : leurs « ? » doivent rester en place
T.check('les mesures en direct ont leurs « ? » (fusion 2022-7)', await until(page, () => !!document.querySelector('#station dt .q[data-term="ecart"]') && document.querySelectorAll('#station dt .q[data-term="pertes"]').length >= 2, null, 20000));
const btn = await page.$('#station dt .q[data-term="ecart"]');
await page.waitForTimeout(2500);
T.check('… et ce sont toujours les mêmes boutons quelques images plus tard', await btn.evaluate((b) => b.isConnected));
await click('#station th .q[data-term="gigue"]');
let p = await pop();
T.check('fiche « Gigue » ouverte, avec son schéma', p && p.t === 'Gigue' && p.fig, JSON.stringify(p));
T.check('la fiche est à côté du bouton', await ev(() => { const a = document.querySelector('#station th .q[data-term="gigue"]').getBoundingClientRect(); const b = document.querySelector('#termpop').getBoundingClientRect(); return b.left >= a.right || b.right <= a.left; }));
await shot('01-gigue');
await click('#termpop .tp-chip[data-see="iat"]');
p = await pop();
T.check('« Voir aussi » : la fiche IAT, avec retour', p && p.t === 'IAT' && p.back, JSON.stringify(p));
await click('#termpop .tp-back');
T.check('retour à la gigue', (await pop())?.t === 'Gigue');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
T.check('Échap ferme la fiche, le poste reste ouvert', !(await pop()) && (await ev(() => window.__dbg.S.mode)) === 'station');
T.check('le focus revient au bouton', await ev(() => document.activeElement && document.activeElement.dataset.term === 'gigue'));
await click('#station th .q[data-term="cmax"]');
await page.mouse.click(1300, 120); await page.waitForTimeout(300);
T.check('un clic à côté ferme la fiche', !(await pop()));

// ---- autres onglets Technique ----
for (const [k, sel, id] of [['ptp', '#station .q', 'bmca'], ['addr', '#station .q', 'sous-reseau'], ['flows', '#station .q', 'is-05']]) {
  await click(`#station .tabs .tab[data-k="${k}"]`);
  const ids = await ev((s) => [...document.querySelectorAll(s)].map((b) => b.dataset.term), sel);
  T.check(`onglet ${k} : boutons « ? »`, ids.length >= 5 && (id === 'bmca' ? ids.includes('priority') && ids.includes('clockclass') : ids.includes(id)), ids.slice(0, 12).join(','));
}
await click('#station .tabs .tab[data-k="switch"]');
T.check('commutateur : vitesse, FEC, MTU', await ev(() => ['vitesse', 'fec', 'mtu'].every((k) => document.querySelector(`#station .q[data-term="${k}"]`))));

// ---- Exploitation ----
await click('#station .net-mode[data-mode="ops"]');
T.check('Exploitation, connexions : groupe, port UDP, adresse source', await until(page, () => ['groupe', 'udp', 'transport-params'].every((k) => document.querySelector(`#station .ops-main .q[data-term="${k}"]`)), null, 8000));
await click('#station .ops-navbtn[data-ops="ptp"]');
T.check('Exploitation, PTP : décalage, délai moyen, domaine', await ev(() => ['offset', 'delai-moyen', 'domaine'].every((k) => document.querySelector(`#station .ops-main .q[data-term="${k}"]`))));
await click('#station .ops-main .q[data-term="delai-moyen"]');
p = await pop();
T.check('fiche « délai moyen » avec le schéma de l\'échange PTP', p && /délai/i.test(p.t) && p.fig, JSON.stringify(p));
await shot('02-ops-ptp');
await page.keyboard.press('Escape');
await click('#station .ops-navbtn[data-ops="nmos"]');
T.check('Exploitation, NMOS : battement, IS-04, IS-05', await ev(() => ['heartbeat', 'is-04', 'is-05'].every((k) => document.querySelector(`#station .ops-main .q[data-term="${k}"]`))));

// ---- lexique ----
await click('#station .net-lex');
T.check('lexique : toutes les fiches par famille', await ev(() => document.querySelectorAll('#termpop .tp-lexi').length >= 80 && document.querySelectorAll('#termpop .tp-lex h4').length >= 7));
await page.locator('#termpop .tp-search').fill('bmca');
await page.waitForTimeout(200);
T.check('recherche « bmca »', await ev(() => [...document.querySelectorAll('#termpop .tp-lexi')].some((b) => b.dataset.see === 'bmca')));
await click('#termpop .tp-lexi[data-see="bmca"]');
p = await pop();
T.check('fiche BMCA depuis le lexique, retour possible', p && /BMCA/.test(p.t) && p.fig && p.back, JSON.stringify(p));
await shot('03-lexique-bmca');
await page.keyboard.press('Escape');

// ---- SDP (fenêtre modale) ----
await click('#station .net-mode[data-mode="tech"]');
await click('#station .tabs .tab[data-k="flows"]');
await click('#station [data-tut="sdp"]');
T.check('fenêtre SDP : « ? » dans l\'en-tête', await until(page, () => !!document.querySelector('#modal header .q[data-term="sdp"]'), null, 6000));
await click('#modal header .q[data-term="sdp"]');
T.check('fiche SDP par-dessus la fenêtre', (await pop())?.t === 'SDP' && await ev(() => +getComputedStyle(document.querySelector('#termpop')).zIndex > +getComputedStyle(document.querySelector('#modal')).zIndex));
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
T.check('Échap : la fiche d\'abord, la fenêtre SDP ensuite', !(await pop()) && await ev(() => !document.querySelector('#modal').hidden));
await page.keyboard.press('Escape'); await page.waitForTimeout(200);

// ---- Cours, chapitre réseau ----
T.check('le poste est toujours ouvert', await ev(() => window.__dbg.S.mode === 'station' && document.querySelector('#modal').hidden));
await ev(() => window.__dbg.openGuide('guide', 'reseau'));
T.check('Cours, chapitre réseau : « ? » dans les tableaux et bouton du lexique', await until(page, () => ['spine', 'leaf', 'uplink', 'grand-maitre'].every((k) => document.querySelector(`#layer .prose .q[data-term="${k}"]`)) && [...document.querySelectorAll('#layer .btn')].some((b) => /Lexique/.test(b.textContent) && !b.hidden), null, 6000));
await click('#layer .prose .q[data-term="uplink"]');
T.check('fiche « uplink » depuis le Cours, par-dessus', /lien montant|uplink/i.test((await pop())?.t || '') && await ev(() => +getComputedStyle(document.querySelector('#termpop')).zIndex > +getComputedStyle(document.querySelector('#layer')).zIndex));
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
T.check('Échap deux fois : fiche puis Cours fermés, retour au poste', !(await pop()) && await ev(() => !document.querySelector('#layer') && document.querySelector('#modal').hidden && window.__dbg.S.mode === 'station'));

// ---- « Ouvrir dans le Cours » depuis la fenêtre ----
await click('#station .q[data-term="is-05"]');
T.check('fenêtre IS-05 : bouton « Ouvrir dans le Cours »', (await pop()) && await ev(() => !!document.querySelector('#termpop [data-cours="is-05"]')));
await click('#termpop [data-cours]');
T.check('le Cours s\'ouvre sur la même fiche, thème Réseau déplié, la fenêtre se ferme', await until(page, () => document.querySelector('#layer .co-fiche')?.dataset.fiche === 'is-05' && document.querySelector('#termpop').hidden && document.querySelector('#layer details.co-theme[data-k="reseau"]').open && document.querySelector('#layer .co-item[aria-current="true"]')?.dataset.fiche === 'is-05', null, 4000));
T.check('… avec « Emmène-moi au poste Réseau IP »', await ev(() => [...document.querySelectorAll('#layer .co-go .btn')].some((b) => /Réseau IP/.test(b.textContent))));
await shot('03b-cours-is05');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
T.check('Échap : le Cours se ferme, retour au poste', await ev(() => !document.querySelector('#layer') && window.__dbg.S.mode === 'station'));

// ---- téléphone ----
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
await click('#station .tabs .tab[data-k="meas"]');
await page.locator('#station th .q[data-term="gigue"]').first().scrollIntoViewIfNeeded();
await click('#station th .q[data-term="gigue"]');
p = await pop();
T.check('téléphone : la fiche s\'ouvre en bas de l\'écran, sur toute la largeur', p && p.sheet && await ev(() => { const r = document.querySelector('#termpop').getBoundingClientRect(); return r.width >= 389 && Math.abs(r.bottom - innerHeight) < 2; }), JSON.stringify(p));
T.check('téléphone : pas de défilement horizontal', await ev(() => document.querySelector('#termpop').scrollWidth <= document.querySelector('#termpop').clientWidth + 1));
await shot('04-telephone');
await T.finish();
