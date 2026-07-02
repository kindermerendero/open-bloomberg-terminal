import { NextRequest, NextResponse } from "next/server";
import { fetchChart, quoteFromMeta } from "@/lib/yahoo";
import type { ChartRange } from "@/lib/types";

const RANGES = new Set(["1d", "5d", "1mo", "6mo", "1y", "5y", "max"]);

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  const rangeParam = req.nextUrl.searchParams.get("range") ?? "1d";
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }
  const range = (RANGES.has(rangeParam) ? rangeParam : "1d") as ChartRange;
  try {
    // quote always from the 1d chart: on longer ranges chartPreviousClose is the
    // close before the range START, so change% would disagree with the watchlist
    const [main, daily] = await Promise.all([
      fetchChart(symbol, range),
      range === "1d" ? null : fetchChart(symbol, "1d"),
    ]);
    return NextResponse.json({
      quote: quoteFromMeta((daily ?? main).meta),
      candles: main.candles,
      range,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
