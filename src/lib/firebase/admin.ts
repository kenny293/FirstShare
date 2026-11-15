import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** True when the Firebase emulators should be used (local development / tests). */
export const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

function credentialFromEnv() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  }
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    // .env files usually store the key with literal "\n"
    return { projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
  }
  return null;
}

let app: App | null = null;

export class ConfigError extends Error {}

export function adminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]);
  if (usingEmulators) {
    app = initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-firstshare" });
    return app;
  }
  const c = credentialFromEnv();
  if (!c) {
    throw new ConfigError(
      "Firebase Admin isn't configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY), or run the emulators.",
    );
  }
  app = initializeApp({ credential: cert(c), projectId: c.projectId });
  return app;
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
export const adminAuth = () => getAuth(adminApp());

export interface AuthedUser {
  uid: string;
  displayName: string;
  anonymous: boolean;
}

export class AuthError extends Error {}

/** Verify the Firebase ID token sent as "Authorization: Bearer <token>". */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AuthError("Sign in first");
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
