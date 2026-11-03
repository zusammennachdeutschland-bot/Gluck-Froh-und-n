# Walkthrough — صفحة "الملفات المحملة" وحفظ الملفات في مساحة الهاتف قبل المشاركة

## 1. فولدر البرنامج والفولدرات الفرعية في مساحة الهاتف الداخلية
تم إنشاء خدمة مركزية (`src/services/downloadedFilesService.ts`) تقوم تلقائياً بإنشاء فولدر رئيسي باسم البرنامج داخل مساحة الهاتف الداخلية (`Documents/Gluck_Lernstudio`) وبداخله **7 فولدرات فرعية** منظمة لكل نوع ملف أو شهادة:

- `Documents/Gluck_Lernstudio/Worksheets` — أوراق العمل والشيتات (`PDF` / `HTML`)
- `Documents/Gluck_Lernstudio/Certificates` — شهادات التقدير (`PDF` / `PNG`)
- `Documents/Gluck_Lernstudio/Parent_Reports` — تقارير أولياء الأمور والطلاب وطابور الواتساب
- `Documents/Gluck_Lernstudio/Schedules` — الجداول الدراسية وجدول المواعيد (`PDF` / `PNG` / `ICS`)
- `Documents/Gluck_Lernstudio/School_Plans_And_Visits` — الخطط الأسبوعية، خطط الزيارات، وتقارير الملاحظة الصفية
- `Documents/Gluck_Lernstudio/Finance_And_Receipts` — إشعارات المصروفات والماليات
- `Documents/Gluck_Lernstudio/Backups_And_Contacts` — النسخ الاحتياطية (`JSON`) وجهات الاتصال (`VCF`)

## 2. الحفظ التلقائي قبل مشاركة الواتساب أو الطباعة أو التحميل
تم ربط جميع مسارات التصدير والمشاركة والطباعة في التطبيق بحيث يتم **أولاً حفظ الملف فعلياً في الفولدر الفرعي المخصص له على الهاتف** وتسجيله في أرشيف البرنامج قبل فتح الواتساب أو نافذة المشاركة:
- **الشهادات** (`certificateExportUtils.ts`)
- **الشيتات وأوراق العمل** (`lernstudioPdfUtils.ts`)
- **تقارير أولياء الأمور وطابور الإرسال السريع** (`ArabicParentReportModal.tsx`, `WhatsAppDispatchQueueModal.tsx`)
- **الجداول المدرسية والرئيسية** (`schoolScheduleExportService.ts`, `masterScheduleExportService.ts`)
- **الخطط الأسبوعية والزيارات الإشرافية والملاحظات الصفية** (`weeklyPlanPrintUtils.ts`, `termVisitPrintUtils.ts`, `printObservationUtils.ts`)
- **إشعارات الدفع والماليات** (`FinanceStudentPayments.tsx`)
- **النسخ الاحتياطية وجهات الاتصال** (`AppContext.tsx`, `contactsSyncService.ts`)

## 3. صفحة "الملفات المحملة" في الإعدادات (`SettingsView.tsx` & `DownloadedFilesSection.tsx`)
- تمت إضافة قسم **"الملفات المحملة"** كأول بطاقة في صفحة **الإعدادات (Settings)**.
- **بانر مسار التخزين**: يعرض مسار الفولدر الرئيسي على الهاتف (`Documents/Gluck_Lernstudio`) مع إمكانية الضغط على أي فولدر فرعي لفلترة ملفاته فوراً.
- **فلترة شاملة وذكية**:
  - **حسب القسم**: الكل، أوراق العمل والشيتات، الشهادات، تقارير أولياء الأمور، الجداول، الخطط والزيارات، الماليات، النسخ وجهات الاتصال.
  - **حسب طريقة الإنشاء**: الكل، واتساب / مشاركة، تحميل وحفظ، طباعة.
  - **حسب التاريخ**: كل الأوقات، اليوم، آخر 7 أيام، هذا الشهر.
  - **بحث نصي فوري**: باسم الملف، اسم الطالب، الفصل، أو الفولدر الفرعي.
- **إجراءات مباشرة على كل ملف**: معاينة محتوى الملف أو التقرير من داخل التطبيق، إعادة إرسال عبر واتساب، إعادة طباعة، إعادة تحميل، نسخ النص، أو الحذف.
