// Scripts for service worker must be ES5.
// We can't use import statements, so we use importScripts.
importScripts("https://aistudiocdn.com/firebase@12.6.0/app-compat.js");
importScripts("https://aistudiocdn.com/firebase@12.6.0/messaging-compat.js");

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

// Initialize Firebase safely
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'New Activity';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update.',
    icon: '/favicon.svg', // Ensure you have this icon or use a valid URL
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click - Opens the app
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event);
  
  event.notification.close();

  // This looks to see if the current is already open and focuses if it is
  event.waitUntil(
    clients.matchAll({
      type: "window"
    })
    .then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === '/' && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});