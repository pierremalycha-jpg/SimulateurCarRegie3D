// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { CONTROLS_HELP, FIRST_STEPS, FIRST_STEPS_TOUCH } from '../content/controls.js';
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
import { openDiag } from '../ui/diag_ui.js';
import { APP_VERSION } from '../diag.js';
import { $, toast, modal } from '../ui/common.js';
import { setQuality } from './view.js';
import { buildToolbar } from './hud.js';
import { setupTouch } from './input.js';
import { icon } from '../ui/icons.js';
import { LIEUX } from '../content/lieux.js';
import { showTitle } from './title.js';

// ----------------------------------------------------------------------------------
// Écran d'accueil (« feuille de service ») et lancement d'une partie.
// ----------------------------------------------------------------------------------
// sélecteur à touches (une seule allumée), qui se lit et se règle comme un <select> : .value
function selector(id, label, options, value, onChange) {
  const box = el('div', { class: 'seg', id, role: 'group', 'aria-label': label });
  let cur = value;
  const keys = options.map(([v, text, title], i) => el('button', { type: 'button', 'aria-pressed': String(v === value), title: title || text, style: `--d:${i}`, onclick: () => set(v) }, text));
  const set = (v) => { cur = v; options.forEach(([o], i) => keys[i].setAttribute('aria-pressed', String(o === v))); if (onChange) onChange(v); };
  box.append(...keys);
  Object.defineProperty(box, 'value', { get: () => cur, set });
  return /** @type {HTMLElement & { value: string }} */ (box);
}

export function buildStart() {
  const s = $('#start');
  const fmtNote = el('p', { class: 'note' });
  const updFmt = () => { S.format = fmt.value; paintTruckSign(CFG.car.name); fmtNote.textContent = `Avec ce format : ${evsLayout().label} ; mélangeur ${EQUIP.mixer} avec ${mixInputs()} entrées utilisées.`; };
  const SHORT_LIGHT = { jour: 'Après-midi', fin: 'Soleil rasant', couvert: 'Couvert', nuit: 'Nuit' };
  const SHORT_FMT = { HD: 'HD 1080p50', HDi: 'HD 1080i50', UHD: 'UHD HDR' };
  const light = selector('stlight', 'Lumière', Object.entries(LIGHTING).map(([k, v]) => [k, SHORT_LIGHT[k] || v.label, v.label]), 'jour');
  const fmt = selector('stfmt', 'Format de production', Object.entries(FORMATS).map(([k, v]) => [k, SHORT_FMT[k] || v.label, v.label]), S.format, () => updFmt());
  const infra = selector('stinfra', 'Infrastructure du car', [['sdi', 'SDI', 'Car SDI : grille coaxiale'], ['ip', 'IP (ST 2110)', 'Car IP : ST 2110, PTP, NMOS']], 'sdi');
  // qualité : celle choisie dans les réglages de l'écran titre, s'il y en a une (sauf en mode allégé)
  let q0 = S.quality; try { if (!S.lite) q0 = localStorage.getItem('carregie.quality') || q0; } catch (e) { /* stockage indisponible */ }
  const qual = selector('stqual', 'Qualité graphique', [['basse', 'Basse', 'Basse : ordinateur portable'], ['moyenne', 'Moyenne'], ['haute', 'Haute', 'Haute : carte graphique dédiée']], q0);
  const snd = selector('stsnd', 'Son', [['1', 'Ambiance et commentaires'], ['0', 'Coupé']], '1');
  updFmt();
  // visite guidée par le chef de car : proposée d'office tant qu'on ne l'a pas faite dans ce navigateur
  let toured = true; try { toured = localStorage.getItem('carregie.chefIntro') === '1'; } catch (e) { /* stockage indisponible */ }
  const tour = el('button', { type: 'button', id: 'st-tour', class: 'btn toggle', 'aria-pressed': String(!toured), onclick: () => tour.setAttribute('aria-pressed', String(tour.getAttribute('aria-pressed') !== 'true')) }, 'Visite guidée avec le chef de car');
  const go = (preset) => { S.chefTour = preset === 'standard' && tour.getAttribute('aria-pressed') === 'true'; start(preset, light.value, qual.value, snd.value === '1', fmt.value, infra.value === 'ip'); };
  // session à plusieurs : on démarre le car prêt à l'antenne, avec les réglages de l'hôte s'il y en a déjà un
  setSessionStarter({
    cfg: () => ({ fmt: fmt.value, ip: infra.value === 'ip', light: light.value }),
    start: async () => {
      for (let i = 0; i < 25 && !(SES.hostPeer && !SES.hostPeer.sameTab && SES.hostPeer.presence.cfg); i++) await new Promise((r) => setTimeout(r, 120));
      const h = SES.hostPeer && !SES.hostPeer.sameTab && SES.hostPeer.presence.cfg;
      S.chefTour = false;
      start('standard', h ? h.light : light.value, qual.value, snd.value === '1', h ? h.fmt : fmt.value, h ? !!h.ip : infra.value === 'ip');
    },
  });
  const truckLine = el('span', { class: 'cs-truck', id: 'sttruck' });
  const setTruck = () => { truckLine.textContent = [CFG.car.company, CFG.car.name].filter(Boolean).join(', '); truckLine.hidden = !truckLine.textContent; updFmt(); };
  setTruck(); on('config', setTruck); on('shared', setTruck);
  // la journée d'un car régie avant l'antenne : chaque mode du simulateur à son heure
  const strip = (time, title, desc, label, preset) => el('li', { class: 'dk-strip plate' },
    el('div', { class: 'scribble glass' }, el('time', {}, time), el('b', {}, title)),
    el('p', {}, desc),
    el('button', { class: 'btn', onclick: () => go(preset) }, label));
  // le mur des lieux, comme un multiview : le car en service, les autres en préparation (mire,
  // silhouettes floues, trois indices) ; un écran en préparation ouvre « Ce qui se prépare »
  const teaser = (L) => {
    const body = el('div', { class: 'lx-teaser' },
      el('p', { class: 'lede' }, L.pitch || ''),
      el('h3', {}, 'Ce que vous y ferez'),
      el('ul', {}, ...(L.vous || []).map((t) => el('li', {}, t))),
      el('h3', {}, 'Le matériel annoncé'),
      el('ul', { class: 'lx-gear' }, ...(L.materiel || []).map((t) => el('li', {}, t))),
      el('p', { class: 'note' }, `Votre guide sur place : ${L.tuteur}. Prévu : ${L.prevu} (${L.version}) ; le calendrier peut encore bouger.`),
      L.attente ? el('div', { class: 'lx-wait' }, el('p', {}, el('b', {}, 'En attendant, au car : '), L.attente.why),
        el('button', { class: 'btn primary', onclick: () => { modal.close(); go(L.attente.preset); } }, L.attente.label)) : null);
    modal.open(`Ce qui se prépare : ${L.nom}`, body, { width: 640 });
  };
  const toAir = () => {
    const a = /** @type {HTMLElement | null} */ ($('#st-antenne')); if (!a) return;
    a.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    a.focus({ preventScroll: true });
  };
  const live = (L) => L.etat === 'service';
  const wall = el('section', { class: 'dk-lieux', 'aria-labelledby': 'dk-lieux-h' },
    el('div', { class: 'lx-head' },
      el('h2', { id: 'dk-lieux-h' }, 'Les lieux'),
      el('p', { class: 'note' }, 'Un lieu en service, quatre en préparation : choisissez un écran pour découvrir ce qui se prépare.')),
    el('ul', { class: 'lx-wall' }, ...LIEUX.map((L) => el('li', {},
      el('button', { type: 'button', class: 'lx' + (live(L) ? ' on' : ''), 'data-lieu': L.id, 'aria-current': live(L) ? 'true' : null, onclick: () => (live(L) ? toAir() : teaser(L)) },
        el('span', { class: 'lx-scr ' + (live(L) ? 'live' : 'bars'), 'aria-hidden': 'true' },
          el('span', { class: 'lx-sil' }, ...L.icons.map((n) => icon(n))),
          el('span', { class: 'lx-sig' }, live(L) ? 'En service' : 'Signal attendu')),
        el('span', { class: 'lx-umd' }, el('i', { class: 'lx-tally' }), el('b', {}, L.nom), el('small', {}, live(L) ? 'en service' : L.prevu)),
        el('span', { class: 'lx-cadre' }, live(L) ? L.cadre : `Indices : ${(L.indices || []).join(', ')}`),
        live(L) ? null : el('span', { class: 'sr' }, ' : voir ce qui se prépare'))))));
  const lan = lanAvailable();
  s.append(el('div', { class: 'callsheet deck' },
    el('header', { class: 'dk-head' },
      el('div', { class: 'dk-title' },
        el('button', { type: 'button', class: 'linkbtn dk-menu', id: 'st-menu', onclick: () => showTitle() }, icon('pupitre'), 'Menu principal'),
        el('h1', {}, 'Car régie 3D'),
        el('p', { class: 'lede' }, 'Simulateur de formation aux métiers du car régie. Un match se joue en continu dans un stade inspiré de Bollaert-Delelis : tout ce que vous réglez se voit à l\'image, chaque action est expliquée.')),
      el('div', { class: 'glass dk-match', role: 'group', 'aria-label': 'La rencontre de ce soir' },
        el('span', {}, 'RC Lens – AS Rivière'),
        el('span', { class: 'dim' }, 'Bollaert-Delelis, reconstitution'),
        el('span', {}, el('em', {}, 'Antenne '), '20:45   ', el('em', {}, 'Coup d\'envoi '), '21:00'),
        truckLine)),
    wall,
    el('section', { class: 'onair', 'aria-label': 'Prendre l\'antenne' },
      el('button', { id: 'st-antenne', class: 'onair-key', onclick: () => go('standard') },
        el('span', { class: 'onair-lamp', 'aria-hidden': 'true' }, 'Antenne'),
        el('b', {}, 'Prendre l\'antenne'),
        el('span', {}, 'Le car est prêt : 12 caméras installées et réglées, 2 super ralentis, une Steadicam HF, une mini-caméra de but. Le meilleur point de départ pour découvrir les postes.')),
      el('div', { class: 'onair-chef' },
        tour,
        el('button', { type: 'button', id: 'st-chef', class: 'btn chef-btn', title: 'Les parcours guidés du chef de car (touche J)', onclick: () => emit('chef') }, icon('chef'), 'Chef de car', el('kbd', {}, 'J')),
        el('p', { class: 'note' }, 'Olivier, le chef de car, vous fait faire le tour du car puis vous guide pas à pas à chaque poste.'))),
    el('section', { class: 'dk-capt plate', 'aria-labelledby': 'dk-capt-h' },
      el('h2', { id: 'dk-capt-h' }, 'Conditions de captation'),
      el('label', {}, 'Lumière'), light,
      el('label', {}, 'Format'), fmt,
      el('label', {}, 'Car'), infra,
      fmtNote,
      el('h3', {}, 'Sur cet ordinateur'),
      el('label', {}, 'Qualité'), qual,
      el('label', {}, 'Son'), snd),
    el('section', { class: 'dk-team plate' + (lan ? ' cs-lan' : ''), 'aria-labelledby': 'dk-team-h' },
        el('h2', { id: 'dk-team-h' }, 'Équipe et formation'),
        lan ? el('p', { class: 'note' }, el('b', {}, 'Réseau local. '), 'Hébergez une partie ou rejoignez celle d\'un collègue : chacun choisit un pseudo et un rôle dans la prestation.') : null,
        el('button', { class: 'btn', title: 'Plusieurs joueurs dans le même car, en direct : chacun son pseudo et son rôle', onclick: () => openSessionPanel() }, 'Jouer à plusieurs'),
        el('button', { class: 'btn role-only', onclick: () => openTrainer('car') }, 'Espace formateur'),
        el('button', { class: 'btn role-only', title: 'Pour les experts métier : valider ou corriger chaque point technique du simulateur', onclick: () => openReview('me') }, 'Relecture technique')),
    el('section', { class: 'dk-day', 'aria-labelledby': 'dk-day-h' },
      el('h2', { id: 'dk-day-h' }, 'La journée du car, avant l\'antenne'),
      el('ol', { class: 'dk-strips' },
        strip('08:00', 'Installation', 'Stade vide : placer, câbler et régler les caméras, avec des missions guidées.', 'Installer le car', 'vierge'),
        strip('09:30', 'Atelier de montage', 'Monter une caméra pièce par pièce, du pied jusqu\'à la fibre.', 'Monter une caméra', 'atelier'),
        strip('11:00', 'Le car vide', 'Rien n\'est brassé : reliez chaque liaison avec la liste de câblage.', 'Brasser le car', 'brassage'),
        strip('17:30', 'Jour de match', 'Line-up, test de ligne, puis le direct avec des pannes. Chronométré et noté.', 'Lancer le jour de match', 'scenario'),
        strip('20:45', 'Grand dispositif', '16 caméras : volante, rail, grue, deux Steadicam. Ordinateur puissant conseillé.', 'Lancer le grand dispositif', 'grand'))),
    el('footer', { class: 'dk-foot' },
      el('div', { class: 'dk-side' },
        el('details', { class: 'cs-keys' },
          el('summary', {}, 'Commandes clavier'),
          el('div', { class: 'keys' }, ...CONTROLS_HELP.map(([k, d]) => el('div', {}, el('kbd', {}, k), el('span', {}, d))))),
        // la version, pour savoir quel fichier on a ouvert ; le diagnostic, pour signaler un problème
        el('p', { class: 'note cs-ver' }, el('span', { id: 'stversion' }, `Version ${APP_VERSION}`), el('button', { class: 'linkbtn', onclick: () => openDiag() }, icon('diagnostic'), 'Diagnostic technique'))),
      el('p', { class: 'note cs-foot' }, 'Simulation non officielle, sans lien avec le club ni avec les constructeurs cités. Les caractéristiques techniques (objectifs, portées de câbles, seuils HF, niveaux vidéo et audio) sont des ordres de grandeur réalistes, donnés à titre pédagogique ; les noms d\'équipements sont des exemples de matériel courant.'))));
}

export function start(preset, light, quality, sound, format = S.format, ip = false) {
  if (quality !== S.quality) setQuality(quality);
  S.format = format; S.ipMode = !!ip; S.preset = preset; paintTruckSign(CFG.car.name);
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
  emit('started', { preset });
}

// première prise en main : les six gestes de base, affichés une fois (mémorisé dans ce navigateur)
function showOnboarding() {
  let seen = false; try { seen = localStorage.getItem('carregie.onboard') === '1'; } catch (e) { /* stockage indisponible */ }
  if (seen || $('#onboard')) return;
  const touch = matchMedia('(pointer: coarse)').matches;
  const rows = touch ? FIRST_STEPS_TOUCH : FIRST_STEPS;
  const close = () => { box.remove(); try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* stockage indisponible */ } };
  const box = el('div', { id: 'onboard', role: 'dialog', 'aria-label': 'Prise en main' },
    el('span', { class: 'tape' }, 'Prise en main'),
    el('ul', {}, ...rows.map(([k, d]) => el('li', {}, el('kbd', {}, k), el('span', {}, d)))),
    el('button', { class: 'btn small primary', onclick: close }, 'Compris'));
  $('#hud').appendChild(box);
}
