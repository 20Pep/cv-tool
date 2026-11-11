import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type AppContext, buildApp } from '../src/server/app.js';
import { loadConfig } from '../src/server/config.js';
import { PACKAGE_ROOT } from '../src/server/paths.js';

const migrationsDir = path.join(PACKAGE_ROOT, 'migrations');
const host = '127.0.0.1:3000';
const devOrigin = 'http://127.0.0.1:5173';

let context: AppContext;
let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'cvtool-security-'));
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

  context = await buildApp(config);
});

afterEach(async () => {
  await context.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe('seguridad local', () => {
  it('rechaza /api sin cookie de sesión', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rechaza un Host ajeno', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host: 'evil.example' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('rechaza un Origin ajeno', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host, origin: 'http://evil.example' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('canjea el token de lanzamiento por una cookie y permite /api', async () => {
    const exchange = await context.app.inject({
      method: 'GET',
      url: '/?t=launch-test',
      headers: { host },
    });

    expect(exchange.statusCode).toBe(302);
    expect(exchange.headers.location).toBe('http://127.0.0.1:5173/');

    const setCookie = exchange.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;

    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain('cvtool_session=session-test');
    expect(cookieHeader).toContain('HttpOnly');

    const cookie = cookieHeader?.split(';')[0] ?? '';
    const health = await context.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host, cookie, origin: devOrigin },
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      status: 'ok',
      database: 'ok',
    });
    expect(health.json()).toHaveProperty('version');
    expect(health.headers['cache-control']).toBe('no-store');
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('no permite reutilizar el token de lanzamiento', async () => {
    await context.app.inject({
      method: 'GET',
      url: '/?t=launch-test',
      headers: { host },
    });

    const reuse = await context.app.inject({
      method: 'GET',
      url: '/?t=launch-test',
      headers: { host },
    });

    expect(reuse.statusCode).toBe(401);
  });

  it('rechaza un token de lanzamiento inválido', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/?t=otro-token',
      headers: { host },
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toContain('No se pudo abrir la sesión');
  });
});
