import { SchoolSettings } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getReportSchoolLogoHtml } from './alsunLogoData';

export interface WeeklyPlanGradeItem {
  gradeName: string;
  s1?: string;
  s2?: string;
  ha?: string;
  quiz?: string;
  hinweis?: string;
}

export interface WeeklyPlanRecord {
  id: string;
  gradeBand: string;
  secretaryName?: string;
  secretaryPhone?: string;
  weekNumber?: number;
  status?: 'pending' | 'sent';
  sentAt?: string;
  gradesContent?: WeeklyPlanGradeItem[];
}

export function cleanSecretaryName(name?: string): string {
  if (!name) return '';
  return name.replace(/^(أستاذة|أ\/|سكرتيرة|السكرتيرة|Frau|Herr)\s*/gi, '').trim();
}

/**
 * Resolves the stage secretary from SchoolSettings for a given grade band.
 * Prioritizes SchoolSettings -> StageSecretaries linked to StageManagers or matched by band.
 */
export function getSecretaryForGradeBand(
  gradeBand: string,
  settings?: SchoolSettings,
  fallbackName?: string,
  fallbackPhone?: string
): { name: string; phone: string } {
  const secretaries = settings?.stageSecretaries || [];
  const managers = settings?.stageManagers || [];

  if (secretaries.length > 0) {
    // 1. Try finding secretary via linked StageManager whose gradeBand matches
    const matchedManager = managers.find(m => {
      const mBand = (m.gradeBand || '').toLowerCase();
      const gBand = (gradeBand || '').toLowerCase();
      if (gBand.includes('1–3') || gBand.includes('1-3')) {
        return mBand.includes('1–3') || mBand.includes('1-3') || mBand.includes('prim');
      }
      if (gBand.includes('4–6') || gBand.includes('4-6')) {
        return mBand.includes('4–6') || mBand.includes('4-6');
      }
      if (gBand.includes('7–9') || gBand.includes('7-9')) {
        return mBand.includes('7–9') || mBand.includes('7-9') || mBand.includes('prep');
      }
      if (gBand.includes('10–12') || gBand.includes('10-12')) {
        return mBand.includes('10–12') || mBand.includes('10-12') || mBand.includes('sec');
      }
      return false;
    });

    if (matchedManager) {
      const found = secretaries.find(s => s.stageManagerId === matchedManager.id);
      if (found && found.name && found.name.trim() !== '') {
        return { name: cleanSecretaryName(found.name), phone: found.phone || '' };
      }
    }

    // 2. Try index-based matching (0: Grades 1-3, 1: Grades 4-6, 2: Grades 7-9, 3: Grades 10-12)
    let bandIdx = 0;
    if (gradeBand.includes('4–6') || gradeBand.includes('4-6')) bandIdx = 1;
    else if (gradeBand.includes('7–9') || gradeBand.includes('7-9')) bandIdx = 2;
    else if (gradeBand.includes('10–12') || gradeBand.includes('10-12')) bandIdx = 3;

    if (secretaries[bandIdx]?.name && secretaries[bandIdx].name.trim() !== '') {
      return { name: cleanSecretaryName(secretaries[bandIdx].name), phone: secretaries[bandIdx].phone || '' };
    }

    // 3. Fallback to first available secretary
    if (secretaries[0]?.name && secretaries[0].name.trim() !== '') {
      return { name: cleanSecretaryName(secretaries[0].name), phone: secretaries[0].phone || '' };
    }
  }

  // 4. Fallback to manually saved name if provided
  if (fallbackName && fallbackName.trim() !== '') {
    return { name: cleanSecretaryName(fallbackName), phone: fallbackPhone || '' };
  }

  return { name: '', phone: '' };
}

export function cleanHodName(name?: string, fallback: string = ''): string {
  if (!name) return fallback;
  const cleaned = name.replace(/^(أستاذ|أ\/|Herr|Dr\.|Mr\.)\s*/gi, '').trim();
  return cleaned || fallback;
}

export function getGermanGradeBandLabel(band: string): string {
  if (band.includes('1–3') || band.includes('1-3')) return 'Grundstufe (Klassen 1–3)';
  if (band.includes('4–6') || band.includes('4-6')) return 'Mittelstufe 1 (Klassen 4–6)';
  if (band.includes('7–9') || band.includes('7-9')) return 'Mittelstufe 2 (Klassen 7–9)';
  if (band.includes('10–12') || band.includes('10-12')) return 'Oberstufe (Klassen 10–12)';
  return band;
}

export function getArabicGradeBandLabel(band: string): string {
  if (band.includes('1–3') || band.includes('1-3')) return 'المرحلة الابتدائية (الصفوف 1-3)';
  if (band.includes('4–6') || band.includes('4-6')) return 'المرحلة الابتدائية العليا (الصفوف 4-6)';
  if (band.includes('7–9') || band.includes('7-9')) return 'المرحلة الإعدادية (الصفوف 7-9)';
  if (band.includes('10–12') || band.includes('10-12')) return 'المرحلة الثانوية (الصفوف 10-12)';
  return band;
}

export function getGermanGradeName(name: string, band: string, index: number): string {
  if (name && name.trim() !== '') return name;
  if (band.includes('1–3') || band.includes('1-3')) {
    const grades = ['1. Klasse', '2. Klasse', '3. Klasse'];
    return grades[index] || `Klasse ${index + 1}`;
  }
  if (band.includes('4–6') || band.includes('4-6')) {
    const grades = ['4. Klasse', '5. Klasse', '6. Klasse'];
    return grades[index] || `Klasse ${index + 4}`;
  }
  if (band.includes('7–9') || band.includes('7-9')) {
    const grades = ['7. Klasse', '8. Klasse', '9. Klasse'];
    return grades[index] || `Klasse ${index + 7}`;
  }
  if (band.includes('10–12') || band.includes('10-12')) {
    const grades = ['10. Klasse', '11. Klasse', '12. Klasse'];
    return grades[index] || `Klasse ${index + 10}`;
  }
  return `Klasse ${index + 1}`;
}

export const WEEKLY_SECRETARY_APPRECIATIONS = [
  {
    emoji: '🌹',
    de: (sec: string) => sec ? `🌹 Vielen Dank für Ihre wertvolle Unterstützung zum Start der Schulwoche, Frau ${sec}!` : `🌹 Vielen Dank für Ihre wertvolle Unterstützung zum Start der Schulwoche!`,
    en: (sec: string) => sec ? `(Thank you so much for your valuable support at the start of this school week, Ms. ${sec})` : `(Thank you so much for your valuable support at the start of this school week)`
  },
  {
    emoji: '🌷',
    de: (sec: string) => sec ? `🌷 Herzlichen Dank für Ihre kontinuierliche Mühe und tatkräftige Hilfe, Frau ${sec}!` : `🌷 Herzlichen Dank für Ihre kontinuierliche Mühe und tatkräftige Hilfe!`,
    en: (sec: string) => sec ? `(Warm thanks for your ongoing dedication and active assistance, Ms. ${sec})` : `(Warm thanks for your ongoing dedication and active assistance)`
  },
  {
    emoji: '🌸',
    de: (sec: string) => sec ? `🌸 Ein großes Dankeschön für Ihre hervorragende Zusammenarbeit und Organisation, Frau ${sec}!` : `🌸 Ein großes Dankeschön für Ihre hervorragende Zusammenarbeit und Organisation!`,
    en: (sec: string) => sec ? `(A big thank you for your outstanding cooperation and organization, Ms. ${sec})` : `(A big thank you for your outstanding cooperation and organization)`
  },
  {
    emoji: '🌺',
    de: (sec: string) => sec ? `🌺 Vielen Dank für Ihren unermüdlichen Einsatz und Ihre verlässliche Betreuung, Frau ${sec}!` : `🌺 Vielen Dank für Ihren unermüdlichen Einsatz und Ihre verlässliche Betreuung!`,
    en: (sec: string) => sec ? `(Thank you for your tireless effort and reliable coordination, Ms. ${sec})` : `(Thank you for your tireless effort and reliable coordination)`
  },
  {
    emoji: '🌻',
    de: (sec: string) => sec ? `🌻 Herzlichen Dank für Ihre wunderbare Unterstützung und Freundlichkeit, Frau ${sec}!` : `🌻 Herzlichen Dank für Ihre wunderbare Unterstützung und Freundlichkeit!`,
    en: (sec: string) => sec ? `(Warm thanks for your wonderful support and kindness, Ms. ${sec})` : `(Warm thanks for your wonderful support and kindness)`
  },
  {
    emoji: '🌼',
    de: (sec: string) => sec ? `🌼 Vielen Dank für Ihre wertvolle Begleitung und professionelle Arbeit, Frau ${sec}!` : `🌼 Vielen Dank für Ihre wertvolle Begleitung und professionelle Arbeit!`,
    en: (sec: string) => sec ? `(Thank you for your valuable guidance and professional work, Ms. ${sec})` : `(Thank you for your valuable guidance and professional work)`
  },
  {
    emoji: '💐',
    de: (sec: string) => sec ? `💐 Ein herzliches Dankeschön für Ihre stetige Hilfe und Ihr großes Engagement, Frau ${sec}!` : `💐 Ein herzliches Dankeschön für Ihre stetige Hilfe und Ihr großes Engagement!`,
    en: (sec: string) => sec ? `(Sincere thanks for your continuous assistance and great commitment, Ms. ${sec})` : `(Sincere thanks for your continuous assistance and great commitment)`
  },
  {
    emoji: '🪷',
    de: (sec: string) => sec ? `🪷 Vielen Dank für Ihren erstklassigen Beitrag zum reibungslosen Ablauf, Frau ${sec}!` : `🪷 Vielen Dank für Ihren erstklassigen Beitrag zum reibungslosen Ablauf!`,
    en: (sec: string) => sec ? `(Thank you for your first-class contribution to smooth school operations, Ms. ${sec})` : `(Thank you for your first-class contribution to smooth school operations)`
  }
];

export function getWeeklySecretaryAppreciationText(weekNum: number | string, secName?: string) {
  const numericWeek = Math.max(1, parseInt(String(weekNum).replace(/\D/g, ''), 10) || 1);
  const index = (numericWeek - 1) % WEEKLY_SECRETARY_APPRECIATIONS.length;
  const template = WEEKLY_SECRETARY_APPRECIATIONS[index];
  const cleanName = cleanSecretaryName(secName);
  return {
    de: template.de(cleanName),
    en: template.en(cleanName),
    emoji: template.emoji
  };
}

/**
 * Generates printable & PDF-ready HTML for a SINGLE Stage / Secretary Weekly Plan
 */
export function generateSingleWeeklyPlanHtml(
  plan: WeeklyPlanRecord,
  settings: SchoolSettings,
  weekNum: number
): string {
  const sec = getSecretaryForGradeBand(plan.gradeBand, settings, plan.secretaryName, plan.secretaryPhone);
  const secName = cleanSecretaryName(sec.name);
  const hodName = cleanHodName(settings.hodName, 'Fachleiter');
  const grades = (plan.gradesContent && plan.gradesContent.length > 0)
    ? plan.gradesContent
    : [];

  const stageDe = getGermanGradeBandLabel(plan.gradeBand);
  const stageAr = getArabicGradeBandLabel(plan.gradeBand);
  const appreciation = getWeeklySecretaryAppreciationText(weekNum, secName);
  const schoolName = settings.schoolName || 'مدرسة الألسن للغات';
  const logoHtml = getReportSchoolLogoHtml(settings, { height: 48 });

  return `<!DOCTYPE html>
<html dir="ltr" lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wochenplan_Woche_${weekNum}_${encodeURIComponent(plan.gradeBand)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-family: 'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: #ffffff;
      line-height: 1.4;
      font-size: 10pt;
      -webkit-font-smoothing: antialiased;
    }
    .page-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 4px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-title h1 {
      margin: 0;
      font-size: 16pt;
      color: #0369a1;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header-title p {
      margin: 2px 0 0;
      font-size: 10pt;
      color: #475569;
      font-weight: 600;
    }
    .flag-badge {
      display: flex;
      flex-direction: column;
      width: 38px;
      height: 24px;
      border: 1px solid #0f172a;
      border-radius: 2px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .flag-strip { flex: 1; }
    .flag-black { background-color: #000000; }
    .flag-red { background-color: #dd0000; }
    .flag-gold { background-color: #ffce00; }

    .meta-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 9.5pt;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 7.5pt;
      color: #64748b;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .meta-val {
      font-weight: 700;
      color: #0f172a;
    }

    .plan-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
    }
    .plan-table th {
      background: #0284c7;
      color: #ffffff;
      font-weight: 700;
      font-size: 9pt;
      padding: 8px 10px;
      text-align: left;
      border: 1px solid #0284c7;
    }
    .plan-table td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      font-size: 9pt;
      vertical-align: top;
    }
    .plan-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .grade-badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid #bae6fd;
      font-size: 9pt;
      white-space: nowrap;
    }
    .content-box {
      font-size: 8.5pt;
      color: #1e293b;
      line-height: 1.35;
    }
    .ha-badge {
      color: #0f766e;
      font-weight: 600;
      background: #ccfbf1;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
    }
    .quiz-badge {
      color: #6b21a8;
      font-weight: 700;
      background: #f3e8ff;
      border: 1px solid #e9d5ff;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
    }

    .appreciation-card {
      background: #fffbeb;
      border: 1.5px solid #fde68a;
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 16px;
      margin-bottom: 16px;
      text-align: center;
    }
    .appreciation-de {
      font-weight: 800;
      font-size: 10pt;
      color: #92400e;
      margin-bottom: 4px;
    }
    .appreciation-en {
      font-size: 8.5pt;
      color: #b45309;
      font-style: italic;
    }

    .footer {
      border-top: 1.5px solid #cbd5e1;
      padding-top: 12px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 9pt;
    }
    .signature-block {
      text-align: right;
      font-weight: bold;
    }
    .signature-title {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 2px;
    }

    .print-actions-bar {
      position: fixed;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
      z-index: 9999;
      background: #ffffff;
      padding: 6px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #cbd5e1;
    }
    .btn-print {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 9pt;
      cursor: pointer;
    }
    .btn-close {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 9pt;
      cursor: pointer;
    }
    @media print {
      .print-actions-bar { display: none !important; }
      body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-actions-bar">
    <button class="btn-print" onclick="window.print()">🖨️ طباعة / حفظ كـ PDF</button>
    <button class="btn-close" onclick="window.close()">إغلاق</button>
  </div>

  <div class="page-container">
    <div class="header">
      <div class="header-left">
        ${logoHtml}
        <div class="flag-badge">
          <div class="flag-strip flag-black"></div>
          <div class="flag-strip flag-red"></div>
          <div class="flag-strip flag-gold"></div>
        </div>
        <div class="header-title">
          <h1>📌 Wochenplan - Deutschabteilung</h1>
          <p>${schoolName} | ${stageDe} - ${stageAr}</p>
        </div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 14pt; font-weight: 800; color: #0284c7;">Woche ${weekNum}</span>
      </div>
    </div>

    <div class="meta-bar">
      <div class="meta-item">
        <span class="meta-label">Schulwoche / الأسبوع</span>
        <span class="meta-val">Woche ${weekNum}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Stufe / المرحلة</span>
        <span class="meta-val">${plan.gradeBand}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Sekretärin / السكرتيرة</span>
        <span class="meta-val">${secName ? `Frau ${secName}` : '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Fachleiter / رئيس القسم</span>
        <span class="meta-val">Herr ${hodName}</span>
      </div>
    </div>

    <table class="plan-table">
      <thead>
        <tr>
          <th style="width: 14%;">Klasse (الصف)</th>
          <th style="width: 28%;">Stunde 1 (S.1)</th>
          <th style="width: 28%;">Stunde 2 (S.2)</th>
          <th style="width: 16%;">Hausaufgabe (H.A)</th>
          <th style="width: 14%;">Quiz / Hinweis</th>
        </tr>
      </thead>
      <tbody>
        ${grades.map((g, idx) => {
          const gName = getGermanGradeName(g.gradeName, plan.gradeBand, idx);
          const note = g.quiz || g.hinweis;
          const hasNote = note && note !== 'Kein Quiz / Hinweis' && note !== 'Kein Quiz' && note.trim() !== '';

          return `
          <tr>
            <td>
              <span class="grade-badge">📚 ${gName}</span>
            </td>
            <td>
              <div class="content-box">
                ${g.s1 ? g.s1.replace(/\n/g, '<br/>') : '<span style="color:#94a3b8;">—</span>'}
              </div>
            </td>
            <td>
              <div class="content-box">
                ${g.s2 ? g.s2.replace(/\n/g, '<br/>') : '<span style="color:#94a3b8;">—</span>'}
              </div>
            </td>
            <td>
              ${g.ha ? `<span class="ha-badge">${g.ha}</span>` : '<span style="color:#94a3b8;">—</span>'}
            </td>
            <td>
              ${hasNote ? `<span class="quiz-badge">${note}</span>` : '<span style="color:#94a3b8;">Kein Quiz</span>'}
            </td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <div class="appreciation-card">
      <div class="appreciation-de">${appreciation.de}</div>
      <div class="appreciation-en">${appreciation.en}</div>
    </div>

    <div class="footer">
      <div>
        <strong>Deutschabteilung / German Department</strong><br/>
        <span style="font-size: 8pt; color: #64748b;">Erstellt am: ${new Date().toLocaleDateString('de-DE')}</span>
      </div>
      <div class="signature-block">
        <div>Mit freundlichen Grüßen,</div>
        <div style="font-size: 11pt; color: #0369a1; margin-top: 2px;">Herr ${hodName}</div>
        <div class="signature-title">Fachleiter für Deutsch (Head of German Department)</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      // Auto-trigger print dialog after slight render pause
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;
}

/**
 * Generates unified printable & PDF-ready HTML for ALL STAGES in a single consolidated master table
 */
export function generateAllWeeklyPlansCombinedTableHtml(
  plans: WeeklyPlanRecord[],
  settings: SchoolSettings,
  weekNum: number
): string {
  const hodName = cleanHodName(settings.hodName, 'Fachleiter');
  const schoolName = settings.schoolName || 'مدرسة الألسن للغات';
  const logoHtml = getReportSchoolLogoHtml(settings, { height: 44 });

  // Order stage bands logically: 1-3, 4-6, 7-9, 10-12
  const sortedPlans = [...plans].sort((a, b) => {
    const getOrder = (band: string) => {
      if (band.includes('1–3') || band.includes('1-3')) return 1;
      if (band.includes('4–6') || band.includes('4-6')) return 2;
      if (band.includes('7–9') || band.includes('7-9')) return 3;
      if (band.includes('10–12') || band.includes('10-12')) return 4;
      return 5;
    };
    return getOrder(a.gradeBand) - getOrder(b.gradeBand);
  });

  return `<!DOCTYPE html>
<html dir="ltr" lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gesamter_Wochenplan_Woche_${weekNum}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-family: 'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: #ffffff;
      line-height: 1.35;
      font-size: 8.5pt;
      -webkit-font-smoothing: antialiased;
    }
    .page-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 2px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #0284c7;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-title h1 {
      margin: 0;
      font-size: 14pt;
      color: #0369a1;
      font-weight: 800;
      letter-spacing: -0.3px;
    }
    .header-title p {
      margin: 1px 0 0;
      font-size: 9pt;
      color: #475569;
      font-weight: 600;
    }
    .flag-badge {
      display: flex;
      flex-direction: column;
      width: 32px;
      height: 20px;
      border: 1px solid #0f172a;
      border-radius: 2px;
      overflow: hidden;
    }
    .flag-strip { flex: 1; }
    .flag-black { background-color: #000000; }
    .flag-red { background-color: #dd0000; }
    .flag-gold { background-color: #ffce00; }

    .meta-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 6px 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      font-size: 8.5pt;
      font-weight: bold;
    }

    .master-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      font-size: 8.5pt;
    }
    .master-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      padding: 6px 8px;
      text-align: left;
      border: 1px solid #334155;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .master-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 7px;
      vertical-align: top;
    }
    .stage-row-header {
      background: #e2e8f0;
      font-weight: 800;
      color: #1e293b;
      padding: 5px 8px;
      font-size: 8.5pt;
    }
    .grade-title-cell {
      font-weight: 700;
      color: #0369a1;
      white-space: nowrap;
      background: #f8fafc;
    }
    .lesson-content {
      line-height: 1.3;
      color: #0f172a;
      font-size: 8pt;
    }
    .ha-tag {
      color: #0f766e;
      font-weight: 600;
      background: #f0fdfa;
      padding: 1px 4px;
      border-radius: 3px;
      display: inline-block;
      font-size: 8pt;
    }
    .quiz-tag {
      color: #7e22ce;
      font-weight: 700;
      background: #faf5ff;
      padding: 1px 4px;
      border-radius: 3px;
      display: inline-block;
      font-size: 8pt;
    }

    .footer {
      border-top: 1.5px solid #cbd5e1;
      padding-top: 8px;
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      color: #475569;
    }

    .print-actions-bar {
      position: fixed;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
      z-index: 9999;
      background: #ffffff;
      padding: 6px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #cbd5e1;
    }
    .btn-print {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 9pt;
      cursor: pointer;
    }
    .btn-close {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 9pt;
      cursor: pointer;
    }
    @media print {
      .print-actions-bar { display: none !important; }
      body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-actions-bar">
    <button class="btn-print" onclick="window.print()">🖨️ طباعة الجدول المجمع / حفظ كـ PDF</button>
    <button class="btn-close" onclick="window.close()">إغلاق</button>
  </div>

  <div class="page-container">
    <div class="header">
      <div class="header-left">
        ${logoHtml}
        <div class="flag-badge">
          <div class="flag-strip flag-black"></div>
          <div class="flag-strip flag-red"></div>
          <div class="flag-strip flag-gold"></div>
        </div>
        <div class="header-title">
          <h1>📌 Gesamter Wochenplan - Deutschabteilung (Alle Klassen 1–12)</h1>
          <p>${schoolName} | Schuljahr: ${settings.academicYear || '2025/2026'}</p>
        </div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 13pt; font-weight: 800; color: #0284c7; background: #e0f2fe; padding: 3px 10px; border-radius: 6px;">
          🗓️ Schulwoche ${weekNum}
        </span>
      </div>
    </div>

    <div class="meta-bar">
      <span>🏫 <strong>Fach:</strong> Deutsch als 2. Fremdsprache</span>
      <span>👨‍🏫 <strong>Fachleiter für Deutsch:</strong> Herr ${hodName}</span>
      <span>📅 <strong>Stand:</strong> ${new Date().toLocaleDateString('de-DE')}</span>
      <span>📊 <strong>Stufen:</strong> 4 Stufen (12 Klassen)</span>
    </div>

    <table class="master-table">
      <thead>
        <tr>
          <th style="width: 14%;">Stufe / Phase</th>
          <th style="width: 11%;">Klasse (الصف)</th>
          <th style="width: 27%;">Stunde 1 (S.1)</th>
          <th style="width: 27%;">Stunde 2 (S.2)</th>
          <th style="width: 11%;">Hausaufgabe (H.A)</th>
          <th style="width: 10%;">Quiz / Hinweis</th>
        </tr>
      </thead>
      <tbody>
        ${sortedPlans.map(plan => {
          const sec = getSecretaryForGradeBand(plan.gradeBand, settings, plan.secretaryName, plan.secretaryPhone);
          const secName = cleanSecretaryName(sec.name);
          const stageDe = getGermanGradeBandLabel(plan.gradeBand);
          const grades = (plan.gradesContent && plan.gradesContent.length > 0)
            ? plan.gradesContent
            : [];

          return `
            <tr>
              <td colspan="6" class="stage-row-header">
                🏛️ <strong>${stageDe}</strong> 
                ${secName ? `<span style="font-weight: normal; color: #475569; margin-left: 8px;">(Sekretärin: Frau ${secName})</span>` : ''}
              </td>
            </tr>
            ${grades.map((g, idx) => {
              const gName = getGermanGradeName(g.gradeName, plan.gradeBand, idx);
              const note = g.quiz || g.hinweis;
              const hasNote = note && note !== 'Kein Quiz / Hinweis' && note !== 'Kein Quiz' && note.trim() !== '';

              return `
                <tr>
                  <td style="color: #64748b; font-size: 7.5pt; font-weight: 600;">
                    ${plan.gradeBand}
                  </td>
                  <td class="grade-title-cell">
                    📚 ${gName}
                  </td>
                  <td>
                    <div class="lesson-content">
                      ${g.s1 ? g.s1.replace(/\n/g, '<br/>') : '<span style="color:#94a3b8;">—</span>'}
                    </div>
                  </td>
                  <td>
                    <div class="lesson-content">
                      ${g.s2 ? g.s2.replace(/\n/g, '<br/>') : '<span style="color:#94a3b8;">—</span>'}
                    </div>
                  </td>
                  <td>
                    ${g.ha ? `<span class="ha-tag">${g.ha}</span>` : '<span style="color:#94a3b8;">—</span>'}
                  </td>
                  <td>
                    ${hasNote ? `<span class="quiz-tag">${note}</span>` : '<span style="color:#94a3b8; font-size:7.5pt;">—</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          `;
        }).join('')}
      </tbody>
    </table>

    <div class="footer">
      <div>
        <strong>Deutschabteilung / German Department</strong> — Alle Rechte vorbehalten
      </div>
      <div style="font-weight: bold; color: #0f172a;">
        Fachleiter: <span style="color: #0369a1;">Herr ${hodName}</span>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;
}

/**
 * Triggers Print / PDF dialog for a Single Stage Plan
 */
export function printSingleWeeklyPlan(
  plan: WeeklyPlanRecord,
  settings: SchoolSettings,
  weekNum: number
) {
  const html = generateSingleWeeklyPlanHtml(plan, settings, weekNum);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print error:', e);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 400);
    }
  }
}

/**
 * Triggers Print / PDF dialog for ALL Stages Combined in a single Master Table
 */
export function printAllWeeklyPlansCombinedTable(
  plans: WeeklyPlanRecord[],
  settings: SchoolSettings,
  weekNum: number
) {
  const html = generateAllWeeklyPlansCombinedTableHtml(plans, settings, weekNum);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print error:', e);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 400);
    }
  }
}

/**
 * Directly downloads Single Stage Weekly Plan as a crisp, high-resolution PDF file
 */
export async function downloadSingleWeeklyPlanPdf(
  plan: WeeklyPlanRecord,
  settings: SchoolSettings,
  weekNum: number
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const sec = getSecretaryForGradeBand(plan.gradeBand, settings, plan.secretaryName, plan.secretaryPhone);
    const secName = cleanSecretaryName(sec.name);
    const hodName = cleanHodName(settings.hodName, 'Fachleiter');
    const grades = (plan.gradesContent && plan.gradesContent.length > 0)
      ? plan.gradesContent
      : [];

    const stageDe = getGermanGradeBandLabel(plan.gradeBand);
    const stageAr = getArabicGradeBandLabel(plan.gradeBand);
    const appreciation = getWeeklySecretaryAppreciationText(weekNum, secName);
    const schoolName = settings.schoolName || 'مدرسة الألسن للغات';
    const logoHtml = getReportSchoolLogoHtml(settings, { height: 48 });

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '24px';
    container.style.fontFamily = "'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    container.style.color = '#0f172a';
    container.style.boxSizing = 'border-box';
    container.style.zIndex = '-9999';

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${logoHtml}
          <div style="display: flex; flex-direction: column; width: 36px; height: 22px; border: 1px solid #0f172a; border-radius: 2px; overflow: hidden;">
            <div style="flex: 1; background-color: #000000;"></div>
            <div style="flex: 1; background-color: #dd0000;"></div>
            <div style="flex: 1; background-color: #ffce00;"></div>
          </div>
          <div>
            <h1 style="margin: 0; font-size: 16pt; color: #0369a1; font-weight: 800; letter-spacing: -0.5px;">📌 Wochenplan - Deutschabteilung</h1>
            <p style="margin: 2px 0 0; font-size: 10pt; color: #475569; font-weight: 600;">${schoolName} | ${stageDe} - ${stageAr}</p>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 13pt; font-weight: 800; color: #0284c7; background: #e0f2fe; padding: 4px 10px; border-radius: 6px;">Woche ${weekNum}</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 9.5pt;">
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Schulwoche / الأسبوع</div>
          <div style="font-weight: 700; color: #0f172a;">Woche ${weekNum}</div>
        </div>
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Stufe / المرحلة</div>
          <div style="font-weight: 700; color: #0f172a;">${plan.gradeBand}</div>
        </div>
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Sekretärin / السكرتيرة</div>
          <div style="font-weight: 700; color: #0f172a;">${secName ? `Frau ${secName}` : '—'}</div>
        </div>
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Fachleiter / رئيس القسم</div>
          <div style="font-weight: 700; color: #0f172a;">Herr ${hodName}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 9pt;">
        <thead>
          <tr style="background: #0284c7; color: #ffffff;">
            <th style="width: 14%; border: 1px solid #0284c7; padding: 8px 10px; text-align: left; font-weight: 700;">Klasse (الصف)</th>
            <th style="width: 28%; border: 1px solid #0284c7; padding: 8px 10px; text-align: left; font-weight: 700;">Stunde 1 (S.1)</th>
            <th style="width: 28%; border: 1px solid #0284c7; padding: 8px 10px; text-align: left; font-weight: 700;">Stunde 2 (S.2)</th>
            <th style="width: 16%; border: 1px solid #0284c7; padding: 8px 10px; text-align: left; font-weight: 700;">Hausaufgabe (H.A)</th>
            <th style="width: 14%; border: 1px solid #0284c7; padding: 8px 10px; text-align: left; font-weight: 700;">Quiz / Hinweis</th>
          </tr>
        </thead>
        <tbody>
          ${grades.map((g, idx) => {
            const gName = getGermanGradeName(g.gradeName, plan.gradeBand, idx);
            const note = g.quiz || g.hinweis;
            const hasNote = note && note !== 'Kein Quiz / Hinweis' && note !== 'Kein Quiz' && note.trim() !== '';
            const bgRow = idx % 2 === 1 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;';

            return `
            <tr style="${bgRow}">
              <td style="border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top;">
                <span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 800; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd; font-size: 9pt;">📚 ${gName}</span>
              </td>
              <td style="border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; font-size: 8.5pt; color: #1e293b; line-height: 1.35;">
                ${g.s1 ? g.s1.replace(/\n/g, '<br/>') : '<span style="color:#94a3b8;">—</span>'}
              </td>
              <td style="border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; font-size: 8.5pt; color: #1e293b; line-height: 1.35;">
                ${g.s2 ? g.s2.replace(/\n/g, '<br/>') : '<span style="color:#94a3b8;">—</span>'}
              </td>
              <td style="border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top;">
                ${g.ha ? `<span style="color: #0f766e; font-weight: 600; background: #ccfbf1; padding: 2px 6px; border-radius: 4px; display: inline-block;">${g.ha}</span>` : '<span style="color:#94a3b8;">—</span>'}
              </td>
              <td style="border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top;">
                ${hasNote ? `<span style="color: #6b21a8; font-weight: 700; background: #f3e8ff; border: 1px solid #e9d5ff; padding: 2px 6px; border-radius: 4px; display: inline-block;">${note}</span>` : '<span style="color:#94a3b8;">Kein Quiz</span>'}
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-top: 14px; margin-bottom: 14px; text-align: center;">
        <div style="font-weight: 800; font-size: 10pt; color: #92400e; margin-bottom: 4px;">${appreciation.de}</div>
        <div style="font-size: 8.5pt; color: #b45309; font-style: italic;">${appreciation.en}</div>
      </div>

      <div style="border-top: 1.5px solid #cbd5e1; padding-top: 10px; margin-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9pt;">
        <div>
          <strong>Deutschabteilung / German Department</strong><br/>
          <span style="font-size: 8pt; color: #64748b;">Erstellt am: ${new Date().toLocaleDateString('de-DE')}</span>
        </div>
        <div style="text-align: right; font-weight: bold;">
          <div>Mit freundlichen Grüßen,</div>
          <div style="font-size: 11pt; color: #0369a1; margin-top: 2px;">Herr ${hodName}</div>
          <div style="font-size: 8.5pt; color: #64748b; margin-top: 2px;">Fachleiter für Deutsch (Head of German Department)</div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 80));

    const canvas = await html2canvas(container, {
      scale: 2.2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      width: container.offsetWidth,
      height: container.offsetHeight
    });

    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const finalHeight = Math.min(imgHeight, pageHeight);

    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, finalHeight, undefined, 'FAST');
    const safeStage = plan.gradeBand.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
    const filename = `Wochenplan_Woche_${weekNum}_${safeStage}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({ title: `Wochenplan Woche ${weekNum}`, url: savedFile.uri });
    } else {
      pdf.save(filename);
    }

    return { success: true, filename };
  } catch (error: any) {
    console.error('Error downloading weekly plan PDF:', error);
    return { success: false, error: error?.message || 'Download failed' };
  }
}

/**
 * Directly downloads Consolidated Master Weekly Plan for All Stages as a landscape PDF file
 */
export async function downloadAllWeeklyPlansCombinedPdf(
  plans: WeeklyPlanRecord[],
  settings: SchoolSettings,
  weekNum: number
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const hodName = cleanHodName(settings.hodName, 'Fachleiter');
    const schoolName = settings.schoolName || 'مدرسة الألسن للغات';
    const logoHtml = getReportSchoolLogoHtml(settings, { height: 44 });

    const sortedPlans = [...plans].sort((a, b) => {
      const getOrder = (band: string) => {
        if (band.includes('1–3') || band.includes('1-3')) return 1;
        if (band.includes('4–6') || band.includes('4-6')) return 2;
        if (band.includes('7–9') || band.includes('7-9')) return 3;
        if (band.includes('10–12') || band.includes('10-12')) return 4;
        return 5;
      };
      return getOrder(a.gradeBand) - getOrder(b.gradeBand);
    });

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1120px'; // A4 landscape width standard
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '20px';
    container.style.fontFamily = "'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    container.style.color = '#0f172a';
    container.style.boxSizing = 'border-box';
    container.style.zIndex = '-9999';

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #0284c7; padding-bottom: 8px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${logoHtml}
          <div style="display: flex; flex-direction: column; width: 32px; height: 20px; border: 1px solid #0f172a; border-radius: 2px; overflow: hidden;">
            <div style="flex: 1; background-color: #000000;"></div>
            <div style="flex: 1; background-color: #dd0000;"></div>
            <div style="flex: 1; background-color: #ffce00;"></div>
          </div>
          <div>
            <h1 style="margin: 0; font-size: 14pt; color: #0369a1; font-weight: 800; letter-spacing: -0.3px;">📌 Gesamter Wochenplan - Deutschabteilung (Alle Klassen 1–12)</h1>
            <p style="margin: 1px 0 0; font-size: 9pt; color: #475569; font-weight: 600;">${schoolName} | Schuljahr: ${settings.academicYear || '2025/2026'}</p>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 13pt; font-weight: 800; color: #0284c7; background: #e0f2fe; padding: 3px 10px; border-radius: 6px;">
            🗓️ Schulwoche ${weekNum}
          </span>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; background: #f0f9ff; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 8.5pt; font-weight: bold;">
        <span>🏫 <strong>Fach:</strong> Deutsch als 2. Fremdsprache</span>
        <span>👨‍🏫 <strong>Fachleiter für Deutsch:</strong> Herr ${hodName}</span>
        <span>📅 <strong>Stand:</strong> ${new Date().toLocaleDateString('de-DE')}</span>
        <span>📊 <strong>Stufen:</strong> 4 Stufen (12 Klassen)</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 8.5pt;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="width: 14%; border: 1px solid #334155; padding: 6px 8px; text-align: left; font-size: 8pt; font-weight: 700;">Stufe / Phase</th>
            <th style="width: 11%; border: 1px solid #334155; padding: 6px 8px; text-align: left; font-size: 8pt; font-weight: 700;">Klasse (الصف)</th>
            <th style="width: 27%; border: 1px solid #334155; padding: 6px 8px; text-align: left; font-size: 8pt; font-weight: 700;">Stunde 1 (S.1)</th>
            <th style="width: 27%; border: 1px solid #334155; padding: 6px 8px; text-align: left; font-size: 8pt; font-weight: 700;">Stunde 2 (S.2)</th>
            <th style="width: 11%; border: 1px solid #334155; padding: 6px 8px; text-align: left; font-size: 8pt; font-weight: 700;">Hausaufgabe (H.A)</th>
            <th style="width: 10%; border: 1px solid #334155; padding: 6px 8px; text-align: left; font-size: 8pt; font-weight: 700;">Quiz / Hinweis</th>
          </tr>
        </thead>
        <tbody>
          ${sortedPlans.map(p => {
            const sec = getSecretaryForGradeBand(p.gradeBand, settings, p.secretaryName, p.secretaryPhone);
            const secName = cleanSecretaryName(sec.name);
            const stageDe = getGermanGradeBandLabel(p.gradeBand);
            const grades = (p.gradesContent && p.gradesContent.length > 0)
              ? p.gradesContent
              : [];

            return `
              <tr>
                <td colspan="6" style="background: #e2e8f0; font-weight: 800; color: #1e293b; padding: 5px 8px; font-size: 8.5pt; border: 1px solid #cbd5e1;">
                  🏛️ <strong>${stageDe}</strong> 
                  ${secName ? `<span style="font-weight: normal; color: #475569; margin-left: 8px;">(Sekretärin: Frau ${secName})</span>` : ''}
                </td>
              </tr>
              ${grades.map((g, idx) => {
                const gName = getGermanGradeName(g.gradeName, p.gradeBand, idx);
                const note = g.quiz || g.hinweis;
                const hasNote = note && note !== 'Kein Quiz / Hinweis' && note !== 'Kein Quiz' && note.trim() !== '';

                return `
                  <tr>
                    <td style="color: #64748b; font-size: 7.5pt; font-weight: 600; border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top;">
                      ${p.gradeBand}
                    </td>
                    <td style="font-weight: 700; color: #0369a1; white-space: nowrap; background: #f8fafc; border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top;">
                      📚 ${gName}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; line-height: 1.3; color: #0f172a; font-size: 8pt;">
                      ${g.s1 ? g.s1.replace(/\n/g, '<br/>') : '<span style="color:#94a3b8;">—</span>'}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; line-height: 1.3; color: #0f172a; font-size: 8pt;">
                      ${g.s2 ? g.s2.replace(/\n/g, '<br/>') : '<span style="color:#94a3b8;">—</span>'}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top;">
                      ${g.ha ? `<span style="color: #0f766e; font-weight: 600; background: #f0fdfa; padding: 1px 4px; border-radius: 3px; display: inline-block; font-size: 8pt;">${g.ha}</span>` : '<span style="color:#94a3b8;">—</span>'}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top;">
                      ${hasNote ? `<span style="color: #7e22ce; font-weight: 700; background: #faf5ff; padding: 1px 4px; border-radius: 3px; display: inline-block; font-size: 8pt;">${note}</span>` : '<span style="color:#94a3b8; font-size:7.5pt;">—</span>'}
                    </td>
                  </tr>
                `;
              }).join('')}
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="border-top: 1.5px solid #cbd5e1; padding-top: 8px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 8pt; color: #475569;">
        <div>
          <strong>Deutschabteilung / German Department</strong> — Alle Rechte vorbehalten
        </div>
        <div style="font-weight: bold; color: #0f172a;">
          Fachleiter: <span style="color: #0369a1;">Herr ${hodName}</span>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 80));

    const canvas = await html2canvas(container, {
      scale: 2.2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      width: container.offsetWidth,
      height: container.offsetHeight
    });

    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const finalHeight = Math.min(imgHeight, pageHeight);

    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, finalHeight, undefined, 'FAST');
    const filename = `Gesamter_Wochenplan_Woche_${weekNum}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({ title: `Gesamter Wochenplan Woche ${weekNum}`, url: savedFile.uri });
    } else {
      pdf.save(filename);
    }

    return { success: true, filename };
  } catch (error: any) {
    console.error('Error downloading combined weekly plan PDF:', error);
    return { success: false, error: error?.message || 'Download failed' };
  }
}

