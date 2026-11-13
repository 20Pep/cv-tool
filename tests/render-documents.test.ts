import { readFileSync } from 'node:fs';
import { extractText, getDocumentProxy } from 'unpdf';
import { describe, expect, it } from 'vitest';
import { renderCvPdf, renderLetterPdf } from '../src/server/render/pdf.js';
import { detectLanguage } from '../src/shared/language.js';
import { MasterProfile } from '../src/shared/schemas.js';

const profile = MasterProfile.parse(
  JSON.parse(readFileSync(new URL('../fixtures/profile.json', import.meta.url), 'utf8')),
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
  keywordsUsed: ['sql'],
  keywordsMissing: ['python'],
};

const coverLetter = {
  greeting: 'Estimado equipo de Andes Market:',
  paragraphs: ['Me interesa el puesto de Analista de Datos.', 'Tengo experiencia en SQL.'],
  closing: 'Saludos cordiales,',
};

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  return Array.isArray(result.text) ? result.text.join('\n') : result.text;
}

describe('detectLanguage', () => {
  it('detecta español e inglés', () => {
    expect(detectLanguage('Buscamos una persona para el equipo de datos y análisis')).toBe('es');
    expect(detectLanguage('We are looking for a person to join the data team')).toBe('en');
  });
});

describe('documentos PDF', () => {
  it('genera un CV con texto extraíble y contenido ATS', async () => {
    const buffer = await renderCvPdf(profile, tailoredCv, 'es');
    const text = await extractPdfText(buffer);

    expect(text).toContain('Ana Pérez');
    expect(text.toUpperCase()).toContain('RESUMEN');
    expect(text.toUpperCase()).toContain('EXPERIENCIA');
    expect(text).toContain('Analicé datos de ventas con SQL y Power BI.');
    expect(text.toUpperCase()).toContain('HABILIDADES');
    expect(text).toContain('Power BI');
  });

  it('genera una carta con saludo, párrafos y cierre', async () => {
    const buffer = await renderLetterPdf(
      profile,
      coverLetter,
      'es',
      'Andes Market',
      'Analista de Datos',
    );
    const text = await extractPdfText(buffer);

    expect(text).toContain('Ana Pérez');
    expect(text).toContain('Estimado equipo de Andes Market:');
    expect(text).toContain('Me interesa el puesto de Analista de Datos.');
    expect(text).toContain('Saludos cordiales,');
  });
});
