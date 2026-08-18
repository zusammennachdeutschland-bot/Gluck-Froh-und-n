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

// Canvas helper for standard color conversion (oklab/oklch -> rgb/rgba/hex)
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
 * Converts any modern CSS color string (oklab, oklch, color-mix, etc.) into standard rgb/rgba/hex string.
 */
export function convertColorToStandard(colorStr: string): string {
  if (!colorStr) return colorStr;
  const ctx = getColorHelperCtx();
  if (!ctx) return colorStr;

  try {
    ctx.fillStyle = '#000000';
    ctx.fillStyle = colorStr;
    const res = ctx.fillStyle;
    return res || colorStr;
  } catch {
    return '#000000';
  }
}

/**
 * Replaces all occurrences of oklab(...), oklch(...), and color-mix(...) in a CSS string with standard rgba/hex.
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

  // Replace oklab(...), oklch(...), color-mix(...) functions recursively
  return cssValue.replace(/(?:oklab|oklch|color-mix|color)\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/gi, match => {
    return convertColorToStandard(match);
  });
}

const COLOR_STYLE_KEYS = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'fill',
  'stroke',
  'box-shadow',
  'text-shadow',
  'background-image',
  'background'
];

/**
 * Sanitizes all elements in a cloned DOM tree by converting any modern color functions to standard rgb/rgba/hex.
 */
function sanitizeClonedDomTree(clonedRoot: Element | Document): void {
  const rootEl = clonedRoot instanceof Document ? clonedRoot.body : clonedRoot;
  if (!rootEl) return;

  const allElements = [rootEl, ...Array.from(rootEl.querySelectorAll('*'))];

  for (const node of allElements) {
    if (node instanceof HTMLElement || node instanceof SVGElement) {
      node.style.animation = 'none';
      node.style.transition = 'none';

      // Read computed style safely
      const computed = window.getComputedStyle(node);
      for (const prop of COLOR_STYLE_KEYS) {
        const val = computed.getPropertyValue(prop);
        if (
          val &&
          (val.includes('oklab') ||
            val.includes('oklch') ||
            val.includes('color-mix') ||
            val.includes('color('))
        ) {
          const sanitized = sanitizeModernCssColors(val);
          node.style.setProperty(prop, sanitized, 'important');
        }
      }
    }
  }
}

/**
 * Robust helper to render any certificate (either by DOM element or by certificate data object) to HTMLCanvasElement.
 * If the element is hidden, missing, or offscreen, it mounts an offscreen DOM instance to ensure perfect font and layout rendering.
 */
export async function renderCertificateToCanvas(
  target: HTMLElement | string | Partial<CertificateRecord>,
  scale = 2.5
): Promise<HTMLCanvasElement> {
  let elementToCapture: HTMLElement | null = null;
  let tempContainer: HTMLDivElement | null = null;
  let rootToUnmount: ReturnType<typeof createRoot> | null = null;

  try {
    if (typeof target === 'string') {
      elementToCapture = document.getElementById(target);
    } else if (target instanceof HTMLElement) {
      elementToCapture = target;
    }

    // Check if element is valid, visible, and has non-zero size
    const isElementUsable =
      elementToCapture &&
      document.body.contains(elementToCapture) &&
      elementToCapture.offsetWidth > 50 &&
      elementToCapture.offsetHeight > 50 &&
      window.getComputedStyle(elementToCapture).display !== 'none' &&
      window.getComputedStyle(elementToCapture).visibility !== 'hidden';

    if (!isElementUsable) {
      // Create an offscreen mount container to render the certificate with guaranteed layout
      const certData =
        typeof target === 'object' && !(target instanceof HTMLElement)
          ? target
          : {
              studentName: 'Student',
              recipientName: 'Student',
              title: 'Certificate of Excellence',
              language: 'de' as const,
              template: 'neutral' as const
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

      // Give React & fonts a moment to layout and paint
      await new Promise(resolve => setTimeout(resolve, 150));
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      elementToCapture = (tempContainer.firstElementChild as HTMLElement) || tempContainer;
    }

    const captureWidth = elementToCapture.offsetWidth || 1120;
    const captureHeight = elementToCapture.offsetHeight || 792;

    const canvas = await html2canvas(elementToCapture, {
      scale: Math.max(scale, 2),
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: captureWidth,
      height: captureHeight,
      onclone: (clonedDoc, clonedElement) => {
        sanitizeClonedDomTree(clonedElement || clonedDoc);
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
    const canvas = await renderCertificateToCanvas(target, 2.5);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, 0.98);

    const safeFilename = `${filename.replace(/[/\\?%*:|"<>]/g, '_')}.${format === 'jpeg' ? 'jpg' : 'png'}`;

    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = dataUrl.split(',')[1];
        await Filesystem.writeFile({
          path: `Certificates/${safeFilename}`,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (nativeErr) {
        console.warn('Capacitor native file write notice:', nativeErr);
      }
    }

    // Trigger browser download
    const link = document.createElement('a');
    link.download = safeFilename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 200);

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
    const canvas = await renderCertificateToCanvas(target, 2.5);
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
        await Filesystem.writeFile({
          path: `Certificates/${safeFilename}`,
          data: pdfBase64,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (nativeErr) {
        console.warn('Capacitor native PDF write notice:', nativeErr);
      }
    }

    pdf.save(safeFilename);
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
  const filename = `${cert.recipientName || cert.studentName || 'Zertifikat'}_${cert.title || 'Certificate'}`;
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
  const filename = `${cert.recipientName || cert.studentName || 'Zertifikat'}_${cert.title || 'Certificate'}`;
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

    // Direct image download fallback if share sheet is not available
    return exportCertificateAsImage(target, safeFilename, 'png');
  } catch (error) {
    console.warn('Share operation cancelled or failed, falling back to download:', error);
    return exportCertificateAsImage(target, `Certificate_${recipientName}`, 'png');
  }
}

/**
 * Opens WhatsApp with a congratulations message and direct copy text
 */
export function shareCertificateWhatsApp(cert: Partial<CertificateRecord>, phone?: string): void {
  const studentName = cert.recipientName || cert.studentName || 'Liebe(r) Schüler(in)';
  const courseTitle = cert.title || cert.courseOrLevelTitle || 'Deutschkurs';
  const message = cert.language === 'ar'
    ? `🎉 ألف مبروك للطلبة/الطالب المتميز: *${studentName}*! 🏆\n\nيسرنا منحك *${cert.title || 'شهادة تقدير وإنجاز'}* تقديرًا لجهودك وتفوقك الرائع.\n\nنتمنى لك دوام التوفيق والنجاح الباهر! ✨🎓`
    : `🎉 Herzlichen Glückwunsch an *${studentName}*! 🏆\n\nWir freuen uns, Ihnen das *${courseTitle}* für hervorragende Leistungen und Fleiß zu verleihen.\n\nWeiterhin viel Erfolg und Freude beim Deutschlernen! ✨🎓`;

  if (phone) {
    const url = buildWhatsAppUrl(phone, message);
    window.open(url, '_blank');
  } else {
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }
}
