import { NextRequest, NextResponse } from "next/server";
import { yahooFetch } from "@/lib/yahoo";
import type { SearchResult } from "@/lib/types";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  try {
    const res = await yahooFetch(
      `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`
    );
    if (!res.ok) throw new Error(`Yahoo search returned ${res.status}`);
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: SearchResult[] = (json.quotes ?? [])
      .filter((r: any) => r.symbol)
      .map((r: any) => ({
        symbol: r.symbol,
        name: r.longname ?? r.shortname ?? r.symbol,
        exchange: r.exchDisp ?? r.exchange ?? "",
        type: r.typeDisp ?? r.quoteType ?? "",
      }));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
