// @ts-check
import { el } from '../util.js';
import { figure, sv, choice, readout } from './kit.js';
import { parseIp, parseMask, netOf, ipStr } from '../net/ctrlnet.js';

// ----------------------------------------------------------------------------------
// Leçon « Monter une régie mobile : du cahier des charges au câblage » (chapitre L'exploitation).
// La manipulation : le plan d'adressage d'une petite régie à trois caméras PTZ (sorties du carton
// avec la même adresse d'usine), un pupitre et un mélangeur ; on donne une adresse à chacun, le
// masque, et l'on voit qui joint qui, les conflits, le budget PoE+ du switch. L'exercice noté est
// le module L'entrepôt (x-entrepot) : la même régie, à monter pour de vrai.
// ----------------------------------------------------------------------------------
/** les machines de la manipulation, avec ce qu'elles valent en sortant du carton */
const MACHINES = [
  { id: 'cam1', nom: 'CAM 1 (AW-HE130)', usine: '192.168.0.10', poe: 25, role: 'caméra PTZ : HTTP sur le port 80' },
  { id: 'cam2', nom: 'CAM 2 (AW-HE130)', usine: '192.168.0.10', poe: 25, role: 'caméra PTZ' },
  { id: 'cam3', nom: 'CAM 3 (AW-HE20)', usine: '192.168.0.10', poe: 19, role: 'caméra PTZ' },
  { id: 'rp150', nom: 'Pupitre AW-RP150', usine: '192.168.0.9', poe: 13, role: 'il appelle chaque caméra à l\'adresse qu\'on lui a donnée' },
  { id: 'atem', nom: 'Mélangeur ATEM', usine: 'DHCP', poe: 0, role: 'en DHCP d\'usine : sans serveur DHCP, il se replie sur 169.254.x.x' },
];
const BUDGET_POE = 300;
const linkLocal = (i) => `169.254.${100 + i}.${7 + i * 3}`;

/** la manipulation : adresses, masque, PoE, et le verdict */
function demoAdressage(host) {
  const ips = MACHINES.map((m) => m.usine);
  let mask = '255.255.255.0'; const poeOn = MACHINES.map(() => true);
  const read = readout(['Adresses effectives', 'Conflits', 'Le pupitre joint', 'Budget PoE+ du switch']);
  const verdict = el('p', { class: 'co-verdict' });
  const rows = MACHINES.map((m, i) => {
    const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'text', value: ips[i], size: '15', 'aria-label': `Adresse de ${m.nom}`, spellcheck: 'false' }));
    inp.addEventListener('input', () => { ips[i] = inp.value.trim(); calc(); });
    const cb = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', checked: '', 'aria-label': `${m.nom} alimentée en PoE+` }));
    cb.addEventListener('change', () => { poeOn[i] = cb.checked; calc(); });
    if (!m.poe) cb.disabled = true;
    return el('tr', {}, el('th', { scope: 'row' }, m.nom, el('small', {}, ' ' + m.role)), el('td', {}, inp), el('td', {}, m.poe ? el('label', {}, cb, ` ${m.poe} W`) : '—'));
  });
  const eff = (i) => { const v = ips[i]; if (/^dhcp$/i.test(v)) return linkLocal(i); return v; };
  const calc = () => {
    const p = parseMask(mask) ?? 24;
    const E = MACHINES.map((m, i) => eff(i)), N = E.map((a) => parseIp(a));
    read.set('Adresses effectives', MACHINES.map((m, i) => `${m.nom.split(' ')[0]} ${E[i]}${/^dhcp$/i.test(ips[i]) ? ' (lien local : pas de serveur DHCP)' : N[i] == null ? ' (adresse invalide)' : ''}`).join(' · '));
    const conflits = []; for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) if (N[i] != null && N[i] === N[j]) conflits.push(`${MACHINES[i].nom.split(' ')[0]} et ${MACHINES[j].nom.split(' ')[0]} (${E[i]})`);
    read.set('Conflits', conflits.length ? conflits.join(' ; ') + ' : deux machines avec la même adresse, aucune des deux ne répond sûrement' : 'aucun');
    const r = N[3];
    const joint = MACHINES.slice(0, 3).map((m, i) => { const ok = r != null && N[i] != null && netOf(r, p) === netOf(N[i], p) && !conflits.some((c) => c.includes(m.nom.split(' ')[0])) && !conflits.some((c) => c.includes('Pupitre')); return `${m.nom.split(' ')[0]} ${ok ? 'oui' : 'non'}${!ok && r != null && N[i] != null && netOf(r, p) !== netOf(N[i], p) ? ' (pas le même sous-réseau : ' + ipStr(netOf(N[i], p)) + '/' + p + ')' : ''}`; });
    read.set('Le pupitre joint', joint.join(' · '));
    const w = MACHINES.reduce((s, m, i) => s + (poeOn[i] ? m.poe : 0), 0);
    read.set('Budget PoE+ du switch', `${w} W demandés sur ${BUDGET_POE} W (24 ports à 30 W au plus chacun)${w > BUDGET_POE ? ' : dépassé, le switch coupe des ports' : ''}`);
    const allOk = joint.every((j) => / oui/.test(j)) && !conflits.length && w <= BUDGET_POE;
    verdict.className = 'co-verdict ' + (allOk ? 'ok' : conflits.length ? 'ko' : 'warn');
    verdict.textContent = allOk ? 'Le plan tient : chaque caméra a sa propre adresse, dans le sous-réseau du pupitre, et le switch alimente tout le monde.'
      : conflits.length ? 'Les caméras sortent du carton avec la même adresse : on les branche une par une et on change l\'adresse de chacune avant de brancher la suivante.'
        : 'Pas de conflit, mais le pupitre ne joint pas toutes les caméras : vérifiez l\'adresse et le masque.';
  };
  host.append(
    el('table', { class: 'co-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Machine'), el('th', {}, 'Adresse (ou DHCP)'), el('th', {}, 'PoE+'))), el('tbody', {}, ...rows)),
    el('div', { class: 'co-ctl' }, choice('Masque de toutes les machines', [['255.255.255.0', '255.255.255.0 (/24)'], ['255.255.0.0', '255.255.0.0 (/16)'], ['255.255.255.128', '255.255.255.128 (/25)']], mask, (v) => { mask = v; calc(); })),
    verdict, read.el);
  calc();
}

function figRegieMobile() {
  const f = figure(440, 190, 'Une régie mobile à trois caméras PTZ : les caméras envoient leur image en SDI au mélangeur et sont pilotées en IP par le pupitre à travers un switch PoE+ qui les alimente ; le programme part vers un enregistreur et un embedder ajoute le micro de la salle');
  const box = (x, y, w, t, s) => { f.append(sv('rect', { x, y, width: w, height: 32, rx: 3, fill: '#1a2128', stroke: '#8a949c' }), sv('text', { x: x + w / 2, y: y + 14, textAnchor: 'middle', class: 'co-t', style: 'font-size: 11.5px' }, t)); if (s) f.append(sv('text', { x: x + w / 2, y: y + 27, textAnchor: 'middle', class: 'co-s' }, s)); };
  for (let i = 0; i < 3; i++) box(4, 6 + i * 44, 78, `CAM ${i + 1} PTZ`, i < 2 ? 'AW-HE130' : 'AW-HE20');
  box(150, 6, 70, 'Pupitre', 'AW-RP150'); box(240, 6, 70, 'Routeur', 'Internet · DHCP'); box(150, 50, 70, 'Switch PoE+', '24 ports · 300 W');
  box(260, 50, 80, 'Mélangeur', 'ATEM HD8 ISO'); box(360, 50, 76, 'Enregistreur', 'HyperDeck');
  box(150, 110, 70, 'Micro salle', 'XLR'); box(260, 110, 80, 'Embedder', 'Teranex A→SDI'); box(360, 110, 76, 'Moniteur', 'multiview');
  // IP (vert) : chaque caméra vers le switch ; SDI (bleu) : chaque caméra vers le dessous du mélangeur, sous le switch
  const GY = [30, 74, 100], BY = [18, 62, 120];
  for (let i = 0; i < 3; i++) {
    f.append(sv('path', { d: `M82 ${GY[i]} H${112 + i * 6} V${58 + i * 6} H150`, stroke: '#7fd1a0', strokeWidth: 1.5, fill: 'none' }));
    f.append(sv('path', { d: `M82 ${BY[i]} H${132 + i * 6} V${96 + i * 4} H${272 + i * 10} V82`, stroke: '#7fd3f3', strokeWidth: 1.5, fill: 'none' }));
  }
  f.append(sv('path', { d: 'M185 38 V50', stroke: '#7fd1a0', strokeWidth: 1.5 }), sv('path', { d: 'M220 64 H260', stroke: '#7fd1a0', strokeWidth: 1.5 }), sv('path', { d: 'M240 22 H230 V56 H220', stroke: '#7fd1a0', strokeWidth: 1.5, fill: 'none' }));
  f.append(sv('path', { d: 'M340 66 H360', stroke: '#7fd3f3', strokeWidth: 2 }), sv('path', { d: 'M220 126 H260', stroke: '#ffd38a', strokeWidth: 1.5 }), sv('path', { d: 'M320 110 V82', stroke: '#7fd3f3', strokeWidth: 1.5 }), sv('path', { d: 'M332 82 V98 H398 V110', stroke: '#7fd3f3', strokeWidth: 1.2, fill: 'none', 'stroke-dasharray': '3 3' }));
  f.append(sv('text', { x: 4, y: 160, class: 'co-s', style: 'fill: #7fd3f3' }, 'bleu : vidéo SDI'), sv('text', { x: 4, y: 172, class: 'co-s', style: 'fill: #7fd1a0' }, 'vert : réseau IP'), sv('text', { x: 4, y: 184, class: 'co-s', style: 'fill: #ffd38a' }, 'ambre : audio'));
  return f;
}

/** @type {import('./index.js').Lesson} */
export const LESSON_REGIE_MOBILE = {
  id: 'expl-regie-mobile', title: 'Monter une régie mobile : du cahier des charges au câblage', minutes: '9 min',
  essentials: [
    'On part du **cahier des charges** (combien de caméras, qui les pilote, ce qu\'on enregistre, ce qui part en direct) et on en déduit la liste du matériel, puis le **synoptique** : chaque signal, de sa source à sa destination.',
    'Deux réseaux cohabitent : la **vidéo** (SDI ou HDMI, un câble par signal) et l\'**IP** (commande des PTZ, pupitre, interfaces web, PoE+, Internet) ; le **plan d\'adressage** se décide avant de brancher quoi que ce soit.',
    'Les appareils sortent du carton avec une **adresse d\'usine** (souvent la même pour toute une série) ou en **DHCP** : on les met en service un par un, et on note chaque adresse.',
  ],
  figure: figRegieMobile,
  demoTitle: 'Donnez une adresse à chaque machine (elles sortent du carton avec celle d\'usine), choisissez le masque, cochez ce que le switch alimente : le pupitre doit joindre les trois caméras sans conflit, dans le budget PoE+.',
  demo: demoAdressage,
  body: `Une **régie mobile** tient dans une baie 19" et sur une table : des caméras **PTZ** (tourelle motorisée, pilotée à distance), un **pupitre** qui les commande par le réseau, un **mélangeur** compact, un **enregistreur**, quelques **convertisseurs**, un **switch** qui alimente les caméras par le câble réseau (**PoE+**, 30 W par port au plus, dans la limite du budget du switch). Avant de sortir le matériel, on lit le cahier des charges et on écrit le synoptique : chaque flèche est un câble, avec son connecteur à chaque bout.

**La vidéo.** Une caméra PTZ sort son image en **SDI** (BNC) ou en **HDMI**, parfois aussi en IP (NDI|HX, RTMP) ; le mélangeur ne prend que le **format** qu'on lui a réglé (1080p50 et 1080i50 ne se mélangent pas sans conversion). Le programme (PGM) sort du mélangeur vers l'enregistreur, le moniteur, le streaming. Un **embedder** glisse un micro XLR dans une paire audio du SDI ; un **désembedder** fait l'inverse, vers la sonorisation de la salle.

**L'IP.** Tout ce qui se commande passe par le réseau : le pupitre appelle chaque caméra à son adresse (HTTP, port 80) ; l'ordinateur règle le mélangeur ; le mélangeur pilote l'enregistreur (port 9993 sur un HyperDeck). Deux machines ne se parlent que dans le **même sous-réseau** (adresse ET masque), reliées au **même switch** (ou au même VLAN). Les caméras d'une même marque sortent du carton avec la **même adresse** : branchées ensemble, elles sont en **conflit** et aucune ne répond. On les met en service **une par une** : brancher, changer l'adresse, noter, brancher la suivante. Un appareil en **DHCP** sans serveur DHCP se replie sur une adresse de lien local (169.254.x.x) que les machines en adresse fixe ne joignent pas : soit on lui donne une adresse fixe, soit un routeur distribue les adresses.

**Le tally.** Le mélangeur sait quelle entrée est à l'antenne ; pour l'allumer sur la caméra, il faut un chemin : une interface **GPI/tally** (relais) vers le pupitre, qui renvoie le tally aux caméras par IP ; ou un logiciel qui parle aux caméras. Sans ce chemin, les voyants restent éteints.

**L'énergie.** Un disjoncteur de 16 A donne 3 680 W ; un bandeau 10 A, 2 300 W ; le PoE+, 30 W par port et un budget total. On additionne avant de brancher.`,
  plus: `- Le plan d'adressage s'écrit avant le câblage, et se colle sur la baie : adresse, masque, passerelle, port du switch, pour chaque machine.
- Sur un switch administrable, un **VLAN** par usage (commande, NDI, invités) et une **QoS** qui fait passer la commande avant les fichiers.
- La documentation du constructeur donne l'adresse d'usine, le port du service, et comment revenir aux réglages d'usine (un bouton, un commutateur, un délai après la mise sous tension).`,
  car: { text: 'Dans l\'entrepôt (écran Jouer, lieu L\'entrepôt) : le stock, la baie, la table, le plateau ; chaque appareil a ses faces, ses connecteurs et ses menus de configuration ; le panneau Réseau montre les adresses effectives et le ping ; le cahier des charges donne la note.' },
  terms: ['vlan', 'qos', 'poe', 'dhcp'],
  competences: ['1.1', '2.1', '2.10', '3.9'],
  exercises: [
    { id: 'x-entrepot', intro: 'Exercice noté, dans l\'entrepôt : le lycée commande une régie à trois caméras PTZ pour sa cérémonie. Vous sortez le matériel du stock, vous le posez, vous le câblez et vous le configurez (adresses, formats, pupitre, tally, enregistrement, micro embarqué) jusqu\'à ce que le cahier des charges soit rempli, dans le budget.' },
  ],
  quiz: [
    { q: 'Trois caméras PTZ neuves de la même marque sont branchées en même temps sur le switch. Le pupitre n\'en joint aucune. Pourquoi ?', choices: ['Elles ont la même adresse d\'usine : en conflit, aucune ne répond sûrement', ['Le switch n\'est pas assez rapide', 'La commande d\'une PTZ demande quelques kilobits par seconde : le débit n\'est pas en cause.'], ['Les câbles réseau sont trop longs', 'Jusqu\'à 100 m, un câble Ethernet ne pose pas de problème.']], answer: 0, why: 'Une série sort du carton avec la même adresse : on met les caméras en service une par une, en changeant l\'adresse de chacune.' },
    { q: 'Le mélangeur est en DHCP d\'usine, il n\'y a pas de routeur. L\'ordinateur en 192.168.0.50/24 ne le trouve pas. Que s\'est-il passé ?', choices: [['Le mélangeur est en panne', 'Il marche : il n\'a juste pas d\'adresse utilisable.'], 'Sans serveur DHCP, le mélangeur s\'est replié sur une adresse 169.254.x.x, hors du sous-réseau de l\'ordinateur', ['Le port 9910 est fermé', 'Le port ne sert à rien tant que l\'adresse n\'est pas joignable.']], answer: 1, why: 'Sans DHCP, on donne au mélangeur une adresse fixe dans le même sous-réseau, ou on ajoute un routeur qui distribue les adresses.' },
    { q: 'Deux caméras à 25 W, une à 19 W et un pupitre à 13 W en PoE+ sur un switch de 300 W. Et si on ajoute huit caméras de plus à 25 W ?', choices: [['Ça passe : 24 ports PoE+', 'Le nombre de ports ne suffit pas : c\'est le budget total qui compte.'], ['Le switch grille', 'Un switch administrable coupe l\'alimentation des ports en trop ; il ne grille pas.'], '282 W : encore dans le budget, mais il ne reste que 18 W, pas de quoi alimenter une caméra de plus'], answer: 2, why: '82 W + 8 × 25 W = 282 W. Le budget se calcule avant de câbler ; au-delà, le switch refuse d\'alimenter les derniers ports branchés.' },
    { q: 'La CAM 3 est réglée en 1080i50, le mélangeur en 1080p50. Que se passe-t-il ?', choices: [['Le pupitre ne joint plus la CAM 3', 'Le format concerne la vidéo ; la commande passe par l\'IP, qui n\'est pas touchée : le pupitre la pilote toujours.'], 'Le mélangeur ne prend pas son image tant qu\'elle n\'est pas en 1080p50 (ou convertie)', ['Rien : le mélangeur convertit chaque entrée à son format', 'Le mélangeur ne prend que le format qu\'on lui a réglé : 1080i50 et 1080p50 ne se mélangent pas sans conversion.']], answer: 1, why: 'Le mélangeur ne prend que le format qu\'on lui a réglé. On règle la CAM 3 au format de la régie, ou l\'on passe par un convertisseur ; la commande IP, elle, ne dépend pas du format.' },
    { q: 'Le pupitre pilote les trois PTZ et le mélangeur coupe bien entre elles, mais aucun voyant de tally ne s\'allume. Que manque-t-il ?', choices: ['Un chemin du mélangeur aux caméras : interface GPI/tally vers le pupitre, ou logiciel', ['Un câble SDI de retour, du mélangeur vers chaque caméra', 'Le SDI amène l\'image de la caméra au mélangeur : ce n\'est pas par lui que la caméra apprend qu\'elle est à l\'antenne.'], ['Une adresse IP pour chaque caméra, dans le sous-réseau du mélangeur', 'Les caméras ont déjà leur adresse, puisque le pupitre les pilote ; et le mélangeur ne leur envoie pas le tally de lui-même.']], answer: 0, why: 'Le mélangeur sait quelle entrée est à l\'antenne, mais il faut un chemin jusqu\'aux caméras : une interface GPI/tally (relais) vers le pupitre, qui renvoie le tally par IP, ou un logiciel qui parle aux caméras. Sans ce chemin, les voyants restent éteints.' },
  ],
};
