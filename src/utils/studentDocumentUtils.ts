import { StudentDocument } from '../types';
import { formatLocalDate } from './timeUtils';
import { storage } from '../services/storageService';

export const STUDENT_DOC_STORAGE_PREFIX = 'dl_student_doc_';
export const MAX_INLINE_SYNC_DOCUMENT_DATA_URL_LENGTH = 90000;

export function getStudentDocumentStorageKey(docId: string): string {
  return `${STUDENT_DOC_STORAGE_PREFIX}${docId}`;
}

export async function readFileAsDataUrl(file: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as data URL'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  const mime = file.type || 'application/octet-stream';
  return `data:${mime};base64,${base64}`;
}

export async function createPersistedStudentDocument(
  file: File | Blob & { name?: string },
  category: 'homework' | 'exam' | 'doc'
): Promise<StudentDocument> {
  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const storageKey = getStudentDocumentStorageKey(id);
  const dataUrl = await readFileAsDataUrl(file);
  await storage.setItem(storageKey, dataUrl);

  const fileName = (file as File).name || `document_${id}`;
  const fileTypeRaw = (file.type || '').toLowerCase();
  const fileType: StudentDocument['fileType'] =
    fileTypeRaw.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')
      ? 'pdf'
      : fileTypeRaw.includes('image') || /\.(png|jpe?g|gif|webp)$/i.test(fileName)
      ? 'image'
      : 'doc';

  return {
    id,
    fileName,
    fileType,
    fileSize: `${(file.size / 1024).toFixed(1)} KB`,
    uploadedAt: formatLocalDate(),
    // Never store ephemeral blob: URLs; keep durable dataUrl inline within sync budget and full payload in storageKey
    url: dataUrl.length <= MAX_INLINE_SYNC_DOCUMENT_DATA_URL_LENGTH ? dataUrl : '',
    dataUrl: dataUrl.length <= MAX_INLINE_SYNC_DOCUMENT_DATA_URL_LENGTH ? dataUrl : undefined,
    storageKey,
    mimeType: file.type || undefined,
    category
  };
}

export async function resolveStudentDocumentDownloadUrl(doc: StudentDocument): Promise<string | null> {
  if (doc.dataUrl && !doc.dataUrl.startsWith('blob:')) {
    return doc.dataUrl;
  }
  if (doc.url && !doc.url.startsWith('blob:')) {
    return doc.url;
  }
  const key = doc.storageKey || getStudentDocumentStorageKey(doc.id);
  const stored = await storage.getItem<string>(key);
  if (stored && typeof stored === 'string' && !stored.startsWith('blob:')) {
    return stored;
  }
  return null;
}

export async function deletePersistedStudentDocumentPayload(doc: StudentDocument): Promise<void> {
  const key = doc.storageKey || getStudentDocumentStorageKey(doc.id);
  try {
    await storage.removeItem(key);
  } catch {
    // Best-effort cleanup
  }
}
