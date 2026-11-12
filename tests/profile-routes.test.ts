import { afterEach, describe, expect, it } from 'vitest';
import type { ProfileBuilder } from '../src/server/profile/buildProfile.js';
import { GenerateProfileResponse, MasterProfile, ProfileResponse } from '../src/shared/schemas.js';
import { createTestContext, TEST_HOST, type TestContext, uploadTextDocument } from './support.js';

const profile = MasterProfile.parse({
  basics: {
    fullName: 'Ana Pérez',
    headline: 'Analista de datos',
    links: [],
  },
  summary: 'Analista de datos con experiencia en SQL y Power BI.',
  experience: [
    {
      id: 'exp-1',
      company: 'Acme',
      role: 'Analista de datos',
      start: '2021',
      end: null,
      bullets: [{ id: 'exp-1-b1', text: 'Analicé datos de ventas con SQL.' }],
    },
  ],
  education: [],
  skills: [{ name: 'SQL' }],
  projects: [],
  certifications: [],
  languages: [],
});

const fakeBuilder: ProfileBuilder = {
  async build() {
    return profile;
  },
};

let test: TestContext;

afterEach(async () => {
  await test.cleanup();
});

const authHeaders = () => ({ host: TEST_HOST, cookie: test.cookie });

describe('API de perfil', () => {
  it('devuelve null cuando no hay perfil', async () => {
    test = await createTestContext({ profileBuilder: fakeBuilder });
    const response = await test.context.app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(200);
    expect(ProfileResponse.parse(response.json())).toEqual({
      profile: null,
      version: null,
      updatedAt: null,
    });
  });

  it('rechaza generar sin documentos', async () => {
    test = await createTestContext({ profileBuilder: fakeBuilder });
    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/profile/generate',
      headers: authHeaders(),
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('genera un perfil, lo deja como borrador y luego lo guarda', async () => {
    test = await createTestContext({ profileBuilder: fakeBuilder });
    const upload = await uploadTextDocument(test, {
      text: 'Ana Pérez analista de datos con experiencia en SQL y Power BI.',
    });
    expect(upload.statusCode).toBe(201);

    const generated = await test.context.app.inject({
      method: 'POST',
      url: '/api/profile/generate',
      headers: authHeaders(),
      payload: {},
    });

    expect(generated.statusCode).toBe(200);
    const generatedBody = GenerateProfileResponse.parse(generated.json());
    expect(generatedBody.profile.basics.fullName).toBe('Ana Pérez');

    const beforeSave = await test.context.app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: authHeaders(),
    });
    expect(ProfileResponse.parse(beforeSave.json()).profile).toBeNull();

    const saved = await test.context.app.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authHeaders(),
      payload: { profile: generatedBody.profile },
    });

    expect(saved.statusCode).toBe(200);
    const savedBody = ProfileResponse.parse(saved.json());
    expect(savedBody.profile?.basics.fullName).toBe('Ana Pérez');
    expect(savedBody.version).toBe(1);

    const loaded = await test.context.app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: authHeaders(),
    });
    expect(ProfileResponse.parse(loaded.json()).version).toBe(1);

    const savedAgain = await test.context.app.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authHeaders(),
      payload: { profile: generatedBody.profile },
    });
    expect(ProfileResponse.parse(savedAgain.json()).version).toBe(2);
  });

  it('persiste el esquema de carta del perfil', async () => {
    test = await createTestContext({ profileBuilder: fakeBuilder });
    const withOutline = {
      ...profile,
      letterOutline: 'Saludo, motivación, experiencia, cierre.',
    };

    const saved = await test.context.app.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authHeaders(),
      payload: { profile: withOutline },
    });

    expect(saved.statusCode).toBe(200);
    expect(ProfileResponse.parse(saved.json()).profile?.letterOutline).toBe(
      'Saludo, motivación, experiencia, cierre.',
    );
  });

  it('rechaza un perfil inválido', async () => {
    test = await createTestContext({ profileBuilder: fakeBuilder });
    const response = await test.context.app.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authHeaders(),
      payload: { profile: { basics: { fullName: '' } } },
    });

    expect(response.statusCode).toBe(400);
  });

  it('exige sesión para leer el perfil', async () => {
    test = await createTestContext({ profileBuilder: fakeBuilder });
    const response = await test.context.app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: { host: TEST_HOST },
    });

    expect(response.statusCode).toBe(401);
  });
});
