// @ts-check
// ----------------------------------------------------------------------------------
// Lecture asynchrone des pixels d'une cible de rendu (WebGL 2). readRenderTargetPixels est
// synchrone : le processeur attend que la carte graphique ait fini tout ce qui précède, rendu
// des caméras compris (mesuré avec ?perf : l'essentiel du temps d'une image). Ici la copie part
// dans un tampon de la carte (PBO), suivie d'une barrière ; les pixels sont récupérés à une
// image suivante, quand la barrière est franchie, sans jamais attendre.
// ----------------------------------------------------------------------------------
/**
 * @param {import('three').WebGLRenderer} renderer
 * @param {number} w @param {number} h taille lue (depuis le coin bas gauche), RGBA 8 bits
 */
export function makeReader(renderer, w, h) {
  const gl = /** @type {WebGL2RenderingContext} */ (renderer.getContext());
  const pbo = gl.createBuffer();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, w * h * 4, gl.STREAM_READ); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  /** @type {WebGLSync | null} */ let sync = null;
  return {
    get busy() { return !!sync; },
    // à appeler juste après avoir dessiné dans rt ; false si une lecture est déjà en cours
    request(rt) {
      if (sync) return false;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      renderer.setRenderTarget(prev);
      return true;
    },
    // true quand les pixels de la dernière demande ont été copiés dans out
    poll(out) {
      if (!sync || gl.getSyncParameter(sync, gl.SYNC_STATUS) !== gl.SIGNALED) return false;
      gl.deleteSync(sync); sync = null;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return true;
    },
  };
}
