const fs = require('fs');
const path = require('path');

const tsFilePath = path.join(__dirname, 'src', 'i18n', 'translations.ts');
let tsFile = fs.readFileSync(tsFilePath, 'utf8');

const newKeys = {
    'alert_add_zoom_link': {
        ar: 'برجاء إضافة رابط الزووم للجروب أولاً قبل إرسال التذكير.',
        en: 'Please add the Zoom link for the group before sending the reminder.',
        de: 'Bitte fügen Sie den Zoom-Link für die Gruppe hinzu, bevor Sie die Erinnerung senden.'
    },
    'alert_no_parent_phone': {
        ar: 'لا يوجد رقم هاتف مسجل لولي الأمر. يرجى إضافة الرقم في بيانات الطالب.',
        en: 'No parent phone number registered. Please add the number in the student data.',
        de: 'Keine Telefonnummer der Eltern registriert. Bitte fügen Sie die Nummer in den Schülerdaten hinzu.'
    },
    'alert_finish_lesson_first': {
        ar: 'يرجى إنهاء الحصة أولاً بالضغط على زر "إنهاء الحصة وحفظ التقرير" لتتمكن من فتح تقرير ولي الأمر.',
        en: 'Please end the lesson first by clicking "End Lesson and Save Report" to open the parent report.',
        de: 'Bitte beenden Sie den Unterricht zuerst, indem Sie auf "Unterricht beenden und Bericht speichern" klicken, um den Elternbericht zu öffnen.'
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
console.log('Updated translations.ts with UI alerts');
