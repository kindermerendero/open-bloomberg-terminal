"use client";

import type { Quote } from "@/lib/types";
import { fmtPct, fmtPrice, signClass } from "@/lib/format";
import { useLang } from "@/lib/i18n";

interface Props {
  quotes: Quote[];
  loading: boolean;
  onSelect: (symbol: string) => void;
}

export default function WatchlistPanel({ quotes, loading, onSelect }: Props) {
  const { t } = useLang();
  return (
    <div className="panel" style={{ flex: "1 1 45%" }}>
      <div className="panel-title">
        {t("watchlist.title")} <span className="sub">ADD/DEL &lt;SYM&gt;</span>
      </div>
      <div className="panel-body">
        {quotes.length === 0 ? (
          <div className={loading ? "loading" : "empty"}>
            {loading ? t("common.loading") : t("watchlist.empty")}
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>{t("watchlist.sym")}</th>
                <th>{t("watchlist.last")}</th>
                <th>{t("watchlist.chg")}</th>
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
