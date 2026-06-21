# Changelog

## [2026-06-21] — Markowitz: visualizzazione zona di fattibilità con bordi tracciati
- Il pannello Markowitz (F8) ora ombreggia la **regione di fattibilità** e ne traccia il contorno, invece di mostrare solo la nuvola di punti. Inviluppo calcolato in `MarkowitzPanel.tsx` (memo `region`) affettando la cloud per fasce di rendimento e prendendo min/max σ per fascia (smoothing a 3 tap)
- Short allowed → regione semi-infinita a destra della frontiera min-varianza (chiusa sul bordo destro del grafico); long only → regione chiusa e limitata (bordo sinistro = min σ, bordo destro = max σ). Fill ambra translucido + contorno ambra
- Punti cloud mantenuti bianchi sopra l'area; nota aggiornata

## [2026-06-21] — Markowitz: toggle short selling (ALLOWED / LONG ONLY)
- Aggiunto interruttore **SHORT SELLING** nei controlli del pannello Markowitz (F8): `ALLOWED` (default) usa la forma chiusa di Merton (short consentito, pesi senza vincolo di segno); `LONG ONLY` impone `wᵢ≥0, Σwᵢ=1`
- Il caso long-only non ha soluzione in forma chiusa → nuovo solver numerico in `src/lib/quant.ts`: `projectSimplex` (proiezione euclidea sul simplesso, Wang & Carreira-Perpiñán 2013) + `minVarSimplex` (gradient descent proiettato sul sotto-problema `min ½wᵀΣw − q·μᵀw`). Sweep dell'avversione al rischio q: q=0 → GMV, q→∞ → vertice a massimo rendimento; la frontiera efficiente è l'inviluppo superiore dei punti, la tangente è il punto a Sharpe massimo, la cloud diventa campionamento Dirichlet sul simplesso
- `markowitz()` ora prende il parametro `allowShort` (5° arg, default true). Sotto-titolo, nota e cloud si adattano alla modalità
- Verifica numerica: con ottimo non vincolato già positivo le due modalità coincidono (vincolo inattivo); con asset correlato a rendimento inferiore lo short produce pesi −10/+11 mentre long-only clampa a [0,1] con risultato più sensato

## [2026-06-21] — Fix scala grafico Markowitz (assi esplosi a ±18.000%)
- **Bug**: con lo short consentito la nuvola di portafogli random esplodeva (assi Y fino a −18.183%, X fino a 17.546%) e frontiera/asset/GMV collassavano in un puntino. Causa: la cloud usava pesi `raw[i]/Σraw` con `raw` gaussiane → quando le gaussiane quasi si annullano `Σraw≈0` e i pesi schizzano a migliaia
- `src/lib/quant.ts`: normalizzazione stabile della cloud via proiezione sull'iperpiano Σw=1 (`w = raw − (Σraw−1)/n`, perturbazione gaussiana dell'equal-weight con `spread=0.6`) — pesi limitati, niente divisione per ~0. Tangency calcolata prima della frontiera e range della frontiera esteso per coprire GMV + asset + tangency (prima la TAN a +70% cadeva fuori dalla curva disegnata fino a ~34%)
- `src/components/MarkowitzPanel.tsx`: assi calcolati solo dai punti significativi (frontiera/asset/GMV/tangency/rf), non più dalla cloud; punti cloud fuori finestra clippati in render (`plot.inView`)

## [2026-06-20] — Modulo corporate finance (Barchiesi): EQV, MNA, RGT, IPO, OPA
- Aggiunto l'intero modulo **finanza aziendale** per coprire la parte del corso "Analisi dei Sistemi Finanziari" della prof.ssa Barchiesi (il terminale copriva finora solo il modulo Tiburzi/scienza degli investimenti)
- **EQV** (`F10`, `AAPL EQV`/`DDM`) — equity valuation data-driven: DDM Gordon `P0=D1/(r−g)`, DDM a due stadi (g₁ per N anni → g₂ terminale Gordon, con tabella dividendi proiettati e TV), **PVGO = P − EPS/r**, multipli P/E, P/BV, dividend yield. Auto-fill: D₀/EPS/BVPS/ROE/payout da SEC EDGAR, costo del capitale r dal **CAPM** (β vs S&P500, rf da ^IRX) → collega il modulo Tiburzi a quello Barchiesi. Tutti gli input restano editabili
- **MNA** (`MNA`) — M&A: sinergie `=VA(AB)−[VA(A)+VA(B)]`, premio, costo, **VAN acquisizione = sinergie − premio**, tipologie orizzontale/verticale/conglomerale
- **RGT** (`RGT`/`RIGHTS`) — aumento di capitale a pagamento: prezzo teorico ex-diritto `P_to=(n·P_cum+m·P_e)/(n+m)`, valore del diritto, **fattore AIAF** `K=P_to/P_cum`, diluizione; + sezione buyback (azioni riacquistate, % capitale vs limite 20%, accrescimento EPS)
- **IPO** (`IPO`) — bookbuilding, underpricing, money left on the table, greenshoe, spread+costi all-in, requisiti float EXM/STAR, tipi OPS/OPV/OPVS
- **OPA** (`OPA`/`TENDER`) — tender offer: premio, soglia obbligatoria 30% (CONSOB), squeeze-out 90%, equal opportunity, difese (amichevole vs ostile)
- Nuova route **`/api/fundamentals`**: dividendi TTM da Yahoo (`v8/finance/chart?events=div`, qualsiasi mercato) + fundamentals USA da SEC EDGAR XBRL (companyfacts, ticker→CIK via `company_tickers.json`, no API key). Ticker non-USA → `source:none` con soli dividendi
- Nuova matematica in `src/lib/quant.ts`: `ddmGordon`, `ddmTwoStage`, `sustainableGrowth`, `impliedCostOfEquity`, `pvgo`, `mnaEval`, `rightsIssue`
- Verifica live: AAPL → SEC (EPS 7.46, ROE 105% reale da equity erosa dai buyback → growth clampata), ENEL.MI → dividendi Yahoo (yield 4.88%). Build e tsc puliti
- Decisione: l'unica nuova API route è `/api/fundamentals`; il resto è matematica client-side che riusa `/api/history` e `/api/quote`. SEC EDGAR è la sola fonte fundamentals coerente con l'ethos no-key (US-only, fallback manuale per gli altri)

## [2026-06-17] — Markowitz (frontiera) + Fixed Income (struttura a termine)
- **Markowitz** (`F8`, `MKWZ AAPL,MSFT,NVDA,…`): ottimizzazione media-varianza in forma chiusa (Merton 1972), short consentito (Σwᵢ=1, nessun vincolo di segno). Calcola A/B/C/D da Σ⁻¹, GMV, tangency portfolio (max Sharpe), CML. Scatter σ-μ in SVG con: frontiera efficiente (iperbole), zona di fattibilità come nuvola Monte Carlo di portafogli random, GMV, tangency, retta CML da (0,rf). Titoli singoli colorati per **classe di rischio β** (LOW <0.8 / MID / HIGH >1.2) vs benchmark selezionabile. Tabella pesi GMV/tangency per titolo
- **Fixed Income** (`F9`, `BOND`/`YC`): struttura a termine Treasury USA completa (1Mo–30Yr) da Treasury.gov (CSV pubblico, no key), nuova route `/api/treasury` con parsing CSV + fallback anno precedente a inizio gennaio. Yield curve in SVG (scala log su maturity), spread 10Y–2Y e forma curva (NORMAL/FLAT/INVERTED). Calcolatore bond: prezzo↔YTM (bisezione), duration Macaulay/modified, convexity, current yield
- Nuova matematica in `src/lib/quant.ts`: `alignMany` (allineamento N serie su date comuni), `invertMatrix` (Gauss-Jordan con pivoting), `markowitz`, `bondPrice`/`bondYTM`/`bondAnalytics`
- Verifica numerica: par bond=100, 10Y 4%@4% Macaulay 8.34/mod 8.18, zero-coupon Macaulay≈scadenza, GMV 2-asset combacia con formula analitica, GMV vol < min(σ singoli)
- Decisione: tutta la matematica è client-side; unica nuova API route è `/api/treasury` (le serie azionarie riusano `/api/history`)

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
