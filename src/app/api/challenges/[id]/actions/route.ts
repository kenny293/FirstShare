import { requireUser } from "@/lib/firebase/admin";
import { handle } from "@/lib/challenge/http";
import { addAction } from "@/lib/challenge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const user = await requireUser(req);
    await addAction(user, id, await req.json().catch(() => null));
    return { ok: true };
  });
}
