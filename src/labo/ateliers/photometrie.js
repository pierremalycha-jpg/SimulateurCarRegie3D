// @ts-check
import { el, kelvinRGBNorm } from '../../util.js';
import { commandes, afficheur, jetons, toile, fr, teinte, arrondi } from '../kit.js';
import { SOURCES, GELS } from '../calc/photometrie.js';

// ----------------------------------------------------------------------------------
// L'atelier « Photométrie » : un plateau vu de dessus, un sujet face à la caméra, une cellule de
// luxmètre sur son visage (tournée vers la caméra), deux projecteurs (la principale et le
// débouchage) posés autour : distance, position, visée, faisceau, gradateur, gélatine. Les
// afficheurs : intensité, éclairement de chacun, total, température du mélange, écart avec la
// balance de la caméra, exposition (N, ISO, 1/50 s), rapport de contraste. Tout vient de
// labo/calc/photometrie.js ; la couleur du faisceau dessiné suit sa température.
// ----------------------------------------------------------------------------------
const W = 640, H = 360;
const lx = (v) => `${fr(Math.round(v), 0)} lx`;

export function creer(/** @type {import('../kit.js').Ctx} */ ctx) {
  const T = jetons();
  const C = commandes(ctx);
  const plan = toile(W, H, 'Le plateau vu de dessus : le sujet, la caméra en bas, les projecteurs et leur faisceau', 'lb-plan');
  const vue = toile(200, 200, 'Le visage du sujet vu par la caméra : luminosité et couleur', 'lb-swatch');
  const r1 = afficheur('Principale'), r2 = afficheur('Débouchage'), rE = afficheur('Au luxmètre'), rT = afficheur('Couleur de la lumière'), rX = afficheur('Exposition'), rR = afficheur('Contraste');

  const proj = (p, nom) => {
    const box = el('fieldset', { class: 'lb-group' }, el('legend', {}, nom),
      p === 'p2' ? C.caseA('p2.on', 'Allumé') : null,
      C.liste(p + '.source', 'Projecteur', Object.values(SOURCES).map((S) => [S.id, S.nom])),
      C.curseur(p + '.angle', 'Faisceau', { min: 10, max: 60, step: 1, fmt: (v) => fr(v, 0), unite: '°' }),
      C.curseur(p + '.niveau', 'Gradateur', { min: 0, max: 1, step: 0.01, fmt: (v) => fr(v * 100, 0) + ' %' }),
      C.curseur(p + '.Tled', 'Couleur (LED)', { min: 2800, max: 6500, step: 50, fmt: (v) => fr(v, 0) + ' K' }),
      C.liste(p + '.gel', 'Gélatine', GELS.map((g) => [g.id, g.nom])),
      C.curseur(p + '.d', 'Distance', { min: 1, max: 15, step: 0.05, log: true, fmt: (v) => fr(v, 2) + ' m' }),
      C.curseur(p + '.phi', 'Position', { min: -80, max: 80, step: 1, fmt: (v) => (v === 0 ? 'de face' : `${fr(Math.abs(v), 0)}° ${v < 0 ? 'à gauche' : 'à droite'}`) }),
      C.curseur(p + '.alpha', 'Visée', { min: 0, max: 40, step: 1, fmt: (v) => (v === 0 ? 'sur le sujet' : `${fr(v, 0)}° à côté`) }));
    return box;
  };
  const ctrls = el('div', { class: 'lb-ctls' },
    proj('p1', 'La principale'), proj('p2', 'Le débouchage'),
    el('fieldset', { class: 'lb-group' }, el('legend', {}, 'La caméra'),
      C.touches('cam.iso', 'Sensibilité', [[400, '400'], [800, '800'], [1600, '1600']].map(([v, t]) => [v, `${t} ISO`])),
      C.touches('cam.N', 'Iris', [1.4, 2, 2.8, 4, 5.6, 8, 11].map((n) => [n, 'f/' + fr(n, Number.isInteger(n) ? 0 : 1)])),
      C.curseur('cam.Tcam', 'Balance des blancs', { min: 2800, max: 6500, step: 50, fmt: (v) => fr(v, 0) + ' K' }),
      el('p', { class: 'lb-note' }, 'Temps de pose : 1/50 s. Cellule plate, C = 250.')));

  function peindrePlan(m) {
    const st = ctx.st, g = plan.g;
    g.clearRect(0, 0, W, H); g.fillStyle = T.panel; g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = 70;
    // l'échelle suit le projecteur le plus loin (au plus 50 px par mètre)
    const ech = Math.min(50, 230 / Math.max(3, st.p1.on ? st.p1.d : 0, st.p2.on ? st.p2.d : 0));
    // le quadrillage du sol (un mètre)
    g.strokeStyle = teinte(T.fg, 0.05);
    for (let x = cx % ech; x < W; x += ech) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = cy % ech; y < H; y += ech) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // les faisceaux (en dessous de tout)
    for (const [k, r, nom] of [['p1', m.r1, '1'], ['p2', m.r2, '2']]) {
      const p = st[k]; if (!p.on) continue;
      const ang = (90 - p.phi) * Math.PI / 180; // depuis le sujet : 0° = vers la caméra (en bas), négatif à gauche
      const px = cx + Math.cos(ang) * p.d * ech, py = cy + Math.sin(ang) * p.d * ech;
      const vise = Math.atan2(cy - py, cx - px) + (p.alpha * Math.PI / 180) * (p.phi >= 0 ? 1 : -1);
      const demi = r.theta * Math.PI / 360, L = Math.hypot(W, H);
      const [cr, cg, cb] = r.T > 0 ? kelvinRGBNorm(r.T) : [1, 1, 1]; const mx = Math.max(cr, cg, cb);
      const col = `rgba(${Math.round(255 * cr / mx)},${Math.round(255 * cg / mx)},${Math.round(255 * cb / mx)},`;
      const grd = g.createRadialGradient(px, py, 4, px, py, L * 0.6);
      const a = Math.min(0.55, 0.12 + 0.4 * Math.min(1, r.I0 / 40000));
      grd.addColorStop(0, col + a + ')'); grd.addColorStop(1, col + '0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(px, py); g.arc(px, py, L, vise - demi, vise + demi); g.closePath(); g.fill();
      // le projecteur
      g.save(); g.translate(px, py); g.rotate(vise);
      g.fillStyle = T.fg; arrondi(g, -14, -9, 22, 18, 4); g.fill(); g.fillStyle = col + '1)'; g.fillRect(8, -7, 4, 14);
      g.restore();
      g.fillStyle = T.fg; g.font = `600 13px ${T.font}`; g.textAlign = 'center'; g.fillText(nom === '1' ? 'Principale' : 'Débouchage', px, py - 16);
      g.fillStyle = T.muted; g.font = `12px ${T.font}`; g.fillText(`${fr(p.d, 2)} m`, (px + cx) / 2, (py + cy) / 2 - 4);
      g.strokeStyle = teinte(T.fg, 0.25); g.setLineDash([3, 4]); g.beginPath(); g.moveTo(px, py); g.lineTo(cx, cy); g.stroke(); g.setLineDash([]);
    }
    // le sujet (de dessus : épaules et tête), la cellule tournée vers la caméra
    g.fillStyle = T.dim; arrondi(g, cx - 20, cy - 8, 40, 16, 8); g.fill();
    g.fillStyle = T.muted; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = T.amber; g.beginPath(); g.arc(cx, cy + 12, 4, 0, Math.PI * 2); g.fill();
    // la caméra, en bas
    g.fillStyle = T.fg; arrondi(g, cx - 12, H - 40, 24, 30, 4); g.fill();
    g.beginPath(); g.moveTo(cx - 8, H - 40); g.lineTo(cx + 8, H - 40); g.lineTo(cx + 11, H - 48); g.lineTo(cx - 11, H - 48); g.fill();
    g.fillStyle = T.muted; g.font = `12px ${T.font}`; g.textAlign = 'center'; g.fillText('caméra', cx, H - 4);
    g.fillStyle = T.amber; g.fillText(lx(m.E), cx + 46, cy + 16);
  }
  function peindreVue(m) {
    const g = vue.g, st = ctx.st;
    g.clearRect(0, 0, 200, 200); g.fillStyle = T.bg; g.fillRect(0, 0, 200, 200);
    // la luminosité : l'écart d'exposition (± 3 diaphs du gris moyen) ; la couleur : la lumière vue par la balance de la caméra
    const e = Number.isFinite(m.expo) ? m.expo : -6;
    const niveau = Math.max(0, Math.min(1, 0.45 * Math.pow(2, e * 0.55)));
    const L = m.T > 0 ? kelvinRGBNorm(m.T) : [1, 1, 1], Cm = kelvinRGBNorm(st.cam.Tcam);
    const ch = [L[0] / Cm[0], 1, L[2] / Cm[2]]; const mx = Math.max(...ch, 1);
    const col = (k) => Math.round(Math.min(255, 255 * niveau * ch[k] / mx * 1.15));
    g.fillStyle = `rgb(${col(0)},${col(1)},${col(2)})`;
    g.beginPath(); g.ellipse(100, 92, 46, 58, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); arrondi(g, 40, 150, 120, 60, 30); g.fill();
    // le côté ombre (débouchage seul) : la principale vient du côté où elle est posée
    if (st.p1.on && st.p2.on && m.e2 > 0) {
      const ombre = Math.max(0, Math.min(0.9, 1 - 1 / m.ratio));
      g.fillStyle = `rgba(0,0,0,${ombre.toFixed(2)})`;
      const gauche = st.p1.phi > 0; g.beginPath(); g.ellipse(100, 92, 46, 58, 0, gauche ? Math.PI / 2 : -Math.PI / 2, gauche ? Math.PI * 1.5 : Math.PI / 2); g.fill();
    }
    if (e > 1.5) { g.strokeStyle = T.fg; g.lineWidth = 3; for (let x = -200; x < 200; x += 14) { g.beginPath(); g.moveTo(x, 200); g.lineTo(x + 200, 0); g.stroke(); } g.lineWidth = 1; }
  }

  function rendre() {
    const m = ctx.m(), st = ctx.st;
    C.refresh();
    // les commandes qui ne servent pas : la couleur pour les sources à température fixe, le débouchage éteint
    for (const p of ['p1', 'p2']) {
      const led = SOURCES[st[p].source] && SOURCES[st[p].source].type === 'led';
      const tl = /** @type {HTMLElement | null} */ (ctrls.querySelector(`[data-k="${p}.Tled"]`)); if (tl && tl.closest('.lb-ctl')) /** @type {HTMLElement} */ (tl.closest('.lb-ctl')).hidden = !led;
      const fa = /** @type {HTMLElement | null} */ (ctrls.querySelector(`[data-k="${p}.angle"]`)); if (fa && fa.closest('.lb-ctl')) /** @type {HTMLElement} */ (fa.closest('.lb-ctl')).hidden = led;
    }
    const lit = (r, p) => (p.on ? `${lx(r.E)}` : 'éteint');
    r1.set(lit(m.r1, st.p1), st.p1.on ? `${fr(m.r1.I0, 0)} cd dans l'axe, faisceau ${fr(m.r1.theta, 0)}° (${fr(m.r1.diametre, 1)} m de large au sujet)` : '');
    r2.set(lit(m.r2, st.p2), st.p2.on ? `${fr(m.r2.I0, 0)} cd dans l'axe, faisceau ${fr(m.r2.theta, 0)}°` : '');
    rE.set(lx(m.E), `il faut ${lx(m.Eref)} pour f/${fr(st.cam.N, st.cam.N < 3 && !Number.isInteger(st.cam.N) ? 1 : 0)}, ${st.cam.iso} ISO, 1/50 s`);
    const dom = Math.round(m.dom);
    rT.set(m.T > 0 ? `${fr(Math.round(m.T / 10) * 10, 0)} K` : '—', m.T > 0 ? `${dom > 0 ? '+' : ''}${dom} mireds par rapport à la caméra : ${Math.abs(dom) <= 20 ? 'neutre' : dom > 0 ? 'tire vers l\'orange' : 'tire vers le bleu'}` : '', m.T > 0 ? (Math.abs(dom) <= 20 ? 'ok' : 'warn') : '');
    rX.set(Number.isFinite(m.expo) ? `${m.expo > 0 ? '+' : ''}${fr(m.expo, 2)} diaph` : '—', Number.isFinite(m.expo) ? (Math.abs(m.expo) <= 1 / 3 ? 'exposé juste' : m.expo > 0 ? 'surexposé' : 'sous-exposé') : 'pas de lumière', Number.isFinite(m.expo) && Math.abs(m.expo) <= 1 / 3 ? 'ok' : 'warn');
    rR.set(st.p1.on && st.p2.on && m.e2 > 0 ? `${fr(m.ratio, 2)}:1` : '—', st.p1.on && st.p2.on && m.e2 > 0 ? `${fr(m.ratioDiaphs, 2)} diaph entre côté éclairé et côté ombre` : 'allumez les deux projecteurs');
    peindrePlan(m); peindreVue(m);
  }
  const root = el('div', { class: 'lb-atelier lb-photometrie' },
    el('div', { class: 'lb-stage' },
      el('figure', { class: 'lb-fig' }, plan.c, el('figcaption', {}, 'Le plateau vu de dessus (un carreau = 1 m), la caméra en bas')),
      el('div', { class: 'lb-duo lb-duo-g' },
        el('figure', { class: 'lb-fig lb-fig-s' }, vue.c, el('figcaption', {}, 'Le visage vu par la caméra (hachures : surexposé)')),
        el('div', { class: 'lb-reads' }, rE.box, r1.box, r2.box, rT.box, rX.box, rR.box))),
    ctrls);
  return { root, rendre };
}
