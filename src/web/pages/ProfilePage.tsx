import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import {
  DeleteResponse,
  type DocumentInfo,
  DocumentKind,
  DocumentsResponse as DocumentsResponseSchema,
  GenerateProfileResponse,
  MasterProfile,
  ProfileResponse as ProfileResponseSchema,
  UploadDocumentResponse,
} from '../../shared/schemas';
import { apiDelete, apiGet, apiSend, apiUpload } from '../lib/api';

const KIND_LABELS: Record<DocumentKind, string> = {
  cv: 'CV',
  portfolio: 'Portfolio',
  presentation: 'Presentación',
  certificate: 'Certificado',
  other: 'Otro',
};

export function ProfilePage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [profile, setProfile] = useState<MasterProfile | null>(null);
  const [profileText, setProfileText] = useState('');
  const [version, setVersion] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [draft, setDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kind, setKind] = useState<DocumentKind>('cv');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyProfile = useCallback(
    (
      nextProfile: MasterProfile | null,
      nextVersion: number | null,
      nextUpdatedAt: string | null,
    ) => {
      setProfile(nextProfile);
      setProfileText(nextProfile === null ? '' : JSON.stringify(nextProfile, null, 2));
      setVersion(nextVersion);
      setUpdatedAt(nextUpdatedAt);
      setDraft(false);
    },
    [],
  );

  const loadDocuments = useCallback(async () => {
    const response = await apiGet('/api/documents', DocumentsResponseSchema);
    setDocuments(response.documents);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [documentsResponse, profileResponse] = await Promise.all([
        apiGet('/api/documents', DocumentsResponseSchema),
        apiGet('/api/profile', ProfileResponseSchema),
      ]);

      setDocuments(documentsResponse.documents);
      applyProfile(profileResponse.profile, profileResponse.version, profileResponse.updatedAt);
    } catch (caught) {
      setLoadError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }, [applyProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async () => {
    if (file === null) {
      setActionError('Elegí un archivo antes de subirlo.');
      return;
    }

    setUploading(true);
    setActionError(null);
    setMessage(null);

    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);

      await apiUpload('/api/documents', form, UploadDocumentResponse);
      setFile(null);
      setFileInputKey((current) => current + 1);
      await loadDocuments();
      setMessage('Documento subido y texto extraído.');
    } catch (caught) {
      setActionError(messageFor(caught));
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (document: DocumentInfo) => {
    if (!window.confirm(`¿Eliminar "${document.name}"?`)) {
      return;
    }

    setActionError(null);
    setMessage(null);

    try {
      await apiDelete(`/api/documents/${document.id}`, DeleteResponse);
      await loadDocuments();
      setMessage('Documento eliminado.');
    } catch (caught) {
      setActionError(messageFor(caught));
    }
  };

  const generate = async () => {
    setGenerating(true);
    setActionError(null);
    setMessage(null);

    try {
      const result = await apiSend('/api/profile/generate', 'POST', {}, GenerateProfileResponse);
      setProfile(result.profile);
      setProfileText(JSON.stringify(result.profile, null, 2));
      setVersion(null);
      setUpdatedAt(null);
      setDraft(true);
      setMessage('Perfil generado. Revisalo y guardalo cuando esté listo.');
    } catch (caught) {
      setActionError(messageFor(caught));
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    let value: unknown;

    try {
      value = JSON.parse(profileText);
    } catch {
      setActionError('El JSON no es válido. Revisá comas, comillas y llaves.');
      return;
    }

    const parsed = MasterProfile.safeParse(value);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setActionError(
        `El perfil no es válido${firstIssue === undefined ? '' : `: ${firstIssue.path.join('.')} — ${firstIssue.message}`}.`,
      );
      return;
    }

    setSaving(true);
    setActionError(null);
    setMessage(null);

    try {
      const result = await apiSend(
        '/api/profile',
        'PUT',
        { profile: parsed.data },
        ProfileResponseSchema,
      );
      applyProfile(result.profile, result.version, result.updatedAt);
      setMessage('Perfil guardado.');
    } catch (caught) {
      setActionError(messageFor(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Perfil maestro
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Tu perfil</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Subí tus documentos una vez. cv-tool extrae el texto, arma un perfil y te deja revisarlo y
          editarlo antes de usarlo en las postulaciones.
        </p>
      </header>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando documentos y perfil…
        </section>
      ) : null}

      {loadError !== null ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p className="font-medium">No pude cargar el perfil.</p>
          <p className="mt-1">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800"
          >
            Volver a probar
          </button>
        </section>
      ) : null}

      {!loading && loadError === null ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Documentos</h2>
                <p className="mt-1 text-sm text-slate-600">
                  PDF, DOCX, TXT o MD. Hasta 10 MB por archivo.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block flex-1">
                <span className="text-sm font-medium text-slate-700">Archivo</span>
                <input
                  key={fileInputKey}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setFile(event.target.files?.[0] ?? null);
                  }}
                  className="mt-2 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                />
              </label>

              <label className="block sm:w-44">
                <span className="text-sm font-medium text-slate-700">Tipo</span>
                <select
                  value={kind}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setKind(event.target.value as DocumentKind);
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  {DocumentKind.options.map((option) => (
                    <option key={option} value={option}>
                      {KIND_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => void upload()}
                disabled={uploading || file === null}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {uploading ? 'Subiendo…' : 'Subir documento'}
              </button>
            </div>

            {documents.length === 0 ? (
              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Todavía no subiste documentos. Empezá por tu CV más reciente.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-slate-100">
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{document.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {KIND_LABELS[document.kind]} · {formatDate(document.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeDocument(document)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Generar perfil</h2>
                <p className="mt-1 text-sm text-slate-600">
                  La IA lee los documentos y propone un perfil. Después lo revisás y lo guardás.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void generate()}
                disabled={generating || documents.length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {generating ? 'Generando…' : 'Generar perfil con IA'}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Usa el modelo elegido en Ajustes. Puede tardar uno o dos minutos. No guarda nada hasta
              que confirmes.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Editor del perfil</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Revisá y corregí el JSON. Al guardar se valida el esquema completo.
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                {version === null ? null : <p>Versión {version}</p>}
                {updatedAt === null ? null : <p>Actualizado {formatDate(updatedAt)}</p>}
                {draft ? <p className="font-medium text-amber-700">Cambios sin guardar</p> : null}
              </div>
            </div>

            {profile !== null ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">
                  {profile.basics.fullName}
                  {profile.basics.headline === undefined ? '' : ` · ${profile.basics.headline}`}
                </p>
                {profile.summary === undefined ? null : (
                  <p className="mt-1 text-xs leading-5 text-slate-600">{profile.summary}</p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  {profile.experience.length} experiencias · {profile.skills.length} skills ·{' '}
                  {profile.education.length} estudios
                </p>
              </div>
            ) : null}

            <textarea
              value={profileText}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                setProfileText(event.target.value);
                setDraft(true);
              }}
              placeholder="Todavía no hay perfil. Subí un CV y generá uno, o pegá un JSON válido."
              spellCheck={false}
              className="mt-4 min-h-[26rem] w-full rounded-xl border border-slate-300 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || profileText.trim().length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? 'Guardando…' : 'Guardar perfil'}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    setProfileText(JSON.stringify(JSON.parse(profileText), null, 2));
                    setActionError(null);
                  } catch {
                    setActionError('El JSON no es válido; no pude formatearlo.');
                  }
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Formatear JSON
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Por ahora el editor es JSON para no perder ningún campo. El formulario amigable y la
              vista previa completa llegan en el Paso 5.
            </p>
          </section>

          <div aria-live="polite">
            {message === null ? null : (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                {message}
              </p>
            )}

            {actionError === null ? null : (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                {actionError}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

function formatDate(value: string): string {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('es-AR');
}
