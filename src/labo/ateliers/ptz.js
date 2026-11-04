// @ts-check
import { el } from '../../util.js';
import { afficheur, fr } from '../kit.js';
import { MODELES, POE, SWITCH, FENETRE_EASYIP, COMPTE_USINE, cameras, appareil, enMarche, depuis, adresse, reglerEasyIp, ouvrirUrl, verifierCompte, joint, camDuNumero, ipOk, prefixe, adresseHote, dansReseau, tosDe } from '../calc/ptz.js';

// ----------------------------------------------------------------------------------
// L'atelier « Caméras PTZ » (v19.30) : le banc de mise en service du BTS, en quatre vues.
//   - Le banc : le switch PoE+ à 8 ports (PoE, VLAN de chaque port, budget), les appareils et leur câble,
//     la qualité de service du switch (confiance DSCP, files, lien du PC, transfert de fichiers) ;
//   - Le PC technique : la carte réseau (IPv4), Easy IP Setup (Search, Network Settings, Access Camera) et
//     le navigateur, avec la page web de la caméra (compte administrateur, Setup → Network et Advanced) ;
//   - Le pupitre AW-RP150 : son écran tactile (CAMERA, CONNECT SETTING : RP IP SET, MANUAL IP SET), ses
//     touches de caméra et son joystick, qui envoient les vraies commandes HTTP de la caméra ;
//   - La fiche : le plan d'adressage à appliquer et la recette (qui joint qui).
// Les écrans suivent la disposition et les libellés des écrans Panasonic, dans le style du simulateur.
// Tout se calcule dans labo/calc/ptz.js ; ce qui se tape dans un formulaire reste ici (U) jusqu'à
// « Save », « Set » ou « OK ».
// ----------------------------------------------------------------------------------
const VUES = [['banc', 'Le banc'], ['pc', 'Le PC technique'], ['pupitre', 'Le pupitre AW-RP150'], ['fiche', 'La fiche du banc']];
const APPS = [['reseau', 'Connexion réseau (IPv4)'], ['easyip', 'Easy IP Setup'], ['web', 'Navigateur']];

/** la mise en service pas à pas : comment faire chaque étape dans l'atelier (l'état dit si elle est faite) */
export const COMMENT = {
  cabler: 'Dans « Le banc », choisissez pour chaque appareil un port du switch (une prise RJ45 par appareil). Le PC est sur le secteur ; les caméras et le pupitre prennent leur courant par le câble.',
  alimenter: 'Les AW-HE130, AW-UE20 et le pupitre AW-RP150 demandent du PoE+ (IEEE 802.3at, classe 4 : 30 W réservés par port). Un port en PoE simple (15,4 W) ne les démarre pas. Surveillez le budget du switch.',
  pc: 'Dans « Le PC technique », application Connexion réseau : « Utiliser l\'adresse IP suivante », l\'adresse et le masque de la fiche, puis OK. Le PC doit être dans le sous-réseau des caméras pour ouvrir leur page web.',
  chercher: 'Ouvrez Easy IP Setup et cliquez sur « Search ». La recherche part en diffusion : elle trouve les caméras du même segment même si leur adresse n\'est pas dans le sous-réseau du PC, et les distingue par leur adresse MAC (relevez-la sur l\'étiquette de la caméra, dans « Le banc »).',
  adresser: 'Sélectionnez une caméra dans la liste, « Network Settings », tapez l\'adresse, le masque et la passerelle de la fiche, puis « Save ». Les trois caméras sortent du carton en 192.168.0.10 : on les distingue par leur MAC, et on les règle une par une. Une caméra réglée sur « 20min » disparaît de la liste passé 20 minutes sous tension : on la redémarre.',
  compte: 'Dans Easy IP Setup, « Access Camera » ouvre la page de la caméra dans le navigateur (ou tapez http://adresse). L\'AW-UE20 demande de créer le compte administrateur au premier accès ; l\'AW-HE130 a un compte d\'usine (admin, 12345) à changer dans Setup → User mng.',
  pupitre: 'Dans « Le pupitre », CONNECT SETTING → RP IP SET : l\'adresse, le masque et la passerelle de la fiche, puis SET.',
  enregistrer: 'Toujours dans CONNECT SETTING, MANUAL IP SET : pour les caméras 1, 2 et 3, l\'adresse IP et le port HTTP (80) de CAM 1, 2 et 3, puis SET. La touche de chaque caméra s\'allume quand la liaison tient.',
  qos: 'Dans la page web de chaque caméra, Setup → Network → Advanced : Diffserv à 34 (AF41). Puis dans « Le banc », la qualité de service du switch : confiance DSCP et file prioritaire. Essayez avec un transfert de fichiers vers le PC et les flux des caméras allumés.',
  recette: 'Au pupitre, appuyez sur la touche de chaque caméra et bougez-la au joystick : la caméra répond si la liaison tient. Notez dans la fiche qui joint qui.',
};

export function creer(/** @type {import('../kit.js').Ctx} */ ctx) {
  const st = () => ctx.st;
  // ce qui se tape dans les formulaires, jusqu'à la validation
  const U = {
    ipv4: /** @type {null | { auto: boolean, ip: string, masque: string, passerelle: string }} */ (null), ipv4Msg: '',
    sel: '', dlg: /** @type {null | { id: string, dhcp: boolean, ip: string, masque: string, passerelle: string, http: string }} */ (null), eipMsg: '', eipOk: false,
    url: '', page: /** @type {null | ReturnType<typeof ouvrirUrl> & { url: string }} */ (null), menu: 'live', onglet: 'network', logins: /** @type {Set<string>} */ (new Set()),
    form: /** @type {Record<string, any>} */ ({}), webMsg: '', webOk: false, login: { user: '', mdp: '' },
    rpMenu: 'camera', rpIp: /** @type {null | { ip: string, masque: string, passerelle: string }} */ (null), rpCams: /** @type {Record<string, { ip: string, port: string }>} */ ({}), rpMsg: '', rpCmd: '', pos: /** @type {Record<string, { pan: number, tilt: number, zoom: number }>} */ ({}),
  };
  const lock = (k) => ctx.verrous.has(k) || [...ctx.verrous].some((v) => k.startsWith(v + '.'));
  const champ = (label, val, set, o = {}) => {
    const inp = /** @type {HTMLInputElement} */ (el('input', { type: o.type || 'text', value: val, 'aria-label': o.aria || label, spellcheck: 'false', autocomplete: 'off', inputmode: o.num ? 'numeric' : null, disabled: o.disabled ? true : null, 'data-k': o.k || null, class: o.cls || null }));
    inp.addEventListener('input', () => set(inp.value));
    if (o.enter) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); o.enter(); } });
    return el('label', { class: 'pz-field' }, el('span', {}, label), inp);
  };
  const bouton = (t, f, o = {}) => el('button', { type: 'button', class: 'btn small' + (o.primary ? ' primary' : '') + (o.cls ? ' ' + o.cls : ''), 'data-k': o.k || null, 'aria-label': o.aria || null, disabled: o.disabled ? true : null, 'aria-pressed': o.pressed == null ? null : String(o.pressed), onclick: f }, t);
  const msg = (t, ok) => (t ? el('p', { class: 'pz-msg ' + (ok ? 'ok' : 'bad'), role: 'status' }, t) : null);
  /** redessine en gardant le focus sur la commande qui l'avait (les gestes locaux ne passent pas par ctx.changer) */
  const local = () => {
    const a = /** @type {HTMLElement | null} */ (document.activeElement);
    const k = a && root.contains(a) ? (a.dataset.k ? `[data-k="${a.dataset.k}"]` : a.getAttribute('aria-label') ? `[aria-label="${a.getAttribute('aria-label')}"]` : '') : '';
    rendre();
    if (k) { const b = /** @type {HTMLElement | null} */ (root.querySelector(k)); if (b) b.focus({ preventScroll: true }); }
  };

  // ======================================================================
  // le banc : le switch, les appareils, la qualité de service
  // ======================================================================
  const vBanc = el('div', { class: 'lb-vue' });
  function dessinerBanc(m) {
    const S = st().switch, A = m.alim;
    const occupant = (n) => st().appareils.find((a) => a.port === n);
    const ports = S.ports.map((p) => {
      const a = occupant(p.n), r = a ? A.par[a.id] : null;
      const etat = !a ? 'vide' : r.alimente ? 'on' : r.lien ? 'lien' : 'vide';
      return el('div', { class: 'pz-port', 'data-etat': etat },
        el('div', { class: 'pz-rj' }, el('i', { class: 'pz-led-l', title: r && r.lien ? 'Lien' : 'Pas de lien' }), el('i', { class: 'pz-led-p', title: r && r.reserve ? 'PoE fourni' : 'Pas de PoE fourni' }), el('b', {}, String(p.n))),
        el('small', { class: 'pz-occ' }, a ? a.nom : 'libre'),
        el('label', { class: 'pz-mini' }, el('span', {}, 'PoE'), el('select', { 'aria-label': `PoE du port ${p.n}`, 'data-k': `switch.ports.${p.n}.poe`, disabled: lock('switch') ? true : null, onchange: (e) => ctx.changer({ ['switch.ports']: S.ports.map((x) => (x.n === p.n ? { ...x, poe: e.target.value } : x)) }) },
          ...Object.entries(POE).map(([k, P]) => el('option', { value: k, selected: k === p.poe ? true : null }, P.court)))),
        el('label', { class: 'pz-mini' }, el('span', {}, 'VLAN'), el('input', { type: 'number', min: 1, max: 4094, value: p.vlan, 'aria-label': `VLAN du port ${p.n}`, 'data-k': `switch.ports.${p.n}.vlan`, disabled: lock('switch') ? true : null, onchange: (e) => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 4094) ctx.changer({ ['switch.ports']: S.ports.map((x) => (x.n === p.n ? { ...x, vlan: v } : x)) }); } })));
    });
    const budget = afficheur('Budget PoE du switch');
    budget.set(`${fr(A.reserve, A.reserve % 1 ? 1 : 0)} W réservés`, `sur ${fr(A.budget, 0)} W ; consommation ≈ ${fr(A.conso, 0)} W (ordre de grandeur)`, A.depasse ? 'bad' : A.reserve > A.budget * 0.85 ? 'warn' : 'ok');
    const horloge = afficheur('Le banc est sous tension depuis');
    horloge.set(`${st().minutes} min`, 'chaque appareil compte depuis sa propre mise sous tension');
    const cartes = st().appareils.map((a) => {
      const M = MODELES[a.modele], r = A.par[a.id], t = depuis(st(), a.id);
      const etat = !r.alimente ? (r.lien ? 'Éteint' : 'Débranché') : M.type === 'pc' ? (r.lien ? 'Allumé (secteur)' : 'Allumé, débranché du réseau') : !r.lien ? 'Allumé (bloc 12 V), débranché du réseau' : `En marche depuis ${t} min${a.secteur ? ' (bloc 12 V)' : ''}`;
      return el('article', { class: 'pz-app', 'data-etat': r.alimente && r.lien ? 'on' : r.lien ? 'lien' : 'off' },
        el('header', {}, el('b', {}, a.nom), el('span', { class: 'pz-mod' }, M.nom)),
        el('p', { class: 'pz-mac' }, 'MAC ', el('code', {}, a.mac)),
        el('label', { class: 'pz-mini' }, el('span', {}, 'Câble vers'), el('select', { 'aria-label': `Port du switch de ${a.nom}`, 'data-k': `appareils.${a.id}.port`, disabled: lock('appareils') || lock(`appareils.${a.id}`) ? true : null, onchange: (e) => ctx.changer({ [`appareils.${a.id}.port`]: Number(e.target.value) }) },
          el('option', { value: '0', selected: !a.port ? true : null }, 'débranché'), ...S.ports.map((p) => el('option', { value: String(p.n), selected: a.port === p.n ? true : null }, `port ${p.n}`)))),
        el('p', { class: 'pz-etat' }, etat, r.pb && r.lien ? el('small', {}, ' · ' + r.pb) : null),
        M.poe ? el('label', { class: 'pz-check' }, el('input', { type: 'checkbox', checked: a.secteur ? true : null, 'data-k': `appareils.${a.id}.secteur`, 'aria-label': `Bloc secteur 12 V de ${a.nom}`, disabled: lock('appareils') || lock(`appareils.${a.id}`) || lock(`appareils.${a.id}.secteur`) ? true : null, onchange: (e) => ctx.changer({ [`appareils.${a.id}.secteur`]: e.target.checked }) }), ' Bloc secteur 12 V branché') : null,
        M.poe ? el('p', { class: 'pz-note' }, `${POE[M.poe].court}, classe ${M.classe} · ≈ ${fr(M.conso, 0)} W en PoE+ (${fr(M.dc, 1)} W sur son bloc 12 V)`) : el('p', { class: 'pz-note' }, 'sur le secteur'));
    });
    // la qualité de service du switch, sur le port du PC
    const Q = m.qos;
    const qosBox = el('fieldset', { class: 'lb-group pz-qos' }, el('legend', {}, 'Le switch : qualité de service vers le PC'),
      el('div', { class: 'pz-row' },
        seg('Confiance', 'switch.qos.confiance', [['aucune', 'Aucune'], ['dscp', 'DSCP']]),
        seg('Files du port', 'switch.qos.files', [['fifo', 'Une seule file'], ['prio', 'File prioritaire']]),
        seg('Lien du PC', 'switch.lien', [[100, '100 Mb/s'], [1000, '1 Gb/s']])),
      el('label', { class: 'pz-field' }, el('span', {}, `Transfert de fichiers vers le PC : ${st().transfert} Mb/s`),
        el('input', { type: 'range', min: 0, max: 1000, step: 10, value: st().transfert, 'aria-label': 'Transfert de fichiers vers le PC', 'data-k': 'transfert', disabled: lock('transfert') ? true : null, oninput: (e) => ctx.changer({ transfert: Number(e.target.value) }) })),
      el('div', { class: 'lb-reads' },
        lecture('Flux vidéo vers le PC', Q.flux.length ? `${Q.flux.length} caméra${Q.flux.length > 1 ? 's' : ''}` : 'aucun', Q.flux.length ? `${fr(Q.offert.media + (Q.offert.fichiers - Number(st().transfert || 0)), 0)} Mb/s de vidéo ; allumez un flux dans la page web (Advanced)` : 'allumez le flux H.264 dans la page web de la caméra', ''),
        lecture('Charge du lien', `${fr(Q.charge * 100, 0)} %`, `${fr(Q.F.total, 0)} Mb/s offerts sur ${st().switch.lien}`, Q.charge > 1 ? 'bad' : Q.charge > 0.8 ? 'warn' : 'ok'),
        lecture('Pertes sur la vidéo', Q.flux.length ? `${fr(Q.pertesVideo, 1)} %` : '—', Q.flux.length ? Object.entries(Q.parCam).map(([id, x]) => `${appareil(st(), id).nom} : ${x.classe === 'media' ? 'file médias' : 'au mieux'}`).join(' · ') : '', !Q.flux.length ? '' : Q.ok ? 'ok' : 'bad')));
    const temps = el('div', { class: 'pz-row' }, horloge.box,
      bouton('+ 5 min', () => ctx.changer({ minutes: st().minutes + 5 }), { k: 'minutes:+5', disabled: lock('minutes') }),
      bouton('+ 20 min', () => ctx.changer({ minutes: st().minutes + 20 }), { k: 'minutes:+20', disabled: lock('minutes') }));
    vBanc.replaceChildren(
      el('section', { class: 'pz-switch', 'aria-label': `Switch PoE+ à ${SWITCH.ports} ports` }, el('h4', { class: 'lb-sub' }, `Switch PoE+ administrable, ${SWITCH.ports} ports`), el('div', { class: 'pz-ports' }, ...ports)),
      el('div', { class: 'lb-reads' }, budget.box), temps,
      el('h4', { class: 'lb-sub' }, 'Les appareils du banc'), el('div', { class: 'pz-apps' }, ...cartes), qosBox);
  }
  /** des touches à bascule liées à l'état */
  function seg(label, k, opts) {
    const v = k.split('.').reduce((o, p) => o[p], st());
    return el('div', { class: 'lb-ctl' }, el('span', { class: 'lb-lab' }, label), el('div', { class: 'seg lb-seg', role: 'group', 'aria-label': label },
      ...opts.map(([o, t]) => el('button', { type: 'button', 'data-k': k + ':' + o, 'aria-pressed': String(o === v), disabled: lock(k) && o !== v ? true : null, onclick: () => ctx.changer({ [k]: o }) }, t))));
  }
  function lecture(t, v, n, e) { const a = afficheur(t); a.set(v, n, e); return a.box; }

  // ======================================================================
  // le PC technique : la carte réseau, Easy IP Setup, le navigateur
  // ======================================================================
  const vPc = el('div', { class: 'lb-vue' });
  function dessinerPc(m) {
    const app = st().pcApp;
    const barre = el('nav', { class: 'pz-taskbar', role: 'tablist', 'aria-label': 'Les applications du PC' },
      ...APPS.map(([id, t]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(id === app), 'data-k': 'pcApp:' + id, disabled: lock('pcApp') && id !== app ? true : null, onclick: () => ctx.changer({ pcApp: id }) }, t)));
    const fen = app === 'reseau' ? fenReseau() : app === 'easyip' ? fenEasyIp(m) : fenWeb(m);
    vPc.replaceChildren(el('div', { class: 'pz-bureau' }, fen, barre));
  }
  function fenetre(titre, ...corps) { return el('section', { class: 'pz-win', 'aria-label': titre }, el('header', { class: 'pz-wtitle' }, titre), el('div', { class: 'pz-wbody' }, ...corps)); }
  function fenReseau() {
    const pc = appareil(st(), 'pc');
    if (!U.ipv4) U.ipv4 = { auto: !!pc.dhcp, ip: pc.ip, masque: pc.masque, passerelle: pc.passerelle };
    const F = U.ipv4, dis = lock('appareils.pc') || lock('appareils');
    const ok = () => {
      if (!F.auto) {
        if (!ipOk(F.ip)) { U.ipv4Msg = `« ${F.ip} » n'est pas une adresse IPv4 valide.`; local(); return; }
        if (prefixe(F.masque) == null) { U.ipv4Msg = `« ${F.masque} » n'est pas un masque de sous-réseau valide.`; local(); return; }
        if (!adresseHote(F.ip, F.masque)) { U.ipv4Msg = 'Cette adresse est celle du réseau ou de diffusion : elle ne peut pas être celle d\'un poste.'; local(); return; }
        if (F.passerelle && (!ipOk(F.passerelle) || !dansReseau(F.ip, F.masque, F.passerelle))) { U.ipv4Msg = 'La passerelle doit être une adresse du même sous-réseau que le poste.'; local(); return; }
      }
      U.ipv4Msg = F.auto ? 'Le PC demande une adresse en DHCP : il n\'y a pas de serveur DHCP sur le banc.' : 'Paramètres enregistrés.';
      ctx.changer({ 'appareils.pc.dhcp': F.auto, 'appareils.pc.ip': F.ip.trim(), 'appareils.pc.masque': F.masque.trim(), 'appareils.pc.passerelle': F.passerelle.trim() });
    };
    return fenetre('Propriétés de : Protocole Internet version 4 (TCP/IPv4)',
      el('fieldset', { class: 'pz-radios' }, el('legend', { class: 'sr' }, 'Adresse du PC'),
        el('label', {}, el('input', { type: 'radio', name: 'pz-ipv4', checked: F.auto ? true : null, disabled: dis ? true : null, onchange: () => { F.auto = true; local(); } }), ' Obtenir une adresse IP automatiquement'),
        el('label', {}, el('input', { type: 'radio', name: 'pz-ipv4', checked: !F.auto ? true : null, disabled: dis ? true : null, onchange: () => { F.auto = false; local(); } }), ' Utiliser l\'adresse IP suivante :')),
      el('div', { class: 'pz-form' },
        champ('Adresse IP :', F.ip, (v) => { F.ip = v; }, { disabled: F.auto || dis, k: 'pc:ip', enter: ok }),
        champ('Masque de sous-réseau :', F.masque, (v) => { F.masque = v; }, { disabled: F.auto || dis, k: 'pc:masque', enter: ok }),
        champ('Passerelle par défaut :', F.passerelle, (v) => { F.passerelle = v; }, { disabled: F.auto || dis, k: 'pc:passerelle', enter: ok })),
      el('div', { class: 'pz-acts' }, bouton('OK', ok, { primary: true, k: 'pc:ok', disabled: dis })),
      msg(U.ipv4Msg, !/pas|doit|ne peut/.test(U.ipv4Msg)),
      el('p', { class: 'pz-note' }, `Adresse en service : ${pc.dhcp ? 'aucune (DHCP sans serveur)' : `${pc.ip} / ${pc.masque}`}.`));
  }
  function fenEasyIp(m) {
    const E = m.easyip, L = st().easyip.cherche ? E.liste : [];
    if (U.sel && !L.some((x) => x.id === U.sel)) U.sel = '';
    const chercher = () => { U.eipMsg = ''; U.dlg = null; ctx.changer({ 'easyip.cherche': true }); if (!E.ok) { U.eipMsg = E.pb; local(); } };
    const regler = () => {
      const c = L.find((x) => x.id === U.sel); if (!c) { U.eipMsg = 'Sélectionnez d\'abord une caméra dans la liste.'; U.eipOk = false; local(); return; }
      U.dlg = { id: c.id, dhcp: c.dhcp, ip: c.ip === '0.0.0.0' ? '' : c.ip, masque: c.masque, passerelle: c.passerelle, http: String(c.http) }; U.eipMsg = ''; local();
    };
    const acceder = () => {
      const c = L.find((x) => x.id === U.sel); if (!c) { U.eipMsg = 'Sélectionnez d\'abord une caméra dans la liste.'; U.eipOk = false; local(); return; }
      U.url = `http://${c.ip}${c.http !== 80 ? ':' + c.http : ''}/`; ouvrir(); ctx.changer({ pcApp: 'web' });
    };
    const lignes = L.map((c) => el('tr', { class: c.id === U.sel ? 'sel' : '', 'aria-selected': String(c.id === U.sel), tabindex: '0', 'data-k': 'eip:' + c.id, onclick: () => { U.sel = c.id; local(); }, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); U.sel = c.id; local(); } } },
      el('td', {}, c.mac), el('td', {}, c.ip), el('td', {}, String(c.http)), el('td', {}, c.nom), el('td', {}, c.modele)));
    const D = U.dlg;
    const save = () => {
      const r = reglerEasyIp(st(), D.id, { ip: D.ip.trim(), masque: D.masque.trim(), passerelle: D.passerelle.trim(), http: Number(D.http), dhcp: D.dhcp });
      U.eipOk = r.ok; U.eipMsg = r.ok ? `Réglages envoyés à ${appareil(st(), D.id).nom} : elle redémarre son réseau avec ${D.dhcp ? 'le DHCP' : D.ip}.` : r.pb;
      if (r.ok) { U.dlg = null; ctx.changer(r.patch); } else local();
    };
    const dialogue = D ? el('div', { class: 'pz-dlg', role: 'dialog', 'aria-label': 'Network Settings' },
      el('h5', {}, `Network Settings · ${appareil(st(), D.id).mac}`),
      el('fieldset', { class: 'pz-radios' }, el('legend', {}, 'DHCP'),
        el('label', {}, el('input', { type: 'radio', name: 'pz-dhcp', checked: !D.dhcp ? true : null, onchange: () => { D.dhcp = false; local(); } }), ' Off'),
        el('label', {}, el('input', { type: 'radio', name: 'pz-dhcp', checked: D.dhcp ? true : null, onchange: () => { D.dhcp = true; local(); } }), ' On')),
      el('div', { class: 'pz-form' },
        champ('IP address', D.ip, (v) => { D.ip = v; }, { disabled: D.dhcp, k: 'eip:ip', enter: save }),
        champ('Subnet mask', D.masque, (v) => { D.masque = v; }, { disabled: D.dhcp, k: 'eip:masque', enter: save }),
        champ('Default gateway', D.passerelle, (v) => { D.passerelle = v; }, { disabled: D.dhcp, k: 'eip:passerelle', enter: save }),
        champ('Port No.', D.http, (v) => { D.http = v; }, { num: true, k: 'eip:port', enter: save })),
      el('div', { class: 'pz-acts' }, bouton('Save', save, { primary: true, k: 'eip:save' }), bouton('Cancel', () => { U.dlg = null; U.eipMsg = ''; local(); }, { k: 'eip:cancel' }))) : null;
    return fenetre('Easy IP Setup Software',
      el('div', { class: 'pz-acts pz-tool' }, bouton('Search', chercher, { primary: true, k: 'eip:search' }), bouton('Network Settings', regler, { k: 'eip:network' }), bouton('Access Camera', acceder, { k: 'eip:access' })),
      el('div', { class: 'pz-tablewrap' }, el('table', { class: 'pz-table', 'aria-label': 'Les caméras trouvées' },
        el('thead', {}, el('tr', {}, ...['MAC Address', 'IPv4 Address', 'Port No.', 'Camera Name', 'Model'].map((t) => el('th', {}, t)))),
        el('tbody', {}, ...(lignes.length ? lignes : [el('tr', {}, el('td', { colspan: '5', class: 'pz-vide' }, st().easyip.cherche ? 'Aucune caméra trouvée.' : 'Cliquez sur « Search ».'))])))),
      dialogue, msg(U.eipMsg, U.eipOk),
      el('p', { class: 'pz-note' }, `Une caméra réglée sur « 20min » n'est plus affichée passé ${FENETRE_EASYIP} minutes sous tension. La recherche ne traverse pas de routeur.`));
  }
  // ---------------- le navigateur et la page web de la caméra ----------------
  function ouvrir() { const r = ouvrirUrl(st(), U.url); U.page = { ...r, url: U.url }; U.menu = 'live'; U.webMsg = ''; U.form = {}; }
  function fenWeb(m) {
    // une page ouverte se recalcule (la caméra a pu changer d'adresse, de compte, s'éteindre)
    if (U.page) { const r = ouvrirUrl(st(), U.page.url); if (r.code !== U.page.code || r.cam !== U.page.cam) { U.page = { ...r, url: U.page.url }; } }
    const go = () => { ouvrir(); local(); };
    const barre = el('div', { class: 'pz-url' }, champ('Adresse', U.url, (v) => { U.url = v; }, { aria: 'Adresse de la page', k: 'web:url', enter: go, cls: 'pz-urlin' }), bouton('Aller', go, { primary: true, k: 'web:go' }));
    const P = U.page;
    let corps;
    if (!P) corps = el('p', { class: 'pz-vide' }, 'Tapez l\'adresse IP de la caméra (http://192.168.0.10), ou « Access Camera » dans Easy IP Setup.');
    else if (!P.ok) corps = el('div', { class: 'pz-err' }, el('b', {}, P.code === 'refuse' ? 'Ce site n\'est pas accessible' : P.code === 'url' ? 'Adresse incomplète' : 'Ce site est inaccessible'), el('p', {}, P.pb));
    else corps = pageCamera(P.cam, P.code);
    return fenetre('Navigateur', barre, el('div', { class: 'pz-page' }, corps));
  }
  function pageCamera(id, code) {
    const c = appareil(st(), id), M = MODELES[c.modele];
    const entete = el('header', { class: 'pz-cam-head' }, el('b', {}, M.nom), el('span', {}, c.nom),
      code === 'ok' && U.logins.has(id) ? el('div', { class: 'seg', role: 'group', 'aria-label': 'Live ou Setup' },
        el('button', { type: 'button', 'aria-pressed': String(U.menu === 'live'), 'data-k': 'web:live', onclick: () => { U.menu = 'live'; local(); } }, 'Live'),
        el('button', { type: 'button', 'aria-pressed': String(U.menu !== 'live'), 'data-k': 'web:setup', onclick: () => { U.menu = U.menu === 'live' ? 'network' : U.menu; local(); } }, 'Setup')) : null);
    // le premier accès d'une caméra sans compte : créer le compte administrateur
    if (code === 'compte') {
      const F = U.form; F.user = F.user ?? ''; F.mdp = F.mdp ?? ''; F.mdp2 = F.mdp2 ?? '';
      const set = () => { const r = verifierCompte(F.user, F.mdp, F.mdp2); U.webOk = r.ok; U.webMsg = r.ok ? 'Compte administrateur créé. Identifiez-vous avec ce compte.' : r.pb; if (r.ok) { U.form = {}; ctx.changer({ [`appareils.${id}.compte`]: { user: F.user.trim(), usine: false } }); } else local(); };
      return el('div', { class: 'pz-cam' }, entete, el('h5', {}, 'Initial account registration'),
        el('p', { class: 'pz-note' }, 'Premier accès : créez le compte administrateur de la caméra. Sans lui, le pupitre la voit mais ne peut pas la piloter.'),
        el('div', { class: 'pz-form' }, champ('User name', F.user, (v) => { F.user = v; }, { k: 'web:user', enter: set }), champ('Password', F.mdp, (v) => { F.mdp = v; }, { type: 'password', k: 'web:mdp', enter: set }), champ('Retype password', F.mdp2, (v) => { F.mdp2 = v; }, { type: 'password', k: 'web:mdp2', enter: set })),
        el('div', { class: 'pz-acts' }, bouton('Set', set, { primary: true, k: 'web:set' })), msg(U.webMsg, U.webOk));
    }
    // l'identification
    if (!U.logins.has(id)) {
      const L = U.login;
      const entrer = () => {
        const bon = c.compte && L.user.trim() === c.compte.user && (c.compte.usine ? L.mdp === COMPTE_USINE.mdp : L.mdp.length >= 1);
        U.webOk = !!bon; U.webMsg = bon ? '' : 'Nom d\'utilisateur ou mot de passe incorrect.';
        if (bon) { U.logins.add(id); U.login = { user: '', mdp: '' }; } local();
      };
      return el('div', { class: 'pz-cam' }, entete, el('h5', {}, 'Identification requise'),
        el('p', { class: 'pz-note' }, c.compte && c.compte.usine ? `Compte d'usine de l'${M.nom} : ${COMPTE_USINE.user} / ${COMPTE_USINE.mdp} (mode d'emploi), à changer ensuite.` : 'Le compte administrateur créé au premier accès.'),
        el('div', { class: 'pz-form' }, champ('User name', L.user, (v) => { L.user = v; }, { k: 'web:luser', enter: entrer }), champ('Password', L.mdp, (v) => { L.mdp = v; }, { type: 'password', k: 'web:lmdp', enter: entrer })),
        el('div', { class: 'pz-acts' }, bouton('Log in', entrer, { primary: true, k: 'web:login' })), msg(U.webMsg, U.webOk));
    }
    if (U.menu === 'live') {
      const p = U.pos[id] || { pan: 0, tilt: 0, zoom: 0 };
      return el('div', { class: 'pz-cam' }, entete,
        el('div', { class: 'pz-live', role: 'img', 'aria-label': `Image de ${c.nom}` }, el('span', {}, `${c.nom} · pan ${fr(p.pan, 0)}° · tilt ${fr(p.tilt, 0)}° · zoom ${fr(p.zoom, 0)} %`)),
        el('p', { class: 'pz-note' }, c.compte && c.compte.usine ? 'Le compte d\'usine est toujours en service : changez-le dans Setup → User mng.' : 'Setup : réglages réseau (Network, Advanced) et comptes (User mng.).'));
    }
    const menu = el('nav', { class: 'pz-cam-menu', 'aria-label': 'Menu Setup' }, ...[['basic', 'Basic'], ['user', 'User mng.'], ['network', 'Network']].map(([k, t]) => el('button', { type: 'button', 'aria-pressed': String(U.menu === k), 'data-k': 'web:m:' + k, onclick: () => { U.menu = k; U.webMsg = ''; U.form = {}; local(); } }, t)));
    return el('div', { class: 'pz-cam' }, entete, el('div', { class: 'pz-cam-body' }, menu, el('div', { class: 'pz-cam-main' }, U.menu === 'user' ? pageUser(c) : U.menu === 'basic' ? pageBasic(c) : pageNetwork(c))));
  }
  function pageBasic(c) {
    const M = MODELES[c.modele];
    return el('div', {}, el('h5', {}, 'Basic'), el('dl', { class: 'pz-dl' }, el('dt', {}, 'Camera title'), el('dd', {}, c.nom), el('dt', {}, 'Model'), el('dd', {}, M.nom), el('dt', {}, 'MAC address'), el('dd', {}, c.mac), el('dt', {}, 'Capteur'), el('dd', {}, M.capteur), el('dt', {}, 'Zoom'), el('dd', {}, M.zoom), el('dt', {}, 'Sorties'), el('dd', {}, M.sorties)));
  }
  function pageUser(c) {
    const F = U.form; F.user = F.user ?? (c.compte ? c.compte.user : ''); F.mdp = F.mdp ?? ''; F.mdp2 = F.mdp2 ?? '';
    const set = () => { const r = verifierCompte(F.user, F.mdp, F.mdp2); U.webOk = r.ok; U.webMsg = r.ok ? 'Compte administrateur enregistré.' : r.pb; if (r.ok) { U.form = {}; ctx.changer({ [`appareils.${c.id}.compte`]: { user: F.user.trim(), usine: false } }); } else local(); };
    return el('div', {}, el('h5', {}, 'User mng. · compte administrateur'),
      c.compte && c.compte.usine ? el('p', { class: 'pz-msg bad' }, 'Compte d\'usine (admin / 12345) : n\'importe qui sur le réseau peut piloter la caméra. Changez-le.') : null,
      el('div', { class: 'pz-form' }, champ('User name', F.user, (v) => { F.user = v; }, { k: 'web:uuser', enter: set }), champ('Password', F.mdp, (v) => { F.mdp = v; }, { type: 'password', k: 'web:umdp', enter: set }), champ('Retype password', F.mdp2, (v) => { F.mdp2 = v; }, { type: 'password', k: 'web:umdp2', enter: set })),
      el('div', { class: 'pz-acts' }, bouton('Set', set, { primary: true, k: 'web:uset' })), msg(U.webMsg, U.webOk));
  }
  function pageNetwork(c) {
    const ong = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Network ou Advanced' },
      ...[['network', 'Network'], ['advanced', 'Advanced']].map(([k, t]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(U.onglet === k), 'data-k': 'web:o:' + k, onclick: () => { U.onglet = k; U.webMsg = ''; U.form = {}; local(); } }, t)));
    const F = U.form;
    if (U.onglet === 'network') {
      F.dhcp = F.dhcp ?? !!c.dhcp; F.ip = F.ip ?? c.ip; F.masque = F.masque ?? c.masque; F.passerelle = F.passerelle ?? c.passerelle; F.http = F.http ?? String(c.http); F.periode = F.periode ?? c.periode;
      const set = () => {
        if (!F.dhcp) {
          if (!ipOk(F.ip) || prefixe(F.masque) == null || !adresseHote(F.ip, F.masque)) { U.webOk = false; U.webMsg = 'Adresse ou masque invalide.'; local(); return; }
          if (F.passerelle && (!ipOk(F.passerelle) || !dansReseau(F.ip, F.masque, F.passerelle))) { U.webOk = false; U.webMsg = 'La passerelle doit être dans le sous-réseau de la caméra.'; local(); return; }
        }
        const http = Math.round(Number(F.http)); if (!(http >= 1 && http <= 65535)) { U.webOk = false; U.webMsg = 'Le port HTTP va de 1 à 65 535.'; local(); return; }
        const change = F.dhcp !== !!c.dhcp || F.ip.trim() !== c.ip || http !== c.http;
        U.webOk = true; U.webMsg = change ? 'Réglages enregistrés : la caméra redémarre son réseau. Rouvrez-la à sa nouvelle adresse.' : 'Réglages enregistrés.';
        const patch = { [`appareils.${c.id}.dhcp`]: F.dhcp, [`appareils.${c.id}.ip`]: F.ip.trim(), [`appareils.${c.id}.masque`]: F.masque.trim(), [`appareils.${c.id}.passerelle`]: F.passerelle.trim(), [`appareils.${c.id}.http`]: http, [`appareils.${c.id}.periode`]: F.periode };
        U.form = {}; ctx.changer(patch);
      };
      return el('div', {}, el('h5', {}, 'Network'), ong,
        el('fieldset', { class: 'pz-radios' }, el('legend', {}, 'DHCP'),
          el('label', {}, el('input', { type: 'radio', name: 'pz-wdhcp', checked: !F.dhcp ? true : null, onchange: () => { F.dhcp = false; local(); } }), ' Off'),
          el('label', {}, el('input', { type: 'radio', name: 'pz-wdhcp', checked: F.dhcp ? true : null, onchange: () => { F.dhcp = true; local(); } }), ' On')),
        el('div', { class: 'pz-form' },
          champ('IP address(IPv4)', F.ip, (v) => { F.ip = v; }, { disabled: F.dhcp, k: 'web:ip', enter: set }),
          champ('Subnet mask', F.masque, (v) => { F.masque = v; }, { disabled: F.dhcp, k: 'web:masque', enter: set }),
          champ('Default gateway', F.passerelle, (v) => { F.passerelle = v; }, { disabled: F.dhcp, k: 'web:passerelle', enter: set }),
          champ('HTTP port', F.http, (v) => { F.http = v; }, { num: true, k: 'web:http', enter: set })),
        el('fieldset', { class: 'pz-radios' }, el('legend', {}, 'Easy IP Setup accommodate period'),
          el('label', {}, el('input', { type: 'radio', name: 'pz-per', checked: F.periode === '20min' ? true : null, onchange: () => { F.periode = '20min'; } }), ' 20min'),
          el('label', {}, el('input', { type: 'radio', name: 'pz-per', checked: F.periode === 'illimite' ? true : null, onchange: () => { F.periode = 'illimite'; } }), ' Unlimited')),
        el('div', { class: 'pz-acts' }, bouton('Set', set, { primary: true, k: 'web:nset' })), msg(U.webMsg, U.webOk));
    }
    F.dscp = F.dscp ?? String(c.dscp); F.flux = F.flux ?? !!c.flux; F.debit = F.debit ?? String(c.debit);
    const set = () => {
      const d = Math.round(Number(F.dscp)); if (!(d >= 0 && d <= 63)) { U.webOk = false; U.webMsg = 'Le DSCP va de 0 à 63 (6 bits).'; local(); return; }
      U.webOk = true; U.webMsg = `Réglages enregistrés : les paquets vidéo portent le DSCP ${d} (octet ToS ${tosDe(d)}).`;
      U.form = {}; ctx.changer({ [`appareils.${c.id}.dscp`]: d, [`appareils.${c.id}.flux`]: !!F.flux, [`appareils.${c.id}.debit`]: Number(F.debit) });
    };
    return el('div', {}, el('h5', {}, 'Network · Advanced'), ong,
      el('div', { class: 'pz-form' }, champ('Diffserv (DSCP, 0 à 63)', F.dscp, (v) => { F.dscp = v; }, { num: true, k: 'web:dscp', enter: set })),
      el('fieldset', { class: 'pz-radios' }, el('legend', {}, 'Flux H.264 vers le réseau (RTSP)'),
        el('label', {}, el('input', { type: 'radio', name: 'pz-flux', checked: !F.flux ? true : null, onchange: () => { F.flux = false; } }), ' Off'),
        el('label', {}, el('input', { type: 'radio', name: 'pz-flux', checked: F.flux ? true : null, onchange: () => { F.flux = true; } }), ' On')),
      el('label', { class: 'pz-field' }, el('span', {}, 'Débit du flux'), el('select', { 'aria-label': 'Débit du flux', 'data-k': 'web:debit', onchange: (e) => { F.debit = e.target.value; } }, ...[4, 10, 20, 40].map((v) => el('option', { value: String(v), selected: String(v) === String(F.debit) ? true : null }, `${v} Mb/s`)))),
      el('div', { class: 'pz-acts' }, bouton('Set', set, { primary: true, k: 'web:aset' })), msg(U.webMsg, U.webOk),
      el('p', { class: 'pz-note' }, 'AF41 = 34, EF = 46, au mieux = 0. Le marquage ne sert que si le switch fait confiance au DSCP.'));
  }

  // ======================================================================
  // le pupitre AW-RP150 : l'écran tactile, les touches de caméra, le joystick
  // ======================================================================
  const vRp = el('div', { class: 'lb-vue' });
  function dessinerRp(m) {
    const rp = appareil(st(), 'rp'), on = enMarche(st(), 'rp'), L = m.pupitre, sel = st().rp.sel;
    const menus = [['camera', 'CAMERA'], ['rpip', 'RP IP SET'], ['manual', 'MANUAL IP SET']];
    let ecran;
    if (!on) ecran = el('div', { class: 'pz-rp-off' }, 'Écran éteint : le pupitre n\'est pas alimenté.');
    else {
      const onglets = el('nav', { class: 'pz-rp-tabs', 'aria-label': 'Menus du pupitre' }, ...menus.map(([k, t]) => el('button', { type: 'button', 'aria-pressed': String(U.rpMenu === k), 'data-k': 'rp:m:' + k, onclick: () => { U.rpMenu = k; U.rpMsg = ''; local(); } }, t)));
      let page;
      if (U.rpMenu === 'rpip') {
        if (!U.rpIp) U.rpIp = { ip: rp.ip, masque: rp.masque, passerelle: rp.passerelle };
        const F = U.rpIp, dis = lock('appareils.rp') || lock('appareils');
        const set = () => {
          if (!ipOk(F.ip) || prefixe(F.masque) == null || !adresseHote(F.ip, F.masque)) { U.rpMsg = 'ADRESSE OU MASQUE INVALIDE'; local(); return; }
          if (F.passerelle && (!ipOk(F.passerelle) || !dansReseau(F.ip, F.masque, F.passerelle))) { U.rpMsg = 'PASSERELLE HORS DU SOUS-RÉSEAU'; local(); return; }
          U.rpMsg = 'SET : le pupitre redémarre son réseau.'; U.rpIp = null;
          ctx.changer({ 'appareils.rp.ip': F.ip.trim(), 'appareils.rp.masque': F.masque.trim(), 'appareils.rp.passerelle': F.passerelle.trim() });
        };
        page = el('div', { class: 'pz-rp-page' }, el('h5', {}, 'CONNECT SETTING · RP IP SET'),
          el('div', { class: 'pz-form' }, champ('IP ADDRESS', F.ip, (v) => { F.ip = v; }, { k: 'rp:ip', enter: set, disabled: dis }), champ('SUBNET MASK', F.masque, (v) => { F.masque = v; }, { k: 'rp:masque', enter: set, disabled: dis }), champ('DEFAULT GATEWAY', F.passerelle, (v) => { F.passerelle = v; }, { k: 'rp:passerelle', enter: set, disabled: dis })),
          el('div', { class: 'pz-acts' }, bouton('SET', set, { primary: true, k: 'rp:ipset', disabled: dis })));
      } else if (U.rpMenu === 'manual') {
        const lignes = Array.from({ length: 5 }, (_, i) => {
          const n = i + 1, cur = (st().rp.cams || {})[n] || { ip: '', port: 80 };
          const F = U.rpCams[n] || (U.rpCams[n] = { ip: cur.ip, port: String(cur.port || 80) });
          const l = L.find((x) => x.n === n);
          return el('tr', {}, el('th', { scope: 'row' }, `CAM${n}`),
            el('td', {}, el('input', { type: 'text', value: F.ip, 'aria-label': `Adresse IP de la caméra ${n}`, 'data-k': `rp:cam${n}:ip`, spellcheck: 'false', autocomplete: 'off', oninput: (e) => { F.ip = e.target.value; } })),
            el('td', {}, el('input', { type: 'text', inputmode: 'numeric', value: F.port, 'aria-label': `Port de la caméra ${n}`, 'data-k': `rp:cam${n}:port`, oninput: (e) => { F.port = e.target.value; } })),
            el('td', { class: l ? (l.ok ? 'ok' : 'bad') : '' }, !l ? '—' : l.ok ? 'connectée' : l.pb));
        });
        const set = () => {
          const cams = {};
          for (const [k, F] of Object.entries(U.rpCams)) { if (!F.ip.trim()) continue; if (!ipOk(F.ip.trim())) { U.rpMsg = `CAM${k} : ADRESSE INVALIDE`; local(); return; } cams[k] = { ip: F.ip.trim(), port: Math.round(Number(F.port)) || 80 }; }
          U.rpMsg = 'SET : liste des caméras enregistrée.'; ctx.changer({ 'rp.cams': cams });
        };
        page = el('div', { class: 'pz-rp-page' }, el('h5', {}, 'CONNECT SETTING · MANUAL IP SET'),
          el('table', { class: 'pz-table pz-rp-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'CAM'), el('th', {}, 'IP ADDRESS'), el('th', {}, 'PORT'), el('th', {}, 'STATUS'))), el('tbody', {}, ...lignes)),
          el('div', { class: 'pz-acts' }, bouton('SET', set, { primary: true, k: 'rp:camset' })),
          el('p', { class: 'pz-note' }, 'Le pupitre en pilote 200 en IP (5 sur ses liaisons série) ; ses 10 touches de caméra appellent les numéros 1 à 10. AUTO IP SET, lui, attribue les adresses tout seul : on ne le lance pas en même temps qu\'Easy IP Setup.'));
      } else {
        const cam = camDuNumero(st(), sel), c = cam ? appareil(st(), cam) : null, p = cam ? U.pos[cam] || { pan: 0, tilt: 0, zoom: 0 } : null;
        page = el('div', { class: 'pz-rp-page' }, el('h5', {}, `CAMERA · CAM${sel}`),
          el('dl', { class: 'pz-dl' }, el('dt', {}, 'IP'), el('dd', {}, ((st().rp.cams || {})[sel] || {}).ip || '—'), el('dt', {}, 'STATUS'), el('dd', {}, c ? `${c.nom} (${MODELES[c.modele].nom}) connectée` : (L.find((x) => x.n === sel) || { pb: 'pas enregistrée' }).pb),
            p ? [el('dt', {}, 'PAN / TILT'), el('dd', {}, `${fr(p.pan, 0)}° / ${fr(p.tilt, 0)}°`), el('dt', {}, 'ZOOM'), el('dd', {}, `${fr(p.zoom, 0)} %`)] : null),
          U.rpCmd ? el('p', { class: 'pz-cmd' }, el('small', {}, 'Dernière commande envoyée'), el('code', {}, U.rpCmd)) : null);
      }
      ecran = el('div', { class: 'pz-rp-screen' }, el('div', { class: 'pz-rp-status' }, el('span', {}, `RP ${rp.ip}`), el('span', {}, `${L.filter((x) => x.ok).length} caméra(s) connectée(s)`)), onglets, page, U.rpMsg ? el('p', { class: 'pz-rp-msg', role: 'status' }, U.rpMsg) : null);
    }
    // les touches de caméra : allumées quand la liaison tient
    const touches = el('div', { class: 'pz-rp-keys', role: 'group', 'aria-label': 'Touches de sélection de caméra' }, ...Array.from({ length: 10 }, (_, i) => {
      const n = i + 1, l = L.find((x) => x.n === n);
      return el('button', { type: 'button', class: 'pz-rp-key' + (l && l.ok ? ' ok' : l ? ' bad' : ''), 'aria-pressed': String(n === sel), 'aria-label': `Caméra ${n}${l ? (l.ok ? ', connectée' : ', pas de liaison') : ''}`, disabled: !on ? true : null, onclick: () => { U.rpMenu = 'camera'; ctx.changer({ 'rp.sel': n }); } }, String(n));
    }));
    // le joystick : la vraie commande HTTP Panasonic (#PTS : vitesses pan et tilt de 01 à 99, 50 à l'arrêt)
    const bouger = (dp, dt, dz) => {
      const cam = camDuNumero(st(), sel); if (!cam) { U.rpMsg = `CAM${sel} : PAS DE LIAISON`; local(); return; }
      const c = appareil(st(), cam), p = U.pos[cam] || (U.pos[cam] = { pan: 0, tilt: 0, zoom: 0 });
      p.pan = Math.max(-175, Math.min(175, p.pan + dp)); p.tilt = Math.max(-30, Math.min(90, p.tilt + dt)); p.zoom = Math.max(0, Math.min(100, p.zoom + dz));
      const cmd = dz ? `%23Z${dz > 0 ? 75 : 25}` : `%23PTS${String(50 + Math.sign(dp) * 25).padStart(2, '0')}${String(50 + Math.sign(dt) * 25).padStart(2, '0')}`;
      U.rpCmd = `http://${adresse(c)}${c.http !== 80 ? ':' + c.http : ''}/cgi-bin/aw_ptz?cmd=${cmd}&res=1`; U.rpMsg = '';
      const t = st().rp.testees || [];
      if (!t.includes(cam)) ctx.changer({ 'rp.testees': [...t, cam] }); else local();
    };
    const joy = el('div', { class: 'pz-joy', role: 'group', 'aria-label': 'Joystick et zoom' },
      bouton('▲', () => bouger(0, 10, 0), { aria: 'Tilt vers le haut', disabled: !on }), el('div', { class: 'pz-joy-mid' }, bouton('◀', () => bouger(-15, 0, 0), { aria: 'Pan vers la gauche', disabled: !on }), bouton('▶', () => bouger(15, 0, 0), { aria: 'Pan vers la droite', disabled: !on })), bouton('▼', () => bouger(0, -10, 0), { aria: 'Tilt vers le bas', disabled: !on }),
      el('div', { class: 'pz-joy-mid' }, bouton('W', () => bouger(0, 0, -10), { aria: 'Zoom large', disabled: !on }), bouton('T', () => bouger(0, 0, 10), { aria: 'Zoom serré', disabled: !on })));
    vRp.replaceChildren(el('div', { class: 'pz-rp' }, el('div', { class: 'pz-rp-left' }, el('div', { class: 'pz-rp-label' }, el('b', {}, 'AW-RP150'), el('small', {}, 'écran tactile 7 pouces')), ecran, touches), joy));
  }

  // ======================================================================
  // la fiche du banc : le plan à appliquer, la recette
  // ======================================================================
  const vFiche = el('div', { class: 'lb-vue' });
  function dessinerFiche(m) {
    const P = st().plan, cams = cameras(st());
    const lignes = [['pc', 'PC technique', P.pc, '—'], ['rp', 'Pupitre AW-RP150', P.rp, '—'], ...cams.map((c) => [c.id, `${c.nom} (${MODELES[c.modele].nom})`, P.cams[c.id], String(P.http)])];
    const rec = m.recette;
    vFiche.replaceChildren(
      el('h4', { class: 'lb-sub' }, 'La fiche de configuration du banc'),
      el('p', { class: 'pz-note' }, `Réseau ${P.reseau}/${P.p} · masque ${P.masque} · passerelle ${P.passerelle} · VLAN ${P.vlan} · PoE+ sur les ports des caméras et du pupitre · DSCP ${P.dscp} (AF41) sur la vidéo.`),
      el('table', { class: 'pz-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Appareil'), el('th', {}, 'Adresse IP'), el('th', {}, 'Port HTTP'), el('th', {}, 'En service'))),
        el('tbody', {}, ...lignes.map(([id, n, ip, port]) => { const a = appareil(st(), id); const ok = a && adresse(a) === ip; return el('tr', {}, el('td', {}, n), el('td', {}, ip), el('td', {}, port), el('td', { class: ok ? 'ok' : 'bad' }, a ? (a.dhcp ? 'DHCP' : a.ip) : '—')); }))),
      el('h4', { class: 'lb-sub' }, 'La recette : qui joint qui'),
      el('table', { class: 'pz-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Caméra'), el('th', {}, 'Depuis le PC'), el('th', {}, 'Depuis le pupitre'))),
        el('tbody', {}, ...cams.map((c) => { const a = joint(st(), 'pc', c.id), b = m.pupitre.find((l) => l.cam === c.id && l.ok); return el('tr', {}, el('td', {}, c.nom), el('td', { class: a.ok ? 'ok' : 'bad' }, a.ok ? 'oui' : a.pb), el('td', { class: b ? 'ok' : 'bad' }, b ? `oui (CAM${b.n})` : 'non')); }))),
      el('p', { class: 'pz-msg ' + (rec.ok ? 'ok' : 'bad') }, rec.ok ? 'Recette réussie : chaque caméra répond au PC et au pupitre.' : `${rec.pb.length} point${rec.pb.length > 1 ? 's' : ''} à reprendre.`));
  }

  // ---------------- l'ensemble ----------------
  const onglets = el('div', { class: 'seg lb-vues', role: 'tablist', 'aria-label': 'Les vues de l\'atelier' },
    ...VUES.map(([id, t]) => el('button', { type: 'button', role: 'tab', 'data-vue': id, onclick: () => ctx.changer({ vue: id }) }, t)));
  const panneaux = { banc: vBanc, pc: vPc, pupitre: vRp, fiche: vFiche };
  function rendre() {
    const m = ctx.m(), v = st().vue;
    for (const b of onglets.querySelectorAll('button')) { const on = /** @type {HTMLElement} */ (b).dataset.vue === v; b.setAttribute('aria-selected', String(on)); /** @type {HTMLButtonElement} */ (b).disabled = lock('vue') && !on; }
    for (const [k, p] of Object.entries(panneaux)) p.hidden = k !== v;
    // un nouvel état (un défi, une solution) : les formulaires repartent de ce qui est en service
    if (st() !== dernier) { dernier = st(); U.ipv4 = null; U.rpIp = null; U.rpCams = {}; U.dlg = null; U.page = null; U.url = ''; U.logins.clear(); U.form = {}; U.eipMsg = U.webMsg = U.rpMsg = U.ipv4Msg = U.rpCmd = ''; U.sel = ''; }
    if (v === 'banc') dessinerBanc(m);
    if (v === 'pc') dessinerPc(m);
    if (v === 'pupitre') dessinerRp(m);
    if (v === 'fiche') dessinerFiche(m);
  }
  let dernier = null;
  const root = el('div', { class: 'lb-atelier lb-ptz' }, el('div', { class: 'lb-stage lb-wide' }, onglets, vBanc, vPc, vRp, vFiche));
  return { root, rendre, etapes: () => ctx.m().etapes, comment: COMMENT, aller: (e) => ctx.changer(e.pc ? { vue: e.vue, pcApp: e.pc } : { vue: e.vue }) };
}
