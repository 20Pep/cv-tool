import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { daysSince } from '../../shared/dates';
import {
  type ApplicationDetailResponse,
  ApplicationDetailResponse as ApplicationDetailResponseSchema,
  type ApplicationInfo,
  ApplicationResponse as ApplicationResponseSchema,
  ApplicationStatus,
  type ApplicationStatus as ApplicationStatusType,
  ApplicationsResponse as ApplicationsResponseSchema,
} from '../../shared/schemas';
import { apiDelete, apiGet, apiSend } from '../lib/api';

const STATUS_LABELS: Record<ApplicationStatusType, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  in_process: 'En proceso',
  interview: 'Entrevista',
  offer: 'Oferta',
  hired: 'Contratada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
};

const STATUS_STYLES: Record<ApplicationStatusType, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-sky-100 text-sky-700',
  in_process: 'bg-indigo-100 text-indigo-700',
  interview: 'bg-violet-100 text-violet-700',
  offer: 'bg-emerald-100 text-emerald-700',
  hired: 'bg-emerald-200 text-emerald-900',
  rejected: 'bg-rose-100 text-rose-700',
  withdrawn: 'bg-amber-100 text-amber-800',
};

export function TrackerPage() {
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatusType>('all');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ApplicationDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiGet('/api/applications', ApplicationsResponseSchema);
      setApplications(response.applications);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = useCallback(
    async (application: ApplicationInfo, status: ApplicationStatusType) => {
      setSavingId(application.id);
      setError(null);
      setMessage(null);

      try {
        const response = await apiSend(
          `/api/applications/${application.id}`,
          'PATCH',
          { status },
          ApplicationResponseSchema,
        );

        setApplications((current) =>
          current.map((item) => (item.id === application.id ? response.application : item)),
        );
        setDetail((current) =>
          current === null || current.application.id !== application.id
            ? current
            : { ...current, application: { ...current.application, ...response.application } },
        );
        setMessage(`Estado actualizado a “${STATUS_LABELS[status]}”.`);
      } catch (caught) {
        setError(messageFor(caught));
      } finally {
        setSavingId(null);
      }
    },
    [],
  );

  const removeApplication = useCallback(async (application: ApplicationInfo) => {
    setDeletingId(application.id);
    setError(null);
    setMessage(null);

    try {
      await apiDelete(`/api/applications/${application.id}`, z.object({ ok: z.boolean() }));
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setDetail((current) => (current?.application.id === application.id ? null : current));
      setConfirmingDeleteId(null);
      setMessage(`Postulación de ${application.company} eliminada del tracker.`);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setDeletingId(null);
    }
  }, []);

  const openDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setError(null);

    try {
      const response = await apiGet(`/api/applications/${id}`, ApplicationDetailResponseSchema);
      setDetail(response);
      setNotesDraft(response.application.notes ?? '');
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const saveNotes = async () => {
    if (detail === null) {
      return;
    }

    setSavingNotes(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiSend(
        `/api/applications/${detail.application.id}`,
        'PATCH',
        { notes: notesDraft },
        ApplicationResponseSchema,
      );

      setDetail({
        ...detail,
        application: { ...detail.application, ...response.application },
      });
      setApplications((current) =>
        current.map((item) => (item.id === response.application.id ? response.application : item)),
      );
      setMessage('Notas guardadas.');
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSavingNotes(false);
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return applications.filter((application) => {
      const statusMatches = statusFilter === 'all' || application.status === statusFilter;
      const textMatches =
        query.length === 0 ||
        `${application.company} ${application.position}`.toLowerCase().includes(query);

      return statusMatches && textMatches;
    });
  }, [applications, search, statusFilter]);

  const columnHelper = useMemo(() => createColumnHelper<ApplicationInfo>(), []);
  const columns = useMemo(
    () => [
      columnHelper.accessor('company', {
        header: 'Empresa / Puesto',
        cell: (info) => (
          <div>
            <p className="font-medium text-slate-900">{info.getValue()}</p>
            <p className="text-xs text-slate-500">{info.row.original.position}</p>
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: (info) => {
          const application = info.row.original;

          return (
            <select
              value={info.getValue()}
              disabled={savingId === application.id}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                void updateStatus(application, event.target.value as ApplicationStatusType)
              }
              className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${STATUS_STYLES[info.getValue()]}`}
            >
              {ApplicationStatus.options.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          );
        },
      }),
      columnHelper.display({
        id: 'sentAt',
        header: 'Enviada',
        cell: (info) => {
          const application = info.row.original;
          return application.sentAt === null ? '—' : formatDate(application.sentAt);
        },
      }),
      columnHelper.display({
        id: 'days',
        header: 'Días',
        cell: (info) => {
          const application = info.row.original;
          return daysSince(application.sentAt ?? application.createdAt);
        },
      }),
      columnHelper.display({
        id: 'match',
        header: 'Match',
        cell: (info) => {
          const value = info.row.original.matchPct;
          return value === null ? '—' : `${Math.round(value)}%`;
        },
      }),
      columnHelper.display({
        id: 'files',
        header: 'Archivos',
        cell: (info) => {
          const application = info.row.original;
          return (
            <div className="flex gap-2">
              {application.cvPath === null ? null : (
                <a
                  href={`/api/applications/${application.id}/files/cv`}
                  download
                  className="text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                >
                  CV
                </a>
              )}
              {application.letterPath === null ? null : (
                <a
                  href={`/api/applications/${application.id}/files/letter`}
                  download
                  className="text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                >
                  Carta
                </a>
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const application = info.row.original;
          const confirming = confirmingDeleteId === application.id;

          return (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void openDetail(application.id)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Detalle
              </button>
              {confirming ? (
                <>
                  <button
                    type="button"
                    onClick={() => void removeApplication(application)}
                    disabled={deletingId === application.id}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                  >
                    {deletingId === application.id ? 'Eliminando…' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteId(application.id)}
                  className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                >
                  Eliminar
                </button>
              )}
            </div>
          );
        },
      }),
    ],
    [
      columnHelper,
      confirmingDeleteId,
      deletingId,
      openDetail,
      removeApplication,
      savingId,
      updateStatus,
    ],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Seguimiento
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Tracker</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Las postulaciones quedan como borrador al generarlas. Marcá “Enviada” cuando efectivamente
          envíes la tuya y seguí el proceso desde acá.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Estado
              </span>
              <select
                value={statusFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setStatusFilter(event.target.value as 'all' | ApplicationStatusType)
                }
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="all">Todos</option>
                {ApplicationStatus.options.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Buscar
              </span>
              <input
                value={search}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                placeholder="Empresa o puesto"
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/api/export/xlsx"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Exportar Excel
            </a>
            <Link
              to="/postulaciones/nueva"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Nueva postulación
            </Link>
          </div>
        </div>

        {loading ? <p className="mt-6 text-sm text-slate-600">Cargando postulaciones…</p> : null}

        {!loading && applications.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 p-6 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Todavía no hay postulaciones.</p>
            <p className="mt-1">
              Generá una desde <strong>Nueva</strong> y guardala como borrador.
            </p>
          </div>
        ) : null}

        {!loading && applications.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-slate-200">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No hay postulaciones que coincidan con el filtro.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {detailLoading ? (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando detalle…
        </p>
      ) : null}

      {detail !== null ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {detail.application.company} · {detail.application.position}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {STATUS_LABELS[detail.application.status]} ·{' '}
                {daysSince(detail.application.sentAt ?? detail.application.createdAt)} días
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Oferta original
              </h3>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-700">
                {detail.application.jobText}
              </pre>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Historial
              </h3>
              <ul className="mt-2 space-y-2">
                {detail.history.map((entry) => (
                  <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <p className="font-medium text-slate-900">
                      {STATUS_LABELS[entry.status]} · {formatDate(entry.changedAt)}
                    </p>
                    {entry.note === null ? null : (
                      <p className="mt-1 text-slate-600">{entry.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <label className="mt-6 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notas
            </span>
            <textarea
              value={notesDraft}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setNotesDraft(event.target.value)
              }
              className="mt-2 min-h-[6rem] w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveNotes()}
            disabled={savingNotes}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:bg-slate-300"
          >
            {savingNotes ? 'Guardando…' : 'Guardar notas'}
          </button>
        </section>
      ) : null}

      <div aria-live="polite">
        {message === null ? null : (
          <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {message}
          </p>
        )}
        {error === null ? null : (
          <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

function formatDate(value: string): string {
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('es-AR');
}
