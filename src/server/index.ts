import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { type AppConfig, loadConfig } from './config.js';
import type { AppDatabase } from './db.js';

export interface ServerHandle {
  app: FastifyInstance;
  db: AppDatabase;
  config: AppConfig;
  url: string;
  launchUrl: string;
  close(): Promise<void>;
}

export async function startServer(overrides: Partial<AppConfig> = {}): Promise<ServerHandle> {
  const config = loadConfig(overrides);
  const context = await buildApp(config);

  try {
    await context.app.listen({ host: config.host, port: config.port });
  } catch (error) {
    await context.close();

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'EADDRINUSE'
    ) {
      throw new Error(
        `El puerto ${config.port} está ocupado. Cerrá la otra instancia o usá CVTOOL_PORT.`,
      );
    }

    throw error;
  }

  const url = `http://127.0.0.1:${config.port}`;
  const launchUrl = `${url}/?t=${encodeURIComponent(config.launchToken)}`;

  return {
    ...context,
    url,
    launchUrl,
  };
}
