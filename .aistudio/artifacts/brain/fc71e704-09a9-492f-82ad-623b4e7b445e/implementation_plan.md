# Glück Lernstudio — Complete Nano Banana Game Art, Audio & Effects Plan

Upgrade all 34 educational games in Glück Lernstudio (11 group/team contests and 23 solo practice games) with custom 3D cartoon illustrations generated via Nano Banana (`generate_image`), bundled locally for 100% offline Android Capacitor and Electron operation, paired with a Web Audio API sound synthesizer, offline German voice reactions, and contextual particle celebrations.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Revised Plan — Incorporating Mandatory Nano Banana Custom Game Art Generation.**
> Review the complete 34-game Nano Banana art inventory, batch generation strategy, and execution order below, then click **Proceed** to begin implementation.

- **Confirmed Decision 1: Authorized Nano Banana (`generate_image`) Custom Artwork Pipeline**
  - *Confirmed Approach*: Use the built-in Nano Banana image generation tool (`generate_image`) to produce original, high-craft 3D cartoon environments, mascots, interactive props, and victory rewards for the game library. Every generated asset is copied into the local project asset registry so it bundles cleanly for offline Android and Electron builds with zero remote runtime URLs.
  - *No Text Baked Into Art*: All generated illustrations strictly exclude embedded text (`no text, no letters, no numbers, no watermarks`), keeping German/Arabic prompts, scores, timers, and controls as crisp, accessible UI elements layered above the artwork.

- **Confirmed Decision 2: Organized Batch Generation & Pilot Validation**
  - *Confirmed Approach*: Execute artwork generation in structured thematic batches—starting with a representative sample game to validate style, aspect ratio (`16:9` stages, `1:1` character/prop cutouts), performance, and layout integration—followed by full batch rollout across all 11 Team Games and 23 Solo Practice Games, while sharing universal celebration trophies/medals to prevent redundant duplicates.

- **Confirmed Decision 3: Web Audio API Synthesizer, Offline German Voice & Motion Controls**
  - *Confirmed Approach*: Pair the custom Nano Banana visual assets with a zero-latency Web Audio API synthesizer, offline German spoken reactions (*“Richtig!”*, *“Super!”*, *“Fantastisch!”*, *“Sehr gut!”*, *“Weiter so!”*, *“Geschafft!”*, *“Du hast gewonnen!”*, *“Versuch es noch einmal!”*), and persisted accessibility settings (`Full`, `Reduced`, `Off` animation intensity + independent audio toggles).

---

## 1. Overview & Core Concept

- **What It Does**: Replaces flat or generic placeholders across all 34 Glück Lernstudio games with rich, tactile 3D cartoon illustrations generated with Nano Banana, accompanied by responsive sound effects, spoken German encouragement, and celebratory particle effects.
- **Target Audience**: Primary and middle school German learners and classroom teachers using smartboards, Android tablets, and desktop devices.
- **Key Value**: Gives every single game a memorable, toy-like visual world that directly reflects its gameplay mechanics while maintaining 100% offline reliability and preserving all existing educational rules and question adapters.

---

## 2. User Experience & Visual Design

### Global Art Direction (Nano Banana Style Constitution)

- **Shared Style Prompt Suffix**: Every Nano Banana generation prompt shares a unified art direction anchor:
  > *"3D stylized cartoon game illustration, Pixar and Nintendo toy-like aesthetic, warm studio lighting, soft ambient occlusion shadows, tactile rounded surfaces, vibrant saturated colors, friendly primary-school educational game style, clean composition, no text, no letters, no numbers, no UI overlays, no watermarks."*
- **Aspect Ratios & Asset Roles**:
  - **Stage & Arena Backgrounds (`16:9`)**: Wide scenic environments with a calm central/upper composition zone so question cards, timers, and interactive sprites remain 100% legible.
  - **Characters, Mascots & Interactive Objects (`1:1` or `4:3`)**: Isolated on clean solid/high-contrast backdrops or transparent-ready compositions for animated sprites, avatars, targets, and mystery containers.
  - **Shared Victory & Reward Assets (`1:1`)**: Golden championship trophy, silver/bronze medals, glowing star clusters, and treasure chests reused across victory celebration overlays.

---

## 3. Technical Architecture & Execution Pipeline

### Architecture & Asset Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                  NANO BANANA ART & AUDIO INTEGRATION ARCHITECTURE                │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────┐      ┌───────────────────────────────────────────┐  │
│  │  Nano Banana Generator  │─────>│        Local Bundled Asset Registry       │  │
│  │ (16:9 Stages & 1:1 Art) │      │ (Offline WebP/PNG + Typed Asset Manifest) │  │
│  └─────────────────────────┘      └─────────────────────┬─────────────────────┘  │
│                                                         │                        │
│  ┌─────────────────────────┐                            ▼                        │
│  │  GameSettings & Storage │─────>┌───────────────────────────────────────────┐  │
│  │ (Master/SFX/Voice/Anim) │      │   34 Game Views (11 Team + 23 Solo Games) │  │
│  └─────────────────────────┘      │  • Custom Stage Backdrop & Animated Props │  │
│                                   │  • Real UI Controls & Vocab Adapters      │  │
│  ┌─────────────────────────┐      │  • Web Audio SFX & Offline DE Voice Cues  │  │
│  │  GameCelebration Modal  │<─────│  • Sparkle Bursts & Floating Score Popups │  │
│  └─────────────────────────┘      └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Staged Execution Order

1. **Stage 1 — Audit & Shared Infrastructure**:
   - Establish the typed local Asset Registry, the Web Audio API sound/voice manager, the particle/floating-score effect layer, the Victory Celebration overlay, and the persistent Audio/Animation Settings bar.
2. **Stage 2 — Representative Sample Generation & Validation**:
   - Generate and integrate the complete Nano Banana art pack for the representative pilot game (*Smart Classroom Quiz* + shared victory reward pack), bundle locally, and verify visual fidelity, responsive layout, control legibility, and build cleanliness.
3. **Stage 3 — Batch Generation for Group & Team Games (11 Games)**:
   - Generate and bundle custom Nano Banana artwork in thematic batches (Arena/Quiz Batch, Racing/Construction Batch, Space/Sci-Fi Batch) and wire into all 11 team games with real state-driven animations and audio.
4. **Stage 4 — Batch Generation for Solo Practice Games (23 Games)**:
   - Generate and bundle custom Nano Banana artwork across the 23 solo games in thematic batches (Arcade Action Batch, Adventure/Exploration Batch, Workshop/Factory Batch, Detective/Mystery & Grammar Batch) and integrate with each game's mechanics.
5. **Stage 5 — Verification & Offline Build Audit**:
   - Verify every asset path, test all 34 game entry points, confirm zero remote asset URLs, and run full lint and production build checks.

---

## 4. Complete 34-Game Nano Banana Art Inventory & Prompt Plan

### Shared Celebration & Reward Batch
- **Assets**:
  1. `shared_victory_trophy` (`1:1`): Gleaming 3D cartoon golden championship cup with star emblems and confetti ribbons.
  2. `shared_mystery_chest` (`1:1`): Ornate cartoon wooden and gold treasure chest overflowing with glowing stars and coins.

---

### Part A: Group & Team Games (11 Games)

| # | Game Name (Mode ID) | Required Artwork & Aspect Ratio | Intended In-Game Usage & Animation | Nano Banana Generation Prompt Summary |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Smart Classroom Quiz** (`classroom`) | • Stage BG (`16:9`)<br>• Surprise Card Icons (`1:1`) | • Full-board TV studio backdrop behind question grid<br>• Animated flip reveals for Steal, Double, Swap, Shield & Bomb cards | *"Colorful 3D cartoon television quiz show stage studio with glowing spotlights, velvet curtains, and festive podiums, no text"* |
| **2** | **Tug of War** (`tug_of_war`) | • Arena BG (`16:9`)<br>• Pulling Team Mascots (`1:1`) | • Stadium field backdrop with central mud/grass line<br>• Left/right team mascots shifting horizontally with rope tension | *"Vibrant 3D cartoon outdoor sports stadium arena with green turf, festive banners, and a central competition zone, no text"* |
| **3** | **Spin Wheel Challenge** (`wheel`) | • Game Show Stage (`16:9`)<br>• Host Mascot (`1:1`) | • Carnival/studio stage behind the interactive spinning wheel<br>• Cheerful mascot reacting to wheel spin and prize reveal | *"Festive 3D cartoon carnival game show stage with warm marquee lights, colorful bunting, and golden spotlights, no text"* |
| **4** | **Team Car Race** (`race`) | • Racing Circuit BG (`16:9`)<br>• Cartoon Race Cars (`1:1`) | • Multi-lane raceway backdrop with grandstands and checkered arch<br>• Team cars advancing smoothly along lanes with boost trails | *"3D cartoon grand prix racing circuit track with cheering crowd grandstands, green hills, and checkered finish arch, no text"* |
| **5** | **Team Auction** (`team_auction`) | • Auction Hall BG (`16:9`)<br>• Golden Gavel & Coin Vault (`1:1`) | • Grand auction theater backdrop<br>• Animated gavel strike and coin stack transfers on winning bids | *"3D cartoon royal auction hall interior with red velvet stage, wooden podium, warm chandelier lighting, and gold coins, no text"* |
| **6** | **Galaxy Space Fleet** (`space_fleet`) | • Deep Space Nebula BG (`16:9`)<br>• Cartoon Starships & Alien Boss (`1:1`) | • Cosmic starfield stage behind fleet battle<br>• Starships firing animated laser beams on correct vocabulary hits | *"Colorful 3D cartoon outer space galaxy scene with glowing purple and blue nebula clouds, distant ringed planets, and stars, no text"* |
| **7** | **Rocket Countdown** (`rocket_countdown`) | • Launchpad Station BG (`16:9`)<br>• Cartoon Space Rocket (`1:1`) | • Cape Canaveral-style cartoon launch pad<br>• Rocket fueling stages, countdown vibration, and smoke/firework liftoff | *"3D cartoon space launchpad station at sunset with control tower, launch gantry, and scenic mountains, no text"* |
| **8** | **Tower Architects** (`tower_architects`) | • City Construction Skyline (`16:9`)<br>• Builder Mascot & Crane (`1:1`) | • Sunny city construction site backdrop<br>• Modular tower floors dropping and stacking per correct answer | *"3D cartoon sunny city skyline construction site with yellow tower cranes, blue sky, and fluffy clouds, no text"* |
| **9** | **Space Defender** (`space_defense`) | • Planetary Defense Base (`16:9`)<br>• UFO Invaders & Turret (`1:1`) | • Sci-fi moon base backdrop<br>• Turret rotating and firing energy bolts at descending UFO targets | *"3D cartoon sci-fi planetary defense moon base looking up at starry space with glowing energy shields, no text"* |
| **10** | **Word Tic-Tac-Toe** (`tictactoe`) | • Neon Arcade Arena (`16:9`)<br>• 3D X & O Gems (`1:1`) | • Tabletop/stadium arena framing the 3×3 grid<br>• Tactile 3D X and O emblems snapping into cells with winning beam | *"3D cartoon board game arena table in a cozy magical study room with warm lighting and golden trim, no text"* |
| **11** | **Team Sentence Builder** (`sentence_builder`) | • Grammar Workshop BG (`16:9`) | • Collaborative magnetic board studio<br>• Tactile word tiles snapping into grammar slots with team celebration | *"3D cartoon bright classroom invention studio with wooden workbenches, colorful gears, and warm sunlight, no text"* |

---

### Part B: Solo Practice Games (23 Games)

| # | Game Name (Mode ID) | Required Artwork & Aspect Ratio | Intended In-Game Usage & Animation | Nano Banana Generation Prompt Summary |
| :--- | :--- | :--- | :--- | :--- |
| **12** | **Balloon Pop** (`balloon_pop`) | • Sky Meadow BG (`16:9`)<br>• Glossy 3D Balloons (`1:1`) | • Scenic sky and floating clouds backdrop<br>• Swaying colorful balloons rising and popping into confetti bursts | *"3D cartoon sunny blue sky over rolling green hills with fluffy white clouds and hot air balloons in the distance, no text"* |
| **13** | **Whack-A-Word** (`whack_a_mole`) | • Garden Burrows BG (`16:9`)<br>• Cute Cartoon Mole (`1:1`) | • Lush garden lawn with earthen mounds<br>• Friendly mole popping up with vocabulary cards and playful mallet bounce | *"3D cartoon sunny vegetable garden meadow with wooden fences, flowers, and soft green grass, no text"* |
| **14** | **Vocab Basket Catch** (`basket_catch`) | • Sunny Orchard BG (`16:9`)<br>• Woven Picnic Basket (`1:1`) | • Fruit orchard backdrop<br>• Player sliding the woven basket left/right to catch falling items | *"3D cartoon sunlit apple orchard with lush green trees, wooden barrels, and astone garden path, no text"* |
| **15** | **Word Ninja** (`word_ninja`) | • Bamboo Dojo BG (`16:9`)<br>• Cartoon Ninja Mascot (`1:1`) | • Traditional wooden dojo backdrop<br>• Ninja mascot reacting as vocabulary targets are sliced with katana trails | *"3D cartoon Japanese martial arts dojo interior with polished wooden floors, paper lanterns, and bamboo garden view, no text"* |
| **16** | **Bridge Builder** (`bridge_builder`) | • River Canyon BG (`16:9`)<br>• Explorer Mascot (`1:1`) | • Sparkling river between two cliff shores<br>• Planks snapping into place and explorer walking across safely | *"3D cartoon scenic river canyon with two grassy cliff banks, sparkling blue water, and pine trees, no text"* |
| **17** | **Island Crossing** (`island_crossing`) | • Tropical Lagoon BG (`16:9`)<br>• Stepping Islands (`1:1`) | • Turquoise tropical lagoon backdrop<br>• Character hopping from island to island with water splash rings | *"3D cartoon tropical turquoise ocean lagoon with palm tree islands, sandy beaches, and sunny sky, no text"* |
| **18** | **Submarine Explorer** (`submarine_explore`) | • Coral Reef Abyss BG (`16:9`)<br>• Yellow Cartoon Submarine (`1:1`) | • Underwater coral reef environment<br>• Submarine diving with rising bubbles, sonar pulses, and treasure finds | *"3D cartoon underwater coral reef scene with sunbeams piercing blue water, colorful corals, and sea plants, no text"* |
| **19** | **Robot Repair** (`robot_repair`) | • Robotics Lab BG (`16:9`)<br>• Expressive Cartoon Robot (`1:1`) | • Futuristic tinkerer workshop<br>• Robot lighting up and dancing as vocabulary circuits are repaired | *"3D cartoon friendly robotics workshop lab with glowing circuit screens, tool racks, and a cute toy robot, no text"* |
| **20** | **Color Master** (`color_master`) | • Art Studio BG (`16:9`) | • Bright painter's studio with easels and paint pots<br>• Accessible color sorting vats with explicit labels and paint splashes | *"3D cartoon sunlit artist painting studio with wooden easels, colorful paint jars, brushes, and splatters, no text"* |
| **21** | **Factory Machine** (`factory_machine`) | • Toy Factory BG (`16:9`) | • Whimsical automated factory floor<br>• Animated conveyor belts transporting vocabulary crates into chutes | *"3D cartoon whimsical toy factory interior with conveyor belts, brass gears, sorting chutes, and warm lights, no text"* |
| **22** | **Puzzle Masters** (`puzzle_masters`) | • Thematic Reveal Artworks (`16:9`) | • Original Nano Banana illustrations hidden behind interlocking puzzle tiles that unlock per correct answer | *"3D cartoon magical German fairytale castle in a sunny alpine valley with a rainbow and forest, no text"* |
| **23** | **Target Attack** (`target_attack`) | • Archery Range BG (`16:9`)<br>• 3D Bullseye Target (`1:1`) | • Forest archery tournament range<br>• Arrows flying into bullseye targets with impact bounce | *"3D cartoon medieval forest tournament archery range with wooden fences, colorful tents, and green trees, no text"* |
| **24** | **Vending Machine** (`vending_machine`) | • Arcade Lobby BG (`16:9`)<br>• 3D Vending Machine (`1:1`) | • Cozy snack plaza backdrop<br>• Illuminated vending machine dispensing illustrated treats on correct input | *"3D cartoon colorful retro-modern snack vending machine glowing in a cheerful school lounge, no text"* |
| **25** | **What's in the Box?** (`whats_in_box`) | • Magic Stage BG (`16:9`)<br>• Expressive Mystery Box (`1:1`) | • Theater spotlight backdrop<br>• Shaking mystery box unlocking clue padlocks before popping open | *"3D cartoon magical wooden mystery gift box with golden locks and glowing sparkles on a velvet stage, no text"* |
| **26** | **Word Rhythm** (`word_rhythm`) | • Concert Stage BG (`16:9`) | • Vibrant music festival stage<br>• Pulsing soundwave rings and musical note tiles synced to synth chords | *"3D cartoon music concert stage with colorful speakers, glowing neon soundwaves, and musical instruments, no text"* |
| **27** | **Word Wash** (`word_wash`) | • Bubble Wash Station BG (`16:9`) | • Cheerful car/sign wash bay<br>• Foam bubbles and mud layers scrubbed away by an animated sponge | *"3D cartoon cheerful bubble wash station with glossy soap suds, water splashes, yellow sponges, and tiled wall, no text"* |
| **28** | **Follow the Clues** (`follow_clues`) | • Mystery Trail Map BG (`16:9`) | • Illustrated adventure island/town trail<br>• Magnifying glass spotlight and glowing footprints revealing progressive clues | *"3D cartoon adventure treasure map table with brass compass, magnifying glass, lantern, and tropical trail, no text"* |
| **29** | **Race Pit Stop** (`pit_stop`) | • Pit Lane Garage BG (`16:9`)<br>• Pit Crew Race Car (`1:1`) | • Formula pit stop bay<br>• Animated wheel changes, wrench spins, and fuel gauge fill on correct answers | *"3D cartoon racing pit stop garage with red toolboxes, racing tires, checkered floor, and pit lane, no text"* |
| **30** | **Word Detective** (`word_detective`) | • Detective Office BG (`16:9`)<br>• Sleuth Mascot (`1:1`) | • Cozy detective study with corkboard<br>• Detective mascot inspecting clue cards and revealing hidden letters | *"3D cartoon friendly detective office with a clue corkboard, red yarn, magnifying glass, and warm desk lamp, no text"* |
| **31** | **der / die / das Bins** (`sorting`) | • Sorting Courtyard BG (`16:9`)<br>• 3 Article Containers (`1:1`) | • Distinct blue (*der*), pink (*die*), and green (*das*) 3D sorting containers with shape/icon badges | *"3D cartoon colorful recycling and sorting plaza with three vibrant open containers in blue, pink, and green, no text"* |
| **32** | **Memory Match** (`memory`) | • Enchanted Table BG (`16:9`)<br>• Custom Card Back Art (`1:1`) | • Cozy game table backdrop<br>• Custom illustrated 3D card backs with smooth perspective flip animations | *"3D cartoon ornate magical card back emblem with a golden star crest on royal blue pattern, no text"* |
| **33** | **Comprehensive Practice** (`game`) | • Lernstudio Arena BG (`16:9`) | • Bright learning studio backdrop across all 5 exercise types with streak fireworks and mascot cheering | *"3D cartoon futuristic bright learning studio classroom with floating holographic stars, bookshelves, and warm light, no text"* |
| **34** | **Solo Sentence Builder** (`solo_sentence`) | • Grammar Desk BG (`16:9`) | • Focused solo sentence-building workbench with magnetic word blocks and grammar check animations | *"3D cartoon cozy wooden study desk with colorful building blocks, lamp, and sunny window view, no text"* |
