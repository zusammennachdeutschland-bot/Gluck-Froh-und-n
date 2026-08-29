import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BuddyCustomization, 
  BuddyMood, 
  BuddySkinTone, 
  BuddyHairStyle, 
  BuddyHairColor, 
  BuddyGlasses, 
  BuddyOutfitColor,
  DEFAULT_BUDDY_CUSTOMIZATION 
} from '../../types/buddy';
import { BuddyAnimation } from './BuddyAnimation';
import { Sparkles, Palette, User, Glasses, Shirt, RotateCcw, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface BuddyCustomizerProps {
  value: BuddyCustomization;
  onChange: (customization: BuddyCustomization) => void;
  compact?: boolean;
}

interface PresetOption {
  id: string;
  nameAr: string;
  nameEn: string;
  nameDe: string;
  config: BuddyCustomization;
}

const PRESET_CHARACTERS: PresetOption[] = [
  {
    id: 'herr_klassik',
    nameAr: 'أستاذ كلاسيكي (Herr Klassik)',
    nameEn: 'Classic Herr (Teacher)',
    nameDe: 'Herr Klassik',
    config: {
      skinTone: 'tan',
      gender: 'male',
      hairStyle: 'fluffy',
      hairColor: 'dark',
      glasses: 'round',
      outfitColor: 'blue'
    }
  },
  {
    id: 'frau_chic',
    nameAr: 'معلمة عصرية (Frau Chic)',
    nameEn: 'Frau Modern (Teacher)',
    nameDe: 'Frau Chic',
    config: {
      skinTone: 'fair',
      gender: 'female',
      hairStyle: 'long',
      hairColor: 'brown',
      glasses: 'round',
      outfitColor: 'rose'
    }
  },
  {
    id: 'frau_hijab',
    nameAr: 'معلمة محجبة (Frau Amira)',
    nameEn: 'Frau Hijab (Modest)',
    nameDe: 'Frau Amira (Kopftuch)',
    config: {
      skinTone: 'warm',
      gender: 'female',
      hairStyle: 'hijab',
      hairColor: 'dark',
      glasses: 'round',
      outfitColor: 'emerald'
    }
  },
  {
    id: 'herr_curly',
    nameAr: 'شاب عصري (Herr Karim)',
    nameEn: 'Curly Modern (Herr Karim)',
    nameDe: 'Herr Karim (Locken)',
    config: {
      skinTone: 'bronze',
      gender: 'male',
      hairStyle: 'curly',
      hairColor: 'dark',
      glasses: 'square',
      outfitColor: 'amber'
    }
  },
  {
    id: 'prof_otto',
    nameAr: 'أستاذ وقور (Prof. Otto)',
    nameEn: 'Professor Otto (Senior)',
    nameDe: 'Prof. Otto (Senior)',
    config: {
      skinTone: 'fair',
      gender: 'male',
      hairStyle: 'short',
      hairColor: 'gray',
      glasses: 'round',
      outfitColor: 'slate'
    }
  },
  {
    id: 'herr_tarek',
    nameAr: 'سمار مميز (Herr Tarek)',
    nameEn: 'Deep Tone (Herr Tarek)',
    nameDe: 'Herr Tarek (Deep Tone)',
    config: {
      skinTone: 'deep',
      gender: 'male',
      hairStyle: 'short',
      hairColor: 'dark',
      glasses: 'none',
      outfitColor: 'purple'
    }
  }
];

const SKIN_OPTIONS: { id: BuddySkinTone; labelAr: string; labelEn: string; color: string }[] = [
  { id: 'fair', labelAr: 'فاتحة (Fair)', labelEn: 'Fair', color: '#FED7AA' },
  { id: 'tan', labelAr: 'حنطية (Tan)', labelEn: 'Tan', color: '#F3C59D' },
  { id: 'warm', labelAr: 'قمحاوية / زيتونية (Warm)', labelEn: 'Warm Olive', color: '#E3A877' },
  { id: 'bronze', labelAr: 'برونزية (Bronze)', labelEn: 'Bronze', color: '#C68652' },
  { id: 'deep', labelAr: 'سمراء داكنة (Deep)', labelEn: 'Deep Tone', color: '#8D5B36' }
];

const HAIR_STYLE_OPTIONS: { id: BuddyHairStyle; labelAr: string; labelEn: string; icon: string }[] = [
  { id: 'fluffy', labelAr: 'مموج حيوي', labelEn: 'Fluffy Wavy', icon: '✨' },
  { id: 'short', labelAr: 'قصير كلاسيكي', labelEn: 'Short Crop', icon: '✂️' },
  { id: 'curly', labelAr: 'كيرلي / مجعد', labelEn: 'Curly Afro', icon: '🌀' },
  { id: 'long', labelAr: 'طويل / انسيابي', labelEn: 'Long Flow', icon: '🎀' },
  { id: 'hijab', labelAr: 'حجاب أنيق', labelEn: 'Hijab Wrap', icon: '🧕' },
  { id: 'bald', labelAr: 'حلاقة خفيفة', labelEn: 'Clean Buzz', icon: '🧑‍🦲' }
];

const HAIR_COLOR_OPTIONS: { id: BuddyHairColor; labelAr: string; labelEn: string; color: string }[] = [
  { id: 'dark', labelAr: 'أسود داكن', labelEn: 'Dark Black', color: '#0F172A' },
  { id: 'brown', labelAr: 'بني دافئ', labelEn: 'Warm Brown', color: '#78350F' },
  { id: 'blonde', labelAr: 'أشقر ذهبي', labelEn: 'Golden Blonde', color: '#CA8A04' },
  { id: 'auburn', labelAr: 'كستنائي / نحاسي', labelEn: 'Auburn Ginger', color: '#EA580C' },
  { id: 'gray', labelAr: 'رمادي وقور', labelEn: 'Silver Gray', color: '#64748B' }
];

const GLASSES_OPTIONS: { id: BuddyGlasses; labelAr: string; labelEn: string; icon: string }[] = [
  { id: 'round', labelAr: 'نظارة دائرية', labelEn: 'Round Glasses', icon: '👓' },
  { id: 'square', labelAr: 'نظارة عصرية', labelEn: 'Square Modern', icon: '🕶️' },
  { id: 'none', labelAr: 'بدون نظارة', labelEn: 'No Glasses', icon: '👀' }
];

const OUTFIT_OPTIONS: { id: BuddyOutfitColor; labelAr: string; labelEn: string; color: string }[] = [
  { id: 'blue', labelAr: 'أزرق كلاسيكي', labelEn: 'Royal Blue', color: '#2563EB' },
  { id: 'emerald', labelAr: 'أخضر زمردي', labelEn: 'Emerald Green', color: '#059669' },
  { id: 'purple', labelAr: 'بنفسجي فاخر', labelEn: 'Royal Purple', color: '#7C3AED' },
  { id: 'rose', labelAr: 'وردي لطيف', labelEn: 'Rose Pink', color: '#E11D48' },
  { id: 'amber', labelAr: 'أصفر ذهبي', labelEn: 'Golden Amber', color: '#D97706' },
  { id: 'slate', labelAr: 'رمادي غامق', labelEn: 'Slate Charcoal', color: '#475569' }
];

export const BuddyCustomizer: React.FC<BuddyCustomizerProps> = ({
  value,
  onChange,
  compact = false
}) => {
  const { _t } = useApp();
  const [activeTab, setActiveTab] = useState<'presets' | 'skin' | 'hair' | 'glasses' | 'outfit'>('presets');
  const [previewMood, setPreviewMood] = useState<BuddyMood>('normal');

  const updateField = <K extends keyof BuddyCustomization>(field: K, val: BuddyCustomization[K]) => {
    onChange({
      ...value,
      [field]: val
    });
  };

  return (
    <div className="space-y-3 bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm">
      
      {/* Top Header & Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {_t('تخصيص شخصية Glück Buddy', 'Customize Glück Buddy Mascot', 'Glück Buddy anpassen')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_BUDDY_CUSTOMIZATION)}
          className="text-[11px] font-bold text-slate-500 hover:text-primary flex items-center gap-1 transition-colors cursor-pointer"
          title="Reset to default"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{_t('استعادة الافتراضي', 'Reset', 'Zurücksetzen')}</span>
        </button>
      </div>

      {/* Main Interactive Stage with Pop-out Preview */}
      <div className="relative rounded-2xl bg-linear-to-b from-blue-50/70 via-indigo-50/40 to-white dark:from-slate-800/80 dark:via-slate-850 dark:to-slate-900 p-4 border border-primary/20 flex flex-col sm:flex-row items-center gap-4">
        
        {/* Character Stage Frame (With 3D Burst Out) */}
        <div className="relative flex flex-col items-center">
          {/* Circular Base Portal Plate */}
          <div className="relative w-24 h-24 rounded-full bg-linear-to-b from-white to-blue-100 dark:from-slate-800 dark:to-slate-950 border-2 border-primary/40 shadow-inner flex items-center justify-center">
            {/* Mascot with Pop-out enabled */}
            <div className="absolute inset-0 flex items-center justify-center overflow-visible">
              <BuddyAnimation mood={previewMood} size="lg" customization={value} popOut={true} interactive={true} />
            </div>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-2">
            {_t('المس للتفاعل ✨', 'Tap to react ✨', 'Tippen zum Reagieren ✨')}
          </span>
        </div>

        {/* Emotion Tester Bar (To demonstrate pop-out behavior) */}
        <div className="flex-1 w-full space-y-2">
          <div className="text-[11px] font-black text-slate-700 dark:text-slate-300">
            {_t('جرّب حركات وخروج البودي من الإطار:', 'Test Pop-Out Reactions:', 'Reaktionen testen:')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'normal', label: 'ابتسامة 😊' },
              { id: 'celebration', label: 'احتفال 🎉 (قفز للخارج)' },
              { id: 'morning', label: 'صباح الخير ☕ (تلويح)' },
              { id: 'busy', label: 'انشغال ✏️ (كتابة سريعة)' },
              { id: 'sleeping', label: 'نوم هادئ 🌙' }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPreviewMood(m.id as BuddyMood)}
                className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  previewMood === m.id
                    ? 'bg-primary text-white border-primary shadow-xs scale-105'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-100 dark:border-slate-800">
        {[
          { id: 'presets', labelAr: 'قوالب جاهزة', labelEn: 'Presets', icon: Sparkles },
          { id: 'skin', labelAr: 'البشرة والعرق', labelEn: 'Skin & Tone', icon: User },
          { id: 'hair', labelAr: 'الشعر والحجاب', labelEn: 'Hair / Hijab', icon: Palette },
          { id: 'glasses', labelAr: 'النظارات', labelEn: 'Glasses', icon: Glasses },
          { id: 'outfit', labelAr: 'الملابس', labelEn: 'Outfit', icon: Shirt },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{_t(tab.labelAr, tab.labelEn, tab.labelEn)}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Presets */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {PRESET_CHARACTERS.map((preset) => {
            const isSelected = 
              value.skinTone === preset.config.skinTone &&
              value.hairStyle === preset.config.hairStyle &&
              value.hairColor === preset.config.hairColor &&
              value.glasses === preset.config.glasses &&
              value.outfitColor === preset.config.outfitColor;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.config)}
                className={`p-2.5 rounded-xl border text-right rtl:text-right ltr:text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 scale-[1.02] shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/40'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center overflow-visible">
                  <BuddyAnimation mood="normal" size="sm" customization={preset.config} popOut={false} interactive={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                    {_t(preset.nameAr, preset.nameEn, preset.nameDe)}
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                      <Check className="w-3 h-3" />
                      {_t('المختار', 'Selected', 'Ausgewählt')}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tab 2: Skin Tone & Ethnicity */}
      {activeTab === 'skin' && (
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {_t('اختر درجة البشرة والعرق:', 'Choose Skin Tone & Ethnicity:', 'Hautton & Ethnie wählen:')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {SKIN_OPTIONS.map((opt) => {
              const isSelected = value.skinTone === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateField('skinTone', opt.id)}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 scale-105'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:scale-102'
                  }`}
                >
                  <div 
                    className="w-7 h-7 rounded-full shadow-inner border border-black/10"
                    style={{ backgroundColor: opt.color }}
                  />
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    {_t(opt.labelAr, opt.labelEn, opt.labelEn)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Hair Style & Color */}
      {activeTab === 'hair' && (
        <div className="space-y-3 pt-1">
          {/* Hair Style */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {_t('قصة الشعر / الحجاب:', 'Hair Style / Hijab:', 'Frisur / Kopftuch:')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {HAIR_STYLE_OPTIONS.map((opt) => {
                const isSelected = value.hairStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateField('hairStyle', opt.id)}
                    className={`p-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/40'
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {_t(opt.labelAr, opt.labelEn, opt.labelEn)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hair Color (hidden if Hijab is chosen) */}
          {value.hairStyle !== 'hijab' && value.hairStyle !== 'bald' && (
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {_t('لون الشعر:', 'Hair Color:', 'Haarfarbe:')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {HAIR_COLOR_OPTIONS.map((opt) => {
                  const isSelected = value.hairColor === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField('hairColor', opt.id)}
                      className={`p-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30 scale-102'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div 
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                        style={{ backgroundColor: opt.color }}
                      />
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                        {_t(opt.labelAr, opt.labelEn, opt.labelEn)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Glasses */}
      {activeTab === 'glasses' && (
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {_t('شكل النظارة:', 'Glasses Style:', 'Brillenstil:')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {GLASSES_OPTIONS.map((opt) => {
              const isSelected = value.glasses === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateField('glasses', opt.id)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 scale-105'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/40'
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {_t(opt.labelAr, opt.labelEn, opt.labelEn)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Outfit Color */}
      {activeTab === 'outfit' && (
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {_t('لون الهودي / الملابس:', 'Hoodie / Outfit Color:', 'Kleidungsfarbe:')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OUTFIT_OPTIONS.map((opt) => {
              const isSelected = value.outfitColor === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateField('outfitColor', opt.id)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 scale-102'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/40'
                  }`}
                >
                  <div 
                    className="w-5 h-5 rounded-full border border-black/10 shrink-0" 
                    style={{ backgroundColor: opt.color }}
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {_t(opt.labelAr, opt.labelEn, opt.labelEn)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
