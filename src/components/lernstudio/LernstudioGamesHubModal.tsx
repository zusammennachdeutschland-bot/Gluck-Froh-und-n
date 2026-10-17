import React from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioGameMode } from '../../types/lernstudio';
import {
  X,
  Gamepad2,
  Trophy,
  Sparkles,
  Users,
  User,
  ArrowLeft,
  Flame,
  Layers,
  HelpCircle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  set: LernstudioSet | null;
  activeTheme: LernstudioTheme;
  language?: string;
  onClose: () => void;
  onSelectGame: (gameMode: LernstudioGameMode, targetSet: LernstudioSet) => void;
}

interface GameOption {
  id: LernstudioGameMode;
  title: string;
  category: 'team' | 'solo';
  categoryLabel: string;
  playersLabel: string;
  iconEmoji: string;
  description: string;
  badgeColor: string;
  buttonGradient: string;
}

const GAME_OPTIONS: GameOption[] = [
  {
    id: 'wheel',
    title: 'عجلة الحظ والتحديات (Spin Wheel)',
    category: 'team',
    categoryLabel: 'لعبة جماعية للفرق والفصل',
    playersLabel: '2 - 4 فرق',
    iconEmoji: '🎡',
    description: 'تدوير عجلة الحظ، نقاط مضاعفة، سرقة نقاط، وأسئلة متنوعة لإشعال الحماس والمنافسة.',
    badgeColor: 'text-amber-400',
    buttonGradient: 'from-amber-500 to-orange-600'
  },
  {
    id: 'race',
    title: 'سباق الفرق والسيارات (Team Race)',
    category: 'team',
    categoryLabel: 'لعبة جماعية بصرية تفاعلية',
    playersLabel: '2 - 4 فرق',
    iconEmoji: '🏎️',
    description: 'مضمار سباق حماسي؛ كل إجابة صحيحة تتقدم بسيارة الفريق نحو خط النهاية مع سرعة مضاعفة.',
    badgeColor: 'text-rose-400',
    buttonGradient: 'from-rose-500 to-red-600'
  },
  {
    id: 'memory',
    title: 'بطاقات الذاكرة والمطابقة (Memory Cards)',
    category: 'solo',
    categoryLabel: 'لعبة تدريب فردي وتحدي الذكاء',
    playersLabel: 'فردي أو لاعبين',
    iconEmoji: '🃏',
    description: 'قلب البطاقات ثلاثية الأبعاد لمطابقة الكلمات الألمانية مع معانيها والإيموجي مع عداد حركات.',
    badgeColor: 'text-emerald-400',
    buttonGradient: 'from-emerald-500 to-teal-600'
  },
  {
    id: 'sorting',
    title: 'صناديق فرز الأدوات (der / die / das Bins)',
    category: 'solo',
    categoryLabel: 'لعبة سرعة بديهة وقواعد',
    playersLabel: 'فردي',
    iconEmoji: '📦',
    description: 'فرز الكلمات الألمانية سريعاً في الصندوق المناسب (der, die, das) مع سلسلة كومبو مضاعفة.',
    badgeColor: 'text-blue-400',
    buttonGradient: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'classroom',
    title: 'لوحة الفصل والمسابقات (Jeopardy Board)',
    category: 'team',
    categoryLabel: 'شاشة العرض والسبورة الذكية',
    playersLabel: 'فرق ومجموعات',
    iconEmoji: '🏆',
    description: 'شبكة مربعات الأسئلة الكلاسيكية مع بطاقات الحظ والمفاجآت لحصص المراجعة والمسابقات.',
    badgeColor: 'text-purple-400',
    buttonGradient: 'from-purple-500 to-violet-600'
  },
  {
    id: 'game',
    title: 'التدريب الفردي الشامل (Solo Game Runner)',
    category: 'solo',
    categoryLabel: 'تمارين وتدريب ذاتي للطالب',
    playersLabel: 'فردي',
    iconEmoji: '🎯',
    description: 'التدريب على أنواع الأسئلة: اختيار من متعدد، الحرف الناقص، ترتيب الجمل، والحروف المبعثرة.',
    badgeColor: 'text-sky-400',
    buttonGradient: 'from-sky-500 to-blue-600'
  }
];

export const LernstudioGamesHubModal: React.FC<Props> = ({
  isOpen,
  set,
  activeTheme,
  language = 'ar',
  onClose,
  onSelectGame
}) => {
  if (!isOpen || !set) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-scale-up text-white">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>{language === 'ar' ? 'مركز الألعاب التفاعلية (Games Hub)' : language === 'de' ? 'Interaktiver Spiele-Hub (Games Hub)' : 'Interactive Games Hub'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                  {set.title}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'ar'
                  ? 'اختر نوع اللعبة المناسب لحصتك أو لتدريب الطلاب من قائمة الألعاب الجماعية والفردية:'
                  : language === 'de'
                  ? 'Wählen Sie ein Spiel für Ihren Unterricht oder das Einzeltraining aus:'
                  : 'Choose a game mode for your class or individual practice:'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Games Grid */}
        <div className="p-5 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {GAME_OPTIONS.map((g) => (
            <div
              key={g.id}
              onClick={() => {
                onSelectGame(g.id, set);
                onClose();
              }}
              className="p-5 rounded-3xl bg-slate-800/80 hover:bg-slate-800 border-2 border-slate-700/80 hover:border-primary transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 group shadow-xl hover:shadow-2xl hover:scale-[1.01]"
            >
              <div>
                {/* Meta info header */}
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-bold">
                  <span className="flex items-center gap-1.5">
                    {g.category === 'team' ? <Users className="w-3.5 h-3.5 text-amber-400" /> : <User className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{g.categoryLabel}</span>
                  </span>
                  <span className="text-[11px] text-slate-400">{g.playersLabel}</span>
                </div>

                {/* Title & Emoji */}
                <div className="flex items-start gap-3 mt-1">
                  <span className="text-3xl p-2.5 rounded-2xl bg-slate-900 border border-slate-700 shrink-0">
                    {g.iconEmoji}
                  </span>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-white group-hover:text-primary transition-colors">
                      {g.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {g.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
                <span className="text-xs font-black text-slate-300">بدء اللعبة الآن</span>
                <div
                  className={`px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r ${g.buttonGradient} shadow-md group-hover:shadow-lg transition-all flex items-center gap-1`}
                >
                  <span>العب</span>
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
