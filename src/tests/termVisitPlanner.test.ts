import { 
  generateTermVisitPlan, getDefaultTermDates, isMatchingClass 
} from '../services/termVisitPlannerService';
import { SchoolSettings, VisitRecord, Teacher } from '../types';

export function runTermVisitPlannerTests(): { passed: boolean; log: string[] } {
  const log: string[] = [];
  let passed = true;

  function assert(condition: boolean, description: string) {
    if (condition) {
      log.push(`[PASS] ${description}`);
    } else {
      log.push(`[FAIL] ${description}`);
      passed = false;
    }
  }

  // Sample Mock School Settings
  const mockTeachers: Teacher[] = [
    { id: 't1', name: 'Herr Mohamed', isActive: true, isHod: false },
    { id: 't2', name: 'Frau Sarah', isActive: true, isHod: false },
    { id: 't3_dup_name', name: 'Herr Mohamed', isActive: true, isHod: false }, // Same name, different ID
  ];

  const mockTeacherSchedules = {
    't1': {
      '0': [{ periodNumber: 1, className: 'Grade 5 - 5A', subjectName: 'German' }],
      '1': [{ periodNumber: 2, className: 'Grade 6 - 6B', subjectName: 'German' }]
    },
    't2': {
      '0': [{ periodNumber: 2, className: 'Grade 7 - 7A', subjectName: 'German' }],
      '2': [{ periodNumber: 3, className: 'Grade 8 - 8A', subjectName: 'German' }]
    },
    't3_dup_name': {
      '0': [{ periodNumber: 3, className: 'Grade 5 - 5B', subjectName: 'German' }]
    }
  };

  const mockHodSchedule = {
    '0': [{ periodNumber: 1, className: 'Grade 10', subjectName: 'German' }] // HOD busy Sunday P1
  };

  const mockHistoricalVisits: VisitRecord[] = [
    {
      id: 'v_existing_1',
      teacherId: 't1',
      teacherName: 'Herr Mohamed',
      className: 'Grade 5 - 5A',
      term: 'Term 1',
      visitedDate: '2026-09-20',
      periodNumber: '1',
      overallScore: 70,
      overallCategory: 'ممتاز'
    },
    {
      id: 'v_cancelled_1',
      teacherId: 't2',
      teacherName: 'Frau Sarah',
      className: 'Grade 7 - 7A',
      term: 'Term 1',
      visitedDate: '2026-09-21',
      periodNumber: '2',
      status: 'cancelled'
    } as any,
    {
      id: 'v_other_term',
      teacherId: 't2',
      teacherName: 'Frau Sarah',
      className: 'Grade 8 - 8A',
      term: 'Term 2 (Old Year)',
      visitedDate: '2024-02-10',
      periodNumber: '3'
    }
  ];

  const mockSettings: SchoolSettings = {
    presence: {
      '0': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '1': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '2': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '3': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '4': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '5': { active: false, arrivalTime: '07:30', departureTime: '14:30' },
      '6': { active: false, arrivalTime: '07:30', departureTime: '14:30' }
    },
    periodSettings: {
      periodsCount: 7,
      firstPeriodStart: '08:00',
      defaultDuration: 45,
      customDurations: {}
    },
    schedule: mockHodSchedule,
    teachers: mockTeachers,
    teacherSchedules: mockTeacherSchedules as any,
    visitRecords: mockHistoricalVisits,
    currentTerm: 'Term 1'
  };

  // Test 1: Historical Visit Preservation & Cancellation Check
  const res1 = generateTermVisitPlan(mockSettings, [], {
    term: 'Term 1',
    startDate: '2026-09-15',
    endDate: '2026-10-15',
    workingDays: ['0', '1', '2']
  });

  const t1G5Req = res1.requirements.find(r => r.teacherId === 't1' && isMatchingClass(r.gradeClass, 'Grade 5 - 5A'));
  assert(t1G5Req?.completedVisitsCount === 1, '1a. Existing completed visits are reconciled and marked completed');
  assert(t1G5Req?.isSatisfied === true, '1b. Completed visit satisfies requirement without duplicate creation');

  // Test 2: Cancelled Visit Non-Satisfaction
  const t2G7Req = res1.requirements.find(r => r.teacherId === 't2' && isMatchingClass(r.gradeClass, 'Grade 7 - 7A'));
  assert(t2G7Req?.completedVisitsCount === 0, '2. Cancelled historical visits do NOT count toward completed requirement');

  // Test 3: Other Term Visits Non-Counting
  const t2G8Req = res1.requirements.find(r => r.teacherId === 't2' && isMatchingClass(r.gradeClass, 'Grade 8 - 8A'));
  assert(t2G8Req?.completedVisitsCount === 0, '3. Visits from another term/year outside range do NOT count toward selected term');

  // Test 4: Same Teacher Name but Different IDs Distinctions
  const t3G5BReq = res1.requirements.find(r => r.teacherId === 't3_dup_name' && isMatchingClass(r.gradeClass, 'Grade 5 - 5B'));
  assert(t3G5BReq?.teacherId === 't3_dup_name' && t3G5BReq?.completedVisitsCount === 0, '4. Teachers with identical names are disambiguated by ID');

  // Test 5: Same Grade Different Sections (Grade 5 - 5A vs Grade 5 - 5B)
  assert(!isMatchingClass('Grade 5 - 5A', 'Grade 5 - 5B'), '5. Class matcher correctly distinguishes section 5A from section 5B');

  // Test 6: Idempotency (Repeated Generation Produces Same Result)
  const res2 = generateTermVisitPlan(mockSettings, [], {
    term: 'Term 1',
    startDate: '2026-09-15',
    endDate: '2026-10-15',
    workingDays: ['0', '1', '2']
  });
  assert(res1.plannedVisits.length === res2.plannedVisits.length, '6. Repeated plan generation is idempotent and produces no duplicates');

  // Test 7: No Visit Scheduled During HOD Teaching Periods
  const SundayP1PlannedVisits = res1.plannedVisits.filter(v => v.dayKey === '0' && v.periodNumber === 1 && v.status === 'planned');
  assert(SundayP1PlannedVisits.length === 0, '7. No new planned visits scheduled during HOD teaching periods');

  // Test 8: Target Teacher Actually Teaching Proposed Class
  const t2Visits = res1.plannedVisits.filter(v => v.teacherId === 't2' && v.status === 'planned');
  const validT2Slots = t2Visits.every(v => {
    if (v.dayKey === '0' && v.periodNumber === 2 && isMatchingClass(v.gradeClass, 'Grade 7 - 7A')) return true;
    if (v.dayKey === '2' && v.periodNumber === 3 && isMatchingClass(v.gradeClass, 'Grade 8 - 8A')) return true;
    return false;
  });
  assert(validT2Slots, '8. All planned visits match target teacher active teaching slots');

  // Test 9: No Overlapping Visits for HOD
  const visitSlotSet = new Set<string>();
  let hasOverlap = false;
  res1.plannedVisits.forEach(v => {
    const key = `${v.date}_${v.periodNumber}`;
    if (visitSlotSet.has(key)) hasOverlap = true;
    visitSlotSet.add(key);
  });
  assert(!hasOverlap, '9. No overlapping visits scheduled for HOD on any date/period');

  // Test 10: Accurate Coverage Calculations
  assert(res1.summary.completedCount === 1, '10a. Summary completedCount is accurate');
  assert(res1.summary.coveragePercentage === 20, '10b. Verified coverage percentage calculated accurately (1/5 = 20%)');

  return { passed, log };
}

// Self-run when executed directly via tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('termVisitPlanner.test')) {
  const result = runTermVisitPlannerTests();
  console.log('=== EXTENDED TERM VISIT PLANNER REGRESSION TESTS ===');
  result.log.forEach(l => console.log(l));
  console.log('Result:', result.passed ? 'ALL 10 REGRESSION TESTS PASSED ✓' : 'TESTS FAILED ✕');
}
