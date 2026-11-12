import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold">No encontré esa pantalla</h1>
      <p className="mt-2 text-sm text-slate-600">
        La dirección no existe o cambió. Volvé al inicio para seguir.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
