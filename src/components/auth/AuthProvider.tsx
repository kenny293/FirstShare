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
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";

interface AuthState {
  user: User | null;
  /** True until Firebase has told us whether someone is signed in. */
  loading: boolean;
  configured: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name: string) => Promise<void>;
  signInGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(clientAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
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
      setUser({ ...cred.user } as User);
    }
  }, []);
  const signInGuest = useCallback(async () => {
    await signInAnonymously(clientAuth());
  }, []);
  const signOut = useCallback(async () => {
    await fbSignOut(clientAuth());
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
    "auth/operation-not-allowed": "This sign-in method isn't turned on in the Firebase console yet.",
    "auth/network-request-failed": "Couldn't reach the sign-in service. Check your connection.",
  };
  return map[code] ?? "Sign-in didn't work. Please try again.";
}

/** fetch() our API with the signed-in user's token. Throws with the server's message on errors. */
export async function apiFetch<T>(user: User | null, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
