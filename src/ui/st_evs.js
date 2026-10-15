import { S, camById } from '../state.js';
import { el, clamp, tc, fmt } from '../util.js';
import { hwBtn } from './common.js';
import { EVS, evsAction, evsSetRecording, recordedCams, ROUTER, sourceLabel, MIX, meSource } from '../pipeline.js';
import { recRange } from '../match.js';
import { EX } from '../exercises.js';
import { explain } from './widgets.js';
import { openDevice } from '../equipment/viewer.js';

// Poste ralentis : télécommande façon LSM-VIA + timeline des trains d'enregistrement
export function buildEVS(body, arg = 0, ctx) {
  let chI = arg || 0;
  let shift = false, plstMode = false, loop = false;
  // ---------------- dock ----------------
  ctx.dock.append(el('div', { class: 'dockrow' },
    el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'EVS A · sortie PGM1'), el('div', { class: 'mon fill', 'data-gl': 'EVSA' })),
    el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'EVS B · sortie PGM2'), el('div', { class: 'mon fill', 'data-gl': 'EVSB' })),
    el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Programme (PGM)'), el('div', { class: 'mon fill', 'data-gl': 'PGM' }))), ctx.explainBox);
  // ---------------- écran tactile ----------------
  const appbar = el('div', { class: 'lsm-app' });
  const clipGrid = el('div', { class: 'lsm-clips' });
  const plist = el('div', { class: 'lsm-pl' });
  const trains = el('canvas', { class: 'lsm-trains', width: 760, height: 210 });
  const tcBig = el('div', { class: 'lcd amber big' });
  const tcInfo = el('div', { class: 'lcd' });
  const msg = el('div', { class: 'note warn' });
  const screen = el('div', { class: 'lsm-screen' }, appbar, el('div', { class: 'hwrow' }, tcBig), tcInfo, msg, clipGrid, el('div', { class: 'lsm-sub' }, 'TRAINS D\'ENREGISTREMENT · cliquez pour vous placer'), trains, el('div', { class: 'lsm-sub' }, 'PLAYLIST'), plist);
  // ---------------- touches ----------------
  const K = (l, fn, color = '', title = '') => { const b = el('button', { class: 'lsm-key ' + color, title, onclick: fn }, l); return b; };
  const fkeys = []; const fRow = el('div', { class: 'lsm-row' });
  for (let i = 0; i < 10; i++) { const b = K('F' + (i + 1), () => fKey(i), '', 'Clip F' + (i + 1)); fkeys.push(b); fRow.appendChild(b); }
  const camRow = el('div', { class: 'lsm-row' });
  const tr = {};
  tr.markin = K('MARK IN', () => act('markin'), 'amber'); tr.markout = K('MARK OUT', () => act('markout'), 'amber');
  tr.gotoin = K('GOTO IN', () => act('gotoin')); tr.gotoout = K('GOTO OUT', () => act('gotoout'));
  tr.plst = K('PLST', () => { plstMode = !plstMode; explain(plstMode ? 'PLST : les touches F ajoutent maintenant les clips à la playlist (montage d\'un résumé).' : 'Mode playlist quitté.'); });
  tr.ret = K('RETURN', () => { act('gotoin'); explain('RETURN : retour au point IN, prêt à relancer.'); });
  tr.live = K('LIVE E/E', () => act('live'), 'cyan'); tr.play = K('PLAY', () => act('play', 1), 'green');
  tr.pgm = K('PGM/PRV', () => { chI = 1 - chI; explain(`La télécommande pilote maintenant ${chI ? 'PGM2 (EVS B)' : 'PGM1 (EVS A)'}. Un opérateur pilote souvent deux sorties : il prépare l'une pendant que l'autre est à l'antenne.`); });
  tr.loop = K('LOOP', () => { loop = !loop; explain(loop ? 'LOOP : le clip IN-OUT tourne en boucle (pratique pour l\'écran géant ou une analyse).' : 'Boucle coupée.'); });
  tr.shift = K('SHIFT', () => { shift = !shift; explain(shift ? 'SHIFT : la prochaine touche F sauvegarde le clip (IN/OUT et angle).' : ''); });
  tr.pause = K('PAUSE', () => act('pause'));
  tr.last = K('DERN. ACTION', () => act('lastaction'), 'amber', 'Se cale 3 s avant la dernière action notée');
  const sc = {};
  sc.fast = K('FAST JOG', () => { EVS.fastJog = !EVS.fastJog; explain(EVS.fastJog ? 'FAST JOG : la molette avance 10 fois plus vite (parcours rapide des enregistrements).' : 'Jog normal : image par image.'); }, 'violet');
  sc.rec = K('REC', () => { evsSetRecording(!EVS.recording); explain(EVS.recording ? 'Enregistrement relancé : les trains reprennent.' : 'Enregistrement ARRÊTÉ : plus rien n\'est enregistré, aucun ralenti possible sur la suite du match !'); }, 'red');
  sc.auto = K('OPÉ. AUTO', () => { EX.evsAuto = !EX.evsAuto; explain(EX.evsAuto ? 'Opérateur automatique : après chaque action, l\'EVS A se cale tout seul (utile quand vous êtes au mélangeur).' : 'Opérateur automatique coupé : c\'est vous qui préparez les ralentis.'); }, 'violet');
  sc.plplay = K('PLST PLAY', () => { if (!EVS.playlist.length) { explain('Playlist vide : PLST puis touches F pour ajouter des clips.', 'warn'); return; } evsAction(chI, 'plstplay'); explain(`Lecture de la playlist (${EVS.playlist.length} clips) à ${Math.round(Math.max(0.25, EVS.ch[chI].lever) * 100)} % : les clips s'enchaînent en cut, c'est la base d'un résumé.`); }, 'green');
  sc.plclr = K('PLST CLR', () => { evsAction(chI, 'plstclear'); explain('Playlist vidée.'); });
  const keypad = el('div', { class: 'lsm-pad' },
    el('div', { class: 'lsm-sub' }, 'CLIPS (banque 1)'), fRow,
    el('div', { class: 'lsm-sub' }, 'ANGLES (entrées enregistrées)'), camRow,
    el('div', { class: 'lsm-sub' }, 'TRANSPORT'), el('div', { class: 'lsm-row' }, tr.markin, tr.markout, tr.gotoin, tr.gotoout, tr.last), el('div', { class: 'lsm-row' }, tr.live, tr.play, tr.pause, tr.ret, tr.loop),
    el('div', { class: 'lsm-row' }, tr.pgm, tr.plst, tr.shift),
    el('div', { class: 'lsm-sub' }, 'RACCOURCIS'), el('div', { class: 'lsm-row' }, sc.fast, sc.rec, sc.auto, sc.plplay, sc.plclr));
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
      explain(v === 0 ? 'Levier à 0 : image figée.' : `Levier ${Math.round(v * 100)} %${!wasPlaying && c.playing ? ' : la lecture démarre (sur un LSM, pousser le levier lance le ralenti)' : ''}. ${cam ? `CAM ${cam.id} enregistrée à ${fps} i/s : ` : ''}${per <= 1.05 ? 'chaque image de sortie est une image différente, le mouvement reste fluide.' : `chaque image enregistrée est répétée ≈ ${fmt(per, 1)} fois en sortie, le mouvement saccade${cam && cam.hfr === 1 ? ' (une caméra super ralenti 3x serait fluide jusqu\'à 33 %)' : ''}.`}`, 'lsm:lever');
    }
  });
  const levTxt = el('div', { class: 'lcd' }, '50 %');
  const wheel = el('div', { class: 'wheel', title: 'Jog : faites glisser en rond ou utilisez la molette' }, el('i'));
  let wa = 0, dragging = false, lastA = 0;
  const angOf = (e) => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  wheel.addEventListener('pointerdown', (e) => { dragging = true; lastA = angOf(e); wheel.setPointerCapture(e.pointerId); });
  wheel.addEventListener('pointermove', (e) => { if (!dragging) return; const a = angOf(e); let d = a - lastA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; lastA = a; wa += d; const frames = Math.round(d / 0.09); if (frames) jog(frames); wheel.firstChild.style.transform = `rotate(${wa}rad)`; wheel.firstChild.style.transformOrigin = '5px 65px'; });
  wheel.addEventListener('pointerup', () => { dragging = false; });
  wheel.addEventListener('wheel', (e) => { e.preventDefault(); jog(e.deltaY > 0 ? 2 : -2); }, { passive: false });
  const presets = el('div', { class: 'list' }, ...[100, 66, 50, 33, 25].map((v) => hwBtn(v + ' %', { onclick: () => { lever.value = v; lever.dispatchEvent(new Event('input')); } })));
  const right = el('div', { class: 'lsm-right' }, el('div', { class: 'hwrow', style: { gap: '16px', alignItems: 'center' } }, el('div', { class: 'list', style: { alignItems: 'center' } }, el('span', { class: 'note' }, 'LEVIER'), lever, levTxt), presets), wheel, el('span', { class: 'note' }, 'JOG'));
  body.append(el('div', { class: 'lsm' }, screen, keypad, right),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => openDevice('lsm', chI + 1) }, 'Voir la télécommande (matériel)'), el('button', { class: 'btn small', onclick: () => openDevice('evs', 1) }, 'Voir le serveur (faces avant/arrière)')),
    el('p', { class: 'note' }, 'Méthode : laissez la sortie en LIVE pendant le jeu. Après l\'action : DERN. ACTION (ou jog arrière + MARK IN), choisissez l\'angle, puis poussez le levier quand le réalisateur envoie l\'EVS. Clavier : Espace lecture/pause · I / O · L live · ← → image par image (Maj = 10) · ↑ ↓ levier · 1-8 angle.'));

  function act(a, v) {
    const c = EVS.ch[chI];
    evsAction(chI, a, v);
    const T = (t) => tc(S.tcOffset + t);
    const txt = {
      markin: `MARK IN sur ${T(c.in ?? S.simTime)} : début du clip. Tous les angles enregistrés partagent ce timecode.`,
      markout: `MARK OUT sur ${T(c.out ?? S.simTime)} : fin du clip (la lecture s'arrêtera ici).`,
      gotoin: c.in != null ? `GOTO IN : la sortie se cale sur ${T(c.in)}, image figée, prête à partir.` : 'Pas de point IN.',
      gotoout: c.out != null ? `GOTO OUT : calage sur le point de sortie ${T(c.out)}.` : 'Pas de point OUT.',
      live: 'LIVE (E/E) : la sortie montre l\'entrée en direct, sans retard. C\'est l\'état d\'attente normal entre deux ralentis.',
      play: 'PLAY : lecture à 100 %, vitesse réelle (souvent pour revoir une action complète ou un but sous un autre angle).',
      pause: 'PAUSE : image figée sur le timecode courant.',
      lastaction: S.lastAction ? `Calé 3 s avant la dernière action (${S.lastAction.label}) : IN et OUT posés automatiquement.` : 'Aucune action notée pour l\'instant.',
    }[a];
    if (txt) explain(txt);
  }
  function jog(frames) {
    evsAction(chI, 'jog', frames);
    const c = EVS.ch[chI];
    explain(`Jog ${frames > 0 ? '+' : ''}${frames * (EVS.fastJog ? 10 : 1)} image${Math.abs(frames) > 1 ? 's' : ''} : position ${tc(S.tcOffset + c.t)}, soit ${fmt(Math.max(0, S.simTime - c.t), 1)} s derrière le direct.`, 'lsm:jog');
  }
  function fKey(i) {
    if (plstMode) { if (EVS.clips[i]) { evsAction(chI, 'plstadd', i); explain(`Clip F${i + 1} ajouté à la playlist (${EVS.playlist.length} clips).`); } else explain('Ce clip est vide.', 'warn'); return; }
    if (shift) { evsAction(chI, 'save', i); shift = false; const cl = EVS.clips[i]; explain(cl ? `Clip F${i + 1} sauvegardé : CAM ${cl.cam}, ${fmt(cl.out - cl.in, 1)} s. Il restera disponible même quand la boucle d'enregistrement aura écrasé le direct.` : 'Pas de point IN : rien à sauvegarder.'); return; }
    if (EVS.clips[i]) { evsAction(chI, 'recall', i); explain(`Clip F${i + 1} rappelé sur ${chI ? 'PGM2' : 'PGM1'} : calé sur son IN, prêt à jouer.`); } else explain('Clip vide : SHIFT puis F pour sauvegarder le clip en cours.', 'warn');
  }

  // timeline des trains
  const tg = trains.getContext('2d');
  let tWin = 90;
  trains.addEventListener('click', (e) => {
    const r = trains.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 760;
    if (x < 120) return;
    const now = S.simTime; const t = now - tWin + (x - 120) / 630 * tWin;
    const c = EVS.ch[chI]; evsAction(chI, 'pause'); c.t = clamp(t, recRange()[0], now - 0.02);
    explain(`Navigation dans les trains : position ${tc(S.tcOffset + c.t)} (${fmt(now - c.t, 1)} s avant le direct).`, 'lsm:trains');
  });
  function drawTrains() {
    const g = tg; const W = 760, H = 210; g.fillStyle = '#05080b'; g.fillRect(0, 0, W, H);
    const now = S.simTime; const t0 = now - tWin; const X = (t) => 120 + (t - t0) / tWin * 630;
    g.font = '11px "JetBrains Mono", monospace'; g.fillStyle = '#5d6b77';
    for (let s = Math.ceil(t0 / 10) * 10; s <= now; s += 10) { const x = X(s); g.fillRect(x, 14, 1, H - 20); g.fillText(tc(S.tcOffset + s).slice(3, 8), x - 16, 11); }
    const rows = [];
    for (let i = 1; i <= 8; i++) rows.push([i, ROUTER.map['REC' + i], ROUTER.phase['REC' + i]]);
    rows.forEach(([i, src, ph], r) => {
      const y = 22 + r * 22;
      g.fillStyle = '#93a0ab'; g.fillText(`REC ${i} ${src ? sourceLabel(src).replace('CAM ', 'C') + (src.startsWith('CAM') && camById(+src.slice(3))?.hfr > 1 ? ' ' + 'ABCDEF'[ph] : '') : '—'}`, 6, y + 12);
      if (!src || !src.startsWith('CAM')) return;
      const id = +src.slice(3); const st = EVS.recStart[id];
      if (st == null) return;
      const a = Math.max(t0, st, recRange()[0]); const b = EVS.recording ? now : Math.min(now, EVS.recStopT);
      if (b > a) { g.fillStyle = camById(id)?.hfr > 1 ? '#7c4dbd' : '#1f7a3c'; g.fillRect(X(a), y + 2, X(b) - X(a), 14); }
      if (!EVS.recording && EVS.recStopT > t0) { g.fillStyle = '#ff3b30'; g.fillRect(X(EVS.recStopT), y, 2, 18); }
    });
    for (const e of S.events) { if (e.t < t0) continue; g.fillStyle = '#ffd23f'; g.fillRect(X(e.t) - 1, 16, 2, H - 22); g.save(); g.translate(X(e.t) + 3, H - 6); g.fillText(e.label, 0, 0); g.restore(); }
    EVS.ch.forEach((c, k) => {
      const col = k ? '#46c6f2' : '#ff8a1f';
      if (c.in != null && c.in > t0) { g.fillStyle = col; g.fillRect(X(c.in), 16, 2, H - 24); g.fillText('IN', X(c.in) + 3, 26 + k * 10); }
      if (c.out != null && c.out > t0) { g.fillStyle = col; g.fillRect(X(c.out), 16, 2, H - 24); g.fillText('OUT', X(c.out) + 3, 26 + k * 10); }
      const t = c.mode === 'live' ? now : c.t;
      if (t >= t0) { g.fillStyle = col; g.beginPath(); g.moveTo(X(t), 14); g.lineTo(X(t) - 6, 4); g.lineTo(X(t) + 6, 4); g.fill(); g.fillRect(X(t) - 1, 14, 2, H - 20); }
    });
    g.fillStyle = '#ff8a1f'; g.fillText('▼ PGM1', 6, 11); g.fillStyle = '#46c6f2'; g.fillText('▼ PGM2', 60, 11);
  }

  let lastRec = '';
  return {
    frame() { drawTrains(); },
    update() {
      const c = EVS.ch[chI];
      if (c.pl == null && loop && c.mode === 'pause' && c.out != null && Math.abs(c.t - c.out) < 0.05) { evsAction(chI, 'gotoin'); evsAction(chI, 'playvar'); }
      const live = c.mode === 'live';
      const t = live ? S.simTime : c.t;
      appbar.textContent = `PAGE 1 · BANK 1 · SERVEUR XT-VIA · CONTRÔLE ${chI ? 'PGM2 (EVS B)' : 'PGM1 (EVS A)'} · ${meSource(MIX.pgm) === (chI ? 'EVSB' : 'EVSA') ? '● À L\'ANTENNE' : 'hors antenne'}`;
      tcBig.textContent = `${tc(S.tcOffset + t)}  ${live ? 'E/E' : c.playing ? '▶ ' + Math.round(c.speed * 100) + '%' : '❚❚'}${c.pl ? ' · PLST ' + (c.pl.i + 1) + '/' + EVS.playlist.length : ''}`;
      tcInfo.textContent = `CAM ${c.cam} · IN ${c.in != null ? tc(S.tcOffset + c.in).slice(3) : '--'} · OUT ${c.out != null ? tc(S.tcOffset + c.out).slice(3) : '--'} · retard ${fmt(Math.max(0, S.simTime - t), 1)} s`;
      msg.textContent = !live && !c.ok ? c.msg : '';
      const rec = recordedCams();
      const key = rec.join() + '|' + S.cams.map((x) => x.id).join();
      if (key !== lastRec) {
        lastRec = key; camRow.innerHTML = '';
        rec.forEach((id, i) => { const cam = camById(id); const b = K(`CAM ${'ABCDEFGH'[i]}`, () => { evsAction(chI, 'cam', id); explain(`Angle ${'ABCDEFGH'[i]} = CAM ${id}${cam.hfr > 1 ? ` (super ralenti ${cam.hfr}x, ${50 * cam.hfr} i/s)` : ''} sur le même timecode : c'est le multicam. On peut changer d'angle en pause sans perdre l'action.`); }, 'cyan'); b.dataset.id = id; b.title = `CAM ${id}`; b.appendChild(el('small', {}, `${id}${cam.hfr > 1 ? ' · ' + cam.hfr + 'x' : ''}`)); camRow.appendChild(b); });
        if (!rec.length) camRow.appendChild(el('span', { class: 'note warn' }, 'Aucune caméra enregistrée : affectez des entrées REC à la grille.'));
      }
      [...camRow.children].forEach((b) => b.classList && b.classList.toggle('on', +b.dataset.id === c.cam));
      fkeys.forEach((b, i) => { b.classList.toggle('on', !!EVS.clips[i]); b.title = EVS.clips[i] ? `CAM ${EVS.clips[i].cam} · ${tc(S.tcOffset + EVS.clips[i].in)}` : 'vide'; });
      tr.live.classList.toggle('on', live); tr.play.classList.toggle('on', c.playing && c.speed === 1); tr.pause.classList.toggle('on', c.mode === 'pause');
      tr.plst.classList.toggle('on', plstMode); tr.shift.classList.toggle('on', shift); tr.loop.classList.toggle('on', loop); tr.pgm.textContent = chI ? 'PGM2 ▸' : 'PGM1 ▸';
      sc.fast.classList.toggle('on', EVS.fastJog); sc.rec.classList.toggle('on', EVS.recording); sc.auto.classList.toggle('on', !!EX.evsAuto);
      if (document.activeElement !== lever) lever.value = Math.round(c.lever * 100);
      levTxt.textContent = Math.round(c.lever * 100) + ' %';
      clipGrid.innerHTML = '';
      for (let i = 0; i < 10; i++) { const cl = EVS.clips[i]; clipGrid.appendChild(el('div', { class: 'lsm-clip' + (cl ? ' full' : '') }, el('b', {}, 'F' + (i + 1)), el('span', {}, cl ? `CAM ${cl.cam} · ${fmt(cl.out - cl.in, 1)} s` : 'vide'))); }
      plist.textContent = EVS.playlist.length ? EVS.playlist.map((k, j) => `${j + 1}. F${k + 1}${EVS.clips[k] ? ' (CAM ' + EVS.clips[k].cam + ')' : ''}`).join('   ') : 'vide';
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
