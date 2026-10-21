// @ts-check
import { el, clamp, mulberry32 } from '../util.js';
import { LINKS } from '../data/cameras.js';

// ----------------------------------------------------------------------------------
// Manipulation de la leçon « La falaise numérique » (cours/sdi_falaise.js) : la longueur du câble,
// le format et l'égaliseur ; le diagramme de l'œil et l'image au multiview, la voix d'Olivier qui
// commente, trois défis qui se cochent seuls. Reçoit son conteneur et rend une fonction de
// nettoyage (animations arrêtées quand la leçon se ferme).
// ----------------------------------------------------------------------------------

// ---------------- SDI : la falaise numérique ----------------
// Atténuation à la moitié de la fréquence d'horloge d'un coaxial courant (type 1694A), en dB pour
// 100 m (ordre de grandeur). Les portées viennent du simulateur (LINKS.coax.max), mesurées avec
// l'égaliseur du récepteur : le cours et le plan caméras disent la même chose.
const SDI_FMT = [
  { id: 'HDi', nom: 'HD-SDI', debit: '1,485 Gb/s', image: '1080i50', k: 22, f: '742,5 MHz', ui: 673 },
  { id: 'HD', nom: '3G-SDI', debit: '2,97 Gb/s', image: '1080p50', k: 31, f: '1,485 GHz', ui: 337 },
  { id: 'UHD', nom: '12G-SDI', debit: '11,88 Gb/s', image: '2160p50', k: 66, f: '5,94 GHz', ui: 84 },
];
const SDI_STATE = {
  ok: ['Image parfaite', 'green'],
  bord: ['Image parfaite, mais des erreurs', 'amber'],
  casse: ['Étincelles et gels', 'red'],
  perdu: ['Image perdue', 'red'],
};

/** modèle de la liaison : ouverture de l'œil (0 à 1), erreurs CRC par seconde, état */
export function sdiLink(fmtId, len, eq) {
  const F = SDI_FMT.find((f) => f.id === fmtId) || SDI_FMT[1];
  const lmax = LINKS.coax.max[F.id] || 100;
  const att = F.k * len / 100;
  let open, tau, sigma;
  if (eq) {
    // l'égaliseur rouvre l'œil ; près de la limite, il remonte autant le bruit que le signal
    const u = len / lmax;
    open = u <= 0.6 ? 0.92 : u <= 1 ? 0.92 - 0.67 * ((u - 0.6) / 0.4) ** 2 : Math.max(0, 0.25 - 5 * (u - 1));
    tau = 0.16; sigma = 0.012 + (1 - open) ** 2 * 0.35;
  } else {
    // sans égaliseur, le câble arrondit les fronts : un bit n'a plus le temps d'atteindre son niveau
    tau = 0.12 + att * 0.11;
    open = clamp(1 - 2 * Math.exp(-1 / tau), 0, 1) * 0.95; sigma = 0.015;
  }
  const state = open >= 0.45 ? 'ok' : open >= 0.25 ? 'bord' : open >= 0.06 ? 'casse' : 'perdu';
  const crc = state === 'ok' ? 0 : state === 'bord' ? Math.round(10 ** (3 * (0.45 - open) / 0.2)) : state === 'casse' ? Math.round(1000 * 10 ** (2 * (0.25 - open) / 0.19)) : null;
  return { F, lmax, att, open, tau, sigma, jitter: (1 - open) ** 2 * 0.3, state, crc };
}

// diagramme de l'œil : 2 UI à l'écran, croisements à 0,5 et 1,5 UI, des centaines de passages
function drawEye(cv, L, eq, seed) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height, dpr = W / Math.max(1, cv.clientWidth || W);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#0b1013'; ctx.fillRect(0, 0, W, H);
  // graticule
  ctx.strokeStyle = '#18252b'; ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) { const x = Math.round(W * i / 8) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let i = 1; i < 6; i++) { const y = Math.round(H * i / 6) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const X = (t) => (t / 2) * W, Y = (v) => H / 2 - v * H * 0.3;
  const rnd = mulberry32(seed), g = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const N = 260, dt = 1 / 48, a = 1 - Math.exp(-dt / L.tau);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(110, 236, 160, 0.16)'; ctx.lineWidth = 1.3 * dpr;
  for (let n = 0; n < N; n++) {
    const bits = Array.from({ length: 11 }, () => (rnd() < 0.5 ? 1 : -1));
    const edges = bits.map(() => g() * L.jitter);
    const off = g() * L.sigma;
    let y = bits[0];
    ctx.beginPath();
    for (let t = 0; t <= 10; t += dt) {
      // bit en cours : chaque front j arrive à j + edges[j] (en avance ou en retard : la gigue)
      const j = Math.floor(t); const s = t < j + edges[j] ? bits[Math.max(0, j - 1)] : j < 10 && t >= j + 1 + edges[j + 1] ? bits[j + 1] : bits[j];
      y += (s - y) * a;
      if (t >= 7.5 && t <= 9.5) { const px = X(t - 7.5), py = Y(y + off + g() * L.sigma * 0.35); if (t - dt < 7.5) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  // masque : la zone où le récepteur décide ; une trace qui y entre, c'est une erreur possible
  const good = L.open >= 0.45;
  ctx.strokeStyle = good ? '#2fbf5a' : '#f0372c'; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([5 * dpr, 4 * dpr]);
  const hw = 0.22, ih = 0.1, hh = 0.32;
  ctx.beginPath(); ctx.moveTo(X(1 - hw), Y(0)); ctx.lineTo(X(1 - ih), Y(hh)); ctx.lineTo(X(1 + ih), Y(hh)); ctx.lineTo(X(1 + hw), Y(0)); ctx.lineTo(X(1 + ih), Y(-hh)); ctx.lineTo(X(1 - ih), Y(-hh)); ctx.closePath(); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `${11 * dpr}px "B612 Mono", ui-monospace, monospace`; ctx.fillStyle = '#86a596';
  ctx.fillText(eq ? 'Après l\'égaliseur' : 'Sans égaliseur', 8 * dpr, 16 * dpr);
  const lab = `1 UI = ${L.F.ui} ps`; ctx.fillText(lab, W - ctx.measureText(lab).width - 8 * dpr, H - 8 * dpr);
}

// l'image au multiview : un plan large de match, propre, qui étincelle, ou rien
function paintPicture(base) {
  const ctx = base.getContext('2d'); if (!ctx) return;
  const W = base.width, H = base.height, rnd = mulberry32(11);
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.34); sky.addColorStop(0, '#3a2a2a'); sky.addColorStop(1, '#5a3b30');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.34);
  for (let i = 0; i < 1400; i++) { ctx.fillStyle = rnd() < 0.5 ? '#c4302b' : rnd() < 0.5 ? '#e9c13a' : '#2a1d1b'; ctx.fillRect(rnd() * W, rnd() * H * 0.32, 2, 2); }
  for (let i = 0; i < 9; i++) { const y0 = H * (0.34 + i * 0.074), y1 = H * (0.34 + (i + 1) * 0.074); ctx.fillStyle = i % 2 ? '#2f8a3c' : '#36994a'; ctx.fillRect(0, y0, W, y1 - y0); }
  ctx.strokeStyle = 'rgba(240,245,240,.9)'; ctx.lineWidth = Math.max(1.5, W / 320);
  ctx.beginPath(); ctx.moveTo(0, H * 0.4); ctx.lineTo(W, H * 0.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W * 0.56, H * 0.4); ctx.lineTo(W * 0.62, H); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(W * 0.59, H * 0.68, W * 0.16, H * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
  const player = (x, y, c1, c2) => { ctx.fillStyle = c1; ctx.fillRect(x - W * 0.006, y - H * 0.05, W * 0.012, H * 0.03); ctx.fillStyle = c2; ctx.fillRect(x - W * 0.006, y - H * 0.02, W * 0.012, H * 0.02); };
  [[0.3, 0.62], [0.45, 0.78], [0.52, 0.55], [0.7, 0.6], [0.8, 0.85]].forEach(([x, y]) => player(W * x, H * y, '#d4302a', '#f2c230'));
  [[0.38, 0.7], [0.6, 0.5], [0.66, 0.74], [0.9, 0.58]].forEach(([x, y]) => player(W * x, H * y, '#f2f2f2', '#2a4fb0'));
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.66, W * 0.006, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(8,12,15,.82)'; ctx.fillRect(W * 0.04, H * 0.06, W * 0.27, H * 0.1);
  ctx.fillStyle = '#e3e7e1'; ctx.font = `600 ${Math.round(H * 0.06)}px "Archivo Narrow", "Arial Narrow", sans-serif`; ctx.fillText('RCL 0-0 RIV   12:34', W * 0.055, H * 0.13);
}
function drawPicture(cv, base, L, rnd) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  if (L.state === 'perdu') {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e3e7e1'; ctx.font = `700 ${Math.round(H * 0.08)}px "B612 Mono", ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.fillText('PAS DE SIGNAL', W / 2, H / 2); ctx.textAlign = 'start';
    return;
  }
  ctx.drawImage(base, 0, 0, W, H);
  if (L.state !== 'casse') return;
  // étincelles : des pixels faux ; des blocs de ligne qui sautent quand ça s'aggrave
  const n = Math.min(5000, Math.round(L.crc / 12));
  for (let i = 0; i < n; i++) { const v = rnd(); ctx.fillStyle = v < 0.45 ? '#fff' : v < 0.8 ? '#000' : v < 0.9 ? '#f0f' : '#0ff'; ctx.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 2, 1); }
  const bands = L.open < 0.15 ? 3 : L.open < 0.2 ? 1 : 0;
  for (let i = 0; i < bands; i++) { const y = Math.floor(rnd() * H * 0.9), h = Math.floor(H * (0.02 + rnd() * 0.05)); ctx.drawImage(cv, 0, y, W, h, Math.floor((rnd() - 0.5) * W * 0.2), y, W, h); }
}

function olivier(L, len, eq) {
  const fmt = L.F.nom;
  if (!eq) return L.state === 'ok' ? 'Sans égaliseur, regarde l\'œil : les fronts s\'arrondissent, le câble a mangé les aigus. Allonge encore un peu.'
    : L.state === 'bord' ? `Sans égaliseur, l'œil se ferme déjà à ${len} m et les erreurs commencent.`
      : `Sans égaliseur, le ${fmt} ne passe même pas ${len} m. C'est l'égaliseur qui rattrape les aigus perdus dans le câble : remets-le.`;
  if (L.state === 'ok') return len / L.lmax > 0.6 ? 'L\'œil commence à se refermer, mais l\'image reste parfaite. Continue d\'allonger le câble.' : 'L\'œil est grand ouvert : le récepteur lit chaque bit sans hésiter. Allonge le câble et regarde l\'œil.';
  if (L.state === 'bord') return 'Regarde le compteur : des erreurs CRC, et pourtant l\'image paraît parfaite. Tu es au bord de la falaise ; en exploitation, on ne travaille jamais ici.';
  if (L.state === 'casse') return 'Étincelles et gels : quelques mètres de plus et c\'est fini.';
  return `Image perdue d'un coup, à ${len} m. En numérique, c'est tout ou rien.`;
}

/** @param {HTMLElement} host */
function labSdi(host) {
  const st = { fmt: 'HD', len: 40, eq: true, seed: 1 };
  const defis = [
    { id: 'hd', text: 'Fais tomber l\'image en HD-SDI. À combien de mètres ?', test: () => st.fmt === 'HDi' && st.eq, got: 0 },
    { id: 'uhd', text: 'Même chose en 12G-SDI.', test: () => st.fmt === 'UHD' && st.eq, got: 0 },
    { id: 'eq', text: 'Coupe l\'égaliseur, puis allonge le câble jusqu\'à perdre l\'image.', test: () => !st.eq, got: 0, fmt: '' },
  ];
  const fmtKeys = SDI_FMT.map((F) => el('button', { type: 'button', 'aria-pressed': String(F.id === st.fmt), onclick: () => { st.fmt = F.id; update(); } }, el('b', {}, F.nom), el('small', {}, `${F.debit} · ${F.image}`)));
  const len = /** @type {HTMLInputElement} */ (el('input', { type: 'range', id: 'co-sdi-len', min: 1, max: 200, step: 1, value: st.len }));
  const lenOut = el('output', { for: 'co-sdi-len' });
  len.addEventListener('input', () => { st.len = +len.value; update(true); });
  const eqBtn = el('button', { type: 'button', class: 'btn toggle', 'aria-pressed': 'true', onclick: () => { st.eq = !st.eq; update(); } }, 'Égaliseur du récepteur');
  const eye = /** @type {HTMLCanvasElement} */ (el('canvas', { class: 'co-scope', role: 'img' }));
  const pic = /** @type {HTMLCanvasElement} */ (el('canvas', { class: 'co-mon-scr', role: 'img' }));
  const base = document.createElement('canvas');
  const ro = { att: el('b'), open: el('b'), crc: el('b'), led: el('i', { class: 'co-led' }), state: el('b') };
  const say = el('p', { 'aria-live': 'polite' });
  const defiList = el('ul', { class: 'co-defis' });
  const doneBox = el('p', { class: 'co-say-done', hidden: true }, 'Tu as trouvé la falaise trois fois : la portée dépend du débit, et l\'égaliseur fait le reste. Retiens qu\'on garde toujours de la marge.');
  host.append(
    el('div', { class: 'co-say' }, el('span', { class: 'co-who' }, 'Olivier'), say),
    el('div', { class: 'co-ctl' },
      el('div', { class: 'lab-seg', role: 'group', 'aria-label': 'Format du signal' }, ...fmtKeys),
      el('div', { class: 'co-len' }, el('label', { for: 'co-sdi-len' }, 'Longueur du câble coaxial'), len, lenOut),
      eqBtn),
    el('div', { class: 'co-lab-grid' },
      el('figure', { class: 'co-panel' }, eye, el('figcaption', {}, 'Diagramme de l\'œil, mesuré au récepteur')),
      el('figure', { class: 'co-panel' }, el('div', { class: 'co-mon' }, pic, el('div', { class: 'co-umd' }, el('i'), el('b', {}, 'CAM 1'), el('small', {}, 'multiview'))), el('figcaption', {}, 'Ce que voit le réalisateur'))),
    el('div', { class: 'lab-read glass' },
      el('span', {}, 'Atténuation', ro.att), el('span', {}, 'Ouverture de l\'œil', ro.open), el('span', {}, 'Erreurs CRC', ro.crc), el('span', { class: 'co-st' }, ro.led, ro.state)),
    el('div', { class: 'co-defi-box' }, el('h4', {}, 'Les défis d\'Olivier'), defiList, doneBox));
  // tailles des canevas : à la largeur affichée, en pixels de l'écran
  const fit = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const [cv, ar] of /** @type {[HTMLCanvasElement, number][]} */ ([[eye, 10 / 16], [pic, 9 / 16]])) { const w = Math.max(240, Math.round((cv.clientWidth || 420) * dpr)); cv.width = w; cv.height = Math.round(w * ar); }
    base.width = pic.width; base.height = pic.height; paintPicture(base);
  };
  let L = sdiLink(st.fmt, st.len, st.eq), raf = 0, lastT = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = mulberry32(5);
  const loop = (t) => {
    raf = 0;
    if (!host.isConnected || L.state !== 'casse') return;
    if (t - lastT > 90) { lastT = t; drawPicture(pic, base, L, rnd); }
    raf = requestAnimationFrame(loop);
  };
  let prev = L.state;
  function update(byLen = false) {
    L = sdiLink(st.fmt, st.len, st.eq);
    fmtKeys.forEach((b, i) => b.setAttribute('aria-pressed', String(SDI_FMT[i].id === st.fmt)));
    eqBtn.setAttribute('aria-pressed', String(st.eq));
    lenOut.textContent = `${st.len} m`;
    ro.att.textContent = `${Math.round(L.att)} dB à ${L.F.f}`;
    ro.open.textContent = `${Math.round(L.open * 100)} %`;
    ro.crc.textContent = L.crc == null ? 'pas de verrouillage' : `${L.crc.toLocaleString('fr-FR')} /s`;
    const [txt, col] = SDI_STATE[L.state];
    ro.state.textContent = txt; ro.led.className = 'co-led ' + col;
    say.textContent = olivier(L, st.len, st.eq);
    eye.setAttribute('aria-label', `Diagramme de l'œil ${st.eq ? 'après' : 'sans'} égaliseur : ouverture ${Math.round(L.open * 100)} %`);
    pic.setAttribute('aria-label', `Image au multiview : ${txt}`);
    st.seed = (st.seed + 1) % 997;
    drawEye(eye, L, st.eq, st.seed);
    drawPicture(pic, base, L, rnd);
    if (L.state === 'casse' && !raf && !reduce) raf = requestAnimationFrame(loop);
    // défis : la longueur où l'image tombe, quand c'est le câble qu'on allonge qui la fait tomber
    if (byLen && L.state === 'perdu' && prev !== 'perdu') for (const d of defis) if (!d.got && d.test()) { d.got = st.len; if (d.id === 'eq') d.fmt = L.F.nom; }
    prev = L.state;
    drawDefis();
  }
  function drawDefis() {
    defiList.replaceChildren(...defis.map((d) => el('li', { class: d.got ? 'done' : '' }, el('i', { class: 'co-led ' + (d.got ? 'green' : '') }),
      el('span', {}, d.text, d.got ? el('b', {}, ` Perdue à ${d.got} m${d.fmt ? ` en ${d.fmt}` : ''}.`) : null))));
    doneBox.hidden = !defis.every((d) => d.got);
  }
  const onResize = () => { fit(); update(); };
  addEventListener('resize', onResize);
  requestAnimationFrame(() => { fit(); update(); });
  fit(); update();
  return () => { removeEventListener('resize', onResize); if (raf) cancelAnimationFrame(raf); };
}

export { labSdi, SDI_FMT };
