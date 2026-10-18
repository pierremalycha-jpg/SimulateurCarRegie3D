// @ts-check
// État global partagé de l'application
export const S = {
  quality: 'moyenne',
  format: 'HD',
  lighting: 'jour',
  flickerLamps: false,
  mode: 'start', // start | fps | plan | station | camop
  station: null,
  time: 0, // temps réel écoulé (s)
  frame: 0,
  cams: [],
  maxCams: 16,
  antennas: [],
  player: null,
  inTruck: false,
  faults: {},
  patch: { on: false, inputs: {}, outputs: {}, refs: {} },
  ipMode: false,
  missionsDone: {},
  openedInfo: {},
  visited: {},
  events: [],
  stats: { cuts: 0, mixes: 0, stingers: 0 },
};

const listeners = {};
export function on(name, fn) { (listeners[name] ||= []).push(fn); }
export function emit(name, data) { (listeners[name] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); }

export function camById(id) { return S.cams.find((c) => c.id === id); }
export function nextCamId() { for (let i = 1; i <= S.maxCams; i++) if (!camById(i)) return i; return null; }
