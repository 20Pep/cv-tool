#!/usr/bin/env node
process.env.NODE_ENV = 'production';

try {
  const { startServer } = await import('../dist/server/server/index.js');
  const { openBrowser } = await import('../dist/server/server/openBrowser.js');

  const server = await startServer();

  console.log(`cv-tool iniciado en ${server.url}`);
  console.log('Abriendo el navegador...');

  openBrowser(server.launchUrl);

  let closing = false;
  const shutdown = async () => {
    if (closing) {
      return;
    }

    closing = true;

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
} catch (error) {
  console.error('No pude iniciar cv-tool.');
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    'Si estás desarrollando, usá "npm run dev". Si es una instalación, ejecutá "npm run build" primero.',
  );
  process.exitCode = 1;
}
