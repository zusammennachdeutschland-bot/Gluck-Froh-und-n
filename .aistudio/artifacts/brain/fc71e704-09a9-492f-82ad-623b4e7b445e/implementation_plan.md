# German Verb Conjugation Upgrade — Lernstudio AI Generator & Question Adapter

Enhance the **Glück Lernstudio** AI prompt generator and exercise engine to identify, extract, and test German verb conjugations in the present tense (*Präsens*) exclusively from teacher-supplied lesson materials, textbook photos, or worksheets. The generated exercises utilize varied subjects (pronouns, names, combined subjects) and seamlessly integrate into all 31 interactive games as 4-option multiple-choice sentence completion items.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1:

- **Confirmed Decision 1 (Exercise Format)**: Verb conjugation exercises are generated as sentence completion items with 4 conjugated options (e.g. *"Ahmed ______ (fahren) zur Schule."* $\rightarrow$ options: `["fährt", "fahre", "fährst", "fahren"]`). This guarantees 100% immediate compatibility across all 31 existing games (Race, Tug of War, Balloon Pop, Spin Wheel, Jeopardy, Space Defense, etc.).
- **Confirmed Decision 2 (UI Integration)**: A dedicated **"Verb Conjugation Focus"** toggle switch is added to the AI Prompt Generator tab in `LernstudioAiModal.tsx`, allowing teachers to explicitly request present-tense verb conjugation exercises from their lesson text or photo.

---

## 1. Overview & Core Concept

- **What It Does**: Teachers upload or paste textbook content, worksheets, or lesson topics into the AI Prompt Generator. When the **Verb Conjugation** option is enabled, the AI prompt instructs external LLMs (Gemini / ChatGPT) to:
  1. Extract verbs strictly present in the provided lesson source (no invented verbs).
  2. Formulate natural German sentence-completion questions exclusively in the *Präsens* (present tense), testing regular, irregular, and stem-changing verbs.
  3. Vary subject types across standard pronouns (*ich*, *du*, *wir*, *ihr*), single names (*Ahmed*, *Mona*), multiple names (*Ahmed und Mona*), combined subjects (*du und ich*, *Ahmed und ich*), and lesson noun subjects.
  4. Provide 4 realistic conjugated options for subject-verb agreement validation.
- **Target Audience**: German language teachers and Grade 1–12 students learning German as a foreign language (*Deutsch als Fremdsprache*).
- **Key Value**: 100% offline-compatible, prompt-driven exercise generation that turns static textbook pages into rich interactive conjugation practice games without cloud dependencies or breaking existing sets.

---

## 2. User Experience & Visual Design

### User Flow
1. **Teacher Action**: Teacher opens **Lernstudio**, clicks **"AI Generator & Import"** (`Sparkles` modal).
2. **Configuration**:
   - Chooses a preset topic or pastes textbook text / page context.
   - Toggles **"Verb Conjugation Focus (Präsens)"** ON.
   - Adjusts Grade Level (*روضة* to *جريد 12*), CEFR Level (*A1*–*C2*), and Question Count.
3. **Prompt Copying**: Clicks **"Copy Prompt"** to copy the generated prompt to ChatGPT or Gemini.
4. **JSON Import**: Pastes the resulting JSON back into Tab 2 ("Import JSON Code").
5. **Instant Game Play**: The set is parsed and validated. All 31 game modes immediately load the verb conjugation sentence questions with subject-verb options, audio speech synthesis, and scoring.

### Visual Identity & Layout
- **Modal Toggle**: Clean segmented toggle button in `LernstudioAiModal.tsx` styled with Tailwind tokens, featuring a clear `Sparkles` or `BookOpen` icon, active ring highlight, and helper subtext (*"Extrahierte Verben im Präsens konjugieren"*).
- **Zero Pill / Anti-Slop**: Unboxed text metadata separators (`·`), clean typography using system display fonts, and clear status feedback during JSON repair/validation.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Reusing `customExercises` & `multiple_choice` Format**:
  - *Chosen Approach*: Embed verb conjugation sentence completion items into `customExercises` and `items` using `type: 'multiple_choice'`.
  - *Why*: All 31 game engines in `Lernstudio` are already built to consume `multiple_choice` questions from `buildDynamicQuestionPool`. This provides zero-friction compatibility without editing individual game files.
- **Decision 2: 8-Step Aggressive JSON Parser Compatibility**:
  - *Chosen Approach*: Enhance `validateAndParseLernstudioJson` in `lernstudioAiUtils.ts` to detect verb conjugation sentence structures and automatically clean parentheses or blank placeholder underscores (`______`).
  - *Why*: Ensures LLM output formatting variations (e.g. `(fahren)` or `_____`) parse cleanly without throwing errors.

---

## 4. Technical Architecture & Data Strategy

### System Component & Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LernstudioAiModal.tsx                              │
│  [Topic / Text Input]  [Grade / CEFR Level]  [Verb Conjugation Toggle: ON]   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   generateLernstudioPrompt (lernstudioAiUtils.ts)           │
│  • Enforces Präsens-only rules & strict source verb extraction               │
│  • Enforces subject variation (pronouns, names, combined subjects)           │
│  • Generates JSON schema for sentence completion + 4 conjugated options     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                         (Copy Prompt -> Paste JSON)
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             validateAndParseLernstudioJson (lernstudioAiUtils.ts)            │
│  • 8-Step Repair Pipeline & Sanitizer                                       │
│  • Validates customExercises, sentence completion, & option sets            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               buildDynamicQuestionPool (lernstudioQuestionAdapter.ts)       │
│  • Adapts conjugation exercises into standardized GameQuestion objects      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      All 31 Lernstudio Game Engines                         │
│  (Race, Tug of War, Spin Wheel, Jeopardy, Space Defense, Balloon Pop, etc.) │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Affected Source Files
- `/src/utils/lernstudioAiUtils.ts`: Update `PromptGenConfig` interface to include `includeVerbConjugation?: boolean;`, update `generateLernstudioPrompt` with strict Präsens rules, verb extraction constraints, varied subject patterns, and schema examples. Enhance `validateAndParseLernstudioJson` to handle verb conjugation exercise validation.
- `/src/components/lernstudio/LernstudioAiModal.tsx`: Add state `isVerbConjugationFocused`, add UI toggle control with clear German/Arabic labels, pass state to `generateLernstudioPrompt`.
- `/src/utils/lernstudioQuestionAdapter.ts`: Verify and refine `buildDynamicQuestionPool` to map verb conjugation items into `GameQuestion` with optimal prompt labels and options.

---

## Verification Plan

1. **Lint Check**: Run `npm run lint` (`lint_applet`) to ensure zero TypeScript or syntax errors.
2. **Build Check**: Run `npm run build` (`compile_applet`) to verify clean production compilation.
3. **Manual Flow Verification**:
   - Verify prompt generation with Verb Conjugation toggle ON vs OFF.
   - Verify JSON parser handling sample verb conjugation JSON payloads with varied subjects (*"Ahmed ______ (fahren)"*, *"Du und ich ______ (spielen)"*).
   - Verify `buildDynamicQuestionPool` output for game engines.
