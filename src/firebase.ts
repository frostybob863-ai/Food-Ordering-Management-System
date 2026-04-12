import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigLocal from '../firebase-applet-config.json';

// Prioritize the local config file as it is managed by the set_up_firebase tool
const firebaseConfig = {
  projectId: firebaseConfigLocal.projectId,
  appId: firebaseConfigLocal.appId,
  apiKey: firebaseConfigLocal.apiKey,
  authDomain: firebaseConfigLocal.authDomain,
  storageBucket: firebaseConfigLocal.storageBucket,
  messagingSenderId: firebaseConfigLocal.messagingSenderId
};

const FIRESTORE_DB_ID = firebaseConfigLocal.firestoreDatabaseId || '(default)';

console.log('[DEBUG] Firebase Configuration (Strict Mode):', {
  projectId: firebaseConfig.projectId,
  databaseId: FIRESTORE_DB_ID,
  apiKeyPresent: !!firebaseConfig.apiKey
});

const app = initializeApp(firebaseConfig);
export const db = FIRESTORE_DB_ID === '(default)' ? getFirestore(app) : getFirestore(app, FIRESTORE_DB_ID);
export const auth = getAuth(app);
console.log('[DEBUG] Auth initialized. API Key present:', !!auth.app.options.apiKey);
