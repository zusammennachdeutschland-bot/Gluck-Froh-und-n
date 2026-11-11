const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronBridge', {
  isElectron: true,
  platform: process.platform
});
