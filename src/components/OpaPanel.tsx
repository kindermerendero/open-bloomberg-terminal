"use client";

import { useEffect, useMemo, useState } from "react";
import type { Fundamentals } from "@/lib/types";
import { fmtNum, fmtPct, signClass } from "@/lib/format";
import { useLang } from "@/lib/i18n";

type Stance = "friendly" | "hostile";

interface Props {
  symbol: string | null;
}

export default function OpaPanel({ symbol }: Props) {
  const { t, tRaw } = useLang();
  // Italian takeover thresholds (TUF / CONSOB)
  const THRESHOLDS = tRaw<Array<[number, string]>>("opa.thresholds");
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
    ? t("opa.verdictSqueeze")
    : r.triggersMandatory
      ? t("opa.verdictMandatory")
      : t("opa.verdictBelow");

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        {t("opa.title")}
        <span className="sub">{t("opa.sub")}</span>
      </div>

      <div className="controls">
        <div className="seg">
          <button className={stance === "friendly" ? "active" : ""} onClick={() => setStance("friendly")}>
            {t("opa.friendly")}
          </button>
          <button className={stance === "hostile" ? "active" : ""} onClick={() => setStance("hostile")}>
            {t("opa.hostile")}
          </button>
        </div>
        <span className="hint">
          {stance === "friendly" ? t("opa.friendlyHint") : t("opa.hostileHint")}
        </span>
      </div>

      <div className="controls">
        <label>
          {t("opa.totalShares")}
          <input type="number" step="1" value={totalShares} onChange={(e) => setTotalShares(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          {t("opa.currentStake")}
          <input type="number" step="1" value={currentPct} onChange={(e) => setCurrentPct(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          {t("opa.stakeSought")}
          <input type="number" step="1" value={targetPct} onChange={(e) => setTargetPct(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          {t("opa.marketPrice")}
          <input type="number" step="0.1" value={marketPrice} onChange={(e) => setMarketPrice(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          {t("opa.offerPrice")}
          <input type="number" step="0.1" value={offerPrice} onChange={(e) => setOfferPrice(parseFloat(e.target.value) || 0)} />
        </label>
        <span className="hint">
          {filled ? t("opa.hintFilled", { sym: filled }) : t("opa.hint")}
        </span>
      </div>

      <div className="panel-body">
        <div className="stat-callout">
          <span className="k">{t("opa.premiumCallout")}</span>
          <span className={`v ${signClass(r.premium)}`}>{fmtPct(r.premium * 100)}</span>
        </div>

        <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="cell">
            <span className="k">{t("opa.sharesAcq")}</span>
            <span className="v">{fmtNum(r.sharesToBuy)}</span>
          </div>
          <div className="cell">
            <span className="k">{t("opa.totalCost")}</span>
            <span className="v">{fmtNum(r.cost)}</span>
          </div>
          <div className="cell">
            <span className="k">{t("opa.mandatory")}</span>
            <span className={`v ${r.triggersMandatory ? "down" : "up"}`}>{r.triggersMandatory ? t("opa.triggered") : t("opa.no")}</span>
          </div>
          <div className="cell">
            <span className="k">{t("opa.squeezeOut")}</span>
            <span className={`v ${r.reachesSqueezeOut ? "up" : ""}`}>{r.reachesSqueezeOut ? t("opa.available") : t("opa.no")}</span>
          </div>
          <div className="cell">
            <span className="k">{t("opa.equalOpp")}</span>
            <span className="v">{t("opa.equalOppVal")}</span>
          </div>
          <div className="cell">
            <span className="k">{t("opa.defenses")}</span>
            <span className="v">{stance === "hostile" ? t("opa.defensesHostile") : t("opa.na")}</span>
          </div>
        </div>

        {/* control thresholds bar */}
        <div className="panel-title" style={{ marginTop: 8 }}>
          {t("opa.thresholdsTitle")}
          <span className="sub">{t("opa.thresholdsSub")}</span>
        </div>
        <svg viewBox={`0 0 ${bar.W} ${bar.H}`} className="bond-svg">
          {/* track */}
          <rect x={bar.x(0)} y={bar.yTop} width={bar.x(100) - bar.x(0)} height={bar.h} fill="var(--grid-faint)" />
          {/* already owned */}
          <rect x={bar.x(0)} y={bar.yTop} width={bar.x(currentPct) - bar.x(0)} height={bar.h} fill="var(--cyan)" opacity={0.7} />
          {/* being acquired */}
          <rect x={bar.x(currentPct)} y={bar.yTop} width={Math.max(0, bar.x(targetPct) - bar.x(currentPct))} height={bar.h} fill="var(--amber)" opacity={0.8} />
          {/* threshold markers — stagger labels so the close 90/95 lines don't collide */}
          {THRESHOLDS.map(([thr, label], i) => {
            const crossed = targetPct >= thr;
            const ly = bar.yTop - (i % 2 === 0 ? 7 : 18);
            const anchor = thr >= 88 ? "end" : "middle";
            return (
              <g key={thr}>
                <line x1={bar.x(thr)} y1={ly + 2} x2={bar.x(thr)} y2={bar.yTop + bar.h + 4} stroke={crossed ? "var(--down)" : "var(--text-dim)"} strokeWidth={1} strokeDasharray="3 2" />
                <text x={bar.x(thr)} y={ly} className="mkwz-axis" textAnchor={anchor} fill={crossed ? "var(--down)" : "var(--text-dim)"}>
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
              {t("opa.costTitle")}
              <span className="sub">{t("opa.costSub")}</span>
            </div>
            <svg viewBox={`0 0 ${sens.W} ${sens.H}`} className="bond-svg">
              <line x1={sens.m.l} y1={sens.H - sens.m.b} x2={sens.W - sens.m.r} y2={sens.H - sens.m.b} stroke="var(--grid)" />
              <line x1={sens.m.l} y1={sens.m.t} x2={sens.m.l} y2={sens.H - sens.m.b} stroke="var(--grid)" />
              {[0, sens.yMax / 2, sens.yMax].map((t, i) => (
                <g key={`cy-${i}`}>
                  <line x1={sens.m.l} y1={sens.y(t)} x2={sens.W - sens.m.r} y2={sens.y(t)} stroke="var(--grid-faint)" />
                  <text x={sens.m.l - 6} y={sens.y(t) + 3} className="mkwz-axis" textAnchor="end">{fmtNum(t, 0)}</text>
                </g>
              ))}
              {THRESHOLDS.map(([thr]) => (
                <g key={`tl-${thr}`}>
                  <line x1={sens.x(thr)} y1={sens.m.t} x2={sens.x(thr)} y2={sens.H - sens.m.b} stroke={targetPct >= thr ? "var(--down)" : "var(--text-dim)"} strokeWidth={0.8} strokeDasharray="3 2" />
                  <text x={sens.x(thr)} y={sens.m.t + 9} className="mkwz-axis" textAnchor="middle" fill={targetPct >= thr ? "var(--down)" : "var(--text-dim)"}>{thr}</text>
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
          {t("opa.note")}
        </p>
      </div>
    </div>
  );
}
