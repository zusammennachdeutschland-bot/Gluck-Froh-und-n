/**
 * Web Platform Stub for Downloaded Files Service.
 * In a browser, triggers native browser file downloads.
 */

export const APP_ROOT_FOLDER = 'Gluck_Lernstudio';

export async function saveToPhoneSubfolderAndRegister(opts: {
  base64Data?: string;
  blob?: Blob;
  fileName: string;
  category?: string;
  actionType?: string;
  mimeType?: string;
  notifyToast?: boolean;
}) {
  try {
    if (typeof window !== 'undefined') {
      const link = document.createElement('a');
      if (opts.blob) {
        link.href = URL.createObjectURL(opts.blob);
      } else if (opts.base64Data) {
        link.href = `data:${opts.mimeType || 'application/pdf'};base64,${opts.base64Data}`;
      }
      link.download = opts.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    return { success: true, filePath: opts.fileName };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
