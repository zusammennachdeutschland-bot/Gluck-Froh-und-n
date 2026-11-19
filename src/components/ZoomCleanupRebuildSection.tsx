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
  requestGoogleCalendarAccessToken
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
  onConnectCalendar: (forcePrompt?: boolean) => Promise<void>;
}

export const ZoomCleanupRebuildSection: React.FC<ZoomCleanupRebuildSectionProps> = ({
  timezone,
  zoomConnected,
  calendarConn,
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

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
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

    pauseRequestedRef.current = false;
    setConfirmModalOpen(false);
    setConfirmChecked(false);
    setIsExecuting(true);
    setPreviewError(null);

    try {
      const currentCalToken = getInMemoryGoogleCalendarToken();
      const result = await executeZoomCalendarCleanupRebuild({
        mode,
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
        triggerToast(
          _t(
            `اكتمل التنظيف وإعادة البناء وتم التحقق: ${result.operation.report.newGluckZoomMeetingsCreated} اجتماع جديد`,
            `Clean & Rebuild completed and verified: ${result.operation.report.newGluckZoomMeetingsCreated} new meetings`
          )
        );
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
    <div className="bg-surface border border-rose-500/30 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-text-main">
              {_t(
                'تنظيف وإعادة بناء اجتماعات Glück (Clean & Rebuild Glück Meetings)',
                'Clean & Rebuild Glück Meetings',
                'Glück-Meetings bereinigen & neu aufbauen'
              )}
            </h4>
            <p className="text-[11px] text-text-muted mt-0.5">
              {_t(
                'حذف جميع اجتماعات Zoom المجدولة القديمة من حساب المضيف المتصل وأحداث Google Calendar المرتبطة بها فقط، ثم إعادة إنشاء اجتماعات مجموعات Glück الأونلاين النشطة ومزامنة التقويم مع التحقق النهائي.',
                'Deletes all old scheduled Zoom meetings in the single connected Zoom host account and only confidently linked Google Calendar events, then rebuilds Glück active online group meetings and re-syncs Google Calendar with final verification.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!zoomConnected || isLoadingPreview || isExecuting}
            onClick={handlePreviewCleanup}
            className="px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 border border-surface-border text-text-main text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Eye className={`w-3.5 h-3.5 text-primary ${isLoadingPreview ? 'animate-pulse' : ''}`} />
            <span>
              {isLoadingPreview
                ? _t('جاري الفحص...', 'Scanning Zoom & Calendar...')
                : _t('معاينة التنظيف', 'Preview Cleanup')}
            </span>
          </button>

          <button
            type="button"
            disabled={!zoomConnected || !preview || isLoadingPreview || isExecuting}
            onClick={() => {
              setConfirmChecked(false);
              setConfirmModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{_t('تنظيف وإعادة بناء', 'Clean & Rebuild')}</span>
          </button>
        </div>
      </div>

      {/* Host Scope Disclosure + Safety Reminder */}
      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {preview?.hostScopeDisclosure ||
              _t(
                'النطاق: يتم فحص وتنظيف الاجتماعات المجدولة التابعة للمضيف المتصل فقط (/users/me/meetings). جميع بيانات الطلاب والحصص والمدفوعات والحضور وأحداث التقويم الشخصية غير المرتبطة محفوظة ولن تُمس.',
                'Scope: Only scheduled meetings owned by the single connected Zoom host (/users/me/meetings) are cleaned. Students, groups, lessons, attendance, payments, Grain matches, and unrelated personal/school Calendar events are never deleted.'
              )}
          </span>
        </div>
        {!hasCalendarToken && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-500/20">
            <span>
              {_t(
                'Google Calendar غير متصل حالياً — اتصل بالتقويم أولاً إذا كنت تريد تنظيف وإعادة بناء أحداث Google Calendar تلقائياً.',
                'Google Calendar is not currently connected — connect Calendar first if you also want linked Google Calendar events cleaned and rebuilt.'
              )}
            </span>
            <button
              type="button"
              onClick={() => onConnectCalendar(calendarConn.status === 'reconnect_required' || calendarConn.status === 'expired')}
              className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10.5px] cursor-pointer"
            >
              {_t('ربط Google Calendar', 'Connect Google Calendar')}
            </button>
          </div>
        )}
      </div>

      {previewError && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{previewError}</span>
        </div>
      )}

      {/* Active / Interrupted / Resumable Progress Banner */}
      {(isExecuting || canResume) && operation && (
        <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-black text-text-main">
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isExecuting ? 'animate-spin' : ''}`} />
              <span>
                {progress?.phaseLabel ||
                  (operation.state === 'paused'
                    ? _t('العملية متوقفة مؤقتاً (قابلة للاستكمال)', 'Operation Paused (Resumable)')
                    : _t('عملية سابقة غير مكتملة (قابلة للاستكمال)', 'Interrupted Operation Found (Resumable)'))}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface border border-surface-border font-mono text-[10px]">
                {operation.state}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {isExecuting ? (
                <button
                  type="button"
                  onClick={() => {
                    pauseRequestedRef.current = true;
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>{_t('إيقاف مؤقت آمن', 'Pause / Cancel')}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => runOperation('resume')}
                    className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-hover text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{_t('استكمال العملية', 'Resume Operation')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissSavedOperation}
                    className="px-2 py-1 rounded-lg border border-surface-border text-[11px] font-bold text-text-muted cursor-pointer"
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
                  className="h-full bg-sky-600 transition-all"
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
        <div className="space-y-3 pt-2 border-t border-surface-border">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black text-text-main">
              {_t('نتائج معاينة التنظيف وإعادة البناء (لم يتم حذف أي شيء بعد)', 'Cleanup & Rebuild Preview (Read-Only — Nothing Deleted Yet)')}
            </span>
            <span className="text-[10.5px] font-mono text-text-muted" dir="ltr">
              {preview.timezone} • {preview.hostEmail || 'connected host'}
            </span>
          </div>

          {/* Required 7 Preview Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-surface-hover border border-surface-border">
              <span className="font-black text-text-main block tabular-nums">{preview.totalScheduledZoomMeetingsFound}</span>
              <span className="text-[10px] text-text-muted">{_t('إجمالي اجتماعات Zoom', 'Zoom Found')}</span>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/25">
              <span className="font-black text-rose-600 block tabular-nums">{preview.zoomMeetingsToDeleteCount}</span>
              <span className="text-[10px] text-text-muted">{_t('Zoom ستحذف', 'Zoom to Delete')}</span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
              <span className="font-black text-emerald-600 block tabular-nums">{preview.activeGluckOnlineSessionsCount}</span>
              <span className="text-[10px] text-text-muted">{_t('جلسات Glück ستُبنى', 'Sessions to Rebuild')}</span>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/25">
              <span className="font-black text-rose-600 block tabular-nums">{preview.calendarEventsToDeleteCount}</span>
              <span className="text-[10px] text-text-muted">{_t('أحداث تقويم مرتبطة ستحذف', 'Cal Events to Delete')}</span>
            </div>
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/25">
              <span className="font-black text-sky-600 block tabular-nums">{preview.calendarEventsUntouchedCount}</span>
              <span className="text-[10px] text-text-muted">{_t('أحداث تقويم لن تُمس', 'Cal Untouched')}</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <span className="font-black text-amber-600 block tabular-nums">{preview.liveMeetingsBlockedCount}</span>
              <span className="text-[10px] text-text-muted">{_t('اجتماعات جارية الآن', 'Live (Protected)')}</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <span className="font-black text-amber-700 dark:text-amber-300 block tabular-nums">{preview.manualResolutionItems.length}</span>
              <span className="text-[10px] text-text-muted">{_t('تحتاج مراجعة يدوية', 'Manual Review')}</span>
            </div>
          </div>

          {/* Manual Resolution / Live Meetings Warning Box */}
          {preview.manualResolutionItems.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1 text-[11px]">
              <div className="font-black text-amber-800 dark:text-amber-300">
                {_t('سجلات تتطلب انتباهاً أو مراجعة يدوية:', 'Items Requiring Attention / Manual Resolution:')}
              </div>
              <ul className="space-y-1 list-disc list-inside text-amber-900 dark:text-amber-200">
                {preview.manualResolutionItems.map((item, idx) => (
                  <li key={`${item.category}_${item.id}_${idx}`}>
                    <span className="font-bold">{item.title}:</span> {item.detail}
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
              className="w-full px-3 py-2 bg-surface-hover/60 flex items-center justify-between text-xs font-black text-text-main cursor-pointer"
            >
              <span>
                {_t(
                  `اجتماعات Zoom المكتشفة (${preview.zoomMeetings.length})`,
                  `Discovered Zoom Meetings (${preview.zoomMeetings.length})`
                )}
              </span>
              {showZoomDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showZoomDetails && (
              <div className="max-h-52 overflow-y-auto divide-y divide-surface-border text-[11px]">
                {preview.zoomMeetings.length === 0 ? (
                  <div className="p-3 text-text-muted text-center">
                    {_t('لا توجد اجتماعات Zoom مجدولة حالياً في هذا الحساب.', 'No scheduled Zoom meetings currently exist in this account.')}
                  </div>
                ) : (
                  preview.zoomMeetings.map((m) => (
                    <div key={m.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-text-main truncate" dir="ltr">
                          {m.topic}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono flex flex-wrap gap-2" dir="ltr">
                          <span>ID: {m.id}</span>
                          {m.startTime && <span>Start: {m.startTime}</span>}
                          <span>{m.isRecurring ? 'Recurring Series' : `Type ${m.type}`}</span>
                          {m.associatedGroupName ? (
                            <span className="text-primary font-sans font-bold">
                              Glück: {m.associatedGroupName}
                              {m.associatedSessionCode ? ` (${m.associatedSessionCode})` : ''}
                            </span>
                          ) : (
                            <span className="text-text-muted font-sans">External / Manual / Unreferenced</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-black border shrink-0 ${
                          m.isLive
                            ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                        }`}
                      >
                        {m.isLive ? _t('جارٍ الآن — لن يُحذف', 'LIVE — PROTECTED') : _t('سيتم حذفه', 'WILL DELETE')}
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
              className="w-full px-3 py-2 bg-surface-hover/60 flex items-center justify-between text-xs font-black text-text-main cursor-pointer"
            >
              <span>
                {_t(
                  `أحداث Google Calendar المرتبطة التي ستُحذف (${preview.calendarEventsToDeleteCount}) • غير مرتبطة محفوظة (${preview.calendarEventsUntouchedCount})`,
                  `Linked Google Calendar Events to Delete (${preview.calendarEventsToDeleteCount}) • Untouched (${preview.calendarEventsUntouchedCount})`
                )}
              </span>
              {showCalendarDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showCalendarDetails && (
              <div className="max-h-48 overflow-y-auto divide-y divide-surface-border text-[11px]">
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
                    <div key={e.eventId} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-text-main truncate" dir="ltr">{e.summary}</div>
                        <div className="text-[10px] text-text-muted font-mono" dir="ltr">
                          Event ID: {e.eventId}
                          {e.startDateTime ? ` • ${e.startDateTime}` : ''}
                          {e.isRecurringSeries ? ' • Recurring' : ''}
                          {` • Signals: ${e.signals.join(', ')}`}
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-500/15 text-rose-600 border border-rose-500/30">
                        {_t('سيُحذف', 'WILL DELETE')}
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
              className="w-full px-3 py-2 bg-surface-hover/60 flex items-center justify-between text-xs font-black text-text-main cursor-pointer"
            >
              <span>
                {_t(
                  `جلسات Glück الأسبوعية التي ستُعاد بناؤها (${preview.activeGluckOnlineSessionsCount})`,
                  `Active Glück Weekly Sessions to Rebuild (${preview.activeGluckOnlineSessionsCount})`
                )}
              </span>
              {showRebuildDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showRebuildDetails && (
              <div className="max-h-48 overflow-y-auto divide-y divide-surface-border text-[11px]">
                {preview.activeSessionsToRebuild.map((s) => (
                  <div key={s.sessionId} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-text-muted mr-1.5">[{s.sessionCode}]</span>
                      <span className="font-bold text-text-main" dir="ltr">{s.standardizedTitle}</span>
                      <span className="ml-2 text-[10px] text-text-muted font-mono">
                        {s.durationMinutes}m
                      </span>
                      {s.planWarning40Min && (
                        <span className="ml-2 text-[10px] font-bold text-amber-600">(Basic 40m warning)</span>
                      )}
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                      {_t('إعادة إنشاء', 'WILL REBUILD')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Final User Report (Always visible after completion, error, or verification) */}
      {operation && (operation.state === 'completed' || operation.state === 'completed_with_errors' || operation.state === 'failed') && (
        <div
          className={`p-3.5 rounded-xl border space-y-3 ${
            operation.state === 'completed' && operation.report.verificationPassed
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {operation.state === 'completed' && operation.report.verificationPassed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span className="text-xs font-black text-text-main">
                {operation.state === 'completed' && operation.report.verificationPassed
                  ? _t('التقرير النهائي: اكتمل التنظيف وإعادة البناء وتم التحقق بنجاح', 'Final Report: Clean & Rebuild Completed & Verified')
                  : _t('التقرير النهائي: انتهت العملية مع مشاكل متبقية تحتاج إجراء', 'Final Report: Completed With Remaining Issues')}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {canRetryFailed && (
                <button
                  type="button"
                  onClick={() => runOperation('retry_failed')}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{_t('إعادة محاولة العمليات الفاشلة', 'Retry Failed Operations')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDismissSavedOperation}
                className="px-2 py-1 rounded-lg border border-surface-border bg-surface text-[11px] font-bold text-text-muted cursor-pointer"
              >
                {_t('إغلاق التقرير', 'Clear Report')}
              </button>
            </div>
          </div>

          {/* All Required Report Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-surface border border-surface-border">
              <span className="font-black text-text-main block tabular-nums">{operation.report.zoomMeetingsFoundBeforeCleanup}</span>
              <span className="text-[10px] text-text-muted">{_t('Zoom قبل التنظيف', 'Zoom Found Before')}</span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-surface-border">
              <span className="font-black text-emerald-600 block tabular-nums">{operation.report.zoomMeetingsDeleted}</span>
              <span className="text-[10px] text-text-muted">{_t('Zoom محذوفة', 'Zoom Deleted')}</span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-surface-border">
              <span className="font-black text-amber-600 block tabular-nums">{operation.report.zoomMeetingsSkippedOrFailed}</span>
              <span className="text-[10px] text-text-muted">{_t('Zoom متخطى / فاشل', 'Zoom Skipped/Failed')}</span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-surface-border">
              <span className="font-black text-emerald-600 block tabular-nums">{operation.report.calendarEventsDeleted}</span>
              <span className="text-[10px] text-text-muted">{_t('أحداث تقويم محذوفة', 'Cal Events Deleted')}</span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-surface-border">
              <span className="font-black text-sky-600 block tabular-nums">{operation.report.calendarEventsUntouched}</span>
              <span className="text-[10px] text-text-muted">{_t('أحداث تقويم محفوظة', 'Cal Untouched')}</span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-surface-border">
              <span className="font-black text-primary block tabular-nums">{operation.report.newGluckZoomMeetingsCreated}</span>
              <span className="text-[10px] text-text-muted">{_t('اجتماعات Glück الجديدة', 'New Zoom Created')}</span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-surface-border">
              <span className="font-black text-emerald-600 block tabular-nums">{operation.report.calendarEventsRecreatedOrUpdated}</span>
              <span className="text-[10px] text-text-muted">{_t('أحداث التقويم المحدثة', 'Cal Recreated/Synced')}</span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-surface-border">
              <span className={`font-black block tabular-nums ${operation.report.failedItemsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {operation.report.failedItemsCount}
              </span>
              <span className="text-[10px] text-text-muted">{_t('عناصر فاشلة', 'Failed Items')}</span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-surface-border sm:col-span-2">
              <span
                className={`font-black block ${
                  operation.report.verificationPassed ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {operation.report.verificationPassed
                  ? _t('ناجح ✓ (Verification Passed)', 'PASSED ✓')
                  : _t('فشل التحقق ✗ (Verification Failed)', 'FAILED ✗')}
              </span>
              <span className="text-[10px] text-text-muted">
                {_t('حالة التحقق النهائي من Zoom والتقويم', 'Final Zoom & Calendar Inventory Verification')}
              </span>
            </div>
          </div>

          {operation.report.remainingProblems.length > 0 && (
            <div className="p-2.5 rounded-lg bg-surface border border-rose-500/30 text-[11px] space-y-1">
              <div className="font-black text-rose-600 dark:text-rose-400">
                {_t('المشاكل المتبقية المطلوب معالجتها:', 'Remaining Problems:')}
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-text-main">
                {operation.report.remainingProblems.map((prob, i) => (
                  <li key={i}>{prob}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] font-mono text-text-muted flex flex-wrap gap-3" dir="ltr">
            <span>Operation ID: {operation.operationId}</span>
            <span>Recovery Snapshot: {operation.snapshotId}</span>
          </div>
        </div>
      )}

      {/* Explicit Destructive Confirmation Modal */}
      {confirmModalOpen && preview && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-rose-500/40 rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-sm font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{_t('تأكيد نهائي: تنظيف وإعادة بناء اجتماعات Glück', 'Confirm Destructive Cleanup & Rebuild')}</span>
              </h5>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="p-1 text-text-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs space-y-1.5 text-text-main">
              <p className="font-bold">
                {_t(
                  `سيتم حذف ${preview.zoomMeetingsToDeleteCount} اجتماع Zoom مجدول بشكل دائم (بما في ذلك السلاسل المتكررة بالكامل) من حساب المضيف المتصل، وحذف ${preview.calendarEventsToDeleteCount} حدث Google Calendar مرتبط فقط.`,
                  `This will permanently delete ${preview.zoomMeetingsToDeleteCount} scheduled Zoom meeting(s) (including full recurring series) in the connected host account and ${preview.calendarEventsToDeleteCount} confidently linked Google Calendar event(s).`
                )}
              </p>
              <p className="text-[11px] text-text-muted">
                {_t(
                  `بعد التحقق من خلو Zoom من الاجتماعات القديمة، سيتم إنشاء ${preview.activeGluckOnlineSessionsCount} اجتماع Glück جديد وإعادة مزامنة تقويم Google. لن يتم حذف ${preview.calendarEventsUntouchedCount} حدث تقويم غير مرتبط أو أي بيانات طلاب أو حصص أو مدفوعات.`,
                  `After verifying old Zoom meetings are empty, Glück will rebuild ${preview.activeGluckOnlineSessionsCount} active online session meeting(s) and re-sync Google Calendar. ${preview.calendarEventsUntouchedCount} unrelated Calendar event(s) and all student/lesson/payment/attendance records remain untouched.`
                )}
              </p>
            </div>

            {preview.liveMeetingsBlockedCount > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 font-bold">
                {_t(
                  `تحذير: يوجد ${preview.liveMeetingsBlockedCount} اجتماع جارٍ (Live) حالياً ولن يتم حذفه، ولن تكتمل حالة النظافة الكاملة قبل إنهائه.`,
                  `Warning: ${preview.liveMeetingsBlockedCount} live Zoom meeting(s) are currently running. They will NOT be deleted, and cleanup will not be marked fully complete until they end.`
                )}
              </div>
            )}

            <label className="flex items-start gap-2 text-xs cursor-pointer select-none p-2 rounded-lg bg-surface-hover border border-surface-border">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 accent-rose-600"
              />
              <span className="font-bold text-text-main">
                {_t(
                  'أؤكد أنني راجعت المعاينة وأوافق على الحذف الدائم لاجتماعات Zoom القديمة وإعادة بناء اجتماعات مجموعات Glück.',
                  'I have reviewed the preview and confirm permanent deletion of old scheduled Zoom meetings and linked Calendar events, followed by rebuilding Glück meetings.'
                )}
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-bold text-text-main cursor-pointer"
              >
                {_t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={!confirmChecked || isExecuting}
                onClick={() => runOperation('start')}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{_t('تأكيد وبدء التنظيف وإعادة البناء', 'Confirm & Run Clean & Rebuild')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
