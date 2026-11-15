#!/usr/bin/env python3
"""
Download daily closing prices (2000-present) for FirstShare and save them to
/data/{ticker}.json.

Usage:
    pip install yfinance pandas
    python scripts/fetch-data.py

Output format (one file per ticker):
    {
      "ticker": "VOO",
      "source": "yfinance",
      "adjusted": true,
      "generated": "2026-01-01",
      "note": "...",
      "prices": [["2000-01-03", 93.12], ...]
    }

Notes
-----
* Prices are dividend- and split-adjusted closes (auto_adjust=True), so a
  buy-and-hold simulation reflects total return. Fund prices already have
  their expense ratios baked in, so the simulator does NOT subtract fees from
  real funds a second time.
* VOO launched 2010-09-09 and QQQM launched 2020-10-13. The app uses them as
  benchmarks for periods before they existed (e.g. 2007-2010), so before each
  launch date we splice in the daily returns of a fund tracking the same index:
    VOO  <- SPY (S&P 500)
    QQQM <- QQQ (Nasdaq-100)
  The splice is documented in each file's "note" field.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

try:
    import pandas as pd
    import yfinance as yf
except ImportError:  # pragma: no cover
    sys.exit("Missing dependencies. Run: pip install yfinance pandas")

START = "2000-01-01"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

TICKERS = ["VTI", "VOO", "QQQ", "BND", "AAPL", "MSFT", "GE", "C", "F", "XOM"]
# Helper series used only for back-filling the benchmark funds.
EXTRA_TICKERS = ["SPY", "QQQM"]
SPLICES = {
    # output ticker: (proxy ticker, reason)
    "VOO": ("SPY", "VOO launched 2010-09-09; earlier dates use SPY daily returns (same S&P 500 index)."),
    "QQQM": ("QQQ", "QQQM launched 2020-10-13; earlier dates use QQQ daily returns (same Nasdaq-100 index)."),
}


def download_closes(tickers: list[str]) -> pd.DataFrame:
    df = yf.download(
        tickers,
        start=START,
        auto_adjust=True,
        progress=False,
        group_by="column",
        threads=True,
    )
    if df is None or df.empty:
        sys.exit("yfinance returned no data. Check your internet connection.")
    closes = df["Close"]
    if isinstance(closes, pd.Series):  # single ticker
        closes = closes.to_frame(tickers[0])
    return closes


def splice(primary: pd.Series, proxy: pd.Series) -> pd.Series:
    """Back-fill `primary` before its first valid date using `proxy` returns."""
    primary = primary.dropna()
    proxy = proxy.dropna()
    first = primary.index[0]
    if proxy.index[0] >= first:
        return primary
    anchor_proxy = proxy.loc[:first].iloc[-1]
    scale = primary.iloc[0] / anchor_proxy
    before = proxy.loc[proxy.index < first] * scale
    return pd.concat([before, primary]).sort_index()


def to_records(series: pd.Series) -> list[list]:
    series = series.dropna()
    return [[idx.strftime("%Y-%m-%d"), round(float(val), 4)] for idx, val in series.items()]


def write(ticker: str, series: pd.Series, note: str = "") -> None:
    payload = {
        "ticker": ticker,
        "source": "yfinance",
        "adjusted": True,
        "generated": date.today().isoformat(),
        "note": note,
        "prices": to_records(series),
    }
    out = DATA_DIR / f"{ticker}.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"  {ticker:5s} {len(payload['prices']):5d} days  "
          f"{payload['prices'][0][0]} -> {payload['prices'][-1][0]}  {note}")


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    all_tickers = TICKERS + EXTRA_TICKERS
    print(f"Downloading {', '.join(all_tickers)} from {START} ...")
    closes = download_closes(all_tickers)

    for ticker in TICKERS + ["QQQM"]:
        if ticker not in closes.columns or closes[ticker].dropna().empty:
            print(f"  WARNING: no data for {ticker}; keeping existing file")
            continue
        series = closes[ticker]
        note = ""
        if ticker in SPLICES:
            proxy, note = SPLICES[ticker]
            series = splice(series, closes[proxy])
        write(ticker, series, note)

    print(f"Done. Files written to {DATA_DIR}")


if __name__ == "__main__":
    main()
