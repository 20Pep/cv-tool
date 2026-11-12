import { readFileSync } from 'node:fs';
import { Document, Page, renderToBuffer, Text } from '@react-pdf/renderer';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  extractTextFromBuffer,
  hasValidSignature,
  IngestError,
  isAllowedDocument,
} from '../src/server/ingest/extract.js';

describe('ingest de documentos', () => {
  it('extrae texto de un TXT', async () => {
    const result = await extractTextFromBuffer(
      Buffer.from('Ana Pérez\nAnalista de datos con experiencia en SQL y Power BI.', 'utf8'),
      'cv.txt',
    );

    expect(result.text).toContain('Ana Pérez');
    expect(result.text).toContain('Power BI');
  });

  it('extrae texto de un PDF generado', async () => {
    const pdf = await renderToBuffer(
      createElement(
        Document,
        null,
        createElement(
          Page,
          { size: 'A4' },
          createElement(Text, null, 'Ana Perez analista de datos con SQL y Power BI'),
        ),
      ),
    );

    const result = await extractTextFromBuffer(Buffer.from(pdf), 'cv.pdf');

    expect(result.pages).toBe(1);
    expect(result.text).toContain('Ana Perez');
  });

  it('extrae texto de un DOCX', async () => {
    const buffer = readFileSync(
      new URL('../fixtures/documents/ana-perez-cv.docx', import.meta.url),
    );
    const result = await extractTextFromBuffer(buffer, 'ana-perez-cv.docx');

    expect(result.text).toContain('Ana Pérez');
    expect(result.text).toContain('Power BI');
  });

  it('rechaza contenido que no coincide con la extensión', async () => {
    await expect(
      extractTextFromBuffer(Buffer.from('esto no es un pdf'), 'cv.pdf'),
    ).rejects.toBeInstanceOf(IngestError);
  });

  it('rechaza un PDF escaneado o sin texto suficiente', async () => {
    await expect(extractTextFromBuffer(Buffer.from('corto'), 'cv.txt')).rejects.toThrow(
      /no tiene texto suficiente/,
    );
  });

  it('rechaza extensiones no permitidas', async () => {
    await expect(
      extractTextFromBuffer(Buffer.from('contenido suficiente para pasar'), 'cv.exe'),
    ).rejects.toThrow(/Formato no soportado/);
  });

  it('valida extensiones y firmas', () => {
    expect(isAllowedDocument('cv.PDF')).toBe(true);
    expect(isAllowedDocument('cv.docx')).toBe(true);
    expect(isAllowedDocument('cv.exe')).toBe(false);
    expect(hasValidSignature(Buffer.from('%PDF-1.7'), 'cv.pdf')).toBe(true);
    expect(hasValidSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'cv.docx')).toBe(true);
    expect(hasValidSignature(Buffer.from('texto'), 'cv.pdf')).toBe(false);
  });
});
