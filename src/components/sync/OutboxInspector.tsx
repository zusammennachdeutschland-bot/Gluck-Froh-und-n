import React, { useState } from 'react';
import { 
  Users, BookOpen, Calendar, CreditCard, Settings, 
  CheckSquare, ChevronDown, ChevronUp, RefreshCw, Send, 
  Database, ArrowUpRight, GraduationCap, AlertCircle, 
  FileCheck, ClipboardList, Award, CheckCircle2 
} from 'lucide-react';
import { PendingOutboxSummary, PendingEntityItem } from '../../types';
import { useApp } from '../../context/AppContext';

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
  const { _t } = useApp();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(prev => (prev === section ? null : section));
  };

  const categories = [
    { key: 'students', label: _t('الطلاب والدروس الخاصة', 'Private Students & Pupils', 'Schüler'), icon: Users },
    { key: 'groups', label: _t('المجموعات والفصول', 'Classes & Groups', 'Klassen & Gruppen'), icon: BookOpen },
    { key: 'lessons', label: _t('الحصص والجدول', 'Lessons & Schedule', 'Stunden & Termine'), icon: Calendar },
    { key: 'payments', label: _t('المدفوعات والفواتير', 'Payments & Invoices', 'Zahlungen'), icon: CreditCard },
    { key: 'settings', label: _t('بيانات المعلم والإعدادات', 'Teacher Settings & Profile', 'Lehrer-Einstellungen'), icon: Settings },
    { key: 'todos', label: _t('المهام وقائمة الأعمال', 'Todos & Tasks', 'Aufgaben'), icon: CheckSquare },
    { key: 'certificates', label: _t('الشهادات والتكريمات', 'Certificates & Honors', 'Zertifikate'), icon: Award },
    { key: 'hodStudents', label: _t('طلاب القسم الألماني (HOD)', 'HOD German Department Students', 'HOD Schüler'), icon: GraduationCap },
    { key: 'hodComplaints', label: _t('شكاوى وملاحظات القسم (HOD)', 'HOD Complaints & Feedback', 'HOD Beschwerden'), icon: AlertCircle },
    { key: 'hodActionPlans', label: _t('خطط تحسين الطلاب (HOD)', 'HOD Student Action Plans', 'HOD Förderpläne'), icon: FileCheck },
    { key: 'hodVisits', label: _t('زيارات وتقييم المعلمين (HOD)', 'HOD Teacher Observation Visits', 'HOD Unterrichtsbesuche'), icon: ClipboardList }
  ];

  const totalPending = outbox?.totalCount ?? 0;
  const items = outbox?.items ?? [];

  return (
    <div id={id} className="space-y-6">
      {/* Top Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-surface-border shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary border border-primary/20 flex items-center justify-center shadow-xs shrink-0">
            {totalPending === 0 ? <CheckCircle2 className="w-6 h-6" /> : <Send className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-black text-text-main">
              {totalPending === 0 
                ? _t('صندوق الإرسال فارغ ومحدث بالكامل', 'Outbox is Clean & Up to Date', 'Postausgang ist synchronisiert') 
                : _t(`${totalPending} تعديل جاهز للبث`, `${totalPending} Pending Changes`, `${totalPending} ausstehende Änderungen`)}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {totalPending === 0 
                ? _t('جميع التعديلات والحذوفات المحلية متزامنة ومطابقة لجميع أجهزتك الموثوقة.', 'All local additions, updates, and removals are synchronized with paired devices.', 'Alle lokalen Änderungen sind mit verbundenen Geräten synchronisiert.')
                : _t('تعديلات محلية جديدة تنتظر البث المباشر (Delta Sync) إلى الأجهزة المتصلة.', 'Local mutations queued for delta broadcast to paired devices.', 'Lokale Änderungen in der Warteschlange für die Übertragung.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSyncAll}
          disabled={isSyncing || totalPending === 0}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary text-white font-bold text-xs transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? _t('جارٍ بث التعديلات...', 'Syncing Outbox...', 'Wird übertragen...') : _t('بث جميع التعديلات الآن', 'Sync All Outbox Deltas', 'Alle Deltas jetzt senden')}</span>
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
              className="rounded-2xl border border-surface-border bg-surface overflow-hidden transition-all hover:border-primary/40"
            >
              <button
                type="button"
                onClick={() => toggleSection(key)}
                className="w-full flex items-center justify-between p-4 text-left rtl:text-right transition-colors hover:bg-surface-hover cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${
                    count > 0 
                      ? 'bg-primary-soft text-primary border-primary/30' 
                      : 'bg-background text-text-muted border-surface-border'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-text-main truncate block">{label}</span>
                    <span className="block text-xs text-text-muted">
                      {count === 0 
                        ? _t('لا توجد تعديلات معلقة', 'No changes', 'Keine Änderungen') 
                        : _t(`${count} سجل معلق`, `${count} record${count > 1 ? 's' : ''} queued`, `${count} Datensätze`)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${
                    count > 0 
                      ? 'bg-primary text-white shadow-xs' 
                      : 'bg-background text-text-muted border border-surface-border'
                  }`}>
                    {count}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-surface-border p-4 bg-background/50 space-y-2">
                  {entityItems.length === 0 ? (
                    <p className="text-xs text-text-muted italic py-1">
                      {_t('لا توجد سجلات مفصلة معلقة لهذه الفئة.', 'No detailed changes queued for this collection.', 'Keine Einträge in dieser Kategorie.')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-2">
                        {_t('السجلات المعلقة للبث', 'Queued Records', 'Wartende Datensätze')}
                      </div>
                      {entityItems.map((item: PendingEntityItem) => {
                        const isCancelledSession一眼 = item.entityType === 'lessons' && item.title.includes('Cancelled');
                        return (
                          <div 
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-surface border border-surface-border text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${item.isDeleted || isCancelledSession一眼 ? 'bg-red-500' : 'bg-primary'}`} />
                              <span className="font-bold text-text-main truncate">{item.title}</span>
                              {item.isDeleted && (
                                <span className="text-[10px] uppercase font-black text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md shrink-0">
                                  {_t('محذوف', 'Deleted', 'Gelöscht')}
                                </span>
                              )}
                              {isCancelledSession一眼 && (
                                <span className="text-[10px] uppercase font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md shrink-0">
                                  {_t('ملغى', 'Cancelled', 'Storniert')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-text-muted shrink-0 text-xs">
                              <span className="font-mono text-[10px] bg-background px-2 py-0.5 rounded-md border border-surface-border">
                                Rev #{item.originRevision}
                              </span>
                              <span>{new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        );
                      })}
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
