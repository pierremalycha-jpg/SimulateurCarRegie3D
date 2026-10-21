// @ts-check
import { emit, on } from '../../state.js';
import { openLayer, layerOpen, showTab } from '../layer.js';
import { coursView } from './cours.js';
import { chaptersSection, glossarySection, postesSection, materielSection, proceduresSection } from '../guide.js';

// ----------------------------------------------------------------------------------
// L'espace Cours, plein écran : on peut l'ouvrir de l'écran titre (même pendant le chargement),
// de la feuille de service et à tout moment dans le car (touche G). Six onglets : les notions
// (une fiche par terme technique, avec schéma et manipulation), les chapitres du guide, le
// glossaire, puis notre car : les postes, le matériel et les procédures maison.
// ----------------------------------------------------------------------------------
const TABS = /** @type {[string, string][]} */ ([['notions', 'Notions'], ['chapitres', 'Chapitres'], ['glossaire', 'Glossaire'], ['postes', 'Postes'], ['materiel', 'Matériel'], ['procedures', 'Procédures']]);

/**
 * @param {{ tab?: string, fiche?: string, chapter?: string | null }} [o]
 *   tab : onglet ; fiche : notion à ouvrir (onglet Notions) ; chapter : chapitre (onglet Chapitres)
 */
export function openCours(o = {}) {
  const tab = o.tab || (o.chapter ? 'chapitres' : 'notions');
  const want = { fiche: o.fiche || '', chapter: o.chapter || null };
  // déjà ouvert : on change seulement d'onglet (et de fiche ou de chapitre)
  if (layerOpen() === 'cours' && !want.fiche && !want.chapter) { showTab(tab); return; }
  openLayer({
    kind: 'cours', title: 'Cours', ico: 'cours', tabs: TABS, tab,
    show: (k, box) => {
      if (k === 'notions') {
        const v = coursView({ go: (g) => emit('go', g), start: want.fiche || undefined });
        want.fiche = '';
        box.append(v.node);
        return v.dispose;
      }
      if (k === 'chapitres') { chaptersSection(box, want.chapter); want.chapter = null; return; }
      if (k === 'glossaire') glossarySection(box);
      if (k === 'postes') postesSection(box);
      if (k === 'materiel') materielSection(box);
      if (k === 'procedures') proceduresSection(box);
      box.classList.add('ly-narrow');
    },
  });
}
on('cours', (o) => openCours(o && typeof o === 'object' ? o : {}));
