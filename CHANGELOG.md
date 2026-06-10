# Changelog

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
