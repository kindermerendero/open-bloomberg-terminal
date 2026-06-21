"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Candle, ChartRange, CryptoRow, FxRate, NewsItem, Quote } from "@/lib/types";
import CommandBar from "./CommandBar";
import QuotePanel from "./QuotePanel";
import ChartPanel from "./ChartPanel";
import WatchlistPanel from "./WatchlistPanel";
import NewsPanel from "./NewsPanel";
import FxPanel from "./FxPanel";
import CryptoPanel from "./CryptoPanel";
import HelpPanel from "./HelpPanel";
import CapmPanel from "./CapmPanel";
import LatticePanel from "./LatticePanel";
import MarkowitzPanel from "./MarkowitzPanel";
import BondPanel from "./BondPanel";
import EquityValuationPanel from "./EquityValuationPanel";
import MnaPanel from "./MnaPanel";
import RightsIssuePanel from "./RightsIssuePanel";
import IpoPanel from "./IpoPanel";
import OpaPanel from "./OpaPanel";

type Mode =
  | "SEC"
  | "FX"
  | "CRY"
  | "NEWS"
  | "HELP"
  | "CAPM"
  | "OV"
  | "MKWZ"
  | "BOND"
  | "EQV"
  | "MNA"
  | "RGT"
  | "IPO"
  | "OPA";

const DEFAULT_WATCHLIST = [
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "AMZN",
  "^GSPC",
  "^IXIC",
  "EURUSD=X",
  "BTC-USD",
];
const WATCHLIST_KEY = "opnb-watchlist";
const TICKER_RE = /^[A-Z0-9^.=-]{1,12}$/;
const RANGE_CMDS: Record<string, ChartRange> = {
  "1D": "1d",
  "5D": "5d",
  "1M": "1mo",
  "6M": "6mo",
  "1Y": "1y",
  "5Y": "5y",
  MAX: "max",
};

// two-level navigation: category tabs → per-category function keys
type Cat = "MARKET" | "INVEST" | "CORP";
const CATEGORIES: Array<{ id: Cat; label: string; items: Array<[Mode, string]> }> = [
  {
    id: "MARKET",
    label: "MARKET",
    items: [
      ["SEC", "SECURITY"],
      ["FX", "FX"],
      ["CRY", "CRYPTO"],
      ["NEWS", "NEWS"],
      ["HELP", "HELP"],
    ],
  },
  {
    id: "INVEST",
    label: "INVESTMENTS",
    items: [
      ["CAPM", "CAPM"],
      ["OV", "OPTION VAL"],
      ["MKWZ", "MARKOWITZ"],
      ["BOND", "FIXED INC"],
    ],
  },
  {
    id: "CORP",
    label: "CORPORATE",
    items: [
      ["EQV", "EQUITY VAL"],
      ["MNA", "M&A"],
      ["RGT", "RIGHTS"],
      ["IPO", "IPO"],
      ["OPA", "TENDER"],
    ],
  },
];
const catOf = (m: Mode): Cat =>
  CATEGORIES.find((c) => c.items.some((it) => it[0] === m))?.id ?? "MARKET";

export default function Terminal() {
  const [mode, setMode] = useState<Mode>("SEC");
  const [activeCat, setActiveCat] = useState<Cat>("MARKET");
  const [symbol, setSymbol] = useState<string | null>("AAPL");
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [range, setRange] = useState<ChartRange>("6mo");
  const [chartLoading, setChartLoading] = useState(false);

  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [watchQuotes, setWatchQuotes] = useState<Quote[]>([]);
  const [watchLoading, setWatchLoading] = useState(true);

  const [topNews, setTopNews] = useState<NewsItem[]>([]);
  const [symNews, setSymNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [fxDate, setFxDate] = useState("");
  const [fxLoading, setFxLoading] = useState(false);
  const [crypto, setCrypto] = useState<CryptoRow[]>([]);
  const [cryptoLoading, setCryptoLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [clock, setClock] = useState("");

  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;

  const notify = useCallback((msg: string, err = false) => {
    setMessage(msg);
    setIsError(err);
  }, []);

  // ----- watchlist persistence -----
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WATCHLIST_KEY);
      if (saved) setWatchlist(JSON.parse(saved));
    } catch {
      /* keep defaults */
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  // ----- clock -----
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const local = now.toTimeString().slice(0, 8);
      const utc = now.toISOString().slice(11, 19);
      setClock(`${local} LOCAL  |  ${utc} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ----- security: quote + candles -----
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    const load = async () => {
      setChartLoading(true);
      try {
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Load failed");
        setQuote(json.quote);
        setCandles(json.candles);
        notify(`${symbol} LOADED`);
      } catch (e) {
        if (!cancelled) notify(`ERR: ${(e as Error).message}`, true);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, range, notify]);

  // ----- watchlist quotes (poll 45s) -----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const syms = watchlistRef.current;
      if (syms.length === 0) {
        setWatchQuotes([]);
        setWatchLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/quote?symbols=${encodeURIComponent(syms.join(","))}`);
        const json = await res.json();
        if (!cancelled && res.ok) setWatchQuotes(json.quotes ?? []);
      } catch {
        /* keep last data */
      } finally {
        if (!cancelled) setWatchLoading(false);
      }
    };
    load();
    const id = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [watchlist]);

  // ----- top news (poll 2min) -----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/news");
        const json = await res.json();
        if (!cancelled && res.ok) setTopNews(json.items ?? []);
      } catch {
        /* keep last data */
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    };
    load();
    const id = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ----- symbol news (when in NEWS mode) -----
  useEffect(() => {
    if (mode !== "NEWS" || !symbol) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`);
        const json = await res.json();
        if (!cancelled && res.ok) setSymNews(json.items ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, symbol]);

  // ----- FX (on mode entry) -----
  useEffect(() => {
    if (mode !== "FX") return;
    let cancelled = false;
    setFxLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/fx");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "FX load failed");
        setFxRates(json.rates ?? []);
        setFxDate(json.date ?? "");
      } catch (e) {
        if (!cancelled) notify(`ERR: ${(e as Error).message}`, true);
      } finally {
        if (!cancelled) setFxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, notify]);

  // ----- crypto (poll 60s while active) -----
  useEffect(() => {
    if (mode !== "CRY") return;
    let cancelled = false;
    const load = async () => {
      setCryptoLoading(true);
      try {
        const res = await fetch("/api/crypto");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Crypto load failed");
        setCrypto(json.rows ?? []);
      } catch (e) {
        if (!cancelled) notify(`ERR: ${(e as Error).message}`, true);
      } finally {
        if (!cancelled) setCryptoLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mode, notify]);

  const loadSecurity = useCallback(
    (sym: string, target: Mode = "SEC") => {
      setSymbol(sym.toUpperCase());
      setMode(target);
      notify(`LOADING ${sym.toUpperCase()}…`);
    },
    [notify]
  );

  // ----- command parser -----
  const handleCommand = useCallback(
    (raw: string) => {
      const cmd = raw.trim().toUpperCase();
      const parts = cmd.split(/\s+/);

      if (cmd === "HELP") return setMode("HELP");
      if (cmd === "FX") return setMode("FX");
      if (cmd === "CRY" || cmd === "CRYPTO") return setMode("CRY");
      if (cmd === "N" || cmd === "NEWS") return setMode("NEWS");
      if (cmd === "SEC" || cmd === "Q") return setMode("SEC");
      if (cmd === "BOND" || cmd === "YC" || cmd === "GOVT") return setMode("BOND");
      if (cmd === "MNA" || cmd === "MA" || cmd === "MERGER") return setMode("MNA");
      if (cmd === "RGT" || cmd === "RIGHTS" || cmd === "BUYBACK") return setMode("RGT");
      if (cmd === "IPO") return setMode("IPO");
      if (cmd === "OPA" || cmd === "TENDER") return setMode("OPA");
      if (cmd === "CAPM" || cmd === "OV" || cmd === "EQV" || cmd === "DDM") {
        if (!symbol) return notify(`LOAD A SECURITY FIRST — e.g. AAPL ${cmd}`, true);
        return setMode(cmd === "DDM" ? "EQV" : (cmd as Mode));
      }

      // MKWZ AAPL,MSFT,NVDA — mean-variance frontier over a portfolio
      if (parts[0] === "MKWZ" || parts[0] === "PORT") {
        const list = cmd.slice(parts[0].length).replace(/\s+/g, "");
        const syms = list.split(",").filter((s) => TICKER_RE.test(s));
        if (syms.length >= 2) {
          setPortfolio(syms);
          setMode("MKWZ");
          return notify(`PORTFOLIO: ${syms.join(", ")}`);
        }
        if (portfolio.length >= 2) return setMode("MKWZ");
        return notify("MKWZ NEEDS ≥2 TICKERS — e.g. MKWZ AAPL,MSFT,NVDA,JPM", true);
      }

      if (cmd in RANGE_CMDS) {
        setRange(RANGE_CMDS[cmd]);
        setMode("SEC");
        return notify(`RANGE ${cmd}`);
      }

      if (parts[0] === "ADD" && parts[1]) {
        const sym = parts[1];
        if (!TICKER_RE.test(sym)) return notify(`INVALID SYMBOL: ${sym}`, true);
        setWatchlist((wl) => (wl.includes(sym) ? wl : [...wl, sym]));
        return notify(`${sym} ADDED TO WATCHLIST`);
      }
      if (parts[0] === "DEL" && parts[1]) {
        const sym = parts[1];
        setWatchlist((wl) => wl.filter((s) => s !== sym));
        return notify(`${sym} REMOVED FROM WATCHLIST`);
      }

      // "<TICKER> GP" / "<TICKER> CAPM" … — Bloomberg-style function suffix
      if (parts.length === 2 && TICKER_RE.test(parts[0])) {
        if (["GP", "DES"].includes(parts[1])) return loadSecurity(parts[0]);
        if (parts[1] === "CAPM") return loadSecurity(parts[0], "CAPM");
        if (parts[1] === "OV") return loadSecurity(parts[0], "OV");
        if (parts[1] === "EQV" || parts[1] === "DDM") return loadSecurity(parts[0], "EQV");
      }
      if (parts.length === 1 && TICKER_RE.test(parts[0])) {
        return loadSecurity(parts[0]);
      }

      notify(`UNKNOWN COMMAND: ${cmd} — TYPE HELP`, true);
    },
    [loadSecurity, notify, symbol]
  );

  // keep the active category in sync with the open panel (so the bar follows
  // navigation from the command line / watchlist, not just clicks)
  useEffect(() => {
    setActiveCat(catOf(mode));
  }, [mode]);

  // ----- function keys: F1..Fn map to the active category's modules -----
  const activeItems = CATEGORIES.find((c) => c.id === activeCat)?.items ?? [];
  useEffect(() => {
    const items = CATEGORIES.find((c) => c.id === activeCat)?.items ?? [];
    const handler = (e: KeyboardEvent) => {
      const fk = /^F(\d+)$/.exec(e.key);
      if (!fk) return;
      const idx = Number(fk[1]) - 1;
      if (idx >= 0 && idx < items.length) {
        e.preventDefault();
        setMode(items[idx][0]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeCat]);

  return (
    <div className="terminal">
      <div className="header">
        <span className="brand">
          OPNB <span>// OPEN BLOOMBERG TERMINAL — FREE DATA ONLY</span>
        </span>
        <span className="clock">
          {clock.split("|")[0]}
          <span className="utc">{clock.split("|")[1]}</span>
        </span>
        <span className="live">LIVE</span>
      </div>

      <CommandBar onCommand={handleCommand} message={message} isError={isError} />

      <div className="main">
        <div className="col">
          {mode === "SEC" && (
            <>
              <QuotePanel quote={quote} />
              <ChartPanel
                symbol={symbol}
                candles={candles}
                range={range}
                loading={chartLoading}
                onRangeChange={(r) => setRange(r)}
              />
            </>
          )}
          {mode === "FX" && <FxPanel rates={fxRates} loading={fxLoading} date={fxDate} />}
          {mode === "CRY" && (
            <CryptoPanel rows={crypto} loading={cryptoLoading} onSelect={loadSecurity} />
          )}
          {mode === "NEWS" && (
            <NewsPanel
              items={symbol && symNews.length > 0 ? symNews : topNews}
              loading={newsLoading}
              symbol={symbol && symNews.length > 0 ? symbol : null}
              grow
            />
          )}
          {mode === "HELP" && <HelpPanel />}
          {mode === "CAPM" && <CapmPanel symbol={symbol} quote={quote} />}
          {mode === "OV" && <LatticePanel symbol={symbol} quote={quote} />}
          {mode === "MKWZ" && <MarkowitzPanel symbols={portfolio} />}
          {mode === "BOND" && <BondPanel />}
          {mode === "EQV" && <EquityValuationPanel symbol={symbol} quote={quote} />}
          {mode === "MNA" && <MnaPanel />}
          {mode === "RGT" && <RightsIssuePanel symbol={symbol} />}
          {mode === "IPO" && <IpoPanel />}
          {mode === "OPA" && <OpaPanel />}
        </div>
        <div className="col">
          <WatchlistPanel quotes={watchQuotes} loading={watchLoading} onSelect={loadSecurity} />
          <NewsPanel items={topNews} loading={newsLoading} />
        </div>
      </div>

      <div className="cattabs">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={activeCat === c.id ? "active" : ""} onClick={() => setActiveCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="fkeys">
        {activeItems.map(([m, label], i) => (
          <button key={m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
            <span className="fk">F{i + 1}</span> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
