import fs from 'fs';

let content = fs.readFileSync('src/components/LessonControlModal.tsx', 'utf8');

// Ensure imports
if (!content.includes('import { Lesson, Student, AttendanceStatus, HomeworkStatus, PaymentStatus, LessonReport, StudentSessionPerformance } from \'../types\';')) {
  content = content.replace(
    "import { Lesson, Student, AttendanceStatus, HomeworkStatus, PaymentStatus, LessonReport } from '../types';",
    "import { Lesson, Student, AttendanceStatus, HomeworkStatus, PaymentStatus, LessonReport, StudentSessionPerformance } from '../types';"
  );
}

if (!content.includes('import { StudentSessionPerformanceSelector }')) {
  content = content.replace(
    "import { ParentSummaryModal } from './ParentSummaryModal';",
    "import { ParentSummaryModal } from './ParentSummaryModal';\nimport { StudentSessionPerformanceSelector } from './StudentSessionPerformanceSelector';"
  );
}

fs.writeFileSync('src/components/LessonControlModal.tsx', content);
