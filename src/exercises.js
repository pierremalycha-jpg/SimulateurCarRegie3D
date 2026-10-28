// @ts-check
import { setKeyMode } from './ui/commut.js';
import { S, on, camById } from './state.js';
import { MIX, meSource, evsAction, EVS, sourceLabel, recordedCams } from './pipeline.js';
import { M } from './match.js';
import { intercom, modal } from './ui/common.js';
import { el, rand } from './util.js';

// Réalisateur virtuel (exercice truquiste) et opérateur EVS automatique
export const EX = { mode: null, score: 0, max: 0, n: 0, order: null, next: 0, evsAuto: true, autoPlayA: false, log: [], seq: [] };

function meIndexOf(src) { for (let n = 1; n <= 22; n++) if (meSource(n) === src) return n; return null; }
function say(msg, kind) {
  intercom('RÉAL', msg, kind);
  if (S.directorVoice && window.speechSynthesis) { try { const u = new SpeechSynthesisUtterance(msg); u.lang = 'fr-FR'; u.rate = 1.15; window.speechSynthesis.speak(u); } catch (e) { /* indisponible */ } }
}
function camNum(src) { return src.startsWith('CAM') ? src.slice(3) : sourceLabel(src); }

export function startExercise(mode) {
  EX.mode = mode; EX.score = 0; EX.max = 0; EX.n = 0; EX.order = null; EX.next = S.time + 3; EX.seq = []; EX.log = [];
  if (mode === 'td') setKeyMode('preset');
  say('Exercice truquiste. J\'annonce les caméras : prépare-les au PVW, la rangée preset (touche du chiffre), puis envoie au top avec la transition demandée (Espace = CUT, Entrée du pavé = AUTO). Bonne chance !');
}
export function stopExercise() { if (EX.mode) { EX.mode = null; EX.order = null; intercom('RÉAL', 'Exercice arrêté.'); } }

function pickCam() {
  const b = M.ball; const pgm = meSource(MIX.pgm);
  const byRole = (roles) => S.cams.filter((c) => roles.includes(c.role) && c.signalOK && 'CAM' + c.id !== pgm);
  let pool;
  const nearGoal = Math.abs(b.x) > 34;
  const r = rand();
  if (nearGoal && r < 0.5) pool = byRole(['semi', 'serre']);
  else if (r < 0.45) pool = byRole(['large']);
  else if (r < 0.8) pool = byRole(['serre', 'joueur', 'semi']);
  else pool = byRole(['suivi', 'bancs', 'tribune', 'grue', 'tactique']);
  if (!pool.length) pool = S.cams.filter((c) => c.signalOK && 'CAM' + c.id !== pgm);
  const c = pool[Math.floor(rand() * pool.length)];
  return c ? 'CAM' + c.id : null;
}

function finish() {
  const pct = EX.max ? Math.round(EX.score / EX.max * 100) : 0;
  EX.mode = null;
  say(`Fin de l'exercice. Score ${EX.score} sur ${EX.max}.`, pct > 70 ? 'ok' : 'bad');
  modal.open('Résultat de l\'exercice truquiste', el('div', { class: 'prose' },
    el('p', {}, `Score : ${EX.score} / ${EX.max} (${pct} %).`),
    el('ul', { class: 'steps' }, EX.log.map((l) => el('li', {}, l))),
    el('p', { class: 'note' }, 'Barème : préparation au PVW dans les 4 s = 1 point ; transition lancée moins de 1,5 s après le top = 2 points (moins de 3 s = 1 point) ; transition demandée respectée (cut, mix ou volet logo) = 1 point. Une source non envoyée dans les 6 s compte comme manquée.')), { width: 700 });
}

export function updateExercises(dt) {
  // opérateur EVS automatique : lance la lecture quand l'EVS A passe à l'antenne
  const pgm = meSource(MIX.pgm);
  const chA = EVS.ch[0];
  // (un média de l'émission chargé sur ce canal ne se lance pas ici : c'est l'IPDirector qui le lance)
  if ((EX.evsAuto || EX.autoPlayA) && pgm === 'EVSA' && chA.mode === 'pause' && !chA.media && !EX._played && (MIX.auto ? MIX.pos > 0.45 : true)) {
    evsAction(0, 'playvar'); EX._played = true; EX.autoPlayA = false;
  }
  if (pgm !== 'EVSA') EX._played = false;
  if (EX.mode !== 'td') return;
  const now = S.time;
  if (!EX.order) {
    if (EX.seq.length && now > EX.next) { EX.order = EX.seq.shift(); EX.order.t0 = now; EX.order.phase = 'prep'; say(EX.order.prep); EX.max += 1; return; }
    if (now < EX.next) return;
    if (EX.n >= 12) { finish(); return; }
    const src = pickCam(); if (!src) { EX.next = now + 2; return; }
    const kind = rand() < 0.7 ? 'cut' : 'mix';
    EX.order = { src, kind, t0: now, phase: 'prep', prep: `Prépare la ${camNum(src)}…`, go: kind === 'cut' ? `Top ! Envoie la ${camNum(src)}` : `Enchaîne sur la ${camNum(src)}` };
    EX.n++; EX.max += 1;
    say(EX.order.prep);
    return;
  }
  const o = EX.order; const n = meIndexOf(o.src);
  if (o.phase === 'prep') {
    if (n && MIX.pst === n && !o.prepOk) { o.prepOk = true; if (now - o.t0 < 4) EX.score += 1; }
    if ((o.prepOk && now - o.t0 > 1.4) || now - o.t0 > 5) {
      o.phase = 'go'; o.t1 = now; EX.max += 3; say(o.go);
      o.startTrans = { mixes: S.stats.mixes, stingers: S.stats.stingers, cuts: S.stats.cuts };
    }
  } else if (o.phase === 'go') {
    // le réflexe se mesure au départ de la transition : un mix ou un volet dure ensuite 0,4 à 0,6 s
    if (o.tStart == null && (MIX.auto || S.stats.cuts > o.startTrans.cuts || S.stats.mixes > o.startTrans.mixes || S.stats.stingers > o.startTrans.stingers)) o.tStart = now;
    if (meSource(MIX.pgm) === o.src && !MIX.auto) {
      const d = (o.tStart ?? now) - o.t1;
      let pts = d < 1.5 ? 2 : d < 3 ? 1 : 0;
      const did = S.stats.stingers > o.startTrans.stingers ? 'stinger' : S.stats.mixes > o.startTrans.mixes ? 'mix' : 'cut';
      const okType = did === o.kind || (o.kind === 'mix' && did === 'mix');
      if (okType) pts += 1;
      EX.score += pts;
      const msg = `${sourceLabel(o.src)} : ${d.toFixed(1).replace('.', ',')} s${okType ? '' : ` (transition attendue : ${o.kind === 'cut' ? 'cut' : o.kind === 'mix' ? 'mix' : 'volet logo'})`}`;
      EX.log.push(msg);
      intercom('RÉAL', pts >= 3 ? 'Parfait.' : !okType ? `Mauvaise transition : je voulais un ${o.kind === 'cut' ? 'cut' : o.kind === 'mix' ? 'mix' : 'volet logo'}.` : d >= 1.5 ? 'Un peu lent !' : 'Bien.', pts >= 2 ? 'ok' : 'bad');
      if (o.after) o.after();
      EX.order = null; EX.next = now + 3 + rand() * 4;
    } else if (now - o.t1 > 6) {
      EX.log.push(`${sourceLabel(o.src)} : manqué`);
      intercom('RÉAL', 'Trop tard, on l\'a ratée… on continue.', 'bad');
      EX.order = null; EX.next = now + 3;
    }
  }
}

on('match', (e) => {
  if (e.type === 'shot' || e.type === 'goal' || e.type === 'save') {
    const label = e.type === 'goal' ? 'But' : e.type === 'save' ? 'Arrêt du gardien' : 'Tir';
    S.lastAction = { t: S.simTime, type: e.type, label };
    S.events.push({ t: S.simTime, label, clock: M.clock, type: e.type });
    if (S.events.length > 200) S.events.shift();
    if (EX.evsAuto && S.station !== 'evs') {
      setTimeout(() => {
        if (meSource(MIX.pgm) === 'EVSA') return; // ne pas toucher un ralenti à l'antenne
        if (EVS.ch[0].media) return; // ni un média de l'émission chargé sur le canal (UHD : un seul canal de lecture)
        evsAction(0, 'lastaction');
        const rec = recordedCams().map((id) => camById(id)).filter(Boolean);
        const best = rec.find((c) => c.hfr > 1) || rec.find((c) => c.role === 'serre') || rec[0];
        if (best) { evsAction(0, 'cam', best.id); evsAction(0, 'lever', best.hfr > 1 ? 0.33 : 0.5); }
      }, e.type === 'goal' ? 2500 : 1500);
    }
    if (EX.mode === 'td' && e.type === 'goal' && !EX.seq.length) {
      const evs = 'EVSA';
      EX.seq.push({ src: evs, kind: 'stinger', prep: 'But ! EVS A, prépare le ralenti… Truquiste, prépare l\'EVS A.', go: 'Envoie l\'EVS en volet logo !' });
      const back = S.cams.find((c) => c.role === 'large');
      if (back) EX.seq.push({ src: 'CAM' + back.id, kind: 'stinger', prep: `Prépare la ${back.id} pour la sortie du ralenti.`, go: `Retour sur la ${back.id} en volet logo !` });
      EX.next = S.time + 3.5;
    }
  }
});
