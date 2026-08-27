import fs from 'fs';
let content = fs.readFileSync('src/components/ParentSummaryModal.tsx', 'utf8');

content = content.replace(
  "const generateSummaryText = () => {",
  "const generateSummaryText = () => {\n    const perfFeedback = report?.studentPerformance?.[activeStudent?.id || '']?.generatedFeedback?.detailed || '';"
);

content = content.replace(
  `"$\{report?.teacherNotes || 'Sehr gute Leistung und aktive Teilnahme im Unterricht.'}"`,
  `"$\{report?.teacherNotes || 'Sehr gute Leistung und aktive Teilnahme im Unterricht.'}"$\{perfFeedback ? \`\\n\\nLeistungsbericht:\\n$\{perfFeedback}\` : ''}`
);

fs.writeFileSync('src/components/ParentSummaryModal.tsx', content);
