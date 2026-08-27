import fs from 'fs';
let content = fs.readFileSync('src/components/ArabicParentReportModal.tsx', 'utf8');

const targetStr = "ملاحظات المعلم:\n• ${notesCombined}\n${perfFeedback ? `أداء الحصة:\n• ${perfFeedback}\n\n` : ''}شكراً لكم،";
const replacementStr = "ملاحظات المعلم:\n• ${notesCombined}\n${perfFeedback ? `\\nأداء الحصة:\\n• ${perfFeedback}\\n\\n` : '\\n'}شكراً لكم،";

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync('src/components/ArabicParentReportModal.tsx', content);
  console.log("Replaced successfully");
} else {
  console.log("Not found.");
}
