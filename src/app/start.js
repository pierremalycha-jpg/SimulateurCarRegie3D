// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { FIRST_STEPS, FIRST_STEPS_TOUCH } from '../content/controls.js';
import { LIGHTING } from '../data/exposure.js';
import { FORMATS } from '../data/cameras.js';
import { applyLighting, paintTruckSign } from '../world.js';
import { loadPreset, PRESETS } from '../bcam.js';
import { MIX, defaultRouting } from '../pipeline.js';
import { AU, startAudio, applyFaders } from '../audio.js';
import { patchEmpty } from '../patch.js';
import { factoryCtrlNet } from '../net/ctrlnet.js';
import { EQUIP, evsLayout, mixInputs } from '../equip.js';
import { CFG } from '../shared.js';
import { SES } from '../multi/session.js';
import { lanAvailable } from '../multi/lan.js';
import { openSessionPanel, setSessionStarter } from '../ui/session_ui.js';
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
// L'écran Jouer (lieu, mode, solo ou coopération, conditions de captation) et le lancement d'une partie.
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

const SHEET = { go: /** @type {((preset: string, o?: { ip?: boolean }) => void) | null} */ (null) };
/**
 * Lance une vacation depuis la feuille de service (car prêt à l'antenne, installation, atelier…),
 * avec ses conditions de captation. Rien ne se passe si la partie est déjà commencée.
 * @param {string} preset standard, vierge, atelier, brassage, scenario, grand
 * @param {{ ip?: boolean }} [o] ip : car IP (ST 2110)
 */
export function launch(preset, o = {}) { if (S.mode === 'start' && SHEET.go) SHEET.go(preset, o); }

// les modes du car régie : tout installé, tout à faire, visite guidée par Olivier
const MODES = [
  { id: 'installe', preset: 'standard', ico: 'antenne', title: 'Car installé', desc: 'Tout est prêt : 12 caméras installées et réglées, le car brassé, le réseau en service. Vous entrez dans le car et vous prenez l\'antenne.', lamp: 'Antenne', go: 'Entrer dans le car' },
  { id: 'zero', preset: 'zero', ico: 'plan', title: 'Tout à faire', desc: 'Stade vide, car non brassé, caméras non réglées, réseau à configurer. Une liste de tâches vous guide et se coche toute seule.', lamp: 'Installer', go: 'Commencer l\'installation' },
  { id: 'visite', preset: 'standard', ico: 'chef', title: 'Visite guidée', desc: 'Olivier, le chef de car, vous fait le tour du car poste par poste : à quoi sert chaque poste, ce qu\'on y regarde, les gestes de base.', lamp: 'Visite', go: 'Commencer la visite' },
];
export function buildStart() {
  const s = $('#start');
  const fmtNote = el('p', { class: 'note' });
  const SHORT_LIGHT = { jour: 'Après-midi', fin: 'Soleil rasant', couvert: 'Couvert', nuit: 'Nuit' };
  const SHORT_FMT = { HD: 'HD 1080p50', HDi: 'HD 1080i50', UHD: 'UHD HDR' };
  const capSum = el('span', { class: 'jo-capsum' });
  const updSum = () => { capSum.textContent = [SHORT_LIGHT[light.value] || light.value, SHORT_FMT[fmt.value] || fmt.value, infra.value === 'ip' ? 'car IP' : 'car SDI', `qualité ${qual.value}`, snd.value === '1' ? 'son activé' : 'son coupé'].join(' · '); };
  const updFmt = () => { S.format = fmt.value; paintTruckSign(CFG.car.name); fmtNote.textContent = `Avec ce format : ${evsLayout().label} ; mélangeur ${EQUIP.mixer} avec ${mixInputs()} entrées utilisées.`; updSum(); };
  const light = selector('stlight', 'Lumière', Object.entries(LIGHTING).map(([k, v]) => [k, SHORT_LIGHT[k] || v.label, v.label]), 'jour', () => updSum());
  const fmt = selector('stfmt', 'Format de production', Object.entries(FORMATS).map(([k, v]) => [k, SHORT_FMT[k] || v.label, v.label]), S.format, () => updFmt());
  const infra = selector('stinfra', 'Infrastructure du car', [['sdi', 'SDI', 'Car SDI : grille coaxiale'], ['ip', 'IP (ST 2110)', 'Car IP : ST 2110, PTP, NMOS']], 'sdi', () => updSum());
  // qualité : celle choisie dans les réglages, s'il y en a une (sauf en mode allégé)
  let q0 = S.quality; try { if (!S.lite) q0 = localStorage.getItem('carregie.quality') || q0; } catch (e) { /* stockage indisponible */ }
  const qual = selector('stqual', 'Qualité graphique', [['basse', 'Basse', 'Basse : ordinateur portable'], ['moyenne', 'Moyenne'], ['haute', 'Haute', 'Haute : carte graphique dédiée']], q0, () => updSum());
  const snd = selector('stsnd', 'Son', [['1', 'Ambiance et commentaires'], ['0', 'Coupé']], '1', () => updSum());
  updFmt();
  // le choix : le lieu, le mode, seul ou en coopération
  const PICK = { mode: 'installe', team: 'solo' };
  // premier lancement dans ce navigateur : la visite guidée est proposée d'office
  try { if (localStorage.getItem('carregie.chefIntro') !== '1') PICK.mode = 'visite'; } catch (e) { /* stockage indisponible */ }
  const run = (preset) => start(preset, light.value, qual.value, snd.value === '1', fmt.value, infra.value === 'ip');
  const go = () => {
    const M = MODES.find((m) => m.id === PICK.mode) || MODES[0];
    if (PICK.team === 'coop') { openSessionPanel(); return; }
    S.chefTour = M.id === 'visite'; S.visite = M.id === 'visite';
    run(M.preset);
  };
  // depuis le Cours (exercices pratiques) : la vacation demandée, avec les conditions de captation choisies ici
  SHEET.go = (preset, o = {}) => { if (o.ip) infra.value = 'ip'; S.chefTour = false; S.visite = false; run(preset); };
  // coopération : le car installé, avec les réglages de l'hôte s'il y en a déjà un
  setSessionStarter({
    cfg: () => ({ fmt: fmt.value, ip: infra.value === 'ip', light: light.value }),
    start: async () => {
      for (let i = 0; i < 25 && !(SES.hostPeer && !SES.hostPeer.sameTab && SES.hostPeer.presence.cfg); i++) await new Promise((r) => setTimeout(r, 120));
      const h = SES.hostPeer && !SES.hostPeer.sameTab && SES.hostPeer.presence.cfg;
      S.chefTour = false; S.visite = false;
      start('standard', h ? h.light : light.value, qual.value, snd.value === '1', h ? h.fmt : fmt.value, h ? !!h.ip : infra.value === 'ip');
    },
  });
  const truckLine = el('span', { class: 'cs-truck', id: 'sttruck' });
  const setTruck = () => { truckLine.textContent = [CFG.car.company, CFG.car.name].filter(Boolean).join(', '); truckLine.hidden = !truckLine.textContent; updFmt(); };
  setTruck(); on('config', setTruck); on('shared', setTruck);
  // la salle de concert, en préparation : sa fiche « Ce qui se prépare »
  const teaser = (L) => {
    const body = el('div', { class: 'lx-teaser' },
      el('p', { class: 'lede' }, L.pitch || ''),
      el('h3', {}, 'Ce que vous y ferez'),
      el('ul', {}, ...(L.vous || []).map((t) => el('li', {}, t))),
      el('h3', {}, 'Le matériel annoncé'),
      el('ul', { class: 'lx-gear' }, ...(L.materiel || []).map((t) => el('li', {}, t))),
      el('p', { class: 'note' }, `Votre guide sur place : ${L.tuteur}. Prévu : ${L.prevu} ; le calendrier peut encore bouger.`));
    modal.open(`Ce qui se prépare : ${L.nom}`, body, { width: 640 });
  };
  const concert = LIEUX.find((L) => L.id === 'concert');
  const lieu = (id, nom, cadre, live, icons, onclick) => el('li', {},
    el('button', { type: 'button', class: 'lx' + (live ? ' on' : ''), 'data-lieu': id, 'aria-pressed': live ? 'true' : 'false', onclick },
      el('span', { class: 'lx-scr ' + (live ? 'live' : 'bars'), 'aria-hidden': 'true' },
        el('span', { class: 'lx-sil' }, ...icons.map((n) => icon(n))),
        el('span', { class: 'lx-sig' }, live ? 'En service' : 'En préparation')),
      el('span', { class: 'lx-umd' }, el('i', { class: 'lx-tally' }), el('b', {}, nom), el('small', {}, live ? 'en service' : concert ? concert.prevu : '')),
      el('span', { class: 'lx-cadre' }, cadre),
      live ? null : el('span', { class: 'sr' }, ' : voir ce qui se prépare')));
  // les modes, comme des touches à bascule ; la touche de lancement suit le mode
  const lamp = el('span', { class: 'onair-lamp', 'aria-hidden': 'true' });
  const goTitle = el('b');
  const goDesc = el('span');
  const modes = el('div', { class: 'jo-modes', role: 'group', 'aria-label': 'Le mode' });
  const teamSeg = el('div', { class: 'seg jo-team-seg', role: 'group', 'aria-label': 'Seul ou en équipe' });
  const teamNote = el('p', { class: 'note' });
  const lan = lanAvailable();
  const draw = () => {
    const M = MODES.find((m) => m.id === PICK.mode) || MODES[0];
    // la coopération se joue avec le car installé : les autres modes se font seul
    if (PICK.team === 'coop' && M.id !== 'installe') PICK.mode = 'installe';
    modes.replaceChildren(...MODES.map((m) => el('button', { type: 'button', class: 'jo-mode', 'data-mode': m.id, 'aria-pressed': String(m.id === PICK.mode), disabled: PICK.team === 'coop' && m.id !== 'installe' ? '' : null, onclick: () => { PICK.mode = m.id; draw(); } },
      icon(m.ico), el('b', {}, m.title), el('span', {}, m.desc))));
    teamSeg.replaceChildren(...[['solo', 'Solo'], ['coop', 'Coopération']].map(([v, t]) => el('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === PICK.team), onclick: () => { PICK.team = v; draw(); } }, t)));
    teamNote.textContent = PICK.team === 'coop'
      ? (lan ? 'Réseau local : l\'hôte crée le salon, les autres le rejoignent ; chacun choisit un pseudo et un rôle dans la prestation. La coopération se joue avec le car installé.' : 'En ligne : l\'hôte crée le salon et donne son code ; chacun choisit un pseudo et un rôle dans la prestation. La coopération se joue avec le car installé.')
      : 'Vous êtes seul dans le car : vous passez d\'un poste à l\'autre (touche Tab).';
    const N = MODES.find((m) => m.id === PICK.mode) || MODES[0];
    lamp.textContent = PICK.team === 'coop' ? 'Salon' : N.lamp;
    goTitle.textContent = PICK.team === 'coop' ? 'Ouvrir le salon' : N.go;
    goDesc.textContent = PICK.team === 'coop' ? 'Créez la partie ou rejoignez celle d\'un collègue, choisissez votre rôle, puis entrez dans le car ensemble.' : N.desc;
  };
  draw();
  const step = (n, title, ...kids) => el('section', { class: 'jo-step', 'aria-label': title }, el('h2', {}, el('span', { class: 'jo-n' }, String(n)), title), ...kids);
  s.append(el('div', { class: 'jouer' },
    el('header', { class: 'jo-head' },
      el('nav', { class: 'dk-nav', 'aria-label': 'Navigation' },
        el('button', { type: 'button', class: 'linkbtn dk-menu', id: 'st-menu', onclick: () => showTitle() }, icon('pupitre'), 'Menu principal'),
        el('button', { type: 'button', class: 'linkbtn dk-menu', id: 'st-cours', onclick: () => emit('cours') }, icon('cours'), 'Cours'),
        el('button', { type: 'button', class: 'linkbtn dk-menu', id: 'st-reglages', onclick: () => emit('settings') }, icon('reglages'), 'Réglages')),
      el('div', { class: 'jo-title' },
        el('h1', {}, 'Jouer'),
        el('p', { class: 'lede' }, 'Choisissez le lieu, le mode et votre équipe. Un match se joue en continu dans un stade inspiré de Bollaert-Delelis : tout ce que vous réglez se voit à l\'image.')),
      el('div', { class: 'glass dk-match', role: 'group', 'aria-label': 'La rencontre de ce soir' },
        el('span', {}, 'RC Lens – AS Rivière'),
        el('span', { class: 'dim' }, 'Bollaert-Delelis, reconstitution'),
        el('span', {}, el('em', {}, 'Antenne '), '20:45   ', el('em', {}, 'Coup d\'envoi '), '21:00'),
        truckLine)),
    el('div', { class: 'jo-steps' },
      step(1, 'Le lieu', el('ul', { class: 'lx-wall jo-lieux' },
        lieu('car', 'Car régie', 'Captation sportive au stade', true, ['car', 'terrain'], () => modes.querySelector('[aria-pressed="true"]')?.focus()),
        concert ? lieu('concert', 'Salle de concert', concert.cadre, false, concert.icons, () => teaser(concert)) : null)),
      step(2, 'Le mode', modes),
      step(3, 'En équipe', el('div', { class: 'jo-team' }, teamSeg, teamNote),
        lan ? el('p', { class: 'note cs-lan' }, el('b', {}, 'Réseau local'), ` : ce simulateur est servi par l'ordinateur de l'hôte (${location.host}).`) : null)),
    // à droite : ce qui lance la partie, et les conditions de captation repliées dessous
    el('aside', { class: 'jo-side', 'aria-label': 'Lancer la partie' },
      el('section', { class: 'onair jo-go', 'aria-label': 'Lancer' },
        el('button', { id: 'st-antenne', class: 'onair-key', onclick: () => go() }, lamp, goTitle, goDesc)),
      el('details', { class: 'jo-capt plate' },
        el('summary', {}, el('b', {}, 'Conditions de captation'), capSum),
        el('div', { class: 'jo-capt-grid' },
          el('label', {}, 'Lumière'), light,
          el('label', {}, 'Format'), fmt,
          el('label', {}, 'Car'), infra,
          fmtNote,
          el('label', {}, 'Qualité'), qual,
          el('label', {}, 'Son'), snd))),
    el('footer', { class: 'jo-foot' },
      el('p', { class: 'note cs-ver' }, el('span', { id: 'stversion' }, `TIEE Simulator, version ${APP_VERSION}`), el('button', { class: 'linkbtn', onclick: () => openDiag() }, icon('diagnostic'), 'Diagnostic technique')),
      el('p', { class: 'note jo-credit' }, el('b', {}, 'Développé par Pierre MALYCHA'), ' · réalisé par le BTS Audiovisuel de Saint-Quentin (lycée Henri-Martin)'),
      el('p', { class: 'note cs-foot' }, 'Simulation non officielle, sans lien avec le club ni avec les constructeurs cités. Les caractéristiques techniques (objectifs, portées de câbles, seuils HF, niveaux vidéo et audio) sont des ordres de grandeur réalistes, donnés à titre pédagogique ; les noms d\'équipements sont des exemples de matériel courant.'))));
}

export function start(preset, light, quality, sound, format = S.format, ip = false) {
  if (quality !== S.quality) setQuality(quality);
  S.format = format; S.ipMode = !!ip; S.preset = preset; paintTruckSign(CFG.car.name);
  applyLighting(light);
  // tout à faire : stade vide, car non brassé, caméras non réglées, réseau de contrôle à configurer
  if (preset === 'vierge' || preset === 'zero') { loadPreset('none'); S.autoLineup = false; S.showMission = true; }
  else if (preset === 'brassage' || preset === 'scenario') { loadPreset('standard', preset !== 'scenario'); S.showMission = false; }
  else if (preset === 'atelier') { loadPreset('standard', true); S.showMission = false; }
  else if (preset === 'standard' && Array.isArray(CFG.car.camPreset) && CFG.car.camPreset.length) { PRESETS.car = CFG.car.camPreset; loadPreset('car', true); S.showMission = false; }
  else { loadPreset(preset, true); S.showMission = false; }
  defaultRouting(true);
  if (preset === 'brassage' || preset === 'scenario' || preset === 'zero') { S.patch.on = true; patchEmpty(); }
  if (preset === 'zero' && !S.ipMode) factoryCtrlNet();
  MIX.pgm = 1; MIX.pst = 2;
  if (preset === 'atelier') { MIX.pgm = 2; MIX.pst = 3; } // la 1 est démontée : l'antenne reste sur la 2
  if (preset !== 'vierge' && preset !== 'zero') { MIX.dsk1.on = true; MIX.dsk1.level = 1; }
  $('#start').hidden = true; $('#hud').hidden = false;
  S.mode = 'fps';
  if (sound) startAudio(); else { startAudio(); AU.muted = true; applyFaders(); }
  buildToolbar();
  if (preset === 'brassage') { emit('openStationNow', { id: 'brassage' }); toast('Car vide : brassez chaque liaison en suivant la liste de câblage. Le multiview montre le résultat.', '', 7000); }
  else if (preset === 'scenario') emit('startScenario');
  else if (preset === 'atelier') emit('startAtelier');
  else if (preset === 'vierge' || preset === 'zero') toast('Tout est à faire : suivez la tâche en haut à gauche. Commencez par le compound, puis le plan des caméras (P).', '', 7000);
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
