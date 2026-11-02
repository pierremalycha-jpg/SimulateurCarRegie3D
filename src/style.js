// @ts-check
import * as THREE from 'three';

// ----------------------------------------------------------------------------------
// Le style graphique (v19.21) : « dessin » (cel shading, par défaut) ou « réaliste ». Le dessin ne coûte presque rien,
// même en qualité Basse :
//  · la lumière directe (soleil, projecteurs, spots du car) passe par trois paliers adoucis (ombre, demi-teinte,
//    lumière) au lieu d'un dégradé continu : des aplats francs, à la façon d'un dessin animé ;
//  · les ombres portées ont un bord net ;
//  · en qualité Moyenne et Haute, le post-traitement (render.js) trace les contours à l'encre (lus dans la profondeur,
//    sans passe de rendu en plus) et donne des couleurs plus franches ; le ciel a des nuages aux bords dessinés.
// Les morceaux de shader de three.js (ShaderChunk) sont réécrits avant toute compilation. Changer de style recompile
// les matières : le type d'ombre du moteur (PCF net pour le dessin, PCF doux pour le réaliste) fait partie de la clé
// des programmes, si bien qu'un programme compilé dans un style n'est jamais repris dans l'autre.
// ----------------------------------------------------------------------------------
export const STYLE = {
  /** cel shading actif */
  cel: true,
  /** force du contour d'encre (post-traitement) */
  encre: 0.85,
};
const CLE = 'carregie.style';
try { const v = localStorage.getItem(CLE); if (v === 'realiste') STYLE.cel = false; } catch (e) { /* stockage indisponible */ }
if (typeof location !== 'undefined' && /[?&]realiste\b/.test(location.search)) STYLE.cel = false;

// paliers de la lumière directe : 0 dans l'ombre, 0,5 en demi-teinte, 0,95 en pleine lumière, un peu du dégradé
// d'origine gardé (le relief des matières reste lisible) ; ombres portées resserrées autour de leur bord
export const CEL_GLSL = `
float celRamp( const in float x ) {
  float t = smoothstep( 0.0, 0.06, x ) * 0.5 + smoothstep( 0.3, 0.4, x ) * 0.45;
  return mix( x, t, 0.82 );
}
float celOmbre( const in float s ) { return mix( s, smoothstep( 0.32, 0.68, s ), 0.85 ); }
`;
/** la même rampe en JavaScript (tests unitaires) */
export function celRamp(x) {
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const t = sm(0, 0.06, x) * 0.5 + sm(0.3, 0.4, x) * 0.45;
  return x + (t - x) * 0.82;
}

const C = THREE.ShaderChunk;
const ORIG = { pars: C.lights_pars_begin, phys: C.lights_physical_pars_fragment, lamb: C.lights_lambert_pars_fragment, begin: C.lights_fragment_begin };
const NL = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
const OMBRE_DIR = /(directLight\.color \*= \( directLight\.visible && receiveShadow \) \? )(getShadow\( (?:directional|spot)ShadowMap\[ i \][^;]*?\)) : 1\.0;/g;
/** réécrit (ou rétablit) les morceaux de shader ; renvoie le nombre de remplacements faits (tests) */
export function appliquerChunks(cel) {
  if (!cel) { C.lights_pars_begin = ORIG.pars; C.lights_physical_pars_fragment = ORIG.phys; C.lights_lambert_pars_fragment = ORIG.lamb; C.lights_fragment_begin = ORIG.begin; return 0; }
  let n = 0;
  const nl = (s) => s.split(NL).join((n++, 'float dotNL = celRamp( saturate( dot( geometryNormal, directLight.direction ) ) );'));
  C.lights_pars_begin = CEL_GLSL + ORIG.pars;
  C.lights_physical_pars_fragment = nl(ORIG.phys);
  C.lights_lambert_pars_fragment = nl(ORIG.lamb);
  C.lights_fragment_begin = ORIG.begin.replace(OMBRE_DIR, (m, a, b) => { n++; return `${a}celOmbre( ${b} ) : 1.0;`; });
  return n;
}

/** type d'ombre du moteur pour le style courant */
export const typeOmbre = () => (STYLE.cel ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap);

/**
 * Change de style : morceaux de shader, type d'ombre, matières des scènes à recompiler.
 * @param {boolean} cel @param {THREE.WebGLRenderer | null} renderer @param {THREE.Object3D[]} scenes
 */
export function setStyle(cel, renderer, scenes = []) {
  STYLE.cel = !!cel;
  try { localStorage.setItem(CLE, STYLE.cel ? 'dessin' : 'realiste'); } catch (e) { /* stockage indisponible */ }
  appliquerChunks(STYLE.cel);
  if (renderer) { renderer.shadowMap.type = typeOmbre(); renderer.shadowMap.needsUpdate = true; }
  for (const sc of scenes) {
    if (!sc) continue;
    sc.traverse((o) => {
      const any = /** @type {any} */ (o);
      if (any.isLight && any.shadow && any.shadow.map) { any.shadow.map.dispose(); any.shadow.map = null; }
      for (const m of [].concat(any.material || [])) m.needsUpdate = true;
    });
  }
  // le ciel (nuages dessinés ou fondus)
  for (const f of STYLE_HOOKS) f(STYLE.cel);
}
/** fonctions appelées à chaque changement de style (ciel, étalonnage) */
export const STYLE_HOOKS = /** @type {Array<(cel: boolean) => void>} */ ([]);

// les morceaux de shader sont prêts dès le chargement du module : avant la première compilation
appliquerChunks(STYLE.cel);
