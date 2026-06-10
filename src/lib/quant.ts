import type { Candle } from "./types";

// ---------- return statistics ----------

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

// join two daily candle series on calendar day (UTC) so returns are date-aligned
export function alignCloses(a: Candle[], b: Candle[]): [number[], number[]] {
  const dayKey = (t: number) => Math.floor(t / 86400);
  const mapB = new Map(b.map((c) => [dayKey(c.time), c.close]));
  const ca: number[] = [];
  const cb: number[] = [];
  for (const c of a) {
    const vb = mapB.get(dayKey(c.time));
    if (vb != null) {
      ca.push(c.close);
      cb.push(vb);
    }
  }
  return [ca, cb];
}

const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;

function covariance(x: number[], y: number[], mx: number, my: number): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i] - mx) * (y[i] - my);
  return s / (x.length - 1);
}

export function annualizedVol(rets: number[], periodsPerYear = 252): number {
  const m = mean(rets);
  return Math.sqrt(covariance(rets, rets, m, m) * periodsPerYear);
}

// ---------- CAPM ----------

export interface CapmStats {
  beta: number;
  alphaAnn: number;
  r2: number;
  corr: number;
  volAsset: number;
  volBench: number;
  erMarket: number;
  erCapm: number;
  sharpe: number;
  rf: number;
  n: number;
}

export function capmStats(
  assetCandles: Candle[],
  benchCandles: Candle[],
  rf: number
): CapmStats | null {
  const [ca, cb] = alignCloses(assetCandles, benchCandles);
  if (ca.length < 30) return null;
  const ra = logReturns(ca);
  const rb = logReturns(cb);
  const ma = mean(ra);
  const mb = mean(rb);
  const varB = covariance(rb, rb, mb, mb);
  const varA = covariance(ra, ra, ma, ma);
  const cov = covariance(ra, rb, ma, mb);
  if (varB === 0 || varA === 0) return null;

  const beta = cov / varB;
  const corr = cov / Math.sqrt(varA * varB);
  const annA = ma * 252;
  const annB = mb * 252;
  const volAsset = Math.sqrt(varA * 252);
  const volBench = Math.sqrt(varB * 252);
  // Jensen's alpha on annualized excess returns
  const alphaAnn = annA - rf - beta * (annB - rf);
  const erCapm = rf + beta * (annB - rf);
  const sharpe = volAsset > 0 ? (annA - rf) / volAsset : 0;

  return {
    beta,
    alphaAnn,
    r2: corr * corr,
    corr,
    volAsset,
    volBench,
    erMarket: annB,
    erCapm,
    sharpe,
    rf,
    n: ra.length,
  };
}

// ---------- Black-Scholes (continuous limit of the GBM Ito process) ----------

export function normCdf(x: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

export type OptionType = "call" | "put";
export type ExerciseStyle = "eu" | "am";

export function blackScholes(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r: number,
  type: OptionType
): { price: number; delta: number } {
  if (T <= 0 || sigma <= 0) {
    const intrinsic = type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return { price: intrinsic, delta: type === "call" ? (S > K ? 1 : 0) : S < K ? -1 : 0 };
  }
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (type === "call") {
    return {
      price: S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2),
      delta: normCdf(d1),
    };
  }
  return {
    price: K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1),
    delta: normCdf(d1) - 1,
  };
}

// ---------- CRR binomial lattice ----------
// Discretization of the Ito process dS = r S dt + sigma S dW under the
// risk-neutral measure: u = e^(sigma sqrt(dt)), d = 1/u, q = (e^(r dt) - d)/(u - d)

export interface LatticeNode {
  S: number;
  V: number;
  ex: boolean; // early exercise is optimal at this node (American only)
}

export interface BinomialParams {
  S0: number;
  K: number;
  T: number;
  sigma: number;
  r: number;
  steps: number;
  type: OptionType;
  exercise: ExerciseStyle;
}

export interface BinomialResult {
  price: number;
  delta: number;
  u: number;
  d: number;
  q: number;
  dt: number;
  lattice: LatticeNode[][] | null; // populated only for steps <= 8
}

export function binomialPrice(p: BinomialParams): BinomialResult {
  const { S0, K, T, sigma, r, steps, type, exercise } = p;
  const n = Math.max(1, Math.floor(steps));
  const dt = T / n;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const q = (Math.exp(r * dt) - d) / (u - d);
  const disc = Math.exp(-r * dt);
  const payoff = (S: number) => (type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0));

  const keepLattice = n <= 8;
  const lattice: LatticeNode[][] | null = keepLattice ? [] : null;

  if (lattice) {
    for (let i = 0; i <= n; i++) {
      lattice.push(
        Array.from({ length: i + 1 }, (_, j) => ({
          S: S0 * Math.pow(u, j) * Math.pow(d, i - j),
          V: 0,
          ex: false,
        }))
      );
    }
  }

  // terminal payoffs, then backward induction
  let values = Array.from({ length: n + 1 }, (_, j) =>
    payoff(S0 * Math.pow(u, j) * Math.pow(d, n - j))
  );
  if (lattice) lattice[n].forEach((node, j) => (node.V = values[j]));

  let deltaNodes: [number, number] | null = null;
  for (let i = n - 1; i >= 0; i--) {
    const next: number[] = new Array(i + 1);
    for (let j = 0; j <= i; j++) {
      const cont = disc * (q * values[j + 1] + (1 - q) * values[j]);
      const S = S0 * Math.pow(u, j) * Math.pow(d, i - j);
      const intrinsic = payoff(S);
      const early = exercise === "am" && intrinsic > cont + 1e-12;
      next[j] = early ? intrinsic : cont;
      if (lattice) {
        lattice[i][j].V = next[j];
        lattice[i][j].ex = early;
      }
    }
    if (i === 1) deltaNodes = [next[0], next[1]];
    values = next;
  }

  const delta = deltaNodes ? (deltaNodes[1] - deltaNodes[0]) / (S0 * u - S0 * d) : 0;
  return { price: values[0], delta, u, d, q, dt, lattice };
}
