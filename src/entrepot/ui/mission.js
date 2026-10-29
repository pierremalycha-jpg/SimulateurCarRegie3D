// @ts-check
import { el } from '../../util.js';
import { ask } from '../../ui/common.js';
import { offerDownload } from '../../shared.js';
import { CATALOGUE, SIGNAUX, CONNECTEURS, portOf } from '../catalogue/index.js';
import { COMPETENCES } from '../../content/referentiel.js';
import { lessonById } from '../../cours/index.js';
import { noter, MISSIONS } from '../missions.js';
import { vider, appareil, ZONES } from '../build.js';
import { rendre, resultat } from '../suivi.js';

// ----------------------------------------------------------------------------------
// Le cahier des charges : la commande du client, les contraintes, chaque exigence et son état
// (acquise, partielle, manquante, avec l'explication du moteur), le budget, la note. « Rendre le
// montage » enregistre l'essai (suivi.js : le meilleur résultat compte pour l'exercice noté
// x-entrepot et le livret) ; le compte rendu (HTML à imprimer) reprend la note, le matériel, la
// liste de câblage et le plan d'adressage. En bac à sable : le choix d'une mission.
// ----------------------------------------------------------------------------------
/** @typedef {import('./stock.js').Ctx} Ctx */
/** @typedef {import('../missions.js').Mission} Mission */

const date = (/** @type {number} */ t) => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** @param {Mission | null} m @param {Ctx} ctx */
export function renderMission(m, ctx) {
  const box = el('div', { class: 'ep-mission' });
  if (!m) {
    box.append(el('p', { class: 'lede' }, 'Bac à sable : aucune commande. Monte ce que tu veux, ou prends une mission.'));
    for (const x of MISSIONS) {
      const r = resultat(x.id);
      box.append(el('div', { class: 'ep-item' }, el('div', { class: 'ep-item-t' }, el('b', {}, x.titre), el('small', {}, `${x.client} · ${x.niveau} · ${x.duree}${r && r.best ? ` · ton meilleur : ${r.best.score} / 100` : ''}`), el('p', {}, x.brief)),
        el('button', { type: 'button', class: 'btn small primary', 'data-k': `mission:${x.id}`, onclick: async () => { if (ctx.B.appareils.length > 1 && !(await ask('Prendre cette mission remet tout le matériel au stock. Continuer ?', { title: x.titre, ok: 'Prendre la mission' }))) return; vider(x.id); ctx.panel('mission'); } }, 'Prendre')));
    }
    return box;
  }
  const N = noter(m, ctx.B, ctx.E, CATALOGUE);
  const R = resultat(m.id);
  const L = ctx.lecon ? lessonById(ctx.lecon) : null;
  box.append(el('p', { class: 'ep-client' }, el('b', {}, m.client), el('small', {}, ` · ${m.niveau} · ${m.duree}`)), el('p', { class: 'lede' }, m.brief),
    el('h3', {}, 'Contraintes'), el('ul', { class: 'prose' }, ...m.contraintes.map((c) => el('li', {}, c))),
    el('h3', {}, 'Exigences'),
    el('ul', { class: 'ep-exig' }, ...N.items.map((i) => el('li', { class: i.ok ? 'ok' : i.partiel ? 'part' : 'ko' }, el('i', { 'aria-hidden': 'true' }), el('span', {}, el('b', {}, i.label), el('small', {}, ` ${i.pts} pt${i.pts > 1 ? 's' : ''}${i.ok ? '' : i.partiel ? ', moitié' : ', 0'}`), i.why ? el('span', { class: 'why' }, i.why) : null)))),
    N.budget ? el('p', { class: 'ep-budget ' + (N.budget.ok ? 'ok' : 'ko') }, `Budget : ${N.budget.used.toLocaleString('fr-FR')} € sur ${N.budget.max.toLocaleString('fr-FR')} € (ordres de grandeur)${N.budget.ok ? '.' : ' : dépassé, 10 points de moins.'}`) : null,
    el('p', { class: 'ep-score' }, el('b', {}, `${N.score} / 100`), R && R.best ? el('small', {}, ` · ton meilleur : ${R.best.score} / 100 (${date(R.best.at)})`) : null),
    el('div', { class: 'ep-cf-row' },
      el('button', { type: 'button', class: 'btn primary', 'data-k': 'mission:rendre', onclick: () => {
        const r = rendre(m.id, N);
        ctx.say(r.nouveau ? `Montage rendu : ${N.score} / 100, ton meilleur résultat. Il compte pour l'exercice noté et le livret.` : `Montage rendu : ${N.score} / 100 (ton meilleur reste ${r.best ? r.best.score : N.score} / 100).`);
        ctx.panel('mission');
      } }, 'Rendre le montage'),
      el('button', { type: 'button', class: 'btn small', 'data-k': 'mission:cr', onclick: async () => { const res = await offerDownload(`compte-rendu-entrepot-${m.id}.html`, compteRendu(m, ctx)); ctx.say(res === 'saved' ? 'Compte rendu enregistré.' : 'Téléchargement impossible.'); } }, 'Compte rendu (HTML)'),
      el('button', { type: 'button', class: 'btn small', 'data-k': 'mission:vider', onclick: async () => { if (await ask('Tout remettre au stock et recommencer la mission ?', { title: m.titre, ok: 'Recommencer' })) { vider(m.id); ctx.panel('mission'); } } }, 'Recommencer')),
    N.score >= 60 ? null : el('p', { class: 'note' }, 'L\'exercice noté est réussi à partir de 60 / 100. Lis l\'explication de chaque exigence manquante : elle dit ce que le moteur constate.'));
  if (R && R.runs && R.runs.length) box.append(el('details', { class: 'ep-cf' }, el('summary', {}, `Tes essais (${R.runs.length})`), el('ul', { class: 'ep-cf-list' }, ...R.runs.slice().reverse().map((x) => el('li', {}, el('span', {}, `${x.score} / 100`), el('small', {}, `${date(x.at)}${x.budget != null ? ` · ${x.budget.toLocaleString('fr-FR')} €` : ''}`))))));
  const comp = m.competences.map((c) => COMPETENCES.find((k) => k.code === c)).filter(Boolean);
  if (comp.length) box.append(el('h3', {}, 'Compétences du référentiel'), el('ul', { class: 'prose' }, ...comp.map((c) => el('li', {}, `${c.code} · ${c.titre}`))));
  if (L && ctx.quitter) box.append(el('p', { class: 'ep-app-foot' }, el('button', { type: 'button', class: 'btn small', 'data-k': 'mission:lecon', onclick: () => ctx.quitter && ctx.quitter() }, `Revenir à la leçon « ${L.lesson.title} »`)));
  return box;
}

/** le compte rendu de la mission : une page HTML autonome, à imprimer ou à rendre */
export function compteRendu(/** @type {Mission} */ m, /** @type {Ctx} */ ctx) {
  const N = noter(m, ctx.B, ctx.E, CATALOGUE);
  const h = (/** @type {any} */ s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tr = (/** @type {any[]} */ cells, th = false) => `<tr>${cells.map((c) => `<${th ? 'th' : 'td'}>${h(c)}</${th ? 'th' : 'td'}>`).join('')}</tr>`;
  const devs = ctx.B.appareils.filter((a) => a.modele !== 'mur');
  const mat = devs.map((a) => { const M = CATALOGUE[a.modele] || /** @type {any} */ ({}); return tr([a.nom, `${M.marque || ''} ${M.nom || a.modele}`, `${ZONES[a.place.zone].nom}${a.place.zone === 'rack' ? ' U ' + a.place.slot : ''}`, M.watts != null ? `${M.watts} W` : '', M.prix ? `${M.prix.toLocaleString('fr-FR')} €` : '']); }).join('');
  const cab = ctx.B.cables.map((c, i) => {
    const A = appareil(c.a.dev), Bd = appareil(c.b.dev); const pa = A ? portOf(A.modele, c.a.port) : null, pb = Bd ? portOf(Bd.modele, c.b.port) : null; const st = ctx.E.cables[c.uid];
    return tr([i + 1, `${A ? A.nom : '?'} · ${pa ? pa.label : c.a.port}`, `${Bd ? Bd.nom : '?'} · ${pb ? pb.label : c.b.port}`, SIGNAUX[c.sig].nom, `${SIGNAUX[c.sig].cable}${pa ? ` (${CONNECTEURS[pa.kind].nom})` : ''}`, st && !st.ok ? `faux : ${st.why}` : 'bon']);
  }).join('');
  const ips = devs.filter((a) => ctx.E.ip[a.uid]).map((a) => { const x = ctx.E.ip[a.uid]; return tr([a.nom, x.ip + (x.dhcp ? ' (DHCP)' : ''), x.mask, x.gw || '—', x.link ? x.domaine : 'pas de lien', x.conflit ? 'conflit' : '']); }).join('');
  const al = ctx.E.alertes.filter((x) => x.level !== 'info').map((x) => `<li class="${h(x.level)}">${h((appareil(x.dev) || { nom: x.dev }).nom)} : ${h(x.msg)}</li>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Compte rendu · ${h(m.titre)}</title><style>
body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1c2227;max-width:980px;margin:24px auto;padding:0 16px}h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:22px 0 6px;border-bottom:2px solid #1c2227}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #c9cfd4;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eef1f3}.ok{color:#1b7442}.ko{color:#b8261b}.part{color:#9c6100}.score{font-size:30px;font-weight:700}.erreur{color:#b8261b}.attention{color:#9c6100}small{color:#56616b}</style></head><body>
<h1>Compte rendu · ${h(m.titre)}</h1><p><b>${h(m.client)}</b> · ${h(date(Date.now()))} · TIEE Simulator, L'entrepôt</p><p>${h(m.brief)}</p>
<p class="score">${N.score} / 100</p>${N.budget ? `<p class="${N.budget.ok ? 'ok' : 'ko'}">Budget : ${N.budget.used.toLocaleString('fr-FR')} € sur ${N.budget.max.toLocaleString('fr-FR')} € (ordres de grandeur)</p>` : ''}
<h2>Exigences</h2><table>${tr(['Exigence', 'Points', 'État', 'Ce que constate le simulateur'], true)}${N.items.map((i) => `<tr><td>${h(i.label)}</td><td>${i.ok ? i.pts : i.partiel ? i.pts / 2 : 0} / ${i.pts}</td><td class="${i.ok ? 'ok' : i.partiel ? 'part' : 'ko'}">${i.ok ? 'acquise' : i.partiel ? 'partielle' : 'manquante'}</td><td>${h(i.why)}</td></tr>`).join('')}</table>
<h2>Matériel sorti du stock (${devs.length})</h2><table>${tr(['Nom', 'Modèle', 'Place', 'Consommation', 'Prix (ordre de grandeur)'], true)}${mat}</table>
<h2>Liste de câblage (${ctx.B.cables.length})</h2><table>${tr(['N°', 'De', 'Vers', 'Signal', 'Câble', 'État'], true)}${cab}</table>
<h2>Plan d'adressage</h2><table>${tr(['Appareil', 'Adresse', 'Masque', 'Passerelle', 'Domaine', ''], true)}${ips}</table>
${al ? `<h2>Alertes restantes</h2><ul>${al}</ul>` : ''}
<p><small>Simulation pédagogique : prix et consommations sont des ordres de grandeur. Compétences visées : ${h(m.competences.join(', '))}.</small></p></body></html>`;
}
