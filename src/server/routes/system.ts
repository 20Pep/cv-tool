import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import type { AppDatabase } from '../db.js';

export function registerSystemRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  config: AppConfig,
): void {
  app.get('/api/system', async () => ({
    dataDir: config.dataDir,
    dbPath: config.dbPath,
    version: config.version,
    isDev: config.isDev,
  }));

  // Copia consistente de SQLite (incluye WAL) sin frenar la app. Los PDFs no
  // se incluyen: se pueden volver a generar desde la postulación guardada.
  app.get('/api/backup', async (_request, reply) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const temporaryPath = path.join(tmpdir(), `cv-tool-backup-${randomUUID()}.sqlite`);

    try {
      await db.backup(temporaryPath);
      const buffer = await readFile(temporaryPath);

      return reply
        .type('application/vnd.sqlite3')
        .header('Content-Disposition', `attachment; filename="cv-tool-backup-${stamp}.sqlite"`)
        .send(buffer);
    } catch {
      return reply
        .code(500)
        .send({ error: 'No pude generar la copia de seguridad. Probá de nuevo en un momento.' });
    } finally {
      await rm(temporaryPath, { force: true });
    }
  });
}
