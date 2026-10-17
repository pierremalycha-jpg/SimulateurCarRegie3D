import { S, emit } from '../state.js';
import { el, fmt } from '../util.js';
import { modal, toast, selectEl, field } from './common.js';
import { SH, CFG, PROG, saveConfig, canConfigure, watchAllProgress, profilesOf, uploadPhoto, photoUrl, offerDownload } from '../shared.js';
import { EQUIP, evsLayout } from '../equip.js';
import { buildCabling, endLabel, SIG } from '../equipment/cabling.js';
import { DEVICES, DEVICE_LIST } from '../equipment/devices.js';
import { REVIEW_ITEMS, REVIEW_STATUS } from '../review.js';
import { MISSIONS } from './guide.js';
import { NET_MISSIONS } from '../net/course.js';
import { EMB_OPTIONS, SOUND_PLAN, AU, MONO_PORTS, ST_PORTS } from '../audio.js';
import { openReview } from './review_ui.js';
import { CAMERA_TYPES, LENSES, SLOTS, LINKS, ROLES } from '../data.js';

// ----------------------------------------------------------------------------------
// Espace formateur : configuration partagée du car, suivi des stagiaires, relecture
// ----------------------------------------------------------------------------------
export const DEFAULT_CHECKLIST = ['Terre raccordée, énergie vérifiée (phases, neutre)', 'Toutes les caméras alimentées, niveaux optiques corrects', 'Référence (genlock) verrouillée sur toutes les CCU', 'Balance des noirs et des blancs, matching vision', 'Noms de sources et tally vérifiés au multiview', 'Test de chaque position intercom (cadreurs, EVS, son, commentateurs)', 'Entrées d\'enregistrement EVS affectées (super ralentis compris)', 'Test des micros et du 1 kHz -18 dBFS', 'Mire + 1 kHz envoyées à la chaîne, ident vérifié', 'Retour antenne contrôlé, chemin de secours testé', 'Fréquences HF vérifiées sur le spectre, marges correctes'];
export function checklistItems() { return CFG.car.checklist && CFG.car.checklist.length ? CFG.car.checklist : DEFAULT_CHECKLIST; }

const TABS = [['car', 'Le car'], ['reel', 'Dispositif réel'], ['cables', 'Liste de câblage'], ['proc', 'Procédures'], ['photos', 'Photos du matériel'], ['eleves', 'Stagiaires'], ['review', 'Relecture technique']];

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
    ({ car: tabCar, reel: tabReel, cables: tabCables, proc: tabProc, photos: tabPhotos, eleves: tabEleves, review: tabReview })[k](content, editable);
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
    const t = el('table', { class: 'tbl compact' }, el('thead', {}, el('tr', {}, ...['Stagiaire', 'Missions', 'Scénario (meilleur)', 'Brassage', 'Montage caméra', 'Parcours réseau', 'Quiz 2110', 'Examen réseau', 'Ordinateur', 'Signalements', 'Dernière activité'].map((h) => el('th', {}, h)))));
    const tb = el('tbody'); t.appendChild(tb);
    for (const r of list) {
      const d = r.data || {}; const best = (d.scenarios || []).reduce((m, s) => Math.max(m, s.score || 0), 0);
      const nm = r.local ? 'Ce navigateur' : (prof[r.id] && prof[r.id].name) || 'Stagiaire';
      const tr = el('tr', { style: { cursor: 'pointer' }, onclick: () => detail(nm, d) },
        el('td', {}, nm), el('td', {}, `${Object.keys(d.missions || {}).length} / ${total}`), el('td', {}, (d.scenarios || []).length ? best + ' %' : '—'), el('td', {}, d.patchBest ? d.patchBest + ' %' : '—'), el('td', {}, rigCell(d)),
        el('td', {}, netCell(d).course), el('td', {}, netCell(d).quiz), el('td', {}, netCell(d).exam),
        el('td', {}, d.perf ? `${d.perf.fps} i/s · ${String(d.perf.gpu || '').slice(0, 28)}` : '—'), el('td', {}, String((d.reports || []).length)), el('td', {}, d.updatedAt ? new Date(d.updatedAt).toLocaleString('fr-FR') : '—'));
      tb.appendChild(tr);
    }
    if (!list.length) tb.appendChild(el('tr', {}, el('td', { colspan: 11, class: 'note' }, 'Aucune progression enregistrée pour l\'instant.')));
    host.append(el('div', { class: 'tblwrap' }, t), el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => exportCSV(prof) }, 'Exporter le suivi (CSV)')), detBox);
  };
  const detBox = el('div', { class: 'list' });
  function detail(nm, d) {
    detBox.innerHTML = '';
    detBox.append(el('h3', { class: 'eq-h' }, nm),
      el('p', { class: 'note' }, 'Missions réussies : ' + (MISSIONS.filter((m) => (d.missions || {})[m.id]).map((m) => m.title).join(', ') || 'aucune')));
    const N = d.net || {};
    const nm2 = NET_MISSIONS.filter((m) => (N.missions || {})[m.id]);
    detBox.append(el('p', { class: 'note' }, 'Parcours réseau ST 2110 : ' + (nm2.map((m) => `${m.title} (${N.missions[m.id].pts}/10${N.missions[m.id].aided ? ', aidé' : ''})`).join(', ') || 'aucune mission')));
    for (const x of (N.quiz || []).slice().reverse().slice(0, 5)) detBox.append(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, `Quiz ST 2110 du ${new Date(x.at).toLocaleString('fr-FR')} · ${x.score} %`))));
    for (const x of (N.exams || []).slice().reverse()) detBox.append(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, `Examen réseau du ${new Date(x.at).toLocaleString('fr-FR')} · ${x.score} %`), el('div', { class: 's' }, (x.faults || []).map((f) => `${f.label} : ${f.ok ? 'résolue en ' + f.dur + ' s' : 'non résolue'}${f.aided ? ' (aidé)' : ''}`).join(' · ') + (x.saved ? '' : ' · configuration non enregistrée')))));
    for (const x of (d.rigs || []).slice().reverse()) detBox.append(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, `Montage CAM 1 du ${new Date(x.at).toLocaleString('fr-FR')} · ${x.grade} · ${Math.floor(x.sec / 60)} min ${String(x.sec % 60).padStart(2, '0')} s`), el('div', { class: 's' }, x.errors && x.errors.length ? 'Repris : ' + x.errors.join(' · ') : 'Sans erreur'))));
    for (const s of (d.scenarios || []).slice().reverse()) detBox.append(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, `Scénario du ${new Date(s.at).toLocaleString('fr-FR')} · ${s.score} %`), el('div', { class: 's' }, (s.phases || []).map((p) => `${p.title} : ${p.pts}/${p.max}`).join(' · ')))));
    for (const r of (d.reports || []).slice().reverse()) detBox.append(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, `Signalement · ${r.where}`), el('div', { class: 's' }, `${new Date(r.at).toLocaleString('fr-FR')} · ${r.text}`))));
  }
  function exportCSV(prof) {
    const lines = ['Stagiaire;Missions;Meilleur scénario (%);Brassage (%);Montage caméra;Parcours réseau;Quiz 2110 (%);Examen réseau (%);Fps;Carte graphique;Signalements;Dernière activité'];
    for (const r of rows) { const d = r.data || {}; const best = (d.scenarios || []).reduce((m, s) => Math.max(m, s.score || 0), 0); const nc = netCell(d); lines.push([r.local ? 'Ce navigateur' : (prof[r.id] && prof[r.id].name) || r.id, Object.keys(d.missions || {}).length, best, d.patchBest || 0, rigCell(d), nc.course, nc.quiz.replace(' %', ''), nc.exam.replace(' %', ''), d.perf ? d.perf.fps : '', d.perf ? d.perf.gpu : '', (d.reports || []).length, d.updatedAt ? new Date(d.updatedAt).toISOString() : ''].join(';')); }
    offerDownload('suivi-stagiaires.csv', '﻿' + lines.join('\r\n'));
  }
  const unsub = watchAllProgress(draw);
  const stop = () => { unsub && unsub(); };
  const obs = new MutationObserver(() => { if (!host.isConnected) { stop(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}
// montage caméra : meilleur passage (le moins d'erreurs, puis le plus rapide)
function rigCell(d) {
  const a = d.rigs || []; if (!a.length) return '—';
  const b = a.slice().sort((x, y) => x.errs - y.errs || x.sec - y.sec)[0];
  return `${b.errs} erreur${b.errs > 1 ? 's' : ''} · ${Math.floor(b.sec / 60)} min${a.length > 1 ? ` (${a.length} essais)` : ''}`;
}
function netCell(d) {
  const N = d.net || {}; const done = NET_MISSIONS.filter((m) => (N.missions || {})[m.id]);
  const pts = done.reduce((a, m) => a + (N.missions[m.id].pts || 0), 0);
  const best = (a) => (a && a.length ? Math.max(...a.map((x) => x.score || 0)) + ' %' : '—');
  return { course: done.length ? `${done.length} / ${NET_MISSIONS.length} · ${pts} pts` : '—', quiz: best(N.quiz), exam: best(N.exams) };
}
function myProgress() {
  return el('div', { class: 'kv' }, el('dt', {}, 'Missions'), el('dd', {}, `${Object.keys(S.missionsDone).length} / ${MISSIONS.length}`), el('dt', {}, 'Scénarios'), el('dd', {}, String(PROG.scenarios.length)), el('dt', {}, 'Signalements envoyés'), el('dd', {}, String(PROG.reports.length)), el('dt', {}, 'Parcours réseau'), el('dd', {}, netCell(PROG).course), el('dt', {}, 'Quiz / examen réseau'), el('dd', {}, `${netCell(PROG).quiz} · ${netCell(PROG).exam}`));
}

// ---------------- relecture technique ----------------
function tabReview(box) {
  const ov = Object.keys((CFG.review && CFG.review.overrides) || {}).length;
  const dec = Object.values((CFG.review && CFG.review.items) || {}).filter((x) => x && x.status).length;
  box.append(el('h3', { class: 'eq-h' }, 'Relecture par les métiers'),
    el('p', {}, 'Faites relire le simulateur par vos experts (ingénieurs vision, son, réseau, opérateurs ralentis, HF). Chacun donne son avis point par point, propose les bonnes valeurs chiffrées et signale ce qui manque. Vous arbitrez ensuite, et les corrections chiffrées s\'appliquent tout de suite au simulateur.'),
    el('ol', {}, el('li', {}, 'Partagez la page avec vos experts au niveau « Contributeur » au moins (menu Partager de claude.ai).'), el('li', {}, 'Ils ouvrent « Relecture technique (experts) » sur l\'écran d\'accueil, choisissent leurs domaines et relisent.'), el('li', {}, 'Vous consolidez dans « Synthèse et arbitrage », appliquez les valeurs retenues, puis exportez le rapport.'), el('li', {}, 'Complétez l\'onglet « Dispositif réel » avec la liste de câblage, le plan de son, la feuille de patch et le dispositif caméras d\'un de vos cars.')),
    el('div', { class: 'kv' }, el('dt', {}, 'Points arbitrés'), el('dd', {}, String(dec)), el('dt', {}, 'Valeurs corrigées appliquées'), el('dd', {}, String(ov))),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', onclick: () => openReview('synth') }, 'Synthèse et arbitrage'), el('button', { class: 'btn', onclick: () => openReview('me') }, 'Ma relecture')));
}

// ---------------- dispositif du car réel : caméras et patch son ----------------
function tabReel(box, editable) {
  const camRows = el('tbody');
  const drawCams = () => {
    camRows.innerHTML = '';
    const list = CFG.car.camPreset || [];
    if (!list.length) camRows.append(el('tr', {}, el('td', { colspan: 6, class: 'note' }, 'Aucun dispositif enregistré : « Car prêt à l\'antenne » utilise le dispositif standard du simulateur.')));
    list.forEach((o, i) => { const sl = SLOTS.find((x) => x.id === o.slotId); camRows.append(el('tr', {}, el('td', {}, 'CAM ' + (i + 1)), el('td', {}, sl ? sl.label : o.slotId || '—'), el('td', {}, (CAMERA_TYPES[o.type] || {}).label || o.type), el('td', {}, o.lens && LENSES[o.lens] ? LENSES[o.lens].name : 'par défaut'), el('td', {}, o.link && LINKS[o.link] ? LINKS[o.link].short : 'par défaut'), el('td', {}, o.role && ROLES[o.role] ? ROLES[o.role].label : '—'))); });
  };
  const fromSim = () => {
    if (!S.cams.length) { toast('Démarrez le simulateur et installez vos caméras (plan caméras, touche P) avant d\'enregistrer le dispositif.', 'bad'); return; }
    CFG.car.camPreset = S.cams.filter((c) => c.slotId).map((c) => ({ slotId: c.slotId, type: c.type, lens: c.lens, link: c.link, role: c.role }));
    drawCams(); toast(`${CFG.car.camPreset.length} caméras relevées : pensez à enregistrer.`);
  };
  const fileIn = el('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  fileIn.onchange = async () => { const f = fileIn.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); const list = Array.isArray(j) ? j : j.cameras; if (!Array.isArray(list)) throw new Error('format'); CFG.car.camPreset = list.filter((o) => o && CAMERA_TYPES[o.type]).slice(0, 16).map((o) => ({ slotId: String(o.slotId || ''), type: o.type, lens: o.lens, link: o.link, role: o.role })); drawCams(); toast('Dispositif importé : pensez à enregistrer.'); } catch (e) { toast('Fichier non reconnu (JSON attendu : liste de caméras avec slotId, type, lens, link, role).', 'bad'); } fileIn.value = ''; };
  // feuille de patch son
  const patchTa = el('textarea', { rows: 8, style: { width: '100%', fontFamily: 'var(--f-mono)' }, placeholder: 'N° tranche;Entrée;Nom court;Libellé\n1;MIC 1-2;AMB LEP;Couple ORTF tribune principale\n3;MIC 5;CANON 1;Canon derrière le but gauche' });
  const toLines = (list) => (list || AU.order.map((k) => AU.ch[k]).map((c) => ({ n: c.n, port: c.home, short: c.short, label: c.label }))).map((r) => [r.n, r.port, r.short, r.label].join(';')).join('\n');
  patchTa.value = toLines(CFG.car.audioPatch);
  const parsePatch = () => patchTa.value.split(/\r?\n/).map((l) => l.split(/[;\t]/).map((x) => x.trim())).filter((c) => c.length >= 2 && /^\d+$/.test(c[0])).map(([n, port, short, label]) => ({ n: +n, port: port.toUpperCase(), short: short || '', label: label || '' }));
  const patchCheck = el('p', { class: 'note' });
  const check = () => { const rows = parsePatch(); const bad = rows.filter((r) => { const c = AU.order.map((k) => AU.ch[k]).find((x) => x.n === r.n); return !c || !(c.st ? ST_PORTS : MONO_PORTS).includes(r.port); }); patchCheck.textContent = `${rows.length} lignes reconnues${bad.length ? ` · ${bad.length} non applicables (tranche inconnue ou entrée invalide : ${bad.map((r) => r.n + ' ' + r.port).join(', ')})` : ' · toutes applicables'}. Entrées possibles : MIC 1 à 32 (paires MIC 1-2… pour les tranches stéréo), MADI 1 à 8, SDI 1/1 à 1/4, AES 1 à 8 (stéréo), GEN.`; };
  patchTa.addEventListener('input', check); check();
  drawCams();
  box.append(el('h3', { class: 'eq-h' }, 'Dispositif caméras de référence'),
    el('p', { class: 'note' }, 'Installez vos caméras dans le simulateur comme sur votre car (positions, types, objectifs, liaisons), puis relevez-les ici : « Car prêt à l\'antenne » démarrera avec ce dispositif pour tout le monde.'),
    el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, ...['Caméra', 'Position', 'Type', 'Objectif', 'Liaison', 'Consigne'].map((h) => el('th', {}, h)))), camRows),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn', disabled: !editable, onclick: fromSim }, 'Relever le dispositif actuel'), el('button', { class: 'btn', disabled: !editable, onclick: () => fileIn.click() }, 'Importer (JSON)'), fileIn,
      el('button', { class: 'btn', onclick: () => offerDownload('dispositif-cameras.json', JSON.stringify({ cameras: CFG.car.camPreset || [] }, null, 2)) }, 'Exporter (JSON)'),
      el('button', { class: 'btn', disabled: !editable, onclick: () => { CFG.car.camPreset = []; drawCams(); } }, 'Revenir au dispositif standard')),
    el('h3', { class: 'eq-h' }, 'Feuille de patch de la console son'),
    el('p', { class: 'note' }, 'Collez la feuille de patch de votre car (une ligne par tranche : numéro ; entrée ; nom court ; libellé). Les noms et les entrées remplacent ceux du simulateur au prochain démarrage, et servent de référence pour la panne « patch erroné ».'),
    patchTa, patchCheck,
    el('div', { class: 'hwrow' }, el('button', { class: 'btn', disabled: !editable, onclick: () => { CFG.car.audioPatch = null; patchTa.value = toLines(null); check(); } }, 'Revenir au patch du simulateur')),
    el('h3', { class: 'eq-h' }, 'Autres données du car'),
    el('p', { class: 'note' }, 'La liste de câblage s\'importe dans l\'onglet « Liste de câblage » (CSV) ; le plan de son et le matériel dans l\'onglet « Le car ».'),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', disabled: !editable, onclick: async () => { const rows = parsePatch(); const car = { ...CFG.car, audioPatch: rows.length ? rows : null }; saved(await saveConfig('car', car)); } }, 'Enregistrer le dispositif réel')));
}
