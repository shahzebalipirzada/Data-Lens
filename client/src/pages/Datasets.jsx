import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { Button, Card, Empty, ErrorBanner, PageHeader, Spinner } from '../components/ui.jsx';
import { fmt, fmtBytes, fmtDate } from '../utils.js';

export default function Datasets() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [datasets, setDatasets] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(() => {
    api.get('/datasets').then((r) => setDatasets(r.data.datasets)).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function upload(file) {
    if (!file) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.csv')) return setError('Please choose a .csv file');
    const form = new FormData();
    form.append('file', file);
    setUploading(true);
    try {
      const { data } = await api.post('/datasets', form);
      navigate(`/datasets/${data.dataset.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(d) {
    if (!window.confirm(`Delete "${d.name}" and the models trained on it? Saved reports are kept.`)) return;
    try {
      await api.delete(`/datasets/${d.id}`);
      setDatasets((list) => list.filter((x) => x.id !== d.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Datasets" subtitle="CSV files up to 5 MB and 20,000 rows." />
      <ErrorBanner message={error} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files?.[0]); }}
        className={`mt-4 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-teal-600 bg-teal-50' : 'border-stone-300 bg-white'}`}
      >
        <p className="font-medium text-stone-800">{uploading ? 'Uploading and profiling…' : 'Drop a CSV file here'}</p>
        <p className="mt-1 text-sm text-stone-500">or</p>
        <input ref={fileRef} id="csv-input" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        <Button variant="secondary" className="mt-3" disabled={uploading} onClick={() => fileRef.current?.click()}>Choose file</Button>
      </div>

      <div className="mt-8">
        {datasets === null ? (
          <Spinner />
        ) : datasets.length === 0 ? (
          <Empty title="Nothing here yet">Your uploaded datasets will be listed here.</Empty>
        ) : (
          <Card title={`${datasets.length} dataset${datasets.length === 1 ? '' : 's'}`} className="overflow-hidden">
            <div className="-m-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr><th className="px-5 py-2.5">Name</th><th className="px-3 py-2.5">Rows</th><th className="px-3 py-2.5">Columns</th><th className="px-3 py-2.5">Missing</th><th className="px-3 py-2.5">Size</th><th className="px-3 py-2.5">Uploaded</th><th className="px-5 py-2.5" /></tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {datasets.map((d) => (
                    <tr key={d.id} className="hover:bg-stone-50/60">
                      <td className="px-5 py-3 font-medium"><Link to={`/datasets/${d.id}`} className="text-stone-900 hover:text-teal-700">{d.name}</Link></td>
                      <td className="px-3 py-3 tabular-nums">{fmt(d.rowCount, 0)}</td>
                      <td className="px-3 py-3 tabular-nums">{d.columnCount}</td>
                      <td className="px-3 py-3 tabular-nums">{fmt(d.summary?.missingPct, 1)}%</td>
                      <td className="px-3 py-3 text-stone-500">{fmtBytes(d.sizeBytes)}</td>
                      <td className="px-3 py-3 text-stone-500">{fmtDate(d.createdAt)}</td>
                      <td className="px-5 py-3 text-right"><button onClick={() => remove(d)} className="text-sm text-rose-700 hover:underline">Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
