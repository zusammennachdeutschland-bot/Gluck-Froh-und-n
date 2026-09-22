import { Complaint, SchoolSettings, VisitRecord } from '../types';
import { getReportSchoolLogoHtml } from './alsunLogoData';
import { generateObservationReportContentHtml } from './printObservationUtils';

export interface StageManagerReportData {
  stageManagerName: string;
  stageName?: string;
  term: string;
  month?: string;
  reportDate: string;
  hodName: string;
  complaints: Complaint[];
  reportType: 'weekly' | 'monthly' | 'termly';
  settings?: SchoolSettings;
  visits?: VisitRecord[];
  includeVisits?: boolean;
}

export const generateStageManagerReportPrint = (data: StageManagerReportData) => {
  const {
    stageManagerName,
    stageName = 'المرحلة الدراسية',
    term,
    month = '',
    reportDate,
    hodName = '',
    complaints,
    reportType,
    settings,
    visits = [],
    includeVisits = false,
  } = data;

  const visitsToRender = (includeVisits && visits && visits.length > 0) ? visits : [];
  const schoolName = settings?.schoolName || '';
  const logoHtml = getReportSchoolLogoHtml(settings, { height: 50 });

  const teacherToStudentCount = complaints.filter(c => c.direction === 'TEACHER_TO_STUDENT').length;
  const studentToTeacherCount = complaints.filter(c => c.direction === 'STUDENT_TO_TEACHER').length;
  const unsentCount = complaints.filter(c => !c.weeklyReportSent).length;

  const titleText = reportType === 'weekly' 
    ? 'تقرير الشكاوى والمتابعة الأسبوعية لمدير المرحلة' 
    : reportType === 'monthly'
    ? `تقرير الشكاوى المتبادلة الشهري - شهر ${month}`
    : `التقرير التراكمي للشكاوى - ${term}`;

  const rowsHtml = complaints.map((c, index) => {
    const isTeacherToStudent = c.direction === 'TEACHER_TO_STUDENT';
    const directionBadge = isTeacherToStudent
      ? `<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 8pt; border: 1px solid #fca5a5;">👨‍🏫 معلم ضد طالب</span>`
      : `<span style="background-color: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 8pt; border: 1px solid #a5b4fc;">👦 طالب/ولي أمر ضد معلم</span>`;

    const formattedDate = new Date(c.timestamp).toLocaleDateString('ar-EG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const statusBadge = c.weeklyReportSent
      ? `<span style="color: #2563eb; font-weight: bold;">📑 تم الإرسال (${c.weeklyReportDate ? new Date(c.weeklyReportDate).toLocaleDateString('ar-EG') : 'سابقاً'})</span>`
      : `<span style="color: #d97706; font-weight: bold;">🆕 بانتظار التقرير الأسبوعي</span>`;

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9pt;">
        <td style="padding: 6px 4px; text-align: center; font-weight: bold; color: #64748b;">${index + 1}</td>
        <td style="padding: 6px 4px; text-align: center;">${directionBadge}</td>
        <td style="padding: 6px 4px; font-weight: bold; color: #1e293b;">${c.teacherName || 'غير محدد'}</td>
        <td style="padding: 6px 4px;">
          <div style="font-weight: bold; color: #0f172a;">${c.studentNameAr || c.studentNameEn}</div>
          ${c.studentNameEn && c.studentNameAr ? `<div style="font-size: 8pt; color: #64748b; font-family: sans-serif;">${c.studentNameEn}</div>` : ''}
        </td>
        <td style="padding: 6px 4px; text-align: center; font-weight: bold; color: #2563eb;">${c.gradeClass}</td>
        <td style="padding: 6px 4px; color: #334155; line-height: 1.4;">
          <strong>${c.reason}</strong>
          ${c.notes ? `<div style="font-size: 8pt; color: #64748b; margin-top: 2px;">📝 ${c.notes}</div>` : ''}
        </td>
        <td style="padding: 6px 4px; color: #047857; font-weight: bold;">${c.actionTaken}</td>
        <td style="padding: 6px 4px; text-align: center; font-size: 8.5pt; color: #475569;">
          <div>${formattedDate}</div>
          <div style="font-size: 7.5pt; margin-top: 2px;">${statusBadge}</div>
        </td>
      </tr>
    `;
  }).join('');

  const printHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${titleText} - ${stageManagerName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
        }
        * {
          box-sizing: border-box;
          font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        body {
          background-color: #fff;
          color: #0f172a;
          margin: 0;
          padding: 10px;
          direction: rtl;
          text-align: right;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          -webkit-font-smoothing: antialiased;
        }
        .header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2.5px solid #0284c7;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .header-logo {
          display: flex;
          align-items: center;
          min-width: 60px;
        }
        .header-title-box {
          text-align: center;
          flex-grow: 1;
          padding: 0 10px;
        }
        .dept-badge {
          background-color: #0284c7;
          color: white;
          padding: 3px 12px;
          border-radius: 20px;
          font-size: 9.5pt;
          font-weight: 800;
          display: inline-block;
          margin-bottom: 4px;
        }
        .main-title {
          font-size: 13pt;
          font-weight: 900;
          color: #0f172a;
          margin: 3px 0;
          line-height: 1.3;
        }
        .sub-meta {
          font-size: 8.5pt;
          color: #475569;
          font-weight: 700;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 12px;
          text-align: center;
        }
        .stat-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 4px;
          background-color: #f8fafc;
        }
        .stat-val {
          font-size: 13pt;
          font-weight: 900;
          color: #0284c7;
          line-height: 1.2;
        }
        .stat-lbl {
          font-size: 7.5pt;
          font-weight: 700;
          color: #64748b;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        th {
          background-color: #f1f5f9;
          color: #1e293b;
          font-size: 8.5pt;
          font-weight: 800;
          padding: 6px 4px;
          border: 1px solid #cbd5e1;
          text-align: right;
        }
        td {
          border: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .footer-sig {
          margin-top: 25px;
          display: flex;
          justify-content: space-between;
          padding: 0 20px;
          page-break-inside: avoid;
        }
        .sig-box {
          text-align: center;
          width: 42%;
          border-top: 1px solid #cbd5e1;
          padding-top: 8px;
        }
        .sig-title {
          font-size: 9.5pt;
          font-weight: 800;
          color: #1e293b;
        }
        .sig-sub {
          font-size: 8.5pt;
          color: #64748b;
          margin-top: 4px;
        }
        .no-print {
          display: block;
        }
        .report-page {
          width: 100%;
          background: #ffffff;
          box-sizing: border-box;
        }
        .page-break {
          page-break-after: always;
          break-after: page;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
        }

        /* Observation Visit Report Styles */
        .visit-page {
          page-break-before: always;
          break-before: page;
          padding-top: 5px;
          min-height: 100%;
        }
        .visit-page .report-single-page {
          width: 100%;
        }
        .visit-page .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 4px;
          margin-bottom: 6px;
        }
        .visit-page .header-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 60px;
        }
        .visit-page .header-text {
          text-align: center;
          flex: 1;
          padding: 0 10px;
        }
        .visit-page .header h1 {
          font-size: 13pt;
          margin: 0 0 2px;
          font-weight: 800;
          line-height: 1.3;
          color: #0f172a;
        }
        .visit-page .header p {
          font-size: 8.5pt;
          margin: 0;
          font-weight: 700;
          line-height: 1.3;
          color: #334155;
        }
        .visit-page .title {
          text-align: center;
          font-size: 11pt;
          font-weight: 800;
          margin-bottom: 6px;
          text-decoration: underline;
          line-height: 1.3;
          color: #0f172a;
        }
        .visit-page .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 12px;
          margin-bottom: 6px;
          border: 1.5px solid #0f172a;
          padding: 5px 8px;
          background: #f8fafc;
          align-items: center;
          border-radius: 4px;
        }
        .visit-page .meta-item {
          font-size: 8.5pt;
          font-weight: 600;
          line-height: 1.3;
          display: flex;
          align-items: center;
          color: #1e293b;
        }
        .visit-page .meta-label {
          font-weight: 800;
          margin-right: 5px;
          margin-left: 5px;
          display: inline-block;
          color: #0f172a;
          white-space: nowrap;
        }
        .visit-page .category-title {
          font-size: 8.5pt;
          font-weight: 800;
          margin-top: 3px;
          margin-bottom: 2px;
          background: #e2e8f0;
          padding: 2.5px 6px;
          border: 1px solid #0f172a;
          border-bottom: none;
          line-height: 1.25;
          vertical-align: middle;
          color: #0f172a;
        }
        .visit-page table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 3px;
          table-layout: fixed;
        }
        .visit-page th, .visit-page td {
          border: 1px solid #0f172a;
          padding: 2.5px 4px;
          text-align: center;
          vertical-align: middle;
          font-size: 8pt;
          line-height: 1.2;
        }
        .visit-page th {
          background: #f1f5f9;
          font-weight: 800;
          font-size: 8pt;
          height: 18px;
          color: #0f172a;
        }
        .visit-page .criteria-col {
          text-align: right;
          width: 55%;
          font-weight: 700;
          vertical-align: middle;
          padding-left: 6px;
          padding-right: 6px;
          line-height: 1.25;
          color: #1e293b;
        }
        .visit-page .rating-col {
          width: 9%;
          font-weight: bold;
          font-size: 9pt;
          text-align: center;
          vertical-align: middle;
          line-height: 1;
        }
        .visit-page .feedback-section {
          margin-top: 5px;
          border: 1.5px solid #0f172a;
          padding: 5px 8px;
          min-height: 35px;
          background: #f8fafc;
          border-radius: 4px;
        }
        .visit-page .feedback-title {
          font-weight: 800;
          font-size: 8pt;
          margin-bottom: 2px;
          border-bottom: 1px dotted #0f172a;
          padding-bottom: 2px;
          line-height: 1.25;
          color: #0f172a;
        }
        .visit-page .overall-box {
          margin-top: 5px;
          padding: 4px 6px;
          border: 1.5px solid #0f172a;
          font-weight: 800;
          text-align: center;
          font-size: 9pt;
          display: flex;
          justify-content: space-around;
          align-items: center;
          background: #f8fafc;
          line-height: 1.25;
          border-radius: 4px;
        }
        .visit-page .signatures {
          margin-top: 10px;
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          text-align: center;
          page-break-inside: avoid;
        }
        .visit-page .sig-block {
          width: 40%;
        }
        .visit-page .sig-title {
          font-weight: 800;
          font-size: 8.5pt;
          margin-bottom: 12px;
          line-height: 1.25;
          color: #0f172a;
        }
        .visit-page .sig-line {
          border-top: 1px solid #0f172a;
          padding-top: 3px;
          font-size: 8pt;
          font-weight: 800;
          line-height: 1.25;
          color: #1e293b;
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 12px; background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="font-weight: 700; font-size: 9.5pt;">
          📄 معاينة جاهزة للطباعة أو الحفظ كـ PDF
          ${visitsToRender.length > 0 ? `<span style="margin-right: 8px; background: rgba(59, 130, 246, 0.2); color: #93c5fd; padding: 2px 8px; border-radius: 4px; font-size: 8.5pt;">(الصفحة 1: تقرير المتابعة، والصفحات التالية: ${visitsToRender.length} زيارات صفية)</span>` : ''}
        </div>
        <button onclick="window.print()" style="background: #2563eb; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 9pt; cursor: pointer; display: flex; items-center; gap: 6px;">
          🖨️ طباعة / حفظ PDF
        </button>
      </div>

      <!-- PAGE 1: STAGE MANAGER SUMMARY & COMPLAINTS -->
      <div class="report-page stage-first-page ${visitsToRender.length > 0 ? 'page-break' : ''}">
        <div class="header-container">
          <div class="header-logo">
            ${logoHtml}
          </div>
          <div class="header-title-box">
            <div style="font-size: 13pt; font-weight: 900; color: #0f172a; margin-bottom: 2px;">${schoolName}</div>
            <div class="dept-badge">🇩🇪 قسم اللغة الألمانية (Deutschabteilung)</div>
            <div class="main-title">${titleText}</div>
            <div class="sub-meta">المرحلة: ${stageName} | مدير المرحلة: <strong>..................................</strong></div>
          </div>
          <div style="text-align: left; font-size: 8.5pt; color: #475569;">
            <div><strong>الفصل الدراسي:</strong> ${term}</div>
            <div><strong>تاريخ التقرير:</strong> ${reportDate}</div>
          </div>
        </div>

        <!-- Quick Metrics -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-val">${complaints.length}</div>
            <div class="stat-lbl">إجمالي الشكاوى المسجلة</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #b91c1c;">${teacherToStudentCount}</div>
            <div class="stat-lbl">شكاوى المعلمين ضد الطلاب</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #4338ca;">${studentToTeacherCount}</div>
            <div class="stat-lbl">شكاوى الطلاب/أولياء الأمور</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #d97706;">${unsentCount}</div>
            <div class="stat-lbl">غير مدرجة بتقرير سابق</div>
          </div>
        </div>

        <!-- Main Table -->
        ${complaints.length === 0 ? `
          <div style="text-align: center; padding: 30px; border: 2px dashed #cbd5e1; border-radius: 12px; color: #64748b; font-weight: bold;">
            لا توجد أي شكاوى مسجلة في هذا التقرير للفترة المحددة.
          </div>
        ` : `
          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th style="width: 110px; text-align: center;">اتجاه الشكوى</th>
                <th style="width: 120px;">المعلم المعني</th>
                <th style="width: 140px;">الطالب (عربي / English)</th>
                <th style="width: 50px; text-align: center;">الفصل</th>
                <th>السبب / تفاصيل الملاحظة</th>
                <th style="width: 130px;">الإجراء المتخذ</th>
                <th style="width: 90px; text-align: center;">التاريخ/الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `}

        <!-- Footer Signatures: Right side = German HOD, Left side = Stage Manager with dotted lines -->
        <div class="footer-sig">
          <div class="sig-box">
            <div class="sig-title">رئيس قسم اللغة الألمانية (Fachleiter)</div>
            <div class="sig-sub">أ/ ${hodName}</div>
            <div style="margin-top: 25px; font-size: 8.5pt; color: #64748b;">التوقيع: ................................</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">مدير المرحلة (Stage Manager)</div>
            <div class="sig-sub" style="letter-spacing: 2px; color: #64748b; font-weight: normal;">..................................</div>
            <div style="margin-top: 25px; font-size: 8.5pt; color: #64748b;">التوقيع: ................................</div>
          </div>
        </div>
      </div>

      <!-- PAGES 2+: ATTACHED CLASSROOM VISITS (EACH VISIT ON A SEPARATE PAGE) -->
      ${visitsToRender.map((visit, idx) => {
        const isLast = idx === visitsToRender.length - 1;
        const visitContent = generateObservationReportContentHtml(visit, settings || ({} as any), true, 'ar');
        return `
          <div class="report-page visit-page ${!isLast ? 'page-break' : ''}">
            ${visitContent}
          </div>
        `;
      }).join('')}

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (printWindow) {
    printWindow.document.write(printHtml);
    printWindow.document.close();
  } else {
    // Fallback for Android WebView / Chrome popup blocker
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
      doc.write(printHtml);
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
};
