import { Express, Request, Response } from 'express';
import { SyncStateMetadata, PairedPeer } from '../../types';

// Mock storage for paired peers to validate tokens
const mockPairedPeers = new Map<string, PairedPeer>();

export function setupSyncRoutes(app: Express, localSyncState: SyncStateMetadata, pairingPin: string) {
  // Ping Endpoint: Discovery and health check
  app.get('/api/sync/ping', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      deviceId: localSyncState.localDeviceId,
      deviceName: localSyncState.localDeviceName,
    });
  });

  // Pair Endpoint: Establishes a secure token via PIN
  app.post('/api/sync/pair', (req: Request, res: Response) => {
    try {
      const { pin, deviceId, deviceName } = req.body;

      if (pin !== pairingPin) {
        return res.status(401).json({ error: 'Invalid PIN' });
      }

      // Generate a secure pairing token
      const pairingToken =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'token_' + Date.now() + Math.random().toString(36).substring(2);

      // Save peer to mock persistent storage
      mockPairedPeers.set(pairingToken, {
        deviceId,
        deviceName,
        lastKnownIp: req.ip || '',
        port: 0, // Port of the client is generally not needed if client initiates
        pairingToken,
        lastSyncedTimestamp: 0,
        isOnline: true,
      });

      res.json({ pairingToken });
    } catch (error) {
      console.error('Error during pairing:', error);
      res.status(500).json({ error: 'Internal server error during pairing' });
    }
  });

  // Exchange Endpoint: Delta payload synchronization
  app.post('/api/sync/exchange', (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }

      const token = authHeader.split(' ')[1];

      // Validate token against our paired peers
      if (!mockPairedPeers.has(token)) {
        return res.status(401).json({ error: 'Invalid pairing token. Device not paired.' });
      }

      // const payload = req.body; // Expected to be of type SyncDeltaPayload
      // Merge injection logic will happen here in the future

      // Return placeholder success
      res.json({ status: 'received' });
    } catch (error) {
      console.error('Error during sync exchange:', error);
      res.status(500).json({ error: 'Internal server error during exchange' });
    }
  });
}
