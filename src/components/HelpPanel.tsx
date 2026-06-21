"use client";

const SECURITY_CMDS: Array<[string, string]> = [
  ["<TICKER>", "Load a security (e.g. AAPL, ^GSPC, EURUSD=X, BTC-USD)"],
  ["<TICKER> GP", "Load security and focus the price graph"],
  ["1D 5D 1M 6M 1Y 5Y MAX", "Change chart range for the loaded security"],
  ["<free text>", "Search — suggestions appear while typing"],
];

const ANALYTICS_CMDS: Array<[string, string]> = [
  ["<TICKER> CAPM | CAPM", "CAPM pricing: β, Jensen's α, R², E(R) vs a benchmark index"],
  ["<TICKER> OV | OV", "Option valuation: CRR binomial lattice on the GBM/Ito process + Black-Scholes"],
  ["MKWZ <T1,T2,T3…>", "Markowitz frontier: feasible region, GMV, tangency, CML, β risk classes"],
  ["BOND | YC", "US Treasury term structure + bond calculator (price/YTM, duration, convexity)"],
];

const CORPFIN_CMDS: Array<[string, string]> = [
  ["<TICKER> EQV | EQV", "Equity valuation: DDM (Gordon + 2-stage), PVGO, P/E, P/BV, div yield"],
  ["MNA", "M&A: synergies = VA(AB)−ΣVA, premium, VAN = synergies − premium"],
  ["RGT | RIGHTS", "Rights issue (ex-rights price, right value, AIAF factor) + buyback"],
  ["IPO", "IPO: bookbuilding, underpricing, money left on table, greenshoe, costs"],
  ["OPA | TENDER", "Tender offer: 30% mandatory / 90% squeeze-out, premium, defenses"],
];

const PANEL_CMDS: Array<[string, string]> = [
  ["N", "Full-screen news"],
  ["FX", "FX monitor (ECB reference rates)"],
  ["CRY", "Crypto monitor (CoinGecko top 20)"],
  ["SEC", "Back to security view"],
  ["HELP", "This screen"],
];

const WATCHLIST_CMDS: Array<[string, string]> = [
  ["ADD <SYM>", "Add a symbol to the watchlist"],
  ["DEL <SYM>", "Remove a symbol from the watchlist"],
];

const NAV_CATS: Array<[string, string]> = [
  ["MARKET", "F1 Security · F2 FX · F3 Crypto · F4 News · F5 Help"],
  ["INVESTMENTS", "F1 CAPM · F2 Option Val · F3 Markowitz · F4 Fixed Inc"],
  ["CORPORATE", "F1 Equity Val · F2 M&A · F3 Rights · F4 IPO · F5 Tender"],
];

export default function HelpPanel() {
  return (
    <div className="panel" style={{ flex: "1 1 auto" }}>
      <div className="panel-title">Help — Command Reference</div>
      <div className="panel-body help-body">
        <h3>Securities</h3>
        {SECURITY_CMDS.map(([cmd, desc]) => (
          <div className="cmd-row" key={cmd}>
            <span className="cmd">{cmd}</span>
            <span className="desc">{desc}</span>
          </div>
        ))}
        <h3>Analytics</h3>
        {ANALYTICS_CMDS.map(([cmd, desc]) => (
          <div className="cmd-row" key={cmd}>
            <span className="cmd">{cmd}</span>
            <span className="desc">{desc}</span>
          </div>
        ))}
        <h3>Corporate Finance</h3>
        {CORPFIN_CMDS.map(([cmd, desc]) => (
          <div className="cmd-row" key={cmd}>
            <span className="cmd">{cmd}</span>
            <span className="desc">{desc}</span>
          </div>
        ))}
        <h3>Panels</h3>
        {PANEL_CMDS.map(([cmd, desc]) => (
          <div className="cmd-row" key={cmd}>
            <span className="cmd">{cmd}</span>
            <span className="desc">{desc}</span>
          </div>
        ))}
        <h3>Watchlist</h3>
        {WATCHLIST_CMDS.map(([cmd, desc]) => (
          <div className="cmd-row" key={cmd}>
            <span className="cmd">{cmd}</span>
            <span className="desc">{desc}</span>
          </div>
        ))}
        <h3>Navigation — category tabs + F-keys</h3>
        {NAV_CATS.map(([cmd, desc]) => (
          <div className="cmd-row" key={cmd}>
            <span className="cmd">{cmd}</span>
            <span className="desc">{desc}</span>
          </div>
        ))}
        <p className="note">
          Data sources (all free, no API keys): Yahoo Finance public endpoints (quotes, history,
          search, per-symbol news), CoinGecko free API (crypto), Frankfurter.app / ECB (FX), CNBC +
          Yahoo Finance RSS (headlines). Quotes may be delayed 15–20 minutes depending on exchange.
        </p>
      </div>
    </div>
  );
}
