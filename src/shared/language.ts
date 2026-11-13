const SPANISH_MARKERS = new Set([
  'al',
  'como',
  'con',
  'del',
  'el',
  'en',
  'es',
  'esta',
  'las',
  'los',
  'más',
  'para',
  'pero',
  'por',
  'que',
  'se',
  'sin',
  'su',
  'una',
  'y',
  'ya',
]);

const ENGLISH_MARKERS = new Set([
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'of',
  'on',
  'or',
  'our',
  'the',
  'to',
  'we',
  'with',
  'you',
  'your',
]);

export type Language = 'es' | 'en';

export function detectLanguage(text: string): Language {
  const tokens = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);

  let spanish = 0;
  let english = 0;

  for (const token of tokens) {
    if (SPANISH_MARKERS.has(token)) {
      spanish += 1;
    } else if (ENGLISH_MARKERS.has(token)) {
      english += 1;
    }
  }

  return spanish >= english ? 'es' : 'en';
}
