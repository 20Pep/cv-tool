import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppContext, BuildAppOptions } from '../src/server/app.js';
import { buildApp } from '../src/server/app.js';
import { loadConfig } from '../src/server/config.js';
import { PACKAGE_ROOT } from '../src/server/paths.js';

export const TEST_HOST = '127.0.0.1:3000';

export interface TestContext {
  context: AppContext;
  cookie: string;
  dataDir: string;
  cleanup(): Promise<void>;
}

export async function createTestContext(options: BuildAppOptions = {}): Promise<TestContext> {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cvtool-test-'));
  const config = loadConfig({
    isDev: true,
    port: 3000,
    vitePort: 5173,
    dataDir,
    dbPath: path.join(dataDir, 'cv.sqlite'),
    migrationsDir: path.join(PACKAGE_ROOT, 'migrations'),
    webDistDir: path.join(dataDir, 'web'),
    sessionToken: 'session-test',
    launchToken: 'launch-test',
  });

  const context = await buildApp(config, options);
  const exchange = await context.app.inject({
    method: 'GET',
    url: '/?t=launch-test',
    headers: { host: TEST_HOST },
  });
  const setCookie = exchange.headers['set-cookie'];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const cookie = rawCookie?.split(';')[0] ?? '';

  return {
    context,
    cookie,
    dataDir,
    cleanup: async () => {
      await context.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

export function multipartBody(
  fields: Record<string, string>,
  file: { filename: string; contentType: string; content: Buffer },
): { body: Buffer; boundary: string } {
  const boundary = '----cvtool-test-boundary';
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
    ),
  );
  chunks.push(file.content);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return { body: Buffer.concat(chunks), boundary };
}

export async function uploadTextDocument(
  test: TestContext,
  input: { text: string; filename?: string; kind?: string },
) {
  const { body, boundary } = multipartBody(
    { kind: input.kind ?? 'cv' },
    {
      filename: input.filename ?? 'cv.txt',
      contentType: 'text/plain',
      content: Buffer.from(input.text, 'utf8'),
    },
  );

  return test.context.app.inject({
    method: 'POST',
    url: '/api/documents',
    headers: {
      host: TEST_HOST,
      cookie: test.cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
  });
}
