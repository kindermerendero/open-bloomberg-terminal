# OPNB — Open Bloomberg Terminal

An open-source, Bloomberg-style financial terminal that runs entirely on **free data sources — no API keys required**. Clone it, install, run: it works out of the box.

![status](https://img.shields.io/badge/status-mvp-orange) ![license](https://img.shields.io/badge/license-MIT-green)

## Features

- **Keyboard-driven command line** (Bloomberg style): type `AAPL` + ⏎ to load a security, `HELP` for the full command list
- **Live quotes & candlestick charts** with volume, ranges from 1D to MAX (TradingView lightweight-charts)
- **Watchlist** with auto-refresh, persisted in localStorage (`ADD TSLA`, `DEL TSLA`)
- **Ticker search** with live suggestions (stocks, ETFs, indices, FX, crypto, futures)
- **News feed** — top stories and per-symbol headlines
- **FX monitor** — ECB reference rates
- **Crypto monitor** — top 20 by market cap
- **CAPM analytics** — β and Jensen's α estimated by OLS on 1Y daily returns vs a selectable benchmark, expected return via the Security Market Line, Sharpe ratio (`AAPL CAPM`)
- **Option valuation** — Cox-Ross-Rubinstein binomial lattice (discretization of the GBM/Ito process), European & American exercise, SVG lattice visualization with early-exercise nodes highlighted, Black-Scholes convergence reference (`AAPL OV`)
- **Function keys** F1–F7 to switch panels, CRT-style amber-on-black aesthetic

## Commands

| Command | Action |
|---|---|
| `AAPL`, `^GSPC`, `EURUSD=X`, `BTC-USD` | Load any Yahoo Finance symbol |
| `1D 5D 1M 6M 1Y 5Y MAX` | Chart range |
| `ADD <SYM>` / `DEL <SYM>` | Manage watchlist |
| `<SYM> CAPM` / `CAPM` | CAPM pricing panel |
| `<SYM> OV` / `OV` | Binomial-lattice option pricing |
| `N` / `FX` / `CRY` / `SEC` / `HELP` | Switch panel |
| `F1`–`F7` | Same, via function keys |

## Data sources (all free, no keys)

| Source | Data | Notes |
|---|---|---|
| Yahoo Finance public endpoints | Quotes, OHLCV history, search, per-symbol news | May be delayed 15–20 min depending on exchange |
| [CoinGecko](https://www.coingecko.com/en/api) free API | Crypto top 20 | ~30 req/min limit, cached server-side |
| [Frankfurter](https://www.frankfurter.app/) (ECB) | FX reference rates | Updated daily ~16:00 CET |
| CNBC + Yahoo Finance RSS | Headlines | Cached 2 min |

All external calls are proxied through Next.js API routes (`src/app/api/*`) — no CORS issues, centralized caching, nothing exposed client-side.

## Getting started

```bash
git clone https://github.com/kindermerendero/open-bloomberg-terminal.git
cd open-bloomberg-terminal
npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:3000 and type a ticker.

## Stack

- [Next.js 15](https://nextjs.org/) (App Router) + TypeScript
- [lightweight-charts](https://github.com/tradingview/lightweight-charts) for candlesticks
- [rss-parser](https://github.com/rbren/rss-parser) for news feeds
- Plain CSS — no UI framework

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Bloomberg L.P. "Bloomberg" is referenced solely to describe the style of interface. Data comes from third-party free sources and may be delayed or inaccurate — do not use for actual trading decisions.

## License

MIT
