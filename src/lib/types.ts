export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  exchange: string;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  prevClose: number | null;
  volume: number | null;
  high52: number | null;
  low52: number | null;
  marketTime: number | null;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: number;
  source: string;
}

export interface FxRate {
  pair: string;
  rate: number;
  prevRate: number;
  changePct: number;
  date: string;
}

export interface CryptoRow {
  id: string;
  rank: number;
  symbol: string;
  name: string;
  price: number;
  changePct24h: number;
  marketCap: number;
  volume24h: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export type ChartRange = "1d" | "5d" | "1mo" | "6mo" | "1y" | "5y" | "max";

export interface Fundamentals {
  symbol: string;
  source: "SEC" | "none"; // SEC EDGAR (US filers) or no fundamentals available
  price: number | null;
  // from SEC EDGAR (latest fiscal year), null when unavailable
  eps: number | null; // diluted EPS
  bvps: number | null; // book value per share
  roe: number | null; // net income / stockholders' equity
  payoutRatio: number | null; // declared DPS / EPS
  netIncome: number | null;
  equity: number | null;
  sharesOut: number | null;
  fiscalYearEnd: string | null;
  // dividends from Yahoo (works for any market)
  dividendTTM: number | null; // trailing 12-month dividends per share
  dividendYield: number | null; // dividendTTM / price (decimal)
}
