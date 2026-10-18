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

// Poste ralentis : télécommande type EVS LSM (logiciel Multicam) pilotant un serveur XT4K,
// avec l'écran du serveur (trains d'enregistrement, clips, playlist).
export function buildEVS(body, arg = 0, ctx) {
  const L0 = evsLayout();
  let chI = L0.plays < 2 ? 0 : (typeof arg === 'number' ? arg : 0);
  EVS.lsmCh = chI;
  let shift = false, plstMode = false, loop = false, pagePending = false;
  // ---------------- dock ----------------
  ctx.dock.append(el('div', { class: 'dockrow' },
    el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'EVS A · sortie PGM1'), el('div', { class: 'mon fill', 'data-gl': 'EVSA' })),
    el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, L0.plays < 2 ? 'EVS B · (pas de canal en UHD)' : 'EVS B · sortie PGM2'), el('div', { class: 'mon fill', 'data-gl': 'EVSB' })),
    el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Programme (PGM)'), el('div', { class: 'mon fill', 'data-gl': 'PGM' }))), ctx.explainBox);
  // ---------------- écran du serveur (clip screen / OSD) ----------------
  const appbar = el('div', { class: 'lsm-app' });
  const cfg = el('div', { class: 'lsm-cfg' });
  const clipGrid = el('div', { class: 'lsm-clips' });
  const plist = el('div', { class: 'lsm-pl' });
  const trains = el('canvas', { class: 'lsm-trains', width: 760, height: 210 });
  const msg = el('div', { class: 'note warn' });
  const screen = el('div', { class: 'lsm-screen' }, el('div', { class: 'lsm-sub' }, `ÉCRAN DU SERVEUR ${EQUIP.evsModel} · MULTICAM`), appbar, cfg, msg, clipGrid, el('div', { class: 'lsm-sub' }, 'TRAINS D\'ENREGISTREMENT · cliquez pour vous placer'), trains, el('div', { class: 'lsm-sub' }, 'PLAYLIST'), plist);
  // ---------------- télécommande ----------------
  const lcd = el('div', { class: 'lsm-lcd' });
  const K = (l, fn, color = '', title = '', sec = '') => el('button', { class: 'lsm-key ' + color, title, onclick: fn }, l, sec ? el('small', {}, sec) : null);
  const fkeys = []; const fRow = el('div', { class: 'lsm-row' });
  for (let i = 0; i < 10; i++) { const b = K('F' + (i + 1), () => fKey(i)); b.appendChild(el('small', {}, '')); fkeys.push(b); fRow.appendChild(b); }
  const camRow = el('div', { class: 'lsm-row' });
  const sh = (fn) => { shift = false; fn(); };
  const k = {};
  k.in = K('IN', () => (shift ? sh(() => act('gotoin')) : act('markin')), 'amber', 'IN · avec SHIFT : GOTO IN', 'GOTO IN');
  k.out = K('OUT', () => (shift ? sh(() => act('gotoout')) : act('markout')), 'amber', 'OUT · avec SHIFT : GOTO OUT', 'GOTO OUT');
  k.plst = K('PLST', () => (shift ? sh(browseToggle) : plstToggle()), '', 'PLST · avec SHIFT : BROWSE', 'BROWSE');
  k.loop = K('LOOP', () => { loop = !loop; explain(loop ? 'LOOP : le clip IN-OUT tourne en boucle (écran géant, analyse).' : 'Boucle coupée.'); });
  k.ret = K('RETURN', () => { act('return'); explain('RETURN : on quitte les limites du clip et on se retrouve sur la même image dans le train d\'enregistrement. Utile quand le clip est trop court : on peut lire au-delà du point OUT.'); });
  k.play = K('PLAY', () => { if (plstMode) { playPlaylist(); return; } act('play', 1); }, 'green');
  k.live = K('LIVE E/E', () => act('live'), 'cyan');
  k.fast = K('FAST JOG', () => { EVS.fastJog = !EVS.fastJog; explain(EVS.fastJog ? 'FAST JOG : la molette parcourt les enregistrements beaucoup plus vite (recalage rapide). Désactivé automatiquement après PLAY ou LIVE.' : 'Jog normal : image par image.'); }, 'violet');
  k.take = K('TAKE', () => {
    if (evsLayout().plays < 2) { explain('TAKE : pas de second canal de lecture dans cette configuration (UHD avec un seul XT4K).', 'warn'); return; }
    evsAction(chI, 'take'); explain('TAKE (mode 2 PGM) : le contenu de PGM1 et PGM2 est échangé. En mode PGM + PRV, TAKE envoie à l\'antenne ce qui était préparé sur PRV.');
  });
  k.pgm = K('PGM/PRV', () => {
    if (evsLayout().plays < 2) { explain('Un seul canal de lecture : la télécommande pilote PGM1.', 'warn'); return; }
    chI = 1 - chI; EVS.lsmCh = chI; explain(`La télécommande pilote maintenant ${chI ? 'PGM2 (EVS B)' : 'PGM1 (EVS A)'}. Avec une seule LSM, l'opérateur prépare une sortie pendant que l'autre est à l'antenne.`);
  });
  k.shift = K('SHIFT', () => { shift = !shift; explain(shift ? 'SHIFT : la prochaine touche donne sa fonction secondaire (inscrite en petit dessous).' : 'SHIFT relâché.'); });
  k.menu = K('MENU', () => explain('MENU : bascule entre le menu opérationnel et le menu secondaire (réglages, modes PGM). SHIFT + MENU revient au menu principal.'));
  k.clear = K('CLEAR', () => { if (plstMode) { evsAction(chI, 'plstclear'); explain('Playlist vidée.'); return; } const c = EVS.ch[chI]; c.in = null; c.out = null; explain('CLEAR : points IN et OUT effacés.'); });
  k.page = K('PAGE', () => { if (!shift) { explain('PAGE : faites SHIFT puis PAGE, puis une touche F pour choisir la page (1 à 10).'); return; } shift = false; pagePending = true; explain('Choix de la page : appuyez sur une touche F (F1 = page 1 … F10 = page 10).'); }, '', 'SHIFT + PAGE puis F : choix de la page');
  k.last = K('DERN. ACTION', () => act('lastaction'), 'amber', 'Raccourci du simulateur : se cale 3 s avant la dernière action notée');
  const sc = {};
  sc.rec = K('REC', () => { evsSetRecording(!EVS.recording); explain(EVS.recording ? 'Enregistrement relancé : les trains reprennent.' : 'Enregistrement ARRÊTÉ : plus rien n\'est enregistré, aucun ralenti possible sur la suite du match !', EVS.recording ? '' : 'warn'); }, 'red');
  sc.auto = K('OPÉ. AUTO', () => { EX.evsAuto = !EX.evsAuto; explain(EX.evsAuto ? 'Opérateur automatique : après chaque action, l\'EVS A se cale tout seul (utile quand vous êtes au mélangeur).' : 'Opérateur automatique coupé : c\'est vous qui préparez les ralentis.'); }, 'violet');
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
  const lever = el('input', { type: 'range', min: 0, max: 100, step: 1, value: 50, class: 'tbar lsm-lever', id: 'lsmlever', 'aria-label': 'Levier de vitesse' });
  let levSeq = 0;
  lever.addEventListener('input', () => {
    const c = EVS.ch[chI]; const wasPlaying = c.playing;
    evsAction(chI, 'lever', +lever.value / 100);
    const cam = camById(c.cam); const v = +lever.value / 100;
    if (performance.now() - levSeq > 300) {
      levSeq = performance.now();
      const fps = cam ? 50 * cam.hfr : 50;
      const per = v > 0 ? 1 / (v * fps / 50) : Infinity;
      explain(v === 0 ? 'Levier à 0 : image figée.' : `Levier ${Math.round(v * 100)} %${!wasPlaying && c.playing ? ' : la lecture démarre (pousser le levier lance le ralenti)' : ''}. ${cam ? `CAM ${cam.id} enregistrée à ${fps} i/s : ` : ''}${per <= 1.05 ? 'chaque image de sortie est une image différente, le mouvement reste fluide.' : `chaque image enregistrée est répétée ≈ ${fmt(per, 1)} fois en sortie, le mouvement saccade${cam && cam.hfr === 1 ? ' (une caméra super ralenti 3x serait fluide jusqu\'à 33 %)' : ''}.`}`, 'lsm:lever');
    }
  });
  const levTxt = el('div', { class: 'lcd' }, '50 %');
  const wheel = el('div', { class: 'wheel', title: 'Jog : faites glisser en rond ou utilisez la molette' }, el('i'));
  let wa = 0, dragging = false, lastA = 0;
  const angOf = (e) => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  wheel.addEventListener('pointerdown', (e) => { dragging = true; lastA = angOf(e); wheel.setPointerCapture(e.pointerId); });
  // un tour de molette ≈ 35 images (manuel Multicam)
  wheel.addEventListener('pointermove', (e) => { if (!dragging) return; const a = angOf(e); let d = a - lastA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; const frames = Math.round(d / (2 * Math.PI) * 35); if (!frames) return; lastA = a; wa += d; jog(frames); wheel.firstChild.style.transform = `rotate(${wa}rad)`; wheel.firstChild.style.transformOrigin = '5px 65px'; });
  wheel.addEventListener('pointerup', () => { dragging = false; });
  wheel.addEventListener('wheel', (e) => { e.preventDefault(); jog(e.deltaY > 0 ? 2 : -2); }, { passive: false });
  const presets = el('div', { class: 'list' }, ...[100, 66, 50, 33, 25].map((v) => hwBtn(v + ' %', { onclick: () => { lever.value = v; lever.dispatchEvent(new Event('input')); } })));
  const right = el('div', { class: 'lsm-right' }, el('div', { class: 'hwrow', style: { gap: '16px', alignItems: 'center' } }, el('div', { class: 'list', style: { alignItems: 'center' } }, el('span', { class: 'note' }, 'LEVIER'), lever, levTxt), presets), wheel, el('span', { class: 'note' }, 'JOG'));
  body.append(el('div', { class: 'lsm' }, keypad, right, screen),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => openDevice('lsm', 1) }, 'Voir la télécommande LSM'), el('button', { class: 'btn small', onclick: () => openDevice('evs', 1) }, `Voir le serveur ${EQUIP.evsModel}`), el('button', { class: 'btn small', onclick: () => openDevice('ipd', 1) }, 'Voir le poste IPDirector')),
    el('p', { class: 'note' }, 'Méthode : laissez la sortie en LIVE pendant le jeu. Après l\'action : DERN. ACTION (ou jog arrière + IN), choisissez l\'angle, puis poussez le levier quand le réalisateur envoie l\'EVS. Clips : IN / OUT puis F libre = créer · F occupée = rappeler · SHIFT + F = écraser · SHIFT + PAGE puis F = changer de page. Clavier : Espace lecture/pause · I / O · L live · ← → image par image (Maj = 10) · ↑ ↓ levier · 1-8 angle.'),
    el('p', { class: 'note' }, 'Disposition simplifiée de la télécommande : les fonctions suivent les manuels Multicam (versions 10 à 12), mais l\'emplacement exact des touches dépend de votre modèle et de votre version.'));

  function act(a, v) {
    const c = EVS.ch[chI];
    evsAction(chI, a, v);
    const T = (t) => tc(S.tcOffset + t);
    const txt = {
      markin: `IN sur ${T(c.in ?? S.simTime)} : début du clip. Tous les angles enregistrés partagent ce timecode.`,
      markout: `OUT sur ${T(c.out ?? S.simTime)} : fin du clip (la lecture s'arrêtera ici).`,
      gotoin: c.in != null ? `GOTO IN : la sortie se cale sur ${T(c.in)}, image figée, prête à partir.` : 'Pas de point IN.',
      gotoout: c.out != null ? `GOTO OUT : calage sur le point de sortie ${T(c.out)}.` : 'Pas de point OUT.',
      live: 'LIVE (E/E) : la sortie montre l\'entrée en direct, sans retard. C\'est l\'état d\'attente normal entre deux ralentis.',
      play: 'PLAY : lecture à 100 %, vitesse réelle (souvent pour revoir une action complète ou un but sous un autre angle).',
      lastaction: S.lastAction ? `Calé 3 s avant la dernière action (${S.lastAction.label}) : IN et OUT posés automatiquement.` : 'Aucune action notée pour l\'instant.',
    }[a];
    if (txt) explain(txt);
  }
  function jog(frames) {
    if (EVS.browse) { evsAction(chI, 'browse', frames); explain(EVS.browseIdx != null ? `BROWSE : clip ${clipName(EVS.browseIdx)} chargé (la molette fait défiler les clips de la base).` : 'BROWSE : aucun clip dans la base.', 'lsm:browse'); return; }
    evsAction(chI, 'jog', frames);
    const c = EVS.ch[chI];
    explain(`Jog ${frames > 0 ? '+' : ''}${frames * (EVS.fastJog ? 10 : 1)} image${Math.abs(frames) > 1 ? 's' : ''} : position ${tc(S.tcOffset + c.t)}, soit ${fmt(Math.max(0, S.simTime - c.t), 1)} s derrière le direct.`, 'lsm:jog');
  }
  function plstToggle() { plstMode = !plstMode; explain(plstMode ? 'PLST : mode playlist. Les touches F ajoutent les clips à la playlist, PLAY la lance, CLEAR la vide.' : 'Mode playlist quitté.'); }
  function browseToggle() { EVS.browse = !EVS.browse; explain(EVS.browse ? 'BROWSE : la molette jog fait défiler les clips de la base.' : 'BROWSE désactivé : la molette repasse en recherche image par image.'); }
  function playPlaylist() {
    if (!EVS.playlist.length) { explain('Playlist vide : PLST puis touches F pour ajouter des clips.', 'warn'); return; }
    evsAction(chI, 'plstplay'); explain(`Lecture de la playlist (${EVS.playlist.length} clips) à ${Math.round(Math.max(0.25, EVS.ch[chI].lever) * 100)} % : les clips s'enchaînent, c'est la base d'un résumé.`);
  }
  function fKey(i) {
    if (pagePending) { pagePending = false; EVS.page = i + 1; explain(`Page ${EVS.page} : les touches F donnent maintenant les clips ${EVS.page}11 à ${EVS.page}10.`); return; }
    const idx = (EVS.page - 1) * 10 + i;
    if (plstMode) { if (EVS.clips[idx]) { evsAction(chI, 'plstadd', idx); explain(`Clip ${clipName(idx)} ajouté à la playlist (${EVS.playlist.length} clips).`); } else explain('Ce clip est vide.', 'warn'); return; }
    const cur = EVS.ch[chI];
    // touche vide + point IN ou OUT marqué : le clip est créé sur cette touche (SHIFT + F : écrase un clip existant)
    if (shift || (!EVS.clips[idx] && (cur.in != null || cur.out != null))) { shift = false; evsAction(chI, 'save', idx); const cl = EVS.clips[idx]; explain(cl ? `Clip ${clipName(idx)} sauvegardé (page ${EVS.page}, F${i + 1}, angle de la CAM ${cl.cam}, ${fmt(cl.out - cl.in, 1)} s), avec tous les angles enregistrés. Il est protégé de l'écrasement de la boucle et visible dans IPDirector.` : 'Pas de point IN : rien à sauvegarder.'); return; }
    if (EVS.clips[idx]) { evsAction(chI, 'recall', idx); explain(`Clip ${clipName(idx)} rappelé sur ${chI ? 'PGM2' : 'PGM1'} : calé sur son IN, prêt à jouer.`); } else explain('Touche vide : marquez d\'abord un IN (et un OUT), puis appuyez sur une touche F libre pour créer le clip.', 'warn');
  }

  // timeline des trains
  const tg = trains.getContext('2d');
  const tWin = 90;
  trains.addEventListener('click', (e) => {
    const r = trains.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 760;
    if (x < 120) return;
    const now = S.simTime; const t = now - tWin + (x - 120) / 630 * tWin;
    const c = EVS.ch[chI]; evsAction(chI, 'pause'); c.t = clamp(t, recRange()[0], now - 0.02);
    explain(`Navigation dans les trains : position ${tc(S.tcOffset + c.t)} (${fmt(now - c.t, 1)} s avant le direct).`, 'lsm:trains');
  });
  function drawTrains() {
    const g = tg; const W = 760, H = 210; g.fillStyle = '#05080b'; g.fillRect(0, 0, W, H);
    const L = evsLayout();
    const now = S.simTime; const t0 = now - tWin; const X = (t) => 120 + (t - t0) / tWin * 630;
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

  let lastRec = '';
  return {
    frame() { drawTrains(); },
    update() {
      const L = evsLayout();
      if (chI >= L.plays) { chI = 0; EVS.lsmCh = 0; }
      const c = EVS.ch[chI];
      if (c.pl == null && loop && c.mode === 'pause' && c.out != null && Math.abs(c.t - c.out) < 0.05) { evsAction(chI, 'gotoin'); evsAction(chI, 'playvar'); }
      const live = c.mode === 'live';
      const t = live ? S.simTime : c.t;
      const recCams = recordedCams();
      const camLetter = (id) => { const i = recCams.indexOf(id); return i >= 0 ? 'ABCDEFGH'[i] : '?'; };
      appbar.textContent = `PAGE ${EVS.page} · ${EQUIP.evsServers} × ${EQUIP.evsModel} · CONTRÔLE ${chI ? 'PGM2 (EVS B)' : 'PGM1 (EVS A)'} · ${meSource(MIX.pgm) === (chI ? 'EVSB' : 'EVSA') ? '● À L\'ANTENNE' : 'hors antenne'}`;
      cfg.textContent = `Configuration : ${L.label}.`;
      lcd.innerHTML = '';
      const lines = [
        `PGM${chI + 1}  CAM ${camLetter(c.cam)} (${c.cam})  ${live ? 'E/E' : c.playing ? '▶ ' + Math.round(c.speed * 100) + '%' : 'STILL'}${c.pl ? '  PLST ' + (c.pl.i + 1) + '/' + EVS.playlist.length : ''}`,
        `TC ${tc(S.tcOffset + t)}   −${fmt(Math.max(0, S.simTime - t), 1)} s`,
        `IN ${c.in != null ? tc(S.tcOffset + c.in).slice(3) : '--:--:--'}  OUT ${c.out != null ? tc(S.tcOffset + c.out).slice(3) : '--:--:--'}`,
        `${shift ? 'SHIFT  ' : ''}${plstMode ? 'PLST  ' : ''}${EVS.browse ? 'BROWSE  ' : ''}${pagePending ? 'PAGE ?  ' : ''}${EVS.fastJog ? 'FAST JOG  ' : ''}${EVS.recording ? 'REC ●' : 'REC ARRÊTÉ'}`,
      ];
      for (const l of lines) lcd.appendChild(el('div', {}, l));
      msg.textContent = !live && !c.ok ? c.msg : '';
      const key = recCams.join() + '|' + S.cams.map((x) => x.id).join();
      if (key !== lastRec) {
        lastRec = key; camRow.innerHTML = '';
        recCams.forEach((id, i) => { const cam = camById(id); const b = K(`CAM ${'ABCDEFGH'[i]}`, () => { evsAction(chI, 'cam', id); explain(`Angle ${'ABCDEFGH'[i]} = CAM ${id}${cam.hfr > 1 ? ` (super ralenti ${cam.hfr}x, ${50 * cam.hfr} i/s)` : ''} sur le même timecode : c'est le multicam. On peut changer d'angle en pause sans perdre l'action.`); }, 'cyan'); b.dataset.id = id; b.title = `CAM ${id}`; b.appendChild(el('small', {}, `${id}${cam.hfr > 1 ? ' · ' + cam.hfr + 'x' : ''}`)); camRow.appendChild(b); });
        if (!recCams.length) camRow.appendChild(el('span', { class: 'note warn' }, 'Aucune caméra enregistrée : affectez des entrées REC à la grille.'));
      }
      [...camRow.children].forEach((b) => b.classList && b.classList.toggle('on', +b.dataset.id === c.cam));
      fkeys.forEach((b, i) => { const idx = (EVS.page - 1) * 10 + i; const cl = EVS.clips[idx]; b.classList.toggle('on', !!cl); b.lastChild.textContent = pagePending ? 'page ' + (i + 1) : cl ? clipName(idx) : ''; b.title = cl ? `${clipName(idx)} · CAM ${cl.cam} · ${tc(S.tcOffset + cl.in)}` : 'vide'; });
      k.live.classList.toggle('on', live); k.play.classList.toggle('on', c.playing && c.speed === 1);
      k.plst.classList.toggle('on', plstMode || EVS.browse); k.shift.classList.toggle('on', shift); k.loop.classList.toggle('on', loop); k.page.classList.toggle('on', pagePending); k.fast.classList.toggle('on', EVS.fastJog);
      k.pgm.firstChild.textContent = L.plays < 2 ? 'PGM1' : chI ? 'PGM2 ▸' : 'PGM1 ▸';
      sc.rec.classList.toggle('on', EVS.recording); sc.auto.classList.toggle('on', !!EX.evsAuto);
      if (document.activeElement !== lever) lever.value = Math.round(c.lever * 100);
      levTxt.textContent = Math.round(c.lever * 100) + ' %';
      clipGrid.innerHTML = '';
      for (let i = 0; i < 10; i++) { const idx = (EVS.page - 1) * 10 + i; const cl = EVS.clips[idx]; clipGrid.appendChild(el('div', { class: 'lsm-clip' + (cl ? ' full' : '') }, el('b', {}, cl ? clipName(idx) : 'F' + (i + 1)), el('span', {}, cl ? `${cl.name || 'CAM ' + cl.cam} · ${fmt(cl.out - cl.in, 1)} s` : 'vide'))); }
      plist.textContent = EVS.playlist.length ? EVS.playlist.map((kk, j) => `${j + 1}. ${clipName(kk)}${EVS.clips[kk] && EVS.clips[kk].name ? ' ' + EVS.clips[kk].name : ''}`).join('   ') : 'vide';
    },
    key(e) {
      if (e.code === 'Space') { const c = EVS.ch[chI]; evsAction(chI, 'toggle'); explain(c.playing ? `Lecture à ${Math.round(c.speed * 100)} %.` : 'Pause.'); return true; }
      if (e.code === 'KeyI') { act('markin'); return true; }
      if (e.code === 'KeyO') { act('markout'); return true; }
      if (e.code === 'KeyL') { act('live'); return true; }
      if (e.code === 'ArrowLeft') { jog(e.shiftKey ? -10 : -1); return true; }
      if (e.code === 'ArrowRight') { jog(e.shiftKey ? 10 : 1); return true; }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { lever.value = clamp(+lever.value + (e.code === 'ArrowUp' ? 10 : -10), 0, 100); lever.dispatchEvent(new Event('input')); return true; }
      if (e.code.startsWith('Digit')) { const r = recordedCams(); const id = r[+e.code.slice(5) - 1]; if (id) evsAction(chI, 'cam', id); return true; }
      return false;
    },
  };
}
