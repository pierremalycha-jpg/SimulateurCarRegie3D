// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { $, modal, toast, ask, field } from './common.js';
import { icon } from './icons.js';
import { COMPTE, estProf, nomDuCompte } from '../comptes/session.js';
import { connecter, deconnecter, inscrireProf, renvoyerConfirmation, relireSession, mdpOublie, texteErreur, confirmerAvecLien, nouveauMdpAvecLien } from '../comptes/firebase.js';
import { guestProgress, absorbProgress, saveProgressNow, COMPTE_SH } from '../shared.js';
import { motDePasseRefuse } from '../comptes/identifiants.js';
import { xpOf } from '../game/xp.js';

// ----------------------------------------------------------------------------------
// Se connecter (v19.24) : la fenêtre de connexion (identifiant d'élève ou adresse de professeur), l'ouverture
// d'un compte professeur (adresse autorisée, confirmée par courriel), la bande du compte sur l'écran titre
// et la section « Mon compte » des Réglages. Les comptes d'élèves sont créés par le professeur (tableau de
// bord) : un élève ne s'inscrit pas lui-même. Sans projet Firebase renseigné, rien de tout cela ne s'affiche.
// ----------------------------------------------------------------------------------
const input = (o) => el('input', { class: 'cpt-in', ...o });
const msgBox = () => el('p', { class: 'cpt-msg', role: 'alert', 'aria-live': 'assertive' });
const dire = (box, texte, bon = false) => { box.textContent = texte; box.classList.toggle('ok', bon); };

/** la fenêtre de connexion (« prof » : ouvrir un compte professeur) */
export function openConnexion(/** @type {'connexion' | 'prof'} */ vue = 'connexion') {
  if (!COMPTE.dispo) {
    modal.open('Se connecter', el('div', { class: 'cpt' }, el('p', {}, 'Les comptes en ligne ne sont pas activés sur cette version du simulateur : la progression reste dans ce navigateur.'),
      el('p', { class: 'note role-only' }, 'Pour les activer : renseigner le projet Firebase de l\'établissement (README, « Les comptes »).')), { width: 520 });
    return;
  }
  const body = el('div', { class: 'cpt' });
  const draw = (/** @type {string} */ v) => {
    body.replaceChildren();
    if (COMPTE.etat === 'verifier') return drawVerifier();
    if (v === 'prof') return drawProf();
    const id = input({ id: 'cpt-id', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'prenom.nom' });
    const mdp = input({ id: 'cpt-mdp', type: 'password', autocomplete: 'current-password' });
    const msg = msgBox();
    const go = el('button', { type: 'submit', class: 'btn primary', id: 'cpt-go' }, icon('connexion'), 'Se connecter');
    const form = el('form', { class: 'cpt-form', onsubmit: async (e) => {
      e.preventDefault();
      if (!/** @type {HTMLInputElement} */ (id).value.trim() || !/** @type {HTMLInputElement} */ (mdp).value) { dire(msg, 'Identifiant et mot de passe, s\'il te plaît.'); return; }
      /** @type {HTMLButtonElement} */ (go).disabled = true; dire(msg, 'Connexion…', true);
      try { await connecter(/** @type {HTMLInputElement} */ (id).value, /** @type {HTMLInputElement} */ (mdp).value); dire(msg, 'Connecté. Chargement de ta progression…', true); }
      catch (er) { dire(msg, texteErreur(er)); /** @type {HTMLButtonElement} */ (go).disabled = false; }
    } },
    field('Identifiant (ou adresse e-mail pour un professeur)', id), field('Mot de passe', mdp), msg,
    el('div', { class: 'hwrow' }, go, el('button', { type: 'button', class: 'btn', onclick: () => modal.close() }, 'Continuer sans compte')));
    const oubli = el('button', { type: 'button', class: 'linkbtn', onclick: async () => {
      const v = /** @type {HTMLInputElement} */ (id).value.trim();
      if (!v.includes('@')) { dire(msg, 'Élève : demande à ton professeur, il te donne un nouveau mot de passe. Professeur : tapez votre adresse e-mail, puis « Mot de passe oublié ? ».', true); return; }
      try { await mdpOublie(v); body.replaceChildren(); drawNouveauMdp(v); } catch (er) { dire(msg, texteErreur(er)); }
    } }, 'Mot de passe oublié ?');
    body.append(el('p', { class: 'cpt-intro' }, 'Connecte-toi pour retrouver ta progression sur n\'importe quel ordinateur. Ton identifiant et ton mot de passe te sont donnés par ton professeur.'),
      form, el('p', { class: 'cpt-liens' }, oubli, el('button', { type: 'button', class: 'linkbtn', id: 'cpt-prof', onclick: () => draw('prof') }, 'Professeur : ouvrir mon compte')));
    if (COMPTE.etat === 'refuse' && COMPTE.message) dire(msg, COMPTE.message);
    setTimeout(() => /** @type {HTMLInputElement} */ (id).focus(), 30);
  };
  const drawProf = () => {
    const prenom = input({ type: 'text', autocomplete: 'given-name' }), nom = input({ type: 'text', autocomplete: 'family-name' });
    const email = input({ type: 'email', autocomplete: 'email' }), mdp = input({ type: 'password', autocomplete: 'new-password' });
    const msg = msgBox();
    const go = el('button', { type: 'submit', class: 'btn primary' }, 'Ouvrir mon compte');
    const val = (x) => /** @type {HTMLInputElement} */ (x).value.trim();
    body.append(el('p', { class: 'cpt-intro' }, 'Votre adresse doit être sur la liste des professeurs de l\'établissement (un collègue l\'ajoute depuis son tableau de bord). Un lien de confirmation vous est envoyé.'),
      el('form', { class: 'cpt-form', onsubmit: async (e) => {
        e.preventDefault();
        if (!val(prenom) || !val(nom) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val(email))) { dire(msg, 'Prénom, nom et une adresse e-mail valide.'); return; }
        const refus = motDePasseRefuse(/** @type {HTMLInputElement} */ (mdp).value); if (refus) { dire(msg, 'Mot de passe : ' + refus); return; }
        /** @type {HTMLButtonElement} */ (go).disabled = true;
        try { await inscrireProf({ email: val(email), mdp: /** @type {HTMLInputElement} */ (mdp).value, prenom: val(prenom), nom: val(nom) }); }
        catch (er) {
          // l'adresse a déjà un compte (inscription faite) : on passe à la connexion, l'adresse déjà tapée
          if (er && er.code === 'auth/email-already-in-use') { const v = val(email); draw('connexion'); const i = /** @type {HTMLInputElement | null} */ (body.querySelector('#cpt-id')); if (i) i.value = v; const m = body.querySelector('.cpt-msg'); if (m) dire(/** @type {HTMLElement} */ (m), 'Cette adresse a déjà un compte : connectez-vous avec son mot de passe (ou « Mot de passe oublié ? »).', true); setTimeout(() => /** @type {HTMLElement | null} */ (body.querySelector('#cpt-mdp'))?.focus(), 40); return; }
          dire(msg, texteErreur(er)); /** @type {HTMLButtonElement} */ (go).disabled = false;
        }
      } }, el('div', { class: 'grid2' }, field('Prénom', prenom), field('Nom', nom)), field('Adresse e-mail', email), field('Mot de passe (6 caractères au moins)', mdp), msg,
      el('div', { class: 'hwrow' }, go, el('button', { type: 'button', class: 'btn', onclick: () => draw('connexion') }, 'Retour'))));
  };
  const drawVerifier = () => {
    const msg = msgBox();
    // le lien du courriel, collé ici : l'application confirme l'adresse elle-même (la page de Firebase qui
    // l'ouvre d'habitude peut refuser un lien abîmé par la messagerie : « The selected page mode is invalid »)
    const lien = input({ id: 'cpt-lien', type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'https://…/__/auth/action?mode=verifyEmail&oobCode=…' });
    const confirmer = async () => {
      const v = /** @type {HTMLInputElement} */ (lien).value.trim();
      if (!v) { dire(msg, 'Collez d\'abord le lien reçu par courriel.'); return; }
      dire(msg, 'Confirmation…', true);
      try { const ok = await confirmerAvecLien(v); dire(msg, ok ? 'Adresse confirmée. Ouverture du compte…' : 'Le lien est passé, mais l\'adresse n\'apparaît pas encore confirmée : réessayez dans un instant.', ok); }
      catch (er) { dire(msg, er && er.code === 'lien-invalide' ? er.message : texteErreur(er)); }
    };
    body.append(el('p', { class: 'cpt-intro' }, COMPTE.message || 'Confirmez votre adresse e-mail.'),
      el('form', { class: 'cpt-form', onsubmit: (e) => { e.preventDefault(); confirmer(); } },
        field('Lien reçu par courriel (copiez-le : clic droit sur le lien, « Copier l\'adresse du lien »)', lien),
        el('div', { class: 'hwrow' }, el('button', { type: 'submit', class: 'btn primary', id: 'cpt-confirmer' }, 'Confirmer mon adresse'))),
      msg,
      el('div', { class: 'hwrow' },
        el('button', { type: 'button', class: 'btn', onclick: async () => { try { const ok = await relireSession(); dire(msg, ok ? 'Adresse confirmée. Ouverture du compte…' : 'Adresse pas encore confirmée : collez le lien ci-dessus.', ok); } catch (er) { dire(msg, texteErreur(er)); } } }, 'J\'ai ouvert le lien'),
        el('button', { type: 'button', class: 'btn', onclick: async () => { try { await renvoyerConfirmation(); dire(msg, 'Lien renvoyé.', true); } catch (er) { dire(msg, texteErreur(er)); } } }, 'Renvoyer le lien'),
        el('button', { type: 'button', class: 'btn', onclick: () => deconnecter() }, 'Se déconnecter')));
    setTimeout(() => /** @type {HTMLInputElement} */ (lien).focus(), 30);
  };
  // « mot de passe oublié » d'un professeur : le lien reçu et le nouveau mot de passe, dans l'application
  const drawNouveauMdp = (/** @type {string} */ email) => {
    const msg = msgBox();
    const lien = input({ id: 'cpt-lien-mdp', type: 'text', autocomplete: 'off', spellcheck: 'false' });
    const mdp = input({ id: 'cpt-nouveau-mdp', type: 'password', autocomplete: 'new-password' });
    body.append(el('p', { class: 'cpt-intro' }, `Un lien est parti à ${email}. Copiez-le (clic droit, « Copier l'adresse du lien »), collez-le ici et choisissez votre nouveau mot de passe.`),
      el('form', { class: 'cpt-form', onsubmit: async (e) => {
        e.preventDefault();
        const refus = motDePasseRefuse(/** @type {HTMLInputElement} */ (mdp).value); if (refus) { dire(msg, 'Mot de passe : ' + refus); return; }
        try { await nouveauMdpAvecLien(/** @type {HTMLInputElement} */ (lien).value, /** @type {HTMLInputElement} */ (mdp).value); await connecter(email, /** @type {HTMLInputElement} */ (mdp).value); dire(msg, 'Mot de passe changé. Connexion…', true); }
        catch (er) { dire(msg, er && er.code === 'lien-invalide' ? er.message : texteErreur(er)); }
      } }, field('Lien reçu par courriel', lien), field('Nouveau mot de passe (6 caractères au moins)', mdp), msg,
      el('div', { class: 'hwrow' }, el('button', { type: 'submit', class: 'btn primary' }, 'Changer le mot de passe'), el('button', { type: 'button', class: 'btn', onclick: () => draw('connexion') }, 'Retour'))));
  };
  draw(vue);
  modal.open('Se connecter', body, { width: 520 });
  CX.body = body; CX.draw = draw;
}
// la fenêtre de connexion ouverte : quand la session change, connecté, elle se referme ; sinon, elle se redessine
const CX = { body: /** @type {HTMLElement | null} */ (null), draw: /** @type {(v: string) => void} */ (() => {}) };
on('compte', () => {
  if (!CX.body || !CX.body.isConnected) { CX.body = null; return; }
  if (COMPTE.etat === 'connecte') { CX.body = null; modal.close(); toast(`Bonjour ${COMPTE.prenom || nomDuCompte()} : ta progression est enregistrée en ligne.`, 'good', 4500); }
  else if (COMPTE.etat === 'verifier' || COMPTE.etat === 'refuse') CX.draw('connexion');
});

// ---------------- la progression faite sans compte sur cet ordinateur (v19.27) ----------------
// Avant la v19.27, seule la section des Réglages d'un compte élève proposait de la reprendre : un professeur qui
// avait joué sans être connecté retrouvait un compte vide sur un autre ordinateur. À la connexion, élève ou
// professeur, la fenêtre le propose maintenant une fois par compte (réponse gardée sur cet ordinateur) ; le
// bouton reste dans Réglages → Mon compte.
const lecons = (p) => Object.values(p.cours || {}).filter((c) => c && c.quiz && c.quiz.total && c.quiz.score === c.quiz.total).length;
/** une progression qui contient quelque chose (leçons, exercices, missions, XP) */
export function progressionNonVide(p) {
  if (!p || typeof p !== 'object') return false;
  if (['cours', 'missions', 'tutor', 'camera', 'net', 'entrepot', 'niveaux'].some((k) => p[k] && typeof p[k] === 'object' && Object.keys(p[k]).length)) return true;
  return xpOf(p) > 0;
}
const resumeInvite = (p) => { const n = lecons(p), xp = xpOf(p); return [n ? `${n} leçon${n > 1 ? 's' : ''} acquise${n > 1 ? 's' : ''}` : '', `${xp} XP`].filter(Boolean).join(', '); };
const cleReprise = (uid) => 'carregie.reprise.' + uid;
const lireReprise = (uid) => { try { return localStorage.getItem(cleReprise(uid)); } catch (e) { return null; } };
const noterReprise = (uid, v) => { try { localStorage.setItem(cleReprise(uid), v); } catch (e) { /* stockage indisponible */ } };
/** reprend la progression de cet ordinateur dans le compte connecté, et l'envoie tout de suite en ligne */
async function reprendre(invite) {
  absorbProgress(invite);
  if (COMPTE_SH.uid) noterReprise(COMPTE_SH.uid, 'reprise');
  try { await saveProgressNow(); toast('Progression reprise dans ton compte et enregistrée en ligne : tu la retrouveras sur n\'importe quel ordinateur.', 'good', 5000); }
  catch (e) { toast('Progression reprise dans ton compte ; l\'envoi en ligne se refera au prochain enregistrement.', '', 5000); }
}
let proposee = '';
/** à la connexion : proposer de reprendre la progression faite sans compte (une fois par compte) */
export async function proposerReprise() {
  const uid = COMPTE_SH.uid;
  if (COMPTE.etat !== 'connecte' || !uid || proposee === uid || lireReprise(uid)) return;
  const invite = guestProgress();
  if (!progressionNonVide(invite)) return;
  proposee = uid;
  const ok = await ask(`Cet ordinateur garde une progression faite sans être connecté (${resumeInvite(invite)}). La reprendre dans ton compte pour la retrouver partout ? Elle s'ajoute à celle du compte, rien ne s'efface. À ne faire que si c'est bien la tienne.`, { title: 'Reprendre la progression de cet ordinateur ?', ok: 'La reprendre' });
  if (COMPTE_SH.uid !== uid) return;
  if (ok === true) await reprendre(invite); else noterReprise(uid, 'refusee');
}
on('compte', () => { if (COMPTE.etat === 'connecte') setTimeout(() => { proposerReprise(); }, 800); });

/** se déconnecter (au car, après confirmation : la partie continue sans compte) */
export async function seDeconnecter() {
  if (S.mode !== 'start' && !(await ask('La partie continue sans compte : ce que tu fais ensuite ne sera plus enregistré dans ton compte.', { title: 'Se déconnecter ?', ok: 'Se déconnecter' }))) return;
  // la progression du compte part en ligne avant de fermer la session (après, le serveur refuserait)
  try { await saveProgressNow(); } catch (e) { /* gardée dans ce navigateur */ }
  try { await deconnecter(); toast('Déconnecté : la progression de ton compte est enregistrée.', '', 4000); } catch (e) { toast(texteErreur(e), 'bad'); }
}

/** une phrase sur le compte : « Léa Martin · BTS 1 », « Pierre Malycha · professeur » */
const qui = () => [nomDuCompte(), estProf() ? 'professeur' : COMPTE.classeNom || ''].filter(Boolean).join(' · ');

/** la bande du compte sur l'écran titre (#ti-compte) */
export function renderTitleCompte() {
  const box = $('#ti-compte'); if (!box) return;
  box.hidden = !COMPTE.dispo || !COMPTE.pret;
  if (box.hidden) return;
  if (COMPTE.etat === 'connecte') {
    box.replaceChildren(...[icon('compte'), el('span', { class: 'cpt-qui' }, qui()),
      estProf() ? el('button', { type: 'button', class: 'btn small', id: 'ti-tableau', onclick: () => emit('tableauBord') }, icon('tableau'), 'Tableau de bord') : null,
      el('button', { type: 'button', class: 'btn small', id: 'ti-deco', onclick: () => seDeconnecter() }, 'Se déconnecter')].filter((x) => !!x));
  } else {
    box.replaceChildren(icon('compte'), el('span', { class: 'cpt-qui' }, COMPTE.etat === 'verifier' ? 'Adresse à confirmer' : 'Pas connecté : la progression reste sur cet ordinateur'),
      el('button', { type: 'button', class: 'btn small primary', id: 'ti-connexion', onclick: () => openConnexion() }, icon('connexion'), 'Se connecter'));
  }
}

/** la section « Mon compte » des Réglages */
export function compteSection() {
  const sec = el('section', { class: 'rg-sec', id: 'rg-compte' }, el('h3', {}, 'Mon compte'));
  if (!COMPTE.dispo) { sec.append(el('p', { class: 'note' }, 'Les comptes en ligne ne sont pas activés sur cette version : la progression reste dans ce navigateur (Ma progression, ci-dessous).')); return sec; }
  if (COMPTE.etat !== 'connecte') {
    sec.append(el('p', {}, 'Pas connecté : ta progression reste sur cet ordinateur.'),
      el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn primary', onclick: () => openConnexion() }, icon('connexion'), 'Se connecter')));
    return sec;
  }
  sec.append(el('p', { class: 'cpt-ligne' }, icon('compte'), el('b', {}, nomDuCompte()), el('span', {}, estProf() ? `professeur · ${COMPTE.email}` : `identifiant ${COMPTE.identifiant}${COMPTE.classeNom ? ' · ' + COMPTE.classeNom : ''}`)),
    el('p', { class: 'note' }, estProf() ? 'Profil Formateur imposé par votre compte. Vos classes, vos élèves et leurs résultats : le tableau de bord.' : 'Ta progression est enregistrée en ligne : tu la retrouves sur n\'importe quel ordinateur en te connectant. Ton professeur voit tes résultats.'));
  const row = el('div', { class: 'hwrow' });
  if (estProf()) row.append(el('button', { type: 'button', class: 'btn primary', id: 'rg-tableau', onclick: () => { modal.close(); emit('tableauBord'); } }, icon('tableau'), 'Tableau de bord des classes'));
  // la progression faite sans compte sur cet ordinateur : la reprendre dans son compte (une fois, sur demande)
  const invite = COMPTE_SH.uid ? guestProgress() : null;
  if (progressionNonVide(invite)) {
    row.append(el('button', { type: 'button', class: 'btn', id: 'rg-reprise', onclick: async () => {
      if (!(await ask(`La progression faite sans compte sur cet ordinateur (${resumeInvite(invite)}) s'ajoute à celle de ton compte (rien ne s'efface). À ne faire que si c'est bien la tienne.`, { title: 'Reprendre la progression de cet ordinateur ?', ok: 'La reprendre' }))) return;
      await reprendre(invite);
    } }, 'Reprendre la progression de cet ordinateur'));
  }
  row.append(el('button', { type: 'button', class: 'btn', id: 'rg-deco', onclick: () => { modal.close(); seDeconnecter(); } }, icon('deconnexion'), 'Se déconnecter'));
  sec.append(row);
  return sec;
}

on('compte', renderTitleCompte);
on('connexion', () => openConnexion());
