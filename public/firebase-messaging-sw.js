/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCGp8e6ldrkYyN1klcNx1KfNm2r0ODFkcQ",
  authDomain: "trianglerh-63d38.firebaseapp.com",
  projectId: "trianglerh-63d38",
  messagingSenderId: "1077110947594", // 🔥 ESTE ERA EL FALTANTE
  appId: "1:1077110947594:web:4c66959a7b77adf55f04f3",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "TriangleRH";
  const options = {
    body: payload?.notification?.body || "Notificación",
    icon: "/icon.png", // opcional
  };

  self.registration.showNotification(title, options);
});
