const fs = require('fs');
let content = fs.readFileSync('src/components/StudentProfileModal.tsx', 'utf8');

// Remove the inline _t definition
content = content.replace(/const _t = \([^)]*\)\s*=>\s*\{\s*return profile\.language === 'ar' \? ar : profile\.language === 'en' \? en : de;\s*\};/g, '');

// Also fix the comma operator issue on line 611, what is it?
fs.writeFileSync('src/components/StudentProfileModal.tsx', content);
