// @ts-check
import { S, camById } from '../state.js';
import { el, clamp, fmt } from '../util.js';
import { hwBtn, knob, toast } from './common.js';
import { MIX, TRANS, WIPES, mixSetPst, mixSetPgm, mixCut, mixAuto, mixTbar, dskToggle, ftbToggle, keyToggle, meSource, sourceLabel, allSources, ROUTER, frameRate } from '../pipeline.js';
import { EQUIP, mixInputs } from '../equip.js';
import { explain } from './widgets.js';
import { openDevice } from '../equipment/viewer.js';
import { COMMUT, commutKey, setKeyMode, keyLegend, keyModeLabel } from './commut.js';

// Nom court affiché sur l'OLED au-dessus d'un bouton de croisement
function oledName(n) {
  const id = meSource(n);
  if (!id) return ['—', ''];
  if (id.startsWith('CAM')) { const c = camById(+id.slice(3)); return [`CAM ${id.slice(3)}`, c ? c.T.short : 'libre']; }
  const s = allSources().find((x) => x.id === id);
  return [s ? s.short : id, { EVSA: 'EVS PGM1', EVSB: 'EVS PGM2', GFX: 'graph.', STUDIO: 'duplex', BARS: 'mire', BLACK: 'noir' }[id] || ''];
}

const TRANS_TXT = {
  mix: 'MIX : fondu enchaîné, les deux images se superposent pendant la durée choisie.',
  wipe: 'WIPE : un motif (volet) découvre la nouvelle image.',
  dip: 'DIP : passage par une couleur (souvent le noir) au milieu de la transition.',
  dve: 'DME : transition numérique (l\'image entrante pousse l\'ancienne). Sur le XVS-6000, le redimensionneur 2,5D est sur chaque keyer ; la DME 3D complète est une option (carte XKS-8470 ou XKS-8475).',
  stinger: 'CLIP : transition « clip » de la frame memory (logo animé avec sa découpe) qui masque la coupe au milieu. C\'est le « volet logo » des entrées et sorties de ralenti.',
};

// Poste truquiste : pupitre type Sony ICP-X7000 qui commande le processeur XVS-6000
export function buildMixer(body, arg, ctx) {
  ctx.dock.append(el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Multiview (PGM, PVW et toutes les sources)'), el('div', { class: 'mon fill', 'data-gl': 'mv' })));
  const nIn = mixInputs();
  const buses = { key: [], pgm: [], pst: [] };
  const rowsP = el('div', { class: 'hwpanel icpanel' }, el('div', { class: 'icp-head' }, el('h3', {}, `M/E 1 · ${EQUIP.mixPanel} → ${EQUIP.mixer}`), el('span', { class: 'note' }, `${nIn} entrées utilisées${S.format === 'UHD' ? ' (configuration 4K)' : ''}`),
    el('button', { class: 'btn small', onclick: () => openDevice('mixpanel', 1) }, 'Voir le pupitre'), el('button', { class: 'btn small', onclick: () => openDevice('mixer', 1) }, 'Voir le processeur')));
  const ROWS = [['key', 'KEY/AUX', 'Bus de clé : la source incrustée par KEY 1.'], ['pgm', 'A · PGM', 'Bus A (arrière-plan programme) : ce qui est à l\'antenne.'], ['pst', 'B · PST', 'Bus B (preset) : ce qui passera à la prochaine transition.']];
  for (const [bus, label, title] of ROWS) {
    const row = el('div', { class: 'xpt-row' }, el('span', { class: 'rl', title }, label));
    for (let n = 1; n <= nIn; n++) {
      // nom accessible = texte visible (source, numéro, modèle) puis le bus (WCAG 2.5.3, label-content-name-mismatch) :
      // aria-labelledby l'emporte sur aria-label, que l'on garde car les parcours du chef de car ciblent ces
      // touches par [aria-label="B · PST entrée 3"] ; les espaces entre les éléments ne s'affichent pas (flex)
      const k = `mx-${bus}-${n}`;
      const name = el('span', { class: 'oled', id: k + '-s' }), num = el('span', { class: 'xn', id: k + '-n' }, String(n)), sub = el('small', { id: k + '-d' });
      const b = el('button', { class: 'xpt ' + bus, 'aria-label': `${label} entrée ${n}`, 'aria-labelledby': `${k}-s ${k}-n ${k}-d ${k}-b`, onclick: () => press(bus, n) }, name, ' ', num, ' ', sub, el('span', { id: k + '-b', hidden: true }, `${label}, entrée ${n}`));
      b._name = name; b._sub = sub; buses[bus][n] = b; row.appendChild(b);
    }
    rowsP.appendChild(row);
  }
  function press(bus, n) {
    if (bus === 'pgm') mixSetPgm(n); else if (bus === 'pst') mixSetPst(n);
    else { MIX.key1.src = n; explain(`Bus de clé : ${sourceLabel(meSource(n))} sera incrustée par KEY 1 (redimensionneur 2,5D du keyer).`, 'mix:keybus'); }
  }
  body.appendChild(rowsP);
  const grid = el('div', { class: 'panelgrid' });
  // --- module de transition ---
  const tbtns = {};
  const transP = el('div', { class: 'hwpanel' }, el('h3', {}, 'Module de transition'));
  const tr = el('div', { class: 'hwrow' });
  for (const k in TRANS) { const b = hwBtn(TRANS[k], { onclick: () => { MIX.trans = k; explain(TRANS_TXT[k] + ' Lancez avec AUTO TRANS ou le levier.', 'mix:trans'); } }); tbtns[k] = b; tr.appendChild(b); }
  transP.appendChild(tr);
  const wbtns = [];
  const wr = el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Motif'));
  WIPES.forEach((w, i) => { const b = hwBtn(w.split(' ')[0], { onclick: () => { MIX.wipe = i; MIX.trans = 'wipe'; explain(`Motif de volet : ${w}.`, 'mix:wipe'); } }); wbtns.push(b); wr.appendChild(b); });
  transP.appendChild(wr);
  const rate = el('input', { type: 'number', min: 0, max: 200, value: MIX.rate, id: 'mixrate', 'aria-label': 'Durée de transition, en images', style: { width: '80px' } });
  rate.addEventListener('change', () => { MIX.rate = clamp(+rate.value || 0, 0, 200); explain(`Durée de transition : ${MIX.rate} images = ${fmt(MIX.rate / frameRate(), 2)} s à ${frameRate()} images par seconde (${S.format === 'HDi' ? '1080i50 : 25 images, 50 trames' : 'format progressif 50p'}). Un enchaîné classique dure 12 à 25 images.`, 'mix:rate'); });
  const nb = hwBtn('BKGD', { onclick: () => { MIX.next.bkgd = !MIX.next.bkgd; if (!MIX.next.bkgd && !MIX.next.key1) MIX.next.key1 = true; explain('Next transition : choisit ce qui change à la prochaine transition (l\'arrière-plan, la clé, ou les deux).', 'mix:next'); } });
  const nk = hwBtn('KEY 1', { onclick: () => { MIX.next.key1 = !MIX.next.key1; if (!MIX.next.bkgd && !MIX.next.key1) MIX.next.bkgd = true; explain('Next transition : choisit ce qui change à la prochaine transition (l\'arrière-plan, la clé, ou les deux).', 'mix:next'); } });
  transP.appendChild(el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Durée'), rate, el('span', { class: 'note' }, `images (${frameRate()} i/s)`), el('span', { style: { flex: 1 } }), el('span', { class: 'rl' }, 'Next'), nb, nk));
  const tbar = el('input', { type: 'range', min: 0, max: 100, step: 0.5, value: 0, class: 'tbar', id: 'tbar', 'aria-label': 'Levier de transition' });
  tbar.addEventListener('input', () => { mixTbar(+tbar.value / 100); explain(`Levier de transition : ${Math.round(MIX.pos * 100)} %. Le truquiste le pousse à la main pour suivre le rythme de l'action (un enchaîné lent sur un plan large, par exemple).`, 'mix:tbar'); });
  const cut = hwBtn('CUT', { cls: 'big', onclick: () => mixCut() });
  const auto = hwBtn('AUTO TRANS', { cls: 'big', onclick: () => mixAuto() });
  const prog = el('div', { class: 'lcd amber' }, '0 %');
  transP.appendChild(el('div', { class: 'hwrow', style: { alignItems: 'flex-end', gap: '14px' } }, el('div', { class: 'hwrow' }, cut, auto), tbar, el('div', { class: 'list' }, el('span', { class: 'note' }, 'Levier'), prog)));
  grid.appendChild(transP);
  // --- keyer ---
  const keyP = el('div', { class: 'hwpanel' }, el('h3', {}, 'KEY 1 · redimensionneur 2,5D (image dans l\'image)'));
  const kOn = hwBtn('KEY CUT', { onclick: () => keyToggle(false) });
  const kAuto = hwBtn('KEY AUTO', { onclick: () => keyToggle(true) });
  const corners = {};
  const cr = el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Coin'));
  for (const [k, l, t] of [['tl', '↖', 'Coin haut gauche'], ['tr', '↗', 'Coin haut droit'], ['bl', '↙', 'Coin bas gauche'], ['br', '↘', 'Coin bas droit']]) { const b = hwBtn(l, { title: t, onclick: () => { MIX.key1.corner = k; explain('Position de l\'image incrustée (sur le pupitre : joystick positionneur).', 'mix:pos'); } }); b.setAttribute('aria-label', t); corners[k] = b; cr.appendChild(b); }
  const ks = knob('Taille', 15, 60, 1, Math.round(MIX.key1.size * 100), (v) => { MIX.key1.size = v / 100; explain(`Taille de l'image incrustée : ${v} %. Le keyer redimensionne la source du bus de clé en temps réel.`, 'mix:size'); }, (v) => v + ' %');
  keyP.append(el('div', { class: 'hwrow' }, kOn, kAuto, el('span', { class: 'note' }, 'Source : bus KEY/AUX')), cr, ks);
  grid.appendChild(keyP);
  // --- DSK et sortie ---
  const dskP = el('div', { class: 'hwpanel' }, el('h3', {}, 'DSK (habillage aval) et fondu au noir'));
  const d1c = hwBtn('DSK 1 CUT', { sub: 'score', onclick: () => dskToggle(1, false) }), d1a = hwBtn('DSK 1 AUTO', { sub: 'score', onclick: () => dskToggle(1, true) });
  const d2c = hwBtn('DSK 2 CUT', { sub: 'graph.', onclick: () => dskToggle(2, false) }), d2a = hwBtn('DSK 2 AUTO', { sub: 'graph.', onclick: () => dskToggle(2, true) });
  const ftb = hwBtn('FTB', { sub: 'noir', onclick: () => ftbToggle() });
  dskP.append(el('div', { class: 'hwrow' }, d1c, d1a), el('div', { class: 'hwrow' }, d2c, d2a), el('div', { class: 'hwrow' }, ftb),
    el('p', { class: 'note' }, 'Les DSK sont au-dessus de tout : le score reste à l\'écran pendant les ralentis. Le clean feed est le programme sans DSK.'));
  grid.appendChild(dskP);
  // --- snapshots ---
  MIX.snaps = MIX.snaps || [];
  let storeMode = false;
  const snapP = el('div', { class: 'hwpanel' }, el('h3', {}, 'Snapshots (mémoires d\'état)'));
  const store = hwBtn('STORE', { onclick: () => { storeMode = !storeMode; explain(storeMode ? 'STORE : la prochaine touche SNAP mémorise l\'état du pupitre (preset, clé, transition, DSK).' : 'Mémorisation annulée.', 'mix:snap'); } });
  const snapBtns = [];
  const snapRow = el('div', { class: 'hwrow' });
  for (let i = 0; i < 8; i++) {
    const b = hwBtn('SNAP ' + (i + 1), { sub: 'vide', onclick: () => {
      if (storeMode) { MIX.snaps[i] = { pst: MIX.pst, trans: MIX.trans, wipe: MIX.wipe, rate: MIX.rate, next: { ...MIX.next }, key1: { ...MIX.key1 }, dsk1: MIX.dsk1.on, dsk2: MIX.dsk2.on }; storeMode = false; explain(`Snapshot ${i + 1} mémorisé.`, 'mix:snap'); return; }
      const sn = MIX.snaps[i]; if (!sn) { toast('Snapshot vide : STORE puis SNAP pour mémoriser.'); return; }
      Object.assign(MIX, { pst: sn.pst, trans: sn.trans, wipe: sn.wipe, rate: sn.rate }); Object.assign(MIX.next, sn.next); Object.assign(MIX.key1, { ...sn.key1, on: MIX.key1.on });
      if (sn.dsk1 !== MIX.dsk1.on) dskToggle(1, true); if (sn.dsk2 !== MIX.dsk2.on) dskToggle(2, true);
      explain(`Snapshot ${i + 1} rappelé : preset, clé et transition prêts en une touche. Le PGM n'est pas modifié (on ne rappelle pas une mémoire « à l'aveugle » à l'antenne).`, 'mix:snap');
    } });
    snapBtns.push(b); snapRow.appendChild(b);
  }
  snapP.append(el('div', { class: 'hwrow' }, store), snapRow, el('p', { class: 'note' }, 'Sur le pupitre ICP, les snapshots et la Shotbox rappellent des configurations complètes préparées avant le direct.'));
  grid.appendChild(snapP);
  body.appendChild(grid);
  const kmBtn = hwBtn('TOUCHES 1-9', { sub: keyModeLabel(), onclick: () => { setKeyMode(COMMUT.mode === 'direct' ? 'preset' : 'direct'); explain(COMMUT.mode === 'direct' ? 'Mode DIRECT : une touche 1 à 9 commute l\'entrée à l\'antenne (comme un appui sur la rangée A · PGM). Rapide, mais on n\'a pas vu l\'image avant : c\'est le geste du direct « au top ».' : 'Mode PRESET : la touche prépare l\'entrée sur le bus B (tally vert, tuile PVW) ; Espace ou Entrée fait le CUT, Entrée du pavé numérique l\'AUTO TRANS. C\'est la méthode recommandée : on vérifie le cadre avant de l\'envoyer.', 'mix:keys'); } });
  const legend = el('p', { class: 'note' });
  body.appendChild(el('div', { class: 'hwrow' }, kmBtn, legend));
  let lastLabels = '';
  return {
    update() {
      const labelsKey = Object.values(ROUTER.map).join(',') + S.cams.map((c) => c.id + c.type).join(',');
      if (labelsKey !== lastLabels) {
        lastLabels = labelsKey;
        for (const bus of ['key', 'pgm', 'pst']) for (let n = 1; n <= nIn; n++) { const [l, sub] = oledName(n); const b = buses[bus][n]; b._name.textContent = l; b._sub.textContent = sub; }
      }
      for (let n = 1; n <= nIn; n++) {
        const id = meSource(n); const dead = !id || (id.startsWith('CAM') && !camById(+id.slice(3)));
        buses.pgm[n].classList.toggle('on', MIX.pgm === n); buses.pst[n].classList.toggle('on', MIX.pst === n); buses.key[n].classList.toggle('on', MIX.key1.src === n);
        for (const bus of ['key', 'pgm', 'pst']) buses[bus][n].classList.toggle('dead', dead);
      }
      for (const k in tbtns) tbtns[k].classList.toggle('lit', MIX.trans === k);
      wbtns.forEach((b, i) => b.classList.toggle('lit2', MIX.wipe === i));
      nb.classList.toggle('lit', MIX.next.bkgd); nk.classList.toggle('lit', MIX.next.key1);
      kOn.classList.toggle('pgm', MIX.key1.on); kAuto.classList.toggle('pgm', MIX.key1.on);
      for (const k in corners) corners[k].classList.toggle('lit2', MIX.key1.corner === k);
      d1c.classList.toggle('pgm', MIX.dsk1.on); d1a.classList.toggle('pgm', MIX.dsk1.on);
      d2c.classList.toggle('pgm', MIX.dsk2.on); d2a.classList.toggle('pgm', MIX.dsk2.on);
      ftb.classList.toggle('pgm', MIX.ftb.on);
      auto.classList.toggle('pgm', MIX.auto);
      store.classList.toggle('lit', storeMode);
      snapBtns.forEach((b, i) => { b.classList.toggle('lit2', !!MIX.snaps[i]); b.querySelector('small').textContent = MIX.snaps[i] ? 'mémorisé' : 'vide'; });
      prog.textContent = Math.round(MIX.pos * 100) + ' %';
      kmBtn.querySelector('small').textContent = keyModeLabel(); kmBtn.classList.toggle('lit', COMMUT.mode === 'preset'); kmBtn.classList.toggle('pgm', COMMUT.mode === 'direct');
      legend.textContent = 'Clavier : ' + keyLegend() + ' · W = WIPE · X = MIX · L = CLIP.';
      if (MIX.auto && document.activeElement !== tbar) tbar.value = (MIX.tbarDir > 0 ? MIX.pos : 1 - MIX.pos) * 100;
      if (document.activeElement !== rate) rate.value = MIX.rate;
    },
    key(e) {
      if (e.target && (e.target.tagName === 'INPUT' && e.target.type !== 'range')) return false;
      if (commutKey(e, 'station')) return true;
      if (e.code === 'KeyW') { MIX.trans = 'wipe'; return true; }
      if (e.code === 'KeyX') { MIX.trans = 'mix'; return true; }
      if (e.code === 'KeyL') { MIX.trans = 'stinger'; return true; }
      return false;
    },
  };
}
