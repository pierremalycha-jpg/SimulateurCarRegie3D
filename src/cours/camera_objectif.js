// @ts-check
import { el } from '../util.js';
import { canvas, slider, choice, readout } from './kit.js';
import { LENS, COC, IRIS_STOPS, zoomFocal, hfov, vfov, fieldWidth, fieldHeight, maxAperture, dofLimits, hyperfocal, blur } from '../camlab/optics.js';
import { TRAITEMENTS, transmission, EQUIV_24x36, rapportZoom, nombreF, diffraction, photosite, focalePourHauteur } from './camera_calc.js';
import { quizDe, competencesDe, figNotions, COUL, fond, ecrire, trait, nf, metres, fN } from './camera_kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « La caméra », partie « L'objectif » : la lentille frontale, la focale et le zoom ; le diaphragme et la
// profondeur de champ ; la mise au point, le tirage et la monture. Chaque leçon reprend des notions de la caméra en
// 3D (champ camlab) et calcule avec le modèle de l'objectif du module (camlab/optics.js : Fujinon ZA12x4.5BERD,
// 4,5–54 mm, f/1,8 jusqu'à 41 mm puis f/2,4, doubleur ×2, 0,3 m ; capteur 2/3" de 9,59 × 5,39 mm, cercle de
// confusion 0,011 mm) et cours/camera_calc.js (Fresnel, ramping, diffraction, focale d'un plan).
// ----------------------------------------------------------------------------------
const PARTIE = 'L\'objectif';
const deg = (r) => r * 180 / Math.PI;

// ======================================================================================
// 1. La focale et le zoom : placer la caméra, choisir la focale, la valeur de plan
// ======================================================================================
/** la valeur de plan d'une personne de 1,75 m d'après la hauteur cadrée H (m) */
function valeurDePlan(H) {
  if (H > 6) return 'plan d\'ensemble : la personne est petite dans le décor';
  if (H >= 1.9) return 'plan en pied (plan large) : la personne entière';
  if (H >= 1.2) return 'plan américain : coupé vers mi-cuisse';
  if (H >= 0.65) return 'plan taille ou poitrine';
  if (H >= 0.3) return 'gros plan : le visage';
  return 'très gros plan : un détail du visage';
}
function demoChamp(host) {
  const cv = canvas(720, 280, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let z = 0.55, D = 6, ext = false, trait0 = 'multi', surf = 30;
  const read = readout(['Focale', 'Angle de champ (horizontal × vertical)', 'Champ cadré à cette distance', 'Valeur de plan (personne de 1,75 m)', 'Le même cadre en photo 24 × 36']);
  const read2 = readout(['Lumière transmise', 'Lumière perdue en diaphragmes', 'Lumière renvoyée en voile et en images fantômes']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const f = zoomFocal(z) * (ext ? LENS.ext : 1);
    const ah = hfov(f), av = vfov(f), W = fieldWidth(D, f), H = fieldHeight(D, f);
    fond(g, 720, 280);
    // vu de dessus : la caméra, le champ, la personne à D
    const cx = 34, cy = 140, k = 330 / D;
    g.save(); g.beginPath(); g.rect(0, 18, 404, 262); g.clip();
    g.fillStyle = 'rgba(255,176,32,.14)'; g.strokeStyle = COUL.fibre; g.lineWidth = 1.4;
    const tx = cx + 380, half = Math.tan(ah / 2) * 380;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(tx, cy - half); g.lineTo(tx, cy + half); g.closePath(); g.fill(); g.stroke();
    const px = cx + D * k, hw = W / 2 * k;
    trait(g, px, cy - Math.min(hw, 120), px, cy + Math.min(hw, 120), COUL.blanc, 1, [4, 3]);
    g.fillStyle = COUL.cyan; g.beginPath(); g.arc(px, cy, Math.max(3, 0.25 * k), 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = '#3b4550'; g.fillRect(cx - 22, cy - 10, 22, 20); g.fillStyle = '#59646f'; g.fillRect(cx, cy - 6, 8, 12);
    ecrire(g, 'vu de dessus', 8, 14);
    ecrire(g, `${metres(D)} · champ de ${metres(W)}`, px, Math.min(268, cy + Math.min(hw, 120) + 14), { align: 'center', col: COUL.blanc });
    ecrire(g, `${nf(deg(ah), 1)}°`, cx + 46, cy + 4, { col: COUL.fibre });
    // le cadre 16:9 du viseur : la personne à l'échelle, les yeux au tiers haut
    const fx = 424, fy = 40, fw = 280, fh = 157.5, s = fh / H;
    g.fillStyle = '#20302a'; g.fillRect(fx, fy, fw, fh);
    g.save(); g.beginPath(); g.rect(fx, fy, fw, fh); g.clip();
    g.fillStyle = '#2c4a3a'; g.fillRect(fx, fy + fh * 0.62, fw, fh);
    const eyes = fy + fh / 3, feet = eyes + 1.62 * s, mid = fx + fw / 2;
    g.fillStyle = '#c99a7a'; g.beginPath(); g.arc(mid, feet - 1.64 * s, 0.11 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c53030'; g.fillRect(mid - 0.23 * s, feet - 1.48 * s, 0.46 * s, 0.62 * s);
    g.fillStyle = '#e8ece6'; g.fillRect(mid - 0.2 * s, feet - 0.86 * s, 0.4 * s, 0.26 * s);
    g.fillStyle = '#1a1a1a'; g.fillRect(mid - 0.18 * s, feet - 0.6 * s, 0.14 * s, 0.6 * s); g.fillRect(mid + 0.04 * s, feet - 0.6 * s, 0.14 * s, 0.6 * s);
    g.fillStyle = COUL.blanc; g.beginPath(); g.arc(mid - 0.04 * s, feet - 1.66 * s, Math.max(0.6, 0.012 * s), 0, Math.PI * 2); g.arc(mid + 0.04 * s, feet - 1.66 * s, Math.max(0.6, 0.012 * s), 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = COUL.grey; g.lineWidth = 1; g.strokeRect(fx, fy, fw, fh);
    ecrire(g, 'dans le viseur (16:9)', fx, fy - 8);
    ecrire(g, `${metres(W)} × ${metres(H)}`, fx + fw / 2, fy + fh + 16, { align: 'center', col: COUL.blanc });
    read.set('Focale', `${nf(f, 1)} mm${ext ? ' (doubleur engagé)' : ''} · rapport de zoom ${nf(rapportZoom(), 0)}× (${nf(LENS.fmin, 1)} à ${nf(LENS.fmax, 0)} mm)`);
    read.set('Angle de champ (horizontal × vertical)', `${nf(deg(ah), 1)}° × ${nf(deg(av), 1)}° : 2 × arctan(9,59 ÷ 2f) sur la largeur du capteur`);
    read.set('Champ cadré à cette distance', `${metres(W)} de large × ${metres(H)} de haut (distance × 9,59 ÷ focale)`);
    read.set('Valeur de plan (personne de 1,75 m)', valeurDePlan(H));
    read.set('Le même cadre en photo 24 × 36', `≈ ${nf(f * EQUIV_24x36, 0)} mm (× ${nf(EQUIV_24x36, 2)}, le capteur 2/3" est ${nf(EQUIV_24x36, 1)} fois moins large)`);
    const T = transmission(surf, TRAITEMENTS[trait0]);
    read2.set('Lumière transmise', `${nf(T * 100, 0)} % après ${surf} surfaces air-verre (${nf(TRAITEMENTS[trait0] * 100, 1)} % renvoyés par surface)`);
    read2.set('Lumière perdue en diaphragmes', `${nf(Math.log2(1 / T), 2)} diaphragme${Math.log2(1 / T) >= 2 ? 's' : ''}`);
    read2.set('Lumière renvoyée en voile et en images fantômes', `${nf((1 - T) * 100, 0)} % : elle rebondit entre les lentilles et finit en partie sur les capteurs`);
    verdict.className = 'co-verdict ' + (D < 1.5 && f < 10 ? 'warn' : 'ok');
    verdict.textContent = D < 1.5 && f < 10 ? 'Très près en grand angle : le visage se déforme (le nez grossit). Reculez la caméra et serrez : la perspective se règle par la place de la caméra, le cadre par la focale.' : ext ? 'Doubleur engagé : toutes les focales doublent, l\'angle de champ est divisé par deux à peu près, et l\'image perd deux diaphragmes (leçon suivante).' : 'Zoomer agrandit l\'image sans changer le point de vue : seule la distance change la perspective. On choisit la place, puis la focale.';
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Zoom', 0, 1, z, 0.01, (v) => { z = v; draw(); }, (v) => `${nf(zoomFocal(v), 1)} mm`),
      slider('Distance du sujet', 1, 40, D, 0.5, (v) => { D = v; draw(); }, (v) => metres(v)),
      choice('Doubleur', [['1', '×1'], ['2', '×2']], '1', (v) => { ext = v === '2'; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À gauche, le champ vu de dessus (en ambre) et le sujet ; à droite, ce que montre le viseur : la personne à l\'échelle, les yeux au tiers haut de l\'image.')),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      choice('Traitement de la frontale et des lentilles', [['nu', 'verre nu', '4 % renvoyés par surface (Fresnel)'], ['simple', 'couche simple', 'fluorure de magnésium, 1,3 %'], ['multi', 'multicouche', '0,2 % par surface']], trait0, (v) => { trait0 = v; draw(); }),
      slider('Surfaces air-verre du zoom', 10, 40, surf, 1, (v) => { surf = v; draw(); }, (v) => String(v))),
    read2.el);
  draw();
}

// ======================================================================================
// 2. Le diaphragme et la profondeur de champ (ramping, doubleur)
// ======================================================================================
const IRIS = IRIS_STOPS;
/** distance de mise au point (m) d'une position de curseur de 0 à 100 : de 0,3 à 60 m, en échelle logarithmique */
const dPoint = (v) => LENS.mod * Math.pow(200, v / 100);
function demoPdc(host) {
  const cv = canvas(720, 210, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let z = 0.8, ki = 2, vp = 45, ext = false;
  const read = readout(['Nombre f réel', 'Lumière, par rapport à f/4', 'Zone nette', 'Hyperfocale', 'Tache de diffraction']);
  const verdict = el('p', { class: 'co-verdict' });
  const X0 = 40, X1 = 700, dMin = 0.3, dMax = 120;
  const X = (d) => X0 + Math.log(Math.min(dMax, Math.max(dMin, d)) / dMin) / Math.log(dMax / dMin) * (X1 - X0);
  const draw = () => {
    const f0 = zoomFocal(z), f = f0 * (ext ? LENS.ext : 1), Nbague = IRIS[ki];
    const Nmax = maxAperture(f0, ext), N = nombreF(Nbague * (ext ? LENS.ext : 1), f0, ext), s = dPoint(vp);
    const [near, far] = dofLimits(f, N, s), H = hyperfocal(f, N);
    fond(g, 720, 210);
    // l'axe des distances, de la caméra à l'infini
    trait(g, X0, 120, X1, 120, COUL.grey, 1);
    for (const d of [0.3, 0.5, 1, 2, 3, 5, 10, 20, 50, 100]) { trait(g, X(d), 116, X(d), 124, COUL.grey); ecrire(g, d < 1 ? nf(d * 100) + ' cm' : nf(d) + ' m', X(d), 140, { align: 'center' }); }
    ecrire(g, '∞', X1 + 8, 124, { col: COUL.blanc });
    g.fillStyle = '#3b4550'; g.fillRect(8, 108, 24, 24);
    // la zone nette, le point, l'hyperfocale
    const xa = X(near), xb = Number.isFinite(far) ? X(far) : X1 + 12;
    g.fillStyle = 'rgba(51,196,108,.35)'; g.fillRect(xa, 92, Math.max(2, xb - xa), 26);
    g.strokeStyle = COUL.pvw; g.strokeRect(xa, 92, Math.max(2, xb - xa), 26);
    trait(g, X(s), 80, X(s), 124, COUL.amber, 2);
    ecrire(g, `point ${metres(s)}`, X(s), 74, { align: 'center', col: COUL.amber });
    if (H < dMax) { trait(g, X(H), 150, X(H), 166, COUL.cyan, 2); ecrire(g, `hyperfocale ${metres(H)}`, X(H), 180, { align: 'center', col: COUL.cyan }); }
    ecrire(g, `net de ${metres(near)} à ${metres(far)}`, Math.min(560, Math.max(80, (xa + Math.min(xb, X1)) / 2)), 106, { align: 'center', col: '#0b0e10', font: '600 11px Arial, sans-serif' });
    // l'ouverture vue de face : le trou de l'iris, à la taille relative de la pupille (focale ÷ N)
    const pup = f / N, R = Math.max(1.5, Math.min(30, pup * 1.1));
    g.fillStyle = '#2a3036'; g.beginPath(); g.arc(72, 40, 32, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe9b8'; g.beginPath(); g.arc(72, 40, R, 0, Math.PI * 2); g.fill();
    ecrire(g, `pupille ${nf(pup, 1)} mm`, 112, 30, { col: COUL.blanc }); ecrire(g, `${nf(f, 1)} mm à ${fN(N)}`, 112, 46);
    const butee = Nbague * (ext ? LENS.ext : 1) < Nmax - 1e-9;
    read.set('Nombre f réel', `${fN(N)}${butee ? ` : la bague est à ${fN(Nbague)}, mais à ${nf(f0, 1)} mm l'objectif n'ouvre qu'à ${fN(Nmax)}` : ''}${ext ? ' (doubleur : le nombre f double)' : ''}`);
    const st = 2 * Math.log2(4 / N);
    read.set('Lumière, par rapport à f/4', `× ${nf((4 / N) ** 2, 2)} : ${st >= 0 ? '+' : '−'}${nf(Math.abs(st), 1)} diaphragme${Math.abs(st) >= 2 ? 's' : ''}`);
    read.set('Zone nette', `${metres(near)} à ${metres(far)}${Number.isFinite(far) ? ` : ${metres(far - near)}, dont ${nf((s - near) / (far - near) * 100, 0)} % devant le point` : ''}`);
    read.set('Hyperfocale', `${metres(H)} : point réglé là, tout est net de ${metres(H / 2)} à l'infini (H = f² ÷ (N × 0,011))`);
    const dif = diffraction(N);
    read.set('Tache de diffraction', `${nf(dif, 1)} µm, ${nf(dif / photosite(), 1)} photosite${dif / photosite() >= 2 ? 's' : ''} de 5 µm${N >= 11 ? ' : l\'image s\'adoucit' : ''}`);
    const v = butee ? ['warn', `Ramping : au-delà de 41 mm, l'objectif ne tient plus f/1,8. Iris en butée, l'image s'assombrit en serrant ; à ${fN(2.4 * (ext ? 2 : 1))} ou plus fermé, plus rien ne bouge.`]
      : N >= 11 ? ['warn', 'Très fermé : beaucoup de profondeur de champ, mais la diffraction adoucit l\'image. Dehors, on garde l\'iris vers f/4 à f/5,6 et on met un filtre ND.']
        : far - near < 0.3 ? ['warn', 'Zone nette de moins de 30 cm : au moindre mouvement du sujet, le point décroche. Le cadreur le suit en permanence à la commande de point.']
          : ['ok', 'La zone nette s\'étend environ un tiers devant le point, deux tiers derrière : elle grandit quand on ferme, quand on élargit, quand le sujet s\'éloigne.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Zoom', 0, 1, z, 0.01, (v) => { z = v; draw(); }, (v) => `${nf(zoomFocal(v), 1)} mm`),
      slider('Bague d\'iris', 0, IRIS.length - 1, ki, 1, (v) => { ki = v; draw(); }, (v) => fN(IRIS[v])),
      slider('Point', 0, 100, vp, 1, (v) => { vp = v; draw(); }, (v) => metres(dPoint(v))),
      choice('Doubleur', [['1', '×1'], ['2', '×2']], '1', (v) => { ext = v === '2'; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'La zone nette (en vert) autour du point (en ambre), sur une échelle des distances logarithmique ; en haut à gauche, le trou de l\'iris vu de face, à la taille de la pupille d\'entrée.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 3. La mise au point, le tirage et la monture (macro, objectif portable ou box)
// ======================================================================================
const MIRE = 3; // m : la mire du réglage du tirage
/** les objectifs du car et du plateau : la plus longue focale, sans et avec doubleur */
const OBJECTIFS = [
  { nom: 'ZA12x4.5 (portable du plateau)', max: 54, ext: 108 },
  { nom: 'UA24x7.8 (portable du car)', max: 187, ext: 0 },
  { nom: 'UA80x9 (box de tribune)', max: 720, ext: 1440 },
];
const SUJETS = { poitrine: { h: 0.6, t: 'un présentateur en plan poitrine (60 cm)' }, pied: { h: 2, t: 'un joueur en pied (2 m)' }, visage: { h: 0.4, t: 'un visage (40 cm)' } };
function demoTirage(host) {
  const cv = canvas(720, 220, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let delta = 0.08, ff = 0, N = 1.8, suj = 'pied', D = 80;
  const read = readout(['Tirage', 'Tache en large (4,5 mm)', 'Tache en serré (54 mm)', 'Réglage']);
  const read2 = readout(['Focale du plan', 'Quel objectif ?']);
  const verdict = el('p', { class: 'co-verdict' });
  const X0 = 50, X1 = 700, Y0 = 186, Y1 = 30;
  const X = (f) => X0 + Math.log(f / LENS.fmin) / Math.log(LENS.fmax / LENS.fmin) * (X1 - X0);
  const draw = () => {
    const err = delta + ff;
    // le point est fait en serré, à 54 mm, sur la mire à 3 m : la bague de point rattrape l'erreur à cette focale
    const dF = 1 / (1 / (MIRE * 1000) + err / (LENS.fmax * LENS.fmax)) / 1000;
    const tache = (f) => blur(f, MIRE, dF, err, N);
    const maxPx = Math.max(6, tache(LENS.fmin) / 0.005 * 1.15);
    const Y = (px) => Y0 - Math.min(1, px / maxPx) * (Y0 - Y1);
    fond(g, 720, 220);
    trait(g, X0, Y0, X1, Y0, COUL.grey); trait(g, X0, Y0, X0, Y1, COUL.grey);
    for (const f of [4.5, 8, 15, 30, 54]) { trait(g, X(f), Y0, X(f), Y0 + 4, COUL.grey); ecrire(g, nf(f, f < 10 ? 1 : 0) + ' mm', X(f), Y0 + 16, { align: 'center' }); }
    const cpx = COC / 0.005;
    g.fillStyle = 'rgba(51,196,108,.14)'; g.fillRect(X0, Y(cpx), X1 - X0, Y0 - Y(cpx));
    trait(g, X0, Y(cpx), X1, Y(cpx), COUL.pvw, 1, [4, 3]); ecrire(g, 'net (tache < 0,011 mm, ≈ 2 photosites)', X0 + 6, Y(cpx) - 6, { col: COUL.pvw });
    g.strokeStyle = COUL.amber; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 120; i++) { const f = LENS.fmin * Math.pow(LENS.fmax / LENS.fmin, i / 120); const y = Y(tache(f) / 0.005); if (i) g.lineTo(X(f), y); else g.moveTo(X(f), y); }
    g.stroke();
    ecrire(g, 'tache de flou (photosites) en élargissant, sans retoucher le point', X0 + 6, 18, { col: COUL.amber });
    const pl = tache(LENS.fmin), ps = tache(LENS.fmax);
    read.set('Tirage', `${err === 0 ? 'juste' : `faux de ${nf(Math.abs(err), 3)} mm`} (erreur ${nf(delta, 3)} mm, bague F.f ${ff >= 0 ? '+' : '−'}${nf(Math.abs(ff), 3)} mm)`);
    read.set('Tache en large (4,5 mm)', `${nf(pl * 1000, 1)} µm, ${nf(pl / 0.005, 1)} photosites : ${pl <= COC ? 'net' : 'flou'}`);
    read.set('Tache en serré (54 mm)', `${nf(ps * 1000, 1)} µm : net, la bague de point a rattrapé l'erreur`);
    read.set('Réglage', Math.abs(err) < 0.002 ? 'le zoom est parfocal : net du serré au large' : `bague F.f à tourner de ${nf(-err, 3)} mm, en large, sans toucher la bague de point`);
    const v = Math.abs(err) < 0.002 ? ['ok', 'Tirage juste : l\'image reste nette sur toute la course du zoom. On bloque la vis de la bague F.f.']
      : pl <= COC ? ['warn', `Net partout à ${fN(N)}… parce que l'iris fermé cache l'erreur. Le tirage se règle iris grand ouvert (f/1,8), sinon le défaut réapparaît au premier plan sombre.`]
        : ['ko', 'Net en serré, flou en large : c\'est le signe d\'un tirage faux. En large, tournez la bague F.f jusqu\'à ce que la courbe passe dans le vert ; puis serrez, refaites le point, recommencez.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
    // la focale d'un plan
    const S = SUJETS[suj], f = focalePourHauteur(S.h, D);
    read2.set('Focale du plan', `${nf(f, 0)} mm pour ${S.t} à ${metres(D)} (distance × 5,39 ÷ hauteur cadrée)`);
    const o = OBJECTIFS.find((x) => f <= x.max), od = OBJECTIFS.find((x) => x.ext && f <= x.ext);
    read2.set('Quel objectif ?', o ? `${o.nom}${o === OBJECTIFS[0] ? '' : ', ou plus long'}` : od ? `${od.nom} avec son doubleur (deux diaphragmes de moins)` : 'hors de portée : il faut se rapprocher, ou un box plus long encore (UA125 : 1 000 mm)');
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Erreur de tirage (objectif mal plaqué, choc, température)', -0.15, 0.15, delta, 0.005, (v) => { delta = v; draw(); }, (v) => `${v >= 0 ? '+' : '−'}${nf(Math.abs(v), 3)} mm`),
      slider('Bague F.f', -0.15, 0.15, ff, 0.005, (v) => { ff = v; draw(); }, (v) => `${v >= 0 ? '+' : '−'}${nf(Math.abs(v), 3)} mm`),
      choice('Iris', [['1.8', 'f/1,8'], ['2.8', 'f/2,8'], ['5.6', 'f/5,6']], '1.8', (v) => { N = +v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le point est fait en serré (54 mm) sur une étoile de Siemens à 3 m, puis on élargit sans toucher la bague de point : la courbe donne la taille de la tache de flou à chaque focale.')),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      choice('Le plan demandé', Object.entries(SUJETS).map(([k, x]) => [k, x.t.split(' (')[0]]), suj, (v) => { suj = v; draw(); }),
      slider('Distance', 1, 120, D, 1, (v) => { D = v; draw(); }, (v) => metres(v))),
    read2.el);
  draw();
}

/** @type {import('./index.js').Lesson[]} */
export const LECONS_OBJECTIF = [
  {
    id: 'camera-focale', title: 'La focale et le zoom', minutes: '9 min', partie: PARTIE,
    camlab: ['frontale', 'focale', 'zoom', 'defauts'],
    essentials: [
      'La **focale** fixe l\'**angle de champ** : 4,5 mm voit 94° de large, 54 mm voit 10°. Le champ cadré à une distance vaut **distance × 9,59 ÷ focale** sur un capteur 2/3".',
      'Le **zoom** change la focale sans changer le point de vue (rapport 12× pour le 4,5–54 mm) ; il est **parfocal** : le point fait en serré tient en élargissant. Seule la place de la caméra change la perspective.',
      'La **lentille frontale** reçoit tout : son **traitement** anti-reflet sauve la lumière (94 % passent au lieu de 29 % en verre nu), le **pare-soleil** la protège ; aucun objectif n\'est sans **défauts** (franges, distorsion, vignetage, flare).',
    ],
    figure: () => figNotions(['focale', 'zoom'], 'La focale et l\'angle de champ, le zoom et ses groupes de lentilles'),
    demoTitle: 'Zoomez du grand angle au serré en regardant le viseur, puis rapprochez le sujet en grand angle. Engagez le doubleur. Plus bas, passez la frontale en verre nu.',
    demo: demoChamp,
    body: `La lumière entre dans la caméra par l'**objectif**, et d'abord par sa **lentille frontale**, la plus grande et la plus exposée. À chaque passage de l'air au verre, une part de la lumière se réfléchit : 4 % pour un verre nu (formule de Fresnel, indice 1,5). Un zoom compte une trentaine de surfaces air-verre (ordre de grandeur) : en verre nu, il n'arriverait que 29 % de la lumière, et le reste rebondirait entre les lentilles en voile gris et en images fantômes. Le **traitement multicouche** (les reflets violets ou verts de la lentille) ramène la perte vers 0,2 % par surface : 94 % passent. Le **pare-soleil** met la frontale à l'ombre de ce qui est hors du champ (un projecteur, le soleil) ; on la nettoie dans l'ordre : soufflette, pinceau, puis seulement le papier optique humecté, en spirale.

La **focale** est la distance, en millimètres, entre le centre optique de l'objectif et l'image nette d'un sujet lointain. Le capteur ayant une taille fixe (9,59 × 5,39 mm en 2/3" 16:9), la focale décide de ce qui tient dans l'image : l'**angle de champ** horizontal vaut 2 × arctan(9,59 ÷ 2f), 94° à 4,5 mm, 22° à 25 mm, 10° à 54 mm. À une distance donnée, la **largeur cadrée** vaut distance × 9,59 ÷ focale : à 3 m, 6,4 m en grand angle et 53 cm en serré. C'est le calcul qui place une caméra. La taille du capteur compte : sur un capteur photo de 36 mm de large, il faudrait une focale environ 3,8 fois plus longue pour le même cadre.

Le **zoom** est un objectif à focale variable : des groupes de lentilles se déplacent (le variateur change la focale, le compensateur garde l'image au même endroit). Son **rapport** est la plus longue focale divisée par la plus courte : 54 ÷ 4,5 = 12, d'où le nom ZA**12x4.5** ; un zoom de stade 86 × 9,3 va jusqu'à 800 mm. Un zoom de télévision est **parfocal** : le point fait en serré tient sur toute la course, à condition que le tirage soit juste (leçon suivante de la partie). Il est motorisé : la bascule W–T commande la vitesse, sous le pouce du cadreur quand elle est reportée sur le manche. **Zoomer n'est pas avancer** : la perspective ne change que si la caméra se déplace. Une focale courte de très près déforme les visages ; une focale longue de loin aplatit l'image.

Aucun objectif n'est parfait. L'**aberration chromatique latérale** dessine un liseré rouge d'un côté des contours, bleu de l'autre, nul au centre et plus fort au bord, au grand angle et avec le doubleur : c'est elle que l'**ALAC** de la caméra corrige, en recalant les images rouge et bleue sur la verte d'après les positions du zoom, du point et de l'iris. La **distorsion** courbe les lignes droites du bord (en barillet au grand angle, en coussinet au serré) ; le **vignetage** assombrit les coins à pleine ouverture ; le **flare** fait des images fantômes face à une source vive ; la **respiration** change un peu le cadre quand on tourne la bague de point.

- Le réalisateur demande des valeurs de plan, pas des focales : le cadreur choisit la focale qui donne ce plan depuis sa position.
- Une frange nulle au centre qui grandit vers les bords, c'est l'objectif ; la même partout, ce sont les capteurs (registration).`,
    car: { text: 'Au stade, la caméra principale cadre tout le terrain en grand angle depuis la tribune, puis serre sur un joueur à 80 m : un zoom box de 9 à 720 mm. Au poste cadreur, la bascule de zoom est sous le pouce ; en nocturne, les projecteurs du stade entrent dans le pare-soleil des caméras basses et font des images fantômes.', station: 'cadreur' },
    competences: competencesDe(['frontale', 'focale', 'zoom', 'defauts']),
    article: 'optique',
    quiz: quizDe(['frontale', 'focale', 'zoom', 'defauts'], [
      { q: 'Le réalisateur veut un plan poitrine (60 cm de haut) d\'un entraîneur à 30 m, depuis la caméra de plateau et son ZA12x4.5. Que lui répondez-vous ?',
        choices: ['Hors de portée, même avec le doubleur : il faut environ 270 mm, donc un objectif plus long ou une caméra plus proche',
          ['C\'est possible à 54 mm', 'À 54 mm, la hauteur cadrée à 30 m vaut 30 × 5,39 ÷ 54 ≈ 3 m : un plan en pied, pas un plan poitrine.'],
          ['C\'est possible avec le doubleur, à 108 mm', 'À 108 mm, on cadre encore 1,5 m de haut à 30 m : un plan américain. Il faudrait 30 × 5,39 ÷ 0,6 ≈ 270 mm.']],
        answer: 0, why: 'La focale d\'un plan vaut distance × 5,39 ÷ hauteur cadrée : 30 × 5,39 ÷ 0,6 ≈ 270 mm. Le ZA12x4.5 s\'arrête à 54 mm, 108 mm doublé. Le plan se fait avec un portable plus long (l\'UA24x7.8 monte à 187 mm, encore court) ou un box, ou en rapprochant la caméra.' },
      { q: 'En nocturne, une caméra basse montre des images fantômes alignées sur un projecteur du stade, et ses noirs sont plus gris que ceux des autres caméras. Que faire d\'abord ?',
        choices: ['Mettre la frontale à l\'ombre : pare-soleil, ou un drapeau demandé à l\'éclairage, puis vérifier que la lentille est propre',
          ['Refaire la balance des noirs', 'La balance des noirs se fait iris fermé : elle ne voit pas la lumière parasite qui entre par la frontale, elle ne retirera pas le voile.'],
          ['Monter le gain pour rattraper le contraste', 'Le gain amplifie l\'image et le voile ensemble, avec plus de bruit : le contraste ne revient pas.']],
        answer: 0, why: 'Le flare vient d\'une lumière vive qui frappe la frontale hors du champ et rebondit entre les lentilles : un voile qui remonte les noirs et des images fantômes. On fait de l\'ombre sur la lentille, et une trace grasse l\'aggrave : on vérifie la frontale en lumière rasante.' },
    ]),
  },
  {
    id: 'camera-iris', title: 'Le diaphragme et la profondeur de champ', minutes: '10 min', partie: PARTIE,
    camlab: ['iris', 'pdc', 'ramping', 'doubleur'],
    essentials: [
      'L\'**iris** dose la lumière : le **nombre f** est la focale ÷ le diamètre du trou ; chaque cran (1,8 · 2,8 · 4 · 5,6 · 8 · 11 · 16) laisse passer **deux fois moins** de lumière.',
      'La **profondeur de champ** grandit quand on ferme, quand on élargit et quand le sujet s\'éloigne ; point réglé à l\'**hyperfocale** H = f² ÷ (N × 0,011), tout est net de H ÷ 2 à l\'infini.',
      'Au bout du zoom, le **ramping** ferme l\'objectif à f/2,4 au-delà de 41 mm ; le **doubleur** double les focales et le nombre f : **deux diaphragmes** de moins.',
    ],
    figure: () => figNotions(['iris', 'pdc'], 'Le diaphragme et la profondeur de champ'),
    demoTitle: 'Serrez à 54 mm et faites le point à 3 m : comparez f/1,8 et f/8. Élargissez à 4,5 mm. Puis, iris à f/1,8, zoomez de 30 à 54 mm, et engagez le doubleur.',
    demo: demoPdc,
    body: `L'**iris** (le diaphragme) est un jeu de lames qui forme un trou de diamètre réglable dans l'objectif. On ne note pas ce diamètre en millimètres mais par le **nombre f**, la focale divisée par le diamètre de la **pupille d'entrée** (le trou vu à travers l'avant de l'objectif) : à 20 mm, f/4 est un trou de 5 mm. La lumière passe par la surface du trou, qui varie comme le carré du diamètre : entre deux crans de l'échelle, dans un rapport de 1,41 (√2), la lumière change du simple au double. De f/2,8 à f/5,6, deux crans, quatre fois moins de lumière. Parce que c'est un rapport, f/4 expose de la même façon à 4,5 et à 54 mm : on peut zoomer sans réexposer.

L'iris change aussi la **profondeur de champ**, la zone nette devant et derrière le point. Un point du sujet hors du plan de mise au point fait une petite tache sur le capteur ; tant qu'elle reste sous 0,011 mm (deux photosites d'un 2/3" HD), on la voit nette. Trois leviers : l'**iris** (fermer allonge la zone), la **focale** (élargir l'allonge très vite, comme l'inverse du carré de la focale), la **distance** (loin, la zone grandit). À 54 mm, f/1,8, point à 3 m : douze centimètres de net. À 4,5 mm, f/1,8 : de 76 cm à l'infini. La zone s'étend environ un tiers devant le point, deux tiers derrière. L'**hyperfocale** H = f² ÷ (N × 0,011) dit où faire le point pour que tout soit net de H ÷ 2 à l'infini : 46 cm à 4,5 mm f/4 (le plan large ne décroche jamais), 66 m à 54 mm f/4 (au serré, le point se suit en permanence).

Très ouvert, l'objectif est un peu moins piqué dans les coins ; très fermé, la **diffraction** étale chaque point (2,44 × 0,55 µm × N : 22 µm à f/16, quatre photosites). On se place vers **f/4 à f/5,6** et l'on règle la lumière, ou les filtres ND, pour y rester.

Deux cas changent le nombre f sans toucher la bague. Le **ramping** : pour garder f/1,8 au long foyer, il faudrait une pupille de plus en plus grande ; au-delà de 41 mm, les lentilles de devant ne la donnent plus et l'objectif ferme jusqu'à f/2,4 à 54 mm, un peu moins d'un diaphragme. Il ne se voit qu'iris grand ouvert : un zoom avant qui s'assombrit au dernier moment ; à f/2,8 ou plus fermé, rien ne bouge. Le **doubleur** (levier ×2) agrandit deux fois l'image du centre : les focales passent à 9–108 mm, la même lumière s'étale sur une image quatre fois plus grande, le nombre f double (f/1,8 devient f/3,6) : deux diaphragmes de moins, un peu moins de piqué et moins de profondeur de champ à cadre égal. On ne s'en sert que pour serrer au-delà de 54 mm, et on le bascule hors antenne.

- L'iris est le premier réglage de l'exposition, et le seul qui ne coûte ni bruit ni saccade ; il coûte de la profondeur de champ.
- Pour isoler un sujet sur un fond flou : focale longue, iris ouvert, sujet loin du fond, caméra reculée.`,
    car: { text: 'Au poste vision, la main sur le manche du RCP, l\'ingénieur vision règle l\'iris de toutes les caméras : le cadreur ne touche jamais la bague. Au stade, un serré à 800 mm sur un joueur à 80 m, à f/2,8, ne laisse que 60 cm nets : le cadreur suit le point en permanence ; en nocturne, iris en butée, la vision anticipe le ramping au gain.', station: 'vision' },
    competences: competencesDe(['iris', 'pdc', 'ramping', 'doubleur']),
    article: 'optique',
    quiz: quizDe(['iris', 'pdc', 'ramping', 'doubleur'], [
      { q: 'Au stade, en nocturne, la caméra 1 est à f/1,8. Le cadreur serre de 30 à 54 mm de son portable ZA12x4.5 : la vision voit le blanc descendre sur la forme d\'onde. Que faire avant le prochain zoom à l\'antenne ?',
        choices: ['Régler l\'iris à f/2,4 et compenser au gain : le large et le serré auront la même lumière',
          ['Ouvrir l\'iris davantage', 'Il est déjà en butée à f/1,8 : au-delà de 41 mm, l\'objectif ne peut pas ouvrir plus que f/2,4, quelle que soit la commande.'],
          ['Faire changer l\'objectif, il est en panne', 'C\'est le ramping, écrit dans la fiche de l\'objectif : 1:1,8 de 4,5 à 41 mm, 1:2,4 à 54 mm. Rien n\'est en panne.']],
        answer: 0, why: 'Le ramping ne se voit qu\'iris plus ouvert que ce que permet la focale. En partant de f/2,4, l\'objectif donne cette ouverture sur toute la course : le zoom ne s\'assombrit plus. Les 0,8 diaphragme perdus au large se rattrapent au gain ou à la lumière.' },
    ]),
  },
  {
    id: 'camera-point', title: 'La mise au point, le tirage et la monture', minutes: '10 min', partie: PARTIE,
    camlab: ['point', 'tirage', 'macro', 'monture', 'box-portable'],
    essentials: [
      'On fait le point **en serré** (la profondeur de champ y est faible, l\'erreur se voit), puis on élargit : le zoom parfocal garde le point. Rien n\'est net plus près que **0,3 m** sans la **macro**.',
      'Le **tirage** place l\'image exactement sur les capteurs (48 mm derrière la face d\'appui de la monture **B4**). Faux, l\'image est **nette en serré et floue en large** : on règle la bague **F.f** en large, iris grand ouvert.',
      'L\'objectif se plaque sur la monture B4 et se branche par son **câble 12 broches** (iris, zoom, données) ; un **box** de stade ne se pilote que par les **commandes reportées** sur les manches.',
    ],
    figure: () => figNotions(['tirage', 'point'], 'Le tirage juste et le tirage faux, la mise au point'),
    demoTitle: 'Le tirage est faux de 0,08 mm : regardez la tache grandir en élargissant. Corrigez à la bague F.f jusqu\'à rentrer dans le vert, puis refaites l\'essai à f/5,6. Plus bas, cherchez la focale d\'un joueur à 80 m.',
    demo: demoTirage,
    body: `Un objectif ne forme une image parfaitement nette que d'un seul plan à la fois. La **bague de point** déplace un groupe de lentilles pour choisir ce plan, de l'infini à la **distance minimale** (0,3 m pour le ZA12x4.5, comptés depuis la lentille frontale) ; son échelle en mètres compte depuis le plan des capteurs, repéré Φ sur le corps. Le geste du cadreur : **faire le point en serré**, sur les yeux d'un visage ou le centre d'une étoile de Siemens, là où la profondeur de champ est faible et l'erreur visible, puis **élargir** jusqu'au cadre voulu. Le **peaking** du viseur souligne les contours nets.

Ce geste ne marche que si le **tirage** est juste. L'objectif forme son image à 48 mm de la face d'appui de sa monture (dans l'air, à travers le prisme) : c'est là que doivent se trouver les capteurs. La bague de **tirage** (F.f chez Fujinon) déplace légèrement les lentilles arrière pour y amener l'image. Une erreur de tirage se voit en élargissant : la bague de point agit comme le carré de la focale, très fort au serré (elle rattrape l'erreur) et presque plus au grand angle (l'erreur reste entière). **Net en serré, flou en large** : c'est le tirage. La procédure, iris grand ouvert pour ne pas cacher le défaut derrière la profondeur de champ : étoile à 3 m, doubleur sur ×1, macro au repos ; point en serré à la bague de point ; en large, netteté à la bague F.f ; recommencer jusqu'à ce que l'image tienne du serré au large ; bloquer la vis. On le refait à chaque montage d'objectif, après un choc ou un grand écart de température.

La **macro** est une seconde bague qui déplace le groupe arrière : elle permet de filmer plus près que 0,3 m, au grand angle seulement, car le décalage à rattraper grandit comme le carré de la focale (0,10 mm à 4,5 mm pour voir net à 12 cm, 14,6 mm à 54 mm : impossible). En macro, le zoom n'est plus parfocal ; une macro oubliée ressemble à un tirage faux.

La **monture B4** (norme BTA S-1005) est commune aux objectifs et caméras broadcast 2/3" : un Fujinon ou un Canon se monte sur une Sony ou une Grass Valley. Elle fixe la baïonnette, la distance de 48 mm (les plans rouge et bleu un peu plus loin que le vert) et l'image de 11 mm de diagonale. Un objectif mal plaqué, posé sur un grain de poussière, c'est déjà une erreur de tirage. Son **câble 12 broches**, branché caméra éteinte, porte l'alimentation des moteurs, la commande et la position de l'iris (c'est par lui que le RCP règle l'iris), la position du zoom, l'état du doubleur et les données de l'objectif. Enfin, deux familles d'objectifs : le **portable** (2 kg, avec sa poignée de servo, à l'épaule ou sur pied) et le **box** de stade (23,5 kg pour l'UA80x9, 9–720 mm), monté avec la caméra sur un adaptateur grand objectif et piloté seulement par les commandes reportées. La focale d'un plan vaut distance × 5,39 ÷ hauteur cadrée : un joueur en pied à 80 m demande 216 mm, son visage plus de 1 000 mm.

- L'erreur fréquente : faire le point en large, où tout paraît net, et découvrir le flou au premier serré.
- Une image floue à l'antenne, c'est d'abord le point du cadreur, pas un réglage de la vision.`,
    car: { text: 'Au montage d\'une caméra de stade, l\'équipe caméra vérifie le point du serré au large avant de la rendre à la vision ; au line-up, la vision voit un large flou sur une seule caméra : objectif mal plaqué ou tirage pas refait. Au poste cadreur, le point se fait à la commande reportée, sur le manche gauche.', station: 'cadreur' },
    competences: competencesDe(['point', 'tirage', 'macro', 'monture', 'box-portable']),
    article: 'objectifs',
    quiz: quizDe(['point', 'tirage', 'macro', 'monture', 'box-portable'], [
      { q: 'Au line-up, la CAM 3 est nette en serré mais floue dès qu\'elle élargit ; la macro est verrouillée au repos. On vient de lui remonter son objectif. Que faire ?',
        choices: ['Refaire le tirage : iris grand ouvert, point en serré à la bague de point, netteté en large à la bague F.f, et recommencer',
          ['Demander au cadreur de refaire son point en large', 'En large, la bague de point n\'agit presque plus : elle ne peut pas rattraper une erreur de tirage. C\'est la bague F.f qui règle le large.'],
          ['Fermer l\'iris pour gagner de la profondeur de champ', 'La profondeur de champ cache l\'erreur sans la corriger : au premier plan sombre, iris rouvert, le large redevient flou.']],
        answer: 0, why: 'Net en serré, flou en large, macro au repos : c\'est le tirage, à refaire après chaque montage d\'objectif (un objectif mal plaqué suffit). On le règle iris grand ouvert, sur une étoile de Siemens à 3 m, et on bloque la vis de la bague F.f.' },
    ]),
  },
];
