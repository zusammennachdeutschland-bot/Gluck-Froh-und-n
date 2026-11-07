# خطة عمل: الإصلاح الشامل للمزامنة السحابية (Google Cloud Sync) وإضافة ميزة تنظيف بيانات السحابة

بناءً على الفحص الدقيق للكود الحالي وإجاباتك الكريمة، تتضمن هذه الخطة معالجة جذرية لجميع مشاكل المزامنة السحابية وضمان عدم فقدان أي بيانات محلية أو استهلاك غير مبرر للحصة اليومية، مع إضافة زر تنظيف بيانات السحابة.

---

## 1. الأهداف والقرارات المعتمدة
1. **نطاق تنظيف بيانات السحابة (Clear Cloud Data)**:
   - حذف بيانات مساحة العمل السحابية الخاصة (`user_workspaces/{uid}/categories` و `user_workspaces/{legacyEmailId}/categories`) ومخزن الـ Relay (`/api/workspace/delta`).
   - الإبقاء الكامل على الواجبات المنشورة المشتركة للطلاب (`homework_assignments`).
   - الإبقاء الكامل على البيانات المحلية للجهاز وملفات النسخ الاحتياطي المحلية ومستخدم المصادقة (Firebase Auth User).
   - إيقاف المزامنة التلقائية فوراً (`autoCloudSyncEnabled = false`) مع حفظ هذه الحالة في التخزين المحلي لمنع إعادة الرفع التلقائي بعدها مباشرة.
2. **مهلة انتظار الرفع التلقائي (Debounce)**:
   - اعتماد مهلة 15 ثانية بعد أي تعديل محلي (مثل إضافة واجب، مجموعة تعليمية، أو تعديل أسماء) لحماية الحصة اليومية ومنع العمليات المتكررة.
3. **مجموعات Lernstudio**:
   - استبعاد مجموعات النظام المضمنة (`DEFAULT_LERNSTUDIO_SETS`) تماماً وبشكل قاطع من الرفع أو التنزيل أو التكرار عبر السحابة.
   - مزامنة المجموعات التعليمية المخصصة التي أنشأها المعلم فقط (`!BUILTIN_LERNSTUDIO_MAP.has(s.id)`) مع دعم علامات الحذف (Tombstones).
4. **تغطية شاملة لجميع أقسام النسخ الاحتياطي**:
   - ضم `financeNotifications` و `customAiBackgrounds` و `prunedLessonIds` و `pickerNames` و `homeworkAssignments` و `homeworkSubmissions` إلى فئات المزامنة التفاضلية (`ENTITY_COLLECTION_KEYS`) و التقسيم (`partitionBackupPayload`).
5. **إصلاح حلقة الإقلاع والتحقق (`hasCompletedInitialCheckRef`)**:
   - عدم اعتماد `hasCompletedInitialCheckRef = true` إلا بعد نجاح قراءة السحابة فعلياً.
   - منع التعامل مع فشل الشبكة أو أخطاء القراءة على أنها سحابة فارغة.
   - استخدام قفل غير متزامن (Mutex/Queue) يمنع تداخل الرفع والتنزيل.

---

## 2. خطوات التنفيذ التفصيلية

### الخطوة 1: تحديث الـ API لدعم تنظيف الـ Relay
- تعديل `src/api/expressApp.ts` لإضافة دعم `DELETE /api/workspace/delta?workspaceId=...` لمسح أجزاء الـ Relay للمعرفين (UID والبريد الإلكتروني القديم).

### الخطوة 2: تحديث محرك المزامنة `src/services/firebaseWorkspaceSync.ts`
1. **تحديث `ENTITY_COLLECTION_KEYS` و `partitionBackupPayload`**:
   - إدراج `financeNotifications` في فئة `finance_gold`.
   - إدراج `customAiBackgrounds` في فئة `profile_settings`.
2. **عزل مجموعات Lernstudio المضمنة**:
   - تعديل دالة ترشيح المجموعات بحيث ترفع فقط المجموعات التي ليست ضمن `BUILTIN_LERNSTUDIO_MAP`.
   - عند الاستعادة، دمج مجموعات النظام الثابتة من حزمة التطبيق مع المجموعات المخصصة المستعادة من السحابة دون تكرار.
3. **تنفيذ دالة تنظيف السحابة `clearCloudWorkspaceData`**:
   - التحقق من هوية المستخدم ومعرف مساحة العمل.
   - حذف مستندات الفئات من مسار مساحة العمل الحالية (`user_workspaces/{uid}/categories`).
   - فحص وحذف مسار مساحة العمل القديمة المبنية على البريد إذا كانت موجودة (`user_workspaces/{legacyEmailId}/categories`).
   - استدعاء `DELETE /api/workspace/delta` لتنظيف مخزن الـ Relay.
   - تنظيف بيانات المزامنة الوصفية المحلية لهذا الحساب فقط (Watermarks, Delta Accumulator, Chunk Cache).
   - التأكد الفعلي من خلو السحابة وإرجاع تقرير دقيق للنجاح.

### الخطوة 3: تحديث خطاف المزامنة التلقائية `src/hooks/useGoogleCloudWorkspaceSync.ts`
1. **تحديث `hasAnyWorkspaceData`**:
   - فحص كافة أقسام البيانات: الطلاب، المجموعات، الحصص، المدفوعات، الشهادات، الإشعارات، المهام، ملاحظات HOD، المالية، المجموعات التعليمية المخصصة (Custom Lernstudio Sets)، إعدادات الملف الشخصي والمدرسة المخصصة، الواجبات والتسليمات، أسماء القرعة، والخلفيات المخصصة.
2. **نظام إشارات التعديل الموحد (Mutation Signal)**:
   - الاستماع لحدث نافذة مخصص `gluck-local-data-mutated` للبيانات التي تُكتب مباشرة في `localStorage` مع تطبيق مهلة الانتظار 15 ثانية.
3. **قفل غير متزامن للعمليات (Sync Mutex)**:
   - استبدال مؤقت `setTimeout` الثابت بقفل `isSyncOperationInFlightRef` يمنع تداخل الرفع التلقائي مع التنزيل في نفس اللحظة.
4. **حماية فحص الإقلاع**:
   - عدم تفعيل `hasCompletedInitialCheckRef = true` في حال حدث خطأ أثناء التنزيل الأولي، وجدولة إعادة محاولة آمنة عند استقرار الاتصال.

### الخطوة 4: ربط مخازن البيانات المباشرة بالحدث الموحد
- إرسال حدث `gluck-local-data-mutated` من:
  - `src/shared/homeworkStorageSync.ts` (عند حفظ أو تعديل الواجبات والتسليمات).
  - `src/components/RandomStudentPickerModal.tsx` (عند حفظ أسماء القرعة المخصصة).
  - دوال حفظ الخلفيات والإشعارات المالية.

### الخطوة 5: إضافة واجهة تنظيف بيانات السحابة في `src/components/GoogleCloudSyncCard.tsx`
- إضافة زر أحمر أنيق متناسق مع تصميم Glück: **"تنظيف بيانات السحابة – Clear Cloud Data"**.
- نافذة تأكيد تحذيرية توضح بدقة:
  - سيتم مسح مساحة العمل السحابية فقط.
  - لن تتأثر بيانات هذا الجهاز المحلية أو النسخ الاحتياطية.
  - ستبقى الواجبات المنشورة المشتركة للطلاب كما هي دون حذف.
  - سيتم إيقاف المزامنة التلقائية تلقائياً لمنع الرفع الفوري.
- عرض شريط تقدم أو مؤشر انتظار أثناء الحذف ورسالة نجاح/فشل واضحة.

### الخطوة 6: إنشاء حزمة الاختبارات الآلية الـ 14 المطلوبة
- إنشاء ملف اختبار متكامل `src/tests/cloudSyncReliability.test.ts` يختبر بشكل واقعي جميع الحالات الـ 14 المحددة في المتطلبات عبر استدعاء دوال الإنتاج الحقيقية:
  1. Login & UID Workspace resolution.
  2. Startup detection with only Custom Lernstudio Sets.
  3. Startup detection with local & cloud data (Merge triggering).
  4. Built-in Lernstudio sets exclusion from upload.
  5. Custom Lernstudio sets upload & deletion tombstones.
  6. Two-way record-level merge without data loss.
  7. Tombstone conflict resolution across devices.
  8. Coverage of all sections (financeNotifications, customAiBackgrounds, etc.).
  9. Non-React localStorage mutation trigger (gluck-local-data-mutated).
  10. False upload success prevention (no watermark advancement on error).
  11. Real-time onSnapshot sync handling.
  12. Clear Cloud Data execution & verification.
  13. Auto-sync pause after cloud clearing.
  14. Network failure retry without corrupting local data.

### الخطوة 7: التحقق والتقرير النهائي
- تشغيل فحص الأنواع `npx tsc --noEmit`.
- تشغيل حزمة الاختبارات `npm test` أو `npx vitest run`.
- تشغيل بناء المشروع `npm run build`.
- تقديم التقرير النهائي باللغة العربية مع جدول تغطية الأقسام وشرح التعديلات بالكامل دون تنفيذ `git push`.
