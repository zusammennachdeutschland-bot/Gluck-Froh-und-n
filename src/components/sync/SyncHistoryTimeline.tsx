import React, { useState } from 'react';
import { 
  History, CheckCircle2, AlertCircle, Clock, ArrowUpRight, 
  ArrowDownLeft, Filter, Download, Trash2, ShieldCheck, 
  ChevronDown, ChevronUp, FileText, Search, RefreshCw
} from 'lucide-react';
import { SyncHistoryEntry } from '../../types';
import { CopyableBlock } from './CopyableBlock';
import { useApp } from '../../context/AppContext';

interface SyncHistoryTimelineProps {
  history: SyncHistoryEntry[];
  onClearHistory: () => Promise<void>;
  id?: string;
}

export const SyncHistoryTimeline: React.FC<SyncHistoryTimelineProps> = ({
  history,
  onClearHistory,
  id
}) => {
  const { _t } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'partial'>('all');
  const [selectedEntry, setSelectedEntry] = useState<SyncHistoryEntry | null>(null);

  const filteredHistory = history.filter(item => {
    const sQuery = (searchQuery || '').toLowerCase();
    const matchesSearch = !sQuery ||
      (item.peerName || '').toLowerCase().includes(sQuery) ||
      (item.trigger || '').toLowerCase().includes(sQuery) ||
      (item.summary && (item.summary || '').toLowerCase().includes(sQuery));
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync_history_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Date', 'Time', 'Trigger', 'PeerName', 'Status', 'DurationMs', 'Uploaded', 'Downloaded', 'Conflicts', 'Summary'];
    const rows = history.map(h => [
      h.id,
      h.timestamp,
      new Date(h.timestamp).toLocaleDateString(),
      new Date(h.timestamp).toLocaleTimeString(),
      `"${h.trigger}"`,
      `"${h.peerName}"`,
      h.status,
      h.durationMs,
      h.uploadedCount,
      h.downloadedCount,
      h.conflictCount,
      `"${(h.summary || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id={id} className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={_t('البحث بالجهاز، السبب، أو الملخص...', 'Search by device, trigger, or summary...', 'Suche nach Gerät, Auslöser oder Zusammenfassung...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 rtl:pr-9 rtl:pl-3 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-surface-border bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-surface-border bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option value="all">{_t('جميع الحالات', 'All Status', 'Alle Status')}</option>
            <option value="success">{_t('ناجحة', 'Success', 'Erfolgreich')}</option>
            <option value="partial">{_t('جزئية', 'Partial', 'Teilweise')}</option>
            <option value="failed">{_t('فاشلة', 'Failed', 'Fehlgeschlagen')}</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-main hover:bg-surface-hover transition-colors shadow-xs cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={exportJSON}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-main hover:bg-surface-hover transition-colors shadow-xs cursor-pointer"
            title="Export JSON"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            title="Clear History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{_t('مسح السجل', 'Clear', 'Leeren')}</span>
          </button>
        </div>
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-surface-border bg-surface">
          <History className="w-10 h-10 text-text-muted mx-auto mb-2" />
          <p className="text-sm font-bold text-text-main">{_t('لا توجد دورات مزامنة مسجلة', 'No sync cycles recorded', 'Keine Synchronisationszyklen erfasst')}</p>
          <p className="text-xs text-text-muted mt-1">{_t('ستظهر عمليات المزامنة والتحديثات تلقائياً هنا.', 'Synchronization runs will automatically appear here.', 'Synchronisationsläufe werden hier automatisch aufgelistet.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item, index) => {
            const isSelected = selectedEntry?.id === item.id;
            const uniqueKey = item.id ? `${item.id}_${index}` : `hist_${item.timestamp || index}_${index}`;

            return (
              <div
                key={uniqueKey}
                className="rounded-2xl border border-surface-border bg-surface overflow-hidden transition-all hover:border-primary/40 shadow-xs"
              >
                <div 
                  onClick={() => setSelectedEntry(isSelected ? null : item)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 border ${
                      item.status === 'success'
                        ? 'bg-primary-soft text-primary border-primary/30'
                        : item.status === 'partial'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                    }`}>
                      {item.status === 'success' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <AlertCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text-main">{item.peerName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-background text-text-muted border border-surface-border">
                          {item.trigger}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {item.summary || `${item.transferredCount} ${_t('سجلات تم مزامنتها', 'records synced', 'Datensätze synchronisiert')}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-text-muted shrink-0">
                    <div className="text-left rtl:text-right sm:text-right rtl:sm:text-left">
                      <span className="block font-mono text-[11px] font-bold text-text-main">
                        {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="block text-[10px] text-text-muted">{_t('المدة:', 'Duration:', 'Dauer:')} {item.durationMs}ms</span>
                    </div>
                    {isSelected ? (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="p-4 bg-background/50 border-t border-surface-border space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-3 rounded-xl bg-surface border border-surface-border">
                        <span className="text-text-muted text-[10px] font-bold block">{_t('تم الرفع', 'Uploaded', 'Hochgeladen')}</span>
                        <span className="font-black text-text-main">{item.uploadedCount || item.transferredCount} {_t('سجل', 'records', 'Datensätze')}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-surface border border-surface-border">
                        <span className="text-text-muted text-[10px] font-bold block">{_t('تم التنزيل', 'Downloaded', 'Heruntergeladen')}</span>
                        <span className="font-black text-text-main">{item.downloadedCount || item.transferredCount} {_t('سجل', 'records', 'Datensätze')}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-surface border border-surface-border">
                        <span className="text-text-muted text-[10px] font-bold block">{_t('تعارضات تم حلها', 'Conflicts Resolved', 'Gelöste Konflikte')}</span>
                        <span className="font-black text-text-main">{item.conflictCount || 0}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-surface border border-surface-border">
                        <span className="text-text-muted text-[10px] font-bold block">{_t('المدة الزمنية', 'Duration', 'Dauer')}</span>
                        <span className="font-black text-text-main">{item.durationMs} ms</span>
                      </div>
                    </div>

                    <CopyableBlock
                      title={`${_t('تقرير المزامنة', 'Sync Report', 'Synchronisationsbericht')} — ${item.peerName} (${new Date(item.timestamp).toLocaleTimeString()})`}
                      content={JSON.stringify(item.report || item, null, 2)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
