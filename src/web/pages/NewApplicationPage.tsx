import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { z } from 'zod';
import { buildCvTextForMatch, exportLetterText } from '../../shared/cvText';
import { extractKeywords, matchKeywords } from '../../shared/keywords';
import {
  type ApplicationInfo,
  ApplicationResponse as ApplicationResponseSchema,
  CoverLetter as CoverLetterSchema,
  type MasterProfile,
  type PreviewApplicationResponse,
  PreviewApplicationResponse as PreviewApplicationResponseSchema,
  ProfileResponse as ProfileResponseSchema,
  TailoredCV as TailoredCVSchema,
} from '../../shared/schemas';
import { validateCoverLetter, validateTailoredCV } from '../../shared/validate';
import { apiDownload, apiGet, apiSend } from '../lib/api';

export function NewApplicationPage({ initialProfile }: { initialProfile?: MasterProfile } = {}) {
  const [profile, setProfile] = useState<MasterProfile | null>(initialProfile ?? null);
  const [offerText, setOfferText] = useState('');
  const [preview, setPreview] = useState<PreviewApplicationResponse | null>(null);
  const [cvJson, setCvJson] = useState('');
  const [letterJson, setLetterJson] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(initialProfile === undefined);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<ApplicationInfo | null>(null);
  const [downloading, setDownloading] = useState<'cv' | 'letter' | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingSeconds, setGeneratingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    setError(null);

    try {
      const response = await apiGet('/api/profile', ProfileResponseSchema);
      setProfile(response.profile);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (initialProfile === undefined) {
      void loadProfile();
    }
  }, [initialProfile, loadProfile]);

  // Segundos transcurridos mientras se genera, para el indicador de progreso.
  useEffect(() => {
    if (!generating) {
      setGeneratingSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setGeneratingSeconds((current) => current + 1);
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [generating]);

  const generate = async () => {
    setGenerating(true);
    setSaved(null);
    setError(null);
    setMessage(null);

    try {
      const result = await apiSend(
        '/api/applications/preview',
        'POST',
        { offerText },
        PreviewApplicationResponseSchema,
      );

      setPreview(result);
      setCvJson(JSON.stringify(result.tailoredCv, null, 2));
      setLetterJson(JSON.stringify(result.coverLetter, null, 2));
      setMessage('Vista previa generada. Revisá el CV, la carta y las keywords.');
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setGenerating(false);
    }
  };

  const validateEdits = () => {
    if (preview === null) {
      return;
    }

    let cvValue: unknown;
    let letterValue: unknown;

    try {
      cvValue = JSON.parse(cvJson);
      letterValue = JSON.parse(letterJson);
    } catch {
      setError('El CV o la carta editados no son JSON válido.');
      return;
    }

    const cv = TailoredCVSchema.safeParse(cvValue);
    const letter = CoverLetterSchema.safeParse(letterValue);

    if (!cv.success) {
      setError(parseIssueMessage('El CV editado no cumple el esquema', cv.error));
      return;
    }

    if (!letter.success) {
      setError(parseIssueMessage('La carta editada no cumple el esquema', letter.error));
      return;
    }

    if (profile === null) {
      setError('No hay perfil cargado para validar los cambios.');
      return;
    }

    // Misma validación que el servidor: trazabilidad de bullets, skills del
    // perfil y cifras nuevas. Así nada llega a guardar para que lo rechacen.
    const issues = [
      ...validateTailoredCV(cv.data, profile),
      ...validateCoverLetter(letter.data, `${JSON.stringify(profile)}\n${offerText}`),
    ];

    if (issues.length > 0) {
      setError(issues.map((issue) => issue.message).join(' '));
      return;
    }

    // Recalcula keywords y match % con el mismo código que usa el servidor.
    const offerKeywords = extractKeywords(offerText, { limit: 20 });
    const match = matchKeywords(offerKeywords, buildCvTextForMatch(profile, cv.data));

    setPreview({
      tailoredCv: { ...cv.data, keywordsUsed: match.matched, keywordsMissing: match.missing },
      coverLetter: letter.data,
      keywords: match,
      suggestedCompany: preview.suggestedCompany,
      suggestedPosition: preview.suggestedPosition,
    });
    setError(null);
    setMessage(
      `Edición validada. Match recalculado: ${match.matchPct}% (${match.missing.length} keywords faltantes).`,
    );
  };

  /** PDF generado al momento, sin guardar la postulación en el tracker. */
  const downloadPdf = async (kind: 'cv' | 'letter') => {
    if (preview === null) {
      return;
    }

    setDownloading(kind);
    setError(null);
    setMessage(null);

    try {
      const filename = await apiDownload(
        '/api/applications/render',
        {
          jobText: offerText,
          tailoredCv: preview.tailoredCv,
          coverLetter: preview.coverLetter,
          kind,
        },
        kind === 'cv' ? 'CV.pdf' : 'Carta.pdf',
      );
      setMessage(`PDF descargado: ${filename}`);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setDownloading(null);
    }
  };

  const copyLetterToClipboard = async () => {
    if (preview === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(exportLetterText(preview.coverLetter));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3_000);
      setMessage('Carta copiada al portapapeles en texto plano.');
    } catch {
      setError(
        'No pude copiar al portapapeles. Tu navegador lo puede bloquear: probá de nuevo o descargá el PDF.',
      );
    }
  };

  const saveApplication = async () => {
    if (preview === null) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await apiSend(
        '/api/applications',
        'POST',
        {
          jobText: offerText,
          tailoredCv: preview.tailoredCv,
          coverLetter: preview.coverLetter,
        },
        ApplicationResponseSchema,
      );

      setSaved(result.application);
      setMessage('Postulación guardada como borrador. Los PDFs están listos.');
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSaving(false);
    }
  };

  const canGenerate =
    profile !== null && offerText.trim().length >= 50 && !generating && !loadingProfile;

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          {initialProfile === undefined ? 'Nueva postulación' : 'Adaptar para la oferta'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {initialProfile === undefined ? 'Adaptá tu CV y tu carta' : 'Pegá la oferta'}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Pegá la oferta completa en la caja de abajo. cv-tool usa tu perfil para generar el CV y la
          carta, calcula las keywords y te deja revisar todo antes de guardar.
        </p>
      </header>

      {loadingProfile ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando tu perfil…
        </p>
      ) : null}

      {!loadingProfile && profile === null ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">Primero necesitás un perfil maestro.</p>
          <p className="mt-1">
            Subí tu CV en <strong>Perfil</strong> y generá o completá el perfil antes de postularte.
          </p>
          <Link
            to="/perfil"
            className="mt-4 inline-block rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
          >
            Ir a Perfil
          </Link>
        </section>
      ) : null}

      {!loadingProfile && profile !== null ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Oferta y contexto</h2>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Pegá la oferta completa</span>
              <textarea
                value={offerText}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setOfferText(event.target.value)
                }
                placeholder="Pegá acá el texto completo de la oferta. Podés incluir empresa, puesto, requisitos, contexto o cualquier detalle que quieras que se tenga en cuenta…"
                className="mt-2 min-h-[20rem] w-full rounded-xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Una sola caja para todo el contexto. cv-tool detecta empresa y puesto del texto. La
              oferta se trata como datos, no como instrucciones.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void generate()}
                disabled={!canGenerate}
                title="Genera el CV y la carta con IA a partir de la oferta pegada arriba."
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {generating ? (
                  <span className="inline-flex items-center gap-2">
                    <IconSpinner className="h-4 w-4" />
                    Generando CV y carta…
                  </span>
                ) : (
                  'Generar vista previa'
                )}
              </button>
              <span className="text-xs text-slate-500">
                Usa el modelo elegido en Ajustes. Puede tardar uno o dos minutos.
              </span>
            </div>

            {generating ? (
              <div className="mt-4">
                <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="cv-progress-bar h-full w-1/3 rounded-full bg-emerald-600" />
                </div>
                <p
                  aria-live="polite"
                  className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600"
                >
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                  </span>
                  {generatingPhase(generatingSeconds)}
                  <span className="text-xs text-slate-400">
                    ({generatingSeconds} {generatingSeconds === 1 ? 'segundo' : 'segundos'})
                  </span>
                </p>
              </div>
            ) : null}
          </section>

          {preview !== null ? (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Keywords y match</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Calculado por código a partir de la oferta y el CV final.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    {preview.keywords.matchPct}% de match
                  </span>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Cubiertas ({preview.keywords.matched.length})
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {preview.keywords.matched.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Faltantes ({preview.keywords.missing.length})
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {preview.keywords.missing.length === 0 ? (
                        <span className="text-xs text-slate-500">Ninguna: el CV cubre todas.</span>
                      ) : (
                        preview.keywords.missing.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800"
                          >
                            {keyword}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Vista previa del CV</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {preview.suggestedPosition || 'Puesto no indicado'} ·{' '}
                  {preview.suggestedCompany || 'Empresa no indicada'}
                </p>

                <div className="mt-5 rounded-xl bg-slate-50 p-5">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {profile.basics.fullName}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {preview.tailoredCv.headline ?? profile.basics.headline ?? ''}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-slate-700">
                    {preview.tailoredCv.summary}
                  </p>

                  <div className="mt-5 space-y-4">
                    {preview.tailoredCv.experience.map((experience) => {
                      const source = profile.experience.find(
                        (candidate) => candidate.id === experience.experienceId,
                      );

                      return (
                        <div key={experience.experienceId}>
                          <p className="text-sm font-semibold text-slate-900">
                            {experience.role ?? source?.role ?? 'Experiencia'} —{' '}
                            {source?.company ?? ''}
                          </p>
                          <p className="text-xs text-slate-500">
                            {source?.start ?? ''} – {source?.end ?? 'Actual'}
                          </p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                            {experience.bullets.map((bullet) => (
                              <li key={bullet.sourceBulletId}>{bullet.text}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Habilidades
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {preview.tailoredCv.skills.join(' · ')}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <h2 className="text-lg font-semibold">¿Te sirve este CV?</h2>
                <p className="mt-1 text-sm text-emerald-900">
                  Descargalo, copialo o guardalo en el tracker. Los PDFs se generan al momento y
                  descargás sin guardar nada.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void downloadPdf('cv')}
                    disabled={downloading !== null}
                    title="Descarga el PDF del CV ahora mismo, sin guardar la postulación en el tracker."
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {downloading === 'cv' ? (
                      <IconSpinner className="h-4 w-4" />
                    ) : (
                      <IconDownload className="h-4 w-4" />
                    )}
                    {downloading === 'cv' ? 'Generando PDF…' : 'Descargar CV'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadPdf('letter')}
                    disabled={downloading !== null}
                    title="Descarga el PDF de la carta de presentación, sin guardar la postulación."
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {downloading === 'letter' ? (
                      <IconSpinner className="h-4 w-4" />
                    ) : (
                      <IconDownload className="h-4 w-4" />
                    )}
                    {downloading === 'letter' ? 'Generando PDF…' : 'Descargar la carta'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyLetterToClipboard()}
                    title="Copia la carta en texto plano para pegarla en portales o formularios."
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <IconClipboard className="h-4 w-4" />
                    {copied ? 'Copiado ✓' : 'Copiar la carta'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveApplication()}
                    disabled={saving || saved !== null}
                    title="Guarda la postulación como borrador, genera los PDFs y la agrega al tracker."
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {saving ? (
                      <IconSpinner className="h-4 w-4" />
                    ) : (
                      <IconSave className="h-4 w-4" />
                    )}
                    {saving
                      ? 'Guardando…'
                      : saved !== null
                        ? 'Guardada ✓'
                        : 'Guardar en el tracker'}
                  </button>
                </div>

                {saved === null ? null : (
                  <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-white p-4 text-sm text-emerald-900">
                    <p className="font-medium">Postulación #{saved.id} guardada como borrador.</p>
                    <Link
                      to="/tracker"
                      className="ml-auto rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
                    >
                      Ir al tracker
                    </Link>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Vista previa de la carta</h2>
                <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                  <p>{preview.coverLetter.greeting}</p>
                  {preview.coverLetter.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mt-3">
                      {paragraph}
                    </p>
                  ))}
                  <p className="mt-3">{preview.coverLetter.closing}</p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Editar antes de guardar</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Por ahora la edición es JSON. Usá <strong>Validar edición</strong> antes de
                  guardar la postulación.
                </p>

                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">CV adaptado (JSON)</span>
                    <textarea
                      value={cvJson}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                        setCvJson(event.target.value)
                      }
                      spellCheck={false}
                      className="mt-2 min-h-[22rem] w-full rounded-xl border border-slate-300 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Carta (JSON)</span>
                    <textarea
                      value={letterJson}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                        setLetterJson(event.target.value)
                      }
                      spellCheck={false}
                      className="mt-2 min-h-[22rem] w-full rounded-xl border border-slate-300 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-slate-500"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={validateEdits}
                  className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Validar edición
                </button>
              </section>
            </>
          ) : null}

          <div aria-live="polite">
            {message === null ? null : (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                {message}
              </p>
            )}
            {error === null ? null : (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                {error}
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

function parseIssueMessage(prefix: string, error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue?.path.join('.');

  return `${prefix}${field ? ` en ${field}` : ''}: ${issue?.message ?? 'formato inesperado.'}`;
}

/**
 * Mensaje de fase mientras se genera. Es orientativo: le da a la persona una
 * idea de dónde está el proceso en generaciones que tardan más de un minuto.
 */
function generatingPhase(seconds: number): string {
  if (seconds < 15) {
    return 'Leyendo la oferta y tu perfil…';
  }
  if (seconds < 45) {
    return 'Adaptando el CV a la oferta…';
  }
  if (seconds < 90) {
    return 'Redactando la carta de presentación…';
  }

  return 'Afinando los últimos detalles…';
}

function IconSpinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDownload({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconClipboard({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconSave({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
