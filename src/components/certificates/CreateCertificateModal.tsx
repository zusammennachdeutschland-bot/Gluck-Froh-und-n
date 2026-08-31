import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CertificateRecord, CertificateTypeKey, CertificateTemplateId, CertificateLanguage, AICertificateBackground } from '../../types';
import {
  CERTIFICATE_CATEGORIES_CONFIG,
  CERTIFICATE_TYPES_CONFIG,
  PRIMARY_CERTIFICATE_TEMPLATES,
  getCertificateDefaultText
} from '../../data/certificateTypes';
import { CertificateRenderer } from './templates/CertificateRenderer';
import { 
  downloadCertificatePDF, 
  downloadCertificateImage, 
  shareCertificateWhatsApp,
  shareCertificate,
  saveCertificateToPhoneFolder
} from '../../utils/certificateExportUtils';
import { resolveCertificateRecipientName } from '../../utils/certificateUtils';
import { formatLocalDate } from '../../utils/timeUtils';
import { getTeacherEnglishName } from '../../utils/teacherUtils';
import { getSavedAIBackgrounds } from '../../utils/aiBackgroundUtils';
import {
  X,
  Award,
  Eye,
  Download,
  Share2,
  Sparkles,
  Check,
  FileText,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Layers,
  Image as ImageIcon,
  FolderDown,
  Send
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import confetti from 'canvas-confetti';

interface CreateCertificateModalProps {
  onClose: () => void;
  initialStudentId?: string;
  initialCertificate?: CertificateRecord;
  initialCustomBackground?: AICertificateBackground;
  onOpenAIDesigner?: () => void;
  onCertificateSaved?: (cert: CertificateRecord) => void;
}

export const CreateCertificateModal: React.FC<CreateCertificateModalProps> = ({
  onClose,
  initialStudentId,
  initialCertificate,
  initialCustomBackground,
  onOpenAIDesigner,
  onCertificateSaved
}) => {
  const { students, groups, profile, addCertificate, updateCertificate, updateStudentCertificateName, _t } = useApp();

  const [studentId, setStudentId] = useState<string>(
    initialCertificate?.studentId || initialStudentId || (students[0]?.id || '')
  );

  const selectedStudent = students.find(s => s.id === studentId);
  const selectedGroup = selectedStudent ? groups.find(g => g.id === selectedStudent.groupId) : undefined;

  const [language, setLanguage] = useState<CertificateLanguage>(
    initialCertificate?.language || 'de'
  );

  const [type, setType] = useState<CertificateTypeKey>(
    initialCertificate?.type || initialCertificate?.certificateType || 'achievement'
  );

  const [templateTab, setTemplateTab] = useState<'standard' | 'ai_custom'>(
    initialCustomBackground || initialCertificate?.customBackgroundUrl ? 'ai_custom' : 'standard'
  );

  const [templateId, setTemplateId] = useState<CertificateTemplateId>(
    initialCustomBackground ? 'custom_ai_bg' : (initialCertificate?.templateId || initialCertificate?.template || 'classic')
  );

  const [savedAIBackgrounds, setSavedAIBackgrounds] = useState<AICertificateBackground[]>([]);
  const [selectedCustomBg, setSelectedCustomBg] = useState<AICertificateBackground | null>(
    initialCustomBackground || null
  );

  useEffect(() => {
    getSavedAIBackgrounds().then(list => {
      setSavedAIBackgrounds(list);
      if (initialCustomBackground) {
        setSelectedCustomBg(initialCustomBackground);
      } else if (initialCertificate?.customBackgroundId) {
        const found = list.find(b => b.id === initialCertificate.customBackgroundId);
        if (found) setSelectedCustomBg(found);
      } else if (initialCertificate?.customBackgroundUrl) {
        setSelectedCustomBg({
          id: 'existing_bg',
          name: 'Custom AI Background',
          imageUrl: initialCertificate.customBackgroundUrl,
          width: 2480,
          height: 1754,
          aspectRatio: 1.414,
          textColorMode: initialCertificate.customBackgroundTextColor || 'dark',
          createdAt: Date.now()
        });
      }
    });
  }, [initialCertificate, initialCustomBackground]);

  const [studentCertificateName, setStudentCertificateName] = useState<string>(() => {
    if (initialCertificate?.studentCertificateName || initialCertificate?.recipientName) {
      return initialCertificate.studentCertificateName || initialCertificate.recipientName || '';
    }
    if (selectedStudent) {
      return (initialCertificate?.language || 'de') === 'ar' ? selectedStudent.name : (selectedStudent.certificateName || '');
    }
    return '';
  });

  const [courseOrLevelTitle, setCourseOrLevelTitle] = useState<string>(
    initialCertificate?.courseOrLevelTitle || initialCertificate?.title || 'Deutschkurs A1'
  );

  const [description, setDescription] = useState<string>(() => {
    if (initialCertificate?.description) return initialCertificate.description;
    const defaults = getCertificateDefaultText(type, language);
    return defaults.description;
  });

  const [gradeOrScore, setGradeOrScore] = useState<string>(
    initialCertificate?.gradeOrScore || initialCertificate?.score || ''
  );

  const [issueDate, setIssueDate] = useState<string>(
    initialCertificate?.issueDate || formatLocalDate()
  );

  const currentTeacherName = getTeacherEnglishName(profile, 'Teacher');

  const [instructorName, setInstructorName] = useState<string>(
    initialCertificate?.instructorName || initialCertificate?.teacherName || currentTeacherName || 'Lehrer/in'
  );

  const [centerOrSchoolName, setCenterOrSchoolName] = useState<string>(
    initialCertificate?.centerOrSchoolName || ''
  );

  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [createdRecord, setCreatedRecord] = useState<CertificateRecord | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string>('');

  // When student changes, update student certificate name default according to language
  useEffect(() => {
    if (selectedStudent && !initialCertificate) {
      if (language === 'ar') {
        setStudentCertificateName(selectedStudent.name);
      } else {
        setStudentCertificateName(selectedStudent.certificateName || '');
      }
      setValidationError(null);
    }
  }, [studentId]);

  // When type or language changes, update default title & description
  const handleTypeChange = (newType: CertificateTypeKey) => {
    setType(newType);
    const defaults = getCertificateDefaultText(newType, language);
    setDescription(defaults.description);
    if (!initialCertificate) {
      setCourseOrLevelTitle(defaults.title);
    }
  };

  const handleLanguageChange = (newLang: CertificateLanguage) => {
    setLanguage(newLang);
    const defaults = getCertificateDefaultText(type, newLang);
    setDescription(defaults.description);
    if (!initialCertificate) {
      setCourseOrLevelTitle(defaults.title);
    }
    // Update recipient name input when switching between Arabic and Latin languages
    if (selectedStudent && !initialCertificate) {
      if (newLang === 'ar') {
        setStudentCertificateName(selectedStudent.name);
      } else {
        setStudentCertificateName(selectedStudent.certificateName || '');
      }
    }
    setValidationError(null);
  };

  const resolvedRecipient = resolveCertificateRecipientName(language, selectedStudent, studentCertificateName);

  const isCustomBg = templateTab === 'ai_custom' && selectedCustomBg;

  const currentCertificateData: CertificateRecord = {
    id: initialCertificate?.id || 'temp_preview',
    studentId,
    studentName: selectedStudent?.name || 'Student Name',
    recipientName: resolvedRecipient.name || (language === 'ar' ? selectedStudent?.name || 'اسم الطالب' : '⚠️ Certificate Name Required'),
    studentCertificateName: studentCertificateName.trim() || undefined,
    groupId: selectedStudent?.groupId,
    groupName: selectedGroup?.name,
    certificateType: type,
    type,
    template: isCustomBg ? 'custom_ai_bg' : templateId,
    templateId: isCustomBg ? 'custom_ai_bg' : templateId,
    customBackgroundId: isCustomBg ? selectedCustomBg.id : undefined,
    customBackgroundUrl: isCustomBg ? selectedCustomBg.imageUrl : undefined,
    customBackgroundTextColor: isCustomBg ? selectedCustomBg.textColorMode : undefined,
    language,
    title: courseOrLevelTitle.trim() || 'Certificate of Excellence',
    courseOrLevelTitle: courseOrLevelTitle.trim() || 'Certificate of Excellence',
    description: description.trim(),
    score: gradeOrScore.trim() || undefined,
    gradeOrScore: gradeOrScore.trim() || undefined,
    issueDate,
    teacherName: instructorName.trim() || profile.displayName || profile.name,
    instructorName: instructorName.trim() || profile.displayName || profile.name,
    centerOrSchoolName: centerOrSchoolName.trim() || undefined,
    createdAt: initialCertificate?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedStudent) {
      setValidationError(_t('يرجى اختيار طالب أولاً', 'Please select a student', 'Bitte wählen Sie einen Schüler aus'));
      return;
    }

    const trimmedCertName = studentCertificateName.trim();

    // Validation: English / German certificates require non-empty Latin certificate name
    if ((language === 'en' || language === 'de') && !trimmedCertName) {
      setValidationError(
        _t(
          '⚠️ اسم الشهادة باللاتينية مطلوب للشهادات باللغة الألمانية أو الإنجليزية.',
          '⚠️ Latin Certificate Name is required for English & German certificates.',
          '⚠️ Lateinischer Zertifikatsname ist für deutsche/englische Zertifikate erforderlich.'
        )
      );
      return;
    }

    // Also update student's certificateName on student entity if changed
    if (trimmedCertName && trimmedCertName !== selectedStudent.certificateName) {
      updateStudentCertificateName(selectedStudent.id, trimmedCertName);
    }

    const finalRecipient = language === 'ar' ? (trimmedCertName || selectedStudent.name) : trimmedCertName;
    const finalTemplateId = isCustomBg ? 'custom_ai_bg' : templateId;

    if (initialCertificate) {
      updateCertificate(initialCertificate.id, {
        studentId,
        studentName: selectedStudent.name,
        recipientName: finalRecipient,
        studentCertificateName: trimmedCertName || undefined,
        groupId: selectedStudent.groupId,
        groupName: selectedGroup?.name,
        type,
        certificateType: type,
        templateId: finalTemplateId,
        template: finalTemplateId,
        customBackgroundId: isCustomBg ? selectedCustomBg.id : undefined,
        customBackgroundUrl: isCustomBg ? selectedCustomBg.imageUrl : undefined,
        customBackgroundTextColor: isCustomBg ? selectedCustomBg.textColorMode : undefined,
        language,
        courseOrLevelTitle: courseOrLevelTitle.trim(),
        title: courseOrLevelTitle.trim(),
        description: description.trim(),
        gradeOrScore: gradeOrScore.trim() || undefined,
        score: gradeOrScore.trim() || undefined,
        issueDate,
        instructorName: instructorName.trim(),
        teacherName: instructorName.trim(),
        centerOrSchoolName: centerOrSchoolName.trim() || undefined
      });
      confetti({ particleCount: 60, spread: 50 });
      if (onCertificateSaved) onCertificateSaved(currentCertificateData);
      onClose();
    } else {
      const newRecord = addCertificate({
        studentId,
        studentName: selectedStudent.name,
        recipientName: finalRecipient,
        studentCertificateName: trimmedCertName || undefined,
        groupId: selectedStudent.groupId,
        groupName: selectedGroup?.name,
        type,
        certificateType: type,
        templateId: finalTemplateId,
        template: finalTemplateId,
        customBackgroundId: isCustomBg ? selectedCustomBg.id : undefined,
        customBackgroundUrl: isCustomBg ? selectedCustomBg.imageUrl : undefined,
        customBackgroundTextColor: isCustomBg ? selectedCustomBg.textColorMode : undefined,
        language,
        courseOrLevelTitle: courseOrLevelTitle.trim(),
        title: courseOrLevelTitle.trim(),
        description: description.trim(),
        gradeOrScore: gradeOrScore.trim() || undefined,
        score: gradeOrScore.trim() || undefined,
        issueDate,
        instructorName: instructorName.trim(),
        teacherName: instructorName.trim(),
        centerOrSchoolName: centerOrSchoolName.trim() || undefined
      });

      confetti({ particleCount: 100, spread: 70 });
      setCreatedRecord(newRecord);
      if (onCertificateSaved) onCertificateSaved(newRecord);
    }
  };

  const handleExportPDF = async () => {
    if (!createdRecord || isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري إنشاء وحفظ ملف PDF...', 'Generating PDF...', 'PDF wird generiert...'));
    try {
      const res = await downloadCertificatePDF(createdRecord);
      const msg = Capacitor.isNativePlatform() 
        ? _t(`تم حفظ PDF في مجلد: ${res.path}`, `Saved PDF to ${res.path}`, 'PDF gespeichert')
        : _t('تم تحميل ملف PDF بنجاح!', 'PDF downloaded successfully!', 'PDF erfolgreich heruntergeladen!');
      setExportMessage(msg);
      setTimeout(() => setExportMessage(''), 4000);
    } catch (err) {
      console.error('PDF Export error:', err);
      setExportMessage(_t('حدث خطأ أثناء تصدير PDF.', 'Error exporting PDF.', 'Fehler beim PDF-Export.'));
      setTimeout(() => setExportMessage(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPNG = async () => {
    if (!createdRecord || isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري إنشاء وحفظ صورة الشهادة...', 'Generating image...', 'Bild wird generiert...'));
    try {
      const res = await downloadCertificateImage(createdRecord, 'png');
      const msg = Capacitor.isNativePlatform()
        ? _t(`تم حفظ الصورة في مجلد: ${res.path}`, `Saved image to ${res.path}`, 'Bild gespeichert')
        : _t('تم تحميل صورة الشهادة بنجاح!', 'Image downloaded successfully!', 'Bild erfolgreich heruntergeladen!');
      setExportMessage(msg);
      setTimeout(() => setExportMessage(''), 4000);
    } catch (err) {
      console.error('Image Export error:', err);
      setExportMessage(_t('حدث خطأ أثناء تصدير الصورة.', 'Error exporting image.', 'Fehler beim Bild-Export.'));
      setTimeout(() => setExportMessage(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToPhoneFolder = async (format: 'pdf' | 'png' = 'pdf') => {
    if (!createdRecord || isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري الحفظ في مجلد الهاتف...', 'Saving to phone folder...', 'Wird im Ordner gespeichert...'));
    try {
      const res = await saveCertificateToPhoneFolder(createdRecord, format);
      setExportMessage(_t(`تم الحفظ في: ${res.path}`, `Saved to ${res.path}`, 'Gespeichert'));
      setTimeout(() => setExportMessage(''), 5000);
    } catch (err) {
      console.error('Save to folder error:', err);
      setExportMessage(_t('فشل الحفظ في المجلد', 'Save failed', 'Fehler beim Speichern'));
      setTimeout(() => setExportMessage(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNativeShare = async (format: 'pdf' | 'png' = 'png') => {
    if (!createdRecord || isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري تجهيز المشاركة...', 'Preparing share...', 'Wird geteilt...'));
    try {
      await shareCertificate(createdRecord, createdRecord.title, createdRecord.recipientName || createdRecord.studentName, format);
      setExportMessage('');
    } catch (err) {
      console.error('Share error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!createdRecord || !selectedStudent || isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري تجهيز الشهادة والمشاركة للواتساب...', 'Preparing certificate for WhatsApp...', 'Wird für WhatsApp vorbereitet...'));
    try {
      await shareCertificateWhatsApp(createdRecord, selectedStudent.parentPhone || selectedStudent.studentPhone);
      setExportMessage('');
    } catch (err) {
      console.error('WhatsApp share error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div onClick={e => e.stopPropagation()} className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-main">
                {initialCertificate
                  ? _t('تعديل الشهادة', 'Edit Certificate', 'Zertifikat bearbeiten')
                  : _t('إصدار شهادة تقدير جديدة', 'Issue New Certificate', 'Neues Zertifikat ausstellen')}
              </h2>
              <p className="text-xs text-text-muted">
                {_t('تكريم الطالب وتوثيق إنجازه بشهادة احترافية بدون بيانات المجموعة أو الصف', 'Honor student with a high-fidelity certificate without group references', 'Schüler mit einem Zertifikat ehren')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Dialog state after creating */}
        {createdRecord ? (
          <div className="p-6 text-center space-y-5 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-text-main">
                {_t('تم إصدار الشهادة بنجاح! 🏆', 'Certificate Issued Successfully! 🏆', 'Zertifikat erfolgreich ausgestellt! 🏆')}
              </h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                {_t(
                  `تم حفظ وتوثيق شهادة الطالب ${createdRecord.recipientName || createdRecord.studentName} في الأرشيف ومركز الشهادات.`,
                  `Certificate for ${createdRecord.recipientName || createdRecord.studentName} has been saved to the archive.`,
                  `Das Zertifikat für ${createdRecord.recipientName || createdRecord.studentName} wurde gespeichert.`
                )}
              </p>
              {exportMessage && (
                <p className="text-xs font-bold text-primary animate-pulse pt-1">
                  {exportMessage}
                </p>
              )}
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="py-2.5 px-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 text-xs"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{_t('تحميل PDF', 'Download PDF', 'PDF herunterladen')}</span>
              </button>

              <button
                type="button"
                onClick={handleExportPNG}
                disabled={isExporting}
                className="py-2.5 px-3 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 text-text-main hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 text-xs"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>{_t('صورة PNG', 'PNG Image', 'PNG-Bild')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveToPhoneFolder('pdf')}
                disabled={isExporting}
                className="py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 text-xs col-span-2 sm:col-span-1"
                title={_t('حفظ في مجلد الهاتف Documents/AGS_Certificates', 'Save to Phone Folder', 'Im Telefonordner speichern')}
              >
                <FolderDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{_t('مجلد الهاتف (AGS)', 'Phone Folder', 'Telefonordner')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNativeShare('png')}
                disabled={isExporting}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-main rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 text-xs"
              >
                <Send className="w-4 h-4 text-primary" />
                <span>{_t('مشاركة', 'Share', 'Teilen')}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                disabled={isExporting}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 text-xs col-span-2 sm:col-span-2"
              >
                <Share2 className="w-4 h-4" />
                <span>{_t('مشاركة عبر واتساب', 'Share WhatsApp', 'Per WhatsApp teilen')}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-xs font-black text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              {_t('إغلاق والعودة', 'Close & Return', 'Schließen')}
            </button>
          </div>
        ) : (
          /* Main Create Form */
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
            
            {/* Validation Error Banner if any */}
            {validationError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2.5 text-red-600 dark:text-red-400 text-xs font-bold animate-shake">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Student Picker & Recipient Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {_t('اختر الطالب المكرم *', 'Select Student *', 'Schüler auswählen *')}
                </label>
                <select
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  {students.filter(s => s.status !== 'archived').map(s => {
                    const grp = groups.find(g => g.id === s.groupId);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} {grp ? `(${grp.name})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-text-main">
                    {language === 'ar'
                      ? _t('الاسم بالعربية على الشهادة *', 'Name on Certificate (Arabic) *', 'Name auf dem Zertifikat *')
                      : _t('الاسم باللاتينية على الشهادة *', 'Name on Certificate (Latin/English) *', 'Name auf dem Zertifikat (Lateinisch) *')}
                  </label>
                  {(language === 'en' || language === 'de') && !studentCertificateName.trim() && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      {_t('مطلوب', 'Required', 'Erforderlich')}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={studentCertificateName}
                  onChange={e => {
                    setStudentCertificateName(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder={
                    language === 'ar'
                      ? (selectedStudent?.name || 'اسم الطالب بالعربية')
                      : (selectedStudent?.certificateName || 'e.g. Abdelrahman Mohamed')
                  }
                  className={`w-full bg-surface dark:bg-slate-900 border rounded-xl px-3 py-2.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary ${
                    (language === 'en' || language === 'de') && !studentCertificateName.trim()
                      ? 'border-amber-400 dark:border-amber-500/60 bg-amber-50/20'
                      : 'border-surface-border dark:border-slate-700'
                  }`}
                  required
                />
              </div>
            </div>

            {/* Type & Language Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {_t('نوع الشهادة والتكريم (مُقسّمة حسب الفئات)', 'Certificate Category & Type', 'Zertifikatskategorie')}
                </label>
                <select
                  value={type}
                  onChange={e => handleTypeChange(e.target.value as CertificateTypeKey)}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.values(CERTIFICATE_CATEGORIES_CONFIG).map(cat => {
                    const catTitle = cat.names[language] || cat.names.de;
                    return (
                      <optgroup key={cat.key} label={`${cat.emoji} ${catTitle}`}>
                        {cat.typeKeys.map(tKey => {
                          const tConfig = CERTIFICATE_TYPES_CONFIG[tKey];
                          if (!tConfig) return null;
                          const tTitle = tConfig.titles[language] || tConfig.titles.de;
                          return (
                            <option key={tKey} value={tKey}>
                              {tConfig.badgeEmoji} {tTitle}
                            </option>
                          );
                        })}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {_t('لغة نص الشهادة', 'Certificate Language', 'Zertifikatssprache')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'de', label: 'Deutsch 🇩🇪' },
                    { id: 'en', label: 'English 🇬🇧' },
                    { id: 'ar', label: 'العربية 🇸🇦' }
                  ].map(lang => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => handleLanguageChange(lang.id as CertificateLanguage)}
                      className={`py-2 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                        language === lang.id
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-surface dark:bg-slate-900 border-surface-border dark:border-slate-700 text-text-muted hover:text-text-main'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Template & AI Background Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-text-main">
                  {_t('اختر قالب وتصميم الشهادة', 'Certificate Design Template', 'Designvorlage')}
                </label>

                {/* Template Mode Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setTemplateTab('standard')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      templateTab === 'standard'
                        ? 'bg-surface dark:bg-slate-700 text-text-main shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {_t('القوالب الجاهزة', 'Standard Templates', 'Vorlagen')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTemplateTab('ai_custom')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      templateTab === 'ai_custom'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{_t(`خلفيات AI المصممة (${savedAIBackgrounds.length})`, `AI Backgrounds (${savedAIBackgrounds.length})`, `KI-Hintergründe (${savedAIBackgrounds.length})`)}</span>
                  </button>
                </div>
              </div>

              {/* Standard Templates Grid */}
              {templateTab === 'standard' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRIMARY_CERTIFICATE_TEMPLATES.map(tmpl => {
                    const isSelected = templateId === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => {
                          setTemplateId(tmpl.id);
                          setSelectedCustomBg(null);
                        }}
                        className={`p-2.5 rounded-2xl border text-start transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-primary/5 dark:bg-primary-soft border-primary ring-2 ring-primary/20 shadow-xs'
                            : 'bg-surface dark:bg-slate-900 border-surface-border dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: tmpl.previewColor || '#4f46e5' }}
                            />
                            <span className="font-black text-xs text-text-main truncate">
                              {tmpl.name[language] || tmpl.name.de}
                            </span>
                          </div>
                          <span className="block text-[10px] text-text-muted leading-tight line-clamp-2">
                            {tmpl.description[language] || tmpl.description.de}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="mt-2 self-end">
                            <Check className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* AI Custom Backgrounds Grid */
                <div className="space-y-2.5">
                  {savedAIBackgrounds.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-surface-border dark:border-slate-700 text-center space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <p className="text-xs text-text-muted">
                        {_t('لا توجد خلفيات AI محفوظة في مكتبتك حالياً.', 'No saved AI backgrounds in your library yet.', 'Noch keine KI-Hintergründe gespeichert.')}
                      </p>
                      {onOpenAIDesigner && (
                        <button
                          type="button"
                          onClick={onOpenAIDesigner}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{_t('فتح مصمم خلفيات AI الآن', 'Open AI Background Designer', 'KI-Designer öffnen')}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {savedAIBackgrounds.map(bg => {
                        const isSelected = selectedCustomBg?.id === bg.id;
                        return (
                          <button
                            key={bg.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomBg(bg);
                              setTemplateId('custom_ai_bg');
                            }}
                            className={`p-2 rounded-2xl border text-start transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group ${
                              isSelected
                                ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-500/5 shadow-xs'
                                : 'bg-surface dark:bg-slate-900 border-surface-border dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="relative aspect-[1.414/1] w-full rounded-xl overflow-hidden mb-1.5 bg-slate-950">
                              <img
                                src={bg.imageUrl}
                                alt={bg.name}
                                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="px-0.5">
                              <span className="block font-black text-[11px] text-text-main truncate">
                                {bg.name}
                              </span>
                              <span className="block text-[9px] text-text-muted">
                                {bg.textColorMode === 'gold_on_dark' ? '👑 Gold' : bg.textColorMode === 'light' ? '⚪ Light' : '⚫ Dark'} text
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {onOpenAIDesigner && savedAIBackgrounds.length > 0 && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={onOpenAIDesigner}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{_t('+ تصميم أو استيراد خلفية AI جديدة', '+ Design or Import New AI Background', '+ Neuer KI-Hintergrund')}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Course Title & Grade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {_t('عنوان الشهادة / التكريم', 'Certificate Title', 'Zertifikatstitel')}
                </label>
                <input
                  type="text"
                  value={courseOrLevelTitle}
                  onChange={e => setCourseOrLevelTitle(e.target.value)}
                  placeholder="e.g. Certificate of Achievement"
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {_t('الدرجة / التقدير أو الوسام (اختياري)', 'Grade / Distinction (Optional)', 'Note / Prädikat (Optional)')}
                </label>
                <input
                  type="text"
                  value={gradeOrScore}
                  onChange={e => setGradeOrScore(e.target.value)}
                  placeholder={_t('مثال: ممتاز (98%) أو Sehr Gut', 'e.g. Sehr Gut (1.0)', 'z.B. Sehr Gut (1.0)')}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Description / Honor Statement */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-text-main">
                {_t('نص التقدير وسبب التكريم', 'Certificate Description / Statement', 'Würdigungstext')}
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl p-3 text-xs font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Metadata (Issue Date, Teacher Signature, Center) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-muted">
                  {_t('تاريخ الإصدار', 'Issue Date', 'Ausstellungsdatum')}
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-muted">
                  {_t('توقيع المعلم / المدرب', 'Teacher Signature Name', 'Unterschrift Lehrkraft')}
                </label>
                <input
                  type="text"
                  value={instructorName}
                  onChange={e => setInstructorName(e.target.value)}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-muted">
                  {_t('اسم المركز / المؤسسة', 'Center / Academy Name', 'Zentrum / Schule')}
                </label>
                <input
                  type="text"
                  value={centerOrSchoolName}
                  onChange={e => setCenterOrSchoolName(e.target.value)}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Live Preview Toggle Button */}
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="w-full py-2.5 px-4 bg-slate-50 dark:bg-slate-800/60 border border-surface-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-text-main rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4 text-primary" />
              <span>{_t('معاينة حية للشهادة قبل الإصدار', 'Live Certificate Preview', 'Live-Vorschau anzeigen')}</span>
            </button>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-border dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 text-text-muted hover:text-text-main font-bold rounded-xl transition-colors cursor-pointer text-xs"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-black rounded-xl transition-all shadow-sm cursor-pointer text-xs flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{initialCertificate ? _t('حفظ التعديلات', 'Save Changes', 'Änderungen speichern') : _t('إصدار الشهادة الآن', 'Issue Certificate Now', 'Zertifikat jetzt ausstellen')}</span>
              </button>
            </div>

          </form>
        )}

      </div>

      {/* Floating Live Preview Modal */}
      {showPreviewModal && (
        <div onClick={() => setShowPreviewModal(false)} className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div onClick={e => e.stopPropagation()} className="bg-surface dark:bg-slate-900 rounded-3xl w-full max-w-4xl p-4 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-surface-border dark:border-slate-800 pb-3">
              <span className="font-black text-sm text-text-main">{_t('معاينة الشهادة الحية', 'Live Certificate Preview', 'Live-Zertifikatsvorschau')}</span>
              <button onClick={() => setShowPreviewModal(false)} className="p-1 text-text-muted hover:text-text-main cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full overflow-x-auto flex justify-center py-2 bg-slate-100 dark:bg-slate-950/50 rounded-2xl">
              <div className="max-w-2xl w-full">
                <CertificateRenderer certificate={currentCertificateData} />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2 bg-primary text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                {_t('تم، العودة للإصدار', 'Done, Return to Issue', 'Fertig')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
