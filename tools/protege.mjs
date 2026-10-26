// ----------------------------------------------------------------------------------
// Le serveur protégé de TIEE-Simulator.exe : lan/serveur.mjs et lan/internet.mjs regroupés en
// un seul script, avec la page du simulateur chiffrée par le mot de passe (lan/coffre.mjs) et
// le logo de l'écran « Accès réservé ». Le mot de passe lui-même n'y figure pas.
// Utilisé par tools/exe.mjs (format CommonJS de l'exécutable) et par tests/e2e/acces.mjs.
// ----------------------------------------------------------------------------------
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { chiffrer, KDF } from '../lan/coffre.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
export const MDP_MIN = 10;

/** vérifie le mot de passe choisi ; renvoie le message d'erreur, ou '' s'il convient */
export function mdpRefuse(mdp) {
  if (!mdp) return 'mot de passe absent : donnez-le dans la variable d\'environnement TIEE_MDP (secret TIEE_MDP sur GitHub)';
  if ([...mdp].length < MDP_MIN) return `mot de passe trop court (${MDP_MIN} caractères au moins ; une phrase de quatre mots est plus sûre et plus facile à retenir)`;
  if (mdp.length > 256) return 'mot de passe trop long (256 caractères au plus)';
  return '';
}

/**
 * @param {{ page: string, mdp: string, format?: 'cjs' | 'esm', kdf?: typeof KDF, outfile: string, banner?: string, define?: Record<string, string> }} o
 */
export async function serveurProtege(o) {
  const err = mdpRefuse(o.mdp); if (err) throw new Error(err);
  const coffre = await chiffrer(o.page, o.mdp, o.kdf || KDF);
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'src/assets/logo-bts-av.png')).toString('base64');
  const srv = fs.readFileSync(path.join(ROOT, 'lan/serveur.mjs'), 'utf8');
  for (const m of ['let PAGE = null;', 'let LOGO = \'\';']) if (!srv.includes(m)) throw new Error(`lan/serveur.mjs : marqueur ${m} introuvable`);
  const code = srv.replace('let PAGE = null;', () => `let PAGE = ${JSON.stringify(coffre)};`).replace('let LOGO = \'\';', () => `let LOGO = ${JSON.stringify(logo)};`);
  await esbuild.build({
    stdin: { contents: code, resolveDir: path.join(ROOT, 'lan'), sourcefile: 'serveur.mjs', loader: 'js' }, outfile: o.outfile,
    bundle: true, platform: 'node', format: o.format || 'esm', target: 'node22', legalComments: 'none', charset: 'utf8', logLevel: 'warning',
    define: o.define || {}, banner: o.banner ? { js: o.banner } : undefined,
  });
  return coffre;
}
