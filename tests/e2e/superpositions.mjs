// Ce qui se recouvre à l'écran (v19.21) : la colonne de droite de l'écran titre (moniteur, niveau, conseil
// d'Olivier) sans chevauchement ; dans le car, la boîte de dialogue d'Olivier au-dessus de la bande d'état et à
// côté du retour PGM, sous le menu Échap (dont « Retour à l'accueil » reste cliquable), à gauche du téléphone
// levé, mais devant une fenêtre quand l'étape de l'exercice s'y joue ; le deux-points, le point et la virgule de
// la police à chasse fixe pris dans Archivo (« 20:44 », « 192.168.1.23 »).
// node tests/e2e/superpositions.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('superpositions');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, title: true, fresh: true, viewport: { width: 1440, height: 900 } });
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const rect = (sel) => ev((s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const croise = (a, b) => !!(a && b && a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1);
// l'élément qu'on toucherait au centre de la cible appartient-il bien à son conteneur ?
const cliquable = (sel, dans) => ev(([s, d]) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(h && h.closest(d)); }, [sel, dans]);

// ---------------- écran titre ----------------
T.check('écran titre prêt', await until(page, () => document.getElementById('title').classList.contains('ready'), null, 120000));
await page.waitForTimeout(800);
const mon = await rect('.ti-mon'), tip = await rect('.ti-tip'), joueur = await rect('#ti-player > *');
T.check('titre : le moniteur et le conseil d\'Olivier ne se chevauchent plus', !!mon && !!tip && !croise(mon, tip), JSON.stringify({ mon, tip }));
T.check('titre : le niveau ne recouvre ni le moniteur ni le conseil', !joueur || (!croise(joueur, mon) && !croise(joueur, tip)));
T.check('titre : la mire garde son format 16/9', !!mon && mon.w > 300, mon && Math.round(mon.w) + ' px');
await shot('01-titre');

// ---------------- dans le car : Olivier se présente ----------------
await ev(() => window.__dbg.title.enter('start'));
await page.locator('#st-antenne').click(); // Jouer → car vide (le mode proposé par défaut) → Commencer l'installation
T.check('car vide lancé, Olivier se présente', await until(page, () => window.__dbg.S.mode === 'fps' && !!document.querySelector('#chef:not([hidden])'), null, 120000));
await until(page, () => document.getElementById('statusbar').getBoundingClientRect().width > 100, null, 20000);
await page.waitForTimeout(1200);
const chef = await rect('#chef'), mm = await rect('#minimon'), sb = await rect('#statusbar');
T.check('Olivier ne cache pas le retour PGM', !croise(chef, mm), JSON.stringify({ chef, mm }));
T.check('Olivier ne cache pas la bande d\'état (timecode, PGM, alarmes)', !croise(chef, sb), JSON.stringify({ chef, sb }));
T.check('la boîte de dialogue reste large et lisible', !!chef && chef.w >= 560, chef && Math.round(chef.w) + ' px');
await shot('02-arrivee');

// le deux-points des heures
const police = await ev(() => { const tc = document.querySelector('#statusbar .chip.tc > :last-child'); const w = (t) => { const x = document.createElement('span'); x.style.cssText = 'position:absolute;visibility:hidden;font:40px var(--f-mono)'; x.textContent = t; document.body.append(x); const r = x.getBoundingClientRect().width; x.remove(); return r; };
  return { fam: tc ? getComputedStyle(tc).fontFamily : '', ok: document.fonts.check('13px "TIEE Ponctuation"', ':.,'), etroit: [':', '.', ','].every((c) => w('00' + c + '00') < w('00000') - 8) }; });
T.check('les heures et les adresses : deux-points, point et virgule pris dans Archivo (« 20:44 », plus « 20: 44 »)', /^"?TIEE Ponctuation/.test(police.fam) && police.ok && police.etroit, police.fam.slice(0, 40));

// ---------------- le menu Échap passe devant Olivier ----------------
await ev(() => window.__dbg.nav.openMenu());
T.check('menu ouvert', await until(page, () => !document.getElementById('modal').hidden, null, 5000));
await page.waitForTimeout(400);
T.check('menu : Olivier passe dessous', await ev(() => document.getElementById('chef').classList.contains('sous') && +getComputedStyle(document.getElementById('chef')).zIndex < +getComputedStyle(document.getElementById('modal')).zIndex));
const boutons = await ev(() => [...document.querySelectorAll('#modal button')].filter((b) => /accueil/i.test(b.textContent || '')).length);
T.check('menu : « Retour à l\'accueil » est cliquable (rien par-dessus)', boutons > 0 && await ev(() => { const b = [...document.querySelectorAll('#modal button')].find((x) => /accueil/i.test(x.textContent || '')); if (!b) return false; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(h && h.closest('#modal')); }));
await shot('03-menu');
await page.locator('#modal .x').click();
T.check('menu refermé : Olivier repasse devant', await until(page, () => document.getElementById('modal').hidden && !document.getElementById('chef').classList.contains('sous'), null, 3000));

// ---------------- le téléphone levé : Olivier se range à sa gauche ----------------
await ev(() => window.__dbg.emit('telephone', {}));
T.check('téléphone levé', await until(page, () => { const p = document.querySelector('#telephone .tel-proj'); return !!p && p.getBoundingClientRect().width > 50; }, null, 10000));
T.check('téléphone : Olivier se range à sa gauche', await until(page, () => document.getElementById('chef').classList.contains('cote-tel'), null, 3000));
await page.waitForTimeout(700);
const tel = await rect('#telephone .tel-proj'), chef2 = await rect('#chef');
T.check('téléphone : la boîte de dialogue ne recouvre pas l\'écran du téléphone', !!tel && !!chef2 && chef2.r <= tel.l, JSON.stringify({ chef2, tel }));
T.check('téléphone : l\'application Réglages est cliquable', await cliquable('#telephone .tel-app[data-app="reglages"]', '#telephone'));
await shot('04-telephone');
await page.keyboard.press('Escape');
T.check('téléphone rangé : Olivier reprend sa place', await until(page, () => !document.getElementById('chef').classList.contains('cote-tel'), null, 5000));

// ---------------- une étape qui se joue dans une fenêtre : Olivier reste devant ----------------
await ev(() => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson('chef-cablage'); });
const etape = () => ev(() => { const T = window.__dbg.TUTOR; return T.lesson ? T.lesson.steps[T.i].id : ''; });
for (let k = 0; k < 8 && (await etape()) !== 'follow'; k++) { await ev(() => window.__dbg.chefDoForMe()); await page.waitForTimeout(900); await ev(() => window.__dbg.chefNext()); await page.waitForTimeout(600); }
T.check('exercice : l\'étape « Suivre le câble » se joue dans la visionneuse (fenêtre)', (await etape()) === 'follow' && await ev(() => !document.getElementById('modal').hidden), await etape());
T.check('exercice : Olivier reste devant la fenêtre qui porte l\'étape', await until(page, () => !document.getElementById('chef').classList.contains('sous'), null, 3000));
await shot('05-exercice-fenetre');
await T.finish();
