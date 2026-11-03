import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Student } from '../types';
import { 
  X, Search, Phone, Check, Sparkles, 
  Smartphone, UserCheck, AlertCircle, RefreshCw, CheckCircle2, Trash2, PhoneOff
} from 'lucide-react';
import { contactsSyncService } from '../services/contactsSyncService';
import { 
  buildStudentContactProposal, 
  normalizeEgyptianPhone,
  isStudentPhoneIdenticalToParent,
  getPhoneMatchKey
} from '../utils/contactsStandardizer';
import { normalizeSearchText } from '../utils/nameUtils';
import { storage } from '../services/storageService';

interface StudentPhoneSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type StudentPhoneCategory = 'in_contacts' | 'in_app_only' | 'no_phone' | 'same_as_parent';

const SYNCED_STUDENT_PHONE_KEYS_STORAGE = 'dl_synced_student_phone_keys';

export const StudentPhoneSyncModal: React.FC<StudentPhoneSyncModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { students, groups, updateStudent, _t } = useApp();

  // Active students only
  const activeStudents = useMemo(
    () => students.filter((s) => s.status !== 'archived' && !s.deleted),
    [students]
  );

  // Local state for modified phone inputs: { [studentId]: phoneNumber }
  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>({});
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [syncedStudentIds, setSyncedStudentIds] = useState<Record<string, boolean>>({});
  const [syncedPhoneKeys, setSyncedPhoneKeys] = useState<Record<string, boolean>>({});
  // Map of phoneMatchKey -> displayName found on the actual phone contacts
  const [deviceContactsByKey, setDeviceContactsByKey] = useState<Record<string, string>>({});
  const [isScanningContacts, setIsScanningContacts] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StudentPhoneCategory>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  }, []);

  // Scan device contacts & persisted synced student phone keys
  const scanDeviceContacts = useCallback(async () => {
    setIsScanningContacts(true);
    try {
      const storedKeys = (await storage.getItem<string[]>(SYNCED_STUDENT_PHONE_KEYS_STORAGE)) || [];
      const keySetObj: Record<string, boolean> = {};
      storedKeys.forEach((k) => {
        if (k) keySetObj[k] = true;
      });
      setSyncedPhoneKeys(keySetObj);

      const perms = await contactsSyncService.checkPermissions();
      if (!perms.read && contactsSyncService.isNativeAndroid()) {
        await contactsSyncService.requestPermissions();
      }

      const rawContacts = await contactsSyncService.fetchRawContacts(activeStudents);
      const map: Record<string, string> = {};
      rawContacts.forEach((contact) => {
        (contact.phoneNumbers || []).forEach((p) => {
          const key = getPhoneMatchKey(p.number);
          if (key && !map[key]) {
            map[key] = contact.displayName || p.number;
          }
        });
      });
      setDeviceContactsByKey(map);
    } catch (e) {
      console.warn('Could not scan device contacts for student phones:', e);
    } finally {
      setIsScanningContacts(false);
    }
  }, [activeStudents]);

  useEffect(() => {
    if (isOpen) {
      scanDeviceContacts();
    }
  }, [isOpen, scanDeviceContacts]);

  const persistSyncedPhoneKey = async (phoneKey: string, remove = false) => {
    if (!phoneKey) return;
    setSyncedPhoneKeys((prev) => {
      const next = { ...prev };
      if (remove) {
        delete next[phoneKey];
      } else {
        next[phoneKey] = true;
      }
      storage.setItem(SYNCED_STUDENT_PHONE_KEYS_STORAGE, Object.keys(next)).catch(() => {});
      return next;
    });
  };

  // Get current phone text for a student (input override or stored studentPhone)
  const getRawPhone = (student: Student): string => {
    if (phoneInputs[student.id] !== undefined) {
      return phoneInputs[student.id];
    }
    return student.studentPhone || '';
  };

  // Classify a student into one of the 4 exact states requested by the user:
  // 1) 'in_contacts': مسجل ع التليفون مع الكونتاكتس
  // 2) 'in_app_only': موجود ع البرنامج بس مش متسجل ع التليفون
  // 3) 'no_phone': ملوش رقم في البرنامج
  // 4) 'same_as_parent': رقمه هو هو رقم ولي الأمر
  const getStudentPhoneCategory = (student: Student): StudentPhoneCategory => {
    const raw = getRawPhone(student).trim();
    if (!raw || raw.length < 8) {
      return 'no_phone';
    }
    if (isStudentPhoneIdenticalToParent(raw, student.parentPhone)) {
      return 'same_as_parent';
    }
    const key = getPhoneMatchKey(raw);
    const parentKey = getPhoneMatchKey(student.parentPhone);
    // Make sure device contact match is for the student's own distinct number
    const existsInDeviceContacts = Boolean(key && key !== parentKey && deviceContactsByKey[key]);
    const wasSynced = Boolean((key && syncedPhoneKeys[key]) || syncedStudentIds[student.id]);
    if (existsInDeviceContacts || wasSynced) {
      return 'in_contacts';
    }
    return 'in_app_only';
  };

  if (!isOpen) return null;

  // Calculate counts for all 4 states
  const counts = activeStudents.reduce(
    (acc, s) => {
      const cat = getStudentPhoneCategory(s);
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    { in_contacts: 0, in_app_only: 0, no_phone: 0, same_as_parent: 0 } as Record<StudentPhoneCategory, number>
  );

  // Filtered students list
  const filteredStudents = activeStudents.filter((student) => {
    const category = getStudentPhoneCategory(student);

    if (statusFilter !== 'all' && category !== statusFilter) return false;

    if (selectedGrade !== 'all' && student.grade !== selectedGrade) return false;
    if (selectedGroupId !== 'all' && student.groupId !== selectedGroupId) return false;

    if (searchTerm.trim()) {
      const term = normalizeSearchText(searchTerm);
      const currentPhone = getRawPhone(student);
      const nameMatch = normalizeSearchText(student.name).includes(term);
      const certMatch = normalizeSearchText(student.certificateName).includes(term);
      const parentMatch = normalizeSearchText(student.parentName).includes(term);
      const phoneMatch = normalizeSearchText(currentPhone).includes(term);
      if (!nameMatch && !certMatch && !parentMatch && !phoneMatch) {
        return false;
      }
    }

    return true;
  });

  // Available grades & groups for filter
  const grades = Array.from(new Set(activeStudents.map((s) => s.grade).filter(Boolean)));

  const handlePhoneInputChange = (studentId: string, value: string) => {
    setPhoneInputs((prev) => ({
      ...prev,
      [studentId]: value,
    }));
  };

  // Delete student phone number from the app
  const handleDeleteStudentPhone = async (student: Student) => {
    const oldRaw = getRawPhone(student);
    const oldKey = getPhoneMatchKey(oldRaw);

    setDeletingStudentId(student.id);
    try {
      await updateStudent(student.id, {
        studentPhone: '',
        phone: '',
      });

      setPhoneInputs((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });

      setSyncedStudentIds((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });

      if (oldKey) {
        await persistSyncedPhoneKey(oldKey, true);
      }

      showToast(`🗑️ تم حذف رقم الطالب "${student.name}" من البرنامج بنجاح`);
    } catch (err) {
      console.error('Failed to delete student phone:', err);
      showToast('حدث خطأ أثناء حذف رقم الطالب');
    } finally {
      setDeletingStudentId(null);
    }
  };

  // Delete all student phones that are identical to parent phone
  const handleDeleteAllSameAsParentPhones = async () => {
    const duplicates = activeStudents.filter((s) => getStudentPhoneCategory(s) === 'same_as_parent');
    if (duplicates.length === 0) return;

    let deletedCount = 0;
    for (const student of duplicates) {
      await updateStudent(student.id, {
        studentPhone: '',
        phone: '',
      });
      setPhoneInputs((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });
      deletedCount++;
    }

    showToast(`🗑️ تم حذف أرقام ${deletedCount} طالب المطابقة لرقم ولي الأمر`);
  };

  // Save single student phone & sync to contacts
  const handleSaveAndSyncStudent = async (student: Student) => {
    const rawInput = getRawPhone(student).trim();

    if (!rawInput || rawInput.length < 8) {
      showToast('⚠️ يرجى إدخال رقم هاتف صحيح للطالب أولاً');
      return;
    }

    if (isStudentPhoneIdenticalToParent(rawInput, student.parentPhone)) {
      showToast('⚠️ هذا الرقم مطابق لرقم ولي الأمر! يرجى إدخال رقم الطالب الشخصي أو حذفه');
      return;
    }

    setSavingStudentId(student.id);

    try {
      const formattedPhone = normalizeEgyptianPhone(rawInput);
      const proposal = buildStudentContactProposal({
        ...student,
        studentPhone: rawInput,
      });
      const phoneKey = getPhoneMatchKey(rawInput);

      // 1. Update Student in Glück Database
      await updateStudent(student.id, {
        studentPhone: rawInput,
        phone: rawInput,
      });

      // 2. Sync / Add to Device Contacts
      const contactData = {
        displayName: proposal.standardizedName,
        phoneNumber: formattedPhone || rawInput,
        note: `طالب في ${student.grade || 'Glück'} - تطبيق Glück`,
      };

      const res = await contactsSyncService.createContact(contactData);
      if (!res.success) {
        showToast(`📱 تم حفظ الرقم في البرنامج، ولكن تعذر تسجيله بالهاتف: ${res.error || ''}`);
        return;
      }

      setSyncedStudentIds((prev) => ({ ...prev, [student.id]: true }));
      if (phoneKey) {
        await persistSyncedPhoneKey(phoneKey, false);
        setDeviceContactsByKey((prev) => ({
          ...prev,
          [phoneKey]: proposal.standardizedName,
        }));
      }

      showToast(`✅ تم حفظ الرقم وتسجيله في جهات اتصال التليفون باسم "${proposal.standardizedName}"`);
    } catch (err: any) {
      console.error('Failed to sync student contact:', err);
      showToast('حدث خطأ أثناء الحفظ والمزامنة');
    } finally {
      setSavingStudentId(null);
    }
  };

  // Batch Save & Sync All Eligible Students (in_app_only or newly typed valid phones)
  const handleBatchSaveAll = async () => {
    const studentsToSave = filteredStudents.filter((s) => {
      const raw = getRawPhone(s).trim();
      if (!raw || raw.length < 8) return false;
      if (isStudentPhoneIdenticalToParent(raw, s.parentPhone)) return false;
      const cat = getStudentPhoneCategory(s);
      const hasUnsavedInput = phoneInputs[s.id] !== undefined && phoneInputs[s.id].trim() !== (s.studentPhone || '').trim();
      return cat === 'in_app_only' || hasUnsavedInput;
    });

    if (studentsToSave.length === 0) {
      showToast('كل الأرقام الصالحة في القائمة الحالية مسجلة بالفعل على التليفون ✅');
      return;
    }

    let successCount = 0;
    for (const student of studentsToSave) {
      const rawInput = getRawPhone(student).trim();
      const formattedPhone = normalizeEgyptianPhone(rawInput);
      const proposal = buildStudentContactProposal({
        ...student,
        studentPhone: rawInput,
      });
      const phoneKey = getPhoneMatchKey(rawInput);

      await updateStudent(student.id, {
        studentPhone: rawInput,
        phone: rawInput,
      });

      const res = await contactsSyncService.createContact({
        displayName: proposal.standardizedName,
        phoneNumber: formattedPhone || rawInput,
        note: `طالب في ${student.grade || 'Glück'} - تطبيق Glück`,
      });

      if (res.success) {
        setSyncedStudentIds((prev) => ({ ...prev, [student.id]: true }));
        if (phoneKey) {
          await persistSyncedPhoneKey(phoneKey, false);
          setDeviceContactsByKey((prev) => ({
            ...prev,
            [phoneKey]: proposal.standardizedName,
          }));
        }
        successCount++;
      }
    }

    showToast(`✅ تم حفظ وتسجيل أرقام ${successCount} طالب في جهات اتصال التليفون بنجاح!`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-3 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-3 py-2 bg-surface border-b border-surface-border flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                أرقام الطلاب وجهات اتصال الهاتف (Schüler-Telefon & Kontakte)
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                تفرقة واضحة بين المسجل بالهاتف، والموجود بالبرنامج فقط، وبدون رقم، والمطابق لولي الأمر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={scanDeviceContacts}
              disabled={isScanningContacts}
              title="إعادة فحص جهات اتصال الهاتف"
              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isScanningContacts ? 'animate-spin text-indigo-600' : ''}`} />
              <span>فحص الهاتف</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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

        {/* Search & 4-State Filter Bar */}
        <div className="p-2 bg-surface border-b border-surface-border space-y-2 shrink-0">
          {/* 5 Filter Tabs: All + 4 Categories */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-between border ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-extrabold'
                  : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>📋 الكل</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {activeStudents.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('in_contacts')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-between border ${
                statusFilter === 'in_contacts'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-extrabold'
                  : 'bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100/70'
              }`}
            >
              <span className="truncate">✅ مسجل ع التليفون</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] shrink-0 ${statusFilter === 'in_contacts' ? 'bg-white/20 text-white' : 'bg-emerald-200/70 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200'}`}>
                {counts.in_contacts}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('in_app_only')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-between border ${
                statusFilter === 'in_app_only'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs font-extrabold'
                  : 'bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70 hover:bg-amber-100/70'
              }`}
            >
              <span className="truncate">📱 بالبرنامج بس مش متسجل</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] shrink-0 ${statusFilter === 'in_app_only' ? 'bg-white/20 text-white' : 'bg-amber-200/70 dark:bg-amber-900 text-amber-900 dark:text-amber-200'}`}>
                {counts.in_app_only}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('no_phone')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-between border ${
                statusFilter === 'no_phone'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-2xs font-extrabold'
                  : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <span className="truncate">⚪ ملوش رقم بالبرنامج</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] shrink-0 ${statusFilter === 'no_phone' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'}`}>
                {counts.no_phone}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('same_as_parent')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-between border col-span-2 sm:col-span-1 ${
                statusFilter === 'same_as_parent'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-2xs font-extrabold'
                  : 'bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/70 hover:bg-rose-100/70'
              }`}
            >
              <span className="truncate">⚠️ نفس رقم ولي الأمر</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] shrink-0 ${statusFilter === 'same_as_parent' ? 'bg-white/20 text-white' : 'bg-rose-200/70 dark:bg-rose-900 text-rose-900 dark:text-rose-200'}`}>
                {counts.same_as_parent}
              </span>
            </button>
          </div>

          {/* Search & Dropdown Filters Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم الطالب أو الرقم..."
                className="w-full pl-8 pr-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="flex-1 sm:w-36 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">{_t('جميع الصفوف', 'All Grades', 'Alle Klassen')}</option>
                {grades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="flex-1 sm:w-40 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">{_t('جميع المجموعات', 'All Groups', 'Alle Gruppen')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Action Banner when viewing 'same_as_parent' */}
          {statusFilter === 'same_as_parent' && counts.same_as_parent > 0 && (
            <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                ⚠️ هؤلاء الطلاب مسجل لهم نفس رقم ولي الأمر كرقم شخصي للطالب.
              </span>
              <button
                type="button"
                onClick={handleDeleteAllSameAsParentPhones}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>حذف كل الأرقام المكررة ({counts.same_as_parent})</span>
              </button>
            </div>
          )}
        </div>

        {/* Student Cards List */}
        <div className="p-2 sm:p-3 overflow-y-auto flex-1 space-y-2">
          {filteredStudents.length === 0 ? (
            <div className="p-6 text-center text-slate-500 space-y-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <UserCheck className="w-6 h-6 mx-auto text-indigo-500 opacity-60" />
              <p className="font-bold text-xs text-slate-700 dark:text-slate-300">
                لا يوجد طلاب في هذا التصنيف حالياً
              </p>
            </div>
          ) : (
            filteredStudents.map((student) => {
              const currentInput = getRawPhone(student);
              const category = getStudentPhoneCategory(student);
              const proposal = buildStudentContactProposal({
                ...student,
                studentPhone: currentInput || student.studentPhone,
              });
              const isSaving = savingStudentId === student.id;
              const isDeleting = deletingStudentId === student.id;
              const group = groups.find((g) => g.id === student.groupId);
              const phoneKey = getPhoneMatchKey(currentInput);
              const savedContactNameOnPhone = phoneKey ? deviceContactsByKey[phoneKey] : undefined;
              const hasAnyStudentPhone = Boolean(
                (student.studentPhone && student.studentPhone.trim().length > 0) ||
                (currentInput && currentInput.trim().length > 0)
              );

              // Card border & background by category
              const cardStyleByCategory: Record<StudentPhoneCategory, string> = {
                in_contacts: 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/10',
                in_app_only: 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10',
                no_phone: 'border-surface-border hover:border-indigo-300 dark:hover:border-indigo-800',
                same_as_parent: 'border-rose-300 dark:border-rose-800/80 bg-rose-50/25 dark:bg-rose-950/15',
              };

              return (
                <div
                  key={student.id}
                  className={`p-2 sm:p-2.5 bg-surface border rounded-xl shadow-2xs space-y-2 transition-all ${cardStyleByCategory[category]}`}
                >
                  {/* Top Line: Student Info + Clear Status Badge */}
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

                      {/* Status Badge for the 4 Cases */}
                      {category === 'in_contacts' && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>مسجل ع التليفون مع الكونتاكتس</span>
                        </span>
                      )}

                      {category === 'in_app_only' && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                          <Smartphone className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>موجود ع البرنامج بس مش متسجل ع التليفون</span>
                        </span>
                      )}

                      {category === 'no_phone' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                          <PhoneOff className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>ملوش رقم في البرنامج</span>
                        </span>
                      )}

                      {category === 'same_as_parent' && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>رقمه هو هو رقم ولي الأمر ⚠️</span>
                        </span>
                      )}
                    </div>

                    {/* Parent Phone Info (clearly labeled so it's not confused with student phone) */}
                    {student.parentPhone && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        <Phone className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                        <span className="font-bold">رقم ولي الأمر:</span>
                        <span className="font-mono">{student.parentPhone}</span>
                      </div>
                    )}
                  </div>

                  {/* Contact Display Name Preview Tag */}
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                    <div className="px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">الاسم المقترح للكونتاكتس: </span>
                      <strong className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        "{proposal.standardizedName}"
                      </strong>
                    </div>

                    {category === 'in_contacts' && savedContactNameOnPhone && (
                      <div className="px-1.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                        <span>الاسم الحالي ع التليفون: </span>
                        <strong className="font-mono">"{savedContactNameOnPhone}"</strong>
                      </div>
                    )}
                  </div>

                  {/* Phone Input & Action Cluster */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                    <div className="relative flex-1 min-w-[170px]">
                      <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                      <input
                        type="tel"
                        value={currentInput}
                        onChange={(e) => handlePhoneInputChange(student.id, e.target.value)}
                        placeholder="أدخل رقم الطالب الشخصي (01xxxxxxxxx)..."
                        className={`w-full pl-8 pr-2.5 py-1 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 ${
                          category === 'same_as_parent'
                            ? 'border-rose-400 text-rose-700 dark:text-rose-300 focus:ring-rose-500'
                            : category === 'in_contacts'
                            ? 'border-emerald-400 text-emerald-800 dark:text-emerald-200 focus:ring-emerald-500'
                            : category === 'in_app_only'
                            ? 'border-amber-400 text-slate-900 dark:text-slate-100 focus:ring-amber-500'
                            : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-indigo-500'
                        }`}
                      />
                    </div>

                    {/* Save & Sync to Phone Contacts Button */}
                    <button
                      type="button"
                      onClick={() => handleSaveAndSyncStudent(student)}
                      disabled={isSaving || category === 'same_as_parent'}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs shrink-0 whitespace-nowrap ${
                        category === 'same_as_parent'
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : category === 'in_contacts'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {isSaving ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : category === 'in_contacts' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>
                        {isSaving
                          ? 'جاري الحفظ...'
                          : category === 'in_contacts'
                          ? 'مسجل بالكونتاكتس (تحديث)'
                          : 'حفظ وتسجيل بالكونتاكتس'}
                      </span>
                    </button>

                    {/* Delete Student Phone Button */}
                    {hasAnyStudentPhone && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStudentPhone(student)}
                        disabled={isDeleting}
                        title="حذف رقم الطالب من البرنامج"
                        className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0 whitespace-nowrap"
                      >
                        {isDeleting ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        )}
                        <span>حذف رقم الطالب</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-2 sm:p-2.5 bg-surface border-t border-surface-border flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
            <span className="text-emerald-600 dark:text-emerald-400">✅ ع التليفون: {counts.in_contacts}</span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400">📱 بالبرنامج فقط: {counts.in_app_only}</span>
            <span>•</span>
            <span className="text-slate-500">⚪ بدون رقم: {counts.no_phone}</span>
            <span>•</span>
            <span className="text-rose-600 dark:text-rose-400">⚠️ نفس ولي الأمر: {counts.same_as_parent}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchSaveAll}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>تسجيل غير المسجلين بالكونتاكتس ({counts.in_app_only})</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

