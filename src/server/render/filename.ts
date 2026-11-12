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
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLength)
    .replace(/_+$/g, '');
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
    base = base.slice(0, MAX_BASE_LENGTH).replace(/_+$/g, '');
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
