import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export const CANONICAL_APP_VERSION = '3.0.0';

const ISOLATED_ATTACHMENT_PUBLIC_SUBDIRS = [
  ['assets', 'aistudio'],
  ['chat-attachments'],
  ['conversation-attachments'],
];

function excludeAiStudioAttachmentsPlugin(): Plugin {
  let resolvedOutDir = path.resolve(__dirname, 'dist');
  const stripIsolatedDirs = () => {
    for (const segments of ISOLATED_ATTACHMENT_PUBLIC_SUBDIRS) {
      const target = path.join(resolvedOutDir, ...segments);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  };

  return {
    name: 'exclude-aistudio-attachments',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      resolvedOutDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      stripIsolatedDirs();
    },
    closeBundle() {
      stripIsolatedDirs();
    },
  };
}

export default defineConfig(() => {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const isElectronBuild = process.env.ELECTRON_BUILD === 'true';

  const baseBuildNumber = 300;
  const githubRunNumber = process.env.GITHUB_RUN_NUMBER ? parseInt(process.env.GITHUB_RUN_NUMBER, 10) : 0;
  const buildNumber = process.env.APP_BUILD_NUMBER || (
    githubRunNumber > 0 ? String(baseBuildNumber + githubRunNumber) : String(baseBuildNumber)
  );
  const buildTime = process.env.APP_BUILD_TIME || new Date().toISOString();

  return {
    base: isElectronBuild ? './' : '/',
    define: {
      __APP_VERSION__: JSON.stringify(CANONICAL_APP_VERSION),
      __APP_BUILD_NUMBER__: JSON.stringify(buildNumber),
      __APP_BUILD_TIME__: JSON.stringify(buildTime)
    },
    plugins: [
      excludeAiStudioAttachmentsPlugin(),
      react(), 
      tailwindcss(),
      ...(!isCI ? [
        VitePWA({
          selfDestroying: true,
          registerType: 'autoUpdate',
          includeAssets: ['favicon.png', 'icon.png', 'logo.png', 'apple-touch-icon.png', 'notification-badge.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
          manifest: {
            name: 'Glück fröhlich und froh',
            short_name: 'Glück',
            description: 'German Teacher Manager application',
            theme_color: '#151e2e',
            background_color: '#0c111c',
            icons: [
              {
                src: 'favicon.png',
                sizes: '64x64',
                type: 'image/png'
              },
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'pwa-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              },
              {
                src: 'apple-touch-icon.png',
                sizes: '180x180',
                type: 'image/png'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}'],
            globIgnores: ['**/assets/aistudio/**', 'assets/aistudio/**', '**/chat-attachments/**', '**/conversation-attachments/**'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          }
        })
      ] : [])
    ],
    optimizeDeps: {
      entries: ['index.html'],
    },
    esbuild: {
      pure: ['console.log'],
    },
    build: {
      cssMinify: true,
      minify: 'esbuild' as const,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html')
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('recharts')) {
                return 'vendor-charts';
              }
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvas-confetti')) {
                return 'vendor-export-pdf';
              }
              if (id.includes('@capacitor') || id.includes('localforage')) {
                return 'vendor-capacitor-storage';
              }
              if (id.includes('firebase') || id.includes('@firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              if (id.includes('peerjs')) {
                return 'vendor-peerjs';
              }
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
