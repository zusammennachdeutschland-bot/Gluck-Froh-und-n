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
}

export interface ParsedStudentData {
  name: string;
  parentPhone: string;
  studentPhone?: string;
}

export interface AiImportResult {
  isValid: boolean;
  group: ParsedGroupData | null;
  students: ParsedStudentData[];
  errors: string[];
  warnings: string[];
}

const SAMPLE_IMPORT_TEMPLATE = `[GROUP]
name=Kinda und Judy
grade=Grade 5
type=online
lesson_price=100
payment_type=every_4_lessons
payment_amount=400
zoom_link=https://zoom.us/j/123456789

[SCHEDULE]
Thursday|20:00

[STUDENTS]
كندا|201200005170|201100000000
جودي|201200005170|`;

const SAMPLE_MULTI_SCHEDULE_TEMPLATE = `[GROUP]
name=Grade 10 Physics
grade=Grade 10
type=offline
lesson_price=150
payment_type=every_8_lessons
payment_amount=1200
address=Cairo Center, Building 5

[SCHEDULE]
Saturday|15:00
Wednesday|19:00

[STUDENTS]
Omar Farouk|01098765432|01011112222
Nour El Din|01123456789|`;

export const AI_PROMPT_TEMPLATE_AR = `أنت مساعد إدخال بيانات متخصص لنظام إدارة المجموعات والدروس التعليمية (Educational Management System Data-Entry Assistant).

وظيفتك الأساسية:
1. استقبال النص العادي أو الملاحظات الخام للمجموعات والطلاب من المعلم.
2. استخراج وفحص جميع معلومات المجموعة، المواعيد، نظام الدفع، ورابط الحصة/العنوان، وقائمة الطلاب.
3. التحقق من وجود كافة البيانات المطلوبة كاملة وبدون استثناء قبل إنشاء المجموعة.
4. إذا كان أي بيان مطلوب مفقوداً أو غير واضح، **قم بسؤال المعلم مباشرة عن البيانات المفقودة فقط أولاً** ولا تقم بتوليد كود الاستيراد النهائي.
5. لا تقم أبداً بتوليد كود استيراد جزئي أو ناقص.
6. قم بتوليد كود الاستيراد النهائي فقط بعد اكتمال والتحقق من جميع البيانات المطلوبة.

==================== قائمة البيانات المطلوبة والتحقق ====================

1. بيانات المجموعة [GROUP]:
- اسم المجموعة (name): اسم واضح ومحدد (مطلوب).
- الصف الدراسي (grade): اختر من Grade 1 حتى Grade 12 (مطلوب).
- نوع الحضور (type): إما "online" أو "offline" (مطلوب).
- سعر الحصة (lesson_price): (مطلوب).
- نظام الدفع (payment_type): اختر حصراً من (per_lesson, every_4_lessons, every_8_lessons, every_12_lessons, monthly) (مطلوب).
- المبلغ الإجمالي (payment_amount): يتم حسابه تلقائياً بناءً على سعر الحصة ونظام الدفع.

شروط هامة ونوع الحضور:
* إذا كان نوع المجموعة "online":
  - يجب توفير رابط زووم (zoom_link) إجبارياً!
  - العنوان (address) غير مطلوب.
* إذا كان نوع المجموعة "offline":
  - يجب توفير عنوان المكان (address) إجبارياً!
  - رابط زووم (zoom_link) غير مطلوب.

2. مواعيد الحصص [SCHEDULE]:
- يوم واحد على الأقل من أيام الأسبوع بالإنجليزية (Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday).
- توقيت كل يوم بنظام 24 ساعة (HH:MM)، مثلاً: 20:00.

3. قائمة الطلاب [STUDENTS]:
- طالب واحد على الأقل.
- اسم الطالب (مطلوب).
- رقم هاتف ولي الأمر (Parent Phone - مطلوب إجبارياً).
- رقم هاتف الطالب (Student Phone - اختياري، يخزن عند توفره).
- تنسيق سطر الطالب:
  اسم الطالب|رقم ولي الأمر|رقم الطالب(اختياري)
  مثال:
  كندا|201200005170|201100000000
  جودي|201200005170|

==================== التعامل مع البيانات المفقودة ====================
- إذا كانت هناك بيانات مطلوبة مفقودة، **لا تولد كود الاستيراد [GROUP]**.
- بدلاً من ذلك، اسأل المعلم بوضوح ومباشرة عن البيانات المفقودة فقط، مثال:
[MISSING_INFORMATION]
zoom_link=Missing

"يرجى تزويدي برابط زووم للمجموعة الأونلاين لإكمال الحفظ."

==================== التنسيق النهائي عند اكتمال البيانات ====================
عند توفر كافة البيانات المطلوبة والتحقق منها، أخرج كود الاستيراد النهائي داخل كود بلين تيكست بالتنسيق المباشر التالي:

\`\`\`
[GROUP]
name=Kinda und Judy
grade=Grade 5
type=online
lesson_price=100
payment_type=every_4_lessons
payment_amount=400
zoom_link=https://zoom.us/example

[SCHEDULE]
Thursday|20:00

[STUDENTS]
كندا|201200005170|201100000000
جودي|201200005170|
\`\`\`

قواعد التنسيق الشديدة:
1. [GROUP] في سطر مستقل وكل حقل في سطر مستقل.
2. [SCHEDULE] في سطر مستقل وكل موعد (اليوم|التوقيت) في سطر مستقل.
3. [STUDENTS] في سطر مستقل وكل طالب (الاسم|رقم ولي الأمر|رقم الطالب_اختياري) في سطر مستقل.
4. لا تضف أي نص أو شرح أو تعليقات داخل أو بعد مربع كود الاستيراد النهائي.`;

export const AI_PROMPT_TEMPLATE_EN = `You are a strict Educational Management System Data-Entry Assistant.

YOUR CORE ROLE:
1. Receive raw student/group notes from the teacher.
2. Identify all group details, schedule timings, payment configurations, Zoom/Address details, and student records.
3. Verify that ALL required information exists and is valid before creating the group.
4. If ANY required information is missing, ASK THE TEACHER ONLY FOR THE MISSING INFORMATION FIRST. Do NOT generate the import block.
5. NEVER generate a partial or incomplete import block.
6. Only generate the final import block after all required information has been collected and validated.

==================== REQUIRED INFORMATION & VALIDATION RULES ====================

1. GROUP DATA [GROUP]:
- Group Name (name): Clear descriptive name (Required)
- Grade Level (grade): Grade 1 through Grade 12 (Required)
- Attendance Type (type): "online" OR "offline" (Required)
- Price Per Lesson (lesson_price): (Required)
- Payment Type (payment_type): Strictly one of: per_lesson, every_4_lessons, every_8_lessons, every_12_lessons, monthly (Required)
- Payment Amount (payment_amount): Total calculated package amount.

LOCATION / VIRTUAL LINK RULES:
* If Attendance Type is "online":
  - Zoom Link (zoom_link) is REQUIRED!
  - Address is not required.
* If Attendance Type is "offline":
  - Address / Location (address) is REQUIRED!
  - Zoom Link is not required.

2. CLASS SCHEDULE [SCHEDULE]:
- At least one valid day (Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday).
- Class time in 24-hour HH:MM format (e.g. 20:00).

3. STUDENTS LIST [STUDENTS]:
- At least one student record.
- Student Name (Required)
- Parent Phone Number (Required)
- Student Phone Number (Optional - store if provided)
- Student Line Format:
  StudentName|ParentPhone|StudentPhone(Optional)
  Examples:
  Kinda|201200005170|201100000000
  Judy|201200005170|

==================== MISSING INFORMATION BEHAVIOR ====================
- If any required field is missing (e.g., missing Zoom link for online group, missing address for offline group, or missing parent phone for a student), DO NOT generate the [GROUP] import block.
- Specify what is missing and ask the teacher ONLY for the missing details:
[MISSING_INFORMATION]
zoom_link=Missing

"Please provide the Zoom link for this online group so I can complete the import."

==================== FINAL OUTPUT FORMAT (WHEN ALL DATA IS COMPLETE) ====================
When ALL required information is present and validated, output the final result inside a plain-text code block in EXACTLY this format:

\`\`\`
[GROUP]
name=Kinda und Judy
grade=Grade 5
type=online
lesson_price=100
payment_type=every_4_lessons
payment_amount=400
zoom_link=https://zoom.us/example

[SCHEDULE]
Thursday|20:00

[STUDENTS]
Kinda|201200005170|201100000000
Judy|201200005170|
\`\`\``;

export { SAMPLE_IMPORT_TEMPLATE, SAMPLE_MULTI_SCHEDULE_TEMPLATE };

/**
 * Normalizes grade strings into valid GradeLevel values
 */
function normalizeGrade(rawGrade: string): GradeLevel {
  const trimmed = rawGrade.trim();
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
 * Parses and strictly validates AI-generated import text according to ZERO-DATA-LOSS specifications.
 */
export function parseAiImportText(text: string): AiImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text || !text.trim()) {
    return {
      isValid: false,
      group: null,
      students: [],
      errors: ['Import text is empty. Please paste the template generated by AI.'],
      warnings: [],
    };
  }

  // Automatically strip markdown code block fences if present (e.g. ```text ... ``` or ```ini)
  const cleanInput = text
    .replace(/^```[a-zA-Z]*\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();

  const rawLines = cleanInput.split('\n');

  // Locate sections
  let groupSectionStartIndex = -1;
  let scheduleSectionStartIndex = -1;
  let studentsSectionStartIndex = -1;

  for (let i = 0; i < rawLines.length; i++) {
    const lineUpper = rawLines[i].trim().toUpperCase();
    if (lineUpper === '[GROUP]') {
      groupSectionStartIndex = i;
    } else if (lineUpper === '[SCHEDULE]' || lineUpper === '[TIMINGS]') {
      scheduleSectionStartIndex = i;
    } else if (lineUpper === '[STUDENTS]') {
      studentsSectionStartIndex = i;
    }
  }

  if (cleanInput.toUpperCase().includes('[MISSING_INFORMATION]')) {
    errors.push('The pasted response indicates missing required information. Please answer the AI with the requested details before importing.');
  }

  if (groupSectionStartIndex === -1) {
    errors.push('Missing [GROUP] section header in the pasted text.');
  }

  if (studentsSectionStartIndex === -1) {
    errors.push('Missing [STUDENTS] section header in the pasted text.');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      group: null,
      students: [],
      errors,
      warnings,
    };
  }

  // Helper to slice lines belonging to a section until the next section
  const sectionIndices = [
    { name: 'group', idx: groupSectionStartIndex },
    { name: 'schedule', idx: scheduleSectionStartIndex },
    { name: 'students', idx: studentsSectionStartIndex },
  ]
    .filter((s) => s.idx !== -1)
    .sort((a, b) => a.idx - b.idx);

  const getSectionLines = (sectionName: string): string[] => {
    const secObj = sectionIndices.find((s) => s.name === sectionName);
    if (!secObj) return [];
    const currentPos = sectionIndices.indexOf(secObj);
    const start = secObj.idx + 1;
    const end = currentPos + 1 < sectionIndices.length ? sectionIndices[currentPos + 1].idx : rawLines.length;
    return rawLines.slice(start, end);
  };

  const groupLines = getSectionLines('group');
  const scheduleLines = getSectionLines('schedule');
  const studentLines = getSectionLines('students');

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

  // Validate GROUP basic fields
  const name = groupKv['name'] || '';
  const rawGrade = groupKv['grade'] || '';
  const rawType = (groupKv['type'] || '').toLowerCase();
  const rawDaysKey = groupKv['days'] || '';
  const rawScheduleKey = groupKv['schedule'] || groupKv['timings'] || '';
  const rawTimeKey = groupKv['time'] || groupKv['default_time'] || '';

  const rawZoomLink = groupKv['zoom_link'] || groupKv['zoomlink'] || groupKv['zoom_meeting_link'] || groupKv['zoom'] || groupKv['meeting_link'] || '';
  const rawAddress = groupKv['address'] || groupKv['location'] || groupKv['place'] || groupKv['center'] || '';

  if (!name.trim()) {
    errors.push('Group "name" field is required in [GROUP] section.');
  }

  if (!rawGrade.trim()) {
    errors.push('Group "grade" field is required in [GROUP] section.');
  }

  if (!rawType.trim()) {
    errors.push('Group "type" field is required in [GROUP] section (accepted: online, offline).');
  } else if (rawType !== 'online' && rawType !== 'offline') {
    errors.push(`Invalid group "type" "${rawType}". Must be either "online" or "offline".`);
  } else if (rawType === 'online') {
    if (!rawZoomLink.trim()) {
      errors.push('Zoom Link ("zoom_link=...") is required for online groups.');
    }
  } else if (rawType === 'offline') {
    if (!rawAddress.trim()) {
      errors.push('Address / Location ("address=...") is required for offline groups.');
    }
  }

  // Parse Schedule Slots
  const parsedSchedules: ParsedScheduleSlot[] = [];
  const parsedDaysSet = new Set<string>();
  const dayTimesMap: Record<string, string> = {};

  // Strategy A: Parse dedicated [SCHEDULE] section if present
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
        // e.g. "Saturday: 15:00" -> split on first colon
        const cIdx = line.indexOf(':');
        dayStr = line.substring(0, cIdx).trim();
        timeStr = line.substring(cIdx + 1).trim();
      } else {
        // Space separated, e.g. "Saturday 15:00"
        const spaceIdx = line.lastIndexOf(' ');
        if (spaceIdx !== -1) {
          dayStr = line.substring(0, spaceIdx).trim();
          timeStr = line.substring(spaceIdx + 1).trim();
        }
      }

      if (!dayStr) {
        errors.push(`Invalid schedule line "${line}" in [SCHEDULE] block. Missing day name.`);
        continue;
      }

      if (!isValidTimeStr(timeStr)) {
        errors.push(`Invalid time format "${timeStr}" for day "${dayStr}" in [SCHEDULE]. Expected HH:MM format (e.g. 15:00).`);
        continue;
      }

      const formattedTime = normalizeTimeStr(timeStr);
      const normDay = normalizeDayToShortKey(dayStr);
      parsedSchedules.push({ day: normDay, time: formattedTime });
      parsedDaysSet.add(normDay);
      dayTimesMap[normDay] = formattedTime;
    }
  }

  // Strategy B: If no [SCHEDULE] section, check `schedule=` or `days=` key in [GROUP]
  if (parsedSchedules.length === 0) {
    const scheduleKeyValue = rawScheduleKey || rawDaysKey;

    if (scheduleKeyValue) {
      // Check if scheduleKeyValue has day@time pairs e.g. "Saturday@15:00,Wednesday@19:00" or "Saturday|15:00,Wednesday|19:00"
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
            errors.push(`Invalid day/time format "${item}". Expected format: Day@HH:MM (e.g. Saturday@15:00).`);
          }
        } else {
          // Standard day name without inline time e.g. "Sunday", "Wednesday"
          const fallbackTime = rawTimeKey && isValidTimeStr(rawTimeKey) ? normalizeTimeStr(rawTimeKey) : '18:00';
          const normDay = normalizeDayToShortKey(item);
          parsedSchedules.push({ day: normDay, time: fallbackTime });
          parsedDaysSet.add(normDay);
          dayTimesMap[normDay] = fallbackTime;
        }
      }
    }
  }

  // Validation checks for schedule
  if (parsedSchedules.length === 0) {
    errors.push(
      'Schedule information is required. Provide either a [SCHEDULE] block (e.g. Saturday|15:00) or "days=" and "time=" in [GROUP].'
    );
  }

  // Fallback default group time
  const primaryTime = parsedSchedules.length > 0 ? parsedSchedules[0].time : (isValidTimeStr(rawTimeKey) ? normalizeTimeStr(rawTimeKey) : '18:00');
  const parsedDays = Array.from(parsedDaysSet);

  // Parse & Calculate Payment
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
    errors.push(
      'Group "payment_type" field is required in [GROUP] section (accepted: per_lesson, every_4_lessons, every_8_lessons, monthly).'
    );
  } else if (!validPaymentTypes.includes(rawPaymentType)) {
    errors.push(
      `Invalid payment_type "${rawPaymentType}". Must be one of: per_lesson, every_4_lessons, every_8_lessons, monthly.`
    );
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
      errors.push(`Invalid lesson_price "${rawLessonPrice}". Must be a non-negative number.`);
    }
  }

  if (rawPaymentAmount.trim()) {
    const parsedAmt = parseFloat(rawPaymentAmount);
    if (isNaN(parsedAmt) || parsedAmt < 0) {
      errors.push(`Invalid payment_amount "${rawPaymentAmount}". Must be a non-negative number.`);
    } else {
      finalPaymentAmount = parsedAmt;
    }
  } else if (parsedLessonPrice !== undefined) {
    // Dynamically calculate payment_amount from lesson_price based on payment_type
    if (mappedPaymentCycle === 'per_lesson') {
      finalPaymentAmount = parsedLessonPrice;
    } else if (mappedPaymentCycle === '4_lessons') {
      finalPaymentAmount = parsedLessonPrice * 4;
    } else if (mappedPaymentCycle === '8_lessons') {
      finalPaymentAmount = parsedLessonPrice * 8;
    } else if (mappedPaymentCycle === 'monthly') {
      finalPaymentAmount = parsedLessonPrice * 8; // Default 8 sessions per month
    }
  } else {
    errors.push('Payment details missing: Either "payment_amount" or "lesson_price" must be specified in [GROUP].');
  }

  // Parse [STUDENTS] section
  const parsedStudents: ParsedStudentData[] = [];
  const seenPhones = new Set<string>();
  const seenNames = new Set<string>();

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
    let parentPhone = '';
    let studentPhone = '';

    if (trimmedLine.includes('|')) {
      const parts = trimmedLine.split('|');
      studentName = parts[0].trim();
      parentPhone = parts[1] ? parts[1].trim() : '';
      studentPhone = parts[2] ? parts[2].trim() : '';
    } else if (trimmedLine.includes('-')) {
      const parts = trimmedLine.split('-');
      studentName = parts[0].trim();
      parentPhone = parts[1] ? parts[1].trim() : '';
      studentPhone = parts.slice(2).join('-').trim();
    } else if (trimmedLine.includes(':')) {
      const parts = trimmedLine.split(':');
      studentName = parts[0].trim();
      parentPhone = parts[1] ? parts[1].trim() : '';
      studentPhone = parts.slice(2).join(':').trim();
    } else if (trimmedLine.includes(',')) {
      const parts = trimmedLine.split(',');
      studentName = parts[0].trim();
      parentPhone = parts[1] ? parts[1].trim() : '';
      studentPhone = parts.slice(2).join(',').trim();
    } else if (trimmedLine.includes('\t')) {
      const parts = trimmedLine.split('\t');
      studentName = parts[0].trim();
      parentPhone = parts[1] ? parts[1].trim() : '';
      studentPhone = parts.slice(2).join('\t').trim();
    } else {
      // Try regex match for trailing phone number
      const phoneMatch = trimmedLine.match(/(.*?)\s+([+0-9\s-]{7,15})$/);
      if (phoneMatch) {
        studentName = phoneMatch[1].trim();
        parentPhone = phoneMatch[2].trim();
      } else {
        studentName = trimmedLine;
        parentPhone = '';
      }
    }

    if (!studentName) {
      errors.push(`Student name is empty on student line ${studentLineCount}.`);
    }

    if (!parentPhone) {
      errors.push(`Parent Phone Number is required for student "${studentName || `Line ${studentLineCount}`}".`);
    } else {
      // Normalize international +20 10 ... -> 2010... or local 010 123 4567 -> 0101234567
      if (parentPhone.startsWith('+')) {
        parentPhone = parentPhone.replace(/[^\d]/g, '');
      } else if (/^[\d\s-]{8,20}$/.test(parentPhone)) {
        parentPhone = parentPhone.replace(/[\s-]/g, '');
      }
    }

    if (studentPhone) {
      if (studentPhone.startsWith('+')) {
        studentPhone = studentPhone.replace(/[^\d]/g, '');
      } else if (/^[\d\s-]{8,20}$/.test(studentPhone)) {
        studentPhone = studentPhone.replace(/[\s-]/g, '');
      }
    }

    if (studentName) {
      const lowerPhone = parentPhone.replace(/\s+/g, '');
      const lowerName = studentName.toLowerCase();

      if (seenPhones.has(lowerPhone) && lowerPhone !== '') {
        warnings.push(
          `Note: Duplicate parent phone number "${parentPhone}" for student "${studentName}".`
        );
      } else if (lowerPhone) {
        seenPhones.add(lowerPhone);
      }

      if (seenNames.has(lowerName)) {
        errors.push(
          `Duplicate student name "${studentName}" detected in the import list. Please ensure student names are unique.`
        );
      } else {
        seenNames.add(lowerName);
      }

      parsedStudents.push({
        name: studentName,
        parentPhone: parentPhone,
        studentPhone: studentPhone || undefined,
      });
    }
  }

  if (studentLineCount === 0) {
    errors.push('At least one student record is required in the [STUDENTS] section.');
  }

  const isValid = errors.length === 0;

  const groupData: ParsedGroupData | null =
    isValid || (name && rawGrade && rawType)
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
        }
      : null;

  return {
    isValid,
    group: groupData,
    students: parsedStudents,
    errors,
    warnings,
  };
}
