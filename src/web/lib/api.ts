import type { ZodType } from 'zod';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiGet<T>(path: string, schema: ZodType<T>): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  return parseResponse(response, schema);
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseResponse(response, schema);
}

export async function apiUpload<T>(path: string, body: FormData, schema: ZodType<T>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    body,
  });

  return parseResponse(response, schema);
}

export async function apiDelete<T>(path: string, schema: ZodType<T>): Promise<T> {
  const response = await fetch(path, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  return parseResponse(response, schema);
}

/**
 * POST que devuelve un archivo para descargar. Lo usamos cuando el PDF se
 * genera al momento (sin guardar la postulación) y la descarga no puede ser
 * un simple link.
 */
export async function apiDownload(
  path: string,
  body: unknown,
  fallbackName: string,
): Promise<string> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Accept: 'application/pdf',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new ApiError(
      'No hay una sesión válida. Volvé a ejecutar cv-tool y usá la URL que abre automáticamente.',
      401,
    );
  }

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);

  return filename;
}

async function parseResponse<T>(response: Response, schema: ZodType<T>): Promise<T> {
  if (response.status === 401) {
    throw new ApiError(
      'No hay una sesión válida. Volvé a ejecutar cv-tool y usá la URL que abre automáticamente.',
      401,
    );
  }

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }

  const parsed = schema.safeParse(await response.json());

  if (!parsed.success) {
    throw new ApiError('El servidor devolvió una respuesta con un formato inesperado.', 500);
  }

  return parsed.data;
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();

    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error;
    }
  } catch {
    // La respuesta de error no era JSON.
  }

  return `El servidor respondió con estado ${response.status}.`;
}
