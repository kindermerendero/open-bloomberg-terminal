"use client";

import { useEffect, useState } from "react";
import type { Candle, Quote } from "@/lib/types";
import { capmStats, type CapmStats } from "@/lib/quant";
import { fmtNum, fmtPct, signClass } from "@/lib/format";

const BENCHMARKS: Array<[string, string]> = [
  ["^GSPC", "S&P 500"],
  ["^IXIC", "NASDAQ"],
  ["^DJI", "DOW JONES"],
  ["^STOXX50E", "EURO STOXX 50"],
  ["FTSEMIB.MI", "FTSE MIB"],
  ["^GDAXI", "DAX"],
];

interface Props {
  symbol: string | null;
  quote: Quote | null;
}

export default function CapmPanel({ symbol, quote }: Props) {
  const [benchmark, setBenchmark] = useState("^GSPC");
  const [rfPct, setRfPct] = useState<number | null>(null);
  const [stats, setStats] = useState<CapmStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // default risk-free: 13-week T-bill yield (^IRX)
  useEffect(() => {
    if (rfPct != null) return;
    (async () => {
      try {
        const res = await fetch("/api/quote?symbols=%5EIRX");
        const json = await res.json();
        const px = json.quotes?.[0]?.price;
        setRfPct(px != null ? Number(px.toFixed(2)) : 4);
      } catch {
        setRfPct(4);
      }
    })();
  }, [rfPct]);

  useEffect(() => {
    if (!symbol || rfPct == null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const [assetRes, benchRes] = await Promise.all([
          fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=1y`),
          fetch(`/api/history?symbol=${encodeURIComponent(benchmark)}&range=1y`),
        ]);
        const asset = await assetRes.json();
        const bench = await benchRes.json();
        if (cancelled) return;
        if (!assetRes.ok) throw new Error(asset.error ?? "asset load failed");
        if (!benchRes.ok) throw new Error(bench.error ?? "benchmark load failed");
        const s = capmStats(
          asset.candles as Candle[],
          bench.candles as Candle[],
          rfPct / 100
        );
        if (!s) throw new Error("not enough overlapping observations");
        setStats(s);
      } catch (e) {
        if (!cancelled) {
          setStats(null);
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, benchmark, rfPct]);

  if (!symbol) {
    return (
      <div className="panel" style={{ flex: "1 1 auto" }}>
        <div className="panel-title">CAPM — Asset Pricing</div>
        <div className="empty">Load a security first — e.g. AAPL CAPM</div>
      </div>
    );
  }

  const smlVerdict =
    stats == null
      ? ""
      : stats.alphaAnn > 0.005
        ? "ABOVE SML — POSITIVE ALPHA (UNDERVALUED vs CAPM)"
        : stats.alphaAnn < -0.005
          ? "BELOW SML — NEGATIVE ALPHA (OVERVALUED vs CAPM)"
          : "ON THE SML — FAIRLY PRICED vs CAPM";

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        CAPM — {symbol} {quote ? `@ ${fmtNum(quote.price)}` : ""}
        <span className="sub">DAILY LOG RETURNS, 1Y</span>
      </div>
      <div className="controls">
        <label>
          BENCHMARK
          <select value={benchmark} onChange={(e) => setBenchmark(e.target.value)}>
            {BENCHMARKS.map(([sym, name]) => (
              <option key={sym} value={sym}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          RISK-FREE %
          <input
            type="number"
            step="0.05"
            value={rfPct ?? ""}
            onChange={(e) => setRfPct(parseFloat(e.target.value) || 0)}
          />
        </label>
        <span className="hint">rf default = 13W T-BILL (^IRX)</span>
      </div>
      <div className="panel-body">
        {loading && <div className="loading">COMPUTING…</div>}
        {error && <div className="empty">ERR: {error}</div>}
        {stats && !loading && (
          <>
            <div className="stat-callout">
              <span className="k">E(R) CAPM = rf + β·(E(Rm) − rf)</span>
              <span className={`v ${signClass(stats.erCapm)}`}>{fmtPct(stats.erCapm * 100)}</span>
            </div>
            <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="cell">
                <span className="k">BETA (β)</span>
                <span className="v">{fmtNum(stats.beta, 3)}</span>
              </div>
              <div className="cell">
                <span className="k">JENSEN ALPHA (ann.)</span>
                <span className={`v ${signClass(stats.alphaAnn)}`}>
                  {fmtPct(stats.alphaAnn * 100)}
                </span>
              </div>
              <div className="cell">
                <span className="k">R²</span>
                <span className="v">{fmtNum(stats.r2, 3)}</span>
              </div>
              <div className="cell">
                <span className="k">CORRELATION (ρ)</span>
                <span className="v">{fmtNum(stats.corr, 3)}</span>
              </div>
              <div className="cell">
                <span className="k">VOL {symbol} (ann.)</span>
                <span className="v">{fmtPct(stats.volAsset * 100)}</span>
              </div>
              <div className="cell">
                <span className="k">VOL BENCH (ann.)</span>
                <span className="v">{fmtPct(stats.volBench * 100)}</span>
              </div>
              <div className="cell">
                <span className="k">E(Rm) HIST (ann.)</span>
                <span className={`v ${signClass(stats.erMarket)}`}>
                  {fmtPct(stats.erMarket * 100)}
                </span>
              </div>
              <div className="cell">
                <span className="k">RISK-FREE</span>
                <span className="v">{fmtPct(stats.rf * 100)}</span>
              </div>
              <div className="cell">
                <span className="k">SHARPE (hist)</span>
                <span className="v">{fmtNum(stats.sharpe, 2)}</span>
              </div>
              <div className="cell">
                <span className="k">OBSERVATIONS</span>
                <span className="v">{stats.n}</span>
              </div>
            </div>
            <div className="verdict">{smlVerdict}</div>
            <p className="note" style={{ padding: "0 10px 10px" }}>
              β and α estimated by OLS on daily log returns over the last year vs the selected
              benchmark; E(Rm) is the annualized historical mean of benchmark returns. Historical
              estimates — not investment advice.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
