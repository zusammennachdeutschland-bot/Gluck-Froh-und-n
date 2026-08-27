import fs from 'fs';
let content = fs.readFileSync('src/components/ArabicParentReportModal.tsx', 'utf8');

const targetStr = "ملاحظات المعلم:\n• ${notesCombined}\n\nشكراً لكم،";
const replacementStr = "ملاحظات المعلم:\n• ${notesCombined}\n${perfFeedback ? `أداء الحصة:\n• ${perfFeedback}\n\n` : ''}شكراً لكم،";

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync('src/components/ArabicParentReportModal.tsx', content);
  console.log("Replaced successfully");
} else {
  console.log("String not found! Trying fallback...");
  // Fallback search
  const regex = /ملاحظات المعلم:\n• \$\{notesCombined\}\n\nشكراً لكم،/g;
  if (regex.test(content)) {
     content = content.replace(regex, replacementStr);
     fs.writeFileSync('src/components/ArabicParentReportModal.tsx', content);
     console.log("Replaced with regex successfully");
  } else {
     console.log("Regex also failed to find it.");
  }
}
