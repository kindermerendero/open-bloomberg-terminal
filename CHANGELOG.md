# Changelog

## [2026-07-02] — Rifiniture pre-orale: robustezza dati, deep-link, fix visivi
Preparazione alla demo dell'orale ASF (settimana prossima). Obiettivo: l'app non deve rompersi né mostrare incoerenze davanti ai professori.
- **Stale-if-error**: `yahooFetch` ora conserva in memoria l'ultima risposta buona per path e la serve (fino a 24h, header `x-stale: 1`) quando entrambi gli host Yahoo falliscono — un 429 dagli IP Vercel a metà demo non rompe più i pannelli. Stesso pattern inline in `/api/crypto` (CoinGecko free 429-a facilmente). Copre quote, history, search, fundamentals, crypto
- **Deep-link**: `?cmd=AAPL CAPM` esegue il comando al mount (`Terminal.tsx`), `?lang=it|en` forza la lingua (`i18n.tsx`), `?theme=dark|light` forza il tema persistendolo (script anti-flash in `layout.tsx`). Usi: bookmark dei passi della demo + screenshot QA headless
- **Quote coerente su tutti i range**: su range ≠ 1d il `chartPreviousClose` di Yahoo è la chiusura precedente all'*inizio del range* → il pannello TITOLO mostrava +8,28% mentre la watchlist diceva +1,73%. `/api/history` ora prende la quote sempre dal chart 1d (fetch parallelo, cache 30s)
- **Fix hydration warning**: `suppressHydrationWarning` su `<html>` (lo script anti-flash riscrive `data-theme` pre-hydration) — spariti il warning console e il badge "1 Issue" del dev overlay
- **QA visiva completa** dei 14 pannelli in italiano/tema scuro via deep-link + Chrome headless. Fix emersi: etichetta E(R) sovrapposta al tick massimo dell'asse (CAPM SML + Markowitz → spostata sopra l'asse); tick della curva Treasury accavallati sul tratto breve (skip anti-collisione ≥30px in `BondPanel`, label "1.5 Month"→"1.5MO" nella route); legenda "d (RIGHT)" hardcoded in RGT → chiave i18n `rgt.legendRight` ("d (DIRITTO)" in it)

- Ultimo testo UI hardcoded rimasto fuori dall'i18n: il `title` del `ThemeToggle` ("Theme: AUTO → DARK → LIGHT") ora passa da `t("header.theme")` (nuova chiave `header.theme` in EN/IT)
- Verifica completezza i18n: tutti i componenti usano `t()`, parità chiavi EN/IT (198 per ramo, nessun mismatch), build verde. Restano neutri di proposito solo il `title` di `LanguageToggle` (bilingue EN↔IT per design) e i token finanziari/formule

## [2026-06-23] — i18n bilingue EN/IT con toggle nell'header
- L'intera webapp è ora **bilingue inglese/italiano**. Sistema i18n **custom leggero** senza librerie (coerente con la filosofia "niente framework"): dizionario namespaced `src/lib/dict.ts` (`DICT.en`/`DICT.it`), provider `src/lib/i18n.tsx` (`LanguageProvider` montato in `layout.tsx`, hook `useLang()` → `{ lang, setLang, t, tRaw }`). `t(key, params)` risolve dot-notation con fallback EN e interpolazione `{placeholder}`; `tRaw(key)` espone valori strutturati (tabelle comandi HELP, soglie OPA, label dei waterfall MNA/IPO)
- **Default lingua**: override manuale in localStorage (`opnb-lang`) → altrimenti `navigator.language` (IT per browser italiano, altrimenti EN). **Toggle** `LanguageToggle.tsx` (EN↔IT) nell'header accanto al `ThemeToggle`. Provider con pattern `mounted`-like (render iniziale EN per evitare hydration mismatch, poi risoluzione client) coerente con `ThemeToggle`
- **Tutti i ~30 componenti** estratti su `t()`: header/clock, command bar, pannelli MARKET (Quote, Chart, Watchlist, News, FX, Crypto, Help), moduli Tiburzi (CAPM, Option Val, Markowitz, Bond) e Barchiesi (EQV, MNA, RGT, IPO, OPA) — incluse note esplicative, verdetti, label assi/grafici SVG, intestazioni tabelle e messaggi del command parser. `fmtAgo` in `format.ts` ora accetta `lang`
- **Restano neutri di proposito** (non tradotti): mnemonici comandi (HELP, GP, N, ADD/DEL <SYM>), ticker, abbreviazioni finanziarie internazionali (EPS, ROE, P/E, YTM, GMV) e notazione delle formule (P₀ = D₁/(r−g), u = e^(σ√Δt), g₁ \ r…)
- Decisione: i18n custom invece di next-intl/react-i18next per zero dipendenze e coerenza con l'approccio CSS-custom del progetto. Build e typecheck verdi, SSR statico della "/" ok

## [2026-06-23] — Markowitz: via i contorni della regione + fix 2-asset/short
- Rimossi i **contorni** della regione di fattibilità (outline tracciato + stecche degli archi a 2 asset): resta solo l'area ombreggiata
- Con **2 asset** l'insieme fattibile è una curva, non un'area → nessun fill (prima in modalità short appariva una banda rettangolare priva di senso)
- Short selling con ≥3 asset: l'area ora riempie **tutta l'altezza** a destra dell'iperbole min-varianza (usando A/B/C/D), invece di una banda troncata al range dei rendimenti (`MarkowitzPanel.tsx`)

## [2026-06-23] — Fix: la tendina benchmark (CAPM/Markowitz) si chiudeva subito
- Il `CommandBar` riportava il focus sulla command line a **ogni** click del documento → aprendo un `<select>` (benchmark CAPM, Markowitz, ecc.) il focus veniva rubato e la tendina si richiudeva istantaneamente, bloccando la selezione su S&P 500; disturbava anche gli input dei pannelli
- Fix: il refocus salta i click su controlli di form (`input, select, textarea, option, label, [contenteditable]`). Verificato: dopo il click il focus resta sul select e la scelta del benchmark regge (`CommandBar.tsx`)

## [2026-06-23] — RGT rights issue: grafico valore del diritto vs prezzo di emissione
- Aggiunto in modalità RIGHTS ISSUE un grafico di **d = m·(P_cum − P_e)/(n+m)**: lineare e decrescente, si azzera a `P_e = P_cum`. Linea ambra = valore del diritto, linea ciano tratteggiata = prezzo ex-diritto `P_to` (per contesto), riferimento `P_cum`, marker sul prezzo di emissione corrente (`RightsIssuePanel.tsx`, memo `rightChart`)

## [2026-06-23] — Tema chiaro/scuro + sistema di variabili colore completo
- Introdotti **due temi**: scuro (ambra-su-nero stile Bloomberg, invariato) e **chiaro "carta calda"** (crema/avorio, testo marrone scuro, ambra scurita come accento). Selezione **automatica via `prefers-color-scheme`** + **toggle manuale** nell'header (AUTO → DARK → LIGHT, salvato in localStorage), con script anti-flash nel `<head>`
- Rifattorizzato tutto il colore in **variabili semantiche** (`globals.css`): `--panel-head`, `--grid`, `--grid-faint`, `--chart-grid`, `--chart-bg`, `--input-bg`, `--row-hover`, `--node-bg`, `--on-accent`, `--chart-text`, `--vol-*`, ecc. Sostituiti ~40 hex hardcoded nel CSS e ~40 negli SVG dei pannelli
- `ChartPanel` (lightweight-charts) reso theme-reactive: legge le CSS var via `getComputedStyle` e riapplica i colori al cambio tema con un `MutationObserver` su `data-theme`
- L'effetto CRT (scanline/vignette) è disattivato nel tema chiaro
- Nuovo componente `ThemeToggle.tsx`; `layout.tsx` con init pre-paint e `data-theme` di default

## [2026-06-22] — OV: albero binomiale più visibile
- I rami del lattice CRR erano `#3d2a00` (quasi neri su sfondo nero) → schiariti a `var(--amber-dim)` opacità 0.55; aggiunto un marker circolare su ogni nodo (rosso dove l'esercizio anticipato è ottimale), con offset del testo allargati così il nodo sta pulito tra prezzo e valore (`LatticePanel.tsx`)

## [2026-06-22] — Lucidatura visiva: fix overlap OPA + grafico SML su CAPM
- Verifica visiva di tutti i 15 pannelli in produzione (screenshot via Chrome headless)
- **Fix OPA**: le etichette delle soglie 90%/95% si sovrapponevano → stagger verticale + ancoraggio testo (`OpaPanel.tsx`)
- **CAPM**: aggiunto il grafico **Security Market Line** (β su X, rendimento su Y; retta rf→mercato, punto del titolo sopra/sotto la SML = Jensen's alpha con gap tratteggiato verde/rosso). Riempie lo spazio vuoto che era l'unico squilibrio visivo rimasto tra i pannelli analytics (`CapmPanel.tsx`)

## [2026-06-22] — OPA: barra soglie, sensibilità costo/quota, auto-fill
- Tre aggiunte al pannello OPA (tender offer):
  1. **Barra soglie di controllo**: 0–100% con quota posseduta (ciano) → quota cercata (ambra) e i marker CONSOB (30% obbligatoria, 50% controllo, 90% squeeze-out, 95% sell-out), evidenziati in rosso quando superati
  2. **Costo to acquire vs quota**: curva del costo totale al variare della quota cercata, con le linee delle soglie e marker sul target corrente
  3. **Auto-fill** azioni totali e prezzo di mercato dal ticker caricato (`/api/fundamentals`); prezzo d'offerta seedato a +25% di premio
- `OpaPanel.tsx` riceve la prop `symbol` da `Terminal.tsx`; costante `THRESHOLDS` condivisa tra le due viste

## [2026-06-21] — Navigazione a due livelli: tab di categoria + F-keys contestuali
- La barra in basso (14 voci, di cui solo 10 con tasto funzione) è stata riorganizzata in **3 categorie** con tab: MARKET / INVESTMENTS / CORPORATE. Selezionata una categoria, i tasti F1–Fn mappano i suoi moduli
- La categoria attiva si **sincronizza col pannello aperto** (`catOf(mode)`), così la barra segue anche la navigazione da command line / watchlist, non solo i click
- `Terminal.tsx`: nuova struttura `CATEGORIES`, stato `activeCat`, handler tastiera dinamico per F-key; `globals.css` stile `.cattabs`; `HelpPanel` aggiornato (sezione Navigation per categoria)

## [2026-06-21] — IPO: cost bridge + sensibilità prezzo + curva di domanda
- Tre grafici aggiunti al pannello IPO:
  1. **Cost bridge** (waterfall): `gross − spread − fixed − money left = netto catturato`, visualizza il costo all-in della quotazione
  2. **Offer-price sensitivity**: net proceeds (ambra, crescente) vs money left on the table (ciano, decrescente) al variare del prezzo di offerta; linea "FAIR" dove i soldi lasciati sul tavolo si azzerano (offer = 1st-day close)
  3. **Bookbuilding demand**: curva di domanda istituzionale lineare vs prezzo, retta dell'offerta (shares offered), prezzo di clearing `P* = rangeHigh − (rangeHigh−rangeLow)/oversub`
- Nuovi input bookbuilding: RANGE LOW/HIGH e OVERSUBSCRIPTION × (`IpoPanel.tsx`)

## [2026-06-21] — RGT buyback: auto-fill dati reali + grafico EPS accretion
- Il modulo RGT (modalità BUYBACK) ora si **auto-compila** dal ticker caricato: azioni in circolazione, utile netto e prezzo da `/api/fundamentals` (SEC EDGAR + Yahoo); cassa di default = un anno di utili. Valori monetari in milioni (`RightsIssuePanel` riceve la prop `symbol` da `Terminal.tsx`)
- Nuovo **grafico EPS accretion**: curva dell'accrescimento EPS al variare della cassa destinata al buyback `acc(c)=shares/(shares−c/price)−1`, con linea rossa del **limite legale 20%** del capitale sociale e marker sul punto corrente
- Verifica live AAPL: 14.687M azioni, utile $112.010M, EPS 7,63; buyback da 1 anno di utili → 2,56% del capitale, accretion +2,63%

## [2026-06-21] — MNA: value bridge (waterfall sinergie − premio = VAN)
- Aggiunto al pannello M&A (MNA) un **value bridge** a cascata che visualizza l'equazione del modulo: barra verde = sinergie create, barra rossa = premio ceduto al target, barra finale = NPV trattenuto dall'acquirente (verde/rosso per segno), con linee di collegamento ai livelli cumulati e didascalie "→ target" / "→ acquirer"
- `MnaPanel.tsx`: memo `bridge` (geometria SVG waterfall su `synergy`/`premium`/`npv` da `mnaEval`); rende chiaro a colpo d'occhio che un premio alto può azzerare le sinergie (col default sinergie 100 − premio 100 = NPV 0)

## [2026-06-21] — EQV: costo del capitale stabile (rf + β·ERP) + verdetto corretto
- **Bug**: il costo del capitale auto-derivato usava il CAPM con rendimento di mercato *realizzato* sull'ultimo anno → instabilissimo (NVDA: 2,98% in uno snapshot, 39,28% in un altro). Con `r` troppo basso le colonne `r ≤ g₂` della matrice davano "—" e il verdetto mostrava erroneamente "PROVIDE A DIVIDEND" pur con D₀>0
- `EquityValuationPanel.tsx`: `r` ora = **rf + β·ERP** (premio per il rischio azionario forward, costante 5,5%); β resta dal CAPM vs S&P500. Stabile (~13,8% per NVDA) e coerente con la pratica di valutazione
- Verdetto distingue ora i casi a fair value nullo: D₀≤0 → "non-payer, serve un DCF"; altrimenti → "DDM diverge (r ≤ g), alza r o abbassa g"
- Aggiornati hint e nota; nessun impatto sul pannello CAPM (F6), che resta descrittivo (realizzato)

## [2026-06-21] — EQV: matrice di sensitività del fair value (r × g₁)
- Aggiunta al pannello Equity Valuation (F10) una **heatmap 7×7** del fair value DDM a due stadi al variare di costo del capitale `r` (colonne) e crescita `g₁` (righe), step 1 punto %, centrata sui valori correnti
- Celle colorate verde (DDM sopra il mercato → sottovalutata) / rosso (sotto → sopravvalutata), intensità ∝ gap (satura a ±40%); cella corrente evidenziata in giallo. Mostra a colpo d'occhio la fragilità del DDM rispetto al denominatore `(r−g)`
- `EquityValuationPanel.tsx`: helper `sensBg`, calcolo `sensCells` (riusa `ddmTwoStage`, terminale `g₂` cappato a `min(g₂, g₁)` per cella); nuovi stili `table.sens` in `globals.css`. Visibile solo quando il DDM è eseguibile (prezzo noto e D₀>0)

## [2026-06-21] — Struttura a termine: storico, confronto, area euro, animazione
- Il modulo Fixed Income (F9) non mostra più solo l'ultima curva ma **~2 anni di storico giornaliero**. Tre estensioni:
  1. **Scrubber data + animazione**: slider per scorrere ogni giorno della finestra; pulsante PLAY che anima la curva nel tempo (oldest→newest); bottone LATEST per tornare all'ultima
  2. **Confronto sovrapposto**: toggle `vs 1M` / `vs 1Y` che disegnano la curva di ~1 mese/1 anno fa (ciano tratteggiata / grigia) sotto quella selezionata
  3. **Area euro (BCE)**: toggle MARKET US TREASURY / EURO AREA — nuova fonte ECB Data Portal (SDMX dataflow `YC`, curva AAA Svensson spot rate, 3M–30Y, no API key)
- **Storico spread 10Y–2Y**: sparkline sotto la curva, tratti rossi dove invertita (segnale di recessione), marker verticale sulla data selezionata
- `/api/treasury?source=us|ez`: restituisce tutte le curve giornaliere (newest first, finestra 520 giorni ≈ 2y) + serie storica dello spread. Parsing multi-riga del CSV Treasury (3 anni) e SDMX csvdata BCE (multi-tenor con `+`, `startPeriod`)
- `BondPanel.tsx` riscritto: stato source/selIdx/overlay/playing, memo `plot` (multi-curva) e `spark` (sparkline spread con downsampling ~220 pt). Nuovi stili `.ts-scrub`/`.ts-legend`/`.ts-latest` in `globals.css`
- Verifica live: US 520 curve 2024-05→2026-06 (spread −38bp→+27bp), EZ 520 curve BCE (spread −33bp→+43bp)

## [2026-06-21] — Markowitz: zona di fattibilità "a ombrello" da bordi analitici
- I bordi della regione di fattibilità non sono più stimati dalla nuvola random (rumorosa sui lati del simplesso → spezzate dritte verso i vertici) ma calcolati **analiticamente** in `quant.ts`: nuovi campi `mvFull` (frontiera a minima varianza completa, entrambi i rami) ed `edges` (archi delle frontiere a 2 asset = "stecche" dell'ombrello, una per ogni coppia di titoli)
- Long-only: il ramo inferiore della min-varianza si ottiene estendendo lo sweep di q ai valori negativi (`±qMax`); la regione chiusa = naso del proiettile (bordo sinistro, min σ) + inviluppo esterno degli archi a 2 asset (bordo destro, max σ), entrambi lisci. Le stecche vengono disegnate come linee ambra tenui → look "a ombrello" delle slide
- Short allowed: bordo sinistro = `mvFull` (iperbole), regione chiusa sul bordo destro del grafico
- `MarkowitzPanel.tsx`: memo `region` affetta per fascia di rendimento i punti analitici (non più la cloud) per ricavare gli inviluppi min/max σ

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
