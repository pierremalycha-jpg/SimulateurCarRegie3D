// @ts-check
import { emit } from '../state.js';

// ----------------------------------------------------------------------------------
// Profil de la personne devant l'écran : étudiant ou formateur. L'étudiant voit Jouer, Cours,
// Chef de car et Réglages ; le formateur voit en plus l'espace formateur (configuration du car,
// suivi des stagiaires, relecture technique). Le choix est mémorisé sur l'ordinateur et se change
// sur l'écran titre. Ce n'est pas une protection : juste une interface rangée pour chacun.
// ----------------------------------------------------------------------------------
export const PROFILE = { role: /** @type {'etudiant' | 'formateur'} */ ('etudiant') };
try { const r = localStorage.getItem('carregie.profil'); if (r === 'formateur' || r === 'etudiant') PROFILE.role = r; } catch (e) { /* stockage indisponible */ }

export const isTrainer = () => PROFILE.role === 'formateur';
export const ROLE_LABEL = { etudiant: 'Étudiant', formateur: 'Formateur' };

/** change le profil (mémorisé) ; la page porte la classe role-formateur pour les éléments réservés */
export function setRole(r) {
  PROFILE.role = r === 'formateur' ? 'formateur' : 'etudiant';
  try { localStorage.setItem('carregie.profil', PROFILE.role); } catch (e) { /* stockage indisponible */ }
  applyRole();
  emit('profile', PROFILE.role);
}
export function applyRole() { document.body.classList.toggle('role-formateur', isTrainer()); }
