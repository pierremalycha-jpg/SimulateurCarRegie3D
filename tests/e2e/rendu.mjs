// Le rendu « jeu vidéo » (v19.5) : matières procédurales plaquées en triplanaire (relief, rugosité),
// boîtes chanfreinées, occlusion ambiante cuite par sommet, SSAO dans le car, pénombre à spots,
// accessoires de l'intérieur, extérieur du car et compound habillés, arbres en plans alpha.
// Les captures servent à relire l'image : les regarder.
// node tests/e2e/rendu.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('rendu');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, query: 'full', viewport: { width: 1280, height: 720 } });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 2000) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); };

await ev(() => { window.__dbg.S.quality = 'haute'; window.__dbg.start('standard', 'jour', 'haute', false); });
await until(page, () => window.__dbg.S.mode === 'fps', null, 30000);

// ---------------- l'intérieur du car ----------------
await ev(() => window.__dbg.teleport(1));
await shot('01-car-production', 3000);
const FAMILLES = ['car-tole', 'car-sol', 'car-stratifie', 'car-alu', 'car-laque', 'car-tissu', 'car-plastique', 'car-mousse', 'car-larme'];
T.check('le car : une pièce fusionnée par famille de matière (tôle, sol, stratifié, alu, laque, tissu, plastique, mousse, tôle larmée)', await ev((F) => { const names = new Set(); window.__dbg.T.scene.traverse((o) => { if (o.isMesh) names.add(o.name); }); return F.every((n) => names.has(n)); }, FAMILLES));
T.check('chaque matière est un matériau physique à relief triplanaire, actif en qualité Haute', await ev((F) => { let ok = true; window.__dbg.T.scene.traverse((o) => { if (o.isMesh && F.includes(o.name)) { const m = o.material; ok = ok && m.isMeshStandardMaterial && !!m.userData.tri && m.userData.detailOn === true && m.vertexColors; } }); return ok; }, FAMILLES));
T.check('occlusion ambiante cuite : la couleur par sommet du sol est assombrie près des meubles (au moins 20 % plus sombre) mais pas partout', await ev(() => { let m = null; window.__dbg.T.scene.traverse((o) => { if (o.isMesh && o.name === 'car-sol') m = o; }); if (!m) return false; const c = m.geometry.attributes.color; let lo = 1, hi = 0; for (let i = 0; i < c.count; i++) { lo = Math.min(lo, c.getX(i)); hi = Math.max(hi, c.getX(i)); } return lo < hi * 0.8 && hi > 0.01; }));
T.check('pénombre : au moins 9 spots au-dessus des postes, la lueur des murs d\'écrans, une hémisphère réduite', await ev(() => { let spots = 0, pts = 0, hemi = 0; window.__dbg.T.scene.traverse((o) => { if (o.isSpotLight) spots++; else if (o.isPointLight) pts++; else if (o.isHemisphereLight) hemi = o.intensity; }); return spots >= 9 && pts >= 3 && hemi < 1.6; }));
T.check('SSAO : la pré-passe normales + profondeur existe après un rendu dans le car (qualité Haute)', await until(page, () => { const P = window.__dbg.RENDER.post; return !!P && !!P.gbuf && !!P.gbuf.depthTexture && !!P.aoBlurRT; }, null, 8000));
T.check('accessoires : chaises à cinq branches, casques, extincteur, câbles au plafond (la pièce plastique dépasse 3 000 triangles)', await ev(() => { let tris = 0; window.__dbg.T.scene.traverse((o) => { if (o.isMesh && o.name === 'car-plastique') tris = o.geometry.attributes.position.count / 3; }); return tris > 3000; }));
T.check('afficheurs de timecode dans les murs d\'écrans, à l\'heure du car ; conducteurs sur les bureaux', await ev(() => { const d = window.__dbg.T.tcDisplays; let docs = 0; window.__dbg.T.scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 0.21 && o.geometry.parameters.height === 0.297) docs++; }); return !!d && d.length === 2 && /^\d\d:\d\d:\d\d:\d\d$/.test(d[0].last) && docs >= 5; }));
T.check('rien ne dépasse du plafond : écrans et murs d\'écrans sous F + 2,25', await ev(() => { const T = window.__dbg.T, top = window.__dbg.TRUCK.ceil - 0.02; let ok = true; T.scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.height && o.geometry.type === 'PlaneGeometry' && Math.abs(o.position.z - (window.__dbg.TRUCK.cz - 2.7 + 0.19)) < 0.01) ok = ok && o.position.y + o.geometry.parameters.height / 2 <= top + 0.001; }); return ok; }));
await ev(() => window.__dbg.teleport(3)); await shot('02-car-technique', 2500);
await ev(() => window.__dbg.teleport(4)); await shot('03-car-son', 2500);
await ev(() => { window.__dbg.teleport(2); const P = window.__dbg.PL; P.yaw = P.cyaw = 2.3; }); await shot('04-car-allee', 2500);

// ---------------- qualité Basse : relief coupé sans recompiler la scène ----------------
await ev(() => window.__dbg.emit('setQuality', 'basse'));
T.check('qualité Basse : le relief des matières est désactivé (les matériaux restent, uniformes)', await ev((F) => { if (window.__dbg.MATIERE.detail) return false; let ok = true; window.__dbg.T.scene.traverse((o) => { if (o.isMesh && F.includes(o.name)) ok = ok && o.material.userData.detailOn === false; }); return ok; }, FAMILLES));
await shot('05-car-basse', 2500);
await ev(() => window.__dbg.emit('setQuality', 'haute'));
T.check('retour en Haute : relief rétabli', await ev(() => window.__dbg.MATIERE.detail === true));

// ---------------- l'extérieur ----------------
await ev(() => window.__dbg.teleport(0)); await shot('06-compound', 3000);
T.check('compound : bitume en matière (relief), car en peinture, livrée sur tôle nervurée, accessoires plastique et métal, câbles', await ev(() => { const names = new Set(); window.__dbg.W.scene.traverse((o) => { if (o.isMesh && o.material && o.material.name) names.add(o.material.name); }); return ['compound-bitume', 'car-peinture', 'car-livree', 'compound-plastique', 'compound-metal', 'compound-cables', 'car-cabine', 'dsng', 'groupe', 'bungalow'].every((n) => names.has(n)); }));
T.check('arbres : plans croisés à découpe alpha (texture, alphaTest, double face) et ombre découpée', await ev(() => { let ok = false; window.__dbg.W.scene.traverse((o) => { if (o.isInstancedMesh && o.material && o.material.alphaTest > 0 && o.material.map && o.geometry.attributes.uv) ok = true; }); return ok; }));
T.check('tribunes : béton en matière, pylônes en acier', await ev(() => { const names = new Set(); window.__dbg.W.scene.traverse((o) => { if (o.isMesh && o.material && o.material.name) names.add(o.material.name); }); return names.has('tribunes-beton') && names.has('pylones') && names.has('parvis'); }));
await ev(() => { window.__dbg.teleport(0); const P = window.__dbg.PL; P.yaw = P.cyaw = -0.9; }); await shot('07-compound-rampes', 2500);
await ev(() => window.__dbg.teleport(11)); await shot('08-stade-angle', 2500);
await ev(() => window.__dbg.teleport(13)); await shot('09-aerien', 3000);

// ---------------- l'entrepôt ----------------
await page.close(); // une seule page à la fois : le rendu logiciel est lent
{
  const B = await openPage(browser, { errors: T.errors, viewport: { width: 1280, height: 720 }, before: async (p) => p.addInitScript(() => { try { localStorage.setItem('carregie.quality', 'haute'); } catch (e) { /* stockage indisponible */ } }) });
  await B.click('[data-lieu="entrepot"]'); await B.waitForTimeout(300);
  await B.click('.jo-mode[data-mode="ep:conference"]'); await B.click('#st-antenne');
  await until(B, () => window.__dbg.entrepot().R && !document.getElementById('entrepot').hidden && !document.querySelector('#entrepot .ep-loading'), null, 120000);
  T.check('entrepôt : béton, bardage, acier, baie, table, moquette, cartons et flight cases en matières ; environnement du hall', await B.evaluate(() => { const R = window.__dbg.entrepot().R; const names = new Set(); R.hall.scene.traverse((o) => { const m = o.material; if (m && m.name) names.add(m.name); }); return ['ep-beton', 'ep-bardage', 'ep-acier', 'ep-baie', 'ep-table', 'ep-nez', 'ep-moquette', 'ep-carton', 'ep-flightcase'].every((n) => names.has(n)) && !!R.hall.scene.environment; }));
  await B.evaluate(() => { const d = window.__dbg.entrepot(); d.act.sortir('he20'); d.act.sortir('atem-hd8-iso'); document.querySelector('.ep-zones [data-zone="table"]').click(); });
  await B.waitForTimeout(2500); await B.screenshot({ path: `${OUT}/10-entrepot.png` });
  await B.close();
}

await T.finish();
