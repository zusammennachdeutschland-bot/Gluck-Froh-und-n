const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(srcDir);
const translationUpdates = [];
const newTranslations = {};
let nextId = 1;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Match _t('ar', 'en', 'de')
    const regex = /_t\(\s*(['"`])(.*?)\1\s*,\s*(['"`])(.*?)\3\s*(?:,\s*(['"`])(.*?)\5\s*)?\)/g;
    
    content = content.replace(regex, (match, q1, ar, q3, en, q5, de) => {
        let key = 'auto_' + en.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 30);
        key = key.replace(/_+/g, '_').replace(/_$/, '');
        if (!key || key === 'auto_') key = 'auto_key_' + nextId++;
        
        // Ensure uniqueness
        while(newTranslations[key] && newTranslations[key].en !== en) {
            key = key + '_' + nextId++;
        }

        newTranslations[key] = {
            ar,
            en,
            de: de || en
        };
        changed = true;
        return `t('${key}')`;
    });

    // Remove const _t = ... definitions
    const helperRegex1 = /const\s+_t\s*=\s*\([^)]*\)\s*(?::\s*string\s*)?=>\s*\{[^}]+\};\n?/g;
    const helperRegex2 = /const\s+_t\s*=\s*\([^)]*\)\s*(?::\s*string\s*)?=>\s*[^;]+;\n?/g;
    
    if (helperRegex1.test(content) || helperRegex2.test(content)) {
        content = content.replace(helperRegex1, '');
        content = content.replace(helperRegex2, '');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content);
        console.log('Updated', file);
    }
});

fs.writeFileSync('new_translations.json', JSON.stringify(newTranslations, null, 2));
console.log('Saved new_translations.json');
