// @ts-check
import { emit } from '../state.js';
import { el } from '../util.js';
import { toast } from '../ui/common.js';
import { evsAction, canalMedias, MIX, meSource } from '../pipeline.js';
import { MEDIAS, ORDRE_MEDIAS, dureeTC, partieA } from './medias.js';
import { SEGMENTS, segmentDe } from './conducteur.js';
import { EMI, mediaCharge, prochainTop, sourceMedias } from './etat.js';
import { vignetteMedia } from './video.js';
import { ctrlFunc } from '../net/ctrlnet.js';
import { SES, getPseudo } from '../multi/session.js';

// ----------------------------------------------------------------------------------
// Les panneaux de l'émission : les médias à l'IPDirector (charger un média sur le canal de diffusion
// de l'EVS, le lancer au top, l'arrêter, suivre le temps restant) et le conducteur (au poste du scripte,
// à l'IPDirector, dans le téléphone). Les commandes du direct (antenne, compte à rebours) passent par
// l'événement « emission » : src/emission/index.js les exécute.
// ----------------------------------------------------------------------------------
const mmss = (s) => { if (s == null) return '--:--'; const v = Math.max(0, Math.ceil(s)); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };
/** qui commande depuis ce poste : « vous » seul, son pseudo en coopération */
export const parMoi = () => (SES.active ? getPseudo() || 'vous' : 'vous');
/** l'image représentative d'un média (vignette de la base) */
const VIGNETTE_T = { 'gen-debut': 14, pub: 12, 'gen-fin': 3 };

/**
 * Le panneau « Médias de l'émission » de l'IPDirector.
 * @param {{ explain: (text: string, kind?: string) => void, evsOk?: () => boolean }} ctx
 */
export function panneauMedias(ctx) {
  const ch = () => canalMedias();
  const nomCanal = () => `PGM${ch() + 1} (EVS ${ch() ? 'B' : 'A'})`;
  const ok = () => { if (ctx.evsOk) return ctx.evsOk(); const k = ctrlFunc('evs'); if (k.ok) return true; toast('Serveur EVS injoignable par le réseau de contrôle.', 'bad'); return false; };
  const etat = el('span', { class: 'pill' });
  const top = el('div', { class: 'lcd amber big em-top', 'aria-live': 'off' });
  const ecoule = el('span', { class: 'lcd' }), reste = el('span', { class: 'lcd amber' });
  const barre = el('i'); const jauge = el('div', { class: 'em-jauge', 'aria-hidden': 'true' }, barre);
  const partie = el('span', { class: 'note em-partie' });
  const lignes = {};
  const bin = el('div', { class: 'list em-bin' });
  for (const id of ORDRE_MEDIAS) {
    const m = MEDIAS[id];
    const cv = /** @type {HTMLCanvasElement} */ (el('canvas', { width: 160, height: 90, class: 'em-vig', 'aria-hidden': 'true' }));
    const charger = el('button', { class: 'btn small', 'data-media': id, 'aria-label': `Charger ${m.nom.toLowerCase()} sur le canal de diffusion`, onclick: () => charge(id) }, 'Charger');
    const prochainTag = el('span', { class: 'pill warn em-next', hidden: true }, 'au conducteur');
    const row = el('div', { class: 'item em-media', 'data-media': id }, cv,
      el('div', { class: 'grow' }, el('div', { class: 't' }, m.titre, ' ', prochainTag), el('div', { class: 's' }, `${dureeTC(m.duree)} · ${m.desc}`)), charger);
    bin.appendChild(row);
    lignes[id] = { row, charger, prochainTag };
    vignetteMedia(cv, id, VIGNETTE_T[id] || 2);
  }
  const lancer = el('button', { class: 'btn primary em-lancer', 'data-k': 'media:lancer', onclick: () => joue() }, '▶ LANCER');
  const stop = el('button', { class: 'btn em-stop', 'data-k': 'media:stop', onclick: () => { if (!ok()) return; evsAction(ch(), 'mediastop'); ctx.explain('Média arrêté : l\'image se fige sur la dernière image lue. À l\'antenne, une image figée se voit tout de suite : on arrête un média seulement quand il n\'est plus à l\'antenne.', 'warn:ipdstop'); } }, '❚❚ STOP');
  const debut = el('button', { class: 'btn small', onclick: () => { if (!ok()) return; evsAction(ch(), 'mediarewind'); ctx.explain('Retour au début du média (cue) : il est prêt à repartir de sa première image.', 'ipd:cue'); } }, '⏮ Début');
  const ejecter = el('button', { class: 'btn small', onclick: () => { if (!ok()) return; evsAction(ch(), 'mediaeject'); ctx.explain(`Média éjecté : le canal ${nomCanal()} repasse en direct (E/E), sur la caméra qu'il enregistre.`, 'ipd:eject'); } }, '⏏ Éjecter');
  function charge(id) {
    if (!ok()) return;
    const m = mediaCharge();
    if (m && m.playing && meSource(MIX.pgm) === sourceMedias()) { toast('Un média est à l\'antenne sur ce canal : attendez qu\'il soit fini (ou que le truquiste en sorte).', 'bad'); return; }
    evsAction(ch(), 'media', { id, by: parMoi() });
    ctx.explain(`« ${MEDIAS[id].titre} » chargé sur ${nomCanal()}, en pause sur sa première image (cue). Au top, LANCER : le truquiste le prend à l'antenne (source ${sourceMedias() === 'EVSB' ? 'EVS B' : 'EVS A'} au mélangeur).`, 'ipd:charge');
  }
  function joue() {
    if (!ok()) return;
    const m = mediaCharge();
    if (!m) { toast('Aucun média chargé : choisissez-en un dans la liste (Charger).', 'bad'); return; }
    evsAction(ch(), 'mediaplay', parMoi());
    const seg = segmentDe(EMI.C); const suiv = SEGMENTS[EMI.C.i + 1];
    const auTop = EMI.on && (seg.media === m.id || ((seg.type === 'compte' || seg.type === 'duree') && !!suiv && suiv.media === m.id));
    ctx.explain(`${MEDIAS[m.id].titre} lancé sur ${nomCanal()}${auTop ? (seg.type === 'compte' ? ' : c\'est le top, on prend l\'antenne sur le générique, le truquiste le prend' : ' : c\'est le top, le truquiste le prend à l\'antenne') : EMI.on ? ' : attention, ce n\'est pas son moment au conducteur' : ''}. Le temps restant s'affiche ici et au multiview : on annonce la fin (« retour dans 10 ») pour que le réalisateur prépare la suite.`, auTop ? 'ok:ipdplay' : 'ipd:play');
  }
  const box = el('div', { class: 'hwpanel ipd em-play' },
    el('h3', {}, 'Médias de l\'émission · diffusion'),
    el('div', { class: 'hwrow' }, el('span', { class: 'note' }, 'Canal de diffusion'), el('b', { class: 'em-canal' }, nomCanal()), etat),
    top,
    el('div', { class: 'lsm-sub' }, 'Base MÉDIAS du serveur (éléments importés avant le match)'), bin,
    el('div', { class: 'hwrow em-transport' }, lancer, stop, debut, ejecter),
    el('div', { class: 'hwrow' }, el('span', { class: 'note' }, 'Écoulé'), ecoule, el('span', { class: 'note' }, 'Reste'), reste, partie), jauge,
    el('p', { class: 'note' }, 'Le générique et la pub sont des fichiers importés sur le serveur avant le match. On les charge sur le canal de diffusion (cue : la première image attend), on les lance au top annoncé par le scripte, et le truquiste les prend à l\'antenne. Pendant le média, on surveille le temps restant pour annoncer le retour.'));
  return {
    el: box,
    update() {
      const m = mediaCharge(); const M_ = m ? MEDIAS[m.id] : null;
      const onAir = !!m && meSource(MIX.pgm) === sourceMedias();
      etat.textContent = !m ? 'Canal en direct (E/E)' : `${M_.titre} · ${m.playing ? 'en lecture' : m.pos >= M_.duree - 0.05 ? 'fini' : m.pos > 0 ? 'en pause' : 'chargé (cue)'}${onAir ? ' · À L\'ANTENNE' : ''}`;
      etat.className = 'pill ' + (onAir ? 'err' : m && m.playing ? 'ok' : m ? 'warn' : '');
      ecoule.textContent = m ? dureeTC(m.pos) : '--:--:--';
      reste.textContent = m ? dureeTC(M_.duree - m.pos) : '--:--:--';
      barre.style.width = m ? `${Math.round(100 * m.pos / M_.duree)}%` : '0%';
      const p = m && m.id === 'pub' ? partieA('pub', m.pos) : null; partie.textContent = p ? p.titre : '';
      lancer.disabled = !m || m.playing; stop.disabled = !m || !m.playing;
      const seg = EMI.on ? segmentDe(EMI.C) : null;
      // le prochain média au conducteur
      const suivant = EMI.on ? SEGMENTS.slice(EMI.C.i).find((s) => s.media && EMI.C.lance[s.id] == null && !EMI.C.manque[s.id]) : null;
      for (const id of ORDRE_MEDIAS) { const L = lignes[id]; L.prochainTag.hidden = !suivant || suivant.media !== id; L.row.classList.toggle('on', !!m && m.id === id); }
      const pr = EMI.on ? prochainTop() : null;
      top.hidden = !pr;
      if (pr) {
        const attendu = seg && seg.media && EMI.C.lance[seg.id] == null;
        top.textContent = attendu ? `TOP ! ${pr.titre.toUpperCase()}` : `${pr.titre} dans ${mmss(pr.dans)}`;
        top.classList.toggle('red', !!attendu);
      }
    },
  };
}

/**
 * Le conducteur de l'émission : la liste des séquences, la séquence en cours, le prochain top.
 * @param {{ commandes?: boolean }} [o] commandes : les touches du direct (antenne, compte à rebours)
 */
export function panneauConducteur(o = {}) {
  const liste = el('ol', { class: 'em-cond' });
  const items = SEGMENTS.map((s) => { const li = el('li', { 'data-seg': s.id }, el('b', {}, s.titre), el('span', { class: 's' }, s.quoi)); liste.appendChild(li); return li; });
  const prochainEl = el('div', { class: 'lcd amber em-top' });
  const antenne = el('button', { class: 'btn primary', 'data-k': 'emission:antenne', onclick: () => emit('emission', { type: 'cmd', cmd: 'antenne' }) }, 'Antenne maintenant');
  const pause = el('button', { class: 'btn', 'data-k': 'emission:pause', onclick: () => emit('emission', { type: 'cmd', cmd: 'pause' }) }, 'Suspendre le décompte');
  const cmds = o.commandes ? el('div', { class: 'hwrow' }, antenne, pause) : null;
  const vide = el('p', { class: 'note' }, 'Pas d\'émission en cours. Jouer → Car régie → Car pré-installé, « Émission en direct » : le match commence par le générique, deux périodes, la pub à la mi-temps, le générique de fin.');
  const box = el('div', { class: 'hwpanel em-conducteur' }, el('h3', {}, 'Conducteur de l\'émission'), prochainEl, cmds, liste, vide);
  return {
    el: box,
    update() {
      vide.hidden = EMI.on; liste.hidden = !EMI.on; prochainEl.hidden = !EMI.on || EMI.C.fini;
      if (!EMI.on) { if (cmds) cmds.hidden = true; return; }
      items.forEach((li, k) => { li.className = k < EMI.C.i || EMI.C.fini ? 'fait' : k === EMI.C.i ? 'en-cours' : ''; });
      const pr = prochainTop();
      prochainEl.textContent = pr ? (pr.dans == null ? `En attente : ${pr.titre}` : `${pr.titre} dans ${mmss(pr.dans)}`) : '';
      if (cmds) {
        const att = segmentDe(EMI.C).type === 'compte';
        cmds.hidden = !att || EMI.suivi;
        pause.textContent = EMI.C.suspendu ? 'Reprendre le décompte' : 'Suspendre le décompte';
      }
    },
  };
}
/**
 * L'objectif à l'écran pendant l'émission (game/quest.js) : la séquence en cours, le prochain top, le conducteur en tâches.
 * @returns {import('../game/quest.js').Goal}
 */
export function goalEmission() {
  const seg = segmentDe(EMI.C); const pr = prochainTop();
  const tasks = SEGMENTS.filter((s) => s.type !== 'fin').map((s, i) => ({ t: s.titre, done: i < EMI.C.i || EMI.C.fini, now: i === EMI.C.i && !EMI.C.fini }));
  const dans = pr ? (pr.dans == null ? 'à lancer' : mmss(pr.dans)) : '';
  const cmd = (c) => () => emit('emission', { type: 'cmd', cmd: c });
  const acts = seg.type === 'compte' && !EMI.suivi
    ? [{ label: 'Antenne maintenant', k: 'emission:antenne', primary: true, fn: cmd('antenne') }, { label: EMI.C.suspendu ? 'Reprendre le décompte' : 'Suspendre le décompte', k: 'emission:pause', fn: cmd('pause') }]
    : EMI.C.fini && EMI.rapport ? [{ label: 'Compte rendu', k: 'emission:rapport', primary: true, fn: cmd('rapport') }] : undefined;
  return {
    kind: 'emission', tag: seg.antenne && !EMI.C.fini ? 'Émission · à l\'antenne' : 'Émission en direct', title: seg.titre,
    sub: pr ? `${pr.titre} : ${dans}` : EMI.rapport ? `${EMI.rapport.score} / 100` : '', text: seg.quoi,
    prog: Math.min(1, EMI.C.i / (SEGMENTS.length - 1)), tasks, acts, key: `em:${EMI.C.i}:${dans}:${EMI.C.suspendu}:${!!EMI.rapport}`,
  };
}
/** le texte court du direct (horloge à l'écran, téléphone) */
export function texteDirect() {
  if (!EMI.on) return null;
  const seg = segmentDe(EMI.C); const pr = prochainTop();
  return { seg: seg.titre, antenne: seg.antenne && !EMI.C.fini, prochain: pr ? pr.titre : '', dans: pr && pr.dans != null ? mmss(pr.dans) : pr ? 'à lancer' : '', suspendu: EMI.C.suspendu && seg.type === 'compte' };
}
