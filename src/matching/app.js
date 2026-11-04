// @ts-check
// ----------------------------------------------------------------------------------
// Le matching à la mire (v19.30) : la page. Deux caméras (A la référence, B à raccorder) filment la même
// mire ; on prend une image de chacune (une image du signal de la FB80 pour A ; la carte d'acquisition vue
// comme une webcam pour la PTZ ; un fichier ; l'instantané IP d'une Panasonic par le relais de
// tools/matching.mjs ; ou la démonstration), on pointe les
// quatre coins de la zone des pastilles, la page moyenne chaque pastille, dessine la parade des gris et le
// vecteurscope des couleurs, puis donne, dans l'ordre du line-up, ce qu'il faut régler sur B (calc.js) : en
// unités du menu de la caméra (cameras.js), appliqué d'un clic sur une Panasonic (panasonic.js), à entrer
// au RCP sur la Sony. Après chaque tour, « J'ai réglé B : remesurer » : la page remesure, apprend l'échelle
// réelle des réglages et affine. Tout le calcul est dans calc.js ; ici, le DOM et les sources d'images.
// La page marche aussi ouverte d'un double-clic (file://), sans serveur : les commandes partent alors
// directement à la caméra (le navigateur les envoie sans laisser lire la réponse), et les valeurs en cours
// de la caméra, qu'on ne peut plus lire, s'entrent à la main.
// ----------------------------------------------------------------------------------
import { MIRES, MIRE_DEFAUT, neutres, colorees } from './mires.js';
import { CAMERAS, CAMERA_DEFAUT_A, CAMERA_DEFAUT_B, borner, enUnites, formatValeur } from './cameras.js';
import { commandes, requete, lireReponse, urlCommande, urlInstantane } from './panasonic.js';
import { diagnostic, homographie, projeter, zonesPastilles, ycbcr, simulerCamera, estimerEchelle, TOLERANCES, raccorde, AXES } from './calc.js';

/** @typedef {import('./calc.js').Mesure} Mesure */
/** @typedef {import('./calc.js').Diagnostic} Diagnostic */

const CLE = 'matching.v1';
const CORNERS = ['en haut à gauche', 'en haut à droite', 'en bas à droite', 'en bas à gauche'];
/** la caméra B de la démonstration : un peu de noir, rougie et bleuie, gamma plus doux, matrice de travers, sous-exposée */
export const DEMO_B = { noir: [0.012, 0.012, 0.018], gain: [0.95 * 0.92, 0.92, 1.06 * 0.92], gamma: 0.42, matrice: { rg: -0.1, rb: 0.03, gr: 0.05, gb: 0, br: -0.04, bg: 0.07 }, saturation: 1, bruit: 0.003, graine: 5 };
/** les échelles cachées de la caméra simulée (pas du menu par dB, par point, par coefficient) : la page ne les connaît pas, elle les apprend */
export const DEMO_ECHELLES = { gainR: 28, gainB: 28, pedestal: 12, pedestalR: 12, pedestalB: 12, matrice: 80 };

const $ = (sel, root = document) => /** @type {any} */ (root.querySelector(sel));
/** @param {string} tag @param {Record<string, any>} [attrs] @param {...(Node|string|null|undefined)} enfants */
function h(tag, attrs, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of enfants) if (c != null) e.append(c);
  return e;
}
const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
const signe = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d);
const css = (p) => `rgb(${Math.round(p.r * 255)}, ${Math.round(p.g * 255)}, ${Math.round(p.b * 255)})`;

// ---------------- l'état ----------------
/** @typedef {{ lettre: 'A'|'B', modele: string, adresse: string, source: ''|'webcam'|'fichier'|'ip'|'demo', flux: MediaStream|null, image: HTMLCanvasElement|null, coins: {x:number,y:number}[], coinsDemo: {x:number,y:number}[]|null, mesure: Mesure|null, courant: Record<string, number>, message: string, erreur: boolean, el: any }} Cam */
const S = {
  mire: MIRES[MIRE_DEFAUT],
  cams: { A: cam('A'), B: cam('B') },
  diag: /** @type {Diagnostic|null} */ (null),
  tours: /** @type {{ n: number, avant: number, apres: number, applique: string[] }[]} */ ([]),
  echelles: /** @type {Record<string, number>} */ ({}),       // échelles apprises, par modèle.réglage
  attendu: /** @type {Record<string, { unites: number, avant: number }>} */ ({}), // ce qu'on a appliqué depuis la dernière mesure de B
  appliques: /** @type {string[]} */ ([]),
  relais: /** @type {boolean|null} */ (null),
  derniereB: /** @type {Mesure|null} */ (null),
  demoB: /** @type {any} */ (null), // les défauts en cours de la caméra B simulée (la démonstration applique les réglages dessus)
};
/** @returns {Cam} */
function cam(lettre) { return { lettre, modele: lettre === 'A' ? CAMERA_DEFAUT_A : CAMERA_DEFAUT_B, adresse: '', source: '', flux: null, image: null, coins: [], coinsDemo: null, mesure: null, courant: {}, message: '', erreur: false, el: null }; }
const modele = (c) => CAMERAS[c.modele] || CAMERAS.autre;
function sauver() { try { localStorage.setItem(CLE, JSON.stringify({ modeles: { A: S.cams.A.modele, B: S.cams.B.modele }, adresses: { A: S.cams.A.adresse, B: S.cams.B.adresse }, echelles: S.echelles })); } catch (e) { /* stockage indisponible */ } }
function charger() {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || 'null'); if (!d) return;
    for (const L of ['A', 'B']) { if (d.modeles && CAMERAS[d.modeles[L]]) S.cams[L].modele = d.modeles[L]; if (d.adresses && typeof d.adresses[L] === 'string') S.cams[L].adresse = d.adresses[L]; }
    if (d.echelles && typeof d.echelles === 'object') S.echelles = d.echelles;
  } catch (e) { /* données illisibles */ }
}
/** l'échelle d'un réglage : apprise si on l'a mesurée, sinon celle du profil */
function echelle(c, nom) { const r = modele(c).reglages[nom.split('.')[0]]; const k = `${c.modele}.${nom}`; return S.echelles[k] ?? (r && r.echelle) ?? 1; }

// ---------------- le relais (tools/matching.mjs) ----------------
async function relais(url) {
  const r = await fetch('/relais?url=' + encodeURIComponent(url), { cache: 'no-store' });
  if (!r.ok) throw new Error((await r.text().catch(() => '')) || `relais : ${r.status}`);
  return r;
}
async function relaisPresent() {
  if (S.relais != null) return S.relais;
  if (!/^https?:$/.test(location.protocol)) return (S.relais = false); // page ouverte d'un double-clic : pas de serveur derrière
  try { const r = await fetch('/relais', { cache: 'no-store' }); S.relais = r.status === 400; } catch (e) { S.relais = false; }
  return S.relais;
}
/** sans serveur : la commande part directement à la caméra ; le navigateur l'envoie (mode no-cors) mais ne laisse pas lire
 * la réponse ; la caméra l'exécute quand même. Seule une caméra injoignable se remarque. */
async function envoyerDirect(c, cmds) {
  for (const cmd of cmds) {
    try { await fetch(urlCommande(c.adresse, cmd), { mode: 'no-cors', cache: 'no-store' }); } catch (e) { throw new Error(`La caméra ${c.adresse} ne répond pas (${cmd})`, { cause: e }); }
    await new Promise((res) => setTimeout(res, 40));
  }
  return [];
}
/** envoie des commandes à une Panasonic, l'une après l'autre ; lève une erreur si la caméra refuse */
async function envoyer(c, cmds) {
  const fam = modele(c).famille; if (!fam || !c.adresse) throw new Error('Indiquez l\'adresse IP de la caméra');
  if (!(await relaisPresent())) return envoyerDirect(c, cmds);
  const reponses = [];
  for (const cmd of cmds) {
    const t = (await (await relais(urlCommande(c.adresse, cmd))).text()).trim();
    const lu = lireReponse(fam, t);
    if (lu && 'erreur' in lu) throw new Error(`${cmd} : ${lu.erreur}`);
    reponses.push(t);
    await new Promise((res) => setTimeout(res, 40));
  }
  return reponses;
}
/** lit les valeurs en cours des réglages d'une Panasonic (par le relais seulement : sans serveur, on les entre à la main) */
async function lireCamera(c) {
  const fam = modele(c).famille; if (!fam) return;
  if (!(await relaisPresent())) { c.el.courant.open = true; throw new Error('Page ouverte sans le serveur : le navigateur ne laisse pas lire la caméra. Entrez ses valeurs en cours ci-dessous (après une balance automatique, les gains sont à 0).'); }
  if (!c.adresse) throw new Error('Indiquez l\'adresse IP de la caméra');
  const noms = ['gainR', 'gainB', 'pedestal', 'pedestalR', 'pedestalB', 'gamma', 'temperature', 'saturation', 'matrice.rg', 'matrice.rb', 'matrice.gr', 'matrice.gb', 'matrice.br', 'matrice.bg'];
  for (const nom of noms) {
    const q = requete(fam, nom); if (!q) continue;
    const lu = lireReponse(fam, (await (await relais(urlCommande(c.adresse, q))).text()).trim());
    if (lu && 'reglage' in lu) c.courant[lu.reglage] = lu.valeur;
  }
  rafraichirCourant(c);
}
/** prépare une Panasonic à la peinture manuelle : balance en AWB A (les gains R et B agissent), matrice sur User */
async function preparerCamera(c) { await envoyer(c, ['OAW:1', 'OSE:31:3']); }

// ---------------- les sources d'images ----------------
function arreterFlux(c) { if (c.flux) { for (const t of c.flux.getTracks()) t.stop(); c.flux = null; } const v = c.el.video; v.srcObject = null; v.hidden = true; }
async function ouvrirWebcam(c, deviceId) {
  arreterFlux(c);
  const autre = S.cams[c.lettre === 'A' ? 'B' : 'A']; if (autre.flux) { arreterFlux(autre); dire(autre, 'Vidéo arrêtée (une seule entrée en direct à la fois) : l\'image figée reste.'); }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Pas de caméra dans ce navigateur (il faut une page en https ou sur localhost)');
  c.flux = await navigator.mediaDevices.getUserMedia({ video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  const v = c.el.video; v.srcObject = c.flux; v.hidden = false; await v.play().catch(() => {});
}
/** fige l'image en cours (vidéo) dans le canevas de mesure */
function capturerVideo(c, garderCoins = false) {
  const v = c.el.video; if (!c.flux || !v.videoWidth) throw new Error('Pas d\'image vidéo à capturer');
  const k = document.createElement('canvas'); k.width = v.videoWidth; k.height = v.videoHeight;
  k.getContext('2d').drawImage(v, 0, 0);
  poserImage(c, k, garderCoins);
}
function chargerFichier(c, fichier, garderCoins = false) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(fichier);
    img.onload = () => { const k = document.createElement('canvas'); k.width = img.naturalWidth; k.height = img.naturalHeight; k.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url); poserImage(c, k, garderCoins); res(null); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image illisible')); };
    img.src = url;
  });
}
async function instantane(c, garderCoins = false) {
  if (!(await relaisPresent())) throw new Error('Page ouverte sans le serveur : le navigateur ne laisse pas mesurer une image venue de la caméra. Enregistrez l\'image depuis la page web de la caméra puis « Image… », ou passez par la carte d\'acquisition.');
  if (!c.adresse) throw new Error('Indiquez l\'adresse IP de la caméra');
  const blob = await (await relais(urlInstantane(c.adresse))).blob();
  await chargerFichier(c, blob, garderCoins);
}
/** la démonstration : la mire telle que la verrait une caméra simulée, avec un peu de perspective ; B garde ses défauts d'un tour à l'autre */
function demo(c) {
  if (c.lettre === 'B' && !S.demoB) S.demoB = { ...DEMO_B, noir: [...DEMO_B.noir], gain: [...DEMO_B.gain], matrice: { ...DEMO_B.matrice } };
  const defauts = c.lettre === 'A' ? {} : S.demoB;
  const W = 1280, H = 720, k = document.createElement('canvas'); k.width = W; k.height = H;
  const ctx = k.getContext('2d');
  ctx.fillStyle = '#2a2d33'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3a3d44'; ctx.fillRect(0, H * 0.72, W, H * 0.28);
  const coins = c.lettre === 'A' ? [{ x: 300, y: 150 }, { x: 980, y: 160 }, { x: 975, y: 600 }, { x: 305, y: 590 }] : [{ x: 330, y: 140 }, { x: 1000, y: 170 }, { x: 990, y: 605 }, { x: 320, y: 575 }];
  const hm = homographie(coins); const m = simulerCamera(S.mire, defauts);
  // le cadre noir de la mire, puis chaque pastille (un peu en retrait de sa case)
  const bord = [projeter(hm, -0.04, -0.06), projeter(hm, 1.04, -0.06), projeter(hm, 1.04, 1.06), projeter(hm, -0.04, 1.06)];
  ctx.fillStyle = '#111'; ctx.beginPath(); bord.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
  const { lignes, colonnes } = S.mire;
  m.pastilles.forEach((p, idx) => {
    const i = Math.floor(idx / colonnes), j = idx % colonnes, r = 0.06;
    const q = [[j + r, i + r], [j + 1 - r, i + r], [j + 1 - r, i + 1 - r], [j + r, i + 1 - r]].map(([u, v]) => projeter(hm, u / colonnes, v / lignes));
    ctx.fillStyle = css(p); ctx.beginPath(); q.forEach((pt, n) => (n ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y))); ctx.closePath(); ctx.fill();
  });
  // du bruit de pixel (±2 niveaux), comme une vraie image : la moyenne des 49 points par pastille retrouve la valeur
  // sous le niveau 8 bits ; une pastille unie, elle, garderait l'erreur d'arrondi
  const img = ctx.getImageData(0, 0, W, H), d = img.data; let seed = c.lettre === 'A' ? 17 : 23;
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i + k] = Math.max(0, Math.min(255, d[i + k] + Math.round(seed / 4294967296 * 4 - 2))); }
  ctx.putImageData(img, 0, 0);
  c.coinsDemo = coins;
  poserImage(c, k);
  c.coins = coins.map((p) => ({ ...p }));
  mesurer(c);
}
/** pose une nouvelle image ; les coins sont gardés (et la mesure refaite) si l'image a la même taille et qu'on le demande */
function poserImage(c, k, garderCoins = false) {
  const memes = garderCoins && c.image && c.image.width === k.width && c.image.height === k.height && c.coins.length === 4;
  c.image = k; c.mesure = null; if (!memes) { c.coins = []; c.coinsDemo = c.source === 'demo' ? c.coinsDemo : null; }
  const canvas = c.el.canvas; canvas.width = k.width; canvas.height = k.height; canvas.hidden = false;
  c.el.image.style.aspectRatio = `${k.width} / ${k.height}`;
  c.el.vide.hidden = true;
  dessinerImage(c);
  if (memes) mesurer(c); else diagnostiquer();
}

// ---------------- la mire dans l'image ----------------
function dessinerImage(c) {
  const canvas = c.el.canvas, ctx = canvas.getContext('2d'); if (!c.image) return;
  ctx.drawImage(c.image, 0, 0);
  const e = Math.max(2, canvas.width / 640);
  ctx.lineWidth = e; ctx.font = `${Math.round(7 * e)}px ${getComputedStyle(document.body).fontFamily}`;
  if (c.coins.length === 4) {
    const hm = homographie(c.coins);
    if (hm) {
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      for (const z of zonesPastilles(hm, S.mire.lignes, S.mire.colonnes, 0.4, 2)) {
        const pts = [z.points[0], z.points[1], z.points[3], z.points[2]];
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
      }
      ctx.strokeStyle = '#3b9cff'; ctx.beginPath(); c.coins.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
    }
  }
  c.coins.forEach((p, i) => {
    ctx.fillStyle = '#3b9cff'; ctx.beginPath(); ctx.arc(p.x, p.y, 4 * e, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(String(i + 1), p.x + 5 * e, p.y - 5 * e);
  });
  c.el.etat.textContent = c.mesure ? 'Mesurée' : c.coins.length === 4 ? 'Mire placée' : `Cliquez le coin ${CORNERS[c.coins.length]} de la zone des pastilles (${c.coins.length}/4)`;
}
function clicImage(c, ev) {
  if (!c.image || c.coins.length >= 4) return;
  const r = c.el.canvas.getBoundingClientRect();
  c.coins.push({ x: (ev.clientX - r.left) * c.image.width / r.width, y: (ev.clientY - r.top) * c.image.height / r.height });
  if (c.coins.length === 4) mesurer(c); else dessinerImage(c);
}
/** moyenne chaque pastille dans l'image figée : la mesure de la caméra */
function mesurer(c) {
  if (!c.image || c.coins.length !== 4) return null;
  const hm = homographie(c.coins); if (!hm) { dire(c, 'Les quatre coins ne forment pas un quadrilatère', true); return null; }
  const W = c.image.width, H = c.image.height, data = c.image.getContext('2d').getImageData(0, 0, W, H).data;
  const pastilles = zonesPastilles(hm, S.mire.lignes, S.mire.colonnes).map((z) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const p of z.points) {
      const x = Math.round(p.x), y = Math.round(p.y); if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const o = (y * W + x) * 4; r += data[o]; g += data[o + 1]; b += data[o + 2]; n++;
    }
    n = n || 1; return { id: S.mire.pastilles[z.index].id, r: r / n / 255, g: g / n / 255, b: b / n / 255 };
  });
  c.mesure = { pastilles };
  dire(c, `Mesurée : ${pastilles.length} pastilles`); dessinerImage(c); dessinerPastilles(c);
  diagnostiquer();
  return c.mesure;
}
function dessinerPastilles(c) {
  const el = c.el.pastilles; el.replaceChildren();
  if (!c.mesure) return;
  for (const p of c.mesure.pastilles) el.append(h('div', { class: 'p', style: `background:${css(p)}`, title: S.mire.pastilles.find((m) => m.id === p.id).nom }, h('span', null, `${Math.round(p.g * 100)}`)));
}
function dire(c, texte, erreur = false) { c.message = texte; c.erreur = erreur; const m = c.el.message; m.textContent = texte; m.className = 'message' + (erreur ? ' erreur' : ''); }

// ---------------- les scopes ----------------
function dessinerParade(canvas) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const gris = neutres(S.mire), m = 36, haut = H - 30, bas = 18;
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.fillStyle = '#929baa'; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'right';
  for (let v = 0; v <= 100; v += 25) { const y = haut - (haut - bas) * v / 100; ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(W - 8, y); ctx.stroke(); ctx.fillText(`${v}`, m - 6, y + 4); }
  const voies = ['r', 'g', 'b'], couleurs = ['#ff5a4e', '#39d35a', '#4f9dff'], large = (W - m - 8) / 3;
  ctx.textAlign = 'center';
  voies.forEach((k, vi) => {
    const x0 = m + vi * large, pas = (large - 10) / gris.length;
    ctx.fillStyle = couleurs[vi]; ctx.fillText(['Rouge', 'Vert', 'Bleu'][vi], x0 + large / 2, H - 8);
    gris.forEach((g, gi) => {
      const x = x0 + 5 + gi * pas;
      for (const [L, mes, style] of /** @type {[string, Mesure|null, string][]} */ ([['A', S.cams.A.mesure, 'rgba(255,255,255,.9)'], ['B', S.cams.B.mesure, couleurs[vi]]])) {
        if (!mes) continue; const p = mes.pastilles.find((q) => q.id === g.id); if (!p) continue;
        const y = haut - (haut - bas) * Math.min(1.1, p[k]);
        if (L === 'A') { ctx.strokeStyle = style; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + pas - 3, y); ctx.stroke(); } else { ctx.fillStyle = style; ctx.globalAlpha = .75; ctx.fillRect(x, y, pas - 3, haut - y); ctx.globalAlpha = 1; }
      }
    });
  });
}
function dessinerVecto(canvas) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d'), cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 14;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  // Cb vers la droite, Cr vers le haut ; rayon = 0,5 ; cibles des barres à 75 %
  const pos = (cb, cr) => ({ x: cx + cb / 0.5 * R, y: cy - cr / 0.5 * R });
  ctx.fillStyle = '#929baa'; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center';
  const barres = { R: [1, 0, 0], Mg: [1, 0, 1], B: [0, 0, 1], Cy: [0, 1, 1], G: [0, 1, 0], Yl: [1, 1, 0] };
  for (const [nom] of AXES) { const c = barres[nom].map((v) => v * 0.75); const y = ycbcr(c[0], c[1], c[2]); const p = pos(y.cb, y.cr); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.strokeRect(p.x - 5, p.y - 5, 10, 10); ctx.fillText(nom, p.x, p.y - 9); }
  const A = S.cams.A.mesure, B = S.cams.B.mesure, C = S.diag && S.diag.corrige;
  for (const p of colorees(S.mire)) {
    const a = A && A.pastilles.find((q) => q.id === p.id), b = B && B.pastilles.find((q) => q.id === p.id), c = C && C.pastilles.find((q) => q.id === p.id);
    const pa = a && (() => { const y = ycbcr(a.r, a.g, a.b); return pos(y.cb, y.cr); })(), pb = b && (() => { const y = ycbcr(b.r, b.g, b.b); return pos(y.cb, y.cr); })(), pc = c && (() => { const y = ycbcr(c.r, c.g, c.b); return pos(y.cb, y.cr); })();
    if (pa && pb) { ctx.strokeStyle = 'rgba(59,156,255,.5)'; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); }
    if (pb) { ctx.fillStyle = '#3b9cff'; ctx.beginPath(); ctx.arc(pb.x, pb.y, 4, 0, Math.PI * 2); ctx.fill(); }
    if (pc) { ctx.fillStyle = '#34c759'; ctx.beginPath(); ctx.arc(pc.x, pc.y, 3, 0, Math.PI * 2); ctx.fill(); }
    if (pa) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pa.x, pa.y, 5, 0, Math.PI * 2); ctx.stroke(); }
  }
}

// ---------------- le diagnostic ----------------
function diagnostiquer() {
  const A = S.cams.A.mesure, B = S.cams.B.mesure;
  S.diag = null;
  if (A && B) { try { S.diag = diagnostic(A, B, S.mire); } catch (e) { S.diag = null; } }
  if (S.diag && B !== S.derniereB) { S.derniereB = B; apprendre(); }
  dessinerParade($('#parade')); dessinerVecto($('#vecto'));
  dessinerRaccord(); dessinerEtapes();
}
/** au-dessous de ces écarts, un réglage est « à laisser » : la moitié de la tolérance du raccord, pour que la boucle aille au bout sans courir après le bruit */
const SEUILS = { noir: TOLERANCES.noir * 0.6, dB: 0.1, diaph: 0.05, gamma: 0.015, coef: 0.01 };
/** l'effet au-dessous duquel une remesure n'apprend rien (le bruit de mesure d'une mire en 8 bits) */
const MIN_EFFET = { dB: 0.12, point: 0.3, coef: 0.02 };
/** à chaque nouvelle mesure de B : un tour au journal ; ce que les pas appliqués ont vraiment fait affine les échelles */
function apprendre() {
  const d = S.diag, c = S.cams.B; if (!d) return;
  const maintenant = grandeurs(d);
  const appris = [];
  for (const [nom, a] of Object.entries(S.attendu)) {
    if (!(nom in maintenant) || Math.abs(a.unites) < 3) continue;
    const k = `${c.modele}.${nom}`, avant = echelle(c, nom), r = modele(c).reglages[nom.split('.')[0]];
    // la correction encore nécessaire a diminué de ce que les pas ont fait
    const e = estimerEchelle(avant, a.unites, -a.avant, -maintenant[nom], { min: (r && MIN_EFFET[r.grandeur]) || 1e-3 });
    if (e !== avant) { const amorti = Math.sign(e) === Math.sign(avant) ? Math.sign(e) * Math.sqrt(Math.abs(e * avant)) : e; S.echelles[k] = amorti; appris.push(`${nom} : ${Math.abs(amorti).toFixed(1)} pas par unité`); }
  }
  S.tours.push({ n: S.tours.length + 1, avant: d.ecart.avant.moyen, apres: d.ecart.apres.moyen, applique: S.appliques.concat(appris.length ? ['échelles apprises : ' + appris.join(', ')] : []) });
  S.attendu = {}; S.appliques = [];
  sauver(); dessinerJournal();
}
/** les corrections encore nécessaires, par réglage, en unités physiques (dB, points, coefficients) */
function grandeurs(d) {
  return { gainR: d.balance.dbR, gainB: d.balance.dbB, pedestal: d.noirs.master, pedestalR: d.noirs.r, pedestalB: d.noirs.b,
    'matrice.rg': d.matrice.rg, 'matrice.rb': d.matrice.rb, 'matrice.gr': d.matrice.gr, 'matrice.gb': d.matrice.gb, 'matrice.br': d.matrice.br, 'matrice.bg': d.matrice.bg };
}
/** la consigne d'un réglage relatif : les pas à ajouter sur B, bornés, et l'écart physique */
function consigneRelative(c, nom, delta) {
  const r = modele(c).reglages[nom.split('.')[0]]; if (!r) return null;
  const e = echelle(c, nom), unites = enUnites(r, delta, e), courant = c.courant[nom];
  const cible = courant != null ? borner(r, courant + unites) : null;
  return { r, unites, courant, cible, estime: !!r.estime && S.echelles[`${c.modele}.${nom}`] == null, physique: formatValeur(r, delta) };
}
function noterApplique(c, nom, unites, texte) {
  if (!unites) return;
  const g = S.diag ? grandeurs(S.diag) : {}; if (nom in g) S.attendu[nom] = { unites, avant: g[nom] };
  S.appliques.push(texte);
}
/** la caméra simulée reçoit les pas avec ses échelles cachées, comme une vraie caméra le ferait */
function appliquerDemo(nom, unites, valeur) {
  const p = S.demoB; if (!p) return;
  const m = /^matrice\.(\w+)$/.exec(nom);
  if (m) p.matrice[m[1]] += unites / DEMO_ECHELLES.matrice;
  else if (nom === 'gainR') p.gain[0] *= Math.pow(10, unites / DEMO_ECHELLES.gainR / 20);
  else if (nom === 'gainB') p.gain[2] *= Math.pow(10, unites / DEMO_ECHELLES.gainB / 20);
  else if (nom === 'pedestal') for (let k = 0; k < 3; k++) p.noir[k] += unites / DEMO_ECHELLES.pedestal / 100;
  else if (nom === 'pedestalR') p.noir[0] += unites / DEMO_ECHELLES.pedestalR / 100;
  else if (nom === 'pedestalB') p.noir[2] += unites / DEMO_ECHELLES.pedestalB / 100;
  else if (nom === 'exposition') p.gain = p.gain.map((g) => g * Math.pow(2, valeur));
  else if (nom === 'gamma') p.gamma = valeur;
  else if (nom === 'saturation') p.saturation = 1 + valeur / 100;
  else if (nom === 'temperature') { const dm = 1e6 / valeur - 1e6 / (S.cams.B.courant.temperature || 5600); p.gain[0] *= 1 + dm / 600; p.gain[2] *= 1 - dm / 600; }
}
/** applique une consigne relative (Panasonic) : la nouvelle valeur = valeur en cours + pas */
async function appliquer(c, nom, unites, texte) {
  if (c.source === 'demo') { appliquerDemo(nom, unites, 0); c.courant[nom] = (c.courant[nom] ?? 0) + unites; noterApplique(c, nom, unites, texte); return; }
  const fam = modele(c).famille; if (!fam) return;
  if (c.courant[nom] == null) await lireCamera(c);
  const r = modele(c).reglages[nom.split('.')[0]];
  const cible = borner(r, (c.courant[nom] ?? 0) + unites);
  const cmds = commandes(fam, nom, cible); if (!cmds) throw new Error(`${nom} : pas de commande sur ce modèle`);
  await envoyer(c, cmds); c.courant[nom] = cible; rafraichirCourant(c);
  noterApplique(c, nom, unites, texte);
}
async function appliquerAbsolu(c, nom, valeur, texte) {
  if (c.source === 'demo') { appliquerDemo(nom, 0, valeur); c.courant[nom] = valeur; S.appliques.push(texte); return; }
  const fam = modele(c).famille; if (!fam) return;
  const cmds = commandes(fam, nom, valeur); if (!cmds) throw new Error(`${nom} : pas de commande sur ce modèle`);
  await envoyer(c, cmds); c.courant[nom] = valeur; rafraichirCourant(c); S.appliques.push(texte);
}

function dessinerRaccord() {
  const root = $('#raccord'); root.replaceChildren();
  const d = S.diag, B = S.cams.B, mB = modele(B), regl = mB.reglages, cgi = mB.pilotage === 'cgi';
  if (!d) { root.append(h('p', { class: 'gris' }, 'Mesurez la mire sur les deux caméras : le raccord s\'affiche ici, dans l\'ordre du line-up.')); return; }
  const av = d.ecart.avant, ap = d.ecart.apres;
  root.append(h('div', { class: 'score' },
    h('div', { class: 'tuile ' + (raccorde(av) ? 'ok' : 'non') }, h('div', { class: 'v' }, `ΔE ${f2(av.moyen)}`), h('div', { class: 'l' }, `écart moyen aujourd'hui (max ${f2(av.max)} sur ${nomPastille(av.pire)}) ; raccordé sous ${TOLERANCES.deltaE}`)),
    h('div', { class: 'tuile ' + (d.ok ? 'ok' : 'non') }, h('div', { class: 'v' }, `ΔE ${f2(ap.moyen)}`), h('div', { class: 'l' }, 'écart prévu une fois tout appliqué (ce que la matrice ne peut pas rattraper reste)')),
    h('div', { class: 'tuile ' + (raccorde(av) ? 'ok' : 'non') }, h('div', { class: 'v' }, raccorde(av) ? 'Raccordées' : 'À régler'), h('div', { class: 'l' }, raccorde(av) ? 'la coupe ne se voit plus : vérifiez sur un visage' : `vecteurscope : ${f2(av.vecto * 100)} (tolérance ${f2(TOLERANCES.vecto * 100)})`))));
  const liste = h('div', { class: 'reglages' }); root.append(liste);
  const bouton = (nom, texte, action) => h('button', { class: 'btn petit ' + (cgi ? 'prim' : ''), onclick: async (ev) => { const b = ev.currentTarget; b.disabled = true; try { await action(); b.textContent = 'Fait'; b.classList.add('ok'); } catch (e) { b.disabled = false; alerte(String(e.message || e)); } } }, texte);
  const fait = (nom, unites, texte) => bouton(nom, 'Je l\'ai réglé', async () => { noterApplique(B, nom, unites, texte); });
  const ligne = (lib, val, approx) => h('div', { class: 'ligne' }, h('span', { class: 'lib' }, lib), h('span', { class: 'val' }, val), approx ? h('span', { class: 'approx' }, approx) : null);
  const bloc = (n, titre, lu, consignes, cote, etat, classe = '') => liste.append(h('div', { class: `reglage ${etat} ${classe}` }, h('div', { class: 'n' }, n), h('div', { class: 'corps' }, h('h3', null, titre), h('div', { class: 'lu' }, lu), consignes.length ? h('div', { class: 'consigne' }, ...consignes) : null), h('div', { class: 'cote' }, ...cote)));
  const relatif = (nom, delta, lib) => {
    const k = consigneRelative(B, nom, delta); if (!k) return { ligne: null, cote: null };
    const approx = `${k.physique}${k.estime ? ' · échelle estimée, affinée au tour suivant' : ''}${k.courant != null ? ` · en cours ${signe(k.courant)} → ${k.cible}` : ''}`;
    const texte = `${lib} ${signe(k.unites)}`;
    return { ligne: ligne(lib, `${signe(k.unites)} pas`, approx), cote: cgi ? bouton(nom, 'Appliquer', () => appliquer(B, nom, k.unites, texte)) : fait(nom, k.unites, texte), unites: k.unites };
  };
  // 1. les noirs
  {
    const ok = Math.abs(d.noirs.master) <= SEUILS.noir && Math.abs(d.noirs.r) <= SEUILS.noir && Math.abs(d.noirs.b) <= SEUILS.noir;
    const items = [['pedestal', d.noirs.master], ['pedestalR', d.noirs.r], ['pedestalB', d.noirs.b]].filter(([nom]) => regl[nom]).map(([nom, v]) => relatif(nom, v, regl[nom].lib));
    bloc('1', 'Les noirs', `Noir mesuré (voie verte) : A ${f2(d.A.g.noir * 100)} %, B ${f2(d.B.g.noir * 100)} %. B doit ${d.noirs.master >= 0 ? 'relever' : 'baisser'} son noir de ${f2(Math.abs(d.noirs.master))} point ; R ${signe(d.noirs.r, 2)}, B ${signe(d.noirs.b, 2)}.`,
      ok ? [h('div', { class: 'gris petit' }, 'Dans la tolérance : rien à faire.')] : items.map((i) => i.ligne), ok ? [] : items.map((i) => i.cote), ok ? 'ok' : 'a-faire');
  }
  // 2. la balance des blancs
  {
    const ok = Math.abs(d.balance.dbR) <= SEUILS.dB && Math.abs(d.balance.dbB) <= SEUILS.dB;
    const items = [['gainR', d.balance.dbR], ['gainB', d.balance.dbB]].filter(([nom]) => regl[nom]).map(([nom, v]) => relatif(nom, v, regl[nom].lib));
    const cons = ok ? [h('div', { class: 'gris petit' }, 'Les gris de B sont neutres comme ceux de A : rien à faire.')] : items.map((i) => i.ligne);
    const cote = ok ? [] : items.map((i) => i.cote);
    if (regl.temperature && !ok) {
      const cur = B.courant.temperature ?? 5600, nouv = borner(regl.temperature, 1e6 / Math.max(20, 1e6 / cur - d.balance.dMireds));
      cons.push(ligne('ou ' + regl.temperature.lib, `${Math.round(nouv)} K`, `décalage de ${signe(-d.balance.dMireds, 0)} mireds${B.courant.temperature == null ? ', si B est réglée à 5600 K' : ''}`));
      if (cgi) cote.push(bouton('temperature', 'Appliquer la température', () => appliquerAbsolu(B, 'temperature', Math.round(nouv), `${regl.temperature.lib} ${Math.round(nouv)} K`)));
    }
    bloc('2', 'La balance des blancs', `Gris vu par A : ${Math.round(d.balance.cctA)} K ; par B : ${Math.round(d.balance.cctB)} K (${d.balance.cctB > d.balance.cctA ? 'B est plus froide, plus bleue' : 'B est plus chaude, plus rouge'}). Gain R ${signe(d.balance.dbR, 2)} dB, gain B ${signe(d.balance.dbB, 2)} dB à donner à B.`, cons, cote, ok ? 'ok' : 'a-faire');
  }
  // 3. l'exposition
  {
    const s = d.exposition.diaph, ok = Math.abs(s) <= SEUILS.diaph;
    bloc('3', 'L\'exposition', `Blanc de la mire : A ${Math.round(d.A.g.gain * 100)} %, B ${Math.round(d.B.g.gain * 100)} %.`,
      ok ? [h('div', { class: 'gris petit' }, 'Même exposition : rien à faire.')] : [ligne(s > 0 ? 'Ouvrir le diaph de B' : 'Fermer le diaph de B', `${f2(Math.abs(s))} diaph`, 'à l\'iris (objectif ou RCP) ; le gain vidéo en dernier recours')],
      ok ? [] : [bouton('exposition', 'Je l\'ai réglé', async () => { if (B.source === 'demo') appliquerDemo('exposition', 0, s); S.appliques.push(`iris ${signe(s, 2)} diaph`); })], ok ? 'ok' : 'a-faire');
  }
  // 4. le gamma
  {
    const ok = Math.abs(d.gamma.facteur - 1) <= SEUILS.gamma, r = regl.gamma;
    const cons = [], cote = [];
    if (!ok && r) {
      const base = B.courant.gamma ?? d.gamma.gB, nouv = borner(r, base * d.gamma.facteur);
      cons.push(ligne(r.lib, nouv.toFixed(2), `exposant ×${f2(d.gamma.facteur)}${B.courant.gamma == null ? ' (depuis l\'exposant mesuré ; lisez la caméra pour partir du réglage en cours)' : ` (en cours ${base.toFixed(2)})`}${r.estime ? ' · à vérifier dans le menu' : ''}`));
      cote.push(cgi ? bouton('gamma', 'Appliquer', () => appliquerAbsolu(B, 'gamma', nouv, `${r.lib} ${nouv.toFixed(2)}`)) : fait('gamma', 0, `${r.lib} ${nouv.toFixed(2)}`));
    } else if (!ok) cons.push(ligne('Gamma', `exposant ×${f2(d.gamma.facteur)}`, 'ce modèle règle son gamma par types : choisissez celui qui s\'en approche'));
    bloc('4', 'Le gamma', `Exposant mesuré sur l'escalier des gris : A ${f2(d.gamma.gA)}, B ${f2(d.gamma.gB)}${ok ? '' : d.gamma.facteur > 1 ? ' : B écrase moins les hautes lumières, il faut la durcir' : ' : B est plus dure, il faut l\'adoucir'}.`,
      ok ? [h('div', { class: 'gris petit' }, 'Même courbe : rien à faire.')] : cons, cote, ok ? 'ok' : 'a-faire', r ? '' : 'sans');
  }
  // 5. la matrice
  {
    const coefs = ['rg', 'rb', 'gr', 'gb', 'br', 'bg'], libs = { rg: 'R-G', rb: 'R-B', gr: 'G-R', gb: 'G-B', br: 'B-R', bg: 'B-G' };
    const ok = coefs.every((k) => Math.abs(d.matrice[k]) <= SEUILS.coef), r = regl.matrice;
    const cons = [], cote = [];
    if (!ok && r) {
      const items = coefs.map((k) => relatif(`matrice.${k}`, d.matrice[k], libs[k]));
      cons.push(...items.map((i) => i.ligne));
      cote.push(bouton('matrice', cgi ? 'Appliquer les six' : 'Je l\'ai réglée', async () => {
        for (const [i, k] of coefs.entries()) { const t = `${libs[k]} ${signe(items[i].unites)}`; if (cgi) await appliquer(B, `matrice.${k}`, items[i].unites, t); else noterApplique(B, `matrice.${k}`, items[i].unites, t); }
      }));
      cons.push(ligne('ou la saturation seule', `×${f2(d.saturation)}`, `${signe((d.saturation - 1) * 100, 0)} % : si les teintes sont justes et seule la vivacité diffère`));
    } else if (!ok) cons.push(ligne('Matrice', coefs.map((k) => `${libs[k]} ${signe(d.matrice[k], 3)}`).join('  '), 'pas de matrice sur ce modèle : à corriger en aval (LUT dans un boîtier ou le mélangeur), ou saturation seule ×' + f2(d.saturation)));
    bloc('5', 'La matrice', ok ? 'Les couleurs de B tombent sur celles de A une fois les gris raccordés.' : `Sur les couleurs linéarisées, B doit recevoir cette matrice (${r ? r.lib : 'coefficients'} : chaque voie reçoit une part de sa différence avec les deux autres ; le blanc ne bouge pas).`,
      ok ? [h('div', { class: 'gris petit' }, 'Rien à faire.')] : cons, cote, ok ? 'ok' : 'a-faire', r ? '' : 'sans');
  }
  // 6. ce qui reste, teinte par teinte
  {
    const restes = d.teintes.filter((t) => t.d > TOLERANCES.vecto).slice(0, 4);
    const el = h('div', { class: 'teintes' });
    for (const t of restes) { const p = S.mire.pastilles.find((m) => m.id === t.id); el.append(h('div', { class: 't' }, h('i', { style: `background:rgb(${p.srgb.join(',')})` }), h('span', null, `${p.nom} (axe ${t.axe}) : teinte ${signe(t.dTeinte, 1)}°, saturation ${signe((t.rapportChroma - 1) * 100, 0)} %`))); }
    bloc('6', 'Ce qui reste, teinte par teinte', restes.length ? 'Après la matrice, ces pastilles s\'écartent encore : la multi-matrix (Sony) ou les 12 axes (Panasonic) corrigent une teinte sans toucher aux autres. Finissez toujours sur un visage.' : 'Après la matrice, toutes les pastilles tiennent dans la tolérance du vecteurscope.',
      restes.length ? [el] : [], [], restes.length ? 'a-faire' : 'ok');
  }
  root.append(h('div', { class: 'actions' },
    h('button', { class: 'btn prim', onclick: remesurer }, 'J\'ai réglé la caméra B : remesurer'),
    h('button', { class: 'btn', 'data-copier': true, onclick: copierConsignes }, 'Copier les consignes'),
    h('span', { class: 'gris petit' }, 'la page remesure B, compare à ce qu\'elle a demandé, apprend l\'échelle des réglages et affine')));
}
const nomPastille = (id) => (S.mire.pastilles.find((p) => p.id === id) || { nom: id }).nom;
let alerteT = 0;
function alerte(texte) { const el = $('#alerte'); el.textContent = texte; el.hidden = false; clearTimeout(alerteT); alerteT = setTimeout(() => { el.hidden = true; }, 6000); }
/** reprend une image de B par sa source, garde les coins si le cadre n'a pas bougé, remesure : le tour suivant */
async function remesurer() {
  const c = S.cams.B;
  try {
    if (c.source === 'webcam') capturerVideo(c, true);
    else if (c.source === 'ip') await instantane(c, true);
    else if (c.source === 'demo') { demo(c); dire(c, 'Caméra simulée remesurée avec les réglages appliqués.'); return; }
    else { dire(c, 'Rechargez une image de B (Image…), puis placez la mire : le tour suivant se calcule.'); return; }
    dire(c, c.mesure ? 'Image reprise et remesurée.' : 'Image reprise : replacez les quatre coins.');
  } catch (e) { dire(c, String(e.message || e), true); }
}
function dessinerEtapes() {
  const A = S.cams.A, B = S.cams.B;
  const etats = [A.image && B.image, A.coins.length === 4 && B.coins.length === 4, A.mesure && B.mesure, S.diag && raccorde(S.diag.ecart.avant)];
  const enCours = etats.findIndex((e) => !e);
  document.querySelectorAll('.etapes li').forEach((li, i) => { li.className = etats[i] ? 'fait' : i === enCours ? 'en-cours' : ''; });
}
function dessinerJournal() {
  const el = $('#journal'); el.replaceChildren();
  if (!S.tours.length) { el.append(h('p', { class: 'gris petit' }, 'Chaque tour (mesure, réglages appliqués, remesure) se note ici.')); return; }
  el.append(h('table', null, h('thead', null, h('tr', null, h('th', null, 'Tour'), h('th', null, 'ΔE mesuré'), h('th', null, 'ΔE prévu'), h('th', null, 'Appliqué'))),
    h('tbody', null, ...S.tours.map((t) => h('tr', null, h('td', null, String(t.n)), h('td', null, f2(t.avant)), h('td', null, f2(t.apres)), h('td', null, t.applique.join(' · ') || '—'))))));
}

// ---------------- la page ----------------
function carte(c) {
  const m = modele(c);
  const select = h('select', { 'aria-label': `Modèle de la caméra ${c.lettre}`, onchange: (ev) => { c.modele = ev.target.value; c.courant = {}; sauver(); rafraichirCarte(c); diagnostiquer(); } }, ...Object.values(CAMERAS).map((k) => h('option', { value: k.id, selected: k.id === c.modele }, k.nom)));
  const adresse = h('input', { type: 'text', placeholder: '192.168.0.10', value: c.adresse, 'aria-label': `Adresse IP de la caméra ${c.lettre}`, oninput: (ev) => { c.adresse = ev.target.value.trim(); sauver(); } });
  const devices = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Caméra ou carte d\'acquisition', hidden: true, onchange: (ev) => ouvrirWebcam(c, ev.target.value).catch((e) => dire(c, String(e.message || e), true)) }));
  const video = h('video', { playsinline: true, muted: true, hidden: true });
  const canvas = h('canvas', { class: 'coins', hidden: true, onclick: (ev) => clicImage(c, ev) });
  const vide = h('div', { class: 'vide' }, c.lettre === 'A' ? 'Chargez une image du signal de la FB80 avec la mire (ou capturez-la par la carte d\'acquisition), puis cliquez les quatre coins de la zone des pastilles : en haut à gauche, en haut à droite, en bas à droite, en bas à gauche.' : 'Branchez la PTZ sur la carte d\'acquisition et capturez (ou chargez une image), puis cliquez les quatre coins de la zone des pastilles, dans le même ordre.');
  const etat = h('div', { class: 'etat' }, '');
  const image = h('div', { class: 'image' }, video, canvas, vide, etat);
  const note = h('p', { class: 'note' }, m.note || '');
  const message = h('div', { class: 'message' }, '');
  const pastilles = h('div', { class: 'pastilles' });
  const sourceBtn = (id, texte, action) => h('button', { class: 'btn', 'data-source': id, onclick: async (ev) => { c.source = id; marquerSource(c); try { await action(ev); } catch (e) { dire(c, String(e.message || e), true); } } }, texte);
  const fichier = h('label', { class: 'btn fichier' + (c.lettre === 'A' ? ' prim' : ''), 'data-source': 'fichier' }, c.lettre === 'A' ? 'Image de la FB80…' : 'Image…', h('input', { type: 'file', accept: 'image/*', 'aria-label': `Image de la caméra ${c.lettre}`, onchange: async (ev) => { const f = ev.target.files[0]; if (!f) return; c.source = 'fichier'; marquerSource(c); try { await chargerFichier(c, f); dire(c, `${f.name} : placez la mire.`); } catch (e) { dire(c, String(e.message || e), true); } } }));
  const webcam = sourceBtn('webcam', c.lettre === 'A' ? 'Carte d\'acquisition' : 'Carte d\'acquisition / caméra', async () => {
    await ouvrirWebcam(c, devices.value || undefined);
    const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    devices.replaceChildren(...list.map((d, i) => h('option', { value: d.deviceId }, d.label || `Caméra ${i + 1}`))); devices.hidden = list.length < 2;
    dire(c, 'Vidéo en direct : cadrez la mire, puis « Capturer ».');
  });
  if (c.lettre === 'B') webcam.classList.add('prim');
  const sources = h('div', { class: 'sources' },
    ...(c.lettre === 'A' ? [fichier, webcam] : [webcam, fichier]),
    sourceBtn('ip', 'Instantané IP', async () => { await instantane(c); dire(c, 'Instantané reçu : placez la mire.'); }),
    sourceBtn('demo', 'Démonstration', async () => { if (c.lettre === 'B') { S.demoB = null; c.courant = {}; rafraichirCourant(c); } demo(c); dire(c, c.lettre === 'A' ? 'Caméra de référence simulée (BT.709).' : 'Caméra simulée avec des défauts : noir, balance, exposition, gamma, matrice. Appliquez, puis remesurez.'); }));
  // les valeurs en cours d'une Panasonic : lues par le relais, ou entrées à la main (page sans serveur)
  const CHAMPS = [['gainR', 'R GAIN'], ['gainB', 'B GAIN'], ['pedestal', 'PEDESTAL'], ['pedestalR', 'R PED.'], ['pedestalB', 'B PED.'], ['gamma', 'GAMMA'], ['matrice.rg', 'R-G'], ['matrice.rb', 'R-B'], ['matrice.gr', 'G-R'], ['matrice.gb', 'G-B'], ['matrice.br', 'B-R'], ['matrice.bg', 'B-G']];
  const courant = h('details', { class: 'courant' }, h('summary', null, 'Valeurs en cours de la caméra'),
    h('p', { class: 'note' }, 'Ce que la caméra affiche aujourd\'hui : la page part de là pour donner la nouvelle valeur. Après une balance automatique, les gains R et B sont à 0 ; une caméra d\'usine a sa matrice à 0 et son gamma à 0,45.'),
    h('div', { class: 'grille' }, ...CHAMPS.map(([nom, lib]) => h('label', null, h('span', null, lib), h('input', { type: 'number', step: nom === 'gamma' ? '0.01' : '1', 'data-courant': nom, 'aria-label': `${lib} en cours`, oninput: (ev) => { const v = parseFloat(ev.target.value); if (Number.isFinite(v)) c.courant[nom] = v; else delete c.courant[nom]; dessinerRaccord(); } })))),
    h('div', { class: 'actions' }, h('button', { class: 'btn petit', 'data-preparer': true, onclick: async (ev) => { const b = ev.currentTarget; b.disabled = true; try { await preparerCamera(c); dire(c, 'Caméra préparée : balance en AWB A, matrice sur User.'); } catch (e) { dire(c, String(e.message || e), true); } b.disabled = false; } }, 'Préparer la Panasonic (AWB A, matrice User)')));
  const actions = h('div', { class: 'actions' },
    h('button', { class: 'btn prim', onclick: () => { try { capturerVideo(c); dire(c, 'Image figée : placez la mire.'); } catch (e) { dire(c, String(e.message || e), true); } } }, 'Capturer'),
    h('button', { class: 'btn', onclick: () => { c.coins = []; c.mesure = null; dessinerPastilles(c); if (c.image) dessinerImage(c); diagnostiquer(); } }, 'Effacer les coins'),
    h('button', { class: 'btn', onclick: () => { if (c.coinsDemo) { c.coins = c.coinsDemo.map((p) => ({ ...p })); mesurer(c); } else if (c.coins.length === 4) mesurer(c); else dire(c, 'Placez d\'abord les quatre coins.'); } }, 'Mesurer'),
    h('button', { class: 'btn', 'data-lire': true, onclick: async (ev) => { const b = ev.currentTarget; b.disabled = true; try { await lireCamera(c); dire(c, 'Réglages en cours lus : ' + Object.entries(c.courant).map(([k, v]) => `${k} ${v}`).join(', ')); dessinerRaccord(); } catch (e) { dire(c, String(e.message || e), true); } b.disabled = false; } }, 'Lire la caméra'));
  const el = h('div', { class: `carte ${c.lettre.toLowerCase()}` },
    h('div', { class: 'titre' }, h('div', { class: 'lettre' }, c.lettre), h('div', null, h('h3', null, c.lettre === 'A' ? 'La référence : l\'image de la FB80' : 'La PTZ à caler'), h('div', { class: 'role' }, c.lettre === 'A' ? 'une image de son signal, avec la mire ; on n\'y touche plus' : 'réglée jusqu\'à rejoindre A'))),
    h('div', { class: 'champs' }, h('label', { class: 'champ' }, h('span', null, 'Modèle'), select), h('label', { class: 'champ' }, h('span', null, 'Adresse IP (Panasonic)'), adresse), h('label', { class: 'champ large', hidden: true }, h('span', null, 'Entrée vidéo'), devices)),
    note, sources, image, actions, pastilles, message, courant);
  c.el = { root: el, select, adresse, devices, video, canvas, vide, etat, image, note, message, pastilles, actions, courant };
  rafraichirCarte(c);
  return el;
}
/** les champs des valeurs en cours suivent c.courant */
function rafraichirCourant(c) {
  if (!c.el) return;
  for (const i of c.el.courant.querySelectorAll('[data-courant]')) { const v = c.courant[i.dataset.courant]; if (document.activeElement !== i) i.value = v == null ? '' : String(v); }
}
function marquerSource(c) { c.el.root.querySelectorAll('[data-source]').forEach((b) => b.classList.toggle('actif', b.dataset.source === c.source)); }
function rafraichirCarte(c) {
  const m = modele(c), cgi = m.pilotage === 'cgi';
  c.el.adresse.disabled = !cgi; c.el.note.textContent = (m.note || '') + (m.aVerifier ? ' Modèle à vérifier sur la caméra.' : '');
  c.el.root.querySelector('[data-source=ip]').disabled = !cgi; c.el.root.querySelector('[data-lire]').disabled = !cgi;
  c.el.courant.hidden = !cgi; c.el.devices.parentElement.hidden = c.el.devices.hidden;
  rafraichirCourant(c);
}
/** le texte des consignes, à coller dans un compte rendu ou à emporter au RCP */
function texteConsignes() {
  const d = S.diag; if (!d) return '';
  const lignes = [`Matching à la mire — ${new Date().toLocaleString('fr-FR')}`, `Référence A : ${modele(S.cams.A).nom} · à caler B : ${modele(S.cams.B).nom}`, `ΔE moyen ${f2(d.ecart.avant.moyen)} (max ${f2(d.ecart.avant.max)} sur ${nomPastille(d.ecart.avant.pire)}) ; prévu après réglage ${f2(d.ecart.apres.moyen)}`, ''];
  for (const bloc of document.querySelectorAll('#raccord .reglage')) {
    lignes.push(`${bloc.querySelector('.n').textContent}. ${bloc.querySelector('h3').textContent} — ${bloc.querySelector('.lu').textContent}`);
    for (const l of bloc.querySelectorAll('.ligne')) lignes.push(`   ${l.querySelector('.lib').textContent} : ${l.querySelector('.val').textContent}${l.querySelector('.approx') ? ' (' + l.querySelector('.approx').textContent + ')' : ''}`);
    for (const t of bloc.querySelectorAll('.teintes .t')) lignes.push(`   ${t.textContent}`);
  }
  return lignes.join('\n');
}
async function copierConsignes(ev) {
  const b = ev.currentTarget, t = texteConsignes(); if (!t) return;
  try { await navigator.clipboard.writeText(t); b.textContent = 'Copié'; } catch (e) {
    const ta = /** @type {HTMLTextAreaElement} */ (h('textarea', { style: 'position:fixed;left:-9999px' }, t)); document.body.append(ta); ta.select(); try { document.execCommand('copy'); b.textContent = 'Copié'; } catch (e2) { alerte('Impossible de copier : sélectionnez le texte du raccord.'); } ta.remove();
  }
  setTimeout(() => { b.textContent = 'Copier les consignes'; }, 2500);
}
function page() {
  charger();
  const app = $('#app');
  app.append(
    h('header', { class: 'en-tete' }, h('h1', null, 'Matching à la mire'), h('span', { class: 'sous' }, 'TIEE Simulator · caler une PTZ sur la FB80 avec une ColorChecker')),
    h('p', { class: 'essentiel' }, h('b', null, 'La même mire, la même lumière, les deux caméras.'), ' Une image du signal de la FB80 avec la mire sert de référence ; la PTZ, prise par la carte d\'acquisition, se cale dessus. La page mesure chaque pastille sur les deux, puis dit quoi régler sur la PTZ dans l\'ordre du line-up : les noirs, la balance, l\'exposition, le gamma, la matrice. On applique, on remesure, elle affine.'),
    h('ol', { class: 'etapes' }, ...['Deux images', 'La mire placée', 'Les mesures', 'Le raccord'].map((t, i) => h('li', null, h('span', { class: 'n' }, String(i + 1)), t))),
    h('div', { id: 'alerte', class: 'message erreur', role: 'alert', hidden: true }),
    h('h2', null, '1 · Les caméras'),
    h('div', { class: 'cameras' }, carte(S.cams.A), carte(S.cams.B)),
    h('p', { class: 'note' }, 'Avec une seule carte d\'acquisition USB (SDI vers UVC, vue comme une webcam) : branchez la FB80, « Carte d\'acquisition » puis « Capturer » sur A ; branchez la PTZ, capturez sur B. L\'image de la FB80 peut aussi être un fichier enregistré depuis la carte (une capture du signal, pas une photo de l\'écran). Mesurez les deux par le même chemin : la mesure est relative, le chemin ne compte pas s\'il est le même. Ouverte d\'un double-clic, la page marche sans serveur ; avec « node tools/matching.mjs », elle lit en plus les réglages de la Panasonic et son instantané.'),
    h('h2', null, '2 · La mesure'),
    h('div', { class: 'mesure' },
      h('div', { class: 'scope' }, h('h3', null, 'Parade des gris'), h('canvas', { id: 'parade', width: 560, height: 260, 'aria-label': 'Parade des six gris, rouge, vert, bleu' }), h('div', { class: 'legende' }, h('span', { class: 'ia' }, h('i'), 'A : trait'), h('span', { class: 'ib' }, h('i'), 'B : barre'))),
      h('div', { class: 'scope' }, h('h3', null, 'Vecteurscope des couleurs'), h('canvas', { id: 'vecto', width: 300, height: 300, 'aria-label': 'Vecteurscope des dix-huit couleurs' }), h('div', { class: 'legende' }, h('span', { class: 'ia' }, h('i'), 'A'), h('span', { class: 'ib' }, h('i'), 'B'), h('span', { class: 'ic' }, h('i'), 'B prévue après réglage')))),
    h('h2', null, '3 · Le raccord : ce qu\'il faut régler sur B'),
    h('div', { id: 'raccord' }),
    h('h2', null, '4 · Journal des tours'),
    h('div', { id: 'journal', class: 'journal' }),
    h('p', { class: 'pied' }, `TIEE Simulator ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''} · BTS Audiovisuel de Saint-Quentin · les échelles des menus sont estimées puis apprises ; vérifiez toujours sur un visage.`));
  diagnostiquer(); dessinerJournal();
  relaisPresent().then(() => { for (const c of [S.cams.A, S.cams.B]) rafraichirCarte(c); });
}
page();

// pour les tests de bout en bout
/** @type {any} */ (window).__dbgMatching = { S, mesurer, demo, DEMO_B, DEMO_ECHELLES, diagnostic: () => S.diag, relaisPresent, lireCamera, appliquer, remesurer };
