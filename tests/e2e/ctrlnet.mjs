// Réseau de contrôle du car SDI (poste « Réseau » en SDI) : onglets, fiche d'une machine modifiable
// avec validation, port de switch, ping et balayage, quatre pannes injectées puis réparées par
// l'interface, QoS d'un lien saturé, onglet Formation et fiches « ? », parcours du chef de car
// (« Emmène-moi / Montre-moi » et « Fais-le pour moi »), affichage au téléphone.
// node tests/e2e/ctrlnet.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('ctrlnet');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { viewport: { width: 1280, height: 800 }, errors: T.errors });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); T.log('shot', n); };
const tab = async (k) => { await page.locator(`#station .cn-tabs .tab[data-k="${k}"]`).click(); await until(page, (x) => window.__dbg.CTRL && window.__dbg.CTRL.CN.view.tab === x && !!document.querySelector('#station .cn-tabs .tab.on[data-k="' + x + '"]'), k, 8000); };
const fn = (k) => ev((x) => window.__dbg.CTRL.ctrlFunc(x).state, k);
const lvl = (id) => ev((x) => window.__dbg.CTRL.devState(x).level, id);

await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', false); });
T.check('partie lancée (car SDI)', await until(page, () => window.__dbg.S.mode === 'fps' && !window.__dbg.S.ipMode, null, 90000));
await ev(() => window.__dbg.openStation('reseau'));
T.check('poste ouvert : réseau de contrôle, six onglets', await until(page, () => document.querySelectorAll('#station .cn-tabs .tab').length === 6 && /Réseau de contrôle/.test(document.querySelector('#station .st-head h2').textContent), null, 30000));
T.check('le car SDI n\'affiche pas le réseau ST 2110', await ev(() => !document.querySelector('#station .net-mode')));
const topo = await ev(() => ({ faces: document.querySelectorAll('#station .cn-face').length, chips: document.querySelectorAll('#station .cn-chip').length, devs: window.__dbg.CTRL.DEVS.filter((d) => d.kind !== 'switch').length, ok: window.__dbg.CTRL.evaluate().err }));
T.check('topologie : trois switchs, une pastille par machine, tout en état', topo.faces === 3 && topo.chips === topo.devs && topo.ok === 0, JSON.stringify(topo));
await shot('01-topologie');

// ---------------- fiche d'une machine ----------------
await page.locator('#station .cn-chip[data-dev="rcp3"]').click();
T.check('pastille → fiche du RCP 3', await until(page, () => window.__dbg.CTRL.CN.view.tab === 'machines' && !!document.querySelector('#station .cn-form[data-dev="rcp3"]'), null, 8000));
const mask = page.locator('#station .cn-form [data-f="mask"]');
await mask.fill('255.255.255.240');
T.check('saisie : message en direct sous le masque', await until(page, () => /\/28/.test(document.querySelector('#station .cn-field[data-field="mask"] .cn-msg').textContent), null, 4000));
await page.locator('#station .cn-apply').click();
T.check('masque /28 appliqué : le RCP 3 perd sa CCU', await until(page, () => window.__dbg.CTRL.ctrlCam(3).ok === false, null, 6000) && (await lvl('rcp3')) === 'err');
T.check('le poste le signale (bandeau des fonctions touchées)', await until(page, () => [...document.querySelectorAll('#station .cn-alarm')].some((a) => /RCP 3/.test(a.textContent)), null, 6000));
T.check('l\'ingénieur vision le signale à l\'intercom', await until(page, () => [...document.querySelectorAll('#intercom .icm')].some((d) => /VISION/.test(d.textContent) && /caméra 3/.test(d.textContent)), null, 6000));
await shot('02-fiche-masque');
await page.locator('#station .cn-planbtn').click();
await page.locator('#station .cn-apply').click();
T.check('« Valeurs du plan » puis Appliquer : le RCP 3 revient', await until(page, () => window.__dbg.CTRL.ctrlCam(3).ok && window.__dbg.CTRL.devState('rcp3').level === 'ok', null, 6000));
await page.locator('#station .cn-form [data-f="ip"]').fill('10.1.20.300');
await page.locator('#station .cn-apply').click();
T.check('adresse invalide : réglage refusé, expliqué', await until(page, () => /Réglage refusé/.test(document.querySelector('#station .cn-result').textContent), null, 4000) && (await ev(() => window.__dbg.CTRL.CN.m.rcp3.ip)) === '10.1.20.33');
await page.locator('#station .cn-cancel').click();
await page.locator('#station .cn-fping').first().click();
T.check('fiche : ping vers la CCU 3', await until(page, () => /4 reçus/.test(document.querySelector('#station .cn-fiche .cn-term')?.textContent || ''), null, 6000));

// ---------------- switchs : VLAN d'un port ----------------
await tab('switchs');
await page.locator('#station .cn-swseg button[data-sw="vision"]').click();
await until(page, () => !!document.querySelector('#station .cn-prow[data-port="vision:13"]'), null, 6000);
await page.locator('#station .cn-prow[data-port="vision:13"] select[data-f="vlan"]').selectOption('30');
T.check('port 13 du SW-VISION en VLAN 30 : IPDirector ne voit plus l\'EVS', await until(page, () => window.__dbg.CTRL.ctrlFunc('evs').state === 'coupe', null, 6000));
await page.locator('#station .cn-prow[data-port="vision:13"] select[data-f="vlan"]').selectOption('40');
T.check('… et le retour au VLAN 40 répare', (await fn('evs')) === 'ok');
await shot('03-switchs');

// ---------------- outils ----------------
await tab('outils');
await page.locator('#station .cn-ping [data-f="src"]').selectOption('supv');
await page.locator('#station .cn-ping [data-f="dst"]').selectOption('ccu1');
await page.locator('#station .cn-go').click();
T.check('ping supervision → CCU 1 : réponses, routage expliqué', await until(page, () => { const t = document.querySelector('#station .cn-ping .cn-pingres'); return !!t && /4 reçus/.test(t.textContent) && /passerelle/.test(t.textContent); }, null, 6000));
await page.locator('#station .cn-ping [data-f="src"]').selectOption('guest');
await page.locator('#station .cn-go').click();
T.check('ping invité → CCU 1 : bloqué par le pare-feu', await until(page, () => /pare-feu/.test(document.querySelector('#station .cn-ping .cn-pingres')?.textContent || ''), null, 6000));
await page.locator('#station .cn-sweep').click();
T.check('balayage : toutes les machines répondent', await until(page, () => /répondent/.test(document.querySelector('#station .cn-sweepbox')?.textContent || '') && document.querySelectorAll('#station .cn-sw-i.err').length === 0, null, 6000));
T.check('tables ARP et MAC remplies', await ev(() => document.querySelectorAll('#station .cn-tables tbody tr').length > 30));
await shot('04-outils');

// ---------------- QoS : copie de fichiers, QoS du cœur coupée ----------------
await page.locator('#station .cn-copy').click();
const copyState = () => ev(() => { const C = window.__dbg.CTRL; const L = C.evaluate().load['up-prod'].down; return { copy: C.CN.copy, demand: L.demand, cap: C.evaluate().load['up-prod'].cap, icom: C.ctrlFunc('icom-real').state, qos: C.CN.sw.core.qos }; });
T.check('copie de fichiers : lien montant saturé, l\'intercom passe (QoS)', await until(page, () => { const C = window.__dbg.CTRL; const R = C.evaluate(); const L = R.load['up-prod'].down; return C.CN.copy && L.demand > R.load['up-prod'].cap && C.ctrlFunc('icom-real').ok; }, null, 6000), JSON.stringify(await copyState()));
await tab('switchs');
await page.locator('#station .cn-swseg button[data-sw="core"]').click();
await until(page, () => !!document.querySelector('#station .cn-qostoggle'), null, 6000);
await page.locator('#station .cn-qostoggle').click();
T.check('QoS du cœur désactivée : l\'intercom hache, le son le signale', await until(page, () => window.__dbg.CTRL.ctrlFunc('icom-real').state === 'degrade' && [...document.querySelectorAll('#intercom .icm')].some((d) => /hache/.test(d.textContent)), null, 6000));
await page.locator('#station .cn-qostoggle').click();
await tab('outils');
await page.locator('#station .cn-copy').click();
T.check('QoS réactivée, copie arrêtée : tout est revenu', await until(page, () => !window.__dbg.CTRL.CN.copy && window.__dbg.CTRL.evaluate().err === 0 && window.__dbg.CTRL.ctrlFunc('icom-real').ok, null, 6000));

// ---------------- pannes : injectées, visibles, réparées par l'interface ----------------
for (const id of ['cn-cable', 'cn-vlan', 'cn-masque', 'cn-conflit']) {
  const st = await ev((x) => { window.__dbg.injectFault(x); return window.__dbg.ACTIVE[window.__dbg.ACTIVE.length - 1].st; }, id);
  const seen = await until(page, (d) => window.__dbg.CTRL.devState(d).level === 'err' && document.querySelectorAll('#station .cn-alarm').length > 0, st.dev, 8000);
  T.check(`${id} : visible (machine ${st.dev} en défaut, alarme au poste)`, seen);
  if (id === 'cn-cable' || id === 'cn-vlan') {
    await tab('switchs');
    await page.locator(`#station .cn-swseg button[data-sw="${st.sw}"]`).click();
    await until(page, (p) => !!document.querySelector(`#station .cn-prow[data-port="${p}"]`), `${st.sw}:${st.n}`, 6000);
    if (id === 'cn-cable') await page.locator(`#station .cn-prow[data-port="${st.sw}:${st.n}"] .cn-cable`).click();
    else await page.locator(`#station .cn-prow[data-port="${st.sw}:${st.n}"] select[data-f="vlan"]`).selectOption(String(st.vlan));
  } else {
    await tab('machines');
    await page.locator(`#station .cn-mrow[data-dev="${st.dev}"] .cn-link`).click();
    await until(page, (d) => !!document.querySelector(`#station .cn-form[data-dev="${d}"]`), st.dev, 6000);
    await page.locator('#station .cn-planbtn').click();
    await page.locator('#station .cn-apply').click();
  }
  const fixed = await until(page, () => { const a = window.__dbg.ACTIVE[window.__dbg.ACTIVE.length - 1]; return a.done && window.__dbg.CTRL.evaluate().err === 0; }, null, 30000);
  T.check(`${id} : réparée depuis le poste`, fixed, fixed ? '' : JSON.stringify(await ev((s) => { const C = window.__dbg.CTRL; const a = window.__dbg.ACTIVE[window.__dbg.ACTIVE.length - 1]; return { st: s, done: a.done, check: a.f.check(a.st), port: s.sw ? C.portOf(s.sw, s.n) : null, bad: Object.entries(C.evaluate().devs).filter(([, d]) => d.level === 'err').map(([k, d]) => k + ' : ' + d.issues[0].text) }; }, st)));
  if (!fixed) await shot('panne-' + id);
}

// ---------------- formation et fiches « ? » ----------------
await tab('formation');
const learn = await ev(() => ({ cards: document.querySelectorAll('#station .cn-learn').length, figs: document.querySelectorAll('#station .cn-learn figure svg').length, q: document.querySelectorAll('#station .cn-learn .q').length }));
T.check('formation : douze idées, schémas et boutons « ? »', learn.cards === 12 && learn.figs >= 10 && learn.q >= 14, JSON.stringify(learn));
await page.locator('#station .cn-learn .q[data-term="trunk"]').first().click();
T.check('« ? » : fiche « Port access et port trunk » avec schéma', await until(page, () => { const b = document.getElementById('termpop'); return !!b && !b.hidden && /trunk/.test(b.textContent) && !!b.querySelector('.tp-fig svg'); }, null, 6000));
await shot('05-formation-fiche');
await page.keyboard.press('Escape');
T.check('Échap ferme la fiche sans quitter le poste', await until(page, () => document.getElementById('termpop').hidden && window.__dbg.S.station === 'reseau', null, 4000));
await tab('plan');
T.check('plan d\'adressage : un sous-réseau par VLAN', await ev(() => document.querySelectorAll('#station .cn-vtbl tbody tr').length >= 7 && /10\.1\.20\.0\/24/.test(document.querySelector('#station .cn-vtbl').textContent)));

// ---------------- parcours du chef de car ----------------
const cur = () => ev(() => { const X = window.__dbg.TUTOR; const s = X.lesson && X.lesson.steps[X.i]; return s ? { id: s.id, done: X.done, quiz: s.quiz ? s.quiz.answer : null, act: !!s.done, show: !!s.show } : null; });
const misses = [];
for (const id of ['ctrlnet-bases', 'ctrlnet-machine', 'ctrlnet-depannage']) {
  await ev(() => { if (window.__dbg.S.mode === 'station') window.__dbg.closeStation(); });
  await ev((i) => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson(i); }, id);
  const done = []; let stuck = null;
  for (let k = 0; k < 30; k++) {
    const s = await cur(); if (!s) break;
    if (s.quiz != null && !s.done) { await page.locator('#chef .chef-choice').nth(s.quiz).click(); await page.waitForTimeout(200); }
    else if (s.act && !s.done) {
      const b = page.locator('#chef button', { hasText: /Emmène-moi|Montre-moi/ }).first();
      if (await b.count()) {
        await b.click(); await page.waitForTimeout(400);
        if (await b.count()) await b.click().catch(() => {});
        if (s.show && !(await until(page, () => { const sp = document.getElementById('chef-spot'); return (sp && !sp.hidden) || window.__dbg.TUTOR.done; }, null, 6000))) misses.push(`${id}/${s.id}`);
      }
      if (!(await ev(() => window.__dbg.TUTOR.done))) await ev(() => window.__dbg.chefDoForMe());
      if (!(await until(page, () => window.__dbg.TUTOR.done, null, 20000))) { stuck = s.id; break; }
    }
    done.push(s.id);
    await ev(() => window.__dbg.chefNext()); await page.waitForTimeout(150);
  }
  const fin = await ev((i) => !!(window.__dbg.PROG.tutor[i] && window.__dbg.PROG.tutor[i].done) && !window.__dbg.TUTOR.lesson, id);
  T.check(`parcours ${id}`, !stuck && fin, `${stuck ? 'bloqué à « ' + stuck + ' » après ' : ''}${done.join(' → ')}`);
  if (stuck) { await shot(`bloque-${id}-${stuck}`); await ev(() => window.__dbg.stopChefLesson && window.__dbg.stopChefLesson()); }
}
T.check('« Emmène-moi / Montre-moi » trouve l\'élément à chaque action', misses.length === 0, misses.join(', '));
T.check('réseau en état après les parcours', await ev(() => window.__dbg.CTRL.evaluate().err === 0));
await ev(() => window.__dbg.toggleChef(false));

// ---------------- téléphone : rien ne déborde ----------------
await page.setViewportSize({ width: 390, height: 844 });
await ev(() => { if (window.__dbg.S.mode !== 'station') window.__dbg.openStation('reseau'); });
await until(page, () => !!document.querySelector('#station .cn-tabs'), null, 10000);
const over = [];
for (const k of ['topo', 'machines', 'switchs', 'plan', 'outils', 'formation']) {
  await tab(k); await page.waitForTimeout(300);
  const w = await ev(() => Math.max(document.documentElement.scrollWidth, document.querySelector('#station .st-body').scrollWidth) - innerWidth);
  if (w > 1) over.push(`${k} (+${w} px)`);
}
T.check('téléphone : aucun onglet ne déborde en largeur', over.length === 0, over.join(', '));
await shot('06-telephone');
await T.finish();
