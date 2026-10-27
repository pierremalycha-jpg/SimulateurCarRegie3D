// @ts-check
import { el } from '../util.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Leçon « Du serveur au fichier : stocker, échanger, archiver » (chapitre Les ralentis). La
// manipulation calcule la place que prend chaque heure d'enregistrement (débit du codec × entrées),
// la profondeur de la boucle des trains (ce qui reste sur les disques, clips protégés déduits), la
// taille d'un clip exporté et le temps de son transfert sur le réseau. Unités décimales : 1 Go =
// 10⁹ octets, 1 To = 10¹² octets, 8 bits par octet. Les débits des codecs sont des ordres de
// grandeur d'un serveur de car (intra, de l'ordre de 100 à 200 Mb/s en HD, quatre fois plus en UHD) ;
// les nombres d'entrées sont ceux du profil du car (README : XT4K, 6 ou 8 REC en HD, 3 en UHD).
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
const box = (x, y, w, h, stroke = C.grey) => sv('rect', { x, y, width: w, height: h, rx: 3, fill: C.box, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};

// ---------------- le modèle (pur) ----------------
/** gigaoctets par heure d'un flux de d Mb/s (1 Go = 10⁹ octets) */
export const goParHeure = (mbps) => mbps * 3600 / 8 / 1000;
/** taille d'un fichier (Go) : durée en secondes à d Mb/s */
export const tailleGo = (sec, mbps) => mbps * sec / 8 / 1000;
/**
 * Profondeur de la boucle des trains (heures) : la place libre (To), moins les clips protégés (Go),
 * partagée entre toutes les entrées enregistrées au même débit.
 */
export function profondeur(capaTo, protegesGo, entrees, mbps) {
  const libre = Math.max(0, capaTo * 1000 - protegesGo);
  return entrees > 0 && mbps > 0 ? libre / (entrees * goParHeure(mbps)) : Infinity;
}
/** temps d'un transfert (s) : taille (Go) sur un lien de g Gb/s, dont on obtient une part utile (rendement) */
export const transfert = (go, gbps, rend = 0.7) => go * 8 / (gbps * rend);
/** des débits de codecs intra de serveur, en HD (ordres de grandeur) ; ×4 en UHD */
export const CODECS_SRV = [['100', 'intra 100 Mb/s'], ['185', 'intra 185 Mb/s'], ['300', 'intra 300 Mb/s']];

// ---------------- la manipulation ----------------
function demoFichiers(host) {
  let mbps = 185, uhd = false, entrees = 6, capa = 12, proteges = 200, clip = 45, lien = 10;
  const read = readout(['Débit d\'une entrée', 'Une heure, une entrée', 'Une heure de match, toutes les entrées', 'Profondeur de la boucle', 'Le clip exporté', 'Transfert vers la post-production']);
  const verdict = el('p', { class: 'co-verdict' });
  const bar = el('div', { class: 'co-scroll' });
  const draw = () => {
    const d = mbps * (uhd ? 4 : 1), n = uhd ? Math.min(entrees, 3) : entrees;
    const h = profondeur(capa, proteges, n, d), go = tailleGo(clip, d), t = transfert(go, lien);
    read.set('Débit d\'une entrée', `${fmtNum(d)} Mb/s${uhd ? ' (UHD : quatre fois la HD)' : ''}`);
    read.set('Une heure, une entrée', `${fmtNum(goParHeure(d))} Go`);
    read.set('Une heure de match, toutes les entrées', `${fmtNum(goParHeure(d) * n)} Go pour ${n} entrée${n > 1 ? 's' : ''}${uhd && entrees > 3 ? ' (3 entrées au plus en UHD)' : ''}`);
    read.set('Profondeur de la boucle', `${fmtNum(h, 1)} h, soit ${fmtNum(h * 60)} min de jeu disponibles à tout instant`);
    read.set('Le clip exporté', `${clip} s : ${fmtNum(go, 2)} Go`);
    read.set('Transfert vers la post-production', `${fmtNum(t, 1)} s sur un lien de ${lien} Gb/s (≈ 70 % du débit utile) : ${fmtNum(clip / t, 1)} fois le temps réel`);
    // la barre des disques : protégé, une heure de match, le reste
    const W = 640, f = figure(W, 74, `Les disques du serveur : ${capa} To, dont ${proteges} Go de clips protégés ; une heure de match prend ${fmtNum(goParHeure(d) * n)} Go`);
    const k = 600 / (capa * 1000), wp = Math.min(600, proteges * k), wh = Math.min(600 - wp, goParHeure(d) * n * k);
    f.append(sv('rect', { x: 20, y: 14, width: 600, height: 26, fill: '#11161a', stroke: C.line }), sv('rect', { x: 20, y: 14, width: wp, height: 26, fill: C.amber, opacity: 0.85 }));
    for (let i = 0; i < 12 && 20 + wp + (i + 1) * wh <= 620; i++) f.append(sv('rect', { x: 20 + wp + i * wh, y: 14, width: Math.max(1, wh - 1), height: 26, fill: i % 2 ? C.cyan : '#4f9fbf', opacity: 0.7 }));
    f.append(txt(20, 58, 'ambre : clips protégés · bleu : une heure de match à chaque case (la boucle s\'écrit par-dessus la plus ancienne)', 'co-s', 'start'));
    bar.replaceChildren(f);
    const v = h < 1.5 ? ['ko', `La boucle ne tient que ${fmtNum(h * 60)} min : la première mi-temps sera effacée avant la fin du match. Exportez ou effacez des clips protégés, baissez le débit ou le nombre d'entrées.`]
      : h < 3 ? ['warn', `Une boucle de ${fmtNum(h, 1)} h couvre le match, pas l'avant-match ni les prolongations : protégez les actions au fil de l'eau.`]
        : ['ok', `${fmtNum(h, 1)} h de boucle : tout le match, avant et après, reste accessible ; le clip part vers la post-production en ${fmtNum(t, 1)} s.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Codec HD du serveur', CODECS_SRV, String(mbps), (v) => { mbps = +v; draw(); }),
      choice('Format', [['hd', 'HD'], ['uhd', 'UHD (×4)']], 'hd', (v) => { uhd = v === 'uhd'; draw(); }),
      slider('Entrées enregistrées', 1, 8, entrees, 1, (v) => { entrees = v; draw(); }, (v) => `${v} REC`)),
    el('div', { class: 'co-ctl' },
      slider('Disques du serveur', 4, 40, capa, 1, (v) => { capa = v; draw(); }, (v) => `${v} To`),
      slider('Clips protégés', 0, 8000, proteges, 100, (v) => { proteges = v; draw(); }, (v) => `${fmtNum(v)} Go`)),
    el('div', { class: 'co-ctl' },
      slider('Durée du clip à exporter', 5, 600, clip, 5, (v) => { clip = v; draw(); }, (v) => `${v} s`),
      choice('Lien vers la post-production', [['1', '1 Gb/s'], ['10', '10 Gb/s']], String(lien), (v) => { lien = +v; draw(); })),
    bar, verdict, read.el);
  draw();
}

// ---------------- le schéma ----------------
function figFichiers() {
  const f = figure(720, 200, 'Le serveur ralenti enregistre ses entrées en boucle sur ses disques ; les clips protégés restent ; les clips partent en fichiers vers les autres serveurs, la post-production et l\'archive par le réseau, avec leurs métadonnées.');
  f.append(txt(10, 16, 'Du train au fichier : ce que devient une action', 'co-t', 'start'));
  f.append(box(10, 34, 120, 44, C.amber), txt(70, 52, 'Caméras', 'co-s'), txt(70, 68, 'entrées REC', 'co-m'));
  f.append(arrow(132, 56, 168, 56), box(172, 30, 170, 92, C.cyan), txt(257, 48, 'Serveur ralenti', 'co-t'), txt(257, 66, 'trains en boucle', 'co-s'), txt(257, 82, 'clips protégés', 'co-s'), txt(257, 98, 'codec intra, timecode', 'co-m'), txt(257, 114, 'IPDirector : noms, mots-clés', 'co-m'));
  const dests = [['Autre serveur', 'réseau entre serveurs'], ['Post-production', 'fichiers MXF, QuickTime'], ['Archive', 'NAS, bande LTO']];
  dests.forEach(([a, b], i) => { const y = 30 + i * 40; f.append(arrow(344, 76, 430, y + 16), box(434, y, 170, 32, C.green), txt(519, y + 14, a, 'co-s'), txt(519, y + 27, b, 'co-m')); });
  f.append(txt(10, 150, 'Une heure d\'une entrée à d Mb/s : d × 3 600 ÷ 8 ÷ 1 000 Go  (185 Mb/s ≈ 83 Go).', 'co-s', 'start'));
  f.append(txt(10, 168, 'Profondeur de la boucle = place libre ÷ (entrées × Go par heure).', 'co-s', 'start'));
  f.append(txt(10, 186, 'Transfert = taille × 8 ÷ (débit du lien × rendement) : 1 Go en ≈ 1,1 s sur 10 Gb/s à 70 %.', 'co-s', 'start'));
  return f;
}

/** @type {import('./index.js').Lesson} */
export const LESSON_FICHIERS = {
  id: 'ralentis-fichiers', title: 'Du serveur au fichier : stocker, échanger, archiver', minutes: '8 min',
  essentials: [
    'Chaque entrée enregistrée remplit les disques au débit de son codec : une heure à **d Mb/s** prend d × 3 600 ÷ 8 ÷ 1 000 **Go** (185 Mb/s ≈ 83 Go).',
    'Les trains tournent **en boucle** : la profondeur disponible = place libre ÷ (entrées × Go par heure) ; les **clips protégés** la réduisent.',
    'Les clips partent en **fichiers** (avec leurs métadonnées) vers un autre serveur, la post-production, l\'archive : un transfert se chiffre en taille ÷ débit utile du lien.',
  ],
  figure: figFichiers,
  demoTitle: 'Six entrées en intra 185 Mb/s sur 12 To : quelle profondeur de boucle ? Passez en UHD, protégez 6 000 Go de clips, puis exportez un clip de 2 min sur 1 Gb/s et sur 10 Gb/s.',
  demo: demoFichiers,
  body: `Le serveur ralenti n'enregistre pas des cassettes : il écrit chaque entrée (chaque **train**) sur ses disques, en continu, dans un **codec intra** (chaque image codée seule : on peut s'arrêter et repartir sur n'importe laquelle, en avant comme en arrière). Le débit de ce codec fixe la place que prend chaque heure. Un flux à d Mb/s écrit d × 3 600 ÷ 8 mégaoctets par heure : à 185 Mb/s, environ **83 Go par heure et par entrée** (en unités décimales, 1 Go = 10⁹ octets). Un serveur de car HD enregistre six ou huit entrées à la fois : une heure de match en occupe plusieurs centaines de gigaoctets. En UHD, l'image a quatre fois plus de pixels et le débit est de l'ordre de quatre fois plus grand, d'où moins d'entrées par serveur (trois dans le profil du car). Les débits exacts dépendent du codec choisi à la configuration du serveur : ceux de la manipulation sont des ordres de grandeur.

Les trains tournent **en boucle** : quand les disques sont pleins, le serveur écrit par-dessus le plus ancien. La **profondeur** de la boucle est ce qu'on peut encore relire à tout instant : la place libre divisée par ce que toutes les entrées écrivent en une heure. Un **clip** protégé (un IN et un OUT gardés, voir la leçon sur les clips) ne sera pas écrasé : il reste, mais il prend de la place et raccourcit la boucle. Sur un long direct (un tournoi, une journée de championnat avec avant-match et prolongations), on surveille la profondeur et on exporte ou on libère les clips déjà utilisés ; sinon, la première mi-temps disparaît pendant que la seconde s'enregistre.

Les clips ne restent pas sur le serveur. Plusieurs serveurs du car sont reliés entre eux par un **réseau** dédié : un opérateur relit un clip enregistré sur le serveur de son voisin. Vers l'extérieur, les clips partent en **fichiers** (souvent en MXF ou en QuickTime, selon ce que demande la post-production) par le réseau Ethernet du car : vers le studio qui prépare le résumé, vers les réseaux sociaux du club, vers l'**archive** (un NAS, puis une bande LTO). Un transfert se calcule : taille × 8 ÷ débit utile du lien (de l'ordre de 70 % du débit nominal, une fois les protocoles et les disques comptés). Un clip de 2 minutes à 185 Mb/s fait 2,8 Go : moins de 4 secondes sur 10 Gb/s, une demi-minute sur 1 Gb/s. On parle de transfert « plus rapide que le temps réel » quand le fichier arrive avant qu'on ait fini de le regarder.

Un fichier sans **métadonnées** est perdu dans l'archive. IPDirector nomme chaque clip, lui donne des mots-clés (joueurs, type d'action, note) et le timecode de l'action : c'est ce qui permet de retrouver « le but de la 67e minute, angle du 16 m » trois semaines plus tard. Après le match, on **archive** ce qui doit l'être (les actions, le programme, parfois les isos), on libère les disques, et le serveur repart vide pour la prochaine vacation.

- Ordres de grandeur : codec intra HD de l'ordre de 100 à 200 Mb/s, UHD de l'ordre de 4 fois plus ; une heure de six entrées à 185 Mb/s ≈ 500 Go.
- La super ralenti 3× occupe trois entrées du serveur : trois fois la place d'une caméra ordinaire.`,
  car: { text: 'Au poste du serveur ralenti (EVS), les trains et les clips protégés ; à IPDirector, les noms, mots-clés et notes qui suivent les clips quand ils partent en fichiers vers les autres serveurs, la post-production et l\'archive.', station: 'ipdirector' },
  terms: ['debit'],
  competences: ['2.5', '3.14', '1.3'],
  quiz: [
    { q: 'Une entrée du serveur enregistre en intra à 185 Mb/s. Combien prend une heure ?', choices: ['≈ 83 Go', ['≈ 666 Go', 'C\'est en gigabits : 185 × 3 600 ÷ 1 000. Un octet vaut 8 bits : il faut encore diviser par 8.'], ['≈ 23 Go', 'C\'est le résultat pour un quart d\'heure, ou un débit quatre fois plus petit.']], answer: 0, why: '185 Mb/s × 3 600 s = 666 000 Mb = 666 Gb, soit 666 ÷ 8 ≈ 83 Go. Six entrées en écrivent ≈ 500 Go par heure.' },
    { q: 'Qu\'arrive-t-il aux images d\'un train quand les disques du serveur sont pleins ?', choices: ['Le serveur écrit par-dessus les plus anciennes, sauf celles des clips protégés', ['Le serveur s\'arrête d\'enregistrer', 'Il enregistre en boucle : il ne s\'arrête pas, il efface le plus ancien.'], ['Le serveur passe automatiquement en codec plus compressé', 'Le codec est fixé à la configuration ; c\'est la boucle qui gère le manque de place.']], answer: 0, why: 'Les trains tournent en boucle. Seuls les clips protégés (IN et OUT gardés) échappent à l\'écrasement ; c\'est pourquoi on protège une action dès qu\'elle compte.' },
    { q: 'Pendant un long direct, la profondeur de la boucle tombe à 50 minutes. Que faire ?', choices: ['Exporter ou libérer des clips protégés déjà utilisés, pour rendre de la place', ['Rien : 50 minutes suffisent toujours', 'Avec 50 minutes, la première mi-temps sera écrasée pendant la seconde : on perd des actions qu\'on voudrait revoir.'], ['Protéger tous les trains en entier', 'Protéger prend de la place : la boucle raccourcirait encore.']], answer: 0, why: 'Profondeur = place libre ÷ (entrées × Go par heure). Libérer des clips déjà exportés rend de la place libre ; on peut aussi enregistrer moins d\'entrées.' },
    { q: 'Le même serveur passe de la HD à l\'UHD, même codec. Que devient la profondeur de la boucle, à nombre d\'entrées égal ?', choices: ['Elle est divisée par quatre environ', ['Elle ne change pas', 'Une image UHD a quatre fois plus de pixels : le débit, donc la place écrite chaque heure, est de l\'ordre de quatre fois plus grand.'], ['Elle double', 'Elle diminue : chaque heure prend plus de place.']], answer: 0, why: 'Le débit d\'un codec intra suit le nombre de pixels : de l\'ordre de quatre fois plus en UHD. C\'est aussi pourquoi un serveur enregistre moins d\'entrées en UHD.' },
    { q: 'Un clip de 2 minutes en intra 185 Mb/s part vers la post-production sur un lien de 10 Gb/s (70 % utile). Combien de temps ?', choices: ['≈ 3 s', ['≈ 2 min', 'Ce serait un transfert au temps réel : le lien de 10 Gb/s va bien plus vite que les 185 Mb/s du fichier.'], ['≈ 0,3 s', 'C\'est oublier que la taille est en octets : 2,8 Go font 22 Gb, à passer sur 7 Gb/s utiles.']], answer: 0, why: 'Taille : 185 × 120 ÷ 8 ≈ 2 775 Mo = 2,8 Go = 22 Gb ; sur 7 Gb/s utiles, ≈ 3,2 s. Quarante fois plus vite que le temps réel.' },
    { q: 'Trois semaines après le match, le club cherche « le but de la 67e minute, angle du 16 m ». Qu\'est-ce qui permet de le retrouver dans l\'archive ?', choices: ['Les métadonnées du clip : son nom, ses mots-clés, son timecode, son angle', ['La taille du fichier', 'Des centaines de clips ont des tailles voisines : la taille ne dit rien de ce qu\'il y a dedans.'], ['L\'ordre des fichiers sur le disque', 'L\'ordre d\'écriture ne survit pas aux copies vers l\'archive : seules les métadonnées suivent le clip.']], answer: 0, why: 'IPDirector nomme et décrit chaque clip pendant le match (joueurs, action, note, angle, timecode) : ces métadonnées partent avec le fichier et le rendent cherchable.' },
  ],
};
