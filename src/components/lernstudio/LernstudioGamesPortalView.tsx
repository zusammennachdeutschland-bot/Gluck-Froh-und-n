import React from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioGameMode } from '../../types/lernstudio';
import { isArticleGameSupported, extractSortingItems } from '../../utils/lernstudioQuestionAdapter';
import { getLernstudioTranslations, getLocalizedSetTitle } from '../../utils/lernstudioTranslations';
import { GameThumbnailArt } from './GameArtAssets';
import {
  ArrowLeft,
  Gamepad2,
  Users,
  User,
  Play
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
  onSelectGame: (gameMode: LernstudioGameMode) => void;
}

interface GameItemConfig {
  id: LernstudioGameMode;
  titleKey: keyof ReturnType<typeof getLernstudioTranslations>;
  emoji: string;
  category: 'team' | 'solo';
  categoryKey: keyof ReturnType<typeof getLernstudioTranslations>;
  requiresArticles?: boolean;
}

export const LernstudioGamesPortalView: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack,
  onSelectGame
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const isArticleSupported = isArticleGameSupported(set);
  const sortingItems = extractSortingItems(set.items || []);
  const displayTitle = getLocalizedSetTitle(set, language);

  const teamGames: GameItemConfig[] = [
    {
      id: 'classroom',
      titleKey: 'classroomQuizTitle',
      emoji: '🏆',
      category: 'team',
      categoryKey: 'classroomQuizCategory'
    },
    {
      id: 'tug_of_war',
      titleKey: 'tugOfWarTitle',
      emoji: '🪢',
      category: 'team',
      categoryKey: 'tugOfWarCategory'
    },
    {
      id: 'wheel',
      titleKey: 'wheelGameTitle',
      emoji: '🎡',
      category: 'team',
      categoryKey: 'wheelGameCategory'
    },
    {
      id: 'race',
      titleKey: 'raceGameTitle',
      emoji: '🏎️',
      category: 'team',
      categoryKey: 'raceGameCategory'
    },
    {
      id: 'team_auction',
      titleKey: 'teamAuctionTitle',
      emoji: '🔨',
      category: 'team',
      categoryKey: 'teamAuctionCategory'
    },
    {
      id: 'space_fleet',
      titleKey: 'spaceFleetTitle',
      emoji: '🌌',
      category: 'team',
      categoryKey: 'spaceFleetCategory'
    },
    {
      id: 'rocket_countdown',
      titleKey: 'rocketCountdownTitle',
      emoji: '🚀',
      category: 'team',
      categoryKey: 'rocketCountdownCategory'
    },
    {
      id: 'tower_architects',
      titleKey: 'towerArchitectsTitle',
      emoji: '🏰',
      category: 'team',
      categoryKey: 'towerArchitectsCategory'
    },
    {
      id: 'space_defense',
      titleKey: 'spaceDefenseTitle',
      emoji: '🛸',
      category: 'team',
      categoryKey: 'spaceDefenseCategory'
    },
    {
      id: 'tictactoe',
      titleKey: 'tictactoeTitle',
      emoji: '❌⭕',
      category: 'team',
      categoryKey: 'tictactoeCategory'
    },
    {
      id: 'sentence_builder',
      titleKey: 'teamSentenceTitle',
      emoji: '✍️',
      category: 'team',
      categoryKey: 'teamSentenceCategory'
    }
  ];

  const soloGames: GameItemConfig[] = [
    {
      id: 'bridge_builder',
      titleKey: 'bridgeBuilderTitle',
      emoji: '🌉',
      category: 'solo',
      categoryKey: 'bridgeBuilderCategory'
    },
    {
      id: 'island_crossing',
      titleKey: 'islandCrossingTitle',
      emoji: '🏝️',
      category: 'solo',
      categoryKey: 'islandCrossingCategory'
    },
    {
      id: 'submarine_explore',
      titleKey: 'submarineExploreTitle',
      emoji: '🌊',
      category: 'solo',
      categoryKey: 'submarineExploreCategory'
    },
    {
      id: 'robot_repair',
      titleKey: 'robotRepairTitle',
      emoji: '🤖',
      category: 'solo',
      categoryKey: 'robotRepairCategory'
    },
    {
      id: 'color_master',
      titleKey: 'colorMasterTitle',
      emoji: '🎨',
      category: 'solo',
      categoryKey: 'colorMasterCategory'
    },
    {
      id: 'factory_machine',
      titleKey: 'factoryMachineTitle',
      emoji: '🏭',
      category: 'solo',
      categoryKey: 'factoryMachineCategory'
    },
    {
      id: 'puzzle_masters',
      titleKey: 'puzzleMastersTitle',
      emoji: '🧩',
      category: 'solo',
      categoryKey: 'puzzleMastersCategory'
    },
    {
      id: 'target_attack',
      titleKey: 'targetAttackTitle',
      emoji: '🎯',
      category: 'solo',
      categoryKey: 'targetAttackCategory'
    },
    {
      id: 'vending_machine',
      titleKey: 'vendingMachineTitle',
      emoji: '🥤',
      category: 'solo',
      categoryKey: 'vendingMachineCategory'
    },
    {
      id: 'whats_in_box',
      titleKey: 'whatsInBoxTitle',
      emoji: '📦',
      category: 'solo',
      categoryKey: 'whatsInBoxCategory'
    },
    {
      id: 'word_rhythm',
      titleKey: 'wordRhythmTitle',
      emoji: '🎵',
      category: 'solo',
      categoryKey: 'wordRhythmCategory'
    },
    {
      id: 'word_wash',
      titleKey: 'wordWashTitle',
      emoji: '🧼',
      category: 'solo',
      categoryKey: 'wordWashCategory'
    },
    {
      id: 'follow_clues',
      titleKey: 'followCluesTitle',
      emoji: '🔍',
      category: 'solo',
      categoryKey: 'followCluesCategory'
    },
    {
      id: 'pit_stop',
      titleKey: 'pitStopTitle',
      emoji: '🏁',
      category: 'solo',
      categoryKey: 'pitStopCategory'
    },
    {
      id: 'word_ninja',
      titleKey: 'wordNinjaTitle',
      emoji: '🥷',
      category: 'solo',
      categoryKey: 'wordNinjaCategory'
    },
    {
      id: 'balloon_pop',
      titleKey: 'balloonPopTitle',
      emoji: '🎈',
      category: 'solo',
      categoryKey: 'balloonPopCategory'
    },
    {
      id: 'whack_a_mole',
      titleKey: 'whackAMoleTitle',
      emoji: '🔨',
      category: 'solo',
      categoryKey: 'whackAMoleCategory'
    },
    {
      id: 'basket_catch',
      titleKey: 'basketCatchTitle',
      emoji: '🧺',
      category: 'solo',
      categoryKey: 'basketCatchCategory'
    },
    {
      id: 'word_detective',
      titleKey: 'wordDetectiveTitle',
      emoji: '🕵️‍♂️',
      category: 'solo',
      categoryKey: 'wordDetectiveCategory'
    },
    {
      id: 'sorting',
      titleKey: 'sortingGameTitle',
      emoji: '📦',
      category: 'solo',
      categoryKey: 'sortingGameCategory',
      requiresArticles: true
    },
    {
      id: 'memory',
      titleKey: 'memoryGameTitle',
      emoji: '🃏',
      category: 'solo',
      categoryKey: 'memoryGameCategory'
    },
    {
      id: 'game',
      titleKey: 'comprehensivePracticeTitle',
      emoji: '🎯',
      category: 'solo',
      categoryKey: 'comprehensivePracticeCategory'
    }
  ];

  return (
    <div
      className="min-h-[85vh] p-3 sm:p-5 rounded-3xl space-y-4 select-none transition-all bg-background text-text-main"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Bar Header */}
      <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-surface-border shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-surface-hover text-text-main hover:bg-primary hover:text-white transition-all cursor-pointer border border-surface-border inline-flex items-center gap-1.5 text-xs font-bold shrink-0"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.gamesPortalBack}</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Gamepad2 className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-sm sm:text-base font-black text-text-main truncate">
              {t.gamesPortalTitle}
            </h1>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold shrink-0 bg-primary/10 text-primary border border-primary/20">
              {displayTitle}
            </span>
            <span className="text-[11px] text-text-muted font-bold shrink-0">
              ({set.items?.length || 0} {t.vocabularyCount})
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Section 1: Team & Classroom Contests */}
        <div className="bg-surface/80 backdrop-blur-sm p-4 sm:p-5 rounded-3xl border border-surface-border space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">🏆</span>
              <div>
                <h2 className="text-sm sm:text-base font-black text-text-main">
                  {t.teamContestsSection}
                </h2>
                <p className="text-[11px] text-text-muted font-medium">ألعاب حماسية جماعية للفرق والسبورة الذكية</p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              {t.teamLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teamGames.map((game) => (
              <div
                key={game.id}
                onClick={() => onSelectGame(game.id)}
                className="group p-3 rounded-2xl bg-surface hover:bg-surface-hover border border-surface-border/70 hover:border-primary/50 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md hover:-translate-y-0.5 overflow-hidden relative"
              >
                {/* Thumbnail Header */}
                <div className="w-full h-28 rounded-xl overflow-hidden bg-background relative shrink-0 border border-surface-border/40">
                  <GameThumbnailArt gameId={game.id} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-black/60 text-white backdrop-blur-md flex items-center gap-1">
                    <span>{game.emoji}</span>
                    <span>فرق</span>
                  </span>
                </div>

                {/* Info */}
                <div className="min-w-0 space-y-1">
                  <h3 className="text-xs sm:text-sm font-bold text-text-main group-hover:text-primary transition-colors truncate">
                    {t[game.titleKey]}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-medium">
                    <Users className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="truncate">{t[game.categoryKey]}</span>
                  </div>
                </div>

                {/* Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectGame(game.id);
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 bg-primary hover:bg-primary-hover text-white transition-all shadow-xs group-hover:shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t.startBtn}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Solo & Practice Games */}
        <div className="bg-surface/80 backdrop-blur-sm p-4 sm:p-5 rounded-3xl border border-surface-border space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">🎯</span>
              <div>
                <h2 className="text-sm sm:text-base font-black text-text-main">
                  {t.soloPracticeSection}
                </h2>
                <p className="text-[11px] text-text-muted font-medium">تمارين تفاعلية وتدريب فردي ممتع</p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {t.soloLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {soloGames.map((game) => {
              const isDisabled = Boolean(game.requiresArticles && !isArticleSupported);

              return (
                <div
                  key={game.id}
                  onClick={() => {
                    if (!isDisabled) onSelectGame(game.id);
                  }}
                  className={`group p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 overflow-hidden relative ${
                    isDisabled
                      ? 'bg-surface/40 border-surface-border/30 opacity-60 cursor-not-allowed'
                      : 'bg-surface hover:bg-surface-hover border-surface-border/70 hover:border-primary/50 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {/* Thumbnail Header */}
                  <div className="w-full h-28 rounded-xl overflow-hidden bg-background relative shrink-0 border border-surface-border/40">
                    <GameThumbnailArt gameId={game.id} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-black/60 text-white backdrop-blur-md flex items-center gap-1">
                      <span>{game.emoji}</span>
                      <span>فردي</span>
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 space-y-1">
                    <h3 className={`text-xs sm:text-sm font-bold truncate ${isDisabled ? 'text-text-muted' : 'text-text-main group-hover:text-primary transition-colors'}`}>
                      {t[game.titleKey]}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-medium">
                      <User className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{t[game.categoryKey]}</span>
                      {game.requiresArticles && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isArticleSupported ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
                          {isArticleSupported
                            ? `(${sortingItems.length})`
                            : t.noNounsMsg}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Button */}
                  {isDisabled ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 rounded-xl text-xs font-bold text-text-muted bg-surface-hover border border-surface-border cursor-not-allowed shrink-0"
                    >
                      {t.unavailableBtn}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectGame(game.id);
                      }}
                      className="w-full py-2 px-3 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 bg-primary hover:bg-primary-hover text-white transition-all shadow-xs group-hover:shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{t.startBtn}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
