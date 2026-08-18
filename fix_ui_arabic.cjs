const fs = require('fs');
const path = require('path');

const tsFilePath = path.join(__dirname, 'src', 'i18n', 'translations.ts');
let tsFile = fs.readFileSync(tsFilePath, 'utf8');

const newKeys = {
    'zoom_saved': {
        ar: 'تم الحفظ',
        en: 'Saved',
        de: 'Gespeichert'
    },
    'zoom_save_group': {
        ar: 'حفظ للجروب',
        en: 'Save for group',
        de: 'Für Gruppe speichern'
    },
    'message_preview': {
        ar: 'معاينة الرسالة',
        en: 'Message Preview',
        de: 'Nachrichtenvorschau'
    },
    'restore_original_text': {
        ar: 'استعادة النص الأصلي',
        en: 'Restore original text',
        de: 'Ursprünglichen Text wiederherstellen'
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

let reminderModal = fs.readFileSync('src/components/LessonReminderModal.tsx', 'utf8');
reminderModal = reminderModal.replace(/<span className="text-emerald-600">تم الحفظ<\/span>/g, '<span className="text-emerald-600">{t(\'zoom_saved\')}</span>');
reminderModal = reminderModal.replace(/<span>حفظ للجروب<\/span>/g, '<span>{t(\'zoom_save_group\')}</span>');
reminderModal = reminderModal.replace(/<span>معاينة الرسالة \(Message Preview\):<\/span>/g, '<span>{t(\'message_preview\')}:</span>');
reminderModal = reminderModal.replace(/استعادة النص الأصلي/g, "{t('restore_original_text')}");
fs.writeFileSync('src/components/LessonReminderModal.tsx', reminderModal);

console.log('Fixed UI arabic texts');
