# Changelog

## [2026-06-17] — Config deploy Vercel
- Aggiunto `vercel.json`: region `fra1` (Francoforte, vicina a endpoint EU e bassa latenza), `maxDuration: 30s` sulle API route per assorbire la lentezza di Yahoo/RSS e il fallback host `query2→query1` senza timeout (default 10s troppo stretto sui cold start)
- Deploy zero-config: nessuna API key né variabile d'ambiente richiesta
- Rischio noto: gli IP datacenter condivisi di Vercel sono più esposti ai 429 di Yahoo rispetto all'IP residenziale in locale; la cache news in-memory (`Map` in `/api/news`) non persiste tra invocazioni serverless ma degrada con grazia

## [2026-06-10] — Analytics: CAPM e reticoli binomiali (Ito/CRR)
- Nuovo modulo `src/lib/quant.ts`: rendimenti log, allineamento serie per data, statistiche CAPM (β/α di Jensen via OLS su rendimenti giornalieri 1Y, R², Sharpe), Black-Scholes con normCdf Abramowitz-Stegun, pricing binomiale CRR (u=e^(σ√Δt), d=1/u, q risk-neutral) con esercizio europeo/americano e flag early exercise per nodo
- Pannello CAPM (`F6`, `AAPL CAPM`): benchmark selezionabile (S&P 500, NASDAQ, FTSE MIB…), rf di default dal T-bill 13 settimane (^IRX), verdetto posizione vs SML
- Pannello Option Valuation (`F7`, `AAPL OV`): reticolo binomiale disegnato in SVG fino a 8 step (prezzo sottostante + valore opzione per nodo, rosso se early exercise ottimale), prezzo a N=500 e Black-Scholes come riferimento di convergenza, delta; σ di default = volatilità storica 1Y, strike default ATM
- Matematica verificata contro valori da manuale (Hull): BS call 6.8887 ✓, CRR→BS in convergenza, American put 2 step = 7.43 ✓, put-call parity a 1e-15
- Decisione: tutta la matematica è client-side, nessuna nuova API route — riusa /api/history e /api/quote

## [2026-06-10] — MVP funzionante + pubblicazione GitHub
- Implementato il terminale completo: command bar con suggestions, quote panel, grafico candlestick+volume (lightweight-charts v5), watchlist persistita in localStorage, news (CNBC+Yahoo RSS), monitor FX (Frankfurter/BCE), monitor crypto (CoinGecko), help, function keys F1–F5
- 6 API route proxy: /api/quote, /api/history, /api/search, /api/news, /api/fx, /api/crypto
- **Fix Yahoo 429**: Yahoo rifiuta UA browser "completi" se il fingerprint TLS non corrisponde (Node fetch ≠ Chrome reale); con `User-Agent: Mozilla/5.0` minimale risponde 200. Inoltre `query1` è rate-limitato da alcune reti → fallback host `query2`→`query1` in `src/lib/yahoo.ts`
- Tutti gli endpoint verificati con dati reali (AAPL, ^GSPC, BTC-USD, EURUSD=X, search, FX, crypto, news)
- README con disclaimer trademark Bloomberg, LICENSE MIT
- Pubblicato: https://github.com/kindermerendero/open-bloomberg-terminal

## [2026-06-10] — Setup iniziale
- Creazione struttura progetto
- Stack: Next.js 15 + TypeScript, lightweight-charts, rss-parser
- Decisione: solo fonti dati gratuite senza API key (Yahoo Finance endpoint pubblici, CoinGecko, Frankfurter, RSS) — il terminale deve funzionare out-of-the-box dopo il clone
- Decisione: tutte le fetch esterne proxate via API route Next.js per CORS e caching
