const fs = require('fs');
let content = fs.readFileSync('src/types/index.ts', 'utf8');
content = content.replace(
  "paymentMethod?: 'vodafone_cash' | 'cash' | 'bank_transfer' | 'paypal' | 'instapay';",
  "defaultFinanceAccountId?: string; // Replaced paymentMethod"
);
fs.writeFileSync('src/types/index.ts', content);
