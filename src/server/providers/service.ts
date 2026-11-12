import { performance } from 'node:perf_hooks';
import type {
  LLMModelInfo,
  LLMSettings,
  ProvidersResponse,
  TestConnectionRequest,
  TestConnectionResponse,
} from '../../shared/schemas.js';
import { createProvider, type LLMModel, type LLMProvider, ProviderError } from './index.js';

export type ProviderFactory = () => Promise<LLMProvider>;

export interface ProviderService {
  getProviders(current: LLMSettings): Promise<ProvidersResponse>;
  testConnection(selection: TestConnectionRequest): Promise<TestConnectionResponse>;
}

export function createProviderService(factory: ProviderFactory = createProvider): ProviderService {
  return {
    async getProviders(current) {
      let provider: LLMProvider;

      try {
        provider = await factory();
      } catch (error) {
        return unavailable(current, error);
      }

      try {
        const info =
          provider.getServerInfo === undefined ? undefined : await provider.getServerInfo();
        const models = await provider.listModels();

        return {
          provider: {
            id: provider.id,
            name: provider.name,
            available: true,
            ...(info === undefined ? {} : { version: info.version }),
          },
          models: sortModels(models.map(toModelInfo)),
          current,
        };
      } catch (error) {
        return unavailable(current, error, provider);
      }
    },

    async testConnection(selection) {
      let provider: LLMProvider;

      try {
        provider = await factory();
      } catch (error) {
        return { ok: false, error: messageFor(error) };
      }

      const started = performance.now();

      try {
        const text = await provider.generate({
          system:
            'Sos un probador de conexión. Respondé exactamente con la palabra "ok", sin explicaciones.',
          user: 'ok',
          model: {
            provider: selection.provider,
            model: selection.model,
            ...(selection.variant === undefined ? {} : { variant: selection.variant }),
          },
          timeoutMs: 60_000,
        });

        return {
          ok: true,
          text: text.trim().slice(0, 200),
          latencyMs: Math.round(performance.now() - started),
        };
      } catch (error) {
        return {
          ok: false,
          error: messageFor(error),
          ...(error instanceof ProviderError ? { kind: error.kind } : {}),
        };
      }
    },
  };
}

function unavailable(
  current: LLMSettings,
  error: unknown,
  provider?: LLMProvider,
): ProvidersResponse {
  return {
    provider: {
      id: provider?.id ?? 'opencode',
      name: provider?.name ?? 'OpenCode',
      available: false,
      error: messageFor(error),
    },
    models: [],
    current,
  };
}

function toModelInfo(model: LLMModel): LLMModelInfo {
  return {
    provider: model.provider,
    model: model.model,
    ...(model.name === undefined ? {} : { name: model.name }),
    variants: model.variants ?? [],
    ...(model.isFree === undefined ? {} : { isFree: model.isFree }),
  };
}

function sortModels(models: LLMModelInfo[]): LLMModelInfo[] {
  return [...models].sort((left, right) => {
    const leftGroup = left.provider === 'opencode-go' ? 0 : 1;
    const rightGroup = right.provider === 'opencode-go' ? 0 : 1;

    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }

    if (left.provider !== right.provider) {
      return left.provider.localeCompare(right.provider);
    }

    return (left.name ?? left.model).localeCompare(right.name ?? right.model);
  });
}

function messageFor(error: unknown): string {
  if (error instanceof ProviderError) {
    return error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return 'No pude conectarme con OpenCode.';
}
