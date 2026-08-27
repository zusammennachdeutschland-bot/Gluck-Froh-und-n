import fs from 'fs';
let content = fs.readFileSync('src/components/ArabicParentReportModal.tsx', 'utf8');

const regex = /• ملاحظات: \$\{studentNote\}\n----------------------------------`;/g;
content = content.replace(regex, "• ملاحظات: ${studentNote}${perfFeedback ? `\\n• أداء الحصة: ${perfFeedback}` : ''}\\n----------------------------------`;");

fs.writeFileSync('src/components/ArabicParentReportModal.tsx', content);
