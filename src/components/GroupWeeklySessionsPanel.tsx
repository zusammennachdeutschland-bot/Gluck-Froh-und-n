import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Video,
  Copy,
  Check,
  RefreshCw,
  Calendar,
  Download,
  ExternalLink,
  AlertTriangle,
  History,
  Link2,
  PlusCircle,
  MapPin,
  X
} from 'lucide-react';
import { Group, GroupWeeklySession, ZoomMeetingRecord, ZoomMeetingHistory } from '../types';
import { useApp } from '../context/AppContext';
import { isApprovedSyncedZoomSession } from '../services/zoomSessionStandardizer';
import { isMeetGroup } from '../utils/groupPlatformUtils';
import {
  loadZoomUiMeta,
  ZoomUiMetaState,
  ZoomAmbiguousMatchItem,
  ZoomVerifiedMeetingCandidate,
  syncOrRecoverZoomSession,
  linkVerifiedZoomMeetingToSession,
  updateZoomMeetingForSession,
  fetchHostStartUrlForSession,
  setManualZoomLinkForSession
} from '../services/zoomService';
import {
  CalendarSyncResult,
  buildGoogleCalendarSyncPreview,
  downloadSessionsIcsFile,
  requestGoogleCalendarAccessToken,
  syncSessionsToGoogleCalendar
} from '../services/calendarSyncService';

interface GroupWeeklySessionsPanelProps {
  group: Group;
}

export const GroupWeeklySessionsPanel: React.FC<GroupWeeklySessionsPanelProps> = ({ group }) => {
  const {
    groupWeeklySessions,
    zoomMeetingRecords,
    zoomMeetingHistory,
    applyZoomWorkspaceSnapshot,
    reconcileGroupSessionsState,
    language,
    _t,
    triggerToast
  } = useApp();

  const [zoomMeta, setZoomMeta] = useState<ZoomUiMetaState>(() => loadZoomUiMeta());
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [hostLaunchMap, setHostLaunchMap] = useState<Record<string, string>>({});
  const [manualModalSession, setManualModalSession] = useState<GroupWeeklySession | null>(null);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [confirmReplaceSession, setConfirmReplaceSession] = useState<GroupWeeklySession | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [ambiguousMatch, setAmbiguousMatch] = useState<ZoomAmbiguousMatchItem | null>(null);
  const [pendingPersistRetry, setPendingPersistRetry] = useState<{
    sessions?: GroupWeeklySession[];
    records?: ZoomMeetingRecord[];
    history?: ZoomMeetingHistory[];
    error: string;
  } | null>(null);
  const [isRetryingPersist, setIsRetryingPersist] = useState(false);

  // Calendar confirmation preview state (null = all group sessions, or 1 specific session)
  const [calendarConfirmOpen, setCalendarConfirmOpen] = useState(false);
  const [calendarTargetSession, setCalendarTargetSession] = useState<GroupWeeklySession | null>(null);
  const [forceResyncAllCalendar, setForceResyncAllCalendar] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarSyncProgress, setCalendarSyncProgress] = useState<{
    completed: number;
    total: number;
    title: string;
  } | null>(null);
  const [lastCalendarSyncResult, setLastCalendarSyncResult] = useState<CalendarSyncResult | null>(null);

  const autoInitGroupIdRef = useRef<string | null>(null);
  const isRtl = language === 'ar';

  const groupSessions = useMemo(
    () =>
      (groupWeeklySessions || [])
        .filter((s) => s && !s.deleted && s.groupId === group.id)
        .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)),
    [groupWeeklySessions, group.id]
  );

  const groupSessionsWithDeletedOrphans = useMemo(
    () =>
      (groupWeeklySessions || []).filter(
        (s) => s && s.groupId === group.id && (!s.deleted || Boolean(s.googleCalendarEventId))
      ),
    [groupWeeklySessions, group.id]
  );

  const groupHistory = useMemo(
    () =>
      (zoomMeetingHistory || [])
        .filter((h) => h && !h.deleted && h.groupId === group.id)
        .slice(0, 15),
    [zoomMeetingHistory, group.id]
  );

  const isOfflineGroup = group.type !== 'online';

  useEffect(() => {
    setZoomMeta(loadZoomUiMeta());
    if (groupSessions.length === 0 && autoInitGroupIdRef.current !== group.id) {
      autoInitGroupIdRef.current = group.id;
      reconcileGroupSessionsState(group, { includeOffline: isOfflineGroup });
    }
  }, [group, groupSessions.length, isOfflineGroup, reconcileGroupSessionsState]);

  const needsZoomResyncSessions = useMemo(
    () =>
      isOfflineGroup
        ? []
        : groupSessions.filter((s) => s.syncState === 'needs_update' && s.meetingSource === 'zoom_api'),
    [groupSessions, isOfflineGroup]
  );

  const needsCalendarResyncCount = useMemo(
    () => groupSessions.filter((s) => s.googleCalendarEventId && s.calendarSyncStatus === 'needs_update').length,
    [groupSessions]
  );

  const calendarPreview = useMemo(
    () =>
      buildGoogleCalendarSyncPreview(
        calendarTargetSession
          ? groupSessions.filter((s) => s.id === calendarTargetSession.id)
          : groupSessionsWithDeletedOrphans,
        {
          forceUpdateSynced: Boolean(calendarTargetSession) || forceResyncAllCalendar,
          includeDeletedCleanup: !calendarTargetSession
        }
      ),
    [groupSessions, groupSessionsWithDeletedOrphans, calendarTargetSession, forceResyncAllCalendar]
  );

  if (group.deleted || group.status === 'archived') {
    return null;
  }

  const openCalendarSyncModal = (target: GroupWeeklySession | null = null) => {
    setCalendarTargetSession(target);
    setForceResyncAllCalendar(false);
    setLastCalendarSyncResult(null);
    setCalendarSyncProgress(null);
    setCalendarConfirmOpen(true);
  };

  const handleCopyJoinUrl = async (session: GroupWeeklySession) => {
    const url = session.zoomJoinUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSessionId(session.id);
      setTimeout(() => setCopiedSessionId((prev) => (prev === session.id ? null : prev)), 2000);
      triggerToast(_t('تم نسخ رابط الحصة', 'Session join link copied', 'Beitrittslink kopiert'));
    } catch {
      triggerToast(url);
    }
  };

  const handleRetryPersist = async () => {
    if (!pendingPersistRetry || isRetryingPersist) return;
    setIsRetryingPersist(true);
    try {
      const res = await applyZoomWorkspaceSnapshot({
        sessions: pendingPersistRetry.sessions,
        records: pendingPersistRetry.records,
        history: pendingPersistRetry.history
      });
      if (!res.ok || !res.verified) {
        const msg = res.error || _t('تعذر تأكيد الحفظ المحلي', 'Failed to verify local save');
        setPendingPersistRetry((prev) => (prev ? { ...prev, error: msg } : null));
        triggerToast(msg);
        return;
      }
      setPendingPersistRetry(null);
      triggerToast(_t('تم حفظ ربط Zoom وتأكيده بنجاح', 'Zoom binding saved and verified'));
    } finally {
      setIsRetryingPersist(false);
    }
  };

  const handleSelectAmbiguousCandidate = async (candidate: ZoomVerifiedMeetingCandidate) => {
    if (!ambiguousMatch) return;
    const targetSession = groupSessions.find((s) => s.id === ambiguousMatch.sessionId);
    if (!targetSession) return;
    setBusySessionId(targetSession.id);
    try {
      const linked = linkVerifiedZoomMeetingToSession({
        session: targetSession,
        meeting: {
          zoomMeetingId: candidate.zoomMeetingId,
          joinUrl: candidate.joinUrl,
          meetingPasscode: candidate.meetingPasscode,
          topic: candidate.topic,
          timezone: candidate.timezone
        },
        sessions: groupWeeklySessions,
        records: zoomMeetingRecords,
        history: zoomMeetingHistory,
        reason: 'Teacher selected existing Zoom meeting from group panel'
      });
      const persistRes = await applyZoomWorkspaceSnapshot({
        sessions: linked.sessions,
        records: linked.records,
        history: linked.history
      });
      if (!persistRes.ok || !persistRes.verified) {
        const msg = persistRes.error || _t('تعذر حفظ الربط محلياً', 'Failed to persist link locally');
        setPendingPersistRetry({
          sessions: linked.sessions,
          records: linked.records,
          history: linked.history,
          error: msg
        });
        triggerToast(msg);
        return;
      }
      setPendingPersistRetry(null);
      setAmbiguousMatch(null);
      triggerToast(
        _t(`تم ربط الاجتماع الموجود (${candidate.zoomMeetingId}) بنجاح`, `Linked existing meeting (${candidate.zoomMeetingId})`)
      );
    } finally {
      setBusySessionId(null);
    }
  };

  const handleCreateOrSyncZoom = async (session: GroupWeeklySession, forceConfirmManual = false) => {
    // Meet groups run on Google Meet — never create or recover a Zoom meeting for them.
    if (isMeetGroup(group)) {
      triggerToast(_t('المجموعة دي شغالة على Google Meet — مفيش اجتماع Zoom ليها.', 'This group runs on Google Meet — no Zoom meeting applies.', 'Diese Gruppe nutzt Google Meet — kein Zoom-Meeting.'));
      return;
    }
    const hasExplicitManual =
      session.meetingSource === 'manual' &&
      session.syncState !== 'pending' &&
      Boolean(session.zoomJoinUrl);

    if (hasExplicitManual && !forceConfirmManual) {
      setConfirmReplaceSession(session);
      return;
    }

    setConfirmReplaceSession(null);
    setBusySessionId(session.id);
    try {
      const result = await syncOrRecoverZoomSession({
        session,
        sessions: groupWeeklySessions,
        records: zoomMeetingRecords,
        history: zoomMeetingHistory,
        timezone: zoomMeta.defaultTimezone
      });

      if (result.outcome === 'ambiguous' && result.ambiguousItem) {
        setAmbiguousMatch(result.ambiguousItem);
        triggerToast(
          _t(
            'تطابق غير مؤكد — اختر الاجتماع الموجود للربط بدون تكرار',
            'Ambiguous match — select the existing Zoom meeting to link without duplicates'
          )
        );
        return;
      }

      const persistRes = await applyZoomWorkspaceSnapshot({
        sessions: result.sessions,
        records: result.records,
        history: result.history
      });
      setZoomMeta(loadZoomUiMeta());

      if (!persistRes.ok || !persistRes.verified) {
        const msg = persistRes.error || _t('تعذر تأكيد الحفظ المحلي — أعد محاولة الحفظ بدون تكرار الاجتماعات', 'Failed to verify local save — retry save without duplicating meetings');
        setPendingPersistRetry({
          sessions: result.sessions,
          records: result.records,
          history: result.history,
          error: msg
        });
        triggerToast(msg);
        return;
      }

      setPendingPersistRetry(null);
      if (result.ok) {
        triggerToast(
          result.outcome === 'linked_existing'
            ? _t(
                `تم التحقق وربط الاجتماع الموجود: ${session.standardizedTitle}`,
                `Verified & linked existing meeting: ${session.standardizedTitle}`
              )
            : _t(
                `تمت مزامنة اجتماع Zoom وحفظه: ${session.standardizedTitle}`,
                `Zoom synced & saved: ${session.standardizedTitle}`,
                `Zoom synchronisiert: ${session.standardizedTitle}`
              )
        );
      } else {
        triggerToast(result.error || _t('فشل مزامنة اجتماع Zoom', 'Zoom sync failed', 'Zoom-Synchronisierung fehlgeschlagen'));
      }
    } finally {
      setBusySessionId(null);
    }
  };

  const handleBatchResyncGroupZoom = async () => {
    let workingSessions = [...groupWeeklySessions];
    let workingRecords = [...zoomMeetingRecords];
    let workingHistory = [...zoomMeetingHistory];
    let updatedCount = 0;

    for (const s of needsZoomResyncSessions) {
      setBusySessionId(s.id);
      const res = await updateZoomMeetingForSession({
        session: s,
        sessions: workingSessions,
        records: workingRecords,
        history: workingHistory,
        timezone: zoomMeta.defaultTimezone
      });
      workingSessions = res.sessions;
      workingRecords = res.records;
      workingHistory = res.history;
      if (res.ok) updatedCount++;
    }

    setBusySessionId(null);
    const persistRes = await applyZoomWorkspaceSnapshot({
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory
    });
    if (!persistRes.ok || !persistRes.verified) {
      const msg = persistRes.error || _t('تعذر حفظ التحديث محلياً', 'Failed to verify local save');
      setPendingPersistRetry({
        sessions: workingSessions,
        records: workingRecords,
        history: workingHistory,
        error: msg
      });
      triggerToast(msg);
      return;
    }
    setPendingPersistRetry(null);
    triggerToast(
      updatedCount > 0
        ? _t(
            `تم تحديث وحفظ ${updatedCount} اجتماع Zoom بنجاح`,
            `Updated & verified ${updatedCount} Zoom meeting(s)`,
            `${updatedCount} Zoom-Meeting(s) aktualisiert`
          )
        : _t('لم يتم تحديث أي اجتماع Zoom', 'No Zoom meetings were updated')
    );
  };

  const handleHostStart = async (session: GroupWeeklySession) => {
    if (!session.zoomMeetingId) return;
    setBusySessionId(session.id);
    try {
      const res = await fetchHostStartUrlForSession(session.zoomMeetingId);
      if (res.ok && res.startUrl) {
        setHostLaunchMap((prev) => ({ ...prev, [session.id]: res.startUrl! }));
        const a = document.createElement('a');
        a.href = res.startUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          setHostLaunchMap((prev) => {
            const copy = { ...prev };
            delete copy[session.id];
            return copy;
          });
        }, 60000);
      } else {
        triggerToast(res.error || _t('تعذر جلب رابط بدء المضيف', 'Could not fetch host start URL', 'Host-Startlink fehlgeschlagen'));
      }
    } finally {
      setBusySessionId(null);
    }
  };

  const handleSaveManualUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualModalSession) return;
    const res = setManualZoomLinkForSession({
      session: manualModalSession,
      manualUrl: manualUrlInput,
      sessions: groupWeeklySessions,
      records: zoomMeetingRecords,
      history: zoomMeetingHistory
    });
    if (!res.ok) {
      setManualError(res.error || 'Invalid Zoom URL');
      return;
    }
    const persistRes = await applyZoomWorkspaceSnapshot({
      sessions: res.sessions,
      records: res.records,
      history: res.history
    });
    if (!persistRes.ok || !persistRes.verified) {
      setManualError(persistRes.error || _t('فشل حفظ الرابط محلياً', 'Failed to persist link locally'));
      return;
    }
    setManualModalSession(null);
    setManualUrlInput('');
    setManualError(null);
    triggerToast(_t('تم حفظ رابط Zoom اليدوي وأرشفة السابق', 'Manual Zoom link saved & previous archived', 'Manueller Zoom-Link gespeichert'));
  };

  const handleConfirmGoogleCalendarSync = async (forceReauth = false) => {
    setIsSyncingCalendar(true);
    setLastCalendarSyncResult(null);
    const expectedTotal = Math.max(
      1,
      calendarPreview.createCount + calendarPreview.updateCount + calendarPreview.deleteCount
    );
    setCalendarSyncProgress({ completed: 0, total: expectedTotal, title: '' });

    try {
      let authRes = await requestGoogleCalendarAccessToken(forceReauth);
      if (!authRes.ok || !authRes.accessToken) {
        if (authRes.redirected) {
          triggerToast(
            _t(
              'جاري التحويل إلى Google لإتمام ربط التقويم...',
              'Redirecting to Google to complete Calendar authorization...'
            )
          );
          return;
        }
        const errMsg =
          authRes.error ||
          (authRes.cancelled
            ? _t('تم إلغاء تفويض Google Calendar', 'Google Calendar authorization was cancelled.')
            : _t('فشل تفويض Google Calendar', 'Google Calendar authorization failed', 'Google Kalender-Autorisierung fehlgeschlagen'));
        setLastCalendarSyncResult({
          success: false,
          errorCode: authRes.code,
          createdCount: 0,
          updatedCount: 0,
          deletedCount: 0,
          skippedCount: 0,
          failedCount: 1,
          sessions: groupWeeklySessions,
          errors: [{ sessionId: 'auth', title: 'Google Calendar Authorization', error: errMsg, code: authRes.code }]
        });
        triggerToast(errMsg);
        return;
      }

      const targetIds = calendarTargetSession
        ? new Set([calendarTargetSession.id])
        : new Set(groupSessionsWithDeletedOrphans.map((s) => s.id));
      const shouldForce = Boolean(calendarTargetSession) || forceResyncAllCalendar;

      let syncRes = await syncSessionsToGoogleCalendar({
        allSessions: groupWeeklySessions,
        targetSessionIds: targetIds,
        accessToken: authRes.accessToken,
        forceUpdateSynced: shouldForce,
        removeDeletedSessions: !calendarTargetSession,
        onProgress: (completed, total, title) => setCalendarSyncProgress({ completed, total, title })
      });

      if (syncRes.authExpired && !forceReauth) {
        authRes = await requestGoogleCalendarAccessToken(true);
        if (authRes.ok && authRes.accessToken) {
          syncRes = await syncSessionsToGoogleCalendar({
            allSessions: syncRes.sessions,
            targetSessionIds: targetIds,
            accessToken: authRes.accessToken,
            forceUpdateSynced: shouldForce,
            removeDeletedSessions: !calendarTargetSession,
            onProgress: (completed, total, title) => setCalendarSyncProgress({ completed, total, title })
          });
        }
      }

      await applyZoomWorkspaceSnapshot({ sessions: syncRes.sessions });
      setLastCalendarSyncResult(syncRes);

      if (syncRes.failedCount > 0) {
        triggerToast(
          syncRes.errors[0]?.error ||
            _t(
              `مزامنة التقويم: ${syncRes.createdCount} جديد، ${syncRes.updatedCount} محدث، ${syncRes.failedCount} فشل`,
              `Calendar sync: ${syncRes.createdCount} created, ${syncRes.updatedCount} updated, ${syncRes.failedCount} failed`
            )
        );
      } else {
        setCalendarConfirmOpen(false);
        setCalendarTargetSession(null);
        const delPart = syncRes.deletedCount
          ? _t(`، ${syncRes.deletedCount} محذوف`, `, ${syncRes.deletedCount} removed`)
          : '';
        triggerToast(
          _t(
            `مزامنة التقويم: ${syncRes.createdCount} جديد، ${syncRes.updatedCount} محدث${delPart}`,
            `Calendar synced: ${syncRes.createdCount} created, ${syncRes.updatedCount} updated${delPart}`,
            `Kalender synchronisiert: ${syncRes.createdCount} neu, ${syncRes.updatedCount} aktualisiert`
          )
        );
      }
    } finally {
      setIsSyncingCalendar(false);
      setCalendarSyncProgress(null);
    }
  };

  const getZoomStatusInfo = (session: GroupWeeklySession) => {
    switch (session.syncState) {
      case 'synced':
        return { text: _t('متزامن', 'Synced', 'Synchronisiert'), cls: 'text-emerald-600 dark:text-emerald-400' };
      case 'needs_update':
        return { text: _t('يحتاج تحديث', 'Needs update', 'Update nötig'), cls: 'text-amber-600 dark:text-amber-400' };
      case 'manual':
      case 'manual_only':
        return { text: _t('رابط يدوي', 'Manual link', 'Manueller Link'), cls: 'text-sky-600 dark:text-sky-400' };
      case 'error':
        return { text: _t('خطأ', 'Error', 'Fehler'), cls: 'text-rose-600 dark:text-rose-400' };
      default:
        return { text: _t('قيد الانتظار', 'Pending', 'Ausstehend'), cls: 'text-text-muted' };
    }
  };

  const calendarActionLabel = (action: 'create' | 'update' | 'delete' | 'skip_synced') => {
    switch (action) {
      case 'create':
        return { text: _t('إنشاء', 'Create'), cls: 'text-emerald-600 dark:text-emerald-400' };
      case 'update':
        return { text: _t('تحديث', 'Update'), cls: 'text-amber-600 dark:text-amber-400' };
      case 'delete':
        return { text: _t('إزالة', 'Remove'), cls: 'text-rose-600 dark:text-rose-400' };
      default:
        return { text: _t('متزامن', 'Synced'), cls: 'text-text-muted' };
    }
  };

  const totalPendingCalendarOps =
    calendarPreview.createCount + calendarPreview.updateCount + calendarPreview.deleteCount;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-3 pt-4 border-t border-surface-border mt-4">
      {/* Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {isOfflineGroup ? <Calendar className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-text-main truncate">
              {isOfflineGroup
                ? _t(
                    `مزامنة تقويم Google (${groupSessions.length})`,
                    `Google Calendar Sessions (${groupSessions.length})`,
                    `Google-Kalender-Sitzungen (${groupSessions.length})`
                  )
                : _t(
                    `حصص Zoom والتقويم (${groupSessions.length})`,
                    `Zoom & Calendar Sessions (${groupSessions.length})`,
                    `Zoom & Kalender-Sitzungen (${groupSessions.length})`
                  )}
            </h4>
            <p className="text-[11px] text-text-muted truncate">
              {isOfflineGroup
                ? group.address
                  ? `${_t('حضوري', 'In-Person')} · ${group.address}`
                  : _t(
                      'أضف مواعيد الحصص الأوفلاين (الحضورية) تلقائياً إلى تقويم Google بدون تكرار',
                      'Sync recurring in-person sessions directly to Google Calendar without duplicates'
                    )
                : _t(
                    'اجتماع أسبوعي موحد لكل موعد بدون أسماء طلاب في العنوان',
                    'Standardized recurring meeting per slot, no student names exposed'
                  )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {groupSessions.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => openCalendarSyncModal(null)}
                className="min-h-[36px] px-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{_t('مزامنة التقويم', 'Sync Calendar')}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadSessionsIcsFile(
                    groupSessions,
                    `${group.name.replace(/\s+/g, '_')}_${isOfflineGroup ? 'inperson' : 'zoom'}.ics`
                  )
                }
                className="min-h-[36px] px-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title={_t('تصدير .ics', 'Export .ics')}
              >
                <Download className="w-3.5 h-3.5" />
                <span>.ics</span>
              </button>
            </>
          )}
          {!isOfflineGroup && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="min-h-[36px] px-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-muted hover:text-text-main text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span className="tabular-nums">{groupHistory.length}</span>
            </button>
          )}
        </div>
      </div>

      {/* Persistence Retry Banner */}
      {pendingPersistRetry && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
          <div className="min-w-0">
            <span className="font-bold block">{_t('لم يتم تأكيد حفظ ربط Zoom محلياً', 'Zoom link save not yet verified locally')}</span>
            <span className="text-[11px] opacity-90">{pendingPersistRetry.error}</span>
          </div>
          <button
            type="button"
            disabled={isRetryingPersist}
            onClick={handleRetryPersist}
            className="min-h-[34px] px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {isRetryingPersist ? _t('جاري الحفظ...', 'Retrying...') : _t('إعادة محاولة الحفظ', 'Retry Save')}
          </button>
        </div>
      )}

      {/* Ambiguous Existing Zoom Meeting Selector */}
      {ambiguousMatch && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-amber-800 dark:text-amber-200">
              {_t('اختر الاجتماع الصحيح للربط بدون تكرار:', 'Select the matching existing Zoom meeting:')}
            </span>
            <button type="button" onClick={() => setAmbiguousMatch(null)} className="text-text-muted p-1 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[11px] text-amber-700 dark:text-amber-300">{ambiguousMatch.reason}</div>
          <div className="space-y-1">
            {ambiguousMatch.candidates.map((cand) => (
              <div key={cand.zoomMeetingId} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-surface-border">
                <div className="min-w-0 text-[11px]" dir="ltr">
                  <div className="font-semibold text-text-main truncate">{cand.topic || cand.zoomMeetingId}</div>
                  <div className="font-mono text-text-muted">ID {cand.zoomMeetingId}</div>
                </div>
                <button
                  type="button"
                  disabled={busySessionId !== null}
                  onClick={() => handleSelectAmbiguousCandidate(cand)}
                  className="min-h-[30px] px-2.5 rounded-lg bg-primary text-primary-fg text-[11px] font-bold shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {_t('ربط', 'Link')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resync Prompt Banner when Name/Time/Weekday Changed */}
      {(needsZoomResyncSessions.length > 0 || needsCalendarResyncCount > 0) && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <span className="font-bold block">
                {_t(
                  'تغير اسم المجموعة أو موعدها — الحصص السابقة محفوظة',
                  'Schedule or group name changed — historical lessons untouched'
                )}
              </span>
              <span className="text-[11px] opacity-85">
                {_t(
                  'حدّث اجتماعات Zoom أو تقويم Google ليطابق الموعد الجديد.',
                  'Update Zoom or Google Calendar to reflect the new schedule.'
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {needsZoomResyncSessions.length > 0 && zoomMeta.connected && (
              <button
                type="button"
                onClick={handleBatchResyncGroupZoom}
                disabled={busySessionId !== null}
                className="min-h-[36px] px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {_t('تحديث Zoom', 'Resync Zoom')}
              </button>
            )}
            {needsCalendarResyncCount > 0 && (
              <button
                type="button"
                onClick={() => openCalendarSyncModal(null)}
                className="min-h-[36px] px-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold cursor-pointer"
              >
                {_t('تحديث التقويم', 'Resync Calendar')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sessions List (Clean Hairline Divided Container) */}
      {groupSessions.length === 0 ? (
        <div className="p-4 rounded-xl bg-surface-hover/50 border border-dashed border-surface-border text-xs text-text-muted flex flex-wrap items-center justify-between gap-2">
          <span>
            {isOfflineGroup
              ? _t(
                  'لا توجد مواعيد أسبوعية محددة بعد. أضف الأيام والأوقات أعلاه ثم اضغط فحص المواعيد لإضافتها لتقويم Google.',
                  'No weekly slots configured yet. Set group days and times above to prepare Google Calendar events.'
                )
              : _t(
                  'لا توجد مواعيد أسبوعية محددة بعد. أضف الأيام والأوقات أعلاه لتوليد الجلسات الموحدة تلقائياً.',
                  'No weekly slots configured yet. Set group days and times above to generate sessions.'
                )}
          </span>
          <button
            type="button"
            onClick={() => reconcileGroupSessionsState(group, { includeOffline: isOfflineGroup })}
            className="min-h-[36px] px-3 rounded-xl bg-primary/10 text-primary text-xs font-bold shrink-0 cursor-pointer"
          >
            {_t('فحص المواعيد', 'Scan Slots')}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface border border-surface-border divide-y divide-surface-border overflow-hidden">
          {groupSessions.map((session) => {
            const joinUrl = session.zoomJoinUrl;
            const isBusy = busySessionId === session.id;
            const showBasicWarning = (zoomMeta.isBasicPlan || session.planWarning40Min) && session.durationMinutes >= 41;
            const hostStartUrl = hostLaunchMap[session.id];
            const zStatus = getZoomStatusInfo(session);
            const calSynced = Boolean(session.googleCalendarEventId && session.calendarSyncStatus === 'synced');
            const calNeedsUpdate = Boolean(session.googleCalendarEventId && session.calendarSyncStatus === 'needs_update');

            const isOfflineSlot = isOfflineGroup || session.sessionMode === 'offline';
            const slotAddress = (session.locationAddress || group.address || '').trim();

            return (
              <div key={session.id} className="p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs sm:text-sm font-bold text-text-main truncate" dir="ltr">
                      {session.standardizedTitle}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-muted tabular-nums">
                      {isOfflineSlot ? (
                        <span className="font-semibold text-primary inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{_t('حضوري (أوفلاين)', 'In-Person')}</span>
                        </span>
                      ) : (
                        <span className={`font-semibold ${zStatus.cls}`}>Zoom: {zStatus.text}</span>
                      )}
                      <span>·</span>
                      <span
                        className={`font-semibold ${
                          calSynced
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : calNeedsUpdate
                            ? 'text-amber-600 dark:text-amber-400'
                            : session.calendarSyncStatus === 'error'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-text-muted'
                        }`}
                      >
                        {_t('التقويم', 'Cal')}:{' '}
                        {calSynced
                          ? _t('متزامن', 'Synced')
                          : calNeedsUpdate
                          ? _t('تحديث', 'Update')
                          : session.calendarSyncStatus === 'error'
                          ? _t('خطأ', 'Error')
                          : _t('غير مضاف', 'Not synced')}
                      </span>
                      <span>·</span>
                      <span>
                        {session.durationMinutes} {_t('د', 'm')}
                      </span>
                      {!isOfflineSlot && session.zoomMeetingId && (
                        <>
                          <span>·</span>
                          <span className="font-mono" dir="ltr">
                            ID {session.zoomMeetingId}
                          </span>
                        </>
                      )}
                      {!isOfflineSlot && showBasicWarning && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            {_t('حد 40 د', '40m cap')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Clean Action Controls */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {!isOfflineSlot && session.meetingSource === 'zoom_api' && session.zoomMeetingId && zoomMeta.connected && (
                      <button
                        type="button"
                        onClick={() => handleHostStart(session)}
                        disabled={isBusy}
                        className="min-h-[36px] px-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{_t('بدء كمضيف', 'Host')}</span>
                      </button>
                    )}

                    {!isOfflineSlot && hostStartUrl && (
                      <a
                        href={hostStartUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] px-3 rounded-xl bg-primary-soft border border-primary-border text-primary text-xs font-bold flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{_t('فتح', 'Open')}</span>
                      </a>
                    )}

                    {!isOfflineSlot && zoomMeta.connected && (
                      <button
                        type="button"
                        onClick={() => handleCreateOrSyncZoom(session)}
                        disabled={isBusy}
                        className="min-h-[36px] px-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : session.meetingSource === 'zoom_api' ? (
                          <RefreshCw className="w-3.5 h-3.5" />
                        ) : (
                          <PlusCircle className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {session.meetingSource === 'zoom_api' && session.zoomMeetingId
                            ? _t('تحديث Zoom', 'Sync Zoom')
                            : _t('إنشاء Zoom', 'Create Zoom')}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openCalendarSyncModal(session)}
                      className="min-h-[36px] px-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{_t('التقويم', 'Cal')}</span>
                    </button>

                    {!isOfflineSlot && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualModalSession(session);
                          setManualUrlInput(joinUrl || '');
                          setManualError(null);
                        }}
                        className="min-h-[36px] px-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-muted hover:text-text-main text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        title={_t('رابط يدوي', 'Manual URL')}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isOfflineSlot ? (
                  slotAddress ? (
                    <div className="flex items-center gap-1.5 bg-surface-hover/60 px-3 py-1.5 rounded-xl text-[11px] text-text-muted">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                      <span className="truncate">{slotAddress}</span>
                    </div>
                  ) : null
                ) : isApprovedSyncedZoomSession(session) && joinUrl ? (
                  <div className="flex items-center justify-between gap-2 bg-surface-hover/60 px-3 py-1.5 rounded-xl text-[11px]">
                    <span className="font-mono text-primary truncate select-all" dir="ltr">
                      {joinUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyJoinUrl(session)}
                      className="min-h-[30px] px-2.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedSessionId === session.id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{_t('نسخ', 'Copy')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {session.syncState === 'needs_update'
                        ? _t('هذه الجلسة تحتاج تحديث Zoom قبل اعتماد رابطها في التذاكر والجدول', 'This slot needs a Zoom update before its link is approved for reminders & schedule')
                        : session.syncState === 'error'
                        ? _t('فشلت مزامنة Zoom لهذه الجلسة — أعد المزامنة لاعتماد الرابط', 'Zoom sync failed for this slot — resync to approve its link')
                        : session.syncState === 'pending' && joinUrl
                        ? _t('الرابط بانتظار التحقق والربط مع Zoom قبل اعتماده', 'Link is pending Zoom verification before being approved')
                        : _t('لم يتم اعتماد رابط Zoom لهذه الجلسة بعد — اضغط إنشاء/تحديث Zoom', 'No approved Zoom link for this slot yet — sync Zoom first')}
                    </span>
                  </div>
                )}

                {(session.calendarSyncError || (!isOfflineSlot && session.lastError)) && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg">
                    {session.calendarSyncError || session.lastError}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* History Drawer */}
      {showHistory && (
        <div className="p-3 rounded-xl bg-surface-hover/50 border border-surface-border space-y-2">
          <div className="text-xs font-bold text-text-main">
            {_t('سجل الروابط المؤرشفة (لحماية ربط تسجيلات Grain)', 'Archived Zoom Link History (Preserves Grain Matching)')}
          </div>
          {groupHistory.length === 0 ? (
            <p className="text-xs text-text-muted">
              {_t('لا يوجد تغييرات روابط مسجلة بعد.', 'No historical meeting changes recorded yet.')}
            </p>
          ) : (
            <div className="divide-y divide-surface-border max-h-44 overflow-y-auto text-[11px]">
              {groupHistory.map((h) => (
                <div key={h.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-text-main">{h.reason || h.newTopic || h.previousTopic}</span>
                    <div className="font-mono text-[10.5px] text-text-muted mt-0.5 tabular-nums" dir="ltr">
                      {h.previousZoomMeetingId && <span>{h.previousZoomMeetingId} </span>}
                      {h.newZoomMeetingId && <span>→ {h.newZoomMeetingId}</span>}
                    </div>
                  </div>
                  <span className="font-mono text-[10.5px] text-text-muted shrink-0 tabular-nums">
                    {new Date(h.recordedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm Replace Manual Link Modal */}
      {confirmReplaceSession && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface border-t sm:border border-surface-border rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 pb-safe-bottom sm:pb-5 space-y-3.5 shadow-2xl">
            <div className="w-10 h-1 bg-surface-border rounded-full mx-auto -mt-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-bold text-text-main">
                {_t('استبدال الرابط اليدوي باجتماع موحد', 'Replace Manual Link with Standardized Meeting')}
              </h5>
              <button
                type="button"
                onClick={() => setConfirmReplaceSession(null)}
                className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-text-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {_t(
                `سيتم حفظ الرابط الحالي في السجل (لاستمرار ربط تسجيلات Grain السابقة) ثم إنشاء اجتماع متكرر باسم: "${confirmReplaceSession.standardizedTitle}".`,
                `The existing link will be archived so historical Grain recordings stay matched, and a new recurring meeting "${confirmReplaceSession.standardizedTitle}" will be created.`
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmReplaceSession(null)}
                className="min-h-[40px] px-4 rounded-xl border border-surface-border text-xs font-semibold text-text-main cursor-pointer"
              >
                {_t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleCreateOrSyncZoom(confirmReplaceSession, true)}
                className="min-h-[40px] px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold cursor-pointer"
              >
                {_t('تأكيد الإنشاء والأرشفة', 'Archive & Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Zoom URL Override Modal */}
      {manualModalSession && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveManualUrl}
            className="bg-surface border-t sm:border border-surface-border rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 pb-safe-bottom sm:pb-5 space-y-3.5 shadow-2xl"
          >
            <div className="w-10 h-1 bg-surface-border rounded-full mx-auto -mt-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-bold text-text-main">
                {_t('تعيين رابط Zoom يدوي', 'Manual Zoom Link Override')}
              </h5>
              <button
                type="button"
                onClick={() => setManualModalSession(null)}
                className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-text-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-text-muted" dir="ltr">
              {manualModalSession.standardizedTitle}
            </p>
            <input
              type="url"
              required
              dir="ltr"
              value={manualUrlInput}
              onChange={(e) => setManualUrlInput(e.target.value)}
              placeholder="https://zoom.us/j/1234567890?pwd=..."
              className="w-full min-h-[42px] px-3 rounded-xl bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
            />
            {manualError && <p className="text-xs text-rose-600 font-semibold">{manualError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualModalSession(null)}
                className="min-h-[40px] px-4 rounded-xl border border-surface-border text-xs font-semibold text-text-main cursor-pointer"
              >
                {_t('إلغاء', 'Cancel')}
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold cursor-pointer"
              >
                {_t('حفظ الرابط', 'Save Link')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Explicit Confirmation Modal for Google Calendar Sync */}
      {calendarConfirmOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface border-t sm:border border-surface-border rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-5 pb-safe-bottom sm:pb-5 space-y-4 shadow-2xl max-h-[88dvh] flex flex-col">
            <div className="w-10 h-1 bg-surface-border rounded-full mx-auto -mt-1 sm:hidden shrink-0" />
            <div className="flex items-start justify-between gap-2">
              <div>
                <h5 className="text-sm font-bold text-text-main">
                  {_t('مزامنة مع تقويم Google', 'Sync with Google Calendar')}
                </h5>
                <p className="text-xs text-text-muted mt-0.5">
                  {_t(
                    'يتم تحديث أحداث هذه المجموعة فقط بدون المساس بالأحداث الأخرى.',
                    'Only this group’s Glück events are updated; other Calendar events stay untouched.'
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={isSyncingCalendar}
                onClick={() => {
                  setCalendarConfirmOpen(false);
                  setCalendarTargetSession(null);
                }}
                className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-text-muted cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`grid ${
                calendarPreview.deleteCount > 0 ? 'grid-cols-4' : 'grid-cols-3'
              } rounded-xl bg-surface-hover border border-surface-border divide-x divide-surface-border text-center py-2.5`}
            >
              <div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {calendarPreview.createCount}
                </div>
                <div className="text-[11px] text-text-muted">{_t('جديد', 'Create')}</div>
              </div>
              <div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {calendarPreview.updateCount}
                </div>
                <div className="text-[11px] text-text-muted">{_t('تحديث', 'Update')}</div>
              </div>
              {calendarPreview.deleteCount > 0 && (
                <div>
                  <div className="text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {calendarPreview.deleteCount}
                  </div>
                  <div className="text-[11px] text-text-muted">{_t('إزالة', 'Remove')}</div>
                </div>
              )}
              <div>
                <div className="text-base font-bold text-text-main tabular-nums">
                  {calendarPreview.skipSyncedCount}
                </div>
                <div className="text-[11px] text-text-muted">{_t('متزامن', 'Synced')}</div>
              </div>
            </div>

            {!calendarTargetSession && calendarPreview.skipSyncedCount + calendarPreview.updateCount > 0 && (
              <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-hover/60 border border-surface-border text-xs text-text-main cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceResyncAllCalendar}
                  disabled={isSyncingCalendar}
                  onChange={(e) => setForceResyncAllCalendar(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span>
                  {_t(
                    'إعادة مزامنة الحصص المتزامنة مسبقاً أيضاً',
                    'Force re-sync already synced sessions too'
                  )}
                </span>
              </label>
            )}

            {isSyncingCalendar && calendarSyncProgress && (
              <div className="p-3 rounded-xl bg-primary-soft border border-primary-border space-y-2">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-semibold text-text-main truncate" dir="ltr">
                    {calendarSyncProgress.title || _t('جاري المزامنة...', 'Syncing...')}
                  </span>
                  <span className="font-mono tabular-nums text-text-muted shrink-0">
                    {calendarSyncProgress.completed} / {calendarSyncProgress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((calendarSyncProgress.completed / Math.max(1, calendarSyncProgress.total)) * 100)
                      )}%`
                    }}
                  />
                </div>
              </div>
            )}

            {lastCalendarSyncResult && lastCalendarSyncResult.failedCount > 0 && !isSyncingCalendar && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {_t(
                      `فشل مزامنة ${lastCalendarSyncResult.failedCount} عنصر${lastCalendarSyncResult.errorCode ? ` (${lastCalendarSyncResult.errorCode})` : ''}`,
                      `${lastCalendarSyncResult.failedCount} item(s) failed${lastCalendarSyncResult.errorCode ? ` (${lastCalendarSyncResult.errorCode})` : ''}`
                    )}
                  </span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {lastCalendarSyncResult.errors.slice(0, 4).map((err, idx) => (
                    <div key={`${err.sessionId}_${idx}`} className="text-[11px]">
                      <span className="font-semibold">{err.title}:</span> {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-44 overflow-y-auto border border-surface-border rounded-xl divide-y divide-surface-border text-xs">
              {calendarPreview.items.map((item) => {
                const act = calendarActionLabel(item.action);
                return (
                  <div key={item.sessionId} className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="font-medium text-text-main truncate" dir="ltr">
                      {item.standardizedTitle}
                    </span>
                    <span className={`text-[11px] font-semibold shrink-0 ${act.cls}`}>{act.text}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isSyncingCalendar}
                onClick={() => {
                  setCalendarConfirmOpen(false);
                  setCalendarTargetSession(null);
                }}
                className="min-h-[40px] px-4 rounded-xl border border-surface-border text-xs font-semibold text-text-main cursor-pointer disabled:opacity-40"
              >
                {_t('إلغاء', 'Cancel')}
              </button>

              {(lastCalendarSyncResult?.scopeInsufficient || lastCalendarSyncResult?.authExpired) && (
                <button
                  type="button"
                  disabled={isSyncingCalendar}
                  onClick={() => handleConfirmGoogleCalendarSync(true)}
                  className="min-h-[40px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{_t('إعادة الربط والمزامنة', 'Reconnect & Sync')}</span>
                </button>
              )}

              <button
                type="button"
                disabled={isSyncingCalendar || (totalPendingCalendarOps === 0 && !forceResyncAllCalendar)}
                onClick={() => handleConfirmGoogleCalendarSync(false)}
                className="min-h-[40px] px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {isSyncingCalendar
                    ? _t('جاري المزامنة...', 'Syncing...')
                    : totalPendingCalendarOps === 0
                    ? _t('الكل متزامن', 'All Synced')
                    : _t(`مزامنة (${totalPendingCalendarOps})`, `Sync (${totalPendingCalendarOps})`)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
