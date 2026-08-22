import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, Plus, Trash2, Edit3, Sparkles, Upload, 
  X, Copy, RefreshCw, CheckCircle2, Bus, GraduationCap, 
  ShieldCheck, FileSpreadsheet, ArrowUpDown, ClipboardCheck, 
  FileCode, ExternalLink, Code2, AlertCircle, CheckSquare, 
  Square, Filter, Layers, AlertTriangle, Target
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HodGermanStudent, Complaint, StudentActionPlan } from '../types';
import { storage } from '../services/storageService';
import { ActionPlansView } from './ActionPlansView';

export const EXTERNAL_AI_PROMPT_TEXT = `Analyze this class roster image. Extract ONLY students studying German as a second language (EXCLUDE French students completely). Return a valid JSON array where each student object has: nameAr (Arabic name if available), nameEn (English name if available), gender ('Boy' or 'Girl'), gradeClass (class name from top header), and busLine (bus number/line or 'N/A').`;

export const HodStudentsView: React.FC = () => {
  const { profile, updateProfile, _t } = useApp();
  
  // Roster State
  const [students, setStudents] = useState<HodGermanStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Boy' | 'Girl'>('all');
  const [busFilter, setBusFilter] = useState<'all' | 'bus' | 'nobus'>('all');

  // Multi-selection checkboxes
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Sorting
  const [sortField, setSortField] = useState<'nameAr' | 'nameEn' | 'gradeClass' | 'busLine'>('gradeClass');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Single Student Delete Modal (Custom Modal to bypass browser window.confirm issues)
  const [studentToDelete, setStudentToDelete] = useState<HodGermanStudent | null>(null);

  // Student Complaints Modal State
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedStudentForComplaintsModal, setSelectedStudentForComplaintsModal] = useState<HodGermanStudent | null>(null);

  // Student Action Plans State
  const [actionPlans, setActionPlans] = useState<StudentActionPlan[]>([]);
  const [selectedStudentForActionPlanModal, setSelectedStudentForActionPlanModal] = useState<HodGermanStudent | null>(null);

  // Bulk Delete Modal
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [targetDeleteClass, setTargetDeleteClass] = useState<string>('');
  const [targetDeleteGrade, setTargetDeleteGrade] = useState<string>('');

  // Add/Edit Modal
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<HodGermanStudent | null>(null);
  const [studentForm, setStudentForm] = useState<{
    nameAr: string;
    nameEn: string;
    gradeClass: string;
    gender: 'Boy' | 'Girl';
    busLine: string;
  }>({
    nameAr: '',
    nameEn: '',
    gradeClass: '5A',
    gender: 'Boy',
    busLine: 'N/A',
  });

  // External AI Prompt Generator & Paste JSON Modal
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [pastedAiJsonText, setPastedAiJsonText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteSuccessCount, setPasteSuccessCount] = useState<number | null>(null);

  // Toast Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper migration for existing storage records without nameAr/nameEn
  const sanitizeStudentData = (rawList: any[]): HodGermanStudent[] => {
    return rawList.map((s, idx) => ({
      id: s.id || `gs-loaded-${Date.now()}-${idx}`,
      nameAr: s.nameAr || s.name || 'طالب جديد',
      nameEn: s.nameEn || (s.name ? 'Student ' + (idx + 1) : 'New Student'),
      gradeClass: (s.gradeClass || '5A').toString().toUpperCase(),
      gender: s.gender === 'Girl' ? 'Girl' : 'Boy',
      secondLanguage: 'German',
      busLine: s.busLine || 'N/A',
      createdAt: s.createdAt || new Date().toISOString(),
    }));
  };

  // Load persistence (clean start: empty list [] if no stored data)
  useEffect(() => {
    async function loadGermanStudents() {
      setIsLoading(true);
      try {
        const stored = await storage.getItem<HodGermanStudent[]>('hod_german_students');
        const storedComplaints = await storage.getItem<Complaint[]>('hod_complaints');
        if (storedComplaints && Array.isArray(storedComplaints)) {
          setComplaints(storedComplaints);
        }
        const storedPlans = await storage.getItem<StudentActionPlan[]>('hod_student_action_plans');
        if (storedPlans && Array.isArray(storedPlans)) {
          setActionPlans(storedPlans);
        }
        if (stored !== null && stored !== undefined && Array.isArray(stored)) {
          setStudents(sanitizeStudentData(stored));
        } else {
          const profileBackup = profile?.schoolSettings?.germanStudents;
          if (profileBackup !== undefined && profileBackup !== null && Array.isArray(profileBackup)) {
            const sanitized = sanitizeStudentData(profileBackup);
            setStudents(sanitized);
            await storage.setItem('hod_german_students', sanitized);
          } else {
            setStudents([]);
            await storage.setItem('hod_german_students', []);
          }
        }
      } catch (err) {
        console.error('Failed loading german students:', err);
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadGermanStudents();
  }, []);

  // Save persistence
  const persistStudents = async (updated: HodGermanStudent[]) => {
    setStudents(updated);
    try {
      await storage.setItem('hod_german_students', updated);
      if (profile && updateProfile) {
        const currentSettings = profile.schoolSettings || {};
        updateProfile({
          ...profile,
          schoolSettings: {
            ...currentSettings,
            germanStudents: updated,
          },
        });
      }
    } catch (err) {
      console.error('Error persisting german students:', err);
    }
  };

  // Unique Classes list for filters & bulk delete
  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.gradeClass) set.add(s.gradeClass.trim().toUpperCase());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  // Unique Grades/Levels list (e.g., Grade 5, Grade 6...)
  const uniqueGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.gradeClass) {
        const match = s.gradeClass.trim().match(/^(\d+|[A-Za-z]+)/);
        if (match) {
          set.add(match[1].toUpperCase());
        } else {
          set.add(s.gradeClass.trim().toUpperCase());
        }
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  // Set default target class/grade when bulk modal opens
  useEffect(() => {
    if (uniqueClasses.length > 0 && !targetDeleteClass) {
      setTargetDeleteClass(uniqueClasses[0]);
    }
    if (uniqueGrades.length > 0 && !targetDeleteGrade) {
      setTargetDeleteGrade(uniqueGrades[0]);
    }
  }, [uniqueClasses, uniqueGrades, targetDeleteClass, targetDeleteGrade]);

  // INSTANT SEARCH ENGINE (Filtering dynamically across: nameAr, nameEn, busLine, gradeClass)
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // German language rule strictly enforced
      if (s.secondLanguage !== 'German') return false;

      // Class Filter
      if (classFilter !== 'all' && s.gradeClass.toUpperCase() !== classFilter.toUpperCase()) {
        return false;
      }

      // Gender Filter
      if (genderFilter !== 'all' && s.gender !== genderFilter) {
        return false;
      }

      // Bus Filter
      if (busFilter === 'bus') {
        if (!s.busLine || s.busLine === 'N/A' || s.busLine === 'بدون باص' || s.busLine === 'No Bus') return false;
      } else if (busFilter === 'nobus') {
        if (s.busLine && s.busLine !== 'N/A' && s.busLine !== 'بدون باص' && s.busLine !== 'No Bus') return false;
      }

      // Instant Global Search Engine (filters across nameAr, nameEn, busLine, gradeClass)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNameAr = (s.nameAr || '').toLowerCase().includes(q);
        const matchNameEn = (s.nameEn || '').toLowerCase().includes(q);
        const matchClass = (s.gradeClass || '').toLowerCase().includes(q);
        const matchBus = (s.busLine || '').toLowerCase().includes(q);
        return matchNameAr || matchNameEn || matchClass || matchBus;
      }

      return true;
    }).sort((a, b) => {
      let comp = 0;
      if (sortField === 'nameAr') {
        comp = (a.nameAr || '').localeCompare(b.nameAr || '', 'ar');
      } else if (sortField === 'nameEn') {
        comp = (a.nameEn || '').localeCompare(b.nameEn || '', 'en');
      } else if (sortField === 'gradeClass') {
        comp = (a.gradeClass || '').localeCompare(b.gradeClass || '', undefined, { numeric: true });
      } else if (sortField === 'busLine') {
        comp = (a.busLine || '').localeCompare(b.busLine || '', 'ar');
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [students, classFilter, genderFilter, busFilter, searchQuery, sortField, sortOrder]);

  // Checkbox Selection Logic
  const isAllFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every(s => selectedStudentIds.includes(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredSet = new Set(filteredStudents.map(s => s.id));
      setSelectedStudentIds(prev => prev.filter(id => !filteredSet.has(id)));
    } else {
      const newIds = new Set([...selectedStudentIds, ...filteredStudents.map(s => s.id)]);
      setSelectedStudentIds(Array.from(newIds));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Quick Counters Bar Stats
  const stats = useMemo(() => {
    const totalGerman = students.length;
    const boysCount = students.filter(s => s.gender === 'Boy').length;
    const girlsCount = students.filter(s => s.gender === 'Girl').length;
    const busRidersCount = students.filter(s => s.busLine && s.busLine !== 'N/A' && s.busLine !== 'بدون باص' && s.busLine !== 'No Bus').length;
    const classesCount = uniqueClasses.length;
    return { totalGerman, boysCount, girlsCount, busRidersCount, classesCount };
  }, [students, uniqueClasses]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingStudent(null);
    setStudentForm({
      nameAr: '',
      nameEn: '',
      gradeClass: classFilter !== 'all' ? classFilter : (uniqueClasses[0] || '5A'),
      gender: 'Boy',
      busLine: 'N/A',
    });
    setIsAddEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (s: HodGermanStudent) => {
    setEditingStudent(s);
    setStudentForm({
      nameAr: s.nameAr || s.name || '',
      nameEn: s.nameEn || '',
      gradeClass: s.gradeClass,
      gender: s.gender,
      busLine: s.busLine || 'N/A',
    });
    setIsAddEditModalOpen(true);
  };

  // Save Student (Add/Edit)
  const handleSaveStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.nameAr.trim() && !studentForm.nameEn.trim()) return;

    const finalAr = studentForm.nameAr.trim() || studentForm.nameEn.trim();
    const finalEn = studentForm.nameEn.trim() || studentForm.nameAr.trim();

    if (editingStudent) {
      const updated = students.map(s => 
        s.id === editingStudent.id 
          ? { 
              ...s, 
              nameAr: finalAr,
              nameEn: finalEn,
              gradeClass: studentForm.gradeClass.trim().toUpperCase(),
              gender: studentForm.gender,
              busLine: studentForm.busLine.trim() || 'N/A',
              secondLanguage: 'German' as const
            }
          : s
      );
      persistStudents(updated);
      showToast(_t('تم تحديث بيانات الطالب', 'Student updated', 'Schüler aktualisiert'));
    } else {
      const newStudent: HodGermanStudent = {
        id: `gs-${Date.now()}`,
        nameAr: finalAr,
        nameEn: finalEn,
        gradeClass: studentForm.gradeClass.trim().toUpperCase(),
        gender: studentForm.gender,
        secondLanguage: 'German',
        busLine: studentForm.busLine.trim() || 'N/A',
        createdAt: new Date().toISOString(),
      };
      persistStudents([newStudent, ...students]);
      showToast(_t('تمت إضافة الطالب بنجاح', 'Student added', 'Schüler hinzugefügt'));
    }
    setIsAddEditModalOpen(false);
  };

  // ================= DELETION HANDLERS =================

  // Direct Single Student Delete (Triggers custom confirmation or immediate deletion)
  const handleDeleteStudentDirect = (id: string) => {
    const target = students.find(s => s.id === id);
    const updated = students.filter(s => s.id !== id);
    persistStudents(updated);
    setSelectedStudentIds(prev => prev.filter(i => i !== id));
    showToast(_t(`تم حذف الطالب (${target?.nameAr || 'المحدد'}) بنجاح`, `Deleted student (${target?.nameAr || 'selected'})`, 'Schüler gelöscht'));
    setStudentToDelete(null);
  };

  // Bulk Delete: Selected Checkboxes
  const handleDeleteSelectedStudents = () => {
    if (selectedStudentIds.length === 0) return;
    const count = selectedStudentIds.length;
    const updated = students.filter(s => !selectedStudentIds.includes(s.id));
    persistStudents(updated);
    setSelectedStudentIds([]);
    showToast(_t(`تم حذف ${count} طالب من القائمة`, `Deleted ${count} selected students`, `${count} Schüler gelöscht`));
    setIsBulkDeleteModalOpen(false);
  };

  // Bulk Delete: By Specific Class (e.g. "5A")
  const handleDeleteByClass = (targetClass: string) => {
    if (!targetClass) return;
    const countToDelete = students.filter(s => s.gradeClass.toUpperCase() === targetClass.toUpperCase()).length;
    if (countToDelete === 0) {
      showToast(_t(`لا يوجد طلاب في الفصل (${targetClass})`, `No students found in class ${targetClass}`, `Keine Schüler in Klasse ${targetClass}`));
      return;
    }
    const updated = students.filter(s => s.gradeClass.toUpperCase() !== targetClass.toUpperCase());
    persistStudents(updated);
    setSelectedStudentIds(prev => prev.filter(id => {
      const st = students.find(s => s.id === id);
      return st && st.gradeClass.toUpperCase() !== targetClass.toUpperCase();
    }));
    showToast(_t(`تم حذف ${countToDelete} طالب من فصل (${targetClass})`, `Deleted ${countToDelete} students from class ${targetClass}`, `${countToDelete} Schüler gelöscht`));
    setIsBulkDeleteModalOpen(false);
  };

  // Bulk Delete: By Grade/Level (e.g. Grade "5")
  const handleDeleteByGrade = (targetGrade: string) => {
    if (!targetGrade) return;
    const countToDelete = students.filter(s => {
      const match = s.gradeClass.trim().match(/^(\d+|[A-Za-z]+)/);
      const gradeStr = match ? match[1].toUpperCase() : s.gradeClass.trim().toUpperCase();
      return gradeStr === targetGrade.toUpperCase();
    }).length;

    if (countToDelete === 0) {
      showToast(_t(`لا يوجد طلاب في الصف (${targetGrade})`, `No students found in grade ${targetGrade}`, `Keine Schüler in Stufe ${targetGrade}`));
      return;
    }

    const updated = students.filter(s => {
      const match = s.gradeClass.trim().match(/^(\d+|[A-Za-z]+)/);
      const gradeStr = match ? match[1].toUpperCase() : s.gradeClass.trim().toUpperCase();
      return gradeStr !== targetGrade.toUpperCase();
    });

    persistStudents(updated);
    setSelectedStudentIds([]);
    showToast(_t(`تم حذف ${countToDelete} طالب من الصف (${targetGrade})`, `Deleted ${countToDelete} students from grade ${targetGrade}`, `${countToDelete} Schüler gelöscht`));
    setIsBulkDeleteModalOpen(false);
  };

  // Bulk Delete: Filtered Search Results
  const handleDeleteFilteredStudents = () => {
    if (filteredStudents.length === 0) return;
    const filteredIds = new Set(filteredStudents.map(s => s.id));
    const count = filteredStudents.length;
    const updated = students.filter(s => !filteredIds.has(s.id));
    persistStudents(updated);
    setSelectedStudentIds([]);
    showToast(_t(`تم حذف ${count} طالب من نتائج البحث الحالية`, `Deleted ${count} filtered students`, `${count} Schüler gelöscht`));
    setIsBulkDeleteModalOpen(false);
  };

  // Bulk Delete: ALL Students Completely
  const handleDeleteAllStudents = () => {
    const total = students.length;
    persistStudents([]);
    setSelectedStudentIds([]);
    showToast(_t(`تم مسح قائمة جميع الطلاب (${total} طالب) بالكامل`, `Cleared all ${total} students from roster`, `Alle ${total} Schüler gelöscht`));
    setIsBulkDeleteModalOpen(false);
  };

  // Copy Single Row
  const handleCopyStudentRow = (s: HodGermanStudent) => {
    const text = `👤 ${s.nameAr} (${s.nameEn}) | 🏫 ${s.gradeClass} | ${s.gender === 'Boy' ? '👦 Boy' : '👧 Girl'} | 🚌 ${s.busLine} | 🇩🇪 German`;
    navigator.clipboard.writeText(text);
    showToast(_t('تم نسخ بيانات الطالب', 'Student row copied', 'Schüler kopiert'));
  };

  // Copy Full Roster Text for WhatsApp
  const handleCopyFullRosterText = () => {
    if (filteredStudents.length === 0) return;
    let title = `📊 *قائمة طلاب اللغة الألمانية - German Student Roster*\n`;
    if (classFilter !== 'all') title += `🏫 الفصل / Class: ${classFilter}\n`;
    title += `إجمالي الطلاب: ${filteredStudents.length} (👦 ${stats.boysCount} Boys | 👧 ${stats.girlsCount} Girls)\n\n`;

    const rows = filteredStudents.map((s, idx) => 
      `${idx + 1}. ${s.gender === 'Boy' ? '👦' : '👧'} ${s.nameAr} | ${s.nameEn} - [${s.gradeClass}] - 🚌 ${s.busLine}`
    ).join('\n');

    const fullText = title + rows + `\n\n🇩🇪 قسم اللغة الألمانية - German Department`;
    navigator.clipboard.writeText(fullText);
    showToast(_t('تم نسخ القائمة ثنائية اللغة للواتساب', 'Bilingual Roster copied for WhatsApp', 'WhatsApp-Liste kopiert'));
  };

  // Export CSV
  const handleExportCsv = () => {
    if (filteredStudents.length === 0) return;
    const headers = 'ID,NameArabic,NameEnglish,Class,Gender,SecondLanguage,BusLine\n';
    const rows = filteredStudents.map(s => 
      `"${s.id}","${s.nameAr}","${s.nameEn}","${s.gradeClass}","${s.gender}","German","${s.busLine}"`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `German_Students_Bilingual_Roster_${classFilter !== 'all' ? classFilter : 'All'}.csv`;
    link.click();
    showToast(_t('تم تصدير القائمة بنجاح (CSV)', 'Bilingual roster exported to CSV', 'CSV exportiert'));
  };

  // Copy System Prompt Text for External AI
  const handleCopyPromptText = () => {
    navigator.clipboard.writeText(EXTERNAL_AI_PROMPT_TEXT);
    setPromptCopied(true);
    showToast(_t('تم نسخ برومبت الـ AI الخارجي للـ Clipboard!', 'External AI Prompt copied to clipboard!', 'KI-Prompt in Zwischenablage kopiert!'));
    setTimeout(() => setPromptCopied(false), 3000);
  };

  // Parse Pasted AI JSON Output
  const handleParseAndImportPastedJson = () => {
    if (!pastedAiJsonText.trim()) {
      setPasteError(_t('يرجى لصق مخرجات الـ AI أولاً', 'Please paste AI response text first', 'Bitte fügen Sie zuerst den KI-Text ein'));
      return;
    }

    setPasteError(null);
    setPasteSuccessCount(null);

    let cleanText = pastedAiJsonText.trim();
    const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch && jsonMatch[1]) {
      cleanText = jsonMatch[1].trim();
    } else {
      const firstBracket = cleanText.indexOf('[');
      const lastBracket = cleanText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
      }
    }

    try {
      const parsed = JSON.parse(cleanText);
      if (!Array.isArray(parsed)) {
        throw new Error(_t('المخرجات ملصقة ليست مصفوفة JSON صالحة [ ... ]', 'Pasted JSON must be an array of student objects [ ... ]', 'Muss ein JSON-Array sein'));
      }

      if (parsed.length === 0) {
        throw new Error(_t('مصفوفة الـ JSON فارغة ولا تحتوي على طلاب', 'JSON array is empty', 'JSON-Array ist leer'));
      }

      const newStudents: HodGermanStudent[] = parsed.map((item: any, idx: number) => {
        const ar = item.nameAr || item.name_ar || item.arabicName || item.name || 'طالب جديد';
        const en = item.nameEn || item.name_en || item.englishName || (item.name ? item.name : 'New Student');
        const gender = (item.gender === 'Girl' || item.gender === 'girl' || item.gender === 'أنثى' || item.gender === 'بنت') ? 'Girl' : 'Boy';
        const gradeClass = (item.gradeClass || item.class || item.grade || '5A').toString().toUpperCase();
        const busLine = item.busLine || item.bus || item.bus_line || 'N/A';

        return {
          id: `gs-ext-${Date.now()}-${idx}`,
          nameAr: ar,
          nameEn: en,
          gradeClass,
          gender,
          secondLanguage: 'German',
          busLine: busLine.toString(),
          createdAt: new Date().toISOString(),
        };
      });

      const updated = [...newStudents, ...students];
      persistStudents(updated);
      setPasteSuccessCount(newStudents.length);
      showToast(_t(`تم استيراد ${newStudents.length} طالب بنجاح من الـ AI الخارجي!`, `Successfully imported ${newStudents.length} students!`, `${newStudents.length} Schüler importiert!`));
      setPastedAiJsonText('');
    } catch (err: any) {
      console.error('Failed parsing pasted AI JSON:', err);
      setPasteError(err.message || _t('فشل تحليل كود הـ JSON الملصق. تأكد من صحة التنسيق.', 'Failed to parse JSON. Please verify format.', 'JSON-Analyse fehlgeschlagen.'));
    }
  };

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-2.5 py-1 rounded-xl shadow-xl font-bold text-[11px] animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner & High-Density Summary */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 shrink-0">
              <GraduationCap className="w-4 h-4" />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-text-main">
                {_t('قوائم وسجلات طلاب اللغة الألمانية', 'German Students Roster', 'Schülerverzeichnis')}
              </h2>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-extrabold border border-emerald-500/20">
                🇩🇪 Deutsch
              </span>
            </div>
          </div>

          {/* Top Quick Actions - Neatly Aligned in a Single Row on Mobile Phone Screens */}
          <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2">
            {/* Add Student Button (Primary Action) */}
            <button
              onClick={handleOpenAdd}
              className="px-2 sm:px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[10.5px] sm:text-xs font-bold shadow-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{_t('إضافة طالب', 'Add Student', 'Schüler hinzufügen')}</span>
            </button>

            {/* Prompt & Import Button (Secondary Action) */}
            <button
              onClick={() => {
                setIsPromptModalOpen(true);
                setPasteError(null);
                setPasteSuccessCount(null);
              }}
              className="px-2 sm:px-3 py-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border border-surface-border rounded-xl text-[10.5px] sm:text-xs font-bold shadow-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Code2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{_t('استيراد البيانات', 'Prompt & Import', 'Prompt & Datenimport')}</span>
            </button>

            {/* Delete / Clear Options Button (Utility Action) */}
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-2 sm:px-3 py-1.5 bg-surface-hover hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-surface-border hover:border-rose-500/30 rounded-xl text-[10.5px] sm:text-xs font-bold shadow-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              title={_t('خيارات الحذف والتصفية حسب الفصل/الصف', 'Delete options by class/grade', 'Löschoptionen nach Klasse/Stufe')}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{_t('خيارات الحذف', 'Delete Options', 'Löschoptionen')}</span>
            </button>
          </div>
        </div>

        {/* Quick Counters Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-surface-border">
          <div className="bg-surface-hover/80 border border-surface-border p-2 rounded-xl flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px] shrink-0">
              📊
            </div>
            <div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('إجمالي الطلاب', 'Total German', 'Gesamt Deutsch')}</div>
              <div className="text-[11px] font-black text-text-main">{stats.totalGerman}</div>
            </div>
          </div>

          <div className="bg-surface-hover/80 border border-surface-border p-2 rounded-xl flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0">
              👦
            </div>
            <div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('بنين', 'Boys', 'Jungen')}</div>
              <div className="text-[11px] font-black text-blue-600">{stats.boysCount}</div>
            </div>
          </div>

          <div className="bg-surface-hover/80 border border-surface-border p-2 rounded-xl flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold text-[11px] shrink-0">
              👧
            </div>
            <div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('بنات', 'Girls', 'Mädchen')}</div>
              <div className="text-[11px] font-black text-pink-600">{stats.girlsCount}</div>
            </div>
          </div>

          <div className="bg-surface-hover/80 border border-surface-border p-2 rounded-xl flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-[11px] shrink-0">
              🚌
            </div>
            <div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('ركاب الباص', 'Bus Riders', 'Busnutzer')}</div>
              <div className="text-[11px] font-black text-amber-600">{stats.busRidersCount}</div>
            </div>
          </div>

          <div className="bg-surface-hover/80 border border-surface-border p-2 rounded-xl flex items-center gap-2 col-span-2 sm:col-span-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-[11px] shrink-0">
              🏫
            </div>
            <div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('عدد الفصول', 'Classes', 'Klassen')}</div>
              <div className="text-[11px] font-black text-emerald-600">{stats.classesCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION TOOLBAR WHEN CHECKBOXES ARE SELECTED */}
      {selectedStudentIds.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 px-4 flex items-center justify-between gap-1.5 shadow-md animate-fade-in">
          <div className="flex items-center gap-2 text-[11px] font-black text-rose-700 dark:text-rose-300">
            <CheckSquare className="w-4 h-4 text-rose-600" />
            <span>
              {_t(`تم تحديد (${selectedStudentIds.length}) طالب من القائمة`, `Selected (${selectedStudentIds.length}) students`, `${selectedStudentIds.length} Schüler ausgewählt`)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedStudentIds([])}
              className="px-2.5 py-1 bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main rounded-lg text-[11px] font-bold border border-surface-border transition-all cursor-pointer"
            >
              {_t('إلغاء التحديد', 'Deselect All', 'Auswahl aufheben')}
            </button>

            <button
              onClick={handleDeleteSelectedStudents}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{_t(`حذف الطلاب المحددين (${selectedStudentIds.length})`, `Delete Selected (${selectedStudentIds.length})`, `Ausgewählte löschen (${selectedStudentIds.length})`)}</span>
            </button>
          </div>
        </div>
      )}

      {/* INSTANT SEARCH ENGINE & FILTERS BAR */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          {/* PROMINENT TOP INSTANT SEARCH BAR */}
          <div className="relative sm:col-span-5">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={_t('شريط البحث السريع: اسم عربي، اسم إنجليزي، رقم الباص، الفصل...', 'Instant Search: Arabic Name, English Name, Bus Line, Class...', 'Schnellsuche: Name (Ar/En), Bus, Klasse...')}
              className="w-full pl-3 pr-9 py-2 bg-surface-hover border border-primary/30 rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-text-muted/70 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Class Dropdown Filter */}
          <div className="sm:col-span-3">
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="w-full px-2.5 py-2 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">{_t('جميع الفصول (All Classes)', 'All Classes', 'Alle Klassen')}</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>
                  🏫 الفصل: {c}
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div className="sm:col-span-2">
            <select
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value as any)}
              className="w-full px-2.5 py-2 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">{_t('النوع: الكل', 'Gender: All', 'Geschlecht: Alle')}</option>
              <option value="Boy">👦 {_t('بنين (Boy)', 'Boy', 'Jungen')}</option>
              <option value="Girl">👧 {_t('بنات (Girl)', 'Girl', 'Mädchen')}</option>
            </select>
          </div>

          {/* Bus Filter */}
          <div className="sm:col-span-2">
            <select
              value={busFilter}
              onChange={e => setBusFilter(e.target.value as any)}
              className="w-full px-2.5 py-2 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">{_t('الباص: الكل', 'Bus: All', 'Bus: Alle')}</option>
              <option value="bus">🚌 {_t('ركاب الباص', 'Bus Riders', 'Mit Bus')}</option>
              <option value="nobus">🚶 {_t('بدون باص (N/A)', 'No Bus (N/A)', 'Ohne Bus')}</option>
            </select>
          </div>
        </div>

        {/* Export & Action Tools */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-surface-border/60 text-[11px]">
          <div className="text-[11px] font-bold text-text-muted flex items-center gap-1.5">
            <span>{_t('النتائج المطابقة للبحث السريع:', 'Search Results:', 'Ergebnisse:')}</span>
            <span className="text-primary font-black bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
              {filteredStudents.length} / {students.length}
            </span>
            {searchQuery && (
              <span className="text-[10px] text-primary italic font-medium">
                (تصفية فورية بـ: "{searchQuery}")
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyFullRosterText}
              className="px-2.5 py-1 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main rounded-lg text-[11px] font-bold border border-surface-border flex items-center gap-1 transition-all cursor-pointer"
              title={_t('نسخ القائمة ثنائية اللغة للواتساب', 'Copy for WhatsApp', 'Für WhatsApp kopieren')}
            >
              <Copy className="w-3 h-3 text-emerald-600" />
              <span>{_t('نسخة واتساب ثنائية اللغة', 'Bilingual WhatsApp', 'WhatsApp-Liste')}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-2.5 py-1 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main rounded-lg text-[11px] font-bold border border-surface-border flex items-center gap-1 transition-all cursor-pointer"
              title={_t('تصدير CSV ثنائي اللغة', 'Export CSV', 'CSV exportieren')}
            >
              <FileSpreadsheet className="w-3 h-3 text-blue-600" />
              <span>{_t('تصدير CSV', 'CSV', 'CSV')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* HIGH-DENSITY COMPACT TABLE LAYOUT (STRICTLY NO CARDS) */}
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-muted text-[11px] animate-pulse">
            {_t('جاري تحميل قائمة الطلاب ثنائية اللغة...', 'Loading roster...', 'Schülerliste wird geladen...')}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mx-auto text-text-muted">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-main">
                {searchQuery 
                  ? _t(`لم نجد نتائج تطابق شريط البحث: "${searchQuery}"`, `No students matched search: "${searchQuery}"`, `Keine Ergebnisse für "${searchQuery}"`)
                  : _t('قائمة الطلاب فارغة حالياً', 'No German students found', 'Keine Deutschschüler gefunden')}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {_t('يمكنك البدء بإضافة طالب جديد أو استيراد الطلاب.', 'You can add a student or import records.', 'Sie können Schüler hinzufügen oder importieren.')}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={handleOpenAdd}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{_t('إضافة طالب جديد', 'Add New Student', 'Neuen Schüler hinzufügen')}</span>
              </button>
              <button
                onClick={() => setIsPromptModalOpen(true)}
                className="px-3 py-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border border-surface-border text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{_t('استيراد بالـ AI Prompt', 'Import via AI Prompt', 'Per KI importieren')}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-[620px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-right border-collapse text-[11px]">
              {/* Sticky Header */}
              <thead className="sticky top-0 z-10 bg-surface-hover/95 backdrop-blur border-b border-surface-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  {/* Select All Checkbox */}
                  <th className="py-2 px-2 text-center w-8 border-r border-surface-border/50">
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-text-muted hover:text-primary transition-colors cursor-pointer"
                      title={_t('تحديد/إلغاء تحديد الكل', 'Toggle Select All', 'Alle auswählen')}
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>

                  <th className="py-2 px-2.5 text-center w-10 border-r border-surface-border/50">#</th>
                  
                  {/* Arabic Name Column */}
                  <th className="py-2 px-3 border-r border-surface-border/50 cursor-pointer hover:text-text-main" onClick={() => {
                    setSortField('nameAr');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}>
                    <div className="flex items-center gap-1">
                      <span>الاسم بالعربية (Arabic Name)</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>

                  {/* English Name Column */}
                  <th className="py-2 px-3 border-r border-surface-border/50 cursor-pointer hover:text-text-main" onClick={() => {
                    setSortField('nameEn');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}>
                    <div className="flex items-center gap-1">
                      <span>Full Name in English</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>

                  {/* Class Column */}
                  <th className="py-2 px-2.5 w-20 border-r border-surface-border/50 text-center cursor-pointer hover:text-text-main" onClick={() => {
                    setSortField('gradeClass');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}>
                    <div className="flex items-center justify-center gap-1">
                      <span>Class</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>

                  {/* Gender Column */}
                  <th className="py-2 px-2.5 w-24 border-r border-surface-border/50 text-center">
                    Gender
                  </th>

                  {/* Bus Line Column */}
                  <th className="py-2 px-3 w-32 border-r border-surface-border/50 cursor-pointer hover:text-text-main" onClick={() => {
                    setSortField('busLine');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}>
                    <div className="flex items-center gap-1">
                      <span>Bus Line</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>

                  {/* Actions Column */}
                  <th className="py-2 px-2.5 w-24 text-center">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* Ultra-Compact High-Density Rows (py-1.5) */}
              <tbody className="divide-y divide-surface-border/60">
                {filteredStudents.map((s, idx) => {
                  const isSelected = selectedStudentIds.includes(s.id);
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-surface-hover/70 transition-colors group text-[11.5px] font-medium ${
                        isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-1.5 px-2 text-center border-r border-surface-border/40">
                        <button
                          onClick={() => handleToggleSelectRow(s.id)}
                          className="text-text-muted hover:text-primary transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Index */}
                      <td className="py-1.5 px-2.5 text-center text-text-muted font-bold border-r border-surface-border/40 text-[10.5px]">
                        {idx + 1}
                      </td>

                      {/* Arabic Name (nameAr) */}
                      <td className="py-1.5 px-3 font-bold text-text-main border-r border-surface-border/40">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[11px] shrink-0">
                              {s.gender === 'Boy' ? '👦' : '👧'}
                            </span>
                            <span className="truncate max-w-[180px] sm:max-w-none">{s.nameAr || s.name}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {(() => {
                              const studentPlans = actionPlans.filter(p => 
                                p.studentId === s.id || 
                                (p.studentNameAr && p.studentNameAr.trim() === (s.nameAr || '').trim()) || 
                                (p.studentNameEn && p.studentNameEn.trim() === (s.nameEn || '').trim())
                              );
                              if (studentPlans.length === 0) return null;
                              const activeCount = studentPlans.filter(p => p.status === 'ACTIVE').length;
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStudentForActionPlanModal(s);
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black border flex items-center gap-1 cursor-pointer transition-all ${
                                    activeCount > 0
                                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                  }`}
                                  title={_t('عرض خطة الدعم الأكاديمي لهذا الطالب', 'View action plans', 'Förderplan anzeigen')}
                                >
                                  <Target className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                  <span>{activeCount > 0 ? `دعم (${activeCount})` : 'مكتمل'}</span>
                                </button>
                              );
                            })()}

                            {(() => {
                              const studentComplaints = complaints.filter(c => 
                                c.studentId === s.id || 
                                (c.studentNameAr && c.studentNameAr.trim() === (s.nameAr || '').trim()) || 
                                (c.studentNameEn && c.studentNameEn.trim() === (s.nameEn || '').trim())
                              );
                              if (studentComplaints.length === 0) return null;
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStudentForComplaintsModal(s);
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 rounded text-[10px] font-black border border-rose-500/20 flex items-center gap-1 cursor-pointer transition-all"
                                  title={_t('عرض الشكاوى المسجلة لهذا الطالب', 'View complaints', 'Beschwerden anzeigen')}
                                >
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>{studentComplaints.length}</span>
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </td>

                      {/* English Name (nameEn) */}
                      <td className="py-1.5 px-3 font-semibold text-text-main/90 border-r border-surface-border/40 ltr text-left">
                        <span className="truncate max-w-[180px] sm:max-w-none">{s.nameEn || s.nameAr}</span>
                      </td>

                      {/* Class Badge */}
                      <td className="py-1.5 px-2.5 text-center border-r border-surface-border/40 font-bold">
                        <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary rounded-md border border-primary/20 text-[10.5px]">
                          {s.gradeClass}
                        </span>
                      </td>

                      {/* Gender Badge */}
                      <td className="py-1.5 px-2.5 text-center border-r border-surface-border/40">
                        {s.gender === 'Boy' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold border border-blue-500/20">
                            👦 Boy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-md text-[10px] font-bold border border-pink-500/20">
                            👧 Girl
                          </span>
                        )}
                      </td>

                      {/* Bus Line */}
                      <td className="py-1.5 px-3 border-r border-surface-border/40 text-text-main font-medium">
                        <div className="flex items-center gap-1.5">
                          <Bus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className={s.busLine && s.busLine !== 'N/A' && s.busLine !== 'بدون باص' ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-text-muted font-normal'}>
                            {s.busLine || 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopyStudentRow(s)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-text-muted hover:text-text-main rounded transition-all cursor-pointer"
                            title={_t('نسخ الصف', 'Copy row', 'Zeile kopieren')}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1 hover:bg-primary/10 text-text-muted hover:text-primary rounded transition-all cursor-pointer"
                            title={_t('تعديل', 'Edit', 'Bearbeiten')}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* DELETE BUTTON (Triggers custom confirm modal to guarantee smooth execution without window.confirm blockage) */}
                          <button
                            onClick={() => setStudentToDelete(s)}
                            className="p-1 hover:bg-rose-500/10 text-rose-600 hover:text-rose-700 dark:text-rose-400 rounded transition-all cursor-pointer"
                            title={_t('حذف الطالب', 'Delete student', 'Schüler löschen')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL: BULK DELETE & CLEAR ROSTER OPTIONS ================= */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-2.5 animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-surface-border rounded-xl max-w-lg w-full p-2.5 sm:p-3 shadow-2xl space-y-2 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center border border-rose-500/20">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-text-main">
                    {_t('خيارات تصفية وحذف الطلاب', 'Delete & Clear Roster Options', 'Löschoptionen für Schüler')}
                  </h3>
                  <p className="text-[10.5px] text-text-muted">
                    {_t('اختر حذف طلاب فصل معين، صف دراسي كامل، الطلاب المحددين، أو إخلاء القائمة بالكامل.', 'Delete students by class, grade, selected list, or clear all.', 'Schüler nach Klasse, Stufe oder komplett löschen.')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-1 hover:bg-surface-hover text-text-muted hover:text-text-main rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 divide-y divide-surface-border">
              {/* Option 1: Delete Selected Checkboxes */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-primary" />
                    <span>{_t('1. حذف الطلاب المحددين مربعات الاختيار:', '1. Delete Selected Checkboxes:', '1. Ausgewählte löschen:')}</span>
                  </span>
                  <span className="text-[11px] font-black text-primary">
                    {selectedStudentIds.length} {_t('طالب محدد', 'selected', 'ausgewählt')}
                  </span>
                </div>
                <button
                  onClick={handleDeleteSelectedStudents}
                  disabled={selectedStudentIds.length === 0}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{_t(`حذف الطلاب المحددين (${selectedStudentIds.length})`, `Delete Selected (${selectedStudentIds.length})`, `Ausgewählte löschen (${selectedStudentIds.length})`)}</span>
                </button>
              </div>

              {/* Option 2: Delete By Specific Class (e.g., 5A) */}
              <div className="pt-3 space-y-2">
                <label className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  <span>{_t('2. حذف طلاب فصل دراسي محدد (Class):', '2. Delete by Class:', '2. Nach Klasse löschen:')}</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={targetDeleteClass}
                    onChange={e => setTargetDeleteClass(e.target.value)}
                    className="flex-1 px-2 py-1 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {uniqueClasses.length === 0 && <option value="">{_t('لا توجد فصول', 'No classes', 'Keine Klassen')}</option>}
                    {uniqueClasses.map(c => {
                      const count = students.filter(s => s.gradeClass.toUpperCase() === c.toUpperCase()).length;
                      return (
                        <option key={c} value={c}>
                          🏫 الفصل: {c} ({count} طالب)
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={() => handleDeleteByClass(targetDeleteClass)}
                    disabled={!targetDeleteClass || uniqueClasses.length === 0}
                    className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0"
                  >
                    {_t(`حذف فصل (${targetDeleteClass || '-'})`, `Delete Class`, `Klasse löschen`)}
                  </button>
                </div>
              </div>

              {/* Option 3: Delete By Grade Level (e.g., Grade 5) */}
              <div className="pt-3 space-y-2">
                <label className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>{_t('3. حذف طلاب صف دراسي كامل (Grade):', '3. Delete by Grade Level:', '3. Nach Stufe löschen:')}</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={targetDeleteGrade}
                    onChange={e => setTargetDeleteGrade(e.target.value)}
                    className="flex-1 px-2 py-1 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {uniqueGrades.length === 0 && <option value="">{_t('لا توجد صفوف', 'No grades', 'Keine Stufen')}</option>}
                    {uniqueGrades.map(g => {
                      const count = students.filter(s => {
                        const match = s.gradeClass.trim().match(/^(\d+|[A-Za-z]+)/);
                        const gradeStr = match ? match[1].toUpperCase() : s.gradeClass.trim().toUpperCase();
                        return gradeStr === g.toUpperCase();
                      }).length;
                      return (
                        <option key={g} value={g}>
                          📚 الصف الدراسـي: {g} ({count} طالب)
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={() => handleDeleteByGrade(targetDeleteGrade)}
                    disabled={!targetDeleteGrade || uniqueGrades.length === 0}
                    className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0"
                  >
                    {_t(`حذف الصف (${targetDeleteGrade || '-'})`, `Delete Grade`, `Stufe löschen`)}
                  </button>
                </div>
              </div>

              {/* Option 4: Delete Filtered Search Results */}
              {searchQuery && (
                <div className="pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                      <Filter className="w-4 h-4 text-purple-600" />
                      <span>{_t('4. حذف نتائج البحث الحالية:', '4. Delete Filtered Search Results:', '4. Suchergebnisse löschen:')}</span>
                    </span>
                    <span className="text-[11px] font-black text-purple-600">
                      {filteredStudents.length} {_t('طالب مطابق للبحث', 'matched', 'Treffer')}
                    </span>
                  </div>
                  <button
                    onClick={handleDeleteFilteredStudents}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{_t(`حذف نتائج البحث (${filteredStudents.length} طالب)`, `Delete Search Results (${filteredStudents.length})`, `Suchergebnisse löschen (${filteredStudents.length})`)}</span>
                  </button>
                </div>
              )}

              {/* Option 5: Clear All Students Completely */}
              <div className="pt-3 space-y-2">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-rose-800 dark:text-rose-300 space-y-1">
                    <p className="font-extrabold">{_t('تنبيه: مسح القائمة بالكامل (Clear All Roster)', 'Warning: Clear All Students', 'Warnung: Alle Schüler löschen')}</p>
                    <p className="leading-relaxed opacity-90">
                      {_t(`سيؤدي هذا الإجراء إلى حذف جميع الطلاب المسجلين (${students.length} طالب) نهائياً من النظام.`, `This will delete all ${students.length} registered students permanently.`, `Löscht alle ${students.length} Schüler dauerhaft.`)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDeleteAllStudents}
                  disabled={students.length === 0}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{_t(`حذف جميع الطلاب بالكامل (${students.length} طالب)`, `Clear All Roster (${students.length} Students)`, `Alle Schüler löschen (${students.length})`)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRM SINGLE STUDENT DELETE ================= */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-2.5 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-xl max-w-md w-full p-2.5 sm:p-3 shadow-2xl space-y-2 my-auto">
            <div className="flex items-center gap-1.5 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-[11px] font-black text-text-main">
                  {_t('تاكيد حذف الطالب', 'Confirm Delete Student', 'Schüler löschen bestätigen')}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {_t('هل أنت متأكد من حذف هذا الطالب من القائمة؟', 'Are you sure you want to delete this student?', 'Sind Sie sicher, dass Sie diesen Schüler löschen möchten?')}
                </p>
              </div>
            </div>

            <div className="p-3 bg-surface-hover/80 border border-surface-border rounded-xl text-[11px] space-y-1">
              <div className="font-extrabold text-text-main flex items-center gap-1.5">
                <span>{studentToDelete.gender === 'Boy' ? '👦' : '👧'}</span>
                <span>{studentToDelete.nameAr}</span>
              </div>
              <div className="text-text-muted ltr text-left font-semibold">
                {studentToDelete.nameEn}
              </div>
              <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-text-muted">
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                  🏫 {studentToDelete.gradeClass}
                </span>
                <span>🚌 {studentToDelete.busLine || 'N/A'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setStudentToDelete(null)}
                className="px-2.5 py-1 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main rounded-xl text-[11px] font-bold border border-surface-border transition-all cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                onClick={() => handleDeleteStudentDirect(studentToDelete.id)}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{_t('نعم، حذف الطالب', 'Yes, Delete', 'Ja, löschen')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: EXTERNAL AI PROMPT GENERATOR & PASTE DATA ================= */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-2.5 animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-surface-border rounded-xl max-w-2xl w-full p-2.5 sm:p-3 shadow-2xl space-y-2 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white flex items-center justify-center shadow-xs">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-text-main">
                    {_t('مُولّد البرومبت الخارجي (External AI Prompt Generator & Paste)', 'External AI Prompt Generator', 'KI-Prompt-Generator')}
                  </h3>
                  <p className="text-[10.5px] text-text-muted">
                    {_t('انسخ البرومبت أدناه ووضعه مع صورة القائمة في ChatGPT أو Gemini، ثم الصق النتيجة أدناه لاستيراد الطلاب فوراً.', 'Copy system prompt for external AI, then paste JSON output below to import students.', 'KI-Prompt kopieren und JSON-Ergebnis unten einfügen.')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPromptModalOpen(false)}
                className="p-1 hover:bg-surface-hover text-text-muted hover:text-text-main rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* STEP 1: Copy System Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-text-main flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">1</span>
                  <span>{_t('البرومبت المجهز للنسخ (Pre-formatted System Prompt):', 'System Prompt to Copy:', 'System-Prompt kopieren:')}</span>
                </label>
                <button
                  onClick={handleCopyPromptText}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    promptCopied 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-primary hover:bg-primary-hover text-white'
                  }`}
                >
                  {promptCopied ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{promptCopied ? _t('تم النسخ بنجاح! ✓', 'Copied! ✓', 'Kopiert! ✓') : _t('نسخ البرومبت (Copy Prompt)', 'Copy Prompt', 'Prompt kopieren')}</span>
                </button>
              </div>

              <div className="p-3 bg-surface-hover/90 border border-surface-border rounded-xl text-[11px] font-mono text-text-main leading-relaxed relative group ltr text-left select-all">
                {EXTERNAL_AI_PROMPT_TEXT}
              </div>

              {/* Quick Launch External Links */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-text-muted">{_t('افتح أداة AI خارجية:', 'Open External AI Tool:', 'Externe KI öffnen:')}</span>
                <a
                  href="https://chatgpt.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main rounded-lg text-[11px] font-bold border border-surface-border inline-flex items-center gap-1 transition-all"
                >
                  <span>ChatGPT</span>
                  <ExternalLink className="w-3 h-3 text-emerald-500" />
                </a>
                <a
                  href="https://gemini.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main rounded-lg text-[11px] font-bold border border-surface-border inline-flex items-center gap-1 transition-all"
                >
                  <span>Google Gemini</span>
                  <ExternalLink className="w-3 h-3 text-blue-500" />
                </a>
              </div>
            </div>

            {/* STEP 2: Paste Output & Import */}
            <div className="space-y-2 pt-2 border-t border-surface-border">
              <label className="text-[11px] font-extrabold text-text-main flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-[10px] font-black">2</span>
                  <span>{_t('الصق النتيجة المستخرجة من الـ AI هنا (Paste AI JSON Output):', 'Paste AI Output Here:', 'KI-Ergebnis hier einfügen:')}</span>
                </div>
              </label>

              <textarea
                value={pastedAiJsonText}
                onChange={e => {
                  setPastedAiJsonText(e.target.value);
                  setPasteError(null);
                  setPasteSuccessCount(null);
                }}
                rows={5}
                placeholder={_t('الصق كود الـ JSON الناتج من ChatGPT أو Gemini هنا...\n\nمثال:\n[\n  {"nameAr": "أحمد علي", "nameEn": "Ahmed Ali", "gender": "Boy", "gradeClass": "5A", "busLine": "Line 04"}\n]', 'Paste JSON output here...\n\nExample:\n[\n  {"nameAr": "Ahmed Ali", "nameEn": "Ahmed Ali", "gender": "Boy", "gradeClass": "5A", "busLine": "Line 04"}\n]', 'Fügen Sie hier das JSON-Ergebnis ein...')}
                className="w-full p-3 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-text-muted/60"
              />

              {pasteError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pasteError}</span>
                </div>
              )}

              {pasteSuccessCount !== null && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{_t(`تم استيراد ${pasteSuccessCount} طالب بنجاح وإضافتهم للجدول!`, `Successfully imported ${pasteSuccessCount} students!`, `${pasteSuccessCount} Schüler erfolgreich importiert!`)}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsPromptModalOpen(false)}
                  className="px-2 py-1 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main rounded-xl text-[11px] font-bold border border-surface-border transition-all cursor-pointer"
                >
                  {_t('إغلاق', 'Close', 'Schließen')}
                </button>
                <button
                  onClick={handleParseAndImportPastedJson}
                  disabled={!pastedAiJsonText.trim()}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{_t('استيراد البيانات الملصقة الآن', 'Import Pasted Data Now', 'Daten jetzt importieren')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: ADD / EDIT STUDENT ================= */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-2.5 animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-surface-border rounded-xl max-w-md w-full p-2.5 sm:p-3 shadow-2xl space-y-2 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-surface-border">
              <h3 className="text-[11px] font-black text-text-main flex items-center gap-2">
                <span>{editingStudent ? _t('تعديل بيانات الطالب', 'Edit Student Details', 'Schüler bearbeiten') : _t('إضافة طالب ألماني جديد', 'Add New German Student', 'Neuen Deutschschüler hinzufügen')}</span>
              </h3>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1 hover:bg-surface-hover text-text-muted hover:text-text-main rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentSubmit} className="space-y-3">
              {/* Arabic Name */}
              <div>
                <label className="block text-[11px] font-bold text-text-main mb-1">
                  {_t('الاسم بالكامل بالعربية (Arabic Full Name):', 'Arabic Full Name:', 'Vollständiger Name auf Arabisch:')}
                </label>
                <input
                  type="text"
                  required
                  value={studentForm.nameAr}
                  onChange={e => setStudentForm({ ...studentForm, nameAr: e.target.value })}
                  placeholder={_t('مثال: أحمد محمود العبد', 'e.g., Ahmed Mahmoud', 'z.B. Ahmed Mahmoud')}
                  className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* English Name */}
              <div>
                <label className="block text-[11px] font-bold text-text-main mb-1">
                  {_t('الاسم بالكامل بالإنجليزي (English Full Name):', 'English Full Name:', 'Vollständiger Name auf Englisch:')}
                </label>
                <input
                  type="text"
                  value={studentForm.nameEn}
                  onChange={e => setStudentForm({ ...studentForm, nameEn: e.target.value })}
                  placeholder={_t('e.g., Ahmed Mahmoud Elabd', 'e.g., Ahmed Mahmoud Elabd', 'z.B. Ahmed Mahmoud Elabd')}
                  className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary ltr text-left font-mono"
                />
              </div>

              {/* Class & Gender */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-text-main mb-1">
                    {_t('الفصل (Class):', 'Class:', 'Klasse:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={studentForm.gradeClass}
                    onChange={e => setStudentForm({ ...studentForm, gradeClass: e.target.value.toUpperCase() })}
                    placeholder="5A, 6B..."
                    className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-main mb-1">
                    {_t('النوع (Gender):', 'Gender:', 'Geschlecht:')}
                  </label>
                  <select
                    value={studentForm.gender}
                    onChange={e => setStudentForm({ ...studentForm, gender: e.target.value as any })}
                    className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="Boy">👦 {_t('بنين (Boy)', 'Boy', 'Junge')}</option>
                    <option value="Girl">👧 {_t('بنات (Girl)', 'Girl', 'Mädchen')}</option>
                  </select>
                </div>
              </div>

              {/* Bus Line & Second Language Rule */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-text-main mb-1">
                    {_t('رقم الخط / الباص (Bus Line):', 'Bus Line Number:', 'Buslinie:')}
                  </label>
                  <input
                    type="text"
                    value={studentForm.busLine}
                    onChange={e => setStudentForm({ ...studentForm, busLine: e.target.value })}
                    placeholder="Line 04, N/A..."
                    className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-main mb-1">
                    {_t('اللغة الثانية (Second Lang):', 'Second Language:', 'Zweite Sprache:')}
                  </label>
                  <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[11px] font-black flex items-center gap-1">
                    <span>🇩🇪 German (ألماني)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-2 py-1 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main rounded-xl text-[11px] font-bold border border-surface-border transition-all cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-white rounded-xl text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                >
                  {editingStudent ? _t('حفظ التعديلات', 'Save Changes', 'Änderungen speichern') : _t('إضافة الطالب الآن', 'Add Student Now', 'Schüler jetzt hinzufügen')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= MODAL: STUDENT COMPLAINTS HISTORY ================= */}
      {selectedStudentForComplaintsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-xl w-full max-w-lg p-3 shadow-2xl space-y-2 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-500/10 text-rose-600 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h3 className="text-[11px] font-black text-text-main">
                    {_t('سجل الشكاوى والملاحظات للطالب', 'Student Complaints History', 'Beschwerde-Verlauf')}
                  </h3>
                  <p className="text-[11px] text-text-muted font-bold">
                    {selectedStudentForComplaintsModal.nameAr} ({selectedStudentForComplaintsModal.nameEn}) - [{selectedStudentForComplaintsModal.gradeClass}]
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudentForComplaintsModal(null)}
                className="p-1 text-text-muted hover:text-text-main"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {(() => {
                const s = selectedStudentForComplaintsModal;
                const studentComplaints = complaints.filter(c => 
                  c.studentId === s.id || 
                  (c.studentNameAr && c.studentNameAr.trim() === (s.nameAr || '').trim()) || 
                  (c.studentNameEn && c.studentNameEn.trim() === (s.nameEn || '').trim())
                );

                if (studentComplaints.length === 0) {
                  return (
                    <div className="text-center p-3 text-text-muted text-[11px] font-bold">
                      {_t('لا توجد شكاوى مسجلة لهذا الطالب.', 'No complaints logged for this student.', 'Keine Beschwerden.')}
                    </div>
                  );
                }

                return studentComplaints.map(c => {
                  const isTeacherToStudent = c.direction === 'TEACHER_TO_STUDENT';
                  return (
                    <div key={c.id} className="p-3 bg-surface-hover border border-surface-border rounded-xl space-y-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          isTeacherToStudent ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
                        }`}>
                          {isTeacherToStudent ? '👨‍🏫 معلم ضد طالب' : '👦 طالب ضد معلم'}
                        </span>
                        <span className="text-[10px] text-text-muted font-bold">
                          {new Date(c.timestamp).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="font-extrabold text-text-main">
                          👨‍🏫 المعلم المعني: {c.teacherName}
                        </div>
                        <div className="font-bold text-text-main">
                          📌 السبب: <span className="text-rose-600 dark:text-rose-400">{c.reason}</span>
                        </div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          ⚡ الإجراء: {c.actionTaken}
                        </div>
                        {c.notes && (
                          <div className="text-[11px] text-text-muted italic bg-surface p-2 rounded-lg border border-surface-border/50">
                            📝 {c.notes}
                          </div>
                        )}
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[10px] text-text-muted border-t border-surface-border/50">
                        <span>{c.term} - {c.month}</span>
                        <span className={c.weeklyReportSent ? 'text-blue-600 font-bold' : 'text-amber-600 font-bold'}>
                          {c.weeklyReportSent ? '📑 مدرجة بتقرير أسبوعي' : '🆕 بانتظار التقرير الأسبوعي'}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-2 border-t border-surface-border text-right">
              <button
                onClick={() => setSelectedStudentForComplaintsModal(null)}
                className="px-2.5 py-1 bg-surface-hover text-text-main rounded-xl text-[11px] font-bold border border-surface-border cursor-pointer"
              >
                {_t('إغلاق', 'Close', 'Schließen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT ACTION PLAN EMBEDDED MODAL */}
      {selectedStudentForActionPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-surface-border rounded-xl w-full max-w-3xl p-3 shadow-2xl space-y-2 max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                  <Target className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h3 className="text-[11px] font-black text-text-main">
                    خطط الدعم الأكاديمي للطالب ({selectedStudentForActionPlanModal.nameAr || selectedStudentForActionPlanModal.name})
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    الفصل: {selectedStudentForActionPlanModal.gradeClass} - ({selectedStudentForActionPlanModal.nameEn})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentForActionPlanModal(null)}
                className="p-1 text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <ActionPlansView embeddedStudentId={selectedStudentForActionPlanModal.id} />
            </div>

            <div className="pt-2 border-t border-surface-border text-right">
              <button
                onClick={() => setSelectedStudentForActionPlanModal(null)}
                className="px-2.5 py-1 bg-surface-hover text-text-main rounded-xl text-[11px] font-bold border border-surface-border cursor-pointer"
              >
                {_t('إغلاق', 'Close', 'Schließen')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
