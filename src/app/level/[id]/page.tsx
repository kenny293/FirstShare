import { notFound } from "next/navigation";
import { LevelPlayer } from "@/components/level/LevelPlayer";
import { BENCHMARKS } from "@/lib/content/assets";
import { LEVELS, getLevel } from "@/lib/content/levels";
import { loadMarket } from "@/lib/data";

export function generateStaticParams() {
  return LEVELS.map((l) => ({ id: String(l.id) }));
}

export default async function LevelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const level = getLevel(Number(id));
  if (!level) notFound();
  const market = await loadMarket([...level.assets, ...BENCHMARKS]);
  return <LevelPlayer levelId={level.id} market={market} />;
}
