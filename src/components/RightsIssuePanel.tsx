"use client";

import { useMemo, useState } from "react";
import { rightsIssue } from "@/lib/quant";
import { fmtNum, fmtPct, signClass } from "@/lib/format";

type Mode = "rights" | "buyback";

export default function RightsIssuePanel() {
  const [mode, setMode] = useState<Mode>("rights");

  // rights issue (aumento a pagamento)
  const [oldSh, setOldSh] = useState(3); // n — old shares in the ratio
  const [newSh, setNewSh] = useState(1); // m — new shares in the ratio
  const [pCum, setPCum] = useState(10); // cum-right price
  const [pe, setPe] = useState(7); // subscription (issue) price

  // buyback
  const [shares, setShares] = useState(100); // shares outstanding (m)
  const [netIncome, setNetIncome] = useState(200); // total earnings
  const [cash, setCash] = useState(150); // cash spent on buyback
  const [price, setPrice] = useState(15); // market price

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
              SHARES OUT
              <input type="number" step="1" value={shares} onChange={(e) => setShares(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              NET INCOME
              <input type="number" step="1" value={netIncome} onChange={(e) => setNetIncome(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              CASH FOR BUYBACK
              <input type="number" step="1" value={cash} onChange={(e) => setCash(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              MARKET PRICE
              <input type="number" step="0.1" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
            </label>
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
