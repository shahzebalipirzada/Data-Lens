import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Card, ErrorBanner, PageHeader, Spinner, Stat } from '../components/ui.jsx';
import { fmtDate } from '../utils.js';

export default function Admin() {
  const { user: me } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/users')])
      .then(([s, u]) => { setStats(s.data); setUsers(u.data.users); })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function toggleRole(u) {
    setError('');
    try {
      await api.patch(`/admin/users/${u.id}/role`, { role: u.role === 'admin' ? 'user' : 'admin' });
      load();
    } catch (err) { setError(errorMessage(err)); }
  }

  async function remove(u) {
    if (!window.confirm(`Delete ${u.email} and all of their datasets, models and reports?`)) return;
    setError('');
    try {
      await api.delete(`/admin/users/${u.id}`);
      load();
    } catch (err) { setError(errorMessage(err)); }
  }

  if (!stats || !users) return <><ErrorBanner message={error} />{!error && <Spinner />}</>;

  return (
    <>
      <PageHeader title="Admin" subtitle="Users and usage across the platform." />
      <ErrorBanner message={error} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Users" value={stats.users} />
        <Stat label="Datasets" value={stats.datasets} />
        <Stat label="Models" value={stats.models} />
        <Stat label="Reports" value={stats.reports} />
      </div>
      <Card title="Users" className="mt-6 overflow-hidden">
        <div className="-m-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
              <tr><th className="px-5 py-2.5">Name</th><th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Role</th><th className="px-3 py-2.5">Datasets</th><th className="px-3 py-2.5">Joined</th><th className="px-5 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-medium">{u.name}</td>
                  <td className="px-3 py-3 text-stone-600">{u.email}</td>
                  <td className="px-3 py-3"><Badge tone={u.role === 'admin' ? 'violet' : 'stone'}>{u.role}</Badge></td>
                  <td className="px-3 py-3 tabular-nums">{u.datasets}</td>
                  <td className="px-3 py-3 text-stone-500">{fmtDate(u.createdAt)}</td>
                  <td className="space-x-3 px-5 py-3 text-right">
                    {u.id === me.id ? <span className="text-xs text-stone-400">you</span> : (
                      <>
                        <button onClick={() => toggleRole(u)} className="text-teal-700 hover:underline">{u.role === 'admin' ? 'Make user' : 'Make admin'}</button>
                        <button onClick={() => remove(u)} className="text-rose-700 hover:underline">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
