// @ts-check
import { MODELES, CLASSES_POE, POE } from '../labo/calc/ptz.js';

// ----------------------------------------------------------------------------------
// Les calculs du chapitre « Les caméras PTZ » (v19.30), sans affichage (testés à part) : le champ d'une tourelle
// selon sa focale, le temps d'un panoramique, le matériel d'un banc (ports, PoE, câbles), la commande HTTP
// d'une tourelle Panasonic, la charge d'un lien par des flux de caméras. Le réseau (adresses, Easy IP Setup,
// PoE, pupitre, QoS) se calcule dans le modèle de l'atelier du Labo (labo/calc/ptz.js) : les leçons et le Labo
// disent les mêmes chiffres.
// Sources : optiques et capteurs, fiches Panasonic (AW-HE130 : 4,5 à 90 mm, capteurs 1/2,86 pouce ; AW-UE20 :
// 3,9 à 46,8 mm, capteur 1/2,8 pouce) ; la largeur d'un capteur se déduit de son « type » en pouces par la règle
// des tubes de prise de vue (1 pouce de type ≈ 16 mm de diagonale) : un ordre de grandeur, à un ou deux degrés
// près sur l'angle annoncé par le constructeur. Commandes HTTP : spécification d'interface des caméras
// intégrées Panasonic (/cgi-bin/aw_ptz?cmd=%23…&res=1 ; vitesses de 01 à 99, 50 à l'arrêt).
// ----------------------------------------------------------------------------------

/** les optiques des tourelles du BTS : focales extrêmes (mm) et type du capteur (1/x pouce) */
export const OPTIQUES = {
  he130: { nom: 'AW-HE130', fmin: 4.5, fmax: 90, type: 2.86 },
  ue20: { nom: 'AW-UE20', fmin: 3.9, fmax: 46.8, type: 2.8 },
};
/** la largeur d'un capteur 16:9 d'après son type en pouces (1/x) : diagonale ≈ 16 mm ÷ x, largeur = diagonale × 16 ÷ √337 */
export const largeurCapteur = (x) => 16 / x * 16 / Math.sqrt(16 * 16 + 9 * 9);
/** le rapport de zoom */
export const rapportZoom = (m) => OPTIQUES[m].fmax / OPTIQUES[m].fmin;
/** l'angle de champ horizontal, en degrés, à la focale f (mm) */
export function angleH(m, f) { const w = largeurCapteur(OPTIQUES[m].type); return 2 * Math.atan(w / (2 * f)) * 180 / Math.PI; }
/** la largeur de champ (m) à d mètres, à la focale f */
export function champ(m, f, d) { return d * largeurCapteur(OPTIQUES[m].type) / f; }
/** la focale (mm) qui cadre une largeur L (m) à d mètres ; dans : l'optique la permet-elle ? */
export function focalePour(m, L, d) {
  const f = d * largeurCapteur(OPTIQUES[m].type) / L;
  return { f, dans: f >= OPTIQUES[m].fmin - 1e-9 && f <= OPTIQUES[m].fmax + 1e-9 };
}
/** la distance (m) à partir de laquelle la tourelle cadre une largeur L au plus serré (L plus petite : plus loin) */
export const distancePour = (m, L, f) => L * f / largeurCapteur(OPTIQUES[m].type);
/** le temps (s) d'un panoramique de a degrés à v degrés par seconde */
export const tempsPano = (a, v) => (v > 0 ? Math.abs(a) / v : Infinity);

/**
 * Le matériel d'un banc : n130 AW-HE130, nUe20 AW-UE20, un pupitre (ou non), un PC.
 * Ports du switch, puissance PoE réservée (allocation par classe) et consommée (ordre de grandeur),
 * câbles RJ45 (un par appareil) et SDI (un par caméra vers le mélangeur, un retour de contrôle pour le pupitre).
 */
export function materiel(n130, nUe20, pupitre = true) {
  const poe = [...Array(n130).fill('he130'), ...Array(nUe20).fill('ue20'), ...(pupitre ? ['rp150'] : [])];
  const reserve = poe.reduce((s, m) => s + CLASSES_POE[MODELES[m].classe], 0);
  const conso = poe.reduce((s, m) => s + MODELES[m].conso, 0);
  const cams = n130 + nUe20;
  return { ports: poe.length + 1, reserve, conso, rj45: poe.length + 1, sdi: cams + (pupitre ? 1 : 0), cams, portsPoe: poe.length };
}
/** le plus petit budget de switch (W) parmi des modèles courants qui porte cette réserve */
export const BUDGETS = [65, 125, 185, 240, 370, 740];
export const budgetPour = (w) => BUDGETS.find((b) => b >= w) || null;
/** le PoE dont un appareil a besoin, en clair */
export const besoinPoe = (m) => POE[MODELES[m].poe];

// ---------------- la commande HTTP d'une tourelle Panasonic ----------------
/** une vitesse de -49 à +49 en code de deux chiffres (01 à 99, 50 à l'arrêt) */
export const codeVitesse = (v) => String(Math.max(1, Math.min(99, 50 + Math.round(v)))).padStart(2, '0');
/** la commande (sans « # ») : pan et tilt ensemble (#PTS), ou zoom (#Z) */
export function commande(action, v1 = 0, v2 = 0) {
  if (action === 'pt') return `PTS${codeVitesse(v1)}${codeVitesse(v2)}`;
  if (action === 'zoom') return `Z${codeVitesse(v1)}`;
  return 'PTS5050';
}
/** l'URL envoyée par le pupitre ou un logiciel : le « # » s'écrit %23 dans une URL */
export function urlCommande(ip, port, cmd) {
  return `http://${ip}${Number(port) !== 80 ? ':' + port : ''}/cgi-bin/aw_ptz?cmd=%23${cmd}&res=1`;
}
/** ce que dit une commande, en clair */
export function lireCommande(cmd) {
  const m = /^PTS(\d\d)(\d\d)$/.exec(cmd);
  const sens = (c, plus, moins) => { const v = Number(c) - 50; return v === 0 ? 'à l\'arrêt' : `${v > 0 ? plus : moins} à la vitesse ${Math.abs(v)} sur 49`; };
  if (m) return `pan ${sens(m[1], 'vers la droite', 'vers la gauche')}, tilt ${sens(m[2], 'vers le haut', 'vers le bas')}`;
  const z = /^Z(\d\d)$/.exec(cmd);
  if (z) return `zoom ${sens(z[1], 'vers le téléobjectif (serré)', 'vers le grand-angle (large)')}`;
  return 'commande inconnue';
}

// ---------------- les flux IP ----------------
/** la charge d'un lien : n flux de d Mb/s plus un autre trafic, sur un lien de L Mb/s */
export const chargeLien = (n, d, autre, L) => (n * d + autre) / L;
/** combien de flux de d Mb/s tiennent sous une charge de c (0,8 : 80 %) d'un lien de L Mb/s */
export const fluxMax = (d, L, c = 0.8) => Math.floor(L * c / d + 1e-9);
/** le volume (Go) d'un enregistrement de t minutes à d Mb/s */
export const volumeGo = (d, t) => d * t * 60 / 8 / 1000;
