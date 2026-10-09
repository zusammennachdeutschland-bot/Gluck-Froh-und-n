/**
 * Utility functions to generate dynamic time-based greetings in Arabic, German, and English
 * based on current Cairo / local time.
 */

export function getCairoHour(): number {
  try {
    const cairoStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo', hour: '2-digit', hour12: false });
    const parsed = parseInt(cairoStr, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
      return parsed;
    }
  } catch {
    // Fallback to local system time
  }
  return new Date().getHours();
}

export function isMorningTime(): boolean {
  return getCairoHour() < 12;
}

export function isEveningTime(): boolean {
  return getCairoHour() >= 17;
}

/**
 * Returns appropriate greeting string for the current time of day in the specified language
 */
export function getTimeBasedGreeting(
  lang: 'ar' | 'en' | 'de' = 'ar',
  options: {
    style?: 'egyptian' | 'standard';
    recipientName?: string;
    isGroup?: boolean;
  } = {}
): string {
  const hour = getCairoHour();
  const isMorning = hour < 12;
  const isAfternoon = hour >= 12 && hour < 17;
  const isLateEvening = hour >= 17;
  const { style = 'egyptian', recipientName, isGroup = false } = options;

  if (lang === 'de') {
    const timeWord = isMorning ? 'Guten Morgen' : (hour < 18 ? 'Guten Tag' : 'Guten Abend');
    if (isGroup) {
      return `${timeWord} zusammen 👋`;
    }
    if (recipientName) {
      return `${timeWord} ${recipientName}! 👋`;
    }
    return `${timeWord}! Herzliche Grüße 👋`;
  }

  if (lang === 'en') {
    const timeWord = isMorning ? 'Good morning' : (isAfternoon ? 'Good afternoon' : 'Good evening');
    if (isGroup) {
      return `${timeWord} everyone 👋`;
    }
    if (recipientName) {
      return `${timeWord}, ${recipientName}! 👋`;
    }
    return `${timeWord} / Greetings 👋`;
  }

  // Arabic
  if (style === 'egyptian') {
    if (isGroup) {
      return isMorning ? 'صباح الخير بحضراتكم جميعاً 👋' : 'أهلاً بحضراتكم جميعاً يا فندم 👋';
    }
    if (recipientName) {
      return isMorning ? `صباح الخير ${recipientName} 👋` : `أهلاً بحضرتك ${recipientName} 👋`;
    }
    return isMorning ? 'صباح الخير يا فندم 👋' : 'أهلاً بحضرتك يا فندم 👋';
  }

  // Standard Arabic
  if (isGroup) {
    return isMorning
      ? 'السلام عليكم ورحمة الله وبركاته.. صباح الخير والبركة جميعاً 👋'
      : 'السلام عليكم ورحمة الله وبركاته.. مساء الخير والبركة جميعاً 👋';
  }
  if (recipientName) {
    return isMorning
      ? `السلام عليكم ورحمة الله وبركاته ${recipientName} 👋`
      : `السلام عليكم ورحمة الله وبركاته ${recipientName} 👋`;
  }
  return isMorning
    ? 'السلام عليكم ورحمة الله وبركاته.. صباح الخير 👋'
    : 'السلام عليكم ورحمة الله وبركاته.. مساء الخير 👋';
}
