// Jouer par Internet (lan/internet.mjs) : classement des adresses, lecture des réponses de la box
// (SSDP, description, SOAP) et ouverture du port face à une fausse box UPnP qui tourne ici : port
// déjà pris par un autre appareil, box qui n'accepte que des redirections permanentes, box qui
// refuse, renouvellement et fermeture.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import dgram from 'node:dgram';
import { isPrivateAddr, isCgnat, isPublicV4, sameSubnet, parseSsdp, parseGateway, parseSoap, soapEnvelope, tunnelUrlIn, discoverGateways, upnpOpen, upnpRenew, upnpClose } from '../../lan/internet.mjs';

test('adresses : réseau local, CGNAT, publique', () => {
  for (const a of ['127.0.0.1', '::1', '10.1.2.3', '172.16.0.9', '172.31.255.1', '192.168.1.20', '::ffff:192.168.0.4', '169.254.3.3', 'fe80::1', 'fd12:3456::1']) assert.ok(isPrivateAddr(a), a);
  for (const a of ['172.32.0.1', '8.8.8.8', '86.245.10.3', '100.64.0.1', '2a01:cb00::1', '::ffff:90.1.2.3']) assert.ok(!isPrivateAddr(a), a);
  assert.ok(isCgnat('100.64.0.1') && isCgnat('100.127.255.255') && !isCgnat('100.128.0.1') && !isCgnat('100.63.0.1'));
  assert.ok(isPublicV4('86.245.10.3') && !isPublicV4('192.168.1.1') && !isPublicV4('100.70.1.1') && !isPublicV4('0.1.2.3') && !isPublicV4('224.0.0.1') && !isPublicV4('nimporte'));
  assert.ok(sameSubnet({ address: '192.168.1.20', netmask: '255.255.255.0' }, '192.168.1.1'));
  assert.ok(!sameSubnet({ address: '192.168.1.20', netmask: '255.255.255.0' }, '192.168.0.1'));
});

test('réponse SSDP et adresse du tunnel', () => {
  const h = parseSsdp('HTTP/1.1 200 OK\r\nCACHE-CONTROL: max-age=1800\r\nLocation: http://192.168.1.1:49152/rootDesc.xml\r\nST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n');
  assert.equal(h.location, 'http://192.168.1.1:49152/rootDesc.xml');
  assert.equal(h.st, 'urn:schemas-upnp-org:device:InternetGatewayDevice:1');
  assert.equal(tunnelUrlIn('2026-10-24T18:00:00Z INF |  https://drive-salon-bleu-xyz.trycloudflare.com  |'), 'https://drive-salon-bleu-xyz.trycloudflare.com');
  assert.equal(tunnelUrlIn('INF Requesting new quick Tunnel on trycloudflare.com...'), null);
});

const DESC = (base = '') => `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">${base ? `<URLBase>${base}</URLBase>` : ''}
<device><deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType><friendlyName>Ma box</friendlyName><manufacturer>Fabricant</manufacturer><modelName>Box 7 &amp; fibre</modelName>
<deviceList><device><deviceType>urn:schemas-upnp-org:device:WANDevice:1</deviceType><deviceList><device><deviceType>urn:schemas-upnp-org:device:WANConnectionDevice:1</deviceType>
<serviceList>
<service><serviceType>urn:schemas-upnp-org:service:WANPPPConnection:1</serviceType><serviceId>urn:upnp-org:serviceId:WANPPPConn1</serviceId><controlURL>/ctl/PPP</controlURL></service>
<service><serviceType>urn:schemas-upnp-org:service:WANIPConnection:1</serviceType><serviceId>urn:upnp-org:serviceId:WANIPConn1</serviceId><controlURL>/ctl/IPConn</controlURL></service>
<service><serviceType>urn:schemas-upnp-org:service:Layer3Forwarding:1</serviceType><controlURL>/ctl/L3F</controlURL></service>
</serviceList></device></deviceList></device></deviceList></device></root>`;

test('description de la box : nom, services de connexion, adresse de commande', () => {
  const g = parseGateway(DESC(), 'http://192.168.1.1:49152/rootDesc.xml');
  assert.equal(g.name, 'Ma box');
  assert.equal(g.model, 'Fabricant Box 7 & fibre');
  assert.deepEqual(g.services.map((x) => x.control), ['http://192.168.1.1:49152/ctl/IPConn', 'http://192.168.1.1:49152/ctl/PPP'], 'WANIPConnection avant WANPPPConnection, Layer3Forwarding écarté');
  const b = parseGateway(DESC('http://192.168.1.254:5000/'), 'http://192.168.1.254:49000/desc.xml');
  assert.equal(b.services[0].control, 'http://192.168.1.254:5000/ctl/IPConn', 'URLBase prise en compte');
});

test('SOAP : enveloppe échappée, réponse et erreur UPnP', () => {
  const env = soapEnvelope('urn:schemas-upnp-org:service:WANIPConnection:1', 'AddPortMapping', { NewPortMappingDescription: 'A & B <test>', NewExternalPort: 8080 });
  assert.match(env, /<u:AddPortMapping xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1"><NewPortMappingDescription>A &amp; B &lt;test&gt;<\/NewPortMappingDescription><NewExternalPort>8080<\/NewExternalPort>/);
  assert.deepEqual(parseSoap(200, '<s:Envelope><s:Body><u:GetExternalIPAddressResponse><NewExternalIPAddress>86.245.10.3</NewExternalIPAddress></u:GetExternalIPAddressResponse></s:Body></s:Envelope>'), { ok: true, values: { NewExternalIPAddress: '86.245.10.3' } });
  const e = parseSoap(500, '<s:Envelope><s:Body><s:Fault><detail><UPnPError xmlns="urn:schemas-upnp-org:control-1-0"><errorCode>718</errorCode><errorDescription>ConflictInMappingEntry</errorDescription></UPnPError></detail></s:Fault></s:Body></s:Envelope>');
  assert.deepEqual(e, { ok: false, code: 718, message: 'ConflictInMappingEntry' });
});

// ---------------- une fausse box ----------------
// opts.taken : ports extérieurs déjà redirigés vers un autre appareil ; opts.permanent : n'accepte
// que des durées nulles ; opts.refuse : code d'erreur à toutes les redirections ; opts.wan : adresse
const servers = [];
after(() => { for (const s of servers) s.close(); });
function fakeBox(opts = {}) {
  const box = { calls: [], maps: new Map(), url: '' };
  const fault = (res, code, d) => { res.writeHead(500, { 'content-type': 'text/xml' }); res.end(`<s:Envelope><s:Body><s:Fault><detail><UPnPError><errorCode>${code}</errorCode><errorDescription>${d}</errorDescription></UPnPError></detail></s:Fault></s:Body></s:Envelope>`); };
  const ok = (res, inner = '') => { res.writeHead(200, { 'content-type': 'text/xml' }); res.end(`<s:Envelope><s:Body>${inner}</s:Body></s:Envelope>`); };
  const s = http.createServer((req, res) => {
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', () => {
      if (req.url === '/rootDesc.xml') { res.writeHead(200, { 'content-type': 'text/xml' }); res.end(DESC()); return; }
      const action = /#(\w+)"/.exec(String(req.headers.soapaction || ''))?.[1];
      const arg = (k) => new RegExp(`<${k}>([^<]*)</${k}>`).exec(body)?.[1];
      box.calls.push({ path: req.url, action, ext: arg('NewExternalPort'), lease: arg('NewLeaseDuration'), client: arg('NewInternalClient'), port: arg('NewInternalPort') });
      if (req.url === '/ctl/PPP') { fault(res, 401, 'Invalid Action'); return; } // service PPP inutilisé sur cette box
      if (action === 'GetExternalIPAddress') { ok(res, `<u:R><NewExternalIPAddress>${opts.wan ?? '86.245.10.3'}</NewExternalIPAddress></u:R>`); return; }
      if (action === 'AddPortMapping') {
        const ext = +arg('NewExternalPort');
        if (opts.refuse) { fault(res, opts.refuse, 'Refus'); return; }
        if (opts.permanent && arg('NewLeaseDuration') !== '0') { fault(res, 725, 'OnlyPermanentLeasesSupported'); return; }
        if ((opts.taken || []).includes(ext)) { fault(res, 718, 'ConflictInMappingEntry'); return; }
        box.maps.set(ext, { client: arg('NewInternalClient'), port: +arg('NewInternalPort') }); ok(res); return;
      }
      if (action === 'GetSpecificPortMappingEntry') { const ext = +arg('NewExternalPort'); ok(res, `<u:R><NewInternalPort>${ext}</NewInternalPort><NewInternalClient>192.168.1.99</NewInternalClient></u:R>`); return; }
      if (action === 'DeletePortMapping') { box.maps.delete(+arg('NewExternalPort')); ok(res); return; }
      fault(res, 401, 'Invalid Action');
    });
  });
  servers.push(s);
  return new Promise((r) => s.listen(0, '127.0.0.1', () => { box.url = `http://127.0.0.1:${s.address().port}/rootDesc.xml`; r(box); }));
}
const gw = (box) => [{ location: box.url, local: '192.168.1.20' }];

test('box trouvée par SSDP (réponse en unicast, comme le fait une box)', async () => {
  const box = await fakeBox();
  const sock = dgram.createSocket('udp4'); servers.push({ close: () => sock.close() });
  sock.on('message', (m, from) => { if (/M-SEARCH/.test(String(m))) sock.send(`HTTP/1.1 200 OK\r\nLOCATION: ${box.url}\r\nST: upnp:rootdevice\r\n\r\n`, from.port, from.address); });
  await new Promise((r) => sock.bind(0, '127.0.0.1', r));
  const found = await discoverGateways({ addrs: ['127.0.0.1'], to: { host: '127.0.0.1', port: sock.address().port }, timeout: 800 });
  assert.deepEqual(found, [{ location: box.url, local: '127.0.0.1' }], 'une seule box, même si elle répond à chaque recherche');
});

test('port ouvert sur la box, renouvelé puis refermé', async () => {
  const box = await fakeBox();
  const m = await upnpOpen({ port: 8080, gateways: gw(box) });
  assert.equal(m.ok, true, m.why);
  assert.equal(m.extPort, 8080); assert.equal(m.wanIp, '86.245.10.3'); assert.equal(m.box, 'Fabricant Box 7 & fibre'); assert.equal(m.lease, 3600);
  assert.deepEqual(box.maps.get(8080), { client: '192.168.1.20', port: 8080 });
  assert.ok(!box.calls.some((c) => c.path === '/ctl/PPP'), 'le service WANIPConnection suffit');
  assert.equal(await upnpRenew(m), true);
  assert.equal(box.calls.filter((c) => c.action === 'AddPortMapping').length, 2);
  await upnpClose(m);
  assert.equal(box.maps.size, 0);
});

test('port extérieur déjà pris par un autre appareil : le suivant', async () => {
  const box = await fakeBox({ taken: [8080, 8081] });
  const m = await upnpOpen({ port: 8080, gateways: gw(box) });
  assert.equal(m.ok, true, m.why);
  assert.equal(m.extPort, 8082);
  assert.deepEqual(box.maps.get(8082), { client: '192.168.1.20', port: 8080 }, 'extérieur 8082 → cet ordinateur, port 8080');
});

test('box qui n\'accepte que des redirections permanentes', async () => {
  const box = await fakeBox({ permanent: true });
  const m = await upnpOpen({ port: 8080, gateways: gw(box) });
  assert.equal(m.ok, true, m.why);
  assert.equal(m.lease, 0);
});

test('box qui refuse : la raison en clair', async () => {
  const box = await fakeBox({ refuse: 606 });
  const m = await upnpOpen({ port: 8080, gateways: gw(box) });
  assert.equal(m.ok, false);
  assert.match(m.why, /refuse que les programmes ouvrent ses ports/);
  assert.equal(box.calls.filter((c) => c.action === 'AddPortMapping' && c.path === '/ctl/IPConn').length, 1, 'refus qui ne dépend pas du port : pas d\'autre essai');
  const none = await upnpOpen({ port: 8080, gateways: [] });
  assert.match(none.why, /aucune box UPnP/);
});

test('box qui n\'a qu\'une adresse privée (deux box en cascade) : adresse rendue telle quelle', async () => {
  const box = await fakeBox({ wan: '192.168.0.12' });
  const m = await upnpOpen({ port: 8080, gateways: gw(box) });
  assert.equal(m.ok, true);
  assert.equal(m.wanIp, '192.168.0.12');
  assert.ok(!isPublicV4(m.wanIp), 'le serveur saura que le lien direct ne marchera pas');
});
