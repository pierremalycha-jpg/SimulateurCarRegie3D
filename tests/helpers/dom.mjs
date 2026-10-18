// Remplaçant minimal du DOM pour les tests Node : assez pour que les modules qui dessinent des
// étiquettes ou des écrans sur un canvas (sprites, textures) puissent créer leurs objets.
// Rien n'est rendu ; seule la logique est vérifiée.
const ctx2d = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return (s) => ({ width: String(s).length * 7 });
    if (k === 'getImageData' || k === 'createImageData') return (x, y, w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
    if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop() {} });
    return () => {};
  },
  set(t, k, v) { t[k] = v; return true; },
});
function element(tag) {
  const e = { tagName: String(tag).toUpperCase(), style: {}, children: [], width: 300, height: 150, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } };
  e.getContext = () => ctx2d();
  e.appendChild = e.append = (...c) => { e.children.push(...c); return c[0]; };
  e.addEventListener = e.removeEventListener = e.setAttribute = e.removeAttribute = () => {};
  e.toDataURL = () => 'data:,';
  return e;
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { createElement: element, createElementNS: (_ns, tag) => element(tag), body: element('body'), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
}
