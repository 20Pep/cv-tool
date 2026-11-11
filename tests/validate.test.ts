import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractNumberTokens,
  normalizeText,
  validateCoverLetter,
  validateTailoredCV,
} from '../src/server/generate/validate.js';
import { type CoverLetter, MasterProfile, type TailoredCV } from '../src/shared/schemas.js';

const profile = MasterProfile.parse(
  JSON.parse(readFileSync(new URL('../fixtures/profile.json', import.meta.url), 'utf8')),
);

const validCv: TailoredCV = {
  summary: 'Analista de datos con 4 años de experiencia en SQL y Power BI.',
  experience: [
    {
      experienceId: 'exp-nova',
      bullets: [
        {
          text: 'Analicé datos de ventas con SQL y Power BI y reduje el tiempo de reporte en 30%.',
          sourceBulletId: 'nova-b1',
        },
      ],
    },
  ],
  skills: ['SQL', 'Power BI'],
  keywordsUsed: ['SQL'],
  keywordsMissing: ['Python'],
};

describe('normalizeText', () => {
  it('ignora mayúsculas, acentos y espacios repetidos', () => {
    expect(normalizeText('  Power   BI  ')).toBe('power bi');
    expect(normalizeText('Análisis')).toBe('analisis');
  });
});

describe('extractNumberTokens', () => {
  it('normaliza porcentajes, decimales y separadores de miles', () => {
    expect(extractNumberTokens('30% y 3,5 y 1.000')).toEqual(['30', '3.5', '1000']);
  });
});

describe('validateTailoredCV', () => {
  it('acepta un CV que solo usa datos del perfil', () => {
    expect(validateTailoredCV(validCv, profile)).toEqual([]);
  });

  it('rechaza una experiencia inexistente', () => {
    const cv = { ...validCv, experience: [{ experienceId: 'exp-inventada', bullets: [] }] };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'unknown-experience',
    );
  });

  it('rechaza un sourceBulletId inexistente', () => {
    const cv = {
      ...validCv,
      experience: [
        {
          experienceId: 'exp-nova',
          bullets: [{ text: 'Analicé ventas.', sourceBulletId: 'bullet-inventado' }],
        },
      ],
    };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'unknown-source-bullet',
    );
  });

  it('rechaza una skill que no está en el perfil', () => {
    const cv = { ...validCv, skills: ['SQL', 'Python'] };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain('unknown-skill');
  });

  it('acepta skills con otra capitalización', () => {
    const cv = { ...validCv, skills: ['sql', 'power bi'] };
    expect(validateTailoredCV(cv, profile)).toEqual([]);
  });

  it('rechaza una cifra nueva en un bullet', () => {
    const cv = {
      ...validCv,
      experience: [
        {
          experienceId: 'exp-nova',
          bullets: [
            {
              text: 'Analicé datos de ventas con SQL y reduje el tiempo de reporte en 40%.',
              sourceBulletId: 'nova-b1',
            },
          ],
        },
      ],
    };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'new-number-in-bullet',
    );
  });

  it('rechaza una cifra nueva en el resumen', () => {
    const cv = { ...validCv, summary: 'Analista de datos con 7 años de experiencia.' };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'new-number-in-summary',
    );
  });
});

describe('validateCoverLetter', () => {
  const allowedText = `${JSON.stringify(profile)}\nLa oferta pide 3 años de experiencia.`;

  it('acepta cifras que existen en el perfil o la oferta', () => {
    const letter: CoverLetter = {
      greeting: 'Hola:',
      paragraphs: [
        'Tengo 4 años de experiencia en análisis de datos.',
        'Reduje el tiempo de reporte en 30% y la oferta pide 3 años.',
      ],
      closing: 'Saludos.',
    };
    expect(validateCoverLetter(letter, allowedText)).toEqual([]);
  });

  it('rechaza una cifra inventada', () => {
    const letter: CoverLetter = {
      greeting: 'Hola:',
      paragraphs: [
        'Tengo 4 años de experiencia en análisis de datos.',
        'Aumenté las ventas en 45% durante el último año.',
      ],
      closing: 'Saludos.',
    };
    expect(validateCoverLetter(letter, allowedText).map((issue) => issue.code)).toContain(
      'new-number-in-letter',
    );
  });
});
