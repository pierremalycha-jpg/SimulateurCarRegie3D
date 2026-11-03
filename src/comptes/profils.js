// @ts-check
import { on, emit } from '../state.js';
import { PROG } from '../shared.js';
import { COMPTE, connecte, estEleve } from './session.js';
import { comptesDisponibles, ecrireProfil, effacerProfil, lireProfil, lireClassement } from './firebase.js';
import { profil, profilPourCompte } from '../game/pass.js';

// ----------------------------------------------------------------------------------
// Le profil public et le classement (v19.27), sur les comptes de l'établissement (src/comptes/) :
//   profils/<uid> : ce que les autres comptes voient d'un élève (game/pass.js, profilPourCompte : pseudo,
//                   apparence, niveau, badges, quelques chiffres ; jamais l'adresse ni les réponses).
// Seuls les élèves sont au classement ; un professeur le consulte. Un élève qui se cache efface son
// profil public. Écritures limitées (forfait gratuit de Firebase : 20 000 par jour pour tout
// l'établissement) : à la connexion, puis au plus une toutes les deux minutes, quand le niveau, un badge
// ou l'apparence changent, ou à l'ouverture du classement.
// ----------------------------------------------------------------------------------
export const PUBLIER_MIN_MS = 120000;
const PUB = { at: 0, t: /** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined), uid: '' };

/** le classement est-il possible ici (projet Firebase, compte connecté) ? */
export const classementDispo = () => comptesDisponibles() && connecte();

/** écrit le profil public de l'élève connecté (ou l'efface s'il s'est caché) ; un professeur n'en a pas */
export async function publierProfil() {
  clearTimeout(PUB.t);
  if (!estEleve() || !COMPTE.uid) return false;
  const uid = COMPTE.uid;
  try {
    if (!profil().visible) await effacerProfil(uid);
    else await ecrireProfil(uid, profilPourCompte(PROG, COMPTE));
    PUB.at = Date.now(); PUB.uid = uid; emit('profilPublie');
    return true;
  } catch (e) { console.warn('profil public :', e && e.message); return false; }
}
/** publie bientôt (au plus une écriture toutes les deux minutes) */
export function publierBientot(force = false) {
  if (!estEleve()) return;
  clearTimeout(PUB.t);
  const reste = force || PUB.uid !== COMPTE.uid ? 1500 : Math.max(1500, PUBLIER_MIN_MS - (Date.now() - PUB.at));
  PUB.t = setTimeout(() => { publierProfil(); }, reste);
}
/** le classement : les élèves, du plus haut niveau au plus bas (XP) */
export async function classement() {
  if (!classementDispo()) return { ok: false, liste: /** @type {Array<{ id: string, data: any }>} */ ([]), error: 'Connecte-toi pour voir le classement.' };
  try { return { ok: true, liste: (await lireClassement(100)).filter((x) => x.data && x.data.role === 'eleve') }; }
  catch (e) { return { ok: false, liste: [], error: (e && e.code === 'permission-denied') ? 'Le classement n\'est pas encore ouvert sur la base de l\'établissement (règles Firestore à déployer).' : 'Classement indisponible (connexion à Internet ?).' }; }
}
/** le profil public d'un élève (null s'il n'existe pas ou s'il s'est caché) */
export async function profilDe(/** @type {string} */ uid) {
  if (!classementDispo()) return null;
  try { return await lireProfil(uid); } catch (e) { return null; }
}
// à la connexion d'un élève, puis à chaque changement qui se voit (niveau, badge, apparence)
on('compte', () => { if (estEleve()) publierBientot(true); else clearTimeout(PUB.t); });
on('pass', () => publierBientot());
on('badge', () => publierBientot());
on('xp', (r) => { if (r && r.leveled) publierBientot(); });
