const fs = require('fs');
const content = fs.readFileSync('src/components/finance/FinanceView.tsx', 'utf8');
const fixedContent = content.substring(0, content.indexOf('};     </AnimatePresence>      </div>    </div>  );};')) + '};\n';
fs.writeFileSync('src/components/finance/FinanceView.tsx', fixedContent);
