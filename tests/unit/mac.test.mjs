// Application macOS (tools/mac.mjs) : les pièces écrites sans outil Apple (tools/macapp.mjs) :
// Info.plist, icône .icns versionnée, lanceur, bannière du serveur (dossier de travail, options du
// double-clic), et le contrôle « rien en clair » commun avec l'exécutable Windows (tools/sea.mjs).
// La construction elle-même (codesign, lipo, hdiutil) est vérifiée sur un Mac : tâche « mac » de
// .github/workflows/exe.yml (node tools/mac.mjs --verifier).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { APP, LANCEUR, SERVEUR, ICONE, IDENTIFIANT, DOSSIER, BANNIERE, LANCEUR_C, LANCER_SH, ICNS_TAILLES, infoPlist, icns, lireIcns } from '../../tools/macapp.mjs';
import { rienEnClair } from '../../tools/sea.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const cle = (plist, k) => { const m = new RegExp(`<key>${k}</key>\\s*<(string|true|false)\\s*/?>([^<]*)`).exec(plist); return m ? (m[1] === 'string' ? m[2] : m[1]) : undefined; };

test('Info.plist : nom, exécutable, icône, version, macOS minimum', () => {
  const p = infoPlist({ version: '19.15.0', node: 'v22.22.0' });
  assert.match(p, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<!DOCTYPE plist/);
  assert.equal(cle(p, 'CFBundleExecutable'), LANCEUR);
  assert.equal(cle(p, 'CFBundleIconFile'), ICONE);
  assert.equal(cle(p, 'CFBundleIdentifier'), IDENTIFIANT);
  assert.match(IDENTIFIANT, /^[A-Za-z0-9.-]+$/); // seuls caractères admis par Apple
  assert.equal(cle(p, 'CFBundlePackageType'), 'APPL');
  assert.equal(cle(p, 'CFBundleShortVersionString'), '19.15.0');
  assert.equal(cle(p, 'LSMinimumSystemVersion'), '11.0');
  assert.equal(cle(p, 'NSHighResolutionCapable'), 'true');
  assert.match(cle(p, 'NSHumanReadableCopyright'), /Simulation non officielle, sans lien avec le club/);
  // autant de clés que de valeurs, rien de mal échappé
  assert.equal(p.match(/<key>/g).length, p.match(/<(string|true|false)\b/g).length);
  assert.doesNotMatch(p.replace(/<\/?(plist|dict|key|string)[^>]*>|<true\/>|<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, ''), /[<>]/);
  assert.equal(APP, 'TIEE Simulator.app');
});

test('icône .icns : écrite puis relue, et celle du dépôt complète', () => {
  const png = (s) => { const b = Buffer.alloc(33); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(s, 16); b.writeUInt32BE(s, 20); return b; };
  const fait = icns(Object.fromEntries(ICNS_TAILLES.map((s) => [s, png(s)])));
  const lu = lireIcns(fait);
  assert.deepEqual(lu.map(([t]) => t), ['ic11', 'ic12', 'ic07', 'ic13', 'ic08', 'ic14', 'ic09', 'ic10']);
  assert.deepEqual(lu.map(([, s]) => s), [32, 64, 128, 256, 256, 512, 512, 1024]);
  assert.throws(() => icns({ 32: png(32) }), /manquante/);
  assert.throws(() => lireIcns(fait.subarray(0, fait.length - 4)), /invalide/);
  // le fichier versionné (node tools/icon.mjs) : de vraies images PNG, aux bonnes tailles
  const vrai = lireIcns(fs.readFileSync(path.join(ROOT, 'lan/car-regie-3d.icns')));
  assert.deepEqual(vrai, lu);
});

test('lanceur : passe la main à lancer.sh, qui ouvre le serveur dans le Terminal', () => {
  assert.match(LANCEUR_C, /_NSGetExecutablePath/);
  assert.match(LANCEUR_C, /\.\.\/Resources\/lancer\.sh/);
  assert.match(LANCER_SH, /^#!\/bin\/bash\n/);
  assert.ok(LANCER_SH.includes(`open -a Terminal "$APP/Contents/MacOS/${SERVEUR}"`));
  assert.match(LANCER_SH, /AppTranslocation/);              // lancée depuis l'image disque : glisser dans Applications d'abord
  assert.match(LANCER_SH, /xattr -dr com\.apple\.quarantine "\$APP"/);
  execFileSync('bash', ['-n'], { input: LANCER_SH });       // syntaxe
});

test('bannière : dossier « TIEE Simulator » du dossier personnel, options du double-clic', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tiee-mac-'));
  try {
    const out = execFileSync(process.execPath, ['-e', BANNIERE + '\nconsole.log(JSON.stringify([process.cwd(), process.argv.slice(2)]))', 'x', '--port', '9000'], { cwd: os.tmpdir(), env: { ...process.env, HOME: home }, encoding: 'utf8' });
    const [cwd, args] = JSON.parse(out);
    assert.equal(fs.realpathSync(cwd), fs.realpathSync(path.join(home, DOSSIER)));
    assert.deepEqual(args, ['--ouvrir', '--exe', '--port', '9000']); // argv[1] : l'exécutable lui-même dans une SEA
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('rien en clair : ni la page du simulateur, ni le mot de passe', () => {
  const mdp = 'la régie mobile du lycée';
  assert.doesNotThrow(() => rienEnClair(Buffer.from('données chiffrées'), mdp, 'x'));
  assert.throws(() => rienEnClair(Buffer.from('new THREE.WebGLRenderer()'), mdp, 'x'), /en clair/);
  assert.throws(() => rienEnClair(Buffer.from('…' + mdp + '…'), mdp, 'x'), /mot de passe/);
  assert.throws(() => rienEnClair(Buffer.from(mdp, 'utf16le'), mdp, 'x'), /mot de passe/);
});
