import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { StudentPortalData } from '../types';
import { DEMO_STUDENT } from './mockData';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let db: ReturnType<typeof getFirestore> | null = null;

export function getDb() {
  if (!isFirebaseConfigured) return null;
  if (!db) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

/**
 * Fetch Student Portal Data by Student Code, ID, or Parent Phone number
 */
export async function fetchStudentPortalData(identifier: string): Promise<StudentPortalData | null> {
  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId) return null;

  // 1. If identifier matches demo or test code
  if (cleanId === 'demo' || cleanId === '1001' || cleanId === '01000000000' || cleanId === 'stu-1001') {
    return DEMO_STUDENT;
  }

  // 2. Try Firestore if configured
  if (isFirebaseConfigured) {
    try {
      const firestore = getDb();
      if (!firestore) return null;

      // Try fetching by direct document ID (studentId or studentCode)
      const docRef = doc(firestore, 'portal_students', identifier.trim());
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as StudentPortalData;
      }

      // Try querying by studentCode field
      const colRef = collection(firestore, 'portal_students');
      const qCode = query(colRef, where('studentCode', '==', identifier.trim()));
      const snapCode = await getDocs(qCode);
      if (!snapCode.empty) {
        return snapCode.docs[0].data() as StudentPortalData;
      }

      // Try querying by parent phone
      const qPhone = query(colRef, where('parentPhone', '==', identifier.trim()));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        return snapPhone.docs[0].data() as StudentPortalData;
      }

      // Try querying by student phone
      const qStudentPhone = query(colRef, where('studentPhone', '==', identifier.trim()));
      const snapStudentPhone = await getDocs(qStudentPhone);
      if (!snapStudentPhone.empty) {
        return snapStudentPhone.docs[0].data() as StudentPortalData;
      }

    } catch (error) {
      console.warn('Firebase fetch error, falling back to local/demo:', error);
    }
  }

  // 3. Fallback: check localStorage cache
  try {
    const cached = localStorage.getItem(`portal_cache_${identifier.trim()}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  return null;
}
