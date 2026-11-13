import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationResponse } from '../src/shared/schemas.js';
import { createTestContext, TEST_HOST, type TestContext } from './support.js';

const profile = JSON.parse(
  await readFile(new URL('../fixtures/profile.json', import.meta.url), 'utf8'),
);
const jobText = await readFile(
  new URL('../fixtures/offers/analista-datos-es.md', import.meta.url),
  'utf8',
);

const tailoredCv = {
  summary: 'Analista de datos con experiencia en SQL y Power BI.',
  headline: 'Analista de datos',
  experience: [
    {
      experienceId: 'exp-nova',
      role: 'Analista de datos',
      bullets: [{ text: 'Analicé datos de ventas con SQL.', sourceBulletId: 'nova-b1' }],
    },
  ],
  skills: ['SQL', 'Power BI'],
  keywordsUsed: [],
  keywordsMissing: [],
};

const coverLetter = {
  greeting: 'Estimado equipo de Andes Market:',
  paragraphs: ['Me interesa el puesto de Analista de Datos.', 'Tengo experiencia en SQL.'],
  closing: 'Saludos cordiales,',
};

let test: TestContext;

afterEach(async () => {
  await test.cleanup();
});

const authHeaders = () => ({ host: TEST_HOST, cookie: test.cookie });

async function createDraft(): Promise<{ id: number; cvPath: string; letterPath: string }> {
  const response = await test.context.app.inject({
    method: 'POST',
    url: '/api/applications',
    headers: authHeaders(),
    payload: { jobText, tailoredCv, coverLetter },
  });

  expect(response.statusCode).toBe(201);
  const application = ApplicationResponse.parse(response.json()).application;

  return {
    id: application.id,
    cvPath: application.cvPath ?? '',
    letterPath: application.letterPath ?? '',
  };
}

describe('eliminación de postulaciones', () => {
  it('borra la fila, el historial y los archivos PDF', async () => {
    test = await createTestContext();
    await test.context.app.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authHeaders(),
      payload: { profile },
    });

    const created = await createDraft();

    // Cambia el estado para generar entradas de historial extra.
    await test.context.app.inject({
      method: 'PATCH',
      url: `/api/applications/${created.id}`,
      headers: authHeaders(),
      payload: { status: 'sent' },
    });

    expect(existsSync(path.join(test.context.config.outputsDir, created.cvPath))).toBe(true);
    expect(existsSync(path.join(test.context.config.outputsDir, created.letterPath))).toBe(true);

    const response = await test.context.app.inject({
      method: 'DELETE',
      url: `/api/applications/${created.id}`,
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    const count = test.context.db
      .prepare('SELECT COUNT(*) AS count FROM applications WHERE id = ?')
      .get(created.id) as { count: number };
    expect(count.count).toBe(0);

    const history = test.context.db
      .prepare('SELECT COUNT(*) AS count FROM status_history WHERE application_id = ?')
      .get(created.id) as { count: number };
    expect(history.count).toBe(0);

    expect(existsSync(path.join(test.context.config.outputsDir, created.cvPath))).toBe(false);
    expect(existsSync(path.join(test.context.config.outputsDir, created.letterPath))).toBe(false);
  });

  it('responde 404 para una postulación inexistente', async () => {
    test = await createTestContext();
    const response = await test.context.app.inject({
      method: 'DELETE',
      url: '/api/applications/999',
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toContain('no existe');
  });

  it('rechaza ids inválidos', async () => {
    test = await createTestContext();
    const response = await test.context.app.inject({
      method: 'DELETE',
      url: '/api/applications/no-es-numero',
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(400);
  });
});
