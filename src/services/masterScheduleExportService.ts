
import { SchoolSettings, TeacherProfile, AppLanguage, CustomTimedSession } from '../types';
import { calculatePeriodsTimings, getCustomSessionsForPeriod, getUnmatchedCustomSessions } from '../utils/schoolUtils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { sanitizeModernCssColors, dataUrlToBlob } from '../utils/certificateExportUtils';
import { SchoolScheduleExportOptions } from './schoolScheduleExportService';

export async function exportMasterSchedule(
  settings: SchoolSettings,
  profile: TeacherProfile,
  options: SchoolScheduleExportOptions,
  type: 'pdf' | 'image'
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const isRtl = options.language === 'ar' || profile.language === 'ar';
    const tempContainer = createMasterExportDomElement(settings, options, isRtl);
    document.body.appendChild(tempContainer);
    
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 80));

    const canvas = await html2canvas(tempContainer, {
      scale: 2.5,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      width: tempContainer.offsetWidth,
      height: tempContainer.offsetHeight,
      onclone: (clonedDoc) => {
        clonedDoc.documentElement.classList.remove('dark');
        if (clonedDoc.body) {
          clonedDoc.body.classList.remove('dark');
          clonedDoc.body.style.backgroundColor = '#ffffff';
        }
      }
    });

    if (tempContainer && document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }

    const title = options.language === 'ar' ? 'الجدول الموحد' : 'Master Schedule';
    const filenameBase = `Master_Schedule_${Date.now()}`;

    if (type === 'pdf') {
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      const filename = `${filenameBase}.pdf`;
      
      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: pdfBase64,
          directory: Directory.Cache
        });
        await Share.share({ title, url: savedFile.uri });
      } else {
        pdf.save(filename);
      }
      return { success: true, filename };
    } else {
      const format = options.format === 'jpeg' ? 'jpeg' : 'png';
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, 0.98);
      const filename = `${filenameBase}.${format === 'jpeg' ? 'jpg' : 'png'}`;

      if (Capacitor.isNativePlatform()) {
        const base64Data = dataUrl.split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });
        await Share.share({ title, url: savedFile.uri });
      } else {
        const blob = dataUrlToBlob(dataUrl);
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
      return { success: true, filename };
    }
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

function createMasterExportDomElement(
  settings: SchoolSettings,
  options: SchoolScheduleExportOptions,
  isRtl: boolean
): HTMLElement {
  const container = document.createElement('div');
  container.id = `master-export-${Date.now()}`;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '1480px'; 
  container.style.minHeight = '1046px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = isRtl ? "'Cairo', sans-serif" : "sans-serif";
  container.style.direction = isRtl ? 'rtl' : 'ltr';
  container.style.boxSizing = 'border-box';
  container.style.padding = '30px';
  
  const title = document.createElement('h1');
  title.innerText = isRtl ? 'الجدول الأسبوعي الموحد لجميع المعلمين' : 'Unified Weekly Master Schedule';
  title.style.textAlign = 'center';
  title.style.fontSize = '26px';
  title.style.fontWeight = '900';
  title.style.color = '#0f172a';
  title.style.marginBottom = '16px';
  container.appendChild(title);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.tableLayout = 'fixed';
  table.style.border = '2px solid #0f172a';
  
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  
  const thTime = document.createElement('th');
  thTime.innerText = isRtl ? 'الحصة / التوقيت' : 'Period / Time';
  thTime.style.border = '2.5px solid #000000';
  thTime.style.padding = '10px 4px';
  thTime.style.backgroundColor = '#0f172a';
  thTime.style.color = '#ffffff';
  thTime.style.fontSize = '18px';
  thTime.style.fontWeight = '900';
  thTime.style.width = '130px';
  trHead.appendChild(thTime);

  const teachers = settings.teachers || [];
  teachers.forEach(t => {
    const th = document.createElement('th');
    th.innerText = t.name;
    th.style.border = '2.5px solid #000000';
    th.style.padding = '10px 4px';
    th.style.backgroundColor = '#0f172a';
    th.style.color = '#ffffff';
    th.style.fontSize = '18px';
    th.style.fontWeight = '900';
    th.style.overflow = 'hidden';
    th.style.wordBreak = 'break-word';
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const days = ['0','1','2','3','4'];
  const dayNames = isRtl ? ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'] : ['Sun','Mon','Tue','Wed','Thu'];
  
  const periods = calculatePeriodsTimings(settings.periodSettings);

  days.forEach((day, dIdx) => {
    const dayTr = document.createElement('tr');
    const dayTd = document.createElement('td');
    dayTd.colSpan = teachers.length + 1;
    dayTd.innerText = dayNames[dIdx];
    dayTd.style.backgroundColor = '#0f172a';
    dayTd.style.color = '#ffffff';
    dayTd.style.fontWeight = '900';
    dayTd.style.fontSize = '26px';
    dayTd.style.textAlign = 'center';
    dayTd.style.padding = '10px';
    dayTd.style.border = '2.5px solid #000000';
    dayTr.appendChild(dayTd);
    tbody.appendChild(dayTr);

    // Standard Period Rows
    periods.forEach(p => {
      const tr = document.createElement('tr');
      const tdTime = document.createElement('td');
      tdTime.innerHTML = `
        <div style="font-weight: 900; font-size: 20px; color: #000000; margin-bottom: 3px; line-height: 1;">${isRtl ? 'حصة ' : 'P'}${p.periodNumber}</div>
        <div style="font-weight: 900; font-size: 13px; color: #000000; font-family: 'Cairo', monospace, sans-serif; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; border: 1.5px solid #94a3b8; display: inline-block; white-space: nowrap;">${p.startTime} - ${p.endTime}</div>
      `;
      tdTime.style.border = '2px solid #000000';
      tdTime.style.backgroundColor = '#f8fafc';
      tdTime.style.padding = '6px 2px';
      tdTime.style.textAlign = 'center';
      tr.appendChild(tdTime);

      teachers.forEach(t => {
        const td = document.createElement('td');
        td.style.border = '2px solid #000000';
        td.style.padding = '4px 2px';
        td.style.textAlign = 'center';
        td.style.verticalAlign = 'middle';
        td.style.backgroundColor = '#ffffff';
        
        let lessons: any[] = [];
        if (t.id === 'hod') lessons = settings.schedule?.[day] || [];
        else lessons = settings.teacherSchedules?.[t.id]?.[day] || [];
        
        const lesson = lessons.find((l: any) => l.periodNumber === p.periodNumber && (l.className || l.subjectName));
        const matchingCustoms = getCustomSessionsForPeriod(settings.customTimedSessions, day, p.periodNumber, periods, t.id);

        let cellContentHtml = '';

        if (lesson) {
          cellContentHtml += `
            <div style="font-weight: 900; font-size: 24px; color: #000000; line-height: 1.1; margin: 0; letter-spacing: -0.3px;">${lesson.className || ''}</div>
            ${lesson.subjectName ? `<div style="font-weight: 900; font-size: 13px; color: #0f172a; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 3px; display: inline-block;">${lesson.subjectName}</div>` : ''}
          `;
        }

        matchingCustoms.forEach((cs: CustomTimedSession) => {
          cellContentHtml += `
            <div style="margin-top: ${lesson ? '4px' : '0'}; padding: 3px 2px; background: #e0e7ff; border: 1.5px solid #818cf8; border-radius: 5px;">
              <div style="font-weight: 900; font-size: 20px; color: #1e1b4b; line-height: 1.1; margin: 0;">${cs.className || ''}</div>
              <div style="font-weight: 900; font-size: 12px; color: #3730a3; font-family: monospace; margin-top: 2px; display: inline-block;">⏱️ ${cs.startTime}-${cs.endTime}</div>
              ${cs.subjectName ? `<div style="font-weight: 900; font-size: 12px; color: #312e81; background: #ffffff; padding: 1px 5px; border-radius: 3px; border: 1px solid #c7d2fe; margin-top: 2px; display: inline-block;">${cs.subjectName}</div>` : ''}
            </div>
          `;
        });

        td.innerHTML = cellContentHtml;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // Unmatched / Extended Custom Timed Sessions Row for this day if any exist
    const dayUnmatched = getUnmatchedCustomSessions(settings.customTimedSessions, day, periods);
    if (dayUnmatched.length > 0) {
      const customTr = document.createElement('tr');
      const customTdTime = document.createElement('td');
      customTdTime.innerHTML = `
        <div style="font-weight: 900; font-size: 16px; color: #3730a3; margin-bottom: 2px; line-height: 1.1;">⏱️ ${isRtl ? 'مخصص' : 'Custom'}</div>
        <div style="font-weight: 800; font-size: 11px; color: #4338ca;">${isRtl ? 'خارج الحصص' : 'Extended'}</div>
      `;
      customTdTime.style.border = '2px solid #6366f1';
      customTdTime.style.backgroundColor = '#eef2ff';
      customTdTime.style.padding = '6px 2px';
      customTdTime.style.textAlign = 'center';
      customTr.appendChild(customTdTime);

      teachers.forEach(t => {
        const customTd = document.createElement('td');
        customTd.style.border = '2px solid #6366f1';
        customTd.style.padding = '4px 2px';
        customTd.style.textAlign = 'center';
        customTd.style.verticalAlign = 'middle';
        customTd.style.backgroundColor = '#f5f3ff';

        const teacherUnmatched = dayUnmatched.filter(s => s.teacherId === t.id);
        let customCellHtml = '';

        teacherUnmatched.forEach((cs: CustomTimedSession) => {
          customCellHtml += `
            <div style="padding: 3px 2px; background: #e0e7ff; border: 1.5px solid #818cf8; border-radius: 5px; margin-bottom: 3px;">
              <div style="font-weight: 900; font-size: 20px; color: #1e1b4b; line-height: 1.1; margin: 0;">${cs.className || ''}</div>
              <div style="font-weight: 900; font-size: 12px; color: #3730a3; font-family: monospace; margin-top: 2px; display: inline-block;">⏱️ ${cs.startTime}-${cs.endTime}</div>
              ${cs.subjectName ? `<div style="font-weight: 900; font-size: 12px; color: #312e81; background: #ffffff; padding: 1px 5px; border-radius: 3px; border: 1px solid #c7d2fe; margin-top: 2px; display: inline-block;">${cs.subjectName}</div>` : ''}
            </div>
          `;
        });

        customTd.innerHTML = customCellHtml;
        customTr.appendChild(customTd);
      });
      tbody.appendChild(customTr);
    }
  });

  table.appendChild(tbody);
  container.appendChild(table);

  return container;
}
