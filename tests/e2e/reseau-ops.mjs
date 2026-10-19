// Poste Réseau IP, onglet Exploitation (interface d'un contrôleur et des appareils) : connexion NMOS,
// paramètres de transport saisis à la main (faux puis justes), moniteurs source / destination,
// sortie d'usine puis remise en service d'une passerelle, supervision PTP et NMOS, retour à
// l'onglet Technique.
// node tests/e2e/reseau-ops.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('reseau-ops');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { viewport: { width: 1440, height: 900 }, errors: T.errors, before: (p) => p.on('dialog', (d) => d.accept()) });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); T.log('shot', n); };
const click = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(300); };
const rx = (id) => ev((i) => { const s = window.__dbg.FAB.res.rxState[i]; return s ? { ok: s.ok, prot: s.protected, flow: s.flow, manual: !!s.manual, red: s.per.red.reason || '', blue: s.per.blue.reason || '' } : null; }, id);

await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', true); });
T.check('partie lancée en car IP', await until(page, () => window.__dbg.S.mode === 'fps' && window.__dbg.S.ipMode && !!window.__dbg.FAB.res));
await ev(() => window.__dbg.openStation('reseau'));
T.check('deux onglets : Technique et Exploitation', await until(page, () => document.querySelectorAll('#station .net-mode').length === 2, null, 20000));
T.check('Technique par défaut, sous-onglets visibles', await ev(() => document.querySelector('#station .net-mode.on').dataset.mode === 'tech' && !!document.querySelector('#station .tabs .tab[data-k="switch"]').offsetParent));
T.check('bandeau d\'état sur une ligne', await ev(() => { const b = document.querySelector('#station .net-sum'); return b.children.length >= 6 && b.getBoundingClientRect().height < 60; }));
await shot('01-technique');

// ---- Exploitation : connexion NMOS ----
await click('#station .net-mode[data-mode="ops"]');
T.check('Exploitation : navigation et moniteurs source / destination', await until(page, () => !!document.querySelector('#station .ops-nav') && !!document.querySelector('#station .st-dock [data-gl^="TX:"]') && !!document.querySelector('#station .st-dock [data-gl^="RX:"]'), null, 10000));
T.check('sous-onglets techniques masqués', await ev(() => document.querySelector('#station .net-tabs').hidden));
await click('#station [data-dst="AUX_GIANT"]');
await click('#station [data-src="v:CAM2"]');
T.check('moniteurs sur CAM 2 → écran géant', await ev(() => document.querySelector('#station [data-gl^="TX:"]').dataset.gl === 'TX:v:CAM2' && document.querySelector('#station [data-gl^="RX:"]').dataset.gl === 'RX:AUX_GIANT'));
await click('#station .ops-seg [data-mode="nmos"]');
await click('#station [data-act="connect"]');
T.check('connexion IS-05 : la grille et le réseau suivent', await until(page, () => window.__dbg.ROUTER.map.AUX_GIANT === 'CAM2' && window.__dbg.FAB.res.rxState.AUX_GIANT.flow === 'v:CAM2' && window.__dbg.FAB.res.rxState.AUX_GIANT.protected, null, 10000));
T.check('état affiché : reçu rouge + bleu', await until(page, () => /rouge \+ bleu/.test(document.querySelector('#station .ops-status').textContent), null, 8000));
await shot('02-connexion-nmos');

// ---- saisie manuelle : CAM 4, d'abord avec une erreur de source ----
const cam4 = await ev(() => { const F = window.__dbg.FAB; const f = F.flows['v:CAM4']; const d = F.devices[f.dev]; return { r: [d.nics.red.ip, f.groups.red], b: [d.nics.blue.ip, f.groups.blue] }; });
await click('#station [data-src="v:CAM4"]');
await click('#station .ops-seg [data-mode="manual"]');
const fill = async (leg, v) => { const i = page.locator(`#station input[data-leg="${leg}"]`); await i.fill(String(v)); };
await fill('red:src', '10.1.1.250'); await fill('red:group', cam4.r[1]); await fill('red:port', 5004);
await fill('blue:src', cam4.b[0]); await fill('blue:group', cam4.b[1]); await fill('blue:port', 5004);
await click('#station [data-act="apply-rx"]');
let s = await rx('AUX_GIANT');
T.check('source fausse : filtre SSM sur le rouge, le bleu passe seul', s && s.manual && s.ok && !s.prot && /filtre de source SSM/.test(s.red), JSON.stringify(s));
T.check('l\'écran géant montre CAM 4 (adresses saisies)', await ev(() => window.__dbg.FAB.res.rxState.AUX_GIANT.flow === 'v:CAM4'));
await shot('03-manuel-erreur');
await fill('red:src', cam4.r[0]);
await click('#station [data-act="apply-rx"]');
s = await rx('AUX_GIANT');
T.check('adresses justes : protégé 2022-7', s && s.ok && s.prot && s.flow === 'v:CAM4', JSON.stringify(s));
await fill('red:port', 5006); await fill('blue:group', '239.2.9.9');
await click('#station [data-act="apply-rx"]');
s = await rx('AUX_GIANT');
T.check('mauvais port et groupe vide : rien n\'arrive, causes expliquées', s && !s.ok && /port UDP 5006/.test(s.red) && /aucun émetteur/.test(s.blue), JSON.stringify(s));
T.check('moniteur destination : voyant rouge « rien reçu »', await ev(() => { const l = document.querySelector('#station .ops-mon .ops-led'); return /rien reçu/.test(l.textContent) && l.classList.contains('err'); }));
await shot('04-manuel-rien');

// ---- appareils : sortie d'usine puis remise en service ----
await click('#station .ops-navbtn[data-ops="dev"]');
await click('#station [data-dev="gwstade"]');
T.check('page de l\'appareil : interfaces, contrôle, PTP', await ev(() => ['red:ip', 'blue:ip', 'ctl:ip', 'nmos:reg', 'ptp:domain'].every((k) => document.querySelector(`#station [data-f="${k}"]`))));
await shot('05-appareil');
await click('#station [data-act="factory"]');
T.check('sortie d\'usine : plus joignable, pas enregistré, PTP non verrouillé', await until(page, () => { const R = window.__dbg.FAB.res; return !R.nic['gwstade:red'].reach && !R.reg.gwstade && R.devPtp.gwstade.state !== 'locked'; }, null, 8000));
const set = async (k, v) => { await page.locator(`#station [data-f="${k}"]`).fill(String(v)); };
await set('red:ip', '10.1.6.25'); await set('red:gw', '10.1.6.1');
await set('blue:ip', '10.2.6.25'); await set('blue:gw', '10.2.6.1');
await set('ctl:ip', '10.20.0.60'); await set('ctl:mask', 22); await set('ctl:gw', '10.20.0.1'); await set('nmos:reg', '10.20.0.10');
await set('ptp:domain', 127);
await click('#station [data-act="apply-dev"]');
T.check('remise en service : média A et B, NMOS, PTP verrouillé', await until(page, () => { const R = window.__dbg.FAB.res; return R.nic['gwstade:red'].reach && R.nic['gwstade:blue'].reach && R.reg.gwstade && R.devPtp.gwstade.state === 'locked'; }, null, 8000));
await shot('06-appareil-reconfigure');

// ---- supervision ----
await click('#station .ops-navbtn[data-ops="ptp"]');
T.check('PTP : grand maître et tableau des appareils', await ev(() => /Grand maître 1/.test(document.querySelector('#station .ops-main').textContent) && document.querySelectorAll('#station [data-ptpdev]').length > 10));
await page.waitForTimeout(1500);
await shot('07-ptp');
await click('#station .ops-navbtn[data-ops="nmos"]');
T.check('NMOS : registre et nœuds', await ev(() => /10\.20\.0\.10/.test(document.querySelector('#station .ops-main').textContent) && document.querySelectorAll('#station [data-node]').length > 10));
await shot('08-nmos');

// ---- retour à Technique ----
await click('#station .net-mode[data-mode="tech"]');
T.check('retour à Technique : sous-onglets et multiview', await until(page, () => !document.querySelector('#station .net-tabs').hidden && !!document.querySelector('#station .st-dock [data-gl="mv"]'), null, 8000));
await click('#station .tabs .tab[data-k="flows"]');
T.check('onglet Flux : l\'écran géant en saisie manuelle est signalé', await ev(() => !!document.querySelector('#station [data-rx="AUX_GIANT"]')));

// ---- chef de car : « Mettre en service une passerelle », depuis l'onglet Technique ----
await ev(() => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson('reseau-passerelle'); });
T.check('parcours passerelle commencé, appareil en sortie d\'usine', await until(page, () => window.__dbg.TUTOR.lesson && window.__dbg.TUTOR.lesson.id === 'reseau-passerelle' && !window.__dbg.FAB.res.reg.gwstade, null, 8000));
await ev(() => window.__dbg.chefNext()); await page.waitForTimeout(400);
T.check('depuis Technique, le chef désigne l\'onglet Exploitation', await until(page, () => { const sp = document.querySelector('#chef-spot'); return sp && !sp.hidden && /Exploitation/.test(sp.textContent); }, null, 6000));
await page.locator('#chef button', { hasText: 'Emmène-moi' }).first().click();
T.check('« Emmène-moi » ouvre la passerelle dans Appareils', await until(page, () => window.__dbg.TUTOR.done && !!document.querySelector('#station [data-dev="gwstade"].on'), null, 8000));
const ids = [];
for (let i = 0; i < 14; i++) {
  const st = await ev(() => { const T = window.__dbg.TUTOR; const s = T.lesson && T.lesson.steps[T.i]; return s ? { id: s.id, done: T.done, quiz: !!s.quiz } : null; });
  if (!st) break;
  ids.push(st.id);
  if (st.quiz) { await page.locator('#chef .chef-choice').nth(1).click(); await page.waitForTimeout(300); }
  else if (!st.done) { await ev(() => window.__dbg.chefDoForMe()); await page.waitForTimeout(500); }
  if (st.id === 'mediaB') await shot('09-chef-passerelle');
  if (st.id === 'manual') await shot('10-chef-abonnement');
  if (!(await until(page, () => window.__dbg.TUTOR.done, null, 8000))) { T.check('étape ' + st.id + ' validée', false); break; }
  await ev(() => window.__dbg.chefNext()); await page.waitForTimeout(300);
}
T.check('parcours terminé', await ev(() => !window.__dbg.TUTOR.lesson && !!window.__dbg.PROG.tutor['reseau-passerelle']?.done), ids.join(' → '));
T.check('passerelle en service : NMOS, PTP, écran géant protégé', await ev(() => { const R = window.__dbg.FAB.res; return R.reg.gwstade && R.devPtp.gwstade.state === 'locked' && R.rxState.AUX_GIANT.ok && R.rxState.AUX_GIANT.protected && !window.__dbg.FAB.rxManual.AUX_GIANT; }));
await T.finish();
