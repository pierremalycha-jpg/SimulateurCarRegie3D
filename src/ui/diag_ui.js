// @ts-check
import { S } from '../state.js';
import { el } from '../util.js';
import { modal } from './common.js';
import { TUTOR, step } from '../tutor/engine.js';
import { APP_VERSION, ERRS, onReport, visible } from '../diag.js';

// ----------------------------------------------------------------------------------
// Les erreurs à l'écran : un bandeau discret dès qu'un problème survient (il ne bloque rien),
// et un diagnostic à copier pour le signaler (version, navigateur, carte graphique, ce qui
// manque au navigateur, état du simulateur et du chef de car, erreurs avec leur pile d'appels).
// Accessible aussi sans erreur : feuille de service et Guide → Réglages, « Diagnostic technique ».
// ----------------------------------------------------------------------------------
let info = () => /** @type {Record<string, string>} */ ({});
/** compléments fournis par main.js (carte graphique, images par seconde…) */
export function setDiagInfo(/** @type {() => Record<string, string>} */ f) { info = f; }

// ---------------- navigateur ----------------
function browserName(ua = navigator.userAgent) {
  let m;
  if ((m = /Edg\/([\d.]+)/.exec(ua))) return `Edge ${m[1]}`;
  if ((m = /Firefox\/([\d.]+)/.exec(ua))) return `Firefox ${m[1]}`;
  if ((m = /Chrome\/([\d.]+)/.exec(ua))) return `Chrome ${m[1]}`;
  if ((m = /Version\/([\d.]+).*Safari/.exec(ua))) return `Safari ${m[1]}`;
  return 'inconnu';
}
const where = () => (location.protocol === 'file:' ? 'fichier ouvert sur l\'ordinateur' : window.CARREGIE_LAN ? `réseau local (${location.host})` : window.claude ? 'claude.ai (application publiée)' : location.host || location.protocol);
// ce dont le simulateur se sert, présent ou non dans ce navigateur
function features() {
  const ok = (/** @type {() => any} */ f) => { try { return !!f(); } catch (e) { return false; } };
  return [
    ['WebGL 2', ok(() => document.createElement('canvas').getContext('webgl2'))],
    ['audio', ok(() => window.AudioContext || window.webkitAudioContext)],
    ['synthèse vocale', ok(() => window.speechSynthesis)],
    ['stockage local', ok(() => { localStorage.setItem('carregie.t', '1'); localStorage.removeItem('carregie.t'); return true; })],
    ['presse-papiers', ok(() => navigator.clipboard && navigator.clipboard.writeText)],
    ['verrouillage du pointeur', ok(() => 'requestPointerLock' in document.body)],
    ['sélecteur :has()', ok(() => CSS.supports('selector(:has(a))'))],
    ['structuredClone', ok(() => typeof structuredClone === 'function')],
  ].map(([n, v]) => `${n} ${v ? 'oui' : 'NON'}`).join(' · ');
}
// le panneau du chef : ouvert, à l'écran, au premier plan ? (un panneau caché par autre chose
// ou placé hors de la fenêtre se repère ici)
function chefState() {
  const p = /** @type {HTMLElement | null} */ (document.getElementById('chef'));
  const l = TUTOR.lesson, s = step();
  const lesson = l ? ` · parcours « ${l.id} », étape ${TUTOR.i + 1}/${l.steps.length}${s ? ` (${s.id})` : ''}` : '';
  if (!p) return `jamais ouvert${lesson}`;
  if (p.hidden) return `fermé${lesson}`;
  const r = p.getBoundingClientRect();
  const cs = getComputedStyle(p);
  let front = 'hors de la fenêtre';
  const x = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(window.innerHeight - 1, Math.max(0, r.top + 20));
  if (r.width && r.height && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight) {
    const top = document.elementFromPoint(x, y);
    front = top && p.contains(top) ? 'au premier plan' : `recouvert par ${top ? top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + (top.className && typeof top.className === 'string' ? '.' + top.className.split(' ')[0] : '') : 'rien'}`;
  }
  return `ouvert · ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)} · affichage ${cs.display}, opacité ${cs.opacity} · ${front}${lesson}`;
}
const hhmmss = (t) => new Date(t).toTimeString().slice(0, 8);

/** le diagnostic complet, en texte à copier */
export function diagText() {
  const x = (() => { try { return info(); } catch (e) { return {}; } })();
  const shown = ERRS.filter((e) => e.kind !== 'ressource' && e.kind !== 'bruit');
  const res = ERRS.filter((e) => e.kind === 'ressource');
  const lines = [
    'TIEE Simulator · diagnostic',
    `Version : ${APP_VERSION}`,
    `Date : ${new Date().toISOString()} (heure locale ${new Date().toLocaleString('fr-FR')})`,
    `Page : ${where()}`,
    `Navigateur : ${browserName()} · ${navigator.userAgent}`,
    `Système : ${navigator.platform || '?'} · langue ${navigator.language} · écran ${screen.width}×${screen.height} @${window.devicePixelRatio || 1}x · fenêtre ${window.innerWidth}×${window.innerHeight} · tactile ${matchMedia('(pointer: coarse)').matches ? 'oui' : 'non'}`,
    `Graphismes : ${x.gl || '?'}`,
    `Fonctions du navigateur : ${features()}`,
    `Simulateur : mode ${S.mode}${S.mode === 'station' ? ` (poste ${S.station})` : ''} · vacation ${S.preset || '—'} · car ${S.ipMode ? 'IP' : 'SDI'} · format ${S.format} · qualité ${S.quality}${x.fps ? ` · ${x.fps}` : ''}${x.extra ? ` · ${x.extra}` : ''}`,
    `Chef de car : ${chefState()}`,
    '',
    shown.length ? `Erreurs (${shown.length}) :` : 'Erreurs : aucune',
  ];
  shown.forEach((e, i) => {
    lines.push(`${i + 1}. [${hhmmss(e.t)}] ${e.where ? e.where + ' · ' : ''}${e.msg}${e.n > 1 ? ` (×${e.n})` : ''}${e.src ? ` (${e.src.split('/').pop()}:${e.line}:${e.col})` : ''}`);
    if (e.stack) lines.push('   ' + e.stack.split('\n').slice(0, 6).map((s) => s.trim()).join('\n   '));
  });
  if (res.length) lines.push('', `Ressources non chargées (${res.length}) : ${res.slice(0, 5).map((e) => e.msg).join(' · ')}`);
  return lines.join('\n');
}

// ---------------- copier ----------------
/**
 * Copie le texte ; si le navigateur refuse (page dans un cadre, fichier local), sélectionne la
 * zone de texte pour une copie au clavier.
 * @param {string} text
 * @param {HTMLButtonElement} btn
 * @param {HTMLTextAreaElement | null} [area]
 */
export async function copyText(text, btn, area = null) {
  const label = btn.textContent;
  const done = (ok) => { btn.textContent = ok ? 'Copié ✓' : 'Sélectionné : Cmd/Ctrl + C'; setTimeout(() => { btn.textContent = label; }, 2500); };
  try { await navigator.clipboard.writeText(text); done(true); return; } catch (e) { /* refusé : copie à l'ancienne */ }
  const ta = area || el('textarea', { style: { position: 'fixed', left: '-9999px' }, 'aria-hidden': 'true', tabindex: -1 }, text);
  if (!area) document.body.append(ta);
  ta.focus(); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* rien */ }
  if (!area) ta.remove();
  done(ok);
}

// ---------------- fenêtre « Diagnostic technique » ----------------
export function openDiag() {
  const text = diagText();
  const area = /** @type {HTMLTextAreaElement} */ (el('textarea', { class: 'diag-text', readonly: true, rows: 16, spellcheck: 'false', 'aria-label': 'Texte du diagnostic' }, text));
  const copyBtn = /** @type {HTMLButtonElement} */ (el('button', { class: 'btn primary', onclick: () => copyText(area.value, copyBtn, area) }, 'Copier le diagnostic'));
  const n = ERRS.filter(visible).length;
  modal.open('Diagnostic technique', el('div', { class: 'diag' },
    el('p', {}, n ? `${n} problème${n > 1 ? 's' : ''} noté${n > 1 ? 's' : ''} depuis l'ouverture de la page.` : 'Aucune erreur depuis l\'ouverture de la page.',
      ' Si quelque chose ne marche pas, copiez ce diagnostic et envoyez-le à votre formateur ou à la personne qui maintient le simulateur : il dit quel navigateur vous utilisez, ce qui lui manque et ce qui a échoué.'),
    area,
    el('div', { class: 'hwrow' }, copyBtn, el('button', { class: 'btn', onclick: () => { area.value = diagText(); } }, 'Actualiser le diagnostic'))), { width: 760 });
  hideBar();
}

// ---------------- bandeau ----------------
let bar = /** @type {HTMLElement | null} */ (null);
function hideBar() { if (bar) bar.hidden = true; }
function showBar(/** @type {import('../diag.js').DiagError} */ e) {
  if (!bar) {
    bar = el('div', { id: 'diagbar', role: 'alert', hidden: true });
    document.body.append(bar);
  }
  const n = ERRS.filter(visible).length;
  const copyBtn = /** @type {HTMLButtonElement} */ (el('button', { class: 'btn small primary', onclick: () => copyText(diagText(), copyBtn) }, 'Copier le diagnostic'));
  bar.replaceChildren(
    el('b', {}, 'Un problème est survenu'),
    el('span', { class: 'm', title: e.msg }, `${e.where ? e.where + ' : ' : ''}${e.msg}${n > 1 ? ` (+${n - 1} autre${n > 2 ? 's' : ''})` : ''}`),
    copyBtn,
    el('button', { class: 'btn small', onclick: () => openDiag() }, 'Voir le diagnostic'),
    el('button', { class: 'chef-ico', title: 'Masquer l\'alerte', 'aria-label': 'Masquer l\'alerte', onclick: () => hideBar() }, '×'));
  bar.hidden = false;
}

export function initDiagUI() {
  // le programme a démarré : l'écran de secours du chargement (boot.js), s'il s'est affiché
  // pour une erreur sans gravité, laisse la place au bandeau
  const err = document.getElementById('err');
  if (err && err.querySelector('.boot-sheet')) { err.hidden = true; err.innerHTML = ''; }
  onReport((e, isNew) => { if (isNew && visible(e)) showBar(e); });
  const first = ERRS.find(visible);
  if (first) showBar(first);
}
