// ----------------------------------------------------------------------------------
// Signature numérique (Authenticode) de TIEE-Simulator.exe, sans outil Windows : resedit
// assemble la signature, Node la calcule avec la clé privée, un service d'horodatage (RFC 3161)
// la date, pour qu'elle reste valable après l'expiration du certificat.
//
// Utilisé par tools/exe.mjs quand ces variables d'environnement (ou secrets GitHub) sont données :
//   TIEE_SIGN_CERT      certificat(s) PEM (texte ou chemin) : celui de l'éditeur d'abord, puis les intermédiaires
//   TIEE_SIGN_KEY       clé privée RSA PEM (texte ou chemin)
//   TIEE_SIGN_KEY_MDP   (option) mot de passe de la clé
//   TIEE_SIGN_TSA       (option) service d'horodatage, http://timestamp.digicert.com par défaut ; « non » : sans
//
// Certificat de l'établissement (auto-signé), à créer une fois :
//   node tools/signature.mjs --creer [dossier]     (openssl ; dossier .cache/signature par défaut, hors dépôt)
// Il prouve que l'exécutable vient de vous et n'a pas été modifié ; Windows ne lui fait confiance que
// sur les postes où le certificat (.cer) est installé (voir partage/LISEZMOI.txt et README.md).
// ----------------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NtExecutable, generateExecutableWithSign } from 'resedit';

const lire = (v) => (v && !/-----BEGIN /.test(v) && fs.existsSync(v) ? fs.readFileSync(v, 'utf8') : v || '');
const concat = (it) => { const parts = []; for (let r = it.next(); !r.done; r = it.next()) parts.push(Buffer.from(r.value)); return Buffer.concat(parts); };

/** la signature est-elle demandée ? (certificat et clé donnés) */
export const signatureDemandee = (env = process.env) => !!(env.TIEE_SIGN_CERT && env.TIEE_SIGN_KEY);

/** les certificats donnés (PEM), le premier étant celui de l'éditeur */
export function certificats(env = process.env) {
  const pems = lire(env.TIEE_SIGN_CERT).match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  if (!pems.length) throw new Error('TIEE_SIGN_CERT : aucun certificat PEM trouvé');
  return pems.map((p) => new crypto.X509Certificate(p));
}

/**
 * signe l'exécutable (Buffer) ; renvoie { exe, sujet, horodate }
 * @param {Buffer} bin
 */
export async function signer(bin, env = process.env) {
  const certs = certificats(env);
  const cle = crypto.createPrivateKey({ key: lire(env.TIEE_SIGN_KEY), passphrase: env.TIEE_SIGN_KEY_MDP || undefined });
  if (cle.asymmetricKeyType !== 'rsa') throw new Error('TIEE_SIGN_KEY : clé RSA attendue');
  if (!certs[0].checkPrivateKey(cle)) throw new Error('TIEE_SIGN_KEY ne correspond pas au premier certificat de TIEE_SIGN_CERT');
  if (new Date(certs[0].validTo) < new Date()) throw new Error(`certificat expiré le ${certs[0].validTo}`);
  if (certs[0].keyUsage && !certs[0].keyUsage.includes('1.3.6.1.5.5.7.3.3')) throw new Error('le certificat n\'est pas prévu pour signer du code (usage « codeSigning » absent)');
  const tsa = env.TIEE_SIGN_TSA === 'non' ? '' : env.TIEE_SIGN_TSA || 'http://timestamp.digicert.com';
  const signerObj = {
    getDigestAlgorithm: () => /** @type {'sha256'} */ ('sha256'),
    getEncryptionAlgorithm: () => /** @type {'rsa'} */ ('rsa'),
    getCertificateData: () => certs.map((c) => c.raw),
    digestData: async (it) => crypto.createHash('sha256').update(concat(it)).digest(),
    signData: async (it) => crypto.sign('sha256', concat(it), cle),
    timestampData: tsa ? async (req) => {
      const r = await fetch(tsa, { method: 'POST', headers: { 'content-type': 'application/timestamp-query' }, body: Buffer.from(req), signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`horodatage ${tsa} : HTTP ${r.status}`);
      return await r.arrayBuffer();
    } : undefined,
  };
  // table des certificats alignée sur 8 octets (spécification Authenticode), pas sur l'alignement des sections
  const exe = Buffer.from(await generateExecutableWithSign(NtExecutable.from(bin), signerObj, 8));
  return { exe, sujet: certs[0].subject.replace(/\n/g, ', '), horodate: !!tsa };
}

/**
 * somme de contrôle de l'en-tête PE, recalculée sur place (resedit et postject la laissent fausse ;
 * Windows ne la vérifie pas pour un programme, certains antivirus si). Elle est hors de l'empreinte
 * Authenticode : la recalculer après la signature ne l'invalide pas.
 * @param {Buffer} b
 */
export function fixeChecksum(b) {
  const at = b.readUInt32LE(0x3c) + 4 + 20 + 64; // e_lfanew, signature « PE\0\0 », en-tête COFF, puis le champ CheckSum
  let sum = 0;
  for (let i = 0; i + 1 < b.length; i += 2) {
    if (i === at || i === at + 2) continue;
    sum += b.readUInt16LE(i); sum = (sum & 0xffff) + (sum >>> 16);
  }
  if (b.length & 1) { sum += b[b.length - 1]; sum = (sum & 0xffff) + (sum >>> 16); }
  b.writeUInt32LE(((sum & 0xffff) + b.length) >>> 0, at);
  return b;
}

/** crée un certificat auto-signé de signature de code (openssl) : certificat.pem, cle.pem, certificat.cer */
export function creerCertificat(dossier) {
  fs.mkdirSync(dossier, { recursive: true });
  const cert = path.join(dossier, 'certificat.pem'), cle = path.join(dossier, 'cle.pem');
  if (fs.existsSync(cle)) throw new Error(`${cle} existe déjà : effacez-le d'abord si vous voulez vraiment un nouveau certificat`);
  execFileSync('openssl', ['req', '-x509', '-utf8', '-newkey', 'rsa:3072', '-sha256', '-days', '1825', '-nodes', '-keyout', cle, '-out', cert,
    '-subj', '/CN=TIEE Simulator - BTS Audiovisuel de Saint-Quentin/O=BTS Audiovisuel, lycée Henri-Martin/L=Saint-Quentin/C=FR',
    '-addext', 'keyUsage=critical,digitalSignature', '-addext', 'extendedKeyUsage=codeSigning', '-addext', 'basicConstraints=critical,CA:FALSE'], { stdio: ['ignore', 'ignore', 'pipe'] });
  fs.chmodSync(cle, 0o600);
  const x = new crypto.X509Certificate(fs.readFileSync(cert));
  fs.writeFileSync(path.join(dossier, 'certificat.cer'), x.raw);
  return { cert, cle, cer: path.join(dossier, 'certificat.cer'), empreinte: x.fingerprint256 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--creer');
  if (i < 0) { console.error('usage : node tools/signature.mjs --creer [dossier]'); process.exit(2); }
  const dossier = path.resolve(process.argv[i + 1] || path.join(import.meta.dirname, '../.cache/signature'));
  const r = creerCertificat(dossier);
  console.log(`certificat auto-signé créé (5 ans) dans ${dossier}
  certificat.pem  → secret GitHub TIEE_SIGN_CERT (contenu du fichier)
  cle.pem         → secret GitHub TIEE_SIGN_KEY (contenu du fichier) : à ne jamais publier ni envoyer
  certificat.cer  → à installer sur les postes du lycée (« Éditeurs approuvés » et « Autorités de
                    certification racines de confiance »), par exemple par une stratégie de groupe
  empreinte SHA-256 : ${r.empreinte}`);
}
