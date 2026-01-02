// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID!,
  messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID,
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
