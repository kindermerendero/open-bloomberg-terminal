"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { bondAnalytics, bondYTM } from "@/lib/quant";
import { fmtNum, fmtPct } from "@/lib/format";

interface CurvePoint {
  label: string;
  years: number;
  yield: number;
}
interface DatedCurve {
  date: string;
  points: CurvePoint[];
}
interface TermData {
  source: string;
  label: string;
  curves: DatedCurve[];
  spreadHistory: { date: string; spread: number }[];
}

type Source = "us" | "ez";
type Mode = "price" | "ytm";

const DAY = 86400000;
const ms = (iso: string) => Date.parse(iso);

function shapeOf(spread: number | null): string {
  if (spread == null) return "n/a";
  return spread < -0.05 ? "INVERTED" : spread < 0.2 ? "FLAT" : "NORMAL";
}

export default function BondPanel() {
  const [source, setSource] = useState<Source>("us");
  const [data, setData] = useState<TermData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // term-structure view state
  const [selIdx, setSelIdx] = useState(0); // 0 = latest curve
  const [showM1, setShowM1] = useState(false);
  const [showY1, setShowY1] = useState(false);
  const [playing, setPlaying] = useState(false);

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
    setError("");
    setPlaying(false);
    (async () => {
      try {
        const res = await fetch(`/api/treasury?source=${source}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "term structure load failed");
        setData(json);
        setSelIdx(0);
        const ten = (json.curves?.[0]?.points as CurvePoint[] | undefined)?.find((p) => p.years === 10);
        if (ten) setYieldPct(Number(ten.yield.toFixed(2)));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const curves = data?.curves ?? [];
  const lastIdx = curves.length - 1;

  // animation: step through dates from oldest to newest
  const playRef = useRef(playing);
  playRef.current = playing;
  useEffect(() => {
    if (!playing || curves.length < 2) return;
    const id = setInterval(() => {
      setSelIdx((i) => (i <= 0 ? lastIdx : i - 1));
    }, 110);
    return () => clearInterval(id);
  }, [playing, lastIdx, curves.length]);

  const curve = curves[selIdx] ?? null;

  // nearest curve to a target time (for the comparison overlays)
  const nearest = (targetMs: number): DatedCurve | null => {
    if (!curves.length) return null;
    let best = curves[0];
    let bestD = Infinity;
    for (const c of curves) {
      const d = Math.abs(ms(c.date) - targetMs);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  };

  const cmpM1 = useMemo(
    () => (showM1 && curve ? nearest(ms(curve.date) - 30 * DAY) : null),
    [showM1, curve, curves]
  );
  const cmpY1 = useMemo(
    () => (showY1 && curve ? nearest(ms(curve.date) - 365 * DAY) : null),
    [showY1, curve, curves]
  );

  const spread10_2 = useMemo(() => {
    if (!curve) return null;
    const y2 = curve.points.find((p) => p.years === 2)?.yield;
    const y10 = curve.points.find((p) => p.years === 10)?.yield;
    return y2 != null && y10 != null ? y10 - y2 : null;
  }, [curve]);

  const analytics = useMemo(() => {
    if (mode === "price") return bondAnalytics(face, couponPct / 100, yieldPct / 100, years, freq);
    const y = bondYTM(priceIn, face, couponPct / 100, years, freq);
    if (!Number.isFinite(y)) return null;
    return bondAnalytics(face, couponPct / 100, y, years, freq);
  }, [mode, face, couponPct, yieldPct, priceIn, years, freq]);

  // ----- yield-curve geometry (log scale on maturity) -----
  const plot = useMemo(() => {
    if (!curve || curve.points.length < 2) return null;
    const W = 640;
    const H = 240;
    const m = { l: 44, r: 16, t: 16, b: 32 };
    const shown = [curve, cmpM1, cmpY1].filter((c): c is DatedCurve => c != null);
    const all = shown.flatMap((c) => c.points);
    const xs = all.map((p) => Math.log(p.years));
    const ys = all.map((p) => p.yield);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys) - 0.2;
    const yMax = Math.max(...ys) + 0.2;
    const sx = (yr: number) => m.l + ((Math.log(yr) - xMin) / (xMax - xMin)) * (W - m.l - m.r);
    const sy = (v: number) => H - m.b - ((v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    const path = (pts: CurvePoint[]) =>
      pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.years)},${sy(p.yield)}`).join(" ");
    return { W, H, m, sx, sy, yMin, yMax, path };
  }, [curve, cmpM1, cmpY1]);

  // ----- spread-history sparkline -----
  const spark = useMemo(() => {
    const hist = data?.spreadHistory ?? [];
    if (hist.length < 2) return null;
    const W = 640;
    const H = 96;
    const m = { l: 44, r: 16, t: 10, b: 18 };
    const stride = Math.max(1, Math.ceil(hist.length / 220));
    const pts = hist.filter((_, i) => i % stride === 0 || i === hist.length - 1);
    const vals = pts.map((p) => p.spread);
    const yMin = Math.min(0, ...vals);
    const yMax = Math.max(0, ...vals);
    const sx = (i: number) => m.l + (i / (pts.length - 1)) * (W - m.l - m.r);
    const sy = (v: number) => H - m.b - ((v - yMin) / (yMax - yMin || 1)) * (H - m.t - m.b);
    // split into segments so inverted (spread<0) stretches render red
    const segs: Array<{ d: string; neg: boolean }> = [];
    for (let i = 1; i < pts.length; i++) {
      const neg = pts[i - 1].spread < 0 || pts[i].spread < 0;
      segs.push({
        d: `M${sx(i - 1)},${sy(pts[i - 1].spread)} L${sx(i)},${sy(pts[i].spread)}`,
        neg,
      });
    }
    // marker for the currently selected date
    const selDate = curve ? ms(curve.date) : null;
    let markX: number | null = null;
    if (selDate != null) {
      let bi = 0;
      let bd = Infinity;
      pts.forEach((p, i) => {
        const d = Math.abs(ms(p.date) - selDate);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      markX = sx(bi);
    }
    return { W, H, m, sx, sy, yMin, yMax, segs, zeroY: sy(0), markX, first: pts[0], last: pts[pts.length - 1] };
  }, [data, curve]);

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        Fixed Income — {source === "ez" ? "Euro Area" : "US Treasury"} Term Structure
        <span className="sub">{curve ? `${data?.label} · ${curve.date}` : "FREE PUBLIC DATA"}</span>
      </div>

      <div className="controls">
        <label>
          MARKET
          <div className="seg">
            <button className={source === "us" ? "active" : ""} onClick={() => setSource("us")}>
              US TREASURY
            </button>
            <button className={source === "ez" ? "active" : ""} onClick={() => setSource("ez")}>
              EURO AREA
            </button>
          </div>
        </label>
        <label>
          COMPARE
          <div className="seg">
            <button className={showM1 ? "active" : ""} onClick={() => setShowM1((v) => !v)}>
              vs 1M
            </button>
            <button className={showY1 ? "active" : ""} onClick={() => setShowY1((v) => !v)}>
              vs 1Y
            </button>
          </div>
        </label>
        <label>
          PLAYBACK
          <div className="seg">
            <button className={playing ? "active" : ""} onClick={() => setPlaying((v) => !v)}>
              {playing ? "❚❚ STOP" : "▶ PLAY"}
            </button>
          </div>
        </label>
      </div>

      <div className="panel-body">
        {loading && <div className="loading">LOADING CURVE…</div>}
        {error && <div className="empty">ERR: {error}</div>}

        {curve && plot && (
          <>
            <div className="bond-curvehdr">
              <span>
                10Y–2Y SPREAD:{" "}
                <b className={spread10_2 != null && spread10_2 < 0 ? "down" : "up"}>
                  {spread10_2 != null ? `${fmtNum(spread10_2 * 100, 0)} bp` : "—"}
                </b>
              </span>
              <span>
                CURVE: <b>{shapeOf(spread10_2)}</b>
              </span>
              <span className="ts-legend">
                <i style={{ background: "var(--amber)" }} /> {curve.date}
                {cmpM1 && (
                  <>
                    {" "}
                    <i style={{ background: "var(--cyan)" }} /> {cmpM1.date}
                  </>
                )}
                {cmpY1 && (
                  <>
                    {" "}
                    <i style={{ background: "var(--text-dim)" }} /> {cmpY1.date}
                  </>
                )}
              </span>
            </div>

            <svg viewBox={`0 0 ${plot.W} ${plot.H}`} className="bond-svg">
              <line x1={plot.m.l} y1={plot.H - plot.m.b} x2={plot.W - plot.m.r} y2={plot.H - plot.m.b} stroke="var(--grid)" />
              <line x1={plot.m.l} y1={plot.m.t} x2={plot.m.l} y2={plot.H - plot.m.b} stroke="var(--grid)" />
              {[plot.yMin, (plot.yMin + plot.yMax) / 2, plot.yMax].map((t, i) => (
                <g key={`gy-${i}`}>
                  <line x1={plot.m.l} y1={plot.sy(t)} x2={plot.W - plot.m.r} y2={plot.sy(t)} stroke="var(--grid-faint)" />
                  <text x={plot.m.l - 6} y={plot.sy(t) + 3} className="mkwz-axis" textAnchor="end">
                    {fmtNum(t, 1)}%
                  </text>
                </g>
              ))}
              {/* comparison overlays (drawn under the latest curve) */}
              {cmpY1 && <path d={plot.path(cmpY1.points)} fill="none" stroke="var(--text-dim)" strokeWidth={1.2} strokeDasharray="3 3" />}
              {cmpM1 && <path d={plot.path(cmpM1.points)} fill="none" stroke="var(--cyan)" strokeWidth={1.2} strokeDasharray="4 2" />}
              {/* selected curve */}
              <path d={plot.path(curve.points)} fill="none" stroke="var(--amber)" strokeWidth={1.8} />
              {curve.points.map((p) => (
                <g key={p.label}>
                  <circle cx={plot.sx(p.years)} cy={plot.sy(p.yield)} r={2.5} fill="var(--yellow)" />
                  <text x={plot.sx(p.years)} y={plot.H - plot.m.b + 14} className="mkwz-tick" textAnchor="middle">
                    {p.label}
                  </text>
                </g>
              ))}
            </svg>

            {/* date scrubber */}
            <div className="ts-scrub">
              <span className="k">DATE</span>
              <input
                type="range"
                min={0}
                max={lastIdx}
                value={lastIdx - selIdx}
                onChange={(e) => {
                  setPlaying(false);
                  setSelIdx(lastIdx - parseInt(e.target.value));
                }}
              />
              <span className="v">{curve.date}</span>
              {selIdx !== 0 && (
                <button className="ts-latest" onClick={() => setSelIdx(0)}>
                  ⤒ LATEST
                </button>
              )}
            </div>

            {/* 10Y–2Y spread history */}
            {spark && (
              <>
                <div className="bond-curvehdr" style={{ marginTop: 4 }}>
                  <span>10Y–2Y SPREAD HISTORY</span>
                  <span className="hint">red = inverted (10Y &lt; 2Y) · recession signal</span>
                </div>
                <svg viewBox={`0 0 ${spark.W} ${spark.H}`} className="bond-svg">
                  <line x1={spark.m.l} y1={spark.zeroY} x2={spark.W - spark.m.r} y2={spark.zeroY} stroke="var(--grid)" strokeDasharray="2 2" />
                  <text x={spark.m.l - 6} y={spark.zeroY + 3} className="mkwz-axis" textAnchor="end">0</text>
                  <text x={spark.m.l - 6} y={spark.sy(spark.yMax) + 3} className="mkwz-axis" textAnchor="end">
                    {fmtNum(spark.yMax * 100, 0)}
                  </text>
                  <text x={spark.m.l - 6} y={spark.sy(spark.yMin) + 3} className="mkwz-axis" textAnchor="end">
                    {fmtNum(spark.yMin * 100, 0)}
                  </text>
                  {spark.segs.map((s, i) => (
                    <path key={`sp-${i}`} d={s.d} fill="none" stroke={s.neg ? "var(--down)" : "var(--amber)"} strokeWidth={1.3} />
                  ))}
                  {spark.markX != null && (
                    <line x1={spark.markX} y1={spark.m.t} x2={spark.markX} y2={spark.H - spark.m.b} stroke="var(--yellow)" strokeWidth={1} />
                  )}
                  <text x={spark.m.l} y={spark.H - 4} className="mkwz-axis">{spark.first.date}</text>
                  <text x={spark.W - spark.m.r} y={spark.H - 4} className="mkwz-axis" textAnchor="end">{spark.last.date}</text>
                </svg>
              </>
            )}

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
              Term structure: {source === "ez" ? "euro area AAA spot rates (ECB Data Portal)" : "US Treasury par yields (Treasury.gov)"},
              daily. Scrub the date, overlay 1M/1Y-ago curves or hit PLAY to animate ~2y of history.
              10Y–2Y inversion is a classic recession signal. Bond calculator: price = Σ coupon/(1+y/m)ᵏ +
              face/(1+y/m)ⁿ; YTM by bisection; modified duration = Macaulay/(1+y/m); convexity in year².
            </p>
          </>
        )}
      </div>
    </div>
  );
}
