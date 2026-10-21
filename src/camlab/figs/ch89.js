// @ts-check
// Schémas des fiches du module caméra : jusqu'au moniteur, et pour aller plus loin (chapitres 8 et 9). Un schéma par fiche, nommé par le champ `fig`.
// Aides communes : ../figkit.js (svg, tx, head, rays, dim, n1). Les valeurs sont calculées avec les
// fonctions de ../labs/ch89.js (BT.709, HLG, profondeur de champ), pour que le schéma et la
// manipulation disent les mêmes chiffres. Couleurs : classes cf-* (camlab.css) et c89-* (camlab-ch89.css).

import { svg, tx, head, dim, n1 } from '../figkit.js';
import { fr } from '../optics.js';
import { BARS6, barVector, SKIN_LINE, BAR7, ycc, oetf709, hlg, HLG_REF, lumaOf, SCENE_WF, W23, WS35, cocOf, focalFor, dofOf } from '../labs/ch89.js';

const cm = (m) => fr(m * 100, 1) + ' cm';

/** @type {Record<string, () => string>} */
export const FIGS_CH89 = {
  /** une image, sa forme d'onde : chaque objet à sa colonne, à son niveau */
  waveform: () => {
    const S = SCENE_WF, E = 1;
    const lv = { curtain: lumaOf(S.curtain, E), card: lumaOf(S.card, E), jacket: lumaOf(S.jacket, E), face: lumaOf(S.skin, E), shirt: lumaOf(S.shirt, E) };
    const x0 = 16, w0 = 168, y0 = 50, h0 = 95; // l'image
    const L = 226, R = 424, Y = (p) => 214 - p * 1.5, X = (u) => L + u * (R - L); // la forme d'onde
    const grid = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => `<line class="c89-grid${p % 50 ? '' : ' b'}" x1="${L}" y1="${n1(Y(p))}" x2="${R}" y2="${n1(Y(p))}"/>${p % 50 ? '' : tx(L - 4, n1(Y(p) + 4), String(p), 'c89-tick')}`).join('');
    const tr = (u0, u1, p, t, anchor = 'mid') => `<rect class="c89-tr" x="${n1(X(u0))}" y="${n1(Y(p) - 1.5)}" width="${n1(X(u1) - X(u0))}" height="3" rx="1"/>${t ? tx(anchor === 'mid' ? n1((X(u0) + X(u1)) / 2) : n1(X(u1) + 4), n1(Y(p) - (anchor === 'mid' ? 6 : -3)), t, anchor === 'mid' ? 'c89-trl' : 'c89-trl l') : ''}`;
    const sx = (u) => n1(x0 + u * w0), sy = (v) => n1(y0 + v * h0);
    return svg(270, `Schéma : à gauche l'image d'un présentateur, à droite sa forme d'onde graduée de 0 à 100 %. Le rideau est vers ${fr(lv.curtain, 0)} %, la veste vers ${fr(lv.jacket, 0)} %, la carte grise vers ${fr(lv.card, 0)} %, le visage vers ${fr(lv.face, 0)} %, la chemise blanche vers ${fr(lv.shirt, 0)} % ; la ligne des 103 % est la limite admise.`, `
      ${head('Lire une exposition en pourcentage', 'Chaque point garde sa colonne ; sa hauteur donne son niveau.')}
      <rect class="c89-cur" x="${x0}" y="${y0}" width="${w0}" height="${h0}"/>
      <rect class="c89-card" x="${sx(0.08)}" y="${sy(0.34)}" width="${n1(0.12 * w0)}" height="${n1(0.32 * h0)}"/>
      <polygon class="c89-jacket" points="${sx(0.35)},${sy(0.66)} ${sx(0.65)},${sy(0.66)} ${sx(0.7)},${sy(1)} ${sx(0.3)},${sy(1)}"/>
      <polygon class="c89-shirt" points="${sx(0.455)},${sy(0.66)} ${sx(0.545)},${sy(0.66)} ${sx(0.5)},${sy(0.9)}"/>
      <rect class="c89-skin" x="${sx(0.47)}" y="${sy(0.52)}" width="${n1(0.06 * w0)}" height="${n1(0.15 * h0)}"/>
      <ellipse class="c89-skin" cx="${sx(0.5)}" cy="${sy(0.38)}" rx="${n1(0.062 * w0)}" ry="${n1(0.16 * h0)}"/>
      <path class="c89-hair" d="M${sx(0.43)} ${sy(0.3)} Q${sx(0.5)} ${sy(0.12)} ${sx(0.57)} ${sy(0.3)} Z"/>
      ${tx(x0 + w0 / 2, y0 + h0 + 15, 'l\'image')}
      <rect class="c89-scope" x="${L}" y="${n1(Y(110))}" width="${R - L}" height="${n1(Y(0) - Y(110))}"/>
      ${grid}
      <line class="c89-lim" x1="${L}" y1="${n1(Y(103))}" x2="${R}" y2="${n1(Y(103))}"/>${tx(R, n1(Y(103) - 4), '103 % : limite (EBU R 103)', 'c89-liml')}
      ${tr(0, 1, lv.curtain, '')}${tx(R - 2, n1(Y(lv.curtain) - 5), `rideau ${fr(lv.curtain, 0)} %`, 'c89-trl r')}
      ${tr(0.08, 0.2, lv.card, `carte grise ${fr(lv.card, 0)} %`, 'side')}
      ${tr(0.3, 0.7, lv.jacket, `veste ${fr(lv.jacket, 0)} %`, 'side')}
      ${tr(0.438, 0.562, lv.face, `visage ${fr(lv.face, 0)} %`)}
      ${tr(0.455, 0.545, lv.shirt, `chemise ${fr(lv.shirt, 0)} %`)}
      ${tx((L + R) / 2, 230, 'la forme d\'onde (en %)')}
      ${tx(16, 250, '0 % : le noir, code 64 en 10 bits · 100 % : le blanc, code 940 · 0 à 700 mV', 'cf-sub')}
      ${tx(16, 265, 'Visages vers 60 à 70 % (peau claire), rien au-dessus de 103 %.', 'cf-sub')}`);
  },

  /** le vectorscope : les cibles des barres 75 %, la ligne des carnations, angle et distance */
  vecto: () => {
    const cx = 128, cy = 150, R = 94, sc = R / 0.56;
    const targets = BARS6.map(([n]) => {
      const t = barVector(n), x = cx + t.cb * sc, y = cy - t.cr * sc, ox = t.cb / t.sat * 16, oy = -t.cr / t.sat * 16;
      return `<rect class="c89-tg" x="${n1(x - 6)}" y="${n1(y - 6)}" width="12" height="12"/><circle class="c89-dot" cx="${n1(x)}" cy="${n1(y)}" r="2.6"/>${tx(n1(x + ox), n1(y + oy + 4), n, 'c89-tgl')}`;
    }).join('');
    const a = SKIN_LINE * Math.PI / 180, r = barVector('R');
    const ang = BARS6.map(([n]) => `${n} ${fr(barVector(n).hue, 0)}°`);
    return svg(262, `Schéma du vectorscope : un cercle, l'axe Cb à l'horizontale, l'axe Cr à la verticale ; les six cibles des barres à 75 % (${ang.join(', ')}) ; la ligne des carnations à ${SKIN_LINE}°. L'angle d'un point donne sa teinte, sa distance au centre sa saturation.`, `
      ${head('Teinte en angle, saturation en distance', 'Les cibles des barres 75 % et la ligne des carnations, en BT.709.')}
      <circle class="c89-scope" cx="${cx}" cy="${cy}" r="${R}"/><circle class="c89-grid b" cx="${cx}" cy="${cy}" r="${R}" fill="none"/>
      <line class="c89-grid" x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}"/><line class="c89-grid" x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}"/>
      ${tx(cx + R - 4, cy - 5, 'Cb', 'c89-tgl r')}${tx(cx + 5, cy - R + 12, 'Cr', 'c89-tgl l')}
      <line class="c89-skin-l" x1="${cx}" y1="${cy}" x2="${n1(cx + Math.cos(a) * R)}" y2="${n1(cy - Math.sin(a) * R)}"/>
      ${tx(n1(cx + Math.cos(a) * R * 0.55 - 8), n1(cy - Math.sin(a) * R * 0.55 - 2), 'carnations', 'c89-skl r')}
      <line class="c89-arr" x1="${cx}" y1="${cy}" x2="${n1(cx + r.cb * sc * 0.97)}" y2="${n1(cy - r.cr * sc * 0.97)}" marker-end="url(#cf-a)"/>
      ${targets}<circle class="c89-dot w" cx="${cx}" cy="${cy}" r="3"/>
      <g transform="translate(250 50)"><rect class="cf-box" x="0" y="0" width="182" height="196" rx="3"/>
        <text class="cf-bt" x="10" y="20">Comment le lire</text>
        <text class="cf-bs" x="10" y="42">L'angle : la teinte</text><text class="cf-bs" x="10" y="58">La distance au centre :</text><text class="cf-bs" x="10" y="72">la saturation</text>
        <text class="cf-bs" x="10" y="92">Au centre : blanc, gris, noir</text>
        <text class="cf-bs" x="10" y="112">Les barres 75 % : une tache</text><text class="cf-bs" x="10" y="126">dans chaque case</text>
        <text class="cf-bs" x="10" y="146">Les visages : sur la ligne</text><text class="cf-bs" x="10" y="160">des carnations, vers ${SKIN_LINE}°</text>
        <text class="cf-bs sm" x="10" y="182">${ang.slice(0, 3).join(' · ')}</text><text class="cf-bs sm" x="10" y="194">${ang.slice(3).join(' · ')}</text></g>`);
  },

  /** le moniteur de référence : la PLUGE, les trois réglages, la norme */
  moniteur: () => {
    const bars = BAR7.map((c, i) => `<rect x="${n1(20 + i * 26)}" y="54" width="26" height="62" fill="rgb(${c.map((v) => Math.round(v * 255)).join(',')})"/>`).join('');
    const blue = BAR7.map((c, i) => `<rect x="${n1(20 + i * 26)}" y="190" width="26" height="22" fill="rgb(0,0,${Math.round(c[2] * 255)})"/>`).join('');
    const step = (y, n, t, a, b) => `<g transform="translate(232 ${y})"><rect class="cf-box" x="0" y="0" width="200" height="52" rx="3"/><text class="cf-bt" x="10" y="18">${n}. ${t}</text><text class="cf-bs" x="10" y="34">${a}</text><text class="cf-bs" x="10" y="47">${b}</text></g>`;
    return svg(256, 'Schéma : l\'écran du moniteur avec les barres à 75 %, et en dessous, sur le noir, le blanc 100 % et la PLUGE à −2 %, +2 % et +4 % ; les mêmes barres en bleu seul, quatre barres bleues égales ; les trois réglages dans l\'ordre : la luminosité à la PLUGE, le contraste à la sonde (100 cd/m²), la chroma au bleu seul.', `
      ${head('Régler le moniteur de référence', 'Dans l\'ordre : la luminosité, le contraste, la chroma.')}
      <rect class="cf-vf" x="14" y="48" width="194" height="118" rx="3"/>${bars}
      <rect x="20" y="116" width="182" height="44" fill="#000"/>
      <rect x="28" y="122" width="40" height="32" fill="#f3f3f3"/>
      <rect class="c89-pl0" x="104" y="122" width="22" height="32"/><rect x="136" y="122" width="22" height="32" fill="#2c2c2c"/><rect x="168" y="122" width="22" height="32" fill="#444"/>
      ${tx(48, 178, '100 %', 'cf-tick')}${tx(115, 178, '−2 %', 'cf-tick')}${tx(147, 178, '+2 %', 'cf-tick')}${tx(179, 178, '+4 %', 'cf-tick')}
      ${blue}${tx(111, 226, 'bleu seul : quatre barres égales', 'cf-s')}
      ${tx(111, 240, 'niveaux de la PLUGE accentués', 'c89-note')}
      ${step(46, 1, 'LUMINOSITÉ', 'La PLUGE : la −2 % disparaît,', 'la +2 % reste visible.')}
      ${step(104, 2, 'CONTRASTE', 'La sonde sur le blanc :', '100 cd/m².')}
      ${step(162, 3, 'CHROMA', 'Le bleu seul : gris, cyan,', 'magenta et bleu égaux.')}
      ${tx(232, 236, 'BT.709 · gamma 2,4 (BT.1886)', 'cf-s l')}${tx(232, 250, 'blanc D65 à 100 cd/m² (BT.2035)', 'cf-s l')}`);
  },

  /** trois mires, trois usages */
  mires: () => {
    const bars = BAR7.map((c, i) => `<rect x="${n1(20 + i * 17.4)}" y="50" width="17.6" height="92" fill="rgb(${c.map((v) => Math.round(v * 255)).join(',')})"/>`).join('');
    const sc = 222, scy = 96, R = 44;
    const star = Array.from({ length: 36 }, (_, i) => { const a0 = i / 36 * Math.PI * 2, a1 = (i + 0.5) / 36 * Math.PI * 2; return `<path class="c89-star" d="M${sc} ${scy} L${n1(sc + R * Math.cos(a0))} ${n1(scy + R * Math.sin(a0))} A${R} ${R} 0 0 1 ${n1(sc + R * Math.cos(a1))} ${n1(scy + R * Math.sin(a1))} Z"/>`; }).join('');
    const grey = Array.from({ length: 11 }, (_, i) => `<rect x="${n1(296 + i * 11.6)}" y="74" width="11.8" height="44" fill="rgb(${Array(3).fill(Math.round(i / 10 * 255)).join(',')})"/>`).join('');
    const cap = (x, t, a, b, c) => `${tx(x, 162, t, 'cf-bb mid')}${tx(x, 180, a)}${tx(x, 194, b)}${tx(x, 208, c)}`;
    const lv = BAR7.map((c) => fr(100 * ycc(c[0], c[1], c[2])[0], 0)).join(' · ');
    return svg(250, `Schéma : trois mires. Les barres de couleur à 75 %, fabriquées par la caméra (luminance ${lv} %), testent la liaison, les niveaux et le moniteur. L'étoile de Siemens, posée devant l'objectif, sert au point et au tirage. La charte de onze gris sert au noir, au gamma, au blanc et au raccord des caméras.`, `
      ${head('À chaque réglage sa mire', 'Les barres testent la chaîne, les mires optiques testent l\'image.')}
      <rect class="cf-vf" x="16" y="46" width="130" height="100" rx="2"/>${bars}
      <rect class="c89-white" x="166" y="46" width="112" height="100" rx="2"/>${star}<circle class="c89-star-o" cx="${sc}" cy="${scy}" r="${R + 1.5}"/>
      <rect class="c89-white" x="290" y="46" width="140" height="100" rx="2"/>${grey}
      ${cap(81, 'Barres 75 %', 'fabriquées par la caméra :', 'la liaison, les niveaux,', 'le moniteur, le vectorscope')}
      ${cap(222, 'Étoile de Siemens', 'devant l\'objectif :', 'le point, le tirage,', 'le piqué de l\'objectif')}
      ${cap(360, 'Charte de 11 gris', 'devant l\'objectif :', 'le noir, le gamma, le blanc,', 'le raccord des caméras')}
      ${tx(16, 236, 'Pour la balance : un carton blanc ou la charte grise, sous la lumière de la scène.', 'cf-sub')}`);
  },

  /** même cadre sur deux capteurs : focale, zone nette */
  grandcapteur: () => {
    const k = 4.4, cx = 112, cy = 140; // 4,4 px par mm
    const rect = (W, H, cls) => `<rect class="${cls}" x="${n1(cx - W * k / 2)}" y="${n1(cy - H * k / 2)}" width="${n1(W * k)}" height="${n1(H * k)}"/>`;
    const p23 = { f: focalFor(W23, 3, 0.5) }, p35 = { f: focalFor(WS35, 3, 0.5) };
    const d23 = dofOf(p23.f, 2.8, 3, cocOf(W23)).total, d35 = dofOf(p35.f, 2.8, 3, cocOf(WS35)).total;
    const ratio = WS35 / W23;
    return svg(258, `Schéma à l'échelle : un capteur 2/3 pouces de 9,59 × 5,39 mm (cercle image 11 mm) dans un capteur Super 35 d'environ 25 × 14 mm (cercle image 28,6 mm), ${fr(ratio, 1)} fois plus large. Même cadre, un visage de 50 cm de large à 3 m : ${fr(p23.f, 0)} mm et ${cm(d23)} de zone nette à f/2,8 en 2/3 ; ${fr(p35.f, 0)} mm et ${cm(d35)} en Super 35.`, `
      ${head('Même cadre, deux tailles de capteur', `Super 35, ${fr(ratio, 1)} fois plus large : focale ×${fr(ratio, 1)}, zone nette réduite.`)}
      <circle class="c89-circ s" cx="${cx}" cy="${cy}" r="${n1(28.57 / 2 * k)}"/>${rect(WS35, 14, 'c89-sens s')}
      <circle class="c89-circ" cx="${cx}" cy="${cy}" r="${n1(11 / 2 * k)}"/>${rect(W23, 5.39, 'c89-sens')}
      ${tx(cx, n1(cy - 14 * k / 2 - 5), 'Super 35', 'c89-sl s')}${tx(cx, n1(cy + 4), '2/3″', 'c89-sl')}
      ${dim(n1(cx - WS35 * k / 2), 212, n1(cx + WS35 * k / 2), 212)}
      ${tx(cx, 234, 'Super 35 : environ 25 × 14 mm', 'cf-s')}${tx(cx, 249, '2/3″ : 9,59 × 5,39 mm', 'cf-s')}
      <g transform="translate(232 46)"><rect class="cf-box" x="0" y="0" width="200" height="200" rx="3"/>
        <text class="cf-bt" x="10" y="20">Visage de 50 cm à 3 m</text>
        <text class="cf-bb" x="10" y="44">2/3″ : ${fr(p23.f, 0)} mm</text><text class="cf-bs" x="10" y="60">à f/2,8 : ${cm(d23)} nets</text>
        <text class="cf-bb" x="10" y="84">Super 35 : ${fr(p35.f, 0)} mm</text><text class="cf-bs" x="10" y="100">à f/2,8 : ${cm(d35)} nets</text>
        <text class="cf-bs" x="10" y="124">Même zone nette en Super 35 :</text><text class="cf-bs" x="10" y="138">fermer d'environ 2,8 diaph.,</text><text class="cf-bs" x="10" y="152">donc 7 fois moins de lumière.</text>
        <text class="cf-bs" x="10" y="176">Cercles : ce que l'objectif</text><text class="cf-bs" x="10" y="190">éclaire (11 et 28,6 mm).</text></g>`);
  },

  /** UHD : quatre fois la HD ; HDR : la courbe HLG garde les hautes lumières */
  hdr: () => {
    const g = [`<rect class="c89-uhd" x="16" y="50" width="176" height="99"/>`, `<rect class="c89-hd" x="16" y="50" width="88" height="49.5"/>`,
      `<line class="c89-grid b" x1="104" y1="50" x2="104" y2="149"/><line class="c89-grid b" x1="16" y1="99.5" x2="192" y2="99.5"/>`].join('');
    const x0 = 236, x1 = 428, y0 = 196, y1 = 56, X = (l) => x0 + l / 4 * (x1 - x0), Y = (p) => y0 - p / 100 * (y0 - y1);
    const curve = (fn) => Array.from({ length: 81 }, (_, i) => { const l = i / 20; return `${i ? 'L' : 'M'}${n1(X(l))} ${n1(Y(100 * fn(l)))}`; }).join(' ');
    const sdr = curve((l) => oetf709(l)), hl = curve((l) => hlg(HLG_REF * l));
    const top = 1 / HLG_REF;
    return svg(258, `Schéma : à gauche, une image UHD de 3840 × 2160 pixels contient quatre images HD de 1920 × 1080. À droite, le signal en fonction de la lumière de la scène : la courbe SDR (BT.709) atteint 100 % sur le carton blanc et écrête au-delà ; la courbe HLG pose ce blanc à 75 % et ne touche 100 % qu'à ${fr(top, 1)} fois sa lumière.`, `
      ${head('Plus de pixels, plus de lumière', 'UHD 3840 × 2160 (BT.2020), courbe HLG (BT.2100), blanc à 75 %.')}
      ${g}${tx(60, 79, 'HD', 'cf-bb mid')}${tx(60, 93, '1920 × 1080', 'cf-tick')}${tx(104, 166, 'UHD : 4 fois les pixels', 'cf-s')}
      ${tx(104, 182, '3840 × 2160 = 8,3 millions', 'c89-note')}${tx(104, 196, '2160p50 : 12G-SDI ou 4 × 3G', 'c89-note')}
      <rect class="c89-scope" x="${x0}" y="${y1}" width="${x1 - x0}" height="${y0 - y1}"/>
      ${[0, 50, 75, 100].map((p) => `<line class="c89-grid${p === 75 ? ' h' : ''}" x1="${x0}" y1="${n1(Y(p))}" x2="${x1}" y2="${n1(Y(p))}"/>${tx(x0 - 4, n1(Y(p) + 4), String(p), 'c89-tick')}`).join('')}
      ${[0, 1, 2, 3, 4].map((l) => tx(n1(X(l)), y0 + 13, String(l), 'cf-tick')).join('')}
      <path class="c89-sdr" d="${sdr}"/><path class="c89-hlg" d="${hl}"/>
      <line class="c89-grid h" x1="${n1(X(1))}" y1="${y1}" x2="${n1(X(1))}" y2="${y0}"/>
      ${tx(n1(X(1) + 4), n1(Y(100) - 5), 'SDR : écrêté', 'c89-sdrl l')}${tx(n1(X(0.5) + 6), n1(Y(61) + 14), 'HLG', 'c89-hlgl l')}
      ${tx(x1 - 2, n1(Y(75) + 13), 'blanc de réf. 75 %', 'c89-hlgl r')}
      ${tx((x0 + x1) / 2, y0 + 27, 'lumière de la scène (carton blanc = 1)', 'cf-s')}
      ${tx(16, 238, 'Écran HLG de 1 000 cd/m² : le blanc à 203 cd/m², les crêtes jusqu\'à 1 000.', 'cf-sub')}
      ${tx(16, 253, 'Gris 18 % : 41 % en SDR, 38 % en HLG.', 'cf-sub')}`);
  },

  /** le super ralenti 3× : 150 images, trois phases, relu à 33 % */
  hfr: () => {
    const cls = ['a', 'b', 'c'];
    const cam = Array.from({ length: 9 }, (_, i) => `<rect class="c89-ph ${cls[i % 3]}" x="${120 + i * 34}" y="44" width="28" height="22" rx="2"/>${tx(134 + i * 34, 59, String(i + 1), 'c89-phl')}`).join('');
    const phase = (p, y) => `${tx(118, y + 15, `phase ${'ABC'[p]}`, 'cf-s r')}${[0, 1, 2].map((k) => { const n = p + 3 * k; return `<rect class="c89-ph ${cls[p]}" x="${126 + k * 34}" y="${y}" width="28" height="22" rx="2"/>${tx(140 + k * 34, y + 15, String(n + 1), 'c89-phl')}`; }).join('')}<line class="c89-arr" x1="230" y1="${y + 11}" x2="268" y2="${y + 11}" marker-end="url(#cf-a)"/>${tx(274, y + 15, `SDI ${p + 1} → serveur`, 'cf-s l')}`;
    const out = (y, seq, title, sub, ok) => `<text class="cf-bb" x="16" y="${y - 6}">${title} : <tspan class="${ok ? 'c89-ok' : 'c89-bad'}">${sub}</tspan></text>${seq.map((n, i) => `<rect class="c89-ph ${ok ? cls[(n - 1) % 3] : 'n'}" x="${16 + i * 34}" y="${y}" width="28" height="22" rx="2"/>${tx(30 + i * 34, y + 15, String(n), 'c89-phl')}`).join('')}`;
    return svg(262, 'Schéma : une caméra super ralenti 3× prend 150 images par seconde, numérotées de 1 à 9 ; elle les sort sur trois liaisons, la phase A (1, 4, 7), la phase B (2, 5, 8) et la phase C (3, 6, 9), vers trois entrées du serveur. Relu à 33 %, le ralenti montre 1, 2, 3, 4… : chaque image une fois. Une caméra à 50 images par seconde relue à 33 % montre 1, 1, 1, 2, 2, 2 : il saccade.', `
      ${head('Le super ralenti 3× : 150 images par seconde', 'Trois phases, trois liaisons ; relu à 33 %, chaque image une fois.')}
      ${tx(112, 59, 'à la caméra', 'cf-s r')}${cam}
      ${phase(0, 76)}${phase(1, 102)}${phase(2, 128)}
      ${out(176, [1, 2, 3, 4, 5, 6, 7, 8, 9], 'Relu à 33 %', 'fluide, chaque image une fois', true)}
      ${out(222, [1, 1, 1, 2, 2, 2, 3, 3, 3], 'Caméra à 50 i/s relue à 33 %', 'chaque image trois fois, saccades', false)}
      ${tx(16, 258, 'Temps de pose 1/150 s au plus : trois fois moins de lumière, 1,6 diaphragme.', 'cf-sub')}`);
  },
};
