"use client";

import type { FxRate } from "@/lib/types";
import { fmtNum, fmtPct, signClass } from "@/lib/format";
import { useLang } from "@/lib/i18n";

interface Props {
  rates: FxRate[];
  loading: boolean;
  date: string;
}

export default function FxPanel({ rates, loading, date }: Props) {
  const { t } = useLang();
  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">
        {t("fx.title")} <span className="sub">{date}</span>
      </div>
      <div className="panel-body">
        {rates.length === 0 ? (
          <div className={loading ? "loading" : "empty"}>
            {loading ? t("common.loading") : t("fx.empty")}
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>{t("fx.pair")}</th>
                <th>{t("fx.rate")}</th>
                <th>{t("fx.prev")}</th>
                <th>{t("fx.chg")}</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.pair}>
                  <td className="sym">{r.pair}</td>
                  <td>{fmtNum(r.rate, 4)}</td>
                  <td className="dim">{fmtNum(r.prevRate, 4)}</td>
                  <td className={signClass(r.changePct)}>{fmtPct(r.changePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
