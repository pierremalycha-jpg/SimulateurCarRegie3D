// @ts-check
import { CATALOGUE } from './catalogue/index.js';
import { tallyWould, parseIp, parseMask, sameNet, linkLocal } from './engine.js';

// ----------------------------------------------------------------------------------
// Les cahiers des charges de l'entrepôt : ce que le client demande, ce que le moteur doit
// constater pour que ce soit réussi, la note. Une mission = une liste d'exigences, chacune
// vérifiée sur le montage (build) et le résultat du moteur (Eval) ; une exigence peut être
// « acquise », « partielle » ou « manquante », avec une explication en français. Le bac à sable
// (id '') n'a pas d'exigence. Les exigences ne lisent que B, E et le catalogue : elles n'inventent
// aucune règle, elles constatent ce que le moteur a calculé (E.video, E.ip, E.reach, E.services,
// E.tally, E.power, E.poe) et, pour le tally, ce qu'il calculerait si telle entrée passait à l'antenne.
// ----------------------------------------------------------------------------------
/** @typedef {import('./types.js').Build} Build */
/** @typedef {import('./types.js').Eval} Eval */
/** @typedef {import('./types.js').Appareil} Appareil */
/** @typedef {import('./types.js').Modele} Modele */
/**
 * @typedef {object} Exigence
 * @property {string} id
 * @property {string} label ce que demande le client, en une ligne
 * @property {number} pts points
 * @property {(B: Build, E: Eval) => { ok: boolean, partiel?: boolean, why: string }} test
 */
/**
 * @typedef {object} Mission
 * @property {string} id
 * @property {string} titre
 * @property {string} client qui commande (une association, un lycée, une salle…)
 * @property {string} brief le cahier des charges, en quelques phrases
 * @property {string[]} contraintes ce qu'il faut respecter (budget, place, délai…)
 * @property {number} [budget] euros HT (ordre de grandeur) : la somme des prix du catalogue ne doit pas le dépasser
 * @property {Exigence[]} exigences
 * @property {string[]} competences codes du référentiel TIEE
 * @property {string} niveau 'découverte' | 'intermédiaire' | 'avancé'
 * @property {string} duree '20 min'…
 */

// ---------------- outils de lecture (B, E, catalogue) ----------------
const M = (/** @type {Appareil} */ a) => (a ? CATALOGUE[a.modele] : undefined);
const fam = (/** @type {Build} */ B, /** @type {Modele['famille']} */ f) => B.appareils.filter((a) => M(a) && M(a).famille === f);
const nomDe = (/** @type {Build} */ B, /** @type {string} */ uid) => { const a = B.appareils.find((x) => x.uid === uid); return a ? a.nom : '?'; };
const liste = (/** @type {string[]} */ l) => l.join(', ');
/** le mélangeur matériel du montage (le premier), ou null */
const melangeur = (/** @type {Build} */ B) => fam(B, 'melangeur')[0] || null;
/** le PC de régie en vMix */
const pcVmix = (/** @type {Build} */ B) => fam(B, 'ordinateur').find((a) => a.cfg && a.cfg.logiciel === 'vmix') || null;
/** les caméras acceptées sur les entrées d'un mélangeur : [{ cam, n }] (format accepté), et celles refusées */
function camerasSur(/** @type {Build} */ B, /** @type {Eval} */ E, /** @type {Appareil} */ mix) {
  const m = M(mix); const ok = /** @type {Array<{ cam: string, n: number }>} */ ([]); const refus = /** @type {string[]} */ ([]);
  if (!m) return { ok, refus };
  const fmt = mix.cfg && mix.cfg.format;
  for (const p of m.ports) {
    if ((p.sig !== 'sdi' && p.sig !== 'hdmi') || p.dir !== 'in') continue;
    const f = E.video[`${mix.uid}:${p.id}`]; if (!f) continue;
    const cam = B.appareils.find((a) => a.uid === f.src); if (!cam || !M(cam) || M(cam).famille !== 'camera') continue;
    const n = +(String(p.id).match(/(\d+)$/) || [0, 0])[1];
    if (fmt && f.format !== fmt) refus.push(`${cam.nom} (${f.format})`); else ok.push({ cam: cam.uid, n });
  }
  return { ok, refus };
}
/** la caméra est-elle pilotée par un pupitre ou un PC (service ptz-http ou ptz-serial rendu) ? */
const pilotee = (/** @type {Eval} */ E, /** @type {string} */ par, /** @type {string} */ cam) => !!((E.services[`${par}:ptz-http:${cam}`] || {}).ok || (E.services[`${par}:ptz-serial:${cam}`] || {}).ok);
/** le port d'entrée que le HyperDeck enregistre, et le flux qui y arrive */
function fluxEnregistre(/** @type {Build} */ B, /** @type {Eval} */ E, /** @type {Appareil} */ hd) {
  const m = M(hd); if (!m) return null;
  const src = hd.cfg && hd.cfg.source === 'hdmi' ? 'hdmi' : 'sdi';
  const p = m.ports.find((q) => q.sig === src && q.dir === 'in') || m.ports.find((q) => (q.sig === 'sdi' || q.sig === 'hdmi') && q.dir === 'in');
  return p ? E.video[`${hd.uid}:${p.id}`] || null : null;
}
/** les HyperDeck qui enregistrent le programme d'une source donnée (mélangeur ou PC) */
const enregistrent = (/** @type {Build} */ B, /** @type {Eval} */ E, /** @type {string} */ src) => fam(B, 'enregistreur').filter((hd) => { const f = fluxEnregistre(B, E, hd); return f && f.label === 'PGM' && f.src === src && (E.services[`${hd.uid}:enregistre`] || {}).ok; });
/** un flux porte-t-il un micro (famille son) sur les voies 1-2, passé par un Teranex (convertisseur) ? */
function microSurPgm(/** @type {Build} */ B, /** @type {import('./types.js').Flux | null} */ f) {
  if (!f) return { ok: false, why: 'aucun flux' };
  const estMicro = (uid) => { const a = B.appareils.find((x) => x.uid === uid); return !!a && !!M(a) && M(a).famille === 'son'; };
  const v1 = f.audio.find((x) => x.ch === 1 && estMicro(x.from)), v2 = f.audio.find((x) => x.ch === 2 && estMicro(x.from));
  if (!v1 || !v2) { const autres = f.audio.filter((x) => estMicro(x.from)).map((x) => x.ch); return { ok: false, why: autres.length ? `le micro est sur les voies ${[...new Set(autres)].join(', ')}, pas 1-2` : 'aucun micro dans l\'audio du programme' }; }
  const teranex = f.via.some((uid) => { const a = B.appareils.find((x) => x.uid === uid); return !!a && !!M(a) && M(a).famille === 'convertisseur'; });
  if (!teranex) return { ok: false, why: `le micro ${nomDe(B, v1.from)} est embarqué, mais pas par un Teranex (entrée XLR du mélangeur)` };
  return { ok: true, why: `${nomDe(B, v1.from)} sur les voies 1-2 par un Teranex` };
}
/** tout ce qui est sorti est alimenté ? */
function toutAlimente(/** @type {Build} */ B, /** @type {Eval} */ E) {
  const off = B.appareils.filter((a) => E.power[a.uid] && !E.power[a.uid].on).map((a) => a.nom);
  const n = B.appareils.filter((a) => a.modele !== 'mur').length;
  return { ok: n > 0 && !off.length, partiel: n > 0 && off.length < n / 2, why: !n ? 'Rien n\'est sorti du stock.' : off.length ? `Pas alimenté : ${liste(off)}.` : `Les ${n} appareils sont alimentés.` };
}
/** budget PoE+ de chaque switch respecté ? */
function poeOk(/** @type {Build} */ B, /** @type {Eval} */ E) {
  const sw = Object.entries(E.poe);
  if (!sw.length) return { ok: false, why: 'Aucun switch PoE+ dans le montage.' };
  const ko = sw.filter(([, p]) => !p.ok);
  return { ok: !ko.length, why: ko.length ? liste(ko.map(([uid, p]) => `${nomDe(B, uid)} : ${p.used} W pour ${p.budget} W`)) + '.' : liste(sw.map(([uid, p]) => `${nomDe(B, uid)} : ${p.used} W sur ${p.budget} W`)) + '.' };
}
/** adresses fixes, sans conflit, toutes dans le même sous-réseau (les routeurs mis à part) */
function adressesFixes(/** @type {Build} */ B, /** @type {Eval} */ E, fixes = true) {
  const devs = B.appareils.filter((a) => E.ip[a.uid] && !(a.cfg && a.cfg.lan && M(a) && M(a).famille === 'reseau'));
  if (!devs.length) return { ok: false, why: 'Aucun appareil réseau.' };
  const dhcp = fixes ? devs.filter((a) => E.ip[a.uid].dhcp).map((a) => a.nom) : [];
  const conflits = devs.filter((a) => E.ip[a.uid].conflit).map((a) => a.nom);
  const sansLien = devs.filter((a) => !E.ip[a.uid].link).map((a) => a.nom);
  const ref = devs.find((a) => !E.ip[a.uid].dhcp && parseIp(E.ip[a.uid].ip) != null) || devs[0];
  const r = E.ip[ref.uid]; const rn = parseIp(r.ip), rp = parseMask(r.mask);
  const hors = devs.filter((a) => { const x = E.ip[a.uid]; const n = parseIp(x.ip), p = parseMask(x.mask); return rn == null || rp == null || n == null || p == null || linkLocal(x.ip) || !sameNet(n, rn, rp) || !sameNet(n, rn, p); }).map((a) => a.nom);
  const domaines = new Set(devs.map((a) => E.ip[a.uid].domaine).filter(Boolean));
  const pb = [];
  if (dhcp.length) pb.push(`en DHCP : ${liste(dhcp)}`);
  if (conflits.length) pb.push(`conflit d'adresse : ${liste(conflits)}`);
  if (sansLien.length) pb.push(`sans lien réseau : ${liste(sansLien)}`);
  if (hors.length) pb.push(`hors du sous-réseau de ${ref.nom} : ${liste(hors)}`);
  if (domaines.size > 1) pb.push(`${domaines.size} domaines de niveau 2 séparés (VLAN, switchs non reliés)`);
  const nb = dhcp.length + conflits.length + sansLien.length + hors.length;
  return { ok: !pb.length, partiel: pb.length > 0 && nb <= devs.length / 3, why: pb.length ? pb.join(' ; ') + '.' : `${devs.length} appareils en ${r.ip.replace(/\.\d+$/, '.x')}, masque ${r.mask}, sans conflit.` };
}

// ---------------- les exigences communes, paramétrées ----------------
/** @type {(n: number) => Exigence} */
const exCameras = (n) => ({
  id: 'cameras', label: `${n} caméras PTZ sur ${n} entrées du mélangeur, au format du mélangeur`, pts: 15,
  test(B, E) {
    const mix = melangeur(B); if (!mix) return { ok: false, why: 'Aucun mélangeur sorti du stock.' };
    const { ok, refus } = camerasSur(B, E, mix); const cams = fam(B, 'camera');
    const why = `${ok.length} caméra${ok.length > 1 ? 's' : ''} acceptée${ok.length > 1 ? 's' : ''} sur ${mix.nom}${refus.length ? ' ; refusée' + (refus.length > 1 ? 's' : '') + ' (format) : ' + liste(refus) : ''}${cams.length < n ? ' ; ' + cams.length + ' caméra' + (cams.length > 1 ? 's' : '') + ' sortie' + (cams.length > 1 ? 's' : '') + ' du stock' : ''}.`;
    return { ok: ok.length >= n, partiel: ok.length > 0, why };
  },
});
/** @type {Exigence} */
const exPilotage = {
  id: 'pilotage', label: 'Toutes les caméras pilotées depuis le même AW-RP150 (IP ou série)', pts: 15,
  test(B, E) {
    const cams = fam(B, 'camera'); const rps = fam(B, 'pupitre');
    if (!cams.length) return { ok: false, why: 'Aucune caméra.' };
    if (!rps.length) return { ok: false, why: 'Aucun pupitre sorti du stock.' };
    const best = rps.map((rp) => ({ rp, ok: cams.filter((c) => pilotee(E, rp.uid, c.uid)) })).sort((x, y) => y.ok.length - x.ok.length)[0];
    const manque = cams.filter((c) => !best.ok.some((x) => x.uid === c.uid)).map((c) => c.nom);
    return { ok: best.ok.length === cams.length, partiel: best.ok.length > 0, why: manque.length ? `${best.rp.nom} ne pilote pas ${liste(manque)}${(E.alertes.find((a) => a.dev === best.rp.uid && a.level === 'erreur') || { msg: '' }).msg ? ' (' + E.alertes.find((a) => a.dev === best.rp.uid && a.level === 'erreur').msg + ')' : ''}.` : `${best.rp.nom} pilote ${liste(best.ok.map((c) => c.nom))}.` };
  },
};
/** @type {Exigence} */
const exTally = {
  id: 'tally', label: 'Le tally rouge s\'allume sur la caméra à l\'antenne, pour chacune', pts: 15,
  test(B, E) {
    const mix = melangeur(B); if (!mix) return { ok: false, why: 'Aucun mélangeur.' };
    const { ok } = camerasSur(B, E, mix); if (!ok.length) return { ok: false, why: 'Aucune caméra acceptée sur le mélangeur.' };
    const bons = [], mauvais = [];
    for (const { cam, n } of ok) { const t = tallyWould(B, mix.uid, n); if (t[cam] && t[cam].pgm) bons.push(nomDe(B, cam)); else mauvais.push(`${nomDe(B, cam)} (entrée ${n})`); }
    const raison = E.alertes.find((a) => /tally reste éteint/.test(a.msg));
    return { ok: !mauvais.length, partiel: bons.length > 0, why: mauvais.length ? `Pas de tally sur ${liste(mauvais)}${raison ? ' : ' + raison.msg.replace(/^.*reste éteint : /, '') : '.'}` : `Tally sur ${liste(bons)}.` };
  },
};
/** @type {Exigence} */
const exEnregistrement = {
  id: 'enregistrement', label: 'Le programme (PGM) est enregistré sur un HyperDeck (support présent, REC lancé)', pts: 15,
  test(B, E) {
    const mix = melangeur(B); if (!mix) return { ok: false, why: 'Aucun mélangeur.' };
    const hds = fam(B, 'enregistreur'); if (!hds.length) return { ok: false, why: 'Aucun HyperDeck sorti du stock.' };
    const bons = enregistrent(B, E, mix.uid);
    if (bons.length) return { ok: true, why: `${bons[0].nom} : ${E.services[`${bons[0].uid}:enregistre`].label}.` };
    const hd = hds[0]; const f = fluxEnregistre(B, E, hd); const s = E.services[`${hd.uid}:enregistre`];
    return { ok: false, partiel: !!f && f.label === 'PGM' && f.src === mix.uid, why: !f ? `${hd.nom} ne reçoit rien sur son entrée.` : f.src !== mix.uid || f.label !== 'PGM' ? `${hd.nom} reçoit ${f.label} (${nomDe(B, f.src)}), pas le programme du mélangeur.` : s ? s.why : 'Pas d\'enregistrement.' };
  },
};
/** @type {Exigence} */
const exMicro = {
  id: 'micro', label: 'Le micro XLR de la salle est embarqué sur les voies 1-2 du programme par un Teranex', pts: 10,
  test(B, E) {
    const mix = melangeur(B); if (!mix) return { ok: false, why: 'Aucun mélangeur.' };
    if (!fam(B, 'son').length) return { ok: false, why: 'Aucun micro sorti du stock.' };
    const hds = enregistrent(B, E, mix.uid); const f = hds.length ? fluxEnregistre(B, E, hds[0]) : E.video[Object.keys(E.video).find((k) => E.video[k] && E.video[k].src === mix.uid && E.video[k].label === 'PGM') || ''] || null;
    if (!f) return { ok: false, why: 'Le programme n\'arrive nulle part (ni HyperDeck, ni moniteur).' };
    const r = microSurPgm(B, f); return { ok: r.ok, why: r.ok ? `Dans le programme enregistré : ${r.why}.` : `Dans le programme : ${r.why}.` };
  },
};
/** @type {Exigence} */
const exAdresses = { id: 'adresses', label: 'Adresses IP fixes, sans conflit, toutes dans le même sous-réseau', pts: 10, test: (B, E) => adressesFixes(B, E, true) };
/** @type {Exigence} */
const exSansConflit = { id: 'adresses', label: 'Adresses IP sans conflit, toutes dans le même sous-réseau (DHCP admis)', pts: 10, test: (B, E) => adressesFixes(B, E, false) };
/** @type {Exigence} */
const exPoe = { id: 'poe', label: 'Budget PoE+ du switch respecté', pts: 5, test: poeOk };
/** @type {Exigence} */
const exAlim = { id: 'alimentation', label: 'Tout ce qui est sorti est alimenté', pts: 10, test: toutAlimente };
/** @type {Exigence} */
const exMoniteurMv = {
  id: 'multiview', label: 'Le multiview du mélangeur est affiché sur un moniteur', pts: 10,
  test(B, E) {
    const mons = fam(B, 'moniteur'); if (!mons.length) return { ok: false, why: 'Aucun moniteur sorti du stock.' };
    const mix = melangeur(B);
    const vu = mons.find((mo) => Object.entries(E.video).some(([k, f]) => k.startsWith(mo.uid + ':') && f && f.label === 'Multiview' && (!mix || f.src === mix.uid)));
    const quoi = mons.map((mo) => { const f = Object.entries(E.video).find(([k, x]) => k.startsWith(mo.uid + ':') && x); return `${mo.nom} : ${f ? f[1].label : 'rien'}`; });
    return { ok: !!vu, why: vu ? `${vu.nom} affiche le multiview.` : liste(quoi) + '.' };
  },
};

/** @type {Mission[]} */
export const MISSIONS = [
  {
    id: 'conference', titre: 'Conférence à trois caméras PTZ', client: 'Le lycée, pour la cérémonie de remise des diplômes',
    brief: 'Trois caméras PTZ pilotées depuis un seul pupitre, un mélangeur, l\'enregistrement du programme et le micro de la salle embarqué dans l\'image. La régie tient dans une baie mobile et sur une table.',
    contraintes: ['Une seule personne au pupitre : les trois caméras se pilotent depuis le même AW-RP150, et leur tally s\'allume.', 'Le programme est enregistré sur un HyperDeck.', 'Le micro XLR de la salle arrive dans le programme par un Teranex (embedder).', 'Toutes les adresses IP sont fixes et dans le même sous-réseau.'],
    budget: 25000, niveau: 'intermédiaire', duree: '30 min', competences: ['2.1', '2.7', '2.9', '2.10', '3.9'],
    exigences: [exCameras(3), exPilotage, exTally, exEnregistrement, exMicro, exAdresses, exPoe, exAlim],
  },
  {
    id: 'plateau-iso', titre: 'Plateau TV deux caméras, ISO et streaming', client: 'La web-TV de l\'association des étudiants, pour son plateau hebdomadaire',
    brief: 'Deux caméras PTZ sur un ATEM Television Studio HD8 ISO, les pistes ISO et le programme enregistrés sur un disque USB-C, le direct diffusé sur Internet par la box, le multiview sur un moniteur et le micro du plateau dans le programme. Le tally s\'allume sur la caméra à l\'antenne.',
    contraintes: ['Le mélangeur est l\'ATEM HD8 ISO : il enregistre les ISO et le programme sur un disque USB-C.', 'Le streaming passe par le routeur (box) : l\'ATEM doit avoir une passerelle et joindre Internet.', 'Les adresses peuvent venir du DHCP de la box, mais sans conflit et toutes dans le même sous-réseau.', 'Un moniteur affiche le multiview ; le micro du plateau est dans le programme.'],
    budget: 25000, niveau: 'intermédiaire', duree: '30 min', competences: ['2.1', '2.7', '2.9', '3.9', '4.2'],
    exigences: [
      exCameras(2),
      { id: 'iso', label: 'L\'ATEM enregistre les ISO et le programme sur un disque USB-C', pts: 15, test(B, E) { const mix = melangeur(B); if (!mix) return { ok: false, why: 'Aucun mélangeur.' }; const s = E.services[`${mix.uid}:iso`]; if (!s) return { ok: false, why: `${mix.nom} n'a pas d'enregistrement ISO.` }; return { ok: s.ok, why: s.ok ? s.label + '.' : s.why }; } },
      { id: 'stream', label: 'Le programme est diffusé sur Internet (streaming par le routeur)', pts: 15, test(B, E) { const mix = melangeur(B); if (!mix) return { ok: false, why: 'Aucun mélangeur.' }; if (!fam(B, 'reseau').some((a) => a.cfg && a.cfg.lan)) return { ok: false, why: 'Aucun routeur sorti du stock.' }; const s = E.services[`${mix.uid}:rtmp:internet`]; if (!s) return { ok: false, why: `Le streaming n'est pas activé sur ${mix.nom}.` }; return { ok: s.ok, why: s.ok ? `${s.label} : en ligne.` : s.why }; } },
      exMoniteurMv,
      { id: 'micro', label: 'Le micro du plateau est dans le programme (XLR du mélangeur ou Teranex)', pts: 10, test(B, E) { const mix = melangeur(B); if (!mix) return { ok: false, why: 'Aucun mélangeur.' }; if (!fam(B, 'son').length) return { ok: false, why: 'Aucun micro sorti du stock.' }; const f = Object.values(E.video).find((x) => x && x.src === mix.uid && x.label === 'PGM') || Object.values(E.video).find((x) => x && x.src === mix.uid && x.label === 'Multiview') || null; if (!f) return { ok: false, why: 'Le programme n\'arrive nulle part (ni enregistreur, ni moniteur), ou il est noir.' }; const mic = f.audio.find((x) => { const a = B.appareils.find((y) => y.uid === x.from); return a && M(a) && M(a).famille === 'son'; }); return { ok: !!mic, why: mic ? `${nomDe(B, mic.from)} sur la voie ${mic.ch} du programme.` : 'Aucun micro dans l\'audio du programme (entrée MIC sur ON ?).' }; } },
      exPilotage, exTally, exSansConflit, exAlim,
    ],
  },
  {
    id: 'regie-vmix', titre: 'Régie vMix : NDI, SDI, HyperDeck, Teranex', client: 'Le club de sport du quartier, pour ses matchs à domicile',
    brief: 'Une régie logicielle vMix sur le PC de régie avec sa carte DeckLink Duo 2 : une caméra arrive en NDI|HX par le réseau, l\'autre en SDI sur la DeckLink. Le programme sort de la DeckLink vers un HyperDeck piloté par le réseau, et vers un Teranex désembedder dont le son part sur la sonorisation et l\'image sur un moniteur. Les deux caméras sont pilotées et ont leur tally depuis vMix.',
    contraintes: ['Le PC de régie est en vMix ; la DeckLink a au moins une entrée et une sortie (par paires).', 'Une caméra en NDI|HX (activé dans la caméra), l\'autre en SDI.', 'Le HyperDeck enregistre le programme et reste pilotable en Ethernet (REMOTE ON) depuis le PC.', 'Le Teranex SDI to Audio sort les voies 1-2 du programme ; sa boucle SDI alimente un moniteur.'],
    budget: 22000, niveau: 'avancé', duree: '40 min', competences: ['2.1', '2.7', '2.9', '2.10', '3.9'],
    exigences: [
      { id: 'ndi', label: 'Une caméra arrive dans vMix en NDI|HX', pts: 15, test(B, E) { const pc = pcVmix(B); if (!pc) return { ok: false, why: 'Aucun PC de régie en vMix.' }; const ok = Object.entries(E.services).filter(([k, s]) => k.startsWith(pc.uid + ':ndi:') && s.ok); const ko = Object.entries(E.services).filter(([k, s]) => k.startsWith(pc.uid + ':ndi:') && !s.ok); return { ok: ok.length > 0, why: ok.length ? ok[0][1].label + '.' : ko.length ? ko[0][1].why : 'Aucune entrée NDI dans vMix.' }; } },
      { id: 'sdi', label: 'Une caméra arrive dans vMix en SDI par la DeckLink', pts: 15, test(B, E) { const pc = pcVmix(B); if (!pc) return { ok: false, why: 'Aucun PC de régie en vMix.' }; const m = M(pc); const ins = m.ports.filter((p) => p.sig === 'sdi' && (p.dir === 'in' || (p.dir === 'io' && pc.cfg.decklink && pc.cfg.decklink[+(String(p.id).match(/(\d+)$/) || [0, 0])[1]] !== 'out'))); const f = ins.map((p) => E.video[`${pc.uid}:${p.id}`]).find((x) => x && fam(B, 'camera').some((c) => c.uid === x.src)); const choisie = (pc.cfg.vmix && pc.cfg.vmix.entrees || []).some((e) => e && e.type === 'decklink'); return { ok: !!f && choisie, partiel: !!f, why: !f ? 'Aucune caméra n\'arrive sur une entrée de la DeckLink.' : !choisie ? `${nomDe(B, f.src)} arrive sur la DeckLink, mais aucune entrée vMix de type DeckLink.` : `${nomDe(B, f.src)} (${f.format}) sur la DeckLink.` }; } },
      { id: 'hyperdeck', label: 'Le HyperDeck enregistre le programme vMix et reste pilotable en Ethernet depuis le PC', pts: 15, test(B, E) { const pc = pcVmix(B); if (!pc) return { ok: false, why: 'Aucun PC de régie en vMix.' }; const hds = fam(B, 'enregistreur'); if (!hds.length) return { ok: false, why: 'Aucun HyperDeck.' }; const rec = enregistrent(B, E, pc.uid); const hd = rec[0] || hds[0]; const f = fluxEnregistre(B, E, hd); const s = E.services[`${hd.uid}:enregistre`]; const reach = E.reach[`${pc.uid}>${hd.uid}`]; const distant = hd.cfg && hd.cfg.distant !== false; if (!rec.length) return { ok: false, partiel: !!f && f.src === pc.uid, why: !f ? `${hd.nom} ne reçoit rien.` : f.src !== pc.uid ? `${hd.nom} reçoit ${f.label} (${nomDe(B, f.src)}), pas le programme vMix.` : s ? s.why : 'Pas d\'enregistrement.' }; return { ok: !!reach && distant, partiel: true, why: !distant ? `${hd.nom} enregistre, mais REMOTE est sur OFF.` : !reach ? `${hd.nom} enregistre, mais ${pc.nom} ne le joint pas en IP (9993).` : `${hd.nom} enregistre le programme et répond au PC (9993).` }; } },
      { id: 'teranex', label: 'Le Teranex désembedder sort les voies 1-2 du programme ; sa boucle alimente un moniteur', pts: 15, test(B, E) { const pc = pcVmix(B); const ters = fam(B, 'convertisseur').filter((t) => M(t).ports.some((p) => p.sig === 'audio' && p.dir === 'out')); if (!ters.length) return { ok: false, why: 'Aucun Teranex SDI to Audio.' }; const mons = fam(B, 'moniteur'); for (const t of ters) { const s = E.services[`${t.uid}:audio`]; const paire = Number(t.cfg && t.cfg.paire) || 1; const vu = mons.find((mo) => Object.entries(E.video).some(([k, f]) => k.startsWith(mo.uid + ':') && f && f.via.includes(t.uid))); const pgm = Object.entries(E.video).some(([k, f]) => k.startsWith(t.uid + ':') && f && f.label === 'PGM' && (!pc || f.src === pc.uid)); if (s && s.ok && paire === 1 && vu && pgm) return { ok: true, why: `${t.nom} sort les voies 1-2 du programme ; ${vu.nom} est sur sa boucle.` }; if (t === ters[ters.length - 1]) return { ok: false, partiel: !!(s && s.ok), why: !pgm ? `${t.nom} ne reçoit pas le programme vMix.` : paire !== 1 ? `${t.nom} est réglé sur les voies ${paire * 2 - 1}-${paire * 2}.` : !(s && s.ok) ? s ? s.why : 'Pas de son.' : `Aucun moniteur sur la boucle SDI de ${t.nom}.` }; } return { ok: false, why: '' }; } },
      { id: 'pilotage', label: 'Les deux caméras sont pilotées (PTZ) depuis vMix', pts: 10, test(B, E) { const pc = pcVmix(B); if (!pc) return { ok: false, why: 'Aucun PC de régie en vMix.' }; const cams = fam(B, 'camera'); if (!cams.length) return { ok: false, why: 'Aucune caméra.' }; const ok = cams.filter((c) => pilotee(E, pc.uid, c.uid)); const manque = cams.filter((c) => !ok.includes(c)).map((c) => c.nom); return { ok: ok.length === cams.length && cams.length >= 2, partiel: ok.length > 0, why: manque.length ? `vMix ne pilote pas ${liste(manque)}.` : cams.length < 2 ? 'Une seule caméra.' : `vMix pilote ${liste(ok.map((c) => c.nom))}.` }; } },
      { id: 'tally', label: 'Le tally vMix s\'allume sur la caméra à l\'antenne, pour chacune', pts: 10, test(B, E) { const pc = pcVmix(B); if (!pc) return { ok: false, why: 'Aucun PC de régie en vMix.' }; const ents = (pc.cfg.vmix && pc.cfg.vmix.entrees) || []; if (!ents.length) return { ok: false, why: 'Aucune entrée vMix.' }; const bons = [], mauvais = []; ents.forEach((e, i) => { const t = tallyWould(B, pc.uid, i + 1); const cam = Object.keys(t).find((c) => t[c].pgm); if (cam) bons.push(nomDe(B, cam)); else mauvais.push(`entrée ${i + 1}`); }); return { ok: !mauvais.length && bons.length >= 2, partiel: bons.length > 0, why: mauvais.length ? `Pas de tally pour ${liste(mauvais)}${pc.cfg.vmix && pc.cfg.vmix.tally ? '' : ' (tally vMix désactivé)'}.` : `Tally sur ${liste(bons)}.` }; } },
      exSansConflit, exAlim,
    ],
  },
];
export const missionById = (/** @type {string} */ id) => MISSIONS.find((m) => m.id === id) || null;

/**
 * Note une mission sur 100 : points des exigences acquises (la moitié pour une exigence partielle),
 * et le budget s'il y en a un.
 * @returns {{ score: number, total: number, items: Array<{ id: string, label: string, pts: number, ok: boolean, partiel: boolean, why: string }>, budget: { max: number, used: number, ok: boolean } | null }}
 */
export function noter(/** @type {Mission} */ m, /** @type {Build} */ B, /** @type {Eval} */ E, /** @type {Record<string, import('./types.js').Modele>} */ CAT) {
  const items = m.exigences.map((x) => { const r = x.test(B, E); return { id: x.id, label: x.label, pts: x.pts, ok: !!r.ok, partiel: !!r.partiel && !r.ok, why: r.why || '' }; });
  const total = items.reduce((s, i) => s + i.pts, 0) || 1;
  const got = items.reduce((s, i) => s + (i.ok ? i.pts : i.partiel ? i.pts / 2 : 0), 0);
  const used = B.appareils.reduce((s, a) => s + ((CAT[a.modele] || {}).prix || 0), 0);
  const budget = m.budget ? { max: m.budget, used, ok: used <= m.budget } : null;
  let score = Math.round(got / total * 100);
  if (budget && !budget.ok) score = Math.max(0, score - 10);
  return { score, total, items, budget };
}
