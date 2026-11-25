import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Verifies that the Vercel Serverless API entry (`api/index.ts`) compiles cleanly
 * to native NodeNext ESM with ZERO browser/Capacitor runtime imports and serves
 * `GET /api/health` with HTTP 200 under simulated Vercel (`VERCEL=1`, `NODE_ENV=production`)
 * in pure Node ESM (the exact runtime that previously threw FUNCTION_INVOCATION_FAILED).
 */
async function runVercelServerlessApiSmokeTest() {
  console.log('=== Starting P1 Vercel Serverless ESM & Health Endpoint Smoke Test ===');
  const rootDir = process.cwd();
  const tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glueck-vercel-esm-check-'));

  try {
    // 1. Static guard: firebaseAdmin.ts must NEVER import browser firebaseCloudSync.ts
    const firebaseAdminSrc = fs.readFileSync(path.join(rootDir, 'src/server/firebaseAdmin.ts'), 'utf8');
    assert.equal(
      firebaseAdminSrc.includes('firebaseCloudSync'),
      false,
      'src/server/firebaseAdmin.ts must NOT import browser firebaseCloudSync (use pure firebaseConfig.js)'
    );

    // 2. Compile api/index.ts + its entire server transitive dependency graph to real NodeNext ESM
    const tscBin = path.join(rootDir, 'node_modules', '.bin', 'tsc');
    execFileSync(
      tscBin,
      [
        'api/index.ts',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--target',
        'ES2022',
        '--esModuleInterop',
        '--skipLibCheck',
        '--outDir',
        tmpOutDir
      ],
      { cwd: rootDir, stdio: 'pipe' }
    );

    // Confirm browser firebaseCloudSync was NEVER pulled into the compiled serverless graph!
    const compiledBrowserSync = path.join(tmpOutDir, 'src', 'shared', 'firebaseCloudSync.js');
    assert.equal(
      fs.existsSync(compiledBrowserSync),
      false,
      'Serverless compilation must NOT pull browser firebaseCloudSync.ts into the Lambda bundle'
    );

    const compiledEntryPath = path.join(tmpOutDir, 'api', 'index.js');
    assert.ok(fs.existsSync(compiledEntryPath), 'Compiled api/index.js must exist');

    // Mirror exact Vercel Lambda layout: package.json ("type":"module") + node_modules at task root
    fs.writeFileSync(path.join(tmpOutDir, 'package.json'), JSON.stringify({ type: 'module' }));
    fs.symlinkSync(path.join(rootDir, 'node_modules'), path.join(tmpOutDir, 'node_modules'), 'dir');

    // 3. Boot compiled api/index.js in a clean PURE Node ESM subprocess (zero tsx!) with VERCEL=1
    const entryUrl = pathToFileURL(compiledEntryPath).href;
    const probeScript = `
      const { default: app } = await import(${JSON.stringify(entryUrl)});
      if (typeof app !== 'function') {
        throw new Error('Default export of api/index.js is not an Express handler function');
      }
      const server = app.listen(0);
      try {
        const addr = server.address();
        const res = await fetch('http://127.0.0.1:' + addr.port + '/api/health');
        const body = await res.json();
        if (res.status !== 200 || body?.status !== 'ok') {
          throw new Error('Unexpected /api/health response: ' + res.status + ' ' + JSON.stringify(body));
        }
        const preflight = await fetch('http://127.0.0.1:' + addr.port + '/api/teacher/assignments', {
          method: 'OPTIONS',
          headers: { Origin: 'https://localhost' }
        });
        if (preflight.status !== 204 || preflight.headers.get('access-control-allow-origin') !== 'https://localhost') {
          throw new Error('Unexpected CORS preflight response: ' + preflight.status);
        }
        console.log('PURE_NODE_ESM_VERCEL_OK:' + JSON.stringify(body));
      } finally {
        server.close();
      }
    `;

    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', probeScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        VERCEL: '1',
        VERCEL_ENV: 'production',
        NODE_ENV: 'production'
      },
      encoding: 'utf8'
    });

    assert.ok(
      stdout.includes('PURE_NODE_ESM_VERCEL_OK:{"status":"ok"}'),
      `Expected pure Node ESM /api/health 200 ok, got: ${stdout}`
    );

    console.log('✅ Vercel Serverless NodeNext ESM compilation, browser-free bundle isolation, and GET /api/health 200 verified!');
  } finally {
    fs.rmSync(tmpOutDir, { recursive: true, force: true });
  }
}

runVercelServerlessApiSmokeTest().catch((err) => {
  console.error('Vercel serverless smoke test failed:', err);
  process.exit(1);
});
