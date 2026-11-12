import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type AppContext, buildApp } from '../src/server/app.js';
import { loadConfig } from '../src/server/config.js';
import { PACKAGE_ROOT } from '../src/server/paths.js';
import type { ProviderService } from '../src/server/providers/service.js';
import type { ProvidersResponse } from '../src/shared/schemas.js';
import { DEFAULT_LLM_SETTINGS } from '../src/shared/schemas.js';

const migrationsDir = path.join(PACKAGE_ROOT, 'migrations');
const host = '127.0.0.1:3000';

const fakeService: ProviderService = {
  async getProviders(current) {
    return {
      provider: {
        id: 'opencode',
        name: 'OpenCode',
        available: true,
        version: '9.9.9',
      },
      models: [
        {
          provider: 'opencode-go',
          model: 'deepseek-v4.1-flash',
          name: 'DeepSeek V4.1 Flash',
          variants: ['low', 'high'],
        },
        {
          provider: 'opencode',
          model: 'modelo-gratis',
          name: 'Gratis',
          variants: [],
          isFree: true,
        },
      ],
      current,
    };
  },
  async testConnection(selection) {
    if (selection.model === 'falla') {
      return { ok: false, error: 'Falló la prueba.', kind: 'provider' };
    }

    return { ok: true, text: 'ok', latencyMs: 12 };
  },
};

let context: AppContext;
let dataDir: string;
let cookie: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'cvtool-providers-'));
  const config = loadConfig({
    isDev: true,
    port: 3000,
    vitePort: 5173,
    dataDir,
    dbPath: path.join(dataDir, 'cv.sqlite'),
    migrationsDir,
    webDistDir: path.join(dataDir, 'web'),
    sessionToken: 'session-test',
    launchToken: 'launch-test',
  });

  context = await buildApp(config, { providerService: fakeService });

  const exchange = await context.app.inject({
    method: 'GET',
    url: '/?t=launch-test',
    headers: { host },
  });
  const setCookie = exchange.headers['set-cookie'];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  cookie = rawCookie?.split(';')[0] ?? '';
});

afterEach(async () => {
  await context.close();
  await rm(dataDir, { recursive: true, force: true });
});

const authHeaders = () => ({ host, cookie });

describe('API de proveedores y ajustes', () => {
  it('lista proveedores con la selección actual', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/providers',
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as ProvidersResponse;
    expect(body.provider.available).toBe(true);
    expect(body.models).toHaveLength(2);
    expect(body.current).toEqual(DEFAULT_LLM_SETTINGS);
  });

  it('lee y guarda la selección', async () => {
    const current = await context.app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: authHeaders(),
    });
    expect(current.json()).toEqual({ llm: DEFAULT_LLM_SETTINGS });

    const selection = {
      provider: 'opencode-go',
      model: 'mimo-v2.5',
      variant: 'low',
    };
    const update = await context.app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: authHeaders(),
      payload: { llm: selection },
    });

    expect(update.statusCode).toBe(200);
    expect(update.json()).toEqual({ llm: selection });

    const saved = await context.app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: authHeaders(),
    });
    expect(saved.json()).toEqual({ llm: selection });
  });

  it('rechaza ajustes inválidos', async () => {
    const response = await context.app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: authHeaders(),
      payload: { llm: { provider: '', model: '' } },
    });

    expect(response.statusCode).toBe(400);
  });

  it('prueba la conexión con un resultado exitoso', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/providers/test',
      headers: authHeaders(),
      payload: {
        provider: 'opencode-go',
        model: 'deepseek-v4.1-flash',
        variant: 'low',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, text: 'ok', latencyMs: 12 });
  });

  it('devuelve el error del proveedor en la prueba de conexión', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/providers/test',
      headers: authHeaders(),
      payload: { provider: 'opencode-go', model: 'falla' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: false,
      error: 'Falló la prueba.',
      kind: 'provider',
    });
  });

  it('rechaza una prueba de conexión sin modelo', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/providers/test',
      headers: authHeaders(),
      payload: { provider: 'opencode-go' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('exige sesión para las rutas nuevas', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/providers',
      headers: { host },
    });

    expect(response.statusCode).toBe(401);
  });
});
