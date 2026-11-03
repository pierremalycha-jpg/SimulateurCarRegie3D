// Le Labo (v19.28) : il remplace l'entrepôt dans Jouer. Les cinq ateliers (optique, photométrie,
// sensitométrie, DMX et Art-Net, console dot2) s'ouvrent par leurs onglets ; chacun dessine et calcule ;
// un défi se joue jusqu'au résultat (une fois avec la solution : pas seul ; une fois seul : XP, livret) ;
// les réglages imposés se verrouillent ; le panneau « Comprendre » ouvre une fiche « ? » ; la console dot2
// se charge dans son cadre ; Échap ramène à Jouer, sur le Labo ; ouvert depuis une leçon du Cours, on y
// revient ; à 390 px, rien ne déborde.
// node tests/e2e/labo.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('labo');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { errors: T.errors });
const ev = (f, a) => A.evaluate(f, a);
const shot = async (n, w = 400) => { await A.waitForTimeout(w); await A.screenshot({ path: `${OUT}/${n}.png` }); };

// ---------------- Jouer : le lieu « Le Labo » et ses ateliers ----------------
T.check('Jouer : trois lieux, le Labo à la place de l\'entrepôt', await ev(() => [...document.querySelectorAll('#start .jo-lieux .lx')].map((b) => b.dataset.lieu).join(',') === 'car,labo,concert'));
await A.click('.lx[data-lieu="labo"]'); await A.waitForTimeout(300);
T.check('le Labo : un mode par atelier (5), la coopération désactivée', await ev(() => [...document.querySelectorAll('#start .jo-mode')].map((b) => b.dataset.mode).join(',') === 'labo:optique,labo:photometrie,labo:sensito,labo:dmx,labo:dot2' && document.querySelector('.jo-team-seg [data-v="coop"]').disabled));
await shot('01-jouer');
await A.click('.jo-mode[data-mode="labo:optique"]'); await A.click('#st-antenne');
T.check('l\'atelier Optique s\'ouvre plein écran, la boucle du car en pause', await until(A, () => window.__dbg.labo().LB.open && !document.getElementById('labo').hidden && document.querySelectorAll('#labo .lb-tab').length === 5 && !!document.querySelector('#labo .lb-optique canvas'), null, 20000));
T.check('cinq onglets, celui d\'Optique sélectionné', await ev(() => document.querySelector('#labo .lb-tab[aria-selected="true"]')?.dataset.atelier === 'optique'));
await shot('02-optique', 800);

// ---------------- Optique : les commandes changent les mesures ----------------
const zone = () => ev(() => document.querySelector('#labo .lb-optique .lb-read b')?.textContent || '');
const z0 = await zone();
await A.click('#labo [data-k="N"][data-v="16"]'); await A.waitForTimeout(200);
T.check('fermer l\'iris agrandit la zone nette (afficheur changé)', (await zone()) !== z0, `${z0} → ${await zone()}`);
T.check('trois sujets décrits (tache et net/flou)', await ev(() => document.querySelectorAll('#labo .lb-taches li').length === 3));

// ---------------- un défi avec la solution : terminé, pas seul ----------------
await A.click('#labo [data-defi="opt-isoler"]'); await A.waitForTimeout(300);
T.check('le défi commence : question 1/3, un réglage, le capteur imposé et verrouillé', await ev(() => /Question 1 \/ 3/.test(document.querySelector('#labo .lb-run')?.textContent || '') && !!document.querySelector('#labo [data-k="defi:verifier"]') && document.querySelector('#labo [data-k="capteur"]').closest('.lb-ctl').classList.contains('locked')));
await shot('03-defi-question', 300);
await A.click('#labo [data-k="defi:verifier"]'); await A.waitForTimeout(200);
T.check('un réglage faux est refusé et expliqué', await ev(() => !!document.querySelector('#labo .lb-fb.bad') && document.querySelector('#labo .lb-fb').textContent.length > 20));
await A.click('#labo [data-k="defi:aide"]'); await A.waitForTimeout(150);
T.check('l\'indice s\'affiche', await ev(() => /Indice/.test(document.querySelector('#labo .lb-aides')?.textContent || '')));
await A.click('#labo [data-k="defi:solution"]'); await A.waitForTimeout(300);
T.check('la solution règle l\'atelier : B net, A et C flous', await ev(() => { const m = window.__dbg.labo(); const st = m.STATES.optique; return st.f >= 100 && document.querySelectorAll('#labo .lb-taches li.ok').length === 1; }));
await A.click('#labo [data-k="defi:suivante"]'); await A.waitForTimeout(200);
// question 2 (un nombre) : la bonne réponse ; question 3 (un choix) : le bon choix
await ev(() => { const R = window.__dbg.labo().RUN; const it = R.items[1]; const i = document.querySelector('#labo .lb-input'); i.value = String(it.answer).replace('.', ','); i.dispatchEvent(new Event('input')); });
await A.click('#labo [data-k="defi:valider"]'); await A.waitForTimeout(200);
T.check('une réponse juste (virgule française) est acceptée', await ev(() => !!document.querySelector('#labo .lb-fb.ok')));
await A.click('#labo [data-k="defi:suivante"]'); await A.waitForTimeout(200);
await ev(() => { const it = window.__dbg.labo().RUN.items[2]; const b = [...document.querySelectorAll('#labo .lb-ch')].find((x) => x.textContent === (Array.isArray(it.choices[it.answer]) ? it.choices[it.answer][0] : it.choices[it.answer])); b.click(); });
await A.waitForTimeout(150);
await A.click('#labo [data-k="defi:valider"]'); await A.waitForTimeout(200);
await A.click('#labo [data-k="defi:suivante"]'); await A.waitForTimeout(300);
T.check('le résultat : 67 / 100, réussi mais pas seul (solution demandée)', await ev(() => { const t = document.querySelector('#labo .lb-fin')?.textContent || ''; const d = window.__dbg.PROG.labo.defis['opt-isoler']; return /67 \/ 100/.test(t) && /à refaire seul/.test(t) && d && d.best === 67 && !d.seul; }), await ev(() => document.querySelector('#labo .lb-fin')?.textContent));
await shot('04-defi-resultat', 300);
T.check('fini : plus rien d\'imposé', await ev(() => window.__dbg.labo().VERROUS.size === 0 && !document.querySelector('#labo .lb-ctl.locked')));

// ---------------- un défi réussi seul : XP, livret, badge ----------------
await A.click('#labo [data-k="defi:refaire"]'); await A.waitForTimeout(300);
for (let k = 0; k < 3; k++) {
  await ev(() => {
    const L = window.__dbg.labo(); const it = L.RUN.items[L.RUN.k];
    if (it.type === 'reglage') { L.VERROUS.clear(); L.changer('optique', it.corrige); for (const x of Object.keys(it.fixe || {})) L.VERROUS.add(x); document.querySelector('#labo [data-k="defi:verifier"]').click(); return; }
    if (it.type === 'nombre') { const i = document.querySelector('#labo .lb-input'); i.value = String(it.answer); i.dispatchEvent(new Event('input')); }
    if (it.type === 'choix') { [...document.querySelectorAll('#labo .lb-ch')].find((x) => x.textContent === (Array.isArray(it.choices[it.answer]) ? it.choices[it.answer][0] : it.choices[it.answer])).click(); }
    document.querySelector('#labo [data-k="defi:valider"]').click();
  });
  await A.waitForTimeout(200);
  await A.click('#labo [data-k="defi:suivante"]'); await A.waitForTimeout(250);
}
T.check('réussi seul : 100 / 100, enregistré, l\'XP du défi et le badge Laborantin', await until(A, () => { const P = window.__dbg.PROG; const d = P.labo.defis['opt-isoler']; return d.seul && d.best === 100 && !!P.game.keys['labo:opt-isoler'] && !!P.game.badges.laborantin; }, null, 10000));
await A.click('#labo .lb-back'); await A.waitForTimeout(200);
T.check('la liste des défis : Isoler un sujet réussi seul (étoile)', await ev(() => document.querySelector('#labo .lb-dcard.ok')?.textContent.includes('Isoler un sujet')));

// ---------------- Comprendre : notions, fiches « ? », référentiel ----------------
await A.click('#labo .lb-sidetabs [data-p="comprendre"]'); await A.waitForTimeout(200);
T.check('Comprendre : notions, fiches, liens du Cours, compétences C23 et C19 citées', await ev(() => { const t = document.querySelector('#labo .lb-comp')?.textContent || ''; return document.querySelectorAll('#labo .lb-comp .co-chip').length === 4 && /C23/.test(t) && /C19/.test(t) && document.querySelectorAll('#labo .lb-lien').length === 3; }));
await A.click('#labo .lb-comp .co-chip[data-term="hyperfocale"]'); await A.waitForTimeout(300);
T.check('la fiche « Hyperfocale » s\'ouvre par-dessus le Labo', await ev(() => { const p = document.getElementById('termpop'); return !!p && !p.hidden && /Hyperfocale/.test(p.textContent) && Number(getComputedStyle(p).zIndex) > Number(getComputedStyle(document.getElementById('labo')).zIndex); }));
await shot('05-comprendre', 300);
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
T.check('Échap ferme la fiche, le Labo reste ouvert', await ev(() => window.__dbg.labo().LB.open && (!document.getElementById('termpop') || document.getElementById('termpop').hidden)));
await A.click('#labo .lb-sidetabs [data-p="defis"]');

// ---------------- Photométrie ----------------
await A.click('#labo .lb-tab[data-atelier="photometrie"]'); await A.waitForTimeout(400);
const lux = () => ev(() => document.querySelector('#labo .lb-photometrie .lb-read b')?.textContent || '');
const l0 = await lux();
await ev(() => window.__dbg.labo().changer('photometrie', { 'p1.d': 2 })); await A.waitForTimeout(200);
T.check('Photométrie : approcher le projecteur monte l\'éclairement', parseInt((await lux()).replace(/\s/g, '')) > parseInt(l0.replace(/\s/g, '')), `${l0} → ${await lux()}`);
await ev(() => window.__dbg.labo().changer('photometrie', { 'p2.on': true, 'p1.gel': 'ctb' })); await A.waitForTimeout(200);
T.check('le débouchage allumé : rapport de contraste affiché ; la commande « Couleur (LED) » cachée pour l\'halogène', await ev(() => /:1/.test(document.querySelector('#labo .lb-photometrie')?.textContent || '') && document.querySelector('#labo [data-k="p1.Tled"]').closest('.lb-ctl').hidden));
await shot('06-photometrie', 600);

// ---------------- Sensitométrie ----------------
await A.click('#labo .lb-tab[data-atelier="sensito"]'); await A.waitForTimeout(400);
await A.click('#labo [data-k="courbe"][data-v="slog3"]'); await A.waitForTimeout(200);
T.check('Sensitométrie : en S-Log3, le gris à 41 % et 14 diaphs de plage', await ev(() => { const t = document.querySelector('#labo .lb-sensito .lb-reads')?.textContent || ''; return /41 %/.test(t) && /14(,0)? diaphs/.test(t); }));
await ev(() => window.__dbg.labo().changer('sensito', { courbe: 'bt709', ciel: 5 })); await A.waitForTimeout(200);
T.check('en BT.709, un ciel à +5 diaphs écrête', await ev(() => /écrêté/.test(document.querySelector('#labo .lb-sensito .lb-reads')?.textContent || '')));
await shot('07-sensito', 500);

// ---------------- DMX et Art-Net : les quatre vues ----------------
await A.click('#labo .lb-tab[data-atelier="dmx"]'); await A.waitForTimeout(400);
T.check('DMX : quatre vues, le patch d\'abord (4 appareils, 9 commutateurs DIP)', await ev(() => document.querySelectorAll('#labo .lb-vues button').length === 4 && document.querySelectorAll('#labo .lb-prow:not(.lb-phead)').length === 4 && document.querySelectorAll('#labo .lb-dip').length === 9));
await A.fill('#labo [data-k="appareils.f2.adresse"]', '5'); await A.press('#labo [data-k="appareils.f2.adresse"]', 'Enter'); await A.waitForTimeout(200);
T.check('un chevauchement se voit : les deux appareils en conflit', await ev(() => document.querySelectorAll('#labo .lb-prow.bad').length === 2 && /conflit/.test(document.querySelector('#labo .lb-dmx .lb-vue:not([hidden]) .lb-reads')?.textContent || '')));
await A.click('#labo .lb-dip >> nth=3'); await A.waitForTimeout(200);
T.check('un commutateur DIP change l\'adresse de l\'appareil choisi (1 + 8 = 9)', await ev(() => window.__dbg.labo().STATES.dmx.appareils[0].adresse === 9));
await shot('08-dmx-patch', 300);
await A.click('#labo .lb-vues [data-vue="ligne"]'); await A.waitForTimeout(200);
await ev(() => window.__dbg.labo().changer('dmx', { 'ligne.recepteurs': 45, 'ligne.terminaison': false })); await A.waitForTimeout(150);
T.check('la ligne : 45 récepteurs sans terminaison, deux problèmes dits', await ev(() => document.querySelectorAll('#labo .lb-vue:not([hidden]) .lb-diag li.bad').length === 2));
await shot('09-dmx-ligne', 300);
await A.click('#labo .lb-vues [data-vue="reseau"]'); await A.waitForTimeout(200);
T.check('le réseau : la console (univers 1) joint le nœud (Port-Address 0)', await ev(() => /Oui/.test(document.querySelector('#labo .lb-dmx .lb-vue:not([hidden]) .lb-reads')?.textContent || '')));
await A.fill('#labo [data-k="noeud.uni"]', '1'); await A.press('#labo [data-k="noeud.uni"]', 'Enter'); await A.waitForTimeout(200);
T.check('Universe 1 sur le nœud : il ne reçoit plus, et l\'écart d\'un est expliqué', await ev(() => /Non/.test(document.querySelector('#labo .lb-dmx .lb-vue:not([hidden]) .lb-reads')?.textContent || '') && /Port-Address 0/.test(document.querySelector('#labo .lb-dmx .lb-vue:not([hidden]) .lb-diag')?.textContent || '')));
await shot('10-dmx-reseau', 300);
await A.click('#labo .lb-vues [data-vue="valeurs"]'); await A.waitForTimeout(200);
T.check('les valeurs : un fader par canal de l\'appareil choisi', await ev(() => document.querySelectorAll('#labo .lb-fader').length === 8));

// ---------------- la console dot2 : programmer pour de vrai ----------------
await A.click('#labo .lb-tab[data-atelier="dot2"]');
T.check('la console dot2 se charge dans son cadre, le panneau des défis à côté (cinq défis)', await until(A, () => { const f = document.querySelector('#labo .lb-dot2-frame'); return !!f && !!f.contentWindow && !!f.contentWindow.__laboDot2 && !!f.contentDocument.querySelector('.hw-key') && !document.querySelector('#labo .lb-side').hidden && document.querySelectorAll('#labo .lb-dcard').length === 5; }, null, 90000));
await shot('11-dot2', 2500);
// un défi : la console reçoit le show de départ (16 projecteurs, aucune cue)
await A.click('#labo [data-defi="dot2-matricks"]'); await A.waitForTimeout(800);
const app = () => ev(() => { const S = document.querySelector('#labo .lb-dot2-frame').contentWindow.__laboDot2.console.show; return { fixtures: S.fixtures.length, cues: S.main.cues.length, execs: Object.keys(S.executors).length }; });
T.check('le défi charge le show de départ dans la console : 16 projecteurs, aucune cue', JSON.stringify(await app()) === JSON.stringify({ fixtures: 16, cues: 0, execs: 0 }), JSON.stringify(await app()));
const q0 = await ev(() => window.__dbg.labo().RUN.items[0].q);
const m = /cue \*\*(\d+)\*\*.*13 et 15\*\* en \*\*(\S+)\*\*.*14 et 16\*\* en \*\*(\S+)\*\*/i.exec(q0);
T.check('la consigne donne la cue et les deux couleurs', !!m, q0);
if (m) {
  const [, n, ca, cb] = m; const PRE = { rouge: '5', bleu: '3', vert: '6' };
  const F = A.frames().find((f) => f.url().startsWith('about:srcdoc'));
  const touche = async (t) => { await F.locator('.hw-key').filter({ hasText: new RegExp(`^${t.replace('.', '\\.')}$`) }).first().click({ delay: 90 }); await A.waitForTimeout(120); };
  const tape = async (seq) => { for (const t of seq.split(' ')) await touche(t); };
  // comme un élève au pupitre : le groupe des lyres, MAtricks Odd, la couleur, MAtricks Even, l'autre couleur, Reset, Store
  await tape('Group 9 At Full'); await tape('Please');
  await tape('Macro 5 Please'); await tape(`Preset 4 . ${PRE[ca]} Please`);
  await tape('Macro 6 Please'); await tape(`Preset 4 . ${PRE[cb]} Please`);
  await tape('Macro 1 2 Please'); await tape(`Store Cue ${n} Please`);
  await A.waitForTimeout(500);
  T.check('au pupitre : la cue est enregistrée dans la séquence principale', (await app()).cues >= 1, JSON.stringify(await ev(() => document.querySelector('#labo .lb-dot2-frame').contentWindow.__laboDot2.console.history.slice(-8).map((h) => h.text))));
  await A.click('#labo [data-k="defi:verifier"]'); await A.waitForTimeout(300);
  T.check('« Vérifier mon programme » : le Labo relit le show et le juge juste', await ev(() => !!document.querySelector('#labo .lb-fb.ok')), await ev(() => document.querySelector('#labo .lb-fb')?.textContent));
  await shot('12-dot2-verifie', 600);
  await A.click('#labo [data-k="defi:suivante"]'); await A.waitForTimeout(200);
  for (let k = 1; k < 3; k++) {
    await ev(() => {
      const L = window.__dbg.labo(); const it = L.RUN.items[L.RUN.k];
      if (it.type === 'nombre') { const i = document.querySelector('#labo .lb-input'); i.value = String(it.answer); i.dispatchEvent(new Event('input')); }
      if (it.type === 'choix') [...document.querySelectorAll('#labo .lb-ch')].find((x) => x.textContent === (Array.isArray(it.choices[it.answer]) ? it.choices[it.answer][0] : it.choices[it.answer])).click();
      document.querySelector('#labo [data-k="defi:valider"]').click();
    });
    await A.waitForTimeout(200); await A.click('#labo [data-k="defi:suivante"]'); await A.waitForTimeout(250);
  }
  T.check('le défi « Une lyre sur deux » réussi seul (100 / 100), compté', await ev(() => { const d = window.__dbg.PROG.labo.defis['dot2-matricks']; return !!d && d.seul && d.best === 100; }));
}
// un autre défi : le show en cours a des cues, le Labo demande avant de le remplacer ; la solution charge un show qui marche
await A.click('#labo .lb-back'); await A.waitForTimeout(200);
await A.click('#labo [data-defi="dot2-cercle"]');
T.check('un show programmé : confirmation avant de le remplacer', await until(A, () => !!document.querySelector('#ask'), null, 4000));
await A.locator('#ask [data-ask="ok"]').click(); await A.waitForTimeout(600);
await A.click('#labo [data-k="defi:solution"]'); await A.waitForTimeout(800);
T.check('la solution charge dans la console un exécuteur qui fait le cercle', (await app()).execs === 1);
await shot('13-dot2-solution', 1500);
await A.click('#labo .lb-replier'); await A.waitForTimeout(200);
T.check('« Masquer les défis » : la console prend toute la place', await ev(() => document.querySelector('#labo .lb-side').hidden && document.getElementById('labo').classList.contains('lb-replie')));
await A.click('#labo .lb-replier'); await A.waitForTimeout(200);

// ---------------- sortir : Échap ramène à Jouer, sur le Labo ----------------
await A.locator('#labo .lb-id h1').click();
await A.keyboard.press('Escape'); await A.waitForTimeout(300);
T.check('Échap : retour à Jouer, le lieu Labo et l\'atelier gardés', await ev(() => !window.__dbg.labo().LB.open && document.querySelector('.lx.on')?.dataset.lieu === 'labo' && document.querySelector('.jo-mode[aria-pressed="true"]')?.dataset.mode === 'labo:dot2'));
T.check('l\'atelier Optique dit un défi réussi sur 3', await ev(() => /1 défi réussi sur 3/.test(document.querySelector('.jo-mode[data-mode="labo:optique"]').textContent)));

// ---------------- depuis le Cours : l'exercice x-labo-dmx de la leçon « Le DMX » (chapitre La lumière) ----------------
await ev(() => window.__dbg.emit('cours', { lesson: 'lumiere-dmx' })); await A.waitForTimeout(800);
T.check('la leçon range l\'exercice « Le Labo : DMX et Art-Net »', await ev(() => /Le Labo : DMX et Art-Net/.test(document.getElementById('layer')?.textContent || '')));
await ev(() => { window.__dbg.S.coursBack = 'lumiere-dmx'; window.__dbg.emit('go', { labo: 'dmx' }); }); await A.waitForTimeout(500);
T.check('« Ouvrir l\'atelier » : le Labo sur DMX, le Cours refermé', await ev(() => window.__dbg.labo().LB.open && window.__dbg.labo().LB.atelier === 'dmx' && !document.getElementById('layer')));
await A.click('#labo .lb-quit'); await A.waitForTimeout(800);
T.check('en sortant, retour à la leçon', await ev(() => !!document.getElementById('layer') && /Le DMX/.test(document.getElementById('layer').textContent)));
await A.keyboard.press('Escape'); await A.waitForTimeout(300);

// ---------------- 390 px : rien ne déborde ----------------
await A.setViewportSize({ width: 390, height: 844 });
for (const at of ['optique', 'photometrie', 'sensito', 'dmx']) {
  await ev((at) => window.__dbg.emit('labo', { atelier: at }), at); await A.waitForTimeout(400);
  const ov = await ev(() => { const L = document.getElementById('labo'); const w = L.clientWidth; return [...L.querySelectorAll('.lb-work *, .lb-side *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > w + 1 && !e.closest('.lb-tabs'); }).map((e) => e.className || e.tagName).slice(0, 4); });
  T.check(`390 px, ${at} : rien ne dépasse`, ov.length === 0, JSON.stringify(ov));
  await A.screenshot({ path: `${OUT}/14-mobile-${at}.png` });
}
await ev(() => window.__dbg.labo().LB.open && document.querySelector('#labo .lb-quit').click());

T.check('pas d\'erreur dans la page', T.errors.length === 0, T.errors.slice(0, 3).join('\n'));
await T.finish();
