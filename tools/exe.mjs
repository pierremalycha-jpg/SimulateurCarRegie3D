// ----------------------------------------------------------------------------------
// Version à partager : TIEE-Simulator.exe et le kit dist/TIEE-Simulator-partage.zip.
// L'exécutable est le serveur réseau local dans un exécutable Node.js autonome (« single
// executable application ») : on double-clique, le navigateur s'ouvre sur l'écran « Accès
// réservé », on donne le mot de passe, le simulateur s'ouvre ; les autres ordinateurs du réseau
// local rejoignent la partie à l'adresse affichée (mot de passe demandé aussi). Rien à installer.
//
//   TIEE_MDP='…' node tools/exe.mjs                 (après node tools/build.mjs)
//   node tools/exe.mjs --node-exe chemin\node.exe   node.exe déjà téléchargé (même version que node)
//   node tools/exe.mjs --verifier                   en plus : même blob dans le node de cette
//                                                   machine (Linux), lancé et interrogé
// Sur GitHub : .github/workflows/exe.yml (secrets TIEE_MDP et, pour signer, TIEE_SIGN_CERT / TIEE_SIGN_KEY).
//
// Protection : la page est chiffrée par le mot de passe (tools/protege.mjs, lan/coffre.mjs) ;
// l'exécutable ne contient ni la page en clair ni le mot de passe (vérifié plus bas). Plus de
// TIEE-Simulator.html dans le kit : la page en clair ne sort plus.
//
// Étapes (communes avec l'application macOS, tools/mac.mjs : tools/sea.mjs) : serveur protégé regroupé
// en un script CommonJS (esbuild) → blob SEA produit par ce node (même version que le node.exe cible)
// → node.exe officiel de nodejs.org (empreinte SHA-256
// vérifiée, gardé dans .cache/exe) sans sa signature, avec le nom, la version et l'icône du
// simulateur (resedit) → blob injecté (postject) → signature Authenticode si un certificat est
// donné (tools/signature.mjs). Sans certificat reconnu par Windows, SmartScreen demande
// « Informations complémentaires » → « Exécuter quand même » (expliqué dans le LISEZMOI).
// ----------------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NtExecutable, NtExecutableResource, Data, Resource } from 'resedit';
import postject from 'postject';
import { makeZip } from './zip.mjs';
import { mdpRefuse, mdpFaible } from './protege.mjs';
import { signer, signatureDemandee, certificats, fixeChecksum } from './signature.mjs';
import { ROOT, FUSE, V, sha256, mb, blobSEA, telechargeNode, rienEnClair, licences, lanceEtInterroge } from './sea.mjs';

const CACHE = path.join(ROOT, '.cache/exe');
const PAGE = path.join(ROOT, 'dist/index-lan.html');
const EXE = path.join(ROOT, 'dist/TIEE-Simulator.exe');
const KIT = path.join(ROOT, 'dist/TIEE-Simulator-partage.zip');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

if (!fs.existsSync(PAGE)) { console.error(`${path.relative(ROOT, PAGE)} introuvable : lancez d'abord node tools/build.mjs`); process.exit(1); }
const MDP = process.env.TIEE_MDP || '';
if (mdpRefuse(MDP)) { console.error('TIEE_MDP : ' + mdpRefuse(MDP) + '.\nL\'exécutable chiffre la page avec ce mot de passe : sans lui, pas d\'exécutable.'); process.exit(1); }
if (mdpFaible(MDP)) console.log((process.env.GITHUB_ACTIONS ? '::warning title=Mot de passe court::' : 'attention : ') + mdpFaible(MDP));
fs.mkdirSync(CACHE, { recursive: true });

// ---------------- 1 et 2. le serveur protégé en un seul script CommonJS, le blob SEA ----------------
const blobData = await blobSEA({
  page: fs.readFileSync(PAGE, 'utf8'), mdp: MDP, cache: CACHE, exe: 'TIEE-Simulator.exe',
  // lancé d'un double-clic : ouvrir la page, et garder la fenêtre ouverte sur une erreur
  banner: 'process.argv.splice(2, 0, "--ouvrir", "--exe");',
});

// ---------------- 3. node.exe officiel, même version ----------------
const given = arg('--node-exe');
const bin = given ? fs.readFileSync(given) : await telechargeNode(CACHE, 'win-x64/node.exe');

// ---------------- 4. signature retirée (elle ne vaudrait plus rien), blob injecté ----------------
// Ordre voulu : postject (LIEF) place les ressources dans une dernière section ; resedit peut
// ensuite les modifier sans déplacer les autres sections (l'inverse laisse une section dont la
// taille sur disque déborde sur la suivante).
const plain = NtExecutable.from(bin, { ignoreCert: true });
fs.writeFileSync(EXE, Buffer.from(plain.generate()));
await postject.inject(EXE, 'NODE_SEA_BLOB', blobData, { sentinelFuse: FUSE });

// ---------------- 5. nom, version et icône du simulateur ----------------
const exe = NtExecutable.from(fs.readFileSync(EXE));
const res = NtExecutableResource.from(exe);
const [vi] = Resource.VersionInfo.fromEntries(res.entries);
const [lang] = vi.getAllLanguagesForStringValues();
const nodeVer = vi.getStringValues(lang).ProductVersion || '';
if (nodeVer.replace(/^v?/, 'v') !== V) throw new Error(`node.exe ${nodeVer} ≠ node ${V} : le blob ne fonctionnerait pas (lancez ce script avec la même version)`);
const ver = PKG.version.split('.').map(Number);
vi.setFileVersion(ver[0], ver[1] || 0, ver[2] || 0, 0, lang.lang);
vi.setProductVersion(ver[0], ver[1] || 0, ver[2] || 0, 0, lang.lang);
vi.setStringValues(lang, {
  FileDescription: 'TIEE Simulator', ProductName: 'TIEE Simulator', InternalName: 'TIEE-Simulator', OriginalFilename: 'TIEE-Simulator.exe',
  CompanyName: 'BTS Audiovisuel, lycée Henri-Martin (Saint-Quentin)', FileVersion: PKG.version, ProductVersion: PKG.version,
  LegalCopyright: `Simulation non officielle, sans lien avec le club. Contient Node.js ${V} (licence MIT, © contributeurs de Node.js).`,
  Comments: 'Simulateur 3D de car régie pour la formation des techniciens : serveur réseau local et page du simulateur.',
});
vi.outputToResourceEntries(res.entries);
const ico = Data.IconFile.from(fs.readFileSync(path.join(ROOT, 'lan/car-regie-3d.ico')));
for (const g of Resource.IconGroupEntry.fromEntries(res.entries)) Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map((i) => i.data));
res.outputResource(exe, false, true); // la section se réduit avec son contenu (icône plus légère)
fs.writeFileSync(EXE, Buffer.from(exe.generate()));

// contrôle : blob présent et intact, fusible activé, sections disjointes et alignées, image complète
let out = fs.readFileSync(EXE);
const fin = NtExecutable.from(out);
const blobRes = NtExecutableResource.from(fin).entries.find((e) => e.type === 10 && String(e.id).toUpperCase() === 'NODE_SEA_BLOB');
if (!blobRes || !Buffer.from(blobRes.bin).equals(blobData)) throw new Error('ressource NODE_SEA_BLOB absente ou altérée');
if (!out.includes(FUSE + ':1')) throw new Error('fusible SEA non activé');
const align = fin.getSectionAlignment(), up = (n) => Math.ceil(n / align) * align;
const secs = fin.getAllSections().map((x) => x.info).sort((a, b) => a.virtualAddress - b.virtualAddress);
secs.forEach((x, i) => {
  const end = x.virtualAddress + up(Math.max(x.virtualSize, x.sizeOfRawData));
  const next = i + 1 < secs.length ? secs[i + 1].virtualAddress : fin.newHeader.optionalHeader.sizeOfImage;
  if (end > next) throw new Error(`section ${x.name} : déborde sur la suivante (${end.toString(16)} > ${next.toString(16)})`);
});
rienEnClair(out, MDP, 'l\'exécutable');

// ---------------- 5 bis. signature numérique (si un certificat est donné) ----------------
let signe = false;
if (signatureDemandee()) {
  const r = await signer(out);
  out = r.exe; signe = true;
  fs.writeFileSync(EXE, out);
  const blobSigne = NtExecutableResource.from(NtExecutable.from(out, { ignoreCert: true })).entries.find((e) => e.type === 10 && String(e.id).toUpperCase() === 'NODE_SEA_BLOB');
  if (!blobSigne || !Buffer.from(blobSigne.bin).equals(blobData)) throw new Error('signature : ressource NODE_SEA_BLOB altérée');
  console.log(`signé : ${r.sujet}${r.horodate ? ' (horodaté)' : ' (sans horodatage : la signature ne vaudra plus après l\'expiration du certificat)'}`);
} else console.log('non signé : donnez TIEE_SIGN_CERT et TIEE_SIGN_KEY pour signer (tools/signature.mjs)');
fixeChecksum(out); fs.writeFileSync(EXE, out);
console.log('dist/TIEE-Simulator.exe', mb(out.length), '· sha256', sha256(out).slice(0, 16));

// ---------------- 6. le kit à partager ----------------
const crlf = (s) => s.replace(/\r?\n/g, '\r\n');
const dir = 'TIEE-Simulator/';
const kit = makeZip([
  { name: dir + 'TIEE-Simulator.exe', data: out },
  { name: dir + 'LISEZMOI.txt', data: crlf(fs.readFileSync(path.join(ROOT, 'partage/LISEZMOI.txt'), 'utf8')) },
  { name: dir + 'LICENCES.txt', data: crlf(await licences(CACHE, 'TIEE-Simulator.exe')) },
]);
fs.writeFileSync(KIT, kit);
console.log('dist/TIEE-Simulator-partage.zip', mb(kit.length));

// ---------------- 7. (option) le même blob dans le node de cette machine, lancé pour de vrai ----------------
if (process.argv.includes('--verifier')) {
  if (process.platform !== 'linux') { console.error('--verifier : Linux seulement'); process.exit(1); }
  const test = path.join(CACHE, 'car-regie-3d-linux');
  fs.copyFileSync(process.execPath, test); fs.chmodSync(test, 0o755);
  await postject.inject(test, 'NODE_SEA_BLOB', blobData, { sentinelFuse: FUSE });
  const { ok, log } = await lanceEtInterroge({ cmd: [test], mdp: MDP, cache: CACHE, fenetre: 'Fermez cette fenêtre' });
  // la signature, vérifiée par un outil indépendant (osslsigncode), si elle est là et l'outil aussi
  if (signe) {
    let tool = ''; try { tool = execFileSync('osslsigncode', ['--version'], { encoding: 'utf8' }); } catch (e) { /* absent */ }
    if (!tool) console.log('—   signature : osslsigncode absent, vérification sautée');
    else {
      const ca = path.join(CACHE, 'chaine.pem'); fs.writeFileSync(ca, certificats().map((c) => c.toString()).join('\n'));
      let v;
      try { v = execFileSync('osslsigncode', ['verify', '-in', EXE, '-CAfile', ca, '-TSA-CAfile', '/etc/ssl/certs/ca-certificates.crt'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { v = String(e.stdout || '') + String(e.stderr || ''); }
      ok.push(['signature Authenticode valide (osslsigncode)', /Signature verification: ok/.test(v)]);
      if (!/Signature verification: ok/.test(v)) console.error(v);
    }
  }
  for (const [n, v] of ok) console.log(v ? 'OK  ' : 'FAIL', n);
  if (ok.some(([, v]) => !v)) { console.error(log); process.exit(1); }
}
