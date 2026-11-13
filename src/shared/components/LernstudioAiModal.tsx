import React, { useState } from 'react';
import { LernstudioSet, LernstudioLevel, LernstudioDifficulty } from '../../types/lernstudio';
import { generateLernstudioPrompt, validateAndParseLernstudioJson, validateLernstudioSetForWorksheet } from '../../utils/lernstudioAiUtils';
import { CHILDREN_TOPICS_PRESETS, CHILDREN_LEVEL_CATEGORIES } from '../../data/childrenTopicsPreset';
import { PROGRAM_GRADES } from '../../utils/lernstudioTranslations';
import { auth } from '../firebaseCloudSync';
import { X, Copy, Check, Sparkles, Download, AlertCircle, FileText, BookOpen } from 'lucide-react';

interface Props {
  isOpen: boolean;
  teacherName?: string;
  language?: string;
  onClose: () => void;
  onImportSet: (newSet: LernstudioSet) => void;
}

export const LernstudioAiModal: React.FC<Props> = ({ isOpen, teacherName, language = 'ar', onClose, onImportSet }) => {
  const defaultCreatorName = teacherName?.trim() || auth?.currentUser?.displayName?.trim() || '';
  const [activeTab, setActiveTab] = useState<'generate' | 'import'>('generate');

  // Generator Config
  const [selectedPresetTopic, setSelectedPresetTopic] = useState('');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('');
  const [level, setLevel] = useState<LernstudioLevel>('A1');
  const [difficulty, setDifficulty] = useState<LernstudioDifficulty>('medium');
  const [itemCount, setItemCount] = useState<number | 'auto'>('auto');
  const [includeVerbConjugation, setIncludeVerbConjugation] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Importer Config
  const [pastedJson, setPastedJson] = useState('');
  const [creatorTeacherName, setCreatorTeacherName] = useState(defaultCreatorName);
  const [hasManualTeacherNameEdit, setHasManualTeacherNameEdit] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<Partial<LernstudioSet> | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (topicTitle: string) => {
    setSelectedPresetTopic(topicTitle);
    const found = CHILDREN_TOPICS_PRESETS.find((p) => p.topicTitle === topicTitle);
    if (found) {
      setTopic(found.topicTitle);
      setGrade(found.levelCategory);
      setItemCount(found.wordCount);
      setLevel(found.cefrLevel);
    }
  };

  const generatedPrompt = generateLernstudioPrompt({
    topic: topic.trim() || 'Tiere und Natur',
    grade: grade.trim() || undefined,
    level,
    difficulty,
    itemCount,
    teacherName: creatorTeacherName.trim() || defaultCreatorName || undefined,
    includeVerbConjugation
  });

  const [validationInfo, setValidationInfo] = useState<{ warnings: string[]; repairedCount: number } | null>(null);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handleParseJson = () => {
    setImportError(null);
    setValidationInfo(null);
    const result = validateAndParseLernstudioJson(pastedJson);
    if (result.success && result.data) {
      const valRes = validateLernstudioSetForWorksheet(result.data);
      setParsedPreview(valRes.repairedSet);
      if (!hasManualTeacherNameEdit && valRes.repairedSet.createdByTeacherName?.trim()) {
        setCreatorTeacherName(valRes.repairedSet.createdByTeacherName.trim());
      } else if (!hasManualTeacherNameEdit && !creatorTeacherName.trim() && defaultCreatorName) {
        setCreatorTeacherName(defaultCreatorName);
      }
      setValidationInfo({
        warnings: valRes.warnings,
        repairedCount: valRes.repairedCount
      });
    } else {
      setParsedPreview(null);
      setImportError(result.error || (language === 'ar' ? 'تنسيق JSON غير صالح.' : 'Invalid JSON format.'));
    }
  };

  const handleConfirmImport = () => {
    if (!parsedPreview || !parsedPreview.items) return;

    const resolvedTeacherName =
      creatorTeacherName.trim() ||
      (parsedPreview as any).createdByTeacherName?.trim() ||
      teacherName?.trim() ||
      auth?.currentUser?.displayName?.trim() ||
      undefined;

    const fullSet: LernstudioSet = {
      id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: parsedPreview.title || topic || 'مجموعة مستوردة',
      topic: parsedPreview.topic || topic || 'ألماني',
      grade: parsedPreview.grade || grade || undefined,
      level: parsedPreview.level || level,
      difficulty: parsedPreview.difficulty || difficulty,
      hasArticles: parsedPreview.hasArticles,
      sentenceBuilderSupported: parsedPreview.sentenceBuilderSupported,
      ...(resolvedTeacherName ? { createdByTeacherName: resolvedTeacherName } : {}),
      description: parsedPreview.description || `مجموعة ${parsedPreview.title}`,
      items: parsedPreview.items,
      customExercises: parsedPreview.customExercises,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now()
    };

    onImportSet(fullSet);
    /* confetti removed */
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm sm:text-base font-bold text-text-main">
              {language === 'ar' ? 'مولد البرومبت واستيراد المحتوى بالذكاء الاصطناعي' : 'AI Prompt Generator & Content Import'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-surface-hover border-b border-surface-border text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'generate' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
            }`}
          >
            {language === 'ar' ? '1. إنشاء Prompt ذكي للدرس' : '1. Generate AI Prompt'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'import' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
            }`}
          >
            {language === 'ar' ? '2. استيراد كود JSON' : '2. Import JSON Code'}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'generate' ? (
            <div className="space-y-4">
              {/* Quick Children Topics Preset Picker */}
              <div className="p-3 bg-surface-hover border border-surface-border rounded-xl space-y-1.5">
                <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>{language === 'ar' ? 'قائمة موضوعات الأطفال المعتمدة:' : 'Children Approved Topics Presets:'}</span>
                </label>
                <select
                  value={selectedPresetTopic}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary shadow-xs"
                >
                  <option value="">-- {language === 'ar' ? 'اختر من قائمة 70 موضوعًا للأطفال' : 'Select from 70 Children Topics'} --</option>
                  {CHILDREN_LEVEL_CATEGORIES.map((cat) => {
                    const catTopics = CHILDREN_TOPICS_PRESETS.filter((p) => p.levelCategory === cat);
                    return (
                      <optgroup key={cat} label={`📂 ${cat}`}>
                        {catTopics.map((p) => (
                          <option key={p.topicTitle} value={p.topicTitle}>
                            • {p.topicTitle} ({p.wordCount} كلمات) - {p.cefrLevel}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">{language === 'ar' ? 'موضوع الدرس (Topic):' : 'Lesson Topic:'}</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => {
                      setTopic(e.target.value);
                      setSelectedPresetTopic('');
                    }}
                    placeholder="مثال: Tiere, Schule, Familie, Essen..."
                    className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">{language === 'ar' ? 'الصف / المرحلة (Grade):' : 'Grade / Category:'}</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">{language === 'ar' ? '-- اسأل الذكاء الاصطناعي (دا جريد كام؟) --' : '-- Ask AI (Which Grade?) --'}</option>
                    {PROGRAM_GRADES.map((g) => (
                      <option key={g.id} value={g.labelAr}>
                        {language === 'ar' ? g.labelAr : language === 'de' ? g.labelDe : g.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">{language === 'ar' ? 'المستوى الأوروبي (CEFR Level):' : 'CEFR Level:'}</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as LernstudioLevel)}
                    className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="A1">A1 - {language === 'ar' ? 'مبتدئ' : 'Beginner'}</option>
                    <option value="A2">A2 - {language === 'ar' ? 'أساسي' : 'Elementary'}</option>
                    <option value="B1">B1 - {language === 'ar' ? 'متوسط' : 'Intermediate'}</option>
                    <option value="B2">B2 - {language === 'ar' ? 'متوسط متقدم' : 'Upper Intermediate'}</option>
                    <option value="C1">C1 - {language === 'ar' ? 'متقدم' : 'Advanced'}</option>
                    <option value="C2">C2 - {language === 'ar' ? 'محترف' : 'Mastery'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">{language === 'ar' ? 'عدد المفردات المطلوبة (Item Count):' : 'Vocabulary Item Count:'}</label>
                  <select
                    value={itemCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItemCount(val === 'auto' ? 'auto' : Number(val));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="auto">{language === 'ar' ? 'تلقائي يحدده الذكاء الاصطناعي (5 إلى 30 كلمة)' : 'Auto determined by AI (5 to 30 words)'}</option>
                    <option value="5">5 {language === 'ar' ? 'كلمات (درس قصير)' : 'words (short)'}</option>
                    <option value="10">10 {language === 'ar' ? 'كلمات (درس معياري)' : 'words (standard)'}</option>
                    <option value="15">15 {language === 'ar' ? 'كلمة (درس متوسط)' : 'words (medium)'}</option>
                    <option value="20">20 {language === 'ar' ? 'كلمة (درس كامل وشامل)' : 'words (comprehensive)'}</option>
                    <option value="24">24 {language === 'ar' ? 'كلمة (درس 24 كلمة)' : 'words (24 words)'}</option>
                    <option value="26">26 {language === 'ar' ? 'كلمة (الأبجدية كاملة)' : 'words (full alphabet)'}</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {language === 'ar' ? 'اسم المدرس مُنشئ المجموعة (يُدرج في الـ Set):' : 'Creator Teacher Name:'}
                  </label>
                  <input
                    type="text"
                    value={creatorTeacherName}
                    onChange={(e) => {
                      setCreatorTeacherName(e.target.value);
                      setHasManualTeacherNameEdit(true);
                    }}
                    placeholder={language === 'ar' ? 'مثال: أ. محمد / Herr Ahmed' : 'Lehrername'}
                    className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Verb Conjugation Focus Toggle */}
              <div className="p-3 bg-surface-hover border border-surface-border rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg transition-colors ${includeVerbConjugation ? 'bg-primary/20 text-primary' : 'bg-surface border border-surface-border text-text-muted'}`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <span>{language === 'ar' ? 'تركيز على تصريف الأفعال (Präsens)' : 'Verb Conjugation Focus (Präsens)'}</span>
                    </h4>
                    <p className="text-[11px] font-medium text-text-muted mt-0.5">
                      {language === 'ar' 
                        ? 'استخراج الأفعال من الدرس وإنشاء تمارين اختيارات مع تنويع الفاعل' 
                        : 'Extract verbs from source text & generate sentence completion exercises with varied subjects'}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={includeVerbConjugation}
                    onChange={(e) => setIncludeVerbConjugation(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Prompt Output Box */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-main flex items-center gap-1">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>الأمر البرمجي المصمم للذكاء الاصطناعي (Prompt):</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPrompt ? 'تم النسخ' : 'نسخ البرومبت'}</span>
                  </button>
                </div>

                <textarea
                  readOnly
                  value={generatedPrompt}
                  rows={8}
                  dir="ltr"
                  className="w-full p-3 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-mono text-text-main focus:outline-none resize-none"
                />

                <p className="text-[11px] text-text-muted">
                  💡 <strong>الخطوة التالية:</strong> انسخ البرومبت أعلاه، ثم الصقه في Gemini أو ChatGPT خارج التطبيق. بعد صدور النتيجة بصيغة JSON، انتقل إلى تبويب <strong>"استيراد كود JSON"</strong> ولصق الناتج هناك.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-main block">
                  {language === 'ar' ? 'اسم المدرس مُنشئ المجموعة (يُثبّت على الـ Set للفلترة): *' : 'Creator Teacher Name: *'}
                </label>
                <input
                  type="text"
                  value={creatorTeacherName}
                  onChange={(e) => {
                    setCreatorTeacherName(e.target.value);
                    setHasManualTeacherNameEdit(true);
                  }}
                  placeholder={language === 'ar' ? 'مثال: أ. محمد / Herr Ahmed' : 'Lehrername'}
                  className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-text-main block">
                  الصق كود JSON الصادر من الذكاء الاصطناعي هنا:
                </label>
                <textarea
                  value={pastedJson}
                  onChange={(e) => {
                    setPastedJson(e.target.value);
                    setImportError(null);
                    setParsedPreview(null);
                  }}
                  rows={8}
                  dir="ltr"
                  placeholder='{\n  "title": "Tiere",\n  "level": "A1",\n  "items": [...]\n}'
                  className="w-full p-3 bg-surface border border-surface-border rounded-xl text-[11px] font-mono text-text-main focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Validation & Preview Controls */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleParseJson}
                  disabled={!pastedJson.trim()}
                  className="px-4 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>فحص ومعاينة البيانات</span>
                </button>

                {parsedPreview && (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>حفظ واستيراد الـ Set ({parsedPreview.items?.length} مفردات)</span>
                  </button>
                )}
              </div>

              {/* Error Message */}
              {importError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Preview Cards */}
              {parsedPreview && parsedPreview.items && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      ✓ التنسيق صحيح! تم العثور على {parsedPreview.items.length} مفردات في مجموعة ({parsedPreview.title}):
                    </span>
                    {validationInfo && validationInfo.repairedCount > 0 && (
                      <span className="text-[11px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-500/30">
                        تم إصلاح {validationInfo.repairedCount} جملة ترتيب تلقائياً.
                      </span>
                    )}
                  </div>

                  {validationInfo && validationInfo.warnings.length > 0 && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                      <span className="font-bold block">ملاحظات التحقق من جودة ورقة العمل:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {validationInfo.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {parsedPreview.items.map((item, idx) => (
                      <div key={idx} className="p-2 bg-surface rounded-lg border border-surface-border text-xs flex items-center justify-between gap-2">
                        <span className="font-bold text-primary font-mono" dir="ltr">{item.emoji} {item.german}</span>
                        <span className="text-text-muted">{item.arabic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
