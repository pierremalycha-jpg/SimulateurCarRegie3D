// @ts-check
import { el } from '../util.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';
import { commande, urlCommande, lireCommande } from './ptz_calc.js';
import { POE, MODELES, USINE, FENETRE_EASYIP, COMPTE_USINE, reseauDe, dansReseau, adresseHote, ipOk, lireUrl, verifierCompte, bancUsine, majTension, rechercheEasyIp, alimentation } from '../labo/calc/ptz.js';

// ----------------------------------------------------------------------------------
// Chapitre « Les caméras PTZ » (v19.30), deuxième partie : mettre en réseau. Adresser une caméra (adresse,
// masque, passerelle, port HTTP), Easy IP Setup (la recherche par diffusion, la MAC, la fenêtre de 20 minutes),
// le PoE et le PoE+ (classes, budget), la page web (compte administrateur, Network, Advanced), le pupitre
// AW-RP150 (RP IP SET, MANUAL IP SET, la commande HTTP). Les manipulations calculent avec le modèle de
// l'atelier du Labo (labo/calc/ptz.js) et cours/ptz_calc.js.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', violet: '#c9a0ff', box: '#1a2026', line: '#2a3238', white: '#e8eef2', ink: '#0b1013', dim: '#6f7a84', soft: '#aab4ba' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 4, fill, stroke, strokeWidth: 1.2 });
const ligne = (x1, y1, x2, y2, col = C.grey, w = 1.6, dash = '') => sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: w, ...(dash ? { 'stroke-dasharray': dash } : {}) });
/** un champ de saisie de la manipulation */
const saisie = (label, val, set) => {
  const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'text', value: val, spellcheck: 'false', autocomplete: 'off', 'aria-label': label }));
  inp.addEventListener('input', () => set(inp.value.trim()));
  return el('label', { class: 'co-slider' }, el('span', {}, label), inp);
};

// ======================================================================================
// 3. Adresser une caméra : adresse, masque, passerelle, port
// ======================================================================================
function figAdresse() {
  const R = reseauDe('192.168.10.11', '255.255.255.0');
  const f = figure(720, 270, `Une adresse IPv4 et son masque. L'adresse 192.168.10.11 avec le masque 255.255.255.0 (/24) : les trois premiers octets désignent le réseau ${R.reseau}, le dernier l'appareil. Dans ce réseau, les appareils vont de .1 à .254 ; ${R.diffusion} est l'adresse de diffusion. Le PC en 192.168.10.100 est dans le même réseau : il joint la caméra directement. Un appareil en 192.168.0.10 est dans un autre réseau : il faut passer par la passerelle, un routeur, et il n'y en a pas sur un banc. En bas, l'URL de la page web : http, l'adresse, deux-points et le port quand il n'est pas 80.`);
  f.append(txt(10, 16, 'L\'adresse dit l\'appareil, le masque dit le réseau, le port dit le service', 'co-t', 'start'));
  const oct = ['192', '168', '10', '11'];
  oct.forEach((o, i) => { const x = 40 + i * 110; f.append(box(x, 40, 96, 40, i < 3 ? C.cyan : C.amber), txt(x + 48, 66, o, 'co-t')); if (i < 3) f.append(txt(x + 103, 66, '.', 'co-t')); });
  f.append(txt(40 + 160, 98, 'réseau (masque 255.255.255.0 : 24 bits)', 'co-s', 'middle', { fill: C.cyan }), txt(40 + 3 * 110 + 48, 98, 'appareil', 'co-s', 'middle', { fill: C.amber }));
  f.append(box(500, 36, 200, 96, C.grey), txt(600, 56, `Réseau ${R.reseau}/24`, 'co-t'), txt(600, 74, 'appareils : .1 à .254', 'co-s'), txt(600, 90, `diffusion : ${R.diffusion}`, 'co-s'), txt(600, 106, 'passerelle (routeur) : .1', 'co-s'), txt(600, 122, `${R.hotes} adresses d'appareil`, 'co-s'));
  // qui joint qui
  f.append(box(40, 140, 150, 44, C.green), txt(115, 160, 'PC 192.168.10.100', 'co-s'), txt(115, 175, 'même réseau : direct', 'co-s', 'middle', { fill: C.green }));
  f.append(box(250, 140, 150, 44, C.cyan), txt(325, 160, 'CAM 1 192.168.10.11', 'co-s'), txt(325, 175, 'masque /24', 'co-s'));
  f.append(box(460, 140, 150, 44, C.red), txt(535, 160, 'CAM 192.168.0.10', 'co-s'), txt(535, 175, 'autre réseau', 'co-s', 'middle', { fill: C.red }));
  f.append(ligne(190, 162, 250, 162, C.green), ligne(400, 162, 460, 162, C.red, 1.6, '5 4'), txt(430, 152, 'routeur ?', 'co-s', 'middle', { fill: C.red }));
  // l'URL
  f.append(box(40, 204, 640, 50, C.grey), txt(60, 226, 'http://192.168.10.11/', 'co-t', 'start'), txt(60, 244, 'port 80, sous-entendu', 'co-s', 'start', { fill: C.dim }));
  f.append(txt(380, 226, 'http://192.168.10.12:8080/', 'co-t', 'start'), txt(380, 244, 'une caméra réglée sur le port 8080', 'co-s', 'start', { fill: C.dim }));
  return f;
}
function demoAdresse(host) {
  let cam = '192.168.10.11', mc = '255.255.255.0', pc = '192.168.0.100', mp = '255.255.255.0', gw = '192.168.10.1', port = '80';
  const read = readout(['Réseau de la caméra', 'Réseau du PC', 'La passerelle', 'L\'URL de sa page web']);
  const verdict = el('p', { class: 'co-verdict' });
  const calc = () => {
    const Rc = reseauDe(cam, mc), Rp = reseauDe(pc, mp);
    read.set('Réseau de la caméra', Rc ? `${Rc.reseau}/${Rc.p} : ${Rc.hotes} adresses d'appareil, diffusion ${Rc.diffusion}${adresseHote(cam, mc) ? '' : ' (cette adresse est celle du réseau ou de diffusion !)'}` : 'adresse ou masque invalide');
    read.set('Réseau du PC', Rp ? `${Rp.reseau}/${Rp.p}` : 'adresse ou masque invalide');
    read.set('La passerelle', !gw ? 'aucune' : !ipOk(gw) ? 'invalide' : Rc && dansReseau(cam, mc, gw) ? `${gw}, dans le réseau de la caméra` : `${gw} n'est pas dans le réseau de la caméra : refusée`);
    const p = Number(port);
    read.set('L\'URL de sa page web', ipOk(cam) && p >= 1 && p <= 65535 ? `http://${cam}${p !== 80 ? ':' + p : ''}/` : '—');
    const ok = Rc && Rp && adresseHote(cam, mc) && dansReseau(pc, mp, cam) && dansReseau(cam, mc, pc) && cam !== pc;
    verdict.className = 'co-verdict ' + (ok ? 'ok' : 'ko');
    verdict.textContent = !Rc || !Rp ? 'Une adresse ou un masque n\'est pas valide.' : cam === pc ? 'Le PC et la caméra ont la même adresse : conflit, aucun des deux ne répond sûrement.' : ok ? 'Le PC et la caméra sont dans le même réseau : la page web s\'ouvre directement.' : !dansReseau(pc, mp, cam) ? `La caméra n'est pas dans le réseau du PC (${Rp.reseau}/${Rp.p}) : sans routeur, le PC ne la joint pas. Changez l'adresse du PC ou celle de la caméra.` : `Le PC voit la caméra dans son réseau, mais la caméra ne voit pas le PC dans le sien (masque ${mc}) : elle ne sait pas lui répondre.`;
  };
  host.append(
    el('div', { class: 'co-ctl' }, saisie('Adresse de la caméra', cam, (v) => { cam = v; calc(); }), saisie('Masque de la caméra', mc, (v) => { mc = v; calc(); }), saisie('Passerelle de la caméra', gw, (v) => { gw = v; calc(); }), saisie('Port HTTP', port, (v) => { port = v; calc(); })),
    el('div', { class: 'co-ctl' }, saisie('Adresse du PC', pc, (v) => { pc = v; calc(); }), saisie('Masque du PC', mp, (v) => { mp = v; calc(); })),
    verdict, read.el);
  calc();
}

// ======================================================================================
// 4. Easy IP Setup : trouver et adresser les caméras
// ======================================================================================
function figEasyIp() {
  const f = figure(720, 280, `Easy IP Setup sur le PC technique. Le PC, en 192.168.10.100, envoie sa recherche en diffusion sur le segment Ethernet : les trois caméras neuves répondent, toutes en ${USINE.ip}, chacune avec son adresse MAC. Le logiciel les liste par MAC : on règle chacune à son tour (Network Settings, Save). En bas, la fenêtre de ${FENETRE_EASYIP} minutes : une caméra réglée sur « 20min » n'est plus affichée ni réglable passé ce délai sous tension, jusqu'au prochain redémarrage ; réglée sur « Unlimited », elle l'est toujours.`);
  f.append(txt(10, 16, 'Chercher en diffusion, distinguer par la MAC, régler une par une', 'co-t', 'start'));
  f.append(box(20, 40, 170, 60, C.grey), txt(105, 62, 'PC technique', 'co-t'), txt(105, 80, '192.168.10.100', 'co-s'), txt(105, 94, 'Easy IP Setup : Search', 'co-s', 'middle', { fill: C.cyan }));
  const cams = [['CAM 1', '08-00-23-5B-35-5D'], ['CAM 2', '08-00-23-6C-5A-92'], ['CAM 3', '08-00-23-7D-7F-C7']];
  cams.forEach(([n, mac], i) => { const y = 34 + i * 46; f.append(box(470, y, 230, 38, C.cyan), txt(585, y + 16, `${n} · ${USINE.ip}`, 'co-s'), txt(585, y + 31, `MAC ${mac}`, 'co-s', 'middle', { fill: C.dim })); f.append(ligne(190, 70, 470, y + 19, C.cyan, 1.2, i === 1 ? '' : '4 3')); });
  f.append(txt(330, 52, 'diffusion : « qui est là ? »', 'co-s', 'middle', { fill: C.cyan }), txt(330, 150, 'chacune répond avec sa MAC', 'co-s'));
  // la fenêtre
  const x0 = 40, x1 = 680, y = 210, k = (x1 - x0) / 40;
  f.append(ligne(x0, y, x1, y, C.grey), txt(x0, y + 18, '0', 'co-s'), txt(x0 + 20 * k, y + 18, '20 min', 'co-s'), txt(x1, y + 18, '40 min', 'co-s'));
  f.append(sv('rect', { x: x0, y: y - 30, width: 20 * k, height: 18, fill: C.green, 'fill-opacity': 0.35 }), txt(x0 + 10 * k, y - 17, '« 20min » : affichée et réglable', 'co-s'));
  f.append(sv('rect', { x: x0 + 20 * k, y: y - 30, width: 20 * k, height: 18, fill: C.red, 'fill-opacity': 0.25 }), txt(x0 + 30 * k, y - 17, 'plus affichée : redémarrer', 'co-s'));
  f.append(sv('rect', { x: x0, y: y + 30, width: 40 * k, height: 14, fill: C.cyan, 'fill-opacity': 0.25 }), txt(x0 + 20 * k, y + 41, '« Unlimited » : toujours affichée', 'co-s'));
  return f;
}
function demoEasyIp(host) {
  const st = bancUsine();
  st.appareils.forEach((a, i) => { a.port = i + 1; a.t0 = 0; });
  Object.assign(st.appareils[0], { ip: '192.168.10.100', masque: '255.255.255.0', passerelle: '192.168.10.1' });
  const read = readout(['Caméras affichées', 'Pas affichées', 'Le PC joint']);
  const verdict = el('p', { class: 'co-verdict' });
  const calc = () => {
    majTension(st);
    const R = rechercheEasyIp(st);
    read.set('Caméras affichées', R.liste.length ? R.liste.map((c) => `${c.nom} (${c.modele}, MAC ${c.mac}) en ${c.ip}`).join(' · ') : 'aucune');
    read.set('Pas affichées', R.masquees.length ? R.masquees.map((id) => st.appareils.find((a) => a.id === id).nom).join(', ') + ` : plus de ${FENETRE_EASYIP} min sous tension, réglées sur « 20min »` : 'aucune');
    const d = new Set(R.liste.map((c) => c.ip)).size < R.liste.length;
    read.set('Le PC joint', R.liste.filter((c) => c.joignable).map((c) => c.nom).join(', ') || 'aucune : elles ne sont pas dans son réseau, ou elles ont la même adresse');
    verdict.className = 'co-verdict ' + (R.masquees.length ? 'ko' : d ? 'warn' : 'ok');
    verdict.textContent = R.masquees.length ? 'Une caméra a passé sa fenêtre : coupez puis rendez son PoE (elle redémarre), ou réglez « Unlimited » dans sa page web.' : d ? 'Les caméras neuves ont toutes la même adresse : Easy IP Setup les distingue par leur MAC. Réglez-les une par une.' : 'Chaque caméra a sa propre adresse.';
  };
  const cams = st.appareils.filter((a) => a.id.startsWith('cam'));
  host.append(
    el('div', { class: 'co-ctl' }, slider('Minutes depuis la mise sous tension', 0, 40, 0, 1, (v) => { st.minutes = v; calc(); }, (v) => `${v} min`)),
    el('div', { class: 'co-ctl' }, ...cams.map((c) => choice(`${c.nom} (${MODELES[c.modele].nom})`, [['20min', '20min'], ['illimite', 'Unlimited']], c.periode, (v) => { c.periode = v; calc(); })),
      choice('Adresse de CAM 1', [['usine', USINE.ip], ['plan', '192.168.10.11']], 'usine', (v) => { cams[0].ip = v === 'plan' ? '192.168.10.11' : USINE.ip; calc(); }),
      choice('Adresse de CAM 3', [['usine', USINE.ip], ['plan', '192.168.10.13']], 'usine', (v) => { cams[2].ip = v === 'plan' ? '192.168.10.13' : USINE.ip; calc(); })),
    verdict, read.el);
  calc();
}

// ======================================================================================
// 5. PoE et PoE+ : classes et budget
// ======================================================================================
function figPoe() {
  const f = figure(720, 250, `Le PoE : le switch envoie le courant par les paires du câble réseau. En PoE (IEEE 802.3af), ${POE.af.pse} W au départ du port, ${POE.af.pd} W à l'arrivée ; en PoE+ (802.3at), ${POE.at.pse} W et ${POE.at.pd} W : la différence se perd dans 100 m de câble. Les classes : 1 = 4 W, 2 = 7 W, 3 = 15,4 W, 4 = 30 W. Les caméras AW-HE130 et AW-UE20 et le pupitre AW-RP150 demandent du PoE+ (classe 4). En bas, le budget d'un switch de 125 W : quatre appareils de classe 4 réservent 120 W ; un cinquième resterait éteint.`);
  f.append(txt(10, 16, 'Le courant par le câble réseau : le switch détecte, lit la classe, réserve', 'co-t', 'start'));
  const rows = [['PoE (802.3af)', POE.af.pse, POE.af.pd, 'classes 0 à 3'], ['PoE+ (802.3at)', POE.at.pse, POE.at.pd, 'classe 4 : caméras, pupitre']];
  rows.forEach(([n, a, b, c], i) => { const y = 40 + i * 52; f.append(box(20, y, 680, 42, i ? C.amber : C.grey), txt(40, y + 26, /** @type {string} */ (n), 'co-t', 'start'), txt(250, y + 26, `${fmtNum(/** @type {number} */ (a), 1)} W au port`, 'co-s', 'start'), txt(390, y + 26, `${fmtNum(/** @type {number} */ (b), 2)} W à l'appareil`, 'co-s', 'start'), txt(560, y + 26, /** @type {string} */ (c), 'co-s', 'start', { fill: C.dim })); });
  // le budget
  const x0 = 20, W = 680, y = 170, k = W / 125;
  f.append(sv('rect', { x: x0, y, width: W, height: 26, rx: 4, fill: C.box, stroke: C.grey }));
  [['CAM 1', C.cyan], ['CAM 2', C.cyan], ['CAM 3', C.violet], ['Pupitre', C.amber]].forEach(([n, col], i) => { f.append(sv('rect', { x: x0 + i * 30 * k, y, width: 30 * k - 2, height: 26, rx: 3, fill: col, 'fill-opacity': 0.55 }), txt(x0 + i * 30 * k + 15 * k, y + 17, `${n} · 30 W`, 'co-s')); });
  f.append(txt(x0, y + 46, 'budget du switch : 125 W · réservé : 120 W (allocation par classe) · consommé : ≈ 92 W', 'co-s', 'start'));
  return f;
}
function demoPoe(host) {
  const st = bancUsine();
  st.appareils.forEach((a, i) => { a.port = i + 1; });
  const read = readout(['Réservé sur le budget', 'Consommé (ordre de grandeur)']);
  const lignes = el('ol', { class: 'co-trace' });
  const verdict = el('p', { class: 'co-verdict' });
  const calc = () => {
    const A = alimentation(st);
    read.set('Réservé sur le budget', `${A.reserve} W sur ${st.switch.budget} W`);
    read.set('Consommé (ordre de grandeur)', `≈ ${A.conso} W`);
    lignes.replaceChildren(...st.appareils.filter((a) => a.id !== 'pc').map((a) => { const r = A.par[a.id]; return el('li', { class: r.alimente ? 'ok' : 'ko' }, `${a.nom} (${MODELES[a.modele].nom}) : ${r.alimente ? (a.secteur ? 'en marche sur son bloc 12 V' : `en marche, ${r.reserve} W réservés`) : r.pb}`); }));
    const eteints = st.appareils.filter((a) => !A.par[a.id].alimente).length;
    verdict.className = 'co-verdict ' + (eteints ? 'ko' : 'ok');
    verdict.textContent = eteints ? `${eteints} appareil${eteints > 1 ? 's' : ''} éteint${eteints > 1 ? 's' : ''}. Un port en PoE simple ne démarre pas un appareil de classe 4 ; au-delà du budget, les derniers ports restent sans courant.` : 'Tout le banc est en marche.';
  };
  const ports = st.appareils.filter((a) => a.id !== 'pc');
  host.append(
    el('div', { class: 'co-ctl' }, slider('Budget du switch', 30, 240, st.switch.budget, 1, (v) => { st.switch.budget = v; calc(); }, (v) => `${v} W`)),
    el('div', { class: 'co-ctl' }, ...ports.map((a) => choice(`Port de ${a.nom}`, [['at', 'PoE+'], ['af', 'PoE'], ['off', 'coupé'], ['bloc', 'bloc 12 V']], 'at', (v) => {
      a.secteur = v === 'bloc';
      st.switch.ports = st.switch.ports.map((p) => (p.n === a.port ? { ...p, poe: v === 'bloc' ? 'off' : v } : p)); calc();
    }))),
    verdict, read.el, lignes);
  calc();
}

// ======================================================================================
// 6. La page web de la caméra : compte, réseau, réglages avancés
// ======================================================================================
function figWeb() {
  const f = figure(720, 260, `La page web d'une caméra Panasonic, ouverte depuis le navigateur du PC à l'adresse de la caméra. Au premier accès, l'AW-UE20 demande de créer le compte administrateur ; l'AW-HE130 a un compte d'usine (${COMPTE_USINE.user}, ${COMPTE_USINE.mdp}) à changer. Puis deux écrans : Live (l'image, la commande) et Setup. Dans Setup : Basic, User mng. (les comptes), Network, avec deux onglets : Network (DHCP, IP address, Subnet mask, Default gateway, HTTP port, DNS, Easy IP Setup accommodate period) et Advanced (Diffserv, et les services réseau).`);
  f.append(txt(10, 16, 'Live pour l\'image, Setup pour les réglages', 'co-t', 'start'));
  f.append(box(20, 40, 200, 74, C.amber), txt(120, 62, 'Premier accès', 'co-t'), txt(120, 80, 'AW-UE20 : créer le compte', 'co-s'), txt(120, 96, 'AW-HE130 : changer admin/12345', 'co-s'));
  f.append(ligne(220, 77, 260, 77), box(260, 40, 120, 74, C.grey), txt(320, 70, 'Live', 'co-t'), txt(320, 88, 'image, commande', 'co-s'));
  f.append(box(400, 40, 300, 200, C.cyan), txt(550, 60, 'Setup', 'co-t'));
  const items = [['Basic', 'nom, format'], ['User mng.', 'comptes, mots de passe'], ['Network → Network', 'DHCP, IP, masque, passerelle, HTTP port, DNS, fenêtre Easy IP'], ['Network → Advanced', 'Diffserv (DSCP), services réseau']];
  items.forEach(([a, b], i) => { const y = 82 + i * 38; f.append(txt(416, y, a, 'co-s', 'start', { fill: C.white }), txt(416, y + 16, b, 'co-s', 'start', { fill: C.dim })); });
  f.append(box(20, 140, 360, 100, C.grey), txt(36, 162, 'Changer l\'adresse ou le port :', 'co-s', 'start', { fill: C.white }), txt(36, 182, 'la caméra redémarre son réseau, la page se perd :', 'co-s', 'start'), txt(36, 200, 'on la rouvre à la nouvelle adresse (et :port),', 'co-s', 'start'), txt(36, 218, 'et l\'on met le pupitre à jour.', 'co-s', 'start'));
  return f;
}
function demoWeb(host) {
  let user = 'admin', mdp = '12345', mdp2 = '12345', ip = '192.168.10.11', port = '80', https = 'http';
  const read = readout(['Le compte', 'L\'URL à taper']);
  const verdict = el('p', { class: 'co-verdict' });
  const calc = () => {
    const r = verifierCompte(user, mdp, mdp2);
    read.set('Le compte', r.ok ? `accepté : ${user}` : r.pb);
    const p = Number(port);
    const u = ipOk(ip) && p >= 1 && p <= 65535 ? `${https}://${ip}${(https === 'http' && p !== 80) || (https === 'https' && p !== 443) ? ':' + p : ''}/` : '—';
    const L = lireUrl(u);
    read.set('L\'URL à taper', L ? `${u} (le navigateur frappe au port ${L.port})` : u);
    verdict.className = 'co-verdict ' + (r.ok ? 'ok' : 'ko');
    verdict.textContent = r.ok ? 'Compte valable : notez-le dans le dossier du banc, pas sur la caméra.' : user === COMPTE_USINE.user && mdp === COMPTE_USINE.mdp ? 'C\'est le compte d\'usine de l\'AW-HE130 : connu de tous, n\'importe quel poste du réseau pourrait piloter la caméra. Changez-le.' : 'Le compte n\'est pas encore valable.';
  };
  host.append(
    el('div', { class: 'co-ctl' }, saisie('User name', user, (v) => { user = v; calc(); }), saisie('Password', mdp, (v) => { mdp = v; calc(); }), saisie('Retype password', mdp2, (v) => { mdp2 = v; calc(); })),
    el('div', { class: 'co-ctl' }, saisie('Adresse de la caméra', ip, (v) => { ip = v; calc(); }), saisie('HTTP port', port, (v) => { port = v; calc(); }), choice('Protocole', [['http', 'http'], ['https', 'https']], https, (v) => { https = v; calc(); })),
    verdict, read.el);
  calc();
}

// ======================================================================================
// 7. Le pupitre AW-RP150 : son adresse, ses caméras, ses commandes
// ======================================================================================
function figPupitre() {
  const f = figure(720, 270, `Le pupitre AW-RP150 : la touche SYSTEM ouvre sur l'écran CONNECT SETTING (chaque numéro de caméra en LAN), MANUAL IP SET, AUTO IP SET et RP IP SET. RP IP SET : l'adresse, le masque et la passerelle du pupitre, dans le réseau des caméras. MANUAL IP SET : une ligne par numéro de caméra, l'adresse IP et le port HTTP. AUTO IP SET : le pupitre attribue les adresses lui-même (on ne le lance pas en même temps qu'Easy IP Setup). À droite, ce que fait un geste : le joystick vers la droite envoie à la caméra la requête http://192.168.10.11/cgi-bin/aw_ptz?cmd=%23PTS7550&res=1, pan vers la droite à la vitesse 25 sur 49, tilt à l'arrêt ; la caméra répond et bouge. Le pupitre pilote 200 caméras en IP, 5 en série ; ses 10 touches appellent les numéros 1 à 10.`);
  f.append(txt(10, 16, 'Touche SYSTEM : le pupitre, le mode LAN, puis une adresse et un port par caméra', 'co-t', 'start'));
  f.append(box(20, 36, 300, 220, C.violet), txt(170, 56, 'AW-RP150 · SYSTEM', 'co-t'));
  f.append(txt(36, 82, 'RP IP SET', 'co-s', 'start', { fill: C.white }), txt(36, 98, '192.168.10.10 / 255.255.255.0, passerelle .1', 'co-s', 'start'));
  f.append(txt(36, 116, 'CONNECT SETTING : CAM1 à CAM3 en LAN', 'co-s', 'start', { fill: C.white }), txt(36, 132, 'MANUAL IP SET', 'co-s', 'start', { fill: C.white }));
  [['CAM1', '192.168.10.11', '80'], ['CAM2', '192.168.10.12', '80'], ['CAM3', '192.168.10.13', '80']].forEach(([n, ip, p], i) => f.append(txt(36, 148 + i * 16, `${n}   ${ip}   port ${p}`, 'co-s', 'start')));
  f.append(txt(36, 206, 'AUTO IP SET', 'co-s', 'start', { fill: C.white }), txt(36, 222, 'adresses attribuées par le pupitre', 'co-s', 'start'), txt(36, 238, '(pas en même temps qu\'Easy IP Setup)', 'co-s', 'start', { fill: C.dim }));
  // la commande
  f.append(ligne(320, 140, 380, 140, C.cyan), box(380, 90, 320, 100, C.cyan), txt(540, 112, 'Un geste au joystick =', 'co-t'), txt(540, 132, 'une requête HTTP à la caméra :', 'co-s'));
  f.append(txt(540, 152, '/cgi-bin/aw_ptz?cmd=%23PTS7550&res=1', 'co-s', 'middle', { fill: C.amber }), txt(540, 172, 'pan droite (75), tilt arrêt (50)', 'co-s'));
  f.append(txt(540, 214, 'vitesses de 01 à 99 ; 50 = arrêt', 'co-s'), txt(540, 232, '« # » s\'écrit %23 dans une URL', 'co-s', 'middle', { fill: C.dim }));
  return f;
}
function demoPupitre(host) {
  let ip = '192.168.10.11', port = '80', p = 25, t = 0, z = 0, mode = 'pt';
  const read = readout(['La commande', 'Ce qu\'elle dit', 'L\'URL envoyée']);
  const calc = () => {
    const cmd = mode === 'zoom' ? commande('zoom', z) : commande('pt', p, t);
    read.set('La commande', `#${cmd}`);
    read.set('Ce qu\'elle dit', lireCommande(cmd));
    read.set('L\'URL envoyée', ipOk(ip) ? urlCommande(ip, Number(port) || 80, cmd) : 'adresse invalide');
  };
  host.append(
    el('div', { class: 'co-ctl' }, saisie('Adresse de la caméra', ip, (v) => { ip = v; calc(); }), saisie('Port HTTP', port, (v) => { port = v; calc(); }), choice('Geste', [['pt', 'Joystick (pan, tilt)'], ['zoom', 'Zoom']], mode, (v) => { mode = v; calc(); })),
    el('div', { class: 'co-ctl' },
      slider('Pan', -49, 49, p, 1, (v) => { p = v; calc(); }, (v) => (v ? `${v > 0 ? 'droite' : 'gauche'} ${Math.abs(v)}` : 'arrêt')),
      slider('Tilt', -49, 49, t, 1, (v) => { t = v; calc(); }, (v) => (v ? `${v > 0 ? 'haut' : 'bas'} ${Math.abs(v)}` : 'arrêt')),
      slider('Zoom', -49, 49, z, 1, (v) => { z = v; calc(); }, (v) => (v ? `${v > 0 ? 'serré' : 'large'} ${Math.abs(v)}` : 'arrêt'))),
    read.el);
  calc();
}

export const PTZ_RESEAU = [
  {
    id: 'ptz-adresse', title: 'Adresser une caméra : adresse, masque, passerelle, port', minutes: '8 min',
    essentials: [
      'L\'**adresse IP** désigne l\'appareil ; le **masque** dit quelle partie de l\'adresse désigne le **réseau** : deux appareils du même réseau se joignent directement.',
      'La **passerelle** est le routeur vers les autres réseaux ; elle doit être **dans** le réseau de l\'appareil. Un banc sans routeur : tout le monde dans le même réseau.',
      'Le **port HTTP** (80 par défaut) désigne le serveur web de la caméra ; s\'il change, il s\'écrit dans l\'URL : `http://192.168.10.12:8080`.',
    ],
    figure: figAdresse,
    demoTitle: 'Le PC est en 192.168.0.100 : il ne joint pas la caméra. Corrigez une des deux adresses. Essayez un masque 255.255.255.252 sur la caméra, puis une passerelle hors de son réseau.',
    demo: demoAdresse,
    body: `Sur un réseau IP, chaque appareil a une **adresse** de quatre nombres de 0 à 255 (32 bits) : 192.168.10.11. Le **masque de sous-réseau** dit combien de ces bits désignent le **réseau** ; les autres désignent l'**appareil**. Avec 255.255.255.0 (on écrit aussi **/24**, 24 bits à 1), les trois premiers nombres sont le réseau, 192.168.10.0, et le dernier l'appareil : de .1 à .254. La première adresse (.0) est celle du réseau, la dernière (.255) la **diffusion** (à tous) : ni l'une ni l'autre ne se donne à un appareil.

**Qui joint qui.** Un appareil compare l'adresse qu'il appelle à son propre réseau, avec **son** masque :
- même réseau : il envoie directement, par le switch ;
- autre réseau : il envoie à sa **passerelle**, un **routeur** qui fait suivre. La passerelle est donc toujours une adresse **de son réseau** (souvent .1).

Le banc d'une régie légère n'a pas de routeur : PC, caméras et pupitre sont **dans le même réseau**. Un PC en 192.168.0.100 ne joint pas une caméra en 192.168.10.11 ; on change l'un des deux. Il faut aussi que **chacun** voie l'autre dans son réseau : une caméra avec un masque trop étroit (255.255.255.252, 4 adresses) ne sait pas répondre au PC, même si le PC la voit.

**Deux appareils, une adresse.** Si deux appareils ont la même adresse (un **conflit**), les réponses viennent tantôt de l'un, tantôt de l'autre : rien n'est sûr. Les caméras neuves ont toutes l'adresse d'usine **192.168.0.10** : on les adresse une par une.

**Le port.** Une adresse désigne l'appareil ; le **port** désigne le service qui répond. Le serveur web de la caméra écoute en **TCP** sur le port **80** (443 en HTTPS). Le navigateur et le pupitre frappent au port 80 si on ne leur dit rien ; si la caméra est réglée sur 8080, on tape \`http://adresse:8080\` et on règle le port au pupitre.

**Fixe ou DHCP.** Une caméra peut demander son adresse à un **serveur DHCP**. En régie, on donne des **adresses fixes**, écrites dans la fiche : le pupitre appelle chaque caméra à une adresse qui ne doit pas changer.`,
    plus: `Pour compter les adresses d'un réseau : 2 puissance (32 − préfixe), moins 2 (réseau et diffusion). /24 : 254 appareils ; /25 : 126 ; /26 : 62 ; /27 : 30.

- La leçon « Adresse IP et masque de sous-réseau » du chapitre Le réseau détaille le calcul en binaire.
- Les adresses 192.168.x.x, 10.x.x.x et 172.16 à 172.31.x.x sont **privées** : elles ne sortent pas sur Internet sans traduction (NAT).`,
    car: { text: 'Jouer → Le Labo, atelier Caméras PTZ : la carte réseau du PC technique, la page web de chaque caméra (Network), et la fiche du banc qui dit qui joint qui.' },
    terms: ['sous-reseau', 'passerelle', 'port-http', 'conflit-ip', 'dhcp'],
    competences: ['C12', 'C25'], savoirs: ['K4', 'K2'],
    quiz: [
      { q: 'La caméra est en 192.168.10.11 / 255.255.255.0. Le PC est en 192.168.10.100 / 255.255.255.0. Le PC joint-il la caméra ?', choices: ['Oui : même réseau, 192.168.10.0/24', ['Non : il faut une passerelle', 'La passerelle ne sert que vers un autre réseau ; ici, ils sont dans le même.'], ['Non : les deux derniers nombres diffèrent', 'Avec /24, seul le dernier nombre désigne l\'appareil : les trois premiers sont égaux.']], answer: 0, why: 'Les trois premiers octets sont le réseau (192.168.10) : les deux appareils y sont, le switch suffit.' },
      { q: 'Quelle adresse ne peut pas être donnée à une caméra dans le réseau 192.168.10.0/24 ?', choices: ['192.168.10.255', ['192.168.10.1', 'C\'est une adresse d\'appareil valable (souvent celle du routeur).'], ['192.168.10.254', 'C\'est la dernière adresse d\'appareil du réseau : elle est valable.']], answer: 0, why: '.255 est l\'adresse de diffusion du /24 (tous les bits d\'appareil à 1) : elle s\'adresse à tous, elle ne désigne personne.' },
      { q: 'Une caméra en 192.168.10.11 a pour passerelle 192.168.20.1. Que se passe-t-il ?', choices: ['La passerelle est refusée : elle n\'est pas dans le réseau de la caméra', ['Rien de grave : la passerelle peut être n\'importe où', 'La caméra doit joindre sa passerelle directement : elle est forcément dans son réseau.'], ['La caméra passe en DHCP', 'Une passerelle fausse ne change pas le mode d\'adressage.']], answer: 0, why: 'Pour joindre un autre réseau, la caméra envoie à sa passerelle, qu\'elle doit pouvoir joindre sans routeur : une adresse de son propre réseau.' },
      { q: 'Une caméra est réglée sur le port HTTP 8080. Que tapez-vous dans le navigateur ?', choices: ['http://192.168.10.12:8080', ['http://192.168.10.12', 'Sans port, le navigateur frappe au port 80 : connexion refusée.'], ['http://192.168.10.12/8080', 'Le port se met après deux-points, pas après une barre (qui désigne une page).']], answer: 0, why: 'L\'adresse, deux-points, le port : le navigateur frappe à la bonne porte.' },
      { q: 'Trois caméras neuves sont branchées ensemble ; aucune ne répond sûrement. Pourquoi ?', choices: ['Elles ont la même adresse d\'usine, 192.168.0.10 : conflit', ['Le masque d\'usine est faux', 'Le masque d\'usine (/24) est correct ; c\'est l\'adresse qui est la même pour toutes.'], ['Il manque une passerelle', 'Entre appareils du même réseau, la passerelle ne sert pas.']], answer: 0, why: 'Une même adresse pour trois appareils : les réponses se mélangent. On les adresse une par une (Easy IP Setup les distingue par leur MAC).' },
      { q: 'Combien d\'appareils au plus dans un réseau /26 ?', choices: ['62', ['64', 'Il faut retirer l\'adresse du réseau et celle de diffusion.'], ['254', 'C\'est le /24 ; le /26 a deux bits de réseau de plus.']], answer: 0, why: '2 puissance (32 − 26) = 64 adresses, moins le réseau et la diffusion : 62.' },
    ],
  },
  {
    id: 'ptz-easyip', title: 'Easy IP Setup : trouver et adresser les caméras', minutes: '8 min',
    essentials: [
      '**Easy IP Setup** (Panasonic) cherche les caméras en **diffusion** sur le segment Ethernet : il les trouve **même hors du sous-réseau** du PC, pas au-delà d\'un routeur.',
      'Il les distingue par leur **adresse MAC** : des caméras neuves, toutes en **192.168.0.10**, se règlent **une par une** (Network Settings, Save).',
      'Réglée sur « **20min** », une caméra n\'est plus affichée passé **20 minutes** sous tension : on la **redémarre** (son PoE coupé puis rendu) ou l\'on règle « Unlimited ».',
    ],
    figure: figEasyIp,
    demoTitle: 'Passez la minute à 25 : laquelle disparaît ? Réglez-la sur Unlimited. Puis donnez à CAM 1 et CAM 3 l\'adresse du plan : le PC les joint-il ?',
    demo: demoEasyIp,
    body: `Une caméra neuve a l'adresse d'usine **192.168.0.10** (masque 255.255.255.0). Le PC technique, lui, est dans le réseau de la fiche (192.168.10.100, par exemple) : il ne joint pas la caméra par son navigateur. C'est le rôle d'**Easy IP Setup**, le logiciel Panasonic de mise en service.

**Search.** Le logiciel envoie sa recherche en **diffusion** sur le **segment Ethernet** (le switch, le VLAN) : toutes les caméras répondent, quelle que soit leur adresse IP. La liste montre pour chacune l'**adresse MAC** (l'identifiant gravé dans sa carte réseau, notée sur l'étiquette), l'adresse IPv4, le port, le nom, le modèle. La recherche ne traverse pas de **routeur** : un PC dans un autre VLAN ne voit rien.

**Network Settings.** On choisit une caméra (par sa **MAC** : c'est le seul moyen de distinguer trois caméras à la même adresse), on règle :
- **DHCP** : Off, pour une adresse fixe ;
- **IP address**, **Subnet mask**, **Default gateway** : ceux de la fiche ;
- **Port No.** : le port HTTP (80 par défaut).
Puis **Save** : la caméra redémarre son réseau avec ses nouveaux réglages. Le logiciel peut aussi ouvrir sa page web (**Access Camera**).

**Une par une.** Trois caméras à la même adresse : on les règle chacune à son tour, en vérifiant la MAC sur l'étiquette avant de cliquer. On note dans la fiche la MAC de chaque caméra : c'est ce qui permettra de les retrouver.

**La fenêtre de 20 minutes.** Pour qu'on ne change pas l'adresse d'une caméra en exploitation, le réglage « **Easy IP Setup accommodate period** » limite le logiciel : sur « **20min** », la caméra n'est plus **affichée** ni réglable passé 20 minutes sous tension ; sur « **Unlimited** », elle l'est toujours. L'AW-UE20 sort d'usine sur 20min ; l'AW-HE130 est sur Unlimited depuis son micrologiciel 2.00. Une caméra qui ne s'affiche pas : on la **redémarre** (en PoE, on coupe et on rend le courant de son port) et on cherche à nouveau.`,
    plus: `Le logiciel a été renommé **EasyIPSetupTool Plus** dans ses dernières versions ; les anciennes versions (4.25 et avant) ne voient pas les caméras récentes.

- Le pare-feu du PC doit laisser passer la recherche (le mode d'emploi demande d'autoriser les ports UDP du logiciel).
- Le pupitre AW-RP150 a sa propre attribution automatique (**AUTO IP SET**) : on ne lance pas les deux en même temps.
- Une fois les caméras adressées, on règle le PC et le pupitre dans le même réseau, et tout le reste se fait par la page web.`,
    car: { text: 'Jouer → Le Labo, atelier Caméras PTZ, vue « Le PC technique » : Easy IP Setup (Search, Network Settings, Access Camera). Un défi tire trois caméras sorties du carton, dont une qui a passé ses 20 minutes.' },
    terms: ['easy-ip-setup', 'mac', 'conflit-ip', 'broadcast-ip'],
    competences: ['C12', 'C11', 'C8'], savoirs: ['K4', 'K8'],
    quiz: [
      { q: 'Le PC est en 192.168.10.100, les caméras neuves en 192.168.0.10. Easy IP Setup les trouve-t-il ?', choices: ['Oui : la recherche part en diffusion sur le segment, quelle que soit l\'adresse', ['Non : elles ne sont pas dans le sous-réseau du PC', 'C\'est justement ce qu\'Easy IP Setup permet : il cherche en diffusion, pas par adresse.'], ['Seulement si le PC a une passerelle', 'La recherche ne passe pas par un routeur ; la passerelle n\'y change rien.']], answer: 0, why: 'La diffusion atteint tout le segment Ethernet ; chaque caméra répond avec sa MAC.' },
      { q: 'Trois caméras sont listées, toutes en 192.168.0.10. Comment savoir laquelle est CAM 2 ?', choices: ['Par son adresse MAC, notée sur l\'étiquette de la caméra', ['Par son adresse IP', 'Elles ont toutes la même.'], ['Par l\'ordre de la liste', 'L\'ordre ne dit rien de la place de la caméra sur le plateau.']], answer: 0, why: 'La MAC est unique et gravée dans chaque caméra : on la relève sur l\'étiquette avant de régler.' },
      { q: 'Une AW-UE20 allumée depuis 35 minutes n\'apparaît pas dans Easy IP Setup. Que faites-vous ?', choices: ['Je la redémarre (son PoE coupé puis rendu) et je cherche à nouveau', ['Je change l\'adresse du PC', 'Easy IP Setup cherche en diffusion : l\'adresse du PC n\'empêche pas de trouver la caméra.'], ['Je lance AUTO IP SET au pupitre en même temps', 'On ne lance pas les deux ensemble ; et ce n\'est pas le problème ici.']], answer: 0, why: 'Réglée sur « 20min » (son réglage d\'usine), elle n\'est plus affichée passé 20 minutes sous tension. Un redémarrage ouvre une nouvelle fenêtre.' },
      { q: 'Que fait « Save » dans Network Settings ?', choices: ['La caméra prend les nouveaux réglages et redémarre son réseau', ['Il enregistre les réglages sur le PC seulement', 'Les réglages sont envoyés à la caméra : c\'est elle qui change d\'adresse.'], ['Il crée le compte administrateur', 'Le compte se crée dans la page web de la caméra.']], answer: 0, why: 'Les réglages partent à la caméra ; elle redémarre son réseau à sa nouvelle adresse.' },
      { q: 'Le PC est dans un autre VLAN que les caméras. Easy IP Setup…', choices: ['ne trouve rien : la diffusion ne sort pas du VLAN', ['les trouve, mais ne peut pas les régler', 'La recherche elle-même ne passe pas : la liste reste vide.'], ['les trouve par la passerelle', 'La recherche ne traverse pas de routeur.']], answer: 0, why: 'Un VLAN est un segment à part : la diffusion du PC n\'atteint pas les caméras.' },
      { q: 'Pourquoi la fenêtre de 20 minutes existe-t-elle ?', choices: ['Pour qu\'on ne change pas l\'adresse d\'une caméra en exploitation', ['Pour économiser le PoE', 'Elle ne touche pas l\'alimentation, seulement les réglages réseau par le logiciel.'], ['Pour laisser chauffer le capteur', 'Elle ne concerne que le réseau.']], answer: 0, why: 'Une caméra qui tourne depuis longtemps est sans doute en service : on protège son adressage d\'une fausse manœuvre.' },
    ],
  },
  {
    id: 'ptz-poe', title: 'PoE et PoE+ : alimenter par le câble réseau', minutes: '7 min',
    essentials: [
      'Le **PoE** fait passer le courant par le câble réseau : **802.3af** (15,4 W au port), **802.3at** ou **PoE+** (**30 W** au port, 25,5 W à l\'appareil).',
      'L\'appareil annonce sa **classe** ; les caméras du BTS et le pupitre sont en **classe 4** : il leur faut du **PoE+**, un port en PoE simple ne les démarre pas.',
      'Le switch a un **budget** total : il réserve la puissance de chaque classe, et laisse éteints les ports qui dépassent. Sinon, le **bloc 12 V** de l\'appareil.',
    ],
    figure: figPoe,
    demoTitle: 'Baissez le budget à 90 W : qui s\'éteint ? Mettez le pupitre sur son bloc 12 V. Passez le port de CAM 1 en PoE simple.',
    demo: demoPoe,
    body: `Un appareil en **PoE** (*Power over Ethernet*) reçoit son courant par le même câble que ses données : pas de prise secteur près d'une caméra au plafond. Le switch qui fournit le courant est la **source** ; l'appareil, le **récepteur**.

**Deux normes.**
- **PoE**, IEEE **802.3af** : jusqu'à **15,4 W** au port ; il en arrive **12,95 W** à l'appareil, le reste chauffe le câble (100 m au plus).
- **PoE+**, IEEE **802.3at** : jusqu'à **30 W** au port, **25,5 W** à l'appareil.

**La classe.** Au branchement, le switch **détecte** que l'appareil accepte le PoE (une résistance de signature), puis lit sa **classe** : 1 (4 W), 2 (7 W), 3 (15,4 W), 4 (30 W, le PoE+). Il n'envoie le courant qu'ensuite. Une **AW-HE130**, une **AW-UE20** et le pupitre **AW-RP150** sont en classe 4 : sur un port limité au PoE (15,4 W), ils ne démarrent pas.

**Le budget.** Le switch a une puissance totale pour tous ses ports (125 W sur le switch du banc, comme un switch PoE+ administrable à 8 ports courant en régie). S'il **alloue par classe**, il réserve 30 W à chaque appareil de classe 4, même s'il en consomme moins : deux AW-HE130 (environ 25 W chacune en PoE+), une AW-UE20 (environ 17 W) et le pupitre réservent 120 W pour une consommation d'environ 90 W. Quand le budget est atteint, les ports suivants restent sans courant.

**Quand le budget ne suffit pas.** On choisit un switch plus puissant, on répartit sur deux switchs, ou l'on alimente un appareil par son **bloc 12 V** (le pupitre, posé sur la table, s'y prête bien). Un appareil qui a son bloc ne demande plus de PoE.

**En exploitation.** Débrancher le câble d'une caméra en PoE, c'est aussi **l'éteindre**. À l'inverse, couper puis rendre le PoE de son port (dans l'interface du switch) la **redémarre** à distance : c'est ce qu'on fait pour rouvrir la fenêtre d'Easy IP Setup.`,
    plus: `Le **PoE++** (IEEE 802.3bt) va jusqu'à 60 W (type 3) et 90 W (type 4) au port, sur les quatre paires : pour les caméras PTZ plus lourdes, les écrans, les éclairages.

- Certains switchs allouent selon la **consommation mesurée** plutôt que la classe : ils logent plus d'appareils, avec le risque qu'un appareil qui force (un moteur de tourelle qui démarre) fasse dépasser le budget.
- Un **injecteur** PoE+ alimente un appareil branché à un switch sans PoE.`,
    car: { text: 'Jouer → Le Labo, atelier Caméras PTZ, vue « Le banc » : le mode PoE de chaque port, le budget du switch, le bloc 12 V de chaque appareil. Un défi donne un switch trop faible pour tout le banc.' },
    terms: ['poe', 'classe-poe'],
    competences: ['C25', 'C9', 'C8'], savoirs: ['K3', 'L5'],
    quiz: [
      { q: 'Une AW-HE130 est branchée sur un port réglé en PoE (802.3af). Que se passe-t-il ?', choices: ['Elle ne démarre pas : il lui faut du PoE+ (classe 4)', ['Elle démarre au ralenti', 'Le switch ne fournit pas une puissance que le port ne garantit pas : l\'appareil reste éteint.'], ['Elle démarre normalement', 'Elle annonce la classe 4 : 15,4 W ne lui suffisent pas.']], answer: 0, why: 'Le switch lit la classe 4 ; un port limité à 15,4 W ne peut pas la servir.' },
      { q: 'Combien de watts arrivent à l\'appareil sur un port PoE+ ?', choices: ['25,5 W', ['30 W', 'C\'est ce que fournit le port ; une partie se perd dans le câble.'], ['15,4 W', 'C\'est le PoE simple, au port.']], answer: 0, why: '30 W au départ du port, 25,5 W garantis à l\'appareil après 100 m de câble.' },
      { q: 'Un switch de 90 W alloue par classe. Combien d\'appareils de classe 4 alimente-t-il ?', choices: ['3', ['4', '4 × 30 = 120 W : au-delà du budget.'], ['5', 'Même en comptant 25,5 W, on ne loge pas 5 appareils dans 90 W.']], answer: 0, why: '90 ÷ 30 = 3 : le quatrième port reste sans courant.' },
      { q: 'Le budget du switch ne suffit pas pour le pupitre. La solution la plus simple ?', choices: ['Brancher son bloc 12 V : il ne demande plus de PoE', ['Mettre son port en PoE simple', 'Le pupitre est en classe 4 : il ne démarrerait pas.'], ['Débrancher une caméra', 'On perd une caméra : ce n\'est pas une solution.']], answer: 0, why: 'Posé sur la table, le pupitre a une prise à côté : son bloc secteur libère 30 W du budget.' },
      { q: 'Vous débranchez le câble réseau d\'une caméra en PoE+ pour le passer sur un autre port. La caméra…', choices: ['s\'éteint puis redémarre sur le nouveau port', ['reste allumée', 'Son courant venait du câble : sans lui, elle s\'éteint.'], ['garde sa position et ne redémarre pas', 'Elle redémarre, et refait souvent son initialisation de tourelle.']], answer: 0, why: 'En PoE, le câble réseau est aussi le câble d\'alimentation.' },
      { q: 'Pourquoi un switch réserve-t-il 30 W pour une caméra qui en consomme 17 ?', choices: ['Il alloue selon la classe annoncée, pas selon la consommation', ['Pour chauffer le câble', 'Les pertes du câble sont déjà comptées dans les 30 W ; la réserve vient de la classe.'], ['Parce que le PoE+ fournit toujours 30 W', 'Le port fournit ce que l\'appareil demande, jusqu\'à 30 W ; la réserve, elle, est fixée par la classe.']], answer: 0, why: 'L\'appareil annonce la classe 4 : le switch lui garantit 30 W et les retire de son budget.' },
    ],
  },
  {
    id: 'ptz-web', title: 'La page web de la caméra : compte, réseau, réglages', minutes: '7 min',
    essentials: [
      'La caméra se règle par sa **page web**, depuis le navigateur du PC : `http://adresse` (et `:port` si le port HTTP n\'est pas 80).',
      'L\'**AW-UE20** fait créer le **compte administrateur** au premier accès ; l\'**AW-HE130** a un compte d\'usine (**admin / 12345**) à **changer** : un réseau est partagé.',
      'Setup → **Network** : DHCP, adresse, masque, passerelle, port HTTP, fenêtre d\'Easy IP ; **Advanced** : **Diffserv** (le marquage DSCP). Changer l\'adresse fait perdre la page : on la rouvre.',
    ],
    figure: figWeb,
    demoTitle: 'Le compte d\'usine admin / 12345 est refusé : écrivez-en un bon. Passez la caméra en port 8080, puis en https : quelle URL taper ?',
    demo: demoWeb,
    body: `Une fois adressée, la caméra se règle par sa **page web** : on tape son adresse dans le navigateur du PC (ou « Access Camera » dans Easy IP Setup). Il faut que le PC soit **dans le même réseau** que la caméra.

**Le compte administrateur.** Tout appareil d'un réseau est joignable par tous les postes du réseau : sans mot de passe, n'importe qui pourrait changer l'adresse d'une caméra ou la piloter pendant l'émission.
- L'**AW-UE20** affiche au premier accès l'écran de **création du compte** (User name, Password, Retype password, **Set**). Tant qu'il n'existe pas, un pupitre la **voit** mais ne peut pas la **piloter**.
- L'**AW-HE130** a un **compte d'usine** (admin, 12345 dans son mode d'emploi), le même sur toutes les caméras du monde : on le **change** dans **User mng.** avant d'exploiter.
Un bon mot de passe : au moins 8 caractères, ni le nom ni celui d'usine ; on le note dans le **dossier technique** du banc, pas sur la caméra.

**Live et Setup.** **Live** montre l'image et permet de piloter la caméra ; **Setup** porte les réglages : **Basic** (le nom de la caméra, le format), **User mng.** (les comptes), **Network** en deux onglets.
- **Network** : **DHCP** (Off pour une adresse fixe), **IP address(IPv4)**, **Subnet mask**, **Default gateway**, **HTTP port**, les serveurs **DNS**, et la fenêtre « **Easy IP Setup accommodate period** » (20min ou Unlimited).
- **Advanced** : **Diffserv**, la valeur **DSCP** que la caméra met dans ses paquets vidéo pour que le switch les fasse passer en priorité (leçon « La QoS »), et les autres services du réseau.

**Changer l'adresse ou le port.** Après **Set**, la caméra redémarre son réseau : la page se perd, on la **rouvre à la nouvelle adresse** (et au nouveau port). Puis on met à jour le **pupitre** (MANUAL IP SET) et la **fiche** du banc : un pupitre qui appelle l'ancienne adresse ne pilote plus rien.`,
    plus: `Les tourelles Panasonic proposent aussi le **HTTPS** (port 443) : la page est chiffrée, le navigateur demande d'accepter le certificat de la caméra.

- Les autres comptes (User mng.) peuvent avoir des droits réduits : un compte qui ne fait que regarder l'image, pour un poste de contrôle.
- La page web est aussi le chemin des mises à jour du micrologiciel (Maintenance) : une mise à jour peut changer des réglages d'usine (la fenêtre d'Easy IP de l'AW-HE130 en 2.00, par exemple).`,
    car: { text: 'Jouer → Le Labo, atelier Caméras PTZ, vue « Le PC technique », Navigateur : la création du compte de l\'AW-UE20, le changement du compte d\'usine des AW-HE130, Setup → Network et Advanced.' },
    terms: ['compte-admin', 'port-http', 'dscp'],
    competences: ['C12', 'C11'], savoirs: ['K7', 'K4', 'K9'],
    quiz: [
      { q: 'Vous ouvrez pour la première fois la page web d\'une AW-UE20. Que demande-t-elle ?', choices: ['De créer le compte administrateur', ['Le compte d\'usine admin / 12345', 'C\'est le compte d\'usine de l\'AW-HE130 ; l\'AW-UE20 fait créer le sien.'], ['Rien : elle s\'ouvre sur Live', 'Pas avant que le compte administrateur existe.']], answer: 0, why: 'Premier accès : User name, Password, Retype password, Set. Sans ce compte, le pupitre ne peut pas la piloter.' },
      { q: 'Pourquoi change-t-on le compte d\'usine d\'une AW-HE130 ?', choices: ['Il est le même partout et connu de tous : n\'importe quel poste du réseau pourrait la piloter', ['Parce qu\'il expire au bout de 20 minutes', 'Ce sont les réglages d\'Easy IP qui ont une fenêtre de 20 minutes, pas le compte.'], ['Parce que le pupitre le refuse', 'Le pupitre s\'en accommode ; c\'est une question de sécurité.']], answer: 0, why: 'Un réseau est partagé : le compte d\'usine, écrit dans le mode d\'emploi, n\'est pas une protection.' },
      { q: 'Vous changez l\'adresse de la caméra dans Setup → Network et cliquez sur Set. La page…', choices: ['se perd : on la rouvre à la nouvelle adresse', ['se recharge seule à la nouvelle adresse', 'Le navigateur ne connaît que l\'ancienne adresse.'], ['reste ouverte, l\'adresse change plus tard', 'La caméra redémarre son réseau tout de suite.']], answer: 0, why: 'La caméra quitte l\'ancienne adresse : on tape la nouvelle, puis on met à jour le pupitre et la fiche.' },
      { q: 'Où règle-t-on le marquage DSCP de la vidéo de la caméra ?', choices: ['Setup → Network → Advanced : Diffserv', ['Setup → User mng.', 'C\'est la page des comptes.'], ['Dans Easy IP Setup', 'Easy IP Setup règle l\'adressage, pas la qualité de service.']], answer: 0, why: 'L\'onglet Advanced de Network porte Diffserv, la valeur DSCP des paquets vidéo.' },
      { q: 'La page web ne s\'ouvre pas : « délai dépassé ». La caméra répond pourtant à Easy IP Setup. Que vérifiez-vous ?', choices: ['Que le PC est dans le même réseau que la caméra', ['Le compte administrateur', 'Sans réseau commun, la page ne s\'affiche même pas : le compte vient après.'], ['Le PoE du port', 'Elle répond à Easy IP Setup : elle est alimentée.']], answer: 0, why: 'Easy IP Setup trouve la caméra par diffusion, hors du sous-réseau ; le navigateur, lui, a besoin d\'un réseau commun.' },
      { q: 'Où note-t-on le mot de passe du compte administrateur d\'une caméra du banc ?', choices: ['Dans le dossier technique du banc', ['Sur une étiquette collée sur la caméra', 'Tout le monde pourrait le lire : il ne protège plus rien.'], ['Nulle part', 'Le jour où il faut régler la caméra, plus personne ne pourrait y entrer.']], answer: 0, why: 'Le dossier technique est rangé et transmis ; une étiquette sur la caméra annule la protection.' },
    ],
  },
  {
    id: 'ptz-pupitre', title: 'Le pupitre AW-RP150 : enregistrer et piloter les caméras', minutes: '8 min',
    essentials: [
      'Le pupitre a sa propre adresse (**RP IP SET**), **dans le réseau des caméras** ; puis chaque numéro de caméra reçoit une **adresse IP et un port** (**MANUAL IP SET**).',
      'Chaque geste envoie une **requête HTTP** à la caméra : `/cgi-bin/aw_ptz?cmd=%23PTS7550&res=1` (pan à droite, tilt à l\'arrêt) ; vitesses de **01 à 99**, **50 à l\'arrêt**.',
      'L\'AW-RP150 pilote **200 caméras en IP** (5 en série) ; ses **10 touches** appellent les numéros 1 à 10. Une caméra sans compte administrateur ne se pilote pas.',
    ],
    figure: figPupitre,
    demoTitle: 'Composez la commande d\'un panoramique lent vers la gauche, puis d\'un zoom rapide vers le serré. Passez la caméra en port 8080 : que change l\'URL ?',
    demo: demoPupitre,
    body: `Le **AW-RP150** est le pupitre de commande des tourelles Panasonic : un **joystick** (pan, tilt), une commande de **zoom**, les réglages de l'image (iris, gain, balance, détail), les **touches de caméra** et un **écran tactile** de 7 pouces. Il s'alimente en **PoE+** ou par son bloc 12 V. Il pilote jusqu'à **200 caméras en IP**, et 5 par liaison série RS-422.

**La face avant** (mode d'emploi) : en haut à gauche, les réglages de caméra (molettes IRIS et sa touche AUTO, M.PED, R/B GAIN, R/B PED ; touches A/3200K, B/5600K, ATW/VAR, ABB, BARS) ; au centre, l'écran tactile et, dessous, les molettes **F1 à F4** ; les touches de menu **PAINT**, **FUNCTION**, **MAINTENANCE**, **PMEM/TMEM**, **SYSTEM** (un second appui revient à l'écran d'état) ; en bas, **CAMERA/GROUP SELECTION 1 à 10** ; à droite, **ENABLE** (qui déverrouille le joystick et le levier), le joystick et son levier à bascule (zoom, ou point avec ZOOM/FOCUS). L'écran d'état montre le numéro, le modèle, le TALLY, l'IRIS, le ZOOM et le FOCUS de la caméra choisie.

**La face arrière** : **IP CONT** (RJ45, le réseau et le PoE+), **SERIAL CONT 1 à 5** (RJ45 aussi, RS-422 et tally vers une caméra : pas de PoE+ ici), **3G SDI IN** et **ACTIVE THRU** (l'image de retour, affichée sur l'écran), **TALLY/GPIO 1** et **GPIO 2** (Sub-D 25 broches : le tally du mélangeur entre par la première), **DC 12V IN** (XLR 4 broches).

**Mettre le pupitre en réseau.** Touche **SYSTEM**, puis sur l'écran :
- **RP IP SET** : l'adresse, le masque et la passerelle du pupitre. Il doit être **dans le réseau des caméras** : le banc n'a pas de routeur. Sur le banc, le pupitre arrive en 192.168.0.9 (l'adresse des exemples de mise en service Panasonic) ; on le met à l'adresse de la fiche.
- **CONNECT SETTING** : pour chaque numéro de caméra, le mode de liaison (**CNNCT MD**) : **LAN**, SERIAL ou NONE. Un numéro qui n'est pas en LAN n'est pas piloté par le réseau.
- **MANUAL IP SET** : une ligne par **numéro de caméra** : son adresse IP et son **port HTTP**. CAM1 → 192.168.10.11, port 80, et ainsi de suite.
- **AUTO IP SET** : le pupitre attribue les adresses lui-même ; pratique pour un banc neuf, mais on ne le lance pas en même temps qu'Easy IP Setup, et l'on perd la maîtrise du plan.
La touche d'une caméra s'allume quand la liaison tient (en rouge quand elle est à l'antenne, si le tally du mélangeur arrive sur TALLY/GPIO 1). Si elle reste éteinte : l'adresse, le port, le réseau, ou une caméra sans **compte administrateur** (l'AW-UE20 se voit mais ne se pilote pas tant qu'il n'existe pas).

**Ce que fait un geste.** Le pupitre parle à la caméra en **HTTP**, comme un navigateur. Pousser le joystick à droite envoie :
\`http://192.168.10.11/cgi-bin/aw_ptz?cmd=%23PTS7550&res=1\`
- \`#PTS\` : pan et tilt ensemble ; deux chiffres pour la vitesse du pan, deux pour le tilt ;
- de **01 à 99** : **50**, c'est l'arrêt ; au-dessus, vers la droite (ou le haut), en dessous, vers la gauche (ou le bas) ; plus on s'éloigne de 50, plus c'est rapide ;
- \`#Z\` suivi de deux chiffres : le zoom, sur le même principe ;
- le \`#\` s'écrit **%23** dans une URL.
Au relâché, le pupitre envoie l'arrêt (\`#PTS5050\`). La caméra répond par un court message (\`pTS5050\`).

**Le tally.** Le mélangeur dit au pupitre, par ses **GPIO**, quelle caméra est à l'antenne ; le pupitre allume le voyant rouge de la bonne caméra.`,
    plus: `La même requête peut venir d'un logiciel ou d'un navigateur : c'est ainsi que des régies logicielles (vMix, OBS avec un greffon) pilotent les tourelles Panasonic. Le protocole est publié par Panasonic (spécification d'interface des caméras intégrées).

- La caméra peut aussi **prévenir** le pupitre d'un changement (une position, le tally) : le pupitre s'abonne par HTTP et la caméra le rappelle sur un port TCP qu'il a choisi.
- Après tout changement d'adresse (du pupitre ou d'une caméra), on vérifie que chaque touche se rallume, puis on bouge chaque caméra : c'est la recette.`,
    car: { text: 'Jouer → Le Labo, atelier Caméras PTZ, vue « Le pupitre » : CONNECT SETTING (RP IP SET, MANUAL IP SET), les touches de caméra, le joystick et la commande HTTP qu\'il envoie.' },
    terms: ['aw-rp150', 'port-http', 'compte-admin'],
    competences: ['C25', 'C23', 'C8'], savoirs: ['G8', 'K4'],
    quiz: [
      { q: 'Le pupitre est en 192.168.0.9 / 24, les caméras en 192.168.10.x / 24. Que voit-on ?', choices: ['Aucune touche ne s\'allume : le pupitre n\'est pas dans leur réseau', ['Tout marche : le pupitre trouve les caméras', 'Sans routeur, le pupitre ne joint pas un autre réseau.'], ['Seule la première caméra répond', 'Elles sont toutes dans le même réseau, aucune dans celui du pupitre.']], answer: 0, why: 'RP IP SET d\'abord : le pupitre dans le réseau des caméras.' },
      { q: 'Quelle commande arrête le pan et le tilt ?', choices: ['#PTS5050', ['#PTS0000', '00 n\'est pas une vitesse : la plage va de 01 à 99.'], ['#PTS9999', 'C\'est la vitesse la plus grande, vers la droite et vers le haut.']], answer: 0, why: '50 est le milieu : l\'arrêt, pour le pan comme pour le tilt.' },
      { q: 'CAM 2 écoute sur le port 8080. Dans MANUAL IP SET, vous laissez le port 80. Que se passe-t-il ?', choices: ['Sa touche reste éteinte : le pupitre frappe au mauvais port', ['Le pupitre trouve tout seul le bon port', 'Il appelle le port qu\'on lui a donné.'], ['La caméra change son port pour 80', 'Le pupitre ne règle pas la caméra.']], answer: 0, why: 'Adresse et port doivent être ceux que la caméra écoute.' },
      { q: 'La touche de l\'AW-UE20 reste éteinte ; adresse, port et réseau sont justes. Que manque-t-il ?', choices: ['Son compte administrateur, à créer dans sa page web', ['Une passerelle au pupitre', 'Entre appareils du même réseau, la passerelle ne sert pas.'], ['AUTO IP SET', 'Les adresses sont déjà justes ; et on ne lance pas AUTO IP SET pour ça.']], answer: 0, why: 'Sans compte administrateur, l\'AW-UE20 est vue par le pupitre mais ne se laisse pas piloter.' },
      { q: 'Dans une URL, pourquoi écrit-on %23 au lieu de # ?', choices: ['Parce que # a un autre sens dans une URL (le repère dans une page)', ['Parce que la caméra ne connaît pas le caractère #', 'La caméra attend bien #PTS… ; c\'est l\'URL qui doit l\'encoder.'], ['Pour chiffrer la commande', '%23 n\'est pas un chiffrement : c\'est le code du caractère #.']], answer: 0, why: 'Dans une URL, # sépare un repère ; on encode le caractère par son code, %23, pour qu\'il arrive à la caméra.' },
      { q: 'Combien de caméras l\'AW-RP150 pilote-t-il en IP ?', choices: ['200', ['10', 'C\'est le nombre de touches de caméra en façade ; les numéros vont bien au-delà.'], ['5', 'C\'est le nombre de caméras en liaison série RS-422.']], answer: 0, why: '200 caméras en IP, 5 en série ; les 10 touches appellent les numéros 1 à 10 (d\'autres par les groupes).' },
    ],
  },
];
