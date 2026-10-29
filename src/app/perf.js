// @ts-check
import { S, on } from '../state.js';
import { el, fmt } from '../util.js';
import { setPerf } from '../shared.js';
import { toast, modal } from '../ui/common.js';
import { renderer, setQuality } from './view.js';
import { FPS } from './hud.js';

// ----------------------------------------------------------------------------------
// Diagnostic de performance (Guide → Réglages) : six secondes de mesure, carte graphique,
// qualité recommandée ; alerte unique quand l'affichage reste saccadé.
// ----------------------------------------------------------------------------------
const QUAL_LABEL = { basse: 'Basse', moyenne: 'Moyenne', haute: 'Haute' };
function gpuName() {
  try {
    const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return String(r || 'inconnue').replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 120);
  } catch (e) { return 'inconnue'; }
}
let perfRunning = false;
function perfTest() {
  if (perfRunning) return;
  perfRunning = true;
  modal.close();
  const where = S.mode === 'station' ? 'dans un poste' : S.inTruck ? 'dans le car' : S.mode === 'fps' ? 'dans le stade' : 'sur l\'écran d\'accueil';
  toast('Mesure des performances pendant 6 secondes… ne touche à rien.', '', 6000);
  const times = []; let prev = performance.now(); const t0 = prev;
  const tick = (now) => {
    times.push(now - prev); prev = now;
    if (now - t0 < 6000) { requestAnimationFrame(tick); return; }
    perfRunning = false;
    const ft = times.slice(10).sort((a, b) => a - b); // on ignore la mise en route
    const avg = ft.reduce((a, b) => a + b, 0) / Math.max(1, ft.length);
    const r1 = (v) => (v < 10 ? Math.round(v * 10) / 10 : Math.round(v));
    const fps = r1(1000 / avg); const low = r1(1000 / (ft[Math.min(ft.length - 1, Math.floor(ft.length * 0.99))] || avg));
    const gpu = gpuName(); const soft = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
    const rec = soft || fps < 30 ? 'basse' : fps < 50 ? (S.quality === 'haute' ? 'moyenne' : S.quality) : (S.quality === 'basse' && fps >= 58 ? 'moyenne' : S.quality === 'moyenne' && fps >= 58 ? 'haute' : S.quality);
    setPerf({ fps, low, gpu, quality: S.quality, rec, where, px: `${renderer.domElement.width}×${renderer.domElement.height}` });
    const verdict = fps >= 50 ? ['ok', 'Fluide : le simulateur tourne bien sur cet ordinateur.'] : fps >= 30 ? ['warn', 'Correct, mais quelques saccades possibles dans les postes chargés (multiview, vision).'] : ['err', 'Trop lent pour un usage confortable.'];
    const kv = el('div', { class: 'kv' });
    for (const [k, v, cls] of [
      ['Images par seconde', `${String(fps).replace('.', ',')} i/s en moyenne · ${String(low).replace('.', ',')} i/s dans les 1 % d'images les plus lentes`, verdict[0]],
      ['Mesuré', where], ['Carte graphique', gpu + (soft ? ' (rendu logiciel : pas d\'accélération matérielle)' : '')],
      ['Qualité actuelle', QUAL_LABEL[S.quality]], ['Résolution de rendu', `${renderer.domElement.width} × ${renderer.domElement.height} px (rapport ${fmt(renderer.getPixelRatio(), 2)})`],
      ['Caméras simulées', `${S.cams.length} (chaque caméra est une image 3D rendue en plus)`],
    ]) kv.append(el('dt', {}, k), el('dd', { class: cls || '' }, v));
    const tips = el('ul', {});
    if (soft) tips.append(el('li', {}, 'Le navigateur n\'utilise pas la carte graphique : active l\'accélération matérielle dans ses réglages, ou essaie un autre navigateur (Chrome, Edge, Firefox récents).'));
    if (fps < 50) tips.append(el('li', {}, 'Branche l\'ordinateur portable sur secteur et ferme les autres onglets lourds (visio, vidéos).'), el('li', {}, 'Moins de caméras = moins d\'images à calculer : le plan à 6 caméras (plan des caméras, touche P) aide beaucoup.'), el('li', {}, 'Une fenêtre plus petite ou un écran moins défini réduit aussi la charge.'));
    const apply = rec !== S.quality ? el('button', { class: 'btn primary', onclick: () => { setQuality(rec); modal.close(); toast(`Qualité graphique : ${QUAL_LABEL[rec]}`, 'good'); } }, `Passer en qualité ${QUAL_LABEL[rec]} (recommandé)`) : null;
    modal.open('Diagnostic de performance', el('div', { class: 'list' }, el('p', { class: verdict[0] }, verdict[1]), kv,
      el('p', {}, rec !== S.quality ? `Qualité recommandée : ${QUAL_LABEL[rec]}.` : fps < 30 ? 'Tu es déjà en qualité Basse : suis les conseils ci-dessous.' : `La qualité ${QUAL_LABEL[S.quality]} est adaptée à cet ordinateur.`),
      tips.children.length ? el('div', { class: 'prose' }, el('h3', {}, 'Pour gagner en fluidité'), tips) : null,
      el('p', { class: 'note' }, 'Ce résultat est enregistré avec ta progression : le formateur le voit dans son tableau de bord, utile pour repérer un poste de formation trop juste.'),
      el('div', { class: 'hwrow' }, apply, el('button', { class: 'btn', onclick: () => modal.close() }, 'Fermer'))), { width: 720 });
  };
  requestAnimationFrame(tick);
}
export function installPerfTest() { on('perfTest', perfTest); }

// alerte unique si la fluidité reste mauvaise
let slowT = 0, slowWarned = false;
export function watchFps(dt) {
  if (slowWarned || S.mode === 'start' || perfRunning || !FPS.shown) return;
  slowT = FPS.shown < 22 && S.quality !== 'basse' ? slowT + dt : 0;
  if (slowT > 12) { slowWarned = true; toast('L\'affichage saccade. Guide → Réglages → « Tester les performances de cet ordinateur » pour trouver la bonne qualité graphique.', 'bad', 9000); }
}
