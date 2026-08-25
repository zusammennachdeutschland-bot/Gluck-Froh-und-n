import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GradeLevel, LessonType, PaymentCycle } from '../types';
import { Users, Bot, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AiImportModal } from './AiImportModal';
import { GroupForm, GroupFormData } from './GroupForm';
import { PREDEFINED_GRADES, COURSE_LEVELS, SCHOOL_GRADES } from '../data/initialData';

interface AddGroupModalProps {
  onClose: () => void;
}

export const AddGroupModal: React.FC<AddGroupModalProps> = ({ onClose }) => {
  const { addGroup, addStudent, generateGroupScheduleLessons, profile, language, t } = useApp();

  
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);

  // 1-to-1 Student Creation Option States
  const [createStudentWithGroup, setCreateStudentWithGroup] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentParentName, setStudentParentName] = useState('');
  const [studentParentPhone, setStudentParentPhone] = useState('');
  const [studentGrade, setStudentGrade] = useState<GradeLevel>('Grade 9');
  const [studentNotes, setStudentNotes] = useState('');

  const handleSubmit = (data: GroupFormData) => {
    if (createStudentWithGroup) {
      if (!studentName.trim()) {
        alert(t('auto_please_enter_student_name'));
        return;
      }
      if (!studentParentPhone.trim()) {
        alert(t('auto_parent_phone_number_is_require'));
        return;
      }
    }

    const calcMonthlyPrice = data.paymentCycle === 'per_lesson' 
      ? Number(data.pricePerSession) * (data.sessionCount || 8)
      : Number(data.monthlyPackagePrice);

    const schedules = data.scheduleDays.map(day => ({
      day,
      time: data.dayTimes[day] || data.scheduleTime || '17:00'
    }));

    const createdGroup = addGroup({
      name: data.name,
      grade: data.grade,
      type: data.type,
      paymentCycle: data.paymentCycle,
      monthlyPackagePrice: calcMonthlyPrice,
      pricePerSession: data.paymentCycle === 'per_lesson' ? Number(data.pricePerSession) : undefined,
      sessionCount: Number(data.sessionCount),
      startingSessionNumber: Number(data.startingSessionNumber),
      defaultFinanceAccountId: data.defaultFinanceAccountId,
      scheduleDays: data.scheduleDays,
      scheduleTime: data.scheduleTime,
      scheduleDayTimes: data.dayTimes,
      schedules,
      zoomLink: data.type === 'online' ? data.zoomLink : undefined,
      meetLink: data.type === 'online' ? data.meetLink : undefined,
      address: data.type === 'offline' ? data.address : undefined,
      coordinates: data.type === 'offline' ? { lat: 30.0444, lng: 31.2357 } : undefined,
      color: data.color,
      lessonDurationMinutes: Number(data.lessonDurationMinutes),
      whatsAppGroupLink: data.whatsAppGroupLink.trim()
    });

    if (createStudentWithGroup && studentName.trim()) {
      addStudent({
        name: studentName.trim(),
        groupId: createdGroup.id,
        grade: studentGrade || data.grade,
        parentName: studentParentName.trim(),
        parentPhone: studentParentPhone.trim(),
        notes: studentNotes.trim()
      });
    }

    // Always auto generate calendar lessons for new groups
    if (data.scheduleDays.length > 0) {
      generateGroupScheduleLessons(createdGroup.id, data.scheduleDays, data.scheduleTime, 4, data.dayTimes, createdGroup);
    }

    confetti({ particleCount: 60, spread: 50 });
    onClose();
  };

  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center pt-[max(24px,env(safe-area-inset-top,24px))] p-0 sm:p-4 pb-0"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-md shadow-2xl overflow-hidden animate-scale-up"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-hover p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-surface/20 rounded-xl">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">{t('add_group_title')}</h2>
              <p className="text-xs text-primary-soft">{t('add_group_subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Form Body via GroupForm */}
        <GroupForm onSubmit={handleSubmit} isEdit={false}>
          {/* AI Import Shortcut Banner */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/10 to-primary/10 border border-primary-border dark:border-primary-border rounded-xl p-3 flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>{t('auto_import_group_students_with_a')}</span>
                  <Sparkles className="w-3 h-3 text-primary fill-primary" />
                </h4>
                <p className="text-[10px] text-text-muted">
                  {t('auto_create_group_and_all_students')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAiImportOpen(true)}
              className="bg-primary hover:bg-primary-hover text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              {t('auto_ai_import')}
            </button>
          </div>

          {/* One-to-One Student Creation Toggle & Section */}
          <div className="pt-3 border-t border-surface-border space-y-3">
            <label className="flex items-center gap-2.5 p-3.5 bg-primary-soft/40 dark:bg-primary-soft/20 border border-primary-border/60 rounded-xl cursor-pointer hover:bg-primary-soft/60 transition-all">
              <input
                type="checkbox"
                checked={createStudentWithGroup}
                onChange={(e) => setCreateStudentWithGroup(e.target.checked)}
                className="w-4 h-4 text-primary rounded border-surface-border focus:ring-primary accent-primary cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-text-main">
                  {t('auto_create_a_student_for_this_grou')}
                </span>
              </div>
            </label>

            {createStudentWithGroup && (
              <div className="p-4 bg-surface-hover/60 border border-surface-border rounded-xl space-y-3 animate-fade-in">
                <h4 className="text-xs font-black text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('auto_initial_student_information')}</span>
                </h4>
                
                {/* Student Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-main">
                    {t('auto_student_name')}
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder={t('auto_e_g_ahmed_ali')}
                    className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Parent Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-main">
                    {t('auto_parent_name')}
                  </label>
                  <input
                    type="text"
                    value={studentParentName}
                    onChange={(e) => setStudentParentName(e.target.value)}
                    placeholder={t('auto_e_g_ali_mahmoud')}
                    className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Parent Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-main">
                      {t('auto_parent_phone')}
                    </label>
                    <input
                      type="tel"
                      value={studentParentPhone}
                      onChange={(e) => setStudentParentPhone(e.target.value)}
                      placeholder="+20 123 456 789"
                      className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-main">
                      {t('auto_grade')}
                    </label>
                    <select
                      value={studentGrade}
                      onChange={(e) => setStudentGrade(e.target.value as GradeLevel)}
                      className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-bold"
                    >
                      <optgroup label="مستويات الكورسات (Course Levels)">
                        {COURSE_LEVELS.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </optgroup>
                      <optgroup label="الصفوف المدرسية (School Grades)">
                        {SCHOOL_GRADES.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-main">
                    {t('auto_student_notes')}
                  </label>
                  <textarea
                    rows={2}
                    value={studentNotes}
                    onChange={(e) => setStudentNotes(e.target.value)}
                    placeholder={t('auto_additional_student_notes')}
                    className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            form="group-form"
            className="w-full bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs py-3 rounded-lg shadow-md transition-all cursor-pointer mt-4"
          >
            {t('auto_save_group')}
          </button>
        </GroupForm>
      </div>

      <AiImportModal
        isOpen={isAiImportOpen}
        onClose={() => {
          setIsAiImportOpen(false);
          onClose();
        }}
      />
    </div>
  );
};
