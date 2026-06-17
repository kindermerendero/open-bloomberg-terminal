"use client";

import { useEffect, useMemo, useState } from "react";
import { bondAnalytics, bondYTM } from "@/lib/quant";
import { fmtNum, fmtPct } from "@/lib/format";

interface CurvePoint {
  label: string;
  years: number;
  yield: number;
}
interface CurveData {
  date: string;
  points: CurvePoint[];
  spread10_2: number | null;
  shape: string;
}

type Mode = "price" | "ytm"; // solve for price (given yield) or yield (given price)

export default function BondPanel() {
  const [curve, setCurve] = useState<CurveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // bond calculator inputs
  const [face] = useState(100);
  const [couponPct, setCouponPct] = useState(4);
  const [years, setYears] = useState(10);
  const [freq, setFreq] = useState(2);
  const [mode, setMode] = useState<Mode>("price");
  const [yieldPct, setYieldPct] = useState(4.5);
  const [priceIn, setPriceIn] = useState(96);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/treasury");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "treasury load failed");
        setCurve(json);
        // seed yield from the 10Y point
        const ten = (json.points as CurvePoint[]).find((p) => p.years === 10);
        if (ten) setYieldPct(ten.yield);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const analytics = useMemo(() => {
    if (mode === "price") {
      return bondAnalytics(face, couponPct / 100, yieldPct / 100, years, freq);
    }
    const y = bondYTM(priceIn, face, couponPct / 100, years, freq);
    if (!Number.isFinite(y)) return null;
    return bondAnalytics(face, couponPct / 100, y, years, freq);
  }, [mode, face, couponPct, yieldPct, priceIn, years, freq]);

  // ----- yield-curve geometry -----
  const plot = useMemo(() => {
    if (!curve || curve.points.length < 2) return null;
    const W = 640;
    const H = 240;
    const m = { l: 44, r: 16, t: 16, b: 32 };
    const xs = curve.points.map((p) => Math.log(p.years)); // log scale on maturity
    const ys = curve.points.map((p) => p.yield);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys) - 0.2;
    const yMax = Math.max(...ys) + 0.2;
    const sx = (yr: number) => m.l + ((Math.log(yr) - xMin) / (xMax - xMin)) * (W - m.l - m.r);
    const sy = (v: number) => H - m.b - ((v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    return { W, H, m, sx, sy, yMin, yMax };
  }, [curve]);

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        Fixed Income — US Treasury Term Structure
        <span className="sub">{curve ? `PAR YIELD · ${curve.date}` : "TREASURY.GOV"}</span>
      </div>
      <div className="panel-body">
        {loading && <div className="loading">LOADING CURVE…</div>}
        {error && <div className="empty">ERR: {error}</div>}

        {curve && plot && (
          <>
            <div className="bond-curvehdr">
              <span>
                10Y–2Y SPREAD:{" "}
                <b className={curve.spread10_2 != null && curve.spread10_2 < 0 ? "down" : "up"}>
                  {curve.spread10_2 != null ? `${fmtNum(curve.spread10_2 * 100, 0)} bp` : "—"}
                </b>
              </span>
              <span>
                CURVE: <b>{curve.shape}</b>
              </span>
            </div>
            <svg viewBox={`0 0 ${plot.W} ${plot.H}`} className="bond-svg">
              <line x1={plot.m.l} y1={plot.H - plot.m.b} x2={plot.W - plot.m.r} y2={plot.H - plot.m.b} stroke="#3d2a00" />
              <line x1={plot.m.l} y1={plot.m.t} x2={plot.m.l} y2={plot.H - plot.m.b} stroke="#3d2a00" />
              {[plot.yMin, (plot.yMin + plot.yMax) / 2, plot.yMax].map((t, i) => (
                <g key={`gy-${i}`}>
                  <line x1={plot.m.l} y1={plot.sy(t)} x2={plot.W - plot.m.r} y2={plot.sy(t)} stroke="#1a1200" />
                  <text x={plot.m.l - 6} y={plot.sy(t) + 3} className="mkwz-axis" textAnchor="end">
                    {fmtNum(t, 1)}%
                  </text>
                </g>
              ))}
              <path
                d={curve.points.map((p, i) => `${i === 0 ? "M" : "L"}${plot.sx(p.years)},${plot.sy(p.yield)}`).join(" ")}
                fill="none"
                stroke="var(--amber)"
                strokeWidth={1.8}
              />
              {curve.points.map((p) => (
                <g key={p.label}>
                  <circle cx={plot.sx(p.years)} cy={plot.sy(p.yield)} r={2.5} fill="var(--yellow)" />
                  <text x={plot.sx(p.years)} y={plot.H - plot.m.b + 14} className="mkwz-tick" textAnchor="middle">
                    {p.label.replace(" ", "")}
                  </text>
                </g>
              ))}
            </svg>

            {/* bond calculator */}
            <div className="panel-title" style={{ marginTop: 8 }}>
              Bond Calculator
              <span className="sub">FIXED-COUPON, SEMI-ANNUAL DEFAULT</span>
            </div>
            <div className="controls">
              <div className="seg">
                <button className={mode === "price" ? "active" : ""} onClick={() => setMode("price")}>
                  YIELD→PRICE
                </button>
                <button className={mode === "ytm" ? "active" : ""} onClick={() => setMode("ytm")}>
                  PRICE→YTM
                </button>
              </div>
              <label>
                COUPON %
                <input type="number" step="0.125" value={couponPct} onChange={(e) => setCouponPct(parseFloat(e.target.value) || 0)} />
              </label>
              <label>
                YEARS
                <input type="number" step="0.5" min={0.5} value={years} onChange={(e) => setYears(parseFloat(e.target.value) || 0.5)} />
              </label>
              <label>
                FREQ/Y
                <input type="number" min={1} max={12} value={freq} onChange={(e) => setFreq(parseInt(e.target.value) || 1)} />
              </label>
              {mode === "price" ? (
                <label>
                  YIELD %
                  <input type="number" step="0.05" value={yieldPct} onChange={(e) => setYieldPct(parseFloat(e.target.value) || 0)} />
                </label>
              ) : (
                <label>
                  PRICE
                  <input type="number" step="0.5" value={priceIn} onChange={(e) => setPriceIn(parseFloat(e.target.value) || 0)} />
                </label>
              )}
            </div>

            {analytics ? (
              <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="cell">
                  <span className="k">{mode === "price" ? "PRICE (per 100)" : "YTM"}</span>
                  <span className="v">{mode === "price" ? fmtNum(analytics.price, 3) : fmtPct(analytics.ytm * 100)}</span>
                </div>
                <div className="cell">
                  <span className="k">{mode === "price" ? "YIELD" : "PRICE"}</span>
                  <span className="v">{mode === "price" ? fmtPct(yieldPct) : fmtNum(analytics.price, 3)}</span>
                </div>
                <div className="cell">
                  <span className="k">CURRENT YIELD</span>
                  <span className="v">{fmtPct(analytics.currentYield * 100)}</span>
                </div>
                <div className="cell">
                  <span className="k">MACAULAY DUR</span>
                  <span className="v">{fmtNum(analytics.macaulay, 3)} y</span>
                </div>
                <div className="cell">
                  <span className="k">MODIFIED DUR</span>
                  <span className="v">{fmtNum(analytics.modified, 3)}</span>
                </div>
                <div className="cell">
                  <span className="k">CONVEXITY</span>
                  <span className="v">{fmtNum(analytics.convexity, 2)}</span>
                </div>
              </div>
            ) : (
              <div className="empty">No yield solves for that price — check inputs</div>
            )}
            <p className="note" style={{ padding: "0 10px 10px" }}>
              Term structure: US Treasury par yields (Treasury.gov, daily). 10Y–2Y spread inversion
              is a classic recession signal. Bond calculator: price = Σ coupon/(1+y/m)ᵏ + face/(1+y/m)ⁿ;
              YTM solved by bisection; modified duration = Macaulay/(1+y/m); convexity in year².
            </p>
          </>
        )}
      </div>
    </div>
  );
}
