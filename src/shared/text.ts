/**
 * Normaliza texto para comparar skills/verbos sin depender de mayúsculas,
 * acentos o espacios repetidos.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
