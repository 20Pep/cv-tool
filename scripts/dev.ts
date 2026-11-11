process.env.NODE_ENV = 'development';

const { startServer } = await import('../src/server/index.js');
const { openBrowser } = await import('../src/server/openBrowser.js');
const { createServer: createViteServer } = await import('vite');

const server = await startServer({ isDev: true });
let vite: Awaited<ReturnType<typeof createViteServer>>;

try {
  vite = await createViteServer({ configFile: 'vite.config.ts' });
  await vite.listen();
} catch (error) {
  await server.close();
  throw error;
}

const viteUrl = vite.resolvedUrls?.local[0] ?? `http://127.0.0.1:${server.config.vitePort}/`;

console.log(`API: ${server.url}`);
console.log(`Web: ${viteUrl}`);
openBrowser(server.launchUrl);

let closing = false;
const shutdown = async () => {
  if (closing) {
    return;
  }

  closing = true;

  try {
    await vite.close();
  } catch {
    // La instancia de Vite ya puede estar cerrada.
  }

  try {
    await server.close();
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

export {};
