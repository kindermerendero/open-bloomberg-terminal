"use client";

import { useLang } from "@/lib/i18n";

type Row = [string, string];

export default function HelpPanel() {
  const { t, tRaw } = useLang();

  const section = (heading: string, key: string) => (
    <>
      <h3>{heading}</h3>
      {tRaw<Row[]>(key).map(([cmd, desc]) => (
        <div className="cmd-row" key={cmd}>
          <span className="cmd">{cmd}</span>
          <span className="desc">{desc}</span>
        </div>
      ))}
    </>
  );

  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">{t("help.title")}</div>
      <div className="panel-body help-body">
        {section(t("help.security"), "help.securityCmds")}
        {section(t("help.analytics"), "help.analyticsCmds")}
        {section(t("help.corpfin"), "help.corpfinCmds")}
        {section(t("help.panels"), "help.panelCmds")}
        {section(t("help.watchlist"), "help.watchlistCmds")}
        {section(t("help.navigation"), "help.navCats")}
        <p className="note">{t("help.note")}</p>
      </div>
    </div>
  );
}
