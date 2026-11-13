import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it } from 'vitest';
import { createApplication } from '../src/server/applications.js';
import {
  ApplicationDetailResponse,
  ApplicationResponse,
  ApplicationsResponse,
} from '../src/shared/schemas.js';
import { createTestContext, TEST_HOST, type TestContext } from './support.js';

let test: TestContext;

afterEach(async () => {
  await test.cleanup();
});

const authHeaders = () => ({ host: TEST_HOST, cookie: test.cookie });

function seedApplication(): { id: number } {
  return createApplication(test.context.db, {
    company: 'Andes Market',
    position: 'Analista de Datos',
    url: 'https://example.com/oferta',
    jobText: 'Buscamos Analista de Datos con SQL, Power BI y Python.',
    matchPct: 69,
    missingKeywords: ['python'],
    cvPath: 'cv.pdf',
    letterPath: 'letter.pdf',
    tailoredJson: '{"tailoredCv":{}}',
  });
}

describe('tracker de postulaciones', () => {
  it('cambia de estado, guarda historial y sent_at', async () => {
    test = await createTestContext();
    const seeded = seedApplication();

    const response = await test.context.app.inject({
      method: 'PATCH',
      url: `/api/applications/${seeded.id}`,
      headers: authHeaders(),
      payload: { status: 'sent', notes: 'Enviada por el portal' },
    });

    expect(response.statusCode).toBe(200);
    const application = ApplicationResponse.parse(response.json()).application;
    expect(application.status).toBe('sent');
    expect(application.sentAt).not.toBeNull();
    expect(application.notes).toBe('Enviada por el portal');

    const detail = await test.context.app.inject({
      method: 'GET',
      url: `/api/applications/${seeded.id}`,
      headers: authHeaders(),
    });
    const parsed = ApplicationDetailResponse.parse(detail.json());
    expect(parsed.history).toHaveLength(2);
    expect(parsed.history[1]?.status).toBe('sent');
    expect(parsed.history[1]?.note).toBe('Enviada por el portal');
    expect(parsed.application.jobText).toContain('Power BI');
  });

  it('guarda notas sin agregar historial si no cambia el estado', async () => {
    test = await createTestContext();
    const seeded = seedApplication();

    await test.context.app.inject({
      method: 'PATCH',
      url: `/api/applications/${seeded.id}`,
      headers: authHeaders(),
      payload: { status: 'interview', notes: 'Primera entrevista' },
    });
    const response = await test.context.app.inject({
      method: 'PATCH',
      url: `/api/applications/${seeded.id}`,
      headers: authHeaders(),
      payload: { notes: 'Preparar casos' },
    });

    expect(response.statusCode).toBe(200);
    expect(ApplicationResponse.parse(response.json()).application.notes).toBe('Preparar casos');

    const detail = await test.context.app.inject({
      method: 'GET',
      url: `/api/applications/${seeded.id}`,
      headers: authHeaders(),
    });
    expect(ApplicationDetailResponse.parse(detail.json()).history).toHaveLength(2);
  });

  it('filtra por estado y texto', async () => {
    test = await createTestContext();
    const first = seedApplication();
    createApplication(test.context.db, {
      company: 'Otra Empresa',
      position: 'Backend Engineer',
      jobText: 'Buscamos Backend Engineer con Node.js.',
      matchPct: 40,
      missingKeywords: [],
      cvPath: 'cv2.pdf',
      letterPath: 'letter2.pdf',
      tailoredJson: '{}',
    });
    await test.context.app.inject({
      method: 'PATCH',
      url: `/api/applications/${first.id}`,
      headers: authHeaders(),
      payload: { status: 'sent' },
    });

    const sent = await test.context.app.inject({
      method: 'GET',
      url: '/api/applications?status=sent',
      headers: authHeaders(),
    });
    expect(ApplicationsResponse.parse(sent.json()).applications).toHaveLength(1);

    const search = await test.context.app.inject({
      method: 'GET',
      url: '/api/applications?q=Andes',
      headers: authHeaders(),
    });
    expect(ApplicationsResponse.parse(search.json()).applications).toHaveLength(1);

    const none = await test.context.app.inject({
      method: 'GET',
      url: '/api/applications?status=interview',
      headers: authHeaders(),
    });
    expect(ApplicationsResponse.parse(none.json()).applications).toHaveLength(0);
  });

  it('rechaza un estado inválido', async () => {
    test = await createTestContext();
    const seeded = seedApplication();

    const response = await test.context.app.inject({
      method: 'PATCH',
      url: `/api/applications/${seeded.id}`,
      headers: authHeaders(),
      payload: { status: 'inventado' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('exporta el tracker a Excel', async () => {
    test = await createTestContext();
    seedApplication();

    const response = await test.context.app.inject({
      method: 'GET',
      url: '/api/export/xlsx',
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(response.rawPayload.subarray(0, 2).toString()).toBe('PK');
  });

  it('exporta solo las postulaciones filtradas que manda la interfaz', async () => {
    test = await createTestContext();
    seedApplication();
    const other = createApplication(test.context.db, {
      company: 'Otra Empresa',
      position: 'Backend Engineer',
      jobText: 'Buscamos Backend Engineer con Node.js.',
      matchPct: 40,
      missingKeywords: [],
      cvPath: 'cv2.pdf',
      letterPath: 'letter2.pdf',
      tailoredJson: '{}',
    });

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/export/xlsx',
      headers: authHeaders(),
      payload: { ids: [other.id] },
    });

    expect(response.statusCode).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.rawPayload as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet('Postulaciones');
    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.getRow(2).getCell(1).value).toBe('Otra Empresa');
  });

  it('rechaza ids de exportación inválidos', async () => {
    test = await createTestContext();

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/export/xlsx',
      headers: authHeaders(),
      payload: { ids: ['uno'] },
    });

    expect(response.statusCode).toBe(400);
  });
});
