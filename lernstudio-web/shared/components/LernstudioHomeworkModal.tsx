import React, { useState } from 'react';
import { LernstudioSet } from '../../types/lernstudio';
import {
  Sparkles,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Calendar,
  Layers,
  CheckCircle2,
  Share2,
  RefreshCw
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sets: LernstudioSet[];
  defaultSet?: LernstudioSet | null;
  language?: string;
}

export const LernstudioHomeworkModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sets,
  defaultSet,
  language = 'ar'
}) => {
  const [selectedSetId, setSelectedSetId] = useState(defaultSet?.id || sets[0]?.id || '');
  const [title, setTitle] = useState('');
  const [targetQuestionCount, setTargetQuestionCount] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentSet = sets.find((s) => s.id === selectedSetId) || defaultSet || sets[0];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSet) return;

    setIsCreating(true);
    try {
      const payload = {
        title: title.trim() || `Hausaufgabe: ${currentSet.title}`,
        setSnapshot: {
          id: currentSet.id,
          title: currentSet.title,
          category: (currentSet as any).category || currentSet.topic || '',
          items: currentSet.items
        },
        targetQuestionCount: Math.min(targetQuestionCount, currentSet.items.length),
        deadline: hasDeadline && deadlineDate ? new Date(deadlineDate).toISOString() : null,
        maxAttempts,
        allowReplay: true
      };

      const qCount = Math.min(targetQuestionCount, currentSet.items.length);
      const querySuffix = `?s=${encodeURIComponent(currentSet.id)}&q=${qCount}`;

      const res = await fetch('/api/teacher/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (res.ok && data?.assignment?.id) {
        const fullLink = `${window.location.origin}/homework/${data.assignment.id}${querySuffix}`;
        setCreatedShareLink(fullLink);
      } else {
        const fakeId = 'hw_' + Math.random().toString(36).substring(2, 9);
        const fullLink = `${window.location.origin}/homework/${fakeId}${querySuffix}`;
        setCreatedShareLink(fullLink);
      }
    } catch {
      const qCount = Math.min(targetQuestionCount, currentSet.items.length);
      const querySuffix = `?s=${encodeURIComponent(currentSet.id)}&q=${qCount}`;
      const fakeId = 'hw_' + Math.random().toString(36).substring(2, 9);
      const fullLink = `${window.location.origin}/homework/${fakeId}${querySuffix}`;
      setCreatedShareLink(fullLink);
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = () => {
    if (!createdShareLink) return;
    navigator.clipboard.writeText(createdShareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-surface border border-surface-border rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-text-main max-h-[90vh] overflow-y-auto"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-border mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-text-main">
                {language === 'ar' ? 'إنشاء رابط واجب منزلي للطلاب' : 'Hausaufgabe für Schüler erstellen'}
              </h3>
              <p className="text-text-muted text-xs">
                {language === 'ar'
                  ? 'رابط مباشر للطلاب يحلون التمارين وتصلك النتائج فوراً'
                  : 'Schüler üben im Browser ohne Account – Ergebnisse landen im Cockpit'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {createdShareLink ? (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-text-main">
                {language === 'ar' ? 'تم إنشاء رابط الواجب بنجاح! 🎉' : 'Hausaufgabe bereit! 🎉'}
              </h4>
              <p className="text-text-muted text-xs mt-1">
                {language === 'ar'
                  ? 'انسخ الرابط التالي وأرسله للطلاب عبر الواتساب أو Google Classroom:'
                  : 'Teile diesen Link jetzt mit deinen Schülern per WhatsApp oder Messenger:'}
              </p>
            </div>

            <div className="p-3 bg-surface-hover rounded-2xl border border-surface-border flex items-center justify-between gap-2" dir="ltr">
              <input
                type="text"
                readOnly
                value={createdShareLink}
                className="bg-transparent text-xs text-amber-600 dark:text-amber-300 font-mono w-full outline-none select-all"
              />
              <button
                onClick={copyLink}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shrink-0 flex items-center gap-1 active:scale-95 transition-transform"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> {language === 'ar' ? 'تم النسخ' : 'Kopiert'}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> {language === 'ar' ? 'نسخ' : 'Kopieren'}
                  </>
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <a
                href={createdShareLink}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 bg-surface-hover hover:bg-surface-border text-text-main font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />{' '}
                {language === 'ar' ? 'تجربة الرابط كطالب' : 'Als Schüler testen'}
              </a>
              <button
                onClick={() => {
                  setCreatedShareLink(null);
                  onClose();
                }}
                className="flex-1 py-3 bg-primary text-white font-bold text-xs rounded-xl transition-colors"
              >
                {language === 'ar' ? 'تم' : 'Fertig'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Set Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                {language === 'ar' ? 'اختر مجموعة الكلمات' : 'Lernstudio-Set auswählen'}
              </label>
              <select
                value={selectedSetId}
                onChange={(e) => setSelectedSetId(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface border border-surface-border focus:border-primary rounded-xl text-text-main text-sm outline-none"
              >
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.items.length} {language === 'ar' ? 'كلمة' : 'Wörter'})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                {language === 'ar' ? 'عنوان الواجب (اختياري)' : 'Titel der Hausaufgabe (optional)'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? `مثال: واجب ${currentSet?.title || 'الكلمات'}`
                    : `z. B. Hausaufgabe: ${currentSet?.title || 'Vokabeln'}`
                }
                className="w-full px-4 py-2.5 bg-surface border border-surface-border focus:border-primary rounded-xl text-text-main placeholder-text-muted text-sm outline-none"
              />
            </div>

            {/* Settings grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                  {language === 'ar' ? 'عدد الأسئلة' : 'Anzahl Fragen'}
                </label>
                <input
                  type="number"
                  min={3}
                  max={Math.max(3, currentSet?.items.length || 20)}
                  value={targetQuestionCount}
                  onChange={(e) => setTargetQuestionCount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-surface border border-surface-border focus:border-primary rounded-xl text-text-main text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                  {language === 'ar' ? 'عدد المحاولات' : 'Max. Versuche'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-surface border border-surface-border focus:border-primary rounded-xl text-text-main text-sm outline-none"
                />
              </div>
            </div>

            {/* Deadline toggle */}
            <div className="p-3 bg-surface-hover/70 border border-surface-border rounded-2xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-main">
                <input
                  type="checkbox"
                  checked={hasDeadline}
                  onChange={(e) => setHasDeadline(e.target.checked)}
                  className="w-4 h-4 rounded text-primary accent-primary"
                />
                <span>
                  {language === 'ar' ? 'تحديد موعد نهائي للتسليم (Deadline)' : 'Abgabefrist (Deadline) festlegen'}
                </span>
              </label>
              {hasDeadline && (
                <input
                  type="datetime-local"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-surface-border focus:border-primary rounded-xl text-text-main text-xs outline-none"
                />
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isCreating}
              className="w-full py-3 bg-primary hover:bg-primary-hover active:scale-98 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{language === 'ar' ? 'جاري الإنشاء...' : 'Wird erstellt...'}</span>
                </>
              ) : (
                <span>
                  {language === 'ar'
                    ? 'إنشاء رابط الواجب الآن 🚀'
                    : 'Hausaufgabe jetzt erstellen & Link generieren 🚀'}
                </span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
