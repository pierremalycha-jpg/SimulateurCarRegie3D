// Chef de car : appel (touche J, boutons), parcours « Mettre en service une leaf neuve » mené en
// partie à la main (navigation, saisie dans le terminal), en partie avec « Fais-le pour moi »,
// surbrillance de l'élément à utiliser, passage SDI → IP, présentation d'un poste, mobile.
// node tests/e2e/chef.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('chef');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { viewport: { width: 1440, height: 900 }, errors: T.errors });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); T.log('shot', n); };
const stepTitle = () => ev(() => document.querySelector('#chef .chef-step')?.textContent || '');
const clickChef = async (text) => { await page.locator('#chef button', { hasText: text }).first().click(); await page.waitForTimeout(250); };
// quitter un parcours : s'il propose de remettre en état, la confirmation est dans la page
const quitLesson = async () => { await clickChef('Quitter le parcours'); if (await until(page, () => !!document.querySelector('#ask'), null, 1500)) await page.locator('#ask [data-ask="ok"]').click(); await page.waitForTimeout(250); };
const waitDone = (ms = 30000) => until(page, () => window.__dbg.TUTOR.done, null, ms);

// ---- démarrage en SDI : le chef propose de passer en IP ----
await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', false); });
T.check('partie lancée', await until(page, () => window.__dbg.S.mode === 'fps'));
await page.keyboard.press('KeyJ');
T.check('touche J : le chef apparaît', await until(page, () => !document.querySelector('#chef').hidden, null, 5000));
T.check('accueil : parcours réseau listés', await ev(() => /Mettre en service une leaf neuve/.test(document.querySelector('#chef').textContent)));
T.check('car SDI : proposition de passer en IP', await ev(() => [...document.querySelectorAll('#chef button')].some((b) => /Passer le car en IP/.test(b.textContent))));
await shot('01-accueil-sdi');
await clickChef('Passer le car en IP');
T.check('passage en IP : confirmation dans la page (pas de boîte du navigateur)', await until(page, () => !!document.querySelector('#ask [data-ask="ok"]'), null, 5000));
await page.locator('#ask [data-ask="ok"]').click();
T.check('car passé en IP', await until(page, () => window.__dbg.S.ipMode && !!window.__dbg.FAB.res, null, 10000));

// ---- parcours « leaf neuve » ----
await page.locator('#chef .chef-card', { hasText: 'Mettre en service une leaf neuve' }).locator('button').click();
T.check('parcours commencé', await until(page, () => window.__dbg.TUTOR.lesson && window.__dbg.TUTOR.lesson.id === 'reseau-leaf', null, 5000));
await shot('02-intro');
await clickChef('Suivant'); // intro
T.check('leaf remplacée (configuration usine)', await ev(() => window.__dbg.FAB.switches['LEAF-R1'].running.hostname === 'localhost'));
await clickChef('Suivant'); // swap
T.check('étape « Ouvrir le poste »', /poste Réseau IP/.test(await stepTitle()), await stepTitle());
await clickChef('Emmène-moi');
T.check('« Emmène-moi » ouvre le poste Réseau IP', await until(page, () => window.__dbg.S.station === 'reseau', null, 20000));
T.check('étape validée', await waitDone());
await shot('03-poste-ouvert');
await clickChef('Suivant');
// choisir le commutateur : la surbrillance indique l'onglet puis le bouton
T.check('surbrillance visible', await until(page, () => !document.querySelector('#chef-spot').hidden, null, 8000));
await page.locator('#station .tabs .tab[data-k="switch"]').click(); await page.waitForTimeout(400);
await page.locator('#station .net-swbtn[data-sw="LEAF-R1"]').click();
T.check('commutateur choisi à la souris', await waitDone());
await shot('04-commutateur');
await clickChef('Suivant');
await page.locator('#station .net-swmain .tabs .tab[data-sub="term"]').click();
T.check('terminal ouvert', await waitDone());
await clickChef('Suivant');
// LLDP : clic sur la commande dans le panneau, puis Entrée dans le terminal
await page.locator('#chef .chef-cmd').first().click(); await page.waitForTimeout(300);
T.check('la commande va dans le terminal', await ev(() => document.querySelector('#station .net-cmd')?.value === 'show lldp neighbors'));
await page.locator('#station .net-cmd').press('Enter');
T.check('show lldp neighbors validé', await waitDone());
await shot('05-lldp');
await clickChef('Suivant');
// nom : saisie complète à la main
await page.locator('#station .net-cmd').fill('conf t'); await page.locator('#station .net-cmd').press('Enter');
await page.locator('#station .net-cmd').fill('hostname leaf-r1-cam'); await page.locator('#station .net-cmd').press('Enter');
T.check('hostname tapé à la main', await waitDone());
T.check('le chef commente le résultat', await until(page, () => /Bien joué/i.test(document.querySelector('#chef').textContent), null, 5000));
await shot('06-hostname');
await clickChef('Suivant');
// le reste avec « Fais-le pour moi », étape par étape
let guard = 0, ok = true;
while (guard++ < 40) {
  const st = await ev(() => { const T = window.__dbg.TUTOR; return T.lesson ? { id: T.lesson.steps[T.i].id, quiz: !!T.lesson.steps[T.i].quiz, act: !!(T.lesson.steps[T.i].done) } : null; });
  if (!st) break;
  if (st.quiz) { await page.locator('#chef .chef-choice', { hasText: '2022-7' }).click(); }
  else if (st.act) { await clickChef('Fais-le pour moi'); }
  const done = await waitDone(40000);
  if (!done) { ok = false; T.log('bloqué sur', st.id); break; }
  if (st.id === 'flows') await shot('07-flux-proteges');
  await clickChef(await ev(() => { const T = window.__dbg.TUTOR; return T.i >= T.lesson.steps.length - 1 ? 'Terminer' : 'Suivant'; }));
}
T.check('parcours mené jusqu\'au bout', ok && await ev(() => window.__dbg.TUTOR.lesson === null));
T.check('écran de fin', await until(page, () => /terminé/.test(document.querySelector('#chef').textContent), null, 5000));
T.check('leaf de nouveau saine et enregistrée', await ev(() => { const F = window.__dbg.FAB; const sw = F.switches['LEAF-R1']; return !F.issues.some((i) => i.sw === 'LEAF-R1' && i.sev !== 'info') && JSON.stringify(sw.running) === JSON.stringify(sw.startup); }));
T.check('progression enregistrée', await ev(() => !!(window.__dbg.PROG.tutor && window.__dbg.PROG.tutor['reseau-leaf'] && window.__dbg.PROG.tutor['reseau-leaf'].done)));
await shot('08-fin');

// ---- visite : un vrai clic sur une spine du schéma ----
await ev(() => window.__dbg.startChefLesson('reseau-visite'));
await page.waitForTimeout(300);
T.check('visite : l\'étape « poste » est sautée (déjà au poste)', await ev(() => window.__dbg.TUTOR.lesson.steps[window.__dbg.TUTOR.i].id === 'intro'));
await clickChef('Suivant'); // intro → (poste sauté) → topologie
T.check('visite : étape Topologie', await ev(() => window.__dbg.TUTOR.lesson.steps[window.__dbg.TUTOR.i].id === 'topo'), await stepTitle());
await page.locator('#station .tabs .tab[data-k="topo"]').click();
T.check('onglet Topologie ouvert', await waitDone());
await clickChef('Suivant');
await page.locator('#station [data-tut="sw:spine"]').first().click();
T.check('clic sur une spine du schéma reconnu', await waitDone());
await shot('08b-visite-spine');
await quitLesson();
// ---- PTP : la case du grand maître 1 ----
await ev(() => { window.__dbg.startChefLesson('reseau-ptp'); });
for (let k = 0; k < 4; k++) await ev(() => window.__dbg.chefNext());
await ev(() => window.__dbg.toggleChef(true)); await page.waitForTimeout(300);
T.check('PTP : étape « Couper le grand maître 1 »', await ev(() => window.__dbg.TUTOR.lesson.steps[window.__dbg.TUTOR.i].id === 'cut'), await stepTitle());
await clickChef(/Montre-moi|Emmène-moi/);
await page.locator('#station [data-tut="gm1-up"] input').click();
T.check('grand maître 1 coupé : le 2 est élu', await waitDone());
T.check('les caméras restent verrouillées', await ev(() => window.__dbg.S.cams.every((c) => c.genlock !== false)));
await shot('08c-ptp-bascule');
await clickChef('Suivant');
await page.locator('#station [data-tut="gm1-up"] input').click();
T.check('grand maître 1 remis en service et réélu', await waitDone());
await quitLesson();

// ---- présentation d'un poste : le mélangeur ----
await clickChef('Fermer');
await ev(() => window.__dbg.openStation('melangeur')); await page.waitForTimeout(800);
await page.locator('#station .chef-btn').click();
T.check('bouton du poste : le chef propose ce poste', await until(page, () => /Ici, au poste/.test(document.querySelector('#chef').textContent), null, 5000));
await page.locator('#chef .chef-card', { hasText: 'Présente-moi' }).first().locator('button').click();
T.check('présentation : rôle du poste', await until(page, () => window.__dbg.TUTOR.lesson && window.__dbg.TUTOR.lesson.id === 'poste-melangeur', null, 5000));
await shot('09-presentation-poste');
await quitLesson();

// ---- mobile ----
await page.close();
// un navigateur à part : dans le même, le rendu logiciel de la première page affamerait la seconde
const m = await openPage(await launch(), { viewport: { width: 400, height: 820 }, mobile: true, errors: T.errors });
await m.evaluate(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', true); });
await until(m, () => window.__dbg.S.mode === 'fps');
await m.evaluate(() => window.__dbg.toggleChef(true)); await m.waitForTimeout(600);
const box = await m.evaluate(() => { const r = document.querySelector('#chef').getBoundingClientRect(); return [r.left, r.right, document.documentElement.scrollWidth]; });
T.check('mobile : panneau en bas, pleine largeur, sans débordement', box[0] === 0 && box[1] <= 400 && box[2] <= 400, JSON.stringify(box));
await m.screenshot({ path: `${OUT}/10-mobile.png`, timeout: 180000 });
await T.finish();
