// @ts-check
import * as THREE from 'three';
import { el, kelvinRGBNorm } from '../../util.js';
import { commandes, afficheur, jetons, fr } from '../kit.js';
import { SOURCES, GELS } from '../calc/photometrie.js';
import { CAPTEURS } from '../calc/optique.js';
import { plateau, etiquetteNom } from '../plateau/scene.js';
import { sol, cyclo, caisse, plante, lumieresTravail, personnage, luxmetre, camera3d, projecteur, ligne } from '../plateau/pieces.js';
import { mondePhoto, lecturePhoto, borne, LIM, expositionImage, expositionPlateau, capVers, spotDepuis, couleurLumiere, balanceBlancs } from '../plateau/calc.js';

// ----------------------------------------------------------------------------------
// L'atelier « Photométrie » sur le plateau 3D (v19.30) : un sujet au centre du plateau, la cellule d'un
// luxmètre sur sa poitrine (tournée vers la caméra), une caméra sur pied et deux projecteurs sur pied (la
// principale et le débouchage) qu'on prend et qu'on pose où l'on veut : distance et angle autour du sujet
// se relisent de leur place. Chaque projecteur est un vrai projecteur du rendu (candelas, angle de
// faisceau, couleur de sa température) : sa flaque au sol et sur le sujet suit le modèle, son cône de
// lumière la dessine. Dans le coin, l'image de la caméra, exposée d'après le diaphragme, la sensibilité et le
// temps de pose (π ÷ Eref), balancée à sa température, avec le zébra au-dessus de 95 % et la profondeur de
// champ d'un 35 mm Super 35 au diaphragme réglé. Les afficheurs : éclairement de chacun, total, température
// du mélange, écart avec la balance, exposition, rapport de contraste. Tout vient de labo/calc/photometrie.js.
// ----------------------------------------------------------------------------------
const lx = (v) => `${fr(Math.round(v), 0)} lx`;
const num = (hex) => parseInt(String(hex).replace('#', ''), 16);
const r2 = (v) => Math.round(v * 100) / 100;
const SUJET = { x: 0, z: 0 };
const FACE = new THREE.Vector3(0, 1.45, 0);
const NOMS = { p1: 'Principale', p2: 'Débouchage' };

export function creer(/** @type {import('../kit.js').Ctx} */ ctx) {
  const T = jetons();
  const C = commandes(ctx);
  const P = plateau();
  const stage = el('div', { class: 'lb-plateau' });
  const r1 = afficheur('Principale'), r2a = afficheur('Débouchage'), rE = afficheur('Au luxmètre'), rT = afficheur('Couleur de la lumière'), rX = afficheur('Exposition'), rR = afficheur('Contraste');

  const proj = (p, nom) => el('fieldset', { class: 'lb-group' }, el('legend', {}, nom),
    p === 'p2' ? C.caseA('p2.on', 'Allumé') : null,
    C.liste(p + '.source', 'Projecteur', Object.values(SOURCES).map((S) => [S.id, S.nom])),
    C.curseur(p + '.angle', 'Faisceau', { min: 10, max: 60, step: 1, fmt: (v) => fr(v, 0), unite: '°' }),
    C.curseur(p + '.niveau', 'Gradateur', { min: 0, max: 1, step: 0.01, fmt: (v) => fr(v * 100, 0) + ' %' }),
    C.curseur(p + '.Tled', 'Couleur (LED)', { min: 2800, max: 6500, step: 50, fmt: (v) => fr(v, 0) + ' K' }),
    C.liste(p + '.gel', 'Gélatine', GELS.map((g) => [g.id, g.nom])),
    C.curseur(p + '.d', 'Distance', { min: 1, max: 15, step: 0.05, log: true, fmt: (v) => fr(v, 2) + ' m' }),
    C.curseur(p + '.phi', 'Position', { min: -80, max: 80, step: 1, fmt: (v) => (v === 0 ? 'de face' : `${fr(Math.abs(v), 0)}° ${v < 0 ? 'à gauche' : 'à droite'}`) }),
    C.curseur(p + '.alpha', 'Visée', { min: 0, max: 40, step: 1, fmt: (v) => (v === 0 ? 'sur le sujet' : `${fr(v, 0)}° à côté`) }));
  const ctrls = el('div', { class: 'lb-ctls' },
    proj('p1', 'La principale'), proj('p2', 'Le débouchage'),
    el('fieldset', { class: 'lb-group' }, el('legend', {}, 'La caméra'),
      C.touches('cam.iso', 'Sensibilité', [[400, '400'], [800, '800'], [1600, '1600']].map(([v, t]) => [v, `${t} ISO`])),
      C.touches('cam.N', 'Iris', [1.4, 2, 2.8, 4, 5.6, 8, 11].map((n) => [n, 'f/' + fr(n, Number.isInteger(n) ? 0 : 1)])),
      C.curseur('cam.Tcam', 'Balance des blancs', { min: 2800, max: 6500, step: 50, fmt: (v) => fr(v, 0) + ' K' }),
      el('p', { class: 'lb-note' }, 'Temps de pose : 1/50 s. Cellule plate, C = 250. Image : 35 mm sur Super 35.')));

  /** @type {any} */ let SC = null;
  const verrou = (cles) => cles.some((k) => ctx.verrous.has(k) || [...ctx.verrous].some((v) => k.startsWith(v + '.')));
  function construire() {
    const scene = new THREE.Scene(); scene.name = 'plateau photométrie'; scene.background = new THREE.Color(num(T.panel));
    scene.add(sol(16, 17, 0, 1.5), cyclo(16, 6, 8.5), caisse(-5.6, 5.5, 0.4), plante(-4.6, 6.3, 3), plante(5.2, 5.8, 7), caisse(5.5, -2, -0.3), lumieresTravail(1));
    // un peu de lumière parasite, vue par l'image de la caméra : le plateau n'est jamais tout à fait noir
    const parasite = new THREE.HemisphereLight(0xd4dbe6, 0x4a5058, 6); parasite.name = 'lumière parasite'; scene.add(parasite);
    const sujet = personnage(0x6f7682); sujet.name = 'sujet'; sujet.add(luxmetre()); scene.add(sujet);
    const rig = camera3d(); scene.add(rig);
    const etq = /** @type {Record<string, any>} */ ({ cam: etiquetteNom(rig, 'Caméra', '', [0, 2.35, 0]), sujet: etiquetteNom(sujet, 'Luxmètre', 'amber', [0, 2.1, 0]) });
    /** les projecteurs, par poste et par modèle (construits à la demande) */
    const projs = { p1: {}, p2: {} };
    const lignes = { p1: ligne(num(T.fg), 0.35), p2: ligne(num(T.fg), 0.35) };
    scene.add(lignes.p1, lignes.p2);
    const glissables = [rig];
    const prendre = (p) => ({
      nom: NOMS[p], cles: [p + '.d', p + '.phi'],
      bouger: (x, z) => { const l = lecturePhoto(ctx.st.cam, x, z, SUJET); ctx.changer({ [p + '.d']: r2(borne(l.d, LIM.proj)), [p + '.phi']: Math.round(borne(l.phi, LIM.phi)) }); },
      fin: () => { const m = ctx.m(); ctx.dire(`${NOMS[p]} à ${fr(ctx.st[p].d, 2)} m : ${lx(p === 'p1' ? m.e1 : m.e2)} au sujet.`); },
    });
    const projecteurDe = (p, type) => {
      if (!projs[p][type]) { const g = projecteur(type); g.name = `${NOMS[p]} (${type})`; g.userData.glisser = prendre(p); scene.add(g); projs[p][type] = g; glissables.push(g); etq[p + type] = etiquetteNom(g, NOMS[p], '', [0, 2.35, 0]); if (!A.etiquettes.includes(etq[p + type])) A.etiquettes.push(etq[p + type]); }
      return projs[p][type];
    };
    // les projecteurs restent où ils sont pendant qu'on déplace la caméra : leur place est notée quand on la prend,
    // distance et angle se relisent depuis la nouvelle place de la caméra (sans dérive d'arrondi)
    const monde = { p1: { x: 0, z: 0 }, p2: { x: 0, z: 0 } };
    rig.userData.glisser = {
      nom: 'La caméra', cles: ['cam.x', 'cam.z'],
      debut: () => { const st = ctx.st; for (const p of ['p1', 'p2']) monde[p] = mondePhoto(st.cam, st[p].d, st[p].phi, SUJET); },
      bouger: (x, z) => {
        const d = Math.hypot(x, z); if (d < 1.5) { x *= 1.5 / d; z *= 1.5 / d; }
        x = borne(x, /** @type {[number, number]} */ ([-7.5, 7.5])); z = borne(z, /** @type {[number, number]} */ ([-6.5, 7]));
        const patch = /** @type {Record<string, number>} */ ({ 'cam.x': r2(x), 'cam.z': r2(z) });
        for (const p of ['p1', 'p2']) { const l = lecturePhoto({ x, z }, monde[p].x, monde[p].z, SUJET); patch[p + '.d'] = r2(borne(l.d, LIM.proj)); patch[p + '.phi'] = Math.round(borne(l.phi, LIM.phi)); }
        ctx.changer(patch);
      },
      fin: () => ctx.dire('Caméra posée.'),
    };
    const oeil = new THREE.Vector3(), dir = new THREE.Vector3();
    const A = /** @type {import('../plateau/scene.js').Adaptateur} */ ({
      scene, glissables, etiquettes: Object.values(etq), verrou, dire: ctx.dire,
      cadre: () => { const st = ctx.st; const pts = [[st.cam.x - 1.2, 0, st.cam.z - 1.2], [st.cam.x + 1.2, 2.2, st.cam.z + 0.6], [-1, 0, -1], [1, 2.2, 1]]; for (const p of ['p1', 'p2']) { const w = mondePhoto(st.cam, st[p].d, st[p].phi, SUJET); pts.push([w.x - 0.8, 0, w.z - 0.8], [w.x + 0.8, 2.6, w.z + 0.8]); } return pts; },
      image: () => {
        const { st, m } = SC.last;
        oeil.copy(rig.userData.oeil); rig.localToWorld(oeil); dir.copy(FACE).sub(oeil); const s = dir.length(); dir.normalize();
        return { position: oeil, direction: dir, f: 35, hCap: CAPTEURS.s35.h, N: st.cam.N, s, expo: expositionImage(m.Eref), wb: balanceBlancs(kelvinRGBNorm(st.cam.Tcam)), zebra: true, dof: true, legende: `f/${fr(st.cam.N, st.cam.N < 3 && !Number.isInteger(st.cam.N) ? 1 : 0)} · ${st.cam.iso} ISO · 1/50 s · ${fr(st.cam.Tcam, 0)} K` };
      },
      exposition: () => { const m = SC.last ? SC.last.m : null; return expositionPlateau(m ? Math.max(m.e1, m.e2) : 0); },
    });
    SC = { scene, sujet, rig, projs, lignes, etq, A, projecteurDe, last: null };
  }
  /** pose la caméra, le sujet, les projecteurs et leurs lignes depuis l'état ; règle les lumières du rendu */
  function placer(m, st) {
    const { sujet, rig, projs, lignes, etq, projecteurDe } = SC;
    rig.position.set(st.cam.x, 0, st.cam.z); rig.rotation.y = capVers(st.cam, SUJET);
    sujet.rotation.y = capVers(SUJET, st.cam);
    etq.cam.set(`f/${fr(st.cam.N, st.cam.N < 3 && !Number.isInteger(st.cam.N) ? 1 : 0)} · ${st.cam.iso} ISO · ${fr(st.cam.Tcam, 0)} K`);
    etq.sujet.set(lx(m.E), 'amber' + (Number.isFinite(m.expo) && Math.abs(m.expo) <= 1 / 3 ? ' ok' : ''));
    for (const p of ['p1', 'p2']) {
      const S = st[p], r = p === 'p1' ? m.r1 : m.r2, type = SOURCES[S.source] ? S.source : 'fresnel';
      const g = projecteurDe(p, type);
      for (const [t, o] of Object.entries(projs[p])) /** @type {THREE.Object3D} */ (o).visible = t === type;
      const w = mondePhoto(st.cam, S.d, S.phi, SUJET);
      g.position.set(w.x, 0, w.z);
      const cap = capVers(w, SUJET); const tete = g.userData.tete;
      tete.rotation.set(Math.atan2(tete.position.y - FACE.y, S.d), cap + Math.sign(S.phi || 1) * S.alpha * Math.PI / 180, 0, 'YXZ');
      const sp = spotDepuis(r);
      g.userData.regler({ on: S.on, couleur: couleurLumiere(kelvinRGBNorm(r.T > 0 ? r.T : 5600)), intensite: sp.intensite, angle: sp.angle, penombre: sp.penombre, longueur: S.d + 1.4, niveau: S.niveau });
      const L = lignes[p]; L.visible = !!S.on; L.position.set(w.x, 0, w.z); L.rotation.y = cap; L.userData.maj(S.d);
      for (const [t, e] of Object.entries(etq)) if (t === p + type) e.set(S.on ? `${lx(p === 'p1' ? m.e1 : m.e2)} · ${fr(S.d, 2)} m` : 'éteint', S.on ? '' : 'dim');
    }
  }

  function rendre() {
    const m = ctx.m(), st = ctx.st;
    C.refresh();
    // les commandes qui ne servent pas : la couleur pour les sources à température fixe, le débouchage éteint
    for (const p of ['p1', 'p2']) {
      const led = SOURCES[st[p].source] && SOURCES[st[p].source].type === 'led';
      const tl = /** @type {HTMLElement | null} */ (ctrls.querySelector(`[data-k="${p}.Tled"]`)); if (tl && tl.closest('.lb-ctl')) /** @type {HTMLElement} */ (tl.closest('.lb-ctl')).hidden = !led;
      const fa = /** @type {HTMLElement | null} */ (ctrls.querySelector(`[data-k="${p}.angle"]`)); if (fa && fa.closest('.lb-ctl')) /** @type {HTMLElement} */ (fa.closest('.lb-ctl')).hidden = led;
    }
    const lit = (r, p) => (p.on ? `${lx(r.E)}` : 'éteint');
    r1.set(lit(m.r1, st.p1), st.p1.on ? `${fr(m.r1.I0, 0)} cd dans l'axe, faisceau ${fr(m.r1.theta, 0)}° (${fr(m.r1.diametre, 1)} m de large au sujet)` : '');
    r2a.set(lit(m.r2, st.p2), st.p2.on ? `${fr(m.r2.I0, 0)} cd dans l'axe, faisceau ${fr(m.r2.theta, 0)}°` : '');
    rE.set(lx(m.E), `il faut ${lx(m.Eref)} pour f/${fr(st.cam.N, st.cam.N < 3 && !Number.isInteger(st.cam.N) ? 1 : 0)}, ${st.cam.iso} ISO, 1/50 s`);
    const dom = Math.round(m.dom);
    rT.set(m.T > 0 ? `${fr(Math.round(m.T / 10) * 10, 0)} K` : '—', m.T > 0 ? `${dom > 0 ? '+' : ''}${dom} mireds par rapport à la caméra : ${Math.abs(dom) <= 20 ? 'neutre' : dom > 0 ? 'tire vers l\'orange' : 'tire vers le bleu'}` : '', m.T > 0 ? (Math.abs(dom) <= 20 ? 'ok' : 'warn') : '');
    rX.set(Number.isFinite(m.expo) ? `${m.expo > 0 ? '+' : ''}${fr(m.expo, 2)} diaph` : '—', Number.isFinite(m.expo) ? (Math.abs(m.expo) <= 1 / 3 ? 'exposé juste' : m.expo > 0 ? 'surexposé' : 'sous-exposé') : 'pas de lumière', Number.isFinite(m.expo) && Math.abs(m.expo) <= 1 / 3 ? 'ok' : 'warn');
    rR.set(st.p1.on && st.p2.on && m.e2 > 0 ? `${fr(m.ratio, 2)}:1` : '—', st.p1.on && st.p2.on && m.e2 > 0 ? `${fr(m.ratioDiaphs, 2)} diaph entre côté éclairé et côté ombre` : 'allumez les deux projecteurs');
    if (!P.ok) { P.monter(stage, null); return; }
    if (!SC) construire();
    SC.last = { m, st };
    placer(m, st);
    P.monter(stage, SC.A); P.demander();
  }
  const root = el('div', { class: 'lb-atelier lb-3d lb-photometrie' },
    stage,
    el('div', { class: 'lb-reads' }, rE.box, r1.box, r2a.box, rT.box, rX.box, rR.box),
    el('p', { class: 'lb-note' }, 'Prenez un projecteur ou la caméra et posez-les où vous voulez : la distance et l\'angle se relisent de leur place, la flaque de lumière suit. Dans le coin, l\'image de la caméra, exposée et balancée comme elle est réglée (hachures : au-dessus de 90 %).'),
    ctrls);
  return { root, rendre };
}
