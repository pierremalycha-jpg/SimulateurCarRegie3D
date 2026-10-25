// Session à plusieurs : deux pages (hôte formateur + truquiste) reliées par une « room » simulée
// node tests/e2e/session.mjs [dossier]
import { launch, openPage, outDir } from './harness.mjs';
const OUT = outDir('session');
const browser = await launch();
const errors = []; let fails = 0;
const log = (...a) => console.log(...a);
const check = (n, ok, x = '') => { if (!ok) fails++; log(ok ? 'OK  ' : 'FAIL', n, x); };
// ---- room simulée : le serveur est ici, chaque page a un client ----
const pages = []; const rooms = {}; // name -> Map(peer -> {presence, page})
function deliver(page, fn, arg) { return page.evaluate(([f, a]) => window.__mock && window.__mock[f](a), [fn, arg]).catch(() => {}); }
async function broadcastPeers(name) {
  const R = rooms[name]; if (!R) return;
  const list = [...R.entries()].map(([peer, v]) => ({ peer, by: v.uid, kind: 'viewer', guest: false, presence: v.presence, updatedAt: Date.now() }));
  // aux pages en parallèle, comme un vrai serveur (une page lente ne retarde pas l'autre)
  await Promise.all([...R].map(([peer, v]) => deliver(v.page, 'peers', { name, list, me: peer })));
}
async function setup(page, id) {
  await page.exposeFunction('__srv', async (op, a) => {
    if (op === 'join') { (rooms[a.name] = rooms[a.name] || new Map()).set(id, { presence: {}, page, uid: 'u-' + id }); await broadcastPeers(a.name); return id; }
    if (op === 'presence') { const R = rooms[a.name]; const v = R && R.get(id); if (v) { v.presence = { ...v.presence, ...a.patch }; for (const k in a.patch) if (a.patch[k] === null) delete v.presence[k]; await broadcastPeers(a.name); } return true; }
    if (op === 'emit') { const R = rooms[a.name]; if (R) await Promise.all([...R].map(([peer, v]) => deliver(v.page, 'msg', { name: a.name, topic: a.topic, data: a.data, peer: id, sameTab: peer === id }))); return true; }
    if (op === 'leave') { const R = rooms[a.name]; if (R) { R.delete(id); await broadcastPeers(a.name); } return true; }
  });
  await page.addInitScript(() => {
    const L = { peers: {}, msg: {}, conn: [] }; let lastList = {};
    window.__mock = {
      peers({ name, list, me }) { const fr = list.map((p) => Object.freeze({ ...p, isMe: p.peer === me, sameTab: p.peer === me, presence: Object.freeze(p.presence) })); const old = lastList[name] || []; lastList[name] = fr; const joined = fr.filter((p) => !old.some((o) => o.peer === p.peer)); const left = old.filter((o) => !fr.some((p) => p.peer === o.peer)); for (const h of L.peers[name] || []) h({ peers: fr, joined, left, updated: fr }); },
      msg(m) { for (const h of (L.msg[m.name] || {})[m.topic] || []) h({ topic: m.topic, data: m.data, peer: m.peer, by: 'u-' + m.peer, isMe: m.sameTab, sameTab: m.sameTab, kind: 'viewer', guest: false }); },
    };
    const named = (name) => ({
      name,
      emit: (topic, data) => window.__srv('emit', { name, topic, data: JSON.parse(JSON.stringify(data ?? null)) }),
      on: (topic, h) => { ((L.msg[name] = L.msg[name] || {})[topic] = L.msg[name][topic] || []).push(h); return () => {}; },
      presence: (patch) => window.__srv('presence', { name, patch: JSON.parse(JSON.stringify(patch)) }),
      peers: () => lastList[name] || [],
      onPeers: (h) => { (L.peers[name] = L.peers[name] || []).push(h); return () => {}; },
      connected: () => true,
      onConnection: (h) => { setTimeout(() => h(true), 10); return () => {}; },
      leave: () => window.__srv('leave', { name }),
    });
    const room = { join: async (name) => { await window.__srv('join', { name }); return named(name); }, emit: async () => {}, on: () => () => {}, presence: async () => {}, peers: () => [], onPeers: () => () => {}, connected: () => true, onConnection: () => () => {} };
    window.claude = { use: async (n) => (n === 'room' ? room : null) };
  });
}
async function newPage(id, vw = 1280, vh = 800) {
  const page = await openPage(browser, { viewport: { width: vw, height: vh }, errors, id, before: async (page) => { await setup(page, id); } });
  pages.push(page);
  return page;
}
const A = await newPage('host');   // formateur, hôte
const B = await newPage('mix');    // truquiste
const evA = (f, a) => A.evaluate(f, a), evB = (f, a) => B.evaluate(f, a);
// A crée la session comme formateur
await A.locator('.jo-team-seg button[data-v="coop"]').click(); await A.locator('#st-antenne').click();
await A.waitForTimeout(500);
await A.locator('#ses-pseudo').fill('Alice');
await A.locator('.ses-role', { hasText: 'Formateur' }).click();
await A.locator('input[aria-label="Code de la partie"]').fill('test1');
await A.locator('#modal button', { hasText: 'Créer la partie' }).click();
await A.waitForTimeout(6000);
check('A : session active, hôte', await evA(() => window.__dbg.SES.active && window.__dbg.S.mode === 'fps'));
// B rejoint comme truquiste
await B.locator('.jo-team-seg button[data-v="coop"]').click(); await B.locator('#st-antenne').click();
await B.waitForTimeout(500);
await B.locator('#ses-pseudo').fill('Bruno');
await B.locator('#modal .tab', { hasText: 'Rejoindre une partie' }).click();
await B.locator('.ses-role', { has: B.locator('b', { hasText: /^Truquiste$/ }) }).click();
await B.locator('input[aria-label="Code de la partie"]').fill('test1');
await B.locator('#modal button.primary', { hasText: /^Rejoindre la partie$/ }).click();
// B charge le car puis rattrape le match de A : on attend la condition (rendu logiciel lent, deux pages) plutôt qu'un délai fixe
await B.waitForFunction(() => window.__dbg && window.__dbg.SES.follower && window.__dbg.SES.buf.length > 0 && window.__dbg.SES.peers.length === 2, null, { timeout: 120000, polling: 500 }).catch(() => {});
await B.waitForTimeout(3000);
const st = await evB(() => ({ act: window.__dbg.SES.active, fol: window.__dbg.SES.follower, peers: window.__dbg.SES.peers.length, buf: window.__dbg.SES.buf.length, mode: window.__dbg.S.mode }));
log('B', JSON.stringify(st));
check('B suit le match de A', st.fol && st.buf > 0 && st.peers === 2);
check('pseudos échangés', (await evA(() => window.__dbg.SES.peers.map((p) => p.presence && p.presence.name).sort().join(','))) === 'Alice,Bruno');
// même match : position du ballon proche (B a 0,3 s de retard)
// les deux pages lues en même temps : en rendu logiciel, une page peut attendre la fin d'une image (plusieurs
// secondes) avant de répondre ; on relit jusqu'à deux lectures à moins d'une seconde l'une de l'autre
const lire = () => [window.__dbg.M.ball.x, window.__dbg.M.ball.z, window.__dbg.S.simTime, Date.now()];
let bA, bB;
for (let i = 0; i < 8; i++) { [bA, bB] = await Promise.all([evA(lire), evB(lire)]); if (Math.abs(bB[3] - bA[3]) < 1000) break; await A.waitForTimeout(500); }
log('ballon A', bA.slice(0, 3).map((v) => v.toFixed(2)).join(' '), ' B', bB.slice(0, 3).map((v) => v.toFixed(2)).join(' '), ' lectures à', bB[3] - bA[3], 'ms d\'écart');
check('temps de match aligné (écart < 3 s)', Math.abs(bB[3] - bA[3]) < 1000 && Math.abs(bA[2] - bB[2]) < 3, (bA[2] - bB[2]).toFixed(2));
// B commute : A voit le mélangeur bouger
await evB(() => window.__dbg.openStation('melangeur'));
await B.waitForTimeout(800);
await B.keyboard.press('Digit4');
// la présence est publiée au rythme des images : on attend la condition (rendu logiciel lent) plutôt qu'un délai fixe
await A.waitForFunction(() => window.__dbg.MIX.pgm === 4, null, { timeout: 30000, polling: 250 }).catch(() => {});
check('A reçoit la commutation de B (PGM 4)', await evA(() => window.__dbg.MIX.pgm) === 4, String(await evA(() => window.__dbg.MIX.pgm)));
// A (non truquiste) ne peut pas commuter
await A.keyboard.press('Digit2');
await A.waitForTimeout(500);
check('A bloqué au mélangeur', await evA(() => window.__dbg.MIX.pgm) === 4);
// A ouvre le mélangeur : lecture seule
await evA(() => window.__dbg.openStation('melangeur'));
await A.waitForTimeout(800);
check('mélangeur verrouillé chez A', await evA(() => document.getElementById('station').classList.contains('ses-lock')));
await A.screenshot({ path: OUT + '/s1-A-lock.png' });
// ordre du réalisateur : A passe réalisateur et ordonne « Prépare la 3 »
await evA(() => { window.__dbg.closeStation(); window.__dbg.openStation('realisateur'); });
await A.waitForTimeout(800);
await A.locator('#station .hwpanel .hw').filter({ hasText: 'CAM 3' }).first().click();
await B.waitForFunction(() => /Prépare la 3/.test(document.getElementById('order-osd')?.textContent || ''), null, { timeout: 20000, polling: 100 }).catch(() => {});
const osd = await evB(() => document.getElementById('order-osd')?.textContent || '');
check('B reçoit l\'ordre « Prépare la 3 »', /Prépare la 3/.test(osd), osd);
await B.screenshot({ path: OUT + '/s2-B-ordre.png' });
await B.keyboard.press('KeyB'); await B.keyboard.press('Digit3');
await A.waitForFunction(() => window.__dbg.MIX.pst === 3, null, { timeout: 30000, polling: 250 }).catch(() => {});
const pB = await evB(() => [window.__dbg.MIX.pst, window.__dbg.MIX.pgm, document.activeElement?.tagName, window.__dbg.S.mode, window.__dbg.S.station, window.__dbg.COMMUT.mode]);
log('B mix', JSON.stringify(pB));
check('A voit le preset 3 de B', await evA(() => window.__dbg.MIX.pst) === 3, String(await evA(() => window.__dbg.MIX.pst)));
// le formateur injecte une panne son (pas de titulaire : l'hôte détient le son) puis une panne côté mélangeur… ici EVS
await evA(() => { window.__dbg.closeStation(); });
await A.locator('#ses-chip').click(); await A.waitForTimeout(600);
await A.locator('#modal .tab', { hasText: 'Formateur' }).click(); await A.waitForTimeout(400);
await A.locator('#modal select').first().selectOption('evsrec');
await A.locator('#modal button', { hasText: 'Injecter' }).click();
await B.waitForFunction(() => window.__dbg.EVS.recording === false, null, { timeout: 30000, polling: 250 }).catch(() => {});
check('panne EVS appliquée chez B', (await evB(() => window.__dbg.EVS.recording)) === false);
await A.screenshot({ path: OUT + '/s3-A-formateur.png' });
// commentaires relayés
await A.waitForTimeout(6000);
const cm = await evB(() => window.__dbg.CMT.log.filter((l) => l.remote).length);
log('commentaires relayés chez B', cm);
await A.locator('#modal button', { hasText: 'Télécharger le compte rendu (HTML)' }).click().catch(() => {});
log('ERRORS', errors.length, errors.slice(0, 6).join('\n'));
log('FAILS', fails);
await browser.close();
process.exitCode = fails || errors.length ? 1 : 0;
