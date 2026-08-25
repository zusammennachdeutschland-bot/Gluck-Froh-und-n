const fs = require('fs');
let content = fs.readFileSync('src/components/finance/FinanceView.tsx', 'utf8');
content = content.replace(
  'className="flex flex-wrap items-center gap-1.5 mt-2"',
  'className="flex overflow-x-auto items-center gap-1.5 mt-2 pb-2 scrollbar-none"'
);
fs.writeFileSync('src/components/finance/FinanceView.tsx', content);
