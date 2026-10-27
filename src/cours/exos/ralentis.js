// @ts-check
import { registerExos, entre, pick, fr } from '../exo.js';
import { goParHeure, profondeur, tailleGo, transfert } from '../ralentis_fichiers.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « Les ralentis » : la durée d'une action à l'antenne ((OUT − IN) ÷
// vitesse) et la vitesse à choisir, les images répétées selon la cadence de la caméra (sortie du serveur
// en 1080p50), les entrées d'enregistrement occupées par une caméra 3×, la durée d'une playlist
// (somme des durées lues − recouvrements des mix de 25 images, 0,5 s en 1080p50) et le nom d'un clip
// sur la télécommande LSM. Chiffres des leçons (cours/ralentis.js).
// ----------------------------------------------------------------------------------
/** les vitesses du levier ; 33 % est exactement un tiers */
const VITESSES = [{ v: 1, t: '100 %' }, { v: 0.5, t: '50 %' }, { v: 1 / 3, t: '33 %' }, { v: 0.25, t: '25 %' }];
const CADENCES = [
  { cam: 'une caméra normale (50 images/s)', ips: 50, v: 0.5, t: '50 %' },
  { cam: 'une caméra normale (50 images/s)', ips: 50, v: 0.25, t: '25 %' },
  { cam: 'une caméra super ralenti 3× (150 images/s)', ips: 150, v: 1 / 3, t: '33 %' },
  { cam: 'une caméra super ralenti 3× (150 images/s)', ips: 150, v: 1 / 6, t: '17 % (un sixième)' },
  { cam: 'une caméra super ralenti 6× (300 images/s)', ips: 300, v: 1 / 6, t: '17 % (un sixième)' },
];
const EVS = [
  {
    type: 'choix', q: 'En plein match, un stagiaire veut « libérer le serveur » en arrêtant l\'enregistrement de la CAM 2. Que lui répondez-vous ?',
    choices: ['Jamais : rien de ce qui se passe ensuite sur cette caméra ne pourra être rejoué', ['D\'accord, la boucle reprendra seule', 'L\'enregistrement ne repart pas tout seul : tant qu\'il est arrêté, rien n\'est gardé.'], ['D\'accord, les autres trains gardent la CAM 2', 'Chaque train enregistre sa propre entrée : les autres ne gardent pas la CAM 2.']], answer: 0,
    aides: ['Que devient une action qui a lieu pendant que le train ne tourne pas ?', 'C\'est la pire erreur du poste.'],
    solution: '**Jamais** : arrêter l\'enregistrement est la pire erreur du poste, rien de ce qui suit ne pourra être rejoué.',
  },
  {
    type: 'choix', q: 'Pourquoi l\'opérateur pose-t-il son IN quelques secondes avant l\'action ?',
    choices: ['Pour que le ralenti parte avec de l\'élan, en montrant la préparation du geste', ['Pour protéger les images de l\'écrasement', 'C\'est le clip qui protège de l\'écrasement, pas la place de l\'IN.'], ['Parce que le serveur a un retard de quelques secondes', 'Tous les trains portent le timecode du car : l\'IN se pose à l\'image près.']], answer: 0,
    aides: ['Pensez à ce que voit le téléspectateur au début du ralenti.', 'Un ralenti qui commence sur le tir n\'a pas d\'élan.'],
    solution: 'Pour l\'**élan** : le ralenti montre la préparation du geste avant l\'action.',
  },
  {
    type: 'choix', q: 'L\'opérateur passe de l\'angle de la CAM 3 à celui de la CAM 7 sur la même action, à l\'image près. Qu\'est-ce qui le permet ?',
    choices: ['Tous les trains portent le même timecode, celui du générateur de synchro', ['La télécommande recale les images à l\'œil', 'Personne ne recale à l\'œil : c\'est le timecode commun qui fait correspondre les angles.'], ['Les deux caméras sont enregistrées sur le même train', 'Chaque entrée a son train ; ils partagent seulement le même timecode.']], answer: 0,
    aides: ['Que partagent tous les trains du serveur ?', 'Le serveur reçoit le timecode du car en LTC.'],
    solution: 'Le **timecode commun** (LTC du générateur de synchro) : chaque angle est disponible au même instant du match.',
  },
];
const CLIPS = [
  {
    type: 'choix', q: 'Le logueur a noté un clip « frappe » ; en fin de mi-temps, la recherche demande « TIR ». Que se passe-t-il ?',
    choices: ['Le clip n\'est pas trouvé : le vocabulaire doit être fixé avant le match', ['IPDirector le trouve : il comprend les synonymes', 'La recherche se fait sur les mots-clés : « frappe » n\'est pas « TIR ».'], ['La LSM le retrouve sur sa touche F', 'Encore faut-il savoir sur quelle touche il est : c\'est justement le rôle de la recherche.']], answer: 0,
    aides: ['La recherche compare les mots-clés tels qu\'ils ont été écrits.', 'D\'où l\'importance d\'un vocabulaire décidé à l\'avance.'],
    solution: 'Le clip est **perdu pour la recherche** : le vocabulaire (BUT, TIR, ARRÊT, CARTON) se fixe avant le match.',
  },
  {
    type: 'choix', q: 'Le réalisateur veut le clip 112 vu par l\'angle A, alors qu\'il a été créé sur l\'angle C. Que fait l\'opérateur ?',
    choices: ['Il rappelle 112A : le clip garde tous les angles entre son IN et son OUT', ['Il crée un nouveau clip sur le train A', 'Inutile : le clip protège déjà tous les angles enregistrés.'], ['C\'est impossible', 'Un clip est un IN et un OUT posés sur les trains : tous les angles sont gardés.']], answer: 0,
    aides: ['Qu\'est-ce qu\'un clip garde, entre son IN et son OUT ?', 'La lettre du nom désigne l\'angle.'],
    solution: 'Il rappelle **112A** : la lettre est l\'angle, et le clip les garde tous.',
  },
  {
    type: 'choix', q: 'La playlist du résumé dure 21 s ; le producteur en veut 15. Quel réglage la raccourcit le plus ?',
    choices: ['Relire à 100 % le clip en super ralenti relu à 33 %', ['Remplacer les mix par des coupes', 'Une coupe ne recouvre rien : sans mix, la playlist s\'allonge des recouvrements.'], ['Passer un clip large de 100 % à 50 %', 'Ralentir un clip l\'allonge : sa durée lue double.']], answer: 0,
    aides: ['Durée = somme des (durée du clip ÷ vitesse) − recouvrements.', 'Quel clip pèse le plus à cause de sa vitesse ?'],
    solution: 'Relire le **super ralenti à 100 %** : à 33 %, il dure trois fois sa longueur ; c\'est le clip le plus ralenti qui pèse le plus.',
  },
];

// ---------------- stocker, échanger, archiver (cours/ralentis_fichiers.js) ----------------
const FICHIERS_SITU = [
  {
    type: 'choix', q: 'En pleine deuxième mi-temps, le serveur annonce une boucle de 40 minutes. Que faites-vous en priorité ?',
    choices: ['Exporter puis libérer les clips protégés déjà diffusés, pour rendre de la place', ['Protéger les trains entiers de la première mi-temps', 'Protéger prend encore de la place : la boucle raccourcirait davantage.'], ['Couper l\'enregistrement d\'une caméra principale', 'On perdrait les angles les plus utiles ; on commence par libérer ce qui a déjà servi.']], answer: 0,
    aides: ['Qu\'est-ce qui réduit la place libre sans être utile maintenant ?', 'Un clip protégé déjà exporté peut quitter le serveur.'],
    solution: '**Exporter puis libérer** les clips déjà utilisés : la place libre remonte, et la boucle avec elle.',
  },
  {
    type: 'choix', q: 'Le studio veut le but tout de suite pour son plateau. Le clip est sur le serveur du car. Comment le lui envoyer ?',
    choices: ['En fichier, par le réseau, avec ses métadonnées', ['En le relisant à l\'antenne pour que le studio l\'enregistre', 'Le studio en recevrait une copie de l\'antenne, avec l\'habillage, au temps réel ; un fichier va plus vite et garde la qualité du serveur.'], ['En retirant un disque du serveur', 'Les disques du serveur ne se retirent pas en plein direct : le transfert passe par le réseau.']], answer: 0,
    aides: ['Le réseau du car va bien plus vite que le temps réel.', 'Ce qui suit le clip : son nom, ses mots-clés, son timecode.'],
    solution: 'En **fichier par le réseau** (MXF ou QuickTime selon la demande), avec ses métadonnées : plus vite que le temps réel, sans perte.',
  },
];

registerExos({
  'ralentis-evs': {
    titre: 'Caler un ralenti',
    consigne: 'Au poste Ralentis : le réalisateur vous donne un temps d\'antenne ; vous choisissez la vitesse, vous dites si le geste sera fluide et combien d\'entrées il vous faut.',
    gen: (rnd) => {
      const d = entre(rnd, 4, 12) / 2, V = pick(rnd, VITESSES), duree = d / V.v;
      const [D, T] = pick(rnd, [[4, 8], [3, 12], [4, 12], [5, 10], [2, 8], [3, 6], [5, 20]]);
      const C = pick(rnd, CADENCES), rep = Math.round(50 / (C.ips * C.v));
      const E = pick(rnd, [6, 8]), k = pick(rnd, [1, 2]), reste = E - 3 * k;
      return [
        {
          type: 'nombre', unite: 's', answer: Math.round(duree * 100) / 100, tol: 0.06,
          q: `L'action dure **${fr(d, 1)} s** entre l'IN et l'OUT. L'opérateur la relit à **${V.t}**${V.v === 1 / 3 ? ' (un tiers)' : ''}. Combien de temps dure-t-elle à l'antenne ?`,
          pieges: [{ v: Math.round(d * V.v * 100) / 100, why: 'La vitesse divise la durée, elle ne la multiplie pas : plus lent, c\'est plus long.' }].filter((p) => Math.abs(p.v - duree) > 0.06),
          aides: ['Durée à l\'antenne = (OUT − IN) ÷ vitesse.', `${fr(d, 1)} ÷ ${V.v === 1 / 3 ? '(1/3)' : fr(V.v, 2)}.`],
          solution: `${fr(d, 1)} ÷ ${V.v === 1 / 3 ? '(1/3)' : fr(V.v, 2)} = **${fr(duree, 1)} s**.`,
        },
        {
          type: 'nombre', unite: '%', answer: Math.round(D / T * 1000) / 10, tol: 1,
          q: `Le réalisateur donne **${T} s** d'antenne pour une action de **${D} s**. À quelle vitesse poussez-vous le levier, en pour cent ?`,
          pieges: [{ v: Math.round(T / D * 1000) / 10, why: 'C\'est le rapport inverse : la vitesse est la durée de l\'action divisée par le temps d\'antenne.' }],
          aides: ['Partez de la formule : durée à l\'antenne = durée de l\'action ÷ vitesse.', `Vitesse = ${D} ÷ ${T}.`],
          solution: `${D} ÷ ${T} = **${fr(D / T * 100, D * 3 === T ? 0 : 1)} %**${D * 3 === T ? ' (un tiers : la vitesse idéale d\'une caméra 3×)' : ''}.`,
        },
        {
          type: 'nombre', answer: rep,
          q: `La sortie du serveur donne 50 images par seconde (1080p50). Vous relisez ${C.cam} à **${C.t}**. Combien de fois chaque image enregistrée est-elle montrée ?`,
          aides: ['Comptez combien d\'images enregistrées sont lues par seconde à cette vitesse.', `${C.ips} × ${C.v === 1 / 3 ? '1/3' : C.v === 1 / 6 ? '1/6' : fr(C.v, 2)} images différentes par seconde, pour 50 images en sortie.`],
          solution: `${fr(C.ips * C.v, 1)} images différentes par seconde pour 50 en sortie : chaque image est montrée **${rep} fois**. ${rep === 1 ? 'Le geste est parfaitement fluide.' : 'Le mouvement avance par à-coups : il faudrait une caméra plus rapide.'}`,
        },
        pick(rnd, [{
          type: 'nombre', answer: reste,
          q: `Le serveur a **${E} entrées** d'enregistrement. Vous y mettez **${k} caméra${k > 1 ? 's' : ''} super ralenti 3×**. Combien de caméras normales pouvez-vous encore enregistrer ?`,
          pieges: [{ v: E - k, why: 'Une caméra 3× sort ses 150 images/s sur trois liaisons (phases A, B, C) : elle occupe trois entrées.' }],
          aides: ['Combien de liaisons à 50 images/s une caméra 3× demande-t-elle ?', `Chaque caméra 3× prend 3 entrées : ${E} − 3 × ${k}.`],
          solution: `${E} − ${3 * k} = **${reste}**${reste === 0 ? ' : les caméras 3× prennent tout' : ''}.`,
        }, ...EVS]),
      ];
    },
  },
  'ralentis-clips': {
    titre: 'Monter le résumé de la mi-temps',
    consigne: 'Au poste IPDirector et à la LSM : vous nommez les clips, vous calculez la durée de la playlist et vous l\'ajustez au temps demandé.',
    gen: (rnd) => {
      const n = entre(rnd, 2, 4);
      const clips = Array.from({ length: n }, () => ({ d: entre(rnd, 20, 70) / 10, V: pick(rnd, VITESSES.slice(0, 3)) }));
      const trans = Array.from({ length: n - 1 }, () => pick(rnd, [{ t: 'un mix de 25 images', s: 0.5 }, { t: 'une coupe', s: 0 }]));
      const lu = clips.reduce((s, c) => s + c.d / c.V.v, 0), rec = trans.reduce((s, t) => s + t.s, 0), tot = lu - rec;
      const P = entre(rnd, 1, 3), B = entre(rnd, 1, 3), F = entre(rnd, 1, 9), A = pick(rnd, ['A', 'B', 'C', 'D']);
      const nom = `${P}${B}${F}${A}`;
      return [
        {
          type: 'nombre', unite: 's', answer: Math.round(tot * 100) / 100, tol: 0.06,
          q: `Playlist en 1080p50 : ${clips.map((c, k) => `clip ${k + 1} de **${fr(c.d, 1)} s à ${c.V.t}**`).join(', ')} ; ${trans.map((t, k) => `entre ${k + 1} et ${k + 2}, ${t.t}`).join(' ; ')}. Combien dure-t-elle à l'antenne ?`,
          pieges: [{ v: Math.round(lu * 100) / 100, why: 'Un mix recouvre la fin d\'un clip et le début du suivant : retirez la durée de chaque mix (25 images = 0,5 s).' }, { v: Math.round((clips.reduce((s, c) => s + c.d, 0) - rec) * 100) / 100, why: 'Chaque clip dure sa longueur divisée par sa vitesse : un clip à 33 % dure trois fois plus.' }].filter((p) => Math.abs(p.v - tot) > 0.06),
          aides: ['Durée = somme des (durée du clip ÷ vitesse) − somme des durées de transition.', `Clips lus : ${clips.map((c) => `${fr(c.d, 1)} ÷ ${c.V.v === 1 / 3 ? '(1/3)' : fr(c.V.v, 1)}`).join(' + ')} ; un mix de 25 images vaut 0,5 s en 1080p50.`],
          solution: `${clips.map((c) => fr(c.d / c.V.v, 1)).join(' + ')}${rec ? ` − ${fr(rec, 1)}` : ''} = **${fr(tot, 1)} s**.`,
        },
        {
          type: 'texte', forme: 'ip', accept: [nom], placeholder: '111A',
          q: `Sur la télécommande LSM, quel nom porte le clip rangé page **${P}**, banque **${B}**, touche **F${F}**, angle **${A}** ?`,
          aides: ['Le nom d\'un clip est son adresse : page, banque, touche, puis la lettre de l\'angle.', 'Le clip de la page 1, banque 1, touche F1, angle A s\'appelle 111A.'],
          solution: `**${nom}** : page ${P}, banque ${B}, touche F${F}, angle ${A}.`,
        },
        {
          type: 'ordre', q: 'Remettez dans l\'ordre le travail des clips pendant le match.',
          items: ['L\'opérateur LSM pose un IN et un OUT sur l\'action', 'Il range le clip sur une touche F libre', 'Le logueur le nomme dans IPDirector, avec mots-clés et note', 'À la mi-temps, la playlist du résumé part à l\'antenne'],
          aides: ['Un clip existe d\'abord sur la télécommande, avant d\'être décrit.', 'On délimite, on range, on décrit, puis on monte.'],
          solution: '1. IN et OUT ; 2. rangé sur une touche F ; 3. nommé et décrit dans IPDirector ; 4. la playlist à la mi-temps.',
        },
        pick(rnd, CLIPS),
      ];
    },
  },
  'ralentis-fichiers': {
    titre: 'Tenir la boucle et envoyer les clips',
    consigne: 'Au poste du serveur ralenti, avant et pendant le match : la place que prend chaque heure, la profondeur de la boucle, la taille d\'un clip et le temps de son transfert.',
    gen: (rnd) => {
      const d = pick(rnd, [100, 120, 145, 185, 220, 300]), gh = Math.round(goParHeure(d) * 10) / 10;
      const capa = pick(rnd, [8, 10, 12, 16, 20]), prot = entre(rnd, 2, 40) * 100, n = entre(rnd, 4, 8), h = Math.round(profondeur(capa, prot, n, d) * 10) / 10;
      const sec = entre(rnd, 3, 24) * 5, go = Math.round(tailleGo(sec, d) * 100) / 100;
      const lien = pick(rnd, [1, 10]), t = Math.round(transfert(go, lien) * 10) / 10;
      return [
        {
          type: 'nombre', unite: 'Go', answer: gh, tol: 0.3,
          q: `Une entrée du serveur enregistre en intra à **${d} Mb/s**. Combien de gigaoctets écrit-elle en une heure ?`,
          pieges: [{ v: Math.round(d * 3.6 * 10) / 10, why: 'C\'est en gigabits : un octet vaut 8 bits, il faut encore diviser par 8.' }],
          aides: ['Débit × durée donne des mégabits ; 8 bits font un octet.', `${d} × 3 600 ÷ 8 ÷ 1 000.`],
          solution: `${d} × 3 600 ÷ 8 ÷ 1 000 = **${fr(gh, 1)} Go** par heure et par entrée.`,
        },
        {
          type: 'nombre', unite: 'h', answer: h, tol: 0.15,
          q: `Le serveur a **${capa} To** de disques, dont **${fr(prot)} Go** de clips protégés. Il enregistre **${n} entrées** à **${d} Mb/s**. Quelle est la profondeur de la boucle, en heures ?`,
          pieges: [{ v: Math.round(capa * 1000 / (n * goParHeure(d)) * 10) / 10, why: 'Les clips protégés ne seront pas écrasés : leur place est à retirer de la capacité.' }].filter((x) => Math.abs(x.v - h) > 0.2),
          aides: ['Profondeur = place libre ÷ (entrées × Go par heure).', `(${fr(capa * 1000)} − ${fr(prot)}) Go ÷ (${n} × ${fr(goParHeure(d), 1)} Go).`],
          solution: `${fr(capa * 1000 - prot)} ÷ ${fr(n * goParHeure(d), 1)} = **${fr(h, 1)} h** de jeu relisible à tout instant.`,
        },
        {
          type: 'nombre', unite: 'Go', answer: go, tol: 0.02,
          q: `Un clip de **${sec} s** à **${d} Mb/s** part vers la post-production. Quelle est sa taille ?`,
          aides: ['Taille (Mo) = débit (Mb/s) × durée (s) ÷ 8.', `${d} × ${sec} ÷ 8 ÷ 1 000.`],
          solution: `${d} × ${sec} ÷ 8 = ${fr(d * sec / 8)} Mo, soit **${fr(go, 2)} Go**.`,
        },
        {
          type: 'nombre', unite: 's', answer: t, tol: Math.max(0.15, t * 0.02),
          q: `Ce clip de **${fr(go, 2)} Go** passe sur un lien de **${lien} Gb/s**, dont on obtient 70 % en débit utile. Combien de secondes dure le transfert ?`,
          pieges: [{ v: Math.round(go / (lien * 0.7) * 10) / 10, why: 'Les gigaoctets ne se divisent pas directement par des gigabits par seconde : × 8 d\'abord.' }],
          aides: ['Temps = taille en bits ÷ débit utile.', `${fr(go, 2)} × 8 ÷ (${lien} × 0,7).`],
          solution: `${fr(go, 2)} × 8 ÷ ${fr(lien * 0.7, 1)} = **${fr(t, 1)} s**, ${t < sec ? `${fr(sec / t, 1)} fois plus vite que le temps réel` : 'plus lent que le temps réel'}.`,
        },
        pick(rnd, FICHIERS_SITU),
      ];
    },
  },
});
