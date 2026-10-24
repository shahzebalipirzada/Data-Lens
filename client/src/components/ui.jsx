import { Link } from 'react-router-dom';

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-xl border border-stone-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-3">
          <h2 className="text-sm font-semibold tracking-wide text-stone-700">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const buttonStyles = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-300',
  secondary: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  danger: 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 disabled:text-rose-300',
};

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
    />
  );
}

export const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20';

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub, tone = 'stone' }) {
  const tones = { stone: 'text-stone-900', teal: 'text-teal-700', emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700', slate: 'text-slate-600' };
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'stone' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700',
    teal: 'bg-teal-50 text-teal-800',
    amber: 'bg-amber-50 text-amber-800',
    violet: 'bg-violet-50 text-violet-800',
    sky: 'bg-sky-50 text-sky-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    rose: 'bg-rose-50 text-rose-800',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export const typeTone = { number: 'teal', string: 'violet', boolean: 'amber', date: 'sky', empty: 'stone' };

export function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-stone-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-teal-700" />
      {label}
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {message}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center">
      <p className="font-medium text-stone-800">{title}</p>
      {children && <div className="mt-2 text-sm text-stone-500">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back && (
          <Link to={back.to} className="no-print mb-1 inline-block text-sm text-teal-700 hover:underline">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex gap-2">{actions}</div>}
    </div>
  );
}
