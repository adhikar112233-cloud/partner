// Scripts for service worker must be ES5.
// We can't use import statements, so we use importScripts.
importScripts("https://aistudiocdn.com/firebase@12.6.0/app-compat.js");
importScripts("https://aistudiocdn.com/firebase@12.6.0/messaging-compat.js"); // Re-enabled to ensure a complete Firebase instance

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxqtqQ8QH6vQ_VIiu7bapLCnHveldxSP0",
  authDomain: "bigyapon2-cfa39.firebaseapp.com",
  databaseURL: "https://bigyapon2-cfa39-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bigyapon2-cfa39",
  storageBucket: "bigyapon2-cfa39.appspot.com",
  messagingSenderId: "994071463799",
  appId: "1:994071463799:web:08618ba8206bbff2fd0372",
  measurementId: "G-QW74JFCEQ3"
};

// Initialize Firebase safely to prevent re-initialization errors
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Re-enabled messaging logic to ensure a complete and valid Firebase instance.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update.',
    icon: '/favicon.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});