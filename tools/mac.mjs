// ----------------------------------------------------------------------------------
// Version à partager pour macOS : dist/TIEE-Simulator-mac.dmg, qui contient « TIEE Simulator.app »
// (Apple silicon et Intel, macOS 11 ou plus récent), son LISEZMOI et les licences. Même principe que
// TIEE-Simulator.exe (tools/exe.mjs, pièces communes dans tools/sea.mjs) : le serveur réseau local et la
// page chiffrée par le mot de passe dans un Node.js autonome. On glisse l'application dans Applications,
// on l'ouvre : une fenêtre du Terminal affiche le serveur, le navigateur s'ouvre sur « Accès réservé ».
//
//   TIEE_MDP='…' node tools/mac.mjs              (après node tools/build.mjs, sur un Mac)
//   TIEE_MDP='…' node tools/mac.mjs --verifier   en plus : serveur lancé et interrogé (Apple silicon,
//                                                et Intel par Rosetta si présent), signature, image disque
// Sur GitHub : tâche « mac » de .github/workflows/exe.yml (machine macOS).
// Hors macOS, le script s'arrête après l'injection du blob (contrôle seulement) : la signature
// (codesign), l'exécutable universel (lipo), le lanceur (clang) et l'image disque (hdiutil) sont
// des outils d'Apple.
//
// Signature : « ad hoc » (sans certificat), obligatoire sur Apple silicon. Sans certificat Developer ID
// ni notarisation par Apple (compte développeur payant), macOS bloque la première ouverture :
// Réglages Système → Confidentialité et sécurité → « Ouvrir quand même » (expliqué dans le LISEZMOI).
// ----------------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import postject from 'postject';
import { mdpRefuse, mdpFaible } from './protege.mjs';
import { ROOT, FUSE, V, sha256, mb, blobSEA, telechargeNode, rienEnClair, licences, lanceEtInterroge } from './sea.mjs';
import { APP, LANCEUR, SERVEUR, ICONE, IDENTIFIANT, MACOS_MIN, DOSSIER, BANNIERE, LANCEUR_C, LANCER_SH, infoPlist, lireIcns } from './macapp.mjs';

const CACHE = path.join(ROOT, '.cache/mac');
const PAGE = path.join(ROOT, 'dist/index-lan.html');
const DMG = path.join(ROOT, 'dist/TIEE-Simulator-mac.dmg');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const SUR_MAC = process.platform === 'darwin';
const VERIFIER = process.argv.includes('--verifier');
const ARCHS = ['arm64', 'x64'];
const run = (cmd, args, o = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: [o.input ? 'pipe' : 'ignore', 'pipe', 'pipe'], ...o });

if (!fs.existsSync(PAGE)) { console.error(`${path.relative(ROOT, PAGE)} introuvable : lancez d'abord node tools/build.mjs`); process.exit(1); }
const MDP = process.env.TIEE_MDP || '';
if (mdpRefuse(MDP)) { console.error('TIEE_MDP : ' + mdpRefuse(MDP) + '.\nL\'application chiffre la page avec ce mot de passe : sans lui, pas d\'application.'); process.exit(1); }
if (mdpFaible(MDP)) console.log((process.env.GITHUB_ACTIONS ? '::warning title=Mot de passe court::' : 'attention : ') + mdpFaible(MDP));
fs.mkdirSync(CACHE, { recursive: true });

// ---------------- 1. le serveur protégé et son blob SEA (dossier de travail dans le dossier personnel) ----------------
const blobData = await blobSEA({ page: fs.readFileSync(PAGE, 'utf8'), mdp: MDP, cache: CACHE, exe: APP, banner: BANNIERE });

// ---------------- 2. node officiel de nodejs.org pour chaque processeur, blob injecté ----------------
const minces = [];
for (const a of ARCHS) {
  const dossier = `node-${V}-darwin-${a}`;
  const tgz = await telechargeNode(CACHE, `${dossier}.tar.gz`);
  const ext = path.join(CACHE, 'node-' + a); fs.rmSync(ext, { recursive: true, force: true }); fs.mkdirSync(ext);
  run('tar', ['-xzf', '-', '-C', ext, `${dossier}/bin/node`], { input: tgz, maxBuffer: 1 << 30 });
  const f = path.join(CACHE, `${SERVEUR}-${a}`);
  fs.copyFileSync(path.join(ext, dossier, 'bin/node'), f); fs.chmodSync(f, 0o755);
  if (SUR_MAC) run('codesign', ['--remove-signature', f]); // la signature de Node.js ne vaudrait plus rien
  await postject.inject(f, 'NODE_SEA_BLOB', blobData, { sentinelFuse: FUSE, machoSegmentName: 'NODE_SEA' });
  const b = fs.readFileSync(f);
  if (!b.includes(FUSE + ':1')) throw new Error(`${a} : fusible SEA non activé`);
  rienEnClair(b, MDP, `le serveur ${a}`);
  if (SUR_MAC) run('codesign', ['--sign', '-', '--force', '--identifier', IDENTIFIANT + '.serveur', f]);
  minces.push(f);
  console.log(`serveur ${a}`, mb(b.length));
}
if (!SUR_MAC) { console.log('hors macOS : arrêt avant la signature, l\'exécutable universel et l\'image disque (outils d\'Apple)'); process.exit(0); }

// ---------------- 3. l'application ----------------
const STAGE = path.join(CACHE, 'dmg');
fs.rmSync(STAGE, { recursive: true, force: true });
const app = path.join(STAGE, APP), contents = path.join(app, 'Contents');
const macos = path.join(contents, 'MacOS'), res = path.join(contents, 'Resources');
fs.mkdirSync(macos, { recursive: true }); fs.mkdirSync(res, { recursive: true });
const serveur = path.join(macos, SERVEUR);
run('lipo', ['-create', '-output', serveur, ...minces]);
run('codesign', ['--sign', '-', '--force', '--identifier', IDENTIFIANT + '.serveur', serveur]);
const src = path.join(CACHE, 'lanceur.c'); fs.writeFileSync(src, LANCEUR_C);
run('clang', ['-arch', 'arm64', '-arch', 'x86_64', `-mmacosx-version-min=${MACOS_MIN}`, '-Os', '-Wall', '-o', path.join(macos, LANCEUR), src]);
fs.writeFileSync(path.join(res, 'lancer.sh'), LANCER_SH, { mode: 0o755 });
fs.copyFileSync(path.join(ROOT, 'lan/car-regie-3d.icns'), path.join(res, ICONE));
fs.writeFileSync(path.join(contents, 'Info.plist'), infoPlist({ version: PKG.version, node: V }));
fs.writeFileSync(path.join(contents, 'PkgInfo'), 'APPL????');
run('plutil', ['-lint', path.join(contents, 'Info.plist')]);
run('codesign', ['--sign', '-', '--force', '--identifier', IDENTIFIANT, app]); // lanceur signé, ressources scellées
run('codesign', ['--verify', '--deep', '--strict', app]);
const uni = fs.readFileSync(serveur);
rienEnClair(uni, MDP, 'l\'application');
console.log(APP, mb(uni.length), '·', run('lipo', ['-archs', serveur]).trim());

// ---------------- 4. l'image disque : l'application, un raccourci vers Applications, LISEZMOI, licences ----------------
fs.symlinkSync('/Applications', path.join(STAGE, 'Applications'));
fs.writeFileSync(path.join(STAGE, 'LISEZMOI.txt'), fs.readFileSync(path.join(ROOT, 'partage/LISEZMOI-mac.txt'), 'utf8'));
fs.writeFileSync(path.join(STAGE, 'LICENCES.txt'), await licences(CACHE, 'TIEE Simulator.app'));
fs.rmSync(DMG, { force: true });
// hdiutil échoue parfois sur les machines d'intégration (« Resource busy ») : trois essais
for (let i = 1; ; i++) {
  try { run('hdiutil', ['create', '-volname', 'TIEE Simulator', '-srcfolder', STAGE, '-fs', 'HFS+', '-format', 'UDZO', '-ov', DMG]); break; } catch (e) {
    if (i >= 3) throw e;
    console.log(`hdiutil : essai ${i} manqué (${String(e.stderr || e.message).trim()}), nouvel essai…`);
    await new Promise((r) => setTimeout(r, 5000 * i));
  }
}
console.log(path.relative(ROOT, DMG), mb(fs.statSync(DMG).size), '· sha256', sha256(fs.readFileSync(DMG)).slice(0, 16));

// ---------------- 5. (option) vérifier pour de vrai ----------------
if (VERIFIER) {
  /** @type {[string, boolean][]} */
  const ok = [];
  let log = '';
  const essaie = (f) => { try { f(); return true; } catch (e) { log += String(e.stderr || e.message) + '\n'; return false; } };
  ok.push(['exécutable universel (Apple silicon et Intel)', /arm64/.test(run('lipo', ['-archs', serveur])) && /x86_64/.test(run('lipo', ['-archs', serveur]))]);
  ok.push(['lanceur universel', /arm64/.test(run('lipo', ['-archs', path.join(macos, LANCEUR)])) && /x86_64/.test(run('lipo', ['-archs', path.join(macos, LANCEUR)]))]);
  ok.push(['script du lanceur lisible par bash', essaie(() => run('bash', ['-n', path.join(res, 'lancer.sh')]))]);
  ok.push(['icône lisible par iconutil', essaie(() => run('iconutil', ['-c', 'iconset', '-o', path.join(CACHE, 'controle.iconset'), path.join(res, ICONE)])) && lireIcns(fs.readFileSync(path.join(res, ICONE))).length > 0]);
  // le serveur de l'application, lancé pour de vrai (sur ce processeur, puis Intel par Rosetta)
  const r = await lanceEtInterroge({ cmd: [serveur], mdp: MDP, cache: CACHE, fenetre: 'Fermez cette fenêtre', dossier: DOSSIER });
  for (const [n, v] of r.ok) ok.push([`${process.arch} : ${n}`, v]);
  if (r.ok.some(([, v]) => !v)) log += r.log;
  const autre = process.arch === 'arm64' ? 'x86_64' : 'arm64';
  if (essaie(() => run('arch', [`-${autre}`, '/usr/bin/true']))) {
    const r2 = await lanceEtInterroge({ cmd: ['arch', `-${autre}`, serveur], mdp: MDP, cache: CACHE, fenetre: 'Fermez cette fenêtre', dossier: DOSSIER, attente: 180 });
    for (const [n, v] of r2.ok) ok.push([`${autre} : ${n}`, v]);
    if (r2.ok.some(([, v]) => !v)) log += r2.log;
  } else console.log(`—   ${autre} : impossible à lancer sur cette machine (Rosetta absent), vérification sautée`);
  // l'image disque : intègre, et l'application qu'elle contient toujours signée
  ok.push(['image disque intègre (hdiutil verify)', essaie(() => run('hdiutil', ['verify', DMG]))]);
  const mp = fs.mkdtempSync(path.join(CACHE, 'montage-'));
  if (essaie(() => run('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mp, DMG]))) {
    ok.push(['image disque : application signée, LISEZMOI, raccourci Applications', essaie(() => run('codesign', ['--verify', '--deep', '--strict', path.join(mp, APP)]))
      && fs.existsSync(path.join(mp, 'LISEZMOI.txt')) && fs.readlinkSync(path.join(mp, 'Applications')) === '/Applications']);
    essaie(() => run('hdiutil', ['detach', mp]));
  } else ok.push(['image disque montée', false]);
  for (const [n, v] of ok) console.log(v ? 'OK  ' : 'FAIL', n);
  if (ok.some(([, v]) => !v)) { console.error(log); process.exit(1); }
}
