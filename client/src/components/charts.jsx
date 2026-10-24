import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmt } from '../utils.js';

const TEAL = '#0f766e';
const AXIS = { fontSize: 11, fill: '#78716c' };

export function Histogram({ bins }) {
  const data = bins.map((b) => ({ label: b.from === b.to ? fmt(b.from) : `${fmt(b.from)} – ${fmt(b.to)}`, from: b.from, count: b.count }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
        <XAxis dataKey="from" tick={AXIS} tickFormatter={(v) => fmt(v, 1)} interval="preserveStartEnd" />
        <YAxis tick={AXIS} allowDecimals={false} width={40} />
        <Tooltip formatter={(v) => [v, 'Rows']} labelFormatter={(_, p) => p?.[0]?.payload?.label} />
        <Bar dataKey="count" fill={TEAL} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopValuesChart({ values }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, values.length * 34)}>
      <BarChart data={values} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
        <XAxis type="number" tick={AXIS} allowDecimals={false} />
        <YAxis type="category" dataKey="value" tick={AXIS} width={110} />
        <Tooltip formatter={(v) => [v, 'Rows']} />
        <Bar dataKey="count" fill="#7c3aed" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LossCurve({ history }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={history} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis dataKey="epoch" tick={AXIS} />
        <YAxis tick={AXIS} width={48} tickFormatter={(v) => fmt(v, 2)} />
        <Tooltip formatter={(v) => [fmt(v, 5), 'Loss']} labelFormatter={(e) => `Epoch ${e}`} />
        <Line type="monotone" dataKey="loss" stroke={TEAL} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ActualVsPredicted({ samples }) {
  const values = samples.flatMap((s) => [s.actual, s.predicted]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis type="number" dataKey="actual" name="Actual" domain={[min, max]} tick={AXIS} tickFormatter={(v) => fmt(v, 1)} label={{ value: 'Actual', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#78716c' }} />
        <YAxis type="number" dataKey="predicted" name="Predicted" domain={[min, max]} tick={AXIS} width={52} tickFormatter={(v) => fmt(v, 1)} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => fmt(v, 2)} />
        <ReferenceLine segment={[{ x: min, y: min }, { x: max, y: max }]} stroke="#a8a29e" strokeDasharray="5 5" />
        <Scatter data={samples} fill={TEAL} fillOpacity={0.65} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// Correlation heatmap drawn with plain divs so it stays crisp and accessible
export function CorrelationHeatmap({ correlations }) {
  const { columns, cells } = correlations;
  const n = columns.length;
  const color = (r) => {
    if (r === null || r === undefined) return '#f5f5f4';
    const a = Math.min(1, Math.abs(r));
    return r >= 0 ? `rgba(15,118,110,${0.08 + a * 0.85})` : `rgba(190,18,60,${0.08 + a * 0.85})`;
  };
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `minmax(90px,auto) repeat(${n}, minmax(56px, 1fr))` }}>
        <div />
        {columns.map((c) => (
          <div key={c} className="truncate px-1 pb-1 text-center text-[11px] font-medium text-stone-600" title={c}>{c}</div>
        ))}
        {columns.map((rowName, i) => (
          <div key={rowName} className="contents">
            <div className="truncate pr-2 text-right text-[11px] font-medium leading-9 text-stone-600" title={rowName}>{rowName}</div>
            {columns.map((colName, j) => {
              const cell = cells.find((c) => c.x === i && c.y === j);
              const r = cell?.r;
              return (
                <div
                  key={colName}
                  title={`${rowName} vs ${colName}: ${r ?? 'n/a'}`}
                  className="flex h-9 items-center justify-center rounded-sm text-[11px] font-medium tabular-nums"
                  style={{ background: color(r), color: r !== null && Math.abs(r) > 0.55 ? '#fff' : '#292524' }}
                >
                  {r === null || r === undefined ? '–' : r.toFixed(2)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
