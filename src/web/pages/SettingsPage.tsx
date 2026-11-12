import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  type LLMModelInfo,
  type LLMSettings,
  type ProvidersResponse,
  ProvidersResponse as ProvidersResponseSchema,
  SettingsResponse,
  type TestConnectionResponse,
  TestConnectionResponse as TestConnectionResponseSchema,
} from '../../shared/schemas';
import { apiGet, apiSend } from '../lib/api';

export function SettingsPage() {
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [selected, setSelected] = useState<LLMSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setTestResult(null);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const data = await apiGet('/api/providers', ProvidersResponseSchema);
      setProviders(data);

      const savedModel = data.models.find(
        (model) => model.provider === data.current.provider && model.model === data.current.model,
      );
      const fallbackModel =
        data.models.find((model) => model.provider === 'opencode-go') ?? data.models[0];

      if (savedModel !== undefined) {
        const variant = pickVariant(savedModel, data.current.variant);
        setSelected({
          provider: savedModel.provider,
          model: savedModel.model,
          ...(variant === undefined ? {} : { variant }),
        });
      } else if (fallbackModel !== undefined) {
        const variant = pickVariant(fallbackModel);
        setSelected({
          provider: fallbackModel.provider,
          model: fallbackModel.model,
          ...(variant === undefined ? {} : { variant }),
        });
      } else {
        setSelected(null);
      }
    } catch (caught) {
      setProviders(null);
      setSelected(null);
      setLoadError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedModel = useMemo(
    () =>
      providers?.models.find(
        (model) =>
          selected !== null &&
          model.provider === selected.provider &&
          model.model === selected.model,
      ) ?? null,
    [providers, selected],
  );

  const modelGroups = useMemo(() => {
    const groups = new Map<string, LLMModelInfo[]>();

    for (const model of providers?.models ?? []) {
      const list = groups.get(model.provider) ?? [];
      list.push(model);
      groups.set(model.provider, list);
    }

    return [...groups.entries()].sort(([left], [right]) => {
      if (left === right) {
        return 0;
      }
      if (left === 'opencode-go') {
        return -1;
      }
      if (right === 'opencode-go') {
        return 1;
      }
      return left.localeCompare(right);
    });
  }, [providers]);

  const providerAvailable = providers?.provider.available === true;
  const canInteract = selected !== null && providerAvailable;

  const changeModel = (event: ChangeEvent<HTMLSelectElement>) => {
    const [provider, modelId] = event.target.value.split('::');

    if (provider === undefined || modelId === undefined) {
      return;
    }

    const model = providers?.models.find(
      (candidate) => candidate.provider === provider && candidate.model === modelId,
    );
    const variant = model === undefined ? undefined : pickVariant(model);

    setSelected({
      provider,
      model: modelId,
      ...(variant === undefined ? {} : { variant }),
    });
    setTestResult(null);
    setSaveMessage(null);
    setSaveError(null);
  };

  const changeVariant = (event: ChangeEvent<HTMLSelectElement>) => {
    const variant = event.target.value;

    setSelected((current) => {
      if (current === null) {
        return current;
      }

      const next = { ...current };
      if (variant.length === 0) {
        delete next.variant;
      } else {
        next.variant = variant;
      }
      return next;
    });
    setTestResult(null);
    setSaveMessage(null);
    setSaveError(null);
  };

  const testConnection = async () => {
    if (selected === null) {
      return;
    }

    setTesting(true);
    setTestResult(null);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const result = await apiSend(
        '/api/providers/test',
        'POST',
        selected,
        TestConnectionResponseSchema,
      );
      setTestResult(result);
    } catch (caught) {
      setTestResult({ ok: false, error: messageFor(caught) });
    } finally {
      setTesting(false);
    }
  };

  const saveSettings = async () => {
    if (selected === null) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const result = await apiSend('/api/settings', 'PUT', { llm: selected }, SettingsResponse);
      setSelected(result.llm);
      setSaveMessage('Ajustes guardados. Se van a usar en las próximas generaciones.');
    } catch (caught) {
      setSaveError(messageFor(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Configuración
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Ajustes</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Elegí el proveedor y el modelo que cv-tool va a usar para adaptar tus CVs y cartas. La
          conexión se prueba con una llamada real a OpenCode.
        </p>
      </header>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando proveedores y modelos…
        </section>
      ) : null}

      {loadError !== null ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p className="font-medium">No pude cargar los ajustes.</p>
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

      {providers !== null ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{providers.provider.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {providerAvailable
                    ? 'Servicio local de OpenCode disponible.'
                    : 'No se pudo conectar con OpenCode.'}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                  providerAvailable
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    providerAvailable ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                {providerAvailable ? 'Conectado' : 'No disponible'}
              </span>
            </div>

            {providers.provider.version === undefined ? null : (
              <p className="mt-4 text-xs text-slate-500">
                Versión del servidor:{' '}
                <span className="font-mono">{providers.provider.version}</span>
              </p>
            )}

            {providers.provider.error === undefined ? null : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-medium">OpenCode no está respondiendo.</p>
                <p className="mt-1">{providers.provider.error}</p>
                <p className="mt-2 text-xs">
                  Verificá que OpenCode esté abierto y que el servicio local esté corriendo. También
                  podés revisar la variable{' '}
                  <code className="font-mono">OPENCODE_SERVER_PASSWORD</code>.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Actualizar
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Modelo</h2>
            <p className="mt-1 text-sm text-slate-600">
              OpenCode Go aparece primero. Los modelos gratuitos pueden tener límites de uso.
            </p>

            {modelGroups.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                No hay modelos disponibles. Revisá la conexión con OpenCode.
              </p>
            ) : (
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Modelo</span>
                  <select
                    value={selected === null ? '' : `${selected.provider}::${selected.model}`}
                    onChange={changeModel}
                    disabled={!providerAvailable}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {modelGroups.map(([provider, models]) => (
                      <optgroup
                        key={provider}
                        label={provider === 'opencode-go' ? 'OpenCode Go' : provider}
                      >
                        {models.map((model) => (
                          <option
                            key={`${model.provider}::${model.model}`}
                            value={`${model.provider}::${model.model}`}
                          >
                            {model.name ?? model.model}
                            {model.isFree === true ? ' · gratis' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Variante</span>
                  <select
                    value={selected?.variant ?? ''}
                    onChange={changeVariant}
                    disabled={
                      !providerAvailable ||
                      selectedModel === null ||
                      selectedModel.variants.length === 0
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {selectedModel !== null && selectedModel.variants.length > 0 ? (
                      selectedModel.variants.map((variant) => (
                        <option key={variant} value={variant}>
                          {variant}
                        </option>
                      ))
                    ) : (
                      <option value="">Predeterminada</option>
                    )}
                  </select>
                </label>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void testConnection()}
                disabled={!canInteract || testing}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {testing ? 'Probando…' : 'Probar conexión'}
              </button>
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={selected === null || saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar ajustes'}
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Probar conexión hace una llamada real al modelo y puede tardar. Guardar no prueba la
              conexión.
            </p>

            <div aria-live="polite">
              {testResult === null ? null : testResult.ok ? (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-medium">Conexión correcta en {testResult.latencyMs} ms.</p>
                  <p className="mt-1 text-xs">
                    Respuesta del modelo:{' '}
                    <code className="font-mono">{testResult.text || '(vacía)'}</code>
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  <p className="font-medium">No se pudo conectar.</p>
                  <p className="mt-1">{testResult.error}</p>
                </div>
              )}
            </div>

            {saveMessage === null ? null : (
              <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                {saveMessage}
              </p>
            )}

            {saveError === null ? null : (
              <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                {saveError}
              </p>
            )}
          </section>

          <p className="text-xs leading-5 text-slate-500">
            La configuración se guarda en SQLite. Las credenciales de OpenCode Go las administra
            OpenCode; cv-tool no guarda API keys.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function pickVariant(model: LLMModelInfo, preferred?: string): string | undefined {
  if (model.variants.length === 0) {
    return undefined;
  }

  if (preferred !== undefined && model.variants.includes(preferred)) {
    return preferred;
  }

  return model.variants[0];
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}
