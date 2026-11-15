"use client";

import { GLOSSARY } from "@/lib/content/glossary";
import type { LevelDef } from "@/lib/content/levels";
import { RichText, Term } from "../Term";

export function IntroScreen({ level, onNext }: { level: LevelDef; onNext: () => void }) {
  return (
    <div className="animate-rise flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:pt-4">
      <div className="contents lg:flex lg:flex-col lg:gap-5">
      <div className="order-1 text-center lg:text-left">
        <div className="mx-auto grid size-20 place-items-center lg:mx-0 rounded-[1.75rem] bg-brand-soft text-4xl">{level.emoji}</div>
        <p className="mt-4 text-sm font-extrabold uppercase tracking-wider text-brand">
          Level {level.id} · <Term id={level.conceptTerm}>{level.concept}</Term>
        </p>
        <h1 className="mt-1 text-3xl font-black lg:text-5xl">{level.title}</h1>
      </div>

      <section className="card order-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-faint">The scenario</h2>
        <p className="mt-2 text-lg leading-relaxed">
          <RichText text={level.intro.scenario} />
        </p>
        <p className="mt-4 rounded-2xl bg-sun-soft p-4 font-bold">🎯 {level.intro.goal}</p>
      </section>

      {level.blind && (
        <section className="order-4 flex gap-3 rounded-3xl bg-sky-soft p-4">
          <span className="text-2xl">🙈</span>
          <p className="text-sm leading-relaxed">
            <b>Blind mode.</b> Real dates and company names are hidden until the end, so you have to decide like
            people did at the time, without knowing what happens next.
          </p>
        </section>
      )}

      <button className="btn-primary order-5" onClick={onNext}>
        Let&apos;s invest $1,000 →
      </button>
      </div>

      <section className="order-3 lg:sticky lg:top-24">
        <h2 className="mb-3 px-1 text-sm font-extrabold uppercase tracking-wide text-ink-faint">Key words</h2>
        <ul className="space-y-3">
          {level.intro.terms.map((id) => (
            <li key={id} className="card !p-4">
              <p className="text-lg font-black text-brand">{GLOSSARY[id].term}</p>
              <p className="mt-1 leading-relaxed text-ink-soft">{GLOSSARY[id].definition}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 px-1 text-sm text-ink-soft">
          Tip: tap any <Term id="portfolio">underlined word</Term> to see what it means.
        </p>
      </section>
    </div>
  );
}
