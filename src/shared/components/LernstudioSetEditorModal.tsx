import React, { useState } from 'react';
import {
  GrammarContent,
  GrammarExample,
  GrammarExercise,
  GrammarExerciseType,
  GrammarRule,
  LernstudioDifficulty,
  LernstudioItem,
  LernstudioLevel,
  LernstudioSet,
  LernstudioSetKind,
  LernstudioWordType,
  VerbConjugationForms
} from '../../types/lernstudio';
import { Group } from '../../types';
import { PROGRAM_GRADES } from '../../utils/lernstudioTranslations';
import { getVerbByInfinitive } from '../verbEngine';
import { auth } from '../firebaseCloudSync';
import {
  inferSetKind,
  normalizeGrammarContent,
  normalizeLernstudioSet,
  stripHeavyGrammarMediaForSync,
  VALID_GRAMMAR_EXERCISE_TYPES
} from '../grammarEngine';
import { GrammarPageImagesPanel } from './GrammarPageImagesPanel';
import { AlertCircle, AlertTriangle, BookOpen, Plus, Save, Sparkles, Trash2, Wand2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  setToEdit?: LernstudioSet | null;
  groups: Group[];
  teacherName?: string;
  language?: string;
  onClose: () => void;
  onSaveSet: (set: LernstudioSet) => void;
}

const EMPTY_CONJUGATION: VerbConjugationForms = {
  ich: '',
  du: '',
  er_sie_es: '',
  wir: '',
  ihr: '',
  sie_Sie: ''
};

export const LernstudioSetEditorModal: React.FC<Props> = ({
  isOpen,
  setToEdit,
  groups,
  teacherName,
  language = 'ar',
  onClose,
  onSaveSet
}) => {
  const defaultCreatorName =
    setToEdit?.createdByTeacherName?.trim() ||
    teacherName?.trim() ||
    auth?.currentUser?.displayName?.trim() ||
    '';

  const initialKind: LernstudioSetKind = setToEdit
    ? setToEdit.setKind || inferSetKind(setToEdit)
    : 'vocab';

  const [setKind, setSetKind] = useState<LernstudioSetKind>(initialKind);
  const [title, setTitle] = useState(setToEdit?.title || '');
  const [topic, setTopic] = useState(setToEdit?.topic || '');
  const [grade, setGrade] = useState(setToEdit?.grade || '');
  const [level, setLevel] = useState<LernstudioLevel>(setToEdit?.level || 'A1');
  const [difficulty, setDifficulty] = useState<LernstudioDifficulty>(setToEdit?.difficulty || 'medium');
  const [assignedGroupId, setAssignedGroupId] = useState(setToEdit?.assignedGroupId || '');
  const [creatorTeacherName, setCreatorTeacherName] = useState(defaultCreatorName);
  const [description, setDescription] = useState(setToEdit?.description || '');
  const [autoFillHint, setAutoFillHint] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const activeUid = auth?.currentUser?.uid?.trim() || null;
  const isNonOwned = Boolean(
    setToEdit &&
    setToEdit.createdByUid &&
    activeUid &&
    setToEdit.createdByUid !== activeUid &&
    !setToEdit.id.startsWith('curric_')
  );

  const [items, setItems] = useState<LernstudioItem[]>(
    setToEdit?.items ||
      (initialKind === 'grammar'
        ? []
        : [
            {
              id: `item_${Date.now()}_1`,
              german: 'die Katze',
              arabic: 'القطة',
              plural: 'die Katzen',
              emoji: '🐱',
              exampleSentenceGerman: 'Die Katze schläft auf dem Sofa.',
              exampleSentenceArabic: 'القطة تنام على الأريكة.',
              missingLetterWord: 'K_tze',
              wordType: 'noun'
            }
          ])
  );

  // Grammar Content State
  const [lessonTitle, setLessonTitle] = useState(setToEdit?.grammarContent?.lessonTitle || setToEdit?.title || '');
  const [grammarTopic, setGrammarTopic] = useState(setToEdit?.grammarContent?.grammarTopic || setToEdit?.topic || '');
  const [explanationAr, setExplanationAr] = useState(setToEdit?.grammarContent?.explanationAr || '');
  const [explanationDe, setExplanationDe] = useState(setToEdit?.grammarContent?.explanationDe || '');
  const [rules, setRules] = useState<GrammarRule[]>(setToEdit?.grammarContent?.rules || []);
  const [examples, setExamples] = useState<GrammarExample[]>(setToEdit?.grammarContent?.examples || []);
  const [grammarExercises, setGrammarExercises] = useState<GrammarExercise[]>(
    setToEdit?.grammarContent?.exercises || []
  );

  if (!isOpen) return null;

  const isRtl = language === 'ar';
  const showGrammarEditor = setKind === 'grammar' || setKind === 'mixed' || Boolean(setToEdit?.grammarContent);

  const handleAddItem = (wordType: LernstudioWordType = 'noun') => {
    const newItem: LernstudioItem = {
      id: `item_${Date.now()}_${items.length + 1}`,
      german: '',
      arabic: '',
      emoji: wordType === 'verb' ? '🔤' : '📚',
      missingLetterWord: '',
      wordType,
      ...(wordType === 'verb' ? { conjugation: { ...EMPTY_CONJUGATION } } : {})
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (index: number, updates: Partial<LernstudioItem>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item)));
  };

  const handleUpdateConjugation = (index: number, slot: keyof VerbConjugationForms, value: string) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          wordType: 'verb',
          conjugation: {
            ...(item.conjugation || EMPTY_CONJUGATION),
            [slot]: value
          }
        };
      })
    );
  };

  const handleAutoFillFromVerbLibrary = (index: number) => {
    const item = items[index];
    if (!item || !item.german.trim()) return;
    const match = getVerbByInfinitive(item.german.trim());
    if (!match) {
      setAutoFillHint(
        isRtl
          ? `لم يتم العثور على الفعل "${item.german}" في المكتبة المدمجة — يمكنك إدخال تصريفه يدوياً.`
          : `Verb "${item.german}" not found in built-in library — please enter forms manually.`
      );
      setTimeout(() => setAutoFillHint(null), 3500);
      return;
    }

    handleUpdateItem(index, {
      wordType: 'verb',
      verbId: match.id,
      german: match.infinitive,
      arabic: item.arabic.trim() || match.arabic,
      english: item.english || match.english,
      conjugation: { ...match.praesens },
      classifications: [...match.classifications],
      separablePrefix: match.separablePrefix,
      preposition: match.preposition,
      prepositionCase: match.prepositionCase,
      exampleSentenceGerman: item.exampleSentenceGerman || match.exampleGerman,
      exampleSentenceArabic: item.exampleSentenceArabic || match.exampleArabic,
      emoji: item.emoji && item.emoji !== '📚' ? item.emoji : '🔤'
    });
    setAutoFillHint(
      isRtl
        ? `تم ملء تصريف الفعل "${match.infinitive}" ومثاله من مكتبة الأفعال (${match.level}).`
        : `Auto-filled "${match.infinitive}" (${match.level}) from Verb Library.`
    );
    setTimeout(() => setAutoFillHint(null), 3000);
  };

  const handleRemoveItem = (index: number) => {
    if (setKind !== 'grammar' && setKind !== 'mixed' && items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Grammar helpers
  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `rule_${Date.now()}_${prev.length + 1}`,
        title: '',
        summaryAr: '',
        pattern: ''
      }
    ]);
  };

  const handleAddExample = () => {
    setExamples((prev) => [
      ...prev,
      {
        id: `gex_${Date.now()}_${prev.length + 1}`,
        german: '',
        arabic: ''
      }
    ]);
  };

  const handleAddGrammarExercise = () => {
    setGrammarExercises((prev) => [
      ...prev,
      {
        id: `gexq_${Date.now()}_${prev.length + 1}`,
        type: 'multiple_choice',
        question: '',
        options: ['', '', ''],
        correctAnswer: '',
        explanationAr: '',
        source: 'original'
      }
    ]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!title.trim()) {
      setValidationError(isRtl ? 'يرجى إدخال عنوان المجموعة.' : 'Please enter a set title.');
      return;
    }

    const validItems = items.filter((i) => i.german.trim() && i.arabic.trim());
    const validRules = rules.filter((r) => r.title.trim() || r.summaryAr.trim());
    const validExamples = examples.filter((ex) => ex.german.trim());
    const validGrammarExercises = grammarExercises.filter(
      (ex) => ex.question.trim() && ex.correctAnswer.trim()
    );

    const hasAnyGrammarContent =
      Boolean(explanationAr.trim() || explanationDe.trim()) ||
      validRules.length > 0 ||
      validExamples.length > 0 ||
      validGrammarExercises.length > 0;

    if (setKind === 'grammar') {
      if (!hasAnyGrammarContent) {
        setValidationError(
          isRtl
            ? 'يرجى إدخال شرح قاعدة أو مثال أو تمرين واحد على الأقل لمجموعة القواعد.'
            : 'Please add at least one grammar explanation, rule, example, or exercise.'
        );
        return;
      }
    } else if (validItems.length === 0 && !hasAnyGrammarContent) {
      setValidationError(
        isRtl
          ? 'يرجى إضافة كلمة ألمانية وترجمة عربية واحدة على الأقل (أو محتوى قواعد).'
          : language === 'de'
          ? 'Bitte fügen Sie mindestens ein deutsches Wort mit arabischer Übersetzung hinzu.'
          : 'Please add at least one German word with Arabic translation.'
      );
      return;
    }

    const resolvedTeacherName =
      creatorTeacherName.trim() ||
      setToEdit?.createdByTeacherName?.trim() ||
      teacherName?.trim() ||
      auth?.currentUser?.displayName?.trim() ||
      undefined;

    const allAreVerbs =
      validItems.length > 0 &&
      validItems.every((i) => i.wordType === 'verb' || Boolean(i.verbId) || Boolean(i.conjugation?.ich));
    const hasAnyVerbs = validItems.some(
      (i) => i.wordType === 'verb' || Boolean(i.verbId) || Boolean(i.conjugation?.ich)
    );
    const hasAnyNounsWithArticles = validItems.some(
      (i) => i.wordType !== 'verb' && (Boolean(i.article) || /^(der|die|das)\s+/i.test(i.german.trim()))
    );
    const derivedVerbIds = Array.from(
      new Set(validItems.map((i) => i.verbId).filter((id): id is string => Boolean(id)))
    );

    let nextGrammarContent: GrammarContent | undefined;
    if (showGrammarEditor && hasAnyGrammarContent) {
      nextGrammarContent = normalizeGrammarContent(
        {
          ...(setToEdit?.grammarContent || {}),
          lessonTitle: lessonTitle.trim() || title.trim(),
          grammarTopic: grammarTopic.trim() || topic.trim() || title.trim(),
          explanationAr: explanationAr.trim(),
          ...(explanationDe.trim() ? { explanationDe: explanationDe.trim() } : {}),
          rules: validRules,
          examples: validExamples,
          exercises: validGrammarExercises,
          origin: setToEdit?.grammarContent?.origin || (setToEdit?.id?.startsWith('curric_') ? 'builtin' : 'teacher_created')
        },
        title.trim(),
        topic.trim() || title.trim(),
        setToEdit?.id?.startsWith('curric_') ? 'builtin' : 'teacher_created'
      );
    }

    let finalKind: LernstudioSetKind = setKind;
    if (setKind === 'vocab' && allAreVerbs && validItems.length > 0) finalKind = 'verb_group';
    else if (setKind === 'vocab' && hasAnyVerbs) finalKind = 'mixed';
    else if (setKind === 'vocab' && nextGrammarContent) finalKind = validItems.length > 0 ? 'mixed' : 'grammar';

    const finalSetId = isNonOwned
      ? `set_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      : setToEdit?.id || `set_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const finalTitle = isNonOwned && !title.includes('(')
      ? `${title.trim()} (${isRtl ? 'نسختي' : 'Copy'})`
      : title.trim();
    const finalOwnerUid = isNonOwned
      ? activeUid || undefined
      : setToEdit?.createdByUid || activeUid || undefined;

    const updatedSet: LernstudioSet = stripHeavyGrammarMediaForSync(
      normalizeLernstudioSet({
        ...(setToEdit ? setToEdit : {}),
        id: finalSetId,
        title: finalTitle,
        topic: topic.trim() || grammarTopic.trim() || title.trim(),
        grade: grade.trim() || undefined,
        level,
        difficulty,
        assignedGroupId: assignedGroupId || undefined,
        ...(resolvedTeacherName ? { createdByTeacherName: resolvedTeacherName } : {}),
        ...(finalOwnerUid ? { createdByUid: finalOwnerUid } : {}),
        description: description.trim() || explanationAr.trim() || undefined,
        hasArticles: allAreVerbs ? false : hasAnyNounsWithArticles || setToEdit?.hasArticles,
        setKind: finalKind,
        contentOrigin: setToEdit?.contentOrigin || (setToEdit?.id?.startsWith('curric_') ? 'builtin' : 'teacher_created'),
        ...(derivedVerbIds.length > 0 ? { verbIds: derivedVerbIds } : {}),
        items: validItems,
        ...(nextGrammarContent ? { grammarContent: nextGrammarContent } : {}),
        createdAt: isNonOwned ? new Date().toISOString() : setToEdit?.createdAt || new Date().toISOString(),
        updatedAt: Date.now()
      })
    );

    onSaveSet(updatedSet);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
          <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>
              {setToEdit
                ? isRtl
                  ? 'تعديل المجموعة التعليمية'
                  : language === 'de'
                  ? 'Lernset bearbeiten'
                  : 'Edit Learning Set'
                : isRtl
                ? 'إنشاء مجموعة تعليمية جديدة (Set)'
                : language === 'de'
                ? 'Neues Lernset erstellen (Set)'
                : 'Create New Learning Set (Set)'}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {isNonOwned && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {isRtl
                  ? `هذه المجموعة مشتركة ومملوكة للمعلم (أ. ${setToEdit?.createdByTeacherName || 'زميل'}). سيتم حفظ تعديلاتك كنسخة جديدة باسمك دون تعديل الأصل.`
                  : `This set is owned by another teacher. Saving will create your own editable copy without modifying the original.`}
              </span>
            </div>
          )}

          {validationError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Set Kind Switcher */}
          <div className="p-3 bg-surface-hover/70 border border-surface-border rounded-2xl space-y-2">
            <label className="text-xs font-black text-text-main block">
              {isRtl ? 'تصنيف ونوع المجموعة (Set Kind):' : 'Set Type:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  ['vocab', isRtl ? 'مفردات (Vocab)' : 'Vocabulary'],
                  ['verb_group', isRtl ? 'مجموعة أفعال (Verbs)' : 'Verb Group'],
                  ['grammar', isRtl ? 'درس قواعد (Grammar)' : 'Grammar Lesson'],
                  ['mixed', isRtl ? 'مختلطة (كلمات + قواعد/أفعال)' : 'Mixed']
                ] as const
              ).map(([kindId, label]) => (
                <button
                  key={kindId}
                  type="button"
                  onClick={() => setSetKind(kindId)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    setKind === kindId
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-surface text-text-main border-surface-border hover:border-primary/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Metadata Section */}
          <div className="p-4 bg-surface-hover/50 border border-surface-border rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-text-muted block mb-1">
                {isRtl ? 'عنوان المجموعة (Title): *' : language === 'de' ? 'Titel des Sets: *' : 'Set Title: *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={setKind === 'grammar' ? 'مثال: Akkusativ – المفعول به' : 'مثال: Tiere und Haustiere'}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                {isRtl
                  ? 'اسم المدرس مُنشئ المجموعة: *'
                  : language === 'de'
                  ? 'Name des Lehrers: *'
                  : 'Creator Teacher Name: *'}
              </label>
              <input
                type="text"
                required
                value={creatorTeacherName}
                onChange={(e) => setCreatorTeacherName(e.target.value)}
                placeholder={isRtl ? 'مثال: أ. محمد / Herr Ahmed' : 'Lehrername'}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                {isRtl ? 'المستوى الأوروبي (CEFR):' : 'CEFR Level:'}
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as LernstudioLevel)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                {isRtl ? 'الموضوع (Topic):' : 'Topic:'}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={setKind === 'grammar' ? 'Akkusativ / Präsens' : 'مثال: المفردات...'}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                {isRtl ? 'الصف / المنهج (Grade):' : 'Grade:'}
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">{isRtl ? '-- اختر الصف --' : '-- Select Grade --'}</option>
                {PROGRAM_GRADES.map((g) => (
                  <option key={g.id} value={g.labelAr}>
                    {language === 'ar' ? g.labelAr : language === 'de' ? g.labelDe : g.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-text-muted block mb-1">
                {isRtl ? 'ربط بجروب معين (اختياري):' : 'Assign Group (optional):'}
              </label>
              <select
                value={assignedGroupId}
                onChange={(e) => setAssignedGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">{isRtl ? 'بدون ربط (مستقلة)' : 'None (Independent)'}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.grade})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                {isRtl ? 'الصعوبة:' : 'Difficulty:'}
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as LernstudioDifficulty)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold"
              >
                <option value="easy">{isRtl ? 'سهل' : 'Easy'}</option>
                <option value="medium">{isRtl ? 'متوسط' : 'Medium'}</option>
                <option value="hard">{isRtl ? 'متقدم' : 'Hard'}</option>
              </select>
            </div>
          </div>

          {/* Grammar Content Editor Section */}
          {showGrammarEditor && (
            <div className="p-4 bg-primary/5 border border-primary/25 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-primary flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  <span>{isRtl ? 'محتوى درس القواعد (الشرح، القواعد، الأمثلة والتمارين)' : 'Grammar Lesson Content'}</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                    {isRtl ? 'عنوان الدرس النحوي:' : 'Grammar Lesson Title:'}
                  </label>
                  <input
                    type="text"
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder={title || 'مثال: Der Akkusativ'}
                    className="w-full px-3 py-1.5 rounded-lg border border-surface-border bg-surface text-xs font-bold text-text-main"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                    {isRtl ? 'اسم القاعدة بالألمانية:' : 'Grammar Topic (DE):'}
                  </label>
                  <input
                    type="text"
                    value={grammarTopic}
                    onChange={(e) => setGrammarTopic(e.target.value)}
                    dir="ltr"
                    placeholder="Präsens / Akkusativ / Modalverben"
                    className="w-full px-3 py-1.5 rounded-lg border border-surface-border bg-surface text-xs font-bold text-text-main"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                    {isRtl ? 'شرح القاعدة بالعربية:' : 'Arabic Explanation:'}
                  </label>
                  <textarea
                    rows={2}
                    value={explanationAr}
                    onChange={(e) => setExplanationAr(e.target.value)}
                    placeholder="اشرح متى وكيف نستخدم هذه القاعدة ببساطة..."
                    className="w-full px-3 py-1.5 rounded-lg border border-surface-border bg-surface text-xs text-text-main"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-text-muted block mb-1">
                    {isRtl ? 'ملخص بالألمانية (اختياري):' : 'German Explanation (optional):'}
                  </label>
                  <textarea
                    rows={2}
                    value={explanationDe}
                    onChange={(e) => setExplanationDe(e.target.value)}
                    dir="ltr"
                    placeholder="Kurze Erklärung auf Deutsch..."
                    className="w-full px-3 py-1.5 rounded-lg border border-surface-border bg-surface text-xs text-text-main"
                  />
                </div>
              </div>

              {setToEdit?.grammarContent?.pageImageRefs && setToEdit.grammarContent.pageImageRefs.length > 0 && (
                <GrammarPageImagesPanel
                  pageImageRefs={setToEdit.grammarContent.pageImageRefs}
                  language={language}
                />
              )}

              {/* Rules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-main">
                    {isRtl ? `القواعد الفرعية (${rules.length}):` : `Rules (${rules.length}):`}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-primary text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isRtl ? 'إضافة قاعدة' : 'Add Rule'}</span>
                  </button>
                </div>
                {rules.map((r, rIdx) => (
                  <div key={r.id || rIdx} className="p-2.5 rounded-xl bg-surface border border-surface-border grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={r.title}
                      onChange={(e) =>
                        setRules((prev) => prev.map((it, i) => (i === rIdx ? { ...it, title: e.target.value } : it)))
                      }
                      placeholder={isRtl ? 'عنوان القاعدة' : 'Rule title'}
                      className="sm:col-span-3 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={r.pattern || ''}
                      onChange={(e) =>
                        setRules((prev) => prev.map((it, i) => (i === rIdx ? { ...it, pattern: e.target.value } : it)))
                      }
                      placeholder="Subjekt + Verb + ..."
                      dir="ltr"
                      className="sm:col-span-3 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={r.summaryAr}
                      onChange={(e) =>
                        setRules((prev) => prev.map((it, i) => (i === rIdx ? { ...it, summaryAr: e.target.value } : it)))
                      }
                      placeholder={isRtl ? 'الشرح المختصر بالعربية' : 'Arabic summary'}
                      className="sm:col-span-5 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setRules((prev) => prev.filter((_, i) => i !== rIdx))}
                      className="sm:col-span-1 p-1 text-text-muted hover:text-red-500 justify-self-end cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Examples */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-main">
                    {isRtl ? `أمثلة تطبيقية (${examples.length}):` : `Examples (${examples.length}):`}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddExample}
                    className="px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-primary text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isRtl ? 'إضافة مثال' : 'Add Example'}</span>
                  </button>
                </div>
                {examples.map((ex, eIdx) => (
                  <div key={ex.id || eIdx} className="p-2.5 rounded-xl bg-surface border border-surface-border grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={ex.german}
                      onChange={(e) =>
                        setExamples((prev) => prev.map((it, i) => (i === eIdx ? { ...it, german: e.target.value } : it)))
                      }
                      placeholder="Ich habe einen Hund."
                      dir="ltr"
                      className="sm:col-span-6 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={ex.arabic}
                      onChange={(e) =>
                        setExamples((prev) => prev.map((it, i) => (i === eIdx ? { ...it, arabic: e.target.value } : it)))
                      }
                      placeholder="أنا لدي كلب."
                      className="sm:col-span-5 px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setExamples((prev) => prev.filter((_, i) => i !== eIdx))}
                      className="sm:col-span-1 p-1 text-text-muted hover:text-red-500 justify-self-end cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Grammar Exercises */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-main">
                    {isRtl ? `تمارين القاعدة (${grammarExercises.length}):` : `Grammar Exercises (${grammarExercises.length}):`}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddGrammarExercise}
                    className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isRtl ? 'إضافة تمرين قواعد' : 'Add Grammar Exercise'}</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {grammarExercises.map((ex, idx) => (
                    <div
                      key={ex.id || idx}
                      className={`p-3 rounded-xl bg-surface border space-y-2 ${
                        ex.isUncertain ? 'border-amber-500/60' : 'border-surface-border'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-primary">#{idx + 1}</span>
                          <select
                            value={ex.type}
                            onChange={(e) =>
                              setGrammarExercises((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, type: e.target.value as GrammarExerciseType } : it
                                )
                              )
                            }
                            className="px-2 py-0.5 rounded-lg border border-surface-border bg-surface-hover text-[11px] font-bold"
                          >
                            {VALID_GRAMMAR_EXERCISE_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <select
                            value={ex.source || 'original'}
                            onChange={(e) =>
                              setGrammarExercises((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, source: e.target.value as 'original' | 'generated' } : it
                                )
                              )
                            }
                            className="px-2 py-0.5 rounded-lg border border-surface-border bg-surface-hover text-[10.5px] font-bold"
                          >
                            <option value="original">{isRtl ? 'أصلي / يدوي' : 'Original'}</option>
                            <option value="generated">{isRtl ? 'مولّد AI' : 'AI Generated'}</option>
                          </select>
                          {ex.isUncertain && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 text-[10px] font-bold inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{isRtl ? 'مراجعة مطلوبة' : 'Uncertain'}</span>
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setGrammarExercises((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-text-muted hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">
                            {isRtl ? 'السؤال / الجملة:' : 'Question:'}
                          </label>
                          <input
                            type="text"
                            value={ex.question}
                            onChange={(e) =>
                              setGrammarExercises((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, question: e.target.value } : it))
                              )
                            }
                            dir="ltr"
                            placeholder="Ich ___ einen Bruder. (haben)"
                            className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">
                            {isRtl ? 'الإجابة الصحيحة:' : 'Correct Answer:'}
                          </label>
                          <input
                            type="text"
                            value={ex.correctAnswer}
                            onChange={(e) =>
                              setGrammarExercises((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, correctAnswer: e.target.value, isUncertain: false } : it
                                )
                              )
                            }
                            dir="ltr"
                            placeholder="habe"
                            className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">
                            {isRtl ? 'الخيارات (افصل بـ | للاختيار من متعدد):' : 'Options (separate with |):'}
                          </label>
                          <input
                            type="text"
                            value={(ex.options || []).join(' | ')}
                            onChange={(e) =>
                              setGrammarExercises((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        options: e.target.value
                                          .split('|')
                                          .map((s) => s.trim())
                                          .filter(Boolean)
                                      }
                                    : it
                                )
                              )
                            }
                            dir="ltr"
                            placeholder="habe | hast | hat | haben"
                            className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">
                            {isRtl ? 'تعليل / شرح الحل بالعربية:' : 'Explanation (Ar):'}
                          </label>
                          <input
                            type="text"
                            value={ex.explanationAr || ''}
                            onChange={(e) =>
                              setGrammarExercises((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, explanationAr: e.target.value } : it))
                              )
                            }
                            placeholder="مع الضمير ich نستخدم habe"
                            className="w-full px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {autoFillHint && (
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-xs font-bold text-primary">
              {autoFillHint}
            </div>
          )}

          {/* Vocabulary / Verb Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
                {setKind === 'grammar'
                  ? isRtl
                    ? `مفردات مساعدة اختيارية (${items.length})`
                    : `Optional Anchor Vocabulary (${items.length})`
                  : isRtl
                  ? `قائمة عناصر المجموعة (${items.length})`
                  : `Items List (${items.length})`}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddItem('noun')}
                  className="px-3 py-1.5 bg-primary-soft hover:bg-primary-soft/80 text-primary rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'إضافة كلمة' : 'Add Word'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('verb')}
                  className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'إضافة فعل' : 'Add Verb'}</span>
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-[11px] text-text-muted p-3 rounded-xl border border-dashed border-surface-border">
                {isRtl
                  ? 'مجموعة القواعد هذه لا تعتمد على قائمة مفردات (items: []). يمكنك حفظها مباشرة أو إضافة مفردات اختيارية.'
                  : 'This grammar set works directly with rules & exercises without requiring vocabulary items.'}
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {items.map((item, idx) => {
                  const isVerb =
                    item.wordType === 'verb' ||
                    Boolean(item.verbId) ||
                    Boolean(item.conjugation && Object.values(item.conjugation).some(Boolean));

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-surface border border-surface-border rounded-2xl space-y-2.5 relative group"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-surface-border/40 pb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-primary">#{idx + 1}</span>
                          <select
                            value={item.wordType || (isVerb ? 'verb' : 'noun')}
                            onChange={(e) => {
                              const nextType = e.target.value as LernstudioWordType;
                              handleUpdateItem(idx, {
                                wordType: nextType,
                                ...(nextType === 'verb' && !item.conjugation
                                  ? { conjugation: { ...EMPTY_CONJUGATION } }
                                  : {})
                              });
                            }}
                            className="px-2 py-0.5 rounded-lg border border-surface-border bg-surface-hover text-[11px] font-bold text-text-main cursor-pointer"
                          >
                            <option value="noun">{isRtl ? 'اسم / مفردة' : 'Noun / Word'}</option>
                            <option value="verb">{isRtl ? 'فعل (Verb)' : 'Verb'}</option>
                            <option value="adjective">{isRtl ? 'صفة' : 'Adjective'}</option>
                            <option value="phrase">{isRtl ? 'عبارة' : 'Phrase'}</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAutoFillFromVerbLibrary(idx)}
                            className="px-2 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10.5px] font-bold cursor-pointer inline-flex items-center gap-1"
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>{isRtl ? 'ملء من مكتبة الأفعال' : 'Auto-fill Verb'}</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={setKind !== 'grammar' && setKind !== 'mixed' && items.length <= 1}
                          className="p-1 text-text-muted hover:text-red-500 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">
                            {isVerb
                              ? isRtl
                                ? 'مصدر الفعل (Infinitiv): *'
                                : 'Infinitive: *'
                              : isRtl
                              ? 'الكلمة بالألمانية (German): *'
                              : 'German Word: *'}
                          </label>
                          <input
                            type="text"
                            value={item.german}
                            onChange={(e) => handleUpdateItem(idx, { german: e.target.value })}
                            placeholder={isVerb ? 'einkaufen' : 'die Katze'}
                            dir="ltr"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold ltr"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">
                            {isRtl ? 'الترجمة بالعربية: *' : 'Arabic Translation: *'}
                          </label>
                          <input
                            type="text"
                            value={item.arabic}
                            onChange={(e) => handleUpdateItem(idx, { arabic: e.target.value })}
                            placeholder={isVerb ? 'يتسوق' : 'القطة'}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">
                            {!isVerb ? (isRtl ? 'الجمع (Plural):' : 'Plural:') : isRtl ? 'حرف الجر:' : 'Preposition:'}
                          </label>
                          <input
                            type="text"
                            value={!isVerb ? item.plural || '' : item.preposition || ''}
                            onChange={(e) =>
                              handleUpdateItem(
                                idx,
                                !isVerb ? { plural: e.target.value } : { preposition: e.target.value }
                              )
                            }
                            dir="ltr"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold ltr"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">
                            {isRtl ? 'جملة مثال بالألمانية:' : 'Example (DE):'}
                          </label>
                          <input
                            type="text"
                            value={item.exampleSentenceGerman || ''}
                            onChange={(e) => handleUpdateItem(idx, { exampleSentenceGerman: e.target.value })}
                            dir="ltr"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold ltr"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">
                            {isRtl ? 'ترجمة جملة المثال:' : 'Example (AR):'}
                          </label>
                          <input
                            type="text"
                            value={item.exampleSentenceArabic || ''}
                            onChange={(e) => handleUpdateItem(idx, { exampleSentenceArabic: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-text-muted block">Emoji:</label>
                          <input
                            type="text"
                            value={item.emoji || ''}
                            onChange={(e) => handleUpdateItem(idx, { emoji: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold text-center"
                          />
                        </div>
                      </div>

                      {isVerb && (
                        <div className="p-2.5 rounded-xl bg-surface-hover/70 border border-surface-border space-y-1.5">
                          <span className="text-[10.5px] font-black text-primary block">
                            {isRtl ? 'تصريف المضارع (Präsens):' : 'Präsens Conjugation:'}
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" dir="ltr">
                            {(
                              [
                                ['ich', 'ich'],
                                ['du', 'du'],
                                ['er_sie_es', 'er / sie / es'],
                                ['wir', 'wir'],
                                ['ihr', 'ihr'],
                                ['sie_Sie', 'sie / Sie']
                              ] as const
                            ).map(([slot, label]) => (
                              <div key={slot} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-text-muted w-16 shrink-0">{label}</span>
                                <input
                                  type="text"
                                  value={item.conjugation?.[slot] || ''}
                                  onChange={(e) => handleUpdateConjugation(idx, slot, e.target.value)}
                                  className="flex-1 min-w-0 px-2 py-1 rounded-md border border-surface-border bg-surface text-text-main text-xs font-bold"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-xl text-xs font-bold cursor-pointer"
            >
              {isRtl ? 'إلغاء' : language === 'de' ? 'Abbrechen' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black shadow-md cursor-pointer inline-flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isRtl ? 'حفظ المجموعة' : language === 'de' ? 'Set speichern' : 'Save Set'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
