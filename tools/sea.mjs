// ----------------------------------------------------------------------------------
// Ce que partagent les deux versions à partager, TIEE-Simulator.exe (tools/exe.mjs) et
// l'application macOS (tools/mac.mjs) : le serveur protégé (tools/protege.mjs) mis dans un
// exécutable Node.js autonome (« single executable application », SEA).
//   · le blob SEA (le même pour Windows, macOS et Linux : ni instantané ni cache de code) ;
//   · les téléchargements de nodejs.org, contrôlés par leur empreinte SHA-256 ;
//   · les contrôles « rien en clair » (ni la page, ni le mot de passe) ;
//   · le serveur lancé pour de vrai et interrogé (--verifier) ;
//   · le fichier des licences du kit.
// ----------------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { serveurProtege } from './protege.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
export const V = process.version; // le blob ne fonctionne qu'avec la même version de Node que l'exécutable cible
export const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
export const mb = (n) => (n / 1048576).toFixed(1) + ' Mo';

/**
 * serveur protégé regroupé en un script CommonJS, puis blob SEA produit par ce node
 * @param {{ page: string, mdp: string, cache: string, banner: string, exe: string }} o
 */
export async function blobSEA(o) {
  const main = path.join(o.cache, 'serveur.cjs');
  await serveurProtege({
    page: o.page, mdp: o.mdp, format: 'cjs', outfile: main,
    define: { 'import.meta.url': JSON.stringify('file:///' + o.exe) }, // la page est intégrée : le chemin ne sert pas
    banner: o.banner,
  });
  const blob = path.join(o.cache, 'sea.blob');
  const seaCfg = path.join(o.cache, 'sea-config.json');
  fs.writeFileSync(seaCfg, JSON.stringify({ main, output: blob, disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false }));
  execFileSync(process.execPath, ['--experimental-sea-config', seaCfg], { stdio: ['ignore', 'ignore', 'inherit'] });
  const data = fs.readFileSync(blob);
  console.log('blob SEA', mb(data.length), '(Node ' + V + ')');
  return data;
}

/** un fichier de https://nodejs.org/dist/<version>/, contrôlé par SHASUMS256.txt, gardé dans le cache */
export async function telechargeNode(cache, nom) {
  const file = path.join(cache, `${V}-${nom.replace(/\//g, '-')}`), sumFile = file + '.sha256';
  if (fs.existsSync(file) && fs.existsSync(sumFile) && sha256(fs.readFileSync(file)) === fs.readFileSync(sumFile, 'utf8').trim()) return fs.readFileSync(file);
  const base = `https://nodejs.org/dist/${V}/`;
  const sums = await (await fetch(base + 'SHASUMS256.txt')).text();
  const want = (sums.split('\n').find((l) => l.trim().endsWith(' ' + nom)) || '').split(/\s+/)[0];
  if (!want) throw new Error(`empreinte de ${nom} absente de ${base}SHASUMS256.txt`);
  console.log(`téléchargement de ${nom} (Node ${V})…`);
  const r = await fetch(base + nom);
  if (!r.ok) throw new Error(`${nom} : HTTP ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  if (sha256(b) !== want) throw new Error(`${nom} téléchargé : empreinte SHA-256 incorrecte`);
  fs.writeFileSync(file, b); fs.writeFileSync(sumFile, want);
  return b;
}

/** rien en clair dans l'exécutable : ni le simulateur (three.js), ni le mot de passe (lève une erreur sinon) */
export function rienEnClair(bin, mdp, quoi) {
  if (['WebGLRenderer', 'Olivier'].some((m) => bin.includes(m))) throw new Error(`la page du simulateur se trouve en clair dans ${quoi}`);
  // (un mot de passe de quelques lettres se trouve forcément ailleurs dans le fichier : rien à en conclure)
  if (mdp.length >= 8 && (bin.includes(Buffer.from(mdp, 'utf8')) || bin.includes(Buffer.from(mdp, 'utf16le')))) throw new Error(`le mot de passe se trouve dans ${quoi}`);
}

/** licences du kit : three.js et Node.js (inclus dans l'exécutable) */
export async function licences(cache, ou) {
  const licFile = path.join(cache, `LICENSE-node-${V}.txt`);
  if (!fs.existsSync(licFile)) fs.writeFileSync(licFile, await (await fetch(`https://raw.githubusercontent.com/nodejs/node/${V}/LICENSE`)).text());
  const titre = `Node.js ${V} (inclus dans ${ou})`;
  return ['three.js', '========', fs.readFileSync(path.join(ROOT, 'node_modules/three/LICENSE'), 'utf8'), '', titre, '='.repeat(titre.length), fs.readFileSync(licFile, 'utf8')].join('\n');
}

/**
 * le serveur de l'exécutable lancé pour de vrai (sur cette machine), puis interrogé : écran d'accès,
 * mauvais et bon mot de passe, page, parties, jeu par Internet. Renvoie les contrôles [nom, réussi].
 * @param {{ cmd: string[], mdp: string, cache: string, fenetre: string, dossier?: string, attente?: number }} o
 *   cmd : l'exécutable (et ce qui le précède, comme arch -x86_64) ; fenetre : ce que le serveur dit
 *   pour s'arrêter (options du double-clic actives) ; dossier : où le serveur doit écrire sa clé, dans
 *   le dossier personnel (HOME, qui pointe ici sur un dossier jetable), sinon dans le dossier courant.
 *   attente : délai de démarrage en secondes (15 par défaut ; Rosetta traduit d'abord tout l'exécutable).
 * @returns {Promise<{ ok: [string, boolean][], log: string }>}
 */
export async function lanceEtInterroge(o) {
  const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = /** @type {net.AddressInfo} */ (s.address()).port; s.close(() => r(p)); }); });
  const work = fs.mkdtempSync(path.join(o.cache, 'run-'));
  const [cmd, ...pre] = o.cmd;
  const p = spawn(cmd, [...pre, '--port', String(port)], { cwd: work, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_OPTIONS: '', HOME: work } });
  let log = ''; p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
  /** @type {[string, boolean][]} */
  const ok = [];
  const base = `http://127.0.0.1:${port}`;
  const acces = (mdp) => fetch(base + '/api/acces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mdp }) });
  try {
    for (let i = 0; i < (o.attente || 15) * 10 && !log.includes('Sur cet ordinateur'); i++) await new Promise((r) => setTimeout(r, 100));
    ok.push(['serveur démarré, accès protégé annoncé', log.includes(`http://localhost:${port}`) && log.includes('Accès protégé')]);
    const verrou = await (await fetch(base + '/')).text();
    ok.push(['sans mot de passe : écran « Accès réservé » seulement', verrou.includes('Accès réservé') && !verrou.includes('CARREGIE_LAN') && verrou.length < 1e5]);
    ok.push(['sans mot de passe : parties refusées', (await fetch(base + '/api/parties')).status === 401]);
    ok.push(['mauvais mot de passe refusé', (await acces(o.mdp + 'x')).status === 401]);
    const r = await acces(o.mdp);
    const cookie = String(r.headers.get('set-cookie') || '').split(';')[0];
    ok.push(['bon mot de passe accepté, jeton donné', r.status === 200 && /^tiee_acces=[0-9a-f]{48}$/.test(cookie)]);
    const page = await (await fetch(base + '/', { headers: { cookie } })).text();
    ok.push(['page servie, three.js intégré', page.includes('window.CARREGIE_LAN') && page.length > 1e6]);
    const parties = await (await fetch(base + '/api/parties', { headers: { cookie } })).json();
    ok.push(['liste des parties', Array.isArray(parties.parties)]);
    ok.push(['options du double-clic actives', log.includes(o.fenetre)]);
    // jouer par Internet (lan/internet.mjs, regroupé dans l'exécutable) : état lisible par l'hôte, clé créée
    const net0 = await (await fetch(base + '/api/internet', { headers: { cookie } })).json();
    const cle = fs.existsSync(path.join(work, o.dossier || '', 'cle-internet.txt'));
    ok.push([`jouer par Internet : module présent, clé créée${o.dossier ? ` (dossier « ${o.dossier} »)` : ''}`, net0.direct && net0.direct.etat === 'non' && /^[a-z2-9]{12}$/.test(net0.cle) && cle]);
    ok.push(['jouer par Internet : ping', (await (await fetch(base + '/api/ping')).json()).ok === true]);
  } catch (e) {
    ok.push(['serveur interrogé sans erreur', false]); log += '\n' + String(e);
  } finally { p.kill(); fs.rmSync(work, { recursive: true, force: true }); }
  return { ok, log };
}
