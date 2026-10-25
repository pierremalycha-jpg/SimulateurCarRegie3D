// @ts-check
import * as THREE from 'three';
import { BUREAU, HALL, canvasTex, put, FONT } from './kit.js';

// ----------------------------------------------------------------------------------
// Le bureau du planning, à l'avant gauche du hall : une table, un fauteuil, l'unité centrale,
// le clavier et l'écran de l'ordinateur où arrivent les mails de la Carrière. L'écran est une
// texture dessinée (draw) : la messagerie et ses mails non lus en mode Carrière, la session
// verrouillée sinon. L'écran et l'unité centrale se cliquent (pick).
// ----------------------------------------------------------------------------------
/** @typedef {{ actif: boolean, societe: string, nonLus: number, lignes: Array<{ de: string, objet: string, lu: boolean }> }} Ecran */

const std = (bin, color, roughness = 0.8, metalness = 0, o = {}) => bin.add(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...o }));
const box = (bin, w, h, d) => bin.add(new THREE.BoxGeometry(w, h, d));

/** dessine l'écran de l'ordinateur @param {CanvasRenderingContext2D} g @param {number} w @param {number} h @param {Ecran} e */
function draw(g, w, h, e) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#13233b'); gr.addColorStop(1, '#0a1424'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.textBaseline = 'middle';
  // la barre de la fenêtre
  g.fillStyle = '#1e3557'; g.fillRect(0, 0, w, 34);
  g.fillStyle = '#e8b400'; g.fillRect(0, 34, w, 3);
  g.fillStyle = '#dfe8f2'; g.font = `700 19px ${FONT}`; g.textAlign = 'left'; g.fillText(e.actif ? 'Messagerie' : e.societe.toUpperCase(), 14, 18, w * 0.6);
  g.font = `600 15px ${FONT}`; g.textAlign = 'right'; g.fillStyle = '#9fb3c8'; g.fillText(e.actif ? e.societe : '', w - 14, 18, w * 0.38);
  g.textAlign = 'left';
  if (!e.actif) {
    g.fillStyle = '#dfe8f2'; g.font = `700 30px ${FONT}`; g.textAlign = 'center'; g.fillText('Session verrouillée', w / 2, h * 0.52);
    g.fillStyle = '#7f93a8'; g.font = `500 17px ${FONT}`; g.fillText('Jouer · L\'entrepôt · Carrière', w / 2, h * 0.66);
    return;
  }
  // le bandeau des nouveaux mails
  const n = e.nonLus;
  g.fillStyle = n ? '#e8b400' : '#2a4467'; g.fillRect(14, 50, w - 28, 44);
  g.fillStyle = n ? '#1a1300' : '#cfe0f2'; g.font = `700 22px ${FONT}`;
  g.fillText(n ? `${n} nouveau${n > 1 ? 'x' : ''} mail${n > 1 ? 's' : ''}` : 'Aucun nouveau mail', 28, 72, w - 56);
  // les derniers mails
  let y = 112;
  for (const l of e.lignes.slice(0, 4)) {
    g.fillStyle = l.lu ? 'rgba(255,255,255,0.04)' : 'rgba(232,180,0,0.12)'; g.fillRect(14, y, w - 28, 40);
    if (!l.lu) { g.fillStyle = '#e8b400'; g.beginPath(); g.arc(28, y + 20, 5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#dfe8f2'; g.font = `${l.lu ? 500 : 700} 15px ${FONT}`; g.fillText(l.de, 42, y + 12, w - 70);
    g.fillStyle = '#9fb3c8'; g.font = `500 14px ${FONT}`; g.fillText(l.objet, 42, y + 29, w - 70);
    y += 46;
  }
}

/**
 * Construit le bureau dans la scène.
 * @param {THREE.Scene} scene @param {ReturnType<import('./kit.js').makeBin>} bin @param {string} quality
 */
export function buildBureau(scene, bin, quality) {
  const low = quality === 'basse';
  const B = BUREAU;
  const g = new THREE.Group(); g.name = 'bureau'; scene.add(g);
  const pied = std(bin, '#3a4048', 0.6, 0.4), plateau = std(bin, '#b9a585', 0.7), noir = std(bin, '#16191c', 0.55, 0.2), gris = std(bin, '#2b3036', 0.6, 0.3);
  // la table : plateau bois clair, deux pieds en T, un voile de fond
  put(new THREE.Mesh(box(bin, B.w, 0.03, B.d), plateau), [B.x, B.top - 0.015, B.z], null, g);
  for (const sx of [-1, 1]) {
    put(new THREE.Mesh(box(bin, 0.05, B.top - 0.03, 0.05), pied), [B.x + sx * (B.w / 2 - 0.08), (B.top - 0.03) / 2, B.z], null, g);
    put(new THREE.Mesh(box(bin, 0.06, 0.03, B.d - 0.08), pied), [B.x + sx * (B.w / 2 - 0.08), 0.015, B.z], null, g);
  }
  put(new THREE.Mesh(box(bin, B.w - 0.2, 0.32, 0.012), pied), [B.x, B.top - 0.22, B.z - B.d / 2 + 0.05], null, g);
  // l'écran : cadre noir, dalle dessinée, pied
  const sw = 0.54, sh = 0.32, sy = B.top + 0.31, sz = B.z - 0.16;
  const ecran = new THREE.Group(); g.add(ecran);
  put(new THREE.Mesh(box(bin, sw + 0.025, sh + 0.025, 0.025), noir), [B.x, sy, sz], null, ecran);
  put(new THREE.Mesh(box(bin, 0.05, 0.2, 0.025), noir), [B.x, B.top + 0.1, sz - 0.03], null, ecran);
  put(new THREE.Mesh(box(bin, 0.24, 0.012, 0.17), noir), [B.x, B.top + 0.006, sz - 0.02], null, ecran);
  /** @type {Ecran} */ let etat = { actif: false, societe: '', nonLus: 0, lignes: [] };
  const tex = bin.add(canvasTex(512, 304, (c, w, h) => draw(c, w, h, etat)));
  const dalle = new THREE.Mesh(bin.add(new THREE.PlaneGeometry(sw, sh)), bin.add(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  dalle.position.set(B.x, sy, sz + 0.0135); ecran.add(dalle);
  // l'unité centrale sous la table, son voyant bleu ; le clavier, la souris
  const uc = new THREE.Group(); g.add(uc);
  put(new THREE.Mesh(box(bin, 0.2, 0.42, 0.44), gris), [B.x - B.w / 2 + 0.24, 0.23, B.z - 0.05], null, uc);
  put(new THREE.Mesh(box(bin, 0.012, 0.012, 0.004), std(bin, '#3aa0ff', 0.4, 0, { emissive: '#3aa0ff', emissiveIntensity: 1.2 })), [B.x - B.w / 2 + 0.24, 0.4, B.z + 0.172], null, uc, false);
  put(new THREE.Mesh(box(bin, 0.44, 0.018, 0.14), noir), [B.x, B.top + 0.009, B.z + 0.14], [0.04, 0, 0], g);
  put(new THREE.Mesh(box(bin, 0.06, 0.02, 0.1), noir), [B.x + 0.32, B.top + 0.01, B.z + 0.15], null, g);
  // un téléphone, une pile de dossiers
  put(new THREE.Mesh(box(bin, 0.16, 0.05, 0.2), gris), [B.x + B.w / 2 - 0.2, B.top + 0.025, B.z - 0.12], [0, -0.3, 0], g);
  put(new THREE.Mesh(box(bin, 0.23, 0.035, 0.31), std(bin, '#c4472b', 0.8)), [B.x - 0.48, B.top + 0.018, B.z - 0.12], [0, 0.15, 0], g);
  // le fauteuil, côté +z (celui qui lit ses mails tourne le dos à l'avant du hall)
  const fz = B.z + 0.62;
  put(new THREE.Mesh(box(bin, 0.48, 0.08, 0.46), noir), [B.x, 0.48, fz], null, g);
  put(new THREE.Mesh(box(bin, 0.46, 0.52, 0.06), noir), [B.x, 0.82, fz + 0.24], [-0.12, 0, 0], g);
  put(new THREE.Mesh(bin.add(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8)), pied), [B.x, 0.24, fz], null, g);
  put(new THREE.Mesh(bin.add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, low ? 5 : 10)), pied), [B.x, 0.035, fz], null, g);
  // le panneau suspendu au-dessus du bureau
  const signT = bin.add(canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, w, h); c.fillStyle = '#1d2733'; c.fillRect(0, 0, 10, h); c.font = `700 30px ${FONT}`; c.textBaseline = 'middle'; c.fillText('BUREAU · PLANNING', 22, h / 2 + 2, w - 30); }));
  put(new THREE.Mesh(bin.add(new THREE.PlaneGeometry(1.1, 0.27)), std(bin, '#ffffff', 0.7, 0, { map: signT })), [B.x, 2.35, B.z - 0.45], null, g, false);
  for (const sx of [-0.45, 0.45]) put(new THREE.Mesh(bin.add(new THREE.CylinderGeometry(0.004, 0.004, HALL.h - 2.5, 4)), pied), [B.x + sx, (HALL.h + 2.5) / 2, B.z - 0.45], null, g, false);
  g.traverse((o) => { if (/** @type {any} */ (o).isMesh) { o.castShadow = !low && o !== dalle; o.receiveShadow = true; } });
  return {
    group: g,
    /** les objets qui se cliquent : l'écran et l'unité centrale */
    cibles: [ecran, uc],
    /** le point au-dessus de l'écran (la pastille) */
    anchor: new THREE.Vector3(B.x, sy + sh / 2 + 0.1, sz),
    /** redessine l'écran @param {Ecran} e */
    ecran(e) {
      const k = JSON.stringify(e); if (k === JSON.stringify(etat)) return;
      etat = e; const c = /** @type {HTMLCanvasElement} */ (tex.image); const cx = c.getContext('2d');
      if (cx) draw(cx, c.width, c.height, etat);
      tex.needsUpdate = true;
    },
  };
}
