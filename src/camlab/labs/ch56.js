// @ts-check
// Manipulations des fiches du module caméra : le corps de la caméra, le viseur et le cadreur (chapitres 5 et 6). Chacune reçoit ctx = { lens(état) } et
// renvoie { node, dispose } (voir ../labs.js). Le viseur simulé est dans ../vf.js, les commandes
// communes dans ../controls.js, les calculs d'optique dans ../optics.js.

/** @type {Record<string, (ctx: any) => { node: HTMLElement, dispose: () => void }>} */
export const LABS_CH56 = {};
