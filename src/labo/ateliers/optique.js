// @ts-check
import { el } from '../../util.js';
import { commandes, afficheur, jetons, toile, fr, teinte, arrondi } from '../kit.js';
import { CAPTEURS, IRIS, FOCALE, distTxt } from '../calc/optique.js';

// ----------------------------------------------------------------------------------
// L'atelier « Optique et profondeur de champ » : une caméra et trois sujets (A, B, C) à des
// distances réglables, un mur au fond (à 30 m) et ses lampes. Deux dessins : l'image de la
// caméra (chaque plan flouté par sa propre tache de flou, du plus loin au plus près) et la vue
// de dessus (le champ, la zone nette, le point, l'hyperfocale). Les commandes : le capteur, la
// focale, l'iris, le point, les distances des sujets. Tout vient de labo/calc/optique.js.
// ----------------------------------------------------------------------------------
const FOND = 30;
const W = 640, H = 360;
/** les sujets : position latérale (m), couleur (jeton), lettre */
const SUJETS = [{ k: 'A', x: -0.75, c: 'amber' }, { k: 'B', x: 0.05, c: 'accent' }, { k: 'C', x: 0.85, c: 'ok' }];

/** floute un calque d'un disque de rayon r (px) et le pose sur g ; filtre du navigateur s'il existe, sinon copies décalées */
function poserFlou(g, src, r) {
  if (r < 0.4) { g.drawImage(src, 0, 0, W, H); return; }
  if ('filter' in g) { g.save(); g.filter = `blur(${(r * 0.6).toFixed(2)}px)`; g.drawImage(src, 0, 0, W, H); g.restore(); return; }
  g.save(); g.globalAlpha = 1 / 12;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.drawImage(src, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, W, H); }
  g.restore();
}

export function creer(/** @type {import('../kit.js').Ctx} */ ctx) {
  const T = jetons();
  const C = commandes(ctx);
  const img = toile(W, H, 'L\'image de la caméra : les sujets A, B et C, nets ou flous selon la zone nette', 'lb-cam');
  const dessus = toile(W, 210, 'Vue de dessus : la caméra, le champ, la zone nette, le point et les sujets', 'lb-top');
  // calques de travail (un par plan), à la taille de l'image en pixels CSS × densité
  const calque = () => { const c = document.createElement('canvas'); c.width = img.c.width; c.height = img.c.height; return c; };
  const calques = { fond: calque(), A: calque(), B: calque(), C: calque() };

  const rH = afficheur('Hyperfocale'), rZone = afficheur('Zone nette'), rAngle = afficheur('Angle de champ'), rChamp = afficheur('Champ à B');
  const rTaches = el('ul', { class: 'lb-taches', 'aria-live': 'polite' });

  const ctrls = el('div', { class: 'lb-ctls' },
    C.touches('capteur', 'Capteur', Object.values(CAPTEURS).map((K) => [K.id, K.id === '2/3' ? '2/3"' : K.id === 's35' ? 'Super 35' : 'Plein format', K.nom])),
    C.curseur('f', 'Focale', { min: FOCALE.min, max: FOCALE.max, log: true, step: 0.5, fmt: (v) => fr(v, v < 20 ? 1 : 0), unite: 'mm' }),
    C.touches('N', 'Iris', IRIS.map((n) => [n, 'f/' + fr(n, n < 10 && !Number.isInteger(n) ? 1 : 0)])),
    C.curseur('s', 'Point', { min: 0.3, max: 60, log: true, step: 0.01, fmt: (v) => distTxt(v) }),
    el('h4', { class: 'lb-sub' }, 'Les sujets'),
    ...SUJETS.map((S) => C.curseur('sujets.' + S.k, `Sujet ${S.k}`, { min: 0.5, max: 25, log: true, step: 0.05, fmt: (v) => distTxt(v) })));

  // ---- l'image de la caméra ----
  function peindreImage(m) {
    const st = ctx.st, K = m.K, dpr = img.c.width / W;
    const proj = (x, y, d) => ({ x: W / 2 + (x / d) * st.f / K.w * W, y: H / 2 - ((y - 1.5) / d) * st.f / K.h * H, k: st.f / K.h * H / d });
    const flouPx = (d) => { const t = m.sujets[d] ? m.sujets[d].tache : null; return t; };
    const tachePx = (tmm) => tmm / K.h * H / 2;
    // le fond : un mur à 30 m, des briques et des lampes (elles deviennent des disques dans le flou)
    const f = /** @type {CanvasRenderingContext2D} */ (calques.fond.getContext('2d'));
    f.setTransform(dpr, 0, 0, dpr, 0, 0); f.clearRect(0, 0, W, H);
    const sol = proj(0, 0, FOND).y;
    const grd = f.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, T.panel); grd.addColorStop(1, T.raise);
    f.fillStyle = grd; f.fillRect(0, 0, W, H);
    f.strokeStyle = T.line; f.lineWidth = 1;
    const brique = proj(0, 0.3, FOND).k * 0.3;
    if (brique > 3) for (let y = sol; y > -brique; y -= brique) { f.beginPath(); f.moveTo(0, y); f.lineTo(W, y); f.stroke(); }
    f.fillStyle = T.fibre;
    for (let i = -6; i <= 6; i++) { const p = proj(i * 1.6, 3.2 + (i % 2) * 0.6, FOND); f.beginPath(); f.arc(p.x, p.y, Math.max(1.2, p.k * 0.06), 0, Math.PI * 2); f.fill(); }
    // le sol, devant le mur
    f.fillStyle = T.bg; f.fillRect(0, sol, W, H - sol);
    const g = img.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, img.c.width, img.c.height); g.restore();
    poserFlou(g, calques.fond, tachePx(fondTache(st, m)));
    // les sujets, du plus loin au plus près
    const ordre = SUJETS.slice().sort((a, b) => st.sujets[b.k] - st.sujets[a.k]);
    for (const S of ordre) {
      const d = st.sujets[S.k], c = /** @type {CanvasRenderingContext2D} */ (calques[S.k].getContext('2d'));
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      const pied = proj(S.x, 0, d), tete = proj(S.x, 1.75, d), k = pied.k;
      if (pied.x < -k * 2 || pied.x > W + k * 2) continue;
      // une silhouette et une pancarte avec sa lettre
      c.fillStyle = T.dim;
      c.beginPath(); c.arc(tete.x, tete.y + k * 0.12, k * 0.11, 0, Math.PI * 2); c.fill();
      arrondi(c, pied.x - k * 0.2, tete.y + k * 0.25, k * 0.4, k * 0.8, k * 0.08); c.fill();
      c.fillRect(pied.x - k * 0.16, tete.y + k * 0.95, k * 0.12, k * 0.8); c.fillRect(pied.x + k * 0.04, tete.y + k * 0.95, k * 0.12, k * 0.8);
      c.fillStyle = T[S.c]; arrondi(c, pied.x - k * 0.24, tete.y + k * 0.4, k * 0.48, k * 0.36, k * 0.04); c.fill();
      c.fillStyle = T.bg; c.font = `700 ${Math.max(6, k * 0.3)}px ${T.font}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(S.k, pied.x, tete.y + k * 0.59);
      // une mire de traits fins sur la pancarte : la netteté se juge là
      c.strokeStyle = T.bg; c.lineWidth = Math.max(0.5, k * 0.008);
      for (let i = 0; i < 6; i++) { const yy = tete.y + k * 0.44 + i * k * 0.012; c.beginPath(); c.moveTo(pied.x + k * 0.08, yy); c.lineTo(pied.x + k * 0.2, yy); c.stroke(); }
      poserFlou(g, calques[S.k], tachePx(flouPx(S.k)));
    }
    // les repères du cadre (tiers), discrets
    g.strokeStyle = teinte(T.fg, 0.12); g.lineWidth = 1;
    for (const t of [1 / 3, 2 / 3]) { g.beginPath(); g.moveTo(W * t, 0); g.lineTo(W * t, H); g.stroke(); g.beginPath(); g.moveTo(0, H * t); g.lineTo(W, H * t); g.stroke(); }
  }
  const fondTache = (st, m) => { const s = st.s * 1000, d = FOND * 1000; return s <= st.f ? 1 : st.f * st.f * Math.abs(d - s) / (st.N * d * (s - st.f)); };

  // ---- la vue de dessus ----
  function peindreDessus(m) {
    const st = ctx.st, g = dessus.g, w = dessus.w, h = dessus.h;
    const max = Math.max(12, Math.min(FOND, Math.max(st.sujets.A, st.sujets.B, st.sujets.C, st.s) * 1.25));
    const x0 = 40, sx = (w - x0 - 20) / max, cy = h / 2;
    const X = (d) => x0 + Math.min(d, max) * sx;
    g.clearRect(0, 0, w, h);
    g.fillStyle = T.panel; g.fillRect(0, 0, w, h);
    // l'échelle
    g.strokeStyle = T.line; g.fillStyle = T.dim; g.font = `12px ${T.font}`; g.textAlign = 'center';
    const pas = max > 20 ? 5 : max > 10 ? 2 : 1;
    for (let d = 0; d <= max; d += pas) { g.beginPath(); g.moveTo(X(d), h - 18); g.lineTo(X(d), h - 12); g.stroke(); g.fillText(`${d} m`, X(d), h - 2); }
    // la zone nette
    const z0 = X(m.proche), z1 = X(m.loin);
    g.fillStyle = teinte(T.ok, 0.16); g.fillRect(z0, 14, Math.max(2, z1 - z0), h - 40);
    g.strokeStyle = T.ok; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(z0, 14); g.lineTo(z0, h - 26); g.moveTo(z1, 14); g.lineTo(z1, h - 26); g.stroke(); g.setLineDash([]);
    if (!isFinite(m.loin)) { g.fillStyle = T.ok; g.textAlign = 'right'; g.fillText('→ ∞', w - 4, 26); }
    // le champ : deux demi-droites depuis la caméra
    const a = m.angle * Math.PI / 360;
    g.strokeStyle = T.muted; g.lineWidth = 1;
    const rayon = max * sx, dy = Math.tan(a) * rayon;
    g.beginPath(); g.moveTo(x0, cy); g.lineTo(x0 + rayon, cy - Math.min(dy, cy - 6)); g.moveTo(x0, cy); g.lineTo(x0 + rayon, cy + Math.min(dy, cy - 6)); g.stroke();
    // le point
    g.strokeStyle = T.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(X(st.s), 10); g.lineTo(X(st.s), h - 26); g.stroke(); g.lineWidth = 1;
    g.fillStyle = T.accent; g.textAlign = 'center'; g.fillText('point', X(st.s), 10);
    // l'hyperfocale, si elle tient dans la vue
    if (m.H < max) { g.strokeStyle = T.violet; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(m.H), 20); g.lineTo(X(m.H), h - 26); g.stroke(); g.setLineDash([]); g.fillStyle = T.violet; g.fillText('H', X(m.H), h - 30); }
    // la caméra
    g.fillStyle = T.fg; arrondi(g, x0 - 30, cy - 9, 24, 18, 4); g.fill(); g.beginPath(); g.moveTo(x0 - 6, cy - 6); g.lineTo(x0, cy - 9); g.lineTo(x0, cy + 9); g.lineTo(x0 - 6, cy + 6); g.fill();
    // les sujets
    for (const S of SUJETS) {
      const d = st.sujets[S.k], ok = m.sujets[S.k].net, px = X(d), py = cy + (S.x / Math.max(d, 1)) * 60;
      g.fillStyle = T[S.c]; g.beginPath(); g.arc(px, py, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = T.bg; g.font = `700 11px ${T.font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.k, px, py + 0.5); g.textBaseline = 'alphabetic';
      g.fillStyle = ok ? T.ok : T.muted; g.font = `12px ${T.font}`; g.fillText(ok ? 'net' : 'flou', px, py + 22);
    }
  }

  function rendre() {
    const m = ctx.m();
    C.refresh();
    rH.set(distTxt(m.H), `au point H, net de ${distTxt(m.H / 2)} à l'infini`);
    rZone.set(`${distTxt(m.proche)} → ${distTxt(m.loin)}`, isFinite(m.loin) ? `${fr((m.loin - m.proche) * 100, 0)} cm de profondeur` : 'jusqu\'à l\'infini');
    rAngle.set(`${fr(m.angle, 1)}°`, `cercle de confusion ${fr(m.K.c, 3)} mm`);
    const cb = m.sujets.B.champ; rChamp.set(`${fr(cb.w, 2)} × ${fr(cb.h, 2)} m`, `à ${distTxt(ctx.st.sujets.B)}`);
    rTaches.replaceChildren(...SUJETS.map((S) => { const x = m.sujets[S.k]; return el('li', { class: x.net ? 'ok' : '' }, el('b', {}, S.k), ` ${distTxt(x.d)} : tache ${fr(x.tache, 3)} mm, ${x.net ? 'net' : `flou (${fr(x.tache / m.K.c, 1)} fois le cercle)`}`); }));
    peindreImage(m); peindreDessus(m);
  }
  const root = el('div', { class: 'lb-atelier lb-optique' },
    el('div', { class: 'lb-stage' },
      el('figure', { class: 'lb-fig' }, img.c, el('figcaption', {}, 'L\'image de la caméra')),
      el('figure', { class: 'lb-fig' }, dessus.c, el('figcaption', {}, 'Vue de dessus : le champ, la zone nette (en vert), le point (en bleu), l\'hyperfocale (H)')),
      el('div', { class: 'lb-reads' }, rZone.box, rH.box, rAngle.box, rChamp.box),
      rTaches),
    ctrls);
  return { root, rendre };
}
