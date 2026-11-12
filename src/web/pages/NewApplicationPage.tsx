import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { z } from 'zod';
import { buildCvTextForMatch } from '../../shared/cvText';
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
import { apiGet, apiSend } from '../lib/api';

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
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {generating ? 'Generando CV y carta…' : 'Generar vista previa'}
              </button>
              <span className="text-xs text-slate-500">
                Usa el modelo elegido en Ajustes. Puede tardar uno o dos minutos.
              </span>
            </div>
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

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Guardar postulación</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Se guarda como borrador, se generan los PDFs y queda lista para el tracker.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveApplication()}
                    disabled={saving || saved !== null}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {saving ? 'Guardando…' : 'Guardar y generar PDFs'}
                  </button>
                </div>

                {saved === null ? null : (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <p className="font-medium">Postulación #{saved.id} guardada como borrador.</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <a
                        href={`/api/applications/${saved.id}/files/cv`}
                        download
                        className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-900"
                      >
                        Descargar CV
                      </a>
                      <a
                        href={`/api/applications/${saved.id}/files/letter`}
                        download
                        className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
                      >
                        Descargar carta
                      </a>
                      <Link
                        to="/tracker"
                        className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
                      >
                        Ir al tracker
                      </Link>
                    </div>
                  </div>
                )}
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
