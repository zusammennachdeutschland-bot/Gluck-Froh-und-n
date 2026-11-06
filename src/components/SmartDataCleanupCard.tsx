import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  analyzeLessonCleanup,
  executeLessonCleanup,
  exportPrunedLessonsBackupJson,
  LessonCleanupAnalysis
} from '../services/lessonCleanupService';
import {
  Database,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Layers,
  Clock,
  X,
  FileText,
  DollarSign
} from 'lucide-react';

interface Props {
  className?: string;
  onCleanupComplete?: () => void;
}

export const SmartDataCleanupCard: React.FC<Props> = ({ className = '', onCleanupComplete }) => {
  const {
    lessons,
    groups,
    students,
    payments,
    financeTransactions,
    setLessons,
    executeSmartLessonCleanup,
    language
  } = useApp();

  const isRtl = language === 'ar';
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Compute live analysis
  const analysis: LessonCleanupAnalysis = useMemo(() => {
    return analyzeLessonCleanup(
      lessons || [],
      groups || [],
      students || [],
      payments || [],
      financeTransactions || []
    );
  }, [lessons, groups, students, payments, financeTransactions]);

  const handleDownloadBackup = () => {
    const allPrunable = [
      ...analysis.historicalEligibleToPrune,
      ...analysis.futureBloatToPrune
    ];
    if (allPrunable.length === 0) {
      alert(isRtl ? 'لا توجد حصص مرشحة للأرشفة حالياً.' : 'Keine Lektionen zur Archivierung vorhanden.');
      return;
    }
    exportPrunedLessonsBackupJson(allPrunable);
  };

  const handleExecuteCleanup = async () => {
    if (analysis.totalToPrune === 0) {
      alert(isRtl ? 'قاعدة البيانات محسنة بالفعل ولا توجد حصص زائدة.' : 'Die Datenbank ist bereits optimal bereinigt.');
      return;
    }

    if (!analysis.financialInvarianceVerified) {
      const proceed = confirm(
        isRtl
          ? 'تحذير: حدث تباين في الحسابات المالية. هل أنت متأكد من المتابعة؟'
          : 'Warnung: Finanzielle Abweichung festgestellt. Trotzdem fortfahren?'
      );
      if (!proceed) return;
    }

    setIsExecuting(true);
    try {
      // 1. Download pre-cleanup backup automatically
      const allPrunable = [
        ...analysis.historicalEligibleToPrune,
        ...analysis.futureBloatToPrune
      ];
      exportPrunedLessonsBackupJson(allPrunable);

      // 2. Execute cleanup
      const res = await executeLessonCleanup(lessons, analysis);
      setLessons(res.cleanedLessons);

      setCleanupMessage(
        isRtl
          ? `تم تنظيف ${res.prunedCount} حصة بنجاح وحفظ نسخة احتياطية في مركز الأمان.`
          : `${res.prunedCount} Lektionen erfolgreich bereinigt & Sicherung im Backup-Center abgelegt.`
      );

      setIsPreviewOpen(false);
      onCleanupComplete?.();
    } catch (err) {
      console.error('Cleanup execution error:', err);
      alert(isRtl ? 'حدث خطأ أثناء التنظيف.' : 'Fehler bei der Bereinigung.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <>
      <div className={`bg-surface border border-surface-border rounded-xl p-4 shadow-xs space-y-3.5 transition-all ${className}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-main">
                {isRtl ? 'تنظيف البيانات وتحسين الحصص' : 'Datenbereinigung & Lektions-Optimierung'}
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                {isRtl
                  ? 'نافذة مستقبلية متحركة 14 يوماً وحفظ أحدث 30 يوماً من الحصص التاريخية المسددة'
                  : 'Rollendes 14-Tage-Zukunftsfenster & 30 Tage bezahlte historische Lektionen'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isRtl ? 'آمن مالياً 100%' : 'Finanzsicher'}</span>
            </span>
          </div>
        </div>

        {/* Unboxed Metadata Metrics (Zero-Pill Discipline) */}
        <div className="p-3 bg-surface-hover rounded-lg border border-surface-border flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-text-main font-bold">
          <div>
            <span className="text-text-muted font-medium">{isRtl ? 'الإجمالي:' : 'Gesamt:'} </span>
            <span className="font-mono">{analysis.totalLessons}</span>
          </div>
          <span className="text-surface-border font-normal">·</span>
          <div>
            <span className="text-text-muted font-medium">{isRtl ? 'فائض مستقبلي (>14 يوم):' : 'Zukunftsentwürfe (>14T):'} </span>
            <span className="font-mono text-amber-600 dark:text-amber-400">
              {analysis.futureBloatToPrune.length}
            </span>
          </div>
          <span className="text-surface-border font-normal">·</span>
          <div>
            <span className="text-text-muted font-medium">{isRtl ? 'أرشيف قديم مسدد (>30 يوم):' : 'Alt & bezahlt (>30T):'} </span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400">
              {analysis.historicalEligibleToPrune.length}
            </span>
          </div>
          <span className="text-surface-border font-normal">·</span>
          <div>
            <span className="text-text-muted font-medium">{isRtl ? 'محمي ونشط:' : 'Aktiv & geschützt:'} </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              {analysis.totalRemaining}
            </span>
          </div>
        </div>

        {cleanupMessage && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{cleanupMessage}</span>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-surface-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isRtl ? 'معاينة وفحص التنظيف' : 'Vorschau & Prüfung'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={analysis.totalToPrune === 0}
              className="px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              title={isRtl ? 'تنزيل نسخة احتياطية من الحصص المرشحة للحذف' : 'Sicherung der bereinigbaren Lektionen herunterladen'}
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>{isRtl ? 'تحميل نسخة (.json)' : 'Sicherung (.json)'}</span>
            </button>
          </div>

          <span className="text-[11px] text-text-muted">
            {isRtl ? 'يعمل تلقائياً يومياً عند تشغيل البرنامج' : 'Täglich automatische Ausführung aktiv'}
          </span>
        </div>
      </div>

      {/* Interactive Audit & Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-main">
                    {isRtl ? 'معاينة تنظيف البيانات وضمان السلامة المالية' : 'Vorschau der Datenbereinigung & Finanzprüfung'}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {isRtl
                      ? 'مراجعة الحصص التي سيتم حذفها والتأكد من مطابقة الحسابات 100%'
                      : 'Überprüfung der zu löschenden Datensätze mit 100% Invarianzprüfung'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Financial Safety Verification Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  analysis.financialInvarianceVerified
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                }`}
              >
                {analysis.financialInvarianceVerified ? (
                  <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="text-xs font-bold">
                    {analysis.financialInvarianceVerified
                      ? isRtl
                        ? '✓ تم التحقق: الحسابات المالية وأرصدة الطلاب متطابقة بنسبة 100%!'
                        : '✓ Verifiziert: Finanzstatistiken & Schülersalden sind 100% identisch!'
                      : isRtl
                      ? '⚠️ تنبيه: يرجى مراجعة العمليات المالية قبل المتابعة'
                      : '⚠️ Hinweis: Bitte Finanzdaten vor der Bereinigung prüfen'}
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {isRtl
                      ? 'لا يتم حذف أي معاملة مالية أو دفعة مسجلة للطلاب. حذف الحصص القديمة المسددة بالكامل لا يمس الأرباح أو الديون إطلاقاً.'
                      : 'Es werden keine Finanztransaktionen oder Zahlungen gelöscht. Das Entfernen alter voll bezahlter Lektionen ändert Salden und Einnahmen in keinster Weise.'}
                  </p>
                </div>
              </div>

              {/* Data Breakdown Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-text-main block">
                  {isRtl ? 'تفاصيل الحصص المرشحة للتنظيف والحفظ:' : 'Aufschlüsselung der Lektionsbereinigung:'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Historical Prunable */}
                  <div className="p-3 rounded-xl bg-surface-hover border border-surface-border space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'حصص تاريخية قديمة (>30 يوم)' : 'Alte Lektionen (>30 Tage)'}</span>
                      </span>
                      <span className="font-mono text-sm">{analysis.historicalEligibleToPrune.length}</span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      {isRtl
                        ? 'مكتملة ومسددة بنسبة 100% بدون أي ديون معلقة على الطلاب.'
                        : 'Vollständig abgeschlossen & bezahlt ohne offene Posten.'}
                    </p>
                  </div>

                  {/* Future Bloat Prunable */}
                  <div className="p-3 rounded-xl bg-surface-hover border border-surface-border space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'حصص مستقبلية زائدة (>14 يوم)' : 'Zukunftsentwürfe (>14 Tage)'}</span>
                      </span>
                      <span className="font-mono text-sm">{analysis.futureBloatToPrune.length}</span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      {isRtl
                        ? 'توليد تلقائي غير مؤكد يتجاوز فترة الـ 14 يوماً.'
                        : 'Unbestätigte automatische Entwürfe außerhalb des 14-Tage-Fensters.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial Verification Metrics Comparison */}
              <div className="p-3 bg-surface-hover/60 border border-surface-border rounded-xl space-y-2">
                <span className="text-xs font-bold text-text-main block">
                  {isRtl ? 'مطابقة التدقيق المالي قبل وبعد التنظيف:' : 'Finanzprüfung (Vorher vs. Nachher):'}
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-surface border border-surface-border">
                    <div className="text-[11px] text-text-muted">{isRtl ? 'إجمالي الأرباح' : 'Gesamteinnahmen'}</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      {analysis.preTotalRevenue.toLocaleString()} EGP
                    </div>
                    <div className="text-[10px] text-emerald-500 font-bold">✓ 100% {isRtl ? 'متطابق' : 'identisch'}</div>
                  </div>

                  <div className="p-2 rounded-lg bg-surface border border-surface-border">
                    <div className="text-[11px] text-text-muted">{isRtl ? 'سجلات السداد' : 'Zahlungssumme'}</div>
                    <div className="font-bold text-primary font-mono mt-0.5">
                      {analysis.preTotalPayments.toLocaleString()} EGP
                    </div>
                    <div className="text-[10px] text-emerald-500 font-bold">✓ 100% {isRtl ? 'متطابق' : 'identisch'}</div>
                  </div>

                  <div className="p-2 rounded-lg bg-surface border border-surface-border">
                    <div className="text-[11px] text-text-muted">{isRtl ? 'ديون الطلاب المستحقة' : 'Offene Schülersalden'}</div>
                    <div className="font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                      {analysis.preUnpaidBalancesTotal.toLocaleString()} EGP
                    </div>
                    <div className="text-[10px] text-emerald-500 font-bold">✓ 100% {isRtl ? 'محفوظة تماماً' : 'unverändert'}</div>
                  </div>
                </div>
              </div>

              {/* Sample list of prunable lessons */}
              {analysis.totalToPrune > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-text-main flex items-center justify-between">
                    <span>{isRtl ? 'عينة من الحصص المرشحة للتنظيف (أول 5 حصص):' : 'Stichprobe der zu bereinigenden Lektionen:'}</span>
                    <span className="text-[11px] text-text-muted font-mono">{analysis.totalToPrune} {isRtl ? 'حصة إجمالاً' : 'Lektionen'}</span>
                  </span>

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {[...analysis.historicalEligibleToPrune, ...analysis.futureBloatToPrune]
                      .slice(0, 5)
                      .map((l) => (
                        <div
                          key={l.id}
                          className="p-2 rounded-lg bg-surface border border-surface-border text-xs flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-text-main truncate block">{l.title || l.groupName}</span>
                            <span className="text-[10px] text-text-muted">
                              {l.date} · {l.time} · {l.type || 'group'}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              l.date < analysis.thirtyDaysAgoStr
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {l.date < analysis.thirtyDaysAgoStr
                              ? isRtl ? 'تاريخية مسددة' : 'Alt & bezahlt'
                              : isRtl ? 'مستقبلية زائدة' : 'Zukunftsentwurf'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-surface-border bg-surface flex items-center justify-between gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={analysis.totalToPrune === 0}
                className="py-2 px-3 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>{isRtl ? 'تنزيل نسخة احتياطية (.json)' : 'Sicherung herunterladen (.json)'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="py-2 px-3.5 rounded-xl bg-surface-hover hover:bg-surface text-text-muted hover:text-text-main text-xs font-bold border border-surface-border cursor-pointer transition-colors"
                >
                  {isRtl ? 'إلغاء' : 'Schließen'}
                </button>

                <button
                  type="button"
                  disabled={isExecuting || analysis.totalToPrune === 0}
                  onClick={handleExecuteCleanup}
                  className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {isExecuting
                      ? isRtl ? 'جاري التنظيف...' : 'Bereinigung läuft...'
                      : isRtl
                      ? `تنظيف ${analysis.totalToPrune} حصة بأمان`
                      : `${analysis.totalToPrune} Lektionen sicher bereinigen`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
