import {
  APP_ROOT_FOLDER,
  SUBFOLDER_BY_CATEGORY,
  sanitizeStorageFileName,
  saveToPhoneSubfolderAndRegister,
  getDownloadedFilesRegistry,
  deleteDownloadedFileRecord,
  clearDownloadedFilesRegistry
} from '../services/downloadedFilesService';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] || null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('❌ Assertion failed:', msg);
    process.exit(1);
  }
}

async function runTests() {
  console.log('--- Running Downloaded Files & Phone Subfolder Unit Tests ---');

  // 1. Verify root folder & subfolder mapping
  assert(APP_ROOT_FOLDER === 'Gluck_Lernstudio', 'Root folder should be Gluck_Lernstudio');
  assert(SUBFOLDER_BY_CATEGORY.certificates === 'Certificates', 'Certificates subfolder mismatch');
  assert(SUBFOLDER_BY_CATEGORY.worksheets === 'Worksheets', 'Worksheets subfolder mismatch');
  assert(SUBFOLDER_BY_CATEGORY.parent_reports === 'Parent_Reports', 'Parent_Reports subfolder mismatch');
  assert(SUBFOLDER_BY_CATEGORY.schedules === 'Schedules', 'Schedules subfolder mismatch');
  assert(SUBFOLDER_BY_CATEGORY.school_plans === 'School_Plans_And_Visits', 'School_Plans_And_Visits subfolder mismatch');
  assert(SUBFOLDER_BY_CATEGORY.finance === 'Finance_And_Receipts', 'Finance_And_Receipts subfolder mismatch');
  assert(SUBFOLDER_BY_CATEGORY.backups === 'Backups_And_Contacts', 'Backups_And_Contacts subfolder mismatch');

  // 2. Verify filename sanitization
  const safeName = sanitizeStorageFileName('Zertifikat: Ahmed / Klasse 5?', 'pdf');
  assert(safeName === 'Zertifikat__Ahmed___Klasse_5_.pdf', `Expected sanitized filename, got: ${safeName}`);

  // 3. Test registering a certificate before WhatsApp share
  clearDownloadedFilesRegistry();
  const certRec = await saveToPhoneSubfolderAndRegister({
    title: 'شهادة واتساب: المستوى الأول - آسر عمر',
    fileName: 'Zertifikat_Asser_Omar.png',
    category: 'certificates',
    actionType: 'whatsapp',
    format: 'png',
    base64OrDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    studentName: 'آسر عمر',
    recipientPhone: '201000000000',
    textContent: 'تهانينا للطالب آسر عمر'
  });

  assert(certRec.subFolder === 'Certificates', 'Certificate subFolder should be Certificates');
  assert(certRec.fullStoragePath.includes('Gluck_Lernstudio/Certificates/Zertifikat_Asser_Omar.png'), `Unexpected fullStoragePath: ${certRec.fullStoragePath}`);

  // 4. Test registering a worksheet PDF
  const wsRec = await saveToPhoneSubfolderAndRegister({
    title: 'ورقة عمل: Die Familie (نسخة الطالب)',
    fileName: 'Glueck_Worksheet_Die_Familie.pdf',
    category: 'worksheets',
    actionType: 'download_pdf',
    format: 'pdf',
    groupName: 'Klasse 5'
  });

  assert(wsRec.subFolder === 'Worksheets', 'Worksheet subFolder should be Worksheets');
  assert(wsRec.fullStoragePath.includes('Gluck_Lernstudio/Worksheets/Glueck_Worksheet_Die_Familie.pdf'), 'Worksheet path should contain Gluck_Lernstudio/Worksheets');

  // 5. Verify registry retrieval & deletion
  const all = getDownloadedFilesRegistry();
  assert(all.length === 2, `Expected 2 records in registry, found ${all.length}`);
  assert(all[0].id === wsRec.id, 'Newest record should be first');

  await deleteDownloadedFileRecord(certRec.id);
  const afterDel = getDownloadedFilesRegistry();
  assert(afterDel.length === 1 && afterDel[0].id === wsRec.id, 'Record deletion failed');

  clearDownloadedFilesRegistry();
  assert(getDownloadedFilesRegistry().length === 0, 'Clear registry failed');

  console.log('✅ All Downloaded Files & Phone Subfolder Unit Tests Passed Successfully!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
