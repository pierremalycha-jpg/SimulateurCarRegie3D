// @ts-check
import { el } from '../../util.js';
import { MIRE_D, zoomPos } from '../optics.js';
import { makeViewfinder, drawScope } from '../vf.js';
import { seg, btnRow, linkBtn, lensRings, lensState, shell, scopeCanvas, irisPos, pointPos } from '../controls.js';

// ----------------------------------------------------------------------------------
// Manipulations du chapitre 5 (le corps de la caméra) : le menu dans le viseur et la face
// arrière. Le menu reprend la structure du mode d'emploi de la HXC-FB80 (TOP MENU, pages
// OPERATION, PAINT, MAINTENANCE, FILE, DIAGNOSIS et leurs numéros) et la façon de s'en servir :
// DISPLAY/MENU sur MENU, molette qu'on tourne et qu'on enfonce, CANCEL pour revenir. Quatre
// pages sont reproduites réglage par réglage (VF DISPLAY, VF MARKER, ZEBRA, VF OUT) ; les autres
// renvoient à la page du mode d'emploi.
// ----------------------------------------------------------------------------------

const send = (ctx, s) => { if (ctx && ctx.lens) ctx.lens(s); };
const OO = ['ON', 'OFF'];

/** le TOP MENU */
export const TOP_MENU = ['USER', 'USER MENU CUSTOMIZE', 'ALL', 'OPERATION', 'PAINT', 'MAINTENANCE', 'FILE', 'DIAGNOSIS'];
/**
 * les sommaires de chaque menu : code de la page sommaire, pages du mode d'emploi (en français),
 * et ses pages [code, nom, page d'origine pour le menu USER]
 * @type {Record<string, { code: string, man: string, pages: string[][] }>}
 */
export const MENU = {
  USER: { code: 'U00', man: '40', pages: [['U01', 'VF OUT', 'O08'], ['U02', 'VF DETAIL', 'O04'], ['U03', 'FOCUS ASSIST', 'O05'], ['U04', 'VF DISPLAY', 'O01'], ['U05', '\'!\' IND', 'O02'], ['U06', 'VF MARKER', 'O03'], ['U07', 'CURSOR', 'O07'], ['U08', 'ZEBRA', 'O06'], ['U09', 'SWITCH ASSIGN1', 'O09'], ['U10', 'SWITCH ASSIGN2', 'O10'], ['U11', 'LENS FILE', 'F04'], ['U12', 'HEADSET MIC', 'O12'], ['U13', 'INTERCOM', 'O13'], ['U14', 'AUDIO', 'M07'], ['U15', 'OUTPUT FORMAT', 'M09'], ['U16', 'TEST OUT', 'M10'], ['U17', 'SDI OUT', 'M11'], ['U18', 'TRUNK', 'M12'], ['U19', 'ROM VERSION', 'D03']] },
  OPERATION: { code: 'O00', man: '46 à 52', pages: [['O01', 'VF DISPLAY'], ['O02', '\'!\' IND'], ['O03', 'VF MARKER'], ['O04', 'VF DETAIL'], ['O05', 'FOCUS ASSIST'], ['O06', 'ZEBRA'], ['O07', 'CURSOR'], ['O08', 'VF OUT'], ['O09', 'SWITCH ASSIGN1'], ['O10', 'SWITCH ASSIGN2'], ['O11', 'VR ASSIGN'], ['O12', 'HEADSET MIC'], ['O13', 'INTERCOM'], ['O14', 'EARPHONE'], ['O15', 'TLCS'], ['O16', 'OPERATOR FILE']] },
  PAINT: { code: 'P00', man: '52 à 56', pages: [['P01', 'SW STATUS'], ['P02', 'VIDEO LEVEL'], ['P03', 'COLOR TEMP'], ['P04', 'GAMMA'], ['P05', 'BLACK GAMMA'], ['P06', 'SATURATION'], ['P07', 'KNEE'], ['P08', 'WHITE CLIP'], ['P09', 'DETAIL 1'], ['P10', 'DETAIL 2'], ['P11', 'SD DETAIL'], ['P12', 'SD CROSSCOLOR'], ['P13', 'SKIN DETAIL'], ['P14', 'USER MATRIX']] },
  MAINTENANCE: { code: 'M00', man: '57 à 61', pages: [['M01', 'AUTO SETUP'], ['M02', 'WHITE SHADING'], ['M03', 'BLACK SHADING'], ['M04', 'AUTO IRIS'], ['M05', 'LENS'], ['M06', 'CIS COMP'], ['M07', 'AUDIO'], ['M08', 'CALL/TALLY'], ['M09', 'OUTPUT FORMAT'], ['M10', 'TEST OUT'], ['M11', 'SDI OUT'], ['M12', 'TRUNK'], ['M13', 'GENLOCK'], ['M14', 'DATE']] },
  FILE: { code: 'F00', man: '62 et 63', pages: [['F01', 'OPERATOR FILE'], ['F02', 'SCENE FILE'], ['F03', 'REFERENCE'], ['F04', 'LENS FILE'], ['F05', 'FILE CLEAR']] },
  DIAGNOSIS: { code: 'D00', man: '63 et 64', pages: [['D01', 'TRANSMISSION'], ['D03', 'ROM VERSION']] },
};
/** les pages reproduites : chaque réglage, ses valeurs, sa valeur d'usine (quand le mode d'emploi la donne) */
const PAGES = {
  O01: { title: 'VF DISPLAY', items: [['EX', OO, 0], ['ZOOM', OO, 0], ['FOCUS', OO, 0], ['ND', OO, 0], ['CC', OO, 0], ['5600K', OO, 0], ['IRIS', OO, 0], ['WHITE', OO, 0], ['D.EXT', OO, 0], ['GAIN', OO, 0], ['SHUTTER', OO, 0], ['BATT', OO, 0], ['RETURN', OO, 0], ['TALK', OO, 0], ['AUDIO', OO, 0], ['AF', OO, 0], ['MESSAGE', ['ALL', 'AT', 'WRN', 'OFF'], 0], ['REMOTEIF', OO, 0], ['FRONT/REAR VR', OO, 0]] },
  O03: { title: 'VF MARKER', items: [['MARKER', OO, 1], ['CENTER', OO, 0], ['SAFETY ZONE', OO, 1], ['ZONE', ['80.0%', '90.0%', '92.5%', '95.0%'], 1], ['ASPECT', OO, 1]] },
  O06: { title: 'ZEBRA', items: [['ZEBRA1', OO, 1], ['LEVEL', 'n:50:109:%', 70], ['WIDTH', 'n:0:30:%', 10], ['ZEBRA2', OO, 1], ['LEVEL', 'n:50:109:%', 100]] },
  O08: { title: 'VF OUT', items: [['VF OUT', ['COLOR', 'Y', 'R', 'G', 'B'], 0], ['RET MIX VF', OO, 1], ['MIX DIRECTION', ['MAIN', 'RET'], 0], ['MIX VF MODE', ['Y-MIX', 'WIRE (W)', 'WIRE (B)'], 0], ['MIX VF LEVEL', 'n:0:80:%', 50], ['CHARACTER LEVEL', 'n:1:5:', 4], ['PinP', OO, 1]] },
};
/** le sommaire dont code est la page sommaire */
const contentsOf = (code) => Object.values(MENU).find((v) => v.code === code);
const menuOf = (code) => Object.keys(MENU).find((k) => MENU[k].code === code);
const nameOf = (code) => { for (const k of ['OPERATION', 'PAINT', 'MAINTENANCE', 'FILE', 'DIAGNOSIS', 'USER']) { const p = MENU[k].pages.find((x) => x[0] === code); if (p) return { menu: k, name: p[1] }; } return null; };

export const CORPS = {
  // =================================================================================
  /** le menu dans le viseur : DISPLAY/MENU, la molette, STATUS/CANCEL */
  menu(ctx) {
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, disp: 'DISPLAY', status: false };
    // l'état du menu : où l'on est, la ligne pointée, la valeur en cours de modification
    const M = { where: 'U00', ptr: 0, edit: null, last: 'U00', blink: 0 };
    const vals = {}; for (const [code, p] of Object.entries(PAGES)) vals[code] = p.items.map((it) => it[2]);
    const defis = [false, false, false];
    let blinkT = 0;
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
    const rings = lensRings(st, () => up(), []);
    const dispSw = seg('DISPLAY/MENU', [['DISPLAY', 'DISPLAY'], ['OFF', 'OFF'], ['MENU', 'MENU']], 'DISPLAY', (v) => { st.disp = v; if (v === 'MENU') { M.where = M.last; M.ptr = 0; M.edit = null; } up(); });
    const knob = el('button', { type: 'button', class: 'cl-knob', title: 'Molette du menu : tourner (molette de la souris, flèches) et appuyer (clic, Entrée)', 'aria-label': 'Molette du menu : flèches haut et bas pour tourner, Entrée pour appuyer' }, el('i', { 'aria-hidden': 'true' }));
    let rot = 0;
    const turn = (d) => { rot += d * 24; /** @type {HTMLElement} */ (knob.firstChild).style.transform = `rotate(${rot}deg)`; dial(d); };
    knob.addEventListener('wheel', (e) => { e.preventDefault(); turn(Math.sign(e.deltaY)); }, { passive: false });
    knob.addEventListener('click', () => press());
    knob.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); turn(1); } if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); } });
    const minus = el('button', { type: 'button', class: 'btn small', onclick: () => turn(-1) }, '↺ tourner');
    const plus = el('button', { type: 'button', class: 'btn small', onclick: () => turn(1) }, '↻ tourner');
    const pressB = el('button', { type: 'button', class: 'btn small', onclick: () => press() }, 'Appuyer');
    const statusB = el('button', { type: 'button', class: 'btn small', onclick: () => { if (st.disp !== 'MENU') { st.status = !st.status; up(); } } }, 'STATUS ▲');
    const cancelB = el('button', { type: 'button', class: 'btn small', onclick: () => cancel() }, 'CANCEL ▼');
    const sh = shell({ vf, scope: sc, ctrls: [dispSw.row, el('div', { class: 'cl-row cl-knobrow' }, el('span', { class: 'cl-lbl' }, 'Molette'), el('div', { class: 'cl-knobs' }, minus, knob, plus, pressB), el('span')), btnRow(statusB, cancelB)], defis: [
      'Ouvre le menu et va jusqu\'à la page ZEBRA du menu OPERATION.',
      'Allume ZEBRA1 à 70 % : les zébras se posent sur les gris autour de 70 %, le niveau d\'un visage bien exposé.',
      'Fais montrer au viseur la seule voie verte (VF OUT : G), puis referme le menu.',
    ] });

    // ---- ce qu'affiche une page : ses lignes ----
    function lines() {
      if (M.where === 'TOP') return TOP_MENU.map((t) => ({ label: t }));
      const contents = contentsOf(M.where);
      if (contents) return [{ label: 'TOP' }, ...contents.pages.map(([c, n]) => ({ label: `${c.slice(1)} ${n}` }))];
      const p = PAGES[M.where]; if (p) return p.items.map((it, i) => ({ label: it[0], value: show(it, vals[M.where][i]) }));
      return [];
    }
    const show = (it, v) => (Array.isArray(it[1]) ? it[1][v] : `${v}${String(it[1]).split(':')[3] || ''}`);
    function dial(d) {
      if (st.disp !== 'MENU') return;
      if (M.edit) {
        const it = PAGES[M.where].items[M.ptr], cur = M.edit.v;
        if (Array.isArray(it[1])) M.edit.v = (cur + d + it[1].length) % it[1].length;
        else { const [, lo, hi] = String(it[1]).split(':'); M.edit.v = Math.max(Number(lo), Math.min(Number(hi), cur + d)); }
      } else {
        const n = lines().length; if (n) M.ptr = (M.ptr + d + n) % n;
      }
      up();
    }
    function press() {
      if (st.disp !== 'MENU') return;
      if (M.edit) { vals[M.where][M.ptr] = M.edit.v; M.edit = null; up(); return; }
      if (M.where === 'TOP') { const k = TOP_MENU[M.ptr]; const c = MENU[k]; go(c ? c.code : 'X:' + k); return; }
      const contents = contentsOf(M.where);
      if (contents) {
        if (M.ptr === 0) { go('TOP'); return; }
        const [code, , target] = contents.pages[M.ptr - 1]; go(target || code); return;
      }
      if (PAGES[M.where]) { M.edit = { v: vals[M.where][M.ptr] }; blinkLoop(); up(); }
    }
    function cancel() {
      if (st.disp !== 'MENU') { st.status = false; up(); return; }
      // CANCEL : annule la valeur en cours, sinon revient au sommaire, puis au TOP MENU
      if (M.edit) { M.edit = null; up(); return; }
      if (M.where === 'TOP') return;
      const info = nameOf(M.where);
      if (info) { go(MENU[info.menu].code); return; }
      go('TOP');
    }
    function go(code) { M.where = code; M.last = code; M.ptr = 0; M.edit = null; up(); }
    function blinkLoop() { clearInterval(blinkT); blinkT = window.setInterval(() => { if (!M.edit) { clearInterval(blinkT); return; } M.blink ^= 1; up(); }, 450); }

    // ---- le menu dessiné dans le viseur, comme les caractères de la caméra ----
    function overlay(g, W, H) {
      if (st.disp === 'MENU') {
        const L = lines(); const x0 = W * 0.1, y0 = H * 0.1, w = W * 0.8, h = H * 0.8, lh = 19;
        g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(x0, y0, w, h);
        g.font = '600 15px "B612 Mono", monospace'; g.fillStyle = '#f1f1ea'; g.textAlign = 'left';
        const info = nameOf(M.where), page = PAGES[M.where];
        const title = M.where === 'TOP' ? 'TOP MENU' : page ? `<${page.title}>` : info ? `<${info.name}>` : `<${menuOf(M.where) || M.where.replace('X:', '')}>`;
        g.fillText(title, x0 + 14, y0 + 22);
        g.textAlign = 'right'; if (M.where !== 'TOP' && !M.where.startsWith('X:')) g.fillText(M.where, x0 + w - 14, y0 + 22);
        g.textAlign = 'left';
        const rows = Math.floor((h - 44) / lh), first = Math.max(0, Math.min(M.ptr - rows + 2, L.length - rows));
        if (!L.length) {
          const man = info ? MENU[info.menu].man : '';
          g.fillStyle = '#c9cdc5'; g.font = '500 13px "Archivo", sans-serif';
          g.fillText('Page non reproduite dans la maquette.', x0 + 14, y0 + 56);
          g.fillText(man ? `Ses réglages : mode d'emploi HXC-FB80, p. ${man}.` : 'Voir le mode d\'emploi de la HXC-FB80.', x0 + 14, y0 + 76);
          g.fillText('CANCEL pour revenir.', x0 + 14, y0 + 96);
          return;
        }
        L.slice(first, first + rows).forEach((ln, i) => {
          const k = first + i, y = y0 + 48 + i * lh;
          const cur = k === M.ptr;
          g.fillStyle = cur ? '#ffd65a' : '#f1f1ea';
          if (cur) g.fillText(M.edit ? (M.blink ? '?' : ' ') : '▶', x0 + 10, y);
          g.fillText(ln.label, x0 + 30, y);
          if (ln.value != null) { g.textAlign = 'right'; g.fillText(cur && M.edit ? show(page.items[k], M.edit.v) : ln.value, x0 + w - 14, y); g.textAlign = 'left'; }
        });
      } else if (st.status) {
        g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(W * 0.1, H * 0.1, W * 0.8, H * 0.5);
        g.font = '600 15px "B612 Mono", monospace'; g.fillStyle = '#f1f1ea'; g.textAlign = 'left';
        ['<STATUS>', 'ND:CLEAR   CC:5600K', 'GAIN:L 0dB  SHUTTER:OFF', 'WHITE:PRST  OUTPUT:CAM', 'FORMAT:1080-50i'].forEach((t, i) => g.fillText(t, W * 0.1 + 14, H * 0.1 + 24 + i * 21));
      }
    }
    function olivier() {
      if (defis[2]) return 'VF OUT ne change que le viseur : la sortie de la caméra reste en couleur. En voie verte, le cadreur voit mieux le point : c\'est elle qui porte presque tout le détail.';
      if (defis[1]) {
        if (st.disp !== 'MENU') return vals.O08[0] === 3 ? 'Menu fermé.' : 'Rouvre le menu (DISPLAY/MENU sur MENU) : il revient à la dernière page.';
        return M.where === 'O08' ? (vals.O08[0] === 3 ? 'Voie verte choisie : bascule DISPLAY/MENU sur OFF pour refermer le menu.' : 'Appuie sur la molette sur la ligne VF OUT, tourne jusqu\'à G, appuie pour valider.') : 'CANCEL revient au sommaire de OPERATION : la page 08 est VF OUT.';
      }
      if (defis[0]) return M.edit ? 'Le point d\'interrogation clignote : tourne la molette pour changer la valeur, appuie pour l\'enregistrer. CANCEL avant d\'appuyer remet l\'ancienne valeur.' : 'Pointe ZEBRA1 et appuie sur la molette pour changer sa valeur.';
      if (st.disp !== 'MENU') return 'Bascule DISPLAY/MENU sur MENU : le menu s\'ouvre sur la dernière page vue, ici le sommaire USER.';
      if (M.where === 'U00') return 'Le menu USER regroupe les pages les plus utiles. Pour tout voir, pointe TOP et appuie sur la molette.';
      if (M.where === 'TOP') return 'TOP MENU : pointe OPERATION et appuie.';
      if (M.where === 'O00') return 'Le sommaire OPERATION : la page 06 est ZEBRA.';
      return 'CANCEL revient en arrière.';
    }
    function up() {
      const o = rings.read();
      if (!defis[0] && M.where === 'O06') defis[0] = true;
      const z1 = vals.O06[0] === 0, z2 = vals.O06[3] === 0;
      if (defis[0] && !defis[1] && z1 && vals.O06[1] === 70) defis[1] = true;
      const chan = /** @type {any} */ (['COLOR', 'Y', 'R', 'G', 'B'][vals.O08[0]]);
      if (defis[1] && !defis[2] && chan === 'G' && st.disp !== 'MENU') defis[2] = true;
      const zebra = z1 ? { level: vals.O06[1], width: vals.O06[2], band: true } : z2 ? { level: vals.O06[4] } : undefined;
      const mk = vals.O03[0] === 0, osd = st.disp === 'DISPLAY';
      sh.done(defis); sh.say(olivier());
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5, chan, zebra, osd, safety: mk && vals.O03[2] === 0, overlay });
      send(ctx, lensState(st, o, { light: 0.5, chan, zebra: zebra ? (zebra.band ? [zebra.level - zebra.width / 2, zebra.level + zebra.width / 2] : [zebra.level, 999]) : null }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => {
      for (const [code, p] of Object.entries(PAGES)) vals[code] = p.items.map((it) => it[2]);
      Object.assign(M, { where: 'U00', ptr: 0, edit: null, last: 'U00' }); st.disp = 'DISPLAY'; st.status = false; dispSw.mark('DISPLAY'); defis.fill(false); up();
    })));
    up();
    return { node: sh.node, dispose: () => { clearInterval(blinkT); vf.dispose(); } };
  },

  // =================================================================================
  /** la face arrière : brancher chaque équipement sur la bonne prise */
  connectique(ctx) {
    // les prises de la face arrière (mode d'emploi, « Arrière »), placées comme sur la caméra
    const P = [
      { id: 'dcin', nom: 'DC IN', type: 'XLR 4 broches', x: 50, y: 132, kind: 'xlr', pins: 4, r: 26 },
      { id: 'earphone', nom: 'EARPHONE', type: 'mini-jack stéréo', x: 112, y: 52, kind: 'jack', r: 9 },
      { id: 'intercom', nom: 'INTERCOM', type: 'XLR 5 broches', x: 128, y: 132, kind: 'xlr', pins: 5, r: 25 },
      { id: 'audio2', nom: 'AUDIO 2 IN', type: 'XLR 3 broches', x: 206, y: 132, kind: 'xlr', pins: 3, r: 25 },
      { id: 'remote', nom: 'REMOTE', type: 'rond 8 broches', x: 282, y: 70, kind: 'multi', pins: 8, r: 15 },
      { id: 'dcout', nom: 'DC OUT', type: 'rond 4 broches', x: 282, y: 140, kind: 'multi', pins: 4, r: 13 },
      { id: 'testout', nom: 'TEST OUT', type: 'BNC', x: 342, y: 70, kind: 'bnc', r: 13 },
      { id: 'prompter', nom: 'PROMPTER/GENLOCK', type: 'BNC', x: 342, y: 140, kind: 'bnc', r: 13 },
      { id: 'sdiout', nom: 'SDI OUT', type: 'BNC', x: 398, y: 70, kind: 'bnc', r: 13 },
      { id: 'sdiio', nom: 'SDI I/O', type: 'BNC', x: 398, y: 140, kind: 'bnc', r: 13 },
    ];
    /** @type {[string, string, string, number][]} ce qu'il faut brancher : équipement, prise, explication, groupe */
    const T = [
      ['Le casque-micro du cadreur', 'intercom', 'INTERCOM, XLR 5 broches : l\'écoute et le micro du casque passent dans le même câble.', 0],
      ['Un micro d\'ambiance sur la caméra', 'audio2', 'AUDIO 2 IN, XLR 3 broches femelle : le sélecteur au-dessus choisit LINE, MIC ou MIC +48 V (alimentation fantôme).', 0],
      ['Une oreillette pour écouter', 'earphone', 'EARPHONE, mini-jack stéréo : on y écoute l\'intercom ou le son des entrées audio.', 0],
      ['Un moniteur de contrôle sur le pied', 'sdiout', 'SDI OUT, BNC : l\'image de la caméra en 3G-SDI, HD-SDI ou SD-SDI.', 1],
      ['Le prompteur du présentateur', 'prompter', 'PROMPTER/GENLOCK, BNC : avec une CCU, la sortie du texte du prompteur (vidéo analogique).', 1],
      ['Un moniteur analogique de test', 'testout', 'TEST OUT, BNC : une sortie analogique (VBS, Y ou synchro), pour un contrôle rapide.', 1],
      ['Un retour vidéo en SDI, caméra sans CCU', 'sdiio', 'SDI I/O, BNC : entrée ou sortie, au choix dans le menu ; en entrée, elle reçoit un retour.', 1],
      ['Le bloc d\'alimentation secteur (AC-DN10)', 'dcin', 'DC IN, XLR 4 broches : l\'alimentation 12 V quand la caméra n\'est pas alimentée par la CCU.', 2],
      ['La lampe du script, sur la poignée', 'dcout', 'DC OUT, rond 4 broches : il fournit du courant à un accessoire, 1,5 A au plus.', 2],
      ['Un RCP branché en direct, sans CCU', 'remote', 'REMOTE, rond 8 broches : la commande à distance de la caméra par un pupitre.', 2],
    ];
    const placed = new Set(); let sel = null;
    const defis = [false, false, false];
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 440 190'); svg.setAttribute('class', 'cf cl-plate'); svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Face arrière de la caméra : les prises');
    const mk = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent.append(e); return e; };
    mk('rect', { x: 4, y: 4, width: 432, height: 182, rx: 8, class: 'cl-plate-bg' });
    mk('rect', { x: 170, y: 24, width: 74, height: 26, rx: 3, class: 'cl-plate-sw' });
    mk('text', { x: 207, y: 18, class: 'cf-s' }).textContent = 'LINE · MIC · MIC +48V';
    const holes = new Map();
    for (const p of P) {
      const g = mk('g', { class: 'cl-jack', tabindex: 0, role: 'button', 'aria-label': `${p.nom}, ${p.type}`, 'data-id': p.id });
      mk('circle', { cx: p.x, cy: p.y, r: p.r + 4, class: 'cl-jk-ring' }, g);
      mk('circle', { cx: p.x, cy: p.y, r: p.r, class: 'cl-jk-body' }, g);
      if (p.kind === 'xlr') { for (let i = 0; i < p.pins; i++) { const a = -Math.PI / 2 + (i - (p.pins - 1) / 2) * (p.pins > 3 ? 0.9 : 1.15) + Math.PI; mk('circle', { cx: p.x + Math.cos(a) * p.r * 0.48, cy: p.y + Math.sin(a) * p.r * 0.48, r: 2.6, class: 'cl-jk-pin' }, g); } mk('rect', { x: p.x - 3, y: p.y - p.r + 1, width: 6, height: 6, class: 'cl-jk-pin' }, g); }
      if (p.kind === 'bnc') { mk('circle', { cx: p.x, cy: p.y, r: p.r * 0.55, class: 'cl-jk-pin' }, g); mk('circle', { cx: p.x, cy: p.y, r: 2, class: 'cl-jk-ring' }, g); }
      if (p.kind === 'jack') mk('circle', { cx: p.x, cy: p.y, r: 3.4, class: 'cl-jk-pin' }, g);
      if (p.kind === 'multi') for (let i = 0; i < p.pins; i++) { const a = i / p.pins * Math.PI * 2; mk('circle', { cx: p.x + Math.cos(a) * p.r * 0.55, cy: p.y + Math.sin(a) * p.r * 0.55, r: 1.6, class: 'cl-jk-pin' }, g); }
      // un nom long se coupe après sa barre (PROMPTER/ GENLOCK) ; la barre reste écrite, pour que le texte lu
      // à l'écran soit celui du nom du bouton
      (p.nom.length > 10 ? p.nom.replace('/', '/\n') : p.nom).split('\n').forEach((line, i) => { mk('text', { x: p.x, y: p.y + p.r + 16 + i * 11, class: 'cl-jk-lbl' }, g).textContent = line; });
      const choose = () => plug(p.id);
      g.addEventListener('click', choose); g.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter' || /** @type {KeyboardEvent} */ (e).key === ' ') { e.preventDefault(); choose(); } });
      holes.set(p.id, g);
    }
    const chips = el('div', { class: 'cl-see cl-gear' }, ...T.map(([nom], i) => el('button', { type: 'button', class: 'cl-chip', 'data-i': String(i), onclick: () => { sel = i; up(); } }, nom)));
    const say = { t: '' };
    const sh = shell({ vf: { canvas: svg }, ctrls: [el('p', { class: 'cl-hint' }, 'Choisis un équipement, puis clique sur la prise où le brancher.'), chips], defis: [
      'Le son : le casque du cadreur, un micro d\'ambiance, une oreillette.',
      'L\'image : un moniteur de contrôle, le prompteur, un moniteur de test, un retour sans CCU.',
      'L\'alimentation et la commande : le bloc secteur, la lampe du script, un RCP en direct.',
    ], vfClass: 'cl-vf-plate' });
    function plug(id) {
      if (sel == null) { const p = P.find((x) => x.id === id); say.t = `${p.nom} : ${p.type}. Choisis d'abord un équipement dans la liste.`; up(); return; }
      const [nom, target, expl] = T[sel];
      if (id === target) { placed.add(sel); say.t = expl; sel = null; }
      else {
        const p = P.find((x) => x.id === id), t = P.find((x) => x.id === target);
        say.t = `Pas ${p.nom} (${p.type}) pour « ${nom.toLowerCase()} ». Cherche une prise ${t.type}${p.kind === t.kind && p.kind !== 'xlr' ? ', il y en a plusieurs de ce type : lis les inscriptions' : ''}.`;
      }
      up();
    }
    function up() {
      for (let gi = 0; gi < 3; gi++) defis[gi] = T.every((t, i) => t[3] !== gi || placed.has(i));
      [...chips.children].forEach((b, i) => { b.classList.toggle('on', sel === i); b.classList.toggle('done', placed.has(i)); /** @type {HTMLButtonElement} */ (b).disabled = placed.has(i); });
      for (const [id, g] of holes) g.classList.toggle('used', T.some((t, i) => t[1] === id && placed.has(i)));
      sh.done(defis);
      sh.say(say.t || (defis.every(Boolean) ? 'Tout est branché. La prise fibre vers la CCU et la prise LENS de l\'objectif ne sont pas sur cette face : ce sont les deux câbles qu\'on vérifie en premier.' : 'Chaque prise a sa forme : XLR à 3, 4 ou 5 broches, BNC à baïonnette, mini-jack, prises rondes à broches. On ne peut pas se tromper de forme, seulement de prise.'));
      send(ctx, {});
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { placed.clear(); sel = null; say.t = ''; defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },
};
