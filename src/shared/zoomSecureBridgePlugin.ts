import { registerPlugin } from '@capacitor/core';

export interface ZoomNativeResponse {
  ok: boolean;
  httpStatus?: number;
  code?: string;
  error?: string;
  retryAfter?: string;
  [key: string]: any;
}

export interface ZoomSecureBridgePlugin {
  getStatus(): Promise<ZoomNativeResponse>;
  connect(options: {
    accountId: string;
    clientId: string;
    clientSecret: string;
    defaultTimezone?: string;
  }): Promise<ZoomNativeResponse>;
  testConnection(): Promise<ZoomNativeResponse>;
  updateSettings(options: { defaultTimezone: string }): Promise<ZoomNativeResponse>;
  disconnect(): Promise<ZoomNativeResponse>;
  createMeeting(options: {
    topic: string;
    startTime: string;
    duration: number;
    timezone?: string;
    weeklyDay: number;
    repeatInterval?: number;
    waitingRoom?: boolean;
    autoRecording?: string;
  }): Promise<ZoomNativeResponse>;
  updateMeeting(options: {
    meetingId: string;
    topic?: string;
    startTime?: string;
    duration: number;
    timezone?: string;
    weeklyDay: number;
    repeatInterval?: number;
    waitingRoom?: boolean;
  }): Promise<ZoomNativeResponse>;
  getMeeting(options: { meetingId: string }): Promise<ZoomNativeResponse>;
  deleteMeeting(options: { meetingId: string }): Promise<ZoomNativeResponse>;
  listMeetings?(options?: {
    type?: 'scheduled' | 'live' | 'upcoming';
    pageSize?: number;
    nextPageToken?: string;
  }): Promise<ZoomNativeResponse>;
}

const NativeZoomSecureBridge = registerPlugin<ZoomSecureBridgePlugin>('ZoomSecureBridge');

export interface ZoomNativeTestAdapter {
  isAndroidNative?: () => boolean;
  getStatus?: () => Promise<ZoomNativeResponse>;
  connect?: (options: {
    accountId: string;
    clientId: string;
    clientSecret: string;
    defaultTimezone?: string;
  }) => Promise<ZoomNativeResponse>;
  testConnection?: () => Promise<ZoomNativeResponse>;
  updateSettings?: (options: { defaultTimezone: string }) => Promise<ZoomNativeResponse>;
  disconnect?: () => Promise<ZoomNativeResponse>;
  createMeeting?: (options: {
    topic: string;
    startTime: string;
    duration: number;
    timezone?: string;
    weeklyDay: number;
    repeatInterval?: number;
    waitingRoom?: boolean;
    autoRecording?: string;
  }) => Promise<ZoomNativeResponse>;
  updateMeeting?: (options: {
    meetingId: string;
    topic?: string;
    startTime?: string;
    duration: number;
    timezone?: string;
    weeklyDay: number;
    repeatInterval?: number;
    waitingRoom?: boolean;
  }) => Promise<ZoomNativeResponse>;
  getMeeting?: (options: { meetingId: string }) => Promise<ZoomNativeResponse>;
  deleteMeeting?: (options: { meetingId: string }) => Promise<ZoomNativeResponse>;
  listMeetings?: (options?: {
    type?: 'scheduled' | 'live' | 'upcoming';
    pageSize?: number;
    nextPageToken?: string;
  }) => Promise<ZoomNativeResponse>;
}

let zoomNativeTestAdapter: ZoomNativeTestAdapter | null = null;

export function __setZoomNativeTestAdapter(adapter: ZoomNativeTestAdapter | null): void {
  zoomNativeTestAdapter = adapter;
}

export function __getZoomNativeTestAdapter(): ZoomNativeTestAdapter | null {
  return zoomNativeTestAdapter;
}

export async function invokeAndroidZoomGetStatus(): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.getStatus) {
    return zoomNativeTestAdapter.getStatus();
  }
  return NativeZoomSecureBridge.getStatus();
}

export async function invokeAndroidZoomConnect(options: {
  accountId: string;
  clientId: string;
  clientSecret: string;
  defaultTimezone?: string;
}): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.connect) {
    return zoomNativeTestAdapter.connect(options);
  }
  return NativeZoomSecureBridge.connect(options);
}

export async function invokeAndroidZoomTestConnection(): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.testConnection) {
    return zoomNativeTestAdapter.testConnection();
  }
  return NativeZoomSecureBridge.testConnection();
}

export async function invokeAndroidZoomUpdateSettings(defaultTimezone: string): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.updateSettings) {
    return zoomNativeTestAdapter.updateSettings({ defaultTimezone });
  }
  return NativeZoomSecureBridge.updateSettings({ defaultTimezone });
}

export async function invokeAndroidZoomDisconnect(): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.disconnect) {
    return zoomNativeTestAdapter.disconnect();
  }
  return NativeZoomSecureBridge.disconnect();
}

export async function invokeAndroidZoomCreateMeeting(options: {
  topic: string;
  startTime: string;
  duration: number;
  timezone?: string;
  weeklyDay: number;
  repeatInterval?: number;
  waitingRoom?: boolean;
  autoRecording?: string;
}): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.createMeeting) {
    return zoomNativeTestAdapter.createMeeting(options);
  }
  return NativeZoomSecureBridge.createMeeting(options);
}

export async function invokeAndroidZoomUpdateMeeting(options: {
  meetingId: string;
  topic?: string;
  startTime?: string;
  duration: number;
  timezone?: string;
  weeklyDay: number;
  repeatInterval?: number;
  waitingRoom?: boolean;
}): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.updateMeeting) {
    return zoomNativeTestAdapter.updateMeeting(options);
  }
  return NativeZoomSecureBridge.updateMeeting(options);
}

export async function invokeAndroidZoomGetMeeting(meetingId: string): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.getMeeting) {
    return zoomNativeTestAdapter.getMeeting({ meetingId });
  }
  return NativeZoomSecureBridge.getMeeting({ meetingId });
}

export async function invokeAndroidZoomDeleteMeeting(meetingId: string): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.deleteMeeting) {
    return zoomNativeTestAdapter.deleteMeeting({ meetingId });
  }
  return NativeZoomSecureBridge.deleteMeeting({ meetingId });
}

export async function invokeAndroidZoomListMeetings(options: {
  type?: 'scheduled' | 'live' | 'upcoming';
  pageSize?: number;
  nextPageToken?: string;
} = {}): Promise<ZoomNativeResponse> {
  if (zoomNativeTestAdapter?.listMeetings) {
    return zoomNativeTestAdapter.listMeetings(options);
  }
  if (typeof NativeZoomSecureBridge.listMeetings !== 'function') {
    return {
      ok: false,
      httpStatus: 501,
      code: 'ANDROID_PLUGIN_UPDATE_REQUIRED',
      error: 'Native Android ZoomSecureBridge plugin needs update to support listing Zoom meetings.'
    };
  }
  return NativeZoomSecureBridge.listMeetings(options);
}
