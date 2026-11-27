#!/usr/bin/env node
'use strict';

/**
 * CI guard: every src/tests/*.test.ts file must be executed by the `test`
 * script in package.json. Fails (exit 1) listing any orphan test file that
 * `npm test` would never run.
 *
 * Usage: node scripts/check_test_coverage.cjs
 * (also run from CI: lint-and-typecheck job in .github/workflows/build-apk.yml)
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const testScript = String(pkg.scripts && pkg.scripts.test ? pkg.scripts.test : '');

const testsDir = path.join(repoRoot, 'src', 'tests');
const onDisk = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.ts')).sort();

const missing = onDisk.filter((f) => !testScript.includes(`src/tests/${f}`));

if (missing.length > 0) {
  console.error(`❌ ${missing.length} test file(s) in src/tests/ are NOT covered by the "test" script in package.json:`);
  for (const f of missing) console.error(`   - src/tests/${f}`);
  console.error('Add them to the "test" script (or to the runner it invokes) before merging.');
  process.exit(1);
}

console.log(`✅ All ${onDisk.length} test files in src/tests/ are covered by the "test" script.`);
