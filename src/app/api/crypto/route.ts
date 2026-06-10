import { NextResponse } from "next/server";
import type { CryptoRow } from "@/lib/types";

const URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h";

export async function GET() {
  try {
    const res = await fetch(URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: CryptoRow[] = (json ?? []).map((c: any) => ({
      id: c.id,
      rank: c.market_cap_rank ?? 0,
      symbol: (c.symbol ?? "").toUpperCase(),
      name: c.name ?? "",
      price: c.current_price ?? 0,
      changePct24h: c.price_change_percentage_24h ?? 0,
      marketCap: c.market_cap ?? 0,
      volume24h: c.total_volume ?? 0,
    }));
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
