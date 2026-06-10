"use client";

import { useEffect, useMemo, useState } from "react";
import type { Candle, Quote } from "@/lib/types";
import {
  annualizedVol,
  binomialPrice,
  blackScholes,
  logReturns,
  type ExerciseStyle,
  type OptionType,
} from "@/lib/quant";
import { fmtNum } from "@/lib/format";

interface Props {
  symbol: string | null;
  quote: Quote | null;
}

function niceStrike(price: number): number {
  if (price >= 1000) return Math.round(price / 50) * 50;
  if (price >= 100) return Math.round(price / 5) * 5;
  if (price >= 10) return Math.round(price);
  return Number(price.toFixed(2));
}

export default function LatticePanel({ symbol, quote }: Props) {
  const S0 = quote?.price ?? 0;
  const [strike, setStrike] = useState(0);
  const [months, setMonths] = useState(6);
  const [sigmaPct, setSigmaPct] = useState(30);
  const [rPct, setRPct] = useState<number | null>(null);
  const [steps, setSteps] = useState(5);
  const [type, setType] = useState<OptionType>("call");
  const [exercise, setExercise] = useState<ExerciseStyle>("eu");

  // defaults from market data: ATM strike, historical sigma, ^IRX risk-free
  useEffect(() => {
    if (S0 > 0) setStrike(niceStrike(S0));
  }, [symbol, S0 > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=1y`);
        const json = await res.json();
        if (cancelled || !res.ok) return;
        const rets = logReturns((json.candles as Candle[]).map((c) => c.close));
        if (rets.length > 30) setSigmaPct(Number((annualizedVol(rets) * 100).toFixed(1)));
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    if (rPct != null) return;
    (async () => {
      try {
        const res = await fetch("/api/quote?symbols=%5EIRX");
        const json = await res.json();
        const px = json.quotes?.[0]?.price;
        setRPct(px != null ? Number(px.toFixed(2)) : 4);
      } catch {
        setRPct(4);
      }
    })();
  }, [rPct]);

  const params = useMemo(() => {
    if (S0 <= 0 || strike <= 0 || months <= 0 || sigmaPct <= 0 || rPct == null) return null;
    return {
      S0,
      K: strike,
      T: months / 12,
      sigma: sigmaPct / 100,
      r: rPct / 100,
      type,
      exercise,
    };
  }, [S0, strike, months, sigmaPct, rPct, type, exercise]);

  const result = useMemo(
    () => (params ? binomialPrice({ ...params, steps: Math.min(Math.max(steps, 1), 8) }) : null),
    [params, steps]
  );
  const fine = useMemo(
    () => (params ? binomialPrice({ ...params, steps: 500 }) : null),
    [params]
  );
  const bs = useMemo(
    () =>
      params
        ? blackScholes(params.S0, params.K, params.T, params.sigma, params.r, params.type)
        : null,
    [params]
  );

  if (!symbol || !quote) {
    return (
      <div className="panel" style={{ flex: "1 1 auto" }}>
        <div className="panel-title">Option Valuation — Binomial Lattice</div>
        <div className="empty">Load a security first — e.g. AAPL OV</div>
      </div>
    );
  }

  const n = result?.lattice?.length ? result.lattice.length - 1 : 0;
  const dx = 130;
  const dy = 27;
  const margin = 60;
  const width = n * dx + 2 * margin;
  const height = 2 * n * dy + 2 * margin;
  const nodeX = (i: number) => margin + i * dx;
  const nodeY = (i: number, j: number) => height / 2 - (2 * j - i) * dy;

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        Option Valuation — {symbol} @ {fmtNum(S0)}
        <span className="sub">CRR LATTICE ON GBM (ITO)</span>
      </div>
      <div className="controls">
        <label>
          STRIKE
          <input
            type="number"
            value={strike || ""}
            onChange={(e) => setStrike(parseFloat(e.target.value) || 0)}
          />
        </label>
        <label>
          MONTHS
          <input
            type="number"
            min={1}
            value={months || ""}
            onChange={(e) => setMonths(parseFloat(e.target.value) || 0)}
          />
        </label>
        <label>
          VOL σ %
          <input
            type="number"
            step="0.5"
            value={sigmaPct || ""}
            onChange={(e) => setSigmaPct(parseFloat(e.target.value) || 0)}
          />
        </label>
        <label>
          RATE r %
          <input
            type="number"
            step="0.05"
            value={rPct ?? ""}
            onChange={(e) => setRPct(parseFloat(e.target.value) || 0)}
          />
        </label>
        <label>
          STEPS (≤8)
          <input
            type="number"
            min={1}
            max={8}
            value={steps}
            onChange={(e) => setSteps(parseInt(e.target.value) || 1)}
          />
        </label>
        <div className="seg">
          <button className={type === "call" ? "active" : ""} onClick={() => setType("call")}>
            CALL
          </button>
          <button className={type === "put" ? "active" : ""} onClick={() => setType("put")}>
            PUT
          </button>
        </div>
        <div className="seg">
          <button className={exercise === "eu" ? "active" : ""} onClick={() => setExercise("eu")}>
            EUR
          </button>
          <button className={exercise === "am" ? "active" : ""} onClick={() => setExercise("am")}>
            AMER
          </button>
        </div>
      </div>
      <div className="panel-body">
        {result && fine && bs && params ? (
          <>
            <div className="ov-results">
              <div className="stat-callout">
                <span className="k">LATTICE PRICE (N={n})</span>
                <span className="v">{fmtNum(result.price, 4)}</span>
              </div>
              <div className="stat-callout">
                <span className="k">LATTICE PRICE (N=500)</span>
                <span className="v">{fmtNum(fine.price, 4)}</span>
              </div>
              <div className="stat-callout">
                <span className="k">BLACK-SCHOLES{exercise === "am" ? " (EUR REF.)" : ""}</span>
                <span className="v">{fmtNum(bs.price, 4)}</span>
              </div>
              <div className="stat-callout">
                <span className="k">DELTA (N=500)</span>
                <span className="v">{fmtNum(fine.delta, 4)}</span>
              </div>
            </div>
            <div className="quote-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div className="cell">
                <span className="k">u = e^(σ√Δt)</span>
                <span className="v">{fmtNum(result.u, 5)}</span>
              </div>
              <div className="cell">
                <span className="k">d = 1/u</span>
                <span className="v">{fmtNum(result.d, 5)}</span>
              </div>
              <div className="cell">
                <span className="k">q (risk-neutral)</span>
                <span className="v">{fmtNum(result.q, 5)}</span>
              </div>
              <div className="cell">
                <span className="k">Δt (years)</span>
                <span className="v">{fmtNum(result.dt, 5)}</span>
              </div>
            </div>
            {result.lattice && (
              <div className="lattice-scroll">
                <svg width={width} height={height} className="lattice-svg">
                  {result.lattice.slice(0, -1).map((level, i) =>
                    level.map((_, j) => (
                      <g key={`e-${i}-${j}`}>
                        <line
                          x1={nodeX(i)}
                          y1={nodeY(i, j)}
                          x2={nodeX(i + 1)}
                          y2={nodeY(i + 1, j + 1)}
                          stroke="#3d2a00"
                        />
                        <line
                          x1={nodeX(i)}
                          y1={nodeY(i, j)}
                          x2={nodeX(i + 1)}
                          y2={nodeY(i + 1, j)}
                          stroke="#3d2a00"
                        />
                      </g>
                    ))
                  )}
                  {result.lattice.map((level, i) =>
                    level.map((node, j) => (
                      <g key={`n-${i}-${j}`}>
                        <text x={nodeX(i)} y={nodeY(i, j) - 3} className="lat-s" textAnchor="middle">
                          {fmtNum(node.S, 2)}
                        </text>
                        <text
                          x={nodeX(i)}
                          y={nodeY(i, j) + 10}
                          className={node.ex ? "lat-v ex" : "lat-v"}
                          textAnchor="middle"
                        >
                          {fmtNum(node.V, 3)}
                        </text>
                      </g>
                    ))
                  )}
                </svg>
              </div>
            )}
            <p className="note" style={{ padding: "0 10px 10px" }}>
              Cox-Ross-Rubinstein lattice: discretization of the risk-neutral Ito process dS = rS dt
              + σS dW. White = underlying price, amber = option value, red = early exercise optimal
              (American). σ defaults to the 1Y historical volatility, r to the 13W T-bill (^IRX).
              N=500 and Black-Scholes shown for convergence reference.
            </p>
          </>
        ) : (
          <div className="empty">Set strike, maturity, σ and r to price the option</div>
        )}
      </div>
    </div>
  );
}
