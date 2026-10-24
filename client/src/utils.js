export function fmt(n, digits = 3) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (typeof n !== 'number') return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e9 || abs < 1e-3)) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: abs >= 1000 ? 0 : digits });
}

export const fmtR2 = (r2) => (r2 === null || r2 === undefined || Number.isNaN(r2) ? '—' : r2.toFixed(3));

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export const fmtBytes = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export const r2Label = (r2) => {
  if (r2 === null || r2 === undefined) return { text: 'n/a', tone: 'slate' };
  if (r2 >= 0.9) return { text: 'Excellent fit', tone: 'emerald' };
  if (r2 >= 0.7) return { text: 'Good fit', tone: 'teal' };
  if (r2 >= 0.4) return { text: 'Moderate fit', tone: 'amber' };
  return { text: 'Weak fit', tone: 'rose' };
};
