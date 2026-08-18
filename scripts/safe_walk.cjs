const fs = require('fs');
const path = require('path');

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', 
  '.svg', '.apk', '.zip', '.ttf', '.otf', '.woff', 
  '.woff2', '.mp3', '.mp4', '.wav', '.pdf', '.eot'
]);

function walkSafeSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'android' || file === 'ios') continue;
    
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkSafeSync(fullPath, filelist);
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      if (!BINARY_EXTS.has(ext)) {
        filelist.push(fullPath);
      }
    }
  }
  return filelist;
}

module.exports = { walkSafeSync };
