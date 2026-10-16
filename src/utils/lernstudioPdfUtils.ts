import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LernstudioSet } from '../types/lernstudio';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface WorksheetOptions {
  schoolName?: string;
  teacherName?: string;
  gradeName?: string;
  subjectName?: string;
  dateStr?: string;
  includeAnswerKey?: boolean;
  includeVocabularyTable?: boolean;
  includeMissingLetters?: boolean;
  includeSentenceBuilder?: boolean;
  includeMultipleChoice?: boolean;
}

export async function generateLernstudioWorksheetPdf(
  set: LernstudioSet,
  options: WorksheetOptions = {}
): Promise<jsPDF> {
  const isTeacher = Boolean(options.includeAnswerKey);

  // 1. Create a visible-to-layout off-screen container for crisp A4 DOM rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '99999';
  container.style.opacity = '1';
  container.style.width = '794px'; // A4 width at 96 DPI
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.padding = '32px';
  container.style.boxSizing = 'border-box';
  container.style.lineHeight = '1.5';

  const school = options.schoolName || 'Glück Lernstudio';
  const teacher = options.teacherName || 'الأستاذ المعلم';
  const grade = options.gradeName || set.grade || 'جميع الصفوف';
  const subject = options.subjectName || 'اللغة الألمانية';
  const dateStr = options.dateStr || new Date().toLocaleDateString('de-DE');

  // Build HTML Content with embedded Cairo Google Font & strict Arabic/German Bidi isolation
  let html = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
      
      * {
        box-sizing: border-box !important;
      }
      
      .worksheet-root {
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: 13px !important;
        width: 100% !important;
      }

      .ar-text {
        direction: rtl !important;
        text-align: right !important;
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
        unicode-bidi: isolate !important;
      }

      .de-text {
        direction: ltr !important;
        text-align: left !important;
        font-family: 'Segoe UI', Arial, sans-serif !important;
      }

      .header-table {
        width: 100%;
        border-collapse: collapse;
        border: 2px solid #000000;
        margin-bottom: 20px;
      }

      .header-table td {
        padding: 10px 14px;
        vertical-align: top;
      }

      .section-title {
        font-size: 14px !important;
        font-weight: 800 !important;
        border-bottom: 2px solid #000000;
        padding-bottom: 4px;
        margin-top: 0;
        margin-bottom: 12px;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }

      .data-table th, .data-table td {
        border: 1px solid #000000;
        padding: 8px 10px;
        font-size: 12px;
      }

      .data-table th {
        background-color: #f2f2f2;
        font-weight: 700;
      }
    </style>

    <div class="worksheet-root">
      <!-- HEADER BOX -->
      <table class="header-table">
        <tr>
          <td style="width: 55%; border-right: 1px solid #000000;" class="de-text">
            <div style="font-size: 16px; font-weight: 800; margin-bottom: 4px;">${school}</div>
            <div><strong>Fach:</strong> ${subject} (${set.level})</div>
            <div><strong>Thema:</strong> ${set.title || set.topic}</div>
            <div><strong>Datum:</strong> ${dateStr}</div>
          </td>
          <td style="width: 45%;" class="ar-text" dir="rtl">
            <div style="font-size: 13px; font-weight: 700; margin-bottom: 6px;">الاسم: ________________________</div>
            <div><strong>الصف الدراسية:</strong> ${grade}</div>
            <div><strong>المعلم:</strong> ${teacher}</div>
          </td>
        </tr>
      </table>

      <!-- WORKSHEET TITLE BANNER -->
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #000; padding-bottom: 10px;">
        <h1 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">
          ${isTeacher ? 'ARBEITSBLATT - LÖSUNGSSCHLÜSSEL (نموذج إجابة المدرس)' : `ARBEITSBLATT: ${(set.title || set.topic).toUpperCase()}`}
        </h1>
      </div>
  `;

  // SECTION 1: Wortschatz-Übersicht (Vocabulary List)
  if (options.includeVocabularyTable !== false && set.items.length > 0) {
    html += `
      <div style="margin-bottom: 24px;">
        <div class="section-title ar-text" dir="rtl">
          1. Wortschatz-Übersicht / جدول المفردات والمعاني:
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 25%; text-align: left;" class="de-text">Deutsch (Wort)</th>
              <th style="width: 20%; text-align: left;" class="de-text">Plural</th>
              <th style="width: 30%; text-align: left;" class="de-text">Beispielsatz</th>
              <th style="width: 25%; text-align: right;" class="ar-text" dir="rtl">الترجمة العربية</th>
            </tr>
          </thead>
          <tbody>
    `;

    set.items.forEach((item) => {
      html += `
        <tr>
          <td class="de-text" style="font-weight: 700;">${item.emoji ? item.emoji + ' ' : ''}${item.german}</td>
          <td class="de-text">${item.plural || '-'}</td>
          <td class="de-text">${item.exampleSentenceGerman || '-'}</td>
          <td class="ar-text" dir="rtl" style="font-weight: 600;">${item.arabic}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  // SECTION 2: Ergänze die fehlenden Buchstaben (Missing Letters)
  if (options.includeMissingLetters !== false && set.items.length > 0) {
    html += `
      <div style="margin-bottom: 24px;">
        <div class="section-title ar-text" dir="rtl">
          2. Ergänze die fehlenden Buchstaben / أكمل الحرف الناقص:
        </div>
        <div style="font-size: 13px; line-height: 1.8;">
    `;

    set.items.forEach((item, idx) => {
      const missingPrompt = item.missingLetterWord || item.german.replace(/[aeiouAEIOU]/g, '_');
      if (isTeacher) {
        html += `
          <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
            <div class="de-text">
              <strong>${idx + 1}) ${item.german}</strong>
              <span style="color: #008000; font-weight: bold; margin-left: 12px;">[Lösung: ${missingPrompt}]</span>
            </div>
            <div class="ar-text" dir="rtl" style="color: #555;">(${item.arabic})</div>
          </div>
        `;
      } else {
        html += `
          <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dotted #ccc; padding-bottom: 4px;">
            <div class="de-text">
              <strong>${idx + 1})</strong> <span style="font-family: monospace; font-size: 15px; letter-spacing: 2px; font-weight: bold;">${missingPrompt}</span>
              <span style="margin-left: 16px; color: #888;">_____________________</span>
            </div>
            <div class="ar-text" dir="rtl" style="color: #444; font-weight: 600;">(${item.arabic})</div>
          </div>
        `;
      }
    });

    html += `
        </div>
      </div>
    `;
  }

  // SECTION 3: Bringe die Satzteile in die richtige Reihenfolge (Sentence Builder)
  if (options.includeSentenceBuilder !== false) {
    const itemsWithSentence = set.items.filter((i) => i.sentence4Elements || i.exampleSentenceGerman);
    if (itemsWithSentence.length > 0) {
      html += `
        <div style="margin-bottom: 24px;">
          <div class="section-title ar-text" dir="rtl">
            3. Bringe die Satzteile in die richtige Reihenfolge / رتب أجزاء الجملة لتكوين جملة مفيدة:
          </div>
          <div style="font-size: 13px; line-height: 1.8;">
      `;

      itemsWithSentence.forEach((item, idx) => {
        const elements = item.sentence4Elements || [item.german, 'ist', 'sehr', 'gut'];
        const shuffled = [...elements].sort((a, b) => a.localeCompare(b));

        html += `
          <div style="margin-bottom: 14px; padding: 6px; background-color: #fafafa; border: 1px solid #ddd; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="de-text">
                <strong>${idx + 1}) Satzbausteine:</strong> 
                <span style="background-color: #fff; border: 1px solid #999; padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                  [ ${shuffled.join('   /   ')} ]
                </span>
              </div>
              <div class="ar-text" dir="rtl" style="font-size: 11px; color: #666;">
                (${item.exampleSentenceArabic || item.arabic})
              </div>
            </div>
        `;

        if (isTeacher) {
          html += `
            <div class="de-text" style="color: #008000; font-weight: bold; margin-top: 4px;">
              LÖSUNG: ${item.exampleSentenceGerman || elements.join(' ')}
            </div>
          `;
        } else {
          html += `
            <div class="de-text" style="margin-top: 6px; color: #555;">
              Antwort: ____________________________________________________________________
            </div>
          `;
        }

        html += `</div>`;
      });

      html += `
          </div>
        </div>
      `;
    }
  }

  // Footer
  html += `
      <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #777; border-top: 1px solid #ddd; padding-top: 8px;">
        Glück Lernstudio - Deutsch Arbeitsblatt • Generiert am ${dateStr}
      </div>
    </div>
  `;

  container.innerHTML = html;
  document.body.appendChild(container);

  // Guarantee web fonts (Cairo, Segoe UI) are fully loaded in memory before html2canvas capture
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // continue
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 150));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      onclone: (clonedDoc) => {
        // Remove style blocks containing unparseable CSS v4 variables (oklch) that crash html2canvas
        try {
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach((s) => {
            if (s.textContent && (s.textContent.includes('oklch') || s.textContent.includes('@import'))) {
              if (!s.textContent.includes('Cairo')) {
                s.remove();
              }
            }
          });
        } catch {
          // ignore
        }
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    return pdf;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export async function downloadOrSaveLernstudioWorksheet(
  set: LernstudioSet,
  options: WorksheetOptions = {}
): Promise<void> {
  try {
    const pdf = await generateLernstudioWorksheetPdf(set, options);
    const isTeacher = Boolean(options.includeAnswerKey);
    const cleanTitle = (set.title || set.topic || 'Worksheet').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    const fileName = `Glueck_Worksheet_${cleanTitle}_${isTeacher ? 'TeacherKey' : 'Student'}.pdf`;
    pdf.save(fileName);
  } catch (err) {
    console.error('PDF download error:', err);
    printLernstudioWorksheetDirectly(set, options);
  }
}

/**
 * Direct Print Option: opens a new window with formatted worksheet and print trigger
 */
export function printLernstudioWorksheetDirectly(
  set: LernstudioSet,
  options: WorksheetOptions = {}
): void {
  const isTeacher = Boolean(options.includeAnswerKey);
  const school = options.schoolName || 'Glück Lernstudio';
  const teacher = options.teacherName || 'الأستاذ المعلم';
  const grade = options.gradeName || set.grade || 'جميع الصفوف';
  const subject = options.subjectName || 'اللغة الألمانية';
  const dateStr = options.dateStr || new Date().toLocaleDateString('de-DE');

  const win = window.open('', '_blank');
  if (!win) {
    alert('يرجى السماح بفتح النوافذ المنبثقة (Popups) للطباعة والتحميل');
    return;
  }

  let html = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>Arbeitsblatt - ${set.title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; font-size: 13px; color: #000; margin: 0; padding: 20px; background: #fff; }
        .de-text { direction: ltr; text-align: left; font-family: 'Segoe UI', Arial, sans-serif; }
        .ar-text { direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; }
        .header-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 20px; }
        .header-table td { padding: 10px; vertical-align: top; }
        .section-title { font-size: 14px; font-weight: 800; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 12px; }
        .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .data-table th, .data-table td { border: 1px solid #000; padding: 8px; font-size: 12px; }
        .data-table th { background: #f2f2f2; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="width: 55%; border-left: 1px solid #000;" class="de-text">
            <div style="font-size: 16px; font-weight: 800;">${school}</div>
            <div>Fach: ${subject} (${set.level})</div>
            <div>Thema: ${set.title || set.topic}</div>
            <div>Datum: ${dateStr}</div>
          </td>
          <td style="width: 45%;" class="ar-text">
            <div>الاسم: ________________________</div>
            <div>الصف الدراسية: ${grade}</div>
            <div>المعلم: ${teacher}</div>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 8px;">
        <h1 style="font-size: 18px; margin: 0;">
          ${isTeacher ? 'ARBEITSBLATT - LÖSUNGSSCHLÜSSEL (نموذج إجابة المدرس)' : `ARBEITSBLATT: ${(set.title || set.topic).toUpperCase()}`}
        </h1>
      </div>
  `;

  if (options.includeVocabularyTable !== false && set.items.length > 0) {
    html += `
      <div class="section-title">1. Wortschatz-Übersicht / جدول المفردات والمعاني:</div>
      <table class="data-table">
        <thead>
          <tr>
            <th class="de-text">Deutsch</th>
            <th class="de-text">Plural</th>
            <th class="de-text">Beispielsatz</th>
            <th class="ar-text">الترجمة العربية</th>
          </tr>
        </thead>
        <tbody>
    `;
    set.items.forEach((item) => {
      html += `
        <tr>
          <td class="de-text" style="font-weight: bold;">${item.emoji ? item.emoji + ' ' : ''}${item.german}</td>
          <td class="de-text">${item.plural || '-'}</td>
          <td class="de-text">${item.exampleSentenceGerman || '-'}</td>
          <td class="ar-text" style="font-weight: bold;">${item.arabic}</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
  }

  if (options.includeMissingLetters !== false && set.items.length > 0) {
    html += `<div class="section-title">2. Ergänze die fehlenden Buchstaben / أكمل الحرف الناقص:</div>`;
    set.items.forEach((item, idx) => {
      const missingPrompt = item.missingLetterWord || item.german.replace(/[aeiouAEIOU]/g, '_');
      html += `
        <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
          <div class="de-text"><strong>${idx + 1})</strong> <span style="font-family: monospace; letter-spacing: 2px;">${missingPrompt}</span> ${isTeacher ? `<span style="color: green; font-weight: bold;">[${item.german}]</span>` : '___________'}</div>
          <div class="ar-text">(${item.arabic})</div>
        </div>
      `;
    });
  }

  html += `
    <div style="margin-top: 40px; text-align: center;" class="no-print">
      <button onclick="window.print()" style="padding: 12px 28px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        🖨️ طباعة / حفظ كملف PDF
      </button>
    </div>
    </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // ignore
    }
  }, 600);
}
