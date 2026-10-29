// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { choice, slider, fmtNum } from '../../cours/kit.js';
import { eclat, ecran, piece } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';

// ----------------------------------------------------------------------------------
// Vue 3D « PTP : l'heure du car IP » : deux grands maîtres calés sur le GPS (SPG), un commutateur, une
// caméra et un mélangeur esclaves. Les messages Sync, Follow_Up, Delay_Req, Delay_Resp parcourent les
// câbles ; les instants t1 à t4 s'affichent où ils sont pris, et l'écran du fond refait le calcul. Le
// commutateur ordinaire fait attendre les messages derrière les trames vidéo (sa file est visible) et
// fausse l'heure ; en horloge frontière, l'erreur retombe à quelques dizaines de ns ; une asymétrie de
// câble décale l'esclave de a / 2 sans alarme ; le BMCA élit le grand maître de secours si le premier
// tombe. Profil SMPTE ST 2059-2 (domaine 127, Sync 8/s, Announce 4/s) ; ordres de grandeur de la leçon.
// ----------------------------------------------------------------------------------
const fmtNs = (ns) => (Math.abs(ns) >= 1000 ? `${fmtNum(ns / 1000, 2)} µs` : `${fmtNum(ns, 0)} ns`);

export const VUE_RESEAU_PTP = {
  id: 'reseau-ptp', chapitre: 'reseau', aussi: ['synchro'], titre: 'PTP : l\'heure du car IP',
  resume: 'Un grand maître calé sur le GPS, un commutateur, deux esclaves : les messages Sync et Delay_Req, les instants t1 à t4, le calcul du décalage, la file d\'attente qui le fausse et l\'horloge frontière qui le corrige.',
  lecons: ['reseau-ptp'],
  lectures: ['Commutateur', 'Dernier échange', 'Erreur de la caméra', 'Erreur du mélangeur', 'Grand maître élu'],
  depart: 'Chaque échange est ralenti des millions de fois. Les instants t1 à t4 apparaissent là où ils sont pris.',
  vue: { cible: [-0.2, 1.2, 0.2], dir: [0, 0.42, 1], dist: 12.2 },
  orbite: { rMin: 1.5, rMax: 20 },
  etapes: [
    { t: 'Une heure commune, par le réseau', reglage: { mode: 'bc', charge: 30, asym: 0 },
      texte: `En SDI, la synchro est un câble par appareil (black burst, tri-level). En IP, chaque appareil reçoit **l'heure**, très précisément, et en déduit lui-même le début de ses images : c'est **PTP** (IEEE 1588), profil **ST 2059-2**.

Le **grand maître** (ici le SPG, calé sur le GPS) envoie huit **Sync** par seconde, et des **Announce** pour se faire connaître. Chaque esclave (caméra, mélangeur) mesure son **décalage** et règle son horloge. Le cadran au-dessus de chacun dit son **erreur** par rapport au grand maître.` },
    { t: 'Sync et Follow_Up : t1 et t2', reglage: { mode: 'bc', charge: 30, asym: 0 }, focus: 'sync', vue: { cible: [-1, 1.2, 0.2], dir: [0, 0.4, 1], dist: 7.5 },
      texte: `Le maître envoie un **Sync** et note l'instant exact de son départ, **t1**. L'esclave note l'instant d'arrivée, **t2**, avec sa propre horloge. Le maître envoie ensuite t1 dans un **Follow_Up** (il ne pouvait pas l'écrire dans le Sync, déjà parti).

t2 − t1 mélange deux choses : le **temps de trajet** et le **décalage** des deux horloges. Il faut une deuxième mesure pour les séparer.` },
    { t: 'Delay_Req et Delay_Resp : t3 et t4', reglage: { mode: 'bc', charge: 30, asym: 0 }, focus: 'delay', vue: { cible: [-1, 1.2, 0.2], dir: [0, 0.4, 1], dist: 7.5 },
      texte: `L'esclave envoie un **Delay_Req** et note son départ, **t3** ; le maître note l'arrivée, **t4**, et la lui renvoie dans un **Delay_Resp**. L'écran du fond fait le calcul :
- **délai** = ((t2 − t1) + (t4 − t3)) / 2, le temps de trajet moyen ;
- **décalage** = ((t2 − t1) − (t4 − t3)) / 2, l'écart des horloges.

L'esclave corrige son horloge du décalage. Tout repose sur une hypothèse : l'aller et le retour durent **le même temps**.` },
    { t: 'Un commutateur ordinaire fausse l\'heure', reglage: { mode: 'ord', charge: 80, asym: 0 }, vue: { cible: [-0.2, 1.2, 0.2], dir: [0, 0.42, 1], dist: 11.5 },
      texte: `Dans un commutateur **ordinaire**, le message PTP attend dans la file, derrière les trames vidéo : **1,2 µs par trame** de 1 500 octets à 10 Gb/s. L'attente change à chaque message, et n'est pas la même à l'aller et au retour.

Le calcul prend cette différence pour un décalage d'horloge : l'erreur des esclaves **saute de plusieurs microsecondes**. Bien au-delà de la microseconde exigée par ST 2059-2 : les images ne sont plus alignées. Monte la charge, regarde les cadrans.` },
    { t: 'L\'horloge frontière', reglage: { mode: 'bc', charge: 80, asym: 0 }, vue: { cible: [-0.2, 1.2, 0.2], dir: [0, 0.42, 1], dist: 11.5 },
      texte: `Une **horloge frontière** (boundary clock) n'est plus un simple passage : le commutateur est **esclave** du grand maître sur son port amont et **maître** des appareils sur ses ports aval. Chaque échange ne traverse plus de file : il s'arrête au commutateur.

Même à 80 % de charge, l'erreur retombe à **quelques dizaines de nanosecondes**. Dans le car IP, toutes les leaves et les spines sont des horloges frontières (ou transparentes, qui corrigent le temps passé dans la file).` },
    { t: 'L\'asymétrie, invisible', reglage: { mode: 'bc', charge: 30, asym: 500 }, vue: { cible: [-0.2, 1.2, 0.2], dir: [0, 0.42, 1], dist: 11.5 },
      texte: `Le câble de la caméra a **100 m de fibre de plus dans un sens** (≈ 500 ns) : l'aller et le retour ne durent plus le même temps. PTP ne peut pas le voir : il partage l'écart en deux et décale la caméra de **a / 2 = 250 ns**, sans la moindre alarme.

On corrige par une constante d'asymétrie dans la configuration de l'esclave, quand on la connaît. D'où la règle : des liaisons symétriques, et un contrôle des images entre elles.` },
    { t: 'Le BMCA : un grand maître de secours', reglage: { mode: 'bc', charge: 30, asym: 0, panne: true }, vue: { cible: [-2.6, 1.3, 0.2], dir: [0, 0.4, 1], dist: 7.5 },
      texte: `Deux grands maîtres, tous deux sur le GPS, s'annoncent (**Announce**). Le **BMCA** (best master clock algorithm) élit le meilleur : priorité 1, classe d'horloge, précision, priorité 2, identité. Le GM 1 est élu (la couronne).

Coupe le GM 1 : ses Announce cessent, le GM 2 est élu en moins d'une seconde. Les deux étant calés sur le GPS, les esclaves ne sautent presque pas. Un appareil laissé par défaut peut au contraire se faire élire à leur place : on règle les caméras en **slave only**.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const OFF0 = { cam: 3200, mel: -2100 };
    const S = { mode: 'bc', charge: 30, asym: 0, gm: 1, gm1: true, err: { cam: 30, mel: -20 }, off: { ...OFF0 }, last: null };
    const gm1 = appareil('spg', 'GM 1 · SPG', { info: { nom: 'Grand maître 1 (SPG, GPS)', texte: 'priority1 = 100, clockClass 6 (calé sur le GPS) : élu par le BMCA tant qu\'il s\'annonce.' } });
    gm1.position.set(-4.2, 0, -0.6); root.add(gm1);
    const gm2 = appareil('spg', 'GM 2 · SPG', { info: { nom: 'Grand maître 2 (secours, GPS)', texte: 'priority1 = 110, clockClass 6 : il prend la main si le GM 1 se tait.' } });
    gm2.position.set(-4.2, 0, 1.2); root.add(gm2);
    const sw = commutateur('LEAF · horloge frontière', 6, { info: () => ({ nom: S.mode === 'bc' ? 'Horloge frontière (boundary clock)' : 'Commutateur ordinaire', texte: S.mode === 'bc' ? 'Esclave du grand maître en amont, maître des appareils en aval : les messages ne traversent plus la file.' : 'Les messages PTP attendent dans la file derrière les trames vidéo : leur temps de passage varie.' }) });
    sw.position.set(0, 0, -0.6); root.add(sw);
    const cam = appareil('camera', 'Caméra IP', { info: { nom: 'Caméra (esclave PTP, slave only)', texte: 'Elle aligne le début de ses images sur l\'heure PTP (époque ST 2059-1).' } });
    cam.position.set(3.8, 0, -0.9); cam.rotation.y = -0.5; root.add(cam);
    const mel = appareil('melangeur', 'Mélangeur IP', { info: { nom: 'Mélangeur (esclave PTP)', texte: 'Il reçoit les flux des caméras et les aligne sur la même heure.' } });
    mel.position.set(3.4, 0, 1.4); mel.rotation.y = -0.7; root.add(mel);
    const net = new Reseau(ctx, root, 200);
    const L = {
      g1: net.relie({ obj: gm1 }, { obj: sw, i: 0 }, { couleur: 0xd8b25a, sag: 0.5, nom: 'GM1' }),
      g2: net.relie({ obj: gm2 }, { obj: sw, i: 1 }, { couleur: 0xd8b25a, sag: 0.5, nom: 'GM2' }),
      cam: net.relie({ obj: sw, i: 4 }, { obj: cam }, { couleur: 0x8a949c, sag: 0.6, nom: 'CAM', info: () => ({ nom: 'Fibre de la caméra', texte: S.asym ? `Asymétrique : ${S.asym} ns de plus à l'aller qu'au retour.` : 'Même longueur dans les deux sens.' }) }),
      mel: net.relie({ obj: sw, i: 5 }, { obj: mel }, { couleur: 0x8a949c, sag: 0.6, nom: 'MEL' }),
    };
    // la file d'attente du commutateur : des trames vidéo empilées
    const queue = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.05, 0.12), eclat(0x6a7480), 16); queue.count = 0; queue.position.set(0, 1.08, -0.3); root.add(queue);
    queue.userData.info = { nom: 'La file d\'attente du commutateur', texte: 'Les trames vidéo en attente de sortie : 1,2 µs chacune à 10 Gb/s. Un message PTP qui passe derrière elles attend d\'autant.' };
    const qTag = ctx.label(queue, 'file : 0 trame', { off: [0, 0.9, 0], cls: 'small' });
    // la couronne du grand maître élu
    const crown = piece('couronne', 'alu', (b) => { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; b.cbox(0.04, 0.12, 0.04, Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1, 0xe8c050, 0.01); } b.cyl(0.12, 0.12, 0.04, 0, 0, 0, 0xe8c050, 20); }, { mat: { metalness: 1, roughness: 0.3 } });
    root.add(crown);
    // cadrans d'erreur au-dessus des esclaves
    const dial = (obj, nom) => {
      const E = ecran(0.9, 0.42, 320, () => {}); E.mesh.position.set(0, obj.userData.top + 0.55, 0); obj.add(E.mesh);
      E.mesh.userData.info = { nom: `Erreur de ${nom}`, texte: 'L\'écart entre son horloge et celle du grand maître, tel qu\'il est vraiment (et non tel qu\'il le mesure). ST 2059-2 demande mieux que 1 µs.' };
      return E;
    };
    const dials = { cam: dial(cam, 'la caméra'), mel: dial(mel, 'du mélangeur') };
    const drawDial = (E, ns) => {
      const g = E.g, W = E.W, H = E.H, a = Math.abs(ns);
      g.fillStyle = '#081014'; g.fillRect(0, 0, W, H);
      const col = a < 100 ? '#7fd1a0' : a < 1000 ? '#ffd38a' : '#ff8a80';
      g.fillStyle = '#8a949c'; g.font = '600 22px "Archivo Narrow", sans-serif'; g.fillText('erreur / grand maître', 12, 26);
      g.fillStyle = col; g.font = '700 46px "B612 Mono", monospace'; g.fillText((ns >= 0 ? '+' : '−') + fmtNs(a), 12, 84);
      const X = (v) => W / 2 + clamp(v / 4000, -1, 1) * (W / 2 - 14);
      g.fillStyle = '#1a2229'; g.fillRect(14, 104, W - 28, 20);
      g.fillStyle = 'rgba(127,209,160,.35)'; g.fillRect(X(-1000), 104, X(1000) - X(-1000), 20);
      g.fillStyle = col; g.fillRect(X(ns) - 4, 98, 8, 32);
      g.fillStyle = '#6a747c'; g.font = '16px "Archivo Narrow", sans-serif'; g.fillText('−4 µs', 14, 146); g.fillText('+4 µs', W - 56, 146); g.fillText('± 1 µs', W / 2 - 22, 146);
      E.mesh.material.map.needsUpdate = true;
    };
    // l'écran du calcul, au fond
    const calc = ecran(3.2, 1.25, 1024, () => {}); calc.mesh.position.set(0, 2.55, -1.6); root.add(calc.mesh);
    calc.mesh.userData.info = { nom: 'Le calcul de l\'esclave', texte: 'délai = ((t2 − t1) + (t4 − t3)) / 2 ; décalage = ((t2 − t1) − (t4 − t3)) / 2.' };
    function drawCalc(x) {
      const g = calc.g, W = calc.W, H = calc.H;
      g.fillStyle = '#081014'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffb020'; g.font = '700 34px "Archivo Narrow", sans-serif'; g.fillText(x ? `Dernier échange : ${x.qui}` : 'En attente du premier échange…', 24, 44);
      if (!x) { calc.mesh.material.map.needsUpdate = true; return; }
      g.font = '600 28px "B612 Mono", monospace'; g.fillStyle = '#d3f3df';
      const L1 = [`t2 − t1 = ${fmtNs(x.ms)}   (aller : trajet + décalage)`, `t4 − t3 = ${fmtNs(x.sm)}   (retour : trajet − décalage)`, `délai    = (${fmtNs(x.ms)} + ${fmtNs(x.sm)}) / 2 = ${fmtNs(x.delai)}`, `décalage = (${fmtNs(x.ms)} − ${fmtNs(x.sm)}) / 2 = ${fmtNs(x.mesure)}`];
      L1.forEach((t, i) => g.fillText(t, 24, 96 + i * 44));
      g.fillStyle = Math.abs(x.erreur) < 100 ? '#7fd1a0' : Math.abs(x.erreur) < 1000 ? '#ffd38a' : '#ff8a80';
      g.fillText(`vrai décalage ${fmtNs(x.vrai)} → erreur après correction : ${fmtNs(x.erreur)}`, 24, 96 + 4 * 44 + 10);
      calc.mesh.material.map.needsUpdate = true;
    }
    drawCalc(null);
    // instants t1 à t4 : des étiquettes qui apparaissent un moment
    const stamps = new Map();
    const stamp = (obj, txt) => {
      const k = obj.uuid + txt; let T = stamps.get(k);
      if (!T) { T = ctx.label(obj, txt, { off: [txt === 't2' || txt === 't4' ? 0.3 : -0.3, obj === sw ? 1.25 : obj.userData.top + 0.25, 0], cls: 'hot' }); stamps.set(k, T); }
      T.show(true); T.until = 2.6;
    };
    const gmObj = () => (S.gm === 1 ? gm1 : gm2), gmL = () => (S.gm === 1 ? L.g1 : L.g2);
    /** temps de passage d'un message dans le commutateur (ns) : la file en commutateur ordinaire */
    const fileNs = () => (S.mode === 'ord' ? Math.random() * S.charge / 100 * 8 * 1200 : 0);
    /** un échange complet avec un esclave ; anime les messages et calcule l'erreur qui en résulte */
    function echange(qui, anim = true) {
      const slaveL = qui === 'cam' ? L.cam : L.mel, slave = qui === 'cam' ? cam : mel;
      const fibre = 500, asym = qui === 'cam' ? S.asym : 0;
      // le vrai décalage de l'esclave avant l'échange (son oscillateur a un peu dérivé depuis le précédent)
      const vrai = S.off[qui] + (Math.random() - 0.5) * 40;
      let ms, sm;
      if (S.mode === 'bc') { ms = fibre + asym + vrai + (Math.random() - 0.5) * 30; sm = fibre - vrai + (Math.random() - 0.5) * 30; }
      else { ms = 2 * fibre + 900 + fileNs() + asym + vrai; sm = 2 * fibre + 900 + fileNs() - vrai; }
      const mesure = (ms - sm) / 2, delai = (ms + sm) / 2, erreur = vrai - mesure;
      // l'esclave corrige son horloge de ce qu'il a mesuré : il lui reste l'erreur de la mesure
      S.off[qui] = erreur; S.err[qui] = erreur;
      const x = { qui: qui === 'cam' ? 'la caméra' : 'le mélangeur', ms, sm, delai, mesure, vrai, erreur };
      if (!anim) { S.last = x; return; }
      const via = S.mode === 'bc' ? 'horloge frontière' : 'grand maître';
      const hold = (S.mode === 'ord' ? Math.min(1.6, (ms - 2 * fibre - 900 - asym - vrai) / 6000) : 0);
      const SYNC = 0xff8a3a, FU = 0xffc27a, REQ = 0x4c9cff, RESP = 0x9fd0ff;
      const up = S.mode === 'bc' ? [] : [[gmL(), 1]];
      const down = [[slaveL, 1]];
      stamp(S.mode === 'bc' ? sw : gmObj(), 't1');
      net.chemin(up, { couleur: SYNC, info: { nom: 'Sync', texte: `Envoyé par le ${via} ; son départ exact est t1.` }, onEnd: () => setTimeout(() => {
        net.chemin(down, { couleur: SYNC, info: { nom: 'Sync', texte: 'À son arrivée, l\'esclave note t2.' }, onEnd: () => {
          stamp(slave, 't2');
          net.chemin([...up, ...down], { couleur: FU, info: { nom: 'Follow_Up', texte: 'Il porte t1, l\'instant de départ du Sync.' }, taille: [0.1, 0.06, 0.06], onEnd: () => {
            stamp(slave, 't3');
            net.chemin([[slaveL, -1], ...(S.mode === 'bc' ? [] : [[gmL(), -1]])].slice(0, 1), { couleur: REQ, info: { nom: 'Delay_Req', texte: 'L\'esclave note son départ, t3.' }, onEnd: () => setTimeout(() => {
              net.chemin(S.mode === 'bc' ? [] : [[gmL(), -1]], { couleur: REQ, info: { nom: 'Delay_Req', texte: 'Le maître note son arrivée, t4.' }, onEnd: () => {
                stamp(S.mode === 'bc' ? sw : gmObj(), 't4');
                net.chemin([...up, ...down], { couleur: RESP, info: { nom: 'Delay_Resp', texte: 'Il porte t4 à l\'esclave, qui peut faire le calcul.' }, taille: [0.1, 0.06, 0.06], onEnd: () => {
                  S.last = x; drawCalc(x); refresh();
                  ctx.read('Dernier échange', `${x.qui} : t2 − t1 = ${fmtNs(ms)}, t4 − t3 = ${fmtNs(sm)}, décalage mesuré ${fmtNs(mesure)}`);
                } });
              } });
            }, hold * 1000) });
          } });
        } });
      }, hold * 1000) });
    }
    function refresh() {
      drawDial(dials.cam, S.err.cam); drawDial(dials.mel, S.err.mel);
      ctx.read('Commutateur', S.mode === 'bc' ? `horloge frontière · charge ${S.charge} %` : `commutateur ordinaire · charge ${S.charge} %`);
      ctx.read('Erreur de la caméra', `${fmtNs(S.err.cam)}${S.asym ? ` (asymétrie ${S.asym} ns → a / 2 = ${S.asym / 2} ns)` : ''}`);
      ctx.read('Erreur du mélangeur', fmtNs(S.err.mel));
      ctx.read('Grand maître élu', S.gm === 1 ? 'GM 1 (priority1 100)' : 'GM 2 (priority1 110), le GM 1 ne s\'annonce plus');
      const n = Math.round(S.charge / 100 * 12); queue.count = n;
      const M = new THREE.Matrix4(); for (let i = 0; i < n; i++) { M.makeTranslation(0, i * 0.06, 0); queue.setMatrixAt(i, M); } queue.instanceMatrix.needsUpdate = true;
      qTag.set(S.mode === 'bc' ? `file : ${n} trames (contournée)` : `file : ${n} trames`);
      crown.position.copy(gmObj().position).add(new THREE.Vector3(0, gmObj().userData.top + 0.3, 0));
    }
    let tCycle = 0, turn = 0, ann = 0, alive = true, ui = null;
    refresh();
    const sync = () => {
      if (!ui) return;
      for (const b of ui.querySelectorAll('[data-v]')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.v === S.mode));
      const r = /** @type {HTMLInputElement} */ (ui.querySelector('input[name=charge]')); if (r && +r.value !== S.charge) { r.value = String(S.charge); r.dispatchEvent(new Event('input')); }
      const a = /** @type {HTMLInputElement} */ (ui.querySelector('input[name=asym]')); if (a && +a.value !== S.asym) { a.value = String(S.asym); a.dispatchEvent(new Event('input')); }
      const g = ui.querySelector('[data-k=gm1]'); if (g) g.setAttribute('aria-pressed', String(!S.gm1));
    };
    function setGm1(on) {
      S.gm1 = on;
      setTimeout(() => { if (!alive) return; S.gm = S.gm1 ? 1 : 2; refresh(); ctx.say(S.gm1 ? 'Le GM 1 s\'annonce de nouveau : le BMCA le réélit (priorité 1 plus basse).' : 'Le GM 1 ne s\'annonce plus : le BMCA élit le GM 2. Les esclaves suivent sans saut, les deux étant calés sur le GPS.'); }, 900);
      sync();
    }
    return {
      dispose() { alive = false; },
      etape(i, E) {
        const R = E.reglage || {};
        S.mode = R.mode || 'bc'; S.charge = R.charge ?? 30; S.asym = R.asym ?? 0;
        S.gm1 = true; S.gm = 1;
        net.clear();
        // au début de l'étape, les esclaves viennent de démarrer : leur horloge est à quelques µs de celle du maître
        S.off = { ...OFF0 }; S.err = { ...OFF0 }; S.last = null; drawCalc(null); refresh(); sync();
        if (R.panne) setTimeout(() => { if (alive) setGm1(false); }, 2500);
        tCycle = 0.5;
      },
      update(dt) {
        for (const T of stamps.values()) if (T.until > 0) { T.until -= dt; if (T.until <= 0) T.show(false); }
        tCycle -= dt; ann -= dt;
        if (tCycle <= 0) { tCycle = S.mode === 'ord' ? 5.5 : 4.5; echange(turn++ % 2 ? 'mel' : 'cam'); }
        // les Announce des grands maîtres vivants
        if (ann <= 0) {
          ann = 1.6;
          if (S.gm1) net.trame(L.g1, 1, { couleur: 0xe8c050, taille: [0.08, 0.05, 0.05], info: { nom: 'Announce du GM 1', texte: 'priority1 100 · clockClass 6 · domaine 127.' } });
          net.trame(L.g2, 1, { couleur: 0xe8c050, taille: [0.08, 0.05, 0.05], info: { nom: 'Announce du GM 2', texte: 'priority1 110 · clockClass 6 · domaine 127.' } });
        }
      },
      commandes() {
        ui = el('div', { class: 'v3-ctl' },
          choice('Commutateur', [['bc', 'horloge frontière'], ['ord', 'commutateur ordinaire']], S.mode, (v) => { S.mode = v; refresh(); sync(); ctx.say(v === 'bc' ? 'Horloge frontière : les prochains échanges ne traversent plus la file.' : 'Commutateur ordinaire : les prochains messages attendront derrière les trames vidéo.'); }),
          (() => { const s = slider('Charge du commutateur', 0, 100, S.charge, 5, (v) => { S.charge = v; refresh(); }, (v) => v + ' %'); s.querySelector('input').name = 'charge'; return s; })(),
          (() => { const s = slider('Asymétrie (fibre de la caméra)', 0, 1000, S.asym, 50, (v) => { S.asym = v; refresh(); }, (v) => v + ' ns'); s.querySelector('input').name = 'asym'; return s; })(),
          el('div', { class: 'v3-row' }, el('button', { type: 'button', class: 'btn small', 'data-k': 'gm1', 'aria-pressed': 'false', onclick: () => setGm1(!S.gm1) }, 'Couper le GM 1')));
        return ui;
      },
    };
  },
};
