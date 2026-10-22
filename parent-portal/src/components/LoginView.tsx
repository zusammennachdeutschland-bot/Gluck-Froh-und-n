import React, { useState } from 'react';
import { 
  Sparkles, ShieldCheck, KeyRound, Phone, UserCheck, AlertCircle, 
  Loader2, Lock, ArrowLeft, ArrowRight, UserPlus, CheckCircle2 
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { loginParent, registerParent, changePassword, AuthSession } from '../lib/firebase';

interface LoginViewProps {
  onLoginSuccess: (session: AuthSession) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  darkMode,
  onToggleTheme
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginStudentCode, setLoginStudentCode] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [regStudentCode, setRegStudentCode] = useState('');
  const [regParentPhone, setRegParentPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Forced password change state
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const session = await loginParent(loginStudentCode, loginPassword);
      if (session.mustChangePassword) {
        setPendingSession(session);
      } else {
        onLoginSuccess(session);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('يجب ألا تقل كلمة المرور عن 6 أحرف');
      return;
    }

    setIsLoading(true);

    try {
      const session = await registerParent(regStudentCode, regParentPhone, regPassword);
      setSuccessMessage('تم إنشاء الحساب بنجاح! جاري تحويلك إلى لوحة المتابعة...');
      setTimeout(() => {
        onLoginSuccess(session);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل إنشاء الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forced Password Change
  const handleForcedPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('يجب ألا تقل كلمة المرور عن 6 أحرف');
      return;
    }

    setIsLoading(true);

    try {
      await changePassword(newPassword);
      if (pendingSession) {
        onLoginSuccess({
          ...pendingSession,
          mustChangePassword: false
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تحديث كلمة المرور');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoQuickFill = () => {
    setLoginStudentCode('1001');
    setLoginPassword('demo123');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4 sm:p-6 transition-colors">
      {/* Top Navbar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
            AGS
          </div>
          <span className="font-extrabold text-sm text-text-main">
            بوابة أولياء الأمور 🇩🇪
          </span>
        </div>

        <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
      </div>

      {/* Main Login / Register Card */}
      <div className="max-w-md w-full mx-auto my-auto py-6">
        <div className="bg-surface border border-surface-border rounded-3xl p-6 sm:p-8 shadow-md space-y-6 relative overflow-hidden">
          {/* Ambient blur glow */}
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* FORCED PASSWORD CHANGE MODAL */}
          {pendingSession ? (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center font-bold">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-text-main">
                  تعيين كلمة مرور جديدة
                </h2>
                <p className="text-xs text-text-muted">
                  تمت إعادة تعيين كلمة المرور لحسابك من قبل المعلم. يرجى تعيين كلمة مرور شخصية جديدة للاستمرار في استعراض بيانات الطالب.
                </p>
              </div>

              {errorMessage && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-3 rounded-2xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleForcedPasswordChange} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted">كلمة المرور الجديدة:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-background border border-surface-border rounded-2xl px-4 py-3 text-sm font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted">تأكيد كلمة المرور الجديدة:</label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-background border border-surface-border rounded-2xl px-4 py-3 text-sm font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>حفظ ودخول إلى اللوحة</span>}
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Heading */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>متابعة أكاديمية مستمرة</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-text-main tracking-tight">
                  {activeTab === 'login' ? 'تسجيل الدخول' : 'تسجيل حساب جديد'}
                </h1>

                <p className="text-xs sm:text-sm text-text-muted">
                  {activeTab === 'login' 
                    ? 'أدخل كود الطالب وكلمة المرور لمتابعة الحصص والدرجات والواجبات.'
                    : 'سجل لأول مرة بكود الطالب ورقم هاتفك المسجل لدى المعلم.'}
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 p-1 bg-surface-hover rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setErrorMessage(null); }}
                  className={`py-2 rounded-xl transition-all ${activeTab === 'login' ? 'bg-surface text-blue-600 dark:text-blue-400 shadow-xs' : 'text-text-muted'}`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setErrorMessage(null); }}
                  className={`py-2 rounded-xl transition-all ${activeTab === 'register' ? 'bg-surface text-blue-600 dark:text-blue-400 shadow-xs' : 'text-text-muted'}`}
                >
                  تسجيل جديد لأول مرة
                </button>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-3 rounded-2xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-2xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* LOGIN FORM */}
              {activeTab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                      <span>كود الطالب:</span>
                    </label>
                    <input
                      type="text"
                      value={loginStudentCode}
                      onChange={(e) => setLoginStudentCode(e.target.value)}
                      placeholder="مثال: 1001 أو stu-omar"
                      className="w-full bg-background border border-surface-border rounded-2xl px-4 py-3 text-sm font-bold text-text-main placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      dir="ltr"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-500" />
                      <span>كلمة المرور:</span>
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-background border border-surface-border rounded-2xl px-4 py-3 text-sm font-bold text-text-main placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جارِ التحقق...</span>
                      </>
                    ) : (
                      <>
                        <span>دخول إلى البوابة</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Demo fill button */}
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={handleDemoQuickFill}
                      className="text-xs text-text-muted hover:text-blue-500 underline transition-colors"
                    >
                      تجربة سريعة بالحساب النموذجي (كود: 1001)
                    </button>
                  </div>
                </form>
              )}

              {/* REGISTER FORM */}
              {activeTab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                      <span>كود الطالب:</span>
                    </label>
                    <input
                      type="text"
                      value={regStudentCode}
                      onChange={(e) => setRegStudentCode(e.target.value)}
                      placeholder="مثال: 1001 أو stu-omar"
                      className="w-full bg-background border border-surface-border rounded-2xl px-4 py-2.5 text-sm font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      dir="ltr"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-blue-500" />
                      <span>رقم هاتف ولي الأمر المسجل:</span>
                    </label>
                    <input
                      type="tel"
                      value={regParentPhone}
                      onChange={(e) => setRegParentPhone(e.target.value)}
                      placeholder="مثال: 01000000000"
                      className="w-full bg-background border border-surface-border rounded-2xl px-4 py-2.5 text-sm font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      dir="ltr"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-500" />
                      <span>كلمة المرور الجديدة (6 أحرف فأكثر):</span>
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-background border border-surface-border rounded-2xl px-4 py-2.5 text-sm font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-muted">تأكيد كلمة المرور:</label>
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-background border border-surface-border rounded-2xl px-4 py-2.5 text-sm font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جارِ التحقق وإنشاء الحساب...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>إنشاء الحساب وتعيين كلمة المرور</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {/* Privacy & Security Note */}
          <div className="pt-2 border-t border-surface-border flex items-center justify-center gap-2 text-text-muted text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>نظام مشفر وآمن لمتابعة تقدم الطالب حصرياً لأولياء الأمور</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md w-full mx-auto text-center text-text-muted text-xs">
        © 2026 AGS Deutsch · جميع الحقوق محفوظة
      </div>
    </div>
  );
};
