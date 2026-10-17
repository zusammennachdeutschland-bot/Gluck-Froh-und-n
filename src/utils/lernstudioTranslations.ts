import { LernstudioSet } from '../types/lernstudio';

export type AppLanguage = 'ar' | 'en' | 'de';

export interface LernstudioTranslations {
  // App Bar & Hub
  hubTitle: string;
  hubSubtitle: string;
  createSet: string;
  aiImport: string;
  library: string;
  themePicker: string;
  searchPlaceholder: string;
  allLevels: string;
  allGroups: string;
  noSetsFound: string;
  noSetsDesc: string;

  // Set Cards
  vocabularyCount: string;
  gradeLabel: string;
  levelLabel: string;
  playGame: string;
  teachMode: string;
  viewWords: string;
  wordsModalTitle: string;
  searchWordsPlaceholder: string;
  classroomBoard: string;
  printWorksheet: string;
  editSet: string;
  shareWhatsApp: string;
  duplicateSet: string;
  copyJson: string;
  deleteSet: string;

  // Games Portal
  gamesPortalTitle: string;
  gamesPortalBack: string;
  teamContestsSection: string;
  soloPracticeSection: string;
  teamLabel: string;
  soloLabel: string;
  startBtn: string;
  unavailableBtn: string;
  availableNouns: string;
  noNounsMsg: string;
  classroomQuizTitle: string;
  classroomQuizCategory: string;
  wheelGameTitle: string;
  wheelGameCategory: string;
  raceGameTitle: string;
  raceGameCategory: string;
  teamSentenceTitle: string;
  teamSentenceCategory: string;
  soloSentenceTitle: string;
  soloSentenceCategory: string;
  sortingGameTitle: string;
  sortingGameCategory: string;
  memoryGameTitle: string;
  memoryGameCategory: string;
  comprehensivePracticeTitle: string;
  comprehensivePracticeCategory: string;

  // Sentence Game
  sentenceGameHeader: string;
  targetTranslationLabel: string;
  dragOrTapWords: string;
  undoBtnLabel: string;
  resetBtnLabel: string;
  hintBtnLabel: string;
  nextQuestionBtn: string;
  sentenceVictoryTitle: string;

  // Sorting Game
  sortingGameHeader: string;
  sortingSubTitle: string;
  sortingEmptyWarning: string;

  // Teach Mode & Worksheets
  teachModeTitle: string;
  prevSlide: string;
  nextSlide: string;
  showTranslation: string;
  hideTranslation: string;
  listenAudio: string;
  worksheetModalTitle: string;
  printBtn: string;
  downloadPdf: string;

  // Classroom Board Setup
  boardTitle: string;
  selectGameMode: string;
  modeClassicTitle: string;
  modeClassicDesc: string;
  modeQuizTitle: string;
  modeQuizDesc: string;
  modePartyTitle: string;
  modePartyDesc: string;

  selectGroupHeader: string;
  currentClassBtn: string;
  currentClassActiveNote: string;
  noCurrentClassFound: string;
  filterByDay: string;
  filterByTime: string;
  allDays: string;
  allTimes: string;
  morningTime: string;
  afternoonTime: string;
  eveningTime: string;

  playStyleHeader: string;
  splitGroupTeams: string;
  individualStudents: string;
  customTeams: string;
  teamsCount: string;
  tilesCount: string;
  timerSettingLabel: string;
  noTimer: string;
  launchBoardBtn: string;

  // Classroom Board In-Game
  remainingTiles: string;
  undoBtn: string;
  fullscreen: string;
  minimize: string;
  settingsBtn: string;
  endGameBtn: string;
  currentTurn: string;
  scorePts: string;
  applyPowerupBtn: string;
  showAnswerBtn: string;
  correctAnswerLabel: string;
  correctBtn: string;
  wrongBtn: string;
  secondsText: string;
  winnerTitle: string;
  winnerFirstPlace: string;
  winnerScore: string;
  playNewGame: string;
  adjustSettings: string;

  // Power Cards
  powerGiftTitle: string;
  powerGiftDesc: string;
  powerStealTitle: string;
  powerStealDesc: string;
  powerSwapTitle: string;
  powerSwapDesc: string;
  powerRocketTitle: string;
  powerRocketDesc: string;
  powerBombTitle: string;
  powerBombDesc: string;
  powerZeroTitle: string;
  powerZeroDesc: string;
  powerDoubleTitle: string;
  powerDoubleDesc: string;
  powerGiveTitle: string;
  powerGiveDesc: string;
  powerSkipTitle: string;
  powerSkipDesc: string;

  // Game Runner
  tabMultipleChoice: string;
  tabMissingLetter: string;
  tabSentenceBuilder: string;
  tabEmojiVocab: string;
  tabScrambledLetters: string;
  pointsLabel: string;
  streakLabel: string;
  questionProgress: string;
  mcPrompt: string;
  missingLetterPrompt: string;
  sentenceBuilderPrompt: string;
  emojiVocabPrompt: string;
  scrambledPrompt: string;
  checkAnswerBtn: string;
  teacherPassBtn: string;
  rightAnswerMsg: string;
  wrongAnswerMsg: string;
  perfectSentenceMsg: string;
  reorderSolutionMsg: string;
  targetWordMsg: string;
  completedGameTitle: string;
  completedGameDesc: string;
  restartGameBtn: string;
  returnToSetsBtn: string;

  // New Game Keys
  balloonPopTitle: string;
  balloonPopCategory: string;
  tictactoeTitle: string;
  tictactoeCategory: string;
  basketCatchTitle: string;
  basketCatchCategory: string;
  spaceDefenseTitle: string;
  spaceDefenseCategory: string;
  wordDetectiveTitle: string;
  wordDetectiveCategory: string;
  whackAMoleTitle: string;
  whackAMoleCategory: string;
  tugOfWarTitle: string;
  tugOfWarCategory: string;
  wordNinjaTitle: string;
  wordNinjaCategory: string;
  allEducationalLevels: string;
  allTopicsAndCategories: string;
  germanSetsForKids: string;
  curriculumSubtitle: string;
  displayedResults: string;
  setsUnit: string;
  resetFilters: string;
}

const translations: Record<AppLanguage, LernstudioTranslations> = {
  ar: {
    hubTitle: 'Glück – Lernstudio 🇩🇪',
    hubSubtitle: 'استوديو المجموعات والألعاب التعليمية',
    createSet: 'إنشاء Set جديدة',
    aiImport: 'استيراد بالذكاء الاصطناعي 🤖',
    library: 'المكتبة التعليمية 📚',
    themePicker: 'تغيير الثيم',
    searchPlaceholder: 'بحث باسم المجموعة، الكلمة، أو الصف...',
    allLevels: 'جميع الصفوف (من 1 إلى 12)',
    allGroups: 'جميع المجموعات',
    noSetsFound: 'لا توجد مجموعات تعليمية تطابق البحث',
    noSetsDesc: 'يمكنك إنشاء مجموعة جديدة يدويًا أو توليدها عبر الذكاء الاصطناعي.',

    vocabularyCount: 'مفردات',
    gradeLabel: 'الصف:',
    levelLabel: 'المستوى:',
    playGame: 'الألعاب والمسابقات 🎮🏆',
    teachMode: 'مود الشرح 📖',
    viewWords: 'عرض المفردات 👁️',
    wordsModalTitle: 'مفردات المجموعة',
    searchWordsPlaceholder: 'بحث في الكلمات...',
    classroomBoard: 'لعبة السبورة 🏫',
    printWorksheet: 'ورقة عمل 📄',
    editSet: 'تعديل',
    shareWhatsApp: 'مشاركة عبر واتساب',
    duplicateSet: 'نسخ المجموعة',
    copyJson: 'نسخ JSON',
    deleteSet: 'حذف',

    gamesPortalTitle: 'الألعاب والمسابقات',
    gamesPortalBack: 'العودة',
    teamContestsSection: 'مسابقات الفصل والفرق',
    soloPracticeSection: 'الألعاب والتدريب الفردي',
    teamLabel: 'جماعي',
    soloLabel: 'فردي',
    startBtn: 'تشغيل',
    unavailableBtn: 'غير متاح',
    availableNouns: 'متاح',
    noNounsMsg: 'غير متاح (لا تحتوي على أسماء)',
    classroomQuizTitle: 'مسابقة الفصل الذكية',
    classroomQuizCategory: 'جماعي / الفصل',
    wheelGameTitle: 'عجلة الحظ والتحديات',
    wheelGameCategory: '2 - 4 فرق',
    raceGameTitle: 'سباق السيارات والفرق',
    raceGameCategory: '2 - 4 فرق',
    teamSentenceTitle: 'تحدي ترتيب الجمل للفرق',
    teamSentenceCategory: 'تنافس فرق',
    soloSentenceTitle: 'ترتيب الجمل والنحو',
    soloSentenceCategory: 'تدريب فردي',
    sortingGameTitle: 'فرز أدوات التعريف (der / die / das)',
    sortingGameCategory: 'قواعد وأدوات',
    memoryGameTitle: 'بطاقات الذاكرة والمطابقة',
    memoryGameCategory: 'فردي / ثنائي',
    comprehensivePracticeTitle: 'التدريب الفردي الشامل',
    comprehensivePracticeCategory: 'اختبار سريع',
    balloonPopTitle: 'فرقعة البالونات 🎈',
    balloonPopCategory: 'تحدي السرعة الفردي',
    tictactoeTitle: 'لعبة X-O الكلمات ❌⭕',
    tictactoeCategory: 'مواجهة فرق أو ضد الحاسوب',
    basketCatchTitle: 'التقاط المفردات بالسلة 🧺',
    basketCatchCategory: 'التقاط المطر الصوتي الفردي',
    spaceDefenseTitle: 'معركة الدفاع الفضائي 🚀',
    spaceDefenseCategory: 'جماعي أو فردي / تصويب',
    wordDetectiveTitle: 'المحقق وكلمة السر 🕵️‍♂️',
    wordDetectiveCategory: 'تخمين الحروف والألغاز',
    whackAMoleTitle: 'اضرب الخلد والمفردات 🔨',
    whackAMoleCategory: 'تحدي السرعة الفردي',
    tugOfWarTitle: 'تحدي شد الحبل 🪢',
    tugOfWarCategory: 'تنافس فرق حماسي / أو ضد الآلي',
    wordNinjaTitle: 'نينجا تقطيع المفردات 🥷',
    wordNinjaCategory: 'تحدي السرعة والتركيز الفردي',
    allEducationalLevels: 'كل المراحل التعليمية',
    allTopicsAndCategories: 'كل الموضوعات والمجالات',
    germanSetsForKids: 'مجموعة ألمانية للأطفال',
    curriculumSubtitle: '10 مفردات منتقاة لكل مجموعة مع الترجمة والصوت والأمثلة',
    displayedResults: 'النتائج المعروضة:',
    setsUnit: 'مجموعة',
    resetFilters: 'إعادة تعيين الفلاتر',

    sentenceGameHeader: 'تحدي ترتيب الجمل الألمانية 🧩',
    targetTranslationLabel: 'الترتيب المطلوب:',
    dragOrTapWords: 'اسحب الكلمات أو اضغط عليها لرص الجملة:',
    undoBtnLabel: 'تراجع',
    resetBtnLabel: 'إعادة',
    hintBtnLabel: 'تلميح',
    nextQuestionBtn: 'السؤال التالي',
    sentenceVictoryTitle: 'أحسنت! أكملت تحدي الجمل بنجاح 🎉',

    sortingGameHeader: 'لعبة فرز الأدوات (der / die / das) 📦',
    sortingSubTitle: 'اسحب الكلمة أو اضغط على الصندوق المناسب:',
    sortingEmptyWarning: 'عذراً، هذه المجموعة لا تحتوي على أسماء معرفة (der/die/das) تناسب لعبة الفرز.',

    teachModeTitle: 'العرض التقديمي ومود الشرح 📖',
    prevSlide: 'السابق',
    nextSlide: 'التالي',
    showTranslation: 'إظهار الترجمة',
    hideTranslation: 'إخفاء الترجمة',
    listenAudio: 'استمع للكلمة 🔊',
    worksheetModalTitle: 'طباعة ورقة عمل تفاعلية 📄',
    printBtn: 'طباعة 🖨️',
    downloadPdf: 'تحميل PDF 📥',

    boardTitle: 'إعداد لعبة السبورة التنافسية (Baamboozle Style) 🎮',
    selectGameMode: '1. اختر نظام اللعبة:',
    modeClassicTitle: 'Baamboozle Classic 🚀',
    modeClassicDesc: 'أسئلة + بطاقات المفاجآت (سرقة النقاط، الهدية، الصاروخ والمضاعفة).',
    modeQuizTitle: 'Quiz Mode ❓',
    modeQuizDesc: 'أسئلة فقط بدون بطاقات مفاجآت (مناسب للاختبارات).',
    modePartyTitle: 'Party Mode ⚡',
    modePartyDesc: 'وضع المفاجآت السريعة والترفيه للفصل.',

    selectGroupHeader: '2. اختيار المجموعات والطلاب من التطبيق:',
    currentClassBtn: 'الجروب الحالي حسب الوقت ⚡',
    currentClassActiveNote: 'تم تحديد الجروب النشط حالياً بناءً على الجدول الزمني!',
    noCurrentClassFound: 'لا توجد حصة مسجلة في الوقت الحالي. يرجى اختيار الجروب يدويًا.',
    filterByDay: 'اليوم:',
    filterByTime: 'الفترة:',
    allDays: 'جميع الأيام',
    allTimes: 'جميع الأوقات',
    morningTime: 'صباحًا (8-12)',
    afternoonTime: 'ظهراً (12-5)',
    eveningTime: 'مساءً (5+)',

    playStyleHeader: '3. نمط توزيع الفرق والمتنافسين:',
    splitGroupTeams: 'تقسيم الطلاب لفرق متوازنة',
    individualStudents: 'لعب فردي (لكل طالب كارت)',
    customTeams: 'فرق ألوان مخصصة',
    teamsCount: 'عدد الفرق:',
    tilesCount: '4. عدد المربعات على الشاشة:',
    timerSettingLabel: '5. المؤقت الزمني لكل سؤال:',
    noTimer: 'بدون مؤقت (مفتوح)',
    launchBoardBtn: 'بدء اللعبة وتجهيز الشاشة 🚀',

    remainingTiles: 'المتبقي:',
    undoBtn: 'تراجع',
    fullscreen: 'ملء الشاشة',
    minimize: 'تصغير',
    settingsBtn: 'الإعدادات',
    endGameBtn: 'إنهاء اللعبة',
    currentTurn: 'الدور الحسابي الآن لـ:',
    scorePts: 'النقاط:',
    applyPowerupBtn: 'تطبيق المفاجأة ومتابعة الدور!',
    showAnswerBtn: 'كشف الإجابة (Show Answer)',
    correctAnswerLabel: 'الإجابة الصحيحة:',
    correctBtn: 'إجابة صحيحة (Okay)',
    wrongBtn: 'إجابة خاطئة (Oops)',
    secondsText: 'ثانية',
    winnerTitle: 'نهاية اللعبة والنتيجة النهائية',
    winnerFirstPlace: 'الفائز بالمركز الأول:',
    winnerScore: 'برصيد',
    playNewGame: 'لعب مباراة جديدة',
    adjustSettings: 'تعديل الإعدادات',

    powerGiftTitle: 'هدية مجانية! 🎁',
    powerGiftDesc: 'حصل فريقك على +25 نقطة مجانية بدون سؤال!',
    powerStealTitle: 'سرقة نقاط! 🏴‍☠️',
    powerStealDesc: 'سرقة 15 نقطة فورية من الفريق المنافس وإضافتها لفريقك!',
    powerSwapTitle: 'تبديل النقاط! 🔄',
    powerSwapDesc: 'مفاجأة غيرت الموازين! تبادل نتيجة فريقك بالكامل مع الفريق الآخر!',
    powerRocketTitle: 'انطلاق الصاروخ! 🚀',
    powerRocketDesc: 'قفزة صاروخية للمركز الأول مع +10 نقاط إضافية!',
    powerBombTitle: 'انفجار قنبلة! 💥',
    powerBombDesc: 'سوء حظ! خسارة -15 نقطة لفريقك!',
    powerZeroTitle: 'المساحة السحرية! 🧹',
    powerZeroDesc: 'أوه لا! تصفير نقاط فريقك والعودة إلى 0!',
    powerDoubleTitle: 'المضاعفة الذهبية! 🌟',
    powerDoubleDesc: 'مضاعفة نتيجة فريقك الحالية x2!',
    powerGiveTitle: 'كرم وأخلاق! 💖',
    powerGiveDesc: 'اهدِ 15 نقطة مجانية للفريق الآخر!',
    powerSkipTitle: 'التمساح الكسول! 🐊',
    powerSkipDesc: 'لا توجد أسئلة، لكن تخطي الدور الحالي بدون نقاط!',

    tabMultipleChoice: '1. خيارات متعددة 📝',
    tabMissingLetter: '2. الحرف الناقص 🔤',
    tabSentenceBuilder: '3. بناء الجملة (4) 🧩',
    tabEmojiVocab: '4. تخمين الإيموجي 😃',
    tabScrambledLetters: '5. ترتيب الحروف 🔀',
    pointsLabel: 'النقاط:',
    streakLabel: 'السلسلة:',
    questionProgress: 'السؤال',
    mcPrompt: 'اختر الكلمة الألمانية المناسبة:',
    missingLetterPrompt: 'أدخل الحرف الناقص أو الكلمة كاملة باللغة الألمانية:',
    sentenceBuilderPrompt: 'رتب العناصر الـ 4 لتكوين جملة ألمانية صحيحة:',
    emojiVocabPrompt: 'اكتب الكلمة الألمانية المطابقة للإيموجي:',
    scrambledPrompt: 'رتب الحروف التالية لتكوين الكلمة الألمانية الصحيحة:',
    checkAnswerBtn: 'تحقق من الإجابة ✓',
    teacherPassBtn: 'احتساب صحيحة للمدرس',
    rightAnswerMsg: 'Richtig! إجابة صحيحة ممتازة 👏',
    wrongAnswerMsg: 'إجابة خاطئة. الكلمة الألمانية الصحيحة هي:',
    perfectSentenceMsg: 'Perfekt! جملة ألمانية صحيحة ومضبوطة 🌟',
    reorderSolutionMsg: 'الترتيب الموصى به:',
    targetWordMsg: 'الكلمة المستهدفة:',
    completedGameTitle: 'ممتاز! أكملت التدريب بنجاح 🎉',
    completedGameDesc: 'حققت نتيجة ممتازة في هذا الموضوع.',
    restartGameBtn: 'إعادة اللعب من جديد',
    returnToSetsBtn: 'العودة لقائمة المجموعات'
  },

  en: {
    hubTitle: 'Glück – Lernstudio 🇩🇪',
    hubSubtitle: 'German Sets & Classroom Games Studio',
    createSet: 'New Set',
    aiImport: 'AI Generator & Import 🤖',
    library: 'Study Library 📚',
    themePicker: 'Themes',
    searchPlaceholder: 'Search set title, German word, or grade...',
    allLevels: 'All Grades (Grade 1 - 12)',
    allGroups: 'All Classes',
    noSetsFound: 'No learning sets match your search',
    noSetsDesc: 'Create a new set manually or generate one with AI.',

    vocabularyCount: 'words',
    gradeLabel: 'Grade:',
    levelLabel: 'Level:',
    playGame: 'Games & Competitions 🎮🏆',
    teachMode: 'Teach Mode 📖',
    viewWords: 'View Words 👁️',
    wordsModalTitle: 'Set Vocabulary',
    searchWordsPlaceholder: 'Search words...',
    classroomBoard: 'Classroom Board 🏫',
    printWorksheet: 'Worksheet 📄',
    editSet: 'Edit',
    shareWhatsApp: 'Share via WhatsApp',
    duplicateSet: 'Duplicate Set',
    copyJson: 'Copy JSON',
    deleteSet: 'Delete',

    gamesPortalTitle: 'Games & Competitions',
    gamesPortalBack: 'Back',
    teamContestsSection: 'Classroom & Team Contests',
    soloPracticeSection: 'Solo Practice & Games',
    teamLabel: 'Teams',
    soloLabel: 'Solo',
    startBtn: 'Start',
    unavailableBtn: 'Unavailable',
    availableNouns: 'Available',
    noNounsMsg: 'Unavailable (No nouns)',
    classroomQuizTitle: 'Smart Classroom Quiz',
    classroomQuizCategory: 'Class / Group',
    wheelGameTitle: 'Spin Wheel Challenge',
    wheelGameCategory: '2-4 Teams',
    raceGameTitle: 'Team Car Race',
    raceGameCategory: '2-4 Teams',
    teamSentenceTitle: 'Team Sentence Builder',
    teamSentenceCategory: 'Team Contest',
    soloSentenceTitle: 'Sentence Builder & Grammar',
    soloSentenceCategory: 'Solo Practice',
    sortingGameTitle: 'Article Sorting Bins (der/die/das)',
    sortingGameCategory: 'Grammar & Articles',
    memoryGameTitle: 'Memory Match Cards',
    memoryGameCategory: 'Solo / Pair',
    comprehensivePracticeTitle: 'Comprehensive Solo Practice',
    comprehensivePracticeCategory: 'Quick Quiz',
    balloonPopTitle: 'Balloon Pop 🎈',
    balloonPopCategory: 'Solo Speed Challenge',
    tictactoeTitle: 'Word Tic-Tac-Toe ❌⭕',
    tictactoeCategory: 'Team Duel or vs AI',
    basketCatchTitle: 'Vocab Basket Catch 🧺',
    basketCatchCategory: 'Solo Falling Words',
    spaceDefenseTitle: 'Space Defender 🚀',
    spaceDefenseCategory: 'Team or Solo / Blaster',
    wordDetectiveTitle: 'Word Detective 🕵️‍♂️',
    wordDetectiveCategory: 'Letter Guessing & Mystery',
    whackAMoleTitle: 'Whack-A-Word 🔨',
    whackAMoleCategory: 'Solo Reflex Challenge',
    tugOfWarTitle: 'Tug of War 🪢',
    tugOfWarCategory: 'Thrilling Team Pull or vs CPU',
    wordNinjaTitle: 'Word Ninja 🥷',
    wordNinjaCategory: 'Slice & Dice Solo Challenge',
    allEducationalLevels: 'All Educational Levels',
    allTopicsAndCategories: 'All Topics & Categories',
    germanSetsForKids: 'German Sets for Kids',
    curriculumSubtitle: '10 curated vocabulary items per set with audio, translation & examples',
    displayedResults: 'Displayed results:',
    setsUnit: 'sets',
    resetFilters: 'Reset Filters',

    sentenceGameHeader: 'German Sentence Builder Challenge 🧩',
    targetTranslationLabel: 'Target Translation:',
    dragOrTapWords: 'Tap or drag words to construct sentence:',
    undoBtnLabel: 'Undo',
    resetBtnLabel: 'Reset',
    hintBtnLabel: 'Hint',
    nextQuestionBtn: 'Next Question',
    sentenceVictoryTitle: 'Great job! Completed Sentence Builder! 🎉',

    sortingGameHeader: 'Article Sorting Bins (der / die / das) 📦',
    sortingSubTitle: 'Drag word or tap matching bin:',
    sortingEmptyWarning: 'Sorry, this set does not contain nouns with articles for the sorting game.',

    teachModeTitle: 'Presentation & Teach Mode 📖',
    prevSlide: 'Previous',
    nextSlide: 'Next',
    showTranslation: 'Show Translation',
    hideTranslation: 'Hide Translation',
    listenAudio: 'Listen 🔊',
    worksheetModalTitle: 'Print Interactive Worksheet 📄',
    printBtn: 'Print 🖨️',
    downloadPdf: 'Download PDF 📥',

    boardTitle: 'Competitive Classroom Board Setup (Baamboozle Style) 🎮',
    selectGameMode: '1. Select Game Mode:',
    modeClassicTitle: 'Baamboozle Classic 🚀',
    modeClassicDesc: 'Questions + Power Cards (Steal, Free Gift, Rocket & Double).',
    modeQuizTitle: 'Quiz Mode ❓',
    modeQuizDesc: 'Questions only without surprise power cards.',
    modePartyTitle: 'Party Mode ⚡',
    modePartyDesc: 'Fast surprise power cards for class fun.',

    selectGroupHeader: '2. Choose Class & Students from App:',
    currentClassBtn: 'Current Active Class ⚡',
    currentClassActiveNote: 'Auto-detected active scheduled class based on current time!',
    noCurrentClassFound: 'No class scheduled right now. Please select a group manually.',
    filterByDay: 'Day:',
    filterByTime: 'Time:',
    allDays: 'All Days',
    allTimes: 'All Times',
    morningTime: 'Morning (8-12)',
    afternoonTime: 'Afternoon (12-5)',
    eveningTime: 'Evening (5+)',

    playStyleHeader: '3. Team Setup & Roster Mode:',
    splitGroupTeams: 'Split Class into Balanced Teams',
    individualStudents: 'Individual Student Mode (1 Card per Student)',
    customTeams: 'Custom Color Teams',
    teamsCount: 'Number of Teams:',
    tilesCount: '4. Number of Board Tiles:',
    timerSettingLabel: '5. Question Timer:',
    noTimer: 'No Timer (Unlimited)',
    launchBoardBtn: 'Launch Classroom Board 🚀',

    remainingTiles: 'Remaining:',
    undoBtn: 'Undo',
    fullscreen: 'Fullscreen',
    minimize: 'Exit Fullscreen',
    settingsBtn: 'Settings',
    endGameBtn: 'End Game',
    currentTurn: 'Current Turn:',
    scorePts: 'Score:',
    applyPowerupBtn: 'Apply Power-up & Continue!',
    showAnswerBtn: 'Show Answer',
    correctAnswerLabel: 'Correct Answer:',
    correctBtn: 'Correct (Okay)',
    wrongBtn: 'Incorrect (Oops)',
    secondsText: 'sec',
    winnerTitle: 'Game Over - Final Results',
    winnerFirstPlace: 'Winner:',
    winnerScore: 'Score:',
    playNewGame: 'Play New Game',
    adjustSettings: 'Adjust Setup',

    powerGiftTitle: 'Free Gift! 🎁',
    powerGiftDesc: 'Your team gets +25 free points without answering!',
    powerStealTitle: 'Steal Points! 🏴‍☠️',
    powerStealDesc: 'Steal 15 points instantly from the rival team!',
    powerSwapTitle: 'Swap Scores! 🔄',
    powerSwapDesc: 'Game changer! Swap your total score with the rival team!',
    powerRocketTitle: 'Rocket Boost! 🚀',
    powerRocketDesc: 'Rocket jump to 1st place with +10 bonus points!',
    powerBombTitle: 'Bomb Explosion! 💥',
    powerBombDesc: 'Bad luck! Lose 15 points from your team!',
    powerZeroTitle: 'Magic Eraser! 🧹',
    powerZeroDesc: 'Oh no! Reset your team score to 0!',
    powerDoubleTitle: 'Golden Double! 🌟',
    powerDoubleDesc: 'Double your team score x2!',
    powerGiveTitle: 'Kindness Gift! 💖',
    powerGiveDesc: 'Gift 15 points to the other team!',
    powerSkipTitle: 'Lazy Crocodile! 🐊',
    powerSkipDesc: 'No question, but skip turn with 0 points!',

    tabMultipleChoice: '1. Multiple Choice 📝',
    tabMissingLetter: '2. Missing Letter 🔤',
    tabSentenceBuilder: '3. Sentence Builder (4) 🧩',
    tabEmojiVocab: '4. Emoji Vocab 😃',
    tabScrambledLetters: '5. Scrambled Letters 🔀',
    pointsLabel: 'Points:',
    streakLabel: 'Streak:',
    questionProgress: 'Question',
    mcPrompt: 'Choose the correct German word:',
    missingLetterPrompt: 'Enter the missing letter or full German word:',
    sentenceBuilderPrompt: 'Arrange the 4 parts to form a correct German sentence:',
    emojiVocabPrompt: 'Type the matching German word for the emoji:',
    scrambledPrompt: 'Unscramble letters to spell the German word:',
    checkAnswerBtn: 'Check Answer ✓',
    teacherPassBtn: 'Teacher Pass',
    rightAnswerMsg: 'Richtig! Excellent answer 👏',
    wrongAnswerMsg: 'Incorrect. The correct German word is:',
    perfectSentenceMsg: 'Perfekt! Correct German sentence 🌟',
    reorderSolutionMsg: 'Recommended order:',
    targetWordMsg: 'Target word:',
    completedGameTitle: 'Great job! Practice completed 🎉',
    completedGameDesc: 'You achieved a great score in this topic.',
    restartGameBtn: 'Play Again',
    returnToSetsBtn: 'Back to Sets'
  },

  de: {
    hubTitle: 'Glück – Lernstudio 🇩🇪',
    hubSubtitle: 'Studio für Deutsch-Lernsets & Klassenspiele',
    createSet: 'Neues Set',
    aiImport: 'KI Generator & Import 🤖',
    library: 'Lernbibliothek 📚',
    themePicker: 'Designs',
    searchPlaceholder: 'Suche nach Thema, deutschem Wort oder Klasse...',
    allLevels: 'Alle Klassen (Klasse 1 - 12)',
    allGroups: 'Alle Klassen',
    noSetsFound: 'Keine Lernsets entsprechen deiner Suche',
    noSetsDesc: 'Erstelle manuell ein neues Set oder generiere eines mit KI.',

    vocabularyCount: 'Wörter',
    gradeLabel: 'Klasse:',
    levelLabel: 'Niveau:',
    playGame: 'Spiele & Wettbewerbe 🎮🏆',
    teachMode: 'Lehrmodus 📖',
    viewWords: 'Wörter anzeigen 👁️',
    wordsModalTitle: 'Vokabelliste des Sets',
    searchWordsPlaceholder: 'Wörter suchen...',
    classroomBoard: 'Klassenzimmer-Spiel 🏫',
    printWorksheet: 'Arbeitsblatt 📄',
    editSet: 'Bearbeiten',
    shareWhatsApp: 'Auf WhatsApp teilen',
    duplicateSet: 'Set duplizieren',
    copyJson: 'JSON kopieren',
    deleteSet: 'Löschen',

    gamesPortalTitle: 'Spiele & Wettbewerbe',
    gamesPortalBack: 'Zurück',
    teamContestsSection: 'Klassenzimmer- & Team-Wettbewerbe',
    soloPracticeSection: 'Einzelübungen & Spiele',
    teamLabel: 'Teams',
    soloLabel: 'Einzel',
    startBtn: 'Starten',
    unavailableBtn: 'Inaktiv',
    availableNouns: 'Verfügbar',
    noNounsMsg: 'Nicht verfügbar (Keine Nomen)',
    classroomQuizTitle: 'Smartes Klassenzimmer-Quiz',
    classroomQuizCategory: 'Klasse / Gruppe',
    wheelGameTitle: 'Glücksrad-Challenge',
    wheelGameCategory: '2-4 Teams',
    raceGameTitle: 'Team-Auto-Rennen',
    raceGameCategory: '2-4 Teams',
    teamSentenceTitle: 'Team-Satzbau-Challenge',
    teamSentenceCategory: 'Teamwettbewerb',
    soloSentenceTitle: 'Satzbau & Grammatik',
    soloSentenceCategory: 'Einzelübung',
    sortingGameTitle: 'Artikel Sortieren (der / die / das)',
    sortingGameCategory: 'Grammatik & Artikel',
    memoryGameTitle: 'Memory-Karten',
    memoryGameCategory: 'Einzel / Paar',
    comprehensivePracticeTitle: 'Umfassendes Einzel-Training',
    comprehensivePracticeCategory: 'Schnell-Quiz',
    balloonPopTitle: 'Ballon-Platzer 🎈',
    balloonPopCategory: 'Einzelschnelligkeit',
    tictactoeTitle: 'Wort-Tic-Tac-Toe ❌⭕',
    tictactoeCategory: 'Teamduell oder gegen KI',
    basketCatchTitle: 'Wort-Korb Fangen 🧺',
    basketCatchCategory: 'Einzel-Regen-Spiel',
    spaceDefenseTitle: 'Weltraum-Verteidiger 🚀',
    spaceDefenseCategory: 'Team oder Einzeln / Shooter',
    wordDetectiveTitle: 'Wort-Detektiv 🕵️‍♂️',
    wordDetectiveCategory: 'Buchstabenrätsel',
    whackAMoleTitle: 'Hau-den-Maulwurf 🔨',
    whackAMoleCategory: 'Reflex-Spiel',
    tugOfWarTitle: 'Tauziehen-Duell 🪢',
    tugOfWarCategory: 'Spannender Team-Wettkampf',
    wordNinjaTitle: 'Wort-Ninja 🥷',
    wordNinjaCategory: 'Schneide-Challenge',
    allEducationalLevels: 'Alle Bildungsstufen',
    allTopicsAndCategories: 'Alle Themen & Kategorien',
    germanSetsForKids: 'Deutsche Lernsets für Kinder',
    curriculumSubtitle: '10 ausgewählte Vokabeln pro Set mit Audio, Übersetzung & Beispielen',
    displayedResults: 'Angezeigte Ergebnisse:',
    setsUnit: 'Sets',
    resetFilters: 'Filter zurücksetzen',

    sentenceGameHeader: 'Deutscher Satzbau-Challenge 🧩',
    targetTranslationLabel: 'Zielübersetzung:',
    dragOrTapWords: 'Wörter antippen oder ziehen, um Satz zu bauen:',
    undoBtnLabel: 'Rückgängig',
    resetBtnLabel: 'Zurücksetzen',
    hintBtnLabel: 'Hinweis',
    nextQuestionBtn: 'Nächste Frage',
    sentenceVictoryTitle: 'Super! Satzbau-Challenge bestanden! 🎉',

    sortingGameHeader: 'Artikel Sortierboxen (der / die / das) 📦',
    sortingSubTitle: 'Ziehe das Wort oder tippe auf die richtige Box:',
    sortingEmptyWarning: 'Entschuldigung, dieses Set enthält keine Nomen mit Artikeln für das Sortierspiel.',

    teachModeTitle: 'Präsentations- & Lehrmodus 📖',
    prevSlide: 'Zurück',
    nextSlide: 'Weiter',
    showTranslation: 'Übersetzung anzeigen',
    hideTranslation: 'Übersetzung verbergen',
    listenAudio: 'Anhören 🔊',
    worksheetModalTitle: 'Interaktives Arbeitsblatt drucken 📄',
    printBtn: 'Drucken 🖨️',
    downloadPdf: 'PDF herunterladen 📥',

    boardTitle: 'Klassenzimmer-Tafelspiel Setup (Baamboozle Style) 🎮',
    selectGameMode: '1. Spielmodus wählen:',
    modeClassicTitle: 'Baamboozle Classic 🚀',
    modeClassicDesc: 'Fragen + Überraschungskarten (Punkte stehlen, Geschenk, Rakete).',
    modeQuizTitle: 'Quiz-Modus ❓',
    modeQuizDesc: 'Nur Fragen ohne Überraschungskarten.',
    modePartyTitle: 'Party-Modus ⚡',
    modePartyDesc: 'Schnelle Überraschungskarten für Spaß in der Klasse.',

    selectGroupHeader: '2. Klasse & Schüler auswählen:',
    currentClassBtn: 'Aktuelle Gruppe nach Zeit ⚡',
    currentClassActiveNote: 'Automatisch erkannte aktive Gruppe basierend auf der Uhrzeit!',
    noCurrentClassFound: 'Derzeit ist keine Unterrichtsstunde angesetzt. Bitte wähle eine Gruppe manuell aus.',
    filterByDay: 'Tag:',
    filterByTime: 'Zeit:',
    allDays: 'Alle Tage',
    allTimes: 'Alle Zeiten',
    morningTime: 'Morgens (8-12)',
    afternoonTime: 'Nachmittags (12-5)',
    eveningTime: 'Abends (5+)',

    playStyleHeader: '3. Team-Aufteilung & Schülermodus:',
    splitGroupTeams: 'Klasse in ausgewogene Teams aufteilen',
    individualStudents: 'Einzelner Schülermodus (1 Karte pro Schüler)',
    customTeams: 'Eigene Farbteams',
    teamsCount: 'Anzahl der Teams:',
    tilesCount: '4. Anzahl der Kacheln:',
    timerSettingLabel: '5. Timer pro Frage:',
    noTimer: 'Kein Timer (Unbegrenzt)',
    launchBoardBtn: 'Tafelspiel starten 🚀',

    remainingTiles: 'Verbleibend:',
    undoBtn: 'Rückgängig',
    fullscreen: 'Vollbild',
    minimize: 'Vollbild beenden',
    settingsBtn: 'Einstellungen',
    endGameBtn: 'Spiel beenden',
    currentTurn: 'Am Zug ist:',
    scorePts: 'Punkte:',
    applyPowerupBtn: 'Überraschung anwenden!',
    showAnswerBtn: 'Antwort anzeigen',
    correctAnswerLabel: 'Richtige Antwort:',
    correctBtn: 'Richtig (Okay)',
    wrongBtn: 'Falsch (Oops)',
    secondsText: 'Sek',
    winnerTitle: 'Spielende - Endergebnis',
    winnerFirstPlace: 'Gewinner:',
    winnerScore: 'Punkte:',
    playNewGame: 'Neues Spiel',
    adjustSettings: 'Setup anpassen',

    powerGiftTitle: 'Kostenloses Geschenk! 🎁',
    powerGiftDesc: 'Dein Team erhält +25 Punkte gratis!',
    powerStealTitle: 'Punkte stehlen! 🏴‍☠️',
    powerStealDesc: 'Stehle dem Gegner-Team sofort 15 Punkte!',
    powerSwapTitle: 'Punkte tauschen! 🔄',
    powerSwapDesc: 'Überraschung! Tausche das Gesamtergebnis mit dem Gegner-Team!',
    powerRocketTitle: 'Raketenstart! 🚀',
    powerRocketDesc: 'Sprung auf Platz 1 mit +10 Bonuspunkten!',
    powerBombTitle: 'Bombenexplosion! 💥',
    powerBombDesc: 'Pech gehabt! -15 Punkte für dein Team!',
    powerZeroTitle: 'Zauberschwamm! 🧹',
    powerZeroDesc: 'Oh nein! Punktestand auf 0 zurückgesetzt!',
    powerDoubleTitle: 'Goldene Verdopplung! 🌟',
    powerDoubleDesc: 'Verdopple den Punktestand deines Teams x2!',
    powerGiveTitle: 'Großzügiges Geschenk! 💖',
    powerGiveDesc: 'Schenke dem anderen Team 15 Punkte!',
    powerSkipTitle: 'Faules Krokodil! 🐊',
    powerSkipDesc: 'Keine Frage, aber Aussetzen ohne Punkte!',

    tabMultipleChoice: '1. Mehrfachauswahl 📝',
    tabMissingLetter: '2. Fehlender Buchstabe 🔤',
    tabSentenceBuilder: '3. Satzbau (4) 🧩',
    tabEmojiVocab: '4. Emoji-Rätsel 😃',
    tabScrambledLetters: '5. Buchstabensalat 🔀',
    pointsLabel: 'Punkte:',
    streakLabel: 'Serie:',
    questionProgress: 'Frage',
    mcPrompt: 'Wähle das richtige deutsche Wort:',
    missingLetterPrompt: 'Gib den fehlenden Buchstaben oder das ganze Wort ein:',
    sentenceBuilderPrompt: 'Bringe die 4 Teile in die richtige Reihenfolge:',
    emojiVocabPrompt: 'Schreibe das passende deutsche Wort zum Emoji:',
    scrambledPrompt: 'Ordne die Buchstaben zu einem deutschen Wort:',
    checkAnswerBtn: 'Antwort prüfen ✓',
    teacherPassBtn: 'Lehrer-Freigabe',
    rightAnswerMsg: 'Richtig! Hervorragende Antwort 👏',
    wrongAnswerMsg: 'Falsch. Das richtige deutsche Wort lautet:',
    perfectSentenceMsg: 'Perfekt! Korrekter deutscher Satz 🌟',
    reorderSolutionMsg: 'Empfohlene Reihenfolge:',
    targetWordMsg: 'Zielwort:',
    completedGameTitle: 'Super! Übung erfolgreich beendet 🎉',
    completedGameDesc: 'Du hast ein tolles Ergebnis erzielt.',
    restartGameBtn: 'Erneut spielen',
    returnToSetsBtn: 'Zurück zu den Sets'
  }
};

export function getLernstudioTranslations(lang?: string): LernstudioTranslations {
  const safeLang = (lang || 'ar').toLowerCase() as AppLanguage;
  return translations[safeLang] || translations.ar;
}

export function getLocalizedGrade(grade?: string, lang?: string): string {
  if (!grade) return '';
  const safeLang = (lang || 'ar').toLowerCase() as AppLanguage;
  if (safeLang === 'ar') return grade;

  const categoryMap: Record<string, { en: string; de: string }> = {
    'المستوى الأول: الكلمات الأساسية': { en: 'Level 1: Essential Words', de: 'Stufe 1: Grundwortschatz' },
    'المستوى الثاني: الطفل والبيت': { en: 'Level 2: Child & Home', de: 'Stufe 2: Kind & Zuhause' },
    'المستوى الثالث: الطعام والحيوانات': { en: 'Level 3: Food & Animals', de: 'Stufe 3: Essen & Tiere' },
    'المستوى الرابع: الحياة اليومية': { en: 'Level 4: Daily Life', de: 'Stufe 4: Alltag' },
    'المستوى الخامس: العالم من حولنا': { en: 'Level 5: The World Around Us', de: 'Stufe 5: Welt um uns herum' },
    'المستوى السادس: الأفعال والصفات والمفاهيم': { en: 'Level 6: Verbs, Adjectives & Concepts', de: 'Stufe 6: Verben, Adjektive & Konzepte' },
    'المستوى السابع: موضوعات إضافية للأنشطة': { en: 'Level 7: Activity Topics', de: 'Stufe 7: Weitere Themen & Aktivitäten' }
  };

  for (const [key, val] of Object.entries(categoryMap)) {
    if (grade.includes(key)) {
      return grade.replace(key, val[safeLang as 'en' | 'de'] || key);
    }
  }

  return grade;
}

export function getLocalizedSetTitle(set?: Partial<LernstudioSet> | null, lang?: string): string {
  if (!set) return '';
  const safeLang = (lang || 'ar').toLowerCase() as AppLanguage;
  if (set.titleTranslations && set.titleTranslations[safeLang]) {
    return set.titleTranslations[safeLang]!;
  }
  let title = set.title || set.topic || '';
  if (safeLang === 'en') {
    title = title.replace(/\(نسخة\)/g, '(Copy)');
  } else if (safeLang === 'ar') {
    title = title.replace(/\(Copy\)/g, '(نسخة)');
  }
  return title;
}

export function getLocalizedSetTopic(set?: Partial<LernstudioSet> | null, lang?: string): string {
  if (!set) return '';
  const safeLang = (lang || 'ar').toLowerCase() as AppLanguage;
  
  if (set.topicTranslations && set.topicTranslations[safeLang]) {
    return set.topicTranslations[safeLang]!;
  }
  
  const rawTopic = set.topic || set.title || '';
  if (safeLang === 'ar') return rawTopic;

  const topicDictionary: Record<string, { en: string; de: string }> = {
    'التحيات والوداع': { en: 'Greetings & Farewells', de: 'Begrüßungen & Verabschiedungen' },
    'Begrüßungen und Verabschiedungen': { en: 'Greetings & Farewells', de: 'Begrüßungen und Verabschiedungen' },
    'الألوان': { en: 'Colors', de: 'Farben' },
    'Farben': { en: 'Colors', de: 'Farben' },
    'الأرقام': { en: 'Numbers', de: 'Zahlen' },
    'Zahlen': { en: 'Numbers', de: 'Zahlen' },
    'العائلة': { en: 'Family', de: 'Familie' },
    'Meine Familie': { en: 'My Family', de: 'Meine Familie' },
    'الجسم': { en: 'Body', de: 'Körper' },
    'Mein Körper': { en: 'My Body', de: 'Mein Körper' },
    'الحيوانات': { en: 'Animals', de: 'Tiere' },
    'Tiere': { en: 'Animals', de: 'Tiere' },
    'الطعام': { en: 'Food', de: 'Essen' },
    'Lebensmittel': { en: 'Food', de: 'Lebensmittel' },
    'الملابس': { en: 'Clothing', de: 'Kleidung' },
    'Kleidung': { en: 'Clothing', de: 'Kleidung' },
    'البيت': { en: 'Home', de: 'Zuhause' },
    'Mein Zuhause': { en: 'My Home', de: 'Mein Zuhause' },
    'المدرسة': { en: 'School', de: 'Schule' },
    'Schule': { en: 'School', de: 'Schule' },
    'الوقت': { en: 'Time', de: 'Uhrzeit' },
    'Die Uhrzeit': { en: 'Time', de: 'Die Uhrzeit' },
    'الطقس': { en: 'Weather', de: 'Wetter' },
    'Das Wetter': { en: 'Weather', de: 'Das Wetter' }
  };

  if (topicDictionary[rawTopic]) {
    return topicDictionary[rawTopic][safeLang as 'en' | 'de'] || rawTopic;
  }

  return rawTopic;
}

export function getLocalizedSetDescription(set?: Partial<LernstudioSet> | null, lang?: string): string {
  if (!set || !set.description) return '';
  const safeLang = (lang || 'ar').toLowerCase() as AppLanguage;
  
  if (set.descriptionTranslations && set.descriptionTranslations[safeLang]) {
    return set.descriptionTranslations[safeLang]!;
  }
  
  const rawDesc = set.description;
  if (safeLang === 'ar') return rawDesc;

  const descMap: Record<string, { en: string; de: string }> = {
    'تعلم أهم عبارات التحية والوداع باللغة الألمانية للأطفال.': {
      en: 'Learn essential German greetings and farewells for kids.',
      de: 'Lerne die wichtigsten deutschen Begrüßungs- und Verabschiedungsformeln für Kinder.'
    }
  };

  if (descMap[rawDesc]) {
    return descMap[rawDesc][safeLang as 'en' | 'de'] || rawDesc;
  }

  return rawDesc;
}

export interface ProgramGrade {
  id: string;
  num: number;
  labelAr: string;
  labelEn: string;
  labelDe: string;
  keywords: string[];
}

export const PROGRAM_GRADES: ProgramGrade[] = [
  { id: 'preschool', num: 0, labelAr: 'روضة أطفال (Preschool / KG)', labelEn: 'Preschool / KG', labelDe: 'Vorschule / Kindergarten', keywords: ['روضة', 'تمهيدي', 'preschool', 'kg', 'vorschule'] },
  { id: 'grade_1', num: 1, labelAr: 'جريد 1 (الصف الأول)', labelEn: 'Grade 1', labelDe: 'Klasse 1', keywords: ['1', 'الأول', 'الاول', 'المستوى الأول', 'grade 1'] },
  { id: 'grade_2', num: 2, labelAr: 'جريد 2 (الصف الثاني)', labelEn: 'Grade 2', labelDe: 'Klasse 2', keywords: ['2', 'الثاني', 'المستوى الثاني', 'grade 2'] },
  { id: 'grade_3', num: 3, labelAr: 'جريد 3 (الصف الثالث)', labelEn: 'Grade 3', labelDe: 'Klasse 3', keywords: ['3', 'الثالث', 'المستوى الثالث', 'grade 3'] },
  { id: 'grade_4', num: 4, labelAr: 'جريد 4 (الصف الرابع)', labelEn: 'Grade 4', labelDe: 'Klasse 4', keywords: ['4', 'الرابع', 'المستوى الرابع', 'grade 4'] },
  { id: 'grade_5', num: 5, labelAr: 'جريد 5 (الصف الخامس)', labelEn: 'Grade 5', labelDe: 'Klasse 5', keywords: ['5', 'الخامس', 'المستوى الخامس', 'grade 5'] },
  { id: 'grade_6', num: 6, labelAr: 'جريد 6 (الصف السادس)', labelEn: 'Grade 6', labelDe: 'Klasse 6', keywords: ['6', 'السادس', 'المستوى السادس', 'grade 6'] },
  { id: 'level_a1', num: 101, labelAr: 'مستوى مبتدئ (A1)', labelEn: 'Beginner A1', labelDe: 'Anfänger A1', keywords: ['a1', 'مبتدئ', 'beginner'] },
  { id: 'level_a2', num: 102, labelAr: 'مستوى أساسي (A2)', labelEn: 'Elementary A2', labelDe: 'Grundstufe A2', keywords: ['a2', 'أساسي', 'elementary'] },
];

export function matchesGradeFilter(set: Partial<LernstudioSet>, gradeFilterId: string): boolean {
  if (!gradeFilterId || gradeFilterId === 'all') return true;

  if (gradeFilterId === 'preschool') {
    const text = `${set.grade || ''} ${set.title || ''}`.toLowerCase();
    return text.includes('روضة') || text.includes('preschool') || text.includes('vorschule');
  }
  if (gradeFilterId === 'level_a1') {
    return set.level === 'A1' || (set.grade || '').toLowerCase().includes('a1');
  }
  if (gradeFilterId === 'level_a2') {
    return set.level === 'A2' || (set.grade || '').toLowerCase().includes('a2');
  }

  const targetGrade = PROGRAM_GRADES.find((g) => g.id === gradeFilterId);
  if (!targetGrade) return true;

  const setGrade = (set.grade || '').toLowerCase();
  const setTitle = (set.title || '').toLowerCase();
  const setTopic = (set.topic || '').toLowerCase();
  const fullText = `${setGrade} ${setTitle} ${setTopic}`;

  return (
    targetGrade.keywords.some((kw) => fullText.includes(kw.toLowerCase())) ||
    fullText.includes(`grade ${targetGrade.num}`) ||
    fullText.includes(`جريد ${targetGrade.num}`) ||
    fullText.includes(`klasse ${targetGrade.num}`)
  );
}
