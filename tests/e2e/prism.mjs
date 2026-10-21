// Instrument de mesure type PRISM : au poste vision (tuiles, waveform calculé sur l'image rendue, parade,
// diamant, entrée HDR HLG, plein écran, fiches « ? »), à la baie de mesure (points de mesure, œil, état SDI,
// panne « cordon abîmé » trouvée et réparée), dans la visionneuse de matériel, et les trois parcours du
// chef de car rejoués par son panneau (« Emmène-moi / Montre-moi », « Fais-le pour moi »).
// node tests/e2e/prism.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('prism');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { viewport: { width: 1440, height: 900 }, errors: T.errors });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); T.log('shot', n); };
const read = (i) => ev((k) => { const t = document.querySelectorAll('#station .pz-tile')[k]; return t ? t.querySelector('.pz-read').textContent : ''; }, i);
const pop = () => ev(() => { const p = document.querySelector('#termpop'); return p && !p.hidden ? { t: p.querySelector('h3').textContent, fig: !!p.querySelector('.tp-fig svg') } : null; });

await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', false); });
T.check('partie lancée (car SDI, 1080p50)', await until(page, () => window.__dbg.S.mode === 'fps' && !window.__dbg.S.ipMode, null, 90000));
{ const f0 = await ev(() => window.__dbg.S.frame); await page.waitForTimeout(10000); T.log('dans le stade : images rendues en 10 s', (await ev(() => window.__dbg.S.frame)) - f0); }

// ---------------- poste vision ----------------
await ev(() => window.__dbg.openStation('vision'));
T.check('poste vision : le PRISM remplace l\'oscilloscope (4 tuiles)', await until(page, () => document.querySelectorAll('#station .prism .pz-tile').length === 4 && !document.querySelector('#station canvas.scope'), null, 20000));
T.check('le waveform est calculé sur l\'image rendue', await until(page, () => /Y maxi \d/.test(document.querySelector('#station .pz-tile .pz-read').textContent), null, 60000), await read(0));
T.check('parade RVB : niveaux R, G, B lus', await until(page, () => /^R \d+ %/.test(document.querySelectorAll('#station .pz-tile .pz-read')[1].textContent), null, 30000), await read(1));
T.check('vecteurscope : balance lue sur les gris', /gris et blancs|pas assez de gris/.test(await read(2)), await read(2));
T.check('boutons SDR / HDR du Grade 1 toujours là', await ev(() => [...document.querySelectorAll('#station button')].some((b) => /SDR \| HDR/.test(b.textContent))));
{ const f0 = await ev(() => window.__dbg.S.frame); await page.waitForTimeout(10000); T.log('poste vision : images rendues en 10 s', (await ev(() => window.__dbg.S.frame)) - f0); }
await shot('01-vision-prism');
// changer l'affichage d'une tuile : explication en direct, « ? » de l'affichage
await page.selectOption('#station .pz-app[data-tile="3"]', 'diamond');
T.check('tuile 4 en diamant, expliquée dans « Ce qui se passe »', await until(page, () => document.querySelectorAll('#station .pz-tile')[3].dataset.app === 'diamond' && /Diamant/.test(document.querySelector('#station .ex-item .ex-t').textContent), null, 10000));
T.check('diamant : part de l\'image hors gamut chiffrée', await until(page, () => /hors gamut RVB/.test(document.querySelectorAll('#station .pz-tile .pz-read')[3].textContent), null, 30000));
await page.locator('#station .pz-tile[data-i="3"] .pz-th .q').click();
let p = await pop();
T.check('« ? » du diamant : fiche avec schéma', p && p.t === 'Diamant' && p.fig, JSON.stringify(p));
await page.keyboard.press('Escape');
await page.locator('#station .pz-tile[data-i="1"] .pz-th .q').click();
p = await pop();
T.check('« ? » de la parade RVB', p && p.t === 'Parade RVB', JSON.stringify(p));
await page.keyboard.press('Escape');
// curseur du waveform
await page.locator('#station .pz-tile[data-i="0"] .pz-b[data-opt="cursor"]').click();
T.check('curseur du waveform : valeur en mV et en %', await until(page, () => /curseur \d+ mV/.test(document.querySelector('#station .pz-tile .pz-read').textContent), null, 20000));
// préréglage Gamut, plein écran d'une tuile
await page.selectOption('#station .prism .pz-top .pz-sel', 'gamut');
T.check('préréglage Gamut : diamant, split diamant, arrowhead, image', await until(page, () => [...document.querySelectorAll('#station .pz-tile')].map((t) => t.dataset.app).join() === 'diamond,split,arrow,pic', null, 10000));
await page.locator('#station .pz-tile[data-i="1"] .pz-big').click();
T.check('une tuile en plein écran', await until(page, () => [...document.querySelectorAll('#station .pz-tile')].filter((t) => !t.hidden).length === 1, null, 10000));
await page.waitForTimeout(1500); await shot('02-vision-split-plein-ecran');
await page.locator('#station .pz-tile[data-i="1"] .pz-big').click();
// entrée HDR (HLG) : le Grade 1 passe en SDR | HDR, le waveform affiche le blanc de référence HLG
await page.selectOption('#station .prism .pz-top .pz-sel', 'hdr');
await page.locator('#station .pz-in button', { hasText: 'HDR HLG' }).click();
T.check('entrée HDR HLG : moniteur HDR allumé et mesure sur la sortie HLG', await until(page, () => window.__dbg.S.hdrView && document.querySelector('#station .pz-chip').textContent.includes('HDR HLG'), null, 10000));
T.check('CIE 1931 : signal lu en BT.2100', await until(page, () => /BT\.2100 HLG/.test(document.querySelectorAll('#station .pz-tile .pz-read')[1].textContent), null, 60000), await read(1));
// la sortie HLG est écrêtée à 100 % du signal (la SDR, au white clip de 103 %) : on mesure bien la sortie HDR
T.check('waveform sur la sortie HLG : rien au-dessus de 100 %', await until(page, () => { const m = /Y maxi ([\d,]+) %/.exec(document.querySelector('#station .pz-tile .pz-read').textContent); return !!m && parseFloat(m[1].replace(',', '.')) <= 100.5; }, null, 30000), await read(0));
await page.waitForTimeout(1500); await shot('03-vision-hdr');
await page.locator('#station .pz-in button', { hasText: 'SDR' }).click();
await page.selectOption('#station .prism .pz-top .pz-sel', 'vision');
await ev(() => window.__dbg.closeStation());

// ---------------- baie de mesure ----------------
await ev(() => window.__dbg.openStation('mesure'));
T.check('baie de mesure : instrument, points de mesure, liaison', await until(page, () => !!document.querySelector('#station .mesure-prism .prism') && document.querySelectorAll('#station .mz-points button.hw').length > 10, null, 20000));
T.check('œil de la mire du SPG : amplitude et montée dans les limites', await until(page, () => { const t = document.querySelector('#station .pz-kv'); if (!t) return false; const v = [...t.querySelectorAll('td.v')]; return v.length && /\d+ mV/.test(v[0].textContent) && v[0].className.includes('ok') && v[1].className.includes('ok'); }, null, 30000), await ev(() => [...document.querySelectorAll('#station .pz-kv tr')].map((r) => r.textContent).join(' | ')));
T.check('état SDI : format, CRC, longueur estimée', await until(page, () => /3G-SDI/.test(document.querySelector('#station .pz-dl').textContent) && /m \(Belden 1694A\)/.test(document.querySelector('#station .pz-dl').textContent), null, 20000));
T.check('les termes de l\'instrument ont leur « ? »', await ev(() => ['amplitude-sdi', 'temps-montee', 'overshoot', 'crc-edh', 'affaiblissement', 'egaliseur', 'timing-ref', 'ui'].every((k) => document.querySelector(`#station .q[data-term="${k}"]`))));
{ const f0 = await ev(() => window.__dbg.S.frame); await page.waitForTimeout(10000); T.log('baie de mesure : images rendues en 10 s', (await ev(() => window.__dbg.S.frame)) - f0); }
await shot('10-baie-mire-spg');
// panne : cordon abîmé sur une sortie de CCU
const pt = await ev(() => { const e = window.__dbg.injectFault('sdicable'); return e ? e.st.point : null; });
T.check('panne « cordon abîmé » injectée', !!pt, pt);
// le point de mesure de la caméra en panne : on le brasse sur l'instrument, comme un stagiaire
const lab = await ev((id) => { const n = id.slice(3); const b = [...document.querySelectorAll('#station .mz-points button.hw')].find((x) => new RegExp(`(CCU|fibre|CAM|IP) ${n} ·`).test(x.title)); if (b) b.click(); return b ? b.title : ''; }, pt);
T.check('la sortie en panne est mesurée', !!lab && await until(page, (l) => document.querySelector('#station .pz-chip').textContent.startsWith(l), lab, 10000), lab);
T.check('dépassement au-dessus de 10 % (rupture d\'impédance)', await until(page, () => { const r = [...document.querySelectorAll('#station .pz-kv tr')].find((x) => /Dépassement/.test(x.textContent)); const v = r && r.querySelector('td.v'); return !!v && v.className.includes('bad'); }, null, 30000), await ev(() => [...document.querySelectorAll('#station .pz-kv tr')].map((r) => r.textContent).join(' | ')));
await page.waitForTimeout(800); await shot('11-baie-cordon-abime');
await page.locator('#station .mz-fix button', { hasText: 'Insérer un répéteur' }).click();
T.check('un répéteur ne répare pas le cordon (explication)', await until(page, () => /rupture d'impédance reste|Il faut changer le cordon/.test(document.querySelector('#station .ex-item .ex-t').textContent), null, 8000));
await page.locator('#station .mz-fix button', { hasText: 'Remplacer le cordon' }).click();
T.check('cordon remplacé : panne résolue', await until(page, () => window.__dbg.ACTIVE.filter((a) => a.f.id === 'sdicable').every((a) => a.done) && !document.querySelector('#station .mz-chain span.bad'), null, 20000),
  await ev(() => [document.querySelector('#toast')?.textContent, document.querySelector('#station .ex-item .ex-t')?.textContent.slice(0, 60), JSON.stringify(window.__dbg.ACTIVE.map((a) => [a.f.id, a.done, a.st])), 'image ' + window.__dbg.S.frame].join(' | ')));
await ev(() => window.__dbg.closeStation());
// la visionneuse de matériel connaît l'appareil
await ev(() => window.__dbg.openDevice('prism'));
T.check('visionneuse : le moniteur de mesure, faces avant et arrière', await until(page, () => /Moniteur de mesure/.test(document.querySelector('#modal').textContent) && /SDI A/.test(document.querySelector('#modal').textContent), null, 10000));
await ev(() => document.querySelector('#modal .x')?.click());

// ---------------- les parcours du chef de car ----------------
const cur = () => ev(() => { const X = window.__dbg.TUTOR; const s = X.lesson && X.lesson.steps[X.i]; return s ? { id: s.id, done: X.done, quiz: s.quiz ? s.quiz.answer : null, act: !!s.done, show: !!s.show } : null; });
const misses = [];
for (const id of ['prism-waveform', 'prism-gamut', 'prism-oeil']) {
  const t0 = Date.now();
  await ev((i) => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson(i); }, id);
  const done = []; let stuck = null;
  for (let k = 0; k < 30; k++) {
    const s = await cur(); if (!s) break;
    if (s.quiz != null && !s.done) { await page.locator('#chef .chef-choice').nth(s.quiz).click(); await page.waitForTimeout(200); }
    else if (s.act && !s.done) {
      const b = page.locator('#chef button', { hasText: /Emmène-moi|Montre-moi/ }).first();
      if (s.show && await b.count()) {
        await b.click(); await page.waitForTimeout(500);
        if (await b.count()) await b.click().catch(() => {});
        const seen = await until(page, () => { const sp = document.getElementById('chef-spot'); return (sp && !sp.hidden) || window.__dbg.TUTOR.done; }, null, 8000);
        if (!seen) misses.push(`${id}/${s.id}`);
      }
      if (!(await ev(() => window.__dbg.TUTOR.done))) await ev(() => window.__dbg.chefDoForMe());
      if (!(await until(page, () => !!window.__dbg.TUTOR.done, null, 45000))) { stuck = s.id; break; }
    }
    done.push(s.id);
    await ev(() => window.__dbg.chefNext()); await page.waitForTimeout(150);
  }
  const fin = await ev((i) => !!(window.__dbg.PROG.tutor[i] && window.__dbg.PROG.tutor[i].done) && !window.__dbg.TUTOR.lesson, id);
  T.check(`parcours ${id}`, !stuck && fin, `${Math.round((Date.now() - t0) / 1000)} s · ${stuck ? 'bloqué à « ' + stuck + ' » après ' : ''}${done.join(' → ')}`);
  if (stuck) { await shot(`bloque-${id}-${stuck}`); await ev(() => { if (window.__dbg.TUTOR.lesson) window.__dbg.stopChefLesson(); }); }
  await ev(() => { if (window.__dbg.S.mode === 'station') window.__dbg.closeStation(); });
  await page.waitForTimeout(300);
}
T.check('« Emmène-moi / Montre-moi » trouve l\'élément à chaque action', misses.length === 0, misses.join(', '));
// au téléphone : les tuiles passent les unes sous les autres, sans débordement horizontal
await ev(() => window.__dbg.toggleChef(false));
await page.setViewportSize({ width: 400, height: 860 });
await ev(() => window.__dbg.openStation('mesure'));
await page.waitForTimeout(2500);
T.check('téléphone : pas de débordement horizontal de l\'instrument', await ev(() => { const r = document.querySelector('#station .prism').getBoundingClientRect(); return r.width <= innerWidth + 1 && document.querySelector('#station .st-body').scrollWidth <= innerWidth + 2; }));
await shot('20-telephone-baie');
await ev(() => window.__dbg.closeStation());
await T.finish();
