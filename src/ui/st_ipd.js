// @ts-check
import { S } from '../state.js';
import { el, tc, fmt } from '../util.js';
import { toast } from './common.js';
import { EVS, evsAction, recordedCams, clipName, MIX, meSource } from '../pipeline.js';
import { recRange, playerName, playerNumber } from '../match.js';
import { evsLayout, EQUIP } from '../equip.js';
import { explain } from './widgets.js';
import { ctrlFunc } from '../net/ctrlnet.js';
import { openDevice } from '../equipment/viewer.js';
import { panneauMedias, panneauConducteur } from '../emission/panneau.js';

const KEYWORDS = ['BUT', 'TIR', 'ARRÊT', 'FAUTE', 'CORNER', 'HORS-JEU', 'CARTON', 'CONTRE', 'BELLE ACTION', 'AMBIANCE'];

// Poste IPDirector : base de données des clips, log, playlist, contrôle des canaux du serveur
export function buildIPD(body, arg, ctx) {
  ctx.dock.append(el('div', { class: 'dockrow' },
    el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'EVS A · PGM1'), el('div', { class: 'mon fill', 'data-gl': 'EVSA' })),
    el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'EVS B · PGM2'), el('div', { class: 'mon fill', 'data-gl': 'EVSB' })),
    el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Programme'), el('div', { class: 'mon fill', 'data-gl': 'PGM' }))), ctx.explainBox);
  let selIdx = null; let filter = ''; let ch = evsLayout().plays > 1 ? 1 : 0;
  // ---------- base de données ----------
  const q = el('input', { type: 'text', placeholder: 'Rechercher (mot-clé, nom, joueur, ID…)', 'aria-label': 'Rechercher un clip', style: { flex: '1 1 200px' } });
  q.addEventListener('input', () => { filter = q.value.trim().toLowerCase(); drawDb(); });
  const tbody = el('tbody');
  const db = el('div', { class: 'hwpanel ipd' }, el('h3', {}, 'Database explorer · clips'), el('div', { class: 'hwrow' }, q),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact' }, el('thead', {}, el('tr', {}, ...['ID', 'Nom', 'TC IN', 'Durée', 'Angle', 'Mots-clés', 'Note'].map((h) => el('th', {}, h)))), tbody)));
  const detail = el('div', { class: 'list' });
  // ---------- logger ----------
  const kwRow = el('div', { class: 'hwrow' });
  const logList = el('div', { class: 'list ipd-log' });
  const evList = el('div', { class: 'list' });
  for (const kw of KEYWORDS) kwRow.appendChild(el('button', { class: 'btn small', onclick: () => logNow(kw) }, kw));
  const logger = el('div', { class: 'hwpanel ipd' }, el('h3', {}, 'Clip logger · log en direct'), el('p', { class: 'note' }, 'Un clic sur un mot-clé note le timecode du direct. Un log se transforme ensuite en clip (IN 4 s avant, OUT 3 s après).'), kwRow,
    el('div', { class: 'lsm-sub' }, 'Actions repérées par le scripte (à logger)'), evList, el('div', { class: 'lsm-sub' }, 'Logs'), logList);
  // ---------- playlist ----------
  const plBody = el('div', { class: 'list' });
  const chSel = el('select', { 'aria-label': 'Canal de lecture' });
  const fillCh = () => { chSel.innerHTML = ''; for (let i = 0; i < evsLayout().plays; i++) { const o = el('option', { value: i }, `PGM${i + 1} (EVS ${i ? 'B' : 'A'})`); if (i === ch) o.selected = true; chSel.appendChild(o); } };
  fillCh(); chSel.onchange = () => { ch = +chSel.value; };
  const pl = el('div', { class: 'hwpanel ipd' }, el('h3', {}, 'Playlist'), plBody,
    el('div', { class: 'hwrow' }, el('span', { class: 'note' }, 'Lire sur'), chSel,
      el('button', { class: 'btn small primary', onclick: playPl }, 'Lire la playlist'),
      el('button', { class: 'btn small', onclick: () => { EVS.playlist = []; explain('Playlist vidée.'); } }, 'Vider la playlist')),
    el('p', { class: 'note' }, 'Dans IPDirector, chaque élément peut avoir sa transition (cut, mix, volet) et sa vitesse ; ici les clips s\'enchaînent en cut à la vitesse du levier.'));
  // ---------- contrôle des canaux ----------
  const ctl = el('div', { class: 'hwpanel ipd' }, el('h3', {}, 'Control panel · canaux du serveur'), el('div', { class: 'list ipd-ch' }));
  // les médias de l'émission (générique, pub) et le conducteur : en tête du poste
  const medias = panneauMedias({ explain, evsOk: () => evsOk() });
  const cond = panneauConducteur();
  body.append(el('div', { class: 'ipd-grid em-ipd' }, medias.el, cond.el));
  body.append(el('div', { class: 'ipd-grid' }, el('div', { class: 'list' }, db, el('div', { class: 'hwpanel ipd' }, el('h3', {}, 'Clip sélectionné'), detail)), el('div', { class: 'list' }, logger, pl, ctl)),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => openDevice('ipd', 1) }, 'Voir le poste IPDirector'), el('button', { class: 'btn small', onclick: () => openDevice('evs', 1) }, `Voir le serveur ${EQUIP.evsModel}`)),
    el('p', { class: 'note' }, 'IPDirector travaille sur les mêmes clips que la télécommande LSM : un clip sauvegardé au poste ralentis apparaît ici, un nom ou un mot-clé ajouté ici apparaît sur l\'écran du serveur. Interface simplifiée inspirée des modules Database explorer, Clip logger, Playlist et Control panel.'));

  // en car SDI, IPDirector pilote le serveur par le réseau de contrôle
  const evsOk = () => { const k = ctrlFunc('evs'); if (k.ok) return true; toast('Serveur EVS injoignable par le réseau de contrôle.', 'bad'); explain(`Action refusée : IPDirector ne joint plus le serveur EVS (${k.why}). L'enregistrement continue sur le serveur, mais ni log ni clip ne passent : vois le poste Réseau.`, 'warn:ctrl'); return false; };
  function logNow(kw) {
    if (!evsOk()) return;
    const t = S.simTime;
    EVS.logs.unshift({ t, kw: [kw], cam: recordedCams()[0] || null });
    if (EVS.logs.length > 60) EVS.logs.pop();
    explain(`Log « ${kw} » à ${tc(S.tcOffset + t)}. Pendant le direct, le logueur note tout ; à la mi-temps on retrouve instantanément tous les « ${kw} ».`, 'ipd:log');
    drawLogs();
  }
  function logToClip(lg) {
    const [t0] = recRange();
    const free = EVS.clips.findIndex((c, i) => !c && i < 100); const idx = free >= 0 ? free : EVS.clips.length;
    EVS.clips[idx] = { in: Math.max(t0, lg.t - 4), out: Math.min(S.simTime, lg.t + 3), cam: lg.cam || recordedCams()[0], name: lg.kw.join(' '), kw: [...lg.kw], rating: 0, savedT: S.simTime };
    lg.clip = idx; selIdx = idx;
    explain(`Clip ${clipName(idx)} créé depuis le log « ${lg.kw.join(' ')} » : il apparaît aussi sur la télécommande LSM (page ${Math.floor(idx / 10) + 1}, F${(idx % 10) + 1}).`);
    drawAll();
  }
  function playPl() {
    if (!EVS.playlist.length) { toast('Playlist vide : ajoute des clips depuis la base.'); return; }
    evsAction(ch, 'plstplay'); explain(`Playlist lancée sur PGM${ch + 1} : ${EVS.playlist.length} clips. Le réalisateur peut la prendre au mélangeur (EVS ${ch ? 'B' : 'A'}).`);
  }
  function drawDb() {
    tbody.innerHTML = '';
    EVS.clips.forEach((cl, i) => {
      if (!cl) return;
      const kw = (cl.kw || []).join(', ');
      const txt = `${clipName(i)} ${cl.name || ''} ${kw}`.toLowerCase();
      if (filter && !txt.includes(filter)) return;
      tbody.appendChild(el('tr', { class: i === selIdx ? 'sel' : '', style: { cursor: 'pointer' }, onclick: () => { selIdx = i; drawAll(); } },
        el('td', { class: 'mono' }, clipName(i)), el('td', {}, cl.name || '—'), el('td', { class: 'mono' }, tc(S.tcOffset + cl.in).slice(3)), el('td', { class: 'mono' }, fmt(cl.out - cl.in, 1) + ' s'),
        el('td', {}, 'CAM ' + cl.cam), el('td', {}, kw || '—'), el('td', {}, '★'.repeat(cl.rating || 0) || '—')));
    });
    if (!tbody.children.length) tbody.appendChild(el('tr', {}, el('td', { colspan: 7, class: 'note' }, EVS.clips.some(Boolean) ? 'Aucun clip ne correspond à la recherche.' : 'Aucun clip : crée des clips à la LSM (IN / OUT puis une touche F libre) ou crées-en depuis un log.')));
  }
  function drawDetail() {
    detail.innerHTML = '';
    const cl = selIdx != null ? EVS.clips[selIdx] : null;
    if (!cl) { detail.appendChild(el('p', { class: 'note' }, 'Sélectionne un clip dans la base.')); return; }
    const name = el('input', { type: 'text', value: cl.name || '', 'aria-label': 'Nom du clip', placeholder: 'Nom du clip' });
    name.addEventListener('change', () => { cl.name = name.value.slice(0, 40); explain(`Clip ${clipName(selIdx)} renommé « ${cl.name} » : le nom apparaît aussi sur l'écran du serveur côté LSM.`); drawDb(); });
    const pls = el('select', { 'aria-label': 'Joueur' }, el('option', { value: '' }, 'Ajouter un joueur…'), ...[...Array(22).keys()].map((p) => el('option', { value: p }, `${playerNumber(p)} ${playerName(p)}`)));
    pls.onchange = () => { if (pls.value === '') return; cl.kw = [...(cl.kw || []), playerName(+pls.value)]; drawAll(); };
    const kws = el('div', { class: 'hwrow' }, ...KEYWORDS.slice(0, 7).map((k) => el('button', { class: 'btn small ipd-kw' + ((cl.kw || []).includes(k) ? ' primary' : ''), onclick: () => { cl.kw = (cl.kw || []).includes(k) ? cl.kw.filter((x) => x !== k) : [...(cl.kw || []), k]; drawAll(); } }, k)));
    const stars = el('div', { class: 'hwrow' }, el('span', { class: 'note' }, 'Note'), ...[1, 2, 3].map((n) => el('button', { class: 'btn small' + ((cl.rating || 0) >= n ? ' primary' : ''), 'aria-label': `Note ${n} sur 3`, title: `Note ${n} sur 3`, onclick: () => { cl.rating = cl.rating === n ? 0 : n; drawAll(); } }, '★'.repeat(n))));
    detail.append(el('div', { class: 'kv' }, el('dt', {}, 'ID'), el('dd', {}, clipName(selIdx)), el('dt', {}, 'TC IN / OUT'), el('dd', {}, `${tc(S.tcOffset + cl.in)} / ${tc(S.tcOffset + cl.out)}`), el('dt', {}, 'Angles'), el('dd', {}, recordedCams().map((id, k) => `${'ABCDEFGH'[k]}=CAM ${id}`).join(' · '))),
      name, kws, el('div', { class: 'hwrow' }, pls), stars,
      el('div', { class: 'hwrow' },
        el('button', { class: 'btn small', onclick: () => { EVS.playlist.push(selIdx); explain(`Clip ${clipName(selIdx)} ajouté à la playlist (${EVS.playlist.length}).`); drawPl(); } }, 'Ajouter à la playlist'),
        el('button', { class: 'btn small', onclick: () => { evsAction(ch, 'recall', selIdx); explain(`Clip ${clipName(selIdx)} chargé sur PGM${ch + 1}, prêt à jouer.`); } }, `Charger sur PGM${ch + 1}`)));
  }
  function drawLogs() {
    logList.innerHTML = '';
    for (const lg of EVS.logs.slice(0, 12)) logList.appendChild(el('div', { class: 'item' }, el('span', { class: 'lcd amber' }, tc(S.tcOffset + lg.t).slice(3, 11)), el('div', { class: 'grow' }, el('div', { class: 't' }, lg.kw.join(' '))),
      lg.clip != null ? el('span', { class: 'pill ok' }, clipName(lg.clip)) : el('button', { class: 'btn small', title: 'Créer un clip depuis ce log', onclick: () => logToClip(lg) }, '→ Clip')));
    if (!EVS.logs.length) logList.appendChild(el('p', { class: 'note' }, 'Aucun log.'));
  }
  let lastEv = -1;
  function drawEvents() {
    if (S.events.length === lastEv) return; lastEv = S.events.length;
    evList.innerHTML = '';
    for (const e of S.events.slice(-4).reverse()) evList.appendChild(el('div', { class: 'item' }, el('span', { class: 'lcd amber' }, tc(S.tcOffset + e.t).slice(3, 11)), el('div', { class: 'grow' }, el('div', { class: 't' }, e.label)),
      el('button', { class: 'btn small', onclick: () => { EVS.logs.unshift({ t: e.t, kw: [{ goal: 'BUT', shot: 'TIR', save: 'ARRÊT' }[e.type] || 'ACTION'], cam: recordedCams()[0] || null }); drawLogs(); explain(`Action « ${e.label} » loggée à son timecode exact.`); } }, 'Logger')));
    if (!S.events.length) evList.appendChild(el('p', { class: 'note' }, 'Pas encore d\'action notée.'));
  }
  function drawPl() {
    plBody.innerHTML = '';
    let tot = 0;
    EVS.playlist.forEach((idx, j) => {
      const cl = EVS.clips[idx]; if (!cl) return; tot += cl.out - cl.in;
      plBody.appendChild(el('div', { class: 'item' }, el('span', { class: 'mono' }, `${j + 1}.`), el('div', { class: 'grow' }, el('div', { class: 't' }, `${clipName(idx)} ${cl.name || ''}`), el('div', { class: 's' }, `${fmt(cl.out - cl.in, 1)} s à 100 % · CAM ${cl.cam}`)),
        el('button', { class: 'btn small', 'aria-label': 'Monter dans la playlist', title: 'Monter dans la playlist', onclick: () => { if (j > 0) { [EVS.playlist[j - 1], EVS.playlist[j]] = [EVS.playlist[j], EVS.playlist[j - 1]]; drawPl(); } } }, '↑'),
        el('button', { class: 'btn small', 'aria-label': 'Retirer de la playlist', title: 'Retirer de la playlist', onclick: () => { EVS.playlist.splice(j, 1); drawPl(); } }, '×')));
    });
    if (!EVS.playlist.length) plBody.appendChild(el('p', { class: 'note' }, 'Playlist vide : ajoute des clips depuis la base.'));
    else plBody.appendChild(el('p', { class: 'note' }, `Durée totale à 100 % : ${fmt(tot, 1)} s (à 50 % : ${fmt(tot * 2, 1)} s).`));
  }
  function drawCtl() {
    const box = ctl.querySelector('.ipd-ch'); box.innerHTML = '';
    const L = evsLayout();
    for (let i = 0; i < L.plays; i++) {
      const c = EVS.ch[i];
      box.appendChild(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, `PGM${i + 1} · EVS ${i ? 'B' : 'A'}${meSource(MIX.pgm) === (i ? 'EVSB' : 'EVSA') ? ' · ● ANTENNE' : ''}`), el('div', { class: 's' }, `${c.mode === 'live' ? 'E/E' : c.playing ? 'lecture ' + Math.round(c.speed * 100) + ' %' : 'pause'} · CAM ${c.cam} · TC ${tc(S.tcOffset + (c.mode === 'live' ? S.simTime : c.t)).slice(3)}`)),
        el('button', { class: 'btn small', onclick: () => evsAction(i, 'gotoin') }, 'GOTO IN'), el('button', { class: 'btn small', onclick: () => evsAction(i, 'playvar') }, 'PLAY'), el('button', { class: 'btn small', onclick: () => evsAction(i, 'live') }, 'LIVE')));
    }
    box.appendChild(el('p', { class: 'note' }, `Enregistrement : ${recordedCams().map((id) => 'CAM ' + id).join(', ') || 'aucune entrée'} · ${L.label}.`));
  }
  function drawAll() { drawDb(); drawDetail(); drawLogs(); drawPl(); }
  drawAll();
  let lastKey = '';
  return {
    update() {
      const key = EVS.clips.map((c) => (c ? c.in + c.name + (c.kw || []).length + c.rating : '')).join() + '|' + EVS.playlist.join();
      if (key !== lastKey) { lastKey = key; drawDb(); drawPl(); if (selIdx != null && !document.activeElement.closest?.('.ipd')) drawDetail(); }
      drawEvents(); drawCtl(); medias.update(); cond.update();
    },
  };
}
