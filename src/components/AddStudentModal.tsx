import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { storage } from '../services/storageService';
import { PREDEFINED_GRADES, COURSE_LEVELS, SCHOOL_GRADES } from '../data/initialData';
import { GradeLevel } from '../types';
import { X, UserPlus, Info, Phone, AtSign, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { isWhatsAppUsername, cleanWhatsAppUsername } from '../utils/phoneUtils';
import { isLikelyFemaleStudent } from '../utils/genderUtils';
import { transliterateArabicNameToEnglish } from '../utils/nameUtils';

interface AddStudentModalProps {
  onClose: () => void;
  initialGroupId?: string;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ onClose, initialGroupId }) => {
  const { groups, students, addStudent, t, _t, language } = useApp();

  // Helper for inline translations
  
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [hasManualGender, setHasManualGender] = useState(false);
  const [certificateName, setCertificateName] = useState('');
  const [groupId, setGroupId] = useState(initialGroupId || groups[0]?.id || '');
  const [grade, setGrade] = useState<GradeLevel>(() => {
    if (initialGroupId) {
      const g = groups.find(x => x.id === initialGroupId);
      if (g?.grade) return g.grade;
    }
    return 'Grade 7';
  });
  const [parentName, setParentName] = useState('');
  const [parentContactType, setParentContactType] = useState<'phone' | 'username'>('phone');
  const [parentPhone, setParentPhone] = useState('');
  const [studentContactType, setStudentContactType] = useState<'phone' | 'username'>('phone');
  const [studentPhone, setStudentPhone] = useState('');
  const [notes, setNotes] = useState('');

  const selectedGroup = groups.find(g => g.id === groupId);

  // Load draft on mount
  useEffect(() => {
    async function loadDraft() {
      const draft = await storage.getItem<any>('dl_draft_add_student');
      if (draft) {
        if (draft.name) setName(draft.name);
        if (draft.certificateName) setCertificateName(draft.certificateName);
        if (draft.groupId) setGroupId(draft.groupId);
        if (draft.grade) setGrade(draft.grade);
        if (draft.parentName) setParentName(draft.parentName);
        if (draft.parentContactType) setParentContactType(draft.parentContactType);
        if (draft.parentPhone) {
          setParentPhone(draft.parentPhone);
          if (isWhatsAppUsername(draft.parentPhone) || draft.parentPhone.startsWith('@')) {
            setParentContactType('username');
          }
        }
        if (draft.studentContactType) setStudentContactType(draft.studentContactType);
        if (draft.studentPhone) {
          setStudentPhone(draft.studentPhone);
          if (isWhatsAppUsername(draft.studentPhone) || draft.studentPhone.startsWith('@')) {
            setStudentContactType('username');
          }
        }
        if (draft.notes) setNotes(draft.notes);
      }
    }
    loadDraft();
  }, []);

  // Save draft on state changes
  useEffect(() => {
    if (name || certificateName || parentName || parentPhone || studentPhone || notes) {
      storage.setItem('dl_draft_add_student', {
        name, certificateName, groupId, grade, parentName, parentContactType, parentPhone, studentContactType, studentPhone, notes
      });
    }
  }, [name, certificateName, groupId, grade, parentName, parentContactType, parentPhone, studentContactType, studentPhone, notes]);

  const handleParentPhoneChange = (val: string) => {
    setParentPhone(val);
    if (val.startsWith('@') || (val.length > 2 && /[a-zA-Z]/.test(val))) {
      setParentContactType('username');
    }
  };

  const handleStudentPhoneChange = (val: string) => {
    setStudentPhone(val);
    if (val.startsWith('@') || (val.length > 2 && /[a-zA-Z]/.test(val))) {
      setStudentContactType('username');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !groupId) return;
    if (!certificateName.trim()) {
      alert(_t('اسم الطالب بالإنجليزية مطلوب للشهادات!', 'Student English name is required for certificates!', 'Der englische Name des Schülers ist für Zertifikate erforderlich!'));
      return;
    }
    if (!parentPhone.trim()) {
      alert(_t(
        'رقم هاتف أو يوزر نيم ولي الأمر مطلوب!', 
        'Parent phone number or WhatsApp username is required!', 
        'Telefonnummer oder WhatsApp-Benutzername der Eltern ist erforderlich!'
      ));
      return;
    }
    const isDuplicate = students.some(s => (s.name || '').toLowerCase() === (name || '').toLowerCase() && s.groupId === groupId);
    if (isDuplicate) {
      if (!window.confirm(t('duplicate_student_warning') || 'طالب بنفس الاسم موجود بالفعل. هل تريد المتابعة؟ / A student with the same name already exists in this group. Do you want to continue?')) return;
    }

    const isParentUser = parentContactType === 'username' || isWhatsAppUsername(parentPhone);
    const cleanParentUser = cleanWhatsAppUsername(parentPhone);
    const finalParentPhone = isParentUser ? `@${cleanParentUser}` : parentPhone.trim();

    const hasStudentVal = !!studentPhone.trim();
    const isStudentUser = hasStudentVal && (studentContactType === 'username' || isWhatsAppUsername(studentPhone));
    const cleanStudentUser = hasStudentVal ? cleanWhatsAppUsername(studentPhone) : '';
    const finalStudentPhone = hasStudentVal ? (isStudentUser ? `@${cleanStudentUser}` : studentPhone.trim()) : '';

    addStudent({
      name,
      certificateName: certificateName.trim(),
      gender,
      groupId,
      grade: grade || selectedGroup?.grade || 'Grade 7',
      parentName,
      parentPhone: finalParentPhone,
      parentUsername: isParentUser ? cleanParentUser : undefined,
      parentContactType: isParentUser ? 'username' : 'phone',
      studentPhone: finalStudentPhone,
      studentUsername: isStudentUser ? cleanStudentUser : undefined,
      studentContactType: isStudentUser ? 'username' : (hasStudentVal ? 'phone' : undefined),
      notes,
      avatarUrl: ''
    });

    storage.removeItem('dl_draft_add_student');
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
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h2 className="text-xs sm:text-sm font-black">{t('auto_add_new_student')}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface/20 rounded-full transition-colors cursor-pointer">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Student Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {t('auto_student_name')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={t('auto_e_g_ahmed_ali')}
              value={name}
              onChange={(e) => {
                const val = e.target.value;
                setName(val);
                if (!hasManualGender && val.trim()) {
                  const predicted = isLikelyFemaleStudent(val) ? 'female' : 'male';
                  setGender(predicted);
                }
              }}
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {/* Gender Selector with AI suggestion */}
            <div className="pt-1 flex items-center justify-between gap-2 bg-surface p-2 rounded-xl border border-surface-border">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-text-muted">
                  {_t('جنس الطالب:', 'Gender:', 'Geschlecht:')}
                </span>
                {!hasManualGender && name.trim() && (
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>{_t('اقتراح ذكي من الاسم', 'AI Suggested', 'KI-Vorschlag')}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setGender('male');
                    setHasManualGender(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 border ${
                    gender === 'male'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
                      : 'bg-surface hover:bg-surface-hover text-text-muted border-surface-border'
                  }`}
                >
                  <span>👦</span>
                  <span>{_t('ولد (طالب)', 'Boy', 'Junge')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGender('female');
                    setHasManualGender(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 border ${
                    gender === 'female'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-2xs'
                      : 'bg-surface hover:bg-surface-hover text-text-muted border-surface-border'
                  }`}
                >
                  <span>👧</span>
                  <span>{_t('بنت (طالبة)', 'Girl', 'Mädchen')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* English/Latin Name for Certificates */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main flex items-center justify-between">
              <span>{_t('اسم الطالب بالإنجليزية للشهادات', 'Student English Name (for Certificates)', 'Englischer Name des Schülers')}</span>
              <span className="text-rose-500 text-[10px] font-black font-mono">* REQUIRED</span>
            </label>
            <input
              type="text"
              required
              placeholder={_t('مثال: Ahmed Ali', 'e.g. Ahmed Ali', 'z.B. Ahmed Ali')}
              value={certificateName}
              onChange={(e) => setCertificateName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary font-mono tracking-wide"
            />
          </div>

          {/* Group Selection */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {t('auto_assigned_group')}
            </label>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                const g = groups.find(item => item.id === e.target.value);
                if (g) setGrade(g.grade);
              }}
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.grade} • {(g.type || '').toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Info Inherited Notice */}
          {selectedGroup && (
            <div className="bg-primary-soft dark:bg-primary-soft/40 border border-primary-border/80 dark:border-primary-border/60 rounded-xl p-3 flex items-start gap-2 text-xs text-primary-hover dark:text-primary/70 transition-all">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{t('auto_inherited_pricing')}</p>
                <p className="text-[11px] text-primary dark:text-primary mt-0.5">
                  {t('auto_package')}
                  <span className="font-mono font-bold">{selectedGroup.monthlyPackagePrice} EGP</span> / {selectedGroup.sessionCount} {t('auto_sessions')}.
                  {_t(` يتم التوريث تلقائياً من ${selectedGroup.name}.`, ` Inherited automatically from ${selectedGroup.name}.`, ` Preis wird automatisch von ${selectedGroup.name} übernommen.`)}
                </p>
              </div>
            </div>
          )}

          {/* Predefined Grade / Course Level */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('المستوى / الصف الدراسي (Grade / Level)', 'Grade / Course Level', 'Klassenstufe / Sprachniveau')}
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as GradeLevel)}
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <optgroup label={_t('مستويات الكورسات واللغات (Courses)', 'Language Course Levels (CEFR)', 'Sprachniveaus')}>
                {COURSE_LEVELS.map(g => (
                  <option key={g} value={g}>
                    {g} - {_t(g === 'A1' ? 'A1 (مبتدئ أول)' : g === 'A2' ? 'A2 (مبتدئ متقدم)' : g === 'B1' ? 'B1 (متوسط أول)' : g === 'B2' ? 'B2 (متوسط متقدم)' : g === 'C1' ? 'C1 (متقدم)' : 'C2 (متقن)', g, g)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={_t('الصفوف المدرسية (School Grades)', 'School Grades', 'Schulklassen')}>
                {SCHOOL_GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Parent Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {t('auto_parent_name')}
            </label>
            <input
              type="text"
              placeholder={t('auto_e_g_ali_mahmoud')}
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Phone Numbers / WhatsApp Usernames */}
          <div className="space-y-3">
            {/* Parent Contact */}
            <div className="space-y-1.5 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-surface-border-soft">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-main flex items-center gap-1">
                  <span>{_t('هاتف أو يوزر نيم ولي الأمر *', 'Parent Phone or WhatsApp Username *', 'Eltern Telefon / WhatsApp-User *')}</span>
                </label>
                <div className="flex items-center bg-surface border border-surface-border rounded-lg p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setParentContactType('phone');
                      if (parentPhone.startsWith('@')) setParentPhone(parentPhone.replace(/^@/, ''));
                    }}
                    className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                      parentContactType === 'phone'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <Phone className="w-2.5 h-2.5" />
                    <span>{_t('هاتف', 'Phone', 'Tel')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParentContactType('username');
                      if (parentPhone && !parentPhone.startsWith('@')) setParentPhone(`@${parentPhone}`);
                    }}
                    className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                      parentContactType === 'username'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <AtSign className="w-2.5 h-2.5" />
                    <span>{_t('يوزر نيم', 'Username', 'User')}</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-text-muted">
                  {parentContactType === 'username' ? (
                    <AtSign className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Phone className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
                <input
                  type="text"
                  required
                  inputMode={parentContactType === 'phone' ? 'tel' : 'text'}
                  dir="ltr"
                  placeholder={parentContactType === 'username' ? '@username (e.g. @ahmed_ali)' : '+20 100 123 4567'}
                  value={parentPhone}
                  onChange={(e) => handleParentPhoneChange(e.target.value)}
                  className="w-full ps-9 pe-3 py-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Student Contact (Optional) */}
            <div className="space-y-1.5 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-surface-border-soft">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-muted flex items-center gap-1">
                  <span>{_t('هاتف أو يوزر نيم الطالب (اختياري)', 'Student Phone or WhatsApp Username (Optional)', 'Schüler Telefon / User (Optional)')}</span>
                </label>
                <div className="flex items-center bg-surface border border-surface-border rounded-lg p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentContactType('phone');
                      if (studentPhone.startsWith('@')) setStudentPhone(studentPhone.replace(/^@/, ''));
                    }}
                    className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                      studentContactType === 'phone'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <Phone className="w-2.5 h-2.5" />
                    <span>{_t('هاتف', 'Phone', 'Tel')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentContactType('username');
                      if (studentPhone && !studentPhone.startsWith('@')) setStudentPhone(`@${studentPhone}`);
                    }}
                    className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                      studentContactType === 'username'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <AtSign className="w-2.5 h-2.5" />
                    <span>{_t('يوزر نيم', 'Username', 'User')}</span>
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
                  placeholder={studentContactType === 'username' ? '@student_username' : '+20 101 123 4567'}
                  value={studentPhone}
                  onChange={(e) => handleStudentPhoneChange(e.target.value)}
                  className="w-full ps-9 pe-3 py-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {t('auto_student_notes')}
            </label>
            <textarea
              rows={2}
              placeholder={t('auto_special_focus_notes_or_weakn')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs focus:outline-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs py-3 rounded-lg shadow-md transition-all cursor-pointer active:scale-95 hover:shadow-lg hover:shadow-primary/30"
          >
            {t('auto_save_student')}
          </button>
        </form>
      </div>
    </div>
  );
};
