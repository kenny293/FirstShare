"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { GLOSSARY, isTermId, type GlossaryEntry, type TermId } from "@/lib/content/glossary";
import { Sheet } from "./Sheet";

const TermContext = createContext<(id: TermId) => void>(() => {});

export function TermProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<TermId | null>(null);
  const show = useCallback((id: TermId) => setOpen(id), []);
  const entry: GlossaryEntry | null = open ? GLOSSARY[open] : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <TermContext.Provider value={show}>
      {children}
      {entry && (
        <Sheet onClose={() => setOpen(null)} labelledBy="term-title" z={60}>
          <p className="text-xs font-extrabold uppercase tracking-wider text-brand">What does this mean?</p>
          <h2 id="term-title" className="mt-1 text-2xl font-black">{entry.term}</h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-soft">{entry.definition}</p>
          {entry.example && (
            <p className="mt-3 rounded-2xl bg-sun-soft p-4 text-base">{entry.example}</p>
          )}
          <button className="btn-primary mt-6" onClick={() => setOpen(null)}>
            Got it
          </button>
        </Sheet>
      )}
    </TermContext.Provider>
  );
}

/** A tappable finance word that opens a plain-English definition. */
export function Term({ id, children }: { id: TermId; children?: ReactNode }) {
  const show = useContext(TermContext);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        show(id);
      }}
      className="inline cursor-help rounded-sm font-bold text-brand underline decoration-brand/40 decoration-dotted decoration-2 underline-offset-4 hover:decoration-brand"
    >
      {children ?? GLOSSARY[id].term}
    </button>
  );
}

/** Renders a string, turning [[termId]] / [[termId|label]] into tappable terms. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[\[([a-z_0-9]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, id, label] = m;
    parts.push(
      isTermId(id) ? (
        <Term key={m.index} id={id}>{label ?? GLOSSARY[id].term.toLowerCase()}</Term>
      ) : (
        label ?? id
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
