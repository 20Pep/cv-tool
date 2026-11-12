import type { FastifyInstance } from 'fastify';
import { PreviewApplicationRequest } from '../../shared/schemas.js';
import type { AppDatabase } from '../db.js';
import { TailorError, type TailorService } from '../generate/tailor.js';
import { getStoredProfile } from '../profile/repository.js';
import { ProviderError } from '../providers/index.js';
import { getLlmSettings } from '../settings.js';

export function registerApplicationRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  tailor: TailorService,
): void {
  app.post('/api/applications/preview', async (request, reply) => {
    const parsed = PreviewApplicationRequest.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'La oferta no es válida. Pegá el texto completo de la oferta.',
      });
    }

    const stored = getStoredProfile(db);

    if (stored === null) {
      return reply.code(400).send({
        error: 'Completá y guardá tu perfil maestro antes de generar una postulación.',
      });
    }

    const settings = getLlmSettings(db);

    try {
      return await tailor.preview({
        profile: stored.profile,
        offerText: parsed.data.offerText,
        ...(parsed.data.draftText === undefined || parsed.data.draftText.trim().length === 0
          ? {}
          : { draftText: parsed.data.draftText }),
        model: {
          provider: settings.provider,
          model: settings.model,
          ...(settings.variant === undefined ? {} : { variant: settings.variant }),
        },
      });
    } catch (error) {
      if (error instanceof TailorError) {
        return reply.code(400).send({ error: error.message });
      }

      if (error instanceof ProviderError) {
        return reply.code(502).send({ error: error.message });
      }

      throw error;
    }
  });
}
