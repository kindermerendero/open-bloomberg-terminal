"use client";

import type { Quote } from "@/lib/types";
import { fmtPct, fmtPrice, signClass } from "@/lib/format";

interface Props {
  quotes: Quote[];
  loading: boolean;
  onSelect: (symbol: string) => void;
}

export default function WatchlistPanel({ quotes, loading, onSelect }: Props) {
  return (
    <div className="panel" style={{ flex: "1 1 45%" }}>
      <div className="panel-title">
        Watchlist <span className="sub">ADD/DEL &lt;SYM&gt;</span>
      </div>
      <div className="panel-body">
        {quotes.length === 0 ? (
          <div className={loading ? "loading" : "empty"}>
            {loading ? "LOADING…" : "Watchlist empty — ADD AAPL"}
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Sym</th>
                <th>Last</th>
                <th>Chg%</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.symbol} className="clickable" onClick={() => onSelect(q.symbol)}>
                  <td className="sym">{q.symbol}</td>
                  <td>{fmtPrice(q.price)}</td>
                  <td className={signClass(q.changePct)}>{fmtPct(q.changePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
