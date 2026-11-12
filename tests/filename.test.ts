import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildPdfFilename,
  sanitizeFilenamePart,
  uniqueFilename,
} from '../src/server/render/filename.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('filename', () => {
  it('normaliza acentos y caracteres especiales', () => {
    expect(sanitizeFilenamePart('Ana Pérez / Data & Analytics')).toBe('Ana_Perez_Data_Analytics');
  });

  it('mantiene los apellidos compuestos del nombre completo', () => {
    const input = {
      fullName: 'Pedro Espejo Pariani',
      position: 'Desarrollador Backend',
      company: 'Andes Market',
    };

    expect(buildPdfFilename(input, 'cv')).toBe(
      'Pedro_Espejo_Pariani_Desarrollador_Backend_Andes_Market.pdf',
    );
  });

  it('arma el nombre del CV y de la carta', () => {
    const input = {
      fullName: 'Ana Pérez',
      position: 'Analista de Datos',
      company: 'Andes Market',
    };

    expect(buildPdfFilename(input, 'cv')).toBe('Ana_Perez_Analista_de_Datos_Andes_Market.pdf');
    expect(buildPdfFilename(input, 'letter')).toBe(
      'Ana_Perez_Analista_de_Datos_Andes_Market_Carta.pdf',
    );
  });

  it('evita nombres reservados de Windows', () => {
    expect(buildPdfFilename({ fullName: 'CON', position: '', company: '' }, 'cv')).toBe(
      'CV_CON.pdf',
    );
  });

  it('limita el largo del nombre', () => {
    const filename = buildPdfFilename(
      {
        fullName: 'Ana Pérez',
        position: 'Analista de Datos con un puesto extremadamente largo',
        company: 'Una empresa con un nombre larguísimo',
      },
      'letter',
    );

    expect(filename.length).toBeLessThanOrEqual(100);
    expect(filename.endsWith('.pdf')).toBe(true);
  });

  it('resuelve colisiones con sufijo', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'cvtool-filenames-'));
    tempDirs.push(directory);

    await writeFile(path.join(directory, 'cv.pdf'), 'x');

    expect(uniqueFilename(directory, 'cv.pdf')).toBe('cv_2.pdf');
    await writeFile(path.join(directory, 'cv_2.pdf'), 'x');
    expect(uniqueFilename(directory, 'cv.pdf')).toBe('cv_3.pdf');
  });
});
