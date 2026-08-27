import fs from 'fs';
let content = fs.readFileSync('src/components/ArabicParentReportModal.tsx', 'utf8');

content = content.replace(
  "• درجة الامتحان: ${examScore}\\n• ملاحظات: ${studentNote}\\n----------------------------------`;",
  "• درجة الامتحان: ${examScore}\\n• ملاحظات: ${studentNote}${perfFeedback ? `\\n• أداء الحصة: ${perfFeedback}` : ''}\\n----------------------------------`;"
);

fs.writeFileSync('src/components/ArabicParentReportModal.tsx', content);
