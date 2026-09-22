import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GradeLevel, LessonType, PaymentCycle } from '../types';
import { Users, Bot, Sparkles, Phone, AtSign, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AiImportModal } from './AiImportModal';
import { GroupForm, GroupFormData } from './GroupForm';
import { PREDEFINED_GRADES, COURSE_LEVELS, SCHOOL_GRADES } from '../data/initialData';
import { isWhatsAppUsername, cleanWhatsAppUsername } from '../utils/phoneUtils';

interface AddGroupModalProps {
  onClose: () => void;
}

export const AddGroupModal: React.FC<AddGroupModalProps> = ({ onClose }) => {
  const { addGroup, addStudent, generateGroupScheduleLessons, profile, language, t, _t } = useApp();

  
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);

  // 1-to-1 Student Creation Option States
  const [createStudentWithGroup, setCreateStudentWithGroup] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentParentName, setStudentParentName] = useState('');
  const [studentContactType, setStudentContactType] = useState<'phone' | 'username'>('phone');
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
        alert(_t('رقم الهاتف أو اليوزر نيم لولي الأمر مطلوب', 'Parent phone number or WhatsApp username is required', 'Telefonnummer oder WhatsApp-Benutzername der Eltern ist erforderlich'));
        return;
      }
    }

    const isPerLesson = data.paymentCycle === 'per_lesson';
    const pricePerSession = Number(data.pricePerSession) || 0;
    const calcMonthlyPrice = isPerLesson 
      ? pricePerSession
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
      paymentModel: isPerLesson ? 'per_session' : 'package',
      monthlyPackagePrice: calcMonthlyPrice,
      pricePerSession: isPerLesson ? pricePerSession : undefined,
      sessionCount: isPerLesson ? 1 : Number(data.sessionCount),
      startingSessionNumber: isPerLesson ? 1 : Number(data.startingSessionNumber),
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
      const isUser = studentContactType === 'username' || isWhatsAppUsername(studentParentPhone);
      const cleanUser = cleanWhatsAppUsername(studentParentPhone);
      const finalPhone = isUser ? `@${cleanUser}` : studentParentPhone.trim();

      addStudent({
        name: studentName.trim(),
        groupId: createdGroup.id,
        grade: studentGrade || data.grade,
        parentName: studentParentName.trim(),
        parentPhone: finalPhone,
        parentUsername: isUser ? cleanUser : undefined,
        parentContactType: isUser ? 'username' : 'phone',
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
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-hover px-3.5 py-2.5 sm:p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-1.5 sm:p-2 bg-surface/20 rounded-lg sm:rounded-xl shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h2 className="text-xs sm:text-sm font-black">{t('add_group_title')}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface/20 rounded-full transition-colors cursor-pointer">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
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

                {/* Parent Phone / Username */}
                <div className="space-y-1.5 bg-surface p-2.5 rounded-xl border border-surface-border">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-main">
                      {_t('هاتف / يوزر نيم ولي الأمر', 'Parent Phone / Username', 'Telefon / WhatsApp Benutzername')}
                    </label>
                    <div className="flex items-center bg-surface-hover border border-surface-border rounded-lg p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setStudentContactType('phone');
                          if (studentParentPhone.startsWith('@')) setStudentParentPhone(studentParentPhone.replace(/^@/, ''));
                        }}
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                          studentContactType === 'phone'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        <Phone className="w-2.5 h-2.5" />
                        <span>{_t('هاتف', 'Phone', 'Telefon')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentContactType('username');
                          if (studentParentPhone && !studentParentPhone.startsWith('@')) setStudentParentPhone(`@${studentParentPhone}`);
                        }}
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                          studentContactType === 'username'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        <AtSign className="w-2.5 h-2.5" />
                        <span>{_t('يوزر نيم', 'Username', 'Benutzername')}</span>
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-text-muted">
                      {studentContactType === 'username' ? (
                        <AtSign className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Phone className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                    <input
                      type="text"
                      inputMode={studentContactType === 'phone' ? 'tel' : 'text'}
                      dir="ltr"
                      value={studentParentPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStudentParentPhone(val);
                        if (val.startsWith('@') || (val.length > 2 && /[a-zA-Z]/.test(val))) {
                          setStudentContactType('username');
                        }
                      }}
                      placeholder={studentContactType === 'username' ? '@username (e.g. @ahmed_parent)' : '+20 123 456 789'}
                      className="w-full ps-9 pe-3 py-2 bg-background border border-surface-border rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
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
