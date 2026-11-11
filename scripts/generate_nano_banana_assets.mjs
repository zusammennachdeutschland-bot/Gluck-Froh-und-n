/**
 * Nano Banana (Gemini 2.5 Flash Image) Resumable Batch Generator & Auditor
 * ------------------------------------------------------------------------
 * Manages the generation of 3D cartoon stage illustrations and reward props
 * for Glück Lernstudio. Designed with strict tool integrity:
 * - Resumable: Does not overwrite existing valid assets unless --force is passed.
 * - Quota-Safe: Halts gracefully if rate-limited or quota is exceeded.
 * - Transparent: Tracks asset provenance in public/assets/games/asset_provenance.json.
 * - Zero Secrets: Reads GEMINI_API_KEY from environment without logging it.
 *
 * Usage:
 *   node scripts/generate_nano_banana_assets.mjs --status
 *   node scripts/generate_nano_banana_assets.mjs --dry-run
 *   GEMINI_API_KEY="key" node scripts/generate_nano_banana_assets.mjs --batch=batch_0_shared_rewards
 *   GEMINI_API_KEY="key" node scripts/generate_nano_banana_assets.mjs --item=balloon_pop --force
 */
import fs from 'node:fs/promises';
import existsSync from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/assets/games');
const PROVENANCE_FILE = path.join(OUTPUT_DIR, 'asset_provenance.json');

const STYLE_SUFFIX =
  '3D stylized cartoon game illustration, Pixar and Nintendo toy-like aesthetic, warm studio lighting, soft ambient occlusion shadows, tactile rounded surfaces, vibrant saturated colors, friendly primary-school educational game style, clean composition, no text, no words, no letters, no numbers, no UI overlays, no watermarks.';

export const NANO_BANANA_BATCH_PROMPTS = [
  // Batch 0: Shared Rewards
  { id: 'shared_victory_trophy', batch: 'batch_0_shared_rewards', file: 'shared_victory_trophy.webp', width: 512, height: 512, aspectRatio: '1:1', prompt: `Gleaming 3D cartoon golden championship cup trophy with glowing star emblems and celebration ribbons on a royal velvet pedestal, ${STYLE_SUFFIX}` },
  { id: 'shared_mystery_chest', batch: 'batch_0_shared_rewards', file: 'shared_mystery_chest.webp', width: 512, height: 512, aspectRatio: '1:1', prompt: `Ornate 3D cartoon wooden and gold treasure chest overflowing with glowing stars and coins, ${STYLE_SUFFIX}` },

  // Batch 1: Team Arena & Quiz
  { id: 'classroom', batch: 'batch_1_team_arena_quiz', file: 'classroom_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `Colorful 3D cartoon television quiz show stage studio with glowing spotlights, velvet curtains, and festive podiums, ${STYLE_SUFFIX}` },
  { id: 'tug_of_war', batch: 'batch_1_team_arena_quiz', file: 'tug_of_war_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `Vibrant 3D cartoon outdoor sports stadium arena with green turf, festive banners, and a central competition rope zone, ${STYLE_SUFFIX}` },
  { id: 'wheel', batch: 'batch_1_team_arena_quiz', file: 'wheel_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `Festive 3D cartoon carnival game show stage with warm marquee lights, colorful bunting, and golden spotlights, ${STYLE_SUFFIX}` },
  { id: 'team_auction', batch: 'batch_1_team_arena_quiz', file: 'team_auction_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon royal auction hall interior with red velvet stage, wooden podium, golden gavel, warm chandelier lighting, and gold coins, ${STYLE_SUFFIX}` },
  { id: 'tictactoe', batch: 'batch_1_team_arena_quiz', file: 'tictactoe_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon board game arena table in a cozy magical study room with warm lighting and golden trim, ${STYLE_SUFFIX}` },

  // Batch 2: Racing & Construction
  { id: 'race', batch: 'batch_2_team_racing_construction', file: 'race_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon grand prix racing circuit track with cheering crowd grandstands, green hills, and checkered finish arch, ${STYLE_SUFFIX}` },
  { id: 'tower_architects', batch: 'batch_2_team_racing_construction', file: 'tower_architects_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon sunny city skyline construction site with yellow tower cranes, blue sky, and fluffy clouds, ${STYLE_SUFFIX}` },
  { id: 'pit_stop', batch: 'batch_2_team_racing_construction', file: 'pit_stop_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon racing pit stop garage with red toolboxes, racing tires, checkered floor, and pit lane, ${STYLE_SUFFIX}` },

  // Batch 3: Space & Sci-Fi
  { id: 'space_fleet', batch: 'batch_3_team_space_scifi', file: 'space_fleet_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `Colorful 3D cartoon outer space galaxy scene with glowing purple and blue nebula clouds, distant ringed planets, and stars, ${STYLE_SUFFIX}` },
  { id: 'rocket_countdown', batch: 'batch_3_team_space_scifi', file: 'rocket_countdown_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon space launchpad station at sunset with control tower, launch gantry, and scenic mountains, ${STYLE_SUFFIX}` },
  { id: 'space_defense', batch: 'batch_3_team_space_scifi', file: 'space_defense_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon sci-fi planetary defense moon base looking up at starry space with glowing energy shields, ${STYLE_SUFFIX}` },

  // Batch 4: Solo Arcade Action
  { id: 'balloon_pop', batch: 'batch_4_solo_arcade_action', file: 'balloon_pop_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon sunny blue sky over rolling green hills with fluffy white clouds and glossy colorful balloons, ${STYLE_SUFFIX}` },
  { id: 'whack_a_mole', batch: 'batch_4_solo_arcade_action', file: 'whack_a_mole_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon sunny vegetable garden meadow with wooden fences, flowers, earthen burrows, and soft green grass, ${STYLE_SUFFIX}` },
  { id: 'basket_catch', batch: 'batch_4_solo_arcade_action', file: 'basket_catch_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon sunlit apple orchard with lush green trees, wooden barrels, and a stone garden path, ${STYLE_SUFFIX}` },
  { id: 'word_ninja', batch: 'batch_4_solo_arcade_action', file: 'word_ninja_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon Japanese martial arts dojo interior with polished wooden floors, paper lanterns, and bamboo garden view, ${STYLE_SUFFIX}` },
  { id: 'target_attack', batch: 'batch_4_solo_arcade_action', file: 'target_attack_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon forest tournament archery range with wooden fences, colorful tents, and green trees, ${STYLE_SUFFIX}` },
  { id: 'word_rhythm', batch: 'batch_4_solo_arcade_action', file: 'word_rhythm_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon music concert stage with colorful speakers, glowing neon soundwaves, and musical instruments, ${STYLE_SUFFIX}` },

  // Batch 5: Solo Adventure & Exploration
  { id: 'bridge_builder', batch: 'batch_5_solo_adventure_exploration', file: 'bridge_builder_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon scenic river canyon with two grassy cliff banks, sparkling blue water, and pine trees, ${STYLE_SUFFIX}` },
  { id: 'island_crossing', batch: 'batch_5_solo_adventure_exploration', file: 'island_crossing_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon tropical turquoise ocean lagoon with palm tree islands, sandy beaches, and sunny sky, ${STYLE_SUFFIX}` },
  { id: 'submarine_explore', batch: 'batch_5_solo_adventure_exploration', file: 'submarine_explore_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon underwater coral reef scene with sunbeams piercing blue water, colorful corals, and sea plants, ${STYLE_SUFFIX}` },
  { id: 'puzzle_masters', batch: 'batch_5_solo_adventure_exploration', file: 'puzzle_masters_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon magical German fairytale castle in a sunny alpine valley with a rainbow and forest, ${STYLE_SUFFIX}` },

  // Batch 6: Solo Workshop & Factory
  { id: 'robot_repair', batch: 'batch_6_solo_workshop_factory', file: 'robot_repair_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon friendly robotics workshop lab with glowing circuit screens, tool racks, and a cute toy robot, ${STYLE_SUFFIX}` },
  { id: 'color_master', batch: 'batch_6_solo_workshop_factory', file: 'color_master_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon sunlit artist painting studio with wooden easels, colorful paint jars, brushes, and splatters, ${STYLE_SUFFIX}` },
  { id: 'factory_machine', batch: 'batch_6_solo_workshop_factory', file: 'factory_machine_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon whimsical toy factory interior with conveyor belts, brass gears, sorting chutes, and warm lights, ${STYLE_SUFFIX}` },
  { id: 'vending_machine', batch: 'batch_6_solo_workshop_factory', file: 'vending_machine_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon colorful retro-modern snack vending machine glowing in a cheerful school lounge, ${STYLE_SUFFIX}` },
  { id: 'word_wash', batch: 'batch_6_solo_workshop_factory', file: 'word_wash_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon cheerful bubble wash station with glossy soap suds, water splashes, yellow sponges, and tiled wall, ${STYLE_SUFFIX}` },

  // Batch 7: Detective, Mystery & Grammar
  { id: 'whats_in_box', batch: 'batch_7_solo_detective_grammar', file: 'whats_in_box_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon magical wooden mystery gift box with golden locks and glowing sparkles on a velvet stage, ${STYLE_SUFFIX}` },
  { id: 'follow_clues', batch: 'batch_7_solo_detective_grammar', file: 'follow_clues_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon adventure treasure map table with brass compass, magnifying glass, lantern, and tropical trail, ${STYLE_SUFFIX}` },
  { id: 'word_detective', batch: 'batch_7_solo_detective_grammar', file: 'word_detective_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon friendly detective office with a clue corkboard, red yarn, magnifying glass, and warm desk lamp, ${STYLE_SUFFIX}` },
  { id: 'sorting', batch: 'batch_7_solo_detective_grammar', file: 'sorting_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon colorful recycling and sorting plaza with three vibrant open containers in blue, pink, and green, ${STYLE_SUFFIX}` },
  { id: 'memory', batch: 'batch_7_solo_detective_grammar', file: 'memory_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon ornate magical card table with golden star crests on royal emerald and blue pattern, ${STYLE_SUFFIX}` },
  { id: 'game', batch: 'batch_7_solo_detective_grammar', file: 'game_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon futuristic bright learning studio classroom with floating holographic stars, bookshelves, and warm light, ${STYLE_SUFFIX}` },
  { id: 'sentence_builder', batch: 'batch_7_solo_detective_grammar', file: 'sentence_builder_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon bright classroom invention studio with wooden workbenches, colorful gears, and warm sunlight, ${STYLE_SUFFIX}` },
  { id: 'solo_sentence', batch: 'batch_7_solo_detective_grammar', file: 'solo_sentence_stage.webp', width: 1280, height: 720, aspectRatio: '16:9', prompt: `3D cartoon cozy wooden study desk with colorful building blocks, lamp, and sunny window view, ${STYLE_SUFFIX}` }
];

async function loadProvenance() {
  try {
    const raw = await fs.readFile(PROVENANCE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveProvenance(data) {
  await fs.writeFile(PROVENANCE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function printStatus() {
  const provenance = await loadProvenance();
  console.log('='.repeat(78));
  console.log('Glück Lernstudio — Game Art Asset Status Audit');
  console.log('='.repeat(78));

  let nanoBananaCount = 0;
  let fallbackCount = 0;
  let missingCount = 0;

  NANO_BANANA_BATCH_PROMPTS.forEach((item, idx) => {
    const filePath = path.join(OUTPUT_DIR, item.file);
    const exists = existsSync.existsSync(filePath);
    const entry = provenance[item.file] || {};

    let statusLabel = 'MISSING';
    if (exists) {
      if (entry.status === 'nano_banana_generated') {
        statusLabel = 'NANO BANANA GENERATED';
        nanoBananaCount++;
      } else {
        statusLabel = 'LOCAL 3D FALLBACK (Offline Ready)';
        fallbackCount++;
      }
    } else {
      missingCount++;
    }

    console.log(
      `${String(idx + 1).padStart(2, ' ')}. [${item.batch}] ${item.file.padEnd(28)} -> ${statusLabel}`
    );
  });

  console.log('-'.repeat(78));
  console.log(`Summary: Total Assets: ${NANO_BANANA_BATCH_PROMPTS.length}`);
  console.log(`  - Nano Banana Generated: ${nanoBananaCount}`);
  console.log(`  - Local Fallback WebP:    ${fallbackCount}`);
  console.log(`  - Missing:                ${missingCount}`);
  console.log('='.repeat(78));
}

async function main() {
  const args = process.argv.slice(2);
  const isStatusOnly = args.includes('--status');
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');

  const batchArg = args.find((a) => a.startsWith('--batch='));
  const targetBatch = batchArg ? batchArg.split('=')[1] : null;

  const itemArg = args.find((a) => a.startsWith('--item='));
  const targetItemId = itemArg ? itemArg.split('=')[1] : null;

  if (isStatusOnly) {
    await printStatus();
    return;
  }

  const provenance = await loadProvenance();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let items = NANO_BANANA_BATCH_PROMPTS;
  if (targetBatch) {
    items = items.filter((p) => p.batch === targetBatch);
  }
  if (targetItemId) {
    items = items.filter((p) => p.id === targetItemId);
  }

  if (isDryRun) {
    console.log(`[Dry-Run] Target items: ${items.length}`);
    items.forEach((it) => {
      console.log(`  - ${it.id} (${it.file}) | ${it.aspectRatio} ${it.width}x${it.height}`);
      console.log(`    Prompt: "${it.prompt.slice(0, 85)}..."`);
    });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ Missing GEMINI_API_KEY environment variable.');
    console.log('Tip: You can inspect current status without an API key using:');
    console.log('  node scripts/generate_nano_banana_assets.mjs --status');
    console.log('  node scripts/generate_nano_banana_assets.mjs --dry-run');
    process.exit(1);
  }

  console.log(`Starting generation for ${items.length} items (Force overwrite: ${isForce})...`);

  for (const item of items) {
    const outPath = path.join(OUTPUT_DIR, item.file);
    const existingEntry = provenance[item.file];

    // Resumability check: skip if already Nano Banana generated, unless --force
    if (existingEntry?.status === 'nano_banana_generated' && !isForce) {
      console.log(`⏩ Skipping ${item.id}: already generated with Nano Banana.`);
      continue;
    }

    console.log(`🎨 Requesting Nano Banana for [${item.id}]...`);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: item.prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 || errText.includes('RESOURCE_EXHAUSTED')) {
          console.warn(`🛑 Quota reached (${res.status} RESOURCE_EXHAUSTED). Halting batch gracefully.`);
          console.warn(`Preserving existing local fallback for ${item.id} without corruption.`);
          break; // Stop loop, do not spam retries
        }
        console.warn(`⚠️ API Error on ${item.id}: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData?.data);

      if (imagePart) {
        const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
        await sharp(buffer)
          .resize(item.width, item.height, { fit: 'cover' })
          .webp({ quality: 86 })
          .toFile(outPath);

        provenance[item.file] = {
          status: 'nano_banana_generated',
          model: 'gemini-2.5-flash-image',
          dimensions: `${item.width}x${item.height}`,
          isOfflineReady: true,
          nanoBananaPending: false,
          generatedAt: new Date().toISOString()
        };
        await saveProvenance(provenance);
        console.log(`✅ Saved Nano Banana asset: ${item.file}`);
      }
    } catch (err) {
      console.error(`❌ Failed ${item.id}:`, err.message);
    }
  }

  console.log('Batch run complete. Updated provenance record.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error in generator:', err);
    process.exit(1);
  });
}
