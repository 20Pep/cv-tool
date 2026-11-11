import { spawn } from 'node:child_process';

/**
 * Abre la URL en el navegador por defecto. Si falla, la app sigue funcionando:
 * la persona puede abrir la URL a mano.
 */
export function openBrowser(url: string): void {
  if (process.env.CVTOOL_NO_OPEN === '1') {
    return;
  }

  const platform = process.platform;

  try {
    if (platform === 'win32') {
      const child = spawn('cmd', ['/c', 'start', '', url], {
        stdio: 'ignore',
        detached: true,
      });
      child.on('error', () => {});
      child.unref();
      return;
    }

    const command = platform === 'darwin' ? 'open' : 'xdg-open';
    const child = spawn(command, [url], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Sin navegador automático; la URL se puede abrir a mano.
  }
}
