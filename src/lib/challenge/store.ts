import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { ChallengeDoc, ChallengeMode, LeaderboardEntry } from "./types";

type StoredEntry = Omit<LeaderboardEntry, "id"> & { uid: string };

/**
 * Where challenges live:
 *  - Firestore when Firebase Admin is configured (or the emulators are running)
 *  - otherwise a local JSON file, so guests can play with zero setup.
 */
export interface ChallengeStore {
  kind: "firestore" | "local";
  create(doc: ChallengeDoc): Promise<string>;
  get(id: string): Promise<ChallengeDoc | undefined>;
  /** Read-modify-write one challenge atomically. `fn` returns the fields to change. */
  update(id: string, fn: (doc: ChallengeDoc | undefined) => Promise<Partial<ChallengeDoc>>): Promise<void>;
  /** Mark finished and add the leaderboard entry together. */
  finish(id: string, patch: Partial<ChallengeDoc>, mode: ChallengeMode, entry: StoredEntry): Promise<void>;
  listByUid(uid: string): Promise<{ id: string; doc: ChallengeDoc }[]>;
  top(mode: ChallengeMode, n: number): Promise<LeaderboardEntry[]>;
}

// --- Firestore -----------------------------------------------------------------

const lbName = (mode: ChallengeMode) => (mode === "live" ? "leaderboard_live" : "leaderboard_replay");

const firestoreStore: ChallengeStore = {
  kind: "firestore",
  async create(doc) {
    return (await adminDb().collection("challenges").add(doc)).id;
  },
  async get(id) {
    return (await adminDb().collection("challenges").doc(id).get()).data() as ChallengeDoc | undefined;
  },
  async update(id, fn) {
    await adminDb().runTransaction(async (tx) => {
      const ref = adminDb().collection("challenges").doc(id);
      const patch = await fn((await tx.get(ref)).data() as ChallengeDoc | undefined);
      tx.update(ref, patch);
    });
  },
  async finish(id, patch, mode, entry) {
    const batch = adminDb().batch();
    batch.update(adminDb().collection("challenges").doc(id), patch);
    batch.set(adminDb().collection(lbName(mode)).doc(id), entry);
    await batch.commit();
  },
  async listByUid(uid) {
    const snap = await adminDb().collection("challenges").where("uid", "==", uid).get();
    return snap.docs.map((d) => ({ id: d.id, doc: d.data() as ChallengeDoc }));
  },
  async top(mode, n) {
    const snap = await adminDb().collection(lbName(mode)).orderBy("challengeScore", "desc").limit(n).get();
    return snap.docs.map((d) => {
      const e = d.data() as StoredEntry;
      return { id: d.id, displayName: e.displayName, challengeScore: e.challengeScore, habitsScore: e.habitsScore, finishedAt: e.finishedAt };
    });
  },
};

// --- Local JSON file -------------------------------------------------------------

interface LocalData {
  challenges: Record<string, ChallengeDoc>;
  leaderboard: Record<ChallengeMode, Record<string, StoredEntry>>;
}

const LOCAL_FILE = path.join(process.cwd(), ".local-data", "challenges.json");

// One copy per server process (kept on globalThis so dev hot-reloads share it).
const g = globalThis as unknown as { __firstshareLocal?: { data: LocalData | null; queue: Promise<unknown> } };
const local = (g.__firstshareLocal ??= { data: null, queue: Promise.resolve() });

async function load(): Promise<LocalData> {
  if (local.data) return local.data;
  try {
    local.data = JSON.parse(await readFile(LOCAL_FILE, "utf8")) as LocalData;
  } catch {
    local.data = { challenges: {}, leaderboard: { live: {}, replay: {} } };
  }
  return local.data;
}

async function save(data: LocalData): Promise<void> {
  try {
    await mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    const tmp = `${LOCAL_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data));
    await rename(tmp, LOCAL_FILE);
  } catch (err) {
    // Read-only hosting: keep working from memory (lost on restart).
    console.warn("[challenge] couldn't save local data, keeping it in memory only:", (err as Error).message);
  }
}

/** Run writes one at a time so read-modify-write is safe within this process. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = local.queue.then(fn, fn);
  local.queue = run.catch(() => undefined);
  return run;
}

const clone = <T,>(x: T): T => structuredClone(x);

const localStore: ChallengeStore = {
  kind: "local",
  create(doc) {
    return serial(async () => {
      const data = await load();
      const id = randomBytes(10).toString("hex");
      data.challenges[id] = clone(doc);
      await save(data);
      return id;
    });
  },
  async get(id) {
    const doc = (await load()).challenges[id];
    return doc ? clone(doc) : undefined;
  },
  update(id, fn) {
    return serial(async () => {
      const data = await load();
      const current = data.challenges[id];
      const patch = await fn(current ? clone(current) : undefined);
      if (!data.challenges[id]) throw new Error("Challenge disappeared");
      data.challenges[id] = { ...data.challenges[id], ...patch };
      await save(data);
    });
  },
  finish(id, patch, mode, entry) {
    return serial(async () => {
      const data = await load();
      data.challenges[id] = { ...data.challenges[id], ...patch };
      data.leaderboard[mode][id] = entry;
      await save(data);
    });
  },
  async listByUid(uid) {
    return Object.entries((await load()).challenges)
      .filter(([, d]) => d.uid === uid)
      .map(([id, doc]) => ({ id, doc: clone(doc) }));
  },
  async top(mode, n) {
    return Object.entries((await load()).leaderboard[mode])
      .map(([id, e]) => ({ id, displayName: e.displayName, challengeScore: e.challengeScore, habitsScore: e.habitsScore, finishedAt: e.finishedAt }))
      .sort((a, b) => b.challengeScore - a.challengeScore)
      .slice(0, n);
  },
};

export function challengeStore(): ChallengeStore {
  return firebaseAdminConfigured() ? firestoreStore : localStore;
}
