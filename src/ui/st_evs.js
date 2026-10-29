// @ts-check
import { S, camById } from '../state.js';
import { el, clamp, tc, fmt } from '../util.js';
import { hwBtn } from './common.js';
import { EVS, evsAction, evsSetRecording, recordedCams, recSource, ROUTER, sourceLabel, MIX, meSource, clipName } from '../pipeline.js';
import { recRange } from '../match.js';
import { EX } from '../exercises.js';
import { evsLayout, EQUIP } from '../equip.js';
import { explain } from './widgets.js';
import { openDevice } from '../equipment/viewer.js';
import { LSM, LSMS, lsmKeyOn, lsmLines } from '../poste3d/lsm.js';

export { LSM, lsmKeyOn, lsmLines };
// la touche OPÉ. AUTO de la télécommande 3D lit l'opérateur automatique (exercises.js, côté interface)
LSMS.auto = () => !!EX.evsAuto;

// Poste ralentis : télécommande type EVS LSM (logiciel Multicam) pilotant un serveur XT4K,
// avec l'écran du serveur (trains d'enregistrement, clips, playlist).
// L'état de la télécommande (SHIFT, playlist, boucle, choix de page) et ses gestes (LSMACT) sont communs au poste
// à plat et à la télécommande en 3D (poste3d/ralentis.js) ; le canal piloté est EVS.lsmCh.

const chI = () => EVS.lsmCh || 0;
const cur = () => EVS.ch[chI()];
let levSeq = 0;

/** les gestes de la télécommande : chaque touche, la molette jog, le levier, l'angle (mêmes explications en 2D et en 3D) */
export const LSMACT = {
  /** une touche du bloc opérationnel ou un raccourci du simulateur, par son nom */
  key(k) {
    const s = LSM.shift;
    const sh = (fn) => { LSM.shift = false; fn(); };
    switch (k) {
      case 'IN': return s ? sh(() => act('gotoin')) : act('markin');
      case 'OUT': return s ? sh(() => act('gotoout')) : act('markout');
      case 'PLST': return s ? sh(browseToggle) : plstToggle();
      case 'LOOP': LSM.loop = !LSM.loop; explain(LSM.loop ? 'LOOP : le clip IN-OUT tourne en boucle (écran géant, analyse).' : 'Boucle coupée.'); return;
      case 'RETURN': act('return'); explain('RETURN : on quitte les limites du clip et on se retrouve sur la même image dans le train d\'enregistrement. Utile quand le clip est trop court : on peut lire au-delà du point OUT.'); return;
      case 'PLAY': if (LSM.plst) { playPlaylist(); return; } act('play', 1); return;
      case 'LIVE': act('live'); return;
      case 'FAST': EVS.fastJog = !EVS.fastJog; explain(EVS.fastJog ? 'FAST JOG : la molette parcourt les enregistrements beaucoup plus vite (recalage rapide). Désactivé automatiquement après PLAY ou LIVE.' : 'Jog normal : image par image.'); return;
      case 'TAKE':
        if (evsLayout().plays < 2) { explain('TAKE : pas de second canal de lecture dans cette configuration (UHD avec un seul XT4K).', 'warn'); return; }
        evsAction(chI(), 'take'); explain('TAKE (mode 2 PGM) : le contenu de PGM1 et PGM2 est échangé. En mode PGM + PRV, TAKE envoie à l\'antenne ce qui était préparé sur PRV.'); return;
      case 'PGM':
        if (evsLayout().plays < 2) { explain('Un seul canal de lecture : la télécommande pilote PGM1.', 'warn'); return; }
        EVS.lsmCh = 1 - chI(); explain(`La télécommande pilote maintenant ${chI() ? 'PGM2 (EVS B)' : 'PGM1 (EVS A)'}. Avec une seule LSM, l'opérateur prépare une sortie pendant que l'autre est à l'antenne.`); return;
      case 'SHIFT': LSM.shift = !LSM.shift; explain(LSM.shift ? 'SHIFT : la prochaine touche donne sa fonction secondaire (inscrite en petit dessous).' : 'SHIFT relâché.'); return;
      case 'MENU': explain('MENU : bascule entre le menu opérationnel et le menu secondaire (réglages, modes PGM). SHIFT + MENU revient au menu principal.'); return;
      case 'CLEAR': { if (LSM.plst) { evsAction(chI(), 'plstclear'); explain('Playlist vidée.'); return; } const c = cur(); c.in = null; c.out = null; explain('CLEAR : points IN et OUT effacés.'); return; }
      case 'PAGE': if (!s) { explain('PAGE : fais SHIFT puis PAGE, puis une touche F pour choisir la page (1 à 10).'); return; } LSM.shift = false; LSM.page = true; explain('Choix de la page : appuie sur une touche F (F1 = page 1 … F10 = page 10).'); return;
      case 'LAST': act('lastaction'); return;
      case 'REC': evsSetRecording(!EVS.recording); explain(EVS.recording ? 'Enregistrement relancé : les trains reprennent.' : 'Enregistrement ARRÊTÉ : plus rien n\'est enregistré, aucun ralenti possible sur la suite du match !', EVS.recording ? '' : 'warn'); return;
      case 'AUTO': EX.evsAuto = !EX.evsAuto; explain(EX.evsAuto ? 'Opérateur automatique : après chaque action, l\'EVS A se cale tout seul (utile quand tu es au mélangeur).' : 'Opérateur automatique coupé : c\'est toi qui prépares les ralentis.'); return;
      default:
    }
  },
  /** touche F (0 à 9) : choisir la page, créer, rappeler ou écraser un clip, l'ajouter à la playlist */
  f(i) {
    if (LSM.page) { LSM.page = false; EVS.page = i + 1; explain(`Page ${EVS.page} : les touches F donnent maintenant les clips ${EVS.page}11 à ${EVS.page}10.`); return; }
    const idx = (EVS.page - 1) * 10 + i;
    if (LSM.plst) { if (EVS.clips[idx]) { evsAction(chI(), 'plstadd', idx); explain(`Clip ${clipName(idx)} ajouté à la playlist (${EVS.playlist.length} clips).`); } else explain('Ce clip est vide.', 'warn'); return; }
    const c = cur();
    // touche vide + point IN ou OUT marqué : le clip est créé sur cette touche (SHIFT + F : écrase un clip existant)
    if (LSM.shift || (!EVS.clips[idx] && (c.in != null || c.out != null))) { LSM.shift = false; evsAction(chI(), 'save', idx); const cl = EVS.clips[idx]; explain(cl ? `Clip ${clipName(idx)} sauvegardé (page ${EVS.page}, F${i + 1}, angle de la CAM ${cl.cam}, ${fmt(cl.out - cl.in, 1)} s), avec tous les angles enregistrés. Il est protégé de l'écrasement de la boucle et visible dans IPDirector.` : 'Pas de point IN : rien à sauvegarder.'); return; }
    if (EVS.clips[idx]) { evsAction(chI(), 'recall', idx); explain(`Clip ${clipName(idx)} rappelé sur ${chI() ? 'PGM2' : 'PGM1'} : calé sur son IN, prêt à jouer.`); } else explain('Touche vide : marque d\'abord un IN (et un OUT), puis appuie sur une touche F libre pour créer le clip.', 'warn');
  },
  /** angle : une caméra enregistrée, au même timecode */
  cam(id) {
    const r = recordedCams(), i = r.indexOf(id), cam = camById(id); if (!cam) return;
    evsAction(chI(), 'cam', id);
    explain(`Angle ${'ABCDEFGH'[i] || '?'} = CAM ${id}${cam.hfr > 1 ? ` (super ralenti ${cam.hfr}x, ${50 * cam.hfr} i/s)` : ''} sur le même timecode : c'est le multicam. On peut changer d'angle en pause sans perdre l'action.`);
  },
  /** molette jog : avance ou recule de quelques images (ou fait défiler les clips en BROWSE) */
  jog(frames) {
    if (!frames) return;
    if (EVS.browse) { evsAction(chI(), 'browse', frames); explain(EVS.browseIdx != null ? `BROWSE : clip ${clipName(EVS.browseIdx)} chargé (la molette fait défiler les clips de la base).` : 'BROWSE : aucun clip dans la base.', 'lsm:browse'); return; }
    evsAction(chI(), 'jog', frames);
    const c = cur();
    explain(`Jog ${frames > 0 ? '+' : ''}${frames * (EVS.fastJog ? 10 : 1)} image${Math.abs(frames) > 1 ? 's' : ''} : position ${tc(S.tcOffset + c.t)}, soit ${fmt(Math.max(0, S.simTime - c.t), 1)} s derrière le direct.`, 'lsm:jog');
  },
  /** levier de vitesse (0 à 1) : le pousser lance la lecture à vitesse variable */
  lever(v) {
    const c = cur(); const wasPlaying = c.playing;
    evsAction(chI(), 'lever', v);
    const cam = camById(c.cam);
    if (performance.now() - levSeq > 300) {
      levSeq = performance.now();
      const fps = cam ? 50 * cam.hfr : 50;
      const per = v > 0 ? 1 / (v * fps / 50) : Infinity;
      explain(v === 0 ? 'Levier à 0 : image figée.' : `Levier ${Math.round(v * 100)} %${!wasPlaying && c.playing ? ' : la lecture démarre (pousser le levier lance le ralenti)' : ''}. ${cam ? `CAM ${cam.id} enregistrée à ${fps} i/s : ` : ''}${per <= 1.05 ? 'chaque image de sortie est une image différente, le mouvement reste fluide.' : `chaque image enregistrée est répétée ≈ ${fmt(per, 1)} fois en sortie, le mouvement saccade${cam && cam.hfr === 1 ? ' (une caméra super ralenti 3x serait fluide jusqu\'à 33 %)' : ''}.`}`, 'lsm:lever');
    }
  },
  /** lecture ou pause (barre d'espace) */
  toggle() { const c = cur(); evsAction(chI(), 'toggle'); explain(c.playing ? `Lecture à ${Math.round(c.speed * 100)} %.` : 'Pause.'); },
  /** clic dans les trains d'enregistrement : se placer à cet instant (fraction de la fenêtre de 90 s) */
  seek(frac) {
    const now = S.simTime; const t = now - TWIN + frac * TWIN;
    const c = cur(); evsAction(chI(), 'pause'); c.t = clamp(t, recRange()[0], now - 0.02);
    explain(`Navigation dans les trains : position ${tc(S.tcOffset + c.t)} (${fmt(now - c.t, 1)} s avant le direct).`, 'lsm:trains');
  },
};
function act(a, v) {
  const c = cur();
  evsAction(chI(), a, v);
  const T = (t) => tc(S.tcOffset + t);
  const txt = {
    markin: `IN sur ${T(c.in ?? S.simTime)} : début du clip. Tous les angles enregistrés partagent ce timecode.`,
    markout: `OUT sur ${T(c.out ?? S.simTime)} : fin du clip (la lecture s'arrêtera ici).`,
    gotoin: c.in != null ? `GOTO IN : la sortie se cale sur ${T(c.in)}, image figée, prête à partir.` : 'Pas de point IN : marque-le d\'abord (touche IN).',
    gotoout: c.out != null ? `GOTO OUT : calage sur le point de sortie ${T(c.out)}.` : 'Pas de point OUT : marque-le d\'abord (touche OUT).',
    live: 'LIVE (E/E) : la sortie montre l\'entrée en direct, sans retard. C\'est l\'état d\'attente normal entre deux ralentis.',
    play: 'PLAY : lecture à 100 %, vitesse réelle (souvent pour revoir une action complète ou un but sous un autre angle).',
    lastaction: S.lastAction ? `Calé 3 s avant la dernière action (${S.lastAction.label}) : IN et OUT posés automatiquement.` : 'Aucune action notée pour l\'instant.',
  }[a];
  if (txt) explain(txt);
}
function plstToggle() { LSM.plst = !LSM.plst; explain(LSM.plst ? 'PLST : mode playlist. Les touches F ajoutent les clips à la playlist, PLAY la lance, CLEAR la vide.' : 'Mode playlist quitté.'); }
function browseToggle() { EVS.browse = !EVS.browse; explain(EVS.browse ? 'BROWSE : la molette jog fait défiler les clips de la base.' : 'BROWSE désactivé : la molette repasse en recherche image par image.'); }
function playPlaylist() {
  if (!EVS.playlist.length) { explain('Playlist vide : PLST puis touches F pour ajouter des clips.', 'warn'); return; }
  evsAction(chI(), 'plstplay'); explain(`Lecture de la playlist (${EVS.playlist.length} clips) à ${Math.round(Math.max(0.25, cur().lever) * 100)} % : les clips s'enchaînent, c'est la base d'un résumé.`);
}

/** à chaque image du poste : la boucle LOOP relance le clip, le canal piloté existe */
export function lsmTick() {
  if (chI() >= evsLayout().plays) EVS.lsmCh = 0;
  const c = cur();
  if (c.pl == null && LSM.loop && c.mode === 'pause' && c.out != null && Math.abs(c.t - c.out) < 0.05) { evsAction(chI(), 'gotoin'); evsAction(chI(), 'playvar'); }
}

// ---------------- écran du serveur (clip screen / OSD) : trains, clips, playlist ----------------
const TWIN = 90;
/** l'écran du serveur : dans le poste à plat, et dans le panneau de droite du poste en 3D */
export function evsScreen() {
  const appbar = el('div', { class: 'lsm-app' });
  const cfg = el('div', { class: 'lsm-cfg' });
  const clipGrid = el('div', { class: 'lsm-clips' });
  const plist = el('div', { class: 'lsm-pl' });
  const trains = el('canvas', { class: 'lsm-trains', width: 760, height: 210 });
  const msg = el('div', { class: 'note warn' });
  const screen = el('div', { class: 'lsm-screen' }, el('div', { class: 'lsm-sub' }, `ÉCRAN DU SERVEUR ${EQUIP.evsModel} · MULTICAM`), appbar, cfg, msg, clipGrid, el('div', { class: 'lsm-sub' }, 'TRAINS D\'ENREGISTREMENT · clique pour te placer'), trains, el('div', { class: 'lsm-sub' }, 'PLAYLIST'), plist);
  const tg = trains.getContext('2d');
  trains.addEventListener('click', (e) => {
    const r = trains.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 760;
    if (x < 120) return;
    LSMACT.seek((x - 120) / 630);
  });
  function drawTrains() {
    const g = tg; const W = 760, H = 210; g.fillStyle = '#05080b'; g.fillRect(0, 0, W, H);
    const L = evsLayout();
    const now = S.simTime; const t0 = now - TWIN; const X = (t) => 120 + (t - t0) / TWIN * 630;
    g.font = '11px "JetBrains Mono", monospace'; g.fillStyle = '#5d6b77';
    for (let s = Math.ceil(t0 / 10) * 10; s <= now; s += 10) { const x = X(s); g.fillRect(x, 14, 1, H - 20); g.fillText(tc(S.tcOffset + s).slice(3, 8), x - 16, 11); }
    for (let i = 1; i <= 8; i++) {
      const y = 22 + (i - 1) * 22;
      if (i > L.rec) { g.fillStyle = '#3a434c'; g.fillText(`REC ${i} —`, 6, y + 12); continue; }
      const src = recSource(i); const ph = ROUTER.phase['REC' + i];
      g.fillStyle = '#93a0ab'; g.fillText(`${L.servers > 1 ? 'S' + L.recServer(i) + ' ' : ''}REC ${i} ${src ? sourceLabel(src).replace('CAM ', 'C') + (src.startsWith('CAM') && camById(+src.slice(3))?.hfr > 1 ? ' ' + 'ABCDEF'[ph] : '') : '—'}`, 6, y + 12);
      if (!src || !src.startsWith('CAM')) continue;
      const id = +src.slice(3); const st = EVS.recStart[id];
      if (st == null) continue;
      const a = Math.max(t0, st, recRange()[0]); const b = EVS.recording ? now : Math.min(now, EVS.recStopT);
      if (b > a) { g.fillStyle = camById(id)?.hfr > 1 ? '#7c4dbd' : '#1f7a3c'; g.fillRect(X(a), y + 2, X(b) - X(a), 14); }
      if (!EVS.recording && EVS.recStopT > t0) { g.fillStyle = '#ff3b30'; g.fillRect(X(EVS.recStopT), y, 2, 18); }
    }
    for (const e of S.events) { if (e.t < t0) continue; g.fillStyle = '#ffd23f'; g.fillRect(X(e.t) - 1, 16, 2, H - 22); g.save(); g.translate(X(e.t) + 3, H - 6); g.fillText(e.label, 0, 0); g.restore(); }
    EVS.ch.forEach((c, k2) => {
      if (k2 >= L.plays) return;
      const col = k2 ? '#46c6f2' : '#ff8a1f';
      if (c.in != null && c.in > t0) { g.fillStyle = col; g.fillRect(X(c.in), 16, 2, H - 24); g.fillText('IN', X(c.in) + 3, 26 + k2 * 10); }
      if (c.out != null && c.out > t0) { g.fillStyle = col; g.fillRect(X(c.out), 16, 2, H - 24); g.fillText('OUT', X(c.out) + 3, 26 + k2 * 10); }
      const t = c.mode === 'live' ? now : c.t;
      if (t >= t0) { g.fillStyle = col; g.beginPath(); g.moveTo(X(t), 14); g.lineTo(X(t) - 6, 4); g.lineTo(X(t) + 6, 4); g.fill(); g.fillRect(X(t) - 1, 14, 2, H - 20); }
    });
    g.fillStyle = '#ff8a1f'; g.fillText('▼ PGM1', 6, 11); if (L.plays > 1) { g.fillStyle = '#46c6f2'; g.fillText('▼ PGM2', 60, 11); }
  }
  return {
    el: screen,
    frame() { drawTrains(); },
    update() {
      const L = evsLayout(), c = cur(), live = c.mode === 'live';
      appbar.textContent = `PAGE ${EVS.page} · ${EQUIP.evsServers} × ${EQUIP.evsModel} · CONTRÔLE ${chI() ? 'PGM2 (EVS B)' : 'PGM1 (EVS A)'} · ${meSource(MIX.pgm) === (chI() ? 'EVSB' : 'EVSA') ? '● À L\'ANTENNE' : 'hors antenne'}`;
      cfg.textContent = `Configuration : ${L.label}.`;
      msg.textContent = !live && !c.ok ? c.msg : '';
      clipGrid.innerHTML = '';
      for (let i = 0; i < 10; i++) { const idx = (EVS.page - 1) * 10 + i; const cl = EVS.clips[idx]; clipGrid.appendChild(el('div', { class: 'lsm-clip' + (cl ? ' full' : '') }, el('b', {}, cl ? clipName(idx) : 'F' + (i + 1)), el('span', {}, cl ? `${cl.name || 'CAM ' + cl.cam} · ${fmt(cl.out - cl.in, 1)} s` : 'vide'))); }
      plist.textContent = EVS.playlist.length ? EVS.playlist.map((kk, j) => `${j + 1}. ${clipName(kk)}${EVS.clips[kk] && EVS.clips[kk].name ? ' ' + EVS.clips[kk].name : ''}`).join('   ') : 'vide';
    },
  };
}

/** raccourcis clavier du poste (Espace, I, O, L, flèches, chiffres) : en 2D comme en 3D */
export function lsmKey(e, leverStep) {
  if (e.code === 'Space') { LSMACT.toggle(); return true; }
  if (e.code === 'KeyI') { act('markin'); return true; }
  if (e.code === 'KeyO') { act('markout'); return true; }
  if (e.code === 'KeyL') { act('live'); return true; }
  if (e.code === 'ArrowLeft') { LSMACT.jog(e.shiftKey ? -10 : -1); return true; }
  if (e.code === 'ArrowRight') { LSMACT.jog(e.shiftKey ? 10 : 1); return true; }
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { leverStep(e.code === 'ArrowUp' ? 0.1 : -0.1); return true; }
  if (e.code.startsWith('Digit')) { const r = recordedCams(); const id = r[+e.code.slice(5) - 1]; if (id) evsAction(chI(), 'cam', id); return true; }
  return false;
}

export function buildEVS(body, arg = 0, ctx) {
  const L0 = evsLayout();
  EVS.lsmCh = L0.plays < 2 ? 0 : (typeof arg === 'number' ? arg : 0);
  LSM.shift = false; LSM.page = false;
  const noMon = !!ctx.noMonitors;
  // ---------------- dock ----------------
  if (!noMon) {
    ctx.dock.append(el('div', { class: 'dockrow' },
      el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'EVS A · sortie PGM1'), el('div', { class: 'mon fill', 'data-gl': 'EVSA' })),
      el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, L0.plays < 2 ? 'EVS B · (pas de canal en UHD)' : 'EVS B · sortie PGM2'), el('div', { class: 'mon fill', 'data-gl': 'EVSB' })),
      el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Programme (PGM)'), el('div', { class: 'mon fill', 'data-gl': 'PGM' }))), ctx.explainBox);
  }
  // l'écran du serveur : ici, sauf en 3D où il est dans le panneau de droite
  const scr = noMon ? null : evsScreen();
  // ---------------- télécommande ----------------
  const lcd = el('div', { class: 'lsm-lcd' });
  const K = (l, fn, color = '', title = '', sec = '') => el('button', { class: 'lsm-key ' + color, title, onclick: fn }, l, sec ? el('small', {}, sec) : null);
  const fkeys = []; const fRow = el('div', { class: 'lsm-row' });
  for (let i = 0; i < 10; i++) { const b = K('F' + (i + 1), () => LSMACT.f(i)); b.appendChild(el('small', {}, '')); fkeys.push(b); fRow.appendChild(b); }
  const camRow = el('div', { class: 'lsm-row' });
  const key = (name) => () => LSMACT.key(name);
  const k = {};
  k.in = K('IN', key('IN'), 'amber', 'IN · avec SHIFT : GOTO IN', 'GOTO IN');
  k.out = K('OUT', key('OUT'), 'amber', 'OUT · avec SHIFT : GOTO OUT', 'GOTO OUT');
  k.plst = K('PLST', key('PLST'), '', 'PLST · avec SHIFT : BROWSE', 'BROWSE');
  k.loop = K('LOOP', key('LOOP'));
  k.ret = K('RETURN', key('RETURN'));
  k.play = K('PLAY', key('PLAY'), 'green');
  k.live = K('LIVE E/E', key('LIVE'), 'cyan');
  k.fast = K('FAST JOG', key('FAST'), 'violet');
  k.take = K('TAKE', key('TAKE'));
  k.pgm = K('PGM/PRV', key('PGM'));
  k.shift = K('SHIFT', key('SHIFT'));
  k.menu = K('MENU', key('MENU'));
  k.clear = K('CLEAR', key('CLEAR'));
  k.page = K('PAGE', key('PAGE'), '', 'SHIFT + PAGE puis F : choix de la page');
  k.last = K('DERN. ACTION', key('LAST'), 'amber', 'Raccourci du simulateur : se cale 3 s avant la dernière action notée');
  const sc = {};
  sc.rec = K('REC', key('REC'), 'red');
  sc.auto = K('OPÉ. AUTO', key('AUTO'), 'violet');
  const keypad = el('div', { class: 'lsm-pad' },
    lcd,
    el('div', { class: 'lsm-sub' }, 'TOUCHES F (clips de la page · soft keys)'), fRow,
    el('div', { class: 'lsm-sub' }, 'ANGLES (entrées enregistrées)'), camRow,
    el('div', { class: 'lsm-sub' }, 'BLOC OPÉRATIONNEL (petit texte = fonction avec SHIFT)'),
    el('div', { class: 'lsm-row' }, k.in, k.out, k.plst, k.loop, k.ret),
    el('div', { class: 'lsm-row' }, k.live, k.play, k.fast, k.take, k.pgm),
    el('div', { class: 'lsm-row' }, k.shift, k.menu, k.clear, k.page),
    el('div', { class: 'lsm-sub' }, 'RACCOURCIS DU SIMULATEUR'), el('div', { class: 'lsm-row' }, k.last, sc.rec, sc.auto));
  // ---------------- levier et jog ----------------
  const lever = el('input', { type: 'range', min: 0, max: 100, step: 1, value: 50, class: 'tbar lsm-lever', id: noMon ? null : 'lsmlever', 'aria-label': 'Levier de vitesse' });
  lever.addEventListener('input', () => LSMACT.lever(+lever.value / 100));
  const levTxt = el('div', { class: 'lcd' }, '50 %');
  const wheel = el('div', { class: 'wheel', title: 'Jog : fais glisser en rond ou utilise la molette' }, el('i'));
  let wa = 0, dragging = false, lastA = 0;
  const angOf = (e) => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  wheel.addEventListener('pointerdown', (e) => { dragging = true; lastA = angOf(e); wheel.setPointerCapture(e.pointerId); });
  // un tour de molette ≈ 35 images (manuel Multicam)
  wheel.addEventListener('pointermove', (e) => { if (!dragging) return; const a = angOf(e); let d = a - lastA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; const frames = Math.round(d / (2 * Math.PI) * 35); if (!frames) return; lastA = a; wa += d; LSMACT.jog(frames); wheel.firstChild.style.transform = `rotate(${wa}rad)`; wheel.firstChild.style.transformOrigin = '5px 65px'; });
  wheel.addEventListener('pointerup', () => { dragging = false; });
  wheel.addEventListener('wheel', (e) => { e.preventDefault(); LSMACT.jog(e.deltaY > 0 ? 2 : -2); }, { passive: false });
  const presets = el('div', { class: 'list' }, ...[100, 66, 50, 33, 25].map((v) => hwBtn(v + ' %', { onclick: () => { lever.value = v; lever.dispatchEvent(new Event('input')); } })));
  const right = el('div', { class: 'lsm-right' }, el('div', { class: 'hwrow', style: { gap: '16px', alignItems: 'center' } }, el('div', { class: 'list', style: { alignItems: 'center' } }, el('span', { class: 'note' }, 'LEVIER'), lever, levTxt), presets), wheel, el('span', { class: 'note' }, 'JOG'));
  body.append(el('div', { class: 'lsm' + (noMon ? ' noscreen' : '') }, keypad, right, ...(scr ? [scr.el] : [])),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => openDevice('lsm', 1) }, 'Voir la télécommande LSM'), el('button', { class: 'btn small', onclick: () => openDevice('evs', 1) }, `Voir le serveur ${EQUIP.evsModel}`), el('button', { class: 'btn small', onclick: () => openDevice('ipd', 1) }, 'Voir le poste IPDirector')),
    el('p', { class: 'note' }, 'Méthode : laisse la sortie en LIVE pendant le jeu. Après l\'action : DERN. ACTION (ou jog arrière + IN), choisis l\'angle, puis pousse le levier quand le réalisateur envoie l\'EVS. Clips : IN / OUT puis F libre = créer · F occupée = rappeler · SHIFT + F = écraser · SHIFT + PAGE puis F = changer de page. Clavier : Espace lecture/pause · I / O · L live · ← → image par image (Maj = 10) · ↑ ↓ levier · 1-8 angle.'),
    el('p', { class: 'note' }, 'Disposition simplifiée de la télécommande : les fonctions suivent les manuels Multicam (versions 10 à 12), mais l\'emplacement exact des touches dépend de ton modèle et de ta version.'));

  let lastRec = '';
  return {
    frame() { if (scr) scr.frame(); },
    update() {
      lsmTick();
      const L = evsLayout(), c = cur();
      const recCams = recordedCams();
      lcd.innerHTML = '';
      for (const l of lsmLines()) lcd.appendChild(el('div', {}, l));
      const sig = recCams.join() + '|' + S.cams.map((x) => x.id).join();
      if (sig !== lastRec) {
        lastRec = sig; camRow.innerHTML = '';
        recCams.forEach((id, i) => { const cam = camById(id); const b = K(`CAM ${'ABCDEFGH'[i]}`, () => LSMACT.cam(id), 'cyan'); b.dataset.id = id; b.title = `CAM ${id}`; b.appendChild(el('small', {}, `${id}${cam.hfr > 1 ? ' · ' + cam.hfr + 'x' : ''}`)); camRow.appendChild(b); });
        if (!recCams.length) camRow.appendChild(el('span', { class: 'note warn' }, 'Aucune caméra enregistrée : affecte des entrées REC à la grille.'));
      }
      [...camRow.children].forEach((b) => b.classList && b.classList.toggle('on', +b.dataset.id === c.cam));
      fkeys.forEach((b, i) => { const idx = (EVS.page - 1) * 10 + i; const cl = EVS.clips[idx]; b.classList.toggle('on', !!cl); b.lastChild.textContent = LSM.page ? 'page ' + (i + 1) : cl ? clipName(idx) : ''; b.title = cl ? `${clipName(idx)} · CAM ${cl.cam} · ${tc(S.tcOffset + cl.in)}` : 'vide'; });
      k.live.classList.toggle('on', lsmKeyOn('LIVE')); k.play.classList.toggle('on', lsmKeyOn('PLAY'));
      k.plst.classList.toggle('on', lsmKeyOn('PLST')); k.shift.classList.toggle('on', LSM.shift); k.loop.classList.toggle('on', LSM.loop); k.page.classList.toggle('on', LSM.page); k.fast.classList.toggle('on', !!EVS.fastJog);
      k.pgm.firstChild.textContent = L.plays < 2 ? 'PGM1' : chI() ? 'PGM2 ▸' : 'PGM1 ▸';
      sc.rec.classList.toggle('on', !!EVS.recording); sc.auto.classList.toggle('on', !!EX.evsAuto);
      if (document.activeElement !== lever) lever.value = String(Math.round(c.lever * 100));
      levTxt.textContent = Math.round(c.lever * 100) + ' %';
      if (scr) scr.update();
    },
    key(e) { return lsmKey(e, (d) => { lever.value = String(clamp(+lever.value + d * 100, 0, 100)); lever.dispatchEvent(new Event('input')); }); },
  };
}
