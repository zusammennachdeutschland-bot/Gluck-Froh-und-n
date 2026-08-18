const fs = require('fs');
const path = require('path');

const tsFilePath = path.join(__dirname, 'src', 'i18n', 'translations.ts');
let tsFile = fs.readFileSync(tsFilePath, 'utf8');

const newKeys = {
    'setup_subtitle': {
        ar: 'مساعد معلم اللغة الألمانية',
        en: 'German Teacher Assistant',
        de: 'Deutschlehrer-Assistent'
    },
    'setup_description': {
        ar: 'إدارة الطلاب، الحصص، المدفوعات، الواجبات المنزلية والتواصل مع أولياء الأمور في مساحة عمل واحدة جميلة.',
        en: 'Manage students, lessons, payments, homework and parent communication in one beautiful workspace.',
        de: 'Verwalten Sie Schüler, Lektionen, Zahlungen, Hausaufgaben und die Kommunikation mit den Eltern an einem Ort.'
    }
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

let fileContent = fs.readFileSync('src/components/SetupWizard.tsx', 'utf8');
fileContent = fileContent.replace(/>\s*German Teacher Assistant\s*<\/motion\.h2>/, '>{t(\'setup_subtitle\')}</motion.h2>');
fileContent = fileContent.replace(/>\s*Manage students, lessons, payments, homework and parent communication in one beautiful workspace\.\s*<\/motion\.p>/, '>{t(\'setup_description\')}</motion.p>');
fs.writeFileSync('src/components/SetupWizard.tsx', fileContent);

console.log('Fixed SetupWizard.tsx');
