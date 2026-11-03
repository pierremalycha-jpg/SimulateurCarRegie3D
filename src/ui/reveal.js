// @ts-check
// ----------------------------------------------------------------------------------
// La page qui se dévoile au défilement (v19.26) : comme sur une page de présentation d'Apple, chaque
// section d'une leçon arrive quand on descend jusqu'à elle, légèrement remontée et fondue. Mécanique :
// les éléments marqués `data-reveal` reçoivent la classe `co-reveal`, puis `in` dès qu'ils entrent dans
// la fenêtre (IntersectionObserver, un peu avant le bord pour que la lecture ne s'arrête jamais sur un
// vide). Quand une section entre, tout ce qui la précède dans la page est révélé aussi : on lit de haut
// en bas, et un saut (le lien d'une étape, un défilement rapide) ne laisse rien de vide au-dessus. Ce
// qui est déjà visible à l'ouverture apparaît tout de suite, en cascade. Sans observateur (ancien
// navigateur), ou si l'utilisateur préfère moins d'animations, tout est visible d'emblée ; sous un pilote
// de test (navigator.webdriver), ni transition ni déplacement (seule l'opacité bascule) : les captures
// se relisent et les clics tombent où ils visent. L'opacité finale est toujours 1 : l'animation ne fait
// qu'avancer l'arrivée, elle ne laisse rien à demi visible.
// ----------------------------------------------------------------------------------
const MOINS = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** @type {IntersectionObserver | null} */
let OBS = null;
/** les éléments observés, dans l'ordre de la page : quand l'un entre, ceux d'avant sont révélés aussi */
/** @type {HTMLElement[]} */
let ORDRE = [];
/** révèle un élément et cesse de l'observer */
function montrer(/** @type {HTMLElement} */ e) { e.classList.add('in'); if (OBS) OBS.unobserve(e); }
/** l'observateur partagé : un seul pour toutes les pages */
function observer() {
  if (OBS) return OBS;
  if (typeof IntersectionObserver !== 'function') return null;
  OBS = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const k = ORDRE.indexOf(/** @type {HTMLElement} */ (e.target));
      // tout ce qui précède dans la page est lu : révélé avec
      if (k >= 0) for (let i = 0; i <= k; i++) if (!ORDRE[i].classList.contains('in')) montrer(ORDRE[i]);
      else montrer(/** @type {HTMLElement} */ (e.target));
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
  return OBS;
}
/**
 * Marque les sections d'une page et les révèle au défilement.
 * @param {ParentNode} root la page (les éléments `[data-reveal]` qu'elle contient)
 * @returns {() => void} de quoi arrêter d'observer (la page est redessinée)
 */
export function revealIn(root) {
  const els = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-reveal]')]);
  const obs = observer();
  const tout = !obs || MOINS();
  if (typeof navigator !== 'undefined' && navigator.webdriver) document.documentElement.classList.add('reveal-direct');
  ORDRE = els;
  let k = 0;
  for (const e of els) {
    e.classList.add('co-reveal');
    if (tout) { e.classList.add('in'); continue; }
    // ce qui est déjà à l'écran arrive en cascade, le reste attend qu'on y descende
    const r = e.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    if (r.top < vh * 0.92 && r.bottom > 0) { e.style.transitionDelay = `${Math.min(k++, 6) * 70}ms`; e.classList.add('in'); e.addEventListener('transitionend', () => { e.style.transitionDelay = ''; }, { once: true }); }
    else obs.observe(e);
  }
  return () => { if (obs) for (const e of els) obs.unobserve(e); if (ORDRE === els) ORDRE = []; };
}
/** révèle tout de suite ce qui reste caché (une impression, un saut programmé) */
export function revealAll(root = document) {
  for (const e of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('.co-reveal:not(.in)'))) montrer(e);
}
