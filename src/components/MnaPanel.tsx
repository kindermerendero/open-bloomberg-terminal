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

  // value-bridge waterfall: synergy created → premium ceded to target → NPV kept by acquirer
  const bridge = useMemo(() => {
    const W = 640;
    const H = 210;
    const m = { l: 16, r: 16, t: 28, b: 34 };
    const { synergy, premium, npv } = res;
    const cum1 = synergy; // after synergy
    const cum2 = npv; // after subtracting the premium (= synergy − premium)
    const lo = Math.min(0, synergy, npv);
    const hi = Math.max(0, synergy, npv);
    const pad = (hi - lo) * 0.18 || 1;
    const yMin = lo - pad;
    const yMax = hi + pad;
    const sy = (v: number) => H - m.b - ((v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    const slot = (W - m.l - m.r) / 3;
    const bw = slot * 0.5;
    const cx = (i: number) => m.l + slot * i + slot / 2;
    const seg = (i: number, top: number, bottom: number) => ({
      x: cx(i) - bw / 2,
      y: sy(top),
      w: bw,
      h: Math.max(1, sy(bottom) - sy(top)),
    });
    const bars = [
      { ...seg(0, Math.max(0, synergy), Math.min(0, synergy)), label: "SYNERGY", caption: "value created", val: synergy, color: synergy >= 0 ? "var(--up)" : "var(--down)" },
      { ...seg(1, Math.max(cum1, cum2), Math.min(cum1, cum2)), label: "− PREMIUM", caption: "→ target", val: -premium, color: "var(--down)" },
      { ...seg(2, Math.max(0, npv), Math.min(0, npv)), label: "= NPV", caption: "→ acquirer", val: npv, color: npv >= 0 ? "var(--up)" : "var(--down)" },
    ];
    const connectors = [
      { x1: cx(0) + bw / 2, x2: cx(1) - bw / 2, y: sy(cum1) },
      { x1: cx(1) + bw / 2, x2: cx(2) - bw / 2, y: sy(cum2) },
    ];
    return { W, H, m, sy, zeroY: sy(0), bars, connectors, cx };
  }, [res]);

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

        <div className="panel-title" style={{ marginTop: 8 }}>
          Value Bridge
          <span className="sub">SYNERGY − PREMIUM = ACQUIRER NPV</span>
        </div>
        <svg viewBox={`0 0 ${bridge.W} ${bridge.H}`} className="bond-svg">
          <line x1={bridge.m.l} y1={bridge.zeroY} x2={bridge.W - bridge.m.r} y2={bridge.zeroY} stroke="var(--grid)" />
          {bridge.connectors.map((c, i) => (
            <line key={`cn-${i}`} x1={c.x1} y1={c.y} x2={c.x2} y2={c.y} stroke="var(--text-dim)" strokeDasharray="3 3" />
          ))}
          {bridge.bars.map((b, i) => (
            <g key={`br-${i}`}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.color} opacity={0.85} />
              <text x={bridge.cx(i)} y={b.y - 6} className="mkwz-lbl" textAnchor="middle">
                {fmtNum(b.val)}
              </text>
              <text x={bridge.cx(i)} y={bridge.H - bridge.m.b + 15} className="mkwz-axis" textAnchor="middle">
                {b.label}
              </text>
              <text x={bridge.cx(i)} y={bridge.H - bridge.m.b + 27} className="mkwz-axis" textAnchor="middle" opacity={0.7}>
                {b.caption}
              </text>
            </g>
          ))}
        </svg>

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
