const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function run() {
  const svgPath = path.join(__dirname, '../public/logo.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Generate full logo PNG with crisp transparency
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(__dirname, '../public/logo.png'));
  console.log('Generated logo.png');

  // 2. Generate Master App Icon (High-end Clover & G symbol on rich emerald-teal gradient)
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

  const iconBuffer = Buffer.from(masterIconSvg);

  await sharp(iconBuffer).resize(512, 512).png().toFile(path.join(__dirname, '../public/icon.png'));
  await sharp(iconBuffer).resize(192, 192).png().toFile(path.join(__dirname, '../public/favicon.png'));
  await sharp(iconBuffer).resize(180, 180).png().toFile(path.join(__dirname, '../public/apple-touch-icon.png'));
  await sharp(iconBuffer).resize(512, 512).png().toFile(path.join(__dirname, '../public/fg.png'));

  // PWA icons
  const iconSizes = [48, 72, 96, 128, 192, 256, 512];
  const iconsDir = path.join(__dirname, '../public/icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  for (const size of iconSizes) {
    await sharp(iconBuffer).resize(size, size).png().toFile(path.join(iconsDir, `icon-${size}.png`));
    await sharp(iconBuffer).resize(size, size).webp().toFile(path.join(iconsDir, `icon-${size}.webp`));
  }

  console.log('All brand icons generated successfully!');
}

run().catch(console.error);
