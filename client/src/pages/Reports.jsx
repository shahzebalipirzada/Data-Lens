import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { Badge, Button, Card, Empty, ErrorBanner, PageHeader, Spinner, Stat } from '../components/ui.jsx';
import { Coefficients } from './ModelDetail.jsx';
import { fmt, fmtDate, fmtR2, r2Label } from '../utils.js';

export function Reports() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reports').then((r) => setReports(r.data.reports)).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <>
      <PageHeader title="Reports" subtitle="Snapshots of models you chose to keep. They stay readable even if the dataset is deleted." />
      <ErrorBanner message={error} />
      {reports === null ? <Spinner /> : reports.length === 0 ? (
        <Empty title="No reports yet">Train a model, then use “Save as report” on its page.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {reports.map((r) => {
            const m = r.snapshot?.model?.metrics?.test;
            const label = r2Label(m?.r2);
            return (
              <Link key={r.id} to={`/reports/${r.id}`} className="group rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-stone-900 group-hover:text-teal-700">{r.title}</h2>
                  <Badge tone={label.tone}>{label.text}</Badge>
                </div>
                <p className="mt-1 text-sm text-stone-500">{r.snapshot?.dataset?.name} → {r.snapshot?.model?.target}</p>
                <p className="mt-3 text-xs text-stone-500">Test R² {fmtR2(m?.r2)} · saved {fmtDate(r.createdAt)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/reports/${id}`).then((r) => setReport(r.data.report)).catch((e) => setError(errorMessage(e)));
  }, [id]);

  if (error && !report) return <><ErrorBanner message={error} /><Link to="/reports" className="mt-4 inline-block text-teal-700 hover:underline">← Back to reports</Link></>;
  if (!report) return <Spinner />;

  const { dataset, model } = report.snapshot;
  const test = model.metrics.test;
  const train = model.metrics.train;
  const label = r2Label(test.r2);

  async function remove() {
    if (!window.confirm('Delete this report?')) return;
    try {
      await api.delete(`/reports/${id}`);
      navigate('/reports');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/reports', label: 'Reports' }}
        title={report.title}
        subtitle={`Saved ${fmtDate(report.createdAt)} · dataset “${dataset.name}” (${fmt(dataset.rowCount, 0)} rows, ${dataset.columnCount} columns)`}
        actions={<><Button variant="secondary" onClick={() => window.print()}>Print</Button><Button variant="danger" onClick={remove}>Delete</Button></>}
      />
      <ErrorBanner message={error} />

      {report.notes && (
        <Card title="Notes" className="mb-6"><p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{report.notes}</p></Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Test R²" value={fmtR2(test.r2)} sub={<Badge tone={label.tone}>{label.text}</Badge>} tone={label.tone} />
        <Stat label="Test RMSE" value={fmt(test.rmse)} />
        <Stat label="Test MAE" value={fmt(test.mae)} />
        <Stat label="Train R²" value={fmtR2(train.r2)} />
      </div>

      <Card title={`Model: ${model.target} ~ ${model.features.join(' + ')}`} className="mt-6">
        <Coefficients coefficients={model.coefficients} bias={model.bias} />
        <p className="mt-4 text-xs text-stone-500">
          {model.rowsUsed} rows used{model.rowsDropped ? ` (${model.rowsDropped} dropped for missing values)` : ''} · learning rate {model.hyperparams?.learningRate} · {model.epochsRun} epochs ({model.converged ? 'converged' : 'epoch limit reached'}) · {Math.round((model.hyperparams?.testSize ?? 0.2) * 100)}% held out for testing
        </p>
      </Card>
    </>
  );
}
