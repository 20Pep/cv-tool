import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  analyzeOffer,
  extractKeywords,
  matchKeywords,
  normalizeForMatch,
} from '../src/shared/keywords.js';

const readOffer = (name: string): string =>
  readFileSync(new URL(`../fixtures/offers/${name}.md`, import.meta.url), 'utf8');

const offers = {
  analistaEs: readOffer('analista-datos-es'),
  analistaEn: readOffer('data-analyst-en'),
  frontendEs: readOffer('frontend-es'),
  backendEn: readOffer('backend-en'),
  marketingEs: readOffer('marketing-es'),
};

describe('normalizeForMatch', () => {
  it('quita acentos, mayúsculas y puntuación', () => {
    expect(normalizeForMatch('  Power BI, Análisis  ')).toBe('power bi analisis');
  });
});

describe('matchKeywords con equivalencias', () => {
  it('cubre "GitHub" si el CV declara "Git"', () => {
    const match = matchKeywords(['GitHub'], 'Experiencia con Git y Docker');

    expect(match.matched).toContain('GitHub');
    expect(match.missing).toEqual([]);
  });

  it('no inventa cobertura para productos distintos', () => {
    const match = matchKeywords(['MySQL'], 'Experiencia con PostgreSQL');

    expect(match.matched).toEqual([]);
    expect(match.missing).toEqual(['MySQL']);
  });
});

describe('extractKeywords', () => {
  it('extrae las keywords principales de las cinco ofertas', () => {
    expect(extractKeywords(offers.analistaEs)).toEqual(
      expect.arrayContaining(['sql', 'power bi', 'python', 'excel']),
    );
    expect(extractKeywords(offers.analistaEn)).toEqual(
      expect.arrayContaining(['sql', 'tableau', 'python', 'excel']),
    );
    expect(extractKeywords(offers.frontendEs)).toEqual(
      expect.arrayContaining(['react', 'typescript', 'css', 'git', 'html']),
    );
    expect(extractKeywords(offers.backendEn)).toEqual(
      expect.arrayContaining(['node js', 'rest apis', 'aws', 'postgresql', 'docker']),
    );
    expect(extractKeywords(offers.marketingEs)).toEqual(
      expect.arrayContaining([
        'google analytics',
        'meta ads',
        'seo',
        'sem',
        'email marketing',
        'crm',
      ]),
    );
  });

  it('ignora relleno genérico y no devuelve n-gramas cruzados entre líneas', () => {
    const keywords = extractKeywords(offers.analistaEs);

    expect(keywords).not.toContain('experiencia');
    expect(keywords).not.toContain('empresa');
    expect(keywords).not.toContain('equipo');
    expect(keywords).not.toContain('##');
    expect(keywords).not.toContain('buenos aires argentina');
  });

  it('conserva frases técnicas y evita sus tokens sueltos', () => {
    const keywords = extractKeywords(offers.analistaEs);

    expect(keywords).toContain('power bi');
    expect(keywords).not.toContain('power');
    expect(keywords).not.toContain('bi');
  });

  it('ignora las instrucciones ocultas en comentarios HTML', () => {
    const keywords = extractKeywords(readOffer('prompt-injection'));

    expect(keywords).not.toContain('kubernetes');
    expect(keywords).not.toContain('rust');
  });

  it('funciona con las cinco ofertas sin explotar', () => {
    for (const text of Object.values(offers)) {
      const keywords = extractKeywords(text, { limit: 20 });
      expect(keywords.length).toBeGreaterThanOrEqual(8);
      expect(keywords.every((keyword) => keyword.length >= 2)).toBe(true);
    }
  });
});

describe('matchKeywords', () => {
  it('calcula cubiertas, faltantes y porcentaje', () => {
    const offerKeywords = extractKeywords(offers.analistaEs);
    const cvText =
      'Analista de datos con SQL, Power BI, Excel, reportes y tableros de ventas. Inglés B2.';

    const match = matchKeywords(offerKeywords, cvText);

    expect(match.keywords).toBe(offerKeywords);
    expect(match.matched).toEqual(expect.arrayContaining(['sql', 'power bi', 'excel']));
    expect(match.missing).toContain('python');
    expect(match.matchPct).toBeGreaterThan(0);
    expect(match.matchPct).toBeLessThan(100);
    expect(match.matched.length + match.missing.length).toBe(offerKeywords.length);
  });

  it('devuelve 100 si el CV cubre todas las keywords', () => {
    expect(matchKeywords(['sql', 'power bi'], 'Manejo SQL y Power BI.').matchPct).toBe(100);
  });

  it('devuelve 0 si no hay keywords', () => {
    expect(matchKeywords([], 'cualquier texto').matchPct).toBe(0);
    expect(matchKeywords([], 'cualquier texto').missing).toEqual([]);
  });

  it('analyzeOffer combina extracción y match', () => {
    const result = analyzeOffer(
      offers.frontendEs,
      'Desarrollador frontend con React, TypeScript, HTML, CSS y Git.',
    );

    expect(result.matched).toEqual(expect.arrayContaining(['react', 'typescript', 'html']));
    expect(result.matchPct).toBeGreaterThan(0);
  });
});
