import "server-only";
import { NextResponse } from "next/server";
import { AuthError, ConfigError } from "@/lib/firebase/admin";
import { UserError } from "./server";

/** Turn thrown errors into JSON responses with a friendly message. */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof UserError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof ConfigError) {
      console.error("[challenge]", err.message);
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[challenge] unexpected error:", err);
    const msg = err instanceof Error && /Alpaca|price data/.test(err.message) ? `Market data problem: ${err.message}` : "Something went wrong on our side.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
