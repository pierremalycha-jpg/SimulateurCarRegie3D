// Les bruitages de l'interface (src/game/sons.js, src/game/sfx.js), rendus pour de vrai dans le navigateur :
// chaque son passe par la chaîne de sortie (réverbération, compresseur) dans un OfflineAudioContext ; aucun ne
// sature, aucun n'est muet, le survol reste le plus discret. Puis les gestes : un clic sur une carte de Jouer, un
// interrupteur, un curseur de volume, une fenêtre, chacun avec son son. La planche d'écoute (tous les sons à la
// suite, un fichier WAV) est écrite avec les captures : planche-sons.wav et planche-sons.txt.
// node tests/e2e/sons.mjs [dossier]
import fs from 'node:fs';
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('sons');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors });
const ev = (f, a) => page.evaluate(f, a);

// ---------------- rendu hors ligne de chaque son ----------------
const R = await ev(async () => {
  const D = window.__dbg.sfx, out = [];
  for (const n of D.noms()) { const r = await D.rendre(n); if (r) out.push({ name: n, peak: r.peak, rms: r.rms, duree: r.duree }); }
  return out;
});
T.check('trente-cinq sons au moins, tous rendus', R.length >= 35, String(R.length));
for (const r of R) T.check(`${r.name} : ni saturé ni muet (crête ${r.peak.toFixed(3)})`, Number.isFinite(r.peak) && r.peak > 0.004 && r.peak < 0.95);
const crete = Object.fromEntries(R.map((r) => [r.name, r.peak]));
T.check('le survol est le plus discret', R.every((r) => r.name === 'hover' || crete.hover <= r.peak), crete.hover.toFixed(3));
T.check('une réussite sonne plus fort qu\'un clic', crete.confirm > crete.ui && crete.mission > crete.ui && crete.levelup > crete.press);
const db = (n) => 20 * Math.log10(crete[n]);
T.check('les gestes fréquents restent discrets (sous −24 dBFS)', ['hover', 'ui', 'press', 'tap', 'tab', 'toggleOn', 'toggleOff', 'fold', 'dialog', 'xp', 'tally'].every((n) => db(n) < -24));
T.check('le refus est plus discret qu\'une réussite', crete.error < crete.confirm, `${db('error').toFixed(1)} / ${db('confirm').toFixed(1)} dBFS`);
T.check('une étape validée, un bon quiz : sous une mission réussie, sous un passage de niveau', crete.step < crete.mission && crete.quizok < crete.mission && crete.mission < crete.levelup);

// ---------------- la planche d'écoute : tous les sons à la suite, 0,4 s entre deux ----------------
const planche = await ev(async () => {
  const D = window.__dbg.sfx, bufs = [];
  for (const n of D.noms()) { const r = await D.rendre(n); if (r) bufs.push([n, r.buffer]); }
  const sr = 44100, gap = Math.round(sr * 0.4);
  // la queue de réverbération est coupée au premier silence durable (−60 dB)
  const fin = (b) => { let k = 0; for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = d.length - 1; i > k; i--) if (Math.abs(d[i]) > 0.001) { k = i; break; } } return k + 1; };
  const total = bufs.reduce((s, [, b]) => s + fin(b) + gap, gap);
  const L = new Float32Array(total), Rr = new Float32Array(total), marques = [];
  let o = gap;
  for (const [n, b] of bufs) { const len = fin(b); L.set(b.getChannelData(0).subarray(0, len), o); Rr.set(b.getChannelData(1).subarray(0, len), o); marques.push(`${(o / sr).toFixed(2).padStart(6)} s  ${n}`); o += len + gap; }
  const bytes = new Uint8Array(44 + total * 4), v = new DataView(bytes.buffer);
  const str = (p, s) => { for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + total * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, total * 4, true);
  for (let i = 0; i < total; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i])) * 32767, true); }
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { b64: btoa(s), marques, secondes: total / sr };
});
fs.writeFileSync(`${OUT}/planche-sons.wav`, Buffer.from(planche.b64, 'base64'));
fs.writeFileSync(`${OUT}/planche-sons.txt`, `Planche d'écoute des bruitages (${planche.secondes.toFixed(1)} s), dans l'ordre :\n${planche.marques.join('\n')}\n`);
T.check('planche d\'écoute écrite', planche.secondes > 10, planche.secondes.toFixed(1) + ' s');

// ---------------- les gestes, dans la page ----------------
const dernier = () => ev(() => window.__dbg.sfx.etat().dernier);
await page.mouse.click(5, 5); // un premier geste : le contexte audio se crée
const lieu = page.locator('#start .lx').first();
if (await lieu.count()) { await lieu.click(); T.check('une carte de Jouer : « select »', await until(page, () => window.__dbg.sfx.etat().dernier === 'select', null, 3000), await dernier()); }
const seg = page.locator('#start .seg button:not(.on)').first();
if (await seg.count()) { await seg.click(); T.check('un interrupteur : « toggleOn » ou « toggleOff »', /^toggle(On|Off)$/.test(await dernier()), await dernier()); }
await ev(() => window.__dbg.emit('settings'));
T.check('une fenêtre qui s\'ouvre : « open »', await until(page, () => window.__dbg.sfx.etat().dernier === 'open', null, 3000), await dernier());
const curseur = page.locator('#modal input[type="range"]').first();
if (await curseur.count()) {
  await curseur.focus(); await page.keyboard.press('ArrowRight');
  T.check('un curseur de volume : un cran sonore', await until(page, () => window.__dbg.sfx.etat().dernier === 'curseur', null, 3000), await dernier());
}
await page.keyboard.press('Escape');
T.check('la fenêtre se ferme : « close »', await until(page, () => window.__dbg.sfx.etat().dernier === 'close', null, 3000), await dernier());
await ev(() => { window.__dbg.sfx.JEU.sfx = false; });
const avant = await ev(() => window.__dbg.sfx.etat().joues);
await ev(() => window.__dbg.emit('settings')); await page.keyboard.press('Escape');
T.check('bruitages coupés : plus rien ne sonne', (await ev(() => window.__dbg.sfx.etat().joues)) === avant);
await ev(() => { window.__dbg.sfx.JEU.sfx = true; });
await T.finish();
