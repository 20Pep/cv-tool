import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  type HealthResponse as Health,
  HealthResponse,
  type MasterProfile,
  ProfileResponse as ProfileResponseSchema,
  ProvidersResponse as ProvidersResponseSchema,
} from '../../shared/schemas';
import { apiGet } from '../lib/api';
import { NewApplicationPage } from './NewApplicationPage';

type Stage = 'loading' | 'provider' | 'profile' | 'ready' | 'error';

export function DashboardPage() {
  const [providerAvailable, setProviderAvailable] = useState(false);
  const [profile, setProfile] = useState<MasterProfile | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [providers, profileResponse, healthResponse] = await Promise.all([
        apiGet('/api/providers', ProvidersResponseSchema),
        apiGet('/api/profile', ProfileResponseSchema),
        apiGet('/api/health', HealthResponse),
      ]);

      setProviderAvailable(providers.provider.available);
      setProfile(profileResponse.profile);
      setHealth(healthResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude cargar el estado de la app.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stage: Stage = loading
    ? 'loading'
    : error !== null
      ? 'error'
      : !providerAvailable
        ? 'provider'
        : profile === null
          ? 'profile'
          : 'ready';

  const primary = {
    provider: {
      label: 'Conectar mi IA',
      to: '/ajustes',
      description:
        'Primero conectá OpenCode y elegí un modelo. Después vas a poder cargar tu perfil.',
    },
    profile: {
      label: 'Cargar mi perfil',
      to: '/perfil',
      description:
        'Subí tu CV y generá tu perfil maestro. Es la base para adaptar cualquier oferta.',
    },
    ready: {
      label: 'Adaptar para la oferta',
      to: '/postulaciones/nueva',
      description: 'Pegá la oferta completa en una sola caja y generá tu CV y tu carta.',
    },
  }[stage === 'ready' ? 'ready' : stage === 'profile' ? 'profile' : 'provider'];

  if (stage === 'ready' && profile !== null) {
    return <NewApplicationPage initialProfile={profile} />;
  }

  const steps = [
    {
      title: 'Conectá tu IA',
      description: 'OpenCode con un modelo disponible.',
      done: providerAvailable,
      to: '/ajustes',
    },
    {
      title: 'Cargá tu perfil',
      description: 'Tu CV, experiencia y skills en un solo lugar.',
      done: profile !== null,
      to: '/perfil',
    },
    {
      title: 'Adaptá para la oferta',
      description: 'Pegá la oferta y generá CV, carta, PDFs y seguimiento.',
      done: false,
      to: '/postulaciones/nueva',
    },
  ];

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Local-first · sin cuentas · sin telemetría
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Adaptá tu CV a la oferta
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          cv-tool te guía en tres pasos: conectar tu IA, cargar tu perfil una vez y empezar a
          adaptar cada postulación. Todo queda en tu computadora.
        </p>
      </header>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando tu estado…
        </section>
      ) : null}

      {error !== null ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p className="font-medium">No pude cargar el estado de la app.</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800"
          >
            Volver a probar
          </button>
        </section>
      ) : null}

      {!loading && error === null ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold">Tu camino</h2>

            <ol className="mt-5 grid gap-4 sm:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className={`rounded-xl border p-4 ${
                    step.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        step.done ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {step.done ? '✓' : index + 1}
                    </span>
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{step.description}</p>
                  <Link
                    to={step.to}
                    className="mt-3 inline-block text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                  >
                    {step.done ? 'Revisar' : 'Ir'}
                  </Link>
                </li>
              ))}
            </ol>

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Siguiente paso
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {primary.label}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                {primary.description}
              </p>
              <Link
                to={primary.to}
                className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                {primary.label}
              </Link>
            </div>
          </section>

          {health === null ? null : (
            <section className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 shadow-sm">
              <span>Versión {health.version}</span>
              <span>Base de datos: lista</span>
              <span>Servidor local: conectado</span>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
