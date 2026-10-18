// @ts-check
import { S, on, emit } from './state.js';
import { M, playerName, teamOf } from './match.js';
import { TEAMS } from './data/match.js';
import { clamp } from './util.js';
import { AU, voiceGain, setVoiceLevel } from './audio.js';

// ----------------------------------------------------------------------------------
// Commentaires du match : un commentateur (le « play-by-play »), un consultant (l'analyse),
// le journaliste bord terrain et le plateau (duplex). Les textes naissent des événements du match
// et sont dits par la synthèse vocale du navigateur, avec un volume calculé par la console son :
// patch, gain, fader, VCA, mute, départ vers le bus écouté, master, dim. Le retard de ligne
// s'applique aussi (synchro labiale). Sans synthèse vocale, le fil s'affiche au poste son.
// ----------------------------------------------------------------------------------
export const SPK = {
  comm1: { name: 'Julien', role: 'Commentateur', rate: 1.13, pitch: 1.0 },
  comm2: { name: 'Karim', role: 'Consultant', rate: 1.0, pitch: 0.8 },
  bt: { name: 'Sophie', role: 'Bord terrain', rate: 1.08, pitch: 1.18 },
  duplex: { name: 'Plateau', role: 'Studio (duplex)', rate: 1.04, pitch: 1.08 },
};
export const CMT = { on: true, log: [], queue: [], cur: null, idleT: 0, lastPass: 0, btT: 70, tts: false, voices: {}, studio: false, replay: false, lastShot: null };

const rnd = () => Math.random();
const pick = (a) => a[Math.floor(rnd() * a.length)];
const surname = (i) => { const n = playerName(i); return n.includes('. ') ? n.split('. ').slice(1).join(' ') : n; };
const teamSay = (t) => { const n = TEAMS[t].name.replace(/^(RC|AS|FC|OGC|SC)\s+/i, ''); return n.charAt(0) + n.slice(1).toLowerCase(); };
const scoreSay = () => `${teamSay(0)} ${M.score[0]}, ${teamSay(1)} ${M.score[1]}`;

// ---- voix de synthèse : une voix française différente par intervenant si possible ----
function pickVoices() {
  const ss = window.speechSynthesis; if (!ss) return;
  const all = ss.getVoices().filter((v) => /^fr/i.test(v.lang));
  if (!all.length) return;
  const male = all.filter((v) => /thomas|henri|paul|claude|mathieu|nicolas|daniel|guillaume|yves/i.test(v.name));
  const fem = all.filter((v) => /amélie|amelie|audrey|aurélie|julie|denise|hortense|marie|céline|celine|virginie|google/i.test(v.name));
  CMT.voices.comm1 = male[0] || all[0];
  CMT.voices.comm2 = male[1] || all.find((v) => v !== CMT.voices.comm1) || all[0];
  CMT.voices.bt = fem[0] || all[all.length - 1];
  CMT.voices.duplex = fem[1] || all.find((v) => v !== CMT.voices.bt && v !== CMT.voices.comm1) || all[0];
  CMT.tts = true;
}
if (typeof window !== 'undefined' && window.speechSynthesis) { pickVoices(); try { window.speechSynthesis.addEventListener('voiceschanged', pickVoices); } catch (e) { /* ancien navigateur */ } }

// ---- file d'attente : priorité (5 = but … 1 = description), péremption ----
function add(spk, text, prio = 1, maxAge = 3, opts = {}) {
  if (!CMT.on) return;
  const now = S.time;
  if (prio >= 4 && CMT.cur && CMT.cur.prio < prio) interrupt();
  CMT.queue = CMT.queue.filter((q) => q.prio >= prio - 1 || now - q.t < 0.5);
  CMT.queue.push({ spk, text, prio, t: now, maxAge, delay: opts.delay || 0, rate: opts.rate, pitch: opts.pitch });
}
const ttsBusy = () => { try { return CMT.tts && window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending); } catch (e) { return false; } };
function interrupt() { if (window.speechSynthesis && CMT.tts) { try { window.speechSynthesis.cancel(); } catch (e) { /* rien */ } } if (CMT.cur) { setVoiceLevel(CMT.cur.spk, -90); CMT.cur = null; } }
function duration(text, rate) { return 0.45 + text.split(/\s+/).length * 0.34 / (rate || 1); }
function sayNow(q) {
  const sp = SPK[q.spk]; const rate = q.rate || sp.rate;
  const dur = duration(q.text, rate);
  const vol = voiceGain(q.spk);
  CMT.cur = { ...q, start: S.time, until: S.time + dur, vol };
  CMT.log.push({ t: S.time, clock: M.clock, spk: q.spk, text: q.text, heard: vol > 0.02 && !AU.muted, prio: q.prio, rate: q.rate, pitch: q.pitch, remote: !!q.remote }); if (CMT.log.length > 40) CMT.log.shift();
  emit('commentary', CMT.log[CMT.log.length - 1]);
  if (!(window.speechSynthesis && window.SpeechSynthesisUtterance) || vol <= 0.02) return;
  const go = () => {
    try {
      const u = new SpeechSynthesisUtterance(q.text); u.lang = 'fr-FR'; u.rate = rate; u.pitch = q.pitch || sp.pitch; u.volume = clamp(vol, 0, 1);
      if (CMT.voices[q.spk]) u.voice = CMT.voices[q.spk];
      window.speechSynthesis.speak(u);
    } catch (e) { /* synthèse vocale indisponible */ }
  };
  // le retard de ligne (synchro labiale) s'applique aussi aux voix
  if (AU.effDelay > 0) setTimeout(go, AU.effDelay); else go();
}

// session à plusieurs : les lignes viennent de l'hôte
on('remoteCommentary', (d) => { if (!CMT.on || !d || !SPK[d.spk]) return; CMT.queue.push({ spk: d.spk, text: String(d.text || '').slice(0, 300), prio: d.prio || 1, t: S.time, maxAge: 6, delay: 0, rate: d.rate, pitch: d.pitch, remote: true }); });
on('match', (e) => {
  if (!CMT.on || S.mode === 'start' || S.sessionFollower) return;
  const now = S.time;
  if (e.type === 'kickoff') { add('comm1', M.clock < 5 ? pick(['Coup d\'envoi ! C\'est parti ici à Lens.', 'Et c\'est parti ! Coup d\'envoi de cette rencontre.']) : pick(['Le jeu reprend.', 'On repart, engagement.']), 3, 4); return; }
  if (e.type === 'pass') {
    if (now - CMT.lastPass < 2.4 || CMT.cur || CMT.queue.length || rnd() > 0.5) return;
    CMT.lastPass = now;
    const a = surname(e.from), b = surname(e.to);
    const h1 = M.humans[e.from], h2 = M.humans[e.to]; const long = h1 && h2 && Math.hypot(h1.x - h2.x, h1.z - h2.z) > 28;
    add('comm1', long ? pick([`Transversale de ${a}… pour ${b}.`, `Long ballon de ${a} vers ${b}.`]) : pick([`${a}.`, `${a}, pour ${b}.`, `${a}… qui trouve ${b}.`, `Ballon pour ${b}.`, `${a} temporise, ${b}.`]), 1, 1.4);
    return;
  }
  if (e.type === 'tackle') { if (rnd() < 0.45 && !CMT.cur) add('comm1', pick(['Bien récupéré !', 'Ballon perdu.', 'Belle récupération.', `Et ${teamSay(M.owner >= 0 ? teamOf(M.owner) : 0)} récupère.`]), 1, 1.5); return; }
  if (e.type === 'shot') { CMT.lastShot = { t: now, p: e.player }; add('comm1', pick([`${surname(e.player)} frappe !`, `Frappe de ${surname(e.player)} !`, `${surname(e.player)}… tente sa chance !`]), 4, 1.5, { rate: 1.25, pitch: 1.08 }); return; }
  if (e.type === 'save') {
    const gk = e.team * 11;
    add('comm1', pick([`Et l'arrêt de ${surname(gk)} !`, `Parade de ${surname(gk)} !`, `${surname(gk)} s'interpose !`]), 4, 2, { rate: 1.2, pitch: 1.08 });
    if (rnd() < 0.6) add('comm2', pick(['Belle parade, il était bien placé sur sa ligne.', 'Bon réflexe du gardien, la frappe était pourtant bien enroulée.', 'Il fallait cadrer plus fort, mais quel arrêt.']), 2, 6);
    return;
  }
  if (e.type === 'goal') {
    const sc = surname(e.scorer != null ? e.scorer : M.scorer); const t = e.team; const opp = 1 - t;
    const lead = e.score[t] > e.score[opp] ? (e.score[t] - e.score[opp] === 1 && e.score[opp] === 0 ? 'ouvre le score' : 'reprend l\'avantage') : e.score[t] === e.score[opp] ? 'égalise' : 'réduit le score';
    add('comm1', `But ! But de ${sc} ! ${teamSay(t)} ${lead} ! ${e.score[0]} à ${e.score[1]} !`, 5, 3, { rate: 1.28, pitch: 1.18 });
    add('comm2', pick([`Superbe enchaînement. La défense de ${teamSay(opp)} a été prise de vitesse.`, `C'est le geste juste, au bon moment. Rien à faire pour le gardien.`, `Quelle frappe ! Écoutez ce stade, c'est la folie à Lens.`]), 3, 12, { delay: 2.5 });
    add('comm1', `On revoit ce but tout à l'heure. Le score : ${scoreSay()}.`, 2, 16, { delay: 6 });
    return;
  }
  if (e.type === 'out') {
    if (e.kind === 'corner') add('comm1', pick([`Corner pour ${teamSay(M.lastTeam === 0 ? 1 : 0)}.`, 'Il y aura corner.']), 2, 2);
    else if (e.kind === 'goalkick') add('comm1', CMT.lastShot && now - CMT.lastShot.t < 3 ? pick(['C\'est à côté !', 'Au-dessus !', 'Pas cadré.']) : 'Six mètres.', CMT.lastShot && now - CMT.lastShot.t < 3 ? 3 : 1, 2);
    else if (rnd() < 0.35) add('comm1', 'Touche.', 1, 1.5);
  }
});

// interventions « au calme » : analyse du consultant, rappel du score, ambiance
function idleLine() {
  const min = Math.floor(M.clock / 60) + 1;
  const tot = M.possession[0] + M.possession[1];
  const pos = tot > 0 ? Math.round(100 * M.possession[0] / tot) : 50;
  const own = M.owner >= 0 && M.owner < 22 ? M.owner : -1;
  const lines = [
    ['comm2', `${teamSay(0)} a ${pos} % de possession pour l'instant.`],
    ['comm2', 'Il faut être plus juste dans la dernière passe.'],
    ['comm2', `Quelle ambiance dans le kop Marek !`],
    ['comm2', `Attention aux contres de ${teamSay(1)}, ils sont très rapides devant.`],
    ['comm2', `${M.shots[0]} tirs pour ${teamSay(0)}, dont ${M.onTarget[0]} cadrés.`],
    ['comm1', `On joue la ${min}${min === 1 ? 're' : 'e'} minute. ${scoreSay()}.`],
    ['comm1', own >= 0 ? `${surname(own)} conduit le ballon.` : 'Le ballon circule.'],
    ['comm1', 'Écoutez ce public, Bollaert pousse derrière son équipe.'],
  ];
  const [spk, text] = pick(lines);
  add(spk, text, 1, 3);
}

export function updateCommentary(dt, ctx = {}) {
  const now = S.time;
  // contexte : ralenti ou plateau à l'antenne
  if (ctx.replay && !CMT.replay && CMT.on && !S.sessionFollower) add('comm2', pick(['Revoyons l\'action au ralenti.', 'Regardez bien le déplacement, là, au ralenti.', 'Au ralenti, on voit que tout part de la récupération.']), 3, 4);
  CMT.replay = !!ctx.replay;
  if (ctx.studioOnAir && !CMT.studio && CMT.on && !S.sessionFollower) { add('duplex', `Merci ${SPK.comm1.name}, merci ${SPK.comm2.name}. Ici le plateau : on se retrouve à la mi-temps pour l'analyse.`, 3, 5); add('comm1', 'À tout de suite, on reste avec vous.', 2, 10, { delay: 1 }); }
  CMT.studio = !!ctx.studioOnAir;
  // fin de la phrase en cours
  if (CMT.cur && now >= CMT.cur.until) { setVoiceLevel(CMT.cur.spk, -90); CMT.cur = null; CMT.idleT = 0; }
  if (CMT.cur) {
    // niveau simulé (syllabes) pour les vumètres et la loudness ; la phrase est coupée si on ferme la voix
    const k = CMT.cur.spk; const s = (now - CMT.cur.start) * (4 + Math.sin(now * 1.3) * 1.5);
    setVoiceLevel(k, -18 + 6 * Math.abs(Math.sin(s * Math.PI)) - (rnd() < 0.1 ? 14 : 0) + (CMT.cur.prio >= 4 ? 4 : 0));
    if (CMT.cur.vol > 0.02 && voiceGain(k) <= 0.01 && window.speechSynthesis && CMT.tts) { try { window.speechSynthesis.cancel(); } catch (e) { /* rien */ } CMT.cur.vol = 0; }
    return;
  }
  if (!CMT.on || S.mode === 'start') return;
  if (S.sessionFollower) { const q = CMT.queue.shift(); if (q) sayNow(q); return; }
  // relance du bord terrain : le commentateur « lance » la journaliste, le son doit ouvrir sa tranche
  CMT.btT -= dt;
  if (CMT.btT <= 0 && M.state === 'play') {
    CMT.btT = 80 + rnd() * 60;
    add('comm1', `Des nouvelles du bord terrain avec ${SPK.bt.name} ?`, 3, 4);
    add('bt', pick([`Oui ${SPK.comm1.name}, l'entraîneur de Lens demande à son bloc de remonter d'un cran.`, `Le banc de ${teamSay(1)} s'agite, un changement se prépare.`, `Le capitaine de Lens est venu prendre les consignes, ça parle beaucoup ici.`]), 3, 6, { delay: 0.6 });
    emit('audio', { type: 'cue', k: 'bt' });
  }
  // file d'attente
  CMT.queue = CMT.queue.filter((q) => now - q.t < q.maxAge + q.delay);
  const ready = CMT.queue.filter((q) => now - q.t >= q.delay);
  if (ready.length) {
    ready.sort((a, b) => b.prio - a.prio || a.t - b.t);
    const q = ready[0];
    // la voix réelle peut être plus lente que l'estimation : on n'empile pas, sauf pour un temps fort
    if (ttsBusy()) { if (q.prio < 4) return; interrupt(); }
    CMT.queue.splice(CMT.queue.indexOf(q), 1);
    sayNow(q);
    return;
  }
  CMT.idleT += dt;
  if (CMT.idleT > 7 + rnd() * 5 && M.state === 'play') { CMT.idleT = 0; idleLine(); }
}
export function setCommentary(v) { CMT.on = !!v; if (!v) { interrupt(); CMT.queue = []; } }
