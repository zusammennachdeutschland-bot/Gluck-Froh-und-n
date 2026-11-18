const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_OPERATIONS = new Set([
  'token_info',
  'list_recordings',
  'recording_details',
  'recording_transcript'
]);

contextBridge.exposeInMainWorld('electronBridge', {
  isElectron: true,
  platform: process.platform,
  grain: {
    getStatus: () => ipcRenderer.invoke('grain:status'),
    saveToken: (token) => ipcRenderer.invoke('grain:saveToken', { token: String(token || '') }),
    disconnect: () => ipcRenderer.invoke('grain:disconnect'),
    executeOperation: (options) => {
      const op = String(options?.operation || '');
      if (!ALLOWED_OPERATIONS.has(op)) {
        return Promise.reject(new Error('Unsupported Grain IPC operation'));
      }
      return ipcRenderer.invoke('grain:executeOperation', {
        operation: op,
        recordingId: options?.recordingId ? String(options.recordingId) : undefined,
        payloadJson: options?.payloadJson ? String(options.payloadJson) : '{}'
      });
    }
  }
});
