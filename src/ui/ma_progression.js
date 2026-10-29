// @ts-check
import { on } from '../state.js';
import { el } from '../util.js';
import { toast, ask } from './common.js';
import { icon } from './icons.js';
import { APP_VERSION } from '../diag.js';
import { PROG, SH, SAVE, exportProgress, importProgress, eraseProgress, offerDownload, IMPORT_MAX } from '../shared.js';
import { livret } from '../livret.js';
import { xpOf } from '../game/xp.js';

// ----------------------------------------------------------------------------------
// « Ma progression » dans les Réglages : où elle est enregistrée et si l'enregistrement marche,
// l'exporter dans un fichier (changer d'ordinateur, la remettre au formateur), importer un fichier
// (fusion : rien ne se perd), l'effacer, et ce que deviennent les données de l'élève. Un échec
// d'enregistrement est signalé tout de suite, une seule fois, par une notification.
// ----------------------------------------------------------------------------------

/** résumé d'une progression : leçons acquises, compétences travaillées, XP */
function resume(P) {
  const lecons = Object.values(P.cours || {}).filter((c) => c && c.quiz && c.quiz.total && c.quiz.score === c.quiz.total).length;
  const exos = Object.values(P.tutor || {}).filter((t) => t && t.done).length;
  const L = livret(P);
  return `${lecons} leçon${lecons > 1 ? 's' : ''} acquise${lecons > 1 ? 's' : ''}, ${exos} exercice${exos > 1 ? 's' : ''} terminé${exos > 1 ? 's' : ''}, ${L.count.travaillee + L.count.consolidee} compétence${L.count.travaillee + L.count.consolidee > 1 ? 's' : ''} travaillée${L.count.travaillee + L.count.consolidee > 1 ? 's' : ''}, ${xpOf(P)} XP`;
}
/** où la progression est enregistrée, en une phrase */
function etat() {
  const remote = !!(SH.db && SH.uid && !SH.readOnly);
  // ce navigateur refuse d'enregistrer (navigation privée, stockage plein) : le serveur de la page suffit, s'il répond
  if (SAVE.local === false && remote && SAVE.remote !== false) return { ok: true, text: 'Enregistrée sur le serveur de la page (ton compte), pas dans ce navigateur, qui refuse d\'enregistrer (navigation privée ou stockage plein).' };
  if (SAVE.local === false) return { ok: false, text: 'La progression n\'a pas pu être enregistrée dans ce navigateur (stockage plein ou désactivé). Exporte-la dans un fichier pour ne rien perdre.' };
  if (remote && SAVE.remote === false) return { ok: false, text: 'Enregistrée dans ce navigateur, mais pas sur le serveur de la page (connexion perdue ?) : un nouvel essai a lieu au prochain enregistrement.' };
  const quand = SAVE.at ? ` Dernier enregistrement à ${new Date(SAVE.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.` : '';
  if (remote) return { ok: true, text: 'Enregistrée dans ce navigateur et sur le serveur de la page (ton compte) : tu la retrouves sur un autre ordinateur.' + quand };
  if (SH.readOnly) return { ok: true, text: 'Enregistrée dans ce navigateur seulement : cette page n\'accepte pas d\'enregistrement en ligne.' + quand };
  return { ok: true, text: 'Enregistrée dans ce navigateur seulement (fichier à partager, exécutable ou réseau local) : pour changer d\'ordinateur, exporte-la puis importe-la sur l\'autre.' + quand };
}

/** la section des Réglages */
export function progressionSection() {
  const status = el('p', { class: 'mp-state', role: 'status' });
  const paint = () => { const e = etat(); status.className = 'mp-state ' + (e.ok ? 'ok' : 'err'); status.replaceChildren(icon(e.ok ? 'fait' : 'alarme'), e.text); };
  paint();
  const summary = el('p', { class: 'note' }, 'Sur cet ordinateur : ' + resume(PROG) + '.');
  const msg = el('p', { class: 'note mp-msg', 'aria-live': 'polite' });
  const file = el('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Fichier de progression à importer', style: { display: 'none' } });
  file.addEventListener('change', async () => {
    const f = /** @type {HTMLInputElement} */ (file).files?.[0]; /** @type {HTMLInputElement} */ (file).value = '';
    if (!f) return;
    if (f.size > IMPORT_MAX) { msg.textContent = 'Ce fichier est trop gros pour une progression (5 Mo au plus).'; return; }
    const r = importProgress(await f.text());
    if (!r.ok) { msg.textContent = 'Import impossible : ' + r.error; toast('Import impossible : ' + r.error, 'bad', 5000); return; }
    summary.textContent = 'Sur cet ordinateur : ' + resume(PROG) + '.';
    msg.textContent = `Progression importée et fusionnée${r.at ? ` (fichier du ${new Date(r.at).toLocaleDateString('fr-FR')})` : ''} : rien n'a été effacé, chaque réussite et le meilleur score de chaque essai sont gardés.`;
    toast('Progression importée', 'good');
  });
  const exporter = async () => {
    const name = `tiee-progression-${new Date().toISOString().slice(0, 10)}.json`;
    const r = await offerDownload(name, exportProgress(APP_VERSION));
    msg.textContent = r === 'saved' ? `Fichier « ${name} » enregistré : garde-le, ou importe-le sur un autre ordinateur.` : r === 'declined' ? 'Export annulé.' : 'L\'export n\'a pas pu se faire dans ce navigateur.';
  };
  const effacer = async () => {
    const ok = await ask('Toute ta progression sera effacée : leçons acquises, exercices, scores, XP et badges, dans ce navigateur et sur le serveur de la page.\n\nExporte-la d\'abord si tu veux la garder. Cette action ne se défait pas.', { title: 'Effacer ma progression', ok: 'Effacer définitivement', danger: true });
    if (ok !== true) return;
    const r = await eraseProgress();
    if (!r.ok) { msg.textContent = r.error || 'Effacement incomplet.'; return; }
    toast('Progression effacée', 'good');
    setTimeout(() => location.reload(), 600);
  };
  return el('section', { class: 'rg-sec', id: 'rg-progression' }, el('h3', {}, 'Ma progression'),
    status, summary,
    el('div', { class: 'hwrow' },
      el('button', { type: 'button', class: 'btn', id: 'mp-export', onclick: exporter }, 'Exporter dans un fichier'),
      el('button', { type: 'button', class: 'btn', id: 'mp-import', onclick: () => /** @type {HTMLInputElement} */ (file).click() }, 'Importer un fichier'),
      el('button', { type: 'button', class: 'btn danger', id: 'mp-erase', onclick: effacer }, 'Effacer ma progression'),
      file),
    msg,
    el('details', { class: 'mp-rgpd' }, el('summary', {}, 'Tes données personnelles'),
      el('p', {}, el('b', {}, 'Ce qui est enregistré. '), 'Ta progression (leçons, quiz, exercices, scores, XP et badges, postes visités, dates de réception et de lecture des mails de la Carrière), les erreurs que tu signales et le test de performance de l\'ordinateur (carte graphique, images par seconde). En coopération : ton pseudo et ton rôle, et le compte rendu de la partie (temps de réaction aux ordres, pannes résolues).'),
      el('p', {}, el('b', {}, 'Où. '), 'Dans ce navigateur. Sur la page publiée sur claude.ai, aussi dans la base de données de la page, rattachée à ton compte : le formateur qui a publié la page la voit dans son suivi des stagiaires. En réseau local, les comptes rendus de partie sont enregistrés sur l\'ordinateur du formateur qui fait tourner le serveur.'),
      el('p', {}, el('b', {}, 'Ce qui n\'est pas fait. '), 'Ni publicité, ni mesure d\'audience, ni revente. Les polices sont intégrées à la page. La page publiée charge son moteur 3D (three.js) depuis le service jsDelivr, qui voit donc l\'adresse IP de l\'ordinateur ; le fichier à partager et l\'exécutable n\'appellent aucun service extérieur, sauf l\'import d\'un fichier Excel par le formateur (bibliothèque chargée depuis cdnjs).'),
      el('p', {}, el('b', {}, 'Tes droits. '), 'Consulter (« Exporter dans un fichier »), effacer (« Effacer ma progression » : ce navigateur et la copie du serveur), ou le demander au formateur ou à l\'établissement, responsables du traitement. Les autres ordinateurs que tu as utilisés gardent leur copie : efface-la aussi sur chacun.')));
}

// un échec d'enregistrement se dit tout de suite, une seule fois (et le retour à la normale aussi)
on('progressSave', (/** @type {{ where: string, ok: boolean }} */ e) => {
  if (!e) return;
  const remote = !!(SH.db && SH.uid && !SH.readOnly);
  if (!e.ok && e.where === 'local' && remote) toast('Ce navigateur n\'enregistre pas la progression (navigation privée ou stockage plein) : elle est gardée sur le serveur de la page.', '', 6000);
  else if (!e.ok) toast(e.where === 'local' ? 'La progression ne s\'enregistre plus dans ce navigateur (stockage plein ou désactivé) : exporte-la depuis Réglages → Ma progression.' : 'La progression n\'a pas pu être envoyée au serveur de la page : elle reste dans ce navigateur, nouvel essai au prochain enregistrement.', 'bad', 8000);
  else if (e.where === 'remote' && SAVE.local !== false) toast('La progression est de nouveau enregistrée sur le serveur.', 'good');
});
