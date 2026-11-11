import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { APP_BUILD_VERSION } from '../types';

declare const __APP_VERSION__: string | undefined;
declare const __APP_BUILD_NUMBER__: string | undefined;
declare const __APP_BUILD_TIME__: string | undefined;

// Unified canonical application version across package.json, sync protocol (APP_BUILD_VERSION), and Android (versionName)
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : APP_BUILD_VERSION;

export const APP_BUILD_NUMBER: string =
  typeof __APP_BUILD_NUMBER__ !== 'undefined' ? __APP_BUILD_NUMBER__ : '300';

export const APP_BUILD_TIME_ISO: string =
  typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : new Date().toISOString();

export interface AppBuildInfo {
  version: string;
  build: string;
  buildTimeIso: string;
  isNative: boolean;
}

export async function getRuntimeAppInfo(): Promise<AppBuildInfo> {
  let version = APP_VERSION;
  let build = APP_BUILD_NUMBER;
  let isNative = false;

  try {
    if (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
      isNative = true;
      const info = await CapacitorApp.getInfo();
      if (info?.build) {
        build = String(info.build);
      }
      if (info?.version) {
        version = String(info.version);
      }
    }
  } catch {
    // Ignore native plugin failure in non-native or test environments
  }

  return {
    version,
    build,
    buildTimeIso: APP_BUILD_TIME_ISO,
    isNative
  };
}

export function formatAppBuildTimestamp(language: string = 'ar', timestampIso: string = APP_BUILD_TIME_ISO): string {
  try {
    const d = new Date(timestampIso);
    if (isNaN(d.getTime())) return timestampIso;
    const locale = language === 'ar' ? 'ar-EG' : language === 'de' ? 'de-DE' : 'en-GB';
    return d.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return timestampIso;
  }
}


