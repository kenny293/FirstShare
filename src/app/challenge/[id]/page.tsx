import { ChallengeRun } from "@/components/challenge/ChallengeRun";

export default async function ChallengeRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChallengeRun id={id} />;
}
