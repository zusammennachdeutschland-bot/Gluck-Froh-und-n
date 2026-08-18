import React, { useState } from 'react';
import { 
  Monitor, Smartphone, Tablet, RefreshCw, MoreVertical, 
  Trash2, Edit2, Shield, Check, Wifi, Clock, Activity, 
  ArrowRight, ShieldCheck, AlertCircle 
} from 'lucide-react';
import { PairedPeer, DevicePresenceState } from '../../types';
import { CopyableBlock } from './CopyableBlock';

interface LinkedDevicesHubProps {
  localDevice: { id: string; name: string };
  pairedPeers: PairedPeer[];
  devicePresences: Map<string, DevicePresenceState>;
  onRenameLocalDevice: (newName: string) => void;
  onRenamePeer: (peerId: string, newName: string) => void;
  onUnpair: (peerId: string) => void;
  onSyncPeer: (peerId: string) => Promise<void>;
  onForceSyncPeer: (peerId: string) => Promise<void>;
  onOpenPairing: () => void;
  id?: string;
}

export const LinkedDevicesHub: React.FC<LinkedDevicesHubProps> = ({
  localDevice,
  pairedPeers,
  devicePresences,
  onRenameLocalDevice,
  onRenamePeer,
  onUnpair,
  onSyncPeer,
  onForceSyncPeer,
  onOpenPairing,
  id
}) => {
  const [editingLocal, setEditingLocal] = useState(false);
  const [localNameInput, setLocalNameInput] = useState(localDevice.name);
  const [editingPeerId, setEditingPeerId] = useState<string | null>(null);
  const [peerNameInput, setPeerNameInput] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedPeerDetails, setSelectedPeerDetails] = useState<PairedPeer | null>(null);
  const [syncingPeerId, setSyncingPeerId] = useState<string | null>(null);

  const getDeviceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('phone') || lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
      return <Smartphone className="w-5 h-5" />;
    }
    if (lower.includes('tablet') || lower.includes('ipad')) {
      return <Tablet className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  const handleLocalRename = () => {
    if (localNameInput.trim()) {
      onRenameLocalDevice(localNameInput.trim());
    }
    setEditingLocal(false);
  };

  const handlePeerRename = (peerId: string) => {
    if (peerNameInput.trim()) {
      onRenamePeer(peerId, peerNameInput.trim());
    }
    setEditingPeerId(null);
  };

  const handleSyncAction = async (peerId: string, isForce: boolean) => {
    setSyncingPeerId(peerId);
    try {
      if (isForce) {
        await onForceSyncPeer(peerId);
      } else {
        await onSyncPeer(peerId);
      }
    } finally {
      setSyncingPeerId(null);
    }
  };

  return (
    <div id={id} className="space-y-6">
      {/* This Device Card */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">
          This Device (Host Identity)
        </span>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              {editingLocal ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={localNameInput}
                    onChange={(e) => setLocalNameInput(e.target.value)}
                    className="px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    onKeyDown={(e) => e.key === 'Enter' && handleLocalRename()}
                    autoFocus
                  />
                  <button type="button" onClick={handleLocalRename} className="p-1 text-emerald-600">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{localDevice.name}</h4>
                  <button 
                    type="button" 
                    onClick={() => { setEditingLocal(true); setLocalNameInput(localDevice.name); }} 
                    className="text-gray-400 hover:text-blue-600"
                    title="Rename this device"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                Device ID: {localDevice.id.slice(0, 12)}...
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Primary Node
            </span>
          </div>
        </div>
      </div>

      {/* Linked Devices Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Trusted & Linked Devices ({pairedPeers.length})
          </span>
          <button
            type="button"
            onClick={onOpenPairing}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>+ Link New Device</span>
          </button>
        </div>

        {pairedPeers.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
            <Smartphone className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No linked companion devices</p>
            <p className="text-xs text-gray-500 mt-1">Pair your tablet or mobile phone for bidirectional syncing.</p>
            <button
              type="button"
              onClick={onOpenPairing}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <span>Pair Device Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pairedPeers.map(peer => {
              const presence = devicePresences.get(peer.deviceId);
              const isOnline = presence ? presence.isOnline : false;
              const latency = presence?.latencyMs;
              const isSyncing = syncingPeerId === peer.deviceId;

              return (
                <div
                  key={peer.deviceId}
                  className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center">
                      {getDeviceIcon(peer.deviceName)}
                      <span 
                        className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                          isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                        }`} 
                      />
                    </div>

                    <div>
                      {editingPeerId === peer.deviceId ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={peerNameInput}
                            onChange={(e) => setPeerNameInput(e.target.value)}
                            className="px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            onKeyDown={(e) => e.key === 'Enter' && handlePeerRename(peer.deviceId)}
                            autoFocus
                          />
                          <button type="button" onClick={() => handlePeerRename(peer.deviceId)} className="p-1 text-emerald-600">
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{peer.deviceName}</h4>
                          <button
                            type="button"
                            onClick={() => { setEditingPeerId(peer.deviceId); setPeerNameInput(peer.deviceName); }}
                            className="text-gray-400 hover:text-blue-600"
                            title="Rename device"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {isOnline ? 'Online Now' : `Last seen ${new Date(peer.lastSyncedTimestamp || Date.now()).toLocaleDateString()}`}
                        </span>
                        {isOnline && typeof latency === 'number' && (
                          <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            {latency}ms
                          </span>
                        )}
                        <span className="font-mono text-[10px]">v{peer.protocolVersion || 2}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleSyncAction(peer.deviceId, false)}
                      disabled={isSyncing}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sync</span>
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdownId(openDropdownId === peer.deviceId ? null : peer.deviceId)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openDropdownId === peer.deviceId && (
                        <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl z-20 overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => { handleSyncAction(peer.deviceId, true); setOpenDropdownId(null); }}
                            className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Force Full Sync</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedPeerDetails(peer); setOpenDropdownId(null); }}
                            className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                          >
                            <Activity className="w-3.5 h-3.5 text-indigo-600" />
                            <span>View Security Details</span>
                          </button>
                          <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
                          <button
                            type="button"
                            onClick={() => { onUnpair(peer.deviceId); setOpenDropdownId(null); }}
                            className="w-full px-4 py-2.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke Trust & Unpair</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Details Modal */}
      {selectedPeerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                Device Security Profile
              </h4>
              <button
                type="button"
                onClick={() => setSelectedPeerDetails(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2 text-gray-600 dark:text-gray-300">
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-400">Device Name</span>
                <span className="font-semibold">{selectedPeerDetails.deviceName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-400">Device ID</span>
                <span className="font-mono">{selectedPeerDetails.deviceId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-400">Negotiated Protocol</span>
                <span className="font-mono">v{selectedPeerDetails.protocolVersion || 2}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-400">Supported Capabilities</span>
                <span className="font-mono">{selectedPeerDetails.capabilities?.join(', ') || 'base_sync_v1, delta_watermark_v2'}</span>
              </div>
            </div>

            <CopyableBlock
              title="Raw Peer Crypto Metadata"
              content={JSON.stringify(selectedPeerDetails, null, 2)}
            />

            <button
              type="button"
              onClick={() => setSelectedPeerDetails(null)}
              className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-xs font-bold text-gray-800 dark:text-gray-200"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
