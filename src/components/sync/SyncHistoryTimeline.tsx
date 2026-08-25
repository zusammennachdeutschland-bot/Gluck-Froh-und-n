import React, { useState } from 'react';
import { 
  History, CheckCircle2, AlertCircle, Clock, ArrowUpRight, 
  ArrowDownLeft, Filter, Download, Trash2, ShieldCheck, 
  ChevronDown, ChevronUp, FileText, Search, RefreshCw
} from 'lucide-react';
import { SyncHistoryEntry } from '../../types';
import { CopyableBlock } from './CopyableBlock';

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
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by device, trigger, or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={exportJSON}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
            title="Export JSON"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            title="Clear History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
          <History className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No sync cycles recorded</p>
          <p className="text-xs text-gray-500 mt-1">Synchronization runs will automatically appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            const isSelected = selectedEntry?.id === item.id;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-all hover:shadow-sm"
              >
                <div 
                  onClick={() => setSelectedEntry(isSelected ? null : item)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      item.status === 'success'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                        : item.status === 'partial'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                    }`}>
                      {item.status === 'success' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <AlertCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.peerName}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {item.trigger}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {item.summary || `${item.transferredCount} records synced`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="text-left sm:text-right">
                      <span className="block font-mono text-[11px] text-gray-700 dark:text-gray-300">
                        {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="block text-[10px]">Duration: {item.durationMs}ms</span>
                    </div>
                    {isSelected ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="p-4 bg-gray-50/70 dark:bg-gray-950/60 border-t border-gray-100 dark:border-gray-800 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                        <span className="text-gray-500 text-[10px] block">Uploaded</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{item.uploadedCount || item.transferredCount} records</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                        <span className="text-gray-500 text-[10px] block">Downloaded</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{item.downloadedCount || item.transferredCount} records</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                        <span className="text-gray-500 text-[10px] block">Conflicts Resolved</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{item.conflictCount || 0}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                        <span className="text-gray-500 text-[10px] block">Duration</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{item.durationMs} ms</span>
                      </div>
                    </div>

                    <CopyableBlock
                      title={`Sync Report — ${item.peerName} (${new Date(item.timestamp).toLocaleTimeString()})`}
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
