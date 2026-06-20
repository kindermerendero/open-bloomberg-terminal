"use client";

import { useMemo, useState } from "react";
import { fmtNum, fmtPct, signClass } from "@/lib/format";

type Offer = "OPS" | "OPV" | "OPVS";

const OFFERS: Array<[Offer, string]> = [
  ["OPS", "new shares — primary, raises capital"],
  ["OPV", "existing shares — secondary, no new capital"],
  ["OPVS", "mixed — primary + secondary"],
];

export default function IpoPanel() {
  const [offer, setOffer] = useState<Offer>("OPS");
  const [sharesM, setSharesM] = useState(20); // shares offered (millions)
  const [offerPrice, setOfferPrice] = useState(10); // bookbuilt price
  const [firstClose, setFirstClose] = useState(11.5); // first-day close
  const [spreadPct, setSpreadPct] = useState(4.5); // underwriting spread
  const [greenshoePct, setGreenshoePct] = useState(15); // over-allotment option
  const [fixedCosts, setFixedCosts] = useState(3); // fixed costs (M)

  const r = useMemo(() => {
    const gross = sharesM * offerPrice;
    const underpricing = offerPrice > 0 ? firstClose / offerPrice - 1 : 0;
    const moneyLeft = (firstClose - offerPrice) * sharesM; // money left on the table
    const spread = gross * (spreadPct / 100);
    const greenshoeShares = sharesM * (greenshoePct / 100);
    const greenshoeProceeds = greenshoeShares * offerPrice;
    const netProceeds = gross - spread - fixedCosts;
    const totalCostPct = gross > 0 ? (spread + fixedCosts + Math.max(0, moneyLeft)) / gross : 0;
    return { gross, underpricing, moneyLeft, spread, greenshoeShares, greenshoeProceeds, netProceeds, totalCostPct };
  }, [sharesM, offerPrice, firstClose, spreadPct, greenshoePct, fixedCosts]);

  const verdict =
    r.underpricing > 0.15
      ? `HEAVY UNDERPRICING ${fmtPct(r.underpricing * 100)} — large amount left on the table`
      : r.underpricing > 0
        ? `TYPICAL UNDERPRICING ${fmtPct(r.underpricing * 100)} — first-day pop`
        : r.underpricing < 0
          ? `OVERPRICED — broke issue price on day one (${fmtPct(r.underpricing * 100)})`
          : "PRICED AT FAIR VALUE — no first-day move";

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        IPO — Going Public
        <span className="sub">BOOKBUILDING · UNDERPRICING · GREENSHOE</span>
      </div>

      <div className="controls">
        <div className="seg">
          {OFFERS.map(([o]) => (
            <button key={o} className={offer === o ? "active" : ""} onClick={() => setOffer(o)}>
              {o}
            </button>
          ))}
        </div>
        <span className="hint">{OFFERS.find((o) => o[0] === offer)?.[1]}</span>
      </div>

      <div className="controls">
        <label>
          SHARES (M)
          <input type="number" step="1" value={sharesM} onChange={(e) => setSharesM(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          OFFER PRICE
          <input type="number" step="0.1" value={offerPrice} onChange={(e) => setOfferPrice(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          1ST-DAY CLOSE
          <input type="number" step="0.1" value={firstClose} onChange={(e) => setFirstClose(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          SPREAD %
          <input type="number" step="0.1" value={spreadPct} onChange={(e) => setSpreadPct(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          GREENSHOE %
          <input type="number" step="1" value={greenshoePct} onChange={(e) => setGreenshoePct(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          FIXED COSTS (M)
          <input type="number" step="0.5" value={fixedCosts} onChange={(e) => setFixedCosts(parseFloat(e.target.value) || 0)} />
        </label>
      </div>

      <div className="panel-body">
        <div className="stat-callout">
          <span className="k">UNDERPRICING = 1ST-DAY CLOSE / OFFER − 1</span>
          <span className={`v ${signClass(r.underpricing)}`}>{fmtPct(r.underpricing * 100)}</span>
        </div>

        <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="cell">
            <span className="k">GROSS PROCEEDS</span>
            <span className="v">{fmtNum(r.gross)}</span>
          </div>
          <div className="cell">
            <span className="k">UNDERWRITING SPREAD</span>
            <span className="v">{fmtNum(r.spread)}</span>
          </div>
          <div className="cell">
            <span className="k">NET TO ISSUER</span>
            <span className="v">{fmtNum(r.netProceeds)}</span>
          </div>
          <div className="cell">
            <span className="k">MONEY LEFT ON TABLE</span>
            <span className={`v ${signClass(r.moneyLeft)}`}>{fmtNum(r.moneyLeft)}</span>
          </div>
          <div className="cell">
            <span className="k">GREENSHOE SHARES (M)</span>
            <span className="v">{fmtNum(r.greenshoeShares)}</span>
          </div>
          <div className="cell">
            <span className="k">GREENSHOE PROCEEDS</span>
            <span className="v">{fmtNum(r.greenshoeProceeds)}</span>
          </div>
          <div className="cell">
            <span className="k">ALL-IN COST % OF GROSS</span>
            <span className="v">{fmtPct(r.totalCostPct * 100)}</span>
          </div>
          <div className="cell">
            <span className="k">EXM FLOAT MIN</span>
            <span className="v">≥ 25%</span>
          </div>
          <div className="cell">
            <span className="k">STAR FLOAT MIN</span>
            <span className="v">≥ 35%</span>
          </div>
        </div>

        <div className="verdict">{verdict}</div>
        <p className="note" style={{ padding: "0 10px 10px" }}>
          The offer price comes from bookbuilding (a range in the prospectus, narrowed by institutional
          orders). Underpricing — the first-day pop — is money left on the table for the issuer but
          rewards investors for taking placement risk. The greenshoe is an over-allotment option
          (typ. 15%) letting underwriters stabilise the price. Total cost ≈ spread (3.5–5.4%) + fixed
          costs + underpricing. Euronext Milan requires float ≥ 25%, 3 audited statements and a
          sponsor; STAR adds float ≥ 35% and governance standards.
        </p>
      </div>
    </div>
  );
}
