"use client";

import { useEffect, useState } from "react";
import type { Candle, Quote } from "@/lib/types";
import { capmStats, type CapmStats } from "@/lib/quant";
import { fmtNum, fmtPct, signClass } from "@/lib/format";
import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();
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
        <div className="panel-title">{t("capm.titleEmpty")}</div>
        <div className="empty">{t("capm.loadFirst")}</div>
      </div>
    );
  }

  const smlVerdict =
    stats == null
      ? ""
      : stats.alphaAnn > 0.005
        ? t("capm.smlAbove")
        : stats.alphaAnn < -0.005
          ? t("capm.smlBelow")
          : t("capm.smlOn");

  // Security Market Line geometry: x = β, y = expected return. The asset's actual
  // return sits above/below the line by Jensen's alpha.
  const sml = (() => {
    if (!stats) return null;
    const W = 640;
    const H = 232;
    const m = { l: 52, r: 16, t: 16, b: 34 };
    const assetRet = stats.erCapm + stats.alphaAnn; // actual annualized return
    const betaMax = Math.max(1.4, stats.beta * 1.25);
    const line1 = stats.rf + betaMax * (stats.erMarket - stats.rf); // SML at βmax
    const ys = [stats.rf, stats.erMarket, assetRet, stats.erCapm, line1, 0];
    let yMin = Math.min(...ys);
    let yMax = Math.max(...ys);
    const pad = (yMax - yMin) * 0.12 || 0.02;
    yMin -= pad;
    yMax += pad;
    const sx = (b: number) => m.l + (b / betaMax) * (W - m.l - m.r);
    const sy = (v: number) => H - m.b - ((v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    return { W, H, m, sx, sy, betaMax, assetRet, line0: stats.rf, line1, yMin, yMax };
  })();

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        CAPM — {symbol} {quote ? `@ ${fmtNum(quote.price)}` : ""}
        <span className="sub">{t("capm.sub")}</span>
      </div>
      <div className="controls">
        <label>
          {t("capm.benchmark")}
          <select value={benchmark} onChange={(e) => setBenchmark(e.target.value)}>
            {BENCHMARKS.map(([sym, name]) => (
              <option key={sym} value={sym}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("capm.riskFree")}
          <input
            type="number"
            step="0.05"
            value={rfPct ?? ""}
            onChange={(e) => setRfPct(parseFloat(e.target.value) || 0)}
          />
        </label>
        <span className="hint">{t("capm.rfHint")}</span>
      </div>
      <div className="panel-body">
        {loading && <div className="loading">{t("common.computing")}</div>}
        {error && <div className="empty">{t("common.err")}: {error}</div>}
        {stats && !loading && (
          <>
            <div className="stat-callout">
              <span className="k">{t("capm.erFormula")}</span>
              <span className={`v ${signClass(stats.erCapm)}`}>{fmtPct(stats.erCapm * 100)}</span>
            </div>
            <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="cell">
                <span className="k">{t("capm.beta")}</span>
                <span className="v">{fmtNum(stats.beta, 3)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("capm.alpha")}</span>
                <span className={`v ${signClass(stats.alphaAnn)}`}>
                  {fmtPct(stats.alphaAnn * 100)}
                </span>
              </div>
              <div className="cell">
                <span className="k">{t("capm.r2")}</span>
                <span className="v">{fmtNum(stats.r2, 3)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("capm.corr")}</span>
                <span className="v">{fmtNum(stats.corr, 3)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("capm.volAsset", { sym: symbol })}</span>
                <span className="v">{fmtPct(stats.volAsset * 100)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("capm.volBench")}</span>
                <span className="v">{fmtPct(stats.volBench * 100)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("capm.erMarket")}</span>
                <span className={`v ${signClass(stats.erMarket)}`}>
                  {fmtPct(stats.erMarket * 100)}
                </span>
              </div>
              <div className="cell">
                <span className="k">{t("capm.rf")}</span>
                <span className="v">{fmtPct(stats.rf * 100)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("capm.sharpe")}</span>
                <span className="v">{fmtNum(stats.sharpe, 2)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("capm.obs")}</span>
                <span className="v">{stats.n}</span>
              </div>
            </div>
            {sml && (
              <>
                <div className="panel-title" style={{ marginTop: 8 }}>
                  {t("capm.smlTitle")}
                  <span className="sub">{t("capm.smlSub")}</span>
                </div>
                <svg viewBox={`0 0 ${sml.W} ${sml.H}`} className="bond-svg">
                  <line x1={sml.m.l} y1={sml.H - sml.m.b} x2={sml.W - sml.m.r} y2={sml.H - sml.m.b} stroke="var(--grid)" />
                  <line x1={sml.m.l} y1={sml.m.t} x2={sml.m.l} y2={sml.H - sml.m.b} stroke="var(--grid)" />
                  {[sml.yMin, (sml.yMin + sml.yMax) / 2, sml.yMax].map((t, i) => (
                    <g key={`sy-${i}`}>
                      <line x1={sml.m.l} y1={sml.sy(t)} x2={sml.W - sml.m.r} y2={sml.sy(t)} stroke="var(--grid-faint)" />
                      <text x={sml.m.l - 6} y={sml.sy(t) + 3} className="mkwz-axis" textAnchor="end">{fmtNum(t * 100, 0)}%</text>
                    </g>
                  ))}
                  {[0, 0.5, 1, sml.betaMax].map((b, i) => (
                    <text key={`sxb-${i}`} x={sml.sx(b)} y={sml.H - sml.m.b + 14} className="mkwz-axis" textAnchor="middle">{fmtNum(b, 1)}</text>
                  ))}
                  {/* SML */}
                  <line x1={sml.sx(0)} y1={sml.sy(sml.line0)} x2={sml.sx(sml.betaMax)} y2={sml.sy(sml.line1)} stroke="var(--amber)" strokeWidth={1.6} />
                  {/* alpha gap (asset actual vs SML-predicted) */}
                  <line x1={sml.sx(stats.beta)} y1={sml.sy(stats.erCapm)} x2={sml.sx(stats.beta)} y2={sml.sy(sml.assetRet)} stroke={stats.alphaAnn >= 0 ? "var(--up)" : "var(--down)"} strokeWidth={1.2} strokeDasharray="3 2" />
                  {/* rf */}
                  <circle cx={sml.sx(0)} cy={sml.sy(sml.line0)} r={3} fill="var(--cyan)" />
                  <text x={sml.sx(0) + 6} y={sml.sy(sml.line0) - 4} className="mkwz-axis" fill="var(--cyan)">rf</text>
                  {/* market */}
                  <circle cx={sml.sx(1)} cy={sml.sy(stats.erMarket)} r={3.5} fill="var(--white)" />
                  <text x={sml.sx(1) + 6} y={sml.sy(stats.erMarket) - 4} className="mkwz-lbl">MKT</text>
                  {/* SML-predicted point */}
                  <circle cx={sml.sx(stats.beta)} cy={sml.sy(stats.erCapm)} r={2.5} fill="none" stroke="var(--amber)" />
                  {/* asset actual */}
                  <circle cx={sml.sx(stats.beta)} cy={sml.sy(sml.assetRet)} r={4} fill="var(--yellow)" />
                  <text x={sml.sx(stats.beta) + 6} y={sml.sy(sml.assetRet) + 3} className="mkwz-lbl">{symbol} (α {fmtPct(stats.alphaAnn * 100)})</text>
                  <text x={sml.W / 2} y={sml.H - 3} className="mkwz-axis" textAnchor="middle">BETA (β)</text>
                  <text x={sml.m.l - 6} y={sml.m.t - 6} className="mkwz-axis" textAnchor="end">E(R)</text>
                </svg>
              </>
            )}

            <div className="verdict">{smlVerdict}</div>
            <p className="note" style={{ padding: "0 10px 10px" }}>
              {t("capm.note")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
