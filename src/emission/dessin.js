// @ts-check
import { MEDIAS, SPOTS, partieA } from './medias.js';

// ----------------------------------------------------------------------------------
// Les images des médias de l'émission, dessinées par le code dans un canvas 2D (aucun fichier) :
// le générique de début (lumières du stade, terrain qui se dessine, titre, affiche du match, coup
// d'envoi, logo de la chaîne), la page de publicité (jingle « Publicité », trois spots de marques
// fictives, jingle de retour) et le générique de fin (score final, générique déroulant, mentions).
// Une image dépend seulement du média et de l'instant : le serveur peut la redessiner à n'importe
// quelle position (lecture, pause, retour au début), et chaque ordinateur d'une session la même.
// ----------------------------------------------------------------------------------
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lin = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** la chaîne fictive qui diffuse l'émission */
export const CHAINE = 'TIEE SPORT';
export const EMISSION = 'LE GRAND MATCH';

/**
 * @typedef {object} InfoMedia ce que les médias affichent du match en cours
 * @property {{ name: string, short: string, color: string, shirt?: number }[]} equipes
 * @property {number[]} [score]
 * @property {[string, string][]} [credits] générique de fin : [rôle, nom]
 * @property {string} [heure] heure du coup d'envoi (« 21:00 »)
 * @property {string} [lieu]
 * @property {string} [competition]
 */

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
function texte(g, s, x, y, size, color, o = {}) {
  g.save();
  g.font = `${o.weight || 700} ${size}px ${FONT}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
  if (o.spacing) { try { /** @type {any} */ (g).letterSpacing = o.spacing + 'px'; } catch (e) { /* navigateur ancien */ } }
  if (o.shadow) { g.shadowColor = o.shadow; g.shadowBlur = o.blur || 18; }
  g.fillStyle = color; g.fillText(s, x, y);
  g.restore();
}
// un écusson générique (pas le blason d'un club) : bouclier, liseré, initiales
function ecusson(g, x, y, s, c1, c2, init) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const path = () => { g.beginPath(); g.moveTo(-40, -48); g.lineTo(40, -48); g.lineTo(40, 6); g.quadraticCurveTo(40, 34, 0, 56); g.quadraticCurveTo(-40, 34, -40, 6); g.closePath(); };
  path(); g.fillStyle = c1; g.fill();
  g.save(); path(); g.clip(); g.fillStyle = c2; g.fillRect(-13, -50, 26, 110); g.restore();
  path(); g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke();
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(-40, -12, 80, 26);
  texte(g, init, 0, 1, 24, '#ffffff', { weight: 800 });
  g.restore();
}
// fond de la chaîne : nuit bleue, halo
function fondNuit(g, W, H, t, teinte = '#1b2b4a') {
  const bg = g.createRadialGradient(W * 0.5, H * 0.6, 30, W * 0.5, H * 0.6, W * 0.8);
  bg.addColorStop(0, teinte); bg.addColorStop(1, '#04060b');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // poussière dorée dans les faisceaux
  g.save();
  for (let i = 0; i < 60; i++) {
    const sx = (i * 137.5) % W, sp = 8 + (i % 7) * 5;
    const y = H - ((t * sp + i * 53) % (H + 40)) + 20, x = sx + Math.sin(t * 0.7 + i) * 12;
    g.globalAlpha = 0.15 + ((i * 31) % 10) / 25; g.fillStyle = i % 3 ? '#ffd23f' : '#ffffff';
    g.fillRect(x, y, 2, 2);
  }
  g.restore();
}
// faisceaux des projecteurs du stade, qui balaient le ciel
function faisceaux(g, W, H, t, a = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const bx = W * (0.08 + i * 0.21), ang = -Math.PI / 2 + Math.sin(t * 0.5 + i * 1.3) * 0.45;
    const L = H * 1.4, w = 0.09;
    const gr = g.createLinearGradient(bx, H, bx + Math.cos(ang) * L, H + Math.sin(ang) * L);
    gr.addColorStop(0, `rgba(255,226,140,${0.32 * a})`); gr.addColorStop(1, 'rgba(255,226,140,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx, H + 10);
    g.lineTo(bx + Math.cos(ang - w) * L, H + Math.sin(ang - w) * L); g.lineTo(bx + Math.cos(ang + w) * L, H + Math.sin(ang + w) * L); g.closePath(); g.fill();
  }
  g.restore();
}
// le terrain en perspective ; ses lignes se dessinent (p de 0 à 1)
function terrain(g, W, H, p, a, zoom = 1) {
  const cx = W / 2, yF = H * (0.55 - 0.05 * zoom), yN = H * 1.04, hwF = W * 0.2 * zoom, hwN = W * 0.66 * zoom;
  const P = (x, z) => { const k = z; const y = yF + (yN - yF) * k; const hw = hwF + (hwN - hwF) * k; return [cx + x * hw, y]; };
  g.save(); g.globalAlpha = a;
  // pelouse rayée
  for (let k = 0; k < 10; k++) {
    const z0 = k / 10, z1 = (k + 1) / 10; const [a0x, a0y] = P(-1.08, z0), [b0x] = P(1.08, z0), [a1x, a1y] = P(-1.08, z1), [b1x] = P(1.08, z1);
    g.fillStyle = k % 2 ? '#1f6b2c' : '#257a33';
    g.beginPath(); g.moveTo(a0x, a0y); g.lineTo(b0x, a0y); g.lineTo(b1x, a1y); g.lineTo(a1x, a1y); g.closePath(); g.fill();
  }
  // lignes
  g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 2.2; g.lineCap = 'round';
  const seg = (x0, z0, x1, z1, q) => { const [ax, ay] = P(x0, z0), [bx, by] = P(x1, z1); const e = clamp(q, 0, 1); if (e <= 0) return; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (bx - ax) * e, ay + (by - ay) * e); g.stroke(); };
  seg(-1, 0, 1, 0, p * 2); seg(1, 0, 1, 1, p * 2 - 0.3); seg(-1, 0, -1, 1, p * 2 - 0.3); seg(-1, 0.5, 1, 0.5, p * 2 - 0.6);
  // surfaces de réparation (fond et devant)
  seg(-0.4, 0, -0.4, 0.13, p * 3 - 1.2); seg(0.4, 0, 0.4, 0.13, p * 3 - 1.2); seg(-0.4, 0.13, 0.4, 0.13, p * 3 - 1.4);
  seg(-0.4, 1, -0.4, 0.87, p * 3 - 1.2); seg(0.4, 1, 0.4, 0.87, p * 3 - 1.2); seg(-0.4, 0.87, 0.4, 0.87, p * 3 - 1.4);
  // rond central (ellipse en perspective)
  if (p > 0.6) {
    const [ox, oy] = P(0, 0.5), [rx] = P(0.17, 0.5); const [, ty] = P(0, 0.42), [, by2] = P(0, 0.58);
    g.beginPath(); g.ellipse(ox, oy, rx - ox, (by2 - ty) / 2, 0, 0, Math.PI * 2 * clamp((p - 0.6) / 0.4, 0, 1)); g.stroke();
  }
  g.restore();
}
function badgeChaine(g, x, y, s = 1, a = 1) {
  g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(s, s);
  rr(g, -86, -20, 172, 40, 6); g.fillStyle = '#0d1424'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#ffd23f'; g.stroke();
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(-62, 0, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0d1424'; g.beginPath(); g.moveTo(-66, -6); g.lineTo(-55, 0); g.lineTo(-66, 6); g.closePath(); g.fill();
  texte(g, CHAINE, 12, 1, 24, '#ffffff', { weight: 800, spacing: 2 });
  g.restore();
}
function enDirect(g, x, y, t, a = 1) {
  g.save(); g.globalAlpha = a;
  rr(g, x, y - 13, 118, 26, 4); g.fillStyle = 'rgba(0,0,0,.6)'; g.fill();
  g.fillStyle = Math.sin(t * 5) > -0.2 ? '#ff2a2a' : '#7a1515'; g.beginPath(); g.arc(x + 15, y, 6, 0, Math.PI * 2); g.fill();
  texte(g, 'EN DIRECT', x + 66, y + 1, 18, '#ffffff', { weight: 700, spacing: 1 });
  g.restore();
}
function titreOr(g, s, x, y, size, a = 1) {
  g.save(); g.globalAlpha = a;
  g.font = `800 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const gr = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.5, '#ffd23f'); gr.addColorStop(1, '#c78a00');
  try { /** @type {any} */ (g).letterSpacing = Math.round(size * 0.06) + 'px'; } catch (e) { /* navigateur ancien */ }
  g.shadowColor = 'rgba(255,190,40,.55)'; g.shadowBlur = 24; g.fillStyle = gr; g.fillText(s, x, y);
  g.shadowBlur = 0; g.lineWidth = 1.5; g.strokeStyle = 'rgba(80,40,0,.6)'; g.strokeText(s, x, y);
  g.restore();
}
// une carte d'équipe (couleurs, écusson générique, nom)
function carteEquipe(g, eq, x, y, w, h, gauche) {
  g.save();
  const c = eq.color || '#333'; const c2 = eq.shirt != null ? hex(eq.shirt) : '#ffffff';
  const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(10,14,24,.95)');
  g.beginPath(); if (gauche) { g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - 40, y + h); g.lineTo(x, y + h); } else { g.moveTo(x + 40, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); }
  g.closePath(); g.fillStyle = gr; g.fill();
  g.fillStyle = c2; g.fillRect(gauche ? x : x + w - 8, y, 8, h);
  ecusson(g, gauche ? x + 80 : x + w - 80, y + h / 2, 0.95, c, c2, eq.short);
  texte(g, eq.name, gauche ? x + 150 : x + w - 150, y + h / 2, 46, '#ffffff', { weight: 800, align: gauche ? 'left' : 'right', shadow: 'rgba(0,0,0,.6)' });
  g.restore();
}

// ---------------- générique de début (30 s) ----------------
function generiqueDebut(g, W, H, t, I) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (t < 0.3 || t >= 29.96) return; // noir de tête et de queue
  const k = lin(t, 0.3, 1.4) * lin(t, 30, 29.1);
  g.save(); g.globalAlpha = k;
  fondNuit(g, W, H, t);
  faisceaux(g, W, H, t, lin(t, 0.5, 2.5) * (1 - 0.6 * lin(t, 24, 27)));
  // le terrain se dessine, la caméra s'en approche
  const pz = 0.85 + 0.25 * easeInOut(lin(t, 2, 22));
  terrain(g, W, H, lin(t, 2.5, 8), lin(t, 2, 4) * (1 - lin(t, 25, 27.5)), pz);
  // voile sombre sous les textes
  const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(0,0,0,.55)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  enDirect(g, 28, 34, t, lin(t, 1.5, 2.2) * (1 - lin(t, 27, 28)));
  badgeChaine(g, W - 116, 34, 0.8, lin(t, 1.8, 2.6) * (1 - lin(t, 26.5, 27.2)));
  // titre de l'émission : arrive en grand, puis monte en tête d'écran
  const tIn = easeOut(lin(t, 4, 6)), tUp = easeInOut(lin(t, 10.5, 12));
  if (t > 4 && t < 27.5) {
    const size = (96 - 52 * tUp) * (1.25 - 0.25 * tIn);
    titreOr(g, EMISSION, W / 2, H * (0.3 - 0.17 * tUp), size, tIn * (1 - lin(t, 26.5, 27.4)));
  }
  // l'affiche : les deux équipes
  const E = I.equipes || [];
  if (E.length >= 2 && t > 11 && t < 24.5) {
    const sIn = easeOut(lin(t, 11.5, 13)), sOut = easeInOut(lin(t, 22.8, 24.3));
    const cw = 410, ch = 118, y = H * 0.42;
    carteEquipe(g, E[0], -cw + (cw + 40) * sIn - (cw + 60) * sOut, y, cw, ch, true);
    carteEquipe(g, E[1], W + 0 - (cw + 40) * sIn + (cw + 60) * sOut, y, cw, ch, false);
    const vs = easeOut(lin(t, 13, 13.6)) * (1 - sOut);
    if (vs > 0) {
      g.save(); g.translate(W / 2, y + ch / 2); g.scale(0.6 + 0.4 * vs, 0.6 + 0.4 * vs); g.globalAlpha *= vs;
      g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#0d1424'; g.stroke();
      texte(g, 'VS', 0, 2, 40, '#0d1424', { weight: 800 });
      g.restore();
    }
    const info = [I.lieu || 'Stade Bollaert-Delelis', I.competition || 'Championnat · Journée 12'].join('   ·   ').toUpperCase();
    texte(g, info, W / 2, y + ch + 46, 24, `rgba(255,255,255,${lin(t, 15, 16) * (1 - sOut)})`, { weight: 600, spacing: 2 });
  }
  // le coup d'envoi
  if (t > 23.5 && t < 28.2) {
    const a = easeOut(lin(t, 23.8, 24.8)) * (1 - lin(t, 27.4, 28));
    texte(g, 'COUP D\'ENVOI', W / 2, H * 0.47, 40, `rgba(255,255,255,${a})`, { weight: 600, spacing: 6 });
    titreOr(g, I.heure || '21:00', W / 2, H * 0.6, 92, a);
    // balayage doré
    const sx = -200 + (W + 400) * lin(t, 24, 25.6);
    const sg = g.createLinearGradient(sx - 120, 0, sx + 120, 0); sg.addColorStop(0, 'rgba(255,210,63,0)'); sg.addColorStop(0.5, 'rgba(255,210,63,.35)'); sg.addColorStop(1, 'rgba(255,210,63,0)');
    g.fillStyle = sg; g.fillRect(0, H * 0.38, W, H * 0.32);
  }
  // le logo de la chaîne, l'éclair blanc, puis le noir
  if (t > 27.4) {
    const a = easeOut(lin(t, 27.5, 28.2));
    g.save(); g.globalAlpha *= a;
    g.beginPath(); g.arc(W / 2, H / 2, 90 + 30 * (1 - a), 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = '#ffd23f'; g.stroke();
    g.restore();
    badgeChaine(g, W / 2, H / 2, 1.5, a);
    const flash = Math.max(0, 1 - Math.abs(t - 28.05) / 0.35);
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.85})`; g.fillRect(0, 0, W, H); }
  }
  g.restore();
}

// ---------------- page de publicité (70 s) ----------------
function identPub(g, W, H, u, sortie) {
  // le jingle « Publicité » : un écran reconnaissable à l'image et au son (début et fin de l'écran publicitaire)
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#ffd23f'); bg.addColorStop(1, '#ffb000');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.18; g.fillStyle = '#0d1424';
  for (let i = -4; i < 14; i++) { const x = i * 90 + (u * 60) % 90; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, 0); g.lineTo(x - 160, H); g.lineTo(x - 200, H); g.closePath(); g.fill(); }
  g.restore();
  const mot = 'PUBLICITÉ';
  g.save(); g.font = `800 120px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  const wTot = g.measureText(mot).width; let x = W / 2 - wTot / 2;
  for (let i = 0; i < mot.length; i++) {
    const c = mot[i]; const cw = g.measureText(c).width;
    const a = sortie ? 1 - easeInOut(lin(u, 2.4 + i * 0.05, 3 + i * 0.05)) : easeOut(lin(u, 0.25 + i * 0.09, 0.6 + i * 0.09));
    g.globalAlpha = a; g.fillStyle = '#0d1424'; g.fillText(c, x, H / 2 + (1 - a) * 30);
    x += cw;
  }
  g.restore();
  if (sortie) {
    // le retour : la chaîne reprend l'antenne
    const a = easeOut(lin(u, 2.8, 3.6));
    if (a > 0) {
      g.fillStyle = `rgba(13,20,36,${a})`; g.fillRect(0, 0, W, H);
      titreOr(g, EMISSION, W / 2, H * 0.44, 76, a);
      texte(g, 'RETOUR À BOLLAERT', W / 2, H * 0.6, 30, `rgba(255,255,255,${a})`, { weight: 600, spacing: 6 });
      badgeChaine(g, W / 2, H * 0.78, 0.9, a);
      const fl = Math.max(0, 1 - Math.abs(u - 4.75) / 0.25); if (fl > 0) { g.fillStyle = `rgba(255,255,255,${fl * 0.6})`; g.fillRect(0, 0, W, H); }
    }
  } else {
    badgeChaine(g, W / 2, H * 0.8, 0.8, lin(u, 1.2, 1.8));
    const w = easeInOut(lin(u, 4.4, 5)); if (w > 0) { g.fillStyle = '#0d1424'; g.fillRect(0, 0, W * w, H); }
  }
}
function spot(g, W, H, u, n) {
  const S = SPOTS[n]; const pack = lin(u, 15, 15.8);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, S.fond[0]); bg.addColorStop(1, S.fond[1]);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 1 - pack;
  if (n === 0) {
    // un cornet de frites, la vapeur qui monte
    const cx = W * 0.3, cy = H * 0.62 + Math.sin(u * 2) * 4;
    for (let i = 0; i < 9; i++) {
      const fx = cx - 70 + i * 17, h = 120 + ((i * 37) % 50), wob = Math.sin(u * 3 + i) * 3;
      g.save(); g.translate(fx + 8, cy - 40); g.rotate(-0.25 + i * 0.06 + wob * 0.01);
      g.fillStyle = '#ffd86b'; g.fillRect(-7, -h + 40, 14, h); g.fillStyle = '#e8a92a'; g.fillRect(4, -h + 40, 3, h); g.restore();
    }
    g.beginPath(); g.moveTo(cx - 95, cy - 50); g.lineTo(cx + 95, cy - 50); g.lineTo(cx, cy + 150); g.closePath();
    g.fillStyle = '#ffffff'; g.fill(); g.save(); g.clip();
    for (let i = -6; i < 8; i++) { g.fillStyle = '#d42020'; g.beginPath(); g.moveTo(cx - 120 + i * 32, cy - 60); g.lineTo(cx - 104 + i * 32, cy - 60); g.lineTo(cx - 40 + i * 20, cy + 160); g.lineTo(cx - 56 + i * 20, cy + 160); g.closePath(); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { g.beginPath(); const sx = cx - 40 + i * 40, y0 = cy - 190 - ((u * 30 + i * 25) % 60); for (let j = 0; j < 40; j++) { const yy = y0 - j * 2; const xx = sx + Math.sin(yy / 12 + u * 2) * 8; if (j) g.lineTo(xx, yy); else g.moveTo(xx, yy); } g.stroke(); }
  } else if (n === 1) {
    // la rue des corons : les fenêtres s'allument une à une
    const base = H * 0.82;
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 128, w = 120, h = 150;
      g.fillStyle = i % 2 ? '#8b3a2b' : '#9c4632'; g.fillRect(x, base - h, w, h);
      g.fillStyle = '#3b2a26'; g.beginPath(); g.moveTo(x - 6, base - h); g.lineTo(x + w / 2, base - h - 50); g.lineTo(x + w + 6, base - h); g.closePath(); g.fill();
      for (let j = 0; j < 2; j++) { const on = u > 1 + i * 0.9 + j * 0.4; g.fillStyle = on ? '#ffe28a' : '#2a3140'; g.fillRect(x + 18 + j * 52, base - h + 30, 32, 38); }
      g.fillStyle = '#4a2a1f'; g.fillRect(x + 46, base - 62, 28, 62);
    }
    g.fillStyle = '#1e2a3a'; g.fillRect(0, base, W, H - base);
    const hy = H * 0.35 - ((u * 25) % 120); g.fillStyle = 'rgba(255,120,140,.85)';
    g.beginPath(); const hx = W * 0.78; g.moveTo(hx, hy + 18); g.bezierCurveTo(hx - 30, hy - 8, hx - 14, hy - 30, hx, hy - 12); g.bezierCurveTo(hx + 14, hy - 30, hx + 30, hy - 8, hx, hy + 18); g.fill();
  } else {
    // le terril au coucher du soleil, un vélo qui le gravit
    const sun = g.createRadialGradient(W * 0.72, H * 0.42, 10, W * 0.72, H * 0.42, 110); sun.addColorStop(0, 'rgba(255,230,150,.95)'); sun.addColorStop(1, 'rgba(255,230,150,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1f2a24'; g.beginPath(); g.moveTo(W * 0.18, H * 0.92); g.lineTo(W * 0.56, H * 0.3); g.lineTo(W * 0.94, H * 0.92); g.closePath(); g.fill();
    const p = easeInOut(lin(u, 1, 12)); const bx = W * 0.2 + (W * 0.56 - W * 0.2) * p, by = H * 0.89 + (H * 0.3 - H * 0.89) * p;
    g.save(); g.translate(bx, by - 30); g.rotate(-0.97 * 0.75);
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    for (const wx of [-22, 22]) { g.beginPath(); g.arc(wx, 0, 16, 0, Math.PI * 2); g.stroke(); const a0 = u * 8; for (let s = 0; s < 3; s++) { g.beginPath(); g.moveTo(wx, 0); g.lineTo(wx + Math.cos(a0 + s * 2.1) * 16, Math.sin(a0 + s * 2.1) * 16); g.stroke(); } }
    g.beginPath(); g.moveTo(-22, 0); g.lineTo(-4, -20); g.lineTo(14, -20); g.lineTo(22, 0); g.moveTo(-4, -20); g.lineTo(0, 0); g.lineTo(-22, 0); g.stroke();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(2, -48, 8, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(2, -40); g.lineTo(-2, -20); g.stroke();
    g.restore();
    if (p >= 1) { g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(W * 0.56, H * 0.3); g.lineTo(W * 0.56, H * 0.2); g.stroke(); g.fillStyle = '#ffd23f'; g.fillRect(W * 0.56, H * 0.2, 34, 20); }
  }
  g.restore();
  // la marque et son slogan
  const mIn = easeOut(lin(u, 0.6, 1.6));
  if (pack < 1) {
    texte(g, S.marque.toUpperCase(), n === 0 ? W * 0.68 : W * 0.5, n === 1 ? H * 0.16 : H * 0.22, 64, S.encre, { weight: 800, shadow: 'rgba(0,0,0,.25)', blur: 10 });
    g.save(); g.globalAlpha = mIn * lin(u, 3, 4) * (1 - pack);
    texte(g, S.slogan, n === 0 ? W * 0.68 : W * 0.5, n === 1 ? H * 0.27 : H * 0.33, 28, S.encre, { weight: 600 });
    g.restore();
  }
  // plan final : le logo, le slogan, la mention
  if (pack > 0) {
    g.save(); g.globalAlpha = pack;
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, W, H);
    rr(g, W / 2 - 300, H / 2 - 110, 600, 180, 18); g.fillStyle = '#ffffff'; g.fill();
    texte(g, S.marque, W / 2, H / 2 - 40, 66, S.fond[1], { weight: 800 });
    texte(g, S.slogan, W / 2, H / 2 + 28, 26, '#333a44', { weight: 600 });
    texte(g, 'Marque fictive · TIEE Simulator', W / 2, H - 34, 18, 'rgba(255,255,255,.75)', { weight: 500 });
    g.restore();
  }
}
function pagePub(g, W, H, t) {
  const p = partieA('pub', t); if (!p) return;
  const u = t - p.de;
  if (p.quoi === 'ident') identPub(g, W, H, u, false);
  else if (p.quoi === 'retour') identPub(g, W, H, u, true);
  else spot(g, W, H, u, /** @type {number} */ (p.spot));
  // un noir d'une image entre deux spots (les raccords d'un écran publicitaire)
  if (p.quoi === 'spot' && (u < 0.08 || u > 19.92)) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
}

// ---------------- générique de fin (30 s) ----------------
function generiqueFin(g, W, H, t, I) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (t < 0.25 || t >= 29.96) return;
  const k = lin(t, 0.25, 1.2) * lin(t, 30, 28.6);
  g.save(); g.globalAlpha = k;
  fondNuit(g, W, H, t, '#16233d');
  faisceaux(g, W, H, t * 0.6, 0.45);
  // le score final, puis il monte en tête d'écran pendant que le générique défile
  const E = I.equipes || []; const sc = I.score || [0, 0];
  const up = easeInOut(lin(t, 6, 7.6));
  const sy = H * (0.45 - 0.33 * up), ss = 1 - 0.45 * up;
  g.save(); g.translate(W / 2, sy); g.scale(ss, ss);
  if (t < 6.5) texte(g, 'SCORE FINAL', 0, -96, 34, `rgba(255,210,63,${lin(t, 1, 1.8) * (1 - lin(t, 5.6, 6.4))})`, { weight: 700, spacing: 8 });
  if (E.length >= 2) {
    const a = easeOut(lin(t, 1.2, 2.2));
    g.globalAlpha *= a;
    rr(g, -420, -48, 840, 96, 10); g.fillStyle = 'rgba(8,12,22,.88)'; g.fill();
    g.fillStyle = E[0].color; g.fillRect(-420, -48, 12, 96); g.fillStyle = E[1].color; g.fillRect(408, -48, 12, 96);
    texte(g, E[0].name, -380, 2, 50, '#ffffff', { weight: 800, align: 'left' });
    texte(g, E[1].name, 380, 2, 50, '#ffffff', { weight: 800, align: 'right' });
    rr(g, -92, -38, 184, 76, 8); g.fillStyle = '#ffd23f'; g.fill();
    texte(g, `${sc[0]} - ${sc[1]}`, 0, 3, 62, '#0d1424', { weight: 800 });
  }
  g.restore();
  // le générique déroulant : qui a tenu chaque poste
  const C = I.credits || [];
  if (t > 7 && C.length) {
    const lh = 66, top = H * 0.24, total = C.length * lh + H * 0.5;
    const y0 = H + 20 - (total + 40) * lin(t, 7.5, 26.5);
    g.save(); g.beginPath(); g.rect(0, top, W, H - top); g.clip();
    C.forEach(([role, nom], i) => {
      const y = y0 + i * lh; if (y < top - 40 || y > H + 40) return;
      const fade = clamp((y - top) / 50, 0, 1) * clamp((H - y) / 50, 0, 1);
      texte(g, role.toUpperCase(), W / 2, y - 14, 18, `rgba(255,210,63,${0.95 * fade})`, { weight: 600, spacing: 3 });
      texte(g, nom, W / 2, y + 12, 30, `rgba(255,255,255,${fade})`, { weight: 700 });
    });
    g.restore();
  }
  // le carton final : la chaîne, l'établissement, la mention
  if (t > 26) {
    const a = easeOut(lin(t, 26.2, 27.2));
    g.save(); g.globalAlpha *= a; g.fillStyle = 'rgba(4,6,11,.85)'; g.fillRect(0, 0, W, H); g.restore();
    badgeChaine(g, W / 2, H * 0.38, 1.5, a);
    texte(g, 'Une émission réalisée dans le TIEE Simulator', W / 2, H * 0.55, 28, `rgba(255,255,255,${a})`, { weight: 600 });
    texte(g, 'BTS Audiovisuel de Saint-Quentin · lycée Henri-Martin', W / 2, H * 0.63, 22, `rgba(255,210,63,${a})`, { weight: 600 });
    texte(g, 'Simulation non officielle, sans lien avec le club', W / 2, H * 0.86, 18, `rgba(200,206,214,${a})`, { weight: 500 });
  }
  g.restore();
}

/**
 * Dessine l'image d'un média à l'instant t (secondes depuis son début).
 * @param {CanvasRenderingContext2D} g
 * @param {number} W
 * @param {number} H
 * @param {string} id
 * @param {number} t
 * @param {InfoMedia} I
 */
export function dessineMedia(g, W, H, id, t, I) {
  const m = MEDIAS[id];
  const tt = clamp(t, 0, m ? m.duree : 0);
  g.save();
  if (id === 'gen-debut') generiqueDebut(g, W, H, tt, I);
  else if (id === 'pub') pagePub(g, W, H, tt);
  else if (id === 'gen-fin') generiqueFin(g, W, H, tt, I);
  else { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  g.restore();
}
