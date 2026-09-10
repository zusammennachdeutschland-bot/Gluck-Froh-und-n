const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Master Icon SVG (Square / Squircle with gradient background)
const masterIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064E3B" />
      <stop offset="30%" stop-color="#047857" />
      <stop offset="70%" stop-color="#0D9488" />
      <stop offset="100%" stop-color="#0369A1" />
    </linearGradient>

    <linearGradient id="goldRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>

    <linearGradient id="cyanLeaf" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284C7" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>

    <linearGradient id="greenLeaf" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#34D399" />
    </linearGradient>

    <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#022C22" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- App Container Background (iOS/Android Squircle feel) -->
  <rect width="512" height="512" rx="120" fill="url(#bgGrad)" />
  <rect width="504" height="504" x="4" y="4" rx="116" stroke="rgba(255,255,255,0.2)" stroke-width="4" fill="none" />

  <!-- Corner dynamic ribbons -->
  <path d="M 0 320 C 100 360, 200 440, 240 512 L 0 512 Z" fill="url(#goldRibbon)" opacity="0.8" />
  <path d="M 512 180 C 420 140, 360 60, 340 0 L 512 0 Z" fill="url(#cyanLeaf)" opacity="0.6" />

  <!-- Lucky Clover Symbol inside App Icon -->
  <g filter="url(#iconShadow)" transform="translate(256, 256)">
    <!-- Top Petal -->
    <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="url(#cyanLeaf)" />
    <!-- Right Petal -->
    <g transform="rotate(90)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="url(#goldRibbon)" />
    </g>
    <!-- Bottom Petal -->
    <g transform="rotate(180)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="#0D9488" />
    </g>
    <!-- Left Petal -->
    <g transform="rotate(270)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="url(#greenLeaf)" />
    </g>

    <!-- Center White Sparkle Star -->
    <circle cx="0" cy="0" r="28" fill="#FFFFFF" />
    <text x="0" y="10" 
          text-anchor="middle" 
          font-family="'Montserrat', 'Poppins', sans-serif" 
          font-size="28px" 
          font-weight="900" 
          fill="#065F46">G</text>

    <!-- Joy Smile Arc below clover -->
    <path d="M -100 60 C -50 120, 50 120, 100 60 C 108 50, 120 58, 112 70 C 60 140, -60 140, -112 70 C -120 58, -108 50, -100 60 Z" fill="url(#goldRibbon)" />
  </g>
</svg>
`;

// 2. Round Master Icon SVG
const roundIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGradRound" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064E3B" />
      <stop offset="30%" stop-color="#047857" />
      <stop offset="70%" stop-color="#0D9488" />
      <stop offset="100%" stop-color="#0369A1" />
    </linearGradient>

    <linearGradient id="goldRibbonRound" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>

    <linearGradient id="cyanLeafRound" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284C7" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>

    <linearGradient id="greenLeafRound" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#34D399" />
    </linearGradient>

    <filter id="iconShadowRound" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#022C22" flood-opacity="0.4" />
    </filter>
  </defs>

  <circle cx="256" cy="256" r="256" fill="url(#bgGradRound)" />
  <circle cx="256" cy="256" r="252" stroke="rgba(255,255,255,0.2)" stroke-width="4" fill="none" />

  <!-- Corner dynamic ribbons -->
  <path d="M 0 320 C 100 360, 200 440, 240 512 L 0 512 Z" fill="url(#goldRibbonRound)" opacity="0.8" />
  <path d="M 512 180 C 420 140, 360 60, 340 0 L 512 0 Z" fill="url(#cyanLeafRound)" opacity="0.6" />

  <!-- Lucky Clover Symbol inside App Icon -->
  <g filter="url(#iconShadowRound)" transform="translate(256, 256)">
    <!-- Top Petal -->
    <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="url(#cyanLeafRound)" />
    <!-- Right Petal -->
    <g transform="rotate(90)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="url(#goldRibbonRound)" />
    </g>
    <!-- Bottom Petal -->
    <g transform="rotate(180)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="#0D9488" />
    </g>
    <!-- Left Petal -->
    <g transform="rotate(270)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="url(#greenLeafRound)" />
    </g>

    <!-- Center White Sparkle Star -->
    <circle cx="0" cy="0" r="28" fill="#FFFFFF" />
    <text x="0" y="10" 
          text-anchor="middle" 
          font-family="'Montserrat', 'Poppins', sans-serif" 
          font-size="28px" 
          font-weight="900" 
          fill="#065F46">G</text>

    <!-- Joy Smile Arc below clover -->
    <path d="M -100 60 C -50 120, 50 120, 100 60 C 108 50, 120 58, 112 70 C 60 140, -60 140, -112 70 C -120 58, -108 50, -100 60 Z" fill="url(#goldRibbonRound)" />
  </g>
</svg>
`;

// 3. Foreground Icon SVG (for Android Adaptive Icons)
const fgIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="fgGoldRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>

    <linearGradient id="fgCyanLeaf" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284C7" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>

    <linearGradient id="fgGreenLeaf" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#34D399" />
    </linearGradient>

    <filter id="fgShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.3" />
    </filter>
  </defs>

  <!-- Lucky Clover Symbol centered for Android Adaptive Safe Zone (scale ~ 0.72) -->
  <g filter="url(#fgShadow)" transform="translate(256, 256) scale(0.72)">
    <!-- Top Petal -->
    <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="url(#fgCyanLeaf)" />
    <!-- Right Petal -->
    <g transform="rotate(90)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="url(#fgGoldRibbon)" />
    </g>
    <!-- Bottom Petal -->
    <g transform="rotate(180)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="#0D9488" />
    </g>
    <!-- Left Petal -->
    <g transform="rotate(270)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="url(#fgGreenLeaf)" />
    </g>

    <!-- Center White Sparkle Star -->
    <circle cx="0" cy="0" r="28" fill="#FFFFFF" />
    <text x="0" y="10" 
          text-anchor="middle" 
          font-family="'Montserrat', 'Poppins', sans-serif" 
          font-size="28px" 
          font-weight="900" 
          fill="#065F46">G</text>

    <!-- Joy Smile Arc below clover -->
    <path d="M -100 60 C -50 120, 50 120, 100 60 C 108 50, 120 58, 112 70 C 60 140, -60 140, -112 70 C -120 58, -108 50, -100 60 Z" fill="url(#fgGoldRibbon)" />
  </g>
</svg>
`;

// 4. Background SVG (for Android Adaptive Icons)
const bgIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="adaptiveBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064E3B" />
      <stop offset="30%" stop-color="#047857" />
      <stop offset="70%" stop-color="#0D9488" />
      <stop offset="100%" stop-color="#0369A1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#adaptiveBgGrad)" />
</svg>
`;

// 5. Monochrome Icon SVG (for Android 13+ themed icons)
const monoIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g transform="translate(256, 256) scale(0.72)">
    <!-- Top Petal -->
    <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="#000000" />
    <!-- Right Petal -->
    <g transform="rotate(90)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="#000000" />
    </g>
    <!-- Bottom Petal -->
    <g transform="rotate(180)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="#000000" />
    </g>
    <!-- Left Petal -->
    <g transform="rotate(270)">
      <path d="M 0 0 C -45 -25, -70 -75, -40 -105 C -10 -135, 0 -115, 0 -80 C 0 -115, 10 -135, 40 -105 C 70 -75, 45 -25, 0 0 Z" fill="#000000" />
    </g>

    <!-- Center Star cutout -->
    <circle cx="0" cy="0" r="28" fill="#FFFFFF" />
    <text x="0" y="10" 
          text-anchor="middle" 
          font-family="'Montserrat', 'Poppins', sans-serif" 
          font-size="28px" 
          font-weight="900" 
          fill="#000000">G</text>

    <!-- Joy Smile Arc -->
    <path d="M -100 60 C -50 120, 50 120, 100 60 C 108 50, 120 58, 112 70 C 60 140, -60 140, -112 70 C -120 58, -108 50, -100 60 Z" fill="#000000" />
  </g>
</svg>
`;

async function main() {
  console.log('🚀 Starting Full Brand & Android Asset Generation...');

  const masterLogoSvgPath = path.join(__dirname, '../public/logo.svg');
  const masterLogoSvg = fs.readFileSync(masterLogoSvgPath, 'utf8');

  // 1. Write updated SVGs to all root & resource locations
  fs.writeFileSync(path.join(__dirname, '../icon.svg'), masterIconSvg, 'utf8');
  fs.writeFileSync(path.join(__dirname, '../icon_foreground.svg'), fgIconSvg, 'utf8');
  fs.writeFileSync(path.join(__dirname, '../icon_monochrome.svg'), monoIconSvg, 'utf8');
  fs.writeFileSync(path.join(__dirname, '../logo.svg'), masterLogoSvg, 'utf8');

  if (fs.existsSync(path.join(__dirname, '../assets'))) {
    fs.writeFileSync(path.join(__dirname, '../assets/logo.svg'), masterLogoSvg, 'utf8');
  }
  if (fs.existsSync(path.join(__dirname, '../resources'))) {
    fs.writeFileSync(path.join(__dirname, '../resources/icon.svg'), masterIconSvg, 'utf8');
    fs.writeFileSync(path.join(__dirname, '../resources/fg.svg'), fgIconSvg, 'utf8');
    fs.writeFileSync(path.join(__dirname, '../resources/bg.svg'), bgIconSvg, 'utf8');
  }

  // 2. Prepare Buffers
  const masterIconBuf = Buffer.from(masterIconSvg);
  const roundIconBuf = Buffer.from(roundIconSvg);
  const fgIconBuf = Buffer.from(fgIconSvg);
  const bgIconBuf = Buffer.from(bgIconSvg);
  const monoIconBuf = Buffer.from(monoIconSvg);
  const logoBuf = Buffer.from(masterLogoSvg);

  // 3. Web & PWA assets (in public/)
  const publicDir = path.join(__dirname, '../public');
  await sharp(logoBuf).resize(1024, 1024).png().toFile(path.join(publicDir, 'logo.png'));
  await sharp(masterIconBuf).resize(512, 512).png().toFile(path.join(publicDir, 'icon.png'));
  await sharp(masterIconBuf).resize(192, 192).png().toFile(path.join(publicDir, 'favicon.png'));
  await sharp(masterIconBuf).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(fgIconBuf).resize(512, 512).png().toFile(path.join(publicDir, 'fg.png'));
  await sharp(bgIconBuf).resize(512, 512).png().toFile(path.join(publicDir, 'bg.png'));

  const iconSizes = [48, 72, 96, 128, 192, 256, 512];
  const pwaIconsDir = path.join(publicDir, 'icons');
  if (!fs.existsSync(pwaIconsDir)) fs.mkdirSync(pwaIconsDir, { recursive: true });
  for (const size of iconSizes) {
    await sharp(masterIconBuf).resize(size, size).png().toFile(path.join(pwaIconsDir, `icon-${size}.png`));
    await sharp(masterIconBuf).resize(size, size).webp().toFile(path.join(pwaIconsDir, `icon-${size}.webp`));
  }
  console.log('✅ Web / PWA icons updated.');

  // 4. Capacitor assets/ folder
  const assetsDir = path.join(__dirname, '../assets');
  if (fs.existsSync(assetsDir)) {
    await sharp(masterIconBuf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon.png'));
    await sharp(fgIconBuf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon-foreground.png'));
    await sharp(bgIconBuf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon-background.png'));
    await sharp(monoIconBuf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon-monochrome.png'));
    await sharp(logoBuf).resize(2732, 2732, { fit: 'contain', background: '#ffffff' }).png().toFile(path.join(assetsDir, 'splash.png'));
    await sharp(logoBuf).resize(2732, 2732, { fit: 'contain', background: '#0f172a' }).png().toFile(path.join(assetsDir, 'splash-dark.png'));
  }

  // 5. Android Mipmap Folders
  const mipmaps = {
    'ldpi': { launcher: 36, adaptive: 108 },
    'mdpi': { launcher: 48, adaptive: 108 },
    'hdpi': { launcher: 72, adaptive: 162 },
    'xhdpi': { launcher: 96, adaptive: 216 },
    'xxhdpi': { launcher: 144, adaptive: 324 },
    'xxxhdpi': { launcher: 192, adaptive: 432 }
  };

  const resDir = path.join(__dirname, '../android/app/src/main/res');
  if (fs.existsSync(resDir)) {
    for (const [dpi, dimensions] of Object.entries(mipmaps)) {
      const mipmapFolder = path.join(resDir, `mipmap-${dpi}`);
      if (!fs.existsSync(mipmapFolder)) fs.mkdirSync(mipmapFolder, { recursive: true });

      // Standard launcher icon
      await sharp(masterIconBuf).resize(dimensions.launcher, dimensions.launcher).png().toFile(path.join(mipmapFolder, 'ic_launcher.png'));
      // Round launcher icon
      await sharp(roundIconBuf).resize(dimensions.launcher, dimensions.launcher).png().toFile(path.join(mipmapFolder, 'ic_launcher_round.png'));
      // Adaptive foreground
      await sharp(fgIconBuf).resize(dimensions.adaptive, dimensions.adaptive).png().toFile(path.join(mipmapFolder, 'ic_launcher_foreground.png'));
      // Adaptive background
      await sharp(bgIconBuf).resize(dimensions.adaptive, dimensions.adaptive).png().toFile(path.join(mipmapFolder, 'ic_launcher_background.png'));
      // Monochrome icon
      await sharp(monoIconBuf).resize(dimensions.launcher, dimensions.launcher).png().toFile(path.join(mipmapFolder, 'ic_launcher_monochrome.png'));
    }
    console.log('✅ Android Mipmap launcher icons updated.');

    // 6. Android Splash Screens in drawables
    const splashConfigs = [
      { folder: 'drawable', w: 480, h: 800, dark: false },
      { folder: 'drawable-night', w: 480, h: 800, dark: true },
      { folder: 'drawable-port-ldpi', w: 240, h: 320, dark: false },
      { folder: 'drawable-port-mdpi', w: 320, h: 480, dark: false },
      { folder: 'drawable-port-hdpi', w: 480, h: 800, dark: false },
      { folder: 'drawable-port-xhdpi', w: 720, h: 1280, dark: false },
      { folder: 'drawable-port-xxhdpi', w: 960, h: 1600, dark: false },
      { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920, dark: false },
      { folder: 'drawable-port-night-ldpi', w: 240, h: 320, dark: true },
      { folder: 'drawable-port-night-mdpi', w: 320, h: 480, dark: true },
      { folder: 'drawable-port-night-hdpi', w: 480, h: 800, dark: true },
      { folder: 'drawable-port-night-xhdpi', w: 720, h: 1280, dark: true },
      { folder: 'drawable-port-night-xxhdpi', w: 960, h: 1600, dark: true },
      { folder: 'drawable-port-night-xxxhdpi', w: 1280, h: 1920, dark: true },
      { folder: 'drawable-land-ldpi', w: 320, h: 240, dark: false },
      { folder: 'drawable-land-mdpi', w: 480, h: 320, dark: false },
      { folder: 'drawable-land-hdpi', w: 800, h: 480, dark: false },
      { folder: 'drawable-land-xhdpi', w: 1280, h: 720, dark: false },
      { folder: 'drawable-land-xxhdpi', w: 1600, h: 960, dark: false },
      { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280, dark: false },
      { folder: 'drawable-land-night-ldpi', w: 320, h: 240, dark: true },
      { folder: 'drawable-land-night-mdpi', w: 480, h: 320, dark: true },
      { folder: 'drawable-land-night-hdpi', w: 800, h: 480, dark: true },
      { folder: 'drawable-land-night-xhdpi', w: 1280, h: 720, dark: true },
      { folder: 'drawable-land-night-xxhdpi', w: 1600, h: 960, dark: true },
      { folder: 'drawable-land-night-xxxhdpi', w: 1920, h: 1280, dark: true },
    ];

    for (const sc of splashConfigs) {
      const dFolder = path.join(resDir, sc.folder);
      if (fs.existsSync(dFolder)) {
        const bg = sc.dark ? '#0f172a' : '#ffffff';
        // Render logo centered with padding
        const logoSize = Math.min(sc.w, sc.h) * 0.45;
        const logoRendered = await sharp(logoBuf)
          .resize(Math.round(logoSize), Math.round(logoSize), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer();

        await sharp({
          create: {
            width: sc.w,
            height: sc.h,
            channels: 4,
            background: bg
          }
        })
        .composite([{ input: logoRendered, gravity: 'center' }])
        .png()
        .toFile(path.join(dFolder, 'splash.png'));
      }
    }
    console.log('✅ Android Splash screens updated.');
  }

  // 7. Synchronize android/app/src/main/assets/public/
  const androidPublicAssets = path.join(__dirname, '../android/app/src/main/assets/public');
  if (fs.existsSync(androidPublicAssets)) {
    fs.copyFileSync(masterLogoSvgPath, path.join(androidPublicAssets, 'logo.svg'));
    fs.copyFileSync(path.join(publicDir, 'logo.png'), path.join(androidPublicAssets, 'logo.png'));
    fs.copyFileSync(path.join(publicDir, 'icon.png'), path.join(androidPublicAssets, 'icon.png'));
    fs.copyFileSync(path.join(publicDir, 'favicon.png'), path.join(androidPublicAssets, 'favicon.png'));
    fs.copyFileSync(path.join(publicDir, 'apple-touch-icon.png'), path.join(androidPublicAssets, 'apple-touch-icon.png'));
    
    const androidIconsDir = path.join(androidPublicAssets, 'icons');
    if (!fs.existsSync(androidIconsDir)) fs.mkdirSync(androidIconsDir, { recursive: true });
    for (const size of iconSizes) {
      fs.copyFileSync(path.join(pwaIconsDir, `icon-${size}.png`), path.join(androidIconsDir, `icon-${size}.png`));
      fs.copyFileSync(path.join(pwaIconsDir, `icon-${size}.webp`), path.join(androidIconsDir, `icon-${size}.webp`));
    }
    console.log('✅ Android assets/public synchronized.');
  }

  console.log('🎉 All assets, Android APK icons, and splash screens successfully generated and updated!');
}

main().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
