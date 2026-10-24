import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const link = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-teal-50 text-teal-800' : 'text-stone-600 hover:text-stone-900'}`;

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0f766e" />
        <circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" strokeWidth="2.5" />
        <path d="M19 19l6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M10.5 16.5l2.5-3 2 2 2.5-3.5" fill="none" stroke="#99f6e4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      DataLens
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <NavLink to="/"><Logo /></NavLink>
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
              <NavLink to="/" end className={link}>Dashboard</NavLink>
              <NavLink to="/datasets" className={link}>Datasets</NavLink>
              <NavLink to="/reports" className={link}>Reports</NavLink>
              {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-stone-500 sm:inline">{user?.name}</span>
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="rounded-md border border-stone-300 px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-50"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-stone-100 px-3 py-1.5 sm:hidden" aria-label="Main mobile">
          <NavLink to="/" end className={link}>Dashboard</NavLink>
          <NavLink to="/datasets" className={link}>Datasets</NavLink>
          <NavLink to="/reports" className={link}>Reports</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
