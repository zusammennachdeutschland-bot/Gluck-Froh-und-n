import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@shared', replacement: path.resolve(__dirname, './shared') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@capacitor/core', replacement: path.resolve(__dirname, './src/platform/capacitorStub.ts') },
      { find: '@capacitor/filesystem', replacement: path.resolve(__dirname, './src/platform/capacitorStub.ts') },
      { find: '@capacitor/share', replacement: path.resolve(__dirname, './src/platform/capacitorStub.ts') },
      { find: '@capacitor/toast', replacement: path.resolve(__dirname, './src/platform/capacitorStub.ts') },
      { find: '@capacitor-community/text-to-speech', replacement: path.resolve(__dirname, './src/platform/capacitorStub.ts') },
      { find: /.*\/services\/downloadedFilesService$/, replacement: path.resolve(__dirname, './src/platform/downloadedFilesStub.ts') },
      { find: /.*\/context\/AppContext$/, replacement: path.resolve(__dirname, './context/AppContext.ts') }
    ]
  },
  server: {
    port: 3000
  }
});
