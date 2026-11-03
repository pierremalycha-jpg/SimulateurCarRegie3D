// @ts-check
import { on, emit } from '../state.js';
import { el } from '../util.js';
import { toast } from './common.js';
import { icon } from './icons.js';
import { openLayer, layerOpen, showTab, layerSay } from './layer.js';
import { PROG } from '../shared.js';
import { xpOf, levelOf, BADGES, game, badgeById, NIVEAU_MAX, xpPourNiveau } from '../game/xp.js';
import { etatDefis, serie, bonusSerie, BONUS_DEFIS } from '../game/defis.js';
import { PASS, profil, profilPourCompte, recuperer, equiper, regler, aRecuperer, debloque, niveauObjet, rarete, NOM_RARETE, paliersDu, pseudoPropre } from '../game/pass.js';
import { COSMETIQUES, NOM_TYPE, objet } from '../game/cosmetiques.js';
import { COMPTE, connecte, estEleve, estProf, nomDuCompte } from '../comptes/session.js';
import { classement, profilDe, publierBientot } from '../comptes/profils.js';
import { openConnexion } from './compte_ui.js';
import { avatarEl } from './avatar.js';

// ----------------------------------------------------------------------------------
// Le profil du joueur (v19.25), dans l'espace plein écran : quatre onglets.
//   Mon profil : la carte (bannière, avatar et son cadre, pseudo, titre, niveau), la série et les
//                défis du jour, l'apparence à choisir, la vitrine de trois badges, le compte ;
//   Le pass    : les 60 niveaux et leur récompense, à récupérer d'un clic ;
//   Succès     : tous les badges, obtenus (avec la date) ou à obtenir ;
//   Classement : les joueurs connectés, par niveau, et le profil de chacun (ses succès).
// On y vient par la carte joueur (écran titre, Jouer, menu du car, téléphone) et par Réglages → Mon
// compte : pas d'entrée de plus dans les menus. Feuille styles/profil.css (jetons du thème) ; les
// couleurs des avatars et des bannières sont du contenu (game/cosmetiques.js).
// ----------------------------------------------------------------------------------
/** remplace le contenu (les morceaux absents, null, sont laissés de côté : replaceChildren écrirait « null ») */
const poser = (box, ...kids) => box.replaceChildren(...kids.filter((k) => k != null && k !== false));
const TABS = /** @type {[string, string][]} */ ([['profil', 'Mon profil'], ['pass', 'Le pass'], ['succes', 'Succès'], ['classement', 'Classement']]);
const TIER = { bronze: 'Bronze', argent: 'Argent', or: 'Or' };
const dateFr = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// ---------------- les pièces : avatar, bannière, carte ----------------
const fondBanniere = (id) => (objet('banniere', id) || { fond: 'none' }).fond;
/**
 * La carte d'un profil public : bannière, avatar, pseudo, titre, niveau, classe, vitrine.
 * @param {any} pub profil public (game/pass.js : profilPublic, ou document du classement)
 * @param {{ moi?: boolean }} [o]
 */
export function carteProfil(pub, o = {}) {
  const L = levelOf(Number(pub.xp) || 0);
  const vitrine = (pub.vitrine || []).map(badgeById).filter(Boolean);
  return el('div', { class: 'pf-carte' },
    el('div', { class: 'pf-ban', style: `background:${fondBanniere(pub.banniere)}`, 'aria-hidden': 'true' }),
    el('div', { class: 'pf-id' },
      avatarEl(pub, 'grand'),
      el('div', { class: 'pf-nom' },
        el('h3', {}, pub.pseudo || 'Technicien anonyme'),
        el('p', { class: 'pf-titre' }, pub.titre || L.title),
        el('p', { class: 'pf-meta' }, el('span', { class: 'pf-niv' }, `Niveau ${pub.niveau || L.n}`), `${(pub.titre || L.title) !== (pub.grade || L.title) ? ` · ${pub.grade || L.title}` : ''} · ${Number(pub.xp) || 0} XP`, pub.classeNom ? ` · ${pub.classeNom}` : '')),
      vitrine.length ? el('div', { class: 'pf-vitrine', 'aria-label': 'Badges en vitrine' }, ...vitrine.map((x) => el('span', { class: 'pf-vb ' + x.tier, title: x.desc }, icon(x.ico), el('small', {}, x.title)))) : null),
    o.moi ? el('div', { class: 'pf-xp' },
      el('div', { class: 'pc-bar', role: 'progressbar', 'aria-label': 'Progression vers le niveau suivant', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(L.pct * 100)) }, el('i', { style: { width: `${Math.round(L.pct * 100)}%` } })),
      el('small', {}, L.next ? `${L.remaining} XP avant le niveau ${L.n + 1}` : 'Niveau maximal : le pass est complet')) : null);
}

// ---------------- Mon profil ----------------
function blocCompte() {
  if (!COMPTE.dispo) return el('div', { class: 'pf-compte' }, icon('horsnuage'), el('p', {}, 'Les comptes en ligne ne sont pas activés sur cette version : ta progression reste sur cet ordinateur et le classement est fermé.'));
  if (!connecte()) {
    return el('div', { class: 'pf-compte invite' }, icon('nuage'),
      el('p', {}, el('b', {}, 'Connecte-toi'), ' pour retrouver ta progression sur n\'importe quel ordinateur, montrer ton profil et entrer au classement. Ton identifiant vient de ton professeur.'),
      el('button', { type: 'button', class: 'btn primary', id: 'pf-connexion', onclick: () => openConnexion() }, icon('connexion'), 'Se connecter'));
  }
  return el('div', { class: 'pf-compte' }, icon('nuage'),
    el('p', {}, `Connecté : ${nomDuCompte()}. ${estProf() ? 'Les professeurs ne sont pas au classement : vous y voyez vos élèves.' : 'Ta progression et ton profil sont enregistrés en ligne.'}`),
    el('button', { type: 'button', class: 'btn', onclick: () => emit('settings') }, 'Mon compte'));
}
function blocJour() {
  const g = game(); const sr = serie(g.jours); const d = etatDefis(g);
  const tous = d.every((x) => x.fini);
  return el('section', { class: 'pf-sec pf-jour' },
    el('div', { class: 'pf-serie' + (sr.aujourdhui ? ' on' : '') },
      icon('serie'),
      el('div', {}, el('b', {}, sr.n > 1 ? `${sr.n} jours d'affilée` : sr.n === 1 ? '1 jour' : 'Pas de série en cours'),
        el('small', {}, sr.aujourdhui ? `Bonus du jour reçu. Record : ${sr.best} jour${sr.best > 1 ? 's' : ''}.` : `Ton premier gain du jour rapporte ${bonusSerie(sr.n + 1)} XP de bonus.`))),
    el('div', { class: 'pf-defis' },
      el('h4', {}, icon('defis'), 'Défis du jour', el('small', {}, tous ? ' · tous réussis' : ` · les trois : +${BONUS_DEFIS} XP`)),
      ...d.map((x) => el('div', { class: 'pf-defi' + (x.fini ? ' fini' : '') },
        el('span', { class: 'pf-defi-t' }, icon(x.fini ? 'fait' : 'objectif'), x.defi.t),
        el('span', { class: 'pf-defi-p' }, `+${x.defi.pts} XP`),
        el('i', { class: 'pf-defi-bar', role: 'progressbar', 'aria-label': x.defi.t, 'aria-valuemin': '0', 'aria-valuemax': String(x.but), 'aria-valuenow': String(x.val) }, el('i', { style: { width: `${Math.round((x.val / x.but) * 100)}%` } })),
        el('small', {}, `${x.val} / ${x.but}`)))));
}
/** l'apparence : un onglet par type d'objet, une grille d'objets (gagnés ou verrouillés) */
function blocApparence(redraw) {
  const p = profil(); let type = /** @type {keyof typeof COSMETIQUES} */ ('avatar');
  const grid = el('div', { class: 'pf-objets' });
  const tabs = el('div', { class: 'seg', role: 'group', 'aria-label': 'Type d\'objet' });
  const apercu = (t, x) => {
    if (t === 'avatar') return avatarEl({ avatar: x.id, cadre: 'aucun' });
    if (t === 'cadre') return avatarEl({ avatar: p.avatar, cadre: x.id });
    if (t === 'banniere') return el('span', { class: 'pf-swatch', style: `background:${x.fond}`, 'aria-hidden': 'true' });
    return el('span', { class: 'pf-titre-ap' }, x.id === 'grade' ? levelOf(xpOf()).title : x.nom);
  };
  const draw = () => {
    for (const b of tabs.children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.v === type));
    const porte = /** @type {any} */ (p)[type];
    grid.replaceChildren(...COSMETIQUES[type].map((x) => {
      const ok = debloque(type, x.id), n = niveauObjet(type, x.id), on = porte === x.id;
      return el('button', { type: 'button', class: 'pf-objet' + (on ? ' porte' : '') + (ok ? '' : ' verrou'), 'data-objet': type + ':' + x.id, disabled: !ok, 'aria-pressed': String(on), title: ok ? `Porter : ${x.nom}` : `Se gagne au niveau ${n} du pass` },
        apercu(type, x), el('b', {}, x.nom), el('small', {}, on ? 'Porté' : ok ? (n ? `Niveau ${n}` : 'De base') : [icon('cadenas'), ` Niveau ${n}`]));
    }));
  };
  grid.addEventListener('click', (e) => {
    const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.pf-objet')); if (!b || b.hasAttribute('disabled')) return;
    const [t, id] = String(b.dataset.objet).split(':');
    if (equiper(t, id)) { redraw(); }
  });
  for (const t of /** @type {Array<keyof typeof COSMETIQUES>} */ (['avatar', 'banniere', 'cadre', 'titre'])) {
    const won = COSMETIQUES[t].filter((x) => debloque(t, x.id)).length;
    tabs.append(el('button', { type: 'button', 'data-v': t, onclick: () => { type = t; draw(); } }, `${NOM_TYPE[t]} ${won}/${COSMETIQUES[t].length}`));
  }
  draw();
  return el('section', { class: 'pf-sec' }, el('h4', {}, icon('personnaliser'), 'Mon apparence'), tabs, grid);
}
function blocIdentite(redraw) {
  const p = profil();
  const pseudo = /** @type {HTMLInputElement} */ (el('input', { type: 'text', id: 'pf-pseudo', maxlength: '20', value: p.pseudo, placeholder: 'Ton pseudo', autocomplete: 'nickname' }));
  const msg = el('small', { class: 'pf-msg', role: 'status', 'aria-live': 'polite' });
  const save = () => {
    if (pseudo.value && !pseudoPropre(pseudo.value)) { msg.textContent = 'Pseudo : 3 à 20 caractères (lettres, chiffres, espace, tiret).'; return; }
    regler({ pseudo: pseudo.value }); msg.textContent = 'Enregistré.'; redraw();
  };
  const vis = el('div', { class: 'seg', role: 'group', 'aria-label': 'Visible au classement' },
    ...[[true, 'Visible au classement'], [false, 'Caché']].map(([v, t]) => el('button', { type: 'button', 'aria-pressed': String(p.visible === v), onclick: () => { regler({ visible: v }); redraw(); } }, icon(v ? 'visible' : 'cache'), String(t))));
  return el('section', { class: 'pf-sec' }, el('h4', {}, icon('carte'), 'Mon identité'),
    el('form', { class: 'pf-ident', onsubmit: (e) => { e.preventDefault(); save(); } },
      el('label', { class: 'cp-champ' }, el('span', {}, 'Pseudo (facultatif)'), pseudo),
      el('button', { type: 'submit', class: 'btn', id: 'pf-ident-ok' }, 'Enregistrer'), msg),
    vis, el('p', { class: 'note' }, 'Les autres comptes voient ton pseudo (sans pseudo : ton prénom et l\'initiale de ton nom), ton apparence, ton niveau et tes badges ; jamais ton adresse ni tes réponses. Caché, tu sors du classement.'));
}
function blocVitrine(redraw) {
  const p = profil(), g = game();
  const won = BADGES.filter((b) => g.badges[b.id] && !b.comp);
  if (!won.length) return el('section', { class: 'pf-sec' }, el('h4', {}, icon('medaille'), 'Ma vitrine'), el('p', { class: 'note' }, 'Gagne un premier badge (onglet Succès) pour le mettre en vitrine sur ton profil.'));
  return el('section', { class: 'pf-sec' }, el('h4', {}, icon('medaille'), 'Ma vitrine', el('small', {}, ` · ${p.vitrine.length} / 3, montrés à côté de ton nom`)),
    el('div', { class: 'pf-badges' }, ...won.map((b) => {
      const on = p.vitrine.includes(b.id);
      return el('button', { type: 'button', class: 'pf-badge won ' + b.tier + (on ? ' porte' : ''), 'aria-pressed': String(on), title: b.desc, onclick: () => {
        const v = on ? p.vitrine.filter((x) => x !== b.id) : [...p.vitrine, b.id];
        if (v.length > 3) { toast('Trois badges au plus en vitrine : retire d\'abord un badge.', '', 3000); return; }
        regler({ vitrine: v }); redraw();
      } }, icon(b.ico), el('b', {}, b.title), el('small', {}, on ? 'En vitrine' : TIER[b.tier]));
    })));
}
function pageProfil(box) {
  const redraw = () => { const y = scrollY(box); pageProfil(box); restoreY(box, y); };
  const n = aRecuperer().length;
  poser(box, 
    carteProfil(monPublic(), { moi: true }),
    n ? el('button', { type: 'button', class: 'pf-attente', onclick: () => showTab('pass') }, icon('cadeau'), el('b', {}, `${n} récompense${n > 1 ? 's' : ''} à récupérer`), el('span', {}, 'Ouvrir le pass')) : null,
    blocCompte(), blocJour(), blocIdentite(redraw), blocApparence(redraw), blocVitrine(redraw));
}
const scrollY = (box) => { const s = box.closest('.ly-scroll'); return s ? s.scrollTop : 0; };
const restoreY = (box, y) => { const s = box.closest('.ly-scroll'); if (s) s.scrollTop = y; };

// ---------------- le pass ----------------
function apercuPalier(pal) {
  const x = objet(pal.type, pal.id);
  if (pal.type === 'avatar') return avatarEl({ avatar: pal.id, cadre: 'aucun' });
  if (pal.type === 'cadre') return avatarEl({ avatar: profil().avatar, cadre: pal.id });
  if (pal.type === 'banniere') return el('span', { class: 'pf-swatch', style: `background:${x.fond}`, 'aria-hidden': 'true' });
  return el('span', { class: 'pf-titre-ap' }, x.nom);
}
function pagePass(box) {
  const xp = xpOf(), L = levelOf(xp), p = profil(), att = aRecuperer();
  const redraw = () => { const y = scrollY(box); pagePass(box); restoreY(box, y); };
  const tiles = [];
  for (let n = 2; n <= NIVEAU_MAX; n++) {
    const pals = paliersDu(n); if (!pals.length) continue;
    const atteint = n <= L.n, recu = !!p.recus[n];
    const r = rarete(n);
    tiles.push(el('div', { class: `pf-palier ${r}` + (recu ? ' recu' : atteint ? ' pret' : ' verrou') + (n === L.n + 1 ? ' prochain' : ''), 'data-niveau': String(n) },
      el('header', {}, el('b', {}, `Niveau ${n}`), el('small', {}, NOM_RARETE[r])),
      el('div', { class: 'pf-pal-ap' }, ...pals.map(apercuPalier)),
      el('p', {}, pals.map((x) => `${NOM_TYPE[x.type]} « ${objet(x.type, x.id).nom} »`).join(' + ')),
      recu ? el('span', { class: 'pf-pal-etat' }, icon('fait'), 'Récupéré')
        : atteint ? el('button', { type: 'button', class: 'btn small primary', onclick: () => { const g = recuperer(n); if (g.length) { toast(`Niveau ${n} : ${g.map((x) => objet(x.type, x.id).nom).join(', ')} récupéré !`, 'good', 3500); redraw(); } } }, icon('cadeau'), 'Récupérer')
          : el('span', { class: 'pf-pal-etat' }, icon('cadenas'), `${Math.max(0, xpPourNiveau(n) - xp)} XP`)));
  }
  poser(box, 
    el('section', { class: 'pf-sec pf-pass-tete' },
      el('div', {}, el('h3', {}, 'Le pass du technicien'),
        el('p', { class: 'note' }, `Niveau ${L.n} sur ${NIVEAU_MAX} · ${L.title} · ${xp} XP. Chaque niveau donne une récompense pour ton profil ; les niveaux en 5 donnent les plus rares. Tout se gagne en jouant et en apprenant.`)),
      att.length ? el('button', { type: 'button', class: 'btn primary', id: 'pf-tout', onclick: () => { const g = recuperer(); toast(`${g.length} récompense${g.length > 1 ? 's' : ''} récupérée${g.length > 1 ? 's' : ''} !`, 'good', 3500); redraw(); } }, icon('cadeau'), `Tout récupérer (${att.length})`) : null),
    el('div', { class: 'pf-pass' }, ...tiles));
  // le prochain palier en vue
  const next = /** @type {HTMLElement | null} */ (box.querySelector('.pf-palier.pret') || box.querySelector('.pf-palier.prochain'));
  if (next) requestAnimationFrame(() => next.scrollIntoView({ block: 'center' }));
}

// ---------------- succès ----------------
/** la liste des badges d'un joueur : obtenus (date si on l'a), puis à obtenir */
function listeBadges(ids, dates = null, avecVerrou = true) {
  const won = new Set(ids);
  const general = BADGES.filter((b) => !b.comp);
  const comp = BADGES.filter((b) => b.comp && won.has(b.id));
  const card = (b) => el('div', { class: 'pf-badge ' + b.tier + (won.has(b.id) ? ' won' : ' locked'), title: b.desc },
    icon(won.has(b.id) ? b.ico : 'cadenas'), el('b', {}, b.title), el('small', {}, won.has(b.id) ? (dates && dates[b.id] ? `${TIER[b.tier]} · ${dateFr(dates[b.id])}` : TIER[b.tier]) : b.desc));
  return el('div', { class: 'pf-succes' },
    el('div', { class: 'pf-badges' }, ...general.filter((b) => avecVerrou || won.has(b.id)).map(card)),
    comp.length ? el('h4', {}, icon('livret'), `Compétences du référentiel : ${comp.filter((b) => b.tier === 'bronze').length} travaillées, ${comp.filter((b) => b.tier === 'or').length} consolidées`) : null);
}
function pageSucces(box) {
  const g = game(); const general = BADGES.filter((b) => !b.comp); const n = general.filter((b) => g.badges[b.id]).length;
  poser(box, el('section', { class: 'pf-sec' }, el('h3', {}, `Mes succès · ${n} / ${general.length}`),
    el('p', { class: 'note' }, 'Ils s\'affichent sur ton profil : les autres joueurs les voient depuis le classement.'),
    listeBadges(Object.keys(g.badges), g.badges)));
}

// ---------------- classement ----------------
const CL = { filtre: 'tous', liste: /** @type {Array<{ id: string, data: any }>} */ ([]), at: 0 };
async function pageClassement(box) {
  if (!connecte()) {
    poser(box, el('section', { class: 'pf-sec pf-vide' }, icon('classement'), el('h3', {}, 'Le classement des techniciens'),
      el('p', {}, COMPTE.dispo ? 'Connecte-toi pour voir le classement de ta promotion et y entrer.' : 'Les comptes en ligne ne sont pas activés sur cette version : le classement est fermé.'),
      COMPTE.dispo ? el('button', { type: 'button', class: 'btn primary', onclick: () => openConnexion() }, icon('connexion'), 'Se connecter') : null));
    return;
  }
  poser(box, el('p', { class: 'note' }, 'Chargement du classement…'));
  // le mien, pour qu'il y figure à jour
  publierBientot(true);
  if (Date.now() - CL.at > 20000) {
    const r = await classement();
    if (!r.ok) { poser(box, el('section', { class: 'pf-sec pf-vide' }, icon('alarme'), el('p', {}, r.error || 'Classement indisponible.'), el('button', { type: 'button', class: 'btn', onclick: () => { CL.at = 0; pageClassement(box); } }, 'Réessayer'))); return; }
    CL.liste = r.liste; CL.at = Date.now();
  }
  if (layerOpen() !== 'profil') return;
  dessinerClassement(box);
}
/** mon profil public, tel que les autres le voient */
const monPublic = () => profilPourCompte(PROG, connecte() ? COMPTE : {});
function dessinerClassement(box) {
  const moi = monPublic(), maClasse = estEleve() ? COMPTE.classe || '' : '', nomClasse = COMPTE.classeNom || '';
  // ma ligne : à jour (le document en ligne peut avoir quelques minutes de retard) ; un professeur n'est pas classé
  const liste = CL.liste.filter((x) => x.id !== COMPTE.uid);
  if (estEleve() && profil().visible) liste.push({ id: /** @type {string} */ (COMPTE.uid), data: moi });
  liste.sort((a, b) => (Number(b.data.xp) || 0) - (Number(a.data.xp) || 0));
  const vue = CL.filtre === 'classe' && maClasse ? liste.filter((x) => (x.data.classe || '') === maClasse) : liste;
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Qui afficher' },
    el('button', { type: 'button', 'aria-pressed': String(CL.filtre === 'tous'), onclick: () => { CL.filtre = 'tous'; dessinerClassement(box); } }, 'Tout le monde'),
    el('button', { type: 'button', 'aria-pressed': String(CL.filtre === 'classe'), disabled: !maClasse, title: maClasse ? `Seulement ${nomClasse || 'ma classe'}` : 'Ton professeur ne t\'a pas encore rangé dans une classe', onclick: () => { CL.filtre = 'classe'; dessinerClassement(box); } }, nomClasse ? `Ma classe (${nomClasse})` : 'Ma classe'));
  const rows = vue.map((x, i) => {
    const d = x.data, mine = x.id === COMPTE.uid;
    return el('button', { type: 'button', class: 'pf-ligne' + (mine ? ' moi' : '') + (i < 3 ? ' podium p' + (i + 1) : ''), 'data-uid': x.id, onclick: () => voirJoueur(box, x) },
      el('span', { class: 'pf-rang' }, i < 3 ? icon('trophee') : null, String(i + 1)),
      avatarEl(d, 'petit'),
      el('span', { class: 'pf-qui' }, el('b', {}, d.pseudo || 'Technicien anonyme', mine ? ' (toi)' : ''), el('small', {}, [d.titre, d.classeNom].filter(Boolean).join(' · '))),
      el('span', { class: 'pf-lv' }, el('small', {}, 'Niveau'), el('b', {}, String(d.niveau || levelOf(Number(d.xp) || 0).n))),
      el('span', { class: 'pf-pts' }, `${Number(d.xp) || 0} XP`),
      el('span', { class: 'pf-nb' }, icon('medaille'), String(d.nbBadges || (d.badges || []).length || 0)));
  });
  poser(box, 
    el('section', { class: 'pf-sec pf-cl-tete' }, el('div', {}, el('h3', {}, 'Classement'), el('p', { class: 'note' }, `Les élèves de l'établissement, par niveau (XP). ${liste.length} élève${liste.length > 1 ? 's' : ''} au classement.`)),
      seg, el('button', { type: 'button', class: 'btn small', onclick: () => { CL.at = 0; pageClassement(box); } }, 'Actualiser')),
    !estEleve() || profil().visible ? null : el('p', { class: 'note pf-cache' }, icon('cache'), 'Ton profil est caché : tu n\'apparais pas au classement (Mon profil → Mon identité).'),
    rows.length ? el('div', { class: 'pf-classement', role: 'list' }, ...rows.map((r) => { r.setAttribute('role', 'listitem'); return r; })) : el('p', { class: 'note' }, 'Personne dans cette classe pour l\'instant.'));
}
/** le profil d'un autre joueur, à la place du classement */
async function voirJoueur(box, x) {
  let d = x.data;
  if (x.id !== COMPTE.uid) { const frais = await profilDe(x.id); if (frais) d = frais; }
  const stats = [[d.lecons, 'leçons acquises'], [d.exercices, 'exercices terminés'], [d.competences, 'compétences travaillées'], [d.meilleureSerie, 'jours de série (record)']];
  poser(box, 
    el('button', { type: 'button', class: 'btn small pf-retour', onclick: () => dessinerClassement(box) }, icon('retourapp'), 'Retour au classement'),
    carteProfil(d),
    el('section', { class: 'pf-sec' }, el('div', { class: 'pf-stats' }, ...stats.map(([v, t]) => el('div', {}, el('b', {}, String(Number(v) || 0)), el('small', {}, t))))),
    el('section', { class: 'pf-sec' }, el('h4', {}, icon('medaille'), `Succès · ${(d.badges || []).filter((id) => { const b = badgeById(id); return b && !b.comp; }).length} / ${BADGES.filter((b) => !b.comp).length}`),
      listeBadges(d.badges || [], null, false)),
    d.maj ? el('p', { class: 'note' }, `Profil mis à jour le ${dateFr(d.maj)}.`) : null);
  const s = box.closest('.ly-scroll'); if (s) s.scrollTop = 0;
}

// ---------------- l'espace ----------------
/** ouvre le profil (onglet : profil, pass, succes, classement) */
export function openProfil(tab = 'profil') {
  if (layerOpen() === 'profil') { showTab(tab); return; }
  openLayer({ kind: 'profil', title: 'Profil', ico: 'profil', tabs: TABS, tab, show: (k, box) => {
    box.classList.add('pf-page', 'pf-onglet-' + k);
    if (k === 'pass') pagePass(box); else if (k === 'succes') pageSucces(box); else if (k === 'classement') pageClassement(box); else pageProfil(box);
  } });
}
on('profil', (o) => openProfil((o && o.tab) || 'profil'));
// le compte change (connexion, déconnexion) : l'onglet ouvert se redessine
on('compte', () => { if (layerOpen() === 'profil') { CL.at = 0; const t = /** @type {HTMLElement | null} */ (document.querySelector('#layer .tab.on')); showTab((t && t.dataset.k) || 'profil'); } });
on('progressImport', () => { if (layerOpen() === 'profil') { const t = /** @type {HTMLElement | null} */ (document.querySelector('#layer .tab.on')); showTab((t && t.dataset.k) || 'profil'); } });
// une récompense qui attend : dite une fois par niveau gagné
on('xp', (r) => { if (r && r.leveled && paliersDu(r.level.n).length) layerSay(`Niveau ${r.level.n} : une récompense t'attend dans le pass.`); });
export { PASS, avatarEl };
