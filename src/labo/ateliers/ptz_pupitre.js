// @ts-check
import { el } from '../../util.js';
import { MODELES, appareil, enMarche, adresse, ipOk, prefixe, adresseHote, dansReseau, camDuNumero, modeNumero, tallyRouge, imageMelangeur, liaisonsPupitre } from '../calc/ptz.js';
import { commande, urlCommande } from '../../cours/ptz_calc.js';

// ----------------------------------------------------------------------------------
// La vue « Le pupitre AW-RP150 » de l'atelier Caméras PTZ (v19.30), sur le modèle de sa face avant (mode d'emploi
// Panasonic DVQP1819) :
//   - en haut à gauche, les réglages de caméra : molettes IRIS (et AUTO), M.PED, R/B GAIN, R/B PED ; touches A/3200K,
//     B/5600K, ATW/VAR, ABB, BARS, SCENE, ON/OFF ;
//   - au centre, l'écran tactile de 7 pouces et, dessous, les molettes F1 à F4 ; à côté, les touches de menu PAINT,
//     FUNCTION, MAINTENANCE, PMEM/TMEM, SYSTEM (un second appui revient à l'écran d'état) ;
//   - en bas, CAMERA/GROUP SELECTION 1 à 10 (voyant vert : liaison ; rouge : à l'antenne) et USER 1 à 6 ;
//   - à droite, ENABLE (déverrouille le joystick et le levier), le joystick et son levier à bascule ZOOM/FOCUS.
// L'écran : l'écran d'état (numéro, modèle, TALLY, IRIS, ZOOM, FOCUS ; en bas, les valeurs des molettes F1 à F4) ;
// SYSTEM → CONNECT SETTING (CNNCT MD : LAN, SERIAL, NONE par numéro), MANUAL IP SET, AUTO IP SET, RP IP SET ;
// PMEM/TMEM (les presets de la caméra : enregistrer, rappeler). L'affectation des molettes F1 à F4 est simplifiée.
// Chaque geste au joystick affiche la vraie commande HTTP envoyée (cours/ptz_calc.js).
// ----------------------------------------------------------------------------------
const MENUS = [['paint', 'PAINT'], ['function', 'FUNCTION'], ['maintenance', 'MAINTENANCE'], ['pmem', 'PMEM/TMEM'], ['system', 'SYSTEM']];
const SYSTEME = [['connect', 'CONNECT SETTING'], ['manual', 'MANUAL IP SET'], ['auto', 'AUTO IP SET'], ['rpip', 'RP IP SET']];

export function vuePupitre(/** @type {import('../kit.js').Ctx} */ ctx, /** @type {{ local: () => void, lock: (k: string) => boolean, pos: Record<string, { pan: number, tilt: number, zoom: number, focus?: number }> }} */ H) {
  const st = () => ctx.st;
  const U = {
    ecran: 'etat', msg: '', cmd: '', enable: false, pt: 4, zf: 'zoom', store: false,
    ip: /** @type {null | { ip: string, masque: string, passerelle: string }} */ (null),
    cams: /** @type {Record<string, { ip: string, port: string }>} */ ({}),
    img: /** @type {Record<string, { iris: number, auto: boolean, mped: number, rgain: number, bgain: number, rped: number, bped: number, bars: boolean, wb: string }>} */ ({}),
    pmem: /** @type {Record<string, Record<number, { pan: number, tilt: number, zoom: number }>>} */ ({}),
  };
  const root = el('div', { class: 'lb-vue' });
  const imgDe = (cam) => U.img[cam] || (U.img[cam] = { iris: 50, auto: false, mped: 0, rgain: 0, bgain: 0, rped: 0, bped: 0, bars: false, wb: 'A' });
  const posDe = (cam) => H.pos[cam] || (H.pos[cam] = { pan: 0, tilt: 0, zoom: 0, focus: 50 });
  const sel = () => st().rp.sel;
  const camSel = () => camDuNumero(st(), sel());
  const bouton = (t, f, o = {}) => el('button', { type: 'button', class: 'tz-rk' + (o.cls ? ' ' + o.cls : ''), 'data-k': o.k || null, 'aria-label': o.aria || null, 'aria-pressed': o.on == null ? null : String(!!o.on), disabled: o.dis ? true : null, onclick: f }, t);
  const dire = (t) => { U.msg = t; H.local(); };
  const champ = (label, val, set, k, dis) => { const i = /** @type {HTMLInputElement} */ (el('input', { type: 'text', value: val, 'aria-label': label, 'data-k': k, spellcheck: 'false', autocomplete: 'off', disabled: dis ? true : null })); i.addEventListener('input', () => set(i.value)); return el('label', { class: 'tz-field' }, el('span', {}, label), i); };

  /** une molette : un nom, une valeur, deux crans */
  const molette = (nom, val, moins, plus, k) => el('div', { class: 'tz-mol' }, el('span', { class: 'tz-mol-n' }, nom),
    el('div', { class: 'tz-mol-c' }, bouton('−', moins, { aria: `${nom} : moins`, k: k + ':-' }), el('b', { class: 'tz-mol-v' }, String(val)), bouton('+', plus, { aria: `${nom} : plus`, k: k + ':+' })));
  /** régler l'image de la caméra choisie (le pupitre la commande : il faut une liaison) */
  const regler = (f) => { const c = camSel(); if (!c) { dire(`CAM${sel()} : PAS DE LIAISON`); return; } f(imgDe(c)); U.msg = ''; H.local(); };

  // ---------------- l'écran ----------------
  function ecran() {
    const rp = appareil(st(), 'rp'), L = liaisonsPupitre(st()), n = sel(), c = camSel(), C = c ? appareil(st(), c) : null, T = tallyRouge(st());
    const tete = el('div', { class: 'tz-rp-status' }, el('span', {}, `RP ${rp.ip}`), el('span', {}, `${L.filter((x) => x.ok).length} caméra(s) en LAN`));
    const retour = (vers, t) => bouton('◀ ' + t, () => { U.ecran = vers; U.msg = ''; H.local(); }, { cls: 'tz-rk-back', k: 'rp:retour' });
    let page;
    if (U.ecran === 'etat') {
      const I = c ? imgDe(c) : null, p = c ? posDe(c) : null;
      page = el('div', { class: 'tz-rp-etat' },
        el('div', { class: 'tz-rp-cam' }, el('b', {}, `CAM ${n}`), el('span', {}, C ? MODELES[C.modele].nom : '—'), el('span', { class: 'tz-rp-tally' + (T.n === n ? ' on' : '') }, 'TALLY')),
        C ? el('dl', { class: 'tz-dl' }, el('dt', {}, 'IRIS'), el('dd', {}, I.auto ? 'AUTO' : String(I.iris)), el('dt', {}, 'ZOOM'), el('dd', {}, `${Math.round(p.zoom)} %`), el('dt', {}, 'FOCUS'), el('dd', {}, `${Math.round(p.focus ?? 50)} %`), el('dt', {}, 'PAN / TILT'), el('dd', {}, `${p.pan}° / ${p.tilt}°`), I.bars ? [el('dt', {}, 'BARS'), el('dd', {}, 'ON')] : null)
          : el('p', { class: 'tz-rp-warn' }, `CAM ${n} : ${(L.find((x) => x.n === n) || { pb: modeNumero(st(), n) === 'NONE' ? 'non affectée (SYSTEM → CONNECT SETTING)' : 'pas d\'adresse (SYSTEM → MANUAL IP SET)' }).pb}`),
        U.cmd ? el('p', { class: 'tz-cmd' }, el('small', {}, 'Dernière commande envoyée'), el('code', {}, U.cmd)) : null,
        el('div', { class: 'tz-rp-f' }, ...[['F1', `P/T SPEED ${U.pt}`], ['F2', `IRIS ${C ? (imgDe(c).auto ? 'AUTO' : imgDe(c).iris) : '—'}`], ['F3', `M.PED ${C ? imgDe(c).mped : '—'}`], ['F4', `ZOOM/FOCUS : ${U.zf.toUpperCase()}`]].map(([f, t]) => el('span', {}, el('b', {}, f), ' ', t))));
    } else if (U.ecran === 'system') {
      page = el('div', { class: 'tz-rp-page' }, el('h5', {}, 'SYSTEM'), el('div', { class: 'tz-rp-liste' }, ...SYSTEME.map(([k, t]) => bouton(t, () => { U.ecran = k; U.msg = ''; H.local(); }, { k: 'rp:sys:' + k, cls: 'tz-rk-item' }))));
    } else if (U.ecran === 'connect') {
      const modes = ['LAN', 'SERIAL', 'NONE'];
      page = el('div', { class: 'tz-rp-page' }, retour('system', 'SYSTEM'), el('h5', {}, 'CONNECT SETTING'),
        el('table', { class: 'tz-table tz-rp-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'CAM'), el('th', {}, 'CNNCT MD'))),
          el('tbody', {}, ...Array.from({ length: 10 }, (_, i) => { const k = i + 1, m = modeNumero(st(), k); return el('tr', {}, el('th', { scope: 'row' }, `CAM${k}`), el('td', {}, el('div', { class: 'seg' }, ...modes.map((x) => el('button', { type: 'button', 'aria-pressed': String(m === x), 'data-k': `rp:mode${k}:${x}`, 'aria-label': `Caméra ${k} : ${x}`, onclick: () => ctx.changer({ [`rp.modes.${k}`]: x }) }, x))))); }))));
    } else if (U.ecran === 'manual') {
      const lignes = Array.from({ length: 10 }, (_, i) => {
        const k = i + 1, cur = (st().rp.cams || {})[k] || { ip: '', port: 80 };
        const F = U.cams[k] || (U.cams[k] = { ip: cur.ip, port: String(cur.port || 80) });
        const l = L.find((x) => x.n === k);
        return el('tr', {}, el('th', { scope: 'row' }, `CAM${k}`),
          el('td', {}, el('input', { type: 'text', value: F.ip, 'aria-label': `Adresse IP de la caméra ${k}`, 'data-k': `rp:cam${k}:ip`, spellcheck: 'false', autocomplete: 'off', oninput: (e) => { F.ip = e.target.value; } })),
          el('td', {}, el('input', { type: 'text', inputmode: 'numeric', value: F.port, 'aria-label': `Port de la caméra ${k}`, 'data-k': `rp:cam${k}:port`, oninput: (e) => { F.port = e.target.value; } })),
          el('td', { class: l ? (l.ok ? 'ok' : 'bad') : '' }, !l ? '—' : l.ok ? 'OK' : l.pb));
      });
      const set = () => {
        const cams = {};
        for (const [k, F] of Object.entries(U.cams)) { if (!F.ip.trim()) continue; if (!ipOk(F.ip.trim())) { dire(`CAM${k} : ADRESSE INVALIDE`); return; } cams[k] = { ip: F.ip.trim(), port: Math.round(Number(F.port)) || 80 }; }
        U.msg = 'SET : adresses enregistrées.'; ctx.changer({ 'rp.cams': cams });
      };
      page = el('div', { class: 'tz-rp-page' }, retour('system', 'SYSTEM'), el('h5', {}, 'MANUAL IP SET'),
        el('div', { class: 'tz-tablewrap' }, el('table', { class: 'tz-table tz-rp-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'CAM'), el('th', {}, 'IP ADDRESS'), el('th', {}, 'PORT'), el('th', {}, 'STATUS'))), el('tbody', {}, ...lignes))),
        el('div', { class: 'tz-acts' }, bouton('SET', set, { k: 'rp:camset', cls: 'tz-rk-set' })));
    } else if (U.ecran === 'auto') {
      page = el('div', { class: 'tz-rp-page' }, retour('system', 'SYSTEM'), el('h5', {}, 'AUTO IP SET'),
        el('p', {}, 'AUTO SET : RENEW (nouvelles adresses) ou KEEP (garder celles qui sont là). Le pupitre cherche les caméras et leur donne des adresses à la suite.'),
        el('div', { class: 'tz-acts' }, bouton('RENEW', () => dire('AUTO IP SETTING : non simulé sur ce banc. La fiche impose ses adresses : réglez-les avec Easy IP Setup, puis MANUAL IP SET.'), { k: 'rp:auto:renew' }), bouton('KEEP', () => dire('AUTO IP SETTING : non simulé sur ce banc. On ne le lance pas en même temps qu\'Easy IP Setup.'), { k: 'rp:auto:keep' })));
    } else if (U.ecran === 'rpip') {
      if (!U.ip) U.ip = { ip: rp.ip, masque: rp.masque, passerelle: rp.passerelle };
      const F = U.ip, dis = H.lock('appareils.rp') || H.lock('appareils');
      const set = () => {
        if (!ipOk(F.ip) || prefixe(F.masque) == null || !adresseHote(F.ip, F.masque)) { dire('ADRESSE OU MASQUE INVALIDE'); return; }
        if (F.passerelle && (!ipOk(F.passerelle) || !dansReseau(F.ip, F.masque, F.passerelle))) { dire('PASSERELLE HORS DU SOUS-RÉSEAU'); return; }
        U.msg = 'SET : le pupitre redémarre son réseau.'; U.ip = null;
        ctx.changer({ 'appareils.rp.ip': F.ip.trim(), 'appareils.rp.masque': F.masque.trim(), 'appareils.rp.passerelle': F.passerelle.trim() });
      };
      page = el('div', { class: 'tz-rp-page' }, retour('system', 'SYSTEM'), el('h5', {}, 'RP IP SET'),
        el('div', { class: 'tz-form' }, champ('IP ADDRESS', F.ip, (v) => { F.ip = v; }, 'rp:ip', dis), champ('SUBNET MASK', F.masque, (v) => { F.masque = v; }, 'rp:masque', dis), champ('DEFAULT GATEWAY', F.passerelle, (v) => { F.passerelle = v; }, 'rp:passerelle', dis)),
        el('p', { class: 'tz-note' }, `MAC ADDRESS ${rp.mac}`),
        el('div', { class: 'tz-acts' }, bouton('SET', set, { k: 'rp:ipset', cls: 'tz-rk-set', dis })));
    } else if (U.ecran === 'pmem') {
      const P = c ? (U.pmem[c] || (U.pmem[c] = {})) : {}, cur = c ? posDe(c) : null;
      const egal = (a, b) => a && b && a.pan === b.pan && a.tilt === b.tilt && a.zoom === b.zoom;
      page = el('div', { class: 'tz-rp-page' }, el('h5', {}, `PMEM LIST · CAM ${n}`),
        !c ? el('p', { class: 'tz-rp-warn' }, `CAM ${n} : pas de liaison.`) : el('div', { class: 'tz-pmem' }, ...Array.from({ length: 12 }, (_, i) => {
          const k = i + 1, p = P[k];
          return el('button', { type: 'button', class: 'tz-pm' + (p ? ' rempli' : '') + (egal(p, cur) ? ' actuel' : ''), 'data-k': `rp:pm${k}`, 'aria-label': `Preset ${k}${p ? ', enregistré' : ', vide'}`, onclick: () => {
            if (U.store) { P[k] = { ...cur }; U.store = false; dire(`PMEM STORE : preset ${k} enregistré pour CAM ${n}.`); return; }
            if (!p) { dire(`Preset ${k} vide : PMEM STORE, puis touchez un numéro.`); return; }
            Object.assign(posDe(c), p); U.cmd = ''; dire(`Rappel du preset ${k} : CAM ${n} y va.`);
          } }, String(k));
        })),
        c ? el('div', { class: 'tz-acts' }, bouton('PMEM STORE', () => { U.store = !U.store; dire(U.store ? 'Touchez le numéro où enregistrer la position actuelle.' : ''); }, { k: 'rp:pmstore', on: U.store })) : null,
        el('p', { class: 'tz-note' }, '100 presets par caméra ; enregistré en gris, en cours en jaune.'));
    } else if (U.ecran === 'paint') {
      const I = c ? imgDe(c) : null;
      page = el('div', { class: 'tz-rp-page' }, el('h5', {}, `PAINT · CAM ${n}`), I ? el('dl', { class: 'tz-dl' }, el('dt', {}, 'R GAIN / B GAIN'), el('dd', {}, `${I.rgain} / ${I.bgain}`), el('dt', {}, 'R PED / B PED'), el('dd', {}, `${I.rped} / ${I.bped}`), el('dt', {}, 'M.PED'), el('dd', {}, String(I.mped)), el('dt', {}, 'WHITE BAL'), el('dd', {}, I.wb)) : el('p', { class: 'tz-rp-warn' }, 'Pas de liaison.'));
    } else {
      const items = U.ecran === 'maintenance' ? ['RP INIT', 'DATA SAVE', 'DATA LOAD', 'LED BRI', 'BUZZER', 'CARD FRMT'] : ['SCENE', 'USER', 'TALLY', 'GPIO'];
      page = el('div', { class: 'tz-rp-page' }, el('h5', {}, U.ecran.toUpperCase()), el('div', { class: 'tz-rp-liste' }, ...items.map((t) => bouton(t, () => dire(`${t} : non simulé sur ce banc.`), { cls: 'tz-rk-item' }))));
    }
    return el('div', { class: 'tz-rp-screen', role: 'region', 'aria-label': 'Écran tactile du pupitre' }, tete, page, U.msg ? el('p', { class: 'tz-rp-msg', role: 'status' }, U.msg) : null);
  }

  // ---------------- le joystick et le levier ----------------
  function bouger(dp, dt, dz) {
    if (!U.enable) { dire('ENABLE est éteint : le joystick et le levier sont verrouillés.'); return; }
    const cam = camSel(); if (!cam) { dire(`CAM${sel()} : PAS DE LIAISON`); return; }
    const c = appareil(st(), cam), p = posDe(cam), v = U.pt * 7;
    if (dz && U.zf === 'focus') { p.focus = Math.max(0, Math.min(100, (p.focus ?? 50) + dz)); U.cmd = ''; U.msg = 'Point réglé au levier (ZOOM/FOCUS sur FOCUS).'; H.local(); return; }
    p.pan = Math.max(-175, Math.min(175, p.pan + dp)); p.tilt = Math.max(-30, Math.min(90, p.tilt + dt)); p.zoom = Math.max(0, Math.min(100, p.zoom + dz));
    const cmd = dz ? commande('zoom', Math.sign(dz) * v) : commande('pt', Math.sign(dp) * v, Math.sign(dt) * v);
    U.cmd = urlCommande(adresse(c), c.http, cmd); U.msg = '';
    const t = st().rp.testees || [];
    if (!t.includes(cam)) ctx.changer({ 'rp.testees': [...t, cam] }); else H.local();
  }

  function rendre() {
    const on = enMarche(st(), 'rp'), L = liaisonsPupitre(st()), T = tallyRouge(st()), I = imageMelangeur(st());
    const c = camSel(), img = c ? imgDe(c) : null;
    const menu = (k) => () => { U.ecran = U.ecran === k ? 'etat' : k; U.msg = ''; H.local(); };
    // en haut à gauche : les réglages de la caméra choisie
    const reglages = el('div', { class: 'tz-rp-regl', role: 'group', 'aria-label': 'Réglages de caméra' },
      el('div', { class: 'tz-rp-mols' },
        molette('IRIS', img ? (img.auto ? 'AUTO' : img.iris) : '—', () => regler((I) => { I.auto = false; I.iris = Math.max(0, I.iris - 5); }), () => regler((I) => { I.auto = false; I.iris = Math.min(100, I.iris + 5); }), 'rp:iris'),
        molette('M.PED', img ? img.mped : '—', () => regler((I) => { I.mped -= 1; }), () => regler((I) => { I.mped += 1; }), 'rp:mped'),
        molette('R/B GAIN', img ? `${img.rgain}/${img.bgain}` : '—', () => regler((I) => { I.rgain -= 1; }), () => regler((I) => { I.rgain += 1; }), 'rp:rbgain'),
        molette('R/B PED', img ? `${img.rped}/${img.bped}` : '—', () => regler((I) => { I.rped -= 1; }), () => regler((I) => { I.rped += 1; }), 'rp:rbped')),
      el('div', { class: 'tz-rp-touches' },
        bouton('AUTO', () => regler((I) => { I.auto = !I.auto; }), { on: img && img.auto, k: 'rp:auto' }),
        bouton('A/3200K', () => regler((I) => { I.wb = 'A (3200K)'; }), { on: img && img.wb.startsWith('A') }),
        bouton('B/5600K', () => regler((I) => { I.wb = 'B (5600K)'; }), { on: img && img.wb.startsWith('B') }),
        bouton('ATW/VAR', () => regler((I) => { I.wb = 'ATW'; }), { on: img && img.wb === 'ATW' }),
        bouton('ABB', () => regler(() => { U.msg = 'ABB : balance des noirs.'; })),
        bouton('BARS', () => regler((I) => { I.bars = !I.bars; }), { on: img && img.bars, k: 'rp:bars' }),
        bouton('SCENE', () => dire('SCENE : non simulé sur ce banc.')), bouton('ON/OFF', () => dire('ON/OFF : non simulé sur ce banc.'))));
    // au centre : l'écran, les molettes F1 à F4, les touches de menu
    const fs = el('div', { class: 'tz-rp-fs', role: 'group', 'aria-label': 'Molettes F1 à F4' },
      molette('F1', `P/T ${U.pt}`, () => { U.pt = Math.max(1, U.pt - 1); H.local(); }, () => { U.pt = Math.min(7, U.pt + 1); H.local(); }, 'rp:f1'),
      molette('F2', 'IRIS', () => regler((I) => { I.auto = false; I.iris = Math.max(0, I.iris - 1); }), () => regler((I) => { I.auto = false; I.iris = Math.min(100, I.iris + 1); }), 'rp:f2'),
      molette('F3', 'M.PED', () => regler((I) => { I.mped -= 1; }), () => regler((I) => { I.mped += 1; }), 'rp:f3'),
      molette('F4', 'Z/F', () => { U.zf = U.zf === 'zoom' ? 'focus' : 'zoom'; H.local(); }, () => { U.zf = U.zf === 'zoom' ? 'focus' : 'zoom'; H.local(); }, 'rp:f4'));
    const menus = el('div', { class: 'tz-rp-menus', role: 'group', 'aria-label': 'Touches de menu' }, ...MENUS.map(([k, t]) => bouton(t, menu(k), { k: 'rp:b:' + k, on: U.ecran === k || (k === 'system' && SYSTEME.some(([x]) => x === U.ecran)), dis: !on })));
    const centre = el('div', { class: 'tz-rp-centre' }, on ? ecran() : el('div', { class: 'tz-rp-off' }, 'Écran éteint : le pupitre n\'est pas alimenté.'), fs);
    // en bas : CAMERA/GROUP SELECTION et USER
    const touches = el('div', { class: 'tz-rp-keys', role: 'group', 'aria-label': 'CAMERA/GROUP SELECTION' }, ...Array.from({ length: 10 }, (_, i) => {
      const n = i + 1, l = L.find((x) => x.n === n), rouge = T.n === n;
      return el('button', { type: 'button', class: 'tz-rp-key' + (rouge ? ' air' : l && l.ok ? ' ok' : l ? ' bad' : ''), 'aria-pressed': String(n === st().rp.sel), 'aria-label': `Caméra ${n}${rouge ? ', à l\'antenne' : l ? (l.ok ? ', connectée' : ', pas de liaison') : ''}`, disabled: !on ? true : null, onclick: () => { U.ecran = U.ecran === 'pmem' ? 'pmem' : 'etat'; U.msg = ''; ctx.changer({ 'rp.sel': n }); } }, el('i', { class: 'tz-rp-led', 'aria-hidden': 'true' }), String(n));
    }));
    const users = el('div', { class: 'tz-rp-users', role: 'group', 'aria-label': 'USER 1 à 6' }, ...[1, 2, 3, 4, 5, 6].map((k) => bouton(`USER ${k}`, () => dire(`USER ${k} : touche à affecter (non simulé).`), { dis: !on })));
    // à droite : ENABLE, le joystick, le levier à bascule
    const joy = el('div', { class: 'tz-joy', role: 'group', 'aria-label': 'Joystick et levier' },
      bouton('ENABLE', () => { U.enable = !U.enable; U.msg = U.enable ? '' : 'Joystick verrouillé.'; H.local(); }, { on: U.enable, k: 'rp:enable', dis: !on }),
      el('div', { class: 'tz-joy-pad' }, bouton('▲', () => bouger(0, 10, 0), { aria: 'Tilt vers le haut', dis: !on }), el('div', { class: 'tz-joy-mid' }, bouton('◀', () => bouger(-15, 0, 0), { aria: 'Pan vers la gauche', dis: !on }), el('span', { class: 'tz-joy-tete', 'aria-hidden': 'true' }), bouton('▶', () => bouger(15, 0, 0), { aria: 'Pan vers la droite', dis: !on })), bouton('▼', () => bouger(0, -10, 0), { aria: 'Tilt vers le bas', dis: !on })),
      el('div', { class: 'tz-joy-mid', role: 'group', 'aria-label': `Levier à bascule (${U.zf === 'zoom' ? 'zoom' : 'point'})` }, bouton('W', () => bouger(0, 0, -10), { aria: U.zf === 'zoom' ? 'Zoom large' : 'Point plus près', dis: !on }), bouton('T', () => bouger(0, 0, 10), { aria: U.zf === 'zoom' ? 'Zoom serré' : 'Point plus loin', dis: !on })),
      bouton('ZOOM/FOCUS', () => { U.zf = U.zf === 'zoom' ? 'focus' : 'zoom'; H.local(); }, { k: 'rp:zf', dis: !on }));
    // le mélangeur, pour essayer le tally
    const pgm = el('div', { class: 'tz-pgm' }, el('span', { class: 'lb-lab' }, 'Mélangeur, au programme :'),
      el('div', { class: 'seg', role: 'group', 'aria-label': 'Entrée au programme' }, ...[0, 1, 2, 3, 4].map((k) => el('button', { type: 'button', 'aria-pressed': String((st().pgm || 0) === k), 'data-k': 'pgm:' + k, onclick: () => ctx.changer({ pgm: k }) }, k ? `Entrée ${k}${I.entrees[k] ? ' · ' + appareil(st(), I.entrees[k].cam).nom : ''}` : 'Noir'))),
      el('small', { class: 'tz-note' }, st().pgm ? (T.n ? `Tally : la touche ${T.n} du pupitre s'allume en rouge.` : `Tally : ${T.pb}.`) : 'Choisissez une entrée : la touche de sa caméra s\'allume en rouge si le tally est câblé.'));
    root.replaceChildren(el('div', { class: 'tz-rp2' },
      el('div', { class: 'tz-rp-label' }, el('b', {}, 'AW-RP150'), el('small', {}, 'pupitre de commande · écran tactile 7 pouces')),
      el('div', { class: 'tz-rp-haut' }, reglages, centre, menus),
      el('div', { class: 'tz-rp-bas' }, el('div', { class: 'tz-rp-sel' }, el('span', { class: 'tz-rp-cap' }, 'CAMERA / GROUP SELECTION'), touches, users), joy)), pgm);
  }
  return { root, rendre, reset: () => { U.ip = null; U.cams = {}; U.msg = ''; U.cmd = ''; U.ecran = 'etat'; } };
}
