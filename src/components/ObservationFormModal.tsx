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

export const ObservationFormModal: React.FC<ObservationFormModalProps> = ({ isOpen, onClose, onSave, teachers, schoolSettings, _t, initialTeacherId }) => {
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
  const validTeachers = teachers.filter(t => t.id !== 'hod' && !t.isHod && (schoolSettings.hodName ? t.name !== schoolSettings.hodName : true));

  // Dynamically extract classes for the selected teacher
  const teacherClasses = useMemo(() => {
    if (!form.teacherId) return [];
    const schedules = schoolSettings.teacherSchedules?.[form.teacherId] || {};
    const classes = new Set<string>();
    (Object.values(schedules) as any[]).forEach(dayPeriods => {
      dayPeriods.forEach((p: any) => {
        if (p.className) classes.add(p.className.trim());
      });
    });
    return Array.from(classes).sort();
  }, [form.teacherId, schoolSettings.teacherSchedules]);

  // Dynamically extract period count
  const periodsCount = schoolSettings.periodSettings?.periodsCount || 8;
  const periodOptions = Array.from({length: periodsCount}, (_, i) => i + 1);

  const handleRatingChange = (field: keyof VisitRecord, rating: ObservationRating) => {
    setForm({ ...form, [field]: rating });
  };

  const renderRatingRow = (label: string, field: keyof VisitRecord) => {
    const currentRating = (form[field] as number) || 0;
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-surface border border-surface-border rounded-xl">
        <span className="text-xs font-bold text-text-main flex-1">{label}</span>
        <div className="flex bg-surface-hover p-1 rounded-lg border border-surface-border">
          {RATING_OPTIONS.map(opt => {
            const isSelected = currentRating === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleRatingChange(field, opt.value as ObservationRating)}
                className={`w-10 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${isSelected ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'}`}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col border border-surface-border">
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-hover/30 shrink-0">
          <h2 className="text-lg font-black text-text-main flex items-center gap-2">
            {_t('نموذج تقييم زيارة صفية', 'Classroom Observation Form', 'Klassenbeobachtungsformular')}
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-surface-hover/10">
          <form id="obsForm" onSubmit={handleSubmit} className="space-y-6">
            {/* Meta Info */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-surface rounded-xl border border-surface-border shadow-2xs">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">{_t('المعلم', 'Teacher', 'Lehrer')}</label>
                <select
                  value={form.teacherId}
                  onChange={e => setForm({ ...form, teacherId: e.target.value, className: '' })}
                  required
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{_t('-- اختر المعلم --', '-- Select Teacher --', '-- Lehrer wählen --')}</option>
                  {validTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">{_t('الفصل', 'Class', 'Klasse')}</label>
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
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{_t('-- اختر الفصل --', '-- Select Class --', '-- Klasse wählen --')}</option>
                  {teacherClasses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="Manual Entry">{_t('إدخال يدوي', 'Manual Entry', 'Manuelle Eingabe')}</option>
                </select>
                {isManualClass && (
                  <input
                    type="text"
                    placeholder="Class name..."
                    value={form.className}
                    onChange={e => setForm({ ...form, className: e.target.value })}
                    required
                    className="w-full mt-2 px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">{_t('التاريخ', 'Date', 'Datum')}</label>
                <input
                  type="date"
                  value={form.visitedDate}
                  onChange={e => setForm({ ...form, visitedDate: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">{_t('الحصة', 'Period', 'Stunde')}</label>
                <select
                  value={form.periodNumber}
                  onChange={e => setForm({ ...form, periodNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{_t('-- الحصة --', '-- Period --', '-- Stunde --')}</option>
                  {periodOptions.map(p => (
                    <option key={p} value={p.toString()}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category 1: Classroom Management */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-primary border-b border-surface-border pb-2">
                {_t('إدارة الفصل', 'Classroom Management', 'Klassenführung')}
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {renderRatingRow(_t('تنظيم ونظافة الفصل', 'Classroom organization and cleanliness', 'Klassenorganisation'), 'cm_organization')}
                {renderRatingRow(_t('سيطرة المعلم وضبط الفصل', 'Teacher\'s control and discipline', 'Lehrerkontrolle'), 'cm_control')}
                {renderRatingRow(_t('إدارة وقت الحصة بفعالية', 'Effective use of time', 'Zeitmanagement'), 'cm_time')}
                {renderRatingRow(_t('التعامل باحترام مع الطلاب', 'Respectful interaction with students', 'Respektvoller Umgang'), 'cm_respect')}
              </div>
            </div>

            {/* Category 2: Teaching Skills */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-primary border-b border-surface-border pb-2">
                {_t('المهارات التدريسية', 'Teaching Skills', 'Lehrfähigkeiten')}
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {renderRatingRow(_t('وضوح أهداف الدرس', 'Lesson objectives clearly stated', 'Lernziele klar formuliert'), 'ts_objectives')}
                {renderRatingRow(_t('استخدام الوسائل التعليمية المتنوعة', 'Use of various teaching aids', 'Verwendung von Lehrmitteln'), 'ts_aids')}
                {renderRatingRow(_t('تشجيع الطلاب على المشاركة', 'Encouraging student participation', 'Förderung der Schülerbeteiligung'), 'ts_participation')}
                {renderRatingRow(_t('طرح أسئلة مثيرة للتفكير', 'Asking thought-provoking questions', 'Stellen von anregenden Fragen'), 'ts_questions')}
                {renderRatingRow(_t('وضوح وبساطة الشرح', 'Clarity and simplicity of explanation', 'Klarheit der Erklärungen'), 'ts_clarity')}
              </div>
            </div>

            {/* Category 3: Student Engagement */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-primary border-b border-surface-border pb-2">
                {_t('تفاعل الطلاب', 'Student Engagement', 'Schülerengagement')}
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {renderRatingRow(_t('مشاركة الطلاب في الأنشطة', 'Students\' participation in activities', 'Beteiligung der Schüler'), 'se_participation')}
                {renderRatingRow(_t('التفاعل الإيجابي مع المعلم', 'Positive interaction with the teacher', 'Positive Interaktion'), 'se_interaction')}
                {renderRatingRow(_t('التزام الطلاب بقواعد الفصل', 'Students\' adherence to classroom rules', 'Einhaltung der Klassenregeln'), 'se_rules')}
              </div>
            </div>

            {/* Category 4: Booklet Correction */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-primary border-b border-surface-border pb-2">
                {_t('متابعة تصحيح الدفتر', 'Booklet & Workbook Correction', 'Heft- und Arbeitsbuchkorrektur')}
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {renderRatingRow(_t('انتظام وسرعة التصحيح', 'Regularity and promptness of marking', 'Regelmäßigkeit der Korrektur'), 'bc_regularity')}
                {renderRatingRow(_t('جودة التغذية الراجعة للطلاب', 'Quality of feedback & corrections given to students', 'Qualität des Feedbacks'), 'bc_quality')}
                {renderRatingRow(_t('استجابة الطلاب لتصويبات المعلم', 'Student compliance with notebook corrections', 'Schüler-Compliance bei Korrekturen'), 'bc_compliance')}
              </div>
            </div>

            {/* Overall Rating & Consolidated Notes */}
            <div className="space-y-4 pt-4 border-t border-surface-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
                <span className="text-sm font-black text-primary">
                  {_t('النتيجة الكلية', 'Total Score', 'Gesamtpunktzahl')}:
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-primary">{totalScore} / {maxScore}</span>
                  <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg shadow-sm">
                    {overallCategoryStr}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">{_t('ملاحظات وتوصيات المشرف', 'Supervisor Notes & Recommendations', 'Notizen & Empfehlungen')}</label>
                <textarea
                  value={form.consolidatedNotes}
                  onChange={e => setForm({ ...form, consolidatedNotes: e.target.value })}
                  rows={5}
                  placeholder={_t('اكتب ملاحظاتك وتوصياتك هنا...', 'Write your notes and recommendations here...', 'Schreiben Sie hier Ihre Notizen und Empfehlungen...')}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                ></textarea>
              </div>
            </div>

          </form>
        </div>
        
        <div className="p-4 border-t border-surface-border flex items-center justify-end gap-3 bg-surface-hover/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-text-muted hover:text-text-main transition-colors"
          >
            {_t('إلغاء', 'Cancel', 'Abbrechen')}
          </button>
          <button
            type="submit"
            form="obsForm"
            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-hover transition-all shadow-sm flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{_t('حفظ الزيارة', 'Save Observation', 'Beobachtung speichern')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
