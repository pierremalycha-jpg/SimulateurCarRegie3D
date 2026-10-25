// Le stade (v19.9) : textes ajustés (plus de bandeau coupé), locaux sous la tribune fermés,
// bord terrain habité (entraîneurs, remplaçants, staff, 4e arbitre, photographes, stadiers),
// mini plateau des commentateurs (deux caméras, deux panneaux LED, vraie source STUDIO),
// angles fermés par un mur d'enceinte et joues des tribunes habillées.
// Les captures servent à relire l'image : les regarder.
// node tests/e2e/stade.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('stade');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, query: 'full', viewport: { width: 1280, height: 720 } });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 2500) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const meshNames = () => ev(() => { const s = new Set(); window.__dbg.W.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { s.add(o.name); if (o.material && o.material.name) s.add(o.material.name); } }); return [...s]; });
// vue libre (HUD masqué) : yaw 0 regarde vers −z
const vue = async (n, x, y, z, yaw, pitch = 0) => {
  await ev(([x, y, z, yaw, pitch]) => { const D = window.__dbg, P = D.PL; D.teleport(13); P.pos.set(x, y, z); P.y = y + 1.7; P.fly = true; D.S.inTruck = false; P.yaw = P.cyaw = yaw; P.pitch = P.cpitch = pitch; P.vel.set(0, 0, 0); }, [x, y, z, yaw, pitch]);
  await shot(n);
};

await ev(() => { window.__dbg.S.quality = 'haute'; window.__dbg.start('standard', 'jour', 'haute', false); });
await until(page, () => window.__dbg.S.mode === 'fps', null, 30000);
await page.addStyleTag({ content: '#hud, #quest, #toolbar, #statusbar, #minimon, #onboard, #toast, #zonecard, #olivier, .dlg { display: none !important; }' });
const names = await meshNames();

// ---------------- locaux sous la tribune ----------------
T.check('locaux : murs, carrelage, sol, plafond, mobilier et plafonniers en matières nommées', ['locaux-murs', 'locaux-carrelage', 'locaux-sol', 'locaux-plafond', 'locaux-bois', 'locaux-plafonniers'].every((n) => names.includes(n)));
T.check('locaux : on circule dans le couloir et on entre dans les vestiaires par la porte, pas à travers le mur', await ev(() => { const b = window.__dbg.blockedOutside; return !b(0, -70) && !b(10, -78) && !b(-10, -72) && !b(-10, -86) && b(3.15, -82) && b(-3.15, -76) && !b(3.15, -78.5); }));

// ---------------- bord terrain ----------------
T.check('bord terrain : abris de touche, table du 4e arbitre, tunnel télescopique', ['bancs-acier', 'bancs-plastique', 'bancs-plexiglas', 'tunnel-toile'].every((n) => names.includes(n)));
const kinds = await ev(() => { const k = {}; for (const s of window.__dbg.STAFF.list) k[s.kind] = (k[s.kind] || 0) + 1; return k; });
T.check(`staff : 2 entraîneurs, 2 adjoints, 12 remplaçants assis, 8 staff et médecins, échauffement, 4e arbitre, photographes, stadiers, ramasseurs (${JSON.stringify(kinds)})`, kinds.entraineur === 2 && kinds.adjoint === 2 && kinds.remplacant === 12 && kinds.staff === 8 && kinds.echauffement === 6 && kinds.arbitre4 === 1 && kinds.photographe >= 4 && (kinds.stadier || 0) >= 4 && (kinds.ramasseur || 0) >= 4);
T.check('staff : personnages articulés instanciés (une instance par personne et par pièce du corps)', await ev(() => { let ok = false; window.__dbg.W.scene.traverse((o) => { if (o.isInstancedMesh && o.name.startsWith('staff-') && o.count >= window.__dbg.STAFF.n) ok = true; }); return window.__dbg.STAFF.built && ok; }));
T.check('l\'entraîneur bouge dans sa zone technique', await (async () => { const a = await ev(() => window.__dbg.STAFF.list.find((s) => s.kind === 'entraineur').cx); await page.waitForTimeout(1500); const b = await ev(() => window.__dbg.STAFF.list.find((s) => s.kind === 'entraineur').cx); return typeof a === 'number' && a !== b; })());
await vue('01-banc-domicile', -6, 0, -29, 0.45, 0.02);
await vue('02-bord-terrain', 0, 2.5, -20, 0, -0.06);

// ---------------- plateau des commentateurs ----------------
T.check('plateau : 2 commentateurs assis, 2 caméras sur trépied, 2 panneaux LED, pupitre et sol', await ev(() => { const P = window.__dbg.PLATEAU, k = window.__dbg.STAFF.list.filter((s) => s.kind === 'commentateur').length; return k === 2 && P.cams.length === 2 && P.leds.length === 2; }) && ['plateau-metal', 'plateau-pupitre', 'plateau-sol', 'plateau-voyants'].every((n) => names.includes(n)));
T.check('plateau : la source STUDIO est une vraie image rendue depuis la caméra du plateau (ni noire, ni uniforme)', await ev(() => { const D = window.__dbg, rt = D.PLATEAU.rt; if (!rt) return false; const w = rt.width, h = rt.height, px = new Uint8Array(w * h * 4); D.renderer.readRenderTargetPixels(rt, 0, 0, w, h, px); let s = 0, s2 = 0, n = 0; for (let i = 0; i < px.length; i += 4 * 37) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; s += l; s2 += l * l; n++; } const m = s / n; return m > 20 && Math.sqrt(s2 / n - m * m) > 12; })); // pas de délai : en rendu logiciel, une lecture peut attendre 40 s
await vue('03-plateau', 12, 13, -53, 0, -0.18);
await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('melangeur'); });
await shot('04-multiviewer-studio', 3000);
await ev(() => window.__dbg.closeStation());

// ---------------- angles et joues ----------------
T.check('angles : mur d\'enceinte en béton, portails, plaques de porte et buvettes', ['angles-beton', 'angles-portail', 'angles-porte', 'angles-buvette', 'angles-buvettes'].every((n) => names.includes(n)));
T.check('angles : le mur bloque, le portail laisse passer', await ev(() => { const b = window.__dbg.blockedOutside, ST = window.__dbg.W; void ST; const p0 = [-57.7, -92.7], p1 = [-98.2, -36.7], at = (t) => [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]; const mur = at(0.15), porte = at(0.5); return b(mur[0], mur[1]) && !b(porte[0], porte[1]); }));
await vue('05-angle-exterieur', -112, 2, -112, -2.36, 0.08);
await vue('06-angle-interieur', -62, 2, -50, 0.88, 0.05);
await vue('07-angle-aerien', -120, 40, -120, -2.36, -0.4);

await T.finish();
