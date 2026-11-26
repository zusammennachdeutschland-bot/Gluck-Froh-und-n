import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Toast } from '@capacitor/toast';
import { buildWhatsAppUrl } from '../utils/phoneUtils';

export const APP_ROOT_FOLDER = 'Gluck_Lernstudio';

export type DownloadedFileCategory =
  | 'worksheets'       // أوراق العمل والسيتات
  | 'certificates'     // الشهادات والتكريمات
  | 'parent_reports'   // تقارير الحصص وأولياء الأمور
  | 'schedules'        // الجداول المدرسية والحصص
  | 'school_plans'     // الخطط الأسبوعية وزيارات المتابعة والخطط العلاجية
  | 'finance'          // المالية والإيصالات
  | 'backups';         // النسخ الاحتياطية وجهات الاتصال

export type DownloadedFileActionType =
  | 'whatsapp'
  | 'print'
  | 'download_pdf'
  | 'download_image'
  | 'export_data';

export type DownloadedFileFormat =
  | 'pdf'
  | 'png'
  | 'jpg'
  | 'txt'
  | 'html'
  | 'ics'
  | 'json'
  | 'csv'
  | 'vcf';

export const SUBFOLDER_BY_CATEGORY: Record<DownloadedFileCategory, string> = {
  worksheets: 'Worksheets',
  certificates: 'Certificates',
  parent_reports: 'Parent_Reports',
  schedules: 'Schedules',
  school_plans: 'School_Plans_And_Visits',
  finance: 'Finance_And_Receipts',
  backups: 'Backups_And_Contacts'
};

export const CATEGORY_LABELS_AR: Record<DownloadedFileCategory, string> = {
  worksheets: 'أوراق العمل والسيتات',
  certificates: 'الشهادات والتكريمات',
  parent_reports: 'تقارير الحصص وأولياء الأمور',
  schedules: 'الجداول المدرسية والحصص',
  school_plans: 'الخطط الأسبوعية والزيارات',
  finance: 'الإيصالات والمالية',
  backups: 'النسخ الاحتياطية وجهات الاتصال'
};

export interface DownloadedFileRecord {
  id: string;
  title: string;
  fileName: string;
  category: DownloadedFileCategory;
  subFolder: string;
  fullStoragePath: string; // e.g. Documents/Gluck_Lernstudio/Certificates/Zertifikat_Ahmed.pdf
  nativeUri?: string;
  actionType: DownloadedFileActionType;
  format: DownloadedFileFormat;
  createdAt: string; // ISO string
  dateStr: string;   // YYYY-MM-DD
  studentId?: string;
  studentName?: string;
  groupId?: string;
  groupName?: string;
  recipientPhone?: string;
  textContent?: string;       // Stored text for reports/receipts/messages
  previewDataUrl?: string;    // Compact preview or data URL if small enough
  fileSizeBytes?: number;
}

const STORAGE_KEY_DOWNLOADED_FILES = 'gluck_downloaded_files_registry_v1';
const MAX_STORED_RECORDS = 350;

/**
 * Sanitizes a filename so it is safe across Android, Windows, macOS, and Linux filesystems.
 */
export function sanitizeStorageFileName(rawName: string, ext?: string): string {
  const cleaned = (rawName || 'File')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');

  if (ext) {
    const cleanExt = ext.replace(/^\./, '').toLowerCase();
    if (cleaned.toLowerCase().endsWith(`.${cleanExt}`)) {
      return cleaned;
    }
    return `${cleaned}.${cleanExt}`;
  }
  return cleaned;
}

/**
 * Ensures the root folder `Gluck_Lernstudio` and the category subfolder exist on the device.
 */
export async function ensureAppSubfolderExists(
  category: DownloadedFileCategory
): Promise<{ directory: Directory; folderPath: string; displayPath: string }> {
  const subFolder = SUBFOLDER_BY_CATEGORY[category] || 'General';
  const relFolderPath = `${APP_ROOT_FOLDER}/${subFolder}`;

  if (!Capacitor.isNativePlatform()) {
    return {
      directory: Directory.Documents,
      folderPath: relFolderPath,
      displayPath: `Downloads/${relFolderPath}`
    };
  }

  // 1. Try Directory.Documents (Standard internal storage Documents/Gluck_Lernstudio/<SubFolder>)
  try {
    await Filesystem.mkdir({
      path: relFolderPath,
      directory: Directory.Documents,
      recursive: true
    });
    return {
      directory: Directory.Documents,
      folderPath: relFolderPath,
      displayPath: `Documents/${relFolderPath}`
    };
  } catch (err1: any) {
    if (err1?.message?.includes('exists') || err1?.code === 'OS-DIR-EXISTS') {
      return {
        directory: Directory.Documents,
        folderPath: relFolderPath,
        displayPath: `Documents/${relFolderPath}`
      };
    }
  }

  // 2. Try Directory.ExternalStorage
  try {
    await Filesystem.mkdir({
      path: relFolderPath,
      directory: Directory.ExternalStorage,
      recursive: true
    });
    return {
      directory: Directory.ExternalStorage,
      folderPath: relFolderPath,
      displayPath: `InternalStorage/${relFolderPath}`
    };
  } catch (err2: any) {
    if (err2?.message?.includes('exists') || err2?.code === 'OS-DIR-EXISTS') {
      return {
        directory: Directory.ExternalStorage,
        folderPath: relFolderPath,
        displayPath: `InternalStorage/${relFolderPath}`
      };
    }
  }

  // 3. Fallback to Directory.Data
  try {
    await Filesystem.mkdir({
      path: relFolderPath,
      directory: Directory.Data,
      recursive: true
    });
    return {
      directory: Directory.Data,
      folderPath: relFolderPath,
      displayPath: `AppStorage/${relFolderPath}`
    };
  } catch {
    return {
      directory: Directory.Cache,
      folderPath: relFolderPath,
      displayPath: `Cache/${relFolderPath}`
    };
  }
}

/**
 * Loads all registered downloaded/printed/shared files from localStorage.
 */
export function getDownloadedFilesRegistry(): DownloadedFileRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOWNLOADED_FILES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse downloaded files registry:', e);
    return [];
  }
}

/**
 * Saves the updated registry and broadcasts a live event so UI components update immediately.
 */
function saveDownloadedFilesRegistry(records: DownloadedFileRecord[]): void {
  try {
    const trimmed = records.slice(0, MAX_STORED_RECORDS);
    localStorage.setItem(STORAGE_KEY_DOWNLOADED_FILES, JSON.stringify(trimmed));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gluck_downloaded_files_updated'));
    }
  } catch (e) {
    console.warn('Quota exceeded while saving downloaded files registry, pruning previewDataUrls:', e);
    try {
      const lightweight = records.slice(0, 150).map(r => ({
        ...r,
        previewDataUrl: undefined
      }));
      localStorage.setItem(STORAGE_KEY_DOWNLOADED_FILES, JSON.stringify(lightweight));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gluck_downloaded_files_updated'));
      }
    } catch {}
  }
}

export interface SaveAndRegisterFileInput {
  title: string;
  fileName: string;
  category: DownloadedFileCategory;
  actionType: DownloadedFileActionType;
  format: DownloadedFileFormat;
  /**
   * Either base64 data (or data URL) for binary files, OR utf-8 text content for text/html/json/csv/ics/vcf
   */
  base64OrDataUrl?: string;
  textContent?: string;
  studentId?: string;
  studentName?: string;
  groupId?: string;
  groupName?: string;
  recipientPhone?: string;
  previewDataUrl?: string;
  showNativeToast?: boolean;
}

/**
 * Saves the file into the structured phone internal folder `Documents/Gluck_Lernstudio/<SubFolder>/<fileName>`
 * (when on Capacitor Android/iOS) AND registers it in the central Downloaded Files Registry.
 */
export async function saveToPhoneSubfolderAndRegister(
  input: SaveAndRegisterFileInput
): Promise<DownloadedFileRecord> {
  const now = new Date();
  const isoStr = now.toISOString();
  const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const subFolder = SUBFOLDER_BY_CATEGORY[input.category] || 'General';
  const safeFileName = sanitizeStorageFileName(input.fileName, input.format);

  const folderInfo = await ensureAppSubfolderExists(input.category);
  const relativeFilePath = `${folderInfo.folderPath}/${safeFileName}`;
  let finalDisplayPath = `${folderInfo.displayPath}/${safeFileName}`;
  let savedNativeUri: string | undefined;
  let estimatedBytes = 0;

  if (input.base64OrDataUrl) {
    const cleanB64 = input.base64OrDataUrl.includes(',')
      ? input.base64OrDataUrl.split(',')[1]
      : input.base64OrDataUrl;
    estimatedBytes = Math.round((cleanB64.length * 3) / 4);

    if (Capacitor.isNativePlatform()) {
      try {
        const writeRes = await Filesystem.writeFile({
          path: relativeFilePath,
          data: cleanB64,
          directory: folderInfo.directory,
          recursive: true
        });
        savedNativeUri = writeRes.uri;
      } catch (err) {
        console.warn('Primary subfolder write failed, falling back to Cache subfolder:', err);
        try {
          const cacheRes = await Filesystem.writeFile({
            path: relativeFilePath,
            data: cleanB64,
            directory: Directory.Cache,
            recursive: true
          });
          savedNativeUri = cacheRes.uri;
          finalDisplayPath = `Cache/${relativeFilePath}`;
        } catch (cacheErr) {
          console.warn('Cache subfolder write failed:', cacheErr);
        }
      }
    }
  } else if (input.textContent) {
    estimatedBytes = new Blob([input.textContent]).size;

    if (Capacitor.isNativePlatform()) {
      try {
        const writeRes = await Filesystem.writeFile({
          path: relativeFilePath,
          data: input.textContent,
          directory: folderInfo.directory,
          encoding: Encoding.UTF8,
          recursive: true
        });
        savedNativeUri = writeRes.uri;
      } catch (err) {
        try {
          const cacheRes = await Filesystem.writeFile({
            path: relativeFilePath,
            data: input.textContent,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
            recursive: true
          });
          savedNativeUri = cacheRes.uri;
          finalDisplayPath = `Cache/${relativeFilePath}`;
        } catch {}
      }
    }
  }

  if (Capacitor.isNativePlatform() && input.showNativeToast) {
    try {
      await Toast.show({
        text: `📁 تم الحفظ في هاتفك: ${finalDisplayPath}`,
        duration: 'short'
      });
    } catch {}
  }

  // Keep previewDataUrl small (< 90KB) so localStorage stays fast
  let safePreview = input.previewDataUrl;
  if (!safePreview && (input.format === 'png' || input.format === 'jpg') && input.base64OrDataUrl) {
    if (input.base64OrDataUrl.length < 120000) {
      safePreview = input.base64OrDataUrl.startsWith('data:')
        ? input.base64OrDataUrl
        : `data:image/${input.format === 'jpg' ? 'jpeg' : 'png'};base64,${input.base64OrDataUrl}`;
    }
  }

  const record: DownloadedFileRecord = {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: input.title,
    fileName: safeFileName,
    category: input.category,
    subFolder,
    fullStoragePath: finalDisplayPath,
    nativeUri: savedNativeUri,
    actionType: input.actionType,
    format: input.format,
    createdAt: isoStr,
    dateStr: localDateStr,
    studentId: input.studentId,
    studentName: input.studentName,
    groupId: input.groupId,
    groupName: input.groupName,
    recipientPhone: input.recipientPhone,
    textContent: input.textContent ? input.textContent.slice(0, 15000) : undefined,
    previewDataUrl: safePreview,
    fileSizeBytes: estimatedBytes
  };

  const current = getDownloadedFilesRegistry();
  saveDownloadedFilesRegistry([record, ...current]);
  return record;
}

export type NativeShareResult = 'shared' | 'cancelled' | 'failed';

function isNativeShareCancelled(err: unknown): boolean {
  const text = `${(err as any)?.message || ''} ${(err as any)?.code || ''} ${(err as any)?.name || ''}`.toLowerCase();
  return text.includes('cancel') || text.includes('abort') || text.includes('dismiss');
}

/**
 * Single shared native file-share helper — the ONLY place that calls
 * Capacitor Share for a file.
 *
 * Android root cause (see review §6): call sites used to pass the file as
 * `url: <file:// URI>` plus `title`/`text`, so Android/WhatsApp received a
 * text share (the file title) instead of the file attachment. This helper
 * always passes `files: [uri]` and never `url` or `text`.
 *
 * - Returns 'shared' when the share sheet was opened successfully.
 * - Returns 'cancelled' when the user dismissed the sheet — no error shown.
 * - Returns 'failed' on a genuine failure (e.g. FileProvider cannot resolve
 *   the URI): shows a clear error toast and does NOT fall back to a text-only
 *   share. The file is already saved on the device, so callers fall through
 *   to their direct-download fallback and the user can re-share the saved
 *   file from "Downloaded Files".
 */
export async function shareFileNative(
  uri: string | undefined | null,
  fileName: string,
  dialogTitle?: string
): Promise<NativeShareResult> {
  if (!uri) {
    return 'failed';
  }
  try {
    await Share.share(dialogTitle ? { files: [uri], dialogTitle } : { files: [uri] });
    return 'shared';
  } catch (err) {
    if (isNativeShareCancelled(err)) {
      return 'cancelled';
    }
    console.warn('Native file share failed:', err);
    try {
      await Toast.show({
        text: `تعذّرت مشاركة الملف «${fileName}» — الملف محفوظ في هاتفك، ويمكنك إعادة مشاركته من «الملفات المُنزَّلة».`,
        duration: 'long'
      });
    } catch {}
    return 'failed';
  }
}

/**
 * Deletes a single file record from the registry (and attempts to remove from native storage if present).
 */
export async function deleteDownloadedFileRecord(id: string): Promise<void> {
  const current = getDownloadedFilesRegistry();
  const target = current.find(r => r.id === id);
  const updated = current.filter(r => r.id !== id);
  saveDownloadedFilesRegistry(updated);

  if (target && Capacitor.isNativePlatform()) {
    try {
      const relPath = `${APP_ROOT_FOLDER}/${target.subFolder}/${target.fileName}`;
      await Filesystem.deleteFile({
        path: relPath,
        directory: Directory.Documents
      });
    } catch {}
  }
}

/**
 * Clears all records or records matching a specific category.
 */
export function clearDownloadedFilesRegistry(category?: DownloadedFileCategory): void {
  if (!category) {
    saveDownloadedFilesRegistry([]);
    return;
  }
  const current = getDownloadedFilesRegistry();
  saveDownloadedFilesRegistry(current.filter(r => r.category !== category));
}

/**
 * Re-shares or re-opens a previously registered file record via WhatsApp or native Share sheet.
 */
export async function reshareRegisteredFileToWhatsApp(record: DownloadedFileRecord): Promise<boolean> {
  if (Capacitor.isNativePlatform() && record.nativeUri) {
    const shareResult = await shareFileNative(record.nativeUri, record.fileName, 'مشاركة الملف عبر واتساب');
    if (shareResult === 'shared') {
      // WhatsApp text is a SEPARATE step, after the file share succeeds —
      // never in the same share call (text turns the share into text-only).
      const textToShare = record.textContent || `📄 ${record.title}\n📁 المسار: ${record.fullStoragePath}`;
      window.open(buildWhatsAppUrl(record.recipientPhone || '', textToShare), '_blank');
      return true;
    }
    if (shareResult === 'cancelled') {
      return true;
    }
    // 'failed': the helper already showed a clear error toast. Do NOT fall
    // back to a WhatsApp text share — that is the reported bug (the file
    // title shared as text instead of the file). The file stays saved and
    // can be re-shared from Downloaded Files.
    return false;
  }

  const textToShare = record.textContent || `📄 ${record.title}\n📁 المسار: ${record.fullStoragePath}`;
  const url = buildWhatsAppUrl(record.recipientPhone || '', textToShare);
  window.open(url, '_blank');
  return true;
}

/**
 * Re-downloads a registered file record on Web/Desktop or alerts the phone path on Native.
 */
export async function redownloadRegisteredFile(record: DownloadedFileRecord): Promise<boolean> {
  if (Capacitor.isNativePlatform() && record.nativeUri) {
    const shareResult = await shareFileNative(record.nativeUri, record.fileName, 'فتح أو حفظ الملف');
    if (shareResult !== 'failed') {
      return true;
    }
    // 'failed': the helper already showed a clear error toast; fall through
    // to the direct-download fallbacks below.
  }

  if (record.previewDataUrl) {
    const link = document.createElement('a');
    link.href = record.previewDataUrl;
    link.download = record.fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
    }, 1000);
    return true;
  }

  if (record.textContent) {
    const mimeMap: Record<string, string> = {
      html: 'text/html;charset=utf-8',
      json: 'application/json;charset=utf-8',
      csv: 'text/csv;charset=utf-8',
      ics: 'text/calendar;charset=utf-8',
      vcf: 'text/vcard;charset=utf-8',
      txt: 'text/plain;charset=utf-8'
    };
    const blob = new Blob([record.textContent], { type: mimeMap[record.format] || 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = record.fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1500);
    return true;
  }

  return false;
}

/**
 * Prints a registered file record if it has textContent or previewDataUrl.
 */
export function reprintRegisteredFile(record: DownloadedFileRecord): boolean {
  if (record.previewDataUrl) {
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>${record.title}</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;">
            <img src="${record.previewDataUrl}" style="max-width:100%;max-height:100vh;" onload="window.print();" />
          </body>
        </html>
      `);
      printWin.document.close();
      return true;
    }
  }

  if (record.textContent) {
    const isHtml = record.format === 'html' || record.textContent.trim().startsWith('<!DOCTYPE') || record.textContent.trim().startsWith('<html');
    const printWin = window.open('', '_blank');
    if (printWin) {
      if (isHtml) {
        printWin.document.write(record.textContent);
      } else {
        printWin.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
            <head>
              <meta charset="utf-8" />
              <title>${record.title}</title>
              <style>
                body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 32px; color: #0f172a; line-height: 1.8; }
                .box { max-width: 680px; margin: 0 auto; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 28px; background: #fff; }
                h2 { color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-top: 0; }
                pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
              </style>
            </head>
            <body onload="window.print();">
              <div class="box">
                <h2>${record.title}</h2>
                <pre>${record.textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
              </div>
            </body>
          </html>
        `);
      }
      printWin.document.close();
      return true;
    }
  }

  return false;
}
