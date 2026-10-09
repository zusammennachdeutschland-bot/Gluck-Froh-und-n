import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SchoolSettings } from '../types';
import { GenerationResult } from '../services/termVisitPlannerService';
import { getEffectiveSchoolLogo, getEffectiveSchoolName, getReportSchoolNameHtml } from './alsunLogoData';

/**
 * Generates an official, printer-friendly HTML element for the Term Visit Plan Report
 */
export function buildTermVisitReportHtmlContainer(
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar'
): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '1050px'; // High resolution for A4 rendering
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, system-ui, -apple-system, sans-serif';
  container.style.direction = isRtl ? 'rtl' : 'ltr';
  container.style.padding = '36px 40px';
  container.style.boxSizing = 'border-box';

  const logoUrl = getEffectiveSchoolLogo(settings);
  const schoolName = getEffectiveSchoolName(settings, isRtl);
  const schoolNameHtml = getReportSchoolNameHtml(settings, { isRtl, tag: 'h1', fontSize: '22px', color: '#1e3a8a' });
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

  // Render HTML structure
  container.innerHTML = `
    <div style="border: 2px solid #1e293b; border-radius: 12px; padding: 24px; background: #ffffff;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          ${logoUrl ? `<img src="${logoUrl}" style="height: 64px; width: auto; object-fit: contain;" />` : ''}
          <div>
            ${schoolNameHtml}
            <h3 style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #475569;">${departmentName}</h3>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${isRtl ? 'خطة الزيارات الصفية للمشرف التربوي' : 'Official Term Classroom Visit Plan'}</p>
          </div>
        </div>
        <div style="text-align: ${isRtl ? 'left' : 'right'}; font-size: 11px; color: #334155;">
          <p style="margin: 0;"><strong>${isRtl ? 'العام الدراسي:' : 'Academic Year:'}</strong> ${academicYear}</p>
          <p style="margin: 3px 0;"><strong>${isRtl ? 'الفصل الدراسي:' : 'Term:'}</strong> ${pSettings.term}</p>
          <p style="margin: 3px 0;"><strong>${isRtl ? 'الفترة:' : 'Period:'}</strong> ${pSettings.startDate} ${isRtl ? 'إلى' : 'to'} ${pSettings.endDate}</p>
          <p style="margin: 3px 0;"><strong>${isRtl ? 'رئيس القسم:' : 'HOD Name:'}</strong> ${hodName}</p>
          <p style="margin: 3px 0; color: #64748b;">${isRtl ? 'تاريخ الإصدار:' : 'Generated Date:'} ${genDate}</p>
        </div>
      </div>

      <!-- Title Bar -->
      <div style="background: linear-gradient(135deg, #1e40af, #2563eb); color: #ffffff; padding: 12px 18px; rounded: 8px; text-align: center; margin-bottom: 20px; border-radius: 8px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">
          ${isRtl ? 'التقرير المعتمد لخطة الزيارات الصفية للمعلمين' : 'Official Term Classroom Visit Plan Report'}
        </h2>
        <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.9;">
          ${isRtl ? 'مقدم لسعادة مدير المدرسة للعلم والتوجيه والإعتماد' : 'Submitted to the School Principal for Review & Approval'}
        </p>
      </div>

      <!-- Summary KPI Bar -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 10px; color: #64748b; font-weight: 700;">${isRtl ? 'إجمالي الزيارات المطلوبة' : 'Total Required'}</div>
          <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 2px;">${totalReq}</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 10px; color: #166534; font-weight: 700;">${isRtl ? 'الزيارات المنفذة فعلياً' : 'Completed Visits'}</div>
          <div style="font-size: 20px; font-weight: 900; color: #15803d; margin-top: 2px;">${completed}</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 10px; color: #1e40af; font-weight: 700;">${isRtl ? 'الزيارات المجدولة' : 'Planned Visits'}</div>
          <div style="font-size: 20px; font-weight: 900; color: #2563eb; margin-top: 2px;">${planned}</div>
        </div>
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 10px; color: #9f1239; font-weight: 700;">${isRtl ? 'غير مجدولة (تعارض)' : 'Unscheduled'}</div>
          <div style="font-size: 20px; font-weight: 900; color: #be123c; margin-top: 2px;">${unscheduled}</div>
        </div>
        <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 10px; color: #854d0e; font-weight: 700;">${isRtl ? 'نسبة التغطية الفعلية' : 'Verified Coverage'}</div>
          <div style="font-size: 20px; font-weight: 900; color: #a16207; margin-top: 2px;">${covPct}%</div>
        </div>
      </div>

      <!-- Schedule Table -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
          📅 ${isRtl ? 'جدول الزيارات الصفية المجدولة والمنفذة خلال الفصل الدراسي' : 'Detailed Chronological Visit Schedule'}
        </h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff; text-align: ${isRtl ? 'right' : 'left'};">
              <th style="padding: 8px; border: 1px solid #334155; width: 12%;">#</th>
              <th style="padding: 8px; border: 1px solid #334155; width: 18%;">${isRtl ? 'التاريخ واليوم' : 'Date & Weekday'}</th>
              <th style="padding: 8px; border: 1px solid #334155; width: 12%;">${isRtl ? 'الحصة والوقت' : 'Period & Time'}</th>
              <th style="padding: 8px; border: 1px solid #334155; width: 28%;">${isRtl ? 'اسم المعلم' : 'Teacher Name'}</th>
              <th style="padding: 8px; border: 1px solid #334155; width: 15%;">${isRtl ? 'الصف / الفصل' : 'Grade / Class'}</th>
              <th style="padding: 8px; border: 1px solid #334155; width: 15%;">${isRtl ? 'حالة الزيارة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            ${plannedVisits.length === 0 ? `
              <tr>
                <td colspan="6" style="padding: 16px; text-align: center; color: #64748b; border: 1px solid #e2e8f0;">
                  ${isRtl ? 'لا توجد زيارات مجدولة لهذا الفصل الدراسي' : 'No planned visits for this term.'}
                </td>
              </tr>
            ` : plannedVisits.map((v, idx) => {
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              let statusTag = '';
              if (v.status === 'completed') {
                statusTag = `<span style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">✓ ${isRtl ? 'منفذة (مكتملة)' : 'Completed'}</span>`;
              } else if (v.status === 'planned') {
                statusTag = `<span style="background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">📅 ${isRtl ? 'مجدولة' : 'Planned'}</span>`;
              } else if (v.status === 'rescheduled') {
                statusTag = `<span style="background: #fef3c7; color: #b45309; border: 1px solid #fde047; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">🔄 ${isRtl ? 'معاد جدولتها' : 'Rescheduled'}</span>`;
              } else if (v.status === 'cancelled') {
                statusTag = `<span style="background: #ffe4e6; color: #be123c; border: 1px solid #fca5a5; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">✕ ${isRtl ? 'ملغاة' : 'Cancelled'}</span>`;
              } else {
                statusTag = `<span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">${v.status}</span>`;
              }

              const dayName = isRtl ? (v.weekdayNameAr || '') : (v.weekdayNameEn || '');
              const timeRange = v.startTime ? `${v.startTime} - ${v.endTime || ''}` : '';

              return `
                <tr style="background: ${bg};">
                  <td style="padding: 7px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center;">${idx + 1}</td>
                  <td style="padding: 7px; border: 1px solid #e2e8f0; font-weight: 700;">${v.date} <span style="color: #64748b; font-weight: 400;">(${dayName})</span></td>
                  <td style="padding: 7px; border: 1px solid #e2e8f0; font-weight: 700;">${isRtl ? 'الحصة' : 'Period'} ${v.periodNumber} ${timeRange ? `<br/><span style="font-size: 9px; color: #64748b;">${timeRange}</span>` : ''}</td>
                  <td style="padding: 7px; border: 1px solid #e2e8f0; font-weight: 800; color: #1e3a8a;">${v.teacherName}</td>
                  <td style="padding: 7px; border: 1px solid #e2e8f0; font-weight: 700;">${v.gradeClass}</td>
                  <td style="padding: 7px; border: 1px solid #e2e8f0; text-align: center;">${statusTag}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Coverage Breakdown per Teacher -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
          📊 ${isRtl ? 'ملخص تغطية الزيارات الصفية حسب المعلمين' : 'Teacher Visit Coverage Summary'}
        </h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; color: #1e293b; text-align: ${isRtl ? 'right' : 'left'};">
              <th style="padding: 7px; border: 1px solid #cbd5e1; width: 35%;">${isRtl ? 'اسم المعلم' : 'Teacher Name'}</th>
              <th style="padding: 7px; border: 1px solid #cbd5e1; width: 25%;">${isRtl ? 'الفصول المخصصة' : 'Assigned Class'}</th>
              <th style="padding: 7px; border: 1px solid #cbd5e1; width: 15%; text-align: center;">${isRtl ? 'المطلوب' : 'Required'}</th>
              <th style="padding: 7px; border: 1px solid #cbd5e1; width: 15%; text-align: center;">${isRtl ? 'المنفذ فعلياً' : 'Completed'}</th>
              <th style="padding: 7px; border: 1px solid #cbd5e1; width: 10%; text-align: center;">${isRtl ? 'نسبة التغطية' : 'Coverage'}</th>
            </tr>
          </thead>
          <tbody>
            ${requirements.length === 0 ? `
              <tr><td colspan="5" style="padding: 12px; text-align: center; color: #64748b;">${isRtl ? 'لا توجد بيانات معلمين' : 'No teacher requirements found'}</td></tr>
            ` : requirements.map((req, idx) => {
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              const cov = req.requiredVisitsCount > 0 ? Math.round((req.completedVisitsCount / req.requiredVisitsCount) * 100) : 100;
              return `
                <tr style="background: ${bg};">
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700;">${req.teacherName}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${req.gradeClass}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${req.requiredVisitsCount}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: ${req.completedVisitsCount > 0 ? '#166534' : '#be123c'};">${req.completedVisitsCount}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: ${cov >= 100 ? '#166534' : '#b45309'};">${cov}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Conflicts / Uncovered Section if any -->
      ${conflicts.length > 0 ? `
        <div style="margin-bottom: 24px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 12px 16px;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 800; color: #be123c;">
            ⚠️ ${isRtl ? 'تنبيه: توجد متطلبات لم يكتمل جدولتها بسبب التعارضات' : 'Unscheduled Requirements & Conflict Notice'}
          </h4>
          <ul style="margin: 0; padding-${isRtl ? 'right' : 'left'}: 20px; font-size: 11px; color: #9f1239;">
            ${conflicts.map(c => `
              <li style="margin-bottom: 4px;">
                <strong>${c.teacherName}</strong> (${c.className}): ${c.reason}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Signatures Footer -->
      <div style="margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 24px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div style="text-align: center; width: 40%;">
          <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 800; color: #1e293b;">${isRtl ? 'إعداد المشرف التربوي (رئيس القسم)' : 'Prepared by Head of Department'}</p>
          <p style="margin: 0 0 24px 0; font-size: 11px; color: #475569; font-weight: 700;">${hodName}</p>
          <div style="border-bottom: 1px solid #94a3b8; width: 180px; margin: 0 auto 6px auto;"></div>
          <p style="margin: 0; font-size: 10px; color: #64748b;">${isRtl ? 'التوقيع والاعتماد' : 'Signature & Date'}</p>
        </div>

        <div style="text-align: center; width: 40%;">
          <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 800; color: #1e293b;">${isRtl ? 'يعتمد مدير المدرسة' : 'Approved by School Principal'}</p>
          <p style="margin: 0 0 24px 0; font-size: 11px; color: #475569; font-weight: 700;"><span style="font-family: 'Cairo', 'Tajawal', sans-serif !important; direction: ${isRtl ? 'rtl' : 'ltr'}; unicode-bidi: isolate; display: inline-block;">${schoolName}</span></p>
          <div style="border-bottom: 1px solid #94a3b8; width: 180px; margin: 0 auto 6px auto;"></div>
          <p style="margin: 0; font-size: 10px; color: #64748b;">${isRtl ? 'التوقيع والخاتم الرسمي' : 'Official Signature & Seal'}</p>
        </div>
      </div>
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
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

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
): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    const pdf = await generateTermVisitPlanPdfInstance(result, settings, isRtl, lang);
    const fileName = `خطة_الزيارات_الصفية_${result.settings.term.replace(/\s+/g, '_')}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: `خطة الزيارات الصفية - ${result.settings.term}`,
        text: `التقرير المعتمد لخطة الزيارات الصفية للمشرف التربوي - مدرسة الألسن للغات`,
        url: (await Filesystem.getUri({ path: fileName, directory: Directory.Cache })).uri
      });
    } else {
      pdf.save(fileName);
    }

    return { success: true, filename: fileName };
  } catch (error: any) {
    console.error('Error downloading Term Visit Plan PDF:', error);
    return { success: false, filename: '', error: error?.message || 'Download failed' };
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
