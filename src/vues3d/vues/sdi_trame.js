// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { choice } from '../../cours/kit.js';
import { TRAMES, ZONES, ligneSDI, echantillonsLigne, freqMots, hex3, bitsDe, embrouille, imageRGB } from '../../cours/sdi_mots.js';
import { COUL, hex, mat, lum, eclat, piece, texte, ecran } from '../kit.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Le coaxial et la trame SDI » : une maquette de coaxial 1694A agrandie environ 107 fois,
// dénudée en escalier au bout (gaine, tresse, feuillard, diélectrique, âme) et ouverte en deux sur
// sa longueur. Dans la coupe, entre l'âme et la tresse (là où l'onde voyage vraiment), passe le flux
// SDI calculé mot par mot (cours/sdi_mots.js) : la ligne entière (l'image passe en couleurs), puis
// mot à mot (EAV, LN, CRC, paquets audio, SAV, Cb Y Cr Y) et bit à bit (le signal embrouillé, NRZI,
// au-dessus du câble). À gauche, l'image source, sa suppression horizontale et verticale.
// ----------------------------------------------------------------------------------
const Y0 = 1.0; // hauteur de l'axe du câble
// rayons (m) d'un 1694A agrandi ≈ 107 fois : âme Ø 1,02 mm, diélectrique Ø 4,57, tresse ≈ Ø 5,3, gaine Ø 6,9
const RC = 0.055, RD = 0.245, RF = 0.255, RB = 0.285, RJ = 0.37;
// le flux part du sérialiseur, à droite (x = S0), et file vers la gauche : le premier mot envoyé est devant,
// à gauche, et les mots se lisent dans l'ordre d'envoi, de gauche à droite. s : distance au sérialiseur.
const S0 = 2.75, XEND = -4.5; // le câble sort du sérialiseur en S0 ; la gaine s'arrête en XEND
const SEND = S0 - XEND;
const CUT = [-3.6, 1.6]; // fenêtre de coupe en x (moitié avant retirée)
const XL = -1.1; // la loupe
const xOfS = (sv) => S0 - sv;
const MODES = {
  ligne: { u: 5.4, vit: 0.16, nom: 'Ligne entière' }, // u : longueur d'une ligne (m) ; vit : lignes par seconde
  mots: { u: 0.2, vit: 1.0, nom: 'Mot à mot' }, // u : longueur d'un mot ; vit : mots par seconde
  bits: { u: 0.075, vit: 1.2, nom: 'Bit à bit' }, // u : longueur d'un bit ; vit : bits par seconde
};
const ZCOL = { EAV: COUL.eav, LN: COUL.ln, CRC: COUL.ln, ANC: COUL.audio, HANC: COUL.hanc, SAV: COUL.sav };
const colOf = (w) => (w.z === 'ACT' ? (w.f === 'Y' ? COUL.video : COUL.chroma) : ZCOL[w.z]);

/** le flux du cours : quelques lignes consécutives (le son n'est pas sur toutes), en série */
function cycle(fk) {
  const lignes = [], N = 4, n0 = fk === '720p50' ? 370 : 560;
  for (let i = 0; i < N; i++) lignes.push(ligneSDI(fk, n0 + i, { audio: echantillonsLigne(fk, n0 + i) }));
  const mots = lignes.flat();
  // séquences RLE pour la vue « ligne » : zones, paquets audio un par un, vidéo active en 32 tranches colorées
  const runs = []; let k = 0;
  for (let li = 0; li < N; li++) {
    // une paire (C, Y) à la fois : la zone est celle du flux C (en HANC, le flux Y ne porte que du remplissage)
    const L = lignes[li], np = L.length / 2; let p = 0;
    while (p < np) {
      const c = L[2 * p];
      if (c.z === 'ACT') {
        const nAct = np - p, part = Math.ceil(nAct / 32);
        for (let q = 0; q < nAct; q += part) {
          const n = Math.min(part, nAct - q);
          const [r, g, b] = imageRGB((q + n / 2) / nAct, 0.47);
          runs.push({ k0: k + 2 * (p + q), n: 2 * n, z: 'ACT', col: new THREE.Color(r, g, b).getHex(), ligne: n0 + li });
        }
        break;
      }
      let q = p + 1;
      if (c.z === 'ANC') while (q < np && !/^CS/.test(L[2 * (q - 1)].d)) q++; // un paquet s'arrête à sa somme de contrôle
      else while (q < np && L[2 * q].z === c.z) q++;
      runs.push({ k0: k + 2 * p, n: 2 * (q - p), z: c.z, col: ZCOL[c.z], ligne: n0 + li });
      p = q;
    }
    k += L.length;
  }
  // le signal sur le câble : embrouillé puis NRZI, en régime établi (deux tours du cycle)
  const bits = bitsDe(mots.map((w) => w.v));
  const st = { s: 0, niveau: 0 }; embrouille(bits, st);
  const lv = embrouille(bits, st).niveaux;
  return { mots, runs, bits, lv, len: mots.length, perLine: lignes[0].length, n0 };
}

/** la vue */
export const VUE_SDI_TRAME = {
  id: 'sdi-trame', chapitre: 'sdi', titre: 'Le coaxial et la trame SDI',
  resume: 'Un coaxial 75 Ω ouvert en deux, et le flux SDI qui y passe : la ligne, les mots de synchro, la vidéo, le son embarqué, le numéro de ligne et le CRC, puis les bits.',
  lecons: ['sdi-cest-quoi', 'sdi-embedded', 'sdi-bits'],
  lectures: ['Sous la loupe', 'Zone', 'Valeur', 'Place dans la ligne', 'Liaison'],
  depart: 'La maquette est un coaxial 1694A agrandi environ 107 fois. Le flux est ralenti des centaines de millions de fois.',
  vue: { cible: [0.2, 1.1, 0], dir: [-0.1, 0.3, 1], dist: 11 },
  orbite: { rMin: 0.6, rMax: 18 },
  etapes: [
    { t: 'Un coaxial, coupé en deux', mode: 'ligne', lecon: 'sdi-cest-quoi', vue: { cible: [-4.9, 1.0, 0], dir: [-0.5, 0.32, 1], dist: 4.2 },
      texte: `Au bout, le câble est dénudé en escalier, comme pour sertir un BNC. De l'extérieur vers le centre :
- la **gaine** (PVC), qui protège ;
- la **tresse** de cuivre étamé et le **feuillard** d'aluminium : le **blindage**, relié à la masse ;
- le **diélectrique** en polyéthylène expansé, un isolant ;
- l'**âme** en cuivre (Ø 1 mm sur un 1694A).

L'**impédance de 75 Ω** ne dépend que du rapport des diamètres et de l'isolant : Z ≈ 138 / √εr × log(D / d) ≈ 73 à 75 Ω. Elle ne change pas avec la longueur. L'onde ne voyage pas « dans le cuivre » : elle est guidée **entre l'âme et la tresse**, dans le diélectrique. C'est là que la coupe montre le flux.` },
    { t: 'Une image, des lignes, des mots', mode: 'ligne', vue: { cible: [5.9, 1.3, 0], dir: [-0.16, 0.12, 1], dist: 5.4 },
      texte: `L'image est lue comme un livre : ligne après ligne, de gauche à droite. Le SDI ne transporte pas que l'image active : chaque ligne fait **2 640 mots** par flux en 1080 (dont 1 920 de vidéo active), et chaque image **1 125 lignes** (dont 1 080 actives).

Le reste est la **suppression** : horizontale (EAV, numéro de ligne, CRC, espace **HANC**, SAV, à gauche de l'image) et verticale (les lignes **VANC**, en haut et en bas). Elle vient de la télévision analogique, où le faisceau revenait en arrière ; le numérique l'a gardée et s'en sert pour transporter le **son**, le **timecode** et des **métadonnées**.

En 1080p50 : 2 640 × 1 125 × 50 = 148,5 millions de mots par seconde et par flux, deux flux (C et Y), 10 bits : **2,97 Gb/s**.` },
    { t: 'La ligne dans le câble', mode: 'ligne', cible: 'EAV', vue: { cible: [-1.0, 1.05, 0], dir: [-0.05, 0.22, 1], dist: 7.6 },
      texte: `La ligne file dans la coupe, de droite à gauche : le premier mot envoyé est devant, et les zones se lisent dans l'ordre, de gauche à droite :
- **EAV** (rouge) : fin de la vidéo active de la ligne ;
- **LN** et **CRC** (bleu clair) : numéro de ligne et contrôle ;
- l'espace **HANC** (gris), avec ses **paquets audio** (violet) au début ;
- **SAV** (vert) : début de la vidéo active ;
- la **vidéo active**, ici colorée comme l'image (la pelouse, ses bandes de tonte).

Une ligne de 1080p50 dure **17,8 µs** : à cette vitesse réelle, 56 250 lignes passent chaque seconde. La maquette la ralentit d'un facteur de l'ordre de 300 000.` },
    { t: 'EAV et SAV : les repères de synchro', mode: 'mots', cible: 'SAV', vue: { cible: [XL, 1.0, 0], dir: [-0.04, 0.2, 1], dist: 4.4 },
      texte: `Chaque repère est fait de quatre mots par flux : **3FF 000 000** puis le mot **XYZ**. Entrelacés C et Y, cela donne 3FF 3FF 000 000 000 000 XYZ XYZ.

Les valeurs **000 à 003** et **3FC à 3FF** sont **interdites** à l'image et au son : le récepteur qui voit passer 3FF 000 000 sait sans ambiguïté qu'un repère commence. C'est ainsi qu'il retrouve le début des mots dans un flux de bits sans séparation.

Le mot **XYZ** dit où l'on est : **H** = 1 pour l'EAV (fin de ligne), 0 pour le SAV ; **V** = 1 dans la suppression verticale ; **F** = trame paire ou impaire en entrelacé ; quatre bits de protection corrigent une erreur. Ici : SAV = **200**, EAV = **274** (ligne active) ; dans la suppression verticale, 2AC et 2D8.` },
    { t: 'La vidéo active : Cb Y Cr Y', mode: 'mots', cible: 'ACT', vue: { cible: [XL, 1.0, 0], dir: [-0.04, 0.2, 1], dist: 4.4 },
      texte: `Après le SAV, les échantillons de l'image, entrelacés : **Cb Y Cr Y Cb Y Cr Y**… Un Cb et un Cr pour deux Y : c'est le **4:2:2**. Le flux C (bleu) et le flux Y (jaune) alternent mot à mot.

Chaque mot est un code de **10 bits** : Y va de **64** (noir) à **940** (blanc) ; Cb et Cr tournent autour de **512** (pas de couleur). Survole la coupe, ou lis la loupe : la pelouse donne un Y vers 40 % et un Cb sous 512 (peu de bleu).` },
    { t: 'Le son dans la HANC : les paquets audio', mode: 'mots', cible: 'ANC', vue: { cible: [XL, 1.0, 0], dir: [-0.04, 0.2, 1], dist: 4.4 },
      texte: `Juste après le CRC, dans le flux C, l'embedder range les **paquets audio** (ST 299-1). Chaque paquet :
- **ADF** 000 3FF 3FF : « un paquet commence » ;
- **DID** : qui il est (E7h = audio du groupe 1, E6h groupe 2, E5h, E4h) ;
- **DBN** : son numéro, pour repérer un paquet perdu ;
- **DC** : combien de mots suivent (24) ;
- **UDW** : les données, un échantillon de 24 bits pour chacun des 4 canaux du groupe, l'horloge audio et un code correcteur ;
- **CS** : la somme de contrôle.

Quatre groupes de quatre canaux : **16 canaux**. À 48 kHz, il y a 48 000 échantillons par seconde pour 56 250 lignes en 1080p50 : la plupart des lignes portent un paquet par groupe, quelques-unes aucun.` },
    { t: 'Numéro de ligne et CRC', mode: 'mots', cible: 'LN', vue: { cible: [XL, 1.0, 0], dir: [-0.04, 0.2, 1], dist: 4.4 },
      texte: `Juste après l'EAV, deux mots **LN** donnent le **numéro de la ligne** (11 bits, de 1 à 1 125) : le récepteur sait où il en est sans attendre le haut de l'image.

Puis deux mots **CRC**, un contrôle de 18 bits calculé par l'émetteur sur la ligne qui vient de passer (vidéo active, EAV, numéro de ligne). Le récepteur refait le calcul : un écart, c'est une **ligne en erreur**. Le PRISM du car compte ces erreurs CRC bien avant qu'un défaut se voie à l'image : c'est l'alarme qui précède la falaise.` },
    { t: 'La VANC : entre les images', mode: 'ligne', vue: { cible: [6.1, 1.95, 0], dir: [-0.1, 0.08, 1], dist: 3.4 },
      texte: `Les lignes de **suppression verticale** (en 1080p50 : lignes 1 à 41 et 1 122 à 1 125) n'ont pas d'image : leur espace **VANC** transporte des paquets de données :
- le **timecode** (ATC, ST 12-2), lu par les serveurs ralenti ;
- l'**AFD** (format de l'image : 16/9, 4/3…) ;
- les **sous-titres** et le télétexte (OP-47) ;
- les métadonnées audio (ST 2020).

L'identifiant du format, le **VPID** (ST 352 : « 1080p50, 4:2:2, 10 bits »), est un paquet de la HANC de la ligne 10. Un **désembeddeur** ressort le son, un analyseur lit tous ces paquets.` },
    { t: 'Du mot au bit : ce qui passe vraiment', mode: 'bits', cible: 'SAV', lecon: 'sdi-bits', vue: { cible: [XL + 0.2, 1.4, 0], dir: [-0.04, 0.2, 1], dist: 5.6 },
      texte: `Chaque mot part **bit de poids faible d'abord** : 3FF donne dix 1, 000 dix 0. Dans la coupe, les petits blocs sont les bits des mots (haut = 1, bas = 0).

Mais ce ne sont pas eux qu'on mesure sur le câble : le flux est **embrouillé** (x⁹ + x⁴ + 1) puis codé en **NRZI** (un 1 fait basculer le niveau, un 0 le garde). La trace cyan au-dessus du câble est le **signal réel**, entre −400 et +400 mV (800 mV crête à crête).

Pourquoi ? Il n'y a **pas de fil d'horloge** : le récepteur reconstitue l'horloge à partir des transitions du signal. Sans embrouillage, une image noire ou un 3FF 000 000 donneraient de longs paliers sans transition, et l'horloge se perdrait.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { fk: '1080p50', mode: 'ligne', off: 0, goal: /** @type {number | null} */ (null), hold: 0, cyc: cycle('1080p50') };

    // ---------------- le câble ----------------
    const P1 = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), P2 = new THREE.Plane(new THREE.Vector3(-1, 0, 0), CUT[0]), P3 = new THREE.Plane(new THREE.Vector3(1, 0, 0), -CUT[1]);
    const clip = (m) => { m.clippingPlanes = [P1, P2, P3]; m.clipIntersection = true; m.side = THREE.DoubleSide; return m; };
    const M = {
      gaine: clip(mat('plastique', 0x232a31, { roughness: 0.55 })), tresse: clip(mat('alu', 0xb4b9be, { metalness: 0.85, roughness: 0.38 })),
      feuillard: clip(mat('alu', 0xdfe3e6, { metalness: 0.95, roughness: 0.2 })), dielec: clip(mat('plastique', 0xeceee8, { roughness: 0.7 })),
      ame: clip(mat('alu', COUL.cuivre, { metalness: 1, roughness: 0.28 })),
    };
    const layer = (name, r, x0, x1, m, info) => {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, 64, 1, false), m);
      g.rotation.z = -Math.PI / 2; g.position.set((x0 + x1) / 2, Y0, 0); g.name = name; g.userData.info = info; root.add(g); return g;
    };
    const I = {
      gaine: { nom: 'Gaine', texte: 'PVC (ou polyéthylène pour l\'extérieur) : protège le câble. Sa couleur repère souvent l\'usage (vidéo, référence…). Ø 6,9 mm sur un 1694A.' },
      tresse: { nom: 'Tresse de cuivre étamé', texte: 'Le blindage extérieur, relié à la masse par le corps du BNC : avec le feuillard, il garde l\'onde à l\'intérieur et les parasites à l\'extérieur (≈ 95 % de couverture).' },
      feuillard: { nom: 'Feuillard (aluminium)', texte: 'Un ruban d\'aluminium sous la tresse : il ferme les trous de la tresse aux fréquences élevées. Blindage total supérieur à 100 dB.' },
      dielec: { nom: 'Diélectrique', texte: 'Polyéthylène expansé (mousse, εr ≈ 1,5) : il tient l\'âme exactement au centre. Son diamètre (4,57 mm) et celui de l\'âme fixent l\'impédance : 75 Ω. C\'est dans cet isolant que l\'onde voyage, à environ 83 % de la vitesse de la lumière.' },
      ame: { nom: 'Âme', texte: 'Cuivre massif, Ø 1,02 mm (18 AWG) sur un 1694A. L\'affaiblissement aux hautes fréquences vient surtout de l\'effet de peau : le courant ne circule qu\'en surface de l\'âme.' },
    };
    layer('gaine', RJ, XEND, S0, M.gaine, I.gaine);
    layer('tresse', RB, XEND - 0.38, S0, M.tresse, I.tresse);
    layer('feuillard', RF, XEND - 0.58, S0, M.feuillard, I.feuillard);
    layer('diélectrique', RD, XEND - 0.95, S0, M.dielec, I.dielec);
    layer('âme', RC, XEND - 1.35, S0, M.ame, I.ame);
    // la coupe : chaque couche montre sa tranche dans le plan z = 0
    const sec = (r0, r1, m, info, z = 0) => {
      for (const s of r0 === 0 ? [0] : [1, -1]) {
        const h = r0 === 0 ? r1 * 2 : r1 - r0;
        const q = new THREE.Mesh(new THREE.PlaneGeometry(CUT[1] - CUT[0], h), m);
        q.position.set((CUT[0] + CUT[1]) / 2, Y0 + (r0 === 0 ? 0 : s * (r0 + h / 2)), z); q.userData.info = info; root.add(q);
      }
    };
    const flat = (k, c, o = {}) => mat(k, c, { polygonOffset: 1, ...o });
    sec(RB, RJ, flat('plastique', 0x232a31), I.gaine);
    sec(RF, RB, flat('alu', 0xb4b9be, { metalness: 0.8 }), I.tresse);
    sec(RD, RF, flat('alu', 0xdfe3e6, { metalness: 0.9 }), I.feuillard);
    sec(RC, RD, flat('plastique', 0xc9cec6, { roughness: 0.9 }), I.dielec);
    sec(0, RC, flat('alu', COUL.cuivre, { metalness: 0.45, roughness: 0.35, emissive: 0x3a1e0a }), I.ame, 0.006);

    // le sérialiseur (la sortie de l'appareil) et l'image source
    const box = piece('sérialiseur', 'plastique', (b) => {
      b.cbox(0.62, 0.62, 0.72, S0 + 0.32, Y0, 0, 0x2a3138, 0.04);
      b.cbox(0.66, 0.08, 0.76, S0 + 0.32, Y0 - 0.33, 0, 0x1b2024, 0.02);
      b.cyl(0.13, 0.13, 0.1, S0 - 0.02, Y0, 0, 0xb8bec4, 24, 0, Math.PI / 2);
    });
    box.userData.info = { nom: 'Sortie SDI (sérialiseur)', texte: 'L\'appareil range les mots (EAV, LN, CRC, paquets, SAV, vidéo) puis les envoie bit après bit : sérialisation, embrouillage, NRZI, à 800 mV crête à crête sur 75 Ω.' };
    root.add(box);
    const lb = texte('SORTIE SDI', { h: 0.08 }); lb.position.set(S0 + 0.32, Y0 + 0.2, 0.362); root.add(lb);
    const frame = ecran(3.2, 1.9, 1024, (g, W, H) => drawFrame(g, W, H, S.fk));
    frame.mesh.position.set(6.1, 1.32, -0.25); frame.mesh.userData.info = { nom: 'L\'image et sa suppression', texte: 'À l\'échelle : la vidéo active (1 920 × 1 080) entourée de la suppression horizontale (à gauche : EAV, LN, CRC, HANC, SAV) et verticale (VANC, en haut et en bas). Chaque ligne, suppression comprise, passe dans le câble.' };
    root.add(frame.mesh);
    const stand = piece('cadre', 'laque', (b) => { b.cbox(3.32, 2.02, 0.08, 6.1, 1.32, -0.3, 0x1c2126, 0.02); b.cbox(0.12, 0.3, 0.12, 6.1, 0.15, -0.3, 0x1c2126, 0.02); b.cbox(1.2, 0.04, 0.5, 6.1, 0.02, -0.3, 0x1c2126, 0.02); });
    root.add(stand);
    const ft = texte('Une image 1080p50, telle que le SDI la transporte', { h: 0.11 }); ft.position.set(6.1, 2.42, -0.25); root.add(ft);
    // la ligne en cours, sur l'image : une barre lumineuse, et la flèche du balayage
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.014), lum(0xffffff, 1.2, { transparent: true, opacity: 0.85 }));
    scan.position.set(6.1, 1.32, -0.24); root.add(scan);

    // la loupe : un anneau autour du câble
    const loupe = new THREE.Mesh(new THREE.TorusGeometry(RJ + 0.07, 0.016, 10, 64), lum(COUL.ambre, 1.1));
    loupe.rotation.y = Math.PI / 2; loupe.position.set(XL, Y0, 0); loupe.userData.info = { nom: 'La loupe', texte: 'Le mot qui passe sous l\'anneau est décrit dans le panneau (Sous la loupe, Zone, Valeur).' };
    root.add(loupe);

    // ---------------- le flux dans la coupe ----------------
    const MAX = 900;
    const train = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), eclat(0xffffff, 0.94), MAX);
    train.instanceMatrix.setUsage(THREE.DynamicDrawUsage); train.frustumCulled = false; train.count = 0; train.name = 'flux';
    train.setColorAt(0, new THREE.Color()); root.add(train);
    /** @type {any[]} */ let shown = [];
    train.userData.instInfo = (i) => { const s = shown[i]; return s ? s.info() : null; };
    // la trace du signal (mode bit à bit)
    const TY = Y0 + RJ + 0.42, TA = 0.16;
    const tracePos = new Float32Array(1200 * 3);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tracePos, 3)); tg.setDrawRange(0, 0);
    const trace = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: COUL.cyan })); trace.frustumCulled = false; root.add(trace);
    const axis = new THREE.Group(); root.add(axis);
    for (const [y, t] of [[TY + TA, '+400 mV'], [TY - TA, '−400 mV']]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(CUT[1] - CUT[0], 0.006), new THREE.MeshBasicMaterial({ color: 0x3a4650 })); l.position.set((CUT[0] + CUT[1]) / 2, y, -0.01); axis.add(l);
      const tx = texte(t, { h: 0.07, mono: true, color: '#8fd6ea' }); tx.position.set(CUT[0] - 0.32, y, 0); axis.add(tx);
    }
    const tTitle = texte('Signal sur le câble : embrouillé, NRZI', { h: 0.08, color: '#8fd6ea' }); tTitle.position.set((CUT[0] + CUT[1]) / 2, TY + TA + 0.14, 0); axis.add(tTitle);
    // étiquettes : les couches au bout du câble, les mots dans la coupe
    ctx.label(new THREE.Vector3(XEND + 0.2, Y0 + RJ, 0), 'gaine', { off: [0, 0.12, 0] });
    ctx.label(new THREE.Vector3(XEND - 0.2, Y0 + RB, 0), 'tresse', { off: [0, 0.12, 0] });
    ctx.label(new THREE.Vector3(XEND - 0.48, Y0 - RF, 0), 'feuillard', { off: [0, -0.14, 0] });
    ctx.label(new THREE.Vector3(XEND - 0.78, Y0 + RD, 0), 'diélectrique', { off: [0, 0.1, 0] });
    ctx.label(new THREE.Vector3(XEND - 1.25, Y0 + RC, 0), 'âme', { off: [0, 0.12, 0] });
    ctx.label(loupe, 'loupe', { off: [0, RJ + 0.2, 0], cls: 'hot' });
    const wordTags = [];
    for (let i = 0; i < 40; i++) { const v = new THREE.Vector3(); const L = ctx.label(v, '', { cls: 'word' }); L.v = v; L.show(false); wordTags.push(L); }

    // ---------------- position du flux ----------------
    const u = () => (S.mode === 'ligne' ? MODES.ligne.u / S.cyc.perLine : S.mode === 'mots' ? MODES.mots.u : MODES.bits.u * 10);
    const rate = () => (S.mode === 'ligne' ? MODES.ligne.vit * S.cyc.perLine : S.mode === 'mots' ? MODES.mots.vit : MODES.bits.vit / 10);
    const wrap = (k) => ((k % S.cyc.len) + S.cyc.len) % S.cyc.len;
    /** le mot (rang dans le flux) sous la loupe */
    const underLoupe = () => Math.floor(S.off - (S0 - XL) / u());
    function goTo(z) {
      const k0 = underLoupe();
      for (let d = 1; d <= S.cyc.len; d++) {
        const w = S.cyc.mots[wrap(k0 + d)], wp = S.cyc.mots[wrap(k0 + d - 1)];
        if (w.z === z && wp.z !== z) {
          S.goal = k0 + d + (S0 - XL) / u() + 0.5;
          // loin : on saute, puis les derniers mots arrivent doucement sous la loupe
          if (S.goal - S.off > 4) S.off = S.goal - 4;
          return;
        }
      }
    }
    const zoneTxt = (w) => (w.z === 'ACT' ? `vidéo active (flux ${w.f})` : w.z === 'ANC' ? 'paquet audio (flux C)' : w.z === 'HANC' ? `HANC, remplissage du flux ${w.f}` : `${ZONES[w.z].nom} (flux ${w.f})`);
    const infoOf = (k) => () => {
      const w = S.cyc.mots[wrap(k)];
      return { nom: `${hex3(w.v)} · ${zoneTxt(w)}`, texte: `${w.d}. En binaire (b9 à b0) : ${w.v.toString(2).padStart(10, '0')}.` };
    };
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Pv = new THREE.Vector3(), Sv = new THREE.Vector3(), C = new THREE.Color();
    function place() {
      const U = u(); const kHi = Math.ceil(S.off) + 1, kLo = Math.floor(S.off - SEND / U) - 1;
      let n = 0; shown = [];
      // un bloc entre les distances s0 et s1 du sérialiseur (rabattu sur le câble)
      const put = (s0, s1, y, h, col, info, z = 0.003) => {
        s0 = Math.max(s0, 0); s1 = Math.min(s1, SEND - 0.05); if (s1 <= s0 || n >= MAX) return;
        Pv.set(xOfS((s0 + s1) / 2), y, z); Sv.set(s1 - s0, h, 0.004); M4.compose(Pv, Q, Sv);
        train.setMatrixAt(n, M4); train.setColorAt(n, C.set(col)); shown[n] = { info }; n++;
      };
      const sOf = (k) => (S.off - k) * U; // avant du mot k (il est parti avant les suivants)
      if (S.mode === 'ligne') {
        const L = S.cyc.len;
        for (let c = Math.floor(kLo / L) - 1; c <= Math.floor(kHi / L) + 1; c++) {
          for (const r of S.cyc.runs) {
            const k0 = c * L + r.k0, k1 = k0 + r.n; if (k1 < kLo || k0 > kHi) continue;
            const info = () => ({ nom: r.z === 'ACT' ? 'Vidéo active (Cb Y Cr Y…)' : r.z === 'ANC' ? 'Paquet audio (ST 299-1)' : ZONES[r.z].nom, texte: `${ZONES[r.z].long}, ligne ${r.ligne} : ${r.n} mots (${Math.round(r.n / 2)} par flux). Passe en « Mot à mot » pour lire les valeurs.` });
            // les zones de quelques mots (EAV, LN, CRC, SAV) seraient invisibles à cette échelle : élargies à 6 cm, un peu plus hautes
            const a = sOf(k1), b = sOf(k0), mid = (a + b) / 2, w = r.z === 'ACT' || r.n > 60 ? b - a - U * 1.5 * (r.z === 'ACT' ? 0 : 1) : Math.max(0.06, b - a);
            put(mid - w / 2, mid + w / 2, Y0, RD * (r.n > 60 ? 1.86 : 1.98), r.col, info, r.n > 60 ? 0.003 : 0.0045);
          }
        }
      } else {
        for (let k = kLo; k <= kHi; k++) {
          const w = S.cyc.mots[wrap(k)], sf = sOf(k);
          if (S.mode === 'mots') put(sf - U * 0.93, sf - U * 0.07, Y0, RD * 1.86, colOf(w), infoOf(k));
          else {
            // bit à bit : dix blocs par mot, hauts pour un 1, bas pour un 0 ; le bit de poids faible part le premier (devant)
            const ub = U / 10;
            for (let b = 0; b < 10; b++) { const bit = (w.v >> b) & 1; const s1 = sf - b * ub; put(s1 - ub * 0.88, s1 - ub * 0.12, Y0 - RD * 0.93 + (bit ? RD * 0.93 : RD * 0.3), bit ? RD * 1.86 : RD * 0.6, colOf(w), infoOf(k)); }
          }
        }
      }
      train.count = n; train.instanceMatrix.needsUpdate = true; if (train.instanceColor) train.instanceColor.needsUpdate = true;
      // étiquettes des mots dans la fenêtre de coupe
      let t = 0;
      if (S.mode !== 'ligne') for (let k = kLo; k <= kHi && t < wordTags.length; k++) {
        const xm = xOfS(sOf(k) - U / 2); if (xm < CUT[0] + 0.05 || xm > CUT[1] - 0.05) continue;
        const w = S.cyc.mots[wrap(k)], L = wordTags[t++];
        L.v.set(xm, Y0 + (S.mode === 'bits' ? RD + 0.12 : 0), 0.02); L.set(S.mode === 'bits' ? `${w.f} ${hex3(w.v)}` : hex3(w.v)); L.show(true);
      }
      for (; t < wordTags.length; t++) wordTags[t].show(false);
      // la trace du signal : un palier par bit, NRZI embrouillé
      if (S.mode === 'bits') {
        const ub = U / 10; let p = 0; const nb = S.cyc.bits.length;
        const bLo = Math.floor(S.off * 10 - (S0 - CUT[0]) / ub) - 1, bHi = Math.ceil(S.off * 10 - (S0 - CUT[1]) / ub) + 1;
        for (let b = bLo; b <= bHi && p < 1196; b++) {
          const lv = S.cyc.lv[((b % nb) + nb) % nb];
          const sf = (S.off * 10 - b) * ub; // avant du bit b
          let x0 = xOfS(sf), x1 = x0 + ub;
          x0 = Math.max(x0, CUT[0]); x1 = Math.min(x1, CUT[1]); if (x1 <= x0) continue;
          const y = TY + (lv ? TA : -TA);
          tracePos.set([x0, y, 0, x1, y, 0], p * 3); p += 2;
        }
        tg.setDrawRange(0, p); tg.attributes.position.needsUpdate = true;
      }
      trace.visible = axis.visible = S.mode === 'bits';
      // la loupe
      const k = underLoupe(), w = S.cyc.mots[wrap(k)];
      const T = TRAMES[S.fk], inLine = wrap(k) % S.cyc.perLine;
      ctx.read('Sous la loupe', `mot ${Math.floor(inLine / 2) + 1} du flux ${w.f}`);
      ctx.read('Zone', zoneTxt(w));
      ctx.read('Valeur', `${hex3(w.v)}h = ${w.v} = ${w.v.toString(2).padStart(10, '0')}b`);
      ctx.read('Place dans la ligne', `${(Math.floor(inLine / 2) / freqMots(T)).toFixed(2).replace('.', ',')} µs après l'EAV · ${w.d}`);
      ctx.read('Liaison', `${T.liaison} ${String(T.gbps).replace('.', ',')} Gb/s (${T.norme}) · ${T.nom}`);
      // la ligne en cours sur l'image source
      const li = S.cyc.n0 + Math.floor(wrap(k) / S.cyc.perLine);
      scan.position.y = 1.32 + 0.95 - (li / T.lignes) * 1.9;
    }
    function setMode(m) {
      if (m === S.mode) return;
      const k = underLoupe();
      S.mode = m; S.goal = null;
      S.off = k + (S0 - XL) / u() + 0.5;
      ctx.say(m === 'ligne' ? 'Ligne entière : une ligne mesure ici 5,4 m.' : m === 'mots' ? 'Mot à mot : chaque bloc est un mot de 10 bits, sa valeur est écrite dessus.' : 'Bit à bit : dix bits par mot, le bit de poids faible sort le premier. La trace cyan est le signal réel.');
      if (segMode) for (const b of segMode.querySelectorAll('button')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.v === m));
    }
    function setFmt(fk) {
      S.fk = fk; S.cyc = cycle(fk); S.off = 0; S.goal = null; frame.redraw();
      ctx.say(`${TRAMES[fk].nom} en ${TRAMES[fk].liaison} : ${TRAMES[fk].tot} mots par ligne et par flux, ${TRAMES[fk].lignes} lignes.`);
    }
    /** @type {HTMLElement | null} */ let segMode = null;
    S.off = 300;
    place();
    return {
      etape(i, E) {
        setMode(E.mode || 'ligne');
        if (E.cible) goTo(E.cible);
      },
      update(dt) {
        if (S.goal != null) {
          const d = S.goal - S.off; const step = Math.sign(d) * Math.min(Math.abs(d), Math.max(Math.abs(d) * 4 * dt, (S.mode === 'ligne' ? rate() * 4 : 6) * dt));
          // arrivé : le mot visé reste quatre secondes sous la loupe, le temps de le lire
          S.off += step; if (Math.abs(S.goal - S.off) < 1e-3) { S.off = S.goal; S.goal = null; S.hold = 4; }
        } else if (S.hold > 0) S.hold -= dt;
        else S.off += rate() * dt;
        if (S.off > 1e7) S.off -= S.cyc.len * Math.floor(S.off / S.cyc.len);
        place();
      },
      commandes() {
        segMode = /** @type {HTMLElement} */ (choice('Échelle', Object.entries(MODES).map(([k, m]) => [k, m.nom]), S.mode, (v) => setMode(v)));
        const fmt = choice('Format', Object.keys(TRAMES).map((k) => [k, `${k} (${TRAMES[k].liaison})`]), S.fk, (v) => setFmt(v));
        const go = (z, label) => el('button', { type: 'button', class: 'btn small', onclick: () => { if (S.mode === 'ligne') setMode('mots'); goTo(z); ctx.say(`${label} sous la loupe.`); } }, label);
        return el('div', { class: 'v3-ctl' }, segMode, fmt,
          el('div', { class: 'v3-go' }, el('span', {}, 'Amener sous la loupe :'), go('EAV', 'EAV'), go('LN', 'LN et CRC'), go('ANC', 'paquet audio'), go('SAV', 'SAV'), go('ACT', 'vidéo')));
      },
    };
  },
};

/** l'image source et sa suppression, à l'échelle de la trame */
function drawFrame(g, W, H, fk) {
  const T = TRAMES[fk];
  const hb = (T.tot - T.act) / T.tot, vb0 = (fk === '720p50' ? 25 : fk === '1080i25' ? 20 : 41) / T.lignes, vb1 = (T.lignes - T.actives) / T.lignes - vb0;
  g.fillStyle = hex(0x2a3038); g.fillRect(0, 0, W, H);
  // la vidéo active : le stade de l'image du cours
  const x0 = W * hb, y0 = H * vb0, aw = W - x0, ah = H * (1 - vb0 - vb1);
  const img = g.createImageData(Math.ceil(aw), Math.ceil(ah));
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const [r, gg, b] = imageRGB(x / img.width, y / img.height); const i = (y * img.width + x) * 4;
    img.data[i] = Math.min(255, r * 255); img.data[i + 1] = Math.min(255, gg * 255); img.data[i + 2] = Math.min(255, b * 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, Math.round(x0), Math.round(y0));
  // la suppression horizontale : EAV, LN, CRC, HANC (son au début), SAV
  const col = (c) => hex(c);
  const band = (a, b, c) => { g.fillStyle = col(c); g.fillRect(W * a, y0, W * (b - a), ah); };
  const wv = (n) => n / T.tot;
  band(0, wv(4), COUL.eav); band(wv(4), wv(8), COUL.ln); band(wv(8), wv(132), COUL.audio); band(wv(132), hb - wv(4), 0x4b545d); band(hb - wv(4), hb, COUL.sav);
  // la suppression verticale (VANC)
  g.fillStyle = col(COUL.vanc); g.fillRect(0, 0, W, y0); g.fillRect(0, H - H * vb1, W, H * vb1);
  g.fillStyle = '#0b1013'; g.font = `600 ${Math.round(H * 0.045)}px "Archivo Narrow", sans-serif`; g.textAlign = 'center';
  g.fillStyle = '#e8ece6';
  g.fillText('HANC', W * hb / 2, H * 0.52);
  g.font = `600 ${Math.round(H * 0.03)}px "Archivo Narrow", sans-serif`;
  g.fillText('(son au début)', W * hb / 2, H * 0.57);
  g.fillText(`EAV · LN · CRC … SAV : ${T.tot - T.act} mots`, W * hb / 2, H * 0.92);
  g.fillText(`VANC : ${T.vanc}`, W * 0.62, Math.max(H * 0.03, y0 * 0.8));
  g.font = `700 ${Math.round(H * 0.05)}px "Archivo Narrow", sans-serif`;
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x0 + aw * 0.2, y0 + ah * 0.06, aw * 0.6, H * 0.075);
  g.fillStyle = '#ffd38a'; g.fillText(`vidéo active ${T.act} × ${T.actives}`, x0 + aw / 2, y0 + ah * 0.06 + H * 0.055);
  // le sens du balayage
  g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + aw * 0.08, y0 + ah * 0.93); g.lineTo(x0 + aw * 0.3, y0 + ah * 0.93); g.stroke();
  g.beginPath(); g.moveTo(x0 + aw * 0.3, y0 + ah * 0.93); g.lineTo(x0 + aw * 0.28, y0 + ah * 0.9); g.lineTo(x0 + aw * 0.28, y0 + ah * 0.96); g.closePath(); g.fillStyle = '#fff'; g.fill();
  g.font = `600 ${Math.round(H * 0.032)}px "Archivo Narrow", sans-serif`; g.textAlign = 'left'; g.fillText('lecture : ligne par ligne, de gauche à droite', x0 + aw * 0.32, y0 + ah * 0.94);
}
