import { randomBytes } from 'node:crypto';
import path from 'node:path';
import envPaths from 'env-paths';
import { PACKAGE_ROOT, readPackageVersion } from './paths.js';

export interface AppConfig {
  host: '127.0.0.1';
  port: number;
  vitePort: number;
  isDev: boolean;
  dataDir: string;
  dbPath: string;
  uploadsDir: string;
  outputsDir: string;
  migrationsDir: string;
  webDistDir: string;
  webUrl: string;
  version: string;
  sessionToken: string;
  launchToken: string;
}

export type ConfigOverrides = Partial<AppConfig>;

export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
  const isDev = overrides.isDev ?? process.env.NODE_ENV === 'development';
  const port = overrides.port ?? parsePort(process.env.CVTOOL_PORT, 3000, 'CVTOOL_PORT');
  const vitePort =
    overrides.vitePort ?? parsePort(process.env.CVTOOL_VITE_PORT, 5173, 'CVTOOL_VITE_PORT');

  const defaultDataDir = isDev
    ? path.join(PACKAGE_ROOT, 'data')
    : envPaths('cv-tool', { suffix: '' }).data;
  const dataDir = path.resolve(overrides.dataDir ?? process.env.CVTOOL_DATA_DIR ?? defaultDataDir);

  return {
    host: '127.0.0.1',
    port,
    vitePort,
    isDev,
    dataDir,
    dbPath: overrides.dbPath ?? path.join(dataDir, 'cv.sqlite'),
    uploadsDir: overrides.uploadsDir ?? path.join(dataDir, 'uploads'),
    outputsDir: overrides.outputsDir ?? path.join(dataDir, 'outputs'),
    migrationsDir: overrides.migrationsDir ?? path.join(PACKAGE_ROOT, 'migrations'),
    webDistDir: overrides.webDistDir ?? path.join(PACKAGE_ROOT, 'dist', 'web'),
    webUrl: overrides.webUrl ?? (isDev ? `http://127.0.0.1:${vitePort}/` : '/'),
    version: overrides.version ?? readPackageVersion(),
    sessionToken:
      overrides.sessionToken ??
      process.env.CVTOOL_SESSION_TOKEN ??
      randomBytes(32).toString('base64url'),
    launchToken:
      overrides.launchToken ??
      process.env.CVTOOL_LAUNCH_TOKEN ??
      randomBytes(32).toString('base64url'),
  };
}

function parsePort(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.length === 0) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} debe ser un puerto entre 1 y 65535.`);
  }

  return value;
}
