import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { analyzeBuddyWorkload } from '../services/buddy/buddyWorkload';
import { BuddyWorkloadResult } from '../types/buddy';
import { formatLocalDate } from '../utils/timeUtils';

export function useGlueckBuddy() {
  const { lessons, students, payments, todos, notifications, language } = useApp();
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const [showAutoGreeting, setShowAutoGreeting] = useState(false);

  const workload: BuddyWorkloadResult = useMemo(() => {
    return analyzeBuddyWorkload(lessons, students, payments, todos, notifications, language || 'de');
  }, [lessons, students, payments, todos, notifications, language]);

  // Check morning auto-briefing flag
  useEffect(() => {
    const today = formatLocalDate(new Date());
    const key = `buddyMorningBriefShown_${today}`;
    const shown = localStorage.getItem(key);
    const currentHour = new Date().getHours();

    if (!shown && currentHour >= 7 && currentHour <= 10 && workload.briefMode === 'morning') {
      setShowAutoGreeting(true);
      localStorage.setItem(key, 'true');
      // Auto hide greeting bubble after 8 seconds
      const timer = setTimeout(() => {
        setShowAutoGreeting(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [workload.briefMode]);

  const openBrief = useCallback(() => {
    setIsBriefOpen(true);
    setShowAutoGreeting(false);
  }, []);

  const closeBrief = useCallback(() => {
    setIsBriefOpen(false);
  }, []);

  return {
    workload,
    isBriefOpen,
    openBrief,
    closeBrief,
    showAutoGreeting,
    setShowAutoGreeting
  };
}
