// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { MODELES, CANAUX, TIMING, LIGNE, ARTNET, SACN, empreinte, suivante, dernier, planUnivers, aLaSuite, valeur8, pct8, valeur16, absolue, dip, trame, diagLigne, portAddress, sacnMulticast, debitArtnet, liaison } from '../labo/calc/dmx.js';
import { suivre, modifier, LYRES, position16, pas, versV, versDeg, formeEffet, trajectoire, tourEffet, tourChaser } from '../labo/calc/show.js';
import { cadence, ecartTache, phases, debitUnivers, versPortAddress, dipLeves } from './lumiere_commande_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « La lumière » (v19.29), troisième partie : commander la lumière. Le DMX (univers, canaux, adresses,
// empreintes, commutateurs DIP), la ligne (RS-485, XLR 5 broches, 120 Ω, terminaison, splitter, trame, RDM), la
// console (programmeur, groupes, presets, cues, tracking et Cue Only, exécuteurs, chaser), les lyres (pan, tilt,
// 16 bits, roues, effets de position, phase, MAtricks), la lumière sur le réseau (Art-Net 4, sACN, débit, VLAN).
// Les chiffres viennent des calculs des ateliers du Labo (labo/calc/dmx.js, labo/calc/show.js) et de
// cours/lumiere_commande_calc.js : les leçons et le Labo disent les mêmes.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', violet: '#c9a0ff', box: '#1a2026', line: '#2a3238', white: '#e8eef2', ink: '#0b1013', dim: '#6f7a84', soft: '#aab4ba' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey, dash = '') => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4, ...(dash ? { 'stroke-dasharray': dash } : {}) }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
const ligne = (x1, y1, x2, y2, col = C.grey, w = 1.4) => sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: w });
/** une adresse sur trois chiffres, comme sur l'afficheur d'un projecteur (« 017 ») */
const trois = (a) => String(a).padStart(3, '0');
/** les degrés avec le signe moins typographique */
const deg = (v, d = 1) => `${fmtNum(v, d).replace('-', '−')}°`;

// ======================================================================================
// 1. Le DMX : univers, canaux, adresses
// ======================================================================================
function figDmx() {
  const par = { a: 1, fp: empreinte('par', '4 canaux') }, lyre = { a: suivante(1, empreinte('par', '4 canaux')), fp: empreinte('lyre', '16 canaux') };
  const dec = { a: suivante(lyre.a, lyre.fp), fp: empreinte('decoupe', '1 canal') };
  const f = figure(720, 270, `Une ligne DMX part de la console et passe d'appareil en appareil. Un PAR LED en mode 4 canaux, réglé à l'adresse ${par.a}, lit les canaux ${par.a} à ${dernier(par.a, par.fp)} ; la lyre suivante, en mode 16 canaux, commence à ${par.a} + ${par.fp} = ${lyre.a} et lit ${lyre.a} à ${dernier(lyre.a, lyre.fp)} ; la découpe, en mode 1 canal, est à ${dec.a}. Sous la ligne, les 32 premiers canaux de l'univers, colorés par appareil : les autres, jusqu'à 512, sont libres. En bas, les commutateurs DIP de l'adresse 37 : 1, 4 et 32 levés ; et l'adresse 3.017, l'univers 3 et l'adresse 17, qui fait ${absolue(3, 17)} en adresse absolue.`);
  f.append(txt(10, 16, 'Un univers : 512 canaux ; un appareil = une adresse de départ + son empreinte', 'co-t', 'start'));
  f.append(box(10, 34, 84, 50, C.grey), txt(52, 55, 'Console', 'co-t'), txt(52, 71, 'univers 1', 'co-s'));
  const apps = [
    { x: 108, w: 174, nom: 'PAR LED · 4 canaux', ...par, col: C.amber },
    { x: 296, w: 190, nom: 'Lyre spot · 16 canaux', ...lyre, col: C.cyan },
    { x: 500, w: 152, nom: 'Découpe · 1 canal', ...dec, col: C.green },
  ];
  f.append(ligne(94, 59, 108, 59));
  apps.forEach((p, i) => {
    f.append(box(p.x, 34, p.w, 50, p.col), txt(p.x + p.w / 2, 53, p.nom, 'co-t'), txt(p.x + p.w / 2, 71, p.fp > 1 ? `adresse ${trois(p.a)} → canaux ${p.a} à ${dernier(p.a, p.fp)}` : `adresse ${trois(p.a)} → canal ${p.a}`, 'co-s'));
    if (i < apps.length - 1) f.append(ligne(p.x + p.w, 59, apps[i + 1].x, 59));
  });
  f.append(ligne(652, 59, 668, 59), box(668, 49, 44, 20, C.grey), txt(690, 63, '120 Ω', 'co-s'));
  // les 32 premiers canaux
  const x0 = 40, cw = 20, y0 = 112;
  f.append(txt(x0, y0 - 8, `Les 32 premiers canaux de l'univers ; le suivant commence à adresse + empreinte : ${par.a} + ${par.fp} = ${lyre.a}, puis ${lyre.a} + ${lyre.fp} = ${dec.a}`, 'co-s', 'start'));
  for (let c = 1; c <= 32; c++) {
    const p = apps.find((q) => c >= q.a && c <= dernier(q.a, q.fp));
    f.append(sv('rect', { x: x0 + (c - 1) * cw, y: y0, width: cw - 2, height: 18, rx: 2, fill: p ? p.col : C.box, 'fill-opacity': p ? 0.75 : 1, stroke: C.line }));
    if (c === 1 || apps.some((q) => q.a === c) || c === dec.a + 1 || c === 32) f.append(txt(x0 + (c - 1) * cw + 9, y0 + 32, String(c), 'co-s'));
  }
  f.append(txt(x0 + 32 * cw + 6, y0 + 13, '… 512', 'co-s', 'start'));
  // les commutateurs DIP
  const d = dip(37), yd = 186;
  f.append(txt(x0, yd - 8, `Commutateurs DIP de l'adresse 37 : ${dipLeves(37).join(' + ')} = 37`, 'co-s', 'start'));
  d.forEach((on, k) => {
    const x = x0 + k * 30;
    f.append(sv('rect', { x, y: yd, width: 20, height: 40, rx: 2, fill: C.box, stroke: C.grey }), sv('rect', { x: x + 3, y: on ? yd + 3 : yd + 21, width: 14, height: 16, rx: 2, fill: on ? C.amber : C.dim }), txt(x + 10, yd + 54, String(1 << k), 'co-s'));
  });
  f.append(txt(x0 + 9 * 30 + 4, yd + 24, 'levé = compté', 'co-s', 'start'));
  // univers.adresse
  f.append(box(430, 176, 280, 76, C.grey), txt(570, 196, 'Univers et adresse', 'co-t'), txt(570, 214, `3.017 : univers 3, adresse 17`, 'co-s'), txt(570, 230, `adresse absolue (3 − 1) × ${CANAUX} + 17 = ${fmtNum(absolue(3, 17))}`, 'co-s'), txt(570, 246, 'un canal : 0 à 255 (8 bits), 0 % à 100 %', 'co-s'));
  return f;
}
const MOD_IDS = ['par', 'lyre', 'panneau', 'decoupe', 'gradateur'];
const COUL = [C.amber, C.cyan, C.green, C.violet];
function demoDmx(host) {
  /** @type {import('../labo/calc/dmx.js').Appareil[]} */
  const app = [
    { id: 'A', nom: 'A', modele: 'par', mode: '8 canaux', adresse: 1 },
    { id: 'B', nom: 'B', modele: 'lyre', mode: '16 canaux', adresse: 9 },
    { id: 'C', nom: 'C', modele: 'panneau', mode: '2 canaux', adresse: 25 },
    { id: 'D', nom: 'D', modele: 'decoupe', mode: '5 canaux', adresse: 20 },
  ];
  let sel = 3, pct = 40, univ = 1;
  const edit = el('div', { class: 'co-ctl' });
  const cv = canvas(720, 232, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Appareil A', 'Appareil B', 'Appareil C', 'Appareil D', 'Dernier canal occupé', 'Canaux libres']);
  const read2 = readout(['Valeur DMX sur 8 bits', 'Sur 16 bits (grossier, fin)', 'Adresse de l\'appareil réglé', 'Commutateurs DIP à lever']);
  const verdict = el('p', { class: 'co-verdict' });
  const editeur = () => {
    const a = app[sel];
    edit.replaceChildren(
      choice(`Modèle de ${a.nom}`, MOD_IDS.map((m) => [m, MODELES[m].nom]), a.modele, (v) => { if (v !== a.modele) { a.modele = v; a.mode = Object.keys(MODELES[v].modes)[0]; editeur(); } draw(); }),
      choice(`Mode de ${a.nom}`, Object.keys(MODELES[a.modele].modes).map((m) => [m, m]), a.mode, (v) => { a.mode = v; draw(); }),
      slider(`Adresse de ${a.nom}`, 1, CANAUX, a.adresse, 1, (v) => { a.adresse = v; draw(); }, (v) => trois(v)));
  };
  const draw = () => {
    const P = planUnivers(app);
    // la carte de l'univers : 16 rangées de 32 canaux
    const cols = 32, cw = 20, ch = 11, x0 = 44, y0 = 24;
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 232);
    g.font = '11px Arial, sans-serif'; g.fillStyle = C.soft;
    g.fillText('L\'univers : 512 canaux, 32 par rangée. Rouge : un canal lu par deux appareils.', x0, 14);
    for (let c = 1; c <= CANAUX; c++) {
      const i = c - 1, x = x0 + (i % cols) * cw, y = y0 + Math.floor(i / cols) * ch, o = P.occ[c];
      g.fillStyle = o.length > 1 ? C.red : o.length ? COUL[app.findIndex((a) => a.id === o[0])] : '#1a2026';
      g.fillRect(x, y, cw - 2, ch - 2);
    }
    g.fillStyle = C.dim; for (let r = 0; r < 16; r++) g.fillText(String(r * cols + 1), 4, y0 + r * ch + 8);
    app.forEach((a) => { const i = a.adresse - 1; g.fillStyle = C.ink; g.font = 'bold 9px Arial, sans-serif'; g.fillText(a.id, x0 + (i % cols) * cw + 6, y0 + Math.floor(i / cols) * ch + 8); });
    g.font = '11px Arial, sans-serif';
    app.forEach((a, k) => { g.fillStyle = COUL[k]; g.fillRect(x0 + k * 150, 208, 10, 10); g.fillStyle = C.soft; g.fillText(`${a.id} : ${MODELES[a.modele].nom}`, x0 + k * 150 + 14, 217); });
    // les lectures
    app.forEach((a) => {
      const fp = empreinte(a.modele, a.mode), fin = dernier(a.adresse, fp);
      const bad = P.conflits.includes(a.id) ? ' · en conflit' : P.depasse.includes(a.id) ? ' · dépasse 512' : '';
      read.set(`Appareil ${a.id}`, `${fp} ${fp > 1 ? 'canaux' : 'canal'} : ${a.adresse}${fp > 1 ? ' à ' + Math.min(CANAUX, fin) : ''}, suivant à ${suivante(a.adresse, fp)}${bad}`);
    });
    const fins = app.map((a) => Math.min(CANAUX, dernier(a.adresse, empreinte(a.modele, a.mode))));
    read.set('Dernier canal occupé', String(Math.max(...fins)));
    read.set('Canaux libres', `${P.libres} sur ${CANAUX}`);
    const a = app[sel], v16 = valeur16(pct);
    read2.set('Valeur DMX sur 8 bits', `${pct} % → ${valeur8(pct)} sur 255 (relu : ${fmtNum(pct8(valeur8(pct)), 1)} %)`);
    read2.set('Sur 16 bits (grossier, fin)', `${fmtNum(v16.v)} sur 65 535 : grossier ${v16.grossier}, fin ${v16.fin}`);
    read2.set('Adresse de l\'appareil réglé', `${a.id} : ${univ}.${trois(a.adresse)}, soit ${fmtNum(absolue(univ, a.adresse))} en adresse absolue`);
    read2.set('Commutateurs DIP à lever', `${dipLeves(a.adresse).join(' + ')} = ${a.adresse}`);
    // le verdict
    const dbl = P.occ.map((o, c) => (o.length > 1 ? c : 0)).filter(Boolean);
    const qui = [...new Set(dbl.flatMap((c) => P.occ[c]))];
    const jumeaux = qui.length === 2 && (() => { const [x, y] = qui.map((id) => app.find((q) => q.id === id)); return x.modele === y.modele && x.mode === y.mode && x.adresse === y.adresse; })();
    const tri = [...app].sort((x, y) => x.adresse - y.adresse);
    if (P.depasse.length) { verdict.className = 'co-verdict ko'; verdict.textContent = `${P.depasse.join(' et ')} dépasse le canal 512 : ses derniers paramètres tombent hors de l'univers. Remontez son adresse ou passez-le dans l'univers suivant.`; }
    else if (jumeaux) { verdict.className = 'co-verdict warn'; verdict.textContent = `${qui.join(' et ')} ont le même modèle, le même mode et la même adresse : ils reçoivent les mêmes valeurs et font exactement la même chose. C'est parfois voulu (doubler un projecteur), mais la console ne peut plus les régler séparément.`; }
    else if (dbl.length) { verdict.className = 'co-verdict ko'; verdict.textContent = `Conflit : ${qui.join(' et ')} lisent ${dbl.length > 1 ? `les canaux ${dbl[0]} à ${dbl[dbl.length - 1]}` : `le canal ${dbl[0]}`}. Régler l'un fait bouger l'autre. Décalez le second après le dernier canal du premier.`; }
    else if (aLaSuite(tri, tri[0].adresse)) { verdict.className = 'co-verdict ok'; verdict.textContent = `À la suite, sans trou ni chevauchement, de ${tri[0].adresse} à ${Math.max(...fins)} : chaque appareil commence à l'adresse + l'empreinte du précédent.`; }
    else { verdict.className = 'co-verdict ok'; verdict.textContent = 'Pas de conflit. Il reste des trous entre les appareils : ce n\'est pas une faute (on réserve parfois de la place), mais un patch à la suite se lit mieux.'; }
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Appareil à régler', app.map((a, k) => [String(k), a.nom]), String(sel), (v) => { sel = +v; editeur(); draw(); })),
    edit,
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'La carte de l\'univers, comme dans l\'atelier DMX du Labo : chaque appareil occupe une suite de canaux à partir de son adresse.')),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      slider('Niveau voulu', 0, 100, pct, 1, (v) => { pct = v; draw(); }, (v) => `${v} %`),
      slider('Univers', 1, 8, univ, 1, (v) => { univ = v; draw(); })),
    read2.el);
  editeur(); draw();
}

// ======================================================================================
// 2. La ligne DMX : câble, terminaison, splitter, RDM
// ======================================================================================
function figLigne() {
  const T = trame(CANAUX);
  const f = figure(720, 290, `Trois façons de câbler une ligne DMX. En haut, la bonne : la console, puis les appareils en chaîne (entrée, sortie, entrée…), en câble de ${LIGNE.ohms} Ω et XLR 5 broches, avec une terminaison de ${LIGNE.ohms} Ω au bout ; ${LIGNE.recepteurs} récepteurs au plus et environ ${LIGNE.longueur} m (ordre de grandeur). Au milieu, la faute : une dérivation en Y, dont chaque bout réfléchit le signal. En bas, la solution : un splitter isolé, dont chaque sortie est une nouvelle ligne, terminée à son bout. À droite, le brochage du XLR 5 broches : 1 la masse, 2 Data −, 3 Data +, 4 et 5 la seconde paire. En bas, la trame : coupure de ${TIMING.breakUs} µs, marque de ${TIMING.mabUs} µs, puis le code de début et 512 canaux de ${TIMING.slotUs} µs : ${fmtNum(T.us / 1000, 1)} ms, ${fmtNum(T.hz, 0)} trames par seconde.`);
  f.append(txt(10, 16, `Une ligne, un bout, une terminaison ; des branches, un splitter`, 'co-t', 'start'));
  const app = (x, y, col = C.grey) => [box(x, y - 12, 44, 24, col), txt(x + 22, y + 4, 'app.', 'co-s')];
  const term = (x, y) => [ligne(x - 12, y, x, y), box(x, y - 10, 40, 20, C.green), txt(x + 20, y + 4, '120 Ω', 'co-s', 'middle', { fill: C.green })];
  // la bonne ligne
  let y = 50;
  f.append(box(10, y - 14, 70, 28, C.grey), txt(45, y + 4, 'Console', 'co-s'), txt(100, y + 30, `en chaîne, câble 120 Ω, XLR 5 broches · ≤ ${LIGNE.recepteurs} récepteurs · ≈ ${LIGNE.longueur} m`, 'co-s', 'start', { fill: C.green }));
  f.append(ligne(80, y, 100, y)); [100, 170, 240, 310].forEach((x, i) => { f.append(...app(x, y)); if (i < 3) f.append(ligne(x + 44, y, x + 70, y)); });
  f.append(...term(366, y));
  // le Y
  y = 128;
  f.append(box(10, y - 14, 70, 28, C.grey), txt(45, y + 4, 'Console', 'co-s'), txt(250, y - 12, 'dérivation en Y : à proscrire', 'co-s', 'start', { fill: C.red }));
  f.append(ligne(80, y, 150, y), ligne(150, y, 190, y - 18, C.red), ligne(150, y, 190, y + 18, C.red), ...app(190, y - 18, C.red), ...app(190, y + 18, C.red));
  f.append(sv('path', { d: `M142 ${y - 8} l16 16 M158 ${y - 8} l-16 16`, stroke: C.red, strokeWidth: 2.2 }), txt(250, y + 4, 'deux bouts sans terminaison : le signal s\'y réfléchit', 'co-s', 'start'));
  // le splitter
  y = 206;
  f.append(box(10, y - 14, 70, 28, C.grey), txt(45, y + 4, 'Console', 'co-s'), ligne(80, y, 110, y), box(110, y - 30, 76, 60, C.amber), txt(148, y - 6, 'Splitter', 'co-t'), txt(148, y + 10, 'isolé', 'co-s'));
  [-22, 0, 22].forEach((dy) => f.append(ligne(186, y + dy, 230, y + dy), ...app(230, y + dy), ligne(274, y + dy, 300, y + dy), ...app(300, y + dy), ...term(356, y + dy)));
  f.append(txt(410, y + 4, 'chaque sortie : une nouvelle ligne terminée', 'co-s', 'start'));
  // le brochage XLR 5
  const cx = 625, cy = 110, r = 46;
  f.append(sv('circle', { cx, cy, r, fill: C.box, stroke: C.grey, strokeWidth: 1.4 }), txt(cx, cy - r - 8, 'XLR 5 broches (DMX512)', 'co-t'));
  const broches = [[1, 'masse', -150, C.grey], [2, 'Data −', -210, C.cyan], [3, 'Data +', 90, C.amber], [4, '2ᵉ paire −', 30, C.dim], [5, '2ᵉ paire +', -30, C.dim]];
  for (const [n, , a, col] of broches) {
    const t = /** @type {number} */ (a) * Math.PI / 180, x = cx + 28 * Math.cos(t), yy = cy - 28 * Math.sin(t);
    f.append(sv('circle', { cx: x, cy: yy, r: 6, fill: /** @type {string} */ (col) }), txt(x, yy + 3.5, String(n), 'co-s', 'middle', { fill: C.ink }));
  }
  f.append(txt(cx, cy + r + 16, '1 masse · 2 Data − · 3 Data +', 'co-s'), txt(cx, cy + r + 30, '4 et 5 : la seconde paire', 'co-s'));
  // la trame
  f.append(txt(10, 262, `Trame : coupure ${TIMING.breakUs} µs · marque ${TIMING.mabUs} µs · code de début · 512 × ${TIMING.slotUs} µs = ${fmtNum(T.us / 1000, 1)} ms, ${fmtNum(T.hz, 0)} trames/s à ${TIMING.debit / 1000} kbit/s`, 'co-s', 'start'));
  f.append(txt(10, 280, 'Le RDM (ANSI E1.20) répond sur la même paire, entre deux trames : il lui faut des splitters compatibles.', 'co-s', 'start'));
  return f;
}
function demoLigne(host) {
  let rec = 40, lg = 180, term = false, enY = false, spl = 0, n = 512, v1 = 200;
  const read = readout(['Branches', 'Récepteurs par branche', 'Longueur de câble']);
  const verdict = el('p', { class: 'co-verdict' });
  const pbs = el('ol', { class: 'co-trace' });
  const read2 = readout(['Durée de la trame', 'Trames par seconde', 'Un changement arrive au plus tard', 'Le canal 1 sur la ligne']);
  const cv = canvas(720, 210, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const draw = () => {
    const D = diagLigne({ recepteurs: rec, longueur: lg, terminaison: term, y: enY, splitter: spl });
    read.set('Branches', spl ? `${D.branches} (splitter à ${spl} sorties)` : '1 (pas de splitter)');
    read.set('Récepteurs par branche', `${D.parBranche} sur ${LIGNE.recepteurs} au plus`);
    read.set('Longueur de câble', `${lg} m (environ ${LIGNE.longueur} m au plus, ordre de grandeur)`);
    verdict.className = 'co-verdict ' + (D.ok ? 'ok' : D.pb.length > 1 ? 'ko' : 'warn');
    verdict.textContent = D.ok ? 'La ligne est fiable : chaque branche est en chaîne, dans ses limites, et terminée au bout.' : `${D.pb.length} défaut${D.pb.length > 1 ? 's' : ''} sur la ligne :`;
    pbs.replaceChildren(...D.pb.map((p) => el('li', { class: 'ko' }, p.t)));
    // la trame
    const K = cadence(n);
    read2.set('Durée de la trame', `${fmtNum(K.us)} µs, soit ${fmtNum(K.ms, 2)} ms${K.allongee ? ' (allongée jusqu\'au minimum de la norme)' : ''}`);
    read2.set('Trames par seconde', fmtNum(K.hz, 1));
    read2.set('Un changement arrive au plus tard', `${fmtNum(K.ms, 1)} ms après (une trame)`);
    read2.set('Le canal 1 sur la ligne', `${v1} = ${v1.toString(2).padStart(8, '0')} en binaire, envoyé bit de poids faible d'abord`);
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 210); g.font = '11px Arial, sans-serif';
    // la trame entière, à l'échelle
    const X0 = 20, W = 680, sc = W / K.us;
    g.fillStyle = C.soft; g.fillText(`La trame entière, à l'échelle : ${fmtNum(K.ms, 2)} ms`, X0, 14);
    g.fillStyle = C.red; g.fillRect(X0, 22, TIMING.breakUs * sc, 22);
    g.fillStyle = C.amber; g.fillRect(X0 + TIMING.breakUs * sc, 22, Math.max(1, TIMING.mabUs * sc), 22);
    for (let k = 0; k <= n; k++) { g.fillStyle = k === 0 ? C.cyan : k % 2 ? '#5d6a73' : '#3c464e'; g.fillRect(X0 + (TIMING.breakUs + TIMING.mabUs + k * TIMING.slotUs) * sc, 22, Math.max(0.6, TIMING.slotUs * sc), 22); }
    const fin = TIMING.breakUs + TIMING.mabUs + (n + 1) * TIMING.slotUs;
    if (fin < K.us) { g.fillStyle = '#26303a'; g.fillRect(X0 + fin * sc, 22, (K.us - fin) * sc, 22); g.fillStyle = C.soft; g.fillText('attente', X0 + fin * sc + 4, 37); }
    g.fillStyle = C.dim; g.fillText(`coupure · marque · code de début · ${n} canaux`, X0, 58);
    // le début, bit par bit
    /** @type {Array<{ d: number, lv: number, bit?: string }>} durée (µs), niveau (1 : repos), bit de donnée affiché */
    const segs = [{ d: TIMING.breakUs, lv: 0 }, { d: TIMING.mabUs, lv: 1 }];
    /** @type {Array<{ debut: number, nom: string, col: string }>} où commence chaque octet (µs) */
    const octets = [];
    const octet = (v, nom, col) => {
      octets.push({ debut: segs.reduce((s, x) => s + x.d, 0), nom, col });
      segs.push({ d: 4, lv: 0 });
      for (let b = 0; b < 8; b++) segs.push({ d: 4, lv: (v >> b) & 1, bit: String((v >> b) & 1) });
      segs.push({ d: 8, lv: 1 });
    };
    octet(0, 'code de début : 0', C.cyan); octet(v1, `canal 1 : ${v1}`, C.amber);
    const tot = segs.reduce((s, x) => s + x.d, 0), sz = W / tot, yH = 100, yL = 150;
    g.fillStyle = C.soft; g.fillText(`Le début de la trame, bit par bit (4 µs par bit, 11 bits par canal = ${TIMING.slotUs} µs)`, X0, 80);
    g.fillStyle = C.dim; g.fillText('1', 6, yH + 4); g.fillText('0', 6, yL + 4);
    g.strokeStyle = C.white; g.lineWidth = 1.6; g.beginPath(); g.moveTo(X0, yH);
    let x = X0, prev = 1;
    for (const s of segs) {
      const yy = s.lv ? yH : yL;
      if (s.lv !== prev) g.lineTo(x, yy);
      g.lineTo(x + s.d * sz, yy);
      if (s.bit) { g.fillStyle = C.amber; g.fillText(s.bit, x + s.d * sz / 2 - 3, yH - 6); }
      x += s.d * sz; prev = s.lv;
    }
    g.stroke(); g.lineWidth = 1;
    g.fillStyle = C.red; g.fillText(`coupure (break) : ${TIMING.breakUs} µs`, X0 + 4, yL + 18);
    g.fillStyle = C.soft; g.fillText(`marque : ${TIMING.mabUs} µs`, X0 + TIMING.breakUs * sz + 2, yL + 18);
    for (const o of octets) { g.fillStyle = o.col; g.fillText(o.nom, X0 + o.debut * sz + 2, yL + 34); }
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Récepteurs sur la ligne', 1, 96, rec, 1, (v) => { rec = v; draw(); }),
      slider('Longueur de câble', 10, 600, lg, 10, (v) => { lg = v; draw(); }, (v) => `${v} m`),
      choice('Au bout de la ligne', [['non', 'rien'], ['oui', 'une terminaison 120 Ω']], 'non', (v) => { term = v === 'oui'; draw(); }),
      choice('Dérivation en Y', [['non', 'non'], ['oui', 'oui, un câble en Y']], 'non', (v) => { enY = v === 'oui'; draw(); }),
      choice('Splitter', [['0', 'aucun'], ['2', '2 sorties'], ['4', '4 sorties'], ['6', '6 sorties']], '0', (v) => { spl = +v; draw(); })),
    verdict, pbs, read.el,
    el('div', { class: 'co-ctl' },
      slider('Canaux envoyés par la console', 24, CANAUX, n, 1, (v) => { n = v; draw(); }),
      slider('Valeur du canal 1', 0, 255, v1, 1, (v) => { v1 = v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'En haut, la trame à l\'échelle : la coupure, la marque, le code de début puis les canaux. En bas, le début vu de près : chaque octet part avec un bit de départ à 0, ses 8 bits (poids faible d\'abord) et deux bits d\'arrêt à 1.')),
    read2.el);
  draw();
}

// ======================================================================================
// 3. La console : patch, groupes, presets, cues, tracking
// ======================================================================================
function figConsole() {
  const ex = suivre([{ no: 1, values: { Face: { DIM: 80 }, Contre: { DIM: 60 } } }, { no: 2, values: { Contre: { DIM: 30 } } }, { no: 3, values: { Face: { DIM: 0 } } }]);
  const f = figure(720, 280, `La console d'éclairage. À gauche, le programmeur : on sélectionne des projecteurs (Group 9, les lyres) et on leur donne des valeurs (At 100, le preset de couleur 4.3) ; Store Cue 3 l'enregistre dans la séquence. Au centre, la séquence sur un exécuteur, cue par cue, avec ses temps (fondu, delay) et la touche Go. En haut à droite, les presets : la cue 3 garde un renvoi au preset 4.3, pas la valeur ; corriger le preset corrige toutes les cues qui y renvoient. En bas à droite, le tracking : la cue 1 met la face à ${ex[0].Face.DIM} et le contre à ${ex[0].Contre.DIM} ; la cue 2 ne change que le contre (${ex[1].Contre.DIM}), la face suit à ${ex[1].Face.DIM} ; la cue 3 éteint la face, le contre suit à ${ex[2].Contre.DIM}.`);
  f.append(txt(10, 16, 'Programmer, enregistrer, rejouer', 'co-t', 'start'));
  // le programmeur
  f.append(box(10, 36, 200, 108, C.amber), txt(110, 56, 'Programmeur', 'co-t'), txt(22, 78, 'sélection : Group 9', 'co-s', 'start'), txt(22, 96, 'valeurs : At 100', 'co-s', 'start'), txt(22, 114, '+ Preset 4.3 (bleu)', 'co-s', 'start'), txt(22, 132, 'Clear : vide le programmeur', 'co-s', 'start', { fill: C.dim }));
  f.append(arrow(210, 90, 262, 90, C.amber), txt(236, 82, 'Store', 'co-s'), txt(236, 106, 'Cue 3', 'co-s'));
  // la séquence
  f.append(box(266, 36, 210, 160, C.cyan), txt(371, 56, 'Séquence (exécuteur 1)', 'co-t'));
  const cues = [['Cue 1', 'fondu 3 s'], ['Cue 2', 'fondu 2 s · delay 1 s'], ['Cue 3', 'Preset 4.3 · fondu 2 s'], ['Cue 4', 'fondu 5 s']];
  cues.forEach(([c, t], i) => f.append(sv('rect', { x: 276, y: 66 + i * 26, width: 190, height: 22, rx: 2, fill: i === 2 ? '#24323b' : C.box, stroke: C.line }), txt(284, 81 + i * 26, c, 'co-s', 'start', { fill: C.white }), txt(458, 81 + i * 26, t, 'co-s', 'end')));
  f.append(box(330, 172, 80, 18, C.green), txt(370, 185, 'Go', 'co-s', 'middle', { fill: C.green }));
  // les presets
  f.append(box(510, 36, 200, 92, C.violet), txt(610, 56, 'Presets', 'co-t'), txt(522, 76, '2.1 Cyclo · 2.2 Bureau', 'co-s', 'start'), txt(522, 94, '3.2 Gobo 2', 'co-s', 'start'), txt(522, 112, '4.3 Bleu · 4.4 Ambre', 'co-s', 'start'));
  f.append(arrow(466, 129, 512, 112, C.violet, '4 3'), txt(493, 104, 'renvoi', 'co-s'));
  // le tracking
  const x0 = 510, y0 = 150;
  f.append(txt(x0, y0, 'blanc : enregistré · gris : suivi', 'co-s', 'start'));
  ['', 'Cue 1', 'Cue 2', 'Cue 3'].forEach((h, i) => f.append(txt(x0 + 50 + i * 50 - 25, y0 + 20, h, 'co-s')));
  const L = [{ Face: true, Contre: true }, { Contre: true }, { Face: true }];
  ['Face', 'Contre'].forEach((nom, r) => {
    f.append(txt(x0, y0 + 42 + r * 22, nom, 'co-s', 'start'));
    ex.forEach((st, k) => f.append(txt(x0 + 75 + k * 50, y0 + 42 + r * 22, String(st[nom].DIM), 'co-s', 'middle', { fill: L[k][nom] ? C.white : C.dim })));
  });
  // les exécuteurs
  f.append(box(10, 160, 200, 104, C.grey), txt(110, 180, 'Exécuteurs, en pages', 'co-t'), txt(22, 200, 'fader : une séquence, un groupe', 'co-s', 'start'), txt(22, 218, 'un chaser (pas en boucle, BPM)', 'co-s', 'start'), txt(22, 236, 'Update : retouche une cue', 'co-s', 'start'), txt(22, 254, 'Backup : sauvegarder le show', 'co-s', 'start'));
  f.append(txt(266, 222, 'Tracking : une cue garde ce qui change.', 'co-s', 'start'), txt(266, 240, 'Cue Only : la retouche reste dans sa cue.', 'co-s', 'start'), txt(266, 258, 'Go : la cue suivante, avec ses temps.', 'co-s', 'start'));
  return f;
}
const FIX = [['Face', 'la face'], ['Contre', 'le contre'], ['Decor', 'le décor'], ['Lyre', 'la lyre']];
/** la conduite d'exemple de la manipulation : quatre cues, les intensités en % */
const CONDUITE = [
  { no: 1, values: { Face: { DIM: 80 }, Contre: { DIM: 60 }, Decor: { DIM: 40 } } },
  { no: 2, values: { Face: { DIM: 100 }, Lyre: { DIM: 70 } } },
  { no: 3, values: { Contre: { DIM: 30 } } },
  { no: 4, values: { Decor: { DIM: 0 }, Lyre: { DIM: 0 } } },
];
function demoConsole(host) {
  let f = 'Face', v = 60, cueOnly = false;
  const tbl = el('table', { class: 'co-table', 'aria-label': 'Ce qui sort à chaque cue' });
  const read = readout(['Commande', 'À la cue 3', 'À la cue 4', 'Ce que garde la cue 2']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const avant = suivre(CONDUITE), L = modifier(CONDUITE, 1, f, 'DIM', v, cueOnly), apres = suivre(L);
    const val = (st, x) => (st[x] && st[x].DIM !== undefined ? st[x].DIM : null);
    const dur = (k, x) => !!(L[k].values[x] && L[k].values[x].DIM !== undefined);
    tbl.replaceChildren(
      el('thead', {}, el('tr', {}, el('th', {}, 'Projecteur'), ...L.map((c) => el('th', {}, `Cue ${c.no}`)))),
      el('tbody', {}, ...FIX.map(([x, nom]) => el('tr', {}, el('th', {}, nom), ...L.map((_, k) => {
        const a = val(avant[k], x), b = val(apres[k], x), s = (z) => (z === null ? '—' : `${z} %`);
        const t = a === b ? s(b) : `${s(a)} → ${s(b)}`;
        return el('td', { style: dur(k, x) ? 'font-weight: 700' : 'opacity: 0.6', title: dur(k, x) ? 'valeur enregistrée dans cette cue' : 'valeur suivie de la cue précédente' }, t);
      })))));
    const ch = (k) => { const a = val(avant[k], f), b = val(apres[k], f); return a === b ? `rien ne change (${a === null ? 'pas encore appelé' : a + ' %'})` : `${FIX.find((z) => z[0] === f)[1]} passe de ${a === null ? '—' : a + ' %'} à ${b} %`; };
    read.set('Commande', `Fixture ${FIX.findIndex((z) => z[0] === f) + 1} At ${v}, Update Cue 2${cueOnly ? ' en Cue Only' : ' (tracking)'}`);
    read.set('À la cue 3', ch(2));
    read.set('À la cue 4', ch(3));
    read.set('Ce que garde la cue 2', Object.entries(L[1].values).map(([x, a]) => `${FIX.find((z) => z[0] === x)[1]} ${a.DIM} %`).join(', '));
    const bouge = [2, 3].filter((k) => val(avant[k], f) !== val(apres[k], f));
    const stop = [2, 3].find((k) => CONDUITE[k].values[f]);
    verdict.className = 'co-verdict ' + (cueOnly ? 'ok' : bouge.length ? 'warn' : 'ok');
    const nomF = FIX.find((z) => z[0] === f)[1], ancien = val(avant[1], f);
    verdict.textContent = cueOnly
      ? CONDUITE[2].values[f] ? `Cue Only : la retouche reste dans la cue 2 ; la cue 3 enregistre déjà ${nomF}, la suite ne bouge pas.` : `Cue Only : la retouche reste dans la cue 2. La console a écrit l'ancienne valeur (${ancien} %) dans la cue 3, pour que la suite reste comme avant.`
      : bouge.length ? `Tracking : la nouvelle valeur se propage à la cue ${bouge.map((k) => k + 1).join(' et à la cue ')}${stop !== undefined ? `, et s'arrête à la cue ${stop + 1}, qui enregistre ${FIX.find((z) => z[0] === f)[1]}` : ', jusqu\'au bout de la séquence'}.`
        : `Tracking : la cue 3 enregistre déjà ${FIX.find((z) => z[0] === f)[1]} : la retouche s'arrête là, rien ne change après la cue 2.`;
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Projecteur retouché dans la cue 2', FIX.map(([x, nom]) => [x, nom]), f, (x) => { f = x; draw(); }),
      slider('Nouvelle valeur', 0, 100, v, 5, (x) => { v = x; draw(); }, (x) => `${x} %`),
      choice('Enregistrement', [['track', 'en tracking'], ['only', 'en Cue Only']], 'track', (x) => { cueOnly = x === 'only'; draw(); })),
    el('p', { class: 'co-note' }, 'En gras, la valeur enregistrée dans la cue ; en clair, la valeur suivie. « avant → après » : ce que la retouche a changé.'),
    tbl, verdict, read.el);
  draw();
}

// ======================================================================================
// 4. Les lyres : pan, tilt, 16 bits, roues et effets
// ======================================================================================
function figLyres() {
  const course = /** @type {[number, number]} */ (LYRES['gen-spot'].pan), P = pas(course), T = pas(/** @type {[number, number]} */ (LYRES['gen-spot'].tilt));
  const e8 = ecartTache(P.huit, 20), e16 = ecartTache(P.seize, 20);
  const f = figure(720, 270, `Une lyre vue de face : le pan tourne la lyre autour de sa base sur ${course[1] - course[0]}°, le tilt incline la tête sur ${LYRES['gen-spot'].tilt[1] - LYRES['gen-spot'].tilt[0]}°. Sur 8 bits, un pas de pan vaut ${fmtNum(P.huit, 2)}° (de tilt, ${fmtNum(T.huit, 2)}°) : à 20 m, la tache saute de ${fmtNum(e8 * 100, 0)} cm. Sur 16 bits (deux canaux, grossier puis fin), le pas tombe à ${fmtNum(P.seize, 4)}° : ${fmtNum(e16 * 1000, 1)} mm à 20 m. À droite, les formes d'un effet de position quand pan et tilt suivent des sinus de même vitesse : déphasés de 0°, une droite ; de 45°, une ellipse ; de 90°, un cercle ; tilt deux fois plus vite et sans déphasage, un huit.`);
  f.append(txt(10, 16, 'Pan, tilt, et la précision qu\'il faut à 20 m', 'co-t', 'start'));
  // la lyre
  const cx = 110, cy = 150;
  f.append(sv('rect', { x: cx - 50, y: cy + 50, width: 100, height: 26, rx: 4, fill: C.box, stroke: C.grey }), txt(cx, cy + 68, 'base', 'co-s'));
  f.append(sv('path', { d: `M${cx - 40} ${cy + 50} L${cx - 40} ${cy - 10} M${cx + 40} ${cy + 50} L${cx + 40} ${cy - 10}`, stroke: C.grey, strokeWidth: 6, fill: 'none' }), sv('line', { x1: cx - 40, y1: cy + 46, x2: cx + 40, y2: cy + 46, stroke: C.grey, strokeWidth: 6 }));
  f.append(sv('rect', { x: cx - 28, y: cy - 34, width: 56, height: 48, rx: 10, fill: '#24323b', stroke: C.white }), sv('circle', { cx, cy: cy - 34, r: 12, fill: C.amber }), sv('path', { d: `M${cx - 14} ${cy - 40} L${cx - 34} ${cy - 110} L${cx + 34} ${cy - 110} L${cx + 14} ${cy - 40} Z`, fill: C.amber, 'fill-opacity': 0.18 }));
  f.append(sv('path', { d: `M${cx - 70} ${cy + 88} A 70 14 0 1 0 ${cx + 70} ${cy + 88}`, fill: 'none', stroke: C.cyan, strokeWidth: 1.6 }), arrow(cx + 66, cy + 92, cx + 70, cy + 88, C.cyan), txt(cx, cy + 116, `pan ${course[1] - course[0]}°`, 'co-s', 'middle', { fill: C.cyan }));
  f.append(sv('path', { d: `M${cx + 60} ${cy - 50} A 50 50 0 0 1 ${cx + 60} ${cy + 30}`, fill: 'none', stroke: C.green, strokeWidth: 1.6 }), arrow(cx + 62, cy + 24, cx + 60, cy + 30, C.green), txt(cx + 72, cy - 6, `tilt ${LYRES['gen-spot'].tilt[1] - LYRES['gen-spot'].tilt[0]}°`, 'co-s', 'start', { fill: C.green }));
  // 8 et 16 bits
  f.append(box(250, 40, 210, 200, C.grey), txt(355, 60, 'Un pas de pan à 20 m', 'co-t'));
  f.append(txt(262, 86, `8 bits : 540 ÷ 255 = ${fmtNum(P.huit, 2)}°`, 'co-s', 'start', { fill: C.amber }), txt(262, 104, `la tache saute de ${fmtNum(e8 * 100, 0)} cm`, 'co-s', 'start'));
  for (let k = 0; k < 4; k++) f.append(sv('circle', { cx: 290 + k * 42, cy: 132, r: 14, fill: C.amber, 'fill-opacity': 0.25, stroke: C.amber }));
  f.append(txt(262, 172, `16 bits : 540 ÷ 65 535 = ${fmtNum(P.seize, 4)}°`, 'co-s', 'start', { fill: C.cyan }), txt(262, 190, `la tache avance de ${fmtNum(e16 * 1000, 1)} mm`, 'co-s', 'start'));
  f.append(sv('rect', { x: 290, y: 204, width: 130, height: 10, rx: 5, fill: C.cyan, 'fill-opacity': 0.4 }), txt(262, 232, 'deux canaux : grossier puis fin', 'co-s', 'start'));
  // les formes
  const formes = [[0, 1], [45, 1], [90, 1], [0, 2]];
  formes.forEach(([d, m], i) => {
    const ox = 520 + (i % 2) * 100, oy = 92 + Math.floor(i / 2) * 104, pts = trajectoire(d, m, 1, 1, 80);
    f.append(sv('rect', { x: ox - 42, y: oy - 42, width: 84, height: 84, rx: 4, fill: C.box, stroke: C.line }));
    f.append(sv('path', { d: pts.map(([x, y], k) => `${k ? 'L' : 'M'}${(ox + x * 34).toFixed(1)} ${(oy - y * 34).toFixed(1)}`).join(''), fill: 'none', stroke: C.amber, strokeWidth: 1.6 }));
    f.append(txt(ox, oy + 56, `${formeEffet(d, m)} · ${d}°${m > 1 ? ', tilt × 2' : ''}`, 'co-s'));
  });
  f.append(txt(570, 34, 'Un effet : pan et tilt en sinus', 'co-t'));
  return f;
}
/** le nom de la forme tracée ; pour un tilt deux fois plus rapide, le huit demande un déphasage de 0° ou 180° (à 90°, il se referme en arc) */
function nomForme(dph, mult, ap, at) {
  const f = formeEffet(dph, mult), d = ((dph % 180) + 180) % 180;
  if (f === 'huit') return d < 10 || d > 170 ? 'huit' : Math.abs(d - 90) <= 10 ? 'arc : à 90°, le huit se referme (un huit demande 0° ou 180°)' : 'huit déformé (symétrique à 0° ou 180°)';
  if (f === 'cercle' && ap !== at) return 'ellipse (un cercle étiré : amplitudes différentes)';
  return f;
}
function demoLyres(host) {
  let pan = 37.4, tilt = -20, dist = 20, dph = 90, mult = 1, ap = 40, at = 40, bpm = 30, n = 4;
  const course = /** @type {[number, number]} */ (LYRES['gen-spot'].pan), courseT = /** @type {[number, number]} */ (LYRES['gen-spot'].tilt);
  const read = readout(['Pan sur 8 bits', 'Pan sur 16 bits', 'Tilt sur 8 bits', 'Tilt sur 16 bits', 'Pas de pan', 'Erreur de la tache à cette distance']);
  const read2 = readout(['Forme', 'Durée d\'un tour', 'Phases des lyres', 'Largeur balayée']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 250, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const huit = (d, c) => { const v8 = Math.round(Math.min(1, Math.max(0, versV(d, c))) * 255); return { v8, deg: versDeg(v8 / 255, c) }; };
  const draw = () => {
    const P8 = huit(pan, course), T8 = huit(tilt, courseT), P16 = position16(pan, course), T16 = position16(tilt, courseT), Pp = pas(course);
    const err8 = Math.abs(P8.deg - pan), err16 = Math.abs(versDeg(P16.v16 / 65535, course) - pan);
    read.set('Pan sur 8 bits', `${P8.v8} sur 255 → ${deg(P8.deg, 2)} (écart ${deg(err8, 2)})`);
    read.set('Pan sur 16 bits', `${fmtNum(P16.v16)} : grossier ${P16.grossier}, fin ${P16.fin} (écart ${deg(err16, 4)})`);
    read.set('Tilt sur 8 bits', `${T8.v8} sur 255 → ${deg(T8.deg, 2)}`);
    read.set('Tilt sur 16 bits', `${fmtNum(T16.v16)} : grossier ${T16.grossier}, fin ${T16.fin}`);
    read.set('Pas de pan', `${fmtNum(Pp.huit, 2)}° sur 8 bits, ${fmtNum(Pp.seize, 4)}° sur 16 bits`);
    const e8 = ecartTache(err8, dist), s8 = ecartTache(Pp.huit, dist), s16 = ecartTache(Pp.seize, dist);
    read.set('Erreur de la tache à cette distance', `${fmtNum(e8 * 100, 1)} cm ici ; un pas : ${fmtNum(s8 * 100, 0)} cm sur 8 bits, ${fmtNum(s16 * 1000, 1)} mm sur 16 bits`);
    verdict.className = 'co-verdict ' + (s8 > 0.3 ? 'ko' : s8 > 0.1 ? 'warn' : 'ok');
    verdict.textContent = s8 > 0.3 ? `À ${dist} m, un pas de 8 bits déplace la tache de ${fmtNum(s8 * 100, 0)} cm : impossible de viser un pupitre ou un visage, et un mouvement lent avance par sauts. Le 16 bits est indispensable.` : s8 > 0.1 ? `À ${dist} m, un pas de 8 bits fait encore ${fmtNum(s8 * 100, 0)} cm : visible sur un gros plan. Le 16 bits reste préférable.` : `À ${dist} m, un pas de 8 bits fait ${fmtNum(s8 * 100, 0)} cm : acceptable pour une tache large, pas pour un mouvement lent.`;
    // l'effet
    read2.set('Forme', nomForme(dph, mult, ap, at));
    read2.set('Durée d\'un tour', `${fmtNum(tourEffet(bpm), 2)} s à ${bpm} BPM (60 ÷ ${bpm})`);
    const ph = phases(n);
    read2.set('Phases des lyres', ph.map((p) => `${fmtNum(p, p % 1 ? 1 : 0)}°`).join(', '));
    read2.set('Largeur balayée', `pan ± ${ap}°, tilt ± ${at}° ; à ${dist} m, environ ${fmtNum(2 * dist * Math.tan(Math.min(ap, 80) * Math.PI / 180), 1)} m de large`);
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 250); g.font = '11px Arial, sans-serif';
    const N = 120, pts = trajectoire(dph, mult, ap, at, N), cx = 130, cy = 130, R = 100 / 60;
    g.strokeStyle = C.line; g.strokeRect(cx - 105, cy - 105, 210, 210);
    g.beginPath(); g.moveTo(cx - 105, cy); g.lineTo(cx + 105, cy); g.moveTo(cx, cy - 105); g.lineTo(cx, cy + 105); g.stroke();
    g.strokeStyle = C.amber; g.lineWidth = 1.8; g.beginPath(); pts.forEach(([x, y], k) => g[k ? 'lineTo' : 'moveTo'](cx + x * R, cy - y * R)); g.stroke(); g.lineWidth = 1;
    ph.forEach((p, k) => { const [x, y] = pts[Math.round(p / 360 * N) % N]; g.fillStyle = k ? C.cyan : C.white; g.beginPath(); g.arc(cx + x * R, cy - y * R, 5, 0, 7); g.fill(); });
    g.fillStyle = C.soft; g.fillText('la tache vue de face (pan →, tilt ↑)', cx - 100, 14); g.fillText(`blanc : lyre 1 ; bleu : les autres, décalées`, cx - 100, 246);
    // pan et tilt dans le temps
    const X0 = 280, W = 420, Y = (v, base) => base - v / 60 * 40;
    g.fillStyle = C.soft; g.fillText(`pan (ambre) et tilt (bleu) sur un tour : ${fmtNum(tourEffet(bpm), 2)} s`, X0, 14);
    for (const [base, idx, col] of [[80, 0, C.amber], [180, 1, C.cyan]]) {
      g.strokeStyle = C.line; g.beginPath(); g.moveTo(X0, /** @type {number} */ (base)); g.lineTo(X0 + W, /** @type {number} */ (base)); g.stroke();
      g.strokeStyle = /** @type {string} */ (col); g.lineWidth = 1.6; g.beginPath(); pts.forEach((p, k) => g[k ? 'lineTo' : 'moveTo'](X0 + k / N * W, Y(p[/** @type {number} */ (idx)], /** @type {number} */ (base)))); g.stroke(); g.lineWidth = 1;
    }
    g.fillStyle = C.dim; g.fillText('0 s', X0, 236); g.fillText(`${fmtNum(tourEffet(bpm), 2)} s`, X0 + W - 30, 236); g.fillText(`déphasage ${dph}°${mult > 1 ? ', tilt × 2' : ''}`, X0 + 150, 236);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Pan', course[0], course[1], pan, 0.1, (v) => { pan = v; draw(); }, (v) => deg(v)),
      slider('Tilt', courseT[0], courseT[1], tilt, 0.1, (v) => { tilt = v; draw(); }, (v) => deg(v)),
      slider('Distance de la cible', 2, 40, dist, 1, (v) => { dist = v; draw(); }, (v) => `${v} m`)),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      slider('Déphasage du tilt', 0, 180, dph, 5, (v) => { dph = v; draw(); }, (v) => `${v}°`),
      choice('Vitesse du tilt', [['1', 'comme le pan'], ['2', 'deux fois plus vite']], '1', (v) => { mult = +v; draw(); }),
      slider('Amplitude du pan', 5, 60, ap, 1, (v) => { ap = v; draw(); }, (v) => `± ${v}°`),
      slider('Amplitude du tilt', 5, 60, at, 1, (v) => { at = v; draw(); }, (v) => `± ${v}°`),
      slider('Vitesse de l\'effet', 6, 180, bpm, 1, (v) => { bpm = v; draw(); }, (v) => `${v} BPM`),
      slider('Lyres dans la vague', 1, 8, n, 1, (v) => { n = v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À gauche, la trajectoire de la tache et la place de chaque lyre quand la phase est répartie ; à droite, le pan et le tilt dans le temps. Deux sinus de même vitesse : le déphasage fait la forme.')),
    read2.el);
  draw();
}

// ======================================================================================
// 5. La lumière sur le réseau : Art-Net et sACN
// ======================================================================================
function figReseau() {
  const ex = versPortAddress(18), d = debitArtnet(44);
  const f = figure(720, 290, `La lumière sur un réseau Ethernet séparé (un VLAN lumière). La console, en 2.0.0.10 masque 255.0.0.0, envoie ses univers à un switch ; deux nœuds, en 2.0.0.21 et 2.0.0.22, refont chacun des lignes DMX vers les projecteurs. En Art-Net 4, UDP port ${ARTNET.port}, les paquets vont directement aux nœuds abonnés (ou en diffusion) ; l'univers est un Port-Address de 15 bits : Net sur 7 bits, Sub-Net sur 4, Universe sur 4. L'univers 18 de la console, compté à partir de 1, part en Port-Address ${ex.pa} : Net ${ex.net}, Sub-Net ${ex.sub}, Universe ${ex.uni}. En sACN (ANSI E1.31), UDP port ${SACN.port}, chaque univers part en multicast vers 239.255 suivi de son numéro sur deux octets (univers 1 : ${sacnMulticast(1)}) ; le switch, avec l'IGMP snooping, ne l'envoie qu'aux nœuds abonnés. Un univers à 44 trames par seconde fait environ ${fmtNum(d.kbps, 0)} kbit/s.`);
  f.append(txt(10, 16, 'Des univers dans des paquets UDP, sur un réseau à part', 'co-t', 'start'));
  f.append(box(10, 60, 120, 56, C.amber), txt(70, 80, 'Console', 'co-t'), txt(70, 96, '2.0.0.10', 'co-s'), txt(70, 110, '255.0.0.0', 'co-s'));
  f.append(ligne(130, 88, 230, 88, C.white, 2), box(230, 64, 120, 48, C.grey), txt(290, 84, 'Switch', 'co-t'), txt(290, 100, 'VLAN lumière', 'co-s'));
  const nds = [{ y: 40, ip: '2.0.0.21', u: 'PA 0 et 1' }, { y: 120, ip: '2.0.0.22', u: 'PA 2 et 3' }];
  for (const nd of nds) {
    f.append(ligne(350, 88, 420, nd.y + 22, C.white, 2), box(420, nd.y, 120, 46, C.cyan), txt(480, nd.y + 18, `Nœud ${nd.ip}`, 'co-s'), txt(480, nd.y + 34, nd.u, 'co-s'));
    f.append(arrow(540, nd.y + 14, 590, nd.y + 14, C.grey), arrow(540, nd.y + 30, 590, nd.y + 30, C.grey), txt(596, nd.y + 18, 'ligne DMX', 'co-s', 'start'), txt(596, nd.y + 34, 'ligne DMX', 'co-s', 'start'));
  }
  f.append(txt(140, 136, `Art-Net 4 : UDP ${ARTNET.port}, vers les nœuds abonnés`, 'co-s', 'start', { fill: C.amber }), txt(140, 152, `sACN : UDP ${SACN.port}, multicast, IGMP snooping`, 'co-s', 'start', { fill: C.cyan }));
  // le Port-Address
  const y = 182, x0 = 20, bw = 22;
  f.append(txt(x0, y - 10, `Le Port-Address d'Art-Net (15 bits) : l'univers 18 de la console part en ${ex.pa} = Net ${ex.net} · Sub-Net ${ex.sub} · Universe ${ex.uni}`, 'co-s', 'start'));
  const bits = ex.pa.toString(2).padStart(15, '0');
  for (let k = 0; k < 15; k++) {
    const col = k < 7 ? C.violet : k < 11 ? C.green : C.amber;
    f.append(sv('rect', { x: x0 + k * bw, y, width: bw - 2, height: 22, rx: 2, fill: C.box, stroke: col }), txt(x0 + k * bw + 10, y + 15, bits[k], 'co-s', 'middle', { fill: col }));
  }
  f.append(txt(x0 + 3.5 * bw, y + 38, 'Net (7 bits, 0 à 127)', 'co-s', 'middle', { fill: C.violet }), txt(x0 + 9 * bw, y + 38, 'Sub-Net (4)', 'co-s', 'middle', { fill: C.green }), txt(x0 + 13 * bw, y + 38, 'Universe (4)', 'co-s', 'middle', { fill: C.amber }));
  // sACN et débit
  f.append(box(370, 184, 340, 100, C.grey), txt(540, 202, 'sACN : un groupe multicast par univers', 'co-t'));
  f.append(txt(382, 220, `univers 1 → ${sacnMulticast(1)} ; 300 → ${sacnMulticast(300)}`, 'co-s', 'start'), txt(382, 238, 'priorité 0 à 200 (défaut 100) : la plus haute gagne', 'co-s', 'start'), txt(382, 256, `un univers à 44 trames/s ≈ ${fmtNum(d.kbps, 0)} kbit/s (${d.octets} octets)`, 'co-s', 'start'), txt(382, 274, `64 univers ≈ ${fmtNum(debitUnivers(64) / 1000, 1)} Mbit/s`, 'co-s', 'start'));
  f.append(txt(x0, 276, 'Adresses d\'usine : 2.x.x.x ou 10.x.x.x en /8', 'co-s', 'start'));
  return f;
}
function demoReseau(host) {
  const S = { cIp: '2.0.0.10', cMasque: '255.0.0.0', cProto: 'artnet', univ: 1, nIp: '2.0.0.21', nMasque: '255.0.0.0', nProto: 'artnet', net: 0, sub: 0, uni: 1, sacn: 1, nU: 16 };
  const champ = (lab, k) => {
    const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'text', class: 'co-input', value: S[k], spellcheck: 'false', inputmode: 'decimal', 'aria-label': lab }));
    inp.addEventListener('input', () => { S[k] = inp.value.trim(); draw(); });
    return el('label', { class: 'co-field' }, el('span', {}, lab), inp);
  };
  const read = readout(['La console envoie', 'Le nœud écoute', 'Adresse multicast sACN de cet univers', 'Port UDP']);
  const read2 = readout(['Débit de ces univers', 'Sur un lien à 100 Mbit/s', 'Sur un lien à 1 Gbit/s']);
  const verdict = el('p', { class: 'co-verdict' });
  const pbs = el('ol', { class: 'co-trace' });
  const draw = () => {
    const Lk = liaison({ ip: S.cIp, masque: S.cMasque, protocole: /** @type {'artnet' | 'sacn'} */ (S.cProto), univers: S.univ }, { ip: S.nIp, masque: S.nMasque, protocole: /** @type {'artnet' | 'sacn'} */ (S.nProto), net: S.net, sub: S.sub, uni: S.uni, sacn: S.sacn });
    const pa = versPortAddress(S.univ);
    read.set('La console envoie', S.cProto === 'artnet' ? `univers ${S.univ} → Port-Address ${pa.pa} (Net ${pa.net}, Sub-Net ${pa.sub}, Universe ${pa.uni})` : `univers sACN ${S.univ}, priorité 100`);
    read.set('Le nœud écoute', S.nProto === 'artnet' ? `Port-Address ${portAddress(S.net, S.sub, S.uni)} (Net ${S.net}, Sub-Net ${S.sub}, Universe ${S.uni})` : `univers sACN ${S.sacn} (${sacnMulticast(S.sacn)})`);
    read.set('Adresse multicast sACN de cet univers', `${sacnMulticast(S.univ)}${S.cProto === 'artnet' ? ' (si la console passait en sACN)' : ''}`);
    read.set('Port UDP', S.cProto === 'artnet' ? `${ARTNET.port} (Art-Net)` : `${SACN.port} (sACN)`);
    verdict.className = 'co-verdict ' + (Lk.ok ? 'ok' : 'ko');
    verdict.textContent = Lk.ok ? 'Le nœud reçoit l\'univers : même sous-réseau, même protocole, même univers.' : 'Le nœud ne reçoit rien de cet univers :';
    pbs.replaceChildren(...Lk.pb.map((p) => el('li', { class: 'ko' }, p.t)));
    const kb = debitUnivers(S.nU);
    read2.set('Débit de ces univers', `${S.nU} univers × ${fmtNum(debitArtnet(44).kbps, 1)} kbit/s = ${kb >= 1000 ? fmtNum(kb / 1000, 2) + ' Mbit/s' : fmtNum(kb, 0) + ' kbit/s'}`);
    read2.set('Sur un lien à 100 Mbit/s', `${fmtNum(kb / 1000, 1)} %${kb > 100000 ? ' : ça ne passe plus' : ''}`);
    read2.set('Sur un lien à 1 Gbit/s', `${fmtNum(kb / 10000, 2)} %`);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      champ('IP de la console', 'cIp'), champ('Masque de la console', 'cMasque'),
      choice('La console parle', [['artnet', 'Art-Net'], ['sacn', 'sACN']], S.cProto, (v) => { S.cProto = v; draw(); }),
      slider('Univers de la console (à partir de 1)', 1, 64, S.univ, 1, (v) => { S.univ = v; draw(); })),
    el('div', { class: 'co-ctl' },
      champ('IP du nœud', 'nIp'), champ('Masque du nœud', 'nMasque'),
      choice('Le nœud écoute', [['artnet', 'Art-Net'], ['sacn', 'sACN']], S.nProto, (v) => { S.nProto = v; draw(); }),
      slider('Net', 0, 127, S.net, 1, (v) => { S.net = v; draw(); }),
      slider('Sub-Net', 0, 15, S.sub, 1, (v) => { S.sub = v; draw(); }),
      slider('Universe', 0, 15, S.uni, 1, (v) => { S.uni = v; draw(); }),
      slider('Univers sACN du nœud', 1, 64, S.sacn, 1, (v) => { S.sacn = v; draw(); })),
    verdict, pbs, read.el,
    el('div', { class: 'co-ctl' },
      slider('Univers envoyés', 1, 512, S.nU, 1, (v) => { S.nU = v; draw(); })),
    read2.el);
  draw();
}

// ======================================================================================
// Les leçons
// ======================================================================================
/** @type {import('./index.js').Lesson[]} */
export const LUMIERE_COMMANDE = [
  {
    id: 'lumiere-dmx', title: 'Le DMX : univers, canaux, adresses', minutes: '8 min',
    essentials: [
      'Un **univers DMX** = **512 canaux**, chacun une valeur de **0 à 255** (8 bits), envoyés en boucle par la console à tous les appareils de la ligne.',
      'Chaque appareil lit une suite de canaux à partir de son **adresse de départ** ; leur nombre est son **empreinte**, qui dépend de son **mode**. Le suivant commence à **adresse + empreinte**.',
      'Deux appareils qui se **chevauchent** sont en **conflit** ; à la même adresse et dans le même mode, ils font la même chose. « 2.001 » : univers 2, adresse 1, soit **513** en adresse absolue.',
    ],
    figure: figDmx,
    demoTitle: 'L\'appareil D chevauche la lyre B : trouvez l\'adresse qui supprime le conflit. Passez ensuite la lyre en 24 canaux et regardez ce qu\'elle écrase. Réglez deux appareils identiques à la même adresse.',
    demo: demoDmx,
    body: `Une console d'éclairage ne parle pas à un projecteur, elle parle à une **ligne**. Le protocole **DMX512** (norme ANSI E1.11) envoie sans cesse, et à tous les appareils branchés, une suite de **512 canaux**. Chaque canal porte un nombre de **0 à 255** (un octet, 8 bits) : 0, c'est éteint ou le bas de la course ; 255, le plein. Cette suite de 512 canaux s'appelle un **univers**. Une console qui a besoin de plus de canaux sort plusieurs univers, chacun sur sa ligne ou sur le réseau.

Chaque appareil est réglé sur une **adresse de départ** (de 1 à 512) : c'est le premier canal qu'il lit. Il en lit autant qu'il a de paramètres : son **empreinte** (footprint). Un PAR LED en mode 4 canaux lit rouge, vert, bleu, blanc ; le même en mode 8 canaux ajoute une intensité générale, un stroboscope, des macros. Une lyre en lit 16 ou 24. L'empreinte dépend donc du **mode** choisi au menu de l'appareil : le mode doit être le même sur le projecteur et dans le **patch** de la console (la table qui dit quel appareil est à quelle adresse, et comment lire ses canaux).

Pour ranger les appareils sans perte, on les patche **à la suite** : le suivant commence à **adresse + empreinte**. Un PAR de 4 canaux à l'adresse 1 occupe 1 à 4 ; la lyre suivante commence à 5. Le dernier canal d'un appareil est adresse + empreinte − 1.

- Deux appareils dont les canaux se **chevauchent** sont en **conflit** : un même canal commande deux choses à la fois (l'intensité de l'un, le pan de l'autre). C'est la panne de patch la plus courante.
- Deux appareils **identiques**, même mode, **même adresse**, ne sont pas en panne : ils reçoivent les mêmes valeurs et font exactement la même chose. C'est parfois voulu (doubler une face), mais la console ne peut plus les séparer.
- Un appareil dont l'empreinte dépasse 512 perd ses derniers paramètres : on le passe dans l'univers suivant.

Une adresse s'écrit souvent **univers.adresse** : « 2.001 » est le canal 1 de l'univers 2. Certaines consoles comptent en **adresse absolue**, d'un seul tenant : (univers − 1) × 512 + adresse, soit 513 pour 2.001. Sur la console, une valeur se règle en pourcentage : 40 % donne 102 sur 255 (on arrondit 0,40 × 255). Un paramètre qui demande plus de finesse (le pan d'une lyre, une intensité très douce) prend **deux canaux** : un octet **grossier** et un octet **fin**, soit 65 536 pas (16 bits).

Sur les appareils anciens ou simples, l'adresse se règle par des **commutateurs DIP** : neuf petits interrupteurs qui valent 1, 2, 4, 8, 16, 32, 64, 128 et 256. L'adresse est la somme de ceux qui sont levés : 37 = 32 + 4 + 1.`,
    plus: `Le DMX512 date de 1986 (USITT), révisé en DMX512-A et normalisé par l'ANSI sous la référence E1.11. Le premier octet de chaque trame est un **code de début** : 0 pour des niveaux ordinaires ; d'autres codes servent à d'autres usages (le RDM utilise 0xCC).

- Un plan de feu bien tenu note, pour chaque appareil : son numéro dans la console, son type, son mode, son univers et son adresse. Au montage, c'est lui qu'on recopie sur les afficheurs.
- Laisser quelques canaux libres entre les familles d'appareils (les faces à partir de 1, les lyres à partir de 101) n'est pas une faute : cela permet d'en ajouter sans tout repatcher.
- Le Labo calcule les mêmes choses : empreintes, conflits, dernier canal, commutateurs DIP (atelier DMX et Art-Net).`,
    car: { text: 'Jouer → Le Labo, atelier DMX et Art-Net : la carte de l\'univers montre chaque canal occupé (un chevauchement en rouge), les commutateurs DIP d\'un projecteur, et un défi demande un patch à la suite. La console dot2 du Labo patche ses projecteurs sur deux univers : les faces et les découpes dans l\'univers 1, les lyres dans l\'univers 2.' },
    terms: ['dmx512', 'univers-dmx', 'adresse-dmx', 'empreinte-dmx'],
    competences: ['C25', 'C17'], savoirs: ['G5', 'C7'],
    quiz: [
      { q: 'Une lyre en mode 16 canaux est patchée à l\'adresse 101. À quelle adresse réglez-vous la lyre suivante, pour ne laisser aucun trou ?', choices: ['117', ['116', '116 est le dernier canal de la première lyre (101 + 16 − 1) : la suivante commencerait sur ce canal, et les deux seraient en conflit.'], ['102', 'Une lyre lit 16 canaux à partir de son adresse : 102 tombe en plein dans la première.']], answer: 0, why: 'Le suivant commence à adresse + empreinte : 101 + 16 = 117. La première lyre occupe les canaux 101 à 116.' },
      { q: 'Au montage, deux PAR LED identiques, en mode 4 canaux, sont réglés tous les deux à l\'adresse 1. Que voit-on à la console ?', choices: ['Ils font exactement la même chose : on ne peut pas les régler séparément', ['L\'un des deux reste éteint', 'Le DMX est envoyé à tous les appareils : chacun lit les canaux de son adresse, sans savoir qu\'un autre fait de même.'], ['La ligne DMX tombe en panne', 'Deux appareils qui lisent les mêmes canaux ne perturbent pas la ligne : c\'est une affaire de patch, pas un défaut électrique.']], answer: 0, why: 'Même adresse et même mode : les deux lisent les canaux 1 à 4 et obéissent ensemble. C\'est parfois voulu, mais si l\'on voulait deux projecteurs indépendants, il faut régler le second à 5.' },
      { q: 'Le réalisateur veut la face à 40 %. Quelle valeur DMX sort sur son canal d\'intensité ?', choices: ['102', ['40', '40 sur 255, c\'est environ 16 % : un canal compte de 0 à 255, pas de 0 à 100.'], ['400', 'Un canal tient sur 8 bits : il ne dépasse pas 255.']], answer: 0, why: '40 % de 255 = 102. La console affiche des pourcentages, la ligne transporte des octets de 0 à 255.' },
      { q: 'Le plan de feu indique « 2.001 » pour une découpe. La console compte les adresses d\'un seul tenant : que tapez-vous ?', choices: ['513', ['2001', 'Le point sépare l\'univers et l\'adresse : ce n\'est pas un nombre à virgule.'], ['1025', '1 025, c\'est 3.001 : l\'univers 2 commence juste après les 512 canaux de l\'univers 1.']], answer: 0, why: '(2 − 1) × 512 + 1 = 513 : le premier canal de l\'univers 2.' },
      { q: 'Un vieux PAR n\'a que des commutateurs DIP. Pour l\'adresse 37, lesquels levez-vous ?', choices: ['1, 4 et 32', ['3 et 7', 'Les commutateurs ne s\'écrivent pas chiffre par chiffre : chacun vaut une puissance de 2 (1, 2, 4… 256).'], ['1, 2, 4 et 32', '1 + 2 + 4 + 32 = 39, pas 37.']], answer: 0, why: '37 = 32 + 4 + 1 : on lève les commutateurs qui valent 1, 4 et 32, c\'est l\'écriture binaire de l\'adresse.' },
      { q: 'Vous passez une lyre du mode 16 canaux au mode 24 canaux, sans toucher aux adresses. L\'appareil patché juste après elle…', choices: ['se retrouve en conflit avec ses 8 nouveaux canaux', ['se décale tout seul de 8 canaux', 'Aucun appareil ne change d\'adresse seul : l\'adresse est un réglage, sur le projecteur comme dans le patch.'], ['n\'est pas concerné : seule la lyre change', 'L\'empreinte de la lyre passe de 16 à 24 canaux : elle déborde de 8 canaux sur l\'appareil suivant.']], answer: 0, why: 'Changer de mode change l\'empreinte. Il faut repatcher ce qui suit (adresse + 24), et changer le mode à la fois sur la lyre et dans le patch de la console.' },
    ],
  },
  {
    id: 'lumiere-ligne', title: 'La ligne DMX : câble, terminaison, splitter, RDM', minutes: '9 min',
    essentials: [
      'Le DMX voyage en **RS-485** : une paire **différentielle** à **250 kbit/s**, en **XLR 5 broches** (1 masse, 2 Data −, 3 Data +), sur du **câble de 120 Ω**.',
      'Une ligne va d\'appareil en appareil, **32 récepteurs** au plus, environ **300 m** (ordre de grandeur), avec une **terminaison de 120 Ω** au bout ; **jamais de Y** : un **splitter** isolé fait les branches.',
      'Une trame : **coupure**, **marque**, **code de début**, puis **44 µs par canal** : 512 canaux en **22,8 ms**, **44 trames par seconde**. Le **RDM** (ANSI E1.20) fait répondre les appareils.',
    ],
    figure: figLigne,
    demoTitle: 'La ligne de départ a trois défauts : corrigez-les un à un. Ajoutez un câble en Y, puis remplacez-le par un splitter. Baissez le nombre de canaux envoyés et regardez la cadence monter.',
    demo: demoLigne,
    body: `Le DMX512 est une **liaison série** : les canaux passent l'un après l'autre, bit après bit, à **250 kbit/s** (4 µs par bit). Le signal est **différentiel**, selon la norme électrique **RS-485** : deux fils portent le même signal en opposition (Data + et Data −) et le récepteur ne lit que leur **différence**. Un parasite qui touche les deux fils de la même façon s'annule : c'est la même idée que la liaison audio symétrique.

La connectique normalisée est le **XLR 5 broches** : **1** la masse (le blindage), **2** Data −, **3** Data +, **4** et **5** une seconde paire, prévue par la norme et peu utilisée. On croise aussi du XLR 3 broches sur du matériel bon marché, et du RJ45 dans les installations fixes. Le câble doit être un **câble DMX de 120 Ω** d'impédance caractéristique (la résistance que « voit » un signal rapide qui s'y propage). Un câble micro se ressemble mais n'est pas fait pour cela : son impédance n'est pas spécifiée, souvent loin des 120 Ω. Il dépanne sur quelques mètres, pas sur une longue ligne.

La ligne a une forme imposée : une **chaîne**. La console sort sur l'entrée du premier appareil, qui recopie le signal sur sa sortie (sans le régénérer : les deux prises sont reliées), et ainsi de suite.

- **32 récepteurs** au plus par segment : c'est la charge que l'émetteur RS-485 peut tenir (32 charges unitaires).
- Environ **300 m** de câble : c'est un ordre de grandeur, au-delà le signal s'affaiblit et ses fronts s'arrondissent.
- Une **terminaison** de **120 Ω** sur la sortie du dernier appareil (un bouchon XLR qui relie Data + et Data − par une résistance). Sans elle, le signal arrivé au bout se **réfléchit** et revient se mélanger à lui-même : les derniers appareils clignotent, décrochent, ou réagissent par moments.
- **Pas de dérivation en Y** : chaque branche aurait un bout non terminé. Pour faire plusieurs branches, un **splitter** (répartiteur) reçoit la ligne et la renvoie, régénérée et **isolée**, sur plusieurs sorties. Chaque sortie est une nouvelle ligne : 32 récepteurs, sa longueur, sa terminaison.

La **trame** se répète en boucle. Elle commence par une **coupure** (break : la ligne à 0 pendant au moins 92 µs ; 176 µs dans le Labo), puis une **marque** (la ligne au repos, 12 µs au moins), puis le **code de début** et les canaux. Chaque octet prend **11 bits** : un bit de départ à 0, les 8 bits (poids faible d'abord), deux bits d'arrêt à 1, soit **44 µs**. Avec 512 canaux : 176 + 12 + 513 × 44 = 22 760 µs, **22,8 ms** par trame, environ **44 trames par seconde**. Une console qui n'envoie que les canaux utiles raccourcit la trame et rafraîchit plus vite.

Le DMX512 ne va que dans un sens : la console ne sait pas si un appareil est là. Le **RDM** (Remote Device Management, ANSI E1.20) ajoute un dialogue **sur la même paire** : entre deux trames, la console pose une question, un appareil répond. Elle **découvre** les appareils (chacun a un identifiant unique), lit leurs réglages, leurs températures, leurs erreurs, et **règle leur adresse à distance**, sans nacelle. Le RDM demande que tout ce qui est sur le chemin laisse passer les réponses : des **splitters compatibles RDM**.`,
    plus: `La norme fixe aussi des bornes de temps à l'émission : au moins 1 204 µs d'une coupure à la suivante (une trame très courte est donc allongée), et au plus une seconde, pour qu'un récepteur sache que la ligne est vivante.

- Un appareil sans alimentation laisse en général passer le signal de son entrée à sa sortie, mais pas tous : sur une ligne qui ne marche qu'à moitié, on cherche le premier appareil qui ne réagit pas.
- Les splitters isolés protègent aussi la console : une surtension sur une branche (un câble qui touche une alimentation) ne remonte pas.
- Le testeur DMX (un petit boîtier) affiche les valeurs reçues canal par canal et la cadence des trames : c'est le premier outil du diagnostic.`,
    car: { text: 'Jouer → Le Labo, atelier DMX et Art-Net, vue de la ligne : récepteurs, longueur, terminaison, dérivation en Y et splitter ; le diagnostic est celui de cette leçon, et un défi demande de rendre une ligne fiable. Le plateau de la console dot2 est câblé par deux splitters de six sorties.' },
    terms: ['dmx512', 'terminaison-dmx', 'splitter-dmx', 'rdm'],
    competences: ['C25', 'C19', 'C36'], savoirs: ['G5', 'C7', 'L5'],
    quiz: [
      { q: 'Le dernier projecteur de la ligne clignote par moments ; les premiers sont stables. Que vérifiez-vous d\'abord ?', choices: ['La terminaison de 120 Ω au bout de la ligne', ['L\'adresse du dernier projecteur', 'Une adresse fausse donne un projecteur qui obéit aux mauvais canaux, de façon stable : pas un clignotement.'], ['La sortie de la console', 'Si la sortie était en cause, toute la ligne serait touchée, pas seulement le bout.']], answer: 0, why: 'Sans terminaison, le signal se réfléchit au bout de la ligne : ce sont les derniers appareils qui en souffrent, par moments. Un bouchon de 120 Ω sur la dernière sortie règle le problème.' },
      { q: 'Il manque un câble DMX de 40 m. Un câble micro XLR, avec ses adaptateurs, peut-il le remplacer ?', choices: ['Pour dépanner, mais ce n\'est pas un câble de 120 Ω : sur 40 m et plus, le signal risque de se déformer', ['Oui, sans réserve : c\'est le même câble', 'Les deux se ressemblent, mais le câble micro est fait pour l\'audio : son impédance n\'est pas spécifiée, souvent loin des 120 Ω.'], ['Non, le DMX demande une fibre optique', 'Le DMX512 passe sur une paire torsadée en cuivre ; la fibre ne sert qu\'avec des convertisseurs.']], answer: 0, why: 'Un câble de 120 Ω garde au signal sa forme sur la longueur. Le câble micro dépanne sur quelques mètres ; sur une longue ligne, on remplace dès que possible.' },
      { q: 'Il faut alimenter deux rangées de projecteurs, à jardin et à cour, depuis une seule sortie de console. Comment ?', choices: ['Un splitter : une sortie isolée par rangée, chacune terminée au bout', ['Un câble en Y vers les deux rangées', 'Une dérivation en Y crée deux bouts de ligne, impossibles à terminer correctement : le signal s\'y réfléchit.'], ['Deux terminaisons sur la même ligne', 'Une ligne n\'a qu\'un bout, donc une seule terminaison ; deux résistances de 120 Ω en parallèle affaiblissent le signal.']], answer: 0, why: 'Le splitter recopie la ligne, régénérée, sur plusieurs sorties isolées ; chacune est une nouvelle ligne, avec ses 32 récepteurs et sa terminaison.' },
      { q: 'Une ligne porte 45 projecteurs LED en chaîne, et les derniers décrochent. Pourquoi ?', choices: ['Au-delà de 32 récepteurs, l\'émetteur RS-485 ne tient plus le niveau', ['Un univers est limité à 32 projecteurs', 'La limite de 32 est électrique, par segment de ligne ; un univers peut commander bien plus d\'appareils, avec des splitters, tant que ses 512 canaux suffisent.'], ['Il faut ralentir la trame', 'Le débit est fixe (250 kbit/s) ; la charge électrique de la ligne ne dépend pas de la cadence.']], answer: 0, why: 'Chaque récepteur charge la ligne ; la norme RS-485 en admet 32 (charges unitaires). Un splitter partage les 45 appareils sur deux branches.' },
      { q: 'La console n\'envoie plus que 128 canaux au lieu de 512. Qu\'y gagne-t-on ?', choices: ['Des trames plus courtes : environ 170 par seconde au lieu de 44', ['Plus de débit sur le câble', 'Le débit de la ligne reste 250 kbit/s ; ce sont les trames qui raccourcissent.'], ['Des projecteurs plus précis', 'La précision tient au nombre de bits par paramètre (8 ou 16), pas au nombre de canaux envoyés.']], answer: 0, why: '176 + 12 + 129 × 44 = 5 864 µs par trame, soit environ 170 trames par seconde : un changement arrive plus vite.' },
      { q: 'Il faut changer l\'adresse d\'une lyre accrochée à 8 m, sans nacelle. Ce qui le permet :', choices: ['Le RDM, si la console, les splitters et la lyre le gèrent', ['Le DMX512 seul, en envoyant l\'adresse sur le canal 1', 'Le DMX512 va dans un seul sens et ne transporte que des niveaux : il ne règle pas d\'adresse.'], ['Une terminaison de 120 Ω', 'La terminaison adapte la ligne ; elle ne dialogue avec personne.']], answer: 0, why: 'Le RDM (ANSI E1.20) fait répondre les appareils sur la même paire : la console les découvre et règle leur adresse à distance. Un splitter ordinaire bloque les réponses.' },
    ],
  },
  {
    id: 'lumiere-console', title: 'La console : patch, groupes, presets, cues, tracking', minutes: '10 min',
    essentials: [
      'On **programme** dans le **programmeur** (une **sélection** + des **valeurs**), puis **Store** enregistre une **cue** ; une **séquence** de cues se rejoue par **Go**, avec ses fondus et son delay.',
      'Les **groupes** gardent une sélection, les **presets** une couleur, une position, un gobo : une cue garde un **renvoi** au preset, et **corriger le preset corrige toutes les cues**.',
      'En **tracking**, une cue n\'enregistre que **ce qui change** et une retouche **se propage** aux suivantes ; en **Cue Only**, elle reste dans sa cue.',
    ],
    figure: figConsole,
    demoTitle: 'Baissez la face dans la cue 2 en tracking : regardez les cues 3 et 4. Recommencez avec le contre, que la cue 3 enregistre, puis avec la lyre. Passez en Cue Only.',
    demo: demoConsole,
    body: `Une console d'éclairage moderne ne se règle pas canal par canal. On **patche** d'abord : on dit à la console quels appareils sont branchés, leur type, leur mode, leur univers et leur adresse. Elle sait alors qu'une lyre a un pan, un tilt, une roue de couleurs, et l'on travaille avec ces **attributs**, pas avec des numéros de canaux.

On travaille dans le **programmeur** : une **sélection** de projecteurs et les **valeurs** qu'on leur donne. Sur une console de type MA (comme la dot2 du Labo), cela s'écrit à la ligne de commande : « Fixture 3 At 80 » met le projecteur 3 à 80 %, « Group 9 At 100 » met tout le groupe 9 à fond, « Preset 4.3 » leur applique le troisième preset de couleur. Le programmeur a toujours priorité sur ce qui est joué : on le vide (Clear) quand on a fini.

- Un **groupe** garde une sélection : « les faces », « les contres », « les lyres ». Le groupe 9 du show du Labo, ce sont les quatre lyres.
- Un **preset** (une palette) garde une valeur pour des projecteurs : une couleur, une position, un gobo, un réglage de faisceau. On les range par familles (sur la console du Labo, 1 l'intensité, 2 les positions, 3 les gobos, 4 les couleurs).

**Store** enregistre le contenu du programmeur dans une **cue** : « Store Cue 3 ». Les cues se rangent dans une **séquence**, posée sur un **exécuteur** (un fader et ses touches) ; **Go** lance la cue suivante. Chaque cue a ses **temps** : un **fondu** d'entrée (ce qui monte), un fondu de sortie (ce qui descend), un **delay** (une attente avant de commencer : un fondu de 3 s avec un delay de 2 s finit 5 s après le Go). **Update** retouche la cue en cours avec ce qu'on vient de changer.

Une cue qui utilise un preset ne garde pas la valeur, elle garde un **renvoi** au preset. C'est tout l'intérêt : la présentatrice s'est décalée, on corrige la position « Bureau » une fois, et les vingt cues qui y renvoient sont justes.

Les consoles d'aujourd'hui travaillent en **tracking** : une cue n'enregistre que **ce qui change** par rapport à la précédente ; le reste **suit**. Si la cue 2 ne parle pas de la face, la face garde la valeur de la cue 1. Conséquence : retoucher une valeur dans une cue la **propage** aux cues suivantes, jusqu'à la première qui enregistre elle-même ce paramètre. C'est souvent ce qu'on veut (baisser le contre pour toute la scène) ; quand on ne veut changer qu'une cue, on enregistre en **Cue Only** : la console écrit l'ancienne valeur dans la cue suivante, pour que la suite reste comme avant.

Les **exécuteurs** sont rangés en **pages**. Un exécuteur peut porter une séquence, un **groupe** (son fader devient un master d'intensité) ou un **chaser**, une séquence qui enchaîne ses pas seule à sa vitesse : à 120 pas par minute, un chaser de 4 pas fait un tour en 2 s. Enfin, on **sauvegarde** (Backup) le show régulièrement : une journée de programmation ne se refait pas.`,
    plus: `Le tracking a un piège : sauter directement à une cue (Goto) rejoue tout ce qui la précède, et une valeur oubliée dans une cue lointaine peut réapparaître. D'où les cues **bloquées** (block), qui enregistrent toutes les valeurs en dur, en début de tableau ou de scène.

- Les macros de sélection de la console du Labo répartissent les valeurs : **MAtricks** Odd et Even (un projecteur sur deux), 1/3 (un sur trois), **Invert** (les autres), **Shuffle** (au hasard), **Circular Copy** (décaler les valeurs d'un projecteur au suivant), **Knockout** (retirer du programmeur), **Align** (étaler une valeur d'un bout à l'autre de la sélection).
- En direct, le pupitreur garde une main sur le Go et un œil sur la sortie : la console affiche la cue en cours, la suivante et les temps qui restent.`,
    car: { text: 'Jouer → Le Labo, console dot2 : le show de départ a ses projecteurs patchés, ses groupes (Group 9 : les quatre lyres) et ses presets (4.3 : bleu ; 2.2 : la position Bureau). Programmez des cues, une lyre sur deux avec les MAtricks, un chaser ; le Labo relit le show enregistré et note les défis.' },
    terms: ['cue-lumiere', 'preset-lumiere', 'tracking', 'chaser'],
    competences: ['C17', 'C31', 'C23'], savoirs: ['G5', 'G3'],
    quiz: [
      { q: 'Cue 1 : la face à 80 %. Dans la cue 2, on n\'a enregistré que les contres. Sur une console à tracking, que fait la face à la cue 2 ?', choices: ['Elle reste à 80 %', ['Elle s\'éteint', 'En tracking, une valeur reste jusqu\'à ce qu\'une cue la change ; la cue 2 ne parle pas de la face.'], ['Elle reprend la valeur du programmeur', 'Le programmeur sert à préparer ; en lecture, ce sont les cues qui commandent.']], answer: 0, why: 'La cue 2 n\'enregistre que ce qui change (les contres) ; la face suit la cue 1 à 80 %.' },
      { q: 'La présentatrice s\'est décalée d\'un mètre. Ses lyres vont sur la position « Bureau » (Preset 2.2), utilisée dans 25 cues. Le plus sûr :', choices: ['Corriger le preset 2.2, une seule fois', ['Reprendre les 25 cues une à une', 'Les cues gardent un renvoi au preset : corriger le preset les corrige toutes, sans risque d\'en oublier une.'], ['Ajouter une cue de position à la fin', 'Une cue de plus ne corrige pas les autres : les 25 cues renverraient toujours à l\'ancienne position.']], answer: 0, why: 'C\'est la raison d\'être des presets : les cues y renvoient, une correction du preset se retrouve partout.' },
      { q: 'En répétition, vous baissez le contre dans la cue 5, en tracking. Les cues 6 à 9 n\'enregistrent pas le contre. Il…', choices: ['baisse aussi dans les cues 6 à 9', ['ne change pas après la cue 5', 'C\'est ce que donnerait un enregistrement en Cue Only ; en tracking, les cues suivantes reprennent la valeur tant qu\'elles ne la changent pas.'], ['s\'éteint dans les cues 6 à 9', 'La retouche donne une nouvelle valeur ; elle n\'éteint rien.']], answer: 0, why: 'En tracking, la nouvelle valeur se propage jusqu\'à la première cue qui enregistre le contre elle-même.' },
      { q: 'Vous voulez retoucher une seule cue, sans rien changer à la suite de la conduite. Vous enregistrez…', choices: ['en Cue Only', ['en tracking', 'Le tracking propage la retouche aux cues suivantes.'], ['avec un delay', 'Le delay est une attente avant le fondu, pas une façon d\'enregistrer.']], answer: 0, why: 'En Cue Only, la console écrit l\'ancienne valeur dans la cue suivante : la retouche reste dans sa cue.' },
      { q: 'Une cue a un fondu d\'entrée de 3 s et un delay de 2 s. Après Go, quand le projecteur atteint-il son niveau ?', choices: ['5 s après le Go', ['3 s après le Go', 'Le delay retarde le début du fondu : 2 s d\'attente, puis 3 s de fondu.'], ['2 s après le Go', 'Au bout de 2 s, le fondu ne fait que commencer.']], answer: 0, why: 'Le delay (2 s) précède le fondu (3 s) : le niveau est atteint 5 s après le Go.' },
      { q: 'Quatre couleurs doivent défiler toutes seules, au rythme de la musique : 120 battements par minute, une couleur par battement. Vous programmez…', choices: ['un chaser de 4 pas à 120 BPM, qui fait un tour en 2 s', ['quatre cues lancées par Go à la main', 'C\'est possible, mais il faut tenir le tempo au doigt pendant tout le morceau : un chaser enchaîne seul, à sa vitesse.'], ['un preset de couleur', 'Un preset garde une couleur ; il ne fait rien défiler.']], answer: 0, why: `Un chaser enchaîne ses pas à sa vitesse : 4 pas à 120 par minute font un tour en ${fmtNum(tourChaser(120, 4))} s.` },
    ],
  },
  {
    id: 'lumiere-lyres', title: 'Les lyres : pan, tilt, 16 bits, roues et effets', minutes: '10 min',
    essentials: [
      'Une **lyre** oriente son faisceau par le **pan** (environ **540°**) et le **tilt** (environ **270°**). Sur 8 bits, un pas de pan fait **2,1°** : à 20 m, la tache saute de plus de **70 cm**. D\'où le **16 bits** (grossier + fin) : moins d\'**un centième de degré**.',
      'Une **spot** a des **roues** de couleurs et de **gobos** (filtres et motifs fixes) ; une **wash** mélange ses couleurs (**CMY** ou LED **RGBW**).',
      'Un **effet** de position : pan et tilt en **sinus** de même vitesse ; **90°** de déphasage → **cercle**, **0°** → **droite** ; tilt **deux fois plus vite**, sans déphasage → **huit**. La **phase répartie** entre les lyres fait une **vague**.',
    ],
    figure: figLyres,
    demoTitle: 'Réglez une distance de 30 m et lisez le pas de 8 bits. Mettez le déphasage à 0°, 45° puis 90° ; passez le tilt deux fois plus vite. Répartissez l\'effet sur huit lyres.',
    demo: demoLyres,
    body: `Une **lyre** (ou projecteur asservi, moving head) est un projecteur motorisé : une base, une fourche qui tourne, une tête qui s'incline. Deux moteurs l'orientent. Le **pan** fait tourner la fourche autour de la base, sur environ **540°** (un tour et demi : on peut atteindre n'importe quel cap par deux chemins). Le **tilt** incline la tête, sur environ **270°**. Ce sont les courses des lyres de la console du Labo ; chaque modèle a les siennes, écrites dans sa fiche.

Sur **8 bits**, un canal a 256 valeurs, soit 255 pas : 540° ÷ 255 = **2,1° par pas** de pan. À 20 m, un pas déplace la tache de 20 × tan 2,1° ≈ **0,74 m** : impossible de viser un pupitre, et un mouvement lent avance par à-coups. Les lyres envoient donc pan et tilt sur **16 bits**, sur deux canaux consécutifs : l'octet **grossier** puis l'octet **fin** (valeur = grossier × 256 + fin, de 0 à 65 535). Le pas tombe à 540° ÷ 65 535 ≈ **0,008°**, moins de 3 mm à 20 m. Une lyre en mode 16 bits a donc une empreinte plus grande : c'est le « Pan fin » et le « Tilt fin » de son mode.

On distingue deux familles :

- La **spot** donne un faisceau net, qu'on peut mettre au point : elle porte une **roue de couleurs** (des filtres fixes, choisis par plages de valeurs DMX) et une **roue de gobos** (des disques ajourés qui projettent un motif, souvent tournants), un **iris**, un **prisme**, un **zoom**. Une roue tourne d'un filtre à l'autre : un fondu de couleur passe par les filtres intermédiaires. On change donc de couleur faisceau fermé, ou en un temps nul.
- La **wash** donne une lumière douce et large ; elle **mélange** ses couleurs, en soustractif (**CMY** : cyan, magenta, jaune devant une lampe blanche) ou en additif (LED **RGBW** : rouge, vert, bleu, blanc). Le mélange permet des fondus propres d'une couleur à l'autre.

Les **effets** de position font bouger les lyres sans programmer chaque pas : la console fait suivre au pan et au tilt une forme (souvent un **sinus**) autour de la position de base, avec une **amplitude**, une **vitesse** (en battements par minute : à 30 BPM, un tour toutes les 2 s) et une **phase**.

- Pan et tilt de même vitesse, **déphasés de 90°** et de même amplitude : la tache décrit un **cercle**.
- Déphasés de **0°** ou **180°** : ils montent et descendent ensemble, la tache va et vient sur une **droite**.
- Entre les deux : une **ellipse**. Tilt **deux fois plus vite** que le pan, sans déphasage : un **huit** (déphasé de 90°, il se referme en arc).

Sur plusieurs lyres, la **phase** se répartit : avec huit lyres, 0°, 45°, 90°… chacune décalée de la précédente. Les taches ne bougent plus à l'unisson, elles font une **vague**. Les macros de sélection aident à composer : **MAtricks** Odd et Even prennent une lyre sur deux (une couleur pour les unes, une autre pour les autres), 1/3 une sur trois.`,
    plus: `Une lyre retourne parfois brutalement à 0° au lieu de continuer : son pan a atteint une butée. Les 540° servent à éviter ces retours ; certaines consoles choisissent le chemin le plus court entre deux positions.

- Un mouvement trop rapide fait sauter la tache à l'image : à l'antenne, on préfère des mouvements lents, en 16 bits, et des effets de faible amplitude.
- Le temps de mouvement se règle à part du fondu d'intensité : une cue peut allumer en 0 s et déplacer en 4 s.
- Les positions sont des presets : on les refait une fois quand le décor bouge, toutes les cues suivent.`,
    car: { text: 'Jouer → Le Labo, console dot2 : deux lyres spot (roue de couleurs, roue de gobos) et deux lyres wash RGBW. Les encodeurs règlent pan et tilt, les effets de position font un cercle ou un huit, les macros MAtricks prennent une lyre sur deux ; un défi demande un cercle.' },
    terms: ['pan-tilt', 'gobo', 'empreinte-dmx', 'preset-lumiere'],
    competences: ['C17', 'C31'], savoirs: ['G5', 'G2'],
    quiz: [
      { q: 'Une lyre dont le pan est en 8 bits sur 540° vise un pupitre à 20 m. De combien la tache saute-t-elle d\'un pas à l\'autre ?', choices: ['De plus de 70 cm', ['D\'environ 3 mm', 'C\'est l\'ordre de grandeur en 16 bits ; en 8 bits, 540° ÷ 255 = 2,1° par pas.'], ['De 2,1 m', 'Le pas fait 2,1 degrés, pas 2,1 mètres : à 20 m, 20 × tan 2,1° ≈ 0,74 m.']], answer: 0, why: `540° ÷ 255 = ${fmtNum(pas([-270, 270]).huit, 2)}° par pas ; à 20 m, ${fmtNum(ecartTache(pas([-270, 270]).huit, 20) * 100, 0)} cm. En 16 bits, le pas tombe à moins de 3 mm.` },
      { q: 'Effet de position : pan et tilt en sinus, même vitesse, même amplitude, déphasés de 90°. La tache décrit…', choices: ['un cercle', ['une droite', 'Une droite, c\'est un déphasage de 0° ou de 180° : pan et tilt montent et descendent ensemble.'], ['un huit', 'Un huit demande un tilt deux fois plus rapide que le pan.']], answer: 0, why: 'Deux sinus de même vitesse et de même amplitude, en quadrature (90°), tracent un cercle. Avec des amplitudes différentes, une ellipse.' },
      { q: 'Pan et tilt en sinus de même amplitude, sans déphasage, mais le tilt va deux fois plus vite que le pan. Quelle forme ?', choices: ['Un huit', ['Un cercle plus petit', 'La vitesse relative change la forme, pas la taille : c\'est l\'amplitude qui fait la taille.'], ['Une ellipse', 'Une ellipse vient d\'un déphasage entre 0° et 90° à vitesse égale.']], answer: 0, why: 'Le tilt fait deux allers-retours pendant que le pan en fait un : la tache trace un huit. Déphasé de 90°, le huit se refermerait en arc.' },
      { q: 'Un effet de cercle tourne à 30 BPM. Combien de temps dure un tour ?', choices: ['2 s', ['30 s', '30 tours par minute font un tour toutes les 60 ÷ 30 = 2 s.'], ['0,5 s', '0,5 s, c\'est un effet à 120 BPM.']], answer: 0, why: `Un tour dure 60 ÷ BPM : 60 ÷ 30 = ${fmtNum(tourEffet(30))} s.` },
      { q: 'Le réalisateur veut une vague sur huit lyres en ligne, pas un mouvement à l\'unisson. Vous réglez…', choices: ['la phase répartie : 0°, 45°, 90°… d\'une lyre à l\'autre', ['la même phase sur toutes', 'Même phase, c\'est l\'unisson : les huit taches bougent ensemble.'], ['des vitesses différentes', 'Des vitesses différentes se décalent puis se rattrapent : le mouvement devient désordonné, pas une vague régulière.']], answer: 0, why: `La phase répartie sur 360° décale chaque lyre de 360 ÷ 8 = ${fmtNum(phases(8)[1])}° : le mouvement passe de l'une à l'autre.` },
      { q: 'À l\'antenne, une lyre spot doit passer du rouge au bleu en fondu de 5 s. Que se passe-t-il ?', choices: ['Sa roue tourne et montre les filtres placés entre le rouge et le bleu', ['Elle fait un fondu propre du rouge au bleu', 'Une roue porte des filtres fixes : elle ne mélange pas, elle passe d\'un filtre à l\'autre.'], ['Elle refuse le changement', 'Elle obéit, mais en faisant défiler ce qu\'il y a sur la roue entre les deux couleurs.']], answer: 0, why: 'Une roue de couleurs tourne : on change de couleur faisceau fermé, ou en un temps nul. Pour un fondu de couleur, une lyre wash à mélange (CMY ou RGBW).' },
      { q: 'Sur la console du Labo, vous voulez une lyre sur deux en bleu et les autres en ambre, en deux gestes. Vous utilisez…', choices: ['MAtricks Odd, puis Even', ['Shuffle Values', 'Shuffle répartit au hasard : pas une alternance régulière.'], ['Knockout', 'Knockout retire des projecteurs du programmeur ; il ne choisit pas un sur deux.']], answer: 0, why: 'MAtricks Odd garde un projecteur sur deux de la sélection, Even les autres : on donne le bleu aux uns, l\'ambre aux autres.' },
    ],
  },
  {
    id: 'lumiere-reseau', title: 'La lumière sur le réseau : Art-Net et sACN', minutes: '10 min',
    essentials: [
      'Art-Net et sACN transportent des **univers DMX** dans des paquets **UDP** sur Ethernet ; un **nœud** près des projecteurs refait les lignes DMX.',
      '**Art-Net 4** : port **6454**, adresses d\'usine **2.x.x.x** ou **10.x.x.x** en **/8**, univers en **Port-Address** de 15 bits (**Net**, **Sub-Net**, **Universe**) compté **à partir de 0**, quand la console compte à partir de 1.',
      '**sACN** (ANSI E1.31) : port **5568**, **multicast** vers **239.255.x.y**, **priorité** de 0 à 200 (100 par défaut) ; il demande l\'**IGMP snooping**. Un univers ≈ **210 kbit/s** : un **VLAN** lumière à part.',
    ],
    figure: figReseau,
    demoTitle: 'Au départ, le nœud n\'écoute pas le bon univers : trouvez pourquoi et corrigez. Puis mettez le nœud en 192.168.1.20, passez la console en sACN, et cherchez l\'adresse multicast de l\'univers 300.',
    demo: demoReseau,
    body: `Une ligne DMX porte un univers. Un grand plateau, un concert ou un stade en demandent des dizaines : on ne tire pas des dizaines de lignes de 120 Ω depuis la régie. Les univers voyagent alors sur **Ethernet**, dans des paquets **UDP** (le transport sans accusé de réception, comme la vidéo du car IP). Près des projecteurs, un **nœud** (node) reçoit les univers et refait des lignes DMX. Deux protocoles se partagent le terrain.

**Art-Net** (la version 4 aujourd'hui, protocole libre d'Artistic Licence) envoie chaque univers dans un paquet **ArtDmx**, sur le **port UDP 6454**. La console découvre les nœuds (ArtPoll : qui est là, qui écoute quoi), puis leur envoie **directement** les univers qu'ils ont demandés ; les premières versions diffusaient tout à tout le réseau (broadcast), ce qui se rencontre encore. L'univers est un **Port-Address** de 15 bits, découpé en **Net** (7 bits, 0 à 127), **Sub-Net** (4 bits, 0 à 15) et **Universe** (4 bits, 0 à 15) : Port-Address = Net × 256 + Sub-Net × 16 + Universe, soit 32 768 univers possibles. Le piège classique : beaucoup de consoles numérotent leurs univers **à partir de 1**, Art-Net à partir de **0**. L'univers 1 de la console part en Port-Address 0 ; un nœud réglé Net 0, Sub-Net 0, Universe 1 attend l'univers 2.

Art-Net prévoit des **adresses d'usine** dans **2.x.x.x** ou **10.x.x.x**, avec le masque **255.0.0.0** (/8). Comme toute machine IP, la console et les nœuds doivent être dans le **même sous-réseau** (ou reliés par un routeur) : un nœud en 192.168.1.20/24 ne reçoit rien d'une console en 2.0.0.10/8.

**sACN** (Streaming ACN, norme ANSI E1.31) envoie chaque univers, numéroté de **1 à 63 999**, en **multicast** sur le **port UDP 5568** : l'univers u part vers le groupe **239.255.(u ÷ 256).(u mod 256)**, soit 239.255.0.1 pour l'univers 1 et 239.255.1.44 pour l'univers 300. Un nœud **s'abonne** aux univers qu'il veut (IGMP). Chaque source annonce une **priorité** de **0 à 200** (100 par défaut) : quand deux consoles envoient le même univers, le nœud suit la plus haute, ce qui fait une console de secours toute simple.

Le multicast demande un réseau qui sait le trier : sans **IGMP snooping** sur le switch, chaque univers est recopié sur tous les ports, comme une diffusion. C'est exactement la même mécanique que les flux vidéo ST 2110 du car IP (leçons sur les adresses et sur le multicast du chapitre Le réseau).

Un univers n'est pas lourd : un paquet ArtDmx complet (en-têtes Ethernet, IP et UDP compris) fait environ 600 octets ; à 44 trames par seconde, environ **210 kbit/s**. Cent univers tiennent dans 21 Mbit/s. Ce n'est donc pas le débit qui impose un **réseau lumière séparé** (un **VLAN** à part, ou un switch à part), c'est la sûreté : une diffusion Art-Net ou un multicast mal trié ne doivent pas déborder sur le réseau de production, et une tempête sur le réseau de production ne doit pas faire clignoter le plateau.`,
    plus: `Art-Net transporte aussi le RDM (ArtRdm) et le timecode (ArtTimeCode) ; sACN se contente des niveaux, avec une option de synchronisation des univers (E1.31-2016 et suivantes).

- Deux sources sACN de même priorité sur le même univers : le nœud les fusionne (souvent au plus haut, HTP) ou suit la dernière, selon le modèle : à éviter.
- Une console qui cesse d'émettre : un nœud garde en général la dernière trame un moment, puis s'éteint ou garde l'état, selon son réglage. On le vérifie avant le direct.
- Pour aller plus loin sur les adresses, l'unicast, la diffusion, le multicast et l'IGMP : les leçons « Unicast, diffusion, multicast » et « Multicast et IGMP » du chapitre Le réseau.`,
    car: { text: 'Jouer → Le Labo, atelier DMX et Art-Net, vue « Le réseau lumière » : la console, le nœud, leurs adresses, le protocole et l\'univers ; ce qui passe et pourquoi, et un défi de configuration de nœud. Au car IP, le poste Réseau IP montre le même multicast et le même IGMP, pour les flux vidéo ST 2110.' },
    terms: ['artnet', 'sacn', 'noeud-dmx', 'igmp', 'vlan', 'udp'],
    competences: ['C12', 'C25', 'C26'], savoirs: ['K2', 'K4', 'G5'],
    quiz: [
      { q: 'La console envoie son univers 1 en Art-Net ; le nœud est réglé Net 0, Sub-Net 0, Universe 1. Les projecteurs ne réagissent pas. Pourquoi ?', choices: ['La console compte ses univers à partir de 1, Art-Net à partir de 0 : son univers 1 part en Port-Address 0', ['Le nœud doit passer en Universe 2', 'C\'est l\'inverse : il faut descendre d\'un, pas monter.'], ['Art-Net ne transporte pas l\'univers 1', 'Art-Net transporte les Port-Address 0 à 32 767 : c\'est une question de numérotation.']], answer: 0, why: `Univers 1 de la console = Port-Address ${versPortAddress(1).pa} : le nœud doit écouter Net 0, Sub-Net 0, Universe 0.` },
      { q: 'Console en 2.0.0.10, masque 255.0.0.0 ; nœud en 192.168.1.20, masque 255.255.255.0. Le nœud reçoit-il ?', choices: ['Non : ils ne sont pas dans le même sous-réseau', ['Oui : Art-Net passe partout', 'Art-Net, c\'est de l\'UDP sur IP : sans routeur, deux sous-réseaux différents ne se joignent pas.'], ['Oui, si l\'univers est le bon', 'Le bon univers ne suffit pas : les paquets n\'arrivent même pas au nœud.']], answer: 0, why: 'La console est dans 2.0.0.0/8, le nœud dans 192.168.1.0/24. On met le nœud dans 2.x.x.x en /8 (ou la console dans le réseau du nœud).' },
      { q: 'En sACN, l\'univers 3 est envoyé vers quelle adresse ?', choices: ['239.255.0.3', ['239.255.3.0', 'L\'octet de poids fort vient d\'abord : 3 = 0 × 256 + 3, donc 239.255.0.3.'], ['2.0.0.3', '2.x.x.x est une plage d\'adresses d\'appareils d\'Art-Net ; sACN envoie en multicast, vers 239.255.x.y.']], answer: 0, why: `L'univers u part vers 239.255.(u ÷ 256).(u mod 256) : univers 3 → ${sacnMulticast(3)}.` },
      { q: 'Les univers sACN arrivent bien, mais chaque port du switch reçoit tous les univers et le réseau ralentit. Ce qui manque :', choices: ['L\'IGMP snooping sur le switch', ['Une terminaison de 120 Ω', 'La terminaison concerne la ligne DMX en cuivre, pas Ethernet.'], ['Une priorité sACN plus haute', 'La priorité départage deux sources du même univers ; elle ne limite pas où vont les paquets.']], answer: 0, why: 'Sans IGMP snooping, le switch traite le multicast comme une diffusion : tout part partout. Avec, chaque univers ne va qu\'aux ports abonnés.' },
      { q: 'Deux consoles envoient l\'univers 1 en sACN : la principale en priorité 100, la secours en 50. Le nœud suit…', choices: ['la principale, tant qu\'elle émet', ['la dernière qui a émis', 'Sans priorité, ce serait possible ; sACN suit la plus haute priorité présente.'], ['un mélange des deux', 'À priorités différentes, la plus haute l\'emporte ; le mélange ne se pose qu\'entre sources de même priorité.']], answer: 0, why: 'Le nœud suit la priorité la plus haute (100). Si la principale se tait, la secours (50) prend le relais : c\'est la console de secours la plus simple.' },
      { q: 'Combien de débit pour 16 univers Art-Net à 44 trames par seconde ?', choices: ['Environ 3,4 Mbit/s', ['Environ 4 Gbit/s', 'Un univers fait environ 210 kbit/s : 16 univers, quelques Mbit/s.'], ['Environ 210 kbit/s', 'C\'est un seul univers ; les 16 additionnent leurs débits.']], answer: 0, why: `16 × ${fmtNum(debitArtnet(44).kbps, 0)} kbit/s ≈ ${fmtNum(debitUnivers(16) / 1000, 1)} Mbit/s : peu de chose pour un lien à 1 Gbit/s. On sépare le réseau lumière pour la sûreté, pas pour le débit.` },
    ],
  },
];
