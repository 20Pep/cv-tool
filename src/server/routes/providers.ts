import type { FastifyInstance } from 'fastify';
import { SettingsUpdate, TestConnectionRequest } from '../../shared/schemas.js';
import type { AppDatabase } from '../db.js';
import type { ProviderService } from '../providers/service.js';
import { getLlmSettings, saveLlmSettings } from '../settings.js';

export function registerProviderRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  service: ProviderService,
): void {
  app.get('/api/providers', async () => service.getProviders(getLlmSettings(db)));

  app.get('/api/settings', async () => ({ llm: getLlmSettings(db) }));

  app.put('/api/settings', async (request, reply) => {
    const parsed = SettingsUpdate.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Los ajustes no son válidos.' });
    }

    return { llm: saveLlmSettings(db, parsed.data.llm) };
  });

  app.post('/api/providers/test', async (request, reply) => {
    const parsed = TestConnectionRequest.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Elegí un proveedor y un modelo válidos.' });
    }

    return service.testConnection(parsed.data);
  });
}
