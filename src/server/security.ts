import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export const SESSION_COOKIE = 'cvtool_session';

export interface SecurityOptions {
  port: number;
  vitePort: number;
  isDev: boolean;
  sessionToken: string;
}

export function registerSecurity(app: FastifyInstance, options: SecurityOptions): void {
  const allowedHosts = new Set([`127.0.0.1:${options.port}`, `localhost:${options.port}`]);

  const allowedOrigins = new Set([
    `http://127.0.0.1:${options.port}`,
    `http://localhost:${options.port}`,
  ]);

  if (options.isDev) {
    allowedOrigins.add(`http://127.0.0.1:${options.vitePort}`);
    allowedOrigins.add(`http://localhost:${options.vitePort}`);
  }

  app.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host;

    if (host === undefined || !allowedHosts.has(host)) {
      return reply.code(403).send({ error: 'Host no permitido.' });
    }

    const origin = request.headers.origin;
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      return reply.code(403).send({ error: 'Origen no permitido.' });
    }

    if (request.headers['sec-fetch-site'] === 'cross-site') {
      return reply.code(403).send({ error: 'Origen no permitido.' });
    }

    const pathname = request.url.split('?')[0] ?? '';

    if (pathname.startsWith('/api/')) {
      const cookie = request.cookies?.[SESSION_COOKIE];

      if (cookie === undefined || !safeEqual(cookie, options.sessionToken)) {
        return reply.code(401).send({
          error: 'Sesión no válida. Abrí la URL que te dio cv-tool al iniciar.',
        });
      }
    }
  });

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    options.isDev
      ? `connect-src 'self' http://127.0.0.1:${options.vitePort} ws://127.0.0.1:${options.vitePort}`
      : "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('Content-Security-Policy', csp);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    const pathname = request.url.split('?')[0] ?? '';
    if (pathname.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store');
    }

    return payload;
  });
}

export function setSessionCookie(reply: FastifyReply, sessionToken: string): void {
  reply.setCookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 12,
    // La app es local y habla HTTP en 127.0.0.1; Secure rompería la cookie.
    secure: false,
  });
}

export function hasValidSessionCookie(request: FastifyRequest, sessionToken: string): boolean {
  const cookie = request.cookies?.[SESSION_COOKIE];
  return cookie !== undefined && safeEqual(cookie, sessionToken);
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length === 0 || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function webRedirectUrl(request: FastifyRequest, options: SecurityOptions): string {
  if (!options.isDev) {
    return '/';
  }

  const host = request.headers.host ?? '127.0.0.1';
  const hostname = host.startsWith('[')
    ? host.slice(0, host.indexOf(']') + 1)
    : (host.split(':')[0] ?? '127.0.0.1');
  const safeHost = hostname === 'localhost' ? 'localhost' : '127.0.0.1';

  return `http://${safeHost}:${options.vitePort}/`;
}

export function errorPage(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>cv-tool</title>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 42rem; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.6;">
    <h1>No se pudo abrir la sesión</h1>
    <p>Volvé a ejecutar <code>cv-tool</code> y usá la URL que abre automáticamente.</p>
    <p>Si el problema sigue, cerrá la app y volvé a iniciarla.</p>
  </body>
</html>`;
}
