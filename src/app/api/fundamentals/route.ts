import { NextRequest, NextResponse } from "next/server";
import { yahooFetch } from "@/lib/yahoo";
import type { Fundamentals } from "@/lib/types";

// SEC requires a descriptive User-Agent with contact info on its public APIs.
const SEC_HEADERS = { "User-Agent": "open-bloomberg-terminal (masmerenda@gmail.com)", Accept: "application/json" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fact = { start?: string; end: string; val: number; fy?: number; fp?: string; form?: string };

const daysBetween = (a: string, b: string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;

// latest annual (≈365d duration) value of a flow concept (EPS, net income, DPS)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickAnnual(facts: any, tag: string, unit: string): Fact | null {
  const series: Fact[] | undefined = facts?.["us-gaap"]?.[tag]?.units?.[unit];
  if (!Array.isArray(series)) return null;
  const annual = series.filter(
    (p) => p.form === "10-K" && p.start && daysBetween(p.start, p.end) > 300 && daysBetween(p.start, p.end) < 400
  );
  const pool = annual.length ? annual : series.filter((p) => p.form === "10-K");
  if (!pool.length) return null;
  return pool.reduce((a, b) => (a.end > b.end ? a : b));
}

// latest point-in-time value of a stock concept (equity, shares)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickInstant(facts: any, tag: string, unit: string, taxonomy = "us-gaap"): Fact | null {
  const series: Fact[] | undefined = facts?.[taxonomy]?.[tag]?.units?.[unit];
  if (!Array.isArray(series)) return null;
  const pool = series.filter((p) => p.form === "10-K" || p.form === "10-Q");
  if (!pool.length) return null;
  return pool.reduce((a, b) => (a.end > b.end ? a : b));
}

// trailing-12-month dividends per share from Yahoo chart dividend events (any market, no key)
async function dividendTTM(symbol: string): Promise<number | null> {
  try {
    const res = await yahooFetch(
      `/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&events=div`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const divs = json?.chart?.result?.[0]?.events?.dividends;
    if (!divs) return null;
    const cutoff = Date.now() / 1000 - 365 * 86400;
    let sum = 0;
    let any = false;
    for (const k of Object.keys(divs)) {
      const ev = divs[k];
      if (ev?.date >= cutoff && typeof ev.amount === "number") {
        sum += ev.amount;
        any = true;
      }
    }
    return any ? sum : null;
  } catch {
    return null;
  }
}

let cikMap: Record<string, string> | null = null;
async function resolveCik(symbol: string): Promise<string | null> {
  if (!cikMap) {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: SEC_HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    cikMap = {};
    for (const k of Object.keys(json)) {
      const row = json[k];
      cikMap[String(row.ticker).toUpperCase()] = String(row.cik_str).padStart(10, "0");
    }
  }
  return cikMap[symbol.toUpperCase()] ?? null;
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  // price (from Yahoo meta) + TTM dividends in parallel
  const [priceRes, ttm] = await Promise.all([
    yahooFetch(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`).catch(() => null),
    dividendTTM(symbol),
  ]);
  let price: number | null = null;
  try {
    if (priceRes?.ok) {
      const j = await priceRes.json();
      price = j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }
  } catch {
    /* price stays null */
  }

  const out: Fundamentals = {
    symbol,
    source: "none",
    price,
    eps: null,
    bvps: null,
    roe: null,
    payoutRatio: null,
    netIncome: null,
    equity: null,
    sharesOut: null,
    fiscalYearEnd: null,
    dividendTTM: ttm,
    dividendYield: ttm != null && price ? ttm / price : null,
  };

  try {
    const cik = await resolveCik(symbol);
    if (cik) {
      const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
        headers: SEC_HEADERS,
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const facts = (await res.json())?.facts;
        const eps = pickAnnual(facts, "EarningsPerShareDiluted", "USD/shares");
        const ni = pickAnnual(facts, "NetIncomeLoss", "USD");
        const dps = pickAnnual(facts, "CommonStockDividendsPerShareDeclared", "USD/shares");
        const eq = pickInstant(facts, "StockholdersEquity", "USD");
        const sh =
          pickInstant(facts, "EntityCommonStockSharesOutstanding", "shares", "dei") ??
          pickAnnual(facts, "WeightedAverageNumberOfDilutedSharesOutstanding", "shares");

        out.source = "SEC";
        out.eps = eps?.val ?? null;
        out.netIncome = ni?.val ?? null;
        out.equity = eq?.val ?? null;
        out.sharesOut = sh?.val ?? null;
        out.fiscalYearEnd = eps?.end ?? ni?.end ?? eq?.end ?? null;
        if (out.equity && out.sharesOut) out.bvps = out.equity / out.sharesOut;
        if (out.netIncome && out.equity) out.roe = out.netIncome / out.equity;
        const dpsVal = dps?.val ?? null;
        if (dpsVal != null && out.eps && out.eps > 0) out.payoutRatio = dpsVal / out.eps;
        // prefer SEC declared DPS for the dividend if Yahoo events are missing
        if (out.dividendTTM == null && dpsVal != null) {
          out.dividendTTM = dpsVal;
          out.dividendYield = price ? dpsVal / price : null;
        }
      }
    }
  } catch {
    /* keep Yahoo-only fundamentals */
  }

  return NextResponse.json(out);
}
