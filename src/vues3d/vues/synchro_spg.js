// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { choice, slider, fmtNum } from '../../cours/kit.js';
import { ondeMv, BB, TRI, niveauLigne, verrou, nomSortie, referenceSpg, wordclock, RECEPTEURS, rythmes, decalage, ltcVerdict } from '../../cours/synchro_calc.js';
import { COUL, mat, eclat, ecran, piece, texte } from '../kit.js';
import { appareil, Reseau } from '../materiel.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Le SPG700 et ses sorties » : un générateur de synchro type Tektronix SPG700 (agrandi environ trois
// fois), face arrière vers nous avec ses BNC sérigraphiés (entrée genlock bouclée, BLACK 1 à 3, word clock,
// DARS, LTC, SDI de l'option), sa façade et son afficheur de l'autre côté. Ses sorties partent vers les
// appareils du plateau : BLACK 1 en tri-level vers un DA et trois CCU, BLACK 2 en black burst vers le
// mélangeur puis, en boucle, une caméra PTZ fermée par un bouchon 75 Ω, BLACK 3 avancée vers le serveur
// ralenti, le word clock vers la console de l'option son puis un convertisseur (bouchon au bout), le LTC vers
// un enregistreur. Un oscilloscope montre la sortie choisie telle qu'elle arrive ; une lampe au-dessus de chaque
// appareil dit s'il se verrouille. Tous les verdicts et les formes d'onde viennent de cours/synchro_calc.js.
// La disposition des connecteurs est indicative (à vérifier sur l'appareil de l'établissement).
// ----------------------------------------------------------------------------------
const SY = 1.15; // hauteur du générateur
const SW = 1.45, SD = 0.9, SH = 0.13; // largeur (19" × 3), profondeur, hauteur (1U × 3)
const SX = -2.4, SZ = -1.2;
/** les connecteurs de la face arrière (x dans le repère du générateur), dans l'ordre */
const PORTS = [
  { id: 'gen1', l: 'GENLOCK', x: -0.62, col: '#7fd3f3' }, { id: 'gen2', l: '(boucle)', x: -0.5, col: '#7fd3f3' },
  { id: 'b1', l: 'BLACK 1', x: -0.34, col: '#ffd38a' }, { id: 'b2', l: 'BLACK 2', x: -0.22, col: '#ffd38a' }, { id: 'b3', l: 'BLACK 3', x: -0.1, col: '#ffd38a' },
  { id: 'wc', l: 'WORD CLK', x: 0.06, col: '#c9a8ff' }, { id: 'dars', l: 'DARS', x: 0.18, col: '#c9a8ff' },
  { id: 'ltc', l: 'LTC', x: 0.34, col: '#7fd1a0', sub: true }, { id: 'sdi1', l: 'SDI 1', x: 0.5, col: '#aab4ba' }, { id: 'sdi2', l: 'SDI 2', x: 0.6, col: '#aab4ba' },
];
const PIDX = Object.fromEntries(PORTS.map((p, i) => [p.id, i]));
const FMT_OPTS = /** @type {[string, string, string][]} */ ([['pal', 'BB PAL', 'Black burst 625 lignes'], ['ntsc', 'BB NTSC', 'Black burst 525 lignes'], ['1080i50', 'TRI 1080i50', 'Tri-level 1080i50'], ['720p50', 'TRI 720p50', 'Tri-level 720p50'], ['1080i59', 'TRI 1080i59', 'Tri-level 1080i59,94']]);
const FEN = rythmes('1080p50').ligneUs / 2;
const RETARD_SERVEUR = 14.5;
/** le réglage de départ d'une étape : tout est juste */
const BON = { b1: '1080i50', b2: 'pal', b3: 'pal', off3: -14.5, wc: '5V', rx: 'ttl', bPtz: true, bConv: true, mode: 'interne', stay: true, perdue: false, scope: 'b1', ltc: '25' };
const signe = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v), d);

export const VUE_SYNCHRO_SPG = {
  id: 'synchro-spg', chapitre: 'synchro', titre: 'Le SPG700 et ses sorties',
  resume: 'Un générateur type SPG700, ses BNC et sa façade ; ses sorties BLACK vers les CCU, le mélangeur, la PTZ et le serveur ralenti, le word clock vers la console son, le LTC ; un oscilloscope et un bouchon 75 Ω.',
  lecons: ['synchro-spg', 'synchro-signaux', 'synchro-distribution', 'synchro-wordclock'],
  lectures: ['Référence d\'entrée', 'Appareils verrouillés', 'Serveur au mélangeur', 'À l\'oscilloscope', 'Word clock à la console'],
  depart: 'Le générateur est agrandi environ trois fois, face arrière vers vous. Une lampe verte au-dessus d\'un appareil : il est verrouillé ; rouge : il ne l\'est pas.',
  vue: { cible: [0.6, 0.85, 0.3], dir: [0, 0.6, 1], dist: 10.5 },
  orbite: { rMin: 0.8, rMax: 20 },
  etapes: [
    { t: 'Le générateur, face arrière', lecon: 'synchro-spg', reglage: {}, vue: { cible: [SX, SY, SZ + 0.4], dir: [0.05, 0.25, 1], dist: 2.6 },
      texte: `Le **SPG700** (Tektronix, aujourd'hui Telestream) est un générateur de synchronisation d'une unité de baie, ici agrandi. De gauche à droite, à l'arrière :
- l'**entrée genlock**, deux BNC en boucle : une référence extérieure (black burst, tri-level ou 10 MHz) ;
- les **trois sorties BLACK** : chacune en black burst ou en tri-level, avec son propre décalage ;
- le **word clock** 48 kHz et le **DARS** (référence audio AES11) ;
- le **LTC** (timecode) ;
- les deux sorties **SDI** de l'option : des mires.

La disposition est indicative : vérifiez celle de l'appareil de l'établissement.` },
    { t: 'La façade et la référence d\'entrée', lecon: 'synchro-spg', reglage: { mode: 'genlock' }, vue: { cible: [SX, SY, SZ - 0.4], dir: [-0.1, 0.25, -1], dist: 2.4 },
      texte: `De l'autre côté, la **façade** : l'afficheur et les touches de navigation. Premier réglage : la **référence d'entrée**.
- **Interne** : l'oscillateur thermostaté du générateur donne le rythme ; il est le maître du plateau.
- **Genlock** : il suit une référence plus haute, arrivée sur l'entrée bouclée.

Avec **Stay GenLock**, si cette référence disparaît, les sorties gardent fréquence et phase, puis rattrapent l'écart en douceur. Essayez « Débrancher la référence » dans « À vous », avec et sans Stay GenLock.` },
    { t: 'Trois sorties, trois groupes d\'appareils', lecon: 'synchro-spg', reglage: {}, vue: { cible: [0.6, 0.8, 0.2], dir: [0, 0.6, 1], dist: 10 },
      texte: `Chaque sortie BLACK nourrit un **groupe** d'appareils qui demandent le même format et la même phase :
- **BLACK 1**, tri-level 1080i50 → un **DA** → les trois CCU (impulsions ambre) ;
- **BLACK 2**, black burst PAL → le **mélangeur**, puis en boucle la **caméra PTZ** 720p50 (blanches) ;
- **BLACK 3**, black burst PAL avancé → le **serveur ralenti**.

Le **word clock** (violet) va à la console de l'option son, le **LTC** (vert) à l'enregistreur. Toutes les lampes sont vertes : le plateau suit le générateur.` },
    { t: 'Black burst et tri-level à l\'oscilloscope', lecon: 'synchro-signaux', reglage: { scope: 'b1' }, vue: { cible: [3.5, 1.25, 2.1], dir: [-0.8, 0.22, 1], dist: 3.0 },
      texte: `L'oscilloscope montre la sortie choisie, telle qu'elle arrive. Sur **BLACK 1**, le **tri-level** : −300 mV puis +300 mV, 44 périodes de 74,25 MHz chacune (0,59 µs) ; le repère est le **passage à 0 V** au milieu.

Passez l'oscilloscope sur **BLACK 2** : le **black burst**, un top de 4,7 µs à −300 mV suivi de la salve de sous-porteuse à 4,43 MHz ; son repère est à mi-hauteur du front descendant.` },
    { t: 'Une sortie de la mauvaise famille', lecon: 'synchro-signaux', reglage: { b2: 'ntsc', scope: 'b2' }, vue: { cible: [0.9, 0.9, 0.3], dir: [0.1, 0.45, 1], dist: 5.2 },
      texte: `**BLACK 2** est passée en **black burst NTSC** (525 lignes, 59,94 Hz), le réglage d'usine de bien des générateurs vendus en Amérique. Le mélangeur et la PTZ sont de la famille **50 Hz** : leurs images ne peuvent pas tomber au rythme d'une référence à 29,97 images par seconde. Lampes rouges.

Remettez BLACK 2 en **BB PAL** dans « À vous ». Essayez aussi le **tri-level 1080i50** : le mélangeur l'accepte, pas la PTZ 720p50.` },
    { t: 'La boucle et son bouchon', lecon: 'synchro-distribution', reglage: { bPtz: false, scope: 'b2' }, vue: { cible: [1.0, 0.75, 0.4], dir: [0.15, 0.45, 1], dist: 4.2 },
      texte: `Le mélangeur a une **entrée bouclée** : deux BNC en T, à haute impédance ; la référence repart vers la PTZ. La ligne doit être fermée **une fois**, au bout, par un **bouchon 75 Ω** sur la PTZ. Il a été retiré : la ligne est **ouverte**.

À l'oscilloscope, le top atteint **−600 mV** au lieu de −300 : le niveau double, et l'impulsion revient en écho. Remettez le bouchon dans « À vous ».` },
    { t: 'Avancer la référence du serveur ralenti', lecon: 'synchro-spg', reglage: { off3: 0, scope: 'b3' }, vue: { cible: [2.6, 0.9, -0.2], dir: [0.1, 0.45, 1], dist: 4.6 },
      texte: `Le **serveur ralenti** est verrouillé, mais ses traitements font sortir ses images **14,5 µs** après sa référence : au mélangeur, il tombe hors de la fenêtre de ± ½ ligne (8,9 µs en 1080p50) et la coupe vers lui saute. Lampe ambre.

C'est à cela que sert le **décalage** de chaque sortie : avancez **BLACK 3** de 14,5 µs (−14,5 µs) avec le curseur de « À vous ». Les autres appareils n'en sont pas touchés : ils ont leur propre sortie.` },
    { t: 'Le word clock pour l\'option son', lecon: 'synchro-wordclock', reglage: { wc: '1V', scope: 'wc' }, vue: { cible: [-0.2, 0.9, 1.6], dir: [0.1, 0.5, 1], dist: 4.6 },
      texte: `La console de l'option son se cale sur le **word clock** du générateur : un carré à **48 kHz**, 1 920 échantillons par image. La sortie est réglée en **1 V sur 75 Ω** : centré sur 0 V, le signal ne monte qu'à +0,5 V, et l'entrée **TTL** de la console (un haut au-dessus de 2,4 V) ne voit aucun front. Lampe rouge : la console reste sur son horloge interne, le son claquera.

Passez la sortie en **5 V** : le haut dépasse 4 V, la console se cale. Le bouchon 75 Ω est au bout de la chaîne, sur le convertisseur, et là seulement.` },
    { t: 'La référence perdue : Stay GenLock', lecon: 'synchro-spg', reglage: { mode: 'genlock', perdue: true, stay: false }, vue: { cible: [0.6, 0.8, 0.2], dir: [0, 0.6, 1], dist: 10 },
      texte: `Le générateur suit une référence de bâtiment (genlock), et elle vient de disparaître, **sans Stay GenLock** : il repasse sur son oscillateur, et au retour de la référence il se **recalera d'un coup**. Toutes ses sorties sauteront ensemble : tout le plateau décroche un instant. Lampes rouges.

Activez **Stay GenLock** dans « À vous » : les sorties gardent leur fréquence et leur phase, puis rattrapent l'écart en douceur. Lampes vertes.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { ...BON, t: 0 };
    // ---------------- le générateur ----------------
    const spg = new THREE.Group(); spg.name = 'SPG700'; spg.position.set(SX, 0, SZ); root.add(spg);
    spg.add(piece('SPG700', 'laque', (b) => {
      b.cbox(0.5, SY - SH / 2 - 0.02, 0.5, 0, (SY - SH / 2 - 0.02) / 2, 0, 0x1d2227, 0.02); // pied
      b.cbox(SW, SH, SD, 0, SY, 0, 0x2f3438, 0.012);
      b.cbox(SW + 0.12, SH + 0.01, 0.025, 0, SY, -SD / 2 - 0.01, 0x3a4048, 0.008); // oreilles de baie, façade
      for (const s of [-1, 1]) b.cyl(0.012, 0.012, 0.02, s * (SW / 2 + 0.03), SY, -SD / 2 - 0.025, 0xb8bec4, 10, Math.PI / 2);
      // touches de la façade
      for (let i = 0; i < 6; i++) b.cbox(0.05, 0.035, 0.02, 0.18 + i * 0.075, SY - 0.02, -SD / 2 - 0.028, i === 5 ? 0x5a6470 : 0x3d454e, 0.006);
    }));
    spg.userData.info = () => ({ nom: 'Générateur de synchro type SPG700', texte: `${referenceSpg({ mode: /** @type {any} */ (S.mode), entree: 'pal', stay: S.stay, perdue: S.perdue }).texte} Trois sorties BLACK, word clock 48 kHz, DARS, LTC, deux sorties SDI en option.` });
    // les BNC de la face arrière (+z), leur sérigraphie
    const bncM = mat('alu', 0xc9ced3, { metalness: 0.9, roughness: 0.3 });
    const zr = SD / 2 + 0.005;
    spg.userData.ports = PORTS.map((p) => new THREE.Vector3(p.x, SY - 0.01, zr + 0.04));
    for (const p of PORTS) {
      const m = p.sub ? new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.02), mat('plastique', 0x2a3036)) : new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 20).rotateX(Math.PI / 2), bncM);
      m.position.set(p.x, SY - 0.01, zr + 0.02); spg.add(m);
      m.userData.info = { nom: `${p.l === '(boucle)' ? 'GENLOCK (boucle)' : p.l}`, texte: PORT_INFO[p.id] };
      const t = texte(p.l, { h: 0.028, color: p.col }); t.position.set(p.x, SY + 0.045, zr + 0.002); spg.add(t);
    }
    const tR = texte('SPG700 · face arrière', { h: 0.035, color: '#aab4ba' }); tR.position.set(-0.45, SY + 0.09, zr); spg.add(tR);
    // le bouchon de l'entrée genlock (rien n'en repart)
    const capG = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 16).rotateX(Math.PI / 2), mat('plastique', 0x3a4650)); capG.position.set(-0.5, SY - 0.01, zr + 0.06); spg.add(capG);
    capG.userData.info = { nom: 'Bouchon 75 Ω de l\'entrée bouclée', texte: 'Rien ne repart de la seconde BNC de l\'entrée genlock : on la ferme sur 75 Ω.' };
    // l'afficheur de la façade (-z)
    const lcd = ecran(0.5, 0.075, 512, () => {}); lcd.mesh.position.set(-0.32, SY + 0.005, -SD / 2 - 0.03); lcd.mesh.rotation.y = Math.PI; spg.add(lcd.mesh);
    lcd.mesh.userData.info = { nom: 'Afficheur de la façade', texte: 'La référence d\'entrée et l\'état du verrouillage, puis les menus des sorties, du word clock et du timecode (intitulés à vérifier sur l\'appareil).' };
    const tF = texte('SPG700 · façade', { h: 0.035, color: '#aab4ba' }); tF.position.set(0, SY + 0.09, -SD / 2 - 0.03); tF.rotation.y = Math.PI; spg.add(tF);
    ctx.label(spg, 'générateur (agrandi)', { off: [0, SY + 0.3, 0], cls: 'small' });

    // ---------------- les appareils ----------------
    const net = new Reseau(ctx, root, 400);
    const place = (o, x, z, ry = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; root.add(o); return o; };
    const da = place(appareil('ccu', 'DA'), -0.7, -0.4), ccu = [0, 1, 2].map((i) => place(appareil('ccu', `CCU ${i + 1}`), 0.6 + i * 0.85, -1.7));
    const mel = place(appareil('melangeur', 'Mélangeur'), 0.6, 0.35), ptz = place(appareil('camera', 'PTZ 720p50'), 1.7, 0.65);
    const srv = place(appareil('serveur', 'Serveur ralenti'), 2.9, -0.5);
    const cons = place(appareil('melangeur', 'Console son'), -0.8, 1.55), conv = place(appareil('passerelle', 'Convertisseur'), 0.5, 2.05);
    const enr = place(appareil('serveur', 'Enregistreur'), -2.3, 1.2);
    da.userData.info = { nom: 'Distributeur de référence (DA)', texte: 'Il recopie BLACK 1 vers chaque CCU : une sortie, un câble, une charge de 75 Ω par appareil.' };
    for (const [i, c] of ccu.entries()) c.userData.info = () => ({ nom: `CCU ${i + 1} (caméra 1080i50)`, texte: verrou('ccu', S.b1).texte });
    mel.userData.info = () => ({ nom: 'Mélangeur 1080p50', texte: `${verrou('melangeur', S.b2).texte} Son entrée REF IN est bouclée : la référence repart vers la PTZ.` });
    ptz.userData.info = () => ({ nom: 'Caméra PTZ 720p50', texte: `${verrou('ptz', S.b2).texte} Elle est au bout de la boucle : c'est sur elle que se met le bouchon 75 Ω.` });
    srv.userData.info = () => ({ nom: 'Serveur ralenti 1080p50', texte: `${verrou('serveur', S.b3).texte} Ses traitements retardent ses images de ${fmtNum(RETARD_SERVEUR, 1)} µs.` });
    cons.userData.info = () => ({ nom: 'Console de l\'option son', texte: `Entrée word clock ${RECEPTEURS[S.rx].nom} : ${wordclock({ sortie: S.wc, terminees: 0, bouchon: S.bConv, recepteur: S.rx }).raison}.` });
    conv.userData.info = { nom: 'Convertisseur analogique / numérique', texte: 'Au bout de la chaîne du word clock : le bouchon 75 Ω se met sur sa seconde BNC.' };
    enr.userData.info = () => ({ nom: 'Enregistreur', texte: ltcVerdict({ cadence: S.ltc, source: 'heure', fuseau: 1 }).texte });
    // les câbles depuis la face arrière (port i du générateur)
    const P = (id) => ({ obj: spg, i: PIDX[id] });
    const L = {
      b1: net.relie(P('b1'), { obj: da }, { couleur: 0xd0a040, r: 0.012, sag: 0.5, info: { nom: 'BLACK 1 → DA', texte: 'Coaxial 75 Ω : la référence des CCU.' } }),
      b2: net.relie(P('b2'), { obj: mel }, { couleur: 0xd8dcd6, r: 0.012, sag: 0.5, info: { nom: 'BLACK 2 → mélangeur', texte: 'Coaxial 75 Ω vers l\'entrée bouclée du mélangeur.' } }),
      b3: net.relie(P('b3'), { obj: srv }, { couleur: 0xd8dcd6, r: 0.012, sag: 0.6, info: { nom: 'BLACK 3 → serveur ralenti', texte: 'Une sortie à part, pour pouvoir l\'avancer sans toucher aux autres.' } }),
      wc: net.relie(P('wc'), { obj: cons }, { couleur: 0x8a6ad0, r: 0.012, sag: 0.5, info: { nom: 'Word clock → console son', texte: 'Coaxial 75 Ω, BNC : un carré à 48 kHz.' } }),
      ltc: net.relie(P('ltc'), { obj: enr }, { couleur: 0x3f9f5e, r: 0.012, sag: 0.4, info: { nom: 'LTC → enregistreur', texte: 'Le timecode, un signal audio : 80 bits par image.' } }),
    };
    const Lccu = ccu.map((c, i) => net.relie({ obj: da }, { obj: c }, { couleur: 0xd0a040, r: 0.01, sag: 0.3, info: { nom: `DA → CCU ${i + 1}`, texte: 'Une sortie de DA par CCU, en étoile.' } }));
    const Lptz = net.relie({ obj: mel }, { obj: ptz }, { couleur: 0xd8dcd6, r: 0.01, sag: 0.3, info: { nom: 'Boucle : mélangeur → PTZ', texte: 'La seconde BNC de l\'entrée du mélangeur repart vers la PTZ.' } });
    const Lconv = net.relie({ obj: cons }, { obj: conv }, { couleur: 0x8a6ad0, r: 0.01, sag: 0.3, info: { nom: 'Word clock : console → convertisseur', texte: 'En T sur l\'entrée de la console, à haute impédance.' } });
    // les bouchons au bout des boucles
    const capOf = (o, nom, texteInfo) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 16).rotateX(Math.PI / 2), mat('plastique', 0x3a4650));
      const p = o.userData.port; c.position.set(p.x + 0.1, p.y, p.z - 0.06); o.add(c);
      c.userData.info = { nom, texte: texteInfo };
      const lab = ctx.label(c, '75 Ω', { off: [0, 0.12, 0], cls: 'small ok' });
      return { c, lab };
    };
    const capPtz = capOf(ptz, 'Bouchon 75 Ω sur la PTZ', 'Il ferme la boucle de BLACK 2, une seule fois, au bout.');
    const capConv = capOf(conv, 'Bouchon 75 Ω sur le convertisseur', 'Il ferme la chaîne du word clock, au bout.');
    // une lampe au-dessus de chaque appareil : verte, ambre ou rouge
    const lampes = {};
    const lampe = (k, o, nom) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), eclat(0x7fd1a0)); m.position.set(0, o.userData.top + 0.18, 0); o.add(m);
      const tag = ctx.label(m, nom, { off: [0, 0.16, 0], cls: 'small' });
      lampes[k] = { m, tag };
    };
    ccu.forEach((c, i) => lampe('ccu' + i, c, 'REF LOCK'));
    lampe('mel', mel, 'REF LOCK'); lampe('ptz', ptz, 'REF LOCK'); lampe('srv', srv, 'REF LOCK'); lampe('cons', cons, 'WCLK'); lampe('enr', enr, 'TC');
    // ---------------- l'oscilloscope ----------------
    const scope = new THREE.Group(); scope.position.set(3.6, 0, 2.0); scope.rotation.y = -0.7; root.add(scope);
    scope.add(piece('oscilloscope', 'plastique', (b) => { b.cbox(0.5, 0.75, 0.42, 0, 0.375, 0, 0x1d2227, 0.02); b.cbox(1.3, 0.86, 0.3, 0, 1.2, -0.02, 0x2a3036, 0.02); }));
    const scr = ecran(1.16, 0.7, 640, () => {}); scr.mesh.position.set(0, 1.2, 0.135); scope.add(scr.mesh);
    scr.mesh.userData.info = () => ({ nom: 'Oscilloscope', texte: 'La sortie choisie dans « À vous », telle qu\'elle arrive au bout de sa ligne, couplée en continu.' });
    const tS = texte('Oscilloscope', { h: 0.07, bg: 'rgba(18,22,26,.86)' }); tS.position.set(0, 0.5, 0.215); scope.add(tS);

    // ---------------- les calculs, les lampes, l'afficheur ----------------
    const etat = () => {
      const R = referenceSpg({ mode: /** @type {any} */ (S.mode), entree: 'pal', stay: S.stay, perdue: S.perdue });
      const saut = R.etat === 'libre';
      const v1 = verrou('ccu', S.b1), vm = verrou('melangeur', S.b2), vp = verrou('ptz', S.b2), vs = verrou('serveur', S.b3);
      const ph = RETARD_SERVEUR + S.off3, okPh = Math.abs(ph) <= FEN;
      const nB2 = S.bPtz ? 1 : 0, ligne2 = niveauLigne(nB2);
      const W = wordclock({ sortie: S.wc, terminees: 0, bouchon: S.bConv, recepteur: S.rx });
      const lt = ltcVerdict({ cadence: S.ltc, source: 'heure', fuseau: 1 });
      return { R, saut, v1, vm, vp, vs, ph, okPh, ligne2, W, lt };
    };
    const col = (ok, warn = false) => (ok ? 0x7fd1a0 : warn ? 0xffb020 : 0xe0453a);
    function setLampe(k, ok, warn, txt) { const L0 = lampes[k]; /** @type {any} */ (L0.m.material).color.set(col(ok, warn)); L0.tag.set(txt); L0.tag.el.className = 'v3-tag small ' + (ok ? 'ok' : 'ko'); }
    function maj() {
      const E = etat();
      const refOk = (v) => v.ok && !E.saut;
      ccu.forEach((_, i) => setLampe('ccu' + i, refOk(E.v1), false, refOk(E.v1) ? 'REF LOCK' : E.saut ? 'saut' : 'NO REF'));
      // la boucle ouverte : verrouillé, mais niveau hors tolérance (ambre)
      const okBoucle = E.ligne2.verdict === 'ok';
      setLampe('mel', refOk(E.vm) && okBoucle, refOk(E.vm), !refOk(E.vm) ? (E.saut ? 'saut' : 'NO REF') : okBoucle ? 'REF LOCK' : 'niveau ×2');
      setLampe('ptz', refOk(E.vp) && okBoucle, refOk(E.vp), !refOk(E.vp) ? (E.saut ? 'saut' : 'NO REF') : okBoucle ? 'REF LOCK' : 'niveau ×2');
      setLampe('srv', refOk(E.vs) && E.okPh, refOk(E.vs), !refOk(E.vs) ? (E.saut ? 'saut' : 'NO REF') : E.okPh ? 'REF LOCK' : `hors fenêtre ${signe(E.ph, 1)} µs`);
      setLampe('cons', E.W.ok, false, E.W.ok ? 'WCLK EXT' : 'WCLK ?');
      setLampe('enr', E.lt.ok, false, E.lt.ok ? 'TC 25' : 'TC faux');
      capPtz.c.visible = S.bPtz; capPtz.lab.show(S.bPtz);
      capConv.c.visible = S.bConv; capConv.lab.show(S.bConv);
      drawLcd(E); drawScope(E);
      const nOk = [refOk(E.v1), refOk(E.v1), refOk(E.v1), refOk(E.vm) && okBoucle, refOk(E.vp) && okBoucle, refOk(E.vs) && E.okPh, E.W.ok, E.lt.ok].filter(Boolean).length;
      ctx.read('Référence d\'entrée', E.R.texte);
      ctx.read('Appareils verrouillés', `${nOk} sur 8 · BLACK 1 ${nomSortie(S.b1)}, BLACK 2 ${nomSortie(S.b2)}, BLACK 3 ${nomSortie(S.b3)}`);
      const d3 = decalage(S.off3, S.b3);
      ctx.read('Serveur au mélangeur', `décalage de BLACK 3 : ${signe(S.off3, 1) || '0'} µs (${d3.lignes ? `${d3.lignes} ligne(s) et ` : ''}${signe(d3.us, 2) || '0'} µs) → ses images arrivent à ${signe(E.ph, 1) || '0'} µs, ${E.okPh ? 'dans' : 'hors de'} la fenêtre (± ${fmtNum(FEN, 1)} µs)`);
      ctx.read('À l\'oscilloscope', scopeTexte(E));
      ctx.read('Word clock à la console', `${S.wc === '5V' ? '5 V' : '1 V sur 75 Ω'} : ${fmtNum(E.W.vpp, 2)} V crête à crête, haut ${fmtNum(E.W.haut, 2)} V, bas ${fmtNum(E.W.bas, 2).replace('-', '−')} V ; ${E.W.raison}${E.W.reflexions ? ', avec des rebonds (ligne mal fermée)' : ''}`);
      return E;
    }
    function scopeTexte(E) {
      if (S.scope === 'wc') return `word clock à la console : ${fmtNum(E.W.vpp, 2)} V crête à crête, un front toutes les 20,8 µs`;
      const f = S[S.scope], k = S.scope === 'b2' ? E.ligne2.k : 1;
      const top = BB[f] ? Math.abs(BB[f].topMv) * k : 300 * k;
      return `${S.scope.replace('b', 'BLACK ')} : ${nomSortie(f)}, top à ${fmtNum(top, 0)} mV${k !== 1 ? ` (${fmtNum(k * 100)} % : ligne ${E.ligne2.k > 1 ? 'ouverte' : 'trop chargée'})` : ''}`;
    }
    function drawLcd(E) {
      const g = lcd.g, W = lcd.W, H = lcd.H;
      g.fillStyle = '#0b1a12'; g.fillRect(0, 0, W, H);
      g.fillStyle = E.saut ? '#ff8a80' : '#7bf29a'; g.font = '600 30px "B612 Mono", monospace';
      const ref = S.mode === 'interne' ? 'REF INTERNE' : S.perdue ? (S.stay ? 'GENLOCK PERDU · STAY' : 'GENLOCK PERDU') : 'GENLOCK BB LOCK';
      g.fillText(ref, 14, 38);
      g.fillStyle = '#5fd07a'; g.font = '17px "B612 Mono", monospace';
      g.fillText(`B1 ${nomSortie(S.b1)} · B2 ${nomSortie(S.b2)} · B3 ${nomSortie(S.b3)}`, 14, 66);
      lcd.mesh.material.map.needsUpdate = true;
    }
    function drawScope(E) {
      const g = scr.g, W = scr.W, H = scr.H;
      g.fillStyle = '#071012'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#163028'; g.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(20 + i * 60, 20); g.lineTo(20 + i * 60, H - 40); g.stroke(); }
      for (let j = 0; j <= 8; j++) { const y = 20 + j * (H - 60) / 8; g.beginPath(); g.moveTo(20, y); g.lineTo(620, y); g.stroke(); }
      g.fillStyle = '#7fd1a0'; g.font = '600 20px "Archivo Narrow", sans-serif';
      const mid = 20 + (H - 60) / 2;
      if (S.scope === 'wc') {
        const v = E.W, Y = (u) => mid + 90 - u * 36;
        g.strokeStyle = '#3a6650'; g.setLineDash([6, 5]); for (const u of [2.4, 0.4]) { g.beginPath(); g.moveTo(20, Y(u)); g.lineTo(620, Y(u)); g.stroke(); } g.setLineDash([]);
        g.strokeStyle = v.ok ? '#c9a8ff' : '#ff8a80'; g.lineWidth = 3; g.beginPath();
        for (let i = 0; i <= 600; i++) { const x = 20 + i, ph = (i % 150) / 150, u = ph < 0.5 ? v.haut : v.bas; if (i) g.lineTo(x, Y(u)); else g.moveTo(x, Y(u)); }
        g.stroke(); g.lineWidth = 1;
        g.fillText(`WORD CLOCK 48 kHz · ${S.wc === '5V' ? '5 V' : '1 V / 75 Ω'} · 1 V/div`, 24, H - 12);
        g.fillStyle = '#3a6650'; g.fillText('seuils TTL', 520, Y(2.4) - 6);
      } else {
        const f = S[S.scope], k = S.scope === 'b2' ? E.ligne2.k : 1, isBB = !!BB[f];
        const [t0, t1] = isBB ? [-1.5, 9] : [-1.0, 1.2];
        const Y = (mv) => mid - mv * 0.36 * (H - 60) / 400 * 1.1;
        g.strokeStyle = '#2a4a3c'; g.beginPath(); g.moveTo(20, mid); g.lineTo(620, mid); g.stroke();
        g.strokeStyle = isBB ? '#e8ece6' : '#ffb020'; g.lineWidth = 3; g.beginPath();
        for (let i = 0; i <= 600; i++) { const t = t0 + (t1 - t0) * i / 600, y = Y(ondeMv(f, t) * k); if (i) g.lineTo(20 + i, y); else g.moveTo(20 + i, y); }
        g.stroke(); g.lineWidth = 1;
        const x0 = 20 + (0 - t0) / (t1 - t0) * 600;
        g.strokeStyle = '#e8eef2'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x0, 20); g.lineTo(x0, H - 40); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#7fd1a0'; g.fillText(`${S.scope.replace('b', 'BLACK ')} · ${nomSortie(f)} · 100 mV/div · ${fmtNum((t1 - t0) / 10, 2)} µs/div`, 24, H - 12);
        if (TRI[f] || BB[f]) g.fillText('0H', x0 + 6, 40);
      }
      scr.mesh.material.map.needsUpdate = true;
    }
    // ---------------- les impulsions ----------------
    const COUL_FMT = (f) => (TRI[f] ? 0xffb020 : 0xf2f3ee);
    let tRef = 0, tWc = 0, tLtc = 0, ui = null;
    const syncUi = () => {
      if (!ui) return;
      for (const w of ui.querySelectorAll('[data-k]')) { const k = /** @type {HTMLElement} */ (w).dataset.k || ''; for (const b of w.querySelectorAll('button[data-v]')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.v === String(S[k] === true ? 'oui' : S[k] === false ? 'non' : S[k]))); }
      const r = /** @type {HTMLInputElement | null} */ (ui.querySelector('input[name=off3]')); if (r) { r.value = String(S.off3); r.dispatchEvent(new Event('input')); }
    };
    maj();
    return {
      etape(i, E) { Object.assign(S, BON, E.reglage || {}); maj(); syncUi(); },
      update(dt) {
        S.t += dt; tRef += dt; tWc += dt; tLtc += dt;
        if (tRef > 1.3) {
          tRef = 0;
          const E = etat();
          net.trame(L.b1, 1, { couleur: COUL_FMT(S.b1), taille: [0.06, 0.06, 0.06], info: { nom: `Top de ${nomSortie(S.b1)}`, texte: 'Le début d\'une ligne de la référence de BLACK 1 (ralenti).' }, onEnd: () => { for (const l of Lccu) net.trame(l, 1, { couleur: COUL_FMT(S.b1), taille: [0.05, 0.05, 0.05] }); } });
          net.trame(L.b2, 1, { couleur: COUL_FMT(S.b2), taille: [0.06, 0.06, 0.06], info: { nom: `Top de ${nomSortie(S.b2)}`, texte: 'BLACK 2, vers l\'entrée bouclée du mélangeur.' }, onEnd: () => {
            net.trame(Lptz, 1, { couleur: COUL_FMT(S.b2), taille: [0.05, 0.05, 0.05], onEnd: () => { if (!S.bPtz) net.trame(Lptz, -1, { couleur: 0xff8a80, taille: [0.05, 0.05, 0.05], info: { nom: 'Écho', texte: 'Ligne ouverte : l\'impulsion repart du bout (Γ = +1).' } }); } });
          } });
          net.trame(L.b3, 1, { couleur: COUL_FMT(S.b3), taille: [0.06, 0.06, 0.06], retard: E.okPh ? 0 : 0.2 });
        }
        if (tWc > 0.5) { tWc = 0; net.trame(L.wc, 1, { couleur: 0x9a7bff, taille: [0.045, 0.045, 0.045], info: { nom: 'Word clock', texte: 'Un front par échantillon (ici très ralenti).' }, onEnd: () => net.trame(Lconv, 1, { couleur: 0x9a7bff, taille: [0.04, 0.04, 0.04] }) }); }
        if (tLtc > 2.0) { tLtc = 0; net.trame(L.ltc, 1, { couleur: COUL.vert, taille: [0.12, 0.05, 0.05], info: { nom: 'Mot LTC', texte: '80 bits par image : l\'heure du jour, à 25 images par seconde.' } }); }
      },
      commandes() {
        const grp = (k, node) => { const d = el('div', { 'data-k': k }); d.append(node); return d; };
        const set = (k, v, msg = '') => { S[k] = v; maj(); if (msg) ctx.say(msg); };
        const off = slider('Décalage de BLACK 3', -20, 20, S.off3, 0.5, (v) => set('off3', v), (v) => `${signe(v, 1) || '0'} µs`);
        /** @type {HTMLInputElement} */ (off.querySelector('input')).name = 'off3';
        ui = el('div', { class: 'v3-ctl' },
          grp('b1', choice('BLACK 1 (CCU)', FMT_OPTS, S.b1, (v) => set('b1', v))),
          grp('b2', choice('BLACK 2 (mélangeur, PTZ)', FMT_OPTS, S.b2, (v) => set('b2', v))),
          grp('b3', choice('BLACK 3 (serveur)', FMT_OPTS, S.b3, (v) => set('b3', v))),
          off,
          grp('bPtz', choice('Bouchon sur la PTZ', [['oui', 'mis'], ['non', 'retiré']], 'oui', (v) => set('bPtz', v === 'oui', v === 'oui' ? 'Bouchon remis : la boucle est fermée sur 75 Ω.' : 'Bouchon retiré : la ligne est ouverte, le niveau double.'))),
          grp('wc', choice('Word clock', [['5V', '5 V'], ['1V', '1 V sur 75 Ω']], S.wc, (v) => set('wc', v))),
          grp('bConv', choice('Bouchon du word clock', [['oui', 'mis'], ['non', 'retiré']], 'oui', (v) => set('bConv', v === 'oui'))),
          grp('scope', choice('Oscilloscope sur', [['b1', 'BLACK 1'], ['b2', 'BLACK 2 (au bout)'], ['b3', 'BLACK 3'], ['wc', 'word clock']], S.scope, (v) => set('scope', v))),
          grp('mode', choice('Référence d\'entrée', [['interne', 'interne'], ['genlock', 'genlock']], S.mode, (v) => set('mode', v))),
          grp('stay', choice('Stay GenLock', [['oui', 'activé'], ['non', 'désactivé']], 'oui', (v) => set('stay', v === 'oui', v === 'oui' ? 'Stay GenLock : les sorties gardent leur phase si la référence disparaît.' : 'Stay GenLock désactivé.'))),
          el('div', { class: 'v3-row' },
            el('button', { type: 'button', class: 'btn small', onclick: () => set('perdue', !S.perdue, S.perdue ? 'Référence d\'entrée rendue.' : 'Référence d\'entrée débranchée.') }, 'Débrancher / rendre la référence'),
            el('button', { type: 'button', class: 'btn small primary', onclick: () => { Object.assign(S, BON); maj(); syncUi(); ctx.say('Réglage juste remis : tout le plateau suit le générateur.'); } }, 'Tout remettre juste')));
        syncUi();
        return ui;
      },
    };
  },
};

/** ce que dit chaque connecteur de la face arrière quand on le clique */
const PORT_INFO = {
  gen1: 'Entrée de référence (genlock) : un black burst, un tri-level ou un 10 MHz venu d\'une référence plus haute.',
  gen2: 'La seconde BNC de l\'entrée bouclée : la référence d\'entrée y repart vers un autre appareil, ou on la ferme par un bouchon 75 Ω.',
  b1: 'Sortie BLACK 1 : black burst (PAL ou NTSC) ou tri-level d\'un format HD, avec son propre décalage de phase.',
  b2: 'Sortie BLACK 2 : un autre format et un autre décalage, pour un autre groupe d\'appareils.',
  b3: 'Sortie BLACK 3 : la troisième, souvent réservée à un appareil qu\'il faut avancer (un serveur, un habillage).',
  wc: 'Word clock 48 kHz : l\'horloge des appareils audio, en 5 V (CMOS) ou en 1 V sur 75 Ω.',
  dars: 'DARS : la référence audio de l\'AES11, un signal AES3 à 48 kHz.',
  ltc: 'Timecode LTC : trois sorties, et une quatrième en entrée ou en sortie ; cadence, source et fuseau réglables (connecteur à vérifier sur l\'appareil).',
  sdi1: 'Option SDI : une sortie de mires (barres, rampes…) avec son embarqué, en SD, HD ou 3G.',
  sdi2: 'Option SDI : la seconde sortie de mires.',
};
