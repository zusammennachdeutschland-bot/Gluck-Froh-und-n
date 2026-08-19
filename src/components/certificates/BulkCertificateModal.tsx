import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CertificateRecord, CertificateTypeKey, CertificateTemplateId, CertificateLanguage, AICertificateBackground } from '../../types';
import {
  CERTIFICATE_CATEGORIES_CONFIG,
  CERTIFICATE_TYPES_CONFIG,
  PRIMARY_CERTIFICATE_TEMPLATES,
  getCertificateDefaultText
} from '../../data/certificateTypes';
import { formatLocalDate } from '../../utils/timeUtils';
import { resolveCertificateRecipientName } from '../../utils/certificateUtils';
import { getSavedAIBackgrounds } from '../../utils/aiBackgroundUtils';
import { X, Check, Sparkles, CheckCircle2, Layers, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BulkCertificateModalProps {
  onClose: () => void;
  initialGroupId?: string;
  onBulkIssued?: (certs: CertificateRecord[]) => void;
}

export const BulkCertificateModal: React.FC<BulkCertificateModalProps> = ({
  onClose,
  initialGroupId,
  onBulkIssued
}) => {
  const { students, groups, profile, addCertificatesBulk, updateStudentCertificateNamesBulk, _t } = useApp();

  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || (groups[0]?.id || 'all'));
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => {
    const active = students.filter(s => {
      if (s.status === 'archived') return false;
      if (initialGroupId && initialGroupId !== 'all') return s.groupId === initialGroupId;
      return true;
    });
    return new Set(active.map(s => s.id));
  });

  const [language, setLanguage] = useState<CertificateLanguage>('de');
  const [type, setType] = useState<CertificateTypeKey>('achievement');
  const [templateTab, setTemplateTab] = useState<'standard' | 'ai_custom'>('standard');
  const [templateId, setTemplateId] = useState<CertificateTemplateId>('classic');
  const [savedAIBackgrounds, setSavedAIBackgrounds] = useState<AICertificateBackground[]>([]);
  const [selectedCustomBg, setSelectedCustomBg] = useState<AICertificateBackground | null>(null);

  useEffect(() => {
    getSavedAIBackgrounds().then(setSavedAIBackgrounds);
  }, []);

  const [courseOrLevelTitle, setCourseOrLevelTitle] = useState<string>('Certificate of Achievement');

  const [description, setDescription] = useState<string>(() => {
    const defaults = getCertificateDefaultText(type, language);
    return defaults.description;
  });

  const currentTeacherName = profile?.displayName || (profile as any)?.name || '';
  const [issueDate, setIssueDate] = useState<string>(formatLocalDate());
  const [instructorName, setInstructorName] = useState<string>(currentTeacherName || 'Lehrer/in');
  const [centerOrSchoolName, setCenterOrSchoolName] = useState<string>('');

  const [latinNamesEdits, setLatinNamesEdits] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [issuedCount, setIssuedCount] = useState<number | null>(null);

  const groupStudents = students.filter(s => {
    if (s.status === 'archived') return false;
    if (selectedGroupId === 'all') return true;
    return s.groupId === selectedGroupId;
  });

  const handleGroupChange = (newGid: string) => {
    setSelectedGroupId(newGid);
    const filtered = students.filter(s => s.status !== 'archived' && (newGid === 'all' || s.groupId === newGid));
    setSelectedStudentIds(new Set(filtered.map(s => s.id)));
    setValidationError(null);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setValidationError(null);
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === groupStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(groupStudents.map(s => s.id)));
    }
    setValidationError(null);
  };

  const handleTypeChange = (newType: CertificateTypeKey) => {
    setType(newType);
    const defaults = getCertificateDefaultText(newType, language);
    setDescription(defaults.description);
    setCourseOrLevelTitle(defaults.title);
  };

  const handleLanguageChange = (newLang: CertificateLanguage) => {
    setLanguage(newLang);
    const defaults = getCertificateDefaultText(type, newLang);
    setDescription(defaults.description);
    setCourseOrLevelTitle(defaults.title);
    setValidationError(null);
  };

  const handleGenerateBulk = () => {
    setValidationError(null);
    const targetStudents = groupStudents.filter(s => selectedStudentIds.has(s.id));
    if (targetStudents.length === 0) return;

    // Check if any students lack Latin names when language is English or German
    if (language === 'en' || language === 'de') {
      const missingStudents = targetStudents.filter(student => {
        const customName = latinNamesEdits[student.id];
        const effectiveName = customName !== undefined ? customName.trim() : (student.certificateName || '').trim();
        return !effectiveName;
      });

      if (missingStudents.length > 0) {
        setValidationError(
          _t(
            `⚠️ يرجى كتابة اسم الشهادة باللاتينية للطلاب الآتي أسماؤهم قبل الإصدار: ${missingStudents.map(s => s.name).join('، ')}`,
            `⚠️ Please provide Latin certificate names for: ${missingStudents.map(s => s.name).join(', ')}`,
            `⚠️ Bitte geben Sie lateinische Namen für folgende Schüler an: ${missingStudents.map(s => s.name).join(', ')}`
          )
        );
        return;
      }
    }

    // Apply and persist any edited recipient names to the students
    const namesToUpdate = Object.entries(latinNamesEdits)
      .filter(([_, certName]) => typeof certName === 'string' && certName.trim().length > 0)
      .map(([studentId, certificateName]) => ({
        studentId,
        certificateName: (certificateName as string).trim()
      }));
    
    if (namesToUpdate.length > 0) {
      updateStudentCertificateNamesBulk(namesToUpdate);
    }

    const isCustomBg = templateTab === 'ai_custom' && selectedCustomBg;
    const finalTemplateId = isCustomBg ? 'custom_ai_bg' : templateId;

    const payloadList = targetStudents.map(student => {
      const customVal = latinNamesEdits[student.id];
      const resolved = resolveCertificateRecipientName(
        language,
        student,
        customVal !== undefined ? customVal : (language === 'ar' ? student.name : student.certificateName)
      );

      const recipientName = resolved.name || (language === 'ar' ? student.name : 'Certificate Recipient');
      const grp = groups.find(g => g.id === student.groupId);

      return {
        studentId: student.id,
        studentName: student.name,
        recipientName: recipientName,
        studentCertificateName: (customVal || student.certificateName || recipientName).trim(),
        groupId: student.groupId,
        groupName: grp?.name,
        type,
        certificateType: type,
        templateId: finalTemplateId,
        template: finalTemplateId,
        customBackgroundId: isCustomBg ? selectedCustomBg.id : undefined,
        customBackgroundUrl: isCustomBg ? selectedCustomBg.imageUrl : undefined,
        customBackgroundTextColor: isCustomBg ? selectedCustomBg.textColorMode : undefined,
        language,
        title: courseOrLevelTitle.trim() || 'Certificate',
        courseOrLevelTitle: courseOrLevelTitle.trim() || 'Certificate',
        description: description.trim(),
        issueDate,
        instructorName: instructorName.trim() || currentTeacherName || 'Lehrer/in',
        teacherName: instructorName.trim() || currentTeacherName || 'Lehrer/in',
        centerOrSchoolName: centerOrSchoolName.trim() || undefined
      };
    });

    const created = addCertificatesBulk(payloadList);
    confetti({ particleCount: 120, spread: 80 });
    setIssuedCount(created.length);
    if (onBulkIssued) onBulkIssued(created);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div onClick={e => e.stopPropagation()} className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-main">
                {_t('إصدار شهادات جماعية للمجموعة', 'Bulk Issue Certificates', 'Gruppenzertifikate ausstellen')}
              </h2>
              <p className="text-xs text-text-muted">
                {_t('توليد وتكريم جميع طلاب المجموعة بضغطة زر واحدة', 'Generate certificates for an entire group with one click', 'Zertifikate für eine ganze Gruppe mit einem Klick generieren')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {issuedCount !== null ? (
          <div className="p-6 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-text-main">
                {_t(`تم إصدار ${issuedCount} شهادة بنجاح! 🏆`, `Successfully Issued ${issuedCount} Certificates! 🏆`, `${issuedCount} Zertifikate erfolgreich ausgestellt! 🏆`)}
              </h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                {_t(
                  'تم حفظ جميع الشهادات بنجاح في أرشيف مركز الشهادات وملفات الطلاب بدون أي أخطاء.',
                  'All certificates have been successfully saved to the Certificate Center archive.',
                  'Alle Zertifikate wurden erfolgreich im Zertifikate-Center gespeichert.'
                )}
              </p>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-black rounded-xl text-xs transition-colors cursor-pointer"
              >
                {_t('عرض في مركز الشهادات', 'View in Certificate Center', 'Im Zertifikate-Center ansehen')}
              </button>
            </div>
          </div>
        ) : (
          /* Form Content */
          <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
            
            {/* Validation Alert */}
            {validationError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2.5 text-red-600 dark:text-red-400 text-xs font-bold animate-shake">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Group Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-text-main">
                {_t('اختر المجموعة المستهدفة:', 'Select Target Group:', 'Zielgruppe auswählen:')}
              </label>
              <select
                value={selectedGroupId}
                onChange={e => handleGroupChange(e.target.value)}
                className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">{_t('جميع الطلاب النشطين', 'All Active Students', 'Alle aktiven Schüler')}</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.grade || 'General'})</option>
                ))}
              </select>
            </div>

            {/* Students Multi-Select Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-text-main">
                  {_t(`الطلاب المشمولين بالتكريم (${selectedStudentIds.size}/${groupStudents.length}):`, `Included Students (${selectedStudentIds.size}/${groupStudents.length}):`, `Schüler (${selectedStudentIds.size}/${groupStudents.length}):`)}
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  {selectedStudentIds.size === groupStudents.length ? _t('إلغاء تحديد الكل', 'Deselect All', 'Alle abwählen') : _t('تحديد الكل', 'Select All', 'Alle auswählen')}
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-surface-border dark:border-slate-800">
                {groupStudents.length === 0 ? (
                  <div className="text-center py-4 text-xs text-text-muted">
                    {_t('لا يوجد طلاب في هذه المجموعة', 'No students in this group', 'Keine Schüler in dieser Gruppe')}
                  </div>
                ) : (
                  groupStudents.map(student => {
                    const isSelected = selectedStudentIds.has(student.id);
                    const isLatinLang = language === 'en' || language === 'de';
                    const customName = latinNamesEdits[student.id];
                    const currentRecipient = customName !== undefined 
                      ? customName 
                      : (isLatinLang ? (student.certificateName || '') : student.name);
                    const isMissingLatin = isLatinLang && !currentRecipient.trim();

                    return (
                      <div
                        key={student.id}
                        className={`p-2 rounded-xl flex items-center justify-between gap-2 transition-all ${
                          isSelected
                            ? 'bg-surface dark:bg-slate-900 border border-primary/40 shadow-2xs'
                            : 'bg-surface/60 dark:bg-slate-900/60 border border-surface-border dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <div
                          onClick={() => toggleStudent(student.id)}
                          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                        >
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                            isSelected ? 'bg-primary border-primary text-white' : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="font-bold text-xs text-text-main truncate">{student.name}</span>
                        </div>

                        {/* Inline Recipient Name with warning if Latin name missing */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isMissingLatin && isSelected && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hidden sm:inline">
                              {_t('⚠️ مطلوب', '⚠️ Required', '⚠️ Erforderlich')}
                            </span>
                          )}
                          <input
                            type="text"
                            placeholder={isLatinLang ? 'Latin Name (e.g. Ali)' : 'الاسم بالعربية'}
                            value={currentRecipient}
                            onChange={e => {
                              setLatinNamesEdits(prev => ({ ...prev, [student.id]: e.target.value }));
                              setValidationError(null);
                            }}
                            className={`w-36 sm:w-44 px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded-lg text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary ${
                              isMissingLatin && isSelected
                                ? 'border-amber-400 dark:border-amber-500/70 bg-amber-50/20'
                                : 'border-surface-border dark:border-slate-700'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Type, Language & Template */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {_t('نوع الشهادة (مُقسّمة حسب الفئات)', 'Certificate Category & Type', 'Zertifikatstyp')}
                </label>
                <select
                  value={type}
                  onChange={e => handleTypeChange(e.target.value as CertificateTypeKey)}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
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
                  {_t('اللغة', 'Language', 'Sprache')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'de', label: 'Deutsch' },
                    { id: 'en', label: 'English' },
                    { id: 'ar', label: 'العربية' }
                  ].map(lang => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => handleLanguageChange(lang.id as CertificateLanguage)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
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

            {/* Template & AI Background Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-text-main">
                  {_t('قالب وتصميم الشهادة', 'Template Design', 'Vorlage')}
                </label>

                {savedAIBackgrounds.length > 0 && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setTemplateTab('standard')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        templateTab === 'standard'
                          ? 'bg-surface dark:bg-slate-700 text-text-main shadow-xs'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      {_t('القوالب الجاهزة', 'Standard', 'Vorlagen')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateTab('ai_custom')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        templateTab === 'ai_custom'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{_t(`خلفيات AI (${savedAIBackgrounds.length})`, `AI (${savedAIBackgrounds.length})`, `KI (${savedAIBackgrounds.length})`)}</span>
                    </button>
                  </div>
                )}
              </div>

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
                        className={`p-2 rounded-xl border text-start transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary ring-1 ring-primary'
                            : 'bg-surface dark:bg-slate-900 border-surface-border dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: tmpl.previewColor || '#4f46e5' }}
                          />
                          <span className="block font-black text-xs text-text-main truncate">
                            {tmpl.name[language] || tmpl.name.de}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        className={`p-1.5 rounded-xl border text-start transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-500/5 shadow-xs'
                            : 'bg-surface dark:bg-slate-900 border-surface-border dark:border-slate-800'
                        }`}
                      >
                        <div className="relative aspect-[1.414/1] w-full rounded-lg overflow-hidden mb-1 bg-slate-950">
                          <img
                            src={bg.imageUrl}
                            alt={bg.name}
                            className="w-full h-full object-cover object-center"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                              <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                                <Check className="w-3 h-3" />
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="block font-bold text-[10px] text-text-main truncate">
                          {bg.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Course Title & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-muted">
                  {_t('عنوان الشهادة / التكريم', 'Certificate Title', 'Kurstitel')}
                </label>
                <input
                  type="text"
                  value={courseOrLevelTitle}
                  onChange={e => setCourseOrLevelTitle(e.target.value)}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-muted">
                  {_t('تاريخ الإصدار', 'Issue Date', 'Ausstellungsdatum')}
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  className="w-full bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-border dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 text-text-muted hover:text-text-main font-bold rounded-xl text-xs cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>

              <button
                type="button"
                onClick={handleGenerateBulk}
                disabled={selectedStudentIds.size === 0}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{_t(`إصدار ${selectedStudentIds.size} شهادة للمجموعة`, `Generate ${selectedStudentIds.size} Certificates`, `${selectedStudentIds.size} Zertifikate generieren`)}</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
