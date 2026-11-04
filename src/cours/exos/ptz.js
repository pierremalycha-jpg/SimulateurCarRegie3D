// @ts-check
import { registerExos, entre, pick, fr } from '../exo.js';
import { OPTIQUES, angleH, champ, focalePour, tempsPano, materiel, codeVitesse, commande, urlCommande, chargeLien, fluxMax, volumeGo } from '../ptz_calc.js';
import { CLASSES_POE, POE, reseauDe, hote, masqueDe, tosDe, dscpAF } from '../../labo/calc/ptz.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « Les caméras PTZ » (v19.30) : le champ d'une tourelle, le matériel d'un banc,
// l'adresse et le réseau d'une caméra, Easy IP Setup et la fenêtre de 20 minutes, le budget PoE, la page web et le
// port, la commande HTTP du pupitre, la charge d'un lien et le volume d'un flux, le DSCP, le diagnostic couche par
// couche. Les réponses sont calculées par cours/ptz_calc.js et le modèle de l'atelier du Labo (labo/calc/ptz.js).
// ----------------------------------------------------------------------------------
const NOMS = { he130: 'l\'AW-HE130', ue20: 'l\'AW-UE20' };
const RESEAUX = ['192.168.10.0', '192.168.20.0', '192.168.50.0', '10.10.5.0', '10.20.1.0', '172.16.8.0'];

registerExos({
  'ptz-tourelle': {
    titre: 'Cadrer avec une tourelle',
    consigne: 'Vous placez une tourelle du BTS pour une émission : vous calculez son champ, la focale d\'un cadre et la durée d\'un mouvement.',
    gen(rnd) {
      const m = pick(rnd, ['he130', 'ue20']), O = OPTIQUES[m];
      const f = pick(rnd, m === 'he130' ? [6, 9, 12, 18, 24, 36] : [6, 9, 12, 18, 24]), d = entre(rnd, 3, 15);
      const L = pick(rnd, [1, 1.5, 2, 3, 4]), d2 = entre(rnd, 4, 12), P = focalePour(m, L, d2);
      const a = pick(rnd, [45, 60, 90, 120, 180]), v = pick(rnd, [10, 15, 20, 30, 45, 60]);
      return [
        {
          type: 'nombre', q: `${NOMS[m][0].toUpperCase() + NOMS[m].slice(1)} est à **${f} mm**, à **${d} m** du sujet. Quelle largeur filme-t-elle (capteur large d'environ ${fr(champ(m, f, 1) * f, 2)} mm) ?`, answer: Math.round(champ(m, f, d) * 100) / 100, tol: 0.05, unite: 'm',
          aides: ['Largeur filmée = distance × largeur du capteur ÷ focale (en mètres et millimètres : les unités se simplifient).', `${d} × ${fr(champ(m, f, 1) * f, 2)} ÷ ${f}.`],
          solution: `${d} × ${fr(champ(m, f, 1) * f, 2)} ÷ ${f} ≈ **${fr(champ(m, f, d), 2)} m**.`,
        },
        {
          type: 'nombre', q: `Quelle focale pour cadrer **${fr(L, 1)} m** de large à **${d2} m** avec ${NOMS[m]} ?`, answer: Math.round(P.f * 10) / 10, tol: 0.3, unite: 'mm',
          aides: ['Focale = distance × largeur du capteur ÷ largeur à cadrer.', `${d2} × ${fr(champ(m, 1, 1), 2)} ÷ ${fr(L, 1)}.`],
          solution: `${d2} × ${fr(champ(m, 1, 1), 2)} ÷ ${fr(L, 1)} ≈ **${fr(P.f, 1)} mm** : ${P.dans ? 'dans' : 'hors de'} son zoom (${fr(O.fmin, 1)} à ${fr(O.fmax, 1)} mm).`,
        },
        {
          type: 'nombre', q: `Un panoramique de **${a}°** à **${v}°/s** dure combien de secondes ?`, answer: Math.round(tempsPano(a, v) * 10) / 10, tol: 0.1, unite: 's',
          aides: ['Durée = angle ÷ vitesse.', `Le calcul : ${a} ÷ ${v}.`],
          solution: `${a} ÷ ${v} = **${fr(tempsPano(a, v), 1)} s**.`,
        },
        {
          type: 'choix', q: `Vous passez ${NOMS[m]} de ${f} mm à ${2 * f} mm sans la bouger. L'angle de champ…`,
          choices: [`se resserre (de ${fr(angleH(m, f), 0)}° à ${fr(angleH(m, 2 * f), 0)}° environ)`, ['s\'ouvre', 'Une focale plus longue resserre le champ.'], ['ne change pas', 'L\'angle dépend de la focale.']], answer: 0,
          aides: ['Plus la focale est longue, plus le sujet paraît grand.', 'Le champ vaut environ 2 × arctan(capteur ÷ 2f).'],
          solution: `Il se resserre : environ ${fr(angleH(m, f), 0)}° à ${f} mm, ${fr(angleH(m, 2 * f), 0)}° à ${2 * f} mm.`,
        },
      ];
    },
  },
  'ptz-systeme': {
    titre: 'Équiper un banc de tourelles',
    consigne: 'Vous préparez la liste du matériel d\'une régie légère : ports du switch, puissance PoE, câbles.',
    gen(rnd) {
      const n1 = entre(rnd, 1, 5), n2 = entre(rnd, 0, 4), rp = rnd() < 0.7, B = materiel(n1, n2, rp);
      return [
        {
          type: 'nombre', q: `${n1} AW-HE130, ${n2} AW-UE20${rp ? ', le pupitre AW-RP150' : ''} et le PC technique. Combien de ports du switch ?`, answer: B.ports, tol: 0,
          aides: ['Un port par appareil branché au réseau.', `${n1} + ${n2}${rp ? ' + 1' : ''} + 1 (le PC).`],
          solution: `${n1} + ${n2}${rp ? ' + 1' : ''} + 1 = **${B.ports}** ports.`,
        },
        {
          type: 'nombre', q: `Tous ces appareils sauf le PC sont en PoE+ classe 4. Combien de watts le switch réserve-t-il (allocation par classe) ?`, answer: B.reserve, tol: 0, unite: 'W',
          pieges: [{ v: Math.round(B.portsPoe * 25.5 * 10) / 10, why: '25,5 W arrivent à l\'appareil ; le switch réserve ce qu\'il fournit : 30 W par port.' }],
          aides: ['Classe 4 : 30 W réservés par appareil.', `Le calcul : ${B.portsPoe} × 30.`],
          solution: `${B.portsPoe} × 30 = **${B.reserve} W**.`,
        },
        {
          type: 'nombre', q: `Combien de câbles SDI pour les ${n1 + n2} caméras${rp ? ' et le retour de contrôle du pupitre' : ''} ?`, answer: B.sdi, tol: 0,
          aides: ['Un SDI par caméra vers le mélangeur.', rp ? 'Plus un retour vers l\'entrée SDI du pupitre.' : 'Sans pupitre, pas de retour de contrôle.'],
          solution: `${n1 + n2}${rp ? ' + 1' : ''} = **${B.sdi}** câbles SDI.`,
        },
        {
          type: 'choix', q: 'Par quoi passe l\'ordre de zoom envoyé par le pupitre ?',
          choices: ['Le réseau IP, en HTTP', ['Le câble SDI', 'Le SDI ne va que de la caméra au mélangeur.'], ['Les GPIO du mélangeur', 'Les GPIO portent le tally.']], answer: 0,
          aides: ['Le pupitre et la caméra sont branchés au même switch.', 'Le pupitre parle à la caméra comme un navigateur.'],
          solution: 'Par le **réseau IP** : une requête HTTP du pupitre à la caméra.',
        },
      ];
    },
  },
  'ptz-adresse': {
    titre: 'Adresser une caméra et son PC',
    consigne: 'La fiche du banc donne un réseau : vous vérifiez les adresses, les masques et l\'URL de chaque caméra.',
    gen(rnd) {
      const base = pick(rnd, RESEAUX), p = pick(rnd, [24, 25, 26, 27]), R = reseauDe(base, masqueDe(p));
      const n = entre(rnd, 2, Math.min(29, R.hotes - 1)), port = pick(rnd, [8080, 8000, 81, 8888]);
      const dehors = hote(base, 2 ** (32 - p) + entre(rnd, 2, 20));
      return [
        {
          type: 'nombre', q: `Combien d'appareils au plus dans le réseau **${base}/${p}** ?`, answer: R.hotes, tol: 0,
          pieges: [{ v: R.hotes + 2, why: 'Il faut retirer l\'adresse du réseau et celle de diffusion.' }],
          aides: [`2 puissance (32 − ${p}) adresses en tout.`, 'Moins l\'adresse du réseau et celle de diffusion.'],
          solution: `2^${32 - p} − 2 = **${R.hotes}** appareils.`,
        },
        {
          type: 'texte', q: `Quelle est l'adresse de **diffusion** du réseau ${base}/${p} ?`, accept: [R.diffusion], forme: 'ip', placeholder: '192.168.10.255',
          aides: ['Tous les bits d\'appareil à 1.', `Adresse du réseau + ${2 ** (32 - p) - 1}.`],
          solution: `Tous les bits d'appareil à 1 : **${R.diffusion}**.`,
        },
        {
          type: 'choix', q: `La caméra est en ${hote(base, n)} / ${masqueDe(p)}. Le PC est en ${dehors} / ${masqueDe(p)}. Le PC ouvre-t-il sa page web ?`,
          choices: ['Non : ils ne sont pas dans le même réseau, et le banc n\'a pas de routeur', ['Oui : les trois premiers nombres sont proches', 'Ce qui compte, c\'est le réseau donné par le masque.'], ['Oui, grâce à la passerelle', 'Sur un banc sans routeur, la passerelle ne mène nulle part.']], answer: 0,
          aides: ['Calculez le réseau de chacun avec le masque.', `Le réseau de la caméra va de ${R.reseau} à ${R.diffusion}.`],
          solution: `${dehors} n'est pas dans ${R.reseau}/${p} : **pas de réseau commun**, le PC ne joint pas la caméra.`,
        },
        {
          type: 'texte', q: `La caméra en ${hote(base, n)} écoute en HTTP sur le port **${port}**. Quelle URL tapez-vous ?`, accept: [`http://${hote(base, n)}:${port}`, `http://${hote(base, n)}:${port}/`, `${hote(base, n)}:${port}`], forme: 'ip', placeholder: 'http://192.168.10.11',
          pieges: [{ v: `http://${hote(base, n)}`, why: 'Sans port, le navigateur frappe au port 80.' }],
          aides: ['L\'adresse, deux-points, le port.', 'http://adresse:port'],
          solution: `L'adresse et le port : **http://${hote(base, n)}:${port}**.`,
        },
      ];
    },
  },
  'ptz-easyip': {
    titre: 'Mettre en service avec Easy IP Setup',
    consigne: 'Des caméras neuves arrivent sur le banc : vous les trouvez avec Easy IP Setup et vous les adressez.',
    gen(rnd) {
      const n = entre(rnd, 2, 6), t = entre(rnd, 21, 55), t2 = entre(rnd, 2, 18);
      const base = pick(rnd, RESEAUX), premier = entre(rnd, 11, 40);
      return [
        {
          type: 'choix', q: `${n} caméras neuves sont branchées ensemble. Combien d'adresses IP différentes Easy IP Setup affiche-t-il ?`,
          choices: ['Une seule : 192.168.0.10 pour toutes', [`${n}`, 'Neuves, elles ont toutes l\'adresse d\'usine.'], ['Aucune : elles sont en conflit', 'Easy IP Setup les liste par leur MAC, même à la même adresse.']], answer: 0,
          aides: ['Que vaut l\'adresse d\'usine d\'une tourelle Panasonic ?', 'Elles sont distinguées par leur MAC.'],
          solution: `Une seule adresse, **192.168.0.10**, sur ${n} lignes : on les distingue par leur **MAC**.`,
        },
        {
          type: 'choix', q: `Une AW-UE20 (réglée sur « 20min ») est sous tension depuis **${t} min**. Easy IP Setup…`,
          choices: ['ne l\'affiche pas : il faut la redémarrer', ['l\'affiche, mais en gris', 'Passé la fenêtre, elle n\'est plus affichée du tout.'], ['l\'affiche normalement', `${t} min dépasse la fenêtre de 20 minutes.`]], answer: 0,
          aides: ['Que dit le réglage « Easy IP Setup accommodate period » ?', '20min : affichée et réglable pendant 20 minutes après la mise sous tension.'],
          solution: `${t} min > 20 min : elle **n'est plus affichée**. On coupe puis rend son PoE, et l'on cherche à nouveau.`,
        },
        {
          type: 'nombre', q: `La même caméra a été redémarrée il y a **${t2} min**. Combien de minutes vous reste-t-il pour la régler avec Easy IP Setup ?`, answer: 20 - t2, tol: 0, unite: 'min',
          aides: ['La fenêtre dure 20 minutes après la mise sous tension.', `Le calcul : 20 − ${t2}.`],
          solution: `20 − ${t2} = **${20 - t2} min**.`,
        },
        {
          type: 'texte', q: `Vous donnez aux caméras des adresses à la suite à partir de ${hote(base, premier)}. Quelle adresse pour la **${n}ᵉ** caméra ?`, accept: [hote(base, premier + n - 1)], forme: 'ip', placeholder: '192.168.10.13',
          aides: ['La première a l\'adresse de départ ; on ajoute 1 à chaque caméra.', `Départ + ${n} − 1.`],
          solution: `${hote(base, premier)} + ${n - 1} = **${hote(base, premier + n - 1)}**.`,
        },
      ];
    },
  },
  'ptz-poe': {
    titre: 'Le budget PoE d\'un switch',
    consigne: 'Vous vérifiez qu\'un switch PoE+ peut alimenter les tourelles et le pupitre d\'une régie.',
    gen(rnd) {
      const b = pick(rnd, [65, 90, 124, 185, 240, 370]), n = entre(rnd, 2, 12), k = pick(rnd, [1, 2, 3, 4]);
      const nMax = Math.floor(b / 30);
      return [
        {
          type: 'nombre', q: `Un switch de **${b} W** alloue par classe. Combien d'appareils de classe 4 alimente-t-il ?`, answer: nMax, tol: 0,
          aides: ['Classe 4 : 30 W réservés.', `${b} ÷ 30, arrondi vers le bas.`],
          solution: `${b} ÷ 30 → **${nMax}** appareils.`,
        },
        {
          type: 'nombre', q: `Combien de watts le switch réserve-t-il pour **${n}** appareils de classe ${k} ?`, answer: Math.round(n * CLASSES_POE[k] * 10) / 10, tol: 0.1, unite: 'W',
          aides: ['Classe 1 : 4 W ; 2 : 7 W ; 3 : 15,4 W ; 4 : 30 W.', `Le calcul : ${n} × ${fr(CLASSES_POE[k], 1)}.`],
          solution: `${n} × ${fr(CLASSES_POE[k], 1)} = **${fr(n * CLASSES_POE[k], 1)} W**.`,
        },
        {
          type: 'nombre', q: 'Combien de watts arrivent à l\'appareil, au bout de 100 m, sur un port PoE+ ?', answer: POE.at.pd, tol: 0.05, unite: 'W',
          pieges: [{ v: POE.at.pse, why: 'C\'est ce que fournit le port ; une partie se perd dans le câble.' }],
          aides: ['Le port en fournit 30 W.', 'IEEE 802.3at garantit un peu moins à l\'appareil.'],
          solution: `**25,5 W** (30 W au port).`,
        },
        {
          type: 'choix', q: 'Une AW-HE130 reste éteinte sur un port réglé en PoE (802.3af). Pourquoi ?',
          choices: ['Elle est en classe 4 : il lui faut du PoE+', ['Le câble est trop long', 'Le PoE simple ne lui suffirait pas même sur 1 m.'], ['Elle demande un bloc 12 V obligatoire', 'Elle démarre en PoE+, sans bloc.']], answer: 0,
          aides: ['Que fournit un port PoE simple ?', '15,4 W, quand la caméra annonce la classe 4.'],
          solution: 'Classe 4 : il faut un port **PoE+** (30 W).',
        },
      ];
    },
  },
  'ptz-web': {
    titre: 'La page web d\'une caméra',
    consigne: 'Vous réglez une caméra par sa page web : compte, adresse, port, marquage.',
    gen(rnd) {
      const base = pick(rnd, RESEAUX), a = hote(base, entre(rnd, 11, 60)), b = hote(base, entre(rnd, 61, 120)), port = pick(rnd, [8080, 81, 8000]);
      const ds = pick(rnd, [34, 46, 26, 18, 10]);
      return [
        {
          type: 'texte', q: `Vous passez la caméra de ${a} à **${b}**, port HTTP **${port}**, puis Set. Quelle URL pour la rouvrir ?`, accept: [`http://${b}:${port}`, `http://${b}:${port}/`, `${b}:${port}`], forme: 'ip', placeholder: 'http://192.168.10.11',
          pieges: [{ v: `http://${a}`, why: 'La caméra a quitté cette adresse.' }, { v: `http://${b}`, why: 'Sans le port, le navigateur frappe au port 80.' }],
          aides: ['La nouvelle adresse et le nouveau port.', 'http://adresse:port'],
          solution: `L'adresse et le port : **http://${b}:${port}**.`,
        },
        {
          type: 'nombre', q: `Diffserv est réglé à **${ds}**. Quelle valeur porte l'octet ToS des paquets vidéo ?`, answer: tosDe(ds), tol: 0,
          aides: ['Le DSCP occupe les 6 bits de poids fort.', `Le calcul : ${ds} × 4.`],
          solution: `${ds} × 4 = **${tosDe(ds)}**.`,
        },
        {
          type: 'choix', q: 'Premier accès à la page d\'une AW-UE20 : que faites-vous ?',
          choices: ['Je crée le compte administrateur', ['Je tape admin / 12345', 'C\'est le compte d\'usine de l\'AW-HE130.'], ['Je passe directement à Setup', 'La page demande d\'abord le compte.']], answer: 0,
          aides: ['L\'AW-UE20 n\'a pas de compte d\'usine.', 'Initial account registration.'],
          solution: 'Je **crée le compte administrateur** : sans lui, le pupitre ne la pilote pas.',
        },
        {
          type: 'choix', q: 'Où note-t-on le mot de passe administrateur de la caméra ?',
          choices: ['Dans le dossier technique du banc', ['Sur une étiquette de la caméra', 'Tout le monde pourrait le lire.'], ['Dans le nom de la caméra', 'Le nom s\'affiche partout.']], answer: 0,
          aides: ['Qui doit pouvoir le lire ?', 'Un document rangé et transmis.'],
          solution: 'Dans le **dossier technique** du banc.',
        },
      ];
    },
  },
  'ptz-pupitre': {
    titre: 'Le pupitre et la commande HTTP',
    consigne: 'Vous réglez le pupitre AW-RP150 et vous lisez les commandes qu\'il envoie aux caméras.',
    gen(rnd) {
      const base = pick(rnd, RESEAUX), ip = hote(base, entre(rnd, 11, 40)), port = pick(rnd, [80, 80, 8080]);
      const vp = entre(rnd, -49, 49) || 10, vt = pick(rnd, [0, 0, entre(rnd, -40, 40)]), vz = pick(rnd, [-30, -10, 15, 35]);
      const cmd = commande('pt', vp, vt);
      return [
        {
          type: 'texte', q: `Quelle commande (sans « # ») fait tourner la caméra vers la ${vp > 0 ? 'droite' : 'gauche'} à la vitesse ${Math.abs(vp)} sur 49${vt ? `, tilt vers le ${vt > 0 ? 'haut' : 'bas'} à ${Math.abs(vt)}` : ', tilt à l\'arrêt'} ?`, accept: [cmd, '#' + cmd], forme: 'ip', placeholder: 'PTS5050',
          aides: ['PTS, puis deux chiffres pour le pan, deux pour le tilt ; 50 = arrêt.', `Pan : 50 ${vp > 0 ? '+' : '−'} ${Math.abs(vp)} ; tilt : 50 ${vt >= 0 ? '+' : '−'} ${Math.abs(vt)}.`],
          solution: `**${cmd}** : pan ${codeVitesse(vp)}, tilt ${codeVitesse(vt)}.`,
        },
        {
          type: 'texte', q: `Le zoom va vers le ${vz > 0 ? 'serré' : 'large'} à la vitesse ${Math.abs(vz)}. Quelle commande (sans « # ») ?`, accept: [commande('zoom', vz), '#' + commande('zoom', vz)], forme: 'ip', placeholder: 'Z50',
          aides: ['Z, puis deux chiffres ; 50 = arrêt.', `Le calcul : 50 ${vz > 0 ? '+' : '−'} ${Math.abs(vz)}.`],
          solution: `La commande : **${commande('zoom', vz)}**.`,
        },
        {
          type: 'texte', q: `Écrivez l'URL complète qui envoie **#PTS5050** à la caméra ${ip}${port !== 80 ? ` (port ${port})` : ''}.`, accept: [urlCommande(ip, port, 'PTS5050')], forme: 'ip', placeholder: 'http://…/cgi-bin/aw_ptz?cmd=%23PTS5050&res=1',
          aides: ['/cgi-bin/aw_ptz?cmd=…&res=1 ; le « # » s\'écrit %23.', port !== 80 ? `Le port ${port} après l'adresse.` : 'Le port 80 se sous-entend.'],
          solution: `**${urlCommande(ip, port, 'PTS5050')}**.`,
        },
        {
          type: 'choix', q: 'La touche d\'une caméra reste éteinte au pupitre ; la caméra répond au PC. Que vérifiez-vous dans MANUAL IP SET ?',
          choices: ['Son adresse et son port HTTP', ['Son adresse MAC', 'Le pupitre appelle par IP et port, pas par MAC.'], ['Son budget PoE', 'Elle répond au PC : elle est alimentée.']], answer: 0,
          aides: ['Que contient une ligne de MANUAL IP SET ?', 'L\'adresse et le port de chaque caméra.'],
          solution: 'L\'**adresse** et le **port** de la caméra (puis son compte administrateur).',
        },
      ];
    },
  },
  'ptz-flux': {
    titre: 'Les flux IP des caméras',
    consigne: 'Les caméras envoient aussi leur image sur le réseau : vous vérifiez la charge des liens et la place à prévoir.',
    gen(rnd) {
      const n = entre(rnd, 2, 8), d = pick(rnd, [4, 6, 8, 10, 15, 20, 25]), L = pick(rnd, [100, 1000]), autre = L === 100 ? entre(rnd, 0, 4) * 10 : entre(rnd, 0, 6) * 100, t = pick(rnd, [30, 45, 60, 90, 120]);
      const c = chargeLien(n, d, autre, L) * 100;
      return [
        {
          type: 'nombre', q: `${n} caméras à **${d} Mb/s** et ${autre} Mb/s d'autre trafic sur un lien de **${L >= 1000 ? '1 Gb/s' : '100 Mb/s'}**. Quelle charge ?`, answer: Math.round(c * 10) / 10, tol: 0.5, unite: '%',
          aides: ['Charge = débit offert ÷ débit du lien.', `(${n} × ${d} + ${autre}) ÷ ${L}.`],
          solution: `${n * d + autre} Mb/s sur ${L} : **${fr(c, 1)} %**.`,
        },
        {
          type: 'nombre', q: `Combien de flux de ${d} Mb/s tiennent sous **80 %** d'un lien de ${L >= 1000 ? '1 Gb/s' : '100 Mb/s'} ?`, answer: fluxMax(d, L), tol: 0,
          aides: ['80 % du lien, divisé par le débit d\'un flux.', `${L} × 0,8 ÷ ${d}, arrondi vers le bas.`],
          solution: `${fr(L * 0.8, 0)} ÷ ${d} → **${fluxMax(d, L)}** flux.`,
        },
        {
          type: 'nombre', q: `Quel volume pour **${t} min** enregistrées à ${d} Mb/s ?`, answer: Math.round(volumeGo(d, t) * 100) / 100, tol: 0.1, unite: 'Go',
          aides: ['Mb/s × secondes ÷ 8 = Mo.', `${d} × ${t} × 60 ÷ 8 ÷ 1000.`],
          solution: `${d} × ${t * 60} ÷ 8 = ${fr(d * t * 60 / 8, 0)} Mo ≈ **${fr(volumeGo(d, t), 2)} Go**.`,
        },
        {
          type: 'choix', q: 'Quel protocole pour envoyer l\'image d\'une tourelle à travers Internet, en récupérant les pertes ?',
          choices: ['SRT', ['RTSP', 'Fait pour un réseau local.'], ['NDI|HX', 'Fait pour un réseau local de production.']], answer: 0,
          aides: ['Lequel renvoie les paquets perdus ?', 'Secure Reliable Transport.'],
          solution: '**SRT** (Secure Reliable Transport).',
        },
      ];
    },
  },
  'ptz-qos': {
    titre: 'Faire passer la vidéo d\'abord',
    consigne: 'Un lien du banc est engorgé : vous réglez le marquage DSCP et le switch pour protéger la vidéo.',
    gen(rnd) {
      const x = entre(rnd, 1, 4), y = entre(rnd, 1, 3), ds = pick(rnd, [34, 46, 26, 0, 18]);
      const n = entre(rnd, 2, 4), d = pick(rnd, [10, 20]), T = entre(rnd, 5, 9) * 10;
      return [
        {
          type: 'nombre', q: `Quelle valeur DSCP pour la classe **AF${x}${y}** ?`, answer: dscpAF(x, y), tol: 0,
          aides: ['AFxy = 8x + 2y.', `Le calcul : 8 × ${x} + 2 × ${y}.`],
          solution: `8 × ${x} + 2 × ${y} = **${dscpAF(x, y)}**.`,
        },
        {
          type: 'nombre', q: `Un paquet marqué DSCP **${ds}** : que vaut son octet ToS ?`, answer: tosDe(ds), tol: 0,
          aides: ['DSCP × 4.', `Le calcul : ${ds} × 4.`],
          solution: `${ds} × 4 = **${tosDe(ds)}**.`,
        },
        {
          type: 'nombre', q: `${n} caméras à ${d} Mb/s et **${T} Mb/s** de copie sur un lien de 100 Mb/s, QoS bien réglée. Combien de Mb/s reste-t-il à la copie ?`, answer: Math.max(0, 100 - n * d), tol: 0.5, unite: 'Mb/s',
          aides: ['La vidéo passe d\'abord.', `Le calcul : 100 − ${n} × ${d}.`],
          solution: `La vidéo prend ${n * d} Mb/s ; la copie a **${Math.max(0, 100 - n * d)} Mb/s** au lieu de ${T}.`,
        },
        {
          type: 'choix', q: 'Les caméras marquent en 34, le switch fait confiance au DSCP, mais n\'a qu\'une file. La vidéo…',
          choices: ['perd toujours des paquets quand le lien déborde', ['passe entière', 'Une seule file : tout attend ensemble.'], ['passe, mais plus lentement', 'Le débit n\'est pas en cause : c\'est l\'ordre de service.']], answer: 0,
          aides: ['Que faut-il en plus du marquage et de la confiance ?', 'Une file prioritaire, servie d\'abord.'],
          solution: 'Elle **perd toujours des paquets** : sans file prioritaire, la marque ne sert à rien.',
        },
      ];
    },
  },
  'ptz-recette': {
    titre: 'Diagnostiquer une caméra muette',
    consigne: 'À la recette, une caméra ne répond pas au pupitre : vous remontez couche par couche.',
    gen(rnd) {
      const CAS = [
        ['Le voyant de lien du port est allumé, la caméra éteinte.', 'Le PoE du port (PoE+, budget)', [['L\'adresse IP', 'Éteinte, elle n\'a pas d\'adresse en service.'], ['Le compte administrateur', 'Il vient bien après.']]],
        ['La caméra est allumée mais absente d\'Easy IP Setup ; elle a été allumée il y a 5 minutes.', 'Le VLAN de son port', [['Son masque', 'La recherche ne dépend pas du masque.'], ['Son port HTTP', 'La recherche ne passe pas par le serveur web.']]],
        ['Easy IP Setup la trouve, la page web reste en « délai dépassé ».', 'Son adresse et son masque', [['Son PoE', 'Elle répond : elle est alimentée.'], ['Son VLAN', 'Elle est trouvée : elle est dans le bon VLAN.']]],
        ['La page web s\'ouvre, la touche du pupitre reste éteinte.', 'Le port dans MANUAL IP SET et le compte', [['Le câble réseau', 'Le PC la joint : le câble est bon.'], ['Le VLAN', 'Le PC la joint : elle est dans le bon VLAN.']]],
        ['Deux caméras répondent tantôt l\'une, tantôt l\'autre à la même adresse.', 'Un doublon d\'adresse', [['Un câble défectueux', 'Un câble ne fait pas répondre une autre caméra.'], ['Le budget PoE', 'Elles sont allumées toutes les deux.']]],
      ];
      const [s, bon, faux] = pick(rnd, CAS);
      const k = entre(rnd, 1, 4);
      const couches = ['le lien et le courant', 'le segment (VLAN)', 'l\'adresse (IP, masque)', 'le service (port, compte, pupitre)'];
      return [
        {
          type: 'choix', q: `${s} Que vérifiez-vous ?`, choices: [bon, ...faux], answer: 0,
          aides: ['Ce qui marche déjà élimine des couches.', 'Du câble vers l\'application.'],
          solution: `On vérifie d'abord : **${bon}**.`,
        },
        {
          type: 'ordre', q: 'Remettez dans l\'ordre le diagnostic couche par couche.', items: ['Le lien et le courant', 'Le segment (VLAN)', 'L\'adresse (IP, masque, doublon)', 'Le service (port, compte, pupitre)'],
          aides: ['Du plus physique au plus logiciel.', 'Chaque couche suppose la précédente.'],
          solution: 'Lien et courant, segment, adresse, service.',
        },
        {
          type: 'choix', q: `La couche « ${couches[k - 1]} » est la première qui ne passe pas. Que savez-vous des couches précédentes ?`,
          choices: [k === 1 ? 'Rien : c\'est la première couche' : 'Elles marchent : inutile d\'y revenir', [k === 1 ? 'Qu\'elles marchent' : 'Qu\'elles sont toutes à refaire', k === 1 ? 'Il n\'y a pas de couche avant le lien.' : 'Ce sont les couches suivantes qui restent à vérifier.'], ['Que la caméra est hors service', 'Une couche qui bloque se répare ; la caméra n\'est pas forcément en panne.']], answer: 0,
          aides: ['On remonte dans l\'ordre.', 'Une couche ne se teste que si les précédentes marchent.'],
          solution: k === 1 ? 'Le lien et le courant sont la **première** couche.' : `Les couches avant « ${couches[k - 1]} » **marchent**.`,
        },
      ];
    },
  },
});
