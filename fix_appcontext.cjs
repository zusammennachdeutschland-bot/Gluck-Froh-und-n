const fs = require('fs');
let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');
content = content.replace(/paymentMethod: 'vodafone_cash',/g, '');
content = content.replace(/paymentMethod: method,/g, '');
fs.writeFileSync('src/context/AppContext.tsx', content);
