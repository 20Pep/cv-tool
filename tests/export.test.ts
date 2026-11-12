import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildApplicationsWorkbook } from '../src/server/export/xlsx.js';
import type { ApplicationInfo } from '../src/shared/schemas.js';

const application: ApplicationInfo = {
  id: 1,
  company: 'Andes Market',
  position: 'Analista de Datos',
  url: 'https://example.com/oferta',
  status: 'sent',
  sentAt: '2026-11-10 00:00:00',
  matchPct: 69,
  missingKeywords: ['python', 'tableau'],
  cvPath: 'cv.pdf',
  letterPath: 'letter.pdf',
  notes: 'Enviada por el portal',
  createdAt: '2026-11-10 00:00:00',
  updatedAt: '2026-11-10 00:00:00',
};

describe('exportación a Excel', () => {
  it('genera un workbook con encabezados y datos', async () => {
    const buffer = await buildApplicationsWorkbook([application], new Date('2026-11-12T00:00:00Z'));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet('Postulaciones');

    expect(sheet).toBeDefined();
    expect(sheet?.getRow(1).getCell(1).value).toBe('Empresa');
    expect(sheet?.getRow(2).getCell(1).value).toBe('Andes Market');
    expect(sheet?.getRow(2).getCell(3).value).toBe('Enviada');
    expect(sheet?.getRow(2).getCell(5).value).toBe(2);
    expect(sheet?.getRow(2).getCell(6).value).toBe(69);
    expect(sheet?.getRow(2).getCell(8).value).toBe('python, tableau');
  });
});
