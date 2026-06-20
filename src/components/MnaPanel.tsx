"use client";

import { useMemo, useState } from "react";
import { mnaEval } from "@/lib/quant";
import { fmtNum, signClass } from "@/lib/format";

type Deal = "horizontal" | "vertical" | "conglomerate";

const DEALS: Array<[Deal, string, string]> = [
  ["horizontal", "HORIZONTAL", "same industry — scale economies (es. DowDuPont)"],
  ["vertical", "VERTICAL", "supply chain — integration (es. EssilorLuxottica)"],
  ["conglomerate", "CONGLOMERATE", "unrelated sectors — diversification (es. Tata)"],
];

export default function MnaPanel() {
  const [vaA, setVaA] = useState(1000); // standalone value acquirer
  const [vaB, setVaB] = useState(400); // standalone value target
  const [vaAB, setVaAB] = useState(1500); // combined value
  const [premiumPct, setPremiumPct] = useState(25);
  const [deal, setDeal] = useState<Deal>("horizontal");

  const res = useMemo(() => mnaEval(vaA, vaB, vaAB, premiumPct), [vaA, vaB, vaAB, premiumPct]);
  const synergyPct = vaB > 0 ? (res.synergy / vaB) * 100 : 0;

  const verdict =
    res.npv > 0
      ? `DEAL CREATES VALUE — ACQUIRER NPV +${fmtNum(res.npv)} (synergies exceed the premium)`
      : res.npv < 0
        ? `DEAL DESTROYS VALUE — ACQUIRER NPV ${fmtNum(res.npv)} (premium exceeds synergies)`
        : "BREAK-EVEN — synergies exactly absorbed by the premium";

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        MNA — Mergers &amp; Acquisitions
        <span className="sub">VAN = SYNERGIES − PREMIUM</span>
      </div>

      <div className="controls">
        <label>
          VA(A) ACQUIRER
          <input type="number" step="10" value={vaA} onChange={(e) => setVaA(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          VA(B) TARGET
          <input type="number" step="10" value={vaB} onChange={(e) => setVaB(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          VA(AB) COMBINED
          <input type="number" step="10" value={vaAB} onChange={(e) => setVaAB(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          PREMIUM % ON B
          <input type="number" step="1" value={premiumPct} onChange={(e) => setPremiumPct(parseFloat(e.target.value) || 0)} />
        </label>
      </div>

      <div className="controls">
        <div className="seg">
          {DEALS.map(([d, label]) => (
            <button key={d} className={deal === d ? "active" : ""} onClick={() => setDeal(d)}>
              {label}
            </button>
          ))}
        </div>
        <span className="hint">{DEALS.find((d) => d[0] === deal)?.[2]}</span>
      </div>

      <div className="panel-body">
        <div className="stat-callout">
          <span className="k">VAN ACQUISIZIONE = SINERGIE − PREMIO</span>
          <span className={`v ${signClass(res.npv)}`}>{fmtNum(res.npv)}</span>
        </div>

        <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="cell">
            <span className="k">COMBINED STANDALONE</span>
            <span className="v">{fmtNum(res.combinedStandalone)}</span>
          </div>
          <div className="cell">
            <span className="k">SYNERGY VA(AB)−ΣVA</span>
            <span className={`v ${signClass(res.synergy)}`}>{fmtNum(res.synergy)}</span>
          </div>
          <div className="cell">
            <span className="k">SYNERGY % OF TARGET</span>
            <span className={`v ${signClass(synergyPct)}`}>{fmtNum(synergyPct)}%</span>
          </div>
          <div className="cell">
            <span className="k">PREMIUM PAID</span>
            <span className="v">{fmtNum(res.premium)}</span>
          </div>
          <div className="cell">
            <span className="k">COST = VA(B)+PREMIUM</span>
            <span className="v">{fmtNum(res.cost)}</span>
          </div>
          <div className="cell">
            <span className="k">GAIN TO TARGET</span>
            <span className="v up">{fmtNum(res.premium)}</span>
          </div>
        </div>

        <div className="verdict">{verdict}</div>
        <p className="note" style={{ padding: "0 10px 10px" }}>
          Synergies = VA(AB) − [VA(A) + VA(B)]: the extra value of the combined entity over the two
          firms standalone. The premium is the cash paid to target shareholders above market value;
          the target captures it. The acquirer creates value only if VAN = synergies − premium &gt; 0,
          i.e. synergies are real and not overpaid for. Estimate VA(AB) by DCF on the combined cash
          flows. Acquisition waves cluster in rising markets with low rates.
        </p>
      </div>
    </div>
  );
}
