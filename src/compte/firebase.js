// @ts-check
import { versDocument, depuisDocument, versValeur } from './firestore.js';

// ----------------------------------------------------------------------------------
// Firebase par son interface REST, sans bibliothèque : Authentication (adresse et mot de passe,
// jeton renouvelé), Cloud Firestore (lire, écrire, effacer un document ; une requête triée).
// Rien n'est retenu ici : la session est un objet que l'appelant garde (src/compte/index.js).
// Les erreurs sont traduites en une phrase lisible ; err.code garde le code de Firebase.
//   session : { uid, email, idToken, refreshToken, exp }   (exp : fin de validité du jeton, en ms)
// ----------------------------------------------------------------------------------
/** @typedef {{ uid: string, email: string, idToken: string, refreshToken: string, exp: number }} Session */

const MESSAGES = {
  EMAIL_EXISTS: 'Cette adresse a déjà un compte : connectez-vous.',
  EMAIL_NOT_FOUND: 'Adresse ou mot de passe incorrect.',
  INVALID_PASSWORD: 'Adresse ou mot de passe incorrect.',
  INVALID_LOGIN_CREDENTIALS: 'Adresse ou mot de passe incorrect.',
  INVALID_EMAIL: 'Cette adresse électronique n\'est pas valide.',
  MISSING_PASSWORD: 'Il manque le mot de passe.',
  MISSING_EMAIL: 'Il manque l\'adresse électronique.',
  WEAK_PASSWORD: 'Mot de passe trop court : 6 caractères au moins.',
  USER_DISABLED: 'Ce compte a été désactivé par le formateur.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Trop d\'essais : réessayez dans quelques minutes.',
  OPERATION_NOT_ALLOWED: 'La connexion par adresse et mot de passe n\'est pas activée dans le projet Firebase.',
  TOKEN_EXPIRED: 'Session expirée : reconnectez-vous.',
  INVALID_REFRESH_TOKEN: 'Session expirée : reconnectez-vous.',
  USER_NOT_FOUND: 'Ce compte n\'existe plus : reconnectez-vous.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Pour cette opération, reconnectez-vous d\'abord.',
  PERMISSION_DENIED: 'Accès refusé par les règles de sécurité du projet Firebase.',
  UNAUTHENTICATED: 'Session expirée : reconnectez-vous.',
  NOT_FOUND: 'La base Firestore du projet n\'existe pas encore.',
  RESOURCE_EXHAUSTED: 'Quota du projet Firebase dépassé pour aujourd\'hui : réessayez demain.',
  API_KEY_INVALID: 'La clé du projet Firebase n\'est pas valide.',
  RESEAU: 'Pas de connexion au serveur des comptes (Internet coupé ou bloqué).',
};
/** une erreur lisible, avec le code de Firebase */
export function erreur(code, detail = '') {
  const c = String(code || 'INCONNUE').split(':')[0].trim().split(' ')[0];
  const e = /** @type {Error & { code: string }} */ (new Error(MESSAGES[c] || `Erreur du serveur des comptes (${c}${detail ? ' : ' + detail : ''}).`));
  e.code = c; return e;
}

/**
 * @param {{ apiKey: string, projectId: string }} cfg
 * @param {typeof fetch} [fetchFn]
 */
export function clientFirebase(cfg, fetchFn) {
  const http = fetchFn || ((/** @type {any} */ u, /** @type {any} */ o) => fetch(u, o));
  const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts:';
  const JETON = 'https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(cfg.apiKey);
  const BASE = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents`;

  async function appel(url, o) {
    let r;
    try { r = await http(url, o); } catch (e) { throw erreur('RESEAU'); }
    let j = null; try { j = await r.json(); } catch (e) { /* corps vide */ }
    if (!r.ok) {
      const er = (j && (j.error || (Array.isArray(j) && j[0] && j[0].error))) || {};
      // Authentication : error.message = « EMAIL_EXISTS » ; Firestore : error.status = « PERMISSION_DENIED »
      const reason = Array.isArray(er.details) && er.details[0] && er.details[0].reason;
      const msg = typeof er.message === 'string' && /^[A-Z_]{4,}/.test(er.message) ? er.message : '';
      throw erreur(reason || msg || er.status || (r.status === 404 ? 'NOT_FOUND' : 'HTTP_' + r.status), typeof er.message === 'string' ? er.message : '');
    }
    return j;
  }
  const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  /** @returns {Session} */
  const session = (j, email) => ({ uid: j.localId || j.user_id, email: j.email || email || '', idToken: j.idToken || j.id_token, refreshToken: j.refreshToken || j.refresh_token, exp: Date.now() + (Number(j.expiresIn || j.expires_in) || 3600) * 1000 });

  /** @param {Session} s */
  async function jeton(s) {
    if (s.idToken && s.exp - Date.now() > 90 * 1000) return s.idToken;
    const j = await appel(JETON, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(s.refreshToken) });
    Object.assign(s, session(j, s.email));
    return s.idToken;
  }
  const auth = async (/** @type {Session} */ s) => ({ authorization: 'Bearer ' + (await jeton(s)) });
  const chemin = (p) => String(p).split('/').map(encodeURIComponent).join('/');

  return {
    /** crée le compte @returns {Promise<Session>} */
    async inscrire(email, mdp) { return session(await appel(AUTH + 'signUp?key=' + encodeURIComponent(cfg.apiKey), json({ email, password: mdp, returnSecureToken: true })), email); },
    /** @returns {Promise<Session>} */
    async connecter(email, mdp) { return session(await appel(AUTH + 'signInWithPassword?key=' + encodeURIComponent(cfg.apiKey), json({ email, password: mdp, returnSecureToken: true })), email); },
    /** envoie le mail « mot de passe oublié » */
    async oubli(email) { await appel(AUTH + 'sendOobCode?key=' + encodeURIComponent(cfg.apiKey), json({ requestType: 'PASSWORD_RESET', email })); },
    /** renouvelle le jeton si besoin (session reprise au démarrage) @param {Session} s */
    jeton,
    /** efface le compte (Authentication) @param {Session} s */
    async supprimerCompte(s) { await appel(AUTH + 'delete?key=' + encodeURIComponent(cfg.apiKey), json({ idToken: await jeton(s) })); },
    /** un document, ou null s'il n'existe pas @param {Session} s @param {string} p */
    async lire(s, p) {
      try { return depuisDocument(await appel(BASE + '/' + chemin(p), { headers: await auth(s) })).data; }
      catch (e) { if (e.code === 'NOT_FOUND' || e.code === 'HTTP_404') return null; throw e; }
    },
    /** écrit (remplace) un document @param {Session} s @param {string} p @param {Record<string, any>} data */
    async ecrire(s, p, data) { await appel(BASE + '/' + chemin(p), { method: 'PATCH', headers: { 'content-type': 'application/json', ...(await auth(s)) }, body: JSON.stringify(versDocument(data)) }); },
    /** @param {Session} s @param {string} p */
    async effacer(s, p) { try { await appel(BASE + '/' + chemin(p), { method: 'DELETE', headers: await auth(s) }); } catch (e) { if (e.code !== 'NOT_FOUND') throw e; } },
    /**
     * les documents d'une collection, triés (une seule clé), filtrés par égalité, limités
     * @param {Session} s @param {string} collection
     * @param {{ tri?: string, desc?: boolean, limite?: number, egal?: [string, any] }} [o]
     * @returns {Promise<Array<{ id: string, data: Record<string, any> }>>}
     */
    async requete(s, collection, o = {}) {
      /** @type {any} */ const q = { from: [{ collectionId: collection }] };
      if (o.egal) q.where = { fieldFilter: { field: { fieldPath: o.egal[0] }, op: 'EQUAL', value: versValeur(o.egal[1]) } };
      if (o.tri) q.orderBy = [{ field: { fieldPath: o.tri }, direction: o.desc ? 'DESCENDING' : 'ASCENDING' }];
      if (o.limite) q.limit = o.limite;
      const r = await appel(BASE + ':runQuery', { ...json({ structuredQuery: q }), headers: { 'content-type': 'application/json', ...(await auth(s)) } });
      return (Array.isArray(r) ? r : []).filter((x) => x && x.document).map((x) => depuisDocument(x.document));
    },
  };
}
