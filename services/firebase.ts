
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

// Backend URLs for different Payment Gateways
export const CASHFREE_URL = "https://partnerpayment-backend.onrender.com";
export const RAZORPAY_URL = "https://razorpay-backeb-nd.onrender.com";

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

export const RAZORPAY_KEY_ID = getEnv('NEXT_PUBLIC_RAZORPAY_KEY_ID', 'VITE_RAZORPAY_KEY_ID') || "rzp_test_RhsBzbfkYo5DFA";

// Default Backend URL (can be used for general operations or fallback)
export const BACKEND_URL = CASHFREE_URL;

// Declare variables that will hold the Firebase services.
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let messaging: Messaging | null = null;

// A simple check to see if the config has been filled out.
// This is for developer guidance and allows the app to show a helpful message.
export const isFirebaseConfigured = !!(
  firebaseConfig &&
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('YOUR_') 
);

if (isFirebaseConfigured) {
  // Initialize Firebase. This will throw a specific error from the Firebase SDK
  // if the config values are present but incorrect (e.g., invalid API key).
  // This is desirable as it provides a clear, actionable error in the console
  // instead of causing confusing downstream errors.
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  try {
    // Messaging can fail in environments where it's not supported.
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      messaging = getMessaging(app);
    }
  } catch (e) {
    console.warn("Firebase Messaging is not supported in this environment.", e);
  }
} else {
    // If the config is not filled out, the isFirebaseConfigured flag will be false,
    // and the App.tsx component will render an error message guiding the developer.
    // The services (auth, db) will be undefined, but the app won't try to use them.
    console.warn("Firebase config is incomplete or contains placeholder values. Firebase has not been initialized.");
}


// We intentionally export potentially uninitialized variables.
// The isFirebaseConfigured flag MUST be checked by consumers before using these exports.
// @ts-ignore
export { auth, db, storage, messaging, RecaptchaVerifier, signInWithPhoneNumber };
