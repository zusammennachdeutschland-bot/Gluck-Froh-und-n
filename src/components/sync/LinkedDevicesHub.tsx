import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  MoreVertical,
  Trash2,
  Edit2,
  Shield,
  Check,
  ShieldCheck,
  AlertTriangle,
  Plus,
  X
} from 'lucide-react';
import { PairedPeer, DevicePresenceState } from '../../types';
import { CopyableBlock } from './CopyableBlock';
import { isLegacyLanOnlyPeer } from '../../services/sync/syncMigration';
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
  onOpenPairing: (prefillPeer?: PairedPeer) => void;
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
      return <Smartphone className="w-4 h-4" />;
    }
    if (lower.includes('tablet') || lower.includes('ipad')) {
      return <Tablet className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
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

  const redactPeer = (peer: PairedPeer) => {
    const { pairingToken, ...rest } = peer;
    return {
      ...rest,
      ...(pairingToken ? { pairingToken: '[REDACTED]' } : {})
    };
  };

  return (
    <div id={id} className="space-y-5">
      {/* This Device Identity Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-primary/20 bg-primary-soft">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-fg flex items-center justify-center shrink-0">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            {editingLocal ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={localNameInput}
                  onChange={(e) => setLocalNameInput(e.target.value)}
                  className="px-2.5 py-1 text-sm rounded-lg border border-surface-border bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => e.key === 'Enter' && handleLocalRename()}
                  autoFocus
                />
                <button type="button" onClick={handleLocalRename} className="p-1 text-primary cursor-pointer">
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-text-main">{localDevice.name}</h4>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLocal(true);
                    setLocalNameInput(localDevice.name);
                  }}
                  className="text-text-muted hover:text-primary p-1 cursor-pointer"
                  title={_t('تعديل الاسم', 'Rename Device', 'Umbenennen')}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <span className="text-[11px] font-mono text-text-muted">
              ID: {localDevice.id.slice(0, 12)}
            </span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
          <ShieldCheck className="w-4 h-4" />
          {_t('الجهاز المحلي', 'Local Device', 'Dieses Gerät')}
        </span>
      </div>

      {/* Paired Devices List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {_t('الأجهزة المقترنة عبر P2P', 'Paired P2P Devices', 'Gekoppelte P2P-Geräte')} ({pairedPeers.length})
          </span>
          <button
            type="button"
            onClick={() => onOpenPairing()}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{_t('إضافة جهاز', 'Pair Device', 'Gerät koppeln')}</span>
          </button>
        </div>

        {pairedPeers.length === 0 ? (
          <div className="p-6 text-center rounded-2xl border border-dashed border-surface-border bg-surface space-y-3">
            <Smartphone className="w-8 h-8 text-text-muted mx-auto" />
            <div>
              <p className="text-sm font-bold text-text-main">{_t('لا توجد أجهزة مقترنة بعد', 'No paired devices yet', 'Keine gekoppelten Geräte')}</p>
              <p className="text-xs text-text-muted mt-0.5">
                {_t('اقرن أجهزة Android والويب مباشرة عبر رمز QR أو الرمز السداسي.', 'Pair mobile and web devices directly using QR code or 6-digit PIN.', 'Geräte direkt per QR-Code oder 6-stelliger PIN koppeln.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenPairing()}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold cursor-pointer"
            >
              {_t('إقران جهاز الآن', 'Pair Device Now', 'Jetzt Gerät koppeln')}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pairedPeers.map((peer) => {
              const presence = devicePresences.get(peer.deviceId);
              const needsRePair = isLegacyLanOnlyPeer(peer);
              const isOnline = !needsRePair && (presence ? presence.isOnline : false);
              const latency = presence?.latencyMs ?? peer.latencyMs;
              const isSyncing = syncingPeerId === peer.deviceId;

              return (
                <div
                  key={peer.deviceId}
                  className="p-3.5 rounded-2xl border border-surface-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="relative w-10 h-10 rounded-xl bg-surface-hover text-text-main flex items-center justify-center border border-surface-border shrink-0">
                      {getDeviceIcon(peer.deviceName)}
                      <span
                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-surface ${
                          needsRePair ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-text-muted/40'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      {editingPeerId === peer.deviceId ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={peerNameInput}
                            onChange={(e) => setPeerNameInput(e.target.value)}
                            className="px-2.5 py-1 text-xs rounded-lg border border-surface-border bg-background text-text-main"
                            onKeyDown={(e) => e.key === 'Enter' && handlePeerRename(peer.deviceId)}
                            autoFocus
                          />
                          <button type="button" onClick={() => handlePeerRename(peer.deviceId)} className="p-1 text-primary cursor-pointer">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-text-main truncate">{peer.deviceName}</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPeerId(peer.deviceId);
                              setPeerNameInput(peer.deviceName);
                            }}
                            className="text-text-muted hover:text-primary p-0.5 cursor-pointer"
                            title={_t('إعادة تسمية', 'Rename', 'Umbenennen')}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2.5 text-[11px] text-text-muted mt-0.5 flex-wrap font-mono tabular-nums">
                        {needsRePair ? (
                          <span className="text-amber-600 dark:text-amber-400 font-sans font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {_t('يتطلب إعادة اقتران عبر P2P', 'Re-pair required', 'Erneute Kopplung erforderlich')}
                          </span>
                        ) : (
                          <>
                            <span>P2P (WebRTC)</span>
                            {peer.iceCandidateType && (
                              <span className="text-primary">ICE: {peer.iceCandidateType}</span>
                            )}
                            <span className={isOnline ? 'text-emerald-600 dark:text-emerald-400 font-sans font-semibold' : 'font-sans'}>
                              {isOnline
                                ? typeof latency === 'number'
                                  ? `${_t('متصل', 'Connected', 'Verbunden')} · ${latency}ms`
                                  : _t('متصل', 'Connected', 'Verbunden')
                                : _t('غير متصل', 'Offline', 'Offline')}
                            </span>
                          </>
                        )}
                      </div>

                      {peer.lastErrorMessage && (
                        <div className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                          {peer.lastErrorCode ? `[${peer.lastErrorCode}] ` : ''}{peer.lastErrorMessage}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    {needsRePair ? (
                      <button
                        type="button"
                        onClick={() => onOpenPairing(peer)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 font-bold text-xs cursor-pointer"
                      >
                        {_t('إعادة الاقتران', 'Re-Pair', 'Neu koppeln')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSyncAction(peer.deviceId, false)}
                        disabled={isSyncing}
                        className="px-3 py-1.5 rounded-xl bg-primary text-primary-fg hover:bg-primary-hover font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{_t('مزامنة', 'Sync', 'Sync')}</span>
                      </button>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdownId(openDropdownId === peer.deviceId ? null : peer.deviceId)}
                        className="p-1.5 rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-main border border-surface-border cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openDropdownId === peer.deviceId && (
                        <div className="absolute right-0 rtl:left-0 rtl:right-auto top-full mt-1 w-48 rounded-xl border border-surface-border bg-surface shadow-lg z-20 overflow-hidden text-xs py-1">
                          {!needsRePair && (
                            <button
                              type="button"
                              onClick={() => {
                                void handleSyncAction(peer.deviceId, true);
                                setOpenDropdownId(null);
                              }}
                              className="w-full px-3.5 py-2 text-left rtl:text-right text-text-main hover:bg-surface-hover flex items-center gap-2 cursor-pointer font-semibold"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-primary" />
                              <span>{_t('مزامنة شاملة', 'Force Full Sync', 'Vollständiger Abgleich')}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPeerDetails(peer);
                              setOpenDropdownId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left rtl:text-right text-text-main hover:bg-surface-hover flex items-center gap-2 cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5 text-text-muted" />
                            <span>{_t('تفاصيل الاتصال', 'Connection Details', 'Verbindungsdetails')}</span>
                          </button>
                          <div className="h-px bg-surface-border my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              onUnpair(peer.deviceId);
                              setOpenDropdownId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left rtl:text-right text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2 font-bold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{_t('إلغاء الاقتران', 'Revoke & Remove', 'Entkoppeln')}</span>
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
          <div className="w-full max-w-lg rounded-2xl bg-surface border border-surface-border p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                {_t('بيانات اتصال P2P', 'P2P Connection Profile', 'P2P-Verbindungsprofil')}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedPeerDetails(null)}
                className="p-1 rounded-lg text-text-muted hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2 text-text-muted">
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span>{_t('الاسم', 'Device Name', 'Name')}</span>
                <span className="font-bold text-text-main">{selectedPeerDetails.deviceName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span>{_t('البروتوكول', 'Transport', 'Protokoll')}</span>
                <span className="font-mono text-text-main">P2P (WebRTC)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span>{_t('نوع مسار ICE', 'ICE Candidate Type', 'ICE-Typ')}</span>
                <span className="font-mono text-primary font-bold">
                  {selectedPeerDetails.iceCandidateType || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span>{_t('حالة الاقتران', 'Pairing Status', 'Status')}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {isLegacyLanOnlyPeer(selectedPeerDetails)
                    ? _t('يتطلب إعادة اقتران', 'Re-pair required', 'Neu koppeln')
                    : _t('مفعل (DTLS مشفر)', 'Active (Encrypted DTLS)', 'Aktiv (DTLS verschlüsselt)')}
                </span>
              </div>
            </div>

            <CopyableBlock
              title={_t('بيانات الجهاز (منقحة)', 'Redacted Peer Metadata', 'Bereinigte Metadaten')}
              content={JSON.stringify(redactPeer(selectedPeerDetails), null, 2)}
            />

            <button
              type="button"
              onClick={() => setSelectedPeerDetails(null)}
              className="w-full py-2 rounded-xl bg-surface-hover hover:bg-surface-border text-xs font-bold text-text-main cursor-pointer"
            >
              {_t('إغلاق', 'Close', 'Schließen')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
