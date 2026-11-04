// L'atelier « Caméras PTZ » du Labo (v19.30) : la mise en service du banc du BTS faite pas à pas, à la main,
// dans l'interface : brancher et alimenter (switch PoE+), adresser le PC, chercher et adresser les caméras avec
// Easy IP Setup, créer et changer les comptes dans la page web, marquer la vidéo en DSCP, adresser le pupitre et
// y enregistrer les caméras, régler la QoS du switch, la recette au joystick. Puis un défi joué seul (trois
// caméras sorties du carton, dont une qui a passé ses 20 minutes), un défi avec la solution, le Cours, 390 px.
// node tests/e2e/ptz.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('ptz');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { errors: T.errors });
A.setDefaultTimeout(20000);
const ev = (f, a) => A.evaluate(f, a);
const shot = async (n, w = 300) => { await A.waitForTimeout(w); await A.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); };
const k = (s) => `#labo [data-k="${s}"]`;
const remplir = async (s, v) => { await A.fill(k(s), v); };
const clic = async (s, w = 120) => { await A.click(k(s)); await A.waitForTimeout(w); };
const etapes = () => ev(() => window.__dbg.labo().STATES.ptz && Object.fromEntries((window.__dbg.labo().mesures('ptz').etapes || []).map((e) => [e.id, e.fait])));
const etape = async (id) => (await etapes())[id];

// ---------------- Jouer → le Labo, atelier Caméras PTZ ----------------
await A.click('.lx[data-lieu="labo"]'); await A.waitForTimeout(300);
T.check('Jouer : le Labo propose l\'atelier Caméras PTZ', await ev(() => !!document.querySelector('.jo-mode[data-mode="labo:ptz"]')));
await A.click('.jo-mode[data-mode="labo:ptz"]'); await A.click('#st-antenne');
T.check('l\'atelier s\'ouvre sur le câblage (faces arrière), le panneau sur « Pas à pas »', await until(A, () => window.__dbg.labo().LB.open && document.querySelector('#labo .lb-tab[aria-selected="true"]')?.dataset.atelier === 'ptz' && !!document.querySelector('#labo .tz-scene') && !!document.querySelector('#labo .lb-steps'), null, 20000));
T.check('onze étapes, aucune faite, la première dépliée', await ev(() => document.querySelectorAll('#labo .lb-step').length === 11 && !document.querySelector('#labo .lb-step.ok') && !!document.querySelector('#labo .lb-step.cur .lb-step-body')));
T.check('les faces arrière : l\'AW-HE130 et ses prises sérigraphiées (SDI OUT, G/L IN, LAN, RS-422, DC 12V IN), le pupitre (IP CONT, SERIAL CONT 1 à 5, TALLY/GPIO 1)', await ev(() => ['cam1:sdi', 'cam1:gl', 'cam1:lan', 'cam1:rs422', 'cam1:dc', 'cam3:sdi', 'rp:lan', 'rp:s5', 'rp:gpio', 'mix:in4', 'sw:p8'].filter((e) => !document.querySelector(`#labo [data-pr="${e}"]`)).length === 0 && /SERIAL CONT 1/.test(document.querySelector('#labo [data-pr="rp:s1"]')?.getAttribute('aria-label') || '')), await ev(() => ['cam1:sdi', 'cam1:gl', 'cam1:lan', 'cam1:rs422', 'cam1:dc', 'cam3:sdi', 'rp:lan', 'rp:s5', 'rp:gpio', 'mix:in4', 'sw:p8'].filter((e) => !document.querySelector(`#labo [data-pr="${e}"]`)).join(',') + ' | ' + document.querySelector('#labo [data-pr="rp:s1"]')?.getAttribute('aria-label')));
await shot('01-cablage-carton', 600);

// ---------------- 1. câbler au switch, par les prises ----------------
const pr = async (e) => { await A.click(`#labo [data-pr="${e}"]`); await A.waitForTimeout(90); };
await pr('cam1:rs422'); await pr('sw:p2');
T.check('le piège : le câble du switch dans la prise RS-422 de l\'AW-HE130 entre, mais pas d\'Ethernet', await ev(() => /liaison série/.test(document.querySelector('#labo .tz-msg')?.textContent || '') && !window.__dbg.labo().mesures('ptz').alim.par.cam1.lien));
await pr('cam1:rs422');
T.check('toucher une prise câblée la débranche', await ev(() => window.__dbg.labo().STATES.ptz.appareils.find((a) => a.id === 'cam1').port === 0));
await pr('cam1:lan'); await pr('sw:p2');
await clic('cable:bnc'); await pr('cam2:lan');
T.check('un coaxial BNC n\'entre pas dans une prise RJ45', await ev(() => /n'entre pas/.test(document.querySelector('#labo .tz-msg')?.textContent || '')));
await clic('cable:rj45');
for (const [e, p] of [['pc:lan', 'sw:p1'], ['cam2:lan', 'sw:p3'], ['cam3:lan', 'sw:p4'], ['rp:lan', 'sw:p5']]) { await pr(e); await pr(p); }
T.check('tout est câblé par les prises LAN et alimenté en PoE+ (étapes 1 et 2)', (await etape('cabler')) && (await etape('alimenter')));
T.check('les câbles se dessinent (5 câbles réseau)', await ev(() => document.querySelectorAll('#labo .tz-cable.rj45').length === 5));
// ---------------- 2 bis. la vidéo et le tally ----------------
await clic('cable:bnc');
await pr('cam1:gl'); await pr('mix:in1');
T.check('G/L IN vers le mélangeur : le câble entre, aucune image n\'en sort', await ev(() => /synchronisation/.test(document.querySelector('#labo .tz-msg')?.textContent || '') && !window.__dbg.labo().mesures('ptz').etapes.find((e) => e.id === 'video').fait));
await pr('cam1:gl');
for (const [e, p] of [['cam1:sdi', 'mix:in1'], ['cam2:sdi', 'mix:in2'], ['cam3:sdi', 'mix:in3']]) { await pr(e); await pr(p); }
await clic('cable:gpio'); await pr('mix:gpio'); await pr('rp:gpio2');
T.check('le tally sur GPIO 2 est refusé (extension)', await ev(() => /TALLY\/GPIO 1/.test(document.querySelector('#labo .tz-msg')?.textContent || '')));
await pr('mix:gpio'); await pr('rp:gpio');
T.check('la vidéo et le tally câblés (étape 3)', await etape('video'));
await shot('02-cablage-fait');
await ev(() => window.__dbg.labo().changer('ptz', { vue: 'banc' })); await A.waitForTimeout(200);
T.check('le switch réserve 120 W (4 × 30 W) sur 125', await ev(() => /120 W réservés/.test(document.querySelector('#labo .tz-switch + .lb-reads')?.textContent || '') && /125 W/.test(document.querySelector('#labo .tz-switch + .lb-reads')?.textContent || '')));
await A.selectOption(k('switch.ports.2.poe'), 'af'); await A.waitForTimeout(120);
T.check('un port en PoE simple : l\'AW-HE130 s\'éteint, la raison est dite', await ev(() => /demande du PoE\+/.test(document.querySelector('#labo .tz-app[data-etat="lien"]')?.textContent || '')));
await A.selectOption(k('switch.ports.2.poe'), 'at'); await A.waitForTimeout(120);
await shot('03-switch');

// ---------------- 3. le PC dans le réseau de la fiche ----------------
await A.click('#labo .lb-step.cur [data-k="pas:aller"]'); await A.waitForTimeout(200);
T.check('« Y aller » mène au PC, application Connexion réseau', await ev(() => window.__dbg.labo().STATES.ptz.vue === 'pc' && !!document.querySelector('#labo [data-k="pc:ip"]')));
await remplir('pc:ip', '192.168.10.300'); await clic('pc:ok');
T.check('une adresse impossible est refusée', await ev(() => /pas une adresse IPv4/.test(document.querySelector('#labo .tz-win .tz-msg')?.textContent || '')));
await remplir('pc:ip', '192.168.10.100'); await clic('pc:ok');
T.check('une passerelle hors du sous-réseau est refusée', await ev(() => /passerelle/.test(document.querySelector('#labo .tz-win .tz-msg')?.textContent || '')));
await remplir('pc:passerelle', '192.168.10.1'); await clic('pc:ok');
T.check('le PC en 192.168.10.100 / 24 (étape 4)', await etape('pc'));

// ---------------- 4-5. Easy IP Setup : chercher, puis adresser une par une ----------------
await clic('pcApp:easyip'); await clic('eip:search', 200);
T.check('Search : trois caméras, toutes en 192.168.0.10, hors du sous-réseau du PC', await ev(() => { const r = [...document.querySelectorAll('#labo .tz-eip tbody tr')]; return r.length === 3 && r.every((x) => x.children[1].textContent === '192.168.0.10'); }));
await shot('03-easyip', 200);
for (const [id, ip] of [['cam1', '192.168.10.11'], ['cam2', '192.168.10.12'], ['cam3', '192.168.10.13']]) {
  await clic('eip:' + id); await clic('eip:network');
  await remplir('eip:ip', ip); await remplir('eip:masque', '255.255.255.0'); await remplir('eip:passerelle', '192.168.10.1');
  if (id === 'cam1') await shot('04-network-settings', 100);
  await clic('eip:save', 200);
}
T.check('les trois caméras au plan (étapes 5 et 6)', (await etape('chercher')) && (await etape('adresser')));

// ---------------- 6. les comptes : créer celui de l'AW-UE20, changer ceux des AW-HE130 ----------------
await clic('eip:cam3'); await clic('eip:access', 300);
T.check('Access Camera ouvre la page de l\'AW-UE20 : création du compte', await ev(() => /Initial account registration/.test(document.querySelector('#labo .tz-page')?.textContent || '')));
await remplir('web:user', 'regie'); await remplir('web:mdp', '12345'); await remplir('web:mdp2', '12345'); await clic('web:set');
T.check('un mot de passe trop facile est refusé', await ev(() => /trop facile|caractères/.test(document.querySelector('#labo .tz-page .tz-msg')?.textContent || '')));
await remplir('web:mdp', 'Tiee-Banc-24'); await remplir('web:mdp2', 'Tiee-Banc-24'); await clic('web:set', 200);
await shot('05-compte');
const entrer = async (ip, user, mdp) => { await remplir('web:url', `http://${ip}`); await clic('web:go', 200); if (await A.$(k('web:luser'))) { await remplir('web:luser', user); await remplir('web:lmdp', mdp); await clic('web:login', 200); } };
for (const ip of ['192.168.10.11', '192.168.10.12']) {
  await entrer(ip, 'admin', '12345');
  await clic('web:setup'); await clic('web:m:user');
  await remplir('web:uuser', 'regie'); await remplir('web:umdp', 'Tiee-Banc-24'); await remplir('web:umdp2', 'Tiee-Banc-24'); await clic('web:uset', 200);
}
T.check('trois comptes administrateurs, plus de compte d\'usine (étape 7)', await etape('compte'));

// ---------------- la page web : port HTTP, puis Diffserv ----------------
await entrer('192.168.10.11', 'regie', 'Tiee-Banc-24');
await clic('web:setup'); await clic('web:m:network');
T.check('Setup → Network : les champs de la caméra', await ev(() => ['IP address(IPv4)', 'Subnet mask', 'Default gateway', 'HTTP port', 'Easy IP Setup accommodate period'].every((t) => (document.querySelector('#labo .tz-page')?.textContent || '').includes(t))));
await shot('06-page-network');
for (const ip of ['192.168.10.11', '192.168.10.12', '192.168.10.13']) {
  await entrer(ip, 'regie', 'Tiee-Banc-24');
  await clic('web:setup'); await clic('web:m:network'); await clic('web:o:advanced');
  await remplir('web:dscp', '34'); await A.check('#labo input[name="tz-flux"] + *, #labo input[name="tz-flux"]:not(:checked)').catch(() => {});
  await ev(() => { const r = [...document.querySelectorAll('#labo input[name="tz-flux"]')][1]; r.click(); });
  await clic('web:aset', 200);
}
T.check('les trois caméras marquent en DSCP 34 et diffusent leur flux', await ev(() => window.__dbg.labo().STATES.ptz.appareils.filter((a) => a.id.startsWith('cam')).every((c) => c.dscp === 34 && c.flux)));
// le port HTTP : changé, l'URL sans port est refusée, avec le port elle répond
await entrer('192.168.10.12', 'regie', 'Tiee-Banc-24'); await clic('web:setup'); await clic('web:m:network'); await clic('web:o:network');
await remplir('web:http', '8080'); await clic('web:nset', 200);
await remplir('web:url', 'http://192.168.10.12'); await clic('web:go', 200);
T.check('port HTTP 8080 : sans le port, connexion refusée', await ev(() => /port 8080/.test(document.querySelector('#labo .tz-err')?.textContent || '')));
await remplir('web:url', 'http://192.168.10.12:8080'); await clic('web:go', 200);
T.check('avec :8080, la page répond', await ev(() => !document.querySelector('#labo .tz-err') && !!document.querySelector('#labo .tz-cam')));

// ---------------- 7-8. le pupitre ----------------
await ev(() => window.__dbg.labo().changer('ptz', { vue: 'pupitre' })); await A.waitForTimeout(200);
await clic('rp:b:system'); await clic('rp:sys:rpip'); await remplir('rp:ip', '192.168.10.10'); await clic('rp:ipset', 200);
T.check('la passerelle d\'usine du pupitre, hors du nouveau réseau, est refusée', await ev(() => /PASSERELLE/.test(document.querySelector('#labo .tz-rp-msg')?.textContent || '')));
await remplir('rp:passerelle', '192.168.10.1'); await clic('rp:ipset', 200);
T.check('le pupitre en 192.168.10.10 (étape 8)', await etape('pupitre'));
await clic('rp:retour'); await clic('rp:sys:manual');
for (const [n, ip] of [[1, '192.168.10.11'], [2, '192.168.10.12'], [3, '192.168.10.13']]) await remplir(`rp:cam${n}:ip`, ip);
await clic('rp:camset', 200);
T.check('sans CONNECT SETTING, les numéros ne sont pas en LAN', await ev(() => /CONNECT SETTING/.test(document.querySelector('#labo .tz-rp-table')?.textContent || '')));
await clic('rp:retour'); await clic('rp:sys:connect');
for (const n of [1, 2, 3]) await clic(`rp:mode${n}:LAN`, 100);
await clic('rp:retour'); await clic('rp:sys:manual');
T.check('CAM 2 appelée sur le port 80 : refusée, la raison est dite', await ev(() => /port 8080/.test(document.querySelector('#labo .tz-rp-table')?.textContent || '')));
await remplir('rp:cam2:port', '8080'); await clic('rp:camset', 200);
T.check('trois caméras enregistrées, leurs touches allumées (étape 9)', (await etape('enregistrer')) && await ev(() => document.querySelectorAll('#labo .tz-rp-key.ok').length === 3));
await shot('07-pupitre');

// ---------------- 9. la QoS du switch ----------------
await ev(() => window.__dbg.labo().changer('ptz', { vue: 'banc', transfert: 90 })); await A.waitForTimeout(200);
T.check('lien engorgé, une seule file : la vidéo perd des paquets', await ev(() => !window.__dbg.labo().mesures('ptz').qos.ok));
await clic('switch.qos.confiance:dscp'); await clic('switch.qos.files:prio', 200);
T.check('confiance DSCP et file prioritaire : la vidéo passe (étape 10)', (await etape('qos')) && await ev(() => window.__dbg.labo().mesures('ptz').qos.ok));
await shot('08-qos');

// ---------------- 10. la recette au joystick ----------------
await ev(() => window.__dbg.labo().changer('ptz', { vue: 'pupitre' })); await A.waitForTimeout(150);
await A.click('#labo .tz-rp-key[aria-label^="Caméra 1,"]'); await A.waitForTimeout(80); await A.click('#labo [aria-label="Pan vers la droite"]'); await A.waitForTimeout(80);
T.check('ENABLE éteint : le joystick est verrouillé', await ev(() => /ENABLE/.test(document.querySelector('#labo .tz-rp-msg')?.textContent || '')));
await clic('rp:enable');
for (const n of [1, 2, 3]) { await A.click(`#labo .tz-rp-key[aria-label^="Caméra ${n},"]`); await A.waitForTimeout(80); await A.click('#labo [aria-label="Pan vers la droite"]'); await A.waitForTimeout(80); }
T.check('la commande HTTP Panasonic est affichée (pan à droite à la vitesse de F1, tilt à l\'arrêt)', await ev(() => { const m = /cgi-bin\/aw_ptz\?cmd=%23PTS(\d\d)50&res=1/.exec(document.querySelector('#labo .tz-cmd')?.textContent || ''); return !!m && Number(m[1]) > 50; }), await ev(() => document.querySelector('#labo .tz-cmd')?.textContent));
await clic('rp:b:pmem'); await clic('rp:pmstore'); await clic('rp:pm1');
T.check('PMEM/TMEM : la position actuelle enregistrée sur le preset 1', await ev(() => !!document.querySelector('#labo .tz-pm.rempli.actuel')));
await clic('rp:b:pmem');
await clic('pgm:2', 150);
T.check('l\'entrée 2 au programme : la touche 2 du pupitre en rouge (tally), TALLY sur l\'écran d\'état', await ev(() => !!document.querySelector('#labo .tz-rp-key.air[aria-label^="Caméra 2,"]')));
await shot('08-pupitre-tally');
T.check('les onze étapes sont faites, la recette réussie', await ev(() => window.__dbg.labo().mesures('ptz').etapes.every((e) => e.fait) && window.__dbg.labo().mesures('ptz').recette.ok));
await ev(() => window.__dbg.labo().changer('ptz', { vue: 'fiche' })); await A.waitForTimeout(150);
await shot('09-fiche-recette');

// ---------------- un défi joué seul : trois caméras sorties du carton ----------------
await ev(() => { window.__dbg.labo().LB.panneau = 'defis'; window.__dbg.labo().choisir('ptz'); }); await A.waitForTimeout(200);
await A.click('#labo [data-defi="ptz-adresser"]'); await A.waitForTimeout(300);
const run = () => ev(() => { const R = window.__dbg.labo().RUN; return { k: R.k, plan: R.items[0] && window.__dbg.labo().STATES.ptz.plan }; });
const { plan } = await run();
await clic('eip:search', 200);
T.check('le défi : CAM 3 (AW-UE20, plus de 20 min) n\'apparaît pas dans Easy IP Setup', await ev(() => [...document.querySelectorAll('#labo .tz-eip tbody tr')].length === 2));
await shot('10-defi-20min');
for (const [id, ip] of [['cam1', plan.cams.cam1], ['cam2', plan.cams.cam2]]) {
  await clic('eip:' + id); await clic('eip:network'); await remplir('eip:ip', ip); await remplir('eip:masque', plan.masque); await remplir('eip:passerelle', plan.passerelle); await clic('eip:save', 200);
}
// redémarrer CAM 3 : couper puis rendre le PoE de son port (le banc)
await ev(() => window.__dbg.labo().changer('ptz', { vue: 'banc' })); await A.waitForTimeout(150);
await A.selectOption(k('switch.ports.4.poe'), 'off'); await A.waitForTimeout(100); await A.selectOption(k('switch.ports.4.poe'), 'at'); await A.waitForTimeout(100);
await ev(() => window.__dbg.labo().changer('ptz', { vue: 'pc', pcApp: 'easyip' })); await A.waitForTimeout(150);
await clic('eip:search', 200);
T.check('redémarrée, CAM 3 réapparaît', await ev(() => [...document.querySelectorAll('#labo .tz-eip tbody tr')].length === 3));
await clic('eip:cam3'); await clic('eip:network'); await remplir('eip:ip', plan.cams.cam3); await remplir('eip:masque', plan.masque); await remplir('eip:passerelle', plan.passerelle); await clic('eip:save', 200);
await clic('defi:verifier', 200);
T.check('réglage vérifié : juste', await ev(() => !!document.querySelector('#labo .lb-fb.ok')));
await clic('defi:suivante', 200);
await ev(() => { const it = window.__dbg.labo().RUN.items[1]; const i = document.querySelector('#labo .lb-input'); i.value = it.accept[0]; i.dispatchEvent(new Event('input')); });
await clic('defi:valider', 150); await clic('defi:suivante', 150);
await ev(() => { const it = window.__dbg.labo().RUN.items[2]; const b = [...document.querySelectorAll('#labo .lb-ch')].find((x) => x.textContent === it.choices[0]); b.click(); });
await clic('defi:valider', 150); await clic('defi:suivante', 300);
T.check('le défi : 100 / 100, réussi seul, noté dans la progression', await ev(() => /100 \/ 100/.test(document.querySelector('#labo .lb-fin')?.textContent || '') && window.__dbg.PROG.labo.defis['ptz-adresser'].seul));
await shot('11-defi-resultat');

// ---------------- un défi avec la solution : le pupitre réglé à la place de l'élève ----------------
await ev(() => window.__dbg.labo().commencer('ptz-pupitre')); await A.waitForTimeout(300);
await clic('defi:solution', 300);
T.check('la solution règle le pupitre : trois caméras connectées', await ev(() => window.__dbg.labo().mesures('ptz').pupitre.filter((l) => l.ok).length === 3));
await shot('12-solution-pupitre');

// ---------------- le Cours : le chapitre et l'exercice x-labo-ptz ----------------
await ev(() => window.__dbg.labo().LB && document.querySelector('#labo .lb-quit').click()); await A.waitForTimeout(200);
await ev(() => window.__dbg.emit('cours', { lesson: 'ptz-easyip' })); await A.waitForTimeout(800);
T.check('la leçon Easy IP Setup range l\'exercice « Le Labo : Caméras PTZ et réseau »', await ev(() => /Easy IP Setup/.test(document.getElementById('layer')?.textContent || '') && /Le Labo : Caméras PTZ et réseau/.test(document.getElementById('layer')?.textContent || '')));
await shot('13-lecon', 500);

// ---------------- 390 px : rien ne déborde ----------------
await A.keyboard.press('Escape'); await A.waitForTimeout(300);
await ev(() => window.__dbg.emit('labo', { atelier: 'ptz' })); await A.waitForTimeout(300);
await A.setViewportSize({ width: 390, height: 844 }); await A.waitForTimeout(300);
for (const v of ['cablage', 'banc', 'pc', 'pupitre', 'fiche']) {
  await ev((x) => window.__dbg.labo().changer('ptz', { vue: x }), v); await A.waitForTimeout(250);
  const ov = await ev(() => { const L = document.getElementById('labo'); const w = L.clientWidth; return [...L.querySelectorAll('.lb-work *, .lb-side *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > w + 1 && !e.closest('.lb-tabs') && !e.closest('.tz-tablewrap') && !e.closest('.tz-scroll'); }).map((e) => e.className || e.tagName).slice(0, 4); });
  T.check(`390 px, ${v} : rien ne dépasse`, ov.length === 0, JSON.stringify(ov));
  await shot('14-mobile-' + v);
}
await ev(() => window.__dbg.labo().LB.open && document.querySelector('#labo .lb-quit').click());
T.check('pas d\'erreur dans la page', T.errors.length === 0, T.errors.slice(0, 3).join('\n'));
await T.finish();
