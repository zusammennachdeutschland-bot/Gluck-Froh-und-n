import { registerPlugin } from '@capacitor/core';

export type GrainBridgeOperation =
  | 'token_info'
  | 'list_recordings'
  | 'recording_details'
  | 'recording_transcript';

export interface GrainBridgeStatusResult {
  supported: boolean;
  secureStorageAvailable: boolean;
  runtime?: string;
  hasToken: boolean;
  maskedToken?: string | null;
}

export interface GrainBridgeSaveTokenResult {
  saved: boolean;
  hasToken: boolean;
  maskedToken: string;
  secureStorageAvailable: boolean;
}

export interface GrainBridgeDisconnectResult {
  disconnected: boolean;
  hasToken: boolean;
}

export interface GrainBridgeOperationResult {
  httpStatus: number;
  retryAfter?: string;
  bodyText: string;
}

export interface GrainSecureBridgePlugin {
  getStatus(): Promise<GrainBridgeStatusResult>;
  saveToken(options: { token: string }): Promise<GrainBridgeSaveTokenResult>;
  disconnect(): Promise<GrainBridgeDisconnectResult>;
  executeGrainOperation(options: {
    operation: GrainBridgeOperation;
    recordingId?: string;
    payloadJson?: string;
  }): Promise<GrainBridgeOperationResult>;
}

const NativeGrainSecureBridge = registerPlugin<GrainSecureBridgePlugin>('GrainSecureBridge');

export interface GrainNativeTestAdapter {
  isAndroidNative?: () => boolean;
  getStatus?: () => Promise<GrainBridgeStatusResult>;
  saveToken?: (options: { token: string }) => Promise<GrainBridgeSaveTokenResult>;
  disconnect?: () => Promise<GrainBridgeDisconnectResult>;
  executeGrainOperation?: (options: {
    operation: GrainBridgeOperation;
    recordingId?: string;
    payloadJson?: string;
  }) => Promise<GrainBridgeOperationResult>;
}

let grainNativeTestAdapter: GrainNativeTestAdapter | null = null;

export function __setGrainNativeTestAdapter(adapter: GrainNativeTestAdapter | null): void {
  grainNativeTestAdapter = adapter;
}

export function __getGrainNativeTestAdapter(): GrainNativeTestAdapter | null {
  return grainNativeTestAdapter;
}

export async function invokeAndroidGrainGetStatus(): Promise<GrainBridgeStatusResult> {
  if (grainNativeTestAdapter?.getStatus) {
    return grainNativeTestAdapter.getStatus();
  }
  return NativeGrainSecureBridge.getStatus();
}

export async function invokeAndroidGrainSaveToken(token: string): Promise<GrainBridgeSaveTokenResult> {
  if (grainNativeTestAdapter?.saveToken) {
    return grainNativeTestAdapter.saveToken({ token });
  }
  return NativeGrainSecureBridge.saveToken({ token });
}

export async function invokeAndroidGrainDisconnect(): Promise<GrainBridgeDisconnectResult> {
  if (grainNativeTestAdapter?.disconnect) {
    return grainNativeTestAdapter.disconnect();
  }
  return NativeGrainSecureBridge.disconnect();
}

export async function invokeAndroidGrainOperation(options: {
  operation: GrainBridgeOperation;
  recordingId?: string;
  payloadJson?: string;
}): Promise<GrainBridgeOperationResult> {
  if (grainNativeTestAdapter?.executeGrainOperation) {
    return grainNativeTestAdapter.executeGrainOperation(options);
  }
  return NativeGrainSecureBridge.executeGrainOperation(options);
}
