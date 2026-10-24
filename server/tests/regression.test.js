import test from 'node:test';
import assert from 'node:assert/strict';
import { trainLinearRegression, mulberry32, predictOne, evaluate } from '../src/services/regression.js';

function synthetic(n, seed = 7, noise = 0.2) {
  const rand = mulberry32(seed);
  const X = [];
  const y = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * 10;
    const b = rand() * 100;
    X.push([a, b]);
    y.push(3 * a - 2 * b + 5 + (rand() - 0.5) * noise);
  }
  return { X, y };
}

test('recovers known weights and bias in original units', () => {
  const { X, y } = synthetic(500);
  const m = trainLinearRegression(X, y);
  assert.ok(Math.abs(m.weights[0] - 3) < 0.02, `w0=${m.weights[0]}`);
  assert.ok(Math.abs(m.weights[1] + 2) < 0.01, `w1=${m.weights[1]}`);
  assert.ok(Math.abs(m.bias - 5) < 0.2, `bias=${m.bias}`);
  assert.ok(m.metrics.test.r2 > 0.999);
  assert.ok(m.converged);
});

test('matches the closed-form least-squares slope for one feature', () => {
  const rand = mulberry32(3);
  const X = [];
  const y = [];
  for (let i = 0; i < 300; i++) {
    const x = rand() * 50;
    X.push([x]);
    y.push(1.7 * x + 12 + (rand() - 0.5) * 8);
  }
  const m = trainLinearRegression(X, y, { testSize: 0.1, seed: 5, epochs: 5000 });
  // closed form on the same training rows is unavailable, so compare with the full-data fit within noise tolerance
  const n = X.length;
  const mx = X.reduce((s, r) => s + r[0], 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  const slope = X.reduce((s, r, i) => s + (r[0] - mx) * (y[i] - my), 0) / X.reduce((s, r) => s + (r[0] - mx) ** 2, 0);
  assert.ok(Math.abs(m.weights[0] - slope) < 0.05, `gd=${m.weights[0]} closed=${slope}`);
});

test('is reproducible for the same seed and differs for another seed', () => {
  const { X, y } = synthetic(200, 11, 5);
  const a = trainLinearRegression(X, y, { seed: 1 });
  const b = trainLinearRegression(X, y, { seed: 1 });
  const c = trainLinearRegression(X, y, { seed: 2 });
  assert.deepEqual(a.weights, b.weights);
  assert.notDeepEqual(a.weights, c.weights);
});

test('split sizes add up and test metrics are reported', () => {
  const { X, y } = synthetic(100);
  const m = trainLinearRegression(X, y, { testSize: 0.25 });
  assert.equal(m.trainRows + m.testRows, 100);
  assert.equal(m.testRows, 25);
  assert.equal(m.metrics.test.n, 25);
  assert.ok(m.samples.length <= 200 && m.samples.length === 25);
});

test('loss decreases over training', () => {
  const { X, y } = synthetic(200, 2, 3);
  const m = trainLinearRegression(X, y, { learningRate: 0.01, epochs: 300 });
  assert.ok(m.lossHistory.length > 3);
  assert.ok(m.lossHistory.at(-1).loss < m.lossHistory[0].loss);
});

test('handles a constant feature without producing NaN', () => {
  const rand = mulberry32(9);
  const X = [];
  const y = [];
  for (let i = 0; i < 60; i++) {
    const a = rand() * 5;
    X.push([a, 4]);
    y.push(2 * a + 1);
  }
  const m = trainLinearRegression(X, y);
  assert.ok(m.weights.every(Number.isFinite) && Number.isFinite(m.bias));
  assert.ok(m.metrics.test.r2 > 0.999);
});

test('rejects a learning rate that diverges and tiny datasets', () => {
  const { X, y } = synthetic(50);
  assert.throws(() => trainLinearRegression(X, y, { learningRate: 50, epochs: 500 }), /diverged/i);
  assert.throws(() => trainLinearRegression([[1], [2]], [1, 2]), /Not enough rows/);
});

test('evaluate and predictOne agree on a perfect fit', () => {
  const X = [[1], [2], [3]];
  const y = [3, 5, 7];
  assert.equal(predictOne([2], 1, [4]), 9);
  const e = evaluate([2], 1, X, y);
  assert.equal(e.r2, 1);
  assert.equal(e.rmse, 0);
});
