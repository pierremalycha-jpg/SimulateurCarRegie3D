// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { modal, toast, selectEl } from './common.js';
import { SH, CFG, MYREV, saveConfig, canConfigure, saveMyReviewSoon, saveMyReview, watchReviews, profilesOf, offerDownload } from '../shared.js';
import { REVIEW_ITEMS, REVIEW_STATUS, OPINIONS, whereOf } from '../review.js';
import { DOMAINS, GROUP_DOMAIN, initParams, paramById, fmtParam } from '../params.js';
import { GUIDE } from '../content/guide.js';

// ----------------------------------------------------------------------------------
// Relecture métier. Chaque expert (vision, son, réseau, ralentis, HF…) donne son avis
// point par point, propose des valeurs chiffrées et signale d'autres erreurs ; tout est
// enregistré dans sa propre fiche (review/<id>) et visible des autres relecteurs.
// Le formateur consolide : il arbitre chaque point et applique les corrections chiffrées,
// qui modifient aussitôt le simulateur pour tout le monde.
// ----------------------------------------------------------------------------------
const domainOf = (group) => GROUP_DOMAIN[group] || 'stade';
const chapterTitle = (id) => (GUIDE.find((g) => g.id === id) || {}).title || id;
const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const dateFr = (t) => (t ? new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export function openReview(tab = 'me') {
  const tabs = el('div', { class: 'tabs' });
  const content = el('div', { class: 'list' });
  const T = [['me', 'Ma relecture'], ['values', 'Valeurs chiffrées'], ['extra', 'Autres remarques'], ['synth', 'Synthèse et arbitrage']];
  let unwatch = null;
  const show = (k) => {
    if (unwatch) { unwatch(); unwatch = null; }
    content.innerHTML = '';
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    const r = ({ me: tabMe, values: tabValues, extra: tabExtra, synth: tabSynth })[k](content, show);
    if (typeof r === 'function') unwatch = r;
  };
  for (const [k, l] of T) tabs.appendChild(el('button', { class: 'tab', 'data-k': k, onclick: () => show(k) }, l));
  const who = el('p', { class: 'note' });
  identity().then((n) => { who.textContent = SH.db ? `Vous relisez en tant que ${n}. Vos avis sont enregistrés au fil de l'eau dans votre fiche, visible des autres relecteurs et du formateur.` : 'Mode local : vos avis restent dans ce navigateur. Une fois la page ouverte dans claude.ai, chaque relecteur a sa fiche partagée.'; });
  modal.open('Relecture technique par les métiers', el('div', { class: 'list' }, who, tabs, content), { width: 1180, onClose: () => { if (unwatch) unwatch(); saveMyReview(); } });
  show(tab);
}
async function identity() {
  if (!SH.uid) return 'relecteur local';
  const p = await profilesOf([SH.uid]);
  return (p[SH.uid] && p[SH.uid].name) || 'relecteur';
}

// choix des domaines du relecteur
function domainChips(onChange) {
  const box = el('div', { class: 'hwrow rv-dom' }, el('span', { class: 'rl' }, 'Mes domaines'));
  const sync = () => [...box.querySelectorAll('button')].forEach((b) => b.classList.toggle('lit', MYREV.domains.includes(b.dataset.d)));
  for (const [k, l] of Object.entries(DOMAINS)) {
    box.appendChild(el('button', { class: 'hw small', 'data-d': k, onclick: () => { const i = MYREV.domains.indexOf(k); if (i >= 0) MYREV.domains.splice(i, 1); else MYREV.domains.push(k); sync(); saveMyReviewSoon(); onChange(); } }, l));
  }
  box.appendChild(el('span', { class: 'note' }, 'Aucun choisi = tous les domaines.'));
  sync();
  return box;
}
const inMyDomains = (d) => !MYREV.domains.length || MYREV.domains.includes(d);

// ---------------- ma relecture : avis point par point ----------------
function tabMe(box) {
  const list = el('div', { class: 'list' });
  const count = el('span', { class: 'pill' });
  let onlyTodo = false;
  const todoBtn = el('button', { class: 'btn small', onclick: () => { onlyTodo = !onlyTodo; todoBtn.classList.toggle('primary', onlyTodo); draw(); } }, 'Seulement les points sans avis');
  const draw = () => {
    list.innerHTML = '';
    const items = REVIEW_ITEMS.filter(([, g]) => inMyDomains(domainOf(g)));
    const answered = items.filter(([id]) => MYREV.items[id] && MYREV.items[id].op).length;
    count.textContent = `${answered} / ${items.length} points relus`;
    let lastG = '';
    for (const [id, g, text, src] of items) {
      const mine = MYREV.items[id] = MYREV.items[id] || {};
      if (onlyTodo && mine.op) continue;
      if (g !== lastG) { list.append(el('h3', { class: 'eq-h' }, `${g} · ${DOMAINS[domainOf(g)]}`)); lastG = g; }
      const where = whereOf(g);
      const dec = CFG.review.items && CFG.review.items[id];
      const ops = el('div', { class: 'hwrow' });
      const note = el('textarea', { rows: 2, maxlength: 600, placeholder: 'Votre remarque : ce qui est faux, la bonne valeur, votre source ou votre pratique sur le terrain', 'aria-label': 'Remarque' });
      note.value = mine.note || '';
      note.addEventListener('input', () => { mine.note = note.value; mine.at = Date.now(); saveMyReviewSoon(); });
      for (const [k, [l, cls]] of Object.entries(OPINIONS)) {
        const b = el('button', { class: 'btn small rv-op ' + cls, onclick: () => { mine.op = mine.op === k ? '' : k; mine.at = Date.now(); saveMyReviewSoon(); card.dataset.op = mine.op; [...ops.children].forEach((x) => x.classList.toggle('on', x.dataset.k === mine.op)); count.textContent = `${items.filter(([i]) => MYREV.items[i] && MYREV.items[i].op).length} / ${items.length} points relus`; } }, l);
        b.dataset.k = k; b.classList.toggle('on', mine.op === k); ops.appendChild(b);
      }
      const links = el('div', { class: 'hwrow' });
      if (where.guide) links.append(el('button', { class: 'btn small', onclick: () => { modal.close(); emit('openGuide', where.guide); } }, 'Voir le guide : ' + chapterTitle(where.guide)));
      if (where.station && S.mode !== 'start') links.append(el('button', { class: 'btn small', onclick: () => { modal.close(); emit('openStationNow', { id: where.station }); } }, 'Ouvrir le poste'));
      const card = el('div', { class: 'item review rv-card', 'data-op': mine.op || '' },
        el('div', { class: 'grow' }, el('div', { class: 't' }, text), el('div', { class: 's' }, 'Source : ' + src),
          dec && dec.status ? el('div', { class: 's' }, `Arbitrage du formateur : ${REVIEW_STATUS[dec.status]}${dec.note ? ' — ' + dec.note : ''}`) : null,
          ops, note, links));
      list.append(card);
    }
  };
  box.append(el('p', { class: 'note' }, 'Pour chaque affirmation du simulateur : Exact, À corriger (dites ce qui est juste), Je ne sais pas, ou Non applicable à votre car. Les boutons « Voir le guide » et « Ouvrir le poste » montrent l\'endroit concerné. Pour corriger un chiffre (focale, seuil, portée…), utilisez l\'onglet « Valeurs chiffrées ».'),
    domainChips(draw), el('div', { class: 'hwrow' }, count, todoBtn), list);
  draw();
}

// ---------------- valeurs chiffrées : propositions ----------------
function tabValues(box) {
  const list = el('div', { class: 'list' });
  const draw = () => {
    list.innerHTML = '';
    const P = initParams().filter((p) => inMyDomains(p.domain));
    const groups = [...new Set(P.map((p) => p.group))];
    for (const g of groups) {
      const tb = el('tbody');
      for (const p of P.filter((x) => x.group === g)) {
        const mine = MYREV.params[p.id] = MYREV.params[p.id] || {};
        const inp = el('input', { type: 'number', step: 'any', value: mine.v ?? '', placeholder: String(p.get()).replace('.', ','), 'aria-label': `${g} · ${p.label}`, style: { width: '96px' } });
        const why = el('input', { type: 'text', value: mine.note || '', maxlength: 200, placeholder: 'Source / justification', 'aria-label': 'Justification' });
        inp.addEventListener('input', () => { mine.v = inp.value === '' ? null : +inp.value; mine.at = Date.now(); saveMyReviewSoon(); tr.classList.toggle('rv-prop', mine.v != null); });
        why.addEventListener('input', () => { mine.note = why.value; saveMyReviewSoon(); });
        const cur = p.get(); const changed = cur !== p.def;
        const tr = el('tr', { class: mine.v != null ? 'rv-prop' : '' }, el('td', {}, p.label), el('td', { class: 'mono' }, fmtParam(p, cur), changed ? el('small', { class: 'note' }, ` (origine ${fmtParam(p, p.def)})`) : null), el('td', {}, inp, ' ', p.unit === 'f/' ? '' : p.unit), el('td', {}, why));
        tb.append(tr);
      }
      list.append(el('h3', { class: 'eq-h' }, g), el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, 'Paramètre'), el('th', {}, 'Valeur dans le simulateur'), el('th', {}, 'Ma proposition'), el('th', {}, 'Justification'))), tb)));
    }
  };
  box.append(el('p', { class: 'note' }, 'Ces chiffres pilotent réellement le simulateur (champ des objectifs, rampe d\'ouverture, seuils HF, portées des câbles, tolérances…). Proposez la bonne valeur : le formateur l\'applique en un clic depuis la synthèse, pour tout le monde.'), domainChips(draw), list);
  draw();
}

// ---------------- autres remarques ----------------
function tabExtra(box) {
  const list = el('div', { class: 'list' });
  const dom = selectEl(Object.entries(DOMAINS), MYREV.domains[0] || 'vision', () => {});
  const where = el('input', { type: 'text', id: 'rv-where', maxlength: 120, placeholder: 'Où ? (poste, chapitre du guide, appareil…)' });
  const text = el('textarea', { rows: 3, maxlength: 1000, 'aria-label': 'Remarque', placeholder: 'Ce qui est faux, ce qui manque, ce qui ne se fait pas comme ça sur le terrain…' });
  const draw = () => {
    list.innerHTML = '';
    if (!MYREV.extra.length) list.append(el('p', { class: 'note' }, 'Aucune autre remarque pour l\'instant.'));
    MYREV.extra.forEach((x, i) => list.append(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, x.text), el('div', { class: 's' }, `${DOMAINS[x.domain] || x.domain} · ${x.where || '—'} · ${dateFr(x.at)}`)),
      el('button', { class: 'btn small', onclick: () => { MYREV.extra.splice(i, 1); saveMyReviewSoon(); draw(); } }, 'Retirer'))));
  };
  box.append(el('p', { class: 'note' }, 'Tout ce qui n\'est pas dans la liste : une procédure différente chez vous, un réglage irréaliste, un vocabulaire maison, un manque.'),
    el('div', { class: 'grid2' }, el('div', { class: 'field' }, el('label', { for: dom.id }, 'Domaine'), dom), el('div', { class: 'field' }, el('label', { for: 'rv-where' }, 'Endroit'), where)), text,
    el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', onclick: () => { if (!text.value.trim()) { toast('Écrivez la remarque d\'abord.'); return; } MYREV.extra.push({ at: Date.now(), domain: dom.value, where: where.value.trim(), text: text.value.trim() }); text.value = ''; where.value = ''; saveMyReviewSoon(); draw(); } }, 'Ajouter la remarque')), list);
  draw();
}

// ---------------- synthèse et arbitrage (formateur) ----------------
function tabSynth(box, show) {
  const editable = canConfigure();
  const head = el('div', { class: 'list' });
  const body = el('div', { class: 'list' });
  let reviews = [], names = {}, filter = 'issues';
  const decisions = { ...(CFG.review.items || {}) };
  const overrides = { ...(CFG.review.overrides || {}) };
  const persist = async () => { const r = await saveConfig('review', { ...CFG.review, items: decisions, overrides }); toast(r.ok ? (r.local ? 'Arbitrage enregistré dans ce navigateur' : 'Arbitrage enregistré et partagé') : `Arbitrage non enregistré (${r.message || r.code}) : réessayez dans un instant.`, r.ok ? 'good' : 'bad', r.ok ? 3200 : 6000); };
  const nm = (id) => (id === SH.uid ? 'vous' : (names[id] && names[id].name) || 'relecteur');
  const fBtns = el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Afficher'));
  for (const [k, l] of [['issues', 'Points à arbitrer (à corriger, désaccords)'], ['all', 'Tous les points'], ['values', 'Valeurs proposées'], ['extra', 'Autres remarques']]) fBtns.append(el('button', { class: 'hw small', 'data-f': k, onclick: () => { filter = k; draw(); } }, l));
  const draw = () => {
    [...fBtns.querySelectorAll('button')].forEach((b) => b.classList.toggle('lit', b.dataset.f === filter));
    head.innerHTML = ''; body.innerHTML = '';
    // relecteurs
    const tb = el('tbody');
    for (const r of reviews) {
      const d = r.data || {}; const its = Object.values(d.items || {}).filter((x) => x.op);
      tb.append(el('tr', {}, el('td', {}, nm(r.id)), el('td', {}, (d.domains || []).map((k) => DOMAINS[k]).join(', ') || 'tous'), el('td', {}, String(its.length)), el('td', {}, String(its.filter((x) => x.op === 'fix').length)), el('td', {}, String(Object.values(d.params || {}).filter((x) => x && x.v != null).length)), el('td', {}, String((d.extra || []).length)), el('td', {}, dateFr(d.updatedAt))));
    }
    head.append(el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, ...['Relecteur', 'Domaines', 'Avis', 'À corriger', 'Valeurs proposées', 'Autres remarques', 'Mis à jour'].map((h) => el('th', {}, h)))), tb));
    if (!reviews.length) head.append(el('p', { class: 'note' }, 'Aucune relecture pour l\'instant. Partagez la page avec vos experts (au moins au niveau Contributeur) et demandez-leur d\'ouvrir « Relecture technique » sur l\'écran d\'accueil.'));
    if (filter === 'values') return drawValues();
    if (filter === 'extra') return drawExtra();
    let lastG = '';
    for (const [id, g, text] of REVIEW_ITEMS) {
      const ops = reviews.map((r) => ({ who: r.id, ...((r.data.items || {})[id] || {}) })).filter((x) => x.op || x.note);
      const kinds = new Set(ops.map((x) => x.op).filter((x) => x === 'ok' || x === 'fix'));
      const dec = decisions[id] = decisions[id] || { status: '', note: '' };
      if (filter === 'issues' && !(ops.some((x) => x.op === 'fix') || kinds.size > 1 || (ops.some((x) => x.note) && !dec.status))) continue;
      if (g !== lastG) { body.append(el('h3', { class: 'eq-h' }, g)); lastG = g; }
      const cnt = (k) => ops.filter((x) => x.op === k).length;
      const st = selectEl(Object.entries(REVIEW_STATUS), dec.status, (v) => { dec.status = v; });
      const note = el('input', { type: 'text', value: dec.note || '', maxlength: 300, placeholder: 'Décision / correction retenue', 'aria-label': 'Décision' }); note.oninput = () => { dec.note = note.value; };
      st.disabled = !editable; note.disabled = !editable;
      body.append(el('div', { class: 'item review', 'data-s': dec.status }, el('div', { class: 'grow' }, el('div', { class: 't' }, text),
        el('div', { class: 'hwrow' }, ...Object.entries(OPINIONS).map(([k, [l, cls]]) => el('span', { class: 'pill ' + cls }, `${l} ${cnt(k)}`))),
        ...ops.filter((x) => x.note).map((x) => el('div', { class: 's' }, `${nm(x.who)} (${OPINIONS[x.op] ? OPINIONS[x.op][0] : 'sans avis'}) : ${x.note}`)), note), st));
    }
    if (!body.children.length) body.append(el('p', { class: 'note' }, 'Rien à arbitrer avec ce filtre.'));
  };
  function drawValues() {
    const all = {};
    for (const r of reviews) for (const [pid, x] of Object.entries(r.data.params || {})) if (x && x.v != null) (all[pid] = all[pid] || []).push({ who: r.id, ...x });
    const ids = Object.keys(all).concat(Object.keys(overrides).filter((k) => !all[k]));
    if (!ids.length) { body.append(el('p', { class: 'note' }, 'Aucune valeur proposée.')); return; }
    const tb = el('tbody');
    for (const pid of ids) {
      const p = paramById(pid); if (!p) continue;
      const props = all[pid] || [];
      const cell = el('td');
      for (const x of props) cell.append(el('div', {}, `${nm(x.who)} : `, el('b', {}, fmtParam(p, x.v)), x.note ? el('small', { class: 'note' }, ' — ' + x.note) : null, ' ', el('button', { class: 'btn small primary', disabled: !editable, onclick: async () => { overrides[pid] = x.v; await persist(); draw(); } }, 'Appliquer')));
      tb.append(el('tr', {}, el('td', {}, `${p.group} · ${p.label}`), el('td', { class: 'mono' }, fmtParam(p, p.def)), el('td', { class: 'mono ' + (overrides[pid] != null ? 'ok' : '') }, overrides[pid] != null ? fmtParam(p, overrides[pid]) : '—'), cell,
        el('td', {}, overrides[pid] != null ? el('button', { class: 'btn small', disabled: !editable, onclick: async () => { delete overrides[pid]; await persist(); draw(); } }, 'Rétablir l\'origine') : '')));
    }
    body.append(el('p', { class: 'note' }, 'Une valeur appliquée modifie tout de suite le simulateur pour tous ceux qui ouvrent la page (focales et ouvertures, seuils HF, portées, tolérances). « Rétablir l\'origine » remet le chiffre de départ.'),
      el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, ...['Paramètre', 'Origine', 'Appliqué', 'Propositions', ''].map((h) => el('th', {}, h)))), tb)));
  }
  function drawExtra() {
    const xs = reviews.flatMap((r) => (r.data.extra || []).map((x) => ({ who: r.id, ...x }))).sort((a, b) => b.at - a.at);
    if (!xs.length) { body.append(el('p', { class: 'note' }, 'Aucune autre remarque.')); return; }
    for (const x of xs) body.append(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, x.text), el('div', { class: 's' }, `${nm(x.who)} · ${DOMAINS[x.domain] || x.domain} · ${x.where || '—'} · ${dateFr(x.at)}`))));
  }
  const exportCsv = () => {
    const lines = ['Domaine;Groupe;Point;Relecteur;Avis;Remarque;Arbitrage;Décision'];
    for (const [id, g, text] of REVIEW_ITEMS) {
      const dec = decisions[id] || {};
      const ops = reviews.map((r) => ({ who: r.id, ...((r.data.items || {})[id] || {}) })).filter((x) => x.op || x.note);
      if (!ops.length) lines.push([DOMAINS[domainOf(g)], g, text, '', '', '', REVIEW_STATUS[dec.status || ''], dec.note].map(esc).join(';'));
      for (const x of ops) lines.push([DOMAINS[domainOf(g)], g, text, nm(x.who), OPINIONS[x.op] ? OPINIONS[x.op][0] : '', x.note, REVIEW_STATUS[dec.status || ''], dec.note].map(esc).join(';'));
    }
    lines.push('', 'Paramètre;Origine;Appliqué;Relecteur;Proposition;Justification');
    for (const r of reviews) for (const [pid, x] of Object.entries(r.data.params || {})) { const p = paramById(pid); if (p && x && x.v != null) lines.push([`${p.group} · ${p.label}`, fmtParam(p, p.def), overrides[pid] != null ? fmtParam(p, overrides[pid]) : '', nm(r.id), fmtParam(p, x.v), x.note].map(esc).join(';')); }
    lines.push('', 'Autres remarques;Relecteur;Domaine;Endroit;Date');
    for (const r of reviews) for (const x of r.data.extra || []) lines.push([x.text, nm(r.id), DOMAINS[x.domain] || x.domain, x.where, dateFr(x.at)].map(esc).join(';'));
    offerDownload('relecture-metier.csv', '﻿' + lines.join('\r\n'));
  };
  const exportHtml = () => {
    const h = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    let out = `<!doctype html><meta charset="utf-8"><title>Relecture métier</title><style>body{font:14px system-ui;margin:24px;max-width:1000px}h2{border-bottom:2px solid #333;margin-top:28px}td,th{border:1px solid #bbb;padding:4px 6px;vertical-align:top}table{border-collapse:collapse;width:100%}.fix{color:#a11}.ok{color:#171}</style><h1>Relecture métier du simulateur</h1><p>Export du ${h(dateFr(Date.now()))} · ${reviews.length} relecteur(s).</p>`;
    for (const [k, l] of Object.entries(DOMAINS)) {
      const its = REVIEW_ITEMS.filter(([, g]) => domainOf(g) === k); if (!its.length) continue;
      out += `<h2>${h(l)}</h2><table><tr><th>Point</th><th>Avis des relecteurs</th><th>Arbitrage</th></tr>`;
      for (const [id, , text] of its) {
        const ops = reviews.map((r) => ({ who: r.id, ...((r.data.items || {})[id] || {}) })).filter((x) => x.op || x.note);
        const dec = decisions[id] || {};
        out += `<tr><td>${h(text)}</td><td>${ops.map((x) => `<div class="${x.op === 'fix' ? 'fix' : x.op === 'ok' ? 'ok' : ''}"><b>${h(nm(x.who))}</b> : ${h(OPINIONS[x.op] ? OPINIONS[x.op][0] : '')}${x.note ? ' — ' + h(x.note) : ''}</div>`).join('') || '—'}</td><td>${h(REVIEW_STATUS[dec.status || ''])}${dec.note ? '<br>' + h(dec.note) : ''}</td></tr>`;
      }
      out += '</table>';
    }
    offerDownload('relecture-metier.html', out);
  };
  box.append(el('p', { class: 'note' }, editable ? 'Vous arbitrez : pour chaque point, retenez un statut et notez la correction ; appliquez les valeurs chiffrées proposées. Tout est partagé.' : 'Lecture seule : seuls le propriétaire et les éditeurs de la page arbitrent. Vous voyez les avis des autres relecteurs.'),
    head, fBtns, body,
    el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', disabled: !editable, onclick: persist }, 'Enregistrer l\'arbitrage'), el('button', { class: 'btn', onclick: exportCsv }, 'Exporter (CSV)'), el('button', { class: 'btn', onclick: exportHtml }, 'Exporter le rapport (HTML imprimable)')));
  draw();
  return watchReviews(async (list) => {
    reviews = (list || []).filter((r) => r && r.data);
    const ids = reviews.map((r) => r.id).filter((id) => id && id !== 'local');
    names = await profilesOf(ids);
    if (box.isConnected) draw();
  });
}
on('config', (k) => { if (k === 'review') { /* les valeurs sont réappliquées par shared.applyConfig */ } });
