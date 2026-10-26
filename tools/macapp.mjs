// ----------------------------------------------------------------------------------
// Les pièces de « TIEE Simulator.app » (tools/mac.mjs), écrites sans outil Apple pour pouvoir être
// testées partout (tests/unit/mac.test.mjs) : Info.plist, icône .icns, lanceur.
//
// L'application :
//   TIEE Simulator.app/Contents/
//     Info.plist, PkgInfo
//     MacOS/TIEE Simulator          petit lanceur compilé (LANCEUR_C) : il passe la main à lancer.sh
//     MacOS/TIEE-Simulator-serveur  le serveur protégé (Node.js autonome, Apple silicon et Intel)
//     Resources/lancer.sh           ouvre le serveur dans une fenêtre du Terminal (LANCER_SH)
//     Resources/TIEE-Simulator.icns
// Le serveur tourne dans une fenêtre du Terminal, comme la fenêtre noire de TIEE-Simulator.exe :
// elle affiche l'adresse à donner aux autres joueurs, et la fermer arrête le simulateur.
// ----------------------------------------------------------------------------------

export const APP = 'TIEE Simulator.app';
export const LANCEUR = 'TIEE Simulator';           // Contents/MacOS : l'exécutable de l'application
export const SERVEUR = 'TIEE-Simulator-serveur';   // Contents/MacOS : le serveur
export const ICONE = 'TIEE-Simulator.icns';        // Contents/Resources
export const IDENTIFIANT = 'fr.lycee-henri-martin.bts-av.tiee-simulator';
export const MACOS_MIN = '11.0';                   // Node.js 22 demande macOS 11 (Big Sur) au moins
export const DOSSIER = 'TIEE Simulator';           // dans le dossier personnel : rapports, clé Internet

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Info.plist de l'application @param {{ version: string, node: string }} o */
export function infoPlist(o) {
  /** @type {[string, string | boolean][]} */
  const cles = [
    ['CFBundleDevelopmentRegion', 'fr'],
    ['CFBundleDisplayName', 'TIEE Simulator'],
    ['CFBundleExecutable', LANCEUR],
    ['CFBundleIconFile', ICONE],
    ['CFBundleIdentifier', IDENTIFIANT],
    ['CFBundleInfoDictionaryVersion', '6.0'],
    ['CFBundleName', 'TIEE Simulator'],
    ['CFBundlePackageType', 'APPL'],
    ['CFBundleShortVersionString', o.version],
    ['CFBundleVersion', o.version],
    ['LSApplicationCategoryType', 'public.app-category.education'],
    ['LSMinimumSystemVersion', MACOS_MIN],
    ['NSHighResolutionCapable', true],
    ['NSHumanReadableCopyright', `BTS Audiovisuel, lycée Henri-Martin (Saint-Quentin). Simulation non officielle, sans lien avec le club. Contient Node.js ${o.node} (licence MIT).`],
  ];
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
    + '<plist version="1.0">\n<dict>\n'
    + cles.map(([k, v]) => `\t<key>${k}</key>\n\t${typeof v === 'boolean' ? (v ? '<true/>' : '<false/>') : `<string>${xml(v)}</string>`}`).join('\n')
    + '\n</dict>\n</plist>\n';
}

// types de l'icône .icns (images PNG), du plus petit au plus grand ; « @2x » : écran Retina
export const ICNS_TYPES = /** @type {const} */ ([['ic11', 32], ['ic12', 64], ['ic07', 128], ['ic13', 256], ['ic08', 256], ['ic14', 512], ['ic09', 512], ['ic10', 1024]]);
export const ICNS_TAILLES = [...new Set(ICNS_TYPES.map(([, s]) => s))];

/** fichier .icns : « icns », taille totale, puis pour chaque image son type, sa taille (en-tête compris) et le PNG
 *  @param {Record<number, Buffer>} pngs images PNG par taille (ICNS_TAILLES) */
export function icns(pngs) {
  const parts = ICNS_TYPES.map(([type, s]) => {
    const png = pngs[s];
    if (!png) throw new Error(`icône ${s}×${s} manquante`);
    const h = Buffer.alloc(8); h.write(type, 0, 'latin1'); h.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([h, png]);
  });
  const h = Buffer.alloc(8); h.write('icns', 0, 'latin1'); h.writeUInt32BE(8 + parts.reduce((n, p) => n + p.length, 0), 4);
  return Buffer.concat([h, ...parts]);
}

/** lit un .icns : [type, taille de l'image PNG en pixels][] (contrôle) */
export function lireIcns(b) {
  if (b.toString('latin1', 0, 4) !== 'icns' || b.readUInt32BE(4) !== b.length) throw new Error('fichier .icns invalide');
  const out = [];
  for (let off = 8; off < b.length;) {
    const type = b.toString('latin1', off, off + 4), n = b.readUInt32BE(off + 4);
    if (n < 8 || off + n > b.length) throw new Error('fichier .icns tronqué');
    const png = b.subarray(off + 8, off + n);
    if (png.readUInt32BE(0) !== 0x89504e47) throw new Error(`${type} : pas une image PNG`);
    out.push([type, png.readUInt32BE(16)]);
    off += n;
  }
  return out;
}

// Le lanceur compilé : une application dont l'exécutable est un script passe moins bien les
// contrôles de macOS (Gatekeeper) ; ce programme de quelques lignes passe la main au script.
export const LANCEUR_C = `// TIEE Simulator (macOS) : lanceur de l'application, il passe la main à Resources/lancer.sh
#include <limits.h>
#include <libgen.h>
#include <mach-o/dyld.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(void) {
  char p[PATH_MAX], r[PATH_MAX], s[PATH_MAX];
  uint32_t n = sizeof p;
  if (_NSGetExecutablePath(p, &n) != 0 || !realpath(p, r)) return 1;
  snprintf(s, sizeof s, "%s/../Resources/lancer.sh", dirname(r));
  execl("/bin/bash", "bash", s, (char *)0);
  perror("lancer.sh");
  return 1;
}
`;

// Le script : refuse de tourner depuis l'image disque ou le dossier Téléchargements (macOS y
// déplace l'application dans un dossier caché en lecture seule, « App Translocation »), retire la
// quarantaine (l'application a déjà été autorisée : sans cela, macOS redemanderait pour le serveur),
// puis ouvre le serveur dans une fenêtre du Terminal.
export const LANCER_SH = `#!/bin/bash
# TIEE Simulator (macOS) : lancé par l'application. Le serveur s'ouvre dans une fenêtre du Terminal
# (l'adresse à donner aux autres joueurs y est affichée) ; fermer cette fenêtre arrête le simulateur.
APP="$(cd "$(dirname "$0")/../.." && pwd -P)"
case "$APP" in
  */AppTranslocation/*)
    /usr/bin/osascript -e 'display dialog "Glissez d’abord « TIEE Simulator » dans le dossier Applications (fenêtre du fichier .dmg), puis ouvrez-le depuis Applications." with title "TIEE Simulator" buttons {"OK"} default button "OK" with icon caution' >/dev/null 2>&1
    exit 0 ;;
esac
/usr/bin/xattr -dr com.apple.quarantine "$APP" 2>/dev/null
exec /usr/bin/open -a Terminal "$APP/Contents/MacOS/${SERVEUR}"
`;

// Au début du serveur (bannière du script regroupé) : options du double-clic, et dossier de travail
// « TIEE Simulator » dans le dossier personnel (rapports, cle-internet.txt) : l'application elle-même
// ne doit pas changer (sa signature ne vaudrait plus rien), et le Terminal démarre ailleurs.
export const BANNIERE = [
  `{ const d = require("path").join(require("os").homedir(), ${JSON.stringify(DOSSIER)});`,
  '  try { require("fs").mkdirSync(d, { recursive: true }); process.chdir(d); } catch (e) { /* dossier courant */ } }',
  'process.argv.splice(2, 0, "--ouvrir", "--exe");',
].join('\n');
