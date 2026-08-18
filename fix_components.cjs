const fs = require('fs');
const path = require('path');

let controlModal = fs.readFileSync('src/components/LessonControlModal.tsx', 'utf8');
controlModal = controlModal.replace(/alert\('لا يوجد رقم هاتف مسجل لولي الأمر. يرجى إضافة الرقم في بيانات الطالب.'\);/g, "alert(t('alert_no_parent_phone'));");
controlModal = controlModal.replace(/alert\('يرجى إنهاء الحصة أولاً بالضغط على زر "إنهاء الحصة وحفظ التقرير" لتتمكن من فتح تقرير ولي الأمر.'\);/g, "alert(t('alert_finish_lesson_first'));");
fs.writeFileSync('src/components/LessonControlModal.tsx', controlModal);

let reminderModal = fs.readFileSync('src/components/LessonReminderModal.tsx', 'utf8');
reminderModal = reminderModal.replace(/alert\('برجاء إضافة رابط الزووم للجروب أولاً قبل إرسال التذكير.'\);/g, "alert(t('alert_add_zoom_link'));");
fs.writeFileSync('src/components/LessonReminderModal.tsx', reminderModal);

console.log('Fixed UI alerts');
