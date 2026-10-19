// @ts-check
// ----------------------------------------------------------------------------------
// Schémas explicatifs des fiches du poste Réseau IP (fenêtre « ? »). SVG dessinés en code,
// aux couleurs de l'interface : rouge / bleu pour les deux réseaux, ambre pour les messages de
// contrôle, bleu clair pour les flux, vert pour ce qui fonctionne.
// ----------------------------------------------------------------------------------
const FG = '#e7eaed', MUTED = '#9aa3ab', LINE = '#4a5560', RED = '#ff6b5e', BLUE = '#5ea8ff', ACC = '#8ccdf2', AMB = '#f0a61c', GRN = '#2fbf5a', VIO = '#c77dff', BOX = '#1c2126';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="${o.c || FG}" font-size="${o.s || 12}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''}${o.m ? ' font-family="JetBrains Mono, ui-monospace, monospace"' : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 4}" fill="${o.f || BOX}" stroke="${o.s || LINE}" stroke-width="${o.sw || 1}"${o.d ? ' stroke-dasharray="4 3"' : ''}/>`;
const L = (x1, y1, x2, y2, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.c || LINE}" stroke-width="${o.w || 1.5}"${o.d ? ' stroke-dasharray="5 4"' : ''}${o.arrow ? ` marker-end="url(#a-${o.arrow})"` : ''}/>`;
const C = (x, y, r, o = {}) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${o.f || BOX}" stroke="${o.s || LINE}" stroke-width="${o.sw || 1}"/>`;
const node = (x, y, w, h, title, sub, o = {}) => R(x, y, w, h, { s: o.s || LINE, f: o.f }) + T(x + w / 2, y + (sub ? h / 2 - 2 : h / 2 + 4), title, { a: 'middle', w: 600, c: o.c || FG, s: o.ts || 12.5 }) + (sub ? T(x + w / 2, y + h / 2 + 13, sub, { a: 'middle', c: MUTED, s: 11 }) : '');
const MARKERS = [['l', LINE], ['r', RED], ['b', BLUE], ['c', ACC], ['m', AMB], ['g', GRN], ['f', FG]];
const svg = (w, h, body, title) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}" font-family="Barlow, 'Segoe UI', sans-serif"><defs>${MARKERS.map(([k, c]) => `<marker id="a-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('')}</defs>${body}</svg>`;
const pkt = (x, y, n, c = ACC, w = 18) => R(x, y, w, 16, { f: c, s: c, r: 2 }) + (n != null ? T(x + w / 2, y + 12, n, { a: 'middle', c: '#0b0e11', s: 10.5, w: 700 }) : '');

/** @type {Record<string, () => string>} */
export const FIGS = {
  // ---------------- gigue ----------------
  jitter() {
    const ideal = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => 40 + i * 54);
    const dev = [0, 9, -7, 15, -11, 4, 19, -5, 2];
    let b = T(30, 22, 'Arrivées idéales : espacement régulier', { c: MUTED }) + L(30, 52, 510, 52, { arrow: 'l' });
    b += ideal.map((x) => pkt(x - 9, 34, null, ACC)).join('');
    b += T(30, 92, 'Arrivées réelles : files d\'attente plus ou moins pleines', { c: MUTED }) + L(30, 122, 510, 122, { arrow: 'l' });
    b += ideal.map((x, i) => L(x, 52, x + dev[i], 104, { c: '#3a4652', w: 1, d: true }) + pkt(x + dev[i] - 9, 104, null, AMB)).join('');
    const x1 = ideal[2] + dev[2], x2 = ideal[3] + dev[3], x3 = ideal[4] + dev[4];
    b += L(x1, 134, x2, 134, { c: FG, w: 1 }) + L(x2, 134, x3, 134, { c: FG, w: 1 }) + T((x1 + x2) / 2, 148, 'Δt long', { a: 'middle', s: 11 }) + T((x2 + x3) / 2, 148, 'Δt court', { a: 'middle', s: 11 });
    b += T(30, 176, 'Gigue = variation des écarts Δt entre paquets successifs (IAT).', { s: 11.5 }) + T(30, 194, 'Le tampon du récepteur l\'absorbe… jusqu\'à ce qu\'il soit vide ou plein.', { s: 11.5, c: MUTED });
    return svg(540, 204, b, 'Gigue : arrivées régulières et arrivées réelles');
  },
  // ---------------- échange PTP ----------------
  ptp() {
    const M = 120, S = 420;
    let b = T(M, 20, 'Maître', { a: 'middle', w: 700 }) + T(S, 20, 'Esclave', { a: 'middle', w: 700 }) + L(M, 28, M, 236) + L(S, 28, S, 236);
    const msg = (y1, y2, from, label, sub, c) => { const [xa, xb] = from === 'M' ? [M, S] : [S, M]; return L(xa, y1, xb, y2, { c, w: 2, arrow: c === AMB ? 'm' : 'c' }) + T((M + S) / 2, (y1 + y2) / 2 - 6, label, { a: 'middle', w: 600, c }) + (sub ? T((M + S) / 2, (y1 + y2) / 2 + 22, sub, { a: 'middle', s: 11, c: MUTED }) : ''); };
    b += msg(48, 78, 'M', 'Sync', '', ACC) + T(M - 10, 52, 't1', { a: 'end', w: 700, c: ACC }) + T(S + 10, 82, 't2', { w: 700, c: ACC });
    b += msg(96, 126, 'M', 'Follow_Up', '(contient t1)', ACC);
    b += msg(156, 186, 'S', 'Delay_Req', '', AMB) + T(S + 10, 160, 't3', { w: 700, c: AMB }) + T(M - 10, 190, 't4', { a: 'end', w: 700, c: AMB });
    b += msg(200, 230, 'M', 'Delay_Resp', '', AMB) + T((M + S) / 2, 248, '(contient t4)', { a: 'middle', s: 11, c: MUTED });
    b += R(20, 262, 500, 50, { f: '#121518' }) + T(270, 282, 'délai moyen = ((t2 − t1) + (t4 − t3)) / 2', { a: 'middle', m: 1, s: 12.5 }) + T(270, 302, 'décalage (offset) = (t2 − t1) − délai moyen', { a: 'middle', m: 1, s: 12.5 });
    return svg(540, 320, b, 'Échange de messages PTP et calcul du décalage');
  },
  // ---------------- BMCA ----------------
  bmca() {
    const rows = [['priority1', 'choix de l\'administrateur (0 à 255)'], ['clockClass', 'traçabilité (6 = GPS verrouillé)'], ['clockAccuracy', 'précision annoncée'], ['offsetScaledLogVariance', 'stabilité de l\'horloge'], ['priority2', 'départage entre horloges équivalentes'], ['clockIdentity', 'départage final (identifiant unique)']];
    let b = '';
    rows.forEach(([k, d], i) => {
      const y = 12 + i * 40;
      b += R(20, y, 330, 30, { f: i === 0 ? '#1f2a33' : BOX, s: i === 0 ? ACC : LINE }) + T(36, y + 20, `${i + 1}`, { w: 700, c: ACC }) + T(56, y + 20, k, { w: 600, m: 1, s: 12 }) + T(345, y + 20, d, { a: 'end', c: MUTED, s: 11 });
      if (i < rows.length - 1) b += L(185, y + 30, 185, y + 40, { c: MUTED, w: 1, arrow: 'l' }) + T(195, y + 38, 'égalité ?', { c: MUTED, s: 10 });
    });
    b += R(370, 12, 150, 230, { f: '#121518' }) + T(445, 40, 'Le plus petit', { a: 'middle', w: 700, c: GRN }) + T(445, 58, 'gagne à chaque', { a: 'middle', w: 700, c: GRN }) + T(445, 76, 'étape.', { a: 'middle', w: 700, c: GRN });
    b += T(445, 120, 'priority1 passe', { a: 'middle', c: AMB }) + T(445, 136, 'AVANT la qualité :', { a: 'middle', c: AMB }) + T(445, 152, 'un appareil mal réglé', { a: 'middle', c: AMB }) + T(445, 168, 'peut battre le GPS.', { a: 'middle', c: AMB });
    return svg(540, 252, b, 'Ordre de comparaison du BMCA');
  },
  // ---------------- arbre PTP (horloges frontières) ----------------
  ptptree() {
    const tag = (x, y, k) => R(x - 9, y - 8, 18, 16, { f: k === 'S' ? '#3a2a0a' : '#0f2a3a', s: k === 'S' ? AMB : ACC, r: 3 }) + T(x, y + 4, k, { a: 'middle', s: 10.5, w: 700, c: k === 'S' ? AMB : ACC });
    let b = node(200, 10, 140, 44, 'Grand maître', 'GPS · classe 6', { s: GRN });
    b += L(270, 54, 270, 96, { c: ACC, w: 2, arrow: 'c' }) + node(200, 98, 140, 40, 'Spine', 'horloge frontière');
    b += L(240, 138, 130, 188, { c: ACC, w: 2, arrow: 'c' }) + L(300, 138, 410, 188, { c: ACC, w: 2, arrow: 'c' });
    b += node(60, 190, 140, 40, 'Leaf caméras', 'horloge frontière') + node(340, 190, 140, 40, 'Leaf production', 'horloge frontière');
    b += L(130, 230, 130, 262, { c: ACC, w: 2, arrow: 'c' }) + L(410, 230, 410, 262, { c: ACC, w: 2, arrow: 'c' });
    b += node(70, 264, 120, 34, 'CCU', 'esclave seulement') + node(350, 264, 120, 34, 'Mélangeur', 'esclave seulement');
    b += tag(286, 66, 'M') + tag(286, 86, 'S') + tag(212, 152, 'M') + tag(328, 152, 'M') + tag(112, 178, 'S') + tag(428, 178, 'S') + tag(146, 246, 'M') + tag(426, 246, 'M');
    b += T(10, 322, 'S = port esclave (reçoit l\'heure)   M = port maître (la redistribue)', { c: MUTED, s: 11.5 });
    return svg(540, 332, b, 'Distribution de l\'heure PTP par horloges frontières');
  },
  // ---------------- spine-leaf ----------------
  spineleaf() {
    const sp = [150, 370], lv = [40, 160, 280, 400];
    let b = '';
    for (const s of sp) for (const l of lv) b += L(s + 50, 50, l + 50, 120, { c: '#3a4652', w: 1.4 });
    b += L(90, 182, 90, 160, { c: ACC, w: 3 }) + L(90, 120, 200, 50, { c: ACC, w: 3 }) + L(200, 50, 330, 120, { c: ACC, w: 3 }) + L(330, 160, 330, 182, { c: ACC, w: 3 });
    for (const s of sp) b += node(s, 14, 100, 36, `Spine ${sp.indexOf(s) + 1}`, '');
    for (const l of lv) b += node(l, 120, 100, 40, `Leaf ${lv.indexOf(l) + 1}`, 'haut de baie');
    for (const l of lv) b += R(l + 8, 182, 38, 22, { f: '#121518' }) + R(l + 54, 182, 38, 22, { f: '#121518' });
    b += T(270, 228, 'Chaque leaf est reliée à chaque spine : 2 sauts maximum (leaf → spine → leaf)', { a: 'middle', s: 11.5, c: ACC });
    return svg(540, 238, b, 'Architecture spine-leaf');
  },
  // ---------------- ST 2022-7 ----------------
  dup() {
    let b = node(10, 86, 92, 48, 'Émetteur', 'envoie 2 copies');
    b += L(102, 100, 140, 52, { c: RED, w: 2 }) + L(102, 120, 140, 168, { c: BLUE, w: 2 });
    b += T(150, 30, 'Réseau rouge (A)', { c: RED, w: 600 }) + T(150, 206, 'Réseau bleu (B)', { c: BLUE, w: 600 });
    b += L(140, 52, 400, 52, { c: RED, w: 2, arrow: 'r' }) + L(140, 168, 400, 168, { c: BLUE, w: 2, arrow: 'b' });
    [1, 2, 3, 4, 5].forEach((n, i) => {
      const x = 160 + i * 44;
      b += n === 3 ? T(x + 9, 57, '✕', { a: 'middle', c: RED, s: 16, w: 700 }) : pkt(x, 44, n, RED);
      b += n === 4 ? T(x + 9, 173, '✕', { a: 'middle', c: BLUE, s: 16, w: 700 }) : pkt(x, 160, n, BLUE);
    });
    b += node(404, 80, 126, 60, 'Récepteur', 'ST 2022-7');
    b += T(467, 156, 'sortie complète', { a: 'middle', s: 11, c: GRN });
    [1, 2, 3, 4, 5].forEach((n, i) => { b += pkt(410 + i * 23, 162, n, GRN, 18); });
    b += T(270, 228, 'Le paquet 3 perdu en rouge arrive par le bleu, le 4 perdu en bleu arrive par le rouge.', { a: 'middle', s: 11.5 });
    return svg(540, 238, b, 'Protection sans coupure ST 2022-7');
  },
  // ---------------- SSM / IGMP / PIM ----------------
  ssm() {
    let b = node(20, 150, 120, 40, 'Leaf A', 'leaf de la source') + node(210, 30, 120, 40, 'Spine', '') + node(400, 150, 120, 40, 'Leaf B', 'leaf du récepteur');
    b += node(30, 226, 100, 36, 'Source S', '10.1.1.21') + node(410, 226, 100, 36, 'Récepteur', '');
    // abonnements (contrôle), du récepteur vers la source
    b += L(440, 226, 440, 192, { c: AMB, w: 2, d: true, arrow: 'm' }) + T(432, 214, 'IGMPv3 (S, G)', { c: AMB, s: 11, a: 'end' });
    b += L(430, 150, 322, 72, { c: AMB, w: 2, d: true, arrow: 'm' }) + T(400, 104, 'PIM Join (S, G)', { c: AMB, s: 11 });
    b += L(222, 72, 118, 150, { c: AMB, w: 2, d: true, arrow: 'm' }) + T(60, 104, 'PIM Join (S, G)', { c: AMB, s: 11 });
    // flux, de la source vers le récepteur
    b += L(80, 226, 80, 192, { c: ACC, w: 3, arrow: 'c' }) + L(100, 150, 240, 72, { c: ACC, w: 3, arrow: 'c' }) + L(300, 72, 440, 150, { c: ACC, w: 3, arrow: 'c' }) + L(480, 192, 480, 224, { c: ACC, w: 3, arrow: 'c' });
    b += T(270, 290, 'Pointillés ambre : l\'abonnement remonte vers la source. Trait bleu : le flux G descend.', { a: 'middle', s: 11.5 });
    return svg(540, 300, b, 'Abonnement SSM : IGMPv3 puis PIM');
  },
  // ---------------- IGMP snooping ----------------
  snooping() {
    const panel = (x0, title, all) => {
      let b = T(x0 + 120, 18, title, { a: 'middle', w: 700, c: all ? RED : GRN });
      b += L(x0 + 120, 26, x0 + 120, 56, { c: ACC, w: 3, arrow: 'c' }) + T(x0 + 134, 46, 'flux 239.1.1.4', { s: 10.5, c: MUTED });
      b += node(x0 + 30, 58, 180, 36, 'Commutateur', '');
      [0, 1, 2, 3].forEach((i) => {
        const x = x0 + 45 + i * 50; const on = all || i === 1;
        b += L(x, 94, x, 140, { c: on ? (all ? RED : ACC) : '#30383f', w: on ? 3 : 1.5, arrow: on ? (all ? 'r' : 'c') : undefined });
        b += R(x - 20, 142, 40, 26, { f: '#121518', s: i === 1 ? GRN : LINE }) + T(x, 159, i === 1 ? 'abonné' : 'non', { a: 'middle', s: 10, c: i === 1 ? GRN : MUTED });
      });
      return b;
    };
    let b = panel(0, 'Sans snooping : inondation', true) + panel(280, 'Avec snooping : ciblé', false);
    b += T(270, 192, 'Sans snooping, le flux sort sur tous les ports du VLAN : les ports lents débordent.', { a: 'middle', s: 11.5 });
    return svg(540, 202, b, 'IGMP snooping');
  },
  // ---------------- VLAN et SVI ----------------
  vlan() {
    let b = R(20, 20, 500, 150, { f: '#121518' }) + T(30, 38, 'Commutateur de niveau 3 (leaf)', { c: MUTED, s: 11 });
    b += R(40, 100, 200, 56, { f: '#2a1513', s: RED }) + T(140, 118, 'VLAN 101', { a: 'middle', w: 700, c: RED });
    b += R(300, 100, 200, 56, { f: '#21152d', s: VIO }) + T(400, 118, 'VLAN 102', { a: 'middle', w: 700, c: VIO });
    [0, 1, 2].forEach((i) => { b += R(60 + i * 56, 128, 40, 20, { f: BOX, s: RED }) + R(320 + i * 56, 128, 40, 20, { f: BOX, s: VIO }); });
    b += node(150, 44, 240, 40, 'Routage (SVI)', 'Vlan101 = 10.1.1.1 · Vlan102 = 10.1.2.1', { s: ACC });
    b += L(140, 100, 190, 84, { c: ACC, w: 2 }) + L(400, 100, 350, 84, { c: ACC, w: 2 });
    [0, 1, 2].forEach((i) => { b += L(80 + i * 56, 148, 80 + i * 56, 182, { c: RED }) + R(64 + i * 56, 182, 32, 18, { f: BOX }) + L(340 + i * 56, 148, 340 + i * 56, 182, { c: VIO }) + R(324 + i * 56, 182, 32, 18, { f: BOX }); });
    b += T(270, 222, 'Deux VLAN ne se parlent que par le routage : la SVI est la passerelle de chaque VLAN.', { a: 'middle', s: 11.5 });
    return svg(540, 232, b, 'VLAN et interfaces SVI');
  },
  // ---------------- sous-réseau ----------------
  subnet() {
    const bits = (n) => n.toString(2).padStart(8, '0');
    const ip = [10, 1, 1, 21], mask = [255, 255, 255, 0];
    let b = T(20, 24, 'Adresse 10.1.1.21/24', { w: 700 });
    const row = (vals, y, label) => { let s = T(20, y + 16, label, { c: MUTED, s: 11 }); vals.forEach((v, i) => { const x = 110 + i * 105; s += R(x, y, 98, 24, { f: i < 3 ? '#0f2a3a' : '#3a2a0a', s: i < 3 ? ACC : AMB }) + T(x + 49, y + 16, bits(v), { a: 'middle', m: 1, s: 12, c: i < 3 ? ACC : AMB }); s += T(x + 49, y - 6, String(v), { a: 'middle', s: 11 }); }); return s; };
    b += row(ip, 50, 'adresse') + row(mask, 110, 'masque');
    b += L(110, 150, 418, 150, { c: ACC, w: 2 }) + T(264, 168, 'réseau : 24 bits', { a: 'middle', c: ACC, s: 11.5 }) + L(425, 150, 523, 150, { c: AMB, w: 2 }) + T(474, 168, 'appareil : 8 bits', { a: 'middle', c: AMB, s: 11.5 });
    b += T(20, 200, '10.1.1.0/24 = de 10.1.1.0 à 10.1.1.255 · passerelle 10.1.1.1 · appareils à partir de .20', { s: 11.5 });
    return svg(540, 210, b, 'Adresse IP et masque de sous-réseau');
  },
  // ---------------- encapsulation ----------------
  packet() {
    /** @type {[string, string, number, string][]} */
    const segs = [['Ethernet', '14', 62, '#3a4652'], ['IP', '20', 50, '#1f4f8a'], ['UDP', '8', 44, '#2c6e49'], ['RTP', '12', 50, '#6b4a0e'], ['2110-20', '8', 58, '#5a2d6e'], ['Charge utile (pixels)', '≈ 1 200', 220, '#22313d'], ['FCS', '4', 36, '#3a4652']];
    let x = 10; let b = '';
    /** @type {Record<string, number[]>} */
    const pos = {};
    for (const [n, o, w, c] of segs) { b += R(x, 40, w, 40, { f: c, s: '#0b0e11', r: 2 }) + T(x + w / 2, 58, n, { a: 'middle', s: 11.5, w: 600 }) + T(x + w / 2, 73, o + ' oct.', { a: 'middle', s: 10, c: MUTED }); pos[n] = [x, x + w]; x += w; }
    const br = (a, z, y, txt, c, up = false) => L(a, y, z, y, { c, w: 1.5 }) + L(a, y - 5, a, y + 5, { c, w: 1.5 }) + L(z, y - 5, z, y + 5, { c, w: 1.5 }) + T((a + z) / 2, up ? y - 8 : y + 16, txt, { a: 'middle', s: 11, c });
    b += br(pos.UDP[0], pos['Charge utile (pixels)'][1], 96, 'datagramme UDP ≤ 1 460 octets (ST 2110-10, en-têtes UDP et RTP compris)', ACC);
    b += br(pos.IP[0], pos['Charge utile (pixels)'][1], 132, 'paquet IP ≤ MTU (1 500 octets en standard)', AMB);
    b += br(pos.Ethernet[0], pos.FCS[1], 26, 'trame Ethernet', MUTED, true);
    return svg(540, 160, b, 'Encapsulation d\'un paquet vidéo ST 2110-20');
  },
  // ---------------- en-tête RTP ----------------
  rtp() {
    const W = 15.6, X0 = 20;
    let b = '';
    for (const k of [0, 8, 16, 24, 31]) b += T(X0 + k * W + W / 2, 18, String(k), { a: 'middle', s: 10, c: MUTED });
    const field = (row, from, bits, name, c = BOX) => R(X0 + from * W, 26 + row * 34, bits * W, 30, { f: c, s: '#0b0e11', r: 2 }) + T(X0 + (from + bits / 2) * W, 45 + row * 34, name, { a: 'middle', s: bits < 3 ? 10 : 11.5, w: 600 });
    b += field(0, 0, 2, 'V') + field(0, 2, 1, 'P') + field(0, 3, 1, 'X') + field(0, 4, 4, 'CC') + field(0, 8, 1, 'M', '#6b4a0e') + field(0, 9, 7, 'PT', '#1f4f8a') + field(0, 16, 16, 'numéro de séquence', '#2c6e49');
    b += field(1, 0, 32, 'horodatage (90 kHz en vidéo, 48 kHz en audio, dérivé de PTP)', '#5a2d6e');
    b += field(2, 0, 32, 'SSRC : identifiant de la source du flux');
    b += T(20, 148, 'M = dernier paquet de l\'image · PT = format (voir SDP) · séquence : pertes et fusion 2022-7', { s: 11.5 });
    return svg(540, 158, b, 'En-tête RTP de 12 octets');
  },
  // ---------------- ST 2110-21 ----------------
  shaping() {
    const X0 = 120, X1 = 520, act = 0.86;
    let b = T(X0, 18, 'durée d\'une image', { c: MUTED, s: 11 }) + L(X0, 26, X1, 26, { c: MUTED, w: 1 });
    b += R(X0 + (X1 - X0) * act, 32, (X1 - X0) * (1 - act), 140, { f: '#16191c', s: '#2a3036', d: true }) + T(X0 + (X1 - X0) * (act + 0.07), 186, 'suppr.', { a: 'middle', s: 10, c: MUTED });
    const row = (y, label, xs, c) => T(10, y + 12, label, { w: 600, s: 12 }) + xs.map((x) => R(x, y, 6, 16, { f: c, s: c, r: 1 })).join('');
    const n = 24;
    b += row(40, 'N (étroit)', [...Array(n)].map((_, i) => X0 + 4 + i * ((X1 - X0) * act - 10) / (n - 1)), ACC);
    b += row(88, 'NL (linéaire)', [...Array(n)].map((_, i) => X0 + 4 + i * ((X1 - X0) - 12) / (n - 1)), GRN);
    const bursts = []; for (let k = 0; k < 4; k++) for (let j = 0; j < 6; j++) bursts.push(X0 + 6 + k * 84 + j * 8);
    b += row(136, 'W (large)', bursts, AMB);
    b += T(10, 206, 'N : réguliers pendant l\'image active, rien pendant la suppression verticale.', { s: 11.5 }) + T(10, 224, 'NL : réguliers sur toute l\'image. W : rafales tolérées (CMAX et VRX_FULL plus grands).', { s: 11.5 });
    return svg(540, 234, b, 'Types d\'émetteurs ST 2110-21');
  },
  // ---------------- CINST / VRX ----------------
  cmax() {
    let b = node(10, 70, 90, 44, 'Émetteur', '');
    const bucket = (x, title, lvl, lim, label, c) => {
      let s = T(x + 50, 30, title, { a: 'middle', w: 600, s: 11.5 }) + `<path d="M${x},40 L${x},140 L${x + 100},140 L${x + 100},40" fill="none" stroke="${LINE}" stroke-width="2"/>`;
      s += R(x + 2, 140 - lvl, 96, lvl - 2, { f: c, s: c, r: 0 }) + L(x - 6, 140 - lim, x + 106, 140 - lim, { c: RED, w: 1.5, d: true }) + T(x + 108, 144 - lim, label, { c: RED, s: 11 });
      return s;
    };
    b += L(100, 92, 150, 92, { c: ACC, w: 2, arrow: 'c' }) + bucket(152, 'Réseau (rafales)', 40, 70, 'CMAX', ACC);
    b += L(258, 92, 318, 92, { c: ACC, w: 2, arrow: 'c' }) + bucket(320, 'Récepteur virtuel', 54, 84, 'VRX_FULL', GRN);
    b += T(178, 160, 'CINST mesuré', { s: 11, c: ACC }) + T(340, 160, 'VRX mesuré', { s: 11, c: GRN });
    b += T(10, 190, 'Conforme si les deux niveaux restent sous leur limite (pointillés rouges), à chaque instant.', { s: 11.5 });
    return svg(540, 200, b, 'Modèles CINST / CMAX et VRX / VRX_FULL');
  },
  // ---------------- essences ----------------
  essences() {
    let b = T(130, 20, 'SDI : un câble, tout ensemble', { a: 'middle', w: 700 }) + T(400, 20, 'ST 2110 : un flux par essence', { a: 'middle', w: 700 });
    b += R(30, 60, 200, 60, { f: '#121518' }) + R(36, 66, 188, 22, { f: '#1f4f8a', s: '#1f4f8a' }) + T(130, 81, 'vidéo', { a: 'middle', s: 11 }) + R(36, 90, 120, 12, { f: '#2c6e49', s: '#2c6e49' }) + T(96, 100, 'audio embeddé', { a: 'middle', s: 9.5 }) + R(160, 90, 64, 12, { f: '#5a2d6e', s: '#5a2d6e' }) + T(192, 100, 'données', { a: 'middle', s: 9.5 }) + R(36, 104, 188, 10, { f: '#2a3036', s: '#2a3036' }) + T(130, 113, 'suppressions', { a: 'middle', s: 9, c: MUTED });
    b += T(130, 140, 'coaxial 75 Ω, point à point', { a: 'middle', s: 11, c: MUTED });
    const flow = (y, txt, c) => L(290, y, 500, y, { c, w: 3, arrow: c === ACC ? 'c' : c === GRN ? 'g' : 'f' }) + T(296, y - 7, txt, { s: 11.5, c });
    b += flow(58, 'vidéo · ST 2110-20 · 239.1.1.1', ACC) + flow(98, 'audio · ST 2110-30 · 239.1.1.2', GRN) + flow(138, 'données · ST 2110-40 · 239.1.1.3', VIO);
    b += C(312, 170, 10, { s: AMB }) + L(312, 170, 312, 163, { c: AMB }) + L(312, 170, 318, 172, { c: AMB }) + T(329, 175, 'même horloge PTP pour les trois', { s: 11, c: AMB });
    return svg(540, 190, b, 'Essences : SDI et ST 2110');
  },
  // ---------------- NMOS ----------------
  nmos() {
    let b = node(30, 16, 150, 46, 'Registre', 'IS-04 (10.20.0.10)', { s: ACC }) + node(360, 16, 150, 46, 'Contrôleur', 'la « grille »', { s: ACC });
    b += node(30, 186, 150, 46, 'Émetteur (nœud)', 'caméra, CCU…') + node(360, 186, 150, 46, 'Récepteur (nœud)', 'écran, passerelle…');
    b += L(90, 186, 90, 64, { c: AMB, w: 2, arrow: 'm' }) + T(98, 128, 'IS-04 : se déclare', { s: 11, c: AMB }) + T(98, 142, 'battement / 5 s', { s: 11, c: AMB });
    b += L(370, 186, 180, 58, { c: AMB, w: 2, arrow: 'm', d: true }) + T(322, 186, 'IS-04 : se déclare', { s: 11, c: AMB, a: 'end' });
    b += L(358, 40, 182, 40, { c: ACC, w: 2, arrow: 'c' }) + T(270, 34, 'lit le registre (Query)', { a: 'middle', s: 11, c: ACC });
    b += L(450, 62, 450, 184, { c: GRN, w: 2, arrow: 'g' }) + T(458, 120, 'IS-05 : SDP', { s: 11, c: GRN }) + T(458, 134, '+ activation', { s: 11, c: GRN });
    b += L(180, 220, 358, 220, { c: '#46c6f2', w: 3, arrow: 'c' }) + T(270, 212, 'flux multicast (après IGMP)', { a: 'middle', s: 11 });
    return svg(540, 244, b, 'NMOS : IS-04 et IS-05');
  },
  // ---------------- ECMP ----------------
  ecmp() {
    let b = node(110, 14, 120, 36, 'Spine 1', '') + node(310, 14, 120, 36, 'Spine 2', '') + node(200, 150, 140, 40, 'Leaf', '4 liens montants');
    /** @type {[number, number, string, number, string][]} */
    const links = [[225, 140, ACC, 3, 'flux A'], [255, 200, AMB, 5, 'flux B + flux C (même lien)'], [285, 340, GRN, 3, 'flux D'], [315, 400, '#30383f', 3, 'lien vide']];
    links.forEach(([x1, x2, c, w, t], i) => {
      b += L(x1, 150, x2, 50, { c, w });
      const lx = 20 + (i % 2) * 260, ly = 212 + Math.floor(i / 2) * 18;
      b += L(lx, ly - 4, lx + 22, ly - 4, { c, w }) + T(lx + 30, ly, t, { s: 11, c: c === '#30383f' ? MUTED : c });
    });
    b += T(270, 260, 'Chaque flux est « haché » sur un lien et y reste. Peu de gros flux : charge inégale.', { a: 'middle', s: 11.5 });
    return svg(540, 270, b, 'ECMP : répartition des flux sur plusieurs chemins');
  },
  // ---------------- QoS ----------------
  qos() {
    let b = T(10, 20, 'Paquets entrants', { c: MUTED, s: 11 });
    const inc = [[AMB, 'P'], [ACC, 'V'], [ACC, 'V'], [GRN, 'A'], [ACC, 'V'], ['#69727a', '·']];
    inc.forEach(([c, n], i) => { b += pkt(10 + i * 22, 30, n, c); });
    b += L(142, 38, 152, 38, { c: LINE, arrow: 'l' }) + node(154, 18, 72, 40, 'DSCP ?', 'classement');
    /** @type {[string, string, number][]} */
    const q = [[AMB, 'Prioritaire stricte : PTP (EF 46)', 80], [GRN, 'Médias : audio 34, vidéo 26, données 18', 120], ['#69727a', 'Au mieux : contrôle, gestion (0)', 160]];
    for (const [c, t, y] of q) { b += L(226, 38, 236, y, { c, w: 1.5, arrow: 'l' }) + R(238, y - 13, 228, 26, { f: '#121518', s: c }) + T(246, y + 4, t, { s: 11, c }) + L(466, y, 474, 120, { c, w: 1.5 }); }
    b += node(476, 102, 58, 36, 'Port', 'sortie');
    b += T(10, 202, 'PTP passe devant la vidéo : ses messages ne restent pas coincés dans une file pleine.', { s: 11.5 });
    return svg(540, 212, b, 'Qualité de service : files d\'attente par DSCP');
  },
  // ---------------- MAC multicast ----------------
  macmcast() {
    const bits = [239, 1, 1, 4].map((n) => n.toString(2).padStart(8, '0')).join('');
    let b = T(20, 22, 'Groupe 239.1.1.4', { w: 700 });
    for (let i = 0; i < 32; i++) { const x = 20 + i * 15.5 + Math.floor(i / 8) * 4; const keep = i >= 9; b += R(x, 32, 14, 22, { f: keep ? '#0f2a3a' : '#16191c', s: keep ? ACC : '#30383f', r: 1 }) + T(x + 7, 48, bits[i], { a: 'middle', m: 1, s: 11, c: keep ? ACC : MUTED }); }
    b += T(20, 72, '9 premiers bits ignorés (dont 5 « perdus »)', { s: 11, c: MUTED }) + T(520, 72, '23 derniers bits recopiés', { a: 'end', s: 11, c: ACC });
    b += L(380, 78, 380, 104, { c: ACC, w: 2, arrow: 'c' });
    b += R(110, 108, 320, 32, { f: '#121518', s: ACC }) + T(270, 129, '01:00:5E  +  01:01:04  =  01:00:5E:01:01:04', { a: 'middle', m: 1, s: 12.5 });
    b += T(270, 164, '32 groupes IP partagent la même adresse MAC.', { a: 'middle', s: 11.5 });
    return svg(540, 174, b, 'Calcul de l\'adresse MAC multicast');
  },
  // ---------------- OSPF ----------------
  ospf() {
    const st = ['Down', 'Init', '2-Way', 'ExStart', 'Exchange', 'Loading', 'Full'];
    let b = '';
    st.forEach((s, i) => {
      const x = 8 + i * 76; const c = s === 'Full' ? GRN : s === 'ExStart' || s === 'Exchange' ? AMB : LINE;
      b += R(x, 30, 64, 32, { f: s === 'Full' ? '#0f3a1d' : BOX, s: c }) + T(x + 32, 50, s, { a: 'middle', s: 11.5, w: 600, c: s === 'Full' ? GRN : FG });
      if (i < st.length - 1) b += L(x + 64, 46, x + 76, 46, { c: MUTED, w: 1, arrow: 'l' });
    });
    b += L(274, 64, 274, 92, { c: AMB, w: 1.5 }) + T(274, 108, 'MTU différente des deux côtés : les voisins restent bloqués ici', { a: 'middle', s: 11.5, c: AMB });
    b += T(270, 138, '« Full » : les deux routeurs ont la même carte du réseau, les routes sont installées.', { a: 'middle', s: 11.5 });
    return svg(540, 148, b, 'États d\'un voisinage OSPF');
  },
  // ---------------- port miroir ----------------
  span() {
    let b = node(160, 20, 220, 50, 'Commutateur', 'session miroir 1');
    b += node(30, 130, 120, 40, 'Appareil', 'port source Et1') + node(390, 130, 130, 40, 'PC de mesure', 'port destination Et48');
    b += L(70, 128, 186, 72, { c: ACC, w: 2.5, arrow: 'c' }) + L(214, 72, 104, 128, { c: ACC, w: 2.5, arrow: 'c' }) + T(70, 104, 'trafic normal', { s: 11, c: ACC, a: 'end' });
    b += L(330, 72, 450, 128, { c: AMB, w: 2.5, d: true, arrow: 'm' }) + T(400, 96, 'copie', { s: 11, c: AMB });
    b += T(270, 196, 'Le port de destination ne sert plus qu\'à la copie, et doit être assez rapide pour tout recevoir.', { a: 'middle', s: 11.5 });
    return svg(540, 206, b, 'Port miroir (SPAN)');
  },
};
