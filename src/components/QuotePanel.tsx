"use client";

import type { Quote } from "@/lib/types";
import { fmtChange, fmtCompact, fmtPct, fmtPrice, signClass } from "@/lib/format";
import { useLang } from "@/lib/i18n";

export default function QuotePanel({ quote }: { quote: Quote | null }) {
  const { t } = useLang();
  if (!quote) {
    return (
      <div className="panel quote-strip">
        <div className="panel-title">{t("quote.title")}</div>
        <div className="empty">{t("quote.empty")}</div>
      </div>
    );
  }
  const cells: Array<[string, string]> = [
    [t("quote.open"), fmtPrice(quote.open)],
    [t("quote.high"), fmtPrice(quote.dayHigh)],
    [t("quote.low"), fmtPrice(quote.dayLow)],
    [t("quote.prevClose"), fmtPrice(quote.prevClose)],
    [t("quote.volume"), fmtCompact(quote.volume)],
    [t("quote.high52"), fmtPrice(quote.high52)],
    [t("quote.low52"), fmtPrice(quote.low52)],
    [t("quote.exchange"), quote.exchange || "—"],
  ];
  return (
    <div className="panel quote-strip">
      <div className="panel-title">
        {t("quote.title")} <span className="sub">{quote.currency}</span>
      </div>
      <div className="quote-head">
        <span className="sym">{quote.symbol}</span>
        <span className="name">{quote.name}</span>
        <span className="px">{fmtPrice(quote.price)}</span>
        <span className={`chg ${signClass(quote.change)}`}>
          {fmtChange(quote.change)} ({fmtPct(quote.changePct)})
        </span>
      </div>
      <div className="quote-grid">
        {cells.map(([k, v]) => (
          <div className="cell" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
