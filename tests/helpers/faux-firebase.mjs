// Un faux Firebase en mémoire, pour les tests (unitaires : fetch ; bout en bout : page.route) : les
// requêtes REST qu'envoie src/compte/firebase.js (Authentication : signUp, signInWithPassword,
// sendOobCode, delete, token ; Firestore : lire, écrire, effacer un document, runQuery trié et limité),
// avec les règles de firestore.rules en résumé (progress : soi seul ; profils : lus par les connectés).
import { depuisChamps } from '../../src/compte/firestore.js';

export function fauxFirebase() {
  const comptes = new Map();   // email -> { uid, mdp }
  const jetons = new Map();    // idToken -> uid
  const docs = new Map();      // 'progress/uid' -> { fields }
  const journal = [];
  let n = 0;
  const neuf = (uid, email) => { const idToken = 'id-' + (++n) + '-' + uid; jetons.set(idToken, uid); return { localId: uid, email, idToken, refreshToken: 'rf-' + uid, expiresIn: '3600' }; };
  const err = (status, message, st) => ({ status, body: { error: { code: status, message, ...(st ? { status: st } : {}) } } });
  const qui = (h) => { const a = (h && (h.authorization || h.Authorization)) || ''; return jetons.get(a.replace(/^Bearer /, '')) || null; };
  /**
   * @param {string} url @param {{ method?: string, headers?: any, body?: string }} o
   * @returns {{ status: number, body: any }}
   */
  function handle(url, o = {}) {
    const u = new URL(url); const m = (o.method || 'GET').toUpperCase(); journal.push(m + ' ' + u.pathname);
    let b; try { b = o.body ? (String(o.body).startsWith('{') ? JSON.parse(o.body) : Object.fromEntries(new URLSearchParams(o.body))) : {}; } catch (e) { b = {}; }
    if (u.hostname === 'identitytoolkit.googleapis.com') {
      const act = u.pathname.split(':').pop();
      if (act === 'signUp') {
        if (comptes.has(b.email)) return err(400, 'EMAIL_EXISTS');
        if (String(b.password || '').length < 6) return err(400, 'WEAK_PASSWORD : Password should be at least 6 characters');
        const uid = 'u' + (comptes.size + 1); comptes.set(b.email, { uid, mdp: b.password });
        return { status: 200, body: neuf(uid, b.email) };
      }
      if (act === 'signInWithPassword') { const c = comptes.get(b.email); if (!c || c.mdp !== b.password) return err(400, 'INVALID_LOGIN_CREDENTIALS'); return { status: 200, body: neuf(c.uid, b.email) }; }
      if (act === 'sendOobCode') return comptes.has(b.email) ? { status: 200, body: { email: b.email } } : err(400, 'EMAIL_NOT_FOUND');
      if (act === 'delete') { const uid = jetons.get(b.idToken); if (!uid) return err(400, 'INVALID_ID_TOKEN'); for (const [e, c] of comptes) if (c.uid === uid) comptes.delete(e); return { status: 200, body: {} }; }
      return err(400, 'INCONNU');
    }
    if (u.hostname === 'securetoken.googleapis.com') {
      const uid = String(b.refresh_token || '').replace(/^rf-/, '');
      if (![...comptes.values()].some((c) => c.uid === uid)) return err(400, 'INVALID_REFRESH_TOKEN');
      const s = neuf(uid, ''); return { status: 200, body: { id_token: s.idToken, refresh_token: s.refreshToken, user_id: uid, expires_in: '3600' } };
    }
    if (u.hostname === 'firestore.googleapis.com') {
      const uid = qui(o.headers);
      if (!uid) return err(401, 'Request had invalid authentication credentials.', 'UNAUTHENTICATED');
      const p = decodeURIComponent(u.pathname.replace(/^.*\/documents\/?/, ''));
      if (u.pathname.endsWith(':runQuery')) {
        const q = b.structuredQuery; const col = q.from[0].collectionId;
        if (col !== 'profils') return err(403, 'Missing or insufficient permissions.', 'PERMISSION_DENIED');
        let l = [...docs.entries()].filter(([k]) => k.startsWith(col + '/')).map(([k, d]) => ({ name: 'projects/x/databases/(default)/documents/' + k, fields: d.fields }));
        if (q.orderBy) { const f = q.orderBy[0].field.fieldPath, s = q.orderBy[0].direction === 'DESCENDING' ? -1 : 1; l.sort((x, y) => s * ((depuisChamps(x.fields)[f] || 0) - (depuisChamps(y.fields)[f] || 0))); }
        if (q.limit) l = l.slice(0, q.limit);
        return { status: 200, body: l.length ? l.map((document) => ({ document, readTime: 'x' })) : [{ readTime: 'x' }] };
      }
      const [col, id] = p.split('/');
      const lecture = col === 'profils' || (col === 'progress' && id === uid);
      const ecriture = (col === 'profils' || col === 'progress') && id === uid;
      if (m === 'GET') { if (!lecture) return err(403, 'Missing or insufficient permissions.', 'PERMISSION_DENIED'); const d = docs.get(p); return d ? { status: 200, body: { name: 'projects/x/databases/(default)/documents/' + p, fields: d.fields } } : err(404, `Document "${p}" not found.`, 'NOT_FOUND'); }
      if (!ecriture) return err(403, 'Missing or insufficient permissions.', 'PERMISSION_DENIED');
      if (m === 'PATCH') { docs.set(p, { fields: b.fields }); return { status: 200, body: { name: p, fields: b.fields } }; }
      if (m === 'DELETE') { docs.delete(p); return { status: 200, body: {} }; }
    }
    return { status: 404, body: {} };
  }
  /** un fetch qui passe par handle (tests unitaires) @type {typeof fetch} */
  const fetch = async (url, o) => { const r = handle(String(url), /** @type {any} */ (o)); return /** @type {any} */ ({ ok: r.status < 300, status: r.status, json: async () => r.body }); };
  /** lit un document du faux Firestore, en objet */
  const lire = (p) => { const d = docs.get(p); return d ? depuisChamps(d.fields) : null; };
  return { handle, fetch, comptes, docs, journal, lire };
}
