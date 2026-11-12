import { existsSync } from 'node:fs';
import path from 'node:path';

export type PdfKind = 'cv' | 'letter';

export interface FilenameInput {
  fullName: string;
  position: string;
}

const RESERVED_WINDOWS_NAME = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
const MAX_BASE_LENGTH = 88;

export function sanitizeFilenamePart(value: string, maxLength = 30): string {
  const withoutGenderMarkers = removeGenderMarkers(value);

  return truncateAtWordBoundary(
    withoutGenderMarkers
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
    maxLength,
  );
}

/**
 * Quita los marcadores de género escritos con barra ("Desarrollador/a",
 * "Analista/o"): en el nombre de archivo quedan feos como guion bajo
 * ("Desarrollador_a") y no aportan información. Slashes técnicas como "CI/CD"
 * no se tocan (no siguen el patrón letra + a/o/as/os/e/x).
 */
function removeGenderMarkers(value: string): string {
  return value.replace(/([a-zA-ZÁÉÍÓÚÑáéíóúñ])\/(?:a|o|as|os|e|x)\b/g, '$1');
}

/** Corta en el último separador antes del límite, sin partir palabras. */
function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const lastSeparator = value.lastIndexOf('_', maxLength - 1);

  return (lastSeparator > 0 ? value.slice(0, lastSeparator) : value.slice(0, maxLength)).replace(
    /_+$/g,
    '',
  );
}

export function buildPdfFilename(input: FilenameInput, kind: PdfKind): string {
  // Nombre completo: no se pierden apellidos compuestos ("Pedro Espejo Pariani"
  // debe quedar Pedro_Espejo_Pariani, no Pedro_Pariani).
  const name = sanitizeFilenamePart(input.fullName, 60);
  const pieces = [name, input.position]
    .map((part) => sanitizeFilenamePart(part))
    .filter((part) => part.length > 0);

  let base = pieces.join('_');

  if (base.length === 0) {
    base = 'CV';
  }

  if (base.length > MAX_BASE_LENGTH) {
    base = truncateAtWordBoundary(base, MAX_BASE_LENGTH);
  }

  if (RESERVED_WINDOWS_NAME.test(base)) {
    base = `CV_${base}`;
  }

  return `${base}_${kind === 'letter' ? 'Carta' : 'CV'}.pdf`;
}

export function uniqueFilename(directory: string, filename: string): string {
  if (!existsSync(path.join(directory, filename))) {
    return filename;
  }

  const extension = path.extname(filename);
  const base = filename.slice(0, filename.length - extension.length);

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}_${index}${extension}`;

    if (!existsSync(path.join(directory, candidate))) {
      return candidate;
    }
  }

  throw new Error('No pude encontrar un nombre de archivo libre.');
}
