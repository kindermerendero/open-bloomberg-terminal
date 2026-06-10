# Changelog

## [2026-06-10] — Setup iniziale
- Creazione struttura progetto
- Stack: Next.js 15 + TypeScript, lightweight-charts, rss-parser
- Decisione: solo fonti dati gratuite senza API key (Yahoo Finance endpoint pubblici, CoinGecko, Frankfurter, RSS) — il terminale deve funzionare out-of-the-box dopo il clone
- Decisione: tutte le fetch esterne proxate via API route Next.js per CORS e caching
