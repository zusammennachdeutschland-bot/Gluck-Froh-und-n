import fs from 'fs';
let content = fs.readFileSync('src/components/ArabicParentReportModal.tsx', 'utf8');

const searchStr = "• درجة الامتحان: ${examScore}\\n• ملاحظات: ${studentNote}\\n----------------------------------`;";
if (content.includes(searchStr)) {
  content = content.replace(
    searchStr,
    "• درجة الامتحان: ${examScore}\\n• ملاحظات: ${studentNote}${perfFeedback ? `\\n• أداء الحصة: ${perfFeedback}` : ''}\\n----------------------------------`;"
  );
  fs.writeFileSync('src/components/ArabicParentReportModal.tsx', content);
} else {
  console.log("NOT FOUND!");
}
