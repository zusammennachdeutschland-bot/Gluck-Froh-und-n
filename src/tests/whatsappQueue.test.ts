import assert from 'node:assert/strict';
import { 
  buildQueueMessageForStudent, 
  getArabicDayFromDate, 
  formatArabicDateDisplay, 
  formatArabicTimeDisplay 
} from '../utils/whatsappQueueUtils.js';
import { Lesson, Student, TeacherProfile, Group } from '../types/index.js';

console.log('--- Running WhatsApp Queue Unit Tests ---');

// Mock data
const mockProfile = {
  displayName: 'أحمد سعيد',
  currency: 'EGP',
  email: 'teacher@example.com'
} as unknown as TeacherProfile;

const mockStudent: Student = {
  id: 'st_1',
  name: 'محمد خالد',
  groupId: 'grp_1',
  grade: 'Grade 10',
  parentName: 'خالد عبد الله',
  parentPhone: '01012345678',
  studentPhone: '01198765432',
  joinedDate: '2026-09-01',
  documents: []
};

const mockGroup = {
  id: 'grp_1',
  name: 'أولى ثانوي لغات',
  grade: 'Grade 10',
  type: 'offline',
  pricePerLesson: 150
} as unknown as Group;

const mockLesson = {
  id: 'les_1',
  title: 'حصة أولى ثانوي',
  groupId: 'grp_1',
  date: '2026-11-01',
  time: '16:00',
  duration: 60,
  type: 'offline',
  status: 'completed',
  sessionNumber: 3,
  totalSessionsInPackage: 8,
  report: {
    attendanceStatus: 'present',
    arabicTopicsExplained: 'Akkusativ & Perfekt',
    arabicHomeworkRequired: 'حل ص 35 إلى 38 بالملزمة',
    studentAttendance: { 'st_1': 'present' },
    studentHomeworkDone: { 'st_1': 'yes' },
    studentDictationGrade: { 'st_1': 9 }
  }
} as unknown as Lesson;

// Test 1: Date & Time formatting
const formattedDate = formatArabicDateDisplay('2026-11-01');
assert.equal(formattedDate, '01/11/2026', 'Date should be DD/MM/YYYY');

const formattedTime = formatArabicTimeDisplay('16:00');
assert.ok(formattedTime.length > 0, 'Formatted time should not be empty');

// Test 2: Egyptian dialect template
const egyptianMsg = buildQueueMessageForStudent(mockStudent, mockLesson, mockProfile, {
  templateType: 'egyptian',
  group: mockGroup
});
assert.ok(egyptianMsg.includes('محمد خالد'), 'Should contain student name');
assert.ok(egyptianMsg.includes('أ. أحمد سعيد'), 'Should contain teacher signature');
assert.ok(egyptianMsg.includes('Akkusativ'), 'Should contain topic covered');
assert.ok(egyptianMsg.includes('حل ص 35'), 'Should contain homework');
assert.ok(egyptianMsg.includes('تسميع الكلمات: 9 من 10'), 'Should contain dictation score');

// Test 3: Streamlined template (اليوم والتاريخ، الشرح، الهومورك فقط)
const streamlinedMsg = buildQueueMessageForStudent(mockStudent, mockLesson, mockProfile, {
  templateType: 'streamlined',
  group: mockGroup
});
assert.ok(streamlinedMsg.includes('محمد خالد'), 'Should contain student name');
assert.ok(streamlinedMsg.includes('اللي اتشرح'), 'Should have explanation header');
assert.ok(streamlinedMsg.includes('الهومورك الجاي'), 'Should have homework header');

// Test 4: Lesson reminder template
const reminderMsg = buildQueueMessageForStudent(mockStudent, mockLesson, mockProfile, {
  templateType: 'reminder',
  group: mockGroup
});
assert.ok(reminderMsg.includes('تذكير بموعد حصة الألماني'), 'Should be a reminder message');
assert.ok(reminderMsg.includes('محمد خالد'), 'Should mention student');

// Test 5: Custom template with variables
const customTemplate = 'مرحبا {اسم_ولي_الأمر}، نود إعلامكم بأن {اسم_الطالب} مستواه ممتاز في {المجموعة}.';
const customMsg = buildQueueMessageForStudent(mockStudent, mockLesson, mockProfile, {
  templateType: 'custom',
  customTemplate,
  group: mockGroup
});
assert.equal(customMsg, 'مرحبا خالد عبد الله، نود إعلامكم بأن محمد خالد مستواه ممتاز في أولى ثانوي لغات.');

// Test 6: Date helpers & Cross-Modal Synchronization
import { 
  getYesterdayLocalDateStr, 
  getBeforeYesterdayLocalDateStr,
  recordStudentReportDispatched,
  isStudentReportDispatched,
  getAllDispatchedStudentsForDate,
  getAllDispatchedStudentsForLesson
} from '../utils/whatsappQueueUtils.js';

// Polyfill localStorage in node test environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; }
  };
}

const yDate = getYesterdayLocalDateStr();
assert.ok(yDate.match(/^\d{4}-\d{2}-\d{2}$/), 'Yesterday date format should be YYYY-MM-DD');

const byDate = getBeforeYesterdayLocalDateStr();
assert.ok(byDate.match(/^\d{4}-\d{2}-\d{2}$/), 'Before yesterday date format should be YYYY-MM-DD');

// Verify initial state: student not dispatched
const initialCheck = isStudentReportDispatched('st_1', { lessonId: 'les_1', dateStr: '2026-11-01' });
assert.equal(initialCheck.isSent, false, 'Student should not be marked sent initially');

// Record dispatch from session modal
recordStudentReportDispatched('les_1', 'st_1', '2026-11-01', 'parent', 'session_modal', '05:30 م');

// Check that isStudentReportDispatched recognizes it
const dispatchedCheck = isStudentReportDispatched('st_1', { lessonId: 'les_1', dateStr: '2026-11-01' });
assert.equal(dispatchedCheck.isSent, true, 'Student should be recognized as dispatched');
assert.equal(dispatchedCheck.time, '05:30 م', 'Time should match 05:30 م');

// Check date index
const dateMap = getAllDispatchedStudentsForDate('2026-11-01');
assert.equal(dateMap['st_1'], '05:30 م', 'Date index should contain st_1');

// Check lesson index
const lessonMap = getAllDispatchedStudentsForLesson('les_1');
assert.equal(lessonMap['st_1'], '05:30 م', 'Lesson index should contain st_1');

console.log('✅ All WhatsApp Queue Unit Tests Passed Successfully!');
