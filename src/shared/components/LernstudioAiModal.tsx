import React, { useEffect, useState } from 'react';
import {
  GrammarExercise,
  GrammarExerciseType,
  LernstudioDifficulty,
  LernstudioLevel,
  LernstudioSet
} from '../../types/lernstudio';
import {
  generateLernstudioPrompt,
  generateUniversalSmartLernstudioPrompt,
  validateAndParseLernstudioJson,
  validateLernstudioSetForWorksheet
} from '../../utils/lernstudioAiUtils';
import { auth } from '../firebaseCloudSync';
import {
  AI_APPCHECK_AR,
  AI_NOT_CONFIGURED_AR,
  AI_QUOTA_AR,
  extractLernstudioSetFromImages,
  getTodayAiExtractionCount,
  isAiLogicAppCheckError,
  isAiLogicNotConfiguredError,
  isAiLogicQuotaError
} from '../../services/aiLogicService';
import {
  normalizeGrammarContent,
  normalizeLernstudioSet,
  stripHeavyGrammarMediaForSync,
  VALID_GRAMMAR_EXERCISE_TYPES
} from '../grammarEngine';
import { deletePageImageRecord } from '../lernstudioPageImageStore';

export type GrammarExtractionExerciseMode = 'original_only' | 'original_and_similar';
export interface ExtractionPageInput {
  id?: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  pageOrder?: number;
}

async function preparePageImagesForExtraction(files: File[], startIndex: number) {
  const inputs: ExtractionPageInput[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    inputs.push({
      id: `page_${Date.now()}_${i}`,
      fileName: file.name,
      mimeType: file.type || 'image/jpeg',
      dataUrl,
      pageOrder: startIndex + i
    });
  }
  return { inputs };
}
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  teacherName?: string;
  language?: string;
  initialTab?: 'generate' | 'import' | 'from_images';
  onClose: () => void;
  onImportSet: (newSet: LernstudioSet) => void;
}

export const LernstudioAiModal: React.FC<Props> = ({
  isOpen,
  teacherName,
  language = 'ar',
  initialTab = 'generate',
  onClose,
  onImportSet
}) => {
  const defaultCreatorName = teacherName?.trim() || auth?.currentUser?.displayName?.trim() || '';
  const [activeTab, setActiveTab] = useState<'simple' | 'from_images'>(
    initialTab === 'from_images' ? 'from_images' : 'simple'
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab === 'from_images' ? 'from_images' : 'simple');
    }
  }, [isOpen, initialTab]);

  // Universal Smart Prompt State
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPromptText, setShowPromptText] = useState(false);

  // Importer State
  const [pastedJson, setPastedJson] = useState('');
  const [creatorTeacherName, setCreatorTeacherName] = useState(defaultCreatorName);
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<Partial<LernstudioSet> | null>(null);
  const [validationInfo, setValidationInfo] = useState<{ warnings: string[]; repairedCount: number } | null>(null);

  // Image-to-Grammar Extractor State (kept for direct camera button)
  const [level, setLevel] = useState<LernstudioLevel>('A1');
  const [difficulty] = useState<LernstudioDifficulty>('medium');
  const [uploadedPages, setUploadedPages] = useState<ExtractionPageInput[]>([]);
  const [grammarTitleInput, setGrammarTitleInput] = useState('');
  const [grammarTopicInput, setGrammarTopicInput] = useState('');
  const [exerciseMode, setExerciseMode] = useState<GrammarExtractionExerciseMode>('original_and_similar');
  const [targetImageSetKind, setTargetImageSetKind] = useState<'grammar' | 'mixed'>('grammar');
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [isExtractingImages, setIsExtractingImages] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [extractedDraft, setExtractedDraft] = useState<LernstudioSet | null>(null);
  const [copiedVisionFallbackPrompt, setCopiedVisionFallbackPrompt] = useState(false);
  // Quota fallback: set when the free daily limit (429) is hit. The banner
  // then offers a one-tap switch to the manual paste tab (prompt auto-copied).
  const [quotaFallback, setQuotaFallback] = useState(false);
  // Info only — today's extraction request count, never a block.
  const [todayAiCount, setTodayAiCount] = useState<number>(() => getTodayAiExtractionCount());

  if (!isOpen) return null;

  const isRtl = language === 'ar';

  const generatedPrompt = generateUniversalSmartLernstudioPrompt(
    creatorTeacherName.trim() || defaultCreatorName || undefined
  );

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const evaluateJsonInput = (rawText: string) => {
    setPastedJson(rawText);
    setImportError(null);
    setValidationInfo(null);

    if (!rawText.trim()) {
      setParsedPreview(null);
      return null;
    }

    const result = validateAndParseLernstudioJson(rawText);
    if (result.success && result.data) {
      const valRes = validateLernstudioSetForWorksheet(result.data);
      setParsedPreview(valRes.repairedSet);
      if (valRes.repairedSet.createdByTeacherName?.trim() && !creatorTeacherName.trim()) {
        setCreatorTeacherName(valRes.repairedSet.createdByTeacherName.trim());
      }
      setValidationInfo({
        warnings: valRes.warnings,
        repairedCount: valRes.repairedCount
      });
      return valRes.repairedSet;
    } else {
      setParsedPreview(null);
      setImportError(result.error || (isRtl ? 'تنسيق الكود غير مكتمل أو غير صالح.' : 'Invalid JSON format.'));
      return null;
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        evaluateJsonInput(clipText);
      }
    } catch {
      // Clipboard API permission denied or unsupported; user can paste manually
    }
  };

  const handleConfirmImport = () => {
    const targetPreview = parsedPreview || evaluateJsonInput(pastedJson);
    if (!targetPreview) return;

    const hasVocab = Array.isArray(targetPreview.items) && targetPreview.items.length > 0;
    const hasGrammar =
      Boolean(targetPreview.grammarContent) ||
      (Array.isArray(targetPreview.customExercises) && targetPreview.customExercises.length > 0);
    if (!hasVocab && !hasGrammar) return;

    const resolvedTeacherName =
      creatorTeacherName.trim() ||
      (targetPreview as any).createdByTeacherName?.trim() ||
      teacherName?.trim() ||
      auth?.currentUser?.displayName?.trim() ||
      undefined;

    const fullSet: LernstudioSet = stripHeavyGrammarMediaForSync(
      normalizeLernstudioSet({
        id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: targetPreview.title || (isRtl ? 'مجموعة مستوردة' : 'Imported Set'),
        topic: targetPreview.topic || targetPreview.title || 'ألماني',
        grade: targetPreview.grade || undefined,
        level: targetPreview.level || 'A1',
        difficulty: targetPreview.difficulty || 'medium',
        setKind: targetPreview.setKind,
        contentOrigin: 'teacher_created',
        hasArticles: targetPreview.hasArticles,
        sentenceBuilderSupported: targetPreview.sentenceBuilderSupported,
        ...(resolvedTeacherName ? { createdByTeacherName: resolvedTeacherName } : {}),
        description: targetPreview.description || `مجموعة ${targetPreview.title || ''}`,
        items: targetPreview.items || [],
        customExercises: targetPreview.customExercises,
        grammarContent: targetPreview.grammarContent,
        createdAt: new Date().toISOString(),
        updatedAt: Date.now()
      })
    );

    onImportSet(fullSet);
    onClose();
  };

  const handlePageFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const remainingSlots = Math.max(0, 6 - uploadedPages.length);
    const chosen = Array.from(fileList).slice(0, remainingSlots);
    e.target.value = '';
    if (chosen.length === 0) return;

    setIsPreparingImages(true);
    setExtractionError(null);
    try {
      const { inputs } = await preparePageImagesForExtraction(chosen, uploadedPages.length + 1);
      setUploadedPages((prev) =>
        [...prev, ...inputs].map((p, idx) => ({ ...p, pageOrder: idx + 1 }))
      );
    } catch (err: any) {
      setExtractionError(
        err?.message ||
          (isRtl ? 'تعذرت قراءة وضغط الصور المختارة.' : 'Failed to read and compress selected images.')
      );
    } finally {
      setIsPreparingImages(false);
    }
  };

  const handleMovePage = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= uploadedPages.length) return;
    setUploadedPages((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next.map((p, order) => ({ ...p, pageOrder: order + 1 }));
    });
  };

  const handleRemovePage = (idx: number) => {
    const target = uploadedPages[idx];
    if (target?.id) {
      deletePageImageRecord(target.id).catch(() => {});
    }
    setUploadedPages((prev) =>
      prev.filter((_, i) => i !== idx).map((p, order) => ({ ...p, pageOrder: order + 1 }))
    );
  };

  const handleExtractGrammarFromImages = async () => {
    if (uploadedPages.length === 0 || isExtractingImages) return;
    setIsExtractingImages(true);
    setExtractionError(null);
    setExtractionWarnings([]);
    setExtractedDraft(null);
    setQuotaFallback(false);

    try {
      // All pages (max 6) go in ONE generateContent call — one quota unit.
      const pages = uploadedPages.slice(0, 6).map((p) => {
        const commaIdx = p.dataUrl.indexOf(',');
        const base64Data =
          p.dataUrl.startsWith('data:') && commaIdx >= 0 ? p.dataUrl.slice(commaIdx + 1) : p.dataUrl;
        return { mimeType: p.mimeType || 'image/jpeg', base64Data };
      });

      const { draft, warnings } = await extractLernstudioSetFromImages(
        pages,
        generatedPrompt,
        {
          title: grammarTitleInput.trim() || undefined,
          topic: grammarTopicInput.trim() || undefined,
          level,
          difficulty,
          setKind: targetImageSetKind,
          teacherName: creatorTeacherName.trim() || defaultCreatorName || undefined,
          exerciseMode
        }
      );

      // Draft only — nothing is imported here. The teacher reviews/edits the
      // draft below and only handleSaveExtractedDraft imports it.
      setExtractedDraft(draft);
      setExtractionWarnings(warnings);
    } catch (err: any) {
      if (isAiLogicQuotaError(err)) {
        setExtractionError(AI_QUOTA_AR);
        setQuotaFallback(true);
        // Copy the prompt automatically so the paste tab is ready to use.
        try {
          await navigator.clipboard.writeText(generatedPrompt);
        } catch {
          // Clipboard unavailable; the banner button still copies on tap.
        }
      } else if (isAiLogicAppCheckError(err)) {
        setExtractionError(AI_APPCHECK_AR);
      } else if (isAiLogicNotConfiguredError(err)) {
        setExtractionError(AI_NOT_CONFIGURED_AR);
      } else {
        setExtractionError(
          err?.message ||
            (isRtl
              ? 'تعذّر الاستخراج التلقائي — حاول مرة أخرى أو استخدم لصق الكود اليدوي.'
              : 'Automatic extraction failed — try again or use manual code paste.')
        );
      }
    } finally {
      // Never spin forever: the service enforces a 120s timeout.
      setIsExtractingImages(false);
      setTodayAiCount(getTodayAiExtractionCount());
    }
  };

  // One-tap quota fallback: copy the prompt and switch to the paste tab.
  const handleQuotaFallbackToPaste = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
    } catch {
      // Clipboard unavailable; user can still copy from the paste tab.
    }
    setActiveTab('simple');
  };

  const handleCopyVisionFallbackPrompt = () => {
    const prompt = generateLernstudioPrompt({
      topic:
        grammarTopicInput.trim() ||
        grammarTitleInput.trim() ||
        'استخراج درس القواعد والتمارين من صور صفحات الكتاب المرفقة',
      level,
      difficulty,
      itemCount: 'auto',
      teacherName: creatorTeacherName.trim() || defaultCreatorName || undefined,
      setMode: 'auto'
    });
    navigator.clipboard.writeText(prompt);
    setCopiedVisionFallbackPrompt(true);
    setTimeout(() => setCopiedVisionFallbackPrompt(false), 2500);
  };

  const handleUpdateDraftExercise = (idx: number, patch: Partial<GrammarExercise>) => {
    if (!extractedDraft?.grammarContent) return;
    const nextExercises = extractedDraft.grammarContent.exercises.map((ex, i) =>
      i === idx ? { ...ex, ...patch } : ex
    );
    setExtractedDraft({
      ...extractedDraft,
      grammarContent: {
        ...extractedDraft.grammarContent,
        exercises: nextExercises
      }
    });
  };

  const handleRemoveDraftExercise = (idx: number) => {
    if (!extractedDraft?.grammarContent) return;
    setExtractedDraft({
      ...extractedDraft,
      grammarContent: {
        ...extractedDraft.grammarContent,
        exercises: extractedDraft.grammarContent.exercises.filter((_, i) => i !== idx)
      }
    });
  };

  const handleAddDraftExercise = () => {
    if (!extractedDraft?.grammarContent) return;
    const newEx: GrammarExercise = {
      id: `gexq_manual_${Date.now()}`,
      type: 'multiple_choice',
      question: '',
      options: ['', '', ''],
      correctAnswer: '',
      explanationAr: '',
      source: 'original'
    };
    setExtractedDraft({
      ...extractedDraft,
      grammarContent: {
        ...extractedDraft.grammarContent,
        exercises: [...extractedDraft.grammarContent.exercises, newEx]
      }
    });
  };

  const handleAddDraftRule = () => {
    if (!extractedDraft?.grammarContent) return;
    setExtractedDraft({
      ...extractedDraft,
      grammarContent: {
        ...extractedDraft.grammarContent,
        rules: [
          ...extractedDraft.grammarContent.rules,
          { id: `rule_manual_${Date.now()}`, title: '', pattern: '', summaryAr: '' }
        ]
      }
    });
  };

  const handleUpdateDraftRule = (idx: number, patch: Partial<{ title: string; pattern: string; summaryAr: string }>) => {
    if (!extractedDraft?.grammarContent) return;
    setExtractedDraft({
      ...extractedDraft,
      grammarContent: {
        ...extractedDraft.grammarContent,
        rules: extractedDraft.grammarContent.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r))
      }
    });
  };

  const handleRemoveDraftRule = (idx: number) => {
    if (!extractedDraft?.grammarContent) return;
    setExtractedDraft({
      ...extractedDraft,
      grammarContent: {
        ...extractedDraft.grammarContent,
        rules: extractedDraft.grammarContent.rules.filter((_, i) => i !== idx)
      }
    });
  };

  const handleAddDraftExample = () => {
    if (!extractedDraft?.grammarContent) return;
    setExtractedDraft({
      ...extractedDraft,
      grammarContent: {
        ...extractedDraft.grammarContent,
        examples: [
          ...extractedDraft.grammarContent.examples,
          { id: `gex_manual_${Date.now()}`, german: '', arabic: '' }
        ]
      }
    });
  };

  const handleUpdateDraftExample = (idx: number, patch: Partial<{ german: string; arabic: string }>) => {
    if (!extractedDraft?.grammarContent) return;
    setExtractedDraft({
      ...extractedDraft,
      grammarContent: {
        ...extractedDraft.grammarContent,
        examples: extractedDraft.grammarContent.examples.map((ex, i) => (i === idx ? { ...ex, ...patch } : ex))
      }
    });
  };

  const handleRemoveDraftExample = (idx: number) => {
    if (!extractedDraft?.grammarContent) return;
    setExtractedDraft({
      ...extractedDraft,
      grammarContent: {
        ...extractedDraft.grammarContent,
        examples: extractedDraft.grammarContent.examples.filter((_, i) => i !== idx)
      }
    });
  };

  const handleSaveExtractedDraft = () => {
    if (!extractedDraft) return;
    const resolvedTeacherName =
      creatorTeacherName.trim() ||
      extractedDraft.createdByTeacherName?.trim() ||
      teacherName?.trim() ||
      auth?.currentUser?.displayName?.trim() ||
      undefined;

    const validExercises = (extractedDraft.grammarContent?.exercises || []).filter(
      (ex) => ex.question.trim() && ex.correctAnswer.trim()
    );

    const normalizedGrammar = normalizeGrammarContent(
      {
        ...(extractedDraft.grammarContent || {}),
        exercises: validExercises,
        origin: 'teacher_created'
      },
      extractedDraft.title,
      extractedDraft.topic,
      'teacher_created'
    );

    const finalSet = stripHeavyGrammarMediaForSync(
      normalizeLernstudioSet({
        ...extractedDraft,
        ...(resolvedTeacherName ? { createdByTeacherName: resolvedTeacherName } : {}),
        grammarContent: normalizedGrammar,
        contentOrigin: 'teacher_created',
        updatedAt: Date.now()
      })
    );

    onImportSet(finalSet);
    onClose();
  };

  const setKindLabelAr = (kind?: string) => {
    if (kind === 'grammar') return 'قواعد (Grammar)';
    if (kind === 'verb_group') return 'أفعال وتصريف (Verbs)';
    if (kind === 'mixed') return 'شامل: كلمات + قواعد (Mixed)';
    return 'كلمات ومفردات (Vocab)';
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Clean Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-text-main">
              {isRtl ? 'إضافة درس بالذكاء الاصطناعي (برومبت شامل)' : 'Smart AI Lesson Set'}
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

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'simple' && (
            <div className="space-y-5">
              {/* STEP 1: Copy Smart Prompt */}
              <div className="p-4 bg-surface-hover border border-surface-border rounded-2xl space-y-3">
                <div className="space-y-1">
                  <h3 className="text-xs sm:text-sm font-black text-text-main">
                    {isRtl
                      ? '1. انسخ البرومبت الذكي وصوّر الدرس للـ AI'
                      : '1. Copy Smart Prompt & Send Lesson Photo to AI'}
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {isRtl
                      ? 'انسخ البرومبت الشامل وابعته مع صورة الدرس لأي ذكاء اصطناعي (ChatGPT أو Gemini) — هو هيختار كل حاجة لوحده، ولو معرفش هيسألك عن نوع السيت والجريد.'
                      : 'Copy this universal prompt and send it with a photo of the lesson page to any AI. It will detect everything automatically or ask you for the Set Type and Grade if unclear.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    copiedPrompt
                      ? 'bg-emerald-600 text-white'
                      : 'bg-primary hover:bg-primary-hover text-white'
                  }`}
                >
                  {copiedPrompt ? <Check className="w-4 h-4 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                  <span>
                    {copiedPrompt
                      ? isRtl
                        ? 'تم نسخ البرومبت الشامل! ابعته الآن مع صورة الدرس للـ AI'
                        : 'Copied! Send it with your lesson photo to AI'
                      : isRtl
                      ? 'نسخ البرومبت الشامل (Copy Prompt)'
                      : 'Copy Universal Smart Prompt'}
                  </span>
                </button>

                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowPromptText((prev) => !prev)}
                    className="text-[11px] font-bold text-text-muted hover:text-text-main inline-flex items-center gap-1 cursor-pointer"
                  >
                    {showPromptText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>
                      {showPromptText
                        ? isRtl
                          ? 'إخفاء نص البرومبت'
                          : 'Hide prompt text'
                        : isRtl
                        ? 'معاينة نص البرومبت (اختياري)'
                        : 'Preview prompt text (optional)'}
                    </span>
                  </button>
                </div>

                {showPromptText && (
                  <textarea
                    readOnly
                    value={generatedPrompt}
                    rows={6}
                    dir="rtl"
                    className="w-full p-3 bg-surface border border-surface-border rounded-xl text-[11px] font-mono text-text-main focus:outline-none resize-none"
                  />
                )}
              </div>

              {/* STEP 2: Paste JSON & Save */}
              <div className="p-4 bg-surface-hover border border-surface-border rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-black text-text-main">
                    {isRtl
                      ? '2. الصق كود الـ JSON اللي طلعه الـ AI هنا'
                      : '2. Paste the AI JSON Code Here'}
                  </h3>

                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border/40 border border-surface-border text-primary text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'لصق الكود' : 'Paste Code'}</span>
                  </button>
                </div>

                <textarea
                  value={pastedJson}
                  onChange={(e) => evaluateJsonInput(e.target.value)}
                  rows={6}
                  dir="ltr"
                  placeholder='{\n  "title": "...",\n  "setKind": "vocab | grammar | mixed",\n  "grade": "جريد 4",\n  ...\n}'
                  className="w-full p-3 bg-surface border border-surface-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-primary resize-none"
                />

                {importError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {parsedPreview && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-emerald-700 dark:text-emerald-300">
                      ✓ {parsedPreview.title} · {setKindLabelAr(parsedPreview.setKind)}
                      {parsedPreview.grade ? ` · ${parsedPreview.grade}` : ''}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {parsedPreview.items?.length || 0} {isRtl ? 'كلمة' : 'items'}
                      {parsedPreview.grammarContent
                        ? ` · ${parsedPreview.grammarContent.rules.length} ${isRtl ? 'قواعد' : 'rules'} · ${parsedPreview.grammarContent.exercises.length} ${isRtl ? 'تمارين قواعد' : 'exercises'}`
                        : ''}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!pastedJson.trim() || Boolean(importError)}
                  className="w-full py-3 px-4 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>
                    {isRtl ? 'حفظ وإضافة السيت الآن' : 'Save & Import Set Now'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'from_images' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('simple')}
                  className="px-3 py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-primary cursor-pointer"
                >
                  {isRtl ? '← العودة لنسخ البرومبت الشامل ولصق الكود' : '← Back to Simple Copy Prompt & Paste JSON'}
                </button>
              </div>
              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-1">
                <h3 className="text-xs font-black text-primary flex items-center gap-1.5">
                  <Camera className="w-4 h-4" />
                  <span>
                    {isRtl
                      ? 'تحويل صور صفحات الكتاب / كراسة التدريبات إلى درس قواعد متكامل'
                      : 'Extract Grammar Lesson & Exercises from Textbook Images'}
                  </span>
                </h3>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {isRtl
                    ? 'ارفع من 1 إلى 6 صور لصفحات الدرس والتمارين. يتم تحليل الصور واستخراج الشرح والأمثلة والتمارين الأصلية بتمييز واضح عن التمارين المولّدة، مع إمكانية المراجعة والتعديل قبل الحفظ.'
                    : 'Upload 1–6 workbook pages. Original exercises and optional AI-generated practice are clearly separated and editable before saving.'}
                </p>
              </div>

              {/* Upload Controls & Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {isRtl ? 'عنوان درس القواعد (اختياري):' : 'Lesson Title (optional):'}
                  </label>
                  <input
                    type="text"
                    value={grammarTitleInput}
                    onChange={(e) => setGrammarTitleInput(e.target.value)}
                    placeholder="مثال: Präsens – الأفعال المنتظمة"
                    className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {isRtl ? 'الموضوع النحوي (اختياري):' : 'Grammar Topic (optional):'}
                  </label>
                  <input
                    type="text"
                    value={grammarTopicInput}
                    onChange={(e) => setGrammarTopicInput(e.target.value)}
                    placeholder="مثال: Akkusativ / Modalverben"
                    className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {isRtl ? 'المستوى:' : 'CEFR Level:'}
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as LernstudioLevel)}
                    className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                  </select>
                </div>
              </div>

              {/* Extraction Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-surface-hover border border-surface-border rounded-xl space-y-2">
                  <span className="text-[11px] font-black text-text-main block">
                    {isRtl ? 'نطاق استخراج التمارين:' : 'Exercise Extraction Mode:'}
                  </span>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="exerciseMode"
                      checked={exerciseMode === 'original_only'}
                      onChange={() => setExerciseMode('original_only')}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block">{isRtl ? 'حفظ تمارين الصفحة الأصلية فقط' : 'Original Page Exercises Only'}</strong>
                      <span className="text-[10.5px] text-text-muted">
                        {isRtl ? 'دون إضافة تمارين مولّدة إضافية' : 'No extra AI-generated items'}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="exerciseMode"
                      checked={exerciseMode === 'original_and_similar'}
                      onChange={() => setExerciseMode('original_and_similar')}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block">
                        {isRtl ? 'تمارين الصفحة + تمارين مشابهة بالذكاء الاصطناعي' : 'Original + Similar AI Practice'}
                      </strong>
                      <span className="text-[10.5px] text-text-muted">
                        {isRtl ? 'مع شارة واضحة تميّز الأصلي عن المولّد' : 'Separately badged original vs generated'}
                      </span>
                    </span>
                  </label>
                </div>

                <div className="p-3 bg-surface-hover border border-surface-border rounded-xl space-y-2">
                  <span className="text-[11px] font-black text-text-main block">
                    {isRtl ? 'نوع المجموعة الناتجة:' : 'Result Set Format:'}
                  </span>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="targetImageSetKind"
                      checked={targetImageSetKind === 'grammar'}
                      onChange={() => setTargetImageSetKind('grammar')}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block">{isRtl ? 'مجموعة قواعد خالصة (Grammar Set)' : 'Pure Grammar Set'}</strong>
                      <span className="text-[10.5px] text-text-muted">
                        {isRtl ? 'تعمل بدون اشتراط كلمات مفردات (items: [])' : 'Works directly without vocab list'}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="targetImageSetKind"
                      checked={targetImageSetKind === 'mixed'}
                      onChange={() => setTargetImageSetKind('mixed')}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block">{isRtl ? 'مجموعة مختلطة (قواعد + مفردات)' : 'Mixed (Grammar + Vocab)'}</strong>
                      <span className="text-[10.5px] text-text-muted">
                        {isRtl ? 'تستخرج كلمات الصفحة أيضاً إن وجدت' : 'Also extracts printed vocabulary items'}
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Multi-Page File Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-hover hover:bg-surface border border-dashed border-primary/50 text-xs font-bold text-primary cursor-pointer transition-colors">
                    {isPreparingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    <span>
                      {isRtl
                        ? `اختيار صور الصفحات (${uploadedPages.length}/6)`
                        : `Select Page Images (${uploadedPages.length}/6)`}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={uploadedPages.length >= 6 || isPreparingImages}
                      onChange={handlePageFilesSelected}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleExtractGrammarFromImages}
                    disabled={uploadedPages.length === 0 || isExtractingImages}
                    className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                  >
                    {isExtractingImages ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>
                      {isExtractingImages
                        ? isRtl
                          ? 'جارٍ تحليل الصفحات...'
                          : 'Analyzing Pages...'
                        : isRtl
                        ? 'استخراج الشرح والتمارين'
                        : 'Extract Lesson & Exercises'}
                    </span>
                  </button>
                </div>

                {todayAiCount > 0 && (
                  <p className="text-[11px] text-text-muted">
                    {isRtl
                      ? `استخدمت ${todayAiCount} ${todayAiCount === 1 ? 'طلباً' : 'طلبات'} استخراج اليوم (معلومة فقط — الحد اليومي المجاني يُصفَّر بعد منتصف الليل بتوقيت المحيط الهادئ).`
                      : `Used ${todayAiCount} extraction request(s) today (info only — the free daily limit resets after midnight Pacific Time).`}
                  </p>
                )}

                {uploadedPages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {uploadedPages.map((page, idx) => (
                      <div
                        key={page.id || idx}
                        className="relative rounded-xl border border-surface-border bg-surface-hover overflow-hidden p-1.5 space-y-1"
                      >
                        <img
                          src={page.dataUrl}
                          alt={page.fileName}
                          className="w-full h-28 object-cover rounded-lg border border-surface-border/60"
                        />
                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-text-muted px-0.5">
                          <span className="truncate">
                            #{idx + 1} {page.fileName}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMovePage(idx, -1)}
                              disabled={idx === 0}
                              className="p-0.5 rounded hover:bg-surface disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePage(idx, 1)}
                              disabled={idx === uploadedPages.length - 1}
                              className="p-0.5 rounded hover:bg-surface disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePage(idx)}
                              className="p-0.5 rounded text-red-500 hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error Banner (Honest Feedback + Manual Fallback Option) */}
              {extractionError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 rounded-xl text-xs space-y-2">
                  <div className="flex items-start gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{extractionError}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={handleCopyVisionFallbackPrompt}
                      className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text-main text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      {copiedVisionFallbackPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>
                        {copiedVisionFallbackPrompt
                          ? isRtl
                            ? 'تم نسخ برومبت القواعد'
                            : 'Copied Prompt'
                          : isRtl
                          ? 'نسخ برومبت لاستخدامه مع Gemini خارجياً'
                          : 'Copy Grammar Prompt for External AI'}
                      </span>
                    </button>
                    {quotaFallback && (
                      <button
                        type="button"
                        onClick={handleQuotaFallbackToPaste}
                        className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <ClipboardPaste className="w-3 h-3" />
                        <span>
                          {isRtl
                            ? 'تم نسخ البرومبت — انتقل للصق الكود ←'
                            : 'Prompt copied — go to Paste Code →'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('simple')}
                      className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-[11px] font-bold cursor-pointer"
                    >
                      {isRtl ? 'الانتقال إلى لصق الكود →' : 'Go to Paste Code →'}
                    </button>
                  </div>
                </div>
              )}

              {/* Editable Extracted Grammar Preview */}
              {extractedDraft && extractedDraft.grammarContent && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/30 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 block">
                        ✓ {isRtl ? 'تم استخراج درس القواعد — راجع وعدّل قبل الحفظ:' : 'Extracted Grammar Draft — Review & Edit:'}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {isRtl
                          ? `${extractedDraft.grammarContent.rules.length} قواعد · ${extractedDraft.grammarContent.examples.length} أمثلة · ${extractedDraft.grammarContent.exercises.length} تمرين`
                          : `${extractedDraft.grammarContent.rules.length} rules · ${extractedDraft.grammarContent.examples.length} examples · ${extractedDraft.grammarContent.exercises.length} exercises`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveExtractedDraft}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'حفظ واعتماد مجموعة القواعد' : 'Save Grammar Set'}</span>
                    </button>
                  </div>

                  {extractionWarnings.length > 0 && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                      <span className="font-black flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'تنبيهات المراجعة:' : 'Review Warnings:'}</span>
                      </span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {extractionWarnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Editable Header Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                        {isRtl ? 'عنوان المجموعة:' : 'Set Title:'}
                      </label>
                      <input
                        type="text"
                        value={extractedDraft.title}
                        onChange={(e) => setExtractedDraft({ ...extractedDraft, title: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-xs font-bold text-text-main"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                        {isRtl ? 'موضوع القاعدة:' : 'Grammar Topic:'}
                      </label>
                      <input
                        type="text"
                        value={extractedDraft.grammarContent.grammarTopic}
                        onChange={(e) =>
                          setExtractedDraft({
                            ...extractedDraft,
                            topic: e.target.value,
                            grammarContent: {
                              ...extractedDraft.grammarContent!,
                              grammarTopic: e.target.value
                            }
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-xs font-bold text-text-main"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                        {isRtl ? 'ملخص الشرح بالعربية:' : 'Arabic Explanation:'}
                      </label>
                      <textarea
                        rows={2}
                        value={extractedDraft.grammarContent.explanationAr}
                        onChange={(e) =>
                          setExtractedDraft({
                            ...extractedDraft,
                            grammarContent: {
                              ...extractedDraft.grammarContent!,
                              explanationAr: e.target.value
                            }
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-xs text-text-main"
                      />
                    </div>
                  </div>

                  {/* Extracted Rules Editable List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-text-main">
                        {isRtl
                          ? `القواعد المستخرجة (${extractedDraft.grammarContent.rules.length}):`
                          : `Extracted Rules (${extractedDraft.grammarContent.rules.length}):`}
                      </span>
                      <button
                        type="button"
                        onClick={handleAddDraftRule}
                        className="px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-primary text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isRtl ? 'إضافة قاعدة' : 'Add Rule'}</span>
                      </button>
                    </div>
                    {extractedDraft.grammarContent.rules.map((r, rIdx) => (
                      <div
                        key={r.id || rIdx}
                        className="p-2 rounded-xl bg-surface border border-surface-border grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                      >
                        <input
                          type="text"
                          value={r.title}
                          onChange={(e) => handleUpdateDraftRule(rIdx, { title: e.target.value })}
                          placeholder={isRtl ? 'عنوان القاعدة' : 'Rule title'}
                          className="sm:col-span-3 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-bold"
                        />
                        <input
                          type="text"
                          value={r.pattern || ''}
                          onChange={(e) => handleUpdateDraftRule(rIdx, { pattern: e.target.value })}
                          placeholder="Subjekt + Verb..."
                          dir="ltr"
                          className="sm:col-span-3 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={r.summaryAr}
                          onChange={(e) => handleUpdateDraftRule(rIdx, { summaryAr: e.target.value })}
                          placeholder={isRtl ? 'شرح القاعدة بالعربية' : 'Arabic summary'}
                          className="sm:col-span-5 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftRule(rIdx)}
                          className="sm:col-span-1 p-1 text-text-muted hover:text-red-500 justify-self-end cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Extracted Examples Editable List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-text-main">
                        {isRtl
                          ? `الأمثلة المستخرجة (${extractedDraft.grammarContent.examples.length}):`
                          : `Extracted Examples (${extractedDraft.grammarContent.examples.length}):`}
                      </span>
                      <button
                        type="button"
                        onClick={handleAddDraftExample}
                        className="px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-primary text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isRtl ? 'إضافة مثال' : 'Add Example'}</span>
                      </button>
                    </div>
                    {extractedDraft.grammarContent.examples.map((ex, eIdx) => (
                      <div
                        key={ex.id || eIdx}
                        className="p-2 rounded-xl bg-surface border border-surface-border grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                      >
                        <input
                          type="text"
                          value={ex.german}
                          onChange={(e) => handleUpdateDraftExample(eIdx, { german: e.target.value })}
                          placeholder="Ich habe einen Hund."
                          dir="ltr"
                          className="sm:col-span-6 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-bold"
                        />
                        <input
                          type="text"
                          value={ex.arabic}
                          onChange={(e) => handleUpdateDraftExample(eIdx, { arabic: e.target.value })}
                          placeholder="أنا لدي كلب."
                          className="sm:col-span-5 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftExample(eIdx)}
                          className="sm:col-span-1 p-1 text-text-muted hover:text-red-500 justify-self-end cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Extracted Exercises Editable List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-text-main">
                        {isRtl
                          ? `التمارين المستخرجة والمولّدة (${extractedDraft.grammarContent.exercises.length}):`
                          : `Extracted & Generated Exercises (${extractedDraft.grammarContent.exercises.length}):`}
                      </span>
                      <button
                        type="button"
                        onClick={handleAddDraftExercise}
                        className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isRtl ? 'إضافة تمرين' : 'Add Exercise'}</span>
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                      {extractedDraft.grammarContent.exercises.map((ex, idx) => (
                        <div
                          key={ex.id || idx}
                          className={`p-3 rounded-xl border bg-surface space-y-2 ${
                            ex.isUncertain ? 'border-amber-500/60' : 'border-surface-border'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-black text-primary">#{idx + 1}</span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  ex.source === 'generated'
                                    ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {ex.source === 'generated'
                                  ? isRtl
                                    ? '✨ مولّد بالذكاء الاصطناعي'
                                    : 'AI Generated'
                                  : isRtl
                                  ? '📄 أصلي من الكتاب'
                                  : 'Original from Page'}
                              </span>
                              {ex.isUncertain && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDraftExercise(idx, { isUncertain: false })}
                                  className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                                  title={isRtl ? 'اضغط لتأكيد المراجعة' : 'Click to mark reviewed'}
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{isRtl ? 'يحتاج مراجعة (تأكيد ✓)' : 'Needs Review (Confirm ✓)'}</span>
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <select
                                value={ex.type}
                                onChange={(e) =>
                                  handleUpdateDraftExercise(idx, {
                                    type: e.target.value as GrammarExerciseType
                                  })
                                }
                                className="px-2 py-0.5 rounded-lg border border-surface-border bg-surface-hover text-[10.5px] font-bold"
                              >
                                {VALID_GRAMMAR_EXERCISE_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftExercise(idx)}
                                className="p-1 text-text-muted hover:text-red-500 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {ex.isUncertain && ex.uncertaintyReason && (
                            <p className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg">
                              {ex.uncertaintyReason}
                            </p>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-text-muted block">
                                {isRtl ? 'نص السؤال / الجملة:' : 'Question:'}
                              </label>
                              <input
                                type="text"
                                value={ex.question}
                                onChange={(e) => handleUpdateDraftExercise(idx, { question: e.target.value })}
                                dir="ltr"
                                className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-text-muted block">
                                {isRtl ? 'الإجابة الصحيحة:' : 'Correct Answer:'}
                              </label>
                              <input
                                type="text"
                                value={ex.correctAnswer}
                                onChange={(e) =>
                                  handleUpdateDraftExercise(idx, {
                                    correctAnswer: e.target.value,
                                    isUncertain: false
                                  })
                                }
                                dir="ltr"
                                className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-bold"
                              />
                            </div>

                            {(ex.type === 'multiple_choice' ||
                              ex.type === 'choose_correct_sentence' ||
                              ex.type === 'fill_blank' ||
                              ex.type === 'correct_mistake') && (
                              <div>
                                <label className="text-[10px] font-bold text-text-muted block">
                                  {isRtl ? 'الخيارات (افصل بـ |):' : 'Options (separate with |):'}
                                </label>
                                <input
                                  type="text"
                                  value={(ex.options || []).join(' | ')}
                                  onChange={(e) =>
                                    handleUpdateDraftExercise(idx, {
                                      options: e.target.value
                                        .split('|')
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    })
                                  }
                                  dir="ltr"
                                  placeholder="habe | hast | hat"
                                  className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                                />
                              </div>
                            )}

                            {ex.type === 'sentence_ordering' && (
                              <div>
                                <label className="text-[10px] font-bold text-text-muted block">
                                  {isRtl ? 'كلمات الترتيب (افصل بـ |):' : 'Ordering Tokens (separate with |):'}
                                </label>
                                <input
                                  type="text"
                                  value={(ex.tokens || []).join(' | ')}
                                  onChange={(e) =>
                                    handleUpdateDraftExercise(idx, {
                                      tokens: e.target.value
                                        .split('|')
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    })
                                  }
                                  dir="ltr"
                                  placeholder="Ich | gehe | heute | ins | Kino."
                                  className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                                />
                              </div>
                            )}

                            <div>
                              <label className="text-[10px] font-bold text-text-muted block">
                                {isRtl ? 'إجابات بديلة مقبولة (افصل بـ |):' : 'Accepted Alternatives (|):'}
                              </label>
                              <input
                                type="text"
                                value={(ex.acceptedAnswers || []).join(' | ')}
                                onChange={(e) =>
                                  handleUpdateDraftExercise(idx, {
                                    acceptedAnswers: e.target.value
                                      .split('|')
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                  })
                                }
                                dir="ltr"
                                placeholder="alternative answer 1 | variant 2"
                                className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-text-muted block">
                                {isRtl ? 'تعليل / شرح الحل بالعربية:' : 'Explanation (Ar):'}
                              </label>
                              <input
                                type="text"
                                value={ex.explanationAr || ''}
                                onChange={(e) => handleUpdateDraftExercise(idx, { explanationAr: e.target.value })}
                                placeholder="شرح مختصر لسبب صحة الإجابة..."
                                className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
