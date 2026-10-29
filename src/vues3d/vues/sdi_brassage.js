// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { mat, verre, eclat, piece, texte, courbe, tube, inverse } from '../kit.js';

// ----------------------------------------------------------------------------------
// Vue 3D « BNC, 75 Ω et baie de brassage » : un BNC mâle éclaté (broche, isolant, corps et baïonnette,
// bague à sertir), une liaison où une pièce 50 Ω renvoie une partie de chaque impulsion
// (Γ = (50 − 75) / (50 + 75) = −0,2), et une baie de brassage normalée vue en transparence : sans cordon,
// chaque sortie d'en haut est reliée à l'entrée d'en dessous ; un cordon coupe la liaison normale et
// dévie le signal. Valeurs : BNC 75 Ω (IEC 61169-8, SMPTE ST 2082 pour le 12G), coefficient de réflexion
// d'une rupture d'impédance ; la baie est autoterminée, comme la plupart des baies vidéo.
// ----------------------------------------------------------------------------------
const SRC = ['CAM 1', 'CAM 2', 'CAM 3', 'CAM 4', 'EVS A', 'MIRE'];
const SCOL = [0xffd38a, 0x7fd1a0, 0x8ab8ff, 0xff8a80, 0xd08cff, 0xf3f1e8];
const PX = 3.2, PW = 3.0, PY = 1.6; // la baie : centre, largeur, hauteur du milieu
const jx = (i) => PX - PW / 2 + 0.35 + i * (PW - 0.7) / 5;
const TOP = PY + 0.22, BOT = PY - 0.22;

export const VUE_SDI_BRASSAGE = {
  id: 'sdi-brassage', chapitre: 'sdi', titre: 'BNC, 75 Ω et baie de brassage',
  resume: 'Un BNC éclaté, une pièce 50 Ω qui renvoie une partie du signal, et une baie normalée vue en transparence : ce que fait un cordon.',
  lecons: ['sdi-cable', 'sdi-grille'],
  lectures: ['Cordon', 'Entrées de la grille', 'Réflexion'],
  depart: 'Le BNC est agrandi environ 40 fois. Les impulsions colorées suivent chaque signal jusqu\'à la grille.',
  vue: { cible: [0.6, 1.2, 0], dir: [0, 0.3, 1], dist: 10 },
  orbite: { rMin: 0.6, rMax: 20 },
  etapes: [
    { t: 'Le BNC 75 Ω, pièce par pièce', reglage: { eclate: true }, vue: { cible: [-4.75, 1.0, 0], dir: [0.2, 0.35, 1], dist: 4.4 },
      texte: `Le BNC (Bayonet Neill-Concelman) se verrouille d'un quart de tour. Éclaté, de gauche à droite :
- la **broche centrale**, sertie ou soudée sur l'âme ;
- l'**isolant**, qui la tient au centre ;
- le **corps** et sa **baïonnette**, reliés à la tresse ;
- la **bague à sertir**, qui serre la tresse sur le corps.

En vidéo, tout est en **75 Ω** : le rapport des diamètres de la broche et du corps, et l'isolant, sont calculés pour garder l'impédance du câble jusque dans l'embase. Un BNC 75 Ω prévu 12G garde cette impédance jusqu'à 12 GHz.` },
    { t: 'Une pièce 50 Ω : la réflexion', reglage: { eclate: false, p50: true }, vue: { cible: [-1.2, 0.6, 0], dir: [0, 0.45, 1], dist: 4.6 },
      texte: `Un BNC **50 Ω** (informatique, radio) s'emboîte parfaitement dans un 75 Ω, mais sa broche est plus épaisse. À cette **rupture d'impédance**, une partie de chaque impulsion repart en arrière : Γ = (50 − 75) / (50 + 75) = **−0,2**, soit **20 %** de l'amplitude réfléchie, en sens inverse.

Ces réflexions brouillent les bits suivants : l'œil se ferme, la liaison perd une bonne partie de sa portée. Sur une liaison courte, ça passe peut-être ; sur une longue, c'est la falaise. Coupe la pièce 50 Ω : plus d'écho.` },
    { t: 'La baie normalée : sans cordon', reglage: { cordon: null }, vue: { cible: [PX, 1.4, 0], dir: [0.15, 0.28, 1], dist: 5 },
      texte: `La **baie de brassage** (jackfield) aligne des embases par paires : en haut les **sorties** des appareils (caméras, serveurs, mire), en bas les **entrées** (ici la grille). La façade est montrée en transparence.

Sans cordon, chaque embase du haut est reliée **à l'intérieur** à celle d'en dessous : c'est la liaison **normale**. Le car fonctionne ainsi sans un seul cordon : la caméra 1 arrive sur l'entrée 1 de la grille, la 2 sur la 2…` },
    { t: 'Le cordon dévie le signal', reglage: { cordon: [1, 4] }, vue: { cible: [PX, 1.4, 0], dir: [0.15, 0.28, 1], dist: 5 },
      texte: `Un **cordon** enfoncé dans une embase **coupe la liaison normale** de sa paire. Ici, la sortie de la CAM 2 part par le cordon vers l'entrée 5 de la grille : l'entrée 5 reçoit la CAM 2, l'entrée 2 ne reçoit plus rien, et l'EVS A, dont la liaison normale est coupée par le cordon, n'arrive plus nulle part.

L'embase laissée seule est fermée sur **75 Ω** (baie autoterminée). Le brassage sert à **dévier** un signal en secours, sans toucher aux câbles de l'arrière. Change le cordon dans « À toi ».` },
    { t: 'Ce qui casse au brassage', reglage: { cordon: [1, 4], p50: true }, vue: { cible: [0.8, 1.2, 0], dir: [0, 0.3, 1], dist: 9 },
      texte: `Chaque passage par la baie ajoute deux connecteurs et un cordon : de l'ordre de **0,5 dB**, peu, mais une **rupture d'impédance** possible à chaque usure. Les pannes « intermittentes » naissent là :
- un cordon fatigué ou écrasé (réflexions : le dépassement monte à la baie de mesure) ;
- un cordon à moitié enfoncé (la liaison normale n'est qu'à moitié coupée) ;
- un adaptateur ou un T 50 Ω de passage.

Une liaison longue se fait d'un seul tenant ; un signal à envoyer à plusieurs endroits passe par la grille ou un DA, jamais par un T.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { eclate: true, ex: 1, p50: false, cordon: /** @type {number[] | null} */ (null) };
    // ---------------- le BNC éclaté ----------------
    const K = 0.04; // mètres par millimètre (× 40)
    const bnc = new THREE.Group(); bnc.position.set(-4.7, 1.0, 0); root.add(bnc);
    const parts = [];
    const add = (mesh, name, info, dx) => { mesh.name = name; mesh.userData.info = info; mesh.userData.dx = dx; bnc.add(mesh); parts.push(mesh); return mesh; };
    const cyl = (r0, r1, len, m, seg = 40) => { const g = new THREE.CylinderGeometry(r0, r1, len, seg); g.rotateZ(-Math.PI / 2); return new THREE.Mesh(g, m); };
    const or = mat('alu', 0xe2b452, { metalness: 1, roughness: 0.25 }), ptfe = mat('plastique', 0xf2f2ec, { roughness: 0.55 });
    const pin = cyl(0.5 * K, 0.5 * K, 8 * K, or); pin.position.x = 0.5;
    add(pin, 'broche', { nom: 'Broche centrale (75 Ω : Ø ≈ 1 mm)', texte: 'Dorée, sertie ou soudée sur l\'âme. Sur un BNC 50 Ω, elle est plus épaisse (≈ 1,4 mm) : emboîtée dans une embase 75 Ω, elle l\'abîme et casse l\'impédance.' }, 0.85);
    const iso = cyl(2.3 * K, 2.3 * K, 7 * K, ptfe); iso.position.x = 0.32;
    add(iso, 'isolant', { nom: 'Isolant (PTFE)', texte: 'Il tient la broche au centre ; son diamètre et sa matière sont calculés pour 75 Ω.' }, 0.5);
    const body = piece('corps', 'alu', (b) => {
      b.cyl(3.5 * K, 3.5 * K, 9 * K, 0, 0, 0, 0xd6dadf, 40, 0, Math.PI / 2);
      b.cyl(5.6 * K, 5.6 * K, 8 * K, 0.06, 0, 0, 0xc4c9cf, 40, 0, Math.PI / 2);
      b.cyl(4.2 * K, 4.2 * K, 7 * K, -0.3, 0, 0, 0xd6dadf, 32, 0, Math.PI / 2);
    }, { mat: { metalness: 0.9, roughness: 0.25 } });
    body.position.x = 0.12;
    add(body, 'corps', { nom: 'Corps et baïonnette', texte: 'Le corps, relié à la tresse, et la bague à baïonnette : un quart de tour verrouille le connecteur sur les deux ergots de l\'embase.' }, 0.18);
    const ferrule = cyl(4.4 * K, 4.4 * K, 10 * K, mat('alu', 0xb9bec4, { metalness: 0.9, roughness: 0.3 })); ferrule.position.x = -0.3;
    add(ferrule, 'bague', { nom: 'Bague à sertir', texte: 'Glissée sur le câble avant de le préparer, elle serre la tresse sur le corps à la pince à sertir : le blindage est continu jusqu\'au BNC.' }, -0.28);
    const cab = cyl(3.45 * K, 3.45 * K, 1.6, mat('plastique', 0x2a5fb0, { roughness: 0.5 })); cab.position.x = -1.2;
    add(cab, 'câble', { nom: 'Coaxial 1694A', texte: 'Préparé à la pince à dénuder en trois longueurs (gaine, tresse, diélectrique) avant le sertissage.' }, -0.5);
    const tBnc = texte('BNC 75 Ω mâle, éclaté (× 40)', { h: 0.12 }); tBnc.position.set(-4.9, 1.62, 0); root.add(tBnc);
    ctx.label(pin, 'broche', { off: [0, 0.12, 0] }); ctx.label(iso, 'isolant', { off: [0, 0.16, 0] }); ctx.label(body, 'corps et baïonnette', { off: [0, 0.32, 0] }); ctx.label(ferrule, 'bague à sertir', { off: [0, -0.28, 0] });

    // ---------------- la liaison et la pièce 50 Ω ----------------
    const LY = 0.25, LA = -3.0, LB = 0.6, LJ = -1.2;
    const lien = tube(courbe([[LA, LY, 0], [LB, LY, 0]]), 0.05, mat('plastique', 0x2a5fb0, { roughness: 0.5 }), 8, 12);
    lien.userData.info = { nom: 'Une liaison 75 Ω', texte: 'Les impulsions vont de gauche à droite. Avec une pièce 50 Ω au milieu, une partie repart vers l\'émetteur.' };
    root.add(lien);
    const j50 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 24).rotateZ(Math.PI / 2), mat('alu', 0xe0453a, { metalness: 0.6, roughness: 0.35 }));
    j50.position.set(LJ, LY, 0); j50.userData.info = { nom: 'Pièce 50 Ω', texte: 'Un raccord ou un T en 50 Ω : il s\'emboîte, mais son impédance n\'est pas celle du câble. Γ = (50 − 75) / (50 + 75) = −0,2.' };
    root.add(j50);
    const jTag = ctx.label(j50, 'raccord 50 Ω', { off: [0, 0.22, 0], cls: 'ko' });
    const p50Line = courbe([[LA, LY + 0.09, 0], [LB, LY + 0.09, 0]]), p50Rev = inverse(p50Line), TJ = (LJ - LA) / (LB - LA);
    const pulses = ctx.flux(80, new THREE.SphereGeometry(1, 14, 10), eclat(0xffffff));

    // ---------------- la baie de brassage ----------------
    const face = piece('baie', 'laque', (b) => {
      b.cbox(PW + 0.3, 0.08, 0.5, PX, PY + 0.52, -0.2, 0x1d2227, 0.02); b.cbox(PW + 0.3, 0.08, 0.5, PX, PY - 0.52, -0.2, 0x1d2227, 0.02);
      for (const s of [-1, 1]) b.cbox(0.12, 1.12, 0.06, PX + s * (PW / 2 + 0.09), PY, 0.02, 0x2b3036, 0.02);
    });
    root.add(face);
    const vitre = new THREE.Mesh(new THREE.PlaneGeometry(PW, 0.96), verre(0x9fb3c4, 0.16, { depthWrite: false, side: THREE.DoubleSide }));
    vitre.position.set(PX, PY, 0.03); vitre.userData.passe = true; root.add(vitre);
    const jackM = mat('alu', 0xc9ced3, { metalness: 0.9, roughness: 0.3 });
    const jacks = { top: [], bot: [] };
    for (let i = 0; i < 6; i++) for (const row of ['top', 'bot']) {
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 24).rotateX(Math.PI / 2), jackM);
      j.position.set(jx(i), row === 'top' ? TOP : BOT, 0.05);
      j.userData.info = row === 'top' ? { nom: `Sortie ${SRC[i]}`, texte: `L'embase du haut reçoit, par l'arrière, la sortie de ${SRC[i]}. Sans cordon, elle est normalée vers l'entrée ${i + 1} de la grille.` } : { nom: `Entrée ${i + 1} de la grille`, texte: `L'embase du bas part, par l'arrière, vers l'entrée ${i + 1} de la grille.` };
      root.add(j); jacks[row].push(j);
    }
    for (let i = 0; i < 6; i++) { const t = texte(SRC[i], { h: 0.075, bg: 'rgba(20,24,28,.85)' }); t.position.set(jx(i), TOP + 0.17, 0.06); root.add(t); const u = texte(`GRILLE ${i + 1}`, { h: 0.065, bg: 'rgba(20,24,28,.85)' }); u.position.set(jx(i), BOT - 0.16, 0.06); root.add(u); }
    // derrière la baie : les sources en haut, la grille en bas, les liaisons normales
    const srcBox = piece('sources', 'plastique', (b) => { for (let i = 0; i < 6; i++) b.cbox(0.36, 0.24, 0.3, jx(i), PY + 1.05, -1.0, 0x2a3138, 0.02); });
    srcBox.userData.info = { nom: 'Les sources', texte: 'CCU des caméras, serveur ralenti, mire du SPG : leurs sorties SDI arrivent à l\'arrière des embases du haut.' };
    root.add(srcBox);
    for (let i = 0; i < 6; i++) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.01), eclat(SCOL[i])); lamp.position.set(jx(i), PY + 1.05, -0.845); root.add(lamp); }
    const grille = piece('grille', 'plastique', (b) => { b.cbox(PW, 0.36, 0.4, PX, PY - 1.15, -1.0, 0x23292f, 0.03); });
    grille.userData.info = { nom: 'La grille (entrées 1 à 6)', texte: 'Ce que chaque entrée reçoit est écrit sur sa pastille de couleur.' };
    root.add(grille);
    const inLamps = [];
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.01), eclat(0x222222)); l.position.set(jx(i), PY - 1.12, -0.795); root.add(l); inLamps.push(l); }
    const inTags = inLamps.map((l) => ctx.label(l, '', { off: [0, -0.16, 0], cls: 'small' }));
    const backM = mat('plastique', 0x3a4048, { roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      root.add(tube(courbe([[jx(i), PY + 0.93, -0.85], [jx(i), TOP + 0.2, -0.5], [jx(i), TOP, -0.12]]), 0.018, backM, 24, 8));
      root.add(tube(courbe([[jx(i), BOT, -0.12], [jx(i), BOT - 0.25, -0.5], [jx(i), PY - 0.97, -0.8]]), 0.018, backM, 24, 8));
    }
    // les liaisons normales (dans la baie), allumées quand elles conduisent
    const normals = [];
    for (let i = 0; i < 6; i++) {
      const n = tube(courbe([[jx(i) - 0.02, TOP, -0.06], [jx(i) - 0.12, PY, -0.08], [jx(i) - 0.02, BOT, -0.06]]), 0.012, eclat(SCOL[i], 0.9), 20, 6);
      n.userData.info = { nom: `Liaison normale ${i + 1}`, texte: 'À l\'intérieur de la baie, des contacts relient l\'embase du haut à celle du bas tant qu\'aucun cordon n\'est enfoncé.' };
      root.add(n); normals.push(n);
    }
    // le cordon (en façade)
    const cordM = mat('plastique', 0xd8a23a, { roughness: 0.45 });
    /** @type {THREE.Mesh | null} */ let cord = null;
    const paths = [];
    function rebuild() {
      if (cord) { root.remove(cord); cord.geometry.dispose(); cord = null; }
      const C = S.cordon;
      if (C) {
        const [a, b] = C;
        cord = tube(courbe([[jx(a), TOP, 0.14], [jx(a), TOP, 0.32], [(jx(a) + jx(b)) / 2, PY, 0.62], [jx(b), BOT, 0.32], [jx(b), BOT, 0.14]]), 0.03, cordM, 48, 10);
        cord.userData.info = { nom: `Cordon : ${SRC[a]} → grille ${b + 1}`, texte: `Il coupe les liaisons normales ${a + 1} et ${b + 1}. ${SRC[a]} arrive sur l'entrée ${b + 1} ; l'entrée ${a + 1} ne reçoit plus rien${a !== b ? `, et ${SRC[b]} n'arrive plus nulle part` : ''}.` };
        root.add(cord);
      }
      // ce que reçoit chaque entrée de la grille, et les chemins des impulsions
      const recoit = new Array(6).fill(-1); paths.length = 0;
      for (let i = 0; i < 6; i++) {
        const cut = !!C && (C[0] === i || C[1] === i);
        normals[i].visible = !cut;
        const head = [[jx(i), PY + 0.93, -0.85], [jx(i), TOP + 0.2, -0.5], [jx(i), TOP, -0.12]];
        if (!cut) { recoit[i] = i; paths.push({ src: i, curve: courbe([...head, [jx(i) - 0.12, PY, -0.08], [jx(i), BOT, -0.12], [jx(i), BOT - 0.25, -0.5], [jx(i), PY - 0.97, -0.8]]) }); }
        else if (C && C[0] === i) { const b = C[1]; recoit[b] = i; paths.push({ src: i, curve: courbe([...head, [jx(i), TOP, 0.32], [(jx(i) + jx(b)) / 2, PY, 0.62], [jx(b), BOT, 0.32], [jx(b), BOT, -0.12], [jx(b), BOT - 0.25, -0.5], [jx(b), PY - 0.97, -0.8]]) }); }
      }
      inLamps.forEach((l, i) => { /** @type {any} */ (l.material).color.set(recoit[i] >= 0 ? SCOL[recoit[i]] : 0x222222); inTags[i].set(recoit[i] >= 0 ? SRC[recoit[i]] : 'rien'); });
      ctx.read('Cordon', C ? `${SRC[C[0]]} → grille ${C[1] + 1} (liaisons normales ${C[0] + 1}${C[0] !== C[1] ? ` et ${C[1] + 1}` : ''} coupées)` : 'aucun : la baie est normalée');
      ctx.read('Entrées de la grille', recoit.map((s, i) => `${i + 1} : ${s >= 0 ? SRC[s] : '—'}`).join(' · '));
      ctx.read('Réflexion', S.p50 ? 'pièce 50 Ω : 20 % de chaque impulsion repart en arrière' : 'tout en 75 Ω : aucune réflexion');
      j50.visible = S.p50; jTag.show(S.p50);
    }
    let tP = 0, tL = 0, ui = null;
    rebuild();
    const syncUi = () => {
      if (!ui) return;
      for (const b of ui.querySelectorAll('[data-k]')) { const k = /** @type {HTMLElement} */ (b).dataset.k; b.setAttribute('aria-pressed', String(k === 'eclate' ? S.eclate : k === 'p50' ? S.p50 : false)); }
    };
    return {
      etape(i, E) {
        const R = E.reglage || {};
        if (R.eclate != null) S.eclate = R.eclate;
        if (R.p50 != null) S.p50 = R.p50;
        if ('cordon' in R) S.cordon = R.cordon;
        rebuild(); syncUi();
        if (ui) { const a = /** @type {HTMLSelectElement} */ (ui.querySelector('select[name=de]')), b = /** @type {HTMLSelectElement} */ (ui.querySelector('select[name=vers]')); if (a && S.cordon) { a.value = String(S.cordon[0]); b.value = String(S.cordon[1]); } }
      },
      update(dt) {
        // le BNC s'éclate ou se referme
        S.ex = clamp(S.ex + (S.eclate ? dt : -dt) * 1.2, 0, 1);
        for (const p of parts) p.position.x = (p.userData.x0 ??= p.position.x) + p.userData.dx * S.ex;
        // impulsions sur la liaison : à la pièce 50 Ω, l'impulsion continue à 80 % et un écho de 20 % repart vers la gauche
        tL += dt;
        if (tL > 0.9) { tL = 0; pulses.add({ curve: p50Line, speed: 1.1, color: 0xbfe9f6, scale: 0.07, data: { lien: true } }); }
        for (const it of [...pulses.items]) {
          if (it.data && it.data.lien && S.p50 && !it.data.split && it.t > TJ) {
            it.data.split = true; it.scale = 0.056;
            pulses.add({ curve: p50Rev, speed: 1.1, t: 1 - it.t, color: 0xff6a5a, scale: 0.034, data: {} });
          }
        }
        // les signaux dans la baie
        tP += dt;
        if (tP > 0.45) { tP = 0; for (const p of paths) pulses.add({ curve: p.curve, speed: 1.0, color: SCOL[p.src], scale: 0.035, data: {} }); }
      },
      commandes() {
        const opt = (v, t) => el('option', { value: String(v) }, t);
        const de = el('select', { name: 'de', 'aria-label': 'Source du cordon' }, ...SRC.map((s, i) => opt(i, s)));
        const vers = el('select', { name: 'vers', 'aria-label': 'Entrée de la grille' }, ...SRC.map((s, i) => opt(i, `grille ${i + 1}`)));
        /** @type {HTMLSelectElement} */ (vers).value = '4'; /** @type {HTMLSelectElement} */ (de).value = '1';
        ui = el('div', { class: 'v3-ctl' },
          el('div', { class: 'v3-row' }, el('span', {}, 'Cordon :'), de, el('span', {}, '→'), vers,
            el('button', { type: 'button', class: 'btn small primary', onclick: () => { S.cordon = [+(/** @type {HTMLSelectElement} */ (de).value), +(/** @type {HTMLSelectElement} */ (vers).value)]; rebuild(); ctx.say(`Cordon enfoncé : ${SRC[S.cordon[0]]} vers l'entrée ${S.cordon[1] + 1}. Les liaisons normales de ces deux paires sont coupées.`); } }, 'Brancher'),
            el('button', { type: 'button', class: 'btn small', onclick: () => { S.cordon = null; rebuild(); ctx.say('Cordon retiré : la baie est de nouveau normalée.'); } }, 'Retirer')),
          el('div', { class: 'v3-row' },
            el('button', { type: 'button', class: 'btn small', 'data-k': 'eclate', 'aria-pressed': String(S.eclate), onclick: () => { S.eclate = !S.eclate; syncUi(); } }, 'BNC éclaté'),
            el('button', { type: 'button', class: 'btn small', 'data-k': 'p50', 'aria-pressed': String(S.p50), onclick: () => { S.p50 = !S.p50; rebuild(); syncUi(); ctx.say(S.p50 ? 'Pièce 50 Ω posée : regarde les échos rouges repartir vers la gauche.' : 'Tout en 75 Ω : plus d\'écho.'); } }, 'Pièce 50 Ω')));
        return ui;
      },
    };
  },
};
