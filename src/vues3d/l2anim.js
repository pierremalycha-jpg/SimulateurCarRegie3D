// @ts-check
import { DIFFUSION } from './l2.js';

// ----------------------------------------------------------------------------------
// Les trames d'un réseau de niveau 2 (l2.js) animées sur les câbles d'une vue (materiel.js, Reseau) :
// de la machine au commutateur, la décision du commutateur (apprentissage, port connu, inondation,
// diffusion, étiquette 802.1Q sur un trunk), puis chaque copie jusqu'à sa machine, qui la garde ou
// l'ignore. links : `${commutateur}:${port}` → { L, versSw } (versSw : sens du lien vers ce commutateur).
// ----------------------------------------------------------------------------------
/**
 * @param {import('./l2.js').L2} l2
 * @param {any} net Reseau
 * @param {Map<string, { L: any, versSw: number }>} links
 * @param {string} srcId machine qui émet
 * @param {string} dst adresse MAC de destination (ou DIFFUSION)
 * @param {{ couleur: number, info?: any, vlanCol?: (v: number) => number, onSwitch?: (sw: string, r: any, port: number) => void, onHost?: (id: string, garde: boolean) => void, onDone?: () => void, vitesse?: number }} o
 */
export function envoi(l2, net, links, srcId, dst, o) {
  const h = l2.hosts.get(srcId); if (!h) return;
  let pending = 1;
  const done = () => { if (--pending === 0 && o.onDone) o.onDone(); };
  const v = o.vitesse ?? 1.7;
  const arrive = (sw, port, tag) => {
    const r = l2.forward(sw, port, h.mac, dst, tag);
    if (o.onSwitch) o.onSwitch(sw, r, port);
    for (const n of r.out) {
      const P = l2.sw.get(sw).ports.get(n), K = links.get(`${sw}:${n}`); if (!K || !P.peer) continue;
      pending++;
      if (P.peer.host) {
        const dest = l2.hosts.get(P.peer.host);
        net.trame(K.L, -K.versSw, { couleur: o.couleur, info: o.info, vitesse: v, onEnd: () => { if (o.onHost) o.onHost(dest.id, dst === DIFFUSION || dst === dest.mac); done(); } });
      } else {
        const peer = P.peer;
        const tagged = { nom: `Trame étiquetée VLAN ${r.vlan} (802.1Q)`, texte: `Sur le trunk entre ${sw} et ${peer.sw}, la trame porte une étiquette de 4 octets : VLAN ${r.vlan}. Le commutateur d'en face la remet dans ce VLAN.` };
        net.trame(K.L, -K.versSw, { couleur: o.vlanCol ? o.vlanCol(r.vlan) : o.couleur, info: tagged, vitesse: v, taille: [0.16, 0.1, 0.1], onEnd: () => arrive(peer.sw, peer.port, r.vlan) });
      }
    }
    done();
  };
  const K = links.get(`${h.sw}:${h.port}`);
  net.trame(K.L, K.versSw, { couleur: o.couleur, info: o.info, vitesse: v, onEnd: () => arrive(h.sw, h.port, 0) });
}
