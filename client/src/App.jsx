import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { AdminRoute, GuestRoute, ProtectedRoute } from './components/guards.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Datasets from './pages/Datasets.jsx';
import DatasetDetail from './pages/DatasetDetail.jsx';
import ModelDetail from './pages/ModelDetail.jsx';
import { ReportDetail, Reports } from './pages/Reports.jsx';
import Admin from './pages/Admin.jsx';

function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-5xl font-semibold text-stone-300">404</p>
      <p className="mt-3 text-stone-600">That page does not exist.</p>
      <Link to="/" className="mt-4 inline-block text-teal-700 hover:underline">Go to the dashboard</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="datasets" element={<Datasets />} />
          <Route path="datasets/:id" element={<DatasetDetail />} />
          <Route path="models/:id" element={<ModelDetail />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/:id" element={<ReportDetail />} />
          <Route element={<AdminRoute />}>
            <Route path="admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
