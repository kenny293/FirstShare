"use client";

/** Last-resort error screen (used if the root layout itself fails). */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#000", color: "#fff", padding: 24, textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <pre style={{ whiteSpace: "pre-wrap", textAlign: "left", background: "#1c1c1e", color: "#aeaeb2", padding: 16, borderRadius: 16, fontSize: 12 }}>
          {error.message || String(error)}
        </pre>
        <button
          style={{ padding: "14px 24px", borderRadius: 16, border: 0, background: "#fa114f", color: "#fff", fontWeight: 800, fontSize: 16 }}
          onClick={() => {
            try {
              localStorage.removeItem("firstshare.progress.v1");
            } catch {}
            window.location.href = "/";
          }}
        >
          Reset progress &amp; reload
        </button>
      </body>
    </html>
  );
}
