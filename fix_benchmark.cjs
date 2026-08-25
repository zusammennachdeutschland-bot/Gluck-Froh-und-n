const fs = require('fs');
let content = fs.readFileSync('src/services/sync/benchmarkSync.ts', 'utf8');
content = content.replace(/paymentMethod:\s*'cash'/g, "defaultFinanceAccountId: 'acc_1'");
fs.writeFileSync('src/services/sync/benchmarkSync.ts', content);
