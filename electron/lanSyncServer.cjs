'use strict';

const https = require('node:https');
const http = require('node:http');
const crypto = require('node:crypto');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const dgram = require('node:dgram');
const EventEmitter = require('node:events');

const DEFAULT_LAN_SYNC_PORT = 8765;
const UDP_DISCOVERY_PORT = 41234;
const MDNS_MULTICAST_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const MDNS_SERVICE_TYPE = '_glueck-sync._tcp.local';
const PROTOCOL_VERSION = 2;
const MIN_SUPPORTED_PROTOCOL_VERSION = 1;
const APP_VERSION = '3.0.0';
const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024; // 50 MB upper bound for sync deltas
const DEFAULT_PAIRING_TTL_MS = 180 * 1000; // 3 minutes
const MAX_PAIRING_FAILURES = 5;
const PAIRING_LOCKOUT_MS = 60 * 1000; // 60 seconds lockout after 5 bad codes

const DEFAULT_CAPABILITIES = [
  'core_entities',
  'settings_sync',
  'todos_sync',
  'heartbeat_presence',
  'diff_reports'
];

// ============================================================================
// Pure-Node DER / ASN.1 X.509 v3 Self-Signed ECDSA P-256 Certificate Generator
// ============================================================================

function derEncodeLength(len) {
  if (len < 0x80) return Buffer.from([len]);
  const bytes = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derTag(tag, contentBuf) {
  const content = Buffer.isBuffer(contentBuf) ? contentBuf : Buffer.from(contentBuf || []);
  return Buffer.concat([Buffer.from([tag]), derEncodeLength(content.length), content]);
}

function derSequence(items) {
  return derTag(0x30, Buffer.concat(items));
}

function derSet(items) {
  return derTag(0x31, Buffer.concat(items));
}

function derInteger(bufOrNum) {
  let buf;
  if (typeof bufOrNum === 'number') {
    if (bufOrNum === 0) return derTag(0x02, Buffer.from([0x00]));
    const bytes = [];
    let n = bufOrNum;
    while (n > 0) {
      bytes.unshift(n & 0xff);
      n >>= 8;
    }
    buf = Buffer.from(bytes);
  } else {
    buf = Buffer.from(bufOrNum);
  }
  // Strip leading zero bytes while preserving positive sign bit
  let start = 0;
  while (start < buf.length - 1 && buf[start] === 0 && (buf[start + 1] & 0x80) === 0) {
    start++;
  }
  buf = buf.subarray(start);
  if (buf[0] & 0x80) {
    buf = Buffer.concat([Buffer.from([0x00]), buf]);
  }
  return derTag(0x02, buf);
}

function derBitString(buf) {
  return derTag(0x03, Buffer.concat([Buffer.from([0x00]), buf]));
}

function derOctetString(buf) {
  return derTag(0x04, buf);
}

function derNull() {
  return Buffer.from([0x05, 0x00]);
}

function derOid(oidStr) {
  const parts = oidStr.split('.').map(Number);
  const out = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    if (val < 128) {
      out.push(val);
    } else {
      const stack = [];
      stack.push(val & 0x7f);
      val >>= 7;
      while (val > 0) {
        stack.push((val & 0x7f) | 0x80);
        val >>= 7;
      }
      while (stack.length > 0) out.push(stack.pop());
    }
  }
  return derTag(0x06, Buffer.from(out));
}

function derUtf8(str) {
  return derTag(0x0c, Buffer.from(String(str), 'utf8'));
}

function derGeneralizedTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const s =
    String(date.getUTCFullYear()).padStart(4, '0') +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z';
  return derTag(0x18, Buffer.from(s, 'ascii'));
}

function derExplicit(ctxTagNum, innerBuf) {
  return derTag(0xa0 + ctxTagNum, innerBuf);
}

function parseIpv4Bytes(ip) {
  const parts = String(ip || '').trim().split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return Buffer.from(nums);
}

function generateSelfSignedLanCert(sanIps = []) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1'
  });

  const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  const serial = crypto.randomBytes(16);
  serial[0] &= 0x7f; // Ensure positive ASN.1 integer

  const sigAlg = derSequence([derOid('1.2.840.10045.4.3.2')]); // ecdsa-with-SHA256

  // RDN: CN=Glueck LAN Sync Host, O=Glueck
  const nameSeq = derSequence([
    derSet([derSequence([derOid('2.5.4.10'), derUtf8('Glueck')])]),
    derSet([derSequence([derOid('2.5.4.3'), derUtf8('Glueck LAN Sync Host')])])
  ]);

  const now = new Date();
  const notBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const notAfter = new Date(now.getTime() + 3650 * 24 * 60 * 60 * 1000); // ~10 years
  const validity = derSequence([derGeneralizedTime(notBefore), derGeneralizedTime(notAfter)]);

  // Build SubjectAlternativeName entries: DNS localhost + IPv4 127.0.0.1 + all detected LAN IPs
  const uniqueIps = Array.from(new Set(['127.0.0.1', ...sanIps])).filter((ip) => parseIpv4Bytes(ip));
  const sanEntries = [
    derTag(0x82, Buffer.from('localhost', 'ascii')),
    ...uniqueIps.map((ip) => derTag(0x87, parseIpv4Bytes(ip)))
  ];

  // Extensions: BasicConstraints (CA:FALSE), KeyUsage (digitalSignature, keyEncipherment),
  // ExtendedKeyUsage (serverAuth), SubjectAltName
  const extBasicConstraints = derSequence([
    derOid('2.5.29.19'),
    Buffer.from([0x01, 0x01, 0xff]), // critical = TRUE
    derOctetString(derSequence([]))
  ]);
  const extKeyUsage = derSequence([
    derOid('2.5.29.15'),
    Buffer.from([0x01, 0x01, 0xff]),
    derOctetString(derTag(0x03, Buffer.from([0x05, 0xa0]))) // digitalSignature | keyEncipherment
  ]);
  const extEku = derSequence([
    derOid('2.5.29.37'),
    derOctetString(derSequence([derOid('1.3.6.1.5.5.7.3.1')])) // id-kp-serverAuth
  ]);
  const extSan = derSequence([
    derOid('2.5.29.17'),
    derOctetString(derSequence(sanEntries))
  ]);

  const extensions = derExplicit(
    3,
    derSequence([extBasicConstraints, extKeyUsage, extEku, extSan])
  );

  const tbsCertificate = derSequence([
    derExplicit(0, derInteger(2)), // v3
    derInteger(serial),
    sigAlg,
    nameSeq,
    validity,
    nameSeq,
    spkiDer,
    extensions
  ]);

  const signature = crypto.sign('sha256', tbsCertificate, privateKey);
  const fullCertDer = derSequence([tbsCertificate, sigAlg, derBitString(signature)]);

  const b64 = fullCertDer.toString('base64');
  const lines = b64.match(/.{1,64}/g) || [];
  const certPem = `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;

  const x509 = new crypto.X509Certificate(certPem);
  const fingerprintSha256 = x509.fingerprint256.replace(/:/g, '').toLowerCase();

  return {
    certPem,
    keyPem,
    fingerprintSha256,
    sanIps: uniqueIps,
    createdAt: Date.now()
  };
}

function formatVerificationCode(fingerprintSha256) {
  const clean = String(fingerprintSha256 || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (clean.length < 8) return '0000:0000';
  return `${clean.slice(0, 4)}:${clean.slice(4, 8)}`;
}

// ============================================================================
// OS Network Interface Enumeration
// ============================================================================

const VIRTUAL_INTERFACE_PATTERN = /^(lo|docker\d*|br-[0-9a-f]+|veth[0-9a-f]+|virbr\d*|vmnet\d*|vboxnet\d*|tun\d*|tap\d*|wg\d*|tailscale\d*|utun\d*|wsl)/i;

function scoreInterface(name, ip) {
  let score = 0;
  if (VIRTUAL_INTERFACE_PATTERN.test(name)) score -= 100;
  if (/^(wl|wlan|wifi|wi-fi|en0|eth|enp|eno|ens|ethernet)/i.test(name)) score += 50;
  // Standard private RFC1918 subnets preferred over carrier-grade/APIPA
  if (ip.startsWith('192.168.')) score += 40;
  else if (ip.startsWith('10.')) score += 30;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) score += 20;
  else if (ip.startsWith('169.254.')) score -= 60; // Link-local APIPA fallback
  return score;
}

function enumerateLanIpv4Interfaces() {
  const ifaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, list] of Object.entries(ifaces || {})) {
    if (!Array.isArray(list)) continue;
    for (const info of list) {
      if (!info) continue;
      const isIpv4 = info.family === 'IPv4' || info.family === 4;
      if (!isIpv4 || info.internal) continue;
      if (!info.address || info.address === '127.0.0.1') continue;
      candidates.push({
        interfaceName: name,
        address: info.address,
        netmask: info.netmask || '255.255.255.0',
        cidr: info.cidr || null,
        score: scoreInterface(name, info.address),
        isVirtual: VIRTUAL_INTERFACE_PATTERN.test(name)
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const nonVirtual = candidates.filter((c) => !c.isVirtual);
  const preferredList = nonVirtual.length > 0 ? nonVirtual : candidates;
  const addresses = Array.from(new Set(preferredList.map((c) => c.address)));

  return {
    addresses,
    primaryIp: addresses[0] || null,
    interfaces: candidates
  };
}

function computeBroadcastAddresses(interfaces) {
  const broadcasts = new Set(['255.255.255.255']);
  for (const iface of interfaces || []) {
    const ipBytes = parseIpv4Bytes(iface.address);
    const maskBytes = parseIpv4Bytes(iface.netmask);
    if (!ipBytes || !maskBytes) continue;
    const bcast = Buffer.alloc(4);
    for (let i = 0; i < 4; i++) {
      bcast[i] = (ipBytes[i] | (~maskBytes[i] & 0xff)) & 0xff;
    }
    broadcasts.add(`${bcast[0]}.${bcast[1]}.${bcast[2]}.${bcast[3]}`);
  }
  return Array.from(broadcasts);
}

// ============================================================================
// Lightweight mDNS DNS Wire Builder for _glueck-sync._tcp.local
// ============================================================================

function encodeDnsName(name) {
  const parts = String(name || '').replace(/\.$/, '').split('.').filter(Boolean);
  const chunks = parts.map((label) => {
    const buf = Buffer.from(label, 'utf8');
    return Buffer.concat([Buffer.from([buf.length]), buf]);
  });
  chunks.push(Buffer.from([0x00]));
  return Buffer.concat(chunks);
}

function decodeDnsName(packet, offset) {
  const labels = [];
  let pos = offset;
  let jumped = false;
  let nextOffset = offset;
  let safety = 0;

  while (pos < packet.length && safety++ < 64) {
    const len = packet[pos];
    if (len === 0) {
      if (!jumped) nextOffset = pos + 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      if (pos + 1 >= packet.length) break;
      const ptr = ((len & 0x3f) << 8) | packet[pos + 1];
      if (!jumped) nextOffset = pos + 2;
      jumped = true;
      pos = ptr;
      continue;
    }
    pos += 1;
    if (pos + len > packet.length) break;
    labels.push(packet.subarray(pos, pos + len).toString('utf8'));
    pos += len;
    if (!jumped) nextOffset = pos;
  }

  return { name: labels.join('.'), nextOffset };
}

function buildDnsResourceRecord(name, type, rrClass, ttl, rdataBuf) {
  const header = Buffer.alloc(10);
  header.writeUInt16BE(type, 0);
  header.writeUInt16BE(rrClass, 2);
  header.writeUInt32BE(ttl, 4);
  header.writeUInt16BE(rdataBuf.length, 8);
  return Buffer.concat([encodeDnsName(name), header, rdataBuf]);
}

function buildMdnsAnnouncementPacket({ deviceId, deviceName, primaryIp, port, certFingerprintSha256 }) {
  if (!primaryIp || !port) return null;
  const ipBytes = parseIpv4Bytes(primaryIp);
  if (!ipBytes) return null;

  const safeLabel = String(deviceId || 'glueck-host').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'glueck-host';
  const instanceName = `glueck-${safeLabel}.${MDNS_SERVICE_TYPE}`;
  const hostTarget = `glueck-${safeLabel}.local`;

  const txtEntries = [
    `id=${deviceId}`,
    `name=${String(deviceName || 'Glueck PC').slice(0, 48)}`,
    `v=${PROTOCOL_VERSION}`,
    `tls=1`,
    `fp=${String(certFingerprintSha256 || '').slice(0, 64)}`
  ];
  const txtBuf = Buffer.concat(
    txtEntries.map((entry) => {
      const b = Buffer.from(entry, 'utf8').subarray(0, 255);
      return Buffer.concat([Buffer.from([b.length]), b]);
    })
  );

  // SRV rdata: priority(2), weight(2), port(2), target
  const srvHead = Buffer.alloc(6);
  srvHead.writeUInt16BE(0, 0);
  srvHead.writeUInt16BE(0, 2);
  srvHead.writeUInt16BE(port, 4);
  const srvRdata = Buffer.concat([srvHead, encodeDnsName(hostTarget)]);

  const ptrRdata = encodeDnsName(instanceName);

  // DNS Header: id=0, flags=0x8400 (Response + Authoritative), qd=0, an=4
  const hdr = Buffer.alloc(12);
  hdr.writeUInt16BE(0, 0);
  hdr.writeUInt16BE(0x8400, 2);
  hdr.writeUInt16BE(0, 4);
  hdr.writeUInt16BE(4, 6);
  hdr.writeUInt16BE(0, 8);
  hdr.writeUInt16BE(0, 10);

  return Buffer.concat([
    hdr,
    buildDnsResourceRecord(MDNS_SERVICE_TYPE, 12 /* PTR */, 1, 120, ptrRdata),
    buildDnsResourceRecord(instanceName, 33 /* SRV */, 0x8001, 120, srvRdata),
    buildDnsResourceRecord(instanceName, 16 /* TXT */, 0x8001, 120, txtBuf),
    buildDnsResourceRecord(hostTarget, 1 /* A */, 0x8001, 120, ipBytes)
  ]);
}

function constantTimeStringEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) {
    // Burn comparable time before returning false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ============================================================================
// Main LAN Sync Host Controller
// ============================================================================

class LanSyncHostController extends EventEmitter {
  constructor(options = {}) {
    super();
    this.storageDir = options.storageDir || null;
    this.safeStorage = options.safeStorage || null;
    this.logger = options.logger || console;
    this.useTls = options.useTls !== false; // HTTPS by default; plain HTTP only if explicitly opted out in harness
    this.port = Number(options.port) > 0 ? Number(options.port) : DEFAULT_LAN_SYNC_PORT;
    this.pairingTtlMs = Number(options.pairingTtlMs) > 0 ? Number(options.pairingTtlMs) : DEFAULT_PAIRING_TTL_MS;
    this.maxPayloadBytes = Number(options.maxPayloadBytes) > 0 ? Number(options.maxPayloadBytes) : MAX_PAYLOAD_BYTES;

    this.localDeviceId = options.localDeviceId || 'dev_pc_host';
    this.localDeviceName = options.localDeviceName || `Glück on ${os.hostname()}`;

    // Runtime state
    this.server = null;
    this.udpSocket = null;
    this.mdnsSocket = null;
    this.interfaceMonitorTimer = null;
    this.isListening = false;
    this.bindError = null;
    this.lastErrorCode = null;

    // Network interfaces
    this.networkInfo = { addresses: [], primaryIp: null, interfaces: [] };

    // TLS Identity
    this.tlsIdentity = null;

    // Pairing PIN state (never logged in plaintext!)
    this.activePairingPin = null;
    this.pairingExpiresAt = 0;
    this.failedPairingAttempts = 0;
    this.lockoutUntil = 0;

    // Encrypted Vault of Paired Peer Auth Tokens (deviceId -> { deviceId, deviceName, authToken, pairedAt, lastSeenIp, lastHeartbeat, protocolVersion, capabilities })
    this.pairedPeersMap = new Map();

    // Pluggable RPC handlers bridged to Renderer IndexedDB/Storage
    this.rpcHandlers = {
      onExchangeRequest: options.onExchangeRequest || null,
      onPageImageManifest: options.onPageImageManifest || null,
      onPageImageChunk: options.onPageImageChunk || null
    };
  }

  setRpcHandlers(handlers = {}) {
    if (typeof handlers.onExchangeRequest === 'function') {
      this.rpcHandlers.onExchangeRequest = handlers.onExchangeRequest;
    }
    if (typeof handlers.onPageImageManifest === 'function') {
      this.rpcHandlers.onPageImageManifest = handlers.onPageImageManifest;
    }
    if (typeof handlers.onPageImageChunk === 'function') {
      this.rpcHandlers.onPageImageChunk = handlers.onPageImageChunk;
    }
  }

  getVaultFilePath() {
    if (!this.storageDir) return null;
    return path.join(this.storageDir, 'lan-sync-vault.enc');
  }

  getCertFilePath() {
    if (!this.storageDir) return null;
    return path.join(this.storageDir, 'lan-sync-tls.enc');
  }

  _canUseSafeStorage() {
    try {
      return Boolean(
        this.safeStorage &&
          typeof this.safeStorage.isEncryptionAvailable === 'function' &&
          this.safeStorage.isEncryptionAvailable()
      );
    } catch {
      return false;
    }
  }

  _writeSecureJson(filePath, obj) {
    if (!filePath) return;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const rawJson = JSON.stringify(obj);
      if (this._canUseSafeStorage()) {
        const encBuf = this.safeStorage.encryptString(rawJson);
        fs.writeFileSync(filePath, Buffer.concat([Buffer.from('ENC1:'), encBuf]), { mode: 0o600 });
      } else {
        // Headless Linux fallback without keyring: file mode 0600 (owner-only read/write)
        fs.writeFileSync(filePath, rawJson, { encoding: 'utf8', mode: 0o600 });
      }
    } catch (err) {
      this.logger.warn('[LanSyncHost] Failed to persist secure file:', err?.message);
    }
  }

  _readSecureJson(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      const rawBuf = fs.readFileSync(filePath);
      if (!rawBuf || rawBuf.length === 0) return null;
      const prefix = rawBuf.subarray(0, 5).toString('ascii');
      if (prefix === 'ENC1:') {
        if (!this._canUseSafeStorage()) return null;
        const decrypted = this.safeStorage.decryptString(rawBuf.subarray(5));
        return JSON.parse(decrypted);
      }
      return JSON.parse(rawBuf.toString('utf8'));
    } catch {
      return null;
    }
  }

  _loadVault() {
    const data = this._readSecureJson(this.getVaultFilePath());
    if (data && Array.isArray(data.peers)) {
      this.pairedPeersMap.clear();
      for (const p of data.peers) {
        if (p && p.deviceId && p.authToken) {
          this.pairedPeersMap.set(p.deviceId, p);
        }
      }
    }
  }

  _saveVault() {
    const peers = Array.from(this.pairedPeersMap.values());
    this._writeSecureJson(this.getVaultFilePath(), {
      updatedAt: Date.now(),
      peers
    });
  }

  _ensureTlsIdentity(currentAddresses) {
    const certPath = this.getCertFilePath();
    if (!this.tlsIdentity) {
      const stored = this._readSecureJson(certPath);
      if (stored && stored.certPem && stored.keyPem && stored.fingerprintSha256) {
        this.tlsIdentity = stored;
      }
    }

    const sortedNew = [...(currentAddresses || [])].sort().join(',');
    const existingSans = Array.isArray(this.tlsIdentity?.sanIps)
      ? this.tlsIdentity.sanIps.filter((ip) => ip !== '127.0.0.1').sort().join(',')
      : '';

    if (!this.tlsIdentity || sortedNew !== existingSans) {
      this.tlsIdentity = generateSelfSignedLanCert(currentAddresses || []);
      this._writeSecureJson(certPath, this.tlsIdentity);
    }

    return this.tlsIdentity;
  }

  generatePairingCode(ttlMs = this.pairingTtlMs) {
    const code = String(crypto.randomInt(100000, 1000000));
    this.activePairingPin = code;
    this.pairingExpiresAt = Date.now() + Math.max(15000, ttlMs || DEFAULT_PAIRING_TTL_MS);
    this.failedPairingAttempts = 0;
    this.lockoutUntil = 0;
    this.emit('status-changed', this.getStatus());
    return {
      pairingCode: code,
      expiresAt: this.pairingExpiresAt
    };
  }

  revokePairingCode() {
    this.activePairingPin = null;
    this.pairingExpiresAt = 0;
    this.emit('status-changed', this.getStatus());
  }

  listPairedPeers() {
    // Returns safe metadata ONLY (never returns raw authToken to renderer)
    return Array.from(this.pairedPeersMap.values()).map((p) => ({
      deviceId: p.deviceId,
      deviceName: p.deviceName,
      pairedAt: p.pairedAt,
      lastSeenIp: p.lastSeenIp || null,
      lastHeartbeat: p.lastHeartbeat || 0,
      protocolVersion: p.protocolVersion || PROTOCOL_VERSION,
      capabilities: p.capabilities || DEFAULT_CAPABILITIES,
      hasStoredAuthToken: Boolean(p.authToken)
    }));
  }

  revokePairedPeer(peerDeviceId) {
    const existed = this.pairedPeersMap.delete(String(peerDeviceId || '').trim());
    if (existed) {
      this._saveVault();
      this.emit('peer-revoked', { deviceId: peerDeviceId });
      this.emit('status-changed', this.getStatus());
    }
    return existed;
  }

  hasPairedPeerToken(peerDeviceId) {
    return this.pairedPeersMap.has(String(peerDeviceId || '').trim());
  }

  _authenticateRequest(req) {
    const authHeader = String(req.headers['authorization'] || '');
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return { ok: false, peer: null };
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return { ok: false, peer: null };
    }

    let matchedPeer = null;
    for (const peer of this.pairedPeersMap.values()) {
      if (peer.authToken && constantTimeStringEqual(peer.authToken, token)) {
        matchedPeer = peer;
        break;
      }
    }

    if (!matchedPeer) {
      return { ok: false, peer: null };
    }

    // Extract clean remote IPv4
    const rawAddr = String(req.socket?.remoteAddress || '');
    const remoteIp = rawAddr.startsWith('::ffff:') ? rawAddr.slice(7) : rawAddr;
    if (remoteIp) {
      matchedPeer.lastSeenIp = remoteIp;
    }
    matchedPeer.lastHeartbeat = Date.now();
    return { ok: true, peer: matchedPeer };
  }

  _sendJson(res, statusCode, payload) {
    const body = JSON.stringify({
      protocolVersion: PROTOCOL_VERSION,
      minSupportedVersion: MIN_SUPPORTED_PROTOCOL_VERSION,
      appVersion: APP_VERSION,
      ...payload
    });
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Glueck-Sync-Protocol': String(PROTOCOL_VERSION),
      'Cache-Control': 'no-store'
    });
    res.end(body);
  }

  _readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let bytes = 0;
      const chunks = [];
      let aborted = false;

      req.on('data', (chunk) => {
        if (aborted) return;
        bytes += chunk.length;
        if (bytes > this.maxPayloadBytes) {
          aborted = true;
          const err = new Error(`Payload exceeds maximum limit of ${this.maxPayloadBytes} bytes.`);
          err.statusCode = 413;
          err.errorCode = 'INVALID_PAYLOAD';
          reject(err);
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (aborted) return;
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        if (!raw) {
          resolve({});
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            const err = new Error('Request body must be a JSON object.');
            err.statusCode = 400;
            err.errorCode = 'INVALID_PAYLOAD';
            reject(err);
            return;
          }
          resolve(parsed);
        } catch {
          const err = new Error('Malformed JSON payload.');
          err.statusCode = 400;
          err.errorCode = 'INVALID_PAYLOAD';
          reject(err);
        }
      });

      req.on('error', (err) => {
        if (aborted) return;
        reject(err);
      });
    });
  }

  _validateProtocolCompatibility(headerOrVersion) {
    if (headerOrVersion === undefined || headerOrVersion === null) return { ok: true };
    const version =
      typeof headerOrVersion === 'number'
        ? headerOrVersion
        : typeof headerOrVersion?.protocolVersion === 'number'
        ? headerOrVersion.protocolVersion
        : PROTOCOL_VERSION;
    const minSupported =
      typeof headerOrVersion?.minSupportedVersion === 'number'
        ? headerOrVersion.minSupportedVersion
        : 1;

    if (version < MIN_SUPPORTED_PROTOCOL_VERSION || PROTOCOL_VERSION < minSupported) {
      return {
        ok: false,
        message: `Protocol mismatch: remote v${version} (min v${minSupported}) vs host v${PROTOCOL_VERSION}.`
      };
    }
    return { ok: true };
  }

  async _handleHttpRequest(req, res) {
    const reqUrl = String(req.url || '/').split('?')[0];
    const method = String(req.method || 'GET').toUpperCase();

    try {
      // 1. GET /api/sync/health (unauthenticated discovery/liveness check; NEVER returns PIN)
      if (method === 'GET' && reqUrl === '/api/sync/health') {
        const now = Date.now();
        return this._sendJson(res, 200, {
          ok: true,
          service: 'glueck-lan-sync',
          deviceId: this.localDeviceId,
          deviceName: this.localDeviceName,
          addresses: this.networkInfo.addresses,
          primaryIp: this.networkInfo.primaryIp,
          port: this.port,
          tlsEnabled: this.useTls,
          certFingerprintSha256: this.tlsIdentity?.fingerprintSha256 || null,
          verificationCode: this.tlsIdentity ? formatVerificationCode(this.tlsIdentity.fingerprintSha256) : null,
          capabilities: DEFAULT_CAPABILITIES,
          pairingActive: Boolean(this.activePairingPin && now < this.pairingExpiresAt),
          pairingExpiresAt: this.activePairingPin ? this.pairingExpiresAt : 0,
          pairingLockedOut: now < this.lockoutUntil,
          lockoutRemainingMs: Math.max(0, this.lockoutUntil - now),
          serverTime: now
        });
      }

      // 2. POST /api/sync/pair (validated by short-lived, single-use, rate-limited pairing code)
      if (method === 'POST' && reqUrl === '/api/sync/pair') {
        const body = await this._readJsonBody(req);
        const now = Date.now();

        if (now < this.lockoutUntil) {
          return this._sendJson(res, 429, {
            ok: false,
            errorCode: 'PAIRING_LOCKED_OUT',
            message: 'Too many invalid pairing attempts. Please wait before trying again.',
            retryAfterMs: this.lockoutUntil - now
          });
        }

        if (!this.activePairingPin) {
          return this._sendJson(res, 401, {
            ok: false,
            errorCode: 'PAIRING_CODE_INVALID',
            message: 'No active pairing code on host. Generate a new pairing code on PC first.'
          });
        }

        if (now > this.pairingExpiresAt) {
          this.activePairingPin = null;
          this.emit('status-changed', this.getStatus());
          return this._sendJson(res, 410, {
            ok: false,
            errorCode: 'PAIRING_CODE_EXPIRED',
            message: 'Pairing code expired. Generate a new pairing code on PC.'
          });
        }

        const protoCheck = this._validateProtocolCompatibility(body.header || body.protocolVersion);
        if (!protoCheck.ok) {
          return this._sendJson(res, 426, {
            ok: false,
            errorCode: 'PROTOCOL_VERSION_MISMATCH',
            message: protoCheck.message
          });
        }

        const submittedCode = String(body.pairingCode || '').trim();
        if (!submittedCode || !constantTimeStringEqual(submittedCode, this.activePairingPin)) {
          this.failedPairingAttempts += 1;
          if (this.failedPairingAttempts >= MAX_PAIRING_FAILURES) {
            this.lockoutUntil = now + PAIRING_LOCKOUT_MS;
            this.emit('status-changed', this.getStatus());
            return this._sendJson(res, 429, {
              ok: false,
              errorCode: 'PAIRING_LOCKED_OUT',
              message: 'Pairing temporarily locked due to repeated invalid codes.',
              retryAfterMs: PAIRING_LOCKOUT_MS
            });
          }
          return this._sendJson(res, 401, {
            ok: false,
            errorCode: 'PAIRING_CODE_INVALID',
            message: 'Invalid pairing code.',
            attemptsRemaining: MAX_PAIRING_FAILURES - this.failedPairingAttempts
          });
        }

        const clientDeviceId = String(body.clientDeviceId || body.deviceId || '').trim();
        const clientDeviceName = String(body.clientDeviceName || body.deviceName || 'Android Device').trim().slice(0, 80);
        if (!clientDeviceId || clientDeviceId.length < 3 || clientDeviceId.length > 128) {
          return this._sendJson(res, 400, {
            ok: false,
            errorCode: 'INVALID_PAYLOAD',
            message: 'clientDeviceId is required for pairing.'
          });
        }

        // Single-use pairing code consumed immediately upon success
        this.activePairingPin = null;
        this.pairingExpiresAt = 0;
        this.failedPairingAttempts = 0;

        // Cryptographically strong authentication token (256-bit random)
        const authToken = crypto.randomBytes(32).toString('base64url');
        const rawAddr = String(req.socket?.remoteAddress || '');
        const remoteIp = rawAddr.startsWith('::ffff:') ? rawAddr.slice(7) : rawAddr;

        const remoteHeader = body.header || {};
        const agreedCapabilities = Array.isArray(remoteHeader.capabilities)
          ? DEFAULT_CAPABILITIES.filter((c) => remoteHeader.capabilities.includes(c))
          : DEFAULT_CAPABILITIES;
        const negotiatedVersion =
          typeof remoteHeader.protocolVersion === 'number'
            ? Math.min(PROTOCOL_VERSION, remoteHeader.protocolVersion)
            : PROTOCOL_VERSION;

        const peerRecord = {
          deviceId: clientDeviceId,
          deviceName: clientDeviceName || 'Companion Device',
          authToken,
          pairedAt: now,
          lastSeenIp: remoteIp || null,
          lastHeartbeat: now,
          protocolVersion: negotiatedVersion,
          capabilities: agreedCapabilities.length > 0 ? agreedCapabilities : ['core_entities']
        };

        this.pairedPeersMap.set(clientDeviceId, peerRecord);
        this._saveVault();

        const safePeer = {
          deviceId: peerRecord.deviceId,
          deviceName: peerRecord.deviceName,
          pairedAt: peerRecord.pairedAt,
          lastSeenIp: peerRecord.lastSeenIp,
          protocolVersion: peerRecord.protocolVersion,
          capabilities: peerRecord.capabilities,
          hasStoredAuthToken: true
        };
        this.emit('peer-paired', safePeer);
        this.emit('status-changed', this.getStatus());

        return this._sendJson(res, 200, {
          ok: true,
          authToken,
          hostDeviceId: this.localDeviceId,
          hostDeviceName: this.localDeviceName,
          port: this.port,
          addresses: this.networkInfo.addresses,
          negotiatedVersion,
          agreedCapabilities: peerRecord.capabilities,
          certFingerprintSha256: this.tlsIdentity?.fingerprintSha256 || null,
          serverTime: now
        });
      }

      // All remaining endpoints require valid Bearer authentication
      const auth = this._authenticateRequest(req);
      if (!auth.ok || !auth.peer) {
        return this._sendJson(res, 401, {
          ok: false,
          errorCode: 'UNAUTHORIZED_DEVICE',
          message: 'Device authentication failed or trust was revoked. Re-pair required.'
        });
      }

      // 3. GET /api/sync/status
      if (method === 'GET' && reqUrl === '/api/sync/status') {
        const s = this.getStatus();
        return this._sendJson(res, 200, {
          ok: true,
          deviceId: this.localDeviceId,
          deviceName: this.localDeviceName,
          listening: s.listening,
          port: s.port,
          addresses: s.addresses,
          primaryIp: s.primaryIp,
          pairedCount: this.pairedPeersMap.size,
          capabilities: DEFAULT_CAPABILITIES,
          serverTime: Date.now()
        });
      }

      // 4. POST /api/sync/heartbeat
      if (method === 'POST' && reqUrl === '/api/sync/heartbeat') {
        const body = await this._readJsonBody(req);
        const protoCheck = this._validateProtocolCompatibility(body.header || body.protocolVersion);
        if (!protoCheck.ok) {
          return this._sendJson(res, 426, {
            ok: false,
            errorCode: 'PROTOCOL_VERSION_MISMATCH',
            message: protoCheck.message
          });
        }
        return this._sendJson(res, 200, {
          ok: true,
          deviceId: this.localDeviceId,
          deviceName: this.localDeviceName,
          capabilities: auth.peer.capabilities || DEFAULT_CAPABILITIES,
          addresses: this.networkInfo.addresses,
          primaryIp: this.networkInfo.primaryIp,
          port: this.port,
          serverTime: Date.now()
        });
      }

      // 5. POST /api/sync/exchange
      if (method === 'POST' && reqUrl === '/api/sync/exchange') {
        const body = await this._readJsonBody(req);
        const inboundDelta = body.delta || body.outboundDelta || body;
        if (
          !inboundDelta ||
          typeof inboundDelta !== 'object' ||
          !inboundDelta.records ||
          typeof inboundDelta.records !== 'object'
        ) {
          return this._sendJson(res, 400, {
            ok: false,
            errorCode: 'INVALID_PAYLOAD',
            message: 'Sync delta payload must include a valid records object.'
          });
        }

        const protoCheck = this._validateProtocolCompatibility(inboundDelta.header);
        if (!protoCheck.ok) {
          return this._sendJson(res, 426, {
            ok: false,
            errorCode: 'PROTOCOL_VERSION_MISMATCH',
            message: protoCheck.message
          });
        }

        // Bind senderDeviceId to authenticated peer identity to prevent spoofing
        inboundDelta.senderDeviceId = auth.peer.deviceId;
        inboundDelta.senderDeviceName = auth.peer.deviceName || inboundDelta.senderDeviceName;

        if (!this.rpcHandlers.onExchangeRequest) {
          return this._sendJson(res, 503, {
            ok: false,
            errorCode: 'STORAGE_SAVE_FAILED',
            message: 'Host sync storage handler is not ready yet.'
          });
        }

        try {
          const outboundDelta = await this.rpcHandlers.onExchangeRequest(inboundDelta, auth.peer);
          if (!outboundDelta || !outboundDelta.records) {
            return this._sendJson(res, 500, {
              ok: false,
              errorCode: 'STORAGE_SAVE_FAILED',
              message: 'Host failed to commit or build response delta.'
            });
          }
          auth.peer.lastHeartbeat = Date.now();
          return this._sendJson(res, 200, {
            ok: true,
            delta: outboundDelta,
            serverTime: Date.now()
          });
        } catch (storageErr) {
          return this._sendJson(res, 500, {
            ok: false,
            errorCode: 'STORAGE_SAVE_FAILED',
            message: storageErr?.message || 'Host storage save failed during exchange.'
          });
        }
      }

      // 6. POST /api/sync/page-images/manifest
      if (method === 'POST' && reqUrl === '/api/sync/page-images/manifest') {
        const body = await this._readJsonBody(req);
        if (!this.rpcHandlers.onPageImageManifest) {
          return this._sendJson(res, 200, { ok: true, availableImages: [] });
        }
        const manifest = await this.rpcHandlers.onPageImageManifest(body, auth.peer);
        return this._sendJson(res, 200, {
          ok: true,
          availableImages: Array.isArray(manifest?.availableImages) ? manifest.availableImages : []
        });
      }

      // 7. POST /api/sync/page-images/chunk
      if (method === 'POST' && reqUrl === '/api/sync/page-images/chunk') {
        const body = await this._readJsonBody(req);
        if (!this.rpcHandlers.onPageImageChunk) {
          return this._sendJson(res, 404, {
            ok: false,
            errorCode: 'INVALID_PAYLOAD',
            message: 'Page image chunk endpoint unavailable.'
          });
        }
        const chunk = await this.rpcHandlers.onPageImageChunk(body, auth.peer);
        return this._sendJson(res, 200, { ok: true, chunk });
      }

      return this._sendJson(res, 404, {
        ok: false,
        errorCode: 'INVALID_PAYLOAD',
        message: `Unknown sync endpoint: ${method} ${reqUrl}`
      });
    } catch (err) {
      const status = err?.statusCode || 500;
      const errorCode = err?.errorCode || 'INVALID_PAYLOAD';
      return this._sendJson(res, status, {
        ok: false,
        errorCode,
        message: err?.message || 'Unexpected server error.'
      });
    }
  }

  _startDiscoveryResponders() {
    this._stopDiscoveryResponders();

    // 1. UDP Broadcast / Unicast LAN Discovery Responder (port 41234)
    try {
      const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      udp.on('error', (err) => {
        this.logger.warn('[LanSyncHost] UDP discovery responder notice:', err?.message);
      });
      udp.on('message', (msg, rinfo) => {
        try {
          const text = msg.toString('utf8').trim();
          if (!text.startsWith('GLUECK_DISCOVER_V1')) return;
          const reply = JSON.stringify({
            service: 'glueck-lan-sync',
            deviceId: this.localDeviceId,
            deviceName: this.localDeviceName,
            addresses: this.networkInfo.addresses,
            primaryIp: this.networkInfo.primaryIp,
            port: this.port,
            protocolVersion: PROTOCOL_VERSION,
            tlsEnabled: this.useTls,
            certFingerprintSha256: this.tlsIdentity?.fingerprintSha256 || null,
            verificationCode: this.tlsIdentity ? formatVerificationCode(this.tlsIdentity.fingerprintSha256) : null,
            pairingActive: Boolean(this.activePairingPin && Date.now() < this.pairingExpiresAt)
          });
          const buf = Buffer.from(reply, 'utf8');
          udp.send(buf, 0, buf.length, rinfo.port, rinfo.address, () => {});
        } catch {}
      });
      udp.bind(UDP_DISCOVERY_PORT, '0.0.0.0', () => {
        try {
          udp.setBroadcast(true);
        } catch {}
      });
      this.udpSocket = udp;
    } catch (err) {
      this.logger.warn('[LanSyncHost] Could not bind UDP discovery socket:', err?.message);
    }

    // 2. mDNS Responder (224.0.0.251:5353) for Android NsdManager compatibility
    try {
      const mdns = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      mdns.on('error', () => {});
      mdns.on('message', (msg, rinfo) => {
        try {
          if (msg.length < 12) return;
          const flags = msg.readUInt16BE(2);
          if ((flags & 0x8000) !== 0) return; // Ignore responses, only answer queries
          const qdCount = msg.readUInt16BE(4);
          let offset = 12;
          let matchedService = false;
          for (let i = 0; i < qdCount && offset < msg.length; i++) {
            const { name, nextOffset } = decodeDnsName(msg, offset);
            offset = nextOffset + 4;
            const lower = name.toLowerCase();
            if (lower === MDNS_SERVICE_TYPE || lower.endsWith(`.${MDNS_SERVICE_TYPE}`) || lower === '_services._dns-sd._udp.local') {
              matchedService = true;
              break;
            }
          }
          if (!matchedService) return;
          const packet = buildMdnsAnnouncementPacket({
            deviceId: this.localDeviceId,
            deviceName: this.localDeviceName,
            primaryIp: this.networkInfo.primaryIp,
            port: this.port,
            certFingerprintSha256: this.tlsIdentity?.fingerprintSha256
          });
          if (!packet) return;
          mdns.send(packet, 0, packet.length, rinfo.port === MDNS_PORT ? MDNS_PORT : rinfo.port, MDNS_MULTICAST_ADDR, () => {});
          if (rinfo.address && rinfo.port !== MDNS_PORT) {
            mdns.send(packet, 0, packet.length, rinfo.port, rinfo.address, () => {});
          }
        } catch {}
      });
      mdns.bind(MDNS_PORT, '0.0.0.0', () => {
        try {
          mdns.addMembership(MDNS_MULTICAST_ADDR);
          mdns.setMulticastTTL(255);
          const packet = buildMdnsAnnouncementPacket({
            deviceId: this.localDeviceId,
            deviceName: this.localDeviceName,
            primaryIp: this.networkInfo.primaryIp,
            port: this.port,
            certFingerprintSha256: this.tlsIdentity?.fingerprintSha256
          });
          if (packet) {
            mdns.send(packet, 0, packet.length, MDNS_PORT, MDNS_MULTICAST_ADDR, () => {});
          }
        } catch {}
      });
      this.mdnsSocket = mdns;
    } catch {
      // Non-fatal if another mDNS daemon occupies multicast options on some OS setups; UDP discovery stays active
    }
  }

  _stopDiscoveryResponders() {
    if (this.udpSocket) {
      try { this.udpSocket.close(); } catch {}
      this.udpSocket = null;
    }
    if (this.mdnsSocket) {
      try { this.mdnsSocket.close(); } catch {}
      this.mdnsSocket = null;
    }
  }

  _startInterfaceMonitor() {
    this._stopInterfaceMonitor();
    this.interfaceMonitorTimer = setInterval(() => {
      const latest = enumerateLanIpv4Interfaces();
      const prevJoined = this.networkInfo.addresses.join(',');
      const nextJoined = latest.addresses.join(',');
      if (prevJoined !== nextJoined) {
        this.networkInfo = latest;
        if (this.useTls && this.server) {
          this._ensureTlsIdentity(latest.addresses);
          try {
            if (typeof this.server.setSecureContext === 'function') {
              this.server.setSecureContext({
                key: this.tlsIdentity.keyPem,
                cert: this.tlsIdentity.certPem
              });
            }
          } catch {}
        }
        const packet = buildMdnsAnnouncementPacket({
          deviceId: this.localDeviceId,
          deviceName: this.localDeviceName,
          primaryIp: this.networkInfo.primaryIp,
          port: this.port,
          certFingerprintSha256: this.tlsIdentity?.fingerprintSha256
        });
        if (packet && this.mdnsSocket) {
          try { this.mdnsSocket.send(packet, 0, packet.length, MDNS_PORT, MDNS_MULTICAST_ADDR, () => {}); } catch {}
        }
        this.emit('network-changed', this.getStatus());
        this.emit('status-changed', this.getStatus());
      }
    }, 5000);
    if (typeof this.interfaceMonitorTimer.unref === 'function') {
      this.interfaceMonitorTimer.unref();
    }
  }

  _stopInterfaceMonitor() {
    if (this.interfaceMonitorTimer) {
      clearInterval(this.interfaceMonitorTimer);
      this.interfaceMonitorTimer = null;
    }
  }

  async start(opts = {}) {
    if (opts.localDeviceId) this.localDeviceId = String(opts.localDeviceId);
    if (opts.localDeviceName) this.localDeviceName = String(opts.localDeviceName);
    const requestedPort = opts.port !== undefined ? Number(opts.port) : this.port;

    // Prevent duplicate server instances on the same port
    if (this.server && this.isListening && requestedPort === this.port) {
      this.networkInfo = enumerateLanIpv4Interfaces();
      if (!this.activePairingPin || Date.now() > this.pairingExpiresAt) {
        this.generatePairingCode();
      }
      return this.getStatus();
    }

    if (this.server) {
      await this.stop();
    }

    this.port = Number.isInteger(requestedPort) && requestedPort >= 0 && requestedPort <= 65535
      ? requestedPort
      : DEFAULT_LAN_SYNC_PORT;

    this._loadVault();
    this.networkInfo = enumerateLanIpv4Interfaces();
    if (this.useTls) {
      this._ensureTlsIdentity(this.networkInfo.addresses);
    }

    this.bindError = null;
    this.lastErrorCode = null;

    await new Promise((resolve, reject) => {
      const srv = this.useTls
        ? https.createServer({
            key: this.tlsIdentity.keyPem,
            cert: this.tlsIdentity.certPem,
            minVersion: 'TLSv1.2'
          })
        : http.createServer();

      srv.requestTimeout = 30000;
      srv.headersTimeout = 10000;

      srv.on('request', (req, res) => {
        this._handleHttpRequest(req, res).catch((err) => {
          if (!res.headersSent) {
            this._sendJson(res, 500, { ok: false, errorCode: 'INVALID_PAYLOAD', message: err?.message || 'Internal error' });
          }
        });
      });

      const onStartupError = (err) => {
        this.isListening = false;
        if (err?.code === 'EADDRINUSE') {
          this.lastErrorCode = 'PORT_IN_USE';
          this.bindError = `Port ${this.port} is already in use by another application.`;
        } else if (err?.code === 'EACCES') {
          this.lastErrorCode = 'PORT_PERMISSION_DENIED';
          this.bindError = `Permission denied binding LAN port ${this.port}. Choose a port above 1024 (e.g. 8765).`;
        } else {
          this.lastErrorCode = 'HOST_BIND_FAILED';
          this.bindError = err?.message || `Failed to bind LAN server on port ${this.port}.`;
        }
        try { srv.close(); } catch {}
        this.server = null;
        this.emit('status-changed', this.getStatus());
        reject(Object.assign(new Error(this.bindError), { errorCode: this.lastErrorCode }));
      };

      srv.once('error', onStartupError);

      srv.listen(this.port, '0.0.0.0', () => {
        srv.removeListener('error', onStartupError);
        const addr = srv.address();
        if (addr && typeof addr === 'object' && addr.port) {
          this.port = addr.port;
        }
        this.server = srv;
        this.isListening = true;
        this.bindError = null;
        this.lastErrorCode = null;
        if (!this.activePairingPin || Date.now() > this.pairingExpiresAt) {
          this.generatePairingCode();
        }
        if (opts.enableDiscovery !== false) {
          this._startDiscoveryResponders();
        }
        this._startInterfaceMonitor();
        this.emit('status-changed', this.getStatus());
        resolve(this.getStatus());
      });
    });

    return this.getStatus();
  }

  async stop() {
    this._stopInterfaceMonitor();
    this._stopDiscoveryResponders();
    this.isListening = false;
    if (this.server) {
      const srv = this.server;
      this.server = null;
      await new Promise((resolve) => {
        try {
          srv.close(() => resolve());
          if (typeof srv.closeAllConnections === 'function') srv.closeAllConnections();
        } catch {
          resolve();
        }
      });
    }
    this.emit('status-changed', this.getStatus());
  }

  getStatus() {
    const now = Date.now();
    const activePairing = Boolean(this.activePairingPin && now < this.pairingExpiresAt);
    return {
      isSupported: true,
      listening: this.isListening,
      status: this.bindError
        ? 'error'
        : this.isListening
        ? this.networkInfo.primaryIp
          ? 'waiting_for_devices'
          : 'no_wifi_interface'
        : 'stopped',
      deviceId: this.localDeviceId,
      deviceName: this.localDeviceName,
      addresses: this.networkInfo.addresses,
      primaryIp: this.networkInfo.primaryIp,
      port: this.port,
      tlsEnabled: this.useTls,
      certFingerprintSha256: this.tlsIdentity?.fingerprintSha256 || null,
      verificationCode: this.tlsIdentity ? formatVerificationCode(this.tlsIdentity.fingerprintSha256) : null,
      pairingCode: activePairing ? this.activePairingPin : null,
      pairingExpiresAt: activePairing ? this.pairingExpiresAt : 0,
      pairingLockedOut: now < this.lockoutUntil,
      lockoutRemainingMs: Math.max(0, this.lockoutUntil - now),
      pairedPeersCount: this.pairedPeersMap.size,
      bindError: this.bindError,
      errorCode: this.lastErrorCode,
      protocolVersion: PROTOCOL_VERSION
    };
  }
}

// ============================================================================
// Desktop / Node Pinned TLS Client Helper + UDP Discovery Probe
// ============================================================================

async function discoverLanHostsViaUdp(timeoutMs = 1800) {
  const ifaces = enumerateLanIpv4Interfaces();
  const broadcasts = computeBroadcastAddresses(ifaces.interfaces);
  const found = new Map();

  return await new Promise((resolve) => {
    let sock;
    try {
      sock = dgram.createSocket('udp4');
    } catch {
      resolve([]);
      return;
    }

    const cleanup = () => {
      try { sock.close(); } catch {}
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(Array.from(found.values()));
    }, Math.max(300, Math.min(5000, timeoutMs)));

    sock.on('error', () => {
      clearTimeout(timer);
      cleanup();
      resolve(Array.from(found.values()));
    });

    sock.on('message', (msg, rinfo) => {
      try {
        const parsed = JSON.parse(msg.toString('utf8'));
        if (parsed && parsed.service === 'glueck-lan-sync' && parsed.deviceId && parsed.port) {
          found.set(parsed.deviceId, {
            deviceId: parsed.deviceId,
            deviceName: parsed.deviceName || 'Glück PC',
            primaryIp: parsed.primaryIp || rinfo.address,
            addresses: Array.isArray(parsed.addresses) && parsed.addresses.length > 0 ? parsed.addresses : [rinfo.address],
            port: Number(parsed.port),
            protocolVersion: Number(parsed.protocolVersion) || PROTOCOL_VERSION,
            tlsEnabled: Boolean(parsed.tlsEnabled),
            certFingerprintSha256: parsed.certFingerprintSha256 || null,
            verificationCode: parsed.verificationCode || formatVerificationCode(parsed.certFingerprintSha256),
            pairingActive: Boolean(parsed.pairingActive),
            discoverySource: 'udp'
          });
        }
      } catch {}
    });

    sock.bind(0, () => {
      try {
        sock.setBroadcast(true);
        const probe = Buffer.from(`GLUECK_DISCOVER_V1:${Date.now()}`, 'utf8');
        for (const bcast of broadcasts) {
          sock.send(probe, 0, probe.length, UDP_DISCOVERY_PORT, bcast, () => {});
        }
      } catch {}
    });
  });
}

async function performPinnedLanRequest({
  host,
  port,
  method = 'GET',
  endpointPath = '/api/sync/health',
  body = undefined,
  authToken = undefined,
  expectedFingerprintSha256 = undefined,
  useTls = true,
  timeoutMs = 8000
}) {
  const cleanHost = String(host || '').trim();
  const numPort = Number(port);
  if (!cleanHost || !Number.isInteger(numPort) || numPort < 1 || numPort > 65535) {
    return {
      ok: false,
      httpStatus: 0,
      errorCode: 'HOST_OFFLINE',
      message: 'Valid LAN host IP and port are required.'
    };
  }

  const startedAt = Date.now();
  const payloadStr = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;

  return await new Promise((resolve) => {
    const mod = useTls ? https : http;
    const pinnedAgent = useTls
      ? new https.Agent({ keepAlive: false, maxCachedSessions: 0 })
      : new http.Agent({ keepAlive: false });
    const reqOpts = {
      host: cleanHost,
      port: numPort,
      path: endpointPath,
      method,
      agent: pinnedAgent,
      timeout: timeoutMs,
      headers: {
        Accept: 'application/json',
        'Connection': 'close',
        'X-Glueck-Sync-Protocol': String(PROTOCOL_VERSION),
        ...(payloadStr !== undefined
          ? {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': Buffer.byteLength(payloadStr, 'utf8')
            }
          : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      ...(useTls
        ? {
            rejectUnauthorized: false, // Self-signed LAN cert validated via explicit SHA-256 fingerprint pin
            servername: undefined
          }
        : {})
    };

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ ...result, latencyMs: Date.now() - startedAt });
    };

    const req = mod.request(reqOpts, (res) => {
      let peerFingerprint = null;
      if (useTls && res.socket && typeof res.socket.getPeerCertificate === 'function') {
        try {
          const cert = res.socket.getPeerCertificate(false);
          if (cert && cert.fingerprint256) {
            peerFingerprint = cert.fingerprint256.replace(/:/g, '').toLowerCase();
          }
        } catch {}
      }

      if (useTls && expectedFingerprintSha256) {
        const expected = String(expectedFingerprintSha256).replace(/:/g, '').toLowerCase();
        if (!peerFingerprint || !constantTimeStringEqual(peerFingerprint, expected)) {
          req.destroy();
          return finish({
            ok: false,
            httpStatus: 0,
            errorCode: 'CERTIFICATE_MISMATCH',
            message: 'Host TLS certificate fingerprint does not match the paired certificate.',
            certFingerprintSha256: peerFingerprint
          });
        }
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          return finish({
            ok: false,
            httpStatus: res.statusCode || 502,
            errorCode: 'INVALID_PAYLOAD',
            message: 'Invalid JSON response from LAN host.'
          });
        }

        const httpOk = res.statusCode >= 200 && res.statusCode < 300;
        const appOk = data && data.ok !== false;
        if (!httpOk || !appOk) {
          const fallbackCode =
            res.statusCode === 401
              ? 'UNAUTHORIZED_DEVICE'
              : res.statusCode === 426
              ? 'PROTOCOL_VERSION_MISMATCH'
              : res.statusCode === 429
              ? 'PAIRING_LOCKED_OUT'
              : res.statusCode === 410
              ? 'PAIRING_CODE_EXPIRED'
              : 'INVALID_PAYLOAD';
          return finish({
            ok: false,
            httpStatus: res.statusCode || 500,
            errorCode: data?.errorCode || fallbackCode,
            message: data?.message || `HTTP ${res.statusCode}`,
            data,
            certFingerprintSha256: peerFingerprint
          });
        }

        return finish({
          ok: true,
          httpStatus: res.statusCode,
          data,
          certFingerprintSha256: peerFingerprint
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      finish({
        ok: false,
        httpStatus: 0,
        errorCode: 'CONNECTION_TIMEOUT',
        message: `Timed out connecting to ${cleanHost}:${numPort}.`
      });
    });

    req.on('error', (err) => {
      let errorCode = 'HOST_OFFLINE';
      if (err?.code === 'ECONNREFUSED') errorCode = 'CONNECTION_REFUSED';
      else if (err?.code === 'ETIMEDOUT' || err?.code === 'ESOCKETTIMEDOUT') errorCode = 'CONNECTION_TIMEOUT';
      else if (err?.code === 'ENETUNREACH' || err?.code === 'EHOSTUNREACH') errorCode = 'NETWORK_CHANGED';
      finish({
        ok: false,
        httpStatus: 0,
        errorCode,
        message: err?.message || `Failed to connect to ${cleanHost}:${numPort}.`
      });
    });

    if (payloadStr !== undefined) {
      req.write(payloadStr);
    }
    req.end();
  });
}

module.exports = {
  DEFAULT_LAN_SYNC_PORT,
  UDP_DISCOVERY_PORT,
  PROTOCOL_VERSION,
  MIN_SUPPORTED_PROTOCOL_VERSION,
  DEFAULT_CAPABILITIES,
  LanSyncHostController,
  enumerateLanIpv4Interfaces,
  generateSelfSignedLanCert,
  formatVerificationCode,
  discoverLanHostsViaUdp,
  performPinnedLanRequest
};
