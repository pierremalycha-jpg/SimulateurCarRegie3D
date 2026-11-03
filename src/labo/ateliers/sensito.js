// @ts-check
import { el } from '../../util.js';
import { commandes, afficheur, jetons, toile, fr, teinte } from '../kit.js';
import { COURBES, CHARTE, GRIS, CAPTEUR, signal, gainDiaphs } from '../calc/sensito.js';

// ----------------------------------------------------------------------------------
// L'atelier « Sensitométrie » : une charte de gris (de −6 à +6 diaphs autour du gris 18 %) et un
// ciel lumineux devant la caméra. Trois dessins : la charte telle que la caméra la rend (les
// plages écrêtées hachurées, celles dans le bruit granuleuses), la forme d'onde (le signal de
// chaque plage, de 0 à 109 %), la courbe de transfert (le signal en fonction des diaphs de la
// scène, avec le plancher de bruit et l'écrêtage). Commandes : courbe, exposition, gain, ciel.
// Tout vient de labo/calc/sensito.js.
// ----------------------------------------------------------------------------------
const W = 640;
const pc = (v) => `${fr(v * 100, 0)} %`;

export function creer(/** @type {import('../kit.js').Ctx} */ ctx) {
  const T = jetons();
  const C = commandes(ctx);
  const charte = toile(W, 120, 'La charte de gris rendue par la caméra, du plus sombre au plus clair, et le ciel', 'lb-charte');
  const onde = toile(W, 220, 'La forme d\'onde : le niveau de signal de chaque plage de la charte', 'lb-onde');
  const courbe = toile(W, 240, 'La courbe de transfert : le signal en fonction de la lumière de la scène, en diaphs', 'lb-courbe');
  const rG = afficheur('Gris 18 %'), rB = afficheur('Blanc 90 %'), rC = afficheur('Le ciel'), rP = afficheur('Plage utile');

  const ctrls = el('div', { class: 'lb-ctls' },
    C.touches('courbe', 'Courbe', Object.values(COURBES).map((c) => [c.id, c.nom])),
    C.curseur('e', 'Exposition', { min: -4, max: 4, step: 1 / 3, fmt: (v) => (Math.abs(v) < 1e-6 ? '0' : `${v > 0 ? '+' : '−'}${fr(Math.abs(v), 2)}`), unite: 'diaph' }),
    C.touches('g', 'Gain', [0, 3, 6, 9, 12, 18].map((d) => [d, `${d ? '+' : ''}${d} dB`])),
    C.curseur('ciel', 'Le ciel', { min: 1, max: 6, step: 0.5, fmt: (v) => `+${fr(v, 1)} diaphs au-dessus du gris` }),
    el('p', { class: 'lb-note' }, 'Un diaph = deux fois plus de lumière. Le capteur : 14 diaphs, du bruit (−8) à la saturation (+6), ordre de grandeur.'));

  /** la charte : chaque plage, son niveau affiché ; écrêtée : hachurée ; dans le bruit : granuleuse */
  function peindreCharte(sig) {
    const g = charte.g, n = CHARTE.length + 1, w = (W - 20) / n;
    g.clearRect(0, 0, W, 120); g.fillStyle = T.bg; g.fillRect(0, 0, W, 120);
    sig.forEach((s, i) => {
      const x = 10 + i * w, v = Math.round(255 * Math.min(1, s.V));
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 1, 10, w - 2, 78);
      if (s.ecrete || s.sature) { g.strokeStyle = T.tally; g.lineWidth = 2; for (let k = -78; k < w; k += 9) { g.beginPath(); g.moveTo(x + 1 + k, 88); g.lineTo(x + 1 + k + 78, 10); g.stroke(); } g.lineWidth = 1; g.fillStyle = T.bg; g.fillRect(x + w - 1, 10, 3, 78); }
      if (s.bruit) { for (let k = 0; k < 120; k++) { const a = Math.random() * 0.5; g.fillStyle = teinte(T.fg, a); g.fillRect(x + 1 + Math.random() * (w - 3), 10 + Math.random() * 76, 2, 2); } }
      g.fillStyle = T.muted; g.font = `12px ${T.font}`; g.textAlign = 'center';
      g.fillText(i === n - 1 ? 'ciel' : (CHARTE[i] > 0 ? '+' : '') + CHARTE[i], x + w / 2, 106);
    });
    // le gris 18 % repéré
    const xg = 10 + CHARTE.indexOf(0) * w; g.strokeStyle = T.accent; g.lineWidth = 2; g.strokeRect(xg + 1, 10, w - 2, 78); g.lineWidth = 1;
  }
  /** la forme d'onde : un trait par plage, à son niveau ; graduations 0, 50, 100, 109 % */
  function peindreOnde(sig, C0) {
    const g = onde.g, h = 220, top = 12, bas = h - 22, Y = (v) => bas - (bas - top) * v / 1.09, n = sig.length, w = (W - 60) / n;
    g.clearRect(0, 0, W, h); g.fillStyle = T.bg; g.fillRect(0, 0, W, h);
    g.font = `12px ${T.font}`; g.textAlign = 'right';
    for (const v of [0, 0.25, 0.5, 0.75, 1, 1.09]) { g.strokeStyle = v === 1 ? T.tally : teinte(T.fg, 0.12); g.beginPath(); g.moveTo(44, Y(v)); g.lineTo(W - 6, Y(v)); g.stroke(); g.fillStyle = v === 1 ? T.tally : T.dim; g.fillText(pc(v), 40, Y(v) + 4); }
    // la cible du gris pour cette courbe
    g.strokeStyle = T.accent; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(44, Y(C0.grisCible)); g.lineTo(W - 6, Y(C0.grisCible)); g.stroke(); g.setLineDash([]);
    g.fillStyle = T.accent; g.textAlign = 'left'; g.fillText(`gris attendu ${pc(C0.grisCible)}`, 50, Y(C0.grisCible) - 5);
    sig.forEach((s, i) => {
      const x = 50 + i * w; g.strokeStyle = s.ecrete || s.sature ? T.tally : i === CHARTE.indexOf(0) ? T.accent : T.ok; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x + 4, Y(s.V)); g.lineTo(x + w - 4, Y(s.V)); g.stroke(); g.lineWidth = 1;
      if (s.bruit) { g.strokeStyle = teinte(T.ok, 0.45); for (let k = 0; k < 6; k++) { const yy = Y(s.V) + (Math.random() - 0.5) * 10; g.beginPath(); g.moveTo(x + 4, yy); g.lineTo(x + w - 4, yy); g.stroke(); } }
    });
  }
  /** la courbe : x de −8 à +8 diaphs autour du gris (lumière de la scène), y le signal */
  function peindreCourbe(st) {
    const g = courbe.g, h = 240, l = 46, r = W - 10, top = 10, bas = h - 26;
    const X = (e) => l + (e + 8) / 16 * (r - l), Y = (v) => bas - (bas - top) * v / 1.09;
    g.clearRect(0, 0, W, h); g.fillStyle = T.bg; g.fillRect(0, 0, W, h);
    g.font = `12px ${T.font}`;
    for (let e = -8; e <= 8; e += 2) { g.strokeStyle = teinte(T.fg, 0.08); g.beginPath(); g.moveTo(X(e), top); g.lineTo(X(e), bas); g.stroke(); g.fillStyle = T.dim; g.textAlign = 'center'; g.fillText((e > 0 ? '+' : '') + e, X(e), h - 8); }
    for (const v of [0, 0.5, 1]) { g.strokeStyle = v === 1 ? T.tally : teinte(T.fg, 0.12); g.beginPath(); g.moveTo(l, Y(v)); g.lineTo(r, Y(v)); g.stroke(); g.fillStyle = T.dim; g.textAlign = 'right'; g.fillText(pc(v), l - 4, Y(v) + 4); }
    // le plancher de bruit et la saturation du capteur, ramenés à la scène (selon l'exposition)
    const eb = Math.log2(CAPTEUR.bruit / GRIS) - st.e, es = Math.log2(CAPTEUR.sature / GRIS) - st.e;
    g.fillStyle = teinte(T.fg, 0.06); g.fillRect(l, top, Math.max(0, X(eb) - l), bas - top);
    g.fillStyle = teinte(T.tally, 0.08); g.fillRect(X(es), top, Math.max(0, r - X(es)), bas - top);
    g.fillStyle = T.dim; g.textAlign = 'left'; if (X(eb) > l + 30) g.fillText('bruit', l + 4, bas - 6); g.textAlign = 'right'; if (X(es) < r - 60) g.fillText('capteur saturé', r - 4, bas - 6);
    // les quatre courbes : la choisie en avant
    for (const c of Object.values(COURBES)) {
      const on = c.id === st.courbe; g.strokeStyle = on ? T.accent : teinte(T.fg, 0.18); g.lineWidth = on ? 2.5 : 1;
      g.beginPath(); for (let k = 0; k <= 160; k++) { const e = -8 + k / 10; const v = signal(c.id, GRIS * Math.pow(2, e), st.e, st.g).V; if (k) g.lineTo(X(e), Y(v)); else g.moveTo(X(e), Y(v)); } g.stroke(); g.lineWidth = 1;
    }
    // le gris, le blanc, le ciel
    const pts = [[0, 'gris', T.accent], [Math.log2(0.9 / GRIS), 'blanc', T.fg], [st.ciel, 'ciel', T.amber]];
    for (const [e, t, c] of pts) { const v = signal(st.courbe, GRIS * Math.pow(2, Number(e)), st.e, st.g).V; g.fillStyle = String(c); g.beginPath(); g.arc(X(Number(e)), Y(v), 5, 0, Math.PI * 2); g.fill(); g.textAlign = 'center'; g.fillText(String(t), X(Number(e)), Y(v) - 9); }
    g.fillStyle = T.dim; g.textAlign = 'right'; g.fillText('diaphs de la scène (0 = gris 18 %)', r, h - 8 - 14);
  }

  function rendre() {
    const st = ctx.st, m = ctx.m(), C0 = COURBES[st.courbe];
    C.refresh();
    const sig = [...CHARTE.map((e) => signal(st.courbe, GRIS * Math.pow(2, e), st.e, st.g)), signal(st.courbe, GRIS * Math.pow(2, st.ciel), st.e, st.g)];
    const ecart = m.vGris - C0.grisCible;
    rG.set(pc(m.vGris), Math.abs(ecart) <= 0.02 ? `à sa place en ${C0.nom}` : `attendu vers ${pc(C0.grisCible)} en ${C0.nom}`, Math.abs(ecart) <= 0.02 ? 'ok' : 'warn');
    rB.set(pc(m.vBlanc), '+2,3 diaphs au-dessus du gris');
    rC.set(m.cielEcrete ? 'écrêté' : pc(m.vCiel), `+${fr(st.ciel, 1)} diaphs`, m.cielEcrete ? 'bad' : 'ok');
    rP.set(`${fr(m.plage.diaphs, 1)} diaphs`, `+${fr(m.plage.dessus, 1)} au-dessus du gris, −${fr(m.plage.dessous, 1)} dessous${st.g ? ` ; gain +${fr(gainDiaphs(st.g), 1)} diaph` : ''}`);
    peindreCharte(sig); peindreOnde(sig, C0); peindreCourbe(st);
  }
  const root = el('div', { class: 'lb-atelier lb-sensito' },
    el('div', { class: 'lb-stage' },
      el('figure', { class: 'lb-fig' }, charte.c, el('figcaption', {}, 'La charte, de −6 à +6 diaphs autour du gris (encadré), et le ciel')),
      el('figure', { class: 'lb-fig' }, onde.c, el('figcaption', {}, 'La forme d\'onde (en rouge : écrêté)')),
      el('div', { class: 'lb-reads' }, rG.box, rB.box, rC.box, rP.box),
      el('figure', { class: 'lb-fig' }, courbe.c, el('figcaption', {}, 'La courbe de transfert (OETF) : la courbe choisie en bleu, les autres en gris'))),
    ctrls);
  return { root, rendre };
}
