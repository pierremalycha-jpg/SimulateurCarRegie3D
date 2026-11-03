// @ts-check
// ----------------------------------------------------------------------------------
// Le projet Firebase des comptes : sa clé d'API web et son identifiant. Ce ne sont pas des secrets
// (Google les envoie à tout navigateur qui ouvre une page Firebase) : ce qui protège les données, ce
// sont les règles de sécurité de Firestore (firestore.rules), qui ne laissent chacun écrire que chez lui.
// Ils viennent, dans l'ordre :
//   1. de la construction (tools/build.mjs : variable TIEE_FIREBASE ou fichier firebase.web.json) ;
//   2. de ce navigateur (clé « carregie.firebase », posée par le formateur dans Réglages → Mon compte,
//      ou par les tests de bout en bout).
// Sans eux, le simulateur marche comme avant : la progression reste sur l'ordinateur.
// ----------------------------------------------------------------------------------
/** @typedef {{ apiKey: string, projectId: string, authDomain?: string }} ConfigFirebase */

/** @param {any} c @returns {ConfigFirebase | null} */
export function configValide(c) {
  if (!c || typeof c !== 'object') return null;
  const apiKey = String(c.apiKey || '').trim(), projectId = String(c.projectId || '').trim();
  if (!/^[\w-]{20,60}$/.test(apiKey) || !/^[a-z0-9][a-z0-9-]{3,40}$/.test(projectId)) return null;
  return { apiKey, projectId, authDomain: String(c.authDomain || projectId + '.firebaseapp.com') };
}
/** lit une configuration collée : le JSON, ou l'objet « const firebaseConfig = { … } » de la console Firebase */
export function lireConfig(text) {
  const t = String(text || '').trim(); if (!t) return null;
  try { return configValide(JSON.parse(t)); } catch (e) { /* pas du JSON pur : on cherche les deux clés */ }
  const k = /apiKey\s*:\s*["']([^"']+)["']/.exec(t), p = /projectId\s*:\s*["']([^"']+)["']/.exec(t);
  return k && p ? configValide({ apiKey: k[1], projectId: p[1] }) : null;
}

const construite = configValide(typeof __TIEE_FIREBASE__ !== 'undefined' ? __TIEE_FIREBASE__ : null);
/** la configuration en vigueur (null : pas de compte en ligne) @returns {ConfigFirebase | null} */
export function configFirebase() {
  try { const l = configValide(JSON.parse(localStorage.getItem('carregie.firebase') || 'null')); if (l) return l; } catch (e) { /* stockage indisponible */ }
  return construite;
}
/** la configuration vient-elle de ce navigateur (et peut-elle s'y retirer) ? */
export const configLocale = () => { try { return !!configValide(JSON.parse(localStorage.getItem('carregie.firebase') || 'null')); } catch (e) { return false; } };
/** pose (ou retire, null) la configuration de ce navigateur */
export function poserConfig(c) {
  try { if (c) localStorage.setItem('carregie.firebase', JSON.stringify(c)); else localStorage.removeItem('carregie.firebase'); return true; } catch (e) { return false; }
}
