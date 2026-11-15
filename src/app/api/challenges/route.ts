import { requireUser } from "@/lib/firebase/admin";
import { handle } from "@/lib/challenge/http";
import { createChallenge, listMyChallenges } from "@/lib/challenge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => ({ challenges: await listMyChallenges(await requireUser(req)) }));
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    const body = await req.json().catch(() => null);
    return { id: await createChallenge(user, body) };
  });
}
