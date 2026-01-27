// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCGp8e6ldrkYyN1klcNx1KfNm2r0ODFkcQ",
  authDomain: "trianglerh-63d38.firebaseapp.com",
  projectId: "trianglerh-63d38",
  appId: "1:1077110947594:web:4c66959a7b77adf55f04f3",
  messagingSenderId: "1077110947594",
};


function getFirebaseApp() {
  if (getApps().length) return getApp();
  return initializeApp(firebaseConfig);
}

// ✅ Solo cliente: evita crashear en build/SSR
export const isBrowser = typeof window !== "undefined";

// Exportamos auth/db SOLO si es browser
export const app = isBrowser ? getFirebaseApp() : null;

export const auth = isBrowser && app ? getAuth(app) : (null as any);
export const db = isBrowser && app ? getFirestore(app) : (null as any);

export const googleProvider = new GoogleAuthProvider();

// Messaging opcional (notifs)
export async function getClientMessaging() {
  if (!isBrowser || !app) return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
}
