#!/bin/bash
sed -i 's/const \[studentNotes, setStudentNotes\] = useState<Record<string, string>>({});/const \[studentNotes, setStudentNotes\] = useState<Record<string, string>>({});\n  const \[studentPerformance, setStudentPerformance\] = useState<Record<string, any>>({});/' src/components/LessonControlModal.tsx
