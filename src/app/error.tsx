"use client";

import { useEffect } from "react";
import { resetProgress } from "@/lib/progress";

/** Friendly error screen that also shows the real error for debugging. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[FirstShare] client error:", error);
  }, [error]);

  return (
    <div className="pt-16 text-center">
      <p className="text-5xl">🙈</p>
      <h1 className="mt-4 text-2xl font-black">Something went wrong</h1>
      <p className="mt-2 text-ink-soft">Sorry about that. Try again, or reset your saved progress.</p>
      <pre className="mt-6 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-paper p-4 text-left text-xs text-ink-soft ring-1 ring-line">
        {error.message || String(error)}
        {error.digest ? `\n(digest ${error.digest})` : ""}
      </pre>
      <div className="mt-6 space-y-3">
        <button className="btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <button
          className="btn-secondary"
          onClick={() => {
            resetProgress();
            window.location.href = "/";
          }}
        >
          Reset progress &amp; reload
        </button>
      </div>
    </div>
  );
}
