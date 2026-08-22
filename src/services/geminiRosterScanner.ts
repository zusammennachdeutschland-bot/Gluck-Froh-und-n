import { GoogleGenAI, Type } from '@google/genai';
import { HodGermanStudent } from '../types';

export interface ScanRosterResult {
  classNameDetected: string;
  totalStudentsScanned: number;
  germanStudentsCount: number;
  excludedFrenchCount: number;
  students: Omit<HodGermanStudent, 'id'>[];
  notes?: string;
}

export async function scanRosterImageWithGemini(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  userSpecifiedClass?: string
): Promise<ScanRosterResult> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');

  if (!apiKey) {
    throw new Error('Gemini API Key missing. Please configure VITE_GEMINI_API_KEY in environment.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const prompt = `You are an expert school document OCR & roster scanner AI.
Analyze this class student list image.
1. Detect the Class/Grade Name from the header or title (e.g., "5A", "6B", "Klasse 7A", "3/1"). If given user specified class "${userSpecifiedClass || ''}", use that as fallback or confirmation.
2. Scan all student rows carefully.
3. For each student row:
   - Extract full name in Arabic (nameAr) and English transliteration/name if available or transliterated (nameEn).
   - Determine gender: 'Boy' or 'Girl' (infer from name or prefix like الطالب/الطالبة, م/ف, M/F).
   - Extract Bus Line/Route number if mentioned (e.g., "Bus 12", "خط 5", "باص 04", or "N/A" / "بدون باص" if absent).
   - FILTER RULE: Exclude ANY student taking French (فرنساوي / اللغة الفرنسية / French). INCLUDE ONLY students whose second language is German (ألماني / Deutsch / German).
4. Output strictly JSON adhering to the required schema.`;

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const response = await ai.models.generateContent({
    model: 'gemini-3.7-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          classNameDetected: { type: Type.STRING },
          totalStudentsScanned: { type: Type.NUMBER },
          germanStudentsCount: { type: Type.NUMBER },
          excludedFrenchCount: { type: Type.NUMBER },
          notes: { type: Type.STRING },
          students: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nameAr: { type: Type.STRING },
                nameEn: { type: Type.STRING },
                gradeClass: { type: Type.STRING },
                gender: { type: Type.STRING, enum: ['Boy', 'Girl'] },
                secondLanguage: { type: Type.STRING, enum: ['German'] },
                busLine: { type: Type.STRING },
              },
              required: ['nameAr', 'nameEn', 'gradeClass', 'gender', 'secondLanguage', 'busLine'],
            },
          },
        },
        required: ['classNameDetected', 'students'],
      },
    },
  });

  const text = response.text || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse Gemini Vision response:', text);
    throw new Error('AI Vision parsing failed to format result correctly.');
  }

  const detectedClass = parsed.classNameDetected || userSpecifiedClass || '5A';

  return {
    classNameDetected: detectedClass,
    totalStudentsScanned: parsed.totalStudentsScanned || parsed.students?.length || 0,
    germanStudentsCount: parsed.germanStudentsCount || parsed.students?.length || 0,
    excludedFrenchCount: parsed.excludedFrenchCount || 0,
    notes: parsed.notes || '',
    students: (parsed.students || []).map((s: any) => ({
      nameAr: s.nameAr || s.name || 'طالب جديد',
      nameEn: s.nameEn || 'New Student',
      gradeClass: s.gradeClass || detectedClass,
      gender: s.gender === 'Girl' ? 'Girl' : 'Boy',
      secondLanguage: 'German',
      busLine: s.busLine || 'بدون باص',
    })),
  };
}
