// @ts-check
import { el } from '../../util.js';
import { MIRE_D, ND, zoomPos, exposureOf, fr, castOf } from '../optics.js';
import { makeViewfinder, whiteLevels, drawScope, cnv, decode, encode } from '../vf.js';
import { slider, seg, toggle, btnRow, linkBtn, lensRings, lensState, shell, scopeCanvas, irisPos, pointPos } from '../controls.js';

// ----------------------------------------------------------------------------------
// Manipulations des chapitres 2 à 4 : les filtres ND, le prisme et ses trois capteurs, le
// capteur vu de près, la balance des noirs et des blancs. Les commandes portent les noms de la
// caméra (mode d'emploi HXC-FB80) : FILTER, WHITE BAL (B, A, PRST), COLOR TEMP. (5600K),
// OUTPUT (BARS, CAM), WHT/BLK, VF OUT. Les messages ABB/AWB sont ceux du mode d'emploi ; quand
// il ne donne pas le texte (échec), le message est écrit en français et le dit.
// ----------------------------------------------------------------------------------

const send = (ctx, s) => { if (ctx && ctx.lens) ctx.lens(s); };
const readout = () => el('p', { class: 'cl-read' });
const ok = (w) => w >= 80 && w < 99.6;

export const BLOC = {
  // =================================================================================
  /** les filtres ND : garder l'iris à f/5,6 du plateau au plein soleil */
  nd(ctx) {
    /** @type {[string, number, number][]} lieu, lumière, rapport à la lumière du plateau */
    const SCENES = [['Ciel couvert', 8, 16], ['Plein soleil', 32, 64], ['Retour au plateau', 0.5, 1]];
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, k: 0 };
    const defis = [false, false, false];
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
    const rings = lensRings(st, () => up(), ['iris']);
    const nd = seg('FILTER', ND.map(([nm, v]) => [v, nm.replace('ND', ' ND')]), st.nd, (v) => { st.nd = Number(v); up(); });
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [nd.row, ...rings.rows, read], defis: [
      'Dehors, ciel couvert : seize fois plus de lumière que sur le plateau. Garde l\'iris à f/5,6 et expose juste avec le filtre.',
      'Le soleil sort des nuages : encore quatre fois plus. Toujours f/5,6, toujours avec le filtre.',
      'Retour sur le plateau : expose juste à f/5,6.',
    ] });
    function olivier(N, w) {
      const [name, , ratio] = SCENES[st.k];
      if (defis[2]) return 'CLEAR sur le plateau : rentrer avec un ND oublié, c\'est une image sombre qu\'on rattrape en ouvrant l\'iris ou en montant le gain, et on perd la profondeur de champ voulue ou on ajoute du bruit.';
      if (N < 5 || N > 6.4) return 'Garde l\'iris vers f/5,6 : c\'est l\'ouverture choisie pour la profondeur de champ. Le filtre doit compenser.';
      if (w >= 99.6) return `${name} : l'image est écrêtée. Passe au filtre suivant : chaque cran retire deux diaphragmes.`;
      if (w < 80) return st.k === 2 && st.nd < 1 ? 'L\'image est sombre : le filtre est resté en place. Repasse sur CLEAR.' : 'Trop sombre : un filtre plus clair.';
      if (st.k === 0) return 'Exposé.';
      if (st.k === 1) return `1/64 : soixante-quatre fois moins de lumière, six diaphragmes. Le plein soleil en donne environ ${ratio} fois plus que le plateau.`;
      return 'Exposé.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const [, light] = SCENES[st.k];
      let E = exposureOf(o.N, st.nd) * light, w = whiteLevels(E)[1];
      const iris56 = o.N >= 5 && o.N <= 6.4;
      if (iris56 && ok(w) && !defis[st.k]) {
        defis[st.k] = true;
        if (st.k < 2) { st.k++; E = exposureOf(o.N, st.nd) * SCENES[st.k][1]; w = whiteLevels(E)[1]; }
      }
      const [name, light2, ratio] = SCENES[st.k];
      read.textContent = `${name} : ${ratio > 1 ? ratio + ' fois la lumière du plateau' : 'la lumière du plateau'} · filtre ${ND.find((x) => x[1] === st.nd)[0]} · blanc ${fr(w, 0)} %`;
      sh.done(defis); sh.say(olivier(o.N, w));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, nd: st.nd, light: light2 });
      send(ctx, lensState(st, o, { light: light2 }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(5.6), nd: 1, k: 0 }); nd.mark(1); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** le prisme : trois capteurs, trois couleurs ; couper un capteur ; recaler le rouge */
  prisme(ctx) {
    const st = { z: zoomPos(24), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, on: { R: true, G: true, B: true }, chan: 'COLOR', reg: [0, 0], mag: false };
    const defis = [false, false, false];
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img, 'parade'));
    const rings = lensRings(st, () => up(), []);
    const sens = ['R', 'G', 'B'].map((c) => toggle({ R: 'Capteur rouge', G: 'Capteur vert', B: 'Capteur bleu' }[c], true, (v) => { st.on[c] = v; up(); }));
    const out = seg('VF OUT', [['COLOR', 'COLOR'], ['R', 'R'], ['G', 'G'], ['B', 'B']], 'COLOR', (v) => { st.chan = v; up(); });
    const regH = slider('Rouge, horizontal', -6, 6, 0.1, 0, (v) => { st.reg[0] = v; up(); });
    const regV = slider('Rouge, vertical', -6, 6, 0.1, 0, (v) => { st.reg[1] = v; up(); });
    const mag = toggle('Loupe MAG ×3', false, (v) => { st.mag = v; up(); });
    const regBox = el('div', { class: 'cl-ctrls', hidden: true }, regH.row, regV.row);
    const sh = shell({ vf, scope: sc, ctrls: [btnRow(...sens.map((s) => s.btn)), out.row, regBox, btnRow(mag.btn)], defis: [
      'Coupe le capteur vert : de quelle couleur devient le blanc de la mire ?',
      'Avec deux capteurs seulement, fais apparaître du jaune à la place du blanc.',
      'Le capteur rouge s\'est décalé de quelques pixels : recale-le jusqu\'à ce que les franges colorées disparaissent.',
    ] });
    const is = (r, g, b) => st.on.R === r && st.on.G === g && st.on.B === b;
    function olivier() {
      const off = Math.hypot(st.reg[0], st.reg[1]);
      if (defis[2]) return 'Les trois images se superposent au pixel près : c\'est ce que garantit le bloc prisme, collé en usine. Une frange colorée qui reste vient alors de l\'objectif (aberration chromatique), pas du prisme.';
      if (defis[1]) return off > 0.5 ? `Le rouge est décalé de ${fr(off, 1)} pixel : un liseré rouge d'un côté de chaque branche de l'étoile, cyan de l'autre. Décale-le jusqu'à ce que tout redevienne noir et blanc (la loupe aide).` : 'Recalé.';
      if (defis[0]) return is(true, true, false) ? 'Rouge et vert sans bleu : jaune.' : 'Rallume le vert, coupe le bleu.';
      if (is(true, false, true)) return 'Magenta : rouge et bleu, sans le vert. Le blanc, c\'est les trois capteurs ensemble.';
      if (st.chan !== 'COLOR') return `VF OUT ${st.chan} : le viseur ne montre que ce capteur, en noir et blanc. La pastille de sa couleur paraît claire, les autres sombres.`;
      return 'Le prisme envoie le bleu, le rouge et le vert chacun sur son capteur. Coupe le capteur vert pour voir ce qu\'il apportait.';
    }
    function up() {
      const o = rings.read();
      if (!defis[0] && is(true, false, true)) defis[0] = true;
      if (defis[0] && !defis[1] && is(true, true, false)) {
        defis[1] = true; st.on = { R: true, G: true, B: true }; sens.forEach((s) => s.set(true));
        st.reg = [3.6, -1.8]; regH.set(st.reg[0]); regV.set(st.reg[1]); regBox.hidden = false;
      }
      if (defis[1] && !defis[2] && Math.hypot(st.reg[0], st.reg[1]) <= 0.5 && is(true, true, true)) defis[2] = true;
      regH.out.textContent = fr(st.reg[0], 1) + ' px'; regV.out.textContent = fr(st.reg[1], 1) + ' px';
      sh.done(defis); sh.say(olivier());
      const wb = /** @type {[number, number, number]} */ ([st.on.R ? 1 : 0, st.on.G ? 1 : 0, st.on.B ? 1 : 0]);
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5, wb, chan: /** @type {any} */ (st.chan), reg: { R: [st.reg[0], st.reg[1]] }, mag: st.mag });
      send(ctx, lensState(st, o, { light: 0.5, wb, chan: st.chan }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { on: { R: true, G: true, B: true }, chan: 'COLOR', reg: [0, 0], mag: false }); sens.forEach((s) => s.set(true)); out.mark('COLOR'); mag.set(false); regBox.hidden = true; defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** le capteur vu au microscope : photosites, microlentilles, le puits qui se remplit, le bruit */
  capteur(ctx) {
    const FW = 20000; // capacité d'un photosite (électrons), ordre de grandeur pour un pixel de 5 µm
    const W = 640, H = 360, SW = 1920, SH = 1080;
    // l'image formée sur les trois capteurs, une fois pour toutes (1920 × 1080 photosites)
    const big = makeViewfinder(SW, SH); big.now({ f: 24, dF: MIRE_D, N: 5.6, light: 0.5, osd: false });
    const src = /** @type {ImageData} */ (big.image()); big.dispose();
    const view = cnv(W, H); view.className = 'cl-vfc'; view.setAttribute('aria-label', 'Le capteur vu au microscope');
    const st = { zl: 0, stops: -3, ch: 1 };
    const defis = [false, false, false];
    // le photosite mesuré : dans le blanc de la mire, au-dessus de l'étoile
    const PX = SW / 2 + 3, PY = Math.round(SH * 0.5 - SH * 0.39);
    const zoomOf = (zl) => Math.pow(300, zl);
    const zs = slider('Grossissement', 0, 1, 0.001, st.zl, (v) => { st.zl = v; up(); });
    const ls = slider('Lumière', -9, 1.5, 0.05, st.stops, (v) => { st.stops = v; up(); });
    const chs = seg('Capteur', [[0, 'Rouge'], [1, 'Vert'], [2, 'Bleu']], 1, (v) => { st.ch = Number(v); up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: view }, ctrls: [zs.row, ls.row, chs.row, read], defis: [
      'Grossis jusqu\'à voir les photosites et leurs microlentilles : un photosite par pixel de l\'image.',
      'Règle la lumière pour remplir le photosite du blanc presque à ras bord, sans qu\'il déborde.',
      'Mets très peu de lumière : le grain apparaît. Compare le signal et le bruit.',
    ] });
    let seed = 1; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const gauss = () => { const u = Math.max(1e-7, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    /** électrons collectés par un photosite de valeur v (0 à 255), avec le bruit de photons */
    const electrons = (v, E) => { const n = decode(v) / decode(236) * 0.85 * FW * E; return Math.max(0, n + gauss() * Math.sqrt(Math.max(n, 0))); };
    const toPix = (n) => Math.round(255 * encode(Math.min(1, n / FW / 0.85 * decode(236))));
    function draw() {
      const g = view.getContext('2d'); const Z = zoomOf(st.zl), E = Math.pow(2, st.stops);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H); seed = 7;
      const p = W / SW * Z; // taille d'un photosite à l'écran (pixels)
      const vw = W / p, vh = H / p, x0 = PX - vw / 2, y0 = PY - vh / 2;
      const d = src.data;
      if (p < 3) {
        // de loin : l'image du capteur, réduite
        const id = g.createImageData(W, H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const sx = Math.floor(x0 + x / p), sy = Math.floor(y0 + y / p);
          const o = (y * W + x) * 4;
          if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) { id.data[o + 3] = 255; continue; }
          const v = toPix(electrons(d[(sy * SW + sx) * 4 + st.ch], E));
          id.data[o] = id.data[o + 1] = id.data[o + 2] = v; id.data[o + 3] = 255;
        }
        g.putImageData(id, 0, 0);
      } else {
        for (let sy = Math.floor(y0); sy < y0 + vh + 1; sy++) for (let sx = Math.floor(x0); sx < x0 + vw + 1; sx++) {
          if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) continue;
          const X = (sx - x0) * p, Y = (sy - y0) * p, v = toPix(electrons(d[(sy * SW + sx) * 4 + st.ch], E));
          g.fillStyle = `rgb(${v},${v},${v})`;
          if (p < 14) { g.fillRect(X, Y, p - (p > 6 ? 1 : 0), p - (p > 6 ? 1 : 0)); continue; }
          // de près : la photodiode (carré clair), les pistes (gris), la microlentille (cercle)
          g.fillStyle = '#1a1c1f'; g.fillRect(X, Y, p, p);
          g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(X + p * 0.14, Y + p * 0.14, p * 0.72, p * 0.72);
          g.strokeStyle = 'rgba(170,200,230,0.45)'; g.lineWidth = Math.max(1, p * 0.03); g.beginPath(); g.arc(X + p / 2, Y + p / 2, p * 0.47, 0, Math.PI * 2); g.stroke();
          if (sx === PX && sy === PY) { g.strokeStyle = '#ffb020'; g.lineWidth = 2; g.strokeRect(X + 1, Y + 1, p - 2, p - 2); }
        }
      }
      // le puits du photosite mesuré
      seed = 99; const n = electrons(d[(PY * SW + PX) * 4 + st.ch], E), fill = Math.min(1, n / FW);
      const bx = W - 92, by = 40, bw = 60, bh = 200;
      g.fillStyle = 'rgba(5,7,10,0.82)'; g.fillRect(bx - 16, by - 30, bw + 32, bh + 86);
      g.strokeStyle = '#c9ced2'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by + bh); g.lineTo(bx + bw, by + bh); g.lineTo(bx + bw, by); g.stroke();
      g.fillStyle = fill >= 1 ? '#ff5a4f' : '#4cc3e6'; g.fillRect(bx + 2, by + bh - bh * fill, bw - 4, bh * fill - 1);
      g.font = '600 12px "B612 Mono", monospace'; g.fillStyle = '#e8e8e2'; g.textAlign = 'center';
      g.fillText('photosite', bx + bw / 2, by - 14);
      g.fillText(fill >= 1 ? 'plein' : Math.round(n).toLocaleString('fr-FR') + ' e⁻', bx + bw / 2, by + bh + 18);
      g.fillStyle = '#9aa3a8'; g.fillText('sur ' + FW.toLocaleString('fr-FR'), bx + bw / 2, by + bh + 34);
      if (p >= 3) { g.fillStyle = 'rgba(5,7,10,0.8)'; g.fillRect(10, H - 30, 250, 22); g.fillStyle = '#ffb020'; g.textAlign = 'left'; g.fillText('▢ le photosite mesuré', 18, H - 15); }
      return { n, fill, p };
    }
    function up() {
      const r = draw(); const Z = zoomOf(st.zl);
      if (!defis[0] && r.p >= 14) defis[0] = true;
      if (defis[0] && !defis[1] && r.fill >= 0.8 && r.fill < 1) defis[1] = true;
      if (defis[1] && !defis[2] && r.fill <= 0.03) defis[2] = true;
      zs.out.textContent = '×' + fr(Z, Z < 10 ? 1 : 0);
      ls.out.textContent = (st.stops >= 0 ? '+' : '−') + fr(Math.abs(st.stops), 1) + ' diaph.';
      const snr = Math.sqrt(Math.max(1, r.n));
      read.textContent = `Un photosite fait 5 µm de côté (9,59 mm ÷ 1920). Signal ${Math.round(r.n).toLocaleString('fr-FR')} électrons, bruit de photons ± ${Math.round(snr)} : rapport signal/bruit ${fr(snr, 0)} pour 1.`;
      sh.done(defis);
      sh.say(defis[2] ? `Avec ${Math.round(r.n)} électrons, le bruit (± ${Math.round(snr)}) n'est plus négligeable : c'est le grain des images sombres. Monter le gain amplifie le signal et ce bruit avec ; seule plus de lumière améliore le rapport.`
        : defis[1] ? 'Presque plein, sans déborder : le blanc garde ses détails. Maintenant, baisse beaucoup la lumière.'
          : r.fill >= 1 ? 'Le photosite déborde : au-delà, toutes les valeurs sont les mêmes, le blanc est écrêté et ses détails perdus. Baisse la lumière.'
            : defis[0] ? 'Augmente la lumière jusqu\'à ce que le puits du photosite marqué soit presque plein.'
              : 'Grossis : sous chaque microlentille, une photodiode convertit la lumière en électrons. Elle ne voit pas les couleurs : c\'est le prisme qui lui envoie une seule couleur.');
      send(ctx, { light: 0.5 * Math.pow(2, st.stops + 3) });
    }
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** la balance des noirs (ABB) puis des blancs (AWB), mémoires A et B, préréglage 3200/5600 K */
  balance(ctx) {
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, Tl: 3200, wbSw: 'PRST', ct: true, mem: { A: 5600, B: 5600 }, out: 'CAM', card: false, black: [0.004, 0, 0.006], abb: false, awbOk: false };
    const defis = [false, false, false];
    let busy = null, msg = '', msgT = 0, timer = 0;
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img, 'parade'));
    const rings = lensRings(st, () => up(), ['iris']);
    const wbSw = seg('WHITE BAL', [['B', 'B'], ['A', 'A'], ['PRST', 'PRST']], 'PRST', (v) => { st.wbSw = v; up(); });
    const outSw = seg('OUTPUT', [['BARS', 'BARS'], ['CAM', 'CAM']], 'CAM', (v) => { st.out = v; up(); });
    const ct = toggle('COLOR TEMP. 5600K', true, (v) => { st.ct = v; up(); });
    const wht = el('button', { type: 'button', class: 'btn small', onclick: () => run('AWB') }, 'WHT/BLK ▲ WHT');
    const blk = el('button', { type: 'button', class: 'btn small', onclick: () => run('ABB') }, 'WHT/BLK ▼ BLK');
    const card = toggle('Carton blanc devant la caméra', false, (v) => { st.card = v; up(); });
    const lights = seg('Éclairage', [[3200, 'Tungstène 3200 K'], [5600, 'Lumière du jour 5600 K']], 3200, (v) => { st.Tl = Number(v); up(); });
    lights.row.hidden = true;
    const sh = shell({ vf, scope: sc, ctrls: [wbSw.row, outSw.row, btnRow(ct.btn, card.btn), btnRow(blk, wht), ...rings.rows, lights.row], defis: [
      'Commence par la balance des noirs : WHT/BLK vers BLK.',
      'Sous les projecteurs tungstène, fais la balance des blancs en mémoire A : WHITE BAL sur A, le carton blanc au centre, WHT/BLK vers WHT.',
      'On ouvre les rideaux, la lumière du jour entre : refais une balance juste sans effacer la mémoire A.',
    ] });
    const Tcam = () => (st.wbSw === 'PRST' ? (st.ct ? 5600 : 3200) : st.mem[st.wbSw]);
    const cast = () => /** @type {[number, number, number]} */ (castOf(st.Tl, Tcam()));
    const E = () => exposureOf(rings.read().N) * 0.5;
    const say = (m, t = 3) => { msg = m; msgT = performance.now() + t * 1000; };
    function run(kind) {
      if (busy) { busy = null; say(kind === 'ABB' ? 'ABB : annulé' : 'AWB : annulé', 2); up(); return; } // une seconde pression annule (mode d'emploi)
      if (st.out !== 'CAM') { say('OUTPUT sur BARS : la balance se fait sur l\'image de la caméra, passe sur CAM'); up(); return; }
      if (kind === 'AWB') {
        if (st.wbSw === 'PRST') { say('WHITE BAL sur PRST : la balance auto s\'enregistre en mémoire A ou B'); up(); return; }
        const w = whiteLevels(E(), cast());
        if (!st.card) { say('AWB : échec (pas de blanc au centre)'); up(); return; }
        if (w[1] < 45) { say('AWB : échec (niveau trop bas, ouvre l\'iris)'); up(); return; }
        if (Math.max(...w) >= 99.6) { say('AWB : échec (blanc écrêté, ferme l\'iris)'); up(); return; }
      }
      busy = { kind, t: performance.now() + (kind === 'ABB' ? 1500 : 1200) };
      tick();
    }
    function tick() {
      clearTimeout(timer);
      const now = performance.now();
      if (busy && now >= busy.t) {
        if (busy.kind === 'ABB') { st.black = [0, 0, 0]; st.abb = true; say('ABB: OK'); }
        else { st.mem[/** @type {'A' | 'B'} */ (st.wbSw)] = st.Tl; st.awbOk = true; say('AWB: OK'); }
        busy = null;
      }
      up();
      if (busy || (msg && now < msgT)) timer = window.setTimeout(tick, 120);
      else if (msg) { msg = ''; up(); }
    }
    function olivier() {
      const c = cast(), neutral = Math.abs(c[0] - 1) < 0.03 && Math.abs(c[2] - 1) < 0.03;
      if (defis[2]) return st.wbSw === 'PRST' ? 'Le préréglage 5600K dépanne quand on n\'a pas le temps (mode d\'emploi : PRST et COLOR TEMP.). Une vraie balance sur un carton reste plus juste, parce qu\'aucune lumière n\'est exactement à 5600 K.' : 'La mémoire B garde la lumière du jour, la A le tungstène : on passe de l\'une à l\'autre d\'un geste quand l\'éclairage change.';
      if (defis[1]) {
        if (st.mem.A !== 3200) return 'La mémoire A a été écrasée par la lumière du jour. Repasse l\'éclairage en tungstène pour la refaire, ou utilise B.';
        return neutral ? 'Montre la mire.' : 'L\'image est bleue : la caméra est encore balancée pour le tungstène. Utilise la mémoire B (ou le préréglage 5600K).';
      }
      if (defis[0]) {
        if (st.wbSw === 'PRST') return st.ct ? 'L\'image est orange : la caméra attend la lumière du jour (5600K), le plateau est éclairé en tungstène (3200 K). Passe WHITE BAL sur A.' : 'Préréglage 3200 K : presque juste, mais une balance sur le carton le sera vraiment. Passe WHITE BAL sur A.';
        if (!st.card) return 'Présente le carton blanc : il doit remplir le centre de l\'image, sous la même lumière que le sujet.';
        return 'Appuie sur WHT.';
      }
      return 'Les noirs ont une dominante (regarde le bas de la parade : rouge et bleu au-dessus du vert). La balance des noirs se fait en premier : l\'iris se ferme pendant le réglage.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const c = cast(), neutral = Math.abs(c[0] - 1) < 0.03 && Math.abs(c[2] - 1) < 0.03;
      if (!defis[0] && st.abb) defis[0] = true;
      if (defis[0] && !defis[1] && st.awbOk && st.mem.A === 3200 && st.wbSw === 'A' && st.Tl === 3200) { defis[1] = true; st.Tl = 5600; lights.mark(5600); lights.row.hidden = false; }
      if (defis[1] && !defis[2] && st.Tl === 5600 && neutral && st.mem.A === 3200 && st.wbSw !== 'A') defis[2] = true;
      ct.set(st.ct); card.set(st.card);
      sh.done(defis); sh.say(olivier());
      const shown = busy ? (busy.kind === 'ABB' ? 'ABB: EXECUTING' : 'AWB: EXECUTING') : (msg && performance.now() < msgT ? msg : '');
      const closed = busy && busy.kind === 'ABB';
      vf.draw({ f: o.f, dF: o.dF, N: o.N, E: closed ? 0 : E(), wb: c, black: /** @type {[number, number, number]} */ (st.black), scene: st.out === 'BARS' ? 'bars' : st.card ? 'card' : 'mire', msg: shown });
      send(ctx, lensState(st, o, { light: closed ? 0 : 0.5, wb: c, bars: st.out === 'BARS' }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => {
      Object.assign(st, { n: irisPos(5.6), Tl: 3200, wbSw: 'PRST', ct: true, mem: { A: 5600, B: 5600 }, out: 'CAM', card: false, black: [0.004, 0, 0.006], abb: false, awbOk: false });
      busy = null; msg = ''; wbSw.mark('PRST'); outSw.mark('CAM'); lights.mark(3200); lights.row.hidden = true; defis.fill(false); rings.sync(); up();
    })));
    up();
    return { node: sh.node, dispose: () => { clearTimeout(timer); vf.dispose(); } };
  },
};
