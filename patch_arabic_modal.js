import fs from 'fs';

let content = fs.readFileSync('src/components/ArabicParentReportModal.tsx', 'utf8');

// For group report (bulk)
content = content.replace(
  "const studentNote = lesson.report?.studentNotes?.[st.id] || 'مستوى ممتاز ومتفاعل في الحصة.';",
  "const studentNote = lesson.report?.studentNotes?.[st.id] || 'مستوى ممتاز ومتفاعل في الحصة.';\n      const perfFeedback = lesson.report?.studentPerformance?.[st.id]?.generatedFeedback?.parent;"
);

content = content.replace(
  "• درجة الامتحان: ${examScore}\\n• ملاحظات: ${studentNote}\\n-----------------------------------`;",
  "• درجة الامتحان: ${examScore}\\n• ملاحظات: ${studentNote}${perfFeedback ? `\\n• أداء الحصة: ${perfFeedback}` : ''}\\n-----------------------------------`;"
);

// For single student report
content = content.replace(
  "let studentNote = '';",
  "let studentNote = '';\n    let perfFeedback = '';"
);

content = content.replace(
  "studentNote = lesson.report?.studentNotes?.[activeStudent.id] || '';",
  "studentNote = lesson.report?.studentNotes?.[activeStudent.id] || '';\n      perfFeedback = lesson.report?.studentPerformance?.[activeStudent.id]?.generatedFeedback?.parent || '';"
);

content = content.replace(
  "ملاحظات المعلم:\\n${studentNote}\\n",
  "ملاحظات المعلم:\\n${studentNote}\\n${perfFeedback ? `\\nأداء الحصة:\\n${perfFeedback}\\n` : ''}"
);

fs.writeFileSync('src/components/ArabicParentReportModal.tsx', content);
