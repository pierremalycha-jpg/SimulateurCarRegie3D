// ----------------------------------------------------------------------------------
// Le serveur protégé de TIEE-Simulator.exe : lan/serveur.mjs et lan/internet.mjs regroupés en
// un seul script, avec la page du simulateur chiffrée par le mot de passe (lan/coffre.mjs) et
// le logo de l'écran « Accès réservé ». Le mot de passe lui-même n'y figure pas.
// Utilisé par tools/exe.mjs (format CommonJS de l'exécutable) et par tests/e2e/acces.mjs.
// ----------------------------------------------------------------------------------
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { chiffrer, KDF, mdpNormal } from '../lan/coffre.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
export const MDP_MIN = 3;        // un mot de passe court est accepté (choix du 26 octobre 2026)
export const MDP_CONSEILLE = 10; // en dessous, la construction avertit : un mot de passe court se devine en partant du fichier

/** vérifie le mot de passe choisi ; renvoie le message d'erreur, ou '' s'il convient */
export function mdpRefuse(mdp) {
  mdp = mdpNormal(mdp || '');
  if (!mdp) return 'mot de passe absent : donnez-le dans la variable d\'environnement TIEE_MDP (secret TIEE_MDP sur GitHub)';
  if ([...mdp].length < MDP_MIN) return `mot de passe trop court (${MDP_MIN} caractères au moins)`;
  if (mdp.length > 256) return 'mot de passe trop long (256 caractères au plus)';
  return '';
}
/** mot de passe accepté mais faible : avertissement à afficher, ou '' */
export const mdpFaible = (mdp) => ([...mdpNormal(mdp)].length < MDP_CONSEILLE ? `mot de passe court (moins de ${MDP_CONSEILLE} caractères) : il écarte les curieux, mais quelqu'un qui récupère l'exécutable peut le retrouver en essayant les combinaisons ; une phrase de quatre ou cinq mots résiste vraiment` : '');

/** « version 19.15.0, fabriquée le 26 octobre 2026 à 14:30 » (heure de Paris) : affiché sur l'écran d'accès et
 *  dans la fenêtre du serveur, pour savoir quelle copie on a devant soi (une copie garde le mot de passe de sa
 *  fabrication) */
export function fabrique(date = new Date()) {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const j = date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });
  const h = date.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
  return `version ${v}, fabriquée le ${j} à ${h}`;
}

/**
 * @param {{ page: string, mdp: string, format?: 'cjs' | 'esm', kdf?: typeof KDF, outfile: string, banner?: string, define?: Record<string, string>, fabrique?: string }} o
 */
export async function serveurProtege(o) {
  const err = mdpRefuse(o.mdp); if (err) throw new Error(err);
  const coffre = await chiffrer(o.page, o.mdp, o.kdf || KDF);
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'src/assets/logo-bts-av.png')).toString('base64');
  const srv = fs.readFileSync(path.join(ROOT, 'lan/serveur.mjs'), 'utf8');
  for (const m of ['let PAGE = null;', 'let LOGO = \'\';', 'let FABRIQUE = \'\';']) if (!srv.includes(m)) throw new Error(`lan/serveur.mjs : marqueur ${m} introuvable`);
  const code = srv.replace('let PAGE = null;', () => `let PAGE = ${JSON.stringify(coffre)};`).replace('let LOGO = \'\';', () => `let LOGO = ${JSON.stringify(logo)};`)
    .replace('let FABRIQUE = \'\';', () => `let FABRIQUE = ${JSON.stringify(o.fabrique ?? fabrique())};`);
  await esbuild.build({
    stdin: { contents: code, resolveDir: path.join(ROOT, 'lan'), sourcefile: 'serveur.mjs', loader: 'js' }, outfile: o.outfile,
    bundle: true, platform: 'node', format: o.format || 'esm', target: 'node22', legalComments: 'none', charset: 'utf8', logLevel: 'warning',
    define: o.define || {}, banner: o.banner ? { js: o.banner } : undefined,
  });
  return coffre;
}
