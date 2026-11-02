// Les comptes (v19.24), de bout en bout, contre l'émulateur Firebase (lancé tout seul par
// tools/firebase-test.mjs si besoin) : deux navigateurs, un professeur et un élève.
//   - le professeur ouvre son compte depuis l'écran titre, confirme son adresse, devient Formateur ;
//   - au tableau de bord : une classe, un élève, une liste collée ; identifiants et mots de passe affichés ;
//   - l'élève se connecte avec son identifiant : son nom et sa classe sur l'écran titre, profil Étudiant
//     imposé ; sa progression n'est pas mêlée à celle de l'ordinateur ; elle part en ligne ;
//   - le professeur voit la difficulté de l'élève (quiz manqué plusieurs fois), son bilan ; il lui donne
//     un nouveau mot de passe, qui marche ; à la déconnexion, la progression de l'ordinateur revient.
// node tests/e2e/comptes.mjs [dossier]
import { spawnSync } from 'node:child_process';
import path from 'node:path';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  const root = path.resolve(import.meta.dirname, '../..');
  const r = spawnSync('node', ['tools/firebase-test.mjs', `node tests/e2e/comptes.mjs ${process.argv[2] || ''}`.trim()], { cwd: root, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
const { launch, openPage, outDir, until, reporter } = await import('./harness.mjs');
const fs = await import('node:fs');
const { createRequire } = await import('node:module');
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
/** axe-core sur une partie de la page : aucun défaut grave (contraste, noms des champs et des touches…) */
async function axe(page, nom, sel) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async (s) => (await window.axe.run({ include: [[s]] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations
    .filter((x) => x.impact === 'critical' || x.impact === 'serious').map((x) => `${x.id} ×${x.nodes.length} ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`), sel);
  T.check(`accessibilité (axe) : ${nom}`, !v.length, v.join(' | '));
}
const OUT = outDir('comptes');
const T = reporter();
const PROJET = process.env.GCLOUD_PROJECT || 'demo-tiee';
const AUTH = 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST;
const [FH, FP] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const CFG = { config: { apiKey: 'demo-cle', authDomain: `${PROJET}.firebaseapp.com`, projectId: PROJET, appId: 'demo' }, emulateurs: { auth: AUTH, firestore: { host: FH, port: Number(FP) } } };
await fetch(`http://${FH}:${FP}/emulator/v1/projects/${PROJET}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`${AUTH}/emulator/v1/projects/${PROJET}/accounts`, { method: 'DELETE' });
const r0 = await fetch(`http://${FH}:${FP}/v1/projects/${PROJET}/databases/(default)/documents/admin/profs`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { emails: { arrayValue: { values: [{ stringValue: 'prof@lycee.fr' }] } } } }) });
T.check('préparation : la liste des professeurs (admin/profs)', r0.ok);

// la page de test (http://local.test) appelle l'émulateur sur 127.0.0.1 : Chromium bloque ces requêtes vers le réseau
// local depuis une page non sécurisée (Private Network Access) ; en vrai, la page parle à Google, pas à 127.0.0.1
const browser = await launch(['--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks']);
const avecComptes = (p) => { p.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(0, 140)); }); return p.addInitScript((c) => { window.__TIEE_FIREBASE__ = c; }, CFG); };
const prof = await openPage(browser, { errors: T.errors, title: true, id: 'prof', before: avecComptes });
const ev = (page, f, a) => page.evaluate(f, a);
const texte = (page, sel) => page.evaluate((s) => document.querySelector(s)?.textContent || '', sel);

// ---- le professeur ouvre son compte ----
T.check('écran titre : la bande du compte propose de se connecter', await until(prof, () => !document.querySelector('#ti-compte').hidden && !!document.querySelector('#ti-connexion'), null, 30000));
await prof.locator('#ti-compte').screenshot({ path: `${OUT}/01-bande-invite.png` });
await prof.click('#ti-connexion'); await prof.waitForSelector('#cpt-id');
await prof.screenshot({ path: `${OUT}/02-connexion.png` });
await axe(prof, 'fenêtre de connexion', '#modal');
await prof.click('#cpt-prof');
const champs = prof.locator('.cpt-form input');
await champs.nth(0).fill('Pierre'); await champs.nth(1).fill('Malycha'); await champs.nth(2).fill('prof@lycee.fr'); await champs.nth(3).fill('secret123');
await prof.click('.cpt-form button[type=submit]');
T.check('ouverture du compte professeur : adresse à confirmer', await until(prof, () => /Confirmez votre adresse/.test(document.querySelector('.cpt')?.textContent || ''), null, 30000));
// le lien du courriel, collé dans la fenêtre (abîmé comme par certaines messageries : « &amp; ») ; l'application confirme seule
const codes = await (await fetch(`${AUTH}/emulator/v1/projects/${PROJET}/oobCodes`)).json();
const lien = codes.oobCodes.filter((c) => c.email === 'prof@lycee.fr' && c.requestType === 'VERIFY_EMAIL').pop();
await prof.locator('.cpt').screenshot({ path: `${OUT}/02b-confirmer.png` });
await prof.fill('#cpt-lien', 'https://exemple.fr/sans-code'); await prof.click('#cpt-confirmer');
T.check('un lien qui n\'est pas le bon : refusé, avec la raison', await until(prof, () => /oobCode/.test(document.querySelector('.cpt-msg')?.textContent || ''), null, 10000));
await prof.fill('#cpt-lien', lien.oobLink.replace(/&/g, '&amp;')); await prof.click('#cpt-confirmer');
T.check('adresse confirmée : connecté comme professeur, profil Formateur imposé', await until(prof, () => window.__dbg.comptes.COMPTE.role === 'prof' && document.body.classList.contains('role-formateur') && !!document.querySelector('#ti-tableau'), null, 30000),
  await texte(prof, '#ti-compte'));

// ---- le tableau de bord : une classe, des élèves ----
await prof.click('#ti-tableau');
await prof.waitForSelector('.ly-tableau');
T.check('tableau de bord vide : il propose de créer une classe', await until(prof, () => /Aucune classe/.test(document.querySelector('.ly-page')?.textContent || ''), null, 20000));
await prof.click('.ly-tabs .tab[data-k=comptes]');
await prof.fill('#tb-nouvelle', 'BTS MAV 1'); await prof.click('#tb-creer-classe');
T.check('classe créée et choisie', await until(prof, () => /BTS MAV 1/.test(document.querySelector('#tb-classe')?.textContent || '') && !!document.querySelector('#tb-prenom'), null, 20000));
await prof.fill('#tb-prenom', 'Léa'); await prof.fill('#tb-nom', 'Martin'); await prof.click('#tb-ajouter');
T.check('un élève créé : identifiant « lea.martin » et mot de passe provisoire affichés', await until(prof, () => /lea\.martin/.test(document.querySelector('#tb-crees')?.textContent || ''), null, 30000));
await prof.click('.tb-lot summary');
await prof.fill('#tb-liste', 'DURAND Tom\nMartin;Léa');
await prof.click('#tb-ajouter-liste');
T.check('une liste collée : deux comptes de plus (homonyme « lea.martin2 »)', await until(prof, () => { const t = document.querySelector('#tb-comptes')?.textContent || ''; return /tom\.durand/.test(t) && /lea\.martin2/.test(t); }, null, 40000));
const lea = await ev(prof, () => { const r = [...document.querySelectorAll('#tb-crees tbody tr')].find((tr) => tr.children[2].textContent === 'lea.martin'); return { id: r.children[2].textContent, mdp: r.children[3].textContent }; });
T.check('mot de passe provisoire lisible (syllabes et chiffres)', /^[a-z]{7}\d\d$/.test(lea.mdp), lea.mdp);
T.check('mots de passe masqués dans la liste, affichables', await until(prof, () => /••••/.test(document.querySelector('#tb-comptes')?.textContent || ''), null, 10000));
await prof.screenshot({ path: `${OUT}/03-classes-comptes.png`, fullPage: false });
await axe(prof, 'tableau de bord, classes et comptes', '#layer');

// ---- l'élève, sur son ordinateur ----
const eleve = await openPage(browser, { errors: T.errors, title: true, id: 'eleve', before: avecComptes });
await until(eleve, () => !!document.querySelector('#ti-connexion'), null, 30000);
// les notifications de l'élève, gardées pour vérifier qu'aucun enregistrement n'échoue (déconnexion comprise)
await ev(eleve, () => { window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('toast')?.textContent; if (t && window.__toasts[window.__toasts.length - 1] !== t) window.__toasts.push(t); }).observe(document.body, { childList: true, subtree: true, characterData: true }); });
// une progression faite sans compte sur cet ordinateur (par quelqu'un d'autre)
await ev(eleve, () => { const P = window.__dbg.PROG; P.cours = { 'signal-bits': { seen: true, quiz: { score: 3, total: 3 } } }; P.updatedAt = Date.now(); window.__dbg.emit('patchDone'); });
await eleve.waitForTimeout(3000);
await eleve.click('#ti-connexion'); await eleve.fill('#cpt-id', 'lea.martin'); await eleve.fill('#cpt-mdp', 'faux-mdp'); await eleve.click('#cpt-go');
T.check('mauvais mot de passe : refusé, en français', await until(eleve, () => /incorrect/.test(document.querySelector('.cpt-msg')?.textContent || ''), null, 20000));
await eleve.fill('#cpt-mdp', lea.mdp); await eleve.click('#cpt-go');
T.check('l\'élève est connecté : nom et classe sur l\'écran titre', await until(eleve, () => /^Léa Martin · BTS MAV 1Se déconnecter$/.test(document.querySelector('#ti-compte')?.textContent || ''), null, 30000), await texte(eleve, '#ti-compte'));
const e1 = await ev(eleve, () => ({ role: window.__dbg.PROFILE.role, force: window.__dbg.PROFILE.force, cours: Object.keys(window.__dbg.PROG.cours || {}) }));
T.check('profil Étudiant imposé ; la progression de l\'ordinateur n\'entre pas dans le compte', e1.role === 'etudiant' && e1.force === 'etudiant' && !e1.cours.includes('signal-bits'), JSON.stringify(e1));
await ev(eleve, () => { window.__dbg.setRole('formateur'); });
T.check('un élève ne passe pas Formateur', await ev(eleve, () => window.__dbg.PROFILE.role === 'etudiant' && !document.body.classList.contains('role-formateur')));
await eleve.locator('#ti-compte').screenshot({ path: `${OUT}/04-bande-eleve.png` });
await axe(eleve, 'bande du compte (écran titre)', '#ti-compte');
await ev(eleve, () => window.__dbg.emit('settings')); await eleve.waitForSelector('#rg-compte');
T.check('Réglages : « Mon compte » (identifiant, classe), le profil donné par le compte', /lea\.martin · BTS MAV 1/.test(await texte(eleve, '#rg-compte')) && /donné par ton compte/.test(await texte(eleve, '.rg')), await texte(eleve, '#rg-compte'));
await eleve.locator('#rg-compte').screenshot({ path: `${OUT}/05-mon-compte.png` });
await eleve.keyboard.press('Escape');
// l'élève bute sur un quiz (six essais), en réussit un autre ; la progression part en ligne
await ev(eleve, () => { const P = window.__dbg.PROG; P.cours = { 'signal-422': { seen: true, qn: 6, quiz: { score: 1, total: 3 } }, 'sdi-bnc': { seen: true, qn: 1, quiz: { score: 3, total: 3 }, exo: { best: 85, seul: true, n: 1 } } }; P.jours = { [new Date().toISOString().slice(0, 10)]: 42 }; P.updatedAt = Date.now(); window.__dbg.emit('patchDone'); });

// ---- le professeur voit le bilan ----
await prof.click('.ly-tabs .tab[data-k=suivi]');
T.check('suivi : Léa signalée en difficulté (pastille forte)', await until(prof, () => { const tr = [...document.querySelectorAll('#tb-eleves tbody tr')].find((x) => /lea\.martin$/.test(x.querySelector('small')?.textContent || '')); return !!tr && !!tr.querySelector('.tb-pastille.forte'); }, null, 40000));
T.check('suivi : synthèse de la classe, « Où la classe bloque »', /Où la classe bloque/.test(await texte(prof, '.ly-page')) && /3/.test(await texte(prof, '.tb-kpis')));
await prof.screenshot({ path: `${OUT}/06-suivi-classe.png` });
await axe(prof, 'tableau de bord, suivi de la classe', '#layer');
await prof.click('#tb-eleves tbody tr.alerte');
T.check('bilan de l\'élève : la difficulté dite en clair (quiz, 6 essais), le parcours, le temps', await until(prof, () => { const t = document.querySelector('#tb-difficultes')?.textContent || ''; return /6 essais sans le réussir/.test(t); }, null, 20000) && /42 min/.test(await texte(prof, '.tb-kpis')), await texte(prof, '#tb-difficultes'));
await prof.screenshot({ path: `${OUT}/07-bilan-eleve.png`, fullPage: false });
await axe(prof, 'tableau de bord, bilan d\'un élève', '#layer');
await prof.click('.tb-livret summary');
T.check('le livret de compétences de l\'élève s\'ouvre dans son bilan', await until(prof, () => !!document.querySelector('.tb-livret .lv'), null, 10000));

// ---- nouveau mot de passe, puis reconnexion de l'élève ----
await prof.click('text=Gérer le compte');
await until(prof, () => !!document.querySelector('#tb-comptes'), null, 10000);
await prof.locator('#tb-comptes tbody tr').filter({ has: prof.locator('td.tb-mono', { hasText: /^lea\.martin$/ }) }).locator('[data-act=mdp]').click();
await prof.click('#ask [data-ask=ok]');
T.check('nouveau mot de passe donné', await until(prof, () => /Nouveau mot de passe de Léa Martin/.test(document.getElementById('toast')?.textContent || ''), null, 30000));
const lireMdp = () => ev(prof, () => { const r = [...document.querySelectorAll('#tb-crees tbody tr')].find((tr) => tr.children[2].textContent === 'lea.martin'); return r ? r.children[3].textContent : ''; });
await until(prof, (ancien) => { const r = [...document.querySelectorAll('#tb-crees tbody tr')].find((tr) => tr.children[2].textContent === 'lea.martin'); return !!r && r.children[3].textContent !== ancien; }, lea.mdp, 10000);
const neuf = await lireMdp();
T.check('le nouveau mot de passe s\'affiche à la place de l\'ancien', !!neuf && neuf !== lea.mdp, neuf);
await ev(eleve, () => window.__dbg.emit('settings')); await eleve.click('#rg-deco');
T.check('déconnexion : la progression de l\'ordinateur revient', await until(eleve, () => window.__dbg.comptes.COMPTE.etat === 'deconnecte' && !!(window.__dbg.PROG.cours || {})['signal-bits'] && !(window.__dbg.PROG.cours || {})['signal-422'], null, 30000));
T.check('déconnexion : aucun échec d\'enregistrement signalé', await ev(eleve, () => !window.__toasts.some((t) => /pas pu être envoyée|ne s'enregistre plus/.test(t))), JSON.stringify(await ev(eleve, () => window.__toasts)));
await eleve.click('#ti-connexion'); await eleve.fill('#cpt-id', 'lea.martin'); await eleve.fill('#cpt-mdp', neuf); await eleve.click('#cpt-go');
T.check('reconnexion avec le nouveau mot de passe : la progression du compte revient', await until(eleve, () => window.__dbg.comptes.COMPTE.etat === 'connecte' && (window.__dbg.PROG.cours || {})['signal-422']?.qn === 6, null, 30000));

// ---- le professeur : la liste des professeurs ----
await prof.click('.ly-tabs .tab[data-k=profs]');
T.check('professeurs : la liste des adresses autorisées', await until(prof, () => /prof@lycee\.fr/.test(document.querySelector('.tb-profs')?.textContent || ''), null, 20000));
// les refus attendus de Firebase Authentication (homonyme déjà pris, mauvais mot de passe essayé exprès) laissent
// une ligne « 400 » dans la console du navigateur : ce ne sont pas des erreurs de la page
T.errors.splice(0, T.errors.length, ...T.errors.filter((e) => !/the server responded with a status of 400/.test(e)));
await T.finish();
