import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      ...(!isCI ? [
        VitePWA({
          selfDestroying: true,
          registerType: 'autoUpdate',
          includeAssets: ['logo.svg', 'favicon.png', 'icon.png', 'logo.png', 'apple-touch-icon.png'],
          manifest: {
            name: 'AGS Teacher App',
            short_name: 'AGS',
            description: 'Teacher management application',
            theme_color: '#ffffff',
            icons: [
              {
                src: 'favicon.png',
                sizes: '64x64',
                type: 'image/png'
              },
              {
                src: 'icon.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'icon.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'logo.svg',
                sizes: '1024x1024',
                type: 'image/svg+xml',
                purpose: 'any'
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
    build: {
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
