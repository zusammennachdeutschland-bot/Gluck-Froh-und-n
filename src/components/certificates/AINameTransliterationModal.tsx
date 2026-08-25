import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, Copy, Check, X, AlertCircle, FileSpreadsheet, CheckCircle2, Edit3, ArrowRight, Search } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AINameTransliterationModalProps {
  onClose: () => void;
  groupId?: string;
}

export const AINameTransliterationModal: React.FC<AINameTransliterationModalProps> = ({ onClose, groupId }) => {
  const { students, groups, updateStudentCertificateNamesBulk, updateStudentCertificateName, _t, language } = useApp();
  const isRtl = language === 'ar';

  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupId || 'all');
  const [filterMode, setFilterMode] = useState<'missing_only' | 'all'>('missing_only');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [aiResponseText, setAiResponseText] = useState('');
  const [parsedResults, setParsedResults] = useState<{ id: string; originalName: string; certificateName: string; matched: boolean }[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [manualEdits, setManualEdits] = useState<Record<string, string>>({});
  const [savedToast, setSavedToast] = useState(false);

  const filteredStudents = students.filter(s => {
    if (s.status === 'archived') return false;
    if (selectedGroupId !== 'all' && s.groupId !== selectedGroupId) return false;
    if (filterMode === 'missing_only' && s.certificateName && s.certificateName.trim().length > 0) return false;
    if (searchQuery.trim().length > 0) {
      const q = (searchQuery || '').toLowerCase();
      const nameMatch = (s.name || '').toLowerCase().includes(q) || (s.certificateName && s.certificateName.toLowerCase().includes(q));
      if (!nameMatch) return false;
    }
    return true;
  });

  const generatePrompt = () => {
    const listToTransliterate = filteredStudents.map(s => ({
      id: s.id,
      arabicName: s.name,
      currentCertificateName: s.certificateName || ''
    }));

    return `You are an expert multilingual assistant specializing in German and English transliteration of student names for official academic certificates.
Please transliterate the following Arabic student names into clean, prestigious Latin spelling suitable for academic certificates (e.g., 'أحمد محمد السيد' -> 'Ahmed Mohamed El-Sayed', 'مريم محمود' -> 'Mariam Mahmoud').

RULES:
1. Capitalize the first letter of each name part.
2. Keep German/English standardized phonetic spelling.
3. Return ONLY a valid JSON array of objects with the exact keys: "id", "arabicName", and "certificateName". Do not include any extra markdown explanations.

JSON Data to transliterate:
${JSON.stringify(listToTransliterate, null, 2)}`;
  };

  const handleCopyPrompt = async () => {
    const prompt = generatePrompt();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = prompt;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  const handleParseAiResponse = () => {
    setParseError(null);
    setParsedResults(null);

    const raw = aiResponseText.trim();
    if (!raw) {
      setParseError(_t('يرجى لصق رد الذكاء الاصطناعي أولاً', 'Please paste the AI response first', 'Bitte fügen Sie zuerst die KI-Antwort ein'));
      return;
    }

    try {
      // Extract JSON if wrapped in markdown codeblocks
      let cleanJson = raw;
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        cleanJson = jsonMatch[1].trim();
      }

      // Try parsing JSON
      let items: any[] = [];
      try {
        items = JSON.parse(cleanJson);
      } catch (e) {
        // Fallback: try parsing line by line (e.g. "Ahmed Ali - ID / Name")
        const lines = raw.split('\n').filter(l => l.trim().length > 0);
        items = lines.map((line, idx) => {
          const parts = line.split(/[:=\t\->|]/).map(p => p.trim());
          if (parts.length >= 2) {
            return {
              arabicName: parts[0],
              certificateName: parts[1]
            };
          }
          return null;
        }).filter(Boolean);
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error(_t('تعذر قراءة الأسماء من النص الملصوق', 'Could not parse names from text', 'Konnte keine Namen aus dem Text parsen'));
      }

      // Match with current students
      const mapped = items.map(item => {
        let matchedStudent = null;
        if (item.id) {
          matchedStudent = students.find(s => s.id === item.id);
        }
        if (!matchedStudent && item.arabicName) {
          matchedStudent = students.find(s => s.name.trim().toLowerCase() === item.arabicName.trim().toLowerCase());
        }

        const certName = (item.certificateName || item.englishName || item.latinName || '').trim();

        return {
          id: matchedStudent ? matchedStudent.id : (item.id || `unknown_${Math.random()}`),
          originalName: matchedStudent ? matchedStudent.name : (item.arabicName || 'Unknown'),
          certificateName: certName,
          matched: !!matchedStudent
        };
      }).filter(res => res.certificateName.length > 0);

      if (mapped.length === 0) {
        setParseError(_t('لم يتم العثور على أسماء صالحة للتطبيق', 'No valid names found in the response', 'Keine gültigen Namen gefunden'));
        return;
      }

      setParsedResults(mapped);
    } catch (err: any) {
      setParseError(err.message || _t('حدث خطأ أثناء معالجة الرد', 'Failed to parse response', 'Fehler beim Parsen der Antwort'));
    }
  };

  const handleApplyImportedNames = () => {
    if (!parsedResults || parsedResults.length === 0) return;

    const entriesToApply = parsedResults
      .filter(r => r.matched && r.certificateName.trim().length > 0)
      .map(r => ({
        studentId: r.id,
        certificateName: r.certificateName.trim()
      }));

    if (entriesToApply.length > 0) {
      updateStudentCertificateNamesBulk(entriesToApply);
      confetti({ particleCount: 70, spread: 60 });
      setSavedToast(true);
      setTimeout(() => {
        setSavedToast(false);
        onClose();
      }, 1200);
    }
  };

  const handleSaveManualEdit = (studentId: string) => {
    const val = manualEdits[studentId];
    if (val !== undefined) {
      updateStudentCertificateName(studentId, val);
      setManualEdits(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      confetti({ particleCount: 30, spread: 35 });
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div onClick={e => e.stopPropagation()} className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-main">
                {_t('مساعد الذكاء الاصطناعي لأسماء الشهادات', 'AI Certificate Names Assistant', 'KI-Zertifikatsnamen-Assistent')}
              </h2>
              <p className="text-xs text-text-muted">
                {_t('تعريب وترجمة أسماء الطلاب للإنجليزية/الألمانية بضغطة زر واحدة', 'Transliterate Arabic student names to Latin/English for certificates', 'Studentennamen für Zertifikate in lateinische Schrift übertragen')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs sm:text-sm">
          
          {/* Search Input */}
          <div className="relative">
            <Search className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted`} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={_t('ابحث عن طالب بالاسم العربي أو الإنجليزي...', 'Search student by Arabic or English name...', 'Suche Schüler nach arabischem oder englischem Namen...')}
              className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary`}
            />
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-surface-border dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text-muted text-xs">
                {_t('المجموعة:', 'Group:', 'Gruppe:')}
              </span>
              <select
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">{_t('جميع المجموعات', 'All Groups', 'Alle Gruppen')}</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode('missing_only')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                  filterMode === 'missing_only'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-surface dark:bg-slate-900 text-text-muted hover:text-text-main border border-surface-border dark:border-slate-700'
                }`}
              >
                {_t(`بدون اسم لاتيني (${students.filter(s => !s.certificateName).length})`, `Missing Latin Name (${students.filter(s => !s.certificateName).length})`, `Ohne lateinischen Namen`)}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface dark:bg-slate-900 text-text-muted hover:text-text-main border border-surface-border dark:border-slate-700'
                }`}
              >
                {_t('الكل', 'All', 'Alle')}
              </button>
            </div>
          </div>

          {/* Workflow Step 1: Copy AI Prompt */}
          <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center justify-center">1</span>
                <h3 className="font-black text-text-main">
                  {_t('الخطوة الأولى: انسخ البرومبت وافتحه في ChatGPT أو Gemini', 'Step 1: Copy prompt for ChatGPT / Gemini', 'Schritt 1: Prompt für ChatGPT / Gemini kopieren')}
                </h3>
              </div>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                {filteredStudents.length} {_t('طلاب محددين', 'students selected', 'Schüler ausgewählt')}
              </span>
            </div>
            
            <p className="text-xs text-text-muted leading-relaxed">
              {_t(
                'يقوم النظام بتجهيز أمر ذكي يحتوي على قائمة أسماء طلابك ليقوم الذكاء الاصطناعي بتهجئتها بالإنجليزية/الألمانية وفق المعايير الأكاديمية.',
                'The system generates an optimized prompt with your students\' names to transliterate into prestigious Latin spelling.',
                'Das System generiert einen optimierten Prompt mit den Namen Ihrer Schüler für Zertifikate.'
              )}
            </p>

            <button
              onClick={handleCopyPrompt}
              className="w-full py-3 px-4 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {copiedPrompt ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{_t('تم نسخ البرومبت بنجاح! جاهز للصق', 'Prompt Copied! Ready to paste', 'Prompt kopiert! Bereit zum Einfügen')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{_t('نسخ برومبت الذكاء الاصطناعي للأمر', 'Copy AI Transliteration Prompt', 'KI-Prompt kopieren')}</span>
                </>
              )}
            </button>
          </div>

          {/* Workflow Step 2: Paste AI Response */}
          <div className="p-4 bg-primary/5 dark:bg-primary-soft border border-primary/20 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-black flex items-center justify-center">2</span>
              <h3 className="font-black text-text-main">
                {_t('الخطوة الثانية: الصق رد الذكاء الاصطناعي هنا', 'Step 2: Paste AI Response here', 'Schritt 2: KI-Antwort hier einfügen')}
              </h3>
            </div>

            <textarea
              value={aiResponseText}
              onChange={e => setAiResponseText(e.target.value)}
              placeholder={_t('الصق رد الـ JSON أو النص المستلم من الذكاء الاصطناعي هنا...', 'Paste the JSON response from Gemini or ChatGPT here...', 'Fügen Sie hier die JSON-Antwort von ChatGPT ein...')}
              rows={3}
              className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />

            {parseError && (
              <div className="flex items-center gap-2 text-rose-500 text-xs font-bold p-2 bg-rose-500/10 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleParseAiResponse}
              className="w-full py-2.5 px-4 bg-surface dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-primary dark:text-primary font-black rounded-xl border border-primary/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{_t('معالجة واستخراج الأسماء', 'Process & Extract Names', 'Namen verarbeiten & extrahieren')}</span>
            </button>
          </div>

          {/* Parsed Preview Table */}
          {parsedResults && parsedResults.length > 0 && (
            <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-black text-text-main">
                    {_t(`تم التعرف على ${parsedResults.length} اسم بنجاح`, `Extracted ${parsedResults.length} names successfully`, `${parsedResults.length} Namen erfolgreich erkannt`)}
                  </h4>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {parsedResults.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-xl text-xs">
                    <span className="font-bold text-text-muted truncate max-w-[40%]">{item.originalName}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="font-black text-emerald-600 dark:text-emerald-400 truncate max-w-[45%] text-left" dir="ltr">
                      {item.certificateName}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleApplyImportedNames}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{_t('حفظ وتطبيق هذه الأسماء على ملفات الطلاب', 'Apply & Save to Student Profiles', 'Speichern & auf Schüler anwenden')}</span>
              </button>
            </div>
          )}

          {/* Manual Quick Review List */}
          <div className="space-y-2">
            <h4 className="font-black text-text-main text-xs uppercase tracking-wider">
              {_t('مراجعة وتعديل الأسماء يدويًا:', 'Manual Review & Quick Edit:', 'Manuelle Überprüfung & Bearbeitung:')}
            </h4>
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">
                  {_t('لا يوجد طلاب مطابقين للتصفية المحددة', 'No students match current filter', 'Keine Schüler entsprechen dem Filter')}
                </div>
              ) : (
                filteredStudents.map(student => {
                  const currentVal = manualEdits[student.id] !== undefined ? manualEdits[student.id] : (student.certificateName || '');
                  const hasPendingEdit = manualEdits[student.id] !== undefined && manualEdits[student.id] !== (student.certificateName || '');

                  return (
                    <div key={student.id} className="p-2.5 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block font-black text-xs text-text-main truncate">{student.name}</span>
                        <span className="block text-[10px] text-text-muted truncate">
                          {groups.find(g => g.id === student.groupId)?.name || 'Ohne Gruppe'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="text"
                          dir="ltr"
                          placeholder="e.g. Ahmed Ali"
                          value={currentVal}
                          onChange={e => setManualEdits(prev => ({ ...prev, [student.id]: e.target.value }))}
                          className="w-36 sm:w-44 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-surface-border dark:border-slate-700 rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {hasPendingEdit && (
                          <button
                            type="button"
                            onClick={() => handleSaveManualEdit(student.id)}
                            className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-surface-border dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 text-text-main font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs"
          >
            {_t('إغلاق', 'Close', 'Schließen')}
          </button>
        </div>

      </div>
    </div>
  );
};
