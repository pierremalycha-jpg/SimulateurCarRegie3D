// La caméra de plateau en 3D (v18.5) : l'onglet La caméra de l'espace Cours ouvre le module, les
// pastilles et la liste des notions ouvrent une fiche (schéma, manipulation, questions d'Olivier),
// le simulateur reste en pause pendant ce temps, Échap ramène dans le Cours sur le même onglet.
// node tests/e2e/camera.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('camera');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { title: true, fresh: true, errors: T.errors });
await until(A, () => !!document.querySelector('#title.ready'), null, 180000);
const ev = (f, a) => A.evaluate(f, a);

// ---------------- depuis le titre : Cours, onglet La caméra ----------------
await A.click('#ti-cours'); await A.waitForTimeout(500);
T.check('Cours : l\'onglet La caméra est là, et la carte sur la page des leçons', await ev(() => !!document.querySelector('#layer.ly-cours .ly-tabs .tab[data-k="camera"]') && [...document.querySelectorAll('#layer .co-card b')].some((b) => b.textContent === 'La caméra')));
await A.click('#layer .ly-tabs .tab[data-k="camera"]'); await A.waitForTimeout(300);
T.check('onglet La caméra : la présentation et le bouton', await ev(() => !!document.querySelector('#layer .co-camera') && !!document.querySelector('#layer .co-camera .btn.primary')));
await A.screenshot({ path: `${OUT}/01-onglet.png` });
await A.click('#layer .co-camera .btn.primary');
await until(A, () => window.__dbg.camlab() && !document.querySelector('.camlab .cl-loading') && !document.querySelector('.camlab').hidden, null, 120000);
await A.waitForTimeout(1500);
T.check('le module s\'ouvre plein écran, l\'espace Cours s\'est refermé, le titre est caché', await ev(() => !document.getElementById('layer') && document.getElementById('title').hidden && document.body.classList.contains('camlab-on')));
const pins = await ev(() => document.querySelectorAll('.camlab .cl-pin').length);
T.check('les pastilles de la caméra (23)', pins === 23, String(pins));
T.check('la liste des notions : 9 chapitres, 51 notions, 12 écrites', await ev(() => document.querySelectorAll('.camlab .cl-ch').length === 9 && document.querySelectorAll('.camlab .cl-ni').length === 51 && document.querySelectorAll('.camlab .cl-ni:not(.prevu)').length === 12));
await A.screenshot({ path: `${OUT}/02-camera.png` });

// ---------------- une fiche écrite : schéma, manipulation, textes, questions ----------------
for (const id of ['iris', 'menu', 'connectique']) {
  await ev((id) => document.querySelector(`.cl-ni[data-n="${id}"]`).click(), id); await A.waitForTimeout(1200);
  const st = await ev(() => ({ fig: !!document.querySelector('.camlab .cl-side .cl-fig svg'), lab: document.querySelectorAll('.camlab .cl-side .cl-lab *').length, sec: document.querySelectorAll('.camlab .cl-side .cl-sec').length, q: document.querySelectorAll('.camlab .cl-side .cl-q').length, defis: document.querySelectorAll('.camlab .cl-side .cl-defis li').length }));
  T.check(`fiche ${id} : schéma, manipulation à trois défis, sections, trois questions`, st.fig && st.lab > 10 && st.sec >= 5 && st.q === 3 && st.defis === 3, JSON.stringify(st));
  // une bonne réponse et une mauvaise : chacune expliquée
  await ev(() => { const q = document.querySelector('.camlab .cl-side .cl-q + .cl-opts'); if (q) /** @type {HTMLButtonElement} */ (q.querySelector('.cl-opt')).click(); });
  await A.waitForTimeout(200);
  T.check(`fiche ${id} : la réponse choisie est expliquée`, await ev(() => { const w = document.querySelector('.camlab .cl-side .cl-why'); return !!w && w.textContent.length > 20 && !!document.querySelector('.camlab .cl-side .cl-opt.chosen'); }));
  const side = await A.$('.camlab .cl-side'); if (side) await side.screenshot({ path: `${OUT}/10-${id}.png` }).catch(() => {});
}
// une fiche en préparation : l'annonce, pas de manipulation
await ev(() => document.querySelector('.cl-ni[data-n="gain"]').click()); await A.waitForTimeout(600);
T.check('fiche en préparation : l\'annonce du lot, pas de manipulation', await ev(() => !!document.querySelector('.camlab .cl-side .cl-todo') && !document.querySelector('.camlab .cl-side .cl-lab')));
// la manipulation pilote la caméra 3D : la bague de zoom suit le curseur
await ev(() => document.querySelector('.cl-ni[data-n="focale"]').click()); await A.waitForTimeout(1200);
const z0 = await ev(() => window.__dbg.camlab().rig.state.zoom);
await ev(() => { const r = document.querySelector('.camlab .cl-side .cl-lab input[type=range]'); r.value = '0.9'; r.dispatchEvent(new Event('input', { bubbles: true })); });
await A.waitForTimeout(400);
const z1 = await ev(() => window.__dbg.camlab().rig.state.zoom);
T.check('la manipulation déplace la bague de zoom de la caméra 3D', z1 > z0 + 0.3, `${z0} → ${z1}`);

// ---------------- le simulateur est en pause, Échap revient au Cours ----------------
T.check('les touches du simulateur sont ignorées pendant le module', await ev(() => { const before = window.__dbg.S.mode; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })); return !document.getElementById('layer') && window.__dbg.S.mode === before; }));
await A.keyboard.press('Escape'); await A.waitForTimeout(300); // referme la fiche
await A.keyboard.press('Escape'); await A.waitForTimeout(600); // quitte le module
T.check('Échap : retour dans le Cours, onglet La caméra, écran titre visible', await ev(() => !document.body.classList.contains('camlab-on') && !!document.querySelector('#layer.ly-cours .ly-tabs .tab.on[data-k="camera"]') && !document.getElementById('title').hidden));
await A.screenshot({ path: `${OUT}/03-retour.png` });
await A.keyboard.press('Escape'); await A.waitForTimeout(300);
T.check('fermeture du Cours : le titre reprend le focus', await ev(() => !document.getElementById('layer') && document.activeElement?.id === 'ti-cours'));

await browser.close();
await T.finish();
