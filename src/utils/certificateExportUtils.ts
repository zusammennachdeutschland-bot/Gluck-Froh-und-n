import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { CertificateRecord } from '../types';
import { CertificateRenderer } from '../components/certificates/templates/CertificateRenderer';
import { buildWhatsAppUrl } from './phoneUtils';

export interface ExportCertificateOptions {
  filename?: string;
  format?: 'png' | 'jpeg' | 'pdf';
  quality?: number;
  scale?: number;
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

  // If the color had 'white' or high lightness, don't default to black
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
 * Sanitizes the cloned DOM document before html2canvas rendering.
 * Strips any dark mode classes from the clone to prevent theme inversion,
 * ensures all fonts and CSS variables are correctly injected,
 * and ensures Arabic shaping and special characters render flawlessly.
 */
function sanitizeClonedDocument(clonedDoc: Document, targetEl?: HTMLElement | null): void {
  // Ensure the cloned document is strictly in light mode so certificates render authentic colors
  clonedDoc.documentElement.classList.remove('dark');
  if (clonedDoc.body) {
    clonedDoc.body.classList.remove('dark');
    clonedDoc.body.style.backgroundColor = '#ffffff';
  }

  // Inject critical Arabic shaping CSS directly into clonedDoc head (relying on preloaded host document fonts)
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

    // Copy stylesheet link elements from host document if missing
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
      // Disable animations and transitions for crisp screenshot
      node.style.animation = 'none';
      node.style.transition = 'none';

      // Sanitize raw inline style attribute if present
      const rawStyle = node.getAttribute('style');
      if (rawStyle && (rawStyle.includes('oklch') || rawStyle.includes('oklab') || rawStyle.includes('color-mix') || rawStyle.includes('color('))) {
        node.setAttribute('style', sanitizeModernCssColors(rawStyle));
      }

      // Sanitize SVG attributes
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
 * Automatically mounts an offscreen DOM container if the target element is hidden or not present.
 * Includes a timeout safeguard and thread yielding to guarantee the browser never freezes.
 */
export async function renderCertificateToCanvas(
  target: HTMLElement | string | Partial<CertificateRecord>,
  scale?: number
): Promise<HTMLCanvasElement> {
  // Yield thread immediately so React UI updates spinner state before CPU work starts
  await new Promise(resolve => setTimeout(resolve, 60));

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Certificate rendering timed out after 12 seconds')), 12000);
  });

  const isNative = Capacitor.isNativePlatform();
  const isMobile = isNative || (typeof window !== 'undefined' && window.innerWidth < 768);
  const chosenScale = scale ? scale : (isMobile ? 1.8 : 2.2);

  const renderPromise = (async () => {
    let elementToCapture: HTMLElement | null = null;
    let tempContainer: HTMLDivElement | null = null;
    let rootToUnmount: ReturnType<typeof createRoot> | null = null;

    try {
      if (typeof target === 'string') {
        elementToCapture = document.getElementById(target);
      } else if (target instanceof HTMLElement) {
        elementToCapture = target;
      }

      const isElementUsable =
        elementToCapture &&
        document.body.contains(elementToCapture) &&
        elementToCapture.offsetWidth > 50 &&
        elementToCapture.offsetHeight > 50 &&
        window.getComputedStyle(elementToCapture).display !== 'none' &&
        window.getComputedStyle(elementToCapture).visibility !== 'hidden';

      if (!isElementUsable) {
        const certData: Partial<CertificateRecord> =
          typeof target === 'object' && !(target instanceof HTMLElement)
            ? target
            : {
                studentName: 'Student',
                recipientName: 'Student',
                title: 'Certificate of Excellence',
                language: 'de' as const,
                template: 'classic' as const
              };

        tempContainer = document.createElement('div');
        tempContainer.id = `temp-cert-export-${Date.now()}`;
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        tempContainer.style.width = '1120px';
        tempContainer.style.zIndex = '-9999';
        tempContainer.style.opacity = '1';
        tempContainer.style.pointerEvents = 'none';
        tempContainer.style.backgroundColor = '#ffffff';

        document.body.appendChild(tempContainer);

        rootToUnmount = createRoot(tempContainer);
        rootToUnmount.render(
          React.createElement(
            'div',
            { className: 'w-[1120px] bg-white p-2' },
            React.createElement(CertificateRenderer, {
              certificate: certData,
              elementId: `inner-render-${Date.now()}`
            })
          )
        );

        await new Promise(resolve => setTimeout(resolve, 150));
        if (document.fonts && document.fonts.ready) {
          try {
            await document.fonts.ready;
          } catch {
            // ignore font load errors
          }
        }

        elementToCapture = (tempContainer.firstElementChild as HTMLElement) || tempContainer;
      }

      // Guarantee all web fonts are fully loaded before html2canvas capture
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // continue if font observer fails
        }
      }
      // Brief layout stabilization frame for accurate canvas text bounds
      await new Promise(resolve => setTimeout(resolve, 80));

      const captureWidth = elementToCapture.offsetWidth || 1120;
      const captureHeight = elementToCapture.offsetHeight || 792;

      const canvas = await html2canvas(elementToCapture, {
        scale: chosenScale,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 6000,
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
        try {
          rootToUnmount.unmount();
        } catch (err) {
          console.warn('Error unmounting offscreen cert root:', err);
        }
      }
      if (tempContainer && document.body.contains(tempContainer)) {
        try {
          document.body.removeChild(tempContainer);
        } catch (err) {
          console.warn('Error removing offscreen cert container:', err);
        }
      }
    }
  })();

  return Promise.race([renderPromise, timeoutPromise]);
}

/**
 * Downloads a certificate as PNG or JPEG image
 */
export async function exportCertificateAsImage(
  target: HTMLElement | string | Partial<CertificateRecord>,
  filename = 'Certificate',
  format: 'png' | 'jpeg' = 'png'
): Promise<boolean> {
  try {
    const canvas = await renderCertificateToCanvas(target);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, 0.98);
    const safeFilename = `${filename.replace(/[/\\?%*:|"<>]/g, '_')}.${format === 'jpeg' ? 'jpg' : 'png'}`;

    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = dataUrl.split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: safeFilename,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: safeFilename,
          url: savedFile.uri,
          dialogTitle: 'Save / Share Certificate Image'
        });
        return true;
      } catch (nativeErr) {
        console.warn('Capacitor native image save warning:', nativeErr);
      }
    }

    // Web Fallback using Blob URL
    const blob = dataUrlToBlob(dataUrl);
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(objectUrl);
    }, 1000);

    return true;
  } catch (error) {
    console.error('Error exporting certificate as image:', error);
    return false;
  }
}

/**
 * Exports a certificate as a high quality vector-embedded PDF (A4 Landscape)
 */
export async function exportCertificateAsPdf(
  target: HTMLElement | string | Partial<CertificateRecord>,
  filename = 'Certificate'
): Promise<boolean> {
  try {
    const canvas = await renderCertificateToCanvas(target);
    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // Landscape A4 dimensions in mm: 297 x 210
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Fit canvas aspect ratio to page
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

    const safeFilename = `${filename.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;

    if (Capacitor.isNativePlatform()) {
      try {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: safeFilename,
          data: pdfBase64,
          directory: Directory.Cache
        });

        await Share.share({
          title: safeFilename,
          url: savedFile.uri,
          dialogTitle: 'Save / Share Certificate PDF'
        });
        return true;
      } catch (nativeErr) {
        console.warn('Capacitor native PDF write notice:', nativeErr);
      }
    }

    // Web fallback using Blob URL
    const pdfBlob = pdf.output('blob');
    const objectUrl = URL.createObjectURL(pdfBlob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(objectUrl);
    }, 1000);

    return true;
  } catch (error) {
    console.error('Error exporting certificate as PDF:', error);
    return false;
  }
}

/**
 * Helper to download PDF for a CertificateRecord
 */
export async function downloadCertificatePDF(
  cert: Partial<CertificateRecord>,
  elementId?: string
): Promise<boolean> {
  const recipient = cert.recipientName || cert.studentName || 'Student';
  const title = cert.title || cert.courseOrLevelTitle || 'Certificate';
  const filename = `${recipient}_${title}`.replace(/\s+/g, '_');
  return exportCertificateAsPdf(elementId ? elementId : cert, filename);
}

/**
 * Helper to download Image for a CertificateRecord
 */
export async function downloadCertificateImage(
  cert: Partial<CertificateRecord>,
  format: 'png' | 'jpeg' = 'png',
  elementId?: string
): Promise<boolean> {
  const recipient = cert.recipientName || cert.studentName || 'Student';
  const title = cert.title || cert.courseOrLevelTitle || 'Certificate';
  const filename = `${recipient}_${title}`.replace(/\s+/g, '_');
  return exportCertificateAsImage(elementId ? elementId : cert, filename, format);
}

/**
 * Shares certificate using Capacitor Share or Web Share API
 */
export async function shareCertificate(
  target: HTMLElement | string | Partial<CertificateRecord>,
  title = 'Student Certificate',
  recipientName = 'Student'
): Promise<boolean> {
  try {
    const canvas = await renderCertificateToCanvas(target, 2);
    const dataUrl = canvas.toDataURL('image/png', 0.95);
    const safeFilename = `Certificate_${recipientName.replace(/\s+/g, '_')}.png`;

    if (Capacitor.isNativePlatform()) {
      const base64Data = dataUrl.split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: safeFilename,
        data: base64Data,
        directory: Directory.Cache
      });

      await Share.share({
        title: `${title} - ${recipientName}`,
        text: `🎓 Congratulations ${recipientName}! Here is your certificate: ${title}`,
        url: savedFile.uri,
        dialogTitle: 'Share Certificate'
      });
      return true;
    }

    // Web fallback
    if (navigator.share && navigator.canShare) {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], safeFilename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${title} - ${recipientName}`,
          text: `🎓 Certificate for ${recipientName}: ${title}`,
          files: [file]
        });
        return true;
      }
    }

    // Fallback: download
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 200);

    return true;
  } catch (error) {
    console.error('Error sharing certificate:', error);
    return false;
  }
}

/**
 * Sends certificate notification to WhatsApp
 * Supports both overloaded signatures:
 * 1. sendCertificateWhatsApp(certObject, phoneNumber)
 * 2. sendCertificateWhatsApp(recipientName, title, phoneNumber, teacherName)
 */
export function sendCertificateWhatsApp(
  firstArg: string | Partial<CertificateRecord>,
  secondArg?: string,
  thirdArg?: string,
  fourthArg = 'Deutschlehrer'
): void {
  let recipientName = 'Student';
  let title = 'Certificate';
  let phoneNumber: string | undefined;
  let teacherName = 'Deutschlehrer';

  if (typeof firstArg === 'string') {
    recipientName = firstArg || 'Student';
    title = secondArg || 'Certificate';
    phoneNumber = thirdArg;
    teacherName = fourthArg || 'Deutschlehrer';
  } else if (firstArg && typeof firstArg === 'object') {
    recipientName = firstArg.recipientName || firstArg.studentName || 'Student';
    title = firstArg.title || firstArg.courseOrLevelTitle || 'Zertifikat';
    teacherName = firstArg.teacherName || firstArg.instructorName || 'Deutschlehrer';
    phoneNumber = secondArg;
  }

  const message = `Herzlichen Glückwunsch ${recipientName}! 🎉\n\nDu hast erfolgreich das Zertifikat "${title}" erhalten.\n\nBeste Grüße,\n${teacherName}`;
  const url = buildWhatsAppUrl(phoneNumber, message);
  window.open(url, '_blank');
}

export const shareCertificateWhatsApp = sendCertificateWhatsApp;

