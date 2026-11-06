import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  signInTeacherWithGoogle,
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
  DEFAULT_VERCEL_DOMAIN,
  signInWithCloudEmailDirect
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
  RotateCcw
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
    _t
  } = useApp();

  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [autoSync, setAutoSync] = useState<boolean>(() => isAutoCloudSyncEnabled());
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastCloudSyncTime());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [actionLoading, setActionLoading] = useState<'sync' | 'push' | 'pull' | 'login' | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cloudSummary, setCloudSummary] = useState<CloudSyncSummary | null>(null);
  const [showUnauthorizedDomainHelper, setShowUnauthorizedDomainHelper] = useState(false);
  const [directCloudEmail, setDirectCloudEmail] = useState('zusammennachdeutschland@gmail.com');
  const [domainCopied, setDomainCopied] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setActionLoading('login');
    setFeedbackMsg(null);
    setShowUnauthorizedDomainHelper(false);
    try {
      const user = await signInTeacherWithGoogle();
      if (user) {
        await executePostLoginSync(user);
      }
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || String(err);
      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        setShowUnauthorizedDomainHelper(true);
      } else if (msg.includes('missing initial state') || msg.includes('sessionStorage')) {
        setFeedbackMsg({
          type: 'error',
          text: _t(
            'تنبيه: المتصفح يمنع وصول الـ Session Storage. تم تفعيل التزامن الذكي، اضغط على زر تسجيل الدخول بجوجل مرة أخرى الآن.',
            'Browser restricted sessionStorage. Adaptive mode enabled, click Google sign-in again.',
            'Anmeldung fehlgeschlagen. Bitte erneut versuchen.'
          )
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text:
            err?.message ||
            _t(
              'تعذر تسجيل الدخول بحساب Google. يرجى التأكد من السماح بالنوافذ المنبثقة.',
              'Failed to sign in with Google. Please allow popups.',
              'Google-Anmeldung fehlgeschlagen.'
            )
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDirectCloudEmailSignIn = async () => {
    setActionLoading('login');
    setFeedbackMsg(null);
    try {
      const vUser = await signInWithCloudEmailDirect(directCloudEmail);
      await executePostLoginSync(vUser);
      setShowUnauthorizedDomainHelper(false);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'تعذر ربط البريد الإلكتروني السحابي'
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
        <div className="pt-3 border-t border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="text-xs text-text-muted leading-relaxed max-w-xl">
            {_t(
              'سجّل الدخول بحساب Google الخاص بك لتفعيل المزامنة السحابية الشاملة وحفظ ومزامنة كل بيانات البرنامج تلقائياً بين الكمبيوتر والموبايل.',
              'Sign in with your Google account to automatically sync all app data across your computer, phone, and Vercel.',
              'Melden Sie sich mit Ihrem Google-Konto an, um alle Daten automatisch zwischen Ihren Geräten zu synchronisieren.'
            )}
          </div>

          <button
            type="button"
            disabled={actionLoading === 'login'}
            onClick={handleGoogleSignIn}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xs whitespace-nowrap active:scale-98 shrink-0"
          >
            {actionLoading === 'login' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span>{_t('تسجيل الدخول بحساب Google', 'Sign in with Google', 'Mit Google anmelden')}</span>
          </button>

          {showUnauthorizedDomainHelper && (
            <div className="w-full mt-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2.5">
              <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                ⚡ {_t('ربط الحساب السحابي المباشر (لدومينات Vercel والهاتف)', 'Direct Cloud Email Sync (For Vercel/Mobile)', 'Direkte Cloud-E-Mail-Verknüpfung')}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  dir="ltr"
                  value={directCloudEmail}
                  onChange={(e) => setDirectCloudEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="flex-1 px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono text-text-main outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  disabled={actionLoading === 'login' || !directCloudEmail.trim()}
                  onClick={handleDirectCloudEmailSignIn}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer shrink-0"
                >
                  {_t('ربط الحساب والمزامنة الآن', 'Link & Sync Now', 'Jetzt verbinden')}
                </button>
              </div>
              <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span>
                  {_t('أو أضف هذا الدومين في Firebase:', 'Or add this domain in Firebase:', 'Oder Domain in Firebase hinzufügen:')}{' '}
                  <code className="font-mono font-bold text-text-main bg-surface px-1.5 py-0.5 rounded">
                    {typeof window !== 'undefined' ? window.location.hostname : ''}
                  </code>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard?.writeText(window.location.hostname);
                        setDomainCopied(true);
                        setTimeout(() => setDomainCopied(false), 2000);
                      }
                    }}
                    className="px-2.5 py-1 bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold rounded-lg cursor-pointer"
                  >
                    {domainCopied ? _t('تم النسخ ✓', 'Copied ✓', 'Kopiert ✓') : _t('نسخ الدومين', 'Copy Domain', 'Domain kopieren')}
                  </button>
                  <a
                    href="https://console.firebase.google.com/project/glueck-c8621/authentication/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-primary/15 text-primary font-bold rounded-lg hover:underline"
                  >
                    {_t('إعدادات Firebase ↗', 'Firebase Settings ↗', 'Firebase ↗')}
                  </a>
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
};
