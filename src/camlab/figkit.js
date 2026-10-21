// @ts-check
// ----------------------------------------------------------------------------------
// Les aides des schémas du module caméra (figs.js et figs/*.js) : le cadre SVG à la largeur du
// panneau (440 px), les textes, les rayons, les cotes. Couleurs : classes cf-* de camlab.css.
// ----------------------------------------------------------------------------------
export const ARROW = '<defs><marker id="cf-a" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" class="cf-arrow"/></marker></defs>';
export const svg = (h, label, body) => `<svg class="cf" viewBox="0 0 440 ${h}" role="img" aria-label="${label}">${ARROW}${body}</svg>`;
export const tx = (x, y, t, cls = 'cf-s') => `<text class="${cls}" x="${x}" y="${y}">${t}</text>`;
export const head = (title, sub) => tx(16, 16, title, 'cf-t') + tx(16, 32, sub, 'cf-sub');
export const rays = (x0, ys, x1, y1, cls = 'cf-ray') => ys.map((y) => `<line class="${cls}" x1="${x0}" y1="${y}" x2="${x1}" y2="${y1}"/>`).join('');
export const dim = (x1, y1, x2, y2) => `<line class="cf-dim" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-start="url(#cf-a)" marker-end="url(#cf-a)"/>`;
export const n1 = (v) => v.toFixed(1);
