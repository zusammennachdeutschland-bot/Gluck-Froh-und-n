import { GradeLevel, LessonType, PaymentCycle } from '../types';
import { normalizeDayToShortKey } from './scheduleUtils';

export interface ParsedScheduleSlot {
  day: string;
  time: string;
}

export interface ParsedGroupData {
  name: string;
  grade: GradeLevel;
  type: LessonType;
  days: string[];
  time: string; // Default or first schedule time
  schedules: ParsedScheduleSlot[];
  dayTimes: Record<string, string>;
  payment_type: PaymentCycle;
  payment_amount: number;
  lesson_price?: number;
  zoom_link?: string;
  address?: string;
  whatsapp_link?: string;
}

export interface ParsedStudentData {
  name: string;
  certificateName: string;
  parentPhone: string;
  parentUsername?: string;
  parentContactType?: 'phone' | 'username';
  studentPhone?: string;
  studentUsername?: string;
  studentContactType?: 'phone' | 'username';
}

export interface ParsedGroupWithStudents {
  group: ParsedGroupData;
  students: ParsedStudentData[];
}

export interface AiImportResult {
  isValid: boolean;
  group: ParsedGroupData | null; // Primary or first group (for backward compatibility)
  students: ParsedStudentData[]; // All students across all parsed groups
  groups: ParsedGroupWithStudents[]; // Full array of all parsed groups with their students
  totalGroupsCount: number;
  totalStudentsCount: number;
  errors: string[];
  warnings: string[];
}

const SAMPLE_IMPORT_TEMPLATE = `[GROUP]
name=مجموعة الصف الخامس أونلاين
grade=Grade 5
type=online
lesson_price=100
payment_type=every_4_lessons
payment_amount=400
zoom_link=https://zoom.us/j/123456789
whatsapp_link=https://chat.whatsapp.com/ExampleInviteLink1

[SCHEDULE]
Thursday|20:00

[STUDENTS]
كندا أحمد|Kinda Ahmed|201200005170|201100000000
جودي محمود|Judy Mahmoud|201200005170|
عمر فاروق|Omar Farouk|01098765432|01011112222`;

const SAMPLE_MULTI_GROUP_TEMPLATE = `[GROUP]
name=الصف الخامس - سنتر الأوائل
grade=Grade 5
type=offline
lesson_price=100
payment_type=every_4_lessons
payment_amount=400
address=سنتر الأوائل - مدينة نصر
whatsapp_link=https://chat.whatsapp.com/ExampleGroup1

[SCHEDULE]
Sunday|17:00
Wednesday|17:00

[STUDENTS]
عمر فاروق|Omar Farouk|01098765432|01011112222
علي محمود|Ali Mahmoud|01123456789|@ali_student
سيف الدين|Seif El Din|01234567890|

[GROUP]
name=الصف السادس - أونلاين بلس
grade=Grade 6
type=online
lesson_price=120
payment_type=every_4_lessons
payment_amount=480
zoom_link=https://zoom.us/j/987654321
whatsapp_link=https://chat.whatsapp.com/ExampleGroup2

[SCHEDULE]
Monday|19:30
Thursday|19:30

[STUDENTS]
كندا أحمد|Kinda Ahmed|201200005170|@kinda_student
جودي محمد|Judy Mohamed|201200005170|
نور الدين كريم|Nour El Din Karim|01055556666|01077778888`;

const SAMPLE_MULTI_SCHEDULE_TEMPLATE = `[GROUP]
name=Grade 10 Physics
grade=Grade 10
type=offline
lesson_price=150
payment_type=every_8_lessons
payment_amount=1200
address=Cairo Center, Building 5
whatsapp_link=https://chat.whatsapp.com/ExampleGroupLink

[SCHEDULE]
Saturday|15:00
Wednesday|19:00

[STUDENTS]
عمر فاروق|Omar Farouk|01098765432|01011112222
نور الدين|Nour El Din|01123456789|`;

export const AI_PROMPT_TEMPLATE_AR = `أنت مساعد إدخال بيانات فائق الدقة لنظام إدارة المجموعات والدروس والطلاب (Educational Management System Data-Entry Assistant).

وظيفتك الأساسية:
1. استقبال النص العادي أو الملاحظات الخام للمجموعات والطلاب من المعلم (سواء كانت **مجموعة واحدة أو عدة مجموعات متعددة معاً في نفس البرومبت**).
2. استخراج وفحص جميع معلومات كل مجموعة على حدة: المواعيد، نظام الدفع، ورابط الحصة/العنوان، رابط جروب الواتساب، وقائمة الطلاب.
3. التحقق من وجود كافة البيانات المطلوبة كاملة وبدون استثناء لكل مجموعة قبل إنشائها.
4. إذا كان أي بيان مطلوب مفقوداً أو غير واضح، **قم بسؤال المعلم مباشرة عن البيانات المفقودة فقط أولاً** ولا تقم بتوليد كود الاستيراد النهائي.
5. لا تقم أبداً بتوليد كود استيراد جزئي أو ناقص.
6. قم بتوليد كود الاستيراد النهائي فقط بعد اكتمال والتحقق من جميع البيانات المطلوبة.

==================== دعم المجموعات المتعددة (Multi-Group Support) ====================
يمكنك توليد **أكثر من مجموعة وأكثر من قائمة طلاب في نفس الرد البرمجي** بكتابة كود كل مجموعة متتالياً بالتنسيق التالي:
[GROUP] -> [SCHEDULE] -> [STUDENTS]
ثم تكرارها للمجموعة الثانية والثالثة وما بعدها.

==================== قائمة البيانات المطلوبة والتحقق لكل مجموعة ====================

1. بيانات المجموعة [GROUP]:
- اسم المجموعة (name): اسم واضح ومحدد (مطلوب).
- الصف الدراسي (grade): اختر من Grade 1 حتى Grade 12 أو المستويات A1, A2, B1, B2 (مطلوب).
- نوع الحضور (type): إما "online" أو "offline" (مطلوب).
- سعر الحصة (lesson_price): (مطلوب).
- نظام الدفع (payment_type): اختر حصراً من (per_lesson, every_4_lessons, every_8_lessons, every_12_lessons, monthly) (مطلوب).
- المبلغ الإجمالي (payment_amount): يتم حسابه تلقائياً بناءً على سعر الحصة ونظام الدفع.
- رابط جروب الواتساب (whatsapp_link): **إجباري ومطلوب إذا كانت المجموعة تحتوي على أكثر من طالب واحد (> 1 طالب)**! (أما إذا كان طالباً واحداً فقط فهو اختياري).

شروط هامة ونوع الحضور:
* إذا كان نوع المجموعة "online":
  - يجب توفير رابط زووم (zoom_link) إجبارياً!
  - العنوان (address) غير مطلوب.
* إذا كان نوع المجموعة "offline":
  - يجب توفير عنوان المكان (address) إجبارياً!
  - رابط زووم (zoom_link) غير مطلوب.
* شرط رابط الواتساب (WhatsApp Link Rule):
  - إذا كانت المجموعة تضم طالبين فأكثر (أكثر من طالب واحد)، يجب على المساعد سؤال المعلم عن رابط جروب الواتساب (whatsapp_link) كبيان إجباري قبل إصدار الكود!

2. مواعيد الحصص [SCHEDULE]:
- يوم واحد على الأقل من أيام الأسبوع بالإنجليزية (Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday).
- توقيت كل يوم بنظام 24 ساعة (HH:MM)، مثلاً: 20:00.

3. قائمة الطلاب [STUDENTS]:
- طالب واحد على الأقل لكل مجموعة.
- اسم الطالب بالعربية (مطلوب).
- اسم الطالب بالإنجليزية للشهادات (مطلوب - يرجى نقحرة وترجمة الاسم العربي بدقة واحترافية وبشكل أنيق مناسب لشهادات التقدير الأكاديمية بالإنجليزية/الألمانية، مثلاً: "أحمد علي" -> "Ahmed Ali").
- رقم هاتف أو يوزر نيم واتساب لولي الأمر (Parent Phone or WhatsApp Username - إجباري، يقبل إما رقم هاتف دولي/محلي أو يوزر نيم واتساب مسبوقاً بـ @، مثل: 201200005170 أو @parent_username).
- رقم هاتف أو يوزر نيم واتساب للطالب (Student Phone or WhatsApp Username - اختياري، مثل: 201100000000 أو @student_user).
- تنسيق سطر الطالب:
  الاسم بالعربية|الاسم بالإنجليزية للشهادات|رقم أو يوزر نيم ولي الأمر|رقم أو يوزر نيم الطالب(اختياري)
  أمثلة:
  كندا|Kinda|201200005170|201100000000
  جودي|Judy|@judy_parent|@judy_student
  عمر فاروق|Omar Farouk|01098765432|@omar_farouk

==================== التنسيق النهائي عند اكتمال البيانات ====================
عند توفر كافة البيانات المطلوبة والتحقق منها، أخرج كود الاستيراد النهائي داخل كود بلين تيكست بالتنسيق المباشر التالي:

\`\`\`
[GROUP]
name=الصف الخامس أ
grade=Grade 5
type=offline
lesson_price=100
payment_type=every_4_lessons
payment_amount=400
address=سنتر الأوائل - مدينة نصر
whatsapp_link=https://chat.whatsapp.com/ExampleLink1

[SCHEDULE]
Sunday|17:00
Wednesday|17:00

[STUDENTS]
عمر فاروق|Omar Farouk|01098765432|01011112222
علي محمود|Ali Mahmoud|01123456789|

[GROUP]
name=الصف السادس أونلاين
grade=Grade 6
type=online
lesson_price=120
payment_type=every_4_lessons
payment_amount=480
zoom_link=https://zoom.us/j/987654321
whatsapp_link=https://chat.whatsapp.com/ExampleLink2

[SCHEDULE]
Monday|19:30
Thursday|19:30

[STUDENTS]
كندا أحمد|Kinda Ahmed|201200005170|@kinda_student
جودي محمد|Judy Mohamed|201200005170|
\`\`\`

قواعد التنسيق الشديدة:
1. كل مجموعة تبدأ بـ [GROUP] في سطر مستقل وكل حقل في سطر مستقل.
2. [SCHEDULE] في سطر مستقل وكل موعد (اليوم|التوقيت) في سطر مستقل.
3. [STUDENTS] في سطر مستقل وكل طالب (الاسم بالعربية|الاسم بالإنجليزية للشهادات|رقم ولي الأمر|رقم الطالب_اختياري) في سطر مستقل.
4. يمكن وضع أكثر من مجموعة متتالية في نفس الكود البرمجي وسيقوم النظام باستيرادها جميعاً دفعة واحدة.
5. لا تضف أي نص أو شرح أو تعليقات داخل أو بعد مربع كود الاستيراد النهائي.`;

export const AI_PROMPT_TEMPLATE_EN = `You are a strict Educational Management System Data-Entry Assistant.

YOUR CORE ROLE:
1. Receive raw student/group notes from the teacher (either for a **single group or multiple groups and students in the same prompt**).
2. Identify and validate all group details, schedule timings, payment configurations, Zoom/Address details, WhatsApp group link, and student records for EACH group.
3. Verify that ALL required information exists and is valid before creating the groups.
4. If ANY required information is missing, ASK THE TEACHER ONLY FOR THE MISSING INFORMATION FIRST. Do NOT generate the import block.
5. NEVER generate a partial or incomplete import block.
6. Only generate the final import block after all required information has been collected and validated.

==================== MULTI-GROUP IMPORT SUPPORT ====================
You can output **multiple groups and multiple student rosters in the exact same response** by repeating the block for each group:
[GROUP] -> [SCHEDULE] -> [STUDENTS]
followed by the next group.

==================== REQUIRED INFORMATION & VALIDATION RULES PER GROUP ====================

1. GROUP DATA [GROUP]:
- Group Name (name): Clear descriptive name (Required)
- Grade Level (grade): Grade 1 through Grade 12 or CEFR A1-C2 (Required)
- Attendance Type (type): "online" OR "offline" (Required)
- Price Per Lesson (lesson_price): (Required)
- Payment Type (payment_type): Strictly one of: per_lesson, every_4_lessons, every_8_lessons, every_12_lessons, monthly (Required)
- Payment Amount (payment_amount): Total calculated package amount.
- WhatsApp Group Link (whatsapp_link): **REQUIRED if the group has more than one student (> 1 student)**! (Optional if only 1 student).

LOCATION / VIRTUAL LINK / WHATSAPP RULES:
* If Attendance Type is "online":
  - Zoom Link (zoom_link) is REQUIRED!
  - Address is not required.
* If Attendance Type is "offline":
  - Address / Location (address) is REQUIRED!
  - Zoom Link is not required.
* WHATSAPP GROUP LINK RULE:
  - If the group has more than 1 student, you MUST ask for the WhatsApp group link (whatsapp_link) before generating the code!

2. CLASS SCHEDULE [SCHEDULE]:
- At least one valid day (Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday).
- Class time in 24-hour HH:MM format (e.g. 20:00).

3. STUDENTS LIST [STUDENTS]:
- At least one student record per group.
- Student Name in Arabic or Native language (Required)
- Student English/Latin Name for Certificates (Required - precise and prestigious transliteration of the native/Arabic name, e.g. "أحمد محمد" -> "Ahmed Mohamed")
- Parent Phone Number or WhatsApp Username (Required - can be international/local phone number e.g. +201012345678 or a WhatsApp username prefixed with @ e.g. @parent_username)
- Student Phone Number or WhatsApp Username (Optional - e.g. 01011112222 or @student_username)
- Student Line Format:
  NativeName|EnglishName|ParentPhoneOrUsername|StudentPhoneOrUsername(Optional)

==================== FINAL OUTPUT FORMAT (WHEN ALL DATA IS COMPLETE) ====================
When ALL required information is present and validated, output the final result inside a plain-text code block:

\`\`\`
[GROUP]
name=Grade 5 Advanced
grade=Grade 5
type=offline
lesson_price=100
payment_type=every_4_lessons
payment_amount=400
address=Center El-Awail - Nasr City
whatsapp_link=https://chat.whatsapp.com/ExampleLink1

[SCHEDULE]
Sunday|17:00
Wednesday|17:00

[STUDENTS]
عمر فاروق|Omar Farouk|01098765432|01011112222
علي محمود|Ali Mahmoud|01123456789|

[GROUP]
name=Grade 6 Online
grade=Grade 6
type=online
lesson_price=120
payment_type=every_4_lessons
payment_amount=480
zoom_link=https://zoom.us/j/987654321
whatsapp_link=https://chat.whatsapp.com/ExampleLink2

[SCHEDULE]
Monday|19:30
Thursday|19:30

[STUDENTS]
كندا أحمد|Kinda Ahmed|201200005170|@kinda_student
جودي محمد|Judy Mohamed|201200005170|
\`\`\``;

export { SAMPLE_IMPORT_TEMPLATE, SAMPLE_MULTI_GROUP_TEMPLATE, SAMPLE_MULTI_SCHEDULE_TEMPLATE };

/**
 * Normalizes grade strings into valid GradeLevel values
 */
function normalizeGrade(rawGrade: string): GradeLevel {
  const trimmed = rawGrade.trim();
  const upper = trimmed.toUpperCase();
  
  // Check for CEFR language levels (A1, A2, B1, B2, C1, C2)
  const cefrMatch = upper.match(/\b([ABC][12])\b/);
  if (cefrMatch) {
    return cefrMatch[1] as GradeLevel;
  }
  if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(upper)) {
    return upper as GradeLevel;
  }

  if (trimmed.startsWith('Grade ')) {
    return trimmed as GradeLevel;
  }
  const match = trimmed.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num >= 1 && num <= 12) {
      return `Grade ${num}` as GradeLevel;
    }
  }
  return 'Grade 5';
}

/**
 * Validates HH:MM format (e.g., "18:00", "09:30", "9:30")
 */
function isValidTimeStr(timeStr: string): boolean {
  if (!timeStr) return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr.trim());
}

/**
 * Normalizes time string to standard HH:MM format (e.g., "9:30" -> "09:30")
 */
function normalizeTimeStr(timeStr: string): string {
  const trimmed = timeStr.trim();
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${h}:${m}`;
  }
  return trimmed;
}

/**
 * Parses an individual group block containing [GROUP], [SCHEDULE], and [STUDENTS]
 */
function parseIndividualGroupBlock(
  rawLines: string[],
  groupIndex: number,
  totalGroups: number,
  overallSeenStudentNames: Set<string>
): {
  groupWithStudents: ParsedGroupWithStudents | null;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const groupPrefix = totalGroups > 1 ? `[مجموعة ${groupIndex + 1}] ` : '';

  // Find sub-sections within this block
  let scheduleSectionIndex = -1;
  let studentsSectionIndex = -1;

  for (let i = 0; i < rawLines.length; i++) {
    const lineUpper = rawLines[i].trim().toUpperCase();
    if (lineUpper === '[SCHEDULE]' || lineUpper === '[TIMINGS]') {
      scheduleSectionIndex = i;
    } else if (lineUpper === '[STUDENTS]') {
      studentsSectionIndex = i;
    }
  }

  if (studentsSectionIndex === -1) {
    errors.push(`${groupPrefix}قسم قائمة الطلاب [STUDENTS] مفقود في هذه المجموعة.`);
  }

  // Slice group lines, schedule lines, and students lines
  let groupLinesEnd = rawLines.length;
  if (scheduleSectionIndex !== -1 && studentsSectionIndex !== -1) {
    groupLinesEnd = Math.min(scheduleSectionIndex, studentsSectionIndex);
  } else if (scheduleSectionIndex !== -1) {
    groupLinesEnd = scheduleSectionIndex;
  } else if (studentsSectionIndex !== -1) {
    groupLinesEnd = studentsSectionIndex;
  }

  const groupLines = rawLines.slice(1, groupLinesEnd); // Skip [GROUP] header line

  let scheduleLines: string[] = [];
  if (scheduleSectionIndex !== -1) {
    const schedEnd = studentsSectionIndex !== -1 && studentsSectionIndex > scheduleSectionIndex 
      ? studentsSectionIndex 
      : rawLines.length;
    scheduleLines = rawLines.slice(scheduleSectionIndex + 1, schedEnd);
  }

  let studentLines: string[] = [];
  if (studentsSectionIndex !== -1) {
    const studEnd = scheduleSectionIndex !== -1 && scheduleSectionIndex > studentsSectionIndex 
      ? scheduleSectionIndex 
      : rawLines.length;
    studentLines = rawLines.slice(studentsSectionIndex + 1, studEnd);
  }

  // Parse [GROUP] key-value pairs
  const groupKv: Record<string, string> = {};
  for (const line of groupLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim().toLowerCase();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (key) {
        groupKv[key] = val;
      }
    }
  }

  const name = groupKv['name'] || '';
  const rawGrade = groupKv['grade'] || '';
  const rawType = (groupKv['type'] || '').toLowerCase();
  const rawDaysKey = groupKv['days'] || '';
  const rawScheduleKey = groupKv['schedule'] || groupKv['timings'] || '';
  const rawTimeKey = groupKv['time'] || groupKv['default_time'] || '';

  const rawZoomLink = groupKv['zoom_link'] || groupKv['zoomlink'] || groupKv['zoom_meeting_link'] || groupKv['zoom'] || groupKv['meeting_link'] || '';
  const rawAddress = groupKv['address'] || groupKv['location'] || groupKv['place'] || groupKv['center'] || '';
  const rawWhatsappLink = groupKv['whatsapp_link'] || groupKv['whatsapplink'] || groupKv['whatsapp'] || groupKv['whatsapp_group_link'] || groupKv['whatsapp_group'] || groupKv['chat_link'] || '';

  const displayGroupName = name.trim() ? `"${name.trim()}"` : `المجموعة ${groupIndex + 1}`;
  const gTag = totalGroups > 1 ? `[${displayGroupName}] ` : '';

  if (!name.trim()) {
    errors.push(`${gTag}حقل اسم المجموعة "name" مطلوب.`);
  }

  if (!rawGrade.trim()) {
    errors.push(`${gTag}حقل الصف الدراسي "grade" مطلوب.`);
  }

  if (!rawType.trim()) {
    errors.push(`${gTag}نوع المجموعة "type" مطلوب (online أو offline).`);
  } else if (rawType !== 'online' && rawType !== 'offline') {
    errors.push(`${gTag}نوع المجموعة "${rawType}" غير صالح. يجب أن يكون "online" أو "offline".`);
  } else if (rawType === 'online') {
    if (!rawZoomLink.trim()) {
      errors.push(`${gTag}رابط زووم ("zoom_link=...") مطلوب للمجموعات الأونلاين.`);
    }
  } else if (rawType === 'offline') {
    if (!rawAddress.trim()) {
      errors.push(`${gTag}عنوان ومكان الحضور ("address=...") مطلوب للمجموعات الأوفلاين.`);
    }
  }

  // Parse Schedule Slots
  const parsedSchedules: ParsedScheduleSlot[] = [];
  const parsedDaysSet = new Set<string>();
  const dayTimesMap: Record<string, string> = {};

  if (scheduleLines.length > 0) {
    for (let i = 0; i < scheduleLines.length; i++) {
      const line = scheduleLines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      let dayStr = '';
      let timeStr = '';

      if (line.includes('|')) {
        const parts = line.split('|');
        dayStr = parts[0].trim();
        timeStr = parts[1].trim();
      } else if (line.includes('@')) {
        const parts = line.split('@');
        dayStr = parts[0].trim();
        timeStr = parts[1].trim();
      } else if (line.includes(':') && !isValidTimeStr(line)) {
        const cIdx = line.indexOf(':');
        dayStr = line.substring(0, cIdx).trim();
        timeStr = line.substring(cIdx + 1).trim();
      } else {
        const spaceIdx = line.lastIndexOf(' ');
        if (spaceIdx !== -1) {
          dayStr = line.substring(0, spaceIdx).trim();
          timeStr = line.substring(spaceIdx + 1).trim();
        }
      }

      if (!dayStr) {
        errors.push(`${gTag}سطر الموعد "${line}" غير صالح. اسم اليوم مفقود.`);
        continue;
      }

      if (!isValidTimeStr(timeStr)) {
        errors.push(`${gTag}تنسيق التوقيت "${timeStr}" لليوم "${dayStr}" غير صالح. التنسيق المتوقع HH:MM (مثال 15:00).`);
        continue;
      }

      const formattedTime = normalizeTimeStr(timeStr);
      const normDay = normalizeDayToShortKey(dayStr);
      parsedSchedules.push({ day: normDay, time: formattedTime });
      parsedDaysSet.add(normDay);
      dayTimesMap[normDay] = formattedTime;
    }
  }

  // Fallback: If no [SCHEDULE] section, check `schedule=` or `days=` key in [GROUP]
  if (parsedSchedules.length === 0) {
    const scheduleKeyValue = rawScheduleKey || rawDaysKey;

    if (scheduleKeyValue) {
      const items = scheduleKeyValue.split(',').map((s) => s.trim()).filter(Boolean);

      for (const item of items) {
        if (item.includes('@') || item.includes('|')) {
          const sep = item.includes('@') ? '@' : '|';
          const [dStr, tStr] = item.split(sep).map((s) => s.trim());
          if (dStr && isValidTimeStr(tStr)) {
            const formattedTime = normalizeTimeStr(tStr);
            const normDay = normalizeDayToShortKey(dStr);
            parsedSchedules.push({ day: normDay, time: formattedTime });
            parsedDaysSet.add(normDay);
            dayTimesMap[normDay] = formattedTime;
          } else {
            errors.push(`${gTag}تنسيق اليوم/التوقيت "${item}" غير صالح. الصيغة: Day@HH:MM.`);
          }
        } else {
          const fallbackTime = rawTimeKey && isValidTimeStr(rawTimeKey) ? normalizeTimeStr(rawTimeKey) : '18:00';
          const normDay = normalizeDayToShortKey(item);
          parsedSchedules.push({ day: normDay, time: fallbackTime });
          parsedDaysSet.add(normDay);
          dayTimesMap[normDay] = fallbackTime;
        }
      }
    }
  }

  if (parsedSchedules.length === 0) {
    errors.push(`${gTag}مواعيد الحصص مطلوبة. يرجى توفير قسم [SCHEDULE] (مثل Sunday|17:00) أو days= في [GROUP].`);
  }

  const primaryTime = parsedSchedules.length > 0 ? parsedSchedules[0].time : (isValidTimeStr(rawTimeKey) ? normalizeTimeStr(rawTimeKey) : '18:00');
  const parsedDays = Array.from(parsedDaysSet);

  // Payment parsing
  const rawPaymentType = (groupKv['payment_type'] || groupKv['payment_cycle'] || groupKv['payment_model'] || groupKv['payment'] || '').toLowerCase();
  const rawPaymentAmount = groupKv['payment_amount'] || groupKv['amount'] || groupKv['package_price'] || groupKv['price'] || '';
  const rawLessonPrice = groupKv['lesson_price'] || groupKv['price_per_lesson'] || groupKv['price_per_session'] || groupKv['session_price'] || '';

  const validPaymentTypes = [
    'per_lesson', 'per_session', 
    'every_4_lessons', '4_lessons', 
    'every_8_lessons', '8_lessons', 
    'every_12_lessons', '12_lessons', 
    'monthly', 'package'
  ];
  let mappedPaymentCycle: PaymentCycle = '4_lessons';

  if (!rawPaymentType.trim()) {
    errors.push(`${gTag}حقل نظام الدفع "payment_type" مطلوب في المجموعة.`);
  } else if (!validPaymentTypes.includes(rawPaymentType)) {
    errors.push(`${gTag}نظام الدفع "${rawPaymentType}" غير صالح.`);
  } else {
    if (rawPaymentType === 'per_lesson' || rawPaymentType === 'per_session') {
      mappedPaymentCycle = 'per_lesson';
    } else if (rawPaymentType === 'every_4_lessons' || rawPaymentType === '4_lessons') {
      mappedPaymentCycle = '4_lessons';
    } else if (rawPaymentType === 'every_8_lessons' || rawPaymentType === '8_lessons') {
      mappedPaymentCycle = '8_lessons';
    } else if (rawPaymentType === 'every_12_lessons' || rawPaymentType === '12_lessons') {
      mappedPaymentCycle = '12_lessons';
    } else {
      mappedPaymentCycle = 'monthly';
    }
  }

  let finalPaymentAmount = 0;
  let parsedLessonPrice: number | undefined = undefined;

  if (rawLessonPrice.trim()) {
    const parsedLp = parseFloat(rawLessonPrice);
    if (!isNaN(parsedLp) && parsedLp >= 0) {
      parsedLessonPrice = parsedLp;
    } else {
      errors.push(`${gTag}سعر الحصة "${rawLessonPrice}" غير صالح.`);
    }
  }

  if (rawPaymentAmount.trim()) {
    const parsedAmt = parseFloat(rawPaymentAmount);
    if (isNaN(parsedAmt) || parsedAmt < 0) {
      errors.push(`${gTag}مبلغ الباقة "${rawPaymentAmount}" غير صالح.`);
    } else {
      finalPaymentAmount = parsedAmt;
    }
  } else if (parsedLessonPrice !== undefined) {
    if (mappedPaymentCycle === 'per_lesson') {
      finalPaymentAmount = parsedLessonPrice;
    } else if (mappedPaymentCycle === '4_lessons') {
      finalPaymentAmount = parsedLessonPrice * 4;
    } else if (mappedPaymentCycle === '8_lessons') {
      finalPaymentAmount = parsedLessonPrice * 8;
    } else if (mappedPaymentCycle === 'monthly') {
      finalPaymentAmount = parsedLessonPrice * 8;
    }
  } else {
    errors.push(`${gTag}بيانات التسعير مفقودة: يرجى تحديد "lesson_price" أو "payment_amount".`);
  }

  // Parse Students
  const parsedStudents: ParsedStudentData[] = [];
  const groupSeenNames = new Set<string>();
  let studentLineCount = 0;

  for (let idx = 0; idx < studentLines.length; idx++) {
    const rawLine = studentLines[idx];
    const trimmedLine = rawLine.trim();
    const lowerLine = trimmedLine.toLowerCase();

    if (
      !trimmedLine ||
      trimmedLine.startsWith('#') ||
      trimmedLine.startsWith('//') ||
      trimmedLine.startsWith('[') ||
      lowerLine.startsWith('when i use') ||
      lowerLine.startsWith('note:') ||
      lowerLine.startsWith('http')
    ) {
      continue;
    }

    studentLineCount++;

    let studentName = '';
    let certificateName = '';
    let parentPhone = '';
    let studentPhone = '';

    if (trimmedLine.includes('|')) {
      const parts = trimmedLine.split('|');
      studentName = parts[0] ? parts[0].trim() : '';
      if (parts.length >= 4) {
        certificateName = parts[1] ? parts[1].trim() : '';
        parentPhone = parts[2] ? parts[2].trim() : '';
        studentPhone = parts[3] ? parts[3].trim() : '';
      } else {
        const isLatin = !/[\u0600-\u06FF]/.test(studentName);
        certificateName = isLatin ? studentName : '';
        parentPhone = parts[1] ? parts[1].trim() : '';
        studentPhone = parts[2] ? parts[2].trim() : '';
      }
    } else if (trimmedLine.includes('-')) {
      const parts = trimmedLine.split('-');
      studentName = parts[0].trim();
      if (parts.length >= 4) {
        certificateName = parts[1].trim();
        parentPhone = parts[2].trim();
        studentPhone = parts.slice(3).join('-').trim();
      } else {
        const isLatin = !/[\u0600-\u06FF]/.test(studentName);
        certificateName = isLatin ? studentName : '';
        parentPhone = parts[1] ? parts[1].trim() : '';
        studentPhone = parts.slice(2).join('-').trim();
      }
    } else if (trimmedLine.includes(':')) {
      const parts = trimmedLine.split(':');
      studentName = parts[0].trim();
      if (parts.length >= 4) {
        certificateName = parts[1].trim();
        parentPhone = parts[2].trim();
        studentPhone = parts.slice(3).join(':').trim();
      } else {
        const isLatin = !/[\u0600-\u06FF]/.test(studentName);
        certificateName = isLatin ? studentName : '';
        parentPhone = parts[1] ? parts[1].trim() : '';
        studentPhone = parts.slice(2).join(':').trim();
      }
    } else if (trimmedLine.includes(',')) {
      const parts = trimmedLine.split(',');
      studentName = parts[0].trim();
      if (parts.length >= 4) {
        certificateName = parts[1].trim();
        parentPhone = parts[2].trim();
        studentPhone = parts.slice(3).join(',').trim();
      } else {
        const isLatin = !/[\u0600-\u06FF]/.test(studentName);
        certificateName = isLatin ? studentName : '';
        parentPhone = parts[1] ? parts[1].trim() : '';
        studentPhone = parts.slice(2).join(',').trim();
      }
    } else if (trimmedLine.includes('\t')) {
      const parts = trimmedLine.split('\t');
      studentName = parts[0].trim();
      if (parts.length >= 4) {
        certificateName = parts[1].trim();
        parentPhone = parts[2].trim();
        studentPhone = parts.slice(3).join('\t').trim();
      } else {
        const isLatin = !/[\u0600-\u06FF]/.test(studentName);
        certificateName = isLatin ? studentName : '';
        parentPhone = parts[1] ? parts[1].trim() : '';
        studentPhone = parts.slice(2).join('\t').trim();
      }
    } else {
      const contactMatch = trimmedLine.match(/(.*?)\s+([@a-zA-Z0-9._+-]{3,30})$/);
      if (contactMatch) {
        studentName = contactMatch[1].trim();
        parentPhone = contactMatch[2].trim();
      } else {
        studentName = trimmedLine;
        parentPhone = '';
      }
      const isLatin = !/[\u0600-\u06FF]/.test(studentName);
      certificateName = isLatin ? studentName : '';
    }

    if (!studentName) {
      errors.push(`${gTag}اسم الطالب فارغ في السطر ${studentLineCount}.`);
    }

    if (!certificateName) {
      errors.push(`${gTag}اسم الشهادات بالإنجليزية مطلوب للطالب "${studentName || `سطر ${studentLineCount}`}". الصيغة: الاسم_عربي|الاسم_إنجليزي|هاتف_ولي_الأمر`);
    }

    if (!parentPhone) {
      errors.push(`${gTag}راتف أو يوزر نيم ولي الأمر مطلوب للطالب "${studentName || `سطر ${studentLineCount}`}".`);
    } else {
      const isParentUser = parentPhone.startsWith('@') || /[a-zA-Z]/.test(parentPhone);
      if (isParentUser) {
        const clean = parentPhone.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '');
        parentPhone = clean ? `@${clean}` : parentPhone.trim();
      } else {
        if (parentPhone.startsWith('+')) {
          parentPhone = parentPhone.replace(/[^\d]/g, '');
        } else if (/^[\d\s-]{8,20}$/.test(parentPhone)) {
          parentPhone = parentPhone.replace(/[\s-]/g, '');
        }
      }
    }

    if (studentPhone) {
      const isStudentUser = studentPhone.startsWith('@') || /[a-zA-Z]/.test(studentPhone);
      if (isStudentUser) {
        const clean = studentPhone.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '');
        studentPhone = clean ? `@${clean}` : studentPhone.trim();
      } else {
        if (studentPhone.startsWith('+')) {
          studentPhone = studentPhone.replace(/[^\d]/g, '');
        } else if (/^[\d\s-]{8,20}$/.test(studentPhone)) {
          studentPhone = studentPhone.replace(/[\s-]/g, '');
        }
      }
    }

    if (studentName) {
      const lowerName = studentName.toLowerCase();

      if (groupSeenNames.has(lowerName)) {
        errors.push(`${gTag}اسم الطالب "${studentName}" مكرر داخل نفس المجموعة.`);
      } else {
        groupSeenNames.add(lowerName);
      }

      if (overallSeenStudentNames.has(lowerName)) {
        warnings.push(`ملاحظة: اسم الطالب "${studentName}" موجود في أكثر من مجموعة (${displayGroupName}).`);
      } else {
        overallSeenStudentNames.add(lowerName);
      }

      const isParentUser = parentPhone.startsWith('@') || /[a-zA-Z]/.test(parentPhone);
      const isStudentUser = studentPhone ? (studentPhone.startsWith('@') || /[a-zA-Z]/.test(studentPhone)) : false;

      parsedStudents.push({
        name: studentName,
        certificateName: certificateName,
        parentPhone: parentPhone,
        parentUsername: isParentUser ? parentPhone.replace(/^@/, '') : undefined,
        parentContactType: isParentUser ? 'username' : 'phone',
        studentPhone: studentPhone || undefined,
        studentUsername: isStudentUser && studentPhone ? studentPhone.replace(/^@/, '') : undefined,
        studentContactType: isStudentUser ? 'username' : (studentPhone ? 'phone' : undefined),
      });
    }
  }

  if (studentLineCount === 0) {
    errors.push(`${gTag}يجب إضافة طالب واحد على الأقل في قسم [STUDENTS].`);
  }

  // Validate WhatsApp group link if group has more than 1 student
  if (parsedStudents.length > 1 && !rawWhatsappLink.trim()) {
    errors.push(`${gTag}رابط جروب الواتساب ("whatsapp_link=...") إجباري للمجموعات التي تضم أكثر من طالب واحد.`);
  }

  const isGroupValid = errors.length === 0;

  const groupData: ParsedGroupData | null =
    isGroupValid || (name && rawGrade && rawType)
      ? {
          name: name.trim(),
          grade: normalizeGrade(rawGrade),
          type: (rawType === 'online' ? 'online' : 'offline') as LessonType,
          days: parsedDays,
          time: primaryTime,
          schedules: parsedSchedules,
          dayTimes: dayTimesMap,
          payment_type: mappedPaymentCycle,
          payment_amount: finalPaymentAmount,
          lesson_price: parsedLessonPrice,
          zoom_link: rawZoomLink.trim() || undefined,
          address: rawAddress.trim() || undefined,
          whatsapp_link: rawWhatsappLink.trim() || undefined,
        }
      : null;

  return {
    groupWithStudents: groupData ? { group: groupData, students: parsedStudents } : null,
    errors,
    warnings,
  };
}

/**
 * Parses and strictly validates AI-generated import text according to ZERO-DATA-LOSS specifications.
 * Supports SINGLE GROUP or MULTIPLE GROUPS & STUDENTS in the same prompt seamlessly!
 */
export function parseAiImportText(text: string): AiImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text || !text.trim()) {
    return {
      isValid: false,
      group: null,
      students: [],
      groups: [],
      totalGroupsCount: 0,
      totalStudentsCount: 0,
      errors: ['نص الاستيراد فارغ. يرجى لصق كود المجموعات والطلاب المنشأ من الذكاء الاصطناعي.'],
      warnings: [],
    };
  }

  // Automatically strip markdown code block fences if present (e.g. ```text ... ``` or ```ini)
  const cleanInput = text
    .replace(/^```[a-zA-Z]*\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();

  if (cleanInput.toUpperCase().includes('[MISSING_INFORMATION]')) {
    errors.push('الرد الملصق يحتوي على بيانات ناقصة [MISSING_INFORMATION]. يرجى تزويد الذكاء الاصطناعي بالبيانات الناقصة أولاً قبل الاستيراد.');
  }

  const rawLines = cleanInput.split('\n');

  // Find all [GROUP] positions
  const groupStartIndices: number[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].trim().toUpperCase() === '[GROUP]') {
      groupStartIndices.push(i);
    }
  }

  if (groupStartIndices.length === 0) {
    errors.push('العنوان الرئيسي [GROUP] مفقود في النص الملصق.');
    return {
      isValid: false,
      group: null,
      students: [],
      groups: [],
      totalGroupsCount: 0,
      totalStudentsCount: 0,
      errors,
      warnings,
    };
  }

  const parsedGroupsWithStudents: ParsedGroupWithStudents[] = [];
  const overallSeenStudentNames = new Set<string>();

  for (let gIdx = 0; gIdx < groupStartIndices.length; gIdx++) {
    const startIndex = groupStartIndices[gIdx];
    const endIndex = gIdx + 1 < groupStartIndices.length ? groupStartIndices[gIdx + 1] : rawLines.length;
    const blockLines = rawLines.slice(startIndex, endIndex);

    const parseBlockResult = parseIndividualGroupBlock(
      blockLines,
      gIdx,
      groupStartIndices.length,
      overallSeenStudentNames
    );

    errors.push(...parseBlockResult.errors);
    warnings.push(...parseBlockResult.warnings);

    if (parseBlockResult.groupWithStudents) {
      parsedGroupsWithStudents.push(parseBlockResult.groupWithStudents);
    }
  }

  const allStudents = parsedGroupsWithStudents.flatMap((g) => g.students);
  const primaryGroup = parsedGroupsWithStudents[0]?.group || null;

  const isValid = errors.length === 0 && parsedGroupsWithStudents.length > 0;

  return {
    isValid,
    group: primaryGroup,
    students: allStudents,
    groups: parsedGroupsWithStudents,
    totalGroupsCount: parsedGroupsWithStudents.length,
    totalStudentsCount: allStudents.length,
    errors,
    warnings,
  };
}

