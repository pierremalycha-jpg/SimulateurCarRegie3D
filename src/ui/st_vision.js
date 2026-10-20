// @ts-check
import { S, emit, camById } from '../state.js';
import { el, clamp, fmt } from '../util.js';
import { maxAperture } from '../data/cameras.js';
import { GAINS, ND_FILTERS, SHUTTERS } from '../data/exposure.js';
import { toast, intercom, hwBtn } from './common.js';
import { ROUTER, SCOPE, drawScopes, tallyOf } from '../pipeline.js';
import { explain, rotary, joystick, chainBox } from './widgets.js';
import { openDevice } from '../equipment/viewer.js';

const IR_MIN = 1.4, IR_MAX = 22;
const irisToPos = (n) => 1 - Math.log(n / IR_MIN) / Math.log(IR_MAX / IR_MIN);
const posToIris = (p) => IR_MIN * Math.pow(IR_MAX / IR_MIN, 1 - p);
const stopsTxt = (s) => `${s > 0 ? '+' : ''}${fmt(s, 1)} diaphragme${Math.abs(s) >= 2 ? 's' : ''}`;
const SCENES = {};

// Poste ingénieur vision : RCP (type RCP-3500) + moniteur de référence + oscilloscope
/** @param {HTMLElement} body @param {any} [arg] caméra demandée ({ cam }) ou rang du pupitre @param {any} [ctx] */
export function buildVision(body, arg = 0, ctx) {
  let sel = S.cams.length ? (arg === 1 ? (S.cams.find((c) => c.id > 6) || S.cams[0]).id : S.cams[0].id) : null;
  if (arg && typeof arg === 'object' && camById(arg.cam)) sel = arg.cam;
  const cam = () => camById(sel);
  // ---------------- dock : moniteurs toujours visibles ----------------
  const scopeC = el('canvas', { class: 'scope', width: 640, height: 360 });
  const modeBtns = { luma: el('button', { class: 'minibtn' }, 'LUMA'), parade: el('button', { class: 'minibtn' }, 'PARADE RVB'), hlg: el('button', { class: 'minibtn', title: 'Mesurer la sortie HDR (HLG) de la CCU' }, 'HLG') };
  // sortie SDR (BT.709) et sortie HDR (HLG) de la même CCU
  const monSDR = el('div', { class: 'mon fill', 'data-gl': 'AUX_VISION', title: 'Sortie SDR BT.709' });
  const monHDR = el('div', { class: 'mon fill', 'data-gl': 'HDR', title: 'Sortie HDR HLG (simulation d\'un moniteur HDR sur votre écran)', hidden: true });
  const hdrBtns = { sdr: el('button', { class: 'minibtn' }, 'SDR'), hlg: el('button', { class: 'minibtn' }, 'HDR HLG'), both: el('button', { class: 'minibtn' }, 'SDR | HDR') };
  const setHdr = (m) => {
    S.hdrView = m !== 'sdr'; if (!S.hdrView) SCOPE.hdr = false;
    monSDR.hidden = m === 'hlg'; monHDR.hidden = m === 'sdr'; monSDR.parentElement && monSDR.parentElement.classList.toggle('both', m === 'both');
    for (const k in hdrBtns) hdrBtns[k].classList.toggle('on', k === m);
    explain({ sdr: 'Moniteur en SDR (BT.709) : c\'est la sortie que règlent la plupart des ingénieurs vision, le blanc nominal est à 100 %.', hlg: 'Sortie HDR (HLG) de la CCU, vue sur un moniteur HDR simulé : les hautes lumières (ciel, maillots au soleil, projecteurs) gardent du détail au lieu d\'être écrêtées. Le blanc de référence est à 75 % du signal (ITU-R BT.2408).', both: 'Les deux sorties de la même CCU côte à côte. En production « single stream » (type SR Live), on règle l\'image sur la sortie SDR et la HDR suit : même iris, mêmes noirs, mêmes couleurs ; seule la courbe change.' }[m], 'rcp:hdr');
  };
  for (const k in hdrBtns) hdrBtns[k].onclick = () => setHdr(k);
  modeBtns.hlg.onclick = () => { if (!S.hdrView) setHdr('both'); SCOPE.hdr = !SCOPE.hdr; explain(SCOPE.hdr ? 'Oscilloscope sur la sortie HLG : le blanc de référence (une feuille blanche, un maillot blanc à l\'ombre) doit tomber vers 75 % ; au-dessus, la marge pour les hautes lumières.' : 'Oscilloscope sur la sortie SDR.', 'rcp:scope'); };
  for (const k of ['luma', 'parade']) modeBtns[k].onclick = () => { SCOPE.mode = k; explain(k === 'parade' ? 'Parade RVB : les trois composantes côte à côte. Un blanc neutre a ses trois traces à la même hauteur ; un noir neutre aussi, en bas.' : 'Waveform luminance : hauteur = niveau de chaque colonne de l\'image, de 0 % (noir) à 100 % (blanc nominal).'); };
  const meterTxt = el('span', { class: 'meter' });
  const chain = chainBox();
  ctx.dock.append(
    el('div', { class: 'monwrap' }, el('div', { class: 'lab labrow' }, el('span', {}, 'Moniteur de référence Grade 1'), hdrBtns.sdr, hdrBtns.hlg, hdrBtns.both), el('div', { class: 'refpair' }, monSDR, monHDR)),
    el('div', { class: 'dockrow' },
      el('div', { class: 'monwrap grow' }, el('div', { class: 'lab labrow' }, el('span', {}, 'Oscilloscope'), modeBtns.luma, modeBtns.parade, modeBtns.hlg), scopeC),
      el('div', { class: 'monwrap grow' }, el('div', { class: 'lab labrow' }, el('span', {}, 'Multiview'), meterTxt), el('div', { class: 'mon fill', 'data-gl': 'mv' }))),
    ctx.explainBox);
  for (const k in hdrBtns) hdrBtns[k].classList.toggle('on', k === 'sdr');
  // ---------------- sélection de la caméra ----------------
  const selRow = el('div', { class: 'hwrow' });
  const camBtns = {};
  const rebuildSel = () => {
    selRow.innerHTML = ''; selRow.append(el('span', { class: 'rl' }, 'CAM'));
    for (const c of S.cams) { const b = hwBtn(String(c.id), { sub: c.T.short, onclick: () => select(c.id) }); camBtns[c.id] = b; selRow.appendChild(b); }
    if (!S.cams.length) selRow.appendChild(el('span', { class: 'note' }, 'Aucune caméra installée : plan des caméras (touche P).'));
  };
  rebuildSel();
  const panelHost = el('div', { class: 'rcp-host' });
  const overview = el('div', { class: 'hwpanel', style: { flex: '1 1 300px', minWidth: '0' } });
  body.append(el('div', { class: 'hwpanel compact' }, selRow,
    el('div', { class: 'hwrow' }, el('span', { class: 'note' }, 'Matériel :'), el('button', { class: 'btn small', onclick: () => openDevice('rcp', sel) }, 'RCP'), el('button', { class: 'btn small', onclick: () => openDevice('ccu', sel) }, 'CCU'), el('button', { class: 'btn small', onclick: () => openDevice('cam', sel) }, 'Tête de caméra'), el('span', { class: 'note' }, 'Un RCP « réseau » (comme sur le CNS) : il prend la caméra choisie.'))),
    chain,
    el('div', { class: 'hwrow', style: { alignItems: 'flex-start', gap: '14px' } }, panelHost, overview));

  let W = {};
  const touch = (stage, fn) => (...a) => { const c = cam(); if (!c) return; if (c.panelActive === false) { toast('PANEL ACTIVE éteint : rallumez-le pour régler la caméra.', 'bad'); explain('Réglage refusé : PANEL ACTIVE est éteint. On l\'éteint pour verrouiller une caméra réglée ; rallumez-le pour reprendre la main.', 'warn:locked'); return; } fn(c, ...a); chain.update(c, stage); };
  let irisSeq = null;
  function select(id) {
    sel = id; S.selCam = id; SCOPE.src = 'CAM' + id; SCOPE.active = true;
    ROUTER.map.AUX_VISION = 'CAM' + id; emit('router', {});
    buildPanel();
    const c = cam(); if (c) explain(`RCP affecté à la CAM ${id} (${c.T.label}, ${c.L.name}). Son image est sur le moniteur de référence et l'oscilloscope.`);
  }

  function buildPanel() {
    panelHost.innerHTML = ''; W = {};
    const c = cam(); if (!c) return;
    const p = c.paint;
    // ---- écran tactile ----
    let page = 'paint';
    const lcd = el('div', { class: 'rcp-lcd' });
    const tabs = el('div', { class: 'rcp-tabs' });
    const encs = el('div', { class: 'rcp-encs' });
    const PAGES = {
      paint: { l: 'PAINT', params: [['detail', 'DETAIL', 0, 100, 'detail'], ['sat', 'SATURATION', 40, 160, 'matrice'], ['blackGamma', 'BLACK GAMMA', -99, 99, 'gamma']] },
      gamma: { l: 'GAMMA / KNEE', params: [['gamma', 'MASTER GAMMA', -99, 99, 'gamma'], ['knee', 'KNEE POINT', 80, 109, 'knee'], ['wclip', 'WHITE CLIP', 95, 109, 'knee'], ['mblack', 'MASTER BLACK', -99, 99, 'noir']] },
      expo: { l: 'GAIN / ND / SHUTTER', params: [] },
      scene: { l: 'SCÈNES', params: [] },
    };
    const explainParam = (key, v, c2) => {
      const t = {
        detail: `Détail ${v} : accentuation des contours. Trop fort, l'image devient « électronique » (liserés blancs autour des joueurs) ; trop faible, elle paraît floue sur les écrans.`,
        sat: `Saturation ${v} % : intensité des couleurs. Au vecteurscope, le nuage s'éloigne (plus saturé) ou se rapproche (moins saturé) du centre.`,
        blackGamma: `Black gamma ${v} : ${v > 0 ? 'relève' : v < 0 ? 'écrase' : 'laisse'} les basses lumières sans toucher au noir ni au blanc. Utile pour déboucher les ombres d'une tribune.`,
        gamma: `Master gamma ${v} : courbe de transfert. Vers le +, les tons moyens montent (image plus claire, moins contrastée) ; vers le −, ils descendent.`,
        knee: `Knee point ${v} % : au-dessus de ce niveau, les hautes lumières sont compressées pour garder du détail dans les maillots blancs et le ciel.`,
        wclip: `White clip ${v} % : aucun signal ne dépasse ce niveau (écrêteur). Beaucoup de diffuseurs exigent des blancs ≤ 103 % (ancienne tolérance en luminance de l'EBU R103-2000 ; la version actuelle de R103 admet jusqu'à 105 %) ; au-delà, l'image peut être refusée au contrôle qualité.`,
        mblack: `Master black ${v} : niveau du noir pour les trois couleurs (pedestal), soit environ ${fmt(v * 0.132, 1)} % au waveform.`,
      }[key];
      if (t) explain(t, 'rcp:' + key);
    };
    const drawLcd = () => {
      tabs.innerHTML = '';
      for (const k in PAGES) tabs.appendChild(el('button', { class: 'rcp-tab' + (k === page ? ' on' : ''), onclick: () => { page = k; drawLcd(); } }, PAGES[k].l));
      lcd.innerHTML = ''; encs.innerHTML = '';
      const t = tallyOf('CAM' + c.id);
      lcd.append(el('div', { class: 'rcp-lcd-top' }, el('b', {}, `CAM ${c.id}`), el('span', {}, c.T.short), el('span', { class: t === 2 ? 'onair' : t === 1 ? 'pvw' : '' }, t === 2 ? 'ON AIR' : t === 1 ? 'PVW' : '')));
      if (PAGES[page].params.length) {
        for (const [k, l, mn, mx, stage] of PAGES[page].params) {
          lcd.append(el('div', { class: 'rcp-lcd-row' }, el('span', {}, l), el('b', { id: 'lcd-' + k }, String(p[k]))));
          encs.append(rotary(l, () => p[k], touch(stage, (cc, v) => { p[k] = v; const b = document.getElementById('lcd-' + k); if (b) b.textContent = String(v); explainParam(k, v, cc); }), { min: mn, max: mx, size: 40, wheel: 1 }));
        }
      } else if (page === 'expo') {
        const mk = (label, arr, cur, onp) => el('div', { class: 'rcp-lcd-row wrap' }, el('span', {}, label), ...arr.map(([v, l]) => el('button', { class: 'rcp-touch' + (cur() === v ? ' on' : ''), onclick: (e) => { onp(v); drawLcd(); } }, l)));
        lcd.append(
          mk('GAIN', GAINS.map((g) => [g, (g > 0 ? '+' : '') + g]), () => p.gain, touch('gain', (cc, v) => { const d = v - p.gain; p.gain = v; explain(`Gain ${v > 0 ? '+' : ''}${v} dB : ${d >= 0 ? '+' : ''}${d} dB = ×${fmt(Math.pow(10, d / 20), 2)} sur le signal (${stopsTxt(d / 6)}). Le bruit augmente dans la même proportion : on préfère ouvrir l'iris tant que c'est possible.`, 'rcp:gain'); })),
          mk('ND', ND_FILTERS.map((n, i) => [i, n.label.split(' ')[0]]), () => p.nd, touch('optique', (cc, v) => { const before = ND_FILTERS[p.nd].f, after = ND_FILTERS[v].f; p.nd = v; explain(`Filtre ND ${ND_FILTERS[v].label} : ${stopsTxt(Math.log2(after / before))}. Le ND retire de la lumière sans changer les couleurs, pour pouvoir garder un iris de travail (f/4 à f/8) en plein soleil.`, 'rcp:nd'); })),
          mk('SHUTTER', SHUTTERS.map((s, i) => [i, s.label]), () => p.shutter, touch('capteur', (cc, v) => { p.shutter = v; const te = cc.exposureTime(); explain(`Shutter ${SHUTTERS[v].label} : temps de pose ${fmt(te * 1000, 1)} ms (au lieu de ${fmt(1000 / cc.fps, 1)} ms à ${cc.fps} i/s), soit ${stopsTxt(Math.log2(te * cc.fps))}. Les mouvements sont plus nets (ralentis), mais l'image s'assombrit et les éclairages 100 Hz peuvent scintiller.`, 'rcp:shut'); })));
        lcd.append(el('div', { class: 'rcp-lcd-row' }, el('span', {}, 'TEMPS DE POSE'), el('b', {}, `1/${Math.round(1 / c.exposureTime())} s${c.hfr > 1 ? ' · HFR ' + c.hfr + 'x' : ''}`)));
      } else if (page === 'scene') {
        for (let i = 1; i <= 5; i++) lcd.append(el('div', { class: 'rcp-lcd-row' }, el('span', {}, `SCÈNE ${i}${SCENES[c.id + ':' + i] ? ' ●' : ''}`),
          el('button', { class: 'rcp-touch', onclick: () => { SCENES[c.id + ':' + i] = { ...p }; explain(`Fichier de scène ${i} mémorisé pour la CAM ${c.id} : tous les réglages de rendu (noirs, gamma, knee, détail, couleurs). On en prépare un par situation (soleil, ombre, nuit).`); drawLcd(); } }, 'STORE'),
          el('button', { class: 'rcp-touch', onclick: touch('sortie', (cc) => { const s = SCENES[cc.id + ':' + i]; if (!s) { toast('Fichier de scène vide : mémorisez-le d\'abord avec STORE.'); return; } Object.assign(cc.paint, s); explain(`Fichier de scène ${i} rappelé : la caméra reprend instantanément tous ces réglages.`); buildPanel(); }) }, 'RECALL')));
      }
    };
    drawLcd();
    // ---- touches assignables ----
    const ASSIGN = [['DETAIL', 'detailOn', 'detail', 'Détail'], ['KNEE', 'kneeOn', 'knee', 'Knee'], ['GAMMA', 'gammaOn', 'gamma', 'Gamma'], ['MATRIX', 'matrixOn', 'matrice', 'Matrice / saturation'], ['BLK GAM', null, 'gamma', 'Black gamma'], ['SKIN DTL', null, 'detail', 'Détail de peau'], ['ND ▲', null, 'optique', ''], ['ND ▼', null, 'optique', ''], ['ZEBRA', null, 'sortie', '']];
    const keys = el('div', { class: 'rcp-keys' });
    const keyBtns = ASSIGN.map(([l, prop, stage, name], i) => {
      const b = el('button', { class: 'rcp-key', onclick: touch(stage, (cc) => {
        if (prop) { cc.paint[prop] = !cc.paint[prop]; explain(`${name} ${cc.paint[prop] ? 'activé' : 'désactivé'}. ${prop === 'gammaOn' && !cc.paint[prop] ? 'Sans gamma, l\'image est linéaire : très contrastée et sombre, c\'est pour cela qu\'on applique toujours une courbe (BT.709 ou HLG).' : prop === 'kneeOn' && !cc.paint[prop] ? 'Sans knee, les hautes lumières ne sont plus compressées : elles écrêtent net au niveau du white clip (103 % par défaut ici) et perdent leur détail ; regardez le haut du waveform.' : prop === 'detailOn' && !cc.paint[prop] ? 'Sans détail, l\'image paraît plus douce.' : ''}`); }
        else if (l === 'ND ▲') { if (cc.paint.nd < 4) { cc.paint.nd++; explain(`ND ${ND_FILTERS[cc.paint.nd].label} (−1 ou −2 diaph selon le cran).`); } }
        else if (l === 'ND ▼') { if (cc.paint.nd > 0) { cc.paint.nd--; explain(`ND ${ND_FILTERS[cc.paint.nd].label} (+1 ou +2 diaph selon le cran).`); } }
        else if (l === 'BLK GAM') { cc.paint.blackGamma = cc.paint.blackGamma ? 0 : 30; explain(`Black gamma ${cc.paint.blackGamma ? '+30 : ombres débouchées' : 'remis à 0'}.`); }
        else if (l === 'SKIN DTL') explain('Skin detail : réduit le détail sur les tons chair pour adoucir les visages (non simulé ici).');
        else if (l === 'ZEBRA') explain('Zébra : hachures dans le viseur sur les zones au-dessus d\'un niveau (ex. 95 %) pour aider le cadreur (non simulé ici).');
        refresh();
      }) }, l);
      keys.appendChild(b); return [b, prop];
    });
    // ---- WHITE / BLACK ----
    const wh = ['wbR', 'wbG', 'wbB'].map((k, i) => rotary('RGB'[i], () => p[k], touch('blanc', (cc, v) => { p[k] = v; explain(i === 1 ? `Gain vert ${v} : le vert sert en général de référence, on règle plutôt le rouge et le bleu.` : `Gain ${i ? 'bleu' : 'rouge'} ${v > 0 ? '+' : ''}${v} (${v > 0 ? '+' : ''}${fmt(v * 0.25, 1)} %) : l'image ${i ? (v > 0 ? 'refroidit (bleutée)' : 'se réchauffe') : (v > 0 ? 'se réchauffe (rougeâtre)' : 'refroidit')}. Au vecteurscope, le gris de la pelouse ombragée et les maillots blancs se décalent vers ${i ? (v > 0 ? 'B' : 'Yl') : (v > 0 ? 'R' : 'Cy')}.`, 'rcp:w' + i); }), { color: ['red', 'green', 'blue'][i] }));
    const bl = ['blackR', 'blackG', 'blackB'].map((k, i) => rotary('RGB'[i], () => (S.rcpFlare ? p['flare' + 'RGB'[i]] : p[k]), touch('noir', (cc, v) => { if (S.rcpFlare) { p['flare' + 'RGB'[i]] = v; explain(`Flare ${'RGB'[i]} ${v} : compense le voile lumineux de l'optique dans les noirs de cette couleur.`, 'rcp:f' + i); } else { p[k] = v; explain(`Noir ${['rouge', 'vert', 'bleu'][i]} ${v > 0 ? '+' : ''}${v} : les ombres virent ${v > 0 ? 'vers le ' + ['rouge', 'vert', 'bleu'][i] : 'à l\'opposé'}. Regardez le bas des traces en parade RVB : les trois doivent être alignées.`, 'rcp:b' + i); } }), { color: ['red', 'green', 'blue'][i] }));
    const awb = el('button', { class: 'rcp-btn', onclick: touch('blanc', (cc) => { cc.autoWhite(); explain(`AWB : balance des blancs automatique à ${S.sceneCCT} K. La caméra mesure un blanc de référence et calcule ses gains rouge et bleu. Dans un vrai stade, le cadreur cadre une charte ou une surface blanche pendant le réglage.`); refresh(); }) }, 'AWB');
    const abb = el('button', { class: 'rcp-btn', onclick: touch('noir', (cc) => { cc.autoBlack(); explain('ABB : balance des noirs automatique. L\'iris se ferme, la caméra mesure son noir et égalise les trois couleurs.'); refresh(); }) }, 'ABB');
    const flare = el('button', { class: 'rcp-btn', onclick: () => { S.rcpFlare = !S.rcpFlare; explain(S.rcpFlare ? 'FLARE allumé : les potentiomètres BLACK règlent maintenant la compensation de flare.' : 'FLARE éteint : les potentiomètres règlent la balance des noirs.'); buildPanel(); } }, 'FLARE');
    // ---- boutons ----
    const btn = (l, fn, cls = '') => el('button', { class: 'rcp-btn ' + cls, onclick: fn }, l);
    W.call = btn('CALL', () => { c.paint.call = S.time; intercom('VISION', `Appel CAM ${c.id} : le tally du cadreur clignote, il répond à l'intercom.`); explain('CALL : appel du cadreur (tally qui clignote). Utile pour attirer son attention sans parler sur l\'ordre général.'); });
    W.bars = btn('BARS', touch('sortie', (cc) => { cc.paint.bars = !cc.paint.bars; if (!cc.paint.bars) (S.flags ||= {}).barsCycle = true; explain(cc.paint.bars ? 'BARS : la caméra envoie ses barres de couleur. Au line-up, on vérifie ainsi la liaison, le nom de la source au multiview et les niveaux.' : 'BARS coupées : retour de l\'image.'); refresh(); }));
    W.campw = btn('CAM PW', () => { c.powerOn = c.powerOn === false; c.checkLink(); explain(c.powerOn ? 'CAM PW : la CCU alimente de nouveau la tête par la fibre hybride. Il faut quelques secondes avant l\'image.' : 'CAM PW coupé : plus d\'alimentation sur la fibre, la caméra s\'éteint (PAS DE SIGNAL au multiview). On coupe toujours avant de débrancher un câble caméra.'); refresh(); });
    W.active = btn('PANEL ACTIVE', () => { c.panelActive = c.panelActive === false; explain(c.panelActive ? 'PANEL ACTIVE : le RCP a la main sur la caméra.' : 'PANEL ACTIVE éteint : réglages verrouillés (les potentiomètres ne font plus rien).'); refresh(); });
    W.preview = btn('PREVIEW', () => { ROUTER.map.AUX_VISION = 'CAM' + c.id; emit('router', {}); explain('PREVIEW : la caméra est envoyée sur le moniteur de référence de la vision (sortie AUX de la grille).'); });
    W.auto = btn('AUTO IRIS', touch('optique', (cc) => { cc.paint.autoIris = !cc.paint.autoIris; explain(cc.paint.autoIris ? 'Iris automatique : la caméra vise un niveau moyen fixe. Pratique en dépannage, mais il « pompe » quand un maillot blanc ou une ombre traverse l\'image.' : 'Iris repassé en manuel.'); refresh(); }));
    W.close = btn('CLOSE', touch('optique', (cc) => { cc.paint.irisClose = !cc.paint.irisClose; explain(cc.paint.irisClose ? 'Iris fermé (CLOSE) : image noire. Sert à la balance des noirs et à protéger les capteurs.' : 'Iris rouvert.'); refresh(); }));
    // ---- joystick ----
    const irisLcd = el('div', { class: 'rcp-iris' });
    const joy = joystick(() => irisToPos(c.paint.iris), touch('optique', (cc, pos) => {
      const before = cc.paint.iris;
      if (!irisSeq || performance.now() - irisSeq.t > 2500) irisSeq = { from: before, mean: cc.meter.mean };
      irisSeq.t = performance.now();
      cc.paint.iris = posToIris(pos); cc.paint.autoIris = false; cc.paint.irisClose = false;
      const st = 2 * Math.log2(irisSeq.from / cc.paint.iris);
      const lensMax = maxAperture(cc.L, cc.focal / (cc.ext ? 2 : 1), cc.ext);
      const est = clamp(irisSeq.mean * Math.pow(Math.pow(2, st), 0.45), 0, 1.1);
      explain(`Iris F${fmt(irisSeq.from, 1)} → F${fmt(cc.paint.iris, 1)} : ${stopsTxt(st)}, la lumière est multipliée par ${fmt(Math.pow(2, st), 2)}. Niveau moyen attendu ≈ ${Math.round(est * 100)} % (était ${Math.round(irisSeq.mean * 100)} %).${cc.paint.iris < lensMax - 0.05 ? ` Attention : à ${Math.round(cc.focal)} mm l'objectif ne s'ouvre pas au-delà de F${fmt(lensMax, 1)} (ramping), l'iris demandé n'est pas atteint.` : ''}`, 'rcp:iris');
    }), () => c.paint.mblack, touch('noir', (cc, v) => { cc.paint.mblack = v; explain(`Master black ${v} : niveau du noir des trois couleurs, ≈ ${fmt(v * 0.132, 1)} % au waveform. Repère : noirs posés entre 0 et 2 %.`, 'rcp:mb'); }));
    // deux colonnes à l'écran ; la disposition réelle (en long) est dans la visionneuse de matériel
    const panel = el('div', { class: 'rcp' },
      el('div', { class: 'rcp-col' },
        el('div', { class: 'rcp-leds' }, el('span', { class: 'rcp-led tally', id: 'rcp-tally' }, 'TALLY'), el('span', { class: 'rcp-led call', id: 'rcp-call' }, 'CALL'), el('span', { class: 'rcp-model' }, `RCP ${c.id}`)),
        tabs, lcd, encs,
        el('div', { class: 'rcp-sec' }, 'TOUCHES ASSIGNABLES'), keys,
        el('div', { class: 'rcp-sec' }, 'FONCTIONS'),
        el('div', { class: 'rcp-row' }, W.call, W.bars, W.campw), el('div', { class: 'rcp-row' }, W.active, W.preview), el('div', { class: 'rcp-row' }, W.auto, W.close)),
      el('div', { class: 'rcp-col' },
        el('div', { class: 'rcp-sec' }, 'IRIS / M.BLACK'), el('div', { class: 'rcp-joyrow' }, joy, irisLcd),
        el('div', { class: 'rcp-sec' }, 'WHITE'), el('div', { class: 'rcp-knobs' }, ...wh), el('div', { class: 'rcp-row' }, awb),
        el('div', { class: 'rcp-sec' }, 'BLACK / FLARE'), el('div', { class: 'rcp-knobs' }, ...bl), el('div', { class: 'rcp-row' }, flare, abb)));
    panelHost.appendChild(panel);
    W.keyBtns = keyBtns; W.wh = wh; W.bl = bl; W.joy = joy; W.irisLcd = irisLcd; W.flare = flare; W.drawLcd = drawLcd;
    chain.update(c, null);
    refresh();
  }
  function refresh() {
    const c = cam(); if (!c || !W.joy) return;
    const p = c.paint;
    W.keyBtns.forEach(([b, prop], i) => b.classList.toggle('on', prop ? !!p[prop] : (i === 4 ? p.blackGamma !== 0 : false)));
    for (const r of [...W.wh, ...W.bl]) r.refresh();
    W.joy.refresh();
    W.bars.classList.toggle('on', p.bars); W.campw.classList.toggle('on', c.powerOn !== false); W.active.classList.toggle('on', c.panelActive !== false);
    W.auto.classList.toggle('on', p.autoIris); W.close.classList.toggle('on', p.irisClose); W.flare.classList.toggle('on', !!S.rcpFlare);
    W.preview.classList.toggle('on', ROUTER.map.AUX_VISION === 'CAM' + c.id);
    const eff = c.effAperture();
    W.irisLcd.innerHTML = '';
    W.irisLcd.append(el('div', { class: 'big' }, p.irisClose ? 'CLOSE' : 'F' + fmt(eff, 1)), el('div', {}, `M.BLK ${p.mblack > 0 ? '+' : ''}${p.mblack}`), el('div', {}, `${Math.round(c.focal)} mm${c.ext ? ' EX2' : ''}`), el('div', { class: eff > p.iris + 0.05 ? 'warn' : '' }, eff > p.iris + 0.05 ? 'RAMPING' : (p.autoIris ? 'AUTO' : 'MANU')));
  }
  if (sel) select(sel);
  let lastCams = ''; let lastOv = 0;
  const g = scopeC.getContext('2d');
  return {
    update() {
      const ck = S.cams.map((c) => c.id).join();
      if (ck !== lastCams) { lastCams = ck; rebuildSel(); if (!camById(sel) && S.cams.length) select(S.cams[0].id); }
      for (const c of S.cams) { const b = camBtns[c.id]; if (!b) continue; const t = tallyOf('CAM' + c.id); b.className = 'hw' + (t === 2 ? ' pgm' : t === 1 ? ' pst' : '') + (c.id === sel ? ' selcam' : ''); }
      for (const k of ['luma', 'parade']) modeBtns[k].classList.toggle('on', SCOPE.mode === k);
      modeBtns.hlg.classList.toggle('on', !!SCOPE.hdr);
      drawScopes(g, 640, 360, SCOPE.data, SCOPE.mode, 'CAM ' + sel);
      const c = cam(); if (!c) return;
      meterTxt.textContent = `CAM ${c.id} · moyen ${Math.round(c.meter.mean * 100)} % · crêtes ${Math.round(c.meter.peak * 100)} %`;
      const t = tallyOf('CAM' + c.id);
      const tl = document.getElementById('rcp-tally'); if (tl) tl.classList.toggle('lit', t === 2);
      const cl = document.getElementById('rcp-call'); if (cl) cl.classList.toggle('lit', S.time - (c.paint.call || -99) < 3);
      refresh();
      if (performance.now() - lastOv > 500) { lastOv = performance.now(); drawOverview(); }
    },
    close() { SCOPE.active = false; S.hdrView = false; SCOPE.hdr = false; },
  };
  function drawOverview() {
    overview.innerHTML = '';
    overview.append(el('h3', {}, 'Vue d\'ensemble (matching)'));
    const tb = el('table', { class: 'tbl compact' }, el('thead', {}, el('tr', {}, ...['CAM', 'Iris', 'Gain', 'ND', 'Moyen', 'Crêtes', 'Écart R', 'Écart B'].map((h) => el('th', {}, h)))));
    const tbody = el('tbody'); tb.appendChild(tbody);
    for (const c of S.cams) {
      const e = c.colorError(); const t = tallyOf('CAM' + c.id);
      const bad = (v) => Math.abs(v) > 0.02 ? 'warn' : '';
      tbody.appendChild(el('tr', { class: c.id === sel ? 'sel' : '', onclick: () => select(c.id), style: { cursor: 'pointer' } },
        el('td', {}, el('span', { class: 'dot ' + (t === 2 ? 'red' : t === 1 ? 'green' : '') }), ' ' + c.id), el('td', {}, 'F' + fmt(c.effAperture(), 1)), el('td', {}, String(c.paint.gain)), el('td', {}, ND_FILTERS[c.paint.nd].label.split(' ')[0]),
        el('td', { class: c.meter.mean < 0.3 || c.meter.mean > 0.6 ? 'warn' : '' }, Math.round(c.meter.mean * 100) + ' %'), el('td', { class: c.meter.peak > 1.035 ? 'warn' : '' }, Math.round(c.meter.peak * 100) + ' %'),
        el('td', { class: bad(e.r) }, fmt(e.r * 100, 1) + ' %'), el('td', { class: bad(e.b) }, fmt(e.b * 100, 1) + ' %')));
    }
    overview.append(el('div', { class: 'tblwrap' }, tb), el('p', { class: 'note' }, 'Repères : niveau moyen 35 à 55 % selon le plan, crêtes ≤ 103 % (white clip), écarts de couleur sous 2 %. Cliquez une ligne pour prendre la caméra au RCP.'));
  }
}
