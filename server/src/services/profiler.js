// Dataset profiling: type inference, missing values, summary statistics,
// histograms, top categories and a Pearson correlation matrix.

const MISSING = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', 'nil', '-', '?']);
const BOOLEANS = new Set(['true', 'false', 'yes', 'no']);
const THOUSANDS = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

export const isMissing = (v) => v === null || v === undefined || MISSING.has(String(v).trim().toLowerCase());

/** Convert a raw cell to a finite number, or NaN. */
export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v ?? '').trim();
  if (s === '') return NaN;
  const cleaned = THOUSANDS.test(s) ? s.replace(/,/g, '') : s;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(cleaned)) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

const round = (n, d = 4) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null);

export function inferType(values) {
  const present = values.filter((v) => !isMissing(v));
  if (present.length === 0) return 'empty';
  const share = (test) => present.filter(test).length / present.length;
  if (share((v) => BOOLEANS.has(String(v).trim().toLowerCase())) >= 0.98) return 'boolean';
  if (share((v) => !Number.isNaN(toNumber(v))) >= 0.95) return 'number';
  if (share((v) => ISO_DATE.test(String(v).trim())) >= 0.95) return 'date';
  return 'string';
}

function quantile(sorted, q) {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function histogram(sorted, bins = 10) {
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) return [{ from: min, to: max, count: sorted.length }];
  const width = (max - min) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({
    from: round(min + i * width),
    to: round(min + (i + 1) * width),
    count: 0,
  }));
  for (const v of sorted) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    out[idx].count += 1;
  }
  return out;
}

function numericStats(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  return {
    min: round(sorted[0]),
    max: round(sorted[n - 1]),
    mean: round(mean),
    median: round(quantile(sorted, 0.5)),
    std: round(Math.sqrt(variance)),
    q1: round(quantile(sorted, 0.25)),
    q3: round(quantile(sorted, 0.75)),
    histogram: histogram(sorted),
  };
}

export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function profileColumn(name, index, rows) {
  const raw = rows.map((r) => r[index]);
  const type = inferType(raw);
  const present = raw.filter((v) => !isMissing(v));
  const missing = raw.length - present.length;

  const base = {
    name,
    index,
    type,
    count: present.length,
    missing,
    missingPct: round((missing / raw.length) * 100, 2),
    unique: new Set(present.map((v) => String(v))).size,
  };

  if (type === 'number') {
    const nums = present.map(toNumber).filter((n) => !Number.isNaN(n));
    return { ...base, ...numericStats(nums) };
  }

  if (type === 'date') {
    const times = present.map((v) => Date.parse(String(v))).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
    return {
      ...base,
      earliest: times.length ? new Date(times[0]).toISOString() : null,
      latest: times.length ? new Date(times[times.length - 1]).toISOString() : null,
    };
  }

  if (type === 'empty') return base;

  const counts = new Map();
  for (const v of present) {
    const key = String(v);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const topValues = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value, count]) => ({ value, count }));
  return { ...base, topValues };
}

export function correlationMatrix(headers, rows, columns, maxColumns = 12) {
  const numeric = columns.filter((c) => c.type === 'number').slice(0, maxColumns);
  if (numeric.length < 2) return null;
  const series = numeric.map((c) => rows.map((r) => toNumber(r[c.index])));
  // Flat list of cells (not a nested array) so it stores cleanly in any MongoDB-compatible database
  const cells = [];
  for (let i = 0; i < numeric.length; i++) {
    for (let j = 0; j < numeric.length; j++) {
      let r = 1;
      if (i !== j) {
        const xs = [];
        const ys = [];
        for (let k = 0; k < rows.length; k++) {
          if (!Number.isNaN(series[i][k]) && !Number.isNaN(series[j][k])) {
            xs.push(series[i][k]);
            ys.push(series[j][k]);
          }
        }
        r = round(pearson(xs, ys), 3);
      }
      cells.push({ x: i, y: j, r });
    }
  }
  return { columns: numeric.map((c) => c.name), cells };
}

export function profileDataset(headers, rows) {
  const columns = headers.map((h, i) => profileColumn(h, i, rows));
  const seen = new Set();
  let duplicateRows = 0;
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicateRows += 1;
    else seen.add(key);
  }
  const totalCells = rows.length * headers.length;
  const totalMissing = columns.reduce((s, c) => s + c.missing, 0);
  const summary = {
    rowCount: rows.length,
    columnCount: headers.length,
    totalMissing,
    missingPct: round(totalCells ? (totalMissing / totalCells) * 100 : 0, 2),
    duplicateRows,
    numericColumns: columns.filter((c) => c.type === 'number').length,
    categoricalColumns: columns.filter((c) => c.type === 'string' || c.type === 'boolean').length,
    dateColumns: columns.filter((c) => c.type === 'date').length,
  };
  return { columns, summary, correlations: correlationMatrix(headers, rows, columns) };
}
