const fs = require('fs');
let content = fs.readFileSync('src/components/ReportsView.tsx', 'utf8');

content = content.replace(/>Erhaltene Einnahmen</g, '>{t(\'reports_collected_revenue\')}<');
content = content.replace(/>Offener Betrag</g, '>{t(\'reports_unpaid_amount\')}<');
content = content.replace(/>Sitzungen Absolviert</g, '>{t(\'reports_sessions_completed\')}<');
content = content.replace(/>Insgesamt durchgeführt</g, '>{t(\'reports_total_conducted\')}<');
content = content.replace(/>Anwesenheitsübersicht der Schüler</g, '>{t(\'reports_attendance_overview_title\')}<');
content = content.replace(/>Als Bezahlt</g, '>{t(\'payments_paid_btn\')}<');
content = content.replace(/>Pakete</g, ">{t('reports_packages') || 'Pakete'}<");

fs.writeFileSync('src/components/ReportsView.tsx', content);
console.log('Fixed ReportsView hardcoded text');
