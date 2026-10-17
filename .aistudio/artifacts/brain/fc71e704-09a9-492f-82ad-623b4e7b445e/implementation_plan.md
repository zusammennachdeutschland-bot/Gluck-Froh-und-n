# German Text-to-Speech (TTS) Optimization & Custom Controls Plan for Android APK & Linux

Comprehensive strategy to solve German Text-To-Speech (TTS) issues in Android APK (Capacitor/WebView) and Linux desktop environments, ensuring German pronunciation enforcement, local engine priority, multi-tier online fallbacks, and customizable speed controls (re-play & slow mode).

> [!IMPORTANT] User Confirmed Preferences
> - **Speed Controls & Actions**: Add direct speed toggle controls (Normal 1.0x / Slow 0.65x) and replay buttons on all German learning boards and interactive games.
> - **Engine Hierarchy**: Priority goes to the local device speech synthesis engine (`de-DE` locale), falling back seamlessly to direct HTTPS Google/Youdao audio streams when local speech is unavailable.
> - **Language Enforcement**: All German vocabulary and sentence pronunciations are strictly forced to `de-DE` locale, ignoring any English/Arabic UI language choices.

---

## 1. Overview & Core Concept

- **What It Does**: Resolves all audio mute/English accent bugs in Android APK builds and Linux packages. Provides native, crisp German voice audio across all classroom modules, games (basketball, sentence builder, word ninja, etc.), and vocabulary cards with instant audio unlockers and slow-playback mode (`0.65x`).
- **Target Audience / Persona**: German learners operating the app on Android phones/tablets as an installed APK or desktop users on Linux.
- **Key Value**: Guarantees offline/online speech reliability without regional audio failure or language misconfiguration.

---

## 2. User Experience & Visual Design

- **Audio Control Bar / Replay Buttons**:
  - Integrated speaker icons (`Volume2`) with secondary slow-speech toggle button (`0.65x` / turtle icon) beside cards and sentence prompts.
  - Interactive micro-feedback: Brief pulse animation when audio plays, preventing double-taps.
- **Language & Speech Consistency**:
  - Unconditional German speech playback (`de-DE`) across all UI language modes (Arabic, English, German).
  - Explicit audio context unlocker on first user touch (`touchstart`, `pointerdown`) for mobile WebView autoplay permissions.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Local Device Speech Engine (`SpeechSynthesisUtterance`) First**:
  - *Chosen Approach*: Query local voices for `de-DE` or `de_*`. If speech starts within `200ms`, use local native TTS (zero network latency, works offline).
  - *Why*: User selected local engine priority for offline support and responsiveness.
  - *Fallback*: If local engine fails or has no German voice, automatically fall back to multi-tier HTTPS audio streams (`Google Translate TTS`, `Youdao`, `TTS Quest`, server proxy).

- **Decision 2: Dedicated Speed Rate Support (`rate: number = 0.85` or `0.65`)**:
  - *Chosen Approach*: Pass configurable rate parameters into `speakGermanText(text, rate)`.
  - *Why*: Allows slow playback for complex German compounds and sentence builders.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        User Interaction (APK / Web)                     │
│               [Tap German Word / Press Slow Speech Button]              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Audio Speech Utility (speakGermanText)                │
│                 Unconditional 'de-DE' Locale Enforcement                │
└──────────────────┬──────────────────────────────────────┬───────────────┘
                                     │
                   ┌─────────────────┴─────────────────┐
                   │                                   │
                   ▼ (Local Device First)              ▼ (Fallback >200ms / Error)
┌──────────────────────────────────────┐ ┌────────────────────────────────┐
│   window.speechSynthesis (de-DE)    │ │      HTML5 Multi-Tier Audio     │
│  - Native German Voice               │ │  1. Google HTTPS TTS           │
│  - Custom Playback Rate (1.0x / 0.65)│ │  2. Youdao HTTPS Audio         │
│  - Offline Native Output             │ │  3. TTS Quest Backup           │
└──────────────────────────────────────┘ └────────────────────────────────┘
```

### Component & Utility Mapping
- **`src/utils/audioSpeechUtils.ts`**:
  - Enforce `de-DE` locale on all speech synthesis utterances.
  - Enhance `playFallbackTts` to support variable `playbackRate` on `HTMLAudioElement`.
  - Strengthen voice detection for Android WebViews (`com.google.android.tts`).
- **Game Components & Classroom (`LernstudioClassroomBoard`, Game Modules)**:
  - Connect audio control states (normal vs. slow rate) to `speakGermanText`.
