import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { AICertificateBackground, CertificateRecord } from '../../types';
import { 
  AI_STYLE_PRESETS, 
  AIBackgroundStyleKey, 
  generateAIBackgroundPrompt, 
  validateCertificateBackgroundFile, 
  BackgroundValidationResult,
  getSavedAIBackgrounds, 
  saveAIBackground, 
  deleteAIBackground, 
  updateAIBackground 
} from '../../utils/aiBackgroundUtils';
import { CertificateRenderer } from './templates/CertificateRenderer';
import { getTeacherEnglishName, getTeacherArabicName } from '../../utils/teacherUtils';
import { 
  Sparkles, Copy, Check, Upload, Trash2, Edit2, Eye, ShieldCheck, 
  AlertTriangle, Image as ImageIcon, Plus, Info, RefreshCw, X, Award, 
  ExternalLink, Layers, CheckCircle2, ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AIBackgroundDesignerModalProps {
  onClose: () => void;
  onSelectBackgroundForIssue?: (bg: AICertificateBackground) => void;
}

export const AIBackgroundDesignerModal: React.FC<AIBackgroundDesignerModalProps> = ({
  onClose,
  onSelectBackgroundForIssue
}) => {
  const { _t, language, profile } = useApp();

  const [activeTab, setActiveTab] = useState<'library' | 'generator' | 'import'>('library');
  const [savedBackgrounds, setSavedBackgrounds] = useState<AICertificateBackground[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // --- Prompt Generator State ---
  const [selectedStyle, setSelectedStyle] = useState<AIBackgroundStyleKey>('luxury_gold_navy');
  const [selectedPlatform, setSelectedPlatform] = useState<'general' | 'midjourney' | 'dalle' | 'firefly' | 'bing'>('general');
  const [customColorPalette, setCustomColorPalette] = useState('');
  const [extraDetails, setExtraDetails] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // --- Import & Validation State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<BackgroundValidationResult | null>(null);
  const [backgroundName, setBackgroundName] = useState('');
  const [textColorMode, setTextColorMode] = useState<'dark' | 'light' | 'gold_on_dark'>('dark');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- Live Preview Demo State in Modal ---
  const [previewSampleLang, setPreviewSampleLang] = useState<'ar' | 'de' | 'en'>('ar');
  const [previewingBg, setPreviewingBg] = useState<AICertificateBackground | null>(null);
  const [editingBgId, setEditingBgId] = useState<string | null>(null);
  const [editingBgName, setEditingBgName] = useState('');

  // Load saved backgrounds on mount
  const refreshLibrary = async () => {
    setIsLoadingList(true);
    const list = await getSavedAIBackgrounds();
    setSavedBackgrounds(list);
    setIsLoadingList(false);
  };

  useEffect(() => {
    refreshLibrary();
  }, []);

  // Update prompt whenever options change
  useEffect(() => {
    const prompt = generateAIBackgroundPrompt({
      style: selectedStyle,
      aiPlatform: selectedPlatform,
      colorPalette: customColorPalette,
      extraDetails
    });
    setGeneratedPrompt(prompt);
  }, [selectedStyle, selectedPlatform, customColorPalette, extraDetails]);

  // Handle Copy Prompt
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Handle file selection and validation
  const handleFileChange = async (file: File) => {
    setImportedFile(file);
    setIsProcessingFile(true);
    const result = await validateCertificateBackgroundFile(file);
    setValidationResult(result);
    setIsProcessingFile(false);

    if (result.isValid) {
      const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setBackgroundName(defaultName || `AI Background ${savedBackgrounds.length + 1}`);
      // Recommend initial text color mode based on current style
      setTextColorMode(AI_STYLE_PRESETS[selectedStyle]?.recommendedTextColor || 'dark');
    }
  };

  // Handle Save Imported Background
  const handleSaveBackground = async (andUse: boolean = false) => {
    if (!validationResult || !validationResult.isValid) return;
    setIsSaving(true);

    try {
      const newBg = await saveAIBackground({
        name: backgroundName.trim() || `AI Background ${Date.now()}`,
        imageUrl: validationResult.dataUrl,
        width: validationResult.width,
        height: validationResult.height,
        aspectRatio: validationResult.aspectRatio,
        textColorMode,
        fileSizeKB: validationResult.fileSizeKB,
        promptUsed: generatedPrompt
      });

      confetti({ particleCount: 60, spread: 50 });
      await refreshLibrary();

      // Reset import state
      setImportedFile(null);
      setValidationResult(null);
      setBackgroundName('');

      if (andUse && onSelectBackgroundForIssue) {
        onSelectBackgroundForIssue(newBg);
        onClose();
      } else {
        setActiveTab('library');
      }
    } catch (err) {
      console.error('Failed to save background:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Background
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(_t('هل أنت متأكد من حذف هذه الخلفية من مكتبتك؟', 'Are you sure you want to delete this background?', 'Möchten Sie diesen Hintergrund wirklich löschen?'))) {
      const updated = await deleteAIBackground(id);
      setSavedBackgrounds(updated);
      if (previewingBg?.id === id) setPreviewingBg(null);
    }
  };

  // Handle Rename Background
  const handleSaveRename = async (id: string) => {
    if (!editingBgName.trim()) return;
    const updated = await updateAIBackground(id, { name: editingBgName.trim() });
    setSavedBackgrounds(updated);
    setEditingBgId(null);
  };

  // Sample certificate record for live renderer preview
  const sampleCertificateRecord: Partial<CertificateRecord> = {
    title: previewSampleLang === 'ar' ? 'شهادة تقدير وتفوق' : previewSampleLang === 'de' ? 'Anerkennungsurkunde' : 'Certificate of Achievement',
    subtitle: previewSampleLang === 'ar' ? 'للتميز الأكاديمي والالتزام النموذجي في دراسة اللغة الألمانية' : previewSampleLang === 'de' ? 'Für herausragende schulische Leistungen im Deutschkurs' : 'For outstanding academic excellence and exemplary commitment',
    recipientName: previewSampleLang === 'ar' ? 'أحمد محمود الشناوي' : previewSampleLang === 'de' ? 'Maximilian Schneider' : 'Alexander William Smith',
    studentName: previewSampleLang === 'ar' ? 'أحمد محمود الشناوي' : previewSampleLang === 'de' ? 'Maximilian Schneider' : 'Alexander William Smith',
    description: previewSampleLang === 'ar' 
      ? 'تقديرًا للجهود المتميزة والمثابرة العالية وتحقيق إنجازات استثنائية مشرفة في دراسة اللغة الألمانية.' 
      : previewSampleLang === 'de'
      ? 'In Anerkennung herausragender Leistungen, kontinuierlichen Engagements und vorbildlicher Fortschritte.'
      : 'In recognition of exceptional dedication, continuous commitment, and remarkable accomplishments.',
    language: previewSampleLang,
    issueDate: new Date().toISOString().split('T')[0],
    teacherName: previewSampleLang === 'ar' ? getTeacherArabicName(profile, 'أ. عمر حسن') : getTeacherEnglishName(profile, 'Herr Omar Hassan'),
    instructorName: previewSampleLang === 'ar' ? getTeacherArabicName(profile, 'أ. عمر حسن') : getTeacherEnglishName(profile, 'Herr Omar Hassan'),
    centerOrSchoolName: previewSampleLang === 'ar' ? 'أكاديمية التميز للغات' : previewSampleLang === 'de' ? 'Glück Sprachenzentrum' : 'Glück Language Academy',
    score: previewSampleLang === 'ar' ? 'ممتاز (98%)' : previewSampleLang === 'de' ? 'Sehr Gut (1.0)' : 'Grade A+ (98%)',
    customBackgroundUrl: previewingBg?.imageUrl || validationResult?.dataUrl || '',
    customBackgroundTextColor: previewingBg?.textColorMode || textColorMode,
    template: 'custom_ai_bg'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md overflow-y-auto">
      <div className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-surface-border dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-main flex items-center gap-2">
                <span>{_t('مصمم خلفيات الشهادات AI', 'AI Certificate Background Designer', 'KI-Zertifikate Hintergrund Designer')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
                  {_t('AI يصمم الخلفية • التطبيق يملك البيانات', 'AI designs bg • App owns data', 'KI Hintergrund • App Daten')}
                </span>
              </h2>
              <p className="text-xs text-text-muted">
                {_t('صمم خلفيات نقية بدون نصوص بواسطة AI واستوردها لتطبيق بيانات الطلاب والشهادات ديناميكياً بدقة متناهية', 'Generate clean backgrounds using AI & import them as certificate templates with dynamic data overlays', 'Erstellen Sie Hintergründe mit KI und fügen Sie dynamische Daten ein')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b border-surface-border dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => {
              setActiveTab('library');
              setPreviewingBg(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'library'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{_t(`مكتبة خلفياتي (${savedBackgrounds.length})`, `My Backgrounds (${savedBackgrounds.length})`, `Meine Hintergründe (${savedBackgrounds.length})`)}</span>
          </button>

          <button
            onClick={() => setActiveTab('generator')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'generator'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{_t('1. مولّد البرومبت للـ AI', '1. AI Prompt Generator', '1. KI-Prompt-Generator')}</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-500" />
            <span>{_t('2. استيراد وتجربة خلفية', '2. Import & Test Background', '2. Hintergrund importieren')}</span>
          </button>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ==================================================== */}
          {/* TAB 1: MY SAVED BACKGROUNDS LIBRARY                  */}
          {/* ==================================================== */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              {/* Full Screen Live Preview Modal if active */}
              {previewingBg && (
                <div className="p-4 bg-slate-900/95 text-white rounded-3xl border border-slate-700 shadow-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold text-sm">
                        {_t(`معاينة حية للشهادة على خلفية: "${previewingBg.name}"`, `Live Certificate Preview: "${previewingBg.name}"`, `Vorschau: "${previewingBg.name}"`)}
                      </span>
                    </div>

                    {/* Language Switcher for Preview */}
                    <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
                      {(['ar', 'de', 'en'] as const).map(lang => (
                        <button
                          key={lang}
                          onClick={() => setPreviewSampleLang(lang)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            previewSampleLang === lang ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {lang === 'ar' ? 'العربية' : lang === 'de' ? 'Deutsch' : 'English'}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setPreviewingBg(null)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Render Target */}
                  <div className="w-full max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl">
                    <CertificateRenderer certificate={sampleCertificateRecord} />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    {onSelectBackgroundForIssue && (
                      <button
                        onClick={() => {
                          onSelectBackgroundForIssue(previewingBg);
                          onClose();
                        }}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Award className="w-4 h-4" />
                        <span>{_t('استخدام هذه الخلفية لإصدار شهادة الآن', 'Issue Certificate with this Background', 'Zertifikat mit diesem Hintergrund erstellen')}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setPreviewingBg(null)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      {_t('إغلاق المعاينة', 'Close Preview', 'Vorschau schließen')}
                    </button>
                  </div>
                </div>
              )}

              {/* Header Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-text-main">
                    {_t('الخلفيات المحفوظة في مكتبتك', 'Saved AI Backgrounds in your Library', 'Gespeicherte Hintergründe')}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {_t('يمكنك استخدام أي من هذه الخلفيات في إصدار الشهادات الفردية أو التكريم الجماعي', 'Use any of these backgrounds when issuing individual or bulk certificates', 'Wählen Sie einen Hintergrund für Einzel- oder Sammelzertifikate')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('generator')}
                    className="px-3 py-2 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-text-main rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{_t('توليد برومبت جديد', 'Generate Prompt', 'Neuer Prompt')}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('import')}
                    className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>{_t('استيراد خلفية جديدة', 'Import New Background', 'Hintergrund importieren')}</span>
                  </button>
                </div>
              </div>

              {/* Backgrounds Grid */}
              {isLoadingList ? (
                <div className="py-12 text-center text-text-muted text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  <span>{_t('جاري تحميل مكتبة الخلفيات...', 'Loading backgrounds library...', 'Lade Bibliothek...')}</span>
                </div>
              ) : savedBackgrounds.length === 0 ? (
                <div className="p-8 sm:p-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-surface-border dark:border-slate-800 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-black text-text-main">
                    {_t('لم تقم باستيراد أي خلفيات بعد', 'No AI backgrounds imported yet', 'Noch keine Hintergründe importiert')}
                  </h4>
                  <p className="text-xs text-text-muted max-w-md mx-auto">
                    {_t('استخدم مولّد البرومبت لإنشاء برومبت دقيق لأي AI (ChatGPT, Midjourney, Bing)، ثم استورد الصورة هنا لتصبح قالباً جاهزاً لشهاداتك.', 'Generate a prompt with our generator, create the image in your favorite AI tool, and import it here.', 'Erstellen Sie Prompts für KI-Tools und importieren Sie die fertigen Hintergründe.')}
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => setActiveTab('generator')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{_t('بدء توليد البرومبت الآن', 'Start Prompt Generator', 'Prompt-Generator starten')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {savedBackgrounds.map(bg => (
                    <div
                      key={bg.id}
                      className="group bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 hover:border-indigo-500/50 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      {/* Image Thumbnail Container */}
                      <div className="relative aspect-[1.414/1] bg-slate-950 overflow-hidden">
                        <img
                          src={bg.imageUrl}
                          alt={bg.name}
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        />
                        
                        {/* Contrast Mode Badge */}
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-white font-bold flex items-center gap-1">
                          <span>
                            {bg.textColorMode === 'gold_on_dark' 
                              ? '👑 ' + _t('ذهب على داكن', 'Gold on Dark', 'Gold auf Dunkel')
                              : bg.textColorMode === 'light'
                              ? '⚪ ' + _t('نص فاتح', 'Light Text', 'Heller Text')
                              : '⚫ ' + _t('نص داكن', 'Dark Text', 'Dunkler Text')}
                          </span>
                        </div>

                        {/* Dimensions pill */}
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-slate-300 font-mono">
                          {bg.width} × {bg.height}
                        </div>

                        {/* Quick Overlay Action */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPreviewingBg(bg)}
                            className="px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{_t('معاينة', 'Preview', 'Vorschau')}</span>
                          </button>
                        </div>
                      </div>

                      {/* Card Content & Actions */}
                      <div className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          {editingBgId === bg.id ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingBgName}
                                onChange={e => setEditingBgName(e.target.value)}
                                className="w-full px-2 py-1 bg-surface dark:bg-slate-800 border border-primary rounded-lg text-xs font-bold text-text-main"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveRename(bg.id)}
                                className="p-1 text-emerald-500 hover:text-emerald-600"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <h4 className="font-bold text-xs text-text-main truncate" title={bg.name}>
                              {bg.name}
                            </h4>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingBgId(bg.id);
                                setEditingBgName(bg.name);
                              }}
                              className="p-1 text-text-muted hover:text-text-main rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Rename"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(bg.id, e)}
                              className="p-1 text-red-500 hover:text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => setPreviewingBg(bg)}
                            className="flex-1 py-1.5 px-2 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-text-main rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{_t('معاينة', 'Preview', 'Vorschau')}</span>
                          </button>

                          {onSelectBackgroundForIssue && (
                            <button
                              onClick={() => {
                                onSelectBackgroundForIssue(bg);
                                onClose();
                              }}
                              className="flex-1 py-1.5 px-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>{_t('إصدار شهادة', 'Issue', 'Erstellen')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: AI PROMPT GENERATOR                           */}
          {/* ==================================================== */}
          {activeTab === 'generator' && (
            <div className="space-y-5">
              
              {/* Informational Guidance Box */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-300">
                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <p className="font-bold">
                    {_t('كيف تعمل ميزة خلفيات الـ AI؟', 'How does the AI Background Designer work?', 'Wie funktioniert der KI-Hintergrund Designer?')}
                  </p>
                  <p>
                    {_t(
                      '1. اختر الطراز الفني وانسخ البرومبت بالأسفل • 2. الصقه في أداة الـ AI الخاصة بك (ChatGPT / Midjourney / DALL-E / Bing / Firefly) • 3. حمّل الصورة واستوردها في الخطوة رقم 2 (البرنامج سيتكفل بكتابة اسم الطالب والبيانات والتوقيع تلقائياً).',
                      '1. Choose style & copy prompt • 2. Paste into your AI tool (ChatGPT, Midjourney, DALL-E, Bing) • 3. Save & Import in step 2 (our app adds dynamic student names, dates & signatures).',
                      '1. Stil wählen & Prompt kopieren • 2. In KI einfügen • 3. Hintergrund importieren (App fügt Namen und Daten ein).'
                    )}
                  </p>
                </div>
              </div>

              {/* Style Presets Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-text-main">
                  {_t('اختر طراز وثيم الخلفية', 'Select Certificate Style Archetype', 'Stil-Vorlage wählen')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {(Object.keys(AI_STYLE_PRESETS) as AIBackgroundStyleKey[]).map(styleKey => {
                    const preset = AI_STYLE_PRESETS[styleKey];
                    const isSelected = selectedStyle === styleKey;
                    return (
                      <button
                        key={styleKey}
                        type="button"
                        onClick={() => setSelectedStyle(styleKey)}
                        className={`p-3 rounded-2xl border text-start transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-500/10 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-surface dark:bg-slate-900 border-surface-border dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <div 
                              className="w-4 h-4 rounded-full border border-white/20 shadow-xs shrink-0" 
                              style={{ background: preset.previewBg }}
                            />
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                          </div>
                          <span className="block font-black text-xs text-text-main">
                            {preset.name[language] || preset.name.de}
                          </span>
                          <span className="block text-[10px] text-text-muted leading-tight line-clamp-2">
                            {preset.description[language] || preset.description.de}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target AI Platform & Optional Customizations */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text-main">
                    {_t('منصة الذكاء الاصطناعي المستهدفة', 'Target AI Tool', 'Ziel-KI')}
                  </label>
                  <select
                    value={selectedPlatform}
                    onChange={e => setSelectedPlatform(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-xl text-xs font-bold text-text-main"
                  >
                    <option value="general">ChatGPT / GPT-4o / General</option>
                    <option value="midjourney">Midjourney (v6.1 Optimized)</option>
                    <option value="dalle">DALL-E 3</option>
                    <option value="firefly">Adobe Firefly</option>
                    <option value="bing">Microsoft Copilot / Bing Creator</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text-main">
                    {_t('ألوان مخصصة (اختياري)', 'Custom Color Palette (Optional)', 'Farben (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={customColorPalette}
                    onChange={e => setCustomColorPalette(e.target.value)}
                    placeholder="e.g. Royal Emerald Green & Gold"
                    className="w-full px-3 py-2 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-xl text-xs font-bold text-text-main"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text-main">
                    {_t('تفاصيل إضافية (اختياري)', 'Extra Details (Optional)', 'Zusatzdetails (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={extraDetails}
                    onChange={e => setExtraDetails(e.target.value)}
                    placeholder="e.g. Subtle Islamic geometry, laurel wreath"
                    className="w-full px-3 py-2 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-xl text-xs font-bold text-text-main"
                  />
                </div>
              </div>

              {/* Generated Prompt Output Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-text-main flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{_t('البرومبت الاحترافي الجاهز للنسخ', 'Generated AI Master Prompt', 'Generierter KI-Prompt')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCopied
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    }`}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? _t('تم النسخ بنجاح!', 'Copied!', 'Kopiert!') : _t('نسخ البرومبت', 'Copy Prompt', 'Prompt kopieren')}</span>
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={generatedPrompt}
                    rows={6}
                    className="w-full p-3 bg-slate-900 text-indigo-200 font-mono text-xs rounded-2xl border border-slate-800 focus:outline-none select-all leading-relaxed shadow-inner"
                  />
                </div>
              </div>

              {/* Next Step Action CTA */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-surface-border dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-black text-text-main">
                    {_t('هل قمت بتوليد وحفظ الصورة من الـ AI؟', 'Generated the image with AI?', 'Hintergrundbild mit KI generiert?')}
                  </h4>
                  <p className="text-[11px] text-text-muted">
                    {_t('انتقل إلى خطوة الاستيراد لتحميل الصورة والتحقق من أبعادها ومعاينتها مباشرة', 'Move to the Import step to upload and preview your certificate', 'Gehen Sie zum Import-Schritt')}
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('import')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <span>{_t('الانتقال للاستيراد والتجربة', 'Go to Import Step', 'Weiter zum Import')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: IMPORT, VALIDATE & TEST LIVE                  */}
          {/* ==================================================== */}
          {activeTab === 'import' && (
            <div className="space-y-5">
              {/* File Dropzone / Picker */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 text-center rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
                  validationResult?.isValid
                    ? 'bg-emerald-500/5 border-emerald-500/40 hover:bg-emerald-500/10'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-surface-border dark:border-slate-700 hover:border-indigo-500/60 hover:bg-indigo-500/5'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file);
                  }}
                  className="hidden"
                />

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  validationResult?.isValid
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                }`}>
                  {validationResult?.isValid ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-black text-text-main">
                    {importedFile ? importedFile.name : _t('اختر أو اسحب صورة الخلفية المصممة بالـ AI هنا', 'Click or drag your AI-designed certificate background here', 'KI-Hintergrundbild hierher ziehen oder auswählen')}
                  </h4>
                  <p className="text-xs text-text-muted">
                    {_t('صيغ مدعومة: PNG, JPG, JPEG, WebP • يفضل أبعاد A4 أفقية (Landscape)', 'Supported: PNG, JPG, WebP • Recommended: A4 Landscape ratio', 'Unterstützt: PNG, JPG, WebP')}
                  </p>
                </div>
              </div>

              {/* Validation Status & Details */}
              {isProcessingFile && (
                <div className="py-4 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>{_t('جاري التحقق من أبعاد ودقة الصورة...', 'Validating image resolution & aspect ratio...', 'Prüfe Bildauflösung...')}</span>
                </div>
              )}

              {validationResult && (
                <div className="space-y-4">
                  {/* Validation Feedback Banner */}
                  {validationResult.isValid ? (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1.5 text-xs text-emerald-900 dark:text-emerald-300">
                      <div className="flex items-center justify-between">
                        <span className="font-black flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          {_t('تم التحقق من الصورة بنجاح وتطابق المعايير', 'Image validated successfully!', 'Bild erfolgreich geprüft!')}
                        </span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 font-bold">
                          {validationResult.width} × {validationResult.height} px ({validationResult.aspectRatioLabel})
                        </span>
                      </div>
                      {validationResult.warning && (
                        <p className="text-amber-600 dark:text-amber-400 flex items-start gap-1 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{validationResult.warning}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{validationResult.errorMessage}</span>
                    </div>
                  )}

                  {/* Configuration Controls (Name & Text Contrast Mode) */}
                  {validationResult.isValid && (
                    <div className="p-4 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-2xl space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-text-main">
                            {_t('اسم الخلفية في مكتبتك', 'Background Name', 'Hintergrundname')}
                          </label>
                          <input
                            type="text"
                            value={backgroundName}
                            onChange={e => setBackgroundName(e.target.value)}
                            placeholder="e.g. Royal Luxury Navy & Gold"
                            className="w-full px-3 py-2 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 rounded-xl text-xs font-bold text-text-main focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-text-main">
                            {_t('نمط تباين ولون نصوص الشهادة', 'Text Contrast Mode', 'Text-Farbmodus')}
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'dark', label: _t('نص داكن (عادي)', 'Dark Text', 'Dunkel') },
                              { id: 'gold_on_dark', label: _t('ذهب على داكن', 'Gold on Dark', 'Gold') },
                              { id: 'light', label: _t('نص أبيض ناصع', 'White Text', 'Weiß') }
                            ].map(mode => (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => setTextColorMode(mode.id as any)}
                                className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center ${
                                  textColorMode === mode.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-surface dark:bg-slate-800 border-surface-border dark:border-slate-700 text-text-muted'
                                }`}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Live Interactive Preview with Sample Student Data */}
                      <div className="pt-3 border-t border-surface-border dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-text-main flex items-center gap-1.5">
                            <Eye className="w-4 h-4 text-indigo-500" />
                            {_t('معاينة تفاعلية فورية لنصوص الشهادة على الخلفية', 'Live Interactive Certificate Preview on Background', 'Live-Vorschau mit Daten')}
                          </span>

                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                            {(['ar', 'de', 'en'] as const).map(lang => (
                              <button
                                key={lang}
                                type="button"
                                onClick={() => setPreviewSampleLang(lang)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                  previewSampleLang === lang ? 'bg-indigo-600 text-white' : 'text-text-muted hover:text-text-main'
                                }`}
                              >
                                {lang === 'ar' ? 'العربية' : lang === 'de' ? 'Deutsch' : 'English'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Interactive Certificate Renderer Stage */}
                        <div className="w-full max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-xl border border-slate-700/20">
                          <CertificateRenderer certificate={sampleCertificateRecord} />
                        </div>
                      </div>

                      {/* Save Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveBackground(false)}
                          className="px-4 py-2.5 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-text-main rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Layers className="w-4 h-4 text-indigo-500" />
                          <span>{_t('حفظ في مكتبة الخلفيات', 'Save to Library', 'In Bibliothek speichern')}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveBackground(true)}
                          className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                        >
                          <Award className="w-4 h-4" />
                          <span>{_t('حفظ واستخدام لإصدار شهادة الآن', 'Save & Use to Issue Certificate', 'Speichern & Zertifikat ausstellen')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
