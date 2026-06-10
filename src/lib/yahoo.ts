import type { Candle, ChartRange, Quote } from "./types";

// Keep headers minimal: Yahoo rejects (429) full browser UAs whose TLS
// fingerprint doesn't match a real browser, but accepts a bare Mozilla/5.0
const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "*/*",
};

// query1 is aggressively rate-limited (429) from some networks; query2 serves the same API
const HOSTS = ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"];

export async function yahooFetch(path: string): Promise<Response> {
  let last: Response | null = null;
  for (const host of HOSTS) {
    const res = await fetch(`${host}${path}`, { headers: HEADERS, next: { revalidate: 30 } });
    if (res.ok) return res;
    last = res;
  }
  return last!;
}

const RANGE_INTERVAL: Record<ChartRange, string> = {
  "1d": "5m",
  "5d": "15m",
  "1mo": "1d",
  "6mo": "1d",
  "1y": "1d",
  "5y": "1wk",
  max: "1mo",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchChart(symbol: string, range: ChartRange = "1d"): Promise<{ meta: any; candles: Candle[] }> {
  const interval = RANGE_INTERVAL[range] ?? "1d";
  const res = await yahooFetch(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`
  );
  if (!res.ok) throw new Error(`Yahoo returned ${res.status} for ${symbol}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error(json?.chart?.error?.description ?? `No data for ${symbol}`);
  }
  const timestamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = q.open?.[i];
    const high = q.high?.[i];
    const low = q.low?.[i];
    const close = q.close?.[i];
    if (open == null || high == null || low == null || close == null) continue;
    candles.push({ time: timestamps[i], open, high, low, close, volume: q.volume?.[i] ?? 0 });
  }
  return { meta: result.meta, candles };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function quoteFromMeta(meta: any): Quote {
  const price: number = meta.regularMarketPrice ?? 0;
  const prevClose: number | null = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change = prevClose != null ? price - prevClose : 0;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  return {
    symbol: meta.symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    price,
    change,
    changePct,
    currency: meta.currency ?? "",
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? "",
    open: meta.regularMarketDayOpen ?? null,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    prevClose,
    volume: meta.regularMarketVolume ?? null,
    high52: meta.fiftyTwoWeekHigh ?? null,
    low52: meta.fiftyTwoWeekLow ?? null,
    marketTime: meta.regularMarketTime ?? null,
  };
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const settled = await Promise.allSettled(symbols.map((s) => fetchChart(s, "1d")));
  return settled
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchChart>>> => r.status === "fulfilled")
    .map((r) => quoteFromMeta(r.value.meta));
}
