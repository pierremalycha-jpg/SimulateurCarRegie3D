// @ts-check
// ----------------------------------------------------------------------------------
// Les valeurs de Cloud Firestore telles que les écrit son interface REST : chaque valeur porte son
// type ({ stringValue }, { integerValue } en texte, { mapValue: { fields } }…). Calcul pur, sans
// réseau : traduire un objet JavaScript en document et un document en objet (src/compte/firebase.js).
// Les entiers voyagent en texte (64 bits) : relus, ils redeviennent des nombres. Les nombres non finis,
// undefined et les fonctions sont laissés de côté, comme le ferait JSON.stringify.
// ----------------------------------------------------------------------------------

/** une valeur JavaScript → valeur Firestore (undefined si elle ne s'écrit pas) @returns {any} */
export function versValeur(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return undefined;
    return Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map((x) => versValeur(x) ?? { nullValue: null }) } };
  if (typeof v === 'object') return { mapValue: { fields: versChamps(v) } };
  return undefined;
}
/** @param {Record<string, any>} o @returns {Record<string, any>} */
export function versChamps(o) {
  /** @type {Record<string, any>} */ const f = {};
  for (const [k, x] of Object.entries(o)) { const y = versValeur(x); if (y !== undefined) f[k] = y; }
  return f;
}
/** une valeur Firestore → valeur JavaScript @returns {any} */
export function depuisValeur(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return String(v.stringValue);
  if ('timestampValue' in v) return Date.parse(v.timestampValue) || 0;
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(depuisValeur);
  if ('mapValue' in v) return depuisChamps((v.mapValue && v.mapValue.fields) || {});
  if ('referenceValue' in v) return String(v.referenceValue);
  return null;
}
/** @param {Record<string, any>} f @returns {Record<string, any>} */
export function depuisChamps(f) {
  /** @type {Record<string, any>} */ const o = {};
  for (const [k, x] of Object.entries(f || {})) o[k] = depuisValeur(x);
  return o;
}
/** un objet → corps d'un document (PATCH) */
export const versDocument = (o) => ({ fields: versChamps(o) });
/** un document lu → { id, data } (id : le dernier morceau du chemin) */
export function depuisDocument(doc) {
  const name = String((doc && doc.name) || '');
  return { id: name.slice(name.lastIndexOf('/') + 1), data: depuisChamps((doc && doc.fields) || {}) };
}
