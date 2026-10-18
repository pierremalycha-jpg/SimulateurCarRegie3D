// Déclarations globales pour la vérification de types (aucun effet sur le code produit).

// fichiers texte intégrés par esbuild (loader « text ») : lanceurs et mode d'emploi du serveur réseau local
declare module '*.txt' { const text: string; export default text; }
declare module '*.bat' { const text: string; export default text; }
declare module '*.command' { const text: string; export default text; }
declare module '*.sh' { const text: string; export default text; }

interface Window {
  XLSX?: any;
  /** API de la page publiée sur claude.ai (capacités : db, room, user, downloads…) */
  claude?: { use(name: string): Promise<any> };
  /** posé par le serveur réseau local (lan/serveur.mjs) dans la page qu'il sert */
  CARREGIE_LAN?: { version: number };
  /** Safari ancien */
  webkitAudioContext?: typeof AudioContext;
  /** accès de débogage et de test */
  __dbg?: any;
  __S?: any;
}
