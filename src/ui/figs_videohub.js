// @ts-check
// Schémas des fiches « ? » de la grille du car SDI (Videohub) : ajoutés à ui/term_figs.js (FIGS).
// Mêmes couleurs que les autres schémas : bleu clair pour les signaux, ambre pour la sélection,
// rouge pour ce qui est verrouillé ou abîmé, vert pour ce qui est bon.
import { FIGS } from './term_figs.js';

const FG = '#e7eaed', MUTED = '#9aa3ab', LINE = '#4a5560', ACC = '#8ccdf2', AMB = '#f0a61c', RED = '#ff6b5e', GRN = '#2fbf5a', BOX = '#1c2126';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="${o.c || FG}" font-size="${o.s || 12}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''}${o.r ? ` transform="rotate(${o.r} ${x} ${y})"` : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 4}" fill="${o.f || BOX}" stroke="${o.s || LINE}" stroke-width="${o.sw || 1}"/>`;
const L = (x1, y1, x2, y2, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.c || LINE}" stroke-width="${o.w || 1}"${o.arrow ? ' marker-end="url(#vh-a)"' : ''}/>`;
const C = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
const P = (pts, c, w = 2) => `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round"/>`;
const svg = (w, h, body, title) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}" font-family="Barlow, 'Segoe UI', sans-serif"><defs><marker id="vh-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${MUTED}"/></marker></defs>${body}</svg>`;

/** @type {Record<string, () => string>} */
const ADD = {
  // ---------------- matrice : une ligne par sortie, une colonne par entrée ----------------
  vhmatrix() {
    const cols = [['1', 'CAM 1'], ['2', 'CAM 2'], ['3', 'CAM 3'], ['17', 'EVS A'], ['24', 'PGM'], ['25', 'CLEAN']];
    /** @type {[string, string, number][]} */
    const rows = [['1', 'MÉL 1', 0], ['3', 'MÉL 3', 2], ['31', 'TX1 FIBRE', 4], ['33', 'ÉCRAN GÉANT', 5], ['35', 'MV 13', 2]];
    const X0 = 170, Y0 = 92, CW = 52, CH = 34;
    let b = T(X0 + cols.length * CW / 2, 16, 'Entrées (sources)', { a: 'middle', w: 700, c: ACC }) + T(20, Y0 - 10, 'Sorties (destinations)', { w: 700, c: AMB });
    // colonne de la CAM 3 (deux points) et ligne verrouillée du départ TX1
    b += `<rect x="${X0 + 2 * CW}" y="${Y0}" width="${CW}" height="${rows.length * CH}" fill="rgba(140,205,242,.12)"/>`;
    b += `<rect x="${X0}" y="${Y0 + 2 * CH}" width="${cols.length * CW}" height="${CH}" fill="rgba(255,107,94,.13)"/>`;
    cols.forEach(([n, l], i) => { b += T(X0 + i * CW + CW / 2 + 4, Y0 - 8, `${n} ${l}`, { r: -50, s: 11.5, c: FG }); });
    rows.forEach(([n, l], j) => { b += T(X0 - 10, Y0 + j * CH + CH / 2 + 4, `${l}  ${n}`, { a: 'end', s: 12, c: FG }); });
    for (let i = 0; i <= cols.length; i++) b += L(X0 + i * CW, Y0, X0 + i * CW, Y0 + rows.length * CH);
    for (let j = 0; j <= rows.length; j++) b += L(X0, Y0 + j * CH, X0 + cols.length * CW, Y0 + j * CH);
    rows.forEach(([, , c], j) => { b += C(X0 + c * CW + CW / 2, Y0 + j * CH + CH / 2, 8, j === 2 ? RED : c === 2 ? ACC : AMB); });
    // cadenas sur la ligne TX1
    const lx = X0 + cols.length * CW + 10, ly = Y0 + 2 * CH + 9;
    b += `<path d="M${lx + 3},${ly + 7} v-3 a4,4 0 0 1 8,0 v3" fill="none" stroke="${RED}" stroke-width="2"/>` + R(lx, ly + 7, 14, 11, { f: RED, s: RED, r: 2 });
    const NX = X0 + cols.length * CW + 34;
    b += T(NX, Y0 + 2 * CH + 22, 'verrouillée', { c: RED, s: 11.5 });
    b += R(NX - 4, Y0 + 4 * CH - 6, 196, 64, { f: '#121518' });
    b += T(NX + 4, Y0 + 4 * CH + 12, 'Une ligne = une sortie :', { s: 11.5, w: 600, c: AMB }) + T(NX + 4, Y0 + 4 * CH + 27, 'un seul point (une seule source).', { s: 11.5 });
    b += T(NX + 4, Y0 + 4 * CH + 43, 'Une colonne = une entrée :', { s: 11.5, w: 600, c: ACC }) + T(NX + 4, Y0 + 4 * CH + 58, 'CAM 3 part vers MÉL 3 et MV 13.', { s: 11.5 });
    b += T(20, Y0 + rows.length * CH + 26, 'Commuter une sortie : fermer un autre point sur sa ligne ; l\'ancien s\'ouvre en même temps.', { s: 11.5, c: MUTED });
    return svg(560, Y0 + rows.length * CH + 40, b, 'Matrice de la grille : une ligne par sortie, une colonne par entrée, un point par sortie');
  },
  // ---------------- reclocking : le signal abîmé par le câble est régénéré ----------------
  vhreclock() {
    const bits = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0];
    const sq = (x0, y0, w, h) => { const pts = []; bits.forEach((v, i) => { const y = v ? y0 : y0 + h; pts.push([x0 + i * w, y], [x0 + (i + 1) * w, y]); }); return pts; };
    // signal reçu : fronts arrondis, amplitude réduite, instants qui varient (gigue)
    const jit = [0, 2, -3, 1, 3, -2, 2, -1, 3, 0];
    const soft = (x0, y0, w, h) => { const pts = []; let prev = bits[0]; bits.forEach((v, i) => { const x = x0 + i * w + jit[i]; const y = v ? y0 + 8 : y0 + h - 8; const yp = prev ? y0 + 8 : y0 + h - 8; pts.push([x, yp], [x + 6, (y + yp) / 2], [x + 12, y], [x0 + (i + 1) * w + jit[(i + 1) % 10], y]); prev = v; }); return pts; };
    let b = T(20, 20, 'Après le câble : affaibli, fronts arrondis, gigue', { c: MUTED, s: 11.5 }) + R(16, 30, 208, 70, { f: '#121518' }) + P(soft(24, 40, 19, 50), RED);
    b += L(228, 65, 262, 65, { c: MUTED, w: 1.5, arrow: true });
    b += R(266, 34, 120, 62, { f: '#1f2a33', s: ACC }) + T(326, 56, 'égaliseur', { a: 'middle', w: 600, c: ACC }) + T(326, 72, '+ reclocking', { a: 'middle', w: 600, c: ACC }) + T(326, 88, '(horloge propre)', { a: 'middle', s: 10.5, c: MUTED });
    b += L(390, 65, 424, 65, { c: MUTED, w: 1.5, arrow: true });
    b += T(430, 20, 'Sortie : bits réémis à neuf', { c: MUTED, s: 11.5 }) + R(428, 30, 208, 70, { f: '#121518' }) + P(sq(436, 40, 19, 50), GRN);
    b += T(20, 128, 'Mêmes bits, signal reconstruit : la longueur de câble repart de zéro à chaque sortie reclockée.', { s: 11.5 });
    b += T(20, 146, 'Un signal trop abîmé ne se répare pas : au-delà d\'une limite, les bits sont faux et l\'image décroche d\'un coup.', { s: 11.5, c: MUTED });
    return svg(650, 158, b, 'Reclocking : un signal SDI abîmé par le câble est régénéré à la sortie de la grille');
  },
};
Object.assign(FIGS, ADD);
