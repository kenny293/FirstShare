# FirstShare 🌱

An educational investing simulator for complete beginners. Players learn by playing short levels with **fake money on historical market data**, guided by an AI coach. The app rewards **good habits, not lucky gambles**.

> Educational simulation. Not financial advice.

## Quick start

```bash
npm install
cp .env.example .env.local     # add GEMINI_API_KEY (optional; the coach falls back to pre-written tips without it)
npm run dev                    # http://localhost:3000
```

The app ships with **placeholder price data**, so it runs straight away. To get real prices:

```bash
pip install yfinance pandas
npm run data:fetch             # = python scripts/fetch-data.py  → writes /data/{ticker}.json
```

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve |
| `npm test` | Vitest unit + integration tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run data:fetch` | Download real daily closes (2000–present) with yfinance |
| `npm run data:sample` | Regenerate the placeholder data |

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS v4, Recharts, Google Gemini via `@google/genai` (server route only), localStorage for progress, static JSON price files in `/data`.

## How a level works

1. **Intro**: the scenario plus 2–3 key terms.
2. **Simulation**: split $1,000 across a small menu, then time fast-forwards on an animated chart. At 2–3 **decision points** it pauses, and the player picks an action and writes *why*.
3. **Coach**: the Habits Score (headline), final value, and a lucky/skilled label. The actual numbers and the player's reasoning go to Gemini for a short explanation.
4. **Reveal**: real names and dates, the result vs **VOO** and **QQQM**, and the **skill-vs-luck** replay: the same starting mix from 10 historical start dates vs VOO.
5. **Takeaway**: a one-line lesson and 2 multiple-choice questions. Answering both correctly unlocks the next level.

**Blind mode:** during the simulation, tickers become generic labels ("Company C: giant industrial company") and dates become "Year 2, Month 6".

### Levels

| # | Title | Concept | Period |
|---|---|---|---|
| 1 | All eggs in one basket | Diversification | Jan 2016 – Dec 2019 (GE collapses while the market rises) |
| 2 | The crash | Volatility | Oct 2007 – Dec 2010 (sell / hold / buy more at the March 2009 bottom) |
| 3 | Fee monsters | Fees | Jan 2010 – Dec 2019 (fictional 1% and 2% fee "twins" of the whole-market fund; "switch to the low-fee twin" decision) |
| 4 | Chasing hype | Hype & bubbles | Jan 2000 – Dec 2005 (dot-com bust; chasing can pile into the tech fund at its March 2000 peak) |

Level 4 predates VTI and BND, so its broad fund ("Fund 6: Top 500") is the S&P 500 series from `data/VOO.json` (SPY before 2010) and there's no bond fund.

Levels are plain data in [src/lib/content/levels.ts](src/lib/content/levels.ts). Add one there and it appears on the map.

## Habits Score (0–100)

Computed in plain TypeScript ([src/lib/engine/scoring.ts](src/lib/engine/scoring.ts)). **Profit is never an input.**

| Part | Points | Measures |
| --- | --- | --- |
| Diversification | 50 | Breadth (number of meaningful holdings; a broad fund counts as 5) + largest single-company exposure (money in a one-industry fund counts as 40% of that much in one company). Time-weighted across the sim. |
| Composure | 30 | Loses points for selling ≥25% after a ≥15% drop (panic selling) and for going all-in on the hottest stock (chasing hype). |
| Fees | 20 | Time-weighted expense ratio: 0% scores 20, 1%+ scores 0. |

Outcome labels: **lucky** (made money with a concentrated/hype strategy), **risky** (lost money with one), **shaky** (sensible mix, but panic sold or paid high fees), **skilled** / **unlucky** (no mistakes; made / lost money).

## AI coach

[src/app/api/coach/route.ts](src/app/api/coach/route.ts) calls Gemini **server-side only** (`GEMINI_API_KEY` is never sent to the browser) with structured JSON output:
`{ feedback, mistake_type: "concentration" | "panic_selling" | "chasing_hype" | "high_fees" | "none", encouragement }`.

- All math is done in code beforehand. Gemini only explains.
- `mistake_type` is forced to match what the code detected.
- If the key is missing, the call fails or times out (12s), or the output is invalid, it falls back to a pre-written message per mistake type ([src/lib/content/coachFallbacks.ts](src/lib/content/coachFallbacks.ts)).
- Model defaults to `gemini-3.8-flash` (override with `GEMINI_MODEL`). If it is busy (503/429) the route retries once, then tries `GEMINI_BACKUP_MODEL` if set. Run `npm run gemini:models` to see which models your key can use.

## Steady Hands Challenge (live market, Firebase + Alpaca)

A 14-day challenge at `/challenge` on **real daily prices** with $1,000 of practice money. It's scored on discipline, never on profit, and ends with a **luck reveal**: your return compared with 1,000 random portfolios over the same days.

- **Day 0:** pick a mix, choose your own rules ("I won't sell just because prices dropped", ...), and guess a range for your final value.
- **Check-ins:** a midway check-in, plus the first two days the S&P 500 moves ≥1.2% down or ≥1.5% up (3 at most). Holding is always an option.
- **Challenge Score (0–100):** Habits Score × 0.6 (60) + kept your rules (15) + low trading (10) + answered check-ins (10) + realistic guess (5). Profit is never an input. Over 14 days, selling 25%+ after a ≥1% dip counts as panic selling.
- **Modes:** *live* (14 calendar days; any change uses the latest close, so you can't trade on the past) and *replay* (the last 10 trading days played back in about 2 minutes, for demos). Each has its own leaderboard, ranked by Challenge Score.
- **$10 commitment deposit: mock only.** No payment is taken. It's "refunded" for a score ≥70 with every check-in answered and every rule kept, and otherwise "donated" to financial-literacy education.

### How it's built
- **Auth:** Firebase Auth in the browser (Google, email/password, guest). That's the only Firebase code the browser runs.
- **Storage:** Firestore, accessed **only by the server** through the Admin SDK after verifying the user's ID token. [firestore.rules](firestore.rules) denies all browser access, so scores and leaderboard entries can't be tampered with. Collections: `challenges`, `leaderboard_live`, `leaderboard_replay`.
- **Prices:** [src/lib/market/provider.ts](src/lib/market/provider.ts) fetches daily bars from the **Alpaca Market Data API** (IEX feed on the free plan; keys stay on the server, cached for 5 minutes). Without Alpaca keys it falls back to the local `/data` files and says so on screen.
- **Logic:** [src/lib/challenge/logic.ts](src/lib/challenge/logic.ts) (pure and unit-tested) reuses the level engine for simulation and the Habits Score.

### Set it up for real
1. **Firebase:** create a project at console.firebase.google.com.
   - Authentication → Sign-in method: enable **Google**, **Email/Password** and **Anonymous**.
   - Firestore Database → create a database.
   - Add a **Web app** and copy its config into the `NEXT_PUBLIC_FIREBASE_*` variables in `.env`.
   - Project settings → Service accounts → **Generate new private key**, then put the JSON on one line in `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit it.
   - Deploy the locked-down rules: `npx firebase deploy --only firestore:rules --project <your-project-id>`.
   - When you deploy the site, add its domain under Authentication → Settings → Authorized domains (needed for Google sign-in).
2. **Alpaca:** sign up at alpaca.markets (free) and create API keys. Set `ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY`, then check them with `npm run alpaca:test`.
3. `npm run dev` and open `/challenge`.

### Try it locally with no accounts (Firebase emulators)
```bash
npm run emulators        # terminal 1 (needs Java 11+; first run downloads the emulators)
npm run dev:emulated     # terminal 2, uses a separate build folder (.next-emulated)
```
Guest and email sign-in work against the emulators. Google sign-in shows the emulator's fake account picker.

## Data notes

- Prices are **dividend- and split-adjusted** closes, so returns include dividends. Real fund prices already include their expense ratios, so fees are not deducted twice.
- **VOO** launched in 2010 and **QQQM** in 2020. For earlier dates, `fetch-data.py` splices in **SPY** / **QQQ** returns (same indexes) and records this in each file's `note`.
- The "Star Picker" active fund is **fictional**: the whole-market fund minus a 1%/yr fee, to teach the cost of fees.
- The client gets **weekly** closes (prerendered into each level page at build time). Rebuild after fetching new data.

## Project layout

```
data/                  price JSON per ticker (placeholder until fetch-data.py runs)
scripts/               fetch-data.py (yfinance), generate-sample-data.mjs
src/lib/engine/        pure TS: market alignment, simulation, scoring, skill-vs-luck (+ tests)
src/lib/content/       levels, assets (blind labels), glossary, coach fallbacks
src/lib/coach.ts       prompt, schema, validation, sanitizing
src/components/level/  the level screens (intro → allocate → sim → results → reveal → takeaway)
src/lib/challenge/      live challenge: config, pure logic (+ tests), server service, API helpers
src/lib/firebase/       client (Auth only) + admin (token checks, Firestore)
src/lib/market/         Alpaca daily bars, with a local /data fallback
src/components/challenge/ hub, plan builder, live dashboard, replay player, results, leaderboard
```
