import { requireUser } from "@/lib/firebase/admin";
import { handle } from "@/lib/challenge/http";
import { getChallengeView } from "@/lib/challenge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => getChallengeView(await requireUser(req), id));
}
