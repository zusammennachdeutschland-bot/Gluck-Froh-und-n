import React, { useState } from 'react';
import { 
  Monitor, Smartphone, Tablet, RefreshCw, MoreVertical, 
  Trash2, Edit2, Shield, Check, Wifi, Clock, Activity, 
  ArrowRight, ShieldCheck, AlertCircle, Plus, Sparkles, X
} from 'lucide-react';
import { PairedPeer, DevicePresenceState } from '../../types';
import { CopyableBlock } from './CopyableBlock';
import { useApp } from '../../context/AppContext';

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
  const { _t } = useApp();
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
        <span className="text-xs font-black uppercase tracking-wider text-text-muted block mb-2">
          {_t('هذا الجهاز (الهوية المحلية)', 'This Device (Host Identity)', 'Dieses Gerät (Host-Identität)')}
        </span>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-primary/20 bg-primary-soft">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md shrink-0">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              {editingLocal ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={localNameInput}
                    onChange={(e) => setLocalNameInput(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-xl border border-surface-border bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                    onKeyDown={(e) => e.key === 'Enter' && handleLocalRename()}
                    autoFocus
                  />
                  <button type="button" onClick={handleLocalRename} className="p-1.5 text-primary hover:bg-surface rounded-lg cursor-pointer">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-text-main">{localDevice.name}</h4>
                  <button 
                    type="button" 
                    onClick={() => { setEditingLocal(true); setLocalNameInput(localDevice.name); }} 
                    className="text-text-muted hover:text-primary transition-colors cursor-pointer p-1"
                    title={_t('إعادة تسمية هذا الجهاز', 'Rename this device', 'Dieses Gerät umbenennen')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <span className="text-xs font-mono text-text-muted">
                {_t('معرف الجهاز:', 'Device ID:', 'Geräte-ID:')} {localDevice.id.slice(0, 12)}...
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-primary text-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
              {_t('الجهاز الرئيسي', 'Primary Node', 'Haupt-Knoten')}
            </span>
          </div>
        </div>
      </div>

      {/* Linked Devices Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-text-muted">
            {_t('الأجهزة الموثوقة والمرتبطة', 'Trusted & Linked Devices', 'Verknüpfte Geräte')} ({pairedPeers.length})
          </span>
          <button
            type="button"
            onClick={onOpenPairing}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{_t('ربط جهاز جديد', 'Link New Device', 'Neues Gerät koppeln')}</span>
          </button>
        </div>

        {pairedPeers.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-surface-border bg-surface">
            <Smartphone className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm font-bold text-text-main">{_t('لا توجد أجهزة متصلة بعد', 'No linked companion devices', 'Keine verknüpften Geräte')}</p>
            <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
              {_t('قم باقتران هاتفك أو جهازك اللوحي لمزامنة البيانات ثنائياً فوراً.', 'Pair your tablet or mobile phone for instant bidirectional syncing.', 'Koppeln Sie Ihr Smartphone oder Tablet für sofortige Synchronisation.')}
            </p>
            <button
              type="button"
              onClick={onOpenPairing}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{_t('اقتران جهاز الآن', 'Pair Device Now', 'Jetzt Gerät koppeln')}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
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
                  className="p-4 rounded-2xl border border-surface-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-12 h-12 rounded-2xl bg-surface-hover text-text-main flex items-center justify-center border border-surface-border shrink-0">
                      {getDeviceIcon(peer.deviceName)}
                      <span 
                        className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface ${
                          isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-text-muted/40'
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
                            className="px-3 py-1 text-sm rounded-xl border border-surface-border bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                            onKeyDown={(e) => e.key === 'Enter' && handlePeerRename(peer.deviceId)}
                            autoFocus
                          />
                          <button type="button" onClick={() => handlePeerRename(peer.deviceId)} className="p-1 text-primary cursor-pointer">
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-text-main">{peer.deviceName}</h4>
                          <button
                            type="button"
                            onClick={() => { setEditingPeerId(peer.deviceId); setPeerNameInput(peer.deviceName); }}
                            className="text-text-muted hover:text-primary transition-colors cursor-pointer p-0.5"
                            title={_t('إعادة تسمية الجهاز', 'Rename device', 'Gerät umbenennen')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-text-muted/50'}`} />
                          {isOnline ? _t('متصل الآن', 'Online Now', 'Online') : `${_t('آخر ظهور', 'Last seen', 'Zuletzt gesehen')} ${new Date(peer.lastSyncedTimestamp || Date.now()).toLocaleDateString()}`}
                        </span>
                        {isOnline && typeof latency === 'number' && (
                          <span className="font-mono text-[10px] bg-surface-hover px-2 py-0.5 rounded-md border border-surface-border">
                            {latency}ms
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-text-muted">v{peer.protocolVersion || 2}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleSyncAction(peer.deviceId, false)}
                      disabled={isSyncing}
                      className="px-3.5 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{_t('مزامنة', 'Sync', 'Sync')}</span>
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdownId(openDropdownId === peer.deviceId ? null : peer.deviceId)}
                        className="p-2 rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-main border border-surface-border cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openDropdownId === peer.deviceId && (
                        <div className="absolute right-0 rtl:left-0 rtl:right-auto top-full mt-1.5 w-52 rounded-2xl border border-surface-border bg-surface shadow-xl z-20 overflow-hidden text-xs py-1">
                          <button
                            type="button"
                            onClick={() => { handleSyncAction(peer.deviceId, true); setOpenDropdownId(null); }}
                            className="w-full px-4 py-2.5 text-left rtl:text-right text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer font-bold"
                          >
                            <RefreshCw className="w-4 h-4 text-primary" />
                            <span>{_t('فرض مزامنة شاملة', 'Force Full Sync', 'Vollständige Sync erzwingen')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedPeerDetails(peer); setOpenDropdownId(null); }}
                            className="w-full px-4 py-2.5 text-left rtl:text-right text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer"
                          >
                            <Activity className="w-4 h-4 text-text-muted" />
                            <span>{_t('عرض تفاصيل الأمان', 'View Security Details', 'Sicherheitsdetails')}</span>
                          </button>
                          <div className="h-px bg-surface-border my-1" />
                          <button
                            type="button"
                            onClick={() => { onUnpair(peer.deviceId); setOpenDropdownId(null); }}
                            className="w-full px-4 py-2.5 text-left rtl:text-right text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 font-bold cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{_t('إلغاء الاقتران والحذف', 'Revoke Trust & Unpair', 'Entkoppeln & Löschen')}</span>
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
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-surface-border p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h4 className="text-base font-black text-text-main flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                {_t('ملف أمان الجهاز', 'Device Security Profile', 'Gerätesicherheits-Profil')}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedPeerDetails(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2.5 text-text-muted">
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span>{_t('اسم الجهاز', 'Device Name', 'Gerätename')}</span>
                <span className="font-bold text-text-main">{selectedPeerDetails.deviceName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span>{_t('معرف الجهاز', 'Device ID', 'Geräte-ID')}</span>
                <span className="font-mono text-text-main">{selectedPeerDetails.deviceId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span>{_t('بروتوكول التفاوض', 'Negotiated Protocol', 'Protokoll')}</span>
                <span className="font-mono text-text-main">v{selectedPeerDetails.protocolVersion || 2}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span>{_t('القدرات المدعومة', 'Supported Capabilities', 'Fähigkeiten')}</span>
                <span className="font-mono text-text-main">{selectedPeerDetails.capabilities?.join(', ') || 'base_sync_v1, delta_watermark_v2'}</span>
              </div>
            </div>

            <CopyableBlock
              title={_t('بيانات التشفير والاقتران الخام', 'Raw Peer Crypto Metadata', 'Peer-Krypto-Metadaten')}
              content={JSON.stringify(selectedPeerDetails, null, 2)}
            />

            <button
              type="button"
              onClick={() => setSelectedPeerDetails(null)}
              className="w-full py-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-xs font-bold text-text-main cursor-pointer"
            >
              {_t('إغلاق التفاصيل', 'Close Details', 'Schließen')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
