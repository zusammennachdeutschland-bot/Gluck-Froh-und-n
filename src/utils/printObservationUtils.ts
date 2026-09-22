import { SchoolSettings, VisitRecord, StageFollowUpRecord, StudentActionPlan } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { sanitizeModernCssColors } from './certificateExportUtils';
import { getReportSchoolLogoHtml } from './alsunLogoData';

export function generateStageFollowUpReportHtml(
  record: StageFollowUpRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string,
  autoPrint: boolean = true
): string {
  const logoHtml = getReportSchoolLogoHtml(settings, { height: 48 });
  const flagHtml = '<div style="display: flex; flex-direction: column; width: 46px; height: 30px; border: 1px solid #000; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">' +
    '<div style="flex: 1; background-color: #000;"></div>' +
    '<div style="flex: 1; background-color: #f00;"></div>' +
    '<div style="flex: 1; background-color: #fc0;"></div>' +
  '</div>';

  const schoolName = settings.schoolName || '';
  const departmentName = settings.departmentName || '';
  const academicYear = settings.academicYear || '';
  const term = settings.currentTerm || '';
  const hodName = settings.hodName || '';

  const periodLabel = record.periodType === 'weekly' ? 'أسبوعية' : record.periodType === 'monthly' ? 'شهرية' : 'فصلية';
  const weekLabel = record.weekNumber ? ` - الأسبوع ${record.weekNumber}` : '';

  const bodyLoadAttr = autoPrint ? 'onload="window.print(); window.onafterprint = function() { window.close(); }"' : 'onload="window.print()"';

  const teacherRowsHtml = record.teachersData.map((td, index) => {
    const evals = [
      td.curriculumAdherence ? `<b>المنهج:</b> ${td.curriculumAdherence}` : '',
      td.bookletChecking ? `<b>الكراسات:</b> ${td.bookletChecking}` : '',
      td.classroomManagement ? `<b>إدارة الفصل:</b> ${td.classroomManagement}` : '',
      td.punctuality ? `<b>المواعيد:</b> ${td.punctuality}` : '',
      td.complaintsStatus ? `<b>الشكاوى:</b> ${td.complaintsStatus}` : '',
      td.customNotes ? `<b>ملاحظات:</b> ${td.customNotes}` : ''
    ].filter(Boolean).join('<br/>');

    const visitsInfo = td.visitsCount > 0 ? `${td.visitsCount} زيارة (متوسط ${td.visitsAvgScore}/75)` : 'لا توجد زيارات جديدة';
    const complaintsInfo = td.complaintsCount > 0 ? `${td.complaintsCount} شكوى` : 'لا توجد شكاوى';

    return '<tr>' +
      `<td style="text-align: center; font-weight: bold; vertical-align: middle;">${index + 1}</td>` +
      `<td style="text-align: right; font-weight: bold; padding: 4px 6px; vertical-align: middle;">${td.teacherName}</td>` +
      `<td style="text-align: center; vertical-align: middle; padding: 4px;">${(td.assignedClasses || []).join(', ') || '-'}<br/><small style="color: #475569;">(${td.totalSessions || 0} حصة/أسبوع)</small></td>` +
      `<td style="text-align: center; font-size: 8pt; vertical-align: middle; padding: 4px;"><div style="margin-bottom: 2px;">${visitsInfo}</div><div style="color: ${td.complaintsCount > 0 ? '#dc2626' : '#16a34a'}; font-weight: bold;">${complaintsInfo}</div></td>` +
      `<td style="text-align: right; font-size: 8pt; line-height: 1.3; padding: 4px 6px; vertical-align: middle;">${evals || 'لا توجد تقييمات مسجلة.'}</td>` +
    '</tr>';
  }).join('');

  const formattedHodName = hodName.replace(/^أ[\.\/]\s*/, '');
  const formattedManagerName = (record.stageManagerName || '').replace(/^أ[\.\/]\s*/, '');

  return '<!DOCTYPE html>' +
    '<html lang="' + lang + '" dir="' + (isRtl ? 'rtl' : 'ltr') + '">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Stage Follow-Up - ' + record.stageManagerName + '</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">' +
      '<style>' +
        '@page { size: A4; margin: 10mm 12mm 15mm 12mm; }' +
        '* { box-sizing: border-box; font-family: "Cairo", "Tajawal", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }' +
        'html, body { height: 100%; margin: 0; padding: 0; background: #fff; }' +
        'body { color: #0f172a; line-height: 1.35; font-size: 8.5pt; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; direction: ' + (isRtl ? 'rtl' : 'ltr') + '; text-align: ' + (isRtl ? 'right' : 'left') + '; -webkit-font-smoothing: antialiased; }' +
        '.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 6px; }' +
        '.header-logo { display: flex; align-items: center; justify-content: center; min-width: 60px; }' +
        '.header-text { text-align: center; flex: 1; padding: 0 10px; }' +
        '.header h1 { font-size: 13pt; margin: 0 0 2px; font-weight: 800; line-height: 1.3; color: #0f172a; }' +
        '.header p { font-size: 8.5pt; margin: 0; font-weight: 700; line-height: 1.3; color: #334155; }' +
        '.title { text-align: center; font-size: 11.5pt; font-weight: 800; margin-bottom: 6px; text-decoration: underline; line-height: 1.3; color: #0f172a; }' +
        '.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-bottom: 6px; border: 1.5px solid #0f172a; padding: 6px 10px; background: #f8fafc; align-items: center; border-radius: 4px; }' +
        '.meta-item { font-size: 8.5pt; font-weight: 600; line-height: 1.35; display: flex; align-items: center; text-align: ' + (isRtl ? 'right' : 'left') + '; color: #1e293b; }' +
        '.meta-label { font-weight: 800; margin-left: 5px; margin-right: 5px; display: inline-block; white-space: nowrap; color: #0f172a; }' +
        'table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; }' +
        'th, td { border: 1px solid #0f172a; padding: 4px 6px; vertical-align: middle; font-size: 8.5pt; line-height: 1.3; word-break: break-word; overflow-wrap: break-word; }' +
        'th { background: #e2e8f0; font-weight: 800; font-size: 8.5pt; height: 22px; text-align: center; vertical-align: middle; color: #0f172a; }' +
        '.feedback-section { margin-top: 6px; border: 1.5px solid #0f172a; padding: 6px 10px; min-height: 34px; background: #f8fafc; border-radius: 4px; }' +
        '.feedback-title { font-weight: 800; font-size: 8.5pt; margin-bottom: 3px; border-bottom: 1px dotted #0f172a; padding-bottom: 2px; line-height: 1.3; color: #0f172a; }' +
        '.signatures { margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-start; text-align: center; page-break-inside: avoid; break-inside: avoid; padding-bottom: 2.5rem; margin-bottom: 1.5rem; line-height: 1.6; }' +
        '.sig-block { width: 44%; display: flex; flex-direction: column; align-items: center; page-break-inside: avoid; break-inside: avoid; }' +
        '.sig-job-title { font-weight: 900; font-size: 9.5pt; color: #0f172a; margin-bottom: 2px; line-height: 1.4; }' +
        '.sig-person-name { font-size: 9pt; font-weight: 700; color: #334155; margin-bottom: 8px; line-height: 1.4; }' +
        '.sig-dotted-line { width: 180px; text-align: center; color: #64748b; font-weight: normal; letter-spacing: 2px; font-size: 9.5pt; }' +
      '</style>' +
    '</head>' +
    '<body ' + bodyLoadAttr + '>' +
      '<div class="header">' +
        '<div class="header-logo">' + logoHtml + '</div>' +
        '<div class="header-text">' +
          '<h1>' + schoolName + '</h1>' +
          '<p>' + departmentName + ' | ' + academicYear + ' - ' + term + '</p>' +
        '</div>' +
        '<div>' + flagHtml + '</div>' +
      '</div>' +
      '<div class="title">تقرير متابعة وتقييم معلمي المرحلة (' + periodLabel + weekLabel + ')</div>' +
      '<div class="meta-grid">' +
        '<div class="meta-item"><span class="meta-label">المرحلة / الصفوف:</span> ' + record.gradeBand + '</div>' +
        '<div class="meta-item"><span class="meta-label">مدير المرحلة:</span> ..................................</div>' +
        '<div class="meta-item"><span class="meta-label">نوع المتابعة:</span> متابعة ' + periodLabel + '</div>' +
        '<div class="meta-item"><span class="meta-label">رقم الأسبوع:</span> الأسبوع ' + (record.weekNumber || 1) + '</div>' +
        '<div class="meta-item"><span class="meta-label">تاريخ المتابعة:</span> ' + record.date + '</div>' +
        '<div class="meta-item"><span class="meta-label">رئيس القسم:</span> ' + formattedHodName + '</div>' +
        '<div class="meta-item" style="grid-column: span 2;"><span class="meta-label">عدد المعلمين التابعين:</span> ' + record.teachersData.length + ' معلم</div>' +
      '</div>' +
      '<table>' +
        '<thead>' +
          '<tr>' +
            '<th style="width: 5%;">#</th>' +
            '<th style="width: 22%;">اسم المعلم</th>' +
            '<th style="width: 18%;">الفصول والحصص</th>' +
            '<th style="width: 23%;">الزيارات والشكاوى</th>' +
            '<th style="width: 32%;">التقييمات والملاحظات</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          teacherRowsHtml +
        '</tbody>' +
      '</table>' +
      ((record.includeVisits && record.includedVisits && record.includedVisits.length > 0) ? (
        '<div style="margin-top: 8px; margin-bottom: 8px;">' +
          '<div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 3px; text-transform: uppercase;">تفاصيل الزيارات الصفية المعتمدة والمرفقة (' + record.includedVisits.length + '):</div>' +
          '<table>' +
            '<thead>' +
              '<tr>' +
                '<th style="width: 5%;">#</th>' +
                '<th style="width: 22%;">اسم المعلم</th>' +
                '<th style="width: 15%;">الصف والحصة</th>' +
                '<th style="width: 15%;">تاريخ الزيارة</th>' +
                '<th style="width: 25%;">موضوع الدرس</th>' +
                '<th style="width: 18%;">التقييم العام</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              record.includedVisits.map((v: any, i) => {
                const teacherName = v.teacherName || '-';
                const classGrade = v.className || v.class || v.gradeClass || '-';
                const dateVal = v.visitedDate || v.date || '-';
                const topic = v.lessonTopic || v.topic || v.focusAreas || 'زيارة صفية دورية';
                const scoreVal = v.overallScore ?? v.totalScore ?? v.score;
                const scoreText = (scoreVal !== undefined && scoreVal !== null) ? `${scoreVal}/75` : '-';
                const catText = v.overallCategory ? ` (${v.overallCategory})` : '';
                return '<tr>' +
                  `<td style="text-align: center; font-weight: bold;">${i + 1}</td>` +
                  `<td style="text-align: right; font-weight: bold;">${teacherName}</td>` +
                  `<td style="text-align: center;">${classGrade}${v.periodNumber ? ' - ح' + v.periodNumber : ''}</td>` +
                  `<td style="text-align: center; font-mono;">${dateVal}</td>` +
                  `<td style="text-align: right;">${topic}</td>` +
                  `<td style="text-align: center; font-weight: bold; color: #2563eb;">${scoreText}${catText}</td>` +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>'
      ) : '') +
      ((record.includeComplaints && record.includedComplaints && record.includedComplaints.length > 0) ? (
        '<div style="margin-top: 8px; margin-bottom: 8px;">' +
          '<div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 3px; text-transform: uppercase;">ملخص الشكاوى وملاحظات أولياء الأمور (' + record.includedComplaints.length + '):</div>' +
          '<table>' +
            '<thead>' +
              '<tr>' +
                '<th style="width: 5%;">#</th>' +
                '<th style="width: 25%;">اسم الطالب / الصف</th>' +
                '<th style="width: 50%;">سبب الشكوى</th>' +
                '<th style="width: 20%;">الحالة</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              record.includedComplaints.map((c, i) => {
                const isResolved = c.actionTaken && c.actionTaken.includes('RESOLVED');
                return '<tr>' +
                  `<td style="text-align: center; font-weight: bold;">${i + 1}</td>` +
                  `<td style="text-align: right; font-weight: bold;">${c.studentNameAr || c.studentNameEn} (${c.gradeClass})</td>` +
                  `<td style="text-align: right;">${c.reason}</td>` +
                  `<td style="text-align: center; font-weight: bold;">${isResolved ? 'تم الحل' : 'قيد المتابعة'}</td>` +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>'
      ) : '') +
      ((record.includeActionPlans && record.includedActionPlans && record.includedActionPlans.length > 0) ? (
        '<div style="margin-top: 8px; margin-bottom: 8px;">' +
          '<div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 3px; text-transform: uppercase;">خطط الدعم الأكاديمي والعلاجية المشمولة (' + record.includedActionPlans.length + '):</div>' +
          '<table>' +
            '<thead>' +
              '<tr>' +
                '<th style="width: 5%;">#</th>' +
                '<th style="width: 25%;">اسم الطالب والصف</th>' +
                '<th style="width: 50%;">المعلم والضعف المرصود</th>' +
                '<th style="width: 20%;">حالة الخطة</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              record.includedActionPlans.map((plan, i) => {
                const isResolved = plan.status === 'RESOLVED';
                return '<tr>' +
                  `<td style="text-align: center; font-weight: bold;">${i + 1}</td>` +
                  `<td style="text-align: right; font-weight: bold;">${plan.studentNameAr || plan.studentNameEn} (${plan.gradeClass})</td>` +
                  `<td style="text-align: right;">أ/ ${plan.teacherName} — ${(plan.weaknessAreas || []).join('، ')}</td>` +
                  `<td style="text-align: center; font-weight: bold;">${isResolved ? 'مغلقة' : 'نشطة'}</td>` +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>'
      ) : '') +
      ((record.includeAttendance !== false) ? (
        record.periodType === 'weekly' ? (
          /* Weekly HOD Report: Teacher Attendance & Discipline Table sorted by violations (Requirement 6) */
          '<div style="margin-top: 8px; margin-bottom: 8px;">' +
            '<div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 3px; text-transform: uppercase;">انضباط وحضور المعلمين (Teacher Attendance & Discipline):</div>' +
            '<table>' +
              '<thead>' +
                '<tr>' +
                  '<th style="width: 5%;">#</th>' +
                  '<th style="width: 27%;">Teacher Name (اسم المعلم)</th>' +
                  '<th style="width: 14%;">Absences (الغياب)</th>' +
                  '<th style="width: 14%;">Late Arrivals (التأخير)</th>' +
                  '<th style="width: 14%;">Early Leaves (الانصراف)</th>' +
                  '<th style="width: 13%;">Delay Mins (دقائق)</th>' +
                  '<th style="width: 13%;">Score (الانضباط)</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                [...record.teachersData]
                  .sort((a, b) => {
                    const violsA = (a.absencesCount || 0) + (a.lateArrivalsCount || 0) + (a.earlyLeavesCount || 0);
                    const violsB = (b.absencesCount || 0) + (b.lateArrivalsCount || 0) + (b.earlyLeavesCount || 0);
                    return violsB - violsA;
                  })
                  .map((td, i) => {
                    const absences = td.absencesCount || 0;
                    const late = td.lateArrivalsCount || 0;
                    const early = td.earlyLeavesCount || 0;
                    const delayMins = td.delayMinutes || 0;
                    const score = td.disciplineScore !== undefined ? td.disciplineScore : 100;
                    return '<tr>' +
                      `<td style="text-align: center; font-weight: bold;">${i + 1}</td>` +
                      `<td style="text-align: right; font-weight: bold; padding: 4px 6px;">${td.teacherName}</td>` +
                      `<td style="text-align: center; color: ${absences > 0 ? '#dc2626' : '#16a34a'}; font-weight: bold;">${absences}</td>` +
                      `<td style="text-align: center; color: ${late > 0 ? '#d97706' : '#16a34a'}; font-weight: bold;">${late}</td>` +
                      `<td style="text-align: center; color: ${early > 0 ? '#ea580c' : '#16a34a'}; font-weight: bold;">${early}</td>` +
                      `<td style="text-align: center; font-weight: bold;">${delayMins}m</td>` +
                      `<td style="text-align: center; font-weight: bold; color: ${score >= 90 ? '#16a34a' : score >= 75 ? '#d97706' : '#dc2626'};">${score}%</td>` +
                    '</tr>';
                  }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>'
        ) : (
          /* Monthly HOD Report: Monthly Staff Attendance Summary (Requirement 7) */
          '<div style="margin-top: 8px; margin-bottom: 8px;">' +
            '<div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 3px; text-transform: uppercase;">ملخص الحضور والانضباط الشهري (Monthly Staff Attendance Summary):</div>' +
            '<table style="margin-bottom: 6px;">' +
              '<thead>' +
                '<tr>' +
                  '<th style="width: 20%;">Total Absences (الغياب)</th>' +
                  '<th style="width: 20%;">Total Late (التأخير)</th>' +
                  '<th style="width: 20%;">Early Leaves (الانصراف)</th>' +
                  '<th style="width: 20%;">Delay Mins (دقائق)</th>' +
                  '<th style="width: 20%;">Lost Hours (ساعات مفقودة)</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                '<tr>' +
                  `<td style="text-align: center; font-weight: bold; font-size: 10pt; color: #dc2626;">${record.attendanceSummary?.totalAbsences || 0}</td>` +
                  `<td style="text-align: center; font-weight: bold; font-size: 10pt; color: #d97706;">${record.attendanceSummary?.totalLateArrivals || 0}</td>` +
                  `<td style="text-align: center; font-weight: bold; font-size: 10pt; color: #ea580c;">${record.attendanceSummary?.totalEarlyLeaves || 0}</td>` +
                  `<td style="text-align: center; font-weight: bold; font-size: 10pt; color: #2563eb;">${record.attendanceSummary?.totalDelayMinutes || 0}m</td>` +
                  `<td style="text-align: center; font-weight: bold; font-size: 10pt; color: #4f46e5;">${record.attendanceSummary?.totalLostHours || 0}h</td>` +
                '</tr>' +
              '</tbody>' +
            '</table>' +
            '<div style="display: flex; gap: 6px; margin-top: 4px;">' +
              '<div style="flex: 1; border: 1px solid #000; padding: 4px; background: #fafafa; font-size: 7.5pt;">' +
                '<b style="color: #dc2626;">المعلمون الأكثر غياباً (Most Absent):</b><br/>' +
                ((record.attendanceSummary?.mostAbsentTeachers && record.attendanceSummary.mostAbsentTeachers.length > 0)
                  ? record.attendanceSummary.mostAbsentTeachers.map(t => `${t.name} (${t.count} أيام)`).join('، ')
                  : 'لا توجد حالات غياب') +
              '</div>' +
              '<div style="flex: 1; border: 1px solid #000; padding: 4px; background: #fafafa; font-size: 7.5pt;">' +
                '<b style="color: #d97706;">الأكثر تأخيراً (Most Late):</b><br/>' +
                ((record.attendanceSummary?.mostLateTeachers && record.attendanceSummary.mostLateTeachers.length > 0)
                  ? record.attendanceSummary.mostLateTeachers.map(t => `${t.name} (${t.minutes}m)`).join('، ')
                  : 'لا توجد تأخيرات') +
              '</div>' +
              '<div style="flex: 1; border: 1px solid #000; padding: 4px; background: #fafafa; font-size: 7.5pt;">' +
                '<b style="color: #ea580c;">الأكثر انصرافاً مبكراً (Early Leave):</b><br/>' +
                ((record.attendanceSummary?.mostEarlyLeaveTeachers && record.attendanceSummary.mostEarlyLeaveTeachers.length > 0)
                  ? record.attendanceSummary.mostEarlyLeaveTeachers.map(t => `${t.name} (${t.minutes}m)`).join('، ')
                  : 'لا توجد حالات') +
              '</div>' +
            '</div>' +
          '</div>'
        )
      ) : '') +
      (record.overallStageNotes ? (
        '<div class="feedback-section">' +
          '<div class="feedback-title">توصيات وملاحظات رئيس القسم العامة للمرحلة:</div>' +
          '<div style="font-size: 8.5pt; font-weight: 500; line-height: 1.35; white-space: pre-wrap;">' + record.overallStageNotes + '</div>' +
        '</div>'
      ) : '') +
      '<div class="signatures">' +
        '<div class="sig-block">' +
          '<div class="sig-job-title">رئيس قسم اللغة الألمانية</div>' +
          '<div class="sig-person-name">أ/ ' + formattedHodName + '</div>' +
          '<div class="sig-dotted-line">..................................</div>' +
        '</div>' +
        '<div class="sig-block">' +
          '<div class="sig-job-title">مدير المرحلة</div>' +
          '<div class="sig-person-name" style="letter-spacing: 2px; color: #64748b; font-weight: normal;">..................................</div>' +
          '<div class="sig-dotted-line">..................................</div>' +
        '</div>' +
      '</div>' +
    '</body>' +
    '</html>';
}

export async function generateStageFollowUpPdfInstance(
  record: StageFollowUpRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<jsPDF> {
  const htmlStr = generateStageFollowUpReportHtml(record, settings, isRtl, lang, false);

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '794px'; // 210mm at 96DPI
  container.style.background = '#ffffff';

  const bodyMatch = htmlStr.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const styleMatch = htmlStr.match(/<style[^>]*>([\s\S]*)<\/style>/i);

  const styleTag = styleMatch ? `<style>${styleMatch[1]}</style>` : '';
  const bodyContent = bodyMatch ? bodyMatch[1] : htmlStr;

  container.innerHTML = `${styleTag}<div style="width: 100%; background: #ffffff; color: #000000;" dir="${isRtl ? 'rtl' : 'ltr'}">${bodyContent}</div>`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 5000,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      onclone: (clonedDoc) => {
        const styles = clonedDoc.querySelectorAll('style');
        styles.forEach(s => {
          if (s.textContent) {
            s.textContent = sanitizeModernCssColors(s.textContent);
          }
        });
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (imgHeight > pdfHeight) {
      const scale = pdfHeight / imgHeight;
      const finalWidth = imgWidth * scale;
      const xMargin = (pdfWidth - finalWidth) / 2;
      pdf.addImage(imgData, 'JPEG', xMargin, 0, finalWidth, pdfHeight, undefined, 'FAST');
    } else {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
    }

    return pdf;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export async function generateStageFollowUpPdfBlob(
  record: StageFollowUpRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<Blob> {
  const pdf = await generateStageFollowUpPdfInstance(record, settings, isRtl, lang);
  return pdf.output('blob');
}

export async function downloadStageFollowUpPdf(
  record: StageFollowUpRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    const pdf = await generateStageFollowUpPdfInstance(record, settings, isRtl, lang);
    const safeManagerName = (record.stageManagerName || 'Manager').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
    const fileName = `متابعة_مرحلة_${safeManagerName}_${record.date || Date.now()}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: `تقرير متابعة - ${record.stageManagerName}`,
        url: savedFile.uri
      });
    } else {
      pdf.save(fileName);
    }
    return { success: true, filename: fileName };
  } catch (error: any) {
    console.error('Error downloading Stage Follow-up PDF:', error);
    return { success: false, filename: '', error: error?.message || 'Download failed' };
  }
}

export async function shareStageFollowUpViaWhatsApp(
  record: StageFollowUpRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<void> {
  const safeManagerName = (record.stageManagerName || 'Manager').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const weekNumStr = record.weekNumber ? `_W${record.weekNumber}` : '';
  const fileName = `متابعة_مرحلة_${safeManagerName}${weekNumStr}_${record.date || Date.now()}.pdf`;
  const periodLabel = record.periodType === 'weekly' ? 'أسبوعية' : record.periodType === 'monthly' ? 'شهرية' : 'فصلية';
  const weekTitleStr = record.weekNumber ? ` - الأسبوع ${record.weekNumber}` : '';

  const textSummary =
    `📋 *تقرير متابعة وتقييم مدير المرحلة (${periodLabel}${weekTitleStr})*\n\n` +
    `👤 *مدير المرحلة:* ${record.stageManagerName}\n` +
    `🏫 *المرحلة / الصفوف:* ${record.gradeBand}\n` +
    `🗓️ *رقم الأسبوع:* الأسبوع ${record.weekNumber || 1}\n` +
    `📅 *تاريخ المتابعة:* ${record.date}\n` +
    `👥 *عدد المعلمين التابعين:* ${record.teachersData.length} معلم\n\n` +
    `✍️ *ملاحظات التقييم العامة:*\n${record.overallStageNotes || 'تم إنجاز التقييم بنجاح.'}\n\n` +
    `👨‍🏫 *رئيس القسم:* ${settings.hodName || ''}`;

  try {
    const pdf = await generateStageFollowUpPdfInstance(record, settings, isRtl, lang);

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: `تقرير متابعة - ${record.stageManagerName}`,
        text: textSummary,
        url: savedFile.uri
      });
      return;
    }

    const blob = pdf.output('blob');
    const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [pdfFile] })
    ) {
      await navigator.share({
        files: [pdfFile],
        title: `تقرير متابعة - ${record.stageManagerName}`,
        text: textSummary,
      });
      return;
    }
  } catch (err) {
    console.warn('Web Share failed, fallback to WhatsApp link:', err);
  }

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(textSummary)}`, '_blank');
}

export function printStageFollowUpReport(
  record: StageFollowUpRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
) {
  const htmlStr = generateStageFollowUpReportHtml(record, settings, isRtl, lang, true);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlStr);
    printWindow.document.close();
  } else {
    // Fallback for Android WebView & Chrome popup blockers
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
      doc.write(htmlStr);
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

export function generateObservationReportContentHtml(
  visit: VisitRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): string {
  const logoHtml = getReportSchoolLogoHtml(settings, { height: 50 });
  const flagHtml = '<div style="display: flex; flex-direction: column; width: 48px; height: 32px; border: 1px solid #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">' +
    '<div style="flex: 1; background-color: #000;"></div>' +
    '<div style="flex: 1; background-color: #f00;"></div>' +
    '<div style="flex: 1; background-color: #fc0;"></div>' +
  '</div>';
  
  const schoolName = settings.schoolName || '';
  const departmentName = settings.departmentName || '';
  const academicYear = settings.academicYear || '';
  const term = settings.currentTerm || '';
  const hodName = settings.hodName || '';

  const t = (en: string, ar: string) => isRtl ? ar : en;

  const renderRow = (labelEn: string, labelAr: string, val: number | undefined) => {
    const score = val || 0;
    const checkMark = '<span style="display: inline-block; vertical-align: middle; line-height: 1; font-weight: bold; font-size: 10pt;">✓</span>';
    return '<tr>' +
      '<td class="criteria-col">' + (isRtl ? labelAr : labelEn) + '</td>' +
      '<td class="rating-col">' + (score === 5 ? checkMark : '') + '</td>' +
      '<td class="rating-col">' + (score === 4 ? checkMark : '') + '</td>' +
      '<td class="rating-col">' + (score === 3 ? checkMark : '') + '</td>' +
      '<td class="rating-col">' + (score === 2 ? checkMark : '') + '</td>' +
      '<td class="rating-col">' + (score === 1 ? checkMark : '') + '</td>' +
    '</tr>';
  };

  const catTitlesEn = ['Classroom Management', 'Teaching Skills', 'Student Engagement', 'Booklet & Workbook Correction'];
  const catTitlesAr = ['إدارة الفصل', 'المهارات التدريسية', 'تفاعل الطلاب', 'متابعة تصحيح الدفتر'];
  
  const categoriesHtml = ['cm', 'ts', 'se', 'bc'].map((cat, index) => {
    let rows = '';
    if (cat === 'cm') {
      rows += renderRow('Classroom organization and cleanliness', 'تنظيم ونظافة الفصل', visit.cm_organization);
      rows += renderRow('Teacher\'s control and discipline', 'سيطرة المعلم وضبط الفصل', visit.cm_control);
      rows += renderRow('Effective use of time', 'إدارة وقت الحصة بفعالية', visit.cm_time);
      rows += renderRow('Respectful interaction with students', 'التعامل باحترام مع الطلاب', visit.cm_respect);
    } else if (cat === 'ts') {
      rows += renderRow('Lesson objectives clearly stated', 'وضوح أهداف الدرس', visit.ts_objectives);
      rows += renderRow('Use of various teaching aids', 'استخدام الوسائل التعليمية المتنوعة', visit.ts_aids);
      rows += renderRow('Encouraging student participation', 'تشجيع الطلاب على المشاركة', visit.ts_participation);
      rows += renderRow('Asking thought-provoking questions', 'طرح أسئلة مثيرة للتفكير', visit.ts_questions);
      rows += renderRow('Clarity and simplicity of explanation', 'وضوح وبساطة الشرح', visit.ts_clarity);
    } else if (cat === 'se') {
      rows += renderRow('Students\' participation in activities', 'مشاركة الطلاب في الأنشطة', visit.se_participation);
      rows += renderRow('Positive interaction with the teacher', 'التفاعل الإيجابي مع المعلم', visit.se_interaction);
      rows += renderRow('Students\' adherence to classroom rules', 'التزام الطلاب بقواعد الفصل', visit.se_rules);
    } else if (cat === 'bc') {
      rows += renderRow('Regularity and promptness of marking', 'انتظام وسرعة التصحيح', visit.bc_regularity);
      rows += renderRow('Quality of feedback & corrections given to students', 'جودة التغذية الراجعة للطلاب', visit.bc_quality);
      rows += renderRow('Student compliance with notebook corrections', 'استجابة الطلاب لتصويبات المعلم', visit.bc_compliance);
    }

    return '<div class="category-title">' + t(catTitlesEn[index], catTitlesAr[index]) + '</div>' +
      '<table>' +
        '<thead>' +
          '<tr>' +
            '<th class="criteria-col">' + t('Criteria', 'المعايير') + '</th>' +
            '<th class="rating-col">5</th>' +
            '<th class="rating-col">4</th>' +
            '<th class="rating-col">3</th>' +
            '<th class="rating-col">2</th>' +
            '<th class="rating-col">1</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
  }).join('');

  return '<div class="report-single-page">' +
    '<div class="header">' +
      '<div class="header-logo">' + logoHtml + '</div>' +
      '<div class="header-text">' +
        '<h1>' + schoolName + '</h1>' +
        '<p>' + departmentName + ' | ' + academicYear + ' - ' + term + '</p>' +
      '</div>' +
      '<div>' + flagHtml + '</div>' +
    '</div>' +
    '<div class="title">' + t('Teacher Classroom Observation Form', 'نموذج تقييم زيارة صفية للمعلم') + '</div>' +
    '<div class="meta-grid">' +
      '<div class="meta-item"><span class="meta-label">' + t('Teacher Name:', 'اسم المعلم:') + '</span> ' + visit.teacherName + '</div>' +
      '<div class="meta-item"><span class="meta-label">' + t('Subject:', 'المادة:') + '</span> ' + t('German', 'لغة ألمانية') + '</div>' +
      '<div class="meta-item"><span class="meta-label">' + t('Grade/Class:', 'الفصل:') + '</span> ' + visit.className + '</div>' +
      '<div class="meta-item"><span class="meta-label">' + t('Period:', 'الحصة:') + '</span> ' + (visit.periodNumber || '-') + '</div>' +
      '<div class="meta-item"><span class="meta-label">' + t('Date:', 'التاريخ:') + '</span> ' + visit.visitedDate + '</div>' +
      '<div class="meta-item"><span class="meta-label">' + t('Observer:', 'المشرف:') + '</span> ' + hodName + '</div>' +
    '</div>' +
    categoriesHtml +
    '<div class="overall-box">' +
      '<span>' + t('Total Score', 'النتيجة الكلية') + ': ' + (visit.overallScore || '-') + '/75</span>' +
      '<span>' + t('Category', 'التقييم العام') + ': ' + (visit.overallCategory || '-') + '</span>' +
    '</div>' +
    '<div class="feedback-section">' +
      '<div class="feedback-title">' + t('Supervisor Notes & Recommendations', 'ملاحظات وتوصيات المشرف') + '</div>' +
      '<div style="white-space: pre-wrap; margin-top: 3px; font-size: 8.5pt;">' + (visit.consolidatedNotes || 'لا توجد ملاحظات إضافية.') + '</div>' +
    '</div>' +
    '<div class="signatures">' +
      '<div class="sig-block">' +
        '<div class="sig-title">' + t('Teacher\'s Signature', 'توقيع المعلم') + '</div>' +
        '<div class="sig-line">' + visit.teacherName + '</div>' +
      '</div>' +
      '<div class="sig-block">' +
        '<div class="sig-title">' + t('Supervisor\'s Signature', 'توقيع المشرف') + '</div>' +
        '<div class="sig-line">' + hodName + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

export function generateObservationReportHtml(
  visit: VisitRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string,
  autoPrint: boolean = true
): string {
  const bodyLoadAttr = autoPrint ? 'onload="window.print(); window.onafterprint = function() { window.close(); }"' : 'onload="window.print()"';
  const innerContent = generateObservationReportContentHtml(visit, settings, isRtl, lang);

  return '<!DOCTYPE html>' +
    '<html lang="' + lang + '" dir="' + (isRtl ? 'rtl' : 'ltr') + '">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Observation Report - ' + visit.teacherName + '</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">' +
      '<style>' +
        '@page { size: A4; margin: 8mm 8mm; }' +
        '* { box-sizing: border-box; font-family: "Cairo", "Tajawal", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }' +
        'html, body { height: 100%; margin: 0; padding: 0; background: #fff; }' +
        'body { color: #0f172a; line-height: 1.3; font-size: 8.5pt; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; direction: ' + (isRtl ? 'rtl' : 'ltr') + '; text-align: ' + (isRtl ? 'right' : 'left') + '; -webkit-font-smoothing: antialiased; }' +
        '.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-bottom: 6px; }' +
        '.header-logo { display: flex; align-items: center; justify-content: center; min-width: 60px; }' +
        '.header-text { text-align: center; flex: 1; padding: 0 10px; }' +
        '.header h1 { font-size: 13pt; margin: 0 0 2px; font-weight: 800; line-height: 1.3; color: #0f172a; }' +
        '.header p { font-size: 8.5pt; margin: 0; font-weight: 700; line-height: 1.3; color: #334155; }' +
        '.title { text-align: center; font-size: 11.5pt; font-weight: 800; margin-bottom: 6px; text-decoration: underline; line-height: 1.3; color: #0f172a; }' +
        '.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-bottom: 6px; border: 1.5px solid #0f172a; padding: 6px 10px; background: #f8fafc; align-items: center; border-radius: 4px; }' +
        '.meta-item { font-size: 8.5pt; font-weight: 600; line-height: 1.35; display: flex; align-items: center; color: #1e293b; }' +
        '.meta-label { font-weight: 800; margin-right: 5px; margin-left: 5px; display: inline-block; color: #0f172a; white-space: nowrap; }' +
        '.category-title { font-size: 8.5pt; font-weight: 800; margin-top: 4px; margin-bottom: 2px; background: #e2e8f0; padding: 3px 6px; border: 1px solid #0f172a; border-bottom: none; line-height: 1.3; vertical-align: middle; color: #0f172a; }' +
        'table { width: 100%; border-collapse: collapse; margin-bottom: 4px; table-layout: fixed; }' +
        'th, td { border: 1px solid #0f172a; padding: 3px 4px; text-align: center; vertical-align: middle; font-size: 8.5pt; line-height: 1.25; }' +
        'th { background: #f1f5f9; font-weight: 800; font-size: 8.5pt; height: 20px; color: #0f172a; }' +
        '.criteria-col { text-align: ' + (isRtl ? 'right' : 'left') + '; width: 55%; font-weight: 700; vertical-align: middle; padding-left: 6px; padding-right: 6px; line-height: 1.3; color: #1e293b; }' +
        '.rating-col { width: 9%; font-weight: bold; font-size: 9.5pt; text-align: center; vertical-align: middle; line-height: 1; }' +
        '.feedback-section { margin-top: 6px; border: 1.5px solid #0f172a; padding: 6px 10px; min-height: 40px; background: #f8fafc; border-radius: 4px; }' +
        '.feedback-title { font-weight: 800; font-size: 8.5pt; margin-bottom: 2px; border-bottom: 1px dotted #0f172a; padding-bottom: 2px; line-height: 1.3; color: #0f172a; }' +
        '.overall-box { margin-top: 6px; padding: 5px 8px; border: 1.5px solid #0f172a; font-weight: 800; text-align: center; font-size: 9.5pt; display: flex; justify-content: space-around; align-items: center; background: #f8fafc; line-height: 1.3; border-radius: 4px; }' +
        '.signatures { margin-top: 14px; display: flex; justify-content: space-around; align-items: flex-end; text-align: center; page-break-inside: avoid; }' +
        '.sig-block { width: 40%; }' +
        '.sig-title { font-weight: 800; font-size: 9pt; margin-bottom: 16px; line-height: 1.3; color: #0f172a; }' +
        '.sig-line { border-top: 1px solid #0f172a; padding-top: 3px; font-size: 8.5pt; font-weight: 800; line-height: 1.3; color: #1e293b; }' +
      '</style>' +
    '</head>' +
    '<body ' + bodyLoadAttr + '>' +
      innerContent +
    '</body>' +
    '</html>';
}

/**
 * Generates combined printable HTML for multiple observation reports with proper page breaks.
 */
export function generateCombinedObservationReportsHtml(
  visits: VisitRecord[],
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string,
  autoPrint: boolean = true
): string {
  const bodyLoadAttr = autoPrint ? 'onload="window.print(); window.onafterprint = function() { window.close(); }"' : 'onload="window.print()"';

  const pagesHtml = visits.map((visit, idx) => {
    const isLast = idx === visits.length - 1;
    const inner = generateObservationReportContentHtml(visit, settings, isRtl, lang);
    return `<div class="report-page ${isLast ? 'last-page' : ''}">${inner}</div>`;
  }).join('');

  return '<!DOCTYPE html>' +
    '<html lang="' + lang + '" dir="' + (isRtl ? 'rtl' : 'ltr') + '">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Combined Observation Reports (' + visits.length + ')</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">' +
      '<style>' +
        '@page { size: A4; margin: 8mm 8mm; }' +
        '* { box-sizing: border-box; font-family: "Cairo", "Tajawal", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }' +
        'html, body { margin: 0; padding: 0; background: #fff; }' +
        'body { color: #0f172a; line-height: 1.3; font-size: 8.5pt; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; direction: ' + (isRtl ? 'rtl' : 'ltr') + '; text-align: ' + (isRtl ? 'right' : 'left') + '; -webkit-font-smoothing: antialiased; }' +
        '.report-page { page-break-after: always; break-after: page; width: 100%; background: #ffffff; padding: 0; margin-bottom: 25px; }' +
        '.report-page.last-page { page-break-after: auto; break-after: auto; margin-bottom: 0; }' +
        '@media print { .report-page { margin-bottom: 0; } }' +
        '.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-bottom: 6px; }' +
        '.header-logo { display: flex; align-items: center; justify-content: center; min-width: 60px; }' +
        '.header-text { text-align: center; flex: 1; padding: 0 10px; }' +
        '.header h1 { font-size: 13pt; margin: 0 0 2px; font-weight: 800; line-height: 1.3; color: #0f172a; }' +
        '.header p { font-size: 8.5pt; margin: 0; font-weight: 700; line-height: 1.3; color: #334155; }' +
        '.title { text-align: center; font-size: 11.5pt; font-weight: 800; margin-bottom: 6px; text-decoration: underline; line-height: 1.3; color: #0f172a; }' +
        '.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-bottom: 6px; border: 1.5px solid #0f172a; padding: 6px 10px; background: #f8fafc; align-items: center; border-radius: 4px; }' +
        '.meta-item { font-size: 8.5pt; font-weight: 600; line-height: 1.35; display: flex; align-items: center; color: #1e293b; }' +
        '.meta-label { font-weight: 800; margin-right: 5px; margin-left: 5px; display: inline-block; color: #0f172a; white-space: nowrap; }' +
        '.category-title { font-size: 8.5pt; font-weight: 800; margin-top: 4px; margin-bottom: 2px; background: #e2e8f0; padding: 3px 6px; border: 1px solid #0f172a; border-bottom: none; line-height: 1.3; vertical-align: middle; color: #0f172a; }' +
        'table { width: 100%; border-collapse: collapse; margin-bottom: 4px; table-layout: fixed; }' +
        'th, td { border: 1px solid #0f172a; padding: 3px 4px; text-align: center; vertical-align: middle; font-size: 8.5pt; line-height: 1.25; }' +
        'th { background: #f1f5f9; font-weight: 800; font-size: 8.5pt; height: 20px; color: #0f172a; }' +
        '.criteria-col { text-align: ' + (isRtl ? 'right' : 'left') + '; width: 55%; font-weight: 700; vertical-align: middle; padding-left: 6px; padding-right: 6px; line-height: 1.3; color: #1e293b; }' +
        '.rating-col { width: 9%; font-weight: bold; font-size: 9.5pt; text-align: center; vertical-align: middle; line-height: 1; }' +
        '.feedback-section { margin-top: 6px; border: 1.5px solid #0f172a; padding: 6px 10px; min-height: 40px; background: #f8fafc; border-radius: 4px; }' +
        '.feedback-title { font-weight: 800; font-size: 8.5pt; margin-bottom: 2px; border-bottom: 1px dotted #0f172a; padding-bottom: 2px; line-height: 1.3; color: #0f172a; }' +
        '.overall-box { margin-top: 6px; padding: 5px 8px; border: 1.5px solid #0f172a; font-weight: 800; text-align: center; font-size: 9.5pt; display: flex; justify-content: space-around; align-items: center; background: #f8fafc; line-height: 1.3; border-radius: 4px; }' +
        '.signatures { margin-top: 14px; display: flex; justify-content: space-around; align-items: flex-end; text-align: center; page-break-inside: avoid; }' +
        '.sig-block { width: 40%; }' +
        '.sig-title { font-weight: 800; font-size: 9pt; margin-bottom: 16px; line-height: 1.3; color: #0f172a; }' +
        '.sig-line { border-top: 1px solid #0f172a; padding-top: 3px; font-size: 8.5pt; font-weight: 800; line-height: 1.3; color: #1e293b; }' +
      '</style>' +
    '</head>' +
    '<body ' + bodyLoadAttr + '>' +
      pagesHtml +
    '</body>' +
    '</html>';
}

/**
 * Prints multiple observation reports in a single print dialog.
 */
export async function printCombinedObservationReports(
  visits: VisitRecord[],
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<void> {
  if (!visits || visits.length === 0) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    await downloadCombinedObservationReportsPdf(visits, settings, isRtl, lang);
    return;
  }

  const htmlContent = generateCombinedObservationReportsHtml(visits, settings, isRtl, lang, true);
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Generates a unified jsPDF document containing all provided observation reports, 1 page per report.
 */
export async function generateCombinedObservationReportsPdfInstance(
  visits: VisitRecord[],
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string,
  onProgress?: (current: number, total: number) => void
): Promise<jsPDF> {
  if (!visits || visits.length === 0) {
    throw new Error('No visit records provided');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // standard A4 width at 96dpi
  container.style.backgroundColor = '#ffffff';
  container.style.boxSizing = 'border-box';
  container.style.padding = '15px 20px';
  container.style.zIndex = '-9999';
  document.body.appendChild(container);

  try {
    for (let i = 0; i < visits.length; i++) {
      const visit = visits[i];
      if (onProgress) {
        onProgress(i + 1, visits.length);
      }

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      const htmlStr = generateObservationReportHtml(visit, settings, isRtl, lang, false);
      const bodyMatch = htmlStr.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const styleMatch = htmlStr.match(/<style[^>]*>([\s\S]*)<\/style>/i);

      const styleTag = styleMatch ? `<style>${styleMatch[1]}</style>` : '';
      const bodyContent = bodyMatch ? bodyMatch[1] : htmlStr;

      container.innerHTML = `${styleTag}<div style="width: 100%; background: #ffffff; color: #000000;" dir="${isRtl ? 'rtl' : 'ltr'}">${bodyContent}</div>`;

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 5000,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        onclone: (clonedDoc) => {
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach(s => {
            if (s.textContent) {
              s.textContent = sanitizeModernCssColors(s.textContent);
            }
          });
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight > pdfHeight) {
        const scale = pdfHeight / imgHeight;
        const finalWidth = imgWidth * scale;
        const xMargin = (pdfWidth - finalWidth) / 2;
        pdf.addImage(imgData, 'JPEG', xMargin, 0, finalWidth, pdfHeight, undefined, 'FAST');
      } else {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      }
    }

    return pdf;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

async function savePdfFileCrossPlatform(pdf: jsPDF, fileName: string, shareTitle?: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const pdfBase64 = pdf.output('datauristring').split(',')[1];
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: pdfBase64,
      directory: Directory.Cache
    });
    await Share.share({
      title: shareTitle || fileName,
      url: savedFile.uri
    });
    return;
  }

  // Web & Mobile Browser (Android Chrome, iOS Safari, etc.)
  try {
    const blob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.target = '_self';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(blobUrl);
    }, 4000);
  } catch (err) {
    // Fallback to jsPDF standard save
    pdf.save(fileName);
  }
}

/**
 * Downloads multiple observation reports in a single merged PDF file.
 */
export async function downloadCombinedObservationReportsPdf(
  visits: VisitRecord[],
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    if (!visits || visits.length === 0) {
      return { success: false, filename: '', error: 'No visits selected' };
    }

    const pdf = await generateCombinedObservationReportsPdfInstance(visits, settings, isRtl, lang, onProgress);
    const dateStr = new Date().toISOString().slice(0, 10);
    const teacherName = visits.length === 1 
      ? (visits[0].teacherName || 'Teacher').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')
      : 'مجموعة_معلمين';
    const fileName = `تقارير_زيارات_مجمعة_${visits.length}_${teacherName}_${dateStr}.pdf`;

    await savePdfFileCrossPlatform(pdf, fileName, `تقارير زيارات صفية مجمعة (${visits.length})`);
    return { success: true, filename: fileName };
  } catch (error: any) {
    console.error('Error downloading combined observation reports PDF:', error);
    return { success: false, filename: '', error: error?.message || 'Download failed' };
  }
}

export async function printObservationReport(
  visit: VisitRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<void> {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    await downloadObservationReportPdf(visit, settings, isRtl, lang);
    return;
  }

  const htmlContent = generateObservationReportHtml(visit, settings, isRtl, lang, true);
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Generates a real jsPDF instance contained on a single A4 page.
 */
export async function generateObservationReportPdfInstance(
  visit: VisitRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<jsPDF> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // standard A4 width at 96dpi
  container.style.backgroundColor = '#ffffff';
  container.style.boxSizing = 'border-box';
  container.style.padding = '15px 20px';
  container.style.zIndex = '-9999';

  const htmlStr = generateObservationReportHtml(visit, settings, isRtl, lang, false);
  const bodyMatch = htmlStr.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const styleMatch = htmlStr.match(/<style[^>]*>([\s\S]*)<\/style>/i);

  const styleTag = styleMatch ? `<style>${styleMatch[1]}</style>` : '';
  const bodyContent = bodyMatch ? bodyMatch[1] : htmlStr;

  container.innerHTML = `${styleTag}<div style="width: 100%; background: #ffffff; color: #000000;" dir="${isRtl ? 'rtl' : 'ltr'}">${bodyContent}</div>`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 5000,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      onclone: (clonedDoc) => {
        const styles = clonedDoc.querySelectorAll('style');
        styles.forEach(s => {
          if (s.textContent) {
            s.textContent = sanitizeModernCssColors(s.textContent);
          }
        });
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    // Constrain height strictly to single A4 page
    if (imgHeight > pdfHeight) {
      const scale = pdfHeight / imgHeight;
      const finalWidth = imgWidth * scale;
      const xMargin = (pdfWidth - finalWidth) / 2;
      pdf.addImage(imgData, 'JPEG', xMargin, 0, finalWidth, pdfHeight, undefined, 'FAST');
    } else {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
    }

    return pdf;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Generates a real PDF Blob (application/pdf) contained on a single A4 page.
 */
export async function generateObservationReportPdfBlob(
  visit: VisitRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<Blob> {
  const pdf = await generateObservationReportPdfInstance(visit, settings, isRtl, lang);
  return pdf.output('blob');
}

/**
 * Downloads report as a REAL PDF file (application/pdf) compatible with Android, iOS & Web.
 */
export async function downloadObservationReportPdf(
  visit: VisitRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    const pdf = await generateObservationReportPdfInstance(visit, settings, isRtl, lang);
    const safeTeacherName = (visit.teacherName || 'Teacher').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
    const safeClassName = (visit.className || 'Class').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
    const fileName = `تقرير_زيارة_${safeTeacherName}_${safeClassName}.pdf`;

    await savePdfFileCrossPlatform(pdf, fileName, `تقرير زيارة صفية - ${visit.teacherName}`);
    return { success: true, filename: fileName };
  } catch (error: any) {
    console.error('Error downloading Observation Report PDF:', error);
    return { success: false, filename: '', error: error?.message || 'Download failed' };
  }
}

/**
 * Shares observation report via Web Share API (native file share) or WhatsApp URL fallback.
 */
export async function shareObservationReportViaWhatsApp(
  visit: VisitRecord,
  settings: SchoolSettings,
  isRtl: boolean,
  lang: string
): Promise<void> {
  const safeTeacherName = (visit.teacherName || 'Teacher').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const safeClassName = (visit.className || 'Class').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const fileName = `تقرير_زيارة_${safeTeacherName}_${safeClassName}.pdf`;

  const textSummary =
    `📋 *تقرير زيارة صفية - قسم اللغة الألمانية*\n\n` +
    `👤 *اسم المعلم:* ${visit.teacherName}\n` +
    `🏫 *الفصل:* ${visit.className}\n` +
    `📅 *التاريخ:* ${visit.visitedDate || '-'}\n` +
    `⏰ *الحصة:* ${visit.periodNumber || '-'}\n` +
    `📊 *النتيجة الكلية:* ${visit.overallScore || '-'}/75 (${visit.overallCategory || '-'})\n\n` +
    `✍️ *ملاحظات وتوصيات المشرف:*\n${visit.consolidatedNotes || 'لا توجد ملاحظات.'}` +
    (settings.hodName ? `\n\n👨‍🏫 *المشرف:* ${settings.hodName}` : '');

  try {
    const pdf = await generateObservationReportPdfInstance(visit, settings, isRtl, lang);

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: `تقرير زيارة صفية - ${visit.teacherName}`,
        text: textSummary,
        url: savedFile.uri
      });
      return;
    }

    const blob = pdf.output('blob');
    const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

    // Check if browser/OS supports file sharing (Web Share API level 2)
    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [pdfFile] })
    ) {
      await navigator.share({
        files: [pdfFile],
        title: `تقرير زيارة صفية - ${visit.teacherName}`,
        text: textSummary,
      });
      return;
    }
  } catch (err) {
    console.warn('Web Share failed or dismissed, fallback to WhatsApp text:', err);
  }

  // Fallback to WhatsApp URL
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(textSummary)}`, '_blank');
}

export interface ActionPlansPrintOptions {
  stageName?: string;
  stageManagerName?: string;
  statusFilter?: 'ALL' | 'ACTIVE' | 'RESOLVED';
  isRtl?: boolean;
  lang?: string;
  autoPrint?: boolean;
}

export function generateActionPlansReportHtml(
  plans: StudentActionPlan[],
  settings: SchoolSettings,
  optionsOrRtl: boolean | ActionPlansPrintOptions = true,
  langArg: string = 'ar',
  autoPrintArg: boolean = true
): string {
  let isRtl = true;
  let lang = 'ar';
  let autoPrint = true;
  let stageName = 'جميع المراحل التعليمية';
  let stageManagerName = settings.stageManagers?.[0]?.name || 'إدارة المرحلة';
  let statusFilter: 'ALL' | 'ACTIVE' | 'RESOLVED' = 'ALL';

  if (typeof optionsOrRtl === 'object' && optionsOrRtl !== null) {
    if (optionsOrRtl.stageName) stageName = optionsOrRtl.stageName;
    if (optionsOrRtl.stageManagerName) stageManagerName = optionsOrRtl.stageManagerName;
    if (optionsOrRtl.statusFilter) statusFilter = optionsOrRtl.statusFilter;
    if (optionsOrRtl.isRtl !== undefined) isRtl = optionsOrRtl.isRtl;
    if (optionsOrRtl.lang) lang = optionsOrRtl.lang;
    if (optionsOrRtl.autoPrint !== undefined) autoPrint = optionsOrRtl.autoPrint;
  } else if (typeof optionsOrRtl === 'boolean') {
    isRtl = optionsOrRtl;
    lang = langArg;
    autoPrint = autoPrintArg;
  }

  // Filter plans based on status filter
  let filteredPlans = plans;
  if (statusFilter === 'ACTIVE') {
    filteredPlans = plans.filter(p => p.status === 'ACTIVE');
  } else if (statusFilter === 'RESOLVED') {
    filteredPlans = plans.filter(p => p.status === 'RESOLVED');
  }

  const schoolName = settings.schoolName || '';
  const departmentName = settings.departmentName || '';
  const currentTerm = settings.currentTerm || '';
  const rawHodName = settings.hodName || '';
  const hodName = rawHodName.replace(/^أ[\.\/]\s*/, ''); // strip prefix if present to format cleanly with أ/

  const activeCount = filteredPlans.filter(p => p.status === 'ACTIVE').length;
  const resolvedCount = filteredPlans.filter(p => p.status === 'RESOLVED').length;
  const totalCount = filteredPlans.length;
  const successRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  const bodyLoadAttr = autoPrint ? 'onload="window.print(); window.onafterprint = function() { window.close(); }"' : '';

  const tableRowsHtml = filteredPlans.length === 0
    ? '<tr><td colspan="7" style="text-align:center; padding: 12px; color: #64748b; font-style: italic;">لا توجد خطط دعم مسجلة تطابق محددات التصفية المختارة.</td></tr>'
    : filteredPlans.map((p, idx) => {
        const weaknessStr = p.weaknessAreas && p.weaknessAreas.length > 0 ? p.weaknessAreas.join(' • ') : '-';
        const actionStr = p.actionSteps && p.actionSteps.length > 0 ? p.actionSteps.join(' • ') : '-';
        const statusBadge = p.status === 'ACTIVE'
          ? '<span style="background-color: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; border: 1px solid #fcd34d; font-size: 8pt; font-weight: bold;">🟡 قيد المتابعة</span>'
          : '<span style="background-color: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; border: 1px solid #6ee7b7; font-size: 8pt; font-weight: bold;">🟢 تم الإغلاق</span>';

        return '<tr style="background-color: ' + (idx % 2 === 0 ? '#ffffff' : '#f8fafc') + ';">' +
          `<td style="text-align: center; font-weight: bold; padding: 6px; border: 1px solid #cbd5e1;">${idx + 1}</td>` +
          `<td style="font-weight: bold; color: #0f172a; padding: 6px; border: 1px solid #cbd5e1;">${p.studentNameAr || p.studentNameEn}${p.studentNameEn && p.studentNameAr ? `<br/><small style="color: #64748b; font-weight: normal;">(${p.studentNameEn})</small>` : ''}</td>` +
          `<td style="text-align: center; font-weight: bold; padding: 6px; border: 1px solid #cbd5e1;">${p.gradeClass}</td>` +
          `<td style="font-weight: bold; color: #334155; padding: 6px; border: 1px solid #cbd5e1;">${p.teacherName}</td>` +
          `<td style="font-size: 8.5pt; color: #9f1239; padding: 6px; border: 1px solid #cbd5e1;">${weaknessStr}</td>` +
          `<td style="font-size: 8.5pt; color: #065f46; padding: 6px; border: 1px solid #cbd5e1;">${actionStr}</td>` +
          `<td style="text-align: center; padding: 6px; border: 1px solid #cbd5e1;">${statusBadge}</td>` +
        '</tr>';
      }).join('');

  const logoHtml = getReportSchoolLogoHtml(settings, { height: 50 });

  return '<!DOCTYPE html>' +
    '<html lang="' + lang + '" dir="' + (isRtl ? 'rtl' : 'ltr') + '">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<title>تقرير خطط الدعم الأكاديمي الشامل</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">' +
      '<style>' +
        '@page { size: A4 portrait; margin: 10mm; }' +
        '@media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }' +
        '* { box-sizing: border-box; margin: 0; padding: 0; font-family: "Cairo", "Tajawal", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }' +
        'body { padding: 15px; color: #0f172a; background: #fff; direction: ' + (isRtl ? 'rtl' : 'ltr') + '; text-align: ' + (isRtl ? 'right' : 'left') + '; font-size: 9.5pt; line-height: 1.4; -webkit-font-smoothing: antialiased; }' +
        '.formal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #047857; padding-bottom: 10px; margin-bottom: 12px; }' +
        '.brand-section { display: flex; align-items: center; gap: 14px; }' +
        '.logo-img { max-height: 52px; max-width: 120px; object-fit: contain; }' +
        '.school-name { font-size: 14pt; font-weight: 900; color: #0f172a; line-height: 1.3; }' +
        '.dept-name { font-size: 10pt; font-weight: 700; color: #047857; line-height: 1.3; }' +
        '.doc-title-box { text-align: left; }' +
        '.doc-title { font-size: 11pt; font-weight: 900; color: #065f46; background: #ecfdf5; padding: 4px 12px; border-radius: 6px; border: 1px solid #a7f3d0; display: inline-block; }' +
        '.metadata-bar { display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; margin-bottom: 14px; font-size: 9pt; font-weight: 700; }' +
        '.meta-item { display: flex; align-items: center; gap: 5px; }' +
        '.meta-label { color: #64748b; font-weight: 600; }' +
        '.meta-value { color: #0f172a; }' +
        '.metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; text-align: center; }' +
        '.metric-card { padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; }' +
        '.metric-title { font-size: 8pt; color: #64748b; font-weight: 700; }' +
        '.metric-val { font-size: 13pt; font-weight: 900; color: #0f172a; margin-top: 2px; }' +
        'table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 8.5pt; }' +
        'th { background-color: #047857; color: #ffffff; padding: 6px 8px; border: 1px solid #047857; font-weight: 900; text-align: right; }' +
        'td { padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: top; }' +
        'tr:nth-child(even) { background-color: #f8fafc; }' +
        '.signatures-container { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-start; padding: 0 30px; page-break-inside: avoid; break-inside: avoid; }' +
        '.sig-block { width: 42%; text-align: center; display: flex; flex-direction: column; align-items: center; }' +
        '.sig-job-title { font-size: 10pt; font-weight: 900; color: #0f172a; margin-bottom: 4px; }' +
        '.sig-person-name { font-size: 9.5pt; font-weight: 700; color: #334155; margin-bottom: 18px; }' +
        '.sig-dotted-line { width: 180px; text-align: center; color: #64748b; font-weight: normal; letter-spacing: 2px; font-size: 10pt; }' +
      '</style>' +
    '</head>' +
    '<body ' + bodyLoadAttr + '>' +
      '<div class="formal-header">' +
        '<div class="brand-section">' +
          logoHtml +
          '<div>' +
            '<div class="school-name">' + schoolName + '</div>' +
            '<div class="dept-name">' + departmentName + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="doc-title-box">' +
          '<div class="doc-title">تقرير خطط الدعم الأكاديمي</div>' +
        '</div>' +
      '</div>' +

      '<div class="metadata-bar">' +
        '<div class="meta-item"><span class="meta-label">المرحلة التعليمية:</span> <span class="meta-value">' + stageName + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">الفصل الدراسي:</span> <span class="meta-value">' + currentTerm + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">تاريخ الإصدار:</span> <span class="meta-value">' + new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) + '</span></div>' +
      '</div>' +

      '<div class="metrics-grid">' +
        '<div class="metric-card"><div class="metric-title">إجمالي الخُطط</div><div class="metric-val">' + totalCount + '</div></div>' +
        '<div class="metric-card" style="background: #fffbeb; border-color: #fde68a;"><div class="metric-title" style="color: #92400e;">قيد المتابعة</div><div class="metric-val" style="color: #92400e;">' + activeCount + '</div></div>' +
        '<div class="metric-card" style="background: #ecfdf5; border-color: #a7f3d0;"><div class="metric-title" style="color: #065f46;">تم الإغلاق والتمكن</div><div class="metric-val" style="color: #065f46;">' + resolvedCount + '</div></div>' +
        '<div class="metric-card"><div class="metric-title">نسبة النجاح والتمكن</div><div class="metric-val">' + successRate + '%</div></div>' +
      '</div>' +

      '<table>' +
        '<thead>' +
          '<tr>' +
            '<th style="width: 25px; text-align: center;">#</th>' +
            '<th style="width: 120px;">اسم الطالب</th>' +
            '<th style="width: 50px; text-align: center;">الفصل</th>' +
            '<th style="width: 100px;">المعلم المسؤول</th>' +
            '<th>نقاط الضعف المرصودة</th>' +
            '<th>الإجراءات والحلول العلاجية</th>' +
            '<th style="width: 85px; text-align: center;">الحالة الحالية</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          tableRowsHtml +
        '</tbody>' +
      '</table>' +

      '<div class="signatures-container">' +
        '<div class="sig-block">' +
          '<div class="sig-job-title">رئيس قسم اللغة الألمانية</div>' +
          '<div class="sig-person-name">أ/ ' + hodName + '</div>' +
          '<div class="sig-dotted-line">..................................</div>' +
        '</div>' +
        '<div class="sig-block">' +
          '<div class="sig-job-title">مدير المرحلة</div>' +
          '<div class="sig-person-name" style="letter-spacing: 2px; color: #64748b; font-weight: normal;">..................................</div>' +
          '<div class="sig-dotted-line">..................................</div>' +
        '</div>' +
      '</div>' +
    '</body>' +
    '</html>';
}

export function printActionPlansReport(
  plans: StudentActionPlan[],
  settings: SchoolSettings,
  optionsOrRtl: boolean | ActionPlansPrintOptions = true,
  lang: string = 'ar'
) {
  const htmlStr = generateActionPlansReportHtml(plans, settings, optionsOrRtl, lang, true);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlStr);
    printWindow.document.close();
  } else {
    // Fallback for Android WebView & Chrome popup blockers
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
      doc.write(htmlStr);
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

export async function downloadActionPlansPdf(
  plans: StudentActionPlan[],
  settings: SchoolSettings,
  optionsOrRtl: boolean | ActionPlansPrintOptions = true,
  lang: string = 'ar'
): Promise<{ success: boolean; filename: string; error?: string }> {
  const htmlStr = generateActionPlansReportHtml(plans, settings, optionsOrRtl, lang, false);
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '794px';
  container.innerHTML = htmlStr;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 5000,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        const styles = clonedDoc.querySelectorAll('style');
        styles.forEach(s => {
          if (s.textContent) {
            s.textContent = sanitizeModernCssColors(s.textContent);
          }
        });
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    const fileName = `خطط_علاجية_${new Date().toISOString().split('T')[0]}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: `خطط علاجية للطلاب`,
        url: savedFile.uri
      });
    } else {
      pdf.save(fileName);
    }
    return { success: true, filename: fileName };
  } catch (error: any) {
    console.error('Error generating Action Plans PDF:', error);
    return { success: false, filename: '', error: error?.message || 'Download failed' };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}



