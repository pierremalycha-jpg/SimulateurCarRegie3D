// ----------------------------------------------------------------------------------
// Les comptes (v19.24) contre l'émulateur Firebase : démarre Authentication et Firestore en local
// (projet de démonstration « demo-tiee », aucun vrai projet touché), charge firestore.rules et lance
// tests/firebase/comptes.mjs. Il faut Java (11 ou plus) ; firebase-tools est pris par npx, ou là
// où le dit FIREBASE_TOOLS (chemin du fichier « firebase » de firebase-tools).
//   node tools/firebase-test.mjs
// La suite de bout en bout « comptes » (tests/e2e/comptes.mjs) passe par le même chemin.
// ----------------------------------------------------------------------------------
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const script = process.argv[2] || 'node tests/firebase/comptes.mjs';
const bin = process.env.FIREBASE_TOOLS;
const cmd = bin ? [bin] : ['npx', '--yes', 'firebase-tools@14'];
const r = spawnSync(cmd[0], [...cmd.slice(1), 'emulators:exec', '--project', 'demo-tiee', '--only', 'auth,firestore', script], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
