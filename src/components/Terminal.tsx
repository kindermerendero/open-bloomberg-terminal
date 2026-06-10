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

type Mode = "SEC" | "FX" | "CRY" | "NEWS" | "HELP" | "CAPM" | "OV";

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

export default function Terminal() {
  const [mode, setMode] = useState<Mode>("SEC");
  const [symbol, setSymbol] = useState<string | null>("AAPL");
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
      if (cmd === "CAPM" || cmd === "OV") {
        if (!symbol) return notify("LOAD A SECURITY FIRST — e.g. AAPL CAPM", true);
        return setMode(cmd as Mode);
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
      }
      if (parts.length === 1 && TICKER_RE.test(parts[0])) {
        return loadSecurity(parts[0]);
      }

      notify(`UNKNOWN COMMAND: ${cmd} — TYPE HELP`, true);
    },
    [loadSecurity, notify, symbol]
  );

  // ----- function keys -----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Mode> = {
        F1: "HELP",
        F2: "SEC",
        F3: "FX",
        F4: "CRY",
        F5: "NEWS",
        F6: "CAPM",
        F7: "OV",
      };
      if (map[e.key]) {
        e.preventDefault();
        setMode(map[e.key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const fkeys: Array<[string, Mode, string]> = [
    ["F1", "HELP", "HELP"],
    ["F2", "SEC", "SECURITY"],
    ["F3", "FX", "FX"],
    ["F4", "CRY", "CRYPTO"],
    ["F5", "NEWS", "NEWS"],
    ["F6", "CAPM", "CAPM"],
    ["F7", "OV", "OPTION VAL"],
  ];

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
        </div>
        <div className="col">
          <WatchlistPanel quotes={watchQuotes} loading={watchLoading} onSelect={loadSecurity} />
          <NewsPanel items={topNews} loading={newsLoading} />
        </div>
      </div>

      <div className="fkeys">
        {fkeys.map(([fk, m, label]) => (
          <button key={fk} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
            <span className="fk">{fk}</span> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
