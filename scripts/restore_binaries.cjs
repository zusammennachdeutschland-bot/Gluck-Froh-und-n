const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function restore() {
  console.log("Restoring binary assets from SVG sources...");
  
  if (!fs.existsSync('assets')) fs.mkdirSync('assets');
  if (!fs.existsSync('public/icons')) fs.mkdirSync('public/icons', { recursive: true });

  const iconSvg = fs.readFileSync('icon.svg');
  const fgSvg = fs.readFileSync('icon_foreground.svg');
  const monoSvg = fs.readFileSync('icon_monochrome.svg');
  
  // 1. Restore Capacitor assets/ directory
  await sharp(iconSvg).resize(1024, 1024).png().toFile('assets/icon.png');
  await sharp(fgSvg).resize(1024, 1024).png().toFile('assets/icon-foreground.png');
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  }).png().toFile('assets/icon-background.png');
  await sharp(iconSvg).resize(2732, 2732, { fit: 'contain', background: '#ffffff' }).png().toFile('assets/splash.png');
  await sharp(iconSvg).resize(2732, 2732, { fit: 'contain', background: '#ffffff' }).png().toFile('assets/splash-dark.png');
  await sharp(monoSvg).resize(1024, 1024).png().toFile('assets/icon-monochrome.png');

  // Generate mipmap monochromes manually since @capacitor/assets ignores them
  const mipmapSizes = {
    'ldpi': 36,
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192
  };
  for (const [dpi, size] of Object.entries(mipmapSizes)) {
    const p = `android/app/src/main/res/mipmap-${dpi}/ic_launcher_monochrome.png`;
    if (fs.existsSync(p)) {
      await sharp(monoSvg).resize(size, size).png().toFile(p);
    }
  }

  // Delete stale capacitor public assets to avoid check_binaries finding corrupted cache
  const capPublicDir = 'android/app/src/main/assets/public';
  if (fs.existsSync(capPublicDir)) {
    fs.rmSync(capPublicDir, { recursive: true, force: true });
  }

  // 2. Restore public/ directory PWA icons and background assets
  if (fs.existsSync('resources/bg.svg')) await sharp('resources/bg.svg').png().toFile('public/bg.png');
  if (fs.existsSync('resources/fg.svg')) await sharp('resources/fg.svg').png().toFile('public/fg.png');
  
  const logo = 'public/logo.svg';
  if (fs.existsSync(logo)) {
    await sharp(logo).resize(512, 512).png().toFile('public/logo.png');
    await sharp(logo).resize(512, 512).png().toFile('public/icon.png');
    await sharp(logo).resize(192, 192).png().toFile('public/apple-touch-icon.png');
    await sharp(logo).resize(32, 32).png().toFile('public/favicon.png');
    
    const sizes = [48, 72, 96, 128, 192, 256, 512];
    for (const size of sizes) {
      await sharp(logo).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
      await sharp(logo).resize(size, size).webp().toFile(`public/icons/icon-${size}.webp`);
    }
  }

  // 3. Trigger Capacitor asset generation to cascade changes into android/app/src/main/res
  console.log("Triggering Capacitor asset generation...");
  try {
    execSync('npx @capacitor/assets generate --android', { stdio: 'inherit' });
  } catch(e) {
    console.error("Capacitor asset generation failed.", e.message);
  }

  console.log("All corrupted binaries have been restored successfully!");
}

restore().catch(console.error);
