import {
  GrammarPageImageRef,
  LernstudioDifficulty,
  LernstudioLevel,
  LernstudioSet
} from '../types/lernstudio';
import { normalizeGrammarContent, normalizeLernstudioSet, stripHeavyGrammarMediaForSync } from './grammarEngine';
import { compressPageImageFile, computePageImageChecksum, savePageImageRecord } from './lernstudioPageImageStore';

export type GrammarExtractionExerciseMode = 'original_only' | 'original_and_similar';

export interface ExtractionPageInput {
  id?: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  pageOrder?: number;
  checksum?: string;
}

export interface GrammarExtractionRequest {
  images: ExtractionPageInput[];
  title?: string;
  topic?: string;
  grade?: string;
  level?: LernstudioLevel;
  difficulty?: LernstudioDifficulty;
  teacherName?: string;
  exerciseMode: GrammarExtractionExerciseMode;
  targetSetKind?: 'grammar' | 'mixed';
}

export interface GrammarExtractionResult {
  success: boolean;
  extractedSet?: LernstudioSet;
  warnings: string[];
  code?: 'AI_NOT_CONFIGURED' | 'BAD_REQUEST' | 'UPSTREAM_ERROR' | 'INVALID_RESPONSE' | 'NETWORK_ERROR';
  error?: string;
  errorAr?: string;
  modelUsed?: string;
}

export interface GrammarExtractionProvider {
  extractFromImages(request: GrammarExtractionRequest): Promise<GrammarExtractionResult>;
}

/**
 * Compresses image files locally, stores encrypted-free compressed dataUrls in IndexedDB,
 * and returns lightweight input payloads for `/api/lernstudio/extract-grammar`.
 */
export async function preparePageImagesForExtraction(
  files: File[],
  startOrder = 1
): Promise<{ inputs: ExtractionPageInput[]; refs: GrammarPageImageRef[] }> {
  const inputs: ExtractionPageInput[] = [];
  const refs: GrammarPageImageRef[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const compressed = await compressPageImageFile(file);
    const id = `page_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    const fileName = file.name || `page_${startOrder + i}.jpg`;
    const pageOrder = startOrder + i;
    const dataUrl = `data:${compressed.mimeType};base64,${compressed.base64Data}`;
    const checksum = computePageImageChecksum(compressed.base64Data);

    await savePageImageRecord({
      id,
      fileName,
      mimeType: compressed.mimeType,
      base64Data: compressed.base64Data,
      width: compressed.width,
      height: compressed.height,
      sizeBytes: compressed.sizeBytes,
      createdAt: Date.now(),
      checksum
    });

    inputs.push({
      id,
      fileName,
      mimeType: compressed.mimeType,
      dataUrl,
      width: compressed.width,
      height: compressed.height,
      sizeBytes: compressed.sizeBytes,
      pageOrder,
      checksum
    });

    refs.push({
      id,
      fileName,
      mimeType: compressed.mimeType,
      sizeBytes: compressed.sizeBytes,
      width: compressed.width,
      height: compressed.height,
      pageOrder,
      localStorageKey: id,
      checksum
    });
  }

  return { inputs, refs };
}

export function createServerGeminiExtractionProvider(
  endpointUrl = '/api/lernstudio/extract-grammar'
): GrammarExtractionProvider {
  return {
    async extractFromImages(request: GrammarExtractionRequest): Promise<GrammarExtractionResult> {
      if (!Array.isArray(request.images) || request.images.length === 0) {
        return {
          success: false,
          warnings: [],
          code: 'BAD_REQUEST',
          error: 'At least one textbook or workbook page image is required.',
          errorAr: 'يرجى رفع صورة واحدة على الأقل لصفحة الكتاب أو التدريبات.'
        };
      }

      try {
        const res = await fetch(endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: request.images.map((img, idx) => ({
              id: img.id || `page_${idx + 1}`,
              fileName: img.fileName,
              mimeType: img.mimeType,
              dataUrl: img.dataUrl,
              pageLabel: `Page ${img.pageOrder || idx + 1}`
            })),
            title: request.title,
            topic: request.topic,
            grade: request.grade,
            level: request.level || 'A1',
            difficulty: request.difficulty || 'medium',
            teacherName: request.teacherName,
            exerciseMode: request.exerciseMode,
            targetSetKind: request.targetSetKind || 'grammar'
          })
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.success) {
          return {
            success: false,
            warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
            code: payload?.code || (res.status === 503 ? 'AI_NOT_CONFIGURED' : 'UPSTREAM_ERROR'),
            error: payload?.error || `Extraction request failed (HTTP ${res.status}).`,
            errorAr:
              payload?.errorAr ||
              (res.status === 503
                ? 'خدمة استخراج الصور بالذكاء الاصطناعي غير مفعّلة حالياً على الخادم (مفتاح GEMINI_API_KEY غير مضبوط). يمكنك استخدام مولد البرومبت ولصق JSON يدوياً.'
                : 'تعذّر تحليل الصور على الخادم. تأكد من الاتصال أو استخدم الاستيراد عبر JSON.')
          };
        }

        const rawSet = payload.extractedSet;
        if (!rawSet || typeof rawSet !== 'object') {
          return {
            success: false,
            warnings: [],
            code: 'INVALID_RESPONSE',
            error: 'Server returned an empty extracted set.',
            errorAr: 'أعاد الخادم استجابة فارغة غير صالحة.'
          };
        }

        const pageRefs: GrammarPageImageRef[] = request.images.map((img, idx) => ({
          id: img.id || `page_${idx + 1}`,
          fileName: img.fileName,
          mimeType: img.mimeType,
          sizeBytes: img.sizeBytes,
          width: img.width,
          height: img.height,
          pageOrder: img.pageOrder || idx + 1,
          ...(img.id ? { localStorageKey: img.id } : {})
        }));

        const mergedGrammar = normalizeGrammarContent(
          {
            ...(rawSet.grammarContent || {}),
            origin: 'teacher_created',
            pageImageRefs: pageRefs
          },
          rawSet.title || request.title || 'درس قواعد من الكتاب',
          rawSet.topic || request.topic || 'Grammatik',
          'teacher_created'
        );

        const normalized = stripHeavyGrammarMediaForSync(
          normalizeLernstudioSet({
            ...rawSet,
            id: `set_gram_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            setKind: request.targetSetKind === 'mixed' && Array.isArray(rawSet.items) && rawSet.items.length > 0 ? 'mixed' : 'grammar',
            contentOrigin: 'teacher_created',
            ...(request.grade ? { grade: request.grade } : {}),
            ...(request.teacherName ? { createdByTeacherName: request.teacherName } : {}),
            grammarContent: mergedGrammar
          })
        );

        return {
          success: true,
          extractedSet: normalized,
          warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
          modelUsed: payload.modelUsed
        };
      } catch (err: any) {
        return {
          success: false,
          warnings: [],
          code: 'NETWORK_ERROR',
          error: err?.message || 'Network error while connecting to grammar extraction service.',
          errorAr: 'تعذر الاتصال بخادم استخراج القواعد (تحقق من الإنترنت أو استخدم استيراد JSON).'
        };
      }
    }
  };
}

export async function extractGrammarSetFromImages(
  request: GrammarExtractionRequest,
  provider: GrammarExtractionProvider = createServerGeminiExtractionProvider()
): Promise<GrammarExtractionResult> {
  return provider.extractFromImages(request);
}
