import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Toast } from '@capacitor/toast';
import { LernstudioSet } from '../types/lernstudio';
import { saveToPhoneSubfolderAndRegister } from '../services/downloadedFilesService';
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
  DEFAULT_PAGE_CONTENT_HEIGHT_PX,
  PAGE_CONTENT_WIDTH_PX,
  RUNNING_HEADER_HEIGHT_PX,
  WORKSHEET_BUILD_ID,
  WorksheetBlock,
  buildWorksheetBlocks,
  buildWorksheetHtml,
  getWorksheetCss,
  paginateBlocks,
  renderPaginatedWorksheetHtml
} from './lernstudioWorksheetBuilder';

export interface WorksheetOptions {
  schoolName?: string;
  teacherName?: string;
  gradeName?: string;
  subjectName?: string;
  dateStr?: string;
  includeAnswerKey?: boolean;
  includeVocabularyTable?: boolean;
  includeMatching?: boolean;
  includeMissingLetters?: boolean;
  includeOddOneOut?: boolean;
  includeGrammar?: boolean;
  includePictures?: boolean;
  includeSentenceBuilder?: boolean;
  includeMultipleChoice?: boolean;
  questionsPerExercise?: number;
  variant?: number;
}

export interface WorksheetValidationReport {
  isValid: boolean;
  issues: string[];
  smallestFontSizePx: number;
  pageDimensions: { page: number; scrollHeight: number; clientHeight: number; canvasWidth?: number; canvasHeight?: number }[];
}

export interface WorksheetRenderResult {
  pdf: jsPDF;
  pageDataUrls: string[];
  pageCount: number;
  buildId: string;
  warnings: string[];
  usedFallback: boolean;
  repackCount: number;
  validation: WorksheetValidationReport;
}

async function waitForFontsAndImages(root: HTMLElement): Promise<void> {
  const fontPromise = (async () => {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore font readiness error
      }
    }
  })();

  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  const imagePromise = Promise.all(
    images.map(async (img) => {
      if (img.complete) return;
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        } else {
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 500);
          });
        }
      } catch {
        // ignore image decode error
      }
    })
  );

  // Hard safety limit of 700ms so mobile WebView never freezes waiting on network assets
  await Promise.race([
    Promise.all([fontPromise, imagePromise]),
    new Promise<void>((resolve) => setTimeout(resolve, 700))
  ]);

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 40));
}

export function validateRenderedPages(
  pages: HTMLElement[],
  canvases: HTMLCanvasElement[] = []
): WorksheetValidationReport {
  const issues: string[] = [];
  let smallestFontSizePx = 999;
  const pageDimensions: WorksheetValidationReport['pageDimensions'] = [];

  if (pages.length === 0) {
    issues.push('No pages were rendered (0 pages).');
  }

  const targetRatio = 210 / 297;

  pages.forEach((pageEl, idx) => {
    const pageNum = idx + 1;
    const scrollH = pageEl.scrollHeight;
    const clientH = pageEl.clientHeight;
    const canvas = canvases[idx];

    pageDimensions.push({
      page: pageNum,
      scrollHeight: scrollH,
      clientHeight: clientH,
      canvasWidth: canvas?.width,
      canvasHeight: canvas?.height
    });

    // 6px tolerance accommodates fractional subpixel layout variations on mobile WebViews
    if (scrollH > clientH + 6) {
      issues.push(`Page ${pageNum} overflows vertically (scrollHeight=${scrollH}px > clientHeight=${clientH}px).`);
    }

    const contentEl = pageEl.querySelector<HTMLElement>('.page-content');
    if (contentEl && contentEl.scrollHeight > contentEl.clientHeight + 6) {
      issues.push(
        `Page ${pageNum} content area overflows (scrollHeight=${contentEl.scrollHeight}px > clientHeight=${contentEl.clientHeight}px).`
      );
    }

    const blocksInPage = pageEl.querySelectorAll<HTMLElement>('.ws-block');
    if (blocksInPage.length === 0) {
      issues.push(`Page ${pageNum} is empty (contains 0 blocks).`);
    }

    blocksInPage.forEach((blk) => {
      if (blk.clientHeight > 0 && blk.scrollHeight > blk.clientHeight + 4) {
        const blkId = blk.getAttribute('data-block-id') || 'unknown';
        issues.push(`Block "${blkId}" on page ${pageNum} is clipped (${blk.scrollHeight}px > ${blk.clientHeight}px).`);
      }
    });

    if (canvas) {
      const actualRatio = canvas.width / Math.max(1, canvas.height);
      const ratioDiff = Math.abs(actualRatio - targetRatio) / targetRatio;
      if (ratioDiff > 0.005) {
        issues.push(
          `Page ${pageNum} canvas aspect ratio (${canvas.width}x${canvas.height}) deviates from A4 by ${(ratioDiff * 100).toFixed(2)}%.`
        );
      }
    }

    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const allEls = pageEl.querySelectorAll<HTMLElement>('*');
      allEls.forEach((el) => {
        if (el.textContent && el.textContent.trim().length > 0) {
          const fs = parseFloat(window.getComputedStyle(el).fontSize || '13');
          if (!isNaN(fs) && fs > 0 && fs < smallestFontSizePx) {
            smallestFontSizePx = fs;
          }
        }
      });
    }
  });

  if (smallestFontSizePx === 999) {
    smallestFontSizePx = 12;
  }

  if (smallestFontSizePx < 12) {
    issues.push(`Smallest computed font-size (${smallestFontSizePx}px) is below the 12px minimum.`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    smallestFontSizePx,
    pageDimensions
  };
}

async function renderFallbackSlicedWorksheet(
  set: LernstudioSet,
  options: WorksheetOptions
): Promise<{ pdf: jsPDF; pageDataUrls: string[]; pageCount: number }> {
  const { data, blocks } = buildWorksheetBlocks(set, options);

  const container = document.createElement('div');
  container.className = 'ws-root';
  container.dir = 'ltr';
  container.style.direction = 'ltr';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '-9999';
  container.style.pointerEvents = 'none';
  container.style.width = `${A4_PAGE_WIDTH_PX}px`;
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#111827';
  container.style.padding = `28px 36px`;
  container.style.boxSizing = 'border-box';

  container.innerHTML = `<style>${getWorksheetCss()}</style>` + blocks.map((b) => b.html).join('\n');
  document.body.appendChild(container);

  try {
    await waitForFontsAndImages(container);

    const blockEls = Array.from(container.querySelectorAll<HTMLElement>('.ws-block'));
    const containerTop = container.getBoundingClientRect().top;
    const blockBounds = blockEls.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: Math.max(0, r.top - containerTop),
        bottom: Math.max(0, r.bottom - containerTop)
      };
    });

    const isMobile = Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.innerWidth < 768);
    const scale = isMobile ? 1.5 : 2;
    const fullCanvas = await html2canvas(container, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      width: A4_PAGE_WIDTH_PX,
      windowWidth: A4_PAGE_WIDTH_PX,
      onclone: (clonedDoc) => {
        clonedDoc.documentElement.setAttribute('dir', 'ltr');
        clonedDoc.documentElement.style.direction = 'ltr';
        clonedDoc.body.setAttribute('dir', 'ltr');
        clonedDoc.body.style.direction = 'ltr';
        clonedDoc.body.style.margin = '0';
        clonedDoc.body.style.padding = '0';
      }
    });

    const targetPageCanvasWidth = A4_PAGE_WIDTH_PX * scale;
    const targetPageCanvasHeight = A4_PAGE_HEIGHT_PX * scale;
    const usableSliceHeightCss = A4_PAGE_HEIGHT_PX - 84;

    const sliceRangesCss: { startY: number; endY: number }[] = [];
    let currentY = 0;
    const totalHeightCss = fullCanvas.height / scale;

    while (currentY < totalHeightCss - 10) {
      const maxEndY = currentY + usableSliceHeightCss;
      if (maxEndY >= totalHeightCss) {
        sliceRangesCss.push({ startY: currentY, endY: totalHeightCss });
        break;
      }

      let cutY = maxEndY;
      for (const b of blockBounds) {
        if (b.top > currentY + 20 && b.bottom > maxEndY && b.top < maxEndY) {
          cutY = b.top - 4;
          break;
        }
      }
      if (cutY <= currentY + 20) {
        cutY = maxEndY;
      }
      sliceRangesCss.push({ startY: currentY, endY: cutY });
      currentY = cutY;
    }

    const totalPages = Math.max(1, sliceRangesCss.length);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageDataUrls: string[] = [];

    sliceRangesCss.forEach((range, idx) => {
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = targetPageCanvasWidth;
      pageCanvas.height = targetPageCanvasHeight;
      const ctx = pageCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetPageCanvasWidth, targetPageCanvasHeight);

      const srcY = Math.floor(range.startY * scale);
      const srcH = Math.min(fullCanvas.height - srcY, Math.floor((range.endY - range.startY) * scale));

      if (srcH > 0) {
        ctx.drawImage(
          fullCanvas,
          0,
          srcY,
          targetPageCanvasWidth,
          srcH,
          0,
          28 * scale,
          targetPageCanvasWidth,
          srcH
        );
      }

      ctx.fillStyle = '#4b5563';
      ctx.font = `bold ${12 * scale}px sans-serif`;
      ctx.fillText(
        `${data.schoolName} • Seite ${idx + 1}/${totalPages} • ${WORKSHEET_BUILD_ID}`,
        36 * scale,
        (A4_PAGE_HEIGHT_PX - 18) * scale
      );

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.98);
      pageDataUrls.push(imgData);
      if (idx > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    });

    return { pdf, pageDataUrls, pageCount: totalPages };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export async function renderWorksheetWithDiagnostics(
  set: LernstudioSet,
  options: WorksheetOptions = {}
): Promise<WorksheetRenderResult> {
  console.log(`[LernstudioWorksheet] Starting PDF generation • Build ID: ${WORKSHEET_BUILD_ID}`);

  const { data, blocks } = buildWorksheetBlocks(set, options);

  // Step 1: Measure real DOM heights of every atomic block in a 722px LTR container
  const measureContainer = document.createElement('div');
  measureContainer.className = 'ws-root';
  measureContainer.dir = 'ltr';
  measureContainer.style.direction = 'ltr';
  measureContainer.style.position = 'fixed';
  measureContainer.style.left = '0';
  measureContainer.style.top = '0';
  measureContainer.style.zIndex = '-9999';
  measureContainer.style.pointerEvents = 'none';
  measureContainer.style.width = `${PAGE_CONTENT_WIDTH_PX}px`;
  measureContainer.style.backgroundColor = '#ffffff';
  measureContainer.style.color = '#111827';
  measureContainer.style.boxSizing = 'border-box';
  measureContainer.innerHTML =
    `<style>${getWorksheetCss()}</style>` + blocks.map((b) => b.html).join('\n');

  document.body.appendChild(measureContainer);

  let measuredBlocks: WorksheetBlock[] = blocks;
  try {
    await waitForFontsAndImages(measureContainer);

    const domBlockEls = measureContainer.querySelectorAll<HTMLElement>('.ws-block');
    if (domBlockEls.length === blocks.length) {
      measuredBlocks = blocks.map((b, idx) => {
        const el = domBlockEls[idx];
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const marginTop = parseFloat(style.marginTop || '0') || 0;
        const marginBottom = parseFloat(style.marginBottom || '0') || 0;
        const realHeight = Math.ceil(rect.height + marginTop + marginBottom);
        return {
          ...b,
          height: realHeight > 10 ? realHeight : b.height
        };
      });
    }
  } finally {
    if (document.body.contains(measureContainer)) {
      document.body.removeChild(measureContainer);
    }
  }

  // Step 2: Paginate and verify no page overflows (repack up to 5 times with 3% smaller content height)
  const pageContainer = document.createElement('div');
  pageContainer.className = 'ws-root';
  pageContainer.dir = 'ltr';
  pageContainer.style.direction = 'ltr';
  pageContainer.style.position = 'fixed';
  pageContainer.style.left = '0';
  pageContainer.style.top = '0';
  pageContainer.style.zIndex = '-9999';
  pageContainer.style.pointerEvents = 'none';
  pageContainer.style.width = `${A4_PAGE_WIDTH_PX}px`;
  pageContainer.style.backgroundColor = '#ffffff';
  pageContainer.style.color = '#111827';
  pageContainer.style.boxSizing = 'border-box';
  document.body.appendChild(pageContainer);

  let repackCount = 0;
  let currentContentHeight = DEFAULT_PAGE_CONTENT_HEIGHT_PX;
  let paginatedPages = paginateBlocks(measuredBlocks, currentContentHeight, RUNNING_HEADER_HEIGHT_PX);

  try {
    for (let attempt = 0; attempt <= 5; attempt++) {
      paginatedPages = paginateBlocks(measuredBlocks, currentContentHeight, RUNNING_HEADER_HEIGHT_PX);
      const fullHtml = renderPaginatedWorksheetHtml(data, paginatedPages);
      pageContainer.innerHTML = fullHtml;

      await waitForFontsAndImages(pageContainer);

      const pageEls = Array.from(pageContainer.querySelectorAll<HTMLElement>('.page'));
      const hasOverflow = pageEls.some((pEl) => {
        const cEl = pEl.querySelector<HTMLElement>('.page-content');
        return (
          pEl.scrollHeight > pEl.clientHeight + 6 ||
          (cEl ? cEl.scrollHeight > cEl.clientHeight + 6 : false)
        );
      });

      if (!hasOverflow) {
        break;
      }

      if (attempt < 5) {
        repackCount++;
        currentContentHeight = Math.floor(currentContentHeight * 0.97);
      }
    }

    const pageEls = Array.from(pageContainer.querySelectorAll<HTMLElement>('.page'));
    const canvases: HTMLCanvasElement[] = [];
    const isMobile = Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.innerWidth < 768);
    const scale = isMobile ? 1.5 : 2;

    for (let i = 0; i < pageEls.length; i++) {
      const pageEl = pageEls[i];
      const canvas = await html2canvas(pageEl, {
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        width: A4_PAGE_WIDTH_PX,
        height: A4_PAGE_HEIGHT_PX,
        windowWidth: A4_PAGE_WIDTH_PX,
        windowHeight: A4_PAGE_HEIGHT_PX,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.setAttribute('dir', 'ltr');
          clonedDoc.documentElement.style.direction = 'ltr';
          clonedDoc.body.setAttribute('dir', 'ltr');
          clonedDoc.body.style.direction = 'ltr';
          clonedDoc.body.style.margin = '0';
          clonedDoc.body.style.padding = '0';
        }
      });
      canvases.push(canvas);
    }

    const validation = validateRenderedPages(pageEls, canvases);

    if (!validation.isValid) {
      console.error('[LernstudioWorksheet] Validation issues detected:', validation.issues);
    }

    const hasSevereIssue = validation.issues.some(
      (iss) => iss.includes('overflows') || iss.includes('aspect ratio') || iss.includes('empty')
    );

    if (hasSevereIssue) {
      console.warn('[LernstudioWorksheet] Triggering uniform-scaling fallback slicer...');
      const fb = await renderFallbackSlicedWorksheet(set, options);
      return {
        pdf: fb.pdf,
        pageDataUrls: fb.pageDataUrls,
        pageCount: fb.pageCount,
        buildId: WORKSHEET_BUILD_ID,
        warnings: [
          ...validation.issues,
          `تم استخدام وضع التقسيم الاحتياطي المتساوي (Fallback Layout) لضمان عدم مطّ الصفحة.`
        ],
        usedFallback: true,
        repackCount,
        validation
      };
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();
    const pageDataUrls: string[] = [];

    canvases.forEach((canvas, idx) => {
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pageDataUrls.push(imgData);
      if (idx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
    });

    return {
      pdf,
      pageDataUrls,
      pageCount: canvases.length,
      buildId: WORKSHEET_BUILD_ID,
      warnings: validation.issues,
      usedFallback: false,
      repackCount,
      validation
    };
  } finally {
    if (document.body.contains(pageContainer)) {
      document.body.removeChild(pageContainer);
    }
  }
}

export async function generateLernstudioWorksheetPdf(
  set: LernstudioSet,
  options: WorksheetOptions = {}
): Promise<jsPDF> {
  const res = await renderWorksheetWithDiagnostics(set, options);
  return res.pdf;
}

export async function downloadOrSaveLernstudioWorksheet(
  set: LernstudioSet,
  options: WorksheetOptions = {},
  preRendered?: WorksheetRenderResult
): Promise<WorksheetRenderResult> {
  const result = preRendered || (await renderWorksheetWithDiagnostics(set, options));
  const isTeacher = Boolean(options.includeAnswerKey);
  const cleanTitle = (set.title || set.topic || 'Worksheet')
    .replace(/\s*\((Copy|Kopie|نسخة)\)/gi, '')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
  const fileName = `Glueck_Worksheet_${cleanTitle}_${isTeacher ? 'TeacherKey' : 'Student'}_${WORKSHEET_BUILD_ID}.pdf`;
  const dataUri = result.pdf.output('datauristring');

  // Always save to phone internal storage subfolder (Documents/Gluck_Lernstudio/Worksheets) and register in Downloaded Files
  const reg = await saveToPhoneSubfolderAndRegister({
    title: `ورقة عمل: ${set.title || set.topic || 'Worksheet'} (${isTeacher ? 'نموذج المعلم' : 'نسخة الطالب'})`,
    fileName,
    category: 'worksheets',
    actionType: 'download_pdf',
    format: 'pdf',
    base64OrDataUrl: dataUri,
    groupName: options.gradeName || set.grade,
    previewDataUrl: result.pageDataUrls?.[0],
    showNativeToast: true
  });

  if (Capacitor.isNativePlatform()) {
    try {
      if (reg.nativeUri) {
        await Share.share({
          title: fileName,
          text: `ورقة عمل: ${set.title || 'Worksheet'} (${isTeacher ? 'نموذج المعلم' : 'نسخة الطالب'})`,
          url: reg.nativeUri,
          dialogTitle: 'حفظ أو مشاركة أو طباعة ورقة العمل'
        });
      }
    } catch (saveErr) {
      console.error('Failed to share PDF on native platform:', saveErr);
      result.pdf.save(fileName);
    }
  } else {
    result.pdf.save(fileName);
  }

  return result;
}

export async function printLernstudioWorksheetDirectly(
  set: LernstudioSet,
  options: WorksheetOptions = {},
  preRendered?: WorksheetRenderResult
): Promise<void> {
  console.log(`[LernstudioWorksheet] Direct Print • Build ID: ${WORKSHEET_BUILD_ID}`);

  if (Capacitor.isNativePlatform()) {
    try {
      try {
        await Toast.show({
          text: `جاري تجهيز ورقة العمل للطباعة... (${WORKSHEET_BUILD_ID})`,
          duration: 'short'
        });
      } catch {
        // ignore toast error
      }

      await downloadOrSaveLernstudioWorksheet(set, options, preRendered);
    } catch (err) {
      console.error('Direct print failed on native platform:', err);
    }
    return;
  }

  // Desktop / Web browser iframe print
  const fullHtml = buildWorksheetHtml(set, options);
  const isTeacher = Boolean(options.includeAnswerKey);
  const cleanTitle = (set.title || set.topic || 'Worksheet')
    .replace(/\s*\((Copy|Kopie|نسخة)\)/gi, '')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');

  await saveToPhoneSubfolderAndRegister({
    title: `طباعة ورقة عمل: ${set.title || set.topic || 'Worksheet'} (${isTeacher ? 'نموذج المعلم' : 'نسخة الطالب'})`,
    fileName: `Glueck_Worksheet_${cleanTitle}_${isTeacher ? 'TeacherKey' : 'Student'}.html`,
    category: 'worksheets',
    actionType: 'print',
    format: 'html',
    textContent: fullHtml,
    groupName: options.gradeName || set.grade
  });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc && iframe.contentWindow) {
    doc.open();
    doc.write(fullHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // Fallback if iframe print fails
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    }, 450);
  }
}
