import React, { useState } from 'react';
import { 
  Users, BookOpen, Calendar, CreditCard, Settings, 
  CheckSquare, ChevronDown, ChevronUp, RefreshCw, Send, 
  Database, ArrowUpRight 
} from 'lucide-react';
import { PendingOutboxSummary, PendingEntityItem } from '../../types';

interface OutboxInspectorProps {
  outbox: PendingOutboxSummary;
  onSyncAll: () => Promise<void>;
  isSyncing: boolean;
  id?: string;
}

export const OutboxInspector: React.FC<OutboxInspectorProps> = ({
  outbox,
  onSyncAll,
  isSyncing,
  id
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(prev => (prev === section ? null : section));
  };

  const categories = [
    { key: 'students', label: 'Students', icon: Users },
    { key: 'groups', label: 'Classes & Groups', icon: BookOpen },
    { key: 'lessons', label: 'Lessons', icon: Calendar },
    { key: 'payments', label: 'Payments', icon: CreditCard },
    { key: 'settings', label: 'Teacher Settings', icon: Settings },
    { key: 'todos', label: 'Todos & Tasks', icon: CheckSquare }
  ];

  const totalPending = outbox?.totalCount ?? 0;
  const items = outbox?.items ?? [];

  return (
    <div id={id} className="space-y-6">
      {/* Top Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              {totalPending === 0 ? 'Outbox is Clean' : `${totalPending} Pending Changes`}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {totalPending === 0 
                ? 'All local additions, updates, and removals are synchronized with paired devices.'
                : 'Local mutations queued for delta broadcast to paired devices.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSyncAll}
          disabled={isSyncing || totalPending === 0}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing Outbox...' : 'Sync All Outbox Deltas'}</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="space-y-3">
        {categories.map(({ key, label, icon: Icon }) => {
          const count = outbox?.byEntity?.[key] || 0;
          const entityItems = items.filter(item => item.entityType === key);
          const isExpanded = expandedSection === key;

          return (
            <div 
              key={key}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-shadow hover:shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleSection(key)}
                className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${count > 0 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {count === 0 ? 'No changes' : `${count} record${count > 1 ? 's' : ''} queued`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    count > 0 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {count}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-950/40">
                  {entityItems.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No detailed changes queued for this collection.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Queued Records</div>
                      {entityItems.map((item: PendingEntityItem) => (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${item.isDeleted ? 'bg-red-500' : 'bg-emerald-500'}`} />
                            <span className="font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                            {item.isDeleted && (
                              <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 rounded">
                                Deleted
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-gray-500">
                            <span className="font-mono text-[10px]">Rev #{item.originRevision}</span>
                            <span>{new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
