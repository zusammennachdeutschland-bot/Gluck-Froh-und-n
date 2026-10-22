# Glück — Smart Google Contacts Cleanup & Unification ("Kontakte vereinheitlichen" / "توحيد جهات الاتصال")

## Overview
Implement a comprehensive, non-destructive contact standardization and cleanup system inside the Glück teacher application. The feature standardizes existing Android and Google-synchronized contacts using English student names, parent phone numbers, and class designations already stored in Glück.

---

## 1. Core Rules & Standards

### Contact Naming Convention
- **Format**: `"{Student English Name}'s Mom - Klasse {Class Number}"`
  - Examples:
    - `"Ahmed's Mom - Klasse 4"`
    - `"Mariam's Mom - Klasse 2"`
    - `"Youssef's Mom - Klasse 6"`
    - `"Lukas' Mom - Klasse 5"`
- **English Name Resolution**:
  - Uses the student's actual English name in Glück (`certificateName` if present, or Latin `name`).
  - If a student has only an Arabic name and no English name is stored, flags the record for manual review / missing English name.
- **English Possessive Suffix Rule**:
  - Names ending in regular letters: `Ahmed's Mom`, `Mariam's Mom`
  - Names ending in `s`, `x`, `z`: use standard English possessive apostrophe without duplicate `s`:
    - `Lukas' Mom - Klasse 5`
    - `Max' Mom - Klasse 3`
    - `Aziz' Mom - Klasse 1`
    - `Anas' Mom - Klasse 4`
- **Class/Grade Designation**:
  - The German word `"Klasse"` is strictly used instead of `"Grade"`.
  - Grade 4 -> `Klasse 4`, Grade 2 -> `Klasse 2`.

### Sibling Consolidation (Shared Parent Number)
- **Rule**: One parent phone number must never produce multiple duplicate contacts.
- **Format**:
  - 2 siblings: `"Ahmed & Mariam's Mom - Klasse 2 & 4"`
  - 3 siblings: `"Ahmed, Mariam & Youssef's Mom - Klasse 2, 4 & 6"`
- **Deduplication**:
  - Avoid repeating identical classes (e.g., if both siblings are in Klasse 4 -> `"Ahmed & Mariam's Mom - Klasse 4"`).
- **Long Names**:
  - If consolidated display name exceeds 45 characters, provide a concise display name and store the complete sibling list in the contact's Note field.
- **Ambiguity**:
  - Flag shared numbers with unclear relationships for manual review before applying changes.

### Phone Number Normalization
- Local Egyptian normalization:
  - Strips formatting, whitespace, parentheses, dashes.
  - Normalizes `+20`, `0020`, `20`, and local `01x` prefixes to match contacts reliably regardless of how they were saved.

---

## 2. Technical Architecture

### Android Native Bridge (`ContactsManagerPlugin.java`)
- Native Capacitor plugin registered in `MainActivity.java`:
  - `checkPermissions` & `requestPermissions`: requests `READ_CONTACTS` and `WRITE_CONTACTS`.
  - `getContacts`: queries `ContactsContract` for contact ID, raw contact ID, display name, phone numbers, account type (`com.google` vs device), and notes.
  - `updateContactName`: atomic `ContentProviderOperation` update targeting `StructuredName` and optional `Note`.
  - `batchUpdateContacts`: safe batch execution with error isolation.
- `AndroidManifest.xml` permissions:
  - `android.permission.READ_CONTACTS`
  - `android.permission.WRITE_CONTACTS`

### Web & Desktop Simulation
- Full browser fallback and simulation using actual Glück student data when not running on native Android, ensuring 100% interactive testing and UI verification in the dev environment.

### User Interface (`ContactsUnificationModal.tsx`)
- German title: `"Kontakte vereinheitlichen"`
- Arabic subtitle: `"توحيد جهات الاتصال"`
- Metric cards: Needing Update, Already Standardized, Duplicates, Missing in Phone, Needs Review.
- Filter tabs & search bar.
- Before/After name comparison cards with linked student badges and Google account indicators.
- Batch selection controls (Select All / Deselect All).
- Live execution progress bar and detailed completion report.

---

## 3. Execution Stages
- **Stage 1**: Phone normalization & name standardization utilities (`contactsStandardizer.ts`).
- **Stage 2**: Native Capacitor Android plugin (`ContactsManagerPlugin.java`) and `AndroidManifest.xml` permissions.
- **Stage 3**: Contact sync service (`contactsSyncService.ts`) with audit categorization, duplicate detection, and web fallback.
- **Stage 4**: Interactive UI modal (`ContactsUnificationModal.tsx`) and entry points in `StudentsView.tsx` and `SettingsView.tsx`.
- **Stage 5**: Build verification with Vite compilation, TypeScript linting, and Android `./gradlew assembleDebug` check.
