// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { commandes, afficheur, jetons, fr } from '../kit.js';
import { CAPTEURS, IRIS, FOCALE, distTxt } from '../calc/optique.js';
import { plateau, etiquette, etiquetteNom } from '../plateau/scene.js';
import { creerVisite } from '../plateau/visite.js';
import { ETAPES_OPTIQUE } from '../plateau/notions.js';
import { sol, cyclo, lampes, caisse, plante, lumieresTravail, personnage, pancarte, camera3d, coin, dalle, trait, ligne, COUL } from '../plateau/pieces.js';
import { mondeOptique, lectureOptique, borne, LIM, expositionImage, expositionPlateau, LUX_TRAVAIL, capVers } from '../plateau/calc.js';

// ----------------------------------------------------------------------------------
// L'atelier « Optique et profondeur de champ » sur le plateau 3D (v19.30) : une caméra sur pied et trois
// sujets (A, B, C) qu'on prend et qu'on pose où l'on veut sur un plateau vu en isométrie, un cyclo au fond
// (à 30 m de la place de départ de la caméra) et ses lampes. Au sol, devant la caméra : le champ (le coin
// bleu), la zone nette (la dalle verte, de la limite proche à la limite lointaine), le point (le trait bleu),
// l'hyperfocale (le trait violet) ; chaque sujet dit sa distance, net ou flou, hors champ. Dans le coin,
// l'image de la caméra, rendue pour de vrai : chaque plan flouté selon sa propre tache (plateau/dof.js), les
// lampes du fond en disques. Les commandes : le capteur, la focale, l'iris, le point, les distances des
// sujets (un sujet déplacé à la main les met à jour). Tout vient de labo/calc/optique.js ; l'état porte la
// place de la caméra (cam) et l'écart latéral des sujets (lat), labo/etats.js.
// ----------------------------------------------------------------------------------
const FOND = 30;
/** les sujets : leur lettre (ils sont blancs, comme le décor : la pancarte les nomme) */
const SUJETS = [{ k: 'A' }, { k: 'B' }, { k: 'C' }];
const num = (hex) => parseInt(String(hex).replace('#', ''), 16);
const r2 = (v) => Math.round(v * 100) / 100;

export function creer(/** @type {import('../kit.js').Ctx} */ ctx) {
  const T = jetons();
  const C = commandes(ctx);
  const P = plateau();
  const stage = el('div', { class: 'lb-plateau' });
  const rH = afficheur('Hyperfocale'), rZone = afficheur('Zone nette'), rAngle = afficheur('Angle de champ'), rChamp = afficheur('Champ à B');
  const rTaches = el('ul', { class: 'lb-taches', 'aria-live': 'polite' });
  const ctrls = el('div', { class: 'lb-ctls' },
    C.touches('capteur', 'Capteur', Object.values(CAPTEURS).map((K) => [K.id, K.id === '2/3' ? '2/3"' : K.id === 's35' ? 'Super 35' : 'Plein format', K.nom])),
    C.curseur('f', 'Focale', { min: FOCALE.min, max: FOCALE.max, log: true, step: 0.5, fmt: (v) => fr(v, v < 20 ? 1 : 0), unite: 'mm' }),
    C.touches('N', 'Iris', IRIS.map((n) => [n, 'f/' + fr(n, n < 10 && !Number.isInteger(n) ? 1 : 0)])),
    C.curseur('s', 'Point', { min: 0.3, max: 60, log: true, step: 0.01, fmt: (v) => distTxt(v) }),
    ...SUJETS.map((S) => C.curseur('sujets.' + S.k, `Sujet ${S.k}`, { min: 0.5, max: 25, log: true, step: 0.05, fmt: (v) => distTxt(v) })));

  /** @type {any} */ let SC = null;
  /** la scène, construite à la première demande */
  function construire() {
    const scene = new THREE.Scene(); scene.name = 'plateau optique'; scene.background = null;
    scene.add(sol(20, 38, 0, 14), cyclo(20, 9, FOND), lampes(13, 18, 3.6, FOND), caisse(-7.4, 3, 0.3), caisse(-7.3, 3.9, 0.1), plante(8.6, 15, 2), plante(-8.4, 26, 5), caisse(7.3, 12, -0.2), lumieresTravail(0));
    const rig = camera3d(); scene.add(rig);
    const champ = coin(COUL.repere, 0.035), zone = dalle(num(T.accent), 0.2), point = trait(num(T.accent)), hyper = trait(COUL.repere, 0.04), axe = ligne(COUL.repere, 0.5);
    const anc = { point: new THREE.Object3D(), hyper: new THREE.Object3D(), inf: new THREE.Object3D() };
    rig.add(champ, zone, point, hyper, axe, anc.point, anc.hyper, anc.inf);
    const verrou = (cles) => cles.some((k) => ctx.verrous.has(k) || [...ctx.verrous].some((v) => k.startsWith(v + '.')));
    const sujets = /** @type {Record<string, THREE.Group>} */ ({});
    const etq = /** @type {Record<string, any>} */ ({
      cam: etiquetteNom(rig, 'Caméra', '', [0, 2.35, 0]),
      point: etiquetteNom(anc.point, 'Point', 'accent'), hyper: etiquetteNom(anc.hyper, 'Hyperfocale'), inf: etiquette(anc.inf, 'Net jusqu\'à l\'infini', 'ok'),
    });
    for (const S of SUJETS) {
      const g = personnage(COUL.sujet); g.name = 'sujet ' + S.k; g.add(pancarte(S.k, '', T.font));
      g.userData.glisser = {
        nom: 'Sujet ' + S.k, cles: ['sujets.' + S.k, 'lat.' + S.k],
        bouger: (x, z) => { const l = lectureOptique(ctx.st.cam, x, z); ctx.changer({ ['sujets.' + S.k]: r2(borne(l.d, LIM.sujet)), ['lat.' + S.k]: r2(borne(l.lat, LIM.lat)) }); },
        fin: () => { const x = ctx.m().sujets[S.k]; ctx.dire(`Sujet ${S.k} à ${distTxt(x.d)} : ${x.net ? 'net' : 'flou'}${x.dansChamp ? '' : ', hors champ'}.`); },
      };
      scene.add(g); sujets[S.k] = g;
      etq[S.k] = etiquetteNom(g, S.k, '', [0, 2.1, 0]);
    }
    // les sujets restent où ils sont pendant qu'on déplace la caméra : leur place est notée quand on la prend,
    // leurs distances et leurs écarts se relisent depuis la nouvelle place (sans dérive d'arrondi)
    let monde = /** @type {{ x: number, z: number }[]} */ ([]);
    rig.userData.glisser = {
      nom: 'La caméra', cles: ['cam.x', 'cam.z'],
      debut: () => { const st = ctx.st; monde = SUJETS.map((S) => mondeOptique(st.cam, st.sujets[S.k], st.lat[S.k])); },
      bouger: (x, z) => {
        x = borne(x, LIM.camX); z = Math.max(-3, Math.min(z, Math.min(...monde.map((p) => p.z)) - LIM.sujet[0], FOND - 2));
        const patch = /** @type {Record<string, number>} */ ({ 'cam.x': r2(x), 'cam.z': r2(z) });
        SUJETS.forEach((S, i) => { const l = lectureOptique({ x, z }, monde[i].x, monde[i].z); patch['sujets.' + S.k] = r2(borne(l.d, LIM.sujet)); patch['lat.' + S.k] = r2(borne(l.lat, LIM.lat)); });
        ctx.changer(patch);
      },
      fin: () => ctx.dire(`Caméra posée ; sujet B à ${distTxt(ctx.st.sujets.B)}.`),
    };
    // les pancartes se redessinent quand la police de l'interface est là
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const S of SUJETS) { const g = sujets[S.k]; const old = g.children.find((c) => c.name.startsWith('pancarte')); if (old) { g.remove(old); /** @type {any} */ (old).material.map.dispose(); /** @type {any} */ (old).material.dispose(); } g.add(pancarte(S.k, '', T.font)); } P.demander(); }).catch(() => {});
    const oeil = new THREE.Vector3(), dir = new THREE.Vector3(0, 0, 1);
    const A = /** @type {import('../plateau/scene.js').Adaptateur} */ ({
      scene, glissables: [rig, ...Object.values(sujets)], etiquettes: Object.values(etq), verrou, dire: ctx.dire,
      cadre: () => { const st = ctx.st; const pts = [[st.cam.x - 1.2, 0, st.cam.z - 1.2], [st.cam.x + 1.2, 2.2, st.cam.z + 0.6]]; for (const S of SUJETS) { const p = mondeOptique(st.cam, st.sujets[S.k], st.lat[S.k]); pts.push([p.x - 0.8, 0, p.z - 0.8], [p.x + 0.8, 2.3, p.z + 0.8]); } return pts; },
      image: () => {
        const { st, m } = SC.last;
        oeil.copy(rig.userData.oeil); rig.localToWorld(oeil); dir.set(0, 0, 1).applyQuaternion(rig.quaternion);
        return { position: oeil, direction: dir, f: st.f, hCap: m.K.h, N: st.N, s: st.s, expo: expositionImage(LUX_TRAVAIL), wb: [1, 1, 1], zebra: false, dof: true, ciel: COUL.ciel, legende: `${fr(st.f, st.f < 20 ? 1 : 0)} mm · f/${fr(st.N, st.N < 10 && !Number.isInteger(st.N) ? 1 : 0)} · point à ${distTxt(st.s)}` };
      },
      exposition: () => expositionPlateau(0),
    });
    SC = { scene, rig, sujets, champ, zone, point, hyper, axe, anc, etq, A, last: null, visite: null };
    const visite = creerVisite(P, ctx, ETAPES_OPTIQUE, () => ({ scene, A, S: SC }));
    A.outils = [visite.bouton]; A.panneau = visite.carte; SC.visite = visite;
  }

  /** pose les objets et les repères depuis l'état, écrit les étiquettes */
  function placer(m, st) {
    const { rig, sujets, anc, etq } = SC;
    rig.position.set(st.cam.x, 0, st.cam.z);
    for (const S of SUJETS) {
      const g = sujets[S.k], p = mondeOptique(st.cam, st.sujets[S.k], st.lat[S.k]); const x = m.sujets[S.k];
      g.position.set(p.x, 0, p.z); g.rotation.y = capVers(p, st.cam);
      etq[S.k].set(`${distTxt(x.d)} · ${x.net ? 'net' : 'flou'}${x.dansChamp ? '' : ' · hors champ'}`, x.net ? 'ok' : '');
    }
    const max = Math.max(12, Math.min(FOND - st.cam.z, Math.max(st.sujets.A, st.sujets.B, st.sujets.C, st.s) * 1.25));
    const ta = Math.tan(m.angle * Math.PI / 360);
    SC.champ.userData.maj(max * ta, max);
    const z0 = Math.min(m.proche, max), z1 = Math.min(isFinite(m.loin) ? m.loin : max, max);
    SC.zone.userData.maj(z0, z0 * ta, z1, z1 * ta);
    SC.point.visible = st.s <= max; SC.point.userData.maj(st.s, st.s * ta + 0.3);
    SC.hyper.visible = m.H < max; SC.hyper.userData.maj(m.H, m.H * ta + 0.3);
    SC.axe.userData.maj(max);
    anc.point.position.set(st.s * ta + 0.5, 0, st.s); anc.hyper.position.set(m.H * ta + 0.5, 0, m.H); anc.inf.position.set(0, 0, max + 0.6);
    etq.cam.set(`${fr(st.f, st.f < 20 ? 1 : 0)} mm · f/${fr(st.N, st.N < 10 && !Number.isInteger(st.N) ? 1 : 0)}`);
    etq.point.set(distTxt(st.s)); etq.point.on = st.s <= max;
    etq.hyper.set(distTxt(m.H)); etq.hyper.on = m.H < max;
    etq.inf.on = !isFinite(m.loin);
  }

  function rendre() {
    const m = ctx.m(), st = ctx.st;
    C.refresh();
    rH.set(distTxt(m.H), `au point H, net de ${distTxt(m.H / 2)} à l'infini`);
    rZone.set(`${distTxt(m.proche)} → ${distTxt(m.loin)}`, isFinite(m.loin) ? `${fr((m.loin - m.proche) * 100, 0)} cm de profondeur` : 'jusqu\'à l\'infini');
    rAngle.set(`${fr(m.angle, 1)}°`, `cercle de confusion ${fr(m.K.c, 3)} mm`);
    const cb = m.sujets.B.champ; rChamp.set(`${fr(cb.w, 2)} × ${fr(cb.h, 2)} m`, `à ${distTxt(st.sujets.B)}`);
    rTaches.replaceChildren(...SUJETS.map((S) => { const x = m.sujets[S.k]; return el('li', { class: x.net ? 'ok' : '' }, el('b', {}, S.k), ` ${distTxt(x.d)} : tache ${fr(x.tache, 3)} mm, ${x.net ? 'net' : `flou (${fr(x.tache / m.K.c, 1)} fois le cercle)`}${x.dansChamp ? '' : ' · hors champ'}`); }));
    if (!P.ok) { P.monter(stage, null); return; }
    if (!SC) construire();
    SC.last = { m, st };
    placer(m, st);
    P.monter(stage, SC.A); P.demander();
  }
  const root = el('div', { class: 'lb-atelier lb-3d lb-optique' },
    stage,
    el('div', { class: 'lb-reads' }, rZone.box, rH.box, rAngle.box, rChamp.box),
    rTaches,
    el('p', { class: 'lb-note' }, 'Prenez un sujet ou la caméra et posez-les où vous voulez : au sol, le champ, la zone nette (en bleu), le point et l\'hyperfocale ; dans le coin, l\'image de la caméra.'),
    ctrls);
  return { root, rendre, etapes: ETAPES_OPTIQUE, visite: (k = 0) => { if (!SC) rendre(); if (SC && SC.visite) SC.visite.ouvrir(k); } };
}
