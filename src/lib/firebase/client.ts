"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

/**
 * Browser Firebase setup. Only Auth runs in the browser; all reads and writes
 * go through our server API (which verifies the sign-in token), so the
 * score can't be tampered with.
 *
 * These NEXT_PUBLIC_ values are designed to be public (they identify the
 * project; security comes from Auth + server checks + Firestore rules).
 */
const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "1";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (useEmulators ? "demo-key" : ""),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (useEmulators ? "demo-firstshare.firebaseapp.com" : ""),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (useEmulators ? "demo-firstshare" : ""),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let auth: Auth | null = null;

export function clientAuth(): Auth {
  if (auth) return auth;
  if (!firebaseConfigured) throw new Error("Firebase isn't configured");
  const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
  auth = getAuth(app);
  if (useEmulators) {
    const host = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR || "http://127.0.0.1:9099";
    connectAuthEmulator(auth, host, { disableWarnings: true });
  }
  return auth;
}
