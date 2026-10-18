import { launch, openPage } from '../tests/e2e/harness.mjs';
const browser = await launch();
const page = await openPage(browser, { viewport: { width: 800, height: 500 }, query: '' });
await page.waitForFunction(() => window.__dbg, null, { timeout: 30000 });
await page.evaluate(() => window.__dbg.start('standard', 'jour', 'moyenne', false));
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const D = window.__dbg; const R = D.renderer; R.info.autoReset = false;
  const res = {};
  R.info.reset(); D.S.cams[0].render(R, D.W.scene); res.cam1 = { calls: R.info.render.calls, tris: R.info.render.triangles };
  R.info.reset(); D.W.scene.traverse(()=>{}); 
  R.info.reset();
  R.info.autoReset = true;
  res.crowd = D.W.crowd.count; res.textures = R.info.memory.textures; res.geoms = R.info.memory.geometries; res.programs = R.info.programs.length;
  return res;
});
console.log(JSON.stringify(r));
await browser.close();
