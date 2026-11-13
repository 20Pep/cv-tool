import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildCvTextForMatch, exportLetterText } from '../src/shared/cvText.js';
import type { CoverLetter } from '../src/shared/schemas.js';

const profile = JSON.parse(
  await readFile(new URL('../fixtures/profile.json', import.meta.url), 'utf8'),
);

describe('exportLetterText', () => {
  it('arma la carta con saludo, párrafos y cierre separados por línea en blanco', () => {
    const letter: CoverLetter = {
      greeting: 'Estimado equipo de Andes Market:',
      paragraphs: ['Me interesa el puesto de Analista de Datos.', 'Tengo experiencia en SQL.'],
      closing: 'Saludos cordiales, Ana Pérez',
    };

    expect(exportLetterText(letter)).toBe(
      [
        'Estimado equipo de Andes Market:',
        '',
        'Me interesa el puesto de Analista de Datos.',
        '',
        'Tengo experiencia en SQL.',
        '',
        'Saludos cordiales, Ana Pérez',
      ].join('\n'),
    );
  });
});

describe('buildCvTextForMatch', () => {
  it('incluye headline, resumen, skills, bullets, educación y proyectos', () => {
    const cv = {
      summary: 'Analista de datos con experiencia en SQL.',
      headline: 'Analista de datos',
      experience: [
        {
          experienceId: 'exp-nova',
          bullets: [{ text: 'Analicé datos de ventas con SQL.', sourceBulletId: 'nova-b1' }],
        },
      ],
      skills: ['SQL', 'Power BI'],
      keywordsUsed: [],
      keywordsMissing: [],
    };

    const text = buildCvTextForMatch(profile, cv);

    expect(text).toContain('Analista de datos');
    expect(text).toContain('Analicé datos de ventas con SQL.');
    expect(text).toContain('SQL');
  });
});
