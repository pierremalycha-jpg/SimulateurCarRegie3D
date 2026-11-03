// @ts-check
import { el } from '../../util.js';
import { commandes, afficheur, jetons, toile, fr, teinte, arrondi } from '../kit.js';
import { MODELES, CANAUX, empreinte, dernier, dip, deDip, pct8, trame, portAddress, sacnMulticast, debitArtnet, LIGNE } from '../calc/dmx.js';

// ----------------------------------------------------------------------------------
// L'atelier « DMX et Art-Net », en quatre vues :
//   - le patch : les appareils (mode, adresse), la carte de l'univers (512 cases colorées par
//     appareil, les conflits en rouge), les commutateurs DIP de l'appareil choisi ;
//   - les valeurs : les canaux de l'appareil choisi (fonction, valeur 0 à 255, pourcentage), son rendu ;
//   - la ligne : console, splitter, projecteurs en chaîne, terminaison ; le diagnostic et la trame ;
//   - le réseau : la console et le nœud (IP, masque, Art-Net ou sACN, univers), ce qui passe.
// Tout vient de labo/calc/dmx.js.
// ----------------------------------------------------------------------------------
const VUES = [['patch', 'Le patch'], ['valeurs', 'Les valeurs'], ['ligne', 'La ligne DMX'], ['reseau', 'Le réseau lumière']];
const COULEURS = ['accent', 'ok', 'amber', 'violet', 'fibre', 'muted'];
const W = 640;

export function creer(/** @type {import('../kit.js').Ctx} */ ctx) {
  const T = jetons();
  const C = commandes(ctx);
  const st = () => ctx.st;
  const sel = () => st().appareils.find((x) => x.id === st().sel) || st().appareils[0];
  const couleurDe = (id) => T[COULEURS[Math.max(0, st().appareils.findIndex((x) => x.id === id)) % COULEURS.length]];

  // ---------------- le patch ----------------
  const carte = toile(W, 230, 'La carte de l\'univers : 512 canaux, colorés par appareil ; un conflit en rouge', 'lb-univers');
  const lignes = el('div', { class: 'lb-patch', role: 'table', 'aria-label': 'Les appareils patchés' });
  const dips = el('div', { class: 'lb-dips', role: 'group', 'aria-label': 'Commutateurs DIP de l\'appareil choisi' });
  const dipOut = el('p', { class: 'lb-note', 'aria-live': 'polite' });
  const rPlan = afficheur('L\'univers');
  function dessinerPatch(m) {
    const list = st().appareils, lock = ctx.verrous.has('appareils');
    lignes.replaceChildren(el('div', { class: 'lb-prow lb-phead', role: 'row' }, ...['Appareil', 'Mode', 'Adresse', 'Canaux', 'Fin'].map((t) => el('span', { role: 'columnheader' }, t))),
      ...list.map((a) => {
        const fp = empreinte(a.modele, a.mode), bad = m.plan.conflits.includes(a.id) || m.plan.depasse.includes(a.id);
        const mode = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': `Mode de ${a.nom}`, 'data-k': `appareils.${a.id}.mode`, disabled: lock ? '' : null, onchange: (e) => ctx.changer({ [`appareils.${a.id}.mode`]: e.target.value }) }, ...Object.keys(MODELES[a.modele].modes).map((k) => el('option', { value: k, selected: k === a.mode ? '' : null }, k))));
        const adr = /** @type {HTMLInputElement} */ (el('input', { type: 'number', min: 1, max: CANAUX, value: a.adresse || '', placeholder: '—', 'aria-label': `Adresse de ${a.nom}`, 'data-k': `appareils.${a.id}.adresse`, disabled: lock ? '' : null }));
        const valider = () => { const v = Math.round(Number(adr.value)); ctx.changer({ [`appareils.${a.id}.adresse`]: Number.isFinite(v) && v > 0 ? v : 0 }); };
        adr.addEventListener('change', valider); adr.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } });
        return el('div', { class: 'lb-prow' + (a.id === st().sel ? ' on' : '') + (bad ? ' bad' : ''), role: 'row' },
          el('button', { type: 'button', class: 'lb-pname', role: 'cell', 'aria-pressed': String(a.id === st().sel), onclick: () => ctx.changer({ sel: a.id }) }, el('i', { class: 'lb-dot', style: `background:${couleurDe(a.id)}` }), a.nom),
          el('span', { role: 'cell' }, mode), el('span', { role: 'cell' }, adr), el('span', { role: 'cell' }, String(fp)), el('span', { role: 'cell' }, a.adresse ? String(dernier(a.adresse, fp)) : '—'));
      }));
    // les commutateurs DIP de l'appareil choisi (1 à 256)
    const a = sel(); const on = dip(a.adresse || 0);
    dips.replaceChildren(...on.map((b, k) => el('button', { type: 'button', class: 'lb-dip' + (b ? ' up' : ''), 'aria-pressed': String(b), 'aria-label': `Commutateur ${k + 1} : vaut ${1 << k}`, disabled: lock ? '' : null, onclick: () => { const n = dip(a.adresse || 0); n[k] = !n[k]; ctx.changer({ [`appareils.${a.id}.adresse`]: deDip(n) }); } }, el('i', {}), el('small', {}, String(1 << k)))));
    dipOut.textContent = `${a.nom} : adresse ${a.adresse || 0} = ${[256, 128, 64, 32, 16, 8, 4, 2, 1].filter((b) => (a.adresse || 0) & b).join(' + ') || '0'}`;
    // la carte de l'univers : 32 colonnes × 16 lignes
    const g = carte.g, cw = (W - 20) / 32, ch = 13;
    g.clearRect(0, 0, W, 230); g.fillStyle = T.bg; g.fillRect(0, 0, W, 230);
    for (let c = 1; c <= CANAUX; c++) {
      const i = c - 1, x = 10 + (i % 32) * cw, y = 8 + Math.floor(i / 32) * ch, o = m.plan.occ[c];
      g.fillStyle = o.length > 1 ? T.tally : o.length ? couleurDe(o[0]) : teinte(T.fg, 0.06);
      g.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    }
    g.fillStyle = T.dim; g.font = `12px ${T.font}`; g.textAlign = 'left'; g.fillText('1', 10, 226); g.textAlign = 'right'; g.fillText('512', W - 10, 226);
    g.textAlign = 'center'; g.fillText('32 canaux par ligne', W / 2, 226);
    const occ = CANAUX - m.plan.libres;
    rPlan.set(`${occ} canaux occupés`, m.plan.conflits.length ? `conflit : ${m.plan.conflits.map((id) => st().appareils.find((x) => x.id === id).nom).join(', ')}` : m.plan.depasse.length ? 'un appareil dépasse le canal 512' : `${m.plan.libres} libres`, m.plan.conflits.length || m.plan.depasse.length ? 'bad' : 'ok');
  }
  const vPatch = el('div', { class: 'lb-vue' }, lignes, el('figure', { class: 'lb-fig' }, carte.c, el('figcaption', {}, 'La carte de l\'univers')), el('div', { class: 'lb-reads' }, rPlan.box),
    el('h4', { class: 'lb-sub' }, 'Les commutateurs DIP de l\'appareil choisi'), dips, dipOut);

  // ---------------- les valeurs ----------------
  const faders = el('div', { class: 'lb-faders' });
  const rendu = toile(200, 200, 'Le projecteur choisi, allumé selon ses valeurs', 'lb-swatch');
  function dessinerValeurs() {
    const a = sel(); const fns = (MODELES[a.modele].modes[a.mode] || []);
    if (!a.adresse) { faders.replaceChildren(el('p', { class: 'lb-note' }, `${a.nom} n'est pas patché : donnez-lui une adresse dans le patch.`)); return; }
    faders.replaceChildren(...fns.map((fn, k) => {
      const c = a.adresse + k, v = st().valeurs[c] || 0; const id = `lb-ch-${c}`;
      const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'range', id, min: 0, max: 255, step: 1, value: v, 'aria-valuetext': `${v}, ${fr(pct8(v), 0)} %` }));
      inp.addEventListener('input', () => { const vals = st().valeurs.slice(); vals[c] = Number(inp.value); ctx.changer({ valeurs: vals }); });
      return el('div', { class: 'lb-fader' }, el('label', { for: id }, el('b', {}, `${c}`), ` ${fn}`), inp, el('output', { for: id }, `${v} · ${fr(pct8(v), 0)} %`));
    }));
    // le rendu : l'intensité et la couleur (rouge, vert, bleu, blanc) quand l'appareil en a
    const val = (nom) => { const k = fns.indexOf(nom); return k >= 0 ? (st().valeurs[a.adresse + k] || 0) / 255 : null; };
    const I = val('Intensité') ?? val('Circuit 1') ?? 1, R = val('Rouge'), V = val('Vert'), B = val('Bleu'), Bl = val('Blanc') || 0;
    const rgb = R == null ? [1, 0.92, 0.8] : [R + Bl, V + Bl, B + Bl].map((x) => Math.min(1, x));
    const g = rendu.g; g.clearRect(0, 0, 200, 200); g.fillStyle = T.bg; g.fillRect(0, 0, 200, 200);
    const grd = g.createRadialGradient(100, 100, 4, 100, 100, 90); const c = rgb.map((x) => Math.round(255 * x * I));
    grd.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); grd.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = grd; g.beginPath(); g.arc(100, 100, 90, 0, Math.PI * 2); g.fill();
    g.strokeStyle = T.line; g.beginPath(); g.arc(100, 100, 40, 0, Math.PI * 2); g.stroke();
  }
  const vValeurs = el('div', { class: 'lb-vue' }, el('div', { class: 'lb-duo' }, faders, el('figure', { class: 'lb-fig lb-fig-s' }, rendu.c, el('figcaption', {}, 'Le faisceau'))),
    el('p', { class: 'lb-note' }, 'Un canal va de 0 à 255. Un paramètre fin (« fin ») complète le précédent sur 16 bits : grossier × 256 + fin.'));

  // ---------------- la ligne ----------------
  const schema = toile(640, 170, 'La ligne DMX : la console, le splitter, les projecteurs en chaîne, la terminaison', 'lb-ligne');
  const diag = el('ul', { class: 'lb-diag', 'aria-live': 'polite' });
  const rTrame = afficheur('La trame');
  const nCanaux = { v: 512 };
  const curN = /** @type {HTMLInputElement} */ (el('input', { type: 'range', id: 'lb-trame-n', min: 24, max: 512, step: 8, value: 512 }));
  curN.addEventListener('input', () => { nCanaux.v = Number(curN.value); rendre(); });
  function dessinerLigne(m) {
    const L = st().ligne, D = m.ligne, g = schema.g;
    g.clearRect(0, 0, 640, 170); g.fillStyle = T.panel; g.fillRect(0, 0, 640, 170);
    // la console
    g.fillStyle = T.fg; arrondi(g, 10, 60, 56, 40, 6); g.fill(); g.fillStyle = T.bg; g.font = `600 12px ${T.font}`; g.textAlign = 'center'; g.fillText('console', 38, 84);
    const branches = Math.max(1, L.splitter || 1), y0 = branches > 1 ? 30 : 80, dy = branches > 1 ? 110 / (branches - 1) : 0;
    let x0 = 66;
    if (L.splitter) { g.strokeStyle = T.muted; g.beginPath(); g.moveTo(66, 80); g.lineTo(96, 80); g.stroke(); g.fillStyle = T.violet; arrondi(g, 96, 62, 44, 36, 6); g.fill(); g.fillStyle = T.bg; g.fillText('split', 118, 84); x0 = 140; }
    for (let b = 0; b < branches; b++) {
      const y = y0 + b * dy, n = Math.min(D.parBranche, Math.ceil(L.recepteurs / branches));
      const ok = n <= LIGNE.recepteurs;
      g.strokeStyle = ok ? T.ok : T.tally; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, branches > 1 ? 80 : y); g.lineTo(x0 + 20, y); g.lineTo(600, y); g.stroke(); g.lineWidth = 1;
      const vis = Math.min(n, 14);
      for (let k = 0; k < vis; k++) { const x = x0 + 30 + k * ((560 - x0) / 14); g.fillStyle = T.dim; arrondi(g, x, y - 7, 14, 14, 3); g.fill(); }
      g.fillStyle = ok ? T.muted : T.tally; g.textAlign = 'right'; g.fillText(`${n} récepteurs`, 600, y - 10);
      // la terminaison
      g.fillStyle = L.terminaison ? T.ok : T.tally; arrondi(g, 604, y - 6, 22, 12, 3); g.fill();
      if (!L.terminaison) { g.strokeStyle = T.tally; g.beginPath(); g.moveTo(606, y - 8); g.lineTo(624, y + 8); g.stroke(); }
    }
    if (L.y && !L.splitter) { g.strokeStyle = T.tally; g.lineWidth = 2; g.beginPath(); g.moveTo(320, 80); g.lineTo(380, 130); g.lineTo(560, 130); g.stroke(); g.lineWidth = 1; g.fillStyle = T.tally; g.textAlign = 'left'; g.fillText('dérivation en Y', 390, 148); }
    g.fillStyle = T.dim; g.textAlign = 'left'; g.fillText(`${L.longueur} m de câble 120 Ω`, 150, 164);
    diag.replaceChildren(...(D.ok ? [el('li', { class: 'ok' }, `Ligne fiable : ${D.branches} branche${D.branches > 1 ? 's' : ''}, ${D.parBranche} récepteurs au plus par branche, terminée.`)] : D.pb.map((p) => el('li', { class: 'bad' }, p.t))));
    const t = trame(nCanaux.v); rTrame.set(`${fr(t.hz, 1)} trames/s`, `${nCanaux.v} canaux : ${fr(t.us / 1000, 2)} ms par trame`);
  }
  const vLigne = el('div', { class: 'lb-vue' }, el('figure', { class: 'lb-fig' }, schema.c, el('figcaption', {}, 'La ligne DMX')), diag,
    el('div', { class: 'lb-ctls lb-inline' },
      C.curseur('ligne.recepteurs', 'Récepteurs', { min: 1, max: 64, step: 1, fmt: (v) => String(v) }),
      C.curseur('ligne.longueur', 'Longueur', { min: 10, max: 600, step: 10, fmt: (v) => `${v} m` }),
      C.caseA('ligne.terminaison', 'Terminaison 120 Ω au bout'),
      C.caseA('ligne.y', 'Dérivation en Y'),
      C.touches('ligne.splitter', 'Splitter', [[0, 'aucun'], [2, '2 sorties'], [4, '4 sorties'], [6, '6 sorties']])),
    el('div', { class: 'lb-reads' }, rTrame.box), el('div', { class: 'lb-ctl lb-range' }, el('label', { for: 'lb-trame-n' }, 'Canaux envoyés par trame'), curN));

  // ---------------- le réseau ----------------
  const rLiaison = afficheur('Le nœud reçoit-il ?');
  const rPA = afficheur('Port-Address du nœud'), rMc = afficheur('Multicast sACN'), rDeb = afficheur('Débit d\'un univers');
  const pbs = el('ul', { class: 'lb-diag', 'aria-live': 'polite' });
  function dessinerReseau(m) {
    const s = st(), Lk = m.liaison;
    rLiaison.set(Lk.ok ? 'Oui' : 'Non', Lk.ok ? `univers ${s.console.univers} de la console sur la sortie du nœud` : `${Lk.pb.length} problème${Lk.pb.length > 1 ? 's' : ''}`, Lk.ok ? 'ok' : 'bad');
    pbs.replaceChildren(...Lk.pb.map((p) => el('li', { class: 'bad' }, p.t)));
    rPA.set(String(portAddress(s.noeud.net, s.noeud.sub, s.noeud.uni)), `Net ${s.noeud.net} × 256 + Sub-Net ${s.noeud.sub} × 16 + Universe ${s.noeud.uni}`);
    rMc.set(sacnMulticast(s.console.univers), `univers ${s.console.univers}, port UDP 5568`);
    const d = debitArtnet(44); rDeb.set(`${fr(d.kbps, 0)} kbit/s`, `${d.octets} octets par trame Art-Net, 44 trames/s`);
  }
  const proto = /** @type {Array<[any, string]>} */ ([['artnet', 'Art-Net'], ['sacn', 'sACN']]);
  const vReseau = el('div', { class: 'lb-vue' },
    el('div', { class: 'lb-duo lb-net' },
      el('fieldset', { class: 'lb-group' }, el('legend', {}, 'La console'), C.champ('console.ip', 'Adresse IP', { placeholder: '2.0.0.1' }), C.champ('console.masque', 'Masque', { placeholder: '255.0.0.0' }), C.touches('console.protocole', 'Protocole', proto), C.champ('console.univers', 'Univers (à partir de 1)', { nombre: true, min: 1, max: 63999, largeur: '7em' })),
      el('fieldset', { class: 'lb-group' }, el('legend', {}, 'Le nœud'), C.champ('noeud.ip', 'Adresse IP', { placeholder: '2.0.0.50' }), C.champ('noeud.masque', 'Masque', { placeholder: '255.0.0.0' }), C.touches('noeud.protocole', 'Protocole', proto),
        C.champ('noeud.net', 'Net (0 à 127)', { nombre: true, min: 0, max: 127, largeur: '5em' }), C.champ('noeud.sub', 'Sub-Net (0 à 15)', { nombre: true, min: 0, max: 15, largeur: '5em' }), C.champ('noeud.uni', 'Universe (0 à 15)', { nombre: true, min: 0, max: 15, largeur: '5em' }),
        C.champ('noeud.sacn', 'Univers sACN écouté', { nombre: true, min: 1, max: 63999, largeur: '7em' }))),
    el('div', { class: 'lb-reads' }, rLiaison.box, rPA.box, rMc.box, rDeb.box), pbs);

  const onglets = el('div', { class: 'seg lb-vues', role: 'tablist', 'aria-label': 'Les vues de l\'atelier' },
    ...VUES.map(([id, t]) => el('button', { type: 'button', role: 'tab', 'data-vue': id, onclick: () => ctx.changer({ vue: id }) }, t)));
  const panneaux = { patch: vPatch, valeurs: vValeurs, ligne: vLigne, reseau: vReseau };

  function rendre() {
    const m = ctx.m(), v = st().vue;
    C.refresh();
    for (const b of onglets.querySelectorAll('button')) { const on = /** @type {HTMLElement} */ (b).dataset.vue === v; b.setAttribute('aria-selected', String(on)); /** @type {HTMLButtonElement} */ (b).disabled = ctx.verrous.has('vue') && !on; }
    for (const [k, p] of Object.entries(panneaux)) p.hidden = k !== v;
    if (v === 'patch') dessinerPatch(m);
    if (v === 'valeurs') dessinerValeurs();
    if (v === 'ligne') dessinerLigne(m);
    if (v === 'reseau') dessinerReseau(m);
  }
  const root = el('div', { class: 'lb-atelier lb-dmx' }, el('div', { class: 'lb-stage lb-wide' }, onglets, vPatch, vValeurs, vLigne, vReseau));
  return { root, rendre };
}
