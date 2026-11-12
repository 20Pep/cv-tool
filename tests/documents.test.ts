import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DeleteResponse,
  DocumentsResponse,
  UploadDocumentResponse,
} from '../src/shared/schemas.js';
import {
  createTestContext,
  multipartBody,
  TEST_HOST,
  type TestContext,
  uploadTextDocument,
} from './support.js';

let test: TestContext;

afterEach(async () => {
  await test.cleanup();
});

describe('API de documentos', () => {
  it('sube un TXT, extrae el texto, lo lista y lo elimina', async () => {
    test = await createTestContext();
    const upload = await uploadTextDocument(test, {
      text: 'Ana Pérez\nAnalista de datos con experiencia en SQL y Power BI.',
    });

    expect(upload.statusCode).toBe(201);
    const parsedUpload = UploadDocumentResponse.parse(upload.json());
    expect(parsedUpload.document.name).toBe('cv.txt');
    expect(parsedUpload.document.kind).toBe('cv');

    const list = await test.context.app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { host: TEST_HOST, cookie: test.cookie },
    });
    const parsedList = DocumentsResponse.parse(list.json());
    expect(parsedList.documents).toHaveLength(1);

    const row = test.context.db
      .prepare('SELECT path FROM documents WHERE id = ?')
      .get(parsedUpload.document.id) as { path: string };
    await access(path.join(test.context.config.uploadsDir, row.path));

    const removed = await test.context.app.inject({
      method: 'DELETE',
      url: `/api/documents/${parsedUpload.document.id}`,
      headers: { host: TEST_HOST, cookie: test.cookie },
    });
    expect(removed.statusCode).toBe(200);
    DeleteResponse.parse(removed.json());
    expect(await readdir(test.context.config.uploadsDir)).toEqual([]);
  });

  it('rechaza una extensión no permitida', async () => {
    test = await createTestContext();
    const { body, boundary } = multipartBody(
      { kind: 'cv' },
      {
        filename: 'virus.exe',
        contentType: 'application/octet-stream',
        content: Buffer.from('contenido suficiente para pasar la validación'),
      },
    );

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        host: TEST_HOST,
        cookie: test.cookie,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    expect(await readdir(test.context.config.uploadsDir)).toEqual([]);
  });

  it('rechaza un PDF con firma inválida', async () => {
    test = await createTestContext();
    const { body, boundary } = multipartBody(
      { kind: 'cv' },
      {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('esto no es un pdf pero tiene texto suficiente'),
      },
    );

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        host: TEST_HOST,
        cookie: test.cookie,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    expect(await readdir(test.context.config.uploadsDir)).toEqual([]);
  });

  it('rechaza un documento sin texto suficiente', async () => {
    test = await createTestContext();
    const response = await uploadTextDocument(test, { text: 'corto' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: expect.stringContaining('texto suficiente') });
  });

  it('rechaza un tipo de documento inválido', async () => {
    test = await createTestContext();
    const response = await uploadTextDocument(test, {
      text: 'Ana Pérez analista de datos con SQL y Power BI.',
      kind: 'inventado',
    });

    expect(response.statusCode).toBe(400);
  });

  it('exige sesión para subir documentos', async () => {
    test = await createTestContext();
    const { body, boundary } = multipartBody(
      { kind: 'cv' },
      {
        filename: 'cv.txt',
        contentType: 'text/plain',
        content: Buffer.from('Ana Pérez analista de datos con SQL y Power BI.'),
      },
    );

    const response = await test.context.app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        host: TEST_HOST,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(401);
  });
});
