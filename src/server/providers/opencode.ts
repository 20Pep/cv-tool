import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { GenerateRequest, LLMModel, LLMProvider, ModelRef } from './types.js';
import { ProviderError } from './types.js';

const InfoResponse = z.object({
  version: z.string(),
});

const ModelSchema = z.object({
  providerID: z.string(),
  modelID: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  enabled: z.boolean().optional(),
  variants: z.array(z.object({ id: z.string() })).optional(),
  cost: z
    .array(
      z.object({
        input: z.number(),
        output: z.number(),
      }),
    )
    .optional(),
});

const ModelsResponse = z.object({
  data: z.array(ModelSchema),
});

const GenerateResponse = z.object({
  data: z.object({
    text: z.string(),
  }),
});

const ErrorResponse = z.object({
  _tag: z.string().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
  status: z.number().optional(),
  retryAfterMs: z.number().optional(),
});

const ServiceFile = z.object({
  port: z.number().int().positive(),
  password: z.string().min(1),
});

export interface OpenCodeConfig {
  url: string;
  username: string;
  password: string;
}

export interface OpenCodeServerInfo {
  version: string;
}

export class OpenCodeProvider implements LLMProvider {
  readonly id = 'opencode';
  readonly name = 'OpenCode';

  constructor(private readonly config: OpenCodeConfig) {}

  async getServerInfo(): Promise<OpenCodeServerInfo> {
    return this.request('/api/info', InfoResponse, { timeoutMs: 5_000 });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getServerInfo();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<LLMModel[]> {
    const response = await this.request('/api/model', ModelsResponse, { timeoutMs: 10_000 });

    return response.data
      .filter((model) => model.enabled !== false)
      .filter((model) => model.type === undefined || model.type === 'chat')
      .map((model) => {
        const costs = model.cost ?? [];

        return {
          provider: model.providerID,
          model: model.modelID,
          ...(model.name === undefined ? {} : { name: model.name }),
          ...(model.variants === undefined
            ? {}
            : { variants: model.variants.map((variant) => variant.id) }),
          ...(costs.length === 0
            ? {}
            : { isFree: costs.every((cost) => cost.input === 0 && cost.output === 0) }),
        };
      });
  }

  async generate(req: GenerateRequest): Promise<string> {
    const body: Record<string, unknown> = {
      prompt: `${req.system.trim()}\n\n${req.user.trim()}`,
    };

    if (req.model !== undefined) {
      body.model = toOpenCodeModel(req.model);
    }

    const response = await this.request('/api/experimental/generate/text', GenerateResponse, {
      method: 'POST',
      body,
      signal: req.signal,
      timeoutMs: req.timeoutMs ?? 180_000,
    });

    return response.data.text;
  }

  private async request<T>(
    pathname: string,
    schema: z.ZodType<T>,
    options: {
      method?: 'GET' | 'POST';
      body?: unknown;
      signal?: AbortSignal;
      timeoutMs?: number;
    } = {},
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 30_000;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal =
      options.signal === undefined
        ? timeoutSignal
        : AbortSignal.any([options.signal, timeoutSignal]);

    let response: Response;

    try {
      response = await fetch(new URL(pathname, this.config.url), {
        method: options.method ?? 'GET',
        headers: this.headers(options.body !== undefined),
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        signal,
      });
    } catch (error) {
      if (options.signal?.aborted === true) {
        throw new ProviderError('aborted', 'La operación fue cancelada.');
      }

      if (timeoutSignal.aborted) {
        throw new ProviderError(
          'timeout',
          `OpenCode no respondió en ${Math.round(timeoutMs / 1000)} segundos.`,
          { cause: error },
        );
      }

      throw new ProviderError(
        'unavailable',
        'No pude conectarme con OpenCode. Verificá que esté abierto y que el puerto sea correcto.',
        { cause: error },
      );
    }

    const rawBody = await response.text();
    const payload = parseJson(rawBody);

    if (!response.ok) {
      throw toProviderError(response.status, payload);
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ProviderError(
        'bad_response',
        'OpenCode devolvió una respuesta con un formato inesperado.',
        { cause: parsed.error },
      );
    }

    return parsed.data;
  }

  private headers(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.config.password.length > 0) {
      const credentials = `${this.config.username}:${this.config.password}`;
      headers.Authorization = `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;
    }

    return headers;
  }
}

export async function createOpenCodeProvider(config?: OpenCodeConfig): Promise<OpenCodeProvider> {
  return new OpenCodeProvider(config ?? (await discoverOpenCodeConfig()));
}

/**
 * Descubre la instancia local de OpenCode.
 *
 * Orden:
 * 1. CVTOOL_OPENCODE_URL / OPENCODE_SERVER_URL + OPENCODE_SERVER_PASSWORD.
 * 2. ~/.config/opencode/service.json (servicio en segundo plano de OpenCode).
 * 3. http://127.0.0.1:4096 (serve clásico).
 *
 * El password nunca se loguea ni se incluye en errores.
 */
export async function discoverOpenCodeConfig(): Promise<OpenCodeConfig> {
  const username = process.env.OPENCODE_SERVER_USERNAME ?? 'opencode';
  const envPassword = process.env.OPENCODE_SERVER_PASSWORD;
  const explicitUrl = process.env.CVTOOL_OPENCODE_URL ?? process.env.OPENCODE_SERVER_URL;

  if (explicitUrl !== undefined && explicitUrl.length > 0) {
    return {
      url: explicitUrl.replace(/\/+$/, ''),
      username,
      password: envPassword ?? '',
    };
  }

  const servicePath = path.join(homedir(), '.config', 'opencode', 'service.json');

  try {
    const raw = await readFile(servicePath, 'utf8');
    const parsed = ServiceFile.safeParse(JSON.parse(raw));

    if (parsed.success) {
      return {
        url: `http://127.0.0.1:${parsed.data.port}`,
        username,
        password: envPassword ?? parsed.data.password,
      };
    }
  } catch {
    // Sin service.json se intenta el puerto clásico.
  }

  return {
    url: 'http://127.0.0.1:4096',
    username,
    password: envPassword ?? '',
  };
}

function toOpenCodeModel(model: ModelRef): Record<string, string> {
  return {
    providerID: model.provider,
    id: model.model,
    ...(model.variant === undefined ? {} : { variant: model.variant }),
  };
}

function parseJson(raw: string): unknown {
  if (raw.length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toProviderError(status: number, payload: unknown): ProviderError {
  const parsed = ErrorResponse.safeParse(payload);
  const data = parsed.success ? parsed.data : undefined;
  const providerMessage = data?.message?.trim();

  if (status === 401) {
    return new ProviderError(
      'auth',
      'OpenCode rechazó la autenticación. Revisá OPENCODE_SERVER_PASSWORD.',
      { status },
    );
  }

  if (status === 429 || data?.reason === 'rate_limit') {
    const wait =
      data?.retryAfterMs === undefined
        ? ''
        : ` Esperá unos ${Math.max(1, Math.ceil(data.retryAfterMs / 60_000))} minutos o elegí otro modelo.`;

    return new ProviderError('rate_limit', `OpenCode alcanzó un límite de uso.${wait}`, {
      status,
      ...(data?.retryAfterMs === undefined ? {} : { retryAfterMs: data.retryAfterMs }),
    });
  }

  if (data?.reason === 'authentication') {
    return new ProviderError(
      'auth',
      ['El proveedor de IA rechazó la autenticación.', providerMessage]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(' '),
      { status },
    );
  }

  return new ProviderError(
    'provider',
    providerMessage ?? `OpenCode respondió con estado ${status}.`,
    { status },
  );
}
