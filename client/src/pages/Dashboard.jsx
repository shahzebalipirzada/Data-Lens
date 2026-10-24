import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Card, Empty, ErrorBanner, PageHeader, Spinner, Stat } from '../components/ui.jsx';
import { fmt, fmtDate, fmtR2, r2Label } from '../utils.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, datasets: [], models: [], reports: [], error: '' });

  useEffect(() => {
    Promise.all([api.get('/datasets'), api.get('/models'), api.get('/reports')])
      .then(([d, m, r]) => setState({ loading: false, datasets: d.data.datasets, models: m.data.models, reports: r.data.reports, error: '' }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: errorMessage(err) })));
  }, []);

  if (state.loading) return <Spinner />;
  const { datasets, models, reports } = state;

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Upload data, understand it, and model it." />
      <ErrorBanner message={state.error} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Datasets" value={datasets.length} />
        <Stat label="Models" value={models.length} />
        <Stat label="Reports" value={reports.length} />
        <Stat label="Rows analysed" value={fmt(datasets.reduce((s, d) => s + d.rowCount, 0), 0)} />
      </div>

      {datasets.length === 0 ? (
        <div className="mt-8">
          <Empty title="No datasets yet">
            <Link to="/datasets" className="font-medium text-teal-700 hover:underline">Upload your first CSV</Link> to see column profiles, charts and correlations.
          </Empty>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card title="Recent datasets" action={<Link to="/datasets" className="text-sm text-teal-700 hover:underline">View all</Link>}>
            <ul className="divide-y divide-stone-100">
              {datasets.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2.5">
                  <Link to={`/datasets/${d.id}`} className="font-medium text-stone-900 hover:text-teal-700">{d.name}</Link>
                  <span className="text-xs text-stone-500">{fmt(d.rowCount, 0)} rows · {d.columnCount} cols</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Recent models">
            {models.length === 0 ? (
              <p className="text-sm text-stone-500">Open a dataset and train a model to see it here.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {models.slice(0, 5).map((m) => {
                  const label = r2Label(m.metrics?.test?.r2);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                      <Link to={`/models/${m.id}`} className="truncate font-medium text-stone-900 hover:text-teal-700">{m.name}</Link>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-stone-500">
                        R² {fmtR2(m.metrics?.test?.r2)} <Badge tone={label.tone}>{label.text}</Badge>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          {reports.length > 0 && (
            <Card title="Latest report" className="lg:col-span-2">
              <Link to={`/reports/${reports[0].id}`} className="font-medium text-teal-700 hover:underline">{reports[0].title}</Link>
              <span className="ml-2 text-xs text-stone-500">{fmtDate(reports[0].createdAt)}</span>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
