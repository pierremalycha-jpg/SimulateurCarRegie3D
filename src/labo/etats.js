// @ts-check
import { CAPTEURS, hyperfocale, limites, tache, net, champ, angleH } from './calc/optique.js';
import { eclairage, melange, dominante, eclairementPour, diaphs as ecartDiaphs, contraste } from './calc/photometrie.js';
import { GRIS, signal, plage } from './calc/sensito.js';
import { planUnivers, diagLigne, liaison } from './calc/dmx.js';
import { bancUsine, majTension, alimentation, doublons, rechercheEasyIp, liaisonsPupitre, qos, etapes, recette } from './calc/ptz.js';

// ----------------------------------------------------------------------------------
// L'état de chaque atelier du Labo (ce que l'élève règle) et ses mesures (ce que le modèle en
// calcule). Pur : l'interface (labo/ateliers/) l'affiche et le modifie, les défis le jugent
// (labo/defis/), les tests le rejouent. poser() applique un réglage écrit en chemins pointés
// (« p1.d », « appareils.g1.adresse » : un élément de liste se désigne par son id).
// ----------------------------------------------------------------------------------
const clone = (x) => JSON.parse(JSON.stringify(x));
const isPlain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

export const INITIAL = {
  optique: () => ({ capteur: 's35', f: 35, N: 4, s: 4, sujets: { A: 2, B: 4, C: 9 } }),
  photometrie: () => ({
    p1: { on: true, source: 'fresnel', angle: 30, niveau: 1, Tled: 5600, gel: 'aucune', d: 4, phi: -35, alpha: 0 },
    p2: { on: false, source: 'led', angle: 50, niveau: 0.6, Tled: 3200, gel: 'aucune', d: 2.5, phi: 45, alpha: 0 },
    cam: { iso: 800, t: 1 / 50, N: 4, Tcam: 3200 },
  }),
  sensito: () => ({ courbe: 'bt709', e: 0, g: 0, ciel: 3 }),
  // la console dot2 : le show qu'elle a enregistré (labo/ateliers/dot2.js le lit dans « simdot2.session »)
  dot2: () => ({ show: null }),
  dmx: () => ({
    vue: 'patch', sel: 'f1',
    appareils: [
      { id: 'f1', nom: 'PAR LED RGBW 1', modele: 'par', mode: '8 canaux', adresse: 1 },
      { id: 'f2', nom: 'PAR LED RGBW 2', modele: 'par', mode: '8 canaux', adresse: 9 },
      { id: 'f3', nom: 'Lyre spot 3', modele: 'lyre', mode: '16 canaux', adresse: 17 },
      { id: 'f4', nom: 'Bloc gradateur 6 circuits', modele: 'gradateur', mode: '6 canaux', adresse: 33 },
    ],
    valeurs: /** @type {number[]} */ (new Array(513).fill(0)),
    ligne: { recepteurs: 12, longueur: 80, terminaison: true, y: false, splitter: 0 },
    console: { ip: '2.0.0.1', masque: '255.0.0.0', protocole: 'artnet', univers: 1 },
    noeud: { ip: '2.0.0.50', masque: '255.0.0.0', protocole: 'artnet', net: 0, sub: 0, uni: 0, sacn: 1 },
  }),
  // le banc des caméras PTZ (labo/calc/ptz.js) : la vue choisie, l'application ouverte sur le PC
  ptz: () => ({ vue: 'banc', pcApp: 'reseau', ...bancUsine() }),
};

/** les mesures d'un atelier pour cet état */
export const MESURES = {
  optique: (st) => {
    const K = CAPTEURS[st.capteur] || CAPTEURS['2/3'];
    const [proche, loin] = limites(st.f, st.N, K.c, st.s);
    const sujets = Object.fromEntries(Object.entries(st.sujets).map(([k, d]) => [k, { d, tache: tache(st.f, st.N, st.s, d), net: net(st.f, st.N, K.c, st.s, d), champ: champ(K, st.f, d) }]));
    return { K, H: hyperfocale(st.f, st.N, K.c), proche, loin, angle: angleH(K, st.f), sujets };
  },
  photometrie: (st) => {
    const un = (p) => (p.on ? eclairage({ source: p.source, angle: p.angle, niveau: p.niveau, Tled: p.Tled, gel: p.gel, d: p.d, alpha: p.alpha, incidence: p.phi }) : { E: 0, T: 0, I: 0, I0: 0, theta: 0, diametre: 0 });
    const r1 = un(st.p1), r2 = un(st.p2);
    const mix = melange([r1, r2]);
    const Eref = eclairementPour(st.cam.N, st.cam.iso, st.cam.t);
    const c = contraste(r1.E, r2.E);
    return { r1, r2, e1: r1.E, e2: r2.E, E: mix.E, T: mix.T, Eref, expo: mix.E > 0 ? ecartDiaphs(mix.E, Eref) : -Infinity, dom: mix.T > 0 ? dominante(mix.T, st.cam.Tcam) : 0, ratio: c.rapport, ratioDiaphs: c.diaphs };
  },
  sensito: (st) => {
    const g = signal(st.courbe, GRIS, st.e, st.g), b = signal(st.courbe, 0.9, st.e, st.g), c = signal(st.courbe, GRIS * Math.pow(2, st.ciel), st.e, st.g);
    return { vGris: g.V, vBlanc: b.V, vCiel: c.V, cielEcrete: c.ecrete || c.sature, plage: plage(st.courbe, st.e, st.g) };
  },
  dot2: (st) => ({ show: st.show }),
  dmx: (st) => ({ plan: planUnivers(st.appareils), ligne: diagLigne(st.ligne), liaison: liaison(st.console, st.noeud) }),
  // le banc : la minute de mise sous tension de chaque appareil suit l'alimentation (majTension), puis tout se calcule
  ptz: (st) => { majTension(st); return { alim: alimentation(st), doublons: doublons(st), easyip: rechercheEasyIp(st), pupitre: liaisonsPupitre(st), qos: qos(st), etapes: etapes(st), recette: recette(st) }; },
};

/** applique un réglage { chemin: valeur } à un état (le modifie et le rend) */
export function poser(st, /** @type {Record<string, any>} */ patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    const parts = k.split('.'); let o = st;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (Array.isArray(o)) { o = o.find((x) => x && x.id === p); } else { if (o[p] == null || typeof o[p] !== 'object') o[p] = {}; o = o[p]; }
      if (!o) break;
    }
    if (!o) continue;
    const last = parts[parts.length - 1];
    // un objet se fond dans celui qui est là (une scène ne donne que ce qu'elle change) ; une liste, une valeur remplacent
    if (isPlain(v) && isPlain(o[last])) fondre(o[last], v); else o[last] = clone(v);
  }
  return st;
}
/** fond un objet dans un autre, clé à clé (ici, les clés ne sont pas des chemins : « 1.1 » est un exécuteur) */
function fondre(dst, src) {
  for (const [k, v] of Object.entries(src)) { if (isPlain(v) && isPlain(dst[k])) fondre(dst[k], v); else dst[k] = clone(v); }
  return dst;
}
/** l'état de départ d'un essai : l'état initial de l'atelier, la scène du défi posée dessus */
export const etatPour = (/** @type {string} */ atelier, scene = {}) => poser(INITIAL[atelier](), scene);
