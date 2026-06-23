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

  // bookbuilding range + institutional demand (for the demand-curve chart)
  const [rangeLow, setRangeLow] = useState(9);
  const [rangeHigh, setRangeHigh] = useState(12);
  const [oversub, setOversub] = useState(3); // oversubscription multiple at the low end

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

  // 1) cost waterfall: gross − spread − fixed − money-left = value net of all-in cost
  const bridge = useMemo(() => {
    const W = 640;
    const H = 200;
    const m = { l: 16, r: 16, t: 26, b: 36 };
    const ml = Math.max(0, r.moneyLeft);
    const net = r.gross - r.spread - fixedCosts - ml;
    const yMax = Math.max(r.gross, 1) * 1.05;
    const sy = (v: number) => H - m.b - (v / yMax) * (H - m.t - m.b);
    const slot = (W - m.l - m.r) / 5;
    const bw = slot * 0.52;
    const cx = (i: number) => m.l + slot * i + slot / 2;
    const seg = (i: number, top: number, bottom: number) => ({
      x: cx(i) - bw / 2,
      y: sy(top),
      w: bw,
      h: Math.max(1, sy(bottom) - sy(top)),
    });
    const c1 = r.gross;
    const c2 = r.gross - r.spread;
    const c3 = c2 - fixedCosts;
    const bars = [
      { ...seg(0, r.gross, 0), label: "GROSS", val: r.gross, color: "var(--amber)" },
      { ...seg(1, c1, c2), label: "− SPREAD", val: -r.spread, color: "var(--down)" },
      { ...seg(2, c2, c3), label: "− FIXED", val: -fixedCosts, color: "var(--down)" },
      { ...seg(3, c3, net), label: "− LEFT", val: -ml, color: "var(--down)" },
      { ...seg(4, net, 0), label: "= NET", val: net, color: "var(--up)" },
    ];
    const conns = [
      { x1: cx(0) + bw / 2, x2: cx(1) - bw / 2, y: sy(c1) },
      { x1: cx(1) + bw / 2, x2: cx(2) - bw / 2, y: sy(c2) },
      { x1: cx(2) + bw / 2, x2: cx(3) - bw / 2, y: sy(c3) },
      { x1: cx(3) + bw / 2, x2: cx(4) - bw / 2, y: sy(net) },
    ];
    return { W, H, m, bars, conns, cx };
  }, [r, fixedCosts]);

  // 2) sensitivity to the offer price (1st-day close held as fair value):
  //    net proceeds rise with price, money left on the table falls to zero at fair value
  const sens = useMemo(() => {
    if (sharesM <= 0 || firstClose <= 0) return null;
    const W = 640;
    const H = 190;
    const m = { l: 52, r: 16, t: 14, b: 30 };
    const xMin = firstClose * 0.5;
    const xMax = firstClose * 1.08;
    const net = (p: number) => sharesM * p * (1 - spreadPct / 100) - fixedCosts;
    const ml = (p: number) => (firstClose - p) * sharesM;
    const N = 60;
    const xs = Array.from({ length: N + 1 }, (_, i) => xMin + ((xMax - xMin) * i) / N);
    const vals = xs.flatMap((p) => [net(p), ml(p)]);
    const yMin = Math.min(0, ...vals);
    const yMax = Math.max(...vals);
    const sx = (p: number) => m.l + ((p - xMin) / (xMax - xMin)) * (W - m.l - m.r);
    const sy = (v: number) => H - m.b - ((v - yMin) / (yMax - yMin || 1)) * (H - m.t - m.b);
    const clampX = (p: number) => sx(Math.min(Math.max(p, xMin), xMax));
    return {
      W,
      H,
      m,
      sx,
      sy,
      xMin,
      xMax,
      zeroY: sy(0),
      netPath: xs.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p)},${sy(net(p))}`).join(" "),
      mlPath: xs.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p)},${sy(ml(p))}`).join(" "),
      offX: clampX(offerPrice),
      fairX: clampX(firstClose),
    };
  }, [sharesM, firstClose, spreadPct, fixedCosts, offerPrice]);

  // 3) bookbuilding demand curve: linear institutional demand vs price; the clearing
  //    price is where cumulative demand meets the shares offered
  const book = useMemo(() => {
    if (rangeHigh <= rangeLow || sharesM <= 0) return null;
    const W = 640;
    const H = 200;
    const m = { l: 52, r: 16, t: 14, b: 30 };
    const demand = (p: number) => Math.max(0, sharesM * oversub * ((rangeHigh - p) / (rangeHigh - rangeLow)));
    const N = 60;
    const xs = Array.from({ length: N + 1 }, (_, i) => rangeLow + ((rangeHigh - rangeLow) * i) / N);
    const yMax = Math.max(demand(rangeLow), sharesM) * 1.08;
    const sx = (p: number) => m.l + ((p - rangeLow) / (rangeHigh - rangeLow)) * (W - m.l - m.r);
    const sy = (q: number) => H - m.b - (q / yMax) * (H - m.t - m.b);
    const clearing = rangeHigh - (rangeHigh - rangeLow) / oversub; // demand = sharesM
    return {
      W,
      H,
      m,
      sx,
      sy,
      yMax,
      dPath: xs.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p)},${sy(demand(p))}`).join(" "),
      supplyY: sy(sharesM),
      clearing,
      clearingX: clearing >= rangeLow && clearing <= rangeHigh ? sx(clearing) : null,
      offX: offerPrice >= rangeLow && offerPrice <= rangeHigh ? sx(offerPrice) : null,
    };
  }, [rangeLow, rangeHigh, oversub, sharesM, offerPrice]);

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

      <div className="controls">
        <label>
          RANGE LOW
          <input type="number" step="0.1" value={rangeLow} onChange={(e) => setRangeLow(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          RANGE HIGH
          <input type="number" step="0.1" value={rangeHigh} onChange={(e) => setRangeHigh(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          OVERSUBSCRIPTION ×
          <input type="number" step="0.5" min={0.5} value={oversub} onChange={(e) => setOversub(parseFloat(e.target.value) || 0)} />
        </label>
        <span className="hint">bookbuilding range + demand multiple at the low end</span>
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

        {/* 1) cost waterfall */}
        <div className="panel-title" style={{ marginTop: 8 }}>
          IPO Cost Bridge
          <span className="sub">GROSS − SPREAD − FIXED − MONEY LEFT = NET CAPTURED</span>
        </div>
        <svg viewBox={`0 0 ${bridge.W} ${bridge.H}`} className="bond-svg">
          {bridge.conns.map((c, i) => (
            <line key={`bc-${i}`} x1={c.x1} y1={c.y} x2={c.x2} y2={c.y} stroke="var(--text-dim)" strokeDasharray="3 3" />
          ))}
          {bridge.bars.map((b, i) => (
            <g key={`bb-${i}`}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.color} opacity={0.85} />
              <text x={bridge.cx(i)} y={b.y - 6} className="mkwz-lbl" textAnchor="middle">{fmtNum(b.val)}</text>
              <text x={bridge.cx(i)} y={bridge.H - bridge.m.b + 16} className="mkwz-axis" textAnchor="middle">{b.label}</text>
            </g>
          ))}
        </svg>

        {/* 2) sensitivity to offer price */}
        {sens && (
          <>
            <div className="panel-title" style={{ marginTop: 8 }}>
              Offer-Price Sensitivity
              <span className="sub">NET PROCEEDS vs MONEY LEFT · X = OFFER PRICE</span>
            </div>
            <svg viewBox={`0 0 ${sens.W} ${sens.H}`} className="bond-svg">
              <line x1={sens.m.l} y1={sens.zeroY} x2={sens.W - sens.m.r} y2={sens.zeroY} stroke="var(--grid)" />
              <line x1={sens.fairX} y1={sens.m.t} x2={sens.fairX} y2={sens.H - sens.m.b} stroke="var(--text-dim)" strokeDasharray="3 3" />
              <text x={sens.fairX} y={sens.m.t + 9} className="mkwz-axis" textAnchor="middle">FAIR (no $ left)</text>
              <path d={sens.netPath} fill="none" stroke="var(--amber)" strokeWidth={1.8} />
              <path d={sens.mlPath} fill="none" stroke="var(--cyan)" strokeWidth={1.5} />
              <line x1={sens.offX} y1={sens.m.t} x2={sens.offX} y2={sens.H - sens.m.b} stroke="var(--yellow)" strokeDasharray="2 2" />
              <text x={sens.m.l} y={sens.H - 4} className="mkwz-axis">{fmtNum(sens.xMin, 1)}</text>
              <text x={sens.W - sens.m.r} y={sens.H - 4} className="mkwz-axis" textAnchor="end">{fmtNum(sens.xMax, 1)}</text>
              <text x={sens.m.l + 4} y={sens.m.t + 9} className="mkwz-axis" fill="var(--amber)">NET</text>
              <text x={sens.m.l + 4} y={sens.m.t + 20} className="mkwz-axis" fill="var(--cyan)">MONEY LEFT</text>
            </svg>
          </>
        )}

        {/* 3) bookbuilding demand curve */}
        {book && (
          <>
            <div className="panel-title" style={{ marginTop: 8 }}>
              Bookbuilding Demand
              <span className="sub">CLEARING PRICE = WHERE DEMAND MEETS SHARES OFFERED</span>
            </div>
            <svg viewBox={`0 0 ${book.W} ${book.H}`} className="bond-svg">
              <line x1={book.m.l} y1={book.H - book.m.b} x2={book.W - book.m.r} y2={book.H - book.m.b} stroke="var(--grid)" />
              <line x1={book.m.l} y1={book.m.t} x2={book.m.l} y2={book.H - book.m.b} stroke="var(--grid)" />
              {/* shares offered (supply) */}
              <line x1={book.m.l} y1={book.supplyY} x2={book.W - book.m.r} y2={book.supplyY} stroke="var(--cyan)" strokeDasharray="4 2" />
              <text x={book.W - book.m.r} y={book.supplyY - 4} className="mkwz-axis" textAnchor="end" fill="var(--cyan)">SHARES OFFERED ({fmtNum(sharesM)}M)</text>
              {/* demand */}
              <path d={book.dPath} fill="none" stroke="var(--amber)" strokeWidth={1.8} />
              {/* clearing price */}
              {book.clearingX != null && (
                <g>
                  <line x1={book.clearingX} y1={book.m.t} x2={book.clearingX} y2={book.H - book.m.b} stroke="var(--yellow)" strokeWidth={1} />
                  <text x={book.clearingX} y={book.m.t + 9} className="mkwz-lbl" textAnchor="middle">P* {fmtNum(book.clearing, 2)}</text>
                </g>
              )}
              {book.offX != null && (
                <line x1={book.offX} y1={book.m.t} x2={book.offX} y2={book.H - book.m.b} stroke="var(--text-dim)" strokeDasharray="2 2" />
              )}
              <text x={book.m.l} y={book.H - 4} className="mkwz-axis">{fmtNum(rangeLow, 1)}</text>
              <text x={book.W - book.m.r} y={book.H - 4} className="mkwz-axis" textAnchor="end">{fmtNum(rangeHigh, 1)}</text>
            </svg>
          </>
        )}

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
