// @ts-check
import { registerChapter } from './index.js';
import { FALAISE } from './sdi_falaise.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le SDI » : ébauche, les leçons arrivent (voir cours/signal.js pour le modèle).
// ----------------------------------------------------------------------------------
registerChapter({
  id: 'sdi', title: 'Le SDI', icon: 'grille',
  intro: 'Le câble coaxial qui transporte l\'image dans le car : débits, formats, longueurs, diagramme de l\'œil, embedded audio.',
  lessons: [FALAISE],
});
