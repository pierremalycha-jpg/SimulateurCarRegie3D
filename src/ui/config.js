import { S, emit } from '../state.js';
import { el, fmt } from '../util.js';
import { modal, toast, selectEl, field } from './common.js';
import { SH, CFG, PROG, saveConfig, canConfigure, watchAllProgress, profilesOf, uploadPhoto, photoUrl, offerDownload } from '../shared.js';
import { EQUIP, evsLayout } from '../equip.js';
import { buildCabling, endLabel, SIG } from '../equipment/cabling.js';
import { DEVICES, DEVICE_LIST } from '../equipment/devices.js';
import { REVIEW_ITEMS, REVIEW_STATUS } from '../review.js';
import { MISSIONS } from './guide.js';
import { EMB_OPTIONS, SOUND_PLAN } from '../audio.js';

// ----------------------------------------------------------------------------------
// Espace formateur : configuration partagée du car, suivi des stagiaires, relecture
// ----------------------------------------------------------------------------------
export const DEFAULT_CHECKLIST = ['Terre raccordée, énergie vérifiée (phases, neutre)', 'Toutes les caméras alimentées, niveaux optiques corrects', 'Référence (genlock) verrouillée sur toutes les CCU', 'Balance des noirs et des blancs, matching vision', 'Noms de sources et tally vérifiés au multiview', 'Test de chaque position intercom (cadreurs, EVS, son, commentateurs)', 'Entrées d\'enregistrement EVS affectées (super ralentis compris)', 'Test des micros et du 1 kHz -18 dBFS', 'Mire + 1 kHz envoyées à la chaîne, ident vérifié', 'Retour antenne contrôlé, chemin de secours testé', 'Fréquences HF vérifiées sur le spectre, marges correctes'];
export function checklistItems() { return CFG.car.checklist && CFG.car.checklist.length ? CFG.car.checklist : DEFAULT_CHECKLIST; }

const TABS = [['car', 'Le car'], ['cables', 'Liste de câblage'], ['proc', 'Procédures'], ['photos', 'Photos du matériel'], ['eleves', 'Stagiaires'], ['review', 'Relecture technique']];

export function openTrainer(tab = 'car') {
  const tabs = el('div', { class: 'tabs' });
  const content = el('div', { class: 'list' });
  const editable = canConfigure();
  const notice = el('p', { class: 'note ' + (editable ? '' : 'warn') }, !SH.db
    ? 'Mode local : les réglages sont enregistrés dans ce navigateur uniquement. Une fois la page ouverte dans claude.ai, ils sont partagés avec toutes les personnes qui ont accès à la page.'
    : editable ? 'Vous pouvez modifier ces réglages : ils s\'appliquent à toutes les personnes qui ouvrent la page.' : 'Seuls le propriétaire et les éditeurs de la page peuvent modifier ces réglages. Vous les voyez en lecture seule.');
  const show = (k) => {
    content.innerHTML = '';
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    ({ car: tabCar, cables: tabCables, proc: tabProc, photos: tabPhotos, eleves: tabEleves, review: tabReview })[k](content, editable);
  };
  for (const [k, l] of TABS) tabs.appendChild(el('button', { class: 'tab', 'data-k': k, onclick: () => show(k) }, l));
  modal.open('Espace formateur', el('div', { class: 'list' }, notice, tabs, content), { width: 1100 });
  show(tab);
}

const saved = (r) => toast(r.ok ? (r.local ? 'Enregistré dans ce navigateur' : 'Enregistré et partagé') : `Échec de l'enregistrement : ${r.message || r.code}`, r.ok ? 'good' : 'bad');

// ---------------- le car ----------------
function tabCar(box, editable) {
  const c = { ...CFG.car, equip: { ...(CFG.car.equip || {}) } };
  const name = el('input', { type: 'text', value: c.name || '', placeholder: 'ex. Car 12 · régie HD', maxlength: 40 });
  const company = el('input', { type: 'text', value: c.company || '', placeholder: 'Société (affiché sur l\'écran d\'accueil)', maxlength: 40 });
  const eq = c.equip;
  const sel = (key, opts, def) => selectEl(opts, eq[key] ?? def, (v) => { eq[key] = +v; });
  const fields = el('div', { class: 'grid2' },
    field('Nom du car', name), field('Société / service', company),
    field('Serveurs EVS XT4K', sel('evsServers', [[1, '1 serveur'], [2, '2 serveurs']], EQUIP.evsServers)),
    field('Canaux HD par XT4K', sel('evsHdChannels', [[8, '8 canaux (standard)'], [12, '12 canaux (ChannelMAX)']], EQUIP.evsHdChannels)),
    field('Télécommandes LSM', sel('lsmCount', [[1, '1 LSM (pilote PGM1 et PGM2)'], [2, '2 LSM']], EQUIP.lsmCount)),
    field('Entrées du XVS-6000 en 4K', sel('mix4kInputs', [[16, '16 (configuration de base)'], [22, '22 (cartes supplémentaires)']], EQUIP.mix4kInputs)));
  const L = evsLayout();
  const plan = [...(c.soundPlan || SOUND_PLAN)];
  const planRow = el('div', { class: 'grid2' }, ...plan.map((v, i) => field(`Paire ${2 * i + 1}-${2 * i + 2} du départ`, selectEl(EMB_OPTIONS, v, (nv) => { plan[i] = nv; }))));
  box.append(el('h3', { class: 'eq-h' }, 'Identité et matériel du car'), fields,
    el('div', { class: 'kv' }, el('dt', {}, 'Mélangeur'), el('dd', {}, `${EQUIP.mixer} + pupitre ${EQUIP.mixPanel}`), el('dt', {}, 'Ralentis'), el('dd', {}, `${EQUIP.evsServers} × EVS ${EQUIP.evsModel}, ${EQUIP.lsmCount} LSM, IPDirector`), el('dt', {}, 'Répartition EVS (format actuel)'), el('dd', {}, L.label)),
    el('p', { class: 'note' }, 'Les changements de matériel s\'appliquent au prochain démarrage du simulateur (bouton « Accueil » ou rechargement de la page).'),
    el('h3', { class: 'eq-h' }, 'Plan de son habituel (embedder du départ)'), planRow,
    el('p', { class: 'note' }, 'C\'est le plan que la régie son doit reproduire sur l\'embedder, et que la chaîne vérifie pendant le test de ligne du scénario.'),
    el('button', { class: 'btn primary', disabled: !editable, onclick: async () => { c.name = name.value.trim(); c.company = company.value.trim(); c.soundPlan = plan; saved(await saveConfig('car', c)); } }, 'Enregistrer'));
}

// ---------------- liste de câblage : import / export ----------------
const COLS = [['n', /^(n°|no\b|num|numéro|id|repère|ref|câble n)/i], ['a', /(origine|source|^de\b|départ|from|côté a|extrémité a)/i], ['b', /(destination|vers|arrivée|^to\b|côté b|extrémité b)/i], ['type', /(type|câble|cable|support|modèle)/i], ['len', /(long|mètre|\bm\b)/i], ['sig', /(signal|nature)/i], ['note', /(remarque|note|comment|obs)/i]];
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"') q = true; else if (ch === delim) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
function mapRows(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => String(h).trim());
  const idx = {}; let hits = 0;
  for (const [k, re] of COLS) { const i = head.findIndex((h, j) => re.test(h) && !Object.values(idx).includes(j)); if (i >= 0) { idx[k] = i; hits++; } }
  const body = hits >= 2 ? rows.slice(1) : rows;
  if (hits < 2) COLS.forEach(([k], i) => { idx[k] = i; });
  const cell = (r, k) => (idx[k] != null && r[idx[k]] != null ? String(r[idx[k]]).trim().slice(0, 120) : '');
  return body.slice(0, 1500).map((r, i) => ({ n: cell(r, 'n') || 'L' + (i + 1), a: cell(r, 'a'), b: cell(r, 'b'), type: cell(r, 'type'), len: cell(r, 'len'), sig: cell(r, 'sig'), note: cell(r, 'note') })).filter((r) => r.a || r.b);
}
let xlsxLoading = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxLoading) return xlsxLoading;
  xlsxLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => { xlsxLoading = null; rej(new Error('Lecteur Excel indisponible')); }; document.head.appendChild(s); });
  return xlsxLoading;
}
async function readCablingFile(file) {
  if (/\.xlsx?$/i.test(file.name)) {
    const X = await loadXLSX();
    const wb = X.read(await file.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return mapRows(X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }));
  }
  const buf = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes(String.fromCharCode(0xfffd))) text = new TextDecoder('windows-1252').decode(buf); // export Excel « CSV (séparateur ;) »
  return mapRows(parseCSV(text));
}
export function cablingCSV(rows) {
  const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [['N°', 'Origine (A)', 'Destination (B)', 'Câble', 'Longueur (m)', 'Signal', 'Remarque'].join(';')];
  for (const r of rows) lines.push([r.n, r.a, r.b, r.type, r.len, r.sig, r.note].map(esc).join(';'));
  return '﻿' + lines.join('\r\n');
}
export function generatedRows() { return buildCabling().map((c) => ({ n: c.n, a: endLabel(c.a), b: endLabel(c.b), type: c.type, len: c.len || '', sig: SIG[c.sig] ? SIG[c.sig].label : c.sig, note: (c.note || '') + (c.ok ? '' : ' · DÉFAUT') })); }
function tabCables(box, editable) {
  const cur = CFG.cabling;
  const info = el('p', { class: 'note' }, cur && cur.rows ? `Liste importée : « ${cur.name} », ${cur.rows.length} lignes, le ${new Date(cur.importedAt).toLocaleString('fr-FR')}.` : 'Aucune liste importée : le simulateur utilise la liste générée à partir de l\'installation.');
  const input = el('input', { type: 'file', accept: '.csv,.txt,.xlsx,.xls', 'aria-label': 'Fichier de liste de câblage' });
  const preview = el('div', { class: 'tblwrap' });
  let pending = null;
  input.addEventListener('change', async () => {
    const f = input.files[0]; if (!f) return;
    preview.innerHTML = ''; pending = null;
    try {
      const rows = await readCablingFile(f);
      if (!rows.length) { toast('Aucune ligne reconnue dans ce fichier', 'bad'); return; }
      pending = { name: f.name, rows, importedAt: Date.now() };
      const t = el('table', { class: 'tbl compact cabtbl' }, el('thead', {}, el('tr', {}, ...['N°', 'Origine', 'Destination', 'Câble', 'Long.', 'Signal', 'Remarque'].map((h) => el('th', {}, h)))));
      const tb = el('tbody'); t.appendChild(tb);
      for (const r of rows.slice(0, 12)) tb.appendChild(el('tr', {}, ...['n', 'a', 'b', 'type', 'len', 'sig', 'note'].map((k) => el('td', {}, r[k]))));
      preview.append(el('p', { class: 'note' }, `${rows.length} lignes reconnues${rows.length >= 1500 ? ' (limité à 1 500)' : ''}. Aperçu des 12 premières :`), t);
      if (JSON.stringify(pending).length > 240000) { toast('Liste trop volumineuse pour être partagée : réduisez les colonnes Remarque.', 'bad'); pending = null; }
    } catch (e) { toast('Lecture impossible : ' + e.message, 'bad'); }
  });
  box.append(el('h3', { class: 'eq-h' }, 'Importer la liste de câblage de votre car'), info,
    el('p', { class: 'note' }, 'Formats : CSV (séparateur ; ou ,) ou Excel (.xlsx, première feuille). Colonnes reconnues par leur titre : N°, Origine, Destination, Câble/Type, Longueur, Signal, Remarque. Sans titres reconnus, l\'ordre ci-dessus est utilisé.'),
    el('div', { class: 'hwrow' }, input,
      el('button', { class: 'btn primary', disabled: !editable, onclick: async () => { if (!pending) { toast('Choisissez d\'abord un fichier'); return; } const r = await saveConfig('cabling', pending); saved(r); if (r.ok) { info.textContent = `Liste importée : « ${pending.name} », ${pending.rows.length} lignes.`; } } }, 'Enregistrer la liste'),
      el('button', { class: 'btn', disabled: !editable || !cur, onclick: async () => { saved(await saveConfig('cabling', null)); info.textContent = 'Liste importée supprimée.'; } }, 'Supprimer la liste importée')),
    preview,
    el('h3', { class: 'eq-h' }, 'Exporter'),
    el('div', { class: 'hwrow' },
      el('button', { class: 'btn', onclick: () => offerDownload('liste-cablage-simulateur.csv', cablingCSV(generatedRows())) }, 'Liste générée par le simulateur (CSV)'),
      cur && cur.rows ? el('button', { class: 'btn', onclick: () => offerDownload('liste-cablage-' + (CFG.car.name || 'car').replace(/\W+/g, '-') + '.csv', cablingCSV(cur.rows)) }, 'Liste importée (CSV)') : null),
    el('p', { class: 'note' }, 'La liste importée s\'affiche au poste Chef de car (onglet Liste de câblage). La liste générée suit l\'installation simulée et sert de modèle pour l\'exercice de brassage.'));
}

// ---------------- procédures ----------------
function tabProc(box, editable) {
  const c = { ...CFG.car };
  const chk = el('textarea', { rows: 12, style: { width: '100%' }, 'aria-label': 'Check-list de line-up' }, checklistItems().join('\n'));
  const procs = (c.procedures || []).map((p) => ({ ...p }));
  const list = el('div', { class: 'list' });
  const draw = () => {
    list.innerHTML = '';
    procs.forEach((p, i) => {
      const t = el('input', { type: 'text', value: p.title, maxlength: 80, 'aria-label': 'Titre de la procédure' }); t.oninput = () => { p.title = t.value; };
      const s = el('textarea', { rows: 6, style: { width: '100%' }, 'aria-label': 'Étapes, une par ligne' }, (p.steps || []).join('\n')); s.oninput = () => { p.steps = s.value.split('\n').map((x) => x.trim()).filter(Boolean); };
      list.append(el('div', { class: 'hwpanel' }, el('div', { class: 'hwrow' }, t, el('button', { class: 'btn small danger', disabled: !editable, onclick: () => { procs.splice(i, 1); draw(); } }, 'Supprimer')), s));
    });
  };
  draw();
  box.append(el('h3', { class: 'eq-h' }, 'Check-list de line-up (une ligne par point)'), el('p', { class: 'note' }, 'Remplace la check-list proposée au poste Chef de car.'), chk,
    el('h3', { class: 'eq-h' }, 'Procédures maison'), el('p', { class: 'note' }, 'Affichées dans le guide (onglet Procédures). Exemples : ouverture du car, procédure de mise en antenne, conduite à tenir en cas de perte de liaison.'), list,
    el('div', { class: 'hwrow' }, el('button', { class: 'btn', disabled: !editable, onclick: () => { procs.push({ title: 'Nouvelle procédure', steps: [] }); draw(); } }, 'Ajouter une procédure'),
      el('button', { class: 'btn primary', disabled: !editable, onclick: async () => { c.checklist = chk.value.split('\n').map((x) => x.trim()).filter(Boolean); c.procedures = procs.filter((p) => p.title); saved(await saveConfig('car', c)); } }, 'Enregistrer')));
}

// ---------------- photos du matériel ----------------
function tabPhotos(box, editable) {
  const list = (CFG.photos && CFG.photos.list ? CFG.photos.list : []).map((p) => ({ ...p, hotspots: [...(p.hotspots || [])] }));
  const grid = el('div', { class: 'grid2' });
  const editor = el('div', { class: 'list' });
  const devSel = selectEl(DEVICE_LIST.map(([k, l]) => [k, l]), 'ccu', () => {});
  const title = el('input', { type: 'text', placeholder: 'Titre (ex. CCU baie 1, face arrière)', maxlength: 60 });
  const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'aria-label': 'Photo du matériel' });
  const persist = async () => saved(await saveConfig('photos', { list }));
  const draw = () => {
    grid.innerHTML = '';
    list.forEach((p, i) => grid.appendChild(el('button', { class: 'choice', onclick: () => edit(i) }, el('img', { src: photoUrl(p), alt: p.title, style: { width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '4px' } }), el('b', { style: { fontSize: '15px' } }, p.title || 'Sans titre'), el('span', {}, `${(DEVICES[p.device] || {}).title || p.device} · ${p.hotspots.length} point(s)`))));
    if (!list.length) grid.appendChild(el('p', { class: 'note' }, 'Aucune photo pour l\'instant.'));
  };
  function edit(i) {
    const p = list[i]; editor.innerHTML = '';
    const def = DEVICES[p.device];
    const ports = def ? Object.entries({ ...def.ports, ...def.controls }) : [];
    const wrap = el('div', { class: 'photo-edit' });
    const img = el('img', { src: photoUrl(p), alt: p.title });
    wrap.appendChild(img);
    const marks = () => { wrap.querySelectorAll('.hs').forEach((m) => m.remove()); p.hotspots.forEach((h, j) => { const m = el('button', { class: 'hs', style: { left: h.x * 100 + '%', top: h.y * 100 + '%' }, title: h.label, onclick: (e) => { e.stopPropagation(); form(j); } }, String(j + 1)); wrap.appendChild(m); }); };
    const formBox = el('div', { class: 'list' });
    function form(j) {
      const h = p.hotspots[j]; formBox.innerHTML = '';
      const lab = el('input', { type: 'text', value: h.label || '', placeholder: 'Nom (ex. SDI 1)', maxlength: 40 });
      const port = selectEl([['', '— connecteur de la fiche (facultatif) —'], ...ports.map(([id, m]) => [id, m.n])], h.port || '', (v) => { h.port = v; if (v && !lab.value) { lab.value = (def.ports[v] || def.controls[v]).n; h.label = lab.value; } });
      const desc = el('textarea', { rows: 3, style: { width: '100%' }, placeholder: 'Ce que l\'on y branche dans votre car, remarques…' }, h.desc || '');
      lab.oninput = () => { h.label = lab.value; }; desc.oninput = () => { h.desc = desc.value.slice(0, 400); };
      formBox.append(el('h3', { class: 'eq-h' }, `Point ${j + 1}`), field('Nom', lab), field('Lien avec la fiche', port), field('Description', desc),
        el('div', { class: 'hwrow' }, el('button', { class: 'btn small danger', disabled: !editable, onclick: () => { p.hotspots.splice(j, 1); formBox.innerHTML = ''; marks(); } }, 'Supprimer ce point')));
    }
    wrap.addEventListener('click', (e) => { if (!editable) return; const r = img.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; if (x < 0 || y < 0 || x > 1 || y > 1) return; p.hotspots.push({ x: +x.toFixed(4), y: +y.toFixed(4), label: '', port: '', desc: '' }); marks(); form(p.hotspots.length - 1); });
    marks();
    editor.append(el('h3', { class: 'eq-h' }, `Points cliquables · ${p.title || ''}`), el('p', { class: 'note' }, editable ? 'Cliquez sur la photo pour ajouter un point (un connecteur, un voyant, une commande), puis renseignez-le.' : 'Lecture seule.'),
      el('div', { class: 'photo-grid' }, wrap, formBox),
      el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', disabled: !editable, onclick: persist }, 'Enregistrer'), el('button', { class: 'btn danger', disabled: !editable, onclick: async () => { list.splice(i, 1); editor.innerHTML = ''; draw(); await persist(); } }, 'Supprimer la photo')));
  }
  draw();
  box.append(el('h3', { class: 'eq-h' }, 'Photos de votre matériel'), el('p', { class: 'note' }, 'Ajoutez des photos de vos appareils (faces avant/arrière, baies) et placez-y des points cliquables : ils apparaissent dans la visionneuse de matériel, onglet « Photo ». ' + (SH.assets ? 'Les photos sont stockées avec la page et visibles par les personnes qui y ont accès.' : 'Hors de claude.ai, les photos restent dans ce navigateur.')),
    el('div', { class: 'hwrow' }, field('Appareil', devSel), field('Titre', title), file,
      el('button', { class: 'btn primary', disabled: !editable, onclick: async () => {
        const f = file.files[0]; if (!f) { toast('Choisissez une image'); return; }
        if (f.size > 15 * 1024 * 1024) { toast('Image trop lourde (15 Mo max)', 'bad'); return; }
        try { const r = await uploadPhoto(f); list.push({ asset: r.asset, url: r.asset ? null : r.url, device: devSel.value, title: title.value.trim() || f.name, hotspots: [] }); await persist(); draw(); edit(list.length - 1); }
        catch (e) { toast('Envoi impossible : ' + (e.message || e.code), 'bad'); }
      } }, 'Ajouter la photo')),
    grid, editor);
}

// ---------------- suivi des stagiaires ----------------
function tabEleves(box) {
  const canSeeAll = !SH.db || SH.canEdit || SH.isOwner;
  box.append(el('h3', { class: 'eq-h' }, 'Suivi des stagiaires'));
  if (!canSeeAll) { box.append(el('p', { class: 'note' }, 'Seul le formateur voit la progression de tous les stagiaires. Votre propre progression est enregistrée automatiquement.'), myProgress()); return; }
  const host = el('div', { class: 'list' });
  box.append(el('p', { class: 'note' }, SH.db ? 'Chaque personne qui ouvre la page avec un accès « Contributeur » enregistre sa progression ici (missions, scénarios, brassage, signalements d\'erreur, performances de son ordinateur). Avec un accès « Lecteur », la progression reste dans son navigateur.' : 'Mode local : seule la progression de ce navigateur est visible.'), host);
  let rows = [];
  const draw = async (list) => {
    host.innerHTML = '';
    if (!list) { host.append(el('p', { class: 'note warn' }, 'Lecture impossible pour le moment.')); return; }
    rows = list;
    const ids = list.filter((r) => !r.local).map((r) => r.id);
    const prof = await profilesOf(ids);
    const total = MISSIONS.length;
    const t = el('table', { class: 'tbl compact' }, el('thead', {}, el('tr', {}, ...['Stagiaire', 'Missions', 'Scénario (meilleur)', 'Brassage', 'Ordinateur', 'Signalements', 'Dernière activité'].map((h) => el('th', {}, h)))));
    const tb = el('tbody'); t.appendChild(tb);
    for (const r of list) {
      const d = r.data || {}; const best = (d.scenarios || []).reduce((m, s) => Math.max(m, s.score || 0), 0);
      const nm = r.local ? 'Ce navigateur' : (prof[r.id] && prof[r.id].name) || 'Stagiaire';
      const tr = el('tr', { style: { cursor: 'pointer' }, onclick: () => detail(nm, d) },
        el('td', {}, nm), el('td', {}, `${Object.keys(d.missions || {}).length} / ${total}`), el('td', {}, (d.scenarios || []).length ? best + ' %' : '—'), el('td', {}, d.patchBest ? d.patchBest + ' %' : '—'),
        el('td', {}, d.perf ? `${d.perf.fps} i/s · ${String(d.perf.gpu || '').slice(0, 28)}` : '—'), el('td', {}, String((d.reports || []).length)), el('td', {}, d.updatedAt ? new Date(d.updatedAt).toLocaleString('fr-FR') : '—'));
      tb.appendChild(tr);
    }
    if (!list.length) tb.appendChild(el('tr', {}, el('td', { colspan: 7, class: 'note' }, 'Aucune progression enregistrée pour l\'instant.')));
    host.append(el('div', { class: 'tblwrap' }, t), el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => exportCSV(prof) }, 'Exporter le suivi (CSV)')), detBox);
  };
  const detBox = el('div', { class: 'list' });
  function detail(nm, d) {
    detBox.innerHTML = '';
    detBox.append(el('h3', { class: 'eq-h' }, nm),
      el('p', { class: 'note' }, 'Missions réussies : ' + (MISSIONS.filter((m) => (d.missions || {})[m.id]).map((m) => m.title).join(', ') || 'aucune')));
    for (const s of (d.scenarios || []).slice().reverse()) detBox.append(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, `Scénario du ${new Date(s.at).toLocaleString('fr-FR')} · ${s.score} %`), el('div', { class: 's' }, (s.phases || []).map((p) => `${p.title} : ${p.pts}/${p.max}`).join(' · ')))));
    for (const r of (d.reports || []).slice().reverse()) detBox.append(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, `Signalement · ${r.where}`), el('div', { class: 's' }, `${new Date(r.at).toLocaleString('fr-FR')} · ${r.text}`))));
  }
  function exportCSV(prof) {
    const lines = ['Stagiaire;Missions;Meilleur scénario (%);Brassage (%);Fps;Carte graphique;Signalements;Dernière activité'];
    for (const r of rows) { const d = r.data || {}; const best = (d.scenarios || []).reduce((m, s) => Math.max(m, s.score || 0), 0); lines.push([r.local ? 'Ce navigateur' : (prof[r.id] && prof[r.id].name) || r.id, Object.keys(d.missions || {}).length, best, d.patchBest || 0, d.perf ? d.perf.fps : '', d.perf ? d.perf.gpu : '', (d.reports || []).length, d.updatedAt ? new Date(d.updatedAt).toISOString() : ''].join(';')); }
    offerDownload('suivi-stagiaires.csv', '﻿' + lines.join('\r\n'));
  }
  const unsub = watchAllProgress(draw);
  const stop = () => { unsub && unsub(); };
  const obs = new MutationObserver(() => { if (!host.isConnected) { stop(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}
function myProgress() {
  return el('div', { class: 'kv' }, el('dt', {}, 'Missions'), el('dd', {}, `${Object.keys(S.missionsDone).length} / ${MISSIONS.length}`), el('dt', {}, 'Scénarios'), el('dd', {}, String(PROG.scenarios.length)), el('dt', {}, 'Signalements envoyés'), el('dd', {}, String(PROG.reports.length)));
}

// ---------------- relecture technique ----------------
function tabReview(box, editable) {
  const items = { ...(CFG.review && CFG.review.items) };
  const groups = [...new Set(REVIEW_ITEMS.map((r) => r[1]))];
  const done = () => REVIEW_ITEMS.filter(([id]) => items[id] && items[id].status === 'ok').length;
  const count = el('span', { class: 'pill' });
  const upd = () => { count.textContent = `${done()} / ${REVIEW_ITEMS.length} validés`; };
  box.append(el('h3', { class: 'eq-h' }, 'Relecture technique'), el('p', { class: 'note' }, 'Les points techniques que j\'ai repris de la documentation ou choisis pour la simulation, avec leur source. Validez-les ou notez la correction : je pourrai m\'appuyer sur vos remarques pour corriger le simulateur.'), el('div', { class: 'hwrow' }, count));
  for (const g of groups) {
    box.append(el('h3', { class: 'eq-h' }, g));
    for (const [id, , text, src] of REVIEW_ITEMS.filter((r) => r[1] === g)) {
      const it = items[id] = { status: '', note: '', ...(items[id] || {}) };
      const st = selectEl(Object.entries(REVIEW_STATUS), it.status, (v) => { it.status = v; row.dataset.s = v; upd(); });
      const note = el('input', { type: 'text', value: it.note, placeholder: 'Remarque / correction', maxlength: 300, 'aria-label': 'Remarque' }); note.oninput = () => { it.note = note.value; };
      st.disabled = !editable; note.disabled = !editable;
      const row = el('div', { class: 'item review', 'data-s': it.status }, el('div', { class: 'grow' }, el('div', { class: 't' }, text), el('div', { class: 's' }, 'Source : ' + src), note), st);
      box.append(row);
    }
  }
  upd();
  box.append(el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', disabled: !editable, onclick: async () => saved(await saveConfig('review', { items })) }, 'Enregistrer la relecture'),
    el('button', { class: 'btn', onclick: () => { const lines = ['Groupe;Point;Source;Statut;Remarque']; for (const [id, g, t, s] of REVIEW_ITEMS) { const it = items[id] || {}; lines.push([g, t, s, REVIEW_STATUS[it.status || ''], it.note || ''].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(';')); } offerDownload('relecture-technique.csv', '﻿' + lines.join('\r\n')); } }, 'Exporter (CSV)')));
}
