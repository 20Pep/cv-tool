import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance, LogController } from 'fastify';
import type { AppConfig } from './config.js';
import { type AppDatabase, openDatabase } from './db.js';
import {
  errorPage,
  hasValidSessionCookie,
  registerSecurity,
  safeEqual,
  setSessionCookie,
  webRedirectUrl,
} from './security.js';

export interface AppContext {
  app: FastifyInstance;
  db: AppDatabase;
  config: AppConfig;
  close(): Promise<void>;
}

export async function buildApp(config: AppConfig): Promise<AppContext> {
  for (const directory of [config.dataDir, config.uploadsDir, config.outputsDir]) {
    mkdirSync(directory, { recursive: true });
  }

  if (!config.isDev && !existsSync(config.webDistDir)) {
    throw new Error('No encontré dist/web. Ejecutá "npm run build" antes de iniciar cv-tool.');
  }

  const db = openDatabase(config.dbPath, config.migrationsDir);
  const app = Fastify({
    logger: false,
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: false,
    bodyLimit: 1024 * 1024,
  });

  await app.register(fastifyCookie);
  registerSecurity(app, config);
  registerTokenExchange(app, config);

  app.get('/api/health', async () => {
    db.prepare('SELECT 1').get();

    return {
      status: 'ok',
      version: config.version,
      database: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  });

  if (config.isDev) {
    app.get('/', async () => ({
      name: 'cv-tool',
      mode: 'development',
      web: config.webUrl,
    }));
  } else {
    await app.register(fastifyStatic, {
      root: path.join(config.webDistDir, 'assets'),
      prefix: '/assets/',
    });

    app.get('/', async (_request, reply) => reply.sendFile('index.html', config.webDistDir));
    app.get('/index.html', async (_request, reply) =>
      reply.sendFile('index.html', config.webDistDir),
    );
    app.get('/favicon.ico', async (_request, reply) => reply.code(204).send());

    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        return reply.sendFile('index.html', config.webDistDir);
      }

      return reply.code(404).send({ error: 'No encontrado.' });
    });
  }

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const status = error.statusCode ?? 500;

    if (status >= 500) {
      console.error(`[cv-tool] ${error.message}`);
    }

    return reply.code(status).send({
      error: status >= 500 ? 'Ocurrió un error en el servidor local.' : error.message,
    });
  });

  await app.ready();

  return {
    app,
    db,
    config,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}

function registerTokenExchange(app: FastifyInstance, config: AppConfig): void {
  let launchUsed = false;

  app.addHook('onRequest', async (request, reply) => {
    if (request.method !== 'GET') {
      return;
    }

    const url = new URL(request.url, 'http://127.0.0.1');

    if (url.pathname !== '/') {
      return;
    }

    const token = url.searchParams.get('t');
    if (token === null) {
      return;
    }

    if (hasValidSessionCookie(request, config.sessionToken)) {
      return reply.redirect(webRedirectUrl(request, config));
    }

    if (!launchUsed && safeEqual(token, config.launchToken)) {
      launchUsed = true;
      setSessionCookie(reply, config.sessionToken);
      return reply.redirect(webRedirectUrl(request, config));
    }

    return reply.code(401).type('text/html; charset=utf-8').send(errorPage());
  });
}
