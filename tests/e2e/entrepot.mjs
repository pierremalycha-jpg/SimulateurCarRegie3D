// L'entrepôt (src/entrepot/) : l'écran Jouer ouvre le lieu « L'entrepôt » sur la mission
// Conférence ; le stock sort un appareil ; le panneau d'un appareil montre ses faces (un clic sur
// deux connecteurs pose un câble), son câblage, ses réglages (menus de chaque famille) et sa
// fiche ; la régie de la conférence montée en entier donne 100 / 100, le résultat est enregistré
// (exercice x-entrepot, livret) et le rapport se télécharge ; le synoptique et le réseau (ping)
// lisent le même montage ; Échap ramène à l'écran Jouer. Puis le panneau à 390 px.
// node tests/e2e/entrepot.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('entrepot');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { errors: T.errors });
const ev = (f, a) => A.evaluate(f, a);
const shot = async (n) => { await A.waitForTimeout(400); await A.screenshot({ path: `${OUT}/${n}.png` }); };

// ---------------- l'écran Jouer : le lieu, la mission, l'entrée ----------------
await A.click('[data-lieu="entrepot"]'); await A.waitForTimeout(300);
T.check('Jouer : le lieu « L\'entrepôt » propose les missions, le bac à sable', await ev(() => document.querySelectorAll('.jo-mode[data-mode^="ep:"]').length >= 4 && !!document.querySelector('.jo-mode[data-mode="ep:conference"]')));
await A.click('.jo-mode[data-mode="ep:conference"]');
await A.click('#st-antenne');
T.check('l\'entrepôt s\'ouvre en plein écran', await until(A, () => window.__dbg.entrepot().R && !document.getElementById('entrepot').hidden && !document.querySelector('#entrepot .ep-loading'), null, 120000));
await A.waitForTimeout(1500);
T.check('le cahier des charges de la Conférence est ouvert, la note est à 0', await ev(() => /Conférence/.test(document.querySelector('.ep-mission-name').textContent) && /0 \/ 100/.test(document.querySelector('.ep-side').textContent)));
await shot('01-cahier');

// ---------------- le stock : chercher, sortir ----------------
await A.click('.ep-b-stock'); await A.waitForTimeout(300);
const recherche = await A.$('.ep-stock input[type="search"]');
if (recherche) { await recherche.fill('he20'); await A.waitForTimeout(300); }
T.check('le stock filtre par la recherche', await ev(() => document.querySelectorAll('.ep-stock .ep-item').length >= 1 && document.querySelectorAll('.ep-stock .ep-item').length <= 3));
await shot('02-stock');
await A.click('.ep-stock .ep-item .btn.primary');
await A.waitForTimeout(600);
T.check('« Sortir » pose la caméra sur le plateau et ouvre son panneau', await ev(() => { const d = window.__dbg.entrepot(); return d.B.appareils.some((a) => a.modele === 'he20') && d.R.panel === 'appareil'; }));

// ---------------- le panneau d'un appareil : faces, câble par deux clics ----------------
const camUid = await ev(() => window.__dbg.entrepot().B.appareils.find((a) => a.modele === 'he20').uid);
await ev(() => { const d = window.__dbg.entrepot(); d.act.sortir('switch-m4250'); });
await ev((u) => window.__dbg.entrepot().openAppareil(u), camUid); await A.waitForTimeout(300);
await A.click('.ep-tabs [data-k="tab:faces"]'); await A.waitForTimeout(300);
T.check('Faces : la face arrière dessinée avec ses connecteurs', await ev(() => document.querySelectorAll('.ep-face svg g[data-id]').length >= 8));
await A.click('.ep-face svg g[data-id="lan"]'); await A.waitForTimeout(300);
T.check('un clic sur LAN prend un câble (bandeau « câble en main »)', await ev(() => !!document.querySelector('.ep-pending')));
await shot('03-faces');
const swUid = await ev(() => window.__dbg.entrepot().B.appareils.find((a) => a.modele === 'switch-m4250').uid);
await ev((u) => window.__dbg.entrepot().openAppareil(u), swUid); await A.waitForTimeout(400);
await A.click('.ep-face svg g[data-id="port-1"]'); await A.waitForTimeout(400);
T.check('un clic sur le port 1 du switch pose le câble caméra ↔ switch', await ev((u) => window.__dbg.entrepot().B.cables.some((c) => (c.a.dev === u && c.a.port === 'lan') || (c.b.dev === u && c.b.port === 'lan')), camUid));

// ---------------- la régie de la conférence, montée en entier ----------------
await ev(() => {
  const { act } = window.__dbg.entrepot(); const { sortir, relier, regler, vider } = act;
  vider('conference');
  const out = (id) => sortir(id).uid; const link = (a, pa, b, pb) => { const r = relier({ dev: a, port: pa }, { dev: b, port: pb }); if (!r.ok) throw new Error(`${pa} ↔ ${pb} : ${r.why}`); };
  const fixe = (ip, gw = '192.168.10.1') => ({ dhcp: false, ip, mask: '255.255.255.0', gw });
  const bandeau = out('bandeau'); link(bandeau, 'in', 'mur', 'prise1');
  const sw = out('switch-m4250'); link(sw, 'iec', bandeau, 'out1'); regler(sw, { reseau: fixe('192.168.10.1', '') });
  const atem = out('atem-hd8-iso'); link(atem, 'iec', bandeau, 'out2'); link(atem, 'lan-1', sw, 'port-20'); regler(atem, { reseau: fixe('192.168.10.240'), pgm: 1 });
  const cams = [1, 2, 3].map((n) => { const c = out('he20'); link(c, 'lan', sw, `port-${n}`); regler(c, { reseau: fixe(`192.168.10.1${n}`), format: '1080p50' }); return c; });
  const ter = out('teranex-audio-sdi'); link(ter, 'lan', sw, 'port-13'); regler(ter, { reseau: fixe('192.168.10.60') });
  const mic = out('micro-xlr'); link(mic, 'out', ter, 'xlr-in-1');
  link(cams[0], 'sdi-out', ter, 'sdi-in'); link(ter, 'sdi-out', atem, 'sdi-in-1'); link(cams[1], 'sdi-out', atem, 'sdi-in-2'); link(cams[2], 'sdi-out', atem, 'sdi-in-3');
  const rp = out('rp150'); link(rp, 'lan', sw, 'port-10'); regler(rp, { reseau: fixe('192.168.10.9'), tallyIp: true });
  cams.forEach((c, i) => regler(rp, { [`cameras.${i}.mode`]: 'ip', [`cameras.${i}.ip`]: `192.168.10.1${i + 1}` }));
  const gt = out('gpi-tally'); link(gt, 'lan-1', sw, 'port-11'); regler(gt, { atemIp: '192.168.10.240' });
  const bloc = out('bloc-12v'); link(bloc, 'iec', bandeau, 'out3'); link(gt, 'dc', bloc, 'dc');
  link(gt, 'gpio', rp, 'gpio1');
  const hd = out('hyperdeck-hd-plus'); link(hd, 'iec', bandeau, 'out4'); link(hd, 'lan', sw, 'port-12'); link(atem, 'sdi-out-pgm', hd, 'sdi-in');
  regler(hd, { reseau: fixe('192.168.10.50'), media: 'sd1', enregistre: true });
  const sd = out('carte-sd'); link(sd, 'sd', hd, 'sd1');
  const mon = out('moniteur-hdmi'); link(mon, 'iec', bandeau, 'out5'); link(atem, 'hdmi-out', mon, 'hdmi-in');
});
await A.waitForTimeout(800);
T.check('la régie montée : 100 / 100, sans erreur du moteur', await ev(() => { const d = window.__dbg.entrepot(); return d.note().score === 100 && !d.E.alertes.some((a) => a.level === 'erreur'); }), JSON.stringify(await ev(() => window.__dbg.entrepot().note().items.filter((i) => !i.ok).map((i) => i.id + ' : ' + i.why))));

// la 3D : la baie et la table, avec les appareils et les câbles
await ev(() => window.__dbg.entrepot().panel('')); await A.waitForTimeout(300);
await A.click('.ep-zones [data-zone="rack"]'); await A.waitForTimeout(2500);
T.check('3D : chaque appareil sorti a sa pastille, la sélection est surlignée', await ev(() => { const d = window.__dbg.entrepot(); return document.querySelectorAll('.ep-pins .ep-pin').length === d.B.appareils.filter((a) => a.place.zone !== 'mur').length && typeof d.R.hall.select === 'function'; }));
await shot('03b-baie');
await A.click('.ep-zones [data-zone="table"]'); await A.waitForTimeout(2500);
await shot('03c-table');
// les menus de chaque famille
for (const [modele, attendu] of [['rp150', /CAMERA SELECT/], ['atem-hd8-iso', /Programme \(PGM\)/], ['hyperdeck-hd-plus', /REMOTE/], ['switch-m4250', /PoE\+/], ['gpi-tally', /Adresse de l'ATEM/], ['teranex-audio-sdi', /Embarquer le son/], ['he20', /Format de sortie/], ['mur', /Puissance appelée/]]) {
  await ev((m) => { const d = window.__dbg.entrepot(); d.openAppareil(d.B.appareils.find((a) => a.modele === m).uid); }, modele);
  await A.waitForTimeout(250);
  await A.click('.ep-tabs [data-k="tab:reglages"]'); await A.waitForTimeout(350);
  T.check(`Réglages de ${modele}`, await ev((re) => new RegExp(re).test(document.querySelector('.ep-side .ep-tabbody').textContent), attendu.source));
  if (modele === 'rp150' || modele === 'atem-hd8-iso') await shot(`04-reglages-${modele}`);
}
// un réglage par le menu : la coupe de l'ATEM fait passer CAM 2 à l'antenne, et son tally suit
await ev(() => { const d = window.__dbg.entrepot(); d.openAppareil(d.B.appareils.find((a) => a.modele === 'atem-hd8-iso').uid); });
await A.waitForTimeout(250);
const cut = await A.$('.ep-side [data-k$=":cut"]');
if (cut) await cut.click();
await A.waitForTimeout(400);
T.check('CUT : l\'entrée 2 passe au programme, le tally de CAM 2 s\'allume', await ev(() => { const d = window.__dbg.entrepot(); const atem = d.B.appareils.find((a) => a.modele === 'atem-hd8-iso'); const cam2 = d.B.appareils.find((a) => a.nom === 'CAM 2'); return Number(atem.cfg.pgm) === 2 && d.E.tally[cam2.uid].pgm; }));
T.check('le contrôle cliqué garde le focus après le nouveau dessin du panneau', await ev(() => /:cut$/.test(document.activeElement && document.activeElement.getAttribute('data-k') || '')));
await A.click('.ep-side [data-k$=":cut"]'); await A.waitForTimeout(300);


// ---------------- rendre le montage : le résultat compte pour l'exercice et le livret ----------------
await A.click('.ep-b-mission'); await A.waitForTimeout(400);
await shot('05-cahier-100');
await A.click('.ep-side [data-k="mission:rendre"]'); await A.waitForTimeout(400);
T.check('« Rendre le montage » enregistre 100 / 100 (PROG.entrepot.missions.conference.best)', await ev(() => { const P = window.__dbg.PROG || null; const r = P && P.entrepot && P.entrepot.missions && P.entrepot.missions.conference; return !!r && r.best && r.best.score === 100 && r.runs.length === 1; }));
T.check('le cahier des charges affiche le meilleur résultat et l\'essai', await ev(() => /votre meilleur : 100 \/ 100/.test(document.querySelector('.ep-side').textContent) && /Vos essais \(1\)/.test(document.querySelector('.ep-side').textContent)));
const [dl] = await Promise.all([A.waitForEvent('download', { timeout: 20000 }).catch(() => null), A.click('.ep-side [data-k="mission:cr"]')]);
T.check('le compte rendu se télécharge (HTML)', !!dl && /compte-rendu-entrepot-conference\.html/.test(dl.suggestedFilename()));

// ---------------- le synoptique et le réseau ----------------
await A.click('.ep-b-syno'); await A.waitForTimeout(500);
const syno = await ev(() => ({ devs: document.querySelectorAll('.ep-syno-svg .ep-sy-dev').length, paths: document.querySelectorAll('.ep-syno-svg path').length }));
T.check('synoptique : les appareils en boîtes, les câbles en courbes', syno.devs >= 10 && syno.paths >= 15, JSON.stringify(syno));
await shot('06-synoptique');
await A.click('.ep-chips [data-k="syno:energie"]'); await A.waitForTimeout(300);
T.check('le calque Énergie ajoute le mur et les cordons secteur', await ev(() => document.querySelectorAll('.ep-syno-svg .ep-sy-dev').length > 0 && !!document.querySelector('.ep-syno-svg [data-uid="mur"]')));
const [csv] = await Promise.all([A.waitForEvent('download', { timeout: 20000 }).catch(() => null), A.click('.ep-syno .btn:text("Liste de câblage (CSV)")')]);
T.check('la liste de câblage se télécharge (CSV)', !!csv && /liste-de-cablage\.csv/.test(csv.suggestedFilename()));
await A.click('.ep-b-reseau'); await A.waitForTimeout(400);
T.check('réseau : un domaine (switch, VLAN 1), un seul sous-réseau', await ev(() => /Switch M4250 · VLAN 1/.test(document.querySelector('.ep-net').textContent) && /Sous-réseau 192\.168\.10\.0\/24/.test(document.querySelector('.ep-net').textContent)));
await A.click('.ep-net [data-k="ping:go"]'); await A.waitForTimeout(300);
T.check('ping : la réponse et son explication', await ev(() => /Réponse de/.test(document.querySelector('.ep-ping').textContent) && /Pourquoi ça répond/.test(document.querySelector('.ep-ping').textContent)));
// une adresse hors du sous-réseau : le ping échoue et dit pourquoi
await ev(() => { const d = window.__dbg.entrepot(); const c = d.B.appareils.find((a) => a.nom === 'CAM 3'); d.act.regler(c.uid, { 'reseau.ip': '192.168.0.13' }); });
await A.waitForTimeout(500);
await ev(() => { const s = document.querySelector('.ep-net [data-k="ping:vers"]'); const d = window.__dbg.entrepot(); s.value = d.B.appareils.find((a) => a.nom === 'CAM 3').uid; s.dispatchEvent(new Event('change')); });
await A.click('.ep-net [data-k="ping:go"]'); await A.waitForTimeout(300);
T.check('ping vers une caméra hors du sous-réseau : délai dépassé, et pourquoi', await ev(() => /Délai d'attente/.test(document.querySelector('.ep-ping').textContent) && /sous-réseau/.test(document.querySelector('.ep-ping').textContent)));
await shot('07-reseau');

// ---------------- Échap : retour à l'écran Jouer ; le montage se reprend ----------------
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
await A.keyboard.press('Escape'); await A.waitForTimeout(400);
T.check('Échap ferme le panneau puis l\'entrepôt', await ev(() => document.getElementById('entrepot').hidden));
await A.click('[data-lieu="entrepot"]'); await A.waitForTimeout(300);
T.check('Jouer propose « Reprendre le montage »', await ev(() => !!document.querySelector('.jo-mode[data-mode="ep:reprendre"]')));

// ---------------- l'exercice noté x-entrepot dans le Cours ----------------
await ev(() => window.__dbg.emit('cours', { lesson: 'expl-regie-mobile' })); await A.waitForTimeout(800);
T.check('Cours : l\'exercice noté de la leçon est fait (meilleur résultat 100 / 100)', await ev(() => /meilleur résultat 100 \/ 100/.test(document.getElementById('layer') ? document.getElementById('layer').textContent : '')));

// ---------------- le panneau à 390 px ----------------
const M = await openPage(browser, { errors: T.errors, viewport: { width: 390, height: 844 }, mobile: true });
await M.evaluate(() => window.__dbg.emit('entrepot', { mission: 'conference' }));
await until(M, () => window.__dbg.entrepot().R && !document.getElementById('entrepot').hidden, null, 120000);
await M.evaluate(() => { const d = window.__dbg.entrepot(); const r = d.act.sortir('rp150'); d.openAppareil(r.uid); });
await M.waitForTimeout(800);
await M.click('.ep-tabs [data-k="tab:reglages"]'); await M.waitForTimeout(400);
T.check('390 px : le panneau ne déborde pas', await M.evaluate(() => { const s = document.querySelector('.ep-sbody'); return s.scrollWidth <= s.clientWidth + 2; }));
await M.screenshot({ path: `${OUT}/08-mobile.png` });

T.log('captures dans', OUT);
await T.finish();
