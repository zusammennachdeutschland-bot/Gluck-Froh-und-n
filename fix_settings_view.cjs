const fs = require('fs');
const path = require('path');

const tsFilePath = path.join(__dirname, 'src', 'i18n', 'translations.ts');
let tsFile = fs.readFileSync(tsFilePath, 'utf8');

const newKeys = {
    'settings_live_preview': { ar: 'معاينة مباشرة', en: 'Live Preview', de: 'Live-Vorschau' },
    'settings_primary_button': { ar: 'زر أساسي', en: 'Primary Button', de: 'Primärer Button' },
    'settings_secondary_button': { ar: 'ثانوي', en: 'Secondary', de: 'Sekundär' },
    'settings_premium_widget': { ar: 'ودجيت مميز', en: 'Premium Widget', de: 'Premium-Widget' },
    'settings_adapts_accent': { ar: 'يتكيف مع لون التمييز', en: 'Adapts to your accent color', de: 'Passt sich Ihrer Akzentfarbe an' }
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

let fileContent = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');
fileContent = fileContent.replace(/>Live Preview</g, '>{t(\'settings_live_preview\')}<');
fileContent = fileContent.replace(/>\s*Primary Button\s*</g, '>\n                  {t(\'settings_primary_button\')}\n                <');
fileContent = fileContent.replace(/>\s*Secondary\s*</g, '>\n                  {t(\'settings_secondary_button\')}\n                <');
fileContent = fileContent.replace(/>Premium Widget</g, '>{t(\'settings_premium_widget\')}<');
fileContent = fileContent.replace(/>Adapts to your accent color</g, '>{t(\'settings_adapts_accent\')}<');
fs.writeFileSync('src/components/SettingsView.tsx', fileContent);

console.log('Fixed SettingsView.tsx');
