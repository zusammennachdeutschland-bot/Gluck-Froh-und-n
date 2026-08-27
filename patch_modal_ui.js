import fs from 'fs';

let content = fs.readFileSync('src/components/LessonControlModal.tsx', 'utf8');

// Find the insertion point
content = content.replace(
  `                                  <StudentSessionPerformanceSelector 
                                    performance={studentPerformance[st.id]}
                                    onChange={(perf) => setStudentPerformance(prev => ({ ...prev, [st.id]: perf }))}
                                    language={settings.reportLanguage || 'ar'}
                                  />`,
  `                                  <StudentSessionPerformanceSelector 
                                    performance={studentPerformance[st.id]}
                                    onChange={(perf) => setStudentPerformance(prev => ({ ...prev, [st.id]: perf }))}
                                    language={profile?.language === 'en' ? 'en' : profile?.language === 'de' ? 'de' : 'ar'}
                                  />`
);

fs.writeFileSync('src/components/LessonControlModal.tsx', content);
