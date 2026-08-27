import fs from 'fs';

let content = fs.readFileSync('src/components/ArabicParentReportModal.tsx', 'utf8');

// The line is: • ${notesCombined}
content = content.replace(
  "ملاحظات المعلم:\\n• ${notesCombined}\\n\\nشكراً لكم،",
  "ملاحظات المعلم:\\n• ${notesCombined}\\n${perfFeedback ? `\\nأداء الحصة:\\n• ${perfFeedback}\\n` : ''}\\nشكراً لكم،"
);

content = content.replace(
  "• درجة الامتحان: ${examScore}\\n• ملاحظات: ${studentNote}----------------------------------`;",
  "• درجة الامتحان: ${examScore}\\n• ملاحظات: ${studentNote}${perfFeedback ? `\\n• أداء الحصة: ${perfFeedback}` : ''}\\n----------------------------------`;"
);

fs.writeFileSync('src/components/ArabicParentReportModal.tsx', content);
