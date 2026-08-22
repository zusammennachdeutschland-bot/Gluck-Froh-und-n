import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SchoolNote, SchoolNoteType } from '../types';
import { 
  X, Plus, Trash2, Pin, Tag, User, BookOpen, Users, 
  Clock, Check, Search, Calendar, MessageSquare, AlertCircle, Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SchoolLessonNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodNumber: number;
  startTime: string;
  endTime: string;
  className?: string;
  subjectName?: string;
  dateStr: string;
}

const QUICK_TAGS: { ar: string; en: string; de: string; color: string }[] = [
  { ar: '📝 واجب', en: '📝 Homework', de: '📝 Hausaufgabe', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { ar: '⭐ تميز', en: '⭐ Outstanding', de: '⭐ Hervorragend', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { ar: '⚠️ تنبيه', en: '⚠️ Warning', de: '⚠️ Warnung', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  { ar: '💡 فكرة', en: '💡 Idea', de: '💡 Idee', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { ar: '🎯 متابعة', en: '🎯 Follow-up', de: '🎯 Nachfassen', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { ar: '📖 مشاركة', en: '📖 Participation', de: '📖 Beteiligung', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
];

export const SchoolLessonNotesModal: React.FC<SchoolLessonNotesModalProps> = ({
  isOpen,
  onClose,
  periodNumber,
  startTime,
  endTime,
  className = '',
  subjectName = '',
  dateStr
}) => {
  const { 
    schoolNotes, 
    addSchoolNote, 
    updateSchoolNote, 
    deleteSchoolNote, 
    students, 
    groups, 
    hodStudents,
    _t, 
    language 
  } = useApp();

  const isRtl = language === 'ar';

  // Form State
  const [noteType, setNoteType] = useState<SchoolNoteType>('lesson');
  const [noteText, setNoteText] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'lesson' | 'class' | 'student'>('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Find matching students for this class from existing groups & HOD records
  const matchingStudents = useMemo(() => {
    const list: { id: string; name: string; source: string }[] = [];
    const seenNames = new Set<string>();

    const normalizedClass = className.trim().toLowerCase();

    // 1. Check Groups matching className
    const matchingGroups = groups.filter(g => 
      !g.deleted && 
      (g.name.toLowerCase().includes(normalizedClass) || normalizedClass.includes(g.name.toLowerCase()))
    );
    const matchingGroupIds = new Set(matchingGroups.map(g => g.id));

    students.filter(s => !s.deleted && (matchingGroupIds.has(s.groupId) || (s.grade && normalizedClass.includes(s.grade.toLowerCase())))).forEach(s => {
      if (!seenNames.has(s.name.toLowerCase())) {
        seenNames.add(s.name.toLowerCase());
        list.push({ id: s.id, name: s.name, source: 'Student' });
      }
    });

    // 2. Check HOD students
    hodStudents.filter(h => !h.deleted && (h.className?.toLowerCase() === normalizedClass || !normalizedClass)).forEach(h => {
      const name = h.nameAr || h.nameEn || h.name || 'Student';
      if (!seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        list.push({ id: h.id, name, source: 'HOD' });
      }
    });

    // 3. Fallback: If no matching found, show all students
    if (list.length === 0) {
      students.filter(s => !s.deleted).slice(0, 30).forEach(s => {
        list.push({ id: s.id, name: s.name, source: 'Student' });
      });
    }

    return list;
  }, [students, groups, hodStudents, className]);

  const filteredPickerStudents = useMemo(() => {
    if (!studentSearch.trim()) return matchingStudents;
    return matchingStudents.filter(s => s.name.toLowerCase().includes(studentSearch.trim().toLowerCase()));
  }, [matchingStudents, studentSearch]);

  // Retrieve existing notes relevant to this lesson/class
  const existingNotes = useMemo(() => {
    const normalizedClass = className.trim().toLowerCase();
    return schoolNotes.filter(n => {
      if (n.deleted) return false;
      // Match by lesson
      if (n.type === 'lesson') {
        const isPeriodMatch = n.periodNumber === periodNumber;
        const isDateMatch = n.date === dateStr;
        const isClassMatch = !n.className || n.className.trim().toLowerCase() === normalizedClass;
        return isPeriodMatch && isDateMatch && isClassMatch;
      }
      // Match by class
      if (n.type === 'class') {
        return n.className && n.className.trim().toLowerCase() === normalizedClass;
      }
      // Match by student
      if (n.type === 'student') {
        if (n.className && n.className.trim().toLowerCase() === normalizedClass) return true;
        if (matchingStudents.some(s => s.id === n.studentId)) return true;
      }
      return false;
    }).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [schoolNotes, periodNumber, dateStr, className, matchingStudents]);

  const displayedNotes = useMemo(() => {
    if (filterType === 'all') return existingNotes;
    return existingNotes.filter(n => n.type === filterType);
  }, [existingNotes, filterType]);

  const handleSaveNote = () => {
    if (!noteText.trim()) return;

    if (editingNoteId) {
      updateSchoolNote(editingNoteId, {
        type: noteType,
        text: noteText.trim(),
        tags: selectedTags,
        pinned: isPinned,
        className: className.trim(),
        periodNumber: noteType === 'lesson' ? periodNumber : undefined,
        date: noteType === 'lesson' ? dateStr : undefined,
        studentId: noteType === 'student' ? selectedStudentId : undefined,
        studentName: noteType === 'student' ? selectedStudentName : undefined,
      });
      setEditingNoteId(null);
    } else {
      addSchoolNote({
        type: noteType,
        text: noteText.trim(),
        tags: selectedTags,
        pinned: isPinned,
        className: className.trim(),
        periodNumber: noteType === 'lesson' ? periodNumber : undefined,
        date: noteType === 'lesson' ? dateStr : undefined,
        studentId: noteType === 'student' ? selectedStudentId : undefined,
        studentName: noteType === 'student' ? selectedStudentName : undefined,
      });
    }

    // Reset Form
    setNoteText('');
    setSelectedTags([]);
    setIsPinned(false);
    setSelectedStudentId('');
    setSelectedStudentName('');
  };

  const handleStartEdit = (note: SchoolNote) => {
    setEditingNoteId(note.id);
    setNoteType(note.type);
    setNoteText(note.text);
    setSelectedTags(note.tags || []);
    setIsPinned(!!note.pinned);
    setSelectedStudentId(note.studentId || '');
    setSelectedStudentName(note.studentName || '');
  };

  const toggleTag = (tagLabel: string) => {
    setSelectedTags(prev => 
      prev.includes(tagLabel) ? prev.filter(t => t !== tagLabel) : [...prev, tagLabel]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-surface border border-surface-border w-full max-w-xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-start"
        id="school-lesson-notes-modal"
      >
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-surface-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-primary text-white font-mono">
                  {_t(`حصة ${periodNumber}`, `Period ${periodNumber}`, `Std. ${periodNumber}`)}
                </span>
                {className && (
                  <span className="text-xs font-black text-text-main">
                    {className}
                  </span>
                )}
                {subjectName && (
                  <span className="text-[10px] font-bold text-primary bg-primary-soft border border-primary-border/40 px-1.5 py-0.2 rounded">
                    {subjectName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5 font-medium">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {startTime} - {endTime}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {dateStr}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors"
            title={_t('إغلاق', 'Close', 'Schließen')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4">
          {/* Note Input Box */}
          <div className="bg-surface-hover/40 border border-surface-border/80 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Type Switcher */}
              <div className="inline-flex p-0.5 rounded-lg bg-surface border border-surface-border text-xs">
                <button
                  type="button"
                  onClick={() => setNoteType('lesson')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                    noteType === 'lesson'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{_t('للحصة', 'For Lesson', 'Für Stunde')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNoteType('class')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                    noteType === 'class'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>{_t('للفصل', 'For Class', 'Für Klasse')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNoteType('student');
                    if (!selectedStudentName && matchingStudents.length > 0) {
                      setSelectedStudentId(matchingStudents[0].id);
                      setSelectedStudentName(matchingStudents[0].name);
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                    noteType === 'student'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>{_t('لطالب', 'For Student', 'Für Schüler')}</span>
                </button>
              </div>

              {/* Pin Action */}
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-all ${
                  isPinned 
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' 
                    : 'text-text-muted border-surface-border hover:bg-surface'
                }`}
              >
                <Pin className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
                <span>{_t('تثبيت', 'Pin', 'Anheften')}</span>
              </button>
            </div>

            {/* Student Picker if Student Note */}
            {noteType === 'student' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsStudentPickerOpen(!isStudentPickerOpen)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-surface border border-surface-border text-xs text-text-main font-medium hover:border-primary/50 transition-colors"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-primary shrink-0" />
                    {selectedStudentName || _t('اختر طالباً...', 'Select student...', 'Schüler auswählen...')}
                  </span>
                  <span className="text-[10px] text-text-muted font-bold">
                    {matchingStudents.length} {_t('طلاب', 'students', 'Schüler')}
                  </span>
                </button>

                {isStudentPickerOpen && (
                  <div className="absolute top-full start-0 end-0 mt-1 z-20 bg-surface border border-surface-border rounded-xl shadow-xl p-2 space-y-1.5 max-h-48 overflow-y-auto">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute start-2 top-2.5 text-text-muted" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder={_t('بحث عن طالب...', 'Search student...', 'Schüler suchen...')}
                        className="w-full ps-7 pe-2 py-1.5 text-xs bg-surface-hover rounded-lg border-none focus:ring-1 focus:ring-primary outline-hidden"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-0.5">
                      {filteredPickerStudents.map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudentId(st.id);
                            setSelectedStudentName(st.name);
                            setIsStudentPickerOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
                            selectedStudentId === st.id ? 'bg-primary text-white font-bold' : 'hover:bg-surface-hover text-text-main'
                          }`}
                        >
                          <span className="truncate">{st.name}</span>
                          <span className="text-[9px] opacity-70 font-mono">{st.source}</span>
                        </button>
                      ))}
                      {filteredPickerStudents.length === 0 && (
                        <div className="p-2 text-center text-xs text-text-muted">
                          {_t('لا توجد نتائج', 'No results found', 'Keine Ergebnisse')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Note Text Input */}
            <div className="relative">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveNote();
                  }
                }}
                rows={2}
                placeholder={_t(
                  'اكتب ملاحظتك هنا (مثال: متابعة واجب ص 42، طالب متميز في المشاركة...)...',
                  'Write your note here (e.g. follow-up homework p.42, active student in participation...)...',
                  'Notiz hier eingeben (z. B. Hausaufgabe S. 42 nachfassen, aktiver Schüler...)...'
                )}
                className="w-full p-2.5 rounded-lg bg-surface border border-surface-border text-xs text-text-main focus:ring-1 focus:ring-primary focus:border-primary outline-hidden resize-none placeholder:text-text-muted/70 leading-relaxed"
              />
            </div>

            {/* Quick Tag Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />
                {_t('تصنيف سريع:', 'Tags:', 'Tags:')}
              </span>
              {QUICK_TAGS.map((tag, idx) => {
                const label = _t(tag.ar, tag.en, tag.de);
                const isSelected = selectedTags.includes(label);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleTag(label)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                      isSelected 
                        ? `${tag.color} ring-1 ring-primary/40 font-black scale-105` 
                        : 'bg-surface border-surface-border text-text-muted hover:border-text-muted/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Submit Button Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-surface-border/50">
              <span className="text-[10px] text-text-muted">
                {_t('اضغط Ctrl+Enter للحفظ السريع', 'Press Ctrl+Enter to save quickly', 'Strg+Enter zum schnellen Speichern')}
              </span>
              <div className="flex items-center gap-2">
                {editingNoteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setNoteText('');
                      setSelectedTags([]);
                      setIsPinned(false);
                    }}
                    className="text-xs text-text-muted hover:text-text-main px-2 py-1 rounded-lg"
                  >
                    {_t('إلغاء التعديل', 'Cancel Edit', 'Abbrechen')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={!noteText.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{editingNoteId ? _t('تحديث الملاحظة', 'Update Note', 'Notiz aktualisieren') : _t('إضافة الملاحظة', 'Add Note', 'Notiz hinzufügen')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Existing Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-text-main">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>{_t('الملاحظات المسجلة', 'Logged Notes', 'Gespeicherte Notizen')}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                  {existingNotes.length}
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 text-[10px] font-bold">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    filterType === 'all' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {_t('الكل', 'All', 'Alle')} ({existingNotes.length})
                </button>
                <button
                  onClick={() => setFilterType('lesson')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    filterType === 'lesson' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {_t('الحصة', 'Lesson', 'Stunde')}
                </button>
                <button
                  onClick={() => setFilterType('class')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    filterType === 'class' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {_t('الفصل', 'Class', 'Klasse')}
                </button>
                <button
                  onClick={() => setFilterType('student')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    filterType === 'student' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {_t('الطلاب', 'Students', 'Schüler')}
                </button>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-2">
              <AnimatePresence>
                {displayedNotes.map((note) => {
                  const typeLabel = 
                    note.type === 'class' ? _t('فصل', 'Class', 'Klasse') :
                    note.type === 'student' ? _t('طالب', 'Student', 'Schüler') :
                    _t('حصة', 'Lesson', 'Stunde');

                  const typeColor = 
                    note.type === 'class' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                    note.type === 'student' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`p-2.5 rounded-xl border transition-all ${
                        note.pinned 
                          ? 'bg-amber-500/5 border-amber-500/30' 
                          : 'bg-surface border-surface-border hover:border-surface-border/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border uppercase font-mono ${typeColor}`}>
                            {typeLabel}
                          </span>
                          {note.studentName && (
                            <span className="text-[10px] font-black text-text-main bg-surface-hover px-1.5 py-0.2 rounded flex items-center gap-1">
                              <User className="w-2.5 h-2.5 text-primary" />
                              {note.studentName}
                            </span>
                          )}
                          {note.className && note.type !== 'student' && (
                            <span className="text-[10px] font-bold text-text-muted">
                              {note.className}
                            </span>
                          )}
                          {note.pinned && (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                              <Pin className="w-2.5 h-2.5 fill-current" />
                              {_t('مثبت', 'Pinned', 'Angeheftet')}
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => updateSchoolNote(note.id, { pinned: !note.pinned })}
                            className={`p-1 rounded hover:bg-surface-hover transition-colors ${
                              note.pinned ? 'text-amber-500' : 'text-text-muted'
                            }`}
                            title={_t('تبديل التثبيت', 'Toggle Pin', 'Pin umschalten')}
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleStartEdit(note)}
                            className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors"
                            title={_t('تعديل', 'Edit', 'Bearbeiten')}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteSchoolNote(note.id)}
                            className="p-1 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                            title={_t('حذف', 'Delete', 'Löschen')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Text */}
                      <p className="text-xs text-text-main font-medium mt-1.5 leading-relaxed whitespace-pre-wrap">
                        {note.text}
                      </p>

                      {/* Tags & Timestamp Footer */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-surface-border/40 text-[9px] text-text-muted">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(note.tags || []).map((t, idx) => (
                            <span key={idx} className="bg-surface-hover px-1.5 py-0.2 rounded font-medium">
                              {t}
                            </span>
                          ))}
                        </div>
                        <span className="font-mono">
                          {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {displayedNotes.length === 0 && (
                <div className="p-6 text-center rounded-xl border border-dashed border-surface-border/80 space-y-1">
                  <MessageSquare className="w-6 h-6 text-text-muted mx-auto opacity-50" />
                  <p className="text-xs text-text-muted font-medium">
                    {_t('لا توجد ملاحظات مسجلة لهذه الحصة بعد', 'No notes logged for this lesson yet', 'Noch keine Notizen für diese Stunde gespeichert')}
                  </p>
                  <p className="text-[10px] text-text-muted/70">
                    {_t('أضف ملاحظة سريعة في الصندوق بالأعلى', 'Add a quick note in the box above', 'Fügen Sie oben eine kurze Notiz hinzu')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-hover/20 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-text-main bg-surface hover:bg-surface-hover border border-surface-border rounded-lg transition-colors"
          >
            {_t('إغلاق', 'Close', 'Schließen')}
          </button>
        </div>
      </div>
    </div>
  );
};
