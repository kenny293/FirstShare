import Link from "next/link";
import { LevelMap } from "@/components/LevelMap";
import { LEVELS } from "@/lib/content/levels";

export default function Home() {
  const levels = LEVELS.map(({ id, title, concept, emoji }) => ({ id, title, concept, emoji }));
  return (
    <div className="pt-8 lg:grid lg:grid-cols-[1fr_1.15fr] lg:items-start lg:gap-16 lg:pt-16">
      <header className="mb-8 text-center lg:sticky lg:top-16 lg:text-left">
        <h1 className="text-3xl font-black tracking-tight lg:text-6xl">FirstShare</h1>
        <p className="mx-auto mt-2 max-w-xs text-ink-soft lg:mx-0 lg:mt-4 lg:max-w-md lg:text-xl">
          Learn investing by playing through real market history, with fake money and a friendly coach.
        </p>
        <ul className="mt-10 hidden space-y-5 lg:block">
          {[
            ["Real history, fake money", "Invest $1,000 through real market periods with names and dates hidden until the end."],
            ["Scored on habits, not profit", "Your Habits Score rewards spreading out, staying calm and keeping fees low."],
            ["Skill or luck?", "We replay your exact mix from 10 other start dates to show whether it was a good plan or a lucky one."],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-4">
              <span className="mt-2 size-2.5 shrink-0 rounded-full bg-brand" />
              <div>
                <p className="text-lg font-black">{title}</p>
                <p className="text-ink-soft">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </header>
      <div>
        <LevelMap levels={levels} />
        <Link
          href="/challenge"
          className="mt-8 flex items-center gap-4 rounded-3xl bg-paper p-5 ring-2 ring-sun/30 transition active:translate-y-0.5"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sun-soft text-2xl">🏁</span>
          <span className="min-w-0">
            <span className="block text-xs font-extrabold uppercase tracking-wide text-sun">New · live market</span>
            <span className="block text-lg font-black leading-tight">Steady Hands Challenge</span>
            <span className="block text-sm text-ink-soft">14 days on real prices, scored on discipline, not luck.</span>
          </span>
          <span className="ml-auto text-xl text-ink-faint">→</span>
        </Link>
      </div>
    </div>
  );
}
