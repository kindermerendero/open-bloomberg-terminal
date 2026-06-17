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

const FKEYS: Array<[string, string]> = [
  ["F1", "HELP"],
  ["F2", "SEC — security view"],
  ["F3", "FX monitor"],
  ["F4", "Crypto monitor"],
  ["F5", "News"],
  ["F6", "CAPM analytics"],
  ["F7", "Option valuation (binomial lattice)"],
  ["F8", "Markowitz frontier"],
  ["F9", "Fixed income / term structure"],
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
        <h3>Function Keys</h3>
        {FKEYS.map(([cmd, desc]) => (
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
