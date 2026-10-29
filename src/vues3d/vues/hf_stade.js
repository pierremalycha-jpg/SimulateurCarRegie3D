// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { choice, slider, fmtNum } from '../../cours/kit.js';
import { fspl, ANT, antGain } from '../../cours/hf.js';
import { COUL, mat, verre, eclat, ecran, texte, piece } from '../kit.js';

// ----------------------------------------------------------------------------------
// Vue 3D « La caméra HF dans le stade » : un stade au 1/10 (terrain de 105 × 68 m), deux antennes de
// réception sur le toit de la tribune principale, une caméra HF qui longe la ligne de touche. Les rayons
// montrent le trajet direct (coloré selon la marge) et les échos (sol, tribune d'en face) ; des jauges et un
// historique donnent le niveau à chaque antenne et celui de la diversité. Même modèle que la leçon
// « Antennes, diversité, polarisation » (cours/hf.js : bilan, gain des antennes, deux réflexions qui
// s'ajoutent en phase ou en opposition) ; COFDM : retard des échos comparé à l'intervalle de garde.
// ----------------------------------------------------------------------------------
const K = 0.1; // mètres → scène
const PTX = 20, GTX = 2, F = 2200, LAMBDA = 300 / F, HC = 1.5, SENS = -87, CABLE = 2;
const ANTS = [{ id: 'A', x: -40, y: -46, h: 12, col: 0xffd38a }, { id: 'B', x: 40, y: -46, h: 12, col: 0x7fd3f3 }];
const OBST = 16; // dB : la caméra derrière un obstacle (banc de touche, tribune), comme la leçon du bilan
const C = 3e8;

export const VUE_HF_STADE = {
  id: 'hf-stade', chapitre: 'hf', titre: 'La caméra HF dans le stade',
  resume: 'Une caméra HF longe la ligne de touche ; deux antennes sur le toit la reçoivent. Le bilan de liaison, les échos sur le sol et les tribunes, la diversité, les antennes directives, le COFDM.',
  lecons: ['hf-antennes', 'hf-bilan', 'hf-cofdm'],
  lectures: ['Caméra HF', 'Antenne A', 'Antenne B', 'Diversité', 'Échos (COFDM)'],
  depart: 'Le stade est au 1/10. La caméra émet 100 mW à 2,2 GHz ; les antennes sont à 12 m de haut. Couleur des rayons : marge (vert ≥ 10 dB, orange ≥ 3 dB, rouge en dessous).',
  vue: { cible: [0, 1.0, -0.4], dir: [0, 0.75, 1], dist: 15.5 },
  orbite: { rMin: 1.5, rMax: 26, phiMax: 1.45 },
  etapes: [
    { t: 'Le stade, la caméra HF et ses antennes', reglage: { ant: 'patch', echo: false, div: true }, lecon: 'hf-antennes',
      texte: `Une **caméra HF** (sans fil) suit le jeu le long de la ligne de touche. Elle émet son image codée en **COFDM**, de l'ordre de **100 mW à 2,2 GHz**, par une petite antenne omnidirectionnelle.

Sur le toit de la tribune principale, à 12 m, deux **antennes de réception** (A et B) visent le terrain. Leurs câbles descendent au récepteur, dans le car. Chaque rayon va de la caméra à une antenne ; sa couleur dit la **marge** de la liaison.` },
    { t: 'Le bilan de liaison', reglage: { ant: 'patch', echo: false, div: true }, lecon: 'hf-bilan',
      texte: `Le niveau reçu se compte en décibels : **puissance émise + gains des antennes − affaiblissement en espace libre − câbles**.

L'espace libre coûte FSPL = 20 log d + 20 log f − 27,55 (d en m, f en MHz) : à 2,2 GHz, **79 dB à 100 m**, et chaque doublement de distance retire **6 dB**. La **marge** est l'écart avec la sensibilité du récepteur (−87 dBm ici) : au-dessus de 10 dB, confortable ; sous 3 dB, le moindre creux fait décrocher l'image. Fais glisser la caméra le long de la touche.` },
    { t: 'Les échos : sol et tribunes', reglage: { ant: 'omni', echo: true, div: false }, lecon: 'hf-antennes',
      texte: `Le signal n'arrive pas que par le chemin direct : il **rebondit** sur le sol et sur la tribune d'en face (les rayons pâles). Ces échos arrivent un peu plus tard et s'**ajoutent** au direct, en phase (le niveau monte) ou en opposition (il s'effondre).

À 2,2 GHz, la longueur d'onde fait **14 cm** : quelques centimètres de déplacement changent tout. D'où des **évanouissements** de 10 à 20 dB, à des endroits précis : regarde l'historique au fond, quand la caméra avance.` },
    { t: 'La diversité : deux antennes valent mieux qu\'une', reglage: { ant: 'omni', echo: true, div: true }, lecon: 'hf-antennes',
      texte: `Les creux ne tombent **pas au même endroit** pour deux antennes écartées : quand A est dans un trou, B ne l'est presque jamais. Le récepteur en **diversité** garde, à chaque instant, la meilleure (ou combine les deux).

Sur l'historique, la courbe blanche (la diversité) reste au-dessus des creux de A (jaune) et de B (bleu). Les récepteurs de caméras HF ont souvent quatre antennes, ou plus.` },
    { t: 'Des antennes directives', reglage: { ant: 'panneau', echo: true, div: true }, lecon: 'hf-antennes',
      texte: `Une antenne **directive** (patch, panneau) ne crée pas d'énergie : elle la **concentre** dans un faisceau, d'où son gain (13 dBi pour ce panneau, contre 2 pour un fouet omni), et elle entend moins les échos venus d'ailleurs.

Le prix : il faut **viser**. Hors du faisceau (les cônes), le gain s'effondre. On les règle en visant le centre du terrain, et on vérifie aux quatre coins.` },
    { t: 'COFDM : l\'écho dans l\'intervalle de garde', reglage: { ant: 'omni', echo: true, div: true }, lecon: 'hf-cofdm',
      texte: `Un écho est un retard : un détour de 60 m, c'est **0,2 µs**. Avec une seule porteuse à 8 MHz, un symbole ne dure que 0,125 µs : l'écho brouille le symbole suivant.

Le **COFDM** répartit le débit sur des milliers de porteuses lentes : en 2K, un symbole dure **224 µs**, précédé d'un **intervalle de garde** (56 µs en garde 1/4). Tout écho plus court que la garde est absorbé : dans un stade, ils le sont tous (lis « Échos »). Restent les **creux** de niveau, que règle la diversité.` },
    { t: 'Un obstacle : la falaise', reglage: { ant: 'patch', echo: true, div: true, obst: true }, lecon: 'hf-bilan',
      texte: `La caméra passe derrière un **obstacle** (banc de touche, joueurs, angle de tribune) : de l'ordre de **16 dB** de plus d'un coup. Si la marge était faible, l'image **gèle puis disparaît** : c'est l'effet de falaise du numérique.

D'où les règles : de la marge partout sur le parcours (au moins 10 dB), des antennes de part et d'autre, et un repérage avant le match, caméra en main, aux endroits que le réalisateur demandera.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { ant: 'patch', echo: false, div: true, obst: false, auto: true, x: 0, y: 30, dir: 1, hist: [] };
    // ---------------- le stade ----------------
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105 * K, 68 * K), mat('herbe', 0x2f7a3a, { roughness: 0.95 }));
    pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.01; pitch.userData.info = { nom: 'Le terrain (105 × 68 m)', texte: 'À l\'échelle 1/10.' }; root.add(pitch);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(105 * K, 68 * K)), new THREE.LineBasicMaterial({ color: 0xe8ece6 })); lines.rotation.x = -Math.PI / 2; lines.position.y = 0.02; root.add(lines);
    const mid = new THREE.Mesh(new THREE.RingGeometry(0.88, 0.92, 48), new THREE.MeshBasicMaterial({ color: 0xe8ece6 })); mid.rotation.x = -Math.PI / 2; mid.position.y = 0.02; root.add(mid);
    const stands = piece('tribunes', 'beton', (b) => {
      b.cbox(130 * K, 1.4, 1.2, 0, 0.7, -4.6 - 0.6, 0x5a5f66, 0.05, 0, 0.0); // principale (antennes sur le toit)
      b.cbox(130 * K, 1.3, 1.2, 0, 0.65, 4.4 + 0.6, 0x5a5f66, 0.05); // en face
      b.cbox(1.2, 1.1, 80 * K, -6.6, 0.55, 0, 0x50555c, 0.05); b.cbox(1.2, 1.1, 80 * K, 6.6, 0.55, 0, 0x50555c, 0.05);
      b.cbox(130 * K, 0.06, 1.6, 0, 1.43, -5.0, 0x3a3f46, 0.02); // toit
    });
    stands.userData.info = { nom: 'Les tribunes', texte: 'Le béton réfléchit le signal : la tribune d\'en face renvoie un écho vers les antennes.' };
    root.add(stands);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(130 * K, 1.3), verre(0x8fd6ea, 0.08, { depthWrite: false, side: THREE.DoubleSide })); face.position.set(0, 0.65, 4.39); face.userData.passe = true; root.add(face);
    const tFace = texte('tribune d\'en face : elle réfléchit', { h: 0.18 }); tFace.position.set(0, 1.55, 5.0); root.add(tFace);
    // ---------------- les antennes ----------------
    const antObj = ANTS.map((a) => {
      const g = new THREE.Group(); g.position.set(a.x * K, a.h * K + 0.0, a.y * K); root.add(g);
      g.add(piece('mât', 'alu', (b) => { b.cyl(0.02, 0.02, 0.5, 0, 0.25, 0, 0x9aa4ad, 8); b.cbox(0.22, 0.28, 0.05, 0, 0.55, 0.03, 0xd8dce0, 0.01); }, { mat: { metalness: 0.6, roughness: 0.4 } }));
      g.userData.info = () => ({ nom: `Antenne ${a.id}`, texte: `${ANT[S.ant].name} : ${ANT[S.ant].gain} dBi${S.ant === 'omni' ? ', dans toutes les directions' : `, faisceau de ${ANT[S.ant].hp * 2}° environ`}. À 12 m, sur le toit de la tribune principale.` });
      // faisceau : un cône translucide vers le centre du terrain
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32, 1, true), verre(a.col, 0.09, { depthWrite: false, side: THREE.DoubleSide }));
      cone.userData.passe = true; root.add(cone);
      // jauge de niveau
      const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), eclat(0x7fd1a0)); g.add(gauge);
      const tag = ctx.label(g, '', { off: [0, 1.65, 0], cls: 'small' });
      const pick = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), eclat(a.col)); pick.position.y = 0.55; g.add(pick);
      return { a, g, cone, gauge, tag, pick };
    });
    // la caméra HF
    const cam = new THREE.Group(); root.add(cam);
    cam.add(piece('caméra HF', 'plastique', (b) => { b.cbox(0.16, 0.14, 0.26, 0, 0.18, 0, 0x3a4048, 0.02); b.cyl(0.045, 0.05, 0.14, 0, 0.18, 0.18, 0x15181b, 14, Math.PI / 2); b.cyl(0.006, 0.006, 0.18, -0.06, 0.32, -0.08, 0x9aa4ad, 6); }));
    cam.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), mat('plastique', 0x202428)));
    cam.userData.info = () => ({ nom: 'Caméra HF', texte: `Émet ${PTX} dBm (100 mW) à ${F} MHz, antenne de ${GTX} dBi. Position : ${fmtNum(S.x, 0)} m le long de la touche${S.obst ? ', derrière un obstacle (16 dB)' : ''}.` });
    const camTag = ctx.label(cam, 'caméra HF', { off: [0, 0.6, 0], cls: 'hot' });
    // les rayons : direct, sol, tribune d'en face (pour chaque antenne)
    // chaque rayon est une suite de segments : des cylindres unitaires orientés d'un point à l'autre
    const barGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), echoM = eclat(0xbfe9f6, 0.4);
    const ray = (n, m, r) => { const g = new THREE.Group(); g.userData.r = r; for (let k = 0; k < n; k++) { const b = new THREE.Mesh(barGeo, m); b.userData.passe = true; g.add(b); } root.add(g); return g; };
    const rays = antObj.map(() => ({ direct: ray(1, eclat(0x7fd1a0, 0.95), 0.03), sol: ray(2, echoM, 0.014), trib: ray(2, echoM, 0.014) }));
    // l'historique, au fond
    const hist = ecran(6, 1.6, 900, () => {}); hist.mesh.position.set(0, 2.7, -6.0); hist.mesh.rotation.x = -0.3; root.add(hist.mesh);
    hist.mesh.userData.info = { nom: 'Niveau reçu pendant le déplacement', texte: 'Jaune : antenne A ; bleu : antenne B ; blanc : la diversité (la meilleure). Pointillé rouge : la sensibilité du récepteur.' };
    /** niveau reçu (dBm) à une antenne : bilan, gain selon l'angle, échos sol et tribune (cours/hf.js) */
    function level(a) {
      const dx = S.x - a.x, dy = S.y - a.y, dh = Math.hypot(dx, dy), d = Math.hypot(dh, a.h - HC);
      const aim = Math.atan2(0 - a.x, 0 - a.y) * 180 / Math.PI;
      const ang = Math.abs((((Math.atan2(dx, dy) * 180 / Math.PI - aim) % 360) + 540) % 360 - 180);
      const direct = PTX + GTX + antGain(S.ant, ang) - fspl(d, F) - CABLE - (S.obst ? OBST : 0);
      const r1 = Math.hypot(dh, a.h + HC) - d, g1 = S.echo ? 0.6 : 0;
      const yi = 2 * 44 - S.y, dh2 = Math.hypot(dx, yi - a.y), r2 = Math.hypot(dh2, a.h - HC) - d, g2 = S.echo ? 0.5 * Math.min(1, d / dh2) : 0;
      const re = 1 + g1 * Math.cos(2 * Math.PI * r1 / LAMBDA + Math.PI) + g2 * Math.cos(2 * Math.PI * r2 / LAMBDA + Math.PI);
      const im = g1 * Math.sin(2 * Math.PI * r1 / LAMBDA + Math.PI) + g2 * Math.sin(2 * Math.PI * r2 / LAMBDA + Math.PI);
      const fade = 20 * Math.log10(Math.max(0.02, Math.hypot(re, im)));
      return { lvl: direct + fade, direct, fade, d, ang, r1, r2, aim };
    }
    const colOf = (m) => (m >= 10 ? COUL.vert : m >= 3 ? COUL.ambre : COUL.rouge);
        const Va = new THREE.Vector3(), Vb = new THREE.Vector3(), Vc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const setLine = (g, pts) => g.children.forEach((b, k) => {
      Va.set(pts[k][0], pts[k][1], pts[k][2]); Vb.set(pts[k + 1][0], pts[k + 1][1], pts[k + 1][2]);
      b.position.addVectors(Va, Vb).multiplyScalar(0.5); Vb.sub(Va); const len = Vb.length();
      b.quaternion.setFromUnitVectors(UP, Vb.normalize()); b.scale.set(g.userData.r, len, g.userData.r);
    });
    let tDraw = 0, tHist = 0;
    function maj(dt) {
      const camP = [S.x * K, 0.2, S.y * K];
      cam.position.set(camP[0], 0, camP[2]);
      const L = antObj.map((o) => level(o.a));
      const best = S.div ? Math.max(L[0].lvl, L[1].lvl) : L[0].lvl;
      antObj.forEach((o, i) => {
        const l = L[i], m = l.lvl - SENS, a = o.a, A = [a.x * K, a.h * K + 0.55, a.y * K];
        setLine(rays[i].direct, [camP, A]); /** @type {any} */ (rays[i].direct.children[0].material).color.set(colOf(m));
        rays[i].direct.visible = S.div || i === 0;
        // réflexion sur le sol : le point où l'angle d'incidence égale l'angle de réflexion (hauteurs 1,5 m et 12 m)
        const fs = HC / (HC + a.h);
        setLine(rays[i].sol, [camP, [camP[0] + (A[0] - camP[0]) * fs, 0.02, camP[2] + (A[2] - camP[2]) * fs], A]); rays[i].sol.visible = S.echo && (S.div || i === 0);
        // réflexion sur la tribune d'en face (plan y = 44 m) : méthode de l'image, comme level()
        const yi = 2 * 44 - S.y, ft = (44 - a.y) / (yi - a.y);
        setLine(rays[i].trib, [camP, [(a.x + ft * (S.x - a.x)) * K, (a.h + ft * (HC - a.h)) * K, 4.39], A]); rays[i].trib.visible = S.echo && (S.div || i === 0);
        // faisceau et jauge
        // le faisceau : un cône dont la pointe est à l'antenne, visé vers le centre du terrain
        const hp = ANT[S.ant].hp * Math.PI / 180, len = 5.5;
        o.cone.visible = S.ant !== 'omni' && (S.div || i === 0);
        o.cone.scale.set(Math.tan(hp) * len, len, Math.tan(hp) * len);
        Vc.set(-A[0], 0.2 - A[1], -A[2]).normalize();
        o.cone.position.set(A[0] + Vc.x * len / 2, A[1] + Vc.y * len / 2, A[2] + Vc.z * len / 2);
        o.cone.lookAt(A[0], A[1], A[2]); o.cone.rotateX(Math.PI / 2);
        const f = clamp((l.lvl + 100) / 60, 0.02, 1);
        o.gauge.scale.y = f; o.gauge.position.set(0.3, 0.6 + f / 2, 0); /** @type {any} */ (o.gauge.material).color.set(colOf(m));
        o.tag.set(`${a.id} : ${fmtNum(l.lvl, 0)} dBm`); o.tag.show(S.div || i === 0);
        o.g.visible = S.div || i === 0; o.pick.scale.setScalar(S.div && best === l.lvl ? 1.5 : 1);
      });
      tHist += dt;
      if (tHist >= 0.05) { tHist = 0; S.hist.push([L[0].lvl, L[1].lvl, best]); if (S.hist.length > 240) S.hist.shift(); }
      tDraw += dt;
      if (tDraw > 0.1) {
        tDraw = 0;
        const g = hist.g, W = hist.W, H = hist.H, y = (v) => 14 + (-40 - v) / 70 * (H - 28);
        g.fillStyle = '#081014'; g.fillRect(0, 0, W, H);
        g.strokeStyle = '#2a3238'; g.fillStyle = '#8a949c'; g.font = '18px "B612 Mono", monospace';
        for (const v of [-50, -70, -90, -110]) { g.beginPath(); g.moveTo(0, y(v)); g.lineTo(W, y(v)); g.stroke(); g.fillText(`${v} dBm`, 4, y(v) - 3); }
        g.strokeStyle = '#ff6a5a'; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(0, y(SENS)); g.lineTo(W, y(SENS)); g.stroke(); g.setLineDash([]);
        const tr = (k, c, w) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); S.hist.forEach((h, i) => { const x = W - (S.hist.length - 1 - i) * (W / 240); if (i) g.lineTo(x, y(h[k])); else g.moveTo(x, y(h[k])); }); g.stroke(); g.lineWidth = 1; };
        tr(0, '#ffd38a', 2); if (S.div) { tr(1, '#7fd3f3', 2); tr(2, '#ffffff', 3); }
        g.fillStyle = '#e8ece6'; g.font = '600 22px "Archivo Narrow", sans-serif'; g.fillText('niveau reçu (12 dernières secondes)', W - 360, 26);
        hist.mesh.material.map.needsUpdate = true;
        const fmtA = (l) => `${fmtNum(l.lvl, 1)} dBm à ${fmtNum(l.d, 0)} m · espace libre ${fmtNum(fspl(l.d, F), 1)} dB · gain ${fmtNum(antGain(S.ant, l.ang), 1)} dBi${S.echo ? ` · échos ${l.fade >= 0 ? '+' : '−'}${fmtNum(Math.abs(l.fade), 1)} dB` : ''}`;
        if (ui && S.auto) { const r = /** @type {HTMLInputElement | null} */ (ui.querySelector('input[type=range]')); if (r) { r.value = String(Math.round(S.x)); const o = r.nextElementSibling; if (o) o.textContent = `${Math.round(S.x)} m`; } }
        ctx.read('Caméra HF', `${fmtNum(S.x, 0)} m le long de la touche · 100 mW à 2,2 GHz${S.obst ? ' · derrière un obstacle (−16 dB)' : ''}`);
        ctx.read('Antenne A', fmtA(L[0]));
        ctx.read('Antenne B', S.div ? fmtA(L[1]) : 'non utilisée (une seule antenne)');
        ctx.read('Diversité', S.div ? `${fmtNum(best, 1)} dBm (antenne ${L[0].lvl >= L[1].lvl ? 'A' : 'B'}) · marge ${fmtNum(best - SENS, 1)} dB` : `sans diversité : marge ${fmtNum(L[0].lvl - SENS, 1)} dB`);
        const d1 = L[0].r1 * 1e6 / C, d2 = L[0].r2 * 1e6 / C;
        ctx.read('Échos (COFDM)', S.echo ? `retards ${fmtNum(d1, 2)} µs (sol) et ${fmtNum(d2, 2)} µs (tribune) : très en deçà de la garde de 56 µs (COFDM 2K, 1/4) ; ${fmtNum(d2 / 0.125, 1)} symboles d'une porteuse unique à 8 MHz` : 'échos non montrés');
      }
      camTag.set(`caméra HF · marge ${fmtNum(best - SENS, 0)} dB`);
    }
    let ui = null;
    const sync = () => {
      if (!ui) return;
      for (const b of ui.querySelectorAll('[data-v]')) { const v = /** @type {HTMLElement} */ (b).dataset.v; if (ANT[v]) b.setAttribute('aria-pressed', String(v === S.ant)); }
      for (const b of ui.querySelectorAll('[data-k]')) { const k = /** @type {HTMLElement} */ (b).dataset.k; b.setAttribute('aria-pressed', String(!!S[k])); }
    };
    maj(0.2);
    return {
      etape(i, E) {
        const R = E.reglage || {};
        S.ant = R.ant || 'patch'; S.echo = !!R.echo; S.div = R.div !== false; S.obst = !!R.obst; S.auto = true; S.hist = [];
        sync(); maj(0.2);
      },
      update(dt) {
        if (S.auto) { S.x += S.dir * dt * 4.5; if (S.x > 50) S.dir = -1; if (S.x < -50) S.dir = 1; }
        maj(dt);
      },
      commandes() {
        const pos = slider('Position de la caméra', -52, 52, S.x, 1, (v) => { S.auto = false; S.x = v; sync(); }, (v) => `${v} m`);
        ui = el('div', { class: 'v3-ctl' },
          choice('Antennes', [['omni', 'fouet omni 2 dBi'], ['patch', 'patch 9 dBi'], ['panneau', 'panneau 13 dBi']], S.ant, (v) => { S.ant = v; ctx.say(`Antennes de réception : ${ANT[v].name}, ${ANT[v].gain} dBi.`); }),
          pos,
          el('div', { class: 'v3-row' },
            el('button', { type: 'button', class: 'btn small', 'data-k': 'auto', 'aria-pressed': 'true', onclick: () => { S.auto = !S.auto; sync(); } }, 'Caméra en mouvement'),
            el('button', { type: 'button', class: 'btn small', 'data-k': 'echo', 'aria-pressed': String(S.echo), onclick: () => { S.echo = !S.echo; S.hist = []; sync(); } }, 'Échos'),
            el('button', { type: 'button', class: 'btn small', 'data-k': 'div', 'aria-pressed': String(S.div), onclick: () => { S.div = !S.div; S.hist = []; sync(); } }, 'Diversité (deux antennes)'),
            el('button', { type: 'button', class: 'btn small', 'data-k': 'obst', 'aria-pressed': String(S.obst), onclick: () => { S.obst = !S.obst; sync(); } }, 'Obstacle')));
        return ui;
      },
    };
  },
};
