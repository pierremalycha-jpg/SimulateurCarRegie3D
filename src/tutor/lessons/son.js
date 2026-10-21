// @ts-check
import { AU, applyStrip, applyAll, setSend, setLineDelay, avOk, avOffsetMs, videoLatencyMs, soundPlanOk, SOUND_PLAN } from '../../audio.js';
import { goStation } from './kit.js';

// ----------------------------------------------------------------------------------
// Parcours « Son » : la tranche d'entrée (gain, 48 V, phase) puis les départs (N-1 des
// commentateurs, synchro labiale, plan de son de l'embedder). Chaque défaut est créé par le
// chef au début de l'étape et vérifié sur l'état réel de la console.
// ----------------------------------------------------------------------------------
const D = 'Son';
const tab = (text) => ({ sel: '#station .vx-tab', text, label: `onglet ${text}` });
const strip = (short) => ({ sel: '#station .vx-bays .vx-strip', text: short, label: short });
const view = (text) => ({ sel: '#station .vx-bar button', text, label: text });
const onTab = (text) => typeof document !== 'undefined' && !!document.querySelector('#station .vx-tab.on') && /** @type {HTMLElement} */ (document.querySelector('#station .vx-tab.on')).textContent.includes(text);
// le contrôle n'apparaît que dans son onglet : on montre d'abord l'onglet, puis le contrôle
const inTab = (text, ...targets) => () => (onTab(text) ? targets : [tab(text)]);
const cell = (k, bus) => { const i = AU.order.indexOf(k); const col = ['pgm', 'intl', 'n1', 'nxs', 'nxb'].indexOf(bus); return { sel: `#station .vx-matrix tbody tr:nth-child(${i + 1}) td:nth-child(${col + 2}) .vx-cell`, label: `${AU.ch[k].short} → ${bus === 'n1' ? 'N-1 COMM' : bus}` }; };

// ---------------- la tranche d'entrée ----------------
/** @type {import('../engine.js').Lesson} */
const STRIP = {
  id: 'son-tranche', domain: D, stations: ['son'],
  title: 'Corriger une tranche : gain, 48 V et polarité',
  summary: 'Exercice de la leçon « La tranche : gain, 48 V, phase, égaliseur, fader » : un canon qui sature, un micro statique sans alimentation, une ambiance en opposition de phase, corrigés à l\'entrée des tranches.',
  duration: '8 min', level: 'débutant',
  outro: 'L\'ordre de réglage d\'une tranche : le gain d\'entrée (crêtes entre −18 et −10 dBFS), l\'alimentation et la polarité, puis seulement le correcteur, la dynamique et le fader.',
  cleanupLabel: 'Remettre les trois tranches',
  cleanup: () => { const c3 = AU.ch.c3, a1 = AU.ch.amb1, a2 = AU.ch.amb2; c3.gain = c3.defGain; a2.ph48 = true; a1.phase = false; applyAll(); },
  steps: [
    {
      id: 'intro', title: 'La console son',
      say: 'La leçon l\'a montré : au-delà de 0 dBFS, le son est écrêté, et aucun fader ne le répare. La console reçoit les micros du stade (ambiances, **canons** — des micros très directifs — au bord du terrain), les commentateurs, les ralentis, le duplex… Chaque source arrive sur une **tranche** (une colonne de réglages : gain, polarité, correcteur, dynamique, fader).\n\nLe premier réglage, et le plus important, est celui d\'**entrée** : gain, alimentation 48 V, polarité. Un signal qui sature à l\'entrée est perdu.',
    },
    goStation('son', 'On va en cabine son, à l\'arrière du car.', 'La surface : deux baies de tranches, les écrans Vistonics (écrans de réglage entourés de molettes) au-dessus de chaque groupe de faders.'),
    {
      id: 'gain', title: 'Un canon sature',
      enter: () => { const c = AU.ch.c3; c.gain = c.defGain + 22; applyStrip(c); },
      say: 'Le **CANON 3** sature : son crête-mètre touche le rouge (OVL). Le gain d\'entrée est beaucoup trop haut. On le baisse dans la vue **ENTRÉE** de sa tranche, jusqu\'à des crêtes vers −18 à −10 dBFS (décibels sous le maximum numérique, 0 dBFS).',
      do: 'Baisse le GAIN de la tranche CANON 3 (vue ENTRÉE).',
      go: { station: 'son' }, show: inTab('Console', view('ENTRÉE'), strip('CANON 3')),
      done: () => AU.ch.c3.gain <= AU.ch.c3.defGain + 8,
      ok: 'Le canon ne sature plus. Garde de la marge : un tir puissant ou un cri du public font monter les crêtes.',
      hints: ['Le crête-mètre de CANON 3 touche le rouge : le réglage fautif est le tout premier de la tranche.', 'Barre du haut : la vue ENTRÉE affiche le gain de chaque tranche.', 'Molette GAIN de la tranche CANON 3, vers la gauche, jusqu\'à des crêtes vers −18 à −10 dBFS.'],
      auto: () => { const c = AU.ch.c3; c.gain = c.defGain; applyStrip(c); },
    },
    {
      id: 'ph48', title: 'Un micro sans alimentation',
      enter: () => { AU.ch.amb2.ph48 = false; applyStrip(AU.ch.amb2); },
      say: 'L\'ambiance du kop (la tribune des supporters, derrière le but : **AMB KOP**) est muette. Ce couple est fait de micros **statiques** (à condensateur) : ils ont besoin de l\'**alimentation fantôme 48 V**, envoyée par la console dans le câble micro lui-même. Sans elle, ils ne délivrent rien.',
      do: 'Allume l\'alimentation 48 V (touche 48V) de la tranche AMB KOP.',
      go: { station: 'son' }, show: inTab('Console', view('ENTRÉE'), strip('AMB KOP')),
      done: () => AU.ch.amb2.ph48,
      ok: 'L\'ambiance revient. Les micros dynamiques n\'en ont pas besoin, et le 48 V ne les gêne pas s\'ils sont câblés en symétrique.',
      hints: ['Un micro statique muet : c\'est souvent son alimentation qui manque, et elle se règle à l\'entrée de la tranche.', 'Vue ENTRÉE, tranche AMB KOP : la touche 48V.'],
      auto: () => { AU.ch.amb2.ph48 = true; applyStrip(AU.ch.amb2); },
    },
    {
      id: 'phase', title: 'Une phase inversée',
      enter: () => { AU.ch.amb1.phase = true; applyStrip(AU.ch.amb1); },
      say: 'Sur l\'ambiance tribune (**AMB LEP**), une voie du couple a sa polarité inversée : les deux voies sont en **opposition de phase**. Le **corrélateur** (l\'indicateur de phase entre les deux voies, de −1 à +1) passe sous zéro et l\'ambiance se creuse, jusqu\'à presque disparaître en mono, où la partie commune aux deux micros s\'annule. On rétablit la polarité (touche Ø).',
      do: 'Désactive l\'inversion de polarité (Ø) de la tranche AMB LEP.',
      go: { station: 'son' }, show: inTab('Console', view('ENTRÉE'), strip('AMB LEP')),
      done: () => !AU.ch.amb1.phase,
      ok: 'Le corrélateur repart vers +1 : les deux voies sont de nouveau en phase, l\'ambiance retrouve son corps, même en mono.',
      hints: ['L\'inversion de polarité se règle à l\'entrée de la tranche, comme le 48 V.', 'Vue ENTRÉE, tranche AMB LEP : la touche Ø R est allumée, éteins-la.'],
      auto: () => { AU.ch.amb1.phase = false; applyStrip(AU.ch.amb1); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question d\'ordre de réglage.',
      quiz: { q: 'Pourquoi régler le gain d\'entrée avant de toucher au fader ?', choices: ['Parce qu\'une saturation à l\'entrée est définitive : le fader ne fait que baisser un signal déjà écrêté', 'Parce que le fader n\'agit que sur le casque', 'Parce que le gain règle aussi le retard'], answer: 0, why: 'Le gain adapte le niveau du micro à la console. Écrêté à l\'entrée, le son est abîmé pour tout le reste de la chaîne. Le fader règle bien le niveau envoyé au mélange (pas seulement le casque), et le retard est un réglage à part.' },
    },
  ],
};

// ---------------- les départs ----------------
/** @type {import('../engine.js').Lesson} */
const FEEDS = {
  id: 'son-departs', domain: D, stations: ['son', 'transmission'],
  title: 'Corriger les départs : N-1, synchro labiale, plan de son',
  summary: 'Exercice de la leçon « N-1, synchro labiale et départs » : un consultant qui s\'entend en écho, un son décalé de l\'image, des paires audio inversées vers la chaîne, corrigés dans l\'onglet des départs.',
  duration: '10 min', level: 'intermédiaire',
  outro: 'Les départs sont ce que reçoivent les autres : la chaîne (programme et international), les commentateurs (N-1), le studio et le bord terrain. Une erreur ne s\'entend pas forcément en régie : il faut vérifier chaque départ.',
  cleanupLabel: 'Remettre les départs',
  cleanup: () => { setSend('comm2', 'n1', false); setLineDelay(0); AU.emb.splice(0, 4, ...SOUND_PLAN); },
  steps: [
    {
      id: 'intro', title: 'Les départs',
      say: 'La leçon l\'a montré : le son ne part pas qu\'à l\'antenne. Chaque commentateur reçoit dans son casque un **N-1** (« mix-minus ») : tout le programme **sauf sa propre voix**. Elle lui reviendrait avec le retard du son du car (le retard de ligne), et il s\'entendrait en écho.',
    },
    goStation('son', 'On reste en cabine son.', 'L\'onglet « Bus, N-1, départ » montre qui va dans quel départ.'),
    {
      id: 'n1', title: 'Un consultant en écho',
      enter: () => { setSend('comm2', 'n1', true); AU.ch.comm2.fader = Math.max(AU.ch.comm2.fader, -6); applyAll(); },
      say: 'Le consultant (**COMM 2**) se plaint : il s\'entend en écho. Sa voix est envoyée dans le bus **N-1 COMM**, celui qu\'écoutent les commentateurs.',
      do: 'Retire COMM 2 du bus N-1 COMM (onglet « Bus, N-1, départ »).',
      go: { station: 'son' }, show: inTab('Bus', cell('comm2', 'n1')),
      done: () => !AU.ch.comm2.n1,
      ok: 'Le consultant n\'entend plus que les autres sources, sans sa propre voix : son N-1 est de nouveau un vrai N-1.',
      hints: ['Il s\'entend en écho : sa propre voix est envoyée dans le départ qu\'il écoute.', 'Onglet « Bus, N-1, départ » : la matrice a une ligne par tranche, une colonne par départ.', 'Ligne COMM 2, colonne N-1 COMM : la case est en rouge, clique-la.'],
      auto: () => setSend('comm2', 'n1', false),
    },
    {
      id: 'sync', title: 'La synchro labiale',
      enter: () => { setLineDelay(AU.lineDelay + 180); },
      say: () => `L'image traverse des équipements qui la retardent (synchroniseur d'images, conversions, liaison HF). Le son, lui, arrive presque tout de suite : il faut le **retarder** du même temps.\n\nIci, le décalage est de ${avOffsetMs()} ms : les lèvres ne collent plus à la voix. La tolérance de bout en bout (EBU R37) va de −40 ms (son en avance) à +60 ms (son en retard) ; dans le car, on vise 0 ms.`,
      do: 'Règle le retard de ligne pour revenir dans la tolérance.',
      go: { station: 'son' }, show: inTab('Bus', { sel: '#station input[aria-label="Retard de ligne"]', label: 'retard de ligne' }),
      done: () => avOk(),
      ok: () => `Décalage ${avOffsetMs()} ms : dans la tolérance. Le téléspectateur ne voit plus de décalage entre les lèvres et la voix.`,
      hints: ['Onglet « Bus, N-1, départ », panneau « Retard de ligne » : l\'afficheur dit si le son est en avance ou en retard, et de combien.', 'Les boutons de la console avancent par pas de 20 ms, une image en 1080p50 (une trame en 1080i50) : compte combien de pas il faut retirer ou ajouter.', 'Le curseur « Retard de ligne », ou les boutons − 1 image / + 1 image, jusqu\'à ce que l\'afficheur passe au vert.'],
      auto: () => setLineDelay(AU.follow ? 0 : videoLatencyMs(AU.pgmSrc)),
    },
    {
      id: 'emb', title: 'Le plan de son',
      enter: () => { const e = AU.emb; [e[0], e[1]] = [e[1], e[0]]; },
      say: 'Le son est **embeddé** (inséré dans le signal SDI lui-même) dans la vidéo envoyée à la chaîne, sur des paires de canaux numérotées.\n\nLa chaîne attend son **plan de son** : paire 1 (canaux 1-2) = programme (PGM), paire 2 (canaux 3-4) = son international (INTL, sans commentaires). Ici, les deux premières paires sont inversées.',
      do: 'Remets la paire 1 (1-2) sur PGM et la paire 2 (3-4) sur INTL, dans l\'embedder du départ.',
      go: { station: 'son' }, show: inTab('Bus', { sel: '#station h3', text: 'Embedder', label: 'embedder du départ' }),
      done: () => soundPlanOk(),
      ok: 'Plan de son conforme : la chaîne reçoit chaque son sur la paire prévue.',
      hints: ['L\'embedder du départ est dans l\'onglet « Bus, N-1, départ », avec le plan de son demandé en face de chaque paire.', 'Tableau « Embedder du départ » : les lignes 1-2 et 3-4 sont marquées « à corriger ».', 'Ligne 1-2 : choisis « PGM stéréo » ; ligne 3-4 : choisis « International ».'],
      auto: () => { AU.emb.splice(0, 4, ...SOUND_PLAN); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question de vocabulaire.',
      quiz: { q: 'Que contient le son international (INTL) ?', choices: ['Les ambiances et effets du match, sans les commentaires : chaque chaîne étrangère y ajoute les siens', 'Le programme complet avec les commentaires', 'Uniquement les commentaires'], answer: 0, why: 'L\'international sert aux diffuseurs étrangers : ils ajoutent leurs propres commentaires par-dessus. Avec les commentaires français dedans, il serait inutilisable pour eux : c\'est la différence avec le programme (PGM).' },
    },
  ],
};

export const SON_LESSONS = [STRIP, FEEDS];
