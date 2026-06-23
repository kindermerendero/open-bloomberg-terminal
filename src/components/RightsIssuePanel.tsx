"use client";

import { useEffect, useMemo, useState } from "react";
import type { Fundamentals } from "@/lib/types";
import { rightsIssue } from "@/lib/quant";
import { fmtNum, fmtPct, signClass } from "@/lib/format";

type Mode = "rights" | "buyback";

interface Props {
  symbol: string | null;
}

export default function RightsIssuePanel({ symbol }: Props) {
  const [mode, setMode] = useState<Mode>("rights");

  // rights issue (aumento a pagamento)
  const [oldSh, setOldSh] = useState(3); // n — old shares in the ratio
  const [newSh, setNewSh] = useState(1); // m — new shares in the ratio
  const [pCum, setPCum] = useState(10); // cum-right price
  const [pe, setPe] = useState(7); // subscription (issue) price

  // buyback — money values in millions, price per share
  const [shares, setShares] = useState(100); // shares outstanding (M)
  const [netIncome, setNetIncome] = useState(200); // total earnings (M)
  const [cash, setCash] = useState(150); // cash spent on buyback (M)
  const [price, setPrice] = useState(15); // market price
  const [filled, setFilled] = useState<string | null>(null); // ticker the buyback was auto-filled from

  // auto-fill buyback inputs from the loaded ticker's fundamentals (SEC + Yahoo)
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
        const f: Fundamentals = await res.json();
        if (cancelled || !res.ok) return;
        if (f.sharesOut) setShares(Number((f.sharesOut / 1e6).toFixed(0)));
        if (f.netIncome) {
          const niM = Number((f.netIncome / 1e6).toFixed(0));
          setNetIncome(niM);
          setCash(niM); // default program size: one year of earnings
        }
        if (f.price) setPrice(Number(f.price.toFixed(2)));
        if (f.sharesOut || f.netIncome) setFilled(symbol);
      } catch {
        /* keep manual inputs */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const rights = useMemo(() => rightsIssue(oldSh, newSh, pCum, pe), [oldSh, newSh, pCum, pe]);

  const buyback = useMemo(() => {
    const bought = price > 0 ? cash / price : 0;
    const newShares = shares - bought;
    const pctCapital = shares > 0 ? bought / shares : 0;
    const epsBefore = shares > 0 ? netIncome / shares : 0;
    const epsAfter = newShares > 0 ? netIncome / newShares : 0;
    const accretion = epsBefore > 0 ? epsAfter / epsBefore - 1 : 0;
    return { bought, newShares, pctCapital, epsBefore, epsAfter, accretion };
  }, [shares, netIncome, cash, price]);

  // EPS accretion vs buyback size: accretion(c) = shares/(shares − c/price) − 1
  const accChart = useMemo(() => {
    if (price <= 0 || shares <= 0 || netIncome <= 0) return null;
    const W = 640;
    const H = 190;
    const m = { l: 50, r: 16, t: 14, b: 30 };
    const epsBefore = netIncome / shares;
    const limitCash = 0.2 * shares * price; // 20% of capital (legal cap)
    const xMax = Math.max(limitCash * 1.25, cash * 1.15, 1);
    const acc = (c: number): number | null => {
      const ns = shares - c / price;
      return ns > 0 ? netIncome / ns / epsBefore - 1 : null;
    };
    const N = 80;
    const pts: Array<{ c: number; a: number }> = [];
    for (let i = 0; i <= N; i++) {
      const c = (xMax * i) / N;
      const a = acc(c);
      if (a != null && a < 3) pts.push({ c, a }); // clip the asymptote near buying everything
    }
    if (pts.length < 2) return null;
    const curAcc = acc(cash);
    const yMax = Math.max(...pts.map((p) => p.a), curAcc ?? 0, 0.02);
    const sx = (c: number) => m.l + (c / xMax) * (W - m.l - m.r);
    const sy = (a: number) => H - m.b - (Math.min(a, yMax) / yMax) * (H - m.t - m.b);
    return {
      W,
      H,
      m,
      sx,
      sy,
      yMax,
      xMax,
      path: pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.c)},${sy(p.a)}`).join(" "),
      limitX: limitCash <= xMax ? sx(limitCash) : null,
      curX: sx(Math.min(cash, xMax)),
      curY: curAcc != null ? sy(curAcc) : null,
      curAcc,
    };
  }, [price, shares, netIncome, cash]);

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        RGT — Capital Changes
        <span className="sub">RIGHTS ISSUE · BUYBACK</span>
      </div>

      <div className="controls">
        <div className="seg">
          <button className={mode === "rights" ? "active" : ""} onClick={() => setMode("rights")}>
            RIGHTS ISSUE
          </button>
          <button className={mode === "buyback" ? "active" : ""} onClick={() => setMode("buyback")}>
            BUYBACK
          </button>
        </div>
      </div>

      {mode === "rights" ? (
        <>
          <div className="controls">
            <label>
              OLD SHARES n
              <input type="number" step="1" min={1} value={oldSh} onChange={(e) => setOldSh(parseFloat(e.target.value) || 1)} />
            </label>
            <label>
              NEW SHARES m
              <input type="number" step="1" min={1} value={newSh} onChange={(e) => setNewSh(parseFloat(e.target.value) || 1)} />
            </label>
            <label>
              PRICE CUM P_cum
              <input type="number" step="0.1" value={pCum} onChange={(e) => setPCum(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              ISSUE PRICE P_e
              <input type="number" step="0.1" value={pe} onChange={(e) => setPe(parseFloat(e.target.value) || 0)} />
            </label>
            <span className="hint">subscription ratio {newSh}:{oldSh} — {newSh} new every {oldSh} held</span>
          </div>
          <div className="panel-body">
            <div className="stat-callout">
              <span className="k">P_to = (n·P_cum + m·P_e)/(n+m) — THEORETICAL EX-RIGHTS PRICE</span>
              <span className="v">{fmtNum(rights.exRights)}</span>
            </div>
            <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="cell">
                <span className="k">RIGHT VALUE d = P_cum−P_to</span>
                <span className="v">{fmtNum(rights.rightValue)}</span>
              </div>
              <div className="cell">
                <span className="k">AIAF FACTOR K = P_to/P_cum</span>
                <span className="v">{fmtNum(rights.aiafFactor, 4)}</span>
              </div>
              <div className="cell">
                <span className="k">DILUTION m/(n+m)</span>
                <span className="v">{fmtPct(rights.dilution * 100)}</span>
              </div>
              <div className="cell">
                <span className="k">PROCEEDS / BLOCK m·P_e</span>
                <span className="v">{fmtNum(rights.proceeds)}</span>
              </div>
              <div className="cell">
                <span className="k">DISCOUNT TO CUM</span>
                <span className="v">{fmtPct((pe / pCum - 1) * 100)}</span>
              </div>
              <div className="cell">
                <span className="k">SHAREHOLDER NEUTRAL?</span>
                <span className="v up">YES — value of right offsets price drop</span>
              </div>
            </div>
            <p className="note" style={{ padding: "0 10px 10px" }}>
              In a rights issue old shareholders receive an option (diritto) to subscribe m new shares
              every n held at P_e &lt; P_cum. The stock trades down to the theoretical ex-rights price
              P_to; the right is worth d = P_cum − P_to, so a shareholder who sells the right is left
              whole. K = P_to/P_cum is the AIAF adjustment factor applied to historical prices/charts.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="controls">
            <label>
              SHARES OUT (M)
              <input type="number" step="1" value={shares} onChange={(e) => setShares(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              NET INCOME (M)
              <input type="number" step="1" value={netIncome} onChange={(e) => setNetIncome(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              CASH FOR BUYBACK (M)
              <input type="number" step="1" value={cash} onChange={(e) => setCash(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              MARKET PRICE
              <input type="number" step="0.1" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
            </label>
            <span className="hint">
              {filled ? `auto-filled from ${filled} (SEC + Yahoo) · cash defaults to 1y earnings` : "load a ticker to auto-fill · money in millions"}
            </span>
          </div>
          <div className="panel-body">
            <div className="stat-callout">
              <span className="k">EPS ACCRETION FROM BUYBACK</span>
              <span className={`v ${signClass(buyback.accretion)}`}>{fmtPct(buyback.accretion * 100)}</span>
            </div>
            <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="cell">
                <span className="k">SHARES REPURCHASED</span>
                <span className="v">{fmtNum(buyback.bought)}</span>
              </div>
              <div className="cell">
                <span className="k">% OF CAPITAL</span>
                <span className={`v ${buyback.pctCapital > 0.2 ? "down" : ""}`}>{fmtPct(buyback.pctCapital * 100)}</span>
              </div>
              <div className="cell">
                <span className="k">SHARES AFTER</span>
                <span className="v">{fmtNum(buyback.newShares)}</span>
              </div>
              <div className="cell">
                <span className="k">EPS BEFORE</span>
                <span className="v">{fmtNum(buyback.epsBefore, 3)}</span>
              </div>
              <div className="cell">
                <span className="k">EPS AFTER</span>
                <span className="v">{fmtNum(buyback.epsAfter, 3)}</span>
              </div>
              <div className="cell">
                <span className="k">LEGAL LIMIT (≤20% CS)</span>
                <span className={`v ${buyback.pctCapital > 0.2 ? "down" : "up"}`}>
                  {buyback.pctCapital > 0.2 ? "EXCEEDED" : "OK"}
                </span>
              </div>
            </div>
            {accChart && (
              <>
                <div className="panel-title" style={{ marginTop: 8 }}>
                  EPS Accretion vs Buyback Size
                  <span className="sub">EPS ↑ AS SHARES RETIRED · X = CASH (M)</span>
                </div>
                <svg viewBox={`0 0 ${accChart.W} ${accChart.H}`} className="bond-svg">
                  <line x1={accChart.m.l} y1={accChart.H - accChart.m.b} x2={accChart.W - accChart.m.r} y2={accChart.H - accChart.m.b} stroke="var(--grid)" />
                  <line x1={accChart.m.l} y1={accChart.m.t} x2={accChart.m.l} y2={accChart.H - accChart.m.b} stroke="var(--grid)" />
                  {[0, accChart.yMax / 2, accChart.yMax].map((t, i) => (
                    <g key={`ay-${i}`}>
                      <line x1={accChart.m.l} y1={accChart.sy(t)} x2={accChart.W - accChart.m.r} y2={accChart.sy(t)} stroke="var(--grid-faint)" />
                      <text x={accChart.m.l - 6} y={accChart.sy(t) + 3} className="mkwz-axis" textAnchor="end">
                        {fmtNum(t * 100, 0)}%
                      </text>
                    </g>
                  ))}
                  {/* 20% legal limit */}
                  {accChart.limitX != null && (
                    <g>
                      <line x1={accChart.limitX} y1={accChart.m.t} x2={accChart.limitX} y2={accChart.H - accChart.m.b} stroke="var(--down)" strokeWidth={1} strokeDasharray="4 3" />
                      <text x={accChart.limitX} y={accChart.m.t + 9} className="mkwz-axis" textAnchor="middle" fill="var(--down)">20% CS LIMIT</text>
                    </g>
                  )}
                  {/* accretion curve */}
                  <path d={accChart.path} fill="none" stroke="var(--amber)" strokeWidth={1.8} />
                  {/* current buyback point */}
                  {accChart.curY != null && (
                    <g>
                      <line x1={accChart.curX} y1={accChart.curY} x2={accChart.curX} y2={accChart.H - accChart.m.b} stroke="var(--yellow)" strokeDasharray="2 2" />
                      <circle cx={accChart.curX} cy={accChart.curY} r={3.5} fill="var(--yellow)" />
                      <text x={accChart.curX + 6} y={accChart.curY - 4} className="mkwz-lbl">
                        {fmtPct((accChart.curAcc ?? 0) * 100)}
                      </text>
                    </g>
                  )}
                  <text x={accChart.W - accChart.m.r} y={accChart.H - 4} className="mkwz-axis" textAnchor="end">
                    {fmtNum(accChart.xMax, 0)}
                  </text>
                </svg>
              </>
            )}
            <p className="note" style={{ padding: "0 10px 10px" }}>
              A buyback returns cash by retiring shares: with earnings fixed, fewer shares lift EPS
              (accretion). Italian law caps treasury shares at 20% of capital, funded from
              distributable reserves. Buyback vs dividend: prefer buyback when the stock looks
              undervalued and the firm has stable free cash flow and manageable leverage.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
