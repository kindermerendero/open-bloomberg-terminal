"use client";

import { useEffect, useState } from "react";
import type { Candle, Fundamentals, Quote } from "@/lib/types";
import {
  capmStats,
  ddmGordon,
  ddmTwoStage,
  pvgo,
  sustainableGrowth,
} from "@/lib/quant";
import { fmtNum, fmtPct, signClass } from "@/lib/format";
import { useLang } from "@/lib/i18n";

interface Props {
  symbol: string | null;
  quote: Quote | null;
}

// clamp auto-detected growth into a sane band so a noisy ROE doesn't blow up Gordon
const clampG = (g: number) => Math.max(-5, Math.min(g, 12));

// forward equity risk premium for the valuation cost of equity (r = rf + β·ERP).
// Using a stable ERP beats CAPM's realized trailing market return, which can fall
// below rf and produce a nonsensically low cost of equity for high-β names.
const EQUITY_RISK_PREMIUM = 0.055;

// heat color for the sensitivity matrix: green = DDM above market (undervalued),
// red = below (overvalued); intensity scales with the gap, saturating at ±40%
const sensBg = (gap: number | null): string => {
  if (gap == null) return "transparent";
  const a = Math.min(Math.abs(gap) / 0.4, 1) * 0.55;
  return gap >= 0 ? `rgba(0,217,106,${a})` : `rgba(255,59,48,${a})`;
};

const SENS_N = 7; // 7×7 grid centered on the current (r, g₁)
const SENS_MID = (SENS_N - 1) / 2;

export default function EquityValuationPanel({ symbol, quote }: Props) {
  const { t } = useLang();
  const [fund, setFund] = useState<Fundamentals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // editable model inputs (percent units in the UI)
  const [rPct, setRPct] = useState(9); // cost of equity
  const [d0, setD0] = useState(0); // last paid dividend / share
  const [g1Pct, setG1Pct] = useState(8); // high-growth stage
  const [g2Pct, setG2Pct] = useState(2.5); // terminal growth
  const [years, setYears] = useState(5);
  const [eps, setEps] = useState(0);
  const [bvps, setBvps] = useState(0);

  const price = quote?.price ?? fund?.price ?? null;

  // load fundamentals + derive cost of equity from CAPM (reuses the Tiburzi module)
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const [fRes, aRes, bRes, rfRes] = await Promise.all([
          fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`),
          fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=1y`),
          fetch(`/api/history?symbol=%5EGSPC&range=1y`),
          fetch(`/api/quote?symbols=%5EIRX`),
        ]);
        const f: Fundamentals = await fRes.json();
        if (cancelled) return;
        if (!fRes.ok) throw new Error((f as unknown as { error?: string }).error ?? "load failed");
        setFund(f);

        if (f.dividendTTM != null) setD0(Number(f.dividendTTM.toFixed(4)));
        if (f.eps != null) setEps(Number(f.eps.toFixed(2)));
        if (f.bvps != null) setBvps(Number(f.bvps.toFixed(2)));
        if (f.payoutRatio != null && f.roe != null) {
          const g = clampG(sustainableGrowth(f.payoutRatio, f.roe) * 100);
          setG1Pct(Number(g.toFixed(2)));
          setG2Pct(Number(Math.min(g, 3).toFixed(2)));
        }

        // cost of equity from CAPM β vs S&P 500, rf = 13W T-bill
        try {
          const asset = await aRes.json();
          const bench = await bRes.json();
          const rf = (await rfRes.json())?.quotes?.[0]?.price ?? 4;
          const s = capmStats(asset.candles as Candle[], bench.candles as Candle[], rf / 100);
          if (s && Number.isFinite(s.beta)) {
            const re = s.rf + s.beta * EQUITY_RISK_PREMIUM; // forward cost of equity
            setRPct(Number((re * 100).toFixed(2)));
          }
        } catch {
          /* keep manual cost of equity */
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (!symbol) {
    return (
      <div className="panel" style={{ flex: "1 1 auto" }}>
        <div className="panel-title">{t("eqv.titleEmpty")}</div>
        <div className="empty">{t("eqv.loadFirst")}</div>
      </div>
    );
  }

  const r = rPct / 100;
  const g1 = g1Pct / 100;
  const g2 = g2Pct / 100;
  const div1 = d0 * (1 + g1);
  const gordon = ddmGordon(div1, r, g1);
  const twoStage = ddmTwoStage(d0, r, g1, g2, years);
  const pv = price != null && eps > 0 ? pvgo(price, eps, r) : null;
  const noGrowth = eps > 0 ? eps / r : null;

  const pe = price != null && eps > 0 ? price / eps : null;
  const pbv = price != null && bvps > 0 ? price / bvps : null;
  const divYield = price != null && d0 > 0 ? d0 / price : null;

  const fair = twoStage.price ?? gordon;
  const gap = fair != null && price != null ? (fair - price) / price : null;

  // fair-value sensitivity to cost of equity (r, columns) and high growth (g₁, rows)
  const sensCols = Array.from({ length: SENS_N }, (_, i) => rPct + (i - SENS_MID));
  const sensRows = Array.from({ length: SENS_N }, (_, j) => g1Pct + (SENS_MID - j));
  const sensCells =
    price != null && d0 > 0
      ? sensRows.map((gp) =>
          sensCols.map((rp) => {
            const res = ddmTwoStage(d0, rp / 100, gp / 100, Math.min(g2, gp / 100), years);
            return { fv: res.price, gap: res.price != null ? (res.price - price) / price : null };
          })
        )
      : null;
  const verdict =
    gap != null
      ? gap > 0.1
        ? t("eqv.undervalued", { gap: fmtPct(gap * 100) })
        : gap < -0.1
          ? t("eqv.overvalued", { gap: fmtPct(gap * 100) })
          : t("eqv.fairPriced")
      : d0 <= 0
        ? t("eqv.needDiv")
        : t("eqv.diverges");

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        EQV — {symbol} {price != null ? `@ ${fmtNum(price)}` : ""}
        <span className="sub">
          {fund?.source === "SEC" ? t("eqv.subSec", { fy: fund.fiscalYearEnd ?? "—" }) : t("eqv.subManual")}
        </span>
      </div>

      <div className="controls">
        <label>
          {t("eqv.costEq")}
          <input type="number" step="0.1" value={rPct} onChange={(e) => setRPct(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          {t("eqv.divShare")}
          <input type="number" step="0.01" value={d0} onChange={(e) => setD0(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          {t("eqv.growthG1")}
          <input type="number" step="0.1" value={g1Pct} onChange={(e) => setG1Pct(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          {t("eqv.terminalG2")}
          <input type="number" step="0.1" value={g2Pct} onChange={(e) => setG2Pct(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          {t("eqv.stage1Years")}
          <input type="number" step="1" min={1} max={20} value={years} onChange={(e) => setYears(parseInt(e.target.value) || 1)} />
        </label>
        <label>
          {t("eqv.eps")}
          <input type="number" step="0.01" value={eps} onChange={(e) => setEps(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          {t("eqv.bvps")}
          <input type="number" step="0.01" value={bvps} onChange={(e) => setBvps(parseFloat(e.target.value) || 0)} />
        </label>
        <span className="hint">{t("eqv.hint")}</span>
      </div>

      <div className="panel-body">
        {loading && <div className="loading">{t("eqv.loadingFund")}</div>}
        {error && <div className="empty">{t("common.err")}: {error}</div>}
        {!loading && (
          <>
            <div className="stat-callout">
              <span className="k">{t("eqv.fairVs", { price: price != null ? fmtNum(price) : "—" })}</span>
              <span className={`v ${gap == null ? "flat" : signClass(gap)}`}>
                {fair != null ? fmtNum(fair) : "—"}
              </span>
            </div>

            <div className="quote-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="cell">
                <span className="k">{t("eqv.gordon")}</span>
                <span className="v">{gordon != null ? fmtNum(gordon) : "r ≤ g"}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.twoStage")}</span>
                <span className="v">{twoStage.price != null ? fmtNum(twoStage.price) : "r ≤ g₂"}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.nextDiv")}</span>
                <span className="v">{fmtNum(div1)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.pvStage1")}</span>
                <span className="v">{fmtNum(twoStage.pvHigh)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.pvTerminal")}</span>
                <span className="v">{fmtNum(twoStage.pvTerminal)}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.pvgo")}</span>
                <span className={`v ${pv == null ? "flat" : signClass(pv)}`}>{pv != null ? fmtNum(pv) : "—"}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.noGrowth")}</span>
                <span className="v">{noGrowth != null ? fmtNum(noGrowth) : "—"}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.pe")}</span>
                <span className="v">{pe != null ? fmtNum(pe) : "—"}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.pbv")}</span>
                <span className="v">{pbv != null ? fmtNum(pbv) : "—"}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.divYield")}</span>
                <span className="v">{divYield != null ? fmtPct(divYield * 100) : "—"}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.roe")}</span>
                <span className="v">{fund?.roe != null ? fmtPct(fund.roe * 100) : "—"}</span>
              </div>
              <div className="cell">
                <span className="k">{t("eqv.payout")}</span>
                <span className="v">{fund?.payoutRatio != null ? fmtPct(fund.payoutRatio * 100) : "—"}</span>
              </div>
            </div>

            {twoStage.dividends.length > 0 && (
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("eqv.year")}</th>
                    {twoStage.dividends.map((_, i) => (
                      <th key={i}>{i + 1}</th>
                    ))}
                    <th>{t("eqv.tvAtN")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="sym">{t("eqv.div")}</td>
                    {twoStage.dividends.map((d, i) => (
                      <td key={i}>{fmtNum(d)}</td>
                    ))}
                    <td>{fmtNum(twoStage.terminalValue)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {sensCells && (
              <>
                <div className="panel-title" style={{ marginTop: 8 }}>
                  {t("eqv.sensTitle")}
                  <span className="sub">{t("eqv.sensSub", { price: price != null ? fmtNum(price) : "—" })}</span>
                </div>
                <table className="sens">
                  <thead>
                    <tr>
                      <th>g₁ \ r</th>
                      {sensCols.map((c, i) => (
                        <th key={i}>{fmtNum(c, 1)}%</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensCells.map((row, ri) => (
                      <tr key={ri}>
                        <th>{fmtNum(sensRows[ri], 1)}%</th>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={ri === SENS_MID && ci === SENS_MID ? "cur" : ""}
                            style={{ background: sensBg(cell.gap) }}
                          >
                            {cell.fv != null ? fmtNum(cell.fv) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="verdict">{verdict}</div>
            <p className="note" style={{ padding: "0 10px 10px" }}>
              {t("eqv.note")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
