import fs from 'fs';

let content = fs.readFileSync('src/components/LessonControlModal.tsx', 'utf8');

// Import generateFeedback and StudentSessionPerformance
if (!content.includes('generateFeedback')) {
  content = content.replace(
    "import { X, Calendar, Clock, Video, MapPin, Check, FileText, Download, Copy, Share2, Upload, AlertCircle, Edit, Search, UserCheck, Star, Users, Briefcase, Plus, Coins, PenTool, LayoutDashboard, Brain, MessageSquare, Send } from 'lucide-react';",
    "import { X, Calendar, Clock, Video, MapPin, Check, FileText, Download, Copy, Share2, Upload, AlertCircle, Edit, Search, UserCheck, Star, Users, Briefcase, Plus, Coins, PenTool, LayoutDashboard, Brain, MessageSquare, Send, RefreshCw, BarChart2 } from 'lucide-react';\nimport { generateFeedback } from '../utils/feedbackGenerator';\nimport { StudentSessionPerformance } from '../types';"
  );
}

// Replace any with StudentSessionPerformance
content = content.replace(
  'const [studentPerformance, setStudentPerformance] = useState<Record<string, any>>({});',
  'const [studentPerformance, setStudentPerformance] = useState<Record<string, StudentSessionPerformance>>({});'
);

// Load
content = content.replace(
  'if (selectedLesson.report.studentNotes) {',
  'if (selectedLesson.report.studentPerformance) setStudentPerformance(selectedLesson.report.studentPerformance);\n      if (selectedLesson.report.studentNotes) {'
);

// Draft check
content = content.replace(
  'if (draft.studentNotes) setStudentNotes(draft.studentNotes);',
  'if (draft.studentNotes) setStudentNotes(draft.studentNotes);\n            if (draft.studentPerformance) setStudentPerformance(draft.studentPerformance);'
);

// Check changed
content = content.replace(
  'studentHomeworkDone, studentDictationGrade, studentExamGrade, studentNotes',
  'studentHomeworkDone, studentDictationGrade, studentExamGrade, studentNotes, studentPerformance'
);

// Dependency array
content = content.replace(
  'studentDictationGrade, studentExamGrade, studentNotes]);',
  'studentDictationGrade, studentExamGrade, studentNotes, studentPerformance]);'
);

// Save
content = content.replace(
  'studentNotes: isQuick ? (Object.keys(studentNotes).length > 0 ? studentNotes : { [qId]: selectedLesson.quickNotes || \'\' }) : studentNotes,',
  'studentNotes: isQuick ? (Object.keys(studentNotes).length > 0 ? studentNotes : { [qId]: selectedLesson.quickNotes || \'\' }) : studentNotes,\n      studentPerformance,'
);

fs.writeFileSync('src/components/LessonControlModal.tsx', content);
