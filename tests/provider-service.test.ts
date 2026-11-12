import { describe, expect, it } from 'vitest';
import { type LLMProvider, ProviderError } from '../src/server/providers/index.js';
import { createProviderService } from '../src/server/providers/service.js';
import { DEFAULT_LLM_SETTINGS } from '../src/shared/schemas.js';

const fakeProvider: LLMProvider = {
  id: 'opencode',
  name: 'OpenCode',
  async isAvailable() {
    return true;
  },
  async listModels() {
    return [
      { provider: 'opencode', model: 'modelo-gratis', name: 'Gratis', isFree: true },
      {
        provider: 'opencode-go',
        model: 'deepseek-v4.1-flash',
        name: 'DeepSeek V4.1 Flash',
        variants: ['low', 'high'],
      },
    ];
  },
  async generate(req) {
    if (req.model?.model === 'falla') {
      throw new ProviderError('rate_limit', 'Límite de uso alcanzado.', {
        retryAfterMs: 60_000,
      });
    }

    return 'ok';
  },
  async getServerInfo() {
    return { version: '9.9.9' };
  },
};

describe('ProviderService', () => {
  it('lista modelos con Go primero y reporta la versión', async () => {
    const service = createProviderService(async () => fakeProvider);
    const response = await service.getProviders(DEFAULT_LLM_SETTINGS);

    expect(response.provider).toMatchObject({
      id: 'opencode',
      name: 'OpenCode',
      available: true,
      version: '9.9.9',
    });
    expect(response.models.map((model) => model.provider)).toEqual(['opencode-go', 'opencode']);
    expect(response.models[0]?.variants).toEqual(['low', 'high']);
    expect(response.current).toEqual(DEFAULT_LLM_SETTINGS);
  });

  it('prueba la conexión y devuelve la respuesta real', async () => {
    const service = createProviderService(async () => fakeProvider);
    const response = await service.testConnection({
      provider: 'opencode-go',
      model: 'deepseek-v4.1-flash',
      variant: 'low',
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.text).toBe('ok');
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('mapea un error del proveedor a un resultado fallido', async () => {
    const service = createProviderService(async () => fakeProvider);
    const response = await service.testConnection({
      provider: 'opencode-go',
      model: 'falla',
    });

    expect(response).toMatchObject({
      ok: false,
      error: 'Límite de uso alcanzado.',
      kind: 'rate_limit',
    });
  });

  it('reporta el proveedor como no disponible si la detección falla', async () => {
    const unavailableProvider: LLMProvider = {
      ...fakeProvider,
      async getServerInfo() {
        throw new ProviderError('unavailable', 'No pude conectarme con OpenCode.');
      },
    };
    const service = createProviderService(async () => unavailableProvider);
    const response = await service.getProviders(DEFAULT_LLM_SETTINGS);

    expect(response.provider).toMatchObject({
      available: false,
      error: 'No pude conectarme con OpenCode.',
    });
    expect(response.models).toEqual([]);
  });
});
