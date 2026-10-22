// @ts-check
import { el } from '../../../util.js';
import { cablesDe, autreBout, appareil } from '../../build.js';
import { section, note, etat, choix, coche, action, reseau, services, ecrire, formatLabel } from './kit.js';

// ----------------------------------------------------------------------------------
// Le menu d'un HyperDeck (Studio HD Plus, Studio HD Mini) : la source, le codec, le support,
// REMOTE (pilotage par l'ATEM ou un ordinateur, TCP 9993), le transport (REC, STOP) et le réseau.
// Ce que l'on règle sur l'écran de la face avant ou dans HyperDeck Setup. Clés lues par le
// moteur : source ('sdi' | 'hdmi'), codec, qualite, media ('sd1' | 'sd2' | 'usb'), distant,
// enregistre, reseau.
// ----------------------------------------------------------------------------------
/** @typedef {import('./kit.js').Appareil} Appareil */
/** @typedef {import('./kit.js').Modele} Modele */
/** @typedef {import('./kit.js').Ctx} Ctx */

const CODECS = /** @type {Array<[string, string]>} */ ([['H.264', 'H.264 (fichiers légers)'], ['ProRes HQ', 'ProRes 422 HQ'], ['ProRes 422', 'ProRes 422'], ['ProRes LT', 'ProRes 422 LT'], ['ProRes Proxy', 'ProRes 422 Proxy'], ['DNxHD 220x', 'DNxHD 220x'], ['DNxHD 145', 'DNxHD 145'], ['DNxHD 45', 'DNxHD 45']]);

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuEnregistreur(a, m, ctx) {
  const c = a.cfg;
  const srcs = /** @type {Array<[string, string]>} */ ([]);
  if (m.ports.some((p) => p.sig === 'sdi' && p.dir === 'in')) srcs.push(['sdi', 'SDI']);
  if (m.ports.some((p) => p.sig === 'hdmi' && p.dir === 'in')) srcs.push(['hdmi', 'HDMI']);
  const pin = m.ports.find((p) => p.sig === (c.source === 'hdmi' ? 'hdmi' : 'sdi') && p.dir === 'in');
  const f = pin ? ctx.E.video[`${a.uid}:${pin.id}`] : null;
  // les supports : ce qui est inséré dans chaque logement
  const supports = m.ports.filter((p) => p.sig === 'media' || p.sig === 'usb').map((p) => {
    const cb = cablesDe(a.uid, p.id)[0]; const o = cb ? appareil(autreBout(cb, a.uid).dev) : null;
    return /** @type {[string, string]} */ ([p.sig === 'usb' ? 'usb' : p.id, `${p.label} : ${o ? o.nom : 'vide'}`]);
  });
  const rec = !!c.enregistre;
  return [
    section('Entrée et codec',
      note('Écran de la face avant → Menu → Record. H.264 donne des fichiers légers ; ProRes et DNxHD, des fichiers lourds, plus simples à monter.'),
      srcs.length > 1 ? choix(a.uid, 'source', c.source || 'sdi', srcs, 'Source enregistrée') : el('p', { class: 'ep-cf-fixe' }, el('b', {}, 'Source'), ' : SDI (seule entrée vidéo)'),
      etat(f ? true : false, f ? `Reçoit ${f.label} (${formatLabel(f.format)}) sur ${pin ? pin.label : 'l\'entrée'}.` : `Rien n'arrive sur ${pin ? pin.label : 'l\'entrée'}.`),
      choix(a.uid, 'codec', c.codec || 'H.264', CODECS, 'Codec'),
      String(c.codec || 'H.264') === 'H.264' ? choix(a.uid, 'qualite', c.qualite || 'High', [['High', 'High'], ['Medium', 'Medium'], ['Low', 'Low']], 'Qualité H.264') : null),
    section('Support',
      note('Une carte SD dans SD 1 ou SD 2, ou un disque sur USB-C : le support choisi doit être présent (sortez une carte SD ou un disque du stock et branchez-le).'),
      choix(a.uid, 'media', c.media || 'sd1', supports, 'Enregistrer sur')),
    section('Transport',
      coche(a.uid, 'distant', c.distant !== false, 'REMOTE (pilotage par le réseau, TCP 9993)', { aide: 'Sur OFF, le HyperDeck refuse les ordres de l\'ATEM ou de vMix.' }),
      el('div', { class: 'ep-cf-row ep-cf-transport' },
        action('● REC', () => ecrire(a.uid, { enregistre: true }), rec ? 'rec on' : 'rec', `${a.uid}:rec`),
        action('■ STOP', () => ecrire(a.uid, { enregistre: false }), rec ? '' : 'on', `${a.uid}:stop`)),
      ...services(ctx, `${a.uid}:enregistre`)),
    reseau(a, ctx, { menu: 'Menu → Setup → Network du HyperDeck (DHCP d\'usine).' }),
  ].filter(Boolean).map((x) => /** @type {HTMLElement} */ (x));
}
