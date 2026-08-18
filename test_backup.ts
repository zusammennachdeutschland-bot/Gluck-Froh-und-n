import { validateAndSanitizeBackupPayload } from './src/utils/backupEngine';

const testPayload = {
  version: '2.0.0',
  data: {
    groups: [
      { id: '1', name: 'Group A', type: 'online', zoomLink: 'https://zoom.us/j/123' },
      { id: '2', name: 'Group B', type: 'offline', address: '123 Main St' }
    ]
  }
};

const result = validateAndSanitizeBackupPayload(testPayload);
console.log(JSON.stringify(result.data.groups, null, 2));
