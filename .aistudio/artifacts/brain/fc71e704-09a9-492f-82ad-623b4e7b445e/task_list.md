# Task List: Glück Lernstudio — Complete Game Art, Audio & Effects Implementation

- [x] **Project & Architecture Inspection**:
  - [x] Identified all 34 educational games (11 Team/Group Games + 23 Solo Practice Games).
  - [x] Added `solo_sentence` as the 23rd Solo Practice Game in types and views.
  - [x] Verified zero remote URL dependencies for 100% offline Electron & Android Capacitor compliance.

- [x] **Audio Synthesizer & German Voice Pipeline**:
  - [x] Implemented offline Web Audio API synthesizer (`playLernstudioSound`) with 21 synthesized game sounds (lasers, card flips/matches, engine revs, combos, hammer hits, balloon pops, water splashes, coin drops, victory fanfares).
  - [x] Added proactive user-interaction listener (`pointerdown`, `touchstart`, `keydown`) to seamlessly resume `AudioContext` and bypass browser autoplay restrictions.
  - [x] Implemented offline German voice encouragement engine (`playGermanVoiceFeedback`) with Web Speech API (`de-DE`) and melodic audio fallbacks (`"Richtig!"`, `"Super!"`, `"Fantastisch!"`, `"Weiter so!"`, `"Geschafft!"`, `"Du hast gewonnen!"`, `"Versuch es noch einmal!"`).

- [x] **Effects & Animation Controls**:
  - [x] Created `useGameEffects` hook with contextual particle bursts, floating score popups, and victory celebration modals.
  - [x] Built `GameSettingsControls` with persisted sound mute toggle and animation intensity selector (`Full` | `Reduced` [cuts particles ~65%] | `Off` [disables effects]), adhering to `prefers-reduced-motion` and persisted in `localStorage`.

- [x] **Nano Banana Game Art Pipeline**:
  - [x] Created typed 34-game + 2 shared rewards Nano Banana Art Manifest (`nanoBananaGameArtManifest.ts`).
  - [x] Hardened CLI generator script (`scripts/generate_nano_banana_assets.mjs`) with `--status`, `--dry-run`, `--batch=<id>`, `--item=<id>`, `--force`, and immediate quota-safe circuit breaker on 429 / `RESOURCE_EXHAUSTED`.
  - [x] Created asset provenance ledger (`public/assets/games/asset_provenance.json`) tracking generation status, dimensions, and offline readiness.
  - [x] Upgraded `GameArtAssets.tsx` with `GameStageBanner`, `GameThumbnailArt`, `SharedVictoryTrophyArt`, and `SharedMysteryChestArt`.

- [x] **Phase 1 — Visual Quality Audit & Asset Refinement**:
  - [x] Inspected the 36 local WebP assets under `/public/assets/games/` and opened representative images.
  - [x] Identified visual weaknesses in `word_ninja_stage.webp` (simplistic line and spheres) and `space_fleet_stage.webp`.
  - [x] Enhanced `word_ninja_stage.webp` with a complete 3D cartoon Japanese Katana (wrapped hilt, gold tsuba, gleaming steel edge, cyan energy aura), golden 4-point shurikens, sliced bamboo stalks, sliced target fruit, and impact slash sparks.
  - [x] Enhanced `space_fleet_stage.webp` with dual-ringed Saturnian planet, ion engine thruster glows, multi-tier hull wings, and kinetic defense pulses.
  - [x] Re-rasterized local offline WebP assets at 90% quality with 100% offline support.

- [x] **Phase 2 — Nano Banana Quota Integrity**:
  - [x] Verified `--status` audit: 36 total assets (0 Nano Banana generated, 36 high-fidelity local constructed fallbacks, 0 missing).
  - [x] Maintained honest provenance ledger reflecting that live AI generation remains pending API quota availability without spamming retries.

- [x] **Phase 3 — Real Gameplay Smoke Tests**:
  - [x] Created automated verification test suite (`scripts/test_lernstudio_gameplay_qa.mjs`).
  - [x] Verified 34 games registry (11 team + 23 solo) and component mappings.
  - [x] Verified all 36 WebP assets exist with valid RIFF/WEBP magic bytes.
  - [x] Verified 21 educational sound effect keys and 7 German speech outcomes.
  - [x] Verified animation modes (`Full`, `Reduced`, `Off`) and settings persistence in `localStorage`.
  - [x] Verified consecutive correct answer multipliers, streak increments, and reset on incorrect answers without score loss.
  - [x] Smoke test result: **15 Passed, 0 Failed**.

- [x] **Phase 4 — Final Polish & Production Readiness**:
  - [x] Priority 1: Improved visual quality on weakest assets (`tower_architects_stage.webp`, `sentence_builder_stage.webp`, `sorting_stage.webp`, `game_stage.webp`, `solo_sentence_stage.webp`) with rich, age-appropriate 3D illustrations.
  - [x] Priority 2: Verified Nano Banana API configuration & live quota status (confirmed HTTP 429 quota exhaustion gracefully caught by circuit breaker; zero fake claims).
  - [x] Priority 3: Executed real Electron Linux build (`release/linux-unpacked/glueck` 184MB standalone binary) and Capacitor Android sync (`android/app/src/main/assets/public`); formulated physical device QA checklist.
  - [x] Priority 4: Verified compilation & typechecking (`tsc --noEmit` 0 errors, `vite build && esbuild server.ts` 0 errors, `compile_applet` passed).

- [x] **Schedule Recurrence & Conflict Bug Fix (Week A vs Week B)**:
  - [x] Fixed `checkOverlap` in `lessonUtils.ts`: Week A (`biweekly_a`) and Week B (`biweekly_b`) lessons never conflict.
  - [x] Fixed `getProjectedLessonsForRange` in `scheduleUtils.ts`: Filter out unstarted scheduled lessons when the group is configured for the opposite alternating week.
  - [x] Fixed `AppContext.tsx` (`updateGroup` & `generateGroupScheduleLessons`): Prune stale future lessons on opposite weeks when switching recurrence, and generate only matching week lessons.
  - [x] Added startup sanitizer in `dataSanitizer.ts`: Cleans up legacy orphaned scheduled lessons on wrong alternating weeks from `dl_lessons`.
  - [x] Fixed `ScheduleView.tsx`: Displays real recurrence badge (`🅰️ Alle 2 Wochen (A)`, `🅱️ Alle 2 Wochen (B)`, `🔄 Wöchentlich`) instead of hardcoded `Wöchentlich`.
  - [x] Fixed `AddLessonModal.tsx`: Biweekly recurrence steps by 14 days and checks recurrence during conflict detection.

- [x] **AI Prompt Generator & Content Import JSON Parsing Fix**:
  - [x] Hardened `generateLernstudioPrompt` with strict RFC 8259 JSON syntax rules forbidding backslash escaping of brackets (`\[`, `\]`) and braces (`\{`, `\}`).
  - [x] Built multi-stage `safeParseLernstudioJsonString` repairing escaped brackets/braces (`\[`, `\]`, `\{`, `\}`), smart/curly quotes, conversational preambles/postambles, comments, and trailing commas.
  - [x] Ensured compatibility across all 6 game modes (`sentence4Elements` 4-item tuple fallback for Satzbau, `missingLetterWord` generation for Glücksrad, `hasArticles` detection for Artikel-Sortierboxen, and exercise parsing for Jeopardy/Team Race).
  - [x] Verified 100% test pass on problematic JSON with `\[` and `\]`, clean JSON, noisy wrappers, and bare word sets. Zero lint errors.

- [x] **Random Student Picker: Multi-Group Merging & Manual Custom Names**:
  - [x] Added Multi-Group Merge mode (`isMergeMode`) with selectable group badges allowing joining 2 or more groups into a single combined roulette pool.
  - [x] Added Manual Custom Names panel allowing typing or pasting comma/newline-separated student names with remove chips and instant participation in the wheel.
  - [x] Maintained student repetition protection per round, star awarding, audio effects, and UI styling.

- [x] **إضافة زر كتم الصوت الكامل في أعلى مود المعلم (`LernstudioTeachModal.tsx`)**:
  - [x] تم إدراج زر تبديل الصوت (`Volume2` / `VolumeX`) في الشريط العلوي لـ `LernstudioTeachModal.tsx` بجانب أزرار الخلط وإعادة الترتيب والإغلاق.
  - [x] عند النقر على كتم الصوت: يتم إيقاف أي نطق جارٍ فوراً عبر `stopGermanSpeech()`.
  - [x] عند التفعيل أو الكتم: يتم الالتزام بحالة الصوت (`soundEnabled`) ومنع النطق التلقائي أو اليدوي لجميع الكلمات والأمثلة الصوتية.

- [x] **تعديل تصميم مود المعلم (`LernstudioTeachModal.tsx`) لمنع قص القائمة والتبويبات على الهواتف**:
  - [x] تم تحويل شريط التبويبات العلوي للمراحل الخمس إلى شبكة استجابية متناسقة (`grid grid-cols-5`) تتكيف مع جميع شاشات الهواتف بدلاً من العرض الثابت المسبب للتمرير الجانبي وقص المراحل (4 و 5).
  - [x] تم توسيع ارتفاع شبكة خيارات الأسئلة في المرحلة الرابعة إلى `max-h-[300px]` على الموبايل و `max-h-[360px]` على الشاشات الأكبر مع حواف داخلية تضمن ظهور كامل خيارات المفردات (بما فيها الصف السفلي) دون قص أو اقتطاع.





