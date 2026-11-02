// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { $, modal, selectEl, field } from './common.js';
import { icon } from './icons.js';
import { LIGHTING } from '../data/exposure.js';
import { CONTROLS_HELP } from '../content/controls.js';
import { AU, startAudio, applyFaders, volume, setVolume } from '../audio.js';
import { APP_VERSION } from '../diag.js';
import { PROFILE, setRole } from '../app/profile.js';
import { openTrainer } from './config.js';
import { openReview } from './review_ui.js';
import { openDiag } from './diag_ui.js';
import { openReport } from './report.js';
import { JEU, saveJeu, setSfxVolume, sfx } from '../game/sfx.js';
import { setQuestVisible } from '../game/quest.js';
import { progressionSection } from './ma_progression.js';
import { STYLE } from '../style.js';

// ----------------------------------------------------------------------------------
// Réglages : une seule fenêtre, la même depuis l'écran titre, l'écran Jouer et le menu du car.
// Sur cet ordinateur (qualité, son), la partie en cours (lumière, affichage…), ma progression
// (enregistrement, export, import, effacement, données personnelles), le profil, l'espace formateur
// (profil Formateur), l'aide (commandes, diagnostic) et « À propos ».
// ----------------------------------------------------------------------------------
// une rangée de touches à bascule (une seule allumée)
function seg(label, options, value, onChange) {
  const box = el('div', { class: 'seg', role: 'group', 'aria-label': label });
  const set = (v) => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); onChange(v); };
  for (const [v, text, title] of options) box.append(el('button', { type: 'button', 'data-v': v, title: title || text, 'aria-pressed': String(v === value), onclick: () => set(v) }, text));
  return box;
}
// avant la partie, les réglages de l'ordinateur vont aussi aux sélecteurs de l'écran Jouer (start.js)
const startValue = (id, fallback) => { const s = /** @type {any} */ ($('#' + id)); return s && s.value != null ? String(s.value) : fallback; };
const setStart = (id, v) => { const s = /** @type {any} */ ($('#' + id)); if (s) s.value = v; };
const section = (title, ...kids) => el('section', { class: 'rg-sec' }, el('h3', {}, title), ...kids);
const row = (label, ctl) => el('div', { class: 'rg-row' }, el('span', {}, label), ctl);

export function openSettings() {
  const inGame = S.mode !== 'start';
  let q = inGame ? S.quality : startValue('stqual', 'basse');
  if (!inGame) { try { q = localStorage.getItem('carregie.quality') || q; } catch (e) { /* stockage indisponible */ } }
  const soundOn = inGame ? !AU.muted : startValue('stsnd', '1') === '1';
  const body = el('div', { class: 'rg' },
    section('Sur cet ordinateur',
      row('Qualité graphique', seg('Qualité graphique', [['basse', 'Basse', 'Ordinateur portable'], ['moyenne', 'Moyenne'], ['haute', 'Haute', 'Carte graphique dédiée']], q, (v) => {
        try { localStorage.setItem('carregie.quality', v); } catch (e) { /* stockage indisponible */ }
        if (inGame) emit('setQuality', v); else setStart('stqual', v);
      })),
      row('Style graphique', seg('Style graphique', [['dessin', 'Dessin', 'Cel shading : aplats de lumière, contours à l\'encre (par défaut)'], ['realiste', 'Réaliste', 'Lumière en dégradé, sans contours']], STYLE.cel ? 'dessin' : 'realiste', (v) => {
        emit('setStyle', v === 'dessin'); // main.js : morceaux de shader, type d'ombre et matières des scènes ensemble
      })),
      row('Son', seg('Son', [['1', 'Activé'], ['0', 'Coupé']], soundOn ? '1' : '0', (v) => {
        if (inGame) { startAudio(); AU.muted = v !== '1'; applyFaders(); emit('soundToggle'); } else setStart('stsnd', v);
      })),
      row('Volume du son', (() => { const r = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(volume()), 'aria-label': 'Volume du son' }); r.addEventListener('input', () => setVolume(+r.value)); return r; })()),
      el('p', { class: 'note' }, 'Basse convient aux ordinateurs portables ; Haute demande une carte graphique dédiée. Le style Dessin (cel shading) ne coûte presque rien ; ses contours à l\'encre s\'affichent en qualité Moyenne et Haute. Le son dépend de l\'endroit : la foule dans le stade (lointaine derrière les tribunes, là où est garé le car), l\'écoute de la console au poste son, presque rien ailleurs dans le car. Les commentaires du match s\'affichent en texte au poste son.')),
    section('Jeu',
      row('Bruitages', seg('Bruitages', [['1', 'Activés'], ['0', 'Coupés']], JEU.sfx ? '1' : '0', (v) => { JEU.sfx = v === '1'; saveJeu(); if (JEU.sfx) sfx('confirm'); })),
      row('Volume des bruitages', (() => { const r = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(JEU.volume), 'aria-label': 'Volume des bruitages' }); r.addEventListener('input', () => setSfxVolume(+r.value)); r.addEventListener('change', () => sfx('confirm')); return r; })()),
      row('Objectif à l\'écran', seg('Objectif à l\'écran', [['1', 'Affiché'], ['0', 'Masqué']], JEU.quest ? '1' : '0', (v) => { setQuestVisible(v === '1'); saveJeu(); })),
      row('Repère 3D de l\'objectif', seg('Repère 3D', [['1', 'Affiché'], ['0', 'Masqué']], JEU.marker ? '1' : '0', (v) => { JEU.marker = v === '1'; saveJeu(); })),
      row('Mini-plan du car', seg('Mini-plan du car', [['0', 'Masqué'], ['1', 'Affiché']], JEU.minimap ? '1' : '0', (v) => { JEU.minimap = v === '1'; saveJeu(); })),
      el('p', { class: 'note' }, 'Les bruitages de l\'interface sont indépendants du son du car (foule, console son). L\'objectif en cours s\'affiche en haut à gauche ; le journal des missions s\'ouvre avec L. Le mini-plan du car est masqué par défaut : le pupitre (Tab) a le plan complet.')),
    inGame ? section('La partie en cours',
      el('div', { class: 'grid2' },
        field('Lumière', selectEl(Object.entries(LIGHTING).map(([k, v]) => [k, v.label]), S.lighting, (v) => emit('setLighting', v))),
        field('Éclairage de nuit', selectEl([['led', 'LED « flicker-free »'], ['halide', 'Iodures métalliques 50 Hz (scintillement en super ralenti)']], S.flickerLamps ? 'halide' : 'led', (v) => { S.flickerLamps = v === 'halide'; })),
        field('Voix du réalisateur virtuel', selectEl([['0', 'Texte seulement'], ['1', 'Synthèse vocale']], S.directorVoice ? '1' : '0', (v) => { S.directorVoice = v === '1'; })),
        field('Étiquettes et câbles dans le stade', selectEl([['1', 'Afficher'], ['0', 'Masquer']], S.showLabels ? '1' : '0', (v) => emit('setLabels', v === '1')))),
      el('p', { class: 'note' }, (LIGHTING[S.lighting] || {}).desc || '')) : null,
    progressionSection(),
    section('Profil',
      row('Je suis', seg('Profil', [['etudiant', 'Étudiant'], ['formateur', 'Formateur', 'Ajoute l\'espace formateur à ces réglages']], PROFILE.role, (v) => setRole(v))),
      el('p', { class: 'note' }, 'Le profil Formateur ajoute ci-dessous l\'espace formateur : configuration du car, suivi des stagiaires, relecture technique.')),
    el('section', { class: 'rg-sec role-only' }, el('h3', {}, 'Espace formateur'),
      el('div', { class: 'hwrow' },
        el('button', { type: 'button', class: 'btn primary', id: 'rg-trainer', onclick: () => openTrainer('car') }, icon('formateur'), 'Configuration du car'),
        el('button', { type: 'button', class: 'btn', onclick: () => openTrainer('eleves') }, 'Suivi des stagiaires'),
        el('button', { type: 'button', class: 'btn', onclick: () => openReview('me') }, 'Relecture technique')),
      el('p', { class: 'note' }, 'Les pannes se déclenchent au poste Chef de car du car régie (onglet Simulateur de pannes), ou pour toute l\'équipe depuis la partie en coopération.')),
    section('Aide',
      el('details', { class: 'rg-keys' }, el('summary', {}, 'Toutes les commandes du clavier'),
        el('div', { class: 'keys' }, ...CONTROLS_HELP.map(([k, d]) => el('div', {}, el('kbd', {}, k), el('span', {}, d))))),
      el('div', { class: 'hwrow' },
        el('button', { type: 'button', class: 'btn', onclick: () => openDiag() }, icon('diagnostic'), 'Diagnostic technique'),
        inGame ? el('button', { type: 'button', class: 'btn', id: 'perfbtn', onclick: () => emit('perfTest') }, 'Tester les performances') : null,
        el('button', { type: 'button', class: 'btn', onclick: () => openReport('Simulateur (général)') }, 'Signaler une erreur'))),
    section('À propos',
      el('p', {}, el('b', {}, 'TIEE Simulator'), ` version ${APP_VERSION}. Réalisé par le BTS Audiovisuel de Saint-Quentin (lycée Henri-Martin), pour l'option Techniques d'ingénierie et exploitation des équipements. Développé par Pierre MALYCHA.`),
      el('p', { class: 'note' }, 'Moteur 3D : three.js (licence MIT). Polices : Archivo, Archivo Narrow, B612 Mono, Barlow, JetBrains Mono, intégrées à la page (licence SIL OFL). Icônes : Phosphor (licence MIT).'),
      el('p', { class: 'note' }, 'Simulation non officielle, sans lien avec les clubs ni avec les constructeurs cités. Joueurs fictifs, clubs sans blason. Les caractéristiques techniques sont des ordres de grandeur réalistes, donnés à titre pédagogique.')));
  modal.open('Réglages', body, { width: 820 });
}
on('settings', () => openSettings());
