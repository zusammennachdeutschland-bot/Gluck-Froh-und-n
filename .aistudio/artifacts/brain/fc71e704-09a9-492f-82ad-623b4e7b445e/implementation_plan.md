# Glück Teacher — Massive Children's German Vocabulary Library (300+ Sets / 3,000+ Words)

A comprehensive, scalable curriculum transforming Glück Teacher into a massive German vocabulary learning system designed specifically for children, featuring 300 curated Sets, 3,000 unique vocabulary items across 30 thematic domains (A to AD), structured by Grade Level and thematic categories.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during the planning phase:
> - **Pre-loaded Delivery**: All 300+ Sets will be pre-loaded directly into the application for immediate, zero-friction access by teachers and students without manual upload requirements.
> - **Curriculum Replacement**: The legacy sample sets will be cleanly replaced with the new, complete 300-set curriculum ("شيل القديم واعمل جديد").
> - **Browsing Hierarchy**: The primary browsing flow will lead with **Grade Level** (Preschool/Kindergarten, Grade 1 to 6, A1, A2) followed by **Thematic Category** (Animals, Food, Family, School, Daily Life, etc.).

---

### 1. Overview & Core Concept

- **What It Does**: Provides a complete, multi-year German language curriculum for children spanning 30 core domains (from First Words, Numbers, Animals, and Food to School, Daily Routines, Grammar, and Story Worlds).
- **Structure**: Exactly 10 high-quality vocabulary items per Set. Each entry includes:
  - Correct German word/phrase with proper capitalization.
  - Accurate Arabic translation tailored for children.
  - Grammatical gender and definite article (`der` / `die` / `das`) for all German nouns.
  - Plural forms (`die Katzen`, `die Bücher`) for nouns.
  - Meaningful emoji representation for visual memory.
  - Child-friendly German example sentence and Arabic translation.
  - Missing letter and sentence-building elements compatible with all 16 Lernstudio games and the 5-stage Teach Mode.
- **Target Audience**: German language teachers, tutors, and elementary/kindergarten students learning German as a second language.

---

### 2. User Experience & Visual Design

- **Primary Grade Navigation Bar**:
  - Segmented, single-line grade switcher at the top of the sets view: `روضة وأطفال (Preschool)` | `جريد 1` | `جريد 2` | `جريد 3` | `جريد 4` | `جريد 5` | `جريد 6` | `A1 أساسي` | `A2 متقدم`.
  - Shows total sets and vocabulary counts per grade dynamically (e.g. `جريد 1 · 45 مجموعة · 450 مفردة`).
- **Thematic Sub-Navigation & Domain Filter**:
  - Secondary filter allowing teachers to focus on specific domains (e.g. `🐾 الحيوانات`, `🍎 الطعام والشراب`, `🏫 المدرسة`, `⏰ الوقت والروتين`, `🪢 الأفعال والحركة`).
- **Search & Filter Controls**:
  - Instant real-time search across German words, German titles, and Arabic translations.
  - Fast-action buttons on each Set Card:
    - `📖 مود الشرح`: Launches the 5-stage interactive teaching flow.
    - `🎮 الألعاب`: Opens the 16-game classroom & solo portal.
    - `👁️ المفردات`: Opens the 10-word inspection & pronunciation sheet.
    - `📄 ورقة عمل`: Generates and prints worksheets.
- **Visual Discipline & Zero-Pill Rules**:
  - Unboxed metadata with quiet dot separators (`10 كلمات · الصف الأول · المستوى A1`).
  - No bouncing emojis or shaking interface elements.
  - Full-width desktop responsiveness (1440px baseline) with compact, thumb-friendly mobile layouts.

---

### 3. Key Product Decisions & Trade-Offs

- **Modular Dataset Architecture (Batch Storage)**:
  - Instead of bloating a single monolithic file that risks compiler crashes or editing timeouts, the 300 Sets will be organized into clean, modular domain batch files under `src/data/curriculum/`:
    - `batch01_first_words_numbers.ts` (Domains A, B, C)
    - `batch02_animals_nature.ts` (Domains D, L, M)
    - `batch03_food_drinks.ts` (Domain E)
    - `batch04_family_body_health.ts` (Domains F, G, H)
    - `batch05_school_toys_hobbies.ts` (Domains I, J)
    - `batch06_home_town_jobs.ts` (Domains K, N, O, P)
    - `batch07_time_verbs_actions.ts` (Domains R, S, X)
    - `batch08_adjectives_grammar_prepositions.ts` (Domains T, U, V)
    - `batch09_shopping_tech_emotions_safety.ts` (Domains W, Z, AA, AB)
    - `batch10_stories_culture_advanced.ts` (Domains Q, AC, AD)
  - An index aggregator (`src/data/curriculum/index.ts`) will compile, validate, and export the complete 300-set library with guaranteed 3,000 words.
- **Exact 10-Item Invariant**:
  - Strict validation ensures every single Set has `items.length === 10`.
  - No placeholder items or fabricated words.
- **Migration & LocalStorage Synchronization**:
  - Update `src/context/AppContext.tsx` so the initial state immediately loads the fresh 300 Sets curriculum, purging legacy sample sets while preserving any user-saved preferences.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   App UI Layer                         │
│  LernstudioView (Grade Switcher & Category Explorer)   │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
┌───────────────────────────────┐  ┌─────────────────────┐
│      5-Stage Teach Mode       │  │  16 Game Engines    │
│  (Showcase ➔ True/False ➔    │  │  (Tug of War, Race, │
│   2-Choice ➔ All ➔ Games)     │  │   Ninja, Wheel, etc)│
└──────────────┬────────────────┘  └──────────┬──────────┘
               │                              │
               └──────────────┬───────────────┘
                              ▼
┌────────────────────────────────────────────────────────┐
│             AppContext & State Store                   │
│        storage.setItem('dl_lernstudio_sets')           │
└─────────────────────────────┬──────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────┐
│     Modular Curriculum Repository (300 Sets)           │
│  src/data/curriculum/                                  │
│  ├── batch01_first_words_numbers.ts                    │
│  ├── batch02_animals_nature.ts                         │
│  ├── batch03_food_drinks.ts                            │
│  ├── batch04_family_body_health.ts                     │
│  ├── batch05_school_toys_hobbies.ts                    │
│  ├── batch06_home_town_jobs.ts                         │
│  ├── batch07_time_verbs_actions.ts                     │
│  ├── batch08_adjectives_grammar_prepositions.ts        │
│  ├── batch09_shopping_tech_emotions_safety.ts          │
│  └── batch10_stories_culture_advanced.ts               │
└────────────────────────────────────────────────────────┘
```

- **Validation Routine**:
  - An internal automated integrity check will verify:
    1. Total Sets $\ge 300$.
    2. Total vocabulary items $\ge 3,000$.
    3. Every Set has exactly 10 items.
    4. Unique set IDs and valid German/Arabic text.
- **Compatibility**:
  - Works out of the box with the newly added games (`Tug of War`, `Word Ninja`, `Whack-A-Mole`, `Space Defense`, `Word Detective`) and cross-platform Android speech synthesis.
