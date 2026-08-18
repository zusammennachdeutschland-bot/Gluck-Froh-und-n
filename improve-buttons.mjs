import fs from 'fs';
import path from 'path';

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    filelist = fs.statSync(path.join(dir, file)).isDirectory()
      ? walkSync(path.join(dir, file), filelist)
      : filelist.concat(path.join(dir, file));
  });
  return filelist;
};

const files = walkSync('./src').filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Make primary buttons premium
  // We look for button classes or div buttons that use bg-primary text-white
  // Add: active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-primary/50 hover:shadow-lg
  content = content.replace(/className="(.*?\bbg-primary\b.*?\btext-white\b.*?)"/g, (match, classes) => {
      let newClasses = classes;
      if (!newClasses.includes('active:scale-95') && !newClasses.includes('pointer-events-none')) {
          newClasses += ' active:scale-95';
      }
      if (!newClasses.includes('hover:shadow-lg')) {
          newClasses += ' hover:shadow-lg hover:shadow-primary/30';
      }
      if (!newClasses.includes('transition-all')) {
          newClasses += ' transition-all';
      }
      // Ensure hover state exists
      if (!newClasses.includes('hover:bg-primary-hover') && !newClasses.includes('hover:bg-')) {
          newClasses += ' hover:bg-primary-hover';
      }
      return `className="${newClasses.replace(/\s+/g, ' ')}"`;
  });

  // Also do for secondary buttons (bg-primary-soft)
  content = content.replace(/className="(.*?\bbg-primary-soft\b.*?\btext-primary\b.*?)"/g, (match, classes) => {
      let newClasses = classes;
      if (!newClasses.includes('active:scale-95') && !newClasses.includes('pointer-events-none')) {
          newClasses += ' active:scale-95';
      }
      if (!newClasses.includes('transition-all')) {
          newClasses += ' transition-all';
      }
      if (!newClasses.includes('hover:bg-primary/20') && !newClasses.includes('hover:bg-')) {
          newClasses += ' hover:bg-primary/20';
      }
      return `className="${newClasses.replace(/\s+/g, ' ')}"`;
  });

  fs.writeFileSync(file, content);
});
console.log('Improved buttons');
