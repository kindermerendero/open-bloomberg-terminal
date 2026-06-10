# Open Bloomberg Terminal

Terminale finanziario open source stile Bloomberg, web-based, collegato esclusivamente a fonti dati gratuite senza API key.

## Stack
- Next.js 15 (App Router) + TypeScript
- lightweight-charts (TradingView OSS) per i grafici candlestick
- rss-parser per il feed news
- CSS custom (niente framework) — estetica Bloomberg: sfondo nero, testo ambra, layout denso

## Fonti dati (tutte gratuite, nessuna API key)
- **Yahoo Finance** (endpoint pubblici `query1.finance.yahoo.com`) — quote, storico OHLCV, ricerca ticker
- **CoinGecko API free** — criptovalute
- **Frankfurter.app** (dati BCE) — cambi FX
- **RSS** (Yahoo Finance, CNBC, Investing.com) — news

Tutte le chiamate esterne passano dalle API route Next.js (`src/app/api/*`) per evitare CORS e centralizzare caching/rate-limit.

## Comandi principali
- `npm run dev` — dev server su localhost:3000
- `npm run build` — build produzione
- `npm install --legacy-peer-deps` — installazione dipendenze

## Convenzioni
- Standard: pragmatico (progetto personale open source)
- UI keyboard-driven: barra comandi stile Bloomberg (es. `AAPL GP` = grafico, `AAPL DES` = descrizione, `N` = news, `FX`, `CRY`, `HELP`)
- Nessuna API key richiesta: il progetto deve funzionare con `git clone && npm install && npm run dev`

## Note operative
- Gli endpoint Yahoo v7/quoteSummary richiedono crumb/cookie → NON usarli; usare solo `v8/finance/chart` (meta + OHLCV) e `v1/finance/search`
- CoinGecko free tier: ~30 req/min → cache lato server 60s
