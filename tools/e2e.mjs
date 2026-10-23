// ----------------------------------------------------------------------------------
// Non-régression de bout en bout : lance les suites de tests/e2e une par une (le rendu
// logiciel occupe tous les cœurs : en parallèle, elles se ralentiraient au point d'échouer),
// garde le journal de chacune dans test-results/<suite>.log et affiche un bilan.
//
//   node tools/e2e.mjs                 toutes les suites
//   node tools/e2e.mjs reseau session  seulement celles dont le nom commence ainsi
//   node tools/e2e.mjs --list          liste des suites
//   node tools/e2e.mjs --build         reconstruit la page avant
// ----------------------------------------------------------------------------------
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RES = path.join(ROOT, 'test-results');
// [nom, script, arguments après le dossier de captures, durée max (min)]
const SUITES = [
  ['atelier', 'atelier', [], 20],
  ['direct-commut', 'direct', ['keys'], 20],
  ['direct-son', 'direct', ['audio'], 20],
  ['direct-relecture', 'direct', ['review'], 20],
  ['direct-mobile', 'direct', ['mobile'], 20],
  ['direct-images', 'direct', ['visual'], 25],
  ['session', 'session', [], 25],
  ['reseau-local', 'reseau-local', [], 30],
  ['exploitation-hd', 'exploitation', ['hd'], 30],
  ['exploitation-ip', 'exploitation', ['ip'], 30],
  ['exploitation-scenario', 'exploitation', ['scenario'], 25],
  ['exploitation-pannes', 'exploitation', ['ops'], 25],
  ['synoptiques-sdi', 'synoptiques', ['sdi'], 15],
  ['synoptiques-ip', 'synoptiques', ['ip'], 15],
  ['acces-postes', 'acces-postes', [], 10],
  ['reseau-ip', 'reseau-ip', ['HD'], 25],
  ['parcours-ip', 'parcours-ip', ['HD'], 25],
  ['mobile', 'mobile', [], 15],
  ['interfaces', 'interfaces', [], 25],
  ['chef', 'chef', [], 20],
  ['fichier', 'fichier', [], 15],
  ['navigateurs', 'navigateurs', [], 15],
  ['navigation', 'navigation', [], 20],
  ['accessibilite', 'accessibilite', [], 25],
  ['ctrlnet', 'ctrlnet', [], 20],
  ['prism', 'prism', [], 20],
  ['videohub', 'videohub', [], 30],
  ['reseau-ops', 'reseau-ops', [], 25],
  ['reseau-termes', 'termes', [], 20],
  ['cours', 'cours', [], 20],
  ['camera', 'camera', [], 25],
  ['entrepot', 'entrepot', [], 25],
  ['chef-postes', 'chef-postes', [], 60],
  ['jeu', 'jeu', [], 20],
];

const args = process.argv.slice(2);
if (args.includes('--list')) { for (const [n, s, a] of SUITES) console.log(n.padEnd(24), `tests/e2e/${s}.mjs ${a.join(' ')}`); process.exit(0); }
const want = args.filter((a) => !a.startsWith('--'));
const todo = SUITES.filter(([n]) => !want.length || want.some((w) => n.startsWith(w)));
if (!todo.length) { console.error('Aucune suite ne correspond à : ' + want.join(', ')); process.exit(2); }

if (args.includes('--build') || !fs.existsSync(path.join(ROOT, 'dist/index.html')) || !fs.existsSync(path.join(ROOT, 'dist/car-regie-serveur-lan.mjs')) || !fs.existsSync(path.join(ROOT, 'dist/Car-regie-3D.html'))) {
  console.log('Construction de la page…');
  execFileSync(process.execPath, ['tools/build.mjs'], { cwd: ROOT, stdio: 'inherit' });
}
fs.mkdirSync(RES, { recursive: true });

const fmt = (ms) => `${Math.floor(ms / 60000)} min ${String(Math.round(ms / 1000) % 60).padStart(2, '0')} s`;
function run([name, script, extra, maxMin]) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const log = fs.createWriteStream(path.join(RES, name + '.log'));
    const child = spawn(process.execPath, [`tests/e2e/${script}.mjs`, path.join(RES, name), ...extra], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const keep = (d) => { log.write(d); tail = (tail + d).slice(-20000); };
    child.stdout.on('data', keep); child.stderr.on('data', keep);
    const timer = setTimeout(() => { keep(`\n[délai de ${maxMin} min dépassé : arrêt]\n`); child.kill('SIGKILL'); }, maxMin * 60000);
    child.on('close', (code, signal) => {
      clearTimeout(timer); log.end();
      const fails = tail.split('\n').filter((l) => /^FAIL\b/.test(l));
      const ok = code === 0 && !signal && !fails.length;
      const why = signal ? 'interrompu' : fails.length ? fails.slice(0, 3).join(' · ') : code ? `code de sortie ${code}` : '';
      resolve({ name, ok, ms: Date.now() - t0, why });
    });
  });
}

const results = [];
const T0 = Date.now();
for (const s of todo) {
  process.stdout.write(`▶ ${s[0].padEnd(24)}`);
  const r = await run(s);
  results.push(r);
  console.log(`${r.ok ? 'OK   ' : 'ÉCHEC'} ${fmt(r.ms).padStart(12)}  ${r.why}`);
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} suites réussies en ${fmt(Date.now() - T0)} · journaux : test-results/<suite>.log`);
process.exitCode = bad.length ? 1 : 0;
