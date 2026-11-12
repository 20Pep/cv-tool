import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectOfferMeta } from '../src/server/generate/tailor.js';

const readOffer = (name: string): string =>
  readFileSync(new URL(`../fixtures/offers/${name}.md`, import.meta.url), 'utf8');

describe('detectOfferMeta', () => {
  it('extrae el puesto de frases de introducción largas', () => {
    const offer = readOffer('analista-ia-es');
    const meta = detectOfferMeta(offer);

    expect(meta.suggestedPosition).toBe('Analista de Datos con orientación a IA');
    expect(meta.suggestedCompany).toBe('Talento & Datos');
  });

  it('no devuelve un puesto de más de 60 caracteres', () => {
    const longLine =
      'Desde una consultora nos encontramos en la búsqueda de un/a Desarrollador/a Backend con orientación a inteligencia artificial y tecnologías emergentes para incorporarse a una organización.';

    const meta = detectOfferMeta(longLine);

    expect(meta.suggestedPosition.length).toBeLessThanOrEqual(60);
  });

  it('prioriza los campos explícitos del texto', () => {
    const meta = detectOfferMeta(
      '**Empresa:** Andes Market (ficticia)\n**Puesto:** Analista de Datos',
    );

    expect(meta.suggestedCompany).toBe('Andes Market');
    expect(meta.suggestedPosition).toBe('Analista de Datos');
  });

  it('usa una encabezado markdown como puesto', () => {
    const meta = detectOfferMeta('# Analista de Datos\n\nTrabajo remoto.');

    expect(meta.suggestedPosition).toBe('Analista de Datos');
  });
});
