import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

(globalThis as any).__TEST_ENV__ = true;

// Minimal localStorage polyfill for Node execution
const memStorage = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
    setItem: (k: string, v: string) => {
      memStorage.set(k, String(v));
    },
    removeItem: (k: string) => {
      memStorage.delete(k);
    },
    clear: () => memStorage.clear(),
    key: (i: number) => Array.from(memStorage.keys())[i] ?? null,
    get length() {
      return memStorage.size;
    }
  };
}

import {
  CURRENT_SYNC_PROTOCOL_VERSION,
  PAIRING_PIN_TTL_MS,
  PairedPeer,
  SyncStateMetadata,
  SyncableRecord
} from '../types';
import {
  __resetPeerNetworkForTests,
  __setPeerConstructorForTests,
  formatDevicePeerId,
  formatPairingPinId,
  getLastP2pAttempts,
  peerNetwork
} from '../services/sync/peerNetwork';
import {
  getLocalHostStatus,
  startLocalServer,
  stopLocalServer
} from '../services/sync/localServer';
import {
  exchangeDeltas,
  pairWithPeer,
  sendHeartbeat
} from '../services/sync/syncClient';
import {
  handleInboundExchange,
  runSyncCycle,
  syncMissingPageImagesWithPeer,
  SyncDataSource
} from '../services/sync/syncOrchestrator';
import {
  isLegacyLanOnlyPeer,
  migrateLegacyPeerRecords,
  redactSyncStateForDiagnostics,
  sanitizeSyncStateForStorage
} from '../services/sync/syncMigration';
import { connectivityEngine } from '../services/sync/connectivityEngine';
import { getPageImageRecord } from '../shared/lernstudioPageImageStore';

// --- In-memory PeerJS Broker & Duplex DataConnection Harness ---
class MockDataConnection {
  public peer: string;
  public open = false;
  public peerConnection: any;
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  public remote: MockDataConnection | null = null;

  constructor(remotePeerId: string, iceCandidateType: string = 'srflx') {
    this.peer = remotePeerId;
    this.peerConnection = {
      getStats: async () =>
        new Map<string, any>([
          ['pair_1', { type: 'candidate-pair', state: 'succeeded', remoteCandidateId: 'cand_1' }],
          ['cand_1', { candidateType: iceCandidateType }]
        ])
    };
  }

  on(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  emit(event: string, ...args: any[]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) {
      fn(...args);
    }
  }

  send(data: any) {
    if (!this.open || !this.remote || !this.remote.open) {
      throw new Error('DataConnection is not open');
    }
    const copy = JSON.parse(JSON.stringify(data));
    const target = this.remote;
    setTimeout(() => {
      if (target.open) {
        target.emit('data', copy);
      }
    }, 1);
  }

  close() {
    const wasOpen = this.open;
    this.open = false;
    if (wasOpen) {
      this.emit('close');
    }
    if (this.remote && this.remote.open) {
      this.remote.open = false;
      this.remote.emit('close');
    }
  }
}

interface MockBrokerState {
  online: boolean;
  peers: Map<string, MockPeer>;
}

const broker: MockBrokerState = {
  online: true,
  peers: new Map()
};

class MockPeer {
  public id: string;
  public open = false;
  public destroyed = false;
  public disconnected = false;
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  private activeConns = new Set<MockDataConnection>();

  constructor(id?: string) {
    this.id = id || `anon_${Math.random().toString(36).slice(2, 9)}`;
    setTimeout(() => {
      if (this.destroyed) return;
      if (!broker.online) {
        this.emit('error', { type: 'network', message: 'Signalling server unreachable' });
        return;
      }
      if (broker.peers.has(this.id)) {
        this.emit('error', { type: 'unavailable-id', message: `ID "${this.id}" is taken.` });
        return;
      }
      this.open = true;
      broker.peers.set(this.id, this);
      this.emit('open', this.id);
    }, 2);
  }

  on(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  once(event: string, fn: (...args: any[]) => void) {
    const wrapper = (...args: any[]) => {
      this.listeners.get(event)?.delete(wrapper);
      fn(...args);
    };
    this.on(event, wrapper);
  }

  emit(event: string, ...args: any[]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) {
      fn(...args);
    }
  }

  connect(targetId: string): any {
    const clientConn = new MockDataConnection(targetId, 'srflx');
    this.activeConns.add(clientConn);

    setTimeout(() => {
      if (this.destroyed) return;
      if (!broker.online) {
        this.emit('error', { type: 'network', message: 'Signalling server unreachable' });
        return;
      }
      const targetPeer = broker.peers.get(targetId);
      if (!targetPeer || targetPeer.destroyed || !targetPeer.open) {
        this.emit('error', { type: 'peer-unavailable', message: `Could not connect to peer ${targetId}` });
        return;
      }

      const serverConn = new MockDataConnection(this.id, 'srflx');
      clientConn.remote = serverConn;
      serverConn.remote = clientConn;
      targetPeer.activeConns.add(serverConn);

      targetPeer.emit('connection', serverConn);
      setTimeout(() => {
        if (this.destroyed || targetPeer.destroyed) return;
        clientConn.open = true;
        serverConn.open = true;
        serverConn.emit('open');
        clientConn.emit('open');
      }, 2);
    }, 2);

    return clientConn;
  }

  reconnect() {
    if (this.destroyed || !broker.online) return;
    this.disconnected = false;
    this.open = true;
    broker.peers.set(this.id, this);
    this.emit('open', this.id);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.open = false;
    if (broker.peers.get(this.id) === this) {
      broker.peers.delete(this.id);
    }
    for (const c of Array.from(this.activeConns)) {
      c.close();
    }
    this.activeConns.clear();
    this.emit('close');
  }
}

function sendRemoteRpc(
  fromPeerId: string,
  targetPeerId: string,
  route: string,
  data: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = new MockPeer(fromPeerId);
    const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let settled = false;
    const finish = (err: any, val?: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.destroy();
      if (err) reject(err);
      else resolve(val);
    };
    const timer = setTimeout(() => finish(new Error('Remote RPC timeout')), 4000);

    client.on('error', (err: any) => {
      finish(err);
    });
    client.on('open', () => {
      const conn = client.connect(targetPeerId);
      conn.on('open', () => {
        conn.send({ type: 'request', id: reqId, route, data });
      });
      conn.on('data', (msg: any) => {
        if (msg?.id !== reqId) return;
        if (msg.type === 'error') {
          finish(Object.assign(new Error(msg.error), { errorCode: msg.errorCode }));
        } else if (msg.type === 'response') {
          finish(null, msg.data);
        }
      });
    });
  });
}

function createInMemorySyncDataSource(
  deviceId: string,
  deviceName: string,
  initialRecords: Record<string, SyncableRecord[]> = {},
  initialPeers: PairedPeer[] = []
): SyncDataSource {
  const dataStore: Record<string, SyncableRecord[]> = {};
  for (const [k, v] of Object.entries(initialRecords)) {
    dataStore[k] = JSON.parse(JSON.stringify(v));
  }

  let syncState: SyncStateMetadata = {
    localDeviceId: deviceId,
    localDeviceName: deviceName,
    localRevisionCounter: 1,
    peerWatermarkTable: {},
    protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION,
    pairedPeers: JSON.parse(JSON.stringify(initialPeers))
  };

  return {
    getLocalData: () => dataStore,
    getSyncState: () => syncState,
    saveMergedData: async (key: string, data: SyncableRecord[]) => {
      dataStore[key] = JSON.parse(JSON.stringify(data));
    },
    updateSyncState: async (next: SyncStateMetadata) => {
      syncState = JSON.parse(JSON.stringify(sanitizeSyncStateForStorage(next)));
    }
  };
}

async function runP2pRebuildRegressionTests() {
  const repoRoot = process.cwd();
  try {
    console.log('--- Running P2P WebRTC Architecture & Migration Verification Suite ---');
    broker.online = true;
    broker.peers.clear();
    connectivityEngine.destroy();
    __resetPeerNetworkForTests({ brokerConnectTimeoutMs: 500, unavailableIdRetryDelaysMs: [10, 10, 10] });
    __setPeerConstructorForTests(MockPeer as any);

    // 1. Verify Legacy LAN Stack Files Are Removed
    const removedPaths = [
      'electron/lanSyncServer.cjs',
      'android/app/src/main/java/com/glueck/app/LanSyncPlugin.java',
      'src/services/sync/lanTransport.ts',
      'src/services/sync/lanVault.ts'
    ];
    for (const relPath of removedPaths) {
      assert.equal(
        fs.existsSync(path.join(repoRoot, relPath)),
        false,
        `Legacy LAN file must be removed: ${relPath}`
      );
    }
    console.log('[PASS] Legacy LAN sync server, Android native LAN plugin, and TLS vault files are removed');

    // 2. Host Startup (startLocalServer), Deterministic Peer IDs, PIN Persistence Across Duplicate Starts
    const pcDataSource = createInMemorySyncDataSource('pc_host_01', 'Glück Desktop PC', {
      students: [
        {
          id: 'stu_pc_1',
          name: 'Lukas Weber',
          updatedAt: Date.now(),
          originDeviceId: 'pc_host_01',
          updatedByDeviceId: 'pc_host_01',
          originRevision: 1,
          deleted: false
        } as any
      ]
    });

    const hostStatus1 = await startLocalServer(
      'Glück Desktop PC',
      'pc_host_01',
      pcDataSource.getSyncState(),
      pcDataSource
    );

    assert.equal(hostStatus1.brokerConnected, true);
    assert.equal(hostStatus1.listening, true);
    assert.equal(hostStatus1.peerId, formatDevicePeerId('pc_host_01'));
    assert.match(hostStatus1.pin, /^\d{6}$/);
    assert.notEqual(hostStatus1.pin, '842915', 'Never issue hardcoded PIN 842915');
    assert.ok(hostStatus1.pinExpiresAt >= Date.now() + PAIRING_PIN_TTL_MS - 5000);

    // Duplicate startLocalServer call must keep exact same PIN and expiry
    const hostStatus2 = await startLocalServer(
      'Glück Desktop PC',
      'pc_host_01',
      pcDataSource.getSyncState(),
      pcDataSource
    );
    assert.equal(hostStatus2.pin, hostStatus1.pin, 'Repeated startLocalServer must NOT regenerate active PIN');
    assert.equal(hostStatus2.pinExpiresAt, hostStatus1.pinExpiresAt);
    console.log('[PASS] P2P Host starts with deterministic Peer ID, persistent 10-min PIN, and no duplicate PIN rotation');

    // 3. Health Ping & Unauthenticated Route Blocking
    const pingRes = await sendRemoteRpc('probe_client', hostStatus1.peerId, '/api/sync/ping', {});
    assert.equal(pingRes.ok, true);
    assert.equal(pingRes.deviceId, 'pc_host_01');
    assert.equal((pingRes as any).pin, undefined, 'Ping must never expose pairing PIN');

    let unauthHbErr: any = null;
    try {
      await sendRemoteRpc('rogue_client', hostStatus1.peerId, '/api/sync/heartbeat', {
        deviceId: 'rogue_client',
        token: 'fake_tok'
      });
    } catch (e) {
      unauthHbErr = e;
    }
    assert.equal(unauthHbErr?.errorCode, 'UNAUTHORIZED_DEVICE');

    let unauthExchangeErr: any = null;
    try {
      await sendRemoteRpc('rogue_client', hostStatus1.peerId, '/api/sync/exchange', {
        delta: { senderDeviceId: 'rogue_client', senderDeviceName: 'Rogue', peerWatermarks: {}, records: {} },
        token: 'fake_tok'
      });
    } catch (e) {
      unauthExchangeErr = e;
    }
    assert.equal(unauthExchangeErr?.errorCode, 'UNAUTHORIZED_DEVICE');
    console.log('[PASS] /api/sync/ping succeeds without leaking PIN and unauthenticated RPCs fail with UNAUTHORIZED_DEVICE');

    // 4. Pairing Security: Expired PIN -> PIN_EXPIRED, Wrong PIN -> PIN_INVALID, Protocol Mismatch, Valid Pair + Single-Use Rotation
    const wrongPin = hostStatus1.pin === '000000' ? '111111' : '000000';
    let wrongPinErr: any = null;
    try {
      await sendRemoteRpc('android_probe', hostStatus1.peerId, '/api/sync/pair', {
        deviceId: 'android_01',
        deviceName: 'Pixel Android',
        pairingPin: wrongPin
      });
    } catch (e) {
      wrongPinErr = e;
    }
    assert.equal(wrongPinErr?.errorCode, 'PIN_INVALID');

    let protoMismatchErr: any = null;
    try {
      await sendRemoteRpc('android_future', hostStatus1.peerId, '/api/sync/pair', {
        deviceId: 'android_future',
        deviceName: 'Future App',
        pairingPin: hostStatus1.pin,
        header: { protocolVersion: 99, minSupportedVersion: 99, appVersion: '9.9.9', capabilities: [] }
      });
    } catch (e) {
      protoMismatchErr = e;
    }
    assert.equal(protoMismatchErr?.errorCode, 'PROTOCOL_VERSION_MISMATCH');

    // Test PIN_EXPIRED
    const savedPin = hostStatus1.pin;
    peerNetwork.currentPairingPinExpiresAt = Date.now() - 1000;
    peerNetwork.lastIssuedPin = savedPin;
    peerNetwork.lastIssuedPinExpiresAt = Date.now() - 1000;
    let expiredErr: any = null;
    try {
      await sendRemoteRpc('android_probe', hostStatus1.peerId, '/api/sync/pair', {
        deviceId: 'android_01',
        deviceName: 'Pixel Android',
        pairingPin: savedPin
      });
    } catch (e) {
      expiredErr = e;
    }
    assert.equal(expiredErr?.errorCode, 'PIN_EXPIRED');

    // Restore expiry for valid pairing
    const validRes = await startLocalServer(
      'Glück Desktop PC',
      'pc_host_01',
      {
        ...pcDataSource.getSyncState(),
        pairingPin: savedPin,
        pairingPinExpiresAt: Date.now() + 600_000
      },
      pcDataSource
    );
    const activePin = validRes.pin;

    const pairResponse = await sendRemoteRpc('android_01_rpc', hostStatus1.peerId, '/api/sync/pair', {
      deviceId: 'android_01',
      deviceName: 'Pixel Android',
      pairingPin: activePin
    });
    assert.equal(pairResponse.ok, true);
    assert.equal(pairResponse.deviceId, 'pc_host_01');
    assert.ok(pairResponse.authToken && pairResponse.authToken.startsWith('glk_'));

    // Host must have immediately rotated away from used PIN -> reusing activePin fails!
    const postPairHostStatus = getLocalHostStatus();
    assert.notEqual(postPairHostStatus.pin, activePin, 'Single-use PIN must rotate after pairing persists');

    let reuseErr: any = null;
    try {
      await sendRemoteRpc('attacker', hostStatus1.peerId, '/api/sync/pair', {
        deviceId: 'android_attacker',
        deviceName: 'Attacker',
        pairingPin: activePin
      });
    } catch (e) {
      reuseErr = e;
    }
    assert.equal(reuseErr?.errorCode, 'PIN_INVALID');
    console.log('[PASS] Pairing validates PIN_EXPIRED vs PIN_INVALID, checks protocol, and rotates single-use PIN');

    // 5. Bidirectional Delta Sync & Page Image Chunk Sync via P2P WebRTC
    const remoteHostPeer: PairedPeer = {
      deviceId: 'pc_host_01',
      deviceName: 'Glück Desktop PC',
      lastKnownIp: 'P2P (WebRTC)',
      port: 0,
      pairingToken: pairResponse.authToken,
      hasStoredAuthToken: true,
      requiresRePairing: false,
      lastSyncedTimestamp: Date.now(),
      isOnline: true,
      protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION
    };

    const androidPeerId = formatDevicePeerId('android_01');
    const pcHostPairedEntry = pcDataSource
      .getSyncState()
      .pairedPeers?.find((p) => p.deviceId === 'android_01');
    assert.ok(pcHostPairedEntry);
    assert.equal(pcHostPairedEntry!.lastKnownIp, 'P2P (WebRTC)');
    assert.equal(pcHostPairedEntry!.port, 0);

    // Switch local peerNetwork identity to android_01 while keeping mock remote handler for pc_host_01
    stopLocalServer();
    connectivityEngine.destroy();
    __resetPeerNetworkForTests({ brokerConnectTimeoutMs: 500, unavailableIdRetryDelaysMs: [10, 10, 10] });

    // Register remote PC host responder on broker
    const remotePcPeer = new MockPeer(formatDevicePeerId('pc_host_01'));
    await new Promise<void>((resolve) => remotePcPeer.on('open', () => resolve()));
    let simulateStorageFailure = false;
    let hostRevokedAndroid = false;

    remotePcPeer.on('connection', (conn: any) => {
      conn.on('data', async (payload: any) => {
        if (payload?.type !== 'request') return;
        try {
          if (hostRevokedAndroid) {
            throw Object.assign(new Error('Device revoked'), { errorCode: 'UNAUTHORIZED_DEVICE' });
          }
          if (payload.route === '/api/sync/heartbeat') {
            conn.send({ type: 'response', id: payload.id, data: { ok: true, deviceId: 'pc_host_01' } });
          } else if (payload.route === '/api/sync/exchange') {
            if (simulateStorageFailure) {
              throw Object.assign(new Error('Simulated IndexedDB write failure'), { errorCode: 'STORAGE_SAVE_FAILED' });
            }
            const outDelta = await handleInboundExchange(payload.data.delta, pcDataSource);
            conn.send({ type: 'response', id: payload.id, data: { ok: true, delta: outDelta } });
          } else if (payload.route === '/api/sync/page-images/manifest') {
            const { computePageImageChecksum } = await import('../shared/lernstudioPageImageStore');
            const remoteImgBase64 = 'data:image/jpeg;base64,' + 'R'.repeat(2600);
            conn.send({
              type: 'response',
              id: payload.id,
              data: {
                availableImages: [
                  {
                    id: 'page_img_remote_only',
                    fileName: 'remote_page.jpg',
                    mimeType: 'image/jpeg',
                    sizeBytes: remoteImgBase64.length,
                    createdAt: Date.now(),
                    checksum: computePageImageChecksum(remoteImgBase64),
                    totalChunks: 3
                  }
                ]
              }
            });
          } else if (payload.route === '/api/sync/page-images/chunk') {
            const { computePageImageChecksum, splitPageImageIntoChunks } = await import('../shared/lernstudioPageImageStore');
            const remoteImgBase64 = 'data:image/jpeg;base64,' + 'R'.repeat(2600);
            const chunks = splitPageImageIntoChunks(
              {
                id: 'page_img_remote_only',
                fileName: 'remote_page.jpg',
                mimeType: 'image/jpeg',
                sizeBytes: remoteImgBase64.length,
                base64Data: remoteImgBase64,
                checksum: computePageImageChecksum(remoteImgBase64),
                createdAt: Date.now()
              },
              1024
            );
            conn.send({
              type: 'response',
              id: payload.id,
              data: { chunk: chunks[Number(payload.data?.chunkIndex || 0)] }
            });
          }
        } catch (err: any) {
          conn.send({
            type: 'error',
            id: payload.id,
            errorCode: err?.errorCode || 'STORAGE_SAVE_FAILED',
            error: err?.message || 'Remote error'
          });
        }
      });
    });

    const androidDataSource = createInMemorySyncDataSource(
      'android_01',
      'Pixel Android',
      {
        students: [
          {
            id: 'stu_android_1',
            name: 'Mina Adel',
            updatedAt: Date.now(),
            originDeviceId: 'android_01',
            updatedByDeviceId: 'android_01',
            originRevision: 1,
            deleted: false
          } as any
        ]
      },
      [remoteHostPeer]
    );

    const androidHost = await startLocalServer('Pixel Android', 'android_01', androidDataSource.getSyncState(), androidDataSource);
    assert.equal(androidHost.peerId, androidPeerId);

    const hbRes = await sendHeartbeat(remoteHostPeer);
    assert.equal(hbRes.ok, true);
    assert.equal(peerNetwork.lastIceCandidateType, 'srflx');

    const cycleRes = await runSyncCycle('pc_host_01', androidDataSource, 'Manual Sync');
    assert.equal(cycleRes.success, true);
    assert.ok(androidDataSource.getLocalData()['students']?.some((s) => s.id === 'stu_pc_1'));
    assert.ok(pcDataSource.getLocalData()['students']?.some((s) => s.id === 'stu_android_1'));
    console.log('[PASS] Bidirectional P2P WebRTC delta sync exchanged records and captured srflx ICE path');

    // 6. STORAGE_SAVE_FAILED Propagation
    simulateStorageFailure = true;
    const failedExchange = await exchangeDeltas(remoteHostPeer, {
      senderDeviceId: 'android_01',
      senderDeviceName: 'Pixel Android',
      peerWatermarks: {},
      records: {}
    });
    assert.equal(failedExchange.ok, false);
    assert.equal(failedExchange.errorCode, 'STORAGE_SAVE_FAILED');
    simulateStorageFailure = false;
    console.log('[PASS] Remote STORAGE_SAVE_FAILED propagates cleanly without false success');

    // 7. Page Images Chunk Transfer Verification (multi-chunk reassembly over P2P)
    const imgSyncDataSource = createInMemorySyncDataSource(
      'android_01',
      'Pixel Android',
      {
        lernstudioSets: [
          { id: 'set_1', grammarContent: { pageImageRefs: [{ id: 'page_img_remote_only' }] } } as any
        ]
      },
      [remoteHostPeer]
    );
    const imgRes = await syncMissingPageImagesWithPeer({
      peer: remoteHostPeer,
      chunkSizeChars: 1024,
      dataSource: imgSyncDataSource
    });
    assert.deepEqual(imgRes.transferredIds, ['page_img_remote_only']);
    assert.equal((await getPageImageRecord('page_img_remote_only'))?.base64Data, 'data:image/jpeg;base64,' + 'R'.repeat(2600));
    console.log('[PASS] Authenticated page-image manifest & multi-chunk reassembly verified over WebRTC P2P');

    // 8. Revoked Device Returns UNAUTHORIZED_DEVICE
    hostRevokedAndroid = true;
    const revokedHb = await sendHeartbeat(remoteHostPeer);
    assert.equal(revokedHb.ok, false);
    assert.equal(revokedHb.errorCode, 'UNAUTHORIZED_DEVICE');
    remotePcPeer.destroy();
    console.log('[PASS] Revoking peer immediately rejects subsequent requests with UNAUTHORIZED_DEVICE');

    // 9. Legacy LAN & Existing P2P Peer Migration + Diagnostic Redaction
    const mixedState: SyncStateMetadata = {
      localDeviceId: 'dev_mobile_1',
      localDeviceName: 'Samsung Phone',
      localRevisionCounter: 12,
      peerWatermarkTable: { p2p_pc_1: { students: 1700000000000 } },
      pairingPin: '654321',
      pairingPinExpiresAt: Date.now() + PAIRING_PIN_TTL_MS,
      pairedPeers: [
        // Valid P2P peer accidentally flagged requiresRePairing while token is intact -> restored!
        {
          deviceId: 'p2p_pc_1',
          deviceName: 'Office PC (P2P)',
          lastKnownIp: 'P2P (WebRTC)',
          port: 0,
          pairingToken: 'glk_valid_secret_token',
          requiresRePairing: true,
          lastSyncedTimestamp: 1700000000000,
          isOnline: false
        },
        // P2P peer whose token was stripped -> must require re-pairing
        {
          deviceId: 'p2p_pc_wiped',
          deviceName: 'Wiped Token PC',
          lastKnownIp: 'P2P (WebRTC)',
          port: 0,
          hasStoredAuthToken: false,
          lastSyncedTimestamp: 1700000000000,
          isOnline: false
        },
        // Legacy LAN IPv4 peer -> flagged requiresRePairing
        {
          deviceId: 'lan_pc_1',
          deviceName: 'Old LAN Desktop',
          lastKnownIp: '192.168.1.50',
          port: 8765,
          pairingToken: 'old_lan_tok',
          lastSyncedTimestamp: 1700000050000,
          isOnline: false
        },
        // Corrupted PIN-as-IP peer -> flagged requiresRePairing
        {
          deviceId: 'pin_ip_pc',
          deviceName: 'Corrupt PIN Peer',
          lastKnownIp: '482193',
          port: 0,
          lastSyncedTimestamp: 1700000060000,
          isOnline: false
        }
      ]
    };

    const { migratedState, didChange } = migrateLegacyPeerRecords(mixedState);
    assert.equal(didChange, true);
    assert.deepEqual(migratedState.peerWatermarkTable, { p2p_pc_1: { students: 1700000000000 } });

    const restoredP2p = migratedState.pairedPeers!.find((p) => p.deviceId === 'p2p_pc_1')!;
    assert.equal(restoredP2p.requiresRePairing, false);
    assert.equal(restoredP2p.lastKnownIp, 'P2P (WebRTC)');
    assert.equal(restoredP2p.port, 0);
    assert.equal(restoredP2p.pairingToken, 'glk_valid_secret_token');
    assert.equal(isLegacyLanOnlyPeer(restoredP2p), false);

    const wipedP2p = migratedState.pairedPeers!.find((p) => p.deviceId === 'p2p_pc_wiped')!;
    assert.equal(wipedP2p.requiresRePairing, true);
    assert.equal(isLegacyLanOnlyPeer(wipedP2p), true);

    const lanPeer = migratedState.pairedPeers!.find((p) => p.deviceId === 'lan_pc_1')!;
    assert.equal(lanPeer.requiresRePairing, true);
    assert.equal(isLegacyLanOnlyPeer(lanPeer), true);

    const pinIpPeer = migratedState.pairedPeers!.find((p) => p.deviceId === 'pin_ip_pc')!;
    assert.equal(pinIpPeer.requiresRePairing, true);
    assert.equal(isLegacyLanOnlyPeer(pinIpPeer), true);

    // Diagnostic export redacts tokens and PINs
    const redactedJson = JSON.stringify(redactSyncStateForDiagnostics(migratedState));
    assert.equal(redactedJson.includes('glk_valid_secret_token'), false, 'Diagnostics must redact pairingToken');
    assert.equal(redactedJson.includes('654321'), false, 'Diagnostics must redact pairingPin');
    assert.ok(getLastP2pAttempts().length > 0, 'Diagnostics captures P2P operation attempts');
    assert.equal(formatPairingPinId('123456'), 'glueck-123456');
    console.log('[PASS] Legacy/P2P peer migration & secret-free diagnostic redaction verified');

    console.log('ALL P2P ARCHITECTURE & MIGRATION TESTS PASSED!');
  } finally {
    stopLocalServer();
    __setPeerConstructorForTests(null);
    __resetPeerNetworkForTests();
    connectivityEngine.destroy();
    broker.peers.clear();
  }
}

runP2pRebuildRegressionTests().catch((err) => {
  console.error('P2P REBUILD TEST FAILED:', err);
  process.exit(1);
});
