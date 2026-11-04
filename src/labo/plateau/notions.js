// @ts-check
import * as THREE from 'three';
import { kelvinRGBNorm } from '../../util.js';
import { fr } from '../kit.js';
import { IRIS, CAPTEURS, distTxt } from '../calc/optique.js';
import { SOURCES, H_CELLULE, FOND, luminance } from '../calc/photometrie.js';
import { familleById } from '../calc/lumiere.js';
import { mondePhoto, mondeOptique, azimutDeCote, azimutDuCote, couleurLumiere } from './calc.js';
import { balayage, cycle, ensemble, particules, carre, pinceau } from './visite.js';

// ----------------------------------------------------------------------------------
// Les notions expliquées sur le plateau (v19.30), une liste par atelier (plateau/visite.js les joue) :
// chaque étape dit où regarder (la vue vole), ce qui se règle, ce qui s'anime et ce qu'on lit en direct.
// Photométrie, dans l'ordre des grandeurs : le flux (lumens), l'intensité (candelas), l'éclairement (lux),
// l'inverse du carré, le cosinus de l'incidence, la luminance (candelas par mètre carré), la couleur
// (kelvins, mireds), du luxmètre au diaphragme, le rapport de contraste. Optique : la focale et le champ,
// l'iris et la zone nette, le point, l'hyperfocale, le capteur et le cercle de confusion. Les chiffres
// viennent des mesures de l'atelier (labo/etats.js) : rien n'est écrit à la main.
// ----------------------------------------------------------------------------------
const lx = (v) => `${fr(Math.round(v), 0)} lx`;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
/** la tête du projecteur visible d'un poste (p1, p2) dans la scène de l'atelier */
const tete = (S, p) => { const g = Object.values(S.projs[p] || {}).find((x) => /** @type {any} */ (x).visible); return g ? /** @type {any} */ (g).userData.tete : null; };
/** la direction de visée de cette tête (monde), son point de sortie */
const faisceau = (S, p) => { const t = tete(S, p); if (!t) return null; const o = t.localToWorld(V3(0, 0, 0.28)), d = t.getWorldDirection(V3(0, 0, 0)); return { o, d }; };
const couleurDe = (m, p) => couleurLumiere(kelvinRGBNorm((p === 'p1' ? m.r1 : m.r2).T > 0 ? (p === 'p1' ? m.r1 : m.r2).T : 5600));
/** l'azimut qui regarde le faisceau de la principale de côté */
const azFaisceau = (st) => { const w = mondePhoto(st.cam, st.p1.d, st.p1.phi); return azimutDeCote(Math.atan2(-w.x, -w.z)); };
/** l'azimut qui regarde le sujet depuis le côté de la caméra */
const azCamera = (st) => azimutDuCote(Math.atan2(st.cam.x, st.cam.z));
const cellule = () => V3(0, H_CELLULE, 0);

/** @type {import('./visite.js').Etape[]} */
export const ETAPES_PHOTO = [
  {
    id: 'flux', titre: 'Le flux lumineux : les lumens', lecon: 'lumiere-grandeurs',
    texte: 'Tout ce que la source envoie, dans toutes les directions de son faisceau, se compte en **lumens** (lm). Le flux ne dépend ni de la distance ni de la direction : c\'est la quantité de lumière de la source.\n\nOrdre de grandeur : la puissance électrique multipliée par l\'efficacité de la famille, environ 20 lm/W pour un halogène, 60 à 130 lm/W pour une LED.',
    scene: { 'p1.on': true, 'p1.niveau': 1 },
    vue: (st) => { const w = mondePhoto(st.cam, st.p1.d, st.p1.phi); return { cible: [w.x, st.p1.h, w.z], demi: 1.7, az: azFaisceau(st) }; },
    lire: (st, m) => { const S = SOURCES[st.p1.source] || SOURCES.fresnel, F = familleById(S.type); return `Φ ≈ ${fr(m.r1.flux, 0)} lm : ${fr(S.watts, 0)} W × ${fr((F.efficacite[0] + F.efficacite[1]) / 2, 0)} lm/W`; },
    anim: ({ ctx, scene, A, S }) => {
      const pa = particules(scene, 220, 0xfff2d8, 0.028);
      return { update(dt) { const f = faisceau(S, 'p1'); const m = ctx.m(); if (f) { pa.emettre(f.o, f.d, Math.max(0.1, m.r1.theta * 0.91 * Math.PI / 180), 2.6, 1.3); pa.couleur(couleurDe(m, 'p1')); } pa.update(dt); }, dispose() { pa.dispose(); void A; } };
    },
  },
  {
    id: 'intensite', titre: 'L\'intensité : les candelas', lecon: 'lumiere-grandeurs',
    texte: 'Dans **une direction**, la lumière se compte en **candelas** (cd) : des lumens par stéradian, l\'unité d\'angle solide (un cône de directions).\n\nSerrer le faisceau ne crée pas de lumière : il la concentre, et l\'intensité dans l\'axe monte. L\'angle de faisceau est celui où elle tombe à la moitié de l\'axe ; l\'angle de champ, à 10 %, en vaut 1,8 fois. Regardez le cône se resserrer et l\'intensité grimper.',
    scene: { 'p1.on': true, 'p1.source': 'fresnel', 'p1.niveau': 1, 'p1.gel': 'aucune' },
    vue: (st) => { const w = mondePhoto(st.cam, st.p1.d, st.p1.phi); return { cible: [w.x / 2, 1.2, w.z / 2], demi: Math.max(2.5, st.p1.d * 0.55), az: azFaisceau(st) }; },
    lire: (st, m) => `faisceau ${fr(m.r1.theta, 0)}° : I = ${fr(m.r1.I0, 0)} cd dans l'axe · angle solide ${fr(m.r1.omega, 2)} sr · champ ${fr(m.r1.champ, 0)}°`,
    anim: ({ ctx, scene, S }) => {
      const pa = particules(scene, 200, 0xfff2d8, 0.026);
      return ensemble(balayage(ctx, 'p1.angle', 60, 12, 7, { step: 1 }), { update(dt) { const f = faisceau(S, 'p1'); const m = ctx.m(); if (f) { pa.emettre(f.o, f.d, Math.max(0.06, m.r1.theta * 0.5 * Math.PI / 180), 3, 1.4); pa.couleur(couleurDe(m, 'p1')); } pa.update(dt); }, dispose() { pa.dispose(); } });
    },
  },
  {
    id: 'eclairement', titre: 'L\'éclairement : les lux', lecon: 'lumiere-grandeurs',
    texte: 'Ce qui **arrive** sur une surface se compte en **lux** (lx) : des lumens par mètre carré. C\'est ce que lit le luxmètre, sa cellule tournée vers la caméra.\n\nUn mètre carré posé au sujet, face au projecteur, reçoit E lumens : E = I ÷ d² quand la lumière arrive de face (ici presque : à 12° près, pour laisser l\'objectif libre). Le carré est là ; la lumière y tombe.',
    scene: { 'p1.on': true, 'p1.phi': 12, 'p1.alpha': 0, 'p1.h': H_CELLULE, 'p2.on': false },
    vue: (st) => ({ cible: [0, H_CELLULE, 0], demi: 2.2, az: azFaisceau(st) }),
    lire: (st, m) => `E = ${fr(m.r1.I, 0)} cd × cos ${fr(m.r1.incidence, 0)}° ÷ ${fr(m.r1.d3, 2)}² = ${lx(m.r1.E)} : le mètre carré reçoit ${fr(Math.round(m.r1.E), 0)} lm`,
    anim: ({ ctx, scene, A, S }) => {
      const c = carre(scene, A, 1, 0x3b9cff, '1 m²'), pa = particules(scene, 180, 0xfff2d8, 0.026);
      return { update(dt) { const f = faisceau(S, 'p1'); const m = ctx.m(); if (f) { const n = f.o.clone().sub(cellule()).normalize(); c.poser(cellule(), n); c.texte(`1 m² : ${lx(m.r1.E)}`); pa.emettre(f.o, f.d, 0.18, 3.2, Math.max(0.6, m.r1.d3 / 3.2)); pa.couleur(couleurDe(m, 'p1')); } pa.update(dt); }, dispose() { c.dispose(); pa.dispose(); } };
    },
  },
  {
    id: 'inverse', titre: 'La distance : l\'inverse du carré', lecon: 'lumiere-distance',
    texte: 'Deux fois plus loin, le même cône de lumière couvre une surface **quatre fois plus grande** : chaque mètre carré en reçoit quatre fois moins. L\'éclairement suit 1 ÷ d².\n\nLe carré de 1 m au sujet et le carré de 2 m deux fois plus loin reçoivent le même flux. C\'est pour cela qu\'un pied qui avance ou recule change tant la lumière : regardez le luxmètre pendant que le projecteur va et vient.',
    scene: { 'p1.on': true, 'p1.phi': 12, 'p1.alpha': 0, 'p1.h': H_CELLULE, 'p2.on': false },
    vue: (st) => { const w = mondePhoto(st.cam, 5, 12); return { cible: [w.x / 2, 1.2, w.z / 2 + 1], demi: 4.2, az: azFaisceau(st) }; },
    lire: (st, m) => `à ${fr(m.r1.d3, 2)} m : ${lx(m.r1.E)} · à ${fr(2 * m.r1.d3, 2)} m : ${lx(m.r1.E / 4)}`,
    anim: ({ ctx, scene, A, S }) => {
      const c1 = carre(scene, A, 1, 0x3b9cff, '1 m²'), c2 = carre(scene, A, 2, 0x3b9cff, '4 m²'), pi = pinceau(scene, 0x3b9cff);
      return ensemble(balayage(ctx, 'p1.d', 2.5, 7, 10, { step: 0.05 }), { update() {
        const f = faisceau(S, 'p1'); const m = ctx.m(); if (!f) return;
        const n = f.o.clone().sub(cellule()).normalize(); c1.poser(cellule(), n); c1.texte(`1 m² : ${lx(m.r1.E)}`);
        const loin = f.o.clone().addScaledVector(n, -2 * m.r1.d3); c2.poser(loin, n); c2.texte(`4 m² : ${lx(m.r1.E / 4)}`);
        pi.maj(f.o, c2.coins());
      }, dispose() { c1.dispose(); c2.dispose(); pi.dispose(); } });
    },
  },
  {
    id: 'cosinus', titre: 'L\'incidence : la loi du cosinus', lecon: 'lumiere-distance',
    texte: 'Une surface **inclinée** par rapport à la lumière en reçoit moins : la même lumière s\'étale sur plus de surface. E = I × cos i ÷ d².\n\nLa cellule reste tournée vers la caméra ; le projecteur tourne autour du sujet. À 60° de côté, elle ne reçoit plus que la moitié. En hauteur, l\'élévation s\'ajoute : cos i = cos ε × cos φ.',
    scene: { 'p1.on': true, 'p1.alpha': 0, 'p1.h': H_CELLULE, 'p1.d': 3, 'p2.on': false },
    vue: (st) => ({ cible: [0, H_CELLULE, 0], demi: 3, az: azCamera(st) }),
    lire: (st, m) => `incidence ${fr(m.r1.incidence, 0)}° : cos = ${fr(Math.cos(m.r1.incidence * Math.PI / 180), 2)} → ${lx(m.r1.E)} (de face : ${lx(m.r1.E / Math.max(0.01, Math.cos(m.r1.incidence * Math.PI / 180)))})`,
    anim: ({ ctx, scene, A, S }) => {
      const c = carre(scene, A, 1, 0x3b9cff, 'la cellule'), pa = particules(scene, 160, 0xfff2d8, 0.026);
      return ensemble(balayage(ctx, 'p1.phi', 0, 70, 8, { step: 1 }), { update(dt) {
        const f = faisceau(S, 'p1'); const m = ctx.m(); const st = ctx.st;
        const n = V3(st.cam.x, 0, st.cam.z).normalize(); c.poser(cellule(), n); c.texte(`cellule : ${lx(m.E)} (cos ${fr(m.r1.incidence, 0)}°)`);
        if (f) { pa.emettre(f.o, f.d, 0.16, 3.2, Math.max(0.6, m.r1.d3 / 3.2)); pa.couleur(couleurDe(m, 'p1')); } pa.update(dt);
      }, dispose() { c.dispose(); pa.dispose(); } });
    },
  },
  {
    id: 'luminance', titre: 'La luminance : les candelas par mètre carré', lecon: 'lumiere-grandeurs',
    texte: 'Ce que la surface **renvoie** vers l\'œil ou la caméra se compte en **candelas par mètre carré** (cd/m²). Pour une surface mate de facteur de réflexion ρ : L = ρ × E ÷ π.\n\nC\'est la seule grandeur que la caméra voit : un gris 18 % sous 1 000 lx renvoie 57 cd/m², un fond blanc quatre fois plus. L\'image de la caméra, dans le coin, en est faite.',
    scene: { 'p1.on': true },
    vue: (st) => ({ cible: [0, H_CELLULE + 0.1, 0], demi: 1.8, az: azCamera(st) }),
    lire: (st, m) => `gris 18 % : ${fr(m.L18, m.L18 < 10 ? 1 : 0)} cd/m² · blanc (ρ 0,8) : ${fr(luminance(m.E, 0.8), 0)} cd/m² · noir (ρ 0,04) : ${fr(luminance(m.E, 0.04), 1)} cd/m²`,
    anim: ({ ctx, scene }) => {
      const pa = particules(scene, 140, 0xffffff, 0.022);
      return { update(dt) { const st = ctx.st; const d = V3(st.cam.x, 0.2, st.cam.z).normalize(); pa.emettre(cellule().add(d.clone().multiplyScalar(0.25)), d, 1.2, 1.6, 1.2); pa.update(dt); }, dispose() { pa.dispose(); } };
    },
  },
  {
    id: 'couleur', titre: 'La couleur : kelvins et mireds', lecon: 'lumiere-couleur',
    texte: 'Une lumière a une **température de couleur** : 3 200 K, orangée, pour un halogène ; 5 600 K pour le jour et les HMI. La caméra se balance sur l\'une ; l\'autre tire vers l\'orange ou vers le bleu.\n\nLes corrections se comptent en **mireds** (10⁶ ÷ K) : une gélatine décale toujours du même nombre de mireds. Et un halogène gradué rougit : regardez le faisceau pendant que le gradateur descend.',
    scene: { 'p1.on': true, 'p1.source': 'fresnel', 'p1.gel': 'aucune', 'p2.on': false },
    vue: (st) => { const w = mondePhoto(st.cam, st.p1.d, st.p1.phi); return { cible: [w.x / 2, 0.8, w.z / 2], demi: Math.max(2.8, st.p1.d * 0.6), az: azFaisceau(st) }; },
    lire: (st, m) => (m.T > 0 ? `gradateur ${fr(st.p1.niveau * 100, 0)} % : ${fr(Math.round(m.T / 10) * 10, 0)} K = ${fr(1e6 / m.T, 0)} mireds · caméra ${fr(st.cam.Tcam, 0)} K : ${m.dom > 0 ? '+' : ''}${fr(m.dom, 0)} mireds` : 'éteint'),
    anim: ({ ctx }) => balayage(ctx, 'p1.niveau', 1, 0.3, 8, { step: 0.01 }),
  },
  {
    id: 'exposition', titre: 'Du luxmètre au diaphragme', lecon: 'lumiere-mesure',
    texte: 'La cellule plate convertit les lux en diaphragme : **N² ÷ t = E × S ÷ C**, avec C = 250. À 800 ISO et 1/50 s, 1 000 lx exposent juste à f/8 ; chaque diaph fermé demande deux fois plus de lux.\n\nL\'image de la caméra s\'expose avec ce réglage : regardez-la pendant que l\'iris parcourt ses crans.',
    scene: { 'p1.on': true },
    vue: (st) => ({ cible: [st.cam.x / 2, 1.2, st.cam.z / 2], demi: 3.2, az: azCamera(st) }),
    lire: (st, m) => `f/${fr(st.cam.N, st.cam.N < 3 && !Number.isInteger(st.cam.N) ? 1 : 0)}, ${st.cam.iso} ISO, 1/50 s : il faut ${lx(m.Eref)} · on a ${lx(m.E)} → ${Number.isFinite(m.expo) ? `${m.expo > 0 ? '+' : ''}${fr(m.expo, 1)} diaph` : '—'}`,
    anim: ({ ctx }) => cycle(ctx, 'cam.N', [2, 2.8, 4, 5.6, 8, 11], 1.6),
  },
  {
    id: 'contraste', titre: 'Le rapport de contraste', lecon: 'lumiere-plateau',
    texte: 'Deux lumières : la **principale** modèle le visage, le **débouchage** remplit l\'ombre. Le côté éclairé reçoit les deux, le côté ombre le débouchage seul : rapport = (Ep + Ed) ÷ Ed, soit log₂ en diaphs.\n\n2:1 est doux, 4:1 marqué, 8:1 dramatique. Le débouchage monte et descend : regardez l\'ombre dans l\'image.',
    scene: { 'p1.on': true, 'p1.phi': -40, 'p1.d': 4, 'p1.h': H_CELLULE, 'p2.on': true, 'p2.phi': 35, 'p2.d': 2.5, 'p2.h': H_CELLULE },
    vue: (st) => ({ cible: [0, 1.2, -1], demi: 4, az: azCamera(st) }),
    lire: (st, m) => `(${fr(Math.round(m.e1), 0)} + ${fr(Math.round(m.e2), 0)}) ÷ ${fr(Math.round(m.e2), 0)} = ${Number.isFinite(m.ratio) ? fr(m.ratio, 1) + ':1' : '∞'} · ${Number.isFinite(m.ratioDiaphs) ? fr(m.ratioDiaphs, 1) + ' diaph' : ''}`,
    anim: ({ ctx }) => balayage(ctx, 'p2.niveau', 1, 0.08, 8, { step: 0.01 }),
  },
];
void FOND;

const capteurNom = (id) => (id === '2/3' ? '2/3"' : id === 's35' ? 'Super 35' : 'plein format');
/** @type {import('./visite.js').Etape[]} */
export const ETAPES_OPTIQUE = [
  {
    id: 'focale', titre: 'La focale et le champ', lecon: 'camera-systeme',
    texte: 'La **focale** (mm) et la taille du capteur font l\'**angle de champ** : 2 × arctan(largeur du capteur ÷ 2f). Une courte focale embrasse large, une longue serre le cadre.\n\nLe champ couvert à une distance d vaut d × largeur du capteur ÷ f. Regardez le coin au sol s\'ouvrir et se fermer pendant que la focale parcourt sa plage.',
    vue: (st) => ({ cible: [st.cam.x, 0, st.cam.z + 4.5], demi: 5.5 }),
    lire: (st, m) => `${fr(st.f, st.f < 20 ? 1 : 0)} mm sur ${capteurNom(st.capteur)} : ${fr(m.angle, 1)}° · champ ${fr(m.sujets.B.champ.w, 2)} × ${fr(m.sujets.B.champ.h, 2)} m à ${distTxt(st.sujets.B)}`,
    anim: ({ ctx }) => balayage(ctx, 'f', 18, 85, 9, { log: true, step: 0.5 }),
  },
  {
    id: 'iris', titre: 'L\'iris et la zone nette', lecon: 'camera-systeme',
    texte: 'Fermer l\'**iris** (un nombre f plus grand) resserre le cône de rayons qui arrive au capteur : les taches de flou rétrécissent, la **zone nette** (en bleu au sol) s\'étend. Ouvrir fait l\'inverse : le sujet se détache sur un fond flou.\n\nChaque cran d\'iris divise la lumière par deux : la profondeur de champ se paie en lumière.',
    scene: (st) => ({ s: st.sujets.B }),
    vue: (st) => ({ cible: [st.cam.x, 0, st.cam.z + Math.min(8, st.sujets.B * 1.4)], demi: 4.5 }),
    lire: (st, m) => `f/${fr(st.N, st.N < 10 && !Number.isInteger(st.N) ? 1 : 0)} : net de ${distTxt(m.proche)} à ${distTxt(m.loin)}${isFinite(m.loin) ? ` (${fr((m.loin - m.proche) * 100, 0)} cm)` : ''}`,
    anim: ({ ctx }) => cycle(ctx, 'N', IRIS.slice(0, 7), 1.5),
  },
  {
    id: 'point', titre: 'Le point', lecon: 'camera-systeme',
    texte: 'Faire le **point**, c\'est choisir la distance qui sera nette : le trait bleu. La zone nette s\'étend plus loin derrière le point que devant (environ un tiers devant, deux tiers derrière, tant qu\'on est loin de l\'hyperfocale).\n\nUn sujet hors de la zone a une tache de flou plus grande que le cercle de confusion : il est flou dans l\'image du coin.',
    vue: (st) => ({ cible: [st.cam.x, 0, st.cam.z + (st.sujets.A + st.sujets.C) / 2], demi: 4.5 }),
    lire: (st, m) => `point à ${distTxt(st.s)} : net de ${distTxt(m.proche)} à ${distTxt(m.loin)} · A ${m.sujets.A.net ? 'net' : 'flou'}, B ${m.sujets.B.net ? 'net' : 'flou'}, C ${m.sujets.C.net ? 'net' : 'flou'}`,
    anim: ({ ctx }) => balayage(ctx, 's', Math.max(0.5, ctx.st.sujets.A), Math.min(60, ctx.st.sujets.C), 10, { log: true, step: 0.01 }),
  },
  {
    id: 'hyperfocale', titre: 'L\'hyperfocale', lecon: 'camera-systeme',
    texte: 'Le point fait à l\'**hyperfocale** H donne la plus grande zone nette possible : de H ÷ 2 jusqu\'à l\'infini. H = f² ÷ (N × c) + f, avec c le cercle de confusion du capteur.\n\nC\'est le réglage d\'un plan large qu\'on veut net de près jusqu\'au fond : la focale courte et l\'iris fermé rapprochent H.',
    scene: (st, m) => ({ s: Math.min(60, Math.round(m.H * 100) / 100) }),
    vue: (st, m) => ({ cible: [st.cam.x, 0, st.cam.z + Math.min(14, m.H * 0.8)], demi: Math.min(9, Math.max(4, m.H * 0.6)) }),
    lire: (st, m) => `H = ${st.f}² ÷ (${fr(st.N, 1)} × ${fr(m.K.c, 3)}) + ${st.f} = ${distTxt(m.H)} : net de ${distTxt(m.H / 2)} à l'infini`,
  },
  {
    id: 'capteur', titre: 'Le capteur et le cercle de confusion', lecon: 'camera-systeme',
    texte: 'Un **grand capteur** demande une focale plus longue pour le même cadre, et c\'est elle qui amincit la zone nette. Le **cercle de confusion** admis (deux photosites en HD) grandit avec le capteur.\n\nÀ focale égale, le capteur change l\'angle de champ et le cercle ; à cadre égal, c\'est la profondeur de champ qui change. Les trois capteurs se succèdent.',
    vue: (st) => ({ cible: [st.cam.x, 0, st.cam.z + 4], demi: 5 }),
    lire: (st, m) => `${CAPTEURS[st.capteur].nom} : ${fr(m.K.w, 1)} × ${fr(m.K.h, 1)} mm, c = ${fr(m.K.c, 3)} mm · ${fr(m.angle, 1)}° au ${st.f} mm · net de ${distTxt(m.proche)} à ${distTxt(m.loin)}`,
    anim: ({ ctx }) => cycle(ctx, 'capteur', ['2/3', 's35', 'ff'], 2.6),
  },
];
void mondeOptique;
