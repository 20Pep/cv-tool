import { createReadStream, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { CreateApplicationRequest, PreviewApplicationRequest } from '../../shared/schemas.js';
import { createApplication, getApplication, listApplications } from '../applications.js';
import type { AppConfig } from '../config.js';
import type { AppDatabase } from '../db.js';
import { extractKeywords, matchKeywords } from '../generate/keywords.js';
import { buildCvTextForMatch, TailorError, type TailorService } from '../generate/tailor.js';
import { validateCoverLetter, validateTailoredCV } from '../generate/validate.js';
import { getStoredProfile } from '../profile/repository.js';
import { ProviderError } from '../providers/index.js';
import { renderApplicationPdfs } from '../render/pdf.js';
import { getLlmSettings } from '../settings.js';

export function registerApplicationRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  tailor: TailorService,
  config: AppConfig,
): void {
  app.get('/api/applications', async () => ({
    applications: listApplications(db),
  }));

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

  app.post('/api/applications', async (request, reply) => {
    const parsed = CreateApplicationRequest.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'La postulación no es válida. Revisá el CV, la carta, la empresa y el puesto.',
      });
    }

    const stored = getStoredProfile(db);

    if (stored === null) {
      return reply.code(400).send({
        error: 'Completá y guardá tu perfil maestro antes de guardar una postulación.',
      });
    }

    const cvIssues = validateTailoredCV(parsed.data.tailoredCv, stored.profile);
    const letterIssues = validateCoverLetter(
      parsed.data.coverLetter,
      `${JSON.stringify(stored.profile)}\n${parsed.data.jobText}`,
    );

    if (cvIssues.length > 0 || letterIssues.length > 0) {
      return reply.code(400).send({
        error: [...cvIssues, ...letterIssues].map((issue) => issue.message).join(' '),
      });
    }

    const offerKeywords = extractKeywords(parsed.data.jobText, { limit: 20 });
    const match = matchKeywords(
      offerKeywords,
      buildCvTextForMatch(stored.profile, parsed.data.tailoredCv),
    );
    const tailoredCv = {
      ...parsed.data.tailoredCv,
      keywordsUsed: match.matched,
      keywordsMissing: match.missing,
    };
    const rendered = await renderApplicationPdfs({
      profile: stored.profile,
      tailoredCv,
      coverLetter: parsed.data.coverLetter,
      company: parsed.data.company,
      position: parsed.data.position,
      jobText: parsed.data.jobText,
      outputsDir: config.outputsDir,
    });

    try {
      const application = createApplication(db, {
        company: parsed.data.company,
        position: parsed.data.position,
        ...(parsed.data.url === undefined ? {} : { url: parsed.data.url }),
        jobText: parsed.data.jobText,
        matchPct: match.matchPct,
        missingKeywords: match.missing,
        cvPath: rendered.cvFilename,
        letterPath: rendered.letterFilename,
        tailoredJson: JSON.stringify({
          tailoredCv,
          coverLetter: parsed.data.coverLetter,
          keywords: match,
        }),
      });

      return reply.code(201).send({ application });
    } catch (error) {
      await Promise.all([
        rm(path.join(config.outputsDir, rendered.cvFilename), { force: true }),
        rm(path.join(config.outputsDir, rendered.letterFilename), { force: true }),
      ]);
      throw error;
    }
  });

  app.get('/api/applications/:id/files/:kind', async (request, reply) => {
    const params = request.params as { id?: string; kind?: string };
    const id = Number(params.id);
    const kind = params.kind;

    if (!Number.isInteger(id) || id <= 0 || (kind !== 'cv' && kind !== 'letter')) {
      return reply.code(400).send({ error: 'El archivo solicitado no es válido.' });
    }

    const application = getApplication(db, id);

    if (application === null) {
      return reply.code(404).send({ error: 'La postulación no existe.' });
    }

    const filename = kind === 'cv' ? application.cvPath : application.letterPath;

    if (filename === null) {
      return reply.code(404).send({ error: 'El archivo no existe.' });
    }

    const outputsRoot = path.resolve(config.outputsDir);
    const filePath = path.resolve(outputsRoot, filename);

    if (!filePath.startsWith(`${outputsRoot}${path.sep}`) || !existsSync(filePath)) {
      return reply.code(404).send({ error: 'El archivo no existe.' });
    }

    return reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(createReadStream(filePath));
  });
}
