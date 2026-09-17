import React, { useState, useEffect, useMemo } from 'react';
import { X, Check } from 'lucide-react';
import { Teacher, VisitRecord, ObservationRating, SchoolSettings } from '../types';

interface ObservationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Partial<VisitRecord>) => void;
  teachers: Teacher[];
  schoolSettings: SchoolSettings;
  _t: (ar: string, en: string, de: string) => string;
  initialTeacherId?: string;
}

const RATING_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' }
];

export const ObservationFormModal: React.FC<ObservationFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  teachers,
  schoolSettings,
  _t,
  initialTeacherId
}) => {
  const [form, setForm] = useState<Partial<VisitRecord>>({
    teacherId: '',
    className: '',
    visitedDate: new Date().toISOString().split('T')[0],
    periodNumber: '',
    lessonTopic: '',
    consolidatedNotes: '',

    cm_organization: 0 as ObservationRating,
    cm_control: 0 as ObservationRating,
    cm_time: 0 as ObservationRating,
    cm_respect: 0 as ObservationRating,

    ts_objectives: 0 as ObservationRating,
    ts_aids: 0 as ObservationRating,
    ts_participation: 0 as ObservationRating,
    ts_questions: 0 as ObservationRating,
    ts_clarity: 0 as ObservationRating,

    se_participation: 0 as ObservationRating,
    se_interaction: 0 as ObservationRating,
    se_rules: 0 as ObservationRating,

    bc_regularity: 0 as ObservationRating,
    bc_quality: 0 as ObservationRating,
    bc_compliance: 0 as ObservationRating,
  });

  useEffect(() => {
    if (isOpen) {
      setForm(prev => ({ ...prev, teacherId: initialTeacherId || '' }));
    }
  }, [isOpen, initialTeacherId]);

  const [isManualClass, setIsManualClass] = useState(false);

  // Filter out HOD
  const validTeachers = teachers.filter(
    t => t.id !== 'hod' && !t.isHod && (schoolSettings.hodName ? t.name !== schoolSettings.hodName : true)
  );

  // Dynamically extract classes for the selected teacher
  const teacherClasses = useMemo(() => {
    if (!form.teacherId) return [];
    const schedules = schoolSettings.teacherSchedules?.[form.teacherId] || {};
    const classes = new Set<string>();
    (Object.values(schedules) as any[]).forEach(dayPeriods => {
      if (Array.isArray(dayPeriods)) {
        dayPeriods.forEach((p: any) => {
          if (p.className) classes.add(p.className.trim());
        });
      }
    });
    const currentTeacher = teachers.find(t => t.id === form.teacherId);
    if (currentTeacher?.classes && Array.isArray(currentTeacher.classes)) {
      currentTeacher.classes.forEach(c => {
        if (c) classes.add(c.trim());
      });
    }
    (schoolSettings.visitRecords || []).forEach((v: any) => {
      if ((v.teacherId === form.teacherId || v.teacherName === currentTeacher?.name) && v.className) {
        classes.add(v.className.trim());
      }
    });
    return Array.from(classes).sort();
  }, [form.teacherId, schoolSettings.teacherSchedules, teachers, schoolSettings.visitRecords]);

  // Dynamically extract period count
  const periodsCount = schoolSettings.periodSettings?.periodsCount || 8;
  const periodOptions = Array.from({ length: periodsCount }, (_, i) => i + 1);

  const handleRatingChange = (field: keyof VisitRecord, rating: ObservationRating) => {
    setForm({ ...form, [field]: rating });
  };

  const renderRatingRow = (label: string, field: keyof VisitRecord) => {
    const currentRating = (form[field] as number) || 0;
    return (
      <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 bg-surface border border-surface-border rounded-xl hover:bg-surface-hover/40 transition-colors">
        <span className="text-[11px] sm:text-xs font-bold text-text-main flex-1 leading-snug">
          {label}
        </span>
        <div className="flex bg-surface-hover p-0.5 rounded-lg border border-surface-border shrink-0">
          {RATING_OPTIONS.map(opt => {
            const isSelected = currentRating === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleRatingChange(field, opt.value as ObservationRating)}
                className={`w-7 h-7 sm:w-8 sm:h-8 text-[11px] sm:text-xs font-black rounded-md transition-all flex items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs scale-105'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Auto-calculate score whenever form changes
  const calculateTotalScore = () => {
    const fields = [
      'cm_organization', 'cm_control', 'cm_time', 'cm_respect',
      'ts_objectives', 'ts_aids', 'ts_participation', 'ts_questions', 'ts_clarity',
      'se_participation', 'se_interaction', 'se_rules',
      'bc_regularity', 'bc_quality', 'bc_compliance'
    ];
    let total = 0;
    fields.forEach(f => {
      total += (form[f as keyof VisitRecord] as number) || 0;
    });
    return total;
  };
  const totalScore = calculateTotalScore();
  const maxScore = 75; // 15 fields * 5

  const getOverallCategory = (score: number) => {
    if (score >= 68) return _t('ممتاز', 'Excellent', 'Ausgezeichnet');
    if (score >= 55) return _t('جيد جداً', 'Very Good', 'Sehr Gut');
    if (score >= 40) return _t('جيد', 'Good', 'Gut');
    return _t('يحتاج تطوير', 'Needs Improvement', 'Verbesserungsbedürftig');
  };

  const overallCategoryStr = getOverallCategory(totalScore);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teacherId || !form.className) return;
    onSave({
      ...form,
      overallScore: totalScore,
      overallCategory: overallCategoryStr
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col border border-surface-border animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Compact */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-surface-border flex items-center justify-between bg-surface-hover/40 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black text-text-main">
              {_t('نموذج تقييم زيارة صفية', 'Classroom Observation Form', 'Klassenbeobachtungsformular')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-3 sm:p-4 overflow-y-auto custom-scrollbar flex-1 bg-surface-hover/10">
          <form id="obsForm" onSubmit={handleSubmit} className="space-y-4">
            {/* Meta Info Grid - 2 cols on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-2.5 sm:p-3 bg-surface rounded-xl border border-surface-border shadow-2xs">
              {/* Teacher */}
              <div className="col-span-2 sm:col-span-1 space-y-1">
                <label className="text-[10px] sm:text-[11px] font-black text-text-muted uppercase">
                  {_t('المعلم', 'Teacher', 'Lehrer')}
                </label>
                <select
                  value={form.teacherId}
                  onChange={e => setForm({ ...form, teacherId: e.target.value, className: '' })}
                  required
                  className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:border-primary truncate"
                >
                  <option value="">{_t('-- اختر المعلم --', '-- Select Teacher --', '-- Lehrer wählen --')}</option>
                  {validTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Class */}
              <div className="space-y-1">
                <label className="text-[10px] sm:text-[11px] font-black text-text-muted uppercase">
                  {_t('الفصل', 'Class', 'Klasse')}
                </label>
                <select
                  value={isManualClass ? 'Manual Entry' : form.className}
                  onChange={e => {
                    if (e.target.value === 'Manual Entry') {
                      setIsManualClass(true);
                      setForm({ ...form, className: '' });
                    } else {
                      setIsManualClass(false);
                      setForm({ ...form, className: e.target.value });
                    }
                  }}
                  required={!isManualClass}
                  className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:border-primary truncate"
                >
                  <option value="">{_t('-- الفصل --', '-- Class --', '-- Klasse --')}</option>
                  {teacherClasses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="Manual Entry">{_t('إدخال يدوي', 'Manual Entry', 'Manuell')}</option>
                </select>
                {isManualClass && (
                  <input
                    type="text"
                    placeholder="Class name..."
                    value={form.className}
                    onChange={e => setForm({ ...form, className: e.target.value })}
                    required
                    className="w-full mt-1 px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                  />
                )}
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-[10px] sm:text-[11px] font-black text-text-muted uppercase">
                  {_t('التاريخ', 'Date', 'Datum')}
                </label>
                <input
                  type="date"
                  value={form.visitedDate}
                  onChange={e => setForm({ ...form, visitedDate: e.target.value })}
                  required
                  className="w-full px-2 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              {/* Period */}
              <div className="col-span-2 sm:col-span-1 space-y-1">
                <label className="text-[10px] sm:text-[11px] font-black text-text-muted uppercase">
                  {_t('الحصة', 'Period', 'Stunde')}
                </label>
                <select
                  value={form.periodNumber}
                  onChange={e => setForm({ ...form, periodNumber: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                >
                  <option value="">{_t('-- الحصة --', '-- Period --', '-- Stunde --')}</option>
                  {periodOptions.map(p => (
                    <option key={p} value={p.toString()}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category 1: Classroom Management */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-black text-primary border-b border-surface-border pb-1">
                {_t('إدارة الفصل', 'Classroom Management', 'Klassenführung')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {renderRatingRow(_t('تنظيم ونظافة الفصل', 'Classroom organization and cleanliness', 'Klassenorganisation'), 'cm_organization')}
                {renderRatingRow(_t('سيطرة المعلم وضبط الفصل', 'Teacher\'s control and discipline', 'Lehrerkontrolle'), 'cm_control')}
                {renderRatingRow(_t('إدارة وقت الحصة بفعالية', 'Effective use of time', 'Zeitmanagement'), 'cm_time')}
                {renderRatingRow(_t('التعامل باحترام مع الطلاب', 'Respectful interaction with students', 'Respektvoller Umgang'), 'cm_respect')}
              </div>
            </div>

            {/* Category 2: Teaching Skills */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-black text-primary border-b border-surface-border pb-1">
                {_t('المهارات التدريسية', 'Teaching Skills', 'Lehrfähigkeiten')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {renderRatingRow(_t('وضوح أهداف الدرس', 'Lesson objectives clearly stated', 'Lernziele klar formuliert'), 'ts_objectives')}
                {renderRatingRow(_t('استخدام الوسائل التعليمية المتنوعة', 'Use of various teaching aids', 'Verwendung von Lehrmitteln'), 'ts_aids')}
                {renderRatingRow(_t('تشجيع الطلاب على المشاركة', 'Encouraging student participation', 'Förderung der Schülerbeteiligung'), 'ts_participation')}
                {renderRatingRow(_t('طرح أسئلة مثيرة للتفكير', 'Asking thought-provoking questions', 'Stellen von anregenden Fragen'), 'ts_questions')}
                {renderRatingRow(_t('وضوح وبساطة الشرح', 'Clarity and simplicity of explanation', 'Klarheit der Erklärungen'), 'ts_clarity')}
              </div>
            </div>

            {/* Category 3: Student Engagement */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-black text-primary border-b border-surface-border pb-1">
                {_t('تفاعل الطلاب', 'Student Engagement', 'Schülerengagement')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {renderRatingRow(_t('مشاركة الطلاب في الأنشطة', 'Students\' participation in activities', 'Beteiligung der Schüler'), 'se_participation')}
                {renderRatingRow(_t('التفاعل الإيجابي مع المعلم', 'Positive interaction with the teacher', 'Positive Interaktion'), 'se_interaction')}
                {renderRatingRow(_t('التزام الطلاب بقواعد الفصل', 'Students\' adherence to classroom rules', 'Einhaltung der Klassenregeln'), 'se_rules')}
              </div>
            </div>

            {/* Category 4: Booklet Correction */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-black text-primary border-b border-surface-border pb-1">
                {_t('متابعة تصحيح الدفتر', 'Booklet & Workbook Correction', 'Heft- und Arbeitsbuchkorrektur')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {renderRatingRow(_t('انتظام وسرعة التصحيح', 'Regularity and promptness of marking', 'Regelmäßigkeit der Korrektur'), 'bc_regularity')}
                {renderRatingRow(_t('جودة التغذية الراجعة للطلاب', 'Quality of feedback & corrections given to students', 'Qualität des Feedbacks'), 'bc_quality')}
                {renderRatingRow(_t('استجابة الطلاب لتصويبات المعلم', 'Student compliance with notebook corrections', 'Schüler-Compliance bei Korrekturen'), 'bc_compliance')}
              </div>
            </div>

            {/* Overall Rating & Consolidated Notes */}
            <div className="space-y-3 pt-2 border-t border-surface-border">
              <div className="flex items-center justify-between p-2.5 sm:p-3 bg-primary/5 rounded-xl border border-primary/20">
                <span className="text-xs sm:text-sm font-black text-primary">
                  {_t('النتيجة الكلية', 'Total Score', 'Gesamtpunktzahl')}:
                </span>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-base sm:text-lg font-black text-primary">{totalScore} / {maxScore}</span>
                  <span className="px-2.5 py-0.5 bg-primary text-white text-[11px] font-bold rounded-lg shadow-xs">
                    {overallCategoryStr}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-muted">
                  {_t('ملاحظات وتوصيات المشرف', 'Supervisor Notes & Recommendations', 'Notizen & Empfehlungen')}
                </label>
                <textarea
                  value={form.consolidatedNotes}
                  onChange={e => setForm({ ...form, consolidatedNotes: e.target.value })}
                  rows={3}
                  placeholder={_t('اكتب ملاحظاتك وتوصياتك هنا...', 'Write your notes and recommendations here...', 'Schreiben Sie hier Ihre Notizen und Empfehlungen...')}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs sm:text-sm font-medium text-text-main focus:outline-none focus:border-primary resize-y"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-t border-surface-border flex items-center justify-end gap-2 bg-surface-hover/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs font-bold text-text-muted hover:text-text-main bg-surface hover:bg-surface-hover border border-surface-border rounded-xl transition-all cursor-pointer"
          >
            {_t('إلغاء', 'Cancel', 'Abbrechen')}
          </button>
          <button
            type="submit"
            form="obsForm"
            className="h-9 px-4 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{_t('حفظ الزيارة', 'Save Observation', 'Beobachtung speichern')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
