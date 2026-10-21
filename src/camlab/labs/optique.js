// @ts-check
import { el, clamp } from '../../util.js';
import { MIRE_D, ND, COC, defocus, blur, zoomFocal, zoomPos, effAperture, exposureOf, fr, distLabel, fieldWidth, fieldHeight, hfov, dofLimits } from '../optics.js';
import { makeViewfinder, whiteLevels, drawScope } from '../vf.js';
import { slider, seg, toggle, btnRow, linkBtn, rocker, lensRings, lensState, shell, scopeCanvas, irisN, irisPos, pointPos, pointDist, irisLabel } from '../controls.js';

// ----------------------------------------------------------------------------------
// Manipulations du chapitre 1 (l'objectif) : focale, zoom, mise au point, diaphragme,
// profondeur de champ, tirage. Chacune pilote aussi la caméra 3D par ctx.lens(état) : les
// bagues tournent, l'image du viseur et du moniteur suit. Lumière du plateau : 0,5 = l'éclairage
// de la mire, juste exposé à f/5,6 sans filtre.
// ----------------------------------------------------------------------------------

const deg = (r) => fr(r * 180 / Math.PI, 1) + '°';
const send = (ctx, s) => { if (ctx && ctx.lens) ctx.lens(s); };
/** une ligne de lecture sous les commandes */
const readout = () => el('p', { class: 'cl-read' });

export const OPTIQUE = {
  // =================================================================================
  /** la focale fixe le champ : du plateau entier au centre de l'étoile */
  focale(ctx) {
    const st = { z: zoomPos(12), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1 };
    const defis = [false, false, false];
    const vf = makeViewfinder();
    const rings = lensRings(st, () => up(), ['zoom']);
    const read = readout();
    const sh = shell({ vf, ctrls: [...rings.rows, read], defis: [
      'Montre tout le décor : un champ d\'au moins 4 m de large, à 3 m de la caméra.',
      'Cadre la mire en entier, de haut en bas : 60 cm de haut dans l\'image.',
      'Serre au maximum : que reste-t-il dans l\'image ?',
    ] });
    function olivier(f) {
      const W = fieldWidth(MIRE_D, f), Hh = fieldHeight(MIRE_D, f);
      if (defis[2]) return `À 54 mm, l'angle n'est plus que de ${deg(hfov(54))} : ${fr(fieldWidth(MIRE_D, 54) * 100, 0)} × ${fr(fieldHeight(MIRE_D, 54) * 100, 0)} cm à 3 m. La focale a été multipliée par 12, le champ divisé par 12 : c'est le rapport du zoom.`;
      if (defis[1]) return f >= 50 ? 'Encore un peu : la bague jusqu\'en butée.' : `La mire remplit la hauteur : à ${fr(f, 0)} mm, le champ fait ${fr(W, 2)} m de large à 3 m. Serre maintenant au maximum.`;
      if (defis[0]) {
        if (Hh > 0.72) return `Le champ fait encore ${fr(Hh, 2)} m de haut à 3 m. Serre jusqu'à ce que la mire touche le haut et le bas de l'image.`;
        if (Hh < 0.6) return 'Trop serré : la mire dépasse du cadre. Élargis un peu.';
      }
      if (f <= 7.2) return `À ${fr(f, 1)} mm, l'angle de champ fait ${deg(hfov(f))} : ${fr(W, 1)} m de large à 3 m. Tout le plateau tient dans l'image.`;
      return 'Tourne la bague de zoom vers le grand angle : la focale la plus courte voit le plus large.';
    }
    function up() {
      const o = rings.read(); rings.show();
      if (!defis[0] && fieldWidth(MIRE_D, o.f) >= 4) defis[0] = true;
      if (defis[0] && !defis[1]) { const Hh = fieldHeight(MIRE_D, o.f); if (Hh >= 0.6 && Hh <= 0.72) defis[1] = true; }
      if (defis[1] && !defis[2] && o.f >= 53.5) defis[2] = true;
      read.textContent = `Angle de champ ${deg(hfov(o.f))} × ${deg(2 * Math.atan(5.39 / 2 / o.f))} · champ à 3 m : ${fr(fieldWidth(MIRE_D, o.f), 2)} × ${fr(fieldHeight(MIRE_D, o.f), 2)} m`;
      sh.done(defis); sh.say(olivier(o.f));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5 });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { st.z = zoomPos(12); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** le zoom motorisé : la bascule W–T, sa vitesse, et le zoom à la main */
  zoom(ctx) {
    const st = { z: 0, s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, v: 0, servo: true };
    const defis = [false, false, false];
    let run = null, msg = '', raf = 0, lastT = 0;
    const vf = makeViewfinder();
    const rings = lensRings(st, () => up(), ['zoom']);
    const rk = rocker((v) => { st.v = v; loop(); });
    const mode = seg('Commande', [['servo', 'Servo (bascule)'], ['manuel', 'Manuel (bague)']], 'servo', (v) => { st.servo = v === 'servo'; st.v = 0; run = null; up(); });
    const read = readout();
    const sh = shell({ vf, ctrls: [mode.row, rk.row, ...rings.rows, read], defis: [
      'Avec la bascule, zoome jusqu\'en butée vers T (le serré).',
      'Un zoom lent et régulier : du grand angle au serré en 6 secondes au moins, sans t\'arrêter.',
      'Passe en manuel et recadre la mire en entier, à la bague : 60 cm de haut dans l\'image.',
    ] });
    function loop() {
      if (raf || !st.servo || Math.abs(st.v) < 0.01) return;
      lastT = performance.now();
      const step = (now) => {
        raf = 0; const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
        if (!st.servo || Math.abs(st.v) < 0.01) { track(dt); up(); return; }
        // vitesse : la course entière en 0,9 s bascule enfoncée à fond, beaucoup plus lent en effleurant
        st.z = clamp(st.z + Math.sign(st.v) * st.v * st.v / 0.9 * dt, 0, 1);
        track(dt); up(); raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    // le zoom lent : chronométré du grand angle jusqu'au serré
    function track(dt) {
      if (defis[1] || !defis[0]) return;
      const f = zoomFocal(st.z);
      if (!run) { if (f <= 4.6 && st.v > 0.01) { run = { t: 0, still: 0 }; msg = ''; } return; }
      run.t += dt;
      if (st.v < -0.01) { run = null; msg = 'Tu es reparti vers le large : recommence depuis 4,5 mm.'; return; }
      if (st.v <= 0.01) { run.still += dt; if (run.still > 0.4) { run = null; msg = 'Le zoom s\'est arrêté en route : à l\'antenne, ça se voit. Recommence depuis le grand angle.'; } return; }
      run.still = 0;
      if (f >= 53.5) {
        if (run.t >= 6) { defis[1] = true; msg = `${fr(run.t, 1)} s, sans à-coup : c'est un zoom qu'on peut passer à l'antenne.`; }
        else msg = `${fr(run.t, 1)} s : trop rapide. Appuie moins fort sur la bascule, la vitesse dépend de la pression.`;
        run = null;
      }
    }
    function olivier(f) {
      const Hh = fieldHeight(MIRE_D, f);
      if (defis[2]) return 'En manuel, la bague suit ta main, au plus vite. En servo, la bascule donne un mouvement régulier : c\'est ce qu\'on utilise pour les zooms à l\'antenne.';
      if (defis[1]) {
        if (st.servo) return 'Passe le sélecteur en manuel : la bague de zoom se tourne alors à la main.';
        if (Hh > 0.72) return 'Tourne la bague vers le serré jusqu\'à ce que la mire touche le haut et le bas de l\'image.';
        return 'Trop serré : la mire déborde. Reviens un peu vers le large.';
      }
      if (msg) return msg;
      if (run) return `Zoom en cours : ${fr(run.t, 1)} s. Garde une pression légère et constante.`;
      if (defis[0]) return f <= 4.6 ? 'Effleure la bascule vers T et garde la même pression jusqu\'au bout.' : 'Reviens d\'abord en grand angle : bascule vers W.';
      if (!st.servo) return 'Le premier défi se fait en servo : remets le sélecteur sur la bascule.';
      return 'Appuie sur la bascule vers T. Plus tu appuies, plus le zoom va vite ; relâchée, elle revient au milieu et le zoom s\'arrête.';
    }
    function up() {
      const o = rings.read(); rings.show();
      if (!defis[0] && st.servo && o.f >= 53.5) defis[0] = true;
      if (defis[1] && !defis[2] && !st.servo) { const Hh = fieldHeight(MIRE_D, o.f); if (Hh >= 0.6 && Hh <= 0.72) defis[2] = true; }
      rings.parts.zoom.input.disabled = st.servo; rk.input.disabled = !st.servo;
      if (st.servo) rings.sync();
      rk.out.textContent = Math.abs(st.v) < 0.01 ? 'arrêt' : (st.v > 0 ? 'T ' : 'W ') + Math.round(st.v * st.v * 100) + ' %';
      read.textContent = `${fr(o.f, o.f < 10 ? 1 : 0)} mm sur 4,5–54 mm · rapport ${fr(o.f / 4.5, 1)}× sur 12×`;
      sh.done(defis); sh.say(olivier(o.f));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5 });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { z: 0, v: 0, servo: true }); mode.mark('servo'); defis.fill(false); run = null; msg = ''; up(); })));
    up();
    return { node: sh.node, dispose: () => { if (raf) cancelAnimationFrame(raf); vf.dispose(); } };
  },

  // =================================================================================
  /** la mise au point : en serré, puis on élargit ; la mire qui avance */
  point(ctx) {
    const st = { z: zoomPos(12), s: pointPos(6), n: irisPos(2), nd: 1, D: 2.2, mag: false };
    const defis = [false, false, false];
    const vf = makeViewfinder();
    const rings = lensRings(st, () => up(), ['zoom', 'point']);
    const mag = toggle('Loupe MAG ×3', false, (v) => { st.mag = v; up(); });
    const read = readout();
    vf.canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.s = clamp(st.s - Math.sign(e.deltaY) * 0.0012, 0, 1); rings.sync(); up(); }, { passive: false });
    const sh = shell({ vf, ctrls: [...rings.rows, btnRow(mag.btn), read], defis: [
      'Zoome à fond, puis fais le point sur le centre de l\'étoile avec la bague de point.',
      'Élargis sans toucher la bague de point : l\'image reste nette.',
      'La mire avance de 1 m : refais le point, toujours en serré, puis lis la distance sur l\'échelle.',
    ] });
    const N = (f) => effAperture(irisN(st.n), f);
    const sharpAt = (f) => blur(f, st.D, pointDist(st.s), 0, N(f)) <= COC;
    function olivier(f) {
      const dF = pointDist(st.s);
      if (defis[2]) return `L'échelle indique ${distLabel(dF)} : la mire est à ${distLabel(st.D)} du plan des capteurs. On mesure toujours depuis le repère Φ, sur le côté de la caméra, pas depuis la lentille.`;
      if (defis[1]) return f < 50 ? 'Le présentateur s\'est avancé : la mire est maintenant à 1,2 m. Resserre à fond pour refaire le point.' : (sharpAt(f) ? 'Net.' : 'Tourne la bague de point jusqu\'à ce que le centre de l\'étoile soit net. Elle va vers les distances courtes.');
      if (defis[0]) return f <= 6 ? 'Toujours net en large, et même encore plus facile : en grand angle, la profondeur de champ cache les petites erreurs. C\'est pour ça qu\'on fait le point en serré.' : 'Élargis jusqu\'au grand angle, sans toucher la bague de point.';
      if (f < 50) return 'Le point se fait en serré : zoome d\'abord à fond, l\'erreur de netteté y est la plus visible.';
      if (!sharpAt(f)) return 'Tourne la bague de point. La loupe et la molette sur l\'image aident à trouver le point exact.';
      return 'Net.';
    }
    function up() {
      const o = rings.read(); rings.show();
      if (!defis[0] && o.f >= 50 && sharpAt(o.f)) defis[0] = true;
      if (defis[0] && !defis[1] && o.f <= 6 && sharpAt(o.f) && sharpAt(54)) { defis[1] = true; st.D = 1.2; }
      if (defis[1] && !defis[2] && st.D === 1.2 && o.f >= 50 && sharpAt(o.f)) defis[2] = true;
      mag.set(st.mag);
      const [near, far] = dofLimits(o.f, o.N, o.dF);
      read.textContent = `Mire à ${distLabel(st.D)} · point réglé à ${distLabel(o.dF)} · zone nette de ${distLabel(near)} à ${distLabel(far)}`;
      sh.done(defis); sh.say(olivier(o.f));
      const light = 1 / exposureOf(2);
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light, D: st.D, mag: st.mag });
      send(ctx, lensState(st, o, { light, mireD: st.D, mag: st.mag }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { z: zoomPos(12), s: pointPos(6), D: 2.2, mag: false }); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** le diaphragme : exposer, un cran = deux fois la lumière, la position C */
  iris(ctx) {
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(11), nd: 1, light: 0.5 };
    const defis = [false, false, false]; let N1 = 0, N2 = 0;
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
    const rings = lensRings(st, () => up(), ['iris']);
    const marks = el('div', { class: 'cl-row cl-marks', 'aria-hidden': 'true' }, el('span'), el('span', { class: 'cl-mk' }, ...['1.8', '2.8', '4', '5.6', '8', '11', '16', 'C'].map((t) => {
      const N = t === 'C' ? Infinity : Number(t); return el('i', { style: `left:${(irisPos(N) * 100).toFixed(1)}%` }, t);
    })), el('span'));
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [...rings.rows, marks, read], defis: [
      'Expose la mire : sur la forme d\'onde, le blanc entre 85 et 100 %.',
      'Une lampe s\'éteint : le plateau a deux fois moins de lumière. Rattrape l\'exposition à l\'iris.',
      'Ferme l\'iris jusqu\'en butée, sur C.',
    ] });
    const level = (N) => whiteLevels(isFinite(N) ? exposureOf(N) * st.light : 0)[1];
    function olivier(N, w) {
      if (defis[2]) return 'C : l\'iris est fermé, plus aucune lumière n\'entre. C\'est la position de la balance des noirs : la caméra ferme l\'iris elle-même pendant le réglage.';
      if (defis[1]) return `Tu es passé de f/${fr(N1)} à f/${fr(N2)} : un cran plus ouvert, deux fois plus de lumière, juste ce que la lampe a enlevé. Maintenant, ferme l'iris en grand.`;
      if (!isFinite(N)) return 'Fermé : l\'image est noire. Rouvre l\'iris.';
      if (w >= 99.6) return `Le blanc est écrêté à 100 % : tout ce qui dépasse est perdu. Ferme l'iris (nombre f plus grand).`;
      if (w < 85) return defis[0] ? `Une lampe vient de s'éteindre : le blanc est tombé à ${fr(w, 0)} %. Ouvre l'iris d'un cran pour compenser.` : `Le blanc est à ${fr(w, 0)} % : l'image est sombre. Ouvre l'iris (nombre f plus petit).`;
      return `Blanc à ${fr(w, 0)} %.`;
    }
    function up() {
      const o = rings.read(); rings.show();
      const N = o.N; let w = level(N);
      if (!defis[0] && w >= 85 && w < 99.6) { defis[0] = true; N1 = N; st.light = 0.25; w = level(N); }
      else if (defis[0] && !defis[1] && w >= 85 && w < 99.6) { defis[1] = true; N2 = N; }
      if (defis[1] && !defis[2] && !isFinite(N)) defis[2] = true;
      const E = isFinite(N) ? exposureOf(N) : 0;
      read.textContent = isFinite(N) ? `Lumière reçue : ${E >= 1 ? '×' + fr(E, 2) : '÷' + fr(1 / E, 2)} par rapport à f/8 (${fr(Math.log2(E), 1).replace('-', '−')} diaphragme${Math.abs(Math.log2(E)) >= 2 ? 's' : ''}) · blanc de la mire ${fr(w, 0)} %` : 'Iris fermé : aucune lumière.';
      sh.done(defis); sh.say(olivier(N, w));
      vf.draw({ f: o.f, dF: o.dF, N: isFinite(N) ? N : 99, E: E * st.light, light: st.light });
      send(ctx, lensState(st, o, { iris: isFinite(N) ? N : 99, light: st.light }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(11), light: 0.5 }); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** la profondeur de champ : trois mires en escalier, l'iris, la focale, le ND pour garder l'exposition */
  pdc(ctx) {
    const cards = [{ D: 2, ang: -6 }, { D: 3, ang: 0 }, { D: 4.5, ang: 6 }];
    const LIGHT = 4;
    const st = { z: zoomPos(25), s: pointPos(3), n: irisPos(5.6), nd: 1 };
    const defis = [false, false, false]; let N1 = 0;
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
    const rings = lensRings(st, () => up());
    const nd = seg('Filtre', ND.map(([nm, v]) => [v, nm.replace('ND', '')]), st.nd, (v) => { st.nd = Number(v); up(); });
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [...rings.rows, nd.row, read], defis: [
      'Les trois mires nettes, avec une exposition juste (blanc entre 80 et 100 %).',
      'Seule la mire du milieu nette, les deux autres floues : toujours exposé juste, les trois mires dans le cadre.',
      'Sans toucher l\'iris, rends les trois mires nettes en changeant seulement de focale.',
    ] });
    const blurs = (f, dF, N) => cards.map((c) => blur(f, c.D, dF, 0, N));
    function olivier(o, w, b, inFrame) {
      if (defis[2]) return 'En grand angle, la zone nette devient immense, même à pleine ouverture. Trois leviers donc : l\'iris, la focale, et la distance du sujet.';
      if (defis[1]) return o.f <= 6 && b.every((x) => x <= COC) ? 'Net.' : 'Garde l\'iris où il est et élargis : la profondeur de champ augmente comme le carré de la focale qui diminue.';
      if (!inFrame) return 'Élargis un peu : les trois mires doivent rester dans le cadre.';
      if (w >= 99.6) return defis[0] ? 'Pour ouvrir l\'iris sans surexposer, il faut retirer de la lumière autrement : le filtre ND.' : 'L\'image est surexposée : ferme l\'iris, ou mets un filtre ND.';
      if (w < 80) return 'L\'image est sombre : ouvre l\'iris, ou retire un cran de filtre.';
      if (defis[0]) {
        if (b[1] > COC) return 'Le point doit rester sur la mire du milieu, à 3 m.';
        return 'Pour réduire la zone nette, ouvre l\'iris en grand. Le ND garde l\'exposition juste.';
      }
      return 'Ferme l\'iris : la zone nette s\'allonge devant et derrière le point.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const E = exposureOf(o.N, st.nd) * LIGHT, w = whiteLevels(E)[1];
      const b = blurs(o.f, o.dF, o.N), inFrame = o.f <= 25.5, ok = w >= 80 && w < 99.6;
      if (!defis[0] && inFrame && ok && b.every((x) => x <= COC)) defis[0] = true;
      if (defis[0] && !defis[1] && inFrame && ok && b[1] <= COC && b[0] >= 3 * COC && b[2] >= 3 * COC) { defis[1] = true; N1 = o.N; }
      if (defis[1] && !defis[2] && ok && Math.abs(o.N - N1) <= 0.2 && b.every((x) => x <= COC)) defis[2] = true;
      const [near, far] = dofLimits(o.f, o.N, o.dF);
      read.textContent = `Zone nette de ${distLabel(near)} à ${distLabel(far)} · mires à 2, 3 et 4,5 m : ${b.map((x) => (x <= COC ? 'nette' : x >= 3 * COC ? 'floue' : 'un peu floue')).join(', ')}`;
      sh.done(defis); sh.say(olivier(o, w, b, inFrame));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, nd: st.nd, light: LIGHT, scene: 'pdc', cards });
      send(ctx, lensState(st, o, { light: LIGHT }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { z: zoomPos(25), s: pointPos(3), n: irisPos(5.6), nd: 1 }); nd.mark(1); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** le réglage du tirage, comme sur le plateau : mire à 3 m, serré au point, large au tirage */
  tirage(ctx) {
    const D = MIRE_D;
    // départ : le tirage est faux (l'objectif vient d'être monté), le point est à 5 m, l'iris à f/8, la vis bloquée
    const start = () => ({ z: zoomPos(20), s: pointPos(5), delta: 0.09, n: Math.log2(8 / 1.8) / Math.log2(16 / 1.8), nd: 1, locked: true, mag: false });
    const st = start();
    const defis = [false, false, false]; let sweep = null;
    const vf = makeViewfinder();
    const f = () => zoomFocal(st.z), dF = () => pointDist(st.s);
    const nSet = () => 1.8 * Math.pow(16 / 1.8, st.n);
    const N = () => effAperture(nSet(), f());
    const dfs = (fl) => Math.abs(defocus(fl, D, dF(), st.delta));
    const sharpAt = (fl) => dfs(fl) / effAperture(nSet(), fl) <= COC;

    const zoom = slider('Zoom', 0, 1, 0.001, st.z, (v) => { st.z = v; up(); });
    const point = slider('Bague de point', 0, 1, 0.0005, st.s, (v) => { st.s = v; up(); });
    const iris = slider('Iris', 0, 1, 0.001, st.n, (v) => { st.n = v; up(); });
    const nd = seg('Filtre', ND.map(([nm, v]) => [v, nm.replace('ND', '')]), st.nd, (v) => { st.nd = Number(v); up(); });
    const ff = slider('Bague F.f', -0.2, 0.2, 0.0004, st.delta, (v) => { st.delta = v; up(); }, 'cl-ff');
    ff.out.textContent = 'sans graduation';
    const lockBtn = el('button', { type: 'button', class: 'btn small', onclick: () => { st.locked = !st.locked; up(); } });
    const mag = toggle('Loupe MAG ×3', false, (v) => { st.mag = v; up(); });
    const reset = linkBtn('Recommencer', () => { Object.assign(st, start()); defis.fill(false); sweep = null; sync(); up(); });
    const sync = () => { zoom.set(st.z); point.set(st.s); iris.set(st.n); ff.set(st.delta); nd.mark(st.nd); mag.set(st.mag); };
    // molette sur le viseur : la bague de point, finement
    vf.canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.s = clamp(st.s - Math.sign(e.deltaY) * 0.0012, 0, 1); point.set(st.s); up(); }, { passive: false });
    const sh = shell({ vf, ctrls: [zoom.row, point.row, iris.row, nd.row, ff.row, btnRow(lockBtn, mag.btn, reset)], defis: [
      'Ouvre l\'iris en grand ; si l\'image est trop claire, compense avec un filtre ND.',
      'Règle le tirage : le point en serré, la netteté en large, autant de fois qu\'il faut.',
      'Bloque la vis, puis parcours tout le zoom : l\'image doit rester nette.',
    ] });

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
      if (!defis[0] && n <= 2.85 && E <= 2.2 && E >= 0.45) defis[0] = true;
      if (defis[0] && !defis[1] && Math.abs(st.delta) <= 0.012 && dfs(54) <= 0.02 && dfs(4.5) <= 0.012) defis[1] = true;
      if (defis[1] && !defis[2]) {
        if (!st.locked) sweep = null;
        else if (!sharpAt(fl)) sweep = null;
        else { sweep = sweep || { min: fl, max: fl }; sweep.min = Math.min(sweep.min, fl); sweep.max = Math.max(sweep.max, fl); if (sweep.min <= 5 && sweep.max >= 50) defis[2] = true; }
      }
      sh.done(defis);
      ff.input.disabled = st.locked;
      lockBtn.textContent = st.locked ? 'Vis F.f bloquée' : 'Vis F.f débloquée'; lockBtn.classList.toggle('on', !st.locked);
      mag.set(st.mag);
      zoom.out.textContent = fr(fl, fl < 10 ? 1 : 0) + ' mm';
      point.out.textContent = distLabel(dF());
      iris.out.textContent = irisLabel(n, nSet());
      sh.say(olivier());
      vf.draw({ f: fl, dF: dF(), delta: st.delta, N: n, nd: st.nd, mag: st.mag });
      send(ctx, { zoom: st.z, focus: Math.pow(st.s, 1 / 0.45), iris: n, ff: st.delta, nd: ND.findIndex((x) => x[1] === st.nd), focal: fl, dF: dF(), mag: st.mag });
    }
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },
};
