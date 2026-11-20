import { LernstudioGameMode } from '../../../types/lernstudio';

export interface GameManifest {
  gameId: LernstudioGameMode;
  titleKey: string;
  emoji: string;
  supportsSolo: boolean;
  supportsTeams: boolean;
  supportedQuestionTypes: string[];
  supportsTimer: boolean;
  supportsAudio: boolean;
  supportsCustomScoring: boolean;
  category: 'team' | 'solo';
}

export const GAME_REGISTRY: Record<string, GameManifest> = {
  classroom: {
    gameId: 'classroom',
    titleKey: 'classroomQuizTitle',
    emoji: '🏆',
    supportsSolo: false,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das', 'emoji_vocab'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  tug_of_war: {
    gameId: 'tug_of_war',
    titleKey: 'tugOfWarTitle',
    emoji: '🪢',
    supportsSolo: false,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das', 'missing_letter'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  wheel: {
    gameId: 'wheel',
    titleKey: 'wheelGameTitle',
    emoji: '🎡',
    supportsSolo: true,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das', 'emoji_vocab'],
    supportsTimer: false,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  race: {
    gameId: 'race',
    titleKey: 'raceGameTitle',
    emoji: '🏎️',
    supportsSolo: false,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  team_auction: {
    gameId: 'team_auction',
    titleKey: 'teamAuctionTitle',
    emoji: '🔨',
    supportsSolo: false,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das', 'emoji_vocab'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  space_fleet: {
    gameId: 'space_fleet',
    titleKey: 'spaceFleetTitle',
    emoji: '🌌',
    supportsSolo: false,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  rocket_countdown: {
    gameId: 'rocket_countdown',
    titleKey: 'rocketCountdownTitle',
    emoji: '🚀',
    supportsSolo: false,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  tower_architects: {
    gameId: 'tower_architects',
    titleKey: 'towerArchitectsTitle',
    emoji: '🏰',
    supportsSolo: false,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  space_defense: {
    gameId: 'space_defense',
    titleKey: 'spaceDefenseTitle',
    emoji: '🛸',
    supportsSolo: false,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  tictactoe: {
    gameId: 'tictactoe',
    titleKey: 'tictactoeTitle',
    emoji: '❌⭕',
    supportsSolo: true,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: false,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'team'
  },
  ultimate_tictactoe: {
    gameId: 'ultimate_tictactoe',
    titleKey: 'ultimateTictactoeTitle',
    emoji: '👑',
    supportsSolo: true,
    supportsTeams: true,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: false,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'team'
  },
  sentence_builder: {
    gameId: 'sentence_builder',
    titleKey: 'teamSentenceTitle',
    emoji: '✍️',
    supportsSolo: true,
    supportsTeams: true,
    supportedQuestionTypes: ['sentence_builder'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  },
  memory: {
    gameId: 'memory',
    titleKey: 'memoryTitle',
    emoji: '🃏',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['emoji_vocab', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  balloon_pop: {
    gameId: 'balloon_pop',
    titleKey: 'balloonPopTitle',
    emoji: '🎈',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['emoji_vocab', 'multiple_choice'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  basket_catch: {
    gameId: 'basket_catch',
    titleKey: 'basketCatchTitle',
    emoji: '🧺',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['emoji_vocab', 'multiple_choice'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  bridge_builder: {
    gameId: 'bridge_builder',
    titleKey: 'bridgeBuilderTitle',
    emoji: '🌉',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  color_master: {
    gameId: 'color_master',
    titleKey: 'colorMasterTitle',
    emoji: '🎨',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['emoji_vocab', 'multiple_choice'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  factory_machine: {
    gameId: 'factory_machine',
    titleKey: 'factoryMachineTitle',
    emoji: '🏭',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  follow_clues: {
    gameId: 'follow_clues',
    titleKey: 'followCluesTitle',
    emoji: '🔍',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  island_crossing: {
    gameId: 'island_crossing',
    titleKey: 'islandCrossingTitle',
    emoji: '🏝️',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  pit_stop: {
    gameId: 'pit_stop',
    titleKey: 'pitStopTitle',
    emoji: '⛽',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  puzzle_masters: {
    gameId: 'puzzle_masters',
    titleKey: 'puzzleMastersTitle',
    emoji: '🧩',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  robot_repair: {
    gameId: 'robot_repair',
    titleKey: 'robotRepairTitle',
    emoji: '🤖',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  submarine_explore: {
    gameId: 'submarine_explore',
    titleKey: 'submarineTitle',
    emoji: '⚓',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  target_attack: {
    gameId: 'target_attack',
    titleKey: 'targetAttackTitle',
    emoji: '🎯',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  vending_machine: {
    gameId: 'vending_machine',
    titleKey: 'vendingMachineTitle',
    emoji: '🥤',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  whack_a_mole: {
    gameId: 'whack_a_mole',
    titleKey: 'whackAMoleTitle',
    emoji: '🔨',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  word_ninja: {
    gameId: 'word_ninja',
    titleKey: 'wordNinjaTitle',
    emoji: '🥷',
    supportsSolo: true,
    supportsTeams: false,
    supportedQuestionTypes: ['multiple_choice', 'der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: false,
    category: 'solo'
  },
  sorting: {
    gameId: 'sorting',
    titleKey: 'sortingTitle',
    emoji: '🗂️',
    supportsSolo: true,
    supportsTeams: true,
    supportedQuestionTypes: ['der_die_das'],
    supportsTimer: true,
    supportsAudio: true,
    supportsCustomScoring: true,
    category: 'team'
  }
};
