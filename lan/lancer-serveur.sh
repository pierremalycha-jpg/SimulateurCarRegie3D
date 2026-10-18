#!/bin/bash
# Car régie 3D — serveur réseau local (Linux : ./lancer-serveur.sh)
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Installez la version LTS depuis https://nodejs.org puis relancez."
  read -n 1 -s -r -p "Appuyez sur une touche pour fermer."
  exit 1
fi
if [ -f car-regie-serveur-lan.mjs ]; then node car-regie-serveur-lan.mjs "$@"; else node serveur.mjs "$@"; fi
