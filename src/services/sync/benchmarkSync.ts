import { Student, Lesson, PaymentRecord, Group, SyncableRecord } from '../../types';
import { buildOutboundDelta, calculatePendingOutbox } from './deltaBuilder';
import { mergeEntities } from './mergeEngine';

export interface BenchmarkMetrics {
  totalEntities: number;
  deltaBuildTimeMs: number;
  mergeExecutionTimeMs: number;
  outboxCalculationTimeMs: number;
  serializedPayloadSizeBytes: number;
  heapMemoryDiffBytes?: number;
  devicesSimulated: number;
  performanceGrade: 'OPTIMAL' | 'ACCEPTABLE' | 'DEGRADED';
}

/**
 * Runs a performance and reliability stress test against the synchronization engine.
 * Simulates: 500 Students, 1000 Lessons, 500 Payments, 50 Groups across 5 devices.
 */
export function runSyncStressBenchmark(): BenchmarkMetrics {
  const numStudents = 500;
  const numLessons = 1000;
  const numPayments = 500;
  const numGroups = 50;
  const numDevices = 5;

  // 1. Generate Synthetic Data
  const groups: Group[] = [];
  for (let i = 0; i < numGroups; i++) {
    groups.push({
      id: `bench_group_${i}`,
      name: `Benchmark Class ${i}`,
      grade: 'Grade 10',
      subject: 'German',
      pricePerSession: 30,
      sessionsPerPackage: 8,
      packagePrice: 240,
      color: 'blue',
      originDeviceId: `device_${i % numDevices}`,
      originRevision: i + 1,
      updatedAt: Date.now() - (i * 1000),
      deleted: false
    } as any);
  }

  const students: Student[] = [];
  for (let i = 0; i < numStudents; i++) {
    students.push({
      id: `bench_student_${i}`,
      name: `Student Name ${i}`,
      groupId: groups[i % numGroups].id,
      grade: 'Grade 10',
      parentName: `Parent of ${i}`,
      parentPhone: '+491512345678',
      joinedDate: '2026-01-01',
      documents: [],
      originDeviceId: `device_${i % numDevices}`,
      originRevision: (i % 20) + 1,
      updatedAt: Date.now() - (i * 500),
      deleted: false
    } as any);
  }

  const lessons: Lesson[] = [];
  for (let i = 0; i < numLessons; i++) {
    lessons.push({
      id: `bench_lesson_${i}`,
      studentId: students[i % numStudents].id,
      studentName: students[i % numStudents].name,
      groupId: groups[i % numGroups].id,
      groupName: groups[i % numGroups].name,
      title: `Lesson ${i}`,
      date: '2026-08-16',
      time: '14:00',
      durationMinutes: 60,
      price: 30,
      status: i % 10 === 0 ? 'completed' : 'scheduled',
      type: 'online',
      originDeviceId: `device_${i % numDevices}`,
      originRevision: (i % 30) + 1,
      updatedAt: Date.now() - (i * 200),
      deleted: false
    } as any);
  }

  const payments: PaymentRecord[] = [];
  for (let i = 0; i < numPayments; i++) {
    payments.push({
      id: `bench_payment_${i}`,
      studentId: students[i % numStudents].id,
      studentName: students[i % numStudents].name,
      amountDue: 240,
      amountPaid: i % 2 === 0 ? 240 : 120,
      remainingBalance: i % 2 === 0 ? 0 : 120,
      status: i % 2 === 0 ? 'paid' : 'partial',
      paymentMethod: 'cash',
      paidDate: '2026-08-16',
      originDeviceId: `device_${i % numDevices}`,
      originRevision: (i % 15) + 1,
      updatedAt: Date.now() - (i * 300),
      deleted: false
    } as any);
  }

  const localData: Record<string, SyncableRecord[]> = {
    groups,
    students,
    lessons,
    payments
  };

  const watermarkTable = {
    peer_target: {
      device_0: 10,
      device_1: 5,
      device_2: 0
    }
  };

  const localDevice = { id: 'device_0', name: 'Master Benchmark Device' };

  // 2. Measure Delta Generation
  const t0 = performance.now();
  const deltaPayload = buildOutboundDelta('peer_target', watermarkTable, localData, localDevice);
  const deltaBuildTimeMs = Math.round((performance.now() - t0) * 100) / 100;

  // 3. Measure Serialized Size
  const serialized = JSON.stringify(deltaPayload);
  const serializedPayloadSizeBytes = new Blob([serialized]).size;

  // 4. Measure Merge Execution
  const incomingRecords: Student[] = students.slice(0, 250).map((s, idx) => ({
    ...s,
    updatedAt: Date.now() + idx, // newer timestamp to trigger merge
    originRevision: (s.originRevision || 1) + 1,
    originDeviceId: 'device_remote'
  }));

  const t1 = performance.now();
  const mergeResult = mergeEntities(students, incomingRecords, 'students');
  const mergeExecutionTimeMs = Math.round((performance.now() - t1) * 100) / 100;

  // 5. Measure Outbox Calculation
  const t2 = performance.now();
  const outbox = calculatePendingOutbox(watermarkTable, localData, [
    { deviceId: 'peer_target', deviceName: 'Peer 1', lastKnownIp: '123456', port: 0, pairingToken: 't1', lastSyncedTimestamp: 0, isOnline: true }
  ]);
  const outboxCalculationTimeMs = Math.round((performance.now() - t2) * 100) / 100;

  const totalEntities = groups.length + students.length + lessons.length + payments.length;

  const performanceGrade = 
    (deltaBuildTimeMs < 50 && mergeExecutionTimeMs < 50 && outboxCalculationTimeMs < 50) 
      ? 'OPTIMAL' 
      : (deltaBuildTimeMs < 150 ? 'ACCEPTABLE' : 'DEGRADED');

  return {
    totalEntities,
    deltaBuildTimeMs,
    mergeExecutionTimeMs,
    outboxCalculationTimeMs,
    serializedPayloadSizeBytes,
    devicesSimulated: numDevices,
    performanceGrade
  };
}
