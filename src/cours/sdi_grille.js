// @ts-check
import { el } from '../util.js';
import { figure, sv, choice, readout } from './kit.js';

// ----------------------------------------------------------------------------------
// Leçon « La grille de commutation » du chapitre SDI : sources et destinations, une source par destination,
// une source vers toutes, TAKE, salvos, verrouillage des départs, étiquettes, contrôle par le réseau, et la
// Videohub 40 × 40 12G du car SDI. Numéros de ports, étiquettes, verrous U / O / L et protocole Ethernet
// (TCP 9990, ports comptés à partir de 0) : ceux du simulateur (videohub.js, content/terms_videohub.js),
// d'après la documentation Blackmagic Design. Point de commutation : SMPTE RP 168.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);

// ---------------- le schéma : la matrice ----------------
function figGrille() {
  const f = figure(560, 230, 'Une grille vue comme une matrice : une ligne par sortie (destination), une colonne par entrée (source) ; un seul point fermé par ligne, autant qu\'on veut par colonne ; les deux départs vers la chaîne sont verrouillés ; à droite, ce qui commande la grille par le réseau');
  const ins = ['CAM 1', 'CAM 2', 'CAM 3', 'EVS A', 'PGM', 'CLEAN', 'MIRE'], outs = ['MÉL 1', 'MÉL 2', 'MV 13', 'ÉCRAN', 'TX1', 'TX2'];
  const xp = [0, 1, 1, 5, 4, 4], locked = [4, 5];
  const X = (i) => 80 + i * 40, Y = (j) => 52 + j * 24;
  f.append(txt(X(3), 14, 'entrées : les sources →', 'co-t'), txt(8, 34, 'sorties ↓', 'co-s', 'start'));
  ins.forEach((s, i) => f.append(txt(X(i), 36, s, 'co-s'), sv('line', { x1: X(i), y1: Y(0) - 12, x2: X(i), y2: Y(outs.length - 1) + 12, stroke: C.line })));
  outs.forEach((s, j) => {
    f.append(txt(X(0) - 18, Y(j) + 4, s, 'co-s', 'end'), sv('line', { x1: X(0) - 12, y1: Y(j), x2: X(ins.length - 1) + 12, y2: Y(j), stroke: C.line }));
    ins.forEach((_, i) => f.append(sv('circle', { cx: X(i), cy: Y(j), r: i === xp[j] ? 7 : 2.5, fill: i === xp[j] ? C.amber : '#3a434c' })));
    if (locked.includes(j)) {
      const x = X(ins.length - 1) + 24, y = Y(j);
      f.append(sv('path', { d: `M${x - 3} ${y - 2} v-3 a3 3 0 0 1 6 0 v3`, fill: 'none', stroke: C.amber, strokeWidth: 1.5 }), sv('rect', { x: x - 5, y: y - 2, width: 10, height: 8, rx: 1, fill: C.amber }));
    }
  });
  f.append(txt(280, Y(5) + 34, 'une ligne : un seul point fermé · une colonne : autant qu\'on veut', 'co-s'));
  f.append(txt(280, Y(5) + 52, 'CAM 2 alimente MÉL 2 et MV 13 ; TX1 et TX2, verrouillés, reçoivent le PGM', 'co-s'));
  // ce qui commande la grille
  const gx = 384;
  f.append(txt(gx, 58, 'commandée par', 'co-t', 'start'));
  ['sa façade (OUT, IN, TAKE)', 'Videohub Control', 'des panneaux', 'des automatismes'].forEach((s, i) => f.append(txt(gx, 80 + i * 18, '← ' + s, 'co-s', 'start')));
  f.append(txt(gx, 162, 'par le réseau : TCP 9990', 'co-m', 'start'), txt(gx, 178, '10.1.30.20, VLAN 30', 'co-m', 'start'));
  return f;
}

// ---------------- la manipulation : une grille 6 × 6 ----------------
// Six entrées et six sorties de la Videohub du car, avec leurs vrais numéros de port : le message envoyé par le
// réseau est celui du protocole (ports comptés à partir de 0).
const SRC = [{ n: 1, label: 'CAM 1' }, { n: 2, label: 'CAM 2' }, { n: 3, label: 'CAM 3' }, { n: 24, label: 'PGM' }, { n: 25, label: 'CLEAN' }, { n: 22, label: 'MIRE SPG' }];
const DST = [{ n: 1, label: 'MÉL 1', to: 'mélangeur, entrée 1' }, { n: 2, label: 'MÉL 2', to: 'mélangeur, entrée 2' }, { n: 35, label: 'MV 13', to: 'multiview, tuile 13' }, { n: 33, label: 'ÉCRAN GÉANT', to: 'écran du stade' }, { n: 31, label: 'TX1 FIBRE', to: 'départ vers la chaîne' }, { n: 32, label: 'TX2 SAT', to: 'départ de secours' }];
const START = [0, 1, 2, 4, 3, 3];
/** @type {Array<[string, string, number[], string]>} */
const SALVOS = [
  ['test', 'Salvo « test de ligne »', [0, 1, 2, 4, 5, 5], 'la mire vers les deux départs, pour le test de ligne avec la chaîne'],
  ['match', 'Salvo « match »', [0, 1, 2, 4, 3, 3], 'le programme vers les deux départs, le clean feed vers l\'écran géant'],
];
/** sources reçues par chaque sortie après une demande ; une sortie verrouillée garde la sienne (fonction pure, testée) */
export function applyRoutes(xp, lock, want) {
  const out = xp.slice(), changed = [], kept = [];
  want.forEach((s, d) => { if (s == null || out[d] === s) return; if (lock[d]) kept.push(d); else { out[d] = s; changed.push(d); } });
  return { xp: out, changed, kept };
}

function demoGrille(host) {
  let xp = START.slice(), pend = /** @type {null | { d: number, s: number }} */ (null), useTake = true, swap = false, refused = 0;
  const lock = DST.map(() => false);
  // étiquettes : la panne inverse celles des entrées 2 et 3 ; l'image, elle, suit le câble
  const lab = (s) => (swap && s === 1 ? 'CAM 3' : swap && s === 2 ? 'CAM 2' : SRC[s].label);
  const verdict = el('p', { class: 'co-verdict' }, 'Cliquez une case : la ligne est la sortie (la destination), la colonne l\'entrée (la source).');
  const proto = el('pre', { class: 'co-proto', 'aria-label': 'Message envoyé à la grille par le réseau' }, '(aucun message encore)');
  const mx = el('table', { class: 'co-mx' }), state = el('table', { class: 'co-table co-mxstate' });
  const read = readout(['Points de croisement fermés', 'Entrées utilisées', 'Départs vers la chaîne', 'Commutations refusées']);
  const say = (cls, msg) => { verdict.className = 'co-verdict ' + cls; verdict.textContent = msg; };
  const block = (title, lines) => `${title}:\n${lines.join('\n')}\n\n→ ACK : la grille prévient tous ses clients`;
  const imgNote = (s) => (lab(s) !== SRC[s].label ? ` Attention : l'étiquette dit « ${lab(s)} », l'image est celle de la ${SRC[s].label}.` : '');
  const commit = (d, s) => {
    const prev = xp[d], R = applyRoutes(xp, lock, DST.map((_, k) => (k === d ? s : null)));
    xp = R.xp;
    proto.textContent = block('VIDEO OUTPUT ROUTING', [`${DST[d].n - 1} ${SRC[s].n - 1}`]);
    const outs = xp.filter((x) => x === s).length;
    say('ok', prev === s ? `La sortie ${DST[d].n} recevait déjà l'entrée ${SRC[s].n} : rien ne change.` : `Sortie ${DST[d].n} « ${DST[d].label} » ← entrée ${SRC[s].n} « ${lab(s)} » : le point avec l'entrée ${SRC[prev].n} s'ouvre, le nouveau se ferme, les autres sorties ne bougent pas. L'entrée ${SRC[s].n} part vers ${outs} sortie${outs > 1 ? 's' : ''}.${imgNote(s)}`);
  };
  const click = (d, s) => {
    if (lock[d]) {
      refused++; pend = null;
      proto.textContent = `VIDEO OUTPUT ROUTING:\n${DST[d].n - 1} ${SRC[s].n - 1}\n\n→ la sortie ${DST[d].n} est verrouillée : son point de croisement ne change pas`;
      say('ko', `Refusé : la sortie ${DST[d].n} « ${DST[d].label} » est verrouillée. Aucune commutation n'y passe, d'où qu'elle vienne : déverrouillez-la d'abord.`);
    } else if (useTake) {
      pend = { d, s };
      say('warn', `Préparé : sortie ${DST[d].n} « ${DST[d].label} » ← entrée ${SRC[s].n} « ${lab(s)} ». TAKE valide, CLEAR annule ; d'ici là, la sortie garde ${lab(xp[d])}.`);
    } else commit(d, s);
    draw();
  };
  const doTake = () => { if (!pend) return; const { d, s } = pend; pend = null; if (lock[d]) click(d, s); else { commit(d, s); draw(); } };
  const toggleLock = (d) => {
    lock[d] = !lock[d]; if (pend && pend.d === d) pend = null;
    proto.textContent = block('VIDEO OUTPUT LOCKS', [`${DST[d].n - 1} ${lock[d] ? 'O' : 'U'}`]);
    say(lock[d] ? 'ok' : 'warn', lock[d] ? `Sortie ${DST[d].n} « ${DST[d].label} » verrouillée par ce poste (état O) : elle garde ${lab(xp[d])}, quoi qu'on fasse ailleurs.` : `Sortie ${DST[d].n} déverrouillée (état U) : n'importe quel poste peut de nouveau la commuter.`);
    draw();
  };
  const salvo = ([, name, want, what]) => {
    pend = null;
    const R = applyRoutes(xp, lock, want); xp = R.xp;
    proto.textContent = R.changed.length ? block('VIDEO OUTPUT ROUTING', R.changed.map((d) => `${DST[d].n - 1} ${SRC[xp[d]].n - 1}`)) : '(rien à envoyer : la grille est déjà dans cet état)';
    const kept = R.kept.map((d) => DST[d].label);
    say(kept.length ? 'warn' : 'ok', `${name} rappelé : ${what}. ${R.changed.length} point${R.changed.length > 1 ? 's' : ''} changé${R.changed.length > 1 ? 's' : ''} d'un coup${kept.length ? ` ; ${kept.join(' et ')}, ${kept.length > 1 ? 'verrouillés, gardent leur' : 'verrouillé, garde sa'} source : relisez l'état de la grille après un salvo.` : '.'}`);
    draw();
  };
  const take = /** @type {HTMLButtonElement} */ (el('button', { type: 'button', class: 'btn small primary co-take', onclick: doTake }, 'TAKE'));
  const clear = /** @type {HTMLButtonElement} */ (el('button', { type: 'button', class: 'btn small', onclick: () => { if (!pend) return; pend = null; say('', 'CLEAR : commutation préparée annulée, rien n\'a changé à la sortie.'); draw(); } }, 'CLEAR'));
  const swapChk = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox' }));
  swapChk.addEventListener('change', () => { swap = swapChk.checked; say('warn', swap ? 'Panne : les étiquettes des entrées 2 et 3 sont inversées. Les câbles n\'ont pas bougé : l\'entrée 2 porte toujours l\'image de la CAM 2, mais elle s\'appelle « CAM 3 ». Regardez l\'état des destinations.' : 'Étiquettes rétablies : chaque entrée porte le nom de ce qui y est câblé.'); draw(); });
  const draw = () => {
    const head = el('tr', {}, el('th', { scope: 'col' }, el('span', {}, 'sortie ↓'), el('b', {}, 'entrée →')), ...SRC.map((s, i) => el('th', { scope: 'col' }, el('span', {}, 'IN ' + s.n), el('b', {}, lab(i)))), el('th', { scope: 'col' }, el('span', {}, ''), el('b', {}, 'verrou')));
    const rows = DST.map((d, j) => el('tr', {}, el('th', { scope: 'row' }, el('span', {}, 'OUT ' + d.n), el('b', {}, d.label)),
      ...SRC.map((s, i) => {
        const on = xp[j] === i, p = !!pend && pend.d === j && pend.s === i;
        return el('td', {}, el('button', { type: 'button', class: 'co-xp' + (on ? ' on' : '') + (p ? ' pend' : ''), 'aria-pressed': String(on), 'aria-label': `Sortie ${d.n} ${d.label} ← entrée ${s.n} ${lab(i)}${on ? ', point fermé' : ''}`, onclick: () => click(j, i) }, on || p ? '●' : '·'));
      }),
      el('td', {}, el('button', { type: 'button', class: 'co-lock' + (lock[j] ? ' on' : ''), 'aria-pressed': String(lock[j]), 'aria-label': `${lock[j] ? 'LOCK' : 'libre'} : verrou de la sortie ${d.n} ${d.label}`, onclick: () => toggleLock(j) }, lock[j] ? 'LOCK' : 'libre'))));
    mx.replaceChildren(el('thead', {}, head), el('tbody', {}, ...rows));
    state.replaceChildren(el('thead', {}, el('tr', {}, ...['Sortie', 'Destination', 'Reçoit', 'Image réelle', 'Verrou'].map((t) => el('th', {}, t)))),
      el('tbody', {}, ...DST.map((d, j) => { const s = xp[j]; const bad = lab(s) !== SRC[s].label; return el('tr', {}, el('td', {}, String(d.n)), el('td', { title: d.to }, d.label), el('td', {}, `IN ${SRC[s].n} « ${lab(s)} »`), el('td', { class: bad ? 'co-bad' : '' }, SRC[s].label + (bad ? ' ≠ étiquette' : '')), el('td', { title: lock[j] ? 'verrouillée par ce poste' : 'libre' }, lock[j] ? 'O' : 'U')); })));
    take.disabled = !pend || !useTake; take.classList.toggle('armed', !!pend); clear.disabled = !pend;
    read.set('Points de croisement fermés', `${DST.length} sur ${DST.length * SRC.length} : un par sortie, jamais deux (Videohub du car : 40 sur 1 600)`);
    read.set('Entrées utilisées', SRC.map((s, i) => { const k = xp.filter((x) => x === i).length; return `${lab(i)} → ${k || 'aucune'}`; }).join(' · '));
    const tx = [4, 5].map((j) => { const s = SRC[xp[j]].label; return `${DST[j].label.split(' ')[0]} : ${s}${lock[j] ? ' (verrouillé)' : ''}${s === 'PGM' ? '' : s === 'MIRE SPG' ? ', la chaîne voit la mire' : ', pas le programme !'}`; });
    read.set('Départs vers la chaîne', tx.join(' · '));
    read.set('Commutations refusées', refused ? `${refused}, par les verrous` : 'aucune');
  };
  host.append(
    el('div', { class: 'co-mxwrap' }, mx),
    el('div', { class: 'co-ctl' },
      el('div', { class: 'co-btns' }, take, clear),
      choice('Utiliser TAKE', [['on', 'oui', 'Une case prépare, TAKE valide : une erreur de clic ne part pas à l\'antenne'], ['off', 'non', 'Une case commute tout de suite']], 'on', (v) => { useTake = v === 'on'; pend = null; draw(); }),
      el('div', { class: 'co-btns' }, ...SALVOS.map((S) => el('button', { type: 'button', class: 'btn small', title: S[3], onclick: () => salvo(S) }, S[1]))),
      el('label', { class: 'co-chk' }, swapChk, 'étiquettes des entrées 2 et 3 inversées')),
    verdict,
    el('div', { class: 'co-2' }, el('div', {}, el('h5', { class: 'co-h5' }, 'État de chaque destination'), el('div', { class: 'co-mxwrap' }, state)), el('div', {}, el('h5', { class: 'co-h5' }, 'Message envoyé par le réseau (protocole Videohub)'), proto)),
    read.el);
  draw();
}

/** @type {import('./index.js').Lesson[]} */
export const GRILLE_LESSONS = [
  {
    id: 'sdi-grille', title: 'La grille de commutation', minutes: '9 min',
    essentials: [
      'Une grille relie des **entrées** (les sources) à des **sorties** (les destinations) : chaque sortie reçoit **une seule** source, une source peut partir vers **toutes** les sorties.',
      'On commute dans l\'ordre **destination, source, TAKE** ; un **salvo** rappelle d\'un geste tout un ensemble de points ; un **verrou** fige une sortie, d\'abord les départs vers la chaîne.',
      'Celle du car est une **Videohub 40 × 40 12G**, commandée de sa façade et par le réseau ; une **étiquette** n\'est qu\'un nom : on regarde l\'image avant de valider.',
    ],
    figure: figGrille,
    demoTitle: 'Routez une caméra sur deux sorties, verrouillez TX1 et TX2, puis rappelez le salvo « test de ligne » ; inversez les étiquettes et lisez l\'image réellement reçue.',
    demo: demoGrille,
    body: `La **grille de commutation** (router, en anglais) est le carrefour vidéo du car. Ses **entrées** reçoivent les sources : sorties des CCU, lectures des serveurs de ralentis, programme et clean feed du mélangeur, habillage, mire, duplex. Ses **sorties** alimentent les destinations : entrées du mélangeur, enregistrements des serveurs, tuiles du multiview, départs vers la chaîne, écran géant, moniteurs. À l'intérieur, une **matrice** : chaque case, à l'intersection d'une sortie et d'une entrée, est un **point de croisement**. Deux règles : une sortie ne reçoit **qu'une** source à la fois ; une source peut partir vers **autant de sorties** qu'on veut, la grille recopie le signal. Une grille 40 × 40 a 1 600 points de croisement, mais son état tient en 40 nombres : l'entrée de chaque sortie.

On commute toujours dans le même ordre : **la destination d'abord, la source ensuite, puis TAKE**. Sur la façade de la Videohub : OUT et le numéro de la sortie, IN et la source (l'écran montre déjà son image), puis **TAKE** pour valider ou **CLEAR** pour annuler. Commuter, c'est fermer un point sur la ligne de la sortie : l'ancien s'ouvre, les autres sorties ne bougent pas. La grille est verrouillée sur la référence du car et commute **au top image**, dans l'intervalle de suppression entre deux images (SMPTE RP 168) ; chaque sortie est **reclockée** (le signal est régénéré), ce qui remet le budget de câble à zéro, mais une source qui n'est pas en phase ne l'est pas davantage en sortie.

Un **salvo** est un ensemble de points de croisement enregistré et rappelé d'un seul geste : la configuration d'avant-match (la mire vers les départs pour le test de ligne avec la chaîne), celle du match, celle de la mi-temps. Il change des dizaines de sorties d'un coup : on relit l'état de la grille après chaque rappel.

Une grille se commande de partout : sa façade, le logiciel sur plusieurs ordinateurs, des panneaux, des automatismes. On **verrouille** donc les sorties qui ne doivent pas bouger, d'abord les **départs** vers la chaîne (TX1 par la fibre, TX2 par le satellite) : une sortie verrouillée refuse toute commutation, d'où qu'elle vienne, salvo compris. Le protocole de la Videohub donne trois états : **U** (libre), **O** (verrouillée par ce poste), **L** (verrouillée par un autre poste). Pour un test de ligne, on déverrouille, on teste, on reverrouille ; on ne force le verrou d'un autre poste qu'après l'avoir appelé à l'intercom.

Chaque port porte une **étiquette** (CAM 3, EVS A, TX1 FIBRE…), écrite dans Videohub Setup et reprise partout. Ce n'est qu'un nom : une étiquette fausse fait router la mauvaise image en croyant bien faire. D'où deux réflexes : regarder l'image avant de valider, relire les étiquettes avec la liste de câblage au line-up. Le **contrôle par le réseau** suit le protocole Ethernet de la Videohub : un client se connecte au port TCP 9990 de la grille (ici 10.1.30.20, sur le VLAN 30 du réseau de contrôle), reçoit tout son état, puis envoie des blocs de texte. \`VIDEO OUTPUT ROUTING:\` suivi de \`30 23\` route l'entrée 24 sur la sortie 31 : les ports sont comptés à partir de 0. La grille répond \`ACK\` et prévient tous ses clients : façade et logiciels restent d'accord.

La Videohub 40 × 40 12G du car SDI :
- entrées : 1 à 16 les CCU, 17 et 18 les serveurs EVS, 19 et 20 l'habillage (fill et key), 21 le studio, 22 la mire, 23 le noir, 24 le PGM, 25 le clean feed, 26 le preview, 27 le retour antenne ;
- sorties : 1 à 22 le mélangeur, 23 à 30 les enregistrements EVS, 31 TX1, 32 TX2, 33 l'écran géant, 34 le moniteur de référence, 35 à 40 les tuiles 13 à 18 du multiview (les tuiles 1 à 12 sont câblées en direct) ;
- 12G-SDI en UHD, 3G-SDI en 1080p50 : chaque entrée détecte le format qu'elle reçoit.`,
    car: { text: 'Poste Grille : la façade de la Videohub (OUT, IN, molette, TAKE, CLEAR, LOCK), le logiciel Videohub Control avec « Utiliser TAKE » coché, le monitoring des 40 entrées et 40 sorties (cadenas sur les sorties verrouillées), la matrice 40 × 40, et Videohub Setup : étiquettes, verrous, réseau, et « Rappeler le routage du car », qui joue le rôle d\'un salvo.', station: 'grille' },
    terms: ['grille', 'point-croisement', 'take', 'verrou-sortie', 'etiquette', 'protocole-videohub', 'commutation-propre', 'reclocking'],
    competences: ['2.10', '2.9', '3.12'],
    article: 'chaine',
    exercises: [
      { id: 'grille-routage', intro: 'Au poste Grille, le réalisateur veut une autre caméra sur la tuile 13 du multiview, puis la chaîne reçoit la mire au lieu du programme. Faites à chaque fois destination, source, TAKE, et vérifiez au multiview que la sortie a changé de source sans toucher aux autres.' },
      { id: 'videohub-routage', intro: 'Vous envoyez une caméra sur l\'écran géant depuis la façade, puis sur la tuile 13 depuis Videohub Control, et vous lisez le monitoring. Observez qu\'une même entrée alimente deux sorties, chacune par son propre point de croisement.' },
      { id: 'videohub-verrou', intro: 'Vous verrouillez TX1 et TX2, vous tentez d\'y envoyer la mire, puis vous retrouvez deux étiquettes de caméras inversées. Notez que le refus vient de la grille elle-même, et qu\'une étiquette fausse ne se voit qu\'en comparant le nom, l\'image et le câblage.' },
      { id: 'materiel-grille', intro: 'Dans la visionneuse de matériel, vous ouvrez l\'arrière de la grille puis celui du processeur du mélangeur : entrées, sorties, référence. Repérez que chaque entrée du mélangeur est une sortie de la grille, et que la grille reçoit la référence pour commuter entre deux images.' },
    ],
    quiz: [
      { q: 'La CAM 3 alimente déjà MÉL 3. Le réalisateur la veut aussi sur la tuile 13 du multiview. Que devient MÉL 3 après la commutation ?', choices: ['Rien ne change : une source peut partir vers autant de sorties qu\'on veut', 'MÉL 3 perd la caméra : une source ne va qu\'à une sortie', 'Les deux sorties sont désormais liées : changer l\'une changera l\'autre'], answer: 0, why: 'La grille recopie le signal : la colonne de la CAM 3 a maintenant deux points fermés, un par sortie. Chaque sortie a son propre point de croisement : en commuter une ne touche jamais l\'autre. C\'est la sortie qui ne reçoit qu\'une source, pas l\'inverse.' },
      { q: 'TX1 est verrouillée sur le PGM. Depuis un autre poste, quelqu\'un y route la mire. Résultat ?', choices: ['La mire part à la chaîne : le verrou ne bloque que le poste qui l\'a posé', 'La grille refuse : TX1 garde le programme', 'La grille demande une confirmation sur sa façade'], answer: 1, why: 'Le verrou agit dans la grille elle-même : toute demande sur cette sortie est refusée, qu\'elle vienne de la façade, d\'un logiciel, d\'un panneau ou d\'un salvo. Pour un test de ligne, on déverrouille, on teste, on reverrouille.' },
      { q: 'Vous routez l\'entrée étiquetée « CAM 3 » sur la tuile 13 et la tuile montre la CAM 2. Que faites-vous ?', choices: ['Je compare l\'étiquette à ce qui est câblé (Videohub Setup, monitoring) : l\'étiquette est fausse, je la corrige et je route la bonne entrée', 'Je redémarre la grille : elle a perdu ses points de croisement', 'Je change le câble de la CAM 3'], answer: 0, why: 'La grille a fait exactement ce qu\'on lui a demandé : elle a routé un numéro d\'entrée. Une étiquette n\'est qu\'un nom : inversée, elle fait router la mauvaise image en croyant bien faire. Rien n\'est en panne, ni la grille ni le câble.' },
    ],
  },
];
