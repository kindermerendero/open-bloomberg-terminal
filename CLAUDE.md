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
- **Treasury.gov** (CSV pubblico daily par yield) — struttura a termine Treasury USA
- **BCE Data Portal** (SDMX `data-api.ecb.europa.eu`, dataflow `YC`) — struttura a termine area euro (curva AAA spot rate)
- **SEC EDGAR** (`data.sec.gov` XBRL companyfacts + `sec.gov/files/company_tickers.json`) — fundamentals USA (EPS, equity, ROE, payout) per il modulo equity valuation
- **RSS** (Yahoo Finance, CNBC, Investing.com) — news

Tutte le chiamate esterne passano dalle API route Next.js (`src/app/api/*`) per evitare CORS e centralizzare caching/rate-limit.

## Comandi principali
- `npm run dev` — dev server su localhost:3000
- `npm run build` — build produzione
- `npm install --legacy-peer-deps` — installazione dipendenze

## Convenzioni
- Standard: pragmatico (progetto personale open source)
- UI keyboard-driven: barra comandi stile Bloomberg (es. `AAPL GP` = grafico, `AAPL DES` = descrizione, `N` = news, `FX`, `CRY`, `HELP`).
- **Modulo Tiburzi (scienza degli investimenti)** — analytics: `AAPL CAPM` (F6), `AAPL OV` (F7), `MKWZ AAPL,MSFT,NVDA` frontiera Markowitz (F8, toggle short selling ALLOWED/LONG ONLY), `BOND`/`YC` struttura a termine (US Treasury / area euro BCE, scrubber data, overlay confronto 1M/1Y, animazione playback, storico spread 10Y–2Y) + calcolatore bond (F9)
- **Modulo Barchiesi (finanza aziendale)** — corporate finance: `AAPL EQV` (F10) equity valuation (DDM Gordon + 2-stadi, PVGO, multipli; auto-fill da SEC + costo del capitale via CAPM), `MNA` sinergie/VAN acquisizione, `RGT` aumento di capitale a pagamento + buyback, `IPO` bookbuilding/underpricing/greenshoe, `OPA` tender offer (soglie 30%/90%, premio, difese)
- Nessuna API key richiesta: il progetto deve funzionare con `git clone && npm install && npm run dev`

## Note operative
- Gli endpoint Yahoo v7/quoteSummary richiedono crumb/cookie → NON usarli; usare solo `v8/finance/chart` (meta + OHLCV) e `v1/finance/search`
- **Yahoo 429**: usare SOLO header minimali (`User-Agent: Mozilla/5.0`, `Accept: */*`) — UA browser completi vengono rifiutati perché il fingerprint TLS di Node non corrisponde. Fallback host query2→query1 in `src/lib/yahoo.ts` (yahooFetch)
- CoinGecko free tier: ~30 req/min → cache lato server 60s
- **SEC EDGAR**: richiede `User-Agent` descrittivo con contatto (no key). Flusso: `company_tickers.json` (ticker→CIK, cache 24h, mappa in memoria) → `companyfacts/CIK{10cifre}.json` (cache 1h). Annuali = entry `form=10-K` con durata ~365gg; istantanee (equity/shares) = ultima per data. Solo filer USA: ticker non-USA → `source:none`, ma i dividendi TTM arrivano comunque da Yahoo (`v8/finance/chart?events=div`). ROE può superare 100% (es. AAPL, equity erosa dai buyback) → `EquityValuationPanel` clampa la crescita sostenibile
- **BCE (area euro)**: ECB Data Portal SDMX, dataflow `YC`, chiave `B.U2.EUR.4F.G_N_A.SV_C_YM.SR_<tenor>` (curva AAA, modello Svensson, spot rate). Multi-tenor con `+` in una sola richiesta, `?startPeriod=YYYY-MM-DD&format=csvdata`. Tenor disponibili: 3M,6M,9M,1Y,2Y,3Y,5Y,7Y,10Y,20Y,30Y (no 1M). `OBS_VALUE`=rendimento, `DATA_TYPE_FM`=tenor, `TIME_PERIOD`=data. Header minimali, cache 1h
- **Treasury.gov**: CSV daily par yield su `.../daily-treasury-rates.csv/<anno>/all?type=daily_treasury_yield_curve&...&_format=csv` — header con colonne quotate (`"1 Mo"…"30 Yr"`), prima riga dati = giorno più recente. Header minimali (`User-Agent: Mozilla/5.0`). `/api/treasury` fa fallback all'anno precedente se il CSV dell'anno corrente è vuoto (inizio gennaio). Cache 1h
- Repo GitHub: https://github.com/kindermerendero/open-bloomberg-terminal (pubblico, MIT)

## Deploy
- **Vercel** (piattaforma naturale, Next.js 15 App Router): deploy zero-config, nessuna API key/env. `vercel.json` imposta region `fra1` e `maxDuration: 30s` sulle API route. Produzione: https://open-bloomberg-terminal.vercel.app — deploy via `vercel --prod`
- Attenzione: gli IP datacenter di Vercel sono più esposti ai 429 di Yahoo che l'IP residenziale locale → verificare in produzione colpendo `/api/quote?symbol=AAPL` ripetutamente. Se i 429 diventano sistematici, valutare proxy/cache più aggressiva (Vercel KV)
