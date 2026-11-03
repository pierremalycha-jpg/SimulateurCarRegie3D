// Le profil, le pass, les succès et le classement (v19.27), sans compte connecté : la carte joueur avec
// l'avatar (écran Jouer), le profil (carte, défis du jour, apparence, invitation à se connecter), le pass
// (récupérer, équiper ; un objet verrouillé ne se porte pas), les succès, le classement fermé sans compte.
// Avec un compte (reprise de la progression de l'ordinateur, profil public, classement) : suite « comptes ».
// node tests/e2e/profil.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';

const OUT = outDir('profil');
const T = reporter();
const browser = await launch();
const A = await openPage(browser, { errors: T.errors });
const ev = (f, a) => A.evaluate(f, a);

// une progression faite sur cet ordinateur : une leçon, assez d'XP pour le niveau 5, deux badges
await ev(() => { const P = window.__dbg.PROG; P.cours = { 'signal-422': { seen: true, quiz: { score: 3, total: 3 } } }; P.game = { keys: { 'quiz:signal-422': { at: Date.now(), pts: 400, label: 'test' } }, extra: 0, badges: { 'premier-pas': Date.now(), 'brasseur': Date.now() }, count: {}, log: [] }; window.__dbg.emit('shared'); });

// la carte joueur de l'écran Jouer : avatar, niveau, récompenses à récupérer ; un clic ouvre le profil
T.check('la carte joueur : avatar, niveau 5, pastille des récompenses', await until(A, () => { const c = document.querySelector('#start .pcard'); return !!c && !!c.querySelector('.pf-av') && c.querySelector('.pc-lvl b')?.textContent === '5' && !!c.querySelector('.pc-cadeau'); }, null, 8000));
const lv = await ev(() => { const a = document.querySelector('#start .pcard .pf-av').getBoundingClientRect(), l = document.querySelector('#start .pcard .pc-lvl').getBoundingClientRect(); return { a: a.width, l: l.width }; });
T.check('la pastille du niveau est posée sur l\'avatar, plus petite que lui', lv.l < lv.a * 0.7, JSON.stringify(lv));
await A.locator('#start .pcard').first().screenshot({ path: `${OUT}/01-carte-joueur.png` });
await A.locator('#start .pcard').first().click();
T.check('un clic sur la carte joueur ouvre le profil, au pass (récompenses en attente)', await until(A, () => !!document.querySelector('#layer.ly-profil') && document.querySelector('#layer .tab.on')?.dataset.k === 'pass', null, 5000));

// le pass : 59 paliers sur toute la largeur ; tout récupérer
const pass = await ev(() => ({ tiles: document.querySelectorAll('.pf-palier').length, prets: document.querySelectorAll('.pf-palier.pret').length, cols: getComputedStyle(document.querySelector('.pf-pass')).gridTemplateColumns.split(' ').length, nul: /\bnull\b/.test(document.querySelector('#layer .ly-page').textContent) }));
T.check('le pass : 59 paliers (niveaux 2 à 60), plusieurs colonnes, ceux atteints prêts, pas de « null »', pass.tiles === 59 && pass.prets === 4 && pass.cols >= 3 && !pass.nul, JSON.stringify(pass));
await A.screenshot({ path: `${OUT}/02-pass.png` });
await A.click('#pf-tout'); await A.waitForTimeout(300);
T.check('tout récupérer : plus rien en attente, quatre paliers récupérés', await ev(() => !document.querySelector('.pf-palier.pret') && document.querySelectorAll('.pf-palier.recu').length === 4));

// le profil : carte, défis, apparence ; équiper l'avatar Caméra (niveau 2), pas la couronne (niveau 58)
await A.click('#layer .tab[data-k="profil"]'); await A.waitForTimeout(300);
const pf = await ev(() => ({ tabs: [...document.querySelectorAll('#layer .ly-tabs .tab')].map((b) => b.textContent), carte: !!document.querySelector('.pf-carte .pf-av.grand'), defis: document.querySelectorAll('.pf-defi').length, objets: document.querySelectorAll('.pf-objet').length, invite: document.querySelector('.pf-compte')?.textContent || '', nul: /\bnull\b/.test(document.querySelector('#layer .ly-page').textContent) }));
T.check('le profil : quatre onglets, la carte, trois défis du jour, l\'apparence, le compte (connexion proposée ou comptes désactivés), pas de « null »', pf.tabs.join(',') === 'Mon profil,Le pass,Succès,Classement' && pf.carte && pf.defis === 3 && pf.objets >= 20 && /Connecte-toi|pas activés/.test(pf.invite) && !pf.nul, JSON.stringify(pf));
await A.click('.pf-objet[data-objet="avatar:camera"]'); await A.waitForTimeout(200);
const eq = await ev(() => ({ av: window.__dbg.PROG.profil.avatar, verrou: document.querySelector('.pf-objet[data-objet="avatar:couronne"]')?.hasAttribute('disabled') }));
T.check('équiper l\'avatar Caméra ; la couronne (niveau 58) reste verrouillée', eq.av === 'camera' && eq.verrou === true, JSON.stringify(eq));
await A.fill('#pf-pseudo', 'Léa'); await A.click('#pf-ident-ok'); await A.waitForTimeout(200);
T.check('le pseudo : enregistré et affiché sur la carte', await ev(() => window.__dbg.PROG.profil.pseudo === 'Léa' && document.querySelector('.pf-carte h3')?.textContent === 'Léa'));
await A.screenshot({ path: `${OUT}/03-profil.png` });

// les succès
await A.click('#layer .tab[data-k="succes"]'); await A.waitForTimeout(300);
T.check('succès : les badges obtenus avec leur date, les autres verrouillés', await ev(() => document.querySelectorAll('.pf-badge.won').length >= 2 && document.querySelectorAll('.pf-badge.locked').length > 10));

// le classement, sans compte : fermé, avec la raison
await A.click('#layer .tab[data-k="classement"]'); await A.waitForTimeout(300);
T.check('classement sans compte : fermé, la raison et, si les comptes sont activés, « Se connecter »', await ev(() => { const v = document.querySelector('.pf-vide'); return !!v && /Connecte-toi|pas activés/.test(v.textContent); }));
await A.keyboard.press('Escape');
T.check('Échap referme le profil', await until(A, () => !document.querySelector('#layer'), null, 3000));
await T.finish();
