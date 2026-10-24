import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { Badge, Button, Card, ErrorBanner, Field, PageHeader, Spinner, Stat, inputClass, typeTone } from '../components/ui.jsx';
import { CorrelationHeatmap, Histogram, TopValuesChart } from '../components/charts.jsx';
import { fmt, fmtBytes, fmtDate, fmtR2, r2Label } from '../utils.js';

function ColumnDetail({ col }) {
  if (col.type === 'number') {
    return (
      <>
        <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[['Min', col.min], ['Q1', col.q1], ['Median', col.median], ['Mean', col.mean], ['Q3', col.q3], ['Max', col.max], ['Std dev', col.std], ['Unique', col.unique]].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-stone-500">{k}</dt><dd className="font-medium tabular-nums">{fmt(v)}</dd></div>
          ))}
        </dl>
        <Histogram bins={col.histogram} />
      </>
    );
  }
  if (col.topValues?.length) return <TopValuesChart values={col.topValues} />;
  if (col.type === 'date') return <p className="text-sm text-stone-600">From {col.earliest?.slice(0, 10)} to {col.latest?.slice(0, 10)}</p>;
  return <p className="text-sm text-stone-500">No values to chart.</p>;
}

function TrainPanel({ dataset, onTrained }) {
  const numeric = useMemo(() => dataset.columns.filter((c) => c.type === 'number'), [dataset]);
  const [target, setTarget] = useState(numeric[numeric.length - 1]?.name || '');
  const [features, setFeatures] = useState([]);
  const [advanced, setAdvanced] = useState({ learningRate: 0.05, epochs: 2000, testSize: 0.2 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Pre-select sensible features whenever the target changes
  useEffect(() => {
    setFeatures(numeric.filter((c) => c.name !== target).slice(0, 5).map((c) => c.name));
  }, [target, numeric]);

  if (numeric.length < 2) {
    return <p className="text-sm text-stone-500">Training needs at least two numeric columns (one target and one feature). This dataset has {numeric.length}.</p>;
  }

  const toggle = (name) => setFeatures((f) => (f.includes(name) ? f.filter((x) => x !== name) : [...f, name]));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/models', {
        datasetId: dataset.id, target, features,
        learningRate: Number(advanced.learningRate), epochs: Number(advanced.epochs), testSize: Number(advanced.testSize),
      });
      onTrained(data.model);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <ErrorBanner message={error} />
      <Field label="Target (what to predict)">
        <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)}>
          {numeric.map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-stone-700">Features (what to predict from)</legend>
        <div className="flex flex-wrap gap-2">
          {numeric.filter((c) => c.name !== target).map((c) => (
            <label key={c.name} className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${features.includes(c.name) ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-stone-300 text-stone-600 hover:bg-stone-50'}`}>
              <input type="checkbox" className="sr-only" checked={features.includes(c.name)} onChange={() => toggle(c.name)} />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <details className="rounded-lg border border-stone-200 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-stone-700">Training settings</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Learning rate"><input className={inputClass} type="number" step="any" min="0.0001" max="1" value={advanced.learningRate} onChange={(e) => setAdvanced({ ...advanced, learningRate: e.target.value })} /></Field>
          <Field label="Max epochs"><input className={inputClass} type="number" min="10" max="20000" value={advanced.epochs} onChange={(e) => setAdvanced({ ...advanced, epochs: e.target.value })} /></Field>
          <Field label="Test share"><input className={inputClass} type="number" step="0.05" min="0.05" max="0.5" value={advanced.testSize} onChange={(e) => setAdvanced({ ...advanced, testSize: e.target.value })} /></Field>
        </div>
      </details>
      <Button type="submit" disabled={busy || features.length === 0}>{busy ? 'Training…' : 'Train linear regression'}</Button>
    </form>
  );
}

export default function DatasetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState(null);
  const [models, setModels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get(`/datasets/${id}`), api.get('/models', { params: { dataset: id } })])
      .then(([d, m]) => {
        setDataset(d.data.dataset);
        setModels(m.data.models);
        setSelected(d.data.dataset.columns.find((c) => c.type === 'number')?.name || d.data.dataset.columns[0]?.name);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  if (error && !dataset) return <><ErrorBanner message={error} /><Link to="/datasets" className="mt-4 inline-block text-teal-700 hover:underline">← Back to datasets</Link></>;
  if (!dataset) return <Spinner />;

  const col = dataset.columns.find((c) => c.name === selected);
  const s = dataset.summary;

  async function remove() {
    if (!window.confirm(`Delete "${dataset.name}" and the models trained on it? Saved reports are kept.`)) return;
    try {
      await api.delete(`/datasets/${id}`);
      navigate('/datasets');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/datasets', label: 'Datasets' }}
        title={dataset.name}
        subtitle={`${dataset.originalName} · ${fmtBytes(dataset.sizeBytes)} · uploaded ${fmtDate(dataset.createdAt)}`}
        actions={<Button variant="danger" onClick={remove}>Delete</Button>}
      />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Rows" value={fmt(s.rowCount, 0)} />
        <Stat label="Columns" value={s.columnCount} sub={`${s.numericColumns} numeric · ${s.categoricalColumns} categorical · ${s.dateColumns} date`} />
        <Stat label="Missing cells" value={`${fmt(s.missingPct, 1)}%`} sub={`${fmt(s.totalMissing, 0)} cells`} tone={s.missingPct > 10 ? 'amber' : 'stone'} />
        <Stat label="Duplicate rows" value={fmt(s.duplicateRows, 0)} tone={s.duplicateRows ? 'amber' : 'stone'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="Columns" className="lg:col-span-3">
          <div className="-m-5 max-h-[26rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                <tr><th className="px-5 py-2.5">Column</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Missing</th><th className="px-3 py-2.5">Unique</th><th className="px-5 py-2.5">Summary</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dataset.columns.map((c) => (
                  <tr key={c.name} onClick={() => setSelected(c.name)} className={`cursor-pointer ${c.name === selected ? 'bg-teal-50/60' : 'hover:bg-stone-50'}`}>
                    <td className="px-5 py-2.5 font-medium"><button className="text-left" onClick={() => setSelected(c.name)}>{c.name}</button></td>
                    <td className="px-3 py-2.5"><Badge tone={typeTone[c.type]}>{c.type}</Badge></td>
                    <td className="px-3 py-2.5 tabular-nums">{fmt(c.missingPct, 1)}%</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmt(c.unique, 0)}</td>
                    <td className="px-5 py-2.5 text-stone-500">
                      {c.type === 'number' ? `mean ${fmt(c.mean)} · range ${fmt(c.min)} to ${fmt(c.max)}` : c.topValues?.[0] ? `top: ${c.topValues[0].value} (${c.topValues[0].count})` : c.type === 'date' ? `${c.earliest?.slice(0, 10)} → ${c.latest?.slice(0, 10)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={col ? `Distribution: ${col.name}` : 'Distribution'} className="lg:col-span-2">
          {col ? <ColumnDetail col={col} /> : null}
        </Card>
      </div>

      {dataset.correlations && (
        <Card title="Correlations between numeric columns" className="mt-6">
          <CorrelationHeatmap correlations={dataset.correlations} />
          <p className="mt-3 text-xs text-stone-500">Pearson correlation on rows where both values are present. Teal is positive, red is negative.</p>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Train a model">
          <TrainPanel dataset={dataset} onTrained={(m) => navigate(`/models/${m.id}`)} />
        </Card>
        <Card title={`Models from this dataset (${models.length})`}>
          {models.length === 0 ? <p className="text-sm text-stone-500">No models yet.</p> : (
            <ul className="divide-y divide-stone-100">
              {models.map((m) => {
                const label = r2Label(m.metrics?.test?.r2);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link to={`/models/${m.id}`} className="truncate font-medium hover:text-teal-700">{m.name}</Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-stone-500">R² {fmtR2(m.metrics?.test?.r2)} <Badge tone={label.tone}>{label.text}</Badge></span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Preview (first 10 rows)" className="mt-6">
        <div className="-m-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
              <tr>{dataset.headers.map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {dataset.preview.map((row, i) => (
                <tr key={i}>{row.cells.map((v, j) => <td key={j} className="whitespace-nowrap px-4 py-2 text-stone-700">{v === '' ? <span className="text-stone-300">—</span> : v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
