# Glück — Contact Cleanup & Unification Task List

- [x] **Stage 1: Standardization & Phone Normalization Engine**
  - [x] Implement `src/utils/contactsStandardizer.ts`:
    - [x] Egyptian phone normalization and matching (`normalizeEgyptianPhone`, `getPhoneMatchKey`).
    - [x] English possessive formatting (`formatPossessive` with 's and ' for names ending in s, x, z).
    - [x] Grade to Klasse extraction (`formatKlasseName`).
    - [x] Single student name generation: `"{Student English Name}'s Mom - Klasse {Class Number}"`.
    - [x] Sibling consolidation with `&` and commas: `"Ahmed & Mariam's Mom - Klasse 2 & 4"`.
    - [x] Sibling class deduplication (e.g., identical class remains single `"Klasse 4"`).
    - [x] Name length guard (>45 chars) with concise name + notes summary.
  - [x] Create and execute comprehensive unit tests (`src/tests/contactsStandardizer.test.ts`): **36/36 tests passed (100%)**.

- [x] **Stage 2: Android Native Contacts Provider Plugin & Permissions**
  - [x] Add `READ_CONTACTS` and `WRITE_CONTACTS` permissions to `android/app/src/main/AndroidManifest.xml`.
  - [x] Implement `ContactsManagerPlugin.java` in `android/app/src/main/java/com/glueck/app/ContactsManagerPlugin.java`:
    - [x] Permission check and request handler (`checkPermissions`, `requestPermissions`).
    - [x] Read all contacts with phone numbers, account type (`com.google` vs device), display name, and notes.
    - [x] Update display name via `ContentProviderOperation` batching on `ContactsContract.Data`.
    - [x] Update contact notes for long sibling records.
  - [x] Register `ContactsManagerPlugin.class` in `MainActivity.java`.

- [x] **Stage 3: Contacts Sync & Audit Service**
  - [x] Implement `src/services/contactsSyncService.ts`:
    - [x] Bridge to native `ContactsManager` plugin with graceful web/browser fallback.
    - [x] Scan and match algorithm against Glück's active students.
    - [x] Categorization into audit buckets: Needing Update, Already Standardized, Duplicates, Needs Review, Missing in Phone, Read-Only.
    - [x] Batch execution with progress callbacks and safety isolation.

- [x] **Stage 4: User Interface ("Kontakte vereinheitlichen" / "توحيد جهات الاتصال")**
  - [x] Implement `src/components/ContactsUnificationModal.tsx`:
    - [x] Clean Glück-style header with German title & Arabic subtitle.
    - [x] Stat metric cards for audit categories (Needs Update, Standardized, Duplicates, Review, Not in phone).
    - [x] Search & category filter tabs.
    - [x] Batch selection controls (Select All, Deselect All, count badge).
    - [x] Diff comparison cards with before/after names, linked students, Google account badges.
    - [x] Execution dialog with live progress bar and final audit report.
  - [x] Add entry button in `src/components/StudentsView.tsx` toolbar.
  - [x] Add entry category and subpage in `src/components/SettingsView.tsx`.

- [x] **Stage 5: Verification & Compilation**
  - [x] Verified TypeScript types and build via `lint_applet` (0 errors).
  - [x] Verified full applet build via `compile_applet` (Build succeeded).
  - [x] Executed automated unit tests (`runContactsStandardizerTests`): 36 assertions passed.

- [x] **Stage 6: Android CI/CD Build Compatibility (#74 & #75)**
  - [x] Fixed `ContactsManagerPlugin.java` permission signature and JSON type conversions (`phoneArrays` type-safety).
  - [x] Resolved Gradle 8.9 vs AGP 8.13.0 conflict introduced by `@capacitor-community/text-to-speech` 8.0.2.
  - [x] Upgraded Gradle wrapper and CI runner configuration to Gradle 8.13 in `.github/workflows/build-apk.yml` and `gradle-wrapper.properties`.
  - [x] Updated root `android/build.gradle` to unified AGP 8.13.0.
  - [x] Added Java 21 `compileOptions` and updated ProGuard configuration to `proguard-android-optimize.txt` in `android/app/build.gradle`.
  - [x] Re-synced Capacitor native assets via `npx cap sync android`.
