# المزامنة السحابية الشاملة بحساب جوجل (Full Google Cloud Sync via Firebase)

تهدف هذه الخطة إلى ربط حساب المعلم في **Google (Firebase Auth + Firestore)** بجميع بيانات البرنامج (الطلاب، المجموعات، الجدول والحصص، المدفوعات، النظام المالي، الشهادات، ملاحظات المدرسة، قسم رئيس القسم HOD، المهام السريعة، الإعدادات، ومجموعات وواجبات الليرن ستوديو)، مع مزامنة لحظية تلقائية في الخلفية وزر مزامنة فوري داخل **صفحة الإعدادات (حسابي)** و**مركز النسخ الاحتياطي الذكي**.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> تم بناء هذه الخطة بناءً على اختياراتك المؤكدة في المرحلة الأولى:

- **نطاق البيانات المشمولة بالمزامنة (مؤكد):** مزامنة شاملة لكل بيانات البرنامج تلقائياً (الطلاب، المجموعات، الحصص، المدفوعات، الحسابات والمعاملات المالية، الشهادات، سجلات HOD، الملاحظات، المهام، الملف الشخصي، الإعدادات، والليرن ستوديو).
- **آلية عمل المزامنة بين الأجهزة (مؤكد):** مزامنة لحظية تلقائية بالخلفية (`onSnapshot` + Auto-Push عند التعديل) مع توفير زر **«مزامنة الآن (رفع / استرجاع فوري)»**.
- **أماكن ظهور خيارات حساب جوجل والمزامنة (مؤكد):** داخل **صفحة الإعدادات (قسم الملف الشخصي والحساب + قسم النسخ الاحتياطي)** وداخل **مركز النسخ الاحتياطي الذكي (Smart Backup Center)** فقط، دون ازدحام الشريط العلوي الرئيسي.

---

### 1. Overview & Core Concept

- **What It Does:** يوفر نظام سحابي متكامل يربط حساب جوجل الخاص بالمعلم بقاعدة بيانات **Firebase Firestore**، بحيث يتم حفظ واسترجاع ومزامنة كل تفصيلة في البرنامج بين جميع أجهزة المعلم (الكمبيوتر، الموبايل، التابلت، ونسخة الويب على Vercel) تلقائياً.
- **Target Audience / Persona:** المعلم الذي يدير طلابه، حصصه، مالياته، وواجباته عبر أكثر من جهاز أو متصفح ويرغب في أمان سحابي فوري دون الحاجة لنقل ملفات النسخ الاحتياطي يدوياً في كل مرة.
- **Key Value:** حماية البيانات من الضياع بنسبة 100%، وتوحيد البيانات بين جميع الأجهزة في الوقت الفعلي بمجرد تسجيل الدخول بحساب Google.

---

### 2. User Experience & Visual Design

- **Key User Flows:**
  1. **ربط حساب جوجل من الإعدادات (قسم الملف الشخصي / الحساب):**
     - يفتح المعلم **الإعدادات ← الملف الشخصي والحساب**، فيجد بطاقة **«المزامنة السحابية بحساب Google»**.
     - عند الضغط على **«تسجيل الدخول بحساب Google وتفعيل المزامنة الشاملة»**، يتم تسجيل الدخول عبر `signInWithPopup`، وتظهر صورة الحساب والبريد الإلكتروني وحالة الاتصال السحابي وتاريخ آخر مزامنة.
  2. **مركز النسخ الاحتياطي الذكي (Smart Backup Center):**
     - في أعلى **مركز النسخ الاحتياطي الذكي** (التبويب السريع)، تظهر لوحة **«سحابة جوجل التلقائية (Google Cloud Sync)»**.
     - تعرض اللوحة حالة المزامنة اللحظية (`متصل ومُزامن تلقائياً`)، إحصائيات البيانات السحابية، مع 3 أزرار تحكم واضحة:
       - **«مزامنة شاملة الآن 🔄»** (دمج ذكي ثنائي الاتجاه).
       - **«رفع بيانات هذا الجهاز للسحابة ☁️⬆️»**.
       - **«استرجاع البيانات من السحابة لهذا الجهاز ☁️⬇️»**.
  3. **المزامنة التلقائية بالخلفية:**
     - عند إضافة أو تعديل طالب، حصة، دفعة مالية، أو إعداد في البرنامج أثناء تسجيل الدخول بحساب Google، يقوم مراقب المزامنة الخلفي (`CloudWorkspaceSyncEngine`) برفع التحديث تلقائياً إلى Firestore، وعند فتح البرنامج من جهاز آخر بنفس الحساب يتم سحب التحديثات فوراً.

- **Visual Identity & Theme:**
  - **Aesthetic Direction:** تصميم احترافي متناسق مع هوية التطبيق (`--surface`, `--primary`, `--text-main`) مع استخدام أرقام متساوية العرض (`tabular-nums`) للعدادات والتواريخ، وتجنب الشارات المزدحمة.
  - **Color Palette & Mood:**
    - حالة الاتصال النشط: أخضر زمردي هادئ (`#16A34A`) للنصوص والمؤشرات.
    - حالة جاري المزامنة: كهرماني (`#D97706`) مع حركة دوران ناعمة للأيقونة.
    - حالة الخطأ أو انقطاع الإنترنت: قرمزي واضح (`#DC2626`) مع رسالة سبب المشكلة وزر إعادة المحاولة.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: تقسيم البيانات السحابية حسب الأقسام (`Chunked Category Documents`) بدلاً من وثيقة واحدة ضخمة**
  - *Chosen Approach:* تخزين بيانات المعلم في Firestore داخل مجموعة `/user_workspaces/{uid}/categories/{categoryKey}` بحيث يُحفظ كل قسم رئيسي (`students`, `groups`, `lessons`, `payments`, `finance`, `hod`, `certificates`, `settings_profile`, `lernstudio`) في وثيقة مستقلة مع تجزئة تلقائية للبيانات الكبيرة (مثل سجل الحصص الكبير).
  - *Why:* لأن Firestore يفرض حداً أقصى `1 MB` للوثيقة الواحدة؛ تقسيم البيانات إلى وثائق حسب القسم مع التجزئة التلقائية يمنع فشل المزامنة مهما كبر عدد الحصص أو المعاملات المالية، ويجعل المزامنة اللحظية أسرع بكثير لأن القسم الذي تغيّر فقط هو الذي يُرفع.
  - *Alternatives Considered:* حفظ كل البرنامج في وثيقة واحدة — تم استبعاده لأنه يتجاوز حد 1MB مع نمو سجل الحصص والمدفوعات.

- **Decision 2: حماية البيانات بملكية حساب المعلم (`request.auth.uid == userId`)**
  - *Chosen Approach:* تأمين مسار `/user_workspaces/{userId}/categories/{docId}` في `firestore.rules` بحيث لا يمكن قراءة أو كتابة بيانات البرنامج الشاملة إلا لصاحب حساب جوجل المسجل بنفسه (`request.auth != null && request.auth.uid == userId`)، مع بقاء مسارات واجبات الطلاب (`/homework_assignments` و `/homework_submissions`) متاحة لروابط الطلاب على فيرسيل.
  - *Why:* لضمان الخصوصية التامة للبيانات المالية وبيانات الطلاب وأرقام الهواتف.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram:**

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         Firebase Auth (Google Login)                      │
│                  user.uid  &  user.email (Teacher Account)                │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                CloudWorkspaceSyncEngine (Background & Manual)             │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐  │
│  │ Auto-Push Debouncer  │  │ Real-Time onSnapshot │  │ Manual Sync Now │  │
│  │ (Watches Storage/App)│  │ (Pulls Remote Diffs) │  │ (Push/Pull/Sync)│  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬────────┘  │
└─────────────┼─────────────────────────┼───────────────────────┼───────────┘
              │                         │                       │
              ▼                         ▼                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│      Firestore: /user_workspaces/{uid}/categories/{categoryDocId}         │
│  • core_crm (students, groups, lessons, payments, certificates)           │
│  • finance_gold (accounts, categories, transactions, recurring, gold)     │
│  • school_hod (hod_students, complaints, action_plans, visits, notes)     │
│  • profile_settings (profile, theme, language, notifications, todos)      │
│  • lernstudio_data (custom sets & homework assignments)                   │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
┌───────────────────────────────────────┐ ┌─────────────────────────────────┐
│     SettingsView (قسم الملف الشخصي)    │ │       SmartBackupCenter         │
│  • بطاقة حساب جوجل والمزامنة التلقائية │ │  • لوحة سحابة جوجل في التبويب    │
│  • زر الدخول/الخروج وتفعيل المزامنة    │ │    الرئيسي (مزامنة الآن / رفع /  │
│    اللحظية الشاملة                     │ │    استرجاع + وقت آخر مزامنة)     │
└───────────────────────────────────────┘ └─────────────────────────────────┘
```

- **Data Model & State:**
  - **Storage Keys Synced Automatically (28 Keys):**
    - *الطلاب والمجموعات والحصص:* `dl_students`, `dl_groups`, `dl_lessons`, `dl_payments`, `dl_certificates`, `dl_recently_deleted`
    - *النظام المالي والذهب:* `dl_finance_accounts`, `dl_finance_categories`, `dl_finance_transactions`, `dl_finance_recurring`, `dl_finance_installments`, `dl_finance_notifications`, `gluck_gold_holdings`, `gluck_gold_settings`
    - *المدرسة ورئيس القسم (HOD):* `hod_german_students`, `hod_complaints`, `hod_student_action_plans`, `hod_visit_records`, `dl_school_notes`
    - *الإعدادات والملف الشخصي والمهام:* `dl_profile`, `dl_settings`, `dl_theme`, `dl_accent_color`, `dl_language`, `dl_quick_todos`, `dl_notification_settings`, `dl_inspiration_settings`, `dl_inspiration_messages`
    - *الليرن ستوديو والواجبات:* `dl_lernstudio_sets`, `glueck_hw_assignments_v2`, `glueck_hw_submissions_v2`

- **Interactive Component & State Mapping:**
  - **مفتاح تفعيل المزامنة اللحظية (`autoCloudSyncEnabled`):** محفوظ في الإعدادات ومفعّل افتراضياً بمجرد تسجيل الدخول بحساب Google.
  - **مراقب التغييرات الذكي:** عند تغيّر أي قسم في `AppContext` أو `storageService`، يتم عمل `debounce` لمدة ثانيتين ثم رفع القسم المعدّل إلى `/user_workspaces/{uid}/categories/{chunkId}` مع ختم زمني `updatedAtMs`.
  - **مستمع التحديثات الفوري (`onSnapshot`):** يستمع لأي تحديث قادم من جهاز آخر بنفس حساب جوجل، وعند وجود بيانات أحدث (`remote.updatedAtMs > local.updatedAtMs`) يقوم بتحديث `storage` و `AppContext` فوراً دون إعادة تحميل الصفحة.
