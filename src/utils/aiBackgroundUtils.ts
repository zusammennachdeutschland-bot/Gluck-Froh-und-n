import { AICertificateBackground } from '../types';
import { storage } from '../services/storageService';

export const STORAGE_KEY_AI_BACKGROUNDS = 'dl_custom_ai_backgrounds';

export interface BackgroundValidationResult {
  isValid: boolean;
  isPerfectRatio: boolean;
  width: number;
  height: number;
  aspectRatio: number;
  aspectRatioLabel: string;
  dataUrl: string;
  fileSizeKB: number;
  warning?: string;
  errorMessage?: string;
}

export type AIBackgroundStyleKey = 
  | 'luxury_gold_navy'
  | 'modern_minimal_geometric'
  | 'classic_academic_parchment'
  | 'german_academic_excellence'
  | 'kids_joyful_stars'
  | 'princess_floral_watercolor'
  | 'sports_champion_victory'
  | 'cyber_futuristic_neon';

export interface PromptGeneratorOptions {
  style: AIBackgroundStyleKey;
  aiPlatform: 'general' | 'midjourney' | 'dalle' | 'firefly' | 'bing';
  colorPalette?: string;
  extraDetails?: string;
}

export const AI_STYLE_PRESETS: Record<AIBackgroundStyleKey, {
  name: { ar: string; en: string; de: string };
  description: { ar: string; en: string; de: string };
  recommendedTextColor: 'light' | 'dark' | 'gold_on_dark';
  promptKeywords: string;
  negativeKeywords: string;
  previewBg: string;
}> = {
  luxury_gold_navy: {
    name: {
      ar: 'ملكي فاخر (ذهب وكحلي داكن)',
      en: 'Royal Luxury Gold & Deep Navy',
      de: 'Königliches Gold & Dunkelblau'
    },
    description: {
      ar: 'إطار ذهبي فاخر، خلفية كحلية ملكية، زخارف ناعمة على الحواف مع مساحة وسطية فارغة وواضحة',
      en: 'Opulent gold foil ornate borders, deep midnight navy background, clean open center',
      de: 'Edler Goldrahmen, mitternachtsblauer Hintergrund, saubere zentrale Freifläche'
    },
    recommendedTextColor: 'gold_on_dark',
    promptKeywords: 'luxury certificate background frame, ornate 24k metallic gold filigree borders, deep midnight navy blue textured background, royal certificate border layout, elegant subtle gold corner ornaments, spacious clean empty center for text, ultra-high resolution, 8k render, professional graphic design masterpiece',
    negativeKeywords: 'text, typography, letters, words, watermark, signature, certificate title, fake names, lorem ipsum, symbols in the middle, busy center',
    previewBg: 'linear-gradient(135deg, #0b132b 0%, #1c2541 100%)'
  },
  modern_minimal_geometric: {
    name: {
      ar: 'عصري هندسي مينيمالي',
      en: 'Modern Minimalist Geometric',
      de: 'Modernes Minimalistisches Design'
    },
    description: {
      ar: 'خطوط هندسية رفيعة وأنيقة، تدرج لوني ناعم وخفيف، مساحة بيضاء واسعة جداً وواضحة',
      en: 'Clean geometric lines, subtle modern pastel gradient, vast white open space',
      de: 'Klare geometrische Linien, dezente Farbverläufe, großzügiger Freiraum'
    },
    recommendedTextColor: 'dark',
    promptKeywords: 'modern minimalist certificate background, clean geometric border lines, subtle soft abstract pastel gradients, elegant fine metallic lines framing, crisp pure white empty canvas in the center, professional corporate award background, high-end Swiss typography style layout, ultra clean aesthetic',
    negativeKeywords: 'text, typography, writing, letters, words, logo, badges, signature, names, dates, busy textures, heavy ornaments',
    previewBg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
  },
  classic_academic_parchment: {
    name: {
      ar: 'أكاديمي كلاسيكي (ورق بردي فاخر)',
      en: 'Classic Academic Parchment',
      de: 'Klassisches Akademisches Pergament'
    },
    description: {
      ar: 'إطار تقليدي كلاسيكي محفور بزخارف الجيلوش الفاخرة، خلفية عاجية دافئة ناعمة',
      en: 'Vintage luxury ivory parchment background, intricate guilloche borders, classical university diploma layout',
      de: 'Klassisches Pergament-Design, feine Guilloche-Rahmen, traditionelles Diplom'
    },
    recommendedTextColor: 'dark',
    promptKeywords: 'vintage luxury diploma certificate background, intricate classic guilloche security borders, warm ivory cream parchment paper texture, elegant vintage filigree corner decorations, empty wide center safe zone, prestige university certificate backdrop, timeless academic aesthetic',
    negativeKeywords: 'text, typography, cursive writing, fake signature, university name, recipient name, seal text, date, numbers',
    previewBg: 'linear-gradient(135deg, #fefae0 0%, #faedcd 100%)'
  },
  german_academic_excellence: {
    name: {
      ar: 'طراز التميز الألماني',
      en: 'German Academic Excellence',
      de: 'Deutsche Akademische Exzellenz'
    },
    description: {
      ar: 'ألوان راقية مستوحاة من العلم الألماني بلمسات ذهبية متناسقة وإطار أكاديمي أوروبي رفيع',
      en: 'Refined German excellence palette with subtle black, ruby red and gold metallic accents, prestigious European academic frame',
      de: 'Deutsches Exzellenz-Design, dezente Gold- und Rubin-Akzente, seriöser akademischer Rahmen'
    },
    recommendedTextColor: 'dark',
    promptKeywords: 'prestigious European German academic certificate background, subtle modern black ruby-red and brushed gold border accents, elegant clean off-white parchment center, sophisticated diploma layout, clean symmetrical framing, ample empty safe zone for dynamic text',
    negativeKeywords: 'text, typography, letters, words, stamps, fake signature, German words, flags, coats of arms with text',
    previewBg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
  },
  kids_joyful_stars: {
    name: {
      ar: 'أطفال ونجوم مبهجة',
      en: 'Kids Joyful & Cheerful Stars',
      de: 'Fröhliche Kinder & Sterne'
    },
    description: {
      ar: 'نجوم مضيئة ملونة، شرائط احتفالية مبهجة، إطار مرح مع مساحة بيضاء صافية في الوسط',
      en: 'Playful colorful stars, cheerful celebration ribbons, whimsical borders, clean bright center',
      de: 'Bunte Sterne, fröhliche Schleifen, verspielter Rahmen mit heller Mitte'
    },
    recommendedTextColor: 'dark',
    promptKeywords: 'cheerful kids award certificate background, joyful colorful shooting stars, playful pastel ribbons and confetti along the edges, bright fun modern border frame, completely clean white center area for recipient name, adorable celebration illustration, high resolution vector style',
    negativeKeywords: 'text, typography, writing, letters, names, numbers, "certificate", "winner", watermarks, crowded middle area',
    previewBg: 'linear-gradient(135deg, #fef08a 0%, #fed7aa 100%)'
  },
  princess_floral_watercolor: {
    name: {
      ar: 'ورود مائية وتاج أميرة (بنات)',
      en: 'Princess Floral Watercolor & Rose Gold',
      de: 'Prinzessin & Blumen-Aquarell'
    },
    description: {
      ar: 'زهور مائية رقيقة باللون الوردي واللافندر، إطار ذهبي وردي أنيق، مساحة وسطية مضيئة',
      en: 'Delicate soft pastel watercolor floral bouquet borders, elegant rose gold geometric frame, bright clear center',
      de: 'Zarte Aquarellblumen in Rosa und Lavendel, eleganter Roségold-Rahmen'
    },
    recommendedTextColor: 'dark',
    promptKeywords: 'delicate pastel watercolor floral certificate background, soft pink peonies and lavender blossoms framing the corners, elegant thin rose-gold metallic border, clean glowing white open center, enchanting fairytale aesthetic, high quality artistic botanical illustration',
    negativeKeywords: 'text, letters, words, cursive script, signatures, typography, watermark, flowers obstructing the middle',
    previewBg: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 100%)'
  },
  sports_champion_victory: {
    name: {
      ar: 'بطولة ورياضي (أبطال وتفوق)',
      en: 'Champion Hero & Sports Victory',
      de: 'Champion Held & Siegerehrung'
    },
    description: {
      ar: 'إطار أزرق ملكي وفضي ديناميكي، إكليل غار ذهبي أنيق على الحواف، تصميم بطولي مشرق',
      en: 'Dynamic royal blue and silver shield frame, subtle gold laurel wreath corner accents, energetic champion aesthetic',
      de: 'Dynamisches Königsblau-Design, Lorbeerkranz-Akzente, Sieger-Optik'
    },
    recommendedTextColor: 'dark',
    promptKeywords: 'championship certificate background, dynamic royal blue and metallic silver borders, subtle gold laurel wreath embellishments in corners, bold prestigious award backdrop, large clean open light-gray center, victory celebration theme, modern crisp graphic layout',
    negativeKeywords: 'text, words, typography, letters, numbers, medals with text, logos, cluttered center',
    previewBg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
  },
  cyber_futuristic_neon: {
    name: {
      ar: 'مستقبلي حديث ونيون أنيق',
      en: 'Futuristic Neon & Tech Excellence',
      de: 'Futuristisches Tech-Design'
    },
    description: {
      ar: 'خلفية داكنة مع خطوط نيون زرقاء وذهبية مضيئة على الحواف فقط، مساحة مظلمة هادئة في المنتصف',
      en: 'Sleek dark cyberpunk tech certificate background, luminous cyan and amber circuit borders, dark matte safe center',
      de: 'Dunkles Tech-Design, dezente leuchtende Cyan-Linien am Rand'
    },
    recommendedTextColor: 'light',
    promptKeywords: 'futuristic dark technology certificate background, glowing cyan and gold neon fiber optic border lines, subtle matte slate-dark backdrop, sleek sci-fi digital diploma frame, ultra clean dark empty central area, 8k render, modern cutting edge design',
    negativeKeywords: 'text, typography, letters, words, placeholder, code text, watermarks, bright center glare',
    previewBg: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)'
  }
};

/**
 * Generates an optimized, highly descriptive prompt tailored for external AI image generators.
 */
export function generateAIBackgroundPrompt(options: PromptGeneratorOptions): string {
  const preset = AI_STYLE_PRESETS[options.style] || AI_STYLE_PRESETS.luxury_gold_navy;

  const orientationSection = `A4 Landscape format certificate background design (aspect ratio 1.414:1, 2480x1754 pixels).`;

  const safeZonesSection = `
EXACT SAFE ZONES SPECIFICATION (CRITICAL):
- Top 20%: Reserved for Certificate Title and Header.
- Center 35%: Completely EMPTY and UNCLUTTERED safe zone for Student Name (MUST be clear, high contrast, with zero textures, zero illustrations, and zero clutter).
- Mid-Bottom 25%: Clean empty area for Certificate Description and Achievement Statement.
- Bottom 20%: Empty left and right safe zones for Issue Date, Teacher Handwriting Signature, and Center Stamp.
`;

  const negativeMandate = `
STRICT NEGATIVE CONSTRAINTS (VERY IMPORTANT):
- DO NOT generate ANY text, words, letters, numbers, or dummy placeholder typography (no "Certificate", no "Award", no "John Doe", no "Lorem Ipsum").
- DO NOT generate fake handwritten signatures or mock dates.
- DO NOT add watermarks, stock photo stamps, or logos.
- Leave all central text areas 100% BLANK. This image is strictly a background canvas layer that will have dynamic data and typography overlaid programmatically by our software.
`;

  let prompt = `${preset.promptKeywords}. ${orientationSection} ${safeZonesSection} ${negativeMandate}`;

  if (options.colorPalette && options.colorPalette.trim()) {
    prompt += ` Custom Color Palette: ${options.colorPalette.trim()}.`;
  }

  if (options.extraDetails && options.extraDetails.trim()) {
    prompt += ` Extra Design Touch: ${options.extraDetails.trim()}.`;
  }

  // Platform specific tuning
  if (options.aiPlatform === 'midjourney') {
    prompt += ` --ar 141:100 --v 6.1 --style raw --no text, typography, letters, words, watermark, signature, font, handwriting, numbers, label, logo, fake name`;
  } else if (options.aiPlatform === 'dalle') {
    prompt = `Create a pure background illustration for a certificate: ${prompt} Do not include any text or words anywhere in the image.`;
  }

  return prompt.trim();
}

/**
 * Validates an uploaded background image file for resolution, aspect ratio, and file format.
 */
export async function validateCertificateBackgroundFile(file: File): Promise<BackgroundValidationResult> {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      isValid: false,
      isPerfectRatio: false,
      width: 0,
      height: 0,
      aspectRatio: 0,
      aspectRatioLabel: '0:0',
      dataUrl: '',
      fileSizeKB: Math.round(file.size / 1024),
      errorMessage: 'صيغة الملف غير مدعومة. يرجى اختيار صورة بصيغة PNG أو JPG أو WebP.'
    };
  }

  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        resolve({
          isValid: false,
          isPerfectRatio: false,
          width: 0,
          height: 0,
          aspectRatio: 0,
          aspectRatioLabel: '0:0',
          dataUrl: '',
          fileSizeKB: Math.round(file.size / 1024),
          errorMessage: 'فشل في قراءة ملف الصورة.'
        });
        return;
      }

      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const ratio = width / Math.max(1, height);
        const ratioLabel = `${ratio.toFixed(2)}:1`;
        const fileSizeKB = Math.round(file.size / 1024);

        // A4 Landscape is ~1.414. Standard landscape range is 1.25 to 1.65
        const isLandscape = width > height;
        const isIdealRatio = ratio >= 1.30 && ratio <= 1.55;
        const isAcceptableRatio = ratio >= 1.20 && ratio <= 1.75;

        if (!isLandscape) {
          resolve({
            isValid: false,
            isPerfectRatio: false,
            width,
            height,
            aspectRatio: ratio,
            aspectRatioLabel: ratioLabel,
            dataUrl,
            fileSizeKB,
            errorMessage: 'الصورة رأسية (Portrait). شهادات التقدير تتطلب صورة أفقية (Landscape) بأبعاد A4.'
          });
          return;
        }

        let warning: string | undefined;
        if (!isIdealRatio) {
          warning = `نسبة أبعاد الصورة (${ratioLabel}) تختلف قليلاً عن النسبة القياسية لشهادات A4 (1.41:1). سيتم احتواء الصورة وتوسيطها بأناقة دون قص عشوائي.`;
        }

        if (width < 1200) {
          warning = (warning ? `${warning} ` : '') + 'دقة الصورة أقل من 1200 بكسل. للحصول على طباعة فائقة الجودة لشهادة PDF يُفضل دقة 1920x1080 أو أعلى.';
        }

        resolve({
          isValid: true,
          isPerfectRatio: isIdealRatio,
          width,
          height,
          aspectRatio: ratio,
          aspectRatioLabel: ratioLabel,
          dataUrl,
          fileSizeKB,
          warning
        });
      };

      img.onerror = () => {
        resolve({
          isValid: false,
          isPerfectRatio: false,
          width: 0,
          height: 0,
          aspectRatio: 0,
          aspectRatioLabel: '0:0',
          dataUrl: '',
          fileSizeKB: Math.round(file.size / 1024),
          errorMessage: 'ملف الصورة تالف أو غير صالح للاستخدام.'
        });
      };

      img.src = dataUrl;
    };

    reader.onerror = () => {
      resolve({
        isValid: false,
        isPerfectRatio: false,
        width: 0,
        height: 0,
        aspectRatio: 0,
        aspectRatioLabel: '0:0',
        dataUrl: '',
        fileSizeKB: Math.round(file.size / 1024),
        errorMessage: 'تعذر قراءة ملف الصورة من جهازك.'
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Retrieves all saved AI Certificate Backgrounds from storage.
 */
export async function getSavedAIBackgrounds(): Promise<AICertificateBackground[]> {
  try {
    const list = await storage.getItem<AICertificateBackground[]>(STORAGE_KEY_AI_BACKGROUNDS);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Failed to get saved AI backgrounds:', err);
    return [];
  }
}

/**
 * Saves a new AI Certificate Background to persistent storage.
 */
export async function saveAIBackground(bg: Omit<AICertificateBackground, 'id' | 'createdAt'> & { id?: string }): Promise<AICertificateBackground> {
  const current = await getSavedAIBackgrounds();
  const newBg: AICertificateBackground = {
    ...bg,
    id: bg.id || `ai_bg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: Date.now()
  };

  const updated = [newBg, ...current.filter(b => b.id !== newBg.id)];
  await storage.setItem(STORAGE_KEY_AI_BACKGROUNDS, updated);
  return newBg;
}

/**
 * Updates an existing AI Certificate Background.
 */
export async function updateAIBackground(id: string, updates: Partial<AICertificateBackground>): Promise<AICertificateBackground[]> {
  const current = await getSavedAIBackgrounds();
  const updated = current.map(b => b.id === id ? { ...b, ...updates } : b);
  await storage.setItem(STORAGE_KEY_AI_BACKGROUNDS, updated);
  return updated;
}

/**
 * Deletes an AI Certificate Background by ID.
 */
export async function deleteAIBackground(id: string): Promise<AICertificateBackground[]> {
  const current = await getSavedAIBackgrounds();
  const updated = current.filter(b => b.id !== id);
  await storage.setItem(STORAGE_KEY_AI_BACKGROUNDS, updated);
  return updated;
}
