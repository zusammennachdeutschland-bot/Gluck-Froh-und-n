import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SchoolSettings } from '../types';
import { GenerationResult } from '../services/termVisitPlannerService';
import { getEffectiveSchoolLogo, getEffectiveSchoolName, getReportSchoolNameHtml } from './alsunLogoData';
import { renderContainerToCanvas, prepareClonedDocForHtml2Canvas, saveReportAsOfflineHtml } from './printObservationUtils';

export interface TermVisitReportExportOptions {
  weekFilter?: string; // 'all' or specific week key like 'الأسبوع 41'
  exportLayout?: 'standard' | 'weekly_2per_page' | 'weekly_4per_page' | 'single_week';
  weekDateRange?: string;
  customTitle?: string;
}

export interface WeekItemData {
  weekKey: string;
  weekNum: number;
  visits: any[];
  dateRangeStr: string;
}

/**
 * Extracts a numeric week number from a week filter string like 'الأسبوع 41', 'Week 41', '41'
 */
export function parseWeekNumFromKey(weekKey: string): number | null {
  if (!weekKey) return null;
  const match = weekKey.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export function extractWeeksFromVisits(
  visits: any[], 
  isRtl: boolean = true,
  termStartDate?: string,
  termEndDate?: string
): WeekItemData[] {
  const map = new Map<number, { weekNum: number; visits: any[]; dates: string[] }>();
  
  // 1. Populate map from term range if provided so all calendar weeks exist
  if (termStartDate && termEndDate) {
    const start = new Date(termStartDate);
    const end = new Date(termEndDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const curr = new Date(start);
      // Align curr to Sunday
      curr.setDate(curr.getDate() - curr.getDay());
      while (curr <= end) {
        const startOfYear = new Date(curr.getFullYear(), 0, 1);
        const wNum = Math.ceil((((curr.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
        if (!map.has(wNum)) {
          const wEnd = new Date(curr);
          wEnd.setDate(wEnd.getDate() + 6);
          const firstStr = curr.toISOString().split('T')[0];
          const lastStr = wEnd.toISOString().split('T')[0];
          map.set(wNum, { weekNum: wNum, visits: [], dates: [firstStr, lastStr] });
        }
        curr.setDate(curr.getDate() + 7);
      }
    }
  }

  // 2. Add visits
  visits.forEach(v => {
    const d = new Date(v.date);
    if (isNaN(d.getTime())) return;
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((d.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
    if (!map.has(weekNum)) {
      map.set(weekNum, { weekNum, visits: [], dates: [] });
    }
    const item = map.get(weekNum)!;
    item.visits.push(v);
    if (!item.dates.includes(v.date)) {
      item.dates.push(v.date);
    }
  });

  return Array.from(map.values()).sort((a, b) => a.weekNum - b.weekNum).map(w => {
    const sortedDates = [...w.dates].sort();
    const firstDate = sortedDates[0] || '';
    const lastDate = sortedDates[sortedDates.length - 1] || '';
    const weekKey = isRtl ? `الأسبوع ${w.weekNum}` : `Week ${w.weekNum}`;
    const dateRangeStr = firstDate && lastDate && firstDate !== lastDate ? `${firstDate} - ${lastDate}` : firstDate;
    return {
      weekKey,
      weekNum: w.weekNum,
      visits: w.visits,
      dateRangeStr
    };
  });
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Generates an official, printer-friendly HTML element for the Term Visit Plan Report
 * Compact layout: all class data and KPIs shifted tightly upwards without signature footer overflow
 */
export function buildTermVisitReportHtmlContainer(
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar',
  options?: TermVisitReportExportOptions
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

  const isWeeklyScope = Boolean(options?.weekFilter && options.weekFilter !== 'all');
  const targetWeek = options?.weekFilter || '';
  const targetWNum = parseWeekNumFromKey(targetWeek);

  // Filter visits by week if requested
  const visitsToRender = isWeeklyScope
    ? plannedVisits.filter(v => {
        const d = new Date(v.date);
        if (isNaN(d.getTime())) return false;
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const wNum = Math.ceil((((d.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
        const wKeyAr = `الأسبوع ${wNum}`;
        const wKeyEn = `Week ${wNum}`;
        const wKeyDe = `Woche ${wNum}`;
        return targetWeek === wKeyAr || targetWeek === wKeyEn || targetWeek === wKeyDe || (targetWNum !== null && wNum === targetWNum);
      })
    : plannedVisits;

  const totalReq = isWeeklyScope ? visitsToRender.length : summary.totalRequirements;
  const completed = visitsToRender.filter(v => v.status === 'completed').length;
  const planned = visitsToRender.filter(v => v.status === 'planned').length;
  const rescheduled = visitsToRender.filter(v => v.status === 'rescheduled').length;
  const unscheduled = isWeeklyScope ? 0 : summary.unscheduledCount;
  const covPct = totalReq > 0 ? Math.round((completed / totalReq) * 100) : 0;

  // Filter or summarize teachers for this week
  const requirementsToRender = isWeeklyScope
    ? Array.from(new Set(visitsToRender.map(v => v.teacherName))).map(tName => {
        const tVisits = visitsToRender.filter(v => v.teacherName === tName);
        const tDone = tVisits.filter(v => v.status === 'completed').length;
        const classes = Array.from(new Set(tVisits.map(v => v.gradeClass))).join(', ');
        return {
          id: tName,
          teacherId: tVisits[0]?.teacherId || tName,
          teacherName: tName,
          gradeClass: classes,
          requiredVisitsCount: tVisits.length,
          completedVisitsCount: tDone,
          plannedVisitsCount: tVisits.filter(v => v.status === 'planned' || v.status === 'rescheduled').length,
          isSatisfied: tDone >= tVisits.length
        };
      })
    : requirements;

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
          ${isWeeklyScope
            ? (isRtl ? `التقرير المعتمد لخطة الزيارات الصفية - ${targetWeek}` : `Classroom Visit Plan Report - ${targetWeek}`)
            : (isRtl ? 'التقرير المعتمد لخطة الزيارات الصفية للمعلمين' : 'Official Term Classroom Visit Plan Report')
          }
        </h2>
        ${options?.weekDateRange ? `
          <p style="margin: 2px 0 0 0; font-size: 9.5px; opacity: 0.95; font-weight: 700;">
            ${options.weekDateRange}
          </p>
        ` : ''}
      </div>

      <!-- Summary KPI Bar - Compact -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 6px; text-align: center;">
          <div style="font-size: 9px; color: #64748b; font-weight: 700;">${isRtl ? (isWeeklyScope ? 'زيارات الأسبوع' : 'الزيارات المطلوبة') : 'Total Required'}</div>
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
          <div style="font-size: 9px; color: #9f1239; font-weight: 700;">${isRtl ? (isWeeklyScope ? 'معاد جدولتها' : 'غير مجدولة') : (isWeeklyScope ? 'Rescheduled' : 'Unscheduled')}</div>
          <div style="font-size: 14px; font-weight: 900; color: #be123c; margin-top: 1px;">${isWeeklyScope ? rescheduled : unscheduled}</div>
        </div>
        <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 5px 6px; text-align: center;">
          <div style="font-size: 9px; color: #854d0e; font-weight: 700;">${isRtl ? 'نسبة الإنجاز' : 'Coverage'}</div>
          <div style="font-size: 14px; font-weight: 900; color: #a16207; margin-top: 1px;">${covPct}%</div>
        </div>
      </div>

      <!-- Schedule Table - Shifted Upwards & Compact -->
      <div style="margin-bottom: 8px;">
        <h3 style="margin: 0 0 4px 0; font-size: 11px; font-weight: 800; color: #1e293b; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 3px;">
          📅 ${isWeeklyScope 
            ? (isRtl ? `جدول الزيارات الصفية المجدولة خلال ${targetWeek}` : `Classroom Visit Schedule for ${targetWeek}`)
            : (isRtl ? 'جدول الزيارات الصفية المجدولة والمنفذة خلال الفصل الدراسي' : 'Detailed Chronological Visit Schedule')
          }
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
            ${visitsToRender.length === 0 ? `
              <tr>
                <td colspan="6" style="padding: 10px; text-align: center; color: #64748b; border: 1px solid #e2e8f0;">
                  ${isRtl ? `لا توجد زيارات مجدولة في ${targetWeek || 'هذا الفصل'}` : 'No planned visits found.'}
                </td>
              </tr>
            ` : visitsToRender.map((v, idx) => {
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
          📊 ${isWeeklyScope
            ? (isRtl ? `ملخص زيارات المعلمين خلال ${targetWeek}` : `Teacher Visits Summary for ${targetWeek}`)
            : (isRtl ? 'ملخص تغطية الزيارات الصفية حسب المعلمين والفصول' : 'Teacher & Class Coverage Summary')
          }
        </h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
          <thead>
            <tr style="background: #f1f5f9; color: #1e293b; text-align: ${isRtl ? 'right' : 'left'};">
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 34%;">${isRtl ? 'اسم المعلم' : 'Teacher Name'}</th>
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 26%;">${isRtl ? (isWeeklyScope ? 'الفصول المستهدفة' : 'الفصول المخصصة') : 'Assigned Class'}</th>
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 14%; text-align: center;">${isRtl ? 'المطلوب' : 'Required'}</th>
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 14%; text-align: center;">${isRtl ? 'المنفذ' : 'Done'}</th>
              <th style="padding: 4px 5px; border: 1px solid #cbd5e1; width: 12%; text-align: center;">${isRtl ? 'التغطية' : 'Coverage'}</th>
            </tr>
          </thead>
          <tbody>
            ${requirementsToRender.length === 0 ? `
              <tr><td colspan="5" style="padding: 8px; text-align: center; color: #64748b;">${isRtl ? 'لا توجد بيانات معلمين' : 'No teacher requirements found'}</td></tr>
            ` : requirementsToRender.map((req, idx) => {
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
      ${(!isWeeklyScope && conflicts.length > 0) ? `
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
 * Builds HTML container for 2 Weeks per Sheet / Page (Large Readable Layout)
 */
export function build2WeeksSheetHtmlContainer(
  weeksChunk: WeekItemData[],
  chunkIndex: number,
  totalChunks: number,
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar'
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'report-page term-visit-plan-2weeks-sheet';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '-99999';
  container.style.width = '1050px';
  container.style.minHeight = '1480px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, system-ui, -apple-system, sans-serif';
  container.style.direction = isRtl ? 'rtl' : 'ltr';
  container.style.padding = '22px 26px';
  container.style.boxSizing = 'border-box';

  const logoUrl = getEffectiveSchoolLogo(settings);
  const schoolNameHtml = getReportSchoolNameHtml(settings, { isRtl, tag: 'h1', fontSize: '18px', color: '#1e3a8a' });
  const departmentName = settings?.departmentName || (isRtl ? 'قسم اللغة الألمانية' : 'German Department');
  const academicYear = settings?.academicYear || '2025/2026';
  const startWKey = weeksChunk[0]?.weekKey || '';
  const endWKey = weeksChunk[weeksChunk.length - 1]?.weekKey || '';
  const rangeHeader = startWKey === endWKey ? startWKey : `${startWKey} إلى ${endWKey}`;

  const renderWeekBox = (w?: WeekItemData) => {
    if (!w) {
      return `<div style="border: 2px dashed #cbd5e1; border-radius: 12px; background: #fafafa; padding: 20px; min-height: 580px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: 700; font-size: 15px;">${isRtl ? 'لا توجد أسابيع إضافية' : 'No Additional Weeks'}</div>`;
    }

    return `
      <div style="border: 2.5px solid #1e3a8a; border-radius: 14px; background: #ffffff; padding: 12px 14px; box-shadow: 0 3px 8px rgba(0,0,0,0.06); display: flex; flex-direction: column; justify-content: space-between; min-height: 580px;">
        <div>
          <!-- Week Header Bar -->
          <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; padding: 8px 14px; border-radius: 10px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
            <div style="font-size: 17px; font-weight: 900; letter-spacing: 0.3px;">
              📅 ${w.weekKey}
            </div>
            <div style="font-size: 12px; font-weight: 800; opacity: 0.95; background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 6px;">
              ${w.dateRangeStr || ''}
            </div>
          </div>

          <!-- Visits Table with Very Large Readable Font for Teacher & Class -->
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff; text-align: ${isRtl ? 'right' : 'left'}; font-size: 13px;">
                <th style="padding: 7px 8px; border: 1px solid #334155; width: 20%;">${isRtl ? 'اليوم' : 'Day'}</th>
                <th style="padding: 7px 8px; border: 1px solid #334155; width: 44%; font-size: 14px;">${isRtl ? 'إسم المدرس' : 'Teacher Name'}</th>
                <th style="padding: 7px 8px; border: 1px solid #334155; width: 22%; text-align: center; font-size: 14px;">${isRtl ? 'إسم الفصل' : 'Class'}</th>
                <th style="padding: 7px 8px; border: 1px solid #334155; width: 14%; text-align: center;">${isRtl ? 'الحصة' : 'Period'}</th>
              </tr>
            </thead>
            <tbody>
              ${w.visits.length === 0 ? `
                <tr>
                  <td colspan="4" style="padding: 20px; text-align: center; color: #64748b; font-size: 13px; font-weight: 700; border: 1px solid #e2e8f0;">
                    ${isRtl ? 'لا توجد زيارات مجدولة في هذا الأسبوع' : 'No planned visits.'}
                  </td>
                </tr>
              ` : w.visits.map((v, vIdx) => {
                const bg = vIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                const dayName = isRtl ? (v.weekdayNameAr || '') : (v.weekdayNameEn || '');
                return `
                  <tr style="background: ${bg}; border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 8px 8px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 13px; color: #1e293b;">
                      ${dayName}
                      <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">${v.date}</div>
                    </td>
                    <td style="padding: 8px 8px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 16px; color: #1e3a8a;">
                      ${v.teacherName}
                    </td>
                    <td style="padding: 8px 8px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 15px; color: #0f172a; text-align: center; background: #f1f5f9;">
                      ${v.gradeClass}
                    </td>
                    <td style="padding: 8px 8px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 13.5px; text-align: center; color: #2563eb;">
                      ${isRtl ? 'حصة' : 'P.'} ${v.periodNumber}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 11.5px; color: #475569; font-weight: 800; display: flex; justify-content: space-between;">
          <span>${isRtl ? 'إجمالي زيارات الأسبوع:' : 'Total Visits:'} ${w.visits.length}</span>
          <span>${isRtl ? 'خطة أسبوعية معتمدة' : 'Approved Plan'}</span>
        </div>
      </div>
    `;
  };

  container.innerHTML = `
    <div style="border: 2px solid #0f172a; border-radius: 14px; padding: 16px; background: #ffffff; min-height: 1435px; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Top Page Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${logoUrl ? `<img src="${logoUrl}" style="height: 48px; width: auto; object-fit: contain;" />` : ''}
            <div>
              ${schoolNameHtml}
              <h3 style="margin: 2px 0 0 0; font-size: 13px; font-weight: 800; color: #475569;">${departmentName}</h3>
            </div>
          </div>
          <div style="text-align: ${isRtl ? 'left' : 'right'}; font-size: 11px; line-height: 1.4; color: #1e293b; font-weight: 800;">
            <p style="margin: 0;"><strong>${isRtl ? 'الخطة الأسبوعية المعتمدة (أسبوعين في كل ورقة)' : '2 Weeks Per Sheet Plan'}</strong></p>
            <p style="margin: 2px 0;"><strong>${isRtl ? 'العام الدراسي:' : 'Year:'}</strong> ${academicYear} | <strong>${isRtl ? 'الصفحة:' : 'Page:'}</strong> ${chunkIndex + 1} / ${totalChunks}</p>
          </div>
        </div>

        <!-- Banner Title -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; padding: 8px 16px; text-align: center; border-radius: 8px; margin-bottom: 14px;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 900; letter-spacing: 0.3px;">
            ${isRtl ? `جدول خطة الزيارات الصفية الأسبوعية (${rangeHeader})` : `Weekly Visit Schedule (${rangeHeader})`}
          </h2>
        </div>

        <!-- 1-Column Stack for 2 Weeks -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 14px;">
          ${renderWeekBox(weeksChunk[0])}
          ${renderWeekBox(weeksChunk[1])}
        </div>
      </div>

      <!-- Footer Stamp -->
      <div style="border-top: 1.5px solid #cbd5e1; padding-top: 8px; margin-top: 12px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #475569; font-weight: 800;">
        <div>${isRtl ? 'قسم المشرف التربوي - متابعة الفصول والزيارات الصفية' : 'Supervisor Department'}</div>
        <div>${isRtl ? 'تم التنسيق بأسبوعين في ورقة واحدة' : '2 Weeks Per Sheet'}</div>
      </div>
    </div>
  `;

  return container;
}

/**
 * Builds HTML container for 4 Weeks per Sheet / Page
 */
export function build4WeeksSheetHtmlContainer(
  weeksChunk: WeekItemData[],
  chunkIndex: number,
  totalChunks: number,
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar'
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'report-page term-visit-plan-weekly-sheet';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '-99999';
  container.style.width = '1050px';
  container.style.minHeight = '1480px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, system-ui, -apple-system, sans-serif';
  container.style.direction = isRtl ? 'rtl' : 'ltr';
  container.style.padding = '20px 24px';
  container.style.boxSizing = 'border-box';

  const logoUrl = getEffectiveSchoolLogo(settings);
  const schoolNameHtml = getReportSchoolNameHtml(settings, { isRtl, tag: 'h1', fontSize: '18px', color: '#1e3a8a' });
  const departmentName = settings?.departmentName || (isRtl ? 'قسم اللغة الألمانية' : 'German Department');
  const academicYear = settings?.academicYear || '2025/2026';
  const startWKey = weeksChunk[0]?.weekKey || '';
  const endWKey = weeksChunk[weeksChunk.length - 1]?.weekKey || '';
  const rangeHeader = startWKey === endWKey ? startWKey : `${startWKey} إلى ${endWKey}`;

  const renderWeekBox = (w?: WeekItemData) => {
    if (!w) {
      return `<div style="border: 2px dashed #cbd5e1; border-radius: 12px; background: #fafafa; padding: 16px; min-height: 560px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: 700; font-size: 14px;">${isRtl ? 'لا توجد أسابيع إضافية' : 'No Additional Weeks'}</div>`;
    }

    return `
      <div style="border: 2px solid #1e3a8a; border-radius: 12px; background: #ffffff; padding: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; min-height: 560px;">
        <div>
          <!-- Week Header Bar -->
          <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; padding: 6px 10px; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
            <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px;">
              📅 ${w.weekKey}
            </div>
            <div style="font-size: 11px; font-weight: 700; opacity: 0.95; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 5px;">
              ${w.dateRangeStr || ''}
            </div>
          </div>

          <!-- Visits Table with Large Font for Teacher & Class -->
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff; text-align: ${isRtl ? 'right' : 'left'}; font-size: 11.5px;">
                <th style="padding: 5px 6px; border: 1px solid #334155; width: 22%;">${isRtl ? 'اليوم' : 'Day'}</th>
                <th style="padding: 5px 6px; border: 1px solid #334155; width: 42%; font-size: 12.5px;">${isRtl ? 'إسم المدرس' : 'Teacher Name'}</th>
                <th style="padding: 5px 6px; border: 1px solid #334155; width: 22%; text-align: center; font-size: 12.5px;">${isRtl ? 'إسم الفصل' : 'Class'}</th>
                <th style="padding: 5px 6px; border: 1px solid #334155; width: 14%; text-align: center;">${isRtl ? 'الحصة' : 'Period'}</th>
              </tr>
            </thead>
            <tbody>
              ${w.visits.length === 0 ? `
                <tr>
                  <td colspan="4" style="padding: 16px; text-align: center; color: #64748b; font-size: 12px; font-weight: 700; border: 1px solid #e2e8f0;">
                    ${isRtl ? 'لا توجد زيارات مجدولة في هذا الأسبوع' : 'No planned visits.'}
                  </td>
                </tr>
              ` : w.visits.map((v, vIdx) => {
                const bg = vIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                const dayName = isRtl ? (v.weekdayNameAr || '') : (v.weekdayNameEn || '');
                return `
                  <tr style="background: ${bg}; border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 6px 5px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 12px; color: #1e293b;">
                      ${dayName}
                      <div style="font-size: 10px; color: #64748b; font-weight: 600;">${v.date}</div>
                    </td>
                    <td style="padding: 6px 5px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 14px; color: #1e3a8a;">
                      ${v.teacherName}
                    </td>
                    <td style="padding: 6px 5px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 13.5px; color: #0f172a; text-align: center; background: #f1f5f9;">
                      ${v.gradeClass}
                    </td>
                    <td style="padding: 6px 5px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 12px; text-align: center; color: #2563eb;">
                      ${isRtl ? 'حصة' : 'P.'} ${v.periodNumber}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 4px; font-size: 10.5px; color: #64748b; font-weight: 700; display: flex; justify-content: space-between;">
          <span>${isRtl ? 'إجمالي زيارات الأسبوع:' : 'Total Visits:'} ${w.visits.length}</span>
          <span>${isRtl ? 'خطة أسبوعية معتمدة' : 'Approved Plan'}</span>
        </div>
      </div>
    `;
  };

  container.innerHTML = `
    <div style="border: 2px solid #0f172a; border-radius: 12px; padding: 14px; background: #ffffff; min-height: 1440px; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Top Page Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            ${logoUrl ? `<img src="${logoUrl}" style="height: 44px; width: auto; object-fit: contain;" />` : ''}
            <div>
              ${schoolNameHtml}
              <h3 style="margin: 1px 0 0 0; font-size: 12px; font-weight: 800; color: #475569;">${departmentName}</h3>
            </div>
          </div>
          <div style="text-align: ${isRtl ? 'left' : 'right'}; font-size: 10.5px; line-height: 1.35; color: #1e293b; font-weight: 700;">
            <p style="margin: 0;"><strong>${isRtl ? 'الخطة الأسبوعية المعتمدة (4 أسابيع في كل ورقة)' : '4 Weeks Per Sheet Plan'}</strong></p>
            <p style="margin: 1px 0;"><strong>${isRtl ? 'العام الدراسي:' : 'Year:'}</strong> ${academicYear} | <strong>${isRtl ? 'الصفحة:' : 'Page:'}</strong> ${chunkIndex + 1} / ${totalChunks}</p>
          </div>
        </div>

        <!-- Banner Title -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; padding: 6px 14px; text-align: center; border-radius: 6px; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 15px; font-weight: 900; letter-spacing: 0.3px;">
            ${isRtl ? `جدول خطة الزيارات الصفية الأسبوعية (${rangeHeader})` : `Weekly Visit Schedule (${rangeHeader})`}
          </h2>
        </div>

        <!-- 2x2 Grid for the 4 Weeks -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${renderWeekBox(weeksChunk[0])}
          ${renderWeekBox(weeksChunk[1])}
          ${renderWeekBox(weeksChunk[2])}
          ${renderWeekBox(weeksChunk[3])}
        </div>
      </div>

      <!-- Footer Stamp -->
      <div style="border-top: 1.5px solid #cbd5e1; padding-top: 6px; margin-top: 10px; display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #475569; font-weight: 700;">
        <div>${isRtl ? 'قسم المشرف التربوي - متابعة الفصول والزيارات الصفية' : 'Supervisor Department'}</div>
        <div>${isRtl ? 'تم التنسيق بأربعة أسابيع في ورقة واحدة' : '4 Weeks Per Sheet'}</div>
      </div>
    </div>
  `;

  return container;
}

/**
 * Builds HTML container for Single Week Plan with extra large font
 */
export function buildSingleWeekSheetHtmlContainer(
  targetWeekData: WeekItemData,
  result: GenerationResult,
  settings: SchoolSettings,
  isRtl: boolean = true,
  lang: string = 'ar'
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'report-page term-visit-plan-single-week-sheet';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '-99999';
  container.style.width = '1050px';
  container.style.minHeight = '1480px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, system-ui, -apple-system, sans-serif';
  container.style.direction = isRtl ? 'rtl' : 'ltr';
  container.style.padding = '24px 28px';
  container.style.boxSizing = 'border-box';

  const logoUrl = getEffectiveSchoolLogo(settings);
  const schoolNameHtml = getReportSchoolNameHtml(settings, { isRtl, tag: 'h1', fontSize: '20px', color: '#1e3a8a' });
  const departmentName = settings?.departmentName || (isRtl ? 'قسم اللغة الألمانية' : 'German Department');
  const academicYear = settings?.academicYear || '2025/2026';

  container.innerHTML = `
    <div style="border: 2.5px solid #1e3a8a; border-radius: 14px; padding: 20px; background: #ffffff; min-height: 1420px; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Top Page Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${logoUrl ? `<img src="${logoUrl}" style="height: 52px; width: auto; object-fit: contain;" />` : ''}
            <div>
              ${schoolNameHtml}
              <h3 style="margin: 2px 0 0 0; font-size: 14px; font-weight: 800; color: #475569;">${departmentName}</h3>
            </div>
          </div>
          <div style="text-align: ${isRtl ? 'left' : 'right'}; font-size: 12px; line-height: 1.4; color: #1e293b; font-weight: 800;">
            <p style="margin: 0;"><strong>${isRtl ? 'الخطة الأسبوعية المخصصة' : 'Weekly Special Plan'}</strong></p>
            <p style="margin: 2px 0;"><strong>${isRtl ? 'العام الدراسي:' : 'Academic Year:'}</strong> ${academicYear}</p>
          </div>
        </div>

        <!-- Title Banner -->
        <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; padding: 12px 20px; text-align: center; border-radius: 10px; margin-bottom: 18px; box-shadow: 0 4px 10px rgba(37,99,235,0.15);">
          <h2 style="margin: 0; font-size: 21px; font-weight: 900; letter-spacing: 0.5px;">
            📌 ${isRtl ? `جدول خطة الزيارات الصفية - ${targetWeekData.weekKey}` : `Classroom Visit Schedule - ${targetWeekData.weekKey}`}
          </h2>
          <p style="margin: 4px 0 0 0; font-size: 13.5px; font-weight: 800; color: #dbeafe;">
            ${targetWeekData.dateRangeStr || ''} | ${isRtl ? `إجمالي زيارات الأسبوع: ${targetWeekData.visits.length}` : `Total Visits: ${targetWeekData.visits.length}`}
          </p>
        </div>

        <!-- Visits Table Extra Large Font -->
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; text-align: ${isRtl ? 'right' : 'left'}; font-size: 14px;">
              <th style="padding: 10px 12px; border: 1.5px solid #334155; width: 6%; text-align: center;">#</th>
              <th style="padding: 10px 12px; border: 1.5px solid #334155; width: 22%;">${isRtl ? 'اليوم والتاريخ' : 'Day & Date'}</th>
              <th style="padding: 10px 12px; border: 1.5px solid #334155; width: 42%; font-size: 16px;">${isRtl ? 'إسم المدرس (المعلم)' : 'Teacher Name'}</th>
              <th style="padding: 10px 12px; border: 1.5px solid #334155; width: 18%; text-align: center; font-size: 16px;">${isRtl ? 'إسم الفصل' : 'Class Name'}</th>
              <th style="padding: 10px 12px; border: 1.5px solid #334155; width: 12%; text-align: center;">${isRtl ? 'الحصة' : 'Period'}</th>
            </tr>
          </thead>
          <tbody>
            ${targetWeekData.visits.length === 0 ? `
              <tr>
                <td colspan="5" style="padding: 30px; text-align: center; color: #64748b; font-size: 16px; font-weight: 800; border: 1px solid #cbd5e1;">
                  ${isRtl ? 'لا توجد زيارات صفية مجدولة في هذا الأسبوع' : 'No planned visits for this week.'}
                </td>
              </tr>
            ` : targetWeekData.visits.map((v, idx) => {
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              const dayName = isRtl ? (v.weekdayNameAr || '') : (v.weekdayNameEn || '');
              return `
                <tr style="background: ${bg}; border-bottom: 1.5px solid #cbd5e1;">
                  <td style="padding: 12px 10px; border: 1px solid #cbd5e1; font-weight: 800; text-align: center; font-size: 14px;">${idx + 1}</td>
                  <td style="padding: 12px 10px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 14px; color: #0f172a;">
                    ${dayName}
                    <div style="font-size: 12px; color: #64748b; font-weight: 700;">${v.date}</div>
                  </td>
                  <td style="padding: 12px 10px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 18px; color: #1e3a8a;">
                    ${v.teacherName}
                  </td>
                  <td style="padding: 12px 10px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 17px; color: #0f172a; text-align: center; background: #f1f5f9;">
                    ${v.gradeClass}
                  </td>
                  <td style="padding: 12px 10px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 15px; text-align: center; color: #2563eb;">
                    ${isRtl ? 'حصة' : 'P.'} ${v.periodNumber}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="border-top: 2px solid #cbd5e1; padding-top: 10px; margin-top: 20px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #475569; font-weight: 800;">
        <div>${isRtl ? 'التقرير الأسبوعي المعتمد للزيارات الصفية' : 'Approved Weekly Visit Report'}</div>
        <div>${isRtl ? 'المشرف التربوي' : 'Supervisor'}</div>
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
  lang: string = 'ar',
  options?: TermVisitReportExportOptions
): Promise<jsPDF> {
  const is2PerSheet = options?.exportLayout === 'weekly_2per_page';
  const is4PerSheet = options?.exportLayout === 'weekly_4per_page';
  const isSingleWeek = options?.exportLayout === 'single_week' || (Boolean(options?.weekFilter && options.weekFilter !== 'all') && options?.exportLayout !== 'standard');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });
  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

  if (is2PerSheet) {
    const weeksList = extractWeeksFromVisits(result.plannedVisits, isRtl, result.settings.startDate, result.settings.endDate);
    const chunks = chunkArray(weeksList, 2);

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const sheetContainer = build2WeeksSheetHtmlContainer(chunk, idx, chunks.length, result, settings, isRtl, lang);
      document.body.appendChild(sheetContainer);

      try {
        await new Promise(r => setTimeout(r, 80));
        const canvas = await renderContainerToCanvas(sheetContainer, { width: 1050, height: 1485 });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        if (idx > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      } finally {
        if (document.body.contains(sheetContainer)) {
          document.body.removeChild(sheetContainer);
        }
      }
    }
    return pdf;
  }

  if (is4PerSheet) {
    const weeksList = extractWeeksFromVisits(result.plannedVisits, isRtl, result.settings.startDate, result.settings.endDate);
    const chunks = chunkArray(weeksList, 4);

    if (chunks.length === 0) {
      const container = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang, options);
      document.body.appendChild(container);
      try {
        await new Promise(r => setTimeout(r, 80));
        const canvas = await renderContainerToCanvas(container, { width: 1050, height: 1485 });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      } finally {
        if (document.body.contains(container)) document.body.removeChild(container);
      }
      return pdf;
    }

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const sheetContainer = build4WeeksSheetHtmlContainer(chunk, idx, chunks.length, result, settings, isRtl, lang);
      document.body.appendChild(sheetContainer);

      try {
        await new Promise(r => setTimeout(r, 80));
        const canvas = await renderContainerToCanvas(sheetContainer, { width: 1050, height: 1485 });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        if (idx > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      } finally {
        if (document.body.contains(sheetContainer)) {
          document.body.removeChild(sheetContainer);
        }
      }
    }
    return pdf;
  }

  if (isSingleWeek) {
    const weeksList = extractWeeksFromVisits(result.plannedVisits, isRtl, result.settings.startDate, result.settings.endDate);
    const targetWNum = parseWeekNumFromKey(options?.weekFilter || '');
    const targetW = weeksList.find(w => w.weekKey === options?.weekFilter || (targetWNum !== null && w.weekNum === targetWNum)) || weeksList.find(w => w.visits.length > 0) || weeksList[0];

    if (targetW) {
      const singleContainer = buildSingleWeekSheetHtmlContainer(targetW, result, settings, isRtl, lang);
      document.body.appendChild(singleContainer);

      try {
        await new Promise(r => setTimeout(r, 80));
        const canvas = await renderContainerToCanvas(singleContainer, { width: 1050, height: 1485 });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        return pdf;
      } finally {
        if (document.body.contains(singleContainer)) {
          document.body.removeChild(singleContainer);
        }
      }
    }
  }

  // Standard Term Container
  const container = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang, options);
  document.body.appendChild(container);

  try {
    await new Promise(resolve => setTimeout(resolve, 80));

    const totalHeight = Math.max(1200, container.scrollHeight || 1200);
    const canvas = await renderContainerToCanvas(container, { width: 1050, height: totalHeight });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (imgHeight <= pdfHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight, undefined, 'FAST');
    } else {
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
  lang: string = 'ar',
  options?: TermVisitReportExportOptions
): Promise<{ success: boolean; filename: string; method?: string; error?: string }> {
  const isWeekly = Boolean(options?.weekFilter && options.weekFilter !== 'all');
  const weekSuffix = isWeekly ? `_${(options?.weekFilter || '').replace(/\s+/g, '_')}` : `_${result.settings.term.replace(/\s+/g, '_')}`;
  const fileName = `خطة_الزيارات_الصفية${weekSuffix}.pdf`;
  const htmlFileName = `خطة_الزيارات_الصفية${weekSuffix}.html`;

  try {
    const pdf = await generateTermVisitPlanPdfInstance(result, settings, isRtl, lang, options);
    const blob = pdf.output('blob');

    // 1. Native Capacitor platform support
    if (Capacitor.isNativePlatform()) {
      try {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Documents
        });
        await Share.share({
          title: fileName,
          url: savedFile.uri
        });
        return { success: true, filename: fileName, method: 'native' };
      } catch (nativeErr) {
        console.warn('Native Capacitor share failed, falling back to browser download:', nativeErr);
      }
    }

    // 2. Browser anchor download - Saves binary file directly to Internal Storage / Downloads folder
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
    const container = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang, options);
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
  lang: string = 'ar',
  options?: TermVisitReportExportOptions
): Promise<{ success: boolean; filename: string; method?: string; error?: string }> {
  const isWeekly = Boolean(options?.weekFilter && options.weekFilter !== 'all');
  const weekSuffix = isWeekly ? `_${(options?.weekFilter || '').replace(/\s+/g, '_')}` : `_${result.settings.term.replace(/\s+/g, '_')}`;
  const fileName = `تقرير_خطة_الزيارات${weekSuffix}.pdf`;
  const htmlFileName = `تقرير_خطة_الزيارات${weekSuffix}.html`;

  try {
    const pdf = await generateTermVisitPlanPdfInstance(result, settings, isRtl, lang, options);
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
          title: fileName,
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
          title: fileName,
          url: cachedFile.uri
        });
        return { success: true, filename: fileName, method: 'native-cache' };
      }
    }

    // 2. Direct Anchor Download - Direct binary file download into Android Phone Internal Downloads folder
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // 3. Fallback jsPDF save call
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
      const container = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang, options);
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
  lang: string = 'ar',
  options?: TermVisitReportExportOptions
): Promise<void> {
  const is2PerSheet = options?.exportLayout === 'weekly_2per_page';
  const is4PerSheet = options?.exportLayout === 'weekly_4per_page';
  const isSingleWeek = options?.exportLayout === 'single_week' || (Boolean(options?.weekFilter && options.weekFilter !== 'all') && options?.exportLayout !== 'standard');

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = '100vw';
  wrapper.style.zIndex = '999999';
  wrapper.style.backgroundColor = '#ffffff';

  if (is2PerSheet) {
    const weeksList = extractWeeksFromVisits(result.plannedVisits, isRtl, result.settings.startDate, result.settings.endDate);
    const chunks = chunkArray(weeksList, 2);
    chunks.forEach((chunk, idx) => {
      const c = build2WeeksSheetHtmlContainer(chunk, idx, chunks.length, result, settings, isRtl, lang);
      c.style.position = 'relative';
      c.style.width = '100%';
      c.style.pageBreakAfter = idx < chunks.length - 1 ? 'always' : 'auto';
      wrapper.appendChild(c);
    });
  } else if (is4PerSheet) {
    const weeksList = extractWeeksFromVisits(result.plannedVisits, isRtl, result.settings.startDate, result.settings.endDate);
    const chunks = chunkArray(weeksList, 4);
    chunks.forEach((chunk, idx) => {
      const c = build4WeeksSheetHtmlContainer(chunk, idx, chunks.length, result, settings, isRtl, lang);
      c.style.position = 'relative';
      c.style.width = '100%';
      c.style.pageBreakAfter = idx < chunks.length - 1 ? 'always' : 'auto';
      wrapper.appendChild(c);
    });
  } else if (isSingleWeek) {
    const weeksList = extractWeeksFromVisits(result.plannedVisits, isRtl, result.settings.startDate, result.settings.endDate);
    const targetWNum = parseWeekNumFromKey(options?.weekFilter || '');
    const targetW = weeksList.find(w => w.weekKey === options?.weekFilter || (targetWNum !== null && w.weekNum === targetWNum)) || weeksList.find(w => w.visits.length > 0) || weeksList[0];
    if (targetW) {
      const c = buildSingleWeekSheetHtmlContainer(targetW, result, settings, isRtl, lang);
      c.style.position = 'relative';
      c.style.width = '100%';
      wrapper.appendChild(c);
    } else {
      const c = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang, options);
      c.style.position = 'relative';
      c.style.width = '100%';
      wrapper.appendChild(c);
    }
  } else {
    const c = buildTermVisitReportHtmlContainer(result, settings, isRtl, lang, options);
    c.style.position = 'relative';
    c.style.width = '100%';
    wrapper.appendChild(c);
  }

  document.body.appendChild(wrapper);
  window.print();

  setTimeout(() => {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }, 1000);
}
