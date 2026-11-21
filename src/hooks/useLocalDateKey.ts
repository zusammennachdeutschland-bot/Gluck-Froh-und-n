import { useEffect, useState } from 'react';
import { formatLocalDate } from '../utils/timeUtils';

/**
 * Returns the local date key for today (or an offset day) and refreshes while the app
 * remains open, including after the device wakes from sleep.
 */
export const useLocalDateKey = (dayOffset = 0): string => {
  const getDateKey = () => {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return formatLocalDate(date);
  };

  const [dateKey, setDateKey] = useState(getDateKey);

  useEffect(() => {
    const refresh = () => setDateKey(getDateKey());
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [dayOffset]);

  return dateKey;
};
