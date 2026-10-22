// @ts-check
import { section, note, etat, choix, coche, formats, reseau, services } from './kit.js';

// ----------------------------------------------------------------------------------
// Le menu d'une caméra PTZ Panasonic (AW-HE130, AW-HE20) : ce que l'on règle dans la page web de
// la caméra (Setup) ou son menu à l'écran. Clés lues par le moteur : format, sdiOut, hdmiOut,
// tally ('ip' | 'serial' | 'off'), serie ('rs422' | 'rs232'), ndi, rtmp, irId, reseau.
// ----------------------------------------------------------------------------------
/** @typedef {import('./kit.js').Appareil} Appareil */
/** @typedef {import('./kit.js').Modele} Modele */
/** @typedef {import('./kit.js').Ctx} Ctx */

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuCamera(a, m, ctx) {
  const c = a.cfg; const T = ctx.E.tally[a.uid];
  const out = [
    section('Image',
      note('Page web de la caméra : Setup → System → Format. Toute la chaîne travaille au même format : un mélangeur refuse une entrée d\'un autre format (1080/50i n\'est pas 1080/50p).'),
      choix(a.uid, 'format', c.format, formats(m), 'Format de sortie'),
      coche(a.uid, 'sdiOut', c.sdiOut !== false, 'Sortie 3G-SDI active'),
      coche(a.uid, 'hdmiOut', c.hdmiOut !== false, 'Sortie HDMI active', { aide: 'Les deux sorties sont simultanées : le SDI vers le mélangeur, le HDMI vers un moniteur de contrôle.' })),
    section('Télécommande et tally',
      note('Une caméra AW se pilote en IP (le pupitre ou vMix envoie des commandes HTTP sur le port 80) ou en série (un câble RJ45 RS-422 par caméra, ou une chaîne RS-232C).'),
      choix(a.uid, 'serie', c.serie || 'rs422', [['rs422', 'RS-422 (prise CONTROL IN, RJ45)'], ['rs232', 'RS-232C (mini-DIN 8, chaînage)']], 'Liaison série attendue', { aide: 'Doit correspondre au câble du pupitre : un câble RS-422 sur une caméra réglée en RS-232C ne pilote rien.' }),
      choix(a.uid, 'tally', c.tally || 'ip', [['ip', 'Tally IP (commande du pupitre ou de vMix)'], ['serial', 'Tally par la liaison série'], ['off', 'Désactivé (voyant éteint)']], 'Tally'),
      choix(a.uid, 'irId', c.irId || 1, [[1, 'CAM 1'], [2, 'CAM 2'], [3, 'CAM 3'], [4, 'CAM 4']], 'Identifiant infrarouge', { aide: 'Pour la télécommande infrarouge de secours ; sans effet sur le pupitre.' }),
      T ? etat(T.pgm ? true : null, T.pgm ? `Tally rouge allumé : ${T.via}.` : T.pvw ? `Tally vert (prévisualisation) : ${T.via}.` : 'Tally éteint : la caméra n\'est pas à l\'antenne, ou le tally ne lui parvient pas.') : null),
  ];
  const flux = [];
  if ('ndi' in c) flux.push(coche(a.uid, 'ndi', !!c.ndi, 'NDI|HX (flux vidéo sur le réseau)', { aide: 'Une licence NDI|HX activée dans la caméra ; vMix reçoit alors l\'image par le câble RJ45, sans SDI.' }));
  if ('rtmp' in c) flux.push(coche(a.uid, 'rtmp', !!c.rtmp, 'Diffusion RTMP vers une plateforme', { aide: 'La caméra diffuse seule sur Internet : il lui faut une passerelle (la box) et un accès Internet.' }), ...services(ctx, `${a.uid}:rtmp:`));
  if (flux.length) out.push(section('Flux IP', ...flux));
  out.push(reseau(a, ctx, { menu: 'Setup → Network. Toutes les caméras AW sortent du carton en 192.168.0.10 : on les branche une par une pour leur donner chacune son adresse, sinon elles sont en conflit.' }));
  out.push(section('Ce que voit le réseau', ...services(ctx, `${a.uid}:web`, 'Interface web : pas d\'adresse joignable.')));
  return out.filter(Boolean).map((x) => /** @type {HTMLElement} */ (x));
}
