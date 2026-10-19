// ----------------------------------------------------------------------------------
// Version à partager : Car-regie-3D.exe et le kit dist/Car-regie-3D-partage.zip.
// L'exécutable est le serveur réseau local (page du simulateur incluse) dans un exécutable
// Node.js autonome (« single executable application ») : on double-clique, le navigateur
// s'ouvre sur le simulateur, et les autres ordinateurs du réseau local peuvent rejoindre la
// partie à l'adresse affichée. Rien à installer.
//
//   node tools/build.mjs && node tools/exe.mjs
//   node tools/exe.mjs --node-exe chemin\node.exe   node.exe déjà téléchargé (même version que node)
//   node tools/exe.mjs --verifier                   en plus : même blob dans le node de cette
//                                                   machine (Linux), lancé et interrogé
//
// Étapes : serveur regroupé en un script CommonJS (esbuild) → blob SEA produit par ce node
// (même version que le node.exe cible) → node.exe officiel de nodejs.org (empreinte SHA-256
// vérifiée, gardé dans .cache/exe) sans sa signature, avec le nom, la version et l'icône du
// simulateur (resedit) → blob injecté (postject).
// L'exécutable n'est pas signé : à la première ouverture, Windows SmartScreen demande
// « Informations complémentaires » → « Exécuter quand même » (expliqué dans le LISEZMOI).
// ----------------------------------------------------------------------------------
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { NtExecutable, NtExecutableResource, Data, Resource } from 'resedit';
import postject from 'postject';
import { makeZip } from './zip.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache/exe');
const SRV = path.join(ROOT, 'dist/car-regie-serveur-lan.mjs');
const HTML = path.join(ROOT, 'dist/Car-regie-3D.html');
const EXE = path.join(ROOT, 'dist/Car-regie-3D.exe');
const KIT = path.join(ROOT, 'dist/Car-regie-3D-partage.zip');
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const V = process.version; // le blob ne fonctionne qu'avec la même version de Node que node.exe
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const mb = (n) => (n / 1048576).toFixed(1) + ' Mo';

for (const f of [SRV, HTML]) if (!fs.existsSync(f)) { console.error(`${path.relative(ROOT, f)} introuvable : lancez d'abord node tools/build.mjs`); process.exit(1); }
fs.mkdirSync(CACHE, { recursive: true });

// ---------------- 1. le serveur en un seul script CommonJS (format des exécutables Node 22) ----------------
const main = path.join(CACHE, 'serveur.cjs');
await esbuild.build({
  entryPoints: [SRV], outfile: main, bundle: true, platform: 'node', format: 'cjs', target: 'node22', legalComments: 'none', logLevel: 'warning',
  define: { 'import.meta.url': '"file:///Car-regie-3D.exe"' }, // la page est intégrée : le chemin ne sert pas
  // lancé d'un double-clic : ouvrir la page, et garder la fenêtre ouverte sur une erreur
  banner: { js: 'process.argv.splice(2, 0, "--ouvrir", "--exe");' },
});

// ---------------- 2. le blob SEA ----------------
const blob = path.join(CACHE, 'sea.blob');
const seaCfg = path.join(CACHE, 'sea-config.json');
fs.writeFileSync(seaCfg, JSON.stringify({ main, output: blob, disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false }));
execFileSync(process.execPath, ['--experimental-sea-config', seaCfg], { stdio: ['ignore', 'ignore', 'inherit'] });
const blobData = fs.readFileSync(blob);
console.log('blob SEA', mb(blobData.length), '(Node ' + V + ')');

// ---------------- 3. node.exe officiel, même version ----------------
async function nodeExe() {
  const given = arg('--node-exe');
  if (given) return fs.readFileSync(given);
  const file = path.join(CACHE, `node-${V}-win-x64.exe`), sumFile = file + '.sha256';
  if (fs.existsSync(file) && fs.existsSync(sumFile) && sha256(fs.readFileSync(file)) === fs.readFileSync(sumFile, 'utf8').trim()) return fs.readFileSync(file);
  const base = `https://nodejs.org/dist/${V}/`;
  const sums = await (await fetch(base + 'SHASUMS256.txt')).text();
  const want = (sums.split('\n').find((l) => l.trim().endsWith(' win-x64/node.exe')) || '').split(/\s+/)[0];
  if (!want) throw new Error(`empreinte de win-x64/node.exe absente de ${base}SHASUMS256.txt`);
  console.log(`téléchargement de node.exe ${V}…`);
  const r = await fetch(base + 'win-x64/node.exe');
  if (!r.ok) throw new Error(`node.exe : HTTP ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  if (sha256(b) !== want) throw new Error('node.exe téléchargé : empreinte SHA-256 incorrecte');
  fs.writeFileSync(file, b); fs.writeFileSync(sumFile, want);
  return b;
}
const bin = await nodeExe();

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
  FileDescription: 'Car régie 3D', ProductName: 'Car régie 3D', InternalName: 'Car-regie-3D', OriginalFilename: 'Car-regie-3D.exe',
  CompanyName: 'Car régie 3D (formation)', FileVersion: PKG.version, ProductVersion: PKG.version,
  LegalCopyright: `Simulation non officielle, sans lien avec le club. Contient Node.js ${V} (licence MIT, © contributeurs de Node.js).`,
  Comments: 'Simulateur 3D de car régie pour la formation des techniciens : serveur réseau local et page du simulateur.',
});
vi.outputToResourceEntries(res.entries);
const ico = Data.IconFile.from(fs.readFileSync(path.join(ROOT, 'lan/car-regie-3d.ico')));
for (const g of Resource.IconGroupEntry.fromEntries(res.entries)) Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map((i) => i.data));
res.outputResource(exe, false, true); // la section se réduit avec son contenu (icône plus légère)
fs.writeFileSync(EXE, Buffer.from(exe.generate()));

// contrôle : blob présent et intact, fusible activé, sections disjointes et alignées, image complète
const out = fs.readFileSync(EXE);
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
console.log('dist/Car-regie-3D.exe', mb(out.length), '· sha256', sha256(out).slice(0, 16));

// ---------------- 6. le kit à partager ----------------
const crlf = (s) => s.replace(/\r?\n/g, '\r\n');
const licFile = path.join(CACHE, `LICENSE-node-${V}.txt`);
if (!fs.existsSync(licFile)) fs.writeFileSync(licFile, await (await fetch(`https://raw.githubusercontent.com/nodejs/node/${V}/LICENSE`)).text());
const licences = ['three.js', '========', fs.readFileSync(path.join(ROOT, 'node_modules/three/LICENSE'), 'utf8'), '', `Node.js ${V} (inclus dans Car-regie-3D.exe)`, '=================================', fs.readFileSync(licFile, 'utf8')].join('\n');
const dir = 'Car-regie-3D/';
const kit = makeZip([
  { name: dir + 'Car-regie-3D.html', data: fs.readFileSync(HTML) },
  { name: dir + 'Car-regie-3D.exe', data: out },
  { name: dir + 'LISEZMOI.txt', data: crlf(fs.readFileSync(path.join(ROOT, 'partage/LISEZMOI.txt'), 'utf8')) },
  { name: dir + 'LICENCES.txt', data: crlf(licences) },
]);
fs.writeFileSync(KIT, kit);
console.log('dist/Car-regie-3D-partage.zip', mb(kit.length));

// ---------------- 7. (option) le même blob dans le node de cette machine, lancé pour de vrai ----------------
if (process.argv.includes('--verifier')) {
  if (process.platform !== 'linux') { console.error('--verifier : Linux seulement'); process.exit(1); }
  const test = path.join(CACHE, 'car-regie-3d-linux');
  fs.copyFileSync(process.execPath, test); fs.chmodSync(test, 0o755);
  await postject.inject(test, 'NODE_SEA_BLOB', blobData, { sentinelFuse: FUSE });
  const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = /** @type {net.AddressInfo} */ (s.address()).port; s.close(() => r(p)); }); });
  const work = fs.mkdtempSync(path.join(CACHE, 'run-'));
  const p = spawn(test, ['--port', String(port)], { cwd: work, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_OPTIONS: '' } });
  let log = ''; p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
  const ok = [];
  try {
    for (let i = 0; i < 100 && !log.includes('Sur cet ordinateur'); i++) await new Promise((r) => setTimeout(r, 100));
    ok.push(['serveur démarré', log.includes(`http://localhost:${port}`)]);
    const page = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    ok.push(['page servie, three.js intégré', page.includes('window.CARREGIE_LAN') && page.length > 1e6]);
    const parties = await (await fetch(`http://127.0.0.1:${port}/api/parties`)).json();
    ok.push(['liste des parties', Array.isArray(parties.parties)]);
    ok.push(['options du double-clic actives', log.includes('Fermez cette fenêtre')]);
  } finally { p.kill(); fs.rmSync(work, { recursive: true, force: true }); }
  for (const [n, v] of ok) console.log(v ? 'OK  ' : 'FAIL', n);
  if (ok.some(([, v]) => !v)) { console.error(log); process.exit(1); }
}
