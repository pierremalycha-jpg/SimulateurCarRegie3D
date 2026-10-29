// @ts-check
import { registerExos, entre, pick, fr } from '../exo.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « Le signal vidéo numérique » : des débits, des codes, des
// niveaux et des liaisons à calculer, des réglages à choisir, avec des valeurs tirées à chaque essai.
// Les chiffres sont ceux des leçons (cours/signal.js) : raster 2 640 × 1 125 en 1080, 1 980 × 750 en
// 720p50, 20 bits par pixel en 4:2:2 10 bits, noir au code 64 et blanc à 940, courbe HLG de BT.2100.
// ----------------------------------------------------------------------------------
const MODES = { '444': { n: 3, nom: '4:4:4' }, '422': { n: 2, nom: '4:2:2' }, '420': { n: 1.5, nom: '4:2:0' } };
const IMAGES = [{ w: 1920, h: 1080, nom: '1080p' }, { w: 3840, h: 2160, nom: '2160p' }, { w: 1280, h: 720, nom: '720p' }];
/** débit de l'image active, en Gb/s : pixels × images par seconde × bits × échantillons par pixel */
const actif = (I, fps, bits, mode) => I.w * I.h * fps * bits * MODES[mode].n / 1e9;
// le raster complet (suppression comprise) et la liaison SDI de chaque format (signal-formats)
const FORMATS = [
  { nom: '720p50', tot: 1980, lignes: 750, ips: 50, sdi: 'HD-SDI' },
  { nom: '1080i25', tot: 2640, lignes: 1125, ips: 25, sdi: 'HD-SDI' },
  { nom: '1080p25', tot: 2640, lignes: 1125, ips: 25, sdi: 'HD-SDI' },
  { nom: '1080p50', tot: 2640, lignes: 1125, ips: 50, sdi: '3G-SDI' },
];
const SDI = ['HD-SDI (1,485 Gb/s)', '3G-SDI (2,97 Gb/s)', '6G-SDI (5,94 Gb/s)', '12G-SDI (11,88 Gb/s)'];
const HLG = (E) => (E <= 1 / 12 ? Math.sqrt(3 * E) : 0.17883277 * Math.log(12 * E - 0.28466892) + 0.55991073);
const code10 = (p) => Math.round(64 + p / 100 * 876);

registerExos({
  'signal-422': {
    titre: 'Calculer ce que pèse la couleur',
    consigne: 'Le chef de car prépare le plan des liaisons : il te demande ce que pèse l\'image active selon l\'échantillonnage, et quoi garder pour chaque usage.',
    gen: (rnd) => {
      const I = pick(rnd, IMAGES.slice(0, 2)), fps = pick(rnd, [25, 50]), mode = pick(rnd, ['444', '422', '420']);
      const v = actif(I, fps, 10, mode);
      const autres = Object.keys(MODES).filter((m) => m !== mode);
      const N = pick(rnd, [1280, 1920, 3840]), m2 = pick(rnd, ['444', '422']);
      return [
        {
          type: 'nombre', unite: 'Gb/s', answer: Math.round(v * 1000) / 1000, tol: Math.max(0.02, v * 0.01),
          q: `Image active en **${I.nom}${fps}**, **${MODES[mode].nom}**, 10 bits : quel débit, en Gb/s (sans la suppression ni les données) ?`,
          pieges: autres.map((m) => ({ v: Math.round(actif(I, fps, 10, m) * 1000) / 1000, why: `C'est le débit en ${MODES[m].nom}. En ${MODES[mode].nom}, compte ${fr(MODES[mode].n, 1)} échantillon${MODES[mode].n > 1 ? 's' : ''} par pixel.` })),
          aides: ['Compte les échantillons par pixel : 3 en 4:4:4 (Y, Cb, Cr sur chaque pixel), 2 en 4:2:2, 1,5 en 4:2:0.', `Débit = largeur × hauteur × images par seconde × 10 bits × échantillons par pixel, puis divise par 10⁹ : ${I.w} × ${I.h} × ${fps} × 10 × …`],
          solution: `${I.w} × ${I.h} × ${fps} × 10 bits × ${fr(MODES[mode].n, 1)} = **${fr(v, 2)} Gb/s**. Le 4:2:2 garde les deux tiers du 4:4:4, le 4:2:0 la moitié : la luminance ne change jamais, seule la couleur est réduite.`,
        },
        {
          type: 'nombre', answer: m2 === '444' ? 3 * N : 2 * N,
          q: `Une ligne active compte **${fr(N)} pixels**, en **${MODES[m2].nom}**. Combien d'échantillons en tout sur la ligne (Y, Cb et Cr réunis) ?`,
          pieges: [{ v: N, why: 'C\'est le nombre d\'échantillons de luminance seuls : ajoute ceux de Cb et de Cr.' }, { v: m2 === '444' ? 2 * N : 3 * N, why: m2 === '444' ? 'En 4:4:4, Cb et Cr sont sur chaque pixel, comme Y.' : 'En 4:2:2, Cb et Cr ne sont portés qu\'un pixel sur deux.' }],
          aides: [`Sur quatre pixels, la notation ${MODES[m2].nom} donne le nombre d'échantillons Y, Cb et Cr.`, `${m2 === '444' ? '4 + 4 + 4 = 12' : '4 + 2 + 2 = 8'} échantillons pour quatre pixels : fais la règle de trois sur ${fr(N)} pixels.`],
          solution: `${m2 === '444' ? `${fr(N)} Y + ${fr(N)} Cb + ${fr(N)} Cr = **${fr(3 * N)}**` : `${fr(N)} Y + ${fr(N / 2)} Cb + ${fr(N / 2)} Cr = **${fr(2 * N)}**`} échantillons. C'est pourquoi on dit qu'un pixel 4:2:2 « vaut » deux mots de 10 bits, 20 bits.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le truquiste prépare le plateau virtuel : un fond vert sera incrusté derrière le consultant. Quel signal lui faut-il en entrée ?',
            choices: ['Du 4:2:2 10 bits, comme le reste du car', ['Du 4:2:0 8 bits, plus léger', 'Le 4:2:0 enlève la moitié de la couleur sur les contours : la clé du fond vert crénèle et bave.'], ['N\'importe lequel : la clé ne se calcule que sur la luminance', 'Une chroma key se calcule justement sur la couleur (Cb, Cr) : c\'est elle qui doit rester fine.']], answer: 0,
            aides: ['Une incrustation sur fond vert se calcule sur quelle partie du signal : la lumière ou la couleur ?', 'Le car garde la couleur fine pour tous ses traitements ; seule la sortie vers le public la réduit.'],
            solution: 'Le **4:2:2 10 bits** : la clé chromatique a besoin de la couleur sur les contours. Le 4:2:0 est réservé à la diffusion, en bout de chaîne.',
          },
          {
            type: 'choix', q: 'Le codeur de diffusion envoie le match aux téléspectateurs en H.264. Quel échantillonnage utilise-t-il ?',
            choices: ['4:2:0 : la moitié de la couleur, invisible au public', ['4:4:4 : la meilleure qualité possible', 'Le 4:4:4 coûte 50 % de plus que le 4:2:2 sans que l\'œil y voie la moindre différence sur une image naturelle.'], ['4:2:2 : celui du car', 'Le 4:2:2 sert aux traitements du car ; à la diffusion, plus rien n\'est incrusté ni étalonné.']], answer: 0,
            aides: ['En bout de chaîne, l\'image n\'est plus retravaillée : que peut-on encore réduire sans que l\'œil le voie ?', 'L\'œil distingue mal les détails de couleur ; la diffusion divise aussi la couleur par deux d\'une ligne à l\'autre.'],
            solution: '**4:2:0** : la couleur est portée un pixel sur deux et une ligne sur deux. Le public ne voit pas la différence, et le débit à compresser baisse d\'un quart par rapport au 4:2:2.',
          },
        ]),
      ];
    },
  },
  'signal-bits': {
    titre: 'Des niveaux, des pas et des codes',
    consigne: 'À la baie de mesure, tu vérifies la quantification de plusieurs sources : combien de niveaux, quelle finesse, quel code transporte le SDI.',
    gen: (rnd) => {
      const n = pick(rnd, [6, 8, 10, 12]), L = 2 ** n;
      const b = pick(rnd, [8, 10, 12]), pas = 100 / (2 ** b - 1);
      const x = entre(rnd, 16, 235);
      return [
        {
          type: 'nombre', answer: L, q: `Combien de niveaux par composante une quantification sur **${n} bits** donne-t-elle ?`,
          pieges: [{ v: L - 1, why: `C'est le code le plus haut (de 0 à ${fr(L - 1)}) : en comptant le 0, il y a un niveau de plus.` }, { v: n * 2, why: 'Chaque bit de plus double le nombre de niveaux : c\'est une puissance de 2, pas un produit.' }],
          aides: ['Chaque bit ajouté double le nombre de niveaux.', `C'est 2 puissance ${n}.`],
          solution: `2 puissance ${n} = **${fr(L)}** niveaux${n === 8 ? ' : le 8 bits de la diffusion' : n === 10 ? ' : le 10 bits du car et du SDI' : ''}.`,
        },
        {
          type: 'nombre', unite: '% du blanc', answer: Math.round(pas * 1000) / 1000, tol: pas * 0.03,
          q: `En **${b} bits**, de combien de pour cent du blanc est un pas de quantification (l'écart entre deux niveaux voisins, sur toute l'échelle) ?`,
          pieges: [{ v: Math.round(pas / 2 * 1000) / 1000, why: 'C\'est le demi-pas : l\'erreur de quantification maximale, pas le pas lui-même.' }],
          aides: ['L\'échelle va du code 0 au code le plus haut : combien d\'intervalles entre les niveaux ?', `Il y a 2^${b} − 1 = ${fr(2 ** b - 1)} intervalles : divise 100 % par ce nombre.`],
          solution: `100 % ÷ ${fr(2 ** b - 1)} = **${fr(pas, 3)} %**. L'erreur d'arrondi vaut au plus un demi-pas, ${fr(pas / 2, 3)} % : c'est elle qui dessine les bandes dans un dégradé lent.`,
        },
        {
          type: 'nombre', answer: x * 4,
          q: `Une source **8 bits** envoie le code **${x}**. Elle entre dans le SDI, qui transporte des mots de 10 bits. Quel code 10 bits porte le câble ?`,
          pieges: [{ v: x, why: 'Le SDI ajoute deux bits à droite du mot : la valeur change d\'échelle.' }, { v: x * 2, why: 'Deux bits de plus multiplient par 2 × 2, pas par 2.' }],
          aides: ['Le SDI ajoute deux bits de poids faible, à zéro : décaler de deux bits vers la gauche, c\'est multiplier par… ?', 'Deux bits à zéro ajoutés à droite : × 2 × 2. Vérifie avec le blanc : 235 en 8 bits, 940 en 10 bits.'],
          solution: `${x} × 4 = **${x * 4}** : les deux bits de poids faible sont à zéro. La source garde ses 256 niveaux, un code sur quatre de l'échelle 10 bits ; ses marches restent celles du 8 bits.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le car produit en HDR HLG pour une chaîne UHD. Quelle quantification au minimum ?',
            choices: ['10 bits', ['8 bits, comme la diffusion HD', 'La HDR répartit une plage de lumière bien plus grande sur l\'échelle : en 8 bits, les bandes réapparaissent dans les hautes lumières.'], ['12 bits obligatoirement', '12 bits est réservé aux caméras cinéma et au RAW ; BT.2100 demande 10 bits au minimum.']], answer: 0,
            aides: ['La norme de la HDR est BT.2100 : elle fixe un minimum.', 'Plus la plage de lumière à coder est grande, plus les pas doivent être fins.'],
            solution: '**10 bits** au minimum (BT.2100, HLG comme PQ). En 8 bits, les pas seraient trop larges pour une plage de lumière dix fois plus grande.',
          },
          {
            type: 'choix', q: 'Sur quelle image l\'ingénieur vision repère-t-il d\'abord des bandes de quantification ?',
            choices: ['Un ciel de fin de journée, en dégradé lent', ['Une pelouse texturée et bien exposée', 'La texture masque l\'erreur d\'un demi-pas : on ne voit pas de marches sur une surface qui varie déjà.'], ['Le score blanc sur un bandeau noir', 'Un contraste fort ne montre pas de marches : il n\'y a pas de pente lente à découper.']], answer: 0,
            aides: ['Les marches ne se voient que là où le niveau varie lentement, sur une grande surface.', 'Cherche la zone la plus lisse de l\'image.'],
            solution: 'Le **ciel en dégradé lent** : la pente y est découpée en bandes larges de plusieurs lignes, que la texture ou le contraste ne masquent pas.',
          },
        ]),
      ];
    },
  },
  'signal-niveaux': {
    titre: 'Lire et poser des niveaux',
    consigne: 'Au poste vision, tu passes du pourcentage du waveform au code numérique et aux millivolts, puis tu choisis le bon réglage du RCP.',
    gen: (rnd) => {
      const p = pick(rnd, [2, 10, 20, 35, 45, 50, 55, 75, 90, 100, 103, 106]);
      const c = entre(rnd, 120, 930), pc = (c - 64) / 876 * 100;
      const mv = pick(rnd, [2, 18, 35, 50, 75, 100]);
      return [
        {
          type: 'nombre', answer: code10(p), tol: 1, q: `Un point de l'image est à **${fr(p)} %** sur le waveform. Quel est son code en 10 bits ?`,
          pieges: [{ v: Math.round(p / 100 * 1023), why: 'C\'est la pleine échelle (full range). En studio, 0 % est au code 64 et 100 % au code 940.' }, { v: Math.round(p / 100 * 876), why: 'Il manque le décalage : 0 % n\'est pas au code 0 mais au code 64.' }],
          aides: ['0 % est au code 64, 100 % au code 940 : combien de codes entre les deux ?', `940 − 64 = 876 codes pour 100 % : code = 64 + ${fr(p)} % × 876.`],
          solution: `64 + ${fr(p / 100, 2)} × 876 = **${code10(p)}**${p > 100 ? ' : un super-blanc, transporté par le SDI mais hors de la plage légale' : ''}.`,
        },
        {
          type: 'nombre', unite: '%', answer: Math.round(pc * 10) / 10, tol: 0.6, q: `L'État SDI de la baie de mesure lit le code **${c}** sur la luminance. À combien de pour cent est ce point ?`,
          // la lecture en pleine échelle rejoint la bonne vers le code 445 : le piège n'y est pas posé
          pieges: [{ v: Math.round(c / 1023 * 1000) / 10, why: 'C\'est la lecture en pleine échelle : en studio, le noir est au code 64, pas au code 0.' }].filter((x) => Math.abs(x.v - pc) > 1.5),
          aides: ['Retire d\'abord le code du noir.', `(${c} − 64) ÷ 876 × 100.`],
          solution: `(${c} − 64) ÷ 876 = **${fr(pc, 1)} %**${pc < 35 ? ' : une ombre' : pc > 90 ? ' : un blanc, à surveiller' : ' : un niveau de pelouse ou de visage'}.`,
        },
        {
          type: 'nombre', unite: 'mV', answer: mv * 7, tol: 1, q: `Le formateur lit encore ses niveaux en millivolts, comme en analogique. **${mv} %**, combien de millivolts ?`,
          aides: ['Le blanc 100 % vaut 700 mV, le noir 0 mV.', '1 % = 7 mV.'],
          solution: `${mv} × 7 = **${mv * 7} mV** (100 % = 700 mV).`,
        },
        pick(rnd, [
          {
            type: 'choix', q: `Le waveform montre les noirs de la caméra ${entre(rnd, 2, 9)} vers **${entre(rnd, 6, 10)} %**, quand les autres caméras les posent à 1 %. Que reprends-tu au RCP ?`,
            choices: ['Le piédestal (master black), à baisser', ['Le gain, à baisser', 'Le gain multiplie le signal : il déplace les blancs, à peine un noir proche de zéro.'], ['Rien : le légaliseur s\'en charge', 'Des noirs à quelques pour cent sont légaux : le légaliseur n\'y touchera pas, l\'image restera grise.']], answer: 0,
            aides: ['Quel réglage ajoute ou retire une constante à tout le signal ?', 'Le gain multiplie (il agit surtout sur les blancs) ; l\'autre réglage décale.'],
            solution: 'Le **piédestal** : il pose les noirs, entre 0 et 2 %. Les blancs descendent d\'autant ; on les revérifie ensuite.',
          },
          {
            type: 'choix', q: 'Le haut de la trace du waveform forme un trait plat sur la ligne des 100 % quand le maillot blanc passe au soleil. Que se passe-t-il ?',
            choices: ['Les blancs sont écrêtés : le détail du maillot est perdu', ['L\'image est parfaitement exposée', 'Un trait plat veut dire que tous ces points ont été ramenés au même niveau : il n\'y a plus de relief.'], ['Le câble SDI est trop long', 'Un câble trop long donne des erreurs CRC et des éclats, jamais un trait horizontal net.']], answer: 0,
            aides: ['Une trace plate veut dire que de nombreux points ont exactement le même niveau.', 'Au-dessus de 100 %, le légaliseur ramène tout au même niveau.'],
            solution: 'Des **blancs écrêtés** : on referme l\'iris ou on baisse le gain jusqu\'à retrouver du relief sous 100 %.',
          },
        ]),
      ];
    },
  },
  'signal-formats': {
    titre: 'Choisir la liaison d\'un format',
    consigne: 'Le chef de car vérifie la liste des liaisons du car : le débit de chaque format, la liaison SDI qui le porte, la durée d\'une ligne.',
    gen: (rnd) => {
      const F = pick(rnd, FORMATS), deb = F.tot * F.lignes * F.ips * 20 / 1e9;
      const G = pick(rnd, [...FORMATS, { nom: '2160p25', sdi: '6G-SDI' }, { nom: '2160p50', sdi: '12G-SDI' }]);
      const H = pick(rnd, FORMATS), ligne = 1e6 / (H.lignes * H.ips);
      const k = pick(rnd, [2, 3, 6]);
      return [
        {
          type: 'nombre', unite: 'Gb/s', answer: Math.round(deb * 1000) / 1000, tol: 0.01,
          q: `Quel débit sur le câble pour du **${F.nom}** 4:2:2 10 bits ? Le raster complet compte ${fr(F.tot)} échantillons par ligne sur ${fr(F.lignes)} lignes, chaque pixel vaut 20 bits.`,
          pieges: [{ v: Math.round((F.nom.startsWith('720') ? 1280 * 720 : 1920 * 1080) * F.ips * 20 / 1e7) / 100, why: 'C\'est l\'image active seule : le SDI transporte aussi la suppression (les lignes et les échantillons hors image).' }],
          aides: ['Compte le raster complet, suppression comprise, pas seulement l\'image active.', `${fr(F.tot)} × ${fr(F.lignes)} × ${F.ips} images par seconde × 20 bits.`],
          solution: `${fr(F.tot)} × ${fr(F.lignes)} × ${F.ips} × 20 = **${fr(deb, 3)} Gb/s** : le ${F.sdi}.`,
        },
        {
          type: 'choix', q: `Quelle liaison SDI pour du **${G.nom}** 4:2:2 10 bits ?`,
          choices: SDI, answer: SDI.findIndex((s) => s.startsWith(G.sdi)),
          aides: ['Le 1080i25, le 1080p25 et le 720p50 ont le même débit ; le 1080p50 le double.', 'HD : 1,485 Gb/s ; 3G : 2,97 ; 6G : 5,94 (2160p25) ; 12G : 11,88 (2160p50).'],
          solution: `Le **${G.sdi}**. ${G.sdi === 'HD-SDI' ? 'Le 1080i25, le 1080p25 et le 720p50 tiennent tous dans 1,485 Gb/s.' : G.sdi === '3G-SDI' ? '50 images entières par seconde : le double du HD-SDI.' : 'L\'UHD compte quatre fois les pixels du 1080 : 6G à 25 images, 12G à 50 (ou quatre câbles 3G).'}`,
        },
        {
          type: 'nombre', unite: 'µs', answer: Math.round(ligne * 100) / 100, tol: 0.06,
          q: `À la baie de mesure, la tuile Timing donne la durée d'une ligne. Combien doit-elle afficher pour du **${H.nom}** (${fr(H.lignes)} lignes par image) ?`,
          aides: ['Une ligne dure une seconde divisée par le nombre de lignes par seconde.', `1 000 000 µs ÷ (${fr(H.lignes)} lignes × ${H.ips} images par seconde).`],
          solution: `10⁶ ÷ (${fr(H.lignes)} × ${H.ips}) = **${fr(ligne, 2)} µs**. Une source qui affiche une autre durée n'est pas au format annoncé.`,
        },
        {
          type: 'nombre', answer: k, q: `Une caméra ralenti tourne en 1080p à **${50 * k} images par seconde** (${k}×). Combien de liaisons 3G-SDI faut-il pour sortir toutes ses images ?`,
          aides: ['Une liaison 3G porte exactement un 1080p50.', `${50 * k} ÷ 50.`],
          solution: `${50 * k} ÷ 50 = **${k}** liaisons 3G, une par phase de 50 images.`,
        },
      ];
    },
  },
  'signal-couleur': {
    titre: 'HDR et SDR, gamut et blanc de référence',
    consigne: 'Le car sort le match en HLG BT.2020 pour la chaîne UHD et en SDR BT.709 pour la HD : tu places les niveaux et tu choisis les conversions.',
    gen: (rnd) => {
      const k = pick(rnd, [1, 2, 4, 6, 12]), v = HLG(k / 12) * 100;
      return [
        {
          type: 'nombre', unite: '%', answer: Math.round(v * 10) / 10, tol: 1,
          q: `Un projecteur du stade donne **${k} fois** la lumière qui sature la caméra en SDR. À combien de pour cent du signal HLG est-il ? (Courbe HLG : E' = √(3E) jusqu'à E = 1/12, puis 0,17883 × ln(12E − 0,28467) + 0,55991 ; la saturation du SDR est à E = 1/12.)`,
          pieges: [{ v: 100, why: k === 12 ? '' : 'C\'est la SDR qui écrête à 100 % : la HLG garde encore de la place au-dessus.' }].filter((x) => x.why),
          aides: [`La lumière qui saturait le SDR est à E = 1/12 : ${k} fois plus, c'est E = ${k}/12.`, k === 1 ? 'E = 1/12 est la limite des deux morceaux : √(3 × 1/12) = √(1/4).' : `Au-dessus de 1/12, prends le logarithme : 0,17883 × ln(12 × ${k}/12 − 0,28467) + 0,55991.`],
          solution: `**${fr(v, 1)} %**${k === 1 ? ' : la lumière qui sature le SDR n\'est qu\'à mi-échelle en HLG' : k === 12 ? ' : le haut de l\'échelle HLG, douze fois la saturation du SDR' : ' : sous 100 %, avec son détail, quand le SDR l\'écrête en aplat'}.`,
        },
        {
          type: 'choix', q: 'L\'opérateur d\'habillage règle le blanc de ses bandeaux pour la sortie HLG. À quel niveau ?',
          choices: ['75 % (BT.2408)', ['100 %', 'Ce serait le blanc du SDR : en HLG, le haut de l\'échelle est gardé pour les reflets et les sources de lumière.'], ['50 %', 'C\'est le niveau HLG de la lumière qui saturait le SDR, pas celui du blanc de référence.']], answer: 0,
          aides: ['Le rapport BT.2408 fixe le blanc de référence en direct HLG.', 'Il reste un quart de l\'échelle au-dessus, pour les hautes lumières.'],
          solution: '**75 %**, soit 203 cd/m² sur un écran de 1 000 cd/m² ; le gris à 18 % vers 38 %.',
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le convertisseur sort la version SDR BT.709 du match produit en BT.2020. Que devient le rouge très saturé des maillots, hors du triangle 709 ?',
            choices: ['Il est ramené vers le bord du triangle 709 et perd un peu de saturation', ['Il passe tel quel : le SDI transporte tout', 'Le câble porte n\'importe quelle valeur, mais un écran BT.709 ne sait pas afficher cette couleur.'], ['Il devient gris', 'Le gamut mapping rapproche la couleur du bord du triangle ; il ne la désature pas entièrement.']], answer: 0,
            aides: ['Le triangle BT.709 est plus petit que le BT.2020.', 'C\'est le gamut mapping : on ramène la couleur au plus près, sur le bord.'],
            solution: 'Le **gamut mapping** la ramène sur le bord du triangle 709 : le rouge y perd un peu de saturation, mais reste un rouge.',
          },
          {
            type: 'choix', q: 'Une source extérieure arrive en SDR BT.709 et doit entrer dans la production HLG BT.2020. Qu\'est-ce qui demande de la prudence ?',
            choices: ['Ses hautes lumières, écrêtées à la prise de vue : il faut les recréer', ['Ses couleurs, qui sortent du triangle BT.2020', 'Le triangle BT.709 tient tout entier dans le BT.2020 : ses couleurs y sont toutes reproductibles.'], ['Son blanc, qui n\'est pas celui du BT.2020', 'BT.709 et BT.2020 ont le même blanc, le D65.']], answer: 0,
            aides: ['Compare les deux triangles : lequel contient l\'autre ?', 'Le problème vient de la courbe SDR : qu\'a-t-elle fait de ce qui dépassait la lumière de référence ?'],
            solution: 'Les **hautes lumières** : la courbe SDR les a écrêtées en aplats. Monter en HDR demande d\'inventer ce qui n\'existe pas dans la source ; les couleurs, elles, tiennent dans le BT.2020.',
          },
        ]),
      ];
    },
  },
});
