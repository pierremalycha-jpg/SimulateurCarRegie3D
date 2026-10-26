// @ts-check
import { el } from '../util.js';
import { figure, sv, choice } from './kit.js';

// ----------------------------------------------------------------------------------
// Leçon « La passerelle : passer d'un réseau à l'autre » du chapitre Réseau : la décision de chaque machine
// (même sous-réseau ou non, à travers son masque), la passerelle, ce que fait le routeur (nouvelle
// enveloppe Ethernet, TTL), les routes, et les pannes qui en découlent (passerelle absente ou fausse,
// masque faux). Plan d'adresses du car SDI : 10.1.<VLAN>.<machine>/24, passerelle en .1 sur SW-CŒUR.
// Normes : IPv4 (RFC 791 : TTL sur 8 bits, décrémenté à chaque routeur), ARP (RFC 826), ICMP (RFC 792 :
// « time exceeded », sur lequel repose traceroute). Vue 3D : vues3d/vues/reseau_passerelle.js.
// ----------------------------------------------------------------------------------
/** les machines de la manipulation (VLAN 20 caméras, VLAN 60 fichiers) */
export const MACHINES = {
  rcp1: { nom: 'RCP 1', ip: '10.1.20.31', vlan: 20 },
  ccu1: { nom: 'CCU 1', ip: '10.1.20.11', vlan: 20 },
  nas: { nom: 'NAS des fichiers', ip: '10.1.60.20', vlan: 60 },
  sup: { nom: 'PC supervision', ip: '10.1.60.50', vlan: 60 },
};
const ip2n = (ip) => ip.split('.').reduce((a, b) => a * 256 + Number(b), 0);
const n2ip = (n) => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');
const maskN = (p) => (p === 0 ? 0 : (2 ** 32 - 2 ** (32 - p)));
const andN = (a, b) => { let r = 0; for (let k = 0; k < 32; k++) { const bit = 2 ** k; if (Math.floor(a / bit) % 2 && Math.floor(b / bit) % 2) r += bit; } return r; };
/** partie réseau d'une adresse vue à travers un masque /p */
export const reseauDe = (ip, p) => n2ip(andN(ip2n(ip), maskN(p)));

/**
 * Ce qui se passe quand la machine src envoie un paquet à dst : la décision, le chemin, le résultat.
 * @param {string} src
 * @param {string} dst
 * @param {{ masque?: number, passerelle?: boolean }} [o] masque et passerelle de la machine qui émet (/24 et présente par défaut)
 */
export function trajet(src, dst, o = {}) {
  const S = MACHINES[src], D = MACHINES[dst], p = o.masque ?? 24, gw = o.passerelle ?? true;
  const mine = reseauDe(S.ip, p), theirs = reseauDe(D.ip, p);
  const local = mine === theirs;
  const etapes = [`${S.nom} compare : ${D.ip} et son masque /${p} donnent ${theirs} ; son propre réseau est ${mine}.`];
  if (local) {
    etapes.push(`Même réseau : ${S.nom} demande l'adresse MAC de ${D.ip} par ARP (une diffusion dans son VLAN).`);
    if (S.vlan === D.vlan) { etapes.push(`${D.nom} répond ; la trame part directement, par le commutateur, sans passer par le routeur.`); return { local, etapes, ok: true, sauts: 0, chemin: 'direct' }; }
    etapes.push(`Mais ${D.nom} est dans un autre VLAN : la diffusion ARP ne l'atteint jamais. Pas de réponse, rien ne part.`);
    return { local, etapes, ok: false, sauts: 0, chemin: 'arp-perdu', panne: 'masque' };
  }
  if (!gw) { etapes.push(`Autre réseau, et ${S.nom} n'a pas de passerelle : il ne sait pas à qui confier le paquet. « Destination injoignable ».`); return { local, etapes, ok: false, sauts: 0, chemin: 'sans-passerelle', panne: 'passerelle' }; }
  const g = mine.replace(/\.0$/, '.1');
  etapes.push(`Autre réseau : le paquet est confié à la passerelle ${g}. ${S.nom} demande sa MAC par ARP, puis lui envoie la trame (MAC du routeur, IP de ${D.nom} inchangée).`);
  etapes.push(`Le routeur (SW-CŒUR) ouvre l'enveloppe, lit l'IP de destination, trouve la route ${reseauDe(D.ip, 24)}/24 (son interface VLAN ${D.vlan}), décrémente le TTL (64 → 63).`);
  etapes.push(`Il refait une enveloppe Ethernet : MAC source = la sienne côté VLAN ${D.vlan}, MAC destination = ${D.nom} (demandée par ARP). Le paquet IP, lui, n'a pas changé d'adresses.`);
  etapes.push(`${D.nom} reçoit ; sa réponse refait le chemin à l'envers, par sa propre passerelle ${reseauDe(D.ip, 24).replace(/\.0$/, '.1')}.`);
  return { local, etapes, ok: true, sauts: 1, chemin: 'routeur' };
}

function figRoutage() {
  const f = figure(440, 176, 'Deux sous-réseaux reliés par un routeur : à gauche le VLAN 20 des caméras (10.1.20.0/24), à droite le VLAN 60 des fichiers (10.1.60.0/24). Le routeur a une adresse dans chacun, 10.1.20.1 et 10.1.60.1 : c\'est la passerelle de chaque côté.');
  const C = { a: '#ffd38a', b: '#7fd3f3', r: '#d08cff' };
  const box = (x, y, w, h, col, t, s) => { f.append(sv('rect', { x, y, width: w, height: h, rx: 4, fill: '#1a2229', stroke: col })); f.append(sv('text', { x: x + w / 2, y: y + 15, textAnchor: 'middle', class: 'co-t' }, t)); if (s) f.append(sv('text', { x: x + w / 2, y: y + 29, textAnchor: 'middle', class: 'co-s' }, s)); };
  f.append(sv('rect', { x: 6, y: 24, width: 150, height: 120, rx: 8, fill: 'rgba(255,211,138,.07)', stroke: C.a, 'stroke-dasharray': '4 3' }), sv('text', { x: 81, y: 18, textAnchor: 'middle', class: 'co-s' }, 'VLAN 20 · 10.1.20.0/24'));
  f.append(sv('rect', { x: 284, y: 24, width: 150, height: 120, rx: 8, fill: 'rgba(127,211,243,.07)', stroke: C.b, 'stroke-dasharray': '4 3' }), sv('text', { x: 359, y: 18, textAnchor: 'middle', class: 'co-s' }, 'VLAN 60 · 10.1.60.0/24'));
  box(16, 36, 130, 36, C.a, 'RCP 1', '10.1.20.31 · passerelle .1'); box(16, 96, 130, 36, C.a, 'CCU 1', '10.1.20.11');
  box(294, 36, 130, 36, C.b, 'NAS', '10.1.60.20 · passerelle .1'); box(294, 96, 130, 36, C.b, 'PC supervision', '10.1.60.50');
  box(170, 62, 100, 46, C.r, 'Routeur', 'SW-CŒUR, niveau 3');
  f.append(sv('text', { x: 172, y: 124, class: 'co-m' }, '.20.1'), sv('text', { x: 236, y: 124, class: 'co-m' }, '.60.1'));
  f.append(sv('line', { x1: 146, y1: 54, x2: 170, y2: 80, stroke: C.a, strokeWidth: 2 }), sv('line', { x1: 270, y1: 80, x2: 294, y2: 54, stroke: C.b, strokeWidth: 2 }));
  f.append(sv('text', { x: 220, y: 162, textAnchor: 'middle', class: 'co-s' }, 'Même réseau : direct. Autre réseau : par la passerelle, qui change l\'enveloppe et décrémente le TTL.'));
  return f;
}

function demoRoutage(host) {
  let src = 'rcp1', dst = 'nas', masque = 24, gw = true;
  const out = el('ol', { class: 'co-trace' });
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    if (src === dst) { out.replaceChildren(el('li', {}, 'Une machine ne s\'envoie pas de paquet à elle-même par le réseau : choisissez une autre destination.')); verdict.textContent = ''; return; }
    const r = trajet(src, dst, { masque, passerelle: gw });
    out.replaceChildren(...r.etapes.map((t) => el('li', {}, t)));
    verdict.textContent = r.ok ? (r.chemin === 'direct' ? 'Livré directement, sans routeur.' : 'Livré par la passerelle : un saut de routeur, TTL 63 à l\'arrivée.') : (r.panne === 'masque' ? 'Échec : le masque fait croire à un voisin qui n\'en est pas un.' : 'Échec : pas de passerelle pour sortir du sous-réseau.');
    verdict.className = 'co-verdict ' + (r.ok ? 'ok' : 'ko');
  };
  const opts = Object.entries(MACHINES).map(([k, m]) => [k, `${m.nom} (${m.ip})`]);
  host.append(el('div', { class: 'co-ctl' },
    choice('Qui envoie', opts.filter(([k]) => k === 'rcp1' || k === 'ccu1'), src, (v) => { src = v; draw(); }),
    choice('Vers', opts, dst, (v) => { dst = v; draw(); }),
    choice('Masque de la machine qui envoie', [['24', '/24 (juste)'], ['16', '/16 (faux)']], String(masque), (v) => { masque = +v; draw(); }),
    choice('Passerelle de la machine', [['oui', '10.1.20.1'], ['non', 'aucune']], 'oui', (v) => { gw = v === 'oui'; draw(); })),
  out, verdict);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const ROUTAGE = {
  id: 'reseau-routage', title: 'La passerelle : passer d\'un réseau à l\'autre', minutes: '8 min',
  essentials: [
    'Avant d\'envoyer, une machine compare l\'adresse de destination à la sienne **à travers son masque** : même réseau, elle livre directement ; sinon, elle confie le paquet à sa **passerelle**.',
    'Le **routeur** (dans le car, SW-CŒUR et ses interfaces **SVI** 10.1.x.1) relie les VLAN : il refait l\'enveloppe Ethernet, décrémente le **TTL**, mais garde les adresses IP.',
    'Passerelle absente ou fausse : la machine voit ses voisines, rien au-delà. Masque faux : elle croit voisine une machine d\'un autre VLAN, et l\'appelle en vain.',
  ],
  figure: figRoutage,
  demoTitle: 'Choisissez qui envoie et vers qui, puis faussez le masque ou retirez la passerelle : suivez la décision, étape par étape.',
  demo: demoRoutage,
  body: `Un VLAN est un réseau fermé : une diffusion n'en sort pas, et une machine ne joint directement que ses voisines du même sous-réseau. Pour aller plus loin, il faut un **routeur**. Dans le car SDI, c'est le commutateur central **SW-CŒUR**, de niveau 3 : il a une adresse dans chaque VLAN (10.1.20.1 pour les caméras, 10.1.60.1 pour les fichiers…), ses **SVI**. Chacune est la **passerelle** des machines de son VLAN.

**La décision de la machine.** Pour chaque paquet, la machine applique **son masque** à l'adresse de destination et à la sienne. Le RCP 1 (10.1.20.31/24) veut joindre le NAS (10.1.60.20) : vu en /24, le NAS est dans 10.1.60.0, le RCP dans 10.1.20.0. Ce n'est pas un voisin : le RCP demande par ARP l'adresse MAC de sa passerelle et lui envoie la trame. Vers la CCU 1 (10.1.20.11), même réseau : il l'appelle directement par ARP.

**Ce que fait le routeur.** Il reçoit une trame adressée à **sa** MAC, ouvre l'enveloppe et lit l'**adresse IP de destination**. Sa **table de routage** dit par quelle interface sortir (10.1.60.0/24 : l'interface du VLAN 60, directement connectée). Il **décrémente le TTL** (time to live, 64 au départ en général : un paquet qui tournerait en boucle meurt à 0), puis refait une enveloppe Ethernet : MAC source la sienne côté VLAN 60, MAC destination celle du NAS. Les **adresses IP ne changent pas** de bout en bout ; les adresses MAC changent à chaque routeur.

**Le chemin du retour** est indépendant : le NAS répond par **sa** passerelle, 10.1.60.1. Une passerelle juste d'un côté et fausse de l'autre donne un aller qui arrive et un retour qui se perd.

Les pannes, et comment les reconnaître :
- **passerelle absente ou fausse** : la machine joint ses voisines, mais ni la supervision, ni l'heure NTP, ni rien dans un autre VLAN ;
- **masque trop large** (/16 au lieu de /24) : la machine croit voisine une machine d'un autre VLAN et l'appelle par ARP ; personne ne répond ;
- **SVI éteinte** sur le routeur : tout le VLAN perd l'accès au reste du car, mais ses machines se parlent entre elles.

**traceroute** (tracert sous Windows) montre les routeurs traversés : il envoie des paquets de TTL 1, 2, 3… et chaque routeur qui tue un paquet le signale. Le dernier qui répond dit où le chemin s'arrête.`,
  plus: `- Dans le car IP (ST 2110), les flux média sont routés en **multicast** par PIM entre les leaves ; la passerelle ne sert qu'à l'unicast (contrôle, NMOS, PTP en unicast).
- Un routeur peut **filtrer** entre VLAN (listes d'accès) : les invités joignent Internet, jamais les CCU.
- Le **TTL** sert aussi au multicast : un flux à TTL 1 ne quitte pas son sous-réseau.
- \`ping\` vers la passerelle d'abord, puis au-delà : la première étape de tout dépannage de niveau 3.`,
  car: { text: 'Au poste Réseau (car SDI) : SW-CŒUR route entre les VLAN (passerelles 10.1.x.1). Le ping depuis le PC de supervision passe par la passerelle ; les pannes « passerelle fausse » et « masque faux » s\'y jouent, et l\'exercice de mise en service d\'une machine les fait éviter.', station: 'reseau' },
  terms: ['passerelle', 'routage', 'svi', 'sous-reseau', 'arp', 'ping'],
  competences: ['3.6', '2.10', '2.13'], article: 'reseau',
  quiz: [
    { q: 'Le RCP 1 (10.1.20.31/24) envoie un paquet au NAS (10.1.60.20). À quelle adresse MAC la trame qui quitte le RCP est-elle adressée ?',
      choices: [['À celle du NAS', 'Le NAS est dans un autre sous-réseau : le RCP ne cherche pas sa MAC. Il ne la verra jamais.'], 'À celle de sa passerelle, le routeur 10.1.20.1', ['À FF:FF:FF:FF:FF:FF, la diffusion', 'La diffusion sert à la question ARP, pas au paquet lui-même.']],
      answer: 1, why: 'Hors de son sous-réseau, le RCP confie le paquet à sa passerelle : la trame porte la MAC du routeur, le paquet IP garde l\'adresse du NAS.' },
    { q: 'Que change le routeur quand il fait passer un paquet d\'un VLAN à l\'autre ?',
      choices: ['L\'enveloppe Ethernet (adresses MAC) et le TTL ; les adresses IP restent les mêmes', ['Les adresses IP source et destination', 'Les adresses IP restent les mêmes de bout en bout (sans traduction d\'adresses, absente d\'un car).'], ['Rien : il recopie la trame telle quelle', 'C\'est ce que fait un commutateur dans un VLAN. Le routeur, lui, refait l\'enveloppe pour le réseau suivant.']],
      answer: 0, why: 'Les MAC n\'ont de sens que sur un réseau local : le routeur refait l\'enveloppe pour le réseau suivant, et décrémente le TTL.' },
    { q: 'Une machine joint toutes ses voisines du VLAN 20, mais ni la supervision (VLAN 10) ni le serveur d\'heure. Cause probable ?',
      choices: [['Son câble est débranché', 'Elle ne joindrait plus personne, voisines comprises.'], 'Sa passerelle est absente ou fausse', ['Elle est dans le mauvais VLAN', 'Elle ne joindrait plus ses voisines du VLAN 20.']],
      answer: 1, why: 'Tout ce qui est local marche, tout ce qui passe par le routeur échoue : c\'est la signature d\'une passerelle absente ou fausse.' },
    { q: 'Le RCP 1 a reçu par erreur un masque /16. Il veut joindre le NAS 10.1.60.20 (VLAN 60). Que se passe-t-il ?',
      choices: [['Il passe par sa passerelle, comme en /24', 'En /16, la partie réseau est 10.1 pour les deux adresses : il croit le NAS voisin et ne pense pas à la passerelle.'], 'Il le croit voisin, l\'appelle par ARP dans le VLAN 20, et personne ne répond', ['Il le joint quand même, le masque ne sert qu\'à l\'affichage', 'Le masque décide à chaque paquet : direct ou par la passerelle.']],
      answer: 1, why: 'Le masque trop large fait croire à un voisin. La question ARP reste dans le VLAN 20, où le NAS n\'est pas : rien ne répond.' },
    { q: 'À quoi sert le TTL d\'un paquet IP ?',
      choices: [['À dater le paquet pour la synchro', 'C\'est le rôle de PTP et des horodatages RTP, pas du TTL.'], ['À dire combien de temps garder le paquet en mémoire', 'Malgré son nom (time to live), c\'est un compteur de sauts, pas une durée.'], 'À compter les routeurs traversés : chacun le décrémente, un paquet à 0 est détruit'],
      answer: 2, why: 'Un paquet qui tournerait en boucle finit par mourir. traceroute s\'en sert : des paquets à TTL 1, 2, 3… font se signaler chaque routeur du chemin.' },
    { q: 'Le ping du PC de supervision vers le NAS part, mais aucune réponse ne revient, alors que le PC joint tout le reste. Le NAS joint ses voisines. Que vérifier ?',
      choices: ['La passerelle du NAS : l\'aller arrive, c\'est le retour qui se perd', ['Le masque du PC', 'Le PC joint tout le reste du car : son masque et sa passerelle sont bons.'], ['Le câble du NAS', 'Le NAS joint ses voisines : son câble fonctionne.']],
      answer: 0, why: 'L\'aller et le retour sont indépendants : le NAS répond par sa propre passerelle. Fausse, la réponse ne quitte pas son VLAN.' },
  ],
};
