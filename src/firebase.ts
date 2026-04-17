import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigLocal from '../firebase-applet-config.json';

// Configuration logic: Prioritize local config file as it is managed by the setup tools.
// Environment variables remain as fallbacks but will not override a valid local config.
const getFirebaseConfig = () => {
  const local = firebaseConfigLocal;
  const env = {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
  };

  // Logic: If local config has a value, use it. Otherwise, use env.
  const config = {
    projectId: local.projectId || env.projectId,
    appId: local.appId || env.appId,
    apiKey: local.apiKey || env.apiKey,
    authDomain: local.authDomain || env.authDomain,
    storageBucket: local.storageBucket || env.storageBucket,
    messagingSenderId: local.messagingSenderId || env.messagingSenderId
  };

  console.log('[DEBUG] Firebase Config Resolution:', {
    source: (local.projectId ? 'Local JSON' : 'Environment'),
    projectId: config.projectId,
    databaseId: local.firestoreDatabaseId || import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)'
  });

  return config;
};

const firebaseConfig = getFirebaseConfig();
const FIRESTORE_DB_ID = firebaseConfigLocal.firestoreDatabaseId || import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)';

// Initialize App (Singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth (Singleton)
const auth = getAuth(app);

// Initialize Firestore
const db = FIRESTORE_DB_ID === '(default)' ? getFirestore(app) : getFirestore(app, FIRESTORE_DB_ID);

console.log('[DEBUG] Firebase Service Instances Initialized:', {
  projectId: app.options.projectId,
  databaseId: FIRESTORE_DB_ID,
  appUrl: window.location.origin
});

export { app, auth, db };
