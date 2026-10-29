// Les graphismes repris (v19.21) : aucun texte du décor ne dépasse de son panneau (enseigne du stade sur la façade de
// la tribune Lepagnot, bandeaux des tribunes entre les banderoles du kop, nom du car sur son flanc), le style « dessin »
// (cel shading : lumière en paliers, ombres nettes, contours à l'encre en qualité Moyenne et Haute) et son retour au
// réaliste, les abris de touche arrondis avec remplaçants et entraîneurs aux couleurs des clubs, les commentateurs.
// Les captures servent à relire l'image : les regarder.
// node tests/e2e/graphismes.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('graphismes');
const T = reporter();
const browser = await launch();
// qualité Moyenne (post-traitement et encre, comme en Haute, mais plus légère pour le rendu logiciel des tests)
const A = await openPage(browser, { errors: T.errors, query: 'full', viewport: { width: 1024, height: 576 }, before: async (p) => p.addInitScript(() => { try { localStorage.setItem('carregie.quality', 'moyenne'); localStorage.removeItem('carregie.style'); } catch (e) { /* stockage indisponible */ } }) });
const ev = (f, a) => A.evaluate(f, a);
const frames = async (n = 3) => { const f0 = await ev(() => window.__dbg.S.frame); await until(A, (f) => window.__dbg.S.frame > f, f0 + n, 90000); };
const shot = async (n) => { await frames(); await A.screenshot({ path: `${OUT}/${n}.png` }); };
const voir = (p, yaw, pitch, fly = true) => ev(([p, yaw, pitch, fly]) => { const d = window.__dbg; d.PL.fly = fly; d.S.inTruck = false; d.PL.pos.set(p[0], p[1] - 1.7, p[2]); d.PL.y = p[1]; d.PL.yaw = d.PL.cyaw = yaw; d.PL.pitch = d.PL.cpitch = pitch; d.PL.vel.set(0, 0, 0); }, [p, yaw, pitch, fly]);

// ---------------- la partie : car pré-installé contre l'OM ----------------
await A.click('.jo-mode[data-mode="installe"]'); await A.waitForTimeout(300);
await A.selectOption('#st-adversaire', 'om');
await A.click('[data-emission="non"]'); await A.waitForTimeout(200);
await A.click('#st-antenne');
T.check('la partie commence (car pré-installé)', await until(A, () => window.__dbg.S.mode === 'fps' || window.__dbg.S.mode === 'station', null, 120000));
await ev(() => { document.querySelectorAll('.toast, #ctrlhint').forEach((e) => e.remove()); });

// ---------------- les textes du décor ----------------
T.check('les panneaux écrits du stade sont inscrits (bandeaux des quatre tribunes, façades, banderoles du kop, nom du car)', await ev(() => {
  const n = window.__dbg.W.panneaux.map((p) => p.nom);
  return n.filter((x) => x.startsWith('bandeau')).length === 4 && n.filter((x) => x.startsWith('façade')).length === 4 && n.filter((x) => x.startsWith('banderole')).length === 6 && n.includes('nom du car');
}));
const dehors = await ev(() => {
  const out = [];
  for (const p of window.__dbg.W.panneaux) {
    p.mesh.updateWorldMatrix(true, false);
    const b = p.mesh.geometry.boundingBox || (p.mesh.geometry.computeBoundingBox(), p.mesh.geometry.boundingBox);
    const w = b.clone().applyMatrix4(p.mesh.matrixWorld);
    if (!p.dans.containsBox(w)) out.push(p.nom);
  }
  return out;
});
T.check('aucun panneau écrit ne dépasse de sa tribune, de sa façade ou du flanc du car', dehors.length === 0, dehors.join(', '));
T.check('le nom du stade est sur la façade de la tribune Lepagnot (plus d\'enseigne de 64 m qui débordait)', await ev(() => {
  const f = window.__dbg.W.panneaux.find((p) => p.nom === 'façade Tribune Lepagnot'); if (!f) return false;
  const g = f.mesh.geometry; g.computeBoundingBox(); const w = g.boundingBox.max.x - g.boundingBox.min.x;
  return w <= 2 * 58 && f.mesh.material.map.image.width >= 1024;
}));
T.check('les banderoles du balcon Xercès tombent entre deux noms du bandeau (pas de recouvrement)', await ev(() => {
  const P = window.__dbg.W.panneaux, band = P.find((p) => p.nom === 'bandeau Tribune Marek-Xercès');
  const reps = band.mesh.geometry.attributes.uv.array.reduce((m, v, i) => (i % 2 === 0 ? Math.max(m, v) : m), 0); // u de 0 à reps
  const per = 116 / reps, noms = Array.from({ length: reps }, (_, k) => -58 + per * (k + 0.5));
  const haut = P.filter((p) => p.nom.startsWith('banderole') && p.mesh.geometry.boundingBox && p.mesh.geometry.boundingBox.min.y > 5);
  for (const h of haut) { const bb = h.mesh.geometry.boundingBox; for (const u of noms) if (bb.max.x > u - per * 0.29 && bb.min.x < u + per * 0.29) return false; }
  return haut.length === 3 && reps >= 3;
}));

// ---------------- le style « dessin » (par défaut) ----------------
await voir([2, 2.0, -27], 0, -0.15);
await frames(4);
T.check('style « dessin » par défaut : rampe de lumière dans les morceaux de shader, ombres PCF nettes', await ev(() => { const d = window.__dbg; return d.style.STYLE.cel === true && d.style.chunks() && d.renderer.shadowMap.type === 1; }));
T.check('contours à l\'encre dans le post-traitement (qualité Moyenne), lus dans la profondeur de l\'image', await ev(() => { const P = window.__dbg.RENDER.post; return !!P && !!P.rt.depthTexture && P.mComp.uniforms.uInk.value > 0.5 && P.mComp.uniforms.uSat.value > 1.1; }));

// ---------------- les bancs de touche ----------------
await ev(() => window.__dbg.figurants.sauter(2));
const banc = await ev(() => window.__dbg.figurants.etat());
T.check('les bancs : 20 personnes (sept remplaçants, adjoint, préparateur et entraîneur par équipe) et deux commentateurs', banc.bancs === 22, `visibles : ${banc.bancs}`);
T.check('les remplaçants de Lens en veste rouge (manches du maillot), ceux de l\'OM en bleu ciel', banc.tenuesBanc[0] === 0xc8102e && banc.tenuesBanc[10] === 0x2faee0, banc.tenuesBanc.slice(0, 11).map((c) => c.toString(16)).join(' '));
T.check('assis sous leur abri (Lens à x ≈ −10, l\'OM à x ≈ +10), l\'entraîneur debout devant, dans sa zone technique', (() => {
  const P = banc.posesBanc; const assis = (i) => P[i][1] < 0.75, lens = P.slice(0, 9), om = P.slice(10, 19);
  return lens.every((p, i) => assis(i) && p[0] > -14 && p[0] < -6 && p[2] < -38.5) && om.every((p, i) => assis(10 + i) && p[0] > 6 && p[0] < 14) && P[9][1] > 0.9 && P[9][2] > -37.2 && P[9][2] < -35.3 && P[19][1] > 0.9;
})(), JSON.stringify(banc.posesBanc.slice(7, 11)));
await shot('01-bancs');
await voir([-14, 1.7, -33], -0.5, -0.08); await shot('02-banc-lens');
// un but de Lens : le banc se lève
T.check('un but de Lens : son banc se lève, celui de l\'OM reste assis', await ev(() => {
  const d = window.__dbg, M = d.M; M.state = 'celebration'; M.celebrateTeam = 0; M.stateT = 30;
  d.figurants.sauter(0.3);
  const P = d.figurants.etat().posesBanc; return P.slice(0, 7).filter((p) => p[1] > 0.9).length >= 5 && P.slice(10, 17).every((p) => p[1] < 0.75);
}));
await shot('03-but-lens');
await ev(() => { const M = window.__dbg.M; M.state = 'play'; M.celebrateTeam = -1; });

// ---------------- vues du stade ----------------
await voir([-20, 22, -150], Math.PI, 0.02); await shot('04-facade-lepagnot');
await voir([0, 6, 25], Math.PI, 0.1); await shot('06-kop-marek');
await voir([45, 3, -10], Math.PI / 2 + 0.6, 0.12); await shot('07-trannin');
await voir([14, 12.9, -62.5], 0.9, -0.35); await shot('08-commentateurs');
await ev(() => window.__dbg.teleport(0)); await shot('09-compound-nom-du-car');
await ev(() => window.__dbg.teleport(1)); await shot('11-car');

// ---------------- retour au réaliste, puis au dessin ----------------
await ev(() => window.__dbg.teleport(5));
await ev(() => window.__dbg.emit('setStyle', false));
await frames(4);
T.check('style réaliste : morceaux de shader d\'origine, ombres douces, pas d\'encre ; mémorisé', await ev(() => { const d = window.__dbg; let saved = ''; try { saved = localStorage.getItem('carregie.style'); } catch (e) { /* stockage indisponible */ } return !d.style.STYLE.cel && !d.style.chunks() && d.renderer.shadowMap.type === 2 && d.RENDER.post.mComp.uniforms.uInk.value === 0 && saved === 'realiste'; }));
await shot('12-realiste');
await ev(() => window.__dbg.emit('setStyle', true));
await frames(4);
T.check('retour au dessin', await ev(() => window.__dbg.style.STYLE.cel && window.__dbg.style.chunks() && window.__dbg.RENDER.post.mComp.uniforms.uInk.value > 0));
await shot('13-dessin');

// ---------------- qualité Basse : paliers de lumière sans post-traitement ----------------
await ev(() => window.__dbg.emit('setQuality', 'basse'));
await frames(4);
T.check('qualité Basse : le style reste (morceaux de shader), sans post-traitement', await ev(() => window.__dbg.style.chunks() && window.__dbg.S.quality === 'basse'));
await shot('14-basse');

await T.finish();
