
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getMessaging, type Messaging } from 'firebase/messaging';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBxqtqQ8QH6vQ_VIiu7bapLCnHveldxSP0",
  authDomain: "bigyapon2-cfa39.firebaseapp.com",
  databaseURL: "https://bigyapon2-cfa39-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bigyapon2-cfa39",
  storageBucket: "bigyapon2-cfa39.appspot.com",
  messagingSenderId: "994071463799",
  appId: "1:994071463799:web:08618ba8206bbff2fd0372",
  measurementId: "G-QW74JFCEQ3"
};

// Constants - Helper to get env vars in both Vite and Next.js environments safely
const getEnv = (key: string, viteKey: string) => {
  // Check for Vite environment (import.meta.env)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
       // @ts-ignore
       return import.meta.env[viteKey];
    }
  } catch (e) { /* ignore */ }

  // Check for standard process.env (Next.js / CRA)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
       return process.env[key];
    }
  } catch (e) { /* ignore */ }

  return undefined;
};

// Export RAZORPAY_KEY_ID with a default value fallback
export const RAZORPAY_KEY_ID = getEnv('NEXT_PUBLIC_RAZORPAY_KEY_ID', 'VITE_RAZORPAY_KEY_ID') || "rzp_test_RhsBzExfxY05FA";

// Backend URLs - Explicitly separated for dual backend support
export const CASHFREE_URL = "https://partnerpayment-backend.onrender.com"; 
export const RAZORPAY_URL = "https://razorpay-backeb-nd.onrender.com"; 
export const BACKEND_URL = CASHFREE_URL; // General purpose backend / Partner Payment Backend

// Declare variables that will hold the Firebase services.
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let messaging: Messaging | null = null;

// A simple check to see if the config has been filled out.
export const isFirebaseConfigured = !!(
  firebaseConfig &&
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('YOUR_') 
);

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      messaging = getMessaging(app);
    }
  } catch (e) {
    console.warn("Firebase Messaging is not supported in this environment.", e);
  }
} else {
    console.warn("Firebase config is incomplete. Firebase has not been initialized.");
}

// @ts-ignore
export { auth, db, storage, messaging, RecaptchaVerifier, signInWithPhoneNumber };
