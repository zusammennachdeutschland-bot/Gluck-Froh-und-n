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
  Clock,
  ShieldCheck,
  X
} from 'lucide-react';
import { Group, GroupWeeklySession } from '../types';
import { useApp } from '../context/AppContext';
import {
  loadZoomUiMeta,
  ZoomUiMetaState,
  createOrReplaceZoomMeetingForSession,
  updateZoomMeetingForSession,
  fetchHostStartUrlForSession,
  setManualZoomLinkForSession
} from '../services/zoomService';
import {
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

  // Calendar confirmation preview state (null = all group sessions, or 1 specific session)
  const [calendarConfirmOpen, setCalendarConfirmOpen] = useState(false);
  const [calendarTargetSession, setCalendarTargetSession] = useState<GroupWeeklySession | null>(null);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);

  const autoInitGroupIdRef = useRef<string | null>(null);
  const isRtl = language === 'ar';

  const groupSessions = useMemo(
    () =>
      (groupWeeklySessions || [])
        .filter((s) => s && !s.deleted && s.groupId === group.id)
        .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)),
    [groupWeeklySessions, group.id]
  );

  const groupHistory = useMemo(
    () =>
      (zoomMeetingHistory || [])
        .filter((h) => h && !h.deleted && h.groupId === group.id)
        .slice(0, 15),
    [zoomMeetingHistory, group.id]
  );

  useEffect(() => {
    setZoomMeta(loadZoomUiMeta());
    if (group.type === 'online' && groupSessions.length === 0 && autoInitGroupIdRef.current !== group.id) {
      autoInitGroupIdRef.current = group.id;
      reconcileGroupSessionsState(group);
    }
  }, [group, groupSessions.length, reconcileGroupSessionsState]);

  const needsZoomResyncSessions = useMemo(
    () => groupSessions.filter((s) => s.syncState === 'needs_update' && s.meetingSource === 'zoom_api'),
    [groupSessions]
  );

  const needsCalendarResyncCount = useMemo(
    () => groupSessions.filter((s) => s.googleCalendarEventId && s.calendarSyncStatus === 'needs_update').length,
    [groupSessions]
  );

  const calendarPreview = useMemo(
    () =>
      buildGoogleCalendarSyncPreview(
        calendarTargetSession ? groupSessions.filter((s) => s.id === calendarTargetSession.id) : groupSessions
      ),
    [groupSessions, calendarTargetSession]
  );

  if (group.type !== 'online') {
    return null;
  }

  const handleCopyJoinUrl = async (session: GroupWeeklySession) => {
    const url = session.zoomJoinUrl || session.manualFallbackUrl;
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

  const handleCreateOrSyncZoom = async (session: GroupWeeklySession, forceConfirmManual = false) => {
    const hasManual =
      (session.meetingSource === 'manual' || session.meetingSource === 'legacy_migrated') &&
      Boolean(session.zoomJoinUrl || session.manualFallbackUrl);

    if (hasManual && !forceConfirmManual) {
      setConfirmReplaceSession(session);
      return;
    }

    setConfirmReplaceSession(null);
    setBusySessionId(session.id);
    try {
      const result =
        session.meetingSource === 'zoom_api' && session.zoomMeetingId
          ? await updateZoomMeetingForSession({
              session,
              sessions: groupWeeklySessions,
              records: zoomMeetingRecords,
              history: zoomMeetingHistory,
              timezone: zoomMeta.defaultTimezone
            })
          : await createOrReplaceZoomMeetingForSession({
              session,
              sessions: groupWeeklySessions,
              records: zoomMeetingRecords,
              history: zoomMeetingHistory,
              timezone: zoomMeta.defaultTimezone
            });

      applyZoomWorkspaceSnapshot({
        sessions: result.sessions,
        records: result.records,
        history: result.history
      });
      setZoomMeta(loadZoomUiMeta());

      if (result.ok) {
        triggerToast(
          _t(
            `تمت مزامنة اجتماع Zoom: ${session.standardizedTitle}`,
            `Zoom synced: ${session.standardizedTitle}`,
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
    applyZoomWorkspaceSnapshot({
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory
    });
    triggerToast(
      _t(
        `تم تحديث ${updatedCount} اجتماع Zoom بنجاح`,
        `Updated ${updatedCount} Zoom meeting(s)`,
        `${updatedCount} Zoom-Meeting(s) aktualisiert`
      )
    );
  };

  const handleHostStart = async (session: GroupWeeklySession) => {
    if (!session.zoomMeetingId) return;
    setBusySessionId(session.id);
    try {
      const res = await fetchHostStartUrlForSession(session.zoomMeetingId);
      if (res.ok && res.startUrl) {
        setHostLaunchMap((prev) => ({ ...prev, [session.id]: res.startUrl! }));
        // Trigger clean anchor navigation without using window.open
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

  const handleSaveManualUrl = (e: React.FormEvent) => {
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
    applyZoomWorkspaceSnapshot({
      sessions: res.sessions,
      records: res.records,
      history: res.history
    });
    setManualModalSession(null);
    setManualUrlInput('');
    setManualError(null);
    triggerToast(_t('تم حفظ رابط Zoom اليدوي وأرشفة السابق', 'Manual Zoom link saved & previous archived', 'Manueller Zoom-Link gespeichert'));
  };

  const handleConfirmGoogleCalendarSync = async (forceReauth = false) => {
    setIsSyncingCalendar(true);
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
        triggerToast(
          authRes.error ||
            (authRes.cancelled
              ? _t('تم إلغاء تفويض Google Calendar', 'Google Calendar authorization was cancelled.')
              : _t('فشل تفويض Google Calendar', 'Google Calendar authorization failed', 'Google Kalender-Autorisierung fehlgeschlagen'))
        );
        return;
      }
      const targetIds = calendarTargetSession
        ? new Set([calendarTargetSession.id])
        : new Set(groupSessions.map((s) => s.id));
      let syncRes = await syncSessionsToGoogleCalendar({
        allSessions: groupWeeklySessions,
        targetSessionIds: targetIds,
        accessToken: authRes.accessToken,
        forceUpdateSynced: Boolean(calendarTargetSession)
      });

      if (syncRes.authExpired && !forceReauth) {
        authRes = await requestGoogleCalendarAccessToken(true);
        if (authRes.ok && authRes.accessToken) {
          syncRes = await syncSessionsToGoogleCalendar({
            allSessions: syncRes.sessions,
            targetSessionIds: targetIds,
            accessToken: authRes.accessToken,
            forceUpdateSynced: Boolean(calendarTargetSession)
          });
        }
      }

      applyZoomWorkspaceSnapshot({ sessions: syncRes.sessions });
      setCalendarConfirmOpen(false);
      setCalendarTargetSession(null);
      if (syncRes.failedCount > 0) {
        triggerToast(
          _t(
            `مزامنة التقويم: ${syncRes.createdCount} جديد، ${syncRes.updatedCount} محدث، ${syncRes.failedCount} فشل`,
            `Calendar sync: ${syncRes.createdCount} created, ${syncRes.updatedCount} updated, ${syncRes.failedCount} failed`
          )
        );
      } else {
        triggerToast(
          _t(
            `مزامنة التقويم: ${syncRes.createdCount} جديد، ${syncRes.updatedCount} محدث`,
            `Calendar synced: ${syncRes.createdCount} created, ${syncRes.updatedCount} updated`,
            `Kalender synchronisiert: ${syncRes.createdCount} neu, ${syncRes.updatedCount} aktualisiert`
          )
        );
      }
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const renderSyncBadge = (session: GroupWeeklySession) => {
    switch (session.syncState) {
      case 'synced':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            {_t('متزامن مع Zoom', 'Zoom Synced', 'Synchronisiert')}
          </span>
        );
      case 'needs_update':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            {_t('يحتاج إعادة مزامنة', 'Resync Needed', 'Update nötig')}
          </span>
        );
      case 'manual':
      case 'manual_only':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            {_t('رابط يدوي', 'Manual Link', 'Manueller Link')}
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            {_t('خطأ مزامنة', 'Sync Error', 'Fehler')}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-text-muted border border-surface-border">
            {_t('في انتظار المزامنة', 'Pending Zoom Sync', 'Ausstehend')}
          </span>
        );
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-3 pt-3 border-t border-surface-border mt-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Video className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-text-main">
              {_t(
                `الحصص الأسبوعية الموحدة على Zoom (${groupSessions.length})`,
                `Standardized Weekly Zoom Sessions (${groupSessions.length})`,
                `Standardisierte Zoom-Sitzungen (${groupSessions.length})`
              )}
            </h4>
            <p className="text-[10.5px] text-text-muted">
              {_t(
                'كل موعد أسبوعي يمتلك اجتماع Zoom متكرر مستقل بدون أسماء الطلاب في العنوان العام',
                'Each weekly slot has its own recurring Zoom meeting; student names never appear publicly',
                'Jeder Wochentermin hat ein eigenes wiederkehrendes Zoom-Meeting'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {groupSessions.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => downloadSessionsIcsFile(groupSessions, `${group.name.replace(/\s+/g, '_')}_zoom.ics`)}
                className="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 border border-surface-border text-text-main flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>.ics</span>
              </button>
              <button
                type="button"
                onClick={() => setCalendarConfirmOpen(true)}
                className="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                <Calendar className="w-3 h-3" />
                <span>{_t('مزامنة التقويم', 'Sync Calendar', 'Kalender Sync')}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-surface-hover border border-surface-border text-text-muted hover:text-text-main flex items-center gap-1 cursor-pointer"
          >
            <History className="w-3 h-3" />
            <span>{_t(`السجل (${groupHistory.length})`, `History (${groupHistory.length})`, `Verlauf (${groupHistory.length})`)}</span>
          </button>
        </div>
      </div>

      {/* Resync Prompt Banner when Name/Time/Weekday Changed */}
      {(needsZoomResyncSessions.length > 0 || needsCalendarResyncCount > 0) && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-black block">
                {_t(
                  'تغير اسم المجموعة أو الموعد — الحصص التاريخية محفوظة كما هي',
                  'Group name or schedule updated — historical lessons remain untouched',
                  'Gruppenname oder Zeitplan geändert — historische Lektionen unverändert'
                )}
              </span>
              <span className="text-[11px] opacity-90">
                {_t(
                  'حدّث اجتماعات Zoom أو تقويم Google لتطابق الاسم والوقت الموحد الجديد.',
                  'Resync Zoom meetings or Google Calendar to apply the updated standardized topic & time.',
                  'Zoom oder Google Kalender aktualisieren, um den neuen Titel zu übernehmen.'
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {needsZoomResyncSessions.length > 0 && zoomMeta.connected && (
              <button
                type="button"
                onClick={handleBatchResyncGroupZoom}
                disabled={busySessionId !== null}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black cursor-pointer disabled:opacity-50"
              >
                {_t('تحديث Zoom الآن', 'Resync Zoom Now', 'Zoom aktualisieren')}
              </button>
            )}
            {needsCalendarResyncCount > 0 && (
              <button
                type="button"
                onClick={() => setCalendarConfirmOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer"
              >
                {_t('تحديث التقويم', 'Resync Calendar', 'Kalender aktualisieren')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sessions List */}
      {groupSessions.length === 0 ? (
        <div className="p-3 rounded-xl bg-surface-hover/50 border border-dashed border-surface-border text-xs text-text-muted flex items-center justify-between gap-2">
          <span>
            {_t(
              'لا توجد مواعيد أسبوعية محددة لهذه المجموعة بعد. أضف أيام وأوقات المجموعة أعلاه لتوليد الجلسات الموحدة تلقائياً.',
              'No weekly slots configured yet. Set the group days and times above to generate standardized Zoom sessions.',
              'Noch keine Wochentermine festgelegt.'
            )}
          </span>
          <button
            type="button"
            onClick={() => reconcileGroupSessionsState(group)}
            className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/25 text-[11px] font-bold shrink-0 cursor-pointer"
          >
            {_t('فحص المواعيد', 'Scan Slots', 'Termine scannen')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {groupSessions.map((session) => {
            const joinUrl = session.zoomJoinUrl || session.manualFallbackUrl;
            const isBusy = busySessionId === session.id;
            const showBasicWarning = (zoomMeta.isBasicPlan || session.planWarning40Min) && session.durationMinutes >= 41;
            const hostStartUrl = hostLaunchMap[session.id];

            return (
              <div
                key={session.id}
                className="p-2.5 sm:p-3 rounded-xl bg-surface-hover/40 border border-surface-border space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/5 dark:bg-slate-100/10 text-[10px] font-mono font-black text-text-main border border-surface-border tabular-nums">
                        {session.sessionCode}
                      </span>
                      <span className="text-xs font-black text-text-main" dir="ltr">
                        {session.standardizedTitle}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-text-muted">
                      <span className="flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {session.durationMinutes} {_t('دقيقة', 'min', 'Min')} • {session.timezone}
                      </span>
                      {session.zoomMeetingId && (
                        <span className="font-mono tabular-nums">
                          ID: {session.zoomMeetingId}
                        </span>
                      )}
                      {session.googleCalendarEventId && (
                        <span className={session.calendarSyncStatus === 'needs_update' ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                          • {session.calendarSyncStatus === 'needs_update' ? _t('التقويم يحتاج تحديث', 'Calendar needs update') : _t('مضاف للتقويم', 'In Google Calendar')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {renderSyncBadge(session)}
                    {showBasicWarning && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        {_t('حد Zoom Basic 40 دقيقة', 'Zoom Basic 40m cap')}
                      </span>
                    )}
                  </div>
                </div>

                {session.lastError && (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                    {session.lastError}
                  </div>
                )}

                {joinUrl && (
                  <div className="flex items-center justify-between gap-2 bg-surface px-2.5 py-1.5 rounded-lg border border-surface-border/80 text-[11px]">
                    <span className="font-mono text-primary truncate select-all" dir="ltr">
                      {joinUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyJoinUrl(session)}
                      className="px-2 py-0.5 rounded bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedSessionId === session.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{_t('نسخ', 'Copy', 'Kopieren')}</span>
                    </button>
                  </div>
                )}

                {/* Action Row */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {session.meetingSource === 'zoom_api' && session.zoomMeetingId && zoomMeta.connected && (
                    <button
                      type="button"
                      onClick={() => handleHostStart(session)}
                      disabled={isBusy}
                      className="px-2.5 py-1 rounded-lg bg-primary text-white hover:bg-primary-hover text-[11px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{_t('بدء كمضيف', 'Start as Host', 'Als Host starten')}</span>
                    </button>
                  )}

                  {hostStartUrl && (
                    <a
                      href={hostStartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{_t('فتح رابط المضيف الآن', 'Open Host Link', 'Host-Link öffnen')}</span>
                    </a>
                  )}

                  {zoomMeta.connected && (
                    <button
                      type="button"
                      onClick={() => handleCreateOrSyncZoom(session)}
                      disabled={isBusy}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[11px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isBusy ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : session.meetingSource === 'zoom_api' ? (
                        <RefreshCw className="w-3 h-3" />
                      ) : (
                        <PlusCircle className="w-3 h-3" />
                      )}
                      <span>
                        {session.meetingSource === 'zoom_api' && session.zoomMeetingId
                          ? _t('تحديث اجتماع Zoom', 'Sync / Update Zoom', 'Zoom aktualisieren')
                          : _t('إنشاء اجتماع موحد', 'Create Standardized Zoom', 'Zoom-Meeting erstellen')}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setCalendarTargetSession(session);
                      setCalendarConfirmOpen(true);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      session.googleCalendarEventId && session.calendarSyncStatus === 'synced'
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                        : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border'
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    <span>{_t('تقويم Google', 'Sync 1 Cal')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManualModalSession(session);
                      setManualUrlInput(session.zoomJoinUrl || session.manualFallbackUrl || '');
                      setManualError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-text-main border border-surface-border text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>{_t('رابط يدوي', 'Manual URL', 'Manueller Link')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History Drawer */}
      {showHistory && (
        <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-surface-border space-y-1.5">
          <div className="text-[11px] font-black text-text-main flex items-center justify-between">
            <span>{_t('سجل روابط Zoom المؤرشفة (لحماية مطابقة تسجيلات Grain)', 'Archived Zoom Link History (Preserves Grain Recording Matching)', 'Zoom-Link-Verlauf')}</span>
          </div>
          {groupHistory.length === 0 ? (
            <p className="text-[11px] text-text-muted">
              {_t('لا يوجد تغييرات روابط مسجلة بعد.', 'No historical meeting changes recorded yet.', 'Noch keine Änderungen aufgezeichnet.')}
            </p>
          ) : (
            <div className="divide-y divide-surface-border max-h-44 overflow-y-auto text-[10.5px]">
              {groupHistory.map((h) => (
                <div key={h.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-text-main uppercase mr-1.5">[{h.action}]</span>
                    <span className="text-text-muted">{h.reason || h.newTopic || h.previousTopic}</span>
                    <div className="font-mono text-[10px] text-text-muted mt-0.5">
                      {h.previousZoomMeetingId && <span>prev ID: {h.previousZoomMeetingId} </span>}
                      {h.newZoomMeetingId && <span>→ new ID: {h.newZoomMeetingId}</span>}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-text-muted shrink-0">
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
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-black text-text-main flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>{_t('استبدال الرابط اليدوي باجتماع Zoom موحد', 'Replace Manual Link with Standardized Meeting')}</span>
              </h5>
              <button type="button" onClick={() => setConfirmReplaceSession(null)} className="p-1 text-text-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {_t(
                `سيتم حفظ الرابط الحالي في سجل Zoom (لضمان استمرار ربط تسجيلات Grain السابقة) ثم إنشاء اجتماع متكرر موحد باسم: "${confirmReplaceSession.standardizedTitle}".`,
                `The existing link will be archived in ZoomMeetingHistory so historical Grain recordings stay matched, and a new recurring meeting "${confirmReplaceSession.standardizedTitle}" will be created.`
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmReplaceSession(null)}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-bold text-text-main cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={() => handleCreateOrSyncZoom(confirmReplaceSession, true)}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-black cursor-pointer"
              >
                {_t('تأكيد الإنشاء والأرشفة', 'Archive & Create Meeting', 'Archivieren & Erstellen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Zoom URL Override Modal */}
      {manualModalSession && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveManualUrl} className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-black text-text-main">
                {_t('إدخال رابط Zoom يدوي', 'Manual Zoom Link Override', 'Manueller Zoom-Link')}
              </h5>
              <button type="button" onClick={() => setManualModalSession(null)} className="p-1 text-text-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-text-muted" dir="ltr">
              {manualModalSession.standardizedTitle} ({manualModalSession.sessionCode})
            </p>
            <input
              type="url"
              required
              dir="ltr"
              value={manualUrlInput}
              onChange={(e) => setManualUrlInput(e.target.value)}
              placeholder="https://zoom.us/j/1234567890?pwd=..."
              className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
            />
            {manualError && <p className="text-xs text-rose-600 font-bold">{manualError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualModalSession(null)}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-bold text-text-main cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-black cursor-pointer"
              >
                {_t('حفظ الرابط', 'Save Link', 'Link speichern')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Explicit Confirmation Modal for Google Calendar Sync */}
      {calendarConfirmOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-lg w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-black text-text-main flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{_t('تأكيد المزامنة مع تقويم Google', 'Confirm Google Calendar Sync', 'Google Kalender Sync bestätigen')}</span>
              </h5>
              <button type="button" onClick={() => setCalendarConfirmOpen(false)} className="p-1 text-text-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-black text-emerald-600 block tabular-nums">{calendarPreview.createCount}</span>
                <span className="text-[10px] text-text-muted">{_t('أحداث جديدة', 'Create')}</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="font-black text-amber-600 block tabular-nums">{calendarPreview.updateCount}</span>
                <span className="text-[10px] text-text-muted">{_t('تحديث موجود', 'Update')}</span>
              </div>
              <div className="p-2 rounded-lg bg-surface-hover border border-surface-border">
                <span className="font-black text-text-main block tabular-nums">{calendarPreview.skipSyncedCount}</span>
                <span className="text-[10px] text-text-muted">{_t('متزامن مسبقاً', 'Already Synced')}</span>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto border border-surface-border rounded-lg divide-y divide-surface-border text-[11px]">
              {calendarPreview.items.map((item) => (
                <div key={item.sessionId} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                  <span className="font-bold text-text-main truncate" dir="ltr">{item.standardizedTitle}</span>
                  <span className="font-mono text-[10px] text-text-muted shrink-0 uppercase">{item.action}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCalendarConfirmOpen(false);
                  setCalendarTargetSession(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-bold text-text-main cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmGoogleCalendarSync(false)}
                disabled={isSyncingCalendar}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {isSyncingCalendar
                    ? _t('جاري المزامنة...', 'Syncing Calendar...')
                    : _t('موافقة ومزامنة التقويم', 'Approve & Sync Calendar')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
