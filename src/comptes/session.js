// @ts-check
import { emit } from '../state.js';
import { useAccount } from '../shared.js';
import { forceRole } from '../app/profile.js';
import { comptesDisponibles, suivreSession, base } from './firebase.js';

// ----------------------------------------------------------------------------------
// La session de compte dans l'application (v19.24) : à l'ouverture, Firebase rend la session gardée
// par le navigateur ; à chaque connexion ou déconnexion, la progression change de propriétaire
// (shared.js, useAccount : celle du compte, jamais celle d'un autre) et le rôle suit le compte (un
// élève reste Étudiant, un professeur est Formateur). L'événement « compte » prévient l'interface
// (écran titre, Réglages, tableau de bord). Sans projet Firebase renseigné : rien ne change.
// ----------------------------------------------------------------------------------
/**
 * @type {{ dispo: boolean, pret: boolean, etat: 'deconnecte' | 'connecte' | 'verifier' | 'refuse', uid?: string, role?: 'prof' | 'eleve',
 *   prenom?: string, nom?: string, identifiant?: string, email?: string, classe?: string | null, classeNom?: string, message?: string }}
 */
export const COMPTE = { dispo: false, pret: false, etat: 'deconnecte' };
export const connecte = () => COMPTE.etat === 'connecte';
export const estProf = () => connecte() && COMPTE.role === 'prof';
export const estEleve = () => connecte() && COMPTE.role === 'eleve';
/** « Léa Martin », sinon l'identifiant ou l'adresse */
export const nomDuCompte = () => [COMPTE.prenom, COMPTE.nom].filter(Boolean).join(' ') || COMPTE.identifiant || COMPTE.email || '';

let file = Promise.resolve();
export function initComptes() {
  COMPTE.dispo = comptesDisponibles();
  if (!COMPTE.dispo) { COMPTE.pret = true; return; }
  try {
    suivreSession((c) => {
      // les changements s'enchaînent dans l'ordre (la progression d'un compte s'enregistre avant de passer au suivant)
      file = file.then(async () => {
        for (const k of ['uid', 'role', 'prenom', 'nom', 'identifiant', 'email', 'classe', 'classeNom', 'message']) delete /** @type {any} */ (COMPTE)[k];
        Object.assign(COMPTE, c, { dispo: true, pret: true });
        const ok = c.etat === 'connecte' && c.uid;
        await useAccount(ok ? { uid: /** @type {string} */ (c.uid), db: base(), prof: c.role === 'prof' } : null);
        forceRole(ok ? (c.role === 'prof' ? 'formateur' : 'etudiant') : null);
        document.body.classList.toggle('compte-eleve', !!ok && c.role === 'eleve');
        document.body.classList.toggle('compte-prof', !!ok && c.role === 'prof');
        emit('compte', COMPTE);
      }).catch((e) => console.error(e));
    });
  } catch (e) {
    console.error(e);
    COMPTE.dispo = false; COMPTE.pret = true;
  }
}
