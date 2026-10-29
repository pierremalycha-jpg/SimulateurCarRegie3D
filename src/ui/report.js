// @ts-check
import { el } from '../util.js';
import { modal, toast } from './common.js';
import { addReport, SH } from '../shared.js';

// Signaler une erreur technique ou pédagogique : enregistré dans la progression, visible du formateur
export function openReport(where) {
  const ta = el('textarea', { rows: 6, style: { width: '100%' }, placeholder: 'Ce qui est faux ou peu clair, et ce qui serait juste dans ton car…', 'aria-label': 'Description' });
  const body = el('div', { class: 'list' },
    el('p', { class: 'note' }, `Emplacement : ${where}`),
    ta,
    el('p', { class: 'note' }, SH.db ? 'Le formateur verra ce signalement dans l\'Espace formateur (onglet Stagiaires).' : 'Hors de claude.ai, le signalement reste dans ce navigateur.'),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', onclick: () => { const t = ta.value.trim(); if (!t) { toast('Décris le problème en quelques mots'); return; } addReport(where, t); modal.close(); toast('Merci : signalement enregistré', 'good'); } }, 'Envoyer le signalement'), el('button', { class: 'btn', onclick: () => modal.close() }, 'Annuler')));
  modal.open('Signaler une erreur', body, { width: 640 });
  setTimeout(() => ta.focus(), 50);
}
