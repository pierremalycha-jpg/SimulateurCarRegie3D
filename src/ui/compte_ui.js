// @ts-check
import { on, emit } from '../state.js';
import { el } from '../util.js';
import { modal, toast, ask } from './common.js';
import { icon } from './icons.js';
import { isTrainer } from '../app/profile.js';
import { SAVE } from '../shared.js';
import { COMPTE, compteDisponible, connecte, creerCompte, seConnecter, seDeconnecter, motDePasseOublie, synchroniser, supprimerCompte, initCompte } from '../compte/index.js';
import { lireConfig, poserConfig, configLocale, configFirebase } from '../compte/config.js';
import { profil } from '../game/pass.js';

// ----------------------------------------------------------------------------------
// « Mon compte » (v19.25) : se connecter, créer un compte, se déconnecter, synchroniser. Une fenêtre,
// ouverte depuis Réglages → Mon compte, le profil (onglet Mon profil) et le classement. La section des
// Réglages résume l'état en une ligne. Sans projet Firebase, la fenêtre le dit (et le formateur peut y
// coller la configuration de son projet pour cet ordinateur).
// ----------------------------------------------------------------------------------
/** remplace le contenu (les morceaux absents, null, sont laissés de côté : replaceChildren écrirait « null ») */
const poser = (box, ...kids) => box.replaceChildren(...kids.filter((k) => k != null && k !== false));
const champ = (label, input) => el('label', { class: 'cp-champ' }, el('span', {}, label), input);

/** l'état du compte en une phrase */
export function etatCompte() {
  if (COMPTE.etat === 'indisponible') return { ok: false, text: 'Compte en ligne non configuré sur ce simulateur : la progression reste sur cet ordinateur.' };
  if (COMPTE.etat === 'connexion') return { ok: true, text: 'Connexion au compte…' };
  if (COMPTE.etat === 'deconnecte') return { ok: false, text: 'Pas connecté : connectez-vous pour retrouver votre progression sur n\'importe quel ordinateur.' };
  if (SAVE.remote === false) return { ok: false, text: `Connecté (${COMPTE.email}), mais l'enregistrement en ligne a échoué : nouvel essai au prochain enregistrement.` };
  return { ok: true, text: `Connecté : ${COMPTE.email}. Votre progression est enregistrée dans votre compte.` };
}

function formulaire(box) {
  let mode = 'connexion';
  const msg = el('p', { class: 'note cp-msg', role: 'status', 'aria-live': 'polite' });
  const email = /** @type {HTMLInputElement} */ (el('input', { type: 'email', id: 'cp-email', autocomplete: 'email', required: true, placeholder: 'prenom.nom@exemple.fr' }));
  const mdp = /** @type {HTMLInputElement} */ (el('input', { type: 'password', id: 'cp-mdp', autocomplete: 'current-password', required: true, minlength: '6' }));
  const pseudo = /** @type {HTMLInputElement} */ (el('input', { type: 'text', id: 'cp-pseudo', autocomplete: 'nickname', maxlength: '20', placeholder: 'Ton nom au classement', value: profil().pseudo }));
  const rowPseudo = champ('Pseudo (affiché au classement)', pseudo);
  const go = /** @type {HTMLButtonElement} */ (el('button', { type: 'submit', class: 'btn primary', id: 'cp-go' }, icon('connexion'), 'Se connecter'));
  const oubli = el('button', { type: 'button', class: 'linkbtn', id: 'cp-oubli', onclick: async () => {
    if (!email.value) { msg.textContent = 'Écrivez d\'abord votre adresse, puis « Mot de passe oublié ».'; email.focus(); return; }
    const r = await motDePasseOublie(email.value);
    msg.textContent = r.ok ? `Un mail pour choisir un nouveau mot de passe est parti vers ${email.value}.` : r.error;
  } }, 'Mot de passe oublié ?');
  const modes = el('div', { class: 'seg', role: 'group', 'aria-label': 'Connexion ou création de compte' });
  const setMode = (m) => {
    mode = m;
    for (const b of modes.children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.v === m));
    rowPseudo.hidden = m !== 'creer'; oubli.hidden = m === 'creer';
    mdp.autocomplete = m === 'creer' ? 'new-password' : 'current-password';
    go.replaceChildren(icon('connexion'), m === 'creer' ? 'Créer mon compte' : 'Se connecter');
    msg.textContent = '';
  };
  modes.append(
    el('button', { type: 'button', 'data-v': 'connexion', onclick: () => setMode('connexion') }, 'J\'ai un compte'),
    el('button', { type: 'button', 'data-v': 'creer', id: 'cp-mode-creer', onclick: () => setMode('creer') }, 'Créer un compte'));
  const form = el('form', { class: 'cp-form', novalidate: true },
    modes, champ('Adresse électronique', email), champ('Mot de passe (6 caractères au moins)', mdp), rowPseudo,
    el('div', { class: 'hwrow' }, go, oubli), msg,
    el('p', { class: 'note' }, 'La progression déjà faite sur cet ordinateur est ajoutée à votre compte : rien ne se perd. Sur un ordinateur partagé, pensez à vous déconnecter en partant.'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!email.value || mdp.value.length < 6) { msg.textContent = 'Il faut l\'adresse et un mot de passe de 6 caractères au moins.'; return; }
    go.disabled = true; msg.textContent = mode === 'creer' ? 'Création du compte…' : 'Connexion…';
    const r = mode === 'creer' ? await creerCompte(email.value, mdp.value, pseudo.value) : await seConnecter(email.value, mdp.value);
    go.disabled = false;
    if (!r.ok) { msg.textContent = r.error || 'Échec.'; return; }
    toast(mode === 'creer' ? 'Compte créé : ta progression est enregistrée en ligne' : 'Connecté : progression retrouvée', 'good', 4000);
    dessiner(box);
  });
  setMode('connexion');
  return form;
}

function connecteVue(box) {
  const e = etatCompte();
  const msg = el('p', { class: 'note cp-msg', role: 'status', 'aria-live': 'polite' });
  return el('div', { class: 'cp-in' },
    el('p', { class: 'mp-state ' + (e.ok ? 'ok' : 'err') }, icon(e.ok ? 'nuage' : 'alarme'), e.text),
    COMPTE.erreur ? el('p', { class: 'note' }, COMPTE.erreur) : null,
    el('div', { class: 'hwrow' },
      el('button', { type: 'button', class: 'btn primary', id: 'cp-profil', onclick: () => { modal.close(); emit('profil', { tab: 'profil' }); } }, icon('profil'), 'Mon profil'),
      el('button', { type: 'button', class: 'btn', id: 'cp-sync', onclick: async () => { msg.textContent = 'Synchronisation…'; const r = await synchroniser(); msg.textContent = r.ok ? 'Progression et profil enregistrés en ligne.' : r.error; } }, icon('nuage'), 'Synchroniser maintenant'),
      el('button', { type: 'button', class: 'btn', id: 'cp-out', onclick: async () => {
        if (!(await ask('Se déconnecter ? Votre progression est enregistrée dans votre compte, puis retirée de cet ordinateur.', { ok: 'Se déconnecter' }))) return;
        await seDeconnecter(); toast('Déconnecté', '', 2500); dessiner(box);
      } }, icon('deconnexion'), 'Se déconnecter')),
    msg,
    el('details', { class: 'cp-danger' }, el('summary', {}, 'Supprimer mon compte'),
      el('p', { class: 'note' }, 'Efface le compte, sa progression en ligne et son profil public. La progression reste sur cet ordinateur (Réglages → Ma progression pour l\'exporter ou l\'effacer).'),
      el('button', { type: 'button', class: 'btn danger', onclick: async () => {
        if (!(await ask('Supprimer définitivement votre compte en ligne ?', { ok: 'Supprimer le compte', danger: true }))) return;
        const r = await supprimerCompte(); msg.textContent = r.ok ? 'Compte supprimé.' : r.error; if (r.ok) dessiner(box);
      } }, 'Supprimer définitivement')));
}

// sans projet Firebase : l'explication, et pour le formateur, la configuration de son projet sur cet ordinateur
function indisponibleVue(box) {
  const out = el('div', { class: 'cp-off' },
    el('p', { class: 'mp-state err' }, icon('horsnuage'), 'Ce simulateur n\'a pas de compte en ligne configuré : la progression reste sur cet ordinateur (Réglages → Ma progression pour l\'exporter).'));
  if (isTrainer()) {
    const ta = /** @type {HTMLTextAreaElement} */ (el('textarea', { id: 'cp-config', rows: '5', spellcheck: 'false', placeholder: '{ "apiKey": "…", "projectId": "…" }  ou l\'objet firebaseConfig de la console Firebase' }));
    const m = el('p', { class: 'note cp-msg', role: 'status' });
    out.append(el('details', { class: 'cp-cfg' }, el('summary', {}, 'Formateur : brancher un projet Firebase sur cet ordinateur'),
      el('p', { class: 'note' }, 'Collez la configuration web de votre projet (console Firebase → Paramètres du projet → Vos applications). Pour tous les ordinateurs, elle se met plutôt dans firebase.web.json avant la construction (README).'),
      ta, el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn primary', onclick: async () => {
        const c = lireConfig(ta.value); if (!c) { m.textContent = 'Configuration illisible : il faut au moins apiKey et projectId.'; return; }
        poserConfig(c); await initCompte(); dessiner(box);
      } }, 'Brancher ce projet')), m));
  }
  return out;
}

function dessiner(box) {
  poser(box, 
    COMPTE.etat === 'indisponible' ? indisponibleVue(box) : connecte() ? connecteVue(box) : formulaire(box),
    isTrainer() && configLocale() ? el('p', { class: 'note' }, `Projet Firebase de cet ordinateur : ${(configFirebase() || { projectId: '' }).projectId}. `,
      el('button', { type: 'button', class: 'linkbtn', onclick: async () => { poserConfig(null); await initCompte(); dessiner(box); } }, 'Le retirer')) : null);
}
/** la fenêtre « Mon compte » */
export function openCompte() {
  const box = el('div', { class: 'cp' });
  dessiner(box);
  modal.open('Mon compte', box, { width: 560 });
  const f = /** @type {HTMLInputElement | null} */ (box.querySelector('#cp-email'));
  if (f && !matchMedia('(pointer: coarse)').matches) f.focus();
}
on('compteOuvrir', () => openCompte());

const SEC = { paint: () => {} };
on('compte', () => SEC.paint()); on('progressSave', () => SEC.paint());
/** la section des Réglages */
export function compteSection() {
  const st = el('p', { class: 'mp-state', role: 'status' });
  const btn = el('button', { type: 'button', class: 'btn primary', id: 'rg-compte', onclick: () => openCompte() });
  const paint = () => {
    const e = etatCompte(); st.className = 'mp-state ' + (e.ok ? 'ok' : 'err'); st.replaceChildren(icon(e.ok ? 'nuage' : 'horsnuage'), e.text);
    btn.replaceChildren(icon(connecte() ? 'profil' : 'connexion'), connecte() ? 'Gérer mon compte' : compteDisponible() ? 'Se connecter ou créer un compte' : 'En savoir plus');
  };
  paint();
  const sec = el('section', { class: 'rg-sec', id: 'rg-compte-sec' }, el('h3', {}, 'Mon compte'), st,
    el('div', { class: 'hwrow' }, btn, el('button', { type: 'button', class: 'btn', onclick: () => { modal.close(); emit('profil', { tab: 'profil' }); } }, icon('profil'), 'Profil, pass et classement')));
  // une seule fois pour toutes les fenêtres : la section affichée (s'il y en a une) se redessine
  SEC.paint = paint;
  return sec;
}
