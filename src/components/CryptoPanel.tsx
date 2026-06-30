"use client";

import type { CryptoRow } from "@/lib/types";
import { fmtCompact, fmtPct, fmtPrice, signClass } from "@/lib/format";
import { useLang } from "@/lib/i18n";

interface Props {
  rows: CryptoRow[];
  loading: boolean;
  onSelect: (symbol: string) => void;
}

export default function CryptoPanel({ rows, loading, onSelect }: Props) {
  const { t } = useLang();
  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        {t("crypto.title")} <span className="sub">USD</span>
      </div>
      <div className="panel-body">
        {rows.length === 0 ? (
          <div className={loading ? "loading" : "empty"}>
            {loading ? t("common.loading") : t("crypto.empty")}
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("crypto.name")}</th>
                <th>{t("crypto.sym")}</th>
                <th>{t("crypto.price")}</th>
                <th>{t("crypto.chg24")}</th>
                <th>{t("crypto.mktCap")}</th>
                <th>{t("crypto.vol24")}</th>
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
