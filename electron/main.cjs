const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');

// Single instance lock to prevent duplicate heavy Electron processes
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Chromium GPU Acceleration & Hardware Rendering flags for Linux (X11 & Wayland) and Desktop
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,RasterColorConversion');
app.commandLine.appendSwitch('ozone-platform-hint', 'auto'); // Auto-detect Wayland vs X11 on Linux
app.commandLine.appendSwitch('renderer-process-limit', '4');
app.commandLine.appendSwitch('disk-cache-size', '104857600'); // 100 MB disk cache cap

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false, // Prevent white flash on Linux startup
    backgroundColor: '#0f172a', // Matches dark theme background
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: true, // Throttles background timers when minimized to save CPU/RAM
      spellcheck: false, // Saves ~100MB+ RAM by disabling Chromium spellcheck dictionaries
      webSecurity: true
    },
    icon: path.join(__dirname, '../dist/icon.png')
  });

  // Load the compiled index.html
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Reveal window seamlessly when ready to render
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
