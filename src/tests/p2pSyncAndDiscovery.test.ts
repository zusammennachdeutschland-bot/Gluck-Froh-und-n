import assert from 'node:assert/strict';

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
  peerNetwork
} from '../services/sync/peerNetwork';
import {
  getOrEnsureActivePairingPin,
  regeneratePairingPin,
  startLocalServer,
  stopLocalServer
} from '../services/sync/localServer';
import { pairWithPeer } from '../services/sync/syncClient';
import {
  __resetPresenceRoomForTests,
  __setPresencePeerConstructorForTests,
  computeRoomId,
  isValidPresenceMessage,
  presenceRoom
} from '../services/sync/presenceRoom';
import {
  discoverNewDevices,
  rediscoverPairedPeers
} from '../services/sync/discoveryService';
import { presenceService } from '../services/sync/presenceService';
import { connectivityEngine } from '../services/sync/connectivityEngine';
import {
  createPairingPayload,
  createQrMatrix,
  parsePairingPayload,
  scanQrFromSource
} from '../services/sync/qrCodeService';
import {
  handleInboundExchange,
  runSyncCycle,
  SyncDataSource
} from '../services/sync/syncOrchestrator';
import { sanitizeSyncStateForStorage } from '../services/sync/syncMigration';

// --- Shared In-Memory PeerJS Broker for Direct P2P & Presence Room Tests ---
class InMemoryDataConnection {
  public peer: string;
  public open = false;
  public peerConnection: any;
  public remote: InMemoryDataConnection | null = null;
  private listeners = new Map<string, Set<(...args: any[]) => void>>();

  constructor(remotePeerId: string, candidateType: string = 'host') {
    this.peer = remotePeerId;
    this.peerConnection = {
      getStats: async () =>
        new Map<string, any>([
          ['cp1', { type: 'candidate-pair', state: 'succeeded', remoteCandidateId: 'rc1' }],
          ['rc1', { candidateType }]
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
    for (const fn of Array.from(set)) fn(...args);
  }

  send(data: any) {
    if (!this.open || !this.remote || !this.remote.open) {
      throw new Error('DataConnection closed');
    }
    const copy = JSON.parse(JSON.stringify(data));
    const target = this.remote;
    setTimeout(() => {
      if (target.open) target.emit('data', copy);
    }, 1);
  }

  close() {
    const wasOpen = this.open;
    this.open = false;
    if (wasOpen) this.emit('close');
    if (this.remote && this.remote.open) {
      this.remote.open = false;
      this.remote.emit('close');
    }
  }
}

const mockBroker = {
  online: true,
  peers: new Map<string, InMemoryPeer>(),
  iceFailTargets: new Set<string>(),
  unavailableIdRemainingAttempts: new Map<string, number>(),
  connectionLog: [] as string[]
};

class InMemoryPeer {
  public id: string;
  public open = false;
  public destroyed = false;
  public disconnected = false;
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  private conns = new Set<InMemoryDataConnection>();

  constructor(id?: string) {
    this.id = id || `anon_${Math.random().toString(36).slice(2, 10)}`;
    setTimeout(() => {
      if (this.destroyed) return;
      if (!mockBroker.online) {
        this.emit('error', { type: 'network', message: 'Broker offline' });
        return;
      }
      const forcedCollisions = mockBroker.unavailableIdRemainingAttempts.get(this.id) || 0;
      if (forcedCollisions > 0) {
        mockBroker.unavailableIdRemainingAttempts.set(this.id, forcedCollisions - 1);
        this.emit('error', { type: 'unavailable-id', message: `ID ${this.id} unavailable` });
        return;
      }
      if (mockBroker.peers.has(this.id)) {
        this.emit('error', { type: 'unavailable-id', message: `ID ${this.id} in use` });
        return;
      }
      this.open = true;
      mockBroker.peers.set(this.id, this);
      this.emit('open', this.id);
    }, 2);
  }

  on(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  once(event: string, fn: (...args: any[]) => void) {
    const w = (...args: any[]) => {
      this.listeners.get(event)?.delete(w);
      fn(...args);
    };
    this.on(event, w);
  }

  emit(event: string, ...args: any[]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) fn(...args);
  }

  connect(targetId: string): any {
    mockBroker.connectionLog.push(targetId);
    const clientConn = new InMemoryDataConnection(targetId);
    this.conns.add(clientConn);

    setTimeout(() => {
      if (this.destroyed) return;
      if (!mockBroker.online) {
        this.emit('error', { type: 'network', message: 'Broker offline' });
        return;
      }
      if (mockBroker.iceFailTargets.has(targetId)) {
        clientConn.emit('iceStateChanged', 'failed');
        return;
      }
      const targetPeer = mockBroker.peers.get(targetId);
      if (!targetPeer || targetPeer.destroyed || !targetPeer.open) {
        this.emit('error', { type: 'peer-unavailable', message: `Peer ${targetId} unavailable` });
        return;
      }
      const serverConn = new InMemoryDataConnection(this.id);
      clientConn.remote = serverConn;
      serverConn.remote = clientConn;
      targetPeer.conns.add(serverConn);

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
    if (this.destroyed || !mockBroker.online) return;
    this.disconnected = false;
    this.open = true;
    mockBroker.peers.set(this.id, this);
    this.emit('open', this.id);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.open = false;
    if (mockBroker.peers.get(this.id) === this) {
      mockBroker.peers.delete(this.id);
    }
    for (const c of Array.from(this.conns)) c.close();
    this.conns.clear();
    this.emit('close');
  }
}

function createMemoryDataSource(
  deviceId: string,
  deviceName: string,
  initialRecords: Record<string, SyncableRecord[]> = {},
  initialPeers: PairedPeer[] = []
): SyncDataSource {
  const store: Record<string, SyncableRecord[]> = JSON.parse(JSON.stringify(initialRecords));
  let state: SyncStateMetadata = {
    localDeviceId: deviceId,
    localDeviceName: deviceName,
    localRevisionCounter: 1,
    peerWatermarkTable: {},
    protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION,
    pairedPeers: JSON.parse(JSON.stringify(initialPeers))
  };

  return {
    getLocalData: () => store,
    getSyncState: () => state,
    saveMergedData: async (key, data) => {
      store[key] = JSON.parse(JSON.stringify(data));
    },
    updateSyncState: async (next) => {
      state = JSON.parse(JSON.stringify(sanitizeSyncStateForStorage(next)));
    }
  };
}

function resetHarness() {
  stopLocalServer();
  __resetPresenceRoomForTests();
  __resetPeerNetworkForTests({ brokerConnectTimeoutMs: 120, unavailableIdRetryDelaysMs: [10, 10, 10] });
  connectivityEngine.destroy();
  mockBroker.online = true;
  mockBroker.peers.clear();
  mockBroker.iceFailTargets.clear();
  mockBroker.unavailableIdRemainingAttempts.clear();
  mockBroker.connectionLog.length = 0;
  __setPeerConstructorForTests(InMemoryPeer as any);
  __setPresencePeerConstructorForTests(InMemoryPeer as any);
}

async function runTests() {
  try {
    console.log('--- Running Comprehensive P2P Sync & Account Discovery Test Suite ---');

    // =========================================================================
    // 1. PIN LIFECYCLE, PERSISTENCE ACROSS REOPENS/TAB SWITCHES & SINGLE-USE
    // =========================================================================
    resetHarness();
    const hostDs = createMemoryDataSource('web_host_1', 'Teacher Web');

    const start1 = await startLocalServer('Teacher Web', 'web_host_1', hostDs.getSyncState(), hostDs);
    assert.equal(start1.brokerConnected, true);
    assert.match(start1.pin, /^\d{6}$/);
    assert.notEqual(start1.pin, '842915');
    assert.ok(start1.pinExpiresAt - Date.now() > PAIRING_PIN_TTL_MS - 5000);

    // Calling startLocalServer or getOrEnsureActivePairingPin again (reopening modal / tab switch) MUST preserve PIN
    const ensureRes = await getOrEnsureActivePairingPin(hostDs.getSyncState(), hostDs);
    assert.equal(ensureRes.pin, start1.pin);
    assert.equal(ensureRes.pinExpiresAt, start1.pinExpiresAt);

    const start2 = await startLocalServer('Teacher Web', 'web_host_1', hostDs.getSyncState(), hostDs);
    assert.equal(start2.pin, start1.pin, 'Host restart must preserve persisted active PIN');
    assert.equal(start2.pinExpiresAt, start1.pinExpiresAt);

    // Explicit "New Code" rotates PIN
    const regen = await regeneratePairingPin(PAIRING_PIN_TTL_MS, hostDs);
    assert.equal(regen.brokerConnected, true);
    assert.match(regen.pin, /^\d{6}$/);
    assert.notEqual(regen.pin, start1.pin, 'Explicit regeneratePairingPin must issue a new PIN');
    assert.equal(hostDs.getSyncState().pairingPin, regen.pin);
    assert.equal(peerNetwork.validatePairingPin(start1.pin).ok, false);
    assert.equal(peerNetwork.validatePairingPin(regen.pin).ok, true);

    // Expiry -> PIN_EXPIRED, wrong code -> PIN_INVALID
    peerNetwork.currentPairingPinExpiresAt = Date.now() - 10;
    peerNetwork.lastIssuedPin = regen.pin;
    peerNetwork.lastIssuedPinExpiresAt = Date.now() - 10;
    const expCheck = peerNetwork.validatePairingPin(regen.pin);
    assert.equal(expCheck.ok, false);
    assert.equal((expCheck as any).errorCode, 'PIN_EXPIRED');

    const wrongCheck = peerNetwork.validatePairingPin(regen.pin === '111111' ? '222222' : '111111');
    assert.equal(wrongCheck.ok, false);
    assert.equal((wrongCheck as any).errorCode, 'PIN_INVALID');
    console.log('[PASS] 1. PIN persists across restarts/tab-switches, uses 10m TTL, rotates on New Code, and distinguishes PIN_EXPIRED vs PIN_INVALID');

    // =========================================================================
    // 2. PAIRING ROUTING: TARGET DEVICE ID FIRST, PIN FALLBACK ONLY ON OFFLINE
    // =========================================================================
    resetHarness();
    const clientDs = createMemoryDataSource('android_client_1', 'Galaxy Phone');
    await startLocalServer('Galaxy Phone', 'android_client_1', clientDs.getSyncState(), clientDs);

    // Register remote target reachable on BOTH deterministic device ID and PIN ID
    const remoteDevPeer = new InMemoryPeer(formatDevicePeerId('remote_pc_99'));
    const remotePinPeer = new InMemoryPeer(formatPairingPinId('556677'));
    await new Promise<void>((r) => {
      let count = 0;
      const done = () => ++count === 2 && r();
      remoteDevPeer.on('open', done);
      remotePinPeer.on('open', done);
    });

    let pinFallbackHit = false;
    remoteDevPeer.on('connection', (conn: any) => {
      conn.on('data', (msg: any) => {
        if (msg?.type === 'request' && msg.route === '/api/sync/pair') {
          if (msg.data?.pairingPin === '556677') {
            conn.send({
              type: 'response',
              id: msg.id,
              data: {
                ok: true,
                authToken: 'glk_tok_dev_first',
                deviceId: 'remote_pc_99',
                deviceName: 'Remote Studio PC',
                protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION
              }
            });
          } else {
            conn.send({
              type: 'error',
              id: msg.id,
              errorCode: 'PIN_INVALID',
              error: 'Wrong PIN'
            });
          }
        }
      });
    });
    remotePinPeer.on('connection', (conn: any) => {
      pinFallbackHit = true;
      conn.on('data', (msg: any) => {
        if (msg?.type === 'request' && msg.route === '/api/sync/pair') {
          conn.send({
            type: 'response',
            id: msg.id,
            data: {
              ok: true,
              authToken: 'glk_tok_pin_fallback',
              deviceId: 'remote_pc_99',
              deviceName: 'Remote Studio PC',
              protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION
            }
          });
        }
      });
    });

    // Case A: Known targetDeviceId + PIN -> connects to glueck-dev-remote_pc_99 FIRST without falling back to PIN
    mockBroker.connectionLog.length = 0;
    const resDevFirst = await pairWithPeer('remote_pc_99', '556677', {
      deviceId: 'android_client_1',
      deviceName: 'Galaxy Phone'
    });
    assert.equal(resDevFirst.ok, true);
    assert.equal(resDevFirst.peer!.lastKnownIp, 'P2P (WebRTC)');
    assert.equal(resDevFirst.peer!.port, 0);
    assert.equal(resDevFirst.peer!.pairingToken, 'glk_tok_dev_first');
    assert.equal(resDevFirst.peer!.hasStoredAuthToken, true);
    assert.equal(resDevFirst.peer!.requiresRePairing, false);
    assert.deepEqual(mockBroker.connectionLog, ['glueck-dev-remote_pc_99']);
    assert.equal(pinFallbackHit, false);

    // Case B: Wrong PIN against reachable deterministic peer -> does NOT fall back to glueck-{PIN}
    mockBroker.connectionLog.length = 0;
    const resWrongPinNoFallback = await pairWithPeer('remote_pc_99', '999999', {
      deviceId: 'android_client_1',
      deviceName: 'Galaxy Phone'
    });
    assert.equal(resWrongPinNoFallback.ok, false);
    assert.equal(resWrongPinNoFallback.errorCode, 'PIN_INVALID');
    assert.equal(pinFallbackHit, false, 'PIN_INVALID must NEVER fall back to ephemeral PIN peer');
    assert.equal(
      mockBroker.connectionLog.some((id) => /^glueck-\d{6}$/.test(id)),
      false,
      'Wrong PIN must NEVER dial glueck-{PIN} after deterministic peer rejected it'
    );

    // Case C: Deterministic peer offline (PEER_OFFLINE) -> automatically falls back to glueck-556677
    remoteDevPeer.destroy();
    mockBroker.connectionLog.length = 0;
    const resFallback = await pairWithPeer('remote_pc_99', '556677', {
      deviceId: 'android_client_1',
      deviceName: 'Galaxy Phone'
    });
    assert.equal(resFallback.ok, true);
    assert.equal(resFallback.peer!.pairingToken, 'glk_tok_pin_fallback');
    assert.deepEqual(mockBroker.connectionLog, ['glueck-dev-remote_pc_99', 'glueck-556677']);
    assert.equal(pinFallbackHit, true);

    // Case D: Manual PIN entry ('', '556677') on fresh session -> connects directly to glueck-556677 without glueck-dev-
    peerNetwork.destroy();
    await startLocalServer('Galaxy Phone', 'android_client_1', clientDs.getSyncState(), clientDs);
    mockBroker.connectionLog.length = 0;
    const resDirectPin = await pairWithPeer('', '556677', {
      deviceId: 'android_client_1',
      deviceName: 'Galaxy Phone'
    });
    assert.equal(resDirectPin.ok, true);
    assert.deepEqual(mockBroker.connectionLog, ['glueck-556677']);
    remotePinPeer.destroy();
    console.log('[PASS] 2. pairWithPeer routes targetDeviceId first, falls back to PIN ONLY on PEER_OFFLINE, never substitutes PIN as targetDeviceId');

    // =========================================================================
    // 3. ACCOUNT-SCOPED PRESENCE ROOM DISCOVERY & FAILOVER
    // =========================================================================
    resetHarness();
    const roomAlice1 = await computeRoomId('uid_alice_123');
    const roomAlice2 = await computeRoomId('uid_alice_123');
    const roomBob = await computeRoomId('uid_bob_456');
    assert.match(roomAlice1, /^glueck-room-[0-9a-f]{16}$/);
    assert.equal(roomAlice1, roomAlice2);
    assert.notEqual(roomAlice1, roomBob);

    // Presence-only schema validation rejects sync deltas, tokens, PINs
    assert.equal(
      isValidPresenceMessage({
        type: 'announce',
        device: { deviceId: 'd1', deviceName: 'Phone', permanentPeerId: 'glueck-dev-d1', lastSeen: Date.now() }
      }),
      true
    );
    for (const forbidden of ['records', 'payload', 'delta', 'pairingToken', 'token', 'authToken', 'pin', 'pairingPin']) {
      assert.equal(
        isValidPresenceMessage({ type: 'announce', device: { deviceId: 'd1' }, [forbidden]: 'leak' }),
        false,
        `Presence room must reject top-level ${forbidden}`
      );
      assert.equal(
        isValidPresenceMessage({ type: 'announce', device: { deviceId: 'd1', [forbidden]: 'leak' } }),
        false,
        `Presence room must reject nested device.${forbidden}`
      );
    }

    // Host role: local Device A claims empty room -> remote Device B joins and announces -> A discovers B
    const stateHost = await presenceRoom.start({
      uid: 'uid_alice_123',
      deviceId: 'dev_a',
      deviceName: 'Device A',
      platform: 'web'
    });
    assert.equal(stateHost.status, 'hosting');
    assert.equal(stateHost.roomId, roomAlice1);

    const joinerB = new InMemoryPeer('peer_room_b');
    await new Promise<void>((r) => joinerB.on('open', () => r()));
    const connToA = joinerB.connect(roomAlice1);
    const receivedMembersPromise = new Promise<any[]>((resolve) => {
      connToA.on('data', (m: any) => {
        if (m?.type === 'members') resolve(m.devices);
      });
    });
    await new Promise<void>((r) => connToA.on('open', () => r()));
    // Send forbidden message first -> ignored by room host
    connToA.send({ type: 'announce', device: { deviceId: 'rogue_payload', pin: '123456' } });
    // Send valid announcement for Device B
    connToA.send({
      type: 'announce',
      device: {
        deviceId: 'dev_b',
        deviceName: 'Pixel Android B',
        permanentPeerId: 'glueck-dev-dev_b',
        lastSeen: Date.now(),
        platform: 'android'
      }
    });
    const membersList = await receivedMembersPromise;
    assert.ok(membersList.some((d) => d.deviceId === 'dev_b'));
    assert.ok(membersList.some((d) => d.deviceId === 'dev_a'));
    assert.equal(presenceRoom.getDiscoveredDevices().length, 1);
    assert.equal(presenceRoom.getDiscoveredDevices()[0].deviceId, 'dev_b');
    assert.equal(connectivityEngine.getDetails().discoveredCount, 1);

    // Joiner role + Failover election: remote holds room -> local becomes joined -> remote closes -> local wins failover!
    joinerB.destroy();
    __resetPresenceRoomForTests();
    presenceRoom.__setFailoverJitterForTests(10, 20);

    const remoteRoomHolder = new InMemoryPeer(roomAlice1);
    await new Promise<void>((r) => remoteRoomHolder.on('open', () => r()));
    remoteRoomHolder.on('connection', (serverConn: any) => {
      serverConn.on('data', (m: any) => {
        if (m?.type === 'announce') {
          serverConn.send({
            type: 'members',
            devices: [
              {
                deviceId: 'dev_remote_holder',
                deviceName: 'Remote iPad',
                permanentPeerId: 'glueck-dev-dev_remote_holder',
                lastSeen: Date.now(),
                platform: 'web'
              },
              m.device
            ]
          });
        }
      });
    });

    const stateJoined = await presenceRoom.start({
      uid: 'uid_alice_123',
      deviceId: 'dev_local_joiner',
      deviceName: 'Local Phone',
      platform: 'android'
    });
    // Wait briefly for DataConnection open + members broadcast
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(presenceRoom.getState().status, 'joined', `Expected joined state, got ${stateJoined.status}`);
    assert.equal(presenceRoom.getDiscoveredDevices()[0]?.deviceId, 'dev_remote_holder');

    // Different UID creates different room so Bob never discovers Alice
    assert.equal(mockBroker.peers.has(roomBob), false);

    // Kill holder -> local joiner executes jittered election and promotes to 'hosting'
    remoteRoomHolder.destroy();
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(presenceRoom.getState().status, 'hosting');
    assert.equal(mockBroker.peers.has(roomAlice1), true);

    // Sign out clears room and stops discovery
    const signedOutState = await presenceRoom.start({
      uid: null,
      deviceId: 'dev_local_joiner',
      deviceName: 'Local Phone'
    });
    assert.equal(signedOutState.status, 'signed_out');
    assert.equal(signedOutState.roomId, null);
    assert.equal(presenceRoom.getDiscoveredDevices().length, 0);
    console.log('[PASS] 3. Presence room isolates UIDs, blocks secrets/deltas, discovers devices, elects failover holder, and disables on sign-out');

    // =========================================================================
    // 4. REDISCOVERY LOOP & UNPAIRED DEVICE FILTERING
    // =========================================================================
    resetHarness();
    await presenceRoom.start({
      uid: 'uid_discovery',
      deviceId: 'dev_host',
      deviceName: 'Teacher Desktop'
    });

    // Inject two announced peers via remote room connection
    const d1ConnPeer = new InMemoryPeer('d_room_1');
    await new Promise<void>((r) => d1ConnPeer.on('open', () => r()));
    const rId = presenceRoom.getState().roomId!;
    const roomC = d1ConnPeer.connect(rId);
    await new Promise<void>((r) => roomC.on('open', () => r()));
    roomC.send({
      type: 'announce',
      device: {
        deviceId: 'already_paired_p2p',
        deviceName: 'Already Paired Phone',
        permanentPeerId: 'glueck-dev-already_paired_p2p',
        lastSeen: Date.now(),
        platform: 'android'
      }
    });
    roomC.send({
      type: 'announce',
      device: {
        deviceId: 'brand_new_device',
        deviceName: 'New Tablet',
        permanentPeerId: 'glueck-dev-brand_new_device',
        lastSeen: Date.now(),
        platform: 'web'
      }
    });
    await new Promise((r) => setTimeout(r, 30));

    // Also start responder for already_paired_p2p and run rediscoverPairedPeers
    const pairedTarget = new InMemoryPeer(formatDevicePeerId('already_paired_p2p'));
    await new Promise<void>((r) => pairedTarget.on('open', () => r()));
    pairedTarget.on('connection', (conn: any) => {
      conn.on('data', (msg: any) => {
        if (msg?.route === '/api/sync/ping') {
          conn.send({ type: 'response', id: msg.id, data: { ok: true, deviceId: 'already_paired_p2p' } });
        }
      });
    });

    const dsHost = createMemoryDataSource('dev_host', 'Teacher Desktop');
    await startLocalServer('Teacher Desktop', 'dev_host', dsHost.getSyncState(), dsHost);

    const pairedPeersList: PairedPeer[] = [
      {
        deviceId: 'already_paired_p2p',
        deviceName: 'Already Paired Phone',
        lastKnownIp: 'P2P (WebRTC)',
        port: 0,
        pairingToken: 'tok1',
        hasStoredAuthToken: true,
        lastSyncedTimestamp: 0,
        isOnline: false
      },
      {
        deviceId: 'legacy_lan_old',
        deviceName: 'Legacy LAN Box',
        lastKnownIp: '192.168.1.10',
        port: 8765,
        requiresRePairing: true,
        lastSyncedTimestamp: 0,
        isOnline: false
      }
    ];

    presenceService.updatePresenceManually('already_paired_p2p', false);
    const rediscoverRes = await rediscoverPairedPeers(pairedPeersList);
    assert.deepEqual(rediscoverRes.onlinePeerIds, ['already_paired_p2p']);
    assert.equal(rediscoverRes.checkedCount, 1, 'Legacy LAN peers must be skipped during P2P rediscovery');
    assert.equal(presenceService.getPresences().get('already_paired_p2p')?.isOnline, true);

    const newDiscovered = discoverNewDevices(pairedPeersList);
    assert.equal(newDiscovered.length, 1);
    assert.equal(newDiscovered[0].deviceId, 'brand_new_device');
    d1ConnPeer.destroy();
    pairedTarget.destroy();
    console.log('[PASS] 4. rediscoverPairedPeers wakes offline P2P peers & discoverNewDevices excludes already-paired P2P devices');

    // =========================================================================
    // 5. SILENT FAILURE ELIMINATION (BROKER DOWN, ID_IN_USE, ICE_FAILED, DEVICE_ID_MISSING)
    // =========================================================================
    resetHarness();

    // Missing deviceId guard on fetch
    await assert.rejects(
      () => peerNetwork.fetch('someone', '/api/sync/ping', {}),
      (err: any) => err?.errorCode === 'DEVICE_ID_MISSING'
    );

    // Signalling broker offline -> NO fake readiness, NO fake PIN!
    mockBroker.online = false;
    const brokerDownStatus = await startLocalServer('Web', 'web_broken', dsHost.getSyncState(), dsHost);
    assert.equal(brokerDownStatus.brokerConnected, false);
    assert.equal(brokerDownStatus.listening, false);
    assert.equal(brokerDownStatus.pin, '', 'Must NEVER issue a fake PIN when broker is disconnected');
    assert.equal(brokerDownStatus.errorCode, 'BROKER_DOWN');
    assert.equal(connectivityEngine.getStatusSummary().code, 'signalling_unreachable');

    // Unavailable ID collision: 3 failures -> ID_IN_USE
    mockBroker.online = true;
    mockBroker.unavailableIdRemainingAttempts.set(formatDevicePeerId('web_busy'), 5);
    const idBusyRes = await peerNetwork.startHost('web_busy');
    assert.equal(idBusyRes.brokerConnected, false);
    assert.equal(idBusyRes.errorCode, 'ID_IN_USE');
    assert.equal(connectivityEngine.getStatusSummary().code, 'id_in_use');

    // Transient unavailable-id resolving on retry #2 succeeds!
    mockBroker.unavailableIdRemainingAttempts.set(formatDevicePeerId('web_recover'), 2);
    const idRecoverRes = await peerNetwork.startHost('web_recover');
    assert.equal(idRecoverRes.brokerConnected, true);
    assert.equal(connectivityEngine.getStatusSummary().code, 'ready');

    // Discovered count status & ICE_FAILED
    connectivityEngine.setDiscoveredCount(2);
    assert.equal(connectivityEngine.getStatusSummary().code, 'discovered');
    assert.equal(connectivityEngine.getStatusSummary().label, 'Discovered 2 devices');

    mockBroker.iceFailTargets.add(formatDevicePeerId('ice_blocked_peer'));
    await assert.rejects(
      () => peerNetwork.fetch('ice_blocked_peer', '/api/sync/ping', {}, 500),
      (err: any) => err?.errorCode === 'ICE_FAILED'
    );
    console.log('[PASS] 5. Broker outage, ID_IN_USE retries, ICE_FAILED, DEVICE_ID_MISSING, and status summary verified loudly');

    // =========================================================================
    // 6. REAL ISO 18004 + REED-SOLOMON QR MATRIX -> RGBA BUFFER -> jsQR ROUND-TRIP
    // =========================================================================
    const qrJson = createPairingPayload('dev_qr_host', 'MacBook Pro', '739204');
    const matrix = createQrMatrix(qrJson);
    const scale = 4;
    const quiet = 4;
    const modCount = matrix.length;
    const imgWidth = (modCount + quiet * 2) * scale;
    const rgba = new Uint8ClampedArray(imgWidth * imgWidth * 4);
    rgba.fill(255); // Pure white background (alpha 255)
    for (let r = 0; r < modCount; r++) {
      for (let c = 0; c < modCount; c++) {
        if (!matrix[r][c]) continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = (quiet + c) * scale + dx;
            const py = (quiet + r) * scale + dy;
            const idx = (py * imgWidth + px) * 4;
            rgba[idx] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
            rgba[idx + 3] = 255;
          }
        }
      }
    }

    const decodedQrText = await scanQrFromSource({
      data: rgba,
      width: imgWidth,
      height: imgWidth,
      colorSpace: 'srgb'
    } as any);
    assert.ok(decodedQrText, 'jsQR must decode generated ISO 18004 Reed-Solomon QR matrix');
    const parsedQr = parsePairingPayload(decodedQrText!, PAIRING_PIN_TTL_MS);
    assert.equal(parsedQr.valid, true);
    assert.equal(parsedQr.expired, false);
    assert.equal(parsedQr.payload?.deviceId, 'dev_qr_host');
    assert.equal(parsedQr.payload?.pin, '739204');

    const expiredQr = parsePairingPayload(
      JSON.stringify({ app: 'glueck', v: 2, deviceId: 'd', pin: '123456', ts: Date.now() - PAIRING_PIN_TTL_MS - 1000 }),
      PAIRING_PIN_TTL_MS
    );
    assert.equal(expiredQr.valid, true);
    assert.equal(expiredQr.expired, true);
    console.log('[PASS] 6. ISO 18004 QR SVG/Matrix + GF(256) RS decodes cleanly via jsQR & enforces 10m TTL');

    // =========================================================================
    // 7. BIDIRECTIONAL SYNC, OFFLINE QUEUEING, LWW & TOMBSTONE RECONCILIATION
    // =========================================================================
    resetHarness();
    const baseTime = Date.now() - 20_000;
    const dsA = createMemoryDataSource(
      'dev_sync_a',
      'Web A',
      {
        students: [
          {
            id: 'stu_conflict',
            name: 'Older Local Name',
            updatedAt: baseTime + 1000,
            originDeviceId: 'dev_sync_a',
            updatedByDeviceId: 'dev_sync_a',
            originRevision: 1,
            deleted: false
          } as any,
          {
            id: 'stu_local_offline_edit',
            name: 'Edited Offline On Web',
            updatedAt: baseTime + 5000,
            originDeviceId: 'dev_sync_a',
            updatedByDeviceId: 'dev_sync_a',
            originRevision: 2,
            deleted: false
          } as any
        ]
      },
      [
        {
          deviceId: 'dev_sync_b',
          deviceName: 'Android B',
          lastKnownIp: 'P2P (WebRTC)',
          port: 0,
          pairingToken: 'tok_ab',
          hasStoredAuthToken: true,
          lastSyncedTimestamp: 0,
          isOnline: true,
          protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION
        }
      ]
    );

    const dsB = createMemoryDataSource(
      'dev_sync_b',
      'Android B',
      {
        students: [
          {
            id: 'stu_conflict',
            name: 'Newer Android Name',
            updatedAt: baseTime + 9000, // Newer LWW timestamp wins!
            originDeviceId: 'dev_sync_b',
            updatedByDeviceId: 'dev_sync_b',
            originRevision: 3,
            deleted: false
          } as any,
          {
            id: 'stu_to_purge',
            name: 'Deleted Student',
            updatedAt: baseTime + 2000,
            originDeviceId: 'dev_sync_b',
            updatedByDeviceId: 'dev_sync_b',
            originRevision: 4,
            deleted: false
          } as any
        ],
        settings: [
          {
            id: 'singleton_teacher_settings',
            profile: {} as any,
            recentlyDeleted: {
              students: [],
              groups: [],
              lessons: [],
              purgedRecords: [
                { id: 'stu_to_purge', type: 'student', purgedAt: new Date().toISOString(), updatedAt: baseTime + 10000 }
              ]
            },
            updatedAt: baseTime + 10000,
            deleted: false
          } as any
        ]
      }
    );

    // Offline attempt fails loudly when peer offline, preserves local data
    await startLocalServer('Web A', 'dev_sync_a', dsA.getSyncState(), dsA);
    const offlineSync = await runSyncCycle('dev_sync_b', dsA, 'Auto Sync');
    assert.equal(offlineSync.success, false);

    // Bring Android B online and run bidirectional sync
    const peerBHost = new InMemoryPeer(formatDevicePeerId('dev_sync_b'));
    await new Promise<void>((r) => peerBHost.on('open', () => r()));
    peerBHost.on('connection', (conn: any) => {
      conn.on('data', async (msg: any) => {
        if (msg?.type === 'request' && msg.route === '/api/sync/exchange') {
          const outDelta = await handleInboundExchange(msg.data.delta, dsB);
          conn.send({ type: 'response', id: msg.id, data: { ok: true, delta: outDelta } });
        }
      });
    });

    const onlineSync = await runSyncCycle('dev_sync_b', dsA, 'Manual Sync');
    assert.equal(onlineSync.success, true);

    const aStudents = (dsA.getLocalData()['students'] || []) as any[];
    const bStudents = (dsB.getLocalData()['students'] || []) as any[];
    assert.equal(aStudents.find((s) => s.id === 'stu_conflict')?.name, 'Newer Android Name');
    assert.equal(bStudents.find((s) => s.id === 'stu_local_offline_edit')?.name, 'Edited Offline On Web');
    assert.equal(aStudents.some((s: any) => s.id === 'stu_to_purge'), false);
    assert.equal(bStudents.some((s: any) => s.id === 'stu_to_purge'), false);
    peerBHost.destroy();
    console.log('[PASS] 7. Offline retry queueing, bilateral P2P delta sync, LWW convergence & purged tombstones verified');

    console.log('ALL P2P SYNC & DISCOVERY TESTS PASSED!');
  } finally {
    resetHarness();
  }
}

runTests().catch((err) => {
  console.error('P2P SYNC & DISCOVERY TEST FAILED:', err);
  process.exit(1);
});
