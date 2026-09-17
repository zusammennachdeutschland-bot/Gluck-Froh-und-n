import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { 
  SchoolSettings, 
  SchoolPeriodRecord, 
  SchoolPeriodSettings, 
  TeacherProfile,
  AppLanguage 
} from '../types';
import { 
  getSchoolSettings, 
  calculatePeriodsTimings, 
  CalculatedPeriod,
  getCustomSessionsForPeriod,
  getUnmatchedCustomSessions
} from '../utils/schoolUtils';
import { 
  sanitizeModernCssColors, 
  dataUrlToBlob 
} from '../utils/certificateExportUtils';
import { generateRecurringSchoolScheduleIcs } from '../utils/schoolScheduleIcsUtils';

export type SchoolScheduleExportFormat = 'png' | 'jpeg' | 'pdf' | 'ics';
export type SchoolScheduleExportTheme = 'clean_light' | 'brand_accent';

export interface SchoolScheduleExportOptions {
  format?: SchoolScheduleExportFormat;
  theme?: SchoolScheduleExportTheme;
  language?: AppLanguage;
  includeTeacherName?: boolean;
  includeSchoolTimes?: boolean;
  includeNotes?: boolean;
  paperOrientation?: 'landscape' | 'portrait';
  quality?: number;
  scale?: number;
}

export interface ScheduleExportDayInfo {
  key: string;
  label: string;
  short: string;
  isActive: boolean;
  presenceTime?: string;
}

export interface ScheduleExportCell {
  periodNumber: number;
  dayKey: string;
  className?: string;
  subjectName?: string;
  notes?: string;
  isFilled: boolean;
}

export interface SchoolScheduleExportModel {
  title: string;
  subtitle: string;
  teacherName: string;
  schoolPresenceTimes: string;
  exportDateFormatted: string;
  filenameBase: string;
  isRtl: boolean;
  language: AppLanguage;
  stats: {
    totalClasses: number;
    totalStages: number;
    totalWeeklyLessons: number;
    summaryLine: string;
  };
  days: ScheduleExportDayInfo[];
  periods: CalculatedPeriod[];
  cellsByPeriod: Record<number, Record<string, ScheduleExportCell>>;
}

/**
 * Extracts academic stage number/grade from class name
 */
function extractStageNumber(clsName: string): string {
  if (!clsName) return '';
  const trimmed = clsName.trim();
  const digitMatch = trimmed.match(/\d+/);
  if (digitMatch) return digitMatch[0];
  const slashMatch = trimmed.match(/^[a-zA-Z\u0621-\u064A]+/);
  if (slashMatch) return slashMatch[0];
  return trimmed.toLowerCase();
}

/**
 * Builds a structured export data model from active school settings and teacher profile
 */
export function buildSchoolScheduleExportModel(
  settingsInput: SchoolSettings | null | undefined,
  profile: TeacherProfile | null | undefined,
  options: SchoolScheduleExportOptions = {}
): SchoolScheduleExportModel {
  const currentSettings = settingsInput || getSchoolSettings(profile);
  const lang: AppLanguage = options.language || profile?.language || 'ar';
  const isRtl = lang === 'ar';

  const daysConfig = [
    { key: '0', labelAr: 'الأحد', labelEn: 'Sunday', labelDe: 'Sonntag', shortAr: 'أحد', shortEn: 'Sun', shortDe: 'So' },
    { key: '1', labelAr: 'الإثنين', labelEn: 'Monday', labelDe: 'Montag', shortAr: 'اثنين', shortEn: 'Mon', shortDe: 'Mo' },
    { key: '2', labelAr: 'الثلاثاء', labelEn: 'Tuesday', labelDe: 'Dienstag', shortAr: 'ثلاثاء', shortEn: 'Tue', shortDe: 'Di' },
    { key: '3', labelAr: 'الأربعاء', labelEn: 'Wednesday', labelDe: 'Mittwoch', shortAr: 'أربعاء', shortEn: 'Wed', shortDe: 'Mi' },
    { key: '4', labelAr: 'الخميس', labelEn: 'Thursday', labelDe: 'Donnerstag', shortAr: 'خميس', shortEn: 'Thu', shortDe: 'Do' },
    { key: '5', labelAr: 'الجمعة', labelEn: 'Friday', labelDe: 'Freitag', shortAr: 'جمعة', shortEn: 'Fri', shortDe: 'Fr' },
    { key: '6', labelAr: 'السبت', labelEn: 'Saturday', labelDe: 'Samstag', shortAr: 'سبت', shortEn: 'Sat', shortDe: 'Sa' }
  ];

  // 1. Determine active school days
  const activeDaysList: ScheduleExportDayInfo[] = [];
  daysConfig.forEach(d => {
    const presence = currentSettings.presence[d.key];
    const isActive = presence ? presence.active : (['0', '1', '2', '3', '4'].includes(d.key));
    if (isActive) {
      const label = lang === 'ar' ? d.labelAr : (lang === 'de' ? d.labelDe : d.labelEn);
      const short = lang === 'ar' ? d.shortAr : (lang === 'de' ? d.shortDe : d.shortEn);
      const presenceTime = presence ? `${presence.arrivalTime} - ${presence.departureTime}` : undefined;
      activeDaysList.push({
        key: d.key,
        label,
        short,
        isActive: true,
        presenceTime
      });
    }
  });

  // Fallback if no days are marked active
  if (activeDaysList.length === 0) {
    daysConfig.slice(0, 5).forEach(d => {
      activeDaysList.push({
        key: d.key,
        label: lang === 'ar' ? d.labelAr : (lang === 'de' ? d.labelDe : d.labelEn),
        short: lang === 'ar' ? d.shortAr : (lang === 'de' ? d.shortDe : d.shortEn),
        isActive: true
      });
    });
  }

  // 2. Calculated Periods
  const calculatedPeriods = calculatePeriodsTimings(currentSettings.periodSettings);

  // Also collect any unmatched custom sessions across active days to ensure complete schedule coverage in export
  const unmatchedList: CalculatedPeriod[] = [];
  const unmatchedTimingsSet = new Set<string>();

  activeDaysList.forEach(day => {
    const dayUnmatched = getUnmatchedCustomSessions(currentSettings.customTimedSessions, day.key, calculatedPeriods);
    dayUnmatched.forEach(cs => {
      const timingKey = `${cs.startTime}-${cs.endTime}`;
      if (!unmatchedTimingsSet.has(timingKey)) {
        unmatchedTimingsSet.add(timingKey);
        const periodIndex = calculatedPeriods.length + unmatchedList.length + 1;
        unmatchedList.push({
          periodNumber: periodIndex,
          startTime: cs.startTime,
          endTime: cs.endTime || cs.startTime,
          duration: 45,
          isCustom: true
        });
      }
    });
  });

  const allExportPeriods = [...calculatedPeriods, ...unmatchedList];

  // 3. Stats & Metrics
  const uniqueClassesSet = new Set<string>();
  const uniqueStagesSet = new Set<string>();
  let totalWeeklyLessons = 0;

  const cellsByPeriod: Record<number, Record<string, ScheduleExportCell>> = {};

  allExportPeriods.forEach(period => {
    cellsByPeriod[period.periodNumber] = {};
    const isStandardPeriod = period.periodNumber <= calculatedPeriods.length;

    activeDaysList.forEach(day => {
      const daySchedule = currentSettings.schedule[day.key] || [];
      const record = isStandardPeriod ? daySchedule.find(p => p.periodNumber === period.periodNumber) : undefined;
      
      let matchingCustoms: any[] = [];
      if (isStandardPeriod) {
        matchingCustoms = getCustomSessionsForPeriod(currentSettings.customTimedSessions, day.key, period.periodNumber, calculatedPeriods);
      } else {
        // Unmatched slot: check for custom sessions matching this time slot
        const dayUnmatched = getUnmatchedCustomSessions(currentSettings.customTimedSessions, day.key, calculatedPeriods);
        matchingCustoms = dayUnmatched.filter(cs => cs.startTime === period.startTime);
      }

      let className = record?.className?.trim() || '';
      let subjectName = record?.subjectName?.trim() || '';
      let notes = record?.notes?.trim() || '';

      if (matchingCustoms.length > 0) {
        const customNames = matchingCustoms.map(cs => `${cs.className} [⏱️ ${cs.startTime}-${cs.endTime}]`).join(' • ');
        if (className) {
          className = `${className} / ${customNames}`;
        } else {
          className = customNames;
          subjectName = matchingCustoms[0].subjectName || (lang === 'ar' ? 'حصة مخصصة' : 'Custom');
          notes = matchingCustoms[0].notes || '';
        }
      }

      const isFilled = Boolean(className || subjectName);

      if (isFilled) {
        if (record?.className && record.className.trim()) {
          uniqueClassesSet.add(record.className.trim());
          const stage = extractStageNumber(record.className);
          if (stage) uniqueStagesSet.add(stage);
        }
        matchingCustoms.forEach(cs => {
          if (cs.className) {
            uniqueClassesSet.add(cs.className.trim());
            const stage = extractStageNumber(cs.className);
            if (stage) uniqueStagesSet.add(stage);
          }
        });
        totalWeeklyLessons += (record && (record.className || record.subjectName) ? 1 : 0) + matchingCustoms.length;
      }

      cellsByPeriod[period.periodNumber][day.key] = {
        periodNumber: period.periodNumber,
        dayKey: day.key,
        className,
        subjectName,
        notes,
        isFilled
      };
    });
  });

  const totalClasses = uniqueClassesSet.size;
  const totalStages = uniqueStagesSet.size;

  // Localized summary line
  let summaryLine = '';
  if (lang === 'ar') {
    summaryLine = `${totalClasses} فصول • ${totalStages} مراحل • ${totalWeeklyLessons} حصة أسبوعياً`;
  } else if (lang === 'de') {
    summaryLine = `${totalClasses} Klassen • ${totalStages} Stufen • ${totalWeeklyLessons} Wochenstunden`;
  } else {
    summaryLine = `${totalClasses} Classes • ${totalStages} Stages • ${totalWeeklyLessons} Weekly Lessons`;
  }

  // Localized Titles
  let title = 'جدول المدرسة الأسبوعي';
  let subtitle = 'Glück Teacher Assistant';
  if (lang === 'de') {
    title = 'Wöchentlicher Schulstundenplan';
    subtitle = 'Glück Unterrichts-Assistent';
  } else if (lang === 'en') {
    title = 'Weekly School Schedule';
    subtitle = 'Glück Teacher Assistant';
  }

  // Formatted date string
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  };
  const locale = lang === 'ar' ? 'ar-EG' : (lang === 'de' ? 'de-DE' : 'en-US');
  const exportDateFormatted = today.toLocaleDateString(locale, dateOptions);

  // Presence time summary string
  const firstActivePresence = activeDaysList[0]?.presenceTime || '07:30 - 14:30';

  // Base Filename
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const teacherTag = profile?.displayName ? `_${profile.displayName.replace(/\s+/g, '_')}` : '';
  const filenameBase = `School_Schedule${teacherTag}_${yyyy}-${mm}-${dd}`;

  return {
    title,
    subtitle,
    teacherName: profile?.displayName || '',
    schoolPresenceTimes: firstActivePresence,
    exportDateFormatted,
    filenameBase,
    isRtl,
    language: lang,
    stats: {
      totalClasses,
      totalStages,
      totalWeeklyLessons,
      summaryLine
    },
    days: activeDaysList,
    periods: allExportPeriods,
    cellsByPeriod
  };
}

/**
 * Creates the HTML export template document offscreen for pristine rendering
 */
function createExportDomElement(
  model: SchoolScheduleExportModel,
  options: SchoolScheduleExportOptions = {}
): HTMLElement {
  const theme = options.theme || 'clean_light';
  const isAccentTheme = theme === 'brand_accent';
  const isRtl = model.isRtl;

  const container = document.createElement('div');
  container.id = `school-export-canvas-${Date.now()}`;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '1480px'; // A4 Landscape ratio ~ 1.414 (1480 x 1046)
  container.style.minHeight = '1046px';
  container.style.zIndex = '-9999';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = isRtl 
    ? "'Cairo', 'Alexandria', 'Amiri', system-ui, -apple-system, sans-serif" 
    : "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
  container.style.direction = isRtl ? 'rtl' : 'ltr';
  container.style.boxSizing = 'border-box';
  container.style.padding = '28px 36px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'space-between';

  // Primary palette variables for high print contrast
  const primaryColor = isAccentTheme ? '#0284c7' : '#000000';
  const primarySoftBg = isAccentTheme ? '#f0f9ff' : '#f8fafc';
  const tableBorder = '#000000'; // Pure crisp black borders for high-contrast printing

  const numCols = model.days.length;
  const timeColWidth = numCols > 5 ? '13%' : '15%';
  const dayColWidth = `${(100 - (numCols > 5 ? 13 : 15)) / numCols}%`;

  const timeLabel = model.language === 'ar' ? 'الحصة / التوقيت' : (model.language === 'de' ? 'Stunde / Zeit' : 'Period / Time');
  const exportedLabel = model.language === 'ar' ? 'تاريخ الطباعة:' : (model.language === 'de' ? 'Druckdatum:' : 'Print Date:');
  const teacherLabel = model.language === 'ar' ? 'المعلم:' : (model.language === 'de' ? 'Lehrkraft:' : 'Teacher:');

  // Build rows HTML
  const rowsHtml = model.periods.map(period => {
    const periodNumberLabel = period.isCustom 
      ? (model.language === 'ar' ? 'حصة مخصصة' : (model.language === 'de' ? 'Spez. Stunde' : 'Custom Session'))
      : (model.language === 'ar' 
          ? `الحصة ${period.periodNumber}` 
          : (model.language === 'de' ? `Std. ${period.periodNumber}` : `Period ${period.periodNumber}`));

    const cellsHtml = model.days.map(day => {
      const cell = model.cellsByPeriod[period.periodNumber]?.[day.key];
      const isFilled = cell && cell.isFilled;

      if (!isFilled) {
        return `
          <td style="width: ${dayColWidth}; padding: 4px; border: 2px solid ${tableBorder}; background: #ffffff; text-align: center; vertical-align: middle;">
            <div style="min-height: 76px; display: table; width: 100%;">
              <div style="display: table-cell; vertical-align: middle; text-align: center;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #cbd5e1;"></span>
              </div>
            </div>
          </td>
        `;
      }

      return `
        <td style="width: ${dayColWidth}; padding: 4px; border: 2px solid ${tableBorder}; background: ${primarySoftBg}; text-align: center; vertical-align: middle;">
          <div style="box-sizing: border-box; border: 2px solid ${tableBorder}; border-radius: 8px; padding: 6px 4px; background: #ffffff; text-align: center; min-height: 76px; display: table; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="display: table-cell; vertical-align: middle; text-align: center;">
              ${cell.className ? `
                <div style="display: block; font-weight: 900; font-size: 34px; color: #000000; line-height: 1.1; margin: 0; letter-spacing: -0.5px; word-break: break-word;">
                  ${cell.className}
                </div>
              ` : ''}
              ${cell.subjectName ? `
                <div style="display: inline-block; font-weight: 900; font-size: 15px; color: #0f172a; line-height: 1.2; background: #f1f5f9; padding: 3px 10px; border-radius: 6px; border: 1.5px solid #94a3b8; margin-top: 4px; word-break: break-word;">
                  ${cell.subjectName}
                </div>
              ` : ''}
              ${cell.notes ? `
                <div style="display: block; font-weight: 800; font-size: 13px; color: #334155; line-height: 1.15; margin-top: 3px;">
                  ${cell.notes}
                </div>
              ` : ''}
            </div>
          </div>
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td style="width: ${timeColWidth}; padding: 6px 4px; border: 2px solid ${tableBorder}; background: #f8fafc; text-align: center; vertical-align: middle;">
          <div style="display: block; font-weight: 900; font-size: 24px; color: #000000; line-height: 1.15; margin-bottom: 4px;">
            ${periodNumberLabel}
          </div>
          <div style="display: inline-block; font-weight: 900; font-size: 18px; color: #000000; line-height: 1.2; font-family: 'Cairo', monospace, system-ui; margin: 0; background: #e2e8f0; padding: 3px 8px; border-radius: 6px; border: 1.5px solid #94a3b8; letter-spacing: 0.3px;">
            ${period.startTime} - ${period.endTime}
          </div>
        </td>
        ${cellsHtml}
      </tr>
    `;
  }).join('');

  // Table header days (اليوم) - HUGE, BOLD, HIGH-CONTRAST FOR PRINTING
  const headerDaysHtml = model.days.map(day => `
    <th style="width: ${dayColWidth}; padding: 14px 6px; border: 2px solid ${tableBorder}; background: #0f172a; text-align: center; font-size: 30px; font-weight: 900; color: #ffffff; letter-spacing: -0.2px;">
      <div>${day.label}</div>
    </th>
  `).join('');

  container.innerHTML = `
    <!-- HEADER AREA -->
    <div style="border-bottom: 3px solid #000000; padding-bottom: 14px; margin-bottom: 14px; display: flex; align-items: flex-end; justify-content: space-between;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 8px; background: #000000; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 22px;">
            📖
          </div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 900; color: #000000; letter-spacing: -0.5px;">
            ${model.title}
          </h1>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 16px; font-weight: 800; color: #000000;">
          ${model.teacherName ? `
            <span style="background: #f8fafc; padding: 6px 16px; border-radius: 8px; border: 2.5px solid #000000; color: #000000; font-size: 22px; font-weight: 900;">
              ${teacherLabel} <strong>${model.teacherName}</strong>
            </span>
          ` : ''}
          <span style="background: #f1f5f9; padding: 6px 14px; border-radius: 8px; border: 1.5px solid #94a3b8; font-weight: 900; font-size: 16px; color: #0f172a;">
            ${model.stats.summaryLine}
          </span>
        </div>
      </div>

      <div style="text-align: ${isRtl ? 'left' : 'right'};">
        <div style="font-size: 20px; font-weight: 900; color: #000000; letter-spacing: 0.5px;">
          GLÜCK
        </div>
        <div style="font-size: 14px; font-weight: 800; color: #334155; margin-top: 2px;">
          ${exportedLabel} ${model.exportDateFormatted}
        </div>
      </div>
    </div>

    <!-- MAIN SCHEDULE TABLE -->
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start;">
      <table style="width: 100%; border-collapse: collapse; border: 3px solid ${tableBorder}; table-layout: fixed;">
        <thead>
          <tr>
            <th style="width: ${timeColWidth}; padding: 14px 6px; border: 2px solid ${tableBorder}; background: #0f172a; text-align: center; font-size: 20px; font-weight: 900; color: #ffffff;">
              ${timeLabel}
            </th>
            ${headerDaysHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <!-- FOOTER AREA -->
    <div style="margin-top: 14px; padding-top: 10px; border-top: 2px solid #000000; display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 800; color: #334155;">
      <div>
        Glück Teacher Assistant • ${model.stats.totalWeeklyLessons} ${model.language === 'ar' ? 'حصة أسبوعية' : (model.language === 'de' ? 'Wochenstunden' : 'Weekly Lessons')}
      </div>
      <div>
        A4 Landscape Format • ${model.exportDateFormatted}
      </div>
    </div>
  `;

  return container;
}

/**
 * Renders the clean schedule export model to a high-DPI HTMLCanvasElement
 */
export async function renderScheduleToCanvas(
  model: SchoolScheduleExportModel,
  options: SchoolScheduleExportOptions = {}
): Promise<HTMLCanvasElement> {
  // Yield thread so React UI can render spinner before CPU rendering
  await new Promise(resolve => setTimeout(resolve, 50));

  let tempContainer: HTMLElement | null = null;

  try {
    tempContainer = createExportDomElement(model, options);
    document.body.appendChild(tempContainer);

    // Wait for fonts to be ready
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore font observer failures
      }
    }

    await new Promise(resolve => setTimeout(resolve, 80));

    const isNative = Capacitor.isNativePlatform();
    const scale = options.scale || (isNative ? 2.0 : 2.5);

    const canvas = await html2canvas(tempContainer, {
      scale,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 8000,
      logging: false,
      backgroundColor: '#ffffff',
      width: tempContainer.offsetWidth || 1480,
      height: tempContainer.offsetHeight || 1046,
      onclone: (clonedDoc) => {
        // Ensure strictly light mode on cloned DOM
        clonedDoc.documentElement.classList.remove('dark');
        if (clonedDoc.body) {
          clonedDoc.body.classList.remove('dark');
          clonedDoc.body.style.backgroundColor = '#ffffff';
        }
        // Sanitize inline styles
        const styles = clonedDoc.querySelectorAll('style');
        styles.forEach(s => {
          if (s.textContent) {
            s.textContent = sanitizeModernCssColors(s.textContent);
          }
        });
      }
    });

    return canvas;
  } finally {
    if (tempContainer && document.body.contains(tempContainer)) {
      try {
        document.body.removeChild(tempContainer);
      } catch (err) {
        console.warn('Error cleaning up export canvas container:', err);
      }
    }
  }
}

/**
 * Exports the School Schedule as a PNG or JPEG Image with Android & Desktop support
 */
export async function exportSchoolScheduleAsImage(
  settings: SchoolSettings | null | undefined,
  profile: TeacherProfile | null | undefined,
  options: SchoolScheduleExportOptions = {}
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const format = options.format === 'jpeg' ? 'jpeg' : 'png';
    const model = buildSchoolScheduleExportModel(settings, profile, options);
    const canvas = await renderScheduleToCanvas(model, options);

    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = options.quality || 0.98;
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const filename = `${model.filenameBase}.${format === 'jpeg' ? 'jpg' : 'png'}`;

    // 1. Android / iOS Native Platform (Capacitor)
    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = dataUrl.split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });

        // Open Share sheet / Save intent directly on mobile
        await Share.share({
          title: model.title,
          text: `${model.title} - ${model.stats.summaryLine}`,
          url: savedFile.uri,
          dialogTitle: model.language === 'ar' ? 'حفظ / مشاركة جدول المدرسة' : 'Save / Share School Schedule'
        });

        return { success: true, filename };
      } catch (nativeErr: any) {
        console.warn('Capacitor native share warning:', nativeErr);
      }
    }

    // 2. Web / Desktop Fallback: Trigger direct browser download
    const blob = dataUrlToBlob(dataUrl);
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

    return { success: true, filename };
  } catch (error: any) {
    console.error('Error exporting school schedule as image:', error);
    return { 
      success: false, 
      error: error?.message || 'Failed to export image' 
    };
  }
}

/**
 * Exports the School Schedule as a crisp A4 Landscape PDF
 */
export async function exportSchoolScheduleAsPdf(
  settings: SchoolSettings | null | undefined,
  profile: TeacherProfile | null | undefined,
  options: SchoolScheduleExportOptions = {}
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const model = buildSchoolScheduleExportModel(settings, profile, {
      ...options,
      format: 'pdf'
    });
    const canvas = await renderScheduleToCanvas(model, options);
    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // Standard A4 Landscape: 297mm width x 210mm height
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Fill page neatly
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

    // Add PDF document metadata
    pdf.setProperties({
      title: model.title,
      subject: model.stats.summaryLine,
      author: model.teacherName || 'Glück Teacher Assistant',
      keywords: 'School Schedule, Stundenplan, Glück',
      creator: 'Glück Teacher Assistant'
    });

    const filename = `${model.filenameBase}.pdf`;

    // 1. Capacitor Native Android / iOS
    if (Capacitor.isNativePlatform()) {
      try {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: pdfBase64,
          directory: Directory.Cache
        });

        await Share.share({
          title: model.title,
          text: `${model.title} - ${model.stats.summaryLine}`,
          url: savedFile.uri,
          dialogTitle: model.language === 'ar' ? 'حفظ / مشاركة ملف PDF' : 'Save / Share Schedule PDF'
        });

        return { success: true, filename };
      } catch (nativeErr: any) {
        console.warn('Capacitor native PDF share warning:', nativeErr);
      }
    }

    // 2. Web / Desktop Fallback: Trigger PDF Blob Download
    const pdfBlob = pdf.output('blob');
    const objectUrl = URL.createObjectURL(pdfBlob);

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

    return { success: true, filename };
  } catch (error: any) {
    console.error('Error exporting school schedule as PDF:', error);
    return { 
      success: false, 
      error: error?.message || 'Failed to export PDF' 
    };
  }
}

/**
 * Exports school schedule as an iCalendar (.ics) file
 */
export async function exportSchoolScheduleAsIcs(
  settings: SchoolSettings | null | undefined,
  profile: TeacherProfile | null | undefined,
  options: SchoolScheduleExportOptions = {}
): Promise<{ success: boolean; filename?: string; icsContent?: string; error?: string }> {
  try {
    const { icsContent, filename } = generateRecurringSchoolScheduleIcs(settings, profile, {
      language: options.language || profile?.language || 'ar',
      includePresence: options.includeSchoolTimes ?? false
    });

    if (Capacitor.isNativePlatform()) {
      try {
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: icsContent,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'School Schedule Calendar Export',
          text: `Glück School Schedule - ${filename}`,
          url: savedFile.uri,
          dialogTitle: options.language === 'ar' ? 'حفظ / استيراد ملف التقويم' : 'Save / Import Calendar (.ics)'
        });

        return { success: true, filename, icsContent };
      } catch (nativeErr: any) {
        console.warn('Capacitor native ICS share warning:', nativeErr);
      }
    }

    // Web / Desktop Fallback: Trigger Blob Download
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
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

    return { success: true, filename, icsContent };
  } catch (error: any) {
    console.error('Error exporting school schedule as ICS:', error);
    return {
      success: false,
      error: error?.message || 'Failed to export ICS'
    };
  }
}

/**
 * Universal Share Action for School Schedule (Native Android Sheet or Web Share API)
 */
export async function shareSchoolSchedule(
  settings: SchoolSettings | null | undefined,
  profile: TeacherProfile | null | undefined,
  options: SchoolScheduleExportOptions = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const format = options.format || 'png';
    const model = buildSchoolScheduleExportModel(settings, profile, options);

    if (format === 'ics') {
      return exportSchoolScheduleAsIcs(settings, profile, options);
    }

    if (format === 'pdf') {
      return exportSchoolScheduleAsPdf(settings, profile, options);
    }

    const canvas = await renderScheduleToCanvas(model, options);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, 0.98);
    const filename = `${model.filenameBase}.${format === 'jpeg' ? 'jpg' : 'png'}`;

    // 1. Native Capacitor Share
    if (Capacitor.isNativePlatform()) {
      const base64Data = dataUrl.split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });

      await Share.share({
        title: model.title,
        text: `📖 ${model.title} (${model.stats.summaryLine})`,
        url: savedFile.uri,
        dialogTitle: model.language === 'ar' ? 'مشاركة جدول المدرسة' : 'Share School Schedule'
      });
      return { success: true };
    }

    // 2. Web Share API with File
    if (typeof navigator !== 'undefined' && navigator.share && typeof navigator.canShare === 'function') {
      try {
        const blob = dataUrlToBlob(dataUrl);
        const file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: model.title,
            text: `📖 ${model.title} (${model.stats.summaryLine})`,
            files: [file]
          });
          return { success: true };
        }
      } catch (shareErr: any) {
        if (
          shareErr?.name === 'AbortError' ||
          shareErr?.message?.includes('cancel') ||
          shareErr?.message?.includes('canceled') ||
          shareErr?.message?.includes('cancelled')
        ) {
          return { success: true };
        }
        console.warn('Web share gesture timed out or unsupported, falling back to download:', shareErr);
      }
    }

    // 3. Fallback: Download file
    return exportSchoolScheduleAsImage(settings, profile, { ...options, format });
  } catch (error: any) {
    console.error('Error sharing school schedule:', error);
    return { 
      success: false, 
      error: error?.message || 'Failed to share schedule' 
    };
  }
}

/**
 * Direct Browser / Native Printing for School Schedule
 */
export function printSchoolScheduleNative(
  settings: SchoolSettings | null | undefined,
  profile: TeacherProfile | null | undefined,
  options: SchoolScheduleExportOptions = {}
): { success: boolean; error?: string } {
  try {
    const model = buildSchoolScheduleExportModel(settings, profile, options);
    const element = createExportDomElement(model, options);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback: If popup blocked, print current page after isolating or report error
      window.print();
      return { success: true };
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${model.isRtl ? 'rtl' : 'ltr'}" lang="${model.language}">
      <head>
        <meta charset="utf-8">
        <title>${model.title} - ${model.teacherName || 'Glück'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: ${model.isRtl ? "'Cairo', sans-serif" : "system-ui, sans-serif"};
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
          #print-wrapper {
            width: 100%;
            max-width: 100%;
          }
          #print-wrapper > div {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            min-height: auto !important;
            padding: 10px !important;
          }
          @media print {
            body {
              width: 100%;
              height: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div id="print-wrapper">
          ${element.outerHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    return { success: true };
  } catch (err: any) {
    console.error('Direct print failed:', err);
    return { success: false, error: err?.message || 'Print failed' };
  }
}

