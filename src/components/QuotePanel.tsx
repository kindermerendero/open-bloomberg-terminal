"use client";

import type { Quote } from "@/lib/types";
import { fmtChange, fmtCompact, fmtPct, fmtPrice, signClass } from "@/lib/format";

export default function QuotePanel({ quote }: { quote: Quote | null }) {
  if (!quote) {
    return (
      <div className="panel quote-strip">
        <div className="panel-title">Security</div>
        <div className="empty">Type a ticker and press ENTER — e.g. AAPL, ^GSPC, BTC-USD</div>
      </div>
    );
  }
  const cells: Array<[string, string]> = [
    ["OPEN", fmtPrice(quote.open)],
    ["HIGH", fmtPrice(quote.dayHigh)],
    ["LOW", fmtPrice(quote.dayLow)],
    ["PREV CLOSE", fmtPrice(quote.prevClose)],
    ["VOLUME", fmtCompact(quote.volume)],
    ["52W HIGH", fmtPrice(quote.high52)],
    ["52W LOW", fmtPrice(quote.low52)],
    ["EXCHANGE", quote.exchange || "—"],
  ];
  return (
    <div className="panel quote-strip">
      <div className="panel-title">
        Security <span className="sub">{quote.currency}</span>
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
