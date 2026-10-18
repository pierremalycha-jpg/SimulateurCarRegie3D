// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { CONTROLS_HELP } from '../content/controls.js';
import { LIGHTING } from '../data/exposure.js';
import { FORMATS } from '../data/cameras.js';
import { applyLighting, paintTruckSign } from '../world.js';
import { loadPreset, PRESETS } from '../bcam.js';
import { MIX, defaultRouting } from '../pipeline.js';
import { AU, startAudio, applyFaders } from '../audio.js';
import { patchEmpty } from '../patch.js';
import { EQUIP, evsLayout, mixInputs } from '../equip.js';
import { CFG } from '../shared.js';
import { SES } from '../multi/session.js';
import { lanAvailable } from '../multi/lan.js';
import { openSessionPanel, setSessionStarter } from '../ui/session_ui.js';
import { openReview } from '../ui/review_ui.js';
import { openTrainer } from '../ui/config.js';
import { $, toast } from '../ui/common.js';
import { setQuality } from './view.js';
import { buildToolbar } from './hud.js';
import { setupTouch } from './input.js';

// ----------------------------------------------------------------------------------
// Écran d'accueil (« feuille de service ») et lancement d'une partie.
// ----------------------------------------------------------------------------------
export function buildStart() {
  const s = $('#start');
  const light = el('select', { id: 'stlight' }, ...Object.entries(LIGHTING).map(([k, v]) => el('option', { value: k }, v.label)));
  const qual = el('select', { id: 'stqual' }, el('option', { value: 'basse' }, 'Basse (ordinateur portable)'), el('option', { value: 'moyenne' }, 'Moyenne'), el('option', { value: 'haute' }, 'Haute (carte graphique dédiée)'));
  qual.value = S.quality;
  const snd = el('input', { type: 'checkbox', id: 'stsnd' }); snd.checked = true;
  const fmt = el('select', { id: 'stfmt' }, ...Object.entries(FORMATS).map(([k, v]) => el('option', { value: k }, v.label)));
  fmt.value = S.format;
  const infra = el('select', { id: 'stinfra' }, el('option', { value: 'sdi' }, 'Car SDI (grille coaxiale)'), el('option', { value: 'ip' }, 'Car IP (ST 2110, PTP, NMOS)'));
  const fmtNote = el('p', { class: 'note' });
  const updFmt = () => { S.format = fmt.value; paintTruckSign(CFG.car.name); fmtNote.textContent = `Avec ce format : ${evsLayout().label} ; mélangeur ${EQUIP.mixer} avec ${mixInputs()} entrées utilisées.`; };
  fmt.onchange = updFmt; updFmt();
  const go = (preset) => start(preset, light.value, qual.value, snd.checked, fmt.value, infra.value === 'ip');
  // session à plusieurs : on démarre le car prêt à l'antenne, avec les réglages de l'hôte s'il y en a déjà un
  setSessionStarter({
    cfg: () => ({ fmt: fmt.value, ip: infra.value === 'ip', light: light.value }),
    start: async () => {
      for (let i = 0; i < 25 && !(SES.hostPeer && !SES.hostPeer.sameTab && SES.hostPeer.presence.cfg); i++) await new Promise((r) => setTimeout(r, 120));
      const h = SES.hostPeer && !SES.hostPeer.sameTab && SES.hostPeer.presence.cfg;
      start('standard', h ? h.light : light.value, qual.value, snd.checked, h ? h.fmt : fmt.value, h ? !!h.ip : infra.value === 'ip');
    },
  });
  const truckLine = el('div', { class: 'cs-truck', id: 'sttruck' });
  const setTruck = () => { truckLine.textContent = [CFG.car.company, CFG.car.name].filter(Boolean).join(' · '); truckLine.hidden = !truckLine.textContent; updFmt(); };
  setTruck(); on('config', setTruck); on('shared', setTruck);
  // la journée d'un car régie : chaque mode du simulateur se place à son heure
  const slot = (time, phase, title, desc, label, preset, primary) => el('li', { class: 'cs-slot' + (primary ? ' main' : '') },
    el('time', {}, time),
    el('div', { class: 'cs-what' }, el('small', {}, phase), el('b', {}, title), el('span', {}, desc)),
    el('button', { class: 'btn' + (primary ? ' primary' : ''), onclick: () => go(preset) }, label));
  const field = (id, label, ctl) => el('div', { class: 'field' }, el('label', { for: id }, label), ctl);
  s.append(el('div', { class: 'callsheet' },
    el('header', { class: 'cs-head' },
      el('div', { class: 'cs-title' },
        el('span', { class: 'tape' }, 'Feuille de service'),
        el('h1', {}, 'Car régie 3D'),
        el('p', { class: 'lede' }, 'Simulateur de formation aux métiers du car régie. Un match se joue en continu dans un stade inspiré de Bollaert-Delelis : tout ce que vous réglez se voit à l\'image, chaque action est expliquée.')),
      el('dl', { class: 'cs-match' },
        el('dt', {}, 'Rencontre'), el('dd', {}, 'RC Lens – AS Rivière'),
        el('dt', {}, 'Lieu'), el('dd', {}, 'Stade Bollaert-Delelis (reconstitution)'),
        el('dt', {}, 'Antenne'), el('dd', {}, '20:45 · coup d\'envoi 21:00'),
        el('dt', {}, 'Chaîne du signal'), el('dd', { class: 'cs-chain' }, 'objectif → caméra → liaison → CCU → grille → mélangeur → antenne'),
        truckLine)),
    el('div', { class: 'cs-grid' },
      el('section', { class: 'cs-day', 'aria-labelledby': 'cs-day-h' },
        el('h2', { id: 'cs-day-h' }, 'Choisissez votre vacation'),
        el('ol', { class: 'cs-slots' },
          slot('08:00', 'Get-in', 'Installation pas à pas', 'Stade vide et missions guidées : placer les caméras, les câbler, les régler, puis réaliser.', 'Installer', 'vierge'),
          slot('09:30', 'Préparation caméras', 'Atelier de montage', 'Monter une caméra pièce par pièce : pied, tête fluide, adaptateur, objectif, viseur, commandes de zoom et de point, fibre.', 'Monter une caméra', 'atelier'),
          slot('11:00', 'Câblage', 'Le car vide', 'Rien n\'est brassé : reliez chaque source à la grille, les sorties aux destinations et la référence aux CCU, liste de câblage en main.', 'Brasser le car', 'brassage'),
          slot('17:30', 'Line-up · test de ligne', 'Jour de match', 'Brassage, line-up, test de ligne avec la chaîne, puis le direct avec des pannes. Chronométré, noté, avec un compte rendu.', 'Lancer le scénario', 'scenario'),
          slot('20:45', 'Antenne', 'Car prêt à l\'antenne', '12 caméras installées et réglées, 2 super ralentis, une Steadicam HF et une mini-caméra de but. Pour découvrir les postes.', 'Prendre l\'antenne', 'standard', true),
          slot('20:45', 'Antenne · grand dispositif', 'Grand match, 16 caméras', 'Caméra volante, rail, grue, super ralenti, deux Steadicam HF. Demande un ordinateur puissant.', 'Grand dispositif', 'grand'))),
      el('aside', { class: 'cs-side' },
        el('section', { class: 'cs-box' },
          el('h2', {}, 'Conditions de captation'),
          el('div', { class: 'cs-fields' },
            field('stlight', 'Lumière', light), field('stfmt', 'Format de production', fmt),
            field('stinfra', 'Infrastructure', infra), field('stqual', 'Qualité graphique', qual)),
          el('label', { class: 'cs-check', for: 'stsnd' }, snd, el('span', {}, 'Son : ambiance, frappes, sifflet, commentaires')),
          fmtNote),
        el('section', { class: 'cs-box' + (lanAvailable() ? ' cs-lan' : '') },
          el('h2', {}, 'Équipe et formation'),
          lanAvailable() ? el('p', { class: 'note' }, el('b', {}, 'Réseau local. '), 'Hébergez une partie ou rejoignez celle d\'un collègue : chacun choisit un pseudo et un rôle dans la prestation.') : null,
          el('button', { class: 'btn primary', title: 'Plusieurs joueurs dans le même car, en direct : chacun son pseudo et son rôle', onclick: () => openSessionPanel() }, 'Jouer à plusieurs'),
          el('div', { class: 'cs-row' },
            el('button', { class: 'btn', onclick: () => openTrainer('car') }, 'Espace formateur'),
            el('button', { class: 'btn', title: 'Pour les experts métier : valider ou corriger chaque point technique du simulateur', onclick: () => openReview('me') }, 'Relecture technique (experts)'))),
        el('details', { class: 'cs-box cs-keys' },
          el('summary', {}, 'Commandes clavier'),
          el('div', { class: 'keys' }, ...CONTROLS_HELP.map(([k, d]) => el('div', {}, el('kbd', {}, k), el('span', {}, d))))))),
    el('p', { class: 'note cs-foot' }, 'Simulation non officielle, sans lien avec le club ni avec les constructeurs cités. Les caractéristiques techniques (objectifs, portées de câbles, seuils HF, niveaux vidéo et audio) sont des ordres de grandeur réalistes, donnés à titre pédagogique ; les noms d\'équipements sont des exemples de matériel courant.')));
}

export function start(preset, light, quality, sound, format = S.format, ip = false) {
  if (quality !== S.quality) setQuality(quality);
  S.format = format; S.ipMode = !!ip; paintTruckSign(CFG.car.name);
  applyLighting(light);
  if (preset === 'vierge') { loadPreset('none'); S.autoLineup = false; S.showMission = true; }
  else if (preset === 'brassage' || preset === 'scenario') { loadPreset('standard', preset !== 'scenario'); S.showMission = false; }
  else if (preset === 'atelier') { loadPreset('standard', true); S.showMission = false; }
  else if (preset === 'standard' && Array.isArray(CFG.car.camPreset) && CFG.car.camPreset.length) { PRESETS.car = CFG.car.camPreset; loadPreset('car', true); S.showMission = false; }
  else { loadPreset(preset, true); S.showMission = false; }
  defaultRouting(true);
  if (preset === 'brassage' || preset === 'scenario') { S.patch.on = true; patchEmpty(); }
  MIX.pgm = 1; MIX.pst = 2;
  if (preset === 'atelier') { MIX.pgm = 2; MIX.pst = 3; } // la 1 est démontée : l'antenne reste sur la 2
  if (preset !== 'vierge') { MIX.dsk1.on = true; MIX.dsk1.level = 1; }
  $('#start').hidden = true; $('#hud').hidden = false;
  S.mode = 'fps';
  if (sound) startAudio(); else { startAudio(); AU.muted = true; applyFaders(); }
  buildToolbar();
  if (preset === 'brassage') { emit('openStationNow', { id: 'brassage' }); toast('Car vide : brassez chaque liaison en suivant la liste de câblage. Le multiview montre le résultat.', '', 7000); }
  else if (preset === 'scenario') emit('startScenario');
  else if (preset === 'atelier') emit('startAtelier');
  else if (preset === 'vierge') toast('Commencez par la mission en haut à gauche : découvrez le compound puis ouvrez le plan des caméras (P).', '', 6000);
  else toast('Vous êtes dans le compound, devant le car régie. Cliquez dans la vue pour regarder, avancez avec Z Q S D.', '', 6000);
  if (matchMedia('(pointer: coarse)').matches) setupTouch();
  showOnboarding();
}

// première prise en main : les six gestes de base, affichés une fois (mémorisé dans ce navigateur)
function showOnboarding() {
  let seen = false; try { seen = localStorage.getItem('carregie.onboard') === '1'; } catch (e) { /* stockage indisponible */ }
  if (seen || $('#onboard')) return;
  const touch = matchMedia('(pointer: coarse)').matches;
  const rows = touch
    ? [['Pouce gauche', 'se déplacer'], ['Glisser', 'regarder'], ['Bouton action', 'utiliser ce que vous visez'], ['Aller à', 'se téléporter devant un poste']]
    : [['Z Q S D', 'se déplacer (flèches aussi)'], ['Souris', 'regarder : cliquez d\'abord dans la vue'], ['E', 'utiliser ce que vous visez'], ['T', 'aller directement à un endroit'], ['1 – 9', 'commuter une caméra à l\'antenne'], ['G', 'guide, missions et glossaire']];
  const close = () => { box.remove(); try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* stockage indisponible */ } };
  const box = el('div', { id: 'onboard', role: 'dialog', 'aria-label': 'Prise en main' },
    el('span', { class: 'tape' }, 'Prise en main'),
    el('ul', {}, ...rows.map(([k, d]) => el('li', {}, el('kbd', {}, k), el('span', {}, d)))),
    el('button', { class: 'btn small primary', onclick: close }, 'Compris'));
  $('#hud').appendChild(box);
}
