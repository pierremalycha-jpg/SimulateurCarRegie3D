// Chef de car sans navigateur : dispositif standard en car IP, entrées / sorties simulées
// (la ligne de commande passe par le même moteur que le terminal du poste Réseau IP).
import './scene.mjs';
import { S, emit } from '../../src/state.js';
import { loadPreset } from '../../src/bcam.js';
import { ROUTER, defaultRouting } from '../../src/pipeline.js';
import { FAB, resetFabric } from '../../src/net/fabric.js';
import { updateNet } from '../../src/ipnet.js';
import { cliSession, runCli } from '../../src/net/cli.js';
import { TUTOR, setIO, headlessIO, step, check, next, doForMe, answer, startLesson, isAction } from '../../src/tutor/engine.js';

export function freshCar() {
  S.ipMode = true;
  if (!S.cams.length) loadPreset('standard', false);
  defaultRouting(true);
  resetFabric();
  settle();
}
export function settle() { FAB.lastMap = ''; updateNet(0.1, ROUTER.map, ROUTER.phase || {}); }
const sessions = {};
export function cliOn(sw, line) {
  const s = sessions[sw] || (sessions[sw] = cliSession(sw));
  s.lastCmd = null;
  const r = runCli(s, line) || '';
  emit('netlog', { type: 'cli', sw, pat: s.lastCmd, raw: line, ok: !!s.lastCmd && !r.startsWith('%') });
  return r;
}
export function useHeadless() {
  const io = headlessIO((sw, line) => { const r = cliOn(sw, line); if (r.startsWith('%')) throw new Error(`${sw} « ${line} » → ${r}`); });
  setIO(io);
  return io;
}
// rejoue un parcours avec « fais-le pour moi » ; renvoie les étapes restées bloquées
export function replay(id, { onStep } = {}) {
  startLesson(id);
  const stuck = [];
  for (let guard = 0; guard < 200 && TUTOR.lesson; guard++) {
    const s = step();
    settle(); check();
    if (s.quiz) answer(s.quiz.answer);
    else if (isAction(s) && !TUTOR.done) { doForMe(); settle(); check(); }
    if (onStep) onStep(s);
    if (!TUTOR.done) { stuck.push(s.id); break; }
    next();
  }
  return stuck;
}
export { TUTOR };
