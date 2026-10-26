// @ts-check
// ----------------------------------------------------------------------------------
// Le coffre de TIEE-Simulator.exe : la page du simulateur chiffrée par un mot de passe.
//
// À la construction (tools/exe.mjs), la page est compressée (gzip), puis chiffrée en AES-256-GCM
// avec une clé tirée du mot de passe par scrypt (sel aléatoire). L'exécutable ne contient que ce
// coffre : sans le mot de passe, on n'en tire rien (fouiller le fichier ne donne que du bruit, et
// GCM refuse un coffre modifié). Au lancement, le serveur (lan/serveur.mjs) demande le mot de passe
// dans la page, ouvre le coffre en mémoire et sert le simulateur.
//
// scrypt N = 2^17, r = 8 : 128 Mo de mémoire et de l'ordre d'une demi-seconde par essai sur un PC
// de bureau (ordre de grandeur) : chaque essai coûte cher à celui qui voudrait deviner le mot de passe
// en partant du fichier. La solidité tient alors à la longueur du mot de passe (voir partage/LISEZMOI.txt).
// ----------------------------------------------------------------------------------
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const KDF = { N: 2 ** 17, r: 8, p: 1 };
const maxmem = (k) => 256 * k.N * k.r + 32 * 1024 * 1024;

/** @typedef {{ v: 1, kdf: 'scrypt', N: number, r: number, p: number, sel: string, iv: string, tag: string, data: string }} Coffre */

/** le mot de passe tel qu'il compte : accents sous une seule forme (NFC), sans espace ni retour à la
 *  ligne au début ou à la fin (collés par mégarde dans le secret GitHub, ou tapés dans la page) */
export const mdpNormal = (mdp) => String(mdp).normalize('NFC').trim();

/** clé AES tirée du mot de passe (asynchrone : le serveur continue de répondre pendant le calcul) */
export function cleDe(mdp, sel, k = KDF) {
  return new Promise((res, rej) => crypto.scrypt(mdpNormal(mdp), sel, 32, { N: k.N, r: k.r, p: k.p, maxmem: maxmem(k) }, (e, cle) => (e ? rej(e) : res(cle))));
}

/** chiffre un texte (la page) : renvoie le coffre, à intégrer tel quel dans le serveur */
export async function chiffrer(texte, mdp, k = KDF) {
  const sel = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const cle = await cleDe(mdp, sel, k);
  const c = crypto.createCipheriv('aes-256-gcm', cle, iv);
  const data = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(texte, 'utf8'), { level: 9 })), c.final()]);
  return /** @type {Coffre} */ ({ v: 1, kdf: 'scrypt', N: k.N, r: k.r, p: k.p, sel: sel.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
}

/** est-ce un coffre ? (la page intégrée au serveur est soit du texte, soit un coffre) */
export const estCoffre = (x) => !!x && typeof x === 'object' && x.v === 1 && x.kdf === 'scrypt' && typeof x.data === 'string';

/**
 * ouvre le coffre : { html (Buffer), gz (Buffer, la page compressée, à servir telle quelle), cle },
 * ou null si le mot de passe est faux (ou le coffre altéré : GCM ne fait pas la différence)
 * @param {Coffre} coffre
 */
export async function ouvrir(coffre, mdp) {
  const cle = await cleDe(mdp, Buffer.from(coffre.sel, 'base64'), coffre);
  return ouvrirAvec(coffre, cle);
}
/** @param {Coffre} coffre @param {Buffer} cle */
export function ouvrirAvec(coffre, cle) {
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', cle, Buffer.from(coffre.iv, 'base64'));
    d.setAuthTag(Buffer.from(coffre.tag, 'base64'));
    const gz = Buffer.concat([d.update(Buffer.from(coffre.data, 'base64')), d.final()]);
    return { html: zlib.gunzipSync(gz), gz, cle };
  } catch (e) { return null; }
}
