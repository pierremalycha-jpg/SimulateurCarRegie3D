// @ts-check

// ----------------------------------------------------------------------------------
// Schémas des fiches du module caméra : du SVG écrit à la main, à l'échelle du panneau (440 px
// de large), couleurs de l'interface (classes de camlab.css). Un schéma par fiche, nommé par
// le champ `fig` de la fiche.
// ----------------------------------------------------------------------------------

const rays = (x0, ys, x1, y1, cls = 'cf-ray') => ys.map((y) => `<line class="${cls}" x1="${x0}" y1="${y}" x2="${x1}" y2="${y1}"/>`).join('');

/** une rangée du schéma du tirage : objectif, monture, prisme, capteur ; les rayons convergent en xf */
function tirageRow(y, title, sub, xf, ok) {
  const cy = y + 92, xs = 262, top = cy - 30, bot = cy + 30;
  const lens = `<rect class="cf-lens" x="26" y="${cy - 36}" width="104" height="72" rx="10"/><text class="cf-in" x="78" y="${cy + 4}">objectif</text>`;
  const mount = `<line class="cf-mount" x1="146" y1="${cy - 44}" x2="146" y2="${cy + 44}"/><text class="cf-s" x="146" y="${cy + 58}">monture</text>`;
  const prism = `<rect class="cf-prism" x="178" y="${cy - 26}" width="56" height="52" rx="2"/><text class="cf-s" x="206" y="${cy + 42}">prisme</text>`;
  const sensor = `<line class="cf-sensor${ok ? '' : ' bad'}" x1="${xs}" y1="${cy - 24}" x2="${xs}" y2="${cy + 24}"/><text class="cf-s" x="${xs}" y="${cy + 42}">capteur</text>`;
  // au-delà du point de convergence, les rayons continuent jusqu'au capteur : une tache au lieu d'un point
  const k = (xs - xf) / (xf - 130);
  const spread = ok ? '' : [top, bot].map((v) => `<line class="cf-ray" x1="${xf}" y1="${cy}" x2="${xs}" y2="${cy + (cy - v) * k}"/>`).join('');
  const spot = ok ? `<circle class="cf-dot" cx="${xs}" cy="${cy}" r="3.5"/>` : `<line class="cf-spot" x1="${xs}" y1="${cy - 30 * k}" x2="${xs}" y2="${cy + 30 * k}"/>`;
  const dim = `<line class="cf-dim" x1="146" y1="${cy + 70}" x2="${xs}" y2="${cy + 70}" marker-start="url(#cf-a)" marker-end="url(#cf-a)"/><text class="cf-s" x="${(146 + xs) / 2}" y="${cy + 84}">48 mm : le tirage de la monture B4</text>`;
  return `<text class="cf-t${ok ? ' ok' : ' bad'}" x="16" y="${y + 16}">${title}</text><text class="cf-sub" x="16" y="${y + 34}">${sub}</text>
    ${lens}${mount}${prism}${rays(130, [top, cy, bot], xf, cy)}${spread}${sensor}${spot}${ok ? dim : ''}`;
}

export const FIGS = {
  /** le tirage juste et le tirage faux ; la règle du réglage */
  tirage: () => `<svg class="cf" viewBox="0 0 440 372" role="img" aria-label="Schéma : avec un tirage juste, les rayons se rejoignent sur le capteur ; avec un tirage faux, ils se rejoignent avant et font une tache floue.">
    <defs><marker id="cf-a" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" class="cf-arrow"/></marker></defs>
    ${tirageRow(4, 'Tirage juste', 'L\'image se forme exactement sur le capteur : un point net.', 262, true)}
    ${tirageRow(196, 'Tirage faux', 'L\'image se forme avant le capteur : le point devient une tache.', 236, false)}
    <g transform="translate(290 52)"><rect class="cf-box" x="0" y="0" width="140" height="96" rx="3"/>
      <text class="cf-bt" x="10" y="20">La règle</text>
      <text class="cf-bs" x="10" y="42">En serré (54 mm) :</text><text class="cf-bb" x="10" y="58">la bague de point</text>
      <text class="cf-bs" x="10" y="76">En large (4,5 mm) :</text><text class="cf-bb" x="10" y="92">la bague F.f</text></g>
    <g transform="translate(290 244)"><rect class="cf-box" x="0" y="0" width="140" height="96" rx="3"/>
      <text class="cf-bt" x="10" y="20">Pourquoi en large</text>
      <text class="cf-bs" x="10" y="42">La bague de point agit</text><text class="cf-bs" x="10" y="58">comme la focale au carré :</text>
      <text class="cf-bs" x="10" y="74">144 fois moins à 4,5 mm</text><text class="cf-bs" x="10" y="90">qu'à 54 mm.</text></g>
  </svg>`,
};
