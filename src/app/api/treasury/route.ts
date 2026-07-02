import { NextResponse } from "next/server";

// Government bond term structure from free public sources, no API key:
//  - source=us  → US Treasury par yield curve (Treasury.gov daily CSV)
//  - source=ez  → Euro area AAA spot rate curve (ECB Data Portal, SDMX csvdata)
// Returns the full daily history over a ~2y window (newest first) so the client
// can scrub dates, overlay comparisons and chart the 10Y–2Y spread over time.

interface CurvePoint {
  label: string;
  years: number;
  yield: number;
}
interface DatedCurve {
  date: string; // ISO YYYY-MM-DD
  points: CurvePoint[];
}

const WINDOW = 520; // ~2y of business days

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

// ---------- US Treasury (Treasury.gov) ----------

const US_COLS: Array<[string, number]> = [
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

const usDateToIso = (mdy: string): string => {
  const [m, d, y] = mdy.split("/");
  return y ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : mdy;
};

async function fetchUsYear(year: number): Promise<DatedCurve[]> {
  const url =
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all` +
    `?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const lines = (await res.text()).trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitCsv(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const dateIdx = header.indexOf("Date");
  const cols = US_COLS.map(([label, years]) => [header.indexOf(label), label, years] as const).filter(
    ([i]) => i >= 0
  );
  const out: DatedCurve[] = [];
  for (let r = 1; r < lines.length; r++) {
    const row = splitCsv(lines[r]).map((c) => c.trim());
    const points: CurvePoint[] = [];
    for (const [i, label, years] of cols) {
      const v = parseFloat(row[i]);
      if (Number.isFinite(v))
        points.push({ label: label.toUpperCase().replace(" ", "").replace("MONTH", "MO"), years, yield: v });
    }
    if (points.length) out.push({ date: usDateToIso(row[dateIdx] || ""), points });
  }
  return out;
}

async function loadUs(year: number): Promise<DatedCurve[]> {
  const all = (await Promise.all([year, year - 1, year - 2].map(fetchUsYear))).flat();
  all.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  return all;
}

// ---------- Euro area (ECB Data Portal) ----------

const EZ_TENORS: Array<[string, number]> = [
  ["SR_3M", 0.25],
  ["SR_6M", 0.5],
  ["SR_9M", 0.75],
  ["SR_1Y", 1],
  ["SR_2Y", 2],
  ["SR_3Y", 3],
  ["SR_5Y", 5],
  ["SR_7Y", 7],
  ["SR_10Y", 10],
  ["SR_20Y", 20],
  ["SR_30Y", 30],
];

async function loadEz(startYear: number, startMonth: string): Promise<DatedCurve[]> {
  const key = EZ_TENORS.map(([t]) => t).join("+");
  const url =
    `https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.${key}` +
    `?startPeriod=${startYear}-${startMonth}-01&format=csvdata`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/csv" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const lines = (await res.text()).trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitCsv(lines[0]);
  const iType = header.indexOf("DATA_TYPE_FM");
  const iDate = header.indexOf("TIME_PERIOD");
  const iVal = header.indexOf("OBS_VALUE");
  const yearsOf = new Map(EZ_TENORS.map(([t, y]) => [t, y]));
  const byDate = new Map<string, CurvePoint[]>();
  for (let r = 1; r < lines.length; r++) {
    const c = splitCsv(lines[r]);
    const years = yearsOf.get(c[iType]);
    const v = parseFloat(c[iVal]);
    if (years == null || !Number.isFinite(v)) continue;
    const date = c[iDate];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push({ label: c[iType].replace("SR_", ""), years, yield: v });
  }
  const out: DatedCurve[] = [...byDate.entries()].map(([date, points]) => ({
    date,
    points: points.sort((a, b) => a.years - b.years),
  }));
  out.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  return out;
}

// ---------- handler ----------

export async function GET(req: Request) {
  try {
    const source = new URL(req.url).searchParams.get("source") === "ez" ? "ez" : "us";
    const now = new Date();
    const year = now.getUTCFullYear();
    const startMonth = String(now.getUTCMonth() + 1).padStart(2, "0");

    let curves = source === "ez" ? await loadEz(year - 2, startMonth) : await loadUs(year);
    if (!curves.length) return NextResponse.json({ error: "term structure data unavailable" }, { status: 502 });
    curves = curves.slice(0, WINDOW);

    // 10Y–2Y spread time series (oldest → newest), in percentage points
    const spreadHistory = curves
      .map((c) => {
        const y2 = c.points.find((p) => p.years === 2)?.yield;
        const y10 = c.points.find((p) => p.years === 10)?.yield;
        return y2 != null && y10 != null ? { date: c.date, spread: Number((y10 - y2).toFixed(4)) } : null;
      })
      .filter((x): x is { date: string; spread: number } => x != null)
      .reverse();

    return NextResponse.json({
      source: source.toUpperCase(),
      label: source === "ez" ? "Euro Area · ECB AAA" : "US Treasury",
      curves,
      spreadHistory,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
