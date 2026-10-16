# Full App-Wide Language Synchronization & Dynamic AI Multilingual Translations for Lernstudio

Complete alignment of every interface string across Lernstudio (set cards, games portal, interactive games, worksheets, teach mode modals, AI set generator, and header tools) with the application's active language context (`ar`, `de`, `en`). Incorporates automated AI multi-language translation for custom set titles and content so every set renders seamlessly in Arabic, German, and English without language mismatch or fallback distortion.

## User Review & Critical Decisions

> [!IMPORTANT]
> Language synchronization will strictly respect the app's active language setting across **100% of Lernstudio views**. No static hardcoded Arabic strings will leak when English or German is active, and vice versa. Custom set titles will be automatically translated into all 3 languages via Gemini AI.

- **Confirmed Decision 1 (100% App Language Alignment)**: Follow the active parent app language setting (`ar`, `de`, `en`) across all UI elements: buttons, badges, section headers, instructions, victory toasts, team race setups, memory cards, sentence builder prompts, and worksheet printouts.
- **Confirmed Decision 2 (Full Scope Audit)**: Audit and synchronize strings in:
  1. Set Cards & Action Bar (`LernstudioView`, `LernstudioSetCard`)
  2. Games Portal & Category Headers (`LernstudioGamesPortalView`)
  3. Individual Games (`LernstudioSortingGame`, `LernstudioSentenceGame`, `LernstudioWheelGame`, `LernstudioClassroomBoard`, `LernstudioMemoryGame`, `LernstudioRaceGame`)
  4. Teaching & Presentation Modals (`LernstudioTeachModeModal`)
  5. Printable Worksheets (`LernstudioWorksheetModal`)
  6. AI Prompt Generator & Set Editor (`LernstudioAiModal`, `LernstudioSetEditorModal`)
- **Confirmed Decision 3 (AI Dynamic Multilingual Translations)**: For user-created or edited custom sets, send the title and topic to Gemini AI to obtain and store translations for all 3 languages (`ar`, `de`, `en`), ensuring set titles change gracefully when switching app languages.

---

## 1. Overview & Core Concept

### What It Does
- **Unified Translation Layer**: Replaces isolated string literals with a comprehensive, type-safe dictionary (`LERNSTUDIO_I18N`) supporting Arabic (`ar`), German (`de`), and English (`en`).
- **Directional & Layout Posture**: Automatically toggles document direction (`dir="rtl"` vs `dir="ltr"`), font family, and spatial layout according to the active language.
- **AI Set Localizer**: Automatically translates custom set titles, topics, and descriptions into Arabic, German, and English using Gemini AI upon creation or edition.

### Target Audience & Persona
Teachers and students using Lernstudio for German instruction who require an uncompromised, native interface experience in their selected language.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌─────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│ User Toggles Language   │ ───► │ Lernstudio Dictionary     │ ───► │ Re-renders UI in 'ar',    │
│ (App Header: ar/de/en) │      │ Maps Active Strings       │      │ 'de', or 'en' instantly   │
└─────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘
                                               │
                                               ▼
                                 ┌───────────────────────────┐
                                 │ Custom Set Title/Topic    │
                                 │ fetched via Gemini AI     │
                                 │ multi-lang translation    │
                                 └───────────────────────────┘
```

1. **Set Cards**: Display localized metadata (Grade/Level, Exercise count, Action buttons like "Games & Competitions", "Teach Mode", "Worksheets") matching the selected app language.
2. **Games Portal**: Screen titles ("لوحة الألعاب والمسابقات", "Games & Competition Portal", "Spiele & Wettbewerbe Portal"), category descriptions, and game difficulty tags adjust smoothly.
3. **Interactive Games**:
   - **Sentence Scramble**: Hints ("تلميح" / "Hint" / "Hinweis"), Check Answer ("تحقق" / "Check" / "Prüfen"), Clear ("إعادة" / "Reset" / "Zurücksetzen").
   - **Word Bins (der/die/das)**: Bins labeled "der", "die", "das", feedback banner ("إجابة صحيحة!" / "Correct!" / "Richtig!").
   - **Spin Wheel & Team Race**: Wheel spin CTA, team scoreboards, victory modal text.
4. **Worksheets**: Printed headers, instructions ("اختر الإجابة الصحيحة", "صل الكلمات"), and teacher guide notes render in the active target language.

### Visual Identity & Theme
- **Anti-Slop Discipline**: Metadata rendered as clean unboxed text with subtle typographic dot separators (`·`).
- **Typography & Posture**: Tajawal / Alexandria for Arabic (RTL), Plus Jakarta Sans for English and German (LTR).
- **Color Budget**: 60% Slate canvas (`bg-slate-950` / `bg-slate-50`), 30% card surface (`bg-slate-900/90`), 10% focal accents (`emerald-500`, `amber-500`, `sky-500`).

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Complete Centralized i18n Map vs Fragmented Inline Logic
- **Chosen Approach**: Build a single `LERNSTUDIO_I18N` structure in `src/utils/lernstudioI18n.ts` with explicit language keys (`ar`, `de`, `en`).
- **Why**: Eliminates copy-paste mistakes, missing fallbacks, and untranslated string leaks across components.

### Decision 2: Automatic Background AI Translation for Custom Sets
- **Chosen Approach**: Enhance `lernstudioAiUtils.ts` with a helper `translateSetTitleAndTopic(title, topic, targetLangs)` that calls Gemini AI to get localized titles for `ar`, `de`, and `en`. Store these in `set.titleTranslations` and `set.topicTranslations`.
- **Why**: Fulfills the user's explicit requirement ("ترجمها و اطلب من ال Ai إنه يجيب لك ترجمتها لل3 لغات") so custom user sets don't stay locked in a single language.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             App Language Context                         │
│                             ('ar'  |  'de'  |  'en')                     │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      LERNSTUDIO_I18N Dictionary                          │
│   (common, cards, gamesPortal, sorting, sentence, wheel, race, sheets)   │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ├──────────────────────────────┐
                                     ▼                              ▼
┌─────────────────────────────────────────┐    ┌───────────────────────────┐
│          Lernstudio Components          │    │   LernstudioSet Data      │
│ (SetCards, GamesPortal, Games, Modals)  │    │  (titleTranslations)      │
└─────────────────────────────────────────┘    └─────────────┬─────────────┘
                                                             │
                                                             ▼
                                               ┌───────────────────────────┐
                                               │   Gemini AI Translator    │
                                               │ (translateSetTitleAndTopic│
                                               └───────────────────────────┘
```

### Affected Files & Scope
1. `src/utils/lernstudioI18n.ts` (New unified translation dictionary)
2. `src/types/lernstudio.ts` (Add `titleTranslations` & `topicTranslations` to `LernstudioSet`)
3. `src/utils/lernstudioAiUtils.ts` (Add Gemini AI translation function for 3 languages)
4. `src/components/lernstudio/LernstudioView.tsx` (Card buttons, headers, action bar)
5. `src/components/lernstudio/LernstudioGamesPortalView.tsx` (Portal UI strings)
6. `src/components/lernstudio/games/LernstudioSentenceGame.tsx` (Sentence game UI strings)
7. `src/components/lernstudio/games/LernstudioSortingGame.tsx` (Sorting game UI strings)
8. `src/components/lernstudio/games/LernstudioWheelGame.tsx` (Wheel game UI strings)
9. `src/components/lernstudio/LernstudioClassroomBoard.tsx` (Classroom board strings)
10. `src/components/lernstudio/LernstudioTeachModeModal.tsx` & `LernstudioWorksheetModal.tsx` (Teach mode & Worksheets)

---

## Verification Plan

1. **Compilation Check**: Run `compile_applet` and `lint_applet` to ensure zero TypeScript errors.
2. **Language Switch Test**: Toggle application language between `ar`, `de`, and `en` in the header and verify every section (cards, games, modals, worksheets) updates immediately.
3. **Custom Set AI Translation Test**: Generate/edit a custom set and confirm title translations for all 3 languages are generated and rendered accurately when switching languages.
