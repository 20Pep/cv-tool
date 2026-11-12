import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
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

async function saveProfile(): Promise<void> {
  const response = await test.context.app.inject({
    method: 'PUT',
    url: '/api/profile',
    headers: authHeaders(),
    payload: { profile },
  });
  expect(response.statusCode).toBe(200);
}

describe('creación de postulaciones', () => {
  it('guarda la postulación, genera PDFs y permite descargarlos', async () => {
    test = await createTestContext();
    await saveProfile();

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: authHeaders(),
      payload: {
        company: 'Andes Market',
        position: 'Analista de Datos',
        url: 'https://example.com/oferta',
        jobText,
        tailoredCv,
        coverLetter,
      },
    });

    expect(response.statusCode).toBe(201);
    const application = ApplicationResponse.parse(response.json()).application;
    expect(application.status).toBe('draft');
    expect(application.matchPct).toBeGreaterThan(0);
    expect(application.missingKeywords).toContain('python');
    expect(application.cvPath).toMatch(/^Ana_Perez_.*\.pdf$/);
    expect(application.letterPath).toMatch(/^Ana_Perez_.*_Carta\.pdf$/);

    const cvBuffer = await readFile(
      path.join(test.context.config.outputsDir, application.cvPath ?? ''),
    );
    const pdf = await getDocumentProxy(new Uint8Array(cvBuffer));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text;

    expect(text).toContain('Ana Pérez');
    expect(text).toContain('Analicé datos de ventas con SQL y Power BI.');

    const history = test.context.db
      .prepare('SELECT COUNT(*) AS count FROM status_history WHERE application_id = ?')
      .get(application.id) as { count: number };
    expect(history.count).toBe(1);

    const download = await test.context.app.inject({
      method: 'GET',
      url: `/api/applications/${application.id}/files/cv`,
      headers: authHeaders(),
    });

    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.rawPayload.byteLength).toBeGreaterThan(1000);
  });

  it('detecta empresa y puesto cuando no se envían', async () => {
    test = await createTestContext();
    await saveProfile();

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: authHeaders(),
      payload: {
        jobText,
        tailoredCv,
        coverLetter,
      },
    });

    expect(response.statusCode).toBe(201);
    const application = ApplicationResponse.parse(response.json()).application;
    expect(application.company).toBe('Andes Market');
    expect(application.position).toBe('Analista de Datos');
  });

  it('resuelve colisiones de nombres al guardar dos veces', async () => {
    test = await createTestContext();
    await saveProfile();

    const payload = {
      company: 'Andes Market',
      position: 'Analista de Datos',
      jobText,
      tailoredCv,
      coverLetter,
    };
    const first = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: authHeaders(),
      payload,
    });
    const second = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: authHeaders(),
      payload,
    });

    const firstApp = ApplicationResponse.parse(first.json()).application;
    const secondApp = ApplicationResponse.parse(second.json()).application;

    expect(firstApp.cvPath).not.toBe(secondApp.cvPath);
    expect(secondApp.cvPath).toContain('_2.pdf');
  });

  it('rechaza una postulación sin perfil', async () => {
    test = await createTestContext();
    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: authHeaders(),
      payload: {
        company: 'Andes Market',
        position: 'Analista de Datos',
        jobText,
        tailoredCv,
        coverLetter,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rechaza un CV inválido', async () => {
    test = await createTestContext();
    await saveProfile();

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: authHeaders(),
      payload: {
        company: 'Andes Market',
        position: 'Analista de Datos',
        jobText,
        tailoredCv: { ...tailoredCv, skills: ['Python'] },
        coverLetter,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rechaza descargas con datos inválidos', async () => {
    test = await createTestContext();
    const response = await test.context.app.inject({
      method: 'GET',
      url: '/api/applications/1/files/otro',
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(400);
  });
});
