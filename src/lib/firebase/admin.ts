import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** True when the Firebase emulators should be used (local development / tests). */
export const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

function credentialFromEnv() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
      return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
    } catch {
      console.error("[firebase] FIREBASE_SERVICE_ACCOUNT_JSON isn't valid JSON (paste the whole file on one line).");
      return null;
    }
  }
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    // .env files usually store the key with literal "\n"
    return { projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
  }
  return null;
}

export class ConfigError extends Error {}

const ADMIN_APP = "firstshare-admin";
const AUTH_ONLY_APP = "firstshare-auth";
const existing = (name: string) => getApps().find((a) => a.name === name);

/** True when the server can use Firestore (service-account credentials or the emulators). */
export function firebaseAdminConfigured(): boolean {
  return usingEmulators || credentialFromEnv() !== null;
}

/**
 * True when the server can verify Firebase sign-ins. That only needs the
 * project ID (Google's public keys check the token), not a service account.
 */
export function firebaseAuthConfigured(): boolean {
  return firebaseAdminConfigured() || Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

/** Full Admin app (Firestore + Auth). */
export function adminApp(): App {
  const found = existing(ADMIN_APP);
  if (found) return found;
  if (usingEmulators) {
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-firstshare" }, ADMIN_APP);
  }
  const c = credentialFromEnv();
  if (!c) {
    throw new ConfigError(
      "Firebase Admin isn't configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY), or run the emulators.",
    );
  }
  return initializeApp({ credential: cert(c), projectId: c.projectId }, ADMIN_APP);
}

/** App used to verify sign-ins: the full Admin app if available, otherwise a project-ID-only app. */
function authApp(): App {
  if (firebaseAdminConfigured()) return adminApp();
  const found = existing(AUTH_ONLY_APP);
  if (found) return found;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new ConfigError("Firebase sign-in isn't configured on the server (NEXT_PUBLIC_FIREBASE_PROJECT_ID is empty).");
  return initializeApp({ projectId }, AUTH_ONLY_APP);
}

// Kept on globalThis: route bundles each get their own copy of this module but
// share one Firebase app, and Firestore settings may only be applied once.
const g = globalThis as unknown as { __firstshareDb?: Firestore };
export const adminDb = (): Firestore => {
  if (!g.__firstshareDb) {
    const db = getFirestore(adminApp());
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Already in use (e.g. after a dev hot-reload): settings were applied by an earlier instance.
    }
    g.__firstshareDb = db;
  }
  return g.__firstshareDb;
};
export const adminAuth = () => getAuth(authApp());

export interface AuthedUser {
  uid: string;
  displayName: string;
  anonymous: boolean;
}

export class AuthError extends Error {}

/** Local guest token: "guest:" + a random ID the browser generated and keeps. */
const GUEST_TOKEN = /^guest:([a-f0-9]{32})$/;

/**
 * Who is calling? "Authorization: Bearer <token>" where the token is either a
 * Firebase ID token, or (only when Firebase isn't configured) a local guest token.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AuthError("Sign in first");

  const guest = GUEST_TOKEN.exec(token);
  if (guest) {
    // Local guests only exist while challenges are stored in the local file.
    // With Firestore, every player must have a verified Firebase sign-in.
    if (firebaseAdminConfigured()) throw new AuthError("Please sign in again (guest sessions now go through Firebase).");
    return { uid: `local-${guest[1]}`, displayName: `Guest ${guest[1].slice(0, 4).toUpperCase()}`, anonymous: true };
  }
  if (!firebaseAuthConfigured()) throw new AuthError("Accounts aren't set up on this server yet. Play as a guest instead.");

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch {
    throw new AuthError("Your sign-in expired. Please sign in again.");
  }
  const anonymous = decoded.firebase?.sign_in_provider === "anonymous";
  const name =
    (decoded.name as string | undefined) ||
    (decoded.email ? String(decoded.email).split("@")[0] : "") ||
    `Guest ${decoded.uid.slice(0, 4).toUpperCase()}`;
  return { uid: decoded.uid, displayName: name.slice(0, 40), anonymous };
}
