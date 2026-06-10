import { NextResponse } from "next/server";
import type { FxRate } from "@/lib/types";

const TARGETS = "USD,GBP,JPY,CHF,CAD,AUD,CNY,SEK,NOK,PLN,INR,BRL,MXN,KRW,TRY";

export async function GET() {
  const start = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10);
  const url = `https://api.frankfurter.app/${start}..?from=EUR&to=${TARGETS}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`Frankfurter returned ${res.status}`);
    const json = await res.json();
    const dates = Object.keys(json.rates ?? {}).sort();
    if (dates.length === 0) throw new Error("No FX data");
    const last = dates[dates.length - 1];
    const prev = dates.length > 1 ? dates[dates.length - 2] : last;
    const rates: FxRate[] = Object.keys(json.rates[last]).map((ccy) => {
      const rate = json.rates[last][ccy];
      const prevRate = json.rates[prev]?.[ccy] ?? rate;
      return {
        pair: `EUR/${ccy}`,
        rate,
        prevRate,
        changePct: prevRate ? ((rate - prevRate) / prevRate) * 100 : 0,
        date: last,
      };
    });
    return NextResponse.json({ rates, base: "EUR", date: last });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
