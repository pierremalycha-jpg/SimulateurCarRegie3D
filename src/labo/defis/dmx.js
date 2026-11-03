// @ts-check
import { registerDefis } from '../defis.js';
import { entre, pick, tirer, fr } from '../../cours/exo.js';
import { MODELES, empreinte, aLaSuite, valeur8, valeur16, trame, diagLigne, portAddress, sacnMulticast, liaison, CANAUX } from '../calc/dmx.js';

// ----------------------------------------------------------------------------------
// Les défis de l'atelier « DMX et Art-Net » : patcher à la suite (adresses, empreintes), adresser
// aux commutateurs DIP (binaire), une ligne qui tient (terminaison, 32 récepteurs, pas de Y,
// splitter), le nœud Art-Net (même sous-réseau, Port-Address, univers numérotés à partir de 1).
// L'état de l'atelier : appareils [{ id, nom, modele, mode, adresse }], ligne { recepteurs,
// longueur, terminaison, y, splitter }, console { ip, masque, protocole, univers }, noeud { ip,
// masque, protocole, net, sub, uni, sacn }.
// ----------------------------------------------------------------------------------
/** un parc d'appareils tirés, pas encore patchés */
function parc(rnd, n) {
  const types = tirer(rnd, ['par', 'panneau', 'decoupe', 'lyre', 'gradateur'], n);
  return types.map((t, k) => { const modes = Object.keys(MODELES[t].modes); return { id: 'f' + (k + 1), nom: `${MODELES[t].nom} ${k + 1}`, modele: t, mode: pick(rnd, modes), adresse: 0 }; });
}

registerDefis({
  'dmx-patch': {
    consigne: 'Le régisseur lumière veut un patch propre : les appareils les uns derrière les autres, sans trou.',
    gen(rnd) {
      const list = parc(rnd, 4); const D = pick(rnd, [1, 101, 201, 301]);
      let a = D; const sol = list.map((x) => { const r = a; a += empreinte(x.modele, x.mode); return r; });
      const fin = a - 1;
      const n8 = pick(rnd, [4, 8, 16, 24]);
      return {
        scene: { appareils: list.map((x) => ({ ...x })), vue: 'patch' },
        items: [
          {
            type: 'reglage', q: `Patchez ces quatre appareils **à la suite, dans l'ordre de la liste**, à partir de l'adresse **${D}** : sans chevauchement ni canal libre entre eux.`,
            fixe: { vue: 'patch' },
            check: (st) => {
              const ok = aLaSuite(st.appareils, D);
              const k = st.appareils.findIndex((x, i) => x.adresse !== sol[i]);
              return { ok, mesure: st.appareils.map((x) => `${x.nom} : ${x.adresse || '—'}`).join(' · '), why: ok ? '' : k >= 0 ? `${st.appareils[k].nom} n'est pas à la bonne adresse : il commence juste après le précédent (adresse + empreinte).` : 'Le patch sort de l\'univers.' };
            },
            corrige: { appareils: list.map((x, i) => ({ ...x, adresse: sol[i] })) },
            aides: ['Le suivant commence à l\'adresse du précédent plus son empreinte (son nombre de canaux dans ce mode).', `Le premier à ${D} ; regardez l'empreinte de chacun dans sa fiche.`],
            solution: list.map((x, i) => `${x.nom} (${x.mode}) : ${sol[i]}`).join(' ; ') + '.',
          },
          {
            type: 'nombre', q: `Dans ce patch, quel est le **dernier canal** occupé par le dernier appareil ?`, answer: fin, tol: 0,
            aides: ['Dernier canal = adresse de départ + empreinte − 1.', `Le dernier appareil commence à ${sol[3]}.`],
            solution: `${sol[3]} + ${empreinte(list[3].modele, list[3].mode)} − 1 = **${fin}**.`,
          },
          {
            type: 'nombre', q: `Combien d'appareils de **${n8} canaux** tiennent dans un univers DMX ?`, answer: Math.floor(CANAUX / n8), tol: 0,
            aides: ['Un univers compte 512 canaux.', `512 ÷ ${n8}, en arrondissant vers le bas.`],
            solution: `512 ÷ ${n8} = **${Math.floor(CANAUX / n8)}** appareils.`,
          },
        ],
      };
    },
  },
  'dmx-dip': {
    consigne: 'Un vieux bloc gradateur n\'a pas d\'afficheur : son adresse se règle aux commutateurs DIP.',
    gen(rnd) {
      const A = entre(rnd, 2, 500); const p = pick(rnd, [10, 20, 25, 40, 60, 75, 80, 90]); const p16 = pick(rnd, [25, 50, 75, 10]);
      const v16 = valeur16(p16);
      return {
        scene: { appareils: [{ id: 'g1', nom: 'Bloc gradateur 6 circuits', modele: 'gradateur', mode: '6 canaux', adresse: 1 }, { id: 'f2', nom: 'PAR LED RGBW 2', modele: 'par', mode: '8 canaux', adresse: 0 }], sel: 'g1', vue: 'patch' },
        items: [
          {
            type: 'reglage', q: `Réglez les **commutateurs DIP** du bloc gradateur sur l'adresse **${A}**.`,
            fixe: { vue: 'patch', sel: 'g1' },
            check: (st) => { const g = st.appareils.find((x) => x.id === 'g1'); return { ok: !!g && g.adresse === A, mesure: `les DIP donnent ${g ? g.adresse : 0}`, why: 'Chaque commutateur vaut une puissance de 2 : 1, 2, 4, 8… 256 ; on additionne ceux qui sont levés.' }; },
            corrige: { 'appareils.g1.adresse': A },
            aides: ['Décomposez l\'adresse en puissances de 2, de la plus grande à la plus petite.', `${A} = ${[256, 128, 64, 32, 16, 8, 4, 2, 1].filter((b) => A & b).join(' + ')}.`],
            solution: `${A} = ${[256, 128, 64, 32, 16, 8, 4, 2, 1].filter((b) => A & b).join(' + ')} : on lève ces commutateurs.`,
          },
          {
            type: 'nombre', q: `Quelle valeur DMX (0 à 255) envoie la console pour un circuit à **${p} %** ?`, answer: valeur8(p), tol: 1,
            aides: ['100 % = 255.', `${p} ÷ 100 × 255, arrondi.`],
            solution: `${p} % × 255 ≈ **${valeur8(p)}**.`,
          },
          {
            type: 'nombre', q: `Une lyre règle son pan sur 16 bits (deux canaux). À **${p16} %** de sa course, quelle valeur envoie le canal **grossier** (0 à 255) ?`, answer: v16.grossier, tol: 0,
            aides: ['Sur 16 bits, la valeur va de 0 à 65 535 ; le canal grossier en est l\'octet de poids fort.', `${p16} % de 65 535 = ${v16.v} ; on divise par 256 et on garde la partie entière.`],
            solution: `${p16} % de 65 535 = ${v16.v} ; grossier = ${v16.v} ÷ 256 = **${v16.grossier}**, fin = ${v16.fin}.`,
          },
        ],
      };
    },
  },
  'dmx-ligne': {
    consigne: 'Au bout de la ligne, des projecteurs clignotent : la ligne DMX est mal tirée.',
    gen(rnd) {
      const rec = entre(rnd, 36, 60), lon = entre(rnd, 12, 25) * 10; const n = pick(rnd, [128, 256, 512]); const T = trame(n);
      return {
        scene: { ligne: { recepteurs: rec, longueur: lon, terminaison: false, y: true, splitter: 0 }, vue: 'ligne' },
        items: [
          {
            type: 'reglage', q: `${rec} projecteurs sur ${lon} m de câble. Rendez la ligne **fiable** sans retirer de projecteur.`,
            fixe: { vue: 'ligne', 'ligne.recepteurs': rec, 'ligne.longueur': lon },
            check: (st) => { const d = diagLigne(st.ligne); return { ok: d.ok, mesure: d.ok ? `${d.branches} branche${d.branches > 1 ? 's' : ''} de ${d.parBranche} récepteurs au plus` : d.pb.map((x) => x.t).join(' '), why: d.ok ? '' : d.pb[0].t }; },
            corrige: { 'ligne.terminaison': true, 'ligne.y': false, 'ligne.splitter': 2 },
            aides: ['Trois choses à regarder : la dérivation en Y, le nombre de récepteurs par branche, la terminaison.', 'Un splitter à plusieurs sorties fait des branches propres de 32 récepteurs au plus ; chacune a sa terminaison.'],
            solution: `Plus de Y, un **splitter** (2 sorties : ${Math.ceil(rec / 2)} récepteurs par branche, sous 32), et un **bouchon de 120 Ω** au bout de chaque branche.`,
          },
          {
            type: 'nombre', q: `Une console envoie **${n} canaux** par trame (coupure 176 µs, marque 12 µs, 44 µs par canal plus le code de début). Combien de trames par seconde au plus ?`, answer: Math.round(T.hz * 10) / 10, tol: 0.5, unite: 'trames/s',
            aides: ['Durée = 176 + 12 + 44 × (n + 1) µs.', `176 + 12 + 44 × ${n + 1} = ${T.us} µs ; puis 1 000 000 ÷ ${T.us}.`],
            solution: `${T.us} µs par trame, soit **${fr(T.hz, 1)} trames par seconde**.`,
          },
          {
            type: 'choix', q: 'À quoi sert la terminaison de 120 Ω au bout d\'une ligne DMX ?', choices: ['À absorber le signal pour qu\'il ne se réfléchisse pas vers la ligne', ['À alimenter les projecteurs', 'Le DMX ne transporte pas d\'énergie : chaque projecteur a son alimentation.'], ['À donner une adresse au dernier projecteur', 'L\'adresse se règle dans chaque appareil ; la terminaison est une simple résistance.']], answer: 0,
            aides: ['Le câble a une impédance de 120 Ω ; que fait un signal qui arrive au bout d\'un câble ouvert ?', 'Une résistance égale à l\'impédance du câble l\'absorbe.'],
            solution: 'Une résistance de **120 Ω**, l\'impédance du câble, **absorbe le signal** au bout : sans elle, il se réfléchit et brouille les trames.',
          },
        ],
      };
    },
  },
  'dmx-artnet': {
    consigne: 'La console sort en réseau : un nœud Art-Net, près des projecteurs, refait une ligne DMX.',
    gen(rnd) {
      const U = entre(rnd, 1, 8); const ip = pick(rnd, ['2.0.0.1', '10.0.0.1', '192.168.1.10']);
      const masque = ip.startsWith('192') ? '255.255.255.0' : '255.0.0.0';
      const net = 0, sub = entre(rnd, 0, 3), uni = entre(rnd, 0, 15); const us = entre(rnd, 1, 2000);
      const nIp = ip.startsWith('192') ? '192.168.1.50' : ip.startsWith('10') ? '10.0.0.50' : '2.0.0.50';
      return {
        scene: { console: { ip, masque, protocole: 'artnet', univers: U }, noeud: { ip: ip.startsWith('2.') ? '10.0.0.50' : '2.0.0.50', masque: '255.0.0.0', protocole: 'artnet', net: 0, sub: 0, uni: U, sacn: 1 }, vue: 'reseau' },
        items: [
          {
            type: 'reglage', q: `La console (${ip}, masque ${masque}) sort son **univers ${U}** en Art-Net. Configurez le **nœud** pour qu'il le reçoive.`,
            fixe: { vue: 'reseau', 'console.ip': ip, 'console.masque': masque, 'console.protocole': 'artnet', 'console.univers': U },
            check: (st) => { const r = liaison(st.console, st.noeud); return { ok: r.ok, mesure: r.ok ? 'le nœud reçoit l\'univers' : r.pb.map((x) => x.t).join(' '), why: r.ok ? '' : r.pb[0].t }; },
            corrige: { 'noeud.ip': nIp, 'noeud.masque': masque, 'noeud.protocole': 'artnet', 'noeud.net': 0, 'noeud.sub': (U - 1) >> 4, 'noeud.uni': (U - 1) & 15 },
            aides: ['D\'abord le réseau : le nœud doit être dans le même sous-réseau que la console.', `Puis l'univers : la console numérote à partir de 1, Art-Net à partir de 0 ; l'univers ${U} part en Port-Address ${U - 1}.`],
            solution: `Nœud en ${nIp} (masque ${masque}), Net 0, Sub-Net ${(U - 1) >> 4}, Universe ${(U - 1) & 15} : Port-Address ${U - 1}.`,
          },
          {
            type: 'nombre', q: `Un nœud est réglé sur Net ${net}, Sub-Net ${sub}, Universe ${uni}. Quel est son **Port-Address** ?`, answer: portAddress(net, sub, uni), tol: 0,
            aides: ['Port-Address = Net × 256 + Sub-Net × 16 + Universe.', `${net} × 256 + ${sub} × 16 + ${uni}.`],
            solution: `${net} × 256 + ${sub} × 16 + ${uni} = **${portAddress(net, sub, uni)}**.`,
          },
          {
            type: 'texte', q: `En sACN, à quelle adresse **multicast** part l'univers **${us}** ?`, accept: [sacnMulticast(us)], forme: 'ip', placeholder: '239.255.0.1',
            aides: ['sACN : 239.255, puis l\'univers écrit sur deux octets.', `${us} = ${us >> 8} × 256 + ${us & 255}.`],
            solution: `239.255.${us >> 8}.${us & 255} : **${sacnMulticast(us)}** (port UDP 5568).`,
          },
        ],
      };
    },
  },
});
