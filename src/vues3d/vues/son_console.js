// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { slider, fmtNum } from '../../cours/kit.js';
import { COUL, mat, eclat, piece, texte, ecran, courbe, cableEntre, zone } from '../kit.js';
import { appareil } from '../materiel.js';
import { chaine, sorties, boucle, rejetCardio, niveauEntree, sourceById, PEAK, ECRETAGE, verdictNiveau } from '../../cours/son_console_calc.js';

// ----------------------------------------------------------------------------------
// Vue 3D « La console analogique : réglages et sorties » : une petite console analogique du type de la gamme
// Antmix (simulation non officielle, agrandie environ cinq fois), huit voies micro et deux voies stéréo, la
// section master (vumètres à LED, effets intégrés, AUX, casque, 48 V), sa face arrière (sorties principales en
// XLR et en jack, AUX, envoi d'effets, cabine, enregistrement en RCA, USB). Sur scène : le micro du chant
// (dynamique), celui de la guitare (statique, il lui faut le 48 V), les retours au sol ; la façade de part et
// d'autre, l'enregistreur et le départ vers la régie vidéo. Le trajet du signal s'allume : ambre, le mélange
// principal ; vert, l'AUX pré-fader des retours ; violet, l'envoi d'effets post-fader ; cyan, l'enregistrement
// et la vidéo. Tous les niveaux (étages de la tranche, vumètres, sorties, larsen) viennent du modèle pur
// cours/son_console_calc.js, comme la leçon « La console analogique » et « Les sorties de la console ».
// ----------------------------------------------------------------------------------
const W = 3.4, D = 2.3, H = 0.22, SW = 0.25, NS = 10, TILT = 0.14;
const sx = (i) => -W / 2 + 0.15 + SW / 2 + i * SW;
const MX = 1.31; // la section master
const Z = { xlr: -1.0, jack: -0.82, gain: -0.62, cb: -0.49, high: -0.36, mid: -0.23, low: -0.1, aux: 0.04, fx: 0.17, pan: 0.3, pfl: 0.42, f0: 0.55, f1: 1.03 };
/** position d'un fader (z local) selon sa valeur en dB */
const FADER = [[10, 0.55], [0, 0.66], [-10, 0.77], [-20, 0.85], [-30, 0.92], [-40, 0.97], [-Infinity, 1.02]];
function faderZ(db) {
  if (!Number.isFinite(db) || db <= -40) return db <= -40 && Number.isFinite(db) ? 0.97 : 1.02;
  for (let k = 0; k < FADER.length - 1; k++) { const [a, za] = FADER[k], [b, zb] = FADER[k + 1]; if (db <= a && db >= b) return za + (zb - za) * (a - db) / (a - b); }
  return 0.55;
}
/** angle d'un bouton (radians, sens horaire vu de dessus) : de −135° à +135° sur sa course */
const angle = (v, min, max) => (-135 + 270 * clamp((v - min) / (max - min), 0, 1)) * Math.PI / 180;
const sdb = (v, d = 1) => (!Number.isFinite(v) ? '−∞' : (v > 0.04 ? '+' : '') + fmtNum(v, d).replace('-', '−'));
/** la tête d'un micro (sa grille), au bout du corps du micro de materiel.js (appareil « micro ») */
function teteMicro(couleur, r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat('alu', couleur, { metalness: 0.75, roughness: 0.45 }));
  m.position.set(0, 1.33, 0.1); m.name = 'tête du micro';
  return m;
}
// les réglages de départ (le chant sur la voie 1, la guitare sur la 2, le clavier sur la voie stéréo 9-10)
const DEF = { gain: 36, high: 0, mid: 0, low: 0, cb: true, aux: 0, fx: -8, fader: 0, master: 0, auxMaster: 0, p48: true, pfl: false, retourDevant: false };

export const VUE_SON_CONSOLE = {
  id: 'son-console', chapitre: 'son', titre: 'La console analogique : réglages et sorties',
  resume: 'Une petite console de la section son, agrandie : la tranche réglage par réglage, le trajet du signal qui s\'allume jusqu\'aux sorties de la face arrière, vers la façade, les retours, l\'enregistreur et la vidéo.',
  lecons: ['son-console', 'son-sorties'],
  lectures: ['Tranche 1 (chant)', 'Vumètres', 'Sorties', 'Retour du chanteur'],
  depart: 'Ambre : le mélange principal ; vert : l\'AUX des retours ; violet : l\'envoi d\'effets ; cyan : l\'enregistrement et la vidéo. Les commandes règlent la voie 1, le chant.',
  vue: { cible: [0, 0.8, -1.8], dir: [0.15, 0.62, 1], dist: 10.5 },
  orbite: { rMin: 0.8, rMax: 22 },
  etapes: [
    { t: 'La console et son installation', lecon: 'son-console', reglage: {}, focus: null, vue: { cible: [0, 0.8, -1.8], dir: [0.15, 0.62, 1], dist: 10.5 },
      texte: `Une **console analogique** comme celles de la section son : huit voies micro, une voie stéréo (le clavier), la **section master** à droite. Elle est agrandie environ cinq fois ; c'est une console du type de la gamme Antmix d'ANT, sans en être la copie (simulation non officielle).

Sur scène, derrière elle : le micro du **chant** (dynamique) sur la voie 1, celui de la **guitare** (statique) sur la voie 2, les **retours** posés au sol. De part et d'autre, la **façade** ; sur le côté, l'**enregistreur** et le **départ vers la régie vidéo**. Les impulsions suivent le signal de chaque sortie.` },
    { t: 'L\'entrée et le GAIN, réglés en PFL', lecon: 'son-console', reglage: { pfl: true }, focus: 'gain', vue: { cible: [-1.42, 1.08, -0.7], dir: [0.25, 1.4, 0.75], dist: 2.4 },
      texte: `En haut de la tranche, les **entrées** : la **XLR** pour le micro (symétrique, quelques millivolts), le **jack** pour une source ligne. Juste dessous, le **GAIN** : le préampli qui porte le micro au niveau de la console.

On le règle la touche **PFL** enfoncée : les **vumètres** de la section master lisent alors la tranche seule, avant son fader. La source joue au plus fort ; on monte le GAIN jusqu'à ce que les crêtes tournent autour du **« 0 »**, sans allumer la LED **PEAK**. Pour le chant (un micro dynamique type SM58), il faut ici autour de +36 dB.` },
    { t: 'Le 48 V, un interrupteur pour toutes les XLR', lecon: 'son-console', reglage: { p48: false }, focus: 'p48', vue: { cible: [0.1, 1.0, -0.6], dir: [0.05, 1.3, 0.9], dist: 5 },
      texte: `Le micro de la **guitare** est **statique** (à condensateur) : il lui faut l'**alimentation fantôme 48 V**. Elle est coupée : la voie 2 ne reçoit rien, ses impulsions ont disparu.

Sur ces consoles, le 48 V est souvent **un seul interrupteur**, dans la section master, pour toutes les entrées XLR (ou un groupe de voies). Les micros dynamiques le supportent ; on l'allume et on le coupe **master baissé**, sinon le claquement part dans la façade. Rallumez-le dans « À vous ».` },
    { t: 'Coupe-bas et égaliseur', lecon: 'son-console', reglage: { pfl: true }, focus: 'eq', vue: { cible: [-1.42, 1.04, -0.3], dir: [0.25, 1.4, 0.75], dist: 2.4 },
      texte: `Le **coupe-bas** retire le grondement de la scène sous 75 Hz environ : les pas, les chocs sur le pied, le souffle dans le micro. Puis l'**égaliseur** fixe à trois bandes : **HIGH** vers 12 kHz, **MID** vers 2,5 kHz, **LOW** vers 80 Hz, ±15 dB chacun.

Une bande qu'on pousse **ajoute du niveau** : poussez le MID du chant de 12 dB et regardez le vumètre en PFL monter ; on revérifie alors le GAIN. On creuse plutôt qu'on n'ajoute.` },
    { t: 'Le fader et le bus principal', lecon: 'son-console', reglage: {}, focus: 'fader', vue: { cible: [0, 1.0, 0.4], dir: [0.1, 1.1, 1], dist: 4.6 },
      texte: `Le **fader** dose la tranche dans le **bus principal**, gauche et droite (selon le **PAN**) ; le **master** règle le bus. Le repère **0** est le gain unité : le fader ne change rien au niveau.

Le **gain staging** : le GAIN réglé en PFL vers le « 0 », les faders et le master **autour de 0** ; les décibels s'additionnent d'étage en étage. Le mélange se fait aux faders. Un master très haut et des faders très bas amplifient le souffle du bus pour rien.` },
    { t: 'Trop de GAIN : l\'écrêtage', lecon: 'son-console', reglage: { gain: 60, pfl: true }, focus: 'gain', vue: { cible: [-0.1, 1.05, -0.4], dir: [0.1, 1.4, 0.8], dist: 4.8 },
      texte: `Le GAIN est poussé à +60 dB : les crêtes du chant dépassent l'**écrêtage** du préampli (vers +21 dBu, ordre de grandeur). La LED **PEAK** reste rouge, les vumètres touchent le haut, les impulsions passent au **rouge** : la forme d'onde est coupée.

Baissez le **fader** : le son baisse, mais il reste écrêté, car le préampli est **avant** le fader. Seul le GAIN répare. Ramenez-le vers +36 dB.` },
    { t: 'Les sorties, à l\'arrière', lecon: 'son-sorties', reglage: {}, focus: 'arriere', vue: { cible: [0.75, 0.86, -1.2], dir: [0.15, 0.25, -1], dist: 3.4 },
      texte: `La **face arrière** : **MAIN OUT** gauche et droite en **XLR** (le mélange principal au niveau ligne pro, **+4 dBu** au « 0 ») vers la façade ; les mêmes en **jack**, ici vers la régie vidéo ; **AUX OUT** vers les retours ; **FX SEND** vers un effet externe ; **CTRL ROOM** pour l'écoute de la régie ; **REC OUT** en **RCA** au niveau grand public (−10 dBV, environ 12 dB plus bas) vers l'enregistreur ; l'**USB** sur certains modèles.

Le casque et la cabine ne sont **jamais** un départ : ils suivent l'écoute de l'ingénieur, et son PFL.` },
    { t: 'L\'AUX pré-fader : les retours', lecon: 'son-sorties', reglage: { fader: -Infinity }, focus: 'aux', vue: { cible: [-0.4, 0.8, -3.2], dir: [0.3, 0.7, 1], dist: 7 },
      texte: `Le fader du chant est **fermé** : la façade ne le joue plus (plus d'impulsions ambre sur la voie 1). Mais le chanteur s'entend toujours dans son **retour** : l'envoi **AUX** est pris **avant le fader** (pré-fader).

C'est le choix des **retours de scène** : le musicien règle son mélange avec l'ingénieur, et les mouvements de la façade ne le gênent pas. Le master AUX règle l'ensemble des retours.` },
    { t: 'L\'envoi FX post-fader : les effets', lecon: 'son-sorties', reglage: { fx: -2 }, focus: 'fx', vue: { cible: [0.2, 1.05, -0.2], dir: [0.15, 1.3, 0.9], dist: 3.6 },
      texte: `L'envoi **FX** part vers les **effets intégrés** (réverbération, écho, choisis par un numéro sur l'afficheur) ; leur **retour** revient dans le bus principal. Il est pris **après le fader** (post-fader) : baissez le fader du chant, la réverbération baisse avec lui au lieu de rester seule dans la salle.

Les impulsions violettes vont de la tranche à l'afficheur des effets, puis repartent dans le mélange principal.` },
    { t: 'Le larsen', lecon: 'son-sorties', reglage: { aux: 6, auxMaster: 4, retourDevant: true }, focus: 'retour', vue: { cible: [-0.6, 0.9, -4.7], dir: [0.7, 0.55, 1], dist: 4.6 },
      texte: `Le chanteur a baissé son micro et l'a pointé vers son **retour**, et l'AUX est monté. Le micro capte le retour, la console l'amplifie, le retour le rend plus fort : quand le **gain de la boucle** atteint 0 dB, le son s'emballe, c'est le **larsen** (l'anneau rouge clignote).

Retournez le micro : un micro **cardioïde** rejette ce qui arrive de derrière, d'une vingtaine de dB, et le retour vise justement son arrière. Puis baissez l'AUX : la marge revient. Lecture « Retour du chanteur ».` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { ...DEF, t: 0, larsen: 0, meter: { l: -60, r: -60 }, alive: true };
    // ---------------- la console : un pupitre incliné sur un pied ----------------
    const stand = piece('pied de la console', 'alu', (b) => {
      for (const x of [-1.2, 1.2]) { b.cbox(0.08, 0.86, 0.08, x, 0.43, -0.6, 0x3a4048, 0.02); b.cbox(0.08, 0.86, 0.08, x, 0.43, 0.6, 0x3a4048, 0.02); b.cbox(0.08, 0.06, 1.4, x, 0.05, 0, 0x3a4048, 0.02); }
      b.cbox(2.6, 0.06, 0.08, 0, 0.82, 0, 0x3a4048, 0.02);
    });
    root.add(stand);
    const desk = new THREE.Group(); desk.name = 'console'; desk.position.set(0, 1.0, 0); desk.rotation.x = TILT; root.add(desk);
    const corps = piece('console', 'plastique', (b) => {
      b.cbox(W, H, D, 0, -H / 2, 0, 0x30353b, 0.05);
      // les séparations des tranches et la section master
      for (let i = 0; i <= NS; i++) b.box(0.006, 0.004, D - 0.12, sx(i) - SW / 2, 0.002, 0, 0x4a525a);
      b.box(0.62, 0.004, D - 0.12, MX, 0.002, 0, 0x262b30);
      // les fentes des faders
      for (let i = 0; i < NS; i++) b.box(0.012, 0.004, Z.f1 - Z.f0 + 0.04, sx(i), 0.004, (Z.f0 + Z.f1) / 2, 0x0b0e10);
      b.box(0.012, 0.004, Z.f1 - Z.f0 + 0.04, MX, 0.004, (Z.f0 + Z.f1) / 2, 0x0b0e10);
      // les embases d'entrée : une XLR et un jack par voie micro, deux jacks par voie stéréo
      for (let i = 0; i < NS; i++) {
        if (i < 8) { b.cyl(0.075, 0.075, 0.02, sx(i), 0.008, Z.xlr, 0x15181b, 24); b.cyl(0.045, 0.045, 0.022, sx(i), 0.008, Z.jack, 0x15181b, 20); }
        else { b.cyl(0.045, 0.045, 0.022, sx(i), 0.008, Z.xlr, 0x15181b, 20); b.cyl(0.045, 0.045, 0.022, sx(i), 0.008, Z.jack, 0x15181b, 20); }
      }
      // la face arrière : sorties principales XLR, jacks, RCA, USB
      const ry = -H / 2, rz = -D / 2 - 0.006;
      for (const x of [1.5, 1.28]) b.cyl(0.065, 0.065, 0.02, x, ry, rz, 0x15181b, 24, Math.PI / 2);
      for (const x of [1.06, 0.94, 0.78, 0.62, 0.5]) b.cyl(0.035, 0.035, 0.02, x, ry, rz, 0x15181b, 18, Math.PI / 2);
      b.cyl(0.03, 0.03, 0.03, 0.32, ry, rz, 0xd8d8d0, 16, Math.PI / 2); b.cyl(0.03, 0.03, 0.03, 0.22, ry, rz, 0xd8403a, 16, Math.PI / 2);
      b.box(0.08, 0.04, 0.02, 0.04, ry, rz, 0x15181b);
    });
    corps.userData.info = { nom: 'Console analogique (type Antmix, agrandie)', texte: 'Huit voies micro, une voie stéréo, la section master à droite. Le signal y reste une tension du début à la fin : chaque étage l\'amplifie ou l\'atténue, chacun a un plafond.' };
    desk.add(corps);
    // les boutons de toutes les voies (fixes), sauf ceux de la voie 1 qu'on règle
    /** @type {[string, number, number, number, number][]} */
    const knobRows = [['gain', 0xc25a3a, 36, 0, 60], ['high', 0x59646f, 0, -15, 15], ['mid', 0x59646f, 0, -15, 15], ['low', 0x59646f, 0, -15, 15], ['aux', 0x3d8a5a, -10, -40, 10], ['fx', 0x7a5ab0, -20, -40, 10], ['pan', 0xd8dde2, 0, -1, 1]];
    const fixes = piece('boutons', 'plastique', (b) => {
      for (let i = 1; i < NS; i++) for (const [k, col, v0, min, max] of knobRows) {
        const z = Z[k], a = angle(v0 + (i * 7 % 5 - 2) * (max - min) * 0.04, min, max), x = sx(i);
        b.cyl(0.05, 0.05, 0.012, x, 0.006, z, 0x1a1d21, 18); b.cyl(0.04, 0.044, 0.05, x, 0.035, z, col, 18);
        b.box(0.008, 0.006, 0.03, x + 0.022 * Math.sin(a), 0.062, z - 0.022 * Math.cos(a), 0xf2f3ee, -a);
      }
      for (let i = 0; i < NS; i++) {
        b.cbox(0.07, 0.025, 0.05, sx(i), 0.013, Z.cb, 0x2a3036, 0.008);
        b.cbox(0.07, 0.025, 0.05, sx(i) + 0.05, 0.013, Z.pfl, 0x2a3036, 0.008);
        if (i) b.cbox(0.09, 0.05, 0.06, sx(i), 0.03, faderZ(i === 8 ? -6 : i < 3 ? -4 : -40), 0xc9ced3, 0.01);
      }
      // la section master : AUX, retour d'effet, casque ; l'interrupteur 48 V
      b.cbox(0.11, 0.05, 0.07, MX + 0.18, 0.025, -0.3, 0x2a3036, 0.01);
    });
    fixes.userData.info = { nom: 'Les autres voies', texte: 'Même tranche que la voie 1. La voie 2 reçoit le micro statique de la guitare ; la voie stéréo 9-10, le clavier (deux jacks, un niveau, une balance).' };
    desk.add(fixes);
    // la voie 1 : ses boutons tournent, son fader glisse, sa LED PEAK s'allume
    const k1 = {};
    for (const [k, col, , min, max] of knobRows) {
      const g = new THREE.Group(); g.position.set(sx(0), 0, Z[k]); desk.add(g);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.044, 0.05, 20), mat('plastique', col, { roughness: 0.45 })); body.position.y = 0.035; g.add(body);
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20), mat('plastique', 0x1a1d21)); skirt.position.y = 0.006; g.add(skirt);
      const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006, 0.03), eclat(0xf2f3ee)); ptr.position.set(0, 0.062, -0.022); g.add(ptr);
      g.userData.info = () => ({ nom: `Voie 1 : ${{ gain: 'GAIN', high: 'HIGH (12 kHz)', mid: 'MID (2,5 kHz)', low: 'LOW (80 Hz)', aux: 'AUX (pré-fader)', fx: 'FX (post-fader)', pan: 'PAN' }[k]}`, texte: knobTexte(k) });
      k1[k] = { g, min, max };
    }
    const fader1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.06), mat('plastique', 0xe8ece6)); fader1.position.set(sx(0), 0.03, faderZ(0)); desk.add(fader1);
    fader1.userData.info = () => ({ nom: 'Fader de la voie 1', texte: `À ${sdb(S.fader, 0)} dB. Il dose le chant dans le bus principal et dans l'envoi d'effets (post-fader) ; l'AUX des retours, pré-fader, ne le suit pas.` });
    const faderM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.06), mat('plastique', 0xe0453a)); faderM.position.set(MX, 0.03, faderZ(0)); desk.add(faderM);
    faderM.userData.info = () => ({ nom: 'Master (bus principal)', texte: `À ${sdb(S.master, 0)} dB. Il règle la sortie principale ; près de 0 dB, la console a le plus de marge et le moins de souffle.` });
    const leds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 10, 8), eclat(0xffffff), NS);
    const M4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < NS; i++) { M4.makeTranslation(sx(i) - 0.05, 0.02, Z.pfl); leds.setMatrixAt(i, M4); leds.setColorAt(i, col.set(0x203024)); }
    leds.userData.instInfo = (i) => ({ nom: `LED PEAK de la voie ${i + 1}`, texte: 'Verte quand le signal est là, rouge quelques dB avant l\'écrêtage du préampli : on baisse alors le GAIN, pas le fader.' });
    desk.add(leds);
    const pflKey = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.028, 0.05), eclat(0x2a3036)); pflKey.position.set(sx(0) + 0.05, 0.016, Z.pfl); desk.add(pflKey);
    pflKey.userData.info = () => ({ nom: 'PFL de la voie 1', texte: S.pfl ? 'Enfoncée : le casque et les vumètres écoutent la voie 1 seule, avant son fader. Rien ne change pour la salle.' : 'Relâchée : les vumètres lisent le bus principal.' });
    // la section master : vumètres, afficheur d'effets, boutons, 48 V
    const vu = ecran(0.42, 0.7, 168, () => {}); vu.mesh.rotation.x = -Math.PI / 2; vu.mesh.position.set(MX, 0.006, -0.78); desk.add(vu.mesh);
    vu.mesh.userData.info = () => ({ nom: 'Vumètres à LED', texte: S.pfl ? 'En PFL : ils lisent la voie 1 seule, avant son fader. On règle le GAIN pour que les crêtes tournent autour du « 0 ».' : 'Ils lisent le bus principal, gauche et droite, après le master. Le « 0 » correspond au niveau nominal (0 dBu dans la console, +4 dBu à la sortie XLR).' });
    const fxd = ecran(0.36, 0.13, 256, (g, w, h) => { g.fillStyle = '#081014'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb020'; g.font = '700 44px "B612 Mono", monospace'; g.fillText('07', 12, h - 26); g.font = '600 26px "Archivo Narrow", sans-serif'; g.fillText('HALL', 110, h - 30); });
    fxd.mesh.rotation.x = -Math.PI / 2; fxd.mesh.position.set(MX - 0.06, 0.006, -0.3); desk.add(fxd.mesh);
    fxd.mesh.userData.info = { nom: 'Effets intégrés', texte: 'Un processeur numérique dans la console : réverbérations, échos, choisis par leur numéro (ici 07, une salle). Il reçoit l\'envoi FX de chaque voie et rend sa réverbération dans le bus principal (FX RETURN).' };
    const mk = (x, z, coul, info) => { const g = new THREE.Group(); g.position.set(x, 0, z); const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.055, 20), mat('plastique', coul, { roughness: 0.45 })); bd.position.y = 0.03; const p = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.006, 0.032), eclat(0xf2f3ee)); p.position.set(0, 0.06, -0.024); g.add(bd, p); g.userData.info = info; desk.add(g); return g; };
    const kFxRet = mk(MX - 0.19, 0.06, 0x7a5ab0, { nom: 'FX RETURN', texte: 'Le niveau de la réverbération rendue dans le bus principal.' });
    const kAuxM = mk(MX, 0.06, 0x3d8a5a, () => ({ nom: 'Master AUX', texte: `À ${sdb(S.auxMaster, 0)} dB : le niveau de tous les retours, envoyés par AUX OUT.` }));
    mk(MX + 0.19, 0.06, 0xd8dde2, { nom: 'PHONES / CTRL ROOM', texte: 'Le niveau du casque et de l\'écoute de la régie : ce que l\'ingénieur écoute, le bus principal ou la voie en PFL. Ce n\'est pas un départ.' });
    const p48Led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), eclat(0xe0453a)); p48Led.position.set(MX + 0.18, 0.06, -0.38); desk.add(p48Led);
    const p48Key = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.07), new THREE.MeshBasicMaterial({ visible: false })); p48Key.position.set(MX + 0.18, 0.03, -0.3); desk.add(p48Key);
    p48Key.userData.info = () => ({ nom: 'Interrupteur 48 V', texte: S.p48 ? 'Allumé : l\'alimentation fantôme part sur toutes les entrées XLR. Le micro statique de la guitare fonctionne.' : 'Coupé : le micro statique de la guitare ne délivre plus rien ; les dynamiques, eux, fonctionnent sans.' });
    // sérigraphies
    const serig = (s, x, z, h = 0.045, o = {}) => { const t = texte(s, { h, color: o.color ?? '#d9dee2', weight: 700 }); t.rotation.x = -Math.PI / 2; t.position.set(x, 0.007, z); desk.add(t); return t; };
    for (let i = 0; i < NS; i++) serig(i < 8 ? String(i + 1) : i === 8 ? '9-10' : 'ST', sx(i), 1.1, 0.06);
    for (const [k, s] of [['gain', 'GAIN'], ['high', 'HIGH'], ['mid', 'MID'], ['low', 'LOW'], ['aux', 'AUX'], ['fx', 'FX'], ['pan', 'PAN']]) serig(s, sx(0) - 0.085, Z[k] + 0.045, 0.028);
    serig('48V', MX + 0.18, -0.21, 0.04, { color: '#ff8a80' }); serig('MAIN', MX, 1.1, 0.06); serig('FX RET', MX - 0.19, 0.15, 0.03); serig('AUX', MX, 0.15, 0.03); serig('PHONES', MX + 0.19, 0.15, 0.03);
    const rear = (s, x) => { const t = texte(s, { h: 0.035, color: '#d9dee2', weight: 700 }); t.rotation.y = Math.PI; t.position.set(x, -H / 2 + 0.075, -D / 2 - 0.012); desk.add(t); };
    rear('MAIN L', 1.5); rear('MAIN R', 1.28); rear('L', 1.06); rear('R', 0.94); rear('AUX', 0.78); rear('FX', 0.62); rear('CTRL', 0.5); rear('REC L/R', 0.27); rear('USB', 0.04);
    const rearInfo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, H), new THREE.MeshBasicMaterial({ visible: false })); rearInfo.rotation.y = Math.PI; rearInfo.position.set(0.77, -H / 2, -D / 2 - 0.02); desk.add(rearInfo);
    rearInfo.userData.info = { nom: 'Face arrière : les sorties', texte: 'MAIN OUT L et R en XLR (+4 dBu au « 0 ») vers la façade ; les mêmes en jack (ici vers la régie vidéo) ; AUX OUT vers les retours ; FX SEND ; CTRL ROOM ; REC OUT en RCA (−10 dBV) vers l\'enregistreur ; USB sur certains modèles.' };
    // la mise en lumière de la commande expliquée
    const spot = zone(0.24, 0.1, 0.16, COUL.ambre, { opacity: 0.16, edge: 0.9, r: 0.03 }); spot.visible = false; desk.add(spot);
    const spotTag = ctx.label(spot, '', { off: [0, 0.12, 0], cls: 'hot' }); spotTag.show(false);
    const FOCUS = {
      gain: { p: [sx(0), 0.05, -0.81], s: [0.26, 0.12, 0.5], t: 'entrées et GAIN' }, eq: { p: [sx(0), 0.05, -0.3], s: [0.26, 0.12, 0.5], t: 'coupe-bas et égaliseur' },
      aux: { p: [sx(0), 0.05, Z.aux], s: [0.26, 0.12, 0.13], t: 'AUX pré-fader' }, fx: { p: [sx(0), 0.05, Z.fx], s: [0.26, 0.12, 0.13], t: 'FX post-fader' },
      fader: { p: [sx(0), 0.05, 0.79], s: [0.26, 0.12, 0.56], t: 'fader' }, p48: { p: [MX + 0.18, 0.05, -0.3], s: [0.2, 0.12, 0.2], t: '48 V' },
      arriere: { p: [0.77, -H / 2, -D / 2 - 0.04], s: [1.7, H + 0.06, 0.1], t: 'les sorties' },
    };
    // ---------------- la scène, la façade, l'enregistreur, la vidéo ----------------
    const sceneP = piece('scène', 'tole', (b) => { b.cbox(5.2, 0.3, 3.2, 0, 0.15, -5.3, 0x23282d, 0.03); });
    sceneP.userData.info = { nom: 'La scène', texte: 'Les micros et les retours des musiciens. Le multipaire (ou les câbles micro) descend vers la console.' }; root.add(sceneP);
    const micCh = appareil('micro', 'Chant', { info: () => ({ nom: 'Micro du chant (dynamique, type SM58)', texte: `Voie 1, sans 48 V. Ses crêtes donnent environ ${sdb(niveauEntree(sourceById('chant')), 0)} dBu (110 dB SPL à quelques centimètres, ordre de grandeur). Cardioïde : il rejette ce qui vient de derrière.` }) });
    micCh.position.set(-0.7, 0.3, -5.0); micCh.rotation.y = Math.PI; root.add(micCh); micCh.add(teteMicro(0x6a7076, 0.04));
    const micGt = appareil('micro', 'Guitare', { info: () => ({ nom: 'Micro de la guitare (statique)', texte: S.p48 ? 'Voie 2, alimenté par le 48 V.' : 'Voie 2 : sans 48 V, ce micro statique ne délivre rien.' }) });
    micGt.position.set(1.0, 0.3, -5.0); micGt.rotation.y = Math.PI; root.add(micGt); micGt.add(teteMicro(0xc9ced3, 0.022));
    const larsenRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 32), eclat(0xe0453a)); larsenRing.rotation.x = Math.PI / 2; larsenRing.position.set(-0.7, 1.56, -5.0); larsenRing.visible = false; root.add(larsenRing);
    const wedge = (x, z, ry, nom) => {
      const g = piece(nom, 'plastique', (b) => { b.cbox(0.7, 0.36, 0.5, 0, 0.18, 0, 0x1d2126, 0.03, 0, -0.5); b.cbox(0.6, 0.24, 0.02, 0, 0.24, 0.24, 0x2c3238, 0.01, 0, -0.5); });
      g.position.set(x, 0.3, z); g.rotation.y = ry; root.add(g); return g;
    };
    const retour = wedge(-0.7, -4.2, Math.PI, 'Retour du chanteur');
    retour.userData.info = () => ({ nom: 'Retour du chanteur (AUX)', texte: S.retourDevant ? 'Le micro est pointé vers lui : il le capte en plein, la boucle accroche vite.' : 'Posé au sol, devant le chanteur : il vise l\'arrière du micro cardioïde, son axe mort.' });
    const retour2 = wedge(1.0, -4.2, Math.PI, 'Retour du guitariste'); retour2.userData.info = { nom: 'Retour du guitariste (AUX)', texte: 'Le même départ AUX : ici un seul mélange de retours pour toute la scène.' };
    const fac = (x) => { const g = piece('Façade', 'plastique', (b) => { b.cyl(0.03, 0.03, 1.4, 0, 0.7, 0, 0x3a4048, 10); b.cbox(0.7, 1.0, 0.6, 0, 1.9, 0, 0x1a1d21, 0.04); b.cyl(0.24, 0.24, 0.02, 0, 1.75, 0.31, 0x2a2f35, 24, Math.PI / 2); b.cyl(0.1, 0.1, 0.02, 0, 2.2, 0.31, 0x2a2f35, 18, Math.PI / 2); }); g.position.set(x, 0, -4.6); g.userData.info = { nom: 'Diffusion façade', texte: 'Reçoit la sortie principale (MAIN OUT, XLR, +4 dBu au « 0 ») par ses amplificateurs : ce que la salle entend.' }; root.add(g); return g; };
    const facL = fac(-3.6), facR = fac(3.6);
    const rec = appareil('serveur', 'Enregistreur', { info: { nom: 'Enregistreur grand public', texte: 'Branché sur REC OUT (RCA, −10 dBV) : une copie du mélange principal, environ 12 dB sous le niveau pro.' } }); rec.position.set(3.8, 0, -0.6); rec.rotation.y = -Math.PI / 2; root.add(rec);
    const vid = appareil('passerelle', 'Régie vidéo', { info: { nom: 'Départ vers la régie vidéo', texte: 'Une sortie ligne symétrique : ici la sortie principale en jack. Mieux : un AUX post-fader réglé pour l\'enregistrement. On convient de l\'alignement avec la régie (le car attend 0 dBu pour −18 dBFS).' } }); vid.position.set(3.8, 0, 0.9); vid.rotation.y = -Math.PI / 2; root.add(vid);
    // ---------------- câbles et chemins du signal ----------------
    desk.updateMatrixWorld(true);
    const W3 = (x, y, z) => desk.localToWorld(new THREE.Vector3(x, y, z));
    const cMat = mat('plastique', 0x2a2f35, { roughness: 0.55 });
    const addC = (m, info) => { m.userData.info = info; root.add(m); return m; };
    const prise = (o) => { o.updateMatrixWorld(true); return o.userData.port.clone().applyMatrix4(o.matrixWorld); };
    const micCable = addC(cableEntre(prise(micCh), W3(sx(0), 0.02, Z.xlr), 0.022, cMat, 0.25, { da: new THREE.Vector3(0, 0, 1), db: new THREE.Vector3(0, 0.6, -1).normalize(), out: 0.3 }), { nom: 'Câble micro (XLR, symétrique)', texte: 'Du micro du chant à l\'entrée XLR de la voie 1 : quelques millivolts.' });
    const gtCable = addC(cableEntre(prise(micGt), W3(sx(1), 0.02, Z.xlr), 0.022, cMat, 0.25, { da: new THREE.Vector3(0, 0, 1), db: new THREE.Vector3(0, 0.6, -1).normalize(), out: 0.3 }), { nom: 'Câble micro de la guitare', texte: 'Il porte aussi le 48 V vers le micro statique, sur ses deux conducteurs de modulation.' });
    const out = (x) => W3(x, -H / 2, -D / 2 - 0.02), back = new THREE.Vector3(0, 0, -1).applyQuaternion(desk.quaternion);
    const toPort = (o, off = [0, 0, 0]) => { o.updateMatrixWorld(true); return new THREE.Vector3(off[0], off[1], off[2]).applyMatrix4(o.matrixWorld); };
    const cMainL = addC(cableEntre(out(1.5), toPort(facL, [0, 0.35, 0]), 0.025, cMat, 0.5, { da: back, db: new THREE.Vector3(0, -1, 0.3).normalize(), out: 0.2 }), { nom: 'MAIN OUT L → façade gauche', texte: 'XLR symétrique, niveau ligne pro.' });
    const cMainR = addC(cableEntre(out(1.28), toPort(facR, [0, 0.35, 0]), 0.025, cMat, 0.5, { da: back, db: new THREE.Vector3(0, -1, 0.3).normalize(), out: 0.2 }), { nom: 'MAIN OUT R → façade droite', texte: 'XLR symétrique, niveau ligne pro.' });
    const cAux = addC(cableEntre(out(0.78), toPort(retour, [0, 0.2, -0.25]), 0.022, mat('plastique', 0x3d8a5a, { roughness: 0.55 }), 0.4, { da: back, db: new THREE.Vector3(0, 0, 1), out: 0.2 }), { nom: 'AUX OUT → retours', texte: 'Le mélange des retours (pré-fader) vers l\'amplificateur des retours de scène.' });
    const cAux2 = addC(cableEntre(toPort(retour, [0.3, 0.1, -0.2]), toPort(retour2, [-0.3, 0.1, -0.2]), 0.018, mat('plastique', 0x3d8a5a, { roughness: 0.55 }), 0.1), { nom: 'Retours chaînés', texte: 'Le même mélange de retours pour les deux musiciens.' });
    const cRec = addC(cableEntre(out(0.27), prise(rec), 0.018, mat('plastique', 0xb8bec4, { roughness: 0.5 }), 0.6, { da: back, db: new THREE.Vector3(1, 0, 0), out: 0.2 }), { nom: 'REC OUT (RCA) → enregistreur', texte: 'Asymétrique, −10 dBV : réservé aux appareils grand public, sur une courte distance.' });
    const cVid = addC(cableEntre(out(1.06), prise(vid), 0.022, mat('plastique', 0x2a5fb0, { roughness: 0.5 }), 0.6, { da: back, db: new THREE.Vector3(1, 0, 0), out: 0.2 }), { nom: 'MAIN OUT (jack) → régie vidéo', texte: 'Une liaison symétrique au niveau ligne ; jamais la sortie casque.' });
    /** une courbe sur le dessus de la console, de point local en point local */
    const surf = (pts) => courbe(pts.map(([x, z, y = 0.075]) => W3(x, y, z)));
    const C = {
      micIn: micCable.userData.curve, gtIn: gtCable.userData.curve,
      strip1: surf([[sx(0), Z.xlr], [sx(0), Z.gain], [sx(0), Z.low], [sx(0) + 0.07, Z.aux], [sx(0) + 0.07, Z.pan], [sx(0) + 0.07, 0.79]]),
      strip2: surf([[sx(1), Z.xlr], [sx(1), Z.low], [sx(1) + 0.07, Z.pan], [sx(1) + 0.07, 0.79]]),
      bus: (x) => surf([[x + 0.07, 0.79], [x + 0.3, 0.86], [MX - 0.12, 0.86], [MX - 0.12, 0.3], [MX + 0.25, -0.1], [MX + 0.25, -1.05], [1.4, -1.15, -0.02], [1.4, -1.17, -0.11]]),
      aux: surf([[sx(0), Z.low], [sx(0) - 0.06, Z.aux], [sx(0) + 0.15, Z.aux + 0.03], [MX - 0.02, Z.aux + 0.03], [MX - 0.02, -0.4], [0.78, -1.05], [0.78, -1.15, -0.02], [0.78, -1.17, -0.11]]),
      fx: surf([[sx(0) + 0.07, 0.79], [sx(0) - 0.06, Z.fx], [sx(0) + 0.15, Z.fx - 0.04], [MX - 0.4, Z.fx - 0.04], [MX - 0.12, -0.25], [MX - 0.19, 0.06], [MX - 0.12, 0.6], [MX, 0.8]]),
      mainL: cMainL.userData.curve, mainR: cMainR.userData.curve, aux1: cAux.userData.curve, aux2: cAux2.userData.curve, rec: cRec.userData.curve, vid: cVid.userData.curve,
    };
    const BUS1 = C.bus(sx(0)), BUS2 = C.bus(sx(1));
    const flux = ctx.flux(500, new THREE.SphereGeometry(1, 12, 8), eclat(0xffffff));
    const go = (chemin, couleur, info, taille = 0.07) => {
      const [first, ...rest] = chemin; if (!first) return;
      flux.add({ curve: first, speed: 1.5, color: couleur, scale: taille, info, onEnd: () => { if (S.alive) go(rest, couleur, info, taille); } });
    };
    // ---------------- le calcul : la tranche, les sorties, la boucle du retour ----------------
    let R = null;
    function calc() {
      const chant = sourceById('chant'), gt = sourceById('guitare');
      const c1 = chaine({ entree: niveauEntree(chant), gain: S.gain, eq: { low: S.low, mid: S.mid, high: S.high }, bandes: chant.bandes, coupeBas: S.cb, fader: S.fader, pan: 0, master: S.master });
      const c2 = chaine({ entree: niveauEntree(gt, S.p48), gain: 32, bandes: gt.bandes, coupeBas: true, fader: -4, pan: -0.3, master: S.master });
      const o = sorties([
        { nom: 'Chant', niveau: c1.apresEq, fader: S.fader, pan: 0, aux: S.aux, fx: S.fx },
        { nom: 'Guitare', niveau: c2.apresEq, fader: -4, pan: -0.3, aux: -6, fx: -16 },
        { nom: 'Clavier', niveau: -2, fader: -6, pan: 0.3, aux: -20, fx: -Infinity },
      ], { master: S.master, auxMaster: S.auxMaster, fxRetour: -6 });
      const L = boucle({ gainSysteme: 6 + S.aux + S.auxMaster, distance: 0.8, rejet: rejetCardio(S.retourDevant ? 0 : 180) });
      R = { c1, c2, o, L };
      return R;
    }
    function lire() {
      const { c1, o, L } = calc();
      ctx.read('Tranche 1 (chant)', `micro ${sdb(c1.etages[0].v)} dBu → GAIN ${sdb(c1.apresGain)} → égaliseur ${sdb(c1.apresEq)} → fader ${sdb(c1.apresFader)} dBu · PEAK ${c1.peak ? 'ROUGE' : 'éteinte'}${c1.ecrete ? ' · ÉCRÊTÉ' : ''}`);
      ctx.read('Vumètres', S.pfl ? `PFL voie 1 : ${sdb(c1.vuPfl)} (${verdictNiveau(c1.vuPfl)})` : `bus principal : ${sdb(Math.max(o.principale.g, o.principale.d))} (${verdictNiveau(Math.max(o.principale.g, o.principale.d))})`);
      ctx.read('Sorties', `MAIN ${sdb(o.principale.xlr)} dBu (XLR) · AUX ${sdb(o.aux.v)} dBu · REC ${sdb(o.rec)} dBu (${sdb(o.rec + 20 * Math.log10(0.775))} dBV)`);
      ctx.read('Retour du chanteur', !Number.isFinite(L.gain) ? 'pas de retour' : L.larsen ? `LARSEN : gain de boucle ${sdb(L.gain)} dB` : `marge avant larsen ${fmtNum(L.marge, 1)} dB (le retour ${S.retourDevant ? 'dans l\'axe du micro' : 'dans son axe mort'})`);
      // les commandes de la voie 1 suivent
      const rot = (k, v) => { const K = k1[k]; K.g.rotation.y = -angle(v, K.min, K.max); };
      rot('gain', S.gain); rot('high', S.high); rot('mid', S.mid); rot('low', S.low); rot('aux', Number.isFinite(S.aux) ? S.aux : -40); rot('fx', Number.isFinite(S.fx) ? S.fx : -40); rot('pan', 0);
      kAuxM.rotation.y = -angle(Number.isFinite(S.auxMaster) ? S.auxMaster : -40, -40, 10); kFxRet.rotation.y = -angle(-6, -40, 10);
      fader1.position.z = faderZ(S.fader); faderM.position.z = faderZ(S.master);
      /** @type {any} */ (p48Led.material).color.set(S.p48 ? 0xff3a2a : 0x3a1a18);
      /** @type {any} */ (pflKey.material).color.set(S.pfl ? 0xffb020 : 0x2a3036);
      larsenRing.visible = L.larsen;
      micCh.rotation.y = S.retourDevant ? 0 : Math.PI;
    }
    const LEDS = [-30, -20, -10, -7, -4, -2, 0, 2, 4, 7, 10, PEAK - 0];
    function drawVu(l, r) {
      const g = vu.g, w = vu.W, h = vu.H;
      g.fillStyle = '#0a0d10'; g.fillRect(0, 0, w, h);
      const n = LEDS.length, cell = (h - 30) / n;
      g.font = '600 15px "B612 Mono", monospace';
      LEDS.forEach((d, k) => {
        const y = h - 18 - (k + 1) * cell;
        const c = k === n - 1 ? '#e0453a' : d > 0 ? '#ffb020' : '#3fcf6e';
        for (const [x, v] of [[16, l], [w - 66, r]]) { g.fillStyle = v >= d ? c : '#1a2226'; g.fillRect(/** @type {number} */ (x), y + 2, 50, cell - 5); }
        g.fillStyle = '#8a949c'; g.fillText(k === n - 1 ? 'CLIP' : String(d).replace('-', '−'), w / 2 - (k === n - 1 ? 18 : 10), y + cell - 6);
      });
      g.fillStyle = '#aab4ba'; g.fillText(S.pfl ? 'PFL' : 'L    R', w / 2 - (S.pfl ? 14 : 22), h - 2);
      vu.mesh.material.map.needsUpdate = true;
    }
    let tEmit = 0, ui = null;
    const setUi = () => {
      if (!ui) return;
      for (const inp of ui.querySelectorAll('input[name]')) { const e = /** @type {HTMLInputElement} */ (inp); const v = S[e.name]; e.value = String(Number.isFinite(v) ? v : e.min); e.dispatchEvent(new Event('input')); }
      for (const b of ui.querySelectorAll('[data-k]')) { const e = /** @type {HTMLElement} */ (b); b.setAttribute('aria-pressed', String(String(S[e.dataset.k]) === e.dataset.v)); }
    };
    lire();
    return {
      dispose() { S.alive = false; },
      etape(i, E) {
        Object.assign(S, DEF, E.reglage || {});
        flux.clear();
        const F = E.focus ? FOCUS[E.focus] : null;
        if (F) { spot.visible = true; spot.position.set(F.p[0], F.p[1], F.p[2]); spot.scale.set(F.s[0] / 0.24, F.s[1] / 0.1, F.s[2] / 0.16); spotTag.set(F.t); spotTag.show(true); } else { spot.visible = false; spotTag.show(false); }
        lire(); setUi();
      },
      update(dt) {
        S.t += dt;
        // les vumètres : le niveau du moment, animé comme un signal qui vit (les crêtes atteignent le niveau calculé)
        if (R) {
          const vit = () => -Math.abs(Math.sin(S.t * 3.1) * 3 + Math.sin(S.t * 7.3) * 2 + Math.sin(S.t * 1.3) * 4);
          const tl = S.pfl ? R.c1.vuPfl : R.o.principale.g, tr = S.pfl ? R.c1.vuPfl : R.o.principale.d;
          S.meter.l += ((Number.isFinite(tl) ? tl + vit() : -60) - S.meter.l) * Math.min(1, dt * 10);
          S.meter.r += ((Number.isFinite(tr) ? tr + vit() * 0.9 : -60) - S.meter.r) * Math.min(1, dt * 10);
          drawVu(S.meter.l, S.meter.r);
          // LED PEAK : rouge si le préampli approche l'écrêtage, verte si un signal arrive
          leds.setColorAt(0, col.set(R.c1.peak ? 0xff3a2a : Number.isFinite(R.c1.apresGain) ? 0x3fcf6e : 0x203024));
          leds.setColorAt(1, col.set(Number.isFinite(R.c2.apresGain) ? 0x3fcf6e : 0x203024));
          leds.setColorAt(8, col.set(0x3fcf6e));
          if (leds.instanceColor) leds.instanceColor.needsUpdate = true;
          if (R.L.larsen) /** @type {any} */ (larsenRing.material).color.setHSL(0, 1, 0.35 + 0.25 * Math.abs(Math.sin(S.t * 9)));
        }
        tEmit += dt; if (tEmit < 0.45 || !R) return; tEmit = 0;
        const clip = !!R.c1.ecrete, cMain = clip ? COUL.rouge : COUL.ambre;
        const iMain = { nom: 'Le chant, dans le mélange principal', texte: clip ? 'Écrêté dès le préampli : les crêtes sont coupées, et le fader n\'y peut rien.' : 'Du micro au GAIN, à l\'égaliseur, au fader, puis au bus principal et à la sortie XLR.' };
        // le chant : vers le bus si le fader est ouvert ; vers les retours (pré-fader) dans tous les cas ; vers l'effet (post-fader)
        if (Number.isFinite(R.c1.apresFader) && Number.isFinite(S.master)) go([C.micIn, C.strip1, BUS1, Math.random() < 0.5 ? C.mainL : C.mainR], cMain, iMain);
        if (Number.isFinite(R.o.aux.v)) go([C.micIn, C.aux, C.aux1, C.aux2], COUL.vert, { nom: 'L\'AUX des retours (pré-fader)', texte: 'Pris avant le fader : le chanteur s\'entend même quand la façade ferme sa voie.' }, 0.055);
        if (Number.isFinite(R.o.fx.v)) go([C.fx], COUL.violet, { nom: 'L\'envoi d\'effets (post-fader)', texte: 'Pris après le fader : la réverbération suit la voix, puis revient dans le bus principal.' }, 0.055);
        if (Number.isFinite(R.c2.apresGain)) go([C.gtIn, C.strip2, BUS2, C.mainL], COUL.ambre, { nom: 'La guitare, dans le mélange principal', texte: 'Le micro statique de la voie 2, alimenté par le 48 V.' }, 0.055);
        if (Number.isFinite(R.o.rec)) { go([C.rec], COUL.cyan, { nom: 'REC OUT vers l\'enregistreur', texte: 'Une copie du mélange principal, à −10 dBV.' }, 0.055); go([C.vid], COUL.cyan, { nom: 'Vers la régie vidéo', texte: 'La sortie principale en jack, symétrique, au niveau ligne.' }, 0.055); }
      },
      commandes() {
        const db = (v) => (v <= -40 ? 'fermé' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' dB');
        const sl = (name, label, min, max, f = db) => { const s = slider(label, min, max, Number.isFinite(S[name]) ? S[name] : min, 1, (v) => { S[name] = v <= -40 && min <= -40 ? -Infinity : v; lire(); }, f); /** @type {HTMLInputElement} */ (s.querySelector('input')).name = name; return s; };
        const tog = (k, label, opts) => el('div', { class: 'v3-row' }, el('span', {}, label), el('div', { class: 'seg', role: 'group', 'aria-label': label }, ...opts.map(([v, t]) => el('button', { type: 'button', 'data-k': k, 'data-v': String(v), 'aria-pressed': String(S[k] === v), onclick: () => { S[k] = v; lire(); setUi(); ctx.say(`${label} : ${t}.`); } }, t))));
        ui = el('div', { class: 'v3-ctl' },
          sl('gain', 'GAIN de la voie 1', 0, 60, (v) => '+' + v + ' dB'),
          sl('mid', 'MID 2,5 kHz', -15, 15), sl('low', 'LOW 80 Hz', -15, 15),
          sl('aux', 'AUX (retours, pré-fader)', -40, 10), sl('fx', 'FX (effets, post-fader)', -40, 10),
          sl('fader', 'Fader de la voie 1', -40, 10), sl('master', 'Master', -40, 10), sl('auxMaster', 'Master AUX', -40, 10),
          tog('p48', '48 V', [[true, 'allumé'], [false, 'coupé']]),
          tog('pfl', 'PFL voie 1', [[false, 'relâché'], [true, 'enfoncé']]),
          tog('retourDevant', 'Micro du chant', [[false, 'dos au retour'], [true, 'pointé vers le retour']]));
        return ui;
      },
    };
    function knobTexte(k) {
      return {
        gain: `+${S.gain} dB. Le préampli : il porte le micro au niveau de la console. Réglé en PFL, crêtes autour du « 0 », sans PEAK. L'écrêtage est vers +${ECRETAGE} dBu (ordre de grandeur).`,
        high: `${sdb(S.high, 0)} dB vers 12 kHz : la brillance, le souffle.`, mid: `${sdb(S.mid, 0)} dB vers 2,5 kHz : la présence de la voix. Une bande poussée ajoute du niveau.`, low: `${sdb(S.low, 0)} dB vers 80 Hz : le corps, et le grondement (le coupe-bas l'enlève).`,
        aux: `${sdb(S.aux, 0)} dB vers les retours. Pris avant le fader : il ne le suit pas.`, fx: `${sdb(S.fx, 0)} dB vers les effets. Pris après le fader : la réverbération suit la voix.`,
        pan: 'Au centre : −3 dB sur chaque voie, gauche et droite (loi de panoramique à puissance constante).',
      }[k];
    }
  },
};
