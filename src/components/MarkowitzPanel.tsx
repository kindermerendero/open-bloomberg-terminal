"use client";

import { useEffect, useMemo, useState } from "react";
import type { Candle } from "@/lib/types";
import { alignMany, markowitz, type FrontierResult, type RiskClass } from "@/lib/quant";
import { fmtNum, fmtPct } from "@/lib/format";

const BENCHMARKS: Array<[string, string]> = [
  ["^GSPC", "S&P 500"],
  ["^IXIC", "NASDAQ"],
  ["^DJI", "DOW JONES"],
  ["^STOXX50E", "EURO STOXX 50"],
  ["FTSEMIB.MI", "FTSE MIB"],
];

const RISK_COLOR: Record<RiskClass, string> = {
  LOW: "var(--cyan)",
  MID: "var(--amber)",
  HIGH: "var(--down)",
};

interface Props {
  symbols: string[];
}

export default function MarkowitzPanel({ symbols }: Props) {
  const [benchmark, setBenchmark] = useState("^GSPC");
  const [allowShort, setAllowShort] = useState(true);
  const [rfPct, setRfPct] = useState<number | null>(null);
  const [result, setResult] = useState<FrontierResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // default risk-free: 13-week T-bill (^IRX)
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
    if (symbols.length < 2 || rfPct == null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const all = [...symbols, benchmark];
        const series = await Promise.all(
          all.map(async (s) => {
            const res = await fetch(`/api/history?symbol=${encodeURIComponent(s)}&range=1y`);
            const json = await res.json();
            if (!res.ok) throw new Error(`${s}: ${json.error ?? "load failed"}`);
            return json.candles as Candle[];
          })
        );
        if (cancelled) return;
        // align all (assets + benchmark) on common days
        const aligned = alignMany(series);
        const closes = aligned.slice(0, symbols.length);
        const bench = aligned[symbols.length];
        if (closes.some((c) => c.length < 30)) throw new Error("not enough overlapping history");
        const r = markowitz(symbols, closes, bench, rfPct / 100, allowShort);
        if (!r) throw new Error("optimization failed (singular covariance?)");
        setResult(r);
      } catch (e) {
        if (!cancelled) {
          setResult(null);
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbols, benchmark, rfPct, allowShort]);

  // ----- scatter geometry -----
  const plot = useMemo(() => {
    if (!result) return null;
    const W = 640;
    const H = 420;
    const m = { l: 56, r: 16, t: 16, b: 40 };
    // axis bounds from the meaningful points only — the random cloud can contain
    // extreme long/short portfolios that would otherwise blow up the scale
    const core = [
      ...result.frontier,
      ...result.assets.map((a) => ({ vol: a.vol, ret: a.ret })),
      result.gmv,
      ...(result.tangency ? [result.tangency] : []),
      { vol: 0, ret: result.rf },
    ];
    const vols = core.map((p) => p.vol);
    const rets = core.map((p) => p.ret);
    const xMin = 0;
    const xMax = Math.max(...vols) * 1.1;
    let yMin = Math.min(...rets);
    let yMax = Math.max(...rets);
    const pad = (yMax - yMin) * 0.1 || 0.02;
    yMin -= pad;
    yMax += pad;
    const sx = (v: number) => m.l + ((v - xMin) / (xMax - xMin)) * (W - m.l - m.r);
    const sy = (v: number) => H - m.b - ((v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    const inView = (p: { vol: number; ret: number }) =>
      p.vol >= xMin && p.vol <= xMax && p.ret >= yMin && p.ret <= yMax;
    return { W, H, m, sx, sy, xMin, xMax, yMin, yMax, inView };
  }, [result]);

  if (symbols.length < 2) {
    return (
      <div className="panel" style={{ flex: "1 1 auto" }}>
        <div className="panel-title">Markowitz — Mean-Variance Frontier</div>
        <div className="empty">
          Enter a portfolio — e.g. MKWZ AAPL,MSFT,NVDA,JPM,XOM (min 2 tickers)
        </div>
      </div>
    );
  }

  const xTicks = plot ? [0, 0.25, 0.5, 0.75, 1].map((f) => plot.xMin + f * (plot.xMax - plot.xMin)) : [];
  const yTicks = plot ? [0, 0.25, 0.5, 0.75, 1].map((f) => plot.yMin + f * (plot.yMax - plot.yMin)) : [];

  const line = (arr: { vol: number; ret: number }[]) =>
    plot ? arr.map((p, i) => `${i === 0 ? "M" : "L"}${plot.sx(p.vol)},${plot.sy(p.ret)}`).join(" ") : "";

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        Markowitz — {symbols.join(" / ")}
        <span className="sub">DAILY LOG RETURNS, 1Y · {allowShort ? "SHORT ALLOWED" : "LONG ONLY"}</span>
      </div>
      <div className="controls">
        <label>
          BENCHMARK (β)
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
        <label>
          SHORT SELLING
          <div className="seg">
            <button className={allowShort ? "active" : ""} onClick={() => setAllowShort(true)}>
              ALLOWED
            </button>
            <button className={!allowShort ? "active" : ""} onClick={() => setAllowShort(false)}>
              LONG ONLY
            </button>
          </div>
        </label>
      </div>
      <div className="panel-body">
        {loading && <div className="loading">OPTIMIZING…</div>}
        {error && <div className="empty">ERR: {error}</div>}
        {result && plot && !loading && (
          <>
            <div className="mkwz-grid">
              <svg viewBox={`0 0 ${plot.W} ${plot.H}`} className="mkwz-svg">
                {/* axes */}
                <line x1={plot.m.l} y1={plot.H - plot.m.b} x2={plot.W - plot.m.r} y2={plot.H - plot.m.b} stroke="#3d2a00" />
                <line x1={plot.m.l} y1={plot.m.t} x2={plot.m.l} y2={plot.H - plot.m.b} stroke="#3d2a00" />
                {xTicks.map((t, i) => (
                  <g key={`xt-${i}`}>
                    <line x1={plot.sx(t)} y1={plot.m.t} x2={plot.sx(t)} y2={plot.H - plot.m.b} stroke="#1a1200" />
                    <text x={plot.sx(t)} y={plot.H - plot.m.b + 16} className="mkwz-axis" textAnchor="middle">
                      {fmtNum(t * 100, 0)}%
                    </text>
                  </g>
                ))}
                {yTicks.map((t, i) => (
                  <g key={`yt-${i}`}>
                    <line x1={plot.m.l} y1={plot.sy(t)} x2={plot.W - plot.m.r} y2={plot.sy(t)} stroke="#1a1200" />
                    <text x={plot.m.l - 6} y={plot.sy(t) + 3} className="mkwz-axis" textAnchor="end">
                      {fmtNum(t * 100, 0)}%
                    </text>
                  </g>
                ))}
                <text x={plot.W / 2} y={plot.H - 4} className="mkwz-axis" textAnchor="middle">
                  RISK σ (ann. volatility)
                </text>
                <text x={14} y={plot.m.t + 6} className="mkwz-axis">
                  E(R)
                </text>

                {/* feasible region cloud */}
                {result.cloud.filter(plot.inView).map((p, i) => (
                  <circle key={`c-${i}`} cx={plot.sx(p.vol)} cy={plot.sy(p.ret)} r={1.1} fill="var(--white)" opacity={0.35} />
                ))}
                {/* frontier hyperbola */}
                <path d={line(result.frontier)} fill="none" stroke="var(--amber)" strokeWidth={1.6} />
                {/* capital market line */}
                {result.cml.length > 0 && (
                  <path d={line(result.cml)} fill="none" stroke="var(--cyan)" strokeWidth={1} strokeDasharray="4 3" />
                )}
                {/* GMV */}
                <circle cx={plot.sx(result.gmv.vol)} cy={plot.sy(result.gmv.ret)} r={4} fill="var(--white)" />
                <text x={plot.sx(result.gmv.vol) + 7} y={plot.sy(result.gmv.ret) + 3} className="mkwz-lbl">GMV</text>
                {/* tangency */}
                {result.tangency && (
                  <>
                    <circle cx={plot.sx(result.tangency.vol)} cy={plot.sy(result.tangency.ret)} r={4} fill="var(--yellow)" />
                    <text x={plot.sx(result.tangency.vol) + 7} y={plot.sy(result.tangency.ret) + 3} className="mkwz-lbl">TAN</text>
                  </>
                )}
                {/* rf */}
                <circle cx={plot.sx(0)} cy={plot.sy(result.rf)} r={3} fill="var(--cyan)" />
                {/* individual assets, colored by beta risk class */}
                {result.assets.map((a) => (
                  <g key={a.symbol}>
                    <rect
                      x={plot.sx(a.vol) - 3}
                      y={plot.sy(a.ret) - 3}
                      width={6}
                      height={6}
                      fill={RISK_COLOR[a.riskClass]}
                    />
                    <text x={plot.sx(a.vol) + 6} y={plot.sy(a.ret) + 3} className="mkwz-tick">
                      {a.symbol}
                    </text>
                  </g>
                ))}
              </svg>

              <div className="mkwz-side">
                <div className="stat-callout">
                  <span className="k">TANGENCY SHARPE</span>
                  <span className="v">{result.tangency ? fmtNum(result.tangency.sharpe, 3) : "—"}</span>
                </div>
                <div className="quote-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <div className="cell">
                    <span className="k">GMV RET</span>
                    <span className="v">{fmtPct(result.gmv.ret * 100)}</span>
                  </div>
                  <div className="cell">
                    <span className="k">GMV VOL</span>
                    <span className="v">{fmtPct(result.gmv.vol * 100)}</span>
                  </div>
                  <div className="cell">
                    <span className="k">TAN RET</span>
                    <span className="v">{result.tangency ? fmtPct(result.tangency.ret * 100) : "—"}</span>
                  </div>
                  <div className="cell">
                    <span className="k">TAN VOL</span>
                    <span className="v">{result.tangency ? fmtPct(result.tangency.vol * 100) : "—"}</span>
                  </div>
                </div>
                <div className="mkwz-legend">
                  <span><i style={{ background: RISK_COLOR.LOW }} /> LOW β&lt;0.8</span>
                  <span><i style={{ background: RISK_COLOR.MID }} /> MID 0.8–1.2</span>
                  <span><i style={{ background: RISK_COLOR.HIGH }} /> HIGH β&gt;1.2</span>
                </div>
              </div>
            </div>

            {/* per-asset table with weights */}
            <table className="mkwz-table">
              <thead>
                <tr>
                  <th>TICKER</th>
                  <th>E(R)</th>
                  <th>σ</th>
                  <th>β</th>
                  <th>CLASS</th>
                  <th>w GMV</th>
                  <th>w TAN</th>
                </tr>
              </thead>
              <tbody>
                {result.assets.map((a, i) => (
                  <tr key={a.symbol}>
                    <td style={{ color: RISK_COLOR[a.riskClass] }}>{a.symbol}</td>
                    <td>{fmtPct(a.ret * 100)}</td>
                    <td>{fmtPct(a.vol * 100)}</td>
                    <td>{fmtNum(a.beta, 2)}</td>
                    <td>{a.riskClass}</td>
                    <td>{fmtPct(result.gmv.weights[i] * 100)}</td>
                    <td>{result.tangency ? fmtPct(result.tangency.weights[i] * 100) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note" style={{ padding: "0 10px 10px" }}>
              {allowShort
                ? "Closed-form mean-variance frontier (Merton 1972) on annualized daily log returns, short selling allowed (Σwᵢ=1, no sign constraint)."
                : "Long-only mean-variance frontier (w≥0, Σwᵢ=1) solved numerically by projected-gradient QP over a risk-aversion sweep."}{" "}
              Amber curve = efficient frontier, dark cloud = feasible region (random portfolios), cyan
              dashed = capital market line, GMV = global minimum variance, TAN = max-Sharpe tangency.
              Squares are single assets colored by β risk class. Historical estimates — not investment
              advice.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
