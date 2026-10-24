// Linear regression trained from scratch with batch gradient descent.
// Features and target are standardised for stable training, then the learned
// parameters are converted back to the original units so predictions work on raw inputs.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledIndices(n, seed) {
  const rand = mulberry32(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
const std = (arr, m) => Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);

export function predictOne(weights, bias, x) {
  let y = bias;
  for (let j = 0; j < weights.length; j++) y += weights[j] * x[j];
  return y;
}

export function evaluate(weights, bias, X, y) {
  const n = y.length;
  if (n === 0) return { r2: null, rmse: null, mae: null, n: 0 };
  const ym = mean(y);
  let ssRes = 0;
  let ssTot = 0;
  let abs = 0;
  for (let i = 0; i < n; i++) {
    const err = y[i] - predictOne(weights, bias, X[i]);
    ssRes += err * err;
    ssTot += (y[i] - ym) ** 2;
    abs += Math.abs(err);
  }
  return {
    r2: ssTot === 0 ? null : 1 - ssRes / ssTot,
    rmse: Math.sqrt(ssRes / n),
    mae: abs / n,
    n,
  };
}

/**
 * @param {number[][]} X raw feature rows
 * @param {number[]} y raw targets
 * @param {{learningRate?:number, epochs?:number, testSize?:number, seed?:number, tolerance?:number}} opts
 */
export function trainLinearRegression(X, y, opts = {}) {
  const { learningRate = 0.05, epochs = 2000, testSize = 0.2, seed = 42, tolerance = 1e-10 } = opts;
  const n = X.length;
  const p = X[0].length;
  if (n < p + 2) throw new Error('Not enough rows to train this model');

  // Train/test split (seeded, so results are reproducible)
  const order = shuffledIndices(n, seed);
  const testCount = Math.min(Math.max(1, Math.round(n * testSize)), n - (p + 1));
  const testIdx = order.slice(0, testCount);
  const trainIdx = order.slice(testCount);
  const Xtr = trainIdx.map((i) => X[i]);
  const ytr = trainIdx.map((i) => y[i]);
  const Xte = testIdx.map((i) => X[i]);
  const yte = testIdx.map((i) => y[i]);

  // Standardise using training statistics only
  const xMeans = [];
  const xStds = [];
  for (let j = 0; j < p; j++) {
    const col = Xtr.map((r) => r[j]);
    const m = mean(col);
    const s = std(col, m);
    xMeans.push(m);
    xStds.push(s > 1e-12 ? s : 1); // constant feature: leave unscaled, weight stays ~0
  }
  const yMean = mean(ytr);
  const yStdRaw = std(ytr, yMean);
  const yStd = yStdRaw > 1e-12 ? yStdRaw : 1;

  const Z = Xtr.map((r) => r.map((v, j) => (v - xMeans[j]) / xStds[j]));
  const t = ytr.map((v) => (v - yMean) / yStd);
  const m = Z.length;

  // Batch gradient descent on mean squared error
  const w = new Array(p).fill(0);
  let b = 0;
  const lossHistory = [];
  const logEvery = Math.max(1, Math.floor(epochs / 100));
  let prevLoss = Infinity;
  let epochsRun = 0;
  let converged = false;

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const grad = new Array(p).fill(0);
    let gradB = 0;
    let loss = 0;
    for (let i = 0; i < m; i++) {
      let pred = b;
      for (let j = 0; j < p; j++) pred += w[j] * Z[i][j];
      const err = pred - t[i];
      loss += err * err;
      gradB += err;
      for (let j = 0; j < p; j++) grad[j] += err * Z[i][j];
    }
    loss /= m;
    for (let j = 0; j < p; j++) w[j] -= (learningRate * 2 * grad[j]) / m;
    b -= (learningRate * 2 * gradB) / m;
    epochsRun = epoch;

    if (!Number.isFinite(loss)) throw new Error('Training diverged. Try a smaller learning rate');
    if (epoch === 1 || epoch % logEvery === 0 || epoch === epochs) lossHistory.push({ epoch, loss });
    if (Math.abs(prevLoss - loss) < tolerance) {
      converged = true;
      if (lossHistory[lossHistory.length - 1]?.epoch !== epoch) lossHistory.push({ epoch, loss });
      break;
    }
    prevLoss = loss;
  }

  // Convert back to original units: y = ym + ys * (b + sum_j w_j (x_j - xm_j) / xs_j)
  const weights = w.map((wj, j) => (wj * yStd) / xStds[j]);
  const bias = yMean + yStd * b - weights.reduce((s, wj, j) => s + wj * xMeans[j], 0);

  const metrics = {
    train: evaluate(weights, bias, Xtr, ytr),
    test: evaluate(weights, bias, Xte, yte),
  };
  const samples = Xte.slice(0, 200).map((row, i) => ({
    actual: yte[i],
    predicted: predictOne(weights, bias, row),
  }));
  const coefficients = weights.map((wj, j) => ({
    feature: j,
    weight: wj,
    importance: Math.abs(w[j]), // standardised weight: comparable across features
  }));

  return {
    weights,
    bias,
    coefficients,
    metrics,
    lossHistory,
    samples,
    epochsRun,
    converged,
    trainRows: Xtr.length,
    testRows: Xte.length,
  };
}
