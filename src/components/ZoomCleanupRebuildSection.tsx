import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  PauseCircle,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  GoogleCalendarConnectionState,
  getInMemoryGoogleCalendarToken,
  requestGoogleCalendarAccessToken,
  deleteGoogleCalendarEventForCleanup
} from '../services/calendarSyncService';
import {
  CleanupRebuildOperationRecord,
  CleanupRebuildPreview,
  CleanupRebuildProgressUpdate,
  clearCleanupRebuildOperation,
  executeZoomCalendarCleanupRebuild,
  loadCleanupRebuildOperation,
  previewZoomCalendarCleanupRebuild
} from '../services/zoomCalendarCleanupRebuildService';

interface ZoomCleanupRebuildSectionProps {
  timezone: string;
  zoomConnected: boolean;
  calendarConn: GoogleCalendarConnectionState;
  isCalendarConnecting: boolean;
  onConnectCalendar: (forcePrompt?: boolean) => Promise<void>;
}

export const ZoomCleanupRebuildSection: React.FC<ZoomCleanupRebuildSectionProps> = ({
  timezone,
  zoomConnected,
  calendarConn,
  isCalendarConnecting,
  onConnectCalendar
}) => {
  const {
    groups,
    groupWeeklySessions,
    zoomMeetingRecords,
    zoomMeetingHistory,
    applyZoomWorkspaceSnapshot,
    _t,
    triggerToast
  } = useApp();

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<CleanupRebuildPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const handleDeleteAmbiguousEvent = async (eventId: string) => {
    const token = getInMemoryGoogleCalendarToken();
    if (!token) {
      triggerToast(_t('يرجى توصيل تقويم Google أولاً', 'Please connect Google Calendar first'));
      return;
    }
    setDeletingEventId(eventId);
    try {
      const res = await deleteGoogleCalendarEventForCleanup({
        eventId,
        accessToken: token,
        calendarId: 'primary',
        maxRetries: 3,
        retryDelayMs: 1000
      });
      if (res.ok) {
        triggerToast(_t('تم حذف الحدث بنجاح', 'Calendar event deleted successfully'));
        await handlePreviewCleanup();
      } else {
        triggerToast(res.error || _t('تعذر حذف الحدث', 'Failed to delete event'));
      }
    } catch (err: any) {
      triggerToast(err?.message || _t('تعذر حذف الحدث', 'Failed to delete event'));
    } finally {
      setDeletingEventId(null);
    }
  };

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'clean_and_rebuild' | 'clean_only'>('clean_and_rebuild');
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState<CleanupRebuildProgressUpdate | null>(null);
  const [operation, setOperation] = useState<CleanupRebuildOperationRecord | null>(null);

  const [showZoomDetails, setShowZoomDetails] = useState(true);
  const [showCalendarDetails, setShowCalendarDetails] = useState(false);
  const [showRebuildDetails, setShowRebuildDetails] = useState(false);

  const pauseRequestedRef = useRef(false);

  // Load any previously persisted operation state on mount — NEVER auto-execute or auto-delete!
  useEffect(() => {
    let mounted = true;
    loadCleanupRebuildOperation()
      .then((saved) => {
        if (mounted && saved) {
          setOperation(saved);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const hasCalendarToken = Boolean(getInMemoryGoogleCalendarToken());

  const handlePreviewCleanup = async () => {
    if (!zoomConnected) {
      triggerToast(_t('يرجى ربط حساب Zoom أولاً', 'Please connect your Zoom account first'));
      return;
    }
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const calToken = getInMemoryGoogleCalendarToken();
      const res = await previewZoomCalendarCleanupRebuild({
        groups,
        existingSessions: groupWeeklySessions,
        existingRecords: zoomMeetingRecords,
        existingHistory: zoomMeetingHistory,
        timezone,
        calendarAccessToken: calToken
      });
      if (!res.ok || !res.preview) {
        const errMsg = res.error || _t('تعذر إنشاء معاينة التنظيف', 'Failed to generate cleanup preview');
        setPreviewError(errMsg);
        triggerToast(errMsg);
        return;
      }
      setPreview(res.preview);
      setConfirmChecked(false);
      triggerToast(
        _t(
          `تم الفحص: ${res.preview.totalScheduledZoomMeetingsFound} اجتماع Zoom • ${res.preview.calendarEventsToDeleteCount} حدث تقويم مرتبط`,
          `Preview ready: ${res.preview.totalScheduledZoomMeetingsFound} Zoom meetings • ${res.preview.calendarEventsToDeleteCount} linked Calendar events`
        )
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const runOperation = async (mode: 'start' | 'resume' | 'retry_failed') => {
    if (isExecuting) return;
    if (mode === 'start' && !preview) return;

    const cleanupOnly = mode === 'start' ? confirmMode === 'clean_only' : Boolean(operation?.cleanupOnly);

    pauseRequestedRef.current = false;
    setConfirmModalOpen(false);
    setConfirmChecked(false);
    setIsExecuting(true);
    setPreviewError(null);

    try {
      const currentCalToken = getInMemoryGoogleCalendarToken();
      const result = await executeZoomCalendarCleanupRebuild({
        mode,
        cleanupOnly: mode === 'start' ? cleanupOnly : undefined,
        preview: mode === 'start' ? preview || undefined : undefined,
        groups,
        existingSessions: groupWeeklySessions,
        existingRecords: zoomMeetingRecords,
        existingHistory: zoomMeetingHistory,
        includeGoogleCalendar:
          mode === 'start'
            ? Boolean(preview?.calendarConnected && currentCalToken)
            : undefined,
        calendarAccessToken: currentCalToken,
        onRenewCalendarToken: async () => {
          const authRes = await requestGoogleCalendarAccessToken(true);
          return authRes.ok && authRes.accessToken ? authRes.accessToken : null;
        },
        onWorkspaceUpdate: (snapshot) => {
          applyZoomWorkspaceSnapshot({
            sessions: snapshot.sessions,
            records: snapshot.records,
            history: snapshot.history
          });
        },
        onProgress: (upd) => {
          setProgress(upd);
          setOperation(upd.operation);
        },
        shouldPause: () => pauseRequestedRef.current
      });

      if (result.locked) {
        triggerToast(_t('عملية تنظيف أخرى قيد التنفيذ بالفعل', 'Another cleanup operation is already running'));
        return;
      }

      setOperation(result.operation);
      applyZoomWorkspaceSnapshot({
        sessions: result.sessions,
        records: result.records,
        history: result.history
      });

      if (result.operation.state === 'completed') {
        if (result.operation.cleanupOnly) {
          triggerToast(
            _t(
              `تم المسح بالكامل بنجاح بدون إعادة بناء (${result.operation.report.zoomMeetingsDeleted} اجتماع Zoom • ${result.operation.report.calendarEventsDeleted} حدث تقويم)`,
              `Clean Only completed & verified (${result.operation.report.zoomMeetingsDeleted} Zoom & ${result.operation.report.calendarEventsDeleted} Calendar deleted, 0 rebuilt)`
            )
          );
        } else {
          triggerToast(
            _t(
              `اكتمل التنظيف وإعادة البناء وتم التحقق: ${result.operation.report.newGluckZoomMeetingsCreated} اجتماع جديد`,
              `Clean & Rebuild completed and verified: ${result.operation.report.newGluckZoomMeetingsCreated} new meetings`
            )
          );
        }
      } else if (result.operation.state === 'paused') {
        triggerToast(
          _t('تم إيقاف العملية بأمان — يمكنك الاستكمال من نفس النقطة', 'Operation paused safely — you can resume anytime')
        );
      } else {
        triggerToast(
          _t(
            'انتهت العملية مع وجود ملاحظات أو عناصر تحتاج إعادة محاولة',
            'Operation finished with remaining issues — review report below'
          )
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'Cleanup & Rebuild error';
      setPreviewError(msg);
      triggerToast(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDismissSavedOperation = async () => {
    if (isExecuting) return;
    await clearCleanupRebuildOperation();
    setOperation(null);
    setProgress(null);
  };

  const canResume =
    Boolean(operation) &&
    !isExecuting &&
    (operation!.state === 'paused' ||
      operation!.state === 'cleanup_in_progress' ||
      operation!.state === 'zoom_deletion_in_progress' ||
      operation!.state === 'calendar_cleanup_in_progress' ||
      operation!.state === 'old_meetings_verified_empty' ||
      operation!.state === 'rebuilding_zoom_meetings' ||
      operation!.state === 'syncing_calendar_events');

  const canRetryFailed =
    Boolean(operation) &&
    !isExecuting &&
    (operation!.state === 'completed_with_errors' || operation!.state === 'failed');

  return (
    <div className="bg-surface border border-surface-border rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
      {/* Header */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-text-main">
            {_t(
              'تنظيف وإعادة بناء اجتماعات Glück',
              'Clean & Rebuild Glück Meetings',
              'Glück-Meetings bereinigen & neu aufbauen'
            )}
          </h4>
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
            {_t(
              'حذف اجتماعات Zoom القديمة من حساب المضيف المتصل وأحداث Google Calendar المرتبطة بها فقط، ثم إعادة إنشاء اجتماعات مجموعات Glück النشطة ومزامنة التقويم.',
              'Deletes old scheduled Zoom meetings in the connected Zoom host account and only confidently linked Google Calendar events, then rebuilds active Glück group meetings and re-syncs Calendar.'
            )}
          </p>
        </div>
      </div>

      {/* Unified Action Row */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <button
          type="button"
          disabled={!zoomConnected || isLoadingPreview || isExecuting}
          onClick={handlePreviewCleanup}
          className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors ${
            preview
              ? 'bg-surface-hover hover:bg-surface border border-surface-border text-text-main'
              : 'bg-primary hover:bg-primary-hover text-primary-fg shadow-2xs'
          }`}
        >
          <Eye className={`w-3.5 h-3.5 ${preview ? 'text-primary' : ''} ${isLoadingPreview ? 'animate-pulse' : ''}`} />
          <span>
            {isLoadingPreview
              ? _t('جاري الفحص...', 'Scanning...')
              : preview
              ? _t('إعادة الفحص', 'Rescan Preview')
              : _t('معاينة التنظيف', 'Preview Cleanup')}
          </span>
        </button>

        <button
          type="button"
          disabled={!zoomConnected || !preview || isLoadingPreview || isExecuting}
          onClick={() => {
            setConfirmMode('clean_only');
            setConfirmChecked(false);
            setConfirmModalOpen(true);
          }}
          className="min-h-[40px] px-3.5 rounded-xl bg-surface hover:bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{_t('مسح فقط (بدون بناء)', 'Clean Only (No Rebuild)')}</span>
        </button>

        <button
          type="button"
          disabled={!zoomConnected || !preview || isLoadingPreview || isExecuting}
          onClick={() => {
            setConfirmMode('clean_and_rebuild');
            setConfirmChecked(false);
            setConfirmModalOpen(true);
          }}
          className="min-h-[40px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{_t('تنظيف وإعادة بناء', 'Clean & Rebuild')}</span>
        </button>
      </div>

      {/* Host Scope Disclosure + Calendar Connection Notice */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-2">
        <div className="flex items-start gap-2 leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            {preview?.hostScopeDisclosure ||
              _t(
                'النطاق: يتم فحص الاجتماعات المجدولة التابعة للمضيف المتصل فقط. جميع بيانات الطلاب والحصص والمدفوعات والحضور وأحداث التقويم الشخصية غير المرتبطة محفوظة ولن تُمس.',
                'Scope: Only scheduled meetings owned by the connected Zoom host are cleaned. Students, groups, lessons, attendance, payments, Grain matches, and unrelated personal Calendar events are never deleted.'
              )}
          </span>
        </div>
        {!hasCalendarToken && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
            <span className="text-[11.5px]">
              {_t(
                'Google Calendar غير متصل — اربطه أولاً إذا كنت تريد تنظيف وإعادة بناء أحداث التقويم أيضاً.',
                'Google Calendar is not connected — connect first if you also want linked Calendar events cleaned and rebuilt.'
              )}
            </span>
            <button
              type="button"
              disabled={isCalendarConnecting}
              onClick={() => void onConnectCalendar(calendarConn.status === 'reconnect_required' || calendarConn.status === 'expired')}
              className="min-h-[36px] px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg font-bold text-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-1.5"
            >
              {isCalendarConnecting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {isCalendarConnecting
                ? _t('جاري الربط...', 'Connecting...')
                : _t('ربط Google Calendar', 'Connect Calendar')}
            </button>
          </div>
        )}
      </div>

      {previewError && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{previewError}</span>
        </div>
      )}

      {/* Active / Interrupted / Resumable Progress Banner */}
      {(isExecuting || canResume) && operation && (
        <div className="p-3.5 rounded-xl bg-primary-soft border border-primary-border space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-text-main">
              <RefreshCw className={`w-3.5 h-3.5 text-primary shrink-0 ${isExecuting ? 'animate-spin' : ''}`} />
              <span>
                {progress?.phaseLabel ||
                  (operation.state === 'paused'
                    ? _t('العملية متوقفة مؤقتاً (قابلة للاستكمال)', 'Operation Paused (Resumable)')
                    : _t('عملية سابقة غير مكتملة (قابلة للاستكمال)', 'Interrupted Operation Found (Resumable)'))}
              </span>
              <span className="text-[11px] font-medium text-text-muted">
                · {operation.cleanupOnly ? _t('مسح فقط', 'Clean Only') : _t('تنظيف وبناء', 'Clean & Rebuild')}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {isExecuting ? (
                <button
                  type="button"
                  onClick={() => {
                    pauseRequestedRef.current = true;
                  }}
                  className="min-h-[34px] px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>{_t('إيقاف مؤقت آمن', 'Pause')}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => runOperation('resume')}
                    className="min-h-[34px] px-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{_t('استكمال العملية', 'Resume')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissSavedOperation}
                    className="min-h-[34px] px-3 rounded-xl border border-surface-border bg-surface text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
                  >
                    {_t('تجاهل', 'Dismiss')}
                  </button>
                </>
              )}
            </div>
          </div>

          {progress && (
            <>
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span className="truncate">{progress.currentItemLabel || operation.operationId}</span>
                <span className="font-mono tabular-nums shrink-0">
                  {progress.completedSteps} / {progress.totalSteps}
                </span>
              </div>
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-surface-border">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((progress.completedSteps / Math.max(1, progress.totalSteps)) * 100))}%`
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Preview Breakdown */}
      {preview && (
        <div className="space-y-3 pt-2.5 border-t border-surface-border">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-text-main">
              {_t('نتائج المعاينة (لم يتم حذف أي شيء بعد)', 'Cleanup Preview (Read-Only)')}
            </span>
            <span className="text-[11px] font-mono text-text-muted" dir="ltr">
              {preview.timezone} · {preview.hostEmail || 'connected host'}
            </span>
          </div>

          {/* Unified Hairline-Divided Metric Grid (No nested rainbow cards) */}
          <div className="rounded-xl bg-surface-hover/40 border border-surface-border grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-surface-border overflow-hidden text-center">
            <div className="px-3 py-2.5">
              <div className="text-base font-bold text-text-main tabular-nums">{preview.totalScheduledZoomMeetingsFound}</div>
              <div className="text-[11px] text-text-muted">{_t('اجتماعات Zoom', 'Zoom Found')}</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">{preview.zoomMeetingsToDeleteCount}</div>
              <div className="text-[11px] text-text-muted">{_t('Zoom ستحذف', 'Zoom Delete')}</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{preview.activeGluckOnlineSessionsCount}</div>
              <div className="text-[11px] text-text-muted">{_t('جلسات ستُبنى', 'To Rebuild')}</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">{preview.calendarEventsToDeleteCount}</div>
              <div className="text-[11px] text-text-muted">{_t('تقويم سيحذف', 'Cal Delete')}</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-base font-bold text-primary tabular-nums">{preview.calendarEventsUntouchedCount}</div>
              <div className="text-[11px] text-text-muted">{_t('تقويم لن يُمس', 'Cal Safe')}</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">{preview.liveMeetingsBlockedCount}</div>
              <div className="text-[11px] text-text-muted">{_t('جارية الآن', 'Live')}</div>
            </div>
            <div className="px-3 py-2.5 col-span-2">
              <div className="text-base font-bold text-amber-700 dark:text-amber-300 tabular-nums">{preview.manualResolutionItems.length}</div>
              <div className="text-[11px] text-text-muted">{_t('مراجعة يدوية', 'Manual Review')}</div>
            </div>
          </div>

          {/* Manual Resolution / Live Meetings Warning Box */}
          {preview.manualResolutionItems.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
              <div className="font-bold text-amber-800 dark:text-amber-300">
                {_t('سجلات تتطلب مراجعة يدوية:', 'Items Requiring Attention:')}
              </div>
              <ul className="space-y-1.5 list-none text-amber-900 dark:text-amber-200 text-[11px]">
                {preview.manualResolutionItems.map((item, idx) => (
                  <li key={`${item.category}_${item.id}_${idx}`} className="flex items-center justify-between gap-2 bg-amber-500/5 p-2 rounded-lg border border-amber-500/15">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold">{item.title}:</span> {item.detail}
                    </div>
                    {item.category === 'ambiguous_calendar_event' && (
                      <button
                        type="button"
                        disabled={deletingEventId === item.id}
                        onClick={() => handleDeleteAmbiguousEvent(item.id)}
                        className="inline-flex items-center gap-1 min-h-[30px] px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[11px] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{_t('حذف', 'Delete')}</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Collapsible 1: Zoom Meetings to Delete */}
          <div className="border border-surface-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowZoomDetails((v) => !v)}
              className="w-full min-h-[40px] px-3 py-2 bg-surface-hover/50 hover:bg-surface-hover flex items-center justify-between text-xs font-bold text-text-main cursor-pointer transition-colors"
            >
              <span>
                {_t(
                  `اجتماعات Zoom المكتشفة (${preview.zoomMeetings.length})`,
                  `Discovered Zoom Meetings (${preview.zoomMeetings.length})`
                )}
              </span>
              {showZoomDetails ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
            </button>
            {showZoomDetails && (
              <div className="max-h-52 overflow-y-auto divide-y divide-surface-border text-xs">
                {preview.zoomMeetings.length === 0 ? (
                  <div className="p-3 text-text-muted text-center">
                    {_t('لا توجد اجتماعات Zoom مجدولة حالياً في هذا الحساب.', 'No scheduled Zoom meetings currently exist in this account.')}
                  </div>
                ) : (
                  preview.zoomMeetings.map((m) => (
                    <div key={m.id} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-text-main truncate" dir="ltr">
                          {m.topic}
                        </div>
                        <div className="text-[11px] text-text-muted font-mono flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums" dir="ltr">
                          <span>ID {m.id}</span>
                          {m.startTime && <span>· {m.startTime}</span>}
                          <span>· {m.isRecurring ? 'Recurring' : `Type ${m.type}`}</span>
                          {m.associatedGroupName ? (
                            <span className="text-primary font-sans font-semibold">
                              · {m.associatedGroupName}
                            </span>
                          ) : (
                            <span className="text-text-muted font-sans">· External / Manual</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          m.isLive
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {m.isLive ? _t('جارٍ الآن · محمي', 'Live · Protected') : _t('سيُحذف', 'Will delete')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Collapsible 2: Linked Google Calendar Events to Delete */}
          <div className="border border-surface-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCalendarDetails((v) => !v)}
              className="w-full min-h-[40px] px-3 py-2 bg-surface-hover/50 hover:bg-surface-hover flex items-center justify-between text-xs font-bold text-text-main cursor-pointer transition-colors"
            >
              <span>
                {_t(
                  `أحداث التقويم المرتبطة (${preview.calendarEventsToDeleteCount}) · محفوظة (${preview.calendarEventsUntouchedCount})`,
                  `Linked Calendar Events (${preview.calendarEventsToDeleteCount}) · Untouched (${preview.calendarEventsUntouchedCount})`
                )}
              </span>
              {showCalendarDetails ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
            </button>
            {showCalendarDetails && (
              <div className="max-h-48 overflow-y-auto divide-y divide-surface-border text-xs">
                {!preview.calendarConnected ? (
                  <div className="p-3 text-text-muted text-center">
                    {_t('Google Calendar غير متصل — لم يتم فحص أحداث التقويم.', 'Google Calendar is not connected — Calendar events were not scanned.')}
                  </div>
                ) : preview.calendarEventsToDelete.length === 0 ? (
                  <div className="p-3 text-text-muted text-center">
                    {_t('لا توجد أحداث Google Calendar مرتبطة باجتماعات Zoom للحذف.', 'No confidently linked Google Calendar events found for deletion.')}
                  </div>
                ) : (
                  preview.calendarEventsToDelete.map((e) => (
                    <div key={e.eventId} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-text-main truncate" dir="ltr">{e.summary}</div>
                        <div className="text-[11px] text-text-muted font-mono tabular-nums" dir="ltr">
                          {e.startDateTime || e.eventId}
                          {e.isRecurringSeries ? ' · Recurring' : ''}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                        {_t('سيُحذف', 'Will delete')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Collapsible 3: Active Glück Sessions to Rebuild */}
          <div className="border border-surface-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRebuildDetails((v) => !v)}
              className="w-full min-h-[40px] px-3 py-2 bg-surface-hover/50 hover:bg-surface-hover flex items-center justify-between text-xs font-bold text-text-main cursor-pointer transition-colors"
            >
              <span>
                {_t(
                  `الحصص التي ستُعاد بناؤها (${preview.activeGluckOnlineSessionsCount})`,
                  `Sessions to Rebuild (${preview.activeGluckOnlineSessionsCount})`
                )}
              </span>
              {showRebuildDetails ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
            </button>
            {showRebuildDetails && (
              <div className="max-h-48 overflow-y-auto divide-y divide-surface-border text-xs">
                {preview.activeSessionsToRebuild.map((s) => (
                  <div key={s.sessionId} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-text-main" dir="ltr">{s.standardizedTitle}</span>
                      <span className="ms-2 text-[11px] text-text-muted tabular-nums">
                        · {s.durationMinutes} {_t('د', 'm')}
                      </span>
                      {s.planWarning40Min && (
                        <span className="ms-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          · {_t('حد 40 د', '40m cap')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {_t('إعادة إنشاء', 'Will rebuild')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Final User Report */}
      {operation && (operation.state === 'completed' || operation.state === 'completed_with_errors' || operation.state === 'failed') && (
        <div
          className={`p-3.5 rounded-xl border space-y-3 ${
            operation.state === 'completed' && operation.report.verificationPassed
              ? 'bg-emerald-500/10 border-emerald-500/25'
              : 'bg-amber-500/10 border-amber-500/25'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {operation.state === 'completed' && operation.report.verificationPassed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span className="text-xs font-bold text-text-main">
                {operation.state === 'completed' && operation.report.verificationPassed
                  ? operation.cleanupOnly
                    ? _t('تم المسح بالكامل بنجاح (بدون إعادة بناء)', 'Clean Only Completed & Verified')
                    : _t('اكتمل التنظيف وإعادة البناء بنجاح', 'Clean & Rebuild Completed & Verified')
                  : _t('انتهت العملية مع ملاحظات تحتاج مراجعة', 'Completed With Remaining Issues')}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {canRetryFailed && (
                <button
                  type="button"
                  onClick={() => runOperation('retry_failed')}
                  className="min-h-[34px] px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{_t('إعادة محاولة الفاشلة', 'Retry Failed')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDismissSavedOperation}
                className="min-h-[34px] px-3 rounded-xl border border-surface-border bg-surface text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
              >
                {_t('إغلاق التقرير', 'Dismiss')}
              </button>
            </div>
          </div>

          {/* Hairline-Divided Report Summary */}
          <div className="rounded-xl bg-surface border border-surface-border grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-surface-border overflow-hidden text-center">
            <div className="px-2.5 py-2">
              <div className="text-sm font-bold text-text-main tabular-nums">{operation.report.zoomMeetingsFoundBeforeCleanup}</div>
              <div className="text-[10.5px] text-text-muted">{_t('Zoom قبل المسح', 'Zoom Before')}</div>
            </div>
            <div className="px-2.5 py-2">
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{operation.report.zoomMeetingsDeleted}</div>
              <div className="text-[10.5px] text-text-muted">{_t('Zoom محذوفة', 'Zoom Deleted')}</div>
            </div>
            <div className="px-2.5 py-2">
              <div className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{operation.report.zoomMeetingsSkippedOrFailed}</div>
              <div className="text-[10.5px] text-text-muted">{_t('متخطى / فاشل', 'Skipped/Failed')}</div>
            </div>
            <div className="px-2.5 py-2">
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{operation.report.calendarEventsDeleted}</div>
              <div className="text-[10.5px] text-text-muted">{_t('تقويم محذوف', 'Cal Deleted')}</div>
            </div>
            <div className="px-2.5 py-2">
              <div className="text-sm font-bold text-primary tabular-nums">{operation.report.calendarEventsUntouched}</div>
              <div className="text-[10.5px] text-text-muted">{_t('تقويم محفوظ', 'Cal Safe')}</div>
            </div>
            {!operation.cleanupOnly && (
              <>
                <div className="px-2.5 py-2">
                  <div className="text-sm font-bold text-primary tabular-nums">{operation.report.newGluckZoomMeetingsCreated}</div>
                  <div className="text-[10.5px] text-text-muted">{_t('Zoom الجديد', 'New Zoom')}</div>
                </div>
                <div className="px-2.5 py-2">
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{operation.report.calendarEventsRecreatedOrUpdated}</div>
                  <div className="text-[10.5px] text-text-muted">{_t('التقويم المحدث', 'Cal Synced')}</div>
                </div>
              </>
            )}
            <div className="px-2.5 py-2">
              <div className={`text-sm font-bold tabular-nums ${operation.report.failedItemsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {operation.report.failedItemsCount}
              </div>
              <div className="text-[10.5px] text-text-muted">{_t('عناصر فاشلة', 'Failed')}</div>
            </div>
            <div className="px-2.5 py-2 col-span-2 sm:col-span-4">
              <span
                className={`text-xs font-bold ${
                  operation.report.verificationPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {operation.report.verificationPassed
                  ? _t('حالة التحقق النهائي: ناجح', 'Verification: Passed')
                  : _t('حالة التحقق النهائي: غير مكتمل', 'Verification: Failed')}
              </span>
            </div>
          </div>

          {operation.report.remainingProblems.length > 0 && (
            <div className="p-2.5 rounded-xl bg-surface border border-rose-500/25 text-xs space-y-1">
              <div className="font-bold text-rose-600 dark:text-rose-400">
                {_t('المشاكل المتبقية:', 'Remaining Problems:')}
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-text-main text-[11px]">
                {operation.report.remainingProblems.map((prob, i) => (
                  <li key={i}>{prob}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Explicit Destructive Confirmation Modal */}
      {confirmModalOpen && preview && (
        <div className="fixed inset-0 z-[130] bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface border-t sm:border border-surface-border rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-5 pb-safe-bottom sm:pb-5 space-y-3.5 shadow-2xl">
            <div className="w-10 h-1 bg-surface-border rounded-full mx-auto -mt-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  {confirmMode === 'clean_only'
                    ? _t('تأكيد: مسح اجتماعات Zoom والتقويم فقط', 'Confirm Clean Only (No Rebuild)')
                    : _t('تأكيد: تنظيف وإعادة بناء اجتماعات Glück', 'Confirm Cleanup & Rebuild')}
                </span>
              </h5>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1.5 text-text-main leading-relaxed">
              <p className="font-semibold">
                {_t(
                  `سيتم حذف ${preview.zoomMeetingsToDeleteCount} اجتماع Zoom مجدول بشكل دائم (بما في ذلك السلاسل المتكررة بالكامل) من حساب المضيف المتصل، وحذف ${preview.calendarEventsToDeleteCount} حدث Google Calendar مرتبط فقط.`,
                  `This will permanently delete ${preview.zoomMeetingsToDeleteCount} scheduled Zoom meeting(s) (including full recurring series) in the connected host account and ${preview.calendarEventsToDeleteCount} confidently linked Google Calendar event(s).`
                )}
              </p>
              <p className="text-[11px] text-text-muted">
                {confirmMode === 'clean_only'
                  ? _t(
                      `وضع المسح فقط: سيتم مسح الروابط القديمة من الجلسات بعد التأكد من خلو Zoom مع أرشفتها لحماية سجلات Grain، ولن يتم إنشاء أي اجتماعات Zoom جديدة أو أحداث تقويم جديدة. لن يتم المساس بـ ${preview.calendarEventsUntouchedCount} حدث تقويم غير مرتبط أو أي بيانات طلاب أو حصص أو مدفوعات.`,
                      `Clean Only Mode: Obsolete links will be archived (preserving Grain history) and cleared from Glück sessions, and ZERO new Zoom meetings or Calendar events will be created. ${preview.calendarEventsUntouchedCount} unrelated Calendar event(s) and all student/lesson/payment/attendance records remain untouched.`
                    )
                  : _t(
                      `بعد التحقق من خلو Zoom من الاجتماعات القديمة، سيتم إنشاء ${preview.activeGluckOnlineSessionsCount} اجتماع Glück جديد وإعادة مزامنة تقويم Google. لن يتم حذف ${preview.calendarEventsUntouchedCount} حدث تقويم غير مرتبط أو أي بيانات طلاب أو حصص أو مدفوعات.`,
                      `After verifying old Zoom meetings are empty, Glück will rebuild ${preview.activeGluckOnlineSessionsCount} active online session meeting(s) and re-sync Google Calendar. ${preview.calendarEventsUntouchedCount} unrelated Calendar event(s) and all student/lesson/payment/attendance records remain untouched.`
                    )}
              </p>
            </div>

            {preview.liveMeetingsBlockedCount > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                {_t(
                  `تحذير: يوجد ${preview.liveMeetingsBlockedCount} اجتماع جارٍ (Live) حالياً ولن يتم حذفه، ولن تكتمل حالة النظافة الكاملة قبل إنهائه.`,
                  `Warning: ${preview.liveMeetingsBlockedCount} live Zoom meeting(s) are currently running. They will NOT be deleted, and cleanup will not be marked fully complete until they end.`
                )}
              </div>
            )}

            <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none p-3 rounded-xl bg-surface-hover border border-surface-border">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-rose-600 shrink-0"
              />
              <span className="font-semibold text-text-main leading-relaxed">
                {confirmMode === 'clean_only'
                  ? _t(
                      'أؤكد أنني راجعت المعاينة وأوافق على الحذف الدائم لاجتماعات Zoom وأحداث التقويم المرتبطة فقط بدون إعادة بناء.',
                      'I have reviewed the preview and confirm permanent deletion of scheduled Zoom meetings and linked Calendar events ONLY (without rebuilding).'
                    )
                  : _t(
                      'أؤكد أنني راجعت المعاينة وأوافق على الحذف الدائم لاجتماعات Zoom القديمة وإعادة بناء اجتماعات مجموعات Glück.',
                      'I have reviewed the preview and confirm permanent deletion of old scheduled Zoom meetings and linked Calendar events, followed by rebuilding Glück meetings.'
                    )}
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="min-h-[42px] px-4 rounded-xl border border-surface-border text-xs font-semibold text-text-main hover:bg-surface-hover cursor-pointer"
              >
                {_t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={!confirmChecked || isExecuting}
                onClick={() => runOperation('start')}
                className="min-h-[42px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {confirmMode === 'clean_only' ? (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{_t('تأكيد وبدء المسح فقط', 'Confirm Clean Only')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{_t('تأكيد التنظيف وإعادة البناء', 'Confirm Clean & Rebuild')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
