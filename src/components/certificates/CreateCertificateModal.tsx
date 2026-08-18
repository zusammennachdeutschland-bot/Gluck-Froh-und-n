import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CertificateRecord, CertificateTypeKey, CertificateTemplateId, CertificateLanguage } from '../../types';
import { CERTIFICATE_TYPES, PRIMARY_CERTIFICATE_TEMPLATES, getCertificateDefaultText } from '../../data/certificateTypes';
import { CertificateRenderer } from './templates/CertificateRenderer';
import { downloadCertificatePDF, downloadCertificateImage, shareCertificateWhatsApp } from '../../utils/certificateExportUtils';
import { formatLocalDate } from '../../utils/timeUtils';
import { X, Award, Eye, Download, Share2, Sparkles, Check, ChevronRight, FileText, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CreateCertificateModalProps {
  onClose: () => void;
  initialStudentId?: string;
  initialCertificate?: CertificateRecord;
  onCertificateSaved?: (cert: CertificateRecord) => void;
}

export const CreateCertificateModal: React.FC<CreateCertificateModalProps> = ({
  onClose,
  initialStudentId,
  initialCertificate,
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
    initialCertificate?.type || 'course_completion'
  );

  const [templateId, setTemplateId] = useState<CertificateTemplateId>(
    initialCertificate?.templateId || initialCertificate?.template || 'neutral'
  );

  const [studentCertificateName, setStudentCertificateName] = useState<string>(
    initialCertificate?.studentCertificateName || selectedStudent?.certificateName || ''
  );

  const [courseOrLevelTitle, setCourseOrLevelTitle] = useState<string>(
    initialCertificate?.courseOrLevelTitle || 'Deutschkurs A1'
  );

  const [description, setDescription] = useState<string>(() => {
    if (initialCertificate?.description) return initialCertificate.description;
    const defaults = getCertificateDefaultText(type, language);
    return defaults.description;
  });

  const [gradeOrScore, setGradeOrScore] = useState<string>(
    initialCertificate?.gradeOrScore || ''
  );

  const [issueDate, setIssueDate] = useState<string>(
    initialCertificate?.issueDate || formatLocalDate()
  );

  const [instructorName, setInstructorName] = useState<string>(
    initialCertificate?.instructorName || profile.name || 'Lehrer/in'
  );

  const [centerOrSchoolName, setCenterOrSchoolName] = useState<string>(
    initialCertificate?.centerOrSchoolName || ''
  );

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [createdRecord, setCreatedRecord] = useState<CertificateRecord | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // When student changes, update student certificate name default
  useEffect(() => {
    if (selectedStudent && !initialCertificate) {
      if (selectedStudent.certificateName) {
        setStudentCertificateName(selectedStudent.certificateName);
      } else {
        // Simple fallback
        setStudentCertificateName(selectedStudent.name);
      }
    }
  }, [studentId]);

  // When type or language changes, update default description if not custom edited
  const handleTypeChange = (newType: CertificateTypeKey) => {
    setType(newType);
    const defaults = getCertificateDefaultText(newType, language);
    setDescription(defaults.description);
  };

  const handleLanguageChange = (newLang: CertificateLanguage) => {
    setLanguage(newLang);
    const defaults = getCertificateDefaultText(type, newLang);
    setDescription(defaults.description);
  };

  const currentCertificateData: CertificateRecord = {
    id: initialCertificate?.id || 'temp_preview',
    studentId,
    studentName: selectedStudent?.name || 'Student Name',
    recipientName: studentCertificateName.trim() || selectedStudent?.name || 'Student Name',
    studentCertificateName: studentCertificateName.trim() || selectedStudent?.name || 'Student Name',
    groupId: selectedStudent?.groupId,
    groupName: selectedGroup?.name,
    certificateType: type,
    type,
    template: templateId,
    templateId,
    language,
    title: courseOrLevelTitle.trim() || 'Deutschkurs',
    courseOrLevelTitle: courseOrLevelTitle.trim() || 'Deutschkurs',
    description: description.trim(),
    score: gradeOrScore.trim() || undefined,
    gradeOrScore: gradeOrScore.trim() || undefined,
    issueDate,
    teacherName: instructorName.trim() || profile.name,
    instructorName: instructorName.trim() || profile.name,
    centerOrSchoolName: centerOrSchoolName.trim() || undefined,
    createdAt: initialCertificate?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    // Also update student's certificateName on student entity if changed
    if (studentCertificateName.trim() && studentCertificateName.trim() !== selectedStudent.certificateName) {
      updateStudentCertificateName(selectedStudent.id, studentCertificateName.trim());
    }

    if (initialCertificate) {
      updateCertificate(initialCertificate.id, {
        studentId,
        studentName: selectedStudent.name,
        studentCertificateName: studentCertificateName.trim() || selectedStudent.name,
        groupId: selectedStudent.groupId,
        groupName: selectedGroup?.name,
        type,
        templateId,
        language,
        courseOrLevelTitle: courseOrLevelTitle.trim(),
        description: description.trim(),
        gradeOrScore: gradeOrScore.trim() || undefined,
        issueDate,
        instructorName: instructorName.trim(),
        centerOrSchoolName: centerOrSchoolName.trim() || undefined
      });
      confetti({ particleCount: 60, spread: 50 });
      if (onCertificateSaved) onCertificateSaved(currentCertificateData);
      onClose();
    } else {
      const newRecord = addCertificate({
        studentId,
        studentName: selectedStudent.name,
        studentCertificateName: studentCertificateName.trim() || selectedStudent.name,
        groupId: selectedStudent.groupId,
        groupName: selectedGroup?.name,
        type,
        templateId,
        language,
        courseOrLevelTitle: courseOrLevelTitle.trim(),
        description: description.trim(),
        gradeOrScore: gradeOrScore.trim() || undefined,
        issueDate,
        instructorName: instructorName.trim(),
        centerOrSchoolName: centerOrSchoolName.trim() || undefined
      });

      confetti({ particleCount: 100, spread: 70 });
      setCreatedRecord(newRecord);
      if (onCertificateSaved) onCertificateSaved(newRecord);
    }
  };

  const handleExportPDF = async () => {
    if (!createdRecord) return;
    setIsExporting(true);
    try {
      await downloadCertificatePDF(createdRecord);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPNG = async () => {
    if (!createdRecord) return;
    setIsExporting(true);
    try {
      await downloadCertificateImage(createdRecord);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!createdRecord || !selectedStudent) return;
    shareCertificateWhatsApp(createdRecord, selectedStudent.parentPhone || selectedStudent.studentPhone);
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
                {_t('تكريم الطالب وتوثيق إنجازه بشهادة احترافية قابلة للتحميل والمشاركة', 'Honor the student with a professional downloadable certificate', 'Schüler mit einem Zertifikat ehren')}
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
                  `تم حفظ وتوثيق شهادة الطالب ${createdRecord.studentName} في الأرشيف ومركز الشهادات.`,
                  `Certificate for ${createdRecord.studentName} has been saved to the archive.`,
                  `Das Zertifikat für ${createdRecord.studentName} wurde gespeichert.`
                )}
              </p>
            </div>

            {/* Hidden Renderer for export DOM rendering */}
            <div className="hidden">
              <CertificateRenderer certificate={createdRecord} elementId={`cert-node-${createdRecord.id}`} />
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="py-3 px-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50 text-xs"
              >
                <Download className="w-4 h-4" />
                <span>{_t('تحميل PDF', 'Download PDF', 'PDF herunterladen')}</span>
              </button>

              <button
                type="button"
                onClick={handleExportPNG}
                disabled={isExporting}
                className="py-3 px-4 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 text-text-main hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl font-black flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 text-xs"
              >
                <FileText className="w-4 h-4" />
                <span>{_t('تحميل صورة PNG', 'Download PNG', 'PNG herunterladen')}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer text-xs"
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
            
            {/* Student Picker & Latin Name */}
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
                <label className="block text-xs font-black text-text-main">
                  {_t('اسم الطالب باللاتينية / الإنجليزية (للطباعة على الشهادة) *', 'Certificate Student Name (Latin) *', 'Name auf dem Zertifikat *')}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={studentCertificateName}
                  onChange={e => setStudentCertificateName(e.target.value)}
                  placeholder="e.g. Ahmed Ali"
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Type & Language Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {_t('نوع الشهادة والتكريم', 'Certificate Type', 'Zertifikatstyp')}
                </label>
                <select
                  value={type}
                  onChange={e => handleTypeChange(e.target.value as CertificateTypeKey)}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CERTIFICATE_TYPES.map(t => (
                    <option key={t.key} value={t.key}>
                      {t.badgeEmoji} {t.titles[language] || t.titles.de}
                    </option>
                  ))}
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

            {/* Template Selector Cards */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-text-main">
                {_t('اختر قالب وتصميم الشهادة', 'Certificate Design Template', 'Designvorlage')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {PRIMARY_CERTIFICATE_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setTemplateId(tmpl.id)}
                    className={`p-2.5 rounded-2xl border text-start transition-all cursor-pointer relative flex flex-col justify-between ${
                      templateId === tmpl.id
                        ? 'bg-primary/5 dark:bg-primary-soft border-primary ring-2 ring-primary/20'
                        : 'bg-surface dark:bg-slate-900 border-surface-border dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="block font-black text-xs text-text-main">{tmpl.name[language] || tmpl.name.de}</span>
                      <span className="block text-[10px] text-text-muted leading-tight mt-0.5">{tmpl.description[language] || tmpl.description.de}</span>
                    </div>
                    {templateId === tmpl.id && (
                      <div className="mt-2 self-end">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Course Title & Distinction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {_t('عنوان الدورة / المستوى', 'Course / Level Title', 'Kurs- / Niveau-Titel')}
                </label>
                <input
                  type="text"
                  value={courseOrLevelTitle}
                  onChange={e => setCourseOrLevelTitle(e.target.value)}
                  placeholder="e.g. Deutschkurs Niveau A1"
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {_t('التقدير / الدرجة (اختياري)', 'Grade / Distinction (Optional)', 'Note / Prädikat (Optional)')}
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
                {_t('نص التقدير وسبب التكريم', 'Certificate Description / Honor Statement', 'Würdigungstext')}
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
