import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Video,
  Key,
  ShieldCheck,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Download,
  ExternalLink,
  Copy,
  Check,
  Play,
  PauseCircle,
  Search,
  Link2,
  Clock,
  Globe,
  X,
  PlusCircle,
  ShieldOff
} from 'lucide-react';
import { GroupWeeklySession } from '../types';
import { useApp } from '../context/AppContext';
import { DEFAULT_ZOOM_TIMEZONE } from '../services/zoomSessionStandardizer';
import {
  ZoomUiMetaState,
  ZoomMigrationPreviewSummary,
  ZoomBulkMigrationProgress,
  ZoomBulkMigrationResult,
  loadZoomUiMeta,
  getZoomConnectionStatus,
  connectZoomAccount,
  testZoomConnection,
  updateZoomDefaultTimezone,
  disconnectZoomAccount,
  fetchHostStartUrlForSession,
  setManualZoomLinkForSession,
  createOrReplaceZoomMeetingForSession,
  updateZoomMeetingForSession,
  buildZoomMigrationPreview,
  executeBulkZoomMigration,
  disableWaitingRoomForExistingZoomMeetings
} from '../services/zoomService';
import {
  GoogleCalendarConnectionState,
  buildGoogleCalendarSyncPreview,
  disconnectGoogleCalendar,
  downloadSessionsIcsFile,
  getGoogleCalendarConnectionState,
  requestGoogleCalendarAccessToken,
  subscribeGoogleCalendarConnectionState,
  syncSessionsToGoogleCalendar,
  verifyOrSilentlyReauthorizeGoogleCalendar
} from '../services/calendarSyncService';
import { ZoomCleanupRebuildSection } from './ZoomCleanupRebuildSection';

const COMMON_TIMEZONES = [
  'Africa/Cairo',
  'Europe/Berlin',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Vienna',
  'America/New_York',
  'UTC'
];

export const ZoomIntegrationsManager: React.FC = () => {
  const {
    groups,
    profile,
    updateProfile,
    groupWeeklySessions,
    zoomMeetingRecords,
    zoomMeetingHistory,
    applyZoomWorkspaceSnapshot,
    language,
    _t,
    triggerToast
  } = useApp();

  const isRtl = language === 'ar';

  const [meta, setMeta] = useState<ZoomUiMetaState>(() => loadZoomUiMeta());
  const [accountIdInput, setAccountIdInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [timezoneInput, setTimezoneInput] = useState(
    () => profile.defaultZoomTimezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE
  );

  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);

  // Bulk migration preview & execution state
  const [previewMode, setPreviewMode] = useState<'standardize_all' | 'create_missing_only' | null>(null);
  const [previewData, setPreviewData] = useState<ZoomMigrationPreviewSummary | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<ZoomBulkMigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<ZoomBulkMigrationResult | null>(null);
  const [resumeSkipIds, setResumeSkipIds] = useState<string[]>([]);
  const abortMigrationRef = useRef(false);
  const [isDisablingWaitingRoom, setIsDisablingWaitingRoom] = useState(false);
  const [waitingRoomProgress, setWaitingRoomProgress] = useState<{ completed: number; total: number } | null>(null);

  // Calendar sync confirmation modal state (null = all sessions, or 1 specific session for safe test/verify)
  const [calendarConfirmOpen, setCalendarConfirmOpen] = useState(false);
  const [calendarTargetSession, setCalendarTargetSession] = useState<GroupWeeklySession | null>(null);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [calendarConn, setCalendarConn] = useState<GoogleCalendarConnectionState>(() =>
    getGoogleCalendarConnectionState()
  );

  useEffect(() => {
    const unsub = subscribeGoogleCalendarConnectionState((next) => {
      setCalendarConn(next);
    });
    // On reopen/mount, never treat persisted metadata as an active token; silently verify or require reconnect
    if (getGoogleCalendarConnectionState().status === 'needs_verification') {
      verifyOrSilentlyReauthorizeGoogleCalendar().catch(() => {});
    }
    return unsub;
  }, []);

  // Directory filters & per-row modals
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_update' | 'pending' | 'synced' | 'manual' | 'error'>('all');
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [hostLaunchMap, setHostLaunchMap] = useState<Record<string, string>>({});
  const [manualModalSession, setManualModalSession] = useState<GroupWeeklySession | null>(null);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [manualUrlError, setManualUrlError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getZoomConnectionStatus().then((fresh) => {
      if (mounted) {
        setMeta(fresh);
        if (fresh.defaultTimezone && !profile.defaultZoomTimezone) {
          setTimezoneInput(fresh.defaultTimezone);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [profile.defaultZoomTimezone]);

  const activeOnlineGroups = useMemo(
    () => (groups || []).filter((g) => g && !g.deleted && g.type === 'online' && g.status !== 'archived'),
    [groups]
  );

  // Live preview of reconciled sessions including any online groups not yet materialized
  const livePreviewSummary = useMemo(
    () =>
      buildZoomMigrationPreview({
        groups,
        existingSessions: groupWeeklySessions,
        targetTimezone: timezoneInput || DEFAULT_ZOOM_TIMEZONE
      }),
    [groups, groupWeeklySessions, timezoneInput]
  );

  const displayedSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (groupWeeklySessions || [])
      .filter((s) => s && !s.deleted)
      .filter((s) => (statusFilter === 'all' ? true : s.syncState === statusFilter))
      .filter((s) => {
        if (!q) return true;
        return (
          s.standardizedTitle.toLowerCase().includes(q) ||
          s.sessionCode.toLowerCase().includes(q) ||
          s.groupNameSnapshot.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime) || a.groupNameSnapshot.localeCompare(b.groupNameSnapshot));
  }, [groupWeeklySessions, statusFilter, searchQuery]);

  const calendarTargetSessionsList = useMemo(
    () =>
      calendarTargetSession
        ? livePreviewSummary.reconciledSessions.filter((s) => s.id === calendarTargetSession.id)
        : livePreviewSummary.reconciledSessions,
    [livePreviewSummary.reconciledSessions, calendarTargetSession]
  );

  const calendarPreview = useMemo(
    () => buildGoogleCalendarSyncPreview(calendarTargetSessionsList),
    [calendarTargetSessionsList]
  );

  const basicPlanAffectedSessions = useMemo(
    () => livePreviewSummary.reconciledSessions.filter((s) => !s.deleted && s.durationMinutes >= 41),
    [livePreviewSummary.reconciledSessions]
  );

  const apiManagedSessionsCount = useMemo(
    () => (groupWeeklySessions || []).filter((s) => s && !s.deleted && s.meetingSource === 'zoom_api' && Boolean(s.zoomMeetingId)).length,
    [groupWeeklySessions]
  );

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountIdInput.trim() || !clientIdInput.trim() || !clientSecretInput.trim()) return;
    setIsSavingCreds(true);
    try {
      const res = await connectZoomAccount({
        accountId: accountIdInput.trim(),
        clientId: clientIdInput.trim(),
        clientSecret: clientSecretInput.trim(),
        defaultTimezone: timezoneInput.trim() || DEFAULT_ZOOM_TIMEZONE
      });
      setMeta(res.state);
      // Clear secret fields immediately after server vault saves them
      setClientSecretInput('');
      if (res.ok) {
        setAccountIdInput('');
        setClientIdInput('');
        updateProfile({ defaultZoomTimezone: timezoneInput.trim() || DEFAULT_ZOOM_TIMEZONE });
        triggerToast(
          _t(
            'تم حفظ مفاتيح Zoom في الخزنة المشفرة والاتصال بنجاح',
            'Zoom credentials encrypted in server vault & connected',
            'Zoom-Zugangsdaten sicher gespeichert & verbunden'
          )
        );
      } else {
        triggerToast(res.error || _t('فشل الاتصال بحساب Zoom', 'Zoom connection failed', 'Zoom-Verbindung fehlgeschlagen'));
      }
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await testZoomConnection();
      setMeta(res.state);
      triggerToast(
        res.ok
          ? _t('اتصال Zoom سليم وجاهز للمزامنة', 'Zoom connection verified', 'Zoom-Verbindung bestätigt')
          : res.error || _t('فشل اختبار اتصال Zoom', 'Zoom connection test failed', 'Zoom-Verbindungstest fehlgeschlagen')
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveTimezone = async () => {
    const cleanTz = timezoneInput.trim() || DEFAULT_ZOOM_TIMEZONE;
    setIsSavingTimezone(true);
    try {
      const res = await updateZoomDefaultTimezone(cleanTz);
      setMeta(res.state);
      updateProfile({ defaultZoomTimezone: cleanTz });
      triggerToast(_t(`تم حفظ المنطقة الزمنية الافتراضية: ${cleanTz}`, `Default timezone saved: ${cleanTz}`, `Zeitzone gespeichert: ${cleanTz}`));
    } finally {
      setIsSavingTimezone(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const nextState = await disconnectZoomAccount();
      setMeta(nextState);
      setAccountIdInput('');
      setClientIdInput('');
      setClientSecretInput('');
      triggerToast(_t('تم فصل حساب Zoom ومسح مفاتيح الخزنة بأمان', 'Zoom account disconnected & vault cleared', 'Zoom-Konto getrennt'));
    } finally {
      setIsDisconnecting(false);
    }
  };

  const openMigrationPreview = (mode: 'standardize_all' | 'create_missing_only') => {
    const summary = buildZoomMigrationPreview({
      groups,
      existingSessions: groupWeeklySessions,
      targetTimezone: timezoneInput || DEFAULT_ZOOM_TIMEZONE
    });
    // Persist reconciled slots right away without mutating any Zoom link or lesson
    applyZoomWorkspaceSnapshot({
      sessions: summary.reconciledSessions,
      history:
        summary.reconciledHistory.length > 0
          ? [...summary.reconciledHistory, ...zoomMeetingHistory]
          : undefined
    });
    setPreviewData(summary);
    setPreviewMode(mode);
    setMigrationResult(null);
    setResumeSkipIds([]);
  };

  const runMigration = async (isResume = false) => {
    if (!previewMode) return;
    const currentPreview = buildZoomMigrationPreview({
      groups,
      existingSessions: groupWeeklySessions,
      targetTimezone: timezoneInput || DEFAULT_ZOOM_TIMEZONE
    });
    setPreviewData(currentPreview);
    abortMigrationRef.current = false;
    setIsMigrating(true);
    setMigrationResult(null);

    const skipSet = isResume ? new Set(resumeSkipIds) : new Set<string>();
    const workingProcessed = isResume ? [...resumeSkipIds] : [];

    try {
      const result = await executeBulkZoomMigration({
        mode: previewMode,
        preview: currentPreview,
        existingRecords: zoomMeetingRecords,
        existingHistory: zoomMeetingHistory,
        timezone: timezoneInput || DEFAULT_ZOOM_TIMEZONE,
        skipSessionIds: skipSet,
        shouldAbort: () => abortMigrationRef.current,
        onProgress: (prog) => setMigrationProgress(prog),
        onCheckpoint: (ckpt) => {
          setResumeSkipIds([...workingProcessed, ...ckpt.processedSessionIds]);
          applyZoomWorkspaceSnapshot({
            sessions: ckpt.sessions,
            records: ckpt.records,
            history: ckpt.history
          });
        }
      });

      applyZoomWorkspaceSnapshot({
        sessions: result.sessions,
        records: result.records,
        history: result.history
      });
      setMeta(loadZoomUiMeta());
      setMigrationResult(result);
      setResumeSkipIds([...workingProcessed, ...result.processedSessionIds]);

      if (result.completed) {
        triggerToast(
          _t(
            `اكتمل توحيد Zoom: ${result.succeededCount} نجاح${result.archivedPreviousCount > 0 ? ` (${result.archivedPreviousCount} رابط مؤرشف)` : ''}`,
            `Zoom migration finished: ${result.succeededCount} succeeded`,
            `Zoom-Migration abgeschlossen: ${result.succeededCount} erfolgreich`
          )
        );
      } else if (result.rateLimited) {
        triggerToast(
          _t(
            'تم التوقف مؤقتاً بسبب حد معدل طلبات Zoom API — يمكنك الاستكمال بأمان',
            'Paused due to Zoom API rate limit — resume safely anytime',
            'Pausiert wegen Zoom-API-Limit — jederzeit fortsetzen'
          )
        );
      }
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDisableWaitingRoomAll = async () => {
    if (isDisablingWaitingRoom || apiManagedSessionsCount === 0) return;
    setIsDisablingWaitingRoom(true);
    setWaitingRoomProgress({ completed: 0, total: apiManagedSessionsCount });
    try {
      const res = await disableWaitingRoomForExistingZoomMeetings({
        sessions: groupWeeklySessions,
        records: zoomMeetingRecords,
        history: zoomMeetingHistory,
        timezone: timezoneInput || DEFAULT_ZOOM_TIMEZONE,
        onProgress: (prog) => setWaitingRoomProgress({ completed: prog.completed, total: prog.total })
      });

      applyZoomWorkspaceSnapshot({
        sessions: res.sessions,
        records: res.records,
        history: res.history
      });

      if (res.failedCount === 0) {
        triggerToast(
          _t(
            `تم إلغاء غرفة الانتظار (Waiting Room) في ${res.updatedCount} اجتماع بدون تغيير الروابط`,
            `Disabled Waiting Room on ${res.updatedCount} Zoom meeting(s) without changing links`
          )
        );
      } else {
        triggerToast(
          _t(
            `تم تحديث ${res.updatedCount} اجتماع وفشل ${res.failedCount}${res.rateLimited ? ' (حد Zoom API)' : ''}`,
            `Updated ${res.updatedCount} meeting(s), ${res.failedCount} failed${res.rateLimited ? ' (Zoom rate limit)' : ''}`
          )
        );
      }
    } finally {
      setIsDisablingWaitingRoom(false);
      setWaitingRoomProgress(null);
    }
  };

  const handleConnectGoogleCalendar = async (forcePrompt = false) => {
    setIsConnectingCalendar(true);
    try {
      const authRes = await requestGoogleCalendarAccessToken(forcePrompt);
      if (authRes.ok) {
        triggerToast(
          authRes.accountEmail
            ? _t(
                `تم ربط Google Calendar بنجاح (${authRes.accountEmail})`,
                `Google Calendar connected (${authRes.accountEmail})`,
                `Google Kalender verbunden (${authRes.accountEmail})`
              )
            : _t('تم ربط Google Calendar بنجاح', 'Google Calendar connected', 'Google Kalender verbunden')
        );
      } else if (authRes.redirected) {
        triggerToast(
          _t(
            'جاري التحويل إلى Google لإتمام ربط التقويم...',
            'Redirecting to Google to complete Calendar authorization...'
          )
        );
      } else if (authRes.cancelled) {
        triggerToast(
          _t(
            'تم إلغاء تفويض Google Calendar',
            'Google Calendar authorization was cancelled.',
            'Google Kalender-Autorisierung abgebrochen.'
          )
        );
      } else {
        triggerToast(
          authRes.error ||
            _t('فشل ربط Google Calendar', 'Google Calendar authorization failed')
        );
      }
    } finally {
      setIsConnectingCalendar(false);
    }
  };

  const handleDisconnectGoogleCalendar = async () => {
    await disconnectGoogleCalendar();
    triggerToast(
      _t('تم فصل جلسة Google Calendar', 'Google Calendar session disconnected')
    );
  };

  const handleConfirmGoogleCalendarSync = async (forceReauth = false) => {
    setIsSyncingCalendar(true);
    try {
      const sessionsToUse = livePreviewSummary.reconciledSessions;
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
              : _t('فشل تفويض Google Calendar', 'Google Calendar authorization failed'))
        );
        return;
      }

      const targetIds = calendarTargetSession ? new Set([calendarTargetSession.id]) : undefined;
      let syncRes = await syncSessionsToGoogleCalendar({
        allSessions: sessionsToUse,
        targetSessionIds: targetIds,
        accessToken: authRes.accessToken,
        forceUpdateSynced: Boolean(calendarTargetSession)
      });

      // If token expired mid-sync (401), re-prompt OAuth once and retry remaining sessions without duplicating succeeded ones
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

      applyZoomWorkspaceSnapshot({
        sessions: syncRes.sessions,
        history:
          livePreviewSummary.reconciledHistory.length > 0
            ? [...livePreviewSummary.reconciledHistory, ...zoomMeetingHistory]
            : undefined
      });
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
            `مزامنة Google Calendar: ${syncRes.createdCount} حدث جديد، ${syncRes.updatedCount} محدث`,
            `Google Calendar synced: ${syncRes.createdCount} created, ${syncRes.updatedCount} updated`,
            `Google Kalender synchronisiert: ${syncRes.createdCount} neu, ${syncRes.updatedCount} aktualisiert`
          )
        );
      }
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleRowSync = async (session: GroupWeeklySession) => {
    setBusySessionId(session.id);
    try {
      const res =
        session.meetingSource === 'zoom_api' && session.zoomMeetingId
          ? await updateZoomMeetingForSession({
              session,
              sessions: groupWeeklySessions,
              records: zoomMeetingRecords,
              history: zoomMeetingHistory,
              timezone: timezoneInput || DEFAULT_ZOOM_TIMEZONE
            })
          : await createOrReplaceZoomMeetingForSession({
              session,
              sessions: groupWeeklySessions,
              records: zoomMeetingRecords,
              history: zoomMeetingHistory,
              timezone: timezoneInput || DEFAULT_ZOOM_TIMEZONE
            });

      applyZoomWorkspaceSnapshot({
        sessions: res.sessions,
        records: res.records,
        history: res.history
      });
      setMeta(loadZoomUiMeta());
      triggerToast(
        res.ok
          ? _t(`تمت المزامنة: ${session.standardizedTitle}`, `Synced: ${session.standardizedTitle}`)
          : res.error || _t('فشل المزامنة', 'Sync failed')
      );
    } finally {
      setBusySessionId(null);
    }
  };

  const handleRowHostStart = async (session: GroupWeeklySession) => {
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
        triggerToast(res.error || _t('تعذر فتح رابط المضيف', 'Could not fetch host start URL'));
      }
    } finally {
      setBusySessionId(null);
    }
  };

  const handleCopyUrl = async (session: GroupWeeklySession) => {
    const url = session.zoomJoinUrl || session.manualFallbackUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSessionId(session.id);
      setTimeout(() => setCopiedSessionId((prev) => (prev === session.id ? null : prev)), 2000);
      triggerToast(_t('تم نسخ الرابط', 'Join link copied'));
    } catch {
      triggerToast(url);
    }
  };

  const handleSaveManualOverride = (e: React.FormEvent) => {
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
      setManualUrlError(res.error || 'Invalid Zoom URL');
      return;
    }
    applyZoomWorkspaceSnapshot({
      sessions: res.sessions,
      records: res.records,
      history: res.history
    });
    setManualModalSession(null);
    setManualUrlInput('');
    setManualUrlError(null);
    triggerToast(_t('تم تحديث الرابط اليدوي وأرشفة الرابط السابق', 'Manual link saved & previous archived'));
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-4">
      {/* 1. Connection & Server-Side Encrypted Vault Card */}
      <div className="bg-surface border border-surface-border rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-text-main">
                  {_t('مدير اجتماعات Zoom الموحد (Server-to-Server OAuth)', 'Zoom Manager (Server-to-Server OAuth)', 'Zoom-Manager (Server-to-Server OAuth)')}
                </h3>
                {meta.connected ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{_t('متصل', 'Connected', 'Verbunden')}</span>
                  </span>
                ) : meta.hasCredentials ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/15 text-amber-600 border border-amber-500/30">
                    {_t('محفوظ في الخزنة', 'Saved in Vault', 'Im Tresor')}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-text-muted border border-surface-border">
                    {_t('غير متصل', 'Not Connected', 'Nicht verbunden')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                {_t(
                  'تسمية موحدة "{Weekday} - {HH:mm} - {GroupName}" وتخزين مشفر لأسرار OAuth على الخادم فقط',
                  'Standardized "{Weekday} - {HH:mm} - {GroupName}" meetings with AES-256-GCM server-side OAuth storage',
                  'Einheitliche Zoom-Meetings mit sicherer Serverseite-OAuth-Speicherung'
                )}
              </p>
            </div>
          </div>

          {meta.connected && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <span
                className={`px-2 py-0.5 rounded-md border ${
                  meta.isBasicPlan
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                }`}
              >
                {meta.isBasicPlan
                  ? _t('خطة Zoom Basic (حد 40 دقيقة)', 'Zoom Basic Plan (40-min cap)')
                  : meta.planType === 'licensed'
                  ? _t('خطة Zoom Licensed / Pro', 'Zoom Licensed / Pro')
                  : _t('خطة Zoom', 'Zoom Plan')}
              </span>
            </div>
          )}
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSaveCredentials} className="space-y-2.5 pt-2 border-t border-surface-border/70">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                Account ID {meta.maskedAccountId ? `(${meta.maskedAccountId})` : ''}
              </label>
              <input
                type="text"
                dir="ltr"
                autoComplete="off"
                value={accountIdInput}
                onChange={(e) => setAccountIdInput(e.target.value)}
                placeholder={meta.hasCredentials ? _t('محفوظ — أدخل للاستبدال', 'Saved — enter to replace') : 'Zoom Account ID'}
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                Client ID {meta.maskedClientId ? `(${meta.maskedClientId})` : ''}
              </label>
              <input
                type="text"
                dir="ltr"
                autoComplete="off"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder={meta.hasCredentials ? _t('محفوظ — أدخل للاستبدال', 'Saved — enter to replace') : 'Zoom Client ID'}
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                Client Secret
              </label>
              <input
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={clientSecretInput}
                onChange={(e) => setClientSecretInput(e.target.value)}
                placeholder={meta.hasCredentials ? '••••••••••••' : 'Zoom Client Secret'}
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSavingCreds || !accountIdInput.trim() || !clientIdInput.trim() || !clientSecretInput.trim()}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Key className="w-3.5 h-3.5" />
              <span>
                {isSavingCreds
                  ? _t('جاري التشفير والاتصال...', 'Encrypting & Connecting...')
                  : _t('حفظ وربط حساب Zoom', 'Save & Connect Zoom')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={!meta.hasCredentials || isTesting}
              className="px-2.5 py-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 border border-surface-border text-xs font-bold text-text-main flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>{isTesting ? _t('جاري الاختبار...', 'Testing...') : _t('اختبار الاتصال', 'Test Connection')}</span>
            </button>

            {meta.hasCredentials && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ms-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{_t('فصل الحساب', 'Disconnect')}</span>
              </button>
            )}
          </div>
        </form>

        {/* Timezone + Host Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-surface-border/70 text-[11px]">
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2 bg-surface-hover/50 p-2 rounded-lg border border-surface-border">
            <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-bold text-text-main">
              {_t('المنطقة الزمنية للاجتماعات والتقويم:', 'Default Zoom & Calendar Timezone:')}
            </span>
            <select
              value={COMMON_TIMEZONES.includes(timezoneInput) ? timezoneInput : '__custom__'}
              onChange={(e) => {
                if (e.target.value !== '__custom__') setTimezoneInput(e.target.value);
              }}
              dir="ltr"
              className="px-2 py-1 rounded bg-surface border border-surface-border text-xs font-mono text-text-main"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
              {!COMMON_TIMEZONES.includes(timezoneInput) && <option value="__custom__">{timezoneInput}</option>}
            </select>
            <input
              type="text"
              dir="ltr"
              value={timezoneInput}
              onChange={(e) => setTimezoneInput(e.target.value)}
              className="w-36 px-2 py-1 rounded bg-surface border border-surface-border text-xs font-mono text-text-main"
            />
            <button
              type="button"
              onClick={handleSaveTimezone}
              disabled={isSavingTimezone}
              className="px-2.5 py-1 rounded bg-primary text-white text-[11px] font-black cursor-pointer disabled:opacity-50"
            >
              {_t('حفظ المنطقة', 'Save TZ')}
            </button>
          </div>

          <div className="bg-surface-hover/50 p-2 rounded-lg border border-surface-border flex flex-col justify-center">
            <span className="text-text-muted font-bold block">{_t('المضيف المتصل:', 'Connected Host:')}</span>
            <span className="font-mono font-black text-text-main truncate" dir="ltr">
              {meta.hostEmail || _t('غير متصل بعد', 'Not connected')}
            </span>
          </div>
        </div>

        {/* Honest Zoom Basic 40-min Plan Advisory */}
        {meta.isBasicPlan && basicPlanAffectedSessions.length > 0 && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-black block">
                {_t(
                  `تنبيه خطة Zoom Basic: يوجد ${basicPlanAffectedSessions.length} جلسة مدتها أكثر من 40 دقيقة`,
                  `Zoom Basic 40-Minute Cap: ${basicPlanAffectedSessions.length} weekly session(s) exceed 40 minutes`
                )}
              </span>
              <span className="text-[11px] opacity-90">
                {_t(
                  'حساب Zoom المجاني يحدد مدة اجتماعات المجموعات بـ 40 دقيقة. لن يتم تقصير مدة الحصة في جدول Glück، وسيتم تنبيهك هنا بوضوح حتى الترقية أو استخدام تقسيم Part 1 + Part 2 في Grain.',
                  'Zoom Basic caps group meetings at 40 minutes. Glück preserves your actual lesson durations and supports Part 1 + Part 2 Grain pairing.'
                )}
              </span>
            </div>
          </div>
        )}

        {meta.lastError && (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{meta.lastError}</span>
          </div>
        )}
      </div>

      {/* 2. Bulk Migration & Calendar Sync Actions */}
      <div className="bg-surface border border-surface-border rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs sm:text-sm font-black text-text-main">
              {_t('التوحيد الجماعي للاجتماعات ومزامنة التقويم', 'Bulk Zoom Standardization & Calendar Sync', 'Massen-Standardisierung & Kalender')}
            </h4>
            <p className="text-[11px] text-text-muted">
              {_t(
                `${activeOnlineGroups.length} مجموعة أونلاين نشطة • ${livePreviewSummary.items.length} جلسة أسبوعية • ${livePreviewSummary.counts.alreadyStandardized} موحدة بالفعل`,
                `${activeOnlineGroups.length} active online groups • ${livePreviewSummary.items.length} weekly sessions • ${livePreviewSummary.counts.alreadyStandardized} already standardized`
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openMigrationPreview('standardize_all')}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{_t('توحيد جميع اجتماعات الأونلاين', 'Standardize All Online Group Meetings')}</span>
            </button>

            <button
              type="button"
              onClick={() => openMigrationPreview('create_missing_only')}
              className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{_t('إنشاء للجلسات الناقصة فقط', 'Create Zoom Meetings for Missing Sessions')}</span>
            </button>

            {apiManagedSessionsCount > 0 && (
              <button
                type="button"
                onClick={handleDisableWaitingRoomAll}
                disabled={isDisablingWaitingRoom || isMigrating || !meta.hasCredentials}
                className="px-2.5 py-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 border border-surface-border text-text-main text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ShieldOff className="w-3.5 h-3.5 text-primary" />
                <span>
                  {isDisablingWaitingRoom && waitingRoomProgress
                    ? _t(
                        `جاري التحديث (${waitingRoomProgress.completed}/${waitingRoomProgress.total})...`,
                        `Updating (${waitingRoomProgress.completed}/${waitingRoomProgress.total})...`
                      )
                    : _t('إلغاء غرفة الانتظار للاجتماعات الحالية', 'Disable Waiting Room on All Meetings')}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => downloadSessionsIcsFile(livePreviewSummary.reconciledSessions)}
              className="px-2.5 py-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 border border-surface-border text-text-main text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{_t('تصدير .ics شامل', 'Export All .ics')}</span>
            </button>

            <button
              type="button"
              onClick={() => setCalendarConfirmOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{_t('مزامنة Google Calendar', 'Sync Google Calendar')}</span>
            </button>
          </div>
        </div>

        {/* Google Calendar Live Sync Connection Status */}
        <div className="p-2.5 rounded-lg bg-surface-hover/50 border border-surface-border flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-start gap-2 min-w-0">
            <Calendar
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                calendarConn.status === 'connected' && calendarConn.hasInMemoryToken && calendarConn.readVerified
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : calendarConn.status === 'error' ||
                    calendarConn.status === 'expired' ||
                    calendarConn.status === 'reconnect_required'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-text-muted'
              }`}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-black text-text-main">
                  {_t('اتصال Google Calendar المباشر', 'Google Calendar Live Sync')}
                </span>
                {calendarConn.status === 'connected' && calendarConn.hasInMemoryToken && calendarConn.readVerified ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                    {calendarConn.writeVerified
                      ? _t('متصل ومُتحقق للكتابة (calendar.events)', 'Connected & Write Verified')
                      : calendarConn.scopeVerified
                      ? _t('متصل ومُتحقق (calendar.events)', 'Connected (Scope & Read Verified)')
                      : _t('متصل (قراءة مُتحققة)', 'Connected (Read Verified)')}
                  </span>
                ) : calendarConn.status === 'needs_verification' ? (
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-[10px] font-black">
                    {_t('جاري التحقق من الجلسة...', 'Verifying Authorization...')}
                  </span>
                ) : calendarConn.status === 'reconnect_required' ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black">
                    {_t('مطلوب إعادة الربط', 'Reconnect Required')}
                  </span>
                ) : calendarConn.status === 'expired' ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black">
                    {_t('انتهت الصلاحية — أعد الربط', 'Session Expired')}
                  </span>
                ) : calendarConn.status === 'cancelled' ? (
                  <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-text-muted border border-surface-border text-[10px] font-bold">
                    {_t('تم الإلغاء', 'Cancelled')}
                  </span>
                ) : calendarConn.status === 'error' ? (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-black">
                    {_t('خطأ تفويض', 'Auth Error')}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-text-muted border border-surface-border text-[10px] font-bold">
                    {_t('غير متصل', 'Not Connected')}
                  </span>
                )}
              </div>
              {calendarConn.accountEmail && (
                <div className="text-[11px] text-text-muted truncate" dir="ltr">
                  {calendarConn.accountEmail}
                  {calendarConn.calendarTimeZone ? ` • ${calendarConn.calendarTimeZone}` : ''}
                </div>
              )}
              {calendarConn.lastMessage &&
                (calendarConn.status === 'error' ||
                  calendarConn.status === 'expired' ||
                  calendarConn.status === 'reconnect_required' ||
                  calendarConn.status === 'cancelled' ||
                  calendarConn.status === 'pending_redirect') && (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                    {calendarConn.lastMessage}
                  </div>
                )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isConnectingCalendar || isSyncingCalendar}
              onClick={() =>
                handleConnectGoogleCalendar(
                  calendarConn.status === 'connected' ||
                    calendarConn.status === 'expired' ||
                    calendarConn.status === 'reconnect_required' ||
                    calendarConn.status === 'error'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-surface border border-surface-border hover:border-primary/40 text-text-main text-[11px] font-bold cursor-pointer disabled:opacity-50"
            >
              {isConnectingCalendar
                ? _t('جاري التفويض...', 'Authorizing...')
                : calendarConn.status === 'connected' && calendarConn.hasInMemoryToken
                ? _t('إعادة التحقق / تبديل الحساب', 'Verify / Switch Account')
                : calendarConn.status === 'reconnect_required' ||
                  calendarConn.status === 'expired' ||
                  calendarConn.status === 'error'
                ? _t('إعادة ربط Google Calendar', 'Reconnect Google Calendar')
                : _t('ربط Google Calendar', 'Connect Google Calendar')}
            </button>
            {(calendarConn.status === 'connected' ||
              calendarConn.status === 'needs_verification' ||
              calendarConn.status === 'reconnect_required' ||
              calendarConn.status === 'error') && (
              <button
                type="button"
                onClick={handleDisconnectGoogleCalendar}
                className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-500/10 text-[11px] font-bold cursor-pointer"
              >
                {_t('فصل', 'Disconnect')}
              </button>
            )}
          </div>
        </div>

        {/* Quick Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg bg-surface-hover/60 border border-surface-border">
            <span className="font-black text-text-main block tabular-nums">{livePreviewSummary.counts.createNew}</span>
            <span className="text-[10px] text-text-muted">{_t('جديد', 'Create New')}</span>
          </div>
          <div className="p-2 rounded-lg bg-surface-hover/60 border border-surface-border">
            <span className="font-black text-sky-600 block tabular-nums">{livePreviewSummary.counts.replaceManual}</span>
            <span className="text-[10px] text-text-muted">{_t('استبدال يدوي (مع أرشفة)', 'Replace Manual')}</span>
          </div>
          <div className="p-2 rounded-lg bg-surface-hover/60 border border-surface-border">
            <span className="font-black text-amber-600 block tabular-nums">{livePreviewSummary.counts.updateStandardized}</span>
            <span className="text-[10px] text-text-muted">{_t('يحتاج تحديث', 'Needs Update')}</span>
          </div>
          <div className="p-2 rounded-lg bg-surface-hover/60 border border-surface-border">
            <span className="font-black text-emerald-600 block tabular-nums">{livePreviewSummary.counts.alreadyStandardized}</span>
            <span className="text-[10px] text-text-muted">{_t('موحد ومتزامن', 'Standardized')}</span>
          </div>
          <div className="p-2 rounded-lg bg-surface-hover/60 border border-surface-border">
            <span className="font-black text-rose-600 block tabular-nums">{livePreviewSummary.groupsMissingSchedule.length}</span>
            <span className="text-[10px] text-text-muted">{_t('بدون جدول أسبوعي', 'Missing Schedule')}</span>
          </div>
        </div>
      </div>

      {/* 2.5 Clean & Rebuild Glück Meetings */}
      <ZoomCleanupRebuildSection
        timezone={timezoneInput || DEFAULT_ZOOM_TIMEZONE}
        zoomConnected={meta.connected}
        calendarConn={calendarConn}
        onConnectCalendar={handleConnectGoogleCalendar}
      />

      {/* 3. High-Density Weekly Sessions Directory */}
      <div className="bg-surface border border-surface-border rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs sm:text-sm font-black text-text-main">
            {_t(`دليل الجلسات الأسبوعية الموحدة (${displayedSessions.length})`, `Standardized Sessions Directory (${displayedSessions.length})`)}
          </h4>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={_t('بحث باسم المجموعة أو الكود...', 'Search group or session code...')}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs text-text-main focus:outline-none focus:border-primary"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-text-main"
            >
              <option value="all">{_t('الكل', 'All States')}</option>
              <option value="needs_update">{_t('يحتاج إعادة مزامنة', 'Resync Needed')}</option>
              <option value="pending">{_t('بانتظار المزامنة', 'Pending')}</option>
              <option value="synced">{_t('متزامن مع Zoom', 'Synced')}</option>
              <option value="manual">{_t('رابط يدوي', 'Manual')}</option>
              <option value="error">{_t('أخطاء', 'Errors')}</option>
            </select>
          </div>
        </div>

        {displayedSessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-text-muted border border-dashed border-surface-border rounded-xl">
            {_t(
              'لا توجد جلسات أونلاين مطابقة. اضغط "توحيد جميع اجتماعات الأونلاين" أعلاه لفحص ومطابقة المجموعات.',
              'No matching weekly sessions found. Click either bulk preview button above to scan active online groups.'
            )}
          </div>
        ) : (
          <div className="divide-y divide-surface-border border border-surface-border rounded-xl overflow-hidden">
            {displayedSessions.map((session) => {
              const joinUrl = session.zoomJoinUrl || session.manualFallbackUrl;
              const isBusy = busySessionId === session.id;
              const hostStartUrl = hostLaunchMap[session.id];

              return (
                <div key={session.id} className="p-2.5 sm:p-3 bg-surface hover:bg-surface-hover/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/5 dark:bg-slate-100/10 text-[10px] font-mono font-black border border-surface-border tabular-nums">
                        {session.sessionCode}
                      </span>
                      <span className="text-xs font-black text-text-main" dir="ltr">
                        {session.standardizedTitle}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          session.syncState === 'synced'
                            ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                            : session.syncState === 'needs_update'
                            ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                            : session.syncState === 'manual' || session.syncState === 'manual_only'
                            ? 'bg-sky-500/15 text-sky-600 border-sky-500/30'
                            : session.syncState === 'error'
                            ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                            : 'bg-slate-500/10 text-text-muted border-surface-border'
                        }`}
                      >
                        {session.syncState}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-text-muted">
                      <span className="flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {session.durationMinutes}m • {session.timezone}
                      </span>
                      {session.zoomMeetingId && (
                        <span className="font-mono tabular-nums">Zoom ID: {session.zoomMeetingId}</span>
                      )}
                      {joinUrl && (
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(session)}
                          className="text-primary hover:underline font-mono flex items-center gap-1 cursor-pointer"
                          dir="ltr"
                        >
                          {copiedSessionId === session.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span className="max-w-[220px] truncate">{joinUrl}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {session.meetingSource === 'zoom_api' && session.zoomMeetingId && meta.connected && (
                      <button
                        type="button"
                        onClick={() => handleRowHostStart(session)}
                        disabled={isBusy}
                        className="px-2 py-1 rounded-lg bg-primary text-white text-[11px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{_t('بدء كمضيف', 'Host Start')}</span>
                      </button>
                    )}

                    {hostStartUrl && (
                      <a
                        href={hostStartUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{_t('فتح', 'Launch')}</span>
                      </a>
                    )}

                    {meta.connected && (
                      <button
                        type="button"
                        onClick={() => handleRowSync(session)}
                        disabled={isBusy}
                        className="px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/25 text-[11px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isBusy ? 'animate-spin' : ''}`} />
                        <span>{_t('مزامنة', 'Sync')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setCalendarTargetSession(session);
                        setCalendarConfirmOpen(true);
                      }}
                      title={
                        session.googleCalendarEventId
                          ? `Google Event ID: ${session.googleCalendarEventId}`
                          : _t('اختبار مزامنة هذه الحصة مع Google Calendar', 'Test/Sync this single session to Google Calendar')
                      }
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                        session.googleCalendarEventId && session.calendarSyncStatus === 'synced'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                          : 'bg-surface-hover border-surface-border text-text-main'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      <span>{_t('تقويم', 'Cal Sync')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setManualModalSession(session);
                        setManualUrlInput(session.zoomJoinUrl || session.manualFallbackUrl || '');
                        setManualUrlError(null);
                      }}
                      className="px-2 py-1 rounded-lg bg-surface-hover border border-surface-border text-text-main text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>{_t('يدوي', 'Manual')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dry-Run Bulk Migration Preview & Execution Modal */}
      {previewMode && previewData && (
        <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-2xl w-full p-4 sm:p-5 space-y-3.5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-black text-text-main">
                {previewMode === 'standardize_all'
                  ? _t('معاينة تجريبية: توحيد جميع اجتماعات الأونلاين', 'Dry-Run Preview: Standardize All Online Group Meetings')
                  : _t('معاينة تجريبية: إنشاء اجتماعات للجلسات الناقصة', 'Dry-Run Preview: Create Missing Standardized Meetings')}
              </h5>
              <button
                type="button"
                disabled={isMigrating}
                onClick={() => setPreviewMode(null)}
                className="p-1 text-text-muted cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-black text-emerald-600 block tabular-nums">{previewData.counts.createNew}</span>
                <span className="text-[10px] text-text-muted">{_t('إنشاء جديد', 'Create New')}</span>
              </div>
              <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
                <span className="font-black text-sky-600 block tabular-nums">
                  {previewMode === 'standardize_all' ? previewData.counts.replaceManual : 0}
                </span>
                <span className="text-[10px] text-text-muted">{_t('استبدال يدوي مع أرشفة', 'Replace & Archive')}</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="font-black text-amber-600 block tabular-nums">{previewData.counts.updateStandardized}</span>
                <span className="text-[10px] text-text-muted">{_t('تحديث موضوع/وقت', 'Update Existing')}</span>
              </div>
              <div className="p-2 rounded-lg bg-surface-hover border border-surface-border">
                <span className="font-black text-text-main block tabular-nums">{previewData.counts.alreadyStandardized}</span>
                <span className="text-[10px] text-text-muted">{_t('متخطى (موحد)', 'Already Done')}</span>
              </div>
            </div>

            {previewData.groupsMissingSchedule.length > 0 && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="font-black">{_t('مجموعات بدون مواعيد أسبوعية: ', 'Groups missing schedule slots: ')}</span>
                {previewData.groupsMissingSchedule.map((g) => g.groupName).join(', ')}
              </div>
            )}

            {migrationProgress && (
              <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/25 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="truncate">{migrationProgress.currentTitle || _t('جاري التنفيذ...', 'Processing...')}</span>
                  <span className="font-mono tabular-nums shrink-0">
                    {migrationProgress.completed} / {migrationProgress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${migrationProgress.total > 0 ? Math.round((migrationProgress.completed / migrationProgress.total) * 100) : 100}%`
                    }}
                  />
                </div>
              </div>
            )}

            {migrationResult && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-bold ${
                  migrationResult.failedCount === 0
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300'
                }`}
              >
                {_t(
                  `النتيجة: ${migrationResult.succeededCount} تم بنجاح • ${migrationResult.archivedPreviousCount} رابط مؤرشف • ${migrationResult.failedCount} فشل`,
                  `Result: ${migrationResult.succeededCount} succeeded • ${migrationResult.archivedPreviousCount} previous links archived • ${migrationResult.failedCount} failed`
                )}
              </div>
            )}

            <div className="overflow-y-auto flex-1 border border-surface-border rounded-xl divide-y divide-surface-border text-[11px]">
              {previewData.items.map((item) => (
                <div key={item.sessionId} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-text-muted mr-1.5">[{item.sessionCode}]</span>
                    <span className="font-bold text-text-main" dir="ltr">{item.standardizedTitle}</span>
                    {item.planWarning40Min && (
                      <span className="ml-2 text-[10px] font-bold text-amber-600">(40m Basic limit)</span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] uppercase shrink-0 px-1.5 py-0.5 rounded bg-surface-hover border border-surface-border">
                    {item.action}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[10.5px] text-text-muted">
                {_t('الحصص السابقة وسجلات الحضور والمدفوعات لا تتأثر إطلاقاً.', 'Historical lessons, attendance & payments remain untouched.')}
              </span>
              <div className="flex items-center gap-2">
                {isMigrating ? (
                  <button
                    type="button"
                    onClick={() => {
                      abortMigrationRef.current = true;
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>{_t('إيقاف مؤقت', 'Pause')}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewMode(null)}
                      className="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-bold text-text-main cursor-pointer"
                    >
                      {_t('إغلاق', 'Close')}
                    </button>
                    {resumeSkipIds.length > 0 && migrationResult && !migrationResult.completed && (
                      <button
                        type="button"
                        disabled={!meta.connected}
                        onClick={() => runMigration(true)}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{_t('استكمال الباقي', 'Resume Remaining')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!meta.connected}
                      onClick={() => runMigration(false)}
                      className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>
                        {meta.connected
                          ? _t('بدء التنفيذ الآمن', 'Run Standardized Migration')
                          : _t('يتطلب ربط Zoom أولاً', 'Connect Zoom First')}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual URL Override Modal */}
      {manualModalSession && (
        <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveManualOverride} className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-black text-text-main">{_t('إدخال رابط Zoom يدوي', 'Manual Zoom Link Override')}</h5>
              <button type="button" onClick={() => setManualModalSession(null)} className="p-1 text-text-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-text-muted" dir="ltr">{manualModalSession.standardizedTitle}</p>
            <input
              type="url"
              required
              dir="ltr"
              value={manualUrlInput}
              onChange={(e) => setManualUrlInput(e.target.value)}
              placeholder="https://zoom.us/j/1234567890"
              className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-surface-border text-xs font-mono text-text-main"
            />
            {manualUrlError && <p className="text-xs text-rose-600 font-bold">{manualUrlError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setManualModalSession(null)} className="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-bold cursor-pointer">
                {_t('إلغاء', 'Cancel')}
              </button>
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-black cursor-pointer">
                {_t('حفظ وأرشفة السابق', 'Save Link')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Explicit Confirmation Modal for Google Calendar Sync */}
      {calendarConfirmOpen && (
        <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-lg w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-black text-text-main flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  {calendarTargetSession
                    ? _t('تأكيد مزامنة حصة واحدة مع تقويم Google', 'Confirm Single-Session Google Calendar Sync')
                    : _t('تأكيد مزامنة تقويم Google لجميع الحصص', 'Confirm Google Calendar Live Sync')}
                </span>
              </h5>
              <button
                type="button"
                onClick={() => {
                  setCalendarConfirmOpen(false);
                  setCalendarTargetSession(null);
                }}
                className="p-1 text-text-muted cursor-pointer"
              >
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
                <span className="text-[10px] text-text-muted">{_t('متزامن مسبقاً', 'Synced')}</span>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-surface-border rounded-lg divide-y divide-surface-border text-[11px]">
              {calendarPreview.items.map((item) => (
                <div key={item.sessionId} className="px-2.5 py-2 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-text-main truncate" dir="ltr">{item.standardizedTitle}</span>
                    <span className="font-mono text-[10px] text-text-muted shrink-0 uppercase">{item.action}</span>
                  </div>
                  <div className="font-mono text-[9.5px] text-text-muted break-all" dir="ltr">
                    Google event.id: {item.googleCalendarEventId || item.deterministicGoogleEventId} • {item.timezone} ({item.recurrence})
                  </div>
                  {item.googleCalendarIcalUid && (
                    <div className="font-mono text-[9.5px] text-text-muted break-all" dir="ltr">
                      Google iCalUID: {item.googleCalendarIcalUid}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCalendarConfirmOpen(false);
                  setCalendarTargetSession(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-bold cursor-pointer"
              >
                {_t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmGoogleCalendarSync(false)}
                disabled={isSyncingCalendar}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{isSyncingCalendar ? _t('جاري المزامنة...', 'Syncing...') : _t('موافقة ومزامنة التقويم', 'Approve & Sync Calendar')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
