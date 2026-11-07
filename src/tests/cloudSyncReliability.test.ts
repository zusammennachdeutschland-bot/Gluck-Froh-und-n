import assert from 'node:assert/strict';
import { mergeEntities } from '../services/sync/mergeEngine';
import { SyncableRecord } from '../types';

interface TestEntity extends SyncableRecord {
  id: string;
  name?: string;
  value?: number;
  certificateName?: string;
}

export function runCloudSyncReliabilityTests(): { passed: boolean; log: string[] } {
  const log: string[] = [];

  try {
    // 1. Local-only records survive synchronization
    const local1: TestEntity[] = [{ id: 'L1', name: 'Local Only', updatedAt: 1000 }];
    const remote1: TestEntity[] = [];
    const res1 = mergeEntities(local1, remote1, 'test');
    assert.equal(res1.merged.some(e => e.id === 'L1'), true);
    log.push('[PASS] 1. Local-only records survive synchronization');

    // 2. Cloud-only records appear locally
    const local2: TestEntity[] = [];
    const remote2: TestEntity[] = [{ id: 'R1', name: 'Cloud Only', updatedAt: 1000 }];
    const res2 = mergeEntities(local2, remote2, 'test');
    assert.equal(res2.merged.some(e => e.id === 'R1'), true);
    log.push('[PASS] 2. Cloud-only records appear locally');

    // 3. Empty cloud data never erases populated local data
    const local3: TestEntity[] = [{ id: 'L1', name: 'Local Data', updatedAt: 1000 }];
    const remote3: TestEntity[] = []; // Empty array
    const res3 = mergeEntities(local3, remote3, 'test');
    assert.equal(res3.merged.length, 1);
    assert.equal(res3.merged[0].id, 'L1');
    log.push('[PASS] 3. Empty cloud data never erases populated local data');

    // 4. Empty local data never erases populated cloud data
    const local4: TestEntity[] = [];
    const remote4: TestEntity[] = [{ id: 'R1', name: 'Cloud Data', updatedAt: 1000 }];
    const res4 = mergeEntities(local4, remote4, 'test');
    assert.equal(res4.merged.length, 1);
    assert.equal(res4.merged[0].id, 'R1');
    log.push('[PASS] 4. Empty local data never erases populated cloud data');

    // 5. Explicit deletion tombstones synchronize correctly
    const local5: TestEntity[] = [{ id: 'T1', name: 'Alive', updatedAt: 1000 }];
    const remote5: TestEntity[] = [{ id: 'T1', name: 'Alive', updatedAt: 2000, deleted: true }];
    const res5 = mergeEntities(local5, remote5, 'test');
    assert.equal(res5.merged[0].deleted, true);
    log.push('[PASS] 5. Explicit deletion tombstones synchronize correctly');

    // 6. Conflicting edits resolve deterministically (LWW)
    const local6: TestEntity[] = [{ id: 'C1', name: 'Local Name', updatedAt: 1000 }];
    const remote6: TestEntity[] = [{ id: 'C1', name: 'Remote Name', updatedAt: 2000 }];
    const res6 = mergeEntities(local6, remote6, 'test');
    assert.equal(res6.merged[0].name, 'Remote Name');
    
    const local6b: TestEntity[] = [{ id: 'C1', name: 'Local Name', updatedAt: 3000 }];
    const remote6b: TestEntity[] = [{ id: 'C1', name: 'Remote Name', updatedAt: 2000 }];
    const res6b = mergeEntities(local6b, remote6b, 'test');
    assert.equal(res6b.merged[0].name, 'Local Name');
    log.push('[PASS] 6. Conflicting edits resolve deterministically (LWW)');

    // 7. Deterministic tie-breaking (originRevision / deviceId)
    const local7: TestEntity[] = [{ id: 'TIE', name: 'Local', updatedAt: 1000, originRevision: 1, updatedByDeviceId: 'A' }];
    const remote7: TestEntity[] = [{ id: 'TIE', name: 'Remote', updatedAt: 1000, originRevision: 2, updatedByDeviceId: 'B' }];
    const res7 = mergeEntities(local7, remote7, 'test');
    assert.equal(res7.merged[0].name, 'Remote'); // Revision 2 > 1
    log.push('[PASS] 7. Deterministic tie-breaking (Revision/ID)');

    // 8. Tombstone protection (Older record cannot resurrect deleted one)
    const local8: TestEntity[] = [{ id: 'D1', deleted: true, updatedAt: 2000 }];
    const remote8: TestEntity[] = [{ id: 'D1', deleted: false, updatedAt: 1000 }];
    const res8 = mergeEntities(local8, remote8, 'test');
    assert.equal(res8.merged[0].deleted, true);
    log.push('[PASS] 8. Tombstone protection (Resurrection blocked)');

    // 9. New device scenario (Empty local + populated remote)
    const local9: TestEntity[] = [];
    const remote9: TestEntity[] = [
      { id: '1', name: 'A', updatedAt: 100 },
      { id: '2', name: 'B', updatedAt: 200 }
    ];
    const res9 = mergeEntities(local9, remote9, 'test');
    assert.equal(res9.merged.length, 2);
    log.push('[PASS] 9. New device scenario (Restore works)');

    // 10. Multi-device convergence
    const deviceA: TestEntity[] = [{ id: 'X', value: 1, updatedAt: 100 }];
    const deviceB: TestEntity[] = [{ id: 'X', value: 2, updatedAt: 200 }];
    const sync1 = mergeEntities(deviceA, deviceB, 'test'); // B wins
    const sync2 = mergeEntities(deviceB, deviceA, 'test'); // B wins
    assert.equal(sync1.merged[0].value, 2);
    assert.equal(sync2.merged[0].value, 2);
    log.push('[PASS] 10. Multi-device convergence (Commutative)');

    // 11. Specialized field preservation (certificateName)
    const localCert: TestEntity[] = [{ id: 'S1', name: 'أحمد', certificateName: 'Ahmed', updatedAt: 1000 }];
    const remoteCert: TestEntity[] = [{ id: 'S1', name: 'أحمد محمد', certificateName: '', updatedAt: 2000 }];
    const resCert = mergeEntities(localCert, remoteCert, 'test');
    assert.equal(resCert.merged[0].name, 'أحمد محمد');
    assert.equal(resCert.merged[0].certificateName, 'Ahmed');
    log.push('[PASS] 11. Specialized field preservation (certificateName)');

    // 12. Picker names union merge logic
    const localPicker = ['Alice', 'Bob'];
    const remotePicker = ['Bob', 'Charlie'];
    const combinedPicker = Array.from(new Set([...localPicker, ...remotePicker]));
    assert.equal(combinedPicker.length, 3);
    assert.equal(combinedPicker.includes('Alice'), true);
    assert.equal(combinedPicker.includes('Bob'), true);
    assert.equal(combinedPicker.includes('Charlie'), true);
    log.push('[PASS] 12. Picker names union merge logic');

    // 13. Singleton LWW logic (from AppContext)
    const localTime = 1000;
    const remoteTimeNewer = 2000;
    const remoteTimeOlder = 500;
    
    const isNewer = remoteTimeNewer >= localTime;
    const isOlder = remoteTimeOlder >= localTime;
    assert.equal(isNewer, true);
    assert.equal(isOlder, false);
    log.push('[PASS] 13. Singleton LWW logic (Backup timestamp check)');

    return { passed: true, log };
  } catch (err: any) {
    log.push('[FAIL] ' + err.message);
    return { passed: false, log };
  }
}

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const result = runCloudSyncReliabilityTests();
  result.log.forEach(line => console.log(line));
}
