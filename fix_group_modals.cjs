const fs = require('fs');

function replaceFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/paymentMethod:\s*data\.paymentMethod/g, 'defaultFinanceAccountId: data.defaultFinanceAccountId');
  fs.writeFileSync(path, content);
}

replaceFile('src/components/AddGroupModal.tsx');
replaceFile('src/components/GroupProfileModal.tsx');
