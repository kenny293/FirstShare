"use client";

import { useState } from "react";
import { authErrorMessage, useAuth } from "./AuthProvider";

export function SignInCard({ title = "Sign in to start", subtitle }: { title?: string; subtitle?: string }) {
  const { configured, signInGoogle, signInEmail, signUpEmail, signInGuest } = useAuth();
  const [mode, setMode] = useState<"choose" | "signin" | "signup">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <section className="card space-y-3">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-ink-soft">Jump straight in as a guest. No account needed.</p>
        </div>
        <button className="btn-primary" disabled={busy} onClick={() => run(signInGuest)}>
          👤 Play as a guest
        </button>
        <p className="text-xs text-ink-faint">
          Your challenges are saved to this browser&apos;s guest ID. Google and email accounts appear once Firebase is set up (see the README).
        </p>
        {error && <p className="rounded-2xl bg-coral-soft p-3 text-sm font-bold">{error}</p>}
      </section>
    );
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-xl font-black">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>

      {mode === "choose" ? (
        <>
          <button className="btn-secondary" disabled={busy} onClick={() => run(signInGoogle)}>
            <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => setMode("signin")}>
            ✉️ Use email &amp; password
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => run(signInGuest)}>
            👤 Try as a guest
          </button>
          <p className="text-xs text-ink-faint">Guests can play right away. Your challenges stay on this device&apos;s guest account.</p>
        </>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => (mode === "signup" ? signUpEmail(email, password, name) : signInEmail(email, password)));
          }}
        >
          {mode === "signup" && (
            <input
              className="w-full rounded-2xl bg-cream p-4 ring-2 ring-line outline-none focus:ring-brand"
              placeholder="Display name (shown on the leaderboard)"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="w-full rounded-2xl bg-cream p-4 ring-2 ring-line outline-none focus:ring-brand"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-2xl bg-cream p-4 ring-2 ring-line outline-none focus:ring-brand"
            type="password"
            placeholder="Password (6+ characters)"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn-primary" disabled={busy} type="submit">
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm font-bold text-ink-soft">
            <button type="button" className="underline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
              {mode === "signup" ? "I already have an account" : "Create an account"}
            </button>
            <button type="button" className="underline" onClick={() => setMode("choose")}>
              Back
            </button>
          </div>
        </form>
      )}
      {error && <p className="rounded-2xl bg-coral-soft p-3 text-sm font-bold">{error}</p>}
    </section>
  );
}
