
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getMessaging, type Messaging } from 'firebase/messaging';

// -------------------- PAYMENT GATEWAY CONFIG --------------------

// Razorpay Backend URL
export const RAZORPAY_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_RAZORPAY_URL) ||
  "https://razorpay-backeb-nd.onrender.com";

// Cashfree Backend URL
export const CASHFREE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_CASHFREE_URL) ||
  "https://partnerpayment-backend.onrender.com";

// General Backend URL (defaults to Cashfree/Partner backend for general operations)
export const BACKEND_URL = CASHFREE_URL;

// Razorpay Public Key (Frontend Safe Only)
export const RAZORPAY_KEY_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_RAZORPAY_KEY_ID) ||
  "rzp_test_RiFI4JfUCt7mQ9"; 


// -------------------- FIREBASE CONFIG --------------------
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


// -------------------- INITIALIZE FIREBASE --------------------
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let messaging: Messaging | undefined;

// A simple check to see if the config has been filled out.
export const isFirebaseConfigured = !!(
  firebaseConfig &&
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('YOUR_')
);

if (isFirebaseConfigured) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

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
  console.warn("Firebase config is incomplete.");
}

// -------------------- EXPORTS --------------------
export {
  auth,
  db,
  storage,
  messaging,
  RecaptchaVerifier,
  signInWithPhoneNumber
};
