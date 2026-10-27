// @ts-check
import { registerExos, entre, pick, fr as frn } from '../exo.js';
import { chaine, ECRETAGE, vDeDbu, dbuDeDbv, ECART_PRO_GP, boucle, repliement, dynamique, ALIGNEMENTS, dbuDeDbfs, dbfsDeDbu, canauxMadi, sousBlocs, blocs, integree, conformeR128, R128 } from '../son_console_calc.js';
import { canalUtile, fluxPour } from '../dante_calc.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie de la console analogique, des sorties, de l'audio numérique, de la loudness et de
// Dante (cours/son_console.js). Les réponses sont calculées par les modèles des leçons
// (cours/son_console_calc.js, cours/dante_calc.js) : une chaîne de gains en dBu (écrêtage vers +21 dBu, ordre
// de grandeur), les niveaux +4 dBu et −10 dBV, le larsen en modèle simplifié, Nyquist et le repliement, la
// dynamique 6,02 n + 1,76 dB, les alignements EBU R68 et SMPTE RP 155, la loudness intégrée de BS.1770 avec
// ses portes, la correction vers −23 LUFS, le débit d'un canal Dante (1,152 Mb/s utiles) et ses flux.
// ----------------------------------------------------------------------------------
/** un niveau avec le signe moins typographique */
const fr = (v, d = 0) => frn(v, d).replace('-', '−');
/** un niveau avec son signe */
const sg = (v, d = 0) => (v > 0 ? '+' : '') + fr(v, d);
const r1 = (v) => Math.round(v * 10) / 10;

const CONSOLE_CAS = [
  {
    type: 'choix', q: 'Au refrain, la LED PEAK du chant s\'allume. Que faites-vous ?',
    choices: ['Je baisse le GAIN de la tranche, en PFL', ['Je baisse le fader du chant', 'Le préampli écrête avant le fader : le son resterait écrêté, moins fort.'], ['Je baisse le master', 'Le master est après le préampli : il ne change rien à l\'écrêtage de la tranche.']], answer: 0,
    aides: ['Où la LED PEAK regarde-t-elle le signal : avant ou après le fader ?', 'Seul le réglage qui est avant elle peut l\'éteindre.'],
    solution: 'Baisser le **GAIN** : la LED PEAK surveille le signal avant le fader, là où le préampli écrête.',
  },
  {
    type: 'choix', q: 'Le micro statique de la guitare ne donne rien, même en PFL, GAIN au maximum. Les micros dynamiques marchent. Que vérifiez-vous ?',
    choices: ['L\'interrupteur 48 V, souvent commun aux entrées XLR', ['Le PAN de la guitare', 'Le PAN répartit un signal entre gauche et droite : il ne le fait pas disparaître du PFL.'], ['Le retour d\'effet', 'Le retour d\'effet ajoute la réverbération au mélange ; il ne touche pas l\'entrée d\'un micro.']], answer: 0,
    aides: ['Qu\'est-ce qui distingue un micro statique d\'un micro dynamique ?', 'Le statique a besoin d\'une tension envoyée par la console.'],
    solution: 'Le **48 V** : un micro statique ne délivre rien sans alimentation fantôme ; on l\'allume master baissé.',
  },
  {
    type: 'choix', q: 'Le mélange sonne juste, mais il souffle : les faders sont vers −20 dB et le master à +18 dB. Que faites-vous ?',
    choices: ['Je remonte les faders vers 0 et ramène le master vers 0', ['Je monte encore le master', 'Le master amplifie aussi le souffle du bus : il soufflerait plus fort.'], ['Je baisse les GAIN de toutes les tranches', 'Les tranches s\'éloigneraient du « 0 » : il faudrait pousser encore le master, et le souffle avec.']], answer: 0,
    aides: ['Le master amplifie tout ce qui arrive sur le bus, signal et souffle.', 'Le bon réglage : faders et master près de leur gain unité.'],
    solution: 'Faders vers **0** et master vers **0** : le bus de mélange n\'est plus amplifié pour rien, le souffle redescend.',
  },
  {
    type: 'ordre', q: 'Remettez dans l\'ordre le réglage d\'une tranche (gain staging).',
    items: ['Faders et master en bas, 48 V selon les micros', 'En PFL, la source au plus fort, monter le GAIN vers le « 0 » sans PEAK', 'Relâcher le PFL, fader vers 0, master vers 0', 'Égaliser, puis revérifier le GAIN en PFL'],
    aides: ['On commence par ne rien envoyer à la salle.', 'Le GAIN se règle avant le fader, l\'égaliseur après.'],
    solution: '1. Faders et master en bas, 48 V ; 2. GAIN en PFL vers le « 0 » ; 3. fader et master vers 0 ; 4. égaliseur, puis revérifier le GAIN.',
  },
];
const SORTIES_CAS = [
  {
    type: 'choix', q: 'Le batteur veut s\'entendre davantage dans son retour, sans que la façade change. Quel envoi réglez-vous ?',
    choices: ['L\'AUX pré-fader de ses tranches, vers son retour', ['Les faders de la batterie', 'Les faders font le mélange de la façade : la salle l\'entendrait aussi.'], ['L\'envoi FX post-fader', 'C\'est l\'envoi vers les effets : il donnerait de la réverbération, pas du retour.']], answer: 0,
    aides: ['Le retour doit être indépendant de la façade.', 'Un envoi pris avant le fader ne le suit pas.'],
    solution: 'L\'**AUX pré-fader** : le retour suit les boutons AUX, pas les faders de la façade.',
  },
  {
    type: 'choix', q: 'Quand on baisse la voix, sa réverbération reste seule dans la salle. Qu\'est-ce qui est mal réglé ?',
    choices: ['L\'envoi d\'effet est pré-fader : il doit être post-fader', ['Le retour d\'effet est trop bas', 'Un retour plus bas rendrait la réverbération plus discrète, mais elle resterait seule quand la voix s\'en va.'], ['Le 48 V est coupé', 'Le 48 V alimente les micros ; il n\'a rien à voir avec l\'envoi d\'effet.']], answer: 0,
    aides: ['La réverbération devrait suivre la voix.', 'Pré : avant le fader ; post : après.'],
    solution: 'L\'envoi d\'effet doit être **post-fader** : la réverbération baisse alors avec la voix.',
  },
  {
    type: 'choix', q: 'L\'équipe vidéo demande le son du concert pour son enregistreur, au bout de 30 m de câble. Que lui donnez-vous ?',
    choices: ['Une sortie ligne symétrique (XLR), principale ou AUX post-fader dédié', ['La sortie casque', 'Elle suit l\'écoute de l\'ingénieur et son PFL : elle change sans prévenir.'], ['La sortie RCA d\'enregistrement', 'Asymétrique et au niveau grand public : elle ramasse le bruit sur 30 m.']], answer: 0,
    aides: ['Une longue liaison doit rejeter le bruit qu\'elle capte.', 'Symétrique, au niveau ligne pro.'],
    solution: 'Une **sortie ligne symétrique** en XLR : la principale, ou mieux un AUX post-fader réglé pour l\'enregistrement.',
  },
];

registerExos({
  'son-console': {
    titre: 'Régler une console analogique',
    consigne: 'Avant le concert de la section son, vous réglez la console analogique : le gain du chant, le niveau à chaque étage, la marge avant l\'écrêtage.',
    gen: (rnd) => {
      const mic = -entre(rnd, 30, 56), g = -mic;
      const mic2 = -entre(rnd, 32, 50), g2 = entre(rnd, 28, 54), f2 = pick(rnd, [-6, -3, 0, 3, 5]), m2 = pick(rnd, [-4, -2, 0, 2]);
      const c2 = chaine({ entree: mic2, gain: g2, fader: f2, pan: 0, master: m2 });
      const mic3 = -entre(rnd, 34, 52), g3 = entre(rnd, 30, 58), marge = ECRETAGE - (mic3 + g3);
      return [
        {
          type: 'nombre', unite: 'dB', answer: g, tol: 0.5,
          q: `Les crêtes du micro du chanteur arrivent à **${fr(mic)} dBu**. Quel GAIN (en dB) pour les amener au **« 0 »** du vumètre, à 0 dBu ?`,
          pieges: [{ v: mic, why: 'Il faut amplifier : un gain négatif enfoncerait le micro dans le souffle.' }, { v: g + 4, why: '+4 dBu est le niveau de la sortie ligne, pas le « 0 » interne des vumètres.' }],
          aides: ['Les décibels s\'additionnent : niveau du micro + GAIN = niveau visé.', `GAIN = 0 − (${fr(mic)}).`],
          solution: `0 − (${fr(mic)}) = **+${g} dB** : les crêtes tournent autour du « 0 », avec une vingtaine de dB de marge au-dessus.`,
        },
        {
          type: 'nombre', unite: 'dBu', answer: r1(c2.master), tol: 0.6,
          q: `Un micro à **${fr(mic2)} dBu**, un GAIN de **+${g2} dB**, le fader à **${sg(f2)} dB**, le PAN **au centre** (−3 dB par voie), le master à **${sg(m2)} dB**. À combien de dBu sont les crêtes sur une voie du bus, après le master ?`,
          pieges: [{ v: r1(c2.master + 3.01), why: 'Le PAN au centre retire 3 dB à chaque voie (loi de panoramique à puissance constante).' }],
          aides: ['Additionnez les décibels d\'étage en étage.', `${fr(mic2)} + ${g2} + (${fr(f2)}) − 3 + (${fr(m2)}).`],
          solution: `${fr(mic2)} + ${g2} ${f2 < 0 ? '−' : '+'} ${Math.abs(f2)} − 3 ${m2 < 0 ? '−' : '+'} ${Math.abs(m2)} ≈ **${sg(r1(c2.master), 1)} dBu**.`,
        },
        {
          type: 'nombre', unite: 'dB', answer: r1(marge), tol: 0.5,
          q: `Le préampli de cette console écrête vers **+${ECRETAGE} dBu** (ordre de grandeur). Un micro donne **${fr(mic3)} dBu** sur ses crêtes, avec un GAIN de **+${g3} dB**. Combien de dB de marge reste-t-il avant l'écrêtage, après le préampli ?`,
          pieges: [{ v: r1(ECRETAGE + mic3 + g3), why: 'La marge est l\'écart entre le plafond et le niveau : plafond − niveau.' }].filter((p) => Math.abs(p.v - r1(marge)) > 0.5),
          aides: [`Niveau après le préampli : ${fr(mic3)} + ${g3}.`, `Marge = ${ECRETAGE} − niveau.`],
          solution: `Après le préampli : ${sg(mic3 + g3)} dBu ; marge : ${ECRETAGE} − (${sg(mic3 + g3)}) = **${fr(marge)} dB**${marge < 6 ? ' : bien trop peu, le GAIN est trop fort' : marge > 26 ? ' : beaucoup, le GAIN est peut-être trop faible' : ''}.`,
        },
        pick(rnd, CONSOLE_CAS),
      ];
    },
  },
  'son-sorties': {
    titre: 'Les sorties, les retours et le départ vers la vidéo',
    consigne: 'Pendant la balance, vous branchez les retours, l\'enregistreur et le départ vers la régie vidéo ; vous calculez les niveaux et la marge avant le larsen.',
    gen: (rnd) => {
      const L = pick(rnd, [0, 4, 6, -2, 2]), A = pick(rnd, [ALIGNEMENTS.r68, ALIGNEMENTS.r68, ALIGNEMENTS.rp155]), autre = A === ALIGNEMENTS.r68 ? ALIGNEMENTS.rp155 : ALIGNEMENTS.r68;
      const dbfs = dbfsDeDbu(L, A);
      const variante = entre(rnd, 0, 2);
      const G = entre(rnd, 6, 16), d = pick(rnd, [0.5, 1, 1.5, 2, 3]), rej = pick(rnd, [0, 6, 12, 20]);
      const B = boucle({ gainSysteme: G, distance: d, rejet: rej });
      const niv = /** @type {import('../exo.js').ExoItem[]} */ ([
        { type: 'nombre', unite: 'V', answer: Math.round(vDeDbu(4) * 1000) / 1000, tol: 0.01, q: 'Quelle tension efficace correspond au niveau ligne professionnel, **+4 dBu** ? (0 dBu = 0,775 V)', aides: ['Une tension en dBu : V = 0,775 × 10^(dBu ÷ 20).', '0,775 × 10^(4 ÷ 20).'], solution: '0,775 × 10^0,2 ≈ **1,23 V** efficaces.', pieges: [{ v: 0.775 * 4, why: 'Les décibels ne se multiplient pas : il faut passer par la puissance de 10.' }] },
        { type: 'nombre', unite: 'dB', answer: Math.round(ECART_PRO_GP * 10) / 10, tol: 0.2, q: 'Un enregistreur grand public, prévu pour **−10 dBV**, est branché sur une sortie à **+4 dBu**. De combien de dB est-il attaqué trop fort ? (0 dBV = 1 V, 0 dBu = 0,775 V)', aides: ['Ramenez les deux niveaux dans la même unité : −10 dBV en dBu.', '−10 dBV = −10 + 20 log₁₀(1 ÷ 0,775) ≈ −7,8 dBu.'], solution: '−10 dBV ≈ −7,8 dBu ; +4 − (−7,8) ≈ **11,8 dB** trop fort : il sature.', pieges: [{ v: 14, why: 'dBu et dBV n\'ont pas la même référence : il faut convertir avant de soustraire.' }] },
        { type: 'nombre', unite: 'dBu', answer: Math.round(dbuDeDbv(-10) * 10) / 10, tol: 0.1, q: 'Combien de dBu fait le niveau grand public, **−10 dBV** ? (0 dBV = 1 V, 0 dBu = 0,775 V)', aides: ['Le dBV est 20 log₁₀(1 ÷ 0,775) dB au-dessus du dBu.', '−10 + 2,2.'], solution: '−10 + 20 log₁₀(1 ÷ 0,775) ≈ **−7,8 dBu**.', pieges: [{ v: -12.2, why: 'C\'est dans l\'autre sens : un volt est au-dessus de 0,775 V, le dBV est plus haut que le dBu.' }] },
      ])[variante];
      return [
        {
          type: 'nombre', unite: 'dBFS', answer: dbfs,
          q: `La console envoie son 1 kHz d'alignement à **${sg(L)} dBu** vers la régie vidéo, alignée selon **${A.nom}** (${sg(A.dbu)} dBu = ${fr(A.dbfs)} dBFS). À combien de dBFS arrive-t-il ?`,
          pieges: [{ v: dbfsDeDbu(L, autre), why: `C'est l'alignement ${autre.nom}, pas celui de la régie.` }].filter((p) => p.v !== dbfs),
          aides: ['Chaque dBu au-dessus du niveau d\'alignement est un dBFS au-dessus.', `dBFS = ${fr(A.dbfs)} + (${sg(L)} − ${sg(A.dbu)}).`],
          solution: `${fr(A.dbfs)} + (${sg(L)} − ${sg(A.dbu)}) = **${fr(dbfs)} dBFS**${dbfs === A.dbfs ? ' : aligné' : ` : ${Math.abs(dbfs - A.dbfs)} dB ${dbfs > A.dbfs ? 'trop haut' : 'trop bas'}, on corrige à l'entrée`}.`,
        },
        niv,
        {
          type: 'nombre', unite: 'dB', answer: r1(B.marge), tol: 0.3,
          q: `Modèle simplifié du larsen : le système rend à 1 m du retour **${G} dB** de plus que ce que capte le micro. Le micro est à **${fr(d, d % 1 ? 1 : 0)} m** du retour, qui arrive **${rej ? `${rej} dB` : 'sans être'} atténué** par la directivité du micro. Quelle marge avant le larsen (en dB ; négative s'il accroche) ?`,
          pieges: [{ v: r1(-(G - rej)), why: 'Il faut aussi compter la distance : 20 log₁₀ de la distance en mètres.' }, { v: r1(-(G - 10 * Math.log10(d) - rej)), why: 'En pression acoustique, la perte avec la distance vaut 20 log₁₀ d, pas 10 log₁₀ d.' }].filter((p) => Math.abs(p.v - r1(B.marge)) > 0.3),
          aides: ['Gain de boucle = gain du système − perte avec la distance − rejet du micro.', `Gain de boucle = ${G} − 20 log₁₀(${fr(d, 1)}) − ${rej} ; la marge est son opposé.`],
          solution: `Gain de boucle : ${G} − ${fr(20 * Math.log10(d), 1)} − ${rej} = ${fr(B.gain, 1)} dB ; marge **${fr(B.marge, 1)} dB**${B.larsen ? ' : ça accroche, il faut éloigner ou tourner le retour, ou baisser l\'AUX' : ''}.`,
        },
        pick(rnd, SORTIES_CAS),
      ];
    },
  },
  'son-numerique': {
    titre: 'Échantillonner, quantifier, aligner, transporter',
    consigne: 'Vous préparez la liaison numérique entre la console de la section son et le car : fréquence d\'échantillonnage, résolution, alignement et câbles.',
    gen: (rnd) => {
      const fs = pick(rnd, [44100, 48000, 96000]);
      const f = fs === 96000 ? pick(rnd, [52000, 60000, 70000, 85000]) : pick(rnd, [26000, 30000, 34000, 38000, 42000, 46000]);
      const fa = repliement(f, fs);
      const n = pick(rnd, [12, 16, 20, 24]), dyn = Math.round(dynamique(n) * 10) / 10;
      const A = pick(rnd, [ALIGNEMENTS.r68, ALIGNEMENTS.rp155]), x = -entre(rnd, 0, 30), dbu = dbuDeDbfs(x, A), autre = A === ALIGNEMENTS.r68 ? ALIGNEMENTS.rp155 : ALIGNEMENTS.r68;
      const N = pick(rnd, [24, 32, 48, 64, 96, 128]), fs2 = pick(rnd, [48000, 96000]), lien = canauxMadi(fs2);
      const quoi = entre(rnd, 0, 2);
      const transport = /** @type {import('../exo.js').ExoItem[]} */ ([
        { type: 'nombre', answer: Math.ceil(N / 2), q: `Combien de liaisons **AES3** pour transporter **${N} canaux** ?`, aides: ['Une liaison AES3 porte une paire.', `${N} ÷ 2, arrondi au-dessus.`], solution: `Deux canaux par liaison : **${Math.ceil(N / 2)}** câbles AES3. Un seul MADI (64 canaux à 48 kHz) les remplacerait${N > 64 ? ' presque' : ''}.`, pieges: [{ v: N, why: 'Une liaison AES3 porte deux canaux, pas un.' }] },
        { type: 'nombre', answer: Math.ceil(N / lien), q: `Combien de liens **MADI** pour **${N} canaux** à **${fs2 / 1000} kHz** ? (64 canaux à 48 kHz, 32 à 96 kHz)`, aides: [`À ${fs2 / 1000} kHz, un lien MADI porte ${lien} canaux.`, `${N} ÷ ${lien}, arrondi au-dessus.`], solution: `${lien} canaux par lien à ${fs2 / 1000} kHz : **${Math.ceil(N / lien)}** lien${Math.ceil(N / lien) > 1 ? 's' : ''}.`, pieges: [{ v: Math.ceil(N / 64), why: `À ${fs2 / 1000} kHz, un lien MADI ne porte que ${lien} canaux.` }].filter((p) => p.v !== Math.ceil(N / lien)) },
        { type: 'nombre', unite: 'Mb/s', answer: Math.round(N * fs2 * 24 / 1e4) / 100, tol: 0.05, q: `Quel débit brut (en Mb/s) font **${N} canaux** à **${fs2 / 1000} kHz** sur **24 bits** ?`, aides: ['Débit = canaux × échantillons par seconde × bits par échantillon.', `${N} × ${fs2} × 24, en millions.`], solution: `${N} × ${fs2} × 24 = **${frn(N * fs2 * 24 / 1e6, 2)} Mb/s** (sans les en-têtes ni les bits d'état).`, pieges: [{ v: Math.round(N * fs2 * 16 / 1e4) / 100, why: 'Le broadcast travaille sur 24 bits, pas 16.' }] },
      ])[quoi];
      return [
        {
          type: 'nombre', unite: 'Hz', answer: fa,
          q: `Un sifflement à **${frn(f)} Hz** entre dans un convertisseur à **${frn(fs)} Hz** sans filtre anti-repliement. À quelle fréquence l'entend-on ?`,
          pieges: [{ v: f, why: `Au-delà de ${frn(fs / 2)} Hz (fs ÷ 2), une fréquence ne peut pas être rendue telle quelle : elle se replie.` }, { v: fs / 2, why: 'La fréquence de Nyquist est la limite, pas la fréquence entendue.' }].filter((p) => p.v !== fa),
          aides: [`La limite est fs ÷ 2 = ${frn(fs / 2)} Hz : au-dessus, la fréquence revient plus bas.`, 'Fréquence entendue = |f − k × fs|, avec k l\'entier le plus proche de f ÷ fs.'],
          solution: `|${frn(f)} − ${frn(Math.round(f / fs) * fs)}| = **${frn(fa)} Hz** : un son qui n'existait pas. Le filtre anti-repliement l'aurait coupé.`,
        },
        {
          type: 'nombre', unite: 'dB', answer: dyn, tol: 0.3,
          q: `Quelle dynamique théorique donne une quantification sur **${n} bits** ?`,
          pieges: [{ v: 6 * n, why: 'C\'est la règle approchée (6 dB par bit) ; la formule exacte ajoute 1,76 dB et compte 6,02 dB par bit.' }, { v: n, why: 'Chaque bit vaut environ 6 dB, pas 1.' }],
          aides: ['Chaque bit double le nombre de valeurs : environ 6 dB.', `6,02 × ${n} + 1,76.`],
          solution: `6,02 × ${n} + 1,76 = **${frn(dyn, 1)} dB** (théorique ; un vrai convertisseur fait moins).`,
        },
        {
          type: 'nombre', unite: 'dBu', answer: dbu,
          q: `Selon **${A.nom}** (${sg(A.dbu)} dBu = ${fr(A.dbfs)} dBFS), à quelle tension (en dBu) sort un signal à **${fr(x)} dBFS** ?`,
          pieges: [{ v: dbuDeDbfs(x, autre), why: `C'est l'alignement ${autre.nom}.` }].filter((p) => p.v !== dbu),
          aides: ['Un dB de plus en numérique est un dB de plus en analogique.', `dBu = ${sg(A.dbu)} + (${fr(x)} − (${fr(A.dbfs)})).`],
          solution: `${sg(A.dbu)} + (${fr(x)} + ${-A.dbfs}) = **${sg(dbu)} dBu**${x === 0 ? ' : la pleine échelle' : ''}.`,
        },
        transport,
      ];
    },
  },
  'son-loudness': {
    titre: 'Mesurer et corriger la loudness',
    consigne: 'Au poste son, vous mesurez des programmes en loudness et vous les rendez conformes à l\'EBU R128.',
    gen: (rnd) => {
      const I = -entre(rnd, 190, 270) / 10, corr = r1(-23 - I);
      const a = entre(rnd, 10, 40), b = entre(rnd, 10, 40), l1 = -entre(rnd, 20, 27), l2 = l1 + pick(rnd, [-6, -4, 3, 5, 7]);
      const Iab = r1(integree(blocs(sousBlocs([{ duree: a, lufs: l1 }, { duree: b, lufs: l2 }]))).I);
      const naif = r1((a * l1 + b * l2) / (a + b));
      // trois cas : conforme, loudness hors tolérance, crête vraie trop haute (une seule faute à la fois)
      const direct = rnd() < 0.5, tol = direct ? R128.tolDirect : R128.tol, cas = entre(rnd, 0, 2), sgn = rnd() < 0.5 ? -1 : 1;
      const Ic = r1(R128.cible + (cas === 1 ? sgn * (tol + entre(rnd, 3, 25) / 10) : sgn * entre(rnd, 0, Math.round(tol * 10)) / 10));
      const cr = cas === 2 ? -entre(rnd, 0, 8) / 10 + 0.3 * (rnd() < 0.3 ? 1 : 0) : -entre(rnd, 12, 40) / 10;
      const C = conformeR128(Ic, cr, direct);
      const verdicts = ['Conforme', 'Hors tolérance : loudness', 'Crête vraie trop haute'];
      const juste = !C.loudness ? 1 : !C.crete ? 2 : 0;
      return [
        {
          type: 'nombre', unite: 'dB', answer: corr, tol: 0.1,
          q: `Un sujet enregistré mesure **${fr(I, 1)} LUFS** intégrés. Quel gain (en dB) lui appliquer pour le ramener à la cible de l'EBU R128 ?`,
          pieges: [{ v: r1(I + 23), why: 'Le signe est inversé : un programme trop fort se baisse.' }].filter((p) => Math.abs(p.v - corr) > 0.1),
          aides: ['Cible R128 : −23 LUFS ; 1 LU = 1 dB.', `Gain = −23 − (${fr(I, 1)}).`],
          solution: `−23 − (${fr(I, 1)}) = **${sg(corr, 1)} dB**, puis on vérifie que les crêtes vraies restent sous −1 dBTP.`,
        },
        {
          type: 'nombre', unite: 'LUFS', answer: Iab, tol: 0.3,
          q: `Un programme : **${a} s** à **${fr(l1)} LUFS**, puis **${b} s** à **${fr(l2)} LUFS** (aucun passage sous les portes). Quelle est sa loudness intégrée ?`,
          pieges: [{ v: naif, why: 'La loudness se moyenne en énergie, pas en décibels : le passage le plus fort pèse plus que sa durée.' }].filter((p) => Math.abs(p.v - Iab) > 0.3),
          aides: ['Moyenne en énergie, pondérée par la durée : 10 log₁₀ de la moyenne des 10^(L ÷ 10).', `10 log₁₀((${a} × 10^(${fr(l1)} ÷ 10) + ${b} × 10^(${fr(l2)} ÷ 10)) ÷ ${a + b}).`],
          solution: `10 log₁₀((${a} × 10^(${fr(l1 / 10, 1)}) + ${b} × 10^(${fr(l2 / 10, 1)})) ÷ ${a + b}) ≈ **${fr(Iab, 1)} LUFS** (la moyenne des dB aurait donné ${fr(naif, 1)}).`,
        },
        {
          type: 'choix', q: `Un programme ${direct ? 'en direct' : 'enregistré'} mesure **${fr(Ic, 1)} LUFS** intégrés et une crête vraie de **${fr(cr, 1)} dBTP**. Selon l'EBU R128…`,
          choices: verdicts.map((t, k) => (k === juste ? t : [t, `Tolérance ${direct ? '±1 LU en direct' : '±0,5 LU'} autour de −23 LUFS, crête vraie sous −1 dBTP : ${fr(Ic, 1)} LUFS est ${C.loudness ? 'dedans' : 'dehors'}, ${fr(cr, 1)} dBTP ${C.crete ? 'aussi' : 'dépasse'}.`])), answer: juste,
          aides: [`La tolérance de la loudness : ${direct ? '±1 LU pour un direct' : '±0,5 LU pour un programme enregistré'}.`, 'La crête vraie ne doit pas dépasser −1 dBTP.'],
          solution: `**${verdicts[juste]}** : ${fr(Ic, 1)} LUFS ${C.loudness ? 'tient' : 'ne tient pas'} la tolérance de ±${direct ? '1' : '0,5'} LU, et ${fr(cr, 1)} dBTP ${C.crete ? 'reste sous' : 'dépasse'} −1 dBTP.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le match se termine par 30 s de générique silencieux. Que devient la loudness intégrée ?',
            choices: ['Elle ne bouge pas : la porte absolue écarte les blocs sous −70 LUFS', ['Elle baisse, le silence comptant dans la moyenne', 'Les silences sont écartés avant la moyenne : c\'est le rôle de la porte absolue.'], ['Elle monte', 'Un silence n\'ajoute aucune énergie et n\'est pas compté.']], answer: 0,
            aides: ['BS.1770 écarte d\'abord certains blocs.', `La porte absolue est à ${R128.porteAbs} LUFS.`],
            solution: 'Elle **ne bouge pas** : les blocs silencieux tombent sous la porte absolue (−70 LUFS).',
          },
          {
            type: 'choix', q: 'En plein direct, quelle mesure suivez-vous pour tenir le niveau du programme ?',
            choices: ['Le court terme (3 s), avec l\'intégrée depuis le début', ['La momentanée seule (400 ms)', 'Elle saute à chaque mot ou tir ; elle sert à repérer un pic.'], ['La crête des échantillons', 'La crête ne dit rien du volume perçu : un son compressé paraît plus fort à crête égale.']], answer: 0,
            aides: ['Une fenêtre assez courte pour corriger, assez longue pour ne pas sauter.', 'Trois fenêtres : 400 ms, 3 s, tout le programme.'],
            solution: 'Le **court terme** (3 s) pour mixer, l\'**intégrée** pour la cible sur la durée.',
          },
          {
            type: 'choix', q: 'Le line-up envoie un 1 kHz à −18 dBFS sur les deux voies. Combien mesure-t-il en loudness ?',
            choices: ['−18 LUFS, 5 LU au-dessus de la cible d\'un programme', ['−23 LUFS', 'C\'est la cible d\'un programme, pas la mesure du signal de line-up.'], ['−21 LUFS', 'Ce serait vrai pour une seule voie (3 dB de moins) ; ici les deux voies le portent.']], answer: 0,
            aides: ['La loudness d\'un 1 kHz est calée sur son niveau numérique, pour deux voies.', 'BS.1770 : un 1 kHz à 0 dBFS sur les deux voies donne 0 LUFS.'],
            solution: '**−18 LUFS** : le signal de line-up n\'est pas un programme, il est 5 LU au-dessus de −23.',
          },
        ]),
      ];
    },
  },
  'son-dante': {
    titre: 'Dimensionner un réseau Dante',
    consigne: 'La section son arrive avec un boîtier de scène Dante : vous calculez les débits, les flux, le temps de passage d\'un paquet, et vous réglez le réseau.',
    gen: (rnd) => {
      const N = pick(rnd, [8, 16, 24, 32, 48, 64]), deb = Math.round(N * canalUtile() / 1e4) / 100;
      const n2 = pick(rnd, [8, 12, 16, 20, 32]), R = entre(rnd, 2, 4), nf = fluxPour(n2) * R;
      const oct = pick(rnd, [366, 654, 1230]), lien = pick(rnd, [100, 1000]), ser = Math.round(oct * 8 / lien * 100) / 100;
      return [
        {
          type: 'nombre', unite: 'Mb/s', answer: deb, tol: 0.05,
          q: `Quel débit utile (sans les en-têtes) font **${N} canaux** Dante à **48 kHz** sur **24 bits** ?`,
          pieges: [{ v: Math.round(N * 48000 * 16 / 1e4) / 100, why: 'Dante transporte ici des échantillons de 24 bits, pas 16.' }, { v: Math.round(N * 48000 * 32 / 1e4) / 100, why: '24 bits par échantillon, pas 32.' }],
          aides: ['Un canal : 48 000 échantillons de 24 bits par seconde.', `${N} × 1,152 Mb/s.`],
          solution: `${N} × 48 000 × 24 = **${frn(deb, 2)} Mb/s** utiles ; avec les en-têtes, un peu plus sur le fil.`,
        },
        {
          type: 'nombre', answer: nf,
          q: `Un boîtier envoie **${n2} canaux** à **${R} récepteurs**, en **unicast**, par flux de **4 canaux** au plus. Combien de flux part-il du boîtier ?`,
          pieges: [{ v: fluxPour(n2), why: 'Ce serait en multicast : en unicast, chaque récepteur reçoit sa copie.' }, { v: R, why: 'Un flux ne porte que 4 canaux : il en faut plusieurs par récepteur.' }].filter((p) => p.v !== nf),
          aides: ['Flux par récepteur : canaux ÷ 4, arrondi au-dessus.', `En unicast, × ${R} récepteurs.`],
          solution: `${Math.ceil(n2 / 4)} flux par récepteur × ${R} = **${nf} flux** ; en multicast, ${fluxPour(n2)} suffiraient.`,
        },
        {
          type: 'nombre', unite: 'µs', answer: ser, tol: 0.02 * ser,
          q: `Combien de temps faut-il pour émettre un paquet de **${frn(oct)} octets** sur un lien à **${lien === 1000 ? '1 Gb/s' : '100 Mb/s'}** (sa sérialisation) ?`,
          pieges: [{ v: Math.round(oct / lien * 100) / 100, why: 'Un octet fait 8 bits.' }],
          aides: ['Temps = bits ÷ débit.', `${frn(oct)} × 8 bits ÷ ${lien} Mb/s donne des microsecondes.`],
          solution: `${frn(oct)} × 8 ÷ ${lien} = **${frn(ser, 2)} µs** à chaque commutateur traversé${lien === 100 ? ' : dix fois plus qu\'en Gigabit' : ''}.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'En passant au multicast, tous les ports du commutateur se chargent du même flux. Que manque-t-il ?',
            choices: ['L\'IGMP snooping sur le commutateur', ['Un Preferred Leader', 'Le leader règle l\'horloge, pas la distribution des flux.'], ['Une latence plus longue', 'La latence ne décide pas des ports où sort un flux.']], answer: 0,
            aides: ['Sans lui, le commutateur traite le multicast comme une diffusion.', 'Il lit les abonnements des récepteurs.'],
            solution: 'L\'**IGMP snooping** : le commutateur ne recopie le flux que vers les ports abonnés.',
          },
          {
            type: 'choix', q: 'Les appareils Dante perdent par moments leur horloge sur un commutateur de bureau. Quel réglage du commutateur couper d\'abord ?',
            choices: ['L\'EEE, l\'Ethernet économe en énergie', ['La QoS', 'La QoS aide au contraire l\'horloge à passer devant le reste.'], ['L\'IGMP snooping', 'Il règle la distribution du multicast, pas l\'horloge.']], answer: 0,
            aides: ['Un réglage qui endort les ports entre deux paquets.', 'Les messages PTP en arrivent irréguliers.'],
            solution: 'L\'**EEE** : en endormant les ports, il retarde irrégulièrement les messages PTP et dérègle l\'horloge.',
          },
          {
            type: 'choix', q: 'Comment caler le réseau Dante sur la synchro vidéo du car ?',
            choices: ['Un appareil Dante reçoit le word clock du SPG (Sync to External) et devient le leader', ['Régler la même latence sur tous les appareils', 'La latence décide quand le son sort, pas à quel rythme il est échantillonné.'], ['Brancher le SPG sur le commutateur', 'Un SPG vidéo ne parle pas l\'horloge Dante ; il faut un appareil Dante avec une entrée word clock.']], answer: 0,
            aides: ['L\'horloge du réseau vient d\'un leader élu.', 'Ce leader peut prendre une horloge extérieure.'],
            solution: 'L\'appareil qui reçoit le **word clock** (Sync to External), élu **leader** (Preferred Leader), donne cette horloge à tout le réseau.',
          },
          {
            type: 'choix', q: 'Quelle QoS donner au trafic Dante selon Audinate ?',
            choices: ['DSCP 56 (CS7) pour le PTP, 46 (EF) pour l\'audio', ['DSCP 0 pour tout', 'Le « au mieux » : l\'audio attendrait derrière les copies de fichiers.'], ['DSCP 46 pour le PTP, 0 pour l\'audio', 'L\'audio sans priorité attendrait derrière le reste ; Audinate place le PTP en 56.']], answer: 0,
            aides: ['L\'horloge passe en premier, l\'audio ensuite.', 'Deux classes : CS7 et EF.'],
            solution: '**DSCP 56 (CS7)** pour les messages PTP qui datent, **46 (EF)** pour l\'audio, en priorité stricte.',
          },
        ]),
      ];
    },
  },
});
