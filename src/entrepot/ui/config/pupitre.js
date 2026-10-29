// @ts-check
import { el } from '../../../util.js';
import { CATALOGUE } from '../../catalogue/index.js';
import { section, note, etat, choix, texte, coche, reseau, checkIp, suggestions, ecrire } from './kit.js';

// ----------------------------------------------------------------------------------
// Le menu du pupitre AW-RP150 : les dix emplacements de caméra (CAMERA SELECT 1 à 10), chacun en
// IP (adresse de la caméra, port 80), en série (SERIAL CONT n) ou non affecté (NoAsign) ; TALLY
// IP (le tally reçu en contact sur TALLY/GPIO 1 est renvoyé en IP à la caméra du même numéro) ;
// le réseau. Clés lues par le moteur : cameras[i].mode / ip / port, tallyIp, tallyIn, reseau.
// ----------------------------------------------------------------------------------
/** @typedef {import('./kit.js').Appareil} Appareil */
/** @typedef {import('./kit.js').Modele} Modele */
/** @typedef {import('./kit.js').Ctx} Ctx */

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuPupitre(a, m, ctx) {
  const c = a.cfg; const E = ctx.E;
  const dl = `ep-dl-cam-${a.uid}`;
  const rows = el('div', { class: 'ep-cf-slots' });
  (c.cameras || []).forEach((s, i) => {
    const slot = Number(s.slot) || i + 1;
    const svc = Object.entries(E.services).find(([k, v]) => k.startsWith(a.uid + ':ptz-') && v.label.startsWith(`Slot ${slot} `));
    const row = el('div', { class: 'ep-cf-slot ' + (s.mode === 'off' ? 'off' : svc && svc[1].ok ? 'ok' : 'ko') },
      el('b', {}, String(slot)),
      choix(a.uid, `cameras.${i}.mode`, s.mode || 'off', [['off', 'Non affecté'], ['ip', 'IP'], ['serial', `Série (SERIAL CONT ${slot <= 5 ? slot : '—'})`]], `Emplacement ${slot}`),
      s.mode === 'ip' ? texte(a.uid, `cameras.${i}.ip`, s.ip, 'Adresse de la caméra', { mono: true, check: checkIp, list: dl, placeholder: '192.168.0.10' }) : null,
      s.mode !== 'off' ? el('small', { class: 'ep-cf-slot-st' }, svc ? (svc[1].ok ? '✓ ' + svc[1].label : '✗ ' + svc[1].why) : '') : null);
    rows.append(row);
  });
  // ce que le pupitre « voit » : les caméras de son domaine de niveau 2 (la recherche Auto IP)
  const moi = E.ip[a.uid];
  const vues = ctx.B.appareils.filter((x) => (CATALOGUE[x.modele] || {}).famille === 'camera' && E.ip[x.uid] && moi && moi.link && E.ip[x.uid].link && E.ip[x.uid].domaine === moi.domaine);
  const recherche = el('ul', { class: 'ep-cf-list' }, ...vues.map((x) => {
    const libre = (c.cameras || []).findIndex((s) => s.mode === 'off');
    const deja = (c.cameras || []).some((s) => s.mode === 'ip' && s.ip === E.ip[x.uid].ip);
    return el('li', {}, el('span', {}, `${x.nom} · ${E.ip[x.uid].ip}${E.ip[x.uid].conflit ? ' (conflit)' : ''}`),
      deja ? el('small', {}, 'déjà affectée') : libre >= 0 ? el('button', { type: 'button', class: 'btn small', 'data-k': `${a.uid}:aff:${x.uid}`, onclick: () => ecrire(a.uid, { [`cameras.${libre}.mode`]: 'ip', [`cameras.${libre}.ip`]: E.ip[x.uid].ip }) }, `Affecter à l'emplacement ${(c.cameras[libre] || {}).slot || libre + 1}`) : null);
  }));
  const tally = (c.cameras || []).map((s) => Number(s.slot)).filter((n, i) => c.cameras[i].mode !== 'off');
  return [
    section('Caméras (CAMERA SELECT 1 à 10)',
      note('Menu CAMERA → Camera Setup du pupitre. En IP, l\'adresse est celle que la caméra a vraiment ; en série, le câble RS-422 part du port SERIAL CONT du même numéro (cinq au plus).'),
      suggestions(ctx, dl, (x, mo) => mo.famille === 'camera'),
      rows),
    section('Recherche sur le réseau (Auto IP)',
      note('Le pupitre interroge son réseau : il trouve les caméras branchées sur le même switch (le même domaine de niveau 2), même si elles ne sont pas dans son sous-réseau.'),
      !moi || !moi.link ? etat(false, 'Le pupitre n\'a pas de lien réseau : branche IP CONT sur le switch.') : vues.length ? recherche : etat(null, 'Aucune caméra trouvée sur le réseau du pupitre.')),
    section('Tally',
      note('Menu SYSTEM → TALLY. Le mélangeur (ou l\'interface GPI & Tally) ferme un contact par caméra à l\'antenne sur TALLY/GPIO 1 : contact n = emplacement n. Avec TALLY IP sur ON, le pupitre envoie ce tally à la caméra de l\'emplacement en IP.'),
      coche(a.uid, 'tallyIp', !!c.tallyIp, 'TALLY IP (renvoyer le tally aux caméras)'),
      choix(a.uid, 'tallyIn', c.tallyIn || 'gpio1', [['gpio1', 'TALLY/GPIO 1'], ['gpio2', 'GPIO 2']], 'Entrée des contacts de tally'),
      tally.length ? null : etat(null, 'Aucun emplacement affecté : le tally n\'a nulle part où aller.')),
    reseau(a, ctx, { menu: 'Menu SYSTEM → NETWORK du pupitre. Il doit être dans le sous-réseau des caméras qu\'il pilote.' }),
  ].filter(Boolean).map((x) => /** @type {HTMLElement} */ (x));
}
