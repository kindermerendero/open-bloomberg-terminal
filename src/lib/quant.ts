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

// Euclidean projection onto the probability simplex {w≥0, Σw=1}
// (Wang & Carreira-Perpiñán 2013, O(n log n))
function projectSimplex(v: number[]): number[] {
  const u = [...v].sort((a, b) => b - a);
  let css = 0;
  let theta = 0;
  for (let i = 0; i < u.length; i++) {
    css += u[i];
    const t = (css - 1) / (i + 1);
    if (u[i] - t > 0) theta = t;
  }
  return v.map((x) => Math.max(x - theta, 0));
}

// long-only mean-variance subproblem: minimize ½wᵀΣw − q·μᵀw subject to
// w≥0, Σw=1, via projected gradient descent. Sweeping q from 0 (→ GMV) to
// large (→ max-return vertex) traces the long-only efficient frontier.
// L ≥ λmax(Σ) is a safe Lipschitz bound (use trace Σ) so the step 1/L is stable.
function minVarSimplex(Sigma: number[][], mu: number[], q: number, L: number): number[] {
  const n = mu.length;
  let w = new Array(n).fill(1 / n);
  const eta = 1 / L;
  for (let it = 0; it < 800; it++) {
    const g = matVec(Sigma, w).map((x, i) => x - q * mu[i]);
    w = projectSimplex(w.map((x, i) => x - eta * g[i]));
  }
  return w;
}

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
  frontier: PortfolioPoint[]; // efficient branch (what gets highlighted)
  mvFull: PortfolioPoint[]; // full minimum-variance frontier (both branches) — left edge of the feasible region
  edges: PortfolioPoint[][]; // 2-asset frontier arcs (simplex edges) — the "ribs" bounding the long-only region
  cloud: PortfolioPoint[]; // random feasible portfolios (decorative scatter)
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
  allowShort = true,
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

  let gmv: FrontierResult["gmv"];
  let tangency: FrontierResult["tangency"] = null;
  let frontier: PortfolioPoint[] = [];
  const mvFull: PortfolioPoint[] = [];
  let cml: PortfolioPoint[] = [];
  const cloud: PortfolioPoint[] = [];

  const muMin = Math.min(...mu);
  const muMax = Math.max(...mu);
  const muSpan = Math.max(muMax - muMin, 0.1);

  if (allowShort) {
    // ===== closed-form Merton frontier (short selling allowed) =====
    const wGmv = SiOnes.map((x) => x / A);
    gmv = { vol: Math.sqrt(1 / A), ret: B / A, weights: wGmv };

    // tangency portfolio (max Sharpe), defined when B - A*rf != 0
    const denom = B - A * rf;
    if (Math.abs(denom) > 1e-9) {
      const excess = mu.map((x) => x - rf);
      const SiExcess = matVec(SigmaInv, excess);
      const wTan = SiExcess.map((x) => x / denom);
      const retTan = dot(wTan, mu);
      const varTan = dot(wTan, matVec(Sigma, wTan));
      if (varTan > 0) {
        const volTan = Math.sqrt(varTan);
        tangency = { vol: volTan, ret: retTan, sharpe: (retTan - rf) / volTan, weights: wTan };
      }
    }

    // efficient-frontier hyperbola: var(m) = (A m^2 - 2B m + C)/D, spanned so the
    // curve covers GMV, all single assets and the tangency point
    const retAnchors = [gmv.ret, ...mu, ...(tangency ? [tangency.ret] : [])];
    const span = Math.max(Math.max(...retAnchors) - Math.min(...retAnchors), 0.1);
    const lo = Math.min(...retAnchors) - 0.15 * span;
    const hi = Math.max(...retAnchors) + 0.15 * span;
    const STEPS = 120;
    for (let k = 0; k <= STEPS; k++) {
      const m = lo + ((hi - lo) * k) / STEPS;
      const variance = (A * m * m - 2 * B * m + C) / D;
      if (variance > 0) frontier.push({ vol: Math.sqrt(variance), ret: m });
    }
    // full min-variance frontier (wide range) — left boundary of the feasible region
    const loF = muMin - 0.6 * muSpan;
    const hiF = muMax + 0.6 * muSpan;
    for (let k = 0; k <= 160; k++) {
      const m = loF + ((hiF - loF) * k) / 160;
      const variance = (A * m * m - 2 * B * m + C) / D;
      if (variance > 0) mvFull.push({ vol: Math.sqrt(variance), ret: m });
    }

    // feasible region: gaussian perturbations of equal weight projected onto the
    // affine hyperplane Σw=1 (w = raw - (Σraw-1)/n) — keeps weights bounded
    const eq = 1 / n;
    const spread = 0.6;
    for (let s = 0; s < cloudSize; s++) {
      const raw = Array.from({ length: n }, () => eq + gauss() * spread);
      const adj = (raw.reduce((a, b) => a + b, 0) - 1) / n;
      const w = raw.map((x) => x - adj);
      const variance = dot(w, matVec(Sigma, w));
      if (variance > 0) cloud.push({ vol: Math.sqrt(variance), ret: dot(w, mu) });
    }
  } else {
    // ===== numeric long-only frontier (no short selling: w≥0, Σw=1) =====
    const L = Sigma.reduce((s, row, i) => s + row[i], 0) || 1; // trace ≥ λmax(Σ)
    const muRange = Math.max(...mu) - Math.min(...mu) || 0.1;
    const maxDiag = Math.max(...Sigma.map((row, i) => row[i]));
    const qMax = (maxDiag / muRange) * 60;
    const QN = 90;

    const pts: Array<{ vol: number; ret: number; weights: number[] }> = [];
    const addPt = (w: number[]) => {
      const variance = dot(w, matVec(Sigma, w));
      if (variance > 0) pts.push({ vol: Math.sqrt(variance), ret: dot(w, mu), weights: w });
    };
    // risk-aversion sweep over ±q: q=0 → GMV, q→+qMax → max-return vertex (upper,
    // efficient branch), q→−qMax → min-return vertex (lower branch). Together they
    // trace the full long-only minimum-variance frontier (left edge of the region).
    for (let k = -QN; k <= QN; k++) {
      const q = k === 0 ? 0 : Math.sign(k) * qMax * Math.pow(1e-3, 1 - Math.abs(k) / QN);
      addPt(minVarSimplex(Sigma, mu, q, L));
    }
    // explicit min/max-return vertices (100% in the lowest/highest-μ asset)
    const kMax = mu.reduce((bi, x, i) => (x > mu[bi] ? i : bi), 0);
    const kMin = mu.reduce((bi, x, i) => (x < mu[bi] ? i : bi), 0);
    addPt(mu.map((_, i) => (i === kMax ? 1 : 0)));
    addPt(mu.map((_, i) => (i === kMin ? 1 : 0)));
    pts.sort((a, b) => a.ret - b.ret);

    const gmvPt = pts.reduce((best, p) => (p.vol < best.vol ? p : best), pts[0]);
    gmv = { vol: gmvPt.vol, ret: gmvPt.ret, weights: gmvPt.weights };
    // efficient branch (ret ≥ GMV); full min-var frontier = the whole sorted sweep
    frontier = pts.filter((p) => p.ret >= gmvPt.ret - 1e-9).map((p) => ({ vol: p.vol, ret: p.ret }));
    mvFull.push(...pts.map((p) => ({ vol: p.vol, ret: p.ret })));

    // tangency = max-Sharpe portfolio on the long-only frontier
    let bestSharpe = 0;
    for (const p of pts) {
      const sh = (p.ret - rf) / p.vol;
      if (sh > bestSharpe) {
        bestSharpe = sh;
        tangency = { vol: p.vol, ret: p.ret, sharpe: sh, weights: p.weights };
      }
    }

    // feasible region: Dirichlet samples (uniform over the simplex, all w≥0)
    for (let s = 0; s < cloudSize; s++) {
      const raw = Array.from({ length: n }, () => -Math.log(Math.random() || 1e-12));
      const sum = raw.reduce((a, b) => a + b, 0) || 1;
      const w = raw.map((x) => x / sum);
      const variance = dot(w, matVec(Sigma, w));
      if (variance > 0) cloud.push({ vol: Math.sqrt(variance), ret: dot(w, mu) });
    }
  }

  // 2-asset frontier arcs (simplex edges): for each pair (i,j) sweep the weight
  // t∈[0,1] of a two-asset portfolio. These curves are the ribs of the long-only
  // feasible region — their outer envelope is its right boundary.
  const edges: PortfolioPoint[][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const arc: PortfolioPoint[] = [];
      for (let k = 0; k <= 28; k++) {
        const t = k / 28;
        const w = mu.map((_, a) => (a === i ? t : a === j ? 1 - t : 0));
        const variance = dot(w, matVec(Sigma, w));
        if (variance > 0) arc.push({ vol: Math.sqrt(variance), ret: dot(w, mu) });
      }
      edges.push(arc);
    }
  }

  // capital market line: (0,rf) through tangency
  if (tangency) {
    const maxVol = Math.max(tangency.vol * 1.6, ...frontier.map((p) => p.vol));
    cml = [
      { vol: 0, ret: rf },
      { vol: maxVol, ret: rf + tangency.sharpe * maxVol },
    ];
  }

  return {
    assets,
    frontier,
    mvFull,
    edges,
    cloud,
    gmv,
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

// =====================================================================
// CORPORATE FINANCE (modulo Barchiesi) — equity valuation & operazioni
// =====================================================================

// ---------- Dividend Discount Model ----------

// Gordon constant-growth DDM: P0 = D1 / (r - g). Defined only for r > g.
export function ddmGordon(div1: number, r: number, g: number): number | null {
  if (r <= g) return null;
  return div1 / (r - g);
}

// sustainable (internal) growth from fundamentals: g = retention · ROE = (1 - payout)·ROE
export function sustainableGrowth(payout: number, roe: number): number {
  return (1 - payout) * roe;
}

// cost of equity implied by the Gordon model: r = D1/P0 + g
export function impliedCostOfEquity(div1: number, price: number, g: number): number | null {
  if (price <= 0) return null;
  return div1 / price + g;
}

export interface TwoStageResult {
  price: number | null;
  pvHigh: number; // PV of the explicit high-growth dividends
  pvTerminal: number; // PV of the terminal (Gordon) value
  terminalValue: number; // terminal value at year N
  dividends: number[]; // projected D1..DN
}

// Two-stage DDM: dividends grow at g1 for `years`, then at g2 forever.
// d0 = last paid dividend, r = cost of equity.
export function ddmTwoStage(
  d0: number,
  r: number,
  g1: number,
  g2: number,
  years: number
): TwoStageResult {
  const dividends: number[] = [];
  let pvHigh = 0;
  let d = d0;
  for (let t = 1; t <= years; t++) {
    d = d * (1 + g1);
    dividends.push(d);
    pvHigh += d / Math.pow(1 + r, t);
  }
  let terminalValue = 0;
  let pvTerminal = 0;
  let price: number | null = null;
  if (r > g2) {
    const dNext = d * (1 + g2); // first stable dividend (year N+1)
    terminalValue = dNext / (r - g2); // Gordon value at year N
    pvTerminal = terminalValue / Math.pow(1 + r, years);
    price = pvHigh + pvTerminal;
  }
  return { price, pvHigh, pvTerminal, terminalValue, dividends };
}

// Present value of growth opportunities: PVGO = P0 - EPS1/r (no-growth value = EPS/r)
export function pvgo(price: number, eps: number, r: number): number | null {
  if (r <= 0) return null;
  return price - eps / r;
}

// ---------- M&A ----------

export interface MnaResult {
  combinedStandalone: number; // VA(A) + VA(B)
  synergy: number; // VA(AB) - [VA(A)+VA(B)]
  premium: number; // cash premium paid over target market value
  cost: number; // total paid for the target = VA(B) + premium
  npv: number; // gain to the acquirer = synergy - premium
}

// VAN dell'acquisizione = sinergie - premio.
export function mnaEval(vaA: number, vaB: number, vaAB: number, premiumPct: number): MnaResult {
  const combinedStandalone = vaA + vaB;
  const synergy = vaAB - combinedStandalone;
  const premium = vaB * (premiumPct / 100);
  const cost = vaB + premium;
  const npv = synergy - premium;
  return { combinedStandalone, synergy, premium, cost, npv };
}

// ---------- aumento di capitale a pagamento (rights issue) ----------

export interface RightsResult {
  exRights: number; // P_to — prezzo teorico ex-diritto
  rightValue: number; // d — valore del diritto di opzione
  aiafFactor: number; // K = P_to/P_cum — fattore di rettifica AIAF
  proceeds: number; // capitale raccolto = m·Pe
  dilution: number; // m/(n+m) — quota di diluizione
}

// n vecchie azioni, m nuove azioni, Pcum prezzo cum-diritto, Pe prezzo di emissione.
export function rightsIssue(n: number, m: number, pCum: number, pe: number): RightsResult {
  const exRights = (n * pCum + m * pe) / (n + m);
  const rightValue = pCum - exRights;
  const aiafFactor = pCum > 0 ? exRights / pCum : 0;
  return { exRights, rightValue, aiafFactor, proceeds: m * pe, dilution: m / (n + m) };
}
