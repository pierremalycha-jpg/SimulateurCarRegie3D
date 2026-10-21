// @ts-check
import { el, clamp } from '../util.js';
import { SENSOR, MIRE_D, ND, COC, defocus, focusDist, zoomFocal, zoomPos, effAperture, exposureOf, blurPx, fr, distLabel } from './optics.js';

// ----------------------------------------------------------------------------------
// Manipulations des fiches du module caméra. Chacune reçoit ctx = { lens(state) } : la
// manipulation pilote aussi la caméra 3D (bagues, image du viseur). Elle renvoie
// { node, dispose }. Les calculs viennent de camlab/optics.js (modèle de la lentille mince).
// ----------------------------------------------------------------------------------

// ---------------- l'image du viseur : la mire du plateau, vue par l'objectif ----------------
// Calques à leur distance (rideau du fond, mire), chacun flouté par sa propre tache de flou :
// la tache est un disque, échantillonné en 16 copies additionnées (mode « lighter »).
const TAPS = (() => { const t = [[0, 0]]; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; t.push([0.5 * Math.cos(a), 0.5 * Math.sin(a)]); } for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2; t.push([Math.cos(a), Math.sin(a)]); } return t; })();
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/** floute un calque (disque de rayon r pixels) et le pose sur dst */
function discBlur(src, dst, r, work) {
  const g = dst.getContext('2d');
  if (r < 0.6) { g.drawImage(src, 0, 0); return; }
  // grand flou : on travaille en réduction (le lissage bilinéaire comble les copies)
  const s = r > 14 ? 0.25 : r > 6 ? 0.5 : 1;
  const w = Math.max(2, Math.round(src.width * s)), h = Math.max(2, Math.round(src.height * s));
  if (work.width !== w || work.height !== h) { work.width = w; work.height = h; }
  const tmp = work.small || (work.small = cnv(w, h)); if (tmp.width !== w || tmp.height !== h) { tmp.width = w; tmp.height = h; }
  const tg = tmp.getContext('2d'); tg.clearRect(0, 0, w, h); tg.drawImage(src, 0, 0, w, h);
  const wg = work.getContext('2d'); wg.clearRect(0, 0, w, h); wg.globalCompositeOperation = 'lighter'; wg.globalAlpha = 1 / TAPS.length;
  for (const [dx, dy] of TAPS) wg.drawImage(tmp, dx * r * s, dy * r * s);
  wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 1;
  g.drawImage(work, 0, 0, src.width, src.height);
}

function drawStar(g, cx, cy, R) {
  const n = 36; g.fillStyle = '#121212';
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 0.5) / n * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath(); g.fill(); }
  g.strokeStyle = '#121212'; g.lineWidth = Math.max(1, R * 0.012); g.beginPath(); g.arc(cx, cy, R * 1.03, 0, Math.PI * 2); g.stroke();
}

/**
 * Le viseur simulé : dessine la mire telle que la voit l'objectif. o = { f, dF (m), delta (mm),
 * N (nombre f effectif), nd (lumière transmise), mag (loupe) }
 */
export function makeViewfinder(W = 640, H = 360) {
  const view = cnv(W, H), frame = cnv(W, H), layer = cnv(W, H), work = cnv(W, H), base = cnv(W, H);
  view.className = 'cl-vfc';
  function draw(o) {
    const fg = frame.getContext('2d'), lg = layer.getContext('2d');
    const curtainD = MIRE_D + 1.75;
    // rideau du fond : plis verticaux de 25 cm, à 4,75 m
    lg.clearRect(0, 0, W, H);
    const ppmC = H / (curtainD * SENSOR.h / o.f);
    const gr = lg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d1430'); gr.addColorStop(1, '#1a2550'); lg.fillStyle = gr; lg.fillRect(0, 0, W, H);
    for (let x = -Math.ceil(W / 2 / (0.25 * ppmC)) - 1; x <= Math.ceil(W / 2 / (0.25 * ppmC)) + 1; x++) {
      const px = W / 2 + x * 0.25 * ppmC; const g2 = lg.createLinearGradient(px, 0, px + 0.25 * ppmC, 0);
      g2.addColorStop(0, 'rgba(0,0,0,0.35)'); g2.addColorStop(0.5, 'rgba(90,110,190,0.12)'); g2.addColorStop(1, 'rgba(0,0,0,0.35)'); lg.fillStyle = g2; lg.fillRect(px, 0, 0.25 * ppmC + 1, H);
    }
    // sol (l'axe est à 1,40 m) au niveau du rideau
    const floorY = H / 2 + 1.4 * ppmC; if (floorY < H) { lg.fillStyle = '#1b1c1f'; lg.fillRect(0, floorY, W, H - floorY); }
    fg.clearRect(0, 0, W, H);
    discBlur(layer, frame, blurPx(Math.abs(defocus(o.f, curtainD, o.dF, o.delta)) / o.N, H) / 2, work);
    // la mire : carton de 60 cm, étoile de 43 cm de diamètre, centrée sur l'axe ; chevalet dessous
    lg.clearRect(0, 0, W, H);
    const ppm = H / (MIRE_D * SENSOR.h / o.f), cx = W / 2, cy = H / 2;
    lg.fillStyle = '#3a2a1c'; for (const dx of [-0.25, 0.25]) { lg.save(); lg.translate(cx + dx * ppm, cy + 0.3 * ppm); lg.rotate(dx * 0.15); lg.fillRect(-0.012 * ppm, 0, 0.024 * ppm, 1.4 * ppm); lg.restore(); }
    lg.fillStyle = '#ecece6'; lg.fillRect(cx - 0.3 * ppm, cy - 0.3 * ppm, 0.6 * ppm, 0.6 * ppm);
    drawStar(lg, cx, cy - 0.024 * ppm, 0.216 * ppm);
    for (let i = 0; i < 11; i++) { const v = Math.round(255 * Math.pow(i / 10, 1 / 1.1)); lg.fillStyle = `rgb(${v},${v},${v})`; lg.fillRect(cx - 0.252 * ppm + i * 0.0458 * ppm, cy + 0.228 * ppm, 0.0458 * ppm + 0.5, 0.036 * ppm); }
    discBlur(layer, frame, blurPx(Math.abs(defocus(o.f, MIRE_D, o.dF, o.delta)) / o.N, H) / 2, work);
    // exposition : moins de lumière = voile noir, plus = copies additionnées (les blancs saturent)
    const E = exposureOf(o.N, o.nd);
    if (E < 1) { fg.fillStyle = `rgba(0,0,0,${1 - E})`; fg.fillRect(0, 0, W, H); }
    else {
      const bg = base.getContext('2d'); bg.clearRect(0, 0, W, H); bg.drawImage(frame, 0, 0);
      fg.globalCompositeOperation = 'lighter';
      for (let rest = Math.min(E, 40) - 1; rest > 0.01; rest -= 1) { fg.globalAlpha = Math.min(1, rest); fg.drawImage(base, 0, 0); }
      fg.globalAlpha = 1; fg.globalCompositeOperation = 'source-over';
    }
    // ce que montre le viseur : l'image entière, ou le centre grossi trois fois (MAG)
    const vg = view.getContext('2d');
    vg.imageSmoothingEnabled = true;
    if (o.mag) vg.drawImage(frame, W / 3, H / 3, W / 3, H / 3, 0, 0, W, H); else vg.drawImage(frame, 0, 0);
    // incrustations du viseur
    vg.font = '600 15px "B612 Mono", monospace'; vg.fillStyle = 'rgba(240,240,232,0.92)'; vg.shadowColor = 'rgba(0,0,0,0.7)'; vg.shadowBlur = 3;
    vg.textAlign = 'left'; vg.fillText(`Z ${fr(o.f, o.f < 10 ? 1 : 0)} mm`, 12, 22); vg.fillText(`F${fr(o.N, 1)}`, 12, 42);
    vg.textAlign = 'right'; vg.fillText(ND.find((x) => x[1] === o.nd)[0], W - 12, 22);
    if (o.mag) { vg.fillStyle = '#ffb020'; vg.fillText('MAG ×3', W - 12, H - 14); }
    vg.shadowBlur = 0;
    vg.strokeStyle = 'rgba(240,240,232,0.55)'; vg.lineWidth = 1.5; vg.beginPath(); vg.moveTo(W / 2 - 10, H / 2); vg.lineTo(W / 2 + 10, H / 2); vg.moveTo(W / 2, H / 2 - 10); vg.lineTo(W / 2, H / 2 + 10); vg.stroke();
  }
  return { canvas: view, draw };
}

// ---------------- commandes ----------------
function slider(label, min, max, step, value, onInput, cls = '') {
  const out = el('output', { class: 'cl-out' });
  const input = /** @type {HTMLInputElement} */ (el('input', { type: 'range', min, max, step, value, 'aria-label': label, oninput: () => onInput(Number(input.value)) }));
  return { row: el('label', { class: 'cl-row ' + cls }, el('span', { class: 'cl-lbl' }, label), input, out), input, out };
}
function seg(label, options, value, onChange) {
  const box = el('div', { class: 'seg cl-seg', role: 'group', 'aria-label': label });
  const set = (v) => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); onChange(v); };
  for (const [v, text] of options) box.append(el('button', { type: 'button', 'data-v': String(v), 'aria-pressed': String(v === value), onclick: () => set(v) }, text));
  return { row: el('div', { class: 'cl-row' }, el('span', { class: 'cl-lbl' }, label), box), set };
}

// =================================================================================
export const LABS = {
  /** le réglage du tirage, comme sur le plateau : mire à 3 m, serré au point, large au tirage */
  tirage(ctx) {
    const D = MIRE_D;
    // départ : le tirage est faux (l'objectif vient d'être monté), le point est à 5 m, l'iris à f/8, la vis bloquée
    const st = { z: zoomPos(20), s: Math.pow(0.3 / 5, 0.45), delta: 0.09, n: Math.log2(8 / 1.8) / Math.log2(16 / 1.8), nd: 1, locked: true, mag: false };
    const defis = [false, false, false]; let sweep = null;
    const vf = makeViewfinder();
    const f = () => zoomFocal(st.z), dF = () => focusDist(Math.pow(st.s, 1 / 0.45));
    const nSet = () => 1.8 * Math.pow(16 / 1.8, st.n);
    const N = () => effAperture(nSet(), f());
    const dfs = (fl) => Math.abs(defocus(fl, D, dF(), st.delta));
    const sharpAt = (fl) => dfs(fl) / effAperture(nSet(), fl) <= COC;

    const say = el('p', { class: 'cl-say' });
    const list = el('ol', { class: 'cl-defis' },
      el('li', {}, 'Ouvre l\'iris en grand ; si l\'image est trop claire, compense avec un filtre ND.'),
      el('li', {}, 'Règle le tirage : le point en serré, la netteté en large, autant de fois qu\'il faut.'),
      el('li', {}, 'Bloque la vis, puis parcours tout le zoom : l\'image doit rester nette.'));
    const zoom = slider('Zoom', 0, 1, 0.001, st.z, (v) => { st.z = v; up(); });
    const point = slider('Bague de point', 0, 1, 0.0005, st.s, (v) => { st.s = v; up(); });
    const iris = slider('Iris', 0, 1, 0.001, st.n, (v) => { st.n = v; up(); });
    const nd = seg('Filtre', ND.map(([nm, v]) => [v, nm.replace('ND', '')]), st.nd, (v) => { st.nd = Number(v); up(); });
    const ff = slider('Bague F.f', -0.2, 0.2, 0.0004, st.delta, (v) => { st.delta = v; up(); }, 'cl-ff');
    ff.out.textContent = 'sans graduation';
    const lockBtn = el('button', { type: 'button', class: 'btn small', onclick: () => { st.locked = !st.locked; up(); } });
    const magBtn = el('button', { type: 'button', class: 'btn small', 'aria-pressed': 'false', onclick: () => { st.mag = !st.mag; up(); } }, 'Loupe MAG ×3');
    const reset = el('button', { type: 'button', class: 'linkbtn', onclick: () => { Object.assign(st, { z: zoomPos(20), s: Math.pow(0.3 / 5, 0.45), delta: 0.09, n: Math.log2(8 / 1.8) / Math.log2(16 / 1.8), nd: 1, locked: true, mag: false }); defis.fill(false); sweep = null; sync(); up(); } }, 'Recommencer');
    const sync = () => { zoom.input.value = String(st.z); point.input.value = String(st.s); iris.input.value = String(st.n); ff.input.value = String(st.delta); nd.set(st.nd); };
    // molette sur le viseur : la bague de point, finement
    vf.canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.s = clamp(st.s - Math.sign(e.deltaY) * 0.0012, 0, 1); point.input.value = String(st.s); up(); }, { passive: false });

    function olivier() {
      const fl = f(), n = N(), E = exposureOf(n, st.nd);
      if (!defis[0]) {
        if (n > 2.85) return 'L\'iris est à f/' + fr(n) + ' : avec autant de profondeur de champ, une erreur de tirage passe inaperçue. Ouvre-le en grand.';
        if (E > 2.2) return 'L\'image est trop claire. Ne referme pas l\'iris : mets un filtre ND (1/16 conviendra).';
        if (E < 0.45) return 'Un peu sombre : enlève un cran de ND.';
      }
      if (defis[2]) return 'Le zoom est parfocal : net du large au serré. C\'est ce qu\'on vérifie à chaque montage d\'objectif, et avant l\'antenne.';
      if (defis[1]) return st.locked ? 'Vis bloquée. Vérifie maintenant : parcours tout le zoom, du large au serré, l\'image doit rester nette.' : 'Net en serré et en large : bloque la vis de la bague F.f.';
      if (fl >= 45) return sharpAt(fl) ? 'Le serré est net. Élargis à fond, sans toucher la bague de point.' : 'En serré, fais le point sur le centre de l\'étoile avec la bague de point. La loupe aide, la molette sur l\'image aussi.';
      if (fl <= 6) {
        if (!sharpAt(fl)) return st.locked ? 'Net en serré, flou en large : c\'est le tirage. Débloque la vis de la bague F.f pour le régler.' : 'En large, la bague de point n\'agit presque plus. Tourne la bague F.f jusqu\'à ce que le centre de l\'étoile soit net.';
        return sharpAt(54) ? 'Net en large et en serré.' : 'Le large est net. Reviens en serré : le point a un peu bougé. On recommence jusqu\'à ce que tout soit net.';
      }
      return 'Zoome à fond (54 mm) : c\'est en serré qu\'on fait le point.';
    }
    function up() {
      const fl = f(), n = N(), E = exposureOf(n, st.nd);
      // défis
      if (!defis[0] && n <= 2.85 && E <= 2.2 && E >= 0.45) defis[0] = true;
      if (defis[0] && !defis[1] && Math.abs(st.delta) <= 0.012 && dfs(54) <= 0.02 && dfs(4.5) <= 0.012) defis[1] = true;
      if (defis[1] && !defis[2]) {
        if (!st.locked) sweep = null;
        else if (!sharpAt(fl)) sweep = null;
        else { sweep = sweep || { min: fl, max: fl }; sweep.min = Math.min(sweep.min, fl); sweep.max = Math.max(sweep.max, fl); if (sweep.min <= 5 && sweep.max >= 50) defis[2] = true; }
      }
      [...list.children].forEach((li, i) => li.classList.toggle('done', defis[i]));
      ff.input.disabled = st.locked;
      lockBtn.textContent = st.locked ? 'Vis F.f bloquée' : 'Vis F.f débloquée'; lockBtn.classList.toggle('on', !st.locked);
      magBtn.setAttribute('aria-pressed', String(st.mag)); magBtn.classList.toggle('on', st.mag);
      zoom.out.textContent = fr(fl, fl < 10 ? 1 : 0) + ' mm';
      point.out.textContent = distLabel(dF());
      iris.out.textContent = 'f/' + fr(n) + (n > nSet() + 0.01 ? ' (ramping)' : '');
      say.textContent = olivier();
      vf.draw({ f: fl, dF: dF(), delta: st.delta, N: n, nd: st.nd, mag: st.mag });
      if (ctx && ctx.lens) ctx.lens({ zoom: st.z, focus: Math.pow(st.s, 1 / 0.45), iris: n, ff: st.delta, nd: ND.findIndex((x) => x[1] === st.nd), focal: fl, dF: dF(), mag: st.mag });
    }
    const node = el('div', { class: 'cl-lab' },
      el('div', { class: 'cl-vf' }, vf.canvas),
      el('div', { class: 'cl-ctrls' }, zoom.row, point.row, iris.row, nd.row, ff.row, el('div', { class: 'cl-row cl-btns' }, lockBtn, magBtn, reset)),
      el('div', { class: 'cl-olivier' }, el('b', {}, 'Olivier'), say),
      list);
    up();
    return { node, dispose() {} };
  },
};
