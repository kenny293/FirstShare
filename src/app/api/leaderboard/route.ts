import { handle } from "@/lib/challenge/http";
import { getLeaderboard } from "@/lib/challenge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("mode") === "replay" ? "replay" : "live";
  return handle(async () => ({ mode, entries: await getLeaderboard(mode) }));
}
