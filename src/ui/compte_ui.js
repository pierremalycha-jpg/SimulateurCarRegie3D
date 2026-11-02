// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { $, modal, toast, ask, field } from './common.js';
import { icon } from './icons.js';
import { COMPTE, estProf, estEleve, nomDuCompte } from '../comptes/session.js';
import { connecter, deconnecter, inscrireProf, renvoyerConfirmation, relireSession, mdpOublie, texteErreur } from '../comptes/firebase.js';
import { guestProgress, absorbProgress, saveProgressNow, COMPTE_SH } from '../shared.js';
import { motDePasseRefuse } from '../comptes/identifiants.js';

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
      try { await mdpOublie(v); dire(msg, `Un lien pour choisir un nouveau mot de passe est parti à ${v}.`, true); } catch (er) { dire(msg, texteErreur(er)); }
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
        catch (er) { dire(msg, texteErreur(er)); /** @type {HTMLButtonElement} */ (go).disabled = false; }
      } }, el('div', { class: 'grid2' }, field('Prénom', prenom), field('Nom', nom)), field('Adresse e-mail', email), field('Mot de passe (6 caractères au moins)', mdp), msg,
      el('div', { class: 'hwrow' }, go, el('button', { type: 'button', class: 'btn', onclick: () => draw('connexion') }, 'Retour'))));
  };
  const drawVerifier = () => {
    const msg = msgBox();
    body.append(el('p', { class: 'cpt-intro' }, COMPTE.message || 'Confirmez votre adresse e-mail.'), msg,
      el('div', { class: 'hwrow' },
        el('button', { type: 'button', class: 'btn primary', onclick: async () => { try { await relireSession(); dire(msg, 'Vérification…', true); } catch (er) { dire(msg, texteErreur(er)); } } }, 'J\'ai confirmé mon adresse'),
        el('button', { type: 'button', class: 'btn', onclick: async () => { try { await renvoyerConfirmation(); dire(msg, 'Lien renvoyé.', true); } catch (er) { dire(msg, texteErreur(er)); } } }, 'Renvoyer le lien'),
        el('button', { type: 'button', class: 'btn', onclick: () => deconnecter() }, 'Se déconnecter')));
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
  const invite = estEleve() && COMPTE_SH.uid ? guestProgress() : null;
  if (invite && (Object.keys(invite.cours || {}).length || Object.keys(invite.missions || {}).length || Object.keys(invite.tutor || {}).length)) {
    row.append(el('button', { type: 'button', class: 'btn', onclick: async () => {
      if (!(await ask('La progression faite sans compte sur cet ordinateur s\'ajoute à celle de ton compte (rien ne s\'efface). À ne faire que si c\'est bien la tienne.', { title: 'Reprendre la progression de cet ordinateur ?', ok: 'La reprendre' }))) return;
      absorbProgress(invite); toast('Progression reprise dans ton compte.', 'good');
    } }, 'Reprendre la progression de cet ordinateur'));
  }
  row.append(el('button', { type: 'button', class: 'btn', id: 'rg-deco', onclick: () => { modal.close(); seDeconnecter(); } }, icon('deconnexion'), 'Se déconnecter'));
  sec.append(row);
  return sec;
}

on('compte', renderTitleCompte);
on('connexion', () => openConnexion());
