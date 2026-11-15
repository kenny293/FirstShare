import { requireUser } from "@/lib/firebase/admin";
import { handle } from "@/lib/challenge/http";
import { finishChallenge } from "@/lib/challenge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    await finishChallenge(await requireUser(req), id);
    return { ok: true };
  });
}
