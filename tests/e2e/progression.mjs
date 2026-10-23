// Ma progression (v19.4, Réglages) : où elle est enregistrée, l'export dans un fichier, l'import qui
// fusionne (et refuse un fichier qui n'en est pas un), l'échec d'enregistrement signalé tout de suite,
// l'effacement après confirmation ; et plus aucune requête vers un service de polices.
// node tests/e2e/progression.mjs [dossier]
import fs from 'node:fs';
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('progression');
const T = reporter();
const browser = await launch();
const reqs = /** @type {string[]} */ ([]);
const A = await openPage(browser, { errors: T.errors, before: (p) => p.on('request', (r) => reqs.push(r.url())) });
const ev = (f, a) => A.evaluate(f, a);

// une leçon acquise, puis les Réglages
await ev(() => { const P = window.__dbg.PROG; P.cours = { 'signal-422': { seen: true, quiz: { score: 3, total: 3 } } }; });
await ev(() => window.__dbg.emit('settings')); await A.waitForTimeout(400);
const st = await ev(() => ({ sec: !!document.querySelector('#rg-progression'), state: document.querySelector('#rg-progression .mp-state')?.textContent || '', resume: document.querySelector('#rg-progression .note')?.textContent || '', rgpd: document.querySelector('#rg-progression .mp-rgpd summary')?.textContent || '' }));
T.check('Réglages : la section « Ma progression », où elle est enregistrée, le résumé, « Vos données personnelles »', st.sec && /navigateur/.test(st.state) && /1 leçon acquise/.test(st.resume) && /données personnelles/.test(st.rgpd), JSON.stringify(st));
await A.locator('#rg-progression').screenshot({ path: `${OUT}/01-ma-progression.png` });

// export : un fichier JSON au format de l'application, avec la leçon
const [dl] = await Promise.all([A.waitForEvent('download', { timeout: 30000 }), A.click('#mp-export')]);
const file = `${OUT}/export.json`; await dl.saveAs(file);
const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
T.check('export : fichier « tiee-progression-<date>.json », format, version et leçon acquise', /^tiee-progression-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()) && exp.format === 'tiee-simulator/progression' && exp.v >= 2 && exp.progression.cours['signal-422'].quiz.score === 3, dl.suggestedFilename());

// import : la progression d'un autre ordinateur (une autre leçon, un moins bon score sur la première) se fusionne
exp.progression.cours = { 'signal-422': { seen: true, quiz: { score: 1, total: 3 } }, 'son-n1': { seen: true, quiz: { score: 3, total: 3 } } };
fs.writeFileSync(`${OUT}/autre.json`, JSON.stringify(exp));
await A.setInputFiles('#rg-progression input[type=file]', `${OUT}/autre.json`); await A.waitForTimeout(500);
const imp = await ev(() => ({ c: window.__dbg.PROG.cours, msg: document.querySelector('#rg-progression .mp-msg')?.textContent || '', resume: document.querySelector('#rg-progression .note')?.textContent || '' }));
T.check('import : fusion, la leçon de l\'autre ordinateur arrive, le meilleur score reste, le résumé suit', imp.c['son-n1']?.quiz?.score === 3 && imp.c['signal-422']?.quiz?.score === 3 && /fusionnée/.test(imp.msg) && /2 leçons acquises/.test(imp.resume), JSON.stringify(imp));
fs.writeFileSync(`${OUT}/faux.json`, '{"nom":"un autre fichier"}');
await A.setInputFiles('#rg-progression input[type=file]', `${OUT}/faux.json`); await A.waitForTimeout(400);
T.check('import d\'un fichier qui n\'est pas une progression : refusé, avec la raison', /Import impossible : Ce fichier ne contient pas de progression/.test(await ev(() => document.querySelector('#rg-progression .mp-msg')?.textContent || '')));
await A.keyboard.press('Escape'); await A.waitForTimeout(200);

// stockage du navigateur plein : l'échec se dit tout de suite
await ev(() => { const set = Storage.prototype.setItem; window.__setItem = set; Storage.prototype.setItem = function (k, v) { if (k === 'carregie.progress') throw new DOMException('plein', 'QuotaExceededError'); return set.call(this, k, v); }; });
await ev(() => window.__dbg.emit('patchDone'));
T.check('stockage plein : une notification le dit (et propose l\'export)', await until(A, () => /ne s'enregistre plus/.test(document.getElementById('toast')?.textContent || ''), null, 15000));
await ev(() => window.__dbg.emit('settings')); await A.waitForTimeout(400);
T.check('stockage plein : la section le dit aussi, en rouge', await ev(() => !!document.querySelector('#rg-progression .mp-state.err')));
await A.locator('#rg-progression').screenshot({ path: `${OUT}/02-echec.png` });
await ev(() => { Storage.prototype.setItem = window.__setItem; });

// effacer : confirmation dans la page, puis rechargement sur une progression vide
await A.click('#mp-erase'); await A.waitForTimeout(300);
T.check('effacer : une confirmation dans la page (pas de boîte du navigateur)', await ev(() => !!document.querySelector('#ask [data-ask="ok"]') && /Effacer définitivement/.test(document.querySelector('#ask [data-ask="ok"]').textContent)));
await A.click('#ask [data-ask="ok"]');
await A.waitForEvent('load', { timeout: 120000 }).catch(() => {});
await until(A, () => !!window.__dbg, null, 180000);
const apres = await ev(() => ({ cours: Object.keys(window.__dbg.PROG.cours || {}).length, ls: (() => { try { return JSON.parse(localStorage.getItem('carregie.progress') || '{}'); } catch (e) { return {}; } })() }));
T.check('après effacement : progression vide, dans la page et dans le navigateur', apres.cours === 0 && !Object.keys(apres.ls.cours || {}).length, JSON.stringify(apres));

// polices : intégrées, aucune requête vers Google Fonts, et celles des textures 3D sont chargées
T.check('aucune requête vers un service de polices', !reqs.some((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), reqs.filter((u) => /fonts\./.test(u)).join(' '));
T.check('polices des textures 3D intégrées (Barlow Condensed, JetBrains Mono)', await ev(async () => { await document.fonts.load('600 40px "Barlow Condensed"'); await document.fonts.load('600 16px "JetBrains Mono"'); return document.fonts.check('600 40px "Barlow Condensed"') && document.fonts.check('600 16px "JetBrains Mono"'); }));
await T.finish();
