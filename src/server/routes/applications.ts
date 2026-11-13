import { createReadStream, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { extractKeywords, matchKeywords } from '../../shared/keywords.js';
import { detectLanguage } from '../../shared/language.js';
import {
  ApplicationStatus,
  CreateApplicationRequest,
  ExportApplicationsRequest,
  PreviewApplicationRequest,
  RenderPdfRequest,
  UpdateApplicationRequest,
} from '../../shared/schemas.js';
import { validateCoverLetter, validateTailoredCV } from '../../shared/validate.js';
import {
  createApplication,
  deleteApplication,
  getApplication,
  getApplicationHistory,
  listApplications,
  updateApplication,
} from '../applications.js';
import type { AppConfig } from '../config.js';
import type { AppDatabase } from '../db.js';
import { buildApplicationsWorkbook } from '../export/xlsx.js';
import {
  buildCvTextForMatch,
  detectOfferMeta,
  TailorError,
  type TailorService,
} from '../generate/tailor.js';
import { getStoredProfile } from '../profile/repository.js';
import { ProviderError } from '../providers/index.js';
import { buildPdfFilename } from '../render/filename.js';
import { renderApplicationPdfs, renderCvPdf, renderLetterPdf } from '../render/pdf.js';
import { getLlmSettings } from '../settings.js';

export function registerApplicationRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  tailor: TailorService,
  config: AppConfig,
): void {
  app.get('/api/applications', async (request, reply) => {
    const query = request.query as { status?: string; q?: string };
    let status: ApplicationStatus | undefined;

    if (query.status !== undefined && query.status.length > 0) {
      const parsed = ApplicationStatus.safeParse(query.status);

      if (!parsed.success) {
        return reply.code(400).send({ error: 'El estado del filtro no es válido.' });
      }

      status = parsed.data;
    }

    return {
      applications: listApplications(db, {
        ...(status === undefined ? {} : { status }),
        ...(query.q === undefined ? {} : { query: query.q }),
      }),
    };
  });

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
        fidelity: settings.fidelity ?? 'enhanced',
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
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path.join('.');
      const detail = firstIssue?.message;

      return reply.code(400).send({
        error: `La postulación no es válida${field ? ` en ${field}` : ''}: ${detail ?? 'Revisá el CV y la carta.'}`,
      });
    }

    const stored = getStoredProfile(db);

    if (stored === null) {
      return reply.code(400).send({
        error: 'Completá y guardá tu perfil maestro antes de guardar una postulación.',
      });
    }

    const cvIssues = validateTailoredCV(parsed.data.tailoredCv, stored.profile, {
      fidelity: getLlmSettings(db).fidelity ?? 'enhanced',
    });
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
    const meta = detectOfferMeta(parsed.data.jobText);
    const company = parsed.data.company?.trim() || meta.suggestedCompany || 'Empresa no indicada';
    const position = parsed.data.position?.trim() || meta.suggestedPosition || 'Puesto no indicado';
    const rendered = await renderApplicationPdfs({
      profile: stored.profile,
      tailoredCv,
      coverLetter: parsed.data.coverLetter,
      company,
      position,
      jobText: parsed.data.jobText,
      outputsDir: config.outputsDir,
    });

    try {
      const application = createApplication(db, {
        company,
        position,
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

  app.post('/api/applications/render', async (request, reply) => {
    const parsed = RenderPdfRequest.safeParse(request.body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path.join('.');

      return reply.code(400).send({
        error: `No pude generar el PDF${field ? ` en ${field}` : ''}: ${
          firstIssue?.message ?? 'revisá el CV y la carta.'
        }`,
      });
    }

    const stored = getStoredProfile(db);

    if (stored === null) {
      return reply.code(400).send({
        error: 'Completá y guardá tu perfil maestro antes de descargar el PDF.',
      });
    }

    const cvIssues = validateTailoredCV(parsed.data.tailoredCv, stored.profile, {
      fidelity: getLlmSettings(db).fidelity ?? 'enhanced',
    });
    const letterIssues = validateCoverLetter(
      parsed.data.coverLetter,
      `${JSON.stringify(stored.profile)}\n${parsed.data.jobText}`,
    );

    if (cvIssues.length > 0 || letterIssues.length > 0) {
      return reply.code(400).send({
        error: [...cvIssues, ...letterIssues].map((issue) => issue.message).join(' '),
      });
    }

    const language = detectLanguage(parsed.data.jobText);
    const meta = detectOfferMeta(parsed.data.jobText);
    const company = parsed.data.company?.trim() || meta.suggestedCompany || 'Empresa no indicada';
    const position = parsed.data.position?.trim() || meta.suggestedPosition || 'Puesto no indicado';
    const fullName = stored.profile.basics.fullName;

    try {
      const buffer =
        parsed.data.kind === 'cv'
          ? await renderCvPdf(stored.profile, parsed.data.tailoredCv, language)
          : await renderLetterPdf(
              stored.profile,
              parsed.data.coverLetter,
              language,
              company,
              position,
            );

      return reply
        .type('application/pdf')
        .header(
          'Content-Disposition',
          `attachment; filename="${buildPdfFilename({ fullName, position }, parsed.data.kind)}"`,
        )
        .send(buffer);
    } catch {
      return reply
        .code(500)
        .send({ error: 'No pude generar el PDF. Probá de nuevo en un momento.' });
    }
  });

  app.get('/api/export/xlsx', async (_request, reply) => {
    const buffer = await buildApplicationsWorkbook(listApplications(db));

    return sendWorkbook(reply, buffer);
  });

  // Exporta solo lo que la persona ve: el cliente manda los ids ya filtrados
  // (estado, búsqueda y rango de fechas) y el servidor no reinterpreta fechas.
  app.post('/api/export/xlsx', async (request, reply) => {
    const parsed = ExportApplicationsRequest.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Los filtros de exportación no son válidos.' });
    }

    const applications = listApplications(db);
    const ids = parsed.data.ids;
    const selected = ids === undefined ? null : new Set(ids);

    return sendWorkbook(
      reply,
      await buildApplicationsWorkbook(
        selected === null ? applications : applications.filter((item) => selected.has(item.id)),
      ),
    );
  });

  app.get('/api/applications/:id', async (request, reply) => {
    const params = request.params as { id?: string };
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'La postulación no es válida.' });
    }

    const application = getApplication(db, id);

    if (application === null) {
      return reply.code(404).send({ error: 'La postulación no existe.' });
    }

    const { tailoredJson: _tailoredJson, ...detail } = application;

    return {
      application: detail,
      history: getApplicationHistory(db, id),
    };
  });

  app.patch('/api/applications/:id', async (request, reply) => {
    const params = request.params as { id?: string };
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'La postulación no es válida.' });
    }

    const parsed = UpdateApplicationRequest.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Los cambios no son válidos.' });
    }

    const updated = updateApplication(db, id, parsed.data);

    if (updated === null) {
      return reply.code(404).send({ error: 'La postulación no existe.' });
    }

    return { application: updated };
  });

  app.delete('/api/applications/:id', async (request, reply) => {
    const params = request.params as { id?: string };
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'La postulación no es válida.' });
    }

    const deleted = deleteApplication(db, id);

    if (deleted === null) {
      return reply.code(404).send({ error: 'La postulación no existe.' });
    }

    await Promise.all([
      deleted.cvPath === null
        ? undefined
        : rm(path.join(config.outputsDir, deleted.cvPath), { force: true }),
      deleted.letterPath === null
        ? undefined
        : rm(path.join(config.outputsDir, deleted.letterPath), { force: true }),
    ]);

    return { ok: true };
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

function sendWorkbook(reply: FastifyReply, buffer: Buffer) {
  return reply
    .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', 'attachment; filename="cv-tool-postulaciones.xlsx"')
    .send(buffer);
}
