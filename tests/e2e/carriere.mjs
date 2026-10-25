// La Carrière (src/carriere/) : Jouer → L'entrepôt → Carrière ouvre le bureau ; la messagerie de
// l'ordinateur (bouton, pastille, clic dans la 3D) montre le premier mail ; « Partir au stade » lance
// le car en visite guidée de stagiaire (six postes) ; la visite finie, le mail d'Olivier et l'offre
// suivante arrivent ; « Retourner à l'entrepôt » recharge le simulateur sur le bureau ; l'offre de la
// conférence ouvre son cahier des charges, la régie rendue à 100 / 100 fait arriver le mail de
// retour ; Jouer résume la Carrière ; la messagerie à 390 px.
// node tests/e2e/carriere.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('carriere');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { errors: T.errors });
const ev = (f, a) => A.evaluate(f, a);
const shot = async (n) => { await A.waitForTimeout(500); await A.screenshot({ path: `${OUT}/${n}.png` }); };

// ---------------- Jouer : la Carrière, premier mode de l'entrepôt ----------------
await A.click('[data-lieu="entrepot"]'); await A.waitForTimeout(300);
T.check('Jouer : L\'entrepôt propose d\'abord la Carrière, choisie d\'office', await ev(() => { const m = [...document.querySelectorAll('.jo-mode')]; return m[0] && m[0].dataset.mode === 'ep:carriere' && m[0].getAttribute('aria-pressed') === 'true' && /Commencer ma carrière/.test(document.getElementById('st-antenne').textContent); }));
await shot('01-jouer');
await A.click('#st-antenne');
T.check('le bureau s\'ouvre sur la messagerie : un mail, non lu', await until(A, () => { const d = window.__dbg.entrepot(); return !!d.R && !document.getElementById('entrepot').hidden && !document.querySelector('#entrepot .ep-loading') && d.R.panel === 'messagerie' && document.querySelectorAll('.cr-row').length === 1 && !!document.querySelector('.cr-row.unread'); }, null, 120000));
await A.waitForTimeout(1500);
T.check('la barre : Carrière, la touche Messagerie (1 non lu), la zone Bureau', await ev(() => /Carrière/.test(document.querySelector('.ep-mission-name').textContent) && !document.querySelector('.ep-b-messagerie').hidden && document.querySelector('.ep-b-messagerie .ep-badge').textContent === '1' && !document.querySelector('[data-zone="bureau"]').hidden));
T.check('la pastille de l\'ordinateur signale le mail', await ev(() => !!document.querySelector('.ep-pin.pc.new')));
T.check('rien de monté : pas de mission de l\'entrepôt en cours', await ev(() => window.__dbg.entrepot().B.mission === ''));
await shot('02-bureau');

// un clic sur l'écran de l'ordinateur, dans la 3D, rouvre la messagerie
await ev(() => window.__dbg.entrepot().panel('')); await A.waitForTimeout(1200);
const pt = await ev(() => { const { R } = window.__dbg.entrepot(); const p = R.hall.pcAnchor().clone(); p.y -= 0.27; p.project(R.camera); const r = R.canvas.getBoundingClientRect(); return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }; });
await A.mouse.click(pt.x, pt.y); await A.waitForTimeout(500);
T.check('un clic sur l\'écran du bureau, dans la 3D, ouvre la messagerie', await ev(() => window.__dbg.entrepot().R.panel === 'messagerie'), JSON.stringify(pt));

// ---------------- le premier mail : la mission de stagiaire ----------------
await A.click('.cr-row'); await A.waitForTimeout(400);
T.check('le mail ouvert : l\'objet, Nadia, l\'ordre de mission (Stagiaire, 0 / 7)', await ev(() => { const s = document.querySelector('.ep-side').textContent; return /Bienvenue/.test(document.querySelector('.cr-objet').textContent) && /Nadia Morel/.test(s) && /Stagiaire/.test(s) && /0 \/ 7/.test(s) && document.querySelectorAll('.cr-points li').length === 7; }));
T.check('sans réglage du formateur : la société fictive', await ev(() => /TIEE Prestations/.test(document.querySelector('.cr-body').textContent)));
T.check('lu : le compteur disparaît, l\'enregistrement le garde', await ev(() => document.querySelector('.ep-b-messagerie .ep-badge').hidden && !!window.__dbg.PROG.carriere.lus['offre:stagiaire']));
await shot('03-mail');

// ---------------- au stade : la visite guidée de stagiaire ----------------
await A.click('[data-k="mail:go"]');
T.check('« Partir au stade » : le car se lance, Olivier commence le tour du car', await until(A, () => window.__dbg.S.mode !== 'start' && !!window.__dbg.S.carriere && window.__dbg.S.carriere.id === 'stagiaire' && document.getElementById('entrepot').hidden && !!window.__dbg.TUTOR.lesson && window.__dbg.TUTOR.lesson.id === 'prise-en-main', null, 120000));
await A.waitForTimeout(1200);
T.check('l\'objectif à l\'écran : Carrière', await ev(() => { const q = document.getElementById('quest'); return !!q && !q.hidden && /Carrière/.test(q.textContent); }));
await shot('04-car');
// le tour du car et cinq postes déjà vus ; le dernier, le chef de car, se fait pour de bon dans le panneau d'Olivier
await ev(() => {
  const { PROG, stopChefLesson } = window.__dbg; stopChefLesson(false, false);
  for (const id of ['prise-en-main', 'poste-realisateur', 'poste-melangeur', 'poste-vision', 'poste-evs', 'poste-son']) PROG.tutor[id] = { done: true, at: Date.now() };
  window.__dbg.toggleChef(true);
});
await A.waitForTimeout(600);
T.check('le plan de la visite : les six postes de la mission, cinq cochés', await ev(() => document.querySelectorAll('#chef .chef-visit').length === 7 && document.querySelectorAll('#chef .chef-visit.done').length === 6 && /Continuer : Chef de car/.test(document.getElementById('chef').textContent)));
await A.locator('#chef button', { hasText: /Continuer : Chef de car/ }).click();
for (let i = 0; i < 20; i++) {
  if (await ev(() => /Mission accomplie/.test(document.getElementById('chef').textContent))) break;
  if (!(await ev(() => window.__dbg.TUTOR.done))) await ev(() => window.__dbg.chefDoForMe());
  await A.waitForTimeout(300);
  const b = A.locator('#chef .chef-nav button.primary', { hasText: /Suivant|Terminer/ });
  if (await b.count()) await b.first().click();
  await A.waitForTimeout(300);
}
T.check('la visite finie : « Mission accomplie », le retour à l\'entrepôt proposé', await until(A, () => /Mission accomplie/.test(document.getElementById('chef').textContent) && !!document.querySelector('#chef [data-k="carriere:retour"]'), null, 10000));
T.check('les mails d\'Olivier et de l\'offre suivante sont arrivés, le toast le dit', await ev(() => { const r = window.__dbg.PROG.carriere.recus; return !!r['retour:stagiaire'] && !!r['offre:conference'] && /Nouveau mail/.test(document.getElementById('toast')?.textContent || ''); }));
T.check('le badge « Embauché »', await until(A, () => !!window.__dbg.jeu.XP.game().badges.embauche, null, 10000));
T.check('l\'objectif : mission accomplie, retour au bureau', await ev(() => /Mission accomplie/.test(document.getElementById('quest').textContent)));
await shot('05-fin-visite');

// ---------------- retour au bureau : le simulateur se recharge sur l'entrepôt ----------------
await A.click('#chef [data-k="carriere:retour"]');
await A.waitForSelector('#ask [data-ask="ok"]');
T.check('la confirmation dit où l\'on va', await ev(() => /Retourner au bureau de l'entrepôt/.test(document.getElementById('ask').textContent)));
const reload = A.waitForEvent('load', { timeout: 120000 });
await A.click('#ask [data-ask="ok"]');
await reload;
await A.waitForFunction('!!window.__dbg', null, { timeout: 180000, polling: 300 });
T.check('après le rechargement : le bureau, deux nouveaux mails', await until(A, () => { const d = window.__dbg.entrepot(); return !!d.R && !document.getElementById('entrepot').hidden && d.R.panel === 'messagerie' && document.querySelectorAll('.cr-row').length === 3 && document.querySelectorAll('.cr-row.unread').length === 2; }, null, 120000));
await A.waitForTimeout(1500);
await shot('06-retour');

// ---------------- l'offre suivante : la conférence, montée à l'entrepôt ----------------
await A.click('.cr-row[data-mail="retour:stagiaire"]'); await A.waitForTimeout(300);
T.check('le retour d\'Olivier : ce qu\'on a vu, poste par poste', await ev(() => /Olivier/.test(document.querySelector('.cr-meta').textContent) && /N-1/.test(document.querySelector('.cr-body').textContent)));
await A.click('[data-k="mail:retour"]'); await A.waitForTimeout(300);
await A.click('.cr-row[data-mail="offre:conference"]'); await A.waitForTimeout(300);
T.check('l\'offre : Assistant technique, la conférence, à l\'entrepôt', await ev(() => { const s = document.querySelector('.cr-ordre').textContent; return /Assistant technique/.test(s) && /Conférence à trois caméras PTZ/.test(s); }));
await A.click('[data-k="mail:go"]'); await A.waitForTimeout(800);
T.check('« Commencer le montage » : la mission de la conférence, son cahier des charges ouvert', await ev(() => { const d = window.__dbg.entrepot(); return d.B.mission === 'conference' && d.R.panel === 'mission' && /Carrière · Conférence/.test(document.querySelector('.ep-mission-name').textContent); }));
await ev(() => {
  const { act } = window.__dbg.entrepot(); const { sortir, relier, regler } = act;
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
T.check('la régie montée : 100 / 100', await ev(() => window.__dbg.entrepot().note().score === 100));
await A.click('[data-k="mission:rendre"]'); await A.waitForTimeout(800);
T.check('rendue : le mail de retour de Nadia arrive, la touche Messagerie le compte', await until(A, () => !!window.__dbg.PROG.carriere.recus['retour:conference'] && document.querySelector('.ep-b-messagerie .ep-badge').textContent === '1' && /Nouveau mail/.test(document.getElementById('toast')?.textContent || ''), null, 10000));
await shot('07-rendu');
await A.click('.ep-b-messagerie'); await A.waitForTimeout(400);
await A.click('.cr-row[data-mail="retour:conference"]'); await A.waitForTimeout(400);
T.check('le mail de retour cite la note', await ev(() => /100 \/ 100/.test(document.querySelector('.cr-body').textContent)));
await shot('08-mail-retour');
await A.click('[data-k="mail:retour"]'); await A.waitForTimeout(300);
T.check('dans la boîte, l\'offre de la conférence est marquée réussie', await ev(() => /réussie/.test(document.querySelector('.cr-row[data-mail="offre:conference"]').textContent)));

// ---------------- Jouer résume la Carrière ----------------
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
await A.keyboard.press('Escape'); await A.waitForTimeout(600);
T.check('Échap : retour à Jouer, la Carrière résumée (boîte à jour, pas de mission en cours)', await until(A, () => document.getElementById('entrepot').hidden && /Ta boîte de réception est à jour/.test(document.querySelector('.jo-mode[data-mode="ep:carriere"]').textContent) && /Pas de mission en cours/.test(document.querySelector('.jo-mode[data-mode="ep:carriere"]').textContent) && /Retourner au bureau/.test(document.getElementById('st-antenne').textContent), null, 10000));

// ---------------- au téléphone ----------------
await A.setViewportSize({ width: 390, height: 844 }); await A.waitForTimeout(400);
await A.click('#st-antenne');
T.check('390 px : la messagerie tient dans l\'écran, sans défilement horizontal', await until(A, () => { const s = document.querySelector('.ep-side'); return !!s && !s.hidden && !!document.querySelector('.cr-row') && s.getBoundingClientRect().right <= 391 && document.querySelector('.ep-sbody').scrollWidth <= document.querySelector('.ep-sbody').clientWidth + 1; }, null, 20000));
await A.click('.cr-row[data-mail="offre:stagiaire"]'); await A.waitForTimeout(400);
T.check('390 px : le mail ouvert et son ordre de mission, lisibles', await ev(() => { const b = document.querySelector('.ep-sbody'); return !!document.querySelector('.cr-ordre') && b.scrollWidth <= b.clientWidth + 1; }));
await shot('09-telephone');

await T.finish();
