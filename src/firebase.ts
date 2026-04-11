import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const firebaseConfig = {
  projectId: "gen-lang-client-0901244350",
  appId: "1:624370272180:web:4b9e8a0ca8a2e54e0b54e1",
  apiKey: "AIzaSyAlbNGpNE_ApUZW2Jqal1O_BbBneh0Za5g",
  authDomain: "gen-lang-client-0901244350.firebaseapp.com",
  storageBucket: "gen-lang-client-0901244350.firebasestorage.app",
  messagingSenderId: "624370272180"
};

const FIRESTORE_DB_ID = "ai-studio-fff57684-98ae-4bbd-87cc-1c68ba9843e6";

console.log('[DEBUG] Initializing Firebase with Project ID:', firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, FIRESTORE_DB_ID);
export const auth = getAuth(app);
console.log('[DEBUG] Auth initialized. API Key present:', !!auth.app.options.apiKey);
