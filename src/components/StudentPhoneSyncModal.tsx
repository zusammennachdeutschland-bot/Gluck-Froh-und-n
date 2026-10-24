import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Student } from '../types';
import { 
  X, Search, Phone, Check, Sparkles, Filter, Users, 
  Smartphone, UserCheck, AlertCircle, RefreshCw, CheckCircle2, Download
} from 'lucide-react';
import { contactsSyncService } from '../services/contactsSyncService';
import { 
  buildStudentContactProposal, 
  normalizeEgyptianPhone,
  isStudentPhoneIdenticalToParent
} from '../utils/contactsStandardizer';
import { normalizeSearchText } from '../utils/nameUtils';
import { getStudentCode } from '../utils/studentCodeUtils';

interface StudentPhoneSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudentPhoneSyncModal: React.FC<StudentPhoneSyncModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { students, groups, updateStudent, _t, language } = useApp();

  // Active students only
  const activeStudents = useMemo(
    () => students.filter((s) => s.status !== 'archived' && !s.deleted),
    [students]
  );

  // Local state for modified phone inputs: { [studentId]: phoneNumber }
  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>({});
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [syncedStudentIds, setSyncedStudentIds] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'missing' | 'has'>('missing');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  // Helper to check if a student has a valid distinct phone number (not identical to parent phone)
  const getRawPhone = (student: Student) => {
    if (phoneInputs[student.id] !== undefined) {
      return phoneInputs[student.id];
    }
    return student.studentPhone || '';
  };

  const isDuplicateParentPhone = (student: Student, rawPhone: string) => {
    return isStudentPhoneIdenticalToParent(rawPhone, student.parentPhone);
  };

  const hasValidStudentPhone = (student: Student) => {
    const raw = getRawPhone(student);
    if (!raw || raw.trim().length < 8) return false;
    if (isDuplicateParentPhone(student, raw)) return false;
    return true;
  };

  if (!isOpen) return null;

  // Filtered students list
  const filteredStudents = activeStudents.filter((student) => {
    const hasPhone = hasValidStudentPhone(student);

    if (statusFilter === 'missing' && hasPhone) return false;
    if (statusFilter === 'has' && !hasPhone) return false;

    if (selectedGrade !== 'all' && student.grade !== selectedGrade) return false;
    if (selectedGroupId !== 'all' && student.groupId !== selectedGroupId) return false;

    if (searchTerm.trim()) {
      const term = normalizeSearchText(searchTerm);
      const currentPhone = getRawPhone(student);
      const nameMatch = normalizeSearchText(student.name).includes(term);
      const certMatch = normalizeSearchText(student.certificateName).includes(term);
      const parentMatch = normalizeSearchText(student.parentName).includes(term);
      const codeMatch = normalizeSearchText(getStudentCode(student)).includes(term);
      const phoneMatch = normalizeSearchText(currentPhone).includes(term);
      if (!nameMatch && !certMatch && !parentMatch && !codeMatch && !phoneMatch) {
        return false;
      }
    }

    return true;
  });

  // Calculate stats
  const totalWithPhone = activeStudents.filter((s) => hasValidStudentPhone(s)).length;
  const totalMissingPhone = activeStudents.length - totalWithPhone;

  // Available grades & groups for filter
  const grades = Array.from(new Set(activeStudents.map((s) => s.grade).filter(Boolean)));

  const handlePhoneInputChange = (studentId: string, value: string) => {
    setPhoneInputs((prev) => ({
      ...prev,
      [studentId]: value,
    }));
  };

  // Save single student phone & sync to contacts
  const handleSaveAndSyncStudent = async (student: Student) => {
    const rawInput = phoneInputs[student.id] !== undefined
      ? phoneInputs[student.id]
      : (student.studentPhone || '');

    if (!rawInput.trim()) {
      alert(_t('يرجى إدخال رقم هاتف الطالب أولاً', 'Please enter student phone number first', 'Bitte Schüler-Telefonnummer eingeben'));
      return;
    }

    setSavingStudentId(student.id);

    try {
      const formattedPhone = normalizeEgyptianPhone(rawInput);
      const proposal = buildStudentContactProposal(student);

      // 1. Update Student in Glück Database
      await updateStudent(student.id, {
        studentPhone: rawInput.trim(),
        phone: rawInput.trim(),
      });

      // 2. Sync / Add to Device Contacts
      const contactData = {
        displayName: proposal.standardizedName,
        phoneNumber: formattedPhone || rawInput.trim(),
        note: `طالب في ${student.grade || 'Glück'} - تطبيق Glück`,
      };

      await contactsSyncService.createContact(contactData);

      setSyncedStudentIds((prev) => ({ ...prev, [student.id]: true }));
      setToastMessage(
        _t(
          `تم حفظ ومزامنة جهة الاتصال: "${proposal.standardizedName}" بنجاح!`,
          `Saved & synced contact: "${proposal.standardizedName}"`,
          `Kontakt "${proposal.standardizedName}" gespeichert!`
        )
      );

      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to sync student contact:', err);
      alert(_t('حدث خطأ أثناء الحفظ والمزامنة', 'Error during sync', 'Fehler beim Speichern'));
    } finally {
      setSavingStudentId(null);
    }
  };

  // Batch Save & Sync All Visible Students
  const handleBatchSaveAll = async () => {
    const studentsToSave = filteredStudents.filter((s) => {
      const inputVal = phoneInputs[s.id];
      return inputVal && inputVal.trim().length >= 8;
    });

    if (studentsToSave.length === 0) {
      alert(_t('لم يتم إدخال أرقام جديدة للطلاب في الحقول الحالية', 'No new phone numbers entered to save', 'Keine neuen Nummern eingegeben'));
      return;
    }

    if (!window.confirm(_t(`هل تريد حفظ ومزامنة أرقام ${studentsToSave.length} طالب دفعة واحدة إلى جهات الاتصال؟`, `Save & sync ${studentsToSave.length} student contacts?`, `${studentsToSave.length} Schüler-Kontakte speichern?`))) {
      return;
    }

    let successCount = 0;
    for (const student of studentsToSave) {
      const rawInput = phoneInputs[student.id];
      const formattedPhone = normalizeEgyptianPhone(rawInput);
      const proposal = buildStudentContactProposal(student);

      await updateStudent(student.id, {
        studentPhone: rawInput.trim(),
        phone: rawInput.trim(),
      });

      await contactsSyncService.createContact({
        displayName: proposal.standardizedName,
        phoneNumber: formattedPhone || rawInput.trim(),
        note: `طالب في ${student.grade || 'Glück'} - تطبيق Glück`,
      });

      setSyncedStudentIds((prev) => ({ ...prev, [student.id]: true }));
      successCount++;
    }

    setToastMessage(
      _t(
        `تم حفظ ومزامنة أرقام ${successCount} طالب دفعة واحدة في جهات الاتصال!`,
        `Successfully synced ${successCount} student contacts!`,
        `${successCount} Kontakte erfolgreich synchronisiert!`
      )
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-3 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header - Clean & Compact */}
        <div className="px-3 py-2 bg-surface border-b border-surface-border flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
              {_t('إضافة/تعديل هاتف الطالب وتوحيده في جهات الاتصال', 'Student Phone & Contacts Sync', 'Schüler-Telefon & Kontakte')}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between shadow-xs shrink-0 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button type="button" onClick={() => setToastMessage(null)} className="p-0.5 hover:bg-emerald-700 rounded">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Search & Compact Filter Bar */}
        <div className="p-2 bg-surface border-b border-surface-border space-y-1.5 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={_t('بحث باسم الطالب، الكود، أو الجريد...', 'Search student name, code, or grade...', 'Schüler suchen...')}
                className="w-full pl-8 pr-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter('missing')}
                className={`px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer ${
                  statusFilter === 'missing'
                    ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {_t('بدون رقم', 'Missing', 'Ohne')} ({totalMissingPhone})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('has')}
                className={`px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer ${
                  statusFilter === 'has'
                    ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {_t('مسجل', 'Has Phone', 'Mit')} ({totalWithPhone})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {_t('الكل', 'All', 'Alle')} ({activeStudents.length})
              </button>
            </div>
          </div>

          {/* Secondary Dropdown Filters in 1 Compact Row */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">{_t('جميع الصفوف المدرسية', 'All Grades', 'Alle Klassen')}</option>
              {grades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">{_t('جميع المجموعات', 'All Groups', 'Alle Gruppen')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Cards List - Main Focus Viewport */}
        <div className="p-2 sm:p-3 overflow-y-auto flex-1 space-y-2">
          {filteredStudents.length === 0 ? (
            <div className="p-6 text-center text-slate-500 space-y-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <UserCheck className="w-6 h-6 mx-auto text-indigo-500 opacity-60" />
              <p className="font-bold text-xs text-slate-700 dark:text-slate-300">
                {_t('لم يتم العثور على طلاب ينطبق عليهم البحث أو الفلتر', 'No matching students found', 'Keine Schüler gefunden')}
              </p>
            </div>
          ) : (
            filteredStudents.map((student) => {
              const currentInput = phoneInputs[student.id] !== undefined
                ? phoneInputs[student.id]
                : (student.studentPhone || '');

              const isDuplicateOfParent = isStudentPhoneIdenticalToParent(currentInput, student.parentPhone);
              const proposal = buildStudentContactProposal(student);
              const isSaving = savingStudentId === student.id;
              const isSynced = syncedStudentIds[student.id];
              const group = groups.find((g) => g.id === student.groupId);

              return (
                <div
                  key={student.id}
                  className={`p-2 sm:p-2.5 bg-surface border rounded-xl shadow-2xs space-y-2 transition-all ${
                    isDuplicateOfParent 
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10' 
                      : 'border-surface-border hover:border-indigo-300 dark:hover:border-indigo-800'
                  }`}
                >
                  {/* Top Line: Student Info + Contact Name Preview */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-surface-border/60 pb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                        {student.name}
                      </h3>
                      <span className="text-[9.5px] font-mono font-black px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {proposal.klasseLabel}
                      </span>
                      {group && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {group.name}
                        </span>
                      )}
                      {student.parentPhone && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 font-mono">
                          <Phone className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                          <span>{student.parentPhone}</span>
                        </span>
                      )}
                      {isDuplicateOfParent && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1 shrink-0">
                          <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>{_t('مطابق لرقم ولي الأمر (غير مسجل)', 'Identical to parent phone (Unregistered)', 'Identisch mit Eltern-Tel')}</span>
                        </span>
                      )}
                    </div>

                    {/* Contact Display Name Preview Tag */}
                    <div className="px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] shrink-0">
                      <span className="text-slate-400 font-medium">{_t('جهة الاتصال:', 'Contact:', 'Kontakt:')} </span>
                      <strong className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        "{proposal.standardizedName}"
                      </strong>
                    </div>
                  </div>

                  {/* Phone Input & Action Cluster */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                      <input
                        type="tel"
                        value={currentInput}
                        onChange={(e) => handlePhoneInputChange(student.id, e.target.value)}
                        placeholder="01xxxxxxxx"
                        className={`w-full pl-8 pr-2.5 py-1 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 ${
                          isDuplicateOfParent
                            ? 'border-rose-400 text-rose-700 dark:text-rose-300 focus:ring-rose-500'
                            : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-indigo-500'
                        }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveAndSyncStudent(student)}
                      disabled={isSaving}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs shrink-0 whitespace-nowrap ${
                        isSynced
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {isSaving ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : isSynced ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>
                        {isSaving
                          ? _t('جاري الحفظ...', 'Saving...', 'Speichern...')
                          : isSynced
                          ? _t('تم الحفظ', 'Synced', 'Gespeichert')
                          : _t('حفظ ومزامنة', 'Save & Sync', 'Speichern')}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer - Minimal & Compact */}
        <div className="p-2 sm:p-2.5 bg-surface border-t border-surface-border flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleBatchSaveAll}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{_t('حفظ ومزامنة الكل تلقائياً', 'Batch Save & Sync All', 'Alle speichern')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            {_t('إغلاق', 'Close', 'Schließen')}
          </button>
        </div>
      </div>
    </div>
  );
};
