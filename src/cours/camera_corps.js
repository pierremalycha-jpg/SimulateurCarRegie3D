// @ts-check
import { el } from '../util.js';
import { canvas, slider, choice, readout } from './kit.js';
import { CONSO, autonomie, courantDC, DC_IN, PORTEE, signalDe, zebra, tallyDe, margeSecurite } from './camera_calc.js';
import { quizDe, competencesDe, figNotions, COUL, fond, ecrire, nf } from './camera_kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « La caméra », partie « Le corps, le viseur et le cadreur » : le corps (ses commandes, son menu, sa
// connectique, son alimentation), puis le viseur et ses aides, le tally, le call, l'intercom et les retours, le
// poste du cadreur. Notions du module « La caméra en 3D » (champ camlab) ; chiffres du mode d'emploi et de la
// fiche HXC-FB80 (≈ 19 W pour le corps, ≈ 32 W avec le viseur, DC IN 10,5 à 17 V et 5,4 A, DC OUT 1,5 A, 600 m de
// câble hybride ; zébras à 70 et 100 %, zones de sécurité 80 à 95 %), calculs de cours/camera_calc.js.
// ----------------------------------------------------------------------------------
const PARTIE = 'Le corps, le viseur et le cadreur';

// ======================================================================================
// 1. Le corps : qui a la main, et le budget d'énergie
// ======================================================================================
/** les commandes du corps et ce qu'elles deviennent quand la caméra est reliée à une CCU (mode d'emploi HXC-FB80) */
const COMMANDES = [
  ['FILTER (roue des ND)', 'rcp'], ['GAIN L / M / H', 'rcp'], ['SHUTTER', 'rcp'], ['WHITE BAL et WHT/BLK (balances)', 'rcp'], ['OUTPUT/AUTO KNEE (barres, knee)', 'rcp'],
  ['Menu PAINT (gamma, knee, détail, matrice)', 'rcp'], ['ASSIGN 1 à 3, menu OPERATION (viseur)', 'cadreur'], ['Zoom, point, cadre', 'cadreur'], ['CALL, intercom PROD / ENG', 'cadreur'],
];
const BATTERIES = { b95: [95, '95 Wh'], b150: [150, '150 Wh'], b190: [190, '190 Wh'] };
function demoCorps(host) {
  const tbl = el('table', { class: 'cc-tab', 'aria-label': 'Qui commande chaque réglage' });
  let relie = true, vf = true, obj = true, dcout = 0, alim = 'ccu', L = 400, bat = 'b95';
  const read = readout(['Puissance de la tête', 'Alimentation', 'Courant sur DC IN (à 12 V)', 'Autonomie']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    tbl.replaceChildren(el('tr', {}, el('th', {}, 'Commande'), el('th', {}, relie ? 'Caméra reliée à la CCU' : 'Caméra seule')),
      ...COMMANDES.map(([nom, qui]) => el('tr', {}, el('td', {}, nom), el('td', { class: relie && qui === 'rcp' ? 'off' : 'on' }, relie ? (qui === 'rcp' ? 'commandée par le RCP de la vision : le commutateur du corps ne fait plus rien' : 'le cadreur, sur la caméra') : 'sur la caméra'))));
    const acc = dcout * 12, P = CONSO.corps + (vf ? CONSO.viseur : 0) + (obj ? CONSO.objectif : 0) + acc;
    read.set('Puissance de la tête', `${nf(P)} W : corps ${CONSO.corps} W${vf ? `, viseur 7" ${CONSO.viseur} W` : ''}${obj ? `, servo de l'objectif ≈ ${CONSO.objectif} W` : ''}${acc ? `, accessoire ${nf(acc)} W (${nf(dcout, 1)} A sur DC OUT)` : ''}`);
    let v;
    if (alim === 'ccu') {
      const ok = L <= PORTEE.hybride;
      read.set('Alimentation', ok ? `par la CCU, dans le cuivre du câble hybride : ${nf(L)} m sur ${PORTEE.hybride} possibles` : `${nf(L)} m : au-delà de ${PORTEE.hybride} m, la chute de tension dans le cuivre empêche la CCU d'alimenter la tête`);
      read.set('Courant sur DC IN (à 12 V)', 'rien : la prise reste libre');
      read.set('Autonomie', 'illimitée : la CCU est sur le secteur');
      v = ok ? ['ok', 'Le cas normal : la CCU télé-alimente la tête par le câble hybride, il n\'y a rien d\'autre à brancher.'] : ['ko', `Câble trop long pour l'énergie : passez en fibre monomode (jusqu'à 10 km) et alimentez la caméra sur place par DC IN.`];
    } else {
      const I = courantDC(P), E = BATTERIES[bat][0], h = autonomie(E, P);
      read.set('Alimentation', alim === 'mono' ? 'fibre monomode seule (jusqu\'à 10 km) : la lumière passe, pas l\'énergie : la caméra s\'alimente sur place' : 'caméra seule, sans CCU');
      read.set('Courant sur DC IN (à 12 V)', `${nf(I, 2)} A (la prise en accepte ${nf(DC_IN.A, 1)} A, entre ${nf(DC_IN.min, 1)} et ${DC_IN.max} V)`);
      read.set('Autonomie', `${BATTERIES[bat][1]} ÷ ${nf(P)} W ≈ ${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}, un peu moins en vrai (pertes)`);
      v = I > DC_IN.A ? ['ko', 'Trop de courant pour la prise DC IN : retirez un accessoire.'] : h < 1.5 ? ['warn', 'Moins d\'une heure et demie : chaque accessoire raccourcit l\'autonomie. Prévoyez des batteries de rechange ou un bloc secteur.'] : ['ok', 'Batterie ou bloc secteur sur DC IN (XLR 4 broches) : la caméra n\'a besoin de la CCU que pour l\'image, les retours et les commandes.'];
    }
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' }, choice('La caméra', [['ccu', 'reliée à sa CCU'], ['seule', 'seule (enregistreur, petit plateau)']], 'ccu', (v) => { relie = v === 'ccu'; draw(); })),
    el('div', { class: 'co-scroll' }, tbl),
    el('div', { class: 'co-ctl' },
      choice('Viseur 7"', [['1', 'branché'], ['0', 'retiré']], '1', (v) => { vf = v === '1'; draw(); }),
      choice('Objectif à servo', [['1', 'oui'], ['0', 'non']], '1', (v) => { obj = v === '1'; draw(); }),
      slider('Accessoire sur DC OUT', 0, 1.5, dcout, 0.1, (v) => { dcout = v; draw(); }, (v) => nf(v, 1) + ' A')),
    el('div', { class: 'co-ctl' },
      choice('Énergie de la tête', [['ccu', 'par la CCU'], ['mono', 'fibre monomode + DC IN'], ['seule', 'batterie, sans CCU']], alim, (v) => { alim = v; draw(); }),
      slider('Longueur du câble hybride', 50, 1000, L, 10, (v) => { L = v; draw(); }, (v) => nf(v) + ' m'),
      choice('Batterie', Object.entries(BATTERIES).map(([k, b]) => [k, String(b[1])]), bat, (v) => { bat = v; draw(); })),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 2. Le viseur : zébras, zone de sécurité, tally
// ======================================================================================
/** les zones de l'image du stade : lumière relative au blanc nominal et couleur d'affichage */
const ZONES = [['tribune à l\'ombre', 0.05, '#3a4048'], ['pelouse', 0.2, '#2f6b23'], ['visage', 0.45, '#c99a7a'], ['maillot blanc', 0.9, '#e8ece6'], ['ciel', 1.7, '#b8d4f0']];
function demoViseur(host) {
  const cv = canvas(720, 240, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let iris = 0, z1 = 70, sur = 90, pgm = 1, pvw = 2, vert = true;
  const read = readout(['Niveaux à la forme d\'onde', 'ZEBRA1 (70 % ± 5)', 'ZEBRA2 (100 %)', 'Zone de sécurité']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    fond(g, 720, 240);
    const lv = ZONES.map(([, L]) => signalDe(/** @type {number} */ (L) * Math.pow(2, iris), { knee: 0.95, slope: 0.1 }));
    // l'image du viseur, en bandes, avec les hachures des zébras
    const X = 20, Y = 30, W = 400, H = 180, bw = W / ZONES.length;
    ZONES.forEach(([nom, , col], i) => {
      const x = X + i * bw; g.fillStyle = /** @type {string} */ (col); g.globalAlpha = Math.max(0.25, Math.min(1, lv[i] / 100)); g.fillRect(x, Y, bw, H); g.globalAlpha = 1;
      const h1 = zebra(lv[i], z1), h2 = lv[i] >= 100;
      if (h1 || h2) {
        g.save(); g.beginPath(); g.rect(x, Y, bw, H); g.clip(); g.strokeStyle = h2 ? 'rgba(255,255,255,.9)' : 'rgba(10,10,10,.75)'; g.lineWidth = 3;
        for (let k = -H; k < bw + H; k += 12) { g.beginPath(); g.moveTo(x + k, Y + (h2 ? H : 0)); g.lineTo(x + k + H, Y + (h2 ? 0 : H)); g.stroke(); }
        g.restore();
      }
      ecrire(g, String(nom), x + bw / 2, Y + H + 14, { align: 'center' }); g.fillStyle = 'rgba(8,11,14,.78)'; g.fillRect(x + bw / 2 - 24, Y + H - 24, 48, 20); ecrire(g, nf(lv[i], 0) + ' %', x + bw / 2, Y + H - 9, { align: 'center', col: COUL.blanc, font: '600 12px Arial, sans-serif' });
    });
    // la zone de sécurité
    const m = margeSecurite(sur) / 1920 * W, mv = (1080 * (1 - sur / 100) / 2) / 1080 * H;
    g.strokeStyle = COUL.amber; g.setLineDash([5, 4]); g.strokeRect(X + m, Y + mv, W - 2 * m, H - 2 * mv); g.setLineDash([]);
    ecrire(g, 'le viseur (rien de ces aides ne part au car)', X, 18);
    // quatre caméras et leur tally
    for (let c = 1; c <= 4; c++) {
      const t = tallyDe(c, pgm, vert ? pvw : 0), x = 450 + (c - 1) * 66;
      g.fillStyle = '#2c3035'; g.fillRect(x, 70, 52, 34); g.fillStyle = '#17181a'; g.fillRect(x + 36, 78, 22, 18);
      g.fillStyle = t === 'rouge' ? COUL.tally : t === 'vert' ? COUL.pvw : '#3a2020'; g.beginPath(); g.arc(x + 14, 62, 7, 0, Math.PI * 2); g.fill();
      ecrire(g, 'CAM ' + c, x + 26, 122, { align: 'center', col: COUL.blanc }); ecrire(g, t, x + 26, 138, { align: 'center' });
    }
    ecrire(g, 'les lampes de tally (dessus du viseur)', 450, 40);
    read.set('Niveaux à la forme d\'onde', ZONES.map(([n], i) => `${n} ${nf(lv[i], 0)} %`).join(' · '));
    read.set('ZEBRA1 (70 % ± 5)', ZONES.filter((_, i) => zebra(lv[i], z1)).map(([n]) => n).join(', ') || 'aucune zone hachurée');
    read.set('ZEBRA2 (100 %)', ZONES.filter((_, i) => lv[i] >= 100).map(([n]) => n).join(', ') || 'rien n\'atteint 100 %');
    read.set('Zone de sécurité', `${nf(sur, 1)} % de l'image : ${nf(margeSecurite(sur), 0)} pixels de marge de chaque côté sur 1 920`);
    const vis = lv[2];
    const v = vis >= 60 && vis <= 70 ? ['ok', 'Le visage tombe dans le zébra 1 : il est exposé vers 60 à 70 %. Le zébra 2 montre ce qui écrête à 100 %.'] : vis > 70 ? ['warn', 'Le visage dépasse 70 % : il est surexposé. Fermez un peu l\'iris (au stade, c\'est la vision qui le fait, à la forme d\'onde).'] : ['warn', 'Le visage est sous 60 % : un peu sombre. Ouvrez l\'iris jusqu\'à ce que le zébra 1 le hachure.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  const cams = [['1', 'CAM 1'], ['2', 'CAM 2'], ['3', 'CAM 3'], ['4', 'CAM 4']];
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Iris (par rapport au réglage)', -2, 2, iris, 0.1, (v) => { iris = v; draw(); }, (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), 1) + ' diaph.'),
      slider('ZEBRA1, niveau', 60, 80, z1, 1, (v) => { z1 = v; draw(); }, (v) => v + ' %'),
      choice('Zone de sécurité', [['80', '80 %'], ['90', '90 %'], ['92.5', '92,5 %'], ['95', '95 %']], '90', (v) => { sur = +v; draw(); })),
    el('div', { class: 'co-ctl' },
      choice('Au programme (PGM)', cams, String(pgm), (v) => { pgm = +v; draw(); }),
      choice('Au preview (PVW)', cams, String(pvw), (v) => { pvw = +v; draw(); }),
      choice('Tally vert', [['1', 'utilisé'], ['0', 'pas dans ce car']], '1', (v) => { vert = v === '1'; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À gauche, l\'image du viseur en cinq zones, hachurée par les zébras (noir : ZEBRA1 ; blanc : ZEBRA2), et la zone de sécurité en pointillés. À droite, les lampes de tally des quatre caméras.')),
    verdict, read.el);
  draw();
}

/** @type {import('./index.js').Lesson[]} */
export const LECONS_CORPS = [
  {
    id: 'camera-corps', title: 'Le corps : commandes, menu, connectique, alimentation', minutes: '10 min', partie: PARTIE,
    camlab: ['commandes', 'menu', 'connectique', 'alimentation'],
    essentials: [
      'Les **commandes du corps** (FILTER, GAIN, SHUTTER, balances, barres) servent quand la caméra est **seule** ; **reliée à la CCU**, c\'est le **RCP** de la vision qui commande l\'image. Le cadreur garde le cadre, son viseur, les touches ASSIGN, l\'intercom et le CALL.',
      'Le **menu** (dans le viseur) range les réglages en quatre familles : **OPERATION** (le cadreur), **PAINT** (l\'image, la vision), **MAINTENANCE** (l\'installation), **FILE** (les sauvegardes).',
      'La **CCU** alimente la tête par le **câble hybride** (≈ 32 W avec le viseur, jusqu\'à 600 m pour la FB80) ; au-delà, **fibre monomode** et alimentation sur place par **DC IN** (10,5 à 17 V, 5,4 A au plus).',
    ],
    figure: () => figNotions(['connectique', 'menu'], 'La connectique de la face arrière et le menu de la caméra'),
    demoTitle: 'Basculez la caméra seule ou reliée : qui commande quoi ? Puis allongez le câble hybride au-delà de 600 m, passez en fibre monomode et branchez un accessoire sur DC OUT.',
    demo: demoCorps,
    body: `Sous la trappe du flanc, la HXC-FB80 réunit les **commandes de l'image** : **FILTER** (la roue des ND), **COLOR TEMP.** (5 600 K d'usine), **GAIN** L, M, H (0, 6 et 12 dB d'usine), **OUTPUT/AUTO KNEE** (BARS envoie des barres, CAM l'image ; le même commutateur met l'AUTO KNEE en service), **WHITE BAL** (B, A, PRST) et **WHT/BLK** pour les balances, le **SHUTTER**, et trois touches **ASSIGN** sans fonction d'usine, auxquelles le cadreur donne celle qu'il veut (zébra, peaking, retour, extender). Elles servent quand la caméra travaille **seule**, avec un enregistreur sur SDI OUT. Dès qu'elle est **reliée à sa CCU** ou à un pupitre, l'appareil relié commande le shutter, les balances, la sortie, le gain et le filtre : le mode d'emploi l'écrit tel quel. La vision règle l'image depuis le car pour que toutes les caméras se ressemblent ; le cadreur garde ce qui fait son métier.

Le **menu** s'affiche dans le viseur (commutateur DISPLAY/MENU), jamais sur l'image envoyée. Quatre familles : **OPERATION** pour le cadreur (affichage du viseur, marqueurs, zébras, voie affichée, touches ASSIGN, fichier opérateur), **PAINT** pour l'image (niveaux, température de couleur, gamma, knee, détail, matrice : le territoire de la vision, piloté depuis le RCP), **MAINTENANCE** pour l'installation (on y va rarement, jamais à l'antenne), **FILE** pour les sauvegardes. On navigue à la molette : tourner, appuyer, CANCEL pour annuler ; les pages sont numérotées (O06 ZEBRA, P07 KNEE…) et le même numéro vaut pour toute la famille de caméras.

La **connectique** de l'arrière se lit par familles. L'image en **BNC** (75 Ω) : SDI OUT, SDI I/O (un retour quand la caméra est seule), TEST OUT, PROMPTER/GENLOCK (le texte du prompteur avec la CCU, l'entrée de référence sans elle). Le son et l'intercom : AUDIO 1 et 2 IN en **XLR 3** (LINE, MIC ou MIC +48V pour un micro statique), INTERCOM en **XLR 5** (le casque-micro), EARPHONE. L'énergie et la commande : **DC IN** en **XLR 4** (12 V), DC OUT (1,5 A au plus, une lampe ou un récepteur), REMOTE, LENS (12 broches), VF, USB, TRUNK. Et un seul connecteur de **fibre** porte tout ce qui va et vient de la CCU : avec une CCU, la plupart des prises de l'arrière restent bouchées.

L'**énergie** arrive avec le câble : la CCU, sur le secteur, **télé-alimente** la tête par le cuivre du câble hybride. Le cuivre a une résistance : plus le câble est long, plus la tension chute, jusqu'à ne plus pouvoir faire passer la puissance demandée. Pour la FB80, **600 m** avec le câble hybride Sony et un objectif portable ; la lumière irait bien plus loin. Au-delà, la **fibre monomode** seule va jusqu'à **10 km**, et la caméra trouve son énergie sur place, par **DC IN** : un bloc secteur ou une batterie, entre 10,5 et 17 V, 5,4 A au plus. Le budget : environ 19 W pour le corps, 13 W de plus pour le viseur 7", quelques watts pour le servo de l'objectif (ordre de grandeur), et ce qui est branché sur DC OUT. Sur batterie, l'autonomie vaut l'énergie stockée divisée par la puissance : 95 Wh pour 37 W, environ 2 h 30.

- Reconnaître une prise : BNC à quart de tour pour la vidéo, XLR 3 audio (1 masse, 2 point chaud, 3 point froid), XLR 4 alimentation, XLR 5 intercom ; on ne force jamais un détrompeur.
- Au stade, les HDC du car sont en fibre hybride SMPTE, alimentées depuis le car jusqu'à environ 2 km selon la caméra et le câble.`,
    car: { text: 'Au stade, l\'arrière d\'une caméra ne voit que la fibre, le casque de l\'intercom, parfois un DC OUT pour une lampe ou un moniteur sur SDI OUT. Le branchement se fait côté car, sur la CCU : à la baie CCU, la voie indique si la tête est alimentée par la CCU (ALIM. CCU) ; c\'est là que l\'on cherche quand une caméra n\'arrive pas.', station: 'ccu' },
    terms: ['cable-hybride', 'fibre-monomode'],
    competences: competencesDe(['commandes', 'menu', 'connectique', 'alimentation']),
    article: 'camsys',
    exercises: [
      { id: 'materiel-camera', intro: 'Dans la visionneuse de matériel, vous ouvrez l\'arrière de la tête de caméra puis celui de sa CCU et vous cliquez leurs connecteurs, comme dans la partie connectique de la leçon : la fibre hybride, l\'intercom du cadreur (XLR 5), l\'arrivée CAMERA, la référence et la sortie SDI vers la grille. Sur chaque face, retrouvez ce qui monte vers le car, ce qui descend vers la tête, et ce qui reste bouché quand la caméra est reliée à sa CCU.' },
    ],
    quiz: quizDe(['commandes', 'menu', 'connectique', 'alimentation'], [
      { q: 'Au stade, un cadreur bascule le commutateur GAIN de sa caméra sur H pour « éclaircir » son image. Rien ne change au moniteur de la vision. Pourquoi ?',
        choices: ['Reliée à sa CCU, la caméra obéit au RCP pour le gain : le commutateur du corps ne fait plus rien',
          ['Le gain H vaut 0 dB d\'usine', 'D\'usine, L, M et H valent 0, 6 et 12 dB : H aurait changé l\'image si la caméra travaillait seule.'],
          ['Il faut d\'abord entrer dans le menu PAINT', 'Le menu PAINT suit lui aussi le RCP quand la caméra est reliée : la vision règle l\'image depuis le car.']],
        answer: 0, why: 'Reliée à une CCU ou à un pupitre, la caméra laisse à l\'appareil relié le shutter, les balances, la sortie, le gain et le filtre. Le cadreur garde le cadre, le zoom, le point, son viseur et les touches ASSIGN ; l\'image, c\'est la vision.' },
    ]),
  },
  {
    id: 'camera-viseur', title: 'Le viseur, le tally et le cadreur', minutes: '10 min', partie: PARTIE,
    camlab: ['viseur', 'cadreur', 'tally', 'retours'],
    essentials: [
      'Le **viseur** 7" montre l\'image avec des aides pour le seul cadreur : **peaking** pour le point, **zébras** pour l\'exposition (70 % pour un visage, 100 % pour l\'écrêtage), **marqueurs** de zone de sécurité ; BRIGHT et CONTRAST ne changent pas l\'image envoyée.',
      'Le **tally rouge** dit « à l\'antenne », le **vert** « tu es la prochaine » ; **CALL** appelle la vision sans un mot ; l\'**intercom** passe dans la fibre, **PROD** vers la réalisation, **ENG** vers la technique. Les **retours** (RET) montrent le programme dans le viseur.',
      'Au **poste du cadreur**, les commandes de zoom et de point sont reportées sur les manches de la **tête fluide** ; la caméra est **équilibrée** (plaque, contrepoids, frictions) : elle reste où on la lâche.',
    ],
    figure: () => figNotions(['viseur', 'tally'], 'Le viseur et ses aides, le tally'),
    demoTitle: 'Réglez l\'iris pour que le zébra 1 hachure le visage, puis ouvrez de deux diaphragmes : que hachure le zébra 2 ? Changez la zone de sécurité, puis faites passer la CAM 3 au programme.',
    demo: demoViseur,
    body: `Le **viseur** de plateau est un écran de 7 pouces en 1 920 × 1 080, posé sur la caméra. Il montre l'image avec des **aides qui n'existent que pour le cadreur** : rien ne part au car, sauf l'extender. **BRIGHT** et **CONTRAST** règlent l'écran du viseur, pas la sortie de la caméra : un viseur trop lumineux fait croire l'image surexposée, un viseur terne fait ouvrir l'iris pour rien ; on les règle sur les barres. Le **PEAKING** souligne de blanc les contours nets : on tourne le point jusqu'à ce que le soulignement s'allume sur ce qui compte. Les **zébras** hachurent les zones d'un certain niveau : ZEBRA1 autour de 70 % (largeur 10 %), le niveau d'un visage clair bien exposé ; ZEBRA2 tout ce qui atteint 100 %, l'écrêtage. Les **marqueurs** donnent la croix du centre et la **zone de sécurité** (80, 90, 92,5 ou 95 % de l'image) pour garder titres et visages loin des bords. L'**extender numérique** grossit le centre deux ou quatre fois pour vérifier le point, mais il agrandit l'image envoyée : avant l'antenne, jamais pendant.

Le **tally** vient du mélangeur, qui sait quelle caméra est à l'antenne : il le dit à chaque CCU, qui le transmet par la fibre. Sur la caméra, la lampe sur le dessus du viseur (pour le présentateur), les voyants R et G du viseur (pour le cadreur), le voyant du corps. **Rouge** : la caméra est au programme, on ne bouge plus le cadre. **Vert** : elle est au preview, la prochaine ; on prépare le cadre (l'usage du vert dépend du car). Le bouton **CALL** allume le tally rouge de la CCU et du RCP : un appel silencieux, « la 2 a besoin de toi ». L'**intercom** passe aussi dans la fibre : le casque-micro sur la prise INTERCOM, deux lignes, **PROD** (la réalisation : les ordres de cadre) et **ENG** (la vision, le chef de car : l'image et les pannes). Les **retours vidéo** sont des images que la grille envoie à la CCU, et la fibre jusqu'au viseur : **RET 1** tant qu'on appuie, la touche RET de l'objectif pour le retour choisi par RET2 SEL, et MIX VF pour superposer le retour à sa propre image. La prise **PROMPTER** ressort le texte du prompteur venu du car.

Le **poste du cadreur**, c'est une **tête fluide** (panoramique et inclinaison freinés par un fluide visqueux) conduite par les **manches**, où sont reportées les commandes de l'objectif : la bascule de zoom sous le pouce, la manivelle de point sous l'autre main. Une fois branchées, on ne touche plus l'objectif. La caméra doit être **équilibrée** : son centre de gravité au-dessus de l'axe d'inclinaison, sinon elle pique du nez (le couple vaut masse × g × distance : 7 kg à 2 cm de l'axe, 1,4 N·m). On fait glisser la **plaque**, verrou fermé ; le **contrepoids** compense le couple qui naît quand on incline, le centre de gravité étant plus haut que l'axe ; les **frictions** viennent en dernier, au goût du cadreur.

- Au stade, le cadreur fait le point au peaking, zébras éteints : l'exposition, c'est la vision, à la forme d'onde.
- Le tally rouge d'un RCP qui s'allume hors antenne, c'est un cadreur qui appelle : on lui répond sur ENG.`,
    car: { text: 'Au poste cadreur, le viseur de la HDC, les commandes reportées sur les manches et le tally : rouge à l\'antenne, vert au preview. La grille envoie à chaque CCU le programme et les sources que le réalisateur veut montrer aux cadreurs ; l\'intercom PROD et ENG passe dans la fibre jusqu\'au casque.', station: 'cadreur' },
    terms: ['tsl-umd'],
    competences: competencesDe(['viseur', 'cadreur', 'tally', 'retours']),
    article: 'icomguide',
    exercises: [
      { id: 'cadreur-cadrer', intro: 'Vous prenez la caméra large en tribune : zoom, panoramique, puis la lecture du tally. Observez ce que le cadreur règle lui-même (le cadre, la focale, son viseur) et ce qu\'il reçoit par la fibre sans y toucher : l\'image de son viseur, le tally rouge ou vert, la voix de la réalisation sur PROD. Ne bougez plus le cadre quand le tally est rouge.' },
    ],
    quiz: quizDe(['viseur', 'cadreur', 'tally', 'retours'], [
      { q: 'Pendant le match, la lampe de tally de la CAM 3 passe au vert. Que fait le cadreur ?',
        choices: ['Il prépare un cadre propre : sa caméra est au preview, elle va passer à l\'antenne',
          ['Il ne bouge plus : il est à l\'antenne', 'C\'est le rouge qui dit « à l\'antenne ». Le vert annonce la caméra suivante, quand le car l\'utilise.'],
          ['Il appuie sur CALL pour répondre à la vision', 'Le tally vert vient du mélangeur, pas de la vision : il n\'y a personne à rappeler.']],
        answer: 0, why: 'Le mélangeur dit à chaque CCU quelle caméra est au programme (rouge) et, dans beaucoup de cars, laquelle est au preview (vert). Vert : on prépare le cadre, car on est la prochaine ; rouge : on ne bouge plus le cadre.' },
    ]),
  },
];
