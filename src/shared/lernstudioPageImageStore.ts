export interface StoredPageImageRecord {
  id: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  createdAt: number;
  checksum?: string;
}

export interface GrammarPageImageChunk {
  imageId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  createdAt: number;
  checksum: string;
  chunkIndex: number;
  totalChunks: number;
  dataChunk: string;
}

export interface PageImagesBundlePayload {
  app: 'GlueckPageImages';
  version: string;
  exportedAt: string;
  images: Array<StoredPageImageRecord & { checksum: string }>;
}

const DB_NAME = 'glueck_lernstudio_page_images_v1';
const STORE_NAME = 'page_images';
const memoryFallbackStore = new Map<string, StoredPageImageRecord>();
export const DEFAULT_PAGE_IMAGE_CHUNK_SIZE = 24576;

/**
 * Deterministic 64-bit composite integrity checksum (FNV-1a + DJB2 + length)
 * that works identically across Browser, Capacitor WebView, and Node.js.
 */
export function computePageImageChecksum(rawInput: string): string {
  const input = String(rawInput || '');
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    fnv ^= ch;
    fnv = Math.imul(fnv, 16777619);
    djb = ((djb << 5) + djb + ch) | 0;
  }
  const hex1 = (fnv >>> 0).toString(16).padStart(8, '0');
  const hex2 = (djb >>> 0).toString(16).padStart(8, '0');
  return `gpi_${hex1}${hex2}_${input.length}`;
}

export function notifyPageImagesUpdated(imageIds: string[]): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && imageIds.length > 0) {
    try {
      window.dispatchEvent(new CustomEvent('glueck-page-images-synced', { detail: { imageIds } }));
    } catch {
      // Ignore event dispatch failures
    }
  }
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
}

function openPageImagesDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePageImageRecord(record: StoredPageImageRecord): Promise<void> {
  const enriched: StoredPageImageRecord = {
    ...record,
    checksum: record.checksum || computePageImageChecksum(record.base64Data)
  };
  memoryFallbackStore.set(enriched.id, enriched);
  const db = await openPageImagesDb();
  if (!db) {
    notifyPageImagesUpdated([enriched.id]);
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(enriched);
      tx.oncomplete = () => {
        db.close();
        notifyPageImagesUpdated([enriched.id]);
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function getPageImageRecord(id: string): Promise<StoredPageImageRecord | null> {
  if (!id) return null;
  const cached = memoryFallbackStore.get(id);
  if (cached) {
    return cached.checksum ? cached : { ...cached, checksum: computePageImageChecksum(cached.base64Data) };
  }

  const db = await openPageImagesDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        const rawRes = (req.result as StoredPageImageRecord | undefined) || null;
        if (!rawRes) {
          db.close();
          resolve(null);
          return;
        }
        const res: StoredPageImageRecord = rawRes.checksum
          ? rawRes
          : { ...rawRes, checksum: computePageImageChecksum(rawRes.base64Data) };
        memoryFallbackStore.set(id, res);
        db.close();
        resolve(res);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function hasPageImageRecord(id: string): Promise<boolean> {
  if (!id) return false;
  if (memoryFallbackStore.has(id)) return true;
  const rec = await getPageImageRecord(id);
  return Boolean(rec);
}

export async function listStoredPageImageIds(): Promise<string[]> {
  const idSet = new Set<string>(memoryFallbackStore.keys());
  const db = await openPageImagesDb();
  if (!db) return Array.from(idSet);

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => {
        const keys = Array.isArray(req.result) ? req.result : [];
        for (const k of keys) {
          if (typeof k === 'string' && k.trim()) idSet.add(k.trim());
        }
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });

  return Array.from(idSet);
}

export async function getAllStoredPageImageRecords(): Promise<StoredPageImageRecord[]> {
  const map = new Map<string, StoredPageImageRecord>(memoryFallbackStore.entries());
  const db = await openPageImagesDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => {
          const rows = Array.isArray(req.result) ? req.result : [];
          for (const row of rows) {
            if (row && typeof row === 'object' && row.id) {
              const rec: StoredPageImageRecord = row.checksum
                ? row
                : { ...row, checksum: computePageImageChecksum(row.base64Data) };
              map.set(rec.id, rec);
              memoryFallbackStore.set(rec.id, rec);
            }
          }
          db.close();
          resolve();
        };
        req.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }
  return Array.from(map.values()).map((r) =>
    r.checksum ? r : { ...r, checksum: computePageImageChecksum(r.base64Data) }
  );
}

export async function deletePageImageRecord(id: string): Promise<void> {
  if (!id) return;
  memoryFallbackStore.delete(id);
  const db = await openPageImagesDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function loadPageImagesByIds(ids: string[]): Promise<StoredPageImageRecord[]> {
  const results: StoredPageImageRecord[] = [];
  for (const id of ids) {
    const rec = await getPageImageRecord(id);
    if (rec) results.push(rec);
  }
  return results;
}

/**
 * Splits a compressed StoredPageImageRecord into bounded chunks safe for PeerJS DataChannel transport.
 */
export function splitPageImageIntoChunks(
  record: StoredPageImageRecord,
  chunkSizeChars = DEFAULT_PAGE_IMAGE_CHUNK_SIZE
): GrammarPageImageChunk[] {
  const safeSize = Math.max(1024, Math.floor(chunkSizeChars || DEFAULT_PAGE_IMAGE_CHUNK_SIZE));
  const payload = String(record.base64Data || '');
  const checksum = record.checksum || computePageImageChecksum(payload);
  const totalChunks = Math.max(1, Math.ceil(payload.length / safeSize));

  const chunks: GrammarPageImageChunk[] = [];
  for (let i = 0; i < totalChunks; i++) {
    chunks.push({
      imageId: record.id,
      fileName: record.fileName,
      mimeType: record.mimeType || 'image/jpeg',
      sizeBytes: record.sizeBytes,
      ...(typeof record.width === 'number' ? { width: record.width } : {}),
      ...(typeof record.height === 'number' ? { height: record.height } : {}),
      createdAt: record.createdAt || Date.now(),
      checksum,
      chunkIndex: i,
      totalChunks,
      dataChunk: payload.slice(i * safeSize, (i + 1) * safeSize)
    });
  }
  return chunks;
}

/**
 * Stateful reassembler supporting out-of-order chunk arrival, missing-chunk resume tracking,
 * and strict checksum verification before persistence.
 */
export class PageImageChunkAssembler {
  public readonly imageId: string;
  private fileName: string;
  private mimeType: string;
  private sizeBytes: number;
  private width?: number;
  private height?: number;
  private createdAt: number;
  private checksum: string;
  private totalChunks: number;
  private chunks: Map<number, string> = new Map();

  constructor(meta: {
    imageId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    createdAt?: number;
    checksum: string;
    totalChunks: number;
  }) {
    this.imageId = meta.imageId;
    this.fileName = meta.fileName;
    this.mimeType = meta.mimeType || 'image/jpeg';
    this.sizeBytes = meta.sizeBytes;
    this.width = meta.width;
    this.height = meta.height;
    this.createdAt = meta.createdAt || Date.now();
    this.checksum = meta.checksum;
    this.totalChunks = Math.max(1, meta.totalChunks);
  }

  public addChunk(chunk: GrammarPageImageChunk): { accepted: boolean; reason?: string } {
    if (!chunk || chunk.imageId !== this.imageId) {
      return { accepted: false, reason: 'IMAGE_ID_MISMATCH' };
    }
    if (chunk.totalChunks !== this.totalChunks) {
      return { accepted: false, reason: 'TOTAL_CHUNKS_MISMATCH' };
    }
    if (chunk.checksum && this.checksum && chunk.checksum !== this.checksum) {
      return { accepted: false, reason: 'METADATA_CHECKSUM_MISMATCH' };
    }
    if (!Number.isInteger(chunk.chunkIndex) || chunk.chunkIndex < 0 || chunk.chunkIndex >= this.totalChunks) {
      return { accepted: false, reason: 'CHUNK_INDEX_OUT_OF_RANGE' };
    }
    this.chunks.set(chunk.chunkIndex, String(chunk.dataChunk ?? ''));
    return { accepted: true };
  }

  public getMissingChunkIndices(): number[] {
    const missing: number[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.chunks.has(i)) missing.push(i);
    }
    return missing;
  }

  public isComplete(): boolean {
    return this.chunks.size === this.totalChunks && this.getMissingChunkIndices().length === 0;
  }

  public finalizeRecord():
    | { ok: true; record: StoredPageImageRecord }
    | { ok: false; error: 'INCOMPLETE_CHUNKS' | 'CHECKSUM_MISMATCH' } {
    if (!this.isComplete()) {
      return { ok: false, error: 'INCOMPLETE_CHUNKS' };
    }
    const orderedParts: string[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      orderedParts.push(this.chunks.get(i) || '');
    }
    const fullBase64 = orderedParts.join('');
    const computedChecksum = computePageImageChecksum(fullBase64);
    if (this.checksum && computedChecksum !== this.checksum) {
      return { ok: false, error: 'CHECKSUM_MISMATCH' };
    }
    return {
      ok: true,
      record: {
        id: this.imageId,
        fileName: this.fileName,
        mimeType: this.mimeType,
        base64Data: fullBase64,
        ...(typeof this.width === 'number' ? { width: this.width } : {}),
        ...(typeof this.height === 'number' ? { height: this.height } : {}),
        sizeBytes: this.sizeBytes || Math.round((fullBase64.length * 3) / 4),
        createdAt: this.createdAt,
        checksum: computedChecksum
      }
    };
  }
}

/**
 * Exports local compressed textbook page images into a portable `.glueck-pages.json` bundle.
 */
export async function exportPageImagesBundle(imageIds?: string[]): Promise<PageImagesBundlePayload> {
  const sourceRecords =
    Array.isArray(imageIds) && imageIds.length > 0
      ? await loadPageImagesByIds(imageIds)
      : await getAllStoredPageImageRecords();

  return {
    app: 'GlueckPageImages',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    images: sourceRecords.map((rec) => ({
      ...rec,
      checksum: rec.checksum || computePageImageChecksum(rec.base64Data)
    }))
  };
}

/**
 * Imports a `.glueck-pages.json` bundle into local device storage, validating integrity checksums
 * and skipping images already stored on this device.
 */
export async function importPageImagesBundle(
  rawBundle: string | unknown
): Promise<{ importedCount: number; skippedDuplicates: number; invalidCount: number; importedIds: string[] }> {
  let parsed: any = rawBundle;
  if (typeof rawBundle === 'string') {
    parsed = JSON.parse(rawBundle);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.images)) {
    throw new Error('Invalid Glück page images bundle format.');
  }

  let importedCount = 0;
  let skippedDuplicates = 0;
  let invalidCount = 0;
  const importedIds: string[] = [];

  for (const item of parsed.images) {
    if (!item || typeof item !== 'object' || !item.id || typeof item.base64Data !== 'string' || !item.base64Data) {
      invalidCount++;
      continue;
    }
    const id = String(item.id).trim();
    if (!id) {
      invalidCount++;
      continue;
    }

    const cleanBase64 = item.base64Data.includes(',') ? item.base64Data.split(',')[1] : item.base64Data;
    const computedChecksum = computePageImageChecksum(cleanBase64);
    if (item.checksum && String(item.checksum).trim() !== computedChecksum) {
      invalidCount++;
      continue;
    }

    if (await hasPageImageRecord(id)) {
      skippedDuplicates++;
      continue;
    }

    await savePageImageRecord({
      id,
      fileName: String(item.fileName || `${id}.jpg`).trim(),
      mimeType: String(item.mimeType || 'image/jpeg').trim(),
      base64Data: cleanBase64,
      ...(typeof item.width === 'number' ? { width: item.width } : {}),
      ...(typeof item.height === 'number' ? { height: item.height } : {}),
      sizeBytes: Number(item.sizeBytes) || Math.round((cleanBase64.length * 3) / 4),
      createdAt: Number(item.createdAt) || Date.now(),
      checksum: computedChecksum
    });
    importedIds.push(id);
    importedCount++;
  }

  if (importedIds.length > 0) {
    notifyPageImagesUpdated(importedIds);
  }

  return { importedCount, skippedDuplicates, invalidCount, importedIds };
}

/**
 * Compresses an uploaded textbook/page File in-browser to a crisp JPEG/PNG base64 payload
 * suitable for server-side Gemini extraction without bloating memory or Firestore.
 */
export async function compressPageImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.84
): Promise<{
  base64Data: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    const base64Data = rawDataUrl.includes(',') ? rawDataUrl.split(',')[1] : rawDataUrl;
    return {
      base64Data,
      mimeType: file.type || 'image/jpeg',
      width: 0,
      height: 0,
      sizeBytes: file.size
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxDimension || height > maxDimension) {
        const scale = Math.min(maxDimension / width, maxDimension / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const base64Data = rawDataUrl.includes(',') ? rawDataUrl.split(',')[1] : rawDataUrl;
        resolve({
          base64Data,
          mimeType: file.type || 'image/jpeg',
          width: img.width,
          height: img.height,
          sizeBytes: file.size
        });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const targetMime = file.type === 'image/png' && file.size < 900_000 ? 'image/png' : 'image/jpeg';
      const outDataUrl = canvas.toDataURL(targetMime, quality);
      const base64Data = outDataUrl.includes(',') ? outDataUrl.split(',')[1] : outDataUrl;
      const sizeBytes = Math.round((base64Data.length * 3) / 4);

      resolve({
        base64Data,
        mimeType: targetMime,
        width,
        height,
        sizeBytes
      });
    };
    img.onerror = () => {
      const base64Data = rawDataUrl.includes(',') ? rawDataUrl.split(',')[1] : rawDataUrl;
      resolve({
        base64Data,
        mimeType: file.type || 'image/jpeg',
        width: 0,
        height: 0,
        sizeBytes: file.size
      });
    };
    img.src = rawDataUrl;
  });
}
