export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const digits = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 2 : 4;
  return fmtNum(n, digits);
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

export function fmtChange(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + fmtPrice(n);
}

export function signClass(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n) || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}

export function fmtAgo(ts: number, lang: "en" | "it" = "en"): string {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return lang === "it" ? "ora" : "now";
  if (mins < 60) return lang === "it" ? `${mins}m fa` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === "it" ? `${hours}h fa` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === "it" ? `${days}g fa` : `${days}d ago`;
}
