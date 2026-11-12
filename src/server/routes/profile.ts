import type { FastifyInstance } from 'fastify';
import { ProfileSaveRequest } from '../../shared/schemas.js';
import type { AppDatabase } from '../db.js';
import { listDocumentsForProfile } from '../documents.js';
import { ProfileBuildError, type ProfileBuilder } from '../profile/buildProfile.js';
import { getStoredProfile, saveProfile } from '../profile/repository.js';
import { ProviderError } from '../providers/index.js';
import { getLlmSettings } from '../settings.js';

export function registerProfileRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  builder: ProfileBuilder,
): void {
  app.get('/api/profile', async () => {
    const stored = getStoredProfile(db);

    return {
      profile: stored?.profile ?? null,
      version: stored?.version ?? null,
      updatedAt: stored?.updatedAt ?? null,
    };
  });

  app.put('/api/profile', async (request, reply) => {
    const parsed = ProfileSaveRequest.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'El perfil no es válido. Revisá los campos marcados.',
      });
    }

    const stored = saveProfile(db, parsed.data.profile);

    return {
      profile: stored.profile,
      version: stored.version,
      updatedAt: stored.updatedAt,
    };
  });

  app.post('/api/profile/generate', async (_request, reply) => {
    const documents = listDocumentsForProfile(db);

    if (documents.length === 0) {
      return reply.code(400).send({
        error: 'Subí al menos un documento con texto antes de generar el perfil.',
      });
    }

    const settings = getLlmSettings(db);

    try {
      const profile = await builder.build({
        documents,
        model: {
          provider: settings.provider,
          model: settings.model,
          ...(settings.variant === undefined ? {} : { variant: settings.variant }),
        },
      });

      return { profile };
    } catch (error) {
      if (error instanceof ProfileBuildError) {
        return reply.code(400).send({ error: error.message });
      }

      if (error instanceof ProviderError) {
        return reply.code(502).send({ error: error.message });
      }

      throw error;
    }
  });
}
