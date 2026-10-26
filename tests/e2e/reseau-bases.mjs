// Leçons « bases du réseau » du Cours (v19.17) : couches OSI et TCP/IP, LAN / MAN / WAN, câbles et
// fibres, adresse du réseau et de diffusion (calcul, découpage, plan du car, entraînement), unicast /
// diffusion / multicast, DHCP / DNS / NAT, TCP et UDP, streaming, QoS. Chaque leçon s'ouvre, sa
// manipulation répond aux commandes et calcule ce qu'il faut ; une capture de chaque page.
// node tests/e2e/reseau-bases.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('reseau-bases');
const T = reporter();
const browser = await launch();
const A = await openPage(browser, { title: true, errors: T.errors });
await until(A, () => !!document.querySelector('#title.ready'), null, 180000);
const ev = (f, a) => A.evaluate(f, a);
const IDS = ['reseau-modeles', 'reseau-lan-wan', 'reseau-cables', 'reseau-adressage', 'reseau-diffusion', 'reseau-services', 'reseau-tcp-udp', 'reseau-streaming', 'reseau-qos'];

await A.click('#ti-cours'); await A.waitForTimeout(500);
const ordre = await ev(() => window.__dbg.COURS.allLessons().filter(({ chapter }) => chapter.id === 'reseau').map(({ lesson }) => lesson.id));
T.check('chapitre Réseau : les neuf leçons des bases, avant le car IP', IDS.every((id) => ordre.includes(id)) && ordre.indexOf('reseau-modeles') === 0 && ordre.indexOf('reseau-qos') < ordre.indexOf('reseau-st2110'), ordre.join(' '));

const ouvre = async (id) => { await ev((x) => window.__dbg.openCours(x), id); await A.waitForTimeout(500); };
const verdict = () => ev(() => document.querySelector('#layer .co-demo-host .co-verdict')?.textContent || document.querySelector('#layer .co-verdict')?.textContent || '');
const lecture = (k) => ev((key) => { const dt = [...document.querySelectorAll('#layer .co-read dt')].find((d) => d.textContent === key); return dt?.nextElementSibling?.textContent || ''; }, k);
const bouton = (label, texte) => A.locator(`#layer .co-seg[aria-label="${label}"] button`, { hasText: texte }).first().click({ force: true });
const glisse = (label, v) => ev(([l, val]) => {
  const lab = [...document.querySelectorAll('#layer label.co-slider')].find((x) => x.querySelector('span')?.textContent === l);
  const i = lab?.querySelector('input'); if (!i) return false;
  i.value = String(val); i.dispatchEvent(new Event('input', { bubbles: true })); return true;
}, [label, v]);
// captures : le schéma, puis la manipulation (amenés dans la vue : la page défile dans son cadre)
const capture = async (n) => {
  for (const [sel, suf] of [['#layer .co-page > .co-figwrap, #layer .co-page .co-figbox', 'schema'], ['#layer .co-demo', 'manip']]) {
    const e = await A.$(sel); if (!e) continue;
    await e.scrollIntoViewIfNeeded().catch(() => {}); await A.waitForTimeout(150);
    await e.screenshot({ path: `${OUT}/${n}-${suf}.png` }).catch(() => {});
  }
};

// ---------------- 1. couches et encapsulation ----------------
await ouvre('reseau-modeles');
T.check('modèles : schéma OSI / TCP/IP et encapsulation dessinés', await ev(() => document.querySelectorAll('#layer .co-figbox svg').length >= 2));
T.check('encapsulation par défaut (1 200 octets, UDP, RTP, VLAN) : paquet IP de 1 240 octets', /1 ?240/.test((await lecture('Paquet IP')).replace(/[\u202f\u00a0]/g, ' ')), await lecture('Paquet IP'));
await glisse('Données de l\'application', 1490); await A.waitForTimeout(150);
T.check('1 490 octets : trop gros pour la MTU', /Trop gros/.test(await verdict()), await verdict());
await glisse('Données de l\'application', 20); await A.waitForTimeout(150);
T.check('20 octets : petits paquets, beaucoup d\'en-têtes', /Petits paquets/.test(await verdict()), await verdict());
await capture('01-modeles');

// ---------------- 2. LAN, MAN, WAN ----------------
await ouvre('reseau-lan-wan');
await A.locator('#layer .co-seg[aria-label="Liaison"] button').last().click({ force: true }).catch(() => {});
await bouton('Liaison', 'Car → satellite'); await A.waitForTimeout(150);
T.check('satellite : plus de 239 ms d\'aller simple', /^(2[4-9]\d|[3-9]\d\d)/.test((await lecture('Latence aller simple')).replace(/\s/g, '')), await lecture('Latence aller simple'));
await bouton('Liaison', 'Dans le car'); await A.waitForTimeout(150);
T.check('dans le car : latence en microsecondes', /µs/.test(await lecture('Latence aller simple')), await lecture('Latence aller simple'));
await capture('02-lan-wan');

// ---------------- 3. câbles ----------------
await ouvre('reseau-cables');
T.check('10 Gb/s sur 100 m : 10GBASE-T (cuivre)', (await lecture('Lien le plus simple')) === '10GBASE-T', await lecture('Lien le plus simple'));
await glisse('Distance', 12); await A.waitForTimeout(150); // 300 m
T.check('10 Gb/s sur 300 m : 10GBASE-SR (multimode)', (await lecture('Lien le plus simple')) === '10GBASE-SR', await lecture('Lien le plus simple'));
await glisse('Distance', 21); await A.waitForTimeout(150); // 40 km
T.check('10 Gb/s sur 40 km : 10GBASE-ER (monomode)', (await lecture('Lien le plus simple')) === '10GBASE-ER', await lecture('Lien le plus simple'));
await capture('03-cables');

// ---------------- 4. adressage ----------------
await ouvre('reseau-adressage');
T.check('calcul : 192.168.10.77/26 → réseau .64, diffusion .127, 62 machines',
  (await lecture('Adresse du réseau')) === '192.168.10.64/26' && (await lecture('Adresse de diffusion')) === '192.168.10.127' && (await lecture('Machines possibles')) === '62');
await A.locator('#layer .co-field input[aria-label="Adresse IP"]').fill('10.1.20.255');
await glisse('Préfixe', 24); await A.waitForTimeout(150);
T.check('10.1.20.255/24 : reconnue comme adresse de diffusion', /diffusion/.test(await lecture('Cette adresse est')), await lecture('Cette adresse est'));
await capture('04-adressage-calcul');
await bouton('Outil', 'Découper'); await A.waitForTimeout(200);
await glisse('Sous-réseaux voulus', 5); await A.waitForTimeout(150);
T.check('découper un /24 en 5 : /27, 8 sous-réseaux', (await lecture('Nouveau préfixe')) === '/27' && /puissances de 2/.test(await verdict()), await lecture('Nouveau préfixe'));
await capture('05-adressage-decoupe');
await bouton('Outil', 'Plan du car'); await A.waitForTimeout(200);
T.check('plan du car : tous les VLAN tiennent dans 10.1.0.0/24', /Tout tient/.test(await verdict()), await verdict());
await capture('06-adressage-plan');
await bouton('Outil', 'S\'entraîner'); await A.waitForTimeout(200);
const enonce = await ev(() => document.querySelector('#layer .co-demo-host p')?.textContent || '');
const m = /(\d+\.\d+\.\d+\.\d+)\/(\d+)/.exec(enonce);
if (m) {
  // la réponse attendue, recalculée à part
  const juste = await ev(([ip, p]) => {
    const n = ip.split('.').reduce((a, b) => a * 256 + Number(b), 0), pas = 2 ** (32 - p), r = Math.floor(n / pas) * pas;
    const t = (x) => [24, 16, 8, 0].map((s) => Math.floor(x / 2 ** s) % 256).join('.');
    return { r: t(r), d: t(r + pas - 1), h: pas - 2 };
  }, [m[1], Number(m[2])]);
  await A.locator('#layer input[aria-label="Adresse du réseau"]').fill(juste.r);
  await A.locator('#layer input[aria-label="Adresse de diffusion"]').fill(juste.d);
  await A.locator('#layer input[aria-label="Nombre de machines"]').fill(String(juste.h));
  await A.locator('#layer .co-btns button', { hasText: 'Vérifier' }).click({ force: true });
  await A.waitForTimeout(150);
  T.check('entraînement : réponse juste reconnue', /^Juste/.test(await verdict()), `${enonce} → ${JSON.stringify(juste)} : ${await verdict()}`);
  await A.locator('#layer input[aria-label="Adresse du réseau"]').fill('1.2.3.4');
  await A.locator('#layer .co-btns button', { hasText: 'Vérifier' }).click({ force: true });
  await A.waitForTimeout(150);
  T.check('entraînement : réponse fausse corrigée', /✘/.test(await verdict()), await verdict());
} else T.check('entraînement : énoncé lisible', false, enonce);
await capture('07-adressage-entrainement');

// ---------------- 5. unicast, diffusion, multicast ----------------
await ouvre('reseau-diffusion');
T.check('multicast, 6 récepteurs, vidéo HD : une copie, 2,2 Gb/s', (await lecture('Copies envoyées par la source')) === '1', await lecture('Charge du lien de la source (10 Gb/s)'));
await bouton('Mode', 'Unicast'); await A.waitForTimeout(150);
T.check('unicast, 6 copies de 2,2 Gb/s : le lien de 10 Gb/s déborde', /déborde/.test(await verdict()), await verdict());
await bouton('Mode', 'Diffusion'); await A.waitForTimeout(150);
T.check('diffusion : 18 machines reçoivent sans l\'avoir demandé', (await lecture('Dont sans l\'avoir demandé')) === '18', await lecture('Dont sans l\'avoir demandé'));
await capture('08-diffusion');

// ---------------- 6. DHCP, DNS, NAT ----------------
await ouvre('reseau-services');
await A.locator('#layer .co-btns button', { hasText: 'Encodeur SRT sort' }).click({ force: true }); await A.waitForTimeout(150);
T.check('NAT : la sortie crée une ligne de traduction', await ev(() => [...document.querySelectorAll('#layer .co-table td')].some((td) => td.textContent === '192.168.1.30')));
await A.locator('#layer .co-btns button', { hasText: 'Quelqu\'un d\'Internet entre' }).click({ force: true }); await A.waitForTimeout(150);
T.check('NAT : une connexion entrante sans redirection est refusée', /Refusé/.test(await verdict()), await verdict());
await bouton('Redirection du port 8080 vers le PC', 'active'); await A.waitForTimeout(100);
await A.locator('#layer .co-btns button', { hasText: 'Quelqu\'un d\'Internet entre' }).click({ force: true }); await A.waitForTimeout(150);
T.check('NAT : avec la redirection, elle passe', /permise/.test(await verdict()), await verdict());
await bouton('Adresse de la box', 'partagée'); await A.waitForTimeout(100);
await A.locator('#layer .co-btns button', { hasText: 'Quelqu\'un d\'Internet entre' }).click({ force: true }); await A.waitForTimeout(150);
T.check('NAT : adresse partagée (CGNAT), il faut un tunnel', /tunnel/.test(await verdict()), await verdict());
await capture('09-services');

// ---------------- 7. TCP et UDP ----------------
await ouvre('reseau-tcp-udp');
await glisse('Aller-retour (RTT)', 80); await glisse('Pertes', 2); await A.waitForTimeout(150);
T.check('TCP à 80 ms et 2 % de pertes : limité par les pertes, le flux ne tient pas', (await lecture('Ce qui limite TCP')) === 'les pertes' && /ne tient pas/.test(await lecture('Ce flux vidéo en TCP')), await lecture('Ce flux vidéo en TCP'));
await glisse('Pertes', 0); await glisse('Aller-retour (RTT)', 5); await A.waitForTimeout(150);
T.check('sans perte, à 5 ms : TCP tient le débit', /tient/.test(await lecture('Ce flux vidéo en TCP')) && /passent tous les deux/.test(await verdict()), await verdict());
await capture('10-tcp-udp');

// ---------------- 8. streaming ----------------
await ouvre('reseau-streaming');
await glisse('Aller-retour (RTT)', 60); await glisse('Pertes', 2); await A.waitForTimeout(150);
T.check('SRT, 60 ms et 2 % de pertes : 240 ms de latence', /^240/.test((await lecture('Latence SRT à régler')).replace(/\s/g, '')), await lecture('Latence SRT à régler'));
T.check('tableau des cinq protocoles', await ev(() => document.querySelectorAll('#layer .co-demo-host .co-table tbody tr, #layer .co-table tbody tr').length >= 5));
await capture('11-streaming');

// ---------------- 9. QoS ----------------
await ouvre('reseau-qos');
const fifo = await lecture('Attente d\'un paquet PTP');
T.check('QoS, une seule file : PTP attend la rafale (10 ms à 1 Gb/s) et l\'horloge se trompe', /10,00 ms/.test(fifo) && /se trompe/.test(await verdict()), fifo);
await bouton('Files d\'attente', 'priorité stricte'); await A.waitForTimeout(150);
const prio = await lecture('Attente d\'un paquet PTP');
T.check('QoS, priorité stricte : PTP n\'attend que la fin d\'une trame (12 µs)', /^12,0 µs/.test(prio), prio);
await capture('12-qos');

// une fiche « ? » nouvelle s'ouvre depuis une leçon
await ouvre('reseau-streaming');
T.check('fiches « ? » de la leçon : SRT, HLS, RTMP présentes', await ev(() => ['SRT', 'HLS, DASH', 'RTMP'].every((t) => [...document.querySelectorAll('#layer .co-chip')].some((c) => c.textContent?.includes(t)))));

await T.finish();
