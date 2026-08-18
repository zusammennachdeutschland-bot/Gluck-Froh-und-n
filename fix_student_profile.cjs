const fs = require('fs');
const path = require('path');

const tsFilePath = path.join(__dirname, 'src', 'i18n', 'translations.ts');
let tsFile = fs.readFileSync(tsFilePath, 'utf8');

const newKeys = {
    'student_sitzungen': { ar: 'الحصص', en: 'SESSIONS', de: 'SITZUNGEN' },
    'student_anwesend': { ar: 'حضور', en: 'PRESENT', de: 'ANWESEND' },
    'student_paketzyklus': { ar: 'الباقات', en: 'PACKAGE', de: 'PAKETZYKLUS' },
    'student_doc_homework': { ar: 'ملف واجب', en: 'Homework File', de: 'Hausaufgaben-Datei' },
    'student_doc_exam': { ar: 'ملف اختبار', en: 'Exam File', de: 'Prüfungsdatei' },
    'student_doc_general': { ar: 'مستند طالب', en: 'Student Doc', de: 'Schülerdokument' },
    'student_notizen': { ar: 'ملاحظات', en: 'NOTES', de: 'NOTIZEN' }
};

const keys = Object.keys(newKeys);

// Append types
let typeInsertPos = tsFile.indexOf('export type TranslationKey =');
if (typeInsertPos > -1) {
    const endOfTypePos = tsFile.indexOf(';', typeInsertPos);
    let addedTypes = keys.map(k => `\n  | '${k}'`).join('');
    tsFile = tsFile.substring(0, endOfTypePos) + addedTypes + tsFile.substring(endOfTypePos);
}

// Append implementations
const langs = ['ar', 'en', 'de'];
langs.forEach(lang => {
    const langStartRegex = new RegExp(`export const translations: Record<AppLanguage, Record<TranslationKey, string>> = {\\s*${lang}: {`);
    const match = langStartRegex.exec(tsFile);
    if (match) {
        const blockStart = match.index + match[0].length;
        let blockEnd = blockStart;
        let depth = 1;
        while(depth > 0 && blockEnd < tsFile.length) {
            if (tsFile[blockEnd] === '{') depth++;
            if (tsFile[blockEnd] === '}') depth--;
            blockEnd++;
        }
        let addedImplementations = keys.map(k => `\n    ${k}: ${JSON.stringify(newKeys[k][lang])},`).join('');
        tsFile = tsFile.substring(0, blockEnd - 1) + addedImplementations + tsFile.substring(blockEnd - 1);
    } else {
        const langStart = tsFile.indexOf(`\n  ${lang}: {`);
        if (langStart > -1) {
            const blockStart = langStart + `\n  ${lang}: {`.length;
            let blockEnd = blockStart;
            let depth = 1;
            while(depth > 0 && blockEnd < tsFile.length) {
                if (tsFile[blockEnd] === '{') depth++;
                if (tsFile[blockEnd] === '}') depth--;
                blockEnd++;
            }
            let addedImplementations = keys.map(k => `\n    ${k}: ${JSON.stringify(newKeys[k][lang])},`).join('');
            tsFile = tsFile.substring(0, blockEnd - 1) + addedImplementations + tsFile.substring(blockEnd - 1);
        }
    }
});

fs.writeFileSync(tsFilePath, tsFile);

let fileContent = fs.readFileSync('src/components/StudentProfileModal.tsx', 'utf8');
fileContent = fileContent.replace(/>SITZUNGEN</g, '>{t(\'student_sitzungen\')}<');
fileContent = fileContent.replace(/>ANWESEND</g, '>{t(\'student_anwesend\')}<');
fileContent = fileContent.replace(/>PAKETZYKLUS</g, '>{t(\'student_paketzyklus\')}<');
fileContent = fileContent.replace(/>Homework File</g, '>{t(\'student_doc_homework\')}<');
fileContent = fileContent.replace(/>Exam File</g, '>{t(\'student_doc_exam\')}<');
fileContent = fileContent.replace(/>Student Doc</g, '>{t(\'student_doc_general\')}<');
fileContent = fileContent.replace(/>Notizen</g, '>{t(\'student_notizen\')}<');

fs.writeFileSync('src/components/StudentProfileModal.tsx', fileContent);
console.log('Fixed StudentProfileModal.tsx');
