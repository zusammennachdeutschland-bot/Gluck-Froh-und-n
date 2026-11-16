#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const checkStaged = args.has('--staged');
const checkWorkspace = args.has('--workspace') || args.size === 0 || args.has('--build') || args.has('--android');
const checkBuild = args.has('--build') || args.size === 0;
const checkAndroid = args.has('--android') || args.size === 0;

const BLOCKED_GIT_PREFIXES = [
  'public/assets/aistudio/',
  '.aistudio/',
  '.ai-studio-attachments/',
  'chat-attachments/',
  'conversation-attachments/',
  'android/app/src/main/assets/public/assets/aistudio/',
];

const BLOCKED_WORKSPACE_DIRS = [
  path.join(rootDir, '.aistudio', 'attachments'),
  path.join(rootDir, 'assets', '.aistudio'),
  path.join(rootDir, 'public', 'assets', 'aistudio'),
  path.join(rootDir, '.ai-studio-attachments'),
  path.join(rootDir, 'chat-attachments'),
  path.join(rootDir, 'conversation-attachments'),
];

const BLOCKED_OUTPUT_DIRS = {
  build: [
    path.join(rootDir, 'dist', 'assets', 'aistudio'),
    path.join(rootDir, 'dist', 'chat-attachments'),
    path.join(rootDir, 'dist', 'conversation-attachments'),
  ],
  android: [
    path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'assets', 'aistudio'),
    path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'chat-attachments'),
    path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'conversation-attachments'),
  ],
};

const REQUIRED_BRAND_FILES = [
  'assets/brand/teacher-crest-logo.png',
  'logo.png',
  'icon.png',
  'favicon.png',
];

const REQUIRED_GAME_FILES = [
  'asset_provenance.json',
  'balloon_pop_stage.webp',
  'basket_catch_stage.webp',
  'bridge_builder_stage.webp',
  'chest_tier_amber.webp',
  'chest_tier_emerald.webp',
  'chest_tier_ruby.webp',
  'chest_tier_sapphire.webp',
  'classroom_stage.webp',
  'color_master_stage.webp',
  'factory_machine_stage.webp',
  'follow_clues_stage.webp',
  'game_stage.webp',
  'island_crossing_stage.webp',
  'magic_chest_closed.webp',
  'magic_chest_open.webp',
  'memory_stage.webp',
  'nano_bear_celebrating.webp',
  'nano_bear_champion.webp',
  'nano_bear_encouraging.webp',
  'nano_bear_idle.webp',
  'nano_bear_thinking.webp',
  'pit_stop_stage.webp',
  'puzzle_masters_stage.webp',
  'race_stage.webp',
  'robot_repair_stage.webp',
  'rocket_countdown_stage.webp',
  'sentence_builder_stage.webp',
  'shared_mystery_chest.webp',
  'shared_victory_trophy.webp',
  'solo_sentence_stage.webp',
  'sorting_stage.webp',
  'space_defense_stage.webp',
  'space_fleet_stage.webp',
  'submarine_explore_stage.webp',
  'target_attack_stage.webp',
  'team_auction_stage.webp',
  'tictactoe_stage.webp',
  'tower_architects_stage.webp',
  'tug_of_war_stage.webp',
  'vending_machine_stage.webp',
  'whack_a_mole_stage.webp',
  'whats_in_box_stage.webp',
  'wheel_stage.webp',
  'word_detective_stage.webp',
  'word_ninja_stage.webp',
  'word_rhythm_stage.webp',
  'word_wash_stage.webp',
];

const SUSPECT_ATTACHMENT_FILE_PATTERN = /^(Screenshot_20\d{6}_|Paste_[A-Za-z]+_\d+__20\d{2}|Glueck_Worksheet_Zehnerzahlen_bis_100_Student_ws-5)/i;

const FORBIDDEN_CODE_PATTERNS = [
  /assets\/aistudio\//i,
  /\.aistudio\/attachments/i,
  /logo-removebg-preview__1__1a8a6028\.png/i,
  /Glueck_Worksheet_Zehnerzahlen_bis_100_Student_ws-5/i,
  /Paste_November_10__2026/i,
  /Screenshot_2026\d{4}_/i,
];

function hasAnyFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return false;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dirPath, ent.name);
    if (ent.isDirectory()) {
      if (hasAnyFiles(full)) return true;
    } else {
      return true;
    }
  }
  return false;
}

function walkFiles(dirPath, skipDirs = new Set()) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, skipDirs));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function verifyRuntimeAssetsInDir(baseDir, label) {
  let ok = true;
  if (!fs.existsSync(baseDir)) {
    console.error(`ERROR: Missing ${label} directory: ${path.relative(rootDir, baseDir)}`);
    return false;
  }

  for (const rel of REQUIRED_BRAND_FILES) {
    const full = path.join(baseDir, rel);
    if (!fs.existsSync(full) || fs.statSync(full).size === 0) {
      console.error(`ERROR: Missing or empty required brand asset in ${label}: ${rel}`);
      ok = false;
    }
  }

  for (const gameFile of REQUIRED_GAME_FILES) {
    const full = path.join(baseDir, 'assets', 'games', gameFile);
    if (!fs.existsSync(full) || fs.statSync(full).size === 0) {
      console.error(`ERROR: Missing or empty required game asset in ${label}: assets/games/${gameFile}`);
      ok = false;
    }
  }

  for (const filePath of walkFiles(baseDir)) {
    const name = path.basename(filePath);
    if (SUSPECT_ATTACHMENT_FILE_PATTERN.test(name)) {
      console.error(`ERROR: Found leftover chat attachment file in ${label}: ${path.relative(rootDir, filePath)}`);
      ok = false;
    }
  }

  return ok;
}

let failed = false;

if (checkWorkspace) {
  for (const dirPath of BLOCKED_WORKSPACE_DIRS) {
    if (fs.existsSync(dirPath)) {
      console.error(`ERROR: Forbidden attachment directory exists in workspace: ${path.relative(rootDir, dirPath)}`);
      failed = true;
    }
  }

  if (!verifyRuntimeAssetsInDir(path.join(rootDir, 'public'), 'public/')) {
    failed = true;
  }

  // Scan source and script files for broken/forbidden attachment references
  const codeDirs = ['src', 'api', 'electron', 'scripts'];
  const extraFiles = ['index.html', 'server.ts'];
  const codeFiles = [
    ...codeDirs.flatMap((d) => walkFiles(path.join(rootDir, d))),
    ...extraFiles.map((f) => path.join(rootDir, f)).filter((f) => fs.existsSync(f)),
  ];

  for (const filePath of codeFiles) {
    const relPath = path.relative(rootDir, filePath);
    if (relPath === path.join('scripts', 'verify_no_aistudio_attachments.cjs')) continue;
    if (!/\.(ts|tsx|js|jsx|cjs|mjs|html)$/i.test(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of FORBIDDEN_CODE_PATTERNS) {
      if (pattern.test(content)) {
        console.error(`ERROR: Broken/forbidden attachment reference (${pattern}) in ${relPath}`);
        failed = true;
      }
    }

    // Verify all explicit assets/brand/* references in code resolve inside public/
    const brandRefRe = /["'`]\/?(assets\/brand\/[A-Za-z0-9_.\-\/]+\.(?:png|webp|jpg|jpeg|svg))["'`]/g;
    let m;
    while ((m = brandRefRe.exec(content)) !== null) {
      const target = path.join(rootDir, 'public', m[1]);
      if (!fs.existsSync(target)) {
        console.error(`ERROR: Broken brand asset reference in ${relPath}: ${m[1]}`);
        failed = true;
      }
    }
  }
}

if (checkBuild) {
  for (const dirPath of BLOCKED_OUTPUT_DIRS.build) {
    if (fs.existsSync(dirPath) && hasAnyFiles(dirPath)) {
      console.error(`ERROR: AI Studio attachments leaked into build directory: ${path.relative(rootDir, dirPath)}`);
      failed = true;
    }
  }
  if (!verifyRuntimeAssetsInDir(path.join(rootDir, 'dist'), 'dist/')) {
    failed = true;
  }
}

if (checkAndroid) {
  for (const dirPath of BLOCKED_OUTPUT_DIRS.android) {
    if (fs.existsSync(dirPath) && hasAnyFiles(dirPath)) {
      console.error(`ERROR: AI Studio attachments leaked into Android assets: ${path.relative(rootDir, dirPath)}`);
      failed = true;
    }
  }
  if (!verifyRuntimeAssetsInDir(path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public'), 'android/app/src/main/assets/public/')) {
    failed = true;
  }
}

if (checkStaged) {
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: rootDir,
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const violations = staged.filter((filePath) =>
      BLOCKED_GIT_PREFIXES.some((prefix) => filePath.startsWith(prefix))
    );

    if (violations.length > 0) {
      console.error('ERROR: Refusing to commit AI Studio / chat attachment files:');
      for (const v of violations) console.error(`  - ${v}`);
      failed = true;
    }
  } catch (err) {
    console.warn('Skipping staged Git check (not inside a Git repository):', err.message);
  }
}

if (failed) {
  process.exit(1);
}

console.log('✅ Verified: No conversation attachments in workspace/builds, all 48 game assets + brand logo present, zero broken references.');
