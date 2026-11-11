import { APP_BUILD_VERSION } from '../types';

// Unified canonical application version across package.json, sync protocol (APP_BUILD_VERSION), and Android (versionName)
export const APP_VERSION: string = APP_BUILD_VERSION;
export const APP_BUILD_NUMBER: string = '300';
export const APP_BUILD_TIME_ISO: string = '2026-11-11T15:30:00.000Z';

export function formatAppBuildTimestamp(language: string = 'ar'): string {
  try {
    const d = new Date(APP_BUILD_TIME_ISO);
    if (isNaN(d.getTime())) return APP_BUILD_TIME_ISO;
    const locale = language === 'ar' ? 'ar-EG' : language === 'de' ? 'de-DE' : 'en-GB';
    return d.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return APP_BUILD_TIME_ISO;
  }
}

