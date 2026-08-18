const fs = require('fs');
['src/components/DataHealthCenterModal.tsx', 'src/components/InspirationCardWidget.tsx', 'src/components/NotificationSettingsSection.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const _t = \([^)]*\)\s*=>\s*\{\s*return language === 'ar' \? ar : language === 'de' \? \(de \|\| en\) : en;\s*\};/g, '');
  content = content.replace(/const _t = \([^)]*\)\s*=>\s*language === 'ar' \? ar : language === 'de' \? \(de \|\| en\) : en;/g, '');
  fs.writeFileSync(file, content);
});
