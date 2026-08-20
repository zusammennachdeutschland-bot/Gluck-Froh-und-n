import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { storage } from '../services/storageService';
import { PREDEFINED_GRADES } from '../data/initialData';
import { GradeLevel } from '../types';
import { X, UserPlus, Info } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AddStudentModalProps {
  onClose: () => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ onClose }) => {
  const { groups, students, addStudent, t, _t, language } = useApp();

  // Helper for inline translations
  
  const [name, setName] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [grade, setGrade] = useState<GradeLevel>('Grade 7');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
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
        if (draft.parentPhone) setParentPhone(draft.parentPhone);
        if (draft.studentPhone) setStudentPhone(draft.studentPhone);
        if (draft.notes) setNotes(draft.notes);
      }
    }
    loadDraft();
  }, []);

  // Save draft on state changes
  useEffect(() => {
    if (name || certificateName || parentName || parentPhone || studentPhone || notes) {
      storage.setItem('dl_draft_add_student', {
        name, certificateName, groupId, grade, parentName, parentPhone, studentPhone, notes
      });
    }
  }, [name, certificateName, groupId, grade, parentName, parentPhone, studentPhone, notes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !groupId) return;
    if (!certificateName.trim()) {
      alert(_t('اسم الطالب بالإنجليزية مطلوب للشهادات!', 'Student English name is required for certificates!', 'Der englische Name des Schülers ist für Zertifikate erforderlich!'));
      return;
    }
    if (!parentPhone.trim()) {
      alert(t('auto_parent_phone_number_is_require_1'));
      return;
    }
    const isDuplicate = students.some(s => s.name.toLowerCase() === name.toLowerCase() && s.groupId === groupId);
    if (isDuplicate) {
      if (!window.confirm(t('duplicate_student_warning') || 'طالب بنفس الاسم موجود بالفعل. هل تريد المتابعة؟ / A student with the same name already exists in this group. Do you want to continue?')) return;
    }

    addStudent({
      name,
      certificateName: certificateName.trim(),
      groupId,
      grade: selectedGroup?.grade || grade,
      parentName,
      parentPhone,
      studentPhone,
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
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-hover p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-surface/20 rounded-xl">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">{t('auto_add_new_student')}</h2>
              <p className="text-xs text-primary-soft">{t('auto_automatic_group_pricing_inheri')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface/20 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
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
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            />
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

          {/* Predefined Grade Level */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {t('auto_grade_level')}
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as GradeLevel)}
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PREDEFINED_GRADES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
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

          {/* Phone Numbers */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main">
                {t('auto_parent_phone_2')}
              </label>
              <input
                type="tel"
                required
                placeholder="+20 100 123 4567"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main">
                {t('auto_student_phone_optional')}
              </label>
              <input
                type="tel"
                placeholder="+20 101 123 4567"
                value={studentPhone}
                onChange={(e) => setStudentPhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-mono"
              />
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
