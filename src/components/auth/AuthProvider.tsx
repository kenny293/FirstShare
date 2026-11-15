"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";

/**
 * The signed-in player: a Firebase user, or a "local guest" when Firebase
 * isn't configured (a random private ID kept in this browser, so the
 * challenge works with zero setup).
 */
export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  isAnonymous: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

const GUEST_KEY = "firstshare.guest.v1";
/** Set while a local guest is signed in (cleared on sign-out; the ID itself is kept). */
const GUEST_ACTIVE_KEY = "firstshare.guest.active";

function setGuestActive(on: boolean) {
  try {
    if (on) localStorage.setItem(GUEST_ACTIVE_KEY, "1");
    else localStorage.removeItem(GUEST_ACTIVE_KEY);
  } catch {}
}
function guestActive(): boolean {
  try {
    return localStorage.getItem(GUEST_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Firebase errors meaning "guest sign-in isn't available in this project" (fall back to a local guest). */
const GUEST_FALLBACK_CODES = new Set([
  "auth/operation-not-allowed",
  "auth/admin-restricted-operation",
  "auth/configuration-not-found",
  "auth/invalid-api-key",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.",
  "auth/unauthorized-domain",
]);

function localGuest(id: string): AppUser {
  return {
    uid: `local-${id}`,
    displayName: `Guest ${id.slice(0, 4).toUpperCase()}`,
    email: null,
    isAnonymous: true,
    getIdToken: async () => `guest:${id}`,
  };
}

function newGuestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readGuestId(): string | null {
  try {
    const id = localStorage.getItem(GUEST_KEY);
    return id && /^[a-f0-9]{32}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: AppUser | null;
  /** True until Firebase has told us whether someone is signed in. */
  loading: boolean;
  /** Google / email accounts available (Firebase configured). Guests always work. */
  configured: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name: string) => Promise<void>;
  signInGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped when the Firebase user object changes in place (e.g. a new display name).
  const [, setVersion] = useState(0);

  useEffect(() => {
    const restoreLocal = () => {
      const id = guestActive() ? readGuestId() : null;
      return id ? localGuest(id) : null;
    };
    if (!firebaseConfigured) {
      setUser(restoreLocal());
      setLoading(false);
      return;
    }
    return onAuthStateChanged(clientAuth(), (u) => {
      setUser(u ?? restoreLocal());
      setLoading(false);
    });
  }, []);

  const startLocalGuest = useCallback(() => {
    const id = readGuestId() ?? newGuestId();
    try {
      localStorage.setItem(GUEST_KEY, id);
    } catch {
      /* private mode: the guest lasts until the tab closes */
    }
    setGuestActive(true);
    setUser(localGuest(id));
  }, []);

  const signInGoogle = useCallback(async () => {
    await signInWithPopup(clientAuth(), new GoogleAuthProvider());
  }, []);
  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(clientAuth(), email, password);
  }, []);
  const signUpEmail = useCallback(async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(clientAuth(), email, password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim().slice(0, 40) });
      await cred.user.getIdToken(true); // refresh so the server sees the new name
      setVersion((v) => v + 1); // same object, new name: re-render
    }
  }, []);
  const signInGuest = useCallback(async () => {
    if (!firebaseConfigured) return startLocalGuest();
    try {
      await signInAnonymously(clientAuth());
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (!GUEST_FALLBACK_CODES.has(code)) throw err;
      console.warn(`[auth] Firebase guest sign-in unavailable (${code}); using a local guest instead.`);
      startLocalGuest();
    }
  }, [startLocalGuest]);
  const signOut = useCallback(async () => {
    // Keep the local guest ID so "Play as a guest" brings back the same challenges.
    setGuestActive(false);
    if (firebaseConfigured && clientAuth().currentUser) await fbSignOut(clientAuth());
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, configured: firebaseConfigured, signInGoogle, signInEmail, signUpEmail, signInGuest, signOut }),
    [user, loading, signInGoogle, signInEmail, signUpEmail, signInGuest, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

/** Plain-English message for Firebase Auth error codes. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "That email and password don't match.",
    "auth/wrong-password": "That email and password don't match.",
    "auth/user-not-found": "No account with that email yet. Try creating one.",
    "auth/email-already-in-use": "There's already an account with that email. Try signing in.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/invalid-email": "That doesn't look like an email address.",
    "auth/popup-closed-by-user": "The Google window was closed before signing in.",
    "auth/popup-blocked": "Your browser blocked the Google pop-up. Allow pop-ups and try again.",
    "auth/operation-not-allowed": "This sign-in method isn't turned on in the Firebase console yet (Authentication → Sign-in method).",
    "auth/admin-restricted-operation": "This sign-in method isn't turned on in the Firebase console yet (Authentication → Sign-in method).",
    "auth/unauthorized-domain": "This website isn't on your Firebase project's list of authorized domains (Authentication → Settings).",
    "auth/configuration-not-found": "Firebase Authentication isn't set up for this project yet. Open Authentication in the Firebase console and click Get started.",
    "auth/network-request-failed": "Couldn't reach the sign-in service. Check your connection.",
  };
  return map[code] ?? "Sign-in didn't work. Please try again.";
}

/** fetch() our API with the signed-in user's token. Throws with the server's message on errors. */
export async function apiFetch<T>(user: AppUser | null, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
