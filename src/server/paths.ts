import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Encuentra la raíz del paquete caminando hacia arriba desde este archivo.
 * Funciona en src/ (dev), en dist/ (build) y dentro de node_modules (npx).
 */
export function findPackageRoot(start = path.dirname(fileURLToPath(import.meta.url))): string {
  let current = start;

  while (true) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('No pude encontrar la raíz del paquete cv-tool.');
    }

    current = parent;
  }
}

export const PACKAGE_ROOT = findPackageRoot();

export function readPackageVersion(): string {
  const raw = readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    typeof parsed.version !== 'string'
  ) {
    throw new Error('package.json no tiene una versión válida.');
  }

  return parsed.version;
}
