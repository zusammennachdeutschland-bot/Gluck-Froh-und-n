import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast } from '@capacitor/toast';
import { Dialog } from '@capacitor/dialog';
import { CertificateRecord } from '../types';
import { CertificateRenderer } from '../components/certificates/templates/CertificateRenderer';
import { buildWhatsAppUrl } from './phoneUtils';

export const CERTIFICATES_FOLDER_NAME = 'AGS_Certificates';

export interface ExportCertificateOptions {
  filename?: string;
  format?: 'png' | 'jpeg' | 'pdf';
  quality?: number;
  scale?: number;
  notifyOnSuccess?: boolean;
  elementId?: string;
}

// Canvas helper for standard color conversion fallback
let colorHelperCtx: CanvasRenderingContext2D | null = null;

function getColorHelperCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!colorHelperCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    colorHelperCtx = c.getContext('2d', { willReadFrequently: true });
  }
  return colorHelperCtx;
}

/**
 * Pure mathematical converter from OKLCH to standard RGB/RGBA.
 * Guaranteed to never output oklch(...) or throw errors in html2canvas.
 */
export function oklchToRgb(oklchStr: string): string {
  try {
    const match = oklchStr.match(/oklch\(\s*([^/)]+?)(?:\s*\/\s*([^)]+))?\s*\)/i);
    if (!match) return '#000000';

    const parts = match[1].trim().split(/[\s,]+/);
    if (parts.length < 3) return '#000000';

    // Parse Lightness
    let L = 0;
    if (parts[0].endsWith('%')) {
      L = parseFloat(parts[0]) / 100;
    } else {
      L = parseFloat(parts[0]);
    }

    // Parse Chroma
    let C = 0;
    if (parts[1].endsWith('%')) {
      C = (parseFloat(parts[1]) / 100) * 0.4;
    } else {
      C = parseFloat(parts[1]);
    }

    // Parse Hue
    let H = 0;
    const hStr = parts[2].toLowerCase();
    if (hStr === 'none') {
      H = 0;
    } else if (hStr.endsWith('deg')) {
      H = parseFloat(hStr);
    } else if (hStr.endsWith('rad')) {
      H = (parseFloat(hStr) * 180) / Math.PI;
    } else if (hStr.endsWith('turn')) {
      H = parseFloat(hStr) * 360;
    } else {
      H = parseFloat(hStr) || 0;
    }

    // Parse Alpha
    let alpha = 1;
    const alphaStr = match[2] || (parts[3] ? parts[3] : null);
    if (alphaStr) {
      if (alphaStr.trim().endsWith('%')) {
        alpha = parseFloat(alphaStr) / 100;
      } else {
        alpha = parseFloat(alphaStr);
      }
      if (isNaN(alpha)) alpha = 1;
    }

    // OKLCH -> OKLAB
    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    // OKLAB -> Linear sRGB
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const rLinear = +4.0767434753 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    // Gamma transfer function to standard 8-bit sRGB
    const toSrgb = (x: number): number => {
      const clamped = Math.max(0, Math.min(1, isNaN(x) ? 0 : x));
      const val = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(255, val * 255)));
    };

    const r = toSrgb(rLinear);
    const g = toSrgb(gLinear);
    const bVal = toSrgb(bLinear);

    if (alpha < 0.999) {
      return `rgba(${r}, ${g}, ${bVal}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
    }
    return `rgb(${r}, ${g}, ${bVal})`;
  } catch {
    return '#000000';
  }
}

/**
 * Pure mathematical converter from OKLAB to standard RGB/RGBA.
 */
export function oklabToRgb(oklabStr: string): string {
  try {
    const match = oklabStr.match(/oklab\(\s*([^/)]+?)(?:\s*\/\s*([^)]+))?\s*\)/i);
    if (!match) return '#000000';

    const parts = match[1].trim().split(/[\s,]+/);
    if (parts.length < 3) return '#000000';

    let L = 0;
    if (parts[0].endsWith('%')) {
      L = parseFloat(parts[0]) / 100;
    } else {
      L = parseFloat(parts[0]);
    }

    const a = parseFloat(parts[1]) || 0;
    const b = parseFloat(parts[2]) || 0;

    let alpha = 1;
    const alphaStr = match[2] || (parts[3] ? parts[3] : null);
    if (alphaStr) {
      if (alphaStr.trim().endsWith('%')) {
        alpha = parseFloat(alphaStr) / 100;
      } else {
        alpha = parseFloat(alphaStr);
      }
      if (isNaN(alpha)) alpha = 1;
    }

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const rLinear = +4.0767434753 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const toSrgb = (x: number): number => {
      const clamped = Math.max(0, Math.min(1, isNaN(x) ? 0 : x));
      const val = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(255, val * 255)));
    };

    const r = toSrgb(rLinear);
    const g = toSrgb(gLinear);
    const bVal = toSrgb(bLinear);

    if (alpha < 0.999) {
      return `rgba(${r}, ${g}, ${bVal}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
    }
    return `rgb(${r}, ${g}, ${bVal})`;
  } catch {
    return '#000000';
  }
}

/**
 * Converts any modern CSS color string into standard rgb/rgba/hex string.
 */
export function convertColorToStandard(colorStr: string, fallback = 'rgba(255, 255, 255, 1)'): string {
  if (!colorStr) return fallback;
  const lower = colorStr.toLowerCase().trim();

  if (lower.includes('oklch(')) {
    return oklchToRgb(colorStr);
  }
  if (lower.includes('oklab(')) {
    return oklabToRgb(colorStr);
  }

  const ctx = getColorHelperCtx();
  if (ctx) {
    try {
      ctx.fillStyle = 'transparent';
      ctx.fillStyle = colorStr;
      const res = ctx.fillStyle;
      if (res && res !== 'transparent' && !res.includes('oklch') && !res.includes('oklab')) {
        return res;
      }
    } catch {
      // ignore
    }
  }

  if (lower.includes('white') || lower.includes('255') || lower.includes('fff') || lower.includes('slate-100') || lower.includes('slate-50')) {
    return 'rgba(255, 255, 255, 0.95)';
  }

  return fallback;
}

/**
 * Replaces all occurrences of oklab(...), oklch(...), and color-mix(...) in a CSS string with standard rgba/rgb.
 */
export function sanitizeModernCssColors(cssValue: string): string {
  if (!cssValue || typeof cssValue !== 'string') return cssValue;
  if (
    !cssValue.includes('oklab') &&
    !cssValue.includes('oklch') &&
    !cssValue.includes('color-mix') &&
    !cssValue.includes('color(')
  ) {
    return cssValue;
  }

  let result = cssValue;

  // 1. Replace oklch(...)
  result = result.replace(/oklch\([^)]+\)/gi, match => oklchToRgb(match));

  // 2. Replace oklab(...)
  result = result.replace(/oklab\([^)]+\)/gi, match => oklabToRgb(match));

  // 3. Replace color-mix(...) or color(...)
  if (result.includes('color-mix') || result.includes('color(')) {
    result = result.replace(/(?:color-mix|color)\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/gi, match => {
      return convertColorToStandard(match, 'transparent');
    });
  }

  return result;
}

/**
 * Converts a base64 data URL into a binary Blob efficiently without high RAM pressure.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bstr = atob(arr[1] || '');
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.error('Error converting dataUrl to Blob:', err);
    return new Blob([], { type: 'application/octet-stream' });
  }
}

/**
 * Helper to trigger standard web browser file download
 */
function triggerWebDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

/**
 * Ensures the dedicated certificates folder exists on the device storage.
 */
export async function ensureCertificatesFolderExists(): Promise<{ success: boolean; path: string; directory: Directory }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: true, path: 'Downloads', directory: Directory.Documents };
  }

  // 1. Try Directory.Documents (Standard Android Documents directory)
  try {
    await Filesystem.mkdir({
      path: CERTIFICATES_FOLDER_NAME,
      directory: Directory.Documents,
      recursive: true
    });
    return { success: true, path: `Documents/${CERTIFICATES_FOLDER_NAME}`, directory: Directory.Documents };
  } catch (err1: any) {
    if (err1?.message?.includes('exists') || err1?.code === 'OS-DIR-EXISTS') {
      return { success: true, path: `Documents/${CERTIFICATES_FOLDER_NAME}`, directory: Directory.Documents };
    }
    console.warn('Directory.Documents mkdir notice:', err1);
  }

  // 2. Try Directory.ExternalStorage
  try {
    await Filesystem.mkdir({
      path: CERTIFICATES_FOLDER_NAME,
      directory: Directory.ExternalStorage,
      recursive: true
    });
    return { success: true, path: `ExternalStorage/${CERTIFICATES_FOLDER_NAME}`, directory: Directory.ExternalStorage };
  } catch (err2: any) {
    if (err2?.message?.includes('exists')) {
      return { success: true, path: `ExternalStorage/${CERTIFICATES_FOLDER_NAME}`, directory: Directory.ExternalStorage };
    }
    console.warn('Directory.ExternalStorage mkdir notice:', err2);
  }

  // 3. Fallback to Directory.Data (App-specific storage)
  try {
    await Filesystem.mkdir({
      path: CERTIFICATES_FOLDER_NAME,
      directory: Directory.Data,
      recursive: true
    });
    return { success: true, path: `AppStorage/${CERTIFICATES_FOLDER_NAME}`, directory: Directory.Data };
  } catch {
    return { success: true, path: `Cache/${CERTIFICATES_FOLDER_NAME}`, directory: Directory.Cache };
  }
}

/**
 * Saves a file directly to the dedicated phone folder without opening any share dialog.
 */
export async function saveFileToNativeFolder(
  filename: string,
  base64Data: string,
  mimeType: string
): Promise<{ success: boolean; path: string; uri?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, path: '' };
  }

  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const folderInfo = await ensureCertificatesFolderExists();

  try {
    const res = await Filesystem.writeFile({
      path: `${CERTIFICATES_FOLDER_NAME}/${filename}`,
      data: cleanBase64,
      directory: folderInfo.directory,
      recursive: true
    });
    return { success: true, path: `${folderInfo.path}/${filename}`, uri: res.uri };
  } catch (err: any) {
    console.warn(`Failed writing to ${folderInfo.path}, trying Cache fallback:`, err);
    try {
      const res = await Filesystem.writeFile({
        path: filename,
        data: cleanBase64,
        directory: Directory.Cache,
        recursive: true
      });
      return { success: true, path: `Cache/${filename}`, uri: res.uri };
    } catch (fallbackErr) {
      console.error('All native file write attempts failed:', fallbackErr);
      throw fallbackErr;
    }
  }
}

// Ensure CanvasGradient & Context2D are protected against non-finite values (NaN/Infinity)
if (typeof window !== 'undefined') {
  if (typeof CanvasGradient !== 'undefined' && CanvasGradient.prototype) {
    const cgProto = CanvasGradient.prototype as any;
    if (!cgProto._safeAddColorStopPatched) {
      const origAddColorStop = cgProto.addColorStop;
      cgProto.addColorStop = function (offset: number, color: string) {
        let safeOffset = offset;
        if (typeof safeOffset !== 'number' || !Number.isFinite(safeOffset) || Number.isNaN(safeOffset)) {
          safeOffset = 0;
        } else if (safeOffset < 0) {
          safeOffset = 0;
        } else if (safeOffset > 1) {
          safeOffset = 1;
        }
        try {
          return origAddColorStop.call(this, safeOffset, color);
        } catch {
          try {
            return origAddColorStop.call(this, safeOffset, 'rgba(0,0,0,0)');
          } catch {
            // Ignore if unable to add stop
          }
        }
      };
      cgProto._safeAddColorStopPatched = true;
    }
  }

  if (typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype) {
    const ctxProto = CanvasRenderingContext2D.prototype as any;
    if (!ctxProto._safeCanvasGradientPatched) {
      const origLinear = ctxProto.createLinearGradient;
      ctxProto.createLinearGradient = function (x0: number, y0: number, x1: number, y1: number) {
        const safeX0 = Number.isFinite(x0) ? x0 : 0;
        const safeY0 = Number.isFinite(y0) ? y0 : 0;
        const safeX1 = Number.isFinite(x1) ? x1 : 0;
        const safeY1 = Number.isFinite(y1) ? y1 : 0;
        return origLinear.call(this, safeX0, safeY0, safeX1, safeY1);
      };

      const origRadial = ctxProto.createRadialGradient;
      ctxProto.createRadialGradient = function (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
        const safeX0 = Number.isFinite(x0) ? x0 : 0;
        const safeY0 = Number.isFinite(y0) ? y0 : 0;
        const safeR0 = Number.isFinite(r0) ? Math.max(0, r0) : 0;
        const safeX1 = Number.isFinite(x1) ? x1 : 0;
        const safeY1 = Number.isFinite(y1) ? y1 : 0;
        const safeR1 = Number.isFinite(r1) ? Math.max(0, r1) : 0;
        return origRadial.call(this, safeX0, safeY0, safeR0, safeX1, safeY1, safeR1);
      };
      ctxProto._safeCanvasGradientPatched = true;
    }
  }
}

/**
 * Sanitizes the cloned DOM document before html2canvas rendering.
 */
function sanitizeClonedDocument(clonedDoc: Document, targetEl?: HTMLElement | null): void {
  clonedDoc.documentElement.classList.remove('dark');
  if (clonedDoc.body) {
    clonedDoc.body.classList.remove('dark');
    clonedDoc.body.style.backgroundColor = '#ffffff';
  }

  if (targetEl) {
    targetEl.style.opacity = '1';
    targetEl.style.visibility = 'visible';
    targetEl.style.display = 'block';
  }

  if (clonedDoc.head) {
    const styleElem = clonedDoc.createElement('style');
    styleElem.id = 'cloned-cert-fonts-and-shaping';
    styleElem.textContent = `
      .font-arabic-serif {
        font-family: 'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Cairo', serif !important;
        font-feature-settings: "liga" 1, "calt" 1, "dlig" 1 !important;
        text-rendering: geometricPrecision !important;
        -webkit-font-smoothing: antialiased !important;
      }
      .font-arabic-sans {
        font-family: 'Cairo', 'Alexandria', 'Plus Jakarta Sans', system-ui, sans-serif !important;
        font-feature-settings: "liga" 1, "calt" 1 !important;
        text-rendering: geometricPrecision !important;
        -webkit-font-smoothing: antialiased !important;
      }
      .font-arabic-signature {
        font-family: 'Aref Ruqaa', 'Amiri', 'Alexandria', serif !important;
        font-feature-settings: "liga" 1, "calt" 1 !important;
        text-rendering: geometricPrecision !important;
      }
      .font-cert-serif {
        font-family: 'Cinzel', 'Playfair Display', Georgia, serif !important;
      }
      .font-cert-sans {
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
      }
      .font-signature, .font-handwriting {
        font-family: 'Dancing Script', 'Great Vibes', 'Alex Brush', 'Caveat', 'Pinyon Script', cursive, 'Brush Script MT', italic !important;
      }
    `;
    clonedDoc.head.appendChild(styleElem);

    if (typeof document !== 'undefined' && document.head) {
      const links = document.head.querySelectorAll('link[rel="stylesheet"]');
      links.forEach(link => {
        const clonedLink = link.cloneNode(true) as HTMLLinkElement;
        clonedDoc.head.appendChild(clonedLink);
      });
    }
  }

  // 1. Sanitize all <style> tags in the cloned document
  const styleTags = clonedDoc.querySelectorAll('style');
  styleTags.forEach(style => {
    if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab') || style.textContent.includes('color-mix') || style.textContent.includes('color('))) {
      style.textContent = sanitizeModernCssColors(style.textContent);
    }
  });

  // 2. Sanitize inline attributes on target elements
  const root = targetEl || clonedDoc.body || clonedDoc.documentElement;
  if (!root) return;

  const allElements = [root, ...Array.from(root.querySelectorAll('*'))];

  for (const node of allElements) {
    if (node instanceof HTMLElement || node instanceof SVGElement) {
      node.style.animation = 'none';
      node.style.transition = 'none';

      const rawStyle = node.getAttribute('style');
      if (rawStyle && (rawStyle.includes('oklch') || rawStyle.includes('oklab') || rawStyle.includes('color-mix') || rawStyle.includes('color('))) {
        node.setAttribute('style', sanitizeModernCssColors(rawStyle));
      }

      if (node.hasAttribute('fill')) {
        const fill = node.getAttribute('fill');
        if (fill && (fill.includes('oklch') || fill.includes('oklab') || fill.includes('color-mix'))) {
          node.setAttribute('fill', sanitizeModernCssColors(fill));
        }
      }
      if (node.hasAttribute('stroke')) {
        const stroke = node.getAttribute('stroke');
        if (stroke && (stroke.includes('oklch') || stroke.includes('oklab') || stroke.includes('color-mix'))) {
          node.setAttribute('stroke', sanitizeModernCssColors(stroke));
        }
      }
      if (node.hasAttribute('stop-color')) {
        const stopColor = node.getAttribute('stop-color');
        if (stopColor && (stopColor.includes('oklch') || stopColor.includes('oklab') || stopColor.includes('color-mix'))) {
          node.setAttribute('stop-color', sanitizeModernCssColors(stopColor));
        }
      }
    }
  }
}

/**
 * Robust helper to render any certificate to an HTMLCanvasElement.
 * Automatically mounts an offscreen container if the target element is hidden or not present in DOM.
 */
export async function renderCertificateToCanvas(
  target: HTMLElement | string | Partial<CertificateRecord>,
  scale?: number,
  preferredElementId?: string
): Promise<HTMLCanvasElement> {
  // Yield thread immediately so React UI updates spinner state
  await new Promise(resolve => setTimeout(resolve, 50));

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Certificate rendering timed out after 20 seconds')), 20000);
  });

  const isNative = Capacitor.isNativePlatform();
  const isMobile = isNative || (typeof window !== 'undefined' && window.innerWidth < 768);
  // Scale 2.0 produces razor-sharp 2400x1697 master A4 print quality
  const chosenScale = scale ? scale : (isMobile ? 1.75 : 2.0);

  const renderPromise = (async () => {
    let elementToCapture: HTMLElement | null = null;
    let tempContainer: HTMLDivElement | null = null;
    let rootToUnmount: ReturnType<typeof createRoot> | null = null;

    try {
      // 1. If target is a CertificateRecord object, ALWAYS render in master 1200px A4 container
      // This ensures 100% full-resolution, crisp typography, auto-fit name calculations, and no dependency on fullscreen/modal size!
      const isTargetRecord = typeof target === 'object' && !(target instanceof HTMLElement);

      if (isTargetRecord) {
        const certData: Partial<CertificateRecord> = target;

        tempContainer = document.createElement('div');
        tempContainer.id = `temp-cert-export-${Date.now()}`;
        tempContainer.style.position = 'fixed';
        tempContainer.style.top = '0';
        tempContainer.style.left = '0';
        tempContainer.style.width = '1200px';
        tempContainer.style.height = '848px';
        tempContainer.style.zIndex = '-9999';
        tempContainer.style.opacity = '0.01';
        tempContainer.style.pointerEvents = 'none';
        tempContainer.style.backgroundColor = '#ffffff';

        document.body.appendChild(tempContainer);

        rootToUnmount = createRoot(tempContainer);
        rootToUnmount.render(
          React.createElement(
            'div',
            { 
              className: 'w-[1200px] h-[848px] bg-white p-0 m-0 overflow-hidden box-border',
              style: { width: '1200px', height: '848px', boxSizing: 'border-box' }
            },
            React.createElement(CertificateRenderer, {
              certificate: certData,
              elementId: `inner-render-${Date.now()}`,
              className: 'w-[1200px] h-[848px] max-w-none shadow-none rounded-none'
            })
          )
        );

        // Wait for React 19 render pass and layout measurement
        await new Promise(resolve => setTimeout(resolve, 250));

        // Wait for all images inside to load
        const images = Array.from(tempContainer.querySelectorAll('img'));
        if (images.length > 0) {
          await Promise.all(
            images.map(
              img =>
                new Promise(res => {
                  if (img.complete) return res(true);
                  img.onload = () => res(true);
                  img.onerror = () => res(true);
                  setTimeout(() => res(true), 2500);
                })
            )
          );
        }

        elementToCapture = (tempContainer.firstElementChild as HTMLElement) || tempContainer;
      } else {
        // 2. If target is a string ID or HTMLElement
        if (preferredElementId) {
          elementToCapture = document.getElementById(preferredElementId);
        }
        if (!elementToCapture && typeof target === 'string') {
          elementToCapture = document.getElementById(target);
        }
        if (!elementToCapture && target instanceof HTMLElement) {
          elementToCapture = target;
        }

        const isElementUsable =
          elementToCapture &&
          document.body.contains(elementToCapture) &&
          elementToCapture.offsetWidth >= 1000 &&
          elementToCapture.offsetHeight >= 700 &&
          window.getComputedStyle(elementToCapture).display !== 'none' &&
          window.getComputedStyle(elementToCapture).visibility !== 'hidden';

        if (!isElementUsable) {
          // If on-screen element is smaller than master size (e.g. inside a modal/preview), fallback to clean master render
          const fallbackCert: Partial<CertificateRecord> = {
            studentName: 'Student',
            recipientName: 'Student',
            title: 'Certificate of Excellence',
            language: 'de' as const,
            template: 'classic' as const
          };

          tempContainer = document.createElement('div');
          tempContainer.id = `temp-cert-export-${Date.now()}`;
          tempContainer.style.position = 'fixed';
          tempContainer.style.top = '0';
          tempContainer.style.left = '0';
          tempContainer.style.width = '1200px';
          tempContainer.style.height = '848px';
          tempContainer.style.zIndex = '-9999';
          tempContainer.style.opacity = '0.01';
          tempContainer.style.pointerEvents = 'none';
          tempContainer.style.backgroundColor = '#ffffff';

          document.body.appendChild(tempContainer);

          rootToUnmount = createRoot(tempContainer);
          rootToUnmount.render(
            React.createElement(
              'div',
              { 
                className: 'w-[1200px] h-[848px] bg-white p-0 m-0 overflow-hidden box-border',
                style: { width: '1200px', height: '848px', boxSizing: 'border-box' }
              },
              React.createElement(CertificateRenderer, {
                certificate: fallbackCert,
                elementId: `inner-render-${Date.now()}`,
                className: 'w-[1200px] h-[848px] max-w-none shadow-none rounded-none'
              })
            )
          );

          await new Promise(resolve => setTimeout(resolve, 250));
          elementToCapture = (tempContainer.firstElementChild as HTMLElement) || tempContainer;
        }
      }

      // Guarantee all web fonts are fully loaded before capture
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // continue
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const captureWidth = elementToCapture.offsetWidth || 1200;
      const captureHeight = elementToCapture.offsetHeight || 848;

      const canvas = await html2canvas(elementToCapture, {
        scale: chosenScale,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 10000,
        logging: false,
        backgroundColor: '#ffffff',
        width: captureWidth,
        height: captureHeight,
        onclone: (clonedDoc, clonedElement) => {
          sanitizeClonedDocument(clonedDoc, clonedElement as HTMLElement);
        }
      });

      return canvas;
    } finally {
      if (rootToUnmount && tempContainer) {
        setTimeout(() => {
          try {
            rootToUnmount?.unmount();
          } catch (err) {
            console.warn('Error unmounting offscreen cert root:', err);
          }
          if (tempContainer && document.body.contains(tempContainer)) {
            try {
              document.body.removeChild(tempContainer);
            } catch (err) {
              console.warn('Error removing offscreen cert container:', err);
            }
          }
        }, 50);
      }
    }
  })();

  return Promise.race([renderPromise, timeoutPromise]);
}

/**
 * Downloads / Saves a certificate as PNG or JPEG image.
 * On Native Android: Saves directly into phone Documents/AGS_Certificates folder without opening Share.
 * On Web: Downloads directly to browser Downloads.
 */
export async function exportCertificateAsImage(
  target: HTMLElement | string | Partial<CertificateRecord>,
  filename = 'Certificate',
  format: 'png' | 'jpeg' = 'png',
  options: { notifyOnSuccess?: boolean; elementId?: string } = {}
): Promise<{ success: boolean; path?: string }> {
  try {
    const canvas = await renderCertificateToCanvas(target, undefined, options.elementId);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, 0.98);
    const safeFilename = `${filename.replace(/[/\\?%*:|"<>]/g, '_')}.${format === 'jpeg' ? 'jpg' : 'png'}`;

    if (Capacitor.isNativePlatform()) {
      const saveRes = await saveFileToNativeFolder(safeFilename, dataUrl, mimeType);

      if (options.notifyOnSuccess !== false) {
        try {
          await Toast.show({
            text: `✅ تم حفظ الصورة بنجاح في:\n${saveRes.path}`,
            duration: 'long'
          });
        } catch {
          // ignore
        }
      }

      return { success: true, path: saveRes.path };
    }

    // Web Fallback using Blob URL
    const blob = dataUrlToBlob(dataUrl);
    triggerWebDownload(blob, safeFilename);
    return { success: true, path: safeFilename };
  } catch (error) {
    console.error('Error exporting certificate as image:', error);
    throw error;
  }
}

/**
 * Exports / Saves a certificate as a high quality vector-embedded PDF (A4 Landscape).
 * On Native Android: Saves directly into phone Documents/AGS_Certificates folder without opening Share.
 * On Web: Downloads directly to browser Downloads.
 */
export async function exportCertificateAsPdf(
  target: HTMLElement | string | Partial<CertificateRecord>,
  filename = 'Certificate',
  options: { notifyOnSuccess?: boolean; elementId?: string } = {}
): Promise<{ success: boolean; path?: string }> {
  try {
    const canvas = await renderCertificateToCanvas(target, undefined, options.elementId);
    const imgData = canvas.toDataURL('image/jpeg', 0.96);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

    const safeFilename = `${filename.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf.output('datauristring');
      const saveRes = await saveFileToNativeFolder(safeFilename, pdfBase64, 'application/pdf');

      if (options.notifyOnSuccess !== false) {
        try {
          await Toast.show({
            text: `✅ تم حفظ ملف PDF بنجاح في:\n${saveRes.path}`,
            duration: 'long'
          });
        } catch {
          // ignore
        }
      }

      return { success: true, path: saveRes.path };
    }

    // Web fallback using Blob URL
    const pdfBlob = pdf.output('blob');
    triggerWebDownload(pdfBlob, safeFilename);
    return { success: true, path: safeFilename };
  } catch (error) {
    console.error('Error exporting certificate as PDF:', error);
    throw error;
  }
}

/**
 * Dedicated function to save a certificate into the dedicated phone folder with full details and alert dialog.
 */
export async function saveCertificateToPhoneFolder(
  target: HTMLElement | string | Partial<CertificateRecord>,
  format: 'pdf' | 'png' = 'pdf',
  options: { filename?: string; elementId?: string } = {}
): Promise<{ success: boolean; path: string; message: string }> {
  const recipient = typeof target === 'object' && !(target instanceof HTMLElement) 
    ? (target.recipientName || target.studentName || 'Student')
    : 'Student';
  const title = typeof target === 'object' && !(target instanceof HTMLElement)
    ? (target.courseOrLevelTitle || target.title || 'Certificate')
    : 'Certificate';

  const baseFilename = options.filename || `${recipient}_${title}`.replace(/\s+/g, '_');

  try {
    let resultPath = '';
    if (format === 'pdf') {
      const res = await exportCertificateAsPdf(target, baseFilename, { notifyOnSuccess: false, elementId: options.elementId });
      resultPath = res.path || `${baseFilename}.pdf`;
    } else {
      const res = await exportCertificateAsImage(target, baseFilename, 'png', { notifyOnSuccess: false, elementId: options.elementId });
      resultPath = res.path || `${baseFilename}.png`;
    }

    const successMessage = Capacitor.isNativePlatform()
      ? `تم حفظ الشهادة بنجاح في مجلد الهاتف:\n📁 ${resultPath}\n\nيمكنك العثور عليها بسهولة في تطبيق "الملفات" (Files) بهاتفك.`
      : `تم تحميل الشهادة بنجاح إلى مجلد التنزيلات بجهازك (${resultPath})`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Dialog.alert({
          title: '✅ تم الحفظ في مجلد الشهادات',
          message: successMessage,
          buttonTitle: 'حسناً'
        });
      } catch {
        await Toast.show({ text: `✅ تم الحفظ في: ${resultPath}`, duration: 'long' });
      }
    }

    return {
      success: true,
      path: resultPath,
      message: successMessage
    };
  } catch (err: any) {
    console.error('Error in saveCertificateToPhoneFolder:', err);
    const errorMsg = err?.message || 'حدث خطأ أثناء حفظ الشهادة في الهاتف.';
    if (Capacitor.isNativePlatform()) {
      try {
        await Dialog.alert({
          title: '⚠️ خطأ في الحفظ',
          message: errorMsg,
          buttonTitle: 'إغلاق'
        });
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

/**
 * Batch saves all provided certificates into the dedicated phone folder.
 */
export async function saveAllCertificatesToPhoneFolder(
  certificatesList: CertificateRecord[],
  format: 'pdf' | 'png' = 'pdf',
  onProgress?: (current: number, total: number, studentName: string) => void
): Promise<{ success: boolean; savedCount: number; folderPath: string }> {
  if (!certificatesList || certificatesList.length === 0) {
    return { success: false, savedCount: 0, folderPath: '' };
  }

  const folderInfo = await ensureCertificatesFolderExists();
  let savedCount = 0;

  for (let i = 0; i < certificatesList.length; i++) {
    const cert = certificatesList[i];
    const recipient = cert.recipientName || cert.studentName || 'Student';
    const title = cert.courseOrLevelTitle || cert.title || 'Certificate';
    const filename = `${recipient}_${title}_${cert.id.slice(-4)}`.replace(/\s+/g, '_');

    if (onProgress) {
      onProgress(i + 1, certificatesList.length, recipient);
    }

    try {
      if (format === 'pdf') {
        await exportCertificateAsPdf(cert, filename, { notifyOnSuccess: false });
      } else {
        await exportCertificateAsImage(cert, filename, 'png', { notifyOnSuccess: false });
      }
      savedCount++;
    } catch (err) {
      console.warn(`Failed to export certificate for ${recipient}:`, err);
    }

    // Yield thread to keep UI smooth
    await new Promise(resolve => setTimeout(resolve, 80));
  }

  return {
    success: savedCount > 0,
    savedCount,
    folderPath: folderInfo.path
  };
}

/**
 * Helper to download PDF for a CertificateRecord
 */
export async function downloadCertificatePDF(
  cert: Partial<CertificateRecord>,
  elementId?: string
): Promise<{ success: boolean; path?: string }> {
  const recipient = cert.recipientName || cert.studentName || 'Student';
  const title = cert.courseOrLevelTitle || cert.title || 'Certificate';
  const filename = `${recipient}_${title}`.replace(/\s+/g, '_');
  return exportCertificateAsPdf(cert, filename, { elementId });
}

/**
 * Helper to download Image for a CertificateRecord
 */
export async function downloadCertificateImage(
  cert: Partial<CertificateRecord>,
  format: 'png' | 'jpeg' = 'png',
  elementId?: string
): Promise<{ success: boolean; path?: string }> {
  const recipient = cert.recipientName || cert.studentName || 'Student';
  const title = cert.courseOrLevelTitle || cert.title || 'Certificate';
  const filename = `${recipient}_${title}`.replace(/\s+/g, '_');
  return exportCertificateAsImage(cert, filename, format, { elementId });
}

/**
 * Dedicated Share function: Opens native Android Share sheet or Web Share dialog.
 */
export async function shareCertificate(
  target: HTMLElement | string | Partial<CertificateRecord>,
  title = 'Student Certificate',
  recipientName = 'Student',
  format: 'pdf' | 'png' = 'png',
  elementId?: string
): Promise<boolean> {
  try {
    const safeBase = `Certificate_${recipientName.replace(/\s+/g, '_')}`;

    if (format === 'pdf') {
      const canvas = await renderCertificateToCanvas(target, undefined, elementId);
      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
      const safeFilename = `${safeBase}.pdf`;
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      if (Capacitor.isNativePlatform()) {
        const savedFile = await Filesystem.writeFile({
          path: safeFilename,
          data: pdfBase64,
          directory: Directory.Cache
        });

        await Share.share({
          title: `${title} - ${recipientName}`,
          text: `🎓 شهادة تقدير للطالب: ${recipientName} (${title})`,
          url: savedFile.uri,
          dialogTitle: 'مشاركة شهادة PDF'
        });
        return true;
      }

      // Web fallback: Try Web Share API first
      if (typeof navigator !== 'undefined' && navigator.share && typeof navigator.canShare === 'function') {
        try {
          const blob = pdf.output('blob');
          const file = new File([blob], safeFilename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${title} - ${recipientName}`,
              text: `🎓 شهادة تقدير للطالب: ${recipientName} (${title})`,
              files: [file]
            });
            return true;
          }
        } catch (shareErr: any) {
          // If user cancelled, treat as successful completion without error
          if (
            shareErr?.name === 'AbortError' ||
            shareErr?.message?.includes('cancel') ||
            shareErr?.message?.includes('canceled') ||
            shareErr?.message?.includes('cancelled') ||
            shareErr?.code === 20
          ) {
            return true;
          }
          // If browser revoked user gesture due to async rendering delay, fall through to download
          console.warn('Web share gesture expired or unsupported, downloading file instead:', shareErr);
        }
      }

      // Fallback: Download file directly
      triggerWebDownload(pdf.output('blob'), safeFilename);
      return true;
    } else {
      const canvas = await renderCertificateToCanvas(target, undefined, elementId);
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      const safeFilename = `${safeBase}.png`;
      const base64Data = dataUrl.split(',')[1];

      if (Capacitor.isNativePlatform()) {
        const savedFile = await Filesystem.writeFile({
          path: safeFilename,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: `${title} - ${recipientName}`,
          text: `🎓 شهادة تقدير للطالب: ${recipientName} (${title})`,
          url: savedFile.uri,
          dialogTitle: 'مشاركة صورة الشهادة'
        });
        return true;
      }

      // Web fallback: Try Web Share API first
      if (typeof navigator !== 'undefined' && navigator.share && typeof navigator.canShare === 'function') {
        try {
          const blob = dataUrlToBlob(dataUrl);
          const file = new File([blob], safeFilename, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${title} - ${recipientName}`,
              text: `🎓 شهادة تقدير للطالب: ${recipientName} (${title})`,
              files: [file]
            });
            return true;
          }
        } catch (shareErr: any) {
          if (
            shareErr?.name === 'AbortError' ||
            shareErr?.message?.includes('cancel') ||
            shareErr?.message?.includes('canceled') ||
            shareErr?.message?.includes('cancelled') ||
            shareErr?.code === 20
          ) {
            return true;
          }
          console.warn('Web share gesture expired or unsupported, downloading file instead:', shareErr);
        }
      }

      // Fallback: Download file directly
      triggerWebDownload(dataUrlToBlob(dataUrl), safeFilename);
      return true;
    }
  } catch (error: any) {
    if (error?.message?.includes('canceled') || error?.message?.includes('cancelled') || error?.code === 'CANCELLED') {
      return true;
    }
    console.error('Error sharing certificate:', error);
    return false;
  }
}

/**
 * Sends certificate with image and formatted congratulatory text to WhatsApp
 */
export async function sendCertificateWhatsApp(
  firstArg: string | Partial<CertificateRecord>,
  secondArg?: string,
  thirdArg?: string,
  fourthArg = 'Deutschlehrer'
): Promise<boolean> {
  let recipientName = 'Student';
  let title = 'Certificate';
  let phoneNumber: string | undefined;
  let teacherName = 'Deutschlehrer';
  let certRecord: Partial<CertificateRecord> | undefined;

  if (typeof firstArg === 'string') {
    recipientName = firstArg || 'Student';
    title = secondArg || 'Certificate';
    phoneNumber = thirdArg;
    teacherName = fourthArg || 'Deutschlehrer';
  } else if (firstArg && typeof firstArg === 'object') {
    certRecord = firstArg;
    recipientName = firstArg.recipientName || firstArg.studentName || 'Student';
    title = firstArg.courseOrLevelTitle || firstArg.title || 'Zertifikat';
    teacherName = firstArg.teacherName || firstArg.instructorName || 'Deutschlehrer';
    phoneNumber = secondArg || (firstArg as any).parentPhone || (firstArg as any).studentPhone;
  }

  const isArabic = /[\u0600-\u06FF]/.test(recipientName) || /[\u0600-\u06FF]/.test(title) || certRecord?.language === 'ar';
  
  let message = '';
  if (isArabic) {
    message = `🎓 *تهانينا للطالب/ـة: ${recipientName}* 🎉\n\nنبارك لك حصولك على شهادة التقدير والتميز:\n✨ *"${title}"* ✨\n\nمع أطيب التمنيات بدوام التفوق والنجاح دائماً 👏\nمع تحيات: *أ/ ${teacherName}*`;
  } else if (certRecord?.language === 'en') {
    message = `🎓 *Congratulations ${recipientName}!* 🎉\n\nYou have successfully earned the certificate: *"${title}"* 🌟\n\nBest wishes for continued success,\n*${teacherName}*`;
  } else {
    message = `🎓 *Herzlichen Glückwunsch ${recipientName}!* 🎉\n\nDu hast erfolgreich das Zertifikat *"${title}"* erhalten. 🌟\n\nBeste Grüße und weiterhin viel Erfolg,\n*${teacherName}*`;
  }

  const safeFilename = `Zertifikat_${recipientName.replace(/[/\\?%*:|"<> ]/g, '_')}.png`;

  try {
    // 1. Render certificate to high-res Master A4 canvas
    const target = certRecord || {
      recipientName,
      studentName: recipientName,
      title,
      courseOrLevelTitle: title,
      teacherName,
      instructorName: teacherName
    };
    const canvas = await renderCertificateToCanvas(target);
    const dataUrl = canvas.toDataURL('image/png', 0.95);
    const base64Data = dataUrl.split(',')[1];
    const blob = dataUrlToBlob(dataUrl);

    // 2. Native Mobile Platform (Android / iOS via Capacitor)
    if (Capacitor.isNativePlatform()) {
      const savedFile = await Filesystem.writeFile({
        path: safeFilename,
        data: base64Data,
        directory: Directory.Cache
      });

      await Share.share({
        title: `شهادة ${recipientName}`,
        text: message,
        url: savedFile.uri,
        dialogTitle: 'إرسال الشهادة عبر واتساب'
      });
      return true;
    }

    // 3. Web Share API with File (Mobile Chrome on Android, iOS Safari, etc.)
    if (typeof navigator !== 'undefined' && navigator.share && typeof navigator.canShare === 'function') {
      try {
        const file = new File([blob], safeFilename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `شهادة ${recipientName}`,
            text: message,
            files: [file]
          });
          return true;
        }
      } catch (shareErr: any) {
        if (
          shareErr?.name === 'AbortError' ||
          shareErr?.message?.includes('cancel') ||
          shareErr?.message?.includes('canceled') ||
          shareErr?.message?.includes('cancelled') ||
          shareErr?.code === 20
        ) {
          return true;
        }
        console.warn('Web share gesture timed out or unsupported, continuing to clipboard & download fallback:', shareErr);
      }
    }

    // 4. Desktop Web Browser Fallback:
    // Copy image to clipboard so user can press Ctrl+V directly in WhatsApp Web
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
      }
    } catch (clipErr) {
      console.warn('Could not copy image to clipboard:', clipErr);
    }

    // Trigger download of the image file
    triggerWebDownload(blob, safeFilename);

    // Open WhatsApp Web with the pre-filled message
    const url = buildWhatsAppUrl(phoneNumber, message);
    window.open(url, '_blank');
    return true;
  } catch (err) {
    console.error('Error in sendCertificateWhatsApp:', err);
    // Fallback to text link if rendering fails
    const url = buildWhatsAppUrl(phoneNumber, message);
    window.open(url, '_blank');
    return false;
  }
}

export const shareCertificateWhatsApp = sendCertificateWhatsApp;
