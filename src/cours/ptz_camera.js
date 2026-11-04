// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { OPTIQUES, largeurCapteur, rapportZoom, angleH, champ, focalePour, tempsPano, materiel, budgetPour } from './ptz_calc.js';
import { MODELES, CLASSES_POE } from '../labo/calc/ptz.js';

// ----------------------------------------------------------------------------------
// Chapitre « Les caméras PTZ » (v19.30), première partie : la caméra et son système. La tourelle (pan, tilt,
// zoom, capteur, sorties, presets ; le champ selon la focale) et le système de la régie légère (vidéo en SDI vers
// le mélangeur, commande et alimentation par le réseau, pupitre, PC, tally ; le matériel d'un banc). Les chiffres
// viennent de cours/ptz_calc.js et du modèle de l'atelier du Labo (labo/calc/ptz.js).
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', violet: '#c9a0ff', box: '#1a2026', line: '#2a3238', white: '#e8eef2', ink: '#0b1013', dim: '#6f7a84', soft: '#aab4ba' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 4, fill, stroke, strokeWidth: 1.2 });
const ligne = (x1, y1, x2, y2, col = C.grey, w = 1.6, dash = '') => sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: w, ...(dash ? { 'stroke-dasharray': dash } : {}) });
const deg = (v, d = 1) => `${fmtNum(v, d)}°`;

// ======================================================================================
// 1. La caméra PTZ : la tourelle, l'optique, les sorties
// ======================================================================================
function figTourelle() {
  const h = OPTIQUES.he130, u = OPTIQUES.ue20;
  const f = figure(720, 280, `Une caméra PTZ vue de face et de dos. De face : le socle fixe, la tête qui tourne autour de l'axe vertical (le pan) et qui s'incline autour de l'axe horizontal (le tilt), l'objectif zoom au centre de la tête. Le panneau de connexion de l'AW-HE130 (sérigraphies du mode d'emploi) : SDI OUT (BNC, vers le mélangeur), VIDEO OUT (BNC, composite analogique), G/L IN (BNC, entrée de synchronisation), HDMI, MIC/LINE (mini-jack), LAN (RJ45 : commande, flux IP, PoE+), RS-422 (RJ45 aussi, mais liaison série), DC 12V IN (bloc secteur). À droite, les deux modèles du BTS : AW-HE130, ${h.fmin} à ${h.fmax} mm, zoom ${fmtNum(rapportZoom('he130'))}×, de ${deg(angleH('he130', h.fmin), 0)} à ${deg(angleH('he130', h.fmax))} de champ horizontal environ ; AW-UE20, ${u.fmin} à ${u.fmax} mm, zoom ${fmtNum(rapportZoom('ue20'))}×, de ${deg(angleH('ue20', u.fmin), 0)} à ${deg(angleH('ue20', u.fmax))}.`);
  f.append(txt(10, 16, 'Pan, tilt, zoom : une caméra et son objectif sur une tourelle motorisée', 'co-t', 'start'));
  // la face
  const cx = 130, cy = 150;
  f.append(sv('rect', { x: cx - 60, y: cy + 50, width: 120, height: 26, rx: 8, fill: C.box, stroke: C.grey }), txt(cx, cy + 92, 'socle fixe', 'co-s'));
  f.append(sv('rect', { x: cx - 46, y: cy - 30, width: 92, height: 80, rx: 14, fill: C.box, stroke: C.grey }));
  f.append(sv('circle', { cx, cy: cy + 6, r: 26, fill: C.ink, stroke: C.cyan, strokeWidth: 2 }), sv('circle', { cx, cy: cy + 6, r: 12, fill: '#24323a' }), txt(cx, cy - 38, 'tête : caméra + zoom', 'co-s'));
  // le pan (ellipse sous la tête) et le tilt (arc à droite)
  f.append(sv('ellipse', { cx, cy: cy + 50, rx: 80, ry: 12, fill: 'none', stroke: C.amber, strokeWidth: 1.6, 'stroke-dasharray': '5 4' }), txt(cx - 92, cy + 48, 'pan', 'co-t', 'end', { fill: C.amber }));
  f.append(sv('path', { d: `M${cx + 62} ${cy - 30} A 50 50 0 0 1 ${cx + 62} ${cy + 40}`, fill: 'none', stroke: C.green, strokeWidth: 1.6, 'stroke-dasharray': '5 4' }), txt(cx + 80, cy + 8, 'tilt', 'co-t', 'start', { fill: C.green }));
  // le dos
  const bx = 290, by = 70;
  f.append(box(bx - 10, by - 30, 190, 240, C.grey), txt(bx + 85, by - 38, 'AW-HE130 : panneau de connexion', 'co-s'));
  const prises = [['SDI OUT', C.amber, 'BNC → mélangeur'], ['VIDEO OUT', C.dim, 'BNC, composite'], ['G/L IN', C.dim, 'BNC, synchro (entrée)'], ['HDMI', C.amber, '→ moniteur'], ['MIC/LINE', C.dim, 'mini-jack 3,5 mm'], ['LAN', C.cyan, 'RJ45 : IP + PoE+'], ['RS-422', C.red, 'RJ45 : série, pas l\'Ethernet'], ['DC 12V IN', C.grey, 'bloc secteur']];
  prises.forEach(([n, col, r], i) => { const y = by - 12 + i * 28; f.append(sv('rect', { x: bx, y: y - 9, width: 16, height: 14, rx: 3, fill: /** @type {string} */ (col) }), txt(bx + 24, y + 2, /** @type {string} */ (n), 'co-s', 'start'), txt(bx + 24, y + 14, /** @type {string} */ (r), 'co-s', 'start', { fill: C.dim })); });
  // les deux modèles
  const mx = 490;
  [['he130', 'AW-HE130 (×2)', 'trois capteurs 1/2,86 pouce, Full HD'], ['ue20', 'AW-UE20', 'un capteur 4K 1/2,8 pouce']].forEach(([m, n, cap], i) => {
    const O = OPTIQUES[m], y = 50 + i * 110;
    f.append(box(mx, y, 220, 96, i ? C.violet : C.cyan), txt(mx + 110, y + 20, n, 'co-t'), txt(mx + 110, y + 38, cap, 'co-s'));
    f.append(txt(mx + 110, y + 56, `${fmtNum(O.fmin, 1)} à ${fmtNum(O.fmax, 1)} mm : zoom ${fmtNum(rapportZoom(m))}×`, 'co-s'));
    f.append(txt(mx + 110, y + 74, `champ ≈ ${deg(angleH(m, O.fmin), 0)} à ${deg(angleH(m, O.fmax))}`, 'co-s'));
    f.append(txt(mx + 110, y + 90, `PoE+ classe ${MODELES[m].classe}`, 'co-s', 'middle', { fill: C.dim }));
  });
  return f;
}
function demoTourelle(host) {
  let m = 'he130', f = 20, d = 8, L = 2, a = 90, v = 30;
  const cv = canvas(720, 220, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Angle de champ horizontal', 'Largeur du champ à cette distance', 'Pour cadrer la largeur voulue', 'Le panoramique']);
  const verdict = el('p', { class: 'co-verdict' });
  const focale = el('div', { class: 'co-ctl' });
  const regler = () => focale.replaceChildren(slider('Focale', Math.round(OPTIQUES[m].fmin * 10), Math.round(OPTIQUES[m].fmax * 10), Math.round(f * 10), 1, (x) => { f = x / 10; draw(); }, (x) => `${fmtNum(x / 10, 1)} mm`));
  const draw = () => {
    const O = OPTIQUES[m]; f = Math.min(O.fmax, Math.max(O.fmin, f));
    const ang = angleH(m, f), w = champ(m, f, d), P = focalePour(m, L, d);
    read.set('Angle de champ horizontal', `${deg(ang)} à ${fmtNum(f, 1)} mm (capteur large d'environ ${fmtNum(largeurCapteur(O.type), 2)} mm)`);
    read.set('Largeur du champ à cette distance', `${fmtNum(w, 2)} m à ${d} m`);
    read.set('Pour cadrer la largeur voulue', `${fmtNum(L, 1)} m à ${d} m : ${fmtNum(P.f, 1)} mm${P.dans ? '' : ` (hors de l'optique : ${fmtNum(O.fmin, 1)} à ${fmtNum(O.fmax, 1)} mm)`}`);
    read.set('Le panoramique', `${a}° à ${v}°/s : ${fmtNum(tempsPano(a, v), 1)} s`);
    verdict.className = 'co-verdict ' + (P.dans ? 'ok' : 'ko');
    verdict.textContent = P.dans ? `L'${O.nom} cadre ${fmtNum(L, 1)} m à ${d} m à ${fmtNum(P.f, 1)} mm, dans son zoom.` : P.f > O.fmax ? `Trop loin : même au plus serré (${fmtNum(O.fmax, 1)} mm), le champ fait ${fmtNum(champ(m, O.fmax, d), 2)} m. Rapprochez la tourelle.` : `Trop près : même au plus large (${fmtNum(O.fmin, 1)} mm), le champ ne fait que ${fmtNum(champ(m, O.fmin, d), 2)} m. Reculez la tourelle.`;
    // vue de dessus : la tourelle, le cône du champ, la largeur voulue
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 220);
    const x0 = 40, y0 = 110, k = 640 / 30, xd = x0 + d * k, demi = Math.tan(ang * Math.PI / 360);
    g.fillStyle = 'rgba(127,211,243,.14)'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 680, y0 - 680 * demi); g.lineTo(x0 + 680, y0 + 680 * demi); g.closePath(); g.fill();
    g.strokeStyle = C.cyan; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 680, y0 - 680 * demi); g.moveTo(x0, y0); g.lineTo(x0 + 680, y0 + 680 * demi); g.stroke();
    g.fillStyle = C.white; g.fillRect(x0 - 10, y0 - 8, 16, 16);
    g.strokeStyle = C.amber; g.lineWidth = 3; g.beginPath(); g.moveTo(xd, y0 - L / 2 * k); g.lineTo(xd, y0 + L / 2 * k); g.stroke(); g.lineWidth = 1;
    g.font = '12px Arial, sans-serif'; g.fillStyle = C.soft; g.fillText(`vue de dessus · ${d} m · largeur voulue ${fmtNum(L, 1)} m (en ambre) · champ ${fmtNum(w, 2)} m`, 14, 18);
    for (let i = 0; i <= 30; i += 5) { g.fillStyle = C.dim; g.fillText(`${i} m`, x0 + i * k - 8, 212); }
  };
  host.append(
    el('div', { class: 'co-ctl' }, choice('Caméra', [['he130', 'AW-HE130'], ['ue20', 'AW-UE20']], m, (x) => { m = x; regler(); draw(); })),
    focale,
    el('div', { class: 'co-ctl' },
      slider('Distance au sujet', 1, 30, d, 1, (x) => { d = x; draw(); }, (x) => `${x} m`),
      slider('Largeur à cadrer', 5, 120, L * 10, 5, (x) => { L = x / 10; draw(); }, (x) => `${fmtNum(x / 10, 1)} m`)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le champ de la tourelle vu de dessus : il s\'ouvre en cône depuis l\'objectif ; plus la focale est longue, plus il est étroit.')),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      slider('Panoramique', 10, 340, a, 10, (x) => { a = x; draw(); }, (x) => `${x}°`),
      slider('Vitesse de pan', 1, 90, v, 1, (x) => { v = x; draw(); }, (x) => `${x}°/s`)));
  regler(); draw();
}

// ======================================================================================
// 2. Le système : vidéo, commande, alimentation, tally
// ======================================================================================
function figSysteme() {
  const B = materiel(2, 1, true);
  const f = figure(720, 300, `Le système de la régie légère du BTS. Trois caméras PTZ envoient leur image en SDI (traits ambre) au mélangeur. Elles sont reliées par un câble réseau (traits bleus) à un switch PoE+ qui les alimente et transporte la commande : le pupitre AW-RP150 et le PC technique (Easy IP Setup, navigateur) sont branchés au même switch. Le mélangeur renvoie le tally vers le pupitre (trait vert), qui l'allume sur la caméra à l'antenne. Au total : ${B.ports} ports du switch, ${B.portsPoe} en PoE+, ${B.reserve} W réservés, ${B.sdi} câbles SDI.`);
  f.append(txt(10, 16, 'Deux réseaux cohabitent : la vidéo en SDI, la commande et le courant par l\'IP', 'co-t', 'start'));
  const cams = [['CAM 1', 'AW-HE130', 60], ['CAM 2', 'AW-HE130', 130], ['CAM 3', 'AW-UE20', 200]];
  for (const [n, mo, y] of cams) f.append(box(20, /** @type {number} */ (y) - 22, 110, 44, C.cyan), txt(75, /** @type {number} */ (y) - 3, /** @type {string} */ (n), 'co-t'), txt(75, /** @type {number} */ (y) + 13, /** @type {string} */ (mo), 'co-s'));
  // le mélangeur et la sortie
  f.append(box(560, 40, 140, 70, C.amber), txt(630, 70, 'Mélangeur', 'co-t'), txt(630, 88, 'entrées SDI 1 à 3', 'co-s'));
  for (const [, , y] of cams) f.append(ligne(130, /** @type {number} */ (y) - 8, 560, 60 + (/** @type {number} */ (y) - 60) / 7, C.amber));
  f.append(txt(345, 44, 'SDI : l\'image (BNC, coaxial 75 Ω)', 'co-s', 'middle', { fill: C.amber }));
  // le switch
  f.append(box(250, 230, 200, 44, C.cyan), txt(350, 250, 'Switch PoE+', 'co-t'), txt(350, 266, 'commande, flux IP, courant', 'co-s'));
  for (const [, , y] of cams) f.append(ligne(130, /** @type {number} */ (y) + 10, 250, 238 + (/** @type {number} */ (y) - 60) / 10, C.cyan));
  f.append(txt(170, 290, 'RJ45 : IP + PoE+', 'co-s', 'middle', { fill: C.cyan }));
  // le pupitre et le PC
  f.append(box(520, 170, 180, 50, C.violet), txt(610, 192, 'Pupitre AW-RP150', 'co-t'), txt(610, 208, 'joystick, touches de caméra', 'co-s'));
  f.append(box(520, 240, 180, 46, C.grey), txt(610, 260, 'PC technique', 'co-t'), txt(610, 276, 'Easy IP Setup, navigateur', 'co-s'));
  f.append(ligne(450, 246, 520, 196, C.cyan), ligne(450, 260, 520, 262, C.cyan));
  // le tally
  f.append(ligne(640, 110, 640, 170, C.green, 1.6, '5 4'), txt(648, 145, 'tally (GPIO)', 'co-s', 'start', { fill: C.green }));
  return f;
}
function demoSysteme(host) {
  let n130 = 2, nUe = 1, rp = true;
  const read = readout(['Ports du switch', 'Ports en PoE+', 'PoE réservé (allocation par classe)', 'Consommation (ordre de grandeur)', 'Budget de switch qui suffit', 'Câbles']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const B = materiel(n130, nUe, rp), b = budgetPour(B.reserve);
    read.set('Ports du switch', `${B.ports} (un par appareil, le PC compris)`);
    read.set('Ports en PoE+', `${B.portsPoe} : chaque caméra${rp ? ' et le pupitre' : ''}, classe 4`);
    read.set('PoE réservé (allocation par classe)', `${B.portsPoe} × ${CLASSES_POE[4]} W = ${B.reserve} W`);
    read.set('Consommation (ordre de grandeur)', `≈ ${B.conso} W`);
    read.set('Budget de switch qui suffit', b ? `${b} W (budget courant d'un switch PoE+)` : 'au-delà des switchs courants : deux switchs');
    read.set('Câbles', `${B.rj45} RJ45, ${B.sdi} SDI (${B.cams} caméra${B.cams > 1 ? 's' : ''} vers le mélangeur${rp ? ', 1 retour de contrôle vers le pupitre' : ''})`);
    verdict.className = 'co-verdict ' + (B.reserve <= 125 ? 'ok' : 'ko');
    verdict.textContent = B.reserve <= 125 ? `Le switch du banc (125 W) suffit : ${B.reserve} W réservés.` : `Le switch du banc (125 W) ne suffit plus : ${B.reserve} W à réserver. Un switch plus puissant, ou des appareils sur leur bloc 12 V.`;
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('AW-HE130', 0, 8, n130, 1, (x) => { n130 = x; draw(); }),
      slider('AW-UE20', 0, 8, nUe, 1, (x) => { nUe = x; draw(); }),
      choice('Pupitre AW-RP150 en PoE+', [['oui', 'Oui'], ['non', 'Non (bloc 12 V)']], 'oui', (x) => { rp = x === 'oui'; draw(); })),
    verdict, read.el);
  draw();
}

export const PTZ_CAMERA = [
  {
    id: 'ptz-tourelle', title: 'La caméra PTZ : tourelle, zoom et sorties', minutes: '8 min',
    essentials: [
      'Une **PTZ** est une caméra et son zoom sur une **tourelle motorisée** : **pan** (tourner), **tilt** (incliner), **zoom**, pilotés à distance.',
      'Elle sort son image en **SDI** ou **HDMI** vers le mélangeur, parfois aussi en **IP** ; sa **commande** et son **courant** arrivent par le câble réseau (**PoE+**).',
      'Au BTS : deux **AW-HE130** (zoom 20×, 4,5 à 90 mm) et une **AW-UE20** (4K, zoom 12×, 3,9 à 46,8 mm) ; plus la focale est longue, plus le champ est étroit.',
    ],
    figure: figTourelle,
    demoTitle: 'Cadrez un pupitre de 2 m à 8 m avec l\'AW-HE130, puis avec l\'AW-UE20. Reculez à 25 m : laquelle cadre encore 1 m ? Combien de temps pour un panoramique de 90° à 30°/s ?',
    demo: demoTourelle,
    body: `Une caméra **PTZ** (de l'anglais *pan*, *tilt*, *zoom*) réunit dans un même boîtier une caméra, son objectif zoom et deux moteurs. Le **pan** fait tourner la tête autour d'un axe vertical ; le **tilt** l'incline vers le haut ou le bas ; le **zoom** change la focale. On l'appelle aussi **caméra tourelle**. On la pose sur une table, sur un pied, au mur ou au plafond, et un opérateur la pilote de loin, depuis un **pupitre** ou un logiciel : une seule personne peut tenir trois ou quatre caméras.

**L'optique.** Le champ d'une caméra dépend de sa **focale** et de la largeur de son **capteur** : plus la focale est longue, plus l'angle est étroit et plus le sujet paraît grand. À une distance d, la largeur filmée vaut d × largeur du capteur ÷ focale. L'AW-HE130 va de 4,5 à 90 mm (un zoom **20×**) : de près de 57° de champ horizontal à environ 3° ; l'AW-UE20 va de 3,9 à 46,8 mm (**12×**) : de 65° à 6° environ. Ces angles sont calculés à partir du « type » du capteur en pouces (une convention héritée des tubes : 1 pouce de type, environ 16 mm de diagonale) : ce sont des **ordres de grandeur**, à un ou deux degrés de ceux du constructeur.

**Le capteur.** L'AW-HE130 a **trois capteurs** de 1/2,86 pouce (un par couleur, derrière un prisme), en Full HD ; l'AW-UE20 a **un capteur** 4K de 1/2,8 pouce. Un capteur aussi petit garde beaucoup de profondeur de champ : à focale courte, presque tout est net.

**Les sorties.**
- **SDI** (3G-SDI, prise BNC) : l'image vers le mélangeur, sur câble coaxial, jusqu'à une centaine de mètres ; c'est le chemin de la régie.
- **HDMI** : pour un moniteur ou un petit mélangeur, sur quelques mètres.
- **IP** : la caméra peut aussi envoyer son image compressée sur le réseau (H.264, et selon le modèle H.265, RTSP, SRT, NDI|HX), pour un enregistreur ou un logiciel.
- **LAN** (RJ45) : la **commande** (pupitre, page web) et, en **PoE+**, le **courant** ; la prise **DC 12V IN** sert quand on alimente la caméra par son bloc secteur.

**Le panneau de connexion de l'AW-HE130**, avec ses sérigraphies : **SDI OUT** (BNC), **VIDEO OUT** (BNC, une sortie composite analogique, qui ne va pas dans une entrée SDI), **G/L IN** (BNC, une **entrée** de synchronisation : le genlock, la référence venue du mélangeur ou du générateur), **HDMI**, **MIC/LINE** (mini-jack 3,5 mm), **LAN**, **RS-422** et **DC 12V IN**. Trois BNC qui se ressemblent : seule SDI OUT donne l'image au mélangeur. Deux RJ45 qui se ressemblent : seule **LAN** fait de l'Ethernet et reçoit le PoE+ ; **RS-422** est une liaison série vers un pupitre (câble droit, 1 000 m au plus). L'AW-UE20 a 3G SDI OUT, HDMI, USB, MIC/LINE, LAN, RS-422 et 12V IN.

**Les positions mémorisées.** Une PTZ retient des **presets** : un cadre (pan, tilt, zoom, point) rappelé d'une touche du pupitre, à la vitesse réglée. C'est ce qui permet à un seul opérateur de suivre une émission : le plan du présentateur, le plan large, l'invité.`,
    plus: `Une tourelle bouge **sans à-coups** à faible vitesse : c'est ce qui permet de faire un mouvement à l'antenne. Pour un rappel de preset hors antenne, on prend la vitesse la plus grande.

- La tête d'une tourelle a un **débattement** limité (elle ne tourne pas indéfiniment) ; une tourelle au plafond se règle **retournée** (réglage d'installation), sinon l'image et les commandes sont à l'envers.
- Le zoom numérique (l'extendeur de l'AW-HE130, 1,4×) agrandit l'image sans gagner de détail : on le garde pour l'appoint.
- Le chapitre « La caméra » explique la profondeur de champ et l'exposition ; le Labo a un atelier Optique.`,
    car: { text: 'Jouer → Le Labo, atelier Caméras PTZ : le banc du BTS, deux AW-HE130, une AW-UE20 et le pupitre AW-RP150. Dans le car, les caméras tourelles servent en tribune de presse ou en caméra de commentateurs.' },
    terms: ['ptz', 'angle-champ', 'aw-rp150'],
    competences: ['C20', 'C23'], savoirs: ['G6', 'G7', 'G8'],
    quiz: [
      { q: 'Que désigne le « T » de PTZ ?', choices: ['Le tilt : l\'inclinaison de la tête, vers le haut ou le bas', ['Le tally : le voyant rouge de l\'antenne', 'Le tally existe sur les PTZ, mais le T de PTZ est le tilt.'], ['Le téléobjectif : le zoom au plus serré', 'Le zoom, c\'est le Z ; le T est un mouvement de la tête.']], answer: 0, why: 'Pan, tilt, zoom : tourner autour de l\'axe vertical, s\'incliner, changer de focale.' },
      { q: 'Vous passez une tourelle de 9 mm à 18 mm de focale, sans la déplacer. La largeur du champ…', choices: ['est divisée par deux', ['double', 'Une focale plus longue resserre le champ : le sujet paraît plus grand.'], ['ne change pas', 'La largeur filmée vaut distance × capteur ÷ focale : elle dépend de la focale.']], answer: 0, why: 'Largeur = distance × largeur du capteur ÷ focale : deux fois plus de focale, deux fois moins de largeur.' },
      { q: 'Par quel câble l\'image de l\'AW-HE130 arrive-t-elle au mélangeur de la régie ?', choices: ['Un câble SDI (coaxial, BNC)', ['Le câble réseau qui l\'alimente en PoE+', 'Il porte la commande et le courant ; l\'image de la régie part en SDI.'], ['Le câble HDMI, sur 50 m', 'Le HDMI ne tient que quelques mètres : la régie prend le SDI.']], answer: 0, why: 'Le SDI transporte l\'image sans compression sur une centaine de mètres de coaxial. Le réseau sert à la commande, au courant et, à part, au flux IP compressé.' },
      { q: 'Le zoom de l\'AW-HE130 va de 4,5 à 90 mm. Quel est son rapport de zoom ?', choices: ['20×', ['85×', 'Le rapport est le quotient des focales extrêmes, pas leur différence.'], ['4,5×', 'C\'est la focale la plus courte, en millimètres.']], answer: 0, why: '90 ÷ 4,5 = 20 : le champ le plus serré est vingt fois plus étroit que le plus large.' },
      { q: 'Un seul opérateur doit tenir trois tourelles pendant une émission. Qu\'est-ce qui le lui permet ?', choices: ['Les presets : un cadre mémorisé rappelé d\'une touche', ['Le PoE+', 'Le PoE+ alimente la caméra ; il ne fait rien gagner à l\'opérateur.'], ['La sortie HDMI', 'La sortie ne change rien au pilotage.']], answer: 0, why: 'Chaque cadre (pan, tilt, zoom, point) est mémorisé : l\'opérateur le rappelle à la vitesse voulue et n\'ajuste qu\'à la main.' },
      { q: 'Quelle prise de la caméra porte à la fois la commande du pupitre et son alimentation ?', choices: ['La prise réseau RJ45, en PoE+', ['La prise SDI', 'Le SDI ne transporte que l\'image (et le son) vers le mélangeur.'], ['La prise 12 V', 'Elle alimente, mais ne transporte aucune commande.']], answer: 0, why: 'Un seul câble réseau : les commandes, la page web, le flux IP et, en PoE+, le courant.' },
    ],
  },
  {
    id: 'ptz-systeme', title: 'Le système : vidéo, commande, courant et tally', minutes: '7 min',
    essentials: [
      'Deux réseaux cohabitent : la **vidéo** en **SDI** (un câble par caméra vers le mélangeur) et l\'**IP** (commande, page web, flux IP), qui apporte aussi le **courant** en **PoE+**.',
      'Le **switch PoE+** relie et alimente les caméras, le **pupitre** et le **PC technique** ; il réserve **30 W** par appareil de classe 4 sur son budget.',
      'Le **tally** part du mélangeur (GPIO) vers le pupitre, qui allume le voyant de la caméra à l\'antenne.',
    ],
    figure: figSysteme,
    demoTitle: 'Combien de ports, de watts et de câbles pour le banc du BTS (deux AW-HE130, une AW-UE20, le pupitre) ? Ajoutez des caméras jusqu\'à dépasser le switch du banc.',
    demo: demoSysteme,
    body: `Une régie de caméras PTZ se dessine en **deux réseaux** qui ne se mélangent pas.

**La vidéo.** Chaque caméra envoie son image en **SDI** au **mélangeur** : un câble coaxial et une prise BNC par caméra. Le mélangeur ne prend que le **format** qu'on lui a réglé : 1080p50 et 1080i50 ne se mélangent pas sans conversion, on règle toutes les caméras pareil. Le pupitre AW-RP150 a une **entrée SDI de contrôle** : on y renvoie l'image de la caméra choisie, pour la voir sur son écran.

**L'IP.** Chaque caméra, le pupitre et le PC technique sont branchés à un **switch** par un câble réseau. Par ce câble passent :
- la **commande** : le pupitre envoie à la caméra des requêtes **HTTP** (bouge, zoome, rappelle tel preset) ;
- la **page web** de la caméra, ouverte depuis le PC pour la régler ;
- le **flux IP** de l'image, si on l'utilise ;
- le **courant**, en **PoE+** (IEEE 802.3at) : pas de bloc secteur à tirer au plafond.

**Le switch PoE+.** Il a un **budget** de puissance pour tous ses ports. Chaque appareil annonce sa **classe** en se branchant ; les caméras et le pupitre sont en **classe 4** : un switch qui alloue par classe leur **réserve 30 W** chacun, même s'ils consomment moins. Le banc (deux AW-HE130, une AW-UE20, le pupitre) réserve donc 4 × 30 = 120 W. Au-delà du budget, les ports suivants restent éteints.

**Le tally.** Le mélangeur sait quelle entrée est à l'antenne ; il le dit par ses **GPIO** (des contacts) au pupitre, qui allume le voyant rouge de la bonne caméra. Sans ce chemin, aucun voyant ne s'allume, même si tout le reste marche.

**Le plan d'adressage.** Avant de brancher, on écrit la **fiche du banc** : le réseau (par exemple 192.168.10.0/24), l'adresse de chaque appareil, le masque, la passerelle, les ports PoE+, le VLAN. C'est elle qu'on applique, appareil par appareil, et qu'on vérifie à la recette.`,
    plus: `Une caméra en **IP seule** (sans SDI) est possible : le mélangeur ou le logiciel reçoit le flux compressé (NDI|HX, SRT). On gagne un câble, on paie en latence et en qualité : en régie, le SDI reste la référence.

- La commande peut aussi passer par une **liaison série** RS-422 (cinq caméras au plus sur l'AW-RP150) : c'est l'ancienne façon, sans réseau.
- Un switch PoE+ chauffe : le budget annoncé suppose une ventilation correcte.
- La leçon « Monter une régie mobile » (chapitre L'exploitation) part du cahier des charges et trace le synoptique complet.`,
    car: { text: 'Jouer → Le Labo, atelier Caméras PTZ, vue « Le banc » : le switch PoE+ à 8 ports, son budget, le câble de chaque appareil. La fiche du banc donne le plan d\'adressage à appliquer.' },
    terms: ['poe', 'classe-poe', 'aw-rp150'],
    competences: ['C6', 'C25', 'C8'], savoirs: ['K2', 'C7', 'G8'],
    quiz: [
      { q: 'Combien de watts réserve un switch qui alloue par classe pour les trois caméras et le pupitre du banc (tous en classe 4) ?', choices: ['120 W', ['92 W', 'C\'est l\'ordre de grandeur de ce qu\'ils consomment : le switch réserve, lui, 30 W par appareil de classe 4.'], ['60 W', 'Classe 4, c\'est 30 W par appareil, pas 15.']], answer: 0, why: '4 appareils × 30 W : 120 W retenus sur le budget, quelle que soit la consommation réelle.' },
      { q: 'Tout marche, le pupitre pilote les caméras, mais aucun voyant de tally ne s\'allume. Que manque-t-il ?', choices: ['Le chemin du tally : les GPIO du mélangeur vers le pupitre', ['Du PoE+ sur les ports des caméras', 'Elles sont pilotées : elles sont donc alimentées.'], ['Un câble SDI de plus par caméra', 'Le SDI amène l\'image au mélangeur ; il ne dit pas à la caméra qu\'elle est à l\'antenne.']], answer: 0, why: 'Le mélangeur sait qui est à l\'antenne, mais il faut un chemin jusqu\'aux caméras : ses GPIO vers le pupitre, qui renvoie le tally.' },
      { q: 'Par quel réseau passe l\'ordre « zoom avant » donné au pupitre ?', choices: ['Le réseau IP, en HTTP, du pupitre à la caméra', ['Le SDI de la caméra', 'Le SDI ne va que dans un sens, de la caméra au mélangeur, et ne porte que l\'image.'], ['Les GPIO du mélangeur', 'Les GPIO portent le tally, pas la commande.']], answer: 0, why: 'Le pupitre envoie à la caméra une requête HTTP par le switch ; la caméra répond et bouge.' },
      { q: 'Une caméra est réglée en 1080i50, les autres en 1080p50. Que fait le mélangeur ?', choices: ['Il refuse son image tant qu\'elle n\'est pas au format réglé', ['Il la convertit tout seul', 'Un mélangeur ne prend que le format qu\'on lui a réglé, sauf convertisseur en entrée.'], ['Rien : SDI c\'est SDI', 'Le SDI transporte un format précis ; 1080i et 1080p ne se mélangent pas.']], answer: 0, why: 'Toutes les sources d\'un mélangeur sont au même format : on règle chaque caméra comme lui.' },
      { q: 'Pourquoi écrit-on la fiche du banc avant de brancher ?', choices: ['Pour donner à chaque appareil une adresse unique du même réseau, et la vérifier à la recette', ['Parce que le switch la demande', 'Le switch ne demande rien : c\'est le technicien qui en a besoin.'], ['Pour choisir les câbles SDI', 'La fiche porte surtout l\'adressage IP ; les câbles viennent du synoptique.']], answer: 0, why: 'Des caméras neuves ont toutes la même adresse : sans plan écrit, on finit avec des doublons et des appareils hors du sous-réseau.' },
      { q: 'Combien de câbles SDI pour trois caméras et le retour de contrôle du pupitre ?', choices: ['4', ['3', 'Il faut aussi le retour vers l\'entrée SDI du pupitre, pour voir la caméra choisie.'], ['6', 'Un SDI ne va que dans un sens, mais une caméra n\'en a besoin que d\'un vers le mélangeur.']], answer: 0, why: 'Un SDI par caméra vers le mélangeur (3), plus un retour de contrôle vers le pupitre (1).' },
    ],
  },
];
