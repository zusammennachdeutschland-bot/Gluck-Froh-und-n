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
  Globe,
  X,
  PlusCircle,
  ShieldOff,
  ChevronDown,
  ChevronUp,
  Layers,
  ListChecks,
  Wrench
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
  CalendarSyncResult,
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

type WorkspaceTab = 'overview' | 'sessions' | 'cleanup';

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

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [meta, setMeta] = useState<ZoomUiMetaState>(() => loadZoomUiMeta());
  const [showZoomCredentials, setShowZoomCredentials] = useState<boolean>(() => !loadZoomUiMeta().connected);
  const [accountIdInput, setAccountIdInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [timezoneInput, setTimezoneInput] = useState(
    () => profile.defaultZoomTimezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE
  );
  const [customTimezoneMode, setCustomTimezoneMode] = useState<boolean>(() => {
    const initial = profile.defaultZoomTimezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE;
    return !COMMON_TIMEZONES.includes(initial);
  });

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

  // Calendar sync confirmation modal state (null = all sessions, or 1 specific session)
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
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [calendarConn, setCalendarConn] = useState<GoogleCalendarConnectionState>(() =>
    getGoogleCalendarConnectionState()
  );

  useEffect(() => {
    const unsub = subscribeGoogleCalendarConnectionState((next) => {
      setCalendarConn(next);
    });
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
        if (fresh.connected) {
          setShowZoomCredentials(false);
        }
        if (fresh.defaultTimezone && !profile.defaultZoomTimezone) {
          setTimezoneInput(fresh.defaultTimezone);
          setCustomTimezoneMode(!COMMON_TIMEZONES.includes(fresh.defaultTimezone));
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

  const livePreviewSummary = useMemo(
    () =>
      buildZoomMigrationPreview({
        groups,
        existingSessions: groupWeeklySessions,
        targetTimezone: timezoneInput || DEFAULT_ZOOM_TIMEZONE
      }),
    [groups, groupWeeklySessions, timezoneInput]
  );

  const activeSessions = useMemo(
    () => livePreviewSummary.reconciledSessions.filter((s) => s && !s.deleted),
    [livePreviewSummary.reconciledSessions]
  );

  const displayedSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (groupWeeklySessions || [])
      .filter((s) => s && !s.deleted)
      .filter((s) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'manual') return s.syncState === 'manual' || s.syncState === 'manual_only';
        return s.syncState === statusFilter;
      })
      .filter((s) => {
        if (!q) return true;
        return (
          s.standardizedTitle.toLowerCase().includes(q) ||
          s.sessionCode.toLowerCase().includes(q) ||
          (s.groupNameSnapshot || '').toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          a.weekday - b.weekday ||
          a.startTime.localeCompare(b.startTime) ||
          (a.groupNameSnapshot || '').localeCompare(b.groupNameSnapshot || '')
      );
  }, [groupWeeklySessions, statusFilter, searchQuery]);

  const calendarTargetSessionsList = useMemo(
    () =>
      calendarTargetSession
        ? livePreviewSummary.reconciledSessions.filter((s) => s.id === calendarTargetSession.id)
        : livePreviewSummary.reconciledSessions,
    [livePreviewSummary.reconciledSessions, calendarTargetSession]
  );

  const calendarPreview = useMemo(
    () =>
      buildGoogleCalendarSyncPreview(calendarTargetSessionsList, {
        forceUpdateSynced: Boolean(calendarTargetSession) || forceResyncAllCalendar,
        includeDeletedCleanup: !calendarTargetSession
      }),
    [calendarTargetSessionsList, calendarTargetSession, forceResyncAllCalendar]
  );

  const basicPlanAffectedSessions = useMemo(
    () => activeSessions.filter((s) => s.durationMinutes >= 41),
    [activeSessions]
  );

  const apiManagedSessionsCount = useMemo(
    () =>
      (groupWeeklySessions || []).filter(
        (s) => s && !s.deleted && s.meetingSource === 'zoom_api' && Boolean(s.zoomMeetingId)
      ).length,
    [groupWeeklySessions]
  );

  const metrics = useMemo(() => {
    const total = activeSessions.length;
    const zoomSynced = activeSessions.filter((s) => s.syncState === 'synced').length;
    const calSynced = activeSessions.filter((s) => s.googleCalendarEventId && s.calendarSyncStatus === 'synced').length;
    const needsAttention = activeSessions.filter(
      (s) =>
        s.syncState === 'needs_update' ||
        s.syncState === 'error' ||
        s.calendarSyncStatus === 'needs_update' ||
        s.calendarSyncStatus === 'error'
    ).length;
    const deletedOrphanCalEvents = livePreviewSummary.reconciledSessions.filter(
      (s) => s && s.deleted && Boolean(s.googleCalendarEventId)
    ).length;
    return { total, zoomSynced, calSynced, needsAttention, deletedOrphanCalEvents };
  }, [activeSessions, livePreviewSummary.reconciledSessions]);

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
      setClientSecretInput('');
      if (res.ok) {
        setAccountIdInput('');
        setClientIdInput('');
        setShowZoomCredentials(false);
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

  const handleSaveTimezone = async (nextTz?: string) => {
    const cleanTz = (nextTz ?? timezoneInput).trim() || DEFAULT_ZOOM_TIMEZONE;
    setIsSavingTimezone(true);
    try {
      const res = await updateZoomDefaultTimezone(cleanTz);
      setMeta(res.state);
      updateProfile({ defaultZoomTimezone: cleanTz });
      triggerToast(
        _t(`تم حفظ المنطقة الزمنية: ${cleanTz}`, `Default timezone saved: ${cleanTz}`, `Zeitzone gespeichert: ${cleanTz}`)
      );
    } finally {
      setIsSavingTimezone(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const nextState = await disconnectZoomAccount();
      setMeta(nextState);
      setShowZoomCredentials(true);
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
          authRes.error || _t('فشل ربط Google Calendar', 'Google Calendar authorization failed')
        );
      }
    } finally {
      setIsConnectingCalendar(false);
    }
  };

  const handleDisconnectGoogleCalendar = async () => {
    await disconnectGoogleCalendar();
    setLastCalendarSyncResult(null);
    triggerToast(_t('تم فصل جلسة Google Calendar', 'Google Calendar session disconnected'));
  };

  const openCalendarSyncModal = (targetSession: GroupWeeklySession | null = null) => {
    setCalendarTargetSession(targetSession);
    setForceResyncAllCalendar(false);
    setLastCalendarSyncResult(null);
    setCalendarSyncProgress(null);
    setCalendarConfirmOpen(true);
  };

  const handleConfirmGoogleCalendarSync = async (forceReauth = false) => {
    setIsSyncingCalendar(true);
    setLastCalendarSyncResult(null);
    setCalendarSyncProgress({ completed: 0, total: Math.max(1, calendarPreview.createCount + calendarPreview.updateCount + calendarPreview.deleteCount), title: '' });
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
        const errMsg =
          authRes.error ||
          (authRes.cancelled
            ? _t('تم إلغاء تفويض Google Calendar', 'Google Calendar authorization was cancelled.')
            : _t('فشل تفويض Google Calendar', 'Google Calendar authorization failed'));
        setLastCalendarSyncResult({
          success: false,
          errorCode: authRes.code,
          createdCount: 0,
          updatedCount: 0,
          deletedCount: 0,
          skippedCount: 0,
          failedCount: 1,
          sessions: sessionsToUse,
          errors: [{ sessionId: 'auth', title: 'Google Calendar Authorization', error: errMsg, code: authRes.code }]
        });
        triggerToast(errMsg);
        return;
      }

      const targetIds = calendarTargetSession ? new Set([calendarTargetSession.id]) : undefined;
      const shouldForce = Boolean(calendarTargetSession) || forceResyncAllCalendar;
      let syncRes = await syncSessionsToGoogleCalendar({
        allSessions: sessionsToUse,
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

      applyZoomWorkspaceSnapshot({
        sessions: syncRes.sessions,
        history:
          livePreviewSummary.reconciledHistory.length > 0
            ? [...livePreviewSummary.reconciledHistory, ...zoomMeetingHistory]
            : undefined
      });
      setLastCalendarSyncResult(syncRes);

      if (syncRes.failedCount > 0) {
        const firstErr = syncRes.errors[0]?.error;
        triggerToast(
          firstErr
            ? firstErr
            : _t(
                `مزامنة التقويم: ${syncRes.createdCount} جديد، ${syncRes.updatedCount} محدث، ${syncRes.failedCount} فشل`,
                `Calendar sync: ${syncRes.createdCount} created, ${syncRes.updatedCount} updated, ${syncRes.failedCount} failed`
              )
        );
        // Keep modal open so the teacher immediately sees the exact error details and can retry or reconnect
      } else {
        setCalendarConfirmOpen(false);
        setCalendarTargetSession(null);
        const delPart = syncRes.deletedCount
          ? _t(`، ${syncRes.deletedCount} محذوف`, `, ${syncRes.deletedCount} removed`)
          : '';
        triggerToast(
          _t(
            `تمت مزامنة Google Calendar: ${syncRes.createdCount} جديد، ${syncRes.updatedCount} محدث${delPart}`,
            `Google Calendar synced: ${syncRes.createdCount} created, ${syncRes.updatedCount} updated${delPart}`,
            `Google Kalender synchronisiert: ${syncRes.createdCount} neu, ${syncRes.updatedCount} aktualisiert`
          )
        );
      }
    } finally {
      setIsSyncingCalendar(false);
      setCalendarSyncProgress(null);
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

  const getSessionSyncLabel = (session: GroupWeeklySession): { text: string; toneClass: string } => {
    switch (session.syncState) {
      case 'synced':
        return {
          text: _t('متزامن', 'Synced', 'Synchronisiert'),
          toneClass: 'text-emerald-600 dark:text-emerald-400'
        };
      case 'needs_update':
        return {
          text: _t('يحتاج تحديث', 'Needs update', 'Update nötig'),
          toneClass: 'text-amber-600 dark:text-amber-400'
        };
      case 'manual':
      case 'manual_only':
        return {
          text: _t('رابط يدوي', 'Manual link', 'Manueller Link'),
          toneClass: 'text-sky-600 dark:text-sky-400'
        };
      case 'error':
        return {
          text: _t('خطأ', 'Error', 'Fehler'),
          toneClass: 'text-rose-600 dark:text-rose-400'
        };
      default:
        return {
          text: _t('قيد الانتظار', 'Pending', 'Ausstehend'),
          toneClass: 'text-text-muted'
        };
    }
  };

  const calendarStatusInfo = useMemo(() => {
    const isConnected = calendarConn.status === 'connected' && calendarConn.hasInMemoryToken;
    if (isConnected) {
      return {
        label: _t('متصل وجاهز', 'Connected', 'Verbunden'),
        toneClass: 'text-emerald-600 dark:text-emerald-400',
        needsReconnect: false,
        hasAlert: false
      };
    }
    if (calendarConn.status === 'needs_verification') {
      return {
        label: _t('جاري التحقق...', 'Verifying...', 'Wird geprüft...'),
        toneClass: 'text-sky-600 dark:text-sky-400',
        needsReconnect: false,
        hasAlert: false
      };
    }
    if (calendarConn.status === 'reconnect_required' || calendarConn.status === 'expired') {
      return {
        label: _t('يحتاج إعادة ربط', 'Reconnect required', 'Erneut verbinden'),
        toneClass: 'text-amber-600 dark:text-amber-400',
        needsReconnect: true,
        hasAlert: true
      };
    }
    if (calendarConn.status === 'error') {
      return {
        label: _t('خطأ في الاتصال', 'Connection error', 'Verbindungsfehler'),
        toneClass: 'text-rose-600 dark:text-rose-400',
        needsReconnect: true,
        hasAlert: true
      };
    }
    if (calendarConn.status === 'cancelled') {
      return {
        label: _t('تم الإلغاء', 'Cancelled', 'Abgebrochen'),
        toneClass: 'text-text-muted',
        needsReconnect: false,
        hasAlert: false
      };
    }
    return {
      label: _t('غير متصل', 'Not connected', 'Nicht verbunden'),
      toneClass: 'text-text-muted',
      needsReconnect: false,
      hasAlert: false
    };
  }, [calendarConn, _t]);

  const calendarActionLabel = (action: 'create' | 'update' | 'delete' | 'skip_synced') => {
    switch (action) {
      case 'create':
        return { text: _t('إنشاء', 'Create'), cls: 'text-emerald-600 dark:text-emerald-400' };
      case 'update':
        return { text: _t('تحديث', 'Update'), cls: 'text-amber-600 dark:text-amber-400' };
      case 'delete':
        return { text: _t('حذف محذوفة', 'Remove'), cls: 'text-rose-600 dark:text-rose-400' };
      default:
        return { text: _t('متزامن', 'Synced'), cls: 'text-text-muted' };
    }
  };

  const totalPendingCalendarOps =
    calendarPreview.createCount + calendarPreview.updateCount + calendarPreview.deleteCount;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-3.5">
      {/* Clean 3-Tab Segmented Workspace Navigation */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-hover border border-surface-border">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
            activeTab === 'overview'
              ? 'bg-surface text-primary shadow-2xs border-surface-border'
              : 'text-text-muted hover:text-text-main border-transparent'
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{_t('المزامنة', 'Sync Hub', 'Sync')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
            activeTab === 'sessions'
              ? 'bg-surface text-primary shadow-2xs border-surface-border'
              : 'text-text-muted hover:text-text-main border-transparent'
          }`}
        >
          <ListChecks className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{_t('الحصص', 'Sessions', 'Sitzungen')}</span>
          <span className="text-[11px] font-mono tabular-nums opacity-75">{metrics.total}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cleanup')}
          className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
            activeTab === 'cleanup'
              ? 'bg-surface text-primary shadow-2xs border-surface-border'
              : 'text-text-muted hover:text-text-main border-transparent'
          }`}
        >
          <Wrench className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{_t('التنظيف', 'Cleanup', 'Bereinigen')}</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: OVERVIEW & SYNC HUB
      ====================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-3.5">
          {/* Unboxed Horizontal Health Metrics Bar (Hairline Dividers) */}
          <div className="rounded-2xl bg-surface border border-surface-border grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-surface-border overflow-hidden shadow-2xs">
            <div className="px-3.5 py-3">
              <div className="text-[11px] font-medium text-text-muted">
                {_t('الحصص الأسبوعية', 'Weekly Sessions', 'Wochentermine')}
              </div>
              <div className="mt-1 text-lg font-bold text-text-main tabular-nums">
                {metrics.total}
                <span className="text-xs font-normal text-text-muted mx-1.5">
                  · {activeOnlineGroups.length} {_t('مجموعة', 'groups')}
                </span>
              </div>
            </div>

            <div className="px-3.5 py-3">
              <div className="text-[11px] font-medium text-text-muted">
                {_t('متزامن مع Zoom', 'Zoom Synced', 'Zoom Sync')}
              </div>
              <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {metrics.zoomSynced}
                <span className="text-xs font-normal text-text-muted"> / {metrics.total}</span>
              </div>
            </div>

            <div className="px-3.5 py-3">
              <div className="text-[11px] font-medium text-text-muted">
                {_t('متزامن مع التقويم', 'Calendar Synced', 'Kalender Sync')}
              </div>
              <div className="mt-1 text-lg font-bold text-primary tabular-nums">
                {metrics.calSynced}
                <span className="text-xs font-normal text-text-muted"> / {metrics.total}</span>
              </div>
            </div>

            <div className="px-3.5 py-3">
              <div className="text-[11px] font-medium text-text-muted">
                {_t('تحتاج تحديث', 'Needs Attention', 'Update nötig')}
              </div>
              <div
                className={`mt-1 text-lg font-bold tabular-nums ${
                  metrics.needsAttention > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-text-main'
                }`}
              >
                {metrics.needsAttention}
              </div>
            </div>
          </div>

          {/* Dual Connection Cards: Zoom + Google Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Connection 1: Zoom */}
            <div className="rounded-2xl bg-surface border border-surface-border p-4 flex flex-col justify-between gap-3.5 shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary-soft border border-primary-border/60 text-primary flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-text-main">Zoom</h3>
                        <span
                          className={`text-xs font-semibold ${
                            meta.connected
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : meta.hasCredentials
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-text-muted'
                          }`}
                        >
                          ·{' '}
                          {meta.connected
                            ? _t('متصل', 'Connected', 'Verbunden')
                            : meta.hasCredentials
                            ? _t('محفوظ', 'Saved', 'Gespeichert')
                            : _t('غير متصل', 'Not connected', 'Nicht verbunden')}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted truncate" dir="ltr">
                        {meta.hostEmail ||
                          _t(
                            'اجتماعات أسبوعية موحدة تلقائياً',
                            'Standardized recurring meetings'
                          )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowZoomCredentials((v) => !v)}
                    className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{showZoomCredentials ? _t('إخفاء', 'Hide') : _t('الإعدادات', 'Setup')}</span>
                    {showZoomCredentials ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Compact Plan & Timezone Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-surface-border text-xs">
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span>{_t('المنطقة الزمنية', 'Timezone')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!customTimezoneMode ? (
                      <select
                        value={COMMON_TIMEZONES.includes(timezoneInput) ? timezoneInput : '__custom__'}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setCustomTimezoneMode(true);
                          } else {
                            setTimezoneInput(e.target.value);
                            handleSaveTimezone(e.target.value);
                          }
                        }}
                        disabled={isSavingTimezone}
                        dir="ltr"
                        className="min-h-[36px] px-2.5 rounded-lg bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                      >
                        {COMMON_TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                        <option value="__custom__">{_t('أخرى...', 'Custom...')}</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          dir="ltr"
                          value={timezoneInput}
                          onChange={(e) => setTimezoneInput(e.target.value)}
                          placeholder="Africa/Cairo"
                          className="min-h-[36px] w-36 px-2.5 rounded-lg bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTimezone()}
                          disabled={isSavingTimezone}
                          className="min-h-[36px] px-2.5 rounded-lg bg-primary text-primary-fg text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          {_t('حفظ', 'Save')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {meta.connected && meta.isBasicPlan && basicPlanAffectedSessions.length > 0 && (
                  <p className="text-[11.5px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      {_t(
                        `خطة Zoom Basic (حد 40 دقيقة) تنطبق على ${basicPlanAffectedSessions.length} حصة أطول من 40 دقيقة.`,
                        `Zoom Basic 40-min cap applies to ${basicPlanAffectedSessions.length} session(s) over 40 min.`
                      )}
                    </span>
                  </p>
                )}

                {meta.lastError && !meta.connected && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    {meta.lastError}
                  </p>
                )}

                {/* Collapsible Zoom S2S Credentials Drawer */}
                {showZoomCredentials && (
                  <form
                    onSubmit={handleSaveCredentials}
                    className="space-y-2.5 pt-3 border-t border-surface-border"
                  >
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-text-muted block mb-1">
                          Account ID {meta.maskedAccountId ? `(${meta.maskedAccountId})` : ''}
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          autoComplete="off"
                          value={accountIdInput}
                          onChange={(e) => setAccountIdInput(e.target.value)}
                          placeholder={
                            meta.hasCredentials
                              ? _t('محفوظ — أدخل للاستبدال', 'Saved — enter to replace')
                              : 'Zoom Account ID'
                          }
                          className="w-full min-h-[40px] px-3 rounded-xl bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-text-muted block mb-1">
                          Client ID {meta.maskedClientId ? `(${meta.maskedClientId})` : ''}
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          autoComplete="off"
                          value={clientIdInput}
                          onChange={(e) => setClientIdInput(e.target.value)}
                          placeholder={
                            meta.hasCredentials
                              ? _t('محفوظ — أدخل للاستبدال', 'Saved — enter to replace')
                              : 'Zoom Client ID'
                          }
                          className="w-full min-h-[40px] px-3 rounded-xl bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-text-muted block mb-1">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          dir="ltr"
                          autoComplete="new-password"
                          value={clientSecretInput}
                          onChange={(e) => setClientSecretInput(e.target.value)}
                          placeholder={
                            meta.hasCredentials
                              ? _t('محفوظ مشفر — أدخل للاستبدال', 'Encrypted in vault — enter to replace')
                              : 'Zoom Client Secret'
                          }
                          className="w-full min-h-[40px] px-3 rounded-xl bg-surface-hover border border-surface-border text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={
                          isSavingCreds ||
                          !accountIdInput.trim() ||
                          !clientIdInput.trim() ||
                          !clientSecretInput.trim()
                        }
                        className="min-h-[40px] px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>
                          {isSavingCreds
                            ? _t('جاري الحفظ...', 'Saving...')
                            : _t('حفظ والاتصال', 'Save & Connect')}
                        </span>
                      </button>

                      {meta.hasCredentials && (
                        <>
                          <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className="min-h-[40px] px-3 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                            <span>{_t('اختبار', 'Test')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleDisconnect}
                            disabled={isDisconnecting}
                            className="min-h-[40px] px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{_t('فصل', 'Disconnect')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {/* Zoom Action Buttons */}
              <div className="pt-3 border-t border-surface-border space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!meta.connected || activeOnlineGroups.length === 0}
                    onClick={() => openMigrationPreview('standardize_all')}
                    className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>{_t('توحيد اجتماعات Zoom', 'Standardize Zoom')}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!meta.connected || activeOnlineGroups.length === 0}
                    onClick={() => openMigrationPreview('create_missing_only')}
                    className="min-h-[44px] px-3.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{_t('إنشاء الناقص', 'Create Missing')}</span>
                  </button>
                </div>

                {apiManagedSessionsCount > 0 && (
                  <button
                    type="button"
                    disabled={!meta.connected || isDisablingWaitingRoom}
                    onClick={handleDisableWaitingRoomAll}
                    className="w-full min-h-[40px] px-3 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-muted hover:text-text-main text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldOff className={`w-3.5 h-3.5 shrink-0 ${isDisablingWaitingRoom ? 'animate-pulse' : ''}`} />
                    <span>
                      {isDisablingWaitingRoom && waitingRoomProgress
                        ? _t(
                            `جاري إلغاء غرفة الانتظار (${waitingRoomProgress.completed}/${waitingRoomProgress.total})...`,
                            `Disabling Waiting Room (${waitingRoomProgress.completed}/${waitingRoomProgress.total})...`
                          )
                        : _t(
                            `إلغاء غرفة الانتظار لجميع الاجتماعات (${apiManagedSessionsCount})`,
                            `Disable Waiting Room on all meetings (${apiManagedSessionsCount})`
                          )}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Connection 2: Google Calendar */}
            <div className="rounded-2xl bg-surface border border-surface-border p-4 flex flex-col justify-between gap-3.5 shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary-soft border border-primary-border/60 text-primary flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-text-main">Google Calendar</h3>
                        <span className={`text-xs font-semibold ${calendarStatusInfo.toneClass}`}>
                          · {calendarStatusInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted truncate" dir="ltr">
                        {calendarConn.accountEmail
                          ? `${calendarConn.accountEmail}${calendarConn.calendarTimeZone ? ` · ${calendarConn.calendarTimeZone}` : ''}`
                          : _t(
                              'مزامنة الحصص الأسبوعية تلقائياً بدون تكرار',
                              'Sync recurring sessions without duplicates'
                            )}
                      </p>
                    </div>
                  </div>

                  {calendarConn.status === 'connected' && calendarConn.hasInMemoryToken && (
                    <button
                      type="button"
                      onClick={handleDisconnectGoogleCalendar}
                      className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-text-muted hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer shrink-0"
                    >
                      {_t('فصل', 'Disconnect')}
                    </button>
                  )}
                </div>

                {/* Contextual Alert ONLY when an error or reconnect condition exists */}
                {calendarStatusInfo.hasAlert && calendarConn.lastMessage && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold leading-relaxed">{calendarConn.lastMessage}</p>
                        {calendarConn.lastErrorCode && (
                          <p className="text-[11px] font-mono opacity-75" dir="ltr">
                            {calendarConn.lastErrorCode}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {metrics.deletedOrphanCalEvents > 0 && (
                  <p className="text-xs text-text-muted">
                    {_t(
                      `سيتم تنظيف ${metrics.deletedOrphanCalEvents} حدث محذوف تلقائياً عند المزامنة القادمة.`,
                      `${metrics.deletedOrphanCalEvents} deleted session event(s) will be removed automatically on next sync.`
                    )}
                  </p>
                )}

                {/* Inline summary of last completed sync if there were issues */}
                {lastCalendarSyncResult && !calendarConfirmOpen && (
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      lastCalendarSyncResult.failedCount > 0
                        ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    <div className="font-bold tabular-nums">
                      {_t(
                        `آخر مزامنة: ${lastCalendarSyncResult.createdCount} جديد · ${lastCalendarSyncResult.updatedCount} محدث${lastCalendarSyncResult.deletedCount ? ` · ${lastCalendarSyncResult.deletedCount} محذوف` : ''}${lastCalendarSyncResult.failedCount > 0 ? ` · ${lastCalendarSyncResult.failedCount} فشل` : ''}`,
                        `Last sync: ${lastCalendarSyncResult.createdCount} created · ${lastCalendarSyncResult.updatedCount} updated${lastCalendarSyncResult.deletedCount ? ` · ${lastCalendarSyncResult.deletedCount} removed` : ''}${lastCalendarSyncResult.failedCount > 0 ? ` · ${lastCalendarSyncResult.failedCount} failed` : ''}`
                      )}
                    </div>
                    {lastCalendarSyncResult.errors.length > 0 && (
                      <p className="text-[11px] opacity-90">{lastCalendarSyncResult.errors[0].error}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Google Calendar Action Buttons */}
              <div className="pt-3 border-t border-surface-border space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {calendarConn.status === 'connected' && calendarConn.hasInMemoryToken ? (
                    <button
                      type="button"
                      disabled={activeSessions.length === 0 && metrics.deletedOrphanCalEvents === 0}
                      onClick={() => openCalendarSyncModal(null)}
                      className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{_t('مزامنة التقويم الآن', 'Sync Calendar Now', 'Kalender synchronisieren')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConnectGoogleCalendar(calendarStatusInfo.needsReconnect)}
                      disabled={isConnectingCalendar}
                      className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isConnectingCalendar
                          ? _t('جاري الربط...', 'Connecting...')
                          : calendarStatusInfo.needsReconnect
                          ? _t('إعادة ربط Google Calendar', 'Reconnect Calendar')
                          : _t('ربط Google Calendar', 'Connect Google Calendar')}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={activeSessions.length === 0}
                    onClick={() => downloadSessionsIcsFile(activeSessions, 'glueck_zoom_schedule.ics')}
                    className="min-h-[44px] px-3.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>{_t('تصدير .ics', 'Export .ics')}</span>
                  </button>
                </div>

                {calendarConn.status === 'connected' && calendarConn.hasInMemoryToken && (
                  <button
                    type="button"
                    onClick={() => handleConnectGoogleCalendar(true)}
                    disabled={isConnectingCalendar}
                    className="w-full min-h-[38px] px-3 rounded-xl text-xs font-medium text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer"
                  >
                    {_t('تغيير حساب Google Calendar', 'Switch Google Calendar account')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: STANDARDIZED SESSIONS DIRECTORY
      ====================================================================== */}
      {activeTab === 'sessions' && (
        <div className="space-y-2.5">
          {/* Search + Unified Segmented Filter Bar */}
          <div className="space-y-2">
            <div className="relative flex-1">
              <Search
                className={`w-3.5 h-3.5 text-text-muted/80 absolute top-1/2 -translate-y-1/2 ${
                  isRtl ? 'right-3' : 'left-3'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={_t('ابحث باسم المجموعة أو الموعد...', 'Search group or session...')}
                className={`w-full min-h-[40px] rounded-xl bg-surface border border-surface-border text-xs font-medium text-text-main placeholder:text-text-muted/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors ${
                  isRtl ? 'pr-8.5 pl-3' : 'pl-8.5 pr-3'
                }`}
              />
            </div>

            <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-xl border border-surface-border overflow-x-auto hide-scrollbar">
              {(
                [
                  { id: 'all', label: _t('الكل', 'All') },
                  { id: 'needs_update', label: _t('تحديث', 'Update') },
                  { id: 'pending', label: _t('انتظار', 'Pending') },
                  { id: 'synced', label: _t('متزامن', 'Synced') },
                  { id: 'manual', label: _t('يدوي', 'Manual') },
                  { id: 'error', label: _t('خطأ', 'Error') }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                    statusFilter === tab.id
                      ? 'bg-surface text-primary border-surface-border shadow-2xs'
                      : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sessions List */}
          {displayedSessions.length === 0 ? (
            <div className="rounded-2xl bg-surface border border-surface-border p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-text-main">
                {_t('لا توجد حصص مطابقة للفلتر الحالي', 'No sessions match the current filter')}
              </p>
              <p className="text-xs text-text-muted">
                {_t(
                  'أضف مواعيد أسبوعية للمجموعات الأونلاين أو اضغط "توحيد اجتماعات Zoom" من تبويب المزامنة.',
                  'Add weekly schedules to online groups or run Standardize Zoom from the Sync Hub tab.'
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface border border-surface-border divide-y divide-surface-border overflow-hidden">
              {displayedSessions.map((session) => {
                const joinUrl = session.zoomJoinUrl || session.manualFallbackUrl;
                const isBusy = busySessionId === session.id;
                const hostUrl = hostLaunchMap[session.id];
                const zoomStatus = getSessionSyncLabel(session);
                const calSynced = Boolean(session.googleCalendarEventId && session.calendarSyncStatus === 'synced');
                const calNeedsUpdate = Boolean(session.googleCalendarEventId && session.calendarSyncStatus === 'needs_update');

                return (
                  <div key={session.id} className="p-3.5 space-y-2.5 hover:bg-surface-hover/40 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm font-bold text-text-main truncate" dir="ltr">
                          {session.standardizedTitle}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted tabular-nums">
                          <span className={`font-semibold ${zoomStatus.toneClass}`}>
                            Zoom: {zoomStatus.text}
                          </span>
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
                              ? _t('يحتاج تحديث', 'Update')
                              : session.calendarSyncStatus === 'error'
                              ? _t('خطأ', 'Error')
                              : _t('غير مضاف', 'Not synced')}
                          </span>
                          <span>·</span>
                          <span>
                            {session.durationMinutes} {_t('د', 'm')}
                          </span>
                          {session.zoomMeetingId && (
                            <>
                              <span>·</span>
                              <span className="font-mono" dir="ltr">
                                ID {session.zoomMeetingId}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Clean Action Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {session.meetingSource === 'zoom_api' && session.zoomMeetingId && meta.connected && (
                          <button
                            type="button"
                            onClick={() => handleRowHostStart(session)}
                            disabled={isBusy}
                            className="min-h-[38px] px-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{_t('بدء', 'Host')}</span>
                          </button>
                        )}

                        {hostUrl && (
                          <a
                            href={hostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[38px] px-3 rounded-xl bg-primary-soft border border-primary-border text-primary text-xs font-bold flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{_t('فتح', 'Open')}</span>
                          </a>
                        )}

                        {meta.connected && (
                          <button
                            type="button"
                            onClick={() => handleRowSync(session)}
                            disabled={isBusy}
                            className="min-h-[38px] px-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                            <span>Zoom</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openCalendarSyncModal(session)}
                          className="min-h-[38px] px-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{_t('التقويم', 'Cal')}</span>
                        </button>

                        {joinUrl && (
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(session)}
                            className="min-h-[38px] px-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedSessionId === session.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{_t('نسخ', 'Copy')}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setManualModalSession(session);
                            setManualUrlInput(joinUrl || '');
                            setManualUrlError(null);
                          }}
                          className="min-h-[38px] px-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-muted hover:text-text-main text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          title={_t('تعيين رابط يدوي', 'Set manual link')}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {(session.lastError || session.calendarSyncError) && (
                      <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg">
                        {session.calendarSyncError || session.lastError}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: CLEANUP & REBUILD (DEDICATED SAFE ZONE)
      ====================================================================== */}
      {activeTab === 'cleanup' && (
        <ZoomCleanupRebuildSection
          zoomConnected={meta.connected}
          timezone={timezoneInput || DEFAULT_ZOOM_TIMEZONE}
          calendarConn={calendarConn}
          onConnectCalendar={handleConnectGoogleCalendar}
        />
      )}

      {/* =====================================================================
          MODAL 1: BULK ZOOM MIGRATION PREVIEW & PROGRESS
      ====================================================================== */}
      {previewMode && previewData && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface border-t sm:border border-surface-border rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-5 pb-safe-bottom sm:pb-5 space-y-4 shadow-2xl max-h-[88dvh] flex flex-col">
            <div className="w-10 h-1 bg-surface-border rounded-full mx-auto -mt-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-text-main">
                  {previewMode === 'standardize_all'
                    ? _t('توحيد جميع اجتماعات Zoom', 'Standardize All Zoom Meetings')
                    : _t('إنشاء اجتماعات Zoom الناقصة فقط', 'Create Missing Zoom Meetings')}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  {_t(
                    'الحصص التاريخية وسجل روابط Grain القديمة محفوظة ولن تتأثر.',
                    'Historical lessons and archived Grain meeting links remain safely preserved.'
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={isMigrating}
                onClick={() => setPreviewMode(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 rounded-xl bg-surface-hover border border-surface-border divide-x divide-surface-border text-center py-2.5">
              <div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {previewData.counts.createNew}
                </div>
                <div className="text-[11px] text-text-muted">{_t('إنشاء جديد', 'Create')}</div>
              </div>
              <div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {previewMode === 'standardize_all'
                    ? previewData.counts.replaceManual + previewData.counts.updateStandardized
                    : previewData.counts.updateStandardized}
                </div>
                <div className="text-[11px] text-text-muted">{_t('تحديث / استبدال', 'Update')}</div>
              </div>
              <div>
                <div className="text-base font-bold text-text-main tabular-nums">
                  {previewData.counts.alreadyStandardized}
                </div>
                <div className="text-[11px] text-text-muted">{_t('متزامن مسبقاً', 'Synced')}</div>
              </div>
            </div>

            {isMigrating && migrationProgress && (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-main truncate" dir="ltr">
                    {migrationProgress.currentTitle}
                  </span>
                  <span className="font-mono tabular-nums text-text-muted shrink-0">
                    {migrationProgress.completed} / {migrationProgress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((migrationProgress.completed / Math.max(1, migrationProgress.total)) * 100)
                      )}%`
                    }}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      abortMigrationRef.current = true;
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>{_t('إيقاف مؤقت', 'Pause')}</span>
                  </button>
                </div>
              </div>
            )}

            {migrationResult && !isMigrating && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  migrationResult.failedCount === 0
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300'
                }`}
              >
                <div className="font-bold tabular-nums">
                  {_t(
                    `النتيجة: ${migrationResult.succeededCount} نجاح · ${migrationResult.failedCount} فشل · ${migrationResult.archivedPreviousCount} رابط مؤرشف`,
                    `Result: ${migrationResult.succeededCount} succeeded · ${migrationResult.failedCount} failed · ${migrationResult.archivedPreviousCount} archived`
                  )}
                </div>
                {migrationResult.errors.slice(0, 3).map((e) => (
                  <div key={e.sessionId} className="text-[11px] opacity-90">
                    {e.title}: {e.error}
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-y-auto flex-1 rounded-xl border border-surface-border divide-y divide-surface-border text-xs">
              {previewData.items.map((item) => (
                <div key={item.sessionId} className="px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-text-main truncate" dir="ltr">
                      {item.standardizedTitle}
                    </div>
                    <div className="text-[11px] text-text-muted tabular-nums">
                      {item.durationMinutes} {_t('دقيقة', 'min')}
                      {item.previousZoomMeetingId ? ` · ID ${item.previousZoomMeetingId}` : ''}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      item.action === 'create_new'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : item.action === 'replace_manual_with_standardized' || item.action === 'update_standardized'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-text-muted'
                    }`}
                  >
                    {item.action === 'create_new'
                      ? _t('إنشاء', 'Create')
                      : item.action === 'replace_manual_with_standardized'
                      ? _t('استبدال وأرشفة', 'Replace')
                      : item.action === 'update_standardized'
                      ? _t('تحديث', 'Update')
                      : _t('متزامن', 'Synced')}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isMigrating}
                onClick={() => setPreviewMode(null)}
                className="min-h-[42px] px-4 rounded-xl border border-surface-border text-xs font-semibold text-text-main cursor-pointer disabled:opacity-40"
              >
                {_t('إغلاق', 'Close')}
              </button>

              {migrationResult && !migrationResult.completed && !isMigrating && (
                <button
                  type="button"
                  onClick={() => runMigration(true)}
                  className="min-h-[42px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{_t('استكمال الباقي', 'Resume Remaining')}</span>
                </button>
              )}

              <button
                type="button"
                disabled={isMigrating}
                onClick={() => runMigration(false)}
                className="min-h-[42px] px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isMigrating ? _t('جاري التنفيذ...', 'Running...') : _t('تنفيذ الآن', 'Run Now')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: GOOGLE CALENDAR SYNC CONFIRMATION & LIVE PROGRESS
      ====================================================================== */}
      {calendarConfirmOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface border-t sm:border border-surface-border rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-5 pb-safe-bottom sm:pb-5 space-y-4 shadow-2xl max-h-[88dvh] flex flex-col">
            <div className="w-10 h-1 bg-surface-border rounded-full mx-auto -mt-1 sm:hidden shrink-0" />
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-text-main">
                  {calendarTargetSession
                    ? _t('مزامنة حصة واحدة مع تقويم Google', 'Sync Single Session to Google Calendar')
                    : _t('مزامنة تقويم Google', 'Sync Google Calendar')}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  {_t(
                    'يتم تحديث أحداث Glück فقط — أحداثك الشخصية في التقويم لن تُمس.',
                    'Only Glück session events are modified; personal Calendar events stay untouched.'
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
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clean Metric Strip */}
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

            {/* Force Re-sync Toggle (for bulk sync) */}
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
                    'إعادة مزامنة الحصص المتزامنة مسبقاً أيضاً (مفيد إذا حذفت أحداثاً يدوياً من التقويم)',
                    'Force re-sync already synced sessions too (useful if events were deleted manually)'
                  )}
                </span>
              </label>
            )}

            {/* Live Progress Bar */}
            {isSyncingCalendar && calendarSyncProgress && (
              <div className="p-3 rounded-xl bg-primary-soft border border-primary-border space-y-2">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-semibold text-text-main truncate" dir="ltr">
                    {calendarSyncProgress.title || _t('جاري الاتصال بـ Google Calendar...', 'Connecting to Google Calendar...')}
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

            {/* Detailed Error Panel if Sync Had Failures */}
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
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {lastCalendarSyncResult.errors.slice(0, 5).map((err, idx) => (
                    <div key={`${err.sessionId}_${idx}`} className="text-[11px] leading-relaxed">
                      <span className="font-semibold">{err.title}:</span> {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Items */}
            <div className="overflow-y-auto flex-1 max-h-52 rounded-xl border border-surface-border divide-y divide-surface-border text-xs">
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
                className="min-h-[42px] px-4 rounded-xl border border-surface-border text-xs font-semibold text-text-main cursor-pointer disabled:opacity-40"
              >
                {_t('إلغاء', 'Cancel')}
              </button>

              {(lastCalendarSyncResult?.scopeInsufficient ||
                lastCalendarSyncResult?.authExpired ||
                calendarStatusInfo.needsReconnect) && (
                <button
                  type="button"
                  disabled={isSyncingCalendar}
                  onClick={() => handleConfirmGoogleCalendarSync(true)}
                  className="min-h-[42px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{_t('إعادة الربط والمزامنة', 'Reconnect & Sync')}</span>
                </button>
              )}

              <button
                type="button"
                disabled={isSyncingCalendar || (totalPendingCalendarOps === 0 && !forceResyncAllCalendar)}
                onClick={() => handleConfirmGoogleCalendarSync(false)}
                className="min-h-[42px] px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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

      {/* =====================================================================
          MODAL 3: MANUAL ZOOM URL OVERRIDE
      ====================================================================== */}
      {manualModalSession && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveManualOverride}
            className="bg-surface border-t sm:border border-surface-border rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 pb-safe-bottom sm:pb-5 space-y-3.5 shadow-2xl"
          >
            <div className="w-10 h-1 bg-surface-border rounded-full mx-auto -mt-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-text-main">
                {_t('تعيين رابط Zoom يدوي', 'Manual Zoom Link Override')}
              </h4>
              <button
                type="button"
                onClick={() => setManualModalSession(null)}
                className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-text-muted hover:text-text-main cursor-pointer"
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
            {manualUrlError && <p className="text-xs text-rose-600 font-semibold">{manualUrlError}</p>}
            <div className="flex items-center justify-end gap-2 pt-1">
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
    </div>
  );
};
