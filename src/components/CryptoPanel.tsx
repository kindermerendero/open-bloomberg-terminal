"use client";

import type { CryptoRow } from "@/lib/types";
import { fmtCompact, fmtPct, fmtPrice, signClass } from "@/lib/format";

interface Props {
  rows: CryptoRow[];
  loading: boolean;
  onSelect: (symbol: string) => void;
}

export default function CryptoPanel({ rows, loading, onSelect }: Props) {
  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        Crypto Monitor — CoinGecko <span className="sub">USD</span>
      </div>
      <div className="panel-body">
        {rows.length === 0 ? (
          <div className={loading ? "loading" : "empty"}>
            {loading ? "LOADING…" : "No crypto data available"}
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Sym</th>
                <th>Price</th>
                <th>24H%</th>
                <th>Mkt Cap</th>
                <th>Vol 24H</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => onSelect(`${c.symbol}-USD`)}>
                  <td className="dim" style={{ textAlign: "left" }}>
                    {c.rank}
                  </td>
                  <td style={{ textAlign: "left" }}>{c.name}</td>
                  <td className="sym">{c.symbol}</td>
                  <td>{fmtPrice(c.price)}</td>
                  <td className={signClass(c.changePct24h)}>{fmtPct(c.changePct24h)}</td>
                  <td className="dim">{fmtCompact(c.marketCap)}</td>
                  <td className="dim">{fmtCompact(c.volume24h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
