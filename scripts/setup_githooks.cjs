#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const gitDir = path.join(rootDir, '.git');
const hookFile = path.join(rootDir, '.githooks', 'pre-commit');

if (fs.existsSync(hookFile)) {
  try {
    fs.chmodSync(hookFile, 0o755);
  } catch {
    // Ignore permission errors on read-only filesystems
  }
}

if (!fs.existsSync(gitDir)) {
  process.exit(0);
}

try {
  execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
    cwd: rootDir,
    stdio: 'ignore',
  });
} catch {
  // Non-fatal if git binary is unavailable in minimal build environments
}
