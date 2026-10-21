// @ts-check
import { registerChapter } from './index.js';

// ----------------------------------------------------------------------------------
// Chapitre « La caméra » : ébauche, les leçons arrivent (voir cours/signal.js pour le modèle).
// ----------------------------------------------------------------------------------
registerChapter({
  id: 'camera', title: 'La caméra', icon: 'ccu',
  intro: 'La caméra système de bout en bout : la tête, l\'objectif, la fibre, la CCU et le RCP, jusqu\'au montage sur le terrain.',
  module: { label: 'La caméra en 3D', sub: 'objectif, prisme, capteurs, menu, connectique', event: 'camera', arg: { from: 'cours' } },
  lessons: [],
});
