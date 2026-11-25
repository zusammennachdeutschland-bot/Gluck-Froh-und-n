/**
 * Pure Firebase project configuration shared between browser client SDK
 * and server-side Firebase Admin SDK (Vercel Serverless / Node.js).
 *
 * IMPORTANT: Keep this file 100% free of browser SDK, Capacitor, or DOM imports
 * so server bundles (api/index.ts -> firebaseAdmin.ts) can import it safely on Vercel.
 */
export const FIREBASE_CONFIG = {
  projectId: 'glueck-c8621',
  appId: '1:874458026984:web:f88ecbf0df451173854a5d',
  apiKey: 'AIzaSyBJVhFLw3NeS1MNHJ9ZnAipuZNwRaoaZ-g',
  authDomain: 'glueck-c8621.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-remixgluckgerman-fc71e704-09a9-492f-82ad-623b4e7b445e',
  storageBucket: 'glueck-c8621.firebasestorage.app',
  messagingSenderId: '874458026984'
} as const;
