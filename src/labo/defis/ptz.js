// @ts-check
import { registerDefis } from '../defis.js';
import { entre, pick, tirer } from '../../cours/exo.js';
import { MODELES, CLASSES_POE, FENETRE_EASYIP, bancUsine, planType, hote, reseauDe, alimentation, majTension, joint, qos, recette, liaisonsPupitre, tosDe, dscpAF, cameras } from '../calc/ptz.js';

// ----------------------------------------------------------------------------------
// Les défis de l'atelier « Caméras PTZ » (v19.30). Chacun pose un banc (la scène, posée sur l'état de
// labo/calc/ptz.js) et trois questions, dont au moins un réglage jugé par le modèle :
//   - trois caméras sorties du carton : les adresser au plan avec Easy IP Setup (l'une a passé ses 20 minutes) ;
//   - le budget PoE du switch : tout alimenter quand le switch ne peut pas tout porter ;
//   - enregistrer les caméras au pupitre : son adresse, puis l'adresse et le port de chaque caméra ;
//   - la vidéo d'abord : marquer les flux en DSCP et régler les files du switch sur un lien engorgé ;
//   - la recette du lundi matin : trois pannes tirées, à trouver et réparer.
// ----------------------------------------------------------------------------------
const RESEAUX = ['192.168.10.0', '192.168.20.0', '192.168.50.0', '10.10.5.0', '10.20.1.0', '172.16.8.0'];
/** un plan tiré : un réseau, un préfixe de 24 à 27 (toutes les adresses du plan tiennent sous .30) */
function planTire(rnd, prefixes = [24, 25, 26, 27]) {
  const P = planType(pick(rnd, RESEAUX), pick(rnd, prefixes));
  P.pc = hote(P.reseau, 20);
  return P;
}
/** un banc branché et alimenté, au plan : caméras et pupitre adressés, comptes faits (le point de départ des défis avancés) */
function bancPret(P, o = {}) {
  const B = bancUsine();
  B.plan = P;
  B.appareils.forEach((a, k) => { a.port = k + 1; a.t0 = 0; });
  const pose = (id, ip) => { const a = B.appareils.find((x) => x.id === id); Object.assign(a, { ip, masque: P.masque, passerelle: P.passerelle }); };
  pose('pc', P.pc); pose('rp', P.rp);
  for (const c of cameras(B)) { pose(c.id, P.cams[c.id]); c.compte = { user: 'regie' }; }
  if (o.pupitre !== false) B.rp.cams = { 1: { ip: P.cams.cam1, port: 80 }, 2: { ip: P.cams.cam2, port: 80 }, 3: { ip: P.cams.cam3, port: 80 } };
  B.easyip.cherche = true;
  return B;
}
/** le réglage juste d'un appareil, en chemins (pour la solution) */
const auPlan = (P, id, ip) => ({ [`appareils.${id}.ip`]: ip, [`appareils.${id}.masque`]: P.masque, [`appareils.${id}.passerelle`]: P.passerelle, [`appareils.${id}.dhcp`]: false });
/** l'état d'un banc après majTension (les mesures le font dans l'atelier) */
const pret = (st) => majTension(st);

registerDefis({
  // ------------------------------------------------------------------
  'ptz-adresser': {
    consigne: 'Trois caméras neuves sont branchées et alimentées : elles ont toutes l\'adresse d\'usine. Le PC technique est déjà dans le réseau de la fiche.',
    gen(rnd) {
      const P = planTire(rnd);
      const B = bancUsine(); B.plan = P;
      B.appareils.forEach((a, k) => { a.port = k + 1; a.t0 = 0; });
      Object.assign(B.appareils[0], { ip: P.pc, masque: P.masque, passerelle: P.passerelle });
      // l'AW-UE20 (fenêtre de 20 minutes d'usine) est allumée depuis plus longtemps que les autres
      const m = entre(rnd, 24, 40); B.minutes = m;
      for (const a of B.appareils) a.t0 = a.id === 'cam3' ? 0 : m - entre(rnd, 2, 6);
      const R = reseauDe(P.pc, P.masque);
      return {
        scene: { ...B, vue: 'pc', pcApp: 'easyip' },
        items: [
          {
            type: 'reglage', q: `Donnez aux trois caméras les adresses de la fiche, avec le masque **${P.masque}** et la passerelle **${P.passerelle}** : CAM 1 **${P.cams.cam1}**, CAM 2 **${P.cams.cam2}**, CAM 3 **${P.cams.cam3}**. Le PC doit ensuite les joindre toutes.`,
            check: (st) => {
              pret(st);
              const pb = [];
              for (const c of cameras(st)) {
                if (c.ip !== P.cams[c.id] || c.masque !== P.masque || c.passerelle !== P.passerelle || c.dhcp) { pb.push(`${c.nom} est en ${c.dhcp ? 'DHCP' : c.ip + ' / ' + c.masque}`); continue; }
                const j = joint(st, 'pc', c.id); if (!j.ok) pb.push(j.pb);
              }
              return { ok: !pb.length, mesure: pb.length ? pb[0] : 'le PC joint les trois caméras', why: pb.length ? `${pb.join(' ; ')}. Easy IP Setup les distingue par leur adresse MAC (étiquette de chaque caméra, dans « Le banc »).` : '' };
            },
            corrige: { ...auPlan(P, 'cam1', P.cams.cam1), ...auPlan(P, 'cam2', P.cams.cam2), ...auPlan(P, 'cam3', P.cams.cam3) },
            aides: ['Easy IP Setup : Search, puis une caméra à la fois (Network Settings, Save). Elles ont la même adresse : repérez-les par leur MAC.', `Il en manque une dans la liste ? Elle est sous tension depuis plus de ${FENETRE_EASYIP} minutes : coupez puis rendez le PoE de son port (« Le banc »), et cherchez à nouveau.`],
            solution: `Dans Easy IP Setup, une caméra à la fois : ${['cam1', 'cam2', 'cam3'].map((id) => `${id.toUpperCase().replace('CAM', 'CAM ')} → ${P.cams[id]}`).join(', ')}, masque ${P.masque}, passerelle ${P.passerelle}. La CAM 3 (AW-UE20, réglée sur « 20min ») n'apparaît qu'après un redémarrage : PoE de son port coupé puis rendu.`,
          },
          {
            type: 'texte', q: `Le réseau de la fiche est **${R.reseau}/${R.p}**. Quelle est son adresse de **diffusion** ?`, accept: [R.diffusion], forme: 'ip', placeholder: '192.168.10.255',
            aides: [`Le masque ${P.masque} laisse ${32 - R.p} bits aux appareils.`, `Diffusion = adresse du réseau + ${2 ** (32 - R.p)} − 1 (tous les bits d'appareil à 1).`],
            solution: `${R.reseau} + ${2 ** (32 - R.p) - 1} : **${R.diffusion}**. Les appareils vont de ${hote(R.reseau, 1)} à ${hote(R.reseau, 2 ** (32 - R.p) - 2)} (${R.hotes} adresses).`,
          },
          {
            type: 'choix', q: 'Easy IP Setup affiche CAM 1 et CAM 2, pas CAM 3 (une AW-UE20 allumée depuis une demi-heure). Pourquoi ?',
            choices: ['Réglée sur « 20min », elle n\'est plus affichée passé 20 minutes sous tension : on la redémarre', ['Son adresse n\'est pas dans le sous-réseau du PC', 'Easy IP Setup cherche en diffusion sur le segment : il trouve une caméra même hors du sous-réseau du PC.'], ['Elle a la même adresse que les deux autres', 'Les caméras sont distinguées par leur MAC : les deux autres, à la même adresse, sont bien affichées.']], answer: 0,
            aides: ['Qu\'est-ce qui distingue CAM 3 des deux autres ?', 'Le réglage « Easy IP Setup accommodate period » de la caméra.'],
            solution: 'Sur l\'AW-UE20, la fenêtre d\'Easy IP Setup vaut **20 minutes** d\'usine : passé ce délai, la caméra n\'est plus affichée. On la redémarre (couper puis rendre son PoE), ou l\'on règle « Unlimited » dans sa page web.',
          },
        ],
      };
    },
  },
  // ------------------------------------------------------------------
  'ptz-poe': {
    consigne: 'Le switch du banc a été remplacé par un modèle au budget PoE plus faible, et quelqu\'un a touché aux ports : des appareils restent éteints.',
    gen(rnd) {
      const P = planTire(rnd, [24]);
      const B = bancPret(P);
      const budget = pick(rnd, [65, 75, 90, 100]);
      const nMax = Math.floor(budget / CLASSES_POE[4]);
      B.switch.budget = budget;
      const af = pick(rnd, [2, 3]), off = pick(rnd, [4, 5]);
      B.switch.ports = B.switch.ports.map((p) => ({ ...p, poe: p.n === af ? 'af' : p.n === off ? 'off' : 'at' }));
      const nCam = entre(rnd, 5, 12), b2 = pick(rnd, [185, 240, 370]);
      // la solution : tout en PoE+, et sur leur bloc 12 V les appareils qui dépassent le budget (le pupitre d'abord)
      const surBloc = ['rp', 'cam3', 'cam2', 'cam1'].slice(0, Math.max(0, 4 - nMax));
      return {
        scene: { ...B, vue: 'banc' },
        items: [
          {
            type: 'reglage', q: `Le switch ne dispose plus que de **${budget} W** de PoE. Mettez en marche les trois caméras **et** le pupitre, sans débrancher personne du réseau. Chaque appareil a aussi son bloc secteur 12 V dans le carton.`,
            fixe: { 'switch.budget': budget },
            check: (st) => {
              const A = alimentation(st);
              const eteints = st.appareils.filter((a) => !A.par[a.id].alimente || !A.par[a.id].lien);
              return { ok: !eteints.length, mesure: `${A.reserve} W réservés sur ${budget} W`, why: eteints.length ? `${eteints.map((a) => `${a.nom} : ${A.par[a.id].pb || 'éteint'}`).join(' ; ')}.` : '' };
            },
            corrige: { 'switch.ports': B.switch.ports.map((p) => ({ ...p, poe: 'at' })), ...Object.fromEntries(surBloc.map((id) => [`appareils.${id}.secteur`, true])) },
            aides: ['Deux choses : le mode PoE de chaque port, puis le budget. Une AW-HE130 demande du PoE+ (classe 4).', `Chaque appareil de classe 4 réserve ${CLASSES_POE[4]} W : ${budget} W n'en portent que ${nMax}. Les autres sur leur bloc 12 V.`],
            solution: `Tous les ports en **PoE+** ; le switch réserve ${CLASSES_POE[4]} W par appareil de classe 4, ${budget} W n'en portent que **${nMax}** : ${surBloc.map((id) => B.appareils.find((a) => a.id === id).nom).join(' et ')} sur ${surBloc.length > 1 ? 'leur' : 'son'} bloc secteur 12 V.`,
          },
          {
            type: 'nombre', q: `Un switch alloue par classe. Combien de watts réserve-t-il pour **${nCam}** caméras de classe 4 ?`, answer: nCam * CLASSES_POE[4], tol: 0, unite: 'W',
            pieges: [{ v: Math.round(nCam * 25.5 * 10) / 10, why: '25,5 W, c\'est ce qui arrive à l\'appareil ; le switch réserve ce qu\'il fournit au départ du port : 30 W.' }],
            aides: ['La classe 4, c\'est le PoE+ : combien de watts à la source, par port ?', `${nCam} × ${CLASSES_POE[4]} W.`],
            solution: `${nCam} × ${CLASSES_POE[4]} W = **${nCam * CLASSES_POE[4]} W**, quelle que soit leur consommation réelle.`,
          },
          {
            type: 'nombre', q: `Un switch PoE+ a un budget de **${b2} W**. Combien d'appareils de **classe 4** peut-il alimenter en même temps ?`, answer: Math.floor(b2 / 30), tol: 0,
            aides: ['Un appareil de classe 4 réserve 30 W.', `${b2} ÷ 30, arrondi vers le bas.`],
            solution: `${b2} ÷ 30 = ${(b2 / 30).toFixed(2).replace('.', ',')} : **${Math.floor(b2 / 30)}** appareils. Les ports suivants restent sans courant.`,
          },
        ],
      };
    },
  },
  // ------------------------------------------------------------------
  'ptz-pupitre': {
    consigne: 'Les caméras sont adressées et ont leur compte. Le pupitre AW-RP150 sort de son carton.',
    gen(rnd) {
      const P = planTire(rnd, [24, 25]);
      const B = bancPret(P, { pupitre: false });
      const port = pick(rnd, [8080, 8000, 81, 8888]), qui = pick(rnd, ['cam1', 'cam2', 'cam3']);
      B.appareils.find((a) => a.id === qui).http = port;
      Object.assign(B.appareils.find((a) => a.id === 'rp'), { ...MODELES.rp150.usine });
      B.minutes = 5;
      const nomQui = B.appareils.find((a) => a.id === qui).nom;
      const ipQui = P.cams[qui];
      return {
        scene: { ...B, vue: 'pupitre' },
        items: [
          {
            type: 'reglage', q: `Mettez le pupitre en **${P.rp}** (masque ${P.masque}, passerelle ${P.passerelle}), puis enregistrez CAM 1, CAM 2 et CAM 3 sous les numéros **1, 2 et 3**. Attention : ${nomQui} a été réglée pour écouter sur un autre port HTTP.`,
            check: (st) => {
              pret(st);
              const rp = st.appareils.find((a) => a.id === 'rp');
              if (rp.ip !== P.rp || rp.masque !== P.masque) return { ok: false, mesure: `pupitre en ${rp.ip} / ${rp.masque}`, why: 'Le pupitre doit d\'abord être dans le réseau des caméras (RP IP SET).' };
              const L = liaisonsPupitre(st);
              const pb = ['cam1', 'cam2', 'cam3'].map((id, k) => { const l = L.find((x) => x.n === k + 1); return !l ? `CAM${k + 1} : pas enregistrée` : !l.ok ? `CAM${k + 1} : ${l.pb}` : l.cam !== id ? `CAM${k + 1} appelle ${st.appareils.find((a) => a.id === l.cam).nom}` : ''; }).filter(Boolean);
              return { ok: !pb.length, mesure: pb.length ? pb[0] : 'trois caméras connectées', why: pb.join(' ; ') };
            },
            corrige: { 'appareils.rp.ip': P.rp, 'appareils.rp.masque': P.masque, 'appareils.rp.passerelle': P.passerelle, 'rp.cams': { 1: { ip: P.cams.cam1, port: qui === 'cam1' ? port : 80 }, 2: { ip: P.cams.cam2, port: qui === 'cam2' ? port : 80 }, 3: { ip: P.cams.cam3, port: qui === 'cam3' ? port : 80 } } },
            aides: ['CONNECT SETTING → RP IP SET pour le pupitre, puis MANUAL IP SET pour les caméras.', `Le port de ${nomQui} se lit dans Easy IP Setup (colonne Port No.) ou dans sa page web : c'est ${port}.`],
            solution: `RP IP SET : ${P.rp} / ${P.masque}, passerelle ${P.passerelle}. MANUAL IP SET : 1 → ${P.cams.cam1}, 2 → ${P.cams.cam2}, 3 → ${P.cams.cam3}, port 80, sauf ${nomQui} : port **${port}**.`,
          },
          {
            type: 'texte', q: `Quelle adresse tapez-vous dans le navigateur du PC pour ouvrir la page web de ${nomQui} ?`, accept: [`http://${ipQui}:${port}`, `http://${ipQui}:${port}/`, `${ipQui}:${port}`, `${ipQui}:${port}/`], forme: 'ip', placeholder: 'http://192.168.10.11',
            pieges: [{ v: `http://${ipQui}`, why: 'Sans port, le navigateur frappe au port 80 : la caméra n\'y écoute plus, la connexion est refusée.' }, { v: ipQui, why: 'Sans port, le navigateur frappe au port 80 : la caméra n\'y écoute plus, la connexion est refusée.' }],
            aides: ['L\'URL donne l\'adresse et, s\'il n\'est pas 80, le port.', 'http://adresse:port'],
            solution: `**http://${ipQui}:${port}** : l'adresse, deux-points, le port.`,
          },
          {
            type: 'choix', q: 'Au pupitre, la touche de l\'AW-UE20 reste éteinte : elle répond à Easy IP Setup, mais pas au joystick. Le port et l\'adresse sont justes. Que lui manque-t-il ?',
            choices: ['Son compte administrateur, à créer au premier accès à sa page web', ['Du PoE+ sur son port', 'Elle répond à Easy IP Setup : elle est donc allumée.'], ['Une passerelle', 'Le pupitre et la caméra sont dans le même sous-réseau : la passerelle ne sert pas entre eux.']], answer: 0,
            aides: ['Qu\'est-ce que l\'AW-UE20 demande au premier accès à sa page web ?', 'Sans lui, un pupitre la voit mais ne la pilote pas.'],
            solution: 'Le **compte administrateur** : l\'AW-UE20 le fait créer au premier accès à sa page web ; tant qu\'il n\'existe pas, le pupitre la détecte sans pouvoir la piloter.',
          },
        ],
      };
    },
  },
  // ------------------------------------------------------------------
  'ptz-qos': {
    consigne: 'Le PC technique enregistre les flux IP des trois caméras pendant qu\'un collègue copie des rushes sur le même PC : l\'image saute.',
    gen(rnd) {
      const P = planTire(rnd, [24]);
      const B = bancPret(P);
      const d = pick(rnd, [10, 20]), T = (d === 10 ? entre(rnd, 8, 9) : entre(rnd, 5, 9)) * 10;
      for (const c of cameras(B)) Object.assign(c, { flux: true, debit: d, dscp: 0 });
      B.transfert = T; B.switch.lien = 100;
      const fixe = { transfert: T, 'switch.lien': 100, ...Object.fromEntries(['cam1', 'cam2', 'cam3'].flatMap((id) => [[`appareils.${id}.flux`, true], [`appareils.${id}.debit`, d]])) };
      const af = [[4, 1], [3, 1], [2, 1], [4, 2]][entre(rnd, 0, 3)];
      const ds = pick(rnd, [34, 46, 26, 18]);
      const charge = Math.round((3 * d + T + 0.1) / 100 * 100);
      return {
        scene: { ...B, vue: 'banc' },
        items: [
          {
            type: 'reglage', q: `Le port du PC tourne à **100 Mb/s** : trois flux de ${d} Mb/s et ${T} Mb/s de copie. Faites passer la vidéo **sans perte**, sans arrêter la copie ni baisser les débits.`,
            fixe,
            check: (st) => { const q = qos(st); return { ok: q.ok && q.flux.length === 3, mesure: `pertes sur la vidéo : ${q.pertesVideo.toFixed(1).replace('.', ',')} %`, why: q.ok ? '' : st.switch.qos.confiance !== 'dscp' ? 'Le switch ne lit pas le DSCP : pour lui, tous les paquets se valent.' : st.switch.qos.files !== 'prio' ? 'Le switch n\'a qu\'une file : la vidéo attend derrière la copie.' : 'Des caméras ne marquent pas leurs flux en AF41 (34) ou EF (46).' }; },
            corrige: { 'appareils.cam1.dscp': 34, 'appareils.cam2.dscp': 34, 'appareils.cam3.dscp': 34, 'switch.qos.confiance': 'dscp', 'switch.qos.files': 'prio' },
            aides: ['Trois réglages : le marquage dans chaque caméra, la confiance du switch, ses files.', 'Page web de chaque caméra, Setup → Network → Advanced : Diffserv 34. Puis « Le banc » : confiance DSCP, file prioritaire.'],
            solution: 'Diffserv **34** (AF41) dans chaque caméra ; au switch, **confiance DSCP** et **file prioritaire** : la vidéo passe d\'abord, la copie prend ce qui reste.',
          },
          {
            type: 'nombre', q: `Quelle est la **charge** du lien du PC (100 Mb/s) : trois flux de ${d} Mb/s, ${T} Mb/s de copie et quelques commandes ?`, answer: charge, tol: 1, unite: '%',
            aides: ['Charge = débit offert ÷ débit du lien.', `(3 × ${d} + ${T}) ÷ 100.`],
            solution: `3 × ${d} + ${T} = ${3 * d + T} Mb/s offerts sur 100 : **${charge} %**. Au-delà de 100 %, il faut choisir qui passe.`,
          },
          .../** @type {import('../defis.js').ItemDefi[]} */ (rnd() < 0.5 ? [{
            type: /** @type {'nombre'} */ ('nombre'), q: `Quelle valeur DSCP correspond à la classe **AF${af[0]}${af[1]}** ?`, answer: dscpAF(af[0], af[1]), tol: 0,
            aides: ['AFxy : DSCP = 8x + 2y.', `8 × ${af[0]} + 2 × ${af[1]}.`],
            solution: `8 × ${af[0]} + 2 × ${af[1]} = **${dscpAF(af[0], af[1])}**.`,
          }] : [{
            type: /** @type {'nombre'} */ ('nombre'), q: `Une caméra marque ses paquets en DSCP **${ds}**. Quelle valeur lit-on dans l'octet ToS (Traffic Class) de l'en-tête IP ?`, answer: tosDe(ds), tol: 0,
            aides: ['Le DSCP occupe les 6 bits de poids fort de l\'octet ; les 2 derniers servent à autre chose (ECN).', `${ds} × 4.`],
            solution: `${ds} décalé de deux bits : ${ds} × 4 = **${tosDe(ds)}**.`,
          }]),
        ],
      };
    },
  },
  // ------------------------------------------------------------------
  'ptz-panne': {
    consigne: 'Lundi matin, la recette du banc échoue : quelqu\'un a laissé trois pannes. Trouvez-les et réparez-les, couche par couche.',
    gen(rnd) {
      const P = planTire(rnd, [24, 25, 26]);
      const B = bancPret(P);
      const PANNES = {
        poe: (c) => { const n = B.appareils.find((a) => a.id === c).port; B.switch.ports = B.switch.ports.map((p) => (p.n === n ? { ...p, poe: 'af' } : p)); },
        vlan: (c) => { const n = B.appareils.find((a) => a.id === c).port; B.switch.ports = B.switch.ports.map((p) => (p.n === n ? { ...p, vlan: 20 } : p)); },
        masque: (c) => { B.appareils.find((a) => a.id === c).masque = '255.255.255.252'; },
        doublon: (c) => { const o = c === 'cam1' ? 'cam2' : 'cam1'; B.appareils.find((a) => a.id === c).ip = P.cams[o]; },
        port: (c) => { const k = ['cam1', 'cam2', 'cam3'].indexOf(c) + 1; B.rp.cams[k] = { ...B.rp.cams[k], port: 8080 }; },
        compte: () => { B.appareils.find((a) => a.id === 'cam3').compte = null; },
      };
      const sortes = tirer(rnd, ['poe', 'vlan', 'masque', 'doublon', 'port', 'compte'], 3);
      const cibles = tirer(rnd, ['cam1', 'cam2', 'cam3'], 3);
      sortes.forEach((s, k) => PANNES[s](s === 'compte' ? 'cam3' : cibles[k]));
      const SYMPT = [
        ['Le voyant de lien du port est allumé, mais la caméra est éteinte', 'Le PoE du port (mode ou budget)', [['L\'adresse IP de la caméra', 'Une caméra éteinte ne répond à rien : avant l\'adresse, il faut le courant.'], ['Le compte administrateur', 'Le compte se règle dans la page web : la caméra doit d\'abord démarrer.']]],
        ['La caméra est allumée, son adresse est juste, mais Easy IP Setup ne la trouve pas', 'Le VLAN de son port : elle n\'est pas sur le segment du PC', [['Son masque', 'Easy IP Setup trouve une caméra même hors du sous-réseau du PC : le masque n\'empêche pas la recherche.'], ['Son port HTTP', 'La recherche ne passe pas par le serveur web de la caméra.']]],
        ['Easy IP Setup trouve la caméra, mais le navigateur reste sur « délai dépassé » ; l\'adresse est celle de la fiche', 'Son masque : elle ne voit pas le PC dans son sous-réseau', [['Le PoE de son port', 'Elle répond à Easy IP Setup : elle est allumée.'], ['Le VLAN de son port', 'Easy IP Setup la trouve : elle est sur le même segment que le PC.']]],
      ];
      const [sy, bon, faux] = pick(rnd, SYMPT);
      // la solution : le banc remis au plan
      const ok = bancPret(P);
      return {
        scene: { ...B, vue: 'fiche' },
        items: [
          {
            type: 'reglage', q: 'Remettez le banc en état : la **recette** (vue « La fiche du banc ») doit montrer chaque caméra jointe par le PC **et** pilotée par le pupitre, aux adresses de la fiche.',
            check: (st) => {
              pret(st);
              const r = recette(st);
              const horsPlan = cameras(st).filter((c) => c.ip !== P.cams[c.id]);
              if (r.ok && horsPlan.length) return { ok: false, mesure: 'recette réussie, mais pas au plan', why: `${horsPlan.map((c) => c.nom).join(', ')} n'${horsPlan.length > 1 ? 'ont' : 'a'} pas l'adresse de la fiche.` };
              return { ok: r.ok, mesure: r.ok ? 'recette réussie' : `${r.pb.length} point${r.pb.length > 1 ? 's' : ''} à reprendre`, why: r.pb.slice(0, 2).join(' ; ') };
            },
            corrige: { 'switch.ports': ok.switch.ports, ...Object.fromEntries(ok.appareils.flatMap((a) => [[`appareils.${a.id}.ip`, a.ip], [`appareils.${a.id}.masque`, a.masque], [`appareils.${a.id}.compte`, a.compte || null], [`appareils.${a.id}.http`, a.http]])), 'rp.cams': ok.rp.cams },
            aides: ['Couche par couche : le lien et le courant (Le banc), puis le VLAN, puis l\'adresse et le masque, puis le port et le compte.', 'La fiche du banc dit, pour chaque caméra, ce qui bloque : lisez la première raison de chaque ligne.'],
            solution: `Les trois pannes : ${sortes.map((s, k) => ({ poe: `port de ${cibles[k].toUpperCase().replace('CAM', 'CAM ')} en PoE simple (repasser en PoE+)`, vlan: `port de ${cibles[k].toUpperCase().replace('CAM', 'CAM ')} dans le VLAN 20 (le remettre en 1)`, masque: `masque de ${cibles[k].toUpperCase().replace('CAM', 'CAM ')} en 255.255.255.252 (remettre ${P.masque})`, doublon: `${cibles[k].toUpperCase().replace('CAM', 'CAM ')} à l'adresse d'une autre caméra (remettre ${P.cams[cibles[k]]})`, port: `pupitre qui appelle ${cibles[k].toUpperCase().replace('CAM', 'CAM ')} sur le port 8080 (remettre 80)`, compte: 'CAM 3 sans compte administrateur (le créer dans sa page web)' })[s]).join(' ; ')}.`,
          },
          {
            type: 'choix', q: `${sy}. Que vérifiez-vous d'abord ?`, choices: [bon, ...faux], answer: 0,
            aides: ['Qu\'est-ce qui marche déjà ? Cela élimine des couches.', 'On remonte du câble et du courant vers l\'adresse, puis vers les services (page web, pupitre).'],
            solution: `**${bon}**. Ce qui marche déjà dit où chercher : on remonte couche par couche.`,
          },
          {
            type: 'choix', q: 'Une caméra ne répond pas au pupitre. Dans quel ordre mène-t-on le diagnostic ?',
            choices: ['Le lien et le courant, puis le segment (VLAN), puis l\'adresse et le masque, puis le service (port, compte, pupitre)', ['L\'adresse d\'abord, puis le câble si l\'adresse est juste', 'Une adresse juste sur une caméra éteinte ou dans un autre VLAN ne répond pas : on commencerait par une couche qui suppose les autres.'], ['Le compte et le port, puis l\'adresse, puis le câble', 'C\'est l\'ordre inverse : le service ne se teste qu\'une fois le chemin jusqu\'à la caméra établi.']], answer: 0,
            aides: ['Du plus physique au plus logiciel.', 'Le câble, puis le réseau Ethernet, puis l\'IP, puis l\'application.'],
            solution: 'Du câble à l\'application : **lien et courant**, puis **segment (VLAN)**, puis **adresse**, puis **service** (port, compte, pupitre). Chaque couche suppose la précédente.',
          },
        ],
      };
    },
  },
});
