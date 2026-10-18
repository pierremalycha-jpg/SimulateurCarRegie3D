// Préparation des tests unitaires (node --import ./tests/register.mjs --test tests/unit/).
// Les modules du simulateur importent quelques fichiers texte (mode d'emploi, lanceurs du serveur)
// qu'esbuild intègre à la construction : ici ils sont chargés comme des chaînes, de la même façon.
import { register } from 'node:module';
register('./text-loader.mjs', import.meta.url);
