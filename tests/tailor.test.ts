import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createTailorService,
  detectOfferMeta,
  TailorError,
} from '../src/server/generate/tailor.js';
import type { LLMProvider } from '../src/server/providers/index.js';
import { ProviderError } from '../src/server/providers/index.js';
import { MasterProfile } from '../src/shared/schemas.js';

const profile = MasterProfile.parse(
  JSON.parse(readFileSync(new URL('../fixtures/profile.json', import.meta.url), 'utf8')),
);

const offerText = readFileSync(
  new URL('../fixtures/offers/analista-datos-es.md', import.meta.url),
  'utf8',
);

const englishOfferText = readFileSync(
  new URL('../fixtures/offers/backend-en.md', import.meta.url),
  'utf8',
);

const cvResponse = JSON.stringify({
  summary: 'Analista de datos con 4 años de experiencia en SQL y Power BI.',
  headline: 'Analista de datos',
  experience: [
    {
      experienceId: 'exp-nova',
      role: 'Analista de datos',
      bullets: [
        {
          text: 'Analicé datos de ventas con SQL y Power BI y reduje el tiempo de reporte en 30%.',
          sourceBulletId: 'nova-b1',
        },
      ],
    },
  ],
  skills: ['SQL', 'Power BI'],
  keywordsUsed: ['inventado'],
  keywordsMissing: ['inventado'],
});

const letterResponse = JSON.stringify({
  greeting: 'Hola:',
  paragraphs: [
    'Tengo 4 años de experiencia en análisis de datos.',
    'Trabajé con SQL y Power BI en equipos de retail y logística.',
  ],
  closing: 'Saludos.',
});

function providerFromCv(cv: string): LLMProvider {
  return {
    id: 'fake',
    name: 'Fake',
    async isAvailable() {
      return true;
    },
    async listModels() {
      return [];
    },
    async generate(req) {
      return req.system.includes('adaptar CVs') ? cv : letterResponse;
    },
  };
}

describe('detectOfferMeta', () => {
  it('detecta empresa y puesto y limpia "ficticia"', () => {
    expect(detectOfferMeta(offerText)).toEqual({
      suggestedCompany: 'Andes Market',
      suggestedPosition: 'Analista de Datos',
    });
  });

  it('detecta empresa y puesto en una oferta en inglés', () => {
    expect(detectOfferMeta(englishOfferText)).toEqual({
      suggestedCompany: 'Cloud Harbor',
      suggestedPosition: 'Backend Engineer',
    });
  });

  it('detecta el puesto en frases en inglés sin encabezado', () => {
    expect(
      detectOfferMeta('We are looking for a Data Analyst to join our team.\nCompany: Acme')
        .suggestedPosition,
    ).toBe('Data Analyst');
  });
});

describe('TailorService', () => {
  it('genera CV y carta, y reemplaza keywords por las calculadas', async () => {
    const service = createTailorService(async () => providerFromCv(cvResponse));
    const preview = await service.preview({
      profile,
      offerText,
      model: { provider: 'fake', model: 'fake' },
    });

    expect(preview.tailoredCv.summary).toContain('Analista de datos');
    expect(preview.tailoredCv.headline).toBe('Analista de datos');
    expect(preview.coverLetter.paragraphs).toHaveLength(2);
    expect(preview.keywords.keywords.length).toBeGreaterThan(0);
    expect(preview.tailoredCv.keywordsUsed).toEqual(preview.keywords.matched);
    expect(preview.tailoredCv.keywordsMissing).toEqual(preview.keywords.missing);
    expect(preview.keywords.missing).toContain('python');
    expect(preview.keywords.matchPct).toBeGreaterThan(0);
    expect(preview.keywords.matchPct).toBeLessThan(100);
  });

  it('acepta ajustes declarados y calcula el match con afines', async () => {
    const enhancedCv = JSON.stringify({
      summary: 'Analista de datos con 4 años de experiencia en SQL y Power BI.',
      headline: 'Analista de datos',
      experience: [
        {
          experienceId: 'exp-nova',
          bullets: [
            {
              text: 'Analicé datos de ventas con SQL y Power BI y reduje el tiempo de reporte en 33%.',
              sourceBulletId: 'nova-b1',
              stretch: { kind: 'number', note: 'redondeo de 30 a 33' },
            },
          ],
        },
      ],
      skills: ['SQL', 'Power BI'],
      adjacentSkills: [
        { name: 'Google Sheets', basedOn: 'Excel', why: 'Ambas son planillas de cálculo.' },
      ],
      keywordsUsed: [],
      keywordsMissing: [],
    });
    const service = createTailorService(async () => providerFromCv(enhancedCv));
    const preview = await service.preview({
      profile,
      offerText,
      model: { provider: 'fake', model: 'fake' },
    });

    expect(preview.tailoredCv.experience[0]?.bullets[0]?.stretch?.kind).toBe('number');
    expect(preview.tailoredCv.adjacentSkills).toHaveLength(1);
    expect(preview.keywords.matchPctWithAdjacent).toBeGreaterThanOrEqual(preview.keywords.matchPct);
  });

  it('la fidelidad estricta rechaza un CV con ajustes', async () => {
    const cvWithStretch = JSON.stringify({
      ...JSON.parse(cvResponse),
      experience: [
        {
          experienceId: 'exp-nova',
          bullets: [
            {
              text: 'Analicé datos de ventas con SQL y Power BI y reduje el tiempo de reporte en 33%.',
              sourceBulletId: 'nova-b1',
              stretch: { kind: 'number', note: 'redondeo' },
            },
          ],
        },
      ],
    });
    const service = createTailorService(async () => providerFromCv(cvWithStretch));

    await expect(
      service.preview({
        profile,
        offerText,
        model: { provider: 'fake', model: 'fake' },
        fidelity: 'strict',
      }),
    ).rejects.toBeInstanceOf(TailorError);
  });

  it('reintenta si el CV no pasa la validación anti-invención', async () => {
    let cvCalls = 0;
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
        if (!req.system.includes('adaptar CVs')) {
          return letterResponse;
        }

        cvCalls += 1;

        if (cvCalls === 1) {
          return JSON.stringify({
            ...JSON.parse(cvResponse),
            skills: ['SQL', 'Python'],
          });
        }

        return cvResponse;
      },
    };
    const service = createTailorService(async () => provider);
    const preview = await service.preview({
      profile,
      offerText,
      model: { provider: 'fake', model: 'fake' },
    });

    expect(cvCalls).toBe(2);
    expect(preview.tailoredCv.skills).toEqual(['SQL', 'Power BI']);
  });

  it('falla tras dos CV inválidos', async () => {
    const invalid = JSON.stringify({ ...JSON.parse(cvResponse), skills: ['Python'] });
    const service = createTailorService(async () => providerFromCv(invalid));

    await expect(
      service.preview({
        profile,
        offerText,
        model: { provider: 'fake', model: 'fake' },
      }),
    ).rejects.toBeInstanceOf(TailorError);
  });

  it('propaga errores del proveedor', async () => {
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
    const service = createTailorService(async () => provider);

    await expect(
      service.preview({
        profile,
        offerText,
        model: { provider: 'fake', model: 'fake' },
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
