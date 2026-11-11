const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const stat = fs.statSync(dirPath);
    if (stat.isDirectory()) {
      walkDir(dirPath, callback);
    } else if (stat.isFile() && (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx'))) {
      callback(dirPath);
    }
  });
}

walkDir(path.join(__dirname, '../src'), (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = content;

  // Remove import statements for canvas-confetti
  updated = updated.replace(/import\s+confetti\s+from\s+['"]canvas-confetti['"];?\r?\n?/g, '');

  // Remove confetti(...) function calls (handling multiline if any or simple single-line calls)
  // confetti({ ... }) or confetti(...)
  updated = updated.replace(/confetti\s*\([^)]*\);?/g, '');

  if (content !== updated) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`Cleaned confetti from: ${filePath}`);
  }
});
console.log('Confetti cleanup complete.');
