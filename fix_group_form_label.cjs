const fs = require('fs');
let content = fs.readFileSync('src/components/GroupForm.tsx', 'utf8');
content = content.replace("Standard Zahlungsart:", "Standard Konto (Default Account):");
fs.writeFileSync('src/components/GroupForm.tsx', content);
