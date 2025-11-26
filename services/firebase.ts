
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getMessaging, type Messaging } from 'firebase/messaging';

// -------------------- PAYMENT CONFIG --------------------
// IMPORTANT: This URL must match your deployed Firebase Cloud Function URL.
export const BACKEND_URL = "https://us-central1-bigyapon2-cfa39.cloudfunctions.net/createpayment"; 

// -------------------- FIREBASE CONFIG --------------------
export const firebaseConfig = {
  apiKey: "AIzaSyBxqtqQ8QH6vQ_VIiu7bapLCnHveldxSP0",
  authDomain: "bigyapon2-cfa39.firebaseapp.com",
  databaseURL: "https://bigyapon2-cfa39-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bigyapon2-cfa39",
  storageBucket: "bigyapon2-cfa39.firebasestorage.app",
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

export const isFirebaseConfigured = !!(firebaseConfig && firebaseConfig.apiKey);

if (isFirebaseConfigured) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      messaging = getMessaging(app);
    }
  } catch (e) { console.warn("Messaging not supported", e); }
}

export { auth, db, storage, messaging, RecaptchaVerifier, signInWithPhoneNumber };
