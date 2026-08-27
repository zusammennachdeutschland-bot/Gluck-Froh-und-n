import fs from 'fs';

let content = fs.readFileSync('src/components/StudentSessionPerformanceSelector.tsx', 'utf8');

content = content.replace(
  "const generated = generateFeedback(newPerf, language, newPerf.feedbackVariantId);",
  "const generated = generateFeedback(newPerf, language as 'ar' | 'en' | 'de', newPerf.feedbackVariantId);"
);
content = content.replace(
  "const generated = generateFeedback(perf, language, perf.feedbackVariantId);",
  "const generated = generateFeedback(perf, language as 'ar' | 'en' | 'de', perf.feedbackVariantId);"
);

fs.writeFileSync('src/components/StudentSessionPerformanceSelector.tsx', content);
