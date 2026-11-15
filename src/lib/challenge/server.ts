import "server-only";
import type { AuthedUser } from "@/lib/firebase/admin";
import type { DecisionAction, Market } from "@/lib/engine/types";
import { getDailyBars } from "@/lib/market/provider";
import { CHALLENGE, CHALLENGE_TICKERS } from "./config";
import { challengeStore } from "./store";
import { addDays, buildChallengeMarket, challengeWindow, detectEvents, parsePlan, scoreChallenge, VALID_ACTIONS } from "./logic";
import type { ChallengeAction, ChallengeDoc, ChallengeMode, ChallengeView, LeaderboardEntry } from "./types";

export class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}


const today = () => new Date().toISOString().slice(0, 10);

async function marketFrom(start: string): Promise<{ market: Market; source: string }> {
  const { series, source } = await getDailyBars(CHALLENGE_TICKERS, start);
  return { market: buildChallengeMarket(series), source };
}

/** Index of the last day a live challenge can use (today's data, capped at the end date). */
function lastUsableIdx(market: Market, doc: ChallengeDoc): number {
  const w = challengeWindow(market, doc);
  return doc.mode === "replay" ? w.endIdx : Math.min(market.dates.length - 1, w.endIdx);
}

function canFinish(market: Market, doc: ChallengeDoc): boolean {
  if (doc.status !== "active") return false;
  if (doc.mode === "replay") return true;
  const latest = market.dates[market.dates.length - 1];
  return latest >= doc.endDate || today() > doc.endDate;
}

export async function createChallenge(user: AuthedUser, body: unknown): Promise<string> {
  const b = (body ?? {}) as Record<string, unknown>;
  const mode: ChallengeMode = b.mode === "live" ? "live" : "replay";
  const plan = parsePlan(b.plan);
  if (typeof plan === "string") throw new UserError(plan);

  const { market, source } = await marketFrom(addDays(today(), -40));
  const n = market.dates.length;
  if (n < CHALLENGE.replayTradingDays + 1) throw new UserError("Not enough recent price data to start a challenge", 503);
  const latest = market.dates[n - 1];
  const startDate = mode === "live" ? latest : market.dates[n - 1 - CHALLENGE.replayTradingDays];
  const endDate = mode === "live" ? addDays(latest, CHALLENGE.calendarDays) : latest;

  const now = new Date().toISOString();
  const doc: ChallengeDoc = {
    uid: user.uid,
    displayName: user.displayName,
    mode,
    status: "active",
    startDate,
    endDate,
    plan,
    actions: [],
    deposit: { status: b.deposit === true ? "paid_mock" : "none", amount: b.deposit === true ? CHALLENGE.depositAmount : 0 },
    dataSource: source,
    createdAt: now,
    updatedAt: now,
  };
  return challengeStore().create(doc);
}

async function loadOwned(user: AuthedUser, id: string): Promise<ChallengeDoc> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) throw new UserError("Challenge not found", 404);
  const doc = await challengeStore().get(id);
  if (!doc || doc.uid !== user.uid) throw new UserError("Challenge not found", 404);
  return doc;
}

export async function getChallengeView(user: AuthedUser, id: string): Promise<ChallengeView> {
  const doc = await loadOwned(user, id);
  const { market, source } = await marketFrom(doc.startDate);
  const w = challengeWindow(market, doc);
  const last = lastUsableIdx(market, doc);
  const lastDate = market.dates[last];
  const series = Object.fromEntries(
    Object.entries(market.prices).map(([sym, arr]) => [
      sym,
      market.dates.slice(w.startIdx, last + 1).map((d, i) => [d, Math.round(arr[w.startIdx + i] * 10000) / 10000] as [string, number]),
    ]),
  );
  return {
    id,
    challenge: doc,
    series,
    events: detectEvents(market, w.startIdx, last),
    latestDate: lastDate,
    canFinish: canFinish(market, doc),
    dataSource: source,
  };
}

export async function addAction(user: AuthedUser, id: string, body: unknown): Promise<void> {
  const b = (body ?? {}) as Record<string, unknown>;
  const action = b.action as DecisionAction;
  if (!VALID_ACTIONS.includes(action)) throw new UserError("Unknown action");
  const reasoning = typeof b.reasoning === "string" ? b.reasoning.trim().slice(0, 500) : "";
  if (reasoning.length < 3) throw new UserError("Write a few words about why");

  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) throw new UserError("Challenge not found", 404);
  await challengeStore().update(id, async (doc) => {
    if (!doc || doc.uid !== user.uid) throw new UserError("Challenge not found", 404);
    if (doc.status !== "active") throw new UserError("This challenge is finished");

    const { market } = await marketFrom(doc.startDate);
    const w = challengeWindow(market, doc);
    const last = lastUsableIdx(market, doc);
    const events = detectEvents(market, w.startIdx, last);

    // Live: actions use the latest available close (no acting on the past).
    // Replay: the client is playing back the window and sends the day it's on.
    let date: string;
    if (doc.mode === "live") {
      date = market.dates[last];
    } else {
      date = typeof b.date === "string" ? b.date : "";
      const idx = market.dates.indexOf(date);
      if (idx <= w.startIdx || idx > w.endIdx) throw new UserError("That day isn't part of this challenge");
      const lastActed = doc.actions.reduce((m, a) => (a.date > m ? a.date : m), "");
      if (date < lastActed) throw new UserError("You can't go back in time");
    }
    if (date <= doc.startDate) throw new UserError("Day 0 is your plan. Changes start from day 1.");

    let eventDate: string | undefined;
    if (typeof b.eventDate === "string") {
      if (!events.some((e) => e.date === b.eventDate)) throw new UserError("Unknown check-in");
      if (doc.actions.some((a) => a.eventDate === b.eventDate)) throw new UserError("You already answered that check-in");
      if (doc.mode === "replay" && b.eventDate !== date) throw new UserError("Answer the check-in on its own day");
      eventDate = b.eventDate;
    }
    if (action !== "hold" && doc.actions.some((a) => a.date === date && a.action !== "hold")) {
      throw new UserError("You've already made a change on this day. One change per day.");
    }

    const entry: ChallengeAction = { date, action, reasoning, createdAt: new Date().toISOString(), ...(eventDate ? { eventDate } : {}) };
    return { actions: [...doc.actions, entry], updatedAt: entry.createdAt };
  });
}

export async function finishChallenge(user: AuthedUser, id: string): Promise<void> {
  const doc = await loadOwned(user, id);
  if (doc.status !== "active") return;
  const { market } = await marketFrom(doc.startDate);
  if (!canFinish(market, doc)) throw new UserError(`This challenge runs until ${doc.endDate}. Check back then!`);
  const w = challengeWindow(market, doc);
  const events = detectEvents(market, w.startIdx, w.endIdx);
  const result = scoreChallenge(market, w, doc, events, id);
  const deposit =
    doc.deposit.status === "paid_mock"
      ? { ...doc.deposit, status: result.depositRefunded ? ("refunded_mock" as const) : ("donated_mock" as const) }
      : doc.deposit;

  const entry: Omit<LeaderboardEntry, "id"> & { uid: string } = {
    uid: doc.uid,
    displayName: doc.displayName,
    challengeScore: result.challengeScore,
    habitsScore: result.habits.total,
    finishedAt: result.finishedAt,
  };
  await challengeStore().finish(id, { status: "finished", result, deposit, updatedAt: result.finishedAt }, doc.mode, entry);
}

export async function listMyChallenges(user: AuthedUser) {
  const rows = await challengeStore().listByUid(user.uid);
  return rows
    .map(({ id, doc: c }) => {
      return {
        id,
        mode: c.mode,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        challengeScore: c.result?.challengeScore ?? null,
        createdAt: c.createdAt,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLeaderboard(mode: ChallengeMode): Promise<LeaderboardEntry[]> {
  return challengeStore().top(mode, 20);
}
