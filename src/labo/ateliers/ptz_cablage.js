// @ts-check
import { el } from '../../util.js';
import { MODELES, PRISES, MELANGEUR, CABLES, SWITCH, alimentation, cablesPoses, cableSur, brancher, debrancher, nomBout, ficheNom, imageMelangeur, prisesDe } from '../calc/ptz.js';

// ----------------------------------------------------------------------------------
// La vue « Le câblage » de l'atelier Caméras PTZ (v19.30) : le banc vu de derrière. En haut, la face avant du switch
// (8 ports RJ45 et leurs voyants : lien en vert, PoE en ambre) ; au milieu, chaque appareil dessiné avec sa face arrière
// et ses prises sérigraphiées (labo/calc/ptz.js : PRISES, d'après les modes d'emploi Panasonic) ; en bas, le mélangeur
// (entrées SDI, sortie programme, référence, GPIO). On prend un câble (RJ45, coaxial BNC, bloc 12 V, GPIO), on touche
// une prise puis l'autre : le modèle dit si la fiche entre et si la liaison a un sens (brancher), et le câble se dessine.
// Toucher une prise déjà câblée la débranche. Tout se fait aussi au clavier (chaque prise est un bouton).
// Couleurs : classes de styles/labo.css, lues dans les jetons du thème.
// ----------------------------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
/** un élément SVG */
function s(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, String(v));
  for (const c of kids) if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}
const W = 1000;
/** la place de chaque appareil dans la scène : x, y, largeur ; le dessin de face à gauche du panneau arrière */
const PLACE = {
  cam1: { x: 20, y: 190, w: 300 }, cam2: { x: 350, y: 190, w: 300 }, cam3: { x: 680, y: 190, w: 300 },
  rp: { x: 20, y: 470, w: 470 }, pc: { x: 510, y: 470, w: 140 }, mix: { x: 670, y: 470, w: 310 },
};
const LARGEUR_PRISE = { rj45: 26, bnc: 22, hdmi: 30, dc: 20, dsub: 40, usb: 18, mini: 14, xlr: 24 };

/** les positions des prises d'un panneau : réparties sur une ou deux rangées, dans l'ordre du mode d'emploi */
function disposer(prises, x, y, w, h) {
  // assez de place pour la sérigraphie : au plus une prise tous les 46 unités sur une rangée
  const rangees = Math.max(1, Math.ceil(prises.length * 46 / (w - 20))), parRangee = Math.ceil(prises.length / rangees);
  return prises.map((P, i) => {
    const r = Math.floor(i / parRangee), k = i % parRangee, n = Math.min(parRangee, prises.length - r * parRangee);
    const pas = (w - 20) / n;
    return { P, cx: x + 10 + pas * (k + 0.5), cy: y + (rangees === 1 ? h / 2 - 4 : 18 + r * ((h - 16) / rangees)) };
  });
}

export function vueCablage(/** @type {import('../kit.js').Ctx} */ ctx, /** @type {{ local: () => void, lock: (k: string) => boolean }} */ H) {
  const st = () => ctx.st;
  const U = { cable: /** @type {keyof CABLES} */ ('rj45'), premier: '', msg: '', ok: true };
  const root = el('div', { class: 'lb-vue' });

  /** le dessin d'une prise : sa forme selon la fiche, sa sérigraphie, et le bouton qui la choisit */
  function prise(dev, P, cx, cy, etat) {
    const e = `${dev}:${P.id}`, w = LARGEUR_PRISE[P.fiche] || 20;
    const g = s('g', { class: `tz-pr tz-f-${P.fiche}${etat.pose ? ' pose' : ''}${U.premier === e ? ' sel' : ''}${etat.led ? ' ' + etat.led : ''}`, role: 'button', tabindex: '0', 'data-pr': e, 'aria-label': `${nomBout(st(), e)}, prise ${ficheNom(P.fiche)}${etat.pose ? ', câblée' : ''}`, 'aria-pressed': String(U.premier === e) });
    if (P.fiche === 'bnc' || P.fiche === 'dc' || P.fiche === 'mini' || P.fiche === 'xlr') g.append(s('circle', { cx, cy, r: w / 2, class: 'tz-pr-corps' }), s('circle', { cx, cy, r: w / 5, class: 'tz-pr-trou' }));
    else if (P.fiche === 'hdmi') g.append(s('path', { d: `M${cx - w / 2} ${cy - 6} h${w} v6 l-4 6 h${-(w - 8)} l-4 -6 Z`, class: 'tz-pr-corps' }));
    else if (P.fiche === 'dsub') g.append(s('path', { d: `M${cx - w / 2} ${cy - 8} h${w} l-4 16 h${-(w - 8)} Z`, class: 'tz-pr-corps' }));
    else g.append(s('rect', { x: cx - w / 2, y: cy - 10, width: w, height: 20, rx: 2, class: 'tz-pr-corps' }), s('rect', { x: cx - 5, y: cy + 6, width: 10, height: 4, class: 'tz-pr-trou' }));
    if (etat.led !== undefined && P.fiche === 'rj45') g.append(s('rect', { x: cx - w / 2 + 2, y: cy - 8, width: 5, height: 3, class: 'tz-led-l' }), s('rect', { x: cx + w / 2 - 7, y: cy - 8, width: 5, height: 3, class: 'tz-led-p' }));
    const mots = P.serigraphie.length > 9 && P.serigraphie.includes(' ') ? [P.serigraphie.slice(0, P.serigraphie.lastIndexOf(' ')), P.serigraphie.slice(P.serigraphie.lastIndexOf(' ') + 1)] : [P.serigraphie];
    mots.forEach((m, i) => g.append(s('text', { x: cx, y: cy + (P.fiche === 'rj45' ? 24 : 22) + i * 11, class: 'tz-pr-t', 'text-anchor': 'middle' }, m)));
    const choisir = () => cliquer(e);
    g.addEventListener('click', choisir);
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choisir(); } });
    return g;
  }
  /** toucher une prise : la première du câble, la seconde (on branche), ou une prise câblée (on débranche) */
  function cliquer(e) {
    if (H.lock('appareils') || H.lock('video') || H.lock('cablage')) { U.msg = 'Le câblage est imposé par le défi.'; U.ok = false; H.local(); return; }
    if (!U.premier) {
      if (cableSur(st(), e)) { const nom = nomBout(st(), e); U.msg = `Débranché : ${nom}.`; U.ok = true; ctx.changer(debrancher(st(), e)); return; }
      if (U.cable === 'dc') { const r = brancher(st(), 'dc', e); U.ok = r.ok; U.msg = r.ok ? r.note || 'Branché.' : r.pb; if (r.ok) ctx.changer(r.patch); else H.local(); return; }
      const [dev, id] = e.split(':'), P = prisesDe(st(), dev).find((x) => x.id === id);
      if (P && P.fiche !== CABLES[U.cable].fiche) { U.msg = `La fiche ${ficheNom(CABLES[U.cable].fiche)} n'entre pas dans la prise ${P.serigraphie} (${ficheNom(P.fiche)}).`; U.ok = false; H.local(); return; }
      U.premier = e; U.msg = `${nomBout(st(), e)} : touchez maintenant l'autre bout du câble.`; U.ok = true; H.local(); return;
    }
    if (U.premier === e) { U.premier = ''; U.msg = ''; H.local(); return; }
    const r = brancher(st(), U.cable, U.premier, e);
    U.ok = r.ok; U.msg = r.ok ? `Branché : ${nomBout(st(), U.premier)} ↔ ${nomBout(st(), e)}. ${r.note || ''}` : r.pb;
    U.premier = '';
    if (r.ok) ctx.changer(r.patch); else H.local();
  }

  /** une caméra PTZ vue de face, à côté de sa face arrière */
  function silhouette(x, y, modele) {
    const g = s('g', { class: 'tz-sil ' + modele, 'aria-hidden': 'true' });
    if (modele === 'ue20') {
      g.append(s('rect', { x: x + 6, y: y + 66, width: 44, height: 14, rx: 4, class: 'tz-sil-socle' }), s('rect', { x: x + 12, y: y + 22, width: 32, height: 44, rx: 10, class: 'tz-sil-corps' }), s('circle', { cx: x + 28, cy: y + 40, r: 10, class: 'tz-sil-obj' }), s('circle', { cx: x + 28, cy: y + 40, r: 4, class: 'tz-sil-verre' }));
    } else {
      g.append(s('rect', { x: x + 2, y: y + 70, width: 52, height: 14, rx: 4, class: 'tz-sil-socle' }), s('rect', { x: x + 8, y: y + 58, width: 40, height: 12, rx: 3, class: 'tz-sil-socle' }),
        s('path', { d: `M${x + 6} ${y + 58} V${y + 16} a8 8 0 0 1 8 -8 h28 a8 8 0 0 1 8 8 V${y + 58} Z`, class: 'tz-sil-corps' }), s('circle', { cx: x + 28, cy: y + 34, r: 14, class: 'tz-sil-obj' }), s('circle', { cx: x + 28, cy: y + 34, r: 6, class: 'tz-sil-verre' }));
    }
    return g;
  }

  function rendre() {
    const S = st(), A = alimentation(S), poses = cablesPoses(S), I = imageMelangeur(S);
    const pos = /** @type {Record<string, { cx: number, cy: number }>} */ ({});
    const scene = s('svg', { viewBox: `0 0 ${W} 680`, class: 'tz-scene', role: 'group', 'aria-label': 'Le banc vu de derrière : le switch, les appareils et leurs prises, le mélangeur' });
    // le switch, face avant
    scene.append(s('rect', { x: 150, y: 20, width: 700, height: 100, rx: 10, class: 'tz-boitier' }), s('text', { x: 170, y: 44, class: 'tz-t' }, `Switch PoE+ administrable · ${SWITCH.ports} ports · face avant`));
    const portsSw = prisesDe(S, 'sw');
    portsSw.forEach((P, i) => {
      const cx = 230 + i * 70, cy = 78, n = i + 1, occ = S.appareils.find((a) => a.port === n), r = occ ? A.par[occ.id] : null;
      pos[`sw:${P.id}`] = { cx, cy };
      scene.append(prise('sw', P, cx, cy, { pose: !!occ, led: r ? (r.lien ? (r.reserve ? 'lien poe' : 'lien') : 'mort') : '' }));
    });
    // les appareils
    const panneau = (dev, titre, sous, prises, x, y, w, front) => {
      const g = s('g', { class: 'tz-app' });
      const xp = front ? x + 64 : x, wp = front ? w - 64 : w, h = 150;
      if (front) g.append(silhouette(x, y + 18, front));
      g.append(s('rect', { x: xp, y: y + 20, width: wp, height: h, rx: 8, class: 'tz-boitier' }), s('text', { x: xp + 8, y: y + 12, class: 'tz-t' }, titre), s('text', { x: xp + wp - 6, y: y + 12, class: 'tz-s', 'text-anchor': 'end' }, sous));
      for (const q of disposer(prises, xp, y + 30, wp, h - 10)) { pos[`${dev}:${q.P.id}`] = q; g.append(prise(dev, q.P, q.cx, q.cy, { pose: !!cableSur(S, `${dev}:${q.P.id}`) })); }
      return g;
    };
    for (const c of S.appareils) {
      const L = PLACE[c.id]; if (!L) continue;
      const M = MODELES[c.modele], r = A.par[c.id];
      const etat = !r.alimente ? 'éteint' : !r.lien ? 'allumé, sans réseau' : 'en marche';
      scene.append(panneau(c.id, M.nom === c.nom ? c.nom : `${c.nom} · ${M.nom}`, M.type === 'pc' ? '' : etat, PRISES[c.modele] || [], L.x, L.y, L.w, M.type === 'camera' ? c.modele : null));
    }
    const mx = PLACE.mix;
    scene.append(panneau('mix', 'Mélangeur · face arrière', `${Object.values(I.entrees).filter((x) => x.ok).length} image(s) reçue(s)`, MELANGEUR, mx.x, mx.y, mx.w, null));
    // les câbles : une courbe d'une prise à l'autre ; le bloc 12 V, un cordon qui descend
    const nappe = s('g', { class: 'tz-cables', 'aria-hidden': 'true' });
    for (const c of poses) {
      const a = pos[c.a], b = c.b ? pos[c.b] : null; if (!a) continue;
      if (!b) { nappe.append(s('path', { d: `M${a.cx} ${a.cy} C${a.cx} ${a.cy + 50}, ${a.cx + 20} ${a.cy + 60}, ${a.cx + 30} ${a.cy + 80}`, class: `tz-cable ${c.type}` }), s('rect', { x: a.cx + 22, y: a.cy + 78, width: 22, height: 14, rx: 3, class: 'tz-bloc' })); continue; }
      const dy = Math.max(40, Math.abs(b.cy - a.cy) / 2);
      nappe.append(s('path', { d: `M${a.cx} ${a.cy} C${a.cx} ${a.cy + (a.cy < b.cy ? dy : -dy)}, ${b.cx} ${b.cy + (a.cy < b.cy ? -dy : dy)}, ${b.cx} ${b.cy}`, class: `tz-cable ${c.type}` }));
    }
    scene.append(nappe);
    // les câbles en main, la consigne, la liste des câbles posés
    const outils = el('div', { class: 'seg lb-seg tz-cables-choix', role: 'group', 'aria-label': 'Le câble en main' },
      ...Object.entries(CABLES).map(([k, C]) => el('button', { type: 'button', 'data-k': 'cable:' + k, 'aria-pressed': String(U.cable === k), onclick: () => { U.cable = /** @type {any} */ (k); U.premier = ''; U.msg = k === 'dc' ? 'Touchez l\'entrée d\'alimentation d\'un appareil.' : 'Touchez une prise, puis l\'autre bout.'; U.ok = true; H.local(); } }, C.nom)));
    const liste = el('ul', { class: 'tz-liste' }, ...poses.map((c) => el('li', { class: 'tz-l-' + c.type }, `${CABLES[c.type].nom.split(' (')[0]} : ${nomBout(S, c.a)}${c.b ? ' ↔ ' + nomBout(S, c.b) : ''}`)));
    root.replaceChildren(
      el('div', { class: 'tz-cab-tete' }, el('span', { class: 'lb-lab' }, 'Câble en main'), outils),
      U.msg ? el('p', { class: 'tz-msg ' + (U.ok ? 'ok' : 'bad'), role: 'status' }, U.msg) : el('p', { class: 'tz-note' }, 'Prenez un câble, touchez une prise puis l\'autre bout. Touchez une prise câblée pour la débrancher.'),
      el('div', { class: 'tz-scroll' }, scene),
      el('h4', { class: 'lb-sub' }, `Les câbles posés (${poses.length})`), poses.length ? liste : el('p', { class: 'tz-note' }, 'Aucun câble : tout est encore dans les cartons.'));
  }
  return { root, rendre, reset: () => { U.premier = ''; U.msg = ''; } };
}
