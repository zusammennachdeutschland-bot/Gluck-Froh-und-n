import React, { useState } from 'react';
import { 
  Lock, Shield, Key, Copy, Download, RefreshCw, AlertTriangle, 
  CheckCircle2, Fingerprint, Smartphone, ExternalLink, ShieldAlert, ShieldCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AndroidKeystoreSection: React.FC = () => {
  const { _t, triggerToast } = useApp();
  const [storePassword, setStorePassword] = useState('');
  const [keyAlias, setKeyAlias] = useState('glueckrelease');
  const [isLoading, setIsLoading] = useState(false);
  const [keystoreData, setKeystoreData] = useState<{
    keystoreBase64: string;
    sha256Fingerprint: string;
    alias: string;
    byteLength: number;
  } | null>(null);

  const handleGenerate = async () => {
    if (storePassword.length < 6) {
      triggerToast(_t('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'Password must be at least 6 characters.', 'Passwort muss mindestens 6 Zeichen lang sein.'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/android/generate-keystore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storePassword, keyAlias })
      });

      const data = await res.json();
      if (data.success) {
        setKeystoreData({
          keystoreBase64: data.keystoreBase64,
          sha256Fingerprint: data.sha256Fingerprint,
          alias: data.alias,
          byteLength: data.byteLength
        });
        triggerToast(_t('تم إنشاء ملف التوقيع بنجاح!', 'Keystore generated successfully!', 'Keystore erfolgreich erstellt!'));
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (err: any) {
      triggerToast(_t('فشل إنشاء ملف التوقيع: ', 'Failed to generate keystore: ', 'Fehler beim Erstellen des Keystores: ') + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(_t(`تم نسخ ${label} إلى الحافظة.`, `Copied ${label} to clipboard.`, `${label} in die Zwischenablage kopiert.`));
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-text-main">
              {_t('أداة إنشاء ملف توقيع أندرويد (Release Keystore)', 'Android Release Keystore Generator', 'Android Release Keystore Generator')}
            </h4>
            <p className="text-xs text-text-muted mt-0.5">
              {_t('قم بإنشاء ملف توقيع جديد مباشرة من هاتفك لاستخدامه في GitHub Actions.', 'Generate a new signing keystore directly from your phone for GitHub Actions.', 'Erstellen Sie einen neuen Keystore direkt von Ihrem Handy für GitHub Actions.')}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p>
            {_t(
              'هام: لا يتم حفظ ملف التوقيع أو كلمة المرور على الخادم. تأكد من نسخ القيم وحفظها في مكان آمن فوراً.',
              'Important: Neither the keystore nor the password are saved on the server. Copy and save these values securely immediately.',
              'Wichtig: Weder der Keystore noch das Passwort werden auf dem Server gespeichert.'
            )}
          </p>
        </div>

        {!keystoreData ? (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase px-1">
                  {_t('كلمة مرور المتجر (Store Password)', 'Store Password', 'Store Passwort')}
                </label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min. 6 chars"
                    value={storePassword}
                    onChange={(e) => setStorePassword(e.target.value)}
                    className="w-full bg-surface-hover border border-surface-border rounded-lg py-2 pl-8 pr-3 text-xs focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase px-1">
                  {_t('الاسم المستعار (Key Alias)', 'Key Alias', 'Key Alias')}
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                  <input
                    type="text"
                    placeholder="glueckrelease"
                    value={keyAlias}
                    onChange={(e) => setKeyAlias(e.target.value)}
                    className="w-full bg-surface-hover border border-surface-border rounded-lg py-2 pl-8 pr-3 text-xs focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              <span>{_t('إنشاء ملف التوقيع الآن', 'Generate Keystore Now', 'Keystore jetzt erstellen')}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-scale-up">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{_t('تم الإنشاء بنجاح!', 'Successfully Generated!', 'Erfolgreich erstellt!')}</span>
                </div>
                <button 
                  onClick={() => setKeystoreData(null)}
                  className="text-[10px] text-text-muted hover:text-primary underline"
                >
                  {_t('إنشاء واحد جديد', 'Generate New', 'Neu erstellen')}
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between px-1 mb-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">ANDROID_KEY_ALIAS</label>
                    <button onClick={() => copyToClipboard(keystoreData.alias, 'Alias')} className="text-primary hover:text-primary-hover p-0.5">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="bg-surface-hover border border-surface-border rounded-lg p-2 text-[10px] font-mono break-all text-text-main">
                    {keystoreData.alias}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between px-1 mb-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">SHA-256 Fingerprint</label>
                    <button onClick={() => copyToClipboard(keystoreData.sha256Fingerprint, 'Fingerprint')} className="text-primary hover:text-primary-hover p-0.5">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="bg-surface-hover border border-surface-border rounded-lg p-2 text-[10px] font-mono break-all text-text-main">
                    {keystoreData.sha256Fingerprint}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between px-1 mb-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">ANDROID_KEYSTORE_BASE64</label>
                    <button onClick={() => copyToClipboard(keystoreData.keystoreBase64, 'Base64')} className="text-primary hover:text-primary-hover p-0.5">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="bg-surface-hover border border-surface-border rounded-lg p-2 text-[10px] font-mono break-all max-h-24 overflow-y-auto text-text-main scrollbar-thin">
                    {keystoreData.keystoreBase64}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface-hover border border-surface-border space-y-2">
              <h5 className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-primary" />
                <span>{_t('الخطوات التالية في GitHub:', 'Next Steps in GitHub:', 'Nächste Schritte in GitHub:')}</span>
              </h5>
              <ol className="text-[10px] text-text-muted space-y-1.5 list-decimal list-inside px-1">
                <li>{_t('اذهب إلى إعدادات مستودع GitHub (Settings > Secrets and variables > Actions).', 'Go to GitHub Repository Settings > Secrets and variables > Actions.', 'Gehen Sie zu GitHub Repository Einstellungen.')}</li>
                <li>{_t('أضف New repository secret لكل من القيم الأربعة المذكورة في التعليمات.', 'Add New repository secret for all 4 values mentioned in instructions.', 'Fügen Sie 4 Repository Secrets hinzu.')}</li>
                <li>{_t('استخدم كلمة المرور التي اخترتها لـ ANDROID_STORE_PASSWORD و ANDROID_KEY_PASSWORD.', 'Use the password you chose for ANDROID_STORE_PASSWORD and ANDROID_KEY_PASSWORD.', 'Verwenden Sie Ihr Passwort für die Secrets.')}</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-text-main">
              {_t('توقيع Release التلقائي', 'Automated Release Signing', 'Automatisierte Release-Signierung')}
            </h4>
            <p className="text-xs text-text-muted mt-0.5">
              {_t('سيستخدم GitHub Actions هذه البيانات لتوقيع ملف APK تلقائياً.', 'GitHub Actions will use this data to sign your APK automatically.', 'GitHub Actions verwendet diese Daten zum Signieren Ihrer APK.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
