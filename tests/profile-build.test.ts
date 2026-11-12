import { describe, expect, it } from 'vitest';
import type { DocumentSource } from '../src/server/documents.js';
import {
  createProfileBuilder,
  mergeProfiles,
  normalizeProfileIds,
  ProfileBuildError,
} from '../src/server/profile/buildProfile.js';
import type { LLMProvider } from '../src/server/providers/index.js';
import { ProviderError } from '../src/server/providers/index.js';
import { MasterProfile } from '../src/shared/schemas.js';

const document: DocumentSource = {
  name: 'cv.txt',
  kind: 'cv',
  text: 'Ana Pérez es analista de datos con experiencia en SQL y Power BI.',
};

function profileJson(
  company = 'Acme',
  bullet = 'Analicé datos de ventas con SQL y Power BI.',
  skill = 'SQL',
): string {
  return JSON.stringify({
    basics: {
      fullName: 'Ana Pérez',
      headline: 'Analista de datos',
      links: [],
    },
    summary: 'Analista de datos con experiencia en reporting.',
    experience: [
      {
        id: 'ignorado',
        company,
        role: 'Analista de datos',
        start: '2021',
        end: null,
        bullets: [{ id: 'ignorado', text: bullet }],
      },
    ],
    education: [],
    skills: [{ name: skill }],
    projects: [],
    certifications: [],
    languages: [],
  });
}

function providerFromResponses(responses: string[]): LLMProvider {
  let index = 0;

  return {
    id: 'fake',
    name: 'Fake',
    async isAvailable() {
      return true;
    },
    async listModels() {
      return [];
    },
    async generate() {
      const response = responses[index] ?? responses.at(-1) ?? '';
      index += 1;
      return response;
    },
  };
}

describe('buildProfile', () => {
  it('genera un perfil válido y normaliza los ids', async () => {
    const provider = providerFromResponses([profileJson()]);
    const builder = createProfileBuilder(async () => provider);

    const profile = await builder.build({
      documents: [document],
      model: { provider: 'fake', model: 'fake' },
    });

    expect(profile.basics.fullName).toBe('Ana Pérez');
    expect(profile.experience[0]?.id).toBe('exp-1');
    expect(profile.experience[0]?.bullets[0]?.id).toBe('exp-1-b1');
  });

  it('reintenta una vez si la primera respuesta no es JSON válido', async () => {
    let calls = 0;
    const provider: LLMProvider = {
      id: 'fake',
      name: 'Fake',
      async isAvailable() {
        return true;
      },
      async listModels() {
        return [];
      },
      async generate() {
        calls += 1;
        return calls === 1 ? 'esto no es json' : profileJson();
      },
    };
    const builder = createProfileBuilder(async () => provider);

    const profile = await builder.build({
      documents: [document],
      model: { provider: 'fake', model: 'fake' },
    });

    expect(calls).toBe(2);
    expect(profile.experience).toHaveLength(1);
  });

  it('propaga los errores del proveedor sin reintentar', async () => {
    const provider: LLMProvider = {
      id: 'fake',
      name: 'Fake',
      async isAvailable() {
        return true;
      },
      async listModels() {
        return [];
      },
      async generate() {
        throw new ProviderError('rate_limit', 'Límite de uso alcanzado.');
      },
    };
    const builder = createProfileBuilder(async () => provider);

    await expect(
      builder.build({
        documents: [document],
        model: { provider: 'fake', model: 'fake' },
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('procesa por documento y fusiona si el texto total es muy grande', async () => {
    const provider: LLMProvider = {
      id: 'fake',
      name: 'Fake',
      async isAvailable() {
        return true;
      },
      async listModels() {
        return [];
      },
      async generate(req) {
        const isA = req.user.includes('DOC-A');
        return profileJson(isA ? 'Empresa A' : 'Empresa B');
      },
    };
    const builder = createProfileBuilder(async () => provider);
    const bigDocument = (label: string): DocumentSource => ({
      name: `${label}.txt`,
      kind: 'cv',
      text: `${label} ${'x'.repeat(61_000)}`,
    });

    const profile = await builder.build({
      documents: [bigDocument('DOC-A'), bigDocument('DOC-B')],
      model: { provider: 'fake', model: 'fake' },
    });

    expect(profile.experience).toHaveLength(2);
  });

  it('falla si la IA no devuelve un perfil válido tras dos intentos', async () => {
    const provider = providerFromResponses(['{"basics":{}}', '{"basics":{}}']);
    const builder = createProfileBuilder(async () => provider);

    await expect(
      builder.build({
        documents: [document],
        model: { provider: 'fake', model: 'fake' },
      }),
    ).rejects.toBeInstanceOf(ProfileBuildError);
  });
});

describe('mergeProfiles', () => {
  it('deduplica experiencias, bullets y skills', () => {
    const first = MasterProfile.parse(JSON.parse(profileJson('Acme', 'Bullet A', 'SQL')));
    const second = MasterProfile.parse(JSON.parse(profileJson('Acme', 'Bullet B', 'Power BI')));

    const merged = mergeProfiles([first, second]);

    expect(merged.experience).toHaveLength(1);
    expect(merged.experience[0]?.bullets.map((bullet) => bullet.text)).toEqual([
      'Bullet A',
      'Bullet B',
    ]);
    expect(merged.skills.map((skill) => skill.name)).toEqual(['SQL', 'Power BI']);
  });

  it('normaliza ids después de fusionar', () => {
    const profile = MasterProfile.parse(JSON.parse(profileJson()));
    const normalized = normalizeProfileIds(profile);

    expect(normalized.experience[0]?.id).toBe('exp-1');
    expect(normalized.experience[0]?.bullets[0]?.id).toBe('exp-1-b1');
    expect(normalized.projects).toEqual([]);
  });
});
