import React, { useState } from 'react';
import { LernstudioSet, LernstudioItem, LernstudioLevel, LernstudioDifficulty } from '../../types/lernstudio';
import { Group } from '../../types';
import { PROGRAM_GRADES } from '../../utils/lernstudioTranslations';
import { X, Plus, Trash2, Save, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  setToEdit?: LernstudioSet | null;
  groups: Group[];
  onClose: () => void;
  onSaveSet: (set: LernstudioSet) => void;
}

export const LernstudioSetEditorModal: React.FC<Props> = ({
  isOpen,
  setToEdit,
  groups,
  onClose,
  onSaveSet
}) => {
  const [title, setTitle] = useState(setToEdit?.title || '');
  const [topic, setTopic] = useState(setToEdit?.topic || '');
  const [grade, setGrade] = useState(setToEdit?.grade || '');
  const [level, setLevel] = useState<LernstudioLevel>(setToEdit?.level || 'A1');
  const [difficulty, setDifficulty] = useState<LernstudioDifficulty>(setToEdit?.difficulty || 'medium');
  const [assignedGroupId, setAssignedGroupId] = useState(setToEdit?.assignedGroupId || '');
  const [description, setDescription] = useState(setToEdit?.description || '');

  const [items, setItems] = useState<LernstudioItem[]>(
    setToEdit?.items || [
      {
        id: `item_${Date.now()}_1`,
        german: 'die Katze',
        arabic: 'القطة',
        plural: 'die Katzen',
        emoji: '🐱',
        exampleSentenceGerman: 'Die Katze schläft auf dem Sofa.',
        exampleSentenceArabic: 'القطة تنام على الأريكة.',
        missingLetterWord: 'K_tze'
      }
    ]
  );

  if (!isOpen) return null;

  const handleAddItem = () => {
    const newItem: LernstudioItem = {
      id: `item_${Date.now()}_${items.length + 1}`,
      german: '',
      arabic: '',
      emoji: '📚',
      missingLetterWord: ''
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (index: number, updates: Partial<LernstudioItem>) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const validItems = items.filter((i) => i.german.trim() && i.arabic.trim());
    if (validItems.length === 0) {
      alert('يرجى إضافة كلمة ألمانية وترجمة عربية واحدة على الأقل.');
      return;
    }

    const updatedSet: LernstudioSet = {
      id: setToEdit?.id || `set_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      topic: topic.trim() || title.trim(),
      grade: grade.trim() || undefined,
      level,
      difficulty,
      assignedGroupId: assignedGroupId || undefined,
      description: description.trim() || undefined,
      items: validItems,
      createdAt: setToEdit?.createdAt || new Date().toISOString(),
      updatedAt: Date.now()
    };

    onSaveSet(updatedSet);
    /* confetti removed */
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-hidden" dir="rtl">
      <div className="bg-surface border border-surface-border rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
          <h2 className="text-sm sm:text-base font-black text-text-main flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span>{setToEdit ? 'تعديل المجموعة التعليمية' : 'إنشاء مجموعة تعليمية جديدة (Set)'}</span>
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
          {/* Metadata Section */}
          <div className="p-4 bg-surface-hover/50 border border-surface-border rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-text-muted block mb-1">عنوان المجموعة (Title): *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: Tiere und Haustiere (الحيوانات)"
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">المستوى الأوروبي (CEFR):</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as LernstudioLevel)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              >
                <option value="A1">A1 - مبتدئ</option>
                <option value="A2">A2 - أساسي</option>
                <option value="B1">B1 - متوسط</option>
                <option value="B2">B2 - متوسط متقدم</option>
                <option value="C1">C1 - متقدم</option>
                <option value="C2">C2 - محترف</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">الموضوع (Topic):</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: المفردات, القواعد, المدرسة..."
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">الصف / المنهج (Grade):</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">-- اختر الصف (Grade 1 - 12) --</option>
                {PROGRAM_GRADES.map((g) => (
                  <option key={g.id} value={g.labelAr}>
                    {g.labelAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">ربط بجروب معين (اختياري):</label>
              <select
                value={assignedGroupId}
                onChange={(e) => setAssignedGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              >
                <option value="">بدون ربط (مستقلة)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.grade})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vocabulary Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
                قائمة مفردات المجموعة ({items.length} مفردات)
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-primary-soft hover:bg-primary-soft/80 text-primary rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة كلمة جديدة</span>
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={item.id} className="p-3 bg-surface border border-surface-border rounded-2xl space-y-2 relative group">
                  <div className="flex items-center justify-between gap-2 border-b border-surface-border/40 pb-2">
                    <span className="text-xs font-black text-primary">#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="p-1 text-text-muted hover:text-red-500 disabled:opacity-30 cursor-pointer"
                      title="حذف المفردة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted block">الكلمة بالألمانية (German): *</label>
                      <input
                        type="text"
                        required
                        value={item.german}
                        onChange={(e) => handleUpdateItem(idx, { german: e.target.value })}
                        placeholder="die Katze"
                        dir="ltr"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold ltr"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-text-muted block">الترجمة بالعربية (Arabic): *</label>
                      <input
                        type="text"
                        required
                        value={item.arabic}
                        onChange={(e) => handleUpdateItem(idx, { arabic: e.target.value })}
                        placeholder="القطة"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-text-muted block">صيغة الجمع (Plural):</label>
                      <input
                        type="text"
                        value={item.plural || ''}
                        onChange={(e) => handleUpdateItem(idx, { plural: e.target.value })}
                        placeholder="die Katzen"
                        dir="ltr"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold ltr"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-text-muted block">جملة مثال بالألمانية:</label>
                      <input
                        type="text"
                        value={item.exampleSentenceGerman || ''}
                        onChange={(e) => handleUpdateItem(idx, { exampleSentenceGerman: e.target.value })}
                        placeholder="Die Katze schläft."
                        dir="ltr"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold ltr"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-text-muted block">ترجمة جملة المثال:</label>
                      <input
                        type="text"
                        value={item.exampleSentenceArabic || ''}
                        onChange={(e) => handleUpdateItem(idx, { exampleSentenceArabic: e.target.value })}
                        placeholder="القطة تنام."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-text-muted block">الإيموجي (Emoji):</label>
                      <input
                        type="text"
                        value={item.emoji || ''}
                        onChange={(e) => handleUpdateItem(idx, { emoji: e.target.value })}
                        placeholder="🐱"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-text-main text-xs font-bold text-center"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-xl text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black shadow-md cursor-pointer inline-flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>حفظ المجموعة</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
