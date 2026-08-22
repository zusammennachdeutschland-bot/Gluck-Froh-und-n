import { Complaint } from '../types';

export interface StageManagerReportData {
  stageManagerName: string;
  stageName?: string;
  term: string;
  month?: string;
  reportDate: string;
  hodName: string;
  complaints: Complaint[];
  reportType: 'weekly' | 'monthly' | 'termly';
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
  } = data;

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
      ? `<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 8px; rounded: 4px; font-weight: bold; font-size: 8pt; border: 1px solid #fca5a5;">👨‍🏫 معلم ضد طالب</span>`
      : `<span style="background-color: #e0e7ff; color: #3730a3; padding: 2px 8px; rounded: 4px; font-weight: bold; font-size: 8pt; border: 1px solid #a5b4fc;">👦 طالب/ولي أمر ضد معلم</span>`;

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
        <td style="padding: 8px 6px; text-align: center; font-weight: bold; color: #64748b;">${index + 1}</td>
        <td style="padding: 8px 6px; text-align: center;">${directionBadge}</td>
        <td style="padding: 8px 6px; font-weight: bold; color: #1e293b;">${c.teacherName || 'غير محدد'}</td>
        <td style="padding: 8px 6px;">
          <div style="font-weight: bold; color: #0f172a;">${c.studentNameAr || c.studentNameEn}</div>
          ${c.studentNameEn && c.studentNameAr ? `<div style="font-size: 8pt; color: #64748b; font-family: sans-serif;">${c.studentNameEn}</div>` : ''}
        </td>
        <td style="padding: 8px 6px; text-align: center; font-weight: bold; color: #2563eb;">${c.gradeClass}</td>
        <td style="padding: 8px 6px; color: #334155; line-height: 1.4;">
          <strong>${c.reason}</strong>
          ${c.notes ? `<div style="font-size: 8pt; color: #64748b; margin-top: 2px;">📝 ${c.notes}</div>` : ''}
        </td>
        <td style="padding: 8px 6px; color: #047857; font-weight: bold;">${c.actionTaken}</td>
        <td style="padding: 8px 6px; text-align: center; font-size: 8.5pt; color: #475569;">
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
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 15mm 10mm;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #fff;
          color: #0f172a;
          margin: 0;
          padding: 0;
          direction: rtl;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 3px double #0284c7;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .header-title-box {
          text-align: center;
          flex-grow: 1;
        }
        .dept-badge {
          background-color: #0284c7;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 10pt;
          font-weight: bold;
          display: inline-block;
          margin-bottom: 5px;
        }
        .main-title {
          font-size: 14pt;
          font-weight: 900;
          color: #0f172a;
          margin: 4px 0;
        }
        .sub-meta {
          font-size: 9pt;
          color: #475569;
          font-weight: bold;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 15px;
          text-align: center;
        }
        .stat-card {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px;
          background-color: #f8fafc;
        }
        .stat-val {
          font-size: 12pt;
          font-weight: 900;
          color: #0369a1;
        }
        .stat-lbl {
          font-size: 8pt;
          color: #64748b;
          font-weight: bold;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background-color: #f1f5f9;
          color: #1e293b;
          font-size: 9pt;
          font-weight: 800;
          padding: 8px 6px;
          border-bottom: 2px solid #cbd5e1;
          text-align: right;
        }
        .footer-sig {
          margin-top: 30px;
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
          font-size: 10pt;
          font-weight: bold;
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
        <div>
          <div style="font-size: 11pt; font-weight: 900; color: #0369a1;">قسم اللغة الألمانية (Deutschabteilung)</div>
          <div style="font-size: 8.5pt; color: #64748b;">إدارة المتابعة والتقييم - نظام الشكاوى المتبادل</div>
        </div>
        <div class="header-title-box">
          <div class="dept-badge">🇩🇪 German Department</div>
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
