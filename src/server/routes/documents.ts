import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { DocumentKind } from '../../shared/schemas.js';
import type { AppConfig } from '../config.js';
import type { AppDatabase } from '../db.js';
import { deleteDocumentRow, getDocument, insertDocument, listDocuments } from '../documents.js';
import {
  extractTextFromBuffer,
  hasValidSignature,
  IngestError,
  isAllowedDocument,
} from '../ingest/extract.js';

export function registerDocumentRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  config: AppConfig,
): void {
  app.get('/api/documents', async () => ({ documents: listDocuments(db) }));

  app.post('/api/documents', async (request, reply) => {
    if (!request.isMultipart()) {
      return reply.code(415).send({ error: 'Enviá el archivo como multipart/form-data.' });
    }

    let kind: DocumentKind = 'cv';
    let originalName = '';
    let storedName = '';
    let tempPath = '';

    try {
      const parts = request.parts();

      for await (const part of parts) {
        if (part.type === 'file') {
          if (storedName !== '') {
            part.file.resume();
            throw new IngestError('Subí un solo archivo por vez.');
          }

          originalName = sanitizeFilename(part.filename);

          if (!isAllowedDocument(originalName)) {
            part.file.resume();
            throw new IngestError('Formato no soportado. Usá PDF, DOCX, TXT o MD.');
          }

          const extension = path.extname(originalName).toLowerCase();
          storedName = `${randomUUID()}${extension}`;
          tempPath = path.join(config.uploadsDir, storedName);

          await pipeline(part.file, createWriteStream(tempPath, { flags: 'wx' }));

          if (part.file.truncated) {
            throw new IngestError('El archivo supera el límite de 10 MB.');
          }

          continue;
        }

        if (part.fieldname === 'kind') {
          const parsed = DocumentKind.safeParse(part.value);

          if (!parsed.success) {
            throw new IngestError('El tipo de documento no es válido.');
          }

          kind = parsed.data;
        }
      }

      if (storedName === '') {
        throw new IngestError('No recibí ningún archivo.');
      }

      const buffer = await readFile(tempPath);

      if (!hasValidSignature(buffer, originalName)) {
        throw new IngestError(
          'El contenido del archivo no coincide con su extensión. Revisá el archivo.',
        );
      }

      const extracted = await extractTextFromBuffer(buffer, originalName);
      const document = insertDocument(db, {
        name: originalName,
        kind,
        path: storedName,
        extractedText: extracted.text,
      });

      return reply.code(201).send({ document });
    } catch (error) {
      if (tempPath.length > 0) {
        await rm(tempPath, { force: true });
      }

      if (error instanceof IngestError) {
        return reply.code(400).send({ error: error.message });
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'FST_REQ_FILE_TOO_LARGE'
      ) {
        return reply.code(413).send({ error: 'El archivo supera el límite de 10 MB.' });
      }

      throw error;
    }
  });

  app.delete('/api/documents/:id', async (request, reply) => {
    const params = request.params as { id?: string };
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'El documento no es válido.' });
    }

    const document = getDocument(db, id);

    if (document === null) {
      return reply.code(404).send({ error: 'El documento no existe.' });
    }

    const uploadsRoot = path.resolve(config.uploadsDir);
    const filePath = path.resolve(uploadsRoot, document.path);

    if (filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
      await rm(filePath, { force: true });
    }

    deleteDocumentRow(db, id);

    return { ok: true };
  });
}

function sanitizeFilename(filename: string): string {
  const base = path
    .basename(filename)
    .replace(/\p{Cc}/gu, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();

  return (base.length === 0 ? 'documento' : base).slice(0, 180);
}
