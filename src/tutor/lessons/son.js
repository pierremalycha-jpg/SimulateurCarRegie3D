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
  title: 'La console : gain, alimentation 48 V et phase',
  summary: 'Un canon qui sature, un micro statique sans alimentation, une ambiance en opposition de phase : on corrige à la tranche d\'entrée.',
  duration: '8 min', level: 'débutant',
  outro: 'L\'ordre de réglage d\'une tranche : le gain d\'entrée (crêtes entre −18 et −10 dBFS), l\'alimentation et la polarité, puis seulement le correcteur, la dynamique et le fader.',
  cleanupLabel: 'Remettre les trois tranches',
  cleanup: () => { const c3 = AU.ch.c3, a1 = AU.ch.amb1, a2 = AU.ch.amb2; c3.gain = c3.defGain; a2.ph48 = true; a1.phase = false; applyAll(); },
  steps: [
    {
      id: 'intro', title: 'La console son',
      say: 'La console reçoit les micros du stade (ambiances, canons au bord du terrain), les commentateurs, les ralentis, le duplex… Chaque source arrive sur une **tranche**. Le premier réglage, et le plus important, est celui d\'**entrée** : un signal qui sature à l\'entrée est perdu, aucun fader ne le rattrapera.',
    },
    goStation('son', 'On va en cabine son, à l\'arrière du car.', 'La surface : deux baies de tranches, les écrans Vistonics au-dessus de chaque groupe de faders.'),
    {
      id: 'gain', title: 'Un canon sature',
      enter: () => { const c = AU.ch.c3; c.gain = c.defGain + 22; applyStrip(c); },
      say: 'Le **CANON 3** sature : son crête-mètre touche le rouge (OVL). Le gain d\'entrée est beaucoup trop haut. On le baisse dans la vue **ENTRÉE** de sa tranche, jusqu\'à des crêtes vers −18 à −10 dBFS.',
      do: 'Baisse le GAIN de la tranche CANON 3 (vue ENTRÉE).',
      go: { station: 'son' }, show: inTab('Console', view('ENTRÉE'), strip('CANON 3')),
      done: () => AU.ch.c3.gain <= AU.ch.c3.defGain + 8,
      ok: 'Le canon ne sature plus. Garde de la marge : un tir puissant ou un cri du public font monter les crêtes.',
      hints: ['Barre du haut : ENTRÉE affiche le gain de chaque tranche.', 'Molette GAIN de la tranche CANON 3, vers la gauche.'],
      auto: () => { const c = AU.ch.c3; c.gain = c.defGain; applyStrip(c); },
    },
    {
      id: 'ph48', title: 'Un micro sans alimentation',
      enter: () => { AU.ch.amb2.ph48 = false; applyStrip(AU.ch.amb2); },
      say: 'L\'ambiance du kop (**AMB KOP**) est muette. Ce couple est fait de micros **statiques** : ils ont besoin de l\'**alimentation fantôme 48 V**, envoyée par la console dans le câble micro.',
      do: 'Allume le 48V de la tranche AMB KOP.',
      go: { station: 'son' }, show: inTab('Console', view('ENTRÉE'), strip('AMB KOP')),
      done: () => AU.ch.amb2.ph48,
      ok: 'L\'ambiance revient. Les micros dynamiques n\'en ont pas besoin, et le 48 V ne les gêne pas.',
      auto: () => { AU.ch.amb2.ph48 = true; applyStrip(AU.ch.amb2); },
    },
    {
      id: 'phase', title: 'Une phase inversée',
      enter: () => { AU.ch.amb1.phase = true; applyStrip(AU.ch.amb1); },
      say: 'Sur l\'ambiance tribune (**AMB LEP**), une voie du couple est en **opposition de phase** : le corrélateur passe sous zéro et l\'ambiance se creuse, surtout en mono. On rétablit la polarité (touche Ø).',
      do: 'Désactive l\'inversion de polarité (Ø) de la tranche AMB LEP.',
      go: { station: 'son' }, show: inTab('Console', view('ENTRÉE'), strip('AMB LEP')),
      done: () => !AU.ch.amb1.phase,
      ok: 'Le corrélateur repart vers +1 : les deux voies sont de nouveau en phase.',
      auto: () => { AU.ch.amb1.phase = false; applyStrip(AU.ch.amb1); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question d\'ordre de réglage.',
      quiz: { q: 'Pourquoi régler le gain d\'entrée avant de toucher au fader ?', choices: ['Parce qu\'une saturation à l\'entrée est définitive : le fader ne fait que baisser un signal déjà écrêté', 'Parce que le fader n\'agit que sur le casque', 'Parce que le gain règle aussi le retard'], answer: 0, why: 'Le gain adapte le niveau du micro à la console. Écrêté à l\'entrée, le son est abîmé pour tout le reste de la chaîne.' },
    },
  ],
};

// ---------------- les départs ----------------
/** @type {import('../engine.js').Lesson} */
const FEEDS = {
  id: 'son-departs', domain: D, stations: ['son', 'transmission'],
  title: 'N-1 des commentateurs, synchro labiale et plan de son',
  summary: 'Un consultant qui s\'entend en écho, un son décalé de l\'image, des paires audio inversées vers la chaîne : on corrige les départs.',
  duration: '10 min', level: 'intermédiaire',
  outro: 'Les départs sont ce que reçoivent les autres : la chaîne (programme et international), les commentateurs (N-1), le studio et le bord terrain. Une erreur ne s\'entend pas forcément en régie : il faut vérifier chaque départ.',
  cleanupLabel: 'Remettre les départs',
  cleanup: () => { setSend('comm2', 'n1', false); setLineDelay(0); AU.emb.splice(0, 4, ...SOUND_PLAN); },
  steps: [
    {
      id: 'intro', title: 'Les départs',
      say: 'Le son ne part pas qu\'à l\'antenne. Chaque commentateur reçoit dans son casque un **N-1** (« mix-minus ») : tout le programme **sauf sa propre voix**. Elle reviendrait avec le retard de la chaîne, et il s\'entendrait en écho.',
    },
    goStation('son', 'On reste en cabine son.', 'L\'onglet « Bus, N-1, départ » montre qui va dans quel départ.'),
    {
      id: 'n1', title: 'Un consultant en écho',
      enter: () => { setSend('comm2', 'n1', true); AU.ch.comm2.fader = Math.max(AU.ch.comm2.fader, -6); applyAll(); },
      say: 'Le consultant (**COMM 2**) se plaint : il s\'entend en écho. Sa voix est envoyée dans le bus **N-1 COMM**, celui qu\'écoutent les commentateurs.',
      do: 'Retire COMM 2 du bus N-1 COMM (onglet « Bus, N-1, départ »).',
      go: { station: 'son' }, show: inTab('Bus', cell('comm2', 'n1')),
      done: () => !AU.ch.comm2.n1,
      ok: 'Le consultant n\'entend plus que les autres sources, sans sa propre voix.',
      hints: ['La matrice : une ligne par tranche, une colonne par départ.', 'Ligne COMM 2, colonne N-1 COMM : la case est en rouge.'],
      auto: () => setSend('comm2', 'n1', false),
    },
    {
      id: 'sync', title: 'La synchro labiale',
      enter: () => { setLineDelay(AU.lineDelay + 180); },
      say: () => `L'image traverse des équipements qui la retardent (synchroniseurs, multiviewer, ralentis). Le son, lui, arrive tout de suite : il faut le **retarder** du même temps. Ici, le décalage est de ${avOffsetMs()} ms : les lèvres ne collent plus à la voix. La tolérance est de −40 ms (son en avance) à +60 ms (son en retard).`,
      do: 'Règle le retard de ligne pour revenir dans la tolérance.',
      go: { station: 'son' }, show: inTab('Bus', { sel: '#station input[aria-label="Retard de ligne"]', label: 'retard de ligne' }),
      done: () => avOk(),
      ok: () => `Décalage ${avOffsetMs()} ms : dans la tolérance. Le téléspectateur ne voit plus de décalage.`,
      hints: ['Le curseur « Retard de ligne », ou les boutons ± 1 image.', 'Une image vaut 20 ms à 50 Hz.'],
      auto: () => setLineDelay(AU.follow ? 0 : videoLatencyMs(AU.pgmSrc)),
    },
    {
      id: 'emb', title: 'Le plan de son',
      enter: () => { const e = AU.emb; [e[0], e[1]] = [e[1], e[0]]; },
      say: 'Le son est **embeddé** dans le signal vidéo envoyé à la chaîne, sur des paires numérotées. La chaîne attend son **plan de son** : paire 1 = programme (PGM), paire 2 = son international (INTL, sans commentaires). Les deux premières paires sont inversées.',
      do: 'Remets la paire 1 sur PGM et la paire 2 sur INTL (embedder du départ).',
      go: { station: 'son' }, show: inTab('Bus', { sel: '#station h3', text: 'Embedder', label: 'embedder du départ' }),
      done: () => soundPlanOk(),
      ok: 'Plan de son conforme : la chaîne reçoit chaque son sur la paire prévue.',
      auto: () => { AU.emb.splice(0, 4, ...SOUND_PLAN); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question de vocabulaire.',
      quiz: { q: 'Que contient le son international (INTL) ?', choices: ['Les ambiances et effets du match, sans les commentaires : chaque chaîne étrangère y ajoute les siens', 'Le programme complet avec les commentaires', 'Uniquement les commentaires'], answer: 0, why: 'L\'international sert aux diffuseurs étrangers : ils ajoutent leurs propres commentaires par-dessus.' },
    },
  ],
};

export const SON_LESSONS = [STRIP, FEEDS];
