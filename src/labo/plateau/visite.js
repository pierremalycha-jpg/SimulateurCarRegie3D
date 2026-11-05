// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { emit } from '../../state.js';
import { rich } from '../../ui/rich.js';
import { icon } from '../../ui/icons.js';
import { etiquette } from './scene.js';
import { COUCHE_REPERES } from './pieces.js';

// ----------------------------------------------------------------------------------
// La visite des notions sur le plateau 3D (v19.31) : comme la caméra en 3D, chaque notion est une étape
// qu'on lit dans une carte posée sur le plateau pendant que la vue vole vers ce qu'elle explique (près du
// projecteur pour les lumens, sur la cellule pour les lux, sur le visage pour la luminance…) et que la scène
// s'anime : de la lumière qui part de la source (particules), un mètre carré posé au sujet, le pinceau qui
// s'élargit avec la distance, un réglage qui balaie sa plage pendant qu'on regarde ce qu'il change, et les
// chiffres du modèle lus en direct. Les étapes sont écrites dans plateau/notions.js (un atelier, une liste) ;
// ici, la mécanique : la carte, l'enchaînement, et les outils d'animation réutilisables.
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Etape une notion expliquée sur le plateau
 * @property {string} id
 * @property {string} titre
 * @property {string} texte explication (texte enrichi : paragraphes, **gras**)
 * @property {string} [lecon] la leçon du Cours où lire la suite
 * @property {Record<string, any> | ((st: any, m: any) => Record<string, any>)} [scene] les réglages posés à l'entrée
 * @property {(st: any, m: any) => { cible?: number[], demi?: number, az?: number }} vue où regarder
 * @property {boolean} [grand] l'image de la caméra agrandie pendant l'étape (c'est elle qui montre)
 * @property {(st: any, m: any) => string} [lire] la lecture en direct
 * @property {(o: { ctx: any, scene: THREE.Scene, A: any, S: any, P: any }) => ({ update?: (dt: number, t: number) => void, dispose?: () => void } | void)} [anim] ce qui s'anime pendant l'étape (S : les objets de l'atelier)
 */

/**
 * la visite d'un atelier : sa carte (posée sur le plateau), sa touche de la barre d'outils, et ouvrir / aller / fermer
 * @param {any} P le plateau @param {import('../kit.js').Ctx} ctx @param {Etape[]} etapes
 * @param {() => { scene: THREE.Scene, A: any, S: any }} acces la scène, l'adaptateur et les objets de l'atelier (construits à la demande)
 */
export function creerVisite(P, ctx, etapes, acces) {
  const num = el('span', { class: 'lb-vi-k' }), titre = el('b', { class: 'lb-vi-t' }), corps = el('div', { class: 'lb-vi-body' }), lire = el('p', { class: 'lb-vi-lire', 'aria-live': 'polite', hidden: true });
  const prev = el('button', { type: 'button', class: 'btn small', 'aria-label': 'Notion précédente', onclick: () => aller(V.k - 1) }, '◀');
  const next = el('button', { type: 'button', class: 'btn small primary', onclick: () => (V.k >= etapes.length - 1 ? fermer() : aller(V.k + 1)) }, 'Suivante ▶');
  const lecon = el('button', { type: 'button', class: 'linkbtn', onclick: () => { const E = etapes[V.k]; if (E && E.lecon) emit('laboLecon', { lesson: E.lecon }); } }, 'La leçon');
  const fermerB = el('button', { type: 'button', class: 'btn small', 'aria-label': 'Fermer la visite', title: 'Fermer', onclick: () => fermer() }, '✕');
  const carte = el('section', { class: 'lb-visite', hidden: true, 'aria-label': 'Les notions, en 3D' },
    el('div', { class: 'lb-vi-head' }, num, titre, fermerB), corps, lire, el('div', { class: 'lb-vi-nav' }, prev, next, lecon));
  const bouton = el('button', { type: 'button', class: 'btn small lb-vi-btn', 'aria-pressed': 'false', title: 'Les notions expliquées sur le plateau, une à une', onclick: () => (V.ouverte ? fermer() : ouvrir(Math.max(0, V.k))) }, icon('cours'), 'Notions');
  const V = { k: -1, ouverte: false, /** @type {any} */ anim: null, tLire: 0, grandAvant: false };
  carte.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); aller(V.k + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); aller(V.k - 1); } });

  function arreterAnim() {
    if (V.anim && V.anim.dispose) { try { V.anim.dispose(); } catch (e) { console.error(e); } }
    V.anim = null; P.arreter('visite');
  }
  function majLire() {
    const E = etapes[V.k]; if (!E || !E.lire) { lire.hidden = true; return; }
    try { lire.textContent = E.lire(ctx.st, ctx.m()); lire.hidden = false; } catch (e) { lire.hidden = true; }
  }
  /** va à l'étape i : règle la scène, vole, anime, écrit */
  function aller(i) {
    if (i < 0 || i >= etapes.length) return;
    arreterAnim();
    const E = etapes[i]; V.k = i;
    if (E.scene) ctx.changer(typeof E.scene === 'function' ? E.scene(ctx.st, ctx.m()) : E.scene);
    const { scene, A, S } = acces();
    try { P.voler(E.vue(ctx.st, ctx.m())); } catch (e) { console.error(e); }
    P.agrandir(!!E.grand);
    if (E.anim) { try { V.anim = E.anim({ ctx, scene, A, S, P }) || null; } catch (e) { console.error(e); V.anim = null; } }
    V.tLire = 0;
    P.animer('visite', (dt, t) => { if (V.anim && V.anim.update) V.anim.update(dt, t); V.tLire += dt; if (V.tLire > 0.15) { V.tLire = 0; majLire(); } });
    num.textContent = `${i + 1} / ${etapes.length}`; titre.textContent = E.titre;
    corps.replaceChildren(rich(E.texte, 'lb-rich'));
    prev.disabled = i === 0; next.textContent = i === etapes.length - 1 ? 'Terminer' : 'Suivante ▶';
    lecon.hidden = !E.lecon;
    majLire();
    if (ctx.dire) ctx.dire(`${E.titre}. ${E.lire ? lire.textContent : ''}`);
    carte.scrollTop = 0;
  }
  function ouvrir(i = 0) {
    if (!V.ouverte) V.grandAvant = !!P.etat.grand;
    V.ouverte = true; carte.hidden = false; bouton.setAttribute('aria-pressed', 'true'); bouton.classList.add('on');
    const host = carte.parentElement; if (host) host.classList.add('lb-visite-on');
    aller(i);
    next.focus({ preventScroll: true });
  }
  function fermer() {
    if (!V.ouverte) return;
    V.ouverte = false; arreterAnim(); carte.hidden = true; bouton.setAttribute('aria-pressed', 'false'); bouton.classList.remove('on');
    P.agrandir(V.grandAvant);
    const host = carte.parentElement; if (host) host.classList.remove('lb-visite-on');
    P.cadrer();
    bouton.focus({ preventScroll: true });
  }
  return { carte, bouton, ouvrir, fermer, aller, etapes, get ouverte() { return V.ouverte; }, get k() { return V.k; } };
}

// ---------------- les outils d'animation ----------------
/** un réglage qui balaie sa plage en continu (de → a → de, une période en secondes) ; log : en progression géométrique ; step : arrondi */
export function balayage(ctx, cle, de, a, periode, o = {}) {
  let t0 = null, last = null;
  return { update(dt, t) {
    if (t0 == null) t0 = t;
    const u = (1 - Math.cos((t - t0) / periode * 2 * Math.PI)) / 2;
    let v = o.log ? de * Math.pow(a / de, u) : de + (a - de) * u;
    if (o.step) v = Math.round(v / o.step) * o.step;
    if (v !== last) { last = v; ctx.changer({ [cle]: v }); }
  } };
}
/** un réglage qui prend tour à tour des valeurs, chacune pendant duree secondes */
export function cycle(ctx, cle, valeurs, duree) {
  let i = -1, acc = duree;
  return { update(dt) { acc += dt; if (acc >= duree) { acc = 0; i = (i + 1) % valeurs.length; ctx.changer({ [cle]: valeurs[i] }); } } };
}
/** plusieurs animations ensemble */
export function ensemble(...anims) {
  const L = anims.filter(Boolean);
  return { update(dt, t) { for (const a of L) if (a.update) a.update(dt, t); }, dispose() { for (const a of L) if (a.dispose) a.dispose(); } };
}
const Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), M4 = new THREE.Matrix4(), S3 = new THREE.Vector3(), Q0 = new THREE.Quaternion();
/**
 * de la lumière qui part : n petites boules à facettes émises depuis une source dans un cône (ou un demi-espace), qui filent
 * tout droit et s'éteignent ; emettre() pose la source, la direction, le demi-angle (rad), la vitesse (m/s) et la vie (s)
 */
export function particules(scene, n = 160, couleur = 0xfff2d8, taille = 0.03) {
  const geo = new THREE.IcosahedronGeometry(taille, 0);
  const mat = new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.layers.set(COUCHE_REPERES); mesh.frustumCulled = false; mesh.name = 'particules'; mesh.userData.passe = true; mesh.renderOrder = 4;
  const L = []; for (let i = 0; i < n; i++) L.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: Infinity });
  const src = { o: new THREE.Vector3(), d: new THREE.Vector3(0, 0, 1), demi: 0.3, vitesse: 3, vie: 1.2, acc: 0 };
  scene.add(mesh);
  const dir = (out) => {
    const u = Math.random(), cosA = 1 - u * (1 - Math.cos(src.demi)), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA)), ph = Math.random() * Math.PI * 2;
    out.set(sinA * Math.cos(ph), sinA * Math.sin(ph), cosA).applyQuaternion(Q.setFromUnitVectors(Z, src.d));
    return out;
  };
  const E = {
    mesh, src,
    emettre(o, d, demi, vitesse = 3, vie = 1.2) { src.o.copy(o); src.d.copy(d).normalize(); src.demi = demi; src.vitesse = vitesse; src.vie = vie; },
    couleur(c) { mat.color.setRGB(c[0], c[1], c[2]); },
    update(dt) {
      src.acc += dt * n / src.vie;
      for (let i = 0; i < n; i++) {
        const q = L[i];
        if (q.age < src.vie) { q.age += dt; q.p.addScaledVector(q.v, dt); }
        else if (src.acc >= 1) { src.acc -= 1; q.age = 0; q.p.copy(src.o); dir(q.v).multiplyScalar(src.vitesse * (0.8 + Math.random() * 0.4)); }
        const k = q.age < src.vie ? 1 - q.age / src.vie : 0;
        S3.setScalar(0.4 + 0.6 * k); M4.compose(q.p, Q0, S3); mesh.setMatrixAt(i, M4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
  return E;
}
const matRep = (couleur, opacite) => new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: opacite, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
/** un carré posé dans la scène (une surface qui reçoit la lumière) : poser(centre, normale) ; coins() ; une étiquette accrochée */
export function carre(scene, A, taille, couleur, texte = '') {
  const g = new THREE.Group(); g.name = 'carré';
  const face = new THREE.Mesh(new THREE.PlaneGeometry(taille, taille), matRep(couleur, 0.16)); face.layers.set(COUCHE_REPERES); face.renderOrder = 3; face.userData.passe = true;
  const bord = new THREE.LineSegments(new THREE.EdgesGeometry(face.geometry), new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: 0.9, toneMapped: false })); bord.layers.set(COUCHE_REPERES); bord.renderOrder = 3;
  g.add(face, bord); scene.add(g);
  const L = texte ? etiquette(g, texte, 'accent', [0, taille / 2 + 0.15, 0]) : null;
  if (L) A.etiquettes.push(L);
  const C = new THREE.Vector3();
  return {
    groupe: g, etiquette: L,
    poser(centre, normale) { g.position.copy(centre); C.copy(centre).add(normale); g.lookAt(C); g.updateMatrixWorld(true); },
    coins() { const h = taille / 2; return [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => g.localToWorld(new THREE.Vector3(x, y, 0))); },
    texte(t) { if (L) L.set(t); },
    dispose() { scene.remove(g); face.geometry.dispose(); face.material.dispose(); bord.geometry.dispose(); bord.material.dispose(); if (L) { L.el.remove(); const i = A.etiquettes.indexOf(L); if (i >= 0) A.etiquettes.splice(i, 1); } },
  };
}
/** un pinceau de lignes d'un point aux coins d'un carré (le cône de lumière qui s'élargit) */
export function pinceau(scene, couleur) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3));
  const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: 0.55, toneMapped: false })); m.layers.set(COUCHE_REPERES); m.renderOrder = 3; m.frustumCulled = false; m.name = 'pinceau';
  scene.add(m);
  return {
    maj(o, coins) { const p = /** @type {THREE.BufferAttribute} */ (geo.attributes.position); coins.forEach((c, i) => { p.setXYZ(i * 2, o.x, o.y, o.z); p.setXYZ(i * 2 + 1, c.x, c.y, c.z); }); p.needsUpdate = true; },
    dispose() { scene.remove(m); geo.dispose(); /** @type {any} */ (m.material).dispose(); },
  };
}

/** un rectangle posé dans la scène (le champ couvert à une distance, le capteur agrandi) : poser(centre, normale), taille(w, h) */
export function cadre(parent, A, couleur, texte = '', opacite = 0.1) {
  const g = new THREE.Group(); g.name = 'cadre';
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matRep(couleur, opacite)); face.layers.set(COUCHE_REPERES); face.renderOrder = 3; face.userData.passe = true;
  const bord = new THREE.LineSegments(new THREE.EdgesGeometry(face.geometry), new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: 0.9, toneMapped: false })); bord.layers.set(COUCHE_REPERES); bord.renderOrder = 3;
  g.add(face, bord); parent.add(g);
  const L = texte ? etiquette(g, texte, 'accent', [0, 0.7, 0]) : null;
  if (L) A.etiquettes.push(L);
  const C = new THREE.Vector3();
  return {
    groupe: g,
    poser(centre, normale) { g.position.copy(centre); C.copy(centre).add(normale); g.lookAt(C); },
    taille(w, h) { g.scale.set(Math.max(0.01, w), Math.max(0.01, h), 1); if (L) L.dec = [0, h / 2 + 0.15, 0]; },
    texte(t) { if (L) L.set(t); },
    dispose() { parent.remove(g); face.geometry.dispose(); face.material.dispose(); bord.geometry.dispose(); bord.material.dispose(); if (L) { L.el.remove(); const i = A.etiquettes.indexOf(L); if (i >= 0) A.etiquettes.splice(i, 1); } },
  };
}
/**
 * la tranche nette, dans le repère de la caméra (enfants de son rig, qui regarde +z) : le plan de netteté (le point) et les
 * deux limites, des plans debout de la largeur du champ ; maj(s, ws, z0, w0, z1, w1, h) avec les demi-largeurs
 */
export function tranche(rig, A, couleur) {
  const plan = (op, nom) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matRep(couleur, op)); m.name = nom; m.layers.set(COUCHE_REPERES); m.renderOrder = 3; m.userData.passe = true; const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: 0.75, toneMapped: false })); e.layers.set(COUCHE_REPERES); m.add(e); rig.add(m); return m; };
  const net = plan(0.26, 'plan de netteté'), pr = plan(0.12, 'limite proche'), lo = plan(0.12, 'limite lointaine');
  const Ls = { net: etiquette(net, 'le point', 'accent', [0, 1.25, 0]), pr: etiquette(pr, 'limite proche', '', [0, 1.25, 0]), lo: etiquette(lo, 'limite lointaine', '', [0, 1.25, 0]) };
  A.etiquettes.push(Ls.net, Ls.pr, Ls.lo);
  const pose = (m, z, w, h) => { m.position.set(0, h / 2, z); m.scale.set(Math.max(0.2, 2 * w), h, 1); };
  return {
    maj(s, ws, z0, w0, z1, w1, h = 2.2) { pose(net, s, ws, h); pose(pr, z0, w0, h); pose(lo, z1, w1, h); },
    textes(a, b, c) { Ls.net.set(a); Ls.pr.set(b); Ls.lo.set(c); },
    dispose() { for (const m of [net, pr, lo]) { rig.remove(m); m.geometry.dispose(); /** @type {any} */ (m.material).dispose(); } for (const L of Object.values(Ls)) { L.el.remove(); const i = A.etiquettes.indexOf(L); if (i >= 0) A.etiquettes.splice(i, 1); } },
  };
}
/**
 * la tache de flou d'un sujet, montrée au-dessus de sa tête à la même échelle qu'un anneau : l'anneau est le cercle de
 * confusion (la limite admise), le disque la tache de ce sujet ; net tant que le disque tient dans l'anneau. maj(ratio, net)
 */
export function tacheFlou(scene, A, couleur, nom) {
  const R = 0.14;
  const g = new THREE.Group(); g.name = 'tache';
  const anneau = new THREE.Mesh(new THREE.RingGeometry(R * 0.9, R, 40), matRep(couleur, 0.95)); anneau.layers.set(COUCHE_REPERES); anneau.renderOrder = 4;
  const disque = new THREE.Mesh(new THREE.CircleGeometry(1, 40), matRep(couleur, 0.32)); disque.layers.set(COUCHE_REPERES); disque.renderOrder = 3;
  g.add(anneau, disque); scene.add(g);
  const L = etiquette(g, nom, '', [0, R + 0.12, 0]); A.etiquettes.push(L);
  return {
    poser(centre, vers) { g.position.copy(centre); g.lookAt(vers); },
    maj(ratio, net, texte) { const r = Math.max(0.02, Math.min(4.5, ratio)) * R; disque.scale.set(r, r, 1); L.set(texte, net ? 'ok' : ''); },
    dispose() { scene.remove(g); anneau.geometry.dispose(); anneau.material.dispose(); disque.geometry.dispose(); disque.material.dispose(); L.el.remove(); const i = A.etiquettes.indexOf(L); if (i >= 0) A.etiquettes.splice(i, 1); },
  };
}
