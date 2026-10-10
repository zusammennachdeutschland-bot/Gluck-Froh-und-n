import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SchoolSettings } from '../types';
import { GenerationResult } from '../services/termVisitPlannerService';
import { getEffectiveSchoolLogo, getEffectiveSchoolName, getReportSchoolNameHtml } from './alsunLogoData';
import { renderContainerToCanvas, prepareClonedDocForHtml2Canvas, saveReportAsOfflineHtml } from './printObservationUtils';

/**
 * Generates an official, printer-friendly HTML element for the Term Visit Plan Report
 * Compact layout: all class data and KPIs shifted tightly upwards without signature footer overflow
 */
export function buildTermVisitReportHtmlContainer(
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar'
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'report-page term-visit-plan-report';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '-99999';
  container.style.opacity = '1';
  container.style.visibility = 'visible';
  container.style.pointerEvents = 'none';
  container.style.width = '1050px'; // High resolution for A4 rendering
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, system-ui, -apple-system, sans-serif';
  container.style.direction = isRtl ? 'rtl' : 'ltr';
  container.style.padding = '14px 18px';
  container.style.boxSizing = 'border-box';

  const logoUrl = getEffectiveSchoolLogo(settings);
  const schoolName = getEffectiveSchoolName(settings, isRtl);
  const schoolNameHtml = getReportSchoolNameHtml(settings, { isRtl, tag: 'h1', fontSize: '16px', color: '#1e3a8a' });
  const departmentName = settings?.departmentName || (isRtl ? 'قسم اللغة الألمانية' : 'German Department');
  const hodName = settings?.hodName || 'Abdelrahman Ghareeb';
  const academicYear = settings?.academicYear || '2025/2026';
  const genDate = new Date().toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const { summary, plannedVisits, requirements, conflicts, settings: pSettings } = result;

  const totalReq = summary.totalRequirements;
  const completed = summary.completedCount;
  const planned = summary.plannedCount;
  const unscheduled = summary.unscheduledCount;
  const covPct = summary.coveragePercentage;

  // Render HTML structure - Compact layout without signature footer
  container.innerHTML = `
    <div style="border: 1.5px solid #1e293b; border-radius: 8px; padding: 12px 14px; background: #ffffff;">
      <!-- Header - Compact -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #2563eb; padding-bottom: 6px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${logoUrl ? `<img src="${logoUrl}" style="height: 42px; width: auto; object-fit: contain;" />` : ''}
          <div>
            ${schoolNameHtml}
            <h3 style="margin: 1px 0 0 0; font-size: 11px; font-weight: 700; color: #475569;">${departmentName}</h3>
            <p style="margin: 1px 0 0 0; font-size: 10px; color: #64748b;">${isRtl ? 'خطة الزيارات الصفية للمشرف التربوي' : 'Official Term Classroom Visit Plan'}</p>
          </div>
        </div>
        <div style="text-align: ${isRtl ? 'left' : 'right'}; font-size: 9.5px; line-height: 1.35; color: #334155;">
          <p style="margin: 0;"><strong>${isRtl ? 'العام الدراسي:' : 'Academic Year:'}</strong> ${academicYear} | <strong>${isRtl ? 'الفصل:' : 'Term:'}</strong> ${pSettings.term}</p>
          <p style="margin: 1px 0;"><strong>${isRtl ? 'الفترة:' : 'Period:'}</strong> ${pSettings.startDate} ${isRtl ? 'إلى' : 'to'} ${pSettings.endDate}</p>
          <p style="margin: 1px 0;"><strong>${isRtl ? 'رئيس القسم:' : 'HOD:'}</strong> ${hodName} | <span style="color: #64748b;">${genDate}</span></p>
        </div>
      </div>

      <!-- Title Bar - Compact -->
      <div style="background: linear-gradient(135deg, #1e40af, #2563eb); color: #ffffff; padding: 6px 12px; text-align: center; margin-bottom: 8px; border-radius: 6px;">
        <h2 style="margin: 0; font-size: 13px; font-weight: 900; letter-spacing: 0.3px;">
          ${isRtl ? 'التقرير المعتمد لخطة الزيارات الصفية للمعلمين' : 'Official Term Classroom Visit Plan Report'}
        </h2>
      </div>

      <!-- Summary KPI Bar - Compact -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 6px; text-align: center;">
          <div style="font-size: 9px; color: #64748b; font-weight: 700;">${isRtl ? 'الزيارات المطلوبة' : 'Total Required'}</div>
          <div style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 1px;">${totalReq}</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 5px 6px; text-align: center;">
          <div style="font-size: 9px; color: #166534; font-weight: 700;">${isRtl ? 'المنفذة فعلياً' : 'Completed'}</div>
          <div style="font-size: 14px; font-weight: 900; color: #15803d; margin-top: 1px;">${completed}</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px 6px; text-align: center;">
          <div style="font-size: 9px; color: #1e40af; font-weight: 700;">${isRtl ? 'المجدولة' : 'Planned'}</div>
          <div style="font-size: 14px; font-weight: 900; color: #2563eb; margin-top: 1px;">${planned}</div>
        </div>
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 5px 6px; text-align: center;">
          <div style="font-size: 9px; color: #9f1239; font-weight: 700;">${isRtl ? 'غير مجدولة' : 'Unscheduled'}</div>
          <div style="font-size: 14px; font-weight: 900; color: #be123c; margin-top: 1px;">${unscheduled}</div>
        </div>
        <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 5px 6px; text-align: center;">
          <div style="font-size: 9px; color: #854d0e; font-weight: 700;">${isRtl ? 'نسبة التغطية' : 'Coverage'}</div>
          <div style="font-size: 14px; font-weight: 900; color: #a16207; margin-top: 1px;">${covPct}%</div>
        </div>
      </div>

      <!-- Schedule Table - Shifted Upwards & Compact -->
      <div style="margin-bottom: 8px;">
        <h3 style="margin: 0 0 4px 0; font-size: 11px; font-weight: 800; color: #1e293b; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 3px;">
          📅 ${isRtl ? 'جدول الزيارات الصفية المجدولة والمنفذة خلال الفصل الدراسي' : 'Detailed Chronological Visit Schedule'}
        </h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff; text-align: ${isRtl ? 'right' : 'left'};">
              <th style="padding: 4px 5px; border: 1px solid #334155; width: 6%; text-align: center;">#</th>
              <th style="padding: 4px 5px; border: 1px solid #334155; width: 20%;">${isRtl ? 'التاريخ واليوم' : 'Date & Weekday'}</th>
              <th style="padding: 4px 5px; border: 1px solid #334155; width: 14%; text-align: center;">${isRtl ? 'الحصة' : 'Period'}</th>
              <th style="padding: 4px 5px; border: 1px solid #334155; width: 28%;">${isRtl ? 'اسم المعلم' : 'Teacher Name'}</th>
              <th style="padding: 4px 5px; border: 1px solid #334155; width: 16%; text-align: center;">${isRtl ? 'الصف / الفصل' : 'Grade / Class'}</th>
              <th style="padding: 4px 5px; border: 1px solid #334155; width: 16%; text-align: center;">${isRtl ? 'حالة الزيارة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            ${plannedVisits.length === 0 ? `
              <tr>
                <td colspan="6" style="padding: 10px; text-align: center; color: #64748b; border: 1px solid #e2e8f0;">
                  ${isRtl ? 'لا توجد زيارات مجدولة لهذا الفصل الدراسي' : 'No planned visits for this term.'}
                </td>
              </tr>
            ` : plannedVisits.map((v, idx) => {
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              let statusTag = '';
              if (v.status === 'completed') {
                statusTag = `<span style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8.5px;">✓ ${isRtl ? 'منفذة' : 'Completed'}</span>`;
              } else if (v.status === 'planned') {
                statusTag = `<span style="background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8.5px;">📅 ${isRtl ? 'مجدولة' : 'Planned'}</span>`;
              } else if (v.status === 'rescheduled') {
                statusTag = `<span style="background: #fef3c7; color: #b45309; border: 1px solid #fde047; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8.5px;">🔄 ${isRtl ? 'معاد جدولتها' : 'Rescheduled'}</span>`;
              } else if (v.status === 'cancelled') {
                statusTag = `<span style="background: #ffe4e6; color: #be123c; border: 1px solid #fca5a5; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8.5px;">✕ ${isRtl ? 'ملغاة' : 'Cancelled'}</span>`;
              } else {
                statusTag = `<span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8.5px;">${v.status}</span>`;
              }

              const dayName = isRtl ? (v.weekdayNameAr || '') : (v.weekdayNameEn || '');
              const timeRange = v.startTime ? `${v.startTime} - ${v.endTime || ''}` : '';

              return `
                <tr style="background: ${bg};">
                  <td style="padding: 3.5px 5px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center;">${idx + 1}</td>
                  <td style="padding: 3.5px 5px; border: 1px solid #e2e8f0; font-weight: 700;">${v.date} <span style="color: #64748b; font-weight: 400; font-size: 8.5px;">(${dayName})</span></td>
                  <td style="padding: 3.5px 5px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center;">${isRtl ? 'ح' : 'P'}${v.periodNumber} ${timeRange ? `<span style="font-size: 8px; color: #64748b;">(${timeRange})</span>` : ''}</td>
                  <td style="padding: 3.5px 5px; border: 1px solid #e2e8f0; font-weight: 800; color: #1e3a8a;">${v.teacherName}</td>
                  <td style="padding: 3.5px 5px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center;">${v.gradeClass}</td>
                  <td style="padding: 3.5px 5px; border: 1px solid #e2e8f0; text-align: center;">${statusTag}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Coverage Breakdown per Teacher - Compact -->
      <div style="margin-bottom: 6px;">
        <h3 style="margin: 0 0 4px 0; font-size: 11px; font-weight: 800; color: #1e293b; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 3px;">
          📊 ${isRtl ? 'ملخص تغطية الزيارات الصفية حسب المعلمين والفصول' : 'Teacher & Class Coverage Summary'}
        </h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
          <thead>
            <tr style="background: #f1f5f9; color: #1e293b; text-align: ${isRtl ? 'right' : 'left'};">
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 34%;">${isRtl ? 'اسم المعلم' : 'Teacher Name'}</th>
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 26%;">${isRtl ? 'الفصول المخصصة' : 'Assigned Class'}</th>
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 14%; text-align: center;">${isRtl ? 'المطلوب' : 'Required'}</th>
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 14%; text-align: center;">${isRtl ? 'المنفذ' : 'Done'}</th>
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 12%; text-align: center;">${isRtl ? 'التغطية' : 'Coverage'}</th>
            </tr>
          </thead>
          <tbody>
            ${requirements.length === 0 ? `
              <tr><td colspan="5" style="padding: 8px; text-align: center; color: #64748b;">${isRtl ? 'لا توجد بيانات معلمين' : 'No teacher requirements found'}</td></tr>
            ` : requirements.map((req, idx) => {
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              const cov = req.requiredVisitsCount > 0 ? Math.round((req.completedVisitsCount / req.requiredVisitsCount) * 100) : 100;
              return `
                <tr style="background: ${bg};">
                  <td style="padding: 3px 5px; border: 1px solid #e2e8f0; font-weight: 700;">${req.teacherName}</td>
                  <td style="padding: 3px 5px; border: 1px solid #e2e8f0;">${req.gradeClass}</td>
                  <td style="padding: 3px 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${req.requiredVisitsCount}</td>
                  <td style="padding: 3px 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: ${req.completedVisitsCount > 0 ? '#166534' : '#be123c'};">${req.completedVisitsCount}</td>
                  <td style="padding: 3px 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: ${cov >= 100 ? '#166534' : '#b45309'};">${cov}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Conflicts / Uncovered Section if any -->
      ${conflicts.length > 0 ? `
        <div style="margin-top: 6px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 6px 10px;">
          <h4 style="margin: 0 0 3px 0; font-size: 10.5px; font-weight: 800; color: #be123c;">
            ⚠️ ${isRtl ? 'تنبيه: متطلبات لم تكتمل بسبب التعارضات' : 'Unscheduled Notice'}
          </h4>
          <ul style="margin: 0; padding-${isRtl ? 'right' : 'left'}: 16px; font-size: 9px; color: #9f1239;">
            ${conflicts.map(c => `
              <li style="margin-bottom: 2px;">
                <strong>${c.teacherName}</strong> (${c.className}): ${c.reason}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;

  return container;
}

/**
 * Generates jsPDF Instance for the Term Visit Report
 */
export async function generateTermVisitPlanPdfInstance(
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar'
): Promise<jsPDF> {
  const container = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang);
  document.body.appendChild(container);

  try {
    // Wait briefly for layout & fonts to settle
    await new Promise(resolve => setTimeout(resolve, 80));

    const totalHeight = Math.max(1200, container.scrollHeight || 1200);
    const canvas = await renderContainerToCanvas(container, { width: 1050, height: totalHeight });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (imgHeight <= pdfHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight, undefined, 'FAST');
    } else {
      // Multipage PDF rendering
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }
    }

    return pdf;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Downloads official PDF for School Principal
 */
export async function downloadTermVisitPlanPdf(
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar'
): Promise<{ success: boolean; filename: string; method?: string; error?: string }> {
  const fileName = `خطة_الزيارات_الصفية_${result.settings.term.replace(/\s+/g, '_')}.pdf`;
  const htmlFileName = `خطة_الزيارات_الصفية_${result.settings.term.replace(/\s+/g, '_')}.html`;

  try {
    const pdf = await generateTermVisitPlanPdfInstance(result, settings, isRtl, lang);
    const blob = pdf.output('blob');

    // 1. Native Capacitor platform support
    if (Capacitor.isNativePlatform()) {
      try {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache
        });
        await Share.share({
          title: `خطة الزيارات الصفية - ${result.settings.term}`,
          text: `التقرير المعتمد لخطة الزيارات الصفية للمشرف التربوي`,
          url: savedFile.uri
        });
        return { success: true, filename: fileName, method: 'native' };
      } catch (nativeErr) {
        console.warn('Native Capacitor share failed, falling back to browser download:', nativeErr);
      }
    }

    // 2. Browser anchor download
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // 3. Built-in jsPDF file save backup
    try {
      pdf.save(fileName);
    } catch (_) {}

    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 4000);

    return { success: true, filename: fileName, method: 'pdf' };
  } catch (pdfErr) {
    console.warn('PDF generation for term visit plan error, falling back to offline HTML:', pdfErr);
  }

  try {
    const container = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang);
    saveReportAsOfflineHtml(container.outerHTML, htmlFileName);
    return { success: true, filename: htmlFileName, method: 'html' };
  } catch (htmlErr: any) {
    return { success: false, filename: '', error: htmlErr?.message || 'Save failed' };
  }
}

/**
 * Saves the Term Visit Plan directly into Phone Storage / Device Files
 */
export async function saveTermVisitPlanToPhoneStorage(
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar'
): Promise<{ success: boolean; filename: string; method?: string; error?: string }> {
  const fileName = `تقرير_خطة_الزيارات_${result.settings.term.replace(/\s+/g, '_')}.pdf`;
  const htmlFileName = `تقرير_خطة_الزيارات_${result.settings.term.replace(/\s+/g, '_')}.html`;

  try {
    const pdf = await generateTermVisitPlanPdfInstance(result, settings, isRtl, lang);
    const blob = pdf.output('blob');
    const pdfBase64 = pdf.output('datauristring').split(',')[1];

    // 1. Capacitor Native Storage
    if (Capacitor.isNativePlatform()) {
      try {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Documents
        });
        await Share.share({
          title: `خطة الزيارات الصفية - ${result.settings.term}`,
          text: `تم حفظ تقرير خطة الزيارات بنجاح في ملفات الهاتف`,
          url: savedFile.uri
        });
        return { success: true, filename: fileName, method: 'native-documents' };
      } catch {
        const cachedFile = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache
        });
        await Share.share({
          title: `خطة الزيارات الصفية - ${result.settings.term}`,
          url: cachedFile.uri
        });
        return { success: true, filename: fileName, method: 'native-cache' };
      }
    }

    // 2. Web Share API with File
    const pdfFile = new File([blob], fileName, { type: 'application/pdf' });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `تقرير خطة الزيارات - ${result.settings.term}`,
          text: `تقرير خطة الزيارات الصفية للمشرف التربوي`
        });
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return { success: true, filename: fileName, method: 'share-aborted' };
        }
      }
    }

    // 3. Direct Anchor Download to Phone Downloads folder
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // 4. Fallback jsPDF save call
    try {
      pdf.save(fileName);
    } catch (_) {}

    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 4000);

    return { success: true, filename: fileName, method: 'download' };
  } catch (err: any) {
    console.warn('PDF save to phone storage failed, fallback to offline HTML:', err);
    try {
      const container = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang);
      saveReportAsOfflineHtml(container.outerHTML, htmlFileName);
      return { success: true, filename: htmlFileName, method: 'html-download' };
    } catch (htmlErr: any) {
      return { success: false, filename: '', error: htmlErr?.message || 'Save failed' };
    }
  }
}

/**
 * Trigger Browser Print dialog for Term Visit Plan
 */
export async function printTermVisitPlanReport(
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar'
): Promise<void> {
  const container = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang);
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '100vw';
  container.style.zIndex = '999999';
  container.style.backgroundColor = '#ffffff';

  document.body.appendChild(container);
  window.print();

  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 1000);
}
