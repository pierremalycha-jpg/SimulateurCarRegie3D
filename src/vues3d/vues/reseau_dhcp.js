// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { zone, texte, verre } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Arriver sur le réseau : DHCP et DNS » : le VLAN 90 des invités (un commutateur, un portable qui arrive,
// d'autres machines), le routeur du car, le VLAN 10 de gestion (serveur DHCP, résolveur DNS, supervision) et, au
// fond, Internet et ses serveurs DNS. Le portable n'a pas d'adresse : il diffuse un Discover, reçoit une Offer,
// répond par un Request, le serveur conclut par un Ack (DORA). Variantes : serveur dans un autre VLAN (le routeur
// relaie), pas de serveur (169.254), une box branchée par erreur (serveur pirate). Puis le DNS : un nom local, un
// nom sur Internet (racine, .fr, domaine, cache). Plan d'adresses : celui du car (net/ctrlnet.js, VLAN 90 en DHCP).
// ----------------------------------------------------------------------------------
const MOD = {
  ici: 'le routeur sert le DHCP du VLAN 90',
  relais: 'serveur DHCP dans le VLAN 10, le routeur relaie',
  absent: 'aucun serveur ne répond',
  pirate: 'une box branchée par erreur répond aussi',
};

export const VUE_RESEAU_DHCP = {
  id: 'reseau-dhcp', chapitre: 'reseau', titre: 'Arriver sur le réseau : DHCP et DNS',
  resume: 'Un portable arrive sans adresse : Discover, Offer, Request, Ack ; le relais à travers le routeur, le repli en 169.254, le serveur pirate ; puis le DNS qui traduit un nom, en local et sur Internet.',
  lecons: ['reseau-dhcp-dns', 'reseau-types'],
  lectures: ['Le portable', 'Le serveur DHCP', 'Dernier message', 'DNS'],
  depart: 'À gauche le VLAN 90 des invités, à droite le VLAN 10 de gestion, au fond Internet.',
  vue: { cible: [0.1, 1.1, 0.2], dir: [0, 0.6, 1], dist: 14.6 },
  orbite: { rMin: 1.5, rMax: 24 },
  etapes: [
    { t: 'Une machine arrive sans adresse', reglage: { mode: 'ici' }, lecon: 'reseau-dhcp-dns',
      texte: `Un **portable** se branche dans le VLAN 90 des invités. Il est réglé en **DHCP** : il n'a ni adresse, ni masque, ni passerelle, ni DNS. Il ne connaît personne et ne peut parler à personne en particulier.

Dans ce car, c'est le **routeur** qui prête les adresses du VLAN 90 (10.1.90.100 à 10.1.90.199) ; les machines de production, elles, ont des adresses fixes.` },
    { t: 'Discover, Offer, Request, Ack', reglage: { mode: 'ici', dora: true }, lecon: 'reseau-dhcp-dns',
      texte: `Le portable **diffuse** un **Discover** (de 0.0.0.0 vers 255.255.255.255, UDP 67) : tout le VLAN le reçoit, seul le serveur répond par une **Offer** : 10.1.90.120, masque /24, passerelle 10.1.90.1, DNS 10.1.10.53, bail de 24 h.

Le portable accepte par un **Request** (encore en diffusion, pour que d'autres serveurs sachent qu'il a choisi), le serveur conclut par un **Ack**. À mi-bail, le portable redemandera pour prolonger.` },
    { t: 'Le serveur dans un autre VLAN : le relais', reglage: { mode: 'relais', dora: true }, lecon: 'reseau-dhcp-dns',
      texte: `Ici, le serveur DHCP est dans le **VLAN 10**. La diffusion du portable ne traverse pas le routeur… sauf si celui-ci est réglé en **relais DHCP** (« ip helper-address ») : il recopie le Discover en unicast vers le serveur, et renvoie ses réponses dans le VLAN 90.

Sans relais, le serveur n'entendrait jamais la demande.` },
    { t: 'Personne ne répond : 169.254', reglage: { mode: 'absent', dora: true }, lecon: 'reseau-types',
      texte: `Aucun serveur ne répond : le portable diffuse son Discover, attend, recommence. Au bout de quelques essais, il se donne seul une adresse au hasard en **169.254.x.x** (lien local).

Il ne joint presque personne : pas de passerelle, pas de DNS, et ses voisins sont dans un autre réseau. Voyant allumé, câble bon : c'est le DHCP qu'il faut chercher.` },
    { t: 'Un serveur pirate', reglage: { mode: 'pirate', dora: true }, lecon: 'reseau-dhcp-dns',
      texte: `Quelqu'un a branché une **box** sur le réseau. Son serveur DHCP répond aussi, et plus vite : le portable prend sa première offre, **192.168.1.23**, passerelle 192.168.1.1. Il n'est plus dans le plan d'adressage et sort par la box.

On débranche la box ; les commutateurs administrables l'empêchent (**DHCP snooping** : seuls les ports déclarés de confiance peuvent répondre).` },
    { t: 'DNS : un nom, une adresse', reglage: { mode: 'ici', ok: true, dns: 'local' }, lecon: 'reseau-dhcp-dns',
      texte: `Le portable a son adresse et l'adresse de son **résolveur DNS** (10.1.10.53). Pour joindre « supervision.car.local », il demande au résolveur, en UDP sur le port 53 : « quelle adresse ? ». Réponse : **10.1.10.50**. Le ping part ensuite vers cette adresse, par la passerelle.

Si le DNS ne répondait pas, le ping par adresse marcherait, par nom non.` },
    { t: 'DNS sur Internet : la chaîne des serveurs', reglage: { mode: 'ici', ok: true, dns: 'internet' }, lecon: 'reseau-dhcp-dns',
      texte: `Pour « regie.exemple.fr », le résolveur ne sait pas : il demande aux serveurs **racine** (« qui gère .fr ? »), puis à ceux de **.fr** (« qui gère exemple.fr ? »), puis à ceux du **domaine**, qui donnent l'adresse.

Le résolveur garde la réponse en **cache** pendant sa durée de vie : la question suivante est servie aussitôt, sans refaire le tour.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { mode: 'ici', ok: false, apipa: false, pirate: false };
    // le VLAN 90
    const sw90 = commutateur('SW VLAN 90', 6, { info: { nom: 'Le commutateur du VLAN 90', texte: 'Il recopie les diffusions sur tous les ports du VLAN.' } }); sw90.position.set(-2.4, 0, -1.3); root.add(sw90);
    const sw10 = commutateur('SW VLAN 10', 5, { info: { nom: 'Le commutateur du VLAN 10', texte: 'Gestion : serveurs DHCP et DNS, supervision.' } }); sw10.position.set(3.6, 0, -1.3); root.add(sw10);
    const rt = commutateur('Routeur', 4, { routeur: true, info: () => ({ nom: 'Le routeur', texte: S.mode === 'relais' ? 'Il relaie le DHCP du VLAN 90 vers le serveur du VLAN 10 (ip helper-address).' : 'Il sert le DHCP du VLAN 90 (10.1.90.100 à 199) et route vers le VLAN 10 et Internet.' }) }); rt.position.set(0.6, 0, -2.0); root.add(rt);
    const port = appareil('portable', 'Portable', { info: () => ({ nom: 'Le portable qui arrive', texte: etiquette() }) });
    const tel = appareil('portable', 'Tablette', { info: { nom: 'Une tablette', texte: '10.1.90.131 : elle reçoit les diffusions du VLAN, mais n\'y répond pas.' } });
    const pc9 = appareil('pc', 'PC invité', { info: { nom: 'Un PC invité', texte: '10.1.90.144.' } });
    const box = appareil('serveur', 'Box', { info: { nom: 'Une box branchée par erreur', texte: 'Son serveur DHCP distribue des adresses 192.168.1.x : un serveur pirate.' } });
    [[port, -4.4], [tel, -3.3], [pc9, -2.2], [box, -1.0]].forEach(([o, x]) => { /** @type {THREE.Object3D} */ (o).position.set(/** @type {number} */ (x), 0, 1.0); root.add(/** @type {THREE.Object3D} */ (o)); });
    const dhcp = appareil('serveur', 'Serveur DHCP', { info: { nom: 'Le serveur DHCP du VLAN 10', texte: 'Il prête les adresses des VLAN qu\'on lui relaie.' } });
    const dns = appareil('serveur', 'Résolveur DNS', { info: { nom: 'Le résolveur DNS (10.1.10.53)', texte: 'Il traduit les noms en adresses et garde les réponses en cache.' } });
    const sup = appareil('pc', 'Supervision', { info: { nom: 'supervision.car.local', texte: '10.1.10.50.' } });
    [[dhcp, 2.4], [dns, 3.6], [sup, 4.8]].forEach(([o, x]) => { /** @type {THREE.Object3D} */ (o).position.set(/** @type {number} */ (x), 0, 1.0); root.add(/** @type {THREE.Object3D} */ (o)); });
    // Internet et ses serveurs DNS
    const nuage = new THREE.Group(); for (const [x, y, z, r] of [[0, 0, 0, 0.8], [0.8, 0.1, 0, 0.6], [-0.75, 0.05, 0, 0.55]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), verre(0xbfd8e8, 0.1, { depthWrite: false })); m.position.set(x, y, z); m.userData.passe = true; nuage.add(m); }
    nuage.position.set(0.8, 2.6, -3.6); root.add(nuage);
    const tn = texte('Internet', { h: 0.2, bg: 'rgba(12,16,20,.8)' }); tn.position.set(0.8, 3.6, -3.6); root.add(tn);
    const racines = [['racine (.)', -0.5], ['.fr', 0.8], ['exemple.fr', 2.1]].map(([n, x]) => { const o = appareil('serveur', String(n), { info: { nom: `Serveur DNS ${n}`, texte: n === 'racine (.)' ? 'Il sait qui gère chaque domaine de premier niveau (.fr, .com…).' : n === '.fr' ? 'Il sait qui gère chaque domaine en .fr.' : 'Il connaît les adresses de ses noms.' } }); o.scale.setScalar(0.55); o.position.set(/** @type {number} */ (x), 2.0, -3.6); root.add(o); return o; });
    // zones
    const z90 = zone(5.0, 1.6, 1.4, 0x9a7bff, { opacity: 0.07 }); z90.position.set(-2.7, 0.8, 1.0); z90.userData.fill.userData.passe = true; z90.userData.edges.userData.passe = true; root.add(z90);
    const z10 = zone(3.8, 1.6, 1.4, 0x9aa4ad, { opacity: 0.07 }); z10.position.set(3.6, 0.8, 1.0); z10.userData.fill.userData.passe = true; z10.userData.edges.userData.passe = true; root.add(z10);
    const t90 = texte('VLAN 90 · invités · 10.1.90.0/24', { h: 0.2, color: '#b8a2ff', bg: 'rgba(12,16,20,.82)' }); t90.position.set(-2.7, 0.18, 1.82); t90.rotation.x = -0.4; root.add(t90);
    const t10 = texte('VLAN 10 · gestion · 10.1.10.0/24', { h: 0.2, color: '#c8d0d8', bg: 'rgba(12,16,20,.82)' }); t10.position.set(3.6, 0.18, 1.82); t10.rotation.x = -0.4; root.add(t10);
    // câbles
    const net = new Reseau(ctx, root, 120);
    const L = {};
    L.port = net.relie({ obj: port }, { obj: sw90, i: 0 }, { couleur: 0x9a7bff, sag: 0.45 });
    L.tel = net.relie({ obj: tel }, { obj: sw90, i: 1 }, { couleur: 0x9a7bff, sag: 0.45 });
    L.pc9 = net.relie({ obj: pc9 }, { obj: sw90, i: 2 }, { couleur: 0x9a7bff, sag: 0.45 });
    L.box = net.relie({ obj: box }, { obj: sw90, i: 3 }, { couleur: 0xff6a5a, sag: 0.45 });
    L.rt90 = net.relie({ obj: sw90, i: 5 }, { obj: rt, i: 0 }, { couleur: 0xe8ece6, r: 0.022, sag: 0.3 });
    L.rt10 = net.relie({ obj: rt, i: 2 }, { obj: sw10, i: 0 }, { couleur: 0xe8ece6, r: 0.022, sag: 0.3 });
    L.dhcp = net.relie({ obj: dhcp }, { obj: sw10, i: 1 }, { couleur: 0x9aa4ad, sag: 0.45 });
    L.dns = net.relie({ obj: dns }, { obj: sw10, i: 2 }, { couleur: 0x9aa4ad, sag: 0.45 });
    L.sup = net.relie({ obj: sup }, { obj: sw10, i: 3 }, { couleur: 0x9aa4ad, sag: 0.45 });
    L.net = net.relie({ obj: rt, i: 3 }, { obj: racines[1] }, { couleur: 0xd08cff, r: 0.02, sag: -0.4 });
    L.r0 = net.relie({ obj: racines[1] }, { obj: racines[0] }, { couleur: 0xd08cff, r: 0.012, sag: 0.1 });
    L.r2 = net.relie({ obj: racines[1] }, { obj: racines[2] }, { couleur: 0xd08cff, r: 0.012, sag: 0.1 });
    const tagP = ctx.label(port, '', { off: [0, 1.35, 0], cls: 'hot' }), tagM = ctx.label(new THREE.Vector3(-0.8, 2.2, -0.4), '', { cls: 'word' });
    const tagDns = ctx.label(dns, '', { off: [0, 1.4, 0], cls: 'small' });
    // ---------------- les scénarios ----------------
    let gen = 0, alive = true;
    const later = (f, ms) => { const g = gen; setTimeout(() => { if (alive && g === gen) f(); }, ms); };
    const etiquette = () => (S.ok ? (S.pirate ? '192.168.1.23/24 · passerelle 192.168.1.1 (la box !)' : '10.1.90.120/24 · passerelle 10.1.90.1 · DNS 10.1.10.53') : S.apipa ? '169.254.37.12/16 · pas de passerelle' : '0.0.0.0 : pas encore d\'adresse');
    const msg = (t) => { tagM.set(t); ctx.read('Dernier message', t); };
    const C = { disc: 0xffd38a, offre: 0x7fd1a0, req: 0xffd38a, ack: 0x7fd1a0, pir: 0xff6a5a, dns: 0x7fd3f3 };
    const go = (path, col, t, fin) => net.chemin(path, { couleur: col, vitesse: 2.4, info: { nom: t, texte: t }, onEnd: () => { if (fin) fin(); } });
    function lire() {
      tagP.set(etiquette()); tagP.el.classList.toggle('ko', S.apipa || S.pirate); ctx.read('Le portable', etiquette());
      ctx.read('Le serveur DHCP', MOD[S.mode]); box.visible = S.mode === 'pirate'; L.box.mesh.visible = S.mode === 'pirate';
      dhcp.visible = S.mode === 'relais'; L.dhcp.mesh.visible = S.mode === 'relais';
    }
    function diffuse(col, t, fin) {
      // du portable au commutateur, puis tous les ports du VLAN 90
      go([[L.port, 1]], col, t, () => {
        for (const k of ['tel', 'pc9', ...(S.mode === 'pirate' ? ['box'] : [])]) go([[L[k], -1]], col, t);
        go([[L.rt90, 1]], col, t, fin);
      });
    }
    function dora(essai = 1) {
      msg('Discover : 0.0.0.0 → 255.255.255.255 (UDP 67)'); ctx.say('Le portable diffuse un Discover dans le VLAN 90.');
      if (S.mode === 'pirate') later(() => { msg('Offer de la box : « prenez 192.168.1.23 »'); go([[L.box, 1], [L.port, -1]], C.pir, 'Offer (box)', () => { S.ok = true; S.pirate = true; lire(); ctx.say('Le portable prend la première offre arrivée : celle de la box. Il n\'est plus dans le plan d\'adressage.'); }); }, 1200);
      diffuse(C.disc, 'Discover', () => {
        if (S.mode === 'absent') {
          if (essai < 3) { later(() => dora(essai + 1), 600); msg(`Discover n° ${essai} : pas de réponse`); return; }
          later(() => { S.apipa = true; lire(); msg('Pas de réponse : 169.254.37.12/16 (lien local)'); ctx.say('Trois essais sans réponse : le portable se donne une adresse 169.254.x.x.'); }, 600);
          return;
        }
        if (S.mode === 'pirate' && S.ok) return;
        const viaRelais = S.mode === 'relais';
        const versSrv = viaRelais ? [[L.rt10, 1], [L.dhcp, -1]] : [];
        const retour = viaRelais ? [[L.dhcp, 1], [L.rt10, -1], [L.rt90, -1], [L.port, -1]] : [[L.rt90, -1], [L.port, -1]];
        if (viaRelais) msg('Le routeur relaie le Discover vers 10.1.10.20 (unicast)');
        const offre = () => { if (S.ok) return; msg('Offer : « prenez 10.1.90.120, bail 24 h »'); go(retour, C.offre, 'Offer', () => {
          if (S.ok) return;
          msg('Request : « je prends 10.1.90.120 » (diffusion)');
          diffuse(C.req, 'Request', () => go(versSrv, C.req, 'Request', () => {
            msg('Ack : « c\'est noté, pour 24 h »');
            go(retour, C.ack, 'Ack', () => { S.ok = true; lire(); ctx.say('Ack reçu : 10.1.90.120/24, passerelle 10.1.90.1, DNS 10.1.10.53.'); });
          }));
        }); };
        if (versSrv.length) go(versSrv, C.disc, 'Discover relayé', offre); else offre();
      });
    }
    function resout(kind) {
      ctx.read('DNS', '…');
      const vers = [[L.port, 1], [L.rt90, 1], [L.rt10, 1], [L.dns, -1]], retour = [[L.dns, 1], [L.rt10, -1], [L.rt90, -1], [L.port, -1]];
      if (kind === 'local') {
        msg('« supervision.car.local ? » → 10.1.10.53, UDP 53');
        go(vers, C.dns, 'Question DNS', () => { tagDns.set('supervision.car.local = 10.1.10.50'); go(retour, C.dns, 'Réponse DNS', () => { msg('Réponse : 10.1.10.50 ; le ping part'); ctx.read('DNS', 'supervision.car.local = 10.1.10.50 (enregistrement A)'); go([[L.port, 1], [L.rt90, 1], [L.rt10, 1], [L.sup, -1]], 0x7fd1a0, 'Ping'); }); });
      } else {
        msg('« regie.exemple.fr ? »');
        go(vers, C.dns, 'Question DNS', () => {
          tagDns.set('je ne sais pas : je demande');
          const tour = (cible, quoi, fin) => go([[L.dns, 1], [L.rt10, -1], [L.net, 1], ...cible], C.dns, quoi, () => go([...cible.map(([l, s]) => [l, -s]).reverse(), [L.net, -1], [L.rt10, 1], [L.dns, -1]], 0xd08cff, `réponse de ${quoi}`, fin));
          tour([[L.r0, 1]], 'la racine', () => { msg('La racine : « .fr, c\'est par là »'); tour([], '.fr', () => { msg('.fr : « exemple.fr, c\'est par là »'); tour([[L.r2, 1]], 'exemple.fr', () => { msg('exemple.fr : « 203.0.113.80 »'); tagDns.set('regie.exemple.fr = 203.0.113.80 (en cache)'); go(retour, C.dns, 'Réponse DNS', () => ctx.read('DNS', 'regie.exemple.fr = 203.0.113.80, gardé en cache')); }); }); });
        });
      }
    }
    lire();
    return {
      dispose() { alive = false; },
      etape(i, E) {
        const R = E.reglage || {}; gen++; net.clear();
        S.mode = R.mode || 'ici'; S.ok = !!R.ok; S.apipa = false; S.pirate = false; tagDns.set(''); msg(''); ctx.read('DNS', '—'); lire();
        if (R.dora) later(() => dora(), 900);
        if (R.dns) later(() => resout(R.dns), 900);
      },
      commandes() {
        return el('div', { class: 'v3-ctl' },
          el('div', { class: 'v3-row' }, el('span', {}, 'DHCP :'), ...Object.entries(MOD).map(([k, t]) => el('button', { type: 'button', class: 'btn small', title: t, onclick: () => { gen++; net.clear(); S.mode = k; S.ok = false; S.apipa = false; S.pirate = false; lire(); dora(); } }, { ici: 'serveur ici', relais: 'relais', absent: 'pas de serveur', pirate: 'box pirate' }[k]))),
          el('div', { class: 'v3-row' }, el('span', {}, 'DNS :'), el('button', { type: 'button', class: 'btn small', onclick: () => { gen++; net.clear(); S.mode = 'ici'; S.ok = true; S.apipa = false; S.pirate = false; lire(); resout('local'); } }, 'supervision.car.local'), el('button', { type: 'button', class: 'btn small', onclick: () => { gen++; net.clear(); S.mode = 'ici'; S.ok = true; S.apipa = false; S.pirate = false; lire(); resout('internet'); } }, 'regie.exemple.fr')));
      },
    };
  },
};
