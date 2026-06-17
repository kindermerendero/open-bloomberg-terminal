import { NextResponse } from "next/server";

// US Treasury par yield curve — daily, public CSV, no API key
// https://home.treasury.gov/resource-center/data-chart-center/interest-rates
const COLS: Array<[string, number]> = [
  ["1 Mo", 1 / 12],
  ["1.5 Month", 1.5 / 12],
  ["2 Mo", 2 / 12],
  ["3 Mo", 3 / 12],
  ["4 Mo", 4 / 12],
  ["6 Mo", 6 / 12],
  ["1 Yr", 1],
  ["2 Yr", 2],
  ["3 Yr", 3],
  ["5 Yr", 5],
  ["7 Yr", 7],
  ["10 Yr", 10],
  ["20 Yr", 20],
  ["30 Yr", 30],
];

interface CurvePoint {
  label: string;
  years: number;
  yield: number;
}

// split one CSV line honoring double-quoted fields
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function fetchYear(year: number): Promise<{ date: string; points: CurvePoint[] } | null> {
  const url =
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all` +
    `?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = splitCsv(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const row = splitCsv(lines[1]).map((c) => c.trim()); // most recent day first
  const idx = (label: string) => header.indexOf(label);
  const points: CurvePoint[] = [];
  for (const [label, years] of COLS) {
    const i = idx(label);
    if (i < 0) continue;
    const v = parseFloat(row[i]);
    if (Number.isFinite(v)) points.push({ label: label.toUpperCase(), years, yield: v });
  }
  if (points.length === 0) return null;
  return { date: row[idx("Date")] || "", points };
}

export async function GET() {
  try {
    const now = new Date();
    const year = now.getUTCFullYear();
    let data = await fetchYear(year);
    if (!data) data = await fetchYear(year - 1); // early-January fallback
    if (!data) return NextResponse.json({ error: "treasury data unavailable" }, { status: 502 });

    const pts = data.points;
    const y = (yr: number) => pts.find((p) => p.years === yr)?.yield ?? null;
    const s2 = y(2);
    const s10 = y(10);
    const spread = s2 != null && s10 != null ? s10 - s2 : null;
    const shape =
      spread == null ? "n/a" : spread < -0.05 ? "INVERTED" : spread < 0.2 ? "FLAT" : "NORMAL";

    return NextResponse.json({
      date: data.date,
      points: pts,
      spread10_2: spread,
      shape,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
