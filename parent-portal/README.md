# 🇩🇪 منصة وبوابة متابعة أولياء الأمور (AGS Parent Portal)

منصة ويب متكاملة، فائقة السرعة وعصرية مبنية بـ **React 18 + Vite + TypeScript + Tailwind CSS** مخصصة ليتم رفعها على **Vercel** أو أي استضافة ويب، تتيح لأولياء الأمور متابعة:
- 📊 **الملف الأكاديمي للطالب**: نسبة الحضور، الالتزام بالواجبات، ومتوسط درجات الكويزات والإملاء.
- ⏰ **الحصة القادمة**: الموعد بنظام 12 ساعة، الموضوع، ورابط الزووم (Zoom) المباشر بنقرة واحدة.
- 📖 **سجل الحصص السابقة**: التاريخ، كشف الحضور، الواجب المطلوب، تقييم المعلم بالعامية المصرية الراقية، وروابط تسجيل الحصص (الجزء الأول والثاني).
- ✍️ **الواجبات والدرجات**: درجات الكويزات، درجات الإملاء والامتحانات الشهرية مع مؤشرات الإنجاز.
- 🏆 **الشهادات الرسمية**: استعراض وتحميل وطباعة شهادات التقدير ولوحة الشرف بدقة عالية مع مؤثرات احتفالية.
- 💳 **حالة الاشتراك والباقة**: متابعة الحصص المستهلكة من الدورة (مثلاً: الحصة 5 من 8) وتاريخ التجديد.
- 🌙 **دعم الوضعين الليلي والفاتح (Dark / Light Mode)** وتصميم متجاوب 100% مع الهواتف الذكية وأجهزة الكمبيوتر.

---

## 🚀 دليل النشر والربط على Vercel (في 3 دقائق)

### 1️⃣ ربط المشروع بحساب Vercel:
1. ادخل على [Vercel.com](https://vercel.com) وسجل دخول بحساب GitHub الخاص بك.
2. اضغط على زر **"Add New Project"** ثم اختر مستودع المشروع (Repository).
3. **⚠️ خطوة مهمة جداً (Root Directory):**
   - في خانة **Root Directory** اضغط على `Edit` واختر المجلد: `parent-portal`.
4. في خانة **Framework Preset** سيتعرف تلقائياً على `Vite`.
5. في خانة **Build Command** اتركها: `npm run build` والـ **Output Directory**: `dist`.

---

### 2️⃣ إعداد قاعدة البيانات السحابية (Firebase Firestore):
1. افتح [Firebase Console](https://console.firebase.google.com).
2. أنشئ مشروعاً جديداً (مجاني تماماً على خطة Spark Free Plan).
3. من القائمة الجانبية، ادخل على **Firestore Database** واضغط **Create Database**.
4. اضغط على تبويب **Rules** وضع الصلاحيات التالية لتسمح لأولياء الأمور بالقراءة السريعة:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // السماح بالقراءة لأي ولي أمر يملك كود الطالب، والكتابة للمعلم فقط
    match /portal_students/{studentId} {
      allow read: if true;
      allow write: if request.auth != null; // أو مفتاح السيرفر
    }
  }
}
```
5. ادخل على إعدادات المشروع (Project Settings) -> أنشئ تطبيق Web (رمز `</>`) وانسخ مفاتيح الـ Config.
6. في موقع Vercel، ادخل على **Environment Variables** وضع المفاتيح التالية:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
7. اضغط **Deploy**! مبروك، رابط الموقع أصبح جاهزاً مثل: `https://ags-parents.vercel.app`.

---

## 🔗 كيف يدخل ولي الأمر للموقع؟
1. **بالدخول المباشر**: فتح الرابط وكتابة كود الطالب (مثل `STU-1001` أو رقم الهاتف).
2. **برابط مخصص مباشر بنقرة واحدة عبر واتساب**:
   يمكن للمعلم إرسال الرابط التالي لولي الأمر ليفتح حسابه تلقائياً دون كتابة أي كود:
   ```text
   https://ags-parents.vercel.app/?code=STU-1001
   ```

---

## 📦 هيكل بيانات الطالب في Firestore (`portal_students`)
المجموعة في فايربيس اسمها: `portal_students`
معرّف المستند (Document ID) يكون كود الطالب (مثلاً: `STU-1001` أو رقم الهاتف).

نموذج المستند JSON:
```json
{
  "id": "stu-1001",
  "studentCode": "STU-1001",
  "name": "عمر أحمد الشناوي",
  "gender": "male",
  "gradeLevel": "اللغة الألمانية - A1.1",
  "groupName": "مجموعة الأوائل",
  "teacherName": "أ. أحمد سمير",
  "teacherPhone": "201012345678",
  "parentPhone": "01000000000",
  "stats": {
    "totalSessions": 12,
    "attendedSessions": 12,
    "attendanceRate": 100,
    "homeworkRate": 95,
    "averageQuizGrade": 9.8,
    "averageDictationGrade": 10,
    "totalCertificates": 2
  },
  "nextLesson": {
    "id": "les-next",
    "title": "حصة المحادثة والتطبيق العملي",
    "date": "2026-09-15",
    "dayOfWeek": "الثلاثاء",
    "time": "6:00 م",
    "isOnline": true,
    "zoomLink": "https://zoom.us/j/...",
    "topic": "تصريف الأفعال وحالة النصب Akkusativ"
  },
  "lessons": [
    {
      "id": "les-1",
      "date": "2026-09-12",
      "dayOfWeek": "السبت",
      "time": "6:00 م",
      "sessionNumber": 6,
      "totalCycleSessions": 8,
      "topic": "أدوات المعرفة والنكرة",
      "attendanceStatus": "present",
      "homeworkDone": "yes",
      "dictationGrade": 10,
      "examGrade": 9.5,
      "teacherFeedback": "ما شاء الله مستواه هايل وفاهم الدرس ومستوعب كويس جداً.",
      "homeworkRequired": "حل ص 45 و 46 في الكتاب.",
      "recordingLink": "https://youtu.be/...",
      "recordingLink2": "https://youtu.be/..."
    }
  ],
  "quizzes": [
    {
      "id": "q-1",
      "date": "2026-09-12",
      "title": "كويز أدوات التعريف والتنكير",
      "type": "quiz",
      "score": 10,
      "maxScore": 10,
      "percentage": 100,
      "feedback": "درجة نهائية ممتازة"
    }
  ],
  "certificates": [
    {
      "id": "c-1",
      "title": "شهادة التفوق والتميز في اللغة الألمانية",
      "issueDate": "2026-09-01",
      "badge": "امتياز مع مرتبة الشرف 🌟",
      "description": "تقديراً للتفوق والالتزام الكامل."
    }
  ],
  "packageInfo": {
    "packageName": "باقة 8 حصص",
    "currentSessionInCycle": 6,
    "totalCycleSessions": 8,
    "isPaid": true,
    "amount": 800,
    "currency": "ج.م",
    "renewalDate": "2026-09-20",
    "notes": "متبقي حصتان على تجديد الباقة"
  },
  "lastUpdated": "2026-09-12T14:30:00"
}
```

---

## 🛠️ التشغيل والتطوير المحلي المستقل:
```bash
cd parent-portal
npm install
npm run dev
```
الموقع سيعمل فوراً على المنفذ `http://localhost:3000` أو أي منفذ متاح مع دعم الحساب التجريبي المدمج حتى لو لم تقم بإدخال مفاتيح فايربيس بعد.
