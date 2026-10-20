// Crochet de chargement : un import de .txt / .bat / .command / .sh / .svg donne le contenu du fichier
// (export par défaut), comme le chargeur « text » d'esbuild dans tools/build.mjs.
import { readFile } from 'node:fs/promises';

const TEXT = /\.(txt|bat|command|sh|svg)$/;
export async function load(url, context, next) {
  if (url.startsWith('file:') && TEXT.test(new URL(url).pathname)) {
    const text = await readFile(new URL(url), 'utf8');
    return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(text)};` };
  }
  return next(url, context);
}
