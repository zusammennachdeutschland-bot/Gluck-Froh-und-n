#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Removes Web/PWA/Electron/Node-only duplicate assets from Android's synced
 * Capacitor web assets directory (`android/app/src/main/assets/public`) without
 * touching `public/` or `dist/` (so Web, PWA, and Electron remain 100% intact).
 */
const ANDROID_PUBLIC_DIR = path.resolve(
  __dirname,
  '../android/app/src/main/assets/public'
);

const PRUNABLE_FILES = [
  'server.cjs',
  'server.cjs.map',
  'logo.svg',
  'logo.png',
  'icon.png',
  'icon.ico',
  'fg.png',
  'bg.png',
  'apple-touch-icon.png',
  'pwa-512x512.png',
  'pwa-maskable-512x512.png',
  path.join('assets', 'brand', 'teacher-crest-logo.png'),
];

const PRUNABLE_DIRS = ['icons'];

function getPathBytes(targetPath) {
  if (!fs.existsSync(targetPath)) return 0;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return stat.size;
  if (stat.isDirectory()) {
    return fs.readdirSync(targetPath).reduce(
      (sum, entry) => sum + getPathBytes(path.join(targetPath, entry)),
      0
    );
  }
  return 0;
}

function pruneAndroidWebAssets(baseDir = ANDROID_PUBLIC_DIR) {
  if (!fs.existsSync(baseDir)) {
    return { removedCount: 0, savedBytes: 0 };
  }

  let removedCount = 0;
  let savedBytes = 0;

  for (const relFile of PRUNABLE_FILES) {
    const full = path.join(baseDir, relFile);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      savedBytes += fs.statSync(full).size;
      fs.unlinkSync(full);
      removedCount += 1;
    }
  }

  for (const relDir of PRUNABLE_DIRS) {
    const full = path.join(baseDir, relDir);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      savedBytes += getPathBytes(full);
      fs.rmSync(full, { recursive: true, force: true });
      removedCount += 1;
    }
  }

  return { removedCount, savedBytes };
}

if (require.main === module) {
  const { removedCount, savedBytes } = pruneAndroidWebAssets();
  const savedMb = (savedBytes / (1024 * 1024)).toFixed(2);
  console.log(
    `✅ Pruned ${removedCount} Web/PWA/Server-only asset entries from Android public assets (saved ${savedMb} MB).`
  );
}

module.exports = { pruneAndroidWebAssets, PRUNABLE_FILES, PRUNABLE_DIRS };
