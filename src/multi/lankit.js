import { offerDownload } from '../shared.js';
import LISEZMOI from '../../lan/LISEZMOI.txt';
import BAT from '../../lan/Lancer le serveur (Windows).bat';
import CMD from '../../lan/lancer-serveur.command';
import SH from '../../lan/lancer-serveur.sh';

// ----------------------------------------------------------------------------------
// Archive « réseau local » assemblée dans le navigateur : le serveur autonome est publié à
// côté de la page (car-regie-serveur-lan.mjs), les lanceurs et le mode d'emploi sont inclus
// ici. ZIP sans compression (le fichier est petit), droits d'exécution pour les scripts.
// ----------------------------------------------------------------------------------
const TABLE = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipStore(entries) {
  const enc = new TextEncoder(); const parts = [], central = []; let off = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const e of entries) {
    const data = typeof e.data === 'string' ? enc.encode(e.data) : e.data; const name = enc.encode(e.name); const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 10, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(lh.buffer, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 0x031e, true); ch.setUint16(6, 10, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(38, ((e.exec ? 0o100755 : 0o100644) << 16) >>> 0, true); ch.setUint32(42, off, true);
    central.push(ch.buffer, name);
    off += 30 + name.length + data.length;
  }
  const size = central.reduce((a, b) => a + b.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
// 'saved' | 'declined' | 'unavailable' | 'error'
export async function downloadLanKit() {
  let srv;
  try { const r = await fetch('car-regie-serveur-lan.mjs', { cache: 'no-store' }); if (!r.ok) return 'unavailable'; srv = new Uint8Array(await r.arrayBuffer()); } catch (e) { return 'unavailable'; }
  const dir = 'car-regie-reseau-local/';
  const zip = zipStore([
    { name: dir + 'car-regie-serveur-lan.mjs', data: srv },
    { name: dir + 'Lancer le serveur (Windows).bat', data: BAT },
    { name: dir + 'lancer-serveur.command', data: CMD, exec: true },
    { name: dir + 'lancer-serveur.sh', data: SH, exec: true },
    { name: dir + 'LISEZMOI.txt', data: LISEZMOI },
  ]);
  return offerDownload('car-regie-reseau-local.zip', zip);
}
