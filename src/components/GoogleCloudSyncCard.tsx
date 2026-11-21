import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Globe,
  ExternalLink,
  Edit3,
  RotateCcw,
  Trash2,
  ShieldAlert,
  LogIn,
  Upload
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  signInTeacherWithGoogle,
  signInTeacherWithEmailPassword,
  createTeacherWithEmailPassword,
  signOutTeacherFirebase,
  subscribeTeacherAuth,
  getVercelPublicDomain,
  setVercelPublicDomain,
  DEFAULT_VERCEL_DOMAIN,
  clearCloudWorkspaceData,
  isAndroidNativePlatform,
  getLastAndroidAuthDiagnostic,
  getAndroidApkSigningInfo,
  AndroidApkSigningInfo,
  isFirestoreReadQuotaExhausted,
  isFirestoreWriteQuotaExhaustedToday
} from '../services/firebaseWorkspaceSync';
import {
  flushPendingHomeworkCloudWrites,
  getPendingHomeworkSyncCount,
  getHomeworkSummaryStats,
  syncAndFetchTeacherAssignments,
  migrateLegacyHomeworkForAccount
} from '../shared/homeworkStorageSync';

interface GoogleCloudSyncCardProps {
  compact?: boolean;
}

export const GoogleCloudSyncCard: React.FC<GoogleCloudSyncCardProps> = ({ compact = false }) => {
  const {
    students,
    groups,
    lernstudioSets,
    profile,
    updateProfile,
    triggerToast,
    _t
  } = useApp();

  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<
    'sync_hw' | 'flush_hw' | 'login' | 'email_login' | 'clear' | null
  >(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showUnauthorizedDomainHelper, setShowUnauthorizedDomainHelper] = useState(false);
  const [domainCopied, setDomainCopied] = useState(false);
  const [showAndroidShaHelper, setShowAndroidShaHelper] = useState(false);
  const [androidSigningInfo, setAndroidSigningInfo] = useState<AndroidApkSigningInfo | null>(null);
  const [shaCopiedField, setShaCopiedField] = useState<'sha1' | 'sha256' | 'pkg' | null>(null);
  const [showEmailLoginFallback, setShowEmailLoginFallback] = useState(false);
  const [cloudEmailInput, setCloudEmailInput] = useState<string>(
    () => profile.email || 'zusammennachdeutschland@gmail.com'
  );
  const [cloudPasswordInput, setCloudPasswordInput] = useState<string>('');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const [hwStats, setHwStats] = useState(() => getHomeworkSummaryStats(students));
  const [pendingHwCount, setPendingHwCount] = useState<number>(() => getPendingHomeworkSyncCount());

  // Vercel Public Domain state (for parent/student homework links)
  const [vercelDomain, setVercelDomainState] = useState<string>(() => getVercelPublicDomain());
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [customVercelDomain, setCustomVercelDomain] = useState<string>(vercelDomain);

  const refreshLocalHomeworkCounters = (uidOverride?: string | null) => {
    setHwStats(getHomeworkSummaryStats(students));
    setPendingHwCount(getPendingHomeworkSyncCount(uidOverride));
  };

  useEffect(() => {
    refreshLocalHomeworkCounters(firebaseUser?.uid);
  }, [students.length, firebaseUser?.uid]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshLocalHomeworkCounters(firebaseUser?.uid);
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshLocalHomeworkCounters(firebaseUser?.uid);
    };
    const handleHwSyncUpdated = () => {
      refreshLocalHomeworkCounters(firebaseUser?.uid);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('glueck-homework-sync-updated', handleHwSyncUpdated);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('glueck-homework-sync-updated', handleHwSyncUpdated);
    };
  }, [firebaseUser?.uid, students]);

  useEffect(() => {
    const unsubAuth = subscribeTeacherAuth(async (u) => {
      setFirebaseUser(u);
      if (u) {
        const updates: Record<string, any> = { isGoogleConnected: true };
        if (
          u.displayName &&
          (!profile.displayName ||
            profile.displayName === 'Teacher' ||
            profile.displayName === 'أ. أحمد محمود')
        ) {
          updates.displayName = u.displayName;
          updates.displayNameAr = u.displayName;
          updates.displayNameEn = u.displayName;
        }
        if (u.email && !profile.email) {
          updates.email = u.email;
        }
        if (u.photoURL && !profile.avatarUrl) {
          updates.avatarUrl = u.photoURL;
        }
        updateProfile(updates);

        migrateLegacyHomeworkForAccount({
          uid: u.uid,
          email: u.email,
          ownedGroupIds: groups.map((g) => g.id),
          ownedSetIds: lernstudioSets.map((s) => s.id),
          ownedStudentIds: students.map((st) => st.id)
        });
      }
      refreshLocalHomeworkCounters(u?.uid || null);
    });

    return () => {
      unsubAuth();
    };
  }, []);

  const handleSaveVercelDomain = () => {
    const updated = setVercelPublicDomain(customVercelDomain);
    setVercelDomainState(updated);
    setCustomVercelDomain(updated);
    setIsEditingDomain(false);
    const msg = _t(
      'تم حفظ رابط منصة الطلاب والواجبات بنجاح',
      'Student homework domain saved successfully',
      'Schüler-Domain erfolgreich gespeichert'
    );
    setFeedbackMsg({ type: 'success', text: msg });
    if (triggerToast) triggerToast(msg);
  };

  const handleResetVercelDomain = () => {
    const updated = setVercelPublicDomain(DEFAULT_VERCEL_DOMAIN);
    setVercelDomainState(updated);
    setCustomVercelDomain(updated);
    setIsEditingDomain(false);
  };

  const executePostLoginHomeworkAuth = async (user: any) => {
    const nameToUse = (
      user.displayName ||
      profile.displayName ||
      user.email?.split('@')[0] ||
      'Teacher'
    ).trim();
    const emailToUse = (user.email || profile.email || '').trim();
    const photoToUse = user.photoURL || profile.avatarUrl || '';

    setShowAndroidShaHelper(false);
    setShowEmailLoginFallback(false);

    updateProfile({
      displayName: nameToUse,
      displayNameAr: profile.displayNameAr || nameToUse,
      displayNameEn: profile.displayNameEn || nameToUse,
      email: emailToUse,
      avatarUrl: photoToUse,
      isGoogleConnected: true
    });

    try {
      if (user?.uid) {
        migrateLegacyHomeworkForAccount({
          uid: user.uid,
          email: user.email,
          ownedGroupIds: groups.map((g) => g.id),
          ownedSetIds: lernstudioSets.map((s) => s.id),
          ownedStudentIds: students.map((st) => st.id)
        });
      }
      await flushPendingHomeworkCloudWrites().catch(() => {});
      refreshLocalHomeworkCounters(user?.uid || null);
      setLastSyncTime(new Date().toISOString());

      const successText = _t(
        `تم ربط الحساب (${user.email || 'المعلم'}) بسحابة الواجبات الأونلاين بنجاح ✓`,
        `Connected account (${user.email || 'Teacher'}) to Homework Cloud ✓`,
        `Konto (${user.email || 'Lehrer'}) mit Hausaufgaben-Cloud verbunden ✓`
      );
      setFeedbackMsg({
        type: 'success',
        text: successText
      });
      if (triggerToast) {
        triggerToast(successText);
      }
    } catch (syncErr: any) {
      console.warn('Post login homework sync notice:', syncErr);
    }
  };

  const loadAndroidDiagnosticHelper = async () => {
    const diag = getLastAndroidAuthDiagnostic();
    if (diag?.apkSha1 || diag?.apkSha256) {
      setAndroidSigningInfo({
        packageName: diag.packageName || 'com.glueck.teacher',
        apkSha1: diag.apkSha1,
        apkSha256: diag.apkSha256
      });
    } else {
      const info = await getAndroidApkSigningInfo();
      if (info) {
        setAndroidSigningInfo(info);
      }
    }
    setShowAndroidShaHelper(true);
  };

  const handleGoogleSignIn = async () => {
    if (actionLoading !== null) return;
    setActionLoading('login');
    setFeedbackMsg(null);
    setShowUnauthorizedDomainHelper(false);
    try {
      const user = await signInTeacherWithGoogle();
      if (user) {
        await executePostLoginHomeworkAuth(user);
      } else if (isAndroidNativePlatform()) {
        await loadAndroidDiagnosticHelper();
        setFeedbackMsg({
          type: 'error',
          text: _t(
            'لم يكتمل تسجيل الدخول عبر نافذة Google في أندرويد. إذا اخترت الحساب وعاد البرنامج دون دخول، يرجى مراجعة بصمة SHA-1 بالأسفل أو الدخول مباشرة بالبريد وكلمة المرور السحابية.',
            'Google Sign-In did not complete on Android. Please check the SHA-1 helper below or sign in directly with your Cloud Email & Password.',
            'Google-Anmeldung unter Android nicht abgeschlossen. Bitte prüfen Sie den SHA-1-Hinweis unten.'
          )
        });
      }
    } catch (err: any) {
      const code = String(err?.code || '');
      const msg = String(err?.message || err || '');
      const isNative = isAndroidNativePlatform();

      if (isNative) {
        await loadAndroidDiagnosticHelper();
      }

      if (!isNative && (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain'))) {
        setShowUnauthorizedDomainHelper(true);
      } else if (code === 'NO_GOOGLE_ACCOUNT' || isNative) {
        setFeedbackMsg({
          type: 'error',
          text: _t(
            'يلزم تفعيل بصمة شهادة التطبيق (SHA-1) في إعدادات Firebase لتمكين زر Google السريع، أو يمكنك تسجيل الدخول فوراً بالبريد وكلمة المرور السحابية بالأسفل.',
            'Please register the app SHA-1 in Firebase settings, or sign in immediately below using your Cloud Email & Password.',
            'Bitte registrieren Sie den SHA-1-Fingerabdruck in Firebase oder melden Sie sich unten per E-Mail an.'
          )
        });
      } else if (code === 'auth/network-request-failed' || msg.toLowerCase().includes('network')) {
        setFeedbackMsg({
          type: 'error',
          text: _t(
            'تعذر الاتصال بالإنترنت لإتمام تسجيل الدخول. يرجى التحقق من الشبكة والمحاولة مرة أخرى.',
            'Network connection unavailable. Please check your internet connection and try again.',
            'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.'
          )
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text: _t(
            'تعذر إتمام تسجيل الدخول بحساب Google حالياً. يرجى المحاولة مرة أخرى.',
            'Could not complete Google Sign-In. Please try again.',
            'Google-Anmeldung fehlgeschlagen. Bitte erneut versuchen.'
          )
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmailPasswordCloudSignIn = async () => {
    const cleanEmail = cloudEmailInput.trim().toLowerCase();
    const cleanPass = cloudPasswordInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFeedbackMsg({
        type: 'error',
        text: _t(
          'يرجى إدخال البريد الإلكتروني بشكل صحيح.',
          'Please enter a valid email address.',
          'Bitte gültige E-Mail eingeben.'
        )
      });
      return;
    }
    if (cleanPass.length < 6) {
      setFeedbackMsg({
        type: 'error',
        text: _t(
          'يرجى إدخال كلمة مرور مكونة من 6 أحرف أو أرقام على الأقل.',
          'Password must be at least 6 characters.',
          'Passwort muss mindestens 6 Zeichen lang sein.'
        )
      });
      return;
    }
    if (actionLoading !== null) return;
    setActionLoading('email_login');
    setFeedbackMsg(null);
    try {
      let user = null;
      try {
        user = await signInTeacherWithEmailPassword(cleanEmail, cleanPass);
      } catch (signInErr: any) {
        const errCode = String(signInErr?.code || '');
        if (
          errCode === 'auth/user-not-found' ||
          errCode === 'auth/invalid-credential' ||
          errCode === 'auth/invalid-login-credentials'
        ) {
          user = await createTeacherWithEmailPassword(cleanEmail, cleanPass);
        } else {
          throw signInErr;
        }
      }
      if (user) {
        setCloudPasswordInput('');
        await executePostLoginHomeworkAuth(user);
      }
    } catch (err: any) {
      const errCode = String(err?.code || '');
      if (errCode === 'auth/email-already-in-use' || errCode === 'auth/wrong-password') {
        setFeedbackMsg({
          type: 'error',
          text: _t(
            'كلمة المرور غير مطابقة لهذا البريد، أو أن هذا البريد مسجل عبر Google فقط (يرجى إضافة بصمة SHA-1 في Firebase لتسجيل الدخول بزر Google).',
            'Incorrect password, or this email is linked with Google Sign-In only (add the SHA-1 below in Firebase Console to use Google login).',
            'Falsches Passwort oder Konto ist nur mit Google-Login verknüpft.'
          )
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text:
            err?.message ||
            _t('تعذر تسجيل الدخول بالبريد وكلمة المرور.', 'Email sign-in failed.', 'Anmeldung fehlgeschlagen.')
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncHomeworkNow = async () => {
    if (actionLoading !== null) return;
    setActionLoading('sync_hw');
    setFeedbackMsg(null);
    setSyncStatus('syncing');
    try {
      await flushPendingHomeworkCloudWrites();
      await syncAndFetchTeacherAssignments(students, { force: true });
      refreshLocalHomeworkCounters(firebaseUser?.uid);
      const nowIso = new Date().toISOString();
      setLastSyncTime(nowIso);
      setSyncStatus('synced');
      const msg = _t(
        'تم تحديث ومزامنة الواجبات ونتائج الطلاب من سحابة الواجبات بنجاح ✓',
        'Homework assignments and student results synced successfully ✓',
        'Hausaufgaben und Schülerergebnisse erfolgreich synchronisiert ✓'
      );
      setFeedbackMsg({ type: 'success', text: msg });
      if (triggerToast) triggerToast(msg);
    } catch (err: any) {
      setSyncStatus('error');
      setFeedbackMsg({
        type: 'error',
        text: err?.message || _t('تعذر تحديث الواجبات من السحابة حالياً.', 'Failed to sync homework from cloud.', 'Fehler bei der Hausaufgaben-Synchronisierung.')
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFlushPendingHomework = async () => {
    if (actionLoading !== null) return;
    setActionLoading('flush_hw');
    setFeedbackMsg(null);
    setSyncStatus('syncing');
    try {
      const res = await flushPendingHomeworkCloudWrites();
      refreshLocalHomeworkCounters(firebaseUser?.uid);
      setLastSyncTime(new Date().toISOString());
      setSyncStatus(res.remainingPending === 0 ? 'synced' : 'idle');
      const msg =
        res.remainingPending === 0
          ? _t(
              `تم رفع كافة الواجبات والنتائج المعلقة للسحابة بنجاح (${res.syncedAssignments + res.syncedSubmissions} عنصر) ✓`,
              `Flushed all pending homework items to cloud (${res.syncedAssignments + res.syncedSubmissions}) ✓`,
              `Alle ausstehenden Hausaufgaben hochgeladen ✓`
            )
          : _t(
              `تم رفع ${res.syncedAssignments + res.syncedSubmissions} عنصر، ويتبقى ${res.remainingPending} بانتظار الشبكة.`,
              `Uploaded ${res.syncedAssignments + res.syncedSubmissions} items, ${res.remainingPending} remaining.`,
              `${res.remainingPending} Elemente verbleibend.`
            );
      setFeedbackMsg({ type: res.remainingPending === 0 ? 'success' : 'error', text: msg });
      if (triggerToast) triggerToast(msg);
    } catch (err: any) {
      setSyncStatus('error');
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'تعذر رفع الواجبات المعلقة حالياً.'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearCloudData = async () => {
    setActionLoading('clear');
    setFeedbackMsg(null);
    try {
      const res = await clearCloudWorkspaceData();
      if (res.success) {
        const msg = _t(
          `تم تنظيف بيانات مساحة العمل السحابية القديمة بنجاح (تم حذف ${res.deletedCount} جزء). بيانات جهازك المحلية والواجبات المنشورة للطلاب محفوظة تماماً.`,
          `Legacy cloud workspace cleared (${res.deletedCount} chunks removed). Local device data and published homework remain safe.`,
          `Alter Cloud-Arbeitsbereich bereinigt. Lokale Daten und Hausaufgaben bleiben erhalten.`
        );
        setFeedbackMsg({ type: 'success', text: msg });
        if (triggerToast) triggerToast(msg);
      } else {
        setFeedbackMsg({
          type: 'error',
          text: res.error || _t('تعذر تنظيف بيانات السحابة.', 'Failed to clear cloud workspace.', 'Fehler beim Löschen.')
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء تنظيف بيانات السحابة.'
      });
    } finally {
      setActionLoading(null);
      setShowClearConfirmModal(false);
    }
  };

  const quotaCooldownActive =
    isFirestoreReadQuotaExhausted() || isFirestoreWriteQuotaExhaustedToday();
  const homeworkCloudAvailable = Boolean(firebaseUser && isOnline && !quotaCooldownActive);

  return (
    <div className="bg-surface border border-surface-border rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            {homeworkCloudAvailable ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-text-main">
              {_t(
                'سحابة الواجبات الأونلاين وحساب المعلم (Homework Cloud)',
                'Online Homework Cloud & Teacher Auth',
                'Online-Hausaufgaben-Cloud & Lehrer-Login'
              )}
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              {_t(
                'مخصصة حصرياً لنشر روابط الواجبات واستقبال حلول الطلاب أونلاين — بينما تتم مزامنة بيانات التطبيق بين أجهزتك عبر P2P',
                'Dedicated strictly to publishing online homework & receiving student results — general app data syncs via P2P',
                'Ausschließlich für Online-Hausaufgaben — allgemeine App-Daten werden über P2P synchronisiert'
              )}
            </p>
          </div>
        </div>

        {/* Unboxed Status Metadata */}
        <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
          {syncStatus === 'syncing' || actionLoading ? (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{_t('جاري مزامنة الواجبات...', 'Syncing homework...', 'Synchronisiere...')}</span>
            </span>
          ) : !firebaseUser || !isOnline || quotaCooldownActive ? (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {!firebaseUser
                  ? _t('سحابة الواجبات غير متصلة (سجّل الدخول)', 'Homework cloud unavailable (Sign in)', 'Hausaufgaben-Cloud getrennt')
                  : !isOnline
                  ? _t('سحابة الواجبات غير متاحة (بدون إنترنت)', 'Homework cloud unavailable (Offline)', 'Hausaufgaben-Cloud offline')
                  : _t('سحابة الواجبات في تهدئة مؤقتة', 'Homework cloud on quota cooldown', 'Cloud-Cooldown aktiv')}
              </span>
            </span>
          ) : pendingHwCount > 0 ? (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>
                {_t(
                  `سحابة الواجبات متصلة (${pendingHwCount} بانتظار الرفع)`,
                  `Homework cloud connected (${pendingHwCount} pending)`,
                  `Hausaufgaben-Cloud verbunden (${pendingHwCount} ausstehend)`
                )}
              </span>
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {_t(
                  'سحابة الواجبات متصلة وجاهزة',
                  'Homework cloud connected',
                  'Hausaufgaben-Cloud verbunden'
                )}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Signed-Out View vs Signed-In View */}
      {!firebaseUser ? (
        <div className="pt-3 border-t border-surface-border space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actionLoading !== null}
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
              <span>{_t('تسجيل الدخول بحساب Google للواجبات', 'Sign in with Google for Homework', 'Mit Google anmelden')}</span>
            </button>

            {isAndroidNativePlatform() && (
              <button
                type="button"
                onClick={() => {
                  loadAndroidDiagnosticHelper();
                  setShowEmailLoginFallback((prev) => !prev);
                }}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-primary" />
                <span>{_t('مساعد دخول أندرويد / SHA-1', 'Android Login Helper / SHA-1', 'Android Login-Hilfe')}</span>
              </button>
            )}
          </div>

          {(showAndroidShaHelper || showEmailLoginFallback) && (
            <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                    📱 {_t('تفعيل دخول Google على أندرويد (بصمة SHA-1) + الدخول المباشر', 'Android Google Sign-In SHA-1 Setup & Direct Login', 'Android Google-Anmeldung SHA-1 & Direkt-Login')}
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {_t(
                      'عند اختيار حساب Google في أندرويد وعودة التطبيق دون إتمام الدخول، فهذا يعني أن خدمات Google Play تطلب إضافة بصمة شهادة التطبيق (SHA-1) لحزمة com.glueck.teacher في إعدادات مشروع Firebase (glueck-c8621):',
                      'When selecting a Google account on Android returns without signing in, Google Play Services requires the APK SHA-1 fingerprint for com.glueck.teacher to be added in Firebase Project Settings (glueck-c8621):',
                      'Bitte fügen Sie den SHA-1-Fingerabdruck für com.glueck.teacher in den Firebase-Projekteinstellungen hinzu:'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAndroidShaHelper(false);
                    setShowEmailLoginFallback(false);
                  }}
                  className="text-xs text-text-muted hover:text-text-main px-1.5 py-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="bg-surface/90 border border-surface-border rounded-xl p-2.5 space-y-2 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-text-muted">Package Name:</span>
                  <div className="flex items-center gap-1.5">
                    <code dir="ltr" className="font-mono font-bold text-text-main bg-surface-hover px-2 py-0.5 rounded">
                      {androidSigningInfo?.packageName || 'com.glueck.teacher'}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(androidSigningInfo?.packageName || 'com.glueck.teacher');
                        setShaCopiedField('pkg');
                        setTimeout(() => setShaCopiedField(null), 2000);
                      }}
                      className="px-2 py-0.5 bg-primary/15 text-primary font-bold rounded cursor-pointer"
                    >
                      {shaCopiedField === 'pkg' ? '✓' : _t('نسخ', 'Copy', 'Kopieren')}
                    </button>
                  </div>
                </div>

                {androidSigningInfo?.apkSha1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-text-muted">SHA-1:</span>
                    <div className="flex items-center gap-1.5">
                      <code dir="ltr" className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-surface-hover px-2 py-0.5 rounded break-all">
                        {androidSigningInfo.apkSha1}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          if (androidSigningInfo.apkSha1) {
                            navigator.clipboard?.writeText(androidSigningInfo.apkSha1);
                            setShaCopiedField('sha1');
                            setTimeout(() => setShaCopiedField(null), 2000);
                          }
                        }}
                        className="px-2 py-0.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold rounded cursor-pointer shrink-0"
                      >
                        {shaCopiedField === 'sha1' ? _t('تم النسخ ✓', 'Copied ✓', 'Kopiert ✓') : _t('نسخ SHA-1', 'Copy SHA-1', 'SHA-1 kopieren')}
                      </button>
                    </div>
                  </div>
                )}

                {androidSigningInfo?.apkSha256 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-text-muted">SHA-256:</span>
                    <div className="flex items-center gap-1.5">
                      <code dir="ltr" className="font-mono text-[10px] text-text-main bg-surface-hover px-2 py-0.5 rounded break-all">
                        {androidSigningInfo.apkSha256}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          if (androidSigningInfo.apkSha256) {
                            navigator.clipboard?.writeText(androidSigningInfo.apkSha256);
                            setShaCopiedField('sha256');
                            setTimeout(() => setShaCopiedField(null), 2000);
                          }
                        }}
                        className="px-2 py-0.5 bg-surface-hover border border-surface-border text-text-main font-bold rounded cursor-pointer shrink-0"
                      >
                        {shaCopiedField === 'sha256' ? '✓' : _t('نسخ SHA-256', 'Copy SHA-256', 'Kopieren')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-1 flex justify-end">
                  <a
                    href="https://console.firebase.google.com/project/glueck-c8621/settings/general"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-primary/15 text-primary font-bold rounded-lg hover:underline inline-flex items-center gap-1"
                  >
                    <span>{_t('فتح إعدادات مشروع Firebase لإضافة SHA-1 ↗', 'Open Firebase Project Settings ↗', 'Firebase-Einstellungen ↗')}</span>
                  </a>
                </div>
              </div>

              {/* Instant Email/Password Cloud Sign-In Fallback */}
              <div className="pt-2 border-t border-amber-500/20 space-y-2">
                <div className="text-[11px] font-bold text-text-main">
                  🔑 {_t('أو سجّل الدخول فوراً بالبريد الإلكتروني وكلمة المرور السحابية (دون انتظار SHA-1):', 'Or sign in immediately with your Cloud Email & Password:', 'Oder sofort mit E-Mail & Passwort anmelden:')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="email"
                    dir="ltr"
                    value={cloudEmailInput}
                    onChange={(e) => setCloudEmailInput(e.target.value)}
                    placeholder="zusammennachdeutschland@gmail.com"
                    className="px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono text-text-main outline-none focus:border-primary"
                  />
                  <input
                    type="password"
                    dir="ltr"
                    value={cloudPasswordInput}
                    onChange={(e) => setCloudPasswordInput(e.target.value)}
                    placeholder={_t('كلمة المرور (6 أحرف فأكثر)', 'Password (min 6 chars)', 'Passwort (min. 6 Zeichen)')}
                    className="px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs text-text-main outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={handleEmailPasswordCloudSignIn}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {actionLoading === 'email_login' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogIn className="w-3.5 h-3.5" />
                    )}
                    <span>{_t('دخول لسحابة الواجبات', 'Sign In to Homework Cloud', 'Jetzt anmelden')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {showUnauthorizedDomainHelper && (
            <div className="w-full mt-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2.5">
              <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                ⚡ {_t('تفعيل الدومين في إعدادات مصادقة Firebase', 'Authorize Domain in Firebase Auth', 'Domain in Firebase Auth autorisieren')}
              </div>
              <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span>
                  {_t('أضف هذا الدومين في Firebase:', 'Add this domain in Firebase:', 'Domain in Firebase hinzufügen:')}{' '}
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
          {/* Account Info */}
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

            <div className="flex items-center gap-3">
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

          {/* Unboxed Homework Cloud Summary Line (Zero-Pill Discipline + Tabular Numerals) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted tabular-nums">
            <div className="flex flex-wrap items-center gap-1.5">
              <span>
                {_t('الواجبات المنشورة:', 'Published Homework:', 'Veröffentlichte Hausaufgaben:')}{' '}
                <strong className="text-text-main">{hwStats.assignmentsCount}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {_t('الطلاب المكتملون:', 'Completed Submissions:', 'Abgeschlossen:')}{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">{hwStats.submissionsCount}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {_t('قيد الحل الآن:', 'In Progress:', 'In Bearbeitung:')}{' '}
                <strong className="text-amber-600 dark:text-amber-400">{hwStats.inProgressCount}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {_t('واجبات معلقة للرفع:', 'Pending Cloud Uploads:', 'Ausstehende Uploads:')}{' '}
                <strong className={pendingHwCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-main'}>
                  {pendingHwCount}
                </strong>
              </span>
            </div>

            {lastSyncTime && (
              <div className="text-[11px] font-mono text-text-muted tabular-nums">
                {_t('آخر تحديث للواجبات:', 'Last homework check:', 'Letzte Aktualisierung:')}{' '}
                {new Date(lastSyncTime).toLocaleString('ar-EG', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>

          {/* Homework Cloud Action Buttons */}
          {!compact && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={handleSyncHomeworkNow}
                className="py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 ${actionLoading === 'sync_hw' ? 'animate-spin' : ''}`} />
                <span>
                  {_t(
                    'تحديث الواجبات ونتائج الطلاب من السحابة',
                    'Refresh Homework & Student Results',
                    'Hausaufgaben & Ergebnisse aktualisieren'
                  )}
                </span>
              </button>

              <button
                type="button"
                disabled={actionLoading !== null || pendingHwCount === 0}
                onClick={handleFlushPendingHomework}
                className="py-2.5 px-4 bg-surface hover:bg-surface-hover border border-surface-border disabled:opacity-50 text-text-main font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Upload className={`w-4 h-4 text-primary ${actionLoading === 'flush_hw' ? 'animate-bounce' : ''}`} />
                <span>
                  {_t(
                    `رفع الواجبات المعلقة للسحابة (${pendingHwCount})`,
                    `Upload Pending Homework (${pendingHwCount})`,
                    `Ausstehende Hausaufgaben hochladen (${pendingHwCount})`
                  )}
                </span>
              </button>
            </div>
          )}

          {/* Optional Legacy Workspace Cleanup Button */}
          {!compact && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() => setShowClearConfirmModal(true)}
                className="py-1.5 px-3 text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title={_t(
                  'حذف بيانات مساحة العمل القديمة من السحابة مع الحفاظ على الواجبات المنشورة وبيانات الجهاز',
                  'Clear legacy workspace data in cloud while keeping published homework',
                  'Alte Cloud-Arbeitsbereichsdaten bereinigen'
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {_t(
                    'حذف النسخة السحابية القديمة لبيانات التطبيق (مع بقاء الواجبات)',
                    'Clear Legacy Workspace Cloud Data (Keep Homework)',
                    'Alte Cloud-Daten bereinigen (Hausaufgaben behalten)'
                  )}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Clearing Legacy Cloud Data */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-text-main">
                  {_t(
                    'تأكيد تنظيف بيانات مساحة العمل السحابية القديمة',
                    'Confirm Clear Legacy Cloud Workspace',
                    'Cloud-Bereinigung bestätigen'
                  )}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {_t(
                    'سيتم حذف بيانات التطبيق العامة القديمة من Google Cloud Firestore لتوفير مساحة السحابة، مع الإبقاء على كافة الواجبات المنشورة وروابط وإجابات الطلاب سليمة تماماً.',
                    'This removes legacy full-workspace chunks from Firestore while keeping all published homework links and student submissions intact.',
                    'Dies löscht alte Cloud-Arbeitsbereichsdaten, während alle veröffentlichten Hausaufgaben erhalten bleiben.'
                  )}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1 text-amber-700 dark:text-amber-400 font-medium">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  {_t(
                    'بيانات جهازك الحالية والواجبات المنشورة للطلاب آمنة تماماً ولن تُحذف.',
                    'Your local device data and published student homework remain 100% safe.',
                    'Ihre lokalen Daten und Hausaufgaben bleiben vollständig erhalten.'
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={actionLoading === 'clear'}
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                disabled={actionLoading === 'clear'}
                onClick={handleClearCloudData}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {actionLoading === 'clear' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{_t('جاري التنظيف...', 'Clearing...', 'Wird gelöscht...')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{_t('نعم، نظّف السحابة الآن', 'Yes, Clear Cloud Now', 'Ja, jetzt bereinigen')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
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
