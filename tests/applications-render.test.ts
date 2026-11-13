import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
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
      bullets: [
        {
          text: 'Analicé datos de ventas con SQL y Power BI.',
          sourceBulletId: 'nova-b1',
        },
      ],
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

describe('render de PDFs sin guardar', () => {
  it('genera el PDF del CV sin crear la postulación', async () => {
    test = await createTestContext();

    const save = await test.context.app.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authHeaders(),
      payload: { profile },
    });
    expect(save.statusCode).toBe(200);

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications/render',
      headers: authHeaders(),
      payload: {
        jobText,
        tailoredCv,
        coverLetter,
        kind: 'cv',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('.pdf');
    expect(response.rawPayload.byteLength).toBeGreaterThan(1000);

    // No debe haber quedado ninguna postulación guardada.
    const count = test.context.db.prepare('SELECT COUNT(*) AS count FROM applications').get() as {
      count: number;
    };
    expect(count.count).toBe(0);
  });

  it('genera la carta con el mismo endpoint', async () => {
    test = await createTestContext();
    await test.context.app.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authHeaders(),
      payload: { profile },
    });

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications/render',
      headers: authHeaders(),
      payload: { jobText, tailoredCv, coverLetter, kind: 'letter' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toContain('_Carta.pdf');
  });

  it('rechaza un cuerpo inválido indicando el campo', async () => {
    test = await createTestContext();
    await test.context.app.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authHeaders(),
      payload: { profile },
    });

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications/render',
      headers: authHeaders(),
      payload: { jobText, tailoredCv, coverLetter, kind: 'otro' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('kind');
  });

  it('rechaza sin perfil guardado', async () => {
    test = await createTestContext();
    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications/render',
      headers: authHeaders(),
      payload: { jobText, tailoredCv, coverLetter, kind: 'cv' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('perfil');
  });
});
