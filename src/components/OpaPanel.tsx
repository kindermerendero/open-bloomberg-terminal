"use client";

import { useEffect, useMemo, useState } from "react";
import type { Fundamentals } from "@/lib/types";
import { fmtNum, fmtPct, signClass } from "@/lib/format";

type Stance = "friendly" | "hostile";

interface Props {
  symbol: string | null;
}

// Italian takeover thresholds (TUF / CONSOB)
const THRESHOLDS: Array<[number, string]> = [
  [30, "30% MANDATORY"],
  [50, "50% CONTROL"],
  [90, "90% SQUEEZE-OUT"],
  [95, "95% SELL-OUT"],
];

export default function OpaPanel({ symbol }: Props) {
  const [totalShares, setTotalShares] = useState(100); // total shares (M)
  const [currentPct, setCurrentPct] = useState(5); // current stake %
  const [targetPct, setTargetPct] = useState(60); // stake sought %
  const [marketPrice, setMarketPrice] = useState(10);
  const [offerPrice, setOfferPrice] = useState(13);
  const [stance, setStance] = useState<Stance>("friendly");
  const [filled, setFilled] = useState<string | null>(null);

  // auto-fill total shares + market price from the loaded ticker; offer price
  // seeded at a 25% control premium
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
        const f: Fundamentals = await res.json();
        if (cancelled || !res.ok) return;
        if (f.sharesOut) setTotalShares(Number((f.sharesOut / 1e6).toFixed(0)));
        if (f.price) {
          setMarketPrice(Number(f.price.toFixed(2)));
          setOfferPrice(Number((f.price * 1.25).toFixed(2)));
        }
        if (f.sharesOut || f.price) setFilled(symbol);
      } catch {
        /* keep manual inputs */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const r = useMemo(() => {
    const sharesToBuy = totalShares * Math.max(0, (targetPct - currentPct) / 100);
    const cost = sharesToBuy * offerPrice;
    const premium = marketPrice > 0 ? offerPrice / marketPrice - 1 : 0;
    const triggersMandatory = targetPct >= 30 && currentPct < 30; // Italy: 30% threshold
    const reachesSqueezeOut = targetPct >= 90; // 90% squeeze-out right
    return { sharesToBuy, cost, premium, triggersMandatory, reachesSqueezeOut };
  }, [totalShares, currentPct, targetPct, marketPrice, offerPrice]);

  // control-thresholds bar geometry
  const bar = useMemo(() => {
    const W = 640;
    const H = 76;
    const m = { l: 16, r: 16, t: 26, b: 24 };
    const x = (p: number) => m.l + (Math.min(Math.max(p, 0), 100) / 100) * (W - m.l - m.r);
    const yTop = m.t;
    const h = H - m.t - m.b;
    return { W, H, m, x, yTop, h };
  }, []);

  // cost-to-acquire vs stake sought, with the regulatory thresholds marked
  const sens = useMemo(() => {
    if (totalShares <= 0 || offerPrice <= 0) return null;
    const W = 640;
    const H = 190;
    const m = { l: 56, r: 16, t: 14, b: 30 };
    const cost = (p: number) => Math.max(0, (totalShares * (p - currentPct)) / 100) * offerPrice;
    const N = 60;
    const xs = Array.from({ length: N + 1 }, (_, i) => (100 * i) / N);
    const yMax = Math.max(cost(100), 1);
    const x = (p: number) => m.l + (p / 100) * (W - m.l - m.r);
    const y = (c: number) => H - m.b - (c / yMax) * (H - m.t - m.b);
    return {
      W,
      H,
      m,
      x,
      y,
      yMax,
      path: xs.map((p, i) => `${i === 0 ? "M" : "L"}${x(p)},${y(cost(p))}`).join(" "),
      targetX: x(Math.min(targetPct, 100)),
      targetY: y(cost(targetPct)),
    };
  }, [totalShares, currentPct, targetPct, offerPrice]);

  const verdict = r.reachesSqueezeOut
    ? "≥ 90% — SQUEEZE-OUT: right to compulsorily buy out residual minorities, then delist"
    : r.triggersMandatory
      ? "≥ 30% — MANDATORY TENDER OFFER triggered (CONSOB): bid must extend to all shareholders"
      : "BELOW 30% — voluntary partial bid, no mandatory-offer obligation";

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        OPA — Tender Offer
        <span className="sub">THRESHOLDS · PREMIUM · SQUEEZE-OUT</span>
      </div>

      <div className="controls">
        <div className="seg">
          <button className={stance === "friendly" ? "active" : ""} onClick={() => setStance("friendly")}>
            FRIENDLY
          </button>
          <button className={stance === "hostile" ? "active" : ""} onClick={() => setStance("hostile")}>
            HOSTILE
          </button>
        </div>
        <span className="hint">
          {stance === "friendly" ? "agreed with the board" : "no board agreement — defenses may apply"}
        </span>
      </div>

      <div className="controls">
        <label>
          TOTAL SHARES (M)
          <input type="number" step="1" value={totalShares} onChange={(e) => setTotalShares(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          CURRENT STAKE %
          <input type="number" step="1" value={currentPct} onChange={(e) => setCurrentPct(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          STAKE SOUGHT %
          <input type="number" step="1" value={targetPct} onChange={(e) => setTargetPct(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          MARKET PRICE
          <input type="number" step="0.1" value={marketPrice} onChange={(e) => setMarketPrice(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          OFFER PRICE
          <input type="number" step="0.1" value={offerPrice} onChange={(e) => setOfferPrice(parseFloat(e.target.value) || 0)} />
        </label>
        <span className="hint">
          {filled ? `auto-filled from ${filled} (SEC + Yahoo) · offer = +25% premium` : "load a ticker to auto-fill shares & price · shares in millions"}
        </span>
      </div>

      <div className="panel-body">
        <div className="stat-callout">
          <span className="k">BID PREMIUM = OFFER / MARKET − 1</span>
          <span className={`v ${signClass(r.premium)}`}>{fmtPct(r.premium * 100)}</span>
        </div>

        <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="cell">
            <span className="k">SHARES TO ACQUIRE (M)</span>
            <span className="v">{fmtNum(r.sharesToBuy)}</span>
          </div>
          <div className="cell">
            <span className="k">TOTAL COST OF BID</span>
            <span className="v">{fmtNum(r.cost)}</span>
          </div>
          <div className="cell">
            <span className="k">MANDATORY (≥30%)</span>
            <span className={`v ${r.triggersMandatory ? "down" : "up"}`}>{r.triggersMandatory ? "TRIGGERED" : "NO"}</span>
          </div>
          <div className="cell">
            <span className="k">SQUEEZE-OUT (≥90%)</span>
            <span className={`v ${r.reachesSqueezeOut ? "up" : ""}`}>{r.reachesSqueezeOut ? "AVAILABLE" : "NO"}</span>
          </div>
          <div className="cell">
            <span className="k">EQUAL-OPPORTUNITY</span>
            <span className="v">same price pro-quota</span>
          </div>
          <div className="cell">
            <span className="k">DEFENSES</span>
            <span className="v">{stance === "hostile" ? "poison pill / white knight" : "n/a"}</span>
          </div>
        </div>

        {/* control thresholds bar */}
        <div className="panel-title" style={{ marginTop: 8 }}>
          Control Thresholds
          <span className="sub">CURRENT → SOUGHT vs CONSOB LINES</span>
        </div>
        <svg viewBox={`0 0 ${bar.W} ${bar.H}`} className="bond-svg">
          {/* track */}
          <rect x={bar.x(0)} y={bar.yTop} width={bar.x(100) - bar.x(0)} height={bar.h} fill="#1a1200" />
          {/* already owned */}
          <rect x={bar.x(0)} y={bar.yTop} width={bar.x(currentPct) - bar.x(0)} height={bar.h} fill="var(--cyan)" opacity={0.7} />
          {/* being acquired */}
          <rect x={bar.x(currentPct)} y={bar.yTop} width={Math.max(0, bar.x(targetPct) - bar.x(currentPct))} height={bar.h} fill="var(--amber)" opacity={0.8} />
          {/* threshold markers */}
          {THRESHOLDS.map(([t, label]) => {
            const crossed = targetPct >= t;
            return (
              <g key={t}>
                <line x1={bar.x(t)} y1={bar.yTop - 4} x2={bar.x(t)} y2={bar.yTop + bar.h + 4} stroke={crossed ? "var(--down)" : "var(--text-dim)"} strokeWidth={1} strokeDasharray="3 2" />
                <text x={bar.x(t)} y={bar.yTop - 8} className="mkwz-axis" textAnchor="middle" fill={crossed ? "var(--down)" : "var(--text-dim)"}>
                  {label}
                </text>
              </g>
            );
          })}
          {/* target label */}
          <text x={bar.x(Math.min(targetPct, 100))} y={bar.yTop + bar.h + 16} className="mkwz-lbl" textAnchor="middle">
            ▲ {fmtNum(targetPct, 0)}%
          </text>
        </svg>

        {/* cost-to-acquire sensitivity */}
        {sens && (
          <>
            <div className="panel-title" style={{ marginTop: 8 }}>
              Cost to Acquire vs Stake Sought
              <span className="sub">X = STAKE % · Y = TOTAL COST</span>
            </div>
            <svg viewBox={`0 0 ${sens.W} ${sens.H}`} className="bond-svg">
              <line x1={sens.m.l} y1={sens.H - sens.m.b} x2={sens.W - sens.m.r} y2={sens.H - sens.m.b} stroke="#3d2a00" />
              <line x1={sens.m.l} y1={sens.m.t} x2={sens.m.l} y2={sens.H - sens.m.b} stroke="#3d2a00" />
              {[0, sens.yMax / 2, sens.yMax].map((t, i) => (
                <g key={`cy-${i}`}>
                  <line x1={sens.m.l} y1={sens.y(t)} x2={sens.W - sens.m.r} y2={sens.y(t)} stroke="#1a1200" />
                  <text x={sens.m.l - 6} y={sens.y(t) + 3} className="mkwz-axis" textAnchor="end">{fmtNum(t, 0)}</text>
                </g>
              ))}
              {THRESHOLDS.map(([t, label]) => (
                <g key={`tl-${t}`}>
                  <line x1={sens.x(t)} y1={sens.m.t} x2={sens.x(t)} y2={sens.H - sens.m.b} stroke={targetPct >= t ? "var(--down)" : "var(--text-dim)"} strokeWidth={0.8} strokeDasharray="3 2" />
                  <text x={sens.x(t)} y={sens.m.t + 9} className="mkwz-axis" textAnchor="middle" fill={targetPct >= t ? "var(--down)" : "var(--text-dim)"}>{t}</text>
                </g>
              ))}
              <path d={sens.path} fill="none" stroke="var(--amber)" strokeWidth={1.8} />
              <circle cx={sens.targetX} cy={sens.targetY} r={3.5} fill="var(--yellow)" />
              <text x={sens.targetX + 6} y={sens.targetY - 4} className="mkwz-lbl">{fmtNum(r.cost)}</text>
            </svg>
          </>
        )}

        <div className="verdict">{verdict}</div>
        <p className="note" style={{ padding: "0 10px 10px" }}>
          A tender offer (OPA) is a public bid to buy shares at a fixed price, paid above market as a
          control premium. The law (L. 149/1992, CONSOB) balances minority protection against efficient
          reallocation of control. The equal-opportunity rule lets minorities sell at the same price
          pro-quota; crossing 30% triggers a mandatory offer to all shareholders, preventing creeping
          control. A hostile bid can meet defenses (poison pill, white knight, golden parachute,
          higher debt). Above 90% the bidder can squeeze out the residual minorities and delist.
        </p>
      </div>
    </div>
  );
}
