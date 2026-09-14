import { Complaint, SchoolSettings } from '../types';
import { getReportSchoolLogoHtml } from './alsunLogoData';

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
}

export const generateStageManagerReportPrint = (data: StageManagerReportData) => {
  const {
    stageManagerName,
    stageName = 'المرحلة الدراسية',
    term,
    month = '',
    reportDate,
    hodName = 'عبد الرحمن غريب',
    complaints,
    reportType,
    settings,
  } = data;

  const schoolName = settings?.schoolName || 'مدرسة الألسن للغات';
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
      </style>
    </head>
    <body>
      <div class="header-container">
        <div class="header-logo">
          ${logoHtml}
        </div>
        <div class="header-title-box">
          <div style="font-size: 13pt; font-weight: 900; color: #0f172a; margin-bottom: 2px;">${schoolName}</div>
          <div class="dept-badge">🇩🇪 قسم اللغة الألمانية (Deutschabteilung)</div>
          <div class="main-title">${titleText}</div>
          <div class="sub-meta">المرحلة: ${stageName} | الموجه / مدير المرحلة: <strong>${stageManagerName}</strong></div>
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

      <!-- Footer Signatures -->
      <div class="footer-sig">
        <div class="sig-box">
          <div class="sig-title">رئيس قسم اللغة الألمانية (Fachleiter)</div>
          <div class="sig-sub">${hodName}</div>
          <div style="margin-top: 25px; font-size: 8pt; color: #94a3b8;">التوقيع: ................................</div>
        </div>
        <div class="sig-box">
          <div class="sig-title">مدير المرحلة (Stage Manager)</div>
          <div class="sig-sub">${stageManagerName}</div>
          <div style="margin-top: 25px; font-size: 8pt; color: #94a3b8;">التوقيع: ................................</div>
        </div>
      </div>

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
  }
};
