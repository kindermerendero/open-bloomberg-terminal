"use client";

import { useMemo, useState } from "react";
import { fmtNum, fmtPct, signClass } from "@/lib/format";

type Stance = "friendly" | "hostile";

export default function OpaPanel() {
  const [totalShares, setTotalShares] = useState(100); // total shares (M)
  const [currentPct, setCurrentPct] = useState(5); // current stake %
  const [targetPct, setTargetPct] = useState(60); // stake sought %
  const [marketPrice, setMarketPrice] = useState(10);
  const [offerPrice, setOfferPrice] = useState(13);
  const [stance, setStance] = useState<Stance>("friendly");

  const r = useMemo(() => {
    const sharesToBuy = totalShares * Math.max(0, (targetPct - currentPct) / 100);
    const cost = sharesToBuy * offerPrice;
    const premium = marketPrice > 0 ? offerPrice / marketPrice - 1 : 0;
    const triggersMandatory = targetPct >= 30 && currentPct < 30; // Italy: 30% threshold
    const reachesSqueezeOut = targetPct >= 90; // 90% squeeze-out right
    return { sharesToBuy, cost, premium, triggersMandatory, reachesSqueezeOut };
  }, [totalShares, currentPct, targetPct, marketPrice, offerPrice]);

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
