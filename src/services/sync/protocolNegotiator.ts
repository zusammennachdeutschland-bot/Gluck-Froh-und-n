import { 
  CURRENT_SYNC_PROTOCOL_VERSION, 
  MIN_SUPPORTED_SYNC_PROTOCOL_VERSION, 
  APP_BUILD_VERSION, 
  DEFAULT_CAPABILITIES, 
  ProtocolHeader, 
  SyncCapability,
  SyncDeltaPayload
} from '../../types';

export interface NegotiationResult {
  negotiatedVersion: number;
  agreedCapabilities: SyncCapability[];
  status: 'compatible' | 'upgrade_required' | 'incompatible';
  isLegacy: boolean;
  message?: string;
}

/**
 * Creates a standard ProtocolHeader for outbound requests and responses.
 */
export function createProtocolHeader(customCapabilities?: SyncCapability[]): ProtocolHeader {
  return {
    protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION,
    minSupportedVersion: MIN_SUPPORTED_SYNC_PROTOCOL_VERSION,
    appVersion: APP_BUILD_VERSION,
    capabilities: customCapabilities || DEFAULT_CAPABILITIES,
    timestamp: Date.now()
  };
}

/**
 * Negotiates protocol version and agreed capabilities between local device and remote peer.
 * Gracefully handles legacy peers (v1) that do not send a ProtocolHeader.
 */
export function negotiateProtocol(remoteHeader?: ProtocolHeader): NegotiationResult {
  // Legacy peer fallback: If no header is provided, assume Version 1 with core entities only
  if (!remoteHeader || typeof remoteHeader.protocolVersion !== 'number') {
    return {
      negotiatedVersion: 1,
      agreedCapabilities: ['core_entities'],
      status: 'compatible',
      isLegacy: true,
      message: 'Peer running legacy Sync Protocol v1. Operating in backward compatibility mode.'
    };
  }

  const remoteVersion = remoteHeader.protocolVersion;
  const remoteMinSupported = remoteHeader.minSupportedVersion || 1;

  // Check version support boundaries
  if (remoteVersion < MIN_SUPPORTED_SYNC_PROTOCOL_VERSION) {
    return {
      negotiatedVersion: 0,
      agreedCapabilities: [],
      status: 'upgrade_required',
      isLegacy: false,
      message: `Remote device is running an outdated sync protocol (v${remoteVersion}). Minimum required is v${MIN_SUPPORTED_SYNC_PROTOCOL_VERSION}.`
    };
  }

  if (CURRENT_SYNC_PROTOCOL_VERSION < remoteMinSupported) {
    return {
      negotiatedVersion: 0,
      agreedCapabilities: [],
      status: 'upgrade_required',
      isLegacy: false,
      message: `This device requires an update to sync with the remote device (requires v${remoteMinSupported}+).`
    };
  }

  // Negotiate version: Minimum of both supported protocol versions
  const negotiatedVersion = Math.min(CURRENT_SYNC_PROTOCOL_VERSION, remoteVersion);

  // Compute capability intersection
  const remoteCapabilities = Array.isArray(remoteHeader.capabilities) ? remoteHeader.capabilities : ['core_entities'];
  const agreedCapabilities = DEFAULT_CAPABILITIES.filter(cap => remoteCapabilities.includes(cap));

  return {
    negotiatedVersion,
    agreedCapabilities,
    status: 'compatible',
    isLegacy: negotiatedVersion === 1,
    message: `Negotiated Protocol v${negotiatedVersion} with ${agreedCapabilities.length} active capabilities.`
  };
}

/**
 * Checks if a specific capability was agreed upon during negotiation.
 */
export function isCapabilitySupported(agreedCapabilities: SyncCapability[], capability: SyncCapability): boolean {
  return agreedCapabilities.includes(capability);
}

/**
 * Adapts an outbound delta payload according to negotiated capabilities.
 * Filters out unsupported entities (e.g., settings on v1 peers) to guarantee backward compatibility.
 */
export function adaptOutboundPayloadForPeer(
  payload: SyncDeltaPayload,
  negotiatedVersion: number,
  agreedCapabilities: SyncCapability[]
): SyncDeltaPayload {
  const adaptedPayload: SyncDeltaPayload = {
    header: createProtocolHeader(agreedCapabilities),
    senderDeviceId: payload.senderDeviceId,
    senderDeviceName: payload.senderDeviceName,
    peerWatermarks: payload.peerWatermarks,
    records: { ...payload.records },
    metadata: {
      totalEntitiesCount: Object.values(payload.records).reduce((acc, curr) => acc + (curr ? curr.length : 0), 0)
    }
  };

  // If settings_sync is not supported by the peer, exclude settings to prevent peer ingestion errors
  if (!isCapabilitySupported(agreedCapabilities, 'settings_sync') && adaptedPayload.records.settings) {
    delete adaptedPayload.records.settings;
  }

  // If todos_sync is not supported, exclude todos
  if (!isCapabilitySupported(agreedCapabilities, 'todos_sync') && adaptedPayload.records.todos) {
    delete adaptedPayload.records.todos;
  }

  return adaptedPayload;
}
