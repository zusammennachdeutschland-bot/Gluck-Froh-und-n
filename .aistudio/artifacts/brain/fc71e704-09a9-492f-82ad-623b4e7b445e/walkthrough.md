# Glück — Smart Google Contacts Cleanup & Unification ("Kontakte vereinheitlichen" / "توحيد جهات الاتصال")

## Overview
A complete, non-destructive contact standardization and cleanup system built directly into the Glück teacher application. It standardizes existing Android and Google-synchronized contacts using English student names, parent phone numbers, and class designations already stored in Glück.

---

## 1. Key Rules & Implementation Details

### Standardized Naming Convention
- **Format**: `"{Student English Name}'s Mom - Klasse {Class Number}"`
  - Examples:
    - `"Ahmed's Mom - Klasse 4"`
    - `"Mariam's Mom - Klasse 2"`
    - `"Youssef's Mom - Klasse 6"`
    - `"Lukas' Mom - Klasse 5"`
- **English Name Resolution**:
  - Uses the student's actual English name in Glück (`certificateName` if present, or Latin `name`).
  - If a student has only an Arabic name without an English name, the contact is flagged for manual review rather than inventing or translating names.
- **English Possessives**:
  - Regular names append `'s` (e.g., `Ahmed's Mom`).
  - Names ending in `s`, `x`, `z` use the conventional apostrophe without extra `s` (e.g., `Lukas' Mom - Klasse 5`, `Max' Mom - Klasse 3`, `Aziz' Mom - Klasse 1`).
- **Class/Grade Designation**:
  - Strictly uses `"Klasse"`, never `"Grade"`.
  - Grade 4 -> `Klasse 4`, Grade 2 -> `Klasse 2`.

### Sibling Consolidation (Shared Parent Number)
- **Rule**: Multiple students sharing the same mother's phone number are consolidated into a single contact.
- **Format**:
  - 2 siblings: `"Ahmed & Mariam's Mom - Klasse 2 & 4"`
  - 3 siblings: `"Ahmed, Mariam & Youssef's Mom - Klasse 2, 4 & 6"`
- **Deduplication**: Identical classes are not repeated (e.g., if both siblings are in Klasse 4 -> `"Ahmed & Mariam's Mom - Klasse 4"`).
- **Long Names**: If the display name exceeds 45 characters, a concise display name is used, and the full sibling breakdown is preserved in the contact's Note field.

### Egyptian Phone Normalization
- Normalizes `+20`, `0020`, `20`, and local `01x` prefixes to match phone numbers accurately regardless of formatting, spacing, parentheses, or Eastern Arabic digits.

---

## 2. Architecture & Components

1. **`src/utils/contactsStandardizer.ts`**:
   - Canonical phone normalization (`normalizeEgyptianPhone`, `getPhoneMatchKey`).
   - English possessive formatter (`formatPossessive`).
   - Class extractor & formatter (`formatKlasseName`, `joinKlasseDesignations`).
   - Proposal generator (`buildStandardizedContactProposal`).

2. **`android/app/src/main/java/com/glueck/app/ContactsManagerPlugin.java`**:
   - Native Capacitor plugin registered in `MainActivity.java`.
   - Android Permissions: `READ_CONTACTS`, `WRITE_CONTACTS`.
   - Reads contacts, phones, account types (`com.google` vs device), and notes.
   - Executes atomic batch updates targeting `StructuredName` and `Note` via Android `ContentProviderOperation`.

3. **`src/services/contactsSyncService.ts`**:
   - Bridges UI with `ContactsManagerPlugin`.
   - Provides web simulation fallback for instant browser testing with realistic sample data.
   - Categorizes contacts into:
     - **Needs Update** (`NEEDS_UPDATE`)
     - **Already Standardized** (`ALREADY_STANDARDIZED`)
     - **Duplicates on Phone** (`DUPLICATE_ON_PHONE`)
     - **Review / Missing English Name** (`MISSING_ENGLISH_NAME`)
     - **Not in Phone** (`NOT_IN_CONTACTS`)

4. **`src/components/ContactsUnificationModal.tsx`**:
   - Main feature dialog with German header & Arabic subtitle: `"Kontakte vereinheitlichen" / "توحيد جهات الاتصال"`.
   - Real-time audit metrics cards.
   - Filter tabs and live search bar.
   - Comparison cards showing Current Name ➔ Standardized Name.
   - Linked student badges, phone copying, and inline name adjustment.
   - Batch selection with "Select All" / "Deselect All".
   - Safe execution progress dialog and completion report.

5. **Entry Points**:
   - **Students View Toolbar** (`src/components/StudentsView.tsx`): quick-access button alongside Add Student / Add Group.
   - **Settings View** (`src/components/SettingsView.tsx`): dedicated category card and configuration subpage.

---

## 3. Verification & Test Results
- **Standardizer Unit Test Suite** (`src/tests/contactsStandardizer.test.ts`):
  - 36 assertions executed covering:
    - Single student naming (`Ahmed's Mom - Klasse 4`)
    - S/X/Z possessives (`Lukas' Mom - Klasse 5`, `Max'`, `Aziz'`)
    - 2 & 3 sibling consolidations (`Ahmed & Mariam's Mom - Klasse 2 & 4`)
    - Same-class deduplication
    - Egyptian phone format variations (`+20`, `0020`, `010...`, Eastern Arabic digits)
  - Result: **36 / 36 Passed (100%)**.
- **TypeScript & Linting**: `tsc --noEmit` passed with 0 errors.
- **Production Build**: `compile_applet` succeeded with clean bundles.

---

## 4. GitHub Actions CI Build Fix (#74 & #75)
- **Root Cause Analysis**:
  1. In commit `#74`, `ContactsManagerPlugin.java` contained conflicting Capacitor base plugin method signatures and an incompatible JSON type conversion from `JSONArray` to `JSArray`.
  2. In commit `#75`, `@capacitor-community/text-to-speech` version 8.0.2 introduced an explicit dependency requirement on Android Gradle Plugin (AGP) `8.13.0`. The CI workflow (`build-apk.yml`) and `gradle-wrapper.properties` were pinned to Gradle `8.9`, which is incompatible with AGP 8.13.0 (AGP 8.13 requires Gradle 8.13+).
- **Fixes Applied**:
  1. Updated Gradle version from `8.9` to `8.13` in `.github/workflows/build-apk.yml` and `android/gradle/wrapper/gradle-wrapper.properties`.
  2. Updated root `android/build.gradle` classpath to AGP `8.13.0`.
  3. Added `compileOptions` targeting `JavaVersion.VERSION_21` in `android/app/build.gradle`.
  4. Switched ProGuard rules to `proguard-android-optimize.txt`.
  5. Refactored `ContactsManagerPlugin.java` phone array mapping to use a type-safe `phoneArrays` map.
  6. Re-synced native assets and plugins via `npx cap sync android`.

---

## 5. Direct Phone Registration & Automated Group Creation Prompt

### A. Saving Missing Contacts to Phone ("عايز اوبشن إني أسجلهم")
- **Native Android Content Provider Integration**: Added `createContact`, `batchCreateContacts`, and `openContactEditor` in `ContactsManagerPlugin.java`. Contacts are saved directly to Android's `ContactsContract` using atomic batch operations with standard `StructuredName`, `Phone`, and `Note`.
- **`ContactsUnificationModal.tsx` ("غير مسجل / Nicht im Tel")**:
  - **Individual Actions**: Each missing student card now includes an inline edit pencil to customize the proposed name, a "تسجيل بالهاتف" (Save to Phone) button, and a "محرر الهاتف" (Open Native Editor) button.
  - **Batch Operations**: Selection checkboxes with "تحديد الكل" / "إلغاء التحديد" and a prominent "تسجيل المحدد بالهاتف" button that creates all selected contacts in a single click with real-time progress indicators.
  - **VCF Contact Card Export**: Teachers can export all or selected missing contacts as a `.vcf` vCard file.

### B. Automated Group Creation Verification & Prompt ("يسألني اضيف الكونتاكتس او لو موجودة بس محتاجة تتعدل يعرفني")
- **`NewGroupContactsPromptModal.tsx`**: A dedicated modal that inspects student phone numbers against the device's contacts:
  - If a student is **not in the phone**, it offers 1-click single or batch saving to the phone.
  - If a student's contact **already exists on the phone but needs name standardization** (e.g., `"أم أحمد"` ➔ `"Ahmed's Mom - Klasse 5"`), it alerts the teacher and provides 1-click name standardization.
  - If already standardized, it displays a confirmation badge.
- **Manual Group Flow (`AddGroupModal.tsx`)**: When creating a group with a student and phone number, the app automatically checks the contacts and prompts the teacher to save or standardize.
- **AI Prompt Import (`AiImportModal.tsx`)**: Upon completing an AI prompt import, the success screen displays a smart contacts audit card with student counts needing addition or editing, with a 1-click action to review, save, and update all contacts immediately.
