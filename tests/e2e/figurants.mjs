// La vie autour du car (v19.20) : l'équipe à ses postes (on la voit assise ; à son poste, le titulaire laisse sa
// place et revient quand on part), le poste choisi dans Jouer, les techniciens du compound qui entrent dans le car et en
// ressortent sans traverser les bureaux ni les véhicules, la sécurité ; les câbles caméra au sol jusqu'au pied de car ;
// l'adversaire tiré au sort ou choisi, ses couleurs sur les joueurs. Car vide : personne aux postes.
// node tests/e2e/figurants.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('figurants');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { errors: T.errors });
const ev = (f, a) => A.evaluate(f, a);
const frames = async (n = 3) => { const f0 = await ev(() => window.__dbg.S.frame); await until(A, (f) => window.__dbg.S.frame > f, f0 + n, 60000); };
const shot = async (n) => { await frames(); await A.screenshot({ path: `${OUT}/${n}.png` }); };
const voir = (p, yaw, pitch, truck) => ev(([p, yaw, pitch, truck]) => { const d = window.__dbg; d.PL.fly = false; d.S.inTruck = truck; d.PL.pos.set(p[0], p[1], p[2]); d.PL.y = p[1] + 1.7; d.PL.yaw = d.PL.cyaw = yaw; d.PL.pitch = d.PL.cpitch = pitch; d.PL.vel.set(0, 0, 0); }, [p, yaw, pitch, truck]);

// ---------------- Jouer : l'adversaire et le poste ----------------
await A.click('.jo-mode[data-mode="installe"]'); await A.waitForTimeout(300);
T.check('Jouer, car pré-installé : l\'adversaire (tiré au sort ou un club de Ligue 1) et le poste de départ', await ev(() => {
  const adv = document.getElementById('st-adversaire'), poste = document.getElementById('st-poste');
  return !!adv && !!poste && adv.options.length >= 16 && adv.options[0].value === 'hasard' && [...adv.options].some((o) => o.value === 'psg') && [...adv.options].some((o) => o.value === 'om') && poste.options.length >= 9 && poste.options[0].value === 'libre';
}));
await A.selectOption('#st-adversaire', 'om');
T.check('l\'affiche du soir suit le choix', await ev(() => /RC Lens – Marseille/.test(document.querySelector('.dk-match').textContent)));
await A.selectOption('#st-poste', 'son');
await A.click('[data-emission="non"]'); await A.waitForTimeout(200);
await A.screenshot({ path: `${OUT}/01-jouer.png`, fullPage: true });
await A.click('#st-antenne');
T.check('la partie commence assis au poste choisi (le son)', await until(A, () => window.__dbg.S.mode === 'station' && window.__dbg.S.station === 'son', null, 120000));
T.check('l\'adversaire choisi : l\'OM, un match neuf (score à zéro, tirage du match)', await ev(() => { const d = window.__dbg; return d.M.tirage && d.M.score.join('-') === '0-0' && document.querySelector('#hud') && /OM/.test(document.body.textContent); }));
await ev(() => window.__dbg.figurants.sauter(6));
T.check('à son poste, le titulaire (Thomas) a laissé sa place ; le reste de l\'équipe est assis', await ev(() => {
  const E = window.__dbg.figurants.etat().equipe;
  const son = E.find((q) => q.id === 'son'), autres = E.filter((q) => q.id !== 'son');
  return E.length === 12 && son.occupe && son.s >= son.L - 0.01 && autres.every((q) => !q.occupe && q.s === 0 && q.assis === 1 && q.visible);
}));
await shot('02-au-son');

// ---------------- le titulaire revient quand on part ----------------
await ev(() => window.__dbg.closeStation());
await until(A, () => window.__dbg.S.mode === 'fps', null, 30000);
await ev(() => window.__dbg.figurants.sauter(8));
T.check('on quitte le poste : Thomas revient s\'asseoir', await ev(() => { const q = window.__dbg.figurants.etat().equipe.find((x) => x.id === 'son'); return !q.occupe && q.s === 0 && q.assis === 1; }));
await voir([-21, 1.2, -118.0], 0.12, -0.2, true); await shot('03-production');
await voir([-15.5, 1.2, -118.0], -0.1, -0.2, true); await shot('04-vision');

// ---------------- les chemins : ni bureaux ni véhicules traversés ----------------
const bloque = await ev(async () => {
  const d = window.__dbg, bad = [];
  const { EQUIPE } = window.__dbg.figurants.modules, { MARCHEURS } = window.__dbg.figurants.modules;
  const tcx = d.TRUCK.cx, tcz = d.TRUCK.cz;
  const seg = (a, b, f, nom) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05); for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; if (f(x, z)) { bad.push(`${nom} (${x.toFixed(2)}, ${z.toFixed(2)})`); return; } } };
  for (const e of EQUIPE) { const ch = e.chemin.map(([lx, lz]) => [tcx + lx, tcz + lz]); for (let k = 2; k < ch.length; k++) seg(ch[k - 1], ch[k], d.truckBlocked, e.id); }
  const dedans = (x, z) => x > d.TRUCK.x0 && x < d.TRUCK.x1 && z > d.TRUCK.z0 && z < d.TRUCK.z1;
  for (const m of MARCHEURS) {
    const pts = m.etapes.filter((x) => 'vers' in x).map((x) => x.vers);
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      if (dedans(a[0], a[1]) && dedans(b[0], b[1])) seg(a, b, d.truckBlocked, m.id + ' (dans le car)');
      else seg(a, b, (x, z) => !dedans(x, z) && !(x > d.TRUCK.doorX0 - 0.4 && x < d.TRUCK.doorX1 + 0.4 && z > d.TRUCK.z1 - 0.2 && z < d.TRUCK.z1 + 2.2) && d.W.obstacles.some((o) => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1), m.id);
    }
  }
  return bad;
});
T.check('l\'équipe et les techniciens passent par l\'allée et le passage entre les bureaux, autour des véhicules', bloque.length === 0, bloque.slice(0, 4).join(' · '));

// ---------------- le compound : des techniciens qui entrent et sortent, la sécurité ----------------
const vus = { dedans: new Set(), dehors: new Set() };
for (let k = 0; k < 12; k++) {
  await ev(() => window.__dbg.figurants.sauter(10));
  const M = await ev(() => window.__dbg.figurants.etat().marcheurs);
  for (const m of M) (m.dedans ? vus.dedans : vus.dehors).add(m.id);
}
T.check('des techniciens entrent dans le car et en ressortent', [...vus.dedans].filter((id) => vus.dehors.has(id)).length >= 3, [...vus.dedans].join(', '));
T.check('les agents de sécurité restent au compound', ['securite-portail', 'securite-ronde', 'securite-entree'].every((id) => vus.dehors.has(id) && !vus.dedans.has(id)));
await voir([-13, 0, -107.5], 0.25, -0.05, false); await shot('05-compound');
await voir([0, 0, -112], Math.PI, 0, false); await shot('06-portail');

// ---------------- les câbles caméra : au sol, à la verticale au pied du car ----------------
const cables = await ev(() => {
  const out = [];
  for (const c of window.__dbg.S.cams) {
    if (!c.cable) continue;
    const p = c.cable.geometry.attributes.position, n = p.count;
    if (n < 4) continue;
    const [x1, y1, x2, y2, z2] = [p.getX(n - 2), p.getY(n - 2), p.getX(n - 1), p.getY(n - 1), p.getZ(n - 1)];
    // le dernier tronçon monte à la verticale contre la paroi ; le précédent est posé au sol
    out.push({ id: c.id, vertical: Math.abs(x1 - x2) < 1e-3 && y2 - y1 > 0.5, auSol: p.getY(n - 3) < 0.3 && y1 < 0.3, paroi: Math.abs(z2 - (window.__dbg.TRUCK.z1 + 0.18)) < 0.05 });
  }
  return out;
});
T.check('les câbles caméra arrivent au sol puis montent à la verticale jusqu\'au panneau (plus de fils en l\'air)', cables.length >= 8 && cables.every((c) => c.vertical && c.auSol && c.paroi), JSON.stringify(cables.filter((c) => !(c.vertical && c.auSol && c.paroi)).slice(0, 2)));
await voir([-11, 0, -111], 0.6, -0.2, false); await shot('07-pied-de-car');

// ---------------- car vide : personne aux postes ----------------
const B = await openPage(browser, { errors: T.errors, id: 'vide' });
await B.evaluate(() => window.__dbg.start('zero', 'jour', 'basse', false));
await until(B, () => window.__dbg.S.mode === 'fps', null, 120000);
await B.evaluate(() => window.__dbg.figurants.sauter(1));
T.check('car vide : l\'équipe n\'est pas encore là, les techniciens du compound oui', await B.evaluate(() => { const s = window.__dbg.figurants.etat(); return !s.present && s.equipe.every((q) => !q.visible) && s.marcheurs.some((m) => m.visibleW); }));

await T.finish();
