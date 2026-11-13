const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_LOGO_PATH = path.join(
  __dirname,
  '../public/assets/aistudio/logo-removebg-preview__1__1a8a6028.png'
);

// Notification small icon / Web notification monochrome white silhouette (24x24 viewport)
const notificationBadgeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">
  <path fill="none" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round"
    d="M 10.8,2.6 A 9.4,9.4 0 1,0 19.8,7.1" />
  <path fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"
    d="M 14.5,2.9 A 9.4,9.4 0 0,1 21.1,10.2" />
  <path fill="#FFFFFF" d="M 15.2,5.3 L 20.4,7.3 L 15.2,9.3 L 10.0,7.3 Z" />
  <path fill="#FFFFFF" d="M 12.0,8.7 L 15.2,9.9 L 18.4,8.7 L 18.4,10.4 C 18.4,10.9 16.9,11.6 15.2,11.6 C 13.5,11.6 12.0,10.9 12.0,10.4 Z" />
  <path fill="none" stroke="#FFFFFF" stroke-width="1.1" stroke-linecap="round" d="M 19.6,7.6 L 19.6,10.9" />
  <path fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"
    d="M 6.4,8.6 L 6.4,16.8 M 11.4,8.6 L 11.4,16.8 M 6.4,12.7 L 11.4,12.7" />
  <path fill="none" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round"
    d="M 8.2,18.2 Q 13.0,16.4 18.0,17.8" />
</svg>
`;

// Dark obsidian-slate backdrop templates
const squircleBackdropSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="obsidianSquircle" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#2a3952" />
      <stop offset="66%" stop-color="#151e2e" />
      <stop offset="100%" stop-color="#0c111c" />
    </radialGradient>
  </defs>
  <rect x="4" y="4" width="504" height="504" rx="116" fill="url(#obsidianSquircle)" />
  <rect x="6" y="6" width="500" height="500" rx="114" fill="none" stroke="rgba(212,175,55,0.48)" stroke-width="4" />
  <rect x="14" y="14" width="484" height="484" rx="106" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="2" />
</svg>
`;

const roundBackdropSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="obsidianRound" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#2a3952" />
      <stop offset="66%" stop-color="#151e2e" />
      <stop offset="100%" stop-color="#0c111c" />
    </radialGradient>
  </defs>
  <circle cx="256" cy="256" r="248" fill="url(#obsidianRound)" />
  <circle cx="256" cy="256" r="245" fill="none" stroke="rgba(212,175,55,0.58)" stroke-width="6" />
  <circle cx="256" cy="256" r="236" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
</svg>
`;

const fullBleedBackdropSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="obsidianFull" cx="50%" cy="42%" r="68%">
      <stop offset="0%" stop-color="#2a3952" />
      <stop offset="66%" stop-color="#151e2e" />
      <stop offset="100%" stop-color="#0c111c" />
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#obsidianFull)" />
  <circle cx="256" cy="256" r="204" fill="none" stroke="rgba(212,175,55,0.32)" stroke-width="3" />
</svg>
`;

const adaptiveBgSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="adaptiveBg" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#2a3952" />
      <stop offset="65%" stop-color="#151e2e" />
      <stop offset="100%" stop-color="#0c111c" />
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#adaptiveBg)" />
</svg>
`;

/**
 * Builds a valid multi-size ICO binary wrapping PNG images (Windows/Electron).
 */
function buildIcoFromPngBuffers(entries) {
  const count = entries.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Icon type
  header.writeUInt16LE(count, 4);

  const dirBuffers = [];
  const dataBuffers = [];

  for (const { size, buf } of entries) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buf.length;
    dirBuffers.push(entry);
    dataBuffers.push(buf);
  }

  return Buffer.concat([header, ...dirBuffers, ...dataBuffers]);
}

/**
 * Builds a clean white-on-transparent monochrome silhouette directly from the
 * uploaded crest PNG, suppressing soft drop-shadow pixels so letters remain crisp.
 */
async function buildMonochromeFromSource(sourceBuffer, targetSize, innerScale = 0.72) {
  const innerPx = Math.round(targetSize * innerScale);
  const { data, info } = await sharp(sourceBuffer)
    .resize(innerPx, innerPx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    // Keep foreground white/colored ink and solid dark brush strokes; skip soft drop shadows
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const isInk = a >= 185 || (a >= 110 && lum > 150);
    if (isInk) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = a >= 200 ? 255 : Math.min(255, Math.round(a * 1.15));
    } else {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    }
  }

  const fgMono = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: fgMono, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE_LOGO_PATH)) {
    throw new Error(`Missing source logo PNG at ${SOURCE_LOGO_PATH}`);
  }

  console.log('🚀 Generating Herr Abdul-rahman brand assets across Web, PWA, Electron, and Android...');

  const sourceBuf = fs.readFileSync(SOURCE_LOGO_PATH);
  const sourceBase64 = sourceBuf.toString('base64');

  // Create a crisp standalone SVG wrapper embedding the raster crest in a dark obsidian medallion
  const masterBrandSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="crestBg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#2a3952" />
      <stop offset="66%" stop-color="#151e2e" />
      <stop offset="100%" stop-color="#0c111c" />
    </radialGradient>
  </defs>
  <circle cx="256" cy="256" r="248" fill="url(#crestBg)" />
  <circle cx="256" cy="256" r="245" fill="none" stroke="#D4AF37" stroke-opacity="0.58" stroke-width="6" />
  <circle cx="256" cy="256" r="236" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2" />
  <image x="44" y="44" width="424" height="424" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${sourceBase64}" />
</svg>
`;

  // Master composite buffers (512x512)
  const logo424 = await sharp(sourceBuf)
    .resize(424, 424, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 12-14% safe zone for maskable & iOS icons (380 / 512 = 74.2% -> 12.9% margin on every side)
  const logo380 = await sharp(sourceBuf)
    .resize(380, 380, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Adaptive foreground safe-zone logo (336 / 512 = 65.6%)
  const logo336 = await sharp(sourceBuf)
    .resize(336, 336, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const squircleMasterBuf = await sharp(Buffer.from(squircleBackdropSvg))
    .composite([{ input: logo424, gravity: 'center' }])
    .png()
    .toBuffer();

  const roundMasterBuf = await sharp(Buffer.from(roundBackdropSvg))
    .composite([{ input: logo424, gravity: 'center' }])
    .png()
    .toBuffer();

  const maskableMasterBuf = await sharp(Buffer.from(fullBleedBackdropSvg))
    .composite([{ input: logo380, gravity: 'center' }])
    .png()
    .toBuffer();

  const fgMasterBuf = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: logo336, gravity: 'center' }])
    .png()
    .toBuffer();

  const bgMasterBuf = await sharp(Buffer.from(adaptiveBgSvg)).png().toBuffer();
  const monoMasterBuf = await buildMonochromeFromSource(sourceBuf, 512, 0.72);
  const badgeMasterBuf = await sharp(Buffer.from(notificationBadgeSvg)).resize(96, 96).png().toBuffer();

  // 1. Write root & public SVG files (keep public/alsunLogo.svg untouched for school printouts)
  const publicDir = path.join(__dirname, '../public');
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), masterBrandSvg, 'utf8');
  fs.writeFileSync(path.join(__dirname, '../logo.svg'), masterBrandSvg, 'utf8');
  fs.writeFileSync(path.join(__dirname, '../icon.svg'), masterBrandSvg, 'utf8');
  fs.writeFileSync(path.join(__dirname, '../icon_monochrome.svg'), notificationBadgeSvg.trim() + '\n', 'utf8');

  if (fs.existsSync(path.join(__dirname, '../assets'))) {
    fs.writeFileSync(path.join(__dirname, '../assets/logo.svg'), masterBrandSvg, 'utf8');
  }
  if (fs.existsSync(path.join(__dirname, '../resources'))) {
    fs.writeFileSync(path.join(__dirname, '../resources/icon.svg'), masterBrandSvg, 'utf8');
    fs.writeFileSync(path.join(__dirname, '../resources/bg.svg'), adaptiveBgSvg.trim() + '\n', 'utf8');
  }

  // 2. Web & PWA assets in public/
  await sharp(roundMasterBuf).resize(512, 512).png().toFile(path.join(publicDir, 'logo.png'));
  await sharp(squircleMasterBuf).resize(512, 512).png().toFile(path.join(publicDir, 'icon.png'));
  await sharp(squircleMasterBuf).resize(64, 64).png().toFile(path.join(publicDir, 'favicon.png'));
  await sharp(maskableMasterBuf).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(squircleMasterBuf).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  await sharp(squircleMasterBuf).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  await sharp(maskableMasterBuf).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  await sharp(badgeMasterBuf).resize(96, 96).png().toFile(path.join(publicDir, 'notification-badge.png'));
  await sharp(fgMasterBuf).resize(512, 512).png().toFile(path.join(publicDir, 'fg.png'));
  await sharp(bgMasterBuf).resize(512, 512).png().toFile(path.join(publicDir, 'bg.png'));

  // Multi-size Windows/Browser .ico
  const icoEntries = [];
  for (const s of [32, 48, 64, 256]) {
    const b = await sharp(squircleMasterBuf).resize(s, s).png().toBuffer();
    icoEntries.push({ size: s, buf: b });
  }
  fs.writeFileSync(path.join(publicDir, 'icon.ico'), buildIcoFromPngBuffers(icoEntries));

  const iconSizes = [48, 72, 96, 128, 192, 256, 512];
  const pwaIconsDir = path.join(publicDir, 'icons');
  if (!fs.existsSync(pwaIconsDir)) fs.mkdirSync(pwaIconsDir, { recursive: true });
  for (const size of iconSizes) {
    await sharp(squircleMasterBuf).resize(size, size).png().toFile(path.join(pwaIconsDir, `icon-${size}.png`));
    await sharp(squircleMasterBuf).resize(size, size).webp({ quality: 92 }).toFile(path.join(pwaIconsDir, `icon-${size}.webp`));
  }
  console.log('✅ Web / PWA / Electron icons updated.');

  // 3. Capacitor assets/ folder
  const assetsDir = path.join(__dirname, '../assets');
  if (fs.existsSync(assetsDir)) {
    await sharp(maskableMasterBuf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon.png'));
    await sharp(fgMasterBuf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon-foreground.png'));
    await sharp(bgMasterBuf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon-background.png'));
    await sharp(monoMasterBuf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon-monochrome.png'));

    const splashCrest1200 = await sharp(roundMasterBuf).resize(1100, 1100).png().toBuffer();
    await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#f8fafc' } })
      .composite([{ input: splashCrest1200, gravity: 'center' }])
      .png()
      .toFile(path.join(assetsDir, 'splash.png'));
    await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#0c111c' } })
      .composite([{ input: splashCrest1200, gravity: 'center' }])
      .png()
      .toFile(path.join(assetsDir, 'splash-dark.png'));
  }

  // 4. Android Mipmap & Drawable Notification/Splash Assets
  const mipmaps = {
    ldpi: { launcher: 36, adaptive: 108, notifSmall: 18, notifLarge: 48 },
    mdpi: { launcher: 48, adaptive: 108, notifSmall: 24, notifLarge: 48 },
    hdpi: { launcher: 72, adaptive: 162, notifSmall: 36, notifLarge: 72 },
    xhdpi: { launcher: 96, adaptive: 216, notifSmall: 48, notifLarge: 96 },
    xxhdpi: { launcher: 144, adaptive: 324, notifSmall: 72, notifLarge: 144 },
    xxxhdpi: { launcher: 192, adaptive: 432, notifSmall: 96, notifLarge: 192 }
  };

  const resDir = path.join(__dirname, '../android/app/src/main/res');
  if (fs.existsSync(resDir)) {
    for (const [dpi, dims] of Object.entries(mipmaps)) {
      const mipmapFolder = path.join(resDir, `mipmap-${dpi}`);
      if (!fs.existsSync(mipmapFolder)) fs.mkdirSync(mipmapFolder, { recursive: true });

      await sharp(squircleMasterBuf).resize(dims.launcher, dims.launcher).png().toFile(path.join(mipmapFolder, 'ic_launcher.png'));
      await sharp(roundMasterBuf).resize(dims.launcher, dims.launcher).png().toFile(path.join(mipmapFolder, 'ic_launcher_round.png'));
      await sharp(fgMasterBuf).resize(dims.adaptive, dims.adaptive).png().toFile(path.join(mipmapFolder, 'ic_launcher_foreground.png'));
      await sharp(bgMasterBuf).resize(dims.adaptive, dims.adaptive).png().toFile(path.join(mipmapFolder, 'ic_launcher_background.png'));
      await sharp(monoMasterBuf).resize(dims.launcher, dims.launcher).png().toFile(path.join(mipmapFolder, 'ic_launcher_monochrome.png'));

      // Also place DPI-scaled notification drawables (small monochrome & large full-color crest)
      if (dpi !== 'ldpi') {
        const drawableDpiFolder = path.join(resDir, `drawable-${dpi}`);
        if (!fs.existsSync(drawableDpiFolder)) fs.mkdirSync(drawableDpiFolder, { recursive: true });
        await sharp(roundMasterBuf).resize(dims.notifLarge, dims.notifLarge).png().toFile(path.join(drawableDpiFolder, 'ic_notif_large.png'));
        await sharp(monoMasterBuf).resize(dims.notifSmall, dims.notifSmall).png().toFile(path.join(drawableDpiFolder, 'ic_launcher_monochrome.png'));
      }
    }

    // Base drawable fallback for ic_notif_large & ic_launcher_monochrome
    const baseDrawableDir = path.join(resDir, 'drawable');
    if (fs.existsSync(baseDrawableDir)) {
      await sharp(roundMasterBuf).resize(192, 192).png().toFile(path.join(baseDrawableDir, 'ic_notif_large.png'));
      await sharp(Buffer.from(notificationBadgeSvg)).resize(96, 96).png().toFile(path.join(baseDrawableDir, 'ic_launcher_monochrome.png'));
    }
    console.log('✅ Android launcher & notification drawables updated.');

    // Android Splash Screens in drawables
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
      { folder: 'drawable-land-night-xxxhdpi', w: 1920, h: 1280, dark: true }
    ];

    for (const sc of splashConfigs) {
      const dFolder = path.join(resDir, sc.folder);
      if (fs.existsSync(dFolder)) {
        const bg = sc.dark ? '#0c111c' : '#f8fafc';
        const crestSize = Math.round(Math.min(sc.w, sc.h) * 0.44);
        const crestRendered = await sharp(roundMasterBuf)
          .resize(crestSize, crestSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

        await sharp({
          create: {
            width: sc.w,
            height: sc.h,
            channels: 4,
            background: bg
          }
        })
          .composite([{ input: crestRendered, gravity: 'center' }])
          .png()
          .toFile(path.join(dFolder, 'splash.png'));
      }
    }
    console.log('✅ Android Splash screens updated.');
  }

  // 5. Synchronize android/app/src/main/assets/public/
  const androidPublicAssets = path.join(__dirname, '../android/app/src/main/assets/public');
  if (fs.existsSync(androidPublicAssets)) {
    const syncFiles = [
      'logo.svg',
      'logo.png',
      'icon.png',
      'favicon.png',
      'apple-touch-icon.png',
      'pwa-192x192.png',
      'pwa-512x512.png',
      'pwa-maskable-512x512.png',
      'notification-badge.png',
      'icon.ico'
    ];
    for (const f of syncFiles) {
      const srcPath = path.join(publicDir, f);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(androidPublicAssets, f));
      }
    }

    const androidIconsDir = path.join(androidPublicAssets, 'icons');
    if (!fs.existsSync(androidIconsDir)) fs.mkdirSync(androidIconsDir, { recursive: true });
    for (const size of iconSizes) {
      fs.copyFileSync(path.join(pwaIconsDir, `icon-${size}.png`), path.join(androidIconsDir, `icon-${size}.png`));
      fs.copyFileSync(path.join(pwaIconsDir, `icon-${size}.webp`), path.join(androidIconsDir, `icon-${size}.webp`));
    }
    console.log('✅ Android assets/public synchronized.');
  }

  console.log('🎉 All brand, notification, PWA, Electron, and Android icons updated!');
}

main().catch((err) => {
  console.error('Error generating brand assets:', err);
  process.exit(1);
});
