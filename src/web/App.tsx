import { useCallback, useEffect, useState } from 'react';
import { type HealthResponse as Health, HealthResponse } from '../shared/schemas';

type ConnectionState = 'loading' | 'ok' | 'error';

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/health', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (response.status === 401) {
        throw new Error('No hay una sesión válida. Abrí la URL que mostró cv-tool al iniciar.');
      }

      if (!response.ok) {
        throw new Error(`El servidor local respondió con estado ${response.status}.`);
      }

      const parsed = HealthResponse.safeParse(await response.json());

      if (!parsed.success) {
        throw new Error('El servidor devolvió una respuesta con un formato inesperado.');
      }

      setHealth(parsed.data);
    } catch (caught) {
      setHealth(null);
      setError(
        caught instanceof Error ? caught.message : 'No pude conectarme con el servidor local.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const state: ConnectionState = loading ? 'loading' : error === null ? 'ok' : 'error';
  const badge = {
    loading: {
      label: 'Conectando…',
      dot: 'bg-amber-500',
      text: 'text-amber-700',
      background: 'bg-amber-50',
      border: 'border-amber-200',
    },
    ok: {
      label: 'Servidor local conectado',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700',
      background: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    error: {
      label: 'Sin conexión',
      dot: 'bg-rose-500',
      text: 'text-rose-700',
      background: 'bg-rose-50',
      border: 'border-rose-200',
    },
  }[state];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Local-first · sin cuentas · sin telemetría
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">cv-tool</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Adaptá tu CV y tu carta a cada oferta, y llevá el seguimiento de tus postulaciones. Todo
            queda en tu computadora.
          </p>
        </header>

        <section
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Estado del sistema</h2>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${badge.background} ${badge.border} ${badge.text}`}
            >
              <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-600">Verificando el servidor local…</p>
          ) : null}

          {error !== null ? (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p className="font-medium">No pude iniciar la conexión.</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800"
              >
                Volver a probar
              </button>
            </div>
          ) : null}

          {health !== null ? (
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Versión
                </dt>
                <dd className="mt-1 font-mono text-sm text-slate-900">{health.version}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Base de datos
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {health.database === 'ok' ? 'Lista' : 'Con problemas'}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Encendido
                </dt>
                <dd className="mt-1 text-sm text-slate-900">{health.uptimeSeconds} s</dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-8 border-t border-slate-100 pt-6 text-sm leading-6 text-slate-600">
            <p>
              Esta es la base del <strong>Paso 1</strong>: servidor local, sesión y SQLite
              funcionando. Las pantallas de perfil, postulaciones y tracker llegan en los próximos
              pasos.
            </p>
          </div>
        </section>

        <footer className="mt-8 text-xs leading-6 text-slate-500">
          <p>
            El servidor escucha solo en <code className="font-mono">127.0.0.1</code>. Los datos no
            salen de tu computadora, salvo el contenido que envíes al proveedor de IA que elijas.
          </p>
        </footer>
      </div>
    </main>
  );
}
