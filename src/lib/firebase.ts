import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForLocalDemoAndTesting12345",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "minesweeper-global-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "minesweeper-global-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "minesweeper-global-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://minesweeper-global-demo.firebaseio.com",
};

const app: FirebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const firestore: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app);
