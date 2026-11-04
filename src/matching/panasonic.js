// @ts-check
// ----------------------------------------------------------------------------------
// Les commandes des caméras Panasonic AW (v19.30), calcul pur : une commande est un texte envoyé par
// HTTP GET à http://<adresse>/cgi-bin/aw_cam?cmd=<commande>&res=1 ; la caméra répond « 200 OK » et le
// texte de la commande (ou ER1/ER2/ER3). Spécification d'interface « HD Integrated Camera » V1.06
// (octobre 2015) : AW-HE130 (gains R et B en ORI/OBI de −150 à +150, pedestal OTP, R et B pedestal
// ORP/OBP, gamma numérique OSA:6A de 0,30 à 0,75, type de matrice OSE:31, matrice linéaire OSD:A4 à
// OSD:A9 de −63 à +63, chroma OSD:B0, température de couleur OSD:B1 par code, mode de balance OAW).
// La famille HE40 / UE70 (syntaxe que l'on suppose pour l'AW-UE20, à vérifier) : gains ±30 en pas de 5
// dans la donnée, pedestal ±10 en pas de 15, chroma OCG de −3 à +3.
// L'instantané JPEG : /cgi-bin/camera?resolution=1920 (supplément « Web Control » ; à vérifier sur
// chaque modèle). Une requête Q… renvoie la valeur en cours sous la même forme que la commande O….
// ----------------------------------------------------------------------------------

/** la table des températures de couleur de l'AW-HE130 : le code OSD:B1 (000h…078h, 121 valeurs) donne ces kelvins */
export const CT_HE130 = [2000, 2010, 2020, 2040, 2050, 2070, 2080, 2090, 2110, 2120, 2140, 2150, 2170, 2180, 2200, 2210, 2230, 2240, 2260, 2280, 2300, 2310, 2330, 2340,
  2360, 2380, 2400, 2420, 2440, 2460, 2480, 2500, 2520, 2540, 2560, 2600, 2620, 2640, 2680, 2700, 2720, 2740, 2780, 2800, 2820, 2850, 2870, 2920, 2950, 2970, 3000, 3020, 3070,
  3100, 3120, 3150, 3200, 3250, 3270, 3330, 3360, 3420, 3450, 3510, 3570, 3600, 3660, 3720, 3780, 3840, 3870, 3930, 3990, 4050, 4110, 4170, 4240, 4320, 4360, 4440, 4520, 4600,
  4680, 4760, 4840, 4920, 5000, 5100, 5200, 5300, 5400, 5500, 5600, 5750, 5850, 6000, 6150, 6300, 6450, 6650, 6800, 7000, 7150, 7400, 7600, 7800, 8100, 8300, 8600, 8900, 9200,
  9600, 10000, 10500, 11000, 11500, 12000, 12500, 13000, 14000, 15000];

const hex = (v, n) => Math.round(v).toString(16).toUpperCase().padStart(n, '0');
const borne = (v, a, b) => Math.min(b, Math.max(a, Math.round(v)));
/** l'ordre des six coefficients de la matrice linéaire, OSD:A4 à OSD:A9 */
export const MATRICE_ORDRE = ['rg', 'rb', 'gr', 'gb', 'br', 'bg'];
const MATRICE_CODES = { rg: 'A4', rb: 'A5', gr: 'A6', gb: 'A7', br: 'A8', bg: 'A9' };

/** le code de température le plus proche d'une valeur en kelvins (HE130) */
export function codeTemperature(K) {
  let best = 0; for (let i = 0; i < CT_HE130.length; i++) if (Math.abs(CT_HE130[i] - K) < Math.abs(CT_HE130[best] - K)) best = i;
  return best;
}

/**
 * La commande à envoyer pour poser un réglage ; null si le modèle ne l'a pas.
 * @param {'he130'|'ue20'} famille @param {string} reglage gainR, gainB, pedestal, pedestalR, pedestalB, gamma, temperature, matrice.<coef>, saturation
 * @param {number} valeur en unités du menu (ou exposant, kelvins, pour cent pour les réglages absolus)
 * @returns {string[] | null} une ou plusieurs commandes, dans l'ordre
 */
export function commandes(famille, reglage, valeur) {
  const he130 = famille === 'he130';
  const m = /^matrice\.(\w+)$/.exec(reglage);
  if (m) return he130 && MATRICE_CODES[m[1]] ? ['OSE:31:3', `OSD:${MATRICE_CODES[m[1]]}:${hex(borne(valeur, -63, 63) + 0x80, 2)}`] : null;
  switch (reglage) {
    case 'gainR': return [he130 ? `ORI:${hex(borne(valeur, -150, 150) + 0x96, 3)}` : `ORI:${hex(borne(valeur, -30, 30) * 5 + 0x96, 3)}`];
    case 'gainB': return [he130 ? `OBI:${hex(borne(valeur, -150, 150) + 0x96, 3)}` : `OBI:${hex(borne(valeur, -30, 30) * 5 + 0x96, 3)}`];
    case 'pedestal': return [he130 ? `OTP:${hex(borne(valeur, -150, 150) + 0x96, 3)}` : `OTP:${hex(borne(valeur, -10, 10) * 15 + 0x96, 3)}`];
    case 'pedestalR': return he130 ? [`ORP:${hex(borne(valeur, -100, 100) + 0x96, 3)}`] : null;
    case 'pedestalB': return he130 ? [`OBP:${hex(borne(valeur, -100, 100) + 0x96, 3)}`] : null;
    case 'gamma': return he130 ? [`OSA:6A:${hex(borne(valeur * 100, 30, 75) + 73, 2)}`] : null; // 67h = 0,30 … 94h = 0,75
    case 'temperature': return he130 ? ['OAW:9', `OSD:B1:${hex(codeTemperature(valeur), 3)}`] : null;    // balance en mode VAR, puis la valeur
    case 'saturation': return he130 ? [`OSD:B0:${hex(borne(valeur, -99, 40) + 0x80, 2)}`] : [`OCG:${hex(borne(valeur, -3, 3) + 3, 2)}`];
    case 'balanceAuto': return ['OWS'];
    default: return null;
  }
}
/** la requête qui lit la valeur en cours d'un réglage ; null si le modèle ne l'a pas */
export function requete(famille, reglage) {
  const he130 = famille === 'he130';
  const m = /^matrice\.(\w+)$/.exec(reglage);
  if (m) return he130 && MATRICE_CODES[m[1]] ? `QSD:${MATRICE_CODES[m[1]]}` : null;
  return { gainR: 'QRI', gainB: 'QBI', pedestal: 'QTP', pedestalR: he130 ? 'QRP' : null, pedestalB: he130 ? 'QBP' : null, gamma: he130 ? 'QSA:6A' : null,
    temperature: he130 ? 'QSD:B1' : null, saturation: he130 ? 'QSD:B0' : 'QCG', balanceMode: 'QAW' }[reglage] || null;
}
/**
 * Lit une réponse de la caméra (le texte renvoyé à une commande ou à une requête) : le réglage et sa valeur en
 * unités du menu. Null si la réponse n'est pas reconnue ; { erreur } pour ER1 (commande inconnue), ER2 (occupée), ER3 (refusée).
 * @returns {{ reglage: string, valeur: number } | { erreur: string } | null}
 */
export function lireReponse(famille, texte) {
  const t = String(texte || '').trim();
  const er = /^ER([123])/.exec(t); if (er) return { erreur: ['', 'commande inconnue (ER1)', 'caméra occupée (ER2)', 'réglage refusé dans ce mode (ER3)'][+er[1]] };
  const he130 = famille === 'he130';
  let m;
  if ((m = /^(ORI|OBI|OTP|ORP|OBP):([0-9A-F]{3})$/i.exec(t))) {
    const d = parseInt(m[2], 16) - 0x96, nom = { ORI: 'gainR', OBI: 'gainB', OTP: 'pedestal', ORP: 'pedestalR', OBP: 'pedestalB' }[m[1].toUpperCase()];
    const div = he130 ? 1 : nom === 'pedestal' ? 15 : 5;
    return { reglage: nom, valeur: Math.round(d / div) };
  }
  if ((m = /^OSA:6A:([0-9A-F]{2})$/i.exec(t))) return { reglage: 'gamma', valeur: (parseInt(m[1], 16) - 73) / 100 };
  if ((m = /^OSD:(A[4-9]):([0-9A-F]{2})$/i.exec(t))) { const coef = MATRICE_ORDRE.find((k) => MATRICE_CODES[k] === m[1].toUpperCase()); return { reglage: `matrice.${coef}`, valeur: parseInt(m[2], 16) - 0x80 }; }
  if ((m = /^OSD:B0:([0-9A-F]{2})$/i.exec(t))) return { reglage: 'saturation', valeur: parseInt(m[1], 16) - 0x80 };
  if ((m = /^OSD:B1:([0-9A-F]{3})$/i.exec(t))) return { reglage: 'temperature', valeur: CT_HE130[Math.min(CT_HE130.length - 1, parseInt(m[1], 16))] };
  if ((m = /^OCG:([0-9A-F]{2})$/i.exec(t))) return { reglage: 'saturation', valeur: parseInt(m[1], 16) - 3 };
  if ((m = /^OAW:(\d)$/.exec(t))) return { reglage: 'balanceMode', valeur: +m[1] };
  if ((m = /^OSE:31:(\d)$/.exec(t))) return { reglage: 'matriceType', valeur: +m[1] };
  if (/^OWS$/.test(t)) return { reglage: 'balanceAuto', valeur: 1 };
  return null;
}
/** l'adresse HTTP d'une commande ou d'une requête */
export const urlCommande = (adresse, cmd) => `http://${adresse}/cgi-bin/aw_cam?cmd=${encodeURIComponent(cmd)}&res=1`;
/** l'adresse de l'instantané JPEG */
export const urlInstantane = (adresse, largeur = 1920) => `http://${adresse}/cgi-bin/camera?resolution=${largeur}`;
