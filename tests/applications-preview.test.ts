import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { TailorService } from '../src/server/generate/tailor.js';
import { MasterProfile, PreviewApplicationResponse } from '../src/shared/schemas.js';
import { createTestContext, TEST_HOST, type TestContext } from './support.js';

const profile = MasterProfile.parse(
  JSON.parse(readFileSync(new URL('../fixtures/profile.json', import.meta.url), 'utf8')),
);

const fakeTailor: TailorService = {
  async preview() {
    return {
      tailoredCv: {
        summary: 'Analista de datos con experiencia en SQL.',
        experience: [
          {
            experienceId: 'exp-nova',
            bullets: [{ text: 'Analicé ventas con SQL.', sourceBulletId: 'nova-b1' }],
          },
        ],
        skills: ['SQL'],
        keywordsUsed: ['sql'],
        keywordsMissing: ['python'],
      },
      coverLetter: {
        greeting: 'Hola:',
        paragraphs: ['Me interesa el puesto.', 'Tengo experiencia en SQL.'],
        closing: 'Saludos.',
      },
      keywords: {
        keywords: ['sql', 'python'],
        matched: ['sql'],
        missing: ['python'],
        matchPct: 50,
      },
      suggestedCompany: 'Andes Market',
      suggestedPosition: 'Analista de Datos',
    };
  },
};

let test: TestContext;

afterEach(async () => {
  await test.cleanup();
});

const authHeaders = () => ({ host: TEST_HOST, cookie: test.cookie });
const offerText =
  'Buscamos Analista de Datos con SQL, Power BI y Python. Empresa ficticia de prueba.';

describe('API de vista previa de postulación', () => {
  it('exige un perfil guardado', async () => {
    test = await createTestContext({ tailorService: fakeTailor });
    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications/preview',
      headers: authHeaders(),
      payload: { offerText },
    });

    expect(response.statusCode).toBe(400);
  });

  it('devuelve CV, carta, keywords y sugerencias', async () => {
    test = await createTestContext({ tailorService: fakeTailor });

    const save = await test.context.app.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authHeaders(),
      payload: { profile },
    });
    expect(save.statusCode).toBe(200);

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications/preview',
      headers: authHeaders(),
      payload: { offerText },
    });

    expect(response.statusCode).toBe(200);
    const preview = PreviewApplicationResponse.parse(response.json());
    expect(preview.tailoredCv.skills).toEqual(['SQL']);
    expect(preview.keywords.matchPct).toBe(50);
    expect(preview.suggestedCompany).toBe('Andes Market');
    expect(preview.suggestedPosition).toBe('Analista de Datos');
  });

  it('rechaza una oferta demasiado corta', async () => {
    test = await createTestContext({ tailorService: fakeTailor });
    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications/preview',
      headers: authHeaders(),
      payload: { offerText: 'corta' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('exige sesión', async () => {
    test = await createTestContext({ tailorService: fakeTailor });
    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/applications/preview',
      headers: { host: TEST_HOST },
      payload: { offerText },
    });

    expect(response.statusCode).toBe(401);
  });
});
