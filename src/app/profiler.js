// @ts-check
// ----------------------------------------------------------------------------------
// Profileur de la boucle principale (page ouverte avec ?perf) : temps processeur de chaque
// sous-système, moyenne glissante et pire valeur sur les dernières secondes, affichés en
// surimpression. Sans ?perf, chaque appel coûte une comparaison.
// ----------------------------------------------------------------------------------
export const PROF = {
  on: typeof location !== 'undefined' && /[?&]perf\b/.test(location.search),
  /** @type {Record<string, { avg: number, max: number, peak: number, sum: number, n: number }>} */ s: {},
  t: 0, frames: 0, box: /** @type {HTMLElement | null} */ (null),
};
// début d'une mesure : renvoie l'heure (0 quand le profileur est éteint)
export const pt = () => (PROF.on ? performance.now() : 0);
// fin de la mesure commencée à t0, cumulée sous « name » ; renvoie l'heure pour enchaîner
export function pe(name, t0) {
  if (!PROF.on) return 0;
  const now = performance.now(), ms = now - t0;
  const e = PROF.s[name] || (PROF.s[name] = { avg: ms, max: 0, peak: 0, sum: 0, n: 0 });
  e.avg += (ms - e.avg) * 0.05; e.peak = Math.max(e.peak, ms); e.sum += ms; e.n++;
  return now;
}
// une fois par image : rafraîchit la surimpression (2 fois par seconde)
export function profFrame(now) {
  if (!PROF.on) return;
  PROF.frames++;
  if (now - PROF.t < 500) return;
  PROF.t = now;
  if (!PROF.box) {
    PROF.box = document.createElement('pre');
    PROF.box.id = 'prof';
    Object.assign(PROF.box.style, { position: 'fixed', right: '8px', bottom: '40px', zIndex: '60', margin: '0', padding: '6px 8px', font: '11px/1.35 "JetBrains Mono", monospace', color: '#d8f3dc', background: 'rgba(8,10,12,.82)', border: '1px solid #2d3339', borderRadius: '4px', pointerEvents: 'none', whiteSpace: 'pre' });
    document.body.appendChild(PROF.box);
  }
  const rows = Object.entries(PROF.s);
  // « image » est le total ; les lignes « · » détaillent le pipeline (déjà compté)
  const tot = rows.reduce((a, [k, v]) => (k === 'image' || k.startsWith('·') ? a : a + v.avg), 0);
  PROF.box.textContent = 'ms / image   moy.   max\n' + rows.map(([k, v]) => { v.max = Math.max(v.peak, v.max * 0.5); v.peak = 0; return `${k.padEnd(11)} ${v.avg.toFixed(2).padStart(6)} ${v.max.toFixed(1).padStart(6)}`; }).join('\n') + `\n${'Σ mesuré'.padEnd(11)} ${tot.toFixed(2).padStart(6)}`;
}
// lecture par les mesures (tools/perf-profile.mjs) : moyenne exacte depuis la dernière remise à zéro
export const profSnapshot = () => Object.fromEntries(Object.entries(PROF.s).map(([k, v]) => [k, v.n ? Math.round(v.sum / v.n * 1000) / 1000 : 0]));
export function profReset() { for (const v of Object.values(PROF.s)) { v.sum = 0; v.n = 0; } }
