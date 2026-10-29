// @ts-check
import { el } from '../../util.js';
import { zone, texte, ecran, libere } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';
import { parseIp, ipStr, netOf, bcastOf, sameNet, infoReseau, bits32 } from '../../cours/ip_calc.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Adresses, masque et diffusion » : huit machines sur un même commutateur, dans un même VLAN, et un
// routeur. Le masque choisi range les machines en sous-réseaux (une zone de couleur par sous-réseau, son adresse
// réseau et sa diffusion au-dessus) ; l'écran du fond montre en binaire l'adresse de la machine choisie, le masque,
// le réseau (ET logique) et la diffusion. Une diffusion arrive à toutes les machines du commutateur (même VLAN),
// mais seules celles du sous-réseau la gardent ; vers un autre sous-réseau, il faut passer par la passerelle.
// Calculs : cours/ip_calc.js (ceux du poste Réseau, net/ctrlnet.js).
// ----------------------------------------------------------------------------------
const MACH = [
  { id: 'm1', type: 'pc', nom: 'PC supervision', ip: '10.1.20.10' },
  { id: 'm2', type: 'rcp', nom: 'RCP 1', ip: '10.1.20.40' },
  { id: 'm3', type: 'ccu', nom: 'CCU 1', ip: '10.1.20.70' },
  { id: 'm4', type: 'intercom', nom: 'Panneau intercom', ip: '10.1.20.100' },
  { id: 'm5', type: 'serveur', nom: 'Serveur de clips', ip: '10.1.20.140' },
  { id: 'm6', type: 'ccu', nom: 'CCU 2', ip: '10.1.20.170' },
  { id: 'm7', type: 'rcp', nom: 'RCP 2', ip: '10.1.20.200' },
  { id: 'm8', type: 'portable', nom: 'Portable', ip: '10.1.20.230' },
];
const COLS = [0xffb020, 0x4cc3e6, 0x3fcf6e, 0xd08cff, 0xff8a80, 0xc8d0d8, 0xffe08a, 0x7fd3f3];
const APIPA = '169.254.37.12';
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export const VUE_RESEAU_ADRESSES = {
  id: 'reseau-adresses', chapitre: 'reseau', titre: 'Adresses, masque et diffusion',
  resume: 'Huit machines sur un commutateur : le masque les range en sous-réseaux, l\'écran montre les bits, une diffusion n\'est gardée que dans son sous-réseau, la passerelle relie les sous-réseaux.',
  lecons: ['reseau-adresses', 'reseau-types', 'reseau-ip'],
  lectures: ['Machine choisie', 'Masque', 'Son réseau', 'Sa diffusion', 'Sous-réseaux', 'Dernier envoi'],
  depart: 'Chaque zone de couleur est un sous-réseau. Change le masque, choisis une machine, envoie une diffusion (« À toi »).',
  vue: { cible: [0.2, 1.35, -0.4], dir: [0, 0.42, 1], dist: 14.2 },
  orbite: { rMin: 1.5, rMax: 22 },
  etapes: [
    { t: '32 bits : une partie réseau, une partie appareil', reglage: { p: 24, sel: 'm2' }, lecon: 'reseau-adresses', vue: { cible: [-0.4, 2.3, -1.4], dir: [0, 0.22, 1], dist: 7.2 },
      texte: `Huit machines du car, toutes sur le même commutateur. Chacune a une adresse de **32 bits** : l'écran du fond montre celle du RCP 1, 10.1.20.40, bit par bit.

Le **masque** /24 dit que les 24 premiers bits (en jaune) désignent le **réseau**, les 8 derniers (en bleu) l'**appareil**. Les huit machines ont les mêmes 24 premiers bits : elles sont dans le même sous-réseau, une seule zone.` },
    { t: 'L\'adresse réseau et l\'adresse de diffusion', reglage: { p: 24, sel: 'm2' }, lecon: 'reseau-adresses', vue: { cible: [-0.4, 2.2, -1.2], dir: [0, 0.3, 1], dist: 8.5 },
      texte: `Sur l'écran : un **ET logique** entre l'adresse et le masque met les bits d'appareil à 0 et donne l'**adresse réseau**, 10.1.20.0. Tous les bits d'appareil à 1 donnent l'**adresse de diffusion**, 10.1.20.255.

Ni l'une ni l'autre ne se donne à un appareil : en /24, les machines vont de .1 à .254, soit 254 appareils. Le nom du sous-réseau flotte au-dessus de sa zone.` },
    { t: 'Une diffusion : tout le sous-réseau', reglage: { p: 24, sel: 'm1', envoi: 'diff' }, lecon: 'reseau-adresses',
      texte: `Le PC de supervision envoie un paquet à **10.1.20.255**. Il part dans une trame Ethernet de diffusion : le commutateur la recopie sur tous ses ports.

Les sept autres machines la **gardent** : elle est adressée à la diffusion de leur sous-réseau. Le **routeur** la reçoit aussi, mais ne la fait pas suivre : une diffusion ne sort jamais du réseau local.` },
    { t: 'Allonger le masque : deux sous-réseaux', reglage: { p: 25, sel: 'm1', envoi: 'diff' }, lecon: 'reseau-adresses',
      texte: `Masque **/25** (255.255.255.128) : un bit de plus pour le réseau. Le /24 se coupe en deux : **10.1.20.0/25** (appareils .1 à .126, diffusion .127) et **10.1.20.128/25** (.129 à .254, diffusion .255).

Le PC envoie à **10.1.20.127**. La trame arrive encore à toutes les machines du commutateur (même câblage, même VLAN), mais seules les trois de son sous-réseau la gardent ; les quatre autres l'**ignorent** : ce n'est pas leur diffusion. Dans un car, on met en plus chaque sous-réseau dans son VLAN : la trame ne sortirait même pas.` },
    { t: 'Quatre sous-réseaux de 62 appareils', reglage: { p: 26, sel: 'm3', envoi: 'diff' }, lecon: 'reseau-adresses',
      texte: `Masque **/26** (255.255.255.192) : blocs de 64 adresses, qui commencent à 0, 64, 128 et 192. Quatre zones de deux machines.

La CCU 1 (10.1.20.70) est dans le bloc qui commence à 64 : réseau **10.1.20.64**, diffusion **10.1.20.127**, appareils .65 à .126 (62). Sa diffusion n'est gardée que par le panneau d'intercom (.100), le seul voisin de son bloc.` },
    { t: 'Vers un autre sous-réseau : la passerelle', reglage: { p: 25, sel: 'm2', envoi: 'uni', vers: 'm6' }, lecon: 'reseau-ip',
      texte: `Retour en /25. Le RCP 1 (10.1.20.40) veut joindre la CCU 2 (10.1.20.170). À travers son masque, 10.1.20.170 n'est **pas** dans son réseau 10.1.20.0/25 : il ne l'appelle pas directement, il confie le paquet à sa **passerelle**, le routeur, qui a une adresse dans chaque sous-réseau (10.1.20.1 et 10.1.20.129).

Le paquet monte au routeur, qui le renvoie vers l'autre sous-réseau : deux passages par le même commutateur. Vers le RCP 2 du même côté, il irait directement.` },
    { t: 'Une machine en 169.254 : le DHCP n\'a pas répondu', reglage: { p: 24, sel: 'm8', apipa: true, envoi: 'diff', de: 'm1' }, lecon: 'reseau-types',
      texte: `Le portable est réglé en DHCP, mais aucun serveur ne lui a répondu : il s'est donné seul une adresse **169.254.37.12/16** (lien local). Sa zone est à part : pour lui, ses voisins ne sont pas dans son réseau, et il n'a pas de passerelle.

La diffusion du PC (10.1.20.255) lui arrive par le câble, mais il l'**ignore**. Symptôme typique : voyant allumé, câble bon, et la machine ne joint presque personne. On cherche pourquoi le DHCP n'a pas répondu.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { p: 24, sel: 'm2', apipa: false };
    const ipOf = (m) => (S.apipa && m.id === 'm8' ? APIPA : m.ip);
    const pfOf = (m) => (S.apipa && m.id === 'm8' ? 16 : S.p);
    const byId = (id) => MACH.find((m) => m.id === id) || MACH[0];
    // le commutateur, le routeur, les machines
    const sw = commutateur('SW-RÉGIE', 10, { info: { nom: 'SW-RÉGIE', texte: 'Un commutateur, un seul VLAN : une trame de diffusion arrive à toutes les machines ; c\'est leur adresse IP qui fait le tri.' } });
    sw.position.set(-0.4, 0, -1.7); root.add(sw);
    const rt = commutateur('Routeur', 3, { routeur: true, info: () => ({ nom: 'Le routeur (passerelle)', texte: `Il a une adresse dans chaque sous-réseau (la première) : ${gateways().join(', ')}. Il relie les sous-réseaux et ne fait jamais suivre une diffusion.` }) });
    rt.position.set(3.4, 0, -2.2); rt.rotation.y = -0.45; root.add(rt);
    const rtTag = ctx.label(rt, '', { off: [0, 1.25, 0], cls: 'small' });
    const net = new Reseau(ctx, root, 120);
    const objs = {}, tags = {}, res = {}, links = {};
    MACH.forEach((m, i) => {
      const o = appareil(m.type, m.nom, { info: () => { const I = infoReseau(ipOf(m), pfOf(m)); return { nom: m.nom, texte: `${ipOf(m)}/${pfOf(m)} : réseau ${I?.reseau}, diffusion ${I?.broadcast}. ${m.id === 'm8' && S.apipa ? 'Adresse de lien local : le DHCP n\'a pas répondu.' : ''}` }; } });
      o.position.set(-3.7 + i * 1.06, 0, 1.0); root.add(o); objs[m.id] = o;
      tags[m.id] = ctx.label(o, '', { off: [0, o.userData.top + 0.16, 0], cls: 'small' });
      res[m.id] = ctx.label(o, '', { off: [0, o.userData.top + 0.46, 0], cls: 'word' }); res[m.id].show(false);
      links[m.id] = net.relie({ obj: o }, { obj: sw, i }, { couleur: 0x4a6a8a, sag: 0.45, info: { nom: `Port ${i + 1}`, texte: 'Même VLAN pour tous les ports : le commutateur ne regarde pas les adresses IP.' } });
    });
    const linkR = net.relie({ obj: sw, i: 9 }, { obj: rt, i: 0 }, { couleur: 0xe8ece6, r: 0.022, sag: 0.3, info: { nom: 'Vers le routeur', texte: 'Le lien vers la passerelle.' } });
    // l'écran des bits
    const scr = ecran(5.0, 1.7, 1200, () => {}); scr.mesh.position.set(-0.4, 2.75, -2.5); root.add(scr.mesh);
    scr.mesh.userData.info = { nom: 'L\'adresse en binaire', texte: 'Jaune : la partie réseau (sous les 1 du masque). Bleu : la partie appareil. Réseau = ET logique avec le masque ; diffusion = bits d\'appareil à 1.' };
    // les zones des sous-réseaux, refaites à chaque masque
    let zones = [];
    const groupes = () => {
      const G = new Map();
      for (const m of MACH) { const n = /** @type {number} */ (parseIp(ipOf(m))), pf = pfOf(m), k = `${ipStr(netOf(n, pf))}/${pf}`; if (!G.has(k)) G.set(k, []); G.get(k).push(m); }
      return G;
    };
    const gateways = () => [...groupes().keys()].filter((k) => k.startsWith('10.')).map((k) => ipStr(/** @type {number} */ (parseIp(k.split('/')[0])) + 1));
    function drawScreen() {
      const m = byId(S.sel), n = /** @type {number} */ (parseIp(ipOf(m))), pf = pfOf(m), I = /** @type {any} */ (infoReseau(n, pf));
      const g = scr.g, W = scr.W, H = scr.H;
      g.fillStyle = '#081014'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#e8ece6'; g.font = '600 40px "Archivo Narrow", sans-serif'; g.fillText(`${m.nom} : ${ipOf(m)}/${pf}`, 24, 48);
      g.fillStyle = '#aab4ba'; g.font = '28px "Archivo Narrow", sans-serif'; g.fillText(`masque ${I.masque} · ${pf} bits de réseau, ${32 - pf} d'appareil · ${I.hotes} appareils`, 24, 88);
      const rows = [['adresse', n], ['masque', parseIp(I.masque)], ['réseau (ET)', parseIp(I.reseau)], ['diffusion', I.broadcast ? parseIp(I.broadcast) : null]];
      const x0 = 178, cw = 21, gap = 10;
      rows.forEach(([lab, v], r) => {
        const y = 112 + r * 70;
        g.fillStyle = '#aab4ba'; g.font = '30px "Archivo Narrow", sans-serif'; g.fillText(String(lab), 24, y + 36);
        if (v == null) return;
        const b = bits32(/** @type {number} */ (v)).replace(/\./g, '');
        for (let i = 0; i < 32; i++) {
          const x = x0 + i * cw + Math.floor(i / 8) * gap;
          g.fillStyle = i < pf ? (r === 1 ? '#b8964f' : '#ffd38a') : (r === 1 ? '#4f8aa0' : '#7fd3f3'); g.fillRect(x, y + 4, cw - 3, 48);
          g.fillStyle = '#0b0e10'; g.font = '600 28px "B612 Mono", monospace'; g.fillText(b[i], x + 1, y + 38);
        }
        g.fillStyle = '#d3f3df'; g.font = '32px "B612 Mono", monospace'; g.fillText(ipStr(/** @type {number} */ (v)), x0 + 32 * cw + 3 * gap + 18, y + 38);
      });
      scr.mesh.material.map.needsUpdate = true;
    }
    function rebuild() {
      for (const z of zones) { root.remove(z); libere(z); }
      zones = [];
      let k = 0;
      for (const [key, ms] of groupes()) {
        const xs = ms.map((m) => objs[m.id].position.x), x0 = Math.min(...xs) - 0.5, x1 = Math.max(...xs) + 0.5;
        const col = key.startsWith('169.') ? 0xff6a5a : COLS[k++ % COLS.length];
        const z = zone(x1 - x0, 1.6, 1.25, col, { opacity: 0.09 }); z.position.set((x0 + x1) / 2, 0.8, 1.0);
        z.userData.fill.userData.passe = true; z.userData.edges.userData.passe = true;
        const I = /** @type {any} */ (infoReseau(key.split('/')[0], +key.split('/')[1]));
        const t = texte(`${key} · diffusion ${I.broadcast}`, { h: 0.15, color: hex(col), bg: 'rgba(12,16,20,.86)' }); t.position.set(0, 0.95, 0.66); z.add(t);
        root.add(z); zones.push(z);
      }
      for (const m of MACH) { tags[m.id].set(`${ipOf(m)}/${pfOf(m)}`); tags[m.id].el.classList.toggle('ko', S.apipa && m.id === 'm8'); res[m.id].show(false); }
      rtTag.set(`passerelles ${gateways().join(' · ')}`);
      drawScreen(); lire();
    }
    function lire() {
      const m = byId(S.sel), I = /** @type {any} */ (infoReseau(ipOf(m), pfOf(m)));
      ctx.read('Machine choisie', `${m.nom} : ${ipOf(m)}/${pfOf(m)}`);
      ctx.read('Masque', `/${pfOf(m)} = ${I.masque}`);
      ctx.read('Son réseau', `${I.reseau}/${pfOf(m)} · appareils ${I.premier} à ${I.dernier} (${I.hotes})`);
      ctx.read('Sa diffusion', I.broadcast || '—');
      ctx.read('Sous-réseaux', [...groupes().entries()].map(([k, ms]) => `${k} : ${ms.length} machine${ms.length > 1 ? 's' : ''}`).join(' · '));
    }
    const marque = (id, garde, txt) => { const r = res[id]; r.set(txt); r.el.classList.toggle('ok', garde); r.el.classList.toggle('ko', !garde); r.show(true); };
    let alive = true;
    const later = (f, ms) => setTimeout(() => { if (alive) f(); }, ms);
    function diffusion(fromId) {
      const m = byId(fromId), n = /** @type {number} */ (parseIp(ipOf(m))), pf = pfOf(m), bc = bcastOf(n, pf);
      for (const x of MACH) res[x.id].show(false);
      ctx.read('Dernier envoi', `${m.nom} → ${ipStr(bc)} : diffusion de ${ipStr(netOf(n, pf))}/${pf}`);
      ctx.say(`${m.nom} envoie à ${ipStr(bc)}, la diffusion de son sous-réseau. Le commutateur recopie la trame sur tous ses ports.`);
      const C = 0xffd38a, info = { nom: `Diffusion vers ${ipStr(bc)}`, texte: 'Trame Ethernet FF:FF:FF:FF:FF:FF : le commutateur la recopie partout ; chaque machine regarde l\'adresse IP.' };
      net.trame(links[m.id], 1, { couleur: C, info, vitesse: 2.6, onEnd: () => {
        let gard = 0, ign = 0;
        for (const x of MACH) {
          if (x.id === m.id) continue;
          net.trame(links[x.id], -1, { couleur: C, info, vitesse: 2.6, onEnd: () => {
            const xn = /** @type {number} */ (parseIp(ipOf(x))), xp = pfOf(x), garde = xp < 31 && bcastOf(xn, xp) === bc;
            if (garde) gard++; else ign++;
            marque(x.id, garde, garde ? 'gardée' : 'ignorée');
            if (gard + ign === MACH.length - 1) ctx.say(`Gardée par ${gard} machine${gard > 1 ? 's' : ''} de ${ipStr(netOf(n, pf))}/${pf}, ignorée par ${ign}. Le routeur ne la fait pas suivre.`);
          } });
        }
        net.trame(linkR, 1, { couleur: C, info, vitesse: 2.6, onEnd: () => { rtTag.set('diffusion : ne la fait pas suivre'); later(() => rtTag.set(`passerelles ${gateways().join(' · ')}`), 3000); } });
      } });
    }
    function unicast(fromId, toId) {
      const a = byId(fromId), b = byId(toId);
      for (const x of MACH) res[x.id].show(false);
      if (a.id === b.id) return;
      const na = /** @type {number} */ (parseIp(ipOf(a))), nb = /** @type {number} */ (parseIp(ipOf(b))), pf = pfOf(a);
      const direct = sameNet(na, nb, pf), gw = ipStr(netOf(na, pf) + 1);
      const C = 0x7fd1a0, info = { nom: `${a.nom} → ${b.nom}`, texte: direct ? 'Même sous-réseau : la trame va directement, par le commutateur.' : 'Autre sous-réseau : la trame va d\'abord à la passerelle.' };
      if (S.apipa && a.id === 'm8' && !direct) { ctx.read('Dernier envoi', `${a.nom} → ${ipOf(b)} : pas de passerelle`); ctx.say(`${a.nom} (169.254) n'a pas de passerelle : ${ipOf(b)} n'est pas dans son réseau, le paquet ne part pas.`); marque(a.id, false, 'pas de passerelle'); return; }
      ctx.read('Dernier envoi', `${a.nom} → ${b.nom} (${ipOf(b)}) : ${direct ? 'en direct' : `par la passerelle ${gw}`}`);
      ctx.say(direct ? `${ipOf(b)} est dans le réseau de ${a.nom} : la trame va directement.` : `${ipOf(b)} n'est pas dans ${ipStr(netOf(na, pf))}/${pf} : ${a.nom} remet le paquet à sa passerelle ${gw}, qui le renvoie vers l'autre sous-réseau.`);
      const path = direct ? [[links[a.id], 1], [links[b.id], -1]] : [[links[a.id], 1], [linkR, 1], [linkR, -1], [links[b.id], -1]];
      net.chemin(path, { couleur: C, info, vitesse: 2.6, onEnd: () => marque(b.id, true, direct ? 'reçu en direct' : 'reçu par la passerelle') });
    }
    let ui = null;
    const sync = () => {
      if (!ui) return;
      for (const b of ui.querySelectorAll('[data-p]')) b.setAttribute('aria-pressed', String(+(/** @type {HTMLElement} */ (b).dataset.p) === S.p));
      const s = /** @type {HTMLSelectElement | null} */ (ui.querySelector('select[name=sel]')); if (s) s.value = S.sel;
      const a = ui.querySelector('[data-k=apipa]'); if (a) a.setAttribute('aria-pressed', String(S.apipa));
    };
    rebuild();
    return {
      dispose() { alive = false; for (const z of zones) libere(z); },
      etape(i, E) {
        const R = E.reglage || {};
        S.p = R.p ?? 24; S.sel = R.sel || 'm2'; S.apipa = !!R.apipa; rebuild(); sync(); net.clear();
        if (R.envoi === 'diff') later(() => diffusion(R.de || S.sel), 900);
        if (R.envoi === 'uni') later(() => unicast(S.sel, R.vers), 900);
      },
      commandes() {
        const sel = /** @type {HTMLSelectElement} */ (el('select', { name: 'sel', 'aria-label': 'Machine choisie' }, ...MACH.map((m) => el('option', { value: m.id }, m.nom))));
        sel.value = S.sel; sel.addEventListener('change', () => { S.sel = sel.value; drawScreen(); lire(); });
        const vers = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': 'Destinataire' }, ...MACH.map((m) => el('option', { value: m.id }, m.nom))));
        vers.value = 'm6';
        ui = el('div', { class: 'v3-ctl' },
          el('div', { class: 'v3-row' }, el('span', {}, 'Masque :'), ...[23, 24, 25, 26, 27].map((p) => el('button', { type: 'button', class: 'btn small', 'data-p': String(p), 'aria-pressed': String(p === S.p), onclick: () => { S.p = p; rebuild(); sync(); ctx.say(`Masque /${p} : ${groupes().size} sous-réseau${groupes().size > 1 ? 'x' : ''}.`); } }, `/${p}`))),
          el('div', { class: 'v3-row' }, el('span', {}, 'Machine :'), sel, el('button', { type: 'button', class: 'btn small primary', onclick: () => diffusion(S.sel) }, 'Diffusion')),
          el('div', { class: 'v3-row' }, el('span', {}, 'Envoyer à :'), vers, el('button', { type: 'button', class: 'btn small', onclick: () => unicast(S.sel, vers.value) }, 'Envoyer')),
          el('div', { class: 'v3-row' }, el('button', { type: 'button', class: 'btn small', 'data-k': 'apipa', 'aria-pressed': String(S.apipa), onclick: () => { S.apipa = !S.apipa; rebuild(); sync(); ctx.say(S.apipa ? 'Le portable n\'a pas eu de réponse DHCP : 169.254.37.12/16.' : 'Le portable a retrouvé son adresse 10.1.20.230.'); } }, 'Portable sans réponse DHCP')));
        return ui;
      },
    };
  },
};
