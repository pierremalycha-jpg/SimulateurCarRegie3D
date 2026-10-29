// @ts-check
// ----------------------------------------------------------------------------------
// Baie de mesure (zone technique) : le même instrument que le poste vision (type PRISM), orienté
// couche physique. On y brasse un point de mesure (sortie d'une CCU, sortie de la grille, PGM, mire
// du SPG) et on qualifie le signal SDI lui-même : diagramme de l'œil, gigue, erreurs CRC, longueur de
// câble estimée, timing par rapport à la référence. C'est aussi là qu'on remplace un cordon abîmé.
// ----------------------------------------------------------------------------------
import { S } from '../state.js';
import { el, fmt } from '../util.js';
import { toast, hwBtn } from './common.js';
import { explain } from './widgets.js';
import { qify, liveKv } from './term.js';
import { prismInstrument } from './prism.js';
import { PRISM, measurePoints, pointById, setInput, linkOf, counters, repairLink, sdiStd, lenOf, CABLE, SDI_STD } from '../prism_model.js';
import { DEVICES, DEVICE_LIST } from '../equipment/devices.js';
import { updateFaults } from '../faults.js';

const HELLO = 'Baie de mesure : choisis un point de mesure (une sortie de CCU, une sortie de la grille, le PGM ou la mire du SPG), puis lis l\'instrument. Préréglage « Couche physique » : l\'œil, la gigue, l\'état SDI (erreurs CRC, longueur de câble) et le timing. Chaque tuile a son « ? ».';

/** @param {HTMLElement} body @param {any} [arg] { input } : point de mesure demandé @param {any} [ctx] */
export function buildPrismStation(body, arg, ctx) {
  if (arg && typeof arg === 'object' && arg.input && pointById(arg.input)) setInput('mesure', arg.input);
  if (!pointById(PRISM.mesure.input)) PRISM.mesure.input = 'spg';
  const P = PRISM.mesure;
  const route = (id) => { const p = pointById(id) || pointById('spg'); return { src: p.src, hdr: false, point: p, label: p.label }; };
  const mon = el('div', { class: 'mon fill', 'data-gl': route(P.input).src });
  const monLab = el('div', { class: 'lab' }, '');
  const prism = prismInstrument({
    key: 'mesure',
    inputs: () => measurePoints().map((p) => ({ id: p.id, label: p.label, group: p.group, short: p.short })),
    route,
    onInput: (id) => { const p = pointById(id); if (!p) return; drawPoints(); drawLink(true); explain(`Entrée de l'instrument : ${p.label}. ${p.path}.`, 'mz:in'); },
  });
  // bandeau d'écrans réduit : l'instrument est la pièce maîtresse du poste, juste dessous
  ctx.dock.style.maxHeight = '30vh'; ctx.dock.style.setProperty('--dockh', 'calc(30vh - 58px)');
  ctx.dock.append(el('div', { class: 'monwrap' }, monLab, mon), ctx.explainBox);

  // ---- points de mesure (comme les jacks d'écoute de la baie de brassage) ----
  const points = el('div', { class: 'mz-points' });
  let ptKey = '';
  function drawPoints() {
    const pts = measurePoints(); const k = pts.map((p) => p.id + p.short).join('|') + P.input;
    if (k !== ptKey) {
      ptKey = k; points.replaceChildren();
      const groups = {};
      for (const p of pts) (groups[p.group] ||= []).push(p);
      for (const [g, list] of Object.entries(groups)) {
        points.append(el('div', { class: 'hwrow' }, el('span', { class: 'rl', style: { width: 'auto', minWidth: '120px' } }, g), ...list.map((p) => hwBtn(p.short, { cls: p.id === P.input ? 'lit' : '', title: p.label, onclick: () => { setInput('mesure', p.id); prism.refresh(); drawPoints(); drawLink(true); explain(`Entrée de l'instrument : ${p.label}. ${p.path}.`, 'mz:in'); } }))));
      }
    }
    // un point en erreur (CRC, perte) a un liseré rouge : c'est ce que montrerait le journal d'alarmes
    const pts2 = measurePoints();
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (points.querySelectorAll('button.hw'))) {
      const p = pts2.find((x) => x.label === b.title); if (!p) continue;
      const c = counters(p.id); const L = linkOf(p);
      b.classList.toggle('err', !L.ip && (c.y + c.c > 0 || !L.lock));
      b.classList.toggle('lit', p.id === P.input);
    }
  }

  // ---- la liaison mesurée ----
  const path = el('p', { class: 'mz-path' });
  const chain = el('div', { class: 'mz-chain', 'aria-label': 'Liaison mesurée' });
  const kv = el('dl', { class: 'kv' }); const fill = liveKv(kv);
  const fixBtns = el('div', { class: 'mz-fix' },
    el('button', { class: 'btn small', onclick: () => fix('cordon') }, 'Remplacer le cordon'),
    el('button', { class: 'btn small', onclick: () => fix('reclocker') }, 'Insérer un répéteur (reclocker)'));
  function fix(act) {
    const p = pointById(P.input); if (!p) return;
    if (S.ipMode && p.kind !== 'spg') { toast('Car IP : cette entrée est un flux ST 2110, il n\'y a pas de cordon SDI à changer.', 'bad'); return; }
    const r = repairLink(p.id, act);
    if (r.fixed) updateFaults(); // la panne du simulateur est close tout de suite (« Panne résolue »)
    toast(r.fixed ? (act === 'cordon' ? `${p.short} : cordon remplacé` : `${p.short} : répéteur inséré`) : 'Mesure inchangée', r.fixed ? 'good' : '');
    explain(r.why, r.fixed ? 'ok:fix' : 'warn:fix');
    drawLink(true); drawPoints();
  }
  let linkKey = '';
  function drawLink(force = false) {
    const p = pointById(P.input); if (!p) return;
    const L = linkOf(p); const f = sdiStd();
    mon.dataset.gl = p.src; monLab.textContent = `Image de l'entrée mesurée : ${p.short}`;
    const k = p.id + (L.ip ? 'ip' : '') + (L.fl ? L.fl.kind : '') + Math.round(L.len);
    if (force || k !== linkKey) {
      linkKey = k;
      path.textContent = L.ip ? `${p.label} : dans le car IP, ce signal circule en flux ST 2110 sur le réseau (pas de câble SDI). L'œil et la gigue SDI ne s'appliquent pas ; voir l'analyseur du poste Réseau IP.` : p.path + '.';
      const parts = L.ip ? [['Source', ''], ['réseau ST 2110', ''], ['passerelle', '']] : [[p.short, ''], [`câble ${Math.round(L.len)} m`, L.fl && L.fl.kind === 'touret' ? 'bad' : ''], ...(L.fl && L.fl.kind === 'cable' ? [['connecteur ?', 'bad']] : []), [p.kind === 'ccu' || p.kind === 'hf' || p.kind === 'conv' || p.kind === 'coax' || p.kind === 'gw' ? `grille IN ${p.cam}` : 'point de mesure', '']];
      chain.replaceChildren(...parts.flatMap(([t, c], i) => [i ? el('i', {}, '→') : null, el('span', { class: c }, t)]).filter(Boolean));
    }
    if (L.ip) { fill([['Signal', 'flux IP ST 2110-20'], ['Couche physique', 'Ethernet 25 GbE (voir le poste Réseau IP)']]); return; }
    const c = counters(p.id);
    fill([
      ['Interface', `${f.name} · ${f.rate} · ${f.std}`],
      ['Affaiblissement mesuré', L.margin > -1.5 ? `${fmt(L.att, 1)} dB (câble de ${CABLE})` : 'hors de portée de l\'égaliseur', L.margin > 0 ? '' : 'warn'],
      ['Longueur estimée', L.margin > -1.5 ? `${Math.round(lenOf(L.att, f))} m` : `plus de ${Math.round(lenOf(L.eq, f))} m`],
      ['Marge de l\'égaliseur', `${fmt(L.margin, 1)} dB (portée ${fmt(L.eq, 1)} dB ; minimum de la norme ${f.loss} dB)`, L.margin > 3 ? '' : 'warn'],
      ['Erreurs CRC', L.lock ? `${c.y + c.c} lignes (${c.es} s en erreur)` : 'signal perdu', c.y + c.c || !L.lock ? 'warn' : ''],
      ['Gigue d\'alignement', L.lock ? `${fmt(L.aj, 2)} UI (limite ${fmt(f.aj, 1)} UI)` : '—', L.lock && L.aj > f.aj ? 'warn' : ''],
    ]);
  }

  // ---- valeurs de référence (normes SMPTE) ----
  const lim = el('table', { class: 'tbl mz-lim' },
    el('thead', {}, el('tr', {}, el('th', {}, 'Mesure'), ...['HDi', 'HD', 'UHD'].map((k) => el('th', {}, `${SDI_STD[k].name} (${SDI_STD[k].fmt.split(' ')[0]})`)))),
    el('tbody', {},
      el('tr', {}, el('th', { 'data-qterm': 'ui' }, 'UI (durée d\'un bit)'), ...['HDi', 'HD', 'UHD'].map((k) => el('td', {}, `${fmt(SDI_STD[k].ui, 1)} ps`))),
      el('tr', {}, el('th', { 'data-qterm': 'amplitude-sdi' }, 'Amplitude'), ...['HDi', 'HD', 'UHD'].map(() => el('td', {}, '800 mV ± 10 %'))),
      el('tr', {}, el('th', { 'data-qterm': 'temps-montee' }, 'Montée / descente (20-80 %)'), ...['HDi', 'HD', 'UHD'].map((k) => el('td', {}, `≤ ${SDI_STD[k].tr} ps (écart ≤ ${SDI_STD[k].dtr} ps)`))),
      el('tr', {}, el('th', { 'data-qterm': 'overshoot' }, 'Dépassement'), ...['HDi', 'HD', 'UHD'].map(() => el('td', {}, '≤ 10 %'))),
      el('tr', {}, el('th', { 'data-qterm': 'gigue-timing' }, 'Gigue de timing (10 Hz)'), ...['HDi', 'HD', 'UHD'].map((k) => el('td', {}, `≤ ${fmt(SDI_STD[k].tj, 0)} UI`))),
      el('tr', {}, el('th', { 'data-qterm': 'gigue-alignement' }, 'Gigue d\'alignement'), ...['HDi', 'HD', 'UHD'].map((k) => el('td', {}, `≤ ${fmt(SDI_STD[k].aj, 1)} UI`))),
      el('tr', {}, el('th', { 'data-qterm': 'affaiblissement' }, 'Câble accepté (récepteur)'), ...['HDi', 'HD', 'UHD'].map((k) => el('td', {}, `${SDI_STD[k].loss} dB à ${String(SDI_STD[k].half >= 1000 ? SDI_STD[k].half / 1000 + ' GHz' : SDI_STD[k].half + ' MHz').replace('.', ',')} ≈ ${Math.round(lenOf(SDI_STD[k].loss, SDI_STD[k]))} m de 1694A`)))));
  const ipNote = S.ipMode ? el('p', { class: 'note' }, 'Car IP : les sources circulent en ST 2110 sur le réseau. L\'instrument mesure toujours l\'image (waveform, gamut…) ; pour la couche physique SDI, seule la sortie mire du SPG reste en coaxial.') : null;
  body.append(
    el('div', { class: 'mesure-prism' }, prism.el),
    ipNote,
    el('div', { class: 'mz-grid' },
      el('div', { class: 'hwpanel' }, el('h3', {}, 'Points de mesure'), el('p', { class: 'note' }, 'Comme sur les jacks d\'écoute de la baie de brassage : l\'instrument reçoit le signal tel qu\'il arrive à cet endroit, câble compris. Liseré rouge : erreurs CRC ou signal perdu sur ce point.'), points),
      el('div', { class: 'hwpanel' }, el('h3', { 'data-qterm': 'affaiblissement' }, 'Liaison mesurée'), path, chain, kv, el('p', { class: 'note' }, 'Intervenir : changer le cordon (connecteur abîmé, câble écrasé, touret trop long) ou insérer un répéteur qui régénère le signal à mi-chemin. Mesure d\'abord, répare ensuite.'), fixBtns)),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Valeurs de référence des interfaces SDI'), el('div', { class: 'tblwrap' }, lim), el('p', { class: 'note' }, 'Normes SMPTE ST 292-1 (HD-SDI), ST 424 (3G-SDI), ST 2082-1 (12G-SDI) ; mesures de gigue selon RP 184 et RP 192. La norme définit l\'œil à la sortie de l\'émetteur, avec 1 m de câble ; la longueur acceptée par un récepteur est donnée par l\'affaiblissement qu\'il doit au moins compenser (les égaliseurs actuels font mieux).')));
  qify(body);
  drawPoints(); drawLink(true);
  explain(HELLO, 'muted');
  let lastPts = 0;
  return {
    update() {
      prism.update();
      drawLink();
      if (performance.now() - lastPts > 500) { lastPts = performance.now(); drawPoints(); }
    },
    close() { prism.close(); },
  };
}

// ---------------- l'appareil dans la visionneuse de matériel (touche K, bouton « Matériel ») ----------------
const M = (n, c, s, d, std, desc) => ({ n, c, s, d, std, desc });
const SDI_IN = '12G-SDI (ST 2082-1), 3G-SDI (ST 424), HD-SDI (ST 292-1)';
if (!(/** @type {any} */ (DEVICES)).prism) {
  /** @type {Record<string, any>} */
  const ports = {};
  /** @type {any[]} */
  const items = [{ t: 'body', x: 10, y: 10, w: 740, h: 250, r: 6 }, { t: 'text', x: 26, y: 34, s: 'MONITEUR DE MESURE · face arrière (3U, demi-largeur, disposition schématique)', size: 13 }];
  ['A', 'B', 'C', 'D'].forEach((n, i) => { const id = 'sdi' + n; items.push({ t: 'port', id, k: 'bnc', x: 60 + i * 62, y: 120, l: 'SDI ' + n }); ports[id] = M('SDI ' + n, 'BNC 75 Ω', 'video', 'in', SDI_IN, 'Entrée SDI mesurée (image, son, données, couche physique). Dans le car, brassée depuis la baie de brassage ou une sortie de la grille.'); });
  items.push({ t: 'port', id: 'sdiout', k: 'bnc', x: 330, y: 120, l: 'SDI OUT' }); ports.sdiout = M('SDI OUT', 'BNC 75 Ω', 'video', 'out', SDI_IN, 'Recopie de l\'entrée choisie (ou de l\'écran de l\'instrument) vers un moniteur.');
  items.push({ t: 'port', id: 'ref', k: 'bnc', x: 410, y: 120, l: 'REF IN' }); ports.ref = M('REF IN (bouclée)', 'BNC 75 Ω', 'ref', 'in', 'Black burst ou tri-level', 'Référence du SPG : sert à l\'affichage Timing (où arrive la source par rapport à la référence).');
  items.push({ t: 'port', id: 'sfp1', k: 'sfp', x: 500, y: 120, l: 'SFP 1' }, { t: 'port', id: 'sfp2', k: 'sfp', x: 560, y: 120, l: 'SFP 2' });
  ports.sfp1 = M('SFP 1 (25 GbE)', 'Cage SFP28', 'ip', 'in', 'SMPTE ST 2110, ST 2022-6/-7', 'Entrée IP (réseau rouge) : les mêmes mesures sur des flux ST 2110.'); ports.sfp2 = M('SFP 2 (25 GbE)', 'Cage SFP28', 'ip', 'in', 'SMPTE ST 2110, ST 2022-7', 'Entrée IP (réseau bleu), pour la redondance ST 2022-7.');
  items.push({ t: 'port', id: 'lan', k: 'rj45', x: 630, y: 120, l: 'LAN' }); ports.lan = M('LAN', 'RJ-45', 'ip', 'in', 'Ethernet, PTP', 'Contrôle à distance, mises à jour, horloge PTP.');
  items.push({ t: 'port', id: 'psu', k: 'iec', x: 700, y: 200, l: 'SECTEUR' }); ports.psu = M('Alimentation', 'IEC', 'power', 'in', '', 'Alimentation secteur.');
  const front = [{ t: 'body', x: 10, y: 10, w: 740, h: 250, r: 6 }, { t: 'lcd', id: 'lcd', x: 40, y: 34, w: 560, h: 200 }, { t: 'text', x: 620, y: 52, s: 'ÉCRAN TACTILE', size: 12 }, { t: 'btn', id: 'home', x: 620, y: 80, w: 100, h: 34, l: 'ACCUEIL' }, { t: 'btn', id: 'preset', x: 620, y: 124, w: 100, h: 34, l: 'PRÉRÉGLAGES' }, { t: 'btn', id: 'power', x: 620, y: 190, w: 100, h: 34, l: 'MARCHE' }];
  /** @type {any} */ (DEVICES).prism = {
    key: 'prism', title: 'Moniteur de mesure SDI / IP (type Telestream, ex-Tektronix, PRISM)', multi: false,
    intro: 'L\'instrument de mesure vidéo de la vision et de la zone technique : un écran tactile découpé en tuiles (waveform, vecteurscope, gamut, image, œil, gigue, timing, état SDI). Il mesure aussi bien une entrée SDI qu\'un flux IP ST 2110.',
    views: { arriere: { label: 'Face arrière', w: 760, h: 270, items }, avant: { label: 'Face avant', w: 760, h: 270, items: front } },
    ports, controls: {},
    specs: [['Entrées', '4 × SDI (jusqu\'au 12G-SDI) et 2 × SFP28 25 GbE (ST 2110)'], ['Affichages', 'image, waveform (Y, YCbCr, parade RVB), vecteurscope, lightning, diamant, split diamant, arrowhead, CIE 1931, histogramme, œil, gigue, timing, état'], ['Couche physique', 'option œil et gigue : amplitude, montée, descente, dépassement, gigue de timing et d\'alignement, longueur de câble estimée'], ['Référence', 'black burst ou tri-level (entrée bouclée), PTP']],
    lesson: ['On mesure au plus près de ce qu\'on veut qualifier : l\'œil d\'une sortie se mesure avec un cordon court.', 'Des erreurs CRC sans défaut visible à l\'image : la liaison est au bord de l\'effet de falaise, il faut la reprendre avant le direct.', 'Au line-up, chaque caméra passe par l\'instrument en barres : les points tombent dans les cibles 75 % du vecteurscope.'],
  };
  DEVICE_LIST.push(['prism', 'Moniteur de mesure (PRISM)']);
}
