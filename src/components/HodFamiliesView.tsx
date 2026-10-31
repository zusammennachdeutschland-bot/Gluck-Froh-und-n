import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Copy,
  FileSpreadsheet,
  ArrowRight,
  Bus,
  CheckCircle2,
} from 'lucide-react';
import { HodGermanStudent } from '../types';
import { extractGradeFromClass, compareClassCodes } from '../utils/classNormalizer';

export interface SiblingGroup {
  id: string;
  familyNameAr: string;
  familyNameEn: string;
  students: HodGermanStudent[];
  grades: string[];
  classes: string[];
  busLines: string[];
  hasSameGradeSiblings: boolean;
}

/**
 * Normalizes Arabic text for accurate name comparison across different spellings
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    // Remove tashkeel / diacritics & tatweel
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    // Normalize Alef variants
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Teh Marbuta -> Heh
    .replace(/ة/g, 'ه')
    // Normalize Alef Maksura -> Yeh
    .replace(/ى/g, 'ي')
    // Normalize Hamza on Waw/Yeh
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // Normalize common compound spacings
    .replace(/عبد\s+/g, 'عبد')
    .replace(/ابو\s+/g, 'ابو')
    .replace(/\s+الدين\b/g, 'الدين')
    .replace(/\s+الله\b/g, 'الله')
    .replace(/\s+الاسلام\b/g, 'الاسلام')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a raw Arabic full name into display tokens while keeping compound names together
 * so the student's first name (even if compound like عبد الرحمن or منة الله) is isolated accurately
 * and the rest of the name up to the very last name is preserved completely.
 */
export function tokenizeArabicDisplay(fullName: string): string[] {
  if (!fullName) return [];
  const rawWords = fullName
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);

  const tokens: string[] = [];
  let i = 0;

  while (i < rawWords.length) {
    const curr = rawWords[i];
    const normCurr = normalizeArabicText(curr);
    const next = rawWords[i + 1];
    const normNext = next ? normalizeArabicText(next) : '';

    // Prefix compounds: عبد + X, أبو + X, أم + X, ابن + X, بن + X
    if (
      next &&
      (normCurr === 'عبد' ||
        normCurr === 'ابو' ||
        normCurr === 'ابي' ||
        normCurr === 'ام' ||
        normCurr === 'ابن' ||
        normCurr === 'بن' ||
        normCurr === 'بنت')
    ) {
      tokens.push(`${curr} ${next}`);
      i += 2;
      continue;
    }

    // Suffix compounds: X + الدين, X + الله, X + الإسلام
    if (
      next &&
      (normNext === 'الدين' ||
        normNext === 'الله' ||
        normNext === 'الاسلام' ||
        normNext === 'الرحمن' ||
        normNext === 'الرحيم')
    ) {
      tokens.push(`${curr} ${next}`);
      i += 2;
      continue;
    }

    tokens.push(curr);
    i += 1;
  }

  return tokens;
}

/**
 * Normalizes and tokenizes English names while keeping compound parts together
 */
export function tokenizeEnglishNormalized(fullName: string): string[] {
  if (!fullName) return [];
  const clean = fullName
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(abd\s+el|abdel|abdul|abd\s+al|abdal)\s+/g, 'abdel')
    .replace(/\b(abo\s+el|abou\s+el|abu\s+el|abo|abou|abu)\s+/g, 'abo')
    .replace(/\b(el|al)\s+/g, 'el')
    .replace(/\s+(eldin|el\s+din|aldin|al\s+din|eldeen)\b/g, 'eldin')
    .replace(/\s+(allah|alla)\b/g, 'allah')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];
  return clean.split(' ').filter(Boolean);
}

/**
 * Extracts the complete normalized parent lineage from the father's name all the way to the very last name.
 */
function extractStudentLineage(student: HodGermanStudent): {
  firstNameNormAr: string;
  firstNameNormEn: string;
  parentKeyAr: string | null;
  parentKeyEn: string | null;
  displayParentAr: string;
  displayParentEn: string;
} {
  const arDisplayTokens = tokenizeArabicDisplay(student.nameAr || '');
  const arNormTokens = arDisplayTokens.map(t => normalizeArabicText(t)).filter(Boolean);

  const enNormTokens = tokenizeEnglishNormalized(student.nameEn || '');
  const enRawTokens = (student.nameEn || '').trim().split(/\s+/).filter(Boolean);

  // Must match the ENTIRE parent lineage from the second name (father) all the way to the very last name
  let parentKeyAr: string | null = null;
  let displayParentAr = '';

  if (arNormTokens.length >= 3) {
    parentKeyAr = arNormTokens.slice(1).join(' ');
    displayParentAr = arDisplayTokens.slice(1).join(' ');
  }

  let parentKeyEn: string | null = null;
  let displayParentEn = '';

  if (enNormTokens.length >= 3) {
    parentKeyEn = enNormTokens.slice(1).join(' ');
    // For English display, skip the first token (or compound first name)
    displayParentEn = enRawTokens.slice(1).join(' ');
  }

  return {
    firstNameNormAr: arNormTokens[0] || '',
    firstNameNormEn: enNormTokens[0] || '',
    parentKeyAr,
    parentKeyEn,
    displayParentAr: displayParentAr || displayParentEn,
    displayParentEn: displayParentEn || displayParentAr,
  };
}

/**
 * Groups students into Sibling Families by matching the full parent name all the way to the last name.
 */
export function findSiblingGroups(students: HodGermanStudent[]): SiblingGroup[] {
  const germanStudents = students.filter(s => s.secondLanguage === 'German');
  const lineages = germanStudents.map(s => ({
    student: s,
    ...extractStudentLineage(s),
  }));

  // Group strictly by full parent lineage up to the last name
  const groupsMap = new Map<
    string,
    {
      familyNameAr: string;
      familyNameEn: string;
      items: typeof lineages;
    }
  >();

  for (const item of lineages) {
    const { parentKeyAr, parentKeyEn, displayParentAr, displayParentEn } = item;
    if (!parentKeyAr && !parentKeyEn) continue;

    // Use Arabic full parent lineage up to the last name when available; fallback to English full lineage
    const groupKey = parentKeyAr ? `ar:${parentKeyAr}` : `en:${parentKeyEn}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        familyNameAr: displayParentAr || displayParentEn,
        familyNameEn: displayParentEn || displayParentAr,
        items: [],
      });
    }

    const group = groupsMap.get(groupKey)!;
    group.items.push(item);
  }

  const results: SiblingGroup[] = [];

  groupsMap.forEach((group, key) => {
    if (group.items.length < 2) return;

    // Sort siblings by grade/class ascending
    const sortedStudents = [...group.items]
      .sort((a, b) => compareClassCodes(a.student.gradeClass || '', b.student.gradeClass || ''))
      .map(x => x.student);

    const gradesSet = new Set<string>();
    const classesSet = new Set<string>();
    const busSet = new Set<string>();
    const gradeCounts: Record<string, number> = {};

    sortedStudents.forEach(s => {
      const gr = extractGradeFromClass(s.gradeClass || '');
      if (gr) {
        gradesSet.add(gr);
        gradeCounts[gr] = (gradeCounts[gr] || 0) + 1;
      }
      if (s.gradeClass) classesSet.add(s.gradeClass.toUpperCase());
      if (s.busLine && s.busLine !== 'N/A' && s.busLine !== 'بدون باص' && s.busLine !== 'No Bus') {
        busSet.add(s.busLine);
      }
    });

    const hasSameGradeSiblings = Object.values(gradeCounts).some(c => c >= 2);

    results.push({
      id: key,
      familyNameAr: group.familyNameAr,
      familyNameEn: group.familyNameEn,
      students: sortedStudents,
      grades: Array.from(gradesSet),
      classes: Array.from(classesSet),
      busLines: Array.from(busSet),
      hasSameGradeSiblings,
    });
  });

  // Sort families by number of siblings (descending), then alphabetically by Arabic family name
  results.sort((a, b) => {
    if (b.students.length !== a.students.length) {
      return b.students.length - a.students.length;
    }
    return (a.familyNameAr || '').localeCompare(b.familyNameAr || '', 'ar');
  });

  return results;
}

interface HodFamiliesViewProps {
  students: HodGermanStudent[];
  initialSearch?: string;
  onBack: () => void;
  onSelectClass?: (classCode: string) => void;
  _t: (ar: string, en: string, de?: string) => string;
}

export const HodFamiliesView: React.FC<HodFamiliesViewProps> = ({
  students,
  initialSearch = '',
  onBack,
  onSelectClass,
  _t,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filterMode, setFilterMode] = useState<'all' | '3plus' | 'twins' | 'bus'>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compute all sibling families (strictly matching up to the last name)
  const allFamilies = useMemo(() => {
    return findSiblingGroups(students);
  }, [students]);

  // Available grades that have siblings
  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    allFamilies.forEach(f => f.grades.forEach(g => set.add(g)));
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [allFamilies]);

  // Filtered families based on search and filter pills
  const filteredFamilies = useMemo(() => {
    return allFamilies.filter(family => {
      if (filterMode === '3plus' && family.students.length < 3) return false;
      if (filterMode === 'twins' && !family.hasSameGradeSiblings) return false;
      if (filterMode === 'bus' && family.busLines.length === 0) return false;

      if (selectedGradeFilter !== 'all' && !family.grades.includes(selectedGradeFilter)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const qNormAr = normalizeArabicText(q);

        const matchFamilyAr = normalizeArabicText(family.familyNameAr).includes(qNormAr);
        const matchFamilyEn = (family.familyNameEn || '').toLowerCase().includes(q);

        const matchAnySibling = family.students.some(s => {
          const sAr = normalizeArabicText(s.nameAr || '');
          const sEn = (s.nameEn || '').toLowerCase();
          const sCls = (s.gradeClass || '').toLowerCase();
          const sBus = (s.busLine || '').toLowerCase();
          return (
            (qNormAr && sAr.includes(qNormAr)) ||
            sEn.includes(q) ||
            sCls.includes(q) ||
            sBus.includes(q)
          );
        });

        return matchFamilyAr || matchFamilyEn || matchAnySibling;
      }

      return true;
    });
  }, [allFamilies, filterMode, selectedGradeFilter, searchQuery]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalFamilies = allFamilies.length;
    const totalSiblings = allFamilies.reduce((acc, f) => acc + f.students.length, 0);
    const familiesWith3Plus = allFamilies.filter(f => f.students.length >= 3).length;
    const sameGradeCount = allFamilies.filter(f => f.hasSameGradeSiblings).length;
    return { totalFamilies, totalSiblings, familiesWith3Plus, sameGradeCount };
  }, [allFamilies]);

  // Copy single family card for WhatsApp
  const handleCopySingleFamily = (family: SiblingGroup) => {
    const header = `👨‍👩‍👧‍👦 *عائلة: ${family.familyNameAr}* (${family.students.length} إخوة)\n`;
    const rows = family.students
      .map(
        (s, i) =>
          `${i + 1}. ${s.gender === 'Boy' ? '👦' : '👧'} ${s.nameAr} (${s.nameEn}) — 🏫 [${s.gradeClass}]${
            s.busLine && s.busLine !== 'N/A' ? ` — 🚌 ${s.busLine}` : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(header + rows);
    showToast(_t('تم نسخ بيانات العائلة والإخوة!', 'Family details copied!', 'Familiendaten kopiert!'));
  };

  // Copy all filtered families for WhatsApp
  const handleCopyAllFamiliesWhatsApp = () => {
    if (filteredFamilies.length === 0) return;
    let text = `👨‍👩‍👧‍👦 *سجل العائلات والإخوة - قسم اللغة الألمانية*\n`;
    text += `إجمالي العائلات: ${filteredFamilies.length} عائلة (${filteredFamilies.reduce((a, f) => a + f.students.length, 0)} طالب/طالبة)\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    filteredFamilies.forEach((f, idx) => {
      text += `*${idx + 1}) عائلة: ${f.familyNameAr}* (${f.students.length} إخوة — الفصول: ${f.classes.join(', ')})\n`;
      f.students.forEach(s => {
        text += `   • ${s.gender === 'Boy' ? '👦' : '👧'} ${s.nameAr} | [${s.gradeClass}]${
          s.busLine && s.busLine !== 'N/A' ? ` | 🚌 ${s.busLine}` : ''
        }\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    showToast(_t('تم نسخ قائمة العائلات والإخوة للواتساب!', 'Copied families list for WhatsApp!', 'Familienliste für WhatsApp kopiert!'));
  };

  // Export CSV of families
  const handleExportFamiliesCsv = () => {
    if (filteredFamilies.length === 0) return;
    const headers = 'FamilyID,FamilyNameAr,FamilyNameEn,SiblingsCount,StudentNameAr,StudentNameEn,Class,Grade,Gender,BusLine\n';
    const rows: string[] = [];

    filteredFamilies.forEach((f, fIdx) => {
      f.students.forEach(s => {
        const grade = extractGradeFromClass(s.gradeClass || '');
        rows.push(
          `"FAM-${fIdx + 1}","${f.familyNameAr.replace(/"/g, '""')}","${f.familyNameEn.replace(/"/g, '""')}","${f.students.length}","${(s.nameAr || '').replace(/"/g, '""')}","${(s.nameEn || '').replace(/"/g, '""')}","${s.gradeClass}","G${grade}","${s.gender}","${s.busLine || 'N/A'}"`
        );
      });
    });

    const blob = new Blob(['\uFEFF' + headers + rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `German_Students_Families_Siblings_${filteredFamilies.length}.csv`;
    link.click();
    showToast(_t('تم تصدير ملف العائلات والإخوة (CSV)!', 'Exported Families CSV!', 'Familien-CSV exportiert!'));
  };

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-xl shadow-xl font-bold text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="px-2.5 py-1.5 bg-surface-hover hover:bg-surface-border text-text-main border border-surface-border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
              title="العودة لقائمة الطلاب"
            >
              <ArrowRight className="w-4 h-4 text-primary" />
              <span>عودة للطلاب</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="p-2 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl border border-violet-500/20 shrink-0 text-base leading-none">
                👨‍👩‍👧‍👦
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-text-main">
                    العائلات والأخوة (Familien & Geschwister)
                  </h2>
                  <span className="px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-md text-[10.5px] font-extrabold border border-violet-500/20">
                    {summaryStats.totalFamilies} عائلة • {summaryStats.totalSiblings} أخ وأخت
                  </span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  مطابقة كاملة لاسم الأب والجد والعائلة حتى الاسم الأخير عبر جميع المراحل (G1 - G12)
                </p>
              </div>
            </div>
          </div>

          {/* Export & Copy Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleCopyAllFamiliesWhatsApp}
              disabled={filteredFamilies.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>نسخ العائلات واتساب ({filteredFamilies.length})</span>
            </button>

            <button
              type="button"
              onClick={handleExportFamiliesCsv}
              disabled={filteredFamilies.length === 0}
              className="px-3 py-1.5 bg-surface-hover hover:bg-surface-border disabled:opacity-40 text-text-main border border-surface-border rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>تصدير CSV</span>
            </button>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-surface-border">
          <div className="bg-violet-500/5 border border-violet-500/20 p-2.5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-sm shrink-0">
              👨‍👩‍👧‍👦
            </div>
            <div>
              <div className="text-[10px] font-bold text-text-muted">إجمالي العائلات المكتشفة</div>
              <div className="text-sm font-black text-violet-600 dark:text-violet-400">
                {summaryStats.totalFamilies} <span className="text-[10px] font-bold">عائلة</span>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 p-2.5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              🧑‍🤝‍🧑
            </div>
            <div>
              <div className="text-[10px] font-bold text-text-muted">إجمالي الطلاب الإخوة</div>
              <div className="text-sm font-black text-primary">
                {summaryStats.totalSiblings} <span className="text-[10px] font-bold">طالب وطالبة</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
              🌟
            </div>
            <div>
              <div className="text-[10px] font-bold text-text-muted">عائلات (3 إخوة فأكثر)</div>
              <div className="text-sm font-black text-amber-600 dark:text-amber-400">
                {summaryStats.familiesWith3Plus} <span className="text-[10px] font-bold">عائلة</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
              👯
            </div>
            <div>
              <div className="text-[10px] font-bold text-text-muted">إخوة/توائم بنفس المرحلة</div>
              <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {summaryStats.sameGradeCount} <span className="text-[10px] font-bold">عائلة</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-violet-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم أي طالب أو اسم الأب أو العائلة أو الفصل (مثال: محمد، أحمد، 6A) لمعرفة إخوته..."
            className="w-full pl-8 pr-9 py-2 bg-surface-hover border border-violet-500/30 rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-violet-500/40 placeholder:text-text-muted/70"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Buttons & Grade Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-border/70">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                  : 'bg-surface-hover text-text-main border-surface-border hover:border-violet-500/40'
              }`}
            >
              الكل ({allFamilies.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('3plus')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                filterMode === '3plus'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-surface-hover text-text-main border-surface-border hover:border-amber-500/40'
              }`}
            >
              🌟 3 إخوة فأكثر ({summaryStats.familiesWith3Plus})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('twins')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                filterMode === 'twins'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-surface-hover text-text-main border-surface-border hover:border-emerald-500/40'
              }`}
            >
              👯 إخوة/توائم بنفس الصف ({summaryStats.sameGradeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('bus')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                filterMode === 'bus'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-surface-hover text-text-main border-surface-border hover:border-blue-500/40'
              }`}
            >
              🚌 إخوة مشتركين بالباص
            </button>
          </div>

          {/* Grade Filter Pills */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10.5px] font-bold text-text-muted ml-1">تصفية بالمرحلة:</span>
            <button
              type="button"
              onClick={() => setSelectedGradeFilter('all')}
              className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border transition-all cursor-pointer ${
                selectedGradeFilter === 'all'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-hover text-text-muted border-surface-border hover:text-text-main'
              }`}
            >
              كل المراحل
            </button>
            {availableGrades.map(g => (
              <button
                key={`fam-grade-${g}`}
                type="button"
                onClick={() => setSelectedGradeFilter(selectedGradeFilter === g ? 'all' : g)}
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border transition-all cursor-pointer ${
                  selectedGradeFilter === g
                    ? 'bg-primary text-white border-primary font-black'
                    : 'bg-surface-hover text-text-main border-surface-border hover:border-primary/40'
                }`}
              >
                G{g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results List */}
      {filteredFamilies.length === 0 ? (
        <div className="bg-surface border border-surface-border rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center mx-auto text-xl">
            👨‍👩‍👧‍👦
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-text-main">
              لا توجد عائلات مطابقة للبحث الحالي
            </h3>
            <p className="text-xs text-text-muted">
              يتم مطابقة اسم الأب والجد والعائلة بالكامل حتى الاسم الأخير.
            </p>
          </div>
          {(searchQuery || filterMode !== 'all' || selectedGradeFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterMode('all');
                setSelectedGradeFilter('all');
              }}
              className="px-3 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredFamilies.map((family, idx) => {
            const isLargeFamily = family.students.length >= 3;
            return (
              <div
                key={family.id}
                className={`bg-surface border rounded-xl p-3.5 shadow-2xs space-y-2.5 transition-all hover:shadow-md ${
                  isLargeFamily
                    ? 'border-amber-500/40 bg-amber-500/[0.02]'
                    : 'border-surface-border hover:border-violet-500/40'
                }`}
              >
                {/* Family Card Header */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-surface-border/70">
                  <div className="flex items-start gap-2 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
                        isLargeFamily
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10.5px] font-extrabold text-violet-600 dark:text-violet-400">
                          عائلة الأب:
                        </span>
                        <h3 className="text-xs sm:text-[13px] font-black text-text-main truncate">
                          {family.familyNameAr}
                        </h3>
                      </div>
                      {family.familyNameEn && family.familyNameEn !== family.familyNameAr && (
                        <div className="text-[10.5px] text-text-muted font-semibold truncate ltr text-right">
                          {family.familyNameEn}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {family.hasSameGradeSiblings && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 rounded-md text-[10px] font-black">
                        👯 نفس المرحلة
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-black border ${
                        isLargeFamily
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/25'
                      }`}
                    >
                      {family.students.length} إخوة
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySingleFamily(family)}
                      className="p-1.5 hover:bg-surface-hover text-text-muted hover:text-text-main rounded-lg border border-surface-border transition-colors cursor-pointer"
                      title="نسخ بيانات هذه العائلة"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Siblings Rows */}
                <div className="space-y-1.5">
                  {family.students.map(sibling => {
                    const arTokens = tokenizeArabicDisplay(sibling.nameAr || '');
                    const firstNameAr = arTokens[0] || sibling.nameAr;

                    return (
                      <div
                        key={sibling.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-hover/60 border border-surface-border/60 text-[11.5px]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">
                            {sibling.gender === 'Boy' ? '👦' : '👧'}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-text-main flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.2 bg-violet-500/15 text-violet-700 dark:text-violet-300 rounded font-black text-[11px]">
                                {firstNameAr}
                              </span>
                              <span className="truncate text-text-main/90">{sibling.nameAr}</span>
                            </div>
                            {sibling.nameEn && (
                              <div className="text-[10px] text-text-muted truncate">
                                {sibling.nameEn}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {sibling.busLine &&
                            sibling.busLine !== 'N/A' &&
                            sibling.busLine !== 'بدون باص' && (
                              <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 rounded text-[10px] font-bold flex items-center gap-1">
                                <Bus className="w-3 h-3" />
                                <span>{sibling.busLine}</span>
                              </span>
                            )}

                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectClass && sibling.gradeClass) {
                                onSelectClass(sibling.gradeClass);
                              }
                            }}
                            className="px-2 py-0.5 bg-primary/10 hover:bg-primary hover:text-white text-primary border border-primary/20 rounded-md text-[11px] font-black transition-all cursor-pointer"
                            title={`فتح فصل ${sibling.gradeClass}`}
                          >
                            🏫 {sibling.gradeClass}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
