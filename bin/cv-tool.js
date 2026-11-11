#!/usr/bin/env node
process.env.NODE_ENV = 'production';

try {
  const { startServer } = await import('../dist/server/server/index.js');
  const { openBrowser } = await import('../dist/server/server/openBrowser.js');

  const server = await startServer();

  console.log(`cv-tool iniciado en ${server.url}`);

  if (process.env.CVTOOL_NO_OPEN === '1') {
    console.log('Navegador automático desactivado (CVTOOL_NO_OPEN=1).');
  } else {
    console.log('Abriendo el navegador...');
    openBrowser(server.launchUrl);
  }

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
    'Si estás usando el código fuente, ejecutá "npm run build" primero o usá "npm run dev".',
  );
  process.exitCode = 1;
}
