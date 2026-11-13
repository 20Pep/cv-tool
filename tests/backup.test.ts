import { afterEach, describe, expect, it } from 'vitest';
import { SystemInfoResponse } from '../src/shared/schemas.js';
import { createTestContext, TEST_HOST, type TestContext } from './support.js';

let test: TestContext;

afterEach(async () => {
  await test.cleanup();
});

const authHeaders = () => ({ host: TEST_HOST, cookie: test.cookie });

describe('datos y copia de seguridad', () => {
  it('expone la ruta de la base y la carpeta de datos', async () => {
    test = await createTestContext();

    const response = await test.context.app.inject({
      method: 'GET',
      url: '/api/system',
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(200);
    const info = SystemInfoResponse.parse(response.json());
    expect(info.dataDir).toBe(test.dataDir);
    expect(info.dbPath.endsWith('cv.sqlite')).toBe(true);
    expect(info.isDev).toBe(true);
  });

  it('descarga una copia válida de SQLite', async () => {
    test = await createTestContext();

    const response = await test.context.app.inject({
      method: 'GET',
      url: '/api/backup',
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/vnd.sqlite3');
    expect(response.headers['content-disposition']).toMatch(
      /attachment; filename="cv-tool-backup-\d{4}-\d{2}-\d{2}\.sqlite"/,
    );
    expect(response.rawPayload.subarray(0, 16).toString('binary')).toBe('SQLite format 3\u0000');
  });

  it('exige sesión para la copia', async () => {
    test = await createTestContext();

    const response = await test.context.app.inject({
      method: 'GET',
      url: '/api/backup',
      headers: { host: TEST_HOST },
    });

    expect(response.statusCode).toBe(401);
  });
});
