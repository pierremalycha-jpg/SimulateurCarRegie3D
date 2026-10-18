import { S, camById } from '../state.js';
import { MIX, EVS, meSource } from '../pipeline.js';
import { AU } from '../audio.js';
import { GFX } from '../gfx.js';
import { ACTIVE } from '../faults.js';
import { SES } from './session.js';

// ----------------------------------------------------------------------------------
// Fiches de rôle d'une session : où se placer, ce qu'on attend de chacun pendant la
// prestation, et quelques objectifs mesurés en direct (affichés dans la fiche du joueur et
// repris dans le compte rendu).
// ----------------------------------------------------------------------------------
export const ROLE_BRIEF = {
  formateur: { station: 'chefdecar', steps: ['Attribuez un rôle à chacun (onglet Participants).', 'Annoncez la mise à l\'antenne, puis injectez des pannes chez le bon poste.', 'Enregistrez le compte rendu à la fin.'] },
  realisateur: { station: 'realisateur', steps: ['Regardez le multiview : choisissez la prochaine image.', 'Ordres au truquiste : « Prépare la 3 », puis « Top » (cut) ou « Enchaîne ».', 'Demandez le ralenti à l\'EVS après chaque action forte, le score à l\'habillage.'] },
  truquiste: { station: 'melangeur', steps: ['Exécutez les ordres du réalisateur dès qu\'ils s\'affichent.', 'Préparez au bus PST ce qu\'il annonce, coupez au « Top ».', 'Gardez le score (DSK) quand on vous le demande.'] },
  evs: { station: 'evsA', steps: ['Vérifiez que l\'enregistrement tourne (REC).', 'Après une action, marquez l\'entrée et la sortie, lisez au ralenti.', 'Annoncez « ralenti prêt » : le truquiste l\'envoie à l\'antenne.'] },
  son: { station: 'son', steps: ['Ambiances toujours ouvertes, canons près du ballon.', 'Commentaires dans le PGM, jamais dans l\'international ni dans leur N-1.', 'Loudness autour de −23 LUFS, corrélation positive.'] },
  vision: { station: 'vision1', steps: ['Suivez l\'exposition de chaque caméra au waveform (iris).', 'Alignez les caméras entre elles (noirs, blancs, couleur).', 'Réagissez aux changements de lumière et aux images sombres.'] },
  technique: { station: 'grille', steps: ['Surveillez les alarmes (barre d\'état) : liaisons, synchro, transmission.', 'Grille : le PGM doit partir vers la transmission.', 'Dépannez les liaisons caméras et la HF.'] },
  habillage: { station: 'habillage', steps: ['Score et horloge à l\'antenne pendant le jeu.', 'Bandeaux joueurs et statistiques à la demande du réalisateur.', 'Retirez un graphique avant le ralenti s\'il gêne.'] },
  cadreur: { station: null, steps: ['Allez à votre caméra et prenez-la (touche E devant elle).', 'Cadre propre quand votre tally est rouge : vous êtes à l\'antenne.', 'Suivez le jeu, anticipez les changements de plan.'] },
  observateur: { station: null, steps: ['Suivez la prestation : multiview, postes en lecture seule, ordres.'] },
};

// compteurs de la prestation (pour les objectifs) : mis à jour par trackRoleStats
export const RS = { replays: 0, gfx: 0, onAir: 0, lastPgm: '', lastGfx: '' };
export function resetRoleStats() { Object.assign(RS, { replays: 0, gfx: 0, onAir: 0, lastPgm: '', lastGfx: '' }); }
export function trackRoleStats(dt) {
  const pg = meSource(MIX.pgm) || '';
  if (pg !== RS.lastPgm) { if (pg === 'EVSA' || pg === 'EVSB') RS.replays++; RS.lastPgm = pg; }
  const g = GFX.template && GFX.anim > 0.5 && GFX.animDir >= 0 ? GFX.template : '';
  if (g && g !== RS.lastGfx) RS.gfx++;
  RS.lastGfx = g;
  if (SES.role === 'cadreur' && SES.cam && pg === 'CAM' + SES.cam) RS.onAir += dt;
}
// ordres du réalisateur reçus et exécutés au mélangeur (comme le compte rendu)
export function orderStats() {
  const mixLog = SES.mixLog || [];
  let n = 0, done = 0, sum = 0;
  for (const o of SES.orders) {
    if (o.mine || !['prep', 'cut', 'mix', 'stinger'].includes(o.kind)) continue;
    n++;
    const d = o.kind === 'prep' ? mixLog.find((m) => m.at > o.at && m.pst === o.n) : mixLog.find((m) => m.at > o.at && m.pgmChanged);
    if (d) { done++; sum += (d.at - o.at) / 1000; }
  }
  return { n, done, avg: done ? sum / done : null };
}
const fr = (v, d = 1) => v.toFixed(d).replace('.', ',');
// objectifs en direct : [{ label, value, ok }] (ok : true / false / null = neutre)
export function objectives(role) {
  switch (role) {
    case 'realisateur': {
      const mine = SES.orders.filter((o) => o.mine && o.kind !== 'msg');
      return [
        { label: 'Ordres donnés', value: String(mine.length), ok: mine.length > 0 ? true : null },
        { label: 'Ralentis demandés', value: String(mine.filter((o) => o.kind === 'replay').length), ok: null },
        { label: 'Image à l\'antenne', value: (meSource(MIX.pgm) || '—').replace('CAM', 'CAM '), ok: null },
      ];
    }
    case 'truquiste': {
      const o = orderStats();
      return [
        { label: 'Ordres exécutés', value: `${o.done} / ${o.n}`, ok: o.n ? o.done === o.n : null },
        { label: 'Réaction moyenne', value: o.avg == null ? '—' : fr(o.avg) + ' s', ok: o.avg == null ? null : o.avg < 2.5 },
        { label: 'Score à l\'antenne (DSK 1)', value: MIX.dsk1.on ? 'oui' : 'non', ok: MIX.dsk1.on },
      ];
    }
    case 'evs': return [
      { label: 'Enregistrement', value: EVS.recording ? 'en cours' : 'arrêté', ok: !!EVS.recording },
      { label: 'Ralentis passés à l\'antenne', value: String(RS.replays), ok: RS.replays > 0 ? true : null },
    ];
    case 'son': {
      const l = AU.lufs.s; const comm = ['comm1', 'comm2'].every((k) => !AU.ch[k] || !AU.ch[k].intl);
      return [
        { label: 'Loudness (court terme)', value: l > -60 ? fr(l) + ' LUFS' : '—', ok: l > -60 ? Math.abs(l + 23) <= 3 : null },
        { label: 'Commentaires hors de l\'international', value: comm ? 'oui' : 'non', ok: comm },
        { label: 'Corrélation de phase', value: fr(AU.corr || 0, 2), ok: (AU.corr || 0) > 0 },
      ];
    }
    case 'vision': {
      const live = S.cams.filter((c) => c.meter && c.signalOK !== false);
      const ok = live.filter((c) => c.meter.mean > 0.3 && c.meter.mean < 0.62).length;
      return [{ label: 'Caméras bien exposées', value: `${ok} / ${live.length}`, ok: live.length ? ok === live.length : null }];
    }
    case 'technique': {
      const bad = S.cams.filter((c) => !c.signalOK || !c.genlock).length;
      const tx = (S.faults && S.faults.tx && S.txPath === 1) ? 1 : 0;
      return [
        { label: 'Liaisons caméras en défaut', value: String(bad), ok: bad === 0 },
        { label: 'Transmission', value: tx ? 'en défaut' : 'voie ' + (S.txPath || 1), ok: !tx },
      ];
    }
    case 'habillage': return [
      { label: 'Score à l\'antenne', value: MIX.dsk1.on ? 'oui' : 'non', ok: MIX.dsk1.on },
      { label: 'Graphiques envoyés', value: String(RS.gfx), ok: RS.gfx > 0 ? true : null },
    ];
    case 'cadreur': {
      const c = SES.cam ? camById(SES.cam) : null;
      const held = S.mode === 'camop' && S.camop && S.camop.id === SES.cam;
      return [
        { label: 'Votre caméra', value: c ? `CAM ${c.id} · ${c.T.short}` : 'introuvable', ok: !!c },
        { label: 'Prise en main', value: held ? 'oui' : 'non (E devant la caméra)', ok: held },
        { label: 'Temps à l\'antenne', value: `${Math.floor(RS.onAir / 60)} min ${String(Math.floor(RS.onAir % 60)).padStart(2, '0')} s`, ok: null },
      ];
    }
    case 'formateur': {
      const f = ACTIVE.filter((a) => a.session);
      return [{ label: 'Pannes résolues', value: `${f.filter((a) => a.done).length} / ${f.length}`, ok: f.length ? f.every((a) => a.done) : null }];
    }
    default: return [];
  }
}
