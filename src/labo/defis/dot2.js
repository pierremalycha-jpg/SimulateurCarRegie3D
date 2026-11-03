// @ts-check
import { registerDefis } from '../defis.js';
import { entre, pick, tirer, fr } from '../../cours/exo.js';
import { valeur8 } from '../calc/dmx.js';
import { etatCue, listes, couleurDe, valeur, effetPosition, estChaser, versDeg, versV, position16, plageDe, milieuPlage, tourEffet, tourChaser, ROUE_COULEURS, ROUE_GOBOS, LYRES, RVBW } from '../calc/show.js';
import { SHOW_DEPART } from '../dot2/show_depart.js';

// ----------------------------------------------------------------------------------
// Les défis de la console dot2 (Labo, v19.29) : programmer pour de vrai. Le Labo charge le show de
// départ dans la console (le plateau 1 patché, ses groupes et ses presets, aucune cue : dot2/show_depart.js),
// l'élève programme comme il veut (programmeur, presets, macros, effets, exécuteurs), puis le Labo relit
// le show que la console a enregistré (« simdot2.session ») et le juge avec labo/calc/show.js : la cue
// demandée existe, et, en tenant compte du tracking, les lyres ont la bonne couleur, la bonne position,
// le bon effet. La solution charge un show qui marche. L'état de l'atelier : { show }.
// Les lyres du plateau : 13 et 14 spot (roue de couleurs, gobos), 15 et 16 wash RGBW ; groupes 7 « Lyres
// Spot », 8 « Lyres Wash », 9 « Lyres » ; presets de couleur 4.3 Bleu, 4.5 Rouge, 4.6 Vert.
// ----------------------------------------------------------------------------------
const SPOTS = ['13', '14'], WASHS = ['15', '16'], LYRES4 = ['13', '14', '15', '16'];
const clone = (x) => JSON.parse(JSON.stringify(x));
/** une cue au format de la console */
const cue = (no, name, values) => ({ no, name, trig: 'Go', trigTime: 0, fade: 0, outFade: null, delay: 0, outDelay: null, ptFade: {}, ptDelay: {}, cmd: '', protected: false, snapPercent: 0, values });
/** un exécuteur (une liste de cues) au format de la console ; chaser : il enchaîne ses cues tout seul */
const exec = (id, label, cues, chaser = false, speed = 60) => ({
  id, label, kind: 'cuelist', cues, fader: 'Master', buttons: ['Go', 'Flash'],
  settings: { isChaser: chaser, mib: false, autostart: true, autostop: true, masterSpeed: 0, useMasterRate: true, restart: 'First', wrapAround: true, offTime: 0, superPriority: false, offOnOverwritten: false, swopProtect: false, cueZero: false, useExecTime: true, chaserMode: 'Forward', chaserRun: 'Endless', chaserSpeed: speed, chaserFade: 0 },
});
/** les valeurs d'une couleur : roue pour une spot, RVB + blanc pour une wash */
const couleurSpot = (c) => ({ COLOR1: { v: milieuPlage(ROUE_COULEURS, c) } });
const couleurWash = (c) => { const [r, g, b, w] = RVBW[c]; return { COLORRGB1: { v: r }, COLORRGB2: { v: g }, COLORRGB3: { v: b }, COLORRGB5: { v: w } }; };
const plein = { DIM: { v: 1 } };
/** un show de solution : le show de départ, avec une séquence principale ou des exécuteurs */
const showAvec = (main, executors = {}) => { const s = clone(SHOW_DEPART); s.main.cues = main; s.executors = executors; return s; };
/** ce que dit une lyre, pour le retour à l'élève */
const dit = (show, st, f) => `${f} : ${couleurDe(show, st, f)}, ${Math.round(valeur(st, f, 'DIM') * 100)} %`;
const sansShow = { ok: false, mesure: 'la console n\'a encore rien enregistré', why: 'Programmez dans la console : elle enregistre son show toute seule une seconde après chaque changement.' };

registerDefis({
  'dot2-couleurs': {
    consigne: 'Le réalisateur veut une ambiance de couleur pour l\'ouverture : les lyres wash d\'une couleur, les lyres spot d\'une autre.',
    gen(rnd) {
      const cw = pick(rnd, ['rouge', 'vert', 'bleu', 'magenta', 'cyan', 'jaune']);
      const cs = pick(rnd, ['rouge', 'bleu', 'vert', 'jaune', 'magenta', 'orange', 'cyan'].filter((c) => c !== cw));
      const n = entre(rnd, 1, 3), p = pick(rnd, [20, 40, 60, 75, 80]);
      const vals = { ...Object.fromEntries(WASHS.map((f) => [f, { ...plein, ...couleurWash(cw) }])), ...Object.fromEntries(SPOTS.map((f) => [f, { ...plein, ...couleurSpot(cs) }])) };
      return {
        scene: { show: clone(SHOW_DEPART) },
        items: [
          {
            type: 'reglage', q: `Dans la séquence principale (Main), enregistrez la **cue ${n}** : les deux lyres **wash** (15 et 16) en **${cw}**, les deux lyres **spot** (13 et 14) en **${cs}**, toutes à **100 %**.`,
            check: (st) => {
              const S = st.show; if (!S) return sansShow;
              const E = etatCue(S, 'main', n);
              if (!E) return { ok: false, mesure: `pas de cue ${n} dans Main`, why: `Enregistrez la cue ${n} : Store, Cue, ${n}, Please (ou « Store Cue ${n} » en ligne de commande).` };
              const okW = WASHS.every((f) => couleurDe(S, E, f) === cw && valeur(E, f, 'DIM') >= 0.95);
              const okS = SPOTS.every((f) => couleurDe(S, E, f) === cs && valeur(E, f, 'DIM') >= 0.95);
              const mesure = LYRES4.map((f) => dit(S, E, f)).join(' ; ');
              return { ok: okW && okS, mesure: `cue ${n} : ${mesure}`, why: !okW ? `Les lyres wash ne sont pas toutes en ${cw} à 100 % : leur couleur se mélange en rouge, vert, bleu et blanc.` : `Les lyres spot ne sont pas toutes en ${cs} à 100 % : leur couleur se choisit sur la roue (Color Wheel).` };
            },
            corrige: { show: showAvec([cue(n, 'Ouverture', vals)]) },
            aides: ['Sélectionnez un groupe (Group 8 pour les wash, Group 7 pour les spot), réglez l\'intensité, puis la couleur.', 'Pour une wash, les encodeurs Red, Green, Blue, White ; pour une spot, la roue de couleurs. Puis Store Cue, avec les deux groupes dans le programmeur.'],
            solution: `Group 8 At 100, couleur ${cw} en RVB ; Group 7 At 100, roue sur ${cs} ; puis Store Cue ${n}. La solution charge ce show dans la console.`,
          },
          {
            type: 'nombre', q: `Le canal Bleu d'une lyre wash est un canal 8 bits. Quelle valeur DMX envoie la console pour **${p} %** ?`, answer: valeur8(p), tol: 1,
            aides: ['100 % = 255.', `${p} ÷ 100 × 255, arrondi.`],
            solution: `${p} % × 255 ≈ **${valeur8(p)}**.`,
          },
          {
            type: 'choix', q: 'Le réalisateur demande un bleu ciel très précis sur les lyres spot. Pourquoi est-ce difficile ?', choices: ['Leur couleur vient d\'une roue de filtres fixes : on choisit un filtre, pas une teinte', ['Il faut d\'abord régler leur gobo', 'Le gobo découpe la forme du faisceau ; il ne change pas sa couleur.'], ['Le DMX ne transmet pas les couleurs', 'Le DMX transmet des valeurs de canal : c\'est l\'appareil qui en fait une couleur, par un filtre ou un mélange.']], answer: 0,
            aides: ['Comparez la spot et la wash : comment chacune fabrique-t-elle sa couleur ?', 'Une roue, c\'est une série de filtres.'],
            solution: 'La spot a une **roue de couleurs** : quelques filtres fixes (rouge, bleu, vert…), entre lesquels on ne règle pas de teinte intermédiaire. La wash **mélange** ses LED rouge, verte, bleue et blanche : elle fait n\'importe quelle teinte.',
          },
        ],
      };
    },
  },
  'dot2-matricks': {
    consigne: 'Une lyre sur deux d\'une couleur, les autres d\'une autre : la macro MAtricks fait la sélection en deux temps.',
    gen(rnd) {
      const [a, b] = tirer(rnd, ['rouge', 'bleu', 'vert'], 2); const n = entre(rnd, 1, 4);
      const pres = { rouge: '4.5', bleu: '4.3', vert: '4.6' };
      const coul = (f, c) => (SPOTS.includes(f) ? couleurSpot(c) : couleurWash(c));
      const vals = Object.fromEntries(LYRES4.map((f, i) => [f, { ...plein, ...coul(f, i % 2 ? b : a) }]));
      const quiz = pick(rnd, [
        { type: 'choix', q: 'Le groupe 9 « Lyres » contient 13, 14, 15 et 16, dans cet ordre. Après la macro « MAtricks Odd », quelles lyres restent sélectionnées ?', choices: ['13 et 15', ['14 et 16', 'C\'est « MAtricks Even » : les rangs pairs de la sélection.'], ['Aucune : la macro efface la sélection', 'MAtricks ne vide pas la sélection : il n\'en garde qu\'une partie, et « MAtricks Reset » la rend entière.']], answer: 0, aides: ['Odd veut dire impair : il garde les rangs 1, 3, 5…', 'Les rangs dans l\'ordre de la sélection.'], solution: '**13 et 15** : les rangs impairs (1er et 3e) dans l\'ordre de la sélection.' },
        { type: 'choix', q: 'Quatre lyres sélectionnées ont chacune une couleur différente. Que fait la macro « Circular Copy > » ?', choices: ['Elle décale les valeurs d\'une lyre vers la suivante : les couleurs tournent d\'un cran', ['Elle copie la couleur de la première lyre sur toutes les autres', 'Ce serait un « Align » : Circular Copy fait tourner les valeurs, elle ne les uniformise pas.'], ['Elle mélange les lyres au hasard', 'C\'est « Shuffle Selection » (ou « Shuffle Values » pour les valeurs).']], answer: 0, aides: ['« Circular » : la dernière revient en premier.', 'Chaque lyre prend les valeurs de sa voisine.'], solution: '**Circular Copy >** décale les valeurs d\'un projecteur vers le suivant dans la sélection : appuyée plusieurs fois et enregistrée à chaque fois, elle fait une séquence qui tourne.' },
      ]);
      return {
        scene: { show: clone(SHOW_DEPART) },
        items: [
          {
            type: 'reglage', q: `Cue **${n}** de Main : les lyres **13 et 15** en **${a}**, les lyres **14 et 16** en **${b}**, les quatre à **100 %**. Astuce : groupe 9 « Lyres », macros « MAtricks Odd » puis « MAtricks Even », presets de couleur.`,
            check: (st) => {
              const S = st.show; if (!S) return sansShow;
              const E = etatCue(S, 'main', n);
              if (!E) return { ok: false, mesure: `pas de cue ${n} dans Main`, why: `Enregistrez la cue ${n} dans la séquence principale.` };
              const ok = LYRES4.every((f, i) => couleurDe(S, E, f) === (i % 2 ? b : a) && valeur(E, f, 'DIM') >= 0.95);
              return { ok, mesure: `cue ${n} : ${LYRES4.map((f) => dit(S, E, f)).join(' ; ')}`, why: `Il faut 13 et 15 en ${a}, 14 et 16 en ${b}, toutes à 100 %.` };
            },
            corrige: { show: showAvec([cue(n, 'Une sur deux', vals)]) },
            aides: [`Group 9, At 100 ; puis Macro « MAtricks Odd » : il ne reste que 13 et 15.`, `Preset ${pres[a]} (${a}) sur 13 et 15 ; Macro « MAtricks Even », preset ${pres[b]} (${b}) ; « MAtricks Reset », puis Store Cue ${n}.`],
            solution: `Group 9 At 100 ; MAtricks Odd → preset ${pres[a]} ; MAtricks Even → preset ${pres[b]} ; MAtricks Reset ; Store Cue ${n}. La solution charge ce show dans la console.`,
          },
          quiz,
          {
            type: 'nombre', q: 'La macro « MAtricks 1/3 » partage une sélection de 12 projecteurs en sous-groupes, un rang sur trois. Combien de projecteurs dans chaque sous-groupe ?', answer: 4, tol: 0,
            aides: ['Un rang sur trois : 1, 4, 7, 10, puis 2, 5, 8, 11…', '12 ÷ 3.'],
            solution: '12 ÷ 3 = **4** projecteurs par sous-groupe (rangs 1, 4, 7, 10 ; puis 2, 5, 8, 11 ; puis 3, 6, 9, 12).',
          },
        ],
      };
    },
  },
  'dot2-cercle': {
    consigne: 'Pour le générique, les deux lyres spot décrivent un cercle sur le décor, à une vitesse donnée.',
    gen(rnd) {
      const c = pick(rnd, ['bleu', 'rouge', 'vert', 'magenta', 'cyan']), s = pick(rnd, [20, 30, 40, 60]);
      const fx = (phase, amp) => ({ tpl: 5, form: 'sin', mode: 'rel', low: -amp, high: amp, speed: s, phase, width: 100, soft: 100, mult: 1, dir: 1 });
      const vals = Object.fromEntries(SPOTS.map((f) => [f, { ...plein, ...couleurSpot(c), PAN: { v: 0.5, fx: fx(0, 0.0222) }, TILT: { v: 0.674, fx: fx(90, 0.0444) } }]));
      const s2 = pick(rnd, [15, 30, 45, 60, 90, 120]);
      return {
        scene: { show: clone(SHOW_DEPART) },
        items: [
          {
            type: 'reglage', q: `Dans une cue (de Main ou d'un exécuteur), les lyres **spot 13 et 14** font un **cercle** (effet sur Pan et Tilt) à **${s} BPM** (à 15 % près), en **${c}**, à **100 %**.`,
            check: (st) => {
              const S = st.show; if (!S) return sansShow;
              let meilleur = '';
              for (const [id, E] of listes(S)) for (const q of E.cues) {
                const T = etatCue(S, id, q.no); if (!T) continue;
                const eff = SPOTS.map((f) => effetPosition(T, f));
                const ok = SPOTS.every((f, i) => eff[i] && eff[i].forme === 'cercle' && Math.abs(eff[i].speed - s) <= 0.15 * s && couleurDe(S, T, f) === c && valeur(T, f, 'DIM') >= 0.95);
                if (ok) return { ok: true, mesure: `${id === 'main' ? 'Main' : 'exécuteur ' + id}, cue ${q.no} : un cercle à ${eff[0].speed} BPM, en ${c}` };
                if (eff[0] && !meilleur) meilleur = `${id === 'main' ? 'Main' : 'exécuteur ' + id}, cue ${q.no} : la lyre 13 décrit une ${eff[0].forme} à ${eff[0].speed} BPM (déphasage ${Math.round(eff[0].dephasage)}°), en ${couleurDe(S, T, '13')}`;
              }
              return { ok: false, mesure: meilleur || 'aucune cue avec un effet sur Pan et Tilt des lyres spot', why: meilleur ? 'Il faut un cercle (Pan et Tilt déphasés de 90°), à la bonne vitesse, dans la bonne couleur, à 100 %.' : 'Ajoutez un effet de position aux lyres spot (le modèle Circle du pool d\'effets), puis enregistrez la cue.' };
            },
            corrige: { show: showAvec([], { '1.1': exec('1.1', 'Cercle spots', [cue(1, 'Cercle', vals)]) }) },
            aides: ['Group 7 (les spot), At 100, la couleur ; puis l\'effet « Circle » du pool d\'effets.', `Réglez la vitesse de l'effet à ${s} BPM (encodeur Speed), puis Store Cue (ou sur un exécuteur).`],
            solution: `Group 7 At 100, roue sur ${c}, effet Circle à ${s} BPM : Pan et Tilt en sinus déphasés de 90°. La solution le met sur l'exécuteur 1.1.`,
          },
          {
            type: 'nombre', q: `Un effet de position tourne à **${s2} BPM** (battements par minute, un tour par battement). Combien de secondes pour un tour ?`, answer: Math.round(tourEffet(s2) * 100) / 100, tol: 0.01, unite: 's',
            aides: ['Une minute = 60 secondes.', `60 ÷ ${s2}.`],
            solution: `60 ÷ ${s2} = **${fr(tourEffet(s2), tourEffet(s2) % 1 ? 2 : 0)} s** par tour.`,
          },
          {
            type: 'choix', q: 'Pan et Tilt suivent chacun un sinus à la même vitesse. Pour que la tache décrive un cercle, de combien les décaler ?', choices: ['D\'un quart de tour : 90°', ['De rien : 0°', 'Les deux montent et descendent ensemble : la tache va et vient sur une droite (en diagonale).'], ['D\'un demi-tour : 180°', 'Ils sont opposés : la tache va et vient aussi sur une droite, dans l\'autre diagonale.']], answer: 0,
            aides: ['Un cercle : x = sin t, y = cos t.', 'Cosinus = sinus décalé d\'un quart de tour.'],
            solution: '**90°** : x = sin t et y = sin (t + 90°) = cos t, c\'est un cercle (une ellipse si les amplitudes diffèrent).',
          },
        ],
      };
    },
  },
  'dot2-chaser': {
    consigne: 'Pendant la musique d\'attente, les lyres wash changent de couleur toutes seules : un chaser de quatre pas.',
    gen(rnd) {
      const seq = tirer(rnd, ['rouge', 'vert', 'bleu', 'blanc', 'magenta', 'jaune'], 4); const bpm = pick(rnd, [30, 60, 90, 120]);
      const cues = seq.map((c, k) => cue(k + 1, `Pas ${k + 1}`, Object.fromEntries(WASHS.map((f) => [f, { ...plein, ...couleurWash(c) }]))));
      return {
        scene: { show: clone(SHOW_DEPART) },
        items: [
          {
            type: 'reglage', q: `Sur un **exécuteur** (pas la séquence principale), créez un **chaser** de 4 pas sur les lyres wash 15 et 16, à 100 % : **${seq.join(', ')}**, dans cet ordre.`,
            check: (st) => {
              const S = st.show; if (!S) return sansShow;
              let vu = '';
              for (const [id, E] of listes(S)) {
                if (id === 'main') continue;
                const nos = [...E.cues].map((q) => q.no).sort((x, y) => x - y);
                if (nos.length < 4) { vu = vu || `exécuteur ${id} : ${nos.length} cue${nos.length > 1 ? 's' : ''}`; continue; }
                const couleurs = nos.slice(0, 4).map((no) => { const T = etatCue(S, id, no); return WASHS.every((f) => valeur(T, f, 'DIM') >= 0.95) && couleurDe(S, T, '15') === couleurDe(S, T, '16') ? couleurDe(S, T, '15') : '?'; });
                const okSeq = couleurs.every((c, k) => c === seq[k]);
                if (okSeq && estChaser(E)) return { ok: true, mesure: `exécuteur ${id} en chaser : ${couleurs.join(', ')}` };
                vu = `exécuteur ${id}${estChaser(E) ? ' (chaser)' : ' (pas en mode chaser)'} : ${couleurs.join(', ')}`;
                if (okSeq && !estChaser(E)) return { ok: false, mesure: vu, why: 'Les pas sont justes, mais l\'exécuteur n\'est pas un chaser : réglez-le en chaser (Edit Setup de l\'exécuteur) pour qu\'il enchaîne tout seul.' };
              }
              return { ok: false, mesure: vu || 'aucun exécuteur avec des cues', why: 'Il faut quatre cues sur un exécuteur, dans le bon ordre, et l\'exécuteur en chaser.' };
            },
            corrige: { show: showAvec([], { '1.2': exec('1.2', 'Chaser couleurs', cues, true, bpm) }) },
            aides: ['Group 8 At 100, une couleur, Store sur un exécuteur (cue 1) ; puis la couleur suivante, Store (cue 2)…', 'Dans les réglages de l\'exécuteur, choisissez le mode chaser : il enchaîne ses cues à sa vitesse.'],
            solution: `Quatre cues sur l'exécuteur 1.2 : ${seq.join(', ')} ; exécuteur réglé en chaser. La solution charge ce show dans la console.`,
          },
          {
            type: 'nombre', q: `Ce chaser avance d'un pas par battement à **${bpm} BPM**. Combien de secondes pour faire les 4 pas ?`, answer: tourChaser(bpm, 4), tol: 0.01, unite: 's',
            aides: ['Un pas dure 60 ÷ BPM secondes.', `4 × 60 ÷ ${bpm}.`],
            solution: `4 × 60 ÷ ${bpm} = **${fr(tourChaser(bpm, 4), tourChaser(bpm, 4) % 1 ? 1 : 0)} s** pour un tour.`,
          },
          {
            type: 'choix', q: 'Qu\'est-ce qui distingue un chaser d\'une séquence de cues ordinaire ?', choices: ['Il passe d\'un pas au suivant tout seul, à sa vitesse, en boucle', ['Il ne peut avoir que quatre pas', 'Un chaser a autant de pas que l\'on veut.'], ['Ses cues ne gardent pas les couleurs', 'Ses pas sont des cues comme les autres, avec toutes leurs valeurs.']], answer: 0,
            aides: ['Dans une séquence, qui déclenche la cue suivante ?', 'Le chaser n\'attend pas de Go.'],
            solution: 'Un **chaser** enchaîne ses pas tout seul, à sa vitesse (BPM, réglable au tap), en boucle ; une séquence attend le **Go** de l\'opérateur.',
          },
        ],
      };
    },
  },
  'dot2-position': {
    consigne: 'Le réalisateur veut un motif de gobo sur le décor : pointer les deux lyres spot au même endroit.',
    gen(rnd) {
      const C = LYRES['gen-spot']; const p = pick(rnd, [-90, -45, -30, 30, 45, 90]), t = pick(rnd, [30, 40, 50, 60, -40]);
      const g = pick(rnd, ['gobo 1', 'gobo 2', 'gobo 3', 'gobo 4']); const n = entre(rnd, 1, 4);
      const vals = Object.fromEntries(SPOTS.map((f) => [f, { ...plein, PAN: { v: versV(p, C.pan) }, TILT: { v: versV(t, C.tilt) }, GOBO1: { v: milieuPlage(ROUE_GOBOS, g) } }]));
      const p16 = position16(p, C.pan);
      return {
        scene: { show: clone(SHOW_DEPART) },
        items: [
          {
            type: 'reglage', q: `Cue **${n}** de Main : les lyres **spot 13 et 14** à **Pan ${p}°**, **Tilt ${t}°** (à 5° près), avec le **${g}**, à **100 %**.`,
            check: (st) => {
              const S = st.show; if (!S) return sansShow;
              const E = etatCue(S, 'main', n);
              if (!E) return { ok: false, mesure: `pas de cue ${n} dans Main`, why: `Enregistrez la cue ${n} dans la séquence principale.` };
              const lit = (f) => ({ pan: versDeg(valeur(E, f, 'PAN'), C.pan), tilt: versDeg(valeur(E, f, 'TILT'), C.tilt), gobo: plageDe(ROUE_GOBOS, valeur(E, f, 'GOBO1')), dim: valeur(E, f, 'DIM') });
              const L = SPOTS.map(lit);
              const ok = L.every((x) => Math.abs(x.pan - p) <= 5 && Math.abs(x.tilt - t) <= 5 && x.gobo === g && x.dim >= 0.95);
              return { ok, mesure: L.map((x, i) => `${SPOTS[i]} : pan ${Math.round(x.pan)}°, tilt ${Math.round(x.tilt)}°, ${x.gobo}, ${Math.round(x.dim * 100)} %`).join(' ; '), why: 'Pan, tilt, gobo et intensité doivent tous y être, sur les deux lyres.' };
            },
            corrige: { show: showAvec([cue(n, 'Gobo sur le décor', vals)]) },
            aides: ['Group 7, At 100 ; l\'encodeur Pan et l\'encodeur Tilt affichent des degrés (la calculatrice aussi).', `Pan ${p}, Tilt ${t}, puis la roue de gobos sur « ${g} » ; Store Cue ${n}.`],
            solution: `Group 7 At 100, Pan ${p}°, Tilt ${t}°, ${g}, Store Cue ${n}. La solution charge ce show dans la console.`,
          },
          {
            type: 'nombre', q: `Le pan de la lyre spot couvre 540° (de −270° à +270°) sur 16 bits (0 à 65 535). Quelle valeur 16 bits pour **${p}°** ?`, answer: p16.v16, tol: 1,
            aides: ['−270° vaut 0 et +270° vaut 65 535.', `(${p} + 270) ÷ 540 × 65 535, arrondi.`],
            solution: `(${p} + 270) ÷ 540 × 65 535 = **${fr(p16.v16)}** : octet grossier ${p16.grossier}, octet fin ${p16.fin}.`,
          },
          {
            type: 'nombre', q: `Et l'**octet grossier** (le premier des deux canaux) de cette valeur ${fr(p16.v16)} ?`, answer: p16.grossier, tol: 0,
            aides: ['L\'octet grossier compte les paquets de 256.', `${fr(p16.v16)} ÷ 256, partie entière.`],
            solution: `${fr(p16.v16)} ÷ 256 = **${p16.grossier}** (reste ${p16.fin} : l'octet fin).`,
          },
        ],
      };
    },
  },
});
