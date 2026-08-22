
import { SchoolSettings, TeacherProfile, AppLanguage } from '../types';
import { calculatePeriodsTimings } from '../utils/schoolUtils';
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
  container.style.padding = '40px';
  
  const title = document.createElement('h1');
  title.innerText = isRtl ? 'الجدول الأسبوعي الموحد' : 'Unified Weekly Master Schedule';
  title.style.textAlign = 'center';
  title.style.fontSize = '24px';
  title.style.marginBottom = '20px';
  container.appendChild(title);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.tableLayout = 'fixed';
  table.style.fontSize = '9px'; // Tiny font to fit everything on one page "all cleard"
  table.style.border = '1px solid #ccc';
  
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  
  const thTime = document.createElement('th');
  thTime.style.border = '1px solid #ccc';
  thTime.style.padding = '4px';
  thTime.style.backgroundColor = '#f3f4f6';
  thTime.style.width = '60px';
  trHead.appendChild(thTime);

  const teachers = settings.teachers || [];
  teachers.forEach(t => {
    const th = document.createElement('th');
    th.innerText = t.name.split(' ').map((n, i) => i===0 ? n : n.charAt(0)+'.').join(' ');
    th.style.border = '1px solid #ccc';
    th.style.padding = '4px';
    th.style.backgroundColor = '#f3f4f6';
    th.style.overflow = 'hidden';
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
    dayTd.style.backgroundColor = '#e5e7eb';
    dayTd.style.fontWeight = 'bold';
    dayTd.style.textAlign = 'center';
    dayTd.style.padding = '4px';
    dayTd.style.border = '1px solid #ccc';
    dayTr.appendChild(dayTd);
    tbody.appendChild(dayTr);

    periods.forEach(p => {
      const tr = document.createElement('tr');
      const tdTime = document.createElement('td');
      tdTime.innerText = `P${p.periodNumber} 
 ${p.startTime}`;
      tdTime.style.border = '1px solid #ccc';
      tdTime.style.padding = '2px';
      tdTime.style.textAlign = 'center';
      tdTime.style.whiteSpace = 'pre-wrap';
      tr.appendChild(tdTime);

      teachers.forEach(t => {
        const td = document.createElement('td');
        td.style.border = '1px solid #ccc';
        td.style.padding = '2px';
        td.style.textAlign = 'center';
        
        let lessons: any[] = [];
        if (t.id === 'hod') lessons = settings.schedule?.[day] || [];
        else lessons = settings.teacherSchedules?.[t.id]?.[day] || [];
        
        const lesson = lessons.find((l: any) => l.periodNumber === p.periodNumber && (l.className || l.subjectName));
        if (lesson) {
          td.innerHTML = `<div style="font-weight:bold;color:#2563eb;">${lesson.className||''}</div><div style="color:#4b5563;">${lesson.subjectName||''}</div>`;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  });

  table.appendChild(tbody);
  container.appendChild(table);

  return container;
}
