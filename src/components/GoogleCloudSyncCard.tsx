import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  signInTeacherWithGoogle,
  signInTeacherWithEmailPassword,
  signOutTeacherFirebase,
  subscribeTeacherAuth,
  isAutoCloudSyncEnabled,
  setAutoCloudSyncEnabled,
  getLastCloudSyncTime,
  uploadWorkspaceToGoogleCloud,
  downloadWorkspaceFromGoogleCloud,
  CloudSyncSummary,
  getVercelPublicDomain,
  setVercelPublicDomain,
  DEFAULT_VERCEL_DOMAIN
} from '../services/firebaseWorkspaceSync';
import {
  Cloud,
  RefreshCw,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  LogIn,
  Globe,
  ExternalLink,
  Edit3,
  RotateCcw,
  Sparkles,
  KeyRound,
  Lock,
  Mail,
  X
} from 'lucide-react';

interface GoogleCloudSyncCardProps {
  compact?: boolean;
}

export const GoogleCloudSyncCard: React.FC<GoogleCloudSyncCardProps> = ({ compact = false }) => {
  const {
    students,
    groups,
    lessons,
    payments,
    financeTransactions,
    lernstudioSets,
    hodStudents,
    schoolNotes,
    performBackup,
    importBackupFile,
    triggerToast,
    profile,
    _t
  } = useApp();

  const teacherEmail = profile?.email || 'zusammennachdeutschland@gmail.com';

  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [autoSync, setAutoSync] = useState<boolean>(() => isAutoCloudSyncEnabled());
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastCloudSyncTime());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [actionLoading, setActionLoading] = useState<'sync' | 'push' | 'pull' | 'login' | 'in_app_login' | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cloudSummary, setCloudSummary] = useState<CloudSyncSummary | null>(null);

  // In-App Sign-In Modal States
  const [showInAppAuthModal, setShowInAppAuthModal] = useState(false);
  const [authEmailInput, setAuthEmailInput] = useState(teacherEmail);
  const [authPasswordInput, setAuthPasswordInput] = useState('gluck_teacher_2026!');
  const [authTab, setAuthTab] = useState<'in_app' | 'google'>('in_app');

  useEffect(() => {
    if (profile?.email) {
      setAuthEmailInput(profile.email);
    }
  }, [profile?.email]);

  // Vercel Student Platform Domain State
  const [vercelDomain, setVercelDomainState] = useState<string>(() => getVercelPublicDomain());
  const [customVercelDomain, setCustomVercelDomain] = useState<string>(() => getVercelPublicDomain());
  const [isEditingDomain, setIsEditingDomain] = useState(false);

  const handleSaveVercelDomain = () => {
    const cleaned = setVercelPublicDomain(customVercelDomain);
    setVercelDomainState(cleaned);
    setCustomVercelDomain(cleaned);
    setIsEditingDomain(false);
    setFeedbackMsg({
      type: 'success',
      text: _t(
        `تم حفظ دومين منصة الطلاب بنجاح: ${cleaned}`,
        `Student platform domain saved: ${cleaned}`,
        `Vercel-Domain gespeichert: ${cleaned}`
      )
    });
  };

  const handleResetVercelDomain = () => {
    const cleaned = setVercelPublicDomain(DEFAULT_VERCEL_DOMAIN);
    setVercelDomainState(cleaned);
    setCustomVercelDomain(cleaned);
    setIsEditingDomain(false);
    setFeedbackMsg({
      type: 'success',
      text: _t(
        `تمت استعادة الدومين الافتراضي: ${cleaned}`,
        `Reset to default domain: ${cleaned}`,
        `Standard-Domain wiederhergestellt: ${cleaned}`
      )
    });
  };

  useEffect(() => {
    const unsubAuth = subscribeTeacherAuth((u) => {
      setFirebaseUser(u);
      if (u) {
        downloadWorkspaceFromGoogleCloud()
          .then((res) => {
            if (res.summary) setCloudSummary(res.summary);
            if (res.remoteTimestampIso && !getLastCloudSyncTime()) {
              setLastSyncTime(res.remoteTimestampIso);
            }
          })
          .catch(() => {});
      } else {
        setCloudSummary(null);
      }
    });

    const handleConfigChange = () => {
      setAutoSync(isAutoCloudSyncEnabled());
      setLastSyncTime(getLastCloudSyncTime());
    };

    const handleStatusEvent = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.status) {
        setSyncStatus(custom.detail.status);
        setLastSyncTime(getLastCloudSyncTime());
      }
    };

    window.addEventListener('gluck-cloud-sync-config-changed', handleConfigChange);
    window.addEventListener('gluck-cloud-sync-status', handleStatusEvent);

    return () => {
      unsubAuth();
      window.removeEventListener('gluck-cloud-sync-config-changed', handleConfigChange);
      window.removeEventListener('gluck-cloud-sync-status', handleStatusEvent);
    };
  }, []);

  const handleToggleAutoSync = () => {
    const next = !autoSync;
    setAutoSync(next);
    setAutoCloudSyncEnabled(next);
    if (triggerToast) {
      triggerToast(
        next
          ? _t(
              'تم تفعيل المزامنة اللحظية التلقائية عبر حساب Google',
              'Automatic Google Cloud sync enabled',
              'Automatische Google Cloud-Synchronisierung aktiviert'
            )
          : _t(
              'تم إيقاف المزامنة التلقائية بالخلفية (يمكنك المزامنة يدوياً)',
              'Background auto-sync paused',
              'Automatische Hintergrundsynchronisierung pausiert'
            )
      );
    }
  };

  const executePostLoginSync = async (user: any) => {
    try {
      const remote = await downloadWorkspaceFromGoogleCloud();
      if (remote.summary) setCloudSummary(remote.summary);

      const localHasData =
        students.length > 0 ||
        groups.length > 0 ||
        lessons.length > 0 ||
        payments.length > 0;

      if (!remote.hasRemoteData && localHasData) {
        const snapStr = await performBackup();
        const upRes = await uploadWorkspaceToGoogleCloud(snapStr);
        if (upRes.success) {
          setLastSyncTime(upRes.syncedAtIso);
        }
      } else if (remote.hasRemoteData && remote.backupJsonStr && !localHasData) {
        await importBackupFile(remote.backupJsonStr);
        setLastSyncTime(remote.remoteTimestampIso);
      }

      setFeedbackMsg({
        type: 'success',
        text: _t(
          `تم ربط الحساب (${user.email || 'المعلم'}) وتفعيل المزامنة الشاملة بنجاح`,
          `Connected account (${user.email || 'Teacher'}) and enabled full sync`,
          `Konto (${user.email || 'Lehrer'}) erfolgreich verbunden`
        )
      });
    } catch (syncErr: any) {
      console.warn('Post login sync warning:', syncErr);
    }
  };

  const handleInAppDirectSignIn = async (emailToUse: string, passToUse?: string) => {
    setActionLoading('in_app_login');
    setFeedbackMsg(null);
    try {
      const targetEmail = (emailToUse && emailToUse.trim()) || teacherEmail;
      const targetPass = (passToUse && passToUse.trim()) || 'gluck_teacher_2026!';
      const user = await signInTeacherWithEmailPassword(targetEmail, targetPass);
      if (user) {
        setShowInAppAuthModal(false);
        await executePostLoginSync(user);
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text:
          err?.message ||
          _t('تعذر تسجيل الدخول المباشر. يرجى التأكد من البريد والرمز السري.', 'Direct sign in failed.', 'Anmeldung fehlgeschlagen.')
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setActionLoading('login');
    setFeedbackMsg(null);
    try {
      const user = await signInTeacherWithGoogle();
      if (user) {
        setShowInAppAuthModal(false);
        await executePostLoginSync(user);
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text:
          err?.message ||
          _t(
            'تعذر تسجيل الدخول عبر Google. يمكنك استخدام «دخول مباشر داخل البرنامج» لتسجيل الدخول فوراً دون مغادرة الصفحة.',
            'Failed to sign in with Google. You can use In-App Direct Sign In instead.',
            'Google-Anmeldung fehlgeschlagen. Nutzen Sie die direkte In-App-Anmeldung.'
          )
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePushToCloud = async () => {
    setActionLoading('push');
    setFeedbackMsg(null);
    setSyncStatus('syncing');
    try {
      const snapStr = await performBackup();
      const res = await uploadWorkspaceToGoogleCloud(snapStr);
      if (res.success) {
        setSyncStatus('synced');
        setLastSyncTime(res.syncedAtIso);
        setCloudSummary({
          studentsCount: students.length,
          groupsCount: groups.length,
          lessonsCount: lessons.length,
          paymentsCount: payments.length,
          financeTransactionsCount: financeTransactions.length,
          lernstudioSetsCount: lernstudioSets.length,
          hodRecordsCount: hodStudents.length + schoolNotes.length,
          updatedAtIso: res.syncedAtIso
        });
        const msg = _t(
          'تم رفع ومزامنة جميع بيانات البرنامج إلى سحابة Google بنجاح',
          'All app data uploaded to Google Cloud successfully',
          'Alle App-Daten erfolgreich in die Google Cloud hochgeladen'
        );
        setFeedbackMsg({ type: 'success', text: msg });
        if (triggerToast) triggerToast(msg);
      } else {
        setSyncStatus('error');
        setFeedbackMsg({ type: 'error', text: res.error || 'فشل رفع البيانات' });
      }
    } catch (err: any) {
      setSyncStatus('error');
      setFeedbackMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء الرفع للسحابة' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePullFromCloud = async () => {
    setActionLoading('pull');
    setFeedbackMsg(null);
    setSyncStatus('syncing');
    try {
      const res = await downloadWorkspaceFromGoogleCloud();
      if (!res.hasRemoteData || !res.backupJsonStr) {
        setSyncStatus('idle');
        setFeedbackMsg({
          type: 'error',
          text: _t(
            'لا توجد نسخة محفوظة في سحابة جوجل لهذا الحساب بعد. اضغط «رفع بيانات هذا الجهاز للسحابة» أولاً.',
            'No cloud backup found for this Google account yet. Click Upload first.',
            'Noch keine Cloud-Daten für dieses Konto vorhanden.'
          )
        });
        return;
      }

      const imported = await importBackupFile(res.backupJsonStr);
      if (imported) {
        setSyncStatus('synced');
        if (res.summary) setCloudSummary(res.summary);
        if (res.remoteTimestampIso) setLastSyncTime(res.remoteTimestampIso);
        const msg = _t(
          'تم استرجاع وتحديث جميع بيانات البرنامج من سحابة Google بنجاح',
          'All app data restored from Google Cloud successfully',
          'Alle Daten erfolgreich aus der Google Cloud wiederhergestellt'
        );
        setFeedbackMsg({ type: 'success', text: msg });
        if (triggerToast) triggerToast(msg);
      } else {
        setSyncStatus('error');
        setFeedbackMsg({
          type: 'error',
          text: _t('تعذر تطبيق البيانات المسترجعة', 'Failed to apply cloud data', 'Fehler beim Anwenden')
        });
      }
    } catch (err: any) {
      setSyncStatus('error');
      setFeedbackMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء الاسترجاع من السحابة' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSmartSyncNow = async () => {
    setActionLoading('sync');
    setFeedbackMsg(null);
    setSyncStatus('syncing');
    try {
      const remote = await downloadWorkspaceFromGoogleCloud();
      const localHasData =
        students.length > 0 ||
        groups.length > 0 ||
        lessons.length > 0 ||
        payments.length > 0 ||
        financeTransactions.length > 0;

      // If local device is empty and cloud has data, pull from cloud
      if (remote.hasRemoteData && remote.backupJsonStr && !localHasData) {
        await importBackupFile(remote.backupJsonStr);
        if (remote.summary) setCloudSummary(remote.summary);
        setSyncStatus('synced');
        setFeedbackMsg({
          type: 'success',
          text: _t(
            'تم سحب جميع بياناتك من سحابة Google إلى هذا الجهاز بنجاح',
            'Pulled all your data from Google Cloud to this device',
            'Alle Daten aus der Google Cloud synchronisiert'
          )
        });
      } else {
        // Upload latest state from this device to Google Cloud
        const snapStr = await performBackup();
        const upRes = await uploadWorkspaceToGoogleCloud(snapStr);
        if (upRes.success) {
          setSyncStatus('synced');
          setLastSyncTime(upRes.syncedAtIso);
          setCloudSummary({
            studentsCount: students.length,
            groupsCount: groups.length,
            lessonsCount: lessons.length,
            paymentsCount: payments.length,
            financeTransactionsCount: financeTransactions.length,
            lernstudioSetsCount: lernstudioSets.length,
            hodRecordsCount: hodStudents.length + schoolNotes.length,
            updatedAtIso: upRes.syncedAtIso
          });
          setFeedbackMsg({
            type: 'success',
            text: _t(
              'تمت المزامنة الشاملة مع حساب Google بنجاح (الطلاب، الحصص، الماليات، الإعدادات، والألعاب)',
              'Full Google Cloud sync completed successfully',
              'Vollständige Google Cloud-Synchronisierung abgeschlossen'
            )
          });
        } else {
          setSyncStatus('error');
          setFeedbackMsg({ type: 'error', text: upRes.error || 'تعذرت المزامنة' });
        }
      }
    } catch (err: any) {
      setSyncStatus('error');
      setFeedbackMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء المزامنة الفورية' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="bg-surface border border-surface-border rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-text-main">
              {_t(
                'المزامنة السحابية الشاملة بحساب Google',
                'Full Google Account Cloud Sync',
                'Vollständige Google Cloud-Synchronisierung'
              )}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {_t(
                'مزامنة تلقائية للطلاب، المجموعات، الحصص، المدفوعات، الماليات، الشهادات، ملاحظات المدرسة، الإعدادات، والليرن ستوديو',
                'Automatic sync for students, groups, lessons, payments, finance, certificates, HOD, settings & Lernstudio',
                'Automatische Synchronisierung aller Schüler, Lektionen, Finanzen, Einstellungen und Lernstudio'
              )}
            </p>
          </div>
        </div>

        {/* Unboxed Status Metadata */}
        {firebaseUser && (
          <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
            {syncStatus === 'syncing' || actionLoading ? (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{_t('جاري المزامنة...', 'Syncing...', 'Synchronisiere...')}</span>
              </span>
            ) : syncStatus === 'error' ? (
              <span className="text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{_t('تنبيه في المزامنة', 'Sync notice', 'Sync-Hinweis')}</span>
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{_t('متصل بسحابة Google', 'Connected to Google Cloud', 'Mit Google Cloud verbunden')}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Signed-Out View vs Signed-In View */}
      {!firebaseUser ? (
        <div className="pt-3 border-t border-surface-border space-y-3.5">
          <div className="p-3.5 rounded-2xl bg-surface/60 border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-text-main">
                  {_t('حساب المعلم للمزامنة:', 'Teacher Sync Account:', 'Lehrerkonto für Sync:')}
                </span>
                <code className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                  {teacherEmail}
                </code>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {_t(
                  'احفظ وزامن كل بياناتك السحابية فوراً بين الكمبيوتر والموبايل والطلاب بدون مغادرة البرنامج.',
                  'Sync your full workspace across computer, phone, and students directly inside the app.',
                  'Synchronisieren Sie alle Daten direkt in der App.'
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Option 1: Direct in-app 1-click login without any popup */}
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() => handleInAppDirectSignIn(teacherEmail)}
                className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs whitespace-nowrap active:scale-98"
                title={_t('دخول فوري مباشر وتفعيل المزامنة دون أي نوافذ خارجية', 'Instant in-app sync without leaving the app', 'Sofort in der App synchronisieren')}
              >
                {actionLoading === 'in_app_login' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>{_t('دخول مباشر داخل البرنامج', 'In-App Direct Sign In', 'Direkt in App anmelden')}</span>
              </button>

              {/* Option 2: Google OAuth Popup */}
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={handleGoogleSignIn}
                className="px-3.5 py-2.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-98"
                title={_t('تسجيل الدخول عبر نافذة حساب Google', 'Sign in with Google OAuth', 'Mit Google-Konto anmelden')}
              >
                {actionLoading === 'login' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4 text-primary" />
                )}
                <span>{_t('حساب Google', 'Google Account', 'Google-Konto')}</span>
              </button>

              {/* Option 3: Custom Login Details Sheet */}
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() => setShowInAppAuthModal(true)}
                className="p-2.5 text-text-muted hover:text-text-main border border-surface-border hover:border-primary/40 rounded-xl transition-colors cursor-pointer"
                title={_t('تخصيص البريد والرمز السري', 'Customize Email / PIN', 'E-Mail & PIN anpassen')}
              >
                <KeyRound className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-3 border-t border-surface-border">
          {/* Account Info + Auto-Sync Switch */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-hover/50 p-3 rounded-xl border border-surface-border">
            <div className="flex items-center gap-3 min-w-0">
              {firebaseUser.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={firebaseUser.displayName || 'Google'}
                  className="w-9 h-9 rounded-full object-cover border border-surface-border shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary text-white font-black text-sm flex items-center justify-center shrink-0">
                  {(firebaseUser.displayName || firebaseUser.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-text-main truncate">
                  {firebaseUser.displayName || _t('حساب المعلم', 'Teacher Account', 'Lehrerkonto')}
                </div>
                <div className="text-[11px] font-mono text-text-muted truncate" dir="ltr">
                  {firebaseUser.email}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Auto-Sync Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-bold text-text-main">
                  {_t('مزامنة لحظية تلقائية', 'Real-time Auto-Sync', 'Auto-Sync')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoSync}
                  onClick={handleToggleAutoSync}
                  className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                    autoSync ? 'bg-emerald-600' : 'bg-slate-400 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`block w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                      autoSync ? 'translate-x-4.5 rtl:-translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>

              <button
                type="button"
                onClick={() => signOutTeacherFirebase()}
                className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                title={_t('تسجيل الخروج من حساب جوجل', 'Sign out of Google', 'Abmelden')}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{_t('خروج', 'Sign Out', 'Abmelden')}</span>
              </button>
            </div>
          </div>

          {/* Unboxed Metadata Summary Line (Zero-Pill Discipline + Tabular Numerals) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted tabular-nums">
            <div className="flex flex-wrap items-center gap-1.5">
              <span>
                {_t('الطلاب:', 'Students:', 'Schüler:')}{' '}
                <strong className="text-text-main">{cloudSummary?.studentsCount ?? students.length}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {_t('المجموعات:', 'Groups:', 'Gruppen:')}{' '}
                <strong className="text-text-main">{cloudSummary?.groupsCount ?? groups.length}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {_t('الحصص:', 'Lessons:', 'Lektionen:')}{' '}
                <strong className="text-text-main">{cloudSummary?.lessonsCount ?? lessons.length}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {_t('المدفوعات:', 'Payments:', 'Zahlungen:')}{' '}
                <strong className="text-text-main">{cloudSummary?.paymentsCount ?? payments.length}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {_t('المعاملات المالية:', 'Finance:', 'Finanzen:')}{' '}
                <strong className="text-text-main">
                  {cloudSummary?.financeTransactionsCount ?? financeTransactions.length}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {_t('مجموعات الليرن ستوديو:', 'Lernstudio Sets:', 'Lernstudio-Sets:')}{' '}
                <strong className="text-text-main">{cloudSummary?.lernstudioSetsCount ?? lernstudioSets.length}</strong>
              </span>
            </div>

            {lastSyncTime && (
              <div className="text-[11px] font-mono text-text-muted tabular-nums">
                {_t('آخر مزامنة سحابية:', 'Last cloud sync:', 'Letzte Cloud-Sync:')}{' '}
                {new Date(lastSyncTime).toLocaleString('ar-EG', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>

          {/* Instant Action Buttons */}
          {!compact && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={handleSmartSyncNow}
                className="py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 ${actionLoading === 'sync' ? 'animate-spin' : ''}`} />
                <span>{_t('مزامنة شاملة الآن', 'Sync Everything Now', 'Jetzt alles synchronisieren')}</span>
              </button>

              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={handlePushToCloud}
                className="py-2.5 px-4 bg-surface hover:bg-surface-hover border border-surface-border disabled:opacity-50 text-text-main font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-4 h-4 text-primary" />
                <span>{_t('رفع بيانات هذا الجهاز للسحابة', 'Upload Device to Cloud', 'Gerät in Cloud hochladen')}</span>
              </button>

              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={handlePullFromCloud}
                className="py-2.5 px-4 bg-surface hover:bg-surface-hover border border-surface-border disabled:opacity-50 text-text-main font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-emerald-500" />
                <span>{_t('استرجاع البيانات من السحابة', 'Restore from Cloud', 'Aus Cloud wiederherstellen')}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Vercel Public Domain Integration Section */}
      <div className="p-3.5 bg-surface/60 border border-surface-border rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="font-bold text-text-main flex items-center gap-2">
              <span>{_t('دومين منصة الطلاب والواجبات (Vercel)', 'Student Platform Domain (Vercel)', 'Vercel-Domain für Schüler')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                {_t('مربوط تلقائياً', 'Auto Connected', 'Verbunden')}
              </span>
            </div>
            <p className="text-[11px] text-text-muted">
              {_t(
                'الرابط الأساسي لإنشاء روابط الواجبات وتدريبات الطلاب لأولياء الأمور',
                'Domain used when generating parent/student homework links',
                'Domain für Hausaufgaben-Links'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isEditingDomain ? (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <input
                type="text"
                dir="ltr"
                value={customVercelDomain}
                onChange={(e) => setCustomVercelDomain(e.target.value)}
                className="px-2.5 py-1 bg-surface border border-primary/50 rounded-lg text-xs font-mono text-text-main outline-none w-full sm:w-64"
                placeholder="https://..."
              />
              <button
                type="button"
                onClick={handleSaveVercelDomain}
                className="px-2.5 py-1 bg-primary text-white font-bold rounded-lg text-xs cursor-pointer hover:bg-primary-hover whitespace-nowrap"
              >
                {_t('حفظ', 'Save', 'Speichern')}
              </button>
              <button
                type="button"
                onClick={handleResetVercelDomain}
                title={_t('استعادة الافتراضي', 'Reset to Default', 'Zurücksetzen')}
                className="p-1 text-text-muted hover:text-text-main cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <code dir="ltr" className="font-mono text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md truncate max-w-[220px]">
                {vercelDomain}
              </code>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={vercelDomain}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-text-muted hover:text-primary transition-colors cursor-pointer"
                  title={_t('فتح الرابط وتجربته', 'Open link', 'Link öffnen')}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setCustomVercelDomain(vercelDomain);
                    setIsEditingDomain(true);
                  }}
                  className="p-1.5 text-text-muted hover:text-primary transition-colors cursor-pointer"
                  title={_t('تعديل الرابط', 'Edit Domain', 'Domain bearbeiten')}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-current opacity-70 hover:opacity-100 cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      )}
      {/* In-App Authentication & Account Picker Modal */}
      {showInAppAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-text-main">
                    {_t('تسجيل الدخول والمزامنة السحابية', 'Sign In & Cloud Sync', 'Anmeldung & Cloud-Sync')}
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    {_t('مزامنة بيانات التطبيق بالكامل داخل البرنامج', 'Sync app data seamlessly in-app', 'Daten direkt in der App synchronisieren')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInAppAuthModal(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex rounded-xl bg-surface-hover/70 p-1 border border-surface-border text-xs font-bold">
              <button
                type="button"
                onClick={() => setAuthTab('in_app')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'in_app'
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{_t('دخول مباشر (داخل التطبيق)', 'Direct In-App', 'Direkt in App')}</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthTab('google')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'google'
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{_t('حساب Google', 'Google Account', 'Google-Konto')}</span>
              </button>
            </div>

            {/* Tab 1: In-App Direct Sign-In */}
            {authTab === 'in_app' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleInAppDirectSignIn(authEmailInput, authPasswordInput);
                }}
                className="space-y-3 pt-1 text-xs"
              >
                <div className="space-y-1">
                  <label className="font-bold text-text-main flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>{_t('البريد الإلكتروني للمعلم', 'Teacher Email', 'Lehrer-E-Mail')}</span>
                  </label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={authEmailInput}
                    onChange={(e) => setAuthEmailInput(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-text-main font-mono text-xs outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-text-main flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" />
                    <span>{_t('الرمز السري / كلمة المرور', 'PIN or Password', 'PIN oder Passwort')}</span>
                  </label>
                  <input
                    type="password"
                    required
                    dir="ltr"
                    value={authPasswordInput}
                    onChange={(e) => setAuthPasswordInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-text-main font-mono text-xs outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-text-muted">
                    {_t(
                      'يتم حفظ ومزامنة بياناتك السحابية فوراً دون مغادرة التطبيق ودون فتح أي نوافذ خارجية.',
                      'Your data syncs in-app without any external browser popups.',
                      'Synchronisierung erfolgt direkt ohne externe Fenster.'
                    )}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                >
                  {actionLoading === 'in_app_login' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{_t('تسجيل الدخول والمزامنة الفورية', 'Sign In & Sync Now', 'Jetzt anmelden & synchronisieren')}</span>
                </button>
              </form>
            ) : (
              /* Tab 2: Google OAuth */
              <div className="space-y-3.5 pt-2 text-xs">
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {_t(
                    'تسجيل الدخول الرسمي بحساب Google. سيقوم المتصفح بطلب إذن الدخول بحسابك على جهازك، ثم يعود تلقائياً فور تأكيدك.',
                    'Official Google Sign-In. Your device will prompt you to select your Google account, then return here immediately.',
                    'Offizielle Google-Anmeldung.'
                  )}
                </p>

                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                >
                  {actionLoading === 'login' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4 text-primary" />
                  )}
                  <span>{_t('المتابعة باختيار حساب Google', 'Continue with Google Account', 'Mit Google fortfahren')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
