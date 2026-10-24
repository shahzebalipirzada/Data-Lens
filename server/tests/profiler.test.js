import test from 'node:test';
import assert from 'node:assert/strict';
import { inferType, isMissing, toNumber, profileDataset, pearson } from '../src/services/profiler.js';
import { parseCsv } from '../src/services/csv.js';

test('toNumber handles plain, signed, decimal, exponent and thousands formats', () => {
  assert.equal(toNumber('42'), 42);
  assert.equal(toNumber(' -3.5 '), -3.5);
  assert.equal(toNumber('1e3'), 1000);
  assert.equal(toNumber('1,234,567.5'), 1234567.5);
  assert.ok(Number.isNaN(toNumber('abc')));
  assert.ok(Number.isNaN(toNumber('')));
  assert.ok(Number.isNaN(toNumber('12abc')));
});

test('isMissing recognises common null markers', () => {
  for (const v of ['', ' ', 'NA', 'n/a', 'NaN', 'null', 'None', '?', null, undefined]) assert.ok(isMissing(v), String(v));
  for (const v of ['0', 'no', 'x']) assert.ok(!isMissing(v), v);
});

test('inferType detects numbers, booleans, dates, strings and empty columns', () => {
  assert.equal(inferType(['1', '2', '3.5', 'NA']), 'number');
  assert.equal(inferType(['true', 'false', 'TRUE']), 'boolean');
  assert.equal(inferType(['2024-01-05', '2024-02-10']), 'date');
  assert.equal(inferType(['red', 'green', '3']), 'string');
  assert.equal(inferType(['', 'NA']), 'empty');
});

test('parseCsv pads short rows, names blank headers and de-duplicates headers', () => {
  const { headers, rows } = parseCsv(Buffer.from('a,,a\n1,2,3\n4,5\n'));
  assert.deepEqual(headers, ['a', 'column_2', 'a_2']);
  assert.deepEqual(rows[1], ['4', '5', '']);
});

test('parseCsv strips a UTF-8 BOM and rejects header-only files', () => {
  const { headers } = parseCsv(Buffer.from('﻿x,y\n1,2\n'));
  assert.deepEqual(headers, ['x', 'y']);
  assert.throws(() => parseCsv(Buffer.from('x,y\n')), /at least one data row/);
});

test('profileDataset computes stats, missing values, duplicates and categories', () => {
  const csv = 'n,c\n1,a\n2,a\n3,b\n4,\n4,\n';
  const { headers, rows } = parseCsv(Buffer.from(csv));
  const { columns, summary } = profileDataset(headers, rows);
  const n = columns[0];
  assert.equal(n.type, 'number');
  assert.equal(n.min, 1);
  assert.equal(n.max, 4);
  assert.equal(n.mean, 2.8);
  assert.equal(n.median, 3);
  assert.equal(n.histogram.reduce((s, b) => s + b.count, 0), 5);
  const c = columns[1];
  assert.equal(c.type, 'string');
  assert.equal(c.missing, 2);
  assert.equal(c.missingPct, 40);
  assert.deepEqual(c.topValues[0], { value: 'a', count: 2 });
  assert.equal(summary.duplicateRows, 1);
  assert.equal(summary.totalMissing, 2);
});

test('pearson returns 1 for a perfect line, -1 for inverse, null for a constant', () => {
  assert.ok(Math.abs(pearson([1, 2, 3], [2, 4, 6]) - 1) < 1e-12);
  assert.ok(Math.abs(pearson([1, 2, 3], [6, 4, 2]) + 1) < 1e-12);
  assert.equal(pearson([1, 2, 3], [5, 5, 5]), null);
});
