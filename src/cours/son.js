// @ts-check
import { el } from '../util.js';
import { registerChapter } from './index.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le son » : la tranche d'entrée de la console (gain, alimentation fantôme 48 V,
// polarité, égaliseur, fader) puis les départs (N-1 des commentateurs, synchro labiale,
// embedding vers la transmission). Les manipulations calculent sur de vrais échantillons : un
// micro canon (foule et frappe de balle) écrêté à 0 dBFS, deux micros d'ambiance dont on inverse
// la polarité (corrélation, perte en mono), les compositions des N-1 et le décalage son/image.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', tally: '#f0372c', pvw: '#33c46c' };
// more.fill : la couleur du texte, passée en style (la classe du schéma imposerait sinon la sienne)
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
const dB = (v) => 20 * Math.log10(Math.max(1e-9, v));
const fmtDb = (v, d = 1) => (v <= -99 ? '−∞' : (v > 0.04 ? '+' : '') + fmtNum(v, d).replace('-', '−')) + ' dB';
/** générateur pseudo-aléatoire reproductible (les mêmes signaux à chaque ouverture) */
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// ======================================================================================
// 1. La tranche : gain, 48 V, polarité, fader
// ======================================================================================
const FS = 8000, NS = 4800; // 0,6 s d'un micro canon, échantillonné pour l'affichage
const MIC0 = -52; // crête de la frappe à la sortie du micro, en dBFS si le gain était de 0 dB (ordre de grandeur)
// le micro canon du bord terrain : la foule, puis une frappe de balle à 0,2 s ; crête normalisée à 1
function canonSignal() {
  const r = rng(7), x = new Float32Array(NS);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < NS; i++) { lp += ((r() * 2 - 1) - lp) * 0.3; lp2 += (lp - lp2) * 0.5; x[i] = lp2 * 0.32; }
  for (let i = 0; i < NS; i++) { const t = i / FS - 0.2; if (t >= 0) x[i] += Math.exp(-t / 0.04) * Math.sin(2 * Math.PI * 140 * t) * 0.9 + Math.exp(-t / 0.004) * (r() * 2 - 1) * 0.35; }
  let m = 0; for (const v of x) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < NS; i++) x[i] /= m;
  return x;
}
// deux micros d'ambiance : une part commune (la foule vue des deux micros) et une part propre à chacun
const FS2 = 8000, N2 = 2048;
function ambSignals() {
  const r = rng(11), c = new Float32Array(N2), n1 = new Float32Array(N2), n2 = new Float32Array(N2);
  let a = 0, b = 0, d = 0;
  for (let i = 0; i < N2; i++) {
    const t = i / FS2;
    a += ((r() * 2 - 1) - a) * 0.2; b += ((r() * 2 - 1) - b) * 0.2; d += ((r() * 2 - 1) - d) * 0.2;
    c[i] = 0.6 * Math.sin(2 * Math.PI * 180 * t) + 0.45 * Math.sin(2 * Math.PI * 410 * t + 1) + 0.3 * Math.sin(2 * Math.PI * 760 * t + 2) + a * 1.4;
    n1[i] = b * 2 + 0.3 * Math.sin(2 * Math.PI * 530 * t); n2[i] = d * 2 + 0.3 * Math.sin(2 * Math.PI * 290 * t + 0.5);
  }
  const norm = (x) => { let s = 0; for (const v of x) s += v * v; const k = 1 / Math.sqrt(s / x.length); for (let i = 0; i < x.length; i++) x[i] *= k; };
  norm(c); norm(n1); norm(n2);
  return { c, n1, n2 };
}
function demoStrip(host) {
  const src = canonSignal(), amb = ambSignals();
  const wv = canvas(720, 290, 'co-canvas co-smooth'), ph = canvas(720, 170, 'co-canvas co-smooth');
  const gw = wv.getContext('2d'), gp = ph.getContext('2d');
  let gain = 40, p48 = true, fader = 0, inv = false, share = 90;
  const read = readout(['Crête d\'entrée', 'Marge avant 0 dBFS', 'Échantillons écrêtés', 'Bruit du préampli (ordre de grandeur)', 'Crête après le fader']);
  const read2 = readout(['Corrélateur (−1 à +1)', 'Mono (G + D) ÷ 2, par rapport à une voie', 'À l\'écoute en mono']);
  const verdict = el('p', { class: 'co-verdict' });
  // deux bandes : l'entrée (après le gain) en haut, la sortie du fader en bas, à la même échelle
  const W0 = 600, H = 290, FULL = 1.3, LANES = [{ mid: 80, half: 62 }, { mid: 222, half: 52 }];
  const Yl = (v, l) => LANES[l].mid - Math.max(-FULL, Math.min(FULL, v)) / FULL * LANES[l].half, Y = (v) => Yl(v, 0);
  const drawStrip = () => {
    const k = p48 ? Math.pow(10, (MIC0 + gain) / 20) : 0, f = Math.pow(10, fader / 20);
    let peakIn = 0, clipped = 0;
    gw.fillStyle = '#0b1013'; gw.fillRect(0, 0, 720, H);
    // repères : 0 dBFS (l'écrêtage) et −18 dBFS (le niveau d'alignement)
    for (const l of [0, 1]) {
      for (const [v, col, lab] of [[1, C.tally, '0 dBFS'], [-1, C.tally, ''], [0.126, '#5a646c', '−18 dBFS'], [-0.126, '#5a646c', '']]) {
        const y = Yl(/** @type {number} */ (v), l);
        gw.strokeStyle = /** @type {string} */ (col); gw.setLineDash([4, 4]); gw.beginPath(); gw.moveTo(0, y); gw.lineTo(W0, y); gw.stroke(); gw.setLineDash([]);
        if (lab && l === 0) { gw.fillStyle = /** @type {string} */ (col); gw.font = '11px Arial, sans-serif'; gw.fillText(/** @type {string} */ (lab), W0 - 60, y - 4); }
      }
    }
    gw.fillStyle = '#aab4ba'; gw.font = '11px Arial, sans-serif';
    gw.fillText('entrée, après le gain (ambre ; rouge : écrêtée)', 6, 12); gw.fillText(`après le fader (${fader > 0 ? '+' : fader < 0 ? '−' : ''}${Math.abs(fader)} dB)`, 6, 162);
    const per = NS / W0;
    for (let x = 0; x < W0; x++) {
      let lo = 9, hi = -9, rlo = 9, rhi = -9, cl = false;
      for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i++) {
        const raw = src[i] * k + (rng(i + 1)() * 2 - 1) * Math.pow(10, (-145 + gain) / 20); // le signal amplifié et le souffle du préampli
        const c = Math.max(-1, Math.min(1, raw)); if (c !== raw) { clipped++; cl = true; }
        peakIn = Math.max(peakIn, Math.abs(c)); rlo = Math.min(rlo, raw); rhi = Math.max(rhi, raw); lo = Math.min(lo, c); hi = Math.max(hi, c);
      }
      if (rhi > 1 || rlo < -1) { gw.fillStyle = 'rgba(240,55,44,0.25)'; gw.fillRect(x, Y(rhi), 1, Y(rlo) - Y(rhi)); } // ce que le micro aurait donné, au-delà de 0 dBFS : perdu
      gw.fillStyle = cl ? C.tally : C.amber; gw.fillRect(x, Y(hi), 1, Math.max(1, Y(lo) - Y(hi)));
      gw.fillStyle = cl ? C.red : C.cyan; gw.fillRect(x, Yl(hi * f, 1), 1, Math.max(1, Yl(lo * f, 1) - Yl(hi * f, 1)));
    }
    // le crête-mètre : −60 à 0 dBFS, OVL au-dessus
    const MX = 640, MW = 30, M0 = 30, M1 = H - 12, my = (d) => M1 - (Math.max(-60, Math.min(0, d)) + 60) / 60 * (M1 - M0);
    for (let d = -60; d < 0; d += 1) { gw.fillStyle = d < -18 ? '#1f4a2c' : d < -6 ? '#4a4320' : '#4a2420'; gw.fillRect(MX, my(d + 1), MW, my(d) - my(d + 1) - 0.5); }
    const pk = p48 ? dB(peakIn) : -99;
    for (let d = -60; d < Math.min(0, pk); d += 1) { gw.fillStyle = d < -18 ? C.pvw : d < -6 ? '#e6c33a' : C.tally; gw.fillRect(MX, my(d + 1), MW, my(d) - my(d + 1) - 0.5); }
    gw.fillStyle = clipped ? C.tally : '#3a2020'; gw.fillRect(MX, 8, MW, 16); gw.fillStyle = '#fff'; gw.font = 'bold 10px Arial, sans-serif'; gw.fillText('OVL', MX + 5, 20);
    gw.strokeStyle = '#e8eef2'; gw.beginPath(); gw.moveTo(MX + MW + 4, my(-18)); gw.lineTo(MX + MW + 8, my(-18)); gw.lineTo(MX + MW + 8, my(-10)); gw.lineTo(MX + MW + 4, my(-10)); gw.stroke();
    gw.fillStyle = '#aab4ba'; gw.font = '10px Arial, sans-serif';
    for (const d of [0, -10, -18, -30, -60]) gw.fillText(String(d).replace('-', '−'), MX - 26, my(d) + 4);
    const would = MIC0 + gain;
    read.set('Crête d\'entrée', !p48 ? 'aucune : micro statique sans 48 V, il ne délivre rien' : `${fmtDb(Math.min(0, pk))}FS, soit ${fmtNum(Math.pow(10, Math.min(0, pk) / 20) * 100)} % de la pleine échelle${would > 0 ? ` (le micro en demandait ${fmtDb(would)}FS)` : ''}`);
    read.set('Marge avant 0 dBFS', !p48 ? '—' : would >= 0 ? 'aucune : le convertisseur est saturé' : `${fmtNum(-would, 1)} dB`);
    read.set('Échantillons écrêtés', clipped ? `${fmtNum(clipped)} sur ${fmtNum(NS)} (${fmtNum(clipped / FS * 1000, 1)} ms de son déformé)` : 'aucun');
    read.set('Bruit du préampli (ordre de grandeur)', `−${fmtNum(145 - gain)} dBFS${p48 ? '' : ' : on n\'entend plus que lui'}`);
    read.set('Crête après le fader', !p48 ? '—' : `${fmtDb(Math.min(0, pk) + fader)}FS${clipped ? ' : plus bas, mais toujours écrêté' : ''}`);
    const v = !p48 ? ['ko', 'Muet : un micro statique (à condensateur) a besoin de l\'alimentation fantôme 48 V.'] : would >= 0 ? ['ko', `Écrêté : baissez le GAIN d'au moins ${fmtNum(would + 10, 0)} dB. Le fader n'y peut rien, la forme d'onde est déjà coupée.`] : would > -10 ? ['warn', 'Crêtes au-dessus de −10 dBFS : trop peu de marge pour un tir plus fort ou un cri du public.'] : would < -24 ? ['warn', 'Trop bas : le signal se rapproche du souffle ; montez le gain vers des crêtes de −18 à −10 dBFS.'] : ['ok', 'Bien réglé : crêtes entre −18 et −10 dBFS environ, de la marge avant 0 dBFS.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  const drawPhase = () => {
    const a = share / 100, b = Math.sqrt(Math.max(0, 1 - a * a)), s = inv ? -1 : 1;
    const L = new Float32Array(N2), R = new Float32Array(N2), Mo = new Float32Array(N2);
    let sl = 0, sr = 0, slr = 0, sm = 0;
    for (let i = 0; i < N2; i++) { L[i] = a * amb.c[i] + b * amb.n1[i]; R[i] = s * (a * amb.c[i] + b * amb.n2[i]); Mo[i] = (L[i] + R[i]) / 2; sl += L[i] * L[i]; sr += R[i] * R[i]; slr += L[i] * R[i]; sm += Mo[i] * Mo[i]; }
    const r = slr / Math.sqrt(sl * sr), mono = dB(Math.sqrt(sm / sl));
    gp.fillStyle = '#0b1013'; gp.fillRect(0, 0, 720, 170);
    const n = 320, X = (i) => 10 + i / n * 580, tr = (arr, y0, amp, col) => { gp.strokeStyle = col; gp.lineWidth = 1.4; gp.beginPath(); for (let i = 0; i < n; i++) gp[i ? 'lineTo' : 'moveTo'](X(i), y0 - arr[i] * amp); gp.stroke(); };
    gp.font = '11px Arial, sans-serif'; gp.fillStyle = '#aab4ba'; gp.fillText('micro gauche (ambre) et micro droit (cyan), 40 ms', 10, 14); gp.fillText('somme mono (G + D) ÷ 2', 10, 104);
    tr(L, 56, 14, C.amber); tr(R, 56, 14, C.cyan); tr(Mo, 136, 14, '#e8eef2');
    // le corrélateur : une barre de −1 à +1
    const cx = 610, cw = 100, cy = 70;
    gp.fillStyle = '#1a2026'; gp.fillRect(cx, cy, cw, 16); gp.fillStyle = '#aab4ba'; gp.fillText('−1', cx - 2, cy + 32); gp.fillText('0', cx + cw / 2 - 3, cy + 32); gp.fillText('+1', cx + cw - 12, cy + 32); gp.fillText('corrélateur', cx + 18, cy - 8);
    gp.fillStyle = r >= 0 ? C.pvw : C.tally; const xm = cx + (r + 1) / 2 * cw; gp.fillRect(Math.min(xm, cx + cw / 2), cy, Math.abs(xm - (cx + cw / 2)), 16);
    gp.fillStyle = '#fff'; gp.fillRect(xm - 1, cy - 3, 2, 22);
    read2.set('Corrélateur (−1 à +1)', `${fmtNum(r, 2).replace('-', '−')} : ${r > 0.3 ? 'les deux voies vont dans le même sens' : r < -0.3 ? 'opposition de phase' : 'voies presque indépendantes'}`);
    read2.set('Mono (G + D) ÷ 2, par rapport à une voie', fmtDb(mono));
    read2.set('À l\'écoute en mono', inv ? (mono < -30 ? 'la part commune s\'annule : l\'ambiance disparaît presque' : `l'ambiance se creuse : ${fmtNum(-mono, 1)} dB perdus, il ne reste que ce qui diffère entre les micros`) : 'l\'ambiance garde son corps');
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Gain d\'entrée', 0, 66, gain, 1, (v) => { gain = v; drawStrip(); }, (v) => '+' + v + ' dB'),
      choice('Alimentation 48 V', [['on', 'allumée'], ['off', 'éteinte']], 'on', (v) => { p48 = v === 'on'; drawStrip(); }),
      slider('Fader', -40, 10, fader, 1, (v) => { fader = v; drawStrip(); }, (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' dB')),
    el('figure', { class: 'co-figc' }, wv, el('figcaption', {}, 'Micro canon du bord terrain : la foule, puis une frappe de balle. À droite, le crête-mètre d\'entrée ; l\'accolade marque les crêtes visées (−18 à −10 dBFS).')),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      choice('Polarité du micro droit', [['n', 'normale'], ['i', 'inversée (Ø)']], 'n', (v) => { inv = v === 'i'; drawPhase(); }),
      slider('Part commune aux deux micros', 50, 100, share, 1, (v) => { share = v; drawPhase(); }, (v) => v + ' %')),
    el('figure', { class: 'co-figc' }, ph, el('figcaption', {}, 'Un couple d\'ambiance en tribune : à 100 %, les deux micros captent exactement la même chose (couple coïncident XY)')),
    read2.el);
  drawStrip(); drawPhase();
}
function figStrip() {
  const f = figure(720, 236, 'Le trajet du son dans une tranche de console : entrée, gain et 48 V, polarité, passe-haut, égaliseur, dynamique, retard, panoramique, fader, puis les bus PGM, INTL et N-1. En dessous, l\'échelle numérique : 0 dBFS est le maximum, le niveau d\'alignement est à −18 dBFS, les crêtes visées entre −18 et −10 dBFS.');
  f.append(txt(10, 16, 'Une tranche, de l\'entrée au bus', 'co-t', 'start'));
  const row1 = [['Entrée', 'micro, ligne, MADI'], ['GAIN + 48 V', 'préampli'], ['Ø', 'polarité'], ['Passe-haut', '80 à 150 Hz'], ['Égaliseur', '4 bandes']];
  const row2 = [['Dynamique', 'gate, compresseur'], ['Retard', 'synchro labiale'], ['Pan', 'gauche / droite'], ['Fader', 'niveau dans le mix'], ['Bus', 'PGM · INTL · N-1']];
  const draw = (row, y, hl) => row.forEach(([a, b], i) => {
    const x = 10 + i * 144; f.append(box(x, y, 120, 40, hl.includes(i) ? C.amber : C.grey), txt(x + 60, y + 17, a, 'co-t'), txt(x + 60, y + 32, b, 'co-s'));
    if (i < row.length - 1) f.append(arrow(x + 122, y + 20, x + 142, y + 20));
  });
  draw(row1, 26, [1, 2]); draw(row2, 92, [3]);
  f.append(sv('path', { d: 'M682 66 V78 H70 V90', fill: 'none', stroke: C.grey, strokeWidth: 1.4 }));
  // l'échelle dBFS
  const X = (d) => 60 + (d + 60) / 66 * 600, Y = 176;
  f.append(txt(10, Y - 22, 'L\'échelle numérique (dBFS : décibels sous le maximum)', 'co-t', 'start'));
  f.append(sv('rect', { x: X(-60), y: Y, width: X(-18) - X(-60), height: 12, fill: C.pvw, opacity: 0.5 }), sv('rect', { x: X(-18), y: Y, width: X(-10) - X(-18), height: 12, fill: C.amber, opacity: 0.8 }), sv('rect', { x: X(-10), y: Y, width: X(0) - X(-10), height: 12, fill: '#e6c33a', opacity: 0.45 }), sv('rect', { x: X(0), y: Y, width: X(6) - X(0), height: 12, fill: C.tally, opacity: 0.8 }));
  for (const d of [-60, -40, -18, -10, 0]) f.append(sv('line', { x1: X(d), y1: Y - 4, x2: X(d), y2: Y + 16, stroke: '#e8eef2' }), txt(X(d), Y + 28, d ? '−' + -d : '0 dBFS', 'co-m'));
  f.append(txt((X(-18) + X(-10)) / 2, Y - 6, 'crêtes visées', 'co-s'), txt(X(-18), Y + 42, 'alignement : 1 kHz à −18 dBFS = 0 dBu (EBU R68)', 'co-s'), txt(X(3), Y - 6, 'écrêtage', 'co-s', 'middle', { fill: C.red }));
  return f;
}

// ======================================================================================
// 2. N-1, synchro labiale, départs
// ======================================================================================
const SRC = [
  { id: 'comm1', name: 'COMM 1', voice: 'comm' }, { id: 'comm2', name: 'COMM 2', voice: 'comm' },
  { id: 'amb', name: 'AMBIANCES', voice: '' }, { id: 'canons', name: 'CANONS', voice: '' },
  { id: 'studio', name: 'STUDIO', voice: 'studio' }, { id: 'bt', name: 'BORD TERRAIN', voice: 'bt' },
];
const DEP = [
  { id: 'pgm', name: 'PGM', listener: '', who: '' },
  { id: 'intl', name: 'INTL', listener: '', who: '' },
  { id: 'n1', name: 'N-1 COMM', listener: 'comm', who: 'les commentateurs' },
  { id: 'nxs', name: 'N-1 STUDIO', listener: 'studio', who: 'le présentateur en studio' },
  { id: 'nxb', name: 'N-1 BT', listener: 'bt', who: 'la journaliste bord terrain' },
];
/** la règle : PGM = tout ; INTL = ambiances et effets ; chaque N-1 = le programme moins la voix de celui qui l'écoute */
const ruleOf = (s, d) => (d.id === 'pgm' ? true : d.id === 'intl' ? !s.voice : s.voice !== d.listener);
function demoN1(host) {
  /** @type {Record<string, boolean>} */ const M = {};
  const reset = () => { for (const s of SRC) for (const d of DEP) M[s.id + '|' + d.id] = ruleOf(s, d); };
  reset(); M['comm2|n1'] = true; // la panne de départ : le consultant dans son propre retour
  let fps = 50, vDelay = 3, aDelay = 0;
  const tbl = el('table', { class: 'co-table co-mx', 'aria-label': 'Matrice des départs : une ligne par source, une colonne par départ' });
  const read = readout(DEP.map((d) => d.name));
  const read2 = readout(['Décalage son / image', 'EBU R37 (de bout en bout)', 'Perception (ITU-R BT.1359)', 'Correction']);
  const verdict = el('p', { class: 'co-verdict' });
  const lip = canvas(720, 150, 'co-canvas co-smooth'), gl = lip.getContext('2d');
  const ms = () => 1000 / fps;
  const drawMatrix = () => {
    tbl.replaceChildren(el('tr', {}, el('th', {}, 'Source'), ...DEP.map((d) => el('th', {}, d.name))),
      ...SRC.map((s) => el('tr', {}, el('td', {}, s.name), ...DEP.map((d) => {
        const k = s.id + '|' + d.id, on = M[k], bad = on !== ruleOf(s, d);
        return el('td', {}, el('button', { type: 'button', class: 'co-mxb' + (on ? ' on' : '') + (bad ? ' bad' : ''), 'aria-pressed': String(on), 'aria-label': `${s.name} vers ${d.name}`, onclick: () => { M[k] = !M[k]; drawMatrix(); } }, on ? '●' : ''));
      }))));
    const echoMs = aDelay * ms();
    for (const d of DEP) {
      const inn = SRC.filter((s) => M[s.id + '|' + d.id]), out = SRC.filter((s) => !M[s.id + '|' + d.id]);
      const comp = inn.length ? inn.map((s) => s.name).join(' + ') : 'rien';
      let v;
      if (d.listener) {
        const own = inn.filter((s) => s.voice === d.listener);
        v = own.length ? `ÉCHO : ${d.who} entendent ${own.map((s) => s.name).join(' et ')} revenir${d.listener === 'comm' ? (echoMs ? ` avec le retard du son du car (${fmtNum(echoMs)} ms)` : ' : au moindre retard du son, écho') : ' après l\'aller-retour de la liaison'}` : `programme moins ${out.filter((s) => s.voice === d.listener).map((s) => s.name).join(' et ') || 'rien'} : correct`;
        if (!own.length && out.some((s) => !s.voice)) v = `il manque ${out.filter((s) => !s.voice).map((s) => s.name).join(', ')}`;
      } else if (d.id === 'intl') v = inn.some((s) => s.voice) ? 'inutilisable : des voix dans le son international' : out.length > 4 ? 'incomplet' : 'ambiances et effets, sans voix : correct';
      else v = out.length ? `il manque ${out.map((s) => s.name).join(', ')}` : 'le mélange complet';
      read.set(d.name, `= ${comp} · ${v}`);
    }
  };
  const drawLip = () => {
    const off = (aDelay - vDelay) * ms(); // positif : le son arrive après l'image
    gl.fillStyle = '#0b1013'; gl.fillRect(0, 0, 720, 150);
    const N = 16, cw = 40, x0 = 70, flash = 3;
    gl.font = '11px Arial, sans-serif'; gl.fillStyle = '#aab4ba'; gl.fillText('image', 8, 26); gl.fillText('son', 8, 62);
    for (let i = 0; i < N; i++) { const on = i === flash + vDelay; gl.fillStyle = on ? '#f4f4f0' : '#1a2026'; gl.fillRect(x0 + i * cw + 1, 10, cw - 2, 26); if (on) { gl.fillStyle = '#0b1013'; gl.fillText('flash', x0 + i * cw + 6, 27); } }
    gl.strokeStyle = '#3a444c'; gl.beginPath(); gl.moveTo(x0, 56); gl.lineTo(x0 + N * cw, 56); gl.stroke();
    const bx = x0 + (flash + aDelay) * cw; gl.fillStyle = C.amber; gl.fillRect(bx + 1, 44, cw - 2, 24); gl.fillStyle = '#0b1013'; gl.fillText('bip', bx + 10, 61);
    gl.fillStyle = '#aab4ba'; gl.fillText(`une case = une image = ${fmtNum(ms())} ms`, x0, 84);
    // l'échelle des seuils, de −200 à +200 ms
    const X = (m) => 70 + (Math.max(-200, Math.min(200, m)) + 200) / 400 * 640, y = 104;
    gl.fillStyle = 'rgba(240,55,44,0.35)'; gl.fillRect(X(-200), y, X(200) - X(-200), 14);
    gl.fillStyle = 'rgba(255,211,138,0.45)'; gl.fillRect(X(-90), y, X(185) - X(-90), 14);
    gl.fillStyle = 'rgba(255,211,138,0.85)'; gl.fillRect(X(-45), y, X(125) - X(-45), 14);
    gl.fillStyle = C.pvw; gl.fillRect(X(-40), y + 4, X(60) - X(-40), 6);
    gl.fillStyle = '#fff'; gl.fillRect(X(off) - 1.5, y - 6, 3, 26);
    gl.fillStyle = '#aab4ba'; for (const m of [-200, -100, 0, 100, 200]) gl.fillText(`${m > 0 ? '+' : m < 0 ? '−' : ''}${Math.abs(m)} ms`, Math.min(X(m) - 16, 664), y + 32);
    gl.fillText('son en avance', 70, 98); gl.fillText('son en retard', 640, 98);
    const r37 = off >= -40 && off <= 60, det = off >= -45 && off <= 125, acc = off >= -90 && off <= 185;
    read2.set('Décalage son / image', off === 0 ? '0 ms : synchrones' : `${fmtNum(Math.abs(off))} ms, son en ${off > 0 ? 'retard' : 'avance'} (${fmtNum(Math.abs(aDelay - vDelay))} image${Math.abs(aDelay - vDelay) > 1 ? 's' : ''})`);
    read2.set('EBU R37 (de bout en bout)', r37 ? 'dans la tolérance (−40 à +60 ms)' : 'hors tolérance (−40 à +60 ms)');
    read2.set('Perception (ITU-R BT.1359)', det ? 'sous le seuil où l\'on remarque le décalage' : acc ? 'décalage remarqué par une partie du public' : 'décalage gênant, au-delà du seuil d\'acceptabilité');
    read2.set('Correction', off === 0 ? 'aucune' : off < 0 ? `retarder le son de ${fmtNum(vDelay - aDelay)} image${vDelay - aDelay > 1 ? 's' : ''} (${fmtNum(-off)} ms)` : `retirer ${fmtNum(aDelay - vDelay)} image${aDelay - vDelay > 1 ? 's' : ''} de retard au son`);
    verdict.className = 'co-verdict ' + (off === 0 ? 'ok' : r37 ? 'warn' : 'ko');
    verdict.textContent = off === 0 ? 'Le son est retardé exactement comme l\'image : les lèvres et la voix coïncident. Dans le car, on vise 0 ms.' : r37 ? 'Dans la tolérance de bout en bout, mais le car n\'est qu\'une étape de la chaîne : on vise 0 ms.' : 'Hors tolérance : les lèvres et la voix ne coïncident plus.';
    drawMatrix(); // le retard du son change l'écho entendu par les commentateurs
  };
  const sl = (label, v0, on) => slider(label, 0, 12, v0, 1, on, (v) => `${v} image${v > 1 ? 's' : ''}`);
  host.append(
    el('div', { class: 'co-ctl' },
      el('button', { class: 'btn small', type: 'button', onclick: () => { reset(); drawMatrix(); } }, 'Appliquer la règle du N-1'),
      el('button', { class: 'btn small', type: 'button', onclick: () => { reset(); M['comm2|n1'] = true; drawMatrix(); } }, 'Panne : COMM 2 dans son retour')),
    el('div', { class: 'co-scroll' }, tbl),
    read.el,
    el('div', { class: 'co-ctl' },
      choice('Format', [['50', '1080p50', '20 ms par image'], ['25', '1080i50', '40 ms par image']], '50', (v) => { fps = +v; drawLip(); }),
      sl('Retard de l\'image (traitements)', vDelay, (v) => { vDelay = v; drawLip(); }),
      sl('Retard du son (retard de ligne)', aDelay, (v) => { aDelay = v; drawLip(); })),
    el('figure', { class: 'co-figc' }, lip, el('figcaption', {}, 'Le test du flash et du bip : en haut l\'image, en bas le son ; dessous, les seuils (vert : EBU R37 ; ambre clair : décalage non remarqué ; ambre foncé : remarqué mais acceptable ; rouge : gênant)')),
    verdict, read2.el);
  drawLip();
}
function figN1() {
  const f = figure(720, 244, 'Les départs de la console : le programme (PGM) et le son international (INTL) partent embeddés vers la chaîne ; chaque N-1 renvoie le programme moins la voix de celui qui l\'écoute. Sur le chemin de l\'image, les traitements ajoutent du retard : on retarde le son d\'autant.');
  f.append(txt(10, 16, 'Les départs : chacun reçoit le programme moins sa propre voix', 'co-t', 'start'));
  f.append(box(10, 30, 130, 50), txt(75, 50, 'Cabine', 'co-t'), txt(75, 68, 'COMM 1 · COMM 2', 'co-m'));
  f.append(box(10, 92, 130, 34), txt(75, 114, 'Ambiances, canons', 'co-s'));
  f.append(arrow(142, 55, 230, 75), arrow(142, 109, 230, 92));
  f.append(box(234, 50, 140, 64, C.amber), txt(304, 74, 'Console', 'co-t'), txt(304, 92, 'bus PGM, INTL, N-1', 'co-s'));
  f.append(arrow(376, 64, 440, 48), box(444, 28, 266, 40, C.cyan), txt(577, 44, 'Embedder du départ (plan de son)', 'co-s'), txt(577, 60, 'paire 1-2 : PGM · paire 3-4 : INTL', 'co-m'));
  f.append(arrow(376, 100, 440, 104), box(444, 84, 266, 40, C.green), txt(577, 100, 'N-1 COMM = PGM − COMM 1 − COMM 2', 'co-m'), txt(577, 116, 'retour casque des commentateurs', 'co-s'));
  f.append(sv('path', { d: 'M577 126 V140 H4 V55 H6', fill: 'none', stroke: C.green, strokeDasharray: '4 3' }), arrow(2, 55, 10, 55, C.green), txt(300, 136, 'le N-1 revient au casque des commentateurs, sans leurs voix', 'co-s', 'middle', { fill: C.green }));
  // la synchro labiale
  const Y = 188;
  f.append(txt(10, Y - 10, 'La synchro labiale : le son attend l\'image', 'co-t', 'start'));
  f.append(txt(10, Y + 14, 'image', 'co-s', 'start'), txt(10, Y + 40, 'son', 'co-s', 'start'));
  const seg = (x, w, y, label, col) => f.append(sv('rect', { x, y, width: w, height: 18, rx: 2, fill: col, opacity: 0.75 }), txt(x + w / 2, y + 13, label, 'co-s', 'middle', { fill: '#0b0e10' }));
  seg(60, 120, Y + 2, 'caméra, CCU', C.grey); seg(184, 110, Y + 2, 'synchro 1 image', C.amber); seg(298, 130, Y + 2, 'mélangeur, DSK', C.grey);
  seg(60, 120, Y + 28, 'micro, console', C.grey); seg(184, 244, Y + 28, 'retard de ligne : le même retard', C.cyan);
  f.append(sv('line', { x1: 432, y1: Y - 2, x2: 432, y2: Y + 50, stroke: '#fff', strokeDasharray: '3 3' }), txt(440, Y + 26, 'ils repartent ensemble, embeddés dans le même SDI', 'co-s', 'start'));
  return f;
}

registerChapter({
  id: 'son', title: 'Le son', icon: 'mixage',
  intro: 'La console son du car : la tranche, les retours des commentateurs, la synchro labiale.',
  lessons: [
    {
      id: 'son-tranche', title: 'La tranche : gain, 48 V, phase, égaliseur, fader', minutes: '8 min',
      essentials: [
        'Le **gain** adapte le micro à la console : crêtes entre −18 et −10 dBFS ; au-delà de **0 dBFS**, le signal est **écrêté**, et aucun fader ne le répare.',
        'Les micros **statiques** ont besoin de l\'**alimentation fantôme 48 V** ; une **polarité** inversée sur un couple creuse l\'ambiance, jusqu\'à l\'annuler en mono.',
        'Ensuite seulement : passe-haut, **égaliseur**, dynamique, puis le **fader**, qui dose la source dans le mélange.',
      ],
      figure: figStrip,
      demoTitle: 'Montez le gain jusqu\'à l\'OVL, puis baissez le fader : la forme d\'onde reste coupée. Éteignez le 48 V. Plus bas, inversez la polarité du micro droit et poussez la part commune à 100 %.',
      demo: demoStrip,
      body: `La console reçoit chaque source sur une **tranche** : une colonne de réglages traversée dans un ordre fixe (dans le simulateur : entrée, gain et 48 V, polarité, passe-haut, égaliseur, dynamique, retard, panoramique, fader, puis les bus). Le premier réglage est le plus important : le **gain d'entrée** (préamplificateur) adapte le niveau très faible d'un micro, quelques millivolts, à l'échelle de la console.

Cette échelle est numérique : le **dBFS** (décibels sous la pleine échelle) compte vers le bas à partir de **0 dBFS**, la plus grande valeur que le convertisseur sait écrire. Au-delà, il n'y a plus de nombre : les crêtes sont coupées à plat, c'est l'**écrêtage** (le voyant OVL), un son dur et définitivement abîmé. On règle donc le gain pour des crêtes entre **−18 et −10 dBFS** environ : le niveau d'alignement est à −18 dBFS (le 1 kHz de line-up, qui correspond à 0 dBu selon l'EBU R68), et les 18 dB au-dessus sont la **marge** (headroom) qui absorbe un tir plus fort ou un cri du public. Trop bas, le signal se rapproche du souffle du préampli. Le **fader** vient après : il ne fait que doser un signal déjà converti. Baisser le fader d'un micro écrêté donne un son écrêté moins fort.

L'**alimentation fantôme 48 V** (P48, IEC 61938) est envoyée par la console dans le câble micro lui-même, sur les deux conducteurs de modulation. Les micros **statiques** (à condensateur) en ont besoin : canons du bord terrain, couples d'ambiance. Sans elle, ils ne délivrent rien. Les micros **dynamiques** (souvent ceux des micros-casques des commentateurs) n'en ont pas besoin et ne sont pas gênés par elle, s'ils sont câblés en symétrique.

La touche **Ø** inverse la **polarité** d'une voie (on dit couramment « la phase ») : le signal change de signe. Sur un couple d'ambiance, si une voie est inversée par erreur (un câble mal soudé, un réglage oublié), la partie commune aux deux micros s'annule quand on les additionne en mono : l'ambiance se creuse et perd son corps, et avec un couple coïncident (XY), elle disparaît presque. Le **corrélateur** le montre : vers +1, les deux voies vont dans le même sens ; sous 0, il y a une opposition de phase.

Viennent ensuite les traitements : le **passe-haut** coupe le grondement inutile (80 à 150 Hz selon la source), l'**égaliseur** corrige le timbre (on creuse plutôt qu'on n'ajoute : 250 à 500 Hz pour éclaircir, 2 à 4 kHz pour la présence et l'impact du ballon), la **dynamique** resserre une voix ou coupe la foule entre deux phrases. Le **fader** dose enfin la source dans le mélange, et les envois la dirigent vers les bus.

- Ordre de réglage d'une tranche : gain, 48 V, polarité, en écoutant la source seule (PFL) ; puis passe-haut, égaliseur, dynamique ; le fader en dernier.
- Le niveau du programme se mesure ensuite en **loudness** (EBU R128 : −23 LUFS intégré, crêtes vraies sous −1 dBTP).`,
      car: { text: 'En cabine son, la console (inspirée de la Studer Vista 1) : la vue ENTRÉE donne pour chaque tranche le gain, la touche 48V et la touche Ø ; les crête-mètres d\'entrée allument l\'OVL rouge ; le corrélateur suit les couples d\'ambiance.', station: 'son' },
      terms: ['st2110-30'],
      competences: ['1.4', '2.9'],
      article: 'vista',
      exercises: [
        { id: 'son-tranche', intro: 'En cabine son, trois défauts vous attendent sur la console : un canon qui sature, une ambiance muette, une autre en opposition de phase. Vous les corrigerez dans la vue ENTRÉE des tranches, sans toucher aux faders : regardez l\'OVL s\'éteindre quand le gain baisse, l\'ambiance revenir avec le 48 V et le corrélateur remonter vers +1 quand la polarité est rétablie.' },
      ],
      quiz: [
        { q: 'Le crête-mètre d\'un canon allume l\'OVL. Que faire ?', choices: ['Baisser le gain d\'entrée de la tranche', 'Baisser le fader de la tranche', 'Couper l\'alimentation 48 V'], answer: 0, why: 'L\'OVL signale un écrêtage à l\'entrée : le convertisseur est saturé avant même le fader. Baisser le fader donnerait un son écrêté moins fort ; couper le 48 V rendrait le canon muet. Il faut viser des crêtes entre −18 et −10 dBFS avec le gain.' },
        { q: 'Sur un couple d\'ambiance XY, une voie a sa polarité inversée. En mono, l\'ambiance…', choices: ['s\'annule presque entièrement', 'monte de 6 dB', 'ne change pas : seule la stéréo est touchée'], answer: 0, why: 'Les deux micros d\'un couple coïncident captent presque la même chose : additionnés avec un signe opposé, ils s\'annulent. Le corrélateur passe sous zéro. Monter de 6 dB, c\'est ce que fait la somme de deux voies identiques en phase, sans division par deux.' },
        { q: 'Quel micro reste muet sans alimentation fantôme 48 V ?', choices: ['Un micro statique, comme les canons du bord terrain', 'Le micro dynamique d\'un micro-casque de commentateur', 'Tous les micros'], answer: 0, why: 'Le micro statique (à condensateur) a besoin d\'une tension pour polariser sa capsule et alimenter son électronique. Un micro dynamique produit son signal tout seul, par induction : il fonctionne avec ou sans 48 V.' },
      ],
    },
    {
      id: 'son-n1', title: 'N-1, synchro labiale et départs', minutes: '8 min',
      essentials: [
        'Chaque commentateur reçoit un **N-1** (mix-minus) : tout le programme **sauf sa propre voix**, qui lui reviendrait retardée, en écho.',
        'L\'image est retardée par les traitements (synchroniseur, conversions, liaison HF…) : on **retarde le son** d\'autant pour garder la **synchro labiale** (EBU R37 : de 40 ms d\'avance à 60 ms de retard, de bout en bout).',
        'Le son du départ est **embeddé** dans le SDI selon le **plan de son** de la chaîne : paire 1 programme, paire 2 international…',
      ],
      figure: figN1,
      demoTitle: 'Cliquez la case rouge de la matrice (COMM 2 dans le N-1 COMM), puis « Appliquer la règle du N-1 ». Plus bas, l\'image a 3 images de retard : retardez le son jusqu\'à ce que le bip tombe sous le flash, puis passez en 1080i50.',
      demo: demoN1,
      body: `Le son ne part pas qu'à l'antenne. La console fabrique plusieurs **départs** (des bus) : le **programme** (PGM, tout le mélange, commentaires compris), le **son international** (INTL : ambiances et effets, sans aucune voix, pour les diffuseurs étrangers qui y posent leurs commentaires), et des **retours** pour ceux qui parlent à l'antenne : commentateurs, présentateur en studio, journaliste bord terrain.

Chacun de ces retours est un **N-1** (mix-minus, « tout sauf moi ») : le programme **moins la voix de celui qui l'écoute**. Le commentateur entend le match, le studio et le bord terrain, mais pas lui-même : sa voix est déjà dans son casque par sa propre unité de commentaire. S'il la recevait aussi par le programme, elle lui reviendrait après le retard du son du car (retard de ligne, quelques dizaines à quelques centaines de millisecondes), ou après l'aller-retour de la liaison pour le studio : un écho qui empêche de parler, voire un larsen. Une seule case mal mise dans la matrice suffit, et elle ne s'entend pas en régie : il faut écouter chaque départ.

L'**image** traverse des équipements qui la retardent : synchroniseur d'images (une image), conversions de format, liaison HF de la caméra sans fil (plusieurs images selon le codage). Le **son**, lui, arrive presque tout de suite à la console. Pour que les lèvres et la voix coïncident (la **synchro labiale**), on **retarde le son** du même temps, avec le retard de ligne de la console, compté en images : une image vaut 20 ms en 1080p50, 40 ms en 1080i50. Repères : l'EBU R37 tolère, de bout en bout, un son en avance de 40 ms au plus et en retard de 60 ms au plus (et demande 5 ms d'avance, 15 ms de retard au plus à chaque étape : dans le car, on vise 0 ms). La recommandation ITU-R BT.1359 situe le décalage remarqué vers 45 ms d'avance et 125 ms de retard, et le décalage gênant au-delà de 90 ms d'avance et 185 ms de retard. Le son en avance se remarque plus vite : dans la nature, la lumière arrive toujours avant le son.

Le départ vers la chaîne est un signal SDI qui porte l'image et le son **embeddé** (inséré dans le signal, voir la leçon sur l'audio embarqué) : 16 canaux en HD-SDI, jusqu'à 32 en 3G-SDI, rangés par paires. La chaîne impose son **plan de son** : par exemple paire 1 (canaux 1-2) programme stéréo, paire 2 (canaux 3-4) son international, puis le 5.1 ou des sons séparés. Une paire inversée et la chaîne diffuse l'international sans commentaires : on vérifie chaque paire au départ, et le plan de son est testé avec la chaîne au test de ligne.

- Le **talkback** (micro d'ordres) de la régie part dans les N-1, jamais dans le programme.
- En production IP (ST 2110-30), chaque départ est un flux audio séparé de l'image, horodaté par le PTP : la synchro labiale reste une affaire de retards.`,
      car: { text: 'En cabine son, l\'onglet « Bus, N-1, départ » : la matrice des tranches vers PGM, INTL, N-1 COMM, N-1 STUDIO et N-1 BT, le panneau « Retard de ligne » et son afficheur de décalage, l\'embedder du départ avec le plan de son demandé par la chaîne. Le poste Transmission reçoit ce départ.', station: 'son' },
      terms: ['st2110-30', 'essence'],
      competences: ['1.4', '2.2', '2.11'],
      article: 'timing',
      exercises: [
        { id: 'son-departs', intro: 'En cabine son, onglet « Bus, N-1, départ », vous corrigerez trois départs : un consultant envoyé dans son propre retour, un son décalé de l\'image, deux paires inversées dans l\'embedder. Vérifiez à chaque fois ce que reçoit l\'autre bout : le N-1 sans la voix de celui qui l\'écoute, un décalage revenu dans la tolérance, la paire 1 sur le programme et la paire 2 sur l\'international.' },
      ],
      quiz: [
        { q: 'Que contient le N-1 COMM, le retour des commentateurs ?', choices: ['Le programme sans les voix des commentateurs', 'Uniquement les voix des commentateurs', 'Le programme complet'], answer: 0, why: 'Un N-1 est le programme moins la voix de celui qui l\'écoute : ambiances, canons, studio, bord terrain, mais pas leurs propres voix. Avec le programme complet, ils s\'entendraient revenir avec le retard du son du car, en écho.' },
        { q: 'En 1080p50, l\'image a 3 images de retard sur le son. De combien retarder le son ?', choices: ['60 ms', '3 ms', '120 ms'], answer: 0, why: 'Une image dure 20 ms à 50 images par seconde : 3 × 20 = 60 ms. 120 ms correspondrait à 3 images en 1080i50 (40 ms par image) ; 3 ms confond images et millisecondes.' },
        { q: 'De bout en bout, le son arrive 80 ms après les lèvres. Selon l\'EBU R37…', choices: ['c\'est hors tolérance : le retard maximal est de 60 ms', 'c\'est dans la tolérance : le seuil est à 125 ms', 'c\'est sans importance : seul un son en avance compte'], answer: 0, why: 'L\'EBU R37 tolère de 40 ms d\'avance à 60 ms de retard. 125 ms est le seuil où une partie du public remarque le décalage (ITU-R BT.1359), pas une tolérance de diffusion. Un son en retard se remarque moins vite qu\'un son en avance, mais il se remarque.' },
      ],
    },
  ],
});
