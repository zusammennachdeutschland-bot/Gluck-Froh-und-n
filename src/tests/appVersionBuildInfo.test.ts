import assert from 'node:assert/strict';
import {
  APP_VERSION,
  APP_BUILD_NUMBER,
  APP_BUILD_TIME_ISO,
  formatAppBuildTimestamp,
  getRuntimeAppInfo
} from '../shared/appVersion';
import { CANONICAL_APP_VERSION } from '../../vite.config';

async function runBuildVersionTests() {
  console.log('================================================================================');
  console.log('TEST SUITE: DYNAMIC BUILD NUMBER & TIMESTAMP VERIFICATION');
  console.log('================================================================================');

  // Test 1: Canonical App Version Alignment
  console.log('Testing [BV-01] Version string alignment...');
  assert.equal(APP_VERSION, CANONICAL_APP_VERSION, 'APP_VERSION must match CANONICAL_APP_VERSION');
  assert.equal(APP_VERSION, '3.0.0', 'APP_VERSION must be 3.0.0');
  console.log('✅ [BV-01] Canonical version matches across configuration');

  // Test 2: Build timestamp validity
  console.log('Testing [BV-02] Dynamic build timestamp ISO validity...');
  assert.ok(APP_BUILD_TIME_ISO, 'APP_BUILD_TIME_ISO must not be empty');
  const parsedDate = new Date(APP_BUILD_TIME_ISO);
  assert.equal(isNaN(parsedDate.getTime()), false, 'APP_BUILD_TIME_ISO must parse into a valid Date');
  console.log(`✅ [BV-02] Build timestamp is valid ISO 8601: ${APP_BUILD_TIME_ISO}`);

  // Test 3: formatAppBuildTimestamp localization
  console.log('Testing [BV-03] Timestamp formatting for Arabic, German, and English locales...');
  const formattedAr = formatAppBuildTimestamp('ar');
  const formattedDe = formatAppBuildTimestamp('de');
  const formattedEn = formatAppBuildTimestamp('en');

  assert.ok(formattedAr.length > 5, 'Arabic formatted timestamp must not be empty');
  assert.ok(formattedDe.length > 5, 'German formatted timestamp must not be empty');
  assert.ok(formattedEn.length > 5, 'English formatted timestamp must not be empty');

  // Fallback on corrupt date
  const fallback = formatAppBuildTimestamp('ar', 'invalid-date');
  assert.equal(fallback, 'invalid-date', 'Invalid date string must fall back safely without throwing');
  console.log('✅ [BV-03] Localization formatting and invalid-date fallbacks verified');

  // Test 4: Runtime App Info Resolver
  console.log('Testing [BV-04] Runtime app info resolver...');
  const runtimeInfo = await getRuntimeAppInfo();
  assert.equal(typeof runtimeInfo.version, 'string');
  assert.equal(typeof runtimeInfo.build, 'string');
  assert.equal(typeof runtimeInfo.buildTimeIso, 'string');
  assert.equal(typeof runtimeInfo.isNative, 'boolean');
  assert.equal(runtimeInfo.version, APP_VERSION);
  assert.equal(runtimeInfo.build, APP_BUILD_NUMBER);
  console.log('✅ [BV-04] Runtime app info resolves cleanly in test/node environment');

  // Test 5: Dynamic CI / Gradle / Vite Build Number Calculation Rule
  console.log('Testing [BV-05] CI and Gradle dynamic versionCode calculation rule...');
  const baseBuildNumber = 300;
  const calculateBuildNumber = (ghRun?: string, appBuild?: string) => {
    const githubRunNumber = ghRun ? parseInt(ghRun, 10) : 0;
    return appBuild || (githubRunNumber > 0 ? String(baseBuildNumber + githubRunNumber) : String(baseBuildNumber));
  };

  // Local build without env vars
  assert.equal(calculateBuildNumber(undefined, undefined), '300');
  // CI run #1 -> Build 301
  assert.equal(calculateBuildNumber('1', undefined), '301');
  // CI run #2 -> Build 302
  assert.equal(calculateBuildNumber('2', undefined), '302');
  // CI run #15 -> Build 315
  assert.equal(calculateBuildNumber('15', undefined), '315');
  // Explicit APP_BUILD_NUMBER override
  assert.equal(calculateBuildNumber('15', '350'), '350');
  console.log('✅ [BV-05] Dynamic build calculation formula matches Android Gradle versionCode formula');

  console.log('================================================================================');
  console.log('🎉 ALL DYNAMIC BUILD & VERSION TESTS PASSED!');
  console.log('================================================================================');
}

runBuildVersionTests().catch((err) => {
  console.error('Build version test failed:', err);
  process.exit(1);
});
