import { peerNetwork } from './peerNetwork';
import { SyncStateMetadata, PairedPeer } from '../../types';
import { SyncDataSource, handleInboundExchange } from './syncOrchestrator';
import { createProtocolHeader, negotiateProtocol, adaptOutboundPayloadForPeer, findAuthenticatedPeer } from './protocolNegotiator';

export { findAuthenticatedPeer };

export async function startLocalServer(
  deviceName: string, 
  deviceId: string,
  syncState: SyncStateMetadata,
  dataSource: SyncDataSource
): Promise<{ ip: string; pin: string; port: number }> {
  
  // Start the permanent host node for this device using deterministic deviceId
  console.log(`[LocalServer] Starting WebRTC host node for ${deviceName} (${deviceId})`);
  await peerNetwork.startHost(deviceId);

  // Generate an ephemeral 6-digit PIN for pairing handshake (expires in 3 minutes or after 1 successful pairing)
  const mockPin = Math.floor(100000 + Math.random() * 900000).toString();
  await peerNetwork.enablePairingPin(mockPin, 180000);

  peerNetwork.setRouteHandler(async (route: string, data: any) => {
    if (route === '/api/sync/ping') {
      const negotiation = negotiateProtocol(data?.header);
      return {
        status: 'ok',
        deviceId: deviceId,
        deviceName: deviceName,
        header: createProtocolHeader(),
        negotiatedVersion: negotiation.negotiatedVersion,
        agreedCapabilities: negotiation.agreedCapabilities,
      };
    }
    
    if (route === '/api/sync/pair') {
      const { pin, deviceId: incomingId, deviceName: incomingName, header: incomingHeader } = data;
      const activePin = peerNetwork.currentPairingPin;
      if (!pin || !activePin || pin !== activePin) {
        throw new Error('Invalid or expired PIN');
      }
      
      const negotiation = negotiateProtocol(incomingHeader);
      if (negotiation.status === 'upgrade_required') {
        throw new Error(negotiation.message || 'Protocol version mismatch');
      }

      const pairingToken = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'token_' + Date.now() + Math.random().toString(36).substring(2);
          
      const newPeer: PairedPeer = {
        deviceId: incomingId,
        deviceName: incomingName || 'Companion Device',
        lastKnownIp: 'P2P (WebRTC)',
        port: 0, 
        pairingToken,
        lastSyncedTimestamp: 0,
        isOnline: true,
        protocolVersion: negotiation.negotiatedVersion,
        capabilities: negotiation.agreedCapabilities,
        lastHeartbeat: Date.now()
      };

      const currentState = dataSource.getSyncState();
      const updatedPeers = [...(currentState.pairedPeers || []).filter(p => p.deviceId !== incomingId), newPeer];
      
      await dataSource.updateSyncState({
        ...currentState,
        pairedPeers: updatedPeers
      });

      // Invalidate ephemeral PIN immediately after successful pairing (single-use)
      peerNetwork.disablePairingPin();

      return { 
        pairingToken, 
        peerId: deviceId, 
        deviceName,
        header: createProtocolHeader(),
        negotiatedVersion: negotiation.negotiatedVersion,
        agreedCapabilities: negotiation.agreedCapabilities,
        status: 'compatible'
      };
    }
    
    if (route === '/api/sync/exchange') {
      const { token, payload } = data;
      const currentState = dataSource.getSyncState();
      const matchedPeer = findAuthenticatedPeer(currentState.pairedPeers, token);

      if (!matchedPeer) {
        throw new Error('Invalid pairing token. Device not paired.');
      }
      
      // Use the orchestrator to merge the incoming records and generate the response delta
      const outboundDelta = await handleInboundExchange(payload, dataSource);
      
      // Adapt outbound delta to peer's capabilities
      const agreedCapabilities = matchedPeer.capabilities || ['core_entities'];
      const negotiatedVersion = matchedPeer.protocolVersion || 1;
      return adaptOutboundPayloadForPeer(outboundDelta, negotiatedVersion, agreedCapabilities);
    }

    if (route === '/api/sync/heartbeat') {
      return {
        status: 'ok',
        timestamp: Date.now(),
        header: createProtocolHeader()
      };
    }

    throw new Error('Route not found');
  });

  return {
    ip: 'P2P (WebRTC)',
    pin: mockPin,
    port: 0
  };
}
