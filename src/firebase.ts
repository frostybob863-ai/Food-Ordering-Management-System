import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
};

const FIRESTORE_DB_ID = import.meta.env.VITE_FIRESTORE_DATABASE_ID;

console.log('[DEBUG] Initializing Firebase with Project ID:', firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, FIRESTORE_DB_ID);
export const auth = getAuth(app);
console.log('[DEBUG] Auth initialized. API Key present:', !!auth.app.options.apiKey);
