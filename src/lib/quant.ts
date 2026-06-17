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

// align N daily candle series on the calendar days common to ALL of them
export function alignMany(series: Candle[][]): number[][] {
  const dayKey = (t: number) => Math.floor(t / 86400);
  if (series.length === 0) return [];
  const maps = series.map((s) => new Map(s.map((c) => [dayKey(c.time), c.close])));
  const days = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort((a, b) => a - b);
  return maps.map((m) => days.map((d) => m.get(d) as number));
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

// ---------- linear algebra helpers ----------

// Gauss-Jordan inversion with partial pivoting (n small: portfolio of a few assets)
export function invertMatrix(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-12) return null; // singular
    [a[col], a[piv]] = [a[piv], a[col]];
    const d = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}

const matVec = (m: number[][], v: number[]) => m.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

// ---------- Markowitz mean-variance optimization (short selling allowed) ----------

export type RiskClass = "LOW" | "MID" | "HIGH";

export interface AssetStat {
  symbol: string;
  ret: number; // annualized expected log return
  vol: number; // annualized volatility
  beta: number; // vs benchmark
  riskClass: RiskClass;
}

export interface PortfolioPoint {
  vol: number;
  ret: number;
}

export interface FrontierResult {
  assets: AssetStat[];
  frontier: PortfolioPoint[]; // full hyperbola (lower + efficient branch)
  cloud: PortfolioPoint[]; // random feasible portfolios (the feasible region)
  gmv: { vol: number; ret: number; weights: number[] };
  tangency: { vol: number; ret: number; sharpe: number; weights: number[] } | null;
  cml: PortfolioPoint[]; // capital market line: (0,rf) through tangency
  rf: number;
  abcd: { A: number; B: number; C: number; D: number };
  n: number;
}

function riskClassOf(beta: number): RiskClass {
  if (beta < 0.8) return "LOW";
  if (beta > 1.2) return "HIGH";
  return "MID";
}

// covariance matrix (annualized) of a set of aligned log-return series
function covMatrixAnn(rets: number[][], periodsPerYear = 252): number[][] {
  const n = rets.length;
  const means = rets.map(mean);
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const c = covariance(rets[i], rets[j], means[i], means[j]) * periodsPerYear;
      cov[i][j] = c;
      cov[j][i] = c;
    }
  }
  return cov;
}

// Box-Muller standard normal (deterministic randomness is not needed for the cloud)
function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function markowitz(
  symbols: string[],
  closes: number[][], // aligned closes per asset (same length)
  benchCloses: number[], // aligned benchmark closes (same length)
  rf: number,
  cloudSize = 2000
): FrontierResult | null {
  const n = symbols.length;
  if (n < 2) return null;
  const rets = closes.map(logReturns);
  const rBench = logReturns(benchCloses);
  if (rets.some((r) => r.length < 30)) return null;

  const mu = rets.map((r) => mean(r) * 252);
  const Sigma = covMatrixAnn(rets);
  const SigmaInv = invertMatrix(Sigma);
  if (!SigmaInv) return null;

  // per-asset stats + beta vs benchmark
  const mBench = mean(rBench);
  const varBench = covariance(rBench, rBench, mBench, mBench);
  const assets: AssetStat[] = symbols.map((symbol, i) => {
    const beta = varBench > 0 ? covariance(rets[i], rBench, mean(rets[i]), mBench) / varBench : 0;
    return {
      symbol,
      ret: mu[i],
      vol: Math.sqrt(Sigma[i][i]),
      beta,
      riskClass: riskClassOf(beta),
    };
  });

  const ones = new Array(n).fill(1);
  const SiOnes = matVec(SigmaInv, ones);
  const SiMu = matVec(SigmaInv, mu);
  const A = dot(ones, SiOnes);
  const B = dot(ones, SiMu);
  const C = dot(mu, SiMu);
  const D = A * C - B * B;
  if (Math.abs(A) < 1e-12 || Math.abs(D) < 1e-12) return null;

  // global minimum-variance portfolio
  const wGmv = SiOnes.map((x) => x / A);
  const retGmv = B / A;
  const volGmv = Math.sqrt(1 / A);

  // efficient-frontier hyperbola: var(m) = (A m^2 - 2B m + C)/D
  const lo = retGmv - 0.6 * Math.max(Math.abs(retGmv), 0.2);
  const hi = retGmv + 0.9 * Math.max(Math.abs(retGmv), 0.2);
  const frontier: PortfolioPoint[] = [];
  const STEPS = 120;
  for (let k = 0; k <= STEPS; k++) {
    const m = lo + ((hi - lo) * k) / STEPS;
    const variance = (A * m * m - 2 * B * m + C) / D;
    if (variance > 0) frontier.push({ vol: Math.sqrt(variance), ret: m });
  }

  // tangency portfolio (max Sharpe), defined when B - A*rf != 0
  let tangency: FrontierResult["tangency"] = null;
  let cml: PortfolioPoint[] = [];
  const denom = B - A * rf;
  if (Math.abs(denom) > 1e-9) {
    const excess = mu.map((x) => x - rf);
    const SiExcess = matVec(SigmaInv, excess);
    const wTan = SiExcess.map((x) => x / denom);
    const retTan = dot(wTan, mu);
    const varTan = dot(wTan, matVec(Sigma, wTan));
    if (varTan > 0) {
      const volTan = Math.sqrt(varTan);
      const sharpe = (retTan - rf) / volTan;
      tangency = { vol: volTan, ret: retTan, sharpe, weights: wTan };
      const maxVol = Math.max(volTan * 1.6, ...frontier.map((p) => p.vol));
      cml = [
        { vol: 0, ret: rf },
        { vol: maxVol, ret: rf + sharpe * maxVol },
      ];
    }
  }

  // feasible region: random portfolios with weights summing to 1 (short allowed)
  const cloud: PortfolioPoint[] = [];
  for (let s = 0; s < cloudSize; s++) {
    const raw = Array.from({ length: n }, () => gauss());
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    const w = raw.map((x) => x / sum);
    const ret = dot(w, mu);
    const variance = dot(w, matVec(Sigma, w));
    if (variance > 0) cloud.push({ vol: Math.sqrt(variance), ret });
  }

  return {
    assets,
    frontier,
    cloud,
    gmv: { vol: volGmv, ret: retGmv, weights: wGmv },
    tangency,
    cml,
    rf,
    abcd: { A, B, C, D },
    n,
  };
}

// ---------- bond pricing / term structure ----------

export interface BondAnalytics {
  price: number; // clean price (per 100 face)
  ytm: number; // yield to maturity (decimal, annual)
  macaulay: number; // years
  modified: number; // years
  convexity: number; // years^2
  currentYield: number;
}

// present value of a coupon bond given annual yield (decimal)
export function bondPrice(
  face: number,
  couponRate: number, // decimal annual
  ytm: number, // decimal annual
  years: number,
  freq = 2
): number {
  const nPer = Math.max(1, Math.round(years * freq));
  const c = (face * couponRate) / freq;
  const y = ytm / freq;
  let pv = 0;
  for (let t = 1; t <= nPer; t++) pv += c / Math.pow(1 + y, t);
  pv += face / Math.pow(1 + y, nPer);
  return pv;
}

// solve YTM from price by bisection on [0.01%, 200%]
export function bondYTM(
  price: number,
  face: number,
  couponRate: number,
  years: number,
  freq = 2
): number {
  let lo = 0.0001;
  let hi = 2.0;
  const f = (y: number) => bondPrice(face, couponRate, y, years, freq) - price;
  if (f(lo) * f(hi) > 0) return NaN;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (Math.abs(v) < 1e-9) return mid;
    if (f(lo) * v < 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function bondAnalytics(
  face: number,
  couponRate: number,
  ytm: number,
  years: number,
  freq = 2
): BondAnalytics {
  const nPer = Math.max(1, Math.round(years * freq));
  const c = (face * couponRate) / freq;
  const y = ytm / freq;
  const price = bondPrice(face, couponRate, ytm, years, freq);
  let wDur = 0; // sum t_years * PV
  let conv = 0; // sum k(k+1) CF / (1+y)^k
  for (let t = 1; t <= nPer; t++) {
    const cf = t === nPer ? c + face : c;
    const pv = cf / Math.pow(1 + y, t);
    wDur += (t / freq) * pv;
    conv += (t * (t + 1) * cf) / Math.pow(1 + y, t + 2);
  }
  const macaulay = wDur / price;
  const modified = macaulay / (1 + y);
  const convexity = conv / price / (freq * freq);
  return {
    price,
    ytm,
    macaulay,
    modified,
    convexity,
    currentYield: (face * couponRate) / price,
  };
}
