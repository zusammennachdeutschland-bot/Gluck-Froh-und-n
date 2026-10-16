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
  classroomBoard: string;
  printWorksheet: string;
  editSet: string;
  copyJson: string;
  deleteSet: string;

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
    allLevels: 'جميع المستويات',
    allGroups: 'جميع المجموعات',
    noSetsFound: 'لا توجد مجموعات تعليمية تطابق البحث',
    noSetsDesc: 'يمكنك إنشاء مجموعة جديدة يدويًا أو توليدها عبر الذكاء الاصطناعي.',

    vocabularyCount: 'مفردات',
    gradeLabel: 'الصف:',
    levelLabel: 'المستوى:',
    playGame: 'الألعاب والتدريبات 🎮',
    classroomBoard: 'لعبة السبورة 🏫',
    printWorksheet: 'ورقة عمل 📄',
    editSet: 'تعديل',
    copyJson: 'نسخ JSON',
    deleteSet: 'حذف',

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
    allLevels: 'All Levels',
    allGroups: 'All Classes',
    noSetsFound: 'No learning sets match your search',
    noSetsDesc: 'Create a new set manually or generate one with AI.',

    vocabularyCount: 'words',
    gradeLabel: 'Grade:',
    levelLabel: 'Level:',
    playGame: 'Practice & Games 🎮',
    classroomBoard: 'Classroom Board 🏫',
    printWorksheet: 'Worksheet 📄',
    editSet: 'Edit',
    copyJson: 'Copy JSON',
    deleteSet: 'Delete',

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
    allLevels: 'Alle Niveaus',
    allGroups: 'Alle Klassen',
    noSetsFound: 'Keine Lernsets entsprechen deiner Suche',
    noSetsDesc: 'Erstelle manuell ein neues Set oder generiere eines mit KI.',

    vocabularyCount: 'Wörter',
    gradeLabel: 'Klasse:',
    levelLabel: 'Niveau:',
    playGame: 'Übungen & Spiele 🎮',
    classroomBoard: 'Klassenzimmer-Spiel 🏫',
    printWorksheet: 'Arbeitsblatt 📄',
    editSet: 'Bearbeiten',
    copyJson: 'JSON kopieren',
    deleteSet: 'Löschen',

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
