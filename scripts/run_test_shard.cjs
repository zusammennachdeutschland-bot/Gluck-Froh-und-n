#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const shardIndex = parseInt(getArg('shard', process.env.SHARD_INDEX || '1'), 10);
const totalShards = parseInt(getArg('total', process.env.SHARD_TOTAL || '1'), 10);

if (!Number.isInteger(shardIndex) || !Number.isInteger(totalShards) || shardIndex < 1 || shardIndex > totalShards) {
  console.error(`Invalid shard arguments: shard=${shardIndex}, total=${totalShards}`);
  process.exit(1);
}

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const testScript = String(pkg.scripts?.test || '');

const allCommands = testScript
  .split('&&')
  .map((cmd) => cmd.trim())
  .filter(Boolean);

const shardCommands = allCommands.filter((_, idx) => idx % totalShards === shardIndex - 1);

const repoRoot = path.resolve(__dirname, '..');
const localBinDir = path.join(repoRoot, 'node_modules', '.bin');
const shardEnv = {
  ...process.env,
  PATH: process.env.PATH ? `${localBinDir}${path.delimiter}${process.env.PATH}` : localBinDir,
};

console.log(`[TestShard ${shardIndex}/${totalShards}] Running ${shardCommands.length} of ${allCommands.length} test suites...`);

for (const cmd of shardCommands) {
  console.log(`\n[TestShard ${shardIndex}/${totalShards}] >>> ${cmd}`);
  execSync(cmd, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: shardEnv
  });
}

console.log(`\n[TestShard ${shardIndex}/${totalShards}] All ${shardCommands.length} test suites passed.`);
