// Le compte en ligne, le profil, le pass et le classement (v19.25) : Firebase remplacé par un faux en
// mémoire (requêtes interceptées). Créer un compte depuis Réglages → Mon compte, la progression de
// l'ordinateur qui rejoint le compte, le profil (carte, défis du jour, apparence), le pass (récupérer,
// équiper), les succès, le classement et le profil d'un autre joueur, la déconnexion qui retire la
// progression de l'ordinateur, la reconnexion qui la retrouve (« autre ordinateur »).
// node tests/e2e/profil.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
import { fauxFirebase } from '../helpers/faux-firebase.mjs';
import { versDocument } from '../../src/compte/firestore.js';

const OUT = outDir('profil');
const T = reporter();
const FB = fauxFirebase();
const CFG = { apiKey: 'AIzaSyTEST-tiee-simulator-0000000000', projectId: 'tiee-test' };
// un autre joueur déjà au classement
FB.comptes.set('rival@test.fr', { uid: 'rival', mdp: 'xxxxxx' });
FB.docs.set('profils/rival', versDocument({ pseudo: 'Inès', avatar: 'micro', banniere: 'mire', cadre: 'or', titre: 'Roi du brassage', niveau: 27, grade: 'Ingénieur d\'exploitation', xp: 4400, classe: 'BTS1 TIEE', vitrine: ['brasseur', 'depanneur'], badges: ['premier-pas', 'brasseur', 'depanneur', 'comp-C32'], nbBadges: 4, lecons: 21, exercices: 9, competences: 12, serie: 5, meilleureSerie: 8, maj: Date.now() }));

const browser = await launch();
const route = async (p) => {
  await p.route(/https:\/\/(identitytoolkit|securetoken|firestore)\.googleapis\.com\/.*/, async (r) => {
    const q = r.request();
    const res = FB.handle(q.url(), { method: q.method(), headers: q.headers(), body: q.postData() || '' });
    await r.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res.body) });
  });
  await p.addInitScript((c) => { try { if (!localStorage.getItem('carregie.firebase')) localStorage.setItem('carregie.firebase', JSON.stringify(c)); } catch (e) { /* stockage indisponible */ } }, CFG);
};
const A = await openPage(browser, { errors: T.errors, before: route });
const ev = (f, a) => A.evaluate(f, a);
await until(A, () => window.__dbg.COMPTE.etat === 'deconnecte', null, 60000);

// une progression faite sans compte sur cet ordinateur : une leçon, assez d'XP pour quelques niveaux
await ev(() => { const P = window.__dbg.PROG; P.cours = { 'signal-422': { seen: true, quiz: { score: 3, total: 3 } } }; P.game = { keys: { 'quiz:signal-422': { at: Date.now(), pts: 400, label: 'test' } }, extra: 0, badges: { 'premier-pas': Date.now(), 'brasseur': Date.now() }, count: {}, log: [] }; window.__dbg.emit('shared'); });

// la carte joueur de l'écran titre : avatar, niveau, récompenses à récupérer
await ev(() => window.__dbg.emit('settings')); await A.waitForTimeout(300);
const rg = await ev(() => ({ sec: !!document.getElementById('rg-compte-sec'), t: document.querySelector('#rg-compte-sec .mp-state')?.textContent || '' }));
T.check('Réglages : la section « Mon compte », pas connecté', rg.sec && /Pas connecté/.test(rg.t), JSON.stringify(rg));
await A.click('#rg-compte'); await A.waitForTimeout(300);
await A.click('#cp-mode-creer');
await A.fill('#cp-email', 'eleve@test.fr'); await A.fill('#cp-mdp', 'motdepasse'); await A.fill('#cp-pseudo', 'Léa');
await A.locator('#modal .cp').screenshot({ path: `${OUT}/01-creer-compte.png` });
await A.click('#cp-go');
T.check('créer un compte : connecté, la fenêtre le dit', await until(A, () => window.__dbg.COMPTE.etat === 'connecte' && /Connecté : eleve@test.fr/.test(document.querySelector('#modal .cp')?.textContent || ''), null, 20000));
await A.waitForTimeout(500);
const uid = await ev(() => window.__dbg.COMPTE.uid);
const enLigne = JSON.parse((FB.lire('progress/' + uid) || {}).data || '{}');
T.check('la progression de l\'ordinateur est dans le compte (leçon, XP, pseudo)', enLigne.cours?.['signal-422']?.quiz?.score === 3 && enLigne.profil?.pseudo === 'Léa', JSON.stringify(Object.keys(enLigne)));

// le profil
await A.click('#cp-profil'); await A.waitForTimeout(500);
const pf = await ev(() => ({ open: !!document.querySelector('#layer.ly-profil'), tabs: [...document.querySelectorAll('#layer .ly-tabs .tab')].map((b) => b.textContent), nom: document.querySelector('.pf-carte h3')?.textContent, defis: document.querySelectorAll('.pf-defi').length, objets: document.querySelectorAll('.pf-objet').length, attente: document.querySelector('.pf-attente')?.textContent || '' }));
T.check('le profil : quatre onglets, la carte (pseudo), trois défis du jour, l\'apparence, des récompenses à récupérer', pf.open && pf.tabs.join(',') === 'Mon profil,Le pass,Succès,Classement' && pf.nom === 'Léa' && pf.defis === 3 && pf.objets >= 20 && /à récupérer/.test(pf.attente), JSON.stringify(pf));
await A.screenshot({ path: `${OUT}/02-profil.png` });

// le pass : tout récupérer, puis équiper la caméra (niveau 2) ; un objet verrouillé ne se porte pas
await A.click('#layer .tab[data-k="pass"]'); await A.waitForTimeout(400);
const pass = await ev(() => ({ tiles: document.querySelectorAll('.pf-palier').length, prets: document.querySelectorAll('.pf-palier.pret').length }));
T.check('le pass : 59 paliers (niveaux 2 à 60), ceux atteints prêts', pass.tiles === 59 && pass.prets >= 2, JSON.stringify(pass));
await A.screenshot({ path: `${OUT}/03-pass.png` });
await A.click('#pf-tout'); await A.waitForTimeout(300);
T.check('tout récupérer : plus rien en attente', await ev(() => !document.querySelector('.pf-palier.pret') && document.querySelectorAll('.pf-palier.recu').length >= 2));
await A.click('#layer .tab[data-k="profil"]'); await A.waitForTimeout(300);
await A.click('.pf-objet[data-objet="avatar:camera"]'); await A.waitForTimeout(200);
const eq = await ev(() => ({ av: window.__dbg.PROG.profil.avatar, verrou: document.querySelector('.pf-objet[data-objet="avatar:couronne"]')?.hasAttribute('disabled') }));
T.check('équiper l\'avatar Caméra ; la couronne (niveau 58) reste verrouillée', eq.av === 'camera' && eq.verrou === true, JSON.stringify(eq));

// les succès
await A.click('#layer .tab[data-k="succes"]'); await A.waitForTimeout(300);
T.check('succès : les badges obtenus avec leur date, les autres verrouillés', await ev(() => document.querySelectorAll('.pf-badge.won').length >= 2 && document.querySelectorAll('.pf-badge.locked').length > 10));

// le classement : Inès et moi, du plus haut niveau au plus bas ; son profil
await A.click('#layer .tab[data-k="classement"]');
T.check('classement : deux joueurs, Inès devant, ma ligne en évidence', await until(A, () => { const l = [...document.querySelectorAll('.pf-ligne')]; return l.length === 2 && /Inès/.test(l[0].textContent) && l[1].classList.contains('moi'); }, null, 15000));
await A.screenshot({ path: `${OUT}/04-classement.png` });
await A.click('.pf-ligne[data-uid="rival"]');
T.check('le profil d\'Inès : sa carte, ses chiffres, ses succès', await until(A, () => /Inès/.test(document.querySelector('.pf-carte h3')?.textContent || '') && document.querySelectorAll('.pf-stats > div').length === 4 && document.querySelectorAll('.pf-badge.won').length >= 2, null, 10000));
await A.screenshot({ path: `${OUT}/05-profil-autre.png` });
// mon profil public, publié
await ev(() => window.__dbg.emit('pass', { type: 'profil' }));
T.check('mon profil public est publié (pseudo, avatar, sans adresse)', await until(A, () => true, null, 100) && await (async () => { for (let i = 0; i < 40; i++) { const p = FB.lire('profils/' + uid); if (p && p.avatar === 'camera') return !JSON.stringify(p).includes('@'); await A.waitForTimeout(250); } return false; })());

// se déconnecter : la progression quitte l'ordinateur
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
await ev(() => window.__dbg.openCompte()); await A.waitForTimeout(300);
await A.click('#cp-out'); await A.click('#ask [data-ask="ok"]');
const out = await until(A, () => window.__dbg.COMPTE.etat === 'deconnecte' && !Object.keys(window.__dbg.PROG.cours || {}).length && !localStorage.getItem('carregie.compte'), null, 15000);
T.check('se déconnecter : progression retirée de l\'ordinateur, session oubliée', out);

// « un autre ordinateur » : un nouvel onglet vierge, on se connecte, tout revient
const B = await openPage(browser, { errors: T.errors, before: route, id: 'B' });
await until(B, () => window.__dbg.COMPTE.etat === 'deconnecte', null, 60000);
await B.evaluate(() => window.__dbg.openCompte()); await B.waitForTimeout(300);
await B.fill('#cp-email', 'eleve@test.fr'); await B.fill('#cp-mdp', 'motdepasse'); await B.click('#cp-go');
T.check('autre ordinateur : se connecter retrouve la leçon, le pseudo, l\'avatar et les récompenses', await until(B, () => { const P = window.__dbg.PROG; return window.__dbg.COMPTE.etat === 'connecte' && P.cours?.['signal-422']?.quiz?.score === 3 && P.profil?.pseudo === 'Léa' && P.profil?.avatar === 'camera' && Object.keys(P.profil?.recus || {}).length >= 2; }, null, 20000));
await B.keyboard.press('Escape'); await B.waitForTimeout(200);
T.check('la carte joueur (écran titre et Jouer) : avatar et pseudo', await until(B, () => [...document.querySelectorAll('#ti-player .pcard, #start .pcard')].length >= 2 && [...document.querySelectorAll('#ti-player .pcard, #start .pcard')].every((c) => !!c.querySelector('.pf-av') && /Léa/.test(c.textContent)), null, 8000));
await B.locator('#start .pcard').first().screenshot({ path: `${OUT}/06-carte-joueur.png` });
await B.locator('#start .pcard').first().click();
T.check('un clic sur la carte joueur ouvre le profil', await until(B, () => !!document.querySelector('#layer.ly-profil'), null, 5000));
await B.screenshot({ path: `${OUT}/07-profil-apres.png` });
await B.keyboard.press('Escape');
// rechargement : la session gardée reconnecte sans rien demander
await B.reload(); await until(B, () => !!window.__dbg, null, 180000);
T.check('rechargement : reconnecté tout seul', await until(B, () => window.__dbg.COMPTE.etat === 'connecte' && window.__dbg.PROG.cours?.['signal-422'], null, 60000));
// Firestore répond 404 pour un document qui n'existe pas encore (progression d'un nouveau compte) : le
// navigateur le note dans la console, c'est attendu (compte/firebase.js le lit comme « pas de document »)
for (let i = T.errors.length - 1; i >= 0; i--) if (/status of 404/.test(T.errors[i])) T.errors.splice(i, 1);
await T.finish();
