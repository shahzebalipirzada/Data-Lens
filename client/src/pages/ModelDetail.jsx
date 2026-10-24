import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { Badge, Button, Card, ErrorBanner, Field, PageHeader, Spinner, Stat, inputClass } from '../components/ui.jsx';
import { ActualVsPredicted, LossCurve } from '../components/charts.jsx';
import { fmt, fmtDate, fmtR2, r2Label } from '../utils.js';

export function Coefficients({ coefficients, bias }) {
  const max = Math.max(...coefficients.map((c) => c.importance), 1e-9);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-stone-500">
          <tr><th className="py-2 pr-4">Feature</th><th className="py-2 pr-4">Weight (per unit)</th><th className="py-2">Relative influence</th></tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {coefficients.map((c) => (
            <tr key={c.feature}>
              <td className="py-2 pr-4 font-medium">{c.feature}</td>
              <td className="py-2 pr-4 tabular-nums">{fmt(c.weight, 4)}</td>
              <td className="py-2">
                <div className="h-2 w-40 rounded-full bg-stone-100" role="img" aria-label={`Influence ${Math.round((c.importance / max) * 100)}%`}>
                  <div className="h-2 rounded-full bg-teal-700" style={{ width: `${(c.importance / max) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
          <tr><td className="py-2 pr-4 text-stone-500">Intercept</td><td className="py-2 pr-4 tabular-nums">{fmt(bias, 4)}</td><td /></tr>
        </tbody>
      </table>
    </div>
  );
}

function PredictForm({ model }) {
  const [values, setValues] = useState(() => Object.fromEntries(model.features.map((f) => [f, ''])));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const inputs = Object.fromEntries(model.features.map((f) => [f, Number(values[f])]));
      const { data } = await api.post(`/models/${model.id}/predict`, { inputs });
      setResult(data.prediction);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBanner message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        {model.features.map((f) => (
          <Field key={f} label={f}>
            <input className={inputClass} type="number" step="any" required value={values[f]} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={busy}>{busy ? 'Predicting…' : `Predict ${model.target}`}</Button>
        {result !== null && (
          <div aria-live="polite" className="rounded-lg bg-teal-50 px-4 py-2 text-teal-900">
            Predicted <strong>{model.target}</strong>: <span className="text-lg font-semibold tabular-nums">{fmt(result, 2)}</span>
          </div>
        )}
      </div>
    </form>
  );
}

function SaveReport({ model }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: `${model.name}`.slice(0, 140), notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/reports', { modelId: model.id, ...form });
      navigate(`/reports/${data.report.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBanner message={error} />
      <Field label="Title"><input className={inputClass} required maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
      <Field label="Notes" hint="Optional: what you learned, caveats, next steps."><textarea className={inputClass} rows={3} maxLength={4000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      <Button type="submit" variant="secondary" disabled={busy}>{busy ? 'Saving…' : 'Save as report'}</Button>
    </form>
  );
}

export default function ModelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/models/${id}`).then((r) => setModel(r.data.model)).catch((e) => setError(errorMessage(e)));
  }, [id]);

  if (error && !model) return <><ErrorBanner message={error} /><Link to="/datasets" className="mt-4 inline-block text-teal-700 hover:underline">← Back to datasets</Link></>;
  if (!model) return <Spinner />;

  const test = model.metrics.test;
  const train = model.metrics.train;
  const label = r2Label(test.r2);
  const overfit = train.r2 !== null && test.r2 !== null && train.r2 - test.r2 > 0.15;

  async function remove() {
    if (!window.confirm('Delete this model? Reports saved from it are kept.')) return;
    try {
      await api.delete(`/models/${id}`);
      navigate(`/datasets/${model.dataset}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: `/datasets/${model.dataset}`, label: 'Dataset' }}
        title={model.name}
        subtitle={`Linear regression (gradient descent) · trained ${fmtDate(model.createdAt)} · ${model.rowsUsed} rows used${model.rowsDropped ? `, ${model.rowsDropped} dropped for missing values` : ''}`}
        actions={<Button variant="danger" onClick={remove}>Delete</Button>}
      />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Test R²" value={fmtR2(test.r2)} sub={<Badge tone={label.tone}>{label.text}</Badge>} tone={label.tone} />
        <Stat label="Test RMSE" value={fmt(test.rmse)} sub="same units as the target" />
        <Stat label="Test MAE" value={fmt(test.mae)} sub={`${test.n} held-out rows`} />
        <Stat label="Train R²" value={fmtR2(train.r2)} sub={model.converged ? `converged in ${model.epochsRun} epochs` : `stopped at ${model.epochsRun} epochs`} />
      </div>
      {overfit && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Train R² is noticeably higher than test R². The model may be fitting noise; try fewer features or more data.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Loss during training (standardised MSE)"><LossCurve history={model.lossHistory} /></Card>
        <Card title="Predicted vs actual (test rows)">
          {model.samples.length ? <ActualVsPredicted samples={model.samples} /> : <p className="text-sm text-stone-500">No samples.</p>}
          <p className="mt-2 text-xs text-stone-500">Points close to the dashed line are accurate predictions.</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={`How ${model.target} is predicted`}><Coefficients coefficients={model.coefficients} bias={model.bias} /></Card>
        <Card title="Try a prediction"><PredictForm model={model} /></Card>
      </div>

      <Card title="Save a report" className="mt-6"><SaveReport model={model} /></Card>
    </>
  );
}
