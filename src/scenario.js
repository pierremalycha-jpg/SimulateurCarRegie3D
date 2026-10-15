import { S, on, emit, camById } from './state.js';
import { el, tc, mmss, randPick } from './util.js';
import { $, toast, intercom, modal } from './ui/common.js';
import { MIX, meSource, ROUTER, EVS, resolve, feedOf } from './pipeline.js';
import { patchScore } from './patch.js';
import { FAULTS, injectFault, ACTIVE } from './faults.js';
import { AU } from './audio.js';
import { addScenarioResult, offerDownload, CFG } from './shared.js';

// ----------------------------------------------------------------------------------
// Scénario « jour de match » : enchaînement chronométré et noté des grandes étapes
// d'une captation. Chaque phase a ses objectifs vérifiés en direct.
// ----------------------------------------------------------------------------------
const isSys = (c) => c && c.link !== 'hf' && !['pov', 'ptz', 'drone'].includes(c.type);
export const SC = { on: false, phase: -1, t0: 0, tp: 0, phases: [], log: [], line: {}, air: {}, faults: [] };

const camOk = (c) => c.signalOK && c.genlock && c.meter.mean > 0.33 && c.meter.mean < 0.6 && c.meter.peak <= 1.04 && Math.abs(c.colorError().r) < 0.025 && Math.abs(c.colorError().b) < 0.025;

const PHASES = [
  {
    id: 'patch', title: 'Brassage du car', max: 20, minutes: 12,
    brief: 'Le car est vide : poste « Baie de brassage » (zone technique). Brassez les sources vers la grille, les sorties vers l\'EVS et les départs, et la référence vers les CCU.',
    goals: () => { const s = patchScore(); return [[`Liaisons justes : ${s.ok} / ${s.total}`, s.pct >= 100], ['Aucune liaison croisée', !s.wrong.length]]; },
    score: () => Math.round(patchScore().pct / 100 * 20),
    done: () => patchScore().pct >= 100,
  },
  {
    id: 'lineup', title: 'Line-up des caméras', max: 25, minutes: 10,
    brief: 'Poste Ingé vision : exposez et équilibrez chaque caméra système (niveau moyen 35-58 %, crêtes ≤ 103 %, écarts de couleur sous 2,5 %, référence verrouillée).',
    goals: () => { const sys = S.cams.filter(isSys); const ok = sys.filter(camOk).length; return [[`Caméras réglées : ${ok} / ${sys.length}`, ok === sys.length], ['Toutes verrouillées sur la référence', sys.every((c) => c.genlock)]]; },
    score: () => { const sys = S.cams.filter(isSys); return sys.length ? Math.round(sys.filter(camOk).length / sys.length * 25) : 0; },
    done: () => { const sys = S.cams.filter(isSys); return sys.length && sys.every(camOk); },
  },
  {
    id: 'line', title: 'Test de ligne avec la chaîne', max: 15, minutes: 6,
    brief: 'Poste Transmission ou Grille : envoyez la mire sur le départ TX1 et le 1 kHz (Régie son : démuter « Mire 1 kHz »). Quand la chaîne confirme, remettez le PGM sur le départ et coupez le 1 kHz.',
    goals: () => [['Mire envoyée sur le départ TX1', !!SC.line.bars], ['1 kHz envoyé', !!SC.line.tone], ['Réception confirmée par la chaîne', !!SC.line.confirmed], ['PGM remis sur le départ, 1 kHz coupé', !!SC.line.back]],
    score: () => (SC.line.bars ? 4 : 0) + (SC.line.tone ? 4 : 0) + (SC.line.back ? 7 : 0),
    done: () => !!SC.line.back,
  },
  {
    id: 'air', title: 'À l\'antenne', max: 40, minutes: 5,
    brief: 'Le match est à l\'antenne. Réalisez (ou laissez faire le truquiste) et surtout surveillez : des pannes vont arriver sans prévenir. Mettez au moins un ralenti à l\'antenne.',
    goals: () => [[`Pannes résolues : ${SC.faults.filter((f) => f.done).length} / ${SC.faults.length}`, SC.faults.length > 0 && SC.faults.every((f) => f.done)], ['Un ralenti à l\'antenne', !!SC.air.replay], [`Secondes d'image en défaut à l'antenne : ${Math.round(SC.air.bad || 0)}`, (SC.air.bad || 0) < 3]],
    score: () => {
      let p = 0;
      for (const f of SC.faults) if (f.done) p += f.dt < 60 ? 12 : f.dt < 120 ? 8 : 4;
      p = Math.min(24, p);
      if (SC.air.replay) p += 8;
      p += Math.max(0, 8 - Math.floor((SC.air.bad || 0) / 3));
      return Math.min(40, p);
    },
    done: () => S.time - SC.tp > 300,
  },
];

export function startScenario() {
  Object.assign(SC, { on: true, phase: -1, t0: S.time, log: [], line: {}, air: {}, faults: [], phases: [] });
  // caméras installées mais non réglées : on dérègle volontairement le line-up
  for (const c of S.cams) { c.lineup = null; c.paint.iris = Math.min(22, c.paint.iris * (1.4 + Math.random() * 1.2)); c.paint.wbR += Math.round((Math.random() - 0.5) * 50); c.paint.wbB += Math.round((Math.random() - 0.5) * 50); c.paint.autoIris = false; }
  log('Début du scénario : arrivée au car, tout est installé mais rien n\'est brassé.');
  intercom('CHEF DE CAR', 'Bienvenue au car ! Tout est installé, à toi de brasser, de faire le line-up et le test de ligne avant l\'antenne.', 'ok');
  nextPhase();
}
function log(t) { SC.log.push({ t: S.time - SC.t0, text: t }); }
function nextPhase() {
  if (SC.phase >= 0) {
    const P = PHASES[SC.phase];
    const pts = P.score();
    SC.phases.push({ id: P.id, title: P.title, pts, max: P.max, dur: Math.round(S.time - SC.tp) });
    log(`Fin de la phase « ${P.title} » : ${pts} / ${P.max} points en ${mmss(S.time - SC.tp)}.`);
  }
  SC.phase++;
  SC.tp = S.time;
  if (SC.phase >= PHASES.length) { finish(); return; }
  const P = PHASES[SC.phase];
  log(`Phase « ${P.title} ».`);
  if (P.id === 'air') {
    intercom('RÉAL', 'Antenne dans 10 secondes… 3, 2, 1, à vous !', 'ok');
    const pool = () => FAULTS.filter((f) => f.can() && !['router'].includes(f.id));
    SC.timers = [40, 140].map((d) => setTimeout(() => { if (!SC.on || PHASES[SC.phase].id !== 'air') return; const f = randPick(pool()); if (!f) return; const e = injectFault(f.id, true); if (e) { SC.faults.push(e); log(`Panne cachée injectée (${f.label}).`); } }, d * 1000));
  }
  render(true);
}
function finish() {
  SC.on = false;
  for (const t of SC.timers || []) clearTimeout(t);
  const pts = SC.phases.reduce((a, p) => a + p.pts, 0), max = SC.phases.reduce((a, p) => a + p.max, 0);
  const score = max ? Math.round(pts / max * 100) : 0;
  const result = { score, phases: SC.phases, duration: Math.round(S.time - SC.t0), car: CFG.car.name || '' };
  addScenarioResult(result);
  log(`Fin du scénario : ${score} %.`);
  const box = $('#scenario'); if (box) box.hidden = true;
  const advice = [];
  for (const p of SC.phases) if (p.pts < p.max * 0.7) advice.push({ patch: 'Brassage : reprenez la liste de câblage ligne par ligne ; vérifiez chaque nom au multiview.', lineup: 'Line-up : exposez d\'abord (iris, waveform), puis balance des blancs et noirs, puis matching au vecteurscope.', line: 'Test de ligne : mire ET 1 kHz, attendre la confirmation de la chaîne, et surtout remettre le PGM avant l\'antenne.', air: 'Direct : surveillez en permanence le multiview et le retour antenne ; une panne se traite en isolant le maillon fautif.' }[p.id]);
  const rows = SC.phases.map((p) => el('tr', {}, el('td', {}, p.title), el('td', {}, `${p.pts} / ${p.max}`), el('td', {}, mmss(p.dur))));
  modal.open('Compte rendu · jour de match', el('div', { class: 'list' },
    el('div', { class: 'lcd amber big' }, `Score : ${score} %`),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact' }, el('thead', {}, el('tr', {}, el('th', {}, 'Phase'), el('th', {}, 'Points'), el('th', {}, 'Durée'))), el('tbody', {}, ...rows))),
    advice.length ? el('div', { class: 'hwpanel prose' }, el('h3', {}, 'À retravailler'), el('ul', { class: 'steps' }, advice.map((a) => el('li', {}, a)))) : el('p', { class: 'note ok' }, 'Toutes les phases sont réussies à plus de 70 %. Bravo !'),
    el('h3', { class: 'eq-h' }, 'Journal'), el('ul', { class: 'steps prose' }, SC.log.map((l) => el('li', {}, `${mmss(l.t)} · ${l.text}`))),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn', onclick: () => offerDownload('compte-rendu-jour-de-match.html', reportHTML(result)) }, 'Télécharger le compte rendu'), el('button', { class: 'btn primary', onclick: () => modal.close() }, 'Fermer')),
    el('p', { class: 'note' }, 'Le résultat est enregistré dans votre suivi (visible du formateur).')), { width: 820 });
}
function reportHTML(r) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Compte rendu jour de match</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#111}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style></head><body>
<h1>Compte rendu · jour de match</h1><p>${esc(CFG.car.name || 'Car régie')} · ${new Date().toLocaleString('fr-FR')} · score ${r.score} %</p>
<table><tr><th>Phase</th><th>Points</th><th>Durée</th></tr>${r.phases.map((p) => `<tr><td>${esc(p.title)}</td><td>${p.pts} / ${p.max}</td><td>${mmss(p.dur)}</td></tr>`).join('')}</table>
<h2>Journal</h2><ul>${SC.log.map((l) => `<li>${mmss(l.t)} · ${esc(l.text)}</li>`).join('')}</ul></body></html>`;
}
export function stopScenario() { if (!SC.on) return; SC.on = false; for (const t of SC.timers || []) clearTimeout(t); const b = $('#scenario'); if (b) b.hidden = true; toast('Scénario abandonné'); }

// ---------------- suivi en direct ----------------
let lastRender = 0, confirmT = 0;
export function updateScenario(dt) {
  if (!SC.on) return;
  const P = PHASES[SC.phase];
  if (P.id === 'line') {
    const dep = feedOf('TX1');
    if (dep === 'BARS') SC.line.bars = true;
    if (AU.ch.tone && !AU.ch.tone.mute && AU.ch.tone.fader > -3) SC.line.tone = true;
    if (SC.line.bars && SC.line.tone && !SC.line.confirmed) {
      if (!confirmT) confirmT = S.time;
      if (S.time - confirmT > 5) { SC.line.confirmed = true; intercom('CHAÎNE', 'Mire et 1 kHz bien reçus, niveaux conformes, ident OK. Vous pouvez repasser le programme.', 'ok'); log('La chaîne confirme la réception de la mire et du 1 kHz.'); }
    }
    if (SC.line.confirmed && dep === 'PGM' && AU.ch.tone.mute) { if (!SC.line.back) log('PGM remis sur le départ, 1 kHz coupé.'); SC.line.back = true; }
  }
  if (P.id === 'air') {
    const pgm = meSource(MIX.pgm);
    if ((pgm === 'EVSA' || pgm === 'EVSB') && EVS.ch[pgm === 'EVSA' ? 0 : 1].playing) { if (!SC.air.replay) log('Ralenti à l\'antenne.'); SC.air.replay = true; }
    const r = resolve(pgm);
    if (r.alarm && !['MIRE', 'BARRES'].includes(r.alarm) || pgm === 'BLACK' || pgm === 'BARS') SC.air.bad = (SC.air.bad || 0) + dt;
  }
  if (S.time - lastRender > 0.5) { lastRender = S.time; render(); }
  if (P.done() && P.id !== 'air' && !SC.autoT) { SC.autoT = S.time; toast(`Objectifs de la phase « ${P.title} » atteints.`, 'good'); }
  if (P.id === 'air' && P.done()) nextPhase();
}
function render(force) {
  let box = $('#scenario');
  if (!box) { box = el('div', { id: 'scenario', class: 'scenario' }); document.body.appendChild(box); }
  if (!SC.on) { box.hidden = true; return; }
  box.hidden = false;
  const P = PHASES[SC.phase];
  const el_ = (t, a, ...c) => el(t, a, ...c);
  const mins = (S.time - SC.tp) / 60;
  box.innerHTML = '';
  box.append(
    el_('div', { class: 'sc-head' }, el_('b', {}, `Jour de match · ${SC.phase + 1}/${PHASES.length} · ${P.title}`), el_('span', { class: 'mono ' + (mins > P.minutes ? 'warn' : '') }, `${mmss(S.time - SC.tp)} / ${P.minutes} min`), el_('button', { class: 'x', 'aria-label': 'Réduire', onclick: () => box.classList.toggle('min') }, '–')),
    el_('div', { class: 'sc-body' }, el_('p', {}, P.brief),
      el_('ul', {}, ...P.goals().map(([t, ok]) => el_('li', { class: ok ? 'ok' : '' }, (ok ? '✓ ' : '○ ') + t))),
      el_('div', { class: 'hwrow' }, P.id !== 'air' ? el_('button', { class: 'btn small primary', onclick: () => { SC.autoT = 0; nextPhase(); } }, P.done() ? 'Phase suivante' : 'Terminer la phase (score actuel)') : el_('span', { class: 'note' }, 'Fin automatique après 5 minutes d\'antenne.'),
        el_('button', { class: 'btn small', onclick: stopScenario }, 'Abandonner'))));
}
on('startScenario', () => setTimeout(startScenario, 300));
on('fault', () => { for (const f of SC.faults) if (f.done && !f.logged) { f.logged = true; log(`Panne « ${f.f.label} » résolue en ${Math.round(f.dt)} s.`); } });
