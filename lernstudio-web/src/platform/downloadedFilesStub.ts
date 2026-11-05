/**
 * Web Platform Stub for Downloaded Files Service.
 * In a browser, triggers native browser file downloads.
 */

export const APP_ROOT_FOLDER = 'Gluck_Lernstudio';

export async function saveToPhoneSubfolderAndRegister(opts: {
  base64Data?: string;
  base64OrDataUrl?: string;
  blob?: Blob;
  fileName: string;
  title?: string;
  category?: string;
  actionType?: string;
  format?: string;
  mimeType?: string;
  notifyToast?: boolean;
  groupName?: string;
  previewDataUrl?: string;
  showNativeToast?: boolean;
  textContent?: string;
}): Promise<{ success: boolean; filePath: string; nativeUri: string; error?: string }> {
  try {
    if (typeof window !== 'undefined') {
      const link = document.createElement('a');
      if (opts.blob) {
        link.href = URL.createObjectURL(opts.blob);
      } else if (opts.base64OrDataUrl) {
        link.href = opts.base64OrDataUrl;
      } else if (opts.base64Data) {
        link.href = `data:${opts.mimeType || 'application/pdf'};base64,${opts.base64Data}`;
      } else if (opts.textContent) {
        const blob = new Blob([opts.textContent], { type: 'text/html;charset=utf-8' });
        link.href = URL.createObjectURL(blob);
      }
      link.download = opts.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    return { success: true, filePath: opts.fileName, nativeUri: opts.fileName };
  } catch (err: any) {
    return { success: false, filePath: '', nativeUri: '', error: err.message };
  }
}
