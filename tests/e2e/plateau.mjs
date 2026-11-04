// Le plateau 3D du Labo (v19.30) : les ateliers Optique et Photométrie en isométrie low-poly. Le rendu
// WebGL se monte dans l'atelier, l'image de la caméra se compose dans son coin ; un sujet, la caméra, un
// projecteur se prennent à la souris et se posent au sol (l'état se relit de leur place : distances, écarts,
// angles) ; un réglage imposé par un défi ne se déplace pas ; la vue tourne par quarts de tour, se recentre,
// zoome ; les étiquettes s'éteignent ; l'image s'agrandit ; à 390 px, rien ne déborde.
// node tests/e2e/plateau.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('plateau');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { errors: T.errors, viewport: { width: 1380, height: 860 } });
const ev = (f, a) => A.evaluate(f, a);
const shot = async (n, w = 600) => { await A.waitForTimeout(w); await A.screenshot({ path: `${OUT}/${n}.png` }); };
const st = (at) => ev((at) => JSON.parse(JSON.stringify(window.__dbg.labo().STATES[at])), at);
/** la place à l'écran de l'objet qu'on peut prendre et qui porte ce nom (le plateau projette son corps) */
const HAUT = { 'La caméra': 1.6, Principale: 1.45, Débouchage: 1.45 };
const sous = (nom) => ev(([nom, h]) => { const P = window.__dbg.labo().plateau(); const o = P.etat.A.glissables.find((x) => x.userData.glisser && x.userData.glisser.nom.includes(nom)); return o ? P.ecran(o, h) : null; }, [nom, HAUT[nom] || 1.1]);
const glisser = async (nom, dx, dy) => { const p = await sous(nom); if (!p) return false; await A.mouse.move(p.x, p.y); await A.waitForTimeout(120); await A.mouse.down(); await A.mouse.move(p.x + dx / 2, p.y + dy / 2, { steps: 4 }); await A.mouse.move(p.x + dx, p.y + dy, { steps: 4 }); await A.waitForTimeout(150); await A.mouse.up(); await A.waitForTimeout(200); return true; };

// ---------------- Optique : le plateau, l'image, les étiquettes ----------------
await A.click('.lx[data-lieu="labo"]'); await A.waitForTimeout(200);
await A.click('.jo-mode[data-mode="labo:optique"]'); await A.click('#st-antenne');
T.check('Optique : le plateau WebGL est monté dans l\'atelier, l\'image de la caméra dans son coin', await until(A, () => { const L = window.__dbg.labo(); return L.LB.open && !!document.querySelector('#labo .lb-optique .lb-plateau canvas.lb-gl') && !document.querySelector('#labo .lb-pip').hidden; }, null, 30000));
await A.waitForTimeout(1500);
T.check('les étiquettes : la caméra (focale, iris), le point, les trois sujets (distance, net ou flou)', await ev(() => { const t = [...document.querySelectorAll('#labo .lb-tag:not([hidden])')].map((x) => x.textContent); return t.some((x) => /^Caméra35 mm · f\/4/.test(x)) && t.some((x) => /^Point4 m/.test(x)) && t.some((x) => /^A2 m · flou/.test(x)) && t.some((x) => /^B4 m · net/.test(x)) && t.some((x) => /^C9 m · flou/.test(x)); }), await ev(() => [...document.querySelectorAll('#labo .lb-tag:not([hidden])')].map((x) => x.textContent).join(' | ')));
T.check('la légende de l\'image : focale, iris, point', await ev(() => /35 mm · f\/4 · point à 4 m/.test(document.querySelector('#labo .lb-pip-cap').textContent)));
T.check('le rendu : un canevas de la taille du plateau', await ev(() => { const c = document.querySelector('#labo canvas.lb-gl'); return c.clientWidth > 600 && c.clientHeight > 300 && c.width > 0; }));
await shot('01-optique', 300);

// ---------------- prendre un sujet, la caméra ----------------
await A.mouse.move(...Object.values(await sous('Sujet A'))); await A.waitForTimeout(150);
T.check('survoler le sujet A : le curseur dit qu\'on peut le prendre', await ev(() => document.querySelector('#labo canvas.lb-gl').style.cursor === 'grab'));
const o0 = await st('optique');
T.check('glisser A vers le fond : sa distance augmente, son écart suit, le reste ne bouge pas', await glisser('Sujet A', 70, -45) && await (async () => { const o = await st('optique'); return o.sujets.A > o0.sujets.A + 0.3 && o.sujets.B === o0.sujets.B && o.cam.z === 0 && Math.abs(o.lat.A - o0.lat.A) < 2; })(), JSON.stringify((await st('optique')).sujets));
T.check('l\'étiquette et la liste des taches se sont mises à jour', await ev(() => { const o = window.__dbg.labo().STATES.optique; const t = [...document.querySelectorAll('#labo .lb-tag:not([hidden])')].map((x) => x.textContent).find((x) => x.startsWith('A')); return !!t && !/^A2 m/.test(t) && document.querySelectorAll('#labo .lb-taches li').length === 3 && o.sujets.A !== 2; }));
await shot('02-sujet-glisse', 300);
// la caméra : les sujets restent où ils sont, leurs distances se relisent
const o1 = await st('optique');
const mondeB = { x: o1.cam.x - o1.lat.B, z: o1.cam.z + o1.sujets.B };
T.check('glisser la caméra : elle change de place, les sujets restent où ils sont (distances relues)', await glisser('La caméra', -40, 30) && await (async () => { const o = await st('optique'); const m = { x: o.cam.x - o.lat.B, z: o.cam.z + o.sujets.B }; return (o.cam.x !== o1.cam.x || o.cam.z !== o1.cam.z) && Math.abs(m.x - mondeB.x) < 0.02 && Math.abs(m.z - mondeB.z) < 0.02 && o.sujets.B !== o1.sujets.B; })(), JSON.stringify((await st('optique')).cam));
// les réglages : le point suit le curseur, l'image aussi
await ev(() => { const L = window.__dbg.labo(); L.changer('optique', { f: 135, N: 2, s: L.STATES.optique.sujets.B }); }); await A.waitForTimeout(300);
T.check('focale 135 mm à f/2, point sur B : la légende de l\'image suit, B net', await ev(() => /135 mm · f\/2/.test(document.querySelector('#labo .lb-pip-cap').textContent) && document.querySelectorAll('#labo .lb-taches li.ok').length >= 1));

// ---------------- la vue : tourner, recentrer, zoomer, étiquettes, agrandir ----------------
await A.click('#labo .lb-outils [aria-label="Tourner à droite"]');
T.check('un quart de tour à droite : la vue tourne de 90°', await until(A, () => { const c = document.querySelector('#labo canvas.lb-gl'); return !!c; }, null, 5000) && await (async () => { await A.waitForTimeout(900); return true; })());
await shot('03-tourne', 200);
const demi0 = await ev(() => { const c = document.querySelector('#labo canvas.lb-gl'); const r = c.getBoundingClientRect(); return r.width; });
await A.mouse.move(400, 300); await A.mouse.wheel(0, -600); await A.waitForTimeout(300);
await A.click('#labo .lb-outils .btn'); await A.waitForTimeout(300);
T.check('la molette zoome, Recentrer recadre, sans erreur de page', T.errors.length === 0 && demi0 > 0);
await A.click('#labo .lb-outils [aria-pressed]'); await A.waitForTimeout(200);
T.check('Étiquettes : la touche les éteint', await ev(() => document.querySelector('#labo .lb-tags').hidden && document.querySelector('#labo .lb-outils [aria-pressed]').getAttribute('aria-pressed') === 'false'));
await A.click('#labo .lb-outils [aria-pressed]'); await A.waitForTimeout(200);
await A.click('#labo .lb-pip-btn'); await A.waitForTimeout(400);
T.check('Agrandir : l\'image de la caméra prend le plateau, l\'aide se range', await ev(() => document.querySelector('#labo .lb-pip').classList.contains('grand') && getComputedStyle(document.querySelector('#labo .lb-aide3d')).display === 'none'));
await shot('04-image-grande', 800);
await A.click('#labo .lb-pip-btn'); await A.waitForTimeout(200);

// ---------------- Photométrie : les projecteurs se prennent, la lumière suit ----------------
await A.click('#labo .lb-tab[data-atelier="photometrie"]');
T.check('Photométrie : le même plateau, monté dans cet atelier ; l\'image exposée et balancée', await until(A, () => !!document.querySelector('#labo .lb-photometrie .lb-plateau canvas.lb-gl') && /f\/4 · 800 ISO · 1\/50 s · 3.200 K/.test(document.querySelector('#labo .lb-pip-cap').textContent), null, 20000));
await A.waitForTimeout(1500);
T.check('les étiquettes : la principale (lux, distance), le débouchage éteint, le luxmètre, la caméra', await ev(() => { const t = [...document.querySelectorAll('#labo .lb-tag:not([hidden])')].map((x) => x.textContent); return t.some((x) => /^Principale.*lx · 4,00 m/.test(x)) && t.some((x) => /^Débouchageéteint/.test(x)) && t.some((x) => /^Luxmètre.*lx/.test(x)) && t.some((x) => /^Caméraf\/4/.test(x)); }), await ev(() => [...document.querySelectorAll('#labo .lb-tag:not([hidden])')].map((x) => x.textContent).join(' | ')));
await shot('05-photometrie', 300);
const p0 = await st('photometrie');
T.check('glisser la principale : distance et angle se relisent de sa place, le luxmètre change', await glisser('Principale', 60, 40) && await (async () => { const p = await st('photometrie'); return (p.p1.d !== p0.p1.d || p.p1.phi !== p0.p1.phi) && p.p1.d >= 1 && p.p1.d <= 15 && Math.abs(p.p1.phi) <= 80; })(), JSON.stringify((await st('photometrie')).p1));
await ev(() => window.__dbg.labo().changer('photometrie', { 'p2.on': true, 'p1.d': 4, 'p1.phi': -35 })); await A.waitForTimeout(400);
T.check('le débouchage allumé : son étiquette donne ses lux, le contraste s\'affiche', await ev(() => [...document.querySelectorAll('#labo .lb-tag:not([hidden])')].some((x) => /^Débouchage\d.*lx/.test(x.textContent)) && /:1/.test(document.querySelector('#labo .lb-photometrie .lb-reads').textContent)));
T.check('les quatre fiches disent toute la photométrie : exposition, luminance, fond, contraste ; intensité, angles, angle solide, incidence, flux, puissance, courant, IRC ; mireds', await ev(() => { const t = document.querySelector('#labo .lb-photometrie .lb-reads').textContent; return document.querySelectorAll('#labo .lb-photometrie .lb-reads .lb-read').length === 4 && ['Exposition', 'Luminance', 'Fond derrière le sujet', 'Contraste', 'Intensité', 'champ', 'sr', 'incidence', 'Flux', 'W,', 'A à 230 V', 'IRC', 'Mireds'].every((k) => t.includes(k)); }));
const e0 = await ev(() => window.__dbg.labo().STATES.photometrie && document.querySelector('#labo .lb-photometrie .lb-read b').textContent);
await ev(() => window.__dbg.labo().changer('photometrie', { 'p1.h': 3.2 })); await A.waitForTimeout(400);
T.check('monter la principale à 3,20 m : la colonne s\'étire, la distance réelle et l\'incidence changent, moins de lux', await ev((e0) => { const L = window.__dbg.labo(); const P = L.plateau(); const g = P.etat.A.glissables.find((x) => x.userData.glisser && x.userData.glisser.nom === 'Principale' && x.visible); const t = document.querySelector('#labo .lb-photometrie .lb-reads').textContent; return !!g && Math.abs(g.userData.tete.position.y - 3.2) < 1e-6 && /incidence 4\d°/.test(t) && document.querySelector('#labo .lb-photometrie .lb-read b').textContent !== e0; }, e0), await ev(() => document.querySelector('#labo .lb-photometrie .lb-reads').textContent.slice(0, 300)));
await ev(() => window.__dbg.labo().changer('photometrie', { 'p1.h': 1.45 })); await A.waitForTimeout(300);
T.check('l\'aide du plateau s\'est rangée après le premier geste', await ev(() => document.querySelector('#labo .lb-aide3d').classList.contains('vu') && getComputedStyle(document.querySelector('#labo .lb-aide3d')).display === 'none'));
const p1 = await st('photometrie');
const mondeP1 = (() => { const a = p1.p1.phi * Math.PI / 180; const n = Math.hypot(p1.cam.x, p1.cam.z); const ux = p1.cam.x / n, uz = p1.cam.z / n; return { x: p1.p1.d * (Math.cos(a) * ux + Math.sin(a) * uz), z: p1.p1.d * (Math.cos(a) * uz - Math.sin(a) * ux) }; })();
T.check('glisser la caméra autour du sujet : les projecteurs restent en place, leurs angles se relisent', await glisser('La caméra', -80, -20) && await (async () => { const p = await st('photometrie'); const a = p.p1.phi * Math.PI / 180; const n = Math.hypot(p.cam.x, p.cam.z); const ux = p.cam.x / n, uz = p.cam.z / n; const m = { x: p.p1.d * (Math.cos(a) * ux + Math.sin(a) * uz), z: p.p1.d * (Math.cos(a) * uz - Math.sin(a) * ux) }; return (p.cam.x !== p1.cam.x || p.cam.z !== p1.cam.z) && Math.abs(m.x - mondeP1.x) < 0.08 && Math.abs(m.z - mondeP1.z) < 0.08 && p.p1.phi !== p1.p1.phi; })(), JSON.stringify((await st('photometrie')).cam));
await shot('06-photometrie-deux', 300);

// ---------------- un défi impose : l'objet ne se déplace pas ----------------
await A.click('#labo [data-defi="pho-niveau"]'); await A.waitForTimeout(500);
T.check('le défi « Le bon niveau » impose la principale de face : sa position est verrouillée', await ev(() => { const L = window.__dbg.labo(); return L.VERROUS.has('p1.phi') && L.STATES.photometrie.p1.phi === 0; }));
await A.mouse.move(...Object.values(await sous('Principale'))); await A.waitForTimeout(150);
T.check('la survoler : le curseur dit qu\'elle est imposée', await ev(() => document.querySelector('#labo canvas.lb-gl').style.cursor === 'not-allowed'));
const q0 = await st('photometrie');
T.check('la glisser ne la déplace pas (ni distance ni angle)', await glisser('Principale', 80, 40) && await (async () => { const q = await st('photometrie'); return q.p1.phi === 0 && q.p1.d === q0.p1.d; })());
await shot('07-defi-impose', 300);
await A.click('#labo .lb-back'); await A.waitForTimeout(200);

// ---------------- 390 px : rien ne déborde ----------------
await A.setViewportSize({ width: 390, height: 844 });
for (const at of ['optique', 'photometrie']) {
  await ev((at) => window.__dbg.emit('labo', { atelier: at }), at); await A.waitForTimeout(800);
  const ov = await ev(() => { const L = document.getElementById('labo'); const w = L.clientWidth; return [...L.querySelectorAll('.lb-work *, .lb-side *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > w + 1 && !e.closest('.lb-tabs'); }).map((e) => e.className || e.tagName).slice(0, 4); });
  T.check(`390 px, ${at} : rien ne dépasse, le plateau tient dans la largeur`, ov.length === 0 && await ev(() => document.querySelector('#labo .lb-plateau').clientWidth <= 390), JSON.stringify(ov));
  await shot(`08-mobile-${at}`, 300);
}
await T.finish();
