// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { choice, slider, fmtNum } from '../../cours/kit.js';
import { FMT, CABLES, BUDGET, tauOf, drawEye, drawPicture } from '../../cours/sdi.js';
import { COUL, mat, eclat, piece, texte, ecran, courbe, tube } from '../kit.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Le câble s'allonge : affaiblissement et œil » : un coaxial déroulé de l'émetteur au
// récepteur, et, plantés le long du câble, cinq panneaux de mesure qui montrent le même train de bits
// à 0, ¼, ½, ¾ de la longueur et au bout : les fronts s'arrondissent, les bits isolés n'atteignent plus
// leur niveau. Au bout, l'œil brut, l'œil égalisé et l'image reçue. Un DA (réhorloge) posé au milieu
// remet le compteur à zéro. Le modèle est celui de la leçon (cours/sdi.js : affaiblissement Belden à la
// demi-fréquence d'horloge, budgets des égaliseurs, constante de temps du premier ordre).
// ----------------------------------------------------------------------------------
const X0 = -4.9, X1 = 3.9, YC = 0.07; // le câble, posé au sol, de l'émetteur au récepteur
const BITS = [1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1];
const PANX = [0, 0.25, 0.5, 0.75, 1].map((f) => X0 + 0.2 + f * (X1 - X0 - 0.4));

/** le train de bits vu à la distance d : réponse d'un premier ordre de constante tau (en UI), amplitude ±1 */
function forme(tau) {
  const pts = []; const STEPS = 24; const k = 1 - Math.exp(-1 / STEPS / Math.max(0.05, tau));
  let v = 0; for (let w = 0; w < 6 * STEPS; w++) v += ((BITS[BITS.length - 1 - (w % 6)] ? 1 : -1) - v) * k; // régime établi
  for (let i = 0; i < BITS.length; i++) for (let s = 0; s < STEPS; s++) { v += ((BITS[i] ? 1 : -1) - v) * k; pts.push(v); }
  return pts;
}

export const VUE_SDI_OEIL = {
  id: 'sdi-oeil', chapitre: 'sdi', titre: 'Le câble s\'allonge : affaiblissement et œil',
  resume: 'Le même train de bits mesuré le long d\'un coaxial : les fronts s\'arrondissent, l\'œil se ferme, l\'égaliseur le rouvre jusqu\'à la falaise. Un DA remet le compteur à zéro.',
  lecons: ['sdi-oeil', 'sdi-falaise', 'sdi-cable'],
  lectures: ['Liaison', 'Affaiblissement au bout', 'Le récepteur compense', 'Marge', 'État'],
  depart: 'Règle la longueur, le format et le câble : les cinq panneaux et l\'œil du récepteur suivent.',
  vue: { cible: [0.2, 0.9, 0], dir: [0, 0.32, 1], dist: 10.5 },
  orbite: { rMin: 1, rMax: 20 },
  etapes: [
    { t: 'Au départ : un signal carré', lecon: 'sdi-oeil', reglage: { len: 100 }, vue: { cible: [-4.0, 0.9, 0], dir: [0.35, 0.25, 1], dist: 4.6 },
      texte: `À la sortie de l'émetteur, le signal SDI passe d'un niveau à l'autre très vite : **800 mV** crête à crête, des fronts de moins de **135 ps** en 3G (270 ps en HD, 45 ps en 12G).

Le premier panneau mesure le train de bits **à 0 m** : des créneaux nets, chaque bit atteint son niveau, même un 1 isolé entre deux 0.` },
    { t: 'Le câble mange les aigus', lecon: 'sdi-oeil', reglage: { len: 100 }, vue: { cible: [-0.5, 0.9, 0], dir: [0, 0.3, 1], dist: 9.5 },
      texte: `Plus on s'éloigne de l'émetteur, plus les fronts **s'arrondissent** : un coaxial affaiblit davantage les hautes fréquences (effet de peau dans l'âme, pertes dans le diélectrique). Les bits isolés, qui demandent les fréquences les plus hautes, n'ont plus le temps d'atteindre leur niveau.

On compte l'affaiblissement à la **demi-fréquence d'horloge** : 742,5 MHz en HD, 1,485 GHz en 3G, 5,94 GHz en 12G. Un 1694A y perd ≈ 18, 26 et 58 dB par 100 m (fiches Belden, arrondies). Passe en 12G : à longueur égale, la forme s'écrase bien plus vite.` },
    { t: 'L\'œil au bout du câble', lecon: 'sdi-oeil', reglage: { len: 100 }, vue: { cible: [5.85, 1.1, 0.2], dir: [-0.3, 0.18, 1], dist: 3.9 },
      texte: `Au récepteur, l'analyseur superpose des milliers de bits sur deux intervalles : c'est le **diagramme de l'œil**. L'**œil brut** (à gauche) se ferme vite avec la longueur.

L'**égaliseur** du récepteur remonte les aigus et rouvre l'œil (au milieu), jusqu'à son **budget** : 20 dB garantis par la norme en HD et 3G (40 dB en 12G), de l'ordre de 36 dB (42 en 12G) pour un bon égaliseur. Au-delà, le bruit et la gigue l'emportent.` },
    { t: 'La falaise : parfait, puis plus rien', lecon: 'sdi-falaise', reglage: { len: 132 }, vue: { cible: [5.85, 1.1, 0.2], dir: [-0.3, 0.18, 1], dist: 3.9 },
      texte: `Près de la limite (ici 132 m de 1694A en 3G), l'image reste **parfaite**, mais le récepteur se trompe parfois : l'analyseur compte des **erreurs CRC**. Quelques mètres de plus, des **éclats** apparaissent ; encore un peu, et l'image **disparaît**.

C'est l'**effet de falaise** : en numérique, pas de dégradation douce qui préviendrait. On garde de la marge, et l'on surveille le compteur d'erreurs CRC, qui monte avant que l'image ne casse. Fais glisser la longueur entre 120 et 150 m.` },
    { t: 'Un DA remet le compteur à zéro', lecon: 'sdi-cable', reglage: { len: 220, da: true }, vue: { cible: [0.2, 0.9, 0], dir: [0, 0.32, 1], dist: 10 },
      texte: `Une liaison trop longue se coupe en deux : au milieu, un **distributeur** (DA) ou une grille **égalise et réhorloge** le signal. Il en repart un signal neuf, aux fronts nets : les panneaux d'après le DA retrouvent des créneaux.

Le budget de câble se compte donc **par liaison**, d'un appareil qui réhorloge au suivant, pas sur toute la chaîne. Chaque passage en brassage ou raccord coûte en plus quelques dixièmes de dB. Coupe le DA : 220 m d'un seul tenant ne passent plus en 3G.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { len: 100, fmt: '3G', cable: '1694A', da: false, state: 'green' };
    // le câble, posé au sol
    const cMat = mat('plastique', 0x2a5fb0, { roughness: 0.5 });
    const cab = tube(courbe([[X0 - 0.4, 0.45, 0], [X0, YC, 0], [-1, YC, 0.05], [2, YC, -0.05], [X1, YC, 0], [4.75, 0.3, 0.1]]), 0.045, cMat, 160, 10);
    cab.userData.info = () => ({ nom: `Coaxial ${CABLES[S.cable].short}, ${S.len} m`, texte: `${CABLES[S.cable].name} : ${fmtNum(CABLES[S.cable].att[S.fmt], 1)} dB / 100 m à la demi-fréquence d'horloge du ${FMT[S.fmt].name}. La maquette garde la même longueur à l'écran ; les panneaux mesurent à 0, ¼, ½, ¾ et au bout.` });
    root.add(cab);
    // l'émetteur (une CCU) et le récepteur (une entrée de grille, son analyseur et son moniteur)
    const emet = piece('émetteur', 'plastique', (b) => { b.cbox(0.9, 0.5, 0.7, X0 - 0.8, 0.25, 0, 0x2a3138, 0.03); b.cbox(0.92, 0.06, 0.72, X0 - 0.8, 0.53, 0, 0x1b2024, 0.02); });
    emet.userData.info = { nom: 'Émetteur : sortie SDI', texte: 'La sortie d\'une CCU : 800 mV crête à crête sur 75 Ω, fronts nets. Elle ne règle pas son niveau : c\'est le câble qui décide de ce qui arrive.' };
    root.add(emet);
    const t1 = texte('SORTIE SDI', { h: 0.09 }); t1.position.set(X0 - 0.8, 0.36, 0.352); root.add(t1);
    const desk = piece('récepteur', 'laque', (b) => { b.cbox(2.5, 0.06, 1.0, 5.85, 0.72, 0.2, 0x262c32, 0.02); for (const [x, z] of [[4.7, -0.2], [7.0, -0.2], [4.7, 0.6], [7.0, 0.6]]) b.cbox(0.06, 0.7, 0.06, x, 0.36, z, 0x1b2024, 0.02); b.cbox(0.8, 0.3, 0.5, 4.75, 0.15, 0.1, 0x2a3138, 0.03); });
    desk.userData.info = { nom: 'Récepteur : entrée SDI', texte: 'Une entrée de grille : égaliseur, récupération d\'horloge, désembrouillage. Sur la table, l\'analyseur (œil brut, œil égalisé) et le moniteur.' };
    root.add(desk);
    const EW = 300, EH = 190;
    const scr = (x, title) => { const E = ecran(0.72, 0.456, 512, () => {}); E.mesh.position.set(x, 1.1, -0.05); E.mesh.rotation.y = -0.05; root.add(E.mesh); const t = texte(title, { h: 0.06 }); t.position.set(x, 1.38, -0.05); root.add(t); return E; };
    const frameM = piece('écrans', 'plastique', (b) => { for (const x of [5.05, 5.85, 6.65]) { b.cbox(0.78, 0.52, 0.04, x, 1.1, -0.08, 0x15191d, 0.015); b.cbox(0.05, 0.36, 0.05, x, 0.9, -0.1, 0x15191d, 0.01); } });
    root.add(frameM);
    const eRaw = scr(5.05, 'Œil brut'), eEq = scr(5.85, 'Œil égalisé'), ePic = scr(6.65, 'Image reçue');
    // les cinq panneaux de mesure le long du câble
    const panels = PANX.map((x, i) => {
      const E = ecran(1.5, 0.82, 512, () => {});
      E.mesh.position.set(x, 1.05, -0.02); root.add(E.mesh);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8), mat('alu', 0x8a949c)); pole.position.set(x, 0.36, 0); root.add(pole);
      const probe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), eclat(COUL.ambre)); probe.position.set(x, YC, 0); root.add(probe);
      E.mesh.userData.info = () => ({ nom: `Mesure à ${distOf(i)} m`, texte: `Le même train de bits, mesuré à ${distOf(i)} m de ${S.da && i > 2 ? 'du DA' : 'l\'émetteur'} : affaiblissement ${fmtNum(attAt(i), 1)} dB à la demi-fréquence d'horloge.` });
      return E;
    });
    // le DA, au milieu
    const da = piece('DA', 'plastique', (b) => { b.cbox(0.6, 0.18, 0.45, PANX[2], 0.12, 0.5, 0x3a2f1c, 0.02); });
    da.userData.info = { nom: 'DA : distributeur, réhorloge', texte: 'Égalise le signal reçu, le réhorloge (horloge propre, gigue effacée) et le renvoie neuf : la liaison suivante repart avec tout le budget de câble.' };
    root.add(da);
    const daTag = ctx.label(new THREE.Vector3(PANX[2], 0.3, 0.5), 'DA · réhorloge', { cls: 'hot' });
    // des impulsions qui partent de l'émetteur : elles pâlissent et s'étalent le long du câble
    const pulses = ctx.flux(40, new THREE.SphereGeometry(1, 12, 8), eclat(0xffffff, 0.85));
    const line = courbe([[X0, YC + 0.06, 0], [X1, YC + 0.06, 0]]);
    let tEmit = 0;
    const distOf = (i) => Math.round(S.da && i > 2 ? (i - 2) / 2 * (S.len / 2) : i / 4 * S.len);
    const attAt = (i) => distOf(i) * CABLES[S.cable].att[S.fmt] / 100;
    function redraw() {
      const F = FMT[S.fmt], B = BUDGET[S.fmt], per = CABLES[S.cable].att[S.fmt];
      panels.forEach((E, i) => {
        const att = attAt(i), pts = forme(tauOf(att)), g = E.g, W = E.W, H = E.H;
        g.fillStyle = '#081014'; g.fillRect(0, 0, W, H);
        g.strokeStyle = '#2a3a44'; g.lineWidth = 1; g.setLineDash([4, 4]);
        for (const y of [0.22, 0.5, 0.78]) { g.beginPath(); g.moveTo(0, H * y); g.lineTo(W, H * y); g.stroke(); }
        g.setLineDash([]);
        g.strokeStyle = att > B.typ ? '#ff8a80' : att > B.norme ? '#ffd38a' : '#7fd3f3'; g.lineWidth = 3; g.beginPath();
        pts.forEach((v, k) => { const x = 8 + k / pts.length * (W - 16), y = H * 0.5 - v * H * 0.28; if (k) g.lineTo(x, y); else g.moveTo(x, y); });
        g.stroke();
        g.fillStyle = '#e8ece6'; g.font = '600 26px "Archivo Narrow", sans-serif'; g.fillText(`${distOf(i)} m${S.da && i > 2 ? ' après le DA' : ''}`, 10, 30);
        g.fillStyle = '#aab4ba'; g.font = '20px "Archivo Narrow", sans-serif'; g.fillText(`${fmtNum(att, 1)} dB`, W - 90, 30);
        E.mesh.material.map.needsUpdate = true;
      });
      const end = S.da ? attAt(4) : attAt(4), margin = B.typ - end, r = end / B.typ;
      const state = end <= B.norme ? 'green' : end <= B.typ ? 'orange' : 'red';
      const sc = (E, W, H, f) => { const c = document.createElement('canvas'); c.width = W; c.height = H; f(c.getContext('2d')); E.g.drawImage(c, 0, 0, E.W, E.H); E.mesh.material.map.needsUpdate = true; };
      sc(eRaw, EW, EH, (g) => drawEye(g, EW, EH, { tau: tauOf(end), jitter: 0.02 + 0.04 * r, noise: 0.015, dead: false, title: 'œil brut' }));
      sc(eEq, EW, EH, (g) => drawEye(g, EW, EH, { tau: 0.05, jitter: 0.02 + 0.22 * r ** 3, noise: 0.02 + 0.3 * r ** 4, dead: state === 'red', title: 'œil égalisé' }));
      sc(ePic, EW, EH, (g) => drawPicture(g, EW, EH, state, margin));
      da.visible = S.da; daTag.show(S.da);
      ctx.read('Liaison', `${F.name} ${fmtNum(F.gbps, 3)} Gb/s · ${CABLES[S.cable].short} · ${S.len} m${S.da ? ' coupés en deux par un DA' : ''}`);
      ctx.read('Affaiblissement au bout', `${fmtNum(end, 1)} dB à ${fmtNum(F.nyq >= 1000 ? F.nyq / 1000 : F.nyq, F.nyq >= 1000 ? 2 : 1)} ${F.nyq >= 1000 ? 'GHz' : 'MHz'} (${fmtNum(per, 1)} dB / 100 m)`);
      ctx.read('Le récepteur compense', `${B.norme} dB garantis · ≈ ${B.typ} dB avec un bon égaliseur`);
      ctx.read('Marge', margin >= 0 ? `${fmtNum(margin, 1)} dB` : `dépassée de ${fmtNum(-margin, 1)} dB`);
      ctx.read('État', state === 'green' ? 'image parfaite, aucune erreur' : state === 'orange' ? (margin > 4 ? 'image parfaite, au-delà du minimum garanti' : margin > 2 ? 'image parfaite, quelques erreurs CRC' : 'éclats à l\'image : la falaise') : 'plus d\'image : le récepteur ne se verrouille plus');
      S.state = state;
    }
    let ui = null;
    const setLen = (v) => { S.len = v; redraw(); if (ui) { const r = /** @type {HTMLInputElement} */ (ui.querySelector('input[type=range]')); if (r && +r.value !== v) { r.value = String(v); r.dispatchEvent(new Event('input')); } } };
    redraw();
    return {
      etape(i, E) {
        const R = E.reglage || {};
        if (R.da != null || S.da) S.da = !!R.da;
        if (ui) { const b = ui.querySelector(`[data-da="${S.da ? 'oui' : 'non'}"]`); if (b) for (const x of ui.querySelectorAll('[data-da]')) x.setAttribute('aria-pressed', String(x === b)); }
        if (R.len) setLen(R.len); else redraw();
      },
      update(dt) {
        tEmit += dt;
        if (tEmit > 0.35) {
          tEmit = 0;
          pulses.add({ curve: line, speed: 2.2, color: 0xbfe9f6, scale: 0.06, data: {} });
        }
        // une impulsion s'étale et pâlit avec l'affaiblissement (repart neuve après le DA)
        const per = CABLES[S.cable].att[S.fmt], B = BUDGET[S.fmt];
        for (const it of pulses.items) {
          const d = it.t * S.len, dd = S.da && it.t > 0.5 ? d - S.len / 2 : d, a = Math.min(1.2, dd * per / 100 / B.typ);
          it.scale = [0.06 + a * 0.5, Math.max(0.012, 0.06 * (1 - a * 0.8)), Math.max(0.012, 0.06 * (1 - a * 0.8))];
          it.color = a > 1 ? 0x553333 : a > 0.6 ? 0x9a8a6a : 0xbfe9f6;
        }
        if (S.state !== 'green' && Math.random() < dt * 3) redraw(); // les éclats de l'image bougent
      },
      commandes() {
        ui = el('div', { class: 'v3-ctl' },
          slider('Longueur', 0, 250, S.len, 1, (v) => { S.len = v; redraw(); }, (v) => v + ' m'),
          choice('Format', [['HD', 'HD-SDI'], ['3G', '3G-SDI'], ['12G', '12G-SDI']], S.fmt, (v) => { S.fmt = v; redraw(); }),
          choice('Câble', Object.entries(CABLES).map(([k, c]) => [k, c.short, c.name]), S.cable, (v) => { S.cable = v; redraw(); }),
          el('div', { class: 'v3-row' }, el('span', {}, 'DA au milieu :'),
            ...[['non', 'non'], ['oui', 'oui, réhorloge']].map(([v, t]) => el('button', { type: 'button', class: 'btn small', 'data-da': v, 'aria-pressed': String((v === 'oui') === S.da), onclick: (e) => { S.da = v === 'oui'; for (const x of ui.querySelectorAll('[data-da]')) x.setAttribute('aria-pressed', String(x === e.currentTarget)); redraw(); } }, t))));
        return ui;
      },
    };
  },
};
